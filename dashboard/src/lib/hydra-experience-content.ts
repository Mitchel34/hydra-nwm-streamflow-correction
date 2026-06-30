export type SafetySourceKey = 'nwsWatchWarning' | 'nwsTurnAround' | 'readyFloods';

export interface SafetySource {
  key: SafetySourceKey;
  label: string;
  url: string;
}

export interface FloodEducationCard {
  stage: WarningStageKey;
  eyebrow: string;
  title: string;
  body: string;
  source: SafetySourceKey;
}

export interface HydraSignal {
  name: string;
  role: string;
  detail: string;
  layers: SignalLayerKey[];
}

export interface ExperienceCta {
  label: string;
  href: string;
  body: string;
}

export type SignalLayerKey =
  | 'rainfall'
  | 'gauge'
  | 'terrain'
  | 'drainage'
  | 'roads'
  | 'forecast'
  | 'sensor'
  | 'response';

export type WarningStageKey = 'watch' | 'warning' | 'flash';

export interface WarningStageConfig {
  key: WarningStageKey;
  shortLabel: string;
  sceneLabel: string;
  intensity: number;
}

export interface ExperienceSignalNode {
  id: string;
  label: string;
  layer: SignalLayerKey;
  detail: string;
  x: number;
  y: number;
}

export interface SignalLayerConfig {
  key: SignalLayerKey;
  label: string;
  description: string;
}

export interface CinematicSceneCopy {
  id: string;
  label: string;
  cue: string;
}

export interface EvidenceBridge {
  eyebrow: string;
  title: string;
  body: string;
  statement: string;
}

export const safetySources: Record<SafetySourceKey, SafetySource> = {
  nwsWatchWarning: {
    key: 'nwsWatchWarning',
    label: 'NWS flood watch and warning guidance',
    url: 'https://www.weather.gov/safety/flood-watch-warning',
  },
  nwsTurnAround: {
    key: 'nwsTurnAround',
    label: 'NWS Turn Around Don’t Drown guidance',
    url: 'https://www.weather.gov/safety/flood-turn-around-dont-drown',
  },
  readyFloods: {
    key: 'readyFloods',
    label: 'Ready.gov flood protective actions',
    url: 'https://www.ready.gov/floods',
  },
};

