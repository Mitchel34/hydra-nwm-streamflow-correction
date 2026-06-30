'use client';

import { useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import { motion } from 'framer-motion';
import { hydraExperience, safetySources } from '@/lib/hydra-experience-content';

interface FloodRoadChoiceProps {
  reduceMotion: boolean;
}

type Choice = 'drive' | 'turn' | null;

interface RoadRipple {
  id: number;
  x: number;
  y: number;
}

export default function FloodRoadChoice({ reduceMotion }: FloodRoadChoiceProps) {
  const [choice, setChoice] = useState<Choice>(null);
  const [roadRipples, setRoadRipples] = useState<RoadRipple[]>([]);
  const rippleId = useRef(0);
  const lastRippleAt = useRef(0);
  const source = safetySources[hydraExperience.roadChoice.source];
  const result =
    choice === 'drive'
      ? hydraExperience.roadChoice.unsafeResult
      : choice === 'turn'
        ? hydraExperience.roadChoice.safeResult
        : null;

  const handleRoadPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (reduceMotion) return;
    const now = window.performance.now();
    if (now - lastRippleAt.current < 180) return;
    lastRippleAt.current = now;
    rippleId.current += 1;
    const rect = event.currentTarget.getBoundingClientRect();
    const ripple = {
      id: rippleId.current,
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
    setRoadRipples((current) => [...current.slice(-6), ripple]);
    window.setTimeout(() => {
      setRoadRipples((current) => current.filter((item) => item.id !== ripple.id));
    }, 1300);
  };

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
            aria-pressed={choice === 'drive'}
            className="rounded-full border border-amber-300/45 bg-amber-300/10 px-5 py-3 text-sm font-medium text-amber-100 transition-colors hover:bg-amber-300/18 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200"
          >
            Drive through
          </button>
          <button
            type="button"
            onClick={() => setChoice('turn')}
            aria-pressed={choice === 'turn'}
            className="rounded-full border border-hydra-corrected/45 bg-hydra-corrected/12 px-5 py-3 text-sm font-medium text-hydra-corrected transition-colors hover:bg-hydra-corrected/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hydra-corrected"
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
        onPointerMove={handleRoadPointerMove}
        className="relative min-h-[420px] overflow-hidden rounded-lg border border-cyan-200/20 bg-[#06131f] shadow-[0_28px_90px_rgba(0,0,0,0.45)]"
      >
        <div className="absolute inset-0 bg-[linear-gradient(100deg,rgba(242,180,106,0.14),transparent_24%),linear-gradient(260deg,rgba(242,180,106,0.12),transparent_26%),linear-gradient(180deg,#091a27,#041019_58%,#02080d)]" />
        <div className="absolute left-1/2 top-[13%] h-[118%] w-[48%] -translate-x-1/2 rotate-[1.5deg] bg-[#111923] shadow-[0_0_80px_rgba(0,0,0,0.8)]" />
        <div className="absolute left-1/2 top-[12%] h-[118%] w-[2px] -translate-x-1/2 bg-[repeating-linear-gradient(180deg,#f2b46a_0_28px,transparent_28px_52px)] opacity-70 hydra-disappearing-road-line" />
        <div className="absolute inset-x-0 bottom-0 h-[57%] bg-[linear-gradient(180deg,rgba(30,85,105,0.2),rgba(34,87,100,0.9)_28%,rgba(6,24,34,0.98))] hydra-road-water" />
        <div className="absolute bottom-[49%] left-1/2 h-12 w-[92%] -translate-x-1/2 bg-cyan-100/16 blur-xl" />
        <div className="absolute left-[16%] top-[24%] h-7 w-24 rotate-[-8deg] bg-amber-200/22 blur-lg" />
        <div className="absolute right-[16%] top-[24%] h-7 w-24 rotate-[8deg] bg-amber-200/22 blur-lg" />
        <div className="absolute left-6 top-6 rounded-md border border-white/12 bg-black/28 px-3 py-2 text-xs uppercase tracking-[0.16em] text-[#bdd4e4] backdrop-blur">
          depth unknown
        </div>
        <div
          className={`absolute right-6 top-6 rounded-md border px-3 py-2 text-xs uppercase tracking-[0.16em] backdrop-blur ${
            choice === 'turn'
              ? 'border-hydra-corrected/35 bg-hydra-corrected/12 text-hydra-corrected'
              : 'border-amber-200/30 bg-amber-200/10 text-amber-100'
          }`}
        >
          {choice === 'turn' ? 'route preserved' : 'turn around'}
        </div>
        {roadRipples.map((ripple) => (
          <span
            key={ripple.id}
            className="absolute h-24 w-24 rounded-full border border-cyan-100/36 hydra-pointer-ripple"
            style={{
              left: ripple.x,
              top: ripple.y,
              marginLeft: -48,
              marginTop: -48,
            }}
          />
        ))}
        <div className="absolute bottom-5 left-5 right-5 rounded-lg border border-white/12 bg-black/30 px-4 py-3 text-xs text-[#c8ddea] backdrop-blur">
          {choice === 'turn'
            ? hydraExperience.roadChoice.safeResult
            : 'Floodwater hides road depth, debris, and washouts. The safe educational answer is to turn around.'}
        </div>
      </motion.div>
    </div>
  );
}
