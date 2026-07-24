"use client";

import React from "react";

interface CopyHelperSkeletonProps {
  className?: string;
}

export const CopyHelperSkeleton: React.FC<CopyHelperSkeletonProps> = ({
  className = "",
}) => {
  return (
    <div
      className={`bg-theme-page-bg/20 border border-theme-border-muted rounded-2xl p-5 space-y-6 font-sans animate-fade-in ${className}`}
    >
      {/* Header Skeleton */}
      <div className="flex justify-between items-center pb-1">
        <div className="space-y-1.5">
          <div className="h-5 w-72 bg-theme-border-input/40 rounded-lg animate-pulse" />
          <div className="h-3 w-56 bg-theme-border-input/30 rounded-md animate-pulse" />
        </div>
        <div className="h-9 w-9 bg-theme-card-bg border border-theme-border-input/50 rounded-lg animate-pulse shrink-0" />
      </div>

      {/* Grid of 6 Cards (2 columns on md+) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Box 1: Session Info */}
        <div className="bg-theme-card-bg/50 border border-theme-border-input/80 rounded-xl p-4.5 space-y-3">
          <div className="flex justify-between items-center">
            <div className="h-3.5 w-32 bg-blue-500/20 rounded-md animate-pulse" />
            <div className="h-7 w-7 bg-theme-border-input/30 rounded-lg animate-pulse" />
          </div>
          <div className="space-y-2.5 pt-1">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex justify-between items-center">
                <div className="h-3 w-20 bg-theme-border-input/30 rounded animate-pulse" />
                <div className="h-4 w-28 bg-theme-border-input/40 rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>

        {/* Box 2: Network & VPN Info */}
        <div className="bg-theme-card-bg/50 border border-theme-border-input/80 rounded-xl p-4.5 space-y-3">
          <div className="flex justify-between items-center">
            <div className="h-3.5 w-44 bg-blue-500/20 rounded-md animate-pulse" />
            <div className="h-7 w-7 bg-theme-border-input/30 rounded-lg animate-pulse" />
          </div>
          <div className="space-y-2.5 pt-1">
            <div className="flex justify-between items-center">
              <div className="h-3 w-20 bg-theme-border-input/30 rounded animate-pulse" />
              <div className="h-4 w-24 bg-theme-border-input/40 rounded animate-pulse" />
            </div>
            <div className="flex justify-between items-center">
              <div className="h-3 w-20 bg-theme-border-input/30 rounded animate-pulse" />
              <div className="h-4 w-32 bg-theme-border-input/40 rounded animate-pulse" />
            </div>
            <div className="flex justify-between items-center pt-1 border-t border-theme-border-muted/40">
              <div className="h-3 w-16 bg-theme-border-input/30 rounded animate-pulse" />
              <div className="h-4 w-28 bg-emerald-500/20 rounded animate-pulse" />
            </div>
          </div>
        </div>

        {/* Box 3: Quick Copy Actions */}
        <div className="bg-theme-card-bg/50 border border-theme-border-input/80 rounded-xl p-4.5 space-y-3 flex flex-col justify-between">
          <div className="h-3.5 w-40 bg-blue-500/20 rounded-md animate-pulse" />
          <div className="space-y-3 pt-1">
            <div className="flex justify-between items-center p-2.5 bg-theme-page-bg border border-theme-border-muted/60 rounded-lg">
              <div className="h-3 w-56 bg-theme-border-input/40 rounded animate-pulse" />
              <div className="h-6 w-6 bg-theme-border-input/30 rounded animate-pulse" />
            </div>
            <div className="flex justify-between items-center p-2.5 bg-theme-page-bg border border-theme-border-muted/60 rounded-lg">
              <div className="h-3 w-36 bg-theme-border-input/40 rounded animate-pulse" />
              <div className="h-6 w-6 bg-theme-border-input/30 rounded animate-pulse" />
            </div>
          </div>
        </div>

        {/* Box 4: Sales Summary */}
        <div className="bg-theme-card-bg/50 border border-theme-border-input/80 rounded-xl p-4.5 space-y-3">
          <div className="flex justify-between items-center">
            <div className="h-3.5 w-36 bg-blue-500/20 rounded-md animate-pulse" />
            <div className="h-7 w-7 bg-theme-border-input/30 rounded-lg animate-pulse" />
          </div>
          <div className="space-y-2.5 pt-1">
            <div className="h-4 w-48 bg-theme-border-input/40 rounded pb-1 border-b border-theme-border-muted/40 animate-pulse" />
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex justify-between items-center">
                <div className="h-3 w-24 bg-theme-border-input/30 rounded animate-pulse" />
                <div className="h-4 w-16 bg-theme-border-input/40 rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>

        {/* Box 5: Detailed Report */}
        <div className="bg-theme-card-bg/50 border border-theme-border-input/80 rounded-xl p-4.5 space-y-3">
          <div className="flex justify-between items-center">
            <div className="h-3.5 w-36 bg-blue-500/20 rounded-md animate-pulse" />
            <div className="h-7 w-7 bg-theme-border-input/30 rounded-lg animate-pulse" />
          </div>
          <div className="space-y-2.5 pt-1">
            <div className="h-4 w-44 bg-theme-border-input/40 rounded animate-pulse" />
            <div className="h-3 w-24 bg-theme-border-input/30 rounded animate-pulse" />
            <div className="pt-2 space-y-1.5 border-t border-theme-border-muted/40">
              <div className="h-3 w-full bg-theme-border-input/30 rounded animate-pulse" />
              <div className="h-3 w-3/4 bg-theme-border-input/30 rounded animate-pulse" />
            </div>
          </div>
        </div>

        {/* Box 6: Sales Summary (Admin Report) */}
        <div className="bg-theme-card-bg/50 border border-theme-border-input/80 rounded-xl p-4.5 space-y-3">
          <div className="flex justify-between items-center">
            <div className="space-y-1">
              <div className="h-3.5 w-36 bg-blue-500/20 rounded-md animate-pulse" />
              <div className="h-2.5 w-28 bg-theme-border-input/30 rounded animate-pulse" />
            </div>
            <div className="h-7 w-7 bg-theme-border-input/30 rounded-lg animate-pulse" />
          </div>
          <div className="space-y-2.5 pt-1">
            <div className="h-4 w-48 bg-theme-border-input/40 rounded pb-1 border-b border-theme-border-muted/40 animate-pulse" />
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex justify-between items-center">
                <div className="h-3 w-28 bg-theme-border-input/30 rounded animate-pulse" />
                <div className="h-4 w-16 bg-theme-border-input/40 rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Important Notes Box Skeleton */}
      <div className="bg-theme-card-bg/40 border border-theme-border-muted rounded-xl p-4 space-y-2.5">
        <div className="flex justify-between items-center">
          <div className="h-3.5 w-32 bg-rose-500/20 rounded-md animate-pulse" />
          <div className="h-6 w-6 bg-theme-border-input/30 rounded-md animate-pulse" />
        </div>
        <div className="h-20 w-full bg-theme-page-bg/80 border border-theme-border-input/60 rounded-lg animate-pulse" />
      </div>
    </div>
  );
};
