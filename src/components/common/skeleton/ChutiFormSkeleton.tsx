import React from 'react';

interface ChutiFormSkeletonProps {
  className?: string;
}

export const ChutiFormSkeleton: React.FC<ChutiFormSkeletonProps> = ({ className = '' }) => {
  const labelBg = 'bg-slate-850/60 rounded';
  const inputBg = 'bg-slate-800/40 rounded-xl border border-slate-800/60 h-11 w-full';
  const cardBg = 'bg-slate-900/20 border border-slate-850 rounded-2xl p-6';

  return (
    <div className={`w-full max-w-4xl mx-auto space-y-6 animate-pulse ${className}`}>
      {/* Main layout container */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left side form - spans 2 cols */}
        <div className="lg:col-span-2 space-y-6">
          <div className={cardBg}>
            {/* Form Title & subtitle */}
            <div className="space-y-2 pb-2 border-b border-slate-850/40">
              <div className="flex items-center gap-2">
                <div className="h-5 w-5 bg-slate-800 rounded" />
                <div className="h-5 w-44 bg-slate-800 rounded" />
              </div>
              <div className="h-3 w-80 bg-slate-850/50" />
            </div>

            {/* Input fields */}
            <div className="space-y-4 pt-2">
              {/* Row 1: Date & Leave Type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className={`h-3 w-12 ${labelBg}`} />
                  <div className={inputBg} />
                </div>
                <div className="space-y-2">
                  <div className={`h-3.5 w-20 ${labelBg}`} />
                  <div className={inputBg} />
                </div>
              </div>

              {/* Row 2: Sign-In & Sign-Out */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <div className={`h-3.5 w-24 ${labelBg}`} />
                    <div className="h-3 w-14 bg-slate-850/30 rounded" />
                  </div>
                  <div className={inputBg} />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <div className={`h-3.5 w-24 ${labelBg}`} />
                    <div className="h-3 w-14 bg-slate-850/30 rounded" />
                  </div>
                  <div className={inputBg} />
                </div>
              </div>

              {/* Row 3: Calculated Leave Hours */}
              <div className="space-y-2">
                <div className={`h-3.5 w-36 ${labelBg}`} />
                <div className={inputBg} />
              </div>

              {/* Row 4: Comment */}
              <div className="space-y-2">
                <div className={`h-3.5 w-20 ${labelBg}`} />
                <div className="h-24 w-full bg-slate-900/30 border border-slate-850 rounded-xl" />
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-4">
              <div className="h-11 w-full bg-indigo-600/15 border border-indigo-500/20 rounded-xl" />
            </div>
          </div>
        </div>

        {/* Right side: Leave Usage Summary - spans 1 col */}
        <div className="lg:col-span-1">
          <div className="bg-slate-900/20 border border-slate-850 rounded-2xl p-5 space-y-4">
            <div className="pb-2 border-b border-slate-850/50">
              <div className="h-4.5 w-48 bg-slate-800/60 rounded" />
            </div>

            {/* Leave summary cards */}
            <div className="space-y-4">
              {/* Office Leave summary card */}
              <div className="p-4 bg-slate-950/40 border border-slate-850/60 rounded-xl space-y-2">
                <div className={`h-2.5 w-32 ${labelBg}`} />
                <div className="h-6 w-28 bg-slate-800/50 rounded mt-1" />
                <div className="h-3 w-20 bg-slate-850/40 rounded" />
                <div className="h-2.5 w-36 bg-slate-850/20 rounded mt-1" />
              </div>

              {/* Short leave summary card */}
              <div className="p-4 bg-slate-950/40 border border-slate-850/60 rounded-xl space-y-2">
                <div className={`h-2.5 w-28 ${labelBg}`} />
                <div className="h-5 w-20 bg-slate-800/40 rounded mt-1" />
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
