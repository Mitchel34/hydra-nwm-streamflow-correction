import { CIMetric } from '@/lib/types';
import SignificanceBadge from './SignificanceBadge';

interface SkillScoreCardProps {
  label: string;
  metric: CIMetric;
  pValue?: number | null;
  format?: (v: number) => string;
  positiveIsGood?: boolean;
  description?: string;
}

export default function SkillScoreCard({
  label,
  metric,
  pValue,
  format = (v) => v.toFixed(3),
  positiveIsGood = true,
  description,
}: SkillScoreCardProps) {
  const value = metric.value;
  if (value == null) return null;

  const isGood = positiveIsGood ? value > 0 : value < 0;
  const hasCI = metric.ci != null && metric.ci.length === 2;

  // CI bar visualization (min/max range scaled to a bar)
  let ciBarStyle: React.CSSProperties | undefined;
  if (hasCI && metric.ci) {
    const [lo, hi] = metric.ci;
    const range = Math.abs(hi - lo);
    const center = (lo + hi) / 2;
    // Normalize relative to the value for visual width
    const maxExtent = Math.max(Math.abs(lo), Math.abs(hi), Math.abs(value)) || 1;
    const barLeft = ((lo / maxExtent + 1) / 2) * 100;
    const barRight = ((hi / maxExtent + 1) / 2) * 100;
    ciBarStyle = {
      left: `${Math.max(0, Math.min(100, barLeft))}%`,
      width: `${Math.max(2, Math.min(100, barRight - barLeft))}%`,
    };
  }

  return (
    <div className="surface-panel rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[#91afc4] text-sm">{label}</span>
        {pValue != null && <SignificanceBadge pValue={pValue} />}
      </div>
      <div className={`text-2xl font-bold ${isGood ? 'text-hydra-corrected' : 'text-hydra-alert'}`}>
        {value > 0 && positiveIsGood ? '+' : ''}{format(value)}
      </div>
      {hasCI && metric.ci && (
        <div className="mt-2">
          <div className="relative h-1.5 bg-[#1a2d3d] rounded-full overflow-hidden">
            <div
              className={`absolute h-full rounded-full ${isGood ? 'bg-hydra-corrected/40' : 'bg-hydra-alert/40'}`}
              style={ciBarStyle}
            />
          </div>
          <div className="flex justify-between text-[0.65rem] text-[#6f8da0] mt-1">
            <span>{format(metric.ci[0])}</span>
            <span className="text-[#8fb4cc]">95% CI</span>
            <span>{format(metric.ci[1])}</span>
          </div>
        </div>
      )}
      {description && (
        <div className="text-[#6f8da0] text-[0.68rem] mt-1.5">{description}</div>
      )}
    </div>
  );
}
