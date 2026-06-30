'use client';

import { motion } from 'framer-motion';
import { hydraExperience, safetySources } from '@/lib/hydra-experience-content';

interface FloodEducationCardsProps {
  reduceMotion: boolean;
}

export default function FloodEducationCards({ reduceMotion }: FloodEducationCardsProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {hydraExperience.educationCards.map((card, index) => {
        const source = safetySources[card.source];
        return (
          <motion.article
            key={card.eyebrow}
            initial={reduceMotion ? false : { opacity: 0, y: 28 }}
            whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-12% 0px' }}
            transition={{ duration: 0.55, delay: index * 0.1 }}
            className="relative overflow-hidden rounded-lg border border-cyan-200/20 bg-[#071420]/82 p-5 shadow-[0_22px_70px_rgba(0,0,0,0.35)] backdrop-blur-md"
          >
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-300/70 via-cyan-300/80 to-transparent" />
            <p className="font-display text-xs uppercase tracking-[0.22em] text-amber-200">
              {card.eyebrow}
            </p>
            <h3 className="mt-3 font-display text-xl text-white">{card.title}</h3>
            <p className="mt-3 text-sm leading-relaxed text-[#bdd4e4]">{card.body}</p>
            <a
              href={source.url}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex text-xs font-medium text-hydra-corrected hover:underline"
            >
              Source: {source.label}
            </a>
          </motion.article>
        );
      })}
    </div>
  );
}
