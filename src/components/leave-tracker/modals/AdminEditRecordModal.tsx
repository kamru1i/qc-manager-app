"use client";

import React from "react";
import { Edit, RefreshCw } from "lucide-react";
import { Profile } from "@/types";
import { ChutiRecord } from "@/utils/offlineSync";
import { ChutiFormFields } from "@/components/leave-tracker/ChutiFormFields";
import { Modal } from "@/components/common/Modal";

interface AdminEditRecordModalProps {
  showAdminEditModal: boolean;
  setShowAdminEditModal: (val: boolean) => void;
  profile: Profile | null;
  profilesList: Profile[];
  adminEditRecord: ChutiRecord | null;
  adminEditDate: string;
  setAdminEditDate: (val: string) => void;
  adminEditLeaveType: string;
  setAdminEditLeaveType: (val: string) => void;
  adminEditSignInTime: string;
  setAdminEditSignInTime: (val: string) => void;
  adminEditSignOutTime: string;
  setAdminEditSignOutTime: (val: string) => void;
  adminEditLeaveHour: string;
  setAdminEditLeaveHour: (val: string) => void;
  adminEditAdjustment: boolean;
  setAdminEditAdjustment: (val: boolean) => void;
  adminEditAdjustShortLeave: boolean;
  setAdminEditAdjustShortLeave: (val: boolean) => void;
  adminEditComment: string;
  setAdminEditComment: (val: string) => void;
  handleAdminSaveEdit: (e: React.FormEvent) => void;
  submitting?: boolean;
}

export function AdminEditRecordModal({
  showAdminEditModal,
  setShowAdminEditModal,
  profile,
  profilesList,
  adminEditRecord,
  adminEditDate,
  setAdminEditDate,
  adminEditLeaveType,
  setAdminEditLeaveType,
  adminEditSignInTime,
  setAdminEditSignInTime,
  adminEditSignOutTime,
  setAdminEditSignOutTime,
  adminEditLeaveHour,
  setAdminEditLeaveHour,
  adminEditAdjustment,
  setAdminEditAdjustment,
  adminEditAdjustShortLeave,
  setAdminEditAdjustShortLeave,
  adminEditComment,
  setAdminEditComment,
  handleAdminSaveEdit,
  submitting = false,
}: AdminEditRecordModalProps) {
  const [hasDateError, setHasDateError] = React.useState(false);

  if (profile?.role !== "admin" || !adminEditRecord) return null;

  const targetUserProfile = profilesList.find(
    (p) => p.id === adminEditRecord.user_id,
  );

  const handleClose = () => setShowAdminEditModal(false);

  return (
    <Modal
      isOpen={showAdminEditModal}
      onClose={handleClose}
      title="Edit Leave Entry (Admin Edit)"
      icon={<Edit className="h-5 w-5 text-blue-500" />}
      maxWidthClass="max-w-md"
      glowClass="bg-blue-900/10"
    >
      <form onSubmit={handleAdminSaveEdit} className="space-y-4 font-sans">
        <ChutiFormFields
          date={adminEditDate}
          setDate={setAdminEditDate}
          leaveType={adminEditLeaveType}
          setLeaveType={setAdminEditLeaveType}
          signInTime={adminEditSignInTime}
          setSignInTime={setAdminEditSignInTime}
          signOutTime={adminEditSignOutTime}
          setSignOutTime={setAdminEditSignOutTime}
          leaveHour={adminEditLeaveHour}
          setLeaveHour={setAdminEditLeaveHour}
          adjustment={adminEditAdjustment}
          setAdjustment={setAdminEditAdjustment}
          adjustShortLeave={adminEditAdjustShortLeave}
          setAdjustShortLeave={setAdminEditAdjustShortLeave}
          comment={adminEditComment}
          setComment={setAdminEditComment}
          allowOvertime={
            targetUserProfile?.allow_overtime ||
            adminEditLeaveType === "Overtime"
          }
          onDateErrorChange={setHasDateError}
        />

        <div className="flex gap-3 pt-4 border-t border-theme-border-input/80">
          <button
            type="button"
            onClick={handleClose}
            disabled={submitting}
            className="flex-1 flex justify-center py-2 px-4 border border-theme-border-input rounded-lg text-xs font-semibold text-theme-text-muted hover:text-theme-text-secondary bg-theme-page-bg hover:bg-theme-card-bg cursor-pointer disabled:opacity-50 transition-all"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || hasDateError}
            className="flex-1 flex justify-center py-2.5 px-4 border border-transparent rounded-xl shadow-md text-xs font-semibold text-white bg-linear-to-r from-blue-600 to-purple-500 hover:from-blue-500 hover:to-purple-400 hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-theme-card-container cursor-pointer disabled:opacity-50 transition-all flex items-center justify-center gap-1.5"
          >
            {submitting && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
            {submitting ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
