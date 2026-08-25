import React from 'react';

interface ReportsDashboardSkeletonProps {
  className?: string;
}

export const ReportsDashboardSkeleton: React.FC<ReportsDashboardSkeletonProps> = ({
  className = '',
}) => {
  return (
    <div className={`space-y-6 max-w-full font-sans animate-pulse ${className}`}>
      {/* 1. Header Filter Bar Skeleton */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-theme-card-bg/40 backdrop-blur-xl p-4 border border-theme-border-input/80 rounded-2xl shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 bg-blue-500/30 rounded" />
            <div className="h-5 w-48 bg-theme-border-input/50 rounded-md" />
          </div>
          <div className="h-3 w-72 bg-theme-border-input/30 rounded" />
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto shrink-0">
          <div className="h-9 w-32 bg-theme-page-bg border border-theme-border-input/60 rounded-xl" />
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="h-9 w-28 bg-theme-page-bg border border-theme-border-input/60 rounded-xl" />
            <div className="h-9 w-24 bg-theme-page-bg border border-theme-border-input/60 rounded-xl" />
          </div>
        </div>
      </div>

      {/* 2. Summary Cards Skeleton (4 Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div
            key={idx}
            className="bg-theme-card-bg/40 backdrop-blur-xl border border-theme-border-input/80 p-5 rounded-2xl shadow-xl space-y-3"
          >
            <div className="flex justify-between items-start">
              <div className="space-y-2">
                <div className="h-3 w-20 bg-theme-border-input/40 rounded" />
                <div className="h-7 w-16 bg-theme-border-input/60 rounded-md font-mono" />
                <div className="h-4 w-14 bg-theme-border-input/30 rounded-md" />
              </div>
              <div className="h-10 w-10 bg-theme-page-bg border border-theme-border-input/60 rounded-xl" />
            </div>
            <div className="h-2.5 w-32 bg-theme-border-input/30 rounded pt-2" />
          </div>
        ))}
      </div>

      {/* 3. Charts Grid Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Monthly Volumes Chart Skeleton (2 cols) */}
        <div className="lg:col-span-2 bg-theme-card-bg/40 backdrop-blur-xl border border-theme-border-input/80 p-5 rounded-2xl shadow-xl flex flex-col justify-between min-h-96">
          <div className="flex items-center gap-2 mb-6">
            <div className="h-4.5 w-4.5 bg-blue-500/30 rounded" />
            <div className="h-4 w-60 bg-theme-border-input/50 rounded" />
          </div>

          {/* Bar Chart Area */}
          <div className="flex-1 flex items-end justify-between gap-4 px-6 pb-6 border-b border-theme-border-input/40 min-h-52">
            {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((m, i) => (
              <div key={m} className="flex flex-col items-center gap-2 flex-1">
                <div
                  className="w-full max-w-[18px] bg-theme-border-input/40 rounded-t"
                  style={{ height: `${(i === 6 || i === 7) ? (i === 7 ? 140 : 80) : 10}px` }}
                />
                <span className="text-[10px] text-theme-text-muted font-mono">{m}</span>
              </div>
            ))}
          </div>

          {/* Bottom Legend */}
          <div className="flex items-center justify-center gap-6 pt-4">
            <div className="flex items-center gap-1.5"><div className="h-2.5 w-2.5 rounded-full bg-blue-500/50" /><div className="h-2.5 w-12 bg-theme-border-input/40 rounded" /></div>
            <div className="flex items-center gap-1.5"><div className="h-2.5 w-2.5 rounded-full bg-purple-500/50" /><div className="h-2.5 w-14 bg-theme-border-input/40 rounded" /></div>
            <div className="flex items-center gap-1.5"><div className="h-2.5 w-2.5 rounded-full bg-pink-500/50" /><div className="h-2.5 w-12 bg-theme-border-input/40 rounded" /></div>
            <div className="flex items-center gap-1.5"><div className="h-2.5 w-2.5 rounded-full bg-emerald-500/50" /><div className="h-2.5 w-10 bg-theme-border-input/40 rounded" /></div>
          </div>
        </div>

        {/* Right: Branches Contribution Skeleton (1 col) */}
        <div className="bg-theme-card-bg/40 backdrop-blur-xl border border-theme-border-input/80 p-5 rounded-2xl shadow-xl flex flex-col justify-between">
          <div className="flex items-center gap-2 mb-6">
            <div className="h-4.5 w-4.5 bg-emerald-500/30 rounded" />
            <div className="h-4 w-48 bg-theme-border-input/50 rounded" />
          </div>

          <div className="space-y-5 flex-1">
            {[
              { name: 'ADI', pct: 75 },
              { name: 'PRIDE', pct: 60 },
              { name: 'AQ', pct: 55 },
              { name: 'RIDE', pct: 45 },
              { name: 'BC', pct: 35 },
            ].map((b) => (
              <div key={b.name} className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <div className="h-3 w-12 bg-theme-border-input/50 rounded font-bold" />
                  <div className="h-3 w-24 bg-theme-border-input/40 rounded" />
                </div>
                <div className="w-full h-2.5 bg-theme-page-bg border border-theme-border-input/60 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-theme-border-input/60 rounded-full"
                    style={{ width: `${b.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
