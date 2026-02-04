/**
 * Data fetching utilities for the dashboard
 * Supports both local JSON files and Supabase
 */

import { DashboardData, TimeSeriesPoint } from './types';

const USE_SUPABASE = process.env.NEXT_PUBLIC_USE_SUPABASE === 'true';

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
  return response.json();
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

  // Transform Supabase data to match DashboardData format
  const sites = Object.fromEntries(
    sitesRes.data?.map((s) => [s.site_id, s]) || []
  );
  const experiments = Object.fromEntries(
    experimentsRes.data?.map((e) => [e.experiment_id, e]) || []
  );

  return {
    generated_at: new Date().toISOString(),
    sites,
    experiments,
    results: resultsRes.data || [],
  };
}

/**
 * Fetch time series data for a specific experiment and site
 */
export async function fetchTimeSeries(
  experimentId: string,
  siteId: string
): Promise<TimeSeriesPoint[]> {
  // For now, return mock data - will be replaced with actual predictions
  const points: TimeSeriesPoint[] = [];
  const startDate = new Date('2019-01-01');
  
  for (let i = 0; i < 168; i++) { // 1 week of hourly data
    const date = new Date(startDate.getTime() + i * 3600000);
    const baseFlow = 50 + 30 * Math.sin(i / 24 * Math.PI);
    const noise = (Math.random() - 0.5) * 10;
    
    points.push({
      timestamp: date.toISOString(),
      nwm: baseFlow + noise * 1.5,
      usgs: baseFlow + noise * 0.3,
      corrected: baseFlow + noise * 0.5,
      residual: noise * 0.2,
      lower_ci: baseFlow + noise * 0.5 - 5,
      upper_ci: baseFlow + noise * 0.5 + 5,
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
