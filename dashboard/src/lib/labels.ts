export function getPublicExperimentName(id: string, fallback?: string): string {
  const names: Record<string, string> = {
    hydra_v3_usgs_nwm_era5: 'Gauge-informed Hydra',
    hydra_v3_usgs_era5: 'Gauge + ERA5, NWM removed',
    hydra_v3_nwm_era5: 'Gauge-free NWM + ERA5',
    hydra_v3_era5_only: 'ERA5-only Hydra surrogate',
    gru_era5_only: 'ERA5-only GRU surrogate',
    hydra_v3_causal_nonneg: 'Hydra with leakage controls and non-negativity',
    hydra_v3_causal_nonneg_event: 'Hydra with event sampling',
    hydra_v3_event_oversample: 'Hydra event-sampling test',
    hydra_v3_nonneg: 'Hydra non-negativity test',
    hydra_v3_causal: 'Hydra leakage-control test',
    transformer_nwm_era5: 'Transformer baseline',
    lstm_nwm_era5: 'LSTM baseline',
    gru_transformer_v2_nwm_era5: 'GRU-Transformer baseline',
    gru_transformer_v2_causal_nonneg: 'GRU-Transformer constrained test',
    gru_transformer_v2_nonneg: 'GRU-Transformer non-negativity test',
    gru_transformer_v2_causal: 'GRU-Transformer leakage-control test',
  };
  return names[id] ?? fallback ?? id.replace(/_/g, ' ');
}

export function getPublicExperimentDescription(id: string, fallback?: string): string {
  const descriptions: Record<string, string> = {
    hydra_v3_usgs_nwm_era5:
      'Primary configuration using recent USGS observations, raw NWM discharge, and ERA5-Land context.',
    hydra_v3_usgs_era5:
      'Input-source ablation that removes NWM from the gauge-informed feature set.',
    hydra_v3_nwm_era5:
      'Gauge-free surrogate using raw NWM discharge and ERA5-Land context only.',
    hydra_v3_era5_only:
      'Gauge-free surrogate using ERA5-Land context without NWM or recent gauge observations.',
    gru_era5_only:
      'Simpler ERA5-only gauge-free surrogate.',
  };
  return descriptions[id] ?? fallback ?? 'Controlled experiment from the dashboard result archive.';
}

export function getExperimentSourceLabel(id: string): string {
  if (id.includes('usgs_nwm')) return 'Gauge + NWM + ERA5';
  if (id.includes('usgs_era5')) return 'Gauge + ERA5';
  if (id.includes('era5_only')) return 'ERA5 only';
  return 'NWM + ERA5';
}
