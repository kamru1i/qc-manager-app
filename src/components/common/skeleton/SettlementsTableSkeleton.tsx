import React from 'react';

interface SettlementsTableSkeletonProps {
  className?: string;
}

export const SettlementsTableSkeleton: React.FC<SettlementsTableSkeletonProps> = ({
  className = '',
}) => {
  return (
    <div className={`w-full space-y-6 animate-pulse font-sans ${className}`}>
      {/* Top Filter and Controls Bar */}
      <div className="bg-theme-card-bg/40 backdrop-blur-xl border border-theme-border-input/80 p-4 rounded-2xl shadow-xl flex flex-wrap items-end justify-between gap-3.5 w-full">
        {/* Period */}
        <div className="flex flex-col min-w-[140px]">
          <div className="h-2.5 w-20 bg-theme-border-input/40 rounded mb-1"></div>
          <div className="h-10 w-36 bg-theme-page-bg/50 border border-theme-border-input/60 rounded-xl"></div>
        </div>
        {/* Category */}
        <div className="flex flex-col min-w-[140px]">
          <div className="h-2.5 w-20 bg-theme-border-input/40 rounded mb-1"></div>
          <div className="h-10 w-36 bg-theme-page-bg/50 border border-theme-border-input/60 rounded-xl"></div>
        </div>
        {/* Search */}
        <div className="flex flex-col min-w-[200px] flex-1">
          <div className="h-2.5 w-20 bg-theme-border-input/40 rounded mb-1"></div>
          <div className="h-10 w-full bg-theme-page-bg/50 border border-theme-border-input/60 rounded-xl"></div>
        </div>
        {/* Buttons */}
        <div className="flex items-center gap-2">
          <div className="h-10 w-20 bg-theme-page-bg/50 border border-theme-border-input/60 rounded-xl"></div>
          <div className="h-10 w-44 bg-purple-600/30 rounded-xl"></div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-theme-card-bg/40 backdrop-blur-xl border border-theme-border-input/80 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-theme-border-input/60">
            <thead className="bg-theme-page-bg/60">
              <tr>
                <th className="px-6 py-3.5 text-left"><div className="h-3 w-24 bg-theme-border-input/50 rounded"></div></th>
                <th className="px-6 py-3.5 text-center"><div className="h-3 w-28 bg-theme-border-input/50 rounded mx-auto"></div></th>
                <th className="px-6 py-3.5 text-center"><div className="h-3 w-28 bg-theme-border-input/50 rounded mx-auto"></div></th>
                <th className="px-6 py-3.5 text-center"><div className="h-3 w-16 bg-theme-border-input/50 rounded mx-auto"></div></th>
                <th className="px-6 py-3.5 text-center"><div className="h-3 w-16 bg-theme-border-input/50 rounded mx-auto"></div></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-theme-border-input/40 bg-theme-card-bg/20">
              {Array.from({ length: 6 }).map((_, idx) => (
                <tr key={idx}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="h-4 w-40 bg-theme-border-input/40 rounded"></div>
                    <div className="h-2.5 w-24 bg-theme-border-input/30 rounded mt-1.5 font-mono"></div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <div className="h-4 w-16 bg-theme-border-input/40 rounded mx-auto font-mono"></div>
                    <div className="h-2.5 w-14 bg-theme-border-input/30 rounded mx-auto mt-1 font-mono"></div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <div className="h-3.5 w-24 bg-theme-border-input/30 rounded mx-auto italic"></div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <div className="h-6 w-24 bg-theme-border-input/30 rounded-lg mx-auto"></div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <div className="flex items-center justify-center gap-2">
                      <div className="h-8 w-8 bg-theme-border-input/40 rounded-lg"></div>
                      <div className="h-8 w-8 bg-theme-border-input/40 rounded-lg"></div>
                    </div>
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
