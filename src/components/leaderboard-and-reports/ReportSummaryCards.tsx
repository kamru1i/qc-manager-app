import React from 'react';
import { FileText, TrendingUp, CheckCircle, Clock, Eye } from 'lucide-react';
import { TypeStats, GrowthTrend, getGrowthStats } from './reportHelpers';

const GrowthBadge: React.FC<{ trend: GrowthTrend; label: string }> = ({ trend, label }) => {
  if (trend === 'up') {
    return (
      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
        <TrendingUp className="h-3 w-3 shrink-0" />
        {label}
      </span>
    );
  }
  if (trend === 'down') {
    return (
      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-rose-500/10 border border-rose-500/20 text-rose-400">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-3 w-3 shrink-0"
        >
          <line x1="7" y1="7" x2="17" y2="17"></line>
          <polyline points="17 7 17 17 7 17"></polyline>
        </svg>
        {label}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-slate-500/10 border border-slate-500/20 text-slate-400">
      <span className="w-1 h-1 rounded-full bg-slate-400 shrink-0"></span>
      {label}
    </span>
  );
};

interface ReportSummaryCardsProps {
  stats: TypeStats;
  previousStats: TypeStats;
  scopeLabel: string;
  comparisonLabel: string; // "year" | "month"
}

const CARD_DEFS = [
  {
    key: 'quotes' as const,
    title: 'Total Quotes',
    noun: 'Quotes',
    icon: FileText,
    accent: 'blue',
    iconBox: 'bg-blue-600/15 border-blue-500/20 text-blue-400',
    hover: 'hover:border-blue-500/30 hover:shadow-blue-500/5',
    glow: 'bg-blue-500/5 group-hover:bg-blue-500/10',
  },
  {
    key: 'requotes' as const,
    title: 'Total Requotes',
    noun: 'Requotes',
    icon: Clock,
    accent: 'purple',
    iconBox: 'bg-purple-600/15 border-purple-500/20 text-purple-400',
    hover: 'hover:border-purple-500/30 hover:shadow-purple-500/5',
    glow: 'bg-purple-500/5 group-hover:bg-purple-500/10',
  },
  {
    key: 'reviews' as const,
    title: 'Total Reviews',
    noun: 'Reviews',
    icon: Eye,
    accent: 'pink',
    iconBox: 'bg-pink-600/15 border-pink-500/20 text-pink-400',
    hover: 'hover:border-pink-500/30 hover:shadow-pink-500/5',
    glow: 'bg-pink-500/5 group-hover:bg-pink-500/10',
  },
  {
    key: 'sales' as const,
    title: 'Total Sales',
    noun: 'Sales',
    icon: CheckCircle,
    accent: 'emerald',
    iconBox: 'bg-emerald-600/15 border-emerald-500/20 text-emerald-400',
    hover: 'hover:border-emerald-500/30 hover:shadow-emerald-500/5',
    glow: 'bg-emerald-500/5 group-hover:bg-emerald-500/10',
  },
];

export const ReportSummaryCards: React.FC<ReportSummaryCardsProps> = ({
  stats,
  previousStats,
  scopeLabel,
  comparisonLabel,
}) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {CARD_DEFS.map(def => {
        const Icon = def.icon;
        return (
          <div
            key={def.key}
            className={`relative overflow-hidden bg-slate-950/40 border border-slate-800/80 p-5 rounded-2xl shadow-xl transition-all duration-300 group ${def.hover}`}
          >
            <div className={`absolute top-0 right-0 w-24 h-24 rounded-full blur-2xl transition-all duration-300 ${def.glow}`}></div>
            <div className="flex justify-between items-start gap-2">
              <div className="space-y-1.5 min-w-0">
                <p className="text-xs font-semibold text-slate-400">{def.title}</p>
                <div className="space-y-1 mt-1.5">
                  <h3 className="text-2xl sm:text-3xl font-extrabold text-theme-text-primary tracking-tight break-all">
                    {stats[def.key]}
                  </h3>
                  <div>
                    <GrowthBadge {...getGrowthStats(stats[def.key], previousStats[def.key])} />
                  </div>
                </div>
              </div>
              <div className={`p-2.5 border rounded-xl shrink-0 ${def.iconBox}`}>
                <Icon className="h-5 w-5" />
              </div>
            </div>
            <p className="text-[10px] text-slate-500 mt-4 font-medium flex justify-between items-center">
              <span>
                {def.noun} in {scopeLabel}
              </span>
              <span className="text-[9px] text-slate-500 opacity-80">
                vs. prev {comparisonLabel}
              </span>
            </p>
          </div>
        );
      })}
    </div>
  );
};
