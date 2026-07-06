import React from 'react';

export const TeamLeaveRecordsSkeleton: React.FC = () => {
  return (
    <div className="space-y-6 animate-pulse">
      {/* 1. Header Card Skeleton */}
      <div className="bg-slate-900/40 border border-slate-800/80 p-5 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3 w-full md:w-auto">
          {/* Back button shape */}
          <div className="h-10 w-10 bg-slate-800/80 rounded-xl shrink-0"></div>
          {/* Calendar icon shape */}
          <div className="h-10 w-10 bg-slate-800/50 rounded-xl shrink-0"></div>
          <div className="space-y-2 flex-1 md:flex-none">
            <div className="h-4 w-48 bg-slate-800 rounded"></div>
            <div className="h-3 w-72 bg-slate-850 rounded"></div>
          </div>
        </div>
        {/* Date Selector input shape */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex-1 md:flex-none space-y-1">
            <div className="h-3 w-16 bg-slate-850 rounded"></div>
            <div className="h-9 w-36 bg-slate-800 rounded-xl"></div>
          </div>
          <div className="h-9 w-20 bg-slate-800 rounded-xl mt-4"></div>
        </div>
      </div>

      {/* 2. Filter Panel Card Skeleton */}
      <div className="bg-slate-900/40 border border-slate-800/80 p-5 rounded-2xl space-y-4">
        {/* Panel Header */}
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 bg-slate-800 rounded"></div>
          <div className="h-4 w-36 bg-slate-800 rounded"></div>
        </div>
        
        {/* Panel Controls */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <div className="h-3 w-20 bg-slate-850 rounded"></div>
            <div className="h-9 bg-slate-800 rounded-xl w-full"></div>
          </div>
          <div className="space-y-1.5">
            <div className="h-3 w-20 bg-slate-850 rounded"></div>
            <div className="h-9 bg-slate-800 rounded-xl w-full"></div>
          </div>
          <div className="space-y-1.5">
            <div className="h-3 w-20 bg-slate-850 rounded"></div>
            <div className="h-9 bg-slate-800 rounded-xl w-full"></div>
          </div>
          <div className="flex items-end gap-2">
            <div className="h-9 w-24 bg-slate-800 rounded-xl flex-1"></div>
            <div className="h-9 w-24 bg-slate-800 rounded-xl flex-1"></div>
            <div className="h-9 w-9 bg-slate-800 rounded-xl shrink-0"></div>
          </div>
        </div>
      </div>

      {/* 3. Table Card Skeleton */}
      <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl overflow-hidden">
        {/* Table Title and Search */}
        <div className="p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-850/80">
          <div className="space-y-2">
            <div className="h-4 w-44 bg-slate-800 rounded"></div>
            <div className="h-3 w-20 bg-slate-850 rounded"></div>
          </div>
          <div className="h-9 w-full sm:w-64 bg-slate-800 rounded-xl"></div>
        </div>

        {/* Table Body */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-805">
            <thead className="bg-slate-955/60">
              <tr>
                <th className="px-6 py-4"><div className="h-3 w-12 bg-slate-800 rounded"></div></th>
                <th className="px-6 py-4"><div className="h-3 w-16 bg-slate-800 rounded mx-auto"></div></th>
                <th className="px-6 py-4"><div className="h-3 w-10 bg-slate-800 rounded mx-auto"></div></th>
                <th className="px-6 py-4"><div className="h-3 w-24 bg-slate-800 rounded mx-auto"></div></th>
                <th className="px-6 py-4"><div className="h-3 w-20 bg-slate-800 rounded mx-auto"></div></th>
                <th className="px-6 py-4"><div className="h-3 w-16 bg-slate-800 rounded"></div></th>
                <th className="px-6 py-4 text-right"><div className="h-3 w-12 bg-slate-800 rounded ml-auto"></div></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850 bg-slate-900/10">
              {Array.from({ length: 5 }).map((_, idx) => (
                <tr key={idx}>
                  <td className="px-6 py-4"><div className="h-4 w-28 bg-slate-800 rounded"></div></td>
                  <td className="px-6 py-4"><div className="h-4 w-16 bg-slate-800 rounded mx-auto"></div></td>
                  <td className="px-6 py-4"><div className="h-4 w-20 bg-slate-800 rounded-full mx-auto"></div></td>
                  <td className="px-6 py-4"><div className="h-4 w-36 bg-slate-800 rounded mx-auto"></div></td>
                  <td className="px-6 py-4"><div className="h-4 w-12 bg-slate-800 rounded mx-auto"></div></td>
                  <td className="px-6 py-4"><div className="h-4 w-48 bg-slate-800 rounded"></div></td>
                  <td className="px-6 py-4 text-right"><div className="h-4 w-4 bg-slate-800 rounded-full ml-auto"></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
