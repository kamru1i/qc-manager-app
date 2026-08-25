import React from 'react';

interface TodoSkeletonProps {
  className?: string;
}

export const TodoSkeleton: React.FC<TodoSkeletonProps> = ({ className = '' }) => {
  return (
    <div className={`space-y-6 font-sans animate-pulse ${className}`}>
      {/* Top Input Bar Card */}
      <div className="bg-theme-card-bg/40 backdrop-blur-xl border border-theme-border-input/80 p-3.5 rounded-2xl shadow-xl flex flex-wrap items-center justify-between gap-3.5 w-full">
        {/* Main Input */}
        <div className="flex-1 min-w-[260px]">
          <div className="h-10 w-full bg-theme-page-bg/60 border border-theme-border-input/60 rounded-xl" />
        </div>

        {/* Right Controls: Permanent checkbox + Add button + Copy + Refresh + Daily List / All Logs toggle */}
        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          <div className="flex items-center gap-2 px-2">
            <div className="h-4 w-4 rounded-full border border-theme-border-input/60 bg-theme-page-bg/40" />
            <div className="h-3 w-16 bg-theme-border-input/40 rounded" />
          </div>
          <div className="h-9 w-9 bg-purple-600/30 border border-purple-500/30 rounded-xl" />
          <div className="h-9 w-9 bg-theme-page-bg border border-theme-border-input/60 rounded-xl" />
          <div className="h-9 w-9 bg-theme-page-bg border border-theme-border-input/60 rounded-xl" />
          <div className="flex items-center bg-theme-page-bg border border-theme-border-input/60 p-1 rounded-xl gap-1">
            <div className="h-7 w-20 bg-blue-600/30 rounded-lg" />
            <div className="h-7 w-18 bg-theme-page-bg rounded-lg" />
          </div>
        </div>
      </div>

      {/* Task Items List */}
      <div className="bg-theme-card-bg/40 backdrop-blur-xl border border-theme-border-input/80 rounded-2xl overflow-hidden shadow-xl divide-y divide-theme-border-input/40">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="py-3.5 px-5 flex items-center justify-between gap-4 hover:bg-theme-card-bg/20 transition-all"
          >
            {/* Left side: status circle + task text + permanent badge */}
            <div className="flex-1 flex items-center gap-3.5">
              <div className="w-4.5 h-4.5 rounded-full border border-theme-border-input/70 bg-theme-page-bg/40 shrink-0" />
              <div className="flex-1 flex items-center gap-2.5">
                <div
                  className="h-3.5 rounded-md bg-theme-border-input/50 italic"
                  style={{ width: `${35 + ((i * 19) % 40)}%` }}
                />
                {i > 0 && (
                  <div className="h-4.5 w-18 bg-purple-600/20 border border-purple-500/30 rounded-full shrink-0" />
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
