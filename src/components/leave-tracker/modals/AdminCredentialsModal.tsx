'use client';

import React from 'react';
import { Edit, RefreshCw } from 'lucide-react';
import { PasswordMatchIndicator } from '@/components/common/PasswordMatchIndicator';
import { Profile } from '@/types';
import { Modal } from '@/components/common/Modal';

interface AdminCredentialsModalProps {
  showCredentialsModal: boolean;
  setShowCredentialsModal: (val: boolean) => void;
  profile: Profile | null;
  credTargetUserId: string | null;
  setCredTargetUserId: (val: string | null) => void;
  credNewUsername: string;
  setCredNewUsername: (val: string) => void;
  credNewPassword: string;
  setCredNewPassword: (val: string) => void;
  credConfirmPassword: string;
  setCredConfirmPassword: (val: string) => void;
  updatingCredentials: boolean;
  handleUpdateCredentials: () => void;
}

export function AdminCredentialsModal({
  showCredentialsModal,
  setShowCredentialsModal,
  profile,
  credTargetUserId,
  setCredTargetUserId,
  credNewUsername,
  setCredNewUsername,
  credNewPassword,
  setCredNewPassword,
  credConfirmPassword,
  setCredConfirmPassword,
  updatingCredentials,
  handleUpdateCredentials,
}: AdminCredentialsModalProps) {
  if (profile?.role !== 'admin' || !credTargetUserId) return null;

  const handleClose = () => {
    setShowCredentialsModal(false);
    setCredTargetUserId(null);
    setCredNewUsername('');
    setCredNewPassword('');
    setCredConfirmPassword('');
  };

  return (
    <Modal
      isOpen={showCredentialsModal}
      onClose={handleClose}
      title="Change Password Panel"
      icon={<Edit className="h-5 w-5 text-blue-500" />}
      maxWidthClass="max-w-md"
      glowClass="bg-blue-900/10"
    >
      <div className="space-y-4 font-sans">
        <div className="p-3 bg-blue-955/20 border border-blue-900/30 rounded-xl text-xs text-blue-300">
          <p>💡 Here you can set a new <strong>codename (Username)</strong> or a new <strong>password</strong> for this staff. If the password is changed, the staff must log in with the new password next time.</p>
        </div>

        <div>
          <label className="block text-xs font-medium text-theme-text-muted uppercase tracking-wider mb-1">New Codename (Username)</label>
          <input
            type="text"
            placeholder="e.g., KMH"
            value={credNewUsername}
            onChange={(e) => setCredNewUsername(e.target.value)}
            className="mt-1 block w-full px-3 py-2 bg-theme-page-bg border border-theme-border-input rounded-lg text-theme-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase font-mono"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-theme-text-muted uppercase tracking-wider mb-1">New Password</label>
          <input
            type="password"
            placeholder="Leave blank to keep current password"
            value={credNewPassword}
            onChange={(e) => setCredNewPassword(e.target.value)}
            className="mt-1 block w-full px-3 py-2 bg-theme-page-bg border border-theme-border-input rounded-lg text-theme-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-theme-text-muted uppercase tracking-wider mb-1">Confirm New Password</label>
          <input
            type="password"
            placeholder="Enter the new password again"
            value={credConfirmPassword}
            onChange={(e) => setCredConfirmPassword(e.target.value)}
            className="mt-1 block w-full px-3 py-2 bg-theme-page-bg border border-theme-border-input rounded-lg text-theme-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <PasswordMatchIndicator password={credNewPassword} confirmPassword={credConfirmPassword} />
        </div>

        <div className="flex gap-3 pt-4 border-t border-theme-border-input/80 font-sans">
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 flex justify-center py-2 px-4 border border-theme-border-input rounded-lg text-xs font-semibold text-theme-text-muted hover:text-theme-text-secondary bg-theme-page-bg hover:bg-theme-card-bg cursor-pointer transition-all"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleUpdateCredentials}
            disabled={updatingCredentials || (credNewPassword ? (credNewPassword !== credConfirmPassword || credNewPassword.length < 4) : false)}
            className="flex-1 flex justify-center py-2 px-4 border border-transparent rounded-lg shadow-sm text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 cursor-pointer transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {updatingCredentials && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
            {updatingCredentials ? 'Saving...' : 'Update Credentials'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
