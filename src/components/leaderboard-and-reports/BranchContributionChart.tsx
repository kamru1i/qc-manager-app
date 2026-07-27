import React from 'react';
import { MapPin } from 'lucide-react';

interface BranchData {
  name: string;
  count: number;
  percentage: number;
}

interface BranchContributionChartProps {
  branchData: BranchData[];
  scopeLabel: string;
}

const BRANCH_COLORS = [
  'bg-blue-500 from-blue-600 to-blue-400',
  'bg-emerald-500 from-emerald-600 to-emerald-400',
  'bg-purple-500 from-purple-600 to-purple-400',
  'bg-rose-500 from-rose-600 to-rose-400',
];

export const BranchContributionChart: React.FC<BranchContributionChartProps> = ({
  branchData,
  scopeLabel,
}) => {
  return (
    <div className="bg-slate-950/40 border border-slate-800/85 p-5 rounded-2xl shadow-xl flex flex-col h-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-6">
        <h4 className="text-sm font-bold text-theme-text-primary flex items-center gap-2">
          <MapPin className="h-4.5 w-4.5 text-emerald-400" />
          Branches Contribution ({scopeLabel})
        </h4>
      </div>

      {branchData.length === 0 ? (
        <div className="flex-1 flex flex-col justify-center items-center text-slate-500 py-10">
          <MapPin className="h-10 w-10 text-slate-600 stroke-[1.5] mb-2" />
          <p className="text-xs">No branch records available.</p>
        </div>
      ) : (
        <div className="flex-1 space-y-5 max-h-72 overflow-y-auto pr-1 custom-scrollbar">
          {branchData.map((branch, idx) => {
            const colorClass = BRANCH_COLORS[idx % BRANCH_COLORS.length];
            return (
              <div key={branch.name} className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-300">{branch.name}</span>
                  <span className="font-extrabold text-theme-text-primary">
                    {branch.count} entries ({branch.percentage}%)
                  </span>
                </div>
                <div className="w-full h-2.5 bg-slate-900 border border-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full bg-linear-to-r ${colorClass} rounded-full transition-all duration-1000 ease-out`}
                    style={{ width: `${branch.percentage}%` }}
                  ></div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
