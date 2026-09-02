'use client';

import React, { useState } from 'react';
import { Trash2, AlertCircle, RefreshCw } from 'lucide-react';
import { Modal } from '@/components/common/Modal';
import { ChutiRecord } from '@/utils/offlineSync';
import { formatDate, formatTimeToAMPM } from '@/utils/dashboardHelpers';
import { Button } from '@/components/ui/button';

interface RequestRemovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: ChutiRecord | null;
  onSubmit: (record: ChutiRecord, reason: string) => Promise<void>;
  submitting?: boolean;
}

export const RequestRemovalModal: React.FC<RequestRemovalModalProps> = ({
  isOpen,
  onClose,
  record,
  onSubmit,
  submitting = false,
}) => {
  const [reason, setReason] = useState('');

  if (!record) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(record, reason);
    setReason('');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Request Leave Removal"
      icon={<Trash2 className="h-5 w-5 text-rose-500" />}
      glowClass="bg-rose-900/10"
      maxWidthClass="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 font-sans text-xs">
        <div className="p-3 bg-amber-955/20 border border-amber-500/40 rounded-xl flex items-start gap-2.5 text-amber-300">
          <AlertCircle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-amber-200">
              This leave is approved and cannot be deleted directly.
            </p>
            <p className="text-[11px] text-theme-text-muted leading-relaxed">
              Submitting this request will forward a removal approval request to the Admin. Once approved, the record will be removed from your leave balance.
            </p>
          </div>
        </div>

        {/* Leave Record Info */}
        <div className="bg-theme-page-bg/60 border border-theme-border-muted p-3 rounded-xl space-y-2 font-mono text-xs">
          <div className="flex justify-between items-center pb-1.5 border-b border-theme-border-muted">
            <span className="text-theme-text-muted font-sans">Date:</span>
            <span className="font-bold text-theme-text-primary">{formatDate(record.date)}</span>
          </div>
          <div className="flex justify-between items-center pb-1.5 border-b border-theme-border-muted">
            <span className="text-theme-text-muted font-sans">Leave Type:</span>
            <span className="font-bold text-blue-400">{record.leave_type}</span>
          </div>
          {record.leave_hour && record.leave_type !== 'Full Leave' && (
            <div className="flex justify-between items-center pb-1.5 border-b border-theme-border-muted">
              <span className="text-theme-text-muted font-sans">Duration:</span>
              <span className="font-bold text-theme-text-primary">
                {record.leave_hour.toString().split('.')[0].substring(0, 5)} hrs
              </span>
            </div>
          )}
          {record.sign_in_time && record.sign_out_time && record.leave_type !== 'Full Leave' && (
            <div className="flex justify-between items-center pb-1.5 border-b border-theme-border-muted">
              <span className="text-theme-text-muted font-sans">Timing:</span>
              <span className="text-theme-text-secondary text-[11px]">
                {formatTimeToAMPM(record.sign_in_time)} - {formatTimeToAMPM(record.sign_out_time)}
              </span>
            </div>
          )}
          {record.comment && (
            <div className="pt-1">
              <span className="text-theme-text-muted font-sans block text-[10px]">Comment:</span>
              <span className="text-theme-text-secondary text-[11px] font-sans break-words">{record.comment}</span>
            </div>
          )}
        </div>

        {/* Reason field */}
        <div className="space-y-1.5">
          <label className="block text-[11px] font-semibold text-theme-text-muted uppercase tracking-wider">
            Reason for Removal Request
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Please specify why this approved leave should be removed..."
            rows={3}
            className="w-full px-3 py-2 bg-theme-page-bg/80 border border-theme-border-input rounded-xl text-xs text-theme-text-primary focus:outline-none focus:border-rose-500 transition-all resize-none"
          />
        </div>

        <div className="flex gap-3 pt-3 border-t border-theme-border-input/80">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={submitting}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={submitting}
            className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-semibold flex items-center justify-center gap-1.5"
          >
            {submitting && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
            {submitting ? 'Submitting...' : 'Submit Removal Request'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
