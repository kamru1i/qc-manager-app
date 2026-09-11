'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { History } from 'lucide-react';
import { ChutiRecord } from '@/utils/offlineSync';
import { 
  formatDate, 
  formatDateTime, 
  formatDuration, 
  parseIntervalToMinutes, 
  getRecordAdjustmentEntries, 
  getRecordAdjustedMinutes, 
  getRecordRemainingMinutes,
  LeaveAdjustmentEntry 
} from '@/utils/dashboardHelpers';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface ShortLeaveHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  record?: ChutiRecord | null;
  userRecords?: ChutiRecord[];
}

export function ShortLeaveHistoryModal({
  isOpen,
  onClose,
  record,
  userRecords = [],
}: ShortLeaveHistoryModalProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // ESC key handler
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !isMounted) return null;

  // Render single record's adjustments
  const renderSingleRecordHistory = (rec: ChutiRecord) => {
    const originalMins = rec.leave_hour ? parseIntervalToMinutes(rec.leave_hour) : 0;
    const adjustedMins = getRecordAdjustedMinutes(rec);
    const remainingMins = getRecordRemainingMinutes(rec);
    const entries = getRecordAdjustmentEntries(rec);

    return (
      <div className="space-y-4">
        {/* Record Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-theme-page-bg/50 border border-theme-border-input/80 p-3 rounded-xl text-center">
          <div className="p-2 rounded-lg bg-theme-card-bg/60 border border-theme-border-muted">
            <span className="text-theme-text-muted block text-[10px] uppercase font-bold">Leave Date</span>
            <span className="font-mono font-bold text-theme-text-primary text-xs">{formatDate(rec.date)}</span>
          </div>
          <div className="p-2 rounded-lg bg-theme-card-bg/60 border border-theme-border-muted">
            <span className="text-theme-text-muted block text-[10px] uppercase font-bold">Original Duration</span>
            <span className="font-mono font-bold text-theme-text-primary text-xs">{formatDuration(originalMins)}</span>
          </div>
          <div className="p-2 rounded-lg bg-theme-card-bg/60 border border-theme-border-muted">
            <span className="text-theme-text-muted block text-[10px] uppercase font-bold">Total Adjusted</span>
            <span className="font-mono font-bold text-cyan-400 text-xs">{formatDuration(adjustedMins)}</span>
          </div>
          <div className="p-2 rounded-lg bg-theme-card-bg/60 border border-theme-border-muted">
            <span className="text-theme-text-muted block text-[10px] uppercase font-bold">Remaining</span>
            <span className={`font-mono font-bold text-xs ${remainingMins === 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
              {formatDuration(remainingMins)}
            </span>
          </div>
        </div>

        {/* Entries Table */}
        {entries.length === 0 ? (
          <div className="py-8 text-center text-theme-text-muted text-xs">
            No adjustment events recorded for this leave record.
          </div>
        ) : (
          <div className="overflow-x-auto border border-theme-border-input/80 rounded-xl bg-theme-page-bg/40">
            <table className="w-full text-left text-xs border-collapse table-auto">
              <thead>
                <tr className="border-b border-theme-border-input/80 text-[10px] text-theme-text-muted uppercase font-bold tracking-wider bg-theme-card-container/50">
                  <th className="py-2.5 px-3 whitespace-nowrap">Adjusted Amount</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Adjustment Source</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Action Date</th>
                  <th className="py-2.5 px-4 min-w-[180px]">Details / Comment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-theme-border-input/40">
                {entries.map((entry, idx) => {
                  const isOT = entry.source === 'Overtime';
                  const isGeneral = entry.source === 'General Adjustment';
                  const isGovt = entry.source === 'Govt Holiday';
                  const isSalary = entry.source === 'Salary';
                  const isEid = entry.source === 'Eid-ul-Fitr' || entry.source === 'Eid-ul-Adha';

                  let badge = (
                    <Badge variant="default" className="text-[10px] font-semibold bg-blue-500/10 text-blue-400 border-blue-500/30 whitespace-nowrap">
                      {entry.source}
                    </Badge>
                  );

                  if (isOT) {
                    badge = (
                      <Badge variant="warning" className="text-[10px] font-semibold bg-amber-500/10 text-amber-300 border-amber-500/30 whitespace-nowrap">
                        Overtime
                      </Badge>
                    );
                  } else if (isGeneral) {
                    badge = (
                      <Badge variant="default" className="text-[10px] font-semibold bg-blue-500/10 text-blue-400 border-blue-500/30 whitespace-nowrap">
                        General Adjustment
                      </Badge>
                    );
                  } else if (isGovt) {
                    badge = (
                      <Badge variant="success" className="text-[10px] font-semibold bg-teal-500/10 text-teal-300 border-teal-500/30 whitespace-nowrap">
                        Govt Holiday
                      </Badge>
                    );
                  } else if (isSalary) {
                    badge = (
                      <Badge variant="warning" className="text-[10px] font-semibold bg-amber-500/10 text-amber-400 border-amber-500/30 whitespace-nowrap">
                        Salary Deduction
                      </Badge>
                    );
                  } else if (isEid) {
                    badge = (
                      <Badge variant="outline" className="text-[10px] font-semibold bg-purple-500/10 text-purple-300 border-purple-500/30 whitespace-nowrap">
                        {entry.source}
                      </Badge>
                    );
                  }

                  return (
                    <tr key={entry.id || idx} className="hover:bg-theme-card-bg/20 transition-colors">
                      <td className="py-2.5 px-3 font-mono font-bold text-cyan-400 whitespace-nowrap">
                        {formatDuration(entry.amount_minutes)}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {badge}
                      </td>
                      <td className="py-2.5 px-3 text-theme-text-muted text-[11px] whitespace-nowrap font-mono">
                        {entry.action_date ? formatDateTime(entry.action_date) : '—'}
                      </td>
                      <td className="py-2.5 px-4 text-theme-text-secondary text-[11px] font-sans break-words whitespace-normal leading-relaxed">
                        {entry.comment || entry.reason || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  // Render multiple records history (from UserStats card)
  const renderAllRecordsHistory = () => {
    // Gather all partial leave records that have any adjustment
    const allAdjustedPartialLeaves = userRecords
      .filter(r => ['Short Leave', 'Early Leave', 'Late Join'].includes(r.leave_type) && (r.adjustment || getRecordAdjustedMinutes(r) > 0))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    if (allAdjustedPartialLeaves.length === 0) {
      return (
        <div className="py-8 text-center text-theme-text-muted text-xs">
          No adjusted Short Leave records found for this employee.
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="overflow-x-auto border border-theme-border-input/80 rounded-xl bg-theme-page-bg/40">
          <table className="w-full text-left text-xs border-collapse table-auto">
            <thead>
              <tr className="border-b border-theme-border-input/80 text-[10px] text-theme-text-muted uppercase font-bold tracking-wider bg-theme-card-container/50">
                <th className="py-2.5 px-3.5 whitespace-nowrap">Leave Date & Type</th>
                <th className="py-2.5 px-3.5 whitespace-nowrap">Duration Status</th>
                <th className="py-2.5 px-3.5 whitespace-nowrap">Adjustment Source(s)</th>
                <th className="py-2.5 px-4 min-w-[200px] w-full">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-theme-border-input/40">
              {allAdjustedPartialLeaves.map(r => {
                const origMins = r.leave_hour ? parseIntervalToMinutes(r.leave_hour) : 0;
                const adjMins = getRecordAdjustedMinutes(r);
                const remMins = getRecordRemainingMinutes(r);
                const entries = getRecordAdjustmentEntries(r);

                return (
                  <tr key={r.id} className="hover:bg-theme-card-bg/20 transition-colors">
                    {/* 1. Date & Type (Stacked) */}
                    <td className="py-2.5 px-3.5 whitespace-nowrap align-top">
                      <div className="font-mono font-bold text-theme-text-primary text-xs">
                        {formatDate(r.date)}
                      </div>
                      <div className="text-[10px] text-theme-text-muted font-medium mt-0.5">
                        {r.leave_type}
                      </div>
                    </td>

                    {/* 2. Original, Adjusted & Remaining (Stacked) */}
                    <td className="py-2.5 px-3.5 whitespace-nowrap font-mono text-[11px] align-top">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] uppercase font-bold text-theme-text-muted/70 w-8">Orig:</span>
                          <span className="text-theme-text-muted font-medium">{formatDuration(origMins)}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] uppercase font-bold text-cyan-400/80 w-8">Adj:</span>
                          <span className="text-cyan-400 font-bold">{formatDuration(adjMins)}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] uppercase font-bold text-theme-text-muted/70 w-8">Rem:</span>
                          <span className={`font-bold ${remMins === 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                            {formatDuration(remMins)}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* 3. Adjustment Source(s) */}
                    <td className="py-2.5 px-3.5 whitespace-nowrap align-top">
                      <div className="flex flex-col gap-1 items-start">
                        {entries.length > 0 ? (
                          entries.map((e, idx) => (
                            <Badge 
                              key={e.id || idx} 
                              variant={e.source === 'Overtime' ? 'warning' : e.source === 'Govt Holiday' ? 'success' : 'default'} 
                              className="text-[9px] px-1.5 py-0.5 font-medium whitespace-nowrap"
                            >
                              {e.source} ({formatDuration(e.amount_minutes)})
                            </Badge>
                          ))
                        ) : (
                          <Badge variant="default" className="text-[9px] px-1.5 py-0.5">
                            {r.reserve_holiday || 'General Adjustment'}
                          </Badge>
                        )}
                      </div>
                    </td>

                    {/* 4. Details (Wide space for full readability) */}
                    <td className="py-2.5 px-4 text-theme-text-secondary text-xs font-sans break-words whitespace-normal leading-relaxed align-top">
                      {r.comment || '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-theme-page-bg/80 backdrop-blur-md p-4">
      <div className="bg-theme-card-bg border border-theme-border-input shadow-2xl rounded-2xl w-full max-w-4xl p-6 relative overflow-hidden font-sans animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[85vh]">
        <div className="absolute top-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-blue-900/10 blur-[80px] pointer-events-none" />

        <div className="flex justify-between items-center border-b border-theme-border-input/80 pb-3 mb-4 shrink-0">
          <h3 className="text-sm font-bold text-theme-text-primary flex items-center gap-2">
            <History className="h-4.5 w-4.5 text-blue-500" />
            Short Leave Adjustment History
          </h3>
          <button
            onClick={onClose}
            className="text-theme-text-muted hover:text-theme-text-primary text-sm cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="overflow-y-auto flex-1 pr-1 space-y-3">
          {record ? renderSingleRecordHistory(record) : renderAllRecordsHistory()}
        </div>

        <div className="mt-5 pt-4 border-t border-theme-border-input/80 flex justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
