import React from 'react';

interface TodoSkeletonProps {
  className?: string;
}

export const TodoSkeleton: React.FC<TodoSkeletonProps> = ({ className = '' }) => {
  const innerBg = 'bg-slate-800/40 rounded-lg';

  return (
    <div className={`space-y-6 animate-pulse ${className}`}>
      {/* Header: Title + Sub-tab buttons */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-slate-800 shrink-0">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <div className={`w-5 h-5 rounded ${innerBg}`} />
            <div className={`h-5 w-56 ${innerBg}`} />
          </div>
          <div className={`h-3 w-72 ${innerBg}`} />
        </div>
        {/* Sub-tab toggle pills */}
        <div className="flex bg-slate-950 p-1.5 rounded-xl border border-slate-800 gap-1">
          <div className={`h-9 w-28 rounded-lg ${innerBg}`} />
          <div className={`h-9 w-24 rounded-lg bg-slate-850/30 rounded-lg`} />
        </div>
      </div>

      {/* Add task form bar */}
      <div className="flex flex-col md:flex-row items-center gap-4 bg-slate-950/40 p-4 border border-slate-800/60 rounded-xl">
        <div className="flex-1 w-full flex items-center gap-2.5">
          <div className={`flex-1 h-10 ${innerBg} rounded-xl`} />
          <div className={`h-10 w-28 bg-slate-850/30 rounded-xl`} />
          <div className={`h-10 w-28 bg-indigo-600/15 rounded-xl`} />
        </div>
        <div className="shrink-0 flex items-center gap-2">
          <div className={`h-10 w-36 bg-slate-850/30 rounded-xl`} />
          <div className={`h-10 w-10 bg-slate-850/30 rounded-xl`} />
        </div>
      </div>

      {/* Task items list */}
      <div className="space-y-0 divide-y divide-slate-800/60">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="py-5 px-1 flex items-start justify-between gap-4"
          >
            {/* Left side: task text + badge + notes */}
            <div className="flex-1 space-y-2.5">
              <div className="flex items-center gap-2.5">
                <div
                  className={`h-3.5 rounded-lg ${innerBg}`}
                  style={{ width: `${45 + (i * 17) % 35}%` }}
                />
                {/* Permanent badge placeholder (shown on some items) */}
                {i % 2 === 0 && (
                  <div className="h-5 w-20 bg-indigo-600/10 border border-indigo-500/15 rounded-md" />
                )}
              </div>
              {/* Notes row */}
              <div className="flex items-center gap-2">
                <div className={`h-3 w-12 bg-slate-850/30 rounded`} />
                <div className={`h-8 w-64 ${innerBg} rounded-lg`} />
              </div>
            </div>

            {/* Right side: circle checkbox */}
            <div className="shrink-0 mt-2">
              <div className="w-6 h-6 rounded-full border-2 border-slate-700/60 bg-slate-900/40" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
