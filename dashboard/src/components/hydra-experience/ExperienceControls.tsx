'use client';

import Link from 'next/link';

interface ExperienceControlsProps {
  reduceMotion: boolean;
  audioEnabled: boolean;
  onToggleMotion: () => void;
  onToggleAudio: () => void;
}

export default function ExperienceControls({
  reduceMotion,
  audioEnabled,
  onToggleMotion,
  onToggleAudio,
}: ExperienceControlsProps) {
  return (
    <div className="fixed right-3 top-20 z-[70] flex max-w-[calc(100vw-1.5rem)] flex-wrap justify-end gap-2 sm:right-5">
      <Link
        href="/analysis"
        className="rounded-full border border-white/18 bg-[#06131f]/88 px-3 py-2 text-xs font-medium text-[#d8ecf7] shadow-[0_12px_35px_rgba(0,0,0,0.35)] backdrop-blur-md transition-colors hover:border-hydra-corrected/45 hover:text-hydra-corrected"
      >
        Skip Experience
      </Link>
      <button
        type="button"
        onClick={onToggleMotion}
        className="rounded-full border border-white/18 bg-[#06131f]/88 px-3 py-2 text-xs font-medium text-[#d8ecf7] shadow-[0_12px_35px_rgba(0,0,0,0.35)] backdrop-blur-md transition-colors hover:border-hydra-corrected/45 hover:text-hydra-corrected"
        aria-pressed={reduceMotion}
      >
        {reduceMotion ? 'Motion: Reduced' : 'Motion: Full'}
      </button>
      <button
        type="button"
        onClick={onToggleAudio}
        className="rounded-full border border-white/18 bg-[#06131f]/88 px-3 py-2 text-xs font-medium text-[#d8ecf7] shadow-[0_12px_35px_rgba(0,0,0,0.35)] backdrop-blur-md transition-colors hover:border-hydra-corrected/45 hover:text-hydra-corrected"
        aria-pressed={audioEnabled}
      >
        {audioEnabled ? 'Sound: On' : 'Sound: Off'}
      </button>
      <Link
        href="/analysis"
        className="rounded-full border border-white/18 bg-[#06131f]/88 px-3 py-2 text-xs font-medium text-[#d8ecf7] shadow-[0_12px_35px_rgba(0,0,0,0.35)] backdrop-blur-md transition-colors hover:border-hydra-corrected/45 hover:text-hydra-corrected"
      >
        Exit
      </Link>
    </div>
  );
}
