'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { hydraExperience, safetySources } from '@/lib/hydra-experience-content';

interface FloodRoadChoiceProps {
  reduceMotion: boolean;
}

type Choice = 'drive' | 'turn' | null;

export default function FloodRoadChoice({ reduceMotion }: FloodRoadChoiceProps) {
  const [choice, setChoice] = useState<Choice>(null);
  const source = safetySources[hydraExperience.roadChoice.source];
  const result =
    choice === 'drive'
      ? hydraExperience.roadChoice.unsafeResult
      : choice === 'turn'
        ? hydraExperience.roadChoice.safeResult
        : null;

  return (
    <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, x: -24 }}
        whileInView={reduceMotion ? undefined : { opacity: 1, x: 0 }}
        viewport={{ once: true, margin: '-10% 0px' }}
        transition={{ duration: 0.55 }}
        className="rounded-lg border border-cyan-200/20 bg-[#06131f]/84 p-6 backdrop-blur-md"
      >
        <p className="font-display text-xs uppercase tracking-[0.24em] text-amber-200">
          Decision point
        </p>
        <h2 className="mt-3 font-display text-3xl text-white">
          {hydraExperience.roadChoice.title}
        </h2>
        <p className="mt-4 text-base leading-relaxed text-[#bdd4e4]">
          {hydraExperience.roadChoice.body}
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => setChoice('drive')}
            className="rounded-full border border-amber-300/45 bg-amber-300/10 px-5 py-3 text-sm font-medium text-amber-100 transition-colors hover:bg-amber-300/18"
          >
            Drive through
          </button>
          <button
            type="button"
            onClick={() => setChoice('turn')}
            className="rounded-full border border-hydra-corrected/45 bg-hydra-corrected/12 px-5 py-3 text-sm font-medium text-hydra-corrected transition-colors hover:bg-hydra-corrected/20"
          >
            Turn around
          </button>
        </div>
        {result && (
          <div
            role="status"
            className={`mt-5 rounded-lg border px-4 py-3 text-sm leading-relaxed ${
              choice === 'drive'
                ? 'border-amber-300/35 bg-amber-300/10 text-amber-50'
                : 'border-hydra-corrected/35 bg-hydra-corrected/10 text-[#d7fffb]'
            }`}
          >
            {result}
          </div>
        )}
        <a
          href={source.url}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex text-xs font-medium text-hydra-corrected hover:underline"
        >
          Source: {source.label}
        </a>
      </motion.div>

      <motion.div
        initial={reduceMotion ? false : { opacity: 0, x: 24 }}
        whileInView={reduceMotion ? undefined : { opacity: 1, x: 0 }}
        viewport={{ once: true, margin: '-10% 0px' }}
        transition={{ duration: 0.55, delay: 0.08 }}
        className="relative min-h-[360px] overflow-hidden rounded-lg border border-cyan-200/20 bg-[#06131f] shadow-[0_28px_90px_rgba(0,0,0,0.45)]"
      >
        <div className="absolute inset-0 bg-[linear-gradient(100deg,rgba(242,180,106,0.14),transparent_24%),linear-gradient(260deg,rgba(242,180,106,0.12),transparent_26%),linear-gradient(180deg,#091a27,#041019_58%,#02080d)]" />
        <div className="absolute left-1/2 top-[18%] h-[110%] w-[45%] -translate-x-1/2 rotate-[1.5deg] bg-[#111923] shadow-[0_0_80px_rgba(0,0,0,0.8)]" />
        <div className="absolute left-1/2 top-[17%] h-[110%] w-[2px] -translate-x-1/2 bg-[repeating-linear-gradient(180deg,#f2b46a_0_28px,transparent_28px_52px)] opacity-70" />
        <div className="absolute inset-x-0 bottom-0 h-[48%] bg-[linear-gradient(180deg,rgba(30,85,105,0.2),rgba(34,87,100,0.9)_32%,rgba(6,24,34,0.98))] hydra-road-water" />
        <div className="absolute bottom-[41%] left-1/2 h-12 w-[92%] -translate-x-1/2 bg-cyan-100/16 blur-xl" />
        <div className="absolute left-[16%] top-[24%] h-7 w-24 rotate-[-8deg] bg-amber-200/22 blur-lg" />
        <div className="absolute right-[16%] top-[24%] h-7 w-24 rotate-[8deg] bg-amber-200/22 blur-lg" />
        <div className="absolute bottom-5 left-5 right-5 rounded-lg border border-white/12 bg-black/30 px-4 py-3 text-xs text-[#c8ddea] backdrop-blur">
          Floodwater hides road depth, debris, and washouts. The safe educational answer is to turn around.
        </div>
      </motion.div>
    </div>
  );
}
