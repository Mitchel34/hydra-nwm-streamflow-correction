interface SkeletonLoaderProps {
  type?: 'card' | 'chart' | 'text' | 'metric';
  className?: string;
  lines?: number;
}

function Pulse({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-[#1a2d3f] ${className ?? ''}`} />;
}

export default function SkeletonLoader({
  type = 'text',
  className = '',
  lines = 3,
}: SkeletonLoaderProps) {
  if (type === 'metric') {
    return (
      <div className={`surface-panel rounded-lg p-4 space-y-3 ${className}`}>
        <Pulse className="h-3 w-16" />
        <Pulse className="h-8 w-24" />
        <Pulse className="h-2.5 w-32" />
      </div>
    );
  }

  if (type === 'chart') {
    return (
      <div className={`rounded-xl border border-[#2a4558] bg-[#0a1a27] p-4 ${className}`}>
        <Pulse className="h-[300px] w-full rounded-lg" />
      </div>
    );
  }

  if (type === 'card') {
    return (
      <div className={`surface-panel rounded-xl p-5 space-y-4 ${className}`}>
        <Pulse className="h-4 w-2/3" />
        <Pulse className="h-3 w-full" />
        <Pulse className="h-3 w-4/5" />
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Pulse
          key={i}
          className="h-3"
          style-width={i === lines - 1 ? '60%' : '100%'}
        />
      ))}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="min-h-screen text-white">
      <div className="mx-auto max-w-7xl px-4 md:px-6 py-8 space-y-8">
        {/* Header skeleton */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Pulse className="h-7 w-56" />
            <Pulse className="h-4 w-80" />
          </div>
          <Pulse className="h-4 w-32" />
        </div>

        {/* Experiment selector skeleton */}
        <div className="space-y-3">
          <div className="flex gap-2">
            <Pulse className="h-7 w-12 rounded-full" />
            <Pulse className="h-7 w-20 rounded-full" />
            <Pulse className="h-7 w-20 rounded-full" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Pulse key={i} className="h-20 rounded-xl" />
            ))}
          </div>
        </div>

        {/* Main content skeleton */}
        <div className="grid gap-8 lg:grid-cols-4">
          <div className="space-y-3 lg:col-span-1">
            {Array.from({ length: 3 }).map((_, i) => (
              <Pulse key={i} className="h-36 rounded-xl" />
            ))}
          </div>
          <div className="space-y-8 lg:col-span-3">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonLoader key={i} type="metric" />
              ))}
            </div>
            <Pulse className="h-[420px] rounded-xl" />
            <div className="grid gap-6 lg:grid-cols-2">
              <Pulse className="h-[300px] rounded-xl" />
              <Pulse className="h-[300px] rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
