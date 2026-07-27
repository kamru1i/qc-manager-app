import React from 'react';
import { FileText } from 'lucide-react';
import { getCategoryColor } from './reportHelpers';

interface CategoryData {
  name: string;
  count: number;
  percentage: number;
}

interface FileCategoryChartProps {
  categoryBreakdown: CategoryData[];
  scopeLabel: string;
}

export const FileCategoryChart: React.FC<FileCategoryChartProps> = ({
  categoryBreakdown,
  scopeLabel,
}) => {
  return (
    <div className="lg:col-span-2 bg-slate-900/20 border border-slate-800/80 p-5 rounded-2xl shadow-xl flex flex-col min-h-96">
      <h4 className="text-sm font-bold text-theme-text-primary mb-5 flex items-center gap-2">
        <FileText className="h-4.5 w-4.5 text-blue-400 animate-pulse" />
        File Category Distribution Breakdown ({scopeLabel})
      </h4>

      <p className="text-xs text-slate-400 mb-4 font-medium">
        Detailed breakdown of all 12 custom file types submitted during the selected period.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
        {categoryBreakdown.map((cat) => {
          const bgGradientClass = getCategoryColor(cat.name);
          return (
            <div
              key={cat.name}
              className="space-y-1.5 p-2 bg-slate-900/10 border border-slate-850 rounded-xl hover:bg-slate-900/30 hover:border-slate-800 transition-all duration-200"
            >
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-300">{cat.name}</span>
                <span className="font-extrabold text-theme-text-primary">
                  {cat.count}{' '}
                  <span className="text-[10px] text-slate-500 font-bold">
                    ({cat.percentage}%)
                  </span>
                </span>
              </div>
              <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-850">
                <div
                  className={`h-full bg-linear-to-r ${bgGradientClass} rounded-full transition-all duration-1000 ease-out`}
                  style={{ width: `${cat.percentage}%` }}
                ></div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
