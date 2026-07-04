import React from 'react';

interface ProfileHeaderSkeletonProps {
  className?: string;
}

export const ProfileHeaderSkeleton: React.FC<ProfileHeaderSkeletonProps> = ({ className = '' }) => {
  return (
    <div
      className={`bg-slate-900/40 backdrop-blur-xl border border-slate-850 shadow-2xl rounded-2xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 animate-pulse ${className}`}
    >
      <div className="flex items-center gap-4 w-full md:w-auto">
        <div className="h-12 w-12 bg-slate-800 rounded-2xl shrink-0"></div>
        <div className="flex-1 flex flex-col gap-2">
          <div className="h-5 w-48 bg-slate-800 rounded"></div>
          <div className="h-3.5 w-32 bg-slate-800 rounded mt-1"></div>
        </div>
      </div>
      <div className="flex gap-2 w-full md:w-auto justify-end mt-2 md:mt-0">
        <div className="h-9 w-28 bg-slate-800 rounded-lg"></div>
        <div className="h-9 w-24 bg-slate-800 rounded-lg"></div>
        <div className="h-9 w-24 bg-slate-800 rounded-lg"></div>
      </div>
    </div>
  );
};
