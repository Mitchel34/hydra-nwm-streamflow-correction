'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { fetchExperimentResults, fetchRigorousEval } from '@/lib/data';
import {
  DashboardData,
  RigorousEvalData,
  RegimeKey,
  SeasonKey,
} from '@/lib/types';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import SignificanceBadge from '@/components/SignificanceBadge';

const SeasonalHeatmap = dynamic(
  () => import('@/components/charts/SeasonalHeatmap'),
  { ssr: false },
);

const SITES = ['03161000', '03164000', '03479000'];
const SITE_NAMES: Record<string, string> = {
  '03161000': 'Jefferson',
  '03164000': 'Galax',
  '03479000': 'Sugar Grove',
};

const REGIMES: { key: RegimeKey; label: string }[] = [
  { key: 'low', label: 'Low (Q10)' },
  { key: 'mid', label: 'Mid' },
  { key: 'high', label: 'High (Q90+)' },
  { key: 'rising', label: 'Rising' },
  { key: 'falling', label: 'Falling' },
];

type TabId = 'skills' | 'significance' | 'regimes' | 'seasonal' | 'timing';

const TABS: { id: TabId; label: string }[] = [
  { id: 'skills', label: 'Skill Scores' },
  { id: 'significance', label: 'Significance' },
  { id: 'regimes', label: 'Flow Regimes' },
  { id: 'seasonal', label: 'Seasonal' },
  { id: 'timing', label: 'Peak Timing' },
];

