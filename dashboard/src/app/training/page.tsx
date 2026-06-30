'use client';

import Link from 'next/link';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';

const STEPS = [
  {
    title: 'Data audit',
    text: 'USGS observations, NWM retrospective discharge, and ERA5-Land features are checked for availability before they are used for claims.',
  },
  {
    title: 'Chronological split',
    text: 'Training uses 2010-2017, validation uses 2018, and testing uses 2019-2020 to avoid future leakage.',
  },
  {
    title: 'Controlled model variants',
    text: 'Input-source ablations separate recent gauge observations, NWM hydrograph information, and meteorological context.',
  },
  {
    title: 'Feature-sweep confirmation',
    text: 'The completed ERA5 sweep retrains gauge-free models across fixed feature sets, sites, and seeds.',
  },
  {
    title: 'Hydrologic metrics',
    text: 'RMSE, MAE, NSE, KGE, PBIAS, and RMSE skill are reported with conservative interpretation.',
  },
];

export default function TrainingPage() {
  return (
    <div className="min-h-screen text-white">
      <Navigation />

      <header className="border-b border-[#2a445b]/50 bg-[#071420]/50 px-4 py-10 md:px-6">
        <div className="mx-auto max-w-7xl">
          <p className="font-display text-xs uppercase tracking-[0.24em] text-hydra-corrected">
            Technical workflow
          </p>
          <h1 className="mt-3 font-display text-4xl font-semibold md:text-5xl">
            <span className="gradient-text">Experiment Workflow</span>
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-relaxed text-[#b6cddd]">
            This route is kept as a technical reference. The public story is organized around
            evidence and limitations rather than internal model-version history.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-10 md:px-6">
        <section className="grid gap-4 md:grid-cols-5">
          {STEPS.map((step, index) => (
            <div key={step.title} className="surface-panel rounded-xl p-5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-hydra-corrected/15 font-mono text-sm text-hydra-corrected">
                {index + 1}
              </div>
              <h2 className="mt-4 font-display text-lg text-white">{step.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-[#a9c2d3]">{step.text}</p>
            </div>
          ))}
        </section>

        <section className="mt-10 grid gap-6 lg:grid-cols-2">
          <div className="surface-panel rounded-xl p-6">
            <h2 className="font-display text-xl text-white">Confirmatory ERA5 Feature Set</h2>
            <p className="mt-3 text-sm leading-relaxed text-[#a9c2d3]">
              The confirmatory feature sweep uses precipitation, temperature, soil moisture, and
              day/month seasonal encodings because these variables are available through the held-out
              test period. Dewpoint, pressure, radiation, wind speed, vapor pressure deficit,
              relative humidity, and hour-of-day encodings are treated as exploratory only when they
              lack test-period coverage.
            </p>
            <Link href="/era5" className="mt-5 inline-flex text-sm text-hydra-corrected hover:underline">
              Open ERA5 evidence →
            </Link>
          </div>

          <div className="surface-panel rounded-xl p-6">
            <h2 className="font-display text-xl text-white">Claim Discipline</h2>
            <p className="mt-3 text-sm leading-relaxed text-[#a9c2d3]">
              Quantitative claims shown in the dashboard should trace to dashboard JSON, locked
              manuscript artifacts, or completed ERA5 sweep tables. Feature drops are described as
              predictive sensitivity, and persistence is retained as an explicit limitation.
            </p>
            <Link href="/analysis" className="mt-5 inline-flex text-sm text-hydra-corrected hover:underline">
              Read findings →
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
