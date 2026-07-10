"use client";

import { DailyEntrySkeleton } from "@/components/common/skeleton/DailyEntrySkeleton";
import { MonthlyListSkeleton } from "@/components/common/skeleton/MonthlyListSkeleton";
import { QuoteRulesSkeleton } from "@/components/common/skeleton/QuoteRulesSkeleton";
import { AnalyticsSkeleton } from "@/components/common/skeleton/AnalyticsSkeleton";
import { AuditLogsSkeleton } from "@/components/common/skeleton/AuditLogsSkeleton";
import { IPCheckerSkeleton } from "@/components/common/skeleton/IPCheckerSkeleton";
import { LoginCodesSkeleton } from "@/components/common/skeleton/LoginCodesSkeleton";
import { AsitisCausalitySkeleton } from "@/components/common/skeleton/AsitisCausalitySkeleton";

interface SkeletonLoaderProps {
  type?:
    | "stats"
    | "table"
    | "form"
    | "chart"
    | "copy-helper"
    | "save-file"
    | "rules"
    | "users"
    | "analytics"
    | "audit-logs"
    | "ip_checker"
    | "login_codes"
    | "asitis_causality"
    | "eui_causality"
    | "causality"
    | "copy_helper"
    | "save_file"
    | "generic";
  rows?: number;
}

