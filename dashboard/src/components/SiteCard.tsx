'use client';

import { SiteMetadata } from '@/lib/types';

interface SiteCardProps {
  siteId: string;
  metadata: SiteMetadata;
  isSelected: boolean;
  onClick: () => void;
  metrics?: {
    rmseImprovement: number;
    nseImprovement: number;
  };
}

export default function SiteCard({
  siteId,
  metadata,
  isSelected,
  onClick,
  metrics,
}: SiteCardProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
        isSelected
          ? 'border-indigo-500 bg-indigo-500/10'
          : 'border-gray-700 bg-gray-800 hover:border-gray-600'
      }`}
    >
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-white font-semibold">{siteId}</h3>
          <p className="text-gray-400 text-sm mt-1">{metadata.name}</p>
          <div className="flex gap-2 mt-2">
            <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded">
              {metadata.watershed}
            </span>
            <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs rounded">
              {metadata.type}
            </span>
          </div>
        </div>
        {metrics && (
          <div className="text-right">
            <div
              className={`text-lg font-bold ${
                metrics.rmseImprovement > 0 ? 'text-green-400' : 'text-red-400'
              }`}
            >
              {metrics.rmseImprovement > 0 ? '↓' : '↑'}
              {Math.abs(metrics.rmseImprovement).toFixed(1)}%
            </div>
            <div className="text-gray-500 text-xs">RMSE</div>
          </div>
        )}
      </div>
    </button>
  );
}
