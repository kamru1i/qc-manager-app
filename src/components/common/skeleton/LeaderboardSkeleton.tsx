import React from 'react';

interface LeaderboardSkeletonProps {
  className?: string;
}

export const LeaderboardSkeleton: React.FC<LeaderboardSkeletonProps> = ({ className = '' }) => {
  const card = 'bg-slate-900/20 border border-slate-800/40 rounded-2xl backdrop-blur-md animate-pulse';
  const bar = 'bg-slate-800/40 rounded-lg';

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header: Title + Search Skeleton + Month Filter + View Report Button */}
      <div className={`flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 ${card} p-5`}>
        {/* Left: Title Skeleton */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded ${bar}`} />
            <div className={`h-6 w-56 ${bar}`} />
          </div>
          <div className={`h-3.5 w-72 bg-slate-800/30 rounded-lg`} />
        </div>

        {/* Center: Search input skeleton */}
        <div className="w-full lg:w-64 xl:w-80">
          <div className={`h-9 w-full bg-slate-950/40 border border-slate-800/40 rounded-xl`} />
        </div>

        {/* Right: Controls Skeleton */}
        <div className="flex items-center gap-3 flex-wrap w-full lg:w-auto justify-end">
          {/* Month selector skeleton (fixed width w-28) */}
          <div className={`h-9 w-28 bg-slate-850/60 border border-slate-800/40 rounded-xl`} />
          {/* View Report button skeleton */}
          <div className="h-9 w-28 bg-blue-600/25 rounded-xl border border-blue-600/10" />
        </div>
      </div>

      {/* Table Skeleton */}
      <div className="bg-slate-950/40 border border-slate-850/60 rounded-2xl overflow-hidden animate-pulse shadow-xl">
        <div className="p-5 border-b border-slate-850/30 flex justify-between items-center bg-slate-900/20">
          <div className="h-4.5 w-48 bg-slate-800 rounded-md" />
          <div className="flex gap-2">
            <div className="h-7 w-24 bg-slate-800/60 rounded-lg" />
            <div className="h-7 w-28 bg-emerald-600/10 border border-emerald-500/10 rounded-lg" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-850/30 bg-slate-900/10">
                <th className="p-4 pl-6 w-[36%]"><div className="h-3 w-28 bg-slate-800 rounded-md" /></th>
                <th className="p-4 w-[16%] text-center"><div className="h-3 w-20 bg-slate-850 mx-auto rounded-md" /></th>
                <th className="p-4 w-[16%] text-center"><div className="h-3 w-12 bg-slate-850 mx-auto rounded-md" /></th>
                <th className="p-4 w-[16%] text-center"><div className="h-3 w-14 bg-slate-850 mx-auto rounded-md" /></th>
                <th className="p-4 w-[16%] text-center pr-6"><div className="h-3 w-12 bg-slate-850 mx-auto rounded-md" /></th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 8 }).map((_, idx) => (
                <tr key={idx} className="border-b border-slate-850/20">
                  {/* Name column skeleton */}
                  <td className="p-4 pl-6">
                    <div className="flex flex-col gap-1.5">
                      <div className="h-4.5 w-32 bg-slate-800/80 rounded-md" />
                      <div className="h-3 w-12 bg-slate-850 rounded-md" />
                    </div>
                  </td>
                  {/* Rank column skeleton */}
                  <td className="p-4 text-center">
                    <div className="h-7 w-20 bg-slate-800/40 border border-slate-800/25 rounded-xl mx-auto" />
                  </td>
                  {/* Today column skeleton */}
                  <td className="p-4 text-center">
                    <div className="h-4.5 w-8 bg-slate-850 mx-auto rounded-md" />
                  </td>
                  {/* Monthly column skeleton */}
                  <td className="p-4 text-center">
                    <div className="h-4.5 w-10 bg-slate-850 mx-auto rounded-md" />
                  </td>
                  {/* Yearly column skeleton */}
                  <td className="p-4 text-center pr-6">
                    <div className="h-4.5 w-10 bg-slate-850 mx-auto rounded-md" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