export function SkeletonLoader({ type = "generic", rows = 4 }: SkeletonLoaderProps) {
  // Common skeleton card wrapper style
  const cardBg = "bg-slate-900/30 border border-slate-850/80 backdrop-blur-md rounded-2xl p-5 animate-pulse";
  const innerBg = "bg-slate-800/40 rounded-lg";

  if (type === "stats") {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full">
        {[...Array(4)].map((_, i) => (
          <div key={i} className={`${cardBg} flex flex-col gap-3 py-4`}>
            <div className={`h-3 w-16 ${innerBg}`} />
            <div className={`h-7 w-10 ${innerBg} mt-1`} />
            <div className={`h-2.5 w-24 ${innerBg} mt-1`} />
          </div>
        ))}
      </div>
    );
  }

  if (type === "table") {
    return <MonthlyListSkeleton rows={rows} />;
  }

  if (type === "form") {
    return <DailyEntrySkeleton />;
  }

  if (type === "copy-helper") {
    return (
      <div className="bg-slate-955/20 border border-slate-850/80 rounded-2xl p-5 space-y-6 animate-pulse">
        {/* Header */}
        <div className="flex justify-between items-center border-b border-slate-850/50 pb-4">
          <div className="space-y-2">
            <div className={`h-5 w-48 ${innerBg}`} />
            <div className={`h-3 w-64 ${innerBg}`} />
          </div>
          <div className={`h-8 w-8 rounded-lg ${innerBg}`} />
        </div>
        {/* Helper Columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Left Boxes */}
          <div className="space-y-5">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-slate-900/40 border border-slate-850/60 rounded-xl p-4.5 space-y-3">
                <div className={`h-4 w-28 ${innerBg}`} />
                <div className="space-y-2">
                  <div className={`h-3 w-full ${innerBg}`} />
                  <div className={`h-3 w-5/6 ${innerBg}`} />
                </div>
              </div>
            ))}
          </div>
          {/* Right Box (Notes) */}
          <div className="bg-slate-900/40 border border-slate-850/60 rounded-xl p-4.5 space-y-3 flex flex-col h-full">
            <div className={`h-4 w-32 ${innerBg}`} />
            <div className={`h-36 w-full ${innerBg} flex-1`} />
          </div>
        </div>
      </div>
    );
  }

  if (type === "save-file") {
    return (
      <div className="bg-slate-955/20 border border-slate-850/80 rounded-2xl p-5 space-y-6 animate-pulse">
        {/* Header */}
        <div className="flex justify-between items-center border-b border-slate-850/50 pb-4">
          <div className="space-y-2">
            <div className={`h-5 w-44 ${innerBg}`} />
            <div className={`h-3 w-72 ${innerBg}`} />
          </div>
          <div className={`h-8 w-8 rounded-lg ${innerBg}`} />
        </div>
        {/* Left editor and Right history */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-5">
            <div className="space-y-2">
              <div className={`h-3 w-64 ${innerBg}`} />
              <div className={`h-[300px] w-full ${innerBg}`} />
            </div>
            <div className={`h-12 w-full ${innerBg}`} />
            <div className="space-y-2">
              <div className={`h-3 w-56 ${innerBg}`} />
              <div className={`h-24 w-full ${innerBg}`} />
            </div>
            <div className={`h-10 w-44 bg-blue-600/30 rounded-xl`} />
          </div>
          <div className="space-y-4 border-t lg:border-t-0 lg:border-l border-slate-850/60 pt-5 lg:pt-0 lg:pl-6">
            <div className={`h-4 w-36 ${innerBg}`} />
            <div className={`h-3 w-48 ${innerBg}`} />
            <div className="space-y-3 mt-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="p-3 bg-slate-900/40 border border-slate-850/50 rounded-xl space-y-2">
                  <div className={`h-3.5 w-40 ${innerBg}`} />
                  <div className={`h-2.5 w-full ${innerBg}`} />
                  <div className="flex gap-2">
                    <div className={`h-6 w-12 ${innerBg}`} />
                    <div className={`h-6 w-12 ${innerBg}`} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (type === "rules") {
    return <QuoteRulesSkeleton />;
  }

  if (type === "users") {
    return (
      <div className="space-y-6 w-full">
        <div className="space-y-1 animate-pulse">
          <div className={`h-6 w-40 ${innerBg}`} />
          <div className={`h-3 w-60 ${innerBg} mt-1`} />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left form */}
          <div className={`${cardBg} space-y-4 lg:col-span-1`}>
            <div className={`h-4 w-32 ${innerBg}`} />
            {[...Array(4)].map((_, i) => (
              <div key={i} className="space-y-2">
                <div className={`h-3 w-20 ${innerBg}`} />
                <div className={`h-9 w-full ${innerBg}`} />
              </div>
            ))}
            <div className={`h-9 w-full bg-blue-600/30 rounded-xl`} />
          </div>
          {/* Right list */}
          <div className="lg:col-span-2 space-y-4">
            <div className={`h-9 w-full ${innerBg} animate-pulse`} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className={`${cardBg} space-y-3`}>
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-full ${innerBg}`} />
                    <div className="space-y-1.5 flex-1">
                      <div className={`h-3 w-24 ${innerBg}`} />
                      <div className={`h-2.5 w-16 ${innerBg}`} />
                    </div>
                  </div>
                  <div className="flex justify-between border-t border-slate-850/60 pt-3">
                    <div className={`h-5 w-12 ${innerBg}`} />
                    <div className={`h-5 w-12 ${innerBg}`} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (type === "analytics") {
    return <AnalyticsSkeleton />;
  }

  if (type === "audit-logs") {
    return <AuditLogsSkeleton />;
  }

  if (type === "ip_checker") {
    return <IPCheckerSkeleton />;
  }

  if (type === "login_codes") {
    return <LoginCodesSkeleton />;
  }

  if (type === "asitis_causality" || type === "eui_causality" || type === "causality") {
    return <AsitisCausalitySkeleton />;
  }

  // default / generic
  return (
    <div className="space-y-3 w-full py-4 animate-pulse">
      {[...Array(rows)].map((_, i) => (
        <div key={i} className="flex flex-col gap-2 border border-slate-850/40 rounded-xl p-4">
          <div className={`h-4 w-1/3 ${innerBg}`} />
          <div className={`h-3.5 w-full ${innerBg}`} />
          <div className={`h-3 w-2/3 ${innerBg}`} />
        </div>
      ))}
    </div>
  );
}
