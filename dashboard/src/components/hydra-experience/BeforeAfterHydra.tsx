'use client';

import Link from 'next/link';
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
