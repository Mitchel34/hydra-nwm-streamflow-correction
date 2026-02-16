'use client';

import { motion } from 'framer-motion';
import Navigation from '@/components/Navigation';
import { useState } from 'react';

interface StatCardProps {
  label: string;
  value: string;
  unit?: string;
  description: string;
  delay?: number;
}

function StatCard({ label, value, unit, description, delay = 0 }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className="surface-panel rounded-2xl p-6"
    >
      <h3 className="font-display text-sm uppercase tracking-[0.2em] text-hydra-accent-soft/85">
        {label}
      </h3>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="gradient-text font-display text-4xl font-bold">{value}</span>
        {unit && <span className="text-lg text-[#8fb4cc]">{unit}</span>}
      </div>
      <p className="mt-2 text-sm text-[#afc6d7]">{description}</p>
    </motion.div>
  );
}

interface ComponentBreakdownProps {
  name: string;
  params: number;
  percentage: number;
  delay?: number;
}

function ComponentBreakdown({ name, params, percentage, delay = 0 }: ComponentBreakdownProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay }}
      className="group relative"
    >
      <div className="flex items-center justify-between py-3">
        <span className="text-sm text-[#c2d8e8] group-hover:text-white transition-colors">
          {name}
        </span>
        <div className="flex items-center gap-4">
          <span className="font-mono text-sm text-[#8fb4cc]">
            {params.toLocaleString()}
          </span>
          <span className="font-mono text-sm text-hydra-accent">
            {percentage.toFixed(1)}%
          </span>
        </div>
      </div>
      <div className="h-1 bg-[#1a2d3f] rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.8, delay: delay + 0.2, ease: 'easeOut' }}
          className="h-full bg-gradient-to-r from-hydra-accent to-hydra-corrected"
        />
      </div>
    </motion.div>
  );
}

interface DeploymentOptionProps {
  device: string;
  ram: string;
  feasible: 'yes' | 'marginal' | 'no';
  inferenceTime: string;
  notes: string;
  delay?: number;
}

function DeploymentOption({
  device,
  ram,
  feasible,
  inferenceTime,
  notes,
  delay = 0,
}: DeploymentOptionProps) {
  const feasibleColors = {
    yes: 'text-green-400 border-green-400/30 bg-green-400/10',
    marginal: 'text-yellow-400 border-yellow-400/30 bg-yellow-400/10',
    no: 'text-red-400 border-red-400/30 bg-red-400/10',
  };

  const feasibleIcons = {
    yes: '✓',
    marginal: '⚠',
    no: '✗',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="surface-panel rounded-xl p-5 hover:border-hydra-accent/30 transition-colors"
    >
      <div className="flex items-start justify-between mb-3">
        <h4 className="font-display text-base text-white">{device}</h4>
        <span
          className={`rounded-full border px-2 py-0.5 text-xs font-mono ${feasibleColors[feasible]}`}
        >
          {feasibleIcons[feasible]}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div>
          <span className="text-xs text-[#8fb4cc]">RAM</span>
          <p className="font-mono text-sm text-[#c2d8e8]">{ram}</p>
        </div>
        <div>
          <span className="text-xs text-[#8fb4cc]">Inference</span>
          <p className="font-mono text-sm text-[#c2d8e8]">{inferenceTime}</p>
        </div>
      </div>
      <p className="text-xs text-[#afc6d7] leading-relaxed">{notes}</p>
    </motion.div>
  );
}

