'use client';

interface ExperimentSelectorProps {
  experiments: Record<string, { name: string; description: string }>;
  selected: string;
  onSelect: (experimentId: string) => void;
}

export default function ExperimentSelector({
  experiments,
  selected,
  onSelect,
}: ExperimentSelectorProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {Object.entries(experiments).map(([id, exp]) => (
        <button
          key={id}
          onClick={() => onSelect(id)}
          className={`px-4 py-2 rounded-lg transition-all ${
            selected === id
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          }`}
          title={exp.description}
        >
          {exp.name}
        </button>
      ))}
    </div>
  );
}
