'use client';

import { AlertTriangle, RefreshCw } from 'lucide-react';
import { ChutiRecord } from '@/utils/offlineSync';
import { Profile } from '@/types';

import { Modal } from '@/components/common/Modal';

interface AdminCancelAdjustmentModalProps {
  showCancelAdjustmentModal: boolean;
  setShowCancelAdjustmentModal: (val: boolean) => void;
  cancelAdjustmentRecord: ChutiRecord | null;
  setCancelAdjustmentRecord: (val: ChutiRecord | null) => void;
  handleConfirmCancelAdjustment: () => void;
  profile: Profile | null;
  adminActiveTab: 'user' | 'admin';
  submitting?: boolean;
}

export function AdminCancelAdjustmentModal({
  showCancelAdjustmentModal,
  setShowCancelAdjustmentModal,
  cancelAdjustmentRecord,
  setCancelAdjustmentRecord,
  handleConfirmCancelAdjustment,
  profile,
  adminActiveTab,
  submitting = false,
}: AdminCancelAdjustmentModalProps) {
  const isDirectCancel = profile?.role === 'admin' && adminActiveTab === 'admin';

  return (
    <Modal
      isOpen={showCancelAdjustmentModal && cancelAdjustmentRecord !== null}
      onClose={() => {
        setShowCancelAdjustmentModal(false);
        setCancelAdjustmentRecord(null);
      }}
      title={isDirectCancel ? 'Confirm Adjustment Cancellation' : 'Request Adjustment Cancellation'}
      icon={<AlertTriangle className="h-5 w-5 text-purple-500" />}
      glowClass="bg-purple-900/10"
      maxWidthClass="max-w-md"
    >
      <div className="text-center mb-6">
        <div className="inline-flex p-3 bg-purple-600/10 border border-purple-500/20 text-purple-400 rounded-2xl mb-3">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <p className="text-xs text-theme-text-muted mt-1">
          {isDirectCancel
            ? 'Are you sure you want to cancel the leave adjustment for this record?'
            : 'Are you sure you want to request cancellation of the leave adjustment for this record?'}
        </p>
      </div>
      <div className="flex gap-3">
        <button
          type="button"
          disabled={submitting}
          onClick={() => {
            setShowCancelAdjustmentModal(false);
            setCancelAdjustmentRecord(null);
          }}
          className="flex-1 flex justify-center py-2.5 px-4 border border-theme-border-input rounded-lg text-xs font-semibold text-theme-text-muted hover:text-theme-text-secondary bg-theme-page-bg hover:bg-theme-card-bg hover:scale-[1.01] active:scale-[0.99] cursor-pointer transition-all duration-200 disabled:opacity-50"
        >
          No
        </button>
        <button
          type="button"
          disabled={submitting}
          onClick={handleConfirmCancelAdjustment}
          className="flex-1 flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 hover:scale-[1.01] active:scale-[0.99] cursor-pointer transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-1.5"
        >
          {submitting && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
          {submitting
            ? (isDirectCancel ? 'Cancelling...' : 'Sending Request...')
            : (isDirectCancel ? 'Yes, Cancel' : 'Yes, Send Request')}
        </button>
      </div>
    </Modal>
  );
}
