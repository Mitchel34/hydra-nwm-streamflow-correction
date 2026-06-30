'use client';

import { ExperimentResult, ExperimentMetadata } from '@/lib/types';
import { getExperimentLabels } from '@/lib/experiment-context';
import { getExperimentCategory } from '@/lib/types';
import { getExperimentSourceLabel, getPublicExperimentName } from '@/lib/labels';

interface ComparisonViewProps {
  experiments: ExperimentResult[];
  experimentMetadata: Record<string, ExperimentMetadata>;
  siteId: string;
  siteName: string;
}

const COMPARISON_COLORS = ['#2be3d6', '#f59e0b', '#ec4899'];

export default function ComparisonView({
  experiments,
  experimentMetadata,
  siteName,
}: ComparisonViewProps) {
  if (experiments.length === 0) {
    return (
      <div className="surface-panel rounded-xl p-6 text-center text-[#8fb4cc]">
        Select experiments to compare for {siteName}.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h3 className="font-display text-lg text-white">
        Comparing {experiments.length} experiments at {siteName}
      </h3>

      {/* Comparison Table */}
      <div className="surface-panel rounded-xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-[#122334]">
            <tr>
              <th className="text-left px-5 py-3 text-sm font-display text-[#8fb4cc]">Experiment</th>
              <th className="text-left px-5 py-3 text-sm font-display text-[#8fb4cc]">Type</th>
              <th className="text-right px-5 py-3 text-sm font-display text-[#8fb4cc]">RMSE</th>
              <th className="text-right px-5 py-3 text-sm font-display text-[#8fb4cc]">NSE</th>
              <th className="text-right px-5 py-3 text-sm font-display text-[#8fb4cc]">KGE</th>
              <th className="text-right px-5 py-3 text-sm font-display text-[#8fb4cc]">RMSE Δ</th>
            </tr>
          </thead>
          <tbody>
            {experiments.map((result, i) => {
              const name = getPublicExperimentName(
                result.experiment,
                experimentMetadata[result.experiment]?.name,
              );
              const category = getExperimentCategory(result.experiment);
              const color = COMPARISON_COLORS[i % COMPARISON_COLORS.length];
              const improvement = result.rmse_improvement_pct ?? 0;

              return (
                <tr key={result.experiment} className="border-t border-[#22384b]">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block h-3 w-3 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                      <span className="text-white">{name}</span>
                    </div>
                  </td>
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
                  <td className="px-5 py-3 text-right font-mono text-sm text-[#c2d8e8]">
                    {(result.corrected.kge ?? 0).toFixed(3)}
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

      {/* Metric cards side-by-side */}
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.min(experiments.length, 3)}, 1fr)` }}>
        {experiments.map((result, i) => {
          const name = getPublicExperimentName(
            result.experiment,
            experimentMetadata[result.experiment]?.name,
          );
          const labels = getExperimentLabels(result.experiment);
          const color = COMPARISON_COLORS[i % COMPARISON_COLORS.length];

          return (
            <div key={result.experiment} className="surface-panel rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <span className="font-display text-sm text-white">{name}</span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-[#8fb4cc]">RMSE</span>
                  <span className="text-white font-mono">{(result.corrected.rmse ?? 0).toFixed(3)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8fb4cc]">NSE</span>
                  <span className="text-white font-mono">{(result.corrected.nse ?? 0).toFixed(3)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8fb4cc]">KGE</span>
                  <span className="text-white font-mono">{(result.corrected.kge ?? 0).toFixed(3)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8fb4cc]">MAE</span>
                  <span className="text-white font-mono">{(result.corrected.mae ?? 0).toFixed(3)}</span>
                </div>
                <div className="mt-2 pt-2 border-t border-[#22384b] text-xs text-[#7f9db2]">
                  {labels.comparisonLabel}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
