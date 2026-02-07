'use client';

import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';

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
  const experimentSummary = [
    { experiment: 'Causal Mask', avgImprovement: '+9.8%', bestSite: 'Galax, VA (21.3%)' },
    { experiment: 'Physics Constraint', avgImprovement: '+7.6%', bestSite: 'Jefferson, NC (21.5%)' },
    { experiment: 'Direct Mode', avgImprovement: '+5.7%', bestSite: 'Sugar Grove, NC (5.8%)' },
    { experiment: 'Baseline', avgImprovement: '+2.2%', bestSite: 'Galax, VA (10.6%)' },
    { experiment: 'Combined', avgImprovement: '-24.7%', bestSite: 'Unstable at regulated' },
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

        {/* Key Findings */}
        <section className="mb-12">
          <h2 className="font-display text-sm uppercase tracking-[0.28em] text-[#8fb4cc] mb-5">
            Key Findings
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
              value="79%"
              description="15 of 19 experiments improved"
              positive={true}
            />
            <FindingCard
              icon={
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              }
              title="Unregulated Sites"
              value="+11.0%"
              description="Average RMSE improvement"
              positive={true}
            />
            <FindingCard
              icon={
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              }
              title="Regulated Site"
              value="-25.6%"
              description="Dam operations challenge"
              positive={false}
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
              <h3 className="font-display text-lg text-white mb-2">Regulated Site Challenges</h3>
              <p className="text-[#a9c2d3] leading-relaxed">
                Site 03486000 (Elizabethton, TN) presents unique challenges due to Watauga Dam
                operations introducing non-stationarity in flow patterns. The combined experiment
                shows significant degradation (-98.1%), suggesting that dam operation signals
                require explicit incorporation into the feature space or specialized architectures.
              </p>
            </div>
          </div>
        </section>

        {/* Recommendations */}
        <section className="mb-12">
          <h2 className="font-display text-sm uppercase tracking-[0.28em] text-[#8fb4cc] mb-5">
            Recommendations
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="surface-panel rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-hydra-corrected/20 text-hydra-corrected text-sm font-bold">1</span>
                <h3 className="font-display text-white">Production Deployment</h3>
              </div>
              <p className="text-sm text-[#a9c2d3]">
                Prioritize physics-constrained or causal mask configurations for unregulated sites
              </p>
            </div>
            <div className="surface-panel rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-hydra-accent/20 text-hydra-accent text-sm font-bold">2</span>
                <h3 className="font-display text-white">Regulated Sites</h3>
              </div>
              <p className="text-sm text-[#a9c2d3]">
                Consider ensemble approaches or dam operation feature engineering
              </p>
            </div>
            <div className="surface-panel rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-hydra-observed/20 text-hydra-observed text-sm font-bold">3</span>
                <h3 className="font-display text-white">Future Work</h3>
              </div>
              <p className="text-sm text-[#a9c2d3]">
                Investigate attention patterns during floods, transfer learning across scales
              </p>
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
