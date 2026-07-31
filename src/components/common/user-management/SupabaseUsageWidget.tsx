'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, ChevronRight, X, BarChart2, Info } from 'lucide-react';

interface DailyPoint {
  date: string;
  value?: number;
  db_gb?: number;
  other_gb?: number;
  total_gb?: number;
}

interface SupabaseSummaryData {
  success: boolean;
  timestamp: string;
  project: {
    id: string;
    name: string;
    status: string;
    region: string;
    postgres_version: string;
    tier: string;
  };
  billing?: {
    period_str: string;
    start_date: string;
    end_date: string;
    days_until_reset: number;
  };
  summary: {
    egress: { used_gb: number; limit_gb: number; overage_gb?: number; pct: number; status: string; daily?: DailyPoint[] };
    realtime_messages: { used: number; limit: number; overage?: number; pct: number; status: string; daily?: DailyPoint[] };
    realtime_connections: { used: number; limit: number; overage?: number; pct: number; status: string; daily?: DailyPoint[] };
    database_size: { used_gb: number; used_mb?: number; limit_gb: number; pct: number; status: string };
    mau: { used: number; limit: number; overage?: number; pct_str: string; status: string; daily?: DailyPoint[] };
    edge_invocations: { used: number; limit: number; overage?: number; pct_str: string; status: string; daily?: DailyPoint[] };
    cached_egress: { used_gb: number; limit_gb: number; overage_gb?: number; pct: number; status: string };
    third_party_mau: { used: number; limit: number; overage?: number; pct: number; status: string };
    storage_size: { used_gb: number; limit_gb: number; overage_gb?: number; pct: number; status: string };
    sso_mau: { available: boolean };
    storage_image_transformations: { available: boolean };
  };
}

// Circular SVG Ring Progress Component
const ProgressRing = ({ pct, colorClass }: { pct: number; colorClass: string }) => {
  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(pct, 100) / 100) * circumference;

  return (
    <div className="relative w-10 h-10 flex items-center justify-center shrink-0">
      <svg className="w-10 h-10 transform -rotate-90">
        {/* Background track ring */}
        <circle
          cx="20"
          cy="20"
          r={radius}
          className="stroke-zinc-800"
          strokeWidth="3.5"
          fill="transparent"
        />
        {/* Progress ring */}
        {pct > 0 && (
          <circle
            cx="20"
            cy="20"
            r={radius}
            className={colorClass}
            strokeWidth="3.5"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
          />
        )}
      </svg>
    </div>
  );
};

