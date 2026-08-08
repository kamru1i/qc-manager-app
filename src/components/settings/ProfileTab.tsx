
import React, { memo } from 'react';
import { Key, RefreshCw } from 'lucide-react';
import { StaffSettingsForm } from '@/components/leave-tracker/StaffSettingsForm';
import { isTabVisibleForRole } from '@/utils/permissionService';

interface ProfileTabProps {
  profile: any;
  profilesList: any[];
  isAdmin: boolean;
  isSuperAdmin: boolean;
  handleSaveSettings: (e: React.FormEvent) => void;
  handleUpdatePassword: (e: React.FormEvent) => void;
  submitting: boolean;
  hasChanges: boolean;
  effectiveAdminDelegatedFlags: any;
  // All the state variables
  editUsername: string; setEditUsername: (val: string) => void;
  editFullName: string; setEditFullName: (val: string) => void;
  editHasChutiAccess: boolean; setEditHasChutiAccess: (val: boolean) => void;
  editNeedsApproval: boolean; setEditNeedsApproval: (val: boolean) => void;
  editSupervisorIds: string[]; setEditSupervisorIds: (val: string[]) => void;
  editEligibleOfficeLeave: boolean; setEditEligibleOfficeLeave: (val: boolean) => void;
  editEligibleGovtHoliday: boolean; setEditEligibleGovtHoliday: (val: boolean) => void;
  editAllowOvertime: boolean; setEditAllowOvertime: (val: boolean) => void;
  editAllowReserve: boolean; setEditAllowReserve: (val: boolean) => void;
  editHasQuotesAccess: boolean; setEditHasQuotesAccess: (val: boolean) => void;
  editAllowedTypes: string[]; setEditAllowedTypes: (val: string[]) => void;
  editCanManageRules: boolean; setEditCanManageRules: (val: boolean) => void;
  editJobRole: string; setEditJobRole: (val: string) => void;
  editWorkingHours: string; setEditWorkingHours: (val: string) => void;
  editBreakTime: string; setEditBreakTime: (val: string) => void;
  profileSignInTime: string; setProfileSignInTime: (val: string) => void;
  profileSignOutTime: string; setProfileSignOutTime: (val: string) => void;
  editKpiSkills: string[]; setEditKpiSkills: (val: string[]) => void;
  editKpiDeptIndicators: string[]; setEditKpiDeptIndicators: (val: string[]) => void;
  editKpiOtherDeptIndicators: string[]; setEditKpiOtherDeptIndicators: (val: string[]) => void;
  editPerformsDataEntry: boolean; setEditPerformsDataEntry: (val: boolean) => void;
  editDepartment: string; setEditDepartment: (val: string) => void;
  editPerformsOtherDeptTasks: boolean; setEditPerformsOtherDeptTasks: (val: boolean) => void;
  editOtherDepartment: string; setEditOtherDepartment: (val: string) => void;
  editDelegatedLeaveSupervisorId: string | null; setEditDelegatedLeaveSupervisorId: (val: string | null) => void;
  editDelegatedKpiSupervisorId: string | null; setEditDelegatedKpiSupervisorId: (val: string | null) => void;
  userFeatureFlags: any; setUserFeatureFlags: (val: any) => void;
  showPasswordFields: boolean; setShowPasswordFields: (val: boolean) => void;
  newPassword: string; setNewPassword: (val: string) => void;
  confirmNewPassword: string; setConfirmNewPassword: (val: string) => void;
  passwordSubmitting: boolean;
}

