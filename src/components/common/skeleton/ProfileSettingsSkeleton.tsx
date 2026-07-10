import React from 'react';

interface ProfileSettingsSkeletonProps {
  className?: string;
}

export const ProfileSettingsSkeleton: React.FC<ProfileSettingsSkeletonProps> = ({ className = '' }) => {
  const labelBg = 'bg-slate-850/60 rounded';
  const inputBg = 'bg-slate-800/40 rounded-xl border border-slate-800/60';
  const innerCardBg = 'bg-slate-955/40 border border-slate-850/50 rounded-xl p-4';

  return (
    <div className={`w-full space-y-6 font-sans animate-pulse ${className}`}>
      {/* Page Title Header */}
      <div className="flex justify-between items-center pb-4 border-b border-slate-800/80">
        <div className="space-y-2">
          <div className="flex items-center gap-2.5">
            <div className="h-6 w-6 rounded bg-slate-800/60 animate-pulse" />
            <div className="h-6 w-44 rounded-lg bg-slate-800/50" />
          </div>
          <div className="h-3 w-96 rounded bg-slate-850/50 mt-1" />
        </div>
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Column 1: Settings Form */}
        <div className="lg:col-span-7 p-6 space-y-5 rounded-2xl border border-slate-800/60 bg-slate-900/40">
          <div className="h-5 w-48 rounded bg-slate-800/50 pb-2 border-b border-slate-800/40" />

          {/* Form items */}
          <div className="space-y-4">
            {/* Codename field */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <div className={`h-3 w-16 ${labelBg}`} />
                <div className="h-6 w-28 rounded bg-slate-800/30" />
              </div>
              <div className={`w-full h-10 ${inputBg}`} />
            </div>

            {/* Full Name field */}
            <div className="space-y-2">
              <div className={`h-3 w-16 ${labelBg}`} />
              <div className={`w-full h-10 ${inputBg}`} />
            </div>

            {/* Job Role field */}
            <div className="space-y-2">
              <div className={`h-3 w-16 ${labelBg}`} />
              <div className={`w-full h-10 ${inputBg}`} />
            </div>

            {/* Working Hours & Break Time (side-by-side) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className={`h-3 w-28 ${labelBg}`} />
                <div className={`w-full h-10 ${inputBg}`} />
              </div>
              <div className="space-y-2">
                <div className={`h-3 w-28 ${labelBg}`} />
                <div className={`w-full h-10 ${inputBg}`} />
              </div>
            </div>

            {/* Sign-In & Sign-Out (side-by-side) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <div className={`h-3 w-16 ${labelBg}`} />
                  <div className="h-3 w-12 bg-slate-850/30 rounded" />
                </div>
                <div className={`w-full h-10 ${inputBg}`} />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <div className={`h-3 w-16 ${labelBg}`} />
                  <div className="h-3 w-12 bg-slate-850/30 rounded" />
                </div>
                <div className={`w-full h-10 ${inputBg}`} />
              </div>
            </div>
          </div>
        </div>

        {/* Column 2: Notifications & Security */}
        <div className="lg:col-span-5 space-y-6">
          {/* Notifications Panel */}
          <div className="bg-slate-900/40 rounded-2xl border border-slate-800/60 p-6 space-y-4">
            <div className="h-5 w-32 rounded bg-slate-800/50 pb-2 border-b border-slate-800/40" />
            <div className={`${innerCardBg} flex items-center justify-between`}>
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-2">
                  <div className={`h-3.5 w-32 ${labelBg}`} />
                  <div className="h-4.5 w-10 rounded bg-slate-800/20" />
                </div>
                <div className="h-3 w-48 bg-slate-850/30 rounded" />
              </div>
              <div className="h-6 w-12 bg-slate-800/30 rounded-full" />
            </div>
          </div>

          {/* Change Password Panel */}
          <div className="bg-slate-900/40 rounded-2xl border border-slate-800/60 p-6">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/40">
              <div className="h-5 w-36 rounded bg-slate-800/50" />
              <div className="h-3 w-10 bg-slate-850/40 rounded" />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Section: Menu Tab Visibility */}
      <div className="bg-slate-900/40 rounded-2xl border border-slate-800/60 p-6 space-y-4">
        <div className="space-y-1.5 pb-2 border-b border-slate-800/40">
          <div className="h-5 w-60 rounded bg-slate-800/50" />
          <div className="h-3 w-[60%] bg-slate-850/40 rounded mt-1" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
          {/* Col 1 */}
          <div className="space-y-3">
            <div className={`h-3 w-36 ${labelBg} mb-2`} />
            {[...Array(3)].map((_, idx) => (
              <div key={idx} className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-800/60 bg-slate-955/20">
                <div className="h-4.5 w-4.5 rounded bg-slate-800/55" />
                <div className={`h-3.5 w-24 bg-slate-850/35 rounded`} />
              </div>
            ))}
          </div>
          {/* Col 2 */}
          <div className="space-y-3">
            <div className={`h-3 w-36 ${labelBg} mb-2`} />
            {[...Array(4)].map((_, idx) => (
              <div key={idx} className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-800/60 bg-slate-955/20">
                <div className="h-4.5 w-4.5 rounded bg-slate-800/55" />
                <div className={`h-3.5 w-28 bg-slate-850/35 rounded`} />
              </div>
            ))}
          </div>
          {/* Col 3 */}
          <div className="space-y-3">
            <div className={`h-3 w-36 ${labelBg} mb-2`} />
            {[...Array(4)].map((_, idx) => (
              <div key={idx} className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-800/60 bg-slate-955/20">
                <div className="h-4.5 w-4.5 rounded bg-slate-800/55" />
                <div className={`h-3.5 w-24 bg-slate-850/35 rounded`} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
