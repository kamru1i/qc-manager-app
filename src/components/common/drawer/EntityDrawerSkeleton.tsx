'use client';

import React from 'react';

export const EntityDrawerSkeleton: React.FC = () => {
  return (
    <div className="space-y-6 animate-pulse p-1">
      {/* Header Skeleton */}
      <div className="flex items-center gap-3.5">
        <div className="w-12 h-12 rounded-2xl bg-theme-border-input/40 shrink-0" />
        <div className="space-y-2 flex-1 min-w-0">
          <div className="h-5 bg-theme-border-input/50 rounded-lg w-2/3" />
          <div className="flex items-center gap-2">
            <div className="h-4 bg-theme-border-input/30 rounded-md w-20" />
            <div className="h-4 bg-theme-border-input/30 rounded-md w-16" />
          </div>
        </div>
      </div>

      {/* Metric Cards Skeleton */}
      <div className="grid grid-cols-3 gap-2.5">
        <div className="p-3 bg-theme-page-bg/70 border border-theme-border-input/40 rounded-xl space-y-2">
          <div className="h-3 bg-theme-border-input/40 rounded w-1/2" />
          <div className="h-6 bg-theme-border-input/60 rounded w-3/4" />
        </div>
        <div className="p-3 bg-theme-page-bg/70 border border-theme-border-input/40 rounded-xl space-y-2">
          <div className="h-3 bg-theme-border-input/40 rounded w-1/2" />
          <div className="h-6 bg-theme-border-input/60 rounded w-3/4" />
        </div>
        <div className="p-3 bg-theme-page-bg/70 border border-theme-border-input/40 rounded-xl space-y-2">
          <div className="h-3 bg-theme-border-input/40 rounded w-1/2" />
          <div className="h-6 bg-theme-border-input/60 rounded w-3/4" />
        </div>
      </div>

      {/* Section 1 Skeleton */}
      <div className="p-4 bg-theme-page-bg/60 border border-theme-border-input/40 rounded-2xl space-y-3">
        <div className="h-4 bg-theme-border-input/50 rounded w-1/3" />
        <div className="space-y-2 pt-1">
          <div className="h-10 bg-theme-card-bg/40 rounded-xl w-full" />
          <div className="h-10 bg-theme-card-bg/40 rounded-xl w-full" />
          <div className="h-10 bg-theme-card-bg/40 rounded-xl w-full" />
        </div>
      </div>

      {/* Section 2 Skeleton */}
      <div className="p-4 bg-theme-page-bg/60 border border-theme-border-input/40 rounded-2xl space-y-3">
        <div className="h-4 bg-theme-border-input/50 rounded w-1/4" />
        <div className="space-y-2 pt-1">
          <div className="h-9 bg-theme-card-bg/40 rounded-xl w-full" />
          <div className="h-9 bg-theme-card-bg/40 rounded-xl w-full" />
        </div>
      </div>
    </div>
  );
};
