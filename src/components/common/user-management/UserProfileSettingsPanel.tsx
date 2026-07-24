"use client";

import React from "react";
import { Profile } from "@/types";
import { StaffSettingsForm } from "@/components/leave-tracker/StaffSettingsForm";
import { useProfiles } from "@/contexts/ProfilesContext";
import {
  RefreshCw,
  KeyRound,
  Trash2,
  Check,
  Loader2,
  AlertTriangle,
} from "lucide-react";

interface UserProfileSettingsPanelProps {
  isAdmin: boolean;
  currentUser?: Profile | null;
  submitting: boolean;
  profiles: Profile[];
  viewingStaff: Profile;
  editUserCodename: string;
  setEditUserCodename: (val: string) => void;
  editUserFullName: string;
  setEditUserFullName: (val: string) => void;
  editUserRole: "admin" | "supervisor" | "user" | "superadmin";
  setEditUserRole: (val: "admin" | "supervisor" | "user" | "superadmin") => void;
  editHasChutiAccess: boolean;
  setEditHasChutiAccess: (val: boolean) => void;
  editNeedsApproval: boolean;
  setEditNeedsApproval: (val: boolean) => void;
  editSupervisorIds: string[];
  setEditSupervisorIds: (val: string[]) => void;
  editEligibleOfficeLeave: boolean;
  setEditEligibleOfficeLeave: (val: boolean) => void;
  editEligibleGovtHoliday: boolean;
  setEditEligibleGovtHoliday: (val: boolean) => void;
  editAllowOvertime: boolean;
  setEditAllowOvertime: (val: boolean) => void;
  editAllowReserve: boolean;
  setEditAllowReserve: (val: boolean) => void;
  editHasQuotesAccess: boolean;
  setEditHasQuotesAccess: (val: boolean) => void;
  editUserAllowedTypes: string[];
  setEditUserAllowedTypes: (val: string[]) => void;
  editUserCanManageRules: boolean;
  setEditUserCanManageRules: (val: boolean) => void;
  onResetPasswordClick: () => void;
  onChangePasswordClick: () => void;
  onDeleteAccountClick: () => void;
  onSaveProfileClick: () => void;
  isSupervisor?: boolean;

  editUserJobRole: string;
  setEditUserJobRole: (val: string) => void;
  editUserWorkingHours: string;
  setEditUserWorkingHours: (val: string) => void;
  editUserBreakTime: string;
  setEditUserBreakTime: (val: string) => void;
  editUserSignInTime: string;
  setEditUserSignInTime: (val: string) => void;
  editUserSignOutTime: string;
  setEditUserSignOutTime: (val: string) => void;
  editUserKpiSkills: string[];
  setEditUserKpiSkills: (val: string[]) => void;
  editUserKpiDeptIndicators: string[];
  setEditUserKpiDeptIndicators: (val: string[]) => void;
  editUserKpiOtherDeptIndicators: string[];
  setEditUserKpiOtherDeptIndicators: (val: string[]) => void;
  editUserPerformsDataEntry: boolean;
  setEditUserPerformsDataEntry: (val: boolean) => void;
  editUserDepartment: string;
  setEditUserDepartment: (val: string) => void;
  editUserPerformsOtherDeptTasks?: boolean;
  setEditUserPerformsOtherDeptTasks?: (val: boolean) => void;
  editUserOtherDepartment?: string;
  setEditUserOtherDepartment?: (val: string) => void;
  onViewKpiReport?: (periodKey: string) => void;
  editDelegatedLeaveSupervisorId: string | null;
  setEditDelegatedLeaveSupervisorId: (val: string | null) => void;
  editDelegatedKpiSupervisorId: string | null;
  setEditDelegatedKpiSupervisorId: (val: string | null) => void;
  editUserFeatureFlags?: Record<string, boolean>;
  setEditUserFeatureFlags?: (val: Record<string, boolean>) => void;
}

export const UserProfileSettingsPanel: React.FC<
  UserProfileSettingsPanelProps
