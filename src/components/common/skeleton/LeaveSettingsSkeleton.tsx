import React from 'react';

interface LeaveSettingsSkeletonProps {
  className?: string;
}

export const LeaveSettingsSkeleton: React.FC<LeaveSettingsSkeletonProps> = ({ className = '' }) => {
  return (
    <div className={`w-full space-y-6 animate-pulse ${className}`}>
      {/* Top Header Card */}
      <div className="bg-slate-900/20 border border-slate-850 shadow-sm rounded-2xl p-6 flex items-start gap-4">
        <div className="p-3 bg-slate-900/40 border border-slate-800 rounded-xl shrink-0">
          <div className="h-6 w-6 bg-slate-800 rounded"></div>
        </div>
        <div className="space-y-2 flex-1">
          <div className="h-5 w-40 bg-slate-800 rounded"></div>
          <div className="h-3.5 w-full max-w-2xl bg-slate-800/60 rounded"></div>
        </div>
      </div>

      {/* Two Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Allocated & Eid Leaves (Span 1) */}
        <div className="space-y-6 lg:col-span-1">
          {/* Card 1: Office Allocated Leaves */}
          <div className="bg-slate-900/20 border border-slate-850 rounded-2xl p-5 space-y-5">
            <div className="space-y-1.5">
              <div className="h-4 w-44 bg-slate-800 rounded"></div>
              <div className="h-3 w-56 bg-slate-800/60 rounded"></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="h-3 w-16 bg-slate-800 rounded"></div>
                <div className="h-10 w-full bg-slate-900/20 border border-slate-850 rounded-lg"></div>
                <div className="h-2.5 w-16 bg-slate-800/40 rounded"></div>
              </div>
              <div className="space-y-2">
                <div className="h-3 w-16 bg-slate-800 rounded"></div>
                <div className="h-10 w-full bg-slate-900/20 border border-slate-850 rounded-lg"></div>
                <div className="h-2.5 w-16 bg-slate-800/40 rounded"></div>
              </div>
            </div>
            <div className="h-10 w-full bg-blue-600/20 border border-blue-600/30 rounded-lg"></div>
          </div>

          {/* Card 2: Eid Festival Leaves */}
          <div className="bg-slate-900/20 border border-slate-850 rounded-2xl p-5 space-y-5">
            <div className="space-y-1.5">
              <div className="h-4 w-36 bg-slate-800 rounded"></div>
              <div className="h-3 w-60 bg-slate-800/60 rounded"></div>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="h-3 w-32 bg-slate-800 rounded"></div>
                <div className="h-10 w-full bg-slate-900/20 border border-slate-850 rounded-lg"></div>
              </div>
              <div className="space-y-2">
                <div className="h-3 w-32 bg-slate-800 rounded"></div>
                <div className="h-10 w-full bg-slate-900/20 border border-slate-850 rounded-lg"></div>
              </div>
            </div>
            <div className="h-10 w-full bg-blue-600/20 border border-blue-600/30 rounded-lg"></div>
          </div>
        </div>

        {/* Right Column - Government Holidays (Span 2) */}
        <div className="lg:col-span-2">
          <div className="bg-slate-900/20 border border-slate-850 rounded-2xl p-6 space-y-6 h-full flex flex-col">
            <div className="space-y-1.5">
              <div className="h-4.5 w-52 bg-slate-800 rounded"></div>
              <div className="h-3 w-72 bg-slate-800/60 rounded"></div>
            </div>

            {/* Holiday Input Fields Row */}
            <div className="bg-slate-900/10 border border-slate-850/80 rounded-xl p-4 grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div className="space-y-2">
                <div className="h-3 w-20 bg-slate-800 rounded"></div>
                <div className="h-10 w-full bg-slate-900/20 border border-slate-850 rounded-lg"></div>
              </div>
              <div className="space-y-2">
                <div className="h-3 w-20 bg-slate-800 rounded"></div>
                <div className="h-10 w-full bg-slate-900/20 border border-slate-850 rounded-lg"></div>
              </div>
              <div className="h-10 w-full bg-teal-600/20 border border-teal-600/30 rounded-lg"></div>
            </div>

            {/* Holidays List Area */}
            <div className="flex-1 space-y-3">
              <div className="h-3 w-32 bg-slate-800 rounded"></div>
              <div className="border border-dashed border-slate-800 rounded-xl p-12 flex items-center justify-center min-h-[180px]">
                <div className="h-4 w-60 bg-slate-800/40 rounded"></div>
              </div>
            </div>

            {/* Save Holiday Button */}
            <div className="flex justify-end pt-2">
              <div className="h-10 w-44 bg-teal-600/20 border border-teal-600/30 rounded-lg"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
