import React from "react";

interface UserManagementSkeletonProps {
  rows?: number;
  className?: string;
}

export const UserManagementSkeleton: React.FC<UserManagementSkeletonProps> = ({
  rows = 9,
  className = "",
}) => {
  return (
    <div className={`space-y-5 animate-pulse font-sans ${className}`}>
      {/* Top Search Bar + Showing X users + Add New Staff Button */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        {/* Left: Search input */}
        <div className="h-10 w-full sm:w-80 bg-theme-page-bg/80 border border-theme-border-input/60 rounded-xl" />

        {/* Right: Showing users count + Add New Staff button */}
        <div className="flex items-center gap-4 shrink-0">
          <div className="h-4 w-28 bg-theme-border-input/40 rounded" />
          <div className="h-9 w-32 bg-blue-600/30 border border-blue-500/30 rounded-xl" />
        </div>
      </div>

      {/* Users Table Card */}
      <div className="bg-theme-card-bg/40 backdrop-blur-xl rounded-2xl border border-theme-border-input/80 overflow-hidden shadow-xl">
        {/* Table Header */}
        <div className="grid grid-cols-[2.5fr_1fr_1fr_1fr_2fr] gap-4 px-6 py-3.5 border-b border-theme-border-input/60 bg-theme-page-bg/40 text-[10px] font-bold text-theme-text-muted uppercase tracking-wider">
          <div>NAME / CODENAME</div>
          <div className="text-center">ROLE</div>
          <div className="text-center">LEAVE TRACKER</div>
          <div className="text-center">QUOTES TRACKER</div>
          <div>FILE TYPE</div>
        </div>

        {/* Table Rows */}
        <div className="divide-y divide-theme-border-input/40">
          {Array.from({ length: rows }).map((_, i) => (
            <div
              key={i}
              className="grid grid-cols-[2.5fr_1fr_1fr_1fr_2fr] gap-4 px-6 py-4 items-center hover:bg-theme-card-bg/20 transition-all"
            >
              {/* 1. Name / Codename */}
              <div className="space-y-1.5 min-w-0">
                <div
                  className="h-3.5 bg-theme-border-input/60 rounded-md font-semibold"
                  style={{ width: `${45 + ((i * 17) % 40)}%` }}
                />
                <div className="h-2.5 w-16 bg-theme-border-input/35 rounded font-mono" />
              </div>

              {/* 2. Role Badge */}
              <div className="flex justify-center">
                <div
                  className={`h-5 w-16 rounded-full border ${
                    i === 8
                      ? "bg-red-500/20 border-red-500/30"
                      : "bg-theme-page-bg border-theme-border-input/60"
                  }`}
                />
              </div>

              {/* 3. Leave Tracker (Green Check) */}
              <div className="flex justify-center">
                <div className="w-5 h-5 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-emerald-400/50" />
                </div>
              </div>

              {/* 4. Quotes Tracker (Green Check / X) */}
              <div className="flex justify-center">
                <div
                  className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                    i === 4
                      ? "bg-theme-page-bg/40 border-theme-border-input/40"
                      : "bg-emerald-500/15 border-emerald-500/30"
                  }`}
                >
                  <div
                    className={`w-2 h-2 rounded-full ${
                      i === 4 ? "bg-theme-text-muted/40" : "bg-emerald-400/50"
                    }`}
                  />
                </div>
              </div>

              {/* 5. File Type */}
              <div className="min-w-0">
                {i === 4 ? (
                  <div className="h-3 w-16 bg-theme-border-input/25 rounded italic" />
                ) : i === 7 ? (
                  <div className="h-3 w-56 bg-theme-border-input/35 rounded" />
                ) : (
                  <div className="h-3 w-24 bg-blue-500/30 rounded" />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
