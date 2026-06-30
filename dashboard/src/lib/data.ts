/**
 * Data fetching utilities for the dashboard
 * Supports both local JSON files and Supabase
 */

import {
  DashboardData,
  Era5SweepData,
  ExperimentResult,
  RigorousEvalData,
  TimeSeriesPoint,
  VersionComparisonRow,
  getExperimentCategory,
  isEra5Only,
} from './types';

const USE_SUPABASE = process.env.NEXT_PUBLIC_USE_SUPABASE === 'true';

// Exclude the regulated boundary site from primary public summaries.
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

  // Infer model_version where missing (backward compat)
  for (const r of data.results) {
    if (!r.model_version) {
      r.model_version = getExperimentCategory(r.experiment);
    }
  }

  // Filter out excluded boundary sites from primary public summaries.
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

  // Transform Supabase data to match DashboardData format, excluding boundary sites.
  const sites = Object.fromEntries(
    (sitesRes.data || [])
      .filter((s) => !EXCLUDED_SITES.includes(s.site_id))
      .map((s) => [s.site_id, s])
  );
  const experiments = Object.fromEntries(
    experimentsRes.data?.map((e) => [e.experiment_id, e]) || []
  );
  const results = (resultsRes.data || [])
    .filter((r) => !EXCLUDED_SITES.includes(r.site_id))
    .map((r) => ({
      ...r,
      model_version: r.model_version || getExperimentCategory(r.experiment),
    }));

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
): Promise<TimeSeriesPoint[] | null> {
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
    // No timeseries available for this combination.
  }
  return null;
}

/**
 * Build v2-vs-v3 comparison rows for "Version Comparison" chart.
 * For each site, find the best v2 and best v3 experiment by RMSE improvement.
 */
export function buildVersionComparison(
  results: ExperimentResult[],
  sites: Record<string, { name: string }>,
): VersionComparisonRow[] {
  const siteIds = [...new Set(results.map((r) => r.site_id))];
  const rows: VersionComparisonRow[] = [];

  for (const siteId of siteIds) {
    const siteResults = results
      .filter((r) => r.site_id === siteId)
      .filter((r) => !isEra5Only(r.experiment));
    const v2 = siteResults.filter((r) => r.model_version === 'v2');
    const v3 = siteResults.filter((r) => r.model_version === 'v3');

    const bestV2 = v2.reduce<ExperimentResult | null>(
      (best, r) =>
        !best || (r.rmse_improvement_pct ?? 0) > (best.rmse_improvement_pct ?? 0) ? r : best,
      null,
    );
    const bestV3 = v3.reduce<ExperimentResult | null>(
      (best, r) =>
        !best || (r.rmse_improvement_pct ?? 0) > (best.rmse_improvement_pct ?? 0) ? r : best,
      null,
    );

    if (bestV2 && bestV3) {
      rows.push({
        site_id: siteId,
        site_name: sites[siteId]?.name ?? siteId,
        v2_experiment: bestV2.experiment,
        v2_nse: bestV2.corrected.nse ?? 0,
        v2_rmse: bestV2.corrected.rmse ?? 0,
        v2_improvement: bestV2.rmse_improvement_pct ?? 0,
        v3_experiment: bestV3.experiment,
        v3_nse: bestV3.corrected.nse ?? 0,
        v3_rmse: bestV3.corrected.rmse ?? 0,
        v3_improvement: bestV3.rmse_improvement_pct ?? 0,
      });
    }
  }

  return rows;
}

/**
 * Fetch rigorous evaluation data (skill scores, CIs, significance tests)
 */
export async function fetchRigorousEval(): Promise<RigorousEvalData | null> {
  try {
    const response = await fetch('/data/rigorous_eval.json');
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

/**
 * Fetch completed ERA5 feature-sweep evidence exported from revision artifacts.
 */
export async function fetchEra5Sweep(): Promise<Era5SweepData | null> {
  try {
    const response = await fetch('/data/era5_sweep.json');
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
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
    pearson_r: 'Pearson r',
    spearman_r: 'Spearman ρ',
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
  // Higher is better: NSE, KGE, pearson_r, spearman_r
  // Lower is better: RMSE, MAE, NRMSE
  // Closer to 0 is better: PBIAS
  const higherIsBetter = ['nse', 'kge', 'pearson_r', 'spearman_r'];
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
  
  const higherIsBetter = ['nse', 'kge', 'pearson_r', 'spearman_r'];
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
