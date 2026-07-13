'use client';

import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Profile } from '@/types';
import { Modal } from '@/components/common/Modal';

interface AdminDeleteUserModalProps {
  showDeleteUserModal: boolean;
  setShowDeleteUserModal: (val: boolean) => void;
  deleteTargetUser: Profile | null;
  setDeleteTargetUser: (val: Profile | null) => void;
  deletingUser: boolean;
  handleDeleteUser: () => void;
  profile: Profile | null;
}

export function AdminDeleteUserModal({
  showDeleteUserModal,
  setShowDeleteUserModal,
  deleteTargetUser,
  setDeleteTargetUser,
  deletingUser,
  handleDeleteUser,
  profile,
}: AdminDeleteUserModalProps) {
  if (profile?.role !== 'admin' || !deleteTargetUser) return null;

  const handleClose = () => {
    setShowDeleteUserModal(false);
    setDeleteTargetUser(null);
  };

  return (
    <Modal
      isOpen={showDeleteUserModal}
      onClose={handleClose}
      title="Confirm Delete Staff Account"
      icon={<AlertTriangle className="h-5 w-5 text-red-500" />}
      maxWidthClass="max-w-md"
      glowClass="bg-red-900/10"
    >
      <div className="font-sans">
        <div className="text-center mb-6">
          <div className="inline-flex p-3 bg-red-600/10 border border-red-500/20 text-red-400 rounded-2xl mb-3">
            <AlertTriangle className="h-6 w-6 animate-pulse" />
          </div>
          <p className="text-xs text-theme-text-secondary">
            Are you sure you want to delete staff account <strong className="text-theme-text-primary">"{deleteTargetUser.full_name || deleteTargetUser.username}"</strong>?
          </p>
          <p className="text-xs text-red-400 mt-2 font-semibold">
            ⚠️ Warning: Deleting the account will permanently delete all of their leave records, and this action cannot be undone.
          </p>
        </div>
        
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 flex justify-center py-2 px-4 border border-theme-border-input rounded-lg text-xs font-semibold text-theme-text-muted hover:text-theme-text-secondary bg-theme-page-bg hover:bg-theme-card-bg cursor-pointer transition-all"
          >
            No, Cancel
          </button>
          <button
            type="button"
            onClick={handleDeleteUser}
            disabled={deletingUser}
            className="flex-1 flex justify-center py-2 px-4 border border-transparent rounded-lg shadow-sm text-xs font-semibold text-white bg-red-600 hover:bg-red-700 cursor-pointer transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {deletingUser && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
            {deletingUser ? 'Deleting...' : 'Yes, Delete Staff'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
