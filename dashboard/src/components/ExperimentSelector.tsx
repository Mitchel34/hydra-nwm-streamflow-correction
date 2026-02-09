'use client';

import { useMemo } from 'react';

interface ExperimentSelectorProps {
  experiments: Record<string, { name: string; description: string }>;
  selected: string;
  onSelect: (experimentId: string) => void;
  availableExperiments?: Set<string>;
  versionFilter?: 'all' | 'v2' | 'v3';
  onVersionFilterChange?: (filter: 'all' | 'v2' | 'v3') => void;
}

export default function ExperimentSelector({
  experiments,
  selected,
  onSelect,
  availableExperiments,
  versionFilter = 'all',
  onVersionFilterChange,
}: ExperimentSelectorProps) {
  const { v3Experiments, v2Experiments } = useMemo(() => {
    const v3: [string, { name: string; description: string }][] = [];
    const v2: [string, { name: string; description: string }][] = [];
    for (const [id, exp] of Object.entries(experiments)) {
      if (id.startsWith('v3_')) {
        v3.push([id, exp]);
      } else {
        v2.push([id, exp]);
      }
    }
    return { v3Experiments: v3, v2Experiments: v2 };
  }, [experiments]);

  const showV3 = versionFilter === 'all' || versionFilter === 'v3';
  const showV2 = versionFilter === 'all' || versionFilter === 'v2';

  return (
    <div className="space-y-4">
      {/* Version filter tabs */}
      {onVersionFilterChange && (
        <div className="flex gap-2">
          {(['all', 'v3', 'v2'] as const).map((f) => (
            <button
              key={f}
              onClick={() => onVersionFilterChange(f)}
              className={`rounded-full px-3 py-1 text-xs font-display uppercase tracking-[0.1em] transition-all ${
                versionFilter === f
                  ? 'bg-hydra-corrected/20 text-hydra-corrected border border-hydra-corrected/40'
                  : 'bg-[#0c1a26] text-[#7f9db2] border border-[#264257] hover:border-[#3b5f79]'
              }`}
            >
              {f === 'all' ? 'All' : f === 'v3' ? 'Hydra v3' : 'Hydra v2'}
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
