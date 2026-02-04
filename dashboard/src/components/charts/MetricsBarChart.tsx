'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { MetricComparison } from '@/lib/types';

interface MetricsBarChartProps {
  data: MetricComparison[];
  title?: string;
}

const COLORS = {
  baseline: '#6b7280',
  improved: '#10b981',
  worsened: '#ef4444',
};

export default function MetricsBarChart({ data, title }: MetricsBarChartProps) {
  return (
    <div className="bg-gray-900 rounded-lg p-4">
      {title && (
        <h3 className="text-lg font-semibold text-white mb-4">{title}</h3>
      )}
      <ResponsiveContainer width="100%" height={300}>
        <BarChart
          data={data}
          margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="metric" stroke="#9ca3af" tick={{ fill: '#9ca3af' }} />
          <YAxis stroke="#9ca3af" tick={{ fill: '#9ca3af' }} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1f2937',
              border: '1px solid #374151',
              borderRadius: '4px',
            }}
            labelStyle={{ color: '#e5e7eb' }}
            formatter={(value: number | undefined, name: string | undefined) => [
              value !== undefined ? value.toFixed(3) : '',
              name === 'baseline' ? 'Baseline (NWM)' : 'Corrected (Hydra)',
            ]}
          />
          <Legend
            formatter={(value) =>
              value === 'baseline' ? 'Baseline (NWM)' : 'Corrected (Hydra)'
            }
          />
          <Bar dataKey="baseline" fill={COLORS.baseline} name="baseline" />
          <Bar dataKey="corrected" name="corrected">
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.improvement > 0 ? COLORS.improved : COLORS.worsened}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
