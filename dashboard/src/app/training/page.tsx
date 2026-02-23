'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';

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

const ERA5_FEATURES = [
  { name: 'temp_c', label: 'Temperature', desc: 'Air temperature at 2m' },
  { name: 'dewpoint_c', label: 'Dewpoint', desc: 'Dewpoint temperature at 2m' },
  { name: 'pressure_hpa', label: 'Pressure', desc: 'Surface pressure' },
  { name: 'precip_mm', label: 'Precipitation', desc: 'Total hourly precipitation' },
  { name: 'radiation_mj_m2', label: 'Radiation', desc: 'Surface solar radiation' },
  { name: 'wind_speed', label: 'Wind Speed', desc: '10m wind speed' },
  { name: 'vpd_kpa', label: 'VPD', desc: 'Vapor pressure deficit' },
  { name: 'rel_humidity_pct', label: 'Humidity', desc: 'Relative humidity' },
  { name: 'soil_moisture_vwc', label: 'Soil Moisture', desc: 'Volumetric water content' },
  { name: 'hour_sin/cos', label: 'Hour Encoding', desc: 'Cyclical hour of day' },
  { name: 'doy_sin/cos', label: 'Day-of-Year', desc: 'Cyclical day of year' },
  { name: 'month_sin/cos', label: 'Month Encoding', desc: 'Cyclical month' },
];

const LOSS_COMPONENTS = [
  {
    name: 'Gaussian NLL',
    desc: 'Heteroscedastic negative log-likelihood on residual and corrected predictions. Learns per-sample uncertainty.',
    always: true,
    tag: 'core',
  },
  {
    name: 'Consistency Loss',
    desc: 'MSE between corrected prediction and observed streamflow. Ensures residual + NWM aligns with direct correction.',
    always: true,
    tag: 'core',
  },
  {
    name: 'Non-Negativity Penalty',
    desc: 'Physics constraint penalizing negative streamflow: relu(-Q)^2. Streamflow cannot be negative.',
    always: false,
    tag: 'physics',
  },
  {
    name: 'NSE Surrogate',
    desc: 'Differentiable Nash-Sutcliffe Efficiency proxy. Directly optimizes the standard hydrological skill metric.',
    always: false,
    tag: 'hydrology',
  },
  {
    name: 'KGE Stabilizer',
    desc: 'Kling-Gupta decomposition into correlation, variability ratio, and bias ratio components.',
    always: false,
    tag: 'hydrology',
  },
  {
    name: 'Quantile Pinball',
    desc: 'Pinball loss for probabilistic prediction intervals. Calibrates uncertainty quantiles.',
    always: false,
    tag: 'uncertainty',
  },
];

const ABLATION_GROUPS = [
  {
    title: 'Architecture Ablation',
    desc: 'Compare encoder architectures while holding inputs and training procedure constant.',
    experiments: ['LSTM', 'Transformer-only', 'GRU-Transformer v2', 'Hydra v3'],
    color: 'from-blue-500/20 to-blue-600/20 border-blue-500/30',
  },
  {
    title: 'Training Ablation',
    desc: 'Vary training constraints and data sampling strategies on the best architecture.',
    experiments: ['Causal attention mask', 'Non-negativity constraint', 'Event oversampling (3x Q90+)', 'Combined configurations'],
    color: 'from-teal-500/20 to-teal-600/20 border-teal-500/30',
  },
  {
    title: 'Input Feature Ablation',
    desc: 'Test which input sources drive predictive skill.',
    experiments: ['NWM + ERA5 (standard)', 'ERA5-only (no NWM)', 'USGS + NWM + ERA5', 'USGS + ERA5 (no NWM)'],
    color: 'from-purple-500/20 to-purple-600/20 border-purple-500/30',
  },
];

