'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, ChevronRight } from 'lucide-react';

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
    egress: { used_gb: number; limit_gb: number; pct: number; status: string };
    realtime_messages: { used: number; limit: number; pct: number; status: string };
    realtime_connections: { used: number; limit: number; pct: number; status: string };
    database_size: { used_gb: number; limit_gb: number; pct: number; status: string };
    mau: { used: number; limit: number; pct_str: string; status: string };
    edge_invocations: { used: number; limit: number; pct_str: string; status: string };
    cached_egress: { used_gb: number; limit_gb: number; pct: number; status: string };
    third_party_mau: { used: number; limit: number; pct: number; status: string };
    storage_size: { used_gb: number; limit_gb: number; pct: number; status: string };
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

export default function SupabaseUsageWidget() {
  const [data, setData] = useState<SupabaseSummaryData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

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

      {/* Main Full-Width Metric Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
        {/* 1. Egress */}
        <div className="flex items-center justify-between border-b border-zinc-800/60 pb-4">
          <div className="space-y-1 min-w-0">
            <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1 hover:text-white transition-colors cursor-pointer group">
              Egress <ChevronRight className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-300" />
            </span>
            <div className="text-xs font-mono font-medium text-zinc-200">
              {summary.egress.used_gb} / {summary.egress.limit_gb} GB ({summary.egress.pct}%)
            </div>
          </div>
          <ProgressRing pct={summary.egress.pct} colorClass="stroke-red-500 text-red-500" />
        </div>

        {/* 2. Realtime Messages */}
        <div className="flex items-center justify-between border-b border-zinc-800/60 pb-4">
          <div className="space-y-1 min-w-0">
            <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1 hover:text-white transition-colors cursor-pointer group">
              Realtime Messages <ChevronRight className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-300" />
            </span>
            <div className="text-xs font-mono font-medium text-zinc-200">
              {summary.realtime_messages.used.toLocaleString()} / {summary.realtime_messages.limit.toLocaleString()} ({summary.realtime_messages.pct}%)
            </div>
          </div>
          <ProgressRing pct={summary.realtime_messages.pct} colorClass="stroke-zinc-200 text-zinc-200" />
        </div>

        {/* 3. Realtime Concurrent Peak Connections */}
        <div className="flex items-center justify-between border-b border-zinc-800/60 pb-4">
          <div className="space-y-1 min-w-0">
            <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1 hover:text-white transition-colors cursor-pointer group">
              Realtime Concurrent Peak Connections <ChevronRight className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-300" />
            </span>
            <div className="text-xs font-mono font-medium text-zinc-200">
              {summary.realtime_connections.used} / {summary.realtime_connections.limit} ({summary.realtime_connections.pct}%)
            </div>
          </div>
          <ProgressRing pct={summary.realtime_connections.pct} colorClass="stroke-zinc-200 text-zinc-200" />
        </div>

        {/* 4. Database Size */}
        <div className="flex items-center justify-between border-b border-zinc-800/60 pb-4">
          <div className="space-y-1 min-w-0">
            <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1 hover:text-white transition-colors cursor-pointer group">
              Database Size <ChevronRight className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-300" />
            </span>
            <div className="text-xs font-mono font-medium text-zinc-200">
              {summary.database_size.used_gb} / {summary.database_size.limit_gb} GB ({summary.database_size.pct}%)
            </div>
          </div>
          <ProgressRing pct={summary.database_size.pct} colorClass="stroke-zinc-200 text-zinc-200" />
        </div>

        {/* 5. Monthly Active Users */}
        <div className="flex items-center justify-between border-b border-zinc-800/60 pb-4">
          <div className="space-y-1 min-w-0">
            <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1 hover:text-white transition-colors cursor-pointer group">
              Monthly Active Users <ChevronRight className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-300" />
            </span>
            <div className="text-xs font-mono font-medium text-zinc-200">
              {summary.mau.used} / {summary.mau.limit.toLocaleString()} MAU ({summary.mau.pct_str})
            </div>
          </div>
          <ProgressRing pct={1} colorClass="stroke-zinc-600 text-zinc-600" />
        </div>

        {/* 6. Edge Function Invocations */}
        <div className="flex items-center justify-between border-b border-zinc-800/60 pb-4">
          <div className="space-y-1 min-w-0">
            <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1 hover:text-white transition-colors cursor-pointer group">
              Edge Function Invocations <ChevronRight className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-300" />
            </span>
            <div className="text-xs font-mono font-medium text-zinc-200">
              {summary.edge_invocations.used} / {summary.edge_invocations.limit.toLocaleString()} ({summary.edge_invocations.pct_str})
            </div>
          </div>
          <ProgressRing pct={1} colorClass="stroke-zinc-600 text-zinc-600" />
        </div>

        {/* 7. Cached Egress */}
        <div className="flex items-center justify-between border-b border-zinc-800/60 pb-4">
          <div className="space-y-1 min-w-0">
            <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1 hover:text-white transition-colors cursor-pointer group">
              Cached Egress <ChevronRight className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-300" />
            </span>
            <div className="text-xs font-mono font-medium text-zinc-200">
              {summary.cached_egress.used_gb} / {summary.cached_egress.limit_gb} GB
            </div>
          </div>
          <ProgressRing pct={0} colorClass="stroke-zinc-700 text-zinc-700" />
        </div>

        {/* 8. Monthly Active Third-Party Users */}
        <div className="flex items-center justify-between border-b border-zinc-800/60 pb-4">
          <div className="space-y-1 min-w-0">
            <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1 hover:text-white transition-colors cursor-pointer group">
              Monthly Active Third-Party Users <ChevronRight className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-300" />
            </span>
            <div className="text-xs font-mono font-medium text-zinc-200">
              {summary.third_party_mau.used} / {summary.third_party_mau.limit.toLocaleString()} MAU
            </div>
          </div>
          <ProgressRing pct={0} colorClass="stroke-zinc-700 text-zinc-700" />
        </div>

        {/* 9. Storage Size */}
        <div className="flex items-center justify-between border-b border-zinc-800/60 pb-4">
          <div className="space-y-1 min-w-0">
            <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1 hover:text-white transition-colors cursor-pointer group">
              Storage Size <ChevronRight className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-300" />
            </span>
            <div className="text-xs font-mono font-medium text-zinc-200">
              {summary.storage_size.used_gb} / {summary.storage_size.limit_gb} GB
            </div>
          </div>
          <ProgressRing pct={0} colorClass="stroke-zinc-700 text-zinc-700" />
        </div>

        {/* 10. Monthly Active SSO Users */}
        <div className="flex items-center justify-between border-b border-zinc-800/60 pb-4">
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
        <div className="flex items-center justify-between border-b border-zinc-800/60 pb-4 md:border-b-0">
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
