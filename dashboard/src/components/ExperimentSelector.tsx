'use client';

import { useMemo } from 'react';
import { RigorousEvalData } from '@/lib/types';
import { getPublicExperimentDescription, getPublicExperimentName } from '@/lib/labels';

const HIDDEN_EXPERIMENTS = new Set([
  'gru_transformer_v2_nwm_era5_tuned',
  'gru_transformer_v2_direct',
  'hydra_v3_full_autonorm',
]);

interface ExperimentSelectorProps {
  experiments: Record<string, { name: string; description: string }>;
  selected: string;
  onSelect: (experimentId: string) => void;
  availableExperiments?: Set<string>;
  evalData?: RigorousEvalData | null;
}

export default function ExperimentSelector({
  experiments,
  selected,
  onSelect,
  availableExperiments,
  evalData,
}: ExperimentSelectorProps) {
  const visibleExperiments = useMemo(() => {
    return Object.entries(experiments).filter(([id]) => !HIDDEN_EXPERIMENTS.has(id));
  }, [experiments]);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-hydra-accent/80 mb-2 font-display">
          Available Experiments
        </p>
        <ExperimentGrid
          entries={visibleExperiments}
          selected={selected}
          onSelect={onSelect}
          availableExperiments={availableExperiments}
          evalData={evalData}
        />
      </div>
    </div>
  );
}

function ExperimentGrid({
  entries,
  selected,
  onSelect,
  availableExperiments,
  evalData,
}: {
  entries: [string, { name: string; description: string }][];
  selected: string;
  onSelect: (id: string) => void;
  availableExperiments?: Set<string>;
  evalData?: RigorousEvalData | null;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {entries.map(([id, exp]) => {
        const isAvailable = availableExperiments
          ? availableExperiments.has(id)
          : true;
        const ssRmse = evalData?.cross_site[id]?.median_ss_rmse;
        const name = getPublicExperimentName(id, exp.name);
        const description = getPublicExperimentDescription(id, exp.description);
        return (
          <button
            key={id}
            onClick={() => onSelect(id)}
            disabled={!isAvailable}
            aria-pressed={selected === id}
            aria-label={`${name}. ${description}${isAvailable ? '' : ' Results pending.'}`}
            className={`rounded-xl border px-4 py-3 text-left transition-all ${
              selected === id
                ? 'border-hydra-accent/55 bg-hydra-accent/[0.10] text-white shadow-[0_0_0_1px_rgba(43,227,214,0.4)]'
                : isAvailable
                  ? 'border-[#264257] bg-[#0c1a26] text-[#c3d9e8] hover:border-hydra-accent/45 hover:bg-[#112435]'
                  : 'border-[#223646] bg-[#0a151f] text-[#6f8ea3] opacity-75 cursor-not-allowed'
            }`}
            title={description}
          >
            <div className="flex items-center justify-between">
              <div className="font-display text-sm tracking-wide">{name}</div>
              {ssRmse != null && (
                <span className={`font-mono text-xs font-medium ${ssRmse > 0 ? 'text-hydra-corrected' : 'text-hydra-alert'}`}>
                  {ssRmse > 0 ? '+' : ''}{(ssRmse * 100).toFixed(0)}%
                </span>
              )}
            </div>
            <p className="mt-1 text-xs leading-relaxed text-[#8faec3]">
              {description}
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
