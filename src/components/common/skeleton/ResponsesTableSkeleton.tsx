import React from 'react';

interface ResponsesTableSkeletonProps {
  rows?: number;
  className?: string;
}

export const ResponsesTableSkeleton: React.FC<ResponsesTableSkeletonProps> = ({
  rows = 5,
  className = '',
}) => {
  return (
    <div className={`w-full space-y-6 animate-pulse ${className}`}>
      {/* Main Card Container */}
      <div className="bg-slate-900/40 border border-slate-850 shadow-2xl rounded-2xl p-6 flex flex-col gap-6">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800/80 pb-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-5 w-5 bg-slate-800 rounded shrink-0"></div>
              <div className="h-5.5 w-56 bg-slate-800 rounded"></div>
            </div>
            <div className="h-3 w-[340px] bg-slate-800/60 rounded"></div>
          </div>
          {/* Export Buttons Skeletons */}
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <div className="h-8 w-20 bg-slate-900/20 border border-slate-800 rounded-lg"></div>
            <div className="h-8 w-20 bg-slate-900/20 border border-slate-800 rounded-lg"></div>
          </div>
        </div>

        {/* Search Filters Row */}
        <div className="flex flex-col sm:flex-row gap-3 w-full bg-slate-905/40 p-3 rounded-xl border border-slate-850">
          <div className="flex-1 space-y-2">
            <div className="h-3 w-48 bg-slate-800 rounded"></div>
            <div className="h-9 w-full bg-slate-900/30 border border-slate-800 rounded-lg"></div>
          </div>
          <div className="w-full sm:w-48 space-y-2">
            <div className="h-3 w-32 bg-slate-800 rounded"></div>
            <div className="h-9 w-full bg-slate-900/30 border border-slate-800 rounded-lg"></div>
          </div>
          <div className="flex items-end">
            <div className="h-8 w-8 bg-slate-800 border border-slate-700 rounded-lg"></div>
          </div>
        </div>

        {/* Table Container */}
        <div className="overflow-x-auto rounded-xl border border-slate-900 bg-slate-955/20">
          <table className="min-w-full divide-y divide-slate-850">
            <thead className="bg-slate-900/30">
              <tr>
                <th className="px-6 py-3.5 text-left"><div className="h-3 w-28 bg-slate-800 rounded"></div></th>
                <th className="px-6 py-3.5 text-left"><div className="h-3 w-16 bg-slate-800 rounded"></div></th>
                <th className="px-6 py-3.5 text-left"><div className="h-3 w-24 bg-slate-800 rounded"></div></th>
                <th className="px-6 py-3.5 text-left"><div className="h-3 w-20 bg-slate-800 rounded"></div></th>
                <th className="px-6 py-3.5 text-right"><div className="h-3 w-14 bg-slate-800 rounded ml-auto"></div></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850/60">
              {Array.from({ length: rows }).map((_, idx) => (
                <tr key={idx}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="h-4 w-32 bg-slate-800 rounded"></div>
                    <div className="h-3 w-16 bg-slate-805/60 rounded mt-1.5"></div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="h-4 w-12 bg-slate-800 rounded"></div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="h-4 w-28 bg-slate-800 rounded"></div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="h-4 w-20 bg-slate-800 rounded"></div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right flex justify-end gap-2">
                    <div className="h-8 w-8 bg-slate-900/20 border border-slate-850 rounded-lg"></div>
                    <div className="h-8 w-8 bg-slate-900/20 border border-slate-850 rounded-lg"></div>
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
