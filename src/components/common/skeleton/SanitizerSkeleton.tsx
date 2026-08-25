import React from 'react';

interface SanitizerSkeletonProps {
  className?: string;
}

export const SanitizerSkeleton: React.FC<SanitizerSkeletonProps> = ({ className = '' }) => {
  return (
    <div className={`space-y-6 w-full font-sans animate-pulse ${className}`}>
      {/* Main Container Card Skeleton */}
      <div className="bg-theme-card-bg/40 backdrop-blur-xl rounded-2xl border border-theme-border-input/80 p-6 space-y-5 shadow-xl">
        {/* Header */}
        <div className="flex items-center gap-3 pb-3 border-b border-theme-border-input/40">
          <div className="h-5 w-5 bg-indigo-500/30 rounded" />
          <div className="space-y-1">
            <div className="h-4 w-56 bg-theme-border-input/50 rounded" />
            <div className="h-3 w-80 bg-theme-border-input/30 rounded" />
          </div>
        </div>

        {/* Input Bar */}
        <div className="flex gap-2">
          <div className="flex-1 h-10 bg-theme-page-bg/80 border border-theme-border-input/60 rounded-xl" />
          <div className="w-28 h-10 bg-indigo-600/30 border border-indigo-500/30 rounded-xl shrink-0" />
        </div>

        {/* Grid of Word Pills (3 Columns) */}
        <div className="bg-theme-page-bg/40 border border-theme-border-input/60 rounded-xl p-4 max-h-[400px]">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: 15 }).map((_, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-2.5 rounded-xl border border-indigo-500/20 bg-theme-card-bg/40"
              >
                <div className="flex items-center gap-2 flex-1">
                  <div className="w-2 h-2 rounded-full bg-emerald-400/50 shrink-0" />
                  <div
                    className="h-3.5 bg-theme-border-input/40 rounded"
                    style={{ width: `${40 + ((idx * 13) % 45)}%` }}
                  />
                </div>
                <div className="h-4 w-4 bg-red-400/20 rounded shrink-0" />
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Save Button */}
        <div className="pt-4 border-t border-theme-border-input/40 flex justify-end">
          <div className="h-10 w-36 bg-emerald-600/30 border border-emerald-500/30 rounded-xl" />
        </div>
      </div>
    </div>
  );
};
