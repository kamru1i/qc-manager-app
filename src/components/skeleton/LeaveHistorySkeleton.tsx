import React from 'react';

interface LeaveHistorySkeletonProps {
  allowOvertime?: boolean;
  className?: string;
}

export const LeaveHistorySkeleton: React.FC<LeaveHistorySkeletonProps> = ({
  allowOvertime = false,
  className = '',
}) => {
  return (
    <div className={`w-full space-y-6 animate-pulse ${className}`}>
      {/* Top Header Row (Optional back button placeholder) */}
      <div className="flex justify-between items-center">
        <div className="h-9 w-32 bg-slate-800 rounded-lg"></div>
      </div>

      {/* Stats Cards Section */}
      <div className="flex flex-wrap gap-4 w-full">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div
            key={idx}
            className="flex-1 min-w-[200px] bg-slate-900/40 border border-slate-900 rounded-2xl p-5 flex items-center justify-between gap-4 min-h-[102px]"
          >
            <div className="flex items-center gap-4 flex-1">
              <div className="p-3 rounded-xl border border-slate-800 bg-slate-900/20 shrink-0 h-12 w-12 flex items-center justify-center">
                <div className="h-6 w-6 bg-slate-800 rounded-md"></div>
              </div>
              <div className="flex-1 flex flex-col gap-1.5">
                <div className="h-3 w-20 bg-slate-800 rounded"></div>
                <div className="h-6 w-12 bg-slate-800 rounded mt-0.5"></div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Main Table Card */}
      <div className="bg-slate-900/20 border border-slate-850 rounded-2xl overflow-hidden">
        {/* Table Title and Actions */}
        <div className="px-6 py-5 border-b border-slate-850 bg-slate-900/40 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="space-y-1.5 flex-1">
            <div className="h-5 w-48 bg-slate-800 rounded"></div>
            <div className="h-3 w-72 bg-slate-805/60 rounded"></div>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-9 w-20 bg-slate-900/20 border border-slate-850 rounded-lg"></div>
            <div className="h-9 w-20 bg-slate-900/20 border border-slate-850 rounded-lg"></div>
          </div>
        </div>

        {/* Filter Bar Inside Card */}
        <div className="p-6 border-b border-slate-850">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-3 space-y-2">
              <div className="h-3 w-48 bg-slate-800 rounded"></div>
              <div className="h-10 w-full bg-slate-900/20 border border-slate-850 rounded-lg"></div>
            </div>
            <div className="space-y-2">
              <div className="h-3 w-28 bg-slate-800 rounded"></div>
              <div className="flex gap-2">
                <div className="h-10 flex-1 bg-slate-900/20 border border-slate-850 rounded-lg"></div>
                <div className="h-10 w-10 bg-slate-900/20 border border-slate-850 rounded-lg"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Table headers and rows */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-850">
            <thead className="bg-slate-900/30">
              <tr>
                <th className="px-6 py-3.5 text-center"><div className="h-3 w-16 bg-slate-800 rounded mx-auto"></div></th>
                <th className="px-6 py-3.5 text-center"><div className="h-3 w-20 bg-slate-800 rounded mx-auto"></div></th>
                <th className="px-6 py-3.5 text-center"><div className="h-3 w-24 bg-slate-800 rounded mx-auto"></div></th>
                <th className="px-6 py-3.5 text-center"><div className="h-3 w-28 bg-slate-800 rounded mx-auto"></div></th>
                {allowOvertime && <th className="px-6 py-3.5 text-center"><div className="h-3 w-16 bg-slate-800 rounded mx-auto"></div></th>}
                <th className="px-6 py-3.5 text-left"><div className="h-3 w-28 bg-slate-800 rounded"></div></th>
                <th className="px-6 py-3.5 text-right"><div className="h-3 w-20 bg-slate-800 rounded ml-auto"></div></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850/60">
              {Array.from({ length: 4 }).map((_, idx) => (
                <tr key={idx}>
                  <td className="px-6 py-4 whitespace-nowrap"><div className="h-4 w-20 bg-slate-800 rounded mx-auto"></div></td>
                  <td className="px-6 py-4 whitespace-nowrap"><div className="h-4 w-24 bg-slate-800 rounded mx-auto"></div></td>
                  <td className="px-6 py-4 whitespace-nowrap"><div className="h-4 w-24 bg-slate-800 rounded mx-auto"></div></td>
                  <td className="px-6 py-4 whitespace-nowrap"><div className="h-4 w-28 bg-slate-800 rounded mx-auto"></div></td>
                  {allowOvertime && <td className="px-6 py-4 whitespace-nowrap"><div className="h-4 w-12 bg-slate-800 rounded mx-auto"></div></td>}
                  <td className="px-6 py-4"><div className="h-4 w-44 bg-slate-800 rounded"></div></td>
                  <td className="px-6 py-4 whitespace-nowrap text-right"><div className="h-4 w-28 bg-slate-800 rounded ml-auto"></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
