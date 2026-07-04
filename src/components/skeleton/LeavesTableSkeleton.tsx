import React from 'react';

interface LeavesTableSkeletonProps {
  rows?: number;
  allowOvertime?: boolean;
  className?: string;
}

export const LeavesTableSkeleton: React.FC<LeavesTableSkeletonProps> = ({
  rows = 5,
  allowOvertime = false,
  className = '',
}) => {
  return (
    <div className={`w-full flex flex-col gap-4 animate-pulse ${className}`}>
      <div className="overflow-x-auto rounded-xl border border-slate-900 bg-slate-955/20">
        <table className="min-w-full divide-y divide-slate-805">
          <thead className="bg-slate-955/60">
            <tr>
              <th className="px-6 py-3.5 text-center"><div className="h-3 w-16 bg-slate-800 rounded mx-auto"></div></th>
              <th className="px-6 py-3.5 text-center"><div className="h-3 w-16 bg-slate-800 rounded mx-auto"></div></th>
              <th className="px-6 py-3.5 text-center"><div className="h-3 w-20 bg-slate-800 rounded mx-auto"></div></th>
              <th className="px-6 py-3.5 text-center"><div className="h-3 w-24 bg-slate-800 rounded mx-auto"></div></th>
              <th className="px-6 py-3.5 text-center"><div className="h-3 w-20 bg-slate-800 rounded mx-auto"></div></th>
              {allowOvertime && <th className="px-6 py-3.5 text-center"><div className="h-3 w-16 bg-slate-800 rounded mx-auto"></div></th>}
              <th className="px-6 py-3.5 text-left"><div className="h-3 w-28 bg-slate-800 rounded"></div></th>
              <th className="px-6 py-3.5 text-right"><div className="h-3 w-14 bg-slate-800 rounded ml-auto"></div></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-850 bg-slate-900/10">
            {Array.from({ length: rows }).map((_, idx) => (
              <tr key={idx}>
                <td className="px-6 py-4 whitespace-nowrap"><div className="h-4 w-20 bg-slate-800 rounded mx-auto"></div></td>
                <td className="px-6 py-4 whitespace-nowrap"><div className="h-4 w-24 bg-slate-800 rounded mx-auto"></div></td>
                <td className="px-6 py-4 whitespace-nowrap"><div className="h-4 w-24 bg-slate-800 rounded mx-auto"></div></td>
                <td className="px-6 py-4 whitespace-nowrap"><div className="h-4 w-28 bg-slate-800 rounded mx-auto"></div></td>
                <td className="px-6 py-4 whitespace-nowrap"><div className="h-4 w-12 bg-slate-800 rounded mx-auto"></div></td>
                {allowOvertime && <td className="px-6 py-4 whitespace-nowrap"><div className="h-4 w-12 bg-slate-800 rounded mx-auto"></div></td>}
                <td className="px-6 py-4"><div className="h-4 w-44 bg-slate-800 rounded"></div></td>
                <td className="px-6 py-4 whitespace-nowrap text-right flex justify-end gap-2">
                  <div className="h-8 w-8 bg-slate-800 rounded-lg"></div>
                  <div className="h-8 w-8 bg-slate-800 rounded-lg"></div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
