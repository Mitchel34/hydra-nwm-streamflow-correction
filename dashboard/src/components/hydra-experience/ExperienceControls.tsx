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
  const controlBase =
    'group inline-flex items-center gap-2 rounded-full border border-white/14 bg-[#04111c]/72 px-2.5 py-2 text-[0.72rem] font-medium text-[#d8ecf7] shadow-[0_12px_35px_rgba(0,0,0,0.28)] backdrop-blur-md transition-colors hover:border-hydra-corrected/45 hover:text-hydra-corrected focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hydra-corrected sm:px-3 sm:text-xs';

  return (
    <div className="fixed bottom-3 left-3 right-3 z-[70] flex flex-wrap justify-center gap-2 rounded-[1.25rem] border border-white/10 bg-[#020910]/48 p-2 backdrop-blur-xl sm:bottom-4 sm:left-auto sm:right-5 sm:max-w-[calc(100vw-1.5rem)] sm:justify-end sm:rounded-full">
      <Link
        href="/analysis"
        className={controlBase}
        aria-label="Skip experience and open findings"
      >
        <span aria-hidden="true" className="h-2 w-2 rounded-full border border-current" />
        <span className="sm:hidden">Skip</span>
        <span className="hidden sm:inline">Skip Experience</span>
      </Link>
      <button
        type="button"
        onClick={onToggleMotion}
        className={controlBase}
        aria-pressed={reduceMotion}
        aria-label={reduceMotion ? 'Use full motion' : 'Use reduced motion'}
      >
        <span aria-hidden="true" className="h-2 w-3 rounded-full bg-current opacity-70" />
        <span className="sm:hidden">{reduceMotion ? 'Reduced' : 'Motion'}</span>
        <span className="hidden sm:inline">{reduceMotion ? 'Motion: Reduced' : 'Motion: Full'}</span>
      </button>
      <button
        type="button"
        onClick={onToggleAudio}
        className={controlBase}
        aria-pressed={audioEnabled}
        aria-label={audioEnabled ? 'Turn sound off' : 'Turn sound on'}
      >
        <span aria-hidden="true" className={`h-2 w-2 rounded-full ${audioEnabled ? 'bg-hydra-corrected' : 'bg-white/35'}`} />
        <span className="sm:hidden">{audioEnabled ? 'Sound on' : 'Sound'}</span>
        <span className="hidden sm:inline">{audioEnabled ? 'Sound: On' : 'Sound: Off'}</span>
      </button>
      <Link
        href="/analysis"
        className={controlBase}
        aria-label="Exit experience and open findings"
      >
        <span aria-hidden="true" className="h-2 w-2 rotate-45 border-r border-t border-current" />
        Exit
      </Link>
    </div>
  );
}
