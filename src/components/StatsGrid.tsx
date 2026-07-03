import React from 'react';

interface Stats {
  total: number;
  quote: number;
  requote: number;
  requoteVan: number;
  requoteBike: number;
  review: number;
  reviewVan: number;
  reviewBike: number;
  individualReview: number;
  otherSite: number;
  van: number;
  bike: number;
  sale: number;
}

interface StatsGridProps {
  stats: Stats;
  isLoading?: boolean;
}

export const StatsGrid: React.FC<StatsGridProps> = ({ stats, isLoading = false }) => {
  const formatValue = (count: number) => {
    const padded = String(count).padStart(2, '0');
    if (stats.total === 0) return `${padded} (0%)`;
    const percentage = ((count / stats.total) * 100).toFixed(2);
    return `${padded} (${percentage}%)`;
  };

  const formatOtherSite = (count: number) => {
    return String(count).padStart(2, '0');
  };

  if (isLoading) {
    return (
      <div className="flex flex-wrap gap-2.5">
        <div className="bg-slate-900/60 border border-slate-850 rounded-xl px-4 py-2 w-28 h-9 animate-pulse" />
        <div className="bg-slate-900/60 border border-slate-850 rounded-xl px-4 py-2 w-24 h-9 animate-pulse" />
        <div className="bg-slate-900/60 border border-slate-850 rounded-xl px-4 py-2 w-20 h-9 animate-pulse" />
        <div className="bg-slate-900/60 border border-slate-850 rounded-xl px-4 py-2 w-24 h-9 animate-pulse" />
        <div className="bg-slate-900/60 border border-slate-850 rounded-xl px-4 py-2 w-20 h-9 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2.5">
      <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-355 shadow-sm flex items-center gap-2 min-h-9">
        Total Files: <strong className="text-white text-sm">{stats.total}</strong>
      </div>
      {stats.sale > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-350 shadow-sm flex items-center gap-2">
          Sale: <strong className="text-emerald-400 text-sm">{formatValue(stats.sale)}</strong>
        </div>
      )}
      {stats.quote > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-350 shadow-sm flex items-center gap-2">
          Quote: <strong className="text-blue-400 text-sm">{formatValue(stats.quote)}</strong>
        </div>
      )}
      {stats.requote > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-350 shadow-sm flex items-center gap-2">
          Requote: <strong className="text-purple-400 text-sm">{formatValue(stats.requote)}</strong>
        </div>
      )}
      {stats.requoteVan > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-350 shadow-sm flex items-center gap-2">
          Requote Van: <strong className="text-purple-500 text-sm">{formatValue(stats.requoteVan)}</strong>
        </div>
      )}
      {stats.requoteBike > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-350 shadow-sm flex items-center gap-2">
          Requote Bike: <strong className="text-blue-400 text-sm">{formatValue(stats.requoteBike)}</strong>
        </div>
      )}
      {stats.review > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-350 shadow-sm flex items-center gap-2">
          Review: <strong className="text-pink-400 text-sm">{formatValue(stats.review)}</strong>
        </div>
      )}
      {stats.reviewVan > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-350 shadow-sm flex items-center gap-2">
          Review Van: <strong className="text-pink-500 text-sm">{formatValue(stats.reviewVan)}</strong>
        </div>
      )}
      {stats.reviewBike > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-350 shadow-sm flex items-center gap-2">
          Review Bike: <strong className="text-rose-400 text-sm">{formatValue(stats.reviewBike)}</strong>
        </div>
      )}
      {stats.individualReview > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-350 shadow-sm flex items-center gap-2">
          Individual Review: <strong className="text-rose-400 text-sm">{formatValue(stats.individualReview)}</strong>
        </div>
      )}
      {stats.otherSite > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-350 shadow-sm flex items-center gap-2">
          Other Site: <strong className="text-purple-400 text-sm">{formatOtherSite(stats.otherSite)}</strong>
        </div>
      )}
      {stats.van > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-350 shadow-sm flex items-center gap-2">
          Van: <strong className="text-indigo-400 text-sm">{formatValue(stats.van)}</strong>
        </div>
      )}
      {stats.bike > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-350 shadow-sm flex items-center gap-2">
          Bike: <strong className="text-teal-400 text-sm">{formatValue(stats.bike)}</strong>
        </div>
      )}
    </div>
  );
};
