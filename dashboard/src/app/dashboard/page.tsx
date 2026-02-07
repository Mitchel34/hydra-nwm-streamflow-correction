'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { fetchExperimentResults, fetchTimeSeries } from '@/lib/data';
import { DashboardData, MetricComparison, TimeSeriesPoint } from '@/lib/types';
import SiteCard from '@/components/SiteCard';
import ExperimentSelector from '@/components/ExperimentSelector';
import MetricCard from '@/components/MetricCard';

const Hydrograph = dynamic(() => import('@/components/charts/Hydrograph'), {
  ssr: false,
  loading: () => <div className="h-96 rounded-lg bg-[#0f202f] animate-pulse" />,
});

const MetricsBarChart = dynamic(
  () => import('@/components/charts/MetricsBarChart'),
  {
    ssr: false,
    loading: () => <div className="h-72 rounded-lg bg-[#0f202f] animate-pulse" />,
  }
);

const ErrorDistribution = dynamic(
  () => import('@/components/charts/ErrorDistribution'),
  {
    ssr: false,
    loading: () => <div className="h-72 rounded-lg bg-[#0f202f] animate-pulse" />,
  }
);

const preferredExperimentOrder = [
  'hydra_v2',
  'combined',
  'physics',
  'causal',
  'direct',
  'baseline',
  'hydra_v1',
  'lstm',
];

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [selectedSite, setSelectedSite] = useState<string>('');
  const [selectedExperiment, setSelectedExperiment] = useState<string>('');
  const [timeSeries, setTimeSeries] = useState<TimeSeriesPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [controlsOpen, setControlsOpen] = useState(false);

  useEffect(() => {
    fetchExperimentResults()
      .then(setData)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!data || data.results.length === 0) {
      return;
    }

    const currentIsValid = data.results.some(
      (result) =>
        result.experiment === selectedExperiment && result.site_id === selectedSite
    );

    if (currentIsValid) {
      return;
    }

    const prioritizedResult =
      preferredExperimentOrder
        .map((experiment) =>
          data.results.find((result) => result.experiment === experiment)
        )
        .find(Boolean) || data.results[0];

    setSelectedExperiment(prioritizedResult.experiment);
    setSelectedSite(prioritizedResult.site_id);
  }, [data, selectedExperiment, selectedSite]);

  useEffect(() => {
    if (!data || !selectedExperiment) {
      return;
    }

    const sitesForExperiment = data.results
      .filter((result) => result.experiment === selectedExperiment)
      .map((result) => result.site_id);

    if (sitesForExperiment.length > 0 && !sitesForExperiment.includes(selectedSite)) {
      setSelectedSite(sitesForExperiment[0]);
    }
  }, [data, selectedExperiment, selectedSite]);

  useEffect(() => {
    if (!selectedExperiment || !selectedSite) {
      setTimeSeries([]);
      return;
    }

    let active = true;

    fetchTimeSeries(selectedExperiment, selectedSite).then((series) => {
      if (active) {
        setTimeSeries(series);
      }
    });

    return () => {
      active = false;
    };
  }, [selectedExperiment, selectedSite]);

  const availableExperiments = useMemo(
    () => new Set((data?.results ?? []).map((result) => result.experiment)),
    [data?.results]
  );

  const availableSitesForSelectedExperiment = useMemo(
    () =>
      new Set(
        (data?.results ?? [])
          .filter((result) => result.experiment === selectedExperiment)
          .map((result) => result.site_id)
      ),
    [data?.results, selectedExperiment]
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#07131f]">
        <div className="text-xl text-white">Loading experiment data...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#07131f] px-4">
        <div className="text-center">
          <div className="mb-2 text-xl text-red-400">Error loading data</div>
          <div className="text-[#afc6d7]">{error}</div>
          <p className="mt-4 text-sm text-[#86a6bc]">
            Ensure results are exported to
            {' '}
            <code>/public/data/experiment_results.json</code>
          </p>
        </div>
      </div>
    );
  }

  const currentResult = data.results.find(
    (result) =>
      result.site_id === selectedSite && result.experiment === selectedExperiment
  );

  const selectedSiteMetadata = selectedSite ? data.sites[selectedSite] : undefined;
  const selectedExperimentName = selectedExperiment
    ? data.experiments[selectedExperiment]?.name || selectedExperiment
    : 'No experiment selected';

  const metricsComparison: MetricComparison[] = currentResult
    ? [
        {
          metric: 'RMSE',
          baseline: currentResult.baseline.rmse || 0,
          corrected: currentResult.corrected.rmse || 0,
          improvement:
            (((currentResult.baseline.rmse || 0) - (currentResult.corrected.rmse || 0)) /
              (currentResult.baseline.rmse || 1)) *
            100,
        },
        {
          metric: 'MAE',
          baseline: currentResult.baseline.mae || 0,
          corrected: currentResult.corrected.mae || 0,
          improvement:
            (((currentResult.baseline.mae || 0) - (currentResult.corrected.mae || 0)) /
              (currentResult.baseline.mae || 1)) *
            100,
        },
        {
          metric: 'NSE',
          baseline: currentResult.baseline.nse || 0,
          corrected: currentResult.corrected.nse || 0,
          improvement:
            ((currentResult.corrected.nse || 0) - (currentResult.baseline.nse || 0)) *
            100,
        },
        {
          metric: 'KGE',
          baseline: currentResult.baseline.kge || 0,
          corrected: currentResult.corrected.kge || 0,
          improvement:
            ((currentResult.corrected.kge || 0) - (currentResult.baseline.kge || 0)) *
            100,
        },
      ]
    : [];

  const nwmErrors = timeSeries
    .map((point) => point.nwm - point.usgs)
    .filter((value) => Number.isFinite(value));
  const correctedErrors = timeSeries
    .map((point) => point.corrected - point.usgs)
    .filter((value) => Number.isFinite(value));

  const expectedCombinations =
    Object.keys(data.experiments).length * Object.keys(data.sites).length;
  const completionPct =
    expectedCombinations > 0
      ? Math.round((data.results.length / expectedCombinations) * 100)
      : 0;

  const handleExperimentSelect = (experimentId: string) => {
    setSelectedExperiment(experimentId);
    const firstSite = data.results.find(
      (result) => result.experiment === experimentId
    )?.site_id;
    if (firstSite) {
      setSelectedSite(firstSite);
    }
  };

  return (
    <div className="min-h-screen text-white">
      <header className="border-b border-[#2a445b] bg-[#071420]/80 px-6 py-4 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="flex items-center gap-2 transition-opacity hover:opacity-80"
            >
              <div className="h-8 w-8 rounded-md bg-gradient-to-br from-hydra-accent to-hydra-corrected" />
              <span className="font-display text-lg font-semibold tracking-[0.12em]">
                HYDRA
              </span>
            </Link>
            <div className="h-6 w-px bg-[#36536a]" />
            <div>
              <h1 className="font-display text-xl">Dashboard</h1>
              <p className="text-xs text-[#8daec2]">NWM Streamflow Error Correction</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/analysis"
              className="text-sm text-[#8daec2] hover:text-white transition-colors"
            >
              Analysis →
            </Link>
            <span className="text-sm text-[#8daec2]">
              Updated: {new Date(data.generated_at).toLocaleDateString()}
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        {data.results.length < expectedCombinations && (
          <section className="mb-6 rounded-xl border border-hydra-accent/35 bg-[#0a1d2c] px-4 py-3 text-sm text-[#b5cede]">
            Showing partial experiment outputs while upstream runs finish:
            {' '}
            <span className="font-semibold text-hydra-corrected">
              {data.results.length}/{expectedCombinations} combinations ({completionPct}%)
            </span>
            {' '}
            are currently available.
          </section>
        )}

        <section className="mb-8">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-lg">Experiment Configurations</h2>
              <p className="text-sm text-[#8daec2]">
                Select an experiment with available metrics; pending runs are disabled.
              </p>
            </div>
            <div className="rounded-full border border-[#304a60] px-3 py-1 text-xs uppercase tracking-[0.11em] text-[#95b0c4]">
              Active: {selectedExperimentName}
            </div>
          </div>
          <ExperimentSelector
            experiments={data.experiments}
            selected={selectedExperiment}
            onSelect={handleExperimentSelect}
            availableExperiments={availableExperiments}
          />
        </section>

        <button
          type="button"
          onClick={() => setControlsOpen((open) => !open)}
          className="mb-4 rounded-lg border border-[#35526a] px-3 py-2 text-sm text-[#bbd4e5] transition-colors hover:border-hydra-corrected/50 lg:hidden"
          aria-label={controlsOpen ? 'Hide site controls' : 'Show site controls'}
        >
          {controlsOpen ? 'Hide Site Controls' : 'Show Site Controls'}
        </button>

        <div className="grid gap-8 lg:grid-cols-4">
          <aside className={`${controlsOpen ? 'block' : 'hidden'} lg:col-span-1 lg:block`}>
            <h2 className="mb-4 font-display text-lg">Study Sites</h2>
            <div className="space-y-3">
              {Object.entries(data.sites).map(([siteId, metadata]) => {
                const siteResult = data.results.find(
                  (result) =>
                    result.site_id === siteId && result.experiment === selectedExperiment
                );
                const hasMetrics = availableSitesForSelectedExperiment.has(siteId);

                return (
                  <SiteCard
                    key={siteId}
                    siteId={siteId}
                    metadata={metadata}
                    isSelected={selectedSite === siteId}
                    onClick={() => setSelectedSite(siteId)}
                    disabled={!hasMetrics}
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
          </aside>

          <div className="space-y-8 lg:col-span-3">
            <section className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              <div className="surface-panel rounded-xl p-4">
                <h2 className="font-display text-lg text-white">
                  {selectedSiteMetadata?.name || 'Site context unavailable'}
                </h2>
                <p className="mt-2 text-sm text-[#9ebace]">
                  Gauge ID {selectedSite || 'N/A'} in the {selectedSiteMetadata?.watershed || 'N/A'} watershed.
                  {' '}
                  Type:
                  {' '}
                  {selectedSiteMetadata?.type || 'N/A'}.
                </p>
                <p className="mt-2 text-xs uppercase tracking-[0.09em] text-[#7f9db2]">
                  Experiment: {selectedExperimentName}
                </p>
              </div>
              <div className="surface-panel rounded-xl p-4">
                <h3 className="font-display text-sm uppercase tracking-[0.14em] text-[#9bb7ca]">
                  Location Inset
                </h3>
                {selectedSiteMetadata ? (
                  <>
                    <svg
                      viewBox="0 0 140 88"
                      className="mt-3 h-20 w-full rounded border border-[#2f465a] bg-[#0a1622]"
                      role="img"
                      aria-label="Simplified site location inset"
                    >
                      <rect x="5" y="5" width="130" height="78" rx="8" fill="#0c1b2a" stroke="#2f465a" />
                      <path d="M18 58 C 45 25, 90 30, 122 18" stroke="#4da0ff" strokeWidth="2" fill="none" opacity="0.6" />
                      <circle
                        cx={22 + ((selectedSiteMetadata.lon + 82.4) / 1.7) * 96}
                        cy={16 + ((36.9 - selectedSiteMetadata.lat) / 1.1) * 52}
                        r="4"
                        fill="#2be3d6"
                      />
                    </svg>
                    <p className="mt-2 text-xs text-[#92b0c5]">
                      Lat {selectedSiteMetadata.lat.toFixed(3)}, Lon {selectedSiteMetadata.lon.toFixed(3)}
                    </p>
                  </>
                ) : (
                  <p className="mt-3 text-xs text-[#92b0c5]">No location metadata available.</p>
                )}
              </div>
            </section>

            {currentResult ? (
              <section>
                <h2 className="mb-4 font-display text-lg">Performance Metrics</h2>
                <div className="grid gap-4 md:grid-cols-4">
                  <MetricCard
                    label="RMSE"
                    baseline={currentResult.baseline.rmse || 0}
                    corrected={currentResult.corrected.rmse || 0}
                    unit="m³/s"
                    higherIsBetter={false}
                  />
                  <MetricCard
                    label="MAE"
                    baseline={currentResult.baseline.mae || 0}
                    corrected={currentResult.corrected.mae || 0}
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
                </div>
              </section>
            ) : (
              <section className="rounded-xl border border-[#345066] bg-[#0c1b29] px-4 py-4 text-sm text-[#a6c1d3]">
                Metrics for this site and experiment are not available yet. Choose another available
                combination from the controls while runs continue.
              </section>
            )}

            <section>
              <h2 className="mb-4 font-display text-lg">Hydrograph</h2>
              <Hydrograph
                data={timeSeries}
                height={420}
                experimentName={selectedExperimentName}
                siteName={selectedSiteMetadata?.name || selectedSite}
              />
            </section>

            <div className="grid gap-6 lg:grid-cols-2">
              <section>
                <h2 className="mb-4 font-display text-lg">Metrics Comparison</h2>
                <MetricsBarChart data={metricsComparison} />
              </section>

              <section>
                <h2 className="mb-4 font-display text-lg">Error Distribution</h2>
                <ErrorDistribution
                  nwmErrors={nwmErrors}
                  correctedErrors={correctedErrors}
                />
              </section>
            </div>
          </div>
        </div>
      </main>

      <footer className="mt-8 border-t border-[#2a445b] bg-[#071420]/80 px-6 py-4">
        <div className="mx-auto max-w-7xl text-center text-sm text-[#8daec2]">
          Hydra Transformer Streamflow Error Correction | Thesis Project 2024-2025
        </div>
      </footer>
    </div>
  );
}
