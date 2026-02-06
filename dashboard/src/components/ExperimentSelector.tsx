'use client';

interface ExperimentSelectorProps {
  experiments: Record<string, { name: string; description: string }>;
  selected: string;
  onSelect: (experimentId: string) => void;
  availableExperiments?: Set<string>;
}

export default function ExperimentSelector({
  experiments,
  selected,
  onSelect,
  availableExperiments,
}: ExperimentSelectorProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {Object.entries(experiments).map(([id, exp]) => {
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
                ? 'border-hydra-corrected/55 bg-hydra-corrected/[0.14] text-white shadow-[0_0_0_1px_rgba(43,227,214,0.4)]'
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
