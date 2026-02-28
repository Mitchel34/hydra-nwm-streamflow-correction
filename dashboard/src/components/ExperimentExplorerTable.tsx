'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { ExperimentResult, ExperimentMetadata, SiteMetadata } from '@/lib/types';

/* ---------- Constants ---------- */

const HIDDEN = new Set([
  'gru_transformer_v2_nwm_era5_tuned',
  'gru_transformer_v2_direct',
  'hydra_v3_full_autonorm',
]);

const NOWCASTING = new Set(['hydra_v3_usgs_nwm_era5', 'hydra_v3_usgs_era5']);

const PREFERRED_ORDER = [
  'hydra_v3_usgs_nwm_era5',
  'hydra_v3_usgs_era5',
  'hydra_v3_causal_nonneg',
  'hydra_v3_nwm_era5',
  'hydra_v3_causal_nonneg_event',
  'hydra_v3_event_oversample',
  'hydra_v3_nonneg',
  'hydra_v3_causal',
  'hydra_v3_era5_only',
  'gru_era5_only',
  'gru_transformer_v2_causal_nonneg',
  'gru_transformer_v2_nwm_era5',
  'gru_transformer_v2_nonneg',
  'gru_transformer_v2_causal',
  'transformer_nwm_era5',
  'lstm_nwm_era5',
];

const SITE_SHORT: Record<string, string> = {
  '03161000': 'Jefferson',
  '03164000': 'Galax',
  '03479000': 'Sugar Grove',
};

/* ---------- Helpers ---------- */

function getArch(id: string): string {
  if (id === 'lstm_nwm_era5' || id === 'transformer_nwm_era5') return 'v1';
  if (id.startsWith('hydra_v3')) return 'v3';
  return 'v2';
}

function getArchLabel(id: string): string {
  const arch = getArch(id);
  if (arch === 'v3') return 'v3 Hybrid GRU-Transformer';
  if (arch === 'v2') return 'v2 GRU-Transformer';
  return 'v1 Transformer-Only';
}

