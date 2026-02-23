'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import StudyRegionMap from '@/components/StudyRegionMap';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import { fetchExperimentResults, fetchRigorousEval, buildVersionComparison } from '@/lib/data';
import { DashboardData, RigorousEvalData, ExperimentResult, ExperimentCategory, getExperimentCategory } from '@/lib/types';

interface FindingCardProps {
  icon: React.ReactNode;
  title: string;
  value: string;
  description: string;
  positive?: boolean;
}

function FindingCard({ icon, title, value, description, positive = true }: FindingCardProps) {
  return (
    <div className="surface-panel rounded-xl p-5">
      <div className="flex items-start gap-4">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
          positive ? 'bg-hydra-corrected/20 text-hydra-corrected' : 'bg-hydra-alert/20 text-hydra-alert'
        }`}>
          {icon}
        </div>
        <div>
          <p className="text-sm text-[#8fb4cc]">{title}</p>
          <p className={`text-2xl font-display font-semibold ${
            positive ? 'text-hydra-corrected' : 'text-hydra-alert'
          }`}>
            {value}
          </p>
          <p className="mt-1 text-sm text-[#a9c2d3]">{description}</p>
        </div>
      </div>
    </div>
  );
}

/** Compute summary rows for the experiment table from real results. */
function computeExperimentSummary(
  results: ExperimentResult[],
  sites: Record<string, { name: string }>
) {
  const byExperiment: Record<string, ExperimentResult[]> = {};
  for (const r of results) {
    (byExperiment[r.experiment] ??= []).push(r);
  }

  return Object.entries(byExperiment)
    .map(([experiment, rows]) => {
      const improvements = rows
        .map((r) => r.rmse_improvement_pct ?? 0)
        .filter((v) => v !== 0);
      const avgImprovement = improvements.length
        ? improvements.reduce((a, b) => a + b, 0) / improvements.length
        : 0;
      const best = rows.reduce<ExperimentResult | null>(
        (b, r) => (!b || (r.rmse_improvement_pct ?? 0) > (b.rmse_improvement_pct ?? 0) ? r : b),
        null,
      );
      const bestSiteName = best ? (sites[best.site_id]?.name ?? best.site_id) : 'N/A';
      const bestPct = best?.rmse_improvement_pct ?? 0;
      const version: ExperimentCategory = getExperimentCategory(experiment);
      return {
        experiment,
        version,
        avgImprovement,
        bestSite: `${bestSiteName} (${bestPct.toFixed(1)}%)`,
        nSites: rows.length,
      };
    })
    .sort((a, b) => b.avgImprovement - a.avgImprovement);
}

export default function AnalysisPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [evalData, setEvalData] = useState<RigorousEvalData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchExperimentResults(), fetchRigorousEval()])
      .then(([d, e]) => { setData(d); setEvalData(e); })
      .finally(() => setLoading(false));
  }, []);

  const experimentSummary = useMemo(
    () => (data ? computeExperimentSummary(data.results, data.sites) : []),
    [data],
  );

  const versionComparison = useMemo(
    () => (data ? buildVersionComparison(data.results, data.sites) : []),
    [data],
  );

  // Key findings computed from real data
  const findings = useMemo(() => {
    if (!data) return null;
    const all = data.results;
    const bestResult = all.reduce<ExperimentResult | null>(
      (b, r) => (!b || (r.rmse_improvement_pct ?? 0) > (b.rmse_improvement_pct ?? 0) ? r : b),
      null,
    );
    const successCount = all.filter((r) => (r.rmse_improvement_pct ?? 0) > 0).length;
    const improvements = all.map((r) => r.rmse_improvement_pct ?? 0).filter(Boolean);
    const avgImprovement = improvements.length
      ? improvements.reduce((a, b) => a + b, 0) / improvements.length
      : 0;

    // Best NSE improvement at any single site
    const bestNseGain = all.reduce(
      (best, r) => {
        const gain = (r.corrected.nse ?? 0) - (r.baseline.nse ?? 0);
        return gain > best ? gain : best;
      },
      0,
    );

    const bestSiteName = bestResult
      ? data.sites[bestResult.site_id]?.name ?? bestResult.site_id
      : 'N/A';
    const bestExpName = bestResult
      ? data.experiments[bestResult.experiment]?.name ?? bestResult.experiment
      : 'N/A';

    return {
      bestRmsePct: bestResult?.rmse_improvement_pct ?? 0,
      bestLabel: `${bestExpName} @ ${bestSiteName}`,
      successRate: all.length > 0 ? (successCount / all.length) * 100 : 0,
      successCount,
      totalCount: all.length,
      avgImprovement,
      bestNseGain,
    };
  }, [data]);

  return (
    <div className="min-h-screen text-white">
      <Navigation />

      <main className="mx-auto max-w-7xl px-4 md:px-6 py-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10"
        >
          <h1 className="font-display text-4xl font-semibold">
            <span className="gradient-text">Engineering Analysis</span>
          </h1>
          <p className="mt-3 text-lg text-[#a9c2d3] max-w-3xl">
            Comprehensive evaluation of deep learning approaches for National Water Model
            streamflow error correction across Appalachian watersheds.
            {data && (
              <span className="text-hydra-corrected ml-1">
                ({data.results.length} experiment results loaded)
              </span>
            )}
          </p>
        </motion.div>

        {/* Study Region Map */}
        <section className="mb-12">
          <StudyRegionMap />
        </section>

        {/* Loading state */}
        {loading && (
          <div className="mb-12 text-center text-[#8fb4cc]">Loading experiment data...</div>
        )}

        {/* Key Findings — data-driven */}
        {findings && (
          <section className="mb-12">
            <h2 className="font-display text-sm uppercase tracking-[0.28em] text-[#8fb4cc] mb-5">
              Key Findings (Unregulated Sites)
            </h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <FindingCard
                icon={
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                }
                title="Best Result"
                value={`${findings.bestRmsePct.toFixed(1)}%`}
                description={`RMSE reduction (${findings.bestLabel})`}
                positive={true}
              />
              <FindingCard
                icon={
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                }
                title="Success Rate"
                value={`${findings.successRate.toFixed(0)}%`}
                description={`${findings.successCount}/${findings.totalCount} experiments improved`}
                positive={true}
              />
              <FindingCard
                icon={
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                }
                title="Average Improvement"
                value={`+${findings.avgImprovement.toFixed(1)}%`}
                description="Mean RMSE reduction across sites"
                positive={true}
              />
              <FindingCard
                icon={
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                }
                title="Best NSE Gain"
                value={`+${findings.bestNseGain.toFixed(3)}`}
                description="Largest single-site efficiency gain"
                positive={true}
              />
            </div>
          </section>
        )}

        {/* Cross-Site Skill Summary (from rigorous eval) */}
        {evalData && (
          <section className="mb-12">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-sm uppercase tracking-[0.28em] text-[#8fb4cc]">
                Skill Scores (SS_RMSE)
              </h2>
              <Link
                href="/evaluation"
                className="text-xs text-hydra-corrected/70 hover:text-hydra-corrected transition-colors"
              >
                Full evaluation →
              </Link>
            </div>
            <div className="surface-panel rounded-xl overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#122334]">
                  <tr>
                    <th className="text-left px-5 py-3 text-sm font-display text-[#8fb4cc]">Experiment</th>
                    <th className="text-right px-5 py-3 text-sm font-display text-[#8fb4cc]">Median SS_RMSE</th>
                    <th className="text-right px-5 py-3 text-sm font-display text-[#8fb4cc]">IQR</th>
                    <th className="text-right px-5 py-3 text-sm font-display text-[#8fb4cc]">Sig. (p&lt;0.01)</th>
                  </tr>
                </thead>
                <tbody>
                  {[...evalData.experiments]
                    .sort((a, b) => (evalData.cross_site[b]?.median_ss_rmse ?? -999) - (evalData.cross_site[a]?.median_ss_rmse ?? -999))
                    .slice(0, 8)
                    .map((exp) => {
                      const cs = evalData.cross_site[exp];
                      const name = data?.experiments[exp]?.name ?? exp;
                      return (
                        <tr key={exp} className="border-t border-[#22384b]">
                          <td className="px-5 py-3 text-white text-sm">{name}</td>
                          <td className={`px-5 py-3 text-right font-mono text-sm font-medium ${
                            (cs?.median_ss_rmse ?? 0) > 0 ? 'text-hydra-corrected' : 'text-hydra-alert'
                          }`}>
                            {cs?.median_ss_rmse != null
                              ? (cs.median_ss_rmse > 0 ? '+' : '') + (cs.median_ss_rmse * 100).toFixed(1) + '%'
                              : '--'}
                          </td>
                          <td className="px-5 py-3 text-right text-xs text-[#8fb4cc] font-mono">
                            {cs?.iqr_ss_rmse
                              ? `[${(cs.iqr_ss_rmse[0] * 100).toFixed(1)}, ${(cs.iqr_ss_rmse[1] * 100).toFixed(1)}]`
                              : '--'}
                          </td>
                          <td className="px-5 py-3 text-right text-sm text-[#8fb4cc]">
                            {cs?.sites_significant_001 ?? 0}/{cs?.n_sites ?? 0}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Version Comparison Summary */}
        {versionComparison.length > 0 && (
          <section className="mb-12">
            <h2 className="font-display text-sm uppercase tracking-[0.28em] text-[#8fb4cc] mb-5">
              Architecture Comparison: v2 vs v3
            </h2>
            <div className="surface-panel rounded-xl overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#122334]">
                  <tr>
                    <th className="text-left px-5 py-3 text-sm font-display text-[#8fb4cc]">Site</th>
                    <th className="text-left px-5 py-3 text-sm font-display text-[#8fb4cc]">Best v2</th>
                    <th className="text-left px-5 py-3 text-sm font-display text-[#8fb4cc]">v2 ΔRMSE</th>
                    <th className="text-left px-5 py-3 text-sm font-display text-[#8fb4cc]">Best v3</th>
                    <th className="text-left px-5 py-3 text-sm font-display text-[#8fb4cc]">v3 ΔRMSE</th>
                    <th className="text-left px-5 py-3 text-sm font-display text-[#8fb4cc]">Winner</th>
                  </tr>
                </thead>
                <tbody>
                  {versionComparison.map((row) => {
                    const winner = row.v3_improvement > row.v2_improvement ? 'v3' : 'v2';
                    return (
                      <tr key={row.site_id} className="border-t border-[#22384b]">
                        <td className="px-5 py-3 text-white">{row.site_name}</td>
                        <td className="px-5 py-3 text-[#a9c2d3] text-sm">{row.v2_experiment}</td>
                        <td className="px-5 py-3 font-medium text-hydra-accent">
                          +{row.v2_improvement.toFixed(1)}%
                        </td>
                        <td className="px-5 py-3 text-[#a9c2d3] text-sm">{row.v3_experiment}</td>
                        <td className="px-5 py-3 font-medium text-hydra-corrected">
                          +{row.v3_improvement.toFixed(1)}%
                        </td>
                        <td className="px-5 py-3">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            winner === 'v3'
                              ? 'bg-hydra-corrected/20 text-hydra-corrected'
                              : 'bg-hydra-accent/20 text-hydra-accent'
                          }`}>
                            {winner.toUpperCase()}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Experiment Summary Table — data-driven */}
        {experimentSummary.length > 0 && (
          <section className="mb-12">
            <h2 className="font-display text-sm uppercase tracking-[0.28em] text-[#8fb4cc] mb-5">
              Experiment Summary
            </h2>
            <div className="surface-panel rounded-xl overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#122334]">
                  <tr>
                    <th className="text-left px-5 py-3 text-sm font-display text-[#8fb4cc]">Configuration</th>
                    <th className="text-left px-5 py-3 text-sm font-display text-[#8fb4cc]">Version</th>
                    <th className="text-left px-5 py-3 text-sm font-display text-[#8fb4cc]">Avg RMSE Improvement</th>
                    <th className="text-left px-5 py-3 text-sm font-display text-[#8fb4cc]">Best Site</th>
                    <th className="text-left px-5 py-3 text-sm font-display text-[#8fb4cc]">Sites</th>
                  </tr>
                </thead>
                <tbody>
                  {experimentSummary.map((row) => (
                    <tr key={row.experiment} className="border-t border-[#22384b]">
                      <td className="px-5 py-3 text-white">
                        {data?.experiments[row.experiment]?.name ?? row.experiment}
                      </td>
                      <td className="px-5 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          row.version === 'v3'
                            ? 'bg-hydra-corrected/20 text-hydra-corrected'
                            : row.version === 'era5_only'
                              ? 'bg-hydra-era5/20 text-hydra-era5'
                              : 'bg-hydra-accent/20 text-hydra-accent'
                        }`}>
                          {row.version === 'era5_only' ? 'ERA5' : row.version.toUpperCase()}
                        </span>
                      </td>
                      <td className={`px-5 py-3 font-medium ${
                        row.avgImprovement > 0 ? 'text-hydra-corrected' : 'text-hydra-alert'
                      }`}>
                        {row.avgImprovement > 0 ? '+' : ''}{row.avgImprovement.toFixed(1)}%
                      </td>
                      <td className="px-5 py-3 text-[#a9c2d3]">{row.bestSite}</td>
                      <td className="px-5 py-3 text-[#a9c2d3]">{row.nSites}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Technical Discussion */}
        <section className="mb-12">
          <h2 className="font-display text-sm uppercase tracking-[0.28em] text-[#8fb4cc] mb-5">
            Technical Discussion
          </h2>
          <div className="surface-panel rounded-2xl p-6 space-y-6">
            <div>
              <h3 className="font-display text-lg text-white mb-2">Model Architecture Effectiveness</h3>
              <p className="text-[#a9c2d3] leading-relaxed">
                The Hydra architecture combines GRU recurrence with transformer attention mechanisms
                to capture both short-term temporal dependencies and long-range patterns in
                hydrometeorological time series. The v3 architecture adds auto-normalization,
                quantile regression, and event-focused sampling to improve robustness and
                calibration. Results indicate that the v3 combined configuration achieves the
                best overall performance.
              </p>
            </div>
            <div>
              <h3 className="font-display text-lg text-white mb-2">Physics-Informed Learning</h3>
              <p className="text-[#a9c2d3] leading-relaxed">
                The non-negativity penalty on streamflow predictions demonstrates strong performance
                across sites. In v3, physics constraints are combined with causal masking and
                event-focused sampling to enforce physical consistency while maintaining predictive
                accuracy during extreme events.
              </p>
            </div>
            <div>
              <h3 className="font-display text-lg text-white mb-2">Site-Specific Performance Patterns</h3>
              <p className="text-[#a9c2d3] leading-relaxed">
                Headwater sites with flashier responses (Sugar Grove, Jefferson) benefit from
                event-focused sampling, while mainstem sites (Galax) show strong improvement
                from causal masking due to longer response times and more predictable flow.
                The v3 auto-normalization feature helps standardize across diverse site characteristics.
              </p>
            </div>
          </div>
        </section>

        {/* Model Improvement Suggestions */}
        <section className="mb-12">
          <h2 className="font-display text-sm uppercase tracking-[0.28em] text-[#8fb4cc] mb-5">
            Future Directions
          </h2>
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="surface-panel rounded-xl p-5">
              <div className="flex items-start gap-3 mb-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-hydra-corrected/20 text-hydra-corrected">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-display text-white mb-1">Enhanced Feature Engineering</h3>
                  <p className="text-sm text-[#a9c2d3]">
                    Incorporate terrain derivatives (slope, aspect, TWI), soil moisture indices from SMAP/SMOS,
                    and snow water equivalent from SNODAS to better capture antecedent conditions.
                  </p>
                </div>
              </div>
            </div>

            <div className="surface-panel rounded-xl p-5">
              <div className="flex items-start gap-3 mb-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-hydra-accent/20 text-hydra-accent">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-display text-white mb-1">Multi-Scale Attention</h3>
                  <p className="text-sm text-[#a9c2d3]">
                    Implement hierarchical attention at hourly, daily, and weekly scales
                    to capture both rapid storm response and slower baseflow recession.
                  </p>
                </div>
              </div>
            </div>

            <div className="surface-panel rounded-xl p-5">
              <div className="flex items-start gap-3 mb-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#ec4899]/20 text-[#ec4899]">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-display text-white mb-1">Uncertainty Quantification</h3>
                  <p className="text-sm text-[#a9c2d3]">
                    Extend quantile regression with deep ensembles and conformal prediction
                    for calibrated prediction intervals during extreme events.
                  </p>
                </div>
              </div>
            </div>

            <div className="surface-panel rounded-xl p-5">
              <div className="flex items-start gap-3 mb-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#8b5cf6]/20 text-[#8b5cf6]">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-display text-white mb-1">Transfer Learning Protocol</h3>
                  <p className="text-sm text-[#a9c2d3]">
                    Pre-train on the full CAMELS dataset, then fine-tune on Appalachian sites
                    to leverage hydrologic knowledge from diverse watersheds.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
