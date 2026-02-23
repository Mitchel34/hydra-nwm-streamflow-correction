'use client';

import Link from 'next/link';
import { SiteMetadata } from '@/lib/types';

interface SiteCardProps {
  siteId: string;
  metadata: SiteMetadata;
  isSelected: boolean;
  onClick: () => void;
  disabled?: boolean;
  metrics?: {
    rmseImprovement: number;
    nseImprovement: number;
  };
  comparisonLabel?: string;
}

export default function SiteCard({
  siteId,
  metadata,
  isSelected,
  onClick,
  disabled = false,
  metrics,
  comparisonLabel,
}: SiteCardProps) {
  const comparison = comparisonLabel ?? 'vs NWM baseline';
  const rmseText =
    metrics && Number.isFinite(metrics.rmseImprovement)
      ? `${metrics.rmseImprovement > 0 ? 'RMSE reduced' : 'RMSE increased'} by ${Math.abs(
          metrics.rmseImprovement
        ).toFixed(1)}% ${comparison}`
      : 'Awaiting experiment metrics';

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-pressed={isSelected}
      aria-label={`${siteId}. ${metadata.name}. ${rmseText}${disabled ? ' Results pending.' : ''}`}
      className={`w-full rounded-xl border p-4 text-left transition-all ${
        isSelected
          ? 'border-hydra-corrected/55 bg-hydra-corrected/[0.12]'
          : disabled
            ? 'border-[#243847] bg-[#0a151f] opacity-70 cursor-not-allowed'
            : 'border-[#294459] bg-[#0d1d2a] hover:border-[#3b5f79]'
      }`}
    >
      <div className="flex justify-between items-start gap-3">
        <div>
          <h3 className="font-display text-white text-base">{siteId}</h3>
          <p className="text-[#a8c2d4] text-sm mt-1">{metadata.name}</p>
          <div className="flex gap-2 mt-2 flex-wrap">
            <span className="rounded px-2 py-0.5 bg-hydra-accent/[0.18] text-hydra-accent-soft text-xs">
              {metadata.watershed}
            </span>
            <span className="rounded px-2 py-0.5 bg-hydra-observed/[0.16] text-hydra-observed text-xs">
              {metadata.type}
            </span>
          </div>
          <p className="text-xs mt-2 text-[#84a3b8]">
            Lat {metadata.lat.toFixed(3)}, Lon {metadata.lon.toFixed(3)}
          </p>
        </div>
        {metrics && (
          <div className="text-right shrink-0">
            <div
              className={`text-lg font-bold ${
                metrics.rmseImprovement > 0 ? 'text-hydra-corrected' : 'text-hydra-alert'
              }`}
            >
              {metrics.rmseImprovement > 0 ? '↓' : '↑'}
              {Math.abs(metrics.rmseImprovement).toFixed(1)}%
            </div>
            <div className="text-[#82a1b6] text-xs">RMSE</div>
          </div>
        )}
      </div>
      <div className="mt-3 rounded-md border border-[#2a4255] bg-[#091522] px-2.5 py-2 text-xs text-[#9cb7c9] leading-relaxed">
        {rmseText}
      </div>
      {disabled && (
        <div className="mt-2 text-xs uppercase tracking-[0.09em] text-[#7e99ad]">
          Pending metrics
        </div>
      )}
      {!disabled && (
        <Link
          href={`/experiments/site/${siteId}`}
          onClick={(e) => e.stopPropagation()}
          className="mt-2 flex items-center gap-1 py-2 text-xs uppercase tracking-[0.09em] text-hydra-corrected/70 hover:text-hydra-corrected transition-colors"
        >
          Deep dive
          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      )}
    </button>
  );
}
