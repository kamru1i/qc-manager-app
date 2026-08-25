import React from 'react';

interface StatsSkeletonProps {
  cards?: number;
  className?: string;
}

export const StatsSkeleton: React.FC<StatsSkeletonProps> = ({ cards = 4, className = '' }) => {
  return (
    <div className={`flex flex-wrap gap-4 w-full animate-pulse font-sans ${className}`}>
      {Array.from({ length: cards }).map((_, idx) => (
        <div
          key={idx}
          className="flex-1 min-w-[200px] bg-theme-card-bg/40 border border-theme-border-muted/80 rounded-2xl p-4 flex items-center gap-3.5 min-h-[88px] shadow-lg"
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
  );
};
