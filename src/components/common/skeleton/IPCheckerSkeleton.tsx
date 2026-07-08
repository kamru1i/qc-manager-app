import React from 'react';
import { Globe, Search } from 'lucide-react';

interface IPCheckerSkeletonProps {
  className?: string;
  cardsCount?: number;
  hideHeader?: boolean;
}

export const IPCheckerSkeleton: React.FC<IPCheckerSkeletonProps> = ({
  className = '',
  cardsCount = 6,
  hideHeader = false,
}) => {
  const cardsGrid = (
    <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${className}`}>
      {Array.from({ length: cardsCount }).map((_, idx) => (
        <div
          key={idx}
          className="p-4 rounded-xl border border-slate-800 bg-slate-955/10 animate-pulse flex flex-col justify-between h-[120px]"
        >
          <div>
            {/* Header */}
            <div className="flex justify-between items-center mb-3.5">
              <div className="w-24 h-3.5 bg-slate-800/50 rounded-md" />
              <div className="w-12 h-4 bg-slate-800/35 rounded-md" />
            </div>
            {/* Details */}
            <div className="space-y-2">
              <div className="flex justify-between">
                <div className="w-12 h-2 bg-slate-800/25 rounded" />
                <div className="w-20 h-2 bg-slate-800/40 rounded" />
              </div>
              <div className="flex justify-between">
                <div className="w-14 h-2 bg-slate-800/25 rounded" />
                <div className="w-28 h-2 bg-slate-800/40 rounded" />
              </div>
              <div className="flex justify-between">
                <div className="w-16 h-2 bg-slate-800/25 rounded" />
                <div className="w-24 h-2 bg-slate-800/40 rounded" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  if (hideHeader) {
    return cardsGrid;
  }

  return (
    <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-850 shadow-2xl rounded-2xl p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center pb-4 border-b border-slate-800 shrink-0">
        <h3 className="text-md font-bold text-white flex items-center gap-2">
          <Globe className="w-5 h-5 text-blue-500" />
          IP Address Safety Directory
        </h3>
      </div>

      {/* Search System */}
      <div className="flex justify-center w-full pb-2">
        <div className="flex gap-2 w-full max-w-md">
          <div className="relative flex-1 animate-pulse">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
            <div className="w-full h-8 bg-slate-955 border border-slate-850 rounded-xl" />
          </div>
          <div className="w-24 h-8 bg-slate-800/40 rounded-xl animate-pulse" />
        </div>
      </div>

      {/* Grid of cards */}
      {cardsGrid}
    </div>
  );
};
export default IPCheckerSkeleton;
