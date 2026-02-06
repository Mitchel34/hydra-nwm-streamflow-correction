'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Label,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { MetricComparison } from '@/lib/types';

interface MetricsBarChartProps {
  data: MetricComparison[];
  title?: string;
}

const COLORS = {
  baseline: '#7e94aa',
  improved: '#2be3d6',
  worsened: '#f97373',
};

const metricLabel: Record<string, string> = {
  RMSE: 'RMSE (m³/s)',
  MAE: 'MAE (m³/s)',
  NSE: 'NSE',
  KGE: 'KGE',
};

export default function MetricsBarChart({ data, title }: MetricsBarChartProps) {
  const normalizedData = data.map((entry) => ({
    ...entry,
    label: metricLabel[entry.metric] || entry.metric,
  }));

  if (normalizedData.length === 0) {
    return (
      <div className="rounded-xl border border-[#2a4558] bg-[#0a1a27] p-4">
        {title && <h3 className="mb-2 font-display text-lg text-white">{title}</h3>}
        <div className="flex h-[300px] items-center justify-center text-sm text-[#93b1c6]">
          Metrics will appear once a completed site/experiment combination is selected.
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[#2a4558] bg-[#0a1a27] p-4">
      {title && <h3 className="mb-2 font-display text-lg text-white">{title}</h3>}
      <ResponsiveContainer width="100%" height={300}>
        <BarChart
          data={normalizedData}
          margin={{ top: 12, right: 22, left: 12, bottom: 28 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#2e495f" />
          <XAxis
            dataKey="metric"
            stroke="#8ba9bc"
            tick={{ fill: '#8ba9bc', fontSize: 12 }}
          >
            <Label
              value="Metric"
              position="insideBottom"
              offset={-12}
              fill="#8ba9bc"
              fontSize={12}
            />
          </XAxis>
          <YAxis stroke="#8ba9bc" tick={{ fill: '#8ba9bc', fontSize: 12 }}>
            <Label
              value="Value"
              angle={-90}
              position="insideLeft"
              offset={0}
              fill="#8ba9bc"
              fontSize={12}
            />
          </YAxis>
          <Tooltip
            contentStyle={{
              backgroundColor: '#081622',
              border: '1px solid #2e495f',
              borderRadius: '8px',
            }}
            labelStyle={{ color: '#d7e7f1', fontWeight: 600 }}
            formatter={(value: number | string | undefined, key: string | undefined, payload) => {
              const numericValue =
                value === undefined
                  ? 0
                  : typeof value === 'number'
                    ? value
                    : Number(value);
              const unitLabel =
                payload?.payload?.metric === 'RMSE' || payload?.payload?.metric === 'MAE'
                  ? ' m³/s'
                  : '';

              if (key === 'baseline') {
                return [`${numericValue.toFixed(3)}${unitLabel}`, 'Baseline (NWM)'];
              }

              if (key === 'corrected') {
                const improvement = payload?.payload?.improvement ?? 0;
                return [
                  `${numericValue.toFixed(3)}${unitLabel} (${improvement > 0 ? '+' : ''}${improvement.toFixed(1)}%)`,
                  'Corrected (Hydra)',
                ];
              }

              return [numericValue.toFixed(3), key];
            }}
          />
          <Legend
            formatter={(value) =>
              value === 'baseline' ? 'Baseline (NWM)' : 'Corrected (Hydra)'
            }
          />
          <Bar dataKey="baseline" fill={COLORS.baseline} name="baseline" radius={[4, 4, 0, 0]} />
          <Bar dataKey="corrected" name="corrected" radius={[4, 4, 0, 0]}>
            {normalizedData.map((entry, index) => (
              <Cell
                key={`metric-cell-${entry.metric}-${index}`}
                fill={entry.improvement > 0 ? COLORS.improved : COLORS.worsened}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
