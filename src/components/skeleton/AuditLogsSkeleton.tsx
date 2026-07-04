import React from 'react';

interface AuditLogsSkeletonProps {
  className?: string;
}

export const AuditLogsSkeleton: React.FC<AuditLogsSkeletonProps> = ({ className = '' }) => {
  const bar = 'bg-slate-800/40 rounded-lg';
  const barLight = 'bg-slate-800/25 rounded';

  return (
    <div className={`space-y-6 animate-pulse ${className}`}>
      {/* Header: title + Refresh button */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900/20 p-4 border border-slate-800/40 rounded-2xl">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className={`w-5 h-5 rounded ${bar}`} />
            <div className={`h-5 w-48 ${bar}`} />
          </div>
          <div className={`h-3 w-80 ${barLight}`} />
        </div>
        <div className={`h-8 w-32 ${bar} rounded-lg`} />
      </div>

      {/* Filter row: Search + Category Filter */}
      <div className="bg-slate-950/40 p-4 rounded-2xl border border-slate-850 grid grid-cols-1 md:grid-cols-12 gap-3.5 items-end">
        <div className="md:col-span-8 space-y-1">
          <div className={`h-3 w-20 ${barLight}`} />
          <div className={`h-9 w-full ${bar} rounded-lg`} />
        </div>
        <div className="md:col-span-4 space-y-1">
          <div className={`h-3 w-24 ${barLight}`} />
          <div className={`h-9 w-full ${bar} rounded-lg`} />
        </div>
      </div>

      {/* Table */}
      <div className="bg-slate-950/20 border border-slate-800/40 rounded-2xl overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-[180px_120px_160px_1fr] gap-4 px-4 py-3 border-b border-slate-800/60 bg-slate-900/20">
          {['TIMESTAMP', 'ACTOR', 'ACTION TYPE', 'DESCRIPTION DETAILS'].map((_, i) => (
            <div key={i} className={`h-3 ${bar} ${i === 3 ? 'w-3/4' : 'w-full'}`} />
          ))}
        </div>

        {/* Table rows */}
        <div className="divide-y divide-slate-800/40">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="grid grid-cols-[180px_120px_160px_1fr] gap-4 px-4 py-3.5 items-center">
              {/* Timestamp: clock icon + date */}
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-slate-800/50 shrink-0" />
                <div className={`h-3 w-28 ${bar}`} />
              </div>
              {/* Actor: person icon + codename */}
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-slate-800/50 shrink-0" />
                <div className={`h-3 w-16 ${bar}`} />
              </div>
              {/* Action type badge */}
              <div>
                <div
                  className={`h-5 rounded-full ${bar}`}
                  style={{ width: `${70 + (i % 3) * 20}px` }}
                />
              </div>
              {/* Description */}
              <div className="space-y-1.5">
                <div className={`h-3 ${barLight}`} style={{ width: `${55 + (i % 5) * 8}%` }} />
                {i % 3 === 0 && (
                  <div className={`h-3 w-2/5 ${barLight}`} />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
