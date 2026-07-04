import React from 'react';

interface ChutiFormSkeletonProps {
  className?: string;
}

export const ChutiFormSkeleton: React.FC<ChutiFormSkeletonProps> = ({ className = '' }) => {
  return (
    <div className={`w-full max-w-4xl mx-auto space-y-6 animate-pulse ${className}`}>
      {/* Top box: Balance statistics grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div key={idx} className="bg-slate-900/40 border border-slate-900 rounded-2xl p-4 flex flex-col gap-2">
            <div className="h-3 w-16 bg-slate-800 rounded"></div>
            <div className="h-6 w-12 bg-slate-800 rounded mt-0.5"></div>
            <div className="h-2.5 w-24 bg-slate-850 rounded"></div>
          </div>
        ))}
      </div>

      {/* Main layout container */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left side form - spans 2 cols */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-slate-900/20 border border-slate-850 rounded-2xl p-6 space-y-6">
            {/* Form Title & subtitle */}
            <div className="space-y-2">
              <div className="h-5 w-44 bg-slate-800 rounded"></div>
              <div className="h-3.5 w-72 bg-slate-800/60 rounded"></div>
            </div>

            {/* Input fields */}
            <div className="space-y-4">
              {/* Date Input */}
              <div className="space-y-2">
                <div className="h-3.5 w-20 bg-slate-800 rounded"></div>
                <div className="h-11 w-full bg-slate-900/30 border border-slate-850 rounded-xl"></div>
              </div>

              {/* Leave Type Select */}
              <div className="space-y-2">
                <div className="h-3.5 w-24 bg-slate-800 rounded"></div>
                <div className="h-11 w-full bg-slate-900/30 border border-slate-850 rounded-xl"></div>
              </div>

              {/* Text Area for Comment */}
              <div className="space-y-2">
                <div className="h-3.5 w-32 bg-slate-800 rounded"></div>
                <div className="h-24 w-full bg-slate-900/30 border border-slate-850 rounded-xl"></div>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex gap-3 justify-end pt-2">
              <div className="h-11 w-24 bg-slate-800 rounded-xl"></div>
              <div className="h-11 w-32 bg-blue-600/20 border border-blue-600/30 rounded-xl"></div>
            </div>
          </div>
        </div>

        {/* Right side supervisor select card - spans 1 col */}
        <div className="lg:col-span-1">
          <div className="bg-slate-900/20 border border-slate-850 rounded-2xl p-5 space-y-4">
            <div className="space-y-1.5">
              <div className="h-4 w-36 bg-slate-800 rounded"></div>
              <div className="h-3 w-48 bg-slate-800/60 rounded"></div>
            </div>

            {/* Supervisor item rows */}
            <div className="space-y-3 pt-2">
              {Array.from({ length: 3 }).map((_, idx) => (
                <div key={idx} className="flex items-center gap-3 p-3 bg-slate-900/40 border border-slate-850/80 rounded-xl">
                  <div className="h-5 w-5 bg-slate-800 rounded-md"></div>
                  <div className="flex-1 flex flex-col gap-1.5">
                    <div className="h-3.5 w-24 bg-slate-800 rounded"></div>
                    <div className="h-2.5 w-16 bg-slate-850 rounded"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
