import React from 'react';
import { TrendingUp } from 'lucide-react';
import { TypeStats } from './reportHelpers';

interface OperationalInsightsProps {
  totalRecords: number;
  scopedDaysCount: number;
  dominantActivity: { name: string; count: number; percentage: number };
  stats: TypeStats;
}

export const OperationalInsights: React.FC<OperationalInsightsProps> = ({
  totalRecords,
  scopedDaysCount,
  dominantActivity,
  stats,
}) => {
  return (
    <div className="bg-theme-card-bg/40 backdrop-blur-xl border border-theme-border-input/80 p-5 rounded-2xl shadow-xl flex flex-col justify-between min-h-96">
      <div>
        <h4 className="text-sm font-bold text-theme-text-primary mb-5 flex items-center gap-2">
          <TrendingUp className="h-4.5 w-4.5 text-emerald-400" />
          Operational Insights
        </h4>

        <div className="space-y-4">
          <div className="bg-slate-900/20 border border-slate-850 p-4 rounded-xl space-y-1.5">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
              Average Submissions / Day
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-extrabold text-theme-text-primary">
                {(totalRecords / scopedDaysCount).toFixed(1)}
              </span>
              <span className="text-xs text-slate-400 font-semibold">
                entries / day
              </span>
            </div>
          </div>

          <div className="bg-slate-900/20 border border-slate-850 p-4 rounded-xl space-y-1.5">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
              Dominant Submission Type
            </span>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-extrabold text-theme-text-primary truncate max-w-[65%]">
                {dominantActivity.name}
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 shrink-0">
                {dominantActivity.count} files
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 pt-4 border-t border-slate-800/60">
        <span className="text-[10px] text-slate-505 font-bold uppercase tracking-wider block mb-2">
          Executive Summary
        </span>
        <p className="text-xs text-slate-300 leading-relaxed font-medium">
          {totalRecords === 0
            ? 'No submission activities recorded for this period. Start logging entries to view insights.'
            : `During this period, a total of ${totalRecords} records were processed. The system achieved a sales conversion rate of ${stats.conversionRate.toFixed(2)}% (${stats.sales} sales out of ${stats.quotes} quotes). ${
                dominantActivity.count > 0
                  ? `The primary driver of activity was ${dominantActivity.name}, contributing to ${dominantActivity.percentage.toFixed(2)}% of all operations.`
                  : ''
              }`}
        </p>
      </div>
    </div>
  );
};
