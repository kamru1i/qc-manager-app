import React from 'react';

interface StatsSkeletonProps {
  cards?: number;
  className?: string;
}

export const StatsSkeleton: React.FC<StatsSkeletonProps> = ({ cards = 4, className = '' }) => {
  return (
    <div className={`flex flex-wrap justify-center gap-4 w-full animate-pulse ${className}`}>
      {Array.from({ length: cards }).map((_, idx) => (
        <div
          key={idx}
          className="flex-1 min-w-[250px] max-w-[350px] bg-slate-900/40 border border-slate-900 rounded-2xl p-5 flex items-center justify-between gap-4 min-h-[102px]"
        >
          <div className="flex items-center gap-4 flex-1">
            <div className="p-3 rounded-xl border border-slate-800 bg-slate-900/20 shrink-0 h-12 w-12 flex items-center justify-center">
              <div className="h-6 w-6 bg-slate-800 rounded-md"></div>
            </div>
            <div className="flex-1 flex flex-col gap-1.5">
              <div className="h-3 w-24 bg-slate-800 rounded"></div>
              <div className="h-6 w-16 bg-slate-800 rounded mt-0.5"></div>
              <div className="h-2.5 w-40 bg-slate-850 rounded mt-0.5"></div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
