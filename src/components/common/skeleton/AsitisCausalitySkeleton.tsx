import React from 'react';
import { FileText } from 'lucide-react';

export const AsitisCausalitySkeleton: React.FC = () => {
  const innerBg = "bg-slate-800/40 rounded-lg animate-pulse";
  
  return (
    <div className="bg-slate-955/20 border border-slate-850 rounded-2xl p-5 space-y-6 relative flex flex-col min-h-[70vh] overflow-hidden" style={{ fontFamily: "'Noto Sans Bengali', 'Hind Siliguri', 'Inter', sans-serif" }}>
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-5 border-b border-slate-850/60 border-dashed gap-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-md font-bold text-white animate-pulse bg-slate-800/40 h-4 w-52 rounded-md"></h3>
            <p className="text-[11px] text-slate-450 mt-1.5 animate-pulse bg-slate-800/20 h-2.5 w-72 rounded-md"></p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`h-8 w-24 ${innerBg}`} />
          <div className={`h-8 w-28 ${innerBg}`} />
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start flex-1">
        {/* Preview box representing template taking full width */}
        <div className="lg:col-span-12 space-y-3">
          <div className="flex justify-between items-center">
            <div className={`h-3.5 w-32 ${innerBg}`} />
            <div className={`h-3 w-56 ${innerBg}`} />
          </div>
          <div className="bg-slate-950 border border-slate-850 rounded-xl p-6 min-h-[60vh] flex flex-col gap-4">
            <div className={`h-4.5 w-16 ${innerBg}`} />
            <div className={`h-4.5 w-28 ${innerBg}`} />
            <div className={`h-4.5 w-24 ${innerBg}`} />
            <div className={`h-4.5 w-44 ${innerBg}`} />
            <div className={`h-4.5 w-40 ${innerBg}`} />
            <div className={`h-4.5 w-44 ${innerBg}`} />
            <div className={`h-4.5 w-20 ${innerBg}`} />
            <div className={`h-4.5 w-24 ${innerBg}`} />
            <div className={`h-4.5 w-32 ${innerBg}`} />
            <div className={`h-4.5 w-36 ${innerBg}`} />
            <div className={`h-4.5 w-32 ${innerBg}`} />
            <div className={`h-4.5 w-24 ${innerBg}`} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AsitisCausalitySkeleton;
