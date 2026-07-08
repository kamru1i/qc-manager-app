'use client';

import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Profile, BulkRepresentative } from '@/types';
import { Modal } from '../Modal';
import { LeaveApprovalPanel } from '../LeaveApprovalPanel';

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

  // Custom Revision Prompt Modal
  showRevisionPromptModal: boolean;
  setShowRevisionPromptModal: (val: boolean) => void;
  submittingRevision: boolean;
  setRevisionPromptChutiId: (val: string | null) => void;
  setRevisionPromptText: (val: string) => void;
  revisionPromptText: string;
  submitRevisionWithReason: () => void;
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

  showRevisionPromptModal,
  setShowRevisionPromptModal,
  submittingRevision,
  setRevisionPromptChutiId,
  setRevisionPromptText,
  revisionPromptText,
  submitRevisionWithReason,
}) => {
  if (profile?.role !== 'supervisor') return null;

  const handleCloseMain = () => setShowSupervisorApprovalModal(false);
  const handleCloseRevision = () => {
    if (submittingRevision) return;
    setShowRevisionPromptModal(false);
    setRevisionPromptChutiId(null);
    setRevisionPromptText('');
  };

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
          role="supervisor"
          profilesList={profilesList}
          reviewingIds={reviewingIds}
          approvedIds={approvedIds}
          approvingIds={approvingIds}
          groupedChutiRequests={groupedSupervisorRequests}
          handleApproveChutiRequest={handleSupervisorApproveChuti}
        />
      </Modal>

      {/* Custom Revision Prompt Modal */}
      <Modal
        isOpen={showRevisionPromptModal}
        onClose={handleCloseRevision}
        title="Reason for Revision"
        icon={<AlertTriangle className="h-5 w-5 text-purple-500" />}
        maxWidthClass="max-w-md"
        glowClass="bg-purple-900/10"
      >
        <div className="space-y-4 font-sans">
          <p className="text-xs text-slate-400 leading-relaxed font-medium font-sans">
            Please enter the reason or comment for returning this leave request for revision. It will be displayed on the user's revision dashboard:
          </p>
          
          <div>
            <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5 font-semibold">Revision Comment/Reason (Required)</label>
            <textarea
              required
              disabled={submittingRevision}
              placeholder="e.g. Please change the date or select the correct leave type..."
              value={revisionPromptText}
              onChange={(e) => setRevisionPromptText(e.target.value)}
              className="w-full px-3 py-2 bg-slate-955 border border-slate-800 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 h-24 resize-none font-sans disabled:opacity-50"
            />
          </div>

          <div className="flex gap-3 pt-4 border-t border-slate-800/80 font-sans">
            <button
              type="button"
              disabled={submittingRevision}
              onClick={handleCloseRevision}
              className="flex-1 flex justify-center py-2 px-4 border border-slate-800 rounded-lg text-xs font-semibold text-slate-400 hover:text-slate-355 bg-slate-955 hover:bg-slate-900 cursor-pointer transition-all disabled:opacity-50 font-sans"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={submittingRevision || !revisionPromptText.trim()}
              onClick={submitRevisionWithReason}
              className="flex-1 flex justify-center py-2 px-4 border border-transparent rounded-lg shadow-sm text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 cursor-pointer transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed font-sans"
            >
              {submittingRevision && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
              {submittingRevision ? 'Submitting...' : 'Submit'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
};
