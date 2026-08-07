'use client';

import { Trash2, RefreshCw } from 'lucide-react';
import { ChutiRecord } from '@/utils/offlineSync';

import { Modal } from '@/components/common/Modal';

interface DeleteConfirmModalProps {
  showDeleteModal: boolean;
  setShowDeleteModal: (val: boolean) => void;
  recordToDelete?: any | null;
  setRecordToDelete?: (val: any | null) => void;
  deletingRecord: boolean;
  handleConfirmDelete: () => void;
  bulkCount?: number;
  customMessage?: string;
}

export function DeleteConfirmModal({
  showDeleteModal,
  setShowDeleteModal,
  recordToDelete,
  setRecordToDelete,
  deletingRecord,
  handleConfirmDelete,
  bulkCount,
  customMessage
}: DeleteConfirmModalProps) {
  // If bulkCount is provided, it's a bulk operation
  const isBulk = bulkCount !== undefined && bulkCount > 1;
  const message = customMessage || (isBulk 
    ? `Are you sure you want to delete ${bulkCount} selected records? This action cannot be undone.`
    : `Are you sure you want to delete this record? This action cannot be undone.`);

  return (
    <Modal
      isOpen={showDeleteModal}
      onClose={() => {
        setShowDeleteModal(false);
        if (setRecordToDelete) setRecordToDelete(null);
      }}
      title="Confirm Delete"
      icon={<Trash2 className="h-5 w-5 text-red-500" />}
      glowClass="bg-red-900/10"
      maxWidthClass="max-w-md"
    >
      <div className="text-center mb-6">
        <div className="inline-flex p-3 bg-red-600/10 border border-red-500/20 text-red-400 rounded-2xl mb-3">
          <Trash2 className="h-6 w-6" />
        </div>
        <p className="text-xs text-theme-text-muted">{message}</p>
      </div>
      <div className="flex gap-3">
        <button
          type="button"
          disabled={deletingRecord}
          onClick={() => {
            setShowDeleteModal(false);
            if (setRecordToDelete) setRecordToDelete(null);
          }}
          className="flex-1 flex justify-center py-2.5 px-4 border border-theme-border-input rounded-lg text-xs font-semibold text-theme-text-muted hover:text-theme-text-secondary bg-theme-page-bg hover:bg-theme-card-bg hover:scale-[1.01] active:scale-[0.99] cursor-pointer transition-all duration-200 disabled:opacity-50"
        >
          No, cancel
        </button>
        <button
          type="button"
          disabled={deletingRecord}
          onClick={handleConfirmDelete}
          className="flex-1 flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-xs font-semibold text-white bg-red-600 hover:bg-red-700 hover:scale-[1.01] active:scale-[0.99] cursor-pointer transition-all duration-200 flex items-center justify-center gap-1.5 disabled:opacity-50"
        >
          {deletingRecord && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
          {deletingRecord ? 'Deleting...' : 'Yes, delete'}
        </button>
      </div>
    </Modal>
  );
}
