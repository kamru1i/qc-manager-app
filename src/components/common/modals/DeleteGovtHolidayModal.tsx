'use client';

import React, { useRef, useEffect } from 'react';
import { Trash2, AlertTriangle, RefreshCw } from 'lucide-react';
import { Modal } from '@/components/common/Modal';

interface DeleteGovtHolidayModalProps {
  isOpen: boolean;
  onClose: () => void;
  holidayName: string;
  holidayDate: string;
  onConfirm: () => Promise<void>;
}

export function DeleteGovtHolidayModal({
  isOpen,
  onClose,
  holidayName,
  holidayDate,
  onConfirm,
}: DeleteGovtHolidayModalProps) {
  const [isDeleting, setIsDeleting] = React.useState(false);
  const deleteBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      setIsDeleting(false);
    }
  }, [isOpen]);

  const handleDelete = async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      await onConfirm();
    } catch {
      setIsDeleting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (!isDeleting) onClose();
      }}
      title="Delete Government Holiday"
      icon={<AlertTriangle className="h-5 w-5 text-red-500" />}
      glowClass="bg-red-900/10"
      maxWidthClass="max-w-md"
    >
      <div className="text-center mb-6">
        <div className="inline-flex p-3 bg-red-650/10 border border-red-500/20 text-red-400 rounded-2xl mb-4 animate-pulse">
          <Trash2 className="h-6 w-6" />
        </div>

        <h4 className="text-xs font-bold text-theme-text-primary mb-3">
          Delete "{holidayName}" ({holidayDate})?
        </h4>

        <p className="text-xs text-theme-text-muted leading-relaxed text-left bg-theme-page-bg/40 border border-theme-border-input/50 rounded-xl p-3.5 mb-4">
          You are about to permanently delete this Government Holiday.
          <br /><br />
          This action will also permanently remove:
          <span className="block mt-1 font-semibold text-red-400/90">
            • All employee responses (Reserve / Get Paid)<br />
            • Pending decisions<br />
            • Related Government Holiday records
          </span>
          <br />
          This action cannot be undone.
        </p>

        <p className="text-xs text-theme-text-muted font-semibold">
          Are you sure you want to continue?
        </p>
      </div>

      <div className="flex gap-3 relative z-10">
        <button
          type="button"
          disabled={isDeleting}
          onClick={onClose}
          className="flex-1 flex justify-center py-2.5 px-4 border border-theme-border-input rounded-lg text-xs font-bold text-theme-text-muted hover:text-theme-text-secondary bg-theme-page-bg hover:bg-theme-card-bg hover:scale-[1.01] active:scale-[0.99] cursor-pointer transition-all duration-200 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          ref={deleteBtnRef}
          type="button"
          disabled={isDeleting}
          onClick={handleDelete}
          className="flex-1 flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-md text-xs font-bold text-white bg-red-600 hover:bg-red-700 hover:scale-[1.01] active:scale-[0.99] cursor-pointer transition-all duration-200  items-center gap-1.5 disabled:opacity-50"
        >
          {isDeleting && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
          {isDeleting ? 'Deleting...' : 'Delete Holiday'}
        </button>
      </div>
    </Modal>
  );
}
