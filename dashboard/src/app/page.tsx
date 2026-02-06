'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';

// Dynamic import for 3D logo (client-side only)
const HydraLogo3D = dynamic(() => import('@/components/HydraLogo3D'), {
  ssr: false,
  loading: () => (
    <div className="h-[400px] flex items-center justify-center">
      <div className="w-24 h-24 rounded-full bg-gradient-to-br from-hydra-purple to-hydra-blue animate-pulse" />
    </div>
  ),
});

// Feature card component
function FeatureCard({
  icon,
  title,
  description,
  delay = 0,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className="bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-xl p-6 hover:border-hydra-purple/50 transition-colors"
    >
      <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-hydra-purple to-hydra-blue flex items-center justify-center mb-4">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      <p className="text-gray-400 text-sm">{description}</p>
    </motion.div>
  );
}

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white overflow-hidden">
      {/* Background gradient effect */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% 20%, rgba(139, 92, 246, 0.15) 0%, transparent 50%), radial-gradient(ellipse 60% 40% at 70% 60%, rgba(59, 130, 246, 0.1) 0%, transparent 50%)',
        }}
      />

      {/* Navigation */}
      <nav className="relative z-10 border-b border-gray-800/50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-hydra-purple to-hydra-blue" />
            <span className="font-bold text-lg">HYDRA</span>
          </div>
          <Link
            href="/dashboard"
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            Dashboard →
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="relative z-10">
        <div className="max-w-7xl mx-auto px-6 pt-12 pb-20">
          {/* 3D Logo */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8 }}
          >
            <HydraLogo3D height="350px" />
          </motion.div>

          {/* Title */}
          <motion.div
            className="text-center mt-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <h1 className="text-6xl md:text-7xl font-bold tracking-tight">
              <span className="gradient-text">HYDRA</span>
            </h1>
            <p className="text-xl md:text-2xl text-hydra-silver mt-4 font-light">
              <span className="shimmer-text">
                Hybrid Deep-learning for Residual Analysis
              </span>
            </p>
            <p className="text-gray-400 mt-6 max-w-2xl mx-auto text-lg">
              A transformer-based machine learning system for correcting errors in
              National Water Model streamflow predictions across the Appalachian
              region.
            </p>
          </motion.div>

          {/* CTA Button */}
          <motion.div
            className="flex justify-center mt-10"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
          >
            <Link
              href="/dashboard"
              className="group relative inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-hydra-purple to-hydra-blue rounded-full font-semibold text-white shadow-lg hover:shadow-hydra-purple/25 transition-all duration-300 hover:scale-105"
            >
              <span>Explore Results</span>
              <svg
                className="w-5 h-5 group-hover:translate-x-1 transition-transform"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 7l5 5m0 0l-5 5m5-5H6"
                />
              </svg>
            </Link>
          </motion.div>

          {/* Features Grid */}
          <div className="mt-24 grid md:grid-cols-3 gap-6">
            <FeatureCard
              delay={0.6}
              icon={
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              }
              title="Multi-Site Analysis"
              description="Compare model performance across 4 USGS gauging stations in the New River and Watauga watersheds."
            />
            <FeatureCard
              delay={0.7}
              icon={
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              }
              title="Experiment Comparison"
              description="Evaluate different model configurations including causal masking, physics constraints, and architecture variations."
            />
            <FeatureCard
              delay={0.8}
              icon={
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                </svg>
              }
              title="Interactive Visualizations"
              description="Explore hydrographs, error distributions, and performance metrics with interactive D3.js charts."
            />
          </div>

          {/* Stats Section */}
          <motion.div
            className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.9 }}
          >
            {[
              { value: '4', label: 'Study Sites' },
              { value: '21%', label: 'Avg RMSE Reduction' },
              { value: '6', label: 'Experiments' },
              { value: '2010-2020', label: 'Study Period' },
            ].map((stat, i) => (
              <div key={i} className="text-center">
                <div className="text-3xl md:text-4xl font-bold gradient-text">
                  {stat.value}
                </div>
                <div className="text-gray-500 text-sm mt-1">{stat.label}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-gray-800/50 py-8">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <p className="text-gray-500 text-sm">
            Master&apos;s Thesis Project | Appalachian State University | 2024-2025
          </p>
          <p className="text-gray-600 text-xs mt-2">
            Hydra Transformer for NWM Streamflow Error Correction
          </p>
        </div>
      </footer>
    </div>
  );
}
