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
    <div className={`w-full space-y-6 animate-pulse font-sans ${className}`}>
      {/* Stats Cards Section (5 Cards across row) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 w-full">
        {Array.from({ length: 5 }).map((_, idx) => (
          <div
            key={idx}
            className="bg-theme-card-bg/40 border border-theme-border-muted/80 rounded-2xl p-4 flex items-center gap-3.5 min-h-[88px] shadow-lg"
          >
            <div className="p-2.5 rounded-xl border border-theme-border-input/50 bg-theme-page-bg/40 shrink-0 h-10 w-10 flex items-center justify-center">
              <div className="h-5 w-5 bg-theme-border-input/40 rounded"></div>
            </div>
            <div className="flex-1 flex flex-col gap-1.5">
              <div className="h-2.5 w-24 bg-theme-border-input/40 rounded"></div>
              <div className="h-5 w-16 bg-theme-border-input/50 rounded mt-0.5"></div>
            </div>
          </div>
        ))}
      </div>

      {/* Main Table Card */}
      <div className="bg-theme-card-bg/40 backdrop-blur-xl border border-theme-border-muted/80 rounded-2xl overflow-hidden shadow-2xl">
        {/* Table Title and Actions */}
        <div className="px-6 py-5 border-b border-theme-border-input/70 bg-theme-page-bg/30 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="space-y-1.5 flex-1">
            <div className="h-4.5 w-48 bg-theme-border-input/50 rounded"></div>
            <div className="h-3 w-28 bg-theme-border-input/30 rounded"></div>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-9 w-28 bg-theme-page-bg/50 border border-theme-border-input/60 rounded-xl"></div>
            <div className="h-9 w-48 bg-theme-page-bg/50 border border-theme-border-input/60 rounded-xl"></div>
            <div className="h-9 w-20 bg-theme-page-bg/50 border border-theme-border-input/60 rounded-xl"></div>
            <div className="h-9 w-20 bg-theme-page-bg/50 border border-theme-border-input/60 rounded-xl"></div>
          </div>
        </div>

        {/* Table headers and rows */}
        <div className="overflow-x-auto p-4">
          <table className="min-w-full divide-y divide-theme-border-input/60">
            <thead className="bg-theme-page-bg/60">
              <tr>
                <th className="px-6 py-3.5 text-center"><div className="h-3 w-16 bg-theme-border-input/50 rounded mx-auto"></div></th>
                <th className="px-6 py-3.5 text-center"><div className="h-3 w-20 bg-theme-border-input/50 rounded mx-auto"></div></th>
                <th className="px-6 py-3.5 text-center"><div className="h-3 w-24 bg-theme-border-input/50 rounded mx-auto"></div></th>
                <th className="px-6 py-3.5 text-center"><div className="h-3 w-28 bg-theme-border-input/50 rounded mx-auto"></div></th>
                {allowOvertime && <th className="px-6 py-3.5 text-center"><div className="h-3 w-16 bg-theme-border-input/50 rounded mx-auto"></div></th>}
                <th className="px-6 py-3.5 text-left"><div className="h-3 w-28 bg-theme-border-input/50 rounded"></div></th>
                <th className="px-6 py-3.5 text-right"><div className="h-3 w-20 bg-theme-border-input/50 rounded ml-auto"></div></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-theme-border-input/40 bg-theme-card-bg/20">
              {Array.from({ length: 5 }).map((_, idx) => (
                <tr key={idx}>
                  <td className="px-6 py-4 whitespace-nowrap"><div className="h-4 w-20 bg-theme-border-input/40 rounded mx-auto"></div></td>
                  <td className="px-6 py-4 whitespace-nowrap"><div className="h-4 w-24 bg-theme-border-input/40 rounded mx-auto"></div></td>
                  <td className="px-6 py-4 whitespace-nowrap"><div className="h-4 w-24 bg-theme-border-input/40 rounded mx-auto"></div></td>
                  <td className="px-6 py-4 whitespace-nowrap"><div className="h-4 w-28 bg-theme-border-input/40 rounded mx-auto"></div></td>
                  {allowOvertime && <td className="px-6 py-4 whitespace-nowrap"><div className="h-4 w-12 bg-theme-border-input/40 rounded mx-auto"></div></td>}
                  <td className="px-6 py-4"><div className="h-4 w-44 bg-theme-border-input/40 rounded"></div></td>
                  <td className="px-6 py-4 whitespace-nowrap text-right"><div className="h-4 w-4 bg-theme-border-input/40 rounded-full ml-auto"></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
