/**
 * Type definitions for the Hydra Dashboard
 */

export type ModelVersion = 'v2' | 'v3' | 'era5_only';

export type ExperimentCategory = 'v3' | 'v2' | 'era5_only';

export const ERA5_ONLY_EXPERIMENTS = ['hydra_v3_era5_only', 'gru_era5_only'] as const;

export function getExperimentCategory(experimentId: string): ExperimentCategory {
  if ((ERA5_ONLY_EXPERIMENTS as readonly string[]).includes(experimentId)) return 'era5_only';
  if (experimentId.startsWith('hydra_v3')) return 'v3';
  return 'v2';
}

export function isEra5Only(experimentId: string): boolean {
  return (ERA5_ONLY_EXPERIMENTS as readonly string[]).includes(experimentId);
}

export interface SiteMetadata {
  name: string;
  watershed: string;
  type: string;
  lat: number;
  lon: number;
}

export interface MetricSet {
  rmse?: number;
  nse?: number;
  pbias?: number;
  kge?: number;
  nrmse?: number;
  mae?: number;
  pearson_r?: number;
  spearman_r?: number;
}

export interface QuantileCoverage {
  coverage: number;
  bias: number;
}

export interface BiasShiftInfo {
  strategy: string;
  alpha: number;
  applied: number;
  mean_bias: number | null;
  pbias_percent: number | null;
  scale: number | null;
  samples: number;
  status: string;
}

export interface ExperimentResult {
  experiment: string;
  site_id: string;
  file: string;
  model_version: ModelVersion;
  baseline: MetricSet;
  corrected: MetricSet;
  rmse_improvement_pct: number | null;
  rmse_residual?: number | null;
  quantiles?: Record<string, QuantileCoverage>;
  bias_shift?: BiasShiftInfo;
}

export interface ExperimentMetadata {
  name: string;
  description: string;
}

export interface DashboardData {
  generated_at: string;
  sites: Record<string, SiteMetadata>;
  experiments: Record<string, ExperimentMetadata>;
  results: ExperimentResult[];
}

export interface TimeSeriesPoint {
  timestamp: string;
  nwm: number;
  usgs: number;
  corrected: number;
  residual?: number;
  lower_ci?: number;
  upper_ci?: number;
}

export interface GradientData {
  epoch: number;
  layer: string;
  mean_grad: number;
  max_grad: number;
  min_grad: number;
}

// Metric comparison for bar charts
export interface MetricComparison {
  metric: string;
  baseline: number;
  corrected: number;
  improvement: number;
}

// Version comparison (v2 best vs v3 best per site)
export interface VersionComparisonRow {
  site_id: string;
  site_name: string;
  v2_experiment: string;
  v2_nse: number;
  v2_rmse: number;
  v2_improvement: number;
  v3_experiment: string;
  v3_nse: number;
  v3_rmse: number;
  v3_improvement: number;
}

// --- Rigorous Evaluation Types ---

export interface CIMetric {
  value: number | null;
  ci?: [number, number] | null;
  se?: number | null;
}

export interface KGEComponents {
  kge: number;
  r: number;
  alpha: number;
  beta: number;
}

export interface HeadlineMetrics {
  ss_rmse: CIMetric;
  delta_nse: CIMetric;
  delta_kge: CIMetric;
  kge_components: {
    nwm: KGEComponents;
    hydra: KGEComponents;
  };
}

export interface FlowRegimeSkill {
  ss_rmse: CIMetric;
  ss_mae?: CIMetric;
  n_samples: number;
}

export interface ErrorStructure {
  pbias_nwm: number;
  pbias_hydra: number;
  me_nwm: number;
  me_hydra: number;
  delta_abs_pbias: number;
  delta_abs_me: number;
  high_flow: FlowRegimeSkill;
  low_flow: FlowRegimeSkill;
}

export interface PeakTiming {
  n_peaks: number;
  median_abs_timing_nwm_h?: number;
  median_abs_timing_hydra_h?: number;
  mean_abs_timing_nwm_h?: number;
  mean_abs_timing_hydra_h?: number;
  timing_improvement_h?: number;
}

export interface DMTest {
  dm_statistic: number;
  p_value: number;
  mean_loss_diff: number;
  significant_005: boolean;
  significant_001: boolean;
  hydra_better?: boolean;
}

export interface RegimeMetrics {
  n_samples: number;
  insufficient?: boolean;
  rmse_nwm?: number;
  rmse_hydra?: number;
  ss_rmse?: number;
  ss_mae?: number;
  mae_nwm?: number;
  mae_hydra?: number;
  nse_nwm?: number;
  nse_hydra?: number;
  delta_nse?: number;
  delta_kge?: number;
  pbias_nwm?: number;
  pbias_hydra?: number;
  me_nwm?: number;
  me_hydra?: number;
}

export type RegimeKey = 'low' | 'mid' | 'high' | 'rising' | 'falling'
  | 'high_rising' | 'high_falling' | 'low_rising' | 'low_falling';

export interface RawMetrics {
  rmse_nwm: number;
  rmse_hydra: number;
  mae_nwm: number;
  mae_hydra: number;
  nse_nwm: number;
  nse_hydra: number;
}

export interface WindowEval {
  headline: HeadlineMetrics;
  error_structure: ErrorStructure;
  distribution: {
    ss_var_err: CIMetric;
    peak_timing: PeakTiming;
  };
  significance: { dm_test: DMTest };
  regimes: Record<RegimeKey, RegimeMetrics>;
  n_samples: number;
  raw_metrics: RawMetrics;
  insufficient?: boolean;
}

export type SeasonKey = 'DJF' | 'MAM' | 'JJA' | 'SON';

export interface SiteEval {
  full_period: WindowEval;
  seasonal: Record<SeasonKey, WindowEval>;
}

export interface CrossSiteAgg {
  n_sites: number;
  median_ss_rmse: number | null;
  iqr_ss_rmse: [number, number] | null;
  median_delta_nse: number | null;
  iqr_delta_nse: [number, number] | null;
  median_delta_kge: number | null;
  sites_significant_005: number;
  sites_significant_001: number;
}

export interface RigorousEvalData {
  generated_at: string;
  bootstrap: { block_size: number; n_reps: number; ci_level: number };
  sites: string[];
  experiments: string[];
  results: Record<string, Record<string, SiteEval>>;
  cross_site: Record<string, CrossSiteAgg>;
}
