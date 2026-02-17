'use client';

import { useMemo } from 'react';
import { getExperimentCategory, RigorousEvalData } from '@/lib/types';

type VersionFilter = 'all' | 'v3' | 'v2' | 'era5_only' | 'usgs';

interface ExperimentSelectorProps {
  experiments: Record<string, { name: string; description: string }>;
  selected: string;
  onSelect: (experimentId: string) => void;
  availableExperiments?: Set<string>;
  versionFilter?: VersionFilter;
  onVersionFilterChange?: (filter: VersionFilter) => void;
  evalData?: RigorousEvalData | null;
}

const USGS_EXPERIMENTS = new Set(['usgs_nwm_era5_v3', 'usgs_era5_v3', 'usgs_only_v3', 'usgs_only_simple']);

function getExtendedCategory(id: string): 'v3' | 'v2' | 'era5_only' | 'usgs' {
  if (USGS_EXPERIMENTS.has(id)) return 'usgs';
  return getExperimentCategory(id);
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
    const v3: [string, { name: string; description: string }][] = [];
    const v2: [string, { name: string; description: string }][] = [];
    const era5: [string, { name: string; description: string }][] = [];
    const usgs: [string, { name: string; description: string }][] = [];
    for (const [id, exp] of Object.entries(experiments)) {
      const category = getExtendedCategory(id);
      if (category === 'usgs') usgs.push([id, exp]);
      else if (category === 'era5_only') era5.push([id, exp]);
      else if (category === 'v3') v3.push([id, exp]);
      else v2.push([id, exp]);
    }
    return { v3, v2, era5, usgs };
  }, [experiments]);

  const showV3 = versionFilter === 'all' || versionFilter === 'v3';
  const showV2 = versionFilter === 'all' || versionFilter === 'v2';
  const showEra5 = versionFilter === 'all' || versionFilter === 'era5_only';
  const showUsgs = versionFilter === 'all' || versionFilter === 'usgs';

  const filterTabs: { id: VersionFilter; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: Object.keys(experiments).length },
    { id: 'v3', label: 'Hydra v3', count: groups.v3.length },
    { id: 'usgs', label: 'USGS Input', count: groups.usgs.length },
    { id: 'v2', label: 'Hydra v2', count: groups.v2.length },
    { id: 'era5_only', label: 'ERA5-Only', count: groups.era5.length },
  ];

  return (
    <div className="space-y-4">
      {/* Version filter tabs */}
      {onVersionFilterChange && (
        <div className="flex gap-2 flex-wrap">
          {filterTabs.filter((t) => t.count > 0 || t.id === 'all').map((tab) => (
            <button
              key={tab.id}
              onClick={() => onVersionFilterChange(tab.id)}
              className={`rounded-full px-3 py-1 text-xs font-display uppercase tracking-[0.1em] transition-all ${
                versionFilter === tab.id
                  ? tab.id === 'era5_only'
                    ? 'bg-hydra-era5/20 text-hydra-era5 border border-hydra-era5/40'
                    : 'bg-hydra-corrected/20 text-hydra-corrected border border-hydra-corrected/40'
                  : 'bg-[#0c1a26] text-[#7f9db2] border border-[#264257] hover:border-[#3b5f79]'
              }`}
            >
              {tab.label}
              <span className="ml-1 opacity-60">{tab.count}</span>
            </button>
          ))}
        </div>
      )}

      {/* USGS Input experiments */}
      {showUsgs && groups.usgs.length > 0 && (
        <div>
          <p className="text-[0.68rem] uppercase tracking-[0.18em] text-hydra-corrected/70 mb-2 font-display">
            USGS Input — Observed Discharge Features
          </p>
          <ExperimentGrid
            entries={groups.usgs}
            selected={selected}
            onSelect={onSelect}
            availableExperiments={availableExperiments}
            accentClass="border-hydra-corrected/55 bg-hydra-corrected/[0.14]"
            evalData={evalData}
          />
        </div>
      )}

      {/* v3 experiments */}
      {showV3 && groups.v3.length > 0 && (
        <div>
          <p className="text-[0.68rem] uppercase tracking-[0.18em] text-hydra-corrected/70 mb-2 font-display">
            Hydra v3 — New Architecture
          </p>
          <ExperimentGrid
            entries={groups.v3}
            selected={selected}
            onSelect={onSelect}
            availableExperiments={availableExperiments}
            accentClass="border-hydra-corrected/55 bg-hydra-corrected/[0.14]"
            evalData={evalData}
          />
        </div>
      )}

      {/* ERA5-only experiments */}
      {showEra5 && groups.era5.length > 0 && (
        <div>
          <p className="text-[0.68rem] uppercase tracking-[0.18em] text-hydra-era5/70 mb-2 font-display">
            ERA5-Only — No NWM Input
          </p>
          <ExperimentGrid
            entries={groups.era5}
            selected={selected}
            onSelect={onSelect}
            availableExperiments={availableExperiments}
            accentClass="border-hydra-era5/55 bg-hydra-era5/[0.10]"
            evalData={evalData}
          />
        </div>
      )}

      {/* v2 experiments */}
      {showV2 && groups.v2.length > 0 && (
        <div>
          <p className="text-[0.68rem] uppercase tracking-[0.18em] text-hydra-accent/60 mb-2 font-display">
            Hydra v2 — Baseline Experiments
          </p>
          <ExperimentGrid
            entries={groups.v2}
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
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
