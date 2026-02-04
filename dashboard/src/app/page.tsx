'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { fetchExperimentResults, fetchTimeSeries } from '@/lib/data';
import { DashboardData, TimeSeriesPoint, MetricComparison } from '@/lib/types';
import SiteCard from '@/components/SiteCard';
import ExperimentSelector from '@/components/ExperimentSelector';
import MetricCard from '@/components/MetricCard';

// Dynamic imports for charts (client-side only due to D3)
const Hydrograph = dynamic(() => import('@/components/charts/Hydrograph'), {
  ssr: false,
  loading: () => <div className="h-96 bg-gray-800 rounded-lg animate-pulse" />,
});

const MetricsBarChart = dynamic(
  () => import('@/components/charts/MetricsBarChart'),
  {
    ssr: false,
    loading: () => <div className="h-72 bg-gray-800 rounded-lg animate-pulse" />,
  }
);

const ErrorDistribution = dynamic(
  () => import('@/components/charts/ErrorDistribution'),
  {
    ssr: false,
    loading: () => <div className="h-72 bg-gray-800 rounded-lg animate-pulse" />,
  }
);

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [selectedSite, setSelectedSite] = useState<string>('03479000');
  const [selectedExperiment, setSelectedExperiment] = useState<string>('hydra_v2');
  const [timeSeries, setTimeSeries] = useState<TimeSeriesPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchExperimentResults()
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchTimeSeries(selectedExperiment, selectedSite).then(setTimeSeries);
  }, [selectedExperiment, selectedSite]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-white text-xl">Loading experiment data...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-400 text-xl mb-2">Error loading data</div>
          <div className="text-gray-400">{error}</div>
          <p className="text-gray-500 mt-4 text-sm">
            Make sure experiment results are exported to /public/data/experiment_results.json
          </p>
        </div>
      </div>
    );
  }

  // Get current result
  const currentResult = data.results.find(
    (r) => r.site_id === selectedSite && r.experiment === selectedExperiment
  );

  // Build metrics comparison data
  const metricsComparison: MetricComparison[] = currentResult
    ? [
        {
          metric: 'RMSE',
          baseline: currentResult.baseline.rmse || 0,
          corrected: currentResult.corrected.rmse || 0,
          improvement:
            ((currentResult.baseline.rmse || 0) -
              (currentResult.corrected.rmse || 0)) /
            (currentResult.baseline.rmse || 1) *
            100,
        },
        {
          metric: 'NSE',
          baseline: currentResult.baseline.nse || 0,
          corrected: currentResult.corrected.nse || 0,
          improvement:
            ((currentResult.corrected.nse || 0) -
              (currentResult.baseline.nse || 0)) *
            100,
        },
        {
          metric: 'KGE',
          baseline: currentResult.baseline.kge || 0,
          corrected: currentResult.corrected.kge || 0,
          improvement:
            ((currentResult.corrected.kge || 0) -
              (currentResult.baseline.kge || 0)) *
            100,
        },
      ]
    : [];

  // Mock error data for distribution chart
  const nwmErrors = Array.from({ length: 500 }, () => (Math.random() - 0.5) * 20);
  const correctedErrors = Array.from(
    { length: 500 },
    () => (Math.random() - 0.5) * 10
  );

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">Hydra Dashboard</h1>
            <p className="text-gray-400 text-sm">
              NWM Streamflow Error Correction Results
            </p>
          </div>
          <div className="text-gray-500 text-sm">
            Last updated: {new Date(data.generated_at).toLocaleDateString()}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Experiment Selector */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-4">Experiment</h2>
          <ExperimentSelector
            experiments={data.experiments}
            selected={selectedExperiment}
            onSelect={setSelectedExperiment}
          />
        </section>

        <div className="grid lg:grid-cols-4 gap-8">
          {/* Site Selection */}
          <div className="lg:col-span-1">
            <h2 className="text-lg font-semibold mb-4">Study Sites</h2>
            <div className="space-y-3">
              {Object.entries(data.sites).map(([siteId, metadata]) => {
                const siteResult = data.results.find(
                  (r) =>
                    r.site_id === siteId && r.experiment === selectedExperiment
                );
                return (
                  <SiteCard
                    key={siteId}
                    siteId={siteId}
                    metadata={metadata}
                    isSelected={selectedSite === siteId}
                    onClick={() => setSelectedSite(siteId)}
                    metrics={
                      siteResult
                        ? {
                            rmseImprovement: siteResult.rmse_improvement_pct || 0,
                            nseImprovement:
                              ((siteResult.corrected.nse || 0) -
                                (siteResult.baseline.nse || 0)) *
                              100,
                          }
                        : undefined
                    }
                  />
                );
              })}
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3 space-y-8">
            {/* Metrics Cards */}
            {currentResult && (
              <section>
                <h2 className="text-lg font-semibold mb-4">
                  Performance Metrics - {data.sites[selectedSite]?.name || selectedSite}
                </h2>
                <div className="grid md:grid-cols-4 gap-4">
                  <MetricCard
                    label="RMSE"
                    baseline={currentResult.baseline.rmse || 0}
                    corrected={currentResult.corrected.rmse || 0}
                    unit="m³/s"
                    higherIsBetter={false}
                  />
                  <MetricCard
                    label="NSE"
                    baseline={currentResult.baseline.nse || 0}
                    corrected={currentResult.corrected.nse || 0}
                    higherIsBetter={true}
                  />
                  <MetricCard
                    label="KGE"
                    baseline={currentResult.baseline.kge || 0}
                    corrected={currentResult.corrected.kge || 0}
                    higherIsBetter={true}
                  />
                  <MetricCard
                    label="PBIAS"
                    baseline={currentResult.baseline.pbias || 0}
                    corrected={currentResult.corrected.pbias || 0}
                    unit="%"
                    higherIsBetter={false}
                  />
                </div>
              </section>
            )}

            {/* Hydrograph */}
            <section>
              <h2 className="text-lg font-semibold mb-4">Hydrograph</h2>
              <Hydrograph data={timeSeries} height={400} />
            </section>

            {/* Charts Grid */}
            <div className="grid lg:grid-cols-2 gap-6">
              <section>
                <h2 className="text-lg font-semibold mb-4">Metrics Comparison</h2>
                <MetricsBarChart data={metricsComparison} />
              </section>

              <section>
                <h2 className="text-lg font-semibold mb-4">Error Distribution</h2>
                <ErrorDistribution
                  nwmErrors={nwmErrors}
                  correctedErrors={correctedErrors}
                />
              </section>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 px-6 py-4 mt-8">
        <div className="max-w-7xl mx-auto text-center text-gray-500 text-sm">
          Hydra Transformer Streamflow Error Correction | Thesis Project 2024
        </div>
      </footer>
    </div>
  );
}
