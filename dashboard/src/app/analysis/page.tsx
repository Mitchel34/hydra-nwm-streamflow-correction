'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import { fetchEra5Sweep, fetchExperimentResults, fetchRigorousEval } from '@/lib/data';
import { DashboardData, Era5SweepData, RigorousEvalData } from '@/lib/types';

const PRIMARY_EXPERIMENT = 'hydra_v3_usgs_nwm_era5';
const NO_NWM_EXPERIMENT = 'hydra_v3_usgs_era5';
const GAUGE_FREE_EXPERIMENT = 'hydra_v3_nwm_era5';

const SITE_SHORT: Record<string, string> = {
  '03161000': 'Jefferson',
  '03164000': 'Galax',
  '03479000': 'Sugar Grove',
};

function formatPct(value: number): string {
  return `${value.toFixed(1)}%`;
}

function range(values: number[]): { min: number; max: number } | null {
  const finite = values.filter(Number.isFinite);
  if (finite.length === 0) return null;
  return { min: Math.min(...finite), max: Math.max(...finite) };
}

export default function FindingsPage() {
  const [dashData, setDashData] = useState<DashboardData | null>(null);
  const [evalData, setEvalData] = useState<RigorousEvalData | null>(null);
  const [era5Data, setEra5Data] = useState<Era5SweepData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchExperimentResults(), fetchRigorousEval(), fetchEra5Sweep()])
      .then(([dashboard, rigorous, era5]) => {
        setDashData(dashboard);
        setEvalData(rigorous);
        setEra5Data(era5);
      })
      .finally(() => setLoading(false));
  }, []);

  const primaryRows = useMemo(
    () => dashData?.results.filter((row) => row.experiment === PRIMARY_EXPERIMENT) ?? [],
    [dashData],
  );

  const ablationRows = useMemo(() => {
    if (!dashData) return [];
    return Object.keys(dashData.sites).map((siteId) => {
      const primary = dashData.results.find((row) => row.site_id === siteId && row.experiment === PRIMARY_EXPERIMENT);
      const noNwm = dashData.results.find((row) => row.site_id === siteId && row.experiment === NO_NWM_EXPERIMENT);
      const gaugeFree = dashData.results.find((row) => row.site_id === siteId && row.experiment === GAUGE_FREE_EXPERIMENT);
      return {
        siteId,
        site: SITE_SHORT[siteId] ?? siteId,
        primary: primary?.rmse_improvement_pct ?? null,
        noNwm: noNwm?.rmse_improvement_pct ?? null,
        gaugeFree: gaugeFree?.rmse_improvement_pct ?? null,
        nwmAddOn:
          primary?.rmse_improvement_pct != null && noNwm?.rmse_improvement_pct != null
            ? primary.rmse_improvement_pct - noNwm.rmse_improvement_pct
            : null,
      };
    });
  }, [dashData]);

  const primaryRange = range(primaryRows.map((row) => row.rmse_improvement_pct ?? NaN));
  const nwmAddOnRange = range(ablationRows.map((row) => row.nwmAddOn ?? NaN));
  const primarySignificance = evalData?.cross_site[PRIMARY_EXPERIMENT];
  const allEligibleEra5 = era5Data?.headline.all_eligible ?? [];
  const era5Range = range(allEligibleEra5.map((row) => row.ss_rmse_mean * 100));

  return (
    <div className="min-h-screen text-white">
      <Navigation />

      <header className="border-b border-[#2a445b]/50 bg-[#071420]/50 px-4 py-10 md:px-6">
        <div className="mx-auto max-w-7xl">
          <p className="font-display text-xs uppercase tracking-[0.24em] text-hydra-corrected">
            Evidence summary
          </p>
          <h1 className="mt-3 font-display text-4xl font-semibold md:text-5xl">
            <span className="gradient-text">Findings</span>
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-relaxed text-[#b6cddd]">
            Hydra is evaluated as a local correction to raw National Water Model streamflow.
            The strongest result uses recent gauge observations, NWM discharge, and ERA5-Land
            context; the ERA5 sweep tests what remains when gauge observations are removed.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-12 px-4 py-10 md:px-6">
        {loading && (
          <div className="surface-panel rounded-xl p-8 text-center text-[#9fb9ca]">
            Loading evidence...
          </div>
        )}

        {!loading && (
          <>
            <section className="grid gap-4 md:grid-cols-4">
              <div className="surface-panel rounded-xl p-5">
                <div className="font-display text-3xl text-hydra-corrected">
                  {primaryRange ? `${formatPct(primaryRange.min)}-${formatPct(primaryRange.max)}` : '--'}
                </div>
                <div className="mt-2 text-sm text-white">Primary RMSE reduction</div>
                <p className="mt-1 text-xs text-[#8fb4cc]">Gauge-informed Hydra vs raw NWM.</p>
              </div>
              <div className="surface-panel rounded-xl p-5">
                <div className="font-display text-3xl text-hydra-corrected">
                  {nwmAddOnRange ? `${formatPct(nwmAddOnRange.min)}-${formatPct(nwmAddOnRange.max)}` : '--'}
                </div>
                <div className="mt-2 text-sm text-white">NWM add-on beyond gauge + ERA5</div>
                <p className="mt-1 text-xs text-[#8fb4cc]">Input-source attribution, not causality.</p>
              </div>
              <div className="surface-panel rounded-xl p-5">
                <div className="font-display text-3xl text-hydra-corrected">
                  {era5Range ? `${formatPct(era5Range.min)}-${formatPct(era5Range.max)}` : '--'}
                </div>
                <div className="mt-2 text-sm text-white">Gauge-free ERA5 sweep gain</div>
                <p className="mt-1 text-xs text-[#8fb4cc]">All eligible NWM-plus-ERA5 features.</p>
              </div>
              <div className="surface-panel rounded-xl p-5">
                <div className="font-display text-3xl text-hydra-corrected">
                  {primarySignificance ? `${primarySignificance.sites_significant_001}/${primarySignificance.n_sites}` : '--'}
                </div>
                <div className="mt-2 text-sm text-white">Sites significant vs raw NWM</div>
                <p className="mt-1 text-xs text-[#8fb4cc]">This does not compare against persistence.</p>
              </div>
            </section>

            <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="surface-panel rounded-xl p-6">
                <h2 className="font-display text-xl text-white">Main Interpretation</h2>
                <div className="mt-4 space-y-4 text-sm leading-relaxed text-[#a9c2d3]">
                  <p>
                    Recent USGS observations provide the clearest estimate of the current river state
                    at a one-hour horizon. That is why the gauge-informed configuration is much stronger
                    than gauge-free NWM-plus-ERA5 variants.
                  </p>
                  <p>
                    NWM still matters. Removing NWM from the gauge-informed input set lowers skill,
                    which indicates that the raw model carries routed basin-scale information beyond
                    local gauge history and meteorological forcing.
                  </p>
                  <p>
                    ERA5-Land provides useful meteorological and seasonal context, but the completed
                    feature sweep shows smaller and more site-dependent improvements when gauge
                    telemetry is unavailable.
                  </p>
                </div>
              </div>

              <div className="surface-panel rounded-xl p-6">
                <h2 className="font-display text-xl text-white">Input-Source Attribution</h2>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-[#8fb4cc]">
                      <tr>
                        <th className="py-2 text-left">Site</th>
                        <th className="py-2 text-right">Gauge + NWM + ERA5</th>
                        <th className="py-2 text-right">Gauge + ERA5</th>
                        <th className="py-2 text-right">NWM + ERA5</th>
                        <th className="py-2 text-right">NWM add-on</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ablationRows.map((row) => (
                        <tr key={row.siteId} className="border-t border-[#1f3447]">
                          <td className="py-2 text-[#c7ddea]">{row.site}</td>
                          <td className="py-2 text-right font-mono text-hydra-corrected">
                            {row.primary != null ? formatPct(row.primary) : '--'}
                          </td>
                          <td className="py-2 text-right font-mono text-[#c7ddea]">
                            {row.noNwm != null ? formatPct(row.noNwm) : '--'}
                          </td>
                          <td className="py-2 text-right font-mono text-[#c7ddea]">
                            {row.gaugeFree != null ? formatPct(row.gaugeFree) : '--'}
                          </td>
                          <td className="py-2 text-right font-mono text-hydra-corrected">
                            {row.nwmAddOn != null ? formatPct(row.nwmAddOn) : '--'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            <section className="grid gap-6 lg:grid-cols-3">
              <div className="surface-panel rounded-xl p-6 lg:col-span-2">
                <h2 className="font-display text-xl text-white">ERA5 Feature Sweep</h2>
                <p className="mt-3 text-sm leading-relaxed text-[#a9c2d3]">
                  The completed 216-run ERA5 sweep evaluates all-eligible, reduced, single-feature,
                  drop-feature, single-group, and drop-group configurations across three fixed seeds.
                  The largest losses occur when precipitation is removed at the New River sites,
                  making precipitation the clearest confirmatory predictive sensitivity in this
                  gauge-free experiment.
                </p>
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  {allEligibleEra5.map((row) => (
                    <div key={row.site_id} className="rounded-xl border border-[#2a445b] bg-[#071420]/70 p-4">
                      <div className="text-sm text-[#8fb4cc]">{row.site_label}</div>
                      <div className="mt-1 font-display text-2xl text-hydra-corrected">
                        {formatPct(row.ss_rmse_mean * 100)}
                      </div>
                      <div className="text-xs text-[#8fb4cc]">RMSE reduction, all eligible features</div>
                    </div>
                  ))}
                </div>
                <Link href="/era5" className="mt-5 inline-flex text-sm text-hydra-corrected hover:underline">
                  Explore the interactive ERA5 sweep →
                </Link>
              </div>

              <div className="surface-panel rounded-xl p-6">
                <h2 className="font-display text-xl text-white">Scope and Limits</h2>
                <div className="mt-3 space-y-3 text-sm leading-relaxed text-[#a9c2d3]">
                  <p>Results are centered on three unregulated southern Appalachian gauges.</p>
                  <p>One-hour flow persistence remains a strong point-prediction baseline.</p>
                  <p>Regulated river behavior requires operations-aware inputs not included here.</p>
                  <p>Feature-removal losses are predictive sensitivities, not causal proof.</p>
                </div>
              </div>
            </section>

            <section className="surface-panel rounded-xl p-6">
              <h2 className="font-display text-xl text-white">Evidence Paths</h2>
              <div className="mt-3 grid gap-3 text-xs text-[#8fb4cc] md:grid-cols-3">
                <code>dashboard/public/data/experiment_results.json</code>
                <code>dashboard/public/data/rigorous_eval.json</code>
                <code>dashboard/public/data/era5_sweep.json</code>
              </div>
            </section>
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}
