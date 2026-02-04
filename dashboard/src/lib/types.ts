/**
 * Type definitions for the Hydra Dashboard
 */

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
}

export interface ExperimentResult {
  experiment: string;
  site_id: string;
  file: string;
  baseline: MetricSet;
  corrected: MetricSet;
  rmse_improvement_pct: number | null;
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
