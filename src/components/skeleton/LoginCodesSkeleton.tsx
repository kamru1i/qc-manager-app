import React from 'react';
import { Key, Search } from 'lucide-react';

export const LoginCodesSkeleton: React.FC = () => {
  return (
    <div className="bg-slate-955/20 border border-slate-850 rounded-2xl p-5 space-y-6 relative flex flex-col min-h-[60vh] overflow-hidden" style={{ fontFamily: "'Noto Sans Bengali', 'Hind Siliguri', 'Inter', sans-serif" }}>
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-5 border-b border-slate-900 gap-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
            <Key className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-md font-bold text-white animate-pulse bg-slate-800/40 h-4 w-36 rounded-md"></h3>
            <p className="text-[11px] text-slate-450 mt-1.5 animate-pulse bg-slate-800/20 h-2.5 w-44 rounded-md"></p>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-slate-900/40 border border-slate-850/60 rounded-2xl p-4 flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full animate-pulse">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          <div className="w-full h-8.5 bg-slate-950/60 border border-slate-850 rounded-xl" />
        </div>
        <div className="h-8.5 w-24 bg-slate-800/40 rounded-xl animate-pulse" />
      </div>

      {/* List Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-900/10 border border-slate-900/40 animate-pulse"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-slate-800/40" />
                <div className="flex flex-col gap-1.5">
                  <div className="w-16 h-3.5 bg-slate-800/50 rounded-md" />
                  <div className="w-24 h-2 bg-slate-800/25 rounded" />
                </div>
              </div>
              <div className="w-16 h-7 bg-slate-850/40 rounded-xl" />
            </div>
          ))}
        </div>
      </div>

      {/* Footer info/legend */}
      <div className="pt-4 border-t border-slate-900 text-[10px] text-slate-500 flex justify-between items-center z-10 select-none">
        <div className="w-24 h-3 bg-slate-800/30 rounded animate-pulse" />
        <div className="w-56 h-3 bg-slate-800/30 rounded animate-pulse" />
      </div>
    </div>
  );
};

export default LoginCodesSkeleton;
