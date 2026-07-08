'use client';

import React from 'react';
import { Bell } from 'lucide-react';
import { Profile, ChutiRecordWithProfile, BulkRepresentative } from '@/types';
import { Modal } from '../Modal';
import { LeaveApprovalPanel } from '../LeaveApprovalPanel';

interface AdminLeaveApprovalModalProps {
  showLeaveApprovalModal: boolean;
  setShowLeaveApprovalModal: (val: boolean) => void;
  profile: Profile | null;
  groupedChutiRequests: BulkRepresentative[];
  profilesList: Profile[];
  reviewingIds: Set<string>;
  approvedIds: Set<string>;
  approvingIds: Set<string>;
  handleApproveChutiRequest: (id: string, approve: boolean) => void;
  pendingReserveRequests: ChutiRecordWithProfile[];
  handleApproveReserveAdjustment: (record: ChutiRecordWithProfile, approve: boolean) => void;
  pendingProfileRequests: Profile[];
  handleApproveProfileChangeRequest: (id: string, approve: boolean) => void;
  adminHolidayNotifications?: any[];
  pendingPasswordResetRequests?: Profile[];
  handleApprovePasswordResetRequest?: (id: string, approve: boolean) => void;
  onSwitchToUserPanel?: () => void;
  userNotificationsCount?: number;
}

export function AdminLeaveApprovalModal({
  showLeaveApprovalModal,
  setShowLeaveApprovalModal,
  profile,
  groupedChutiRequests,
  profilesList,
  reviewingIds,
  approvedIds,
  approvingIds,
  handleApproveChutiRequest,
  pendingReserveRequests,
  handleApproveReserveAdjustment,
  pendingProfileRequests,
  handleApproveProfileChangeRequest,
  pendingPasswordResetRequests = [],
  handleApprovePasswordResetRequest = () => {},
  adminHolidayNotifications = [],
  onSwitchToUserPanel,
  userNotificationsCount = 0,
}: AdminLeaveApprovalModalProps) {
  if (profile?.role !== 'admin') return null;

  const handleClose = () => setShowLeaveApprovalModal(false);

  return (
    <Modal
      isOpen={showLeaveApprovalModal}
      onClose={handleClose}
      title="Notification Panel (Admin)"
      icon={<Bell className="h-5 w-5 text-purple-400 font-semibold" />}
      maxWidthClass="max-w-3xl"
      glowClass="bg-purple-900/10"
      headerExtra={
        onSwitchToUserPanel ? (
          <button
            onClick={onSwitchToUserPanel}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg text-xs font-semibold cursor-pointer transition-all font-sans"
          >
            <span>Go to User Panel</span>
            {userNotificationsCount > 0 && (
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white animate-pulse">
                {userNotificationsCount}
              </span>
            )}
          </button>
        ) : undefined
      }
    >
      <LeaveApprovalPanel
        role="admin"
        profilesList={profilesList}
        reviewingIds={reviewingIds}
        approvedIds={approvedIds}
        approvingIds={approvingIds}
        groupedChutiRequests={groupedChutiRequests}
        handleApproveChutiRequest={handleApproveChutiRequest}
        pendingReserveRequests={pendingReserveRequests}
        handleApproveReserveAdjustment={handleApproveReserveAdjustment}
        pendingProfileRequests={pendingProfileRequests}
        handleApproveProfileChangeRequest={handleApproveProfileChangeRequest}
        pendingPasswordResetRequests={pendingPasswordResetRequests}
        handleApprovePasswordResetRequest={handleApprovePasswordResetRequest}
        adminHolidayNotifications={adminHolidayNotifications}
      />
    </Modal>
  );
}
