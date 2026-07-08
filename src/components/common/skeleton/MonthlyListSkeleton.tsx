import React from 'react';

interface MonthlyListSkeletonProps {
  rows?: number;
  className?: string;
}

export const MonthlyListSkeleton: React.FC<MonthlyListSkeletonProps> = ({
  rows = 8,
  className = '',
}) => {
  return (
    <div className={`w-full space-y-6 animate-pulse ${className}`}>
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="h-7.5 w-72 bg-slate-800 rounded"></div>
          <div className="h-4 w-64 bg-slate-800/60 rounded mt-2"></div>
        </div>
        {/* Header Actions Skeletons */}
        <div className="flex flex-wrap gap-2 w-full md:w-auto items-center">
          {/* Excel button */}
          <div className="h-8 w-20 bg-slate-900/20 border border-slate-800 rounded-lg"></div>
          {/* Custom Entry button */}
          <div className="h-8.5 w-32 bg-slate-900/20 border border-slate-800 rounded-lg"></div>
          {/* My Data/All Data toggle */}
          <div className="h-8 w-36 bg-slate-900/20 border border-slate-800 rounded-lg"></div>
        </div>
      </div>

      {/* Search Filters Row Card */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 w-full bg-slate-905/40 p-4 rounded-xl border border-slate-850">
        <div className="space-y-1.5">
          <div className="h-3 w-12 bg-slate-800 rounded"></div>
          <div className="h-9 w-full bg-slate-900/30 border border-slate-800 rounded-lg"></div>
        </div>
        <div className="space-y-1.5">
          <div className="h-3 w-12 bg-slate-800 rounded"></div>
          <div className="h-9 w-full bg-slate-900/30 border border-slate-800 rounded-lg"></div>
        </div>
        <div className="space-y-1.5">
          <div className="h-3 w-8 bg-slate-800 rounded"></div>
          <div className="h-9 w-full bg-slate-900/30 border border-slate-800 rounded-lg"></div>
        </div>
        <div className="space-y-1.5">
          <div className="h-3 w-10 bg-slate-800 rounded"></div>
          <div className="h-9 w-full bg-slate-900/30 border border-slate-800 rounded-lg"></div>
        </div>
        <div className="flex gap-2 items-end">
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-20 bg-slate-800 rounded"></div>
            <div className="h-9 w-full bg-slate-900/30 border border-slate-800 rounded-lg"></div>
          </div>
          <div className="h-9 w-9 bg-slate-800 border border-slate-700 rounded-lg flex items-center justify-center shrink-0"></div>
        </div>
      </div>

      {/* Stats Pills Grid */}
      <div className="flex flex-wrap gap-2.5">
        {/* Total Files */}
        <div className="h-8.5 w-32 bg-slate-900/20 border border-slate-850 rounded-xl"></div>
        {/* Sale */}
        <div className="h-8.5 w-40 bg-slate-900/20 border border-slate-850 rounded-xl"></div>
        {/* Quote */}
        <div className="h-8.5 w-36 bg-slate-900/20 border border-slate-850 rounded-xl"></div>
        {/* Requote */}
        <div className="h-8.5 w-40 bg-slate-900/20 border border-slate-850 rounded-xl"></div>
        {/* Requote Van */}
        <div className="h-8.5 w-40 bg-slate-900/20 border border-slate-850 rounded-xl"></div>
        {/* Review */}
        <div className="h-8.5 w-32 bg-slate-900/20 border border-slate-850 rounded-xl"></div>
        {/* Other Site */}
        <div className="h-8.5 w-32 bg-slate-900/20 border border-slate-850 rounded-xl"></div>
        {/* Van */}
        <div className="h-8.5 w-32 bg-slate-900/20 border border-slate-850 rounded-xl"></div>
      </div>

      {/* Data Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-900 bg-slate-955/20">
        <table className="min-w-full divide-y divide-slate-850">
          <thead className="bg-slate-900/30">
            <tr>
              <th className="px-6 py-3.5 text-left"><div className="h-3 w-20 bg-slate-800 rounded"></div></th>
              <th className="px-6 py-3.5 text-left"><div className="h-3 w-40 bg-slate-800 rounded"></div></th>
              <th className="px-6 py-3.5 text-left"><div className="h-3 w-16 bg-slate-800 rounded"></div></th>
              <th className="px-6 py-3.5 text-left"><div className="h-3 w-20 bg-slate-800 rounded"></div></th>
              <th className="px-6 py-3.5 text-right"><div className="h-3 w-14 bg-slate-800 rounded ml-auto"></div></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-850/60">
            {Array.from({ length: rows }).map((_, idx) => (
              <tr key={idx}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="h-4 w-28 bg-slate-800 rounded"></div>
                  <div className="h-3 w-14 bg-slate-800/60 rounded mt-1.5"></div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="h-4.5 w-64 bg-slate-800 rounded"></div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="h-4 w-12 bg-slate-800 rounded"></div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="h-4 w-16 bg-slate-800 rounded"></div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right flex justify-end">
                  <div className="h-6.5 w-18 bg-slate-800 rounded-full"></div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
