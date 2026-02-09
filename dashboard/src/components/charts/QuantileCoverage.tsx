'use client';

import { QuantileCoverage as QC } from '@/lib/types';

interface QuantileCoverageProps {
  /** Map of quantile level (e.g. "0.10") to {coverage, bias} */
  quantiles: Record<string, QC>;
  experimentName?: string;
}

/**
 * Displays quantile coverage vs expected for calibration assessment.
 */
export default function QuantileCoverage({
  quantiles,
  experimentName,
}: QuantileCoverageProps) {
  const levels = Object.entries(quantiles)
    .map(([level, data]) => ({
      level: parseFloat(level),
      expected: parseFloat(level) * 100,
      actual: data.coverage * 100,
      bias: data.bias,
    }))
    .sort((a, b) => a.level - b.level);

  if (levels.length === 0) {
    return (
      <div className="text-sm text-[#8daec2] p-4">No quantile data available.</div>
    );
  }

  return (
    <div className="space-y-4">
      {experimentName && (
        <p className="text-xs text-[#7f9db2] uppercase tracking-[0.1em]">
          Quantile calibration — {experimentName}
        </p>
      )}
      <div className="space-y-3">
        {levels.map(({ level, expected, actual, bias }) => {
          const diff = actual - expected;
          const isCalibrated = Math.abs(diff) < 5; // within 5% is "good"
          const barWidth = Math.min(Math.max(actual, 0), 100);

          return (
            <div key={level}>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-[#95b0c4] font-mono">
                  Q{(level * 100).toFixed(0)}
                </span>
                <span className="flex items-center gap-2">
                  <span
                    className={`text-xs font-medium ${
                      isCalibrated
                        ? 'text-hydra-corrected'
                        : Math.abs(diff) < 10
                          ? 'text-yellow-400'
                          : 'text-hydra-alert'
                    }`}
                  >
                    {actual.toFixed(1)}%
                    <span className="text-[#6f8ea3] ml-1">
                      (exp {expected.toFixed(0)}%)
                    </span>
                  </span>
                </span>
              </div>

              {/* Bar */}
              <div className="relative h-4 w-full rounded bg-[#142536]">
                {/* Actual coverage bar */}
                <div
                  className={`absolute inset-y-0 left-0 rounded transition-all ${
                    isCalibrated
                      ? 'bg-hydra-corrected/40'
                      : diff > 0
                        ? 'bg-yellow-500/30'
                        : 'bg-hydra-alert/30'
                  }`}
                  style={{ width: `${barWidth}%` }}
                />
                {/* Expected marker */}
                <div
                  className="absolute inset-y-0 w-0.5 bg-white/50"
                  style={{ left: `${expected}%` }}
                />
              </div>

              {/* Bias */}
              <div className="text-[0.65rem] text-[#6f8ea3] mt-0.5">
                Bias: {bias > 0 ? '+' : ''}
                {bias.toFixed(3)} m³/s
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-[0.65rem] text-[#6f8ea3] pt-2 border-t border-[#1f3549]">
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-sm bg-hydra-corrected/40" />
          Well-calibrated (&lt;5% diff)
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-sm bg-yellow-500/30" />
          Moderate (5-10%)
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-sm bg-hydra-alert/30" />
          Poor (&gt;10%)
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-0.5 bg-white/50" />
          Expected
        </span>
      </div>
    </div>
  );
}
