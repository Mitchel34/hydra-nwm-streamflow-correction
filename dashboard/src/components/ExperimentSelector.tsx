'use client';

import { useMemo } from 'react';
import { getExperimentCategory } from '@/lib/types';

type VersionFilter = 'all' | 'v2' | 'v3' | 'era5_only';

interface ExperimentSelectorProps {
  experiments: Record<string, { name: string; description: string }>;
  selected: string;
  onSelect: (experimentId: string) => void;
  availableExperiments?: Set<string>;
  versionFilter?: VersionFilter;
  onVersionFilterChange?: (filter: VersionFilter) => void;
}

export default function ExperimentSelector({
  experiments,
  selected,
  onSelect,
  availableExperiments,
  versionFilter = 'all',
  onVersionFilterChange,
}: ExperimentSelectorProps) {
  const { v3Experiments, v2Experiments, era5Experiments } = useMemo(() => {
    const v3: [string, { name: string; description: string }][] = [];
    const v2: [string, { name: string; description: string }][] = [];
    const era5: [string, { name: string; description: string }][] = [];
    for (const [id, exp] of Object.entries(experiments)) {
      const category = getExperimentCategory(id);
      if (category === 'era5_only') era5.push([id, exp]);
      else if (category === 'v3') v3.push([id, exp]);
      else v2.push([id, exp]);
    }
    return { v3Experiments: v3, v2Experiments: v2, era5Experiments: era5 };
  }, [experiments]);

  const showV3 = versionFilter === 'all' || versionFilter === 'v3';
  const showV2 = versionFilter === 'all' || versionFilter === 'v2';
  const showEra5 = versionFilter === 'all' || versionFilter === 'era5_only';

  const filterTabs: { id: VersionFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'v3', label: 'Hydra v3' },
    { id: 'v2', label: 'Hydra v2' },
    { id: 'era5_only', label: 'ERA5-Only' },
  ];

  return (
    <div className="space-y-4">
      {/* Version filter tabs */}
      {onVersionFilterChange && (
        <div className="flex gap-2 flex-wrap">
          {filterTabs.map((tab) => (
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
            </button>
          ))}
        </div>
      )}

      {/* v3 experiments */}
      {showV3 && v3Experiments.length > 0 && (
        <div>
          <p className="text-[0.68rem] uppercase tracking-[0.18em] text-hydra-corrected/70 mb-2 font-display">
            Hydra v3 — New Architecture
          </p>
          <ExperimentGrid
            entries={v3Experiments}
            selected={selected}
            onSelect={onSelect}
            availableExperiments={availableExperiments}
            accentClass="border-hydra-corrected/55 bg-hydra-corrected/[0.14]"
          />
        </div>
      )}

      {/* ERA5-only experiments */}
      {showEra5 && era5Experiments.length > 0 && (
        <div>
          <p className="text-[0.68rem] uppercase tracking-[0.18em] text-hydra-era5/70 mb-2 font-display">
            ERA5-Only — No NWM Input
          </p>
          <ExperimentGrid
            entries={era5Experiments}
            selected={selected}
            onSelect={onSelect}
            availableExperiments={availableExperiments}
            accentClass="border-hydra-era5/55 bg-hydra-era5/[0.10]"
          />
        </div>
      )}

      {/* v2 experiments */}
      {showV2 && v2Experiments.length > 0 && (
        <div>
          <p className="text-[0.68rem] uppercase tracking-[0.18em] text-hydra-accent/60 mb-2 font-display">
            Hydra v2 — Baseline Experiments
          </p>
          <ExperimentGrid
            entries={v2Experiments}
            selected={selected}
            onSelect={onSelect}
            availableExperiments={availableExperiments}
            accentClass="border-hydra-accent/55 bg-hydra-accent/[0.10]"
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
}: {
  entries: [string, { name: string; description: string }][];
  selected: string;
  onSelect: (id: string) => void;
  availableExperiments?: Set<string>;
  accentClass: string;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {entries.map(([id, exp]) => {
        const isAvailable = availableExperiments
          ? availableExperiments.has(id)
          : true;
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
            <div className="font-display text-sm tracking-wide">{exp.name}</div>
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
