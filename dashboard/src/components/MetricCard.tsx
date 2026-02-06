interface MetricCardProps {
  label: string;
  baseline: number;
  corrected: number;
  unit?: string;
  higherIsBetter?: boolean;
}

export default function MetricCard({
  label,
  baseline,
  corrected,
  unit = '',
  higherIsBetter = false,
}: MetricCardProps) {
  const improvement = higherIsBetter
    ? corrected - baseline
    : baseline - corrected;
  const improvementPct = baseline !== 0 ? (improvement / Math.abs(baseline)) * 100 : 0;
  const isImproved = improvement > 0;

  return (
    <div className="surface-panel rounded-lg p-4">
      <div className="text-[#91afc4] text-sm mb-2">{label}</div>
      <div className="flex items-end gap-3">
        <div className="text-2xl font-bold text-white">
          {corrected.toFixed(3)}
          <span className="text-[#87a8be] text-sm ml-1">{unit}</span>
        </div>
        <div
          className={`text-sm ${
            isImproved ? 'text-hydra-corrected' : 'text-hydra-alert'
          }`}
        >
          {isImproved ? '↑' : '↓'} {Math.abs(improvementPct).toFixed(1)}%
        </div>
      </div>
      <div className="text-[#7896ab] text-xs mt-1">
        Baseline: {baseline.toFixed(3)} {unit}
      </div>
      <div className="text-[#6f8da0] text-[0.68rem] mt-1 uppercase tracking-[0.07em]">
        vs NWM baseline
      </div>
    </div>
  );
}
