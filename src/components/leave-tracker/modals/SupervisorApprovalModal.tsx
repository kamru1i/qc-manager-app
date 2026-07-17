'use client';

import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Profile, BulkRepresentative } from '@/types';
import { Modal } from '@/components/common/Modal';
import { LeaveApprovalPanel } from '@/components/leave-tracker/LeaveApprovalPanel';

interface SupervisorApprovalModalProps {
  // Supervisor Approvals panel
  showSupervisorApprovalModal: boolean;
  setShowSupervisorApprovalModal: (val: boolean) => void;
  groupedSupervisorRequests: BulkRepresentative[];
  profilesList: Profile[];
  reviewingIds: Set<string>;
  approvedIds: Set<string>;
  approvingIds: Set<string>;
  handleSupervisorApproveChuti: (id: string, approve: boolean) => void;
  profile: Profile | null;
  onSwitchToUserPanel?: () => void;
  userNotificationsCount?: number;
}

export const SupervisorApprovalModal: React.FC<SupervisorApprovalModalProps> = ({
  showSupervisorApprovalModal,
  setShowSupervisorApprovalModal,
  groupedSupervisorRequests,
  profilesList,
  reviewingIds,
  approvedIds,
  approvingIds,
  handleSupervisorApproveChuti,
  profile,
  onSwitchToUserPanel,
  userNotificationsCount = 0,
}) => {
  if (profile?.role !== 'supervisor') return null;

  const handleCloseMain = () => setShowSupervisorApprovalModal(false);

  return (
    <>
      {/* Supervisor Leave Approvals Modal using reusable LeaveApprovalPanel */}
      <Modal
        isOpen={showSupervisorApprovalModal}
        onClose={handleCloseMain}
        title="Pending Verification Panel (Supervisor)"
        icon={<AlertTriangle className="h-5 w-5 text-blue-400 animate-pulse" />}
        maxWidthClass="max-w-3xl"
        glowClass="bg-blue-900/10"
        headerExtra={
          onSwitchToUserPanel ? (
            <button
              onClick={onSwitchToUserPanel}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-theme-card-bg border border-theme-border-input hover:bg-theme-border-input text-theme-text-secondary hover:text-theme-text-primary rounded-lg text-xs font-semibold cursor-pointer transition-all font-sans"
            >
              <span>User Panel</span>
              {userNotificationsCount > 0 && (
                <span className="flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-red-500 animate-pulse">
                  <span className="text-[9px] font-sans font-bold text-white leading-none">
                    {userNotificationsCount}
                  </span>
                </span>
              )}
            </button>
          ) : undefined
        }
      >
        <LeaveApprovalPanel
          role="supervisor"
          profilesList={profilesList}
          reviewingIds={reviewingIds}
          approvedIds={approvedIds}
          approvingIds={approvingIds}
          groupedChutiRequests={groupedSupervisorRequests}
          handleApproveChutiRequest={handleSupervisorApproveChuti}
        />
      </Modal>
    </>
  );
};
