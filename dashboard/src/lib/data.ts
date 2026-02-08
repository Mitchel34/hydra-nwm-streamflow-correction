/**
 * Data fetching utilities for the dashboard
 * Supports both local JSON files and Supabase
 */

import { DashboardData, TimeSeriesPoint } from './types';

const USE_SUPABASE = process.env.NEXT_PUBLIC_USE_SUPABASE === 'true';

// Exclude regulated site from dashboard (dam operations introduce non-stationarity)
const EXCLUDED_SITES = ['03486000'];

// Supabase configuration (optional - will fall back to local JSON)
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

/**
 * Fetch experiment results from local JSON or Supabase
 */
export async function fetchExperimentResults(): Promise<DashboardData> {
  if (USE_SUPABASE && SUPABASE_URL) {
    return fetchFromSupabase();
  }
  return fetchFromLocalJSON();
}

async function fetchFromLocalJSON(): Promise<DashboardData> {
  const response = await fetch('/data/experiment_results.json');
  if (!response.ok) {
    throw new Error('Failed to fetch experiment results');
  }
  const data: DashboardData = await response.json();

  // Filter out excluded sites (regulated sites with dam operations)
  const filteredSites = Object.fromEntries(
    Object.entries(data.sites).filter(([siteId]) => !EXCLUDED_SITES.includes(siteId))
  );
  const filteredResults = data.results.filter(
    (result) => !EXCLUDED_SITES.includes(result.site_id)
  );

  return {
    ...data,
    sites: filteredSites,
    results: filteredResults,
  };
}

async function fetchFromSupabase(): Promise<DashboardData> {
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const [sitesRes, experimentsRes, resultsRes] = await Promise.all([
    supabase.from('sites').select('*'),
    supabase.from('experiments').select('*'),
    supabase.from('results').select('*'),
  ]);

  if (sitesRes.error || experimentsRes.error || resultsRes.error) {
    console.error('Supabase error, falling back to local JSON');
    return fetchFromLocalJSON();
  }

  // Transform Supabase data to match DashboardData format, excluding regulated sites
  const sites = Object.fromEntries(
    (sitesRes.data || [])
      .filter((s) => !EXCLUDED_SITES.includes(s.site_id))
      .map((s) => [s.site_id, s])
  );
  const experiments = Object.fromEntries(
    experimentsRes.data?.map((e) => [e.experiment_id, e]) || []
  );
  const results = (resultsRes.data || []).filter(
    (r) => !EXCLUDED_SITES.includes(r.site_id)
  );

  return {
    generated_at: new Date().toISOString(),
    sites,
    experiments,
    results,
  };
}

/**
 * Fetch time series data for a specific experiment and site
 */
export async function fetchTimeSeries(
  experimentId: string,
  siteId: string
): Promise<TimeSeriesPoint[]> {
  // First try to load precomputed time series emitted by external experiment workflows.
  try {
    const path = `/data/timeseries/${experimentId}_${siteId}.json`;
    const response = await fetch(path);
    if (response.ok) {
      const payload = (await response.json()) as TimeSeriesPoint[];
      if (Array.isArray(payload) && payload.length > 0) {
        return payload;
      }
    }
  } catch {
    // Fall through to synthetic data generation.
  }

  // Fallback synthetic series for UI development when experiment exports are incomplete.
  const seed = `${experimentId}:${siteId}`;
  let state = 0;
  for (let i = 0; i < seed.length; i += 1) {
    state = (state * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const seededRandom = () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };

  const points: TimeSeriesPoint[] = [];
  const startDate = new Date('2019-01-01');

  for (let i = 0; i < 168; i += 1) {
    // 1 week of hourly data
    const date = new Date(startDate.getTime() + i * 3600000);
    const diurnal = 18 * Math.sin((i / 24) * Math.PI);
    const eventPulse = 22 * Math.exp(-Math.pow((i - 86) / 28, 2));
    const baseFlow = 42 + diurnal + eventPulse;
    const noise = (seededRandom() - 0.5) * 10;
    const nwmBias = 2.4 + (seededRandom() - 0.5) * 2;
    const correction = 0.72 + seededRandom() * 0.18;
    const nwm = Math.max(0, baseFlow + nwmBias + noise * 1.1);
    const usgs = Math.max(0, baseFlow + noise * 0.45);
    const corrected = Math.max(0, usgs + (nwm - usgs) * (1 - correction));

    points.push({
      timestamp: date.toISOString(),
      nwm,
      usgs,
      corrected,
      residual: nwm - usgs,
      lower_ci: Math.max(0, corrected - 3.5),
      upper_ci: corrected + 3.5,
    });
  }

  return points;
}

/**
 * Format metric name for display
 */
export function formatMetricName(metric: string): string {
  const names: Record<string, string> = {
    rmse: 'RMSE (m³/s)',
    nse: 'NSE',
    pbias: 'PBIAS (%)',
    kge: 'KGE',
    nrmse: 'NRMSE',
    mae: 'MAE (m³/s)',
  };
  return names[metric] || metric.toUpperCase();
}

/**
 * Get color for metric improvement
 */
export function getImprovementColor(
  metric: string,
  baseline: number,
  corrected: number
): string {
  const isImproved = isMetricImproved(metric, baseline, corrected);
  return isImproved ? '#10b981' : '#ef4444'; // green or red
}

/**
 * Check if metric improved (accounting for direction)
 */
export function isMetricImproved(
  metric: string,
  baseline: number,
  corrected: number
): boolean {
  // Higher is better: NSE, KGE
  // Lower is better: RMSE, MAE, NRMSE
  // Closer to 0 is better: PBIAS
  const higherIsBetter = ['nse', 'kge'];
  const lowerIsBetter = ['rmse', 'mae', 'nrmse'];
  
  if (higherIsBetter.includes(metric)) {
    return corrected > baseline;
  }
  if (lowerIsBetter.includes(metric)) {
    return corrected < baseline;
  }
  // PBIAS - closer to 0
  return Math.abs(corrected) < Math.abs(baseline);
}

/**
 * Calculate improvement percentage
 */
export function calculateImprovement(
  metric: string,
  baseline: number,
  corrected: number
): number {
  if (baseline === 0) return 0;
  
  const higherIsBetter = ['nse', 'kge'];
  const lowerIsBetter = ['rmse', 'mae', 'nrmse'];
  
  if (lowerIsBetter.includes(metric)) {
    return ((baseline - corrected) / baseline) * 100;
  }
  if (higherIsBetter.includes(metric)) {
    return ((corrected - baseline) / Math.abs(baseline)) * 100;
  }
  // PBIAS - improvement towards 0
  return ((Math.abs(baseline) - Math.abs(corrected)) / Math.abs(baseline)) * 100;
}
