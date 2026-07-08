import React from 'react';

interface SettlementsTableSkeletonProps {
  className?: string;
}

export const SettlementsTableSkeleton: React.FC<SettlementsTableSkeletonProps> = ({
  className = '',
}) => {
  return (
    <div className={`w-full space-y-6 animate-pulse ${className}`}>
      {/* Top Header Row (Back Button Placeholder) */}
      <div className="flex justify-between items-center">
        <div className="h-9 w-20 bg-slate-800 rounded-lg"></div>
      </div>

      {/* Main Card Container */}
      <div className="bg-slate-900/20 border border-slate-850 rounded-2xl overflow-hidden">
        {/* Heading & Top Buttons Section */}
        <div className="px-6 py-5 border-b border-slate-850 bg-slate-900/40 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-2">
              <div className="h-5 w-5 bg-slate-800 rounded shrink-0"></div>
              <div className="h-5 w-72 bg-slate-800 rounded"></div>
            </div>
            <div className="h-3 w-96 bg-slate-800/60 rounded"></div>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-9 w-20 bg-slate-900/20 border border-slate-850 rounded-lg"></div>
            <div className="h-9 w-20 bg-slate-900/20 border border-slate-850 rounded-lg"></div>
          </div>
        </div>

        {/* Filter Bar Card inside */}
        <div className="p-6 border-b border-slate-850">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="space-y-2">
              <div className="h-3 w-24 bg-slate-800 rounded"></div>
              <div className="h-10 w-full bg-slate-900/20 border border-slate-850 rounded-lg"></div>
            </div>
            <div className="space-y-2">
              <div className="h-3 w-24 bg-slate-800 rounded"></div>
              <div className="h-10 w-full bg-slate-900/20 border border-slate-850 rounded-lg"></div>
            </div>
            <div className="space-y-2">
              <div className="h-3 w-24 bg-slate-800 rounded"></div>
              <div className="h-10 w-full bg-slate-900/20 border border-slate-850 rounded-lg"></div>
            </div>
            <div className="space-y-2">
              <div className="h-10 w-full bg-slate-900/20 border border-slate-850 rounded-lg"></div>
            </div>
          </div>
        </div>

        {/* Table Headers */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-850">
            <thead className="bg-slate-900/30">
              <tr>
                <th className="px-6 py-3.5 text-left"><div className="h-3 w-24 bg-slate-800 rounded"></div></th>
                <th className="px-6 py-3.5 text-left"><div className="h-3 w-28 bg-slate-800 rounded"></div></th>
                <th className="px-6 py-3.5 text-left"><div className="h-3 w-28 bg-slate-800 rounded"></div></th>
                <th className="px-6 py-3.5 text-left"><div className="h-3 w-16 bg-slate-800 rounded"></div></th>
                <th className="px-6 py-3.5 text-right"><div className="h-3 w-14 bg-slate-800 rounded ml-auto"></div></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850/60">
              {Array.from({ length: 4 }).map((_, idx) => (
                <tr key={idx}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="h-4 w-28 bg-slate-800 rounded"></div>
                    <div className="h-3 w-16 bg-slate-805/60 rounded mt-1.5"></div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="h-4 w-12 bg-slate-800 rounded"></div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="h-7 w-28 bg-slate-900/20 border border-slate-850 rounded-lg"></div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="h-5 w-16 bg-slate-850 rounded-full"></div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right flex justify-end gap-2 mt-2">
                    <div className="h-8 w-8 bg-slate-900/20 border border-slate-850 rounded-lg"></div>
                    <div className="h-8 w-8 bg-slate-900/20 border border-slate-850 rounded-lg"></div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
