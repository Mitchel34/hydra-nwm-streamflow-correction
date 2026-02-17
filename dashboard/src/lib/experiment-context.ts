import { isEra5Only } from './types';

export interface ExperimentLabels {
  baselineName: string;
  baselineShort: string;
  comparisonLabel: string;
  correctedName: string;
  observedName: string;
  hydrographAria: string;
}

export function getExperimentLabels(experimentId: string): ExperimentLabels {
  if (isEra5Only(experimentId)) {
    return {
      baselineName: 'ERA5 prediction',
      baselineShort: 'ERA5',
      comparisonLabel: 'vs USGS observed',
      correctedName: 'Hydra corrected',
      observedName: 'Observed (USGS)',
      hydrographAria:
        'Hydrograph comparing observed, ERA5 prediction, and Hydra-corrected streamflow',
    };
  }
  return {
    baselineName: 'Raw NWM',
    baselineShort: 'NWM',
    comparisonLabel: 'vs NWM baseline',
    correctedName: 'Hydra corrected',
    observedName: 'Observed (USGS)',
    hydrographAria:
      'Hydrograph comparing observed, NWM raw, and Hydra-corrected streamflow',
  };
}
