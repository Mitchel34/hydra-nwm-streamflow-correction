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
} from 'recharts';
import { VersionComparisonRow } from '@/lib/types';

interface VersionComparisonProps {
  data: VersionComparisonRow[];
}

interface VersionTooltipPayload {
  payload: {
    'v2 ΔRMSE%': number;
    'v3 ΔRMSE%': number;
    v2_nse?: number;
    v3_nse?: number;
    v2_exp: string;
    v3_exp: string;
  };
}

interface VersionTooltipProps {
  active?: boolean;
  payload?: VersionTooltipPayload[];
  label?: string;
}

function CustomTooltip({ active, payload, label }: VersionTooltipProps) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div className="rounded-lg border border-[#2a445b] bg-[#0c1b29] p-3 text-sm shadow-lg">
      <p className="font-display text-white mb-2">{label}</p>
      <div className="space-y-1">
        <p className="text-[#95b0c4]">
          <span className="inline-block w-3 h-3 rounded-sm mr-1" style={{ background: '#6b8fad' }} />
          v2 best: <span className="text-white font-medium">{d['v2 ΔRMSE%']}%</span>
          <span className="text-[#6f8ea3] ml-1">({d.v2_exp})</span>
        </p>
        <p className="text-[#95b0c4]">
          NSE = {d.v2_nse?.toFixed(3)}
        </p>
        <hr className="border-[#2a445b] my-1" />
        <p className="text-[#95b0c4]">
          <span className="inline-block w-3 h-3 rounded-sm mr-1" style={{ background: '#2be3d6' }} />
          v3 best: <span className="text-hydra-corrected font-medium">{d['v3 ΔRMSE%']}%</span>
          <span className="text-[#6f8ea3] ml-1">({d.v3_exp})</span>
        </p>
        <p className="text-[#95b0c4]">
          NSE = {d.v3_nse?.toFixed(3)}
        </p>
      </div>
    </div>
  );
}

/**
 * Side-by-side bar chart comparing best v2 vs best v3 results per site.
 */
export default function VersionComparison({ data }: VersionComparisonProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center rounded-lg bg-[#0f202f] text-[#8daec2] text-sm">
        No version comparison data available. Need both v2 and v3 results for at least one site.
      </div>
    );
  }

  const chartData = data.map((row) => {
    // Shorten site names for x-axis
    const shortName = row.site_name
      .replace('South Fork New River near ', '')
      .replace('New River near ', '')
      .replace('Watauga River near ', '')
      .replace(/, [A-Z]{2}$/, '');

    return {
      site: shortName,
      site_id: row.site_id,
      'v2 ΔRMSE%': +row.v2_improvement.toFixed(1),
      'v3 ΔRMSE%': +row.v3_improvement.toFixed(1),
      v2_nse: row.v2_nse,
      v3_nse: row.v3_nse,
      v2_exp: row.v2_experiment,
      v3_exp: row.v3_experiment,
    };
  });

  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} barCategoryGap="20%" barGap={4}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f3549" />
          <XAxis
            dataKey="site"
            tick={{ fill: '#95b0c4', fontSize: 12 }}
            axisLine={{ stroke: '#2a445b' }}
          />
          <YAxis
            tick={{ fill: '#95b0c4', fontSize: 12 }}
            axisLine={{ stroke: '#2a445b' }}
            label={{
              value: 'RMSE Improvement (%)',
              angle: -90,
              position: 'insideLeft',
              fill: '#7f9db2',
              fontSize: 11,
            }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 12, color: '#95b0c4' }}
          />
          <Bar dataKey="v2 ΔRMSE%" fill="#6b8fad" radius={[4, 4, 0, 0]} />
          <Bar dataKey="v3 ΔRMSE%" fill="#2be3d6" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
