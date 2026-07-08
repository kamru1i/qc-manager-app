import React from 'react';

interface ListSkeletonProps {
  rows?: number;
  className?: string;
}

export const ListSkeleton: React.FC<ListSkeletonProps> = ({ rows = 5, className = '' }) => {
  return (
    <div className={`flex flex-col gap-3 w-full animate-pulse ${className}`}>
      {Array.from({ length: rows }).map((_, idx) => (
        <div
          key={idx}
          className="flex items-center justify-between p-4 bg-slate-900/20 border border-slate-850/60 rounded-xl"
        >
          <div className="flex items-center gap-3 flex-1">
            <div className="h-4 w-4 bg-slate-800 rounded"></div>
            <div className="h-4 w-2/3 bg-slate-800 rounded"></div>
          </div>
          <div className="h-4 w-16 bg-slate-800 rounded"></div>
        </div>
      ))}
    </div>
  );
};
