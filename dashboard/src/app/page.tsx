'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import PipelineSchematic from '@/components/PipelineSchematic';

function FeatureCard({
  icon,
  title,
  description,
  eyebrow,
  delay = 0,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  eyebrow: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className="surface-panel rounded-2xl p-6"
    >
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-hydra-accent/30 bg-gradient-to-br from-hydra-accent/30 to-hydra-corrected/30 text-hydra-corrected">
        {icon}
      </div>
      <p className="font-display text-[0.68rem] uppercase tracking-[0.22em] text-hydra-accent-soft/85">
        {eyebrow}
      </p>
      <h3 className="mt-2 mb-2 font-display text-lg text-white">{title}</h3>
      <p className="text-[0.95rem] leading-relaxed text-[#afc6d7]">{description}</p>
    </motion.div>
  );
}

export default function HomePage() {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const shouldReduce =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const storedSetting =
      typeof window !== 'undefined'
        ? window.localStorage.getItem('hydra.reduceMotion')
        : null;

    if (storedSetting !== null) {
      setReduceMotion(storedSetting === 'true');
      return;
    }
    setReduceMotion(shouldReduce);
  }, []);

  const handleMotionToggle = () => {
    setReduceMotion((prev) => {
      const next = !prev;
      window.localStorage.setItem('hydra.reduceMotion', String(next));
      return next;
    });
  };

  return (
    <div className="relative min-h-screen overflow-hidden text-white">
      <div className="pointer-events-none absolute inset-0 opacity-[0.13] [background-image:linear-gradient(transparent_95%,rgba(134,171,196,0.22)_95%),linear-gradient(90deg,transparent_95%,rgba(134,171,196,0.18)_95%)] [background-size:28px_28px]" />
      <div className="pointer-events-none absolute top-24 left-1/2 -translate-x-1/2 select-none font-display text-[24vw] tracking-[0.2em] text-white/3">
        HYDRA
      </div>

      <nav className="relative z-10 border-b border-[#2a455c]/55 bg-[#06131f]/70 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-md bg-gradient-to-br from-hydra-accent to-hydra-corrected shadow-[0_0_20px_rgba(43,227,214,0.45)]" />
            <span className="font-display text-lg font-semibold tracking-[0.12em]">HYDRA</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleMotionToggle}
              className="rounded-full border border-hydra-accent/35 px-3 py-1.5 text-xs text-[#bbd4e5] transition-colors hover:border-hydra-corrected/50 hover:text-white"
              aria-label={reduceMotion ? 'Enable animations' : 'Reduce animations'}
            >
              {reduceMotion ? 'Motion: Reduced' : 'Motion: Full'}
            </button>
            <Link
              href="/analysis"
              className="text-sm text-[#c2d8e8] transition-colors hover:text-white"
            >
              Analysis
            </Link>
            <Link
              href="/dashboard"
              className="text-sm text-[#c2d8e8] transition-colors hover:text-white"
            >
              Dashboard →
            </Link>
          </div>
        </div>
      </nav>

      <main className="relative z-10">
        <div className="mx-auto max-w-7xl px-6 pt-16 pb-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mx-auto max-w-4xl text-center"
          >
            <h1 className="font-display text-5xl font-semibold tracking-tight md:text-7xl">
              <span className="gradient-text">HYDRA</span>
            </h1>
            <p className="mt-4 text-lg font-medium text-[#d7e8f4] md:text-2xl">
              <span className="shimmer-text">Hybrid Deep-learning for Residual Analysis</span>
            </p>
            <p className="mx-auto mt-6 max-w-3xl text-lg leading-relaxed text-[#a9c2d3]">
              A transformer-based machine learning system for correcting errors in
              National Water Model streamflow predictions across the Appalachian
              region.
            </p>
          </motion.div>

          <motion.div
            className="mt-10 flex justify-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <Link
              href="/dashboard"
              className="group relative inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-hydra-accent to-hydra-corrected px-8 py-4 font-display font-medium text-[#022133] shadow-lg transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_10px_25px_rgba(43,227,214,0.26)]"
            >
              <span>Explore Results</span>
              <svg
                className="h-5 w-5 transition-transform group-hover:translate-x-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 7l5 5m0 0l-5 5m5-5H6"
                />
              </svg>
            </Link>
          </motion.div>

          <motion.section
            className="mt-14"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <h2 className="mb-5 text-center font-display text-sm uppercase tracking-[0.28em] text-[#8fb4cc]">
              Model Pipeline
            </h2>
            <PipelineSchematic reduceMotion={reduceMotion} />
          </motion.section>

          <div className="mt-16 grid gap-6 md:grid-cols-3">
            <FeatureCard
              delay={0.4}
              icon={
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              }
              eyebrow="Comparative Analysis"
              title="Multi-Site Evaluation"
              description="Compare model performance across 3 unregulated USGS gauging stations in the New River and Watauga watersheds."
            />
            <FeatureCard
              delay={0.5}
              icon={
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              }
              eyebrow="Ablation Studies"
              title="Experiment Grid"
              description="Evaluate causal masking, physics constraints, quantile regression, and v2/v3 architecture variants using consistent metrics."
            />
            <FeatureCard
              delay={0.6}
              icon={
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                </svg>
              }
              eyebrow="Interactive Insights"
              title="Chart-Driven Diagnostics"
              description="Inspect hydrographs, site-level improvements, and residual error distributions for each configuration."
            />
          </div>

          <motion.div
            className="mt-[4.5rem] grid grid-cols-2 gap-4 md:grid-cols-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.65 }}
          >
            {[
              { value: '3', label: 'Unregulated Sites' },
              { value: '27%', label: 'Best RMSE Reduction' },
              { value: '15', label: 'Experiments (v2+v3)' },
              { value: '2010–2020', label: 'Study Period' },
            ].map((stat, i) => (
              <div key={i} className="surface-panel rounded-xl p-4 text-center">
                <div className="font-display text-2xl font-semibold gradient-text md:text-3xl">
                  {stat.value}
                </div>
                <div className="mt-1 text-xs tracking-wide text-[#95b0c3] uppercase">
                  {stat.label}
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </main>

      <footer className="relative z-10 border-t border-[#2a455c]/55 bg-[#06131f]/75 py-8">
        <div className="mx-auto max-w-7xl px-6 text-center">
          <p className="text-sm text-[#9fbacc]">
            Master&apos;s Thesis Project | Appalachian State University | 2024–2025
          </p>
          <p className="mt-2 text-xs tracking-[0.08em] text-[#7f9bb0] uppercase">
            Hydra Transformer for NWM Streamflow Error Correction
          </p>
        </div>
      </footer>
    </div>
  );
}
