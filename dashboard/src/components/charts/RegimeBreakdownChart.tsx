'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { RegimeKey, RegimeMetrics } from '@/lib/types';

interface RegimeBreakdownChartProps {
  regimes: Partial<Record<RegimeKey, RegimeMetrics>>;
  title?: string;
  height?: number;
}

const REGIME_LABELS: Record<RegimeKey, string> = {
  low: 'Low (Q10)',
  mid: 'Mid',
  high: 'High (Q90+)',
  rising: 'Rising',
  falling: 'Falling',
  high_rising: 'High Rising',
  high_falling: 'High Falling',
  low_rising: 'Low Rising',
  low_falling: 'Low Falling',
};

const PRIMARY_REGIMES: RegimeKey[] = ['low', 'mid', 'high', 'rising', 'falling'];

export default function RegimeBreakdownChart({
  regimes,
  title = 'Skill by Flow Regime',
  height = 300,
}: RegimeBreakdownChartProps) {
  const data = PRIMARY_REGIMES
    .filter((key) => regimes[key] && !regimes[key]!.insufficient && regimes[key]!.ss_rmse != null)
    .map((key) => {
      const r = regimes[key]!;
      return {
        regime: REGIME_LABELS[key],
        ss_rmse: r.ss_rmse ?? 0,
        n_samples: r.n_samples,
        delta_nse: r.delta_nse ?? 0,
      };
    });

  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-[#2a4558] bg-[#0a1a27] p-4">
        {title && <h3 className="mb-2 font-display text-lg text-white">{title}</h3>}
        <div className="flex h-[200px] items-center justify-center text-sm text-[#93b1c6]">
          No regime data available.
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[#2a4558] bg-[#0a1a27] p-4">
      {title && <h3 className="mb-2 font-display text-lg text-white">{title}</h3>}
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 12, right: 22, left: 12, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2e495f" />
          <XAxis
            dataKey="regime"
            stroke="#8ba9bc"
            tick={{ fill: '#8ba9bc', fontSize: 11 }}
          />
          <YAxis
            stroke="#8ba9bc"
            tick={{ fill: '#8ba9bc', fontSize: 11 }}
            label={{ value: 'SS_RMSE', angle: -90, position: 'insideLeft', fill: '#8ba9bc', fontSize: 11 }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#081622',
              border: '1px solid #2e495f',
              borderRadius: '8px',
            }}
            labelStyle={{ color: '#d7e7f1', fontWeight: 600 }}
            formatter={(value: number | undefined) => [`${((value ?? 0) * 100).toFixed(1)}%`, 'RMSE Skill']}
          />
          <Bar dataKey="ss_rmse" name="SS_RMSE" radius={[4, 4, 0, 0]}>
            {data.map((entry, index) => (
              <Cell
                key={`regime-${index}`}
                fill={entry.ss_rmse > 0 ? '#2be3d6' : '#f97373'}
                fillOpacity={0.8}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