export const hydraExperience = {
  thesis:
    'A flood does not begin when water reaches your door. It begins when the warning comes too late.',
  tagline: 'Hydra: Many signals. One warning. More time.',
  safetyDisclaimer:
    'This is an educational simulation. In an actual emergency, follow official alerts and local authorities.',
  cinematicScenes: [
    {
      id: 'quiet-storm',
      label: 'Quiet storm',
      cue: 'Rain is visible, the road is still readable, and the warning problem has not yet announced itself.',
    },
    {
      id: 'road-disappears',
      label: 'Road disappears',
      cue: 'Depth cues fail as water covers lane markings and reflections hide the crossing.',
    },
    {
      id: 'signal-difference',
      label: 'Signal difference',
      cue: 'Scattered observations become lead time when Hydra organizes them into one decision view.',
    },
  ] satisfies CinematicSceneCopy[],
  environmentCues: [
    'Low-water crossing',
    'Bridge silhouette',
    'Headlight reflections',
    'Rising surface line',
  ],
  leadTimeMarkers: ['0 min', '15 min', '30 min', 'earlier action'],
  warningStages: {
    watch: {
      key: 'watch',
      shortLabel: 'Watch',
      sceneLabel: 'Possible flooding',
      intensity: 0.18,
    },
    warning: {
      key: 'warning',
      shortLabel: 'Warning',
      sceneLabel: 'Expected or happening',
      intensity: 0.56,
    },
    flash: {
      key: 'flash',
      shortLabel: 'Flash warning',
      sceneLabel: 'Act immediately',
      intensity: 0.92,
    },
  } satisfies Record<WarningStageKey, WarningStageConfig>,
  evidenceBridge: {
    eyebrow: 'Evidence bridge',
    title: 'The experience shows the problem. The findings show the evidence chain.',
    body:
      'The cinematic sequence is a teaching layer. The research pages document the model evidence, ERA5 feature sweeps, manuscript artifacts, and limitations behind Hydra.',
    statement:
      'Flooding is not only a water problem. It is a warning-time problem.',
  } satisfies EvidenceBridge,
  opening: {
    kicker: 'Hydra Experience',
    title: 'It starts as rain.',
    body:
      'A few drops. A forecast. A road you have driven a hundred times. Flood risk can become dangerous before it looks dramatic.',
  },
  signalLayers: [
    {
      key: 'rainfall',
      label: 'Rainfall',
      description: 'Storm intensity and short-term rainfall accumulation.',
    },
    {
      key: 'gauge',
      label: 'Gauge',
      description: 'River-stage and streamflow changes near local crossings.',
    },
    {
      key: 'terrain',
      label: 'Terrain',
      description: 'Low crossings, slopes, and places where runoff concentrates.',
    },
    {
      key: 'drainage',
      label: 'Drainage',
      description: 'Runoff moving faster than channels, culverts, or roads can clear it.',
    },
    {
      key: 'roads',
      label: 'Roads',
      description: 'Segments that may become threatened before water reaches homes.',
    },
    {
      key: 'forecast',
      label: 'Forecast',
      description: 'Weather shifts that change the lead-time picture.',
    },
    {
      key: 'sensor',
      label: 'Sensors',
      description: 'Local observations that reveal conditions between reports.',
    },
    {
      key: 'response',
      label: 'Response',
      description: 'Responder reports, road closures, and priority zones.',
    },
  ] satisfies SignalLayerConfig[],
  signalNodes: [
    {
      id: 'rainfall-rate',
      label: 'Rainfall rate',
      layer: 'rainfall',
      detail: 'Rainfall is intensifying over a short window.',
      x: 17,
      y: 36,
    },
    {
      id: 'gauge-rise',
      label: 'Gauge rise',
      layer: 'gauge',
      detail: 'Water level is changing faster than the last report cycle.',
      x: 36,
      y: 23,
    },
    {
      id: 'drainage-stress',
      label: 'Drainage stress',
      layer: 'drainage',
      detail: 'Runoff is accumulating faster than the system can clear.',
      x: 55,
      y: 48,
    },
    {
      id: 'road-access',
      label: 'Road access',
      layer: 'roads',
      detail: 'Low crossings may be cut off before water reaches homes.',
      x: 74,
      y: 38,
    },
    {
      id: 'forecast-shift',
      label: 'Forecast shift',
      layer: 'forecast',
      detail: 'The storm path is changing the available lead time.',
      x: 29,
      y: 67,
    },
    {
      id: 'terrain-bowl',
      label: 'Terrain',
      layer: 'terrain',
      detail: 'Nearby slopes and channels concentrate water toward the road.',
      x: 62,
      y: 71,
    },
    {
      id: 'sensor-anomaly',
      label: 'Sensor anomaly',
      layer: 'sensor',
      detail: 'A local observation no longer matches the calm-looking surface.',
      x: 83,
      y: 62,
    },
    {
      id: 'responder-report',
      label: 'Responder report',
      layer: 'response',
      detail: 'A field report adds context that a single hydrograph cannot show.',
      x: 43,
      y: 82,
    },
  ] satisfies ExperienceSignalNode[],
  educationCards: [
    {
      stage: 'watch',
      eyebrow: 'Flood Watch',
      title: 'Conditions are favorable.',
      body:
        'A watch means flooding is possible. It is the point where people should start paying attention, checking routes, and preparing to act.',
      source: 'nwsWatchWarning',
    },
    {
      stage: 'warning',
      eyebrow: 'Flood Warning',
      title: 'Flooding is expected or happening.',
      body:
        'A warning moves the situation from possibility toward action. The safest decisions often happen before roads are covered.',
      source: 'nwsWatchWarning',
    },
    {
      stage: 'flash',
      eyebrow: 'Flash Flood Warning',
      title: 'Act immediately.',
      body:
        'Flash flooding can be imminent or already occurring. People in flood-prone areas should move to higher ground and follow official guidance.',
      source: 'nwsWatchWarning',
    },
  ] satisfies FloodEducationCard[],
  roadChoice: {
    title: 'Would you continue?',
    body:
      'Depth and current are difficult to judge from the driver seat. Flooded roads hide washouts, moving water, and debris.',
    unsafeResult:
      'Depth is almost impossible to judge from the driver’s seat. Floodwater can hide washouts, debris, and collapsed roadbeds. The safe educational answer is to turn around.',
    safeResult:
      'Correct decision. The safest route is the one taken before the road disappears.',
    source: 'nwsTurnAround' as SafetySourceKey,
  },
  hydraSignals: [
    {
      name: 'Sense',
      role: 'Rainfall, river gauges, and water sensors',
      detail: 'Hydra watches many local signals at once instead of waiting for one late threshold.',
      layers: ['rainfall', 'gauge', 'sensor'],
    },
    {
      name: 'Predict',
      role: 'Terrain, drainage stress, and forecast shifts',
      detail: 'The demo turns scattered conditions into a changing risk picture.',
      layers: ['terrain', 'drainage', 'forecast'],
    },
    {
      name: 'Alert',
      role: 'Earlier decision support',
      detail: 'The experience shows how clearer timing could help people act before routes are cut off.',
      layers: ['roads', 'forecast', 'response'],
    },
    {
      name: 'Coordinate',
      role: 'Hotspots, road closures, and priority zones',
      detail: 'Responders need a shared view when water is moving faster than field reports.',
      layers: ['roads', 'response', 'sensor'],
    },
    {
      name: 'Learn',
      role: 'Post-event improvement',
      detail: 'Every event can improve the next risk picture when evidence is preserved and reviewed.',
      layers: ['gauge', 'sensor', 'response'],
    },
  ] satisfies HydraSignal[],
  comparison: {
    without: [
      'People notice danger after water is already across roads.',
      'Alerts feel broad, late, or hard to translate into local action.',
      'Responders react with incomplete visibility.',
    ],
    withHydra: [
      'Risk signals are organized before the flood is visually obvious.',
      'Residents see clearer timing and protective actions.',
      'Responders see hotspots, sensor spikes, and priority zones sooner.',
    ],
    guardrail:
      'Hydra Experience is an educational decision-support demo. It does not issue official warnings or guarantee safety.',
  },
  ctas: [
    {
      label: 'Read Findings',
      href: '/analysis',
      body: 'See the evidence chain for local National Water Model correction.',
    },
    {
      label: 'Explore ERA5 Evidence',
      href: '/era5',
      body: 'Inspect the completed ERA5 feature-sweep results.',
    },
    {
      label: 'Open Experiments',
      href: '/experiments',
      body: 'Compare archived controlled experiments and hydrographs.',
    },
    {
      label: 'View Model',
      href: '/model',
      body: 'Review Hydra as a residual-correction method.',
    },
    {
      label: 'Manuscript',
      href: '/manuscript',
      body: 'Open the Phase 4 manuscript source bundle and PDF status.',
    },
  ] satisfies ExperienceCta[],
};
