'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { hydraExperience } from '@/lib/hydra-experience-content';

interface HydraActivationGridProps {
  reduceMotion: boolean;
}

export default function HydraActivationGrid({ reduceMotion }: HydraActivationGridProps) {
  const [activeCapability, setActiveCapability] = useState(hydraExperience.hydraSignals[0].name);
  const capability =
    hydraExperience.hydraSignals.find((signal) => signal.name === activeCapability) ??
    hydraExperience.hydraSignals[0];
  const activeLayers = new Set(capability.layers);

  return (
    <div className="grid gap-6 lg:grid-cols-[0.76fr_1.24fr] lg:items-center">
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 24 }}
        whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-10% 0px' }}
        transition={{ duration: 0.55 }}
      >
        <p className="font-display text-xs uppercase tracking-[0.28em] text-hydra-corrected">
          Hydra activates
        </p>
        <h2 className="mt-3 font-display text-4xl text-white md:text-5xl">
          Earlier warning changes the outcome.
        </h2>
        <p className="mt-5 text-base leading-relaxed text-[#bdd4e4]">
          Hydra Experience pauses the flood visual and turns scattered signals into a calm decision
          grid. It is a demonstration of earlier situational awareness, not an official warning
          system.
        </p>
        <p className="mt-5 rounded-lg border border-hydra-corrected/22 bg-hydra-corrected/10 px-4 py-3 text-sm leading-relaxed text-[#dffffb]">
          Hydra sees the pattern before the water arrives: rainfall, gauge rise, terrain, drainage
          stress, road access, and response signals organized into one view.
        </p>
      </motion.div>

      <div className="space-y-4">
        <div className="relative min-h-[360px] overflow-hidden rounded-lg border border-hydra-corrected/24 bg-[#031a24]/88 p-4 shadow-[0_28px_90px_rgba(0,0,0,0.4)]">
          <div className="absolute inset-0 opacity-70 hydra-experience-grid" />
          <svg className="absolute inset-0 h-full w-full" aria-hidden="true">
            {hydraExperience.signalNodes.map((node) => (
              <line
                key={`${activeCapability}-${node.id}`}
                x1="50%"
                y1="50%"
                x2={`${node.x}%`}
                y2={`${node.y}%`}
                stroke={activeLayers.has(node.layer) ? '#2be3d6' : '#2a5162'}
                strokeWidth={activeLayers.has(node.layer) ? '1.6' : '0.7'}
                strokeDasharray={activeLayers.has(node.layer) ? '0' : '4 9'}
                opacity={activeLayers.has(node.layer) ? 0.72 : 0.28}
              />
            ))}
          </svg>
          <div className="absolute left-1/2 top-1/2 flex h-28 w-28 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-hydra-corrected/40 bg-hydra-corrected/12 text-center font-display text-xs uppercase tracking-[0.18em] text-hydra-corrected shadow-[0_0_42px_rgba(43,227,214,0.2)]">
            Hydra grid
          </div>
          {hydraExperience.signalNodes.map((node) => {
            const active = activeLayers.has(node.layer);
            return (
              <div
                key={node.id}
                className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border transition-all ${
                  active
                    ? 'h-6 w-6 border-hydra-corrected bg-hydra-corrected/30 shadow-[0_0_24px_rgba(43,227,214,0.35)]'
                    : 'h-4 w-4 border-white/20 bg-white/8'
                }`}
                style={{ left: `${node.x}%`, top: `${node.y}%` }}
                title={node.label}
              />
            );
          })}
          <div className="absolute bottom-4 left-4 right-4 grid gap-2 sm:grid-cols-4">
            {['0 min', '15 min', '30 min', 'earlier action'].map((label, index) => (
              <div
                key={label}
                className={`rounded-md border px-3 py-2 text-center text-xs uppercase tracking-[0.12em] ${
                  index === 0
                    ? 'border-amber-200/24 bg-amber-200/10 text-amber-100'
                    : 'border-hydra-corrected/26 bg-hydra-corrected/10 text-hydra-corrected'
                }`}
              >
                {label}
              </div>
            ))}
          </div>
          <div className="absolute left-4 top-4 flex flex-wrap gap-2">
            {['open', 'threatened', 'closed'].map((state, index) => (
              <span
                key={state}
                className={`rounded-full border px-3 py-1 text-xs uppercase tracking-[0.14em] ${
                  index === 0
                    ? 'border-hydra-corrected/35 bg-hydra-corrected/12 text-hydra-corrected'
                    : index === 1
                      ? 'border-amber-200/35 bg-amber-200/12 text-amber-100'
                      : 'border-hydra-alert/35 bg-hydra-alert/12 text-red-100'
                }`}
              >
                route {state}
              </span>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {hydraExperience.hydraSignals.map((signal, index) => {
            const active = activeCapability === signal.name;
            return (
              <motion.button
                key={signal.name}
                type="button"
                onMouseEnter={() => setActiveCapability(signal.name)}
                onFocus={() => setActiveCapability(signal.name)}
                onClick={() => setActiveCapability(signal.name)}
                initial={reduceMotion ? false : { opacity: 0, y: 18 }}
                whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-10% 0px' }}
                transition={{ duration: 0.45, delay: index * 0.06 }}
                className={`relative overflow-hidden rounded-lg border p-4 text-left backdrop-blur-md transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hydra-corrected ${
                  active
                    ? 'border-hydra-corrected/55 bg-[#05303b]/92'
                    : 'border-hydra-corrected/22 bg-[#041b26]/84 hover:border-hydra-corrected/42'
                }`}
                aria-pressed={active}
              >
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-hydra-corrected/70 via-hydra-accent/40 to-transparent" />
                <p className="font-display text-sm uppercase tracking-[0.2em] text-hydra-corrected">
                  {signal.name}
                </p>
                <h3 className="mt-2 font-display text-lg text-white">{signal.role}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#a9c2d3]">{signal.detail}</p>
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
