'use client';

import { motion } from 'framer-motion';
import { hydraExperience } from '@/lib/hydra-experience-content';

interface HydraActivationGridProps {
  reduceMotion: boolean;
}

export default function HydraActivationGrid({ reduceMotion }: HydraActivationGridProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
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
      </motion.div>

      <div className="grid gap-3 sm:grid-cols-2">
        {hydraExperience.hydraSignals.map((signal, index) => (
          <motion.article
            key={signal.name}
            initial={reduceMotion ? false : { opacity: 0, y: 18 }}
            whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-10% 0px' }}
            transition={{ duration: 0.45, delay: index * 0.06 }}
            className="relative overflow-hidden rounded-lg border border-hydra-corrected/25 bg-[#041b26]/84 p-4 backdrop-blur-md"
          >
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-hydra-corrected/70 via-hydra-accent/40 to-transparent" />
            <p className="font-display text-sm uppercase tracking-[0.2em] text-hydra-corrected">
              {signal.name}
            </p>
            <h3 className="mt-2 font-display text-lg text-white">{signal.role}</h3>
            <p className="mt-2 text-sm leading-relaxed text-[#a9c2d3]">{signal.detail}</p>
          </motion.article>
        ))}
      </div>
    </div>
  );
}
