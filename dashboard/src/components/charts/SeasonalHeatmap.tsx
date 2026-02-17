'use client';

import { SeasonKey, WindowEval } from '@/lib/types';

interface SeasonalHeatmapProps {
  seasonal: Partial<Record<SeasonKey, WindowEval>>;
  title?: string;
}

const SEASONS: SeasonKey[] = ['DJF', 'MAM', 'JJA', 'SON'];
const SEASON_LABELS: Record<SeasonKey, string> = {
  DJF: 'Winter',
  MAM: 'Spring',
  JJA: 'Summer',
  SON: 'Fall',
};

const METRICS = [
  { key: 'ss_rmse', label: 'SS_RMSE', path: (w: WindowEval) => w.headline?.ss_rmse?.value },
  { key: 'delta_nse', label: '\u0394NSE', path: (w: WindowEval) => w.headline?.delta_nse?.value },
  { key: 'delta_kge', label: '\u0394KGE', path: (w: WindowEval) => w.headline?.delta_kge?.value },
  { key: 'ss_var_err', label: 'Var. Red.', path: (w: WindowEval) => w.distribution?.ss_var_err?.value },
];

function getColor(value: number | null | undefined): string {
  if (value == null || isNaN(value)) return '#1a2d3d';
  // Scale from red (-0.5) through gray (0) to teal (+0.5)
  const clamped = Math.max(-0.5, Math.min(0.5, value));
  if (clamped >= 0) {
    const t = clamped / 0.5;
    const r = Math.round(26 + (43 - 26) * (1 - t));
    const g = Math.round(45 + (227 - 45) * t);
    const b = Math.round(61 + (214 - 61) * t);
    return `rgb(${r}, ${g}, ${b})`;
  } else {
    const t = Math.abs(clamped) / 0.5;
    const r = Math.round(26 + (249 - 26) * t);
    const g = Math.round(45 + (115 - 45) * (1 - t));
    const b = Math.round(61 + (115 - 61) * (1 - t));
    return `rgb(${r}, ${g}, ${b})`;
  }
}

export default function SeasonalHeatmap({ seasonal, title = 'Seasonal Performance' }: SeasonalHeatmapProps) {
  return (
    <div className="rounded-xl border border-[#2a4558] bg-[#0a1a27] p-4">
      {title && <h3 className="mb-3 font-display text-lg text-white">{title}</h3>}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th className="text-left px-3 py-2 text-xs text-[#8fb4cc]">Metric</th>
              {SEASONS.map((s) => (
                <th key={s} className="px-3 py-2 text-xs text-[#8fb4cc] text-center">
                  {s}
                  <div className="text-[0.6rem] text-[#6f8da0] font-normal">{SEASON_LABELS[s]}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {METRICS.map(({ key, label, path }) => (
              <tr key={key} className="border-t border-[#22384b]">
                <td className="px-3 py-2 text-sm text-[#a9c2d3]">{label}</td>
                {SEASONS.map((s) => {
                  const windowEval = seasonal[s];
                  const value = windowEval && !windowEval.insufficient ? path(windowEval) : null;
                  return (
                    <td key={s} className="px-3 py-2 text-center">
                      <div
                        className="inline-block rounded px-2 py-1 text-sm font-mono min-w-[60px]"
                        style={{ backgroundColor: getColor(value), color: value != null ? '#fff' : '#6f8da0' }}
                      >
                        {value != null ? (value > 0 ? '+' : '') + value.toFixed(3) : '--'}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
