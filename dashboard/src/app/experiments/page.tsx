'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  fetchExperimentResults,
} from '@/lib/data';
import {
  DashboardData,
  ExperimentResult,
} from '@/lib/types';
import { getPublicExperimentName } from '@/lib/labels';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import { DashboardSkeleton } from '@/components/SkeletonLoader';
import ExperimentExplorerTable from '@/components/ExperimentExplorerTable';

/* ---------- Constants ---------- */

const PRIMARY_EXPERIMENT = 'hydra_v3_usgs_nwm_era5';

const SITE_SHORT: Record<string, string> = {
  '03161000': 'Jefferson',
  '03164000': 'Galax',
  '03479000': 'Sugar Grove',
};

/* ---------- Helpers ---------- */

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/* ---------- Page ---------- */

export default function ExperimentsPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchExperimentResults()
      .then(setData)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  /* ── Section 1: Executive Summary ── */
  const executiveSummary = useMemo(() => {
    if (!data) return null;
    const primary = data.results.filter((r) => r.experiment === PRIMARY_EXPERIMENT);
    if (primary.length === 0) return null;

    const rmseVals = primary.map((r) => r.rmse_improvement_pct ?? 0).filter(Number.isFinite);
    const nsePctVals = primary.map((r) => {
      const base = r.baseline.nse ?? 0;
      const corr = r.corrected.nse ?? 0;
      return base !== 0 ? ((corr - base) / Math.abs(base)) * 100 : 0;
    });
    const sitesImproved = primary.filter((r) => (r.rmse_improvement_pct ?? 0) > 0).length;

    return {
      medianRmse: median(rmseVals),
      medianNsePct: median(nsePctVals),
      sitesImproved,
      totalSites: primary.length,
    };
  }, [data]);

  /* ── Section 3: Best result per site ── */
  const bestPerSite = useMemo(() => {
    if (!data) return [];
    return Object.keys(data.sites).map((siteId) => {
      const siteResults = data.results.filter((r) => r.site_id === siteId);
      const best = siteResults.reduce<ExperimentResult | null>(
        (b, r) =>
          !b || (r.rmse_improvement_pct ?? -Infinity) > (b.rmse_improvement_pct ?? -Infinity)
            ? r
            : b,
        null
      );
      return { siteId, metadata: data.sites[siteId], best };
    });
  }, [data]);

  /* ── Loading / Error ── */

  if (loading) return <DashboardSkeleton />;

  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#07131f] px-4">
        <div className="text-center">
          <div className="mb-2 text-xl text-red-400">Error loading data</div>
          <div className="text-[#afc6d7]">{error}</div>
          <p className="mt-4 text-sm text-[#86a6bc]">
            Ensure results are exported to{' '}
            <code>/public/data/experiment_results.json</code>
          </p>
        </div>
      </div>
    );
  }

  const uniqueExperiments = new Set(data.results.map((r) => r.experiment)).size;
  const uniqueSites = new Set(data.results.map((r) => r.site_id)).size;

  return (
    <div className="min-h-screen text-white">
      <Navigation />

      {/* Page header */}
      <header className="border-b border-[#2a445b]/50 bg-[#071420]/50 px-4 md:px-6 py-5">
        <div className="mx-auto max-w-7xl flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-2xl gradient-text">Experiments</h1>
            <p className="text-sm text-[#8daec2] mt-1">
              {uniqueExperiments} archived configurations across {uniqueSites} primary sites. Use
              this page to inspect older controlled runs and hydrographs, or{' '}
              <Link href="/era5" className="text-hydra-corrected hover:underline">
                open the completed ERA5 sweep
              </Link>{' '}
              for the new feature-evidence view.
            </p>
          </div>
          <span className="text-sm text-[#8daec2] hidden sm:block shrink-0">
            Updated: {new Date(data.generated_at).toLocaleDateString()}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 md:px-6 py-10 space-y-16">

        {/* ── SECTION 1: Executive Summary ── */}
        <section>
          <div className="mb-1">
            <h2 className="font-display text-lg text-white">Executive Summary</h2>
            <p className="text-sm text-[#8daec2] mt-0.5">
              Primary result:{' '}
              <span className="text-hydra-corrected font-medium">gauge-informed Hydra</span>
              {' '}— recent USGS observations, NWM discharge, and ERA5-Land context.
            </p>
          </div>

          {executiveSummary ? (
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-emerald-500/20 bg-[#061e14] p-5">
                <div className="text-4xl font-bold text-emerald-400 tabular-nums leading-none">
                  ↓{executiveSummary.medianRmse.toFixed(0)}%
                </div>
                <div className="mt-3 text-sm font-medium text-white">Median RMSE Reduction</div>
                <div className="mt-1 text-xs text-[#4a9e72]">
                  vs. NWM baseline across {executiveSummary.totalSites} unregulated sites
                </div>
              </div>

              <div className="rounded-xl border border-sky-500/20 bg-[#051820] p-5">
                <div className="text-4xl font-bold text-sky-400 tabular-nums leading-none">
                  ↑{executiveSummary.medianNsePct.toFixed(0)}%
                </div>
                <div className="mt-3 text-sm font-medium text-white">Median NSE Improvement</div>
                <div className="mt-1 text-xs text-[#3a8aaa]">
                  Relative increase in Nash-Sutcliffe efficiency
                </div>
              </div>

              <div className="rounded-xl border border-[#2be3d6]/20 bg-[#05191a] p-5">
                <div className="text-4xl font-bold text-hydra-corrected tabular-nums leading-none">
                  {executiveSummary.sitesImproved} / {executiveSummary.totalSites}
                </div>
                <div className="mt-3 text-sm font-medium text-white">Sites Improved</div>
                <div className="mt-1 text-xs text-[#2a8a86]">
                  Relative to raw NWM at the primary gauges
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-[#2a445b] bg-[#0a1822] px-4 py-6 text-sm text-[#6a8fa6] text-center">
              Primary gauge-informed Hydra results are not available in the exported dashboard data.
            </div>
          )}
        </section>

        {/* ── SECTION 2: Experiment Explorer ── */}
        <section>
          <div className="mb-4">
            <h2 className="font-display text-lg text-white">Experiment Explorer</h2>
            <p className="text-sm text-[#8daec2] mt-0.5">
              {Object.keys(data.experiments).length} archived configurations are available for
              inspection. Click any row to expand site-level details.
            </p>
          </div>
          <ExperimentExplorerTable
            experiments={data.experiments}
            results={data.results}
            sites={data.sites}
          />
        </section>

        {/* ── SECTION 3: Site Performance Overview ── */}
        <section>
          <div className="mb-4">
            <h2 className="font-display text-lg text-white">Site Performance Overview</h2>
            <p className="text-sm text-[#8daec2] mt-0.5">
              Best result per site across all experiments. Click a card for the full site
              analysis.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {bestPerSite.map(({ siteId, metadata, best }) => {
              if (!best) return null;
              const shortName = SITE_SHORT[siteId] ?? siteId;
              const rmsePct = best.rmse_improvement_pct ?? 0;
              const nseCorrected = best.corrected.nse ?? 0;
              const bestExpName =
                getPublicExperimentName(best.experiment, data.experiments[best.experiment]?.name);

              return (
                <Link
                  key={siteId}
                  href={`/experiments/site/${siteId}`}
                  className="group block rounded-xl border border-[#2a445b] bg-[#091929] p-5 hover:border-hydra-corrected/40 hover:bg-[#0c1e30] transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-lg font-semibold text-white group-hover:text-hydra-corrected transition-colors">
                        {shortName}
                      </div>
                      <div className="text-xs font-mono text-[#4a7080] mt-0.5">
                        {siteId}
                      </div>
                      <div className="text-xs text-[#5a8099] mt-1">{metadata.watershed}</div>
                    </div>
                    <svg
                      className="w-4 h-4 text-[#4a6a80] group-hover:text-hydra-corrected mt-1 transition-colors shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div>
                      <div
                        className={`text-3xl font-bold tabular-nums leading-none ${
                          rmsePct > 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {rmsePct > 0 ? '↓' : '↑'}
                        {Math.abs(rmsePct).toFixed(0)}%
                      </div>
                      <div className="text-xs text-[#4a7080] mt-1">RMSE reduction</div>
                    </div>
                    <div>
                      <div className="text-3xl font-bold tabular-nums leading-none text-sky-400">
                        {nseCorrected.toFixed(2)}
                      </div>
                      <div className="text-xs text-[#4a7080] mt-1">NSE</div>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-[#1a3045] text-[10px] text-[#3a6070] truncate">
                    Best: {bestExpName}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="surface-panel rounded-xl p-5">
          <h2 className="font-display text-lg text-white">How to Read This Page</h2>
          <p className="mt-2 max-w-4xl text-sm leading-relaxed text-[#8daec2]">
            These archived experiments support the manuscript&apos;s information-source attribution.
            They are separate from the completed ERA5 feature sweep and should not be read as a
            claim that Hydra outperforms every one-hour baseline.
          </p>
        </section>
      </main>

      <Footer />
    </div>
  );
}