export default function TrainingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden text-white">
      <div className="pointer-events-none absolute inset-0 opacity-[0.13] [background-image:linear-gradient(transparent_95%,rgba(134,171,196,0.22)_95%),linear-gradient(90deg,transparent_95%,rgba(134,171,196,0.18)_95%)] [background-size:28px_28px]" />

      <Navigation />

      <main className="relative z-10">
        <div className="mx-auto max-w-7xl px-4 md:px-6 pt-12 pb-20">
          {/* Hero */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-12"
          >
            <h1 className="font-display text-4xl font-semibold tracking-tight md:text-6xl">
              <span className="gradient-text">Training Pipeline</span>
            </h1>
            <p className="mt-4 max-w-3xl text-lg text-[#a9c2d3]">
              From raw hydrometeorological data to a trained error-correction model.
              This page documents the complete pipeline: data assembly, feature engineering,
              optimization strategy, and experiment design.
            </p>
          </motion.div>

          {/* Architecture Diagram */}
          <motion.section
            className="mb-16"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <h2 className="mb-5 text-center font-display text-sm uppercase tracking-[0.28em] text-[#8fb4cc]">
              Model Architecture
            </h2>
            <div className="surface-panel rounded-2xl p-4 md:p-8">
              <div className="relative w-full overflow-hidden rounded-xl bg-[#0a1520]">
                <Image
                  src="/images/architecture_diagram.png"
                  alt="Hydra v3 architecture diagram showing the GRU-Transformer hybrid pipeline"
                  width={1200}
                  height={600}
                  className="w-full h-auto"
                  priority
                />
              </div>
              <p className="mt-4 text-center text-sm text-[#8fb4cc]">
                Hydra v3 architecture: Feature Importance Gate, GRU encoder, Multi-Scale Temporal Convolutions,
                Transformer encoder with attention pooling, and regime-conditioned bias correction.
              </p>
            </div>
          </motion.section>

          {/* Data Assembly */}
          <motion.section
            className="mb-16"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <h2 className="mb-6 font-display text-2xl gradient-text">Data Assembly</h2>
            <div className="grid gap-6 md:grid-cols-3">
              <div className="surface-panel rounded-2xl p-6">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-hydra-baseline/20">
                  <span className="text-lg text-hydra-baseline">N</span>
                </div>
                <h3 className="font-display text-base mb-2 text-white">NWM v2.1 Retrospective</h3>
                <p className="text-sm text-[#afc6d7]">
                  Hourly CHRTOUT streamflow analysis from the National Water Model retrospective run (1979-2020).
                  Provides the baseline forecast that Hydra corrects.
                </p>
                <p className="mt-3 font-mono text-xs text-hydra-accent">nwm_cms</p>
              </div>

              <div className="surface-panel rounded-2xl p-6">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-hydra-observed/20">
                  <span className="text-lg text-hydra-observed">U</span>
                </div>
                <h3 className="font-display text-base mb-2 text-white">USGS Streamflow</h3>
                <p className="text-sm text-[#afc6d7]">
                  Hourly observed discharge from USGS gauging stations. Serves as ground truth
                  for computing residuals and evaluating model skill.
                </p>
                <p className="mt-3 font-mono text-xs text-hydra-accent">usgs_cms</p>
              </div>

              <div className="surface-panel rounded-2xl p-6">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-hydra-corrected/20">
                  <span className="text-lg text-hydra-corrected">E</span>
                </div>
                <h3 className="font-display text-base mb-2 text-white">ERA5 / ERA5-Land</h3>
                <p className="text-sm text-[#afc6d7]">
                  Meteorological reanalysis providing atmospheric and land-surface variables.
                  6-hourly data reindexed to hourly with nearest-neighbor (tolerance = 3h, no future leakage).
                </p>
                <p className="mt-3 font-mono text-xs text-hydra-accent">15 features</p>
              </div>
            </div>

            <div className="mt-6 surface-panel rounded-2xl p-6">
              <h3 className="font-display text-base mb-3 text-white">Target Variables</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-[#264257] bg-[#0c1a26] p-4">
                  <p className="font-mono text-sm text-hydra-corrected mb-1">Residual Mode (default)</p>
                  <p className="font-mono text-xs text-[#afc6d7]">y_residual = USGS - NWM</p>
                  <p className="mt-2 text-xs text-[#8fb4cc]">Model predicts the NWM error; corrected flow = NWM + predicted residual</p>
                </div>
                <div className="rounded-xl border border-[#264257] bg-[#0c1a26] p-4">
                  <p className="font-mono text-sm text-hydra-corrected mb-1">Direct Mode</p>
                  <p className="font-mono text-xs text-[#afc6d7]">y_corrected = USGS</p>
                  <p className="mt-2 text-xs text-[#8fb4cc]">Model directly predicts observed streamflow without explicit residual decomposition</p>
                </div>
              </div>
            </div>
          </motion.section>

          {/* Input Features */}
          <motion.section
            className="mb-16"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.35 }}
          >
            <h2 className="mb-6 font-display text-2xl gradient-text">Input Features</h2>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="surface-panel rounded-2xl p-6">
                <h3 className="font-display text-base mb-4 text-white">ERA5 Meteorological Features</h3>
                <div className="space-y-2">
                  {ERA5_FEATURES.map((f, i) => (
                    <motion.div
                      key={f.name}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.4 + i * 0.03 }}
                      className="flex items-center justify-between py-1.5 border-b border-[#1a2d3f] last:border-0"
                    >
                      <div>
                        <span className="text-sm text-[#c2d8e8]">{f.label}</span>
                        <span className="ml-2 text-xs text-[#7f9db2]">{f.desc}</span>
                      </div>
                      <span className="font-mono text-xs text-hydra-accent/70">{f.name}</span>
                    </motion.div>
                  ))}
                </div>
              </div>

              <div className="space-y-6">
                <div className="surface-panel rounded-2xl p-6">
                  <h3 className="font-display text-base mb-3 text-white">Normalization</h3>
                  <ul className="space-y-3">
                    <li className="flex gap-2 text-sm text-[#afc6d7]">
                      <span className="text-hydra-corrected mt-0.5">1.</span>
                      <span><strong className="text-[#c2d8e8]">Z-score normalization</strong> computed on training split only, then applied identically to validation and test splits. Prevents information leakage.</span>
                    </li>
                    <li className="flex gap-2 text-sm text-[#afc6d7]">
                      <span className="text-hydra-corrected mt-0.5">2.</span>
                      <span><strong className="text-[#c2d8e8]">asinh target transform</strong> applied to residual and corrected targets. Stabilizes variance across low-flow and high-flow regimes without log-domain issues at zero.</span>
                    </li>
                    <li className="flex gap-2 text-sm text-[#afc6d7]">
                      <span className="text-hydra-corrected mt-0.5">3.</span>
                      <span><strong className="text-[#c2d8e8]">Per-site training</strong> &mdash; each gauge is trained independently to prevent cross-site sequence leakage.</span>
                    </li>
                  </ul>
                </div>

                <div className="surface-panel rounded-2xl p-6">
                  <h3 className="font-display text-base mb-3 text-white">Data Augmentation</h3>
                  <p className="text-sm text-[#afc6d7]">
                    During training, each input sequence has a 50% chance of being perturbed with
                    additive Gaussian noise (<span className="font-mono text-hydra-accent">sigma = 0.05</span>).
                    This regularizes against overfitting to exact feature values and improves generalization
                    to unseen weather patterns.
                  </p>
                </div>
              </div>
            </div>
          </motion.section>

          {/* Data Splits Timeline */}
          <motion.section
            className="mb-16"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <h2 className="mb-6 font-display text-2xl gradient-text">Data Splits</h2>
            <div className="surface-panel rounded-2xl p-6 md:p-8">
              {/* Timeline bar */}
              <div className="mb-6">
                <div className="flex h-14 rounded-xl overflow-hidden border border-[#264257]">
                  <div
                    className="flex items-center justify-center bg-blue-600/30 border-r border-[#264257]"
                    style={{ width: '72.7%' }}
                  >
                    <span className="font-display text-xs uppercase tracking-wider text-blue-300">
                      Train (8 yr)
                    </span>
                  </div>
                  <div
                    className="flex items-center justify-center bg-yellow-500/20 border-r border-[#264257]"
                    style={{ width: '9.1%' }}
                  >
                    <span className="font-display text-xs uppercase tracking-wider text-yellow-300 hidden sm:inline">
                      Val
                    </span>
                  </div>
                  <div
                    className="flex items-center justify-center bg-hydra-corrected/20"
                    style={{ width: '18.2%' }}
                  >
                    <span className="font-display text-xs uppercase tracking-wider text-hydra-corrected">
                      Test (2 yr)
                    </span>
                  </div>
                </div>
                <div className="flex justify-between mt-2 text-xs text-[#7f9db2] font-mono">
                  <span>2010</span>
                  <span>2018</span>
                  <span>2019</span>
                  <span>2021</span>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
                  <h4 className="font-display text-sm text-blue-300 mb-1">Training</h4>
                  <p className="font-mono text-xs text-[#afc6d7]">2010-01-01 to 2017-12-31</p>
                  <p className="mt-1 text-xs text-[#8fb4cc]">8 years of hourly data per site (~70,000 samples)</p>
                </div>
                <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4">
                  <h4 className="font-display text-sm text-yellow-300 mb-1">Validation</h4>
                  <p className="font-mono text-xs text-[#afc6d7]">2018-01-01 to 2018-12-31</p>
                  <p className="mt-1 text-xs text-[#8fb4cc]">1 year for early stopping and hyperparameter selection</p>
                </div>
                <div className="rounded-xl border border-hydra-corrected/20 bg-hydra-corrected/5 p-4">
                  <h4 className="font-display text-sm text-hydra-corrected mb-1">Test</h4>
                  <p className="font-mono text-xs text-[#afc6d7]">2019-01-01 to 2020-12-31</p>
                  <p className="mt-1 text-xs text-[#8fb4cc]">2 years held out for final evaluation (never seen during training)</p>
                </div>
              </div>
            </div>
          </motion.section>

          {/* Training Configuration */}
          <motion.section
            className="mb-16"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.45 }}
          >
            <h2 className="mb-6 font-display text-2xl gradient-text">Training Configuration</h2>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5 mb-8">
              <StatCard label="Epochs" value="40" description="Maximum training epochs" delay={0.5} />
              <StatCard label="Batch Size" value="64" description="Sequences per gradient step" delay={0.55} />
              <StatCard label="Sequence" value="168" unit="h" description="7-day input window" delay={0.6} />
              <StatCard label="Learn Rate" value="5e-4" description="Initial learning rate" delay={0.65} />
              <StatCard label="Patience" value="5" description="Early stopping epochs" delay={0.7} />
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="surface-panel rounded-2xl p-6">
                <h3 className="font-display text-lg mb-4 text-white">Optimizer</h3>
                <dl className="space-y-3">
                  {[
                    ['Primary', 'Ranger (RAdam + Lookahead)'],
                    ['Fallback', 'AdamW'],
                    ['Weight Decay', '5e-5'],
                    ['LR Schedule (Ranger)', 'ReduceOnPlateau (patience=3, factor=0.5)'],
                    ['LR Schedule (AdamW)', 'CosineAnnealing (T_max=epochs)'],
                  ].map(([label, value], i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.5 + i * 0.05 }}
                      className="flex justify-between items-start gap-4"
                    >
                      <dt className="text-sm text-[#afc6d7] shrink-0">{label}</dt>
                      <dd className="font-mono text-sm text-hydra-corrected text-right">{value}</dd>
                    </motion.div>
                  ))}
                </dl>
              </div>

              <div className="surface-panel rounded-2xl p-6">
                <h3 className="font-display text-lg mb-4 text-white">Training Details</h3>
                <dl className="space-y-3">
                  {[
                    ['Mixed Precision', 'FP16 via torch.autocast (GPU)'],
                    ['Gradient Clipping', 'max_norm = 1.0'],
                    ['Best Model', 'Checkpoint with lowest val loss'],
                    ['Target Transform', 'asinh(x) for variance stabilization'],
                    ['Sites', 'Trained independently per gauge'],
                  ].map(([label, value], i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.5 + i * 0.05 }}
                      className="flex justify-between items-start gap-4"
                    >
                      <dt className="text-sm text-[#afc6d7] shrink-0">{label}</dt>
                      <dd className="font-mono text-sm text-hydra-corrected text-right">{value}</dd>
                    </motion.div>
                  ))}
                </dl>
              </div>
            </div>
          </motion.section>

          {/* Loss Function */}
          <motion.section
            className="mb-16"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
          >
            <h2 className="mb-6 font-display text-2xl gradient-text">Multi-Objective Loss</h2>
            <div className="surface-panel rounded-2xl p-6 md:p-8">
              <p className="text-sm text-[#afc6d7] mb-6 max-w-3xl">
                The training loss combines multiple objectives. Core terms are always active;
                optional terms are enabled per-experiment. A <strong className="text-[#c2d8e8]">LossAutoNormalizer</strong> uses
                exponential moving averages to keep all components at unit scale, so weights act as
                pure priority signals.
              </p>

              <div className="space-y-3">
                {LOSS_COMPONENTS.map((comp, i) => {
                  const tagColors: Record<string, string> = {
                    core: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
                    physics: 'bg-green-500/20 text-green-300 border-green-500/30',
                    hydrology: 'bg-teal-500/20 text-teal-300 border-teal-500/30',
                    uncertainty: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
                  };

                  return (
                    <motion.div
                      key={comp.name}
                      initial={{ opacity: 0, x: -15 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.55 + i * 0.06 }}
                      className="flex items-start gap-4 rounded-xl border border-[#264257] bg-[#0c1a26] p-4"
                    >
                      <div className="shrink-0 mt-0.5">
                        <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-mono ${
                          comp.always
                            ? 'bg-hydra-corrected/15 text-hydra-corrected border-hydra-corrected/30'
                            : 'bg-[#1a2d3f] text-[#7f9db2] border-[#35526a]'
                        }`}>
                          {comp.always ? 'always' : 'optional'}
                        </span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-display text-sm text-white">{comp.name}</h4>
                          <span className={`rounded-full border px-1.5 py-0.5 text-[0.6rem] font-mono ${tagColors[comp.tag]}`}>
                            {comp.tag}
                          </span>
                        </div>
                        <p className="text-xs text-[#8fb4cc] leading-relaxed">{comp.desc}</p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </motion.section>

          {/* Experiment Design */}
          <motion.section
            className="mb-16"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.55 }}
          >
            <h2 className="mb-6 font-display text-2xl gradient-text">Experiment Design</h2>
            <p className="text-sm text-[#afc6d7] mb-6 max-w-3xl">
              19 experiments across 3 study sites systematically ablate architecture, training strategy,
              and input features. Each experiment uses identical data splits and evaluation protocol.
            </p>

            <div className="grid gap-6 md:grid-cols-3">
              {ABLATION_GROUPS.map((group, i) => (
                <motion.div
                  key={group.title}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 + i * 0.08 }}
                  className={`rounded-2xl border bg-gradient-to-b p-6 ${group.color}`}
                >
                  <h3 className="font-display text-base mb-2 text-white">{group.title}</h3>
                  <p className="text-xs text-[#afc6d7] mb-4">{group.desc}</p>
                  <ul className="space-y-1.5">
                    {group.experiments.map((exp) => (
                      <li key={exp} className="flex gap-2 text-sm text-[#c2d8e8]">
                        <span className="text-hydra-corrected">-</span>
                        {exp}
                      </li>
                    ))}
                  </ul>
                </motion.div>
              ))}
            </div>
          </motion.section>

          {/* CTA */}
          <motion.div
            className="mt-16 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.6 }}
          >
            <p className="text-[#a9c2d3] mb-4">
              Now that you understand the training pipeline, see how different configurations perform.
            </p>
            <Link
              href="/experiments"
              className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-hydra-accent to-hydra-corrected px-8 py-3 font-display font-medium text-[#022133] shadow-lg transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_25px_rgba(43,227,214,0.26)]"
            >
              <span>Explore Experiments</span>
              <svg className="h-5 w-5 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          </motion.div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
