import React from 'react';

interface AnalyticsSkeletonProps {
  className?: string;
}

export const AnalyticsSkeleton: React.FC<AnalyticsSkeletonProps> = ({ className = '' }) => {
  const card = 'bg-slate-900/20 border border-slate-800/40 rounded-2xl backdrop-blur-md animate-pulse';
  const bar = 'bg-slate-800/40 rounded-lg';

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header: Title + Yearly/Monthly toggle + Month + Year */}
      <div className={`flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 ${card} p-4`}>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className={`w-5 h-5 rounded ${bar}`} />
            <div className={`h-5 w-56 ${bar}`} />
          </div>
          <div className={`h-3 w-72 bg-slate-800/30 rounded`} />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Yearly/Monthly toggle */}
          <div className="flex items-center bg-slate-950/40 border border-slate-850 p-1 rounded-xl gap-1">
            <div className={`h-7 w-16 ${bar} rounded-lg`} />
            <div className="h-7 w-20 bg-blue-600/20 rounded-lg" />
          </div>
          {/* Month selector */}
          <div className={`h-9 w-28 ${bar} rounded-xl`} />
          {/* Year selector */}
          <div className={`h-9 w-28 ${bar} rounded-xl`} />
        </div>
      </div>

      {/* 4 stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
        {[
          { w: 'w-24', val: 'w-12' },
          { w: 'w-28', val: 'w-10' },
          { w: 'w-24', val: 'w-8' },
          { w: 'w-20', val: 'w-10' },
        ].map((item, i) => (
          <div key={i} className="bg-slate-955 border border-slate-850/40 p-5 rounded-2xl flex flex-col justify-between h-36">
            <div className="flex justify-between items-start">
              <div className="space-y-2">
                <div className={`h-3 ${item.w} bg-slate-800 rounded-md`} />
                <div className={`h-8 ${item.val} bg-slate-800 rounded-lg`} />
                <div className="h-5 w-20 bg-red-900/20 border border-red-800/20 rounded-md" />
              </div>
              <div className="w-12 h-12 bg-slate-800/60 rounded-xl" />
            </div>
            <div className="h-3 w-36 bg-slate-800/40 rounded-md" />
          </div>
        ))}
      </div>

      {/* Charts row: Bar chart (2/3) + Branch Contribution (1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-pulse">
        {/* Monthly bar chart */}
        <div className="lg:col-span-2 bg-slate-955 border border-slate-850/40 p-5 rounded-2xl flex flex-col gap-4" style={{ height: '340px' }}>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-slate-800/60 rounded" />
            <div className="h-4 w-52 bg-slate-800 rounded-md" />
          </div>
          {/* Bar chart body */}
          <div className="flex-1 flex items-end gap-2 px-2">
            {Array.from({ length: 12 }).map((_, idx) => (
              <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full rounded-t-sm"
                  style={{
                    height: `${30 + ((idx * 37) % 55)}%`,
                    background: idx === 6
                      ? 'rgba(96,165,250,0.4)'
                      : 'rgba(100,116,139,0.25)',
                  }}
                />
                <div className="h-2.5 w-6 bg-slate-800/40 rounded" />
              </div>
            ))}
          </div>
          {/* Legend */}
          <div className="flex items-center gap-4 pt-1">
            {['bg-blue-500/40', 'bg-purple-500/40', 'bg-pink-500/40', 'bg-emerald-500/40'].map((color, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <div className={`w-3 h-3 rounded-full ${color}`} />
                <div className="h-2.5 w-12 bg-slate-800/40 rounded" />
              </div>
            ))}
          </div>
        </div>

        {/* Branch contribution */}
        <div className="bg-slate-955 border border-slate-850/40 p-5 rounded-2xl flex flex-col gap-5 animate-pulse" style={{ height: '340px' }}>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-slate-800/60 rounded" />
            <div className="h-4 w-36 bg-slate-800 rounded-md" />
          </div>
          <div className="space-y-4 flex-1">
            {[65, 50, 48, 42, 38].map((pct, i) => (
              <div key={i} className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <div className="h-3.5 w-12 bg-slate-800 rounded-md" />
                  <div className="h-3 w-28 bg-slate-800/60 rounded-md" />
                </div>
                <div className="h-2 w-full bg-slate-850 rounded-full">
                  <div
                    className="h-2 rounded-full bg-slate-700/60"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Leaderboard section */}
      <div className="bg-slate-955 border border-slate-850/40 p-5 rounded-2xl animate-pulse">
        <div className="flex items-center gap-2 mb-5">
          <div className="w-4 h-4 bg-slate-800/60 rounded" />
          <div className="h-4 w-48 bg-slate-800 rounded-md" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-slate-950/40 border border-slate-850/40 p-4 rounded-xl flex flex-col items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-800/60" />
              <div className="h-3.5 w-16 bg-slate-800 rounded-md" />
              <div className="h-3 w-12 bg-slate-800/50 rounded-md" />
              <div className="w-full border-t border-slate-850/30 my-0.5" />
              <div className="h-5 w-10 bg-slate-800 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
