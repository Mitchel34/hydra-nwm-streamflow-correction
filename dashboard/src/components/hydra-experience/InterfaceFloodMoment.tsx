'use client';

import { motion } from 'framer-motion';
import { safetySources } from '@/lib/hydra-experience-content';
import { usePointerRipples } from './usePointerRipples';

interface InterfaceFloodMomentProps {
  progress: number;
  reduceMotion: boolean;
}

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function smoothstep(edge0: number, edge1: number, value: number) {
  const t = clamp((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

export default function InterfaceFloodMoment({ progress, reduceMotion }: InterfaceFloodMomentProps) {
  const ripples = usePointerRipples(reduceMotion, 220);
  const danger = reduceMotion ? 0.58 : smoothstep(0.38, 0.64, progress);
  const activation = reduceMotion ? 0 : smoothstep(0.66, 0.84, progress);
  const waterHeight = clamp(20 + danger * 55 - activation * 28, 18, 76);

  return (
    <div className="grid gap-6 lg:grid-cols-[0.86fr_1.14fr] lg:items-center">
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 24 }}
        whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-10% 0px' }}
        transition={{ duration: 0.55 }}
        className="relative overflow-hidden rounded-lg border border-amber-300/22 bg-[#130f12]/80 p-6 backdrop-blur-md"
      >
        <p className="font-display text-xs uppercase tracking-[0.28em] text-amber-200">
          The warning gap
        </p>
        <h2 className="mt-3 font-display text-4xl text-white">
          The interface floods before the decision feels obvious.
        </h2>
        <p className="mt-5 text-base leading-relaxed text-[#bdd4e4]">
          In the demo, water rises over the screen to show how fast useful context can be lost.
          Real protective action should follow official local instructions and happen before routes
          are cut off.
        </p>
        <p className="mt-5 rounded-md border border-amber-200/22 bg-amber-200/10 px-4 py-3 text-sm leading-relaxed text-amber-50">
          The visual flood is a teaching device. It is not a live hazard display.
        </p>
        <a
          href={safetySources.readyFloods.url}
          target="_blank"
          rel="noreferrer"
          className="mt-5 inline-flex text-sm font-medium text-hydra-corrected hover:underline"
        >
          Source: {safetySources.readyFloods.label}
        </a>
      </motion.div>

      <div className="relative min-h-[520px] overflow-hidden rounded-lg border border-cyan-200/18 bg-[#06131f]/88 p-5 shadow-[0_28px_90px_rgba(0,0,0,0.42)] backdrop-blur-md">
        <div className="absolute inset-0 opacity-50 hydra-experience-grid" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,16,24,0.1),rgba(3,10,16,0.35)_54%,rgba(3,10,16,0.82))]" />
        <div className="relative grid gap-4 sm:grid-cols-2">
          {['Rainfall rate', 'Gauge rise', 'Drainage stress', 'Road access'].map((label, index) => (
            <motion.div
              key={label}
              animate={
                reduceMotion
                  ? undefined
                  : {
                      y: danger > 0.5 ? [0, -4, 0] : 0,
                      rotate: danger > 0.5 ? [0, index % 2 === 0 ? -0.8 : 0.8, 0] : 0,
                    }
              }
              transition={{ duration: 3.2 + index * 0.35, repeat: Infinity, ease: 'easeInOut' }}
              className="rounded-lg border border-white/12 bg-black/24 p-4 hydra-submerged-card"
              style={{
                filter: `saturate(${1 - danger * 0.22}) blur(${danger * 0.35}px)`,
              }}
            >
              <div className="font-display text-xs uppercase tracking-[0.2em] text-[#8fb4cc]">
                {label}
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-300 to-hydra-alert"
                  style={{ width: `${58 + index * 11}%` }}
                />
              </div>
              <p className="mt-3 text-xs text-[#bdd4e4]">
                Signal uncertainty increases when reports lag conditions.
              </p>
            </motion.div>
          ))}
        </div>

        <div className="relative mt-5 rounded-lg border border-white/12 bg-black/22 p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            {['route visibility', 'data clarity', 'action time'].map((label, index) => (
              <div key={label}>
                <div className="font-display text-[0.64rem] uppercase tracking-[0.2em] text-[#8fb4cc]">
                  {label}
                </div>
                <div className="mt-2 h-2 rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-hydra-corrected"
                    style={{ width: `${Math.max(18, 88 - danger * 52 - index * 10)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 overflow-hidden border-t border-cyan-100/28 bg-[linear-gradient(180deg,rgba(126,222,244,0.22),rgba(23,85,102,0.84)_24%,rgba(4,19,28,0.95))] hydra-interface-water"
          style={{ height: `${waterHeight}%` }}
        >
          <div className="absolute -top-6 left-0 h-16 w-[180%] hydra-wave-crest bg-[radial-gradient(ellipse_at_center,rgba(225,251,255,0.56),rgba(43,227,214,0.22)_36%,transparent_70%)]" />
          <div className="absolute inset-0 hydra-water-texture opacity-70" />
        </div>

        {ripples.map((ripple) => (
          <span
            key={ripple.id}
            className="absolute rounded-full border border-cyan-100/35 hydra-pointer-ripple"
            style={{
              left: ripple.x,
              top: ripple.y,
              width: ripple.size,
              height: ripple.size,
              marginLeft: -ripple.size / 2,
              marginTop: -ripple.size / 2,
            }}
          />
        ))}

        <div className="absolute bottom-5 left-5 right-5 rounded-lg border border-amber-300/22 bg-[#1a1008]/82 px-4 py-3 text-sm text-amber-50 backdrop-blur-md">
          The visual flood is a teaching device. It is not a live hazard display.
        </div>
      </div>
    </div>
  );
}
