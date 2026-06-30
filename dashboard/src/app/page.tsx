'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import StudyRegionMap from '@/components/StudyRegionMap';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import { fetchEra5Sweep, fetchExperimentResults, fetchRigorousEval } from '@/lib/data';
import { DashboardData, Era5SweepData, RigorousEvalData } from '@/lib/types';

const PRIMARY_EXPERIMENT = 'hydra_v3_usgs_nwm_era5';

function pct(value: number): string {
  return `${value.toFixed(1)}%`;
}

export default function HomePage() {
  const [evalData, setEvalData] = useState<RigorousEvalData | null>(null);
  const [dashData, setDashData] = useState<DashboardData | null>(null);
  const [era5Data, setEra5Data] = useState<Era5SweepData | null>(null);

  useEffect(() => {
    Promise.all([fetchRigorousEval(), fetchExperimentResults(), fetchEra5Sweep()]).then(
      ([rigorous, dashboard, era5]) => {
        setEvalData(rigorous);
        setDashData(dashboard);
        setEra5Data(era5);
      },
    );
  }, []);

  const primaryRange = useMemo(() => {
    const rows = dashData?.results.filter((row) => row.experiment === PRIMARY_EXPERIMENT) ?? [];
    const values = rows
      .map((row) => row.rmse_improvement_pct)
      .filter((value): value is number => value != null && Number.isFinite(value));
    if (values.length === 0) return null;
    return { min: Math.min(...values), max: Math.max(...values), sites: values.length };
  }, [dashData]);

  const significance = evalData?.cross_site[PRIMARY_EXPERIMENT];
  const era5Range = useMemo(() => {
    const rows = era5Data?.headline.all_eligible ?? [];
    if (rows.length === 0) return null;
    const values = rows.map((row) => row.ss_rmse_mean * 100);
    return { min: Math.min(...values), max: Math.max(...values), runs: era5Data?.row_counts.completed_runs ?? 0 };
  }, [era5Data]);

  return (
    <div className="relative min-h-screen overflow-hidden text-white">
      <div className="pointer-events-none absolute inset-0 opacity-[0.13] [background-image:linear-gradient(transparent_95%,rgba(134,171,196,0.22)_95%),linear-gradient(90deg,transparent_95%,rgba(134,171,196,0.18)_95%)] [background-size:28px_28px]" />

      <Navigation />

      <main className="relative z-10">
        <section className="mx-auto max-w-7xl px-4 pb-14 pt-14 md:px-6 md:pt-20">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center"
          >
            <div>
              <p className="font-display text-xs uppercase tracking-[0.24em] text-hydra-corrected">
                Local streamflow correction
              </p>
              <h1 className="mt-4 font-display text-5xl font-semibold tracking-tight md:text-7xl">
                <span className="gradient-text">Hydra</span>
              </h1>
              <p className="mt-5 max-w-3xl text-xl leading-relaxed text-[#d7e8f4]">
                A research dashboard for understanding which information sources help correct
                National Water Model streamflow at mountain gauges.
              </p>
              <p className="mt-4 max-w-3xl text-base leading-relaxed text-[#a9c2d3]">
                The study compares recent gauge observations, raw National Water Model discharge,
                and ERA5-Land weather context. The goal is not just a better prediction, but a
                clearer explanation of where local correction skill comes from.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/analysis"
                  className="inline-flex justify-center rounded-full bg-gradient-to-r from-hydra-accent to-hydra-corrected px-6 py-3 font-display font-medium text-[#022133] transition-transform hover:scale-[1.02]"
                >
                  View findings
                </Link>
                <Link
                  href="/era5"
                  className="inline-flex justify-center rounded-full border border-hydra-corrected/45 px-6 py-3 font-display font-medium text-hydra-corrected transition-colors hover:bg-hydra-corrected/10"
                >
                  Explore ERA5 evidence
                </Link>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="surface-panel rounded-xl p-5">
                <div className="font-display text-4xl text-hydra-corrected">
                  {primaryRange ? `${pct(primaryRange.min)}-${pct(primaryRange.max)}` : 'Loading'}
                </div>
                <div className="mt-2 text-sm font-medium text-white">Gauge-informed RMSE reduction</div>
                <p className="mt-1 text-xs leading-relaxed text-[#8fb4cc]">
                  Verified test-period range across the three primary unregulated gauges.
                </p>
              </div>
              <div className="surface-panel rounded-xl p-5">
                <div className="font-display text-4xl text-hydra-corrected">
                  {significance ? `${significance.sites_significant_001}/${significance.n_sites}` : 'Loading'}
                </div>
                <div className="mt-2 text-sm font-medium text-white">Sites significant vs raw NWM</div>
                <p className="mt-1 text-xs leading-relaxed text-[#8fb4cc]">
                  Moving-block bootstrap and Diebold-Mariano workflow; not a persistence claim.
                </p>
              </div>
              <div className="surface-panel rounded-xl p-5">
                <div className="font-display text-4xl text-hydra-corrected">
                  {era5Range ? `${pct(era5Range.min)}-${pct(era5Range.max)}` : 'Loading'}
                </div>
                <div className="mt-2 text-sm font-medium text-white">Gauge-free ERA5 sweep gain</div>
                <p className="mt-1 text-xs leading-relaxed text-[#8fb4cc]">
                  All eligible NWM-plus-ERA5 features relative to raw NWM.
                </p>
              </div>
              <div className="surface-panel rounded-xl p-5">
                <div className="font-display text-4xl text-hydra-corrected">
                  {era5Range ? era5Range.runs : '216'}
                </div>
                <div className="mt-2 text-sm font-medium text-white">ERA5 sweep runs</div>
                <p className="mt-1 text-xs leading-relaxed text-[#8fb4cc]">
                  Registered feature sets across three sites and three fixed seeds.
                </p>
              </div>
            </div>
          </motion.div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-10 md:px-6">
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="surface-panel rounded-xl p-6">
              <h2 className="font-display text-xl text-white">The Question</h2>
              <p className="mt-3 text-sm leading-relaxed text-[#a9c2d3]">
                When a national river model is locally biased, which information helps most:
                the recent gauge record, the model hydrograph, or weather and seasonal context?
              </p>
            </div>
            <div className="surface-panel rounded-xl p-6">
              <h2 className="font-display text-xl text-white">The Finding</h2>
              <p className="mt-3 text-sm leading-relaxed text-[#a9c2d3]">
                Recent gauge history is the strongest one-hour state signal. The National Water
                Model still adds routed basin information, and ERA5-Land adds smaller but measurable
                context when gauge data are removed.
              </p>
            </div>
            <div className="surface-panel rounded-xl p-6">
              <h2 className="font-display text-xl text-white">The Limit</h2>
              <p className="mt-3 text-sm leading-relaxed text-[#a9c2d3]">
                One-hour persistence is a strong baseline, and regulated rivers need operations-aware
                inputs. The dashboard therefore frames Hydra as NWM correction and evidence
                attribution, not a universal replacement for every nowcast.
              </p>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-10 md:px-6">
          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="font-display text-xs uppercase tracking-[0.24em] text-[#8fb4cc]">
                Study region
              </p>
              <h2 className="mt-2 font-display text-3xl text-white">Southern Appalachian Gauges</h2>
            </div>
            <Link href="/experiments" className="text-sm text-hydra-corrected hover:underline">
              Open experiment explorer
            </Link>
          </div>
          <StudyRegionMap />
        </section>

        <section className="mx-auto max-w-7xl px-4 py-10 md:px-6">
          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                title: 'Findings',
                href: '/analysis',
                description: 'Read the main evidence chain: gauge-informed correction, input ablations, ERA5 results, and limitations.',
              },
              {
                title: 'ERA5 Evidence',
                href: '/era5',
                description: 'Filter the completed feature sweep by site, feature group, and metric to see predictive sensitivities.',
              },
              {
                title: 'Manuscript',
                href: '/manuscript',
                description: 'View or download the Phase 4 manuscript PDF when the compiled source is available.',
              },
            ].map((item) => (
              <Link key={item.href} href={item.href} className="group">
                <div className="surface-panel h-full rounded-xl p-6 transition-colors group-hover:border-hydra-corrected/40 group-hover:bg-[#0d1f2e]">
                  <h3 className="font-display text-xl text-white">{item.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-[#a9c2d3]">{item.description}</p>
                  <div className="mt-4 text-sm text-hydra-corrected">Open →</div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