export const ProfileTab = memo(function ProfileTab({
  profile, profilesList, isAdmin, isSuperAdmin, handleSaveSettings, handleUpdatePassword,
  submitting, hasChanges, effectiveAdminDelegatedFlags,
  editUsername, setEditUsername, editFullName, setEditFullName, editHasChutiAccess, setEditHasChutiAccess,
  editNeedsApproval, setEditNeedsApproval, editSupervisorIds, setEditSupervisorIds,
  editEligibleOfficeLeave, setEditEligibleOfficeLeave, editEligibleGovtHoliday, setEditEligibleGovtHoliday,
  editAllowOvertime, setEditAllowOvertime, editAllowReserve, setEditAllowReserve,
  editHasQuotesAccess, setEditHasQuotesAccess, editAllowedTypes, setEditAllowedTypes,
  editCanManageRules, setEditCanManageRules, editJobRole, setEditJobRole,
  editWorkingHours, setEditWorkingHours, editBreakTime, setEditBreakTime,
  profileSignInTime, setProfileSignInTime, profileSignOutTime, setProfileSignOutTime,
  editKpiSkills, setEditKpiSkills, editKpiDeptIndicators, setEditKpiDeptIndicators,
  editKpiOtherDeptIndicators, setEditKpiOtherDeptIndicators, editPerformsDataEntry, setEditPerformsDataEntry,
  editDepartment, setEditDepartment, editPerformsOtherDeptTasks, setEditPerformsOtherDeptTasks,
  editOtherDepartment, setEditOtherDepartment, editDelegatedLeaveSupervisorId, setEditDelegatedLeaveSupervisorId,
  editDelegatedKpiSupervisorId, setEditDelegatedKpiSupervisorId, userFeatureFlags, setUserFeatureFlags,
  showPasswordFields, setShowPasswordFields, newPassword, setNewPassword,
  confirmNewPassword, setConfirmNewPassword, passwordSubmitting
}: ProfileTabProps) {
  return (
    <>
      <div className="space-y-6">
        <form id="profile-settings-form" onSubmit={handleSaveSettings} className="space-y-6">
          <StaffSettingsForm
            isNewUser={false}
            currentUser={profile}
            viewingStaff={profile}
            codename={editUsername}
            setCodename={setEditUsername}
            fullName={editFullName}
            setFullName={setEditFullName}
            role={profile?.role || 'user'}
            setRole={() => {}}
            hasChutiAccess={editHasChutiAccess}
            setHasChutiAccess={setEditHasChutiAccess}
            needsApproval={editNeedsApproval}
            setNeedsApproval={setEditNeedsApproval}
            supervisors={profilesList.filter((p) => p.role === 'supervisor')}
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
            allowedTypes={editAllowedTypes}
            setAllowedTypes={setEditAllowedTypes}
            canManageRules={editCanManageRules}
            setCanManageRules={setEditCanManageRules}
            isAdmin={isAdmin}
            isSupervisor={profile?.role === 'supervisor'}
            jobRole={editJobRole}
            setJobRole={setEditJobRole}
            workingHours={editWorkingHours}
            setWorkingHours={setEditWorkingHours}
            breakTime={editBreakTime}
            setBreakTime={setEditBreakTime}
            signInTime={profileSignInTime}
            setSignInTime={setProfileSignInTime}
            signOutTime={profileSignOutTime}
            setSignOutTime={setProfileSignOutTime}
            kpiSkills={editKpiSkills}
            setKpiSkills={setEditKpiSkills}
            kpiDeptIndicators={editKpiDeptIndicators}
            setKpiDeptIndicators={setEditKpiDeptIndicators}
            kpiOtherDeptIndicators={editKpiOtherDeptIndicators}
            setKpiOtherDeptIndicators={setEditKpiOtherDeptIndicators}
            performsDataEntry={editPerformsDataEntry}
            setPerformsDataEntry={setEditPerformsDataEntry}
            department={editDepartment}
            setDepartment={setEditDepartment}
            performsOtherDeptTasks={editPerformsOtherDeptTasks}
            setPerformsOtherDeptTasks={setEditPerformsOtherDeptTasks}
            otherDepartment={editOtherDepartment}
            setOtherDepartment={setEditOtherDepartment}
            delegatedLeaveSupervisorId={editDelegatedLeaveSupervisorId}
            setDelegatedLeaveSupervisorId={setEditDelegatedLeaveSupervisorId}
            delegatedKpiSupervisorId={editDelegatedKpiSupervisorId}
            setDelegatedKpiSupervisorId={setEditDelegatedKpiSupervisorId}
            userFeatureFlags={userFeatureFlags}
            setUserFeatureFlags={setUserFeatureFlags}
            adminDelegatedFlags={effectiveAdminDelegatedFlags}
          />
        </form>

        {isTabVisibleForRole(profile, 'profile_component_change_password', profile?.global_settings) && (
          <div className="bg-theme-card-bg/40 rounded-2xl border border-theme-border-input/60 p-5 space-y-3 w-full">
            <h3
              onClick={() => setShowPasswordFields(!showPasswordFields)}
              className="text-sm font-bold text-theme-text-secondary uppercase tracking-wider flex items-center justify-between pb-2 border-b border-theme-border-input/40 cursor-pointer hover:text-blue-400 transition-colors select-none"
            >
              <span className="flex items-center gap-2">
                <Key className="h-4 w-4 text-blue-400" />
                Change Password?
              </span>
              <span className="text-[10px] text-blue-400 capitalize">{showPasswordFields ? 'Hide' : 'Show'}</span>
            </h3>

            <div
              className={`transition-all duration-300 ease-in-out ${
                showPasswordFields
                  ? 'max-h-[300px] opacity-100 overflow-visible mt-2'
                  : 'max-h-0 opacity-0 overflow-hidden pointer-events-none mt-0'
              }`}
            >
              <form onSubmit={handleUpdatePassword} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end pt-1 w-full font-sans">
                <div className="md:col-span-5">
                  <label className="block text-[10px] font-semibold text-theme-text-muted uppercase tracking-wider mb-1">New Password</label>
                  <input
                    type="password"
                    placeholder="Enter at least 6 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="block w-full h-[36px] px-3 bg-theme-page-bg border border-theme-border-input rounded-lg text-theme-text-primary text-xs focus:outline-none focus:border-blue-500/50"
                  />
                </div>
                <div className="md:col-span-5">
                  <label className="block text-[10px] font-semibold text-theme-text-muted uppercase tracking-wider mb-1">Confirm New Password</label>
                  <input
                    type="password"
                    placeholder="Verify new password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    className="block w-full h-[36px] px-3 bg-theme-page-bg border border-theme-border-input rounded-lg text-theme-text-primary text-xs focus:outline-none focus:border-blue-500/50"
                  />
                </div>
                <div className="md:col-span-2">
                  <button
                    type="submit"
                    disabled={passwordSubmitting}
                    className="w-full h-[36px] flex justify-center items-center py-2 px-3 border border-transparent rounded-lg shadow-md text-xs font-bold text-theme-text-primary bg-theme-border-input hover:bg-theme-border-active hover:text-theme-text-inverse cursor-pointer disabled:opacity-50 transition-all gap-1.5 active:scale-98 shrink-0"
                  >
                    {passwordSubmitting && <RefreshCw className="h-3 w-3 animate-spin" />}
                    <span className="truncate">{passwordSubmitting ? 'Updating...' : 'Update Password'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>

      {profile?.profile_change_status !== 'pending' && (
        <div className="flex justify-end pt-4 border-t border-theme-border-input/60 w-full mt-6">
          <button
            type="submit"
            form="profile-settings-form"
            disabled={submitting || !hasChanges}
            className={`w-full md:w-auto md:px-10 flex justify-center py-3 px-6 border rounded-xl shadow-lg text-xs font-bold transition-all items-center gap-2 ${
              submitting || !hasChanges
                ? 'border-theme-border-input bg-theme-border-input/40 text-theme-text-muted/60 cursor-not-allowed opacity-50'
                : 'border-transparent text-white bg-blue-600 hover:bg-blue-500 hover:shadow-blue-600/10 cursor-pointer active:scale-98'
            }`}
          >
            {submitting && <RefreshCw className="h-4 w-4 animate-spin" />}
            {submitting
              ? 'Updating...'
              : (isAdmin || !profile?.has_edited_profile
                  ? 'Save Changes'
                  : 'Submit Request for Approval')}
          </button>
        </div>
      )}
    </>
  );
});
