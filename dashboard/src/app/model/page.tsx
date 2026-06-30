'use client';

import Image from 'next/image';
import Link from 'next/link';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import PipelineSchematic from '@/components/PipelineSchematic';

const FEATURE_GROUPS = [
  {
    title: 'Recent gauge observations',
    description: 'Lagged USGS discharge provides the strongest estimate of the current local river state.',
  },
  {
    title: 'National Water Model discharge',
    description: 'Raw NWM streamflow carries routed basin-scale information that gauge history alone does not provide.',
  },
  {
    title: 'ERA5-Land context',
    description: 'Eligible weather, soil moisture, and seasonal features provide meteorological context and support gauge-free tests.',
  },
];

const WORKFLOW = [
  'Assemble hourly USGS, NWM, and ERA5-Land records for 2010-2020.',
  'Use a chronological split: training through 2017, validation in 2018, and testing in 2019-2020.',
  'Train Hydra to learn a residual correction to raw NWM where NWM is part of the input set.',
  'Compare controlled input-source ablations and ERA5 feature subsets with hydrologic metrics.',
];

export default function ModelPage() {
  return (
    <div className="min-h-screen text-white">
      <Navigation />

      <header className="border-b border-[#2a445b]/50 bg-[#071420]/50 px-4 py-10 md:px-6">
        <div className="mx-auto max-w-7xl">
          <p className="font-display text-xs uppercase tracking-[0.24em] text-hydra-corrected">
            Method overview
          </p>
          <h1 className="mt-3 font-display text-4xl font-semibold md:text-5xl">
            <span className="gradient-text">Model</span>
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-relaxed text-[#b6cddd]">
            Hydra is used here as a residual-correction model: it learns typical local differences
            between observed streamflow and the National Water Model, then applies that correction
            back to the NWM baseline.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-12 px-4 py-10 md:px-6">
        <section>
          <h2 className="mb-5 text-center font-display text-sm uppercase tracking-[0.24em] text-[#8fb4cc]">
            Residual-Correction Pipeline
          </h2>
          <PipelineSchematic reduceMotion />
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
          <div className="surface-panel rounded-xl p-5">
            <h2 className="font-display text-xl text-white">Architecture Diagram</h2>
            <p className="mt-2 text-sm leading-relaxed text-[#a9c2d3]">
              The architecture combines feature reweighting, recurrent temporal encoding, multi-scale
              extraction, attention-based fusion, and a residual prediction head. The dashboard keeps
              this as a conceptual overview rather than treating architectural variants as the main story.
            </p>
            <div className="mt-5 overflow-hidden rounded-xl border border-[#2a445b] bg-[#071420]">
              <Image
                src="/images/architecture_diagram.png"
                alt="Hydra residual-correction architecture diagram"
                width={1200}
                height={600}
                className="h-auto w-full"
                priority
              />
            </div>
          </div>

          <div className="surface-panel rounded-xl p-5">
            <h2 className="font-display text-xl text-white">Inputs Tested</h2>
            <div className="mt-4 space-y-4">
              {FEATURE_GROUPS.map((group) => (
                <div key={group.title} className="rounded-xl border border-[#2a445b] bg-[#071420]/70 p-4">
                  <h3 className="font-display text-base text-white">{group.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#a9c2d3]">{group.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="surface-panel rounded-xl p-5">
            <h2 className="font-display text-xl text-white">Evaluation Workflow</h2>
            <ol className="mt-4 space-y-3 text-sm leading-relaxed text-[#a9c2d3]">
              {WORKFLOW.map((step, index) => (
                <li key={step} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-hydra-corrected/15 text-xs text-hydra-corrected">
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="surface-panel rounded-xl p-5">
            <h2 className="font-display text-xl text-white">What the Model Is Not Claiming</h2>
            <div className="mt-4 space-y-3 text-sm leading-relaxed text-[#a9c2d3]">
              <p>It is not presented as a universal replacement for one-hour persistence.</p>
              <p>It does not prove that an ERA5 feature physically causes a streamflow error.</p>
              <p>It does not resolve regulated-site behavior without reservoir-operation information.</p>
              <p>It does not use missing 2019-2020 ERA5 fields for confirmatory feature claims.</p>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <Link href="/analysis" className="surface-panel rounded-xl p-5 transition-colors hover:border-hydra-corrected/40">
            <h3 className="font-display text-lg text-white">Read findings</h3>
            <p className="mt-2 text-sm text-[#a9c2d3]">See how each input source changes model skill.</p>
          </Link>
          <Link href="/era5" className="surface-panel rounded-xl p-5 transition-colors hover:border-hydra-corrected/40">
            <h3 className="font-display text-lg text-white">Explore ERA5</h3>
            <p className="mt-2 text-sm text-[#a9c2d3]">Inspect the completed feature-sweep results.</p>
          </Link>
          <Link href="/experiments" className="surface-panel rounded-xl p-5 transition-colors hover:border-hydra-corrected/40">
            <h3 className="font-display text-lg text-white">Open experiments</h3>
            <p className="mt-2 text-sm text-[#a9c2d3]">Compare older controlled experiment outputs and hydrographs.</p>
          </Link>
        </section>
      </main>

      <Footer />
    </div>
  );
}
