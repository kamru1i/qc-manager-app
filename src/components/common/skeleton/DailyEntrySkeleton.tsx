import React from 'react';

interface DailyEntrySkeletonProps {
  className?: string;
}

export const DailyEntrySkeleton: React.FC<DailyEntrySkeletonProps> = ({ className = '' }) => {
  const cardBg = "bg-slate-900/30 border border-slate-850/80 backdrop-blur-md rounded-2xl p-5";
  const innerBg = "bg-slate-800/40 rounded-lg";

  return (
    <div className={`space-y-6 w-full animate-pulse ${className}`}>
      {/* New File Entry Form Card */}
      <div className={`${cardBg} space-y-6 p-6`}>
        <div className="space-y-1.5 pb-2">
          <div className={`h-5.5 w-40 ${innerBg}`} />
          <div className={`h-3 w-56 ${innerBg} opacity-60`} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Inputs column */}
          <div className="space-y-5">
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <div className={`h-3.5 w-3.5 ${innerBg}`} />
                <div className={`h-3.5 w-24 ${innerBg}`} />
              </div>
              <div className={`h-11 w-full ${innerBg}`} />
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <div className={`h-3.5 w-3.5 ${innerBg}`} />
                <div className={`h-3.5 w-28 ${innerBg}`} />
              </div>
              <div className={`h-11 w-full ${innerBg}`} />
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <div className={`h-3.5 w-3.5 ${innerBg}`} />
                <div className={`h-3.5 w-36 ${innerBg}`} />
              </div>
              <div className={`h-11 w-full ${innerBg}`} />
            </div>
          </div>

          {/* Right Type Options column */}
          <div className="space-y-3">
            <div className={`h-3.5 w-36 ${innerBg}`} />
            <div className="grid grid-cols-2 gap-3.5">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="h-10 w-full bg-slate-900/40 border border-slate-850/60 rounded-xl p-3 flex justify-between items-center"
                >
                  <div className={`h-3 w-16 ${innerBg}`} />
                  <div className={`h-4.5 w-4.5 rounded-full ${innerBg}`} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Submit Button Row */}
        <div className="flex justify-end pt-2">
          <div className={`h-11 w-44 bg-blue-600/30 rounded-xl`} />
        </div>
      </div>

      {/* Today's File Entry List Section */}
      <div className={`${cardBg} space-y-6 p-6`}>
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-2">
              <div className={`h-5 w-5 ${innerBg} shrink-0`} />
              <div className={`h-5 w-52 ${innerBg}`} />
            </div>
            <div className={`h-3 w-32 ${innerBg} opacity-60`} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className={`h-9 w-28 ${innerBg}`} />
            <div className={`h-9 w-24 ${innerBg}`} />
            <div className={`h-9 w-20 ${innerBg}`} />
            <div className={`h-9 w-32 ${innerBg}`} />
          </div>
        </div>

        {/* Search bar row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
          <div className="md:col-span-3">
            <div className={`h-10 w-full ${innerBg}`} />
          </div>
          <div className="md:col-span-1">
            <div className={`h-10 w-full ${innerBg}`} />
          </div>
        </div>

        {/* Stats Pills row */}
        <div className="flex flex-wrap gap-2.5">
          <div className="h-8 w-24 bg-slate-900/50 border border-slate-800 rounded-lg" />
          <div className="h-8 w-32 bg-slate-900/50 border border-slate-800 rounded-lg" />
          <div className="h-8 w-32 bg-slate-900/50 border border-slate-800 rounded-lg" />
          <div className="h-8 w-36 bg-slate-900/50 border border-slate-800 rounded-lg" />
          <div className="h-8 w-32 bg-slate-900/50 border border-slate-800 rounded-lg" />
          <div className="h-8 w-28 bg-slate-900/50 border border-slate-800 rounded-lg" />
        </div>

        {/* Table skeleton */}
        <div className="overflow-x-auto rounded-xl border border-slate-900/60 bg-slate-955/10">
          <table className="min-w-full divide-y divide-slate-850">
            <thead className="bg-slate-900/40">
              <tr>
                <th className="px-6 py-3.5 text-left"><div className={`h-3 w-20 ${innerBg}`} /></th>
                <th className="px-6 py-3.5 text-left"><div className={`h-3 w-28 ${innerBg}`} /></th>
                <th className="px-6 py-3.5 text-left"><div className={`h-3 w-20 ${innerBg}`} /></th>
                <th className="px-6 py-3.5 text-left"><div className={`h-3 w-20 ${innerBg}`} /></th>
                <th className="px-6 py-3.5 text-right"><div className={`h-3 w-16 ${innerBg} ml-auto`} /></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850/60">
              {Array.from({ length: 4 }).map((_, i) => (
                <tr key={i}>
                  <td className="px-6 py-4 whitespace-nowrap"><div className={`h-4 w-16 ${innerBg}`} /></td>
                  <td className="px-6 py-4 whitespace-nowrap"><div className={`h-4 w-60 ${innerBg}`} /></td>
                  <td className="px-6 py-4 whitespace-nowrap"><div className={`h-4 w-16 ${innerBg}`} /></td>
                  <td className="px-6 py-4 whitespace-nowrap"><div className={`h-4 w-16 ${innerBg}`} /></td>
                  <td className="px-6 py-4 whitespace-nowrap text-right"><div className={`h-6 w-16 ${innerBg} ml-auto`} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
