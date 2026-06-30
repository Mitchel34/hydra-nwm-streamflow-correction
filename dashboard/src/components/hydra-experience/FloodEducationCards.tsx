'use client';

import { motion } from 'framer-motion';
import { hydraExperience, safetySources, WarningStageKey } from '@/lib/hydra-experience-content';

interface FloodEducationCardsProps {
  reduceMotion: boolean;
  activeStage: WarningStageKey;
  onStageChange: (stage: WarningStageKey) => void;
  rainIntensity: number;
  waterline: number;
}

export default function FloodEducationCards({
  reduceMotion,
  activeStage,
  onStageChange,
  rainIntensity,
  waterline,
}: FloodEducationCardsProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {hydraExperience.educationCards.map((card, index) => {
        const source = safetySources[card.source];
        const active = activeStage === card.stage;
        const stage = hydraExperience.warningStages[card.stage];
        const waterHeight = 18 + index * 19 + (active ? waterline * 12 : 0);
        const rainOpacity = 0.18 + index * 0.22 + (active ? rainIntensity * 0.18 : 0);
        const label = index === 0 ? 'possible' : index === 1 ? 'expected' : 'act now';
        return (
          <motion.article
            key={card.eyebrow}
            initial={reduceMotion ? false : { opacity: 0, y: 28 }}
            whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-12% 0px' }}
            transition={{ duration: 0.55, delay: index * 0.1 }}
            onMouseEnter={() => onStageChange(card.stage)}
            onFocus={() => onStageChange(card.stage)}
            className={`relative min-h-[330px] overflow-hidden rounded-lg border p-5 shadow-[0_22px_70px_rgba(0,0,0,0.35)] backdrop-blur-md transition-all ${
              active
                ? 'border-amber-200/48 bg-[#12202a]/90 shadow-[0_24px_90px_rgba(242,180,106,0.18)]'
                : 'border-cyan-200/20 bg-[#071420]/82'
            }`}
          >
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-300/70 via-cyan-300/80 to-transparent" />
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-[repeating-linear-gradient(102deg,transparent_0_16px,rgba(210,238,255,0.16)_16px_17px,transparent_17px_38px)] hydra-card-rain"
              style={{ opacity: rainOpacity }}
            />
            <div
              aria-hidden="true"
              className="absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,rgba(60,168,197,0.16),rgba(10,53,69,0.78))] hydra-education-water"
              style={{ height: `${waterHeight}%` }}
            />
            {index === 2 && (
              <div
                aria-hidden="true"
                className="absolute right-4 top-4 h-14 w-14 rounded-full border border-hydra-alert/45 hydra-warning-pulse"
              />
            )}
            <div className="relative z-10 flex h-full min-h-[292px] flex-col">
              <p className="font-display text-xs uppercase tracking-[0.22em] text-amber-200">
                {card.eyebrow}
              </p>
              <h3 className="mt-3 font-display text-xl text-white">{card.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-[#bdd4e4]">{card.body}</p>
              <button
                type="button"
                aria-pressed={active}
                onClick={() => onStageChange(card.stage)}
                className={`mt-5 rounded-md border px-3 py-2 text-left text-xs uppercase tracking-[0.16em] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200 ${
                  active
                    ? 'border-amber-200/55 bg-amber-200/14 text-amber-100'
                    : 'border-white/12 bg-white/5 text-[#a9c2d3] hover:border-amber-200/34'
                }`}
              >
                Scene state: {stage.sceneLabel}
              </button>
              <div className="mt-auto pt-6">
                <div className="mb-3 flex items-center justify-between gap-3 text-[0.65rem] uppercase tracking-[0.18em] text-[#8fb4cc]">
                  <span>Storm stage</span>
                  <span>{label}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/12">
                  <div
                    className={`h-full rounded-full ${
                      index === 2
                        ? 'bg-gradient-to-r from-amber-300 to-hydra-alert'
                        : 'bg-gradient-to-r from-hydra-corrected to-amber-300'
                    }`}
                    style={{ width: `${40 + index * 28}%` }}
                  />
                </div>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex text-xs font-medium text-hydra-corrected hover:underline"
                >
                  Source: {source.label}
                </a>
              </div>
            </div>
          </motion.article>
        );
      })}
    </div>
  );
}