export default function EvaluationPage() {
  const [dashData, setDashData] = useState<DashboardData | null>(null);
  const [evalData, setEvalData] = useState<RigorousEvalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>('skills');
  const [exportOpen, setExportOpen] = useState(false);

  useEffect(() => {
    Promise.all([fetchExperimentResults(), fetchRigorousEval()])
      .then(([d, e]) => { setDashData(d); setEvalData(e); })
      .finally(() => setLoading(false));
  }, []);

  const sortedExperiments = useMemo(() => {
    if (!evalData) return [];
    return [...evalData.experiments].sort((a, b) => {
      const aVal = evalData.cross_site[a]?.median_ss_rmse ?? -999;
      const bVal = evalData.cross_site[b]?.median_ss_rmse ?? -999;
      return bVal - aVal;
    });
  }, [evalData]);

  const bestPerSite = useMemo(() => {
    if (!evalData) return {};
    const best: Record<string, { experiment: string; ss_rmse: number }> = {};
    for (const exp of evalData.experiments) {
      for (const site of SITES) {
        const ss = evalData.results[exp]?.[site]?.full_period?.headline?.ss_rmse?.value;
        if (ss != null && (!best[site] || ss > best[site].ss_rmse)) {
          best[site] = { experiment: exp, ss_rmse: ss };
        }
      }
    }
    return best;
  }, [evalData]);

  // Key takeaways
  const takeaways = useMemo(() => {
    if (!evalData) return null;
    let bestMedian = -Infinity;
    let bestExp = '';
    let totalSig = 0;
    let totalPairs = 0;
    for (const exp of evalData.experiments) {
      const cs = evalData.cross_site[exp];
      if (!cs) continue;
      if ((cs.median_ss_rmse ?? -Infinity) > bestMedian) {
        bestMedian = cs.median_ss_rmse ?? -Infinity;
        bestExp = exp;
      }
      totalSig += cs.sites_significant_001 ?? 0;
      totalPairs += cs.n_sites ?? 0;
    }
    // Find best high-flow improvement
    let bestHighFlow = -Infinity;
    for (const exp of evalData.experiments) {
      for (const site of SITES) {
        const hf = evalData.results[exp]?.[site]?.full_period?.regimes?.high?.ss_rmse;
        if (hf != null && hf > bestHighFlow) bestHighFlow = hf;
      }
    }
    return {
      bestMedian,
      bestExp: dashData?.experiments[bestExp]?.name ?? bestExp,
      totalSig,
      totalPairs,
      bestHighFlow,
    };
  }, [evalData, dashData]);

  const generateLatex = () => {
    if (!evalData) return;
    const lines: string[] = [
      '\\begin{table}[htbp]',
      '\\caption{Cross-site skill scores for Hydra experiments (test period 2019--2020).}',
      '\\label{tab:skill_scores}',
      '\\centering',
      `\\begin{tabular}{l${'r'.repeat(SITES.length + 1)}}`,
      '\\hline',
      `Experiment & ${SITES.map(s => SITE_NAMES[s]).join(' & ')} & Median \\\\`,
      '\\hline',
    ];
    for (const exp of sortedExperiments) {
      const cs = evalData.cross_site[exp];
      const name = dashData?.experiments[exp]?.name ?? exp;
      const vals = SITES.map(site => {
        const v = evalData.results[exp]?.[site]?.full_period?.headline?.ss_rmse?.value;
        return v != null ? v.toFixed(3) : '--';
      });
      const med = cs?.median_ss_rmse != null ? cs.median_ss_rmse.toFixed(3) : '--';
      lines.push(`${name} & ${vals.join(' & ')} & ${med} \\\\`);
    }
    lines.push('\\hline', '\\end{tabular}', '\\end{table}');
    navigator.clipboard.writeText(lines.join('\n'));
  };

  const generateCSV = () => {
    if (!evalData) return;
    const rows = ['Experiment,' + SITES.map(s => SITE_NAMES[s]).join(',') + ',Median'];
    for (const exp of sortedExperiments) {
      const cs = evalData.cross_site[exp];
      const name = dashData?.experiments[exp]?.name ?? exp;
      const vals = SITES.map(site => {
        const v = evalData.results[exp]?.[site]?.full_period?.headline?.ss_rmse?.value;
        return v != null ? v.toFixed(4) : '';
      });
      const med = cs?.median_ss_rmse != null ? cs.median_ss_rmse.toFixed(4) : '';
      rows.push(`${name},${vals.join(',')},${med}`);
    }
    navigator.clipboard.writeText(rows.join('\n'));
  };

  if (loading) {
    return (
      <div className="min-h-screen text-white">
        <Navigation />
        <div className="flex items-center justify-center h-[60vh]">
          <div className="animate-pulse text-[#8fb4cc]">Loading evaluation data...</div>
        </div>
      </div>
    );
  }

  if (!evalData) {
    return (
      <div className="min-h-screen text-white">
        <Navigation />
        <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
          <p className="text-lg text-[#a9c2d3]">Rigorous evaluation data not available.</p>
          <p className="text-sm text-[#6f8da0]">Run <code>scripts/compute_rigorous_eval.py</code> to generate.</p>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white">
      <Navigation />

      <header className="border-b border-[#2a445b]/50 bg-[#071420]/50 px-4 md:px-6 py-5">
        <div className="mx-auto max-w-7xl">
          <h1 className="font-display text-2xl gradient-text">Evaluation</h1>
          <p className="mt-2 max-w-3xl text-sm text-[#a9c2d3] leading-relaxed">
            Skill scores measure relative improvement over baseline NWM predictions.
            A positive SS_RMSE of +0.48 means Hydra reduces RMSE by 48% compared to
            uncorrected NWM. All confidence intervals computed via moving block bootstrap
            ({evalData.bootstrap.n_reps > 0 ? `${evalData.bootstrap.n_reps} reps` : 'point estimates'}, {evalData.bootstrap.block_size}h blocks).
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 md:px-6 py-8 space-y-8">
        {/* Key Takeaways */}
        {takeaways && (
          <div className="grid gap-4 md:grid-cols-3">
            <div className="surface-panel rounded-xl p-5">
              <div className="text-xs uppercase tracking-[0.15em] text-[#6f8da0] mb-2">Best Overall</div>
              <div className="font-display text-2xl font-semibold text-hydra-corrected">
                +{(takeaways.bestMedian * 100).toFixed(1)}%
              </div>
              <div className="text-sm text-[#a9c2d3] mt-1">
                Median SS_RMSE ({takeaways.bestExp})
              </div>
            </div>
            <div className="surface-panel rounded-xl p-5">
              <div className="text-xs uppercase tracking-[0.15em] text-[#6f8da0] mb-2">Statistical Significance</div>
              <div className="font-display text-2xl font-semibold text-hydra-corrected">
                {takeaways.totalSig}/{takeaways.totalPairs}
              </div>
              <div className="text-sm text-[#a9c2d3] mt-1">
                Experiment-site pairs significant at p&lt;0.001
              </div>
            </div>
            <div className="surface-panel rounded-xl p-5">
              <div className="text-xs uppercase tracking-[0.15em] text-[#6f8da0] mb-2">High-Flow Skill</div>
              <div className="font-display text-2xl font-semibold text-hydra-corrected">
                +{(takeaways.bestHighFlow * 100).toFixed(1)}%
              </div>
              <div className="text-sm text-[#a9c2d3] mt-1">
                Best SS_RMSE during Q90+ events
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 border-b border-[#2a455c]/55 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`whitespace-nowrap px-4 py-2.5 font-display text-sm tracking-wide transition-colors ${
                activeTab === tab.id
                  ? 'border-b-2 border-hydra-corrected text-white'
                  : 'text-[#8fb4cc] hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab: Skill Scores */}
        {activeTab === 'skills' && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg">Cross-Site Skill Scores</h2>
              <div className="relative">
                <button
                  onClick={() => setExportOpen(!exportOpen)}
                  className="rounded-lg border border-[#2a445b] bg-[#122334] px-3 py-1.5 text-xs text-[#8fb4cc] hover:border-hydra-corrected/50 hover:text-white transition-colors"
                >
                  Export
                  <svg className="inline ml-1 h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {exportOpen && (
                  <div className="absolute right-0 mt-1 z-10 rounded-lg border border-[#2a445b] bg-[#0a1a27] shadow-xl overflow-hidden">
                    <button
                      onClick={() => { generateLatex(); setExportOpen(false); }}
                      className="block w-full text-left px-4 py-2 text-xs text-[#c2d8e8] hover:bg-[#122334]"
                    >
                      Copy as LaTeX
                    </button>
                    <button
                      onClick={() => { generateCSV(); setExportOpen(false); }}
                      className="block w-full text-left px-4 py-2 text-xs text-[#c2d8e8] hover:bg-[#122334]"
                    >
                      Copy as CSV
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="surface-panel rounded-xl overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#122334]">
                  <tr>
                    <th className="text-left px-5 py-3 text-sm font-display text-[#8fb4cc]">#</th>
                    <th className="text-left px-5 py-3 text-sm font-display text-[#8fb4cc]">Experiment</th>
                    {SITES.map((site) => (
                      <th key={site} className="text-right px-5 py-3 text-sm font-display text-[#8fb4cc]">
                        {SITE_NAMES[site]}
                      </th>
                    ))}
                    <th className="text-right px-5 py-3 text-sm font-display text-[#8fb4cc]">Median</th>
                    <th className="text-right px-5 py-3 text-sm font-display text-[#8fb4cc]">Sig.</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedExperiments.map((exp, i) => {
                    const cs = evalData.cross_site[exp];
                    const name = dashData?.experiments[exp]?.name ?? exp;
                    return (
                      <tr key={exp} className="border-t border-[#22384b] hover:bg-[#112233]">
                        <td className="px-5 py-3 text-[#8fb4cc] font-mono text-sm">{i + 1}</td>
                        <td className="px-5 py-3 text-white text-sm">{name}</td>
                        {SITES.map((site) => {
                          const val = evalData.results[exp]?.[site]?.full_period?.headline?.ss_rmse?.value;
                          const ci = evalData.results[exp]?.[site]?.full_period?.headline?.ss_rmse?.ci;
                          const isGood = val != null && val > 0;
                          return (
                            <td
                              key={site}
                              className={`px-5 py-3 text-right font-mono text-sm ${isGood ? 'text-hydra-corrected' : 'text-hydra-alert'}`}
                              title={ci ? `95% CI: [${ci[0].toFixed(3)}, ${ci[1].toFixed(3)}]` : undefined}
                            >
                              {val != null ? (val > 0 ? '+' : '') + val.toFixed(3) : '--'}
                            </td>
                          );
                        })}
                        <td className={`px-5 py-3 text-right font-mono text-sm font-bold ${
                          (cs?.median_ss_rmse ?? 0) > 0 ? 'text-hydra-corrected' : 'text-hydra-alert'
                        }`}>
                          {cs?.median_ss_rmse != null
                            ? (cs.median_ss_rmse > 0 ? '+' : '') + cs.median_ss_rmse.toFixed(3)
                            : '--'}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <span className="text-xs text-[#8fb4cc]">
                            {cs?.sites_significant_001 ?? 0}/{cs?.n_sites ?? 0}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-[#6f8da0]">
              Hover over values to see 95% bootstrap confidence intervals. Sig. = sites significant at p&lt;0.001.
            </p>
          </section>
        )}

        {/* Tab: Significance */}
        {activeTab === 'significance' && (
          <section className="space-y-4">
            <h2 className="font-display text-lg">Diebold-Mariano Test Results</h2>
            <p className="text-sm text-[#8daec2]">
              Paired forecast accuracy test comparing squared error loss between NWM and Hydra
              predictions. Variance estimated with Newey-West HAC (bandwidth = n^(1/3)).
              Significance: *** p&lt;0.001, ** p&lt;0.01, * p&lt;0.05.
            </p>
            <div className="surface-panel rounded-xl overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#122334]">
                  <tr>
                    <th className="text-left px-5 py-3 text-sm font-display text-[#8fb4cc]">Experiment</th>
                    {SITES.map((site) => (
                      <th key={site} className="text-center px-5 py-3 text-sm font-display text-[#8fb4cc]" colSpan={2}>
                        {SITE_NAMES[site]}
                      </th>
                    ))}
                  </tr>
                  <tr className="border-t border-[#1a2d3d]">
                    <th />
                    {SITES.map((site) => (
                      <React.Fragment key={site}>
                        <th className="text-right px-3 py-2 text-xs text-[#6f8da0]">DM</th>
                        <th className="text-right px-3 py-2 text-xs text-[#6f8da0]">p</th>
                      </React.Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedExperiments.map((exp) => {
                    const name = dashData?.experiments[exp]?.name ?? exp;
                    return (
                      <tr key={exp} className="border-t border-[#22384b]">
                        <td className="px-5 py-3 text-white text-sm">{name}</td>
                        {SITES.map((site) => {
                          const dm = evalData.results[exp]?.[site]?.full_period?.significance?.dm_test;
                          return (
                            <React.Fragment key={site}>
                              <td className="px-3 py-3 text-right font-mono text-xs text-[#c2d8e8]">
                                {dm?.dm_statistic?.toFixed(2) ?? '--'}
                              </td>
                              <td className="px-3 py-3 text-right">
                                <SignificanceBadge pValue={dm?.p_value} />
                              </td>
                            </React.Fragment>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Tab: Flow Regimes */}
        {activeTab === 'regimes' && (
          <section className="space-y-4">
            <h2 className="font-display text-lg">Regime Analysis</h2>
            <p className="text-sm text-[#8daec2]">
              Performance stratified by flow regime. Q10/Q90 thresholds computed on observed discharge.
              Rising/falling determined from the sign of the hourly discharge difference.
              Positive SS_RMSE indicates Hydra outperforms NWM in that regime.
            </p>
            <div className="grid gap-6 md:grid-cols-3">
              {SITES.map((site) => {
                const best = bestPerSite[site];
                if (!best) return null;
                const regimes = evalData.results[best.experiment]?.[site]?.full_period?.regimes;
                if (!regimes) return null;
                const expName = dashData?.experiments[best.experiment]?.name ?? best.experiment;

                return (
                  <div key={site} className="surface-panel rounded-xl p-4">
                    <h3 className="text-sm text-[#91afc4] mb-1">{SITE_NAMES[site]}</h3>
                    <p className="text-xs text-[#6f8da0] mb-3">Best: {expName}</p>
                    <table className="w-full text-xs">
                      <thead>
                        <tr>
                          <th className="text-left py-1 text-[#6f8da0]">Regime</th>
                          <th className="text-right py-1 text-[#6f8da0]">SS_RMSE</th>
                          <th className="text-right py-1 text-[#6f8da0]">n</th>
                        </tr>
                      </thead>
                      <tbody>
                        {REGIMES.map(({ key, label }) => {
                          const r = regimes[key];
                          if (!r || r.insufficient) return null;
                          const ss = r.ss_rmse;
                          return (
                            <tr key={key} className="border-t border-[#1a2d3d]">
                              <td className="py-1.5 text-[#a9c2d3]">{label}</td>
                              <td className={`py-1.5 text-right font-mono ${
                                (ss ?? 0) > 0 ? 'text-hydra-corrected' : 'text-hydra-alert'
                              }`}>
                                {ss != null ? ((ss > 0 ? '+' : '') + (ss * 100).toFixed(1) + '%') : '--'}
                              </td>
                              <td className="py-1.5 text-right text-[#6f8da0]">{r.n_samples}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Tab: Seasonal */}
        {activeTab === 'seasonal' && (
          <section className="space-y-4">
            <h2 className="font-display text-lg">Seasonal Performance</h2>
            <p className="text-sm text-[#8daec2]">
              Skill scores broken down by meteorological season (DJF = Dec-Feb, MAM = Mar-May,
              JJA = Jun-Aug, SON = Sep-Nov). Shows best experiment per site.
            </p>
            <div className="grid gap-6 md:grid-cols-1">
              {SITES.map((site) => {
                const best = bestPerSite[site];
                if (!best) return null;
                const siteEval = evalData.results[best.experiment]?.[site];
                if (!siteEval?.seasonal) return null;
                const expName = dashData?.experiments[best.experiment]?.name ?? best.experiment;

                return (
                  <div key={site}>
                    <SeasonalHeatmap
                      seasonal={siteEval.seasonal}
                      title={`${SITE_NAMES[site]} — ${expName}`}
                    />
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Tab: Peak Timing */}
        {activeTab === 'timing' && (
          <section className="space-y-4">
            <h2 className="font-display text-lg">Peak Timing Analysis</h2>
            <p className="text-sm text-[#8daec2]">
              Peak events identified using scipy find_peaks on observed discharge (Q90+ threshold,
              24h minimum separation). Timing error = hours between predicted and observed peak.
            </p>
            <div className="surface-panel rounded-xl overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#122334]">
                  <tr>
                    <th className="text-left px-5 py-3 text-sm font-display text-[#8fb4cc]">Site</th>
                    <th className="text-left px-5 py-3 text-sm font-display text-[#8fb4cc]">Experiment</th>
                    <th className="text-right px-5 py-3 text-sm font-display text-[#8fb4cc]">Peaks</th>
                    <th className="text-right px-5 py-3 text-sm font-display text-[#8fb4cc]">NWM Error</th>
                    <th className="text-right px-5 py-3 text-sm font-display text-[#8fb4cc]">Hydra Error</th>
                    <th className="text-right px-5 py-3 text-sm font-display text-[#8fb4cc]">Improvement</th>
                  </tr>
                </thead>
                <tbody>
                  {SITES.map((site) => {
                    const best = bestPerSite[site];
                    if (!best) return null;
                    const pt = evalData.results[best.experiment]?.[site]?.full_period?.distribution?.peak_timing;
                    if (!pt || pt.n_peaks === 0) return null;
                    const expName = dashData?.experiments[best.experiment]?.name ?? best.experiment;

                    return (
                      <tr key={site} className="border-t border-[#22384b]">
                        <td className="px-5 py-3 text-white">{SITE_NAMES[site]}</td>
                        <td className="px-5 py-3 text-[#a9c2d3] text-sm">{expName}</td>
                        <td className="px-5 py-3 text-right font-mono text-sm text-[#c2d8e8]">{pt.n_peaks}</td>
                        <td className="px-5 py-3 text-right font-mono text-sm text-[#c2d8e8]">
                          {pt.median_abs_timing_nwm_h}h
                        </td>
                        <td className="px-5 py-3 text-right font-mono text-sm text-[#c2d8e8]">
                          {pt.median_abs_timing_hydra_h}h
                        </td>
                        <td className={`px-5 py-3 text-right font-mono text-sm ${
                          (pt.timing_improvement_h ?? 0) > 0 ? 'text-hydra-corrected' : 'text-hydra-alert'
                        }`}>
                          {(pt.timing_improvement_h ?? 0) > 0 ? '+' : ''}{pt.timing_improvement_h}h
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Back link + provenance */}
        <div className="flex items-center justify-between border-t border-[#22384b] pt-6">
          <Link
            href="/experiments"
            className="text-sm text-hydra-corrected/70 hover:text-hydra-corrected transition-colors"
          >
            ← Explore individual experiments
          </Link>
          <div className="text-xs text-[#6f8da0] text-right">
            <p>Generated: {evalData.generated_at}</p>
            <p>
              {evalData.experiments.length} experiments, {evalData.sites.length} sites,{' '}
              {evalData.bootstrap.n_reps > 0
                ? `${evalData.bootstrap.n_reps} bootstrap replicates`
                : 'point estimates only'}
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