function getInputLabel(id: string): string {
  if (id.includes('usgs_nwm') || id.includes('usgs_nwm_era5')) return 'NWM + ERA5 + USGS';
  if (id.includes('usgs_era5') && !id.includes('nwm')) return 'ERA5 + USGS';
  if (id.includes('era5_only')) return 'ERA5 only';
  return 'NWM + ERA5';
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/* ---------- Types ---------- */

interface ExperimentStat {
  id: string;
  name: string;
  type: 'nowcasting' | 'ablation';
  arch: string;
  inputs: string;
  medianRmse: number;
  medianDeltaNse: number;
  hasResults: boolean;
  siteResults: ExperimentResult[];
}

interface Props {
  experiments: Record<string, ExperimentMetadata>;
  results: ExperimentResult[];
  sites: Record<string, SiteMetadata>;
}

/* ---------- Component ---------- */

export default function ExperimentExplorerTable({ experiments, results }: Props) {
  const [filterType, setFilterType] = useState<'all' | 'ablation' | 'nowcasting'>('all');
  const [sortKey, setSortKey] = useState<'default' | 'rmse' | 'nse'>('rmse');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const stats = useMemo<ExperimentStat[]>(() => {
    return Object.entries(experiments)
      .filter(([id]) => !HIDDEN.has(id))
      .map(([id, meta]) => {
        const expResults = results.filter((r) => r.experiment === id);
        const rmseVals = expResults
          .map((r) => r.rmse_improvement_pct ?? 0)
          .filter(Number.isFinite);
        const deltaNseVals = expResults
          .map((r) => (r.corrected.nse ?? 0) - (r.baseline.nse ?? 0))
          .filter(Number.isFinite);
        return {
          id,
          name: meta.name,
          type: NOWCASTING.has(id) ? 'nowcasting' : 'ablation',
          arch: getArch(id),
          inputs: getInputLabel(id),
          medianRmse: median(rmseVals),
          medianDeltaNse: median(deltaNseVals),
          hasResults: expResults.length > 0,
          siteResults: expResults,
        };
      });
  }, [experiments, results]);

  const nowcastingCount = useMemo(() => stats.filter((s) => s.type === 'nowcasting').length, [stats]);
  const ablationCount = useMemo(() => stats.filter((s) => s.type === 'ablation').length, [stats]);

  const visible = useMemo(() => {
    let filtered = stats;
    if (filterType !== 'all') {
      filtered = stats.filter((s) => s.type === filterType);
    }
    if (sortKey === 'rmse') {
      return [...filtered].sort((a, b) => b.medianRmse - a.medianRmse);
    }
    if (sortKey === 'nse') {
      return [...filtered].sort((a, b) => b.medianDeltaNse - a.medianDeltaNse);
    }
    return [...filtered].sort((a, b) => {
      const ai = PREFERRED_ORDER.indexOf(a.id);
      const bi = PREFERRED_ORDER.indexOf(b.id);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });
  }, [stats, filterType, sortKey]);

  return (
    <div>
      {/* Filter + Sort bar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-lg border border-[#2a445b] bg-[#0a1822] p-1">
          {(['all', 'ablation', 'nowcasting'] as const).map((f) => {
            const labels = {
              all: `All (${stats.length})`,
              ablation: `Input Ablation (${ablationCount})`,
              nowcasting: `Nowcasting (${nowcastingCount})`,
            };
            return (
              <button
                key={f}
                type="button"
                onClick={() => setFilterType(f)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  filterType === f
                    ? 'bg-hydra-accent/20 text-hydra-accent border border-hydra-accent/30'
                    : 'text-[#7a9db8] hover:text-white'
                }`}
              >
                {labels[f]}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 text-xs text-[#7a9db8]">
          <span>Sort by</span>
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as typeof sortKey)}
            className="rounded border border-[#2a445b] bg-[#0a1822] px-2 py-1.5 text-white focus:outline-none focus:border-hydra-accent/50"
          >
            <option value="rmse">Median ΔRMSE ↓</option>
            <option value="nse">Median ΔNSE ↑</option>
            <option value="default">Default order</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-[#2a445b] overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[minmax(0,1fr)_80px_80px] sm:grid-cols-[minmax(0,3fr)_auto_auto_80px_80px] items-center gap-3 border-b border-[#2a445b] bg-[#071420] px-4 py-2.5 text-xs font-medium uppercase tracking-[0.09em] text-[#6a8fa6]">
          <span>Experiment</span>
          <span className="hidden sm:block text-center">Type</span>
          <span className="hidden sm:block">Inputs</span>
          <span className="text-right">ΔRMSE</span>
          <span className="text-right">ΔNSE</span>
        </div>

        {visible.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-[#6a8fa6]">
            No experiments match the current filter.
          </div>
        )}

        {visible.map((stat) => {
          const isExpanded = expandedId === stat.id;
          const rmsePos = stat.medianRmse > 0;
          const nsePos = stat.medianDeltaNse > 0;

          return (
            <div key={stat.id}>
              {/* Main row */}
              <button
                type="button"
                onClick={() => setExpandedId(isExpanded ? null : stat.id)}
                className={`w-full text-left grid grid-cols-[minmax(0,1fr)_80px_80px] sm:grid-cols-[minmax(0,3fr)_auto_auto_80px_80px] items-center gap-3 px-4 py-3.5 border-b border-[#1a3045] transition-colors ${
                  isExpanded
                    ? 'bg-[#0d2236] border-l-[3px] border-l-hydra-accent'
                    : 'hover:bg-[#0a1d2e] border-l-[3px] border-l-transparent'
                } ${!stat.hasResults ? 'opacity-40 cursor-default' : 'cursor-pointer'}`}
                disabled={!stat.hasResults}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-sm font-medium truncate ${isExpanded ? 'text-white' : 'text-[#d0e8f5]'}`}>
                      {stat.name}
                    </span>
                    {stat.type === 'nowcasting' && (
                      <span className="shrink-0 rounded-full border border-hydra-corrected/40 bg-hydra-corrected/10 px-1.5 py-0.5 text-[10px] font-medium text-hydra-corrected">
                        Nowcasting
                      </span>
                    )}
                    {!stat.hasResults && (
                      <span className="shrink-0 text-[10px] text-[#6a8fa6]">Pending</span>
                    )}
                  </div>
                  <div className="text-xs text-[#4a6a80] mt-0.5 sm:hidden">
                    {stat.arch} · {stat.inputs}
                  </div>
                </div>

                <span className="hidden sm:flex justify-center">
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${
                    stat.type === 'nowcasting'
                      ? 'border-hydra-corrected/30 text-hydra-corrected bg-hydra-corrected/10'
                      : 'border-hydra-accent/30 text-[#6ab3d0] bg-hydra-accent/10'
                  }`}>
                    {stat.arch}
                  </span>
                </span>

                <span className="hidden sm:block text-xs text-[#6a8fa6] truncate">
                  {stat.inputs}
                </span>

                <span className={`text-right text-sm font-semibold tabular-nums ${
                  stat.hasResults
                    ? rmsePos ? 'text-emerald-400' : 'text-rose-400'
                    : 'text-[#4a6a80]'
                }`}>
                  {stat.hasResults
                    ? `${rmsePos ? '+' : ''}${stat.medianRmse.toFixed(1)}%`
                    : '—'}
                </span>

                <span className={`text-right text-sm font-semibold tabular-nums ${
                  stat.hasResults
                    ? nsePos ? 'text-sky-400' : 'text-rose-400'
                    : 'text-[#4a6a80]'
                }`}>
                  {stat.hasResults
                    ? `${nsePos ? '+' : ''}${stat.medianDeltaNse.toFixed(3)}`
                    : '—'}
                </span>
              </button>

              {/* Expanding detail panel */}
              <div
                className={`overflow-hidden transition-all duration-300 ease-in-out ${
                  isExpanded ? 'max-h-[700px] opacity-100' : 'max-h-0 opacity-0'
                }`}
              >
                <div className="border-b border-[#1a3045] bg-[#061320] px-6 py-5">
                  <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
                    {/* Left: configuration */}
                    <div>
                      <h4 className="text-xs font-medium uppercase tracking-[0.12em] text-[#5a8099] mb-3">
                        Configuration
                      </h4>
                      <div className="flex flex-wrap gap-2 mb-4">
                        {[
                          { label: 'Architecture', value: getArchLabel(stat.id) },
                          { label: 'Inputs', value: stat.inputs },
                          {
                            label: 'Type',
                            value: stat.type === 'nowcasting'
                              ? 'Nowcasting (lagged observations)'
                              : 'Input Ablation',
                          },
                        ].map(({ label, value }) => (
                          <div key={label} className="rounded-lg border border-[#1f3a52] bg-[#0a1e30] px-3 py-2">
                            <div className="text-[10px] text-[#4a7590] uppercase tracking-[0.1em]">{label}</div>
                            <div className="text-xs text-white mt-0.5">{value}</div>
                          </div>
                        ))}
                      </div>
                      {experiments[stat.id]?.description && (
                        <p className="text-xs text-[#6a8fa6] leading-relaxed">
                          {experiments[stat.id].description}
                        </p>
                      )}
                    </div>

                    {/* Right: per-site results */}
                    <div>
                      <h4 className="text-xs font-medium uppercase tracking-[0.12em] text-[#5a8099] mb-3">
                        Site Breakdown
                      </h4>
                      <div className="space-y-2">
                        {stat.siteResults.map((r) => {
                          const shortName = SITE_SHORT[r.site_id] ?? r.site_id;
                          const rmsePct = r.rmse_improvement_pct ?? 0;
                          const nseCorrected = r.corrected.nse ?? 0;
                          const rmseImproved = rmsePct > 0;
                          return (
                            <div
                              key={r.site_id}
                              className="flex items-center justify-between rounded-lg border border-[#1f3a52] bg-[#0a1e30] px-4 py-3"
                            >
                              <div>
                                <div className="text-sm font-medium text-white">{shortName}</div>
                                <div className="text-xs text-[#4a7080] font-mono mt-0.5">{r.site_id}</div>
                              </div>
                              <div className="flex items-center gap-4">
                                <div className="text-right">
                                  <div className={`text-sm font-semibold tabular-nums ${rmseImproved ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {rmseImproved ? '↓' : '↑'}{Math.abs(rmsePct).toFixed(1)}% RMSE
                                  </div>
                                  <div className="text-xs text-[#4a7080] mt-0.5">
                                    NSE {nseCorrected.toFixed(3)}
                                  </div>
                                </div>
                                <Link
                                  href={`/experiments/site/${r.site_id}`}
                                  className="rounded-md border border-hydra-accent/40 bg-hydra-accent/10 px-2.5 py-1.5 text-xs text-[#6ab3d0] hover:bg-hydra-accent/20 hover:text-white transition-colors whitespace-nowrap"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  Deep Dive →
                                </Link>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
