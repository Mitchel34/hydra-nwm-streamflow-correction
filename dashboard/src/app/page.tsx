'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import StudyRegionMap from '@/components/StudyRegionMap';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import { fetchRigorousEval } from '@/lib/data';
import { RigorousEvalData } from '@/lib/types';

export default function HomePage() {
  const [evalData, setEvalData] = useState<RigorousEvalData | null>(null);

  useEffect(() => {
    fetchRigorousEval().then(setEvalData);
  }, []);

  // Compute key results from rigorous eval
  const keyResults = evalData
    ? (() => {
        const experiments = evalData.experiments;
        let bestMedian = -Infinity;
        let bestExp = '';
        let totalSig = 0;
        let totalPairs = 0;
        for (const exp of experiments) {
          const cs = evalData.cross_site[exp];
          if (!cs) continue;
          if ((cs.median_ss_rmse ?? -Infinity) > bestMedian) {
            bestMedian = cs.median_ss_rmse ?? -Infinity;
            bestExp = exp;
          }
          totalSig += cs.sites_significant_001 ?? 0;
          totalPairs += cs.n_sites ?? 0;
        }
        return { bestMedian, bestExp, totalSig, totalPairs, nExperiments: experiments.length };
      })()
    : null;

  return (
    <div className="relative min-h-screen overflow-hidden text-white">
      <div className="pointer-events-none absolute inset-0 opacity-[0.13] [background-image:linear-gradient(transparent_95%,rgba(134,171,196,0.22)_95%),linear-gradient(90deg,transparent_95%,rgba(134,171,196,0.18)_95%)] [background-size:28px_28px]" />
      <div className="pointer-events-none absolute top-24 left-1/2 -translate-x-1/2 select-none font-display text-[24vw] tracking-[0.2em] text-white/3">
        HYDRA
      </div>

      <Navigation />

      <main className="relative z-10">
        <div className="mx-auto max-w-7xl px-4 md:px-6 pt-16 pb-20">
          {/* Hero */}
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
              A compact 1-million parameter hybrid GRU-Transformer model that improves
              National Water Model streamflow predictions by up to 48% across unregulated
              Appalachian watersheds.
            </p>
          </motion.div>

          {/* CTAs */}
          <motion.div
            className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <Link
              href="/experiments"
              className="group relative inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-hydra-accent to-hydra-corrected px-6 py-3 sm:px-8 sm:py-4 font-display font-medium text-[#022133] shadow-lg transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_10px_25px_rgba(43,227,214,0.26)]"
            >
              <span>Explore Results</span>
              <svg className="h-5 w-5 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
            <Link
              href="/model"
              className="group relative inline-flex items-center gap-2 rounded-full border-2 border-hydra-accent/50 bg-transparent px-6 py-3 sm:px-8 sm:py-4 font-display font-medium text-white shadow-lg transition-all duration-300 hover:scale-[1.02] hover:border-hydra-corrected hover:bg-hydra-accent/10"
            >
              <span>Model Specs</span>
              <svg className="h-5 w-5 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
              </svg>
            </Link>
          </motion.div>

          {/* The Problem */}
          <motion.section
            className="mt-20"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <h2 className="mb-5 text-center font-display text-sm uppercase tracking-[0.28em] text-[#8fb4cc]">
              The Problem
            </h2>
            <div className="mx-auto max-w-3xl space-y-4 text-center text-[#a9c2d3] leading-relaxed">
              <p>
                NOAA&apos;s National Water Model (NWM) provides real-time streamflow forecasts across the continental
                United States, but exhibits systematic errors in headwater catchments where complex terrain and
                heterogeneous land cover challenge physics-based approaches.
              </p>
              <p>
                Events like Hurricane Helene (September 2024) underscored the critical need for accurate
                streamflow predictions in southern Appalachian watersheds, where NWM errors can exceed 50%
                during peak flows &mdash; precisely when accuracy matters most.
              </p>
            </div>
          </motion.section>

          {/* Study Region */}
          <motion.section
            className="mt-16"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.35 }}
          >
            <h2 className="mb-5 text-center font-display text-sm uppercase tracking-[0.28em] text-[#8fb4cc]">
              Study Region
            </h2>
            <StudyRegionMap />
          </motion.section>

          {/* Key Results */}
          {keyResults && (
            <motion.section
              className="mt-16"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
              <h2 className="mb-5 text-center font-display text-sm uppercase tracking-[0.28em] text-[#8fb4cc]">
                Key Results
              </h2>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="surface-panel rounded-xl p-5 text-center">
                  <div className="font-display text-3xl font-semibold text-hydra-corrected">
                    +{(keyResults.bestMedian * 100).toFixed(1)}%
                  </div>
                  <div className="mt-2 text-sm text-[#a9c2d3]">Best Median Skill Score</div>
                  <div className="mt-1 text-xs text-[#6f8da0]">
                    SS_RMSE across all sites ({keyResults.bestExp.replace(/_/g, ' ')})
                  </div>
                </div>
                <div className="surface-panel rounded-xl p-5 text-center">
                  <div className="font-display text-3xl font-semibold text-hydra-corrected">
                    {keyResults.nExperiments}
                  </div>
                  <div className="mt-2 text-sm text-[#a9c2d3]">Experiment Configurations</div>
                  <div className="mt-1 text-xs text-[#6f8da0]">
                    Across v2, v3, ERA5-only, and USGS input variants
                  </div>
                </div>
                <div className="surface-panel rounded-xl p-5 text-center">
                  <div className="font-display text-3xl font-semibold text-hydra-corrected">
                    {keyResults.totalSig}/{keyResults.totalPairs}
                  </div>
                  <div className="mt-2 text-sm text-[#a9c2d3]">Statistically Significant</div>
                  <div className="mt-1 text-xs text-[#6f8da0]">
                    Experiment-site pairs at p&lt;0.001 (Diebold-Mariano)
                  </div>
                </div>
              </div>
            </motion.section>
          )}

          {/* How to Use This Tool */}
          <motion.section
            className="mt-16"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.45 }}
          >
            <h2 className="mb-5 text-center font-display text-sm uppercase tracking-[0.28em] text-[#8fb4cc]">
              How to Use This Tool
            </h2>
            <div className="grid gap-6 md:grid-cols-3">
              {[
                {
                  step: 1,
                  title: 'Understand the Model',
                  description: 'Learn how HYDRA combines GRU temporal encoding with Transformer attention to correct NWM errors in real-time.',
                  href: '/model',
                  icon: (
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                    </svg>
                  ),
                },
                {
                  step: 2,
                  title: 'Explore Experiments',
                  description: 'Compare 19 configurations across 3 sites with interactive hydrographs, error distributions, and performance metrics.',
                  href: '/experiments',
                  icon: (
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  ),
                },
                {
                  step: 3,
                  title: 'Review Evaluation',
                  description: 'Examine skill scores with bootstrap confidence intervals, significance tests, and flow regime analysis.',
                  href: '/evaluation',
                  icon: (
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ),
                },
              ].map((item) => (
                <Link key={item.step} href={item.href} className="group">
                  <div className="surface-panel rounded-2xl p-6 transition-all duration-300 group-hover:border-hydra-corrected/40 group-hover:bg-[#0d1f2e]">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-hydra-corrected/20 text-hydra-corrected font-display text-sm font-semibold">
                        {item.step}
                      </div>
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-hydra-accent/30 bg-gradient-to-br from-hydra-accent/30 to-hydra-corrected/30 text-hydra-corrected">
                        {item.icon}
                      </div>
                    </div>
                    <h3 className="font-display text-lg text-white mb-2">{item.title}</h3>
                    <p className="text-sm leading-relaxed text-[#afc6d7]">{item.description}</p>
                    <div className="mt-3 text-xs text-hydra-corrected/70 group-hover:text-hydra-corrected transition-colors">
                      Learn more →
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </motion.section>

          {/* Stats bar */}
          <motion.div
            className="mt-16 grid grid-cols-2 gap-4 md:grid-cols-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.5 }}
          >
            {[
              { value: '3', label: 'Unregulated Sites' },
              { value: '48%', label: 'Best Skill Score' },
              { value: '19', label: 'Experiments Tested' },
              { value: '2010-2020', label: 'Study Period' },
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

      <Footer />
    </div>
  );
}
