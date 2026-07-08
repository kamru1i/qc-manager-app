import React from "react";

interface UserManagementSkeletonProps {
  rows?: number;
  className?: string;
}

export const UserManagementSkeleton: React.FC<UserManagementSkeletonProps> = ({
  rows = 8,
  className = "",
}) => {
  const bar = "bg-slate-800/50 rounded-lg";
  const barLight = "bg-slate-800/25 rounded";

  return (
    <div className={`space-y-5 animate-pulse ${className}`}>
      {/* Header: Title + Add New Staff button */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="space-y-1.5">
          <div className={`h-6 w-44 ${bar}`} />
          <div className={`h-3 w-96 ${barLight}`} />
        </div>
        <div className="h-9 w-36 bg-linear-to-r from-blue-900/30 to-purple-900/30 border border-blue-800/20 rounded-xl" />
      </div>

      {/* Search bar + Showing X users */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-slate-955/45 p-4 rounded-xl border border-slate-800/40">
        <div className={`h-9 w-full md:max-w-xs ${bar} rounded-xl`} />
        <div className={`h-3 w-24 ${barLight}`} />
      </div>

      {/* Table */}
      <div className="bg-slate-955/20 rounded-xl border border-slate-850 overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-4 px-4 py-3 border-b border-slate-800 bg-slate-900/40">
          {[
            "NAME / CODENAME",
            "ROLE",
            "LEAVE TRACKER",
            "QUOTES TRACKER",
            "FILE TYPE",
          ].map((_, i) => (
            <div
              key={i}
              className={`h-2.5 ${bar} ${i === 0 ? "w-3/5" : "w-4/5 mx-auto"}`}
            />
          ))}
        </div>

        {/* Table rows */}
        <div className="divide-y divide-slate-850">
          {Array.from({ length: rows }).map((_, i) => (
            <div
              key={i}
              className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-4 px-4 py-3.5 items-center"
            >
              {/* Name + Codename */}
              <div className="space-y-1.5">
                <div
                  className={`h-3.5 ${bar}`}
                  style={{ width: `${50 + (i % 5) * 10}%` }}
                />
                <div className={`h-2.5 w-14 ${barLight}`} />
              </div>
              {/* Role badge */}
              <div className="flex justify-center">
                <div className={`h-5 w-16 rounded-full ${bar}`} />
              </div>
              {/* Leave Tracker icon */}
              <div className="flex justify-center">
                <div className="w-5 h-5 rounded-full bg-emerald-900/20 border border-emerald-800/20" />
              </div>
              {/* Quotes Tracker icon */}
              <div className="flex justify-center">
                <div className="w-5 h-5 rounded-full bg-emerald-900/20 border border-emerald-800/20" />
              </div>
              {/* File Type */}
              <div className="flex justify-center">
                <div className={`h-3 w-20 ${barLight}`} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
