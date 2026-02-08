'use client';

import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import StudyRegionMap from '@/components/StudyRegionMap';

interface FindingCardProps {
  icon: React.ReactNode;
  title: string;
  value: string;
  description: string;
  positive?: boolean;
}

function FindingCard({ icon, title, value, description, positive = true }: FindingCardProps) {
  return (
    <div className="surface-panel rounded-xl p-5">
      <div className="flex items-start gap-4">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
          positive ? 'bg-hydra-corrected/20 text-hydra-corrected' : 'bg-hydra-alert/20 text-hydra-alert'
        }`}>
          {icon}
        </div>
        <div>
          <p className="text-sm text-[#8fb4cc]">{title}</p>
          <p className={`text-2xl font-display font-semibold ${
            positive ? 'text-hydra-corrected' : 'text-hydra-alert'
          }`}>
            {value}
          </p>
          <p className="mt-1 text-sm text-[#a9c2d3]">{description}</p>
        </div>
      </div>
    </div>
  );
}

interface VisualizationCardProps {
  src: string;
  alt: string;
  title: string;
  description: string;
}

function VisualizationCard({ src, alt, title, description }: VisualizationCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="surface-panel rounded-2xl overflow-hidden"
    >
      <div className="p-4 border-b border-[#22384b]">
        <h3 className="font-display text-lg text-white">{title}</h3>
        <p className="text-sm text-[#8fb4cc] mt-1">{description}</p>
      </div>
      <div className="p-4 bg-[#0a1a26]">
        <Image
          src={src}
          alt={alt}
          width={800}
          height={500}
          className="w-full h-auto rounded-lg"
          priority
        />
      </div>
    </motion.div>
  );
}

export default function AnalysisPage() {
  // Summary for unregulated sites only (Jefferson, Galax, Sugar Grove)
  const experimentSummary = [
    { experiment: 'Causal Mask', avgImprovement: '+15.8%', bestSite: 'Galax, VA (21.3%)' },
    { experiment: 'Physics Constraint', avgImprovement: '+12.4%', bestSite: 'Jefferson, NC (21.5%)' },
    { experiment: 'Baseline', avgImprovement: '+9.7%', bestSite: 'Galax, VA (10.6%)' },
    { experiment: 'Direct Mode', avgImprovement: '+8.2%', bestSite: 'Jefferson, NC (16.1%)' },
    { experiment: 'Combined', avgImprovement: '+11.2%', bestSite: 'Galax, VA (20.1%)' },
  ];

  return (
    <div className="min-h-screen text-white">
      {/* Navigation */}
      <nav className="sticky top-0 z-20 border-b border-[#2a455c]/55 bg-[#06131f]/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="h-8 w-8 rounded-md bg-gradient-to-br from-hydra-accent to-hydra-corrected" />
            <span className="font-display text-lg font-semibold tracking-[0.12em]">HYDRA</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/" className="text-sm text-[#8fb4cc] hover:text-white transition-colors">
              Home
            </Link>
            <Link href="/dashboard" className="text-sm text-[#8fb4cc] hover:text-white transition-colors">
              Dashboard
            </Link>
            <span className="text-sm text-hydra-corrected font-medium">Analysis</span>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-6 py-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10"
        >
          <h1 className="font-display text-4xl font-semibold">
            <span className="gradient-text">Engineering Analysis</span>
          </h1>
          <p className="mt-3 text-lg text-[#a9c2d3] max-w-3xl">
            Comprehensive evaluation of deep learning approaches for National Water Model
            streamflow error correction across Appalachian watersheds.
          </p>
        </motion.div>

        {/* Study Region Map */}
        <section className="mb-12">
          <StudyRegionMap />
        </section>

        {/* Key Findings */}
        <section className="mb-12">
          <h2 className="font-display text-sm uppercase tracking-[0.28em] text-[#8fb4cc] mb-5">
            Key Findings (Unregulated Sites)
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <FindingCard
              icon={
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              }
              title="Best Result"
              value="21.5%"
              description="RMSE reduction (Physics @ Jefferson)"
              positive={true}
            />
            <FindingCard
              icon={
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
              title="Success Rate"
              value="100%"
              description="All 15 experiments improved"
              positive={true}
            />
            <FindingCard
              icon={
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              }
              title="Average Improvement"
              value="+11.5%"
              description="Mean RMSE reduction across sites"
              positive={true}
            />
            <FindingCard
              icon={
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              }
              title="NSE Improvement"
              value="+0.22"
              description="Avg efficiency gain at Jefferson"
              positive={true}
            />
          </div>
        </section>

        {/* Experiment Summary Table */}
        <section className="mb-12">
          <h2 className="font-display text-sm uppercase tracking-[0.28em] text-[#8fb4cc] mb-5">
            Experiment Summary
          </h2>
          <div className="surface-panel rounded-xl overflow-hidden">
            <table className="w-full">
              <thead className="bg-[#122334]">
                <tr>
                  <th className="text-left px-5 py-3 text-sm font-display text-[#8fb4cc]">Configuration</th>
                  <th className="text-left px-5 py-3 text-sm font-display text-[#8fb4cc]">Avg RMSE Improvement</th>
                  <th className="text-left px-5 py-3 text-sm font-display text-[#8fb4cc]">Best Site</th>
                </tr>
              </thead>
              <tbody>
                {experimentSummary.map((row, i) => (
                  <tr key={i} className="border-t border-[#22384b]">
                    <td className="px-5 py-3 text-white">{row.experiment}</td>
                    <td className={`px-5 py-3 font-medium ${
                      row.avgImprovement.startsWith('+') ? 'text-hydra-corrected' : 'text-hydra-alert'
                    }`}>
                      {row.avgImprovement}
                    </td>
                    <td className="px-5 py-3 text-[#a9c2d3]">{row.bestSite}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Visualizations */}
        <section className="mb-12">
          <h2 className="font-display text-sm uppercase tracking-[0.28em] text-[#8fb4cc] mb-5">
            Visualizations
          </h2>
          <div className="grid gap-6 lg:grid-cols-2">
            <VisualizationCard
              src="/analysis/rmse_by_experiment.png"
              alt="RMSE Improvement by Experiment"
              title="RMSE Improvement by Experiment"
              description="Average improvement across all sites with standard deviation error bars"
            />
            <VisualizationCard
              src="/analysis/site_experiment_heatmap.png"
              alt="Site-Experiment Heatmap"
              title="Performance Heatmap"
              description="RMSE improvement (%) for each site-experiment combination"
            />
            <VisualizationCard
              src="/analysis/nse_kge_scatter.png"
              alt="NSE vs KGE Scatter"
              title="NSE vs KGE Improvement"
              description="Correlation between efficiency metrics, colored by site type"
            />
            <VisualizationCard
              src="/analysis/baseline_vs_corrected.png"
              alt="Baseline vs Corrected"
              title="NWM Baseline vs Hydra Corrected"
              description="Direct comparison of RMSE and NSE values"
            />
          </div>
        </section>

        {/* Technical Discussion */}
        <section className="mb-12">
          <h2 className="font-display text-sm uppercase tracking-[0.28em] text-[#8fb4cc] mb-5">
            Technical Discussion
          </h2>
          <div className="surface-panel rounded-2xl p-6 space-y-6">
            <div>
              <h3 className="font-display text-lg text-white mb-2">Model Architecture Effectiveness</h3>
              <p className="text-[#a9c2d3] leading-relaxed">
                The Hydra architecture combines GRU recurrence with transformer attention mechanisms
                to capture both short-term temporal dependencies and long-range patterns in
                hydrometeorological time series. Results indicate that enforcing temporal causality
                through attention masking improves generalization, particularly at mainstem sites.
              </p>
            </div>
            <div>
              <h3 className="font-display text-lg text-white mb-2">Physics-Informed Learning</h3>
              <p className="text-[#a9c2d3] leading-relaxed">
                The non-negativity penalty on streamflow predictions shows the best performance
                at mid-basin sites (Jefferson, NC: 21.5% improvement), indicating that
                physics-informed loss functions can enhance physical consistency without
                sacrificing predictive accuracy.
              </p>
            </div>
            <div>
              <h3 className="font-display text-lg text-white mb-2">Site-Specific Performance Patterns</h3>
              <p className="text-[#a9c2d3] leading-relaxed">
                Mainstem sites (Galax) benefit most from causal masking, likely due to longer
                response times and more predictable flow patterns. Headwater sites (Sugar Grove)
                show more modest but consistent improvements, reflecting their flashier response
                to precipitation events.
              </p>
            </div>
          </div>
        </section>

        {/* Model Improvement Suggestions */}
        <section className="mb-12">
          <h2 className="font-display text-sm uppercase tracking-[0.28em] text-[#8fb4cc] mb-5">
            Model Improvement Suggestions
          </h2>
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="surface-panel rounded-xl p-5">
              <div className="flex items-start gap-3 mb-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-hydra-corrected/20 text-hydra-corrected">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-display text-white mb-1">Enhanced Feature Engineering</h3>
                  <p className="text-sm text-[#a9c2d3]">
                    Incorporate terrain derivatives (slope, aspect, TWI), soil moisture indices from SMAP/SMOS,
                    and snow water equivalent from SNODAS. These could help the model better understand
                    antecedent conditions that influence runoff response.
                  </p>
                </div>
              </div>
            </div>

            <div className="surface-panel rounded-xl p-5">
              <div className="flex items-start gap-3 mb-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-hydra-accent/20 text-hydra-accent">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-display text-white mb-1">Multi-Scale Attention</h3>
                  <p className="text-sm text-[#a9c2d3]">
                    Implement hierarchical attention operating at hourly, daily, and weekly scales.
                    This would allow the model to capture both rapid storm response and slower
                    baseflow recession patterns simultaneously.
                  </p>
                </div>
              </div>
            </div>

            <div className="surface-panel rounded-xl p-5">
              <div className="flex items-start gap-3 mb-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-hydra-observed/20 text-hydra-observed">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-display text-white mb-1">Event-Focused Training</h3>
                  <p className="text-sm text-[#a9c2d3]">
                    Apply stratified sampling to oversample high-flow events during training.
                    Current training may underweight extreme events that are critical for
                    flood forecasting applications like post-Helene scenarios.
                  </p>
                </div>
              </div>
            </div>

            <div className="surface-panel rounded-xl p-5">
              <div className="flex items-start gap-3 mb-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#f59e0b]/20 text-[#f59e0b]">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-display text-white mb-1">Precipitation Nowcasting Integration</h3>
                  <p className="text-sm text-[#a9c2d3]">
                    Incorporate MRMS radar-derived QPE and short-term QPF as inputs. The model
                    currently relies on NWM forcings which may have timing errors during
                    fast-moving convective events common in the Southern Appalachians.
                  </p>
                </div>
              </div>
            </div>

            <div className="surface-panel rounded-xl p-5">
              <div className="flex items-start gap-3 mb-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#ec4899]/20 text-[#ec4899]">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-display text-white mb-1">Uncertainty Quantification</h3>
                  <p className="text-sm text-[#a9c2d3]">
                    Implement Monte Carlo dropout or deep ensembles to provide prediction intervals.
                    Operational users need confidence bounds, especially during extreme events
                    where model uncertainty is highest.
                  </p>
                </div>
              </div>
            </div>

            <div className="surface-panel rounded-xl p-5">
              <div className="flex items-start gap-3 mb-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#8b5cf6]/20 text-[#8b5cf6]">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-display text-white mb-1">Transfer Learning Protocol</h3>
                  <p className="text-sm text-[#a9c2d3]">
                    Pre-train on the full CAMELS dataset, then fine-tune on Appalachian sites.
                    This would leverage hydrologic knowledge from diverse watersheds while
                    adapting to regional characteristics.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#2a455c]/55 bg-[#06131f]/75 py-8">
        <div className="mx-auto max-w-7xl px-6 text-center">
          <p className="text-sm text-[#9fbacc]">
            Master&apos;s Thesis Project | Appalachian State University | 2024-2025
          </p>
        </div>
      </footer>
    </div>
  );
}
