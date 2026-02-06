'use client';

import { motion } from 'framer-motion';

interface PipelineSchematicProps {
  reduceMotion: boolean;
}

const stages = [
  {
    key: 'input',
    title: 'NWM Forecast',
    subtitle: 'Hourly short-range discharge predictions',
    tone: 'text-hydra-baseline border-hydra-baseline/40 bg-hydra-baseline/10',
  },
  {
    key: 'residual',
    title: 'Residual Calculator',
    subtitle: 'Compute model error against observations',
    tone: 'text-hydra-observed border-hydra-observed/40 bg-hydra-observed/10',
  },
  {
    key: 'model',
    title: 'HYDRA Transformer',
    subtitle: 'Temporal attention with hydrologic constraints',
    tone: 'text-hydra-accent-soft border-hydra-accent/40 bg-hydra-accent/[0.12]',
  },
  {
    key: 'output',
    title: 'Corrected Streamflow',
    subtitle: 'Bias-corrected hydrograph at target sites',
    tone: 'text-hydra-corrected border-hydra-corrected/40 bg-hydra-corrected/10',
  },
];

function FlowArrow({ reduceMotion }: { reduceMotion: boolean }) {
  return (
    <>
      <div className="hidden md:flex h-9 w-16 items-center justify-center">
        <div className="relative h-px w-full bg-hydra-accent/35">
          <motion.span
            className="absolute -top-1.5 h-3 w-3 rounded-full bg-hydra-corrected shadow-[0_0_14px_rgba(43,227,214,0.75)]"
            animate={reduceMotion ? undefined : { x: [0, 52, 0] }}
            transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>
      </div>
      <div className="flex md:hidden h-12 items-center justify-center">
        <div className="relative w-px h-full bg-hydra-accent/35">
          <motion.span
            className="absolute -left-1.5 h-3 w-3 rounded-full bg-hydra-corrected shadow-[0_0_14px_rgba(43,227,214,0.75)]"
            animate={reduceMotion ? undefined : { y: [0, 38, 0] }}
            transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>
      </div>
    </>
  );
}

export default function PipelineSchematic({ reduceMotion }: PipelineSchematicProps) {
  return (
    <div className="surface-panel rounded-3xl p-6 md:p-8">
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] gap-0 items-center">
        {stages.map((stage, index) => (
          <div key={stage.key} className="contents">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.15 * index }}
              className={`rounded-2xl border px-4 py-5 md:px-5 md:py-6 ${stage.tone}`}
            >
              <p className="font-display text-[0.78rem] uppercase tracking-[0.22em] opacity-75">
                Stage {index + 1}
              </p>
              <h3 className="font-display mt-2 text-lg leading-tight">{stage.title}</h3>
              <p className="mt-2 text-sm text-[#d0e2f0]/88">{stage.subtitle}</p>
            </motion.div>
            {index < stages.length - 1 && <FlowArrow reduceMotion={reduceMotion} />}
          </div>
        ))}
      </div>
      <div className="mt-6 rounded-xl border border-hydra-accent/25 bg-[#081522]/90 px-4 py-3 text-sm text-[#b6cedf]">
        <span className="font-display uppercase tracking-[0.16em] text-xs text-hydra-corrected mr-2">
          Legend
        </span>
        Inputs and intermediate residuals are transformed into a site-specific corrected discharge
        signal while preserving physical plausibility.
      </div>
    </div>
  );
}
