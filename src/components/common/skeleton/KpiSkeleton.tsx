import React from 'react';

interface KpiSkeletonProps {
  className?: string;
}

export const KpiSkeleton: React.FC<KpiSkeletonProps> = ({ className = '' }) => {
  return (
    <div className={`space-y-6 max-w-full font-sans animate-pulse ${className}`}>
      {/* 1. Header controls skeleton */}
      <div className="flex flex-wrap justify-between items-center gap-4 bg-theme-card-bg/40 backdrop-blur-xl border border-theme-border-input/80 p-4 rounded-2xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="h-5 w-64 bg-theme-border-input/50 rounded-md" />
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="h-9 w-28 bg-theme-page-bg border border-theme-border-input/60 rounded-xl" />
          <div className="h-9 w-28 bg-theme-page-bg border border-theme-border-input/60 rounded-xl" />
          <div className="h-9 w-20 bg-theme-page-bg border border-theme-border-input/60 rounded-xl" />
          <div className="h-9 w-20 bg-emerald-600/20 border border-emerald-500/30 rounded-xl" />
          <div className="h-9 w-20 bg-blue-600/30 border border-blue-500/30 rounded-xl" />
        </div>
      </div>

      {/* 2. Main Details & Assessment Card */}
      <div className="bg-theme-card-bg/40 backdrop-blur-xl border border-theme-border-input/80 p-6 rounded-2xl shadow-xl space-y-6">
        {/* Appraisee Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4 text-xs">
          {/* Left Column */}
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="h-3 w-28 bg-theme-border-input/40 rounded" />
              <div className="h-3.5 w-32 bg-theme-border-input/50 rounded font-semibold" />
            </div>
            <div className="flex items-center justify-between">
              <div className="h-3 w-20 bg-theme-border-input/40 rounded" />
              <div className="h-7 w-32 bg-theme-page-bg border border-theme-border-input/60 rounded-lg" />
            </div>
            <div className="flex items-center justify-between">
              <div className="h-3 w-24 bg-theme-border-input/40 rounded" />
              <div className="h-3.5 w-32 bg-theme-border-input/50 rounded" />
            </div>
            <div className="flex items-center justify-between">
              <div className="h-3 w-24 bg-theme-border-input/40 rounded" />
              <div className="h-7 w-32 bg-theme-page-bg border border-theme-border-input/60 rounded-lg" />
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="h-3 w-24 bg-theme-border-input/40 rounded" />
              <div className="h-3.5 w-32 bg-theme-border-input/50 rounded font-semibold" />
            </div>
            <div className="flex items-center justify-between">
              <div className="h-3 w-28 bg-theme-border-input/40 rounded" />
              <div className="h-7 w-48 bg-theme-page-bg border border-theme-border-input/60 rounded-lg" />
            </div>
            <div className="flex items-center justify-between">
              <div className="h-3 w-28 bg-theme-border-input/40 rounded" />
              <div className="h-7 w-48 bg-theme-page-bg border border-theme-border-input/60 rounded-lg" />
            </div>
            <div className="flex items-center justify-between">
              <div className="h-3 w-28 bg-theme-border-input/40 rounded" />
              <div className="h-3.5 w-48 bg-theme-border-input/50 rounded" />
            </div>
          </div>
        </div>

        {/* Goal Sheet banner */}
        <div className="bg-theme-page-bg/60 py-2.5 rounded-xl border border-theme-border-input/60 flex justify-center">
          <div className="h-3 w-24 bg-theme-border-input/60 rounded" />
        </div>

        {/* Table skeleton */}
        <div className="overflow-x-auto rounded-xl border border-theme-border-input/60 shadow-lg">
          <table className="w-full text-left text-xs border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-theme-page-bg/80 border-b border-theme-border-input/60 text-[10px] font-bold uppercase text-theme-text-muted">
                <th className="py-3 px-3 w-16 text-center"><div className="h-3 w-10 bg-theme-border-input/50 rounded mx-auto" /></th>
                <th className="py-3 px-4 w-40"><div className="h-3 w-24 bg-theme-border-input/50 rounded" /></th>
                <th className="py-3 px-4 w-48"><div className="h-3 w-32 bg-theme-border-input/50 rounded" /></th>
                <th className="py-3 px-4 w-48"><div className="h-3 w-32 bg-theme-border-input/50 rounded" /></th>
                <th className="py-3 px-3 w-20 text-center"><div className="h-3 w-12 bg-theme-border-input/50 rounded mx-auto" /></th>
                <th className="py-3 px-3 w-24 text-center"><div className="h-3 w-16 bg-theme-border-input/50 rounded mx-auto" /></th>
                <th className="py-3 px-3 w-20 text-center"><div className="h-3 w-10 bg-theme-border-input/50 rounded mx-auto" /></th>
                <th className="py-3 px-4"><div className="h-3 w-20 bg-theme-border-input/50 rounded" /></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-theme-border-input/40 bg-theme-card-bg/20">
              {[1, 2, 3, 4].map((row) => (
                <tr key={row} className="border-b border-theme-border-input/30">
                  <td className="py-3.5 px-3 border-r border-theme-border-input/40 text-center"><div className="h-3.5 w-6 bg-theme-border-input/50 rounded mx-auto font-mono" /></td>
                  <td className="py-3.5 px-4 border-r border-theme-border-input/40"><div className="h-3.5 w-24 bg-teal-400/40 rounded font-semibold" /></td>
                  <td className="py-3.5 px-4 border-r border-theme-border-input/40"><div className="h-3.5 w-36 bg-theme-border-input/50 rounded" /></td>
                  <td className="py-3.5 px-4 border-r border-theme-border-input/40"><div className="h-3 w-32 bg-theme-border-input/40 rounded" /></td>
                  <td className="py-3.5 px-3 border-r border-theme-border-input/40 text-center"><div className="h-3 w-12 bg-teal-400/40 rounded mx-auto font-mono font-bold" /></td>
                  <td className="py-2.5 px-3 border-r border-theme-border-input/40 text-center"><div className="h-7 w-16 bg-theme-page-bg border border-theme-border-input/60 rounded-lg mx-auto" /></td>
                  <td className="py-2.5 px-3 border-r border-theme-border-input/40 text-center"><div className="h-7 w-16 bg-theme-page-bg border border-theme-border-input/60 rounded-lg mx-auto" /></td>
                  <td className="py-2.5 px-4"><div className="h-7 w-full bg-theme-page-bg border border-theme-border-input/60 rounded-lg" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
