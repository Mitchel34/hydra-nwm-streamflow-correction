'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ErrorBar,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import { fetchEra5Sweep } from '@/lib/data';
import { Era5SweepData, Era5SweepImpactRow } from '@/lib/types';

type ImpactMetric = 'delta_rmse_vs_all' | 'delta_ss_rmse_vs_all' | 'delta_kge_vs_all' | 'delta_pbias_vs_all';

const METRIC_LABELS: Record<ImpactMetric, string> = {
  delta_rmse_vs_all: 'Delta RMSE vs all eligible',
  delta_ss_rmse_vs_all: 'Delta SS_RMSE vs all eligible',
  delta_kge_vs_all: 'Delta KGE vs all eligible',
  delta_pbias_vs_all: 'Delta PBIAS vs all eligible',
};

const METRIC_UNITS: Record<ImpactMetric, string> = {
  delta_rmse_vs_all: 'm3/s',
  delta_ss_rmse_vs_all: 'skill',
  delta_kge_vs_all: 'KGE',
  delta_pbias_vs_all: '%',
};

const SITE_COLORS: Record<string, string> = {
  '03161000': '#2be3d6',
  '03164000': '#4da0ff',
  '03479000': '#f2b46a',
};

function formatConfig(config: string): string {
  return config
    .replace(/^drop_group_/, 'Drop group: ')
    .replace(/^drop_/, 'Drop: ')
    .replace(/^group_/, 'Group: ')
    .replace(/^single_/, 'Single: ')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (s) => s.toUpperCase());
}

function formatMetricValue(value: number, metric: ImpactMetric): string {
  if (metric === 'delta_ss_rmse_vs_all') return value.toFixed(3);
  if (metric === 'delta_kge_vs_all') return value.toFixed(3);
  if (metric === 'delta_pbias_vs_all') return `${value.toFixed(1)}%`;
  return value.toFixed(2);
}

function LoadingState() {
  return (
    <div className="min-h-screen text-white">
      <Navigation />
      <main className="mx-auto flex min-h-[60vh] max-w-7xl items-center justify-center px-4">
        <div className="text-[#9fb9ca]">Loading ERA5 sweep evidence...</div>
      </main>
    </div>
  );
}

