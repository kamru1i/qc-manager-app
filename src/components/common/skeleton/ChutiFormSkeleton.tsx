import React from 'react';

interface ChutiFormSkeletonProps {
  className?: string;
}

export const ChutiFormSkeleton: React.FC<ChutiFormSkeletonProps> = ({ className = '' }) => {
  return (
    <div className={`w-full flex flex-col gap-6 animate-pulse font-sans ${className}`}>
      {/* Main card container */}
      <div className="bg-theme-card-bg/40 backdrop-blur-xl shadow-2xl rounded-2xl p-6 lg:p-7 flex flex-col gap-6 border border-theme-border-muted/80">
        
        {/* Header Title & Subtitle */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 bg-blue-500/20 rounded-md" />
            <div className="h-5 w-48 bg-theme-border-input/60 rounded-lg" />
          </div>
          <div className="h-3.5 w-96 max-w-full bg-theme-border-input/30 rounded" />
        </div>

        {/* 2-Column Responsive Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 items-start">
          
          {/* Left Column Form */}
          <div className="lg:col-span-2 space-y-4">
            {/* DATE */}
            <div className="space-y-1.5">
              <div className="h-3 w-12 bg-theme-border-input/40 rounded" />
              <div className="h-10 w-full bg-theme-page-bg/60 border border-theme-border-input/60 rounded-xl" />
            </div>

            {/* LEAVE TYPE */}
            <div className="space-y-1.5">
              <div className="h-3 w-20 bg-theme-border-input/40 rounded" />
              <div className="h-10 w-full bg-theme-page-bg/60 border border-theme-border-input/60 rounded-xl" />
            </div>

            {/* COMMENT */}
            <div className="space-y-1.5">
              <div className="h-3 w-16 bg-theme-border-input/40 rounded" />
              <div className="h-20 w-full bg-theme-page-bg/60 border border-theme-border-input/60 rounded-xl" />
            </div>

            {/* Submit Button */}
            <div className="pt-4 border-t border-theme-border-input/50">
              <div className="h-10 w-36 bg-blue-600/30 rounded-xl" />
            </div>
          </div>

          {/* Right Column: Leave Usage Summary */}
          <div className="lg:col-span-1">
            <div className="bg-theme-page-bg/50 border border-theme-border-input/80 rounded-2xl p-5 flex flex-col gap-3.5 shadow-lg">
              {/* Header */}
              <div className="h-3.5 w-44 bg-theme-border-input/50 rounded pb-3 border-b border-theme-border-muted/70" />

              <div className="space-y-3 pt-1">
                {/* Office Leave */}
                <div className="bg-theme-card-bg/40 p-3.5 rounded-xl border border-theme-border-input/70 space-y-2">
                  <div className="h-2.5 w-20 bg-blue-400/30 rounded" />
                  <div className="h-4 w-32 bg-theme-border-input/50 rounded" />
                  <div className="h-3 w-24 bg-theme-border-input/30 rounded" />
                </div>

                {/* Govt Holiday */}
                <div className="bg-theme-card-bg/40 p-3.5 rounded-xl border border-theme-border-input/70 space-y-2">
                  <div className="h-2.5 w-20 bg-teal-400/30 rounded" />
                  <div className="h-4 w-28 bg-theme-border-input/50 rounded" />
                </div>

                {/* Full Leave Taken */}
                <div className="bg-theme-card-bg/40 p-3.5 rounded-xl border border-theme-border-input/70 space-y-2">
                  <div className="h-2.5 w-24 bg-theme-border-input/30 rounded" />
                  <div className="h-4 w-16 bg-theme-border-input/50 rounded" />
                </div>

                {/* Short Leave Taken */}
                <div className="bg-theme-card-bg/40 p-3.5 rounded-xl border border-theme-border-input/70 space-y-2">
                  <div className="h-2.5 w-28 bg-theme-border-input/30 rounded" />
                  <div className="h-4 w-20 bg-theme-border-input/50 rounded" />
                </div>

                {/* Overtime */}
                <div className="bg-theme-card-bg/40 p-3.5 rounded-xl border border-theme-border-input/70 space-y-2">
                  <div className="h-2.5 w-24 bg-theme-border-input/30 rounded" />
                  <div className="h-4 w-20 bg-theme-border-input/50 rounded" />
                </div>
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
