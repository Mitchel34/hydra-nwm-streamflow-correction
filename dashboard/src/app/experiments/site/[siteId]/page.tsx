'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { fetchExperimentResults, fetchTimeSeries, fetchRigorousEval } from '@/lib/data';
import {
  DashboardData,
  RigorousEvalData,
  TimeSeriesPoint,
  getExperimentCategory,
} from '@/lib/types';
import { getExperimentLabels } from '@/lib/experiment-context';
import { getExperimentSourceLabel, getPublicExperimentName } from '@/lib/labels';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import MetricCard from '@/components/MetricCard';
import SkillScoreCard from '@/components/SkillScoreCard';
import SignificanceBadge from '@/components/SignificanceBadge';
import JournalModeToggle from '@/components/JournalModeToggle';

const Hydrograph = dynamic(() => import('@/components/charts/Hydrograph'), {
  ssr: false,
  loading: () => <div className="h-96 rounded-lg bg-[#0f202f] animate-pulse" />,
});

const RegimeBreakdownChart = dynamic(
  () => import('@/components/charts/RegimeBreakdownChart'),
  { ssr: false },
);

const SeasonalHeatmap = dynamic(
  () => import('@/components/charts/SeasonalHeatmap'),
  { ssr: false },
);

export default function SiteDeepDive() {
  const params = useParams<{ siteId: string }>();
  const siteId = params.siteId;

  const [data, setData] = useState<DashboardData | null>(null);
  const [evalData, setEvalData] = useState<RigorousEvalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedExperiment, setSelectedExperiment] = useState<string>('');
  const [timeSeries, setTimeSeries] = useState<TimeSeriesPoint[]>([]);
  const [journalMode, setJournalMode] = useState(false);

  useEffect(() => {
    Promise.all([
      fetchExperimentResults(),
      fetchRigorousEval(),
    ]).then(([dashData, rigorousData]) => {
      setData(dashData);
      setEvalData(rigorousData);
    }).finally(() => setLoading(false));
  }, []);

  const siteResults = useMemo(() => {
    if (!data) return [];
    return data.results
      .filter((r) => r.site_id === siteId)
      .sort((a, b) => (b.rmse_improvement_pct ?? 0) - (a.rmse_improvement_pct ?? 0));
  }, [data, siteId]);

  // Auto-select best experiment
  useEffect(() => {
    if (siteResults.length > 0 && !selectedExperiment) {
      setSelectedExperiment(siteResults[0].experiment);
    }
  }, [siteResults, selectedExperiment]);

  // Fetch timeseries for selected experiment
  useEffect(() => {
    if (!selectedExperiment || !siteId) {
      setTimeSeries([]);
      return;
    }
    let active = true;
    fetchTimeSeries(selectedExperiment, siteId).then((series) => {
      if (active) setTimeSeries(series ?? []);
    });
    return () => { active = false; };
  }, [selectedExperiment, siteId]);

  const siteMetadata = data?.sites[siteId];
  const currentResult = siteResults.find((r) => r.experiment === selectedExperiment);
  const labels = getExperimentLabels(selectedExperiment);

  // Rigorous eval for selected experiment+site
  const siteEval = evalData?.results?.[selectedExperiment]?.[siteId];
  const fullPeriod = siteEval?.full_period;

  if (loading) {
    return (
      <div className="min-h-screen text-white">
        <Navigation />
        <div className="flex items-center justify-center h-[60vh]">
          <div className="animate-pulse text-[#8fb4cc]">Loading site data...</div>
        </div>
      </div>
    );
  }

  if (!data || !siteMetadata) {
    return (
      <div className="min-h-screen text-white">
        <Navigation />
        <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
          <p className="text-lg text-[#a9c2d3]">Site {siteId} not found</p>
          <Link href="/experiments" className="text-hydra-corrected hover:underline">
            Back to Experiments
          </Link>
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
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm text-[#8fb4cc] mb-2">
                <Link href="/experiments" className="hover:text-white transition-colors">Experiments</Link>
                <span>/</span>
                <span className="text-white">{siteMetadata.name}</span>
              </div>
              <h1 className="font-display text-2xl gradient-text">{siteMetadata.name}</h1>
              <p className="text-sm text-[#8daec2] mt-1">
                Gauge {siteId} | {siteMetadata.watershed} watershed | {siteMetadata.type}
              </p>
            </div>
            {evalData && (
              <JournalModeToggle enabled={journalMode} onToggle={() => setJournalMode((p) => !p)} />
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8 space-y-8">
        {/* Experiment leaderboard */}
        <section>
          <h2 className="font-display text-lg mb-4">Experiment Leaderboard</h2>
          <p className="text-sm text-[#8daec2] mb-4">
            All experiments ranked by RMSE improvement at this site.
          </p>
          <div className="surface-panel rounded-xl overflow-hidden">
            <table className="w-full">
              <thead className="bg-[#122334]">
                <tr>
                  <th className="text-left px-5 py-3 text-sm font-display text-[#8fb4cc]">#</th>
                  <th className="text-left px-5 py-3 text-sm font-display text-[#8fb4cc]">Experiment</th>
                  <th className="text-left px-5 py-3 text-sm font-display text-[#8fb4cc]">Type</th>
                  <th className="text-right px-5 py-3 text-sm font-display text-[#8fb4cc]">RMSE</th>
                  <th className="text-right px-5 py-3 text-sm font-display text-[#8fb4cc]">NSE</th>
                  <th className="text-right px-5 py-3 text-sm font-display text-[#8fb4cc]">RMSE Δ</th>
                  {journalMode && (
                    <th className="text-right px-5 py-3 text-sm font-display text-[#8fb4cc]">DM</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {siteResults.map((result, i) => {
                  const name = getPublicExperimentName(
                    result.experiment,
                    data.experiments[result.experiment]?.name,
                  );
                  const category = getExperimentCategory(result.experiment);
                  const improvement = result.rmse_improvement_pct ?? 0;
                  const isSelected = result.experiment === selectedExperiment;
                  const expEval = evalData?.results?.[result.experiment]?.[siteId]?.full_period;

                  return (
                    <tr
                      key={result.experiment}
                      onClick={() => setSelectedExperiment(result.experiment)}
                      className={`border-t border-[#22384b] cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-hydra-corrected/[0.08]'
                          : 'hover:bg-[#112233]'
                      }`}
                    >
                      <td className="px-5 py-3 text-[#8fb4cc] font-mono text-sm">{i + 1}</td>
                      <td className="px-5 py-3 text-white">{name}</td>
                      <td className="px-5 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          category === 'v3'
                            ? 'bg-hydra-corrected/20 text-hydra-corrected'
                            : category === 'era5_only'
                              ? 'bg-hydra-era5/20 text-hydra-era5'
                              : 'bg-hydra-accent/20 text-hydra-accent'
                        }`}>
                          {getExperimentSourceLabel(result.experiment)}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right font-mono text-sm text-[#c2d8e8]">
                        {(result.corrected.rmse ?? 0).toFixed(3)}
                      </td>
                      <td className="px-5 py-3 text-right font-mono text-sm text-[#c2d8e8]">
                        {(result.corrected.nse ?? 0).toFixed(3)}
                      </td>
                      <td className={`px-5 py-3 text-right font-medium ${
                        improvement > 0 ? 'text-hydra-corrected' : 'text-hydra-alert'
                      }`}>
                        {improvement > 0 ? '+' : ''}{improvement.toFixed(1)}%
                      </td>
                      {journalMode && (
                        <td className="px-5 py-3 text-right">
                          <SignificanceBadge pValue={expEval?.significance?.dm_test?.p_value} />
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Selected experiment details */}
        {currentResult && (
          <section>
            <h2 className="font-display text-lg mb-4">
              {getPublicExperimentName(
                selectedExperiment,
                data.experiments[selectedExperiment]?.name,
              )}
            </h2>
            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6 mb-6">
              <MetricCard
                label="RMSE"
                baseline={currentResult.baseline.rmse || 0}
                corrected={currentResult.corrected.rmse || 0}
                unit="m³/s"
                higherIsBetter={false}
                comparisonLabel={labels.comparisonLabel}
              />
              <MetricCard
                label="MAE"
                baseline={currentResult.baseline.mae || 0}
                corrected={currentResult.corrected.mae || 0}
                unit="m³/s"
                higherIsBetter={false}
                comparisonLabel={labels.comparisonLabel}
              />
              <MetricCard
                label="NSE"
                baseline={currentResult.baseline.nse || 0}
                corrected={currentResult.corrected.nse || 0}
                higherIsBetter={true}
                comparisonLabel={labels.comparisonLabel}
              />
              <MetricCard
                label="KGE"
                baseline={currentResult.baseline.kge || 0}
                corrected={currentResult.corrected.kge || 0}
                higherIsBetter={true}
                comparisonLabel={labels.comparisonLabel}
              />
              {currentResult.corrected.pearson_r != null && (
                <MetricCard
                  label="Pearson r"
                  baseline={currentResult.baseline.pearson_r || 0}
                  corrected={currentResult.corrected.pearson_r || 0}
                  higherIsBetter={true}
                  comparisonLabel={labels.comparisonLabel}
                />
              )}
              {currentResult.corrected.spearman_r != null && (
                <MetricCard
                  label="Spearman ρ"
                  baseline={currentResult.baseline.spearman_r || 0}
                  corrected={currentResult.corrected.spearman_r || 0}
                  higherIsBetter={true}
                  comparisonLabel={labels.comparisonLabel}
                />
              )}
            </div>
          </section>
        )}

        {/* Journal Mode: Skill Scores + Significance */}
        {journalMode && fullPeriod && (
          <section>
            <h2 className="font-display text-lg mb-4">
              Skill Scores
              <SignificanceBadge
                pValue={fullPeriod.significance?.dm_test?.p_value}
                className="ml-2"
              />
            </h2>
            <div className="grid gap-4 md:grid-cols-3 mb-6">
              <SkillScoreCard
                label="SS_RMSE"
                metric={fullPeriod.headline.ss_rmse}
                pValue={fullPeriod.significance?.dm_test?.p_value}
                description="RMSE skill score vs NWM"
              />
              <SkillScoreCard
                label="ΔNSE"
                metric={fullPeriod.headline.delta_nse}
                description="NSE improvement over NWM"
              />
              <SkillScoreCard
                label="ΔKGE"
                metric={fullPeriod.headline.delta_kge}
                description="KGE improvement over NWM"
              />
            </div>

            {/* DM test details */}
            {fullPeriod.significance?.dm_test && (
              <div className="surface-panel rounded-lg p-4 mb-6">
                <h3 className="text-sm text-[#91afc4] mb-2">Diebold-Mariano Test</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="text-[#6f8da0] text-xs">DM Statistic</div>
                    <div className="text-white font-mono">
                      {fullPeriod.significance.dm_test.dm_statistic.toFixed(3)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[#6f8da0] text-xs">p-value</div>
                    <div className="text-white font-mono">
                      {fullPeriod.significance.dm_test.p_value < 0.001
                        ? fullPeriod.significance.dm_test.p_value.toExponential(2)
                        : fullPeriod.significance.dm_test.p_value.toFixed(4)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[#6f8da0] text-xs">Significance</div>
                    <div>
                      <SignificanceBadge pValue={fullPeriod.significance.dm_test.p_value} />
                    </div>
                  </div>
                  <div>
                    <div className="text-[#6f8da0] text-xs">Hydra Better</div>
                    <div className={fullPeriod.significance.dm_test.hydra_better ? 'text-hydra-corrected' : 'text-hydra-alert'}>
                      {fullPeriod.significance.dm_test.hydra_better ? 'Yes' : 'No'}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Bias structure */}
            <div className="surface-panel rounded-lg p-4 mb-6">
              <h3 className="text-sm text-[#91afc4] mb-2">Error Structure</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="text-[#6f8da0] text-xs">PBIAS (NWM)</div>
                  <div className="text-white font-mono">{fullPeriod.error_structure.pbias_nwm.toFixed(1)}%</div>
                </div>
                <div>
                  <div className="text-[#6f8da0] text-xs">PBIAS (Hydra)</div>
                  <div className="text-white font-mono">{fullPeriod.error_structure.pbias_hydra.toFixed(1)}%</div>
                </div>
                <div>
                  <div className="text-[#6f8da0] text-xs">Δ|PBIAS|</div>
                  <div className={`font-mono ${fullPeriod.error_structure.delta_abs_pbias > 0 ? 'text-hydra-corrected' : 'text-hydra-alert'}`}>
                    {fullPeriod.error_structure.delta_abs_pbias > 0 ? '+' : ''}
                    {fullPeriod.error_structure.delta_abs_pbias.toFixed(1)}%
                  </div>
                </div>
                <div>
                  <div className="text-[#6f8da0] text-xs">Var. Reduction</div>
                  <div className={`font-mono ${(fullPeriod.distribution.ss_var_err.value ?? 0) > 0 ? 'text-hydra-corrected' : 'text-hydra-alert'}`}>
                    {((fullPeriod.distribution.ss_var_err.value ?? 0) * 100).toFixed(1)}%
                  </div>
                </div>
              </div>
            </div>

            {/* Peak timing */}
            {fullPeriod.distribution.peak_timing.n_peaks > 0 && (
              <div className="surface-panel rounded-lg p-4 mb-6">
                <h3 className="text-sm text-[#91afc4] mb-2">
                  Peak Timing ({fullPeriod.distribution.peak_timing.n_peaks} events)
                </h3>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="text-[#6f8da0] text-xs">NWM Timing Error</div>
                    <div className="text-white font-mono">
                      {fullPeriod.distribution.peak_timing.median_abs_timing_nwm_h}h
                    </div>
                  </div>
                  <div>
                    <div className="text-[#6f8da0] text-xs">Hydra Timing Error</div>
                    <div className="text-white font-mono">
                      {fullPeriod.distribution.peak_timing.median_abs_timing_hydra_h}h
                    </div>
                  </div>
                  <div>
                    <div className="text-[#6f8da0] text-xs">Improvement</div>
                    <div className={`font-mono ${(fullPeriod.distribution.peak_timing.timing_improvement_h ?? 0) > 0 ? 'text-hydra-corrected' : 'text-hydra-alert'}`}>
                      {(fullPeriod.distribution.peak_timing.timing_improvement_h ?? 0) > 0 ? '+' : ''}
                      {fullPeriod.distribution.peak_timing.timing_improvement_h}h
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {/* Journal Mode: Regime Breakdown */}
        {journalMode && fullPeriod?.regimes && (
          <section>
            <RegimeBreakdownChart regimes={fullPeriod.regimes} />
          </section>
        )}

        {/* Journal Mode: Seasonal Heatmap */}
        {journalMode && siteEval?.seasonal && (
          <section>
            <SeasonalHeatmap seasonal={siteEval.seasonal} />
          </section>
        )}

        {/* Hydrograph */}
        <section>
          <h2 className="font-display text-lg mb-4">Hydrograph</h2>
          <Hydrograph
            data={timeSeries}
            height={420}
            experimentName={data.experiments[selectedExperiment]?.name ?? selectedExperiment}
            siteName={siteMetadata.name}
            labels={labels}
          />
        </section>
      </main>

      <Footer />
    </div>
  );
}