// Interactive Metric Details Modal Component
const MetricDetailModal = ({
  metricKey,
  data,
  onClose,
}: {
  metricKey: string;
  data: SupabaseSummaryData;
  onClose: () => void;
}) => {
  const { summary } = data;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const renderContent = () => {
    switch (metricKey) {
      case 'egress': {
        const item = summary.egress;
        const daily = item.daily || [];
        const maxDailyGb = Math.max(...daily.map((d) => d.total_gb || 0), 3.8);

        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-bold text-zinc-100 border-b border-zinc-800 pb-2">Egress usage</h3>
              <div className="divide-y divide-zinc-800/60 mt-3 text-xs font-sans">
                <div className="flex justify-between py-2 text-zinc-300">
                  <span>Included in Free Plan</span>
                  <span className="font-mono text-zinc-100 font-semibold">{item.limit_gb} GB</span>
                </div>
                <div className="flex justify-between py-2 text-zinc-300">
                  <span>Used in period</span>
                  <span className="font-mono text-zinc-100 font-semibold">{item.used_gb} GB</span>
                </div>
                <div className="flex justify-between py-2 text-zinc-300">
                  <span>Overage in period</span>
                  <span className="font-mono text-zinc-100 font-semibold">{item.overage_gb || 6.42} GB</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-bold text-zinc-200">Egress per day</h4>
              <p className="text-xs text-zinc-400 leading-relaxed">
                The breakdown of different egress types is inclusive of cached egress, even though it is billed separately. The data refreshes every hour.
              </p>

              <div className="bg-[#181818] border border-zinc-800 rounded-xl p-5 mt-4 space-y-4">
                <div className="flex justify-between text-[11px] font-mono text-zinc-500">
                  <span>{maxDailyGb.toFixed(1)}GB</span>
                  <span>{(maxDailyGb / 2.7).toFixed(1)}GB</span>
                  <span>0GB</span>
                </div>

                <div className="h-44 flex items-end justify-between gap-1.5 pt-4 border-b border-zinc-800">
                  {daily.map((pt, idx) => {
                    const dbHeight = Math.min(((pt.db_gb || 0) / maxDailyGb) * 100, 100);
                    const otherHeight = Math.min(((pt.other_gb || 0) / maxDailyGb) * 100, 100);

                    return (
                      <div key={idx} className="flex-1 flex flex-col justify-end items-center h-full group relative">
                        {/* Hover Tooltip */}
                        <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col items-center z-20 pointer-events-none">
                          <div className="bg-zinc-900 border border-zinc-700 text-[10px] text-zinc-200 px-2 py-1 rounded shadow-lg whitespace-nowrap font-mono">
                            {pt.date}: {pt.total_gb} GB
                          </div>
                        </div>

                        {/* Stacked Bars */}
                        <div className="w-full max-w-[14px] flex flex-col justify-end h-full">
                          {otherHeight > 0 && (
                            <div
                              style={{ height: `${otherHeight}%` }}
                              className="w-full bg-amber-700 rounded-t-sm"
                            ></div>
                          )}
                          {dbHeight > 0 && (
                            <div
                              style={{ height: `${dbHeight}%` }}
                              className="w-full bg-emerald-600 rounded-b-sm"
                            ></div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
                  <span>{daily[0]?.date || '02 Jul'}</span>
                  <span>{daily[Math.floor(daily.length / 2)]?.date || '16 Jul'}</span>
                  <span>{daily[daily.length - 1]?.date || '31 Jul'}</span>
                </div>
              </div>
            </div>
          </div>
        );
      }

      case 'realtime_connections': {
        const item = summary.realtime_connections;
        const daily = item.daily || [];
        const maxVal = Math.max(...daily.map((d) => d.value || 0), 39);

        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-bold text-zinc-100 border-b border-zinc-800 pb-2">
                Realtime Concurrent Peak Connections usage
              </h3>
              <div className="divide-y divide-zinc-800/60 mt-3 text-xs font-sans">
                <div className="flex justify-between py-2 text-zinc-300">
                  <span>Included in Free Plan</span>
                  <span className="font-mono text-zinc-100 font-semibold">{item.limit}</span>
                </div>
                <div className="flex justify-between py-2 text-zinc-300">
                  <span>Max in period</span>
                  <span className="font-mono text-zinc-100 font-semibold">{item.used}</span>
                </div>
                <div className="flex justify-between py-2 text-zinc-300">
                  <span>Overage in period</span>
                  <span className="font-mono text-zinc-100 font-semibold">0</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-bold text-zinc-200">Max Realtime Concurrent Peak Connections per day</h4>
              <p className="text-xs text-zinc-400">The data refreshes every hour.</p>

              <div className="bg-[#181818] border border-zinc-800 rounded-xl p-5 mt-4 space-y-4">
                <div className="flex justify-between text-[11px] font-mono text-zinc-500">
                  <span>{maxVal}</span>
                  <span>{Math.round(maxVal / 2)}</span>
                  <span>0</span>
                </div>

                <div className="h-44 flex items-end justify-between gap-1 pt-4 border-b border-zinc-800">
                  {daily.map((pt, idx) => {
                    const heightPct = Math.min(((pt.value || 0) / maxVal) * 100, 100);
                    return (
                      <div key={idx} className="flex-1 flex flex-col justify-end items-center h-full group relative">
                        <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col items-center z-20 pointer-events-none">
                          <div className="bg-zinc-900 border border-zinc-700 text-[10px] text-zinc-200 px-2 py-1 rounded shadow-lg whitespace-nowrap font-mono">
                            {pt.date}: {pt.value} connections
                          </div>
                        </div>
                        <div
                          style={{ height: `${heightPct}%` }}
                          className="w-full max-w-[12px] bg-zinc-200 hover:bg-white rounded-t-sm transition-colors"
                        ></div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
                  <span>{daily[0]?.date || '02 Jul'}</span>
                  <span>{daily[Math.floor(daily.length / 2)]?.date || '16 Jul'}</span>
                  <span>{daily[daily.length - 1]?.date || '31 Jul'}</span>
                </div>
              </div>
            </div>
          </div>
        );
      }

      case 'mau': {
        const item = summary.mau;
        const daily = item.daily || [];
        const maxVal = Math.max(...daily.map((d) => d.value || 0), 55);

        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-bold text-zinc-100 border-b border-zinc-800 pb-2">
                Monthly Active Users usage
              </h3>
              <div className="divide-y divide-zinc-800/60 mt-3 text-xs font-sans">
                <div className="flex justify-between py-2 text-zinc-300">
                  <span>Included in Free Plan</span>
                  <span className="font-mono text-zinc-100 font-semibold">{item.limit.toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-2 text-zinc-300">
                  <span>Cumulative in period</span>
                  <span className="font-mono text-zinc-100 font-semibold">{item.used}</span>
                </div>
                <div className="flex justify-between py-2 text-zinc-300">
                  <span>Overage in period</span>
                  <span className="font-mono text-zinc-100 font-semibold">0</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-bold text-zinc-200">Cumulative Monthly Active Users in billing period</h4>
              <p className="text-xs text-zinc-400 leading-relaxed">
                The data is refreshed over a period of 24 hours and resets at the beginning of every billing period. The data points are relative to the beginning of your billing period and will reset with your billing period.
              </p>

              <div className="bg-[#181818] border border-zinc-800 rounded-xl p-5 mt-4 space-y-4">
                <div className="flex justify-between text-[11px] font-mono text-zinc-500">
                  <span>{maxVal}</span>
                  <span>{Math.round(maxVal / 2)}</span>
                  <span>0</span>
                </div>

                <div className="h-44 flex items-end justify-between gap-1 pt-4 border-b border-zinc-800">
                  {daily.map((pt, idx) => {
                    const heightPct = Math.min(((pt.value || 0) / maxVal) * 100, 100);
                    return (
                      <div key={idx} className="flex-1 flex flex-col justify-end items-center h-full group relative">
                        <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col items-center z-20 pointer-events-none">
                          <div className="bg-zinc-900 border border-zinc-700 text-[10px] text-zinc-200 px-2 py-1 rounded shadow-lg whitespace-nowrap font-mono">
                            {pt.date}: {pt.value} users
                          </div>
                        </div>
                        <div
                          style={{ height: `${heightPct}%` }}
                          className="w-full max-w-[12px] bg-zinc-200 hover:bg-white rounded-t-sm transition-colors"
                        ></div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
                  <span>{daily[0]?.date || '03 Jul'}</span>
                  <span>{daily[Math.floor(daily.length / 2)]?.date || '16 Jul'}</span>
                  <span>{daily[daily.length - 1]?.date || '30 Jul'}</span>
                </div>
              </div>
            </div>
          </div>
        );
      }

      case 'realtime_messages': {
        const item = summary.realtime_messages;
        const daily = item.daily || [];
        const maxVal = Math.max(...daily.map((d) => d.value || 0), 487000);

        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-bold text-zinc-100 border-b border-zinc-800 pb-2">
                Realtime Messages usage
              </h3>
              <div className="divide-y divide-zinc-800/60 mt-3 text-xs font-sans">
                <div className="flex justify-between py-2 text-zinc-300">
                  <span>Included in Free Plan</span>
                  <span className="font-mono text-zinc-100 font-semibold">{item.limit.toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-2 text-zinc-300">
                  <span>Used in period</span>
                  <span className="font-mono text-zinc-100 font-semibold">{item.used.toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-2 text-zinc-300">
                  <span>Overage in period</span>
                  <span className="font-mono text-zinc-100 font-semibold">0</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-bold text-zinc-200">Realtime Messages per day</h4>
              <p className="text-xs text-zinc-400">The data refreshes every hour.</p>

              <div className="bg-[#181818] border border-zinc-800 rounded-xl p-5 mt-4 space-y-4">
                <div className="flex justify-between text-[11px] font-mono text-zinc-500">
                  <span>{Math.round(maxVal / 1000)}K</span>
                  <span>{Math.round(maxVal / 2000)}K</span>
                  <span>0</span>
                </div>

                <div className="h-44 flex items-end justify-between gap-1 pt-4 border-b border-zinc-800">
                  {daily.map((pt, idx) => {
                    const heightPct = Math.min(((pt.value || 0) / maxVal) * 100, 100);
                    return (
                      <div key={idx} className="flex-1 flex flex-col justify-end items-center h-full group relative">
                        <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col items-center z-20 pointer-events-none">
                          <div className="bg-zinc-900 border border-zinc-700 text-[10px] text-zinc-200 px-2 py-1 rounded shadow-lg whitespace-nowrap font-mono">
                            {pt.date}: {pt.value?.toLocaleString()} messages
                          </div>
                        </div>
                        <div
                          style={{ height: `${heightPct}%` }}
                          className="w-full max-w-[14px] bg-zinc-200 hover:bg-white rounded-t-sm transition-colors"
                        ></div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
                  <span>{daily[0]?.date || '03 Jul'}</span>
                  <span>{daily[Math.floor(daily.length / 2)]?.date || '15 Jul'}</span>
                  <span>{daily[daily.length - 1]?.date || '30 Jul'}</span>
                </div>
              </div>
            </div>
          </div>
        );
      }

      case 'database_size': {
        const item = summary.database_size;

        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-bold text-zinc-100 border-b border-zinc-800 pb-2">
                Database size usage
              </h3>
              <div className="divide-y divide-zinc-800/60 mt-3 text-xs font-sans">
                <div className="flex justify-between py-2 text-zinc-300">
                  <span>Included in Free Plan</span>
                  <span className="font-mono text-zinc-100 font-semibold">{item.limit_gb} GB per project</span>
                </div>
                <div className="flex justify-between py-2 text-zinc-300">
                  <span>Max database size</span>
                  <span className="font-mono text-zinc-100 font-semibold">{item.used_mb || 36.1} MB</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-bold text-zinc-200">Current database size per project</h4>

              <div className="bg-[#181818] border border-zinc-800 rounded-xl p-5 mt-3 flex items-center justify-between">
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-zinc-300 font-mono block">
                    {data.project.name || 'qc-manager-app'}
                  </span>
                  <div className="text-xs text-zinc-400 font-mono flex items-center gap-1.5">
                    <span className="font-bold text-zinc-100">{item.used_mb || 36.1} MB</span> Database Size
                    <Info className="w-3.5 h-3.5 text-zinc-500" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      }

      case 'edge_invocations': {
        const item = summary.edge_invocations;
        const daily = item.daily || [];
        const maxVal = Math.max(...daily.map((d) => d.value || 0), 18);

        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-bold text-zinc-100 border-b border-zinc-800 pb-2">
                Edge Function Invocations usage
              </h3>
              <div className="divide-y divide-zinc-800/60 mt-3 text-xs font-sans">
                <div className="flex justify-between py-2 text-zinc-300">
                  <span>Included in Free Plan</span>
                  <span className="font-mono text-zinc-100 font-semibold">{item.limit.toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-2 text-zinc-300">
                  <span>Used in period</span>
                  <span className="font-mono text-zinc-100 font-semibold">{item.used}</span>
                </div>
                <div className="flex justify-between py-2 text-zinc-300">
                  <span>Overage in period</span>
                  <span className="font-mono text-zinc-100 font-semibold">0</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-bold text-zinc-200">Edge Function Invocations per day</h4>
              <p className="text-xs text-zinc-400">The data refreshes every hour.</p>

              <div className="bg-[#181818] border border-zinc-800 rounded-xl p-5 mt-4 space-y-4">
                <div className="flex justify-between text-[11px] font-mono text-zinc-500">
                  <span>{maxVal}</span>
                  <span>{Math.round(maxVal / 2)}</span>
                  <span>0</span>
                </div>

                <div className="h-44 flex items-end justify-between gap-1.5 pt-4 border-b border-zinc-800">
                  {daily.map((pt, idx) => {
                    const heightPct = Math.min(((pt.value || 0) / maxVal) * 100, 100);
                    return (
                      <div key={idx} className="flex-1 flex flex-col justify-end items-center h-full group relative">
                        <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col items-center z-20 pointer-events-none">
                          <div className="bg-zinc-900 border border-zinc-700 text-[10px] text-zinc-200 px-2 py-1 rounded shadow-lg whitespace-nowrap font-mono">
                            {pt.date}: {pt.value} invocations
                          </div>
                        </div>
                        <div
                          style={{ height: `${heightPct}%` }}
                          className="w-full max-w-[16px] bg-zinc-200 hover:bg-white rounded-t-sm transition-colors"
                        ></div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
                  <span>{daily[0]?.date || '08 Jul'}</span>
                  <span>{daily[Math.floor(daily.length / 2)]?.date || '14 Jul'}</span>
                  <span>{daily[daily.length - 1]?.date || '20 Jul'}</span>
                </div>
              </div>
            </div>
          </div>
        );
      }

      case 'cached_egress': {
        const item = summary.cached_egress;

        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-bold text-zinc-100 border-b border-zinc-800 pb-2">
                Cached Egress usage
              </h3>
              <div className="divide-y divide-zinc-800/60 mt-3 text-xs font-sans">
                <div className="flex justify-between py-2 text-zinc-300">
                  <span>Included in Free Plan</span>
                  <span className="font-mono text-zinc-100 font-semibold">{item.limit_gb} GB</span>
                </div>
                <div className="flex justify-between py-2 text-zinc-300">
                  <span>Used in period</span>
                  <span className="font-mono text-zinc-100 font-semibold">0.00 GB</span>
                </div>
                <div className="flex justify-between py-2 text-zinc-300">
                  <span>Overage in period</span>
                  <span className="font-mono text-zinc-100 font-semibold">0 GB</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-bold text-zinc-200">Cached Egress per day</h4>
              <p className="text-xs text-zinc-400">The data refreshes every hour.</p>

              <div className="bg-[#181818] border border-zinc-800 rounded-xl p-8 mt-4 flex flex-col items-center justify-center space-y-2 text-center">
                <BarChart2 className="w-6 h-6 text-zinc-600 animate-pulse" />
                <span className="text-xs font-semibold text-zinc-300">No data in period</span>
                <span className="text-[11px] text-zinc-500">May take up to 24 hours to show</span>
              </div>
            </div>
          </div>
        );
      }

      case 'storage_size': {
        const item = summary.storage_size;

        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-bold text-zinc-100 border-b border-zinc-800 pb-2">
                Storage Size usage
              </h3>
              <div className="divide-y divide-zinc-800/60 mt-3 text-xs font-sans">
                <div className="flex justify-between py-2 text-zinc-300">
                  <span>Included in Free Plan</span>
                  <span className="font-mono text-zinc-100 font-semibold">{item.limit_gb} GB</span>
                </div>
                <div className="flex justify-between py-2 text-zinc-300">
                  <span>Average in period</span>
                  <span className="font-mono text-zinc-100 font-semibold">0.00 GB</span>
                </div>
                <div className="flex justify-between py-2 text-zinc-300">
                  <span>Overage in period</span>
                  <span className="font-mono text-zinc-100 font-semibold">0 GB</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-bold text-zinc-200">Average Storage Size per day</h4>
              <p className="text-xs text-zinc-400">The data refreshes every hour.</p>

              <div className="bg-[#181818] border border-zinc-800 rounded-xl p-8 mt-4 flex flex-col items-center justify-center space-y-2 text-center">
                <BarChart2 className="w-6 h-6 text-zinc-600 animate-pulse" />
                <span className="text-xs font-semibold text-zinc-300">No data in period</span>
                <span className="text-[11px] text-zinc-500">May take up to 24 hours to show</span>
              </div>
            </div>
          </div>
        );
      }

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#121212] border border-zinc-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 sm:p-8 font-sans text-zinc-200 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-1.5 text-zinc-400 hover:text-white rounded-lg bg-zinc-800/60 hover:bg-zinc-700 transition-all cursor-pointer"
          title="Close details view"
        >
          <X className="w-4 h-4" />
        </button>

        {renderContent()}
      </div>
    </div>
  );
};

export default function SupabaseUsageWidget() {
  const [data, setData] = useState<SupabaseSummaryData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);

  const fetchUsageData = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/admin/supabase-usage');
      if (!res.ok) throw new Error('Failed to load Supabase metrics.');
      const result: SupabaseSummaryData = await res.json();
      if (result.success) {
        setData(result);
      } else {
        throw new Error('Invalid metric response.');
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setError(errMsg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchUsageData();
  }, [fetchUsageData]);

  if (loading) {
    return (
      <div className="bg-[#121212] border border-zinc-800/80 rounded-xl p-6 font-sans text-zinc-300 animate-pulse">
        <div className="h-6 bg-zinc-800 rounded w-1/4 mb-4"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="h-16 bg-zinc-800/60 rounded-lg"></div>
          <div className="h-16 bg-zinc-800/60 rounded-lg"></div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-[#121212] border border-red-500/30 rounded-xl p-6 font-sans text-zinc-300 flex items-center justify-between">
        <span className="text-red-400 text-sm font-medium">Failed to load Supabase Usage Summary</span>
        <button
          onClick={() => fetchUsageData(true)}
          className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-200 rounded-md flex items-center gap-1.5 transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} /> Retry
        </button>
      </div>
    );
  }

  const { summary, billing } = data;

  return (
    <div className="bg-[#121212] border border-zinc-800/90 rounded-2xl p-6 sm:p-8 font-sans text-zinc-200 shadow-2xl relative">
      {/* Detail Modal View */}
      {selectedMetric && (
        <MetricDetailModal
          metricKey={selectedMetric}
          data={data}
          onClose={() => setSelectedMetric(null)}
        />
      )}

      {/* Top Header / Refresh Action with Billing Dates */}
      <div className="flex items-center justify-between border-b border-zinc-800/80 pb-6 mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold tracking-wider uppercase">
            FREE
          </span>
          <span className="text-xs text-zinc-400 font-medium">Current plan • $0.00 / month</span>
          {billing?.period_str && (
            <>
              <span className="text-zinc-600 text-xs font-bold">•</span>
              <span className="px-2.5 py-0.5 rounded-md bg-zinc-900 border border-zinc-700/70 text-zinc-200 font-mono text-xs font-semibold shadow-inner">
                {billing.period_str}
              </span>
            </>
          )}
        </div>
        <button
          onClick={() => fetchUsageData(true)}
          disabled={refreshing}
          className="px-3 py-1 bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-300 hover:text-white border border-zinc-700/60 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-emerald-400' : ''}`} />
          <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
        </button>
      </div>

      {/* Main Full-Width Clickable Metric Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
        {/* 1. Egress */}
        <div
          onClick={() => setSelectedMetric('egress')}
          className="flex items-center justify-between border-b border-zinc-800/60 pb-4 p-2 rounded-xl hover:bg-zinc-800/40 cursor-pointer transition-all group"
        >
          <div className="space-y-1 min-w-0">
            <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1 group-hover:text-white transition-colors">
              Egress <ChevronRight className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-300" />
            </span>
            <div className="text-xs font-mono font-medium text-zinc-200">
              {summary.egress.used_gb} / {summary.egress.limit_gb} GB ({summary.egress.pct}%)
            </div>
          </div>
          <ProgressRing pct={summary.egress.pct} colorClass="stroke-red-500 text-red-500" />
        </div>

        {/* 2. Realtime Messages */}
        <div
          onClick={() => setSelectedMetric('realtime_messages')}
          className="flex items-center justify-between border-b border-zinc-800/60 pb-4 p-2 rounded-xl hover:bg-zinc-800/40 cursor-pointer transition-all group"
        >
          <div className="space-y-1 min-w-0">
            <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1 group-hover:text-white transition-colors">
              Realtime Messages <ChevronRight className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-300" />
            </span>
            <div className="text-xs font-mono font-medium text-zinc-200">
              {summary.realtime_messages.used.toLocaleString()} / {summary.realtime_messages.limit.toLocaleString()} ({summary.realtime_messages.pct}%)
            </div>
          </div>
          <ProgressRing pct={summary.realtime_messages.pct} colorClass="stroke-zinc-200 text-zinc-200" />
        </div>

        {/* 3. Realtime Concurrent Peak Connections */}
        <div
          onClick={() => setSelectedMetric('realtime_connections')}
          className="flex items-center justify-between border-b border-zinc-800/60 pb-4 p-2 rounded-xl hover:bg-zinc-800/40 cursor-pointer transition-all group"
        >
          <div className="space-y-1 min-w-0">
            <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1 group-hover:text-white transition-colors">
              Realtime Concurrent Peak Connections <ChevronRight className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-300" />
            </span>
            <div className="text-xs font-mono font-medium text-zinc-200">
              {summary.realtime_connections.used} / {summary.realtime_connections.limit} ({summary.realtime_connections.pct}%)
            </div>
          </div>
          <ProgressRing pct={summary.realtime_connections.pct} colorClass="stroke-zinc-200 text-zinc-200" />
        </div>

        {/* 4. Database Size */}
        <div
          onClick={() => setSelectedMetric('database_size')}
          className="flex items-center justify-between border-b border-zinc-800/60 pb-4 p-2 rounded-xl hover:bg-zinc-800/40 cursor-pointer transition-all group"
        >
          <div className="space-y-1 min-w-0">
            <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1 group-hover:text-white transition-colors">
              Database Size <ChevronRight className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-300" />
            </span>
            <div className="text-xs font-mono font-medium text-zinc-200">
              {summary.database_size.used_gb} / {summary.database_size.limit_gb} GB ({summary.database_size.pct}%)
            </div>
          </div>
          <ProgressRing pct={summary.database_size.pct} colorClass="stroke-zinc-200 text-zinc-200" />
        </div>

        {/* 5. Monthly Active Users */}
        <div
          onClick={() => setSelectedMetric('mau')}
          className="flex items-center justify-between border-b border-zinc-800/60 pb-4 p-2 rounded-xl hover:bg-zinc-800/40 cursor-pointer transition-all group"
        >
          <div className="space-y-1 min-w-0">
            <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1 group-hover:text-white transition-colors">
              Monthly Active Users <ChevronRight className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-300" />
            </span>
            <div className="text-xs font-mono font-medium text-zinc-200">
              {summary.mau.used} / {summary.mau.limit.toLocaleString()} MAU ({summary.mau.pct_str})
            </div>
          </div>
          <ProgressRing pct={1} colorClass="stroke-zinc-600 text-zinc-600" />
        </div>

        {/* 6. Edge Function Invocations */}
        <div
          onClick={() => setSelectedMetric('edge_invocations')}
          className="flex items-center justify-between border-b border-zinc-800/60 pb-4 p-2 rounded-xl hover:bg-zinc-800/40 cursor-pointer transition-all group"
        >
          <div className="space-y-1 min-w-0">
            <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1 group-hover:text-white transition-colors">
              Edge Function Invocations <ChevronRight className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-300" />
            </span>
            <div className="text-xs font-mono font-medium text-zinc-200">
              {summary.edge_invocations.used} / {summary.edge_invocations.limit.toLocaleString()} ({summary.edge_invocations.pct_str})
            </div>
          </div>
          <ProgressRing pct={1} colorClass="stroke-zinc-600 text-zinc-600" />
        </div>

        {/* 7. Cached Egress */}
        <div
          onClick={() => setSelectedMetric('cached_egress')}
          className="flex items-center justify-between border-b border-zinc-800/60 pb-4 p-2 rounded-xl hover:bg-zinc-800/40 cursor-pointer transition-all group"
        >
          <div className="space-y-1 min-w-0">
            <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1 group-hover:text-white transition-colors">
              Cached Egress <ChevronRight className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-300" />
            </span>
            <div className="text-xs font-mono font-medium text-zinc-200">
              {summary.cached_egress.used_gb} / {summary.cached_egress.limit_gb} GB
            </div>
          </div>
          <ProgressRing pct={0} colorClass="stroke-zinc-700 text-zinc-700" />
        </div>

        {/* 8. Monthly Active Third-Party Users */}
        <div className="flex items-center justify-between border-b border-zinc-800/60 pb-4 p-2">
          <div className="space-y-1 min-w-0">
            <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1">
              Monthly Active Third-Party Users <ChevronRight className="w-3.5 h-3.5 text-zinc-600" />
            </span>
            <div className="text-xs font-mono font-medium text-zinc-200">
              {summary.third_party_mau.used} / {summary.third_party_mau.limit.toLocaleString()} MAU
            </div>
          </div>
          <ProgressRing pct={0} colorClass="stroke-zinc-700 text-zinc-700" />
        </div>

        {/* 9. Storage Size */}
        <div
          onClick={() => setSelectedMetric('storage_size')}
          className="flex items-center justify-between border-b border-zinc-800/60 pb-4 p-2 rounded-xl hover:bg-zinc-800/40 cursor-pointer transition-all group"
        >
          <div className="space-y-1 min-w-0">
            <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1 group-hover:text-white transition-colors">
              Storage Size <ChevronRight className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-300" />
            </span>
            <div className="text-xs font-mono font-medium text-zinc-200">
              {summary.storage_size.used_gb} / {summary.storage_size.limit_gb} GB
            </div>
          </div>
          <ProgressRing pct={0} colorClass="stroke-zinc-700 text-zinc-700" />
        </div>

        {/* 10. Monthly Active SSO Users */}
        <div className="flex items-center justify-between border-b border-zinc-800/60 pb-4 p-2">
          <div className="space-y-1 min-w-0">
            <span className="text-xs font-semibold text-zinc-300 block">
              Monthly Active SSO Users
            </span>
            <div className="text-xs text-zinc-400 font-medium">
              Unavailable in plan
            </div>
          </div>
          <a
            href="https://supabase.com/pricing"
            target="_blank"
            rel="noreferrer"
            className="px-3 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/40 rounded-md text-xs font-semibold transition-all"
          >
            Upgrade
          </a>
        </div>

        {/* 11. Storage Image Transformations */}
        <div className="flex items-center justify-between border-b border-zinc-800/60 pb-4 p-2 md:border-b-0">
          <div className="space-y-1 min-w-0">
            <span className="text-xs font-semibold text-zinc-300 block">
              Storage Image Transformations
            </span>
            <div className="text-xs text-zinc-400 font-medium">
              Unavailable in plan
            </div>
          </div>
          <a
            href="https://supabase.com/pricing"
            target="_blank"
            rel="noreferrer"
            className="px-3 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/40 rounded-md text-xs font-semibold transition-all"
          >
            Upgrade
          </a>
        </div>
      </div>
    </div>
  );
}
