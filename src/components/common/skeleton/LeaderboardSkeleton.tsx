import React from 'react';

interface LeaderboardSkeletonProps {
  className?: string;
}

export const LeaderboardSkeleton: React.FC<LeaderboardSkeletonProps> = ({ className = '' }) => {
  return (
    <div className={`space-y-6 animate-pulse font-sans ${className}`}>
      {/* Main Leaderboard Table Card Skeleton */}
      <div className="bg-theme-card-bg/40 backdrop-blur-xl border border-theme-border-input/80 rounded-2xl overflow-hidden shadow-xl">
        {/* Table Header Section */}
        <div className="p-5 border-b border-theme-border-input/70 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-theme-page-bg/40">
          {/* Left: Title, Total Badge, Excel Button */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-md bg-blue-500/30" />
              <div className="h-4.5 w-44 bg-theme-border-input/50 rounded-md" />
            </div>
            <div className="h-6 w-16 bg-theme-page-bg border border-theme-border-input/60 rounded-lg" />
            <div className="h-6 w-16 bg-emerald-600/20 border border-emerald-500/30 rounded-lg" />
          </div>

          {/* Right: Search, Monthly/Yearly toggle, Month select */}
          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto justify-start lg:justify-end shrink-0">
            <div className="w-full sm:w-60">
              <div className="h-9 w-full bg-theme-page-bg/60 border border-theme-border-input/60 rounded-xl" />
            </div>
            <div className="h-9 w-32 bg-theme-page-bg border border-theme-border-input/60 rounded-xl" />
            <div className="h-9 w-28 bg-theme-page-bg border border-theme-border-input/60 rounded-xl" />
          </div>
        </div>

        {/* Table Skeleton */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-theme-border-input/60 bg-theme-page-bg/30">
                <th className="p-4 pl-6 w-[36%]"><div className="h-3 w-28 bg-theme-border-input/50 rounded-md" /></th>
                <th className="p-4 w-[16%] text-center"><div className="h-3 w-20 bg-theme-border-input/50 mx-auto rounded-md" /></th>
                <th className="p-4 w-[16%] text-center"><div className="h-3 w-12 bg-theme-border-input/50 mx-auto rounded-md" /></th>
                <th className="p-4 w-[16%] text-center"><div className="h-3 w-14 bg-theme-border-input/50 mx-auto rounded-md" /></th>
                <th className="p-4 w-[16%] text-center pr-6"><div className="h-3 w-12 bg-theme-border-input/50 mx-auto rounded-md" /></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-theme-border-input/30 bg-theme-card-bg/10">
              {Array.from({ length: 8 }).map((_, idx) => {
                const rankNum = idx + 1;
                const isTop5 = rankNum <= 5;

                return (
                  <tr key={idx} className="hover:bg-theme-card-bg/20 transition-all">
                    {/* Name column skeleton */}
                    <td className="p-4 pl-6">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5">
                          <div className="h-4 w-32 bg-theme-border-input/50 rounded-md" />
                          {idx % 2 === 0 && (
                            <div className="h-3.5 w-3.5 bg-blue-500/30 rounded-full shrink-0" />
                          )}
                        </div>
                        <div className="h-2.5 w-12 bg-theme-border-input/30 rounded-md font-mono" />
                      </div>
                    </td>

                    {/* Rank column skeleton */}
                    <td className="p-4 text-center">
                      {isTop5 ? (
                        <div className="h-6 w-14 bg-theme-border-input/30 border border-theme-border-input/40 rounded-xl mx-auto" />
                      ) : (
                        <div className="h-4 w-8 bg-theme-border-input/30 mx-auto rounded-md font-mono" />
                      )}
                    </td>

                    {/* Today column skeleton */}
                    <td className="p-4 text-center">
                      <div className="h-4 w-6 bg-theme-border-input/40 mx-auto rounded-md font-mono" />
                    </td>

                    {/* Monthly column skeleton */}
                    <td className="p-4 text-center">
                      <div className="h-4 w-8 bg-theme-border-input/40 mx-auto rounded-md font-mono" />
                    </td>

                    {/* Yearly column skeleton */}
                    <td className="p-4 text-center pr-6">
                      <div className="h-4 w-8 bg-theme-border-input/40 mx-auto rounded-md font-mono" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
