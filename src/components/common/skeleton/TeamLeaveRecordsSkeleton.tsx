import React from 'react';

export const TeamLeaveRecordsSkeleton: React.FC = () => {
  return (
    <div className="space-y-6 animate-pulse font-sans">
      {/* Header Controls Bar Skeleton */}
      <div className="bg-theme-card-bg/40 backdrop-blur-xl border border-theme-border-input/80 p-4 rounded-2xl shadow-xl flex flex-wrap items-end justify-between gap-3.5 w-full">
        {/* Search */}
        <div className="flex flex-col min-w-[220px] flex-1">
          <div className="h-2.5 w-24 bg-theme-border-input/40 rounded mb-1"></div>
          <div className="h-10 w-full bg-theme-page-bg/50 border border-theme-border-input/60 rounded-xl"></div>
        </div>
        {/* Leave Type */}
        <div className="flex flex-col min-w-[140px]">
          <div className="h-2.5 w-16 bg-theme-border-input/40 rounded mb-1"></div>
          <div className="h-10 w-36 bg-theme-page-bg/50 border border-theme-border-input/60 rounded-xl"></div>
        </div>
        {/* Date Selector */}
        <div className="flex flex-col min-w-[140px]">
          <div className="h-2.5 w-16 bg-theme-border-input/40 rounded mb-1"></div>
          <div className="h-10 w-36 bg-theme-page-bg/50 border border-theme-border-input/60 rounded-xl"></div>
        </div>
        {/* Today & Excel buttons */}
        <div className="flex items-center gap-2">
          <div className="h-10 w-20 bg-theme-page-bg/50 border border-theme-border-input/60 rounded-xl"></div>
          <div className="h-10 w-20 bg-theme-page-bg/50 border border-theme-border-input/60 rounded-xl"></div>
        </div>
      </div>

      {/* Main Table Card Skeleton */}
      <div className="bg-theme-card-bg/40 backdrop-blur-xl border border-theme-border-input/80 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-theme-border-input/60">
            <thead className="bg-theme-page-bg/60">
              <tr>
                <th className="px-6 py-3.5 text-left"><div className="h-3 w-14 bg-theme-border-input/50 rounded"></div></th>
                <th className="px-6 py-3.5 text-center"><div className="h-3 w-16 bg-theme-border-input/50 rounded mx-auto"></div></th>
                <th className="px-6 py-3.5 text-center"><div className="h-3 w-12 bg-theme-border-input/50 rounded mx-auto"></div></th>
                <th className="px-6 py-3.5 text-center"><div className="h-3 w-20 bg-theme-border-input/50 rounded mx-auto"></div></th>
                <th className="px-6 py-3.5 text-center"><div className="h-3 w-20 bg-theme-border-input/50 rounded mx-auto"></div></th>
                <th className="px-6 py-3.5 text-left"><div className="h-3 w-20 bg-theme-border-input/50 rounded"></div></th>
                <th className="px-6 py-3.5 text-right"><div className="h-3 w-12 bg-theme-border-input/50 rounded ml-auto"></div></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-theme-border-input/40 bg-theme-card-bg/20">
              {/* Group Header */}
              <tr className="bg-theme-page-bg/40">
                <td colSpan={7} className="px-6 py-2.5">
                  <div className="flex items-center justify-between">
                    <div className="h-3.5 w-44 bg-theme-border-input/50 rounded"></div>
                    <div className="h-3 w-16 bg-theme-border-input/30 rounded"></div>
                  </div>
                </td>
              </tr>
              {/* Row */}
              <tr>
                <td className="px-6 py-4"><div className="h-4 w-28 bg-theme-border-input/40 rounded"></div></td>
                <td className="px-6 py-4"><div className="h-4 w-16 bg-theme-border-input/40 rounded mx-auto font-mono"></div></td>
                <td className="px-6 py-4"><div className="h-5 w-20 bg-theme-border-input/40 rounded-full mx-auto"></div></td>
                <td className="px-6 py-4"><div className="h-4 w-32 bg-theme-border-input/40 rounded mx-auto"></div></td>
                <td className="px-6 py-4"><div className="h-4 w-14 bg-theme-border-input/40 rounded mx-auto font-mono"></div></td>
                <td className="px-6 py-4"><div className="h-4 w-40 bg-theme-border-input/40 rounded"></div></td>
                <td className="px-6 py-4 text-right"><div className="h-4 w-4 bg-theme-border-input/40 rounded-full ml-auto"></div></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
