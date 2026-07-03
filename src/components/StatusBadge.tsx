import { ChutiRecord } from '@/utils/offlineSync';

interface StatusBadgeProps {
  record: ChutiRecord;
}

export function StatusBadge({ record: r }: StatusBadgeProps) {
  if (r.status === 'approved') {
    return (
      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-950/60 border border-emerald-950/80 text-emerald-400" title="Approved">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
      </span>
    );
  }
  if (r.status === 'approved_by_supervisor') {
    return (
      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-purple-950/60 border border-purple-950/80 text-purple-400" title="Supervisor Approved">
        <span className="w-1.5 h-1.5 rounded-full bg-purple-500 inline-block animate-pulse"></span>
      </span>
    );
  }
  if (r.status === 'needs_review') {
    return (
      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-950/60 border border-red-950/80 text-red-400" title="Revision Needed">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block animate-pulse"></span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-900 border border-slate-800 text-slate-400" title="Pending">
      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 inline-block animate-pulse"></span>
    </span>
  );
}
