/**
 * Type definitions for the Hydra Dashboard
 */

export type ModelVersion = 'v2' | 'v3';

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
