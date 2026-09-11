'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Clock } from 'lucide-react';
import { ChutiRecord } from '@/utils/offlineSync';
import { 
  formatDate, 
  formatDateTime, 
  formatDuration, 
  getOvertimeSummary 
} from '@/utils/dashboardHelpers';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface OvertimeHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  userRecords?: ChutiRecord[];
  earnedOvertime?: string;
  usedOvertime?: string;
  remainingOvertime?: string;
}

export function OvertimeHistoryModal({
  isOpen,
  onClose,
  userRecords = [],
  earnedOvertime,
  usedOvertime,
  remainingOvertime,
}: OvertimeHistoryModalProps) {
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

  const summary = useMemo(() => {
    return getOvertimeSummary(userRecords);
  }, [userRecords]);

  if (!isOpen || !isMounted) return null;

  const displayEarned = earnedOvertime ?? summary.earnedFormatted;
  const displayUsed = usedOvertime ?? summary.usedFormatted;
  const displayRemaining = remainingOvertime ?? summary.remainingFormatted;
  const historyItems = summary.history;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-theme-page-bg/80 backdrop-blur-md p-4">
      <div className="bg-theme-card-bg border border-theme-border-input shadow-2xl rounded-2xl w-full max-w-3xl p-6 relative overflow-hidden font-sans animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[85vh]">
        <div className="absolute top-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-emerald-900/10 blur-[80px] pointer-events-none" />

        <div className="flex justify-between items-center border-b border-theme-border-input/80 pb-3 mb-4 shrink-0">
          <h3 className="text-sm font-bold text-theme-text-primary flex items-center gap-2">
            <Clock className="h-4.5 w-4.5 text-emerald-400" />
            Overtime Adjustment History
          </h3>
          <button
            onClick={onClose}
            className="text-theme-text-muted hover:text-theme-text-primary text-sm cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="overflow-y-auto flex-1 pr-1 space-y-4">
          {/* Overtime Balance Summary Cards */}
          <div className="grid grid-cols-3 gap-3 bg-theme-page-bg/50 border border-theme-border-input/80 p-3 rounded-xl text-center">
            <div className="p-2.5 rounded-lg bg-theme-card-bg/60 border border-theme-border-muted">
              <span className="text-theme-text-muted block text-[10px] uppercase font-bold tracking-wider">Earned Overtime</span>
              <span className="font-mono font-bold text-theme-text-primary text-sm mt-0.5 block">{displayEarned}</span>
            </div>
            <div className="p-2.5 rounded-lg bg-theme-card-bg/60 border border-theme-border-muted">
              <span className="text-theme-text-muted block text-[10px] uppercase font-bold tracking-wider">Used Overtime</span>
              <span className="font-mono font-bold text-amber-400 text-sm mt-0.5 block">{displayUsed}</span>
            </div>
            <div className="p-2.5 rounded-lg bg-theme-card-bg/60 border border-theme-border-muted">
              <span className="text-theme-text-muted block text-[10px] uppercase font-bold tracking-wider">Remaining Overtime</span>
              <span className="font-mono font-bold text-emerald-400 text-sm mt-0.5 block">{displayRemaining}</span>
            </div>
          </div>

          {/* History Events Table */}
          {historyItems.length === 0 ? (
            <div className="py-12 text-center text-theme-text-muted text-xs">
              No Overtime adjustments recorded for this employee.
            </div>
          ) : (
            <div className="overflow-x-auto border border-theme-border-input/80 rounded-xl bg-theme-page-bg/40">
              <table className="w-full text-left text-xs border-collapse table-auto">
                <thead>
                  <tr className="border-b border-theme-border-input/80 text-[10px] text-theme-text-muted uppercase font-bold tracking-wider bg-theme-card-container/50">
                    <th className="py-2.5 px-3 whitespace-nowrap">Short Leave Date</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">Leave Type</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">Overtime Used</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">Action Date</th>
                    <th className="py-2.5 px-4 min-w-[200px]">Details / Comment</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-theme-border-input/40">
                  {historyItems.map((item, idx) => (
                    <tr key={item.id || idx} className="hover:bg-theme-card-bg/20 transition-colors">
                      <td className="py-2.5 px-3 font-mono font-bold text-theme-text-primary whitespace-nowrap">
                        {formatDate(item.leaveDate)}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap text-theme-text-secondary text-[11px]">
                        {item.leaveType}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap font-mono font-bold text-amber-400">
                        <Badge variant="warning" className="text-[10px] font-semibold bg-amber-500/10 text-amber-300 border-amber-500/30 whitespace-nowrap">
                          {formatDuration(item.overtimeUsedMinutes)}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 text-theme-text-muted text-[11px] whitespace-nowrap font-mono">
                        {item.actionDate ? formatDateTime(item.actionDate) : '—'}
                      </td>
                      <td className="py-2.5 px-4 text-theme-text-secondary text-[11px] font-sans break-words whitespace-normal leading-relaxed">
                        {item.comment || 'Adjusted with Overtime'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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