export default function ModelPage() {
  const [selectedTab, setSelectedTab] = useState<'architecture' | 'deployment' | 'requirements'>(
    'architecture'
  );

  const components = [
    { name: 'Transformer Encoder (4 layers)', params: 529920, percentage: 53.1 },
    { name: 'Multi-Scale Temporal Convolutions', params: 255363, percentage: 25.6 },
    { name: 'Fusion Network', params: 82048, percentage: 8.2 },
    { name: 'Attention Pooling', params: 66048, percentage: 6.6 },
    { name: 'GRU Encoder', params: 56064, percentage: 5.6 },
    { name: 'Regime-Conditioned Bias', params: 4161, percentage: 0.4 },
    { name: 'Feature Importance Gate', params: 4240, percentage: 0.4 },
    { name: 'Prediction Heads & Other', params: 804, percentage: 0.1 },
  ];

  const deploymentOptions = [
    {
      device: 'Raspberry Pi 4 (4GB)',
      ram: '4 GB',
      feasible: 'yes' as const,
      inferenceTime: '2-10 sec',
      notes: 'CPU-only with PyTorch. Suitable for demonstration and prototyping.',
    },
    {
      device: 'Raspberry Pi 5 (8GB)',
      ram: '8 GB',
      feasible: 'yes' as const,
      inferenceTime: '1-5 sec',
      notes: 'Faster ARM CPU provides better performance for edge deployment.',
    },
    {
      device: 'NVIDIA Jetson Nano',
      ram: '4 GB',
      feasible: 'yes' as const,
      inferenceTime: '50-200 ms',
      notes: 'GPU acceleration makes this ideal for real-time monitoring applications.',
    },
    {
      device: 'Raspberry Pi Zero 2',
      ram: '512 MB',
      feasible: 'marginal' as const,
      inferenceTime: '15-30 sec',
      notes: 'Very tight memory constraints. Requires ONNX Runtime and quantization.',
    },
    {
      device: 'Intel NUC (i5+)',
      ram: '8 GB',
      feasible: 'yes' as const,
      inferenceTime: '20-100 ms',
      notes: 'x86 architecture with optimized PyTorch. Excellent for local deployment.',
    },
    {
      device: 'Mobile/Smartphone',
      ram: '4+ GB',
      feasible: 'yes' as const,
      inferenceTime: '1-5 sec',
      notes: 'Requires TensorFlow Lite conversion. Suitable for field monitoring apps.',
    },
  ];

  return (
    <div className="relative min-h-screen overflow-hidden text-white">
      <div className="pointer-events-none absolute inset-0 opacity-[0.13] [background-image:linear-gradient(transparent_95%,rgba(134,171,196,0.22)_95%),linear-gradient(90deg,transparent_95%,rgba(134,171,196,0.18)_95%)] [background-size:28px_28px]" />

      <Navigation />

      <main className="relative z-10">
        <div className="mx-auto max-w-7xl px-6 pt-12 pb-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-12"
          >
            <h1 className="font-display text-4xl font-semibold tracking-tight md:text-6xl">
              <span className="gradient-text">Model Architecture</span>
            </h1>
            <p className="mt-4 max-w-3xl text-lg text-[#a9c2d3]">
              Hydra v3 is a compact yet powerful hybrid model combining GRU encoding with
              multi-scale transformer attention for streamflow error correction.
            </p>
          </motion.div>

          {/* Key Stats */}
          <div className="grid gap-6 md:grid-cols-4 mb-16">
            <StatCard
              label="Total Parameters"
              value="998,648"
              description="~1 million trainable parameters"
              delay={0.1}
            />
            <StatCard
              label="Model Size"
              value="3.81"
              unit="MB"
              description="Float32 precision weights"
              delay={0.2}
            />
            <StatCard
              label="Input Features"
              value="16"
              description="NWM + ERA5 meteorological"
              delay={0.3}
            />
            <StatCard
              label="Sequence Length"
              value="168"
              description="7 days hourly timesteps"
              delay={0.4}
            />
          </div>

          {/* Tab Navigation */}
          <div className="mb-8 flex gap-2 border-b border-[#2a455c]/55">
            {[
              { id: 'architecture', label: 'Architecture' },
              { id: 'deployment', label: 'Deployment' },
              { id: 'requirements', label: 'Requirements' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSelectedTab(tab.id as typeof selectedTab)}
                className={`px-4 py-2 font-display text-sm tracking-wide transition-colors ${
                  selectedTab === tab.id
                    ? 'border-b-2 border-hydra-corrected text-white'
                    : 'text-[#8fb4cc] hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Architecture Tab */}
          {selectedTab === 'architecture' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              <div className="surface-panel rounded-2xl p-8 mb-8">
                <h2 className="font-display text-2xl mb-6 gradient-text">
                  Parameter Distribution
                </h2>
                <p className="text-sm text-[#afc6d7] mb-6">
                  The model's 998,648 parameters are distributed across specialized components,
                  with the transformer encoder comprising over half of the total capacity.
                </p>
                <div className="space-y-1">
                  {components.map((component, i) => (
                    <ComponentBreakdown key={i} {...component} delay={i * 0.05} />
                  ))}
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="surface-panel rounded-2xl p-6">
                  <h3 className="font-display text-lg mb-4 text-white">Configuration</h3>
                  <dl className="space-y-3">
                    {[
                      ['Hidden Dimension', 'd_model = 128'],
                      ['Attention Heads', 'num_heads = 4'],
                      ['Transformer Layers', 'num_layers = 4'],
                      ['Dropout Rate', 'dropout = 0.1'],
                      ['Multi-Scale Branches', '3 (short, mid, long)'],
                    ].map(([label, value], i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="flex justify-between items-center"
                      >
                        <dt className="text-sm text-[#afc6d7]">{label}</dt>
                        <dd className="font-mono text-sm text-hydra-corrected">{value}</dd>
                      </motion.div>
                    ))}
                  </dl>
                </div>

                <div className="surface-panel rounded-2xl p-6">
                  <h3 className="font-display text-lg mb-4 text-white">Key Features</h3>
                  <ul className="space-y-3">
                    {[
                      'Feature importance gating for precipitation emphasis',
                      'Multi-scale temporal convolutions (1-7 day ranges)',
                      'Regime-conditioned bias correction',
                      'Attention pooling with learnable query token',
                      'Hybrid GRU-Transformer architecture',
                    ].map((feature, i) => (
                      <motion.li
                        key={i}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="flex gap-2 text-sm text-[#afc6d7]"
                      >
                        <span className="text-hydra-corrected">→</span>
                        {feature}
                      </motion.li>
                    ))}
                  </ul>
                </div>
              </div>
            </motion.div>
          )}

          {/* Deployment Tab */}
          {selectedTab === 'deployment' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              <div className="mb-8">
                <h2 className="font-display text-2xl mb-3 gradient-text">
                  Edge Device Compatibility
                </h2>
                <p className="text-sm text-[#afc6d7] max-w-3xl">
                  The model's compact 3.81 MB size enables deployment on resource-constrained
                  edge devices. While memory requirements are modest, inference speed varies
                  significantly based on hardware capabilities.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-12">
                {deploymentOptions.map((option, i) => (
                  <DeploymentOption key={i} {...option} delay={i * 0.05} />
                ))}
              </div>

              <div className="grid gap-6 md:grid-cols-3">
                <div className="surface-panel rounded-2xl p-6">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-hydra-accent/30 to-hydra-corrected/30">
                    <svg className="h-5 w-5 text-hydra-corrected" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                    </svg>
                  </div>
                  <h3 className="font-display text-base mb-2 text-white">Cloud Deployment</h3>
                  <p className="text-sm text-[#afc6d7]">
                    AWS/GCP/Azure instances with GPU acceleration. Ideal for production
                    forecasting services with sub-100ms latency.
                  </p>
                </div>

                <div className="surface-panel rounded-2xl p-6">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-hydra-accent/30 to-hydra-corrected/30">
                    <svg className="h-5 w-5 text-hydra-corrected" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                    </svg>
                  </div>
                  <h3 className="font-display text-base mb-2 text-white">Edge Monitoring</h3>
                  <p className="text-sm text-[#afc6d7]">
                    On-site deployment at gauging stations using Raspberry Pi or Jetson.
                    5-15W power consumption for continuous monitoring.
                  </p>
                </div>

                <div className="surface-panel rounded-2xl p-6">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-hydra-accent/30 to-hydra-corrected/30">
                    <svg className="h-5 w-5 text-hydra-corrected" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <h3 className="font-display text-base mb-2 text-white">Mobile Apps</h3>
                  <p className="text-sm text-[#afc6d7]">
                    TensorFlow Lite conversion enables deployment on smartphones for
                    field researchers and emergency responders.
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Requirements Tab */}
          {selectedTab === 'requirements' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              <div className="grid gap-6 md:grid-cols-2 mb-8">
                <div className="surface-panel rounded-2xl p-6">
                  <h3 className="font-display text-xl mb-4 gradient-text">Training</h3>
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-medium text-[#c2d8e8] mb-2">Minimum</h4>
                      <ul className="space-y-1 text-sm text-[#afc6d7]">
                        <li>• CPU: 4+ cores, 2.0+ GHz</li>
                        <li>• RAM: 8 GB</li>
                        <li>• Storage: 10 GB</li>
                        <li>• GPU: Optional (4+ GB VRAM)</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-[#c2d8e8] mb-2">Recommended</h4>
                      <ul className="space-y-1 text-sm text-[#afc6d7]">
                        <li>• CPU: 8+ cores, 3.0+ GHz</li>
                        <li>• RAM: 16 GB</li>
                        <li>• Storage: 50 GB SSD</li>
                        <li>• GPU: NVIDIA RTX 3060+ (12 GB)</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="surface-panel rounded-2xl p-6">
                  <h3 className="font-display text-xl mb-4 gradient-text">Inference</h3>
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-medium text-[#c2d8e8] mb-2">Memory Usage</h4>
                      <ul className="space-y-1 text-sm text-[#afc6d7]">
                        <li>• Model weights: 3.81 MB</li>
                        <li>• Input tensor: ~10.7 KB</li>
                        <li>• Activations: 50-100 MB</li>
                        <li>• Peak RAM: ~150-200 MB</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-[#c2d8e8] mb-2">Performance</h4>
                      <ul className="space-y-1 text-sm text-[#afc6d7]">
                        <li>• Desktop CPU: 10-50 ms</li>
                        <li>• GPU (CUDA): 1-5 ms</li>
                        <li>• Edge (Pi 4): 2-10 sec</li>
                        <li>• Edge (Jetson): 50-200 ms</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              <div className="surface-panel rounded-2xl p-8">
                <h3 className="font-display text-xl mb-4 gradient-text">Software Dependencies</h3>
                <div className="grid gap-6 md:grid-cols-3">
                  <div>
                    <h4 className="text-sm font-medium text-[#c2d8e8] mb-3">PyTorch (Full)</h4>
                    <ul className="space-y-1 text-sm text-[#afc6d7]">
                      <li>• Size: ~150-200 MB</li>
                      <li>• Platforms: All major OS</li>
                      <li>• ARM Support: Yes (CPU)</li>
                      <li>• Best for: Development</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-[#c2d8e8] mb-3">ONNX Runtime</h4>
                    <ul className="space-y-1 text-sm text-[#afc6d7]">
                      <li>• Size: ~10-20 MB</li>
                      <li>• Platforms: Cross-platform</li>
                      <li>• ARM Support: Excellent</li>
                      <li>• Best for: Production</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-[#c2d8e8] mb-3">TensorFlow Lite</h4>
                    <ul className="space-y-1 text-sm text-[#afc6d7]">
                      <li>• Size: ~1-2 MB</li>
                      <li>• Platforms: Mobile/embedded</li>
                      <li>• ARM Support: Optimized</li>
                      <li>• Best for: Mobile apps</li>
                    </ul>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </main>

      <footer className="relative z-10 border-t border-[#2a455c]/55 bg-[#06131f]/75 py-8">
        <div className="mx-auto max-w-7xl px-6 text-center">
          <p className="text-sm text-[#9fbacc]">
            Master&apos;s Thesis Project | Appalachian State University | 2024–2025
          </p>
        </div>
      </footer>
    </div>
  );
}
