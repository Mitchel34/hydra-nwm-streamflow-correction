'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { fetchExperimentResults, fetchTimeSeries } from '@/lib/data';
import { DashboardData, TimeSeriesPoint, getExperimentCategory } from '@/lib/types';
import { getExperimentLabels } from '@/lib/experiment-context';
import { getExperimentSourceLabel, getPublicExperimentName } from '@/lib/labels';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import MetricCard from '@/components/MetricCard';

const Hydrograph = dynamic(() => import('@/components/charts/Hydrograph'), {
  ssr: false,
  loading: () => <div className="h-96 rounded-lg bg-[#0f202f] animate-pulse" />,
});

export default function SiteDeepDive() {
  const params = useParams<{ siteId: string }>();
  const siteId = params.siteId;

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedExperiment, setSelectedExperiment] = useState<string>('');
  const [timeSeries, setTimeSeries] = useState<TimeSeriesPoint[]>([]);

  useEffect(() => {
    fetchExperimentResults()
      .then(setData)
      .finally(() => setLoading(false));
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
          <Link href="/dashboard" className="text-hydra-corrected hover:underline">
            Back to Dashboard
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
          <div className="flex items-center gap-2 text-sm text-[#8fb4cc] mb-2">
            <Link href="/dashboard" className="hover:text-white transition-colors">Dashboard</Link>
            <span>/</span>
            <span className="text-white">{siteId}</span>
          </div>
          <h1 className="font-display text-2xl gradient-text">{siteMetadata.name}</h1>
          <p className="text-sm text-[#8daec2] mt-1">
            Gauge {siteId} | {siteMetadata.watershed} watershed | {siteMetadata.type}
          </p>
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
