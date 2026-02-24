'use client';

import { useMemo } from 'react';
import { RigorousEvalData } from '@/lib/types';

export type VersionFilter = 'all' | 'operational' | 'nowcasting';

const HIDDEN_EXPERIMENTS = new Set([
  'gru_transformer_v2_nwm_era5_tuned',
  'gru_transformer_v2_direct',
  'hydra_v3_full_autonorm',
]);

const NOWCASTING_EXPERIMENTS = new Set([
  'hydra_v3_usgs_nwm_era5',
  'hydra_v3_usgs_era5',
]);

function getGroup(id: string): 'operational' | 'nowcasting' | 'hidden' {
  if (HIDDEN_EXPERIMENTS.has(id)) return 'hidden';
  if (NOWCASTING_EXPERIMENTS.has(id)) return 'nowcasting';
  return 'operational';
}

interface ExperimentSelectorProps {
  experiments: Record<string, { name: string; description: string }>;
  selected: string;
  onSelect: (experimentId: string) => void;
  availableExperiments?: Set<string>;
  versionFilter?: VersionFilter;
  onVersionFilterChange?: (filter: VersionFilter) => void;
  evalData?: RigorousEvalData | null;
}

export default function ExperimentSelector({
  experiments,
  selected,
  onSelect,
  availableExperiments,
  versionFilter = 'all',
  onVersionFilterChange,
  evalData,
}: ExperimentSelectorProps) {
  const groups = useMemo(() => {
    const operational: [string, { name: string; description: string }][] = [];
    const nowcasting: [string, { name: string; description: string }][] = [];
    for (const [id, exp] of Object.entries(experiments)) {
      const group = getGroup(id);
      if (group === 'hidden') continue;
      if (group === 'nowcasting') nowcasting.push([id, exp]);
      else operational.push([id, exp]);
    }
    return { operational, nowcasting };
  }, [experiments]);

  const showOperational = versionFilter === 'all' || versionFilter === 'operational';
  const showNowcasting = versionFilter === 'all' || versionFilter === 'nowcasting';

  const filterTabs: { id: VersionFilter; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: groups.operational.length + groups.nowcasting.length },
    { id: 'operational', label: 'Operational', count: groups.operational.length },
    { id: 'nowcasting', label: 'Nowcasting', count: groups.nowcasting.length },
  ];

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      {onVersionFilterChange && (
        <div className="flex gap-2 flex-wrap">
          {filterTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onVersionFilterChange(tab.id)}
              className={`rounded-full px-3 py-2 text-xs font-display uppercase tracking-[0.1em] transition-all ${
                versionFilter === tab.id
                  ? tab.id === 'nowcasting'
                    ? 'bg-hydra-corrected/20 text-hydra-corrected border border-hydra-corrected/40'
                    : 'bg-hydra-accent/20 text-hydra-accent border border-hydra-accent/40'
                  : 'bg-[#0c1a26] text-[#7f9db2] border border-[#264257] hover:border-[#3b5f79]'
              }`}
            >
              {tab.label}
              <span className="ml-1 opacity-60">{tab.count}</span>
            </button>
          ))}
        </div>
      )}

      {/* Nowcasting experiments */}
      {showNowcasting && groups.nowcasting.length > 0 && (
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-hydra-corrected/70 mb-2 font-display">
            Nowcasting — Requires Real-Time USGS Observations
          </p>
          <ExperimentGrid
            entries={groups.nowcasting}
            selected={selected}
            onSelect={onSelect}
            availableExperiments={availableExperiments}
            accentClass="border-hydra-corrected/55 bg-hydra-corrected/[0.14]"
            evalData={evalData}
          />
        </div>
      )}

      {/* Operational experiments */}
      {showOperational && groups.operational.length > 0 && (
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-hydra-accent/80 mb-2 font-display">
            Operational — No Real-Time Gauge Data Required
          </p>
          <ExperimentGrid
            entries={groups.operational}
            selected={selected}
            onSelect={onSelect}
            availableExperiments={availableExperiments}
            accentClass="border-hydra-accent/55 bg-hydra-accent/[0.10]"
            evalData={evalData}
          />
        </div>
      )}
    </div>
  );
}

function ExperimentGrid({
  entries,
  selected,
  onSelect,
  availableExperiments,
  accentClass,
  evalData,
}: {
  entries: [string, { name: string; description: string }][];
  selected: string;
  onSelect: (id: string) => void;
  availableExperiments?: Set<string>;
  accentClass: string;
  evalData?: RigorousEvalData | null;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {entries.map(([id, exp]) => {
        const isAvailable = availableExperiments
          ? availableExperiments.has(id)
          : true;
        const ssRmse = evalData?.cross_site[id]?.median_ss_rmse;
        return (
          <button
            key={id}
            onClick={() => onSelect(id)}
            disabled={!isAvailable}
            aria-pressed={selected === id}
            aria-label={`${exp.name}. ${exp.description}${isAvailable ? '' : ' Results pending.'}`}
            className={`rounded-xl border px-4 py-3 text-left transition-all ${
              selected === id
                ? `${accentClass} text-white shadow-[0_0_0_1px_rgba(43,227,214,0.4)]`
                : isAvailable
                  ? 'border-[#264257] bg-[#0c1a26] text-[#c3d9e8] hover:border-hydra-accent/45 hover:bg-[#112435]'
                  : 'border-[#223646] bg-[#0a151f] text-[#6f8ea3] opacity-75 cursor-not-allowed'
            }`}
            title={exp.description}
          >
            <div className="flex items-center justify-between">
              <div className="font-display text-sm tracking-wide">{exp.name}</div>
              {ssRmse != null && (
                <span className={`font-mono text-xs font-medium ${ssRmse > 0 ? 'text-hydra-corrected' : 'text-hydra-alert'}`}>
                  {ssRmse > 0 ? '+' : ''}{(ssRmse * 100).toFixed(0)}%
                </span>
              )}
            </div>
            <p className="mt-1 text-xs leading-relaxed text-[#8faec3]">
              {exp.description}
            </p>
            {!isAvailable && (
              <div className="mt-2 text-[0.7rem] uppercase tracking-[0.1em] text-[#7d98ac]">
                Pending results
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
