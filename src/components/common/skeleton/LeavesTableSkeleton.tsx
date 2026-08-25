import React from 'react';

interface LeavesTableSkeletonProps {
  rows?: number;
  allowOvertime?: boolean;
  className?: string;
  showNameColumn?: boolean;
}

export const LeavesTableSkeleton: React.FC<LeavesTableSkeletonProps> = ({
  rows = 5,
  allowOvertime = false,
  className = '',
  showNameColumn = false,
}) => {
  return (
    <div className={`w-full flex flex-col gap-4 animate-pulse font-sans ${className}`}>
      <div className="overflow-x-auto rounded-xl border border-theme-border-input/80 bg-theme-page-bg/40">
        <table className="min-w-full divide-y divide-theme-border-input/70">
          <thead className="bg-theme-page-bg/60">
            {showNameColumn ? (
              <tr>
                <th className="px-6 py-3.5 text-left"><div className="h-3 w-16 bg-theme-border-input/50 rounded"></div></th>
                <th className="px-6 py-3.5 text-center"><div className="h-3 w-16 bg-theme-border-input/50 rounded mx-auto"></div></th>
                <th className="px-6 py-3.5 text-center"><div className="h-3 w-10 bg-theme-border-input/50 rounded mx-auto"></div></th>
                <th className="px-6 py-3.5 text-center"><div className="h-3 w-24 bg-theme-border-input/50 rounded mx-auto"></div></th>
                <th className="px-6 py-3.5 text-center"><div className="h-3 w-20 bg-theme-border-input/50 rounded mx-auto"></div></th>
                <th className="px-6 py-3.5 text-left"><div className="h-3 w-28 bg-theme-border-input/50 rounded"></div></th>
                <th className="px-6 py-3.5 text-right"><div className="h-3 w-12 bg-theme-border-input/50 rounded ml-auto"></div></th>
              </tr>
            ) : (
              <tr>
                <th className="px-6 py-3.5 text-center"><div className="h-3 w-16 bg-theme-border-input/50 rounded mx-auto"></div></th>
                <th className="px-6 py-3.5 text-center"><div className="h-3 w-16 bg-theme-border-input/50 rounded mx-auto"></div></th>
                <th className="px-6 py-3.5 text-center"><div className="h-3 w-20 bg-theme-border-input/50 rounded mx-auto"></div></th>
                <th className="px-6 py-3.5 text-center"><div className="h-3 w-24 bg-theme-border-input/50 rounded mx-auto"></div></th>
                <th className="px-6 py-3.5 text-center"><div className="h-3 w-20 bg-theme-border-input/50 rounded mx-auto"></div></th>
                {allowOvertime && <th className="px-6 py-3.5 text-center"><div className="h-3 w-16 bg-theme-border-input/50 rounded mx-auto"></div></th>}
                <th className="px-6 py-3.5 text-left"><div className="h-3 w-28 bg-theme-border-input/50 rounded"></div></th>
                <th className="px-6 py-3.5 text-right"><div className="h-3 w-14 bg-theme-border-input/50 rounded ml-auto"></div></th>
              </tr>
            )}
          </thead>
          <tbody className="divide-y divide-theme-border-input/40 bg-theme-card-bg/20">
            {Array.from({ length: rows }).map((_, idx) => (
              <tr key={idx}>
                {showNameColumn ? (
                  <>
                    <td className="px-6 py-4"><div className="h-4 w-28 bg-theme-border-input/40 rounded"></div></td>
                    <td className="px-6 py-4"><div className="h-4 w-16 bg-theme-border-input/40 rounded mx-auto font-mono"></div></td>
                    <td className="px-6 py-4"><div className="h-5 w-20 bg-theme-border-input/40 rounded-full mx-auto"></div></td>
                    <td className="px-6 py-4"><div className="h-4 w-36 bg-theme-border-input/40 rounded mx-auto"></div></td>
                    <td className="px-6 py-4"><div className="h-4 w-12 bg-theme-border-input/40 rounded mx-auto"></div></td>
                    <td className="px-6 py-4"><div className="h-4 w-48 bg-theme-border-input/40 rounded"></div></td>
                    <td className="px-6 py-4 text-right"><div className="h-4 w-4 bg-theme-border-input/40 rounded-full ml-auto"></div></td>
                  </>
                ) : (
                  <>
                    <td className="px-6 py-4 whitespace-nowrap"><div className="h-4 w-20 bg-theme-border-input/40 rounded mx-auto"></div></td>
                    <td className="px-6 py-4 whitespace-nowrap"><div className="h-4 w-24 bg-theme-border-input/40 rounded mx-auto"></div></td>
                    <td className="px-6 py-4 whitespace-nowrap"><div className="h-4 w-24 bg-theme-border-input/40 rounded mx-auto"></div></td>
                    <td className="px-6 py-4 whitespace-nowrap"><div className="h-4 w-28 bg-theme-border-input/40 rounded mx-auto"></div></td>
                    <td className="px-6 py-4 whitespace-nowrap"><div className="h-4 w-12 bg-theme-border-input/40 rounded mx-auto"></div></td>
                    {allowOvertime && <td className="px-6 py-4 whitespace-nowrap"><div className="h-4 w-12 bg-theme-border-input/40 rounded mx-auto"></div></td>}
                    <td className="px-6 py-4"><div className="h-4 w-44 bg-theme-border-input/40 rounded"></div></td>
                    <td className="px-6 py-4 whitespace-nowrap text-right flex justify-end gap-2">
                      <div className="h-8 w-8 bg-theme-border-input/40 rounded-lg"></div>
                      <div className="h-8 w-8 bg-theme-border-input/40 rounded-lg"></div>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
