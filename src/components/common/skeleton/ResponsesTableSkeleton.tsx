import React from 'react';

interface ResponsesTableSkeletonProps {
  rows?: number;
  className?: string;
}

export const ResponsesTableSkeleton: React.FC<ResponsesTableSkeletonProps> = ({
  rows = 5,
  className = '',
}) => {
  return (
    <div className={`w-full space-y-6 animate-pulse font-sans ${className}`}>
      {/* Main Card Container */}
      <div className="bg-theme-card-bg/40 backdrop-blur-xl border border-theme-border-input/80 shadow-2xl rounded-2xl p-6 flex flex-col gap-6">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-theme-border-input/70 pb-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-5 w-5 bg-theme-border-input/50 rounded shrink-0"></div>
              <div className="h-5.5 w-56 bg-theme-border-input/50 rounded"></div>
            </div>
            <div className="h-3 w-[340px] bg-theme-border-input/30 rounded"></div>
          </div>
          {/* Export Buttons Skeletons */}
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <div className="h-8 w-20 bg-theme-page-bg/50 border border-theme-border-input/60 rounded-lg"></div>
            <div className="h-8 w-20 bg-theme-page-bg/50 border border-theme-border-input/60 rounded-lg"></div>
          </div>
        </div>

        {/* Search Filters Row */}
        <div className="flex flex-col sm:flex-row gap-3 w-full bg-theme-page-bg/50 p-3 rounded-xl border border-theme-border-input/60">
          <div className="flex-1 space-y-2">
            <div className="h-3 w-48 bg-theme-border-input/40 rounded"></div>
            <div className="h-9 w-full bg-theme-page-bg border border-theme-border-input/60 rounded-lg"></div>
          </div>
          <div className="w-full sm:w-48 space-y-2">
            <div className="h-3 w-32 bg-theme-border-input/40 rounded"></div>
            <div className="h-9 w-full bg-theme-page-bg border border-theme-border-input/60 rounded-lg"></div>
          </div>
          <div className="flex items-end">
            <div className="h-8 w-8 bg-theme-border-input/40 border border-theme-border-input/60 rounded-lg"></div>
          </div>
        </div>

        {/* Table Container */}
        <div className="overflow-x-auto rounded-xl border border-theme-border-input/80 bg-theme-page-bg/30">
          <table className="min-w-full divide-y divide-theme-border-input/60">
            <thead className="bg-theme-page-bg/60">
              <tr>
                <th className="px-6 py-3.5 text-left"><div className="h-3 w-28 bg-theme-border-input/50 rounded"></div></th>
                <th className="px-6 py-3.5 text-left"><div className="h-3 w-16 bg-theme-border-input/50 rounded"></div></th>
                <th className="px-6 py-3.5 text-left"><div className="h-3 w-24 bg-theme-border-input/50 rounded"></div></th>
                <th className="px-6 py-3.5 text-left"><div className="h-3 w-20 bg-theme-border-input/50 rounded"></div></th>
                <th className="px-6 py-3.5 text-right"><div className="h-3 w-14 bg-theme-border-input/50 rounded ml-auto"></div></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-theme-border-input/40 bg-theme-card-bg/20">
              {Array.from({ length: rows }).map((_, idx) => (
                <tr key={idx}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="h-4 w-32 bg-theme-border-input/40 rounded"></div>
                    <div className="h-3 w-16 bg-theme-border-input/30 rounded mt-1.5"></div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="h-4 w-12 bg-theme-border-input/40 rounded"></div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="h-4 w-28 bg-theme-border-input/40 rounded"></div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="h-4 w-20 bg-theme-border-input/40 rounded"></div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right flex justify-end gap-2">
                    <div className="h-8 w-8 bg-theme-page-bg border border-theme-border-input/60 rounded-lg"></div>
                    <div className="h-8 w-8 bg-theme-page-bg border border-theme-border-input/60 rounded-lg"></div>
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
