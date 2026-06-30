export type SafetySourceKey = 'nwsWatchWarning' | 'nwsTurnAround' | 'readyFloods';

export interface SafetySource {
  key: SafetySourceKey;
  label: string;
  url: string;
}

export interface FloodEducationCard {
  eyebrow: string;
  title: string;
  body: string;
  source: SafetySourceKey;
}

export interface HydraSignal {
  name: string;
  role: string;
  detail: string;
}

export interface ExperienceCta {
  label: string;
  href: string;
  body: string;
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
  opening: {
    kicker: 'Hydra Experience',
    title: 'It starts as rain.',
    body:
      'A few drops. A forecast. A road you have driven a hundred times. Flood risk can become dangerous before it looks dramatic.',
  },
  educationCards: [
    {
      eyebrow: 'Flood Watch',
      title: 'Conditions are favorable.',
      body:
        'A watch means flooding is possible. It is the point where people should start paying attention, checking routes, and preparing to act.',
      source: 'nwsWatchWarning',
    },
    {
      eyebrow: 'Flood Warning',
      title: 'Flooding is expected or happening.',
      body:
        'A warning moves the situation from possibility toward action. The safest decisions often happen before roads are covered.',
      source: 'nwsWatchWarning',
    },
    {
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
      'Do not drive through floodwater. The safer decision is to turn around and choose another route before options disappear.',
    safeResult:
      'Turning around preserves choices. Early action is the point of a warning: move before the road, bridge, or underpass becomes a trap.',
    source: 'nwsTurnAround' as SafetySourceKey,
  },
  hydraSignals: [
    {
      name: 'Sense',
      role: 'Rainfall, river gauges, and water sensors',
      detail: 'Hydra watches many local signals at once instead of waiting for one late threshold.',
    },
    {
      name: 'Predict',
      role: 'Terrain, drainage stress, and forecast shifts',
      detail: 'The demo turns scattered conditions into a changing risk picture.',
    },
    {
      name: 'Alert',
      role: 'Earlier decision support',
      detail: 'The experience shows how clearer timing could help people act before routes are cut off.',
    },
    {
      name: 'Coordinate',
      role: 'Hotspots, road closures, and priority zones',
      detail: 'Responders need a shared view when water is moving faster than field reports.',
    },
    {
      name: 'Learn',
      role: 'Post-event improvement',
      detail: 'Every event can improve the next risk picture when evidence is preserved and reviewed.',
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