> = ({
  isAdmin,
  currentUser,
  submitting,
  profiles,
  viewingStaff,
  editUserCodename,
  setEditUserCodename,
  editUserFullName,
  setEditUserFullName,
  editUserRole,
  setEditUserRole,
  editHasChutiAccess,
  setEditHasChutiAccess,
  editNeedsApproval,
  setEditNeedsApproval,
  editSupervisorIds,
  setEditSupervisorIds,
  editEligibleOfficeLeave,
  setEditEligibleOfficeLeave,
  editEligibleGovtHoliday,
  setEditEligibleGovtHoliday,
  editAllowOvertime,
  setEditAllowOvertime,
  editAllowReserve,
  setEditAllowReserve,
  editHasQuotesAccess,
  setEditHasQuotesAccess,
  editUserAllowedTypes,
  setEditUserAllowedTypes,
  editUserCanManageRules,
  setEditUserCanManageRules,
  onResetPasswordClick,
  onChangePasswordClick,
  onDeleteAccountClick,
  onSaveProfileClick,
  editUserJobRole,
  setEditUserJobRole,
  editUserWorkingHours,
  setEditUserWorkingHours,
  editUserBreakTime,
  setEditUserBreakTime,
  editUserSignInTime,
  setEditUserSignInTime,
  editUserSignOutTime,
  setEditUserSignOutTime,
  editUserKpiSkills,
  setEditUserKpiSkills,
  editUserKpiDeptIndicators,
  setEditUserKpiDeptIndicators,
  editUserKpiOtherDeptIndicators,
  setEditUserKpiOtherDeptIndicators,
  editUserPerformsDataEntry,
  setEditUserPerformsDataEntry,
  editUserDepartment,
  setEditUserDepartment,
  editUserPerformsOtherDeptTasks,
  setEditUserPerformsOtherDeptTasks,
  editUserOtherDepartment,
  setEditUserOtherDepartment,
  onViewKpiReport,
  editDelegatedLeaveSupervisorId,
  setEditDelegatedLeaveSupervisorId,
  editDelegatedKpiSupervisorId,
  setEditDelegatedKpiSupervisorId,
  editUserFeatureFlags,
  setEditUserFeatureFlags,
}) => {
  const { profilesList } = useProfiles();
  const superadminProfile = React.useMemo(() => profilesList.find((p) => p.role === "superadmin"), [profilesList]);
  const effectiveAdminDelegatedFlags = React.useMemo(() => {
    const saFlags = superadminProfile?.global_settings?.admin_delegated_flags;
    const userFlags = currentUser?.global_settings?.admin_delegated_flags;
    return { ...(userFlags || {}), ...(saFlags || {}) };
  }, [superadminProfile, currentUser]);

  const isSupervisor = currentUser?.role === "supervisor";
  const isTargetAdmin = viewingStaff.role === "admin" || viewingStaff.role === "superadmin";
  const showSupervisorWarning = isSupervisor && isTargetAdmin;

  return (
    <div className="space-y-6">
      {showSupervisorWarning && (
        <div className="bg-amber-955/20 border border-amber-900/40 p-4 rounded-xl text-xs text-amber-300 font-semibold flex items-center gap-2 font-sans">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
          Supervisors cannot modify Admin profiles. All settings are read-only.
        </div>
      )}

      <StaffSettingsForm
        isNewUser={false}
        currentUser={currentUser}
        codename={editUserCodename}
        setCodename={setEditUserCodename}
        fullName={editUserFullName}
        setFullName={setEditUserFullName}
        role={editUserRole}
        setRole={setEditUserRole}
        hasChutiAccess={editHasChutiAccess}
        setHasChutiAccess={setEditHasChutiAccess}
        needsApproval={editNeedsApproval}
        setNeedsApproval={setEditNeedsApproval}
        supervisors={profiles.filter((p) => p.role === "supervisor")}
        supervisorIds={editSupervisorIds}
        setSupervisorIds={setEditSupervisorIds}
        eligibleOfficeLeave={editEligibleOfficeLeave}
        setEligibleOfficeLeave={setEditEligibleOfficeLeave}
        eligibleGovtHoliday={editEligibleGovtHoliday}
        setEligibleGovtHoliday={setEditEligibleGovtHoliday}
        allowOvertime={editAllowOvertime}
        setAllowOvertime={setEditAllowOvertime}
        allowReserve={editAllowReserve}
        setAllowReserve={setEditAllowReserve}
        hasQuotesAccess={editHasQuotesAccess}
        setHasQuotesAccess={setEditHasQuotesAccess}
        allowedTypes={editUserAllowedTypes}
        setAllowedTypes={setEditUserAllowedTypes}
        canManageRules={editUserCanManageRules}
        setCanManageRules={setEditUserCanManageRules}
        isAdmin={isAdmin}
        isSupervisor={isSupervisor && !isTargetAdmin}
        jobRole={editUserJobRole}
        setJobRole={setEditUserJobRole}
        workingHours={editUserWorkingHours}
        setWorkingHours={setEditUserWorkingHours}
        breakTime={editUserBreakTime}
        setBreakTime={setEditUserBreakTime}
        signInTime={editUserSignInTime}
        setSignInTime={setEditUserSignInTime}
        signOutTime={editUserSignOutTime}
        setSignOutTime={setEditUserSignOutTime}
        kpiSkills={editUserKpiSkills}
        setKpiSkills={setEditUserKpiSkills}
        kpiDeptIndicators={editUserKpiDeptIndicators}
        setKpiDeptIndicators={setEditUserKpiDeptIndicators}
        kpiOtherDeptIndicators={editUserKpiOtherDeptIndicators}
        setKpiOtherDeptIndicators={setEditUserKpiOtherDeptIndicators}
        performsDataEntry={editUserPerformsDataEntry}
        setPerformsDataEntry={setEditUserPerformsDataEntry}
        department={editUserDepartment}
        setDepartment={setEditUserDepartment}
        performsOtherDeptTasks={editUserPerformsOtherDeptTasks}
        setPerformsOtherDeptTasks={setEditUserPerformsOtherDeptTasks}
        otherDepartment={editUserOtherDepartment}
        setOtherDepartment={setEditUserOtherDepartment}
        viewingStaff={viewingStaff}
        onViewKpiReport={onViewKpiReport}
        delegatedLeaveSupervisorId={editDelegatedLeaveSupervisorId}
        setDelegatedLeaveSupervisorId={setEditDelegatedLeaveSupervisorId}
        delegatedKpiSupervisorId={editDelegatedKpiSupervisorId}
        setDelegatedKpiSupervisorId={setEditDelegatedKpiSupervisorId}
        userFeatureFlags={editUserFeatureFlags}
        setUserFeatureFlags={setEditUserFeatureFlags}
        adminDelegatedFlags={effectiveAdminDelegatedFlags}
      />

      <div className="bg-theme-card-bg/20 border border-theme-border-muted/60 p-5 rounded-2xl flex flex-wrap justify-between items-center gap-4 mt-6 font-sans">
        <div className="flex flex-wrap gap-2.5">
          {isAdmin && (
            <button
              type="button"
              onClick={onResetPasswordClick}
              className="px-4 py-2 bg-theme-border-muted hover:bg-theme-border-active border border-theme-border-active text-theme-text-secondary rounded-xl text-xs font-semibold cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center gap-1.5"
            >
              <RefreshCw className="h-3.5 w-3.5 text-purple-500" /> Reset
              Password?
            </button>
          )}

          {!showSupervisorWarning && (
            <button
              type="button"
              onClick={onChangePasswordClick}
              className="px-4 py-2 bg-theme-border-muted hover:bg-theme-border-active border border-theme-border-active text-theme-text-secondary rounded-xl text-xs font-semibold cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center gap-1.5"
            >
              <KeyRound className="h-3.5 w-3.5 text-blue-400" /> Change Password
            </button>
          )}

          {isAdmin && viewingStaff.role !== "admin" && (
            <button
              type="button"
              onClick={onDeleteAccountClick}
              className="px-4 py-2.5 bg-red-950/20 hover:bg-red-900/30 border border-red-900/50 text-red-400 rounded-xl text-xs font-semibold cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center gap-1.5"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete Account
            </button>
          )}
        </div>

        {(isAdmin || isSupervisor) && (
          <div>
            <button
              type="button"
              disabled={submitting}
              onClick={onSaveProfileClick}
              className="px-6 py-2.5 bg-linear-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-xl text-xs font-bold cursor-pointer transition-all shadow-lg shadow-blue-950/20 border border-blue-700/30 flex items-center gap-1.5 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              {submitting ? "Saving..." : "Save Changes"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
