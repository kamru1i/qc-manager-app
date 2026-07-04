import React from 'react';

interface IPCheckerSkeletonProps {
  className?: string;
  cardsCount?: number;
}

export const IPCheckerSkeleton: React.FC<IPCheckerSkeletonProps> = ({
  className = '',
  cardsCount = 6,
}) => {
  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${className}`}>
      {Array.from({ length: cardsCount }).map((_, idx) => (
        <div
          key={idx}
          className="p-4 rounded-xl border border-slate-800 bg-slate-955/10 animate-pulse flex flex-col justify-between h-[120px]"
        >
          <div>
            {/* Header */}
            <div className="flex justify-between items-center mb-3.5">
              <div className="w-24 h-3.5 bg-slate-800/50 rounded-md" />
              <div className="w-12 h-4 bg-slate-800/35 rounded-md" />
            </div>
            {/* Details */}
            <div className="space-y-2">
              <div className="flex justify-between">
                <div className="w-12 h-2 bg-slate-800/25 rounded" />
                <div className="w-20 h-2 bg-slate-800/40 rounded" />
              </div>
              <div className="flex justify-between">
                <div className="w-14 h-2 bg-slate-800/25 rounded" />
                <div className="w-28 h-2 bg-slate-800/40 rounded" />
              </div>
              <div className="flex justify-between">
                <div className="w-16 h-2 bg-slate-800/25 rounded" />
                <div className="w-24 h-2 bg-slate-800/40 rounded" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
export default IPCheckerSkeleton;
