'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { fetchExperimentResults, fetchRigorousEval } from '@/lib/data';
import {
  DashboardData,
  RigorousEvalData,
  RegimeKey,
} from '@/lib/types';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import SignificanceBadge from '@/components/SignificanceBadge';

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

export default function EvaluationPage() {
  const [dashData, setDashData] = useState<DashboardData | null>(null);
  const [evalData, setEvalData] = useState<RigorousEvalData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchExperimentResults(), fetchRigorousEval()])
      .then(([d, e]) => { setDashData(d); setEvalData(e); })
      .finally(() => setLoading(false));
  }, []);

  // Sort experiments by median SS_RMSE
  const sortedExperiments = useMemo(() => {
    if (!evalData) return [];
    return [...evalData.experiments].sort((a, b) => {
      const aVal = evalData.cross_site[a]?.median_ss_rmse ?? -999;
      const bVal = evalData.cross_site[b]?.median_ss_rmse ?? -999;
      return bVal - aVal;
    });
  }, [evalData]);

  // Find best experiment per site
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

      <header className="border-b border-[#2a445b]/50 bg-[#071420]/50 px-6 py-4">
        <div className="mx-auto max-w-7xl">
          <h1 className="font-display text-2xl gradient-text">Rigorous Evaluation</h1>
          <p className="text-sm text-[#8daec2] mt-1">
            Journal-quality skill scores, significance tests, and regime analysis across all experiments.
          </p>
          {evalData.bootstrap.n_reps > 0 && (
            <p className="text-xs text-[#6f8da0] mt-1">
              Bootstrap: {evalData.bootstrap.n_reps} reps, {evalData.bootstrap.block_size}h blocks,{' '}
              {(evalData.bootstrap.ci_level * 100).toFixed(0)}% CI
            </p>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8 space-y-10">
        {/* Cross-site skill score table */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg">Cross-Site Skill Scores</h2>
            <button
              onClick={generateLatex}
              className="rounded-lg border border-[#2a445b] bg-[#122334] px-3 py-1.5 text-xs text-[#8fb4cc] hover:border-hydra-corrected/50 hover:text-white transition-colors"
            >
              Copy LaTeX
            </button>
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
                        const isGood = val != null && val > 0;
                        return (
                          <td key={site} className={`px-5 py-3 text-right font-mono text-sm ${isGood ? 'text-hydra-corrected' : 'text-hydra-alert'}`}>
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
                          {cs?.sites_significant_001 ?? 0}/{(cs?.n_sites ?? 0)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* DM Test Results */}
        <section>
          <h2 className="font-display text-lg mb-4">Diebold-Mariano Test Results</h2>
          <p className="text-sm text-[#8daec2] mb-4">
            Paired forecast accuracy test (squared error loss, Newey-West HAC variance).
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
                {sortedExperiments.slice(0, 10).map((exp) => {
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

        {/* Regime breakdown for best experiment per site */}
        <section>
          <h2 className="font-display text-lg mb-4">Regime Analysis (Best Experiment per Site)</h2>
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
                  <p className="text-xs text-[#6f8da0] mb-3">{expName}</p>
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

        {/* Peak timing summary */}
        <section>
          <h2 className="font-display text-lg mb-4">Peak Timing Analysis</h2>
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

        {/* Provenance */}
        <section className="text-xs text-[#6f8da0] border-t border-[#22384b] pt-6">
          <p>Generated: {evalData.generated_at}</p>
          <p>
            {evalData.experiments.length} experiments, {evalData.sites.length} sites,{' '}
            {evalData.bootstrap.n_reps > 0
              ? `${evalData.bootstrap.n_reps} bootstrap replicates`
              : 'no bootstrap (point estimates only)'}
          </p>
        </section>
      </main>

      <Footer />
    </div>
  );
}
