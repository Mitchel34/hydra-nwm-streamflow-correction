'use client';

import Link from 'next/link';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { hydraExperience } from '@/lib/hydra-experience-content';

interface BeforeAfterHydraProps {
  reduceMotion: boolean;
}

function ComparisonList({ title, items, tone }: { title: string; items: string[]; tone: string }) {
  return (
    <div className={`rounded-lg border p-5 backdrop-blur-md ${tone}`}>
      <h3 className="font-display text-xl text-white">{title}</h3>
      <ul className="mt-4 space-y-3 text-sm leading-relaxed text-[#bdd4e4]">
        {items.map((item) => (
          <li key={item} className="flex gap-3">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function BeforeAfterHydra({ reduceMotion }: BeforeAfterHydraProps) {
  const [divider, setDivider] = useState(52);

  return (
    <div className="space-y-8">
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 22 }}
        whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-10% 0px' }}
        transition={{ duration: 0.55 }}
        className="max-w-3xl"
      >
        <p className="font-display text-xs uppercase tracking-[0.28em] text-hydra-corrected">
          Relief and action
        </p>
        <h2 className="mt-3 font-display text-4xl text-white md:text-5xl">
          Many signals. One warning. More time.
        </h2>
        <p className="mt-5 text-base leading-relaxed text-[#bdd4e4]">
          The point of the experience is not to make flooding theatrical. It is to show how quickly
          clarity can disappear and why earlier, better-organized information matters.
        </p>
      </motion.div>

      <div className="relative overflow-hidden rounded-lg border border-cyan-200/18 bg-[#06131f]/82 p-4 shadow-[0_28px_90px_rgba(0,0,0,0.38)] backdrop-blur-md">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-display text-xs uppercase tracking-[0.22em] text-[#8fb4cc]">
              Drag the divider
            </p>
            <h3 className="mt-1 font-display text-2xl text-white">
              Earlier signal organization preserves decision time.
            </h3>
          </div>
          <div className="text-sm text-hydra-corrected">{100 - divider}% clearer with Hydra view</div>
        </div>

        <div className="relative min-h-[460px] overflow-hidden rounded-lg border border-white/12 bg-[#030b12]">
          <div
            className="absolute inset-0 bg-[linear-gradient(180deg,#101015,#080b11_54%,#05090e)]"
            style={{ clipPath: `polygon(0 0, ${divider}% 0, ${divider}% 100%, 0 100%)` }}
          >
            <div className="absolute inset-0 bg-[repeating-linear-gradient(105deg,transparent_0_18px,rgba(255,255,255,0.06)_18px_19px,transparent_19px_42px)] opacity-40" />
            <div className="absolute left-[16%] top-[25%] h-36 w-[58%] rotate-[-5deg] border-t border-amber-200/25" />
            <div className="absolute bottom-0 left-0 right-0 h-[72%] bg-[linear-gradient(180deg,rgba(61,121,140,0.14),rgba(26,79,94,0.88)_27%,rgba(5,18,26,0.98))]" />
            <div className="absolute left-4 top-6 max-w-[40%] rounded-lg border border-amber-300/22 bg-[#1b1310]/82 p-3 sm:left-6 sm:max-w-[42%] sm:p-4">
              <h4 className="font-display text-base text-white sm:text-lg">
                <span className="sm:hidden">Without signal fusion</span>
                <span className="hidden sm:inline">Without earlier signal fusion</span>
              </h4>
              <p className="mt-2 hidden text-sm leading-relaxed text-[#d7c6b8] sm:block">
                Routes disappear before scattered signals become a local action picture.
              </p>
            </div>
            <div className="absolute bottom-6 left-6 rounded-md border border-hydra-alert/35 bg-hydra-alert/12 px-3 py-2 text-xs uppercase tracking-[0.15em] text-red-100">
              late warning
            </div>
          </div>

          <div
            className="absolute inset-0 bg-[linear-gradient(180deg,#041823,#03131d_56%,#021018)]"
            style={{ clipPath: `polygon(${divider}% 0, 100% 0, 100% 100%, ${divider}% 100%)` }}
          >
            <div className="absolute inset-0 opacity-70 hydra-experience-grid" />
            <div className="absolute left-[16%] right-[12%] top-[52%] h-1 rotate-[-5deg] rounded-full bg-hydra-corrected/55" />
            <div className="absolute left-[28%] top-[33%] h-3 w-3 rounded-full bg-hydra-corrected shadow-[0_0_22px_rgba(43,227,214,0.55)]" />
            <div className="absolute left-[58%] top-[24%] h-3 w-3 rounded-full bg-hydra-corrected shadow-[0_0_22px_rgba(43,227,214,0.55)]" />
            <div className="absolute left-[74%] top-[62%] h-3 w-3 rounded-full bg-amber-200 shadow-[0_0_22px_rgba(242,180,106,0.5)]" />
            <div className="absolute bottom-0 left-0 right-0 h-[28%] bg-[linear-gradient(180deg,rgba(43,227,214,0.08),rgba(7,56,70,0.52))]" />
            <div className="absolute right-4 top-6 max-w-[40%] rounded-lg border border-hydra-corrected/28 bg-[#031d27]/86 p-3 sm:right-6 sm:max-w-[42%] sm:p-4">
              <h4 className="font-display text-base text-white sm:text-lg">
                <span className="sm:hidden">With Hydra support</span>
                <span className="hidden sm:inline">With Hydra-style decision support</span>
              </h4>
              <p className="mt-2 hidden text-sm leading-relaxed text-[#bdeeea] sm:block">
                Signals converge into route status, priority zones, and earlier protective action.
              </p>
            </div>
            <div className="absolute bottom-6 right-6 rounded-md border border-hydra-corrected/35 bg-hydra-corrected/12 px-3 py-2 text-xs uppercase tracking-[0.15em] text-hydra-corrected">
              earlier action
            </div>
          </div>

          <div
            aria-hidden="true"
            className="absolute inset-y-0 w-px bg-white/70 shadow-[0_0_24px_rgba(255,255,255,0.32)]"
            style={{ left: `${divider}%` }}
          />
          <div
            aria-hidden="true"
            className="absolute top-1/2 h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/35 bg-[#06131f]/90 backdrop-blur-md"
            style={{ left: `${divider}%` }}
          />
          <input
            type="range"
            min={28}
            max={72}
            value={divider}
            onChange={(event) => setDivider(Number(event.target.value))}
            aria-label="Compare without earlier signal fusion and with Hydra-style decision support"
            className="absolute inset-x-8 bottom-5 z-10 h-8 cursor-ew-resize accent-hydra-corrected"
          />
        </div>

        <div className="sr-only" aria-live="polite">
          Comparison slider position is {divider}. Without Hydra shows higher water coverage and
          late warning. With Hydra shows clearer routes, organized data, and earlier action.
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <ComparisonList
          title="Without earlier signal fusion"
          items={hydraExperience.comparison.without}
          tone="border-amber-300/22 bg-[#1b1310]/72 text-amber-200"
        />
        <ComparisonList
          title="With Hydra-style decision support"
          items={hydraExperience.comparison.withHydra}
          tone="border-hydra-corrected/28 bg-[#031d27]/78 text-hydra-corrected"
        />
      </div>

      <div className="rounded-lg border border-white/12 bg-[#06131f]/84 p-5 text-sm leading-relaxed text-[#bdd4e4] backdrop-blur-md">
        {hydraExperience.comparison.guardrail}
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        {hydraExperience.ctas.map((cta) => (
          <Link
            key={cta.href}
            href={cta.href}
            className="group rounded-lg border border-cyan-200/18 bg-[#071420]/78 p-4 transition-colors hover:border-hydra-corrected/45 hover:bg-[#092131]"
          >
            <h3 className="font-display text-base text-white group-hover:text-hydra-corrected">
              {cta.label}
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-[#8fb4cc]">{cta.body}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
