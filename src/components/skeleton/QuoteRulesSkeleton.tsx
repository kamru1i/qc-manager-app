import React from 'react';

interface QuoteRulesSkeletonProps {
  className?: string;
}

export const QuoteRulesSkeleton: React.FC<QuoteRulesSkeletonProps> = ({
  className = '',
}) => {
  return (
    <div className={`w-full space-y-6 animate-pulse ${className}`}>
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2.5">
            <div className="h-6 w-6 bg-slate-850 rounded shrink-0"></div>
            <div className="h-7 w-72 bg-slate-800 rounded"></div>
          </div>
          <div className="h-3.5 w-[360px] bg-slate-800/60 rounded"></div>
        </div>
        {/* Header Actions Skeletons */}
        <div className="flex flex-wrap gap-2 w-full md:w-auto items-center">
          {/* History Archive */}
          <div className="h-8.5 w-28 bg-slate-900/20 border border-slate-800 rounded-lg"></div>
          {/* Login Code */}
          <div className="h-8.5 w-28 bg-slate-900/20 border border-slate-800 rounded-lg"></div>
          {/* IP Checker */}
          <div className="h-8.5 w-24 bg-slate-900/20 border border-slate-800 rounded-lg"></div>
          {/* Add Rule */}
          <div className="h-8.5 w-24 bg-slate-900/20 border border-slate-800 rounded-lg"></div>
        </div>
      </div>

      {/* Search Input and Quick Select Row */}
      <div className="w-full max-w-4xl mx-auto space-y-4">
        {/* Search bar skeleton */}
        <div className="flex gap-2 w-full bg-slate-900/20 border border-slate-850 p-1.5 rounded-xl">
          <div className="flex-1 h-9 bg-slate-955/40 border border-slate-800 rounded-lg"></div>
          <div className="h-9 w-20 bg-slate-800 rounded-lg shrink-0"></div>
        </div>
        {/* Quick select pills */}
        <div className="flex flex-wrap gap-2 justify-center items-center">
          <div className="h-3 w-20 bg-slate-800/50 rounded"></div>
          <div className="h-6 w-14 bg-slate-900/20 border border-slate-850 rounded-full"></div>
          <div className="h-6 w-12 bg-slate-900/20 border border-slate-850 rounded-full"></div>
          <div className="h-6 w-20 bg-slate-900/20 border border-slate-850 rounded-full"></div>
          <div className="h-6 w-14 bg-slate-900/20 border border-slate-850 rounded-full"></div>
          <div className="h-6 w-16 bg-slate-900/20 border border-slate-850 rounded-full"></div>
          <div className="h-6 w-18 bg-slate-900/20 border border-slate-850 rounded-full"></div>
        </div>
      </div>

      {/* Universal Guidelines Separator */}
      <div className="relative flex py-3 items-center">
        <div className="flex-grow border-t border-slate-850"></div>
        <span className="flex-shrink mx-4 text-xs bg-slate-800/40 h-3.5 w-32 rounded"></span>
        <div className="flex-grow border-t border-slate-850"></div>
      </div>

      {/* Rules list */}
      <div className="space-y-5">
        {/* Card 1: Critical Rule */}
        <div className="bg-red-950/5 border border-red-900/20 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 bg-red-900/30 rounded shrink-0"></div>
            <div className="h-5 w-48 bg-red-900/25 rounded"></div>
          </div>
          <div className="bg-red-955/15 border border-red-900/10 rounded-xl p-4.5 space-y-2.5">
            <div className="h-3.5 w-full bg-red-900/20 rounded"></div>
            <div className="h-3.5 w-11/12 bg-red-900/20 rounded"></div>
            <div className="h-3.5 w-3/4 bg-red-900/20 rounded"></div>
          </div>
        </div>

        {/* Card 2: General Pricing Rule */}
        <div className="bg-blue-950/5 border border-blue-900/20 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 bg-blue-900/30 rounded shrink-0"></div>
            <div className="h-5 w-44 bg-blue-900/25 rounded"></div>
          </div>
          <div className="bg-blue-955/15 border border-blue-900/10 rounded-xl p-4.5 space-y-2.5">
            <div className="h-3.5 w-full bg-blue-900/20 rounded"></div>
            <div className="h-3.5 w-5/6 bg-blue-900/20 rounded"></div>
            <div className="h-3.5 w-2/3 bg-blue-900/20 rounded"></div>
          </div>
        </div>

        {/* Card 3: Admin Fines & Penalties */}
        <div className="bg-purple-950/5 border border-purple-900/20 rounded-2xl p-5 space-y-4">
          <div className="flex justify-between items-center border-b border-purple-900/10 pb-3">
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 bg-purple-900/30 rounded shrink-0"></div>
              <div className="h-5 w-52 bg-purple-900/25 rounded"></div>
            </div>
            <div className="h-5 w-5 bg-purple-900/20 rounded-full"></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Fine 1 */}
            <div className="bg-slate-900/30 border border-slate-850 rounded-xl p-4.5 space-y-3">
              <div className="flex justify-between items-center gap-2 flex-wrap">
                <div className="h-4.5 w-40 bg-slate-800 rounded"></div>
                <div className="h-6 w-28 bg-purple-900/20 border border-purple-800/40 rounded-lg"></div>
              </div>
              <div className="h-3.5 w-full bg-slate-800/60 rounded mt-2"></div>
            </div>
            {/* Fine 2 */}
            <div className="bg-slate-900/30 border border-slate-850 rounded-xl p-4.5 space-y-3">
              <div className="flex justify-between items-center gap-2 flex-wrap">
                <div className="h-4.5 w-44 bg-slate-800 rounded"></div>
                <div className="h-6 w-28 bg-purple-900/20 border border-purple-800/40 rounded-lg"></div>
              </div>
              <div className="h-3.5 w-5/6 bg-slate-800/60 rounded mt-2"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
