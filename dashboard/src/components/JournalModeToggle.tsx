'use client';

interface JournalModeToggleProps {
  enabled: boolean;
  onToggle: () => void;
}

export default function JournalModeToggle({ enabled, onToggle }: JournalModeToggleProps) {
  return (
    <button
      onClick={onToggle}
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
        enabled
          ? 'bg-hydra-corrected/20 text-hydra-corrected border border-hydra-corrected/30'
          : 'bg-[#122334] text-[#8fb4cc] border border-[#2a445b] hover:border-[#3b5f79]'
      }`}
      aria-pressed={enabled}
      title="Toggle extended statistical metrics (CIs, significance tests, regime analysis)"
    >
      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
        />
      </svg>
      Journal Mode
    </button>
  );
}
