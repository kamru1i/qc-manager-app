import React from 'react';

interface LeaveSettingsSkeletonProps {
  className?: string;
}

export const LeaveSettingsSkeleton: React.FC<LeaveSettingsSkeletonProps> = ({ className = '' }) => {
  return (
    <div className={`w-full animate-pulse font-sans ${className}`}>
      {/* Two Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column - Allocated & Eid Leaves (Span 1) */}
        <div className="space-y-6 lg:col-span-1">
          {/* Card 1: Office Allocated Leaves */}
          <div className="bg-theme-card-bg/40 backdrop-blur-xl border border-theme-border-muted/80 shadow-xl rounded-2xl p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between gap-2 pb-1 border-b border-theme-border-muted/60">
              <div className="space-y-1">
                <div className="h-3.5 w-36 bg-blue-400/30 rounded"></div>
                <div className="h-2.5 w-48 bg-theme-border-input/40 rounded"></div>
              </div>
              <div className="h-7 w-28 bg-theme-page-bg border border-theme-border-input/60 rounded-lg"></div>
            </div>
            <div className="grid grid-cols-2 gap-4 pt-1">
              <div className="space-y-1.5">
                <div className="h-3 w-16 bg-theme-border-input/40 rounded"></div>
                <div className="h-9 w-full bg-theme-page-bg border border-theme-border-input/60 rounded-lg"></div>
                <div className="h-2 w-16 bg-theme-border-input/30 rounded"></div>
              </div>
              <div className="space-y-1.5">
                <div className="h-3 w-16 bg-theme-border-input/40 rounded"></div>
                <div className="h-9 w-full bg-theme-page-bg border border-theme-border-input/60 rounded-lg"></div>
                <div className="h-2 w-16 bg-theme-border-input/30 rounded"></div>
              </div>
            </div>
            <div className="pt-2 border-t border-theme-border-muted/60">
              <div className="h-9 w-full bg-blue-600/30 rounded-lg"></div>
            </div>
          </div>

          {/* Card 2: Eid Festival Leaves */}
          <div className="bg-theme-card-bg/40 backdrop-blur-xl border border-theme-border-muted/80 shadow-xl rounded-2xl p-5 flex flex-col gap-4">
            <div className="space-y-1 pb-1 border-b border-theme-border-muted/60">
              <div className="h-3.5 w-32 bg-blue-400/30 rounded"></div>
              <div className="h-2.5 w-52 bg-theme-border-input/40 rounded"></div>
            </div>
            <div className="space-y-3 pt-1">
              <div className="space-y-1.5">
                <div className="h-3 w-28 bg-theme-border-input/40 rounded"></div>
                <div className="h-9 w-full bg-theme-page-bg border border-theme-border-input/60 rounded-lg"></div>
              </div>
              <div className="space-y-1.5">
                <div className="h-3 w-28 bg-theme-border-input/40 rounded"></div>
                <div className="h-9 w-full bg-theme-page-bg border border-theme-border-input/60 rounded-lg"></div>
              </div>
            </div>
            <div className="pt-2 border-t border-theme-border-muted/60">
              <div className="h-9 w-full bg-blue-600/30 rounded-lg"></div>
            </div>
          </div>
        </div>

        {/* Right Column - Government Holidays (Span 2) */}
        <div className="lg:col-span-2">
          <div className="bg-theme-card-bg/40 backdrop-blur-xl border border-theme-border-muted/80 shadow-xl rounded-2xl p-5 flex flex-col gap-4 h-full">
            <div className="space-y-1 pb-1 border-b border-theme-border-muted/60">
              <div className="h-3.5 w-48 bg-teal-400/30 rounded"></div>
              <div className="h-2.5 w-72 bg-theme-border-input/40 rounded"></div>
            </div>

            {/* Holiday Input Fields Row */}
            <div className="flex flex-col sm:flex-row gap-3 bg-theme-page-bg border border-theme-border-muted p-3.5 rounded-xl items-end">
              <div className="flex-1 w-full space-y-1">
                <div className="h-2.5 w-20 bg-theme-border-input/40 rounded"></div>
                <div className="h-8.5 w-full bg-theme-card-bg border border-theme-border-input/60 rounded-lg"></div>
              </div>
              <div className="flex-1 w-full space-y-1">
                <div className="h-2.5 w-20 bg-theme-border-input/40 rounded"></div>
                <div className="h-8.5 w-full bg-theme-card-bg border border-theme-border-input/60 rounded-lg"></div>
              </div>
              <div className="h-8.5 w-24 bg-teal-600/30 rounded-lg shrink-0"></div>
            </div>

            {/* Holidays List Area */}
            <div className="flex-1 flex flex-col gap-2 min-h-55">
              <div className="h-2.5 w-28 bg-theme-border-input/40 rounded"></div>
              <div className="flex-1 border border-theme-border-muted rounded-xl bg-theme-page-bg/20 divide-y divide-theme-border-muted/60 p-1">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex justify-between items-center px-4 py-2.5">
                    <div className="flex flex-col gap-1 w-2/3">
                      <div className="h-3.5 w-24 bg-theme-border-input/50 rounded font-mono" />
                      <div className="h-2.5 w-36 bg-theme-border-input/30 rounded font-sans" />
                    </div>
                    <div className="h-4 w-4 bg-red-400/30 rounded" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