export default function Era5EvidencePage() {
  const [data, setData] = useState<Era5SweepData | null>(null);
  const [loading, setLoading] = useState(true);
  const [siteFilter, setSiteFilter] = useState('all');
  const [modeFilter, setModeFilter] = useState('drop_group');
  const [metric, setMetric] = useState<ImpactMetric>('delta_rmse_vs_all');

  useEffect(() => {
    fetchEra5Sweep()
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  const allEligible = useMemo(() => data?.headline.all_eligible ?? [], [data]);
  const reducedRows = useMemo(
    () => data?.summary.filter((row) => row.config === 'reduced_nonredundant') ?? [],
    [data],
  );
  const summaryRows = useMemo(() => {
    const reducedBySite = new Map(reducedRows.map((row) => [row.site_id, row]));
    return allEligible.map((allRow) => ({
      all: allRow,
      reduced: reducedBySite.get(allRow.site_id) ?? null,
    }));
  }, [allEligible, reducedRows]);

  const impactRows = useMemo(() => {
    if (!data) return [];
    return data.impacts
      .filter((row) => row.mode === modeFilter)
      .filter((row) => siteFilter === 'all' || row.site_id === siteFilter)
      .filter((row) => Number.isFinite(row[metric]))
      .sort((a, b) => Math.abs(b[metric]) - Math.abs(a[metric]))
      .slice(0, 12);
  }, [data, metric, modeFilter, siteFilter]);

  const topLosses = useMemo(
    () => (data?.headline.top_predictive_sensitivities ?? []).slice(0, 6),
    [data],
  );

  if (loading) return <LoadingState />;

  if (!data) {
    return (
      <div className="min-h-screen text-white">
        <Navigation />
        <main className="mx-auto max-w-4xl px-4 py-16 text-center">
          <h1 className="font-display text-3xl gradient-text">ERA5 Evidence</h1>
          <p className="mt-4 text-[#a9c2d3]">
            ERA5 sweep data were not found at <code>/data/era5_sweep.json</code>.
          </p>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white">
      <Navigation />

      <header className="border-b border-[#2a445b]/50 bg-[#071420]/50 px-4 py-10 md:px-6">
        <div className="mx-auto max-w-7xl">
          <p className="font-display text-xs uppercase tracking-[0.24em] text-hydra-era5-soft">
            Confirmatory feature sweep
          </p>
          <h1 className="mt-3 font-display text-4xl font-semibold md:text-5xl">
            <span className="gradient-text">ERA5 Evidence</span>
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-relaxed text-[#b6cddd]">
            This page shows what happened when Hydra was trained without recent gauge observations
            and only the raw National Water Model plus eligible ERA5-Land and seasonal features were
            available. The experiment tests predictive sensitivity to weather and timing variables;
            it does not prove causality.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-4">
            <div className="surface-panel rounded-xl p-4">
              <div className="font-display text-2xl text-hydra-corrected">{data.row_counts.completed_runs}</div>
              <div className="text-xs text-[#8fb4cc]">Completed training runs</div>
            </div>
            <div className="surface-panel rounded-xl p-4">
              <div className="font-display text-2xl text-hydra-corrected">{data.row_counts.summary}</div>
              <div className="text-xs text-[#8fb4cc]">Site/config summaries</div>
            </div>
            <div className="surface-panel rounded-xl p-4">
              <div className="font-display text-2xl text-hydra-corrected">3</div>
              <div className="text-xs text-[#8fb4cc]">Fixed random seeds</div>
            </div>
            <div className="surface-panel rounded-xl p-4">
              <div className="font-display text-2xl text-hydra-corrected">2019-2020</div>
              <div className="text-xs text-[#8fb4cc]">Held-out test period</div>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-12 px-4 py-10 md:px-6">
        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="surface-panel rounded-xl p-5">
            <div className="mb-4">
              <h2 className="font-display text-xl text-white">Gauge-Free Performance</h2>
              <p className="mt-1 text-sm text-[#8fb4cc]">
                All eligible ERA5-Land and seasonal features improved raw NWM at all three primary sites,
                but the gains were smaller than the gauge-informed Hydra corrections.
              </p>
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={allEligible.map((row) => ({
                  site: row.site_label,
                  site_id: row.site_id,
                  value: row.ss_rmse_mean * 100,
                  ci: row.ss_rmse_ci95_half_width * 100,
                  kge: row.kge_mean,
                  pbias: row.pbias_mean,
                }))}>
                  <CartesianGrid stroke="#1f3447" vertical={false} />
                  <XAxis dataKey="site" stroke="#8fb4cc" tick={{ fill: '#8fb4cc', fontSize: 12 }} />
                  <YAxis stroke="#8fb4cc" tick={{ fill: '#8fb4cc', fontSize: 12 }} unit="%" />
                  <Tooltip
                    contentStyle={{ background: '#071420', border: '1px solid #2a445b', borderRadius: 8 }}
                    formatter={(value, name) => {
                      const numeric = typeof value === 'number' ? value : Number(value ?? 0);
                      if (name === 'value') return [`${numeric.toFixed(1)}%`, 'RMSE reduction'];
                      return [numeric, name];
                    }}
                    labelStyle={{ color: '#e6f3fb' }}
                  />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    <ErrorBar dataKey="ci" width={4} stroke="#e6f3fb" />
                    {allEligible.map((row) => (
                      <Cell key={row.site_id} fill={SITE_COLORS[row.site_id] ?? '#2be3d6'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-2 text-xs text-[#8fb4cc]">
              Error bars show the 95% half-width reported from the three fixed sweep seeds.
            </p>
          </div>

          <div className="surface-panel rounded-xl p-5">
            <h2 className="font-display text-xl text-white">Eligible Features</h2>
            <p className="mt-2 text-sm leading-relaxed text-[#a9c2d3]">
              Confirmatory runs used only features available through the 2019-2020 test period.
              Broader meteorological fields with missing test-period coverage are not used for
              confirmatory claims.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {Object.entries(data.feature_labels).map(([key, label]) => (
                <span
                  key={key}
                  className="rounded-full border border-hydra-era5/25 bg-hydra-era5/10 px-3 py-1 text-xs text-[#f7d38b]"
                >
                  {label}
                </span>
              ))}
            </div>
            <div className="mt-5 rounded-lg border border-[#2a445b] bg-[#071420]/70 p-4">
              <h3 className="font-display text-sm uppercase tracking-[0.14em] text-hydra-corrected">
                Interpretation guardrails
              </h3>
              <ul className="mt-3 space-y-2 text-sm text-[#a9c2d3]">
                {data.guardrails.map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="surface-panel rounded-xl p-5">
          <div className="mb-4">
            <h2 className="font-display text-xl text-white">Manuscript Summary Table</h2>
            <p className="mt-1 max-w-3xl text-sm text-[#8fb4cc]">
              Native dashboard version of the Phase 4 manuscript table comparing the all-eligible
              ERA5 feature set with the reduced nonredundant set. Values are means across three
              fixed seeds.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[#8fb4cc]">
                <tr>
                  <th className="py-2 text-left">Site</th>
                  <th className="py-2 text-left">Feature set</th>
                  <th className="py-2 text-right">RMSE reduction</th>
                  <th className="py-2 text-right">KGE</th>
                  <th className="py-2 text-right">PBIAS</th>
                  <th className="py-2 text-right">Seeds</th>
                </tr>
              </thead>
              <tbody>
                {summaryRows.flatMap(({ all, reduced }) => [all, reduced].filter(Boolean)).map((row) => {
                  const typedRow = row!;
                  return (
                    <tr key={`${typedRow.site_id}-${typedRow.config}`} className="border-t border-[#1f3447]">
                      <td className="py-2 text-[#c7ddea]">{typedRow.site_label}</td>
                      <td className="py-2 text-[#c7ddea]">{typedRow.config_label}</td>
                      <td className="py-2 text-right font-mono text-hydra-corrected">
                        {(typedRow.ss_rmse_mean * 100).toFixed(1)}%
                      </td>
                      <td className="py-2 text-right font-mono text-[#c7ddea]">
                        {typedRow.kge_mean.toFixed(3)}
                      </td>
                      <td className="py-2 text-right font-mono text-[#c7ddea]">
                        {typedRow.pbias_mean.toFixed(2)}%
                      </td>
                      <td className="py-2 text-right font-mono text-[#c7ddea]">
                        {typedRow.n_seeds}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-[#8fb4cc]">
            Negative PBIAS values mean the corrected gauge-free model remains low-biased on average.
            This is why the manuscript discusses RMSE, KGE, and PBIAS together rather than using a
            single feature-importance ranking.
          </p>
        </section>

        <section className="surface-panel rounded-xl p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="font-display text-xl text-white">Feature-Removal Sensitivity</h2>
              <p className="mt-1 max-w-3xl text-sm text-[#8fb4cc]">
                Positive delta RMSE means the model became worse after removing that feature or group.
                The largest losses identify predictive sensitivity within this experiment.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="text-xs text-[#8fb4cc]">
                Site
                <select
                  value={siteFilter}
                  onChange={(e) => setSiteFilter(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#2a445b] bg-[#071420] px-3 py-2 text-sm text-white"
                >
                  <option value="all">All sites</option>
                  {Object.entries(data.sites).map(([siteId, label]) => (
                    <option key={siteId} value={siteId}>{label}</option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-[#8fb4cc]">
                Experiment type
                <select
                  value={modeFilter}
                  onChange={(e) => setModeFilter(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#2a445b] bg-[#071420] px-3 py-2 text-sm text-white"
                >
                  <option value="drop_group">Drop groups</option>
                  <option value="drop_feature">Drop features</option>
                  <option value="single_group">Single groups</option>
                  <option value="single_feature">Single features</option>
                  <option value="reduced">Reduced set</option>
                </select>
              </label>
              <label className="text-xs text-[#8fb4cc]">
                Metric
                <select
                  value={metric}
                  onChange={(e) => setMetric(e.target.value as ImpactMetric)}
                  className="mt-1 w-full rounded-lg border border-[#2a445b] bg-[#071420] px-3 py-2 text-sm text-white"
                >
                  {Object.entries(METRIC_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="mt-6 h-[420px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={impactRows.map((row) => ({
                  ...row,
                  label: `${row.site_label}: ${formatConfig(row.config)}`,
                  value: row[metric],
                }))}
                layout="vertical"
                margin={{ top: 8, right: 32, left: 18, bottom: 8 }}
              >
                <CartesianGrid stroke="#1f3447" horizontal={false} />
                <XAxis type="number" stroke="#8fb4cc" tick={{ fill: '#8fb4cc', fontSize: 12 }} />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={210}
                  stroke="#8fb4cc"
                  tick={{ fill: '#8fb4cc', fontSize: 11 }}
                />
                <Tooltip
                  contentStyle={{ background: '#071420', border: '1px solid #2a445b', borderRadius: 8 }}
                  formatter={(value) => {
                    const numeric = typeof value === 'number' ? value : Number(value ?? 0);
                    return [`${formatMetricValue(numeric, metric)} ${METRIC_UNITS[metric]}`, METRIC_LABELS[metric]];
                  }}
                  labelStyle={{ color: '#e6f3fb' }}
                />
                <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                  {impactRows.map((row) => (
                    <Cell key={`${row.site_id}-${row.config}`} fill={SITE_COLORS[row.site_id] ?? '#2be3d6'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="surface-panel rounded-xl p-5">
            <h2 className="font-display text-xl text-white">Largest Performance Losses</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-[#8fb4cc]">
                  <tr>
                    <th className="py-2 text-left">Site</th>
                    <th className="py-2 text-left">Removed</th>
                    <th className="py-2 text-right">Delta RMSE</th>
                    <th className="py-2 text-right">Delta skill</th>
                  </tr>
                </thead>
                <tbody>
                  {topLosses.map((row: Era5SweepImpactRow) => (
                    <tr key={`${row.site_id}-${row.config}`} className="border-t border-[#1f3447]">
                      <td className="py-2 text-[#c7ddea]">{row.site_label}</td>
                      <td className="py-2 text-[#c7ddea]">{formatConfig(row.config)}</td>
                      <td className="py-2 text-right font-mono text-hydra-corrected">
                        {row.delta_rmse_vs_all.toFixed(2)}
                      </td>
                      <td className="py-2 text-right font-mono text-hydra-corrected">
                        {row.delta_ss_rmse_vs_all.toFixed(3)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="surface-panel rounded-xl p-5">
            <h2 className="font-display text-xl text-white">What the Sweep Adds</h2>
            <div className="mt-3 space-y-3 text-sm leading-relaxed text-[#a9c2d3]">
              <p>
                The primary manuscript result is gauge-informed correction: recent USGS flow,
                NWM discharge, and ERA5-Land forcing together reduce RMSE much more than the
                gauge-free experiments shown here.
              </p>
              <p>
                The ERA5 sweep answers a narrower question: when gauge telemetry is removed, which
                meteorological and seasonal variables still help a Hydra correction of raw NWM?
              </p>
              <p>
                Precipitation removals create the largest losses at the New River sites, while the
                Watauga headwater site shows smaller sensitivity because raw NWM was already stronger
                there during the test period.
              </p>
            </div>
            <div className="mt-5 rounded-lg border border-[#2a445b] bg-[#071420]/70 p-4 text-xs text-[#8fb4cc]">
              Source: {data.source_artifacts.summary}; generated from the completed sweep audit on{' '}
              {new Date(data.generated_at).toLocaleDateString()}.
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
