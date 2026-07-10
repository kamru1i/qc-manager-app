import React from 'react';

interface KpiSkeletonProps {
  className?: string;
}

export const KpiSkeleton: React.FC<KpiSkeletonProps> = ({ className = '' }) => {
  return (
    <div className={`space-y-6 max-w-full font-sans animate-pulse ${className}`}>
      {/* 1. Header controls skeleton */}
      <div className="flex flex-wrap justify-between items-center gap-4 bg-slate-900/35 border border-slate-850 p-4 rounded-2xl shadow-lg">
        <div className="flex items-center gap-3">
          <div className="h-8 w-16 bg-slate-800/80 rounded-xl animate-pulse" />
          <div className="space-y-2">
            <div className="h-4 w-48 bg-slate-800/80 rounded-md" />
            <div className="h-3 w-64 bg-slate-800/50 rounded-md" />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="h-8 w-20 bg-slate-800/80 rounded-xl" />
          <div className="h-8 w-20 bg-slate-800/80 rounded-xl" />
          <div className="h-8.5 w-24 bg-slate-800/80 rounded-xl" />
          <div className="h-8.5 w-24 bg-slate-800/80 rounded-xl" />
          <div className="h-8.5 w-24 bg-slate-800/80 rounded-xl" />
        </div>
      </div>

      {/* 2. Details card skeleton */}
      <div className="bg-slate-955/45 border border-slate-850 p-6 rounded-2xl shadow-xl space-y-6">
        <div className="flex justify-center border-b border-slate-850 pb-4">
          <div className="h-5 w-60 bg-slate-800/80 rounded-md" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="flex items-center border-b border-slate-900 pb-2">
              <div className="h-3.5 w-28 bg-slate-800/70 rounded-md mr-4 shrink-0" />
              <div className="h-3.5 w-32 bg-slate-800/40 rounded-md" />
            </div>
          ))}
        </div>

        {/* Goal Sheet banner skeleton */}
        <div className="bg-slate-900/60 py-2.5 rounded-xl border border-slate-850 flex justify-center">
          <div className="h-3 w-20 bg-slate-800/70 rounded-md" />
        </div>

        {/* Table skeleton */}
        <div className="overflow-x-auto rounded-xl border border-slate-800 shadow-lg">
          <table className="w-full text-left text-xs border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-slate-900 border-b border-slate-800 text-[11px] uppercase text-slate-400">
                <th className="py-3 px-3 w-16"><div className="h-3 w-10 bg-slate-800/70 rounded-md mx-auto" /></th>
                <th className="py-3 px-4 w-36"><div className="h-3 w-24 bg-slate-800/70 rounded-md" /></th>
                <th className="py-3 px-4 w-48"><div className="h-3 w-32 bg-slate-800/70 rounded-md" /></th>
                <th className="py-3 px-4 w-48"><div className="h-3 w-32 bg-slate-800/70 rounded-md" /></th>
                <th className="py-3 px-3 w-20"><div className="h-3 w-12 bg-slate-800/70 rounded-md mx-auto" /></th>
                <th className="py-3 px-3 w-24"><div className="h-3 w-16 bg-slate-800/70 rounded-md mx-auto" /></th>
                <th className="py-3 px-3 w-20"><div className="h-3 w-10 bg-slate-800/70 rounded-md mx-auto" /></th>
                <th className="py-3 px-3 w-24"><div className="h-3 w-16 bg-slate-800/70 rounded-md mx-auto" /></th>
                <th className="py-3 px-4"><div className="h-3 w-20 bg-slate-800/70 rounded-md" /></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850">
              {[1, 2, 3, 4, 5].map((row) => (
                <tr key={row} className="border-b border-slate-850">
                  <td className="py-3 px-3 border-r border-slate-850"><div className="h-3.5 w-6 bg-slate-800/50 rounded-md mx-auto" /></td>
                  <td className="py-3 px-4 border-r border-slate-850"><div className="h-3.5 w-20 bg-slate-800/40 rounded-md" /></td>
                  <td className="py-3 px-4 border-r border-slate-850"><div className="h-3.5 w-40 bg-slate-800/60 rounded-md" /></td>
                  <td className="py-3 px-4 border-r border-slate-850"><div className="h-3 w-36 bg-slate-800/30 rounded-md" /></td>
                  <td className="py-3 px-3 border-r border-slate-850"><div className="h-3 w-10 bg-slate-800/55 rounded-md mx-auto" /></td>
                  <td className="py-2.5 px-3 border-r border-slate-850"><div className="h-6 w-14 bg-slate-800/60 rounded-lg mx-auto" /></td>
                  <td className="py-2.5 px-3 border-r border-slate-850"><div className="h-6 w-14 bg-slate-800/60 rounded-lg mx-auto" /></td>
                  <td className="py-2.5 px-3 border-r border-slate-850"><div className="h-6 w-14 bg-slate-800/60 rounded-lg mx-auto" /></td>
                  <td className="py-2.5 px-3"><div className="h-6 w-full bg-slate-800/40 rounded-lg" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
