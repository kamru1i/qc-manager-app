'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { User, AlertTriangle, RefreshCw, Settings, Key, Layout, Shield, FileText, Globe, Trash2, Users, Activity, ScrollText } from 'lucide-react';
import { UserManagement } from '@/components/common/UserManagement';

import { Profile } from '@/types';
import { isSuperadmin, isAdminRole, isTabVisibleForRole, isFeatureEnabled, canAdminManageFeatureFlag, isAdminDelegatedFeature } from '@/utils/permissionService';
import { StaffSettingsForm } from '@/components/leave-tracker/StaffSettingsForm';
import { supabase } from '@/utils/supabase';
import { toast } from 'sonner';
import { ProfileTab } from '@/components/settings/ProfileTab';
import { AccessControlsTab } from '@/components/settings/AccessControlsTab';
import { FeatureFlagsTab } from '@/components/settings/FeatureFlagsTab';
import { SanitizerTab } from '@/components/settings/SanitizerTab';
import { DateTimeInput } from '@/components/common/DateTimeInput';
import { SanitizerRule, resolveSanitizerRules } from '@/utils/fileNameSanitizer';
import { useAppEvent } from '@/contexts/AppEventBusContext';
import { TempAccessEntry, GlobalSettings } from '@/utils/dashboardHelpers';
import {
  MENU_TABS,
  getDefaultRoleVisibility,
  CONFIGURABLE_ROLES,
} from '@/utils/menuTabsRegistry';

function formatCustomDateTime(dateInput: string | Date): string {
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return String(dateInput);

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();

  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const strHours = String(hours).padStart(2, '0');

  return `${day}-${month}-${year}, ${strHours}:${minutes} ${ampm}`;
}
import { FEATURE_FLAGS, getDefaultFeatureFlagState, FLAG_TO_TAB_KEY } from '@/utils/featureFlagsRegistry';
import { useProfiles } from '@/contexts/ProfilesContext';
import { useProfileSettingsHandlers } from '@/hooks/useProfileSettingsHandlers';
import { useProfileSettingsState } from '@/hooks/useProfileSettingsState';


interface ProfileSettingsProps {
  profile: Profile | null;
  setProfile: (profile: Profile | null) => void;
  sessionUser: any;
  onBack?: () => void;
  globalSettings?: GlobalSettings;
  topPerformerBadges?: Record<string, any>;
}

export function ProfileSettings({
  profile,
  setProfile,
  sessionUser,
  globalSettings,
  topPerformerBadges,
}: ProfileSettingsProps) {
  const stateHook = useProfileSettingsState(profile, sessionUser);
  const {
    state,
    dispatch,
    editUsername,
    setEditUsername,
    editFullName,
    setEditFullName,
    editJobRole,
    setEditJobRole,
    editWorkingHours,
    setEditWorkingHours,
    editBreakTime,
    setEditBreakTime,
    profileSignInTime,
    setProfileSignInTime,
    profileSignOutTime,
    setProfileSignOutTime,
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
    editAllowedTypes,
    setEditAllowedTypes,
    editCanManageRules,
    setEditCanManageRules,
    editKpiSkills,
    setEditKpiSkills,
    editKpiDeptIndicators,
    setEditKpiDeptIndicators,
    editKpiOtherDeptIndicators,
    setEditKpiOtherDeptIndicators,
    editPerformsDataEntry,
    setEditPerformsDataEntry,
    editDepartment,
    setEditDepartment,
    editPerformsOtherDeptTasks,
    setEditPerformsOtherDeptTasks,
    editOtherDepartment,
    setEditOtherDepartment,
    editDelegatedLeaveSupervisorId,
    setEditDelegatedLeaveSupervisorId,
    editDelegatedKpiSupervisorId,
    setEditDelegatedKpiSupervisorId,
    newPassword,
    setNewPassword,
    confirmNewPassword,
    setConfirmNewPassword,
    passwordSubmitting,
    setPasswordSubmitting,
    showPasswordFields,
    setShowPasswordFields,
    syncedProfileId,
    setSyncedProfileId,
    sanitizerRules,
    setSanitizerRules,
    sanitizerInput,
    setSanitizerInput,
    sanitizerSubmitting,
    setSanitizerSubmitting,
    roleVisibility,
    setRoleVisibility,
    activeRoleVisKey,
    setActiveRoleVisKey,
    supervisorAccessOverrides,
    setSupervisorAccessOverrides,
    selectedSupervisorId,
    setSelectedSupervisorId,
    featureFlags,
    setFeatureFlags,
    userFeatureFlags,
    setUserFeatureFlags,
    adminDelegatedFlags,
    setAdminDelegatedFlags,
    activeFlagKey,
    setActiveFlagKey,
    tempAccess,
    setTempAccess,
    tempSubmitting,
    setTempSubmitting,
    tempForm,
    setTempForm,
    submitting,
    setSubmitting,
    isCodenameEditable,
    setIsCodenameEditable,
    activeSubTab,
    setActiveSubTab,
    currentTimestamp,
    setCurrentTimestamp,
  } = stateHook;

  const { profilesList, refreshProfiles } = useProfiles();
  const superadminProfile = useMemo(() => profilesList.find((p) => p.role === 'superadmin'), [profilesList]);

  // Dynamic access check for each Settings subtab (superadmin always sees everything, otherwise role_visibility / isTabVisibleForRole)
  const canSeeProfile = useMemo(() => isSuperadmin(profile) || isTabVisibleForRole(profile, 'settings_profile', profile?.global_settings), [profile]);
  const canSeeUserManagement = useMemo(() => isAdminRole(profile) || profile?.role === 'supervisor', [profile]);

  const canSeeSanitizer = useMemo(() => isSuperadmin(profile) || isTabVisibleForRole(profile, 'settings_sanitizer', profile?.global_settings), [profile]);
  const canSeeAccess = useMemo(() => isSuperadmin(profile) || isTabVisibleForRole(profile, 'settings_access', profile?.global_settings), [profile]);
  const canSeeFeatureFlags = useMemo(() => isSuperadmin(profile) || isTabVisibleForRole(profile, 'settings_feature_flags', profile?.global_settings), [profile]);

  // Derived effective admin delegated flags (combines superadmin profile settings with local state and current profile)
  const effectiveAdminDelegatedFlags = useMemo(() => {
    const saFlags = superadminProfile?.global_settings?.admin_delegated_flags;
    const userFlags = profile?.global_settings?.admin_delegated_flags;
    return { ...(userFlags || {}), ...(saFlags || {}), ...(adminDelegatedFlags || {}) };
  }, [superadminProfile, profile, adminDelegatedFlags]);

  const handlersObj = useProfileSettingsHandlers(
    { profile, setProfile, sessionUser, profilesList, refreshProfiles, effectiveAdminDelegatedFlags },
    stateHook
  );
  const {
    handleToggleSupervisorOverride,
    handleSubTabChange,
    handleUpdatePassword,
    handleSaveSettings,
    handleSaveSanitizerRules,
    handleAddSanitizerWord,
    handleToggleSanitizerWord,
    handleRemoveSanitizerWord,
    handleToggleRoleVisibility,
    handleToggleFeatureFlag,
    handleToggleAdminDelegation,
    handleResetAllUserFeatureFlags,
    handleSaveTempAccess,
    handleAddTempAccess,
    handleRemoveTempAccess,
  } = handlersObj;

  useAppEvent('settings-subtab-change', (payload) => {
    const tab = typeof payload === 'string' ? payload : payload?.subtab;
    if (tab) {
      setActiveSubTab(tab as any);
      localStorage.setItem('settings_active_subtab', tab);
    }
  }, []);

  // Fallback check: if saved subtab is restricted for current role, revert to profile
  useEffect(() => {
    if (!profile) return;
    if (activeSubTab === 'sanitizer' && !canSeeSanitizer) {
      setActiveSubTab('profile');
      localStorage.setItem('settings_active_subtab', 'profile');
    } else if (activeSubTab === 'access_controls' && !canSeeAccess) {
      setActiveSubTab('profile');
      localStorage.setItem('settings_active_subtab', 'profile');
    } else if (activeSubTab === 'feature_flags' && !canSeeFeatureFlags) {
      setActiveSubTab('profile');
      localStorage.setItem('settings_active_subtab', 'profile');
    }
  }, [profile, activeSubTab, canSeeSanitizer, canSeeAccess, canSeeFeatureFlags]);

  const isSuperAdmin = isSuperadmin(profile);

  // Determine if there are changes
  const hasChanges = useMemo(() => {
    if (!profile || syncedProfileId !== profile.id) return false;

    const isUsernameChanged = editUsername.toUpperCase().trim() !== (profile.username || '').toUpperCase().trim();
    const isFullNameChanged = editFullName.trim() !== (profile.full_name || '').trim();
    const isWorkingHoursChanged = (parseFloat(editWorkingHours) || 9.5) !== (profile.working_hours ?? 9.5);
    const isBreakTimeChanged = (parseInt(editBreakTime) || 0) !== (profile.break_time ?? 0);
    const isJobRoleChanged = editJobRole.trim() !== (profile.job_role || '').trim();
    const isSignInChanged = (profileSignInTime || '') !== (profile.default_sign_in || '');
    const isSignOutChanged = (profileSignOutTime || '') !== (profile.default_sign_out || '');

    const isHasChutiAccessChanged = editHasChutiAccess !== (profile.has_chuti_access !== false);
    const isNeedsApprovalChanged = editNeedsApproval !== (profile.needs_supervisor_approval !== false);
    const isSupervisorIdsChanged = JSON.stringify([...editSupervisorIds].sort()) !== JSON.stringify([...(profile.supervisor_ids || [])].sort());
    const isEligibleOfficeLeaveChanged = editEligibleOfficeLeave !== (profile.eligible_office_leave !== false);
    const isEligibleGovtHolidayChanged = editEligibleGovtHoliday !== (profile.eligible_govt_holiday !== false);
    const isAllowOvertimeChanged = editAllowOvertime !== (!!profile.allow_overtime);
    const isAllowReserveChanged = editAllowReserve !== (!!profile.allow_reserve);
    const isHasQuotesAccessChanged = editHasQuotesAccess !== (profile.has_quotes_access !== false);
    const isAllowedTypesChanged = JSON.stringify([...editAllowedTypes].sort()) !== JSON.stringify([...(profile.allowed_types || [])].sort());
    const isCanManageRulesChanged = editCanManageRules !== (!!profile.can_manage_rules);

    const isKpiSkillsChanged = JSON.stringify(editKpiSkills) !== JSON.stringify(profile.global_settings?.kpi_skills || []);
    const isKpiDeptIndicatorsChanged = JSON.stringify(editKpiDeptIndicators) !== JSON.stringify(profile.global_settings?.kpi_dept_indicators || []);
    const isKpiOtherDeptIndicatorsChanged = JSON.stringify(editKpiOtherDeptIndicators) !== JSON.stringify(profile.global_settings?.kpi_other_dept_indicators || []);
    const isPerformsDataEntryChanged = editPerformsDataEntry !== (profile.global_settings?.performs_data_entry !== false);
    const isDepartmentChanged = editDepartment !== (profile.global_settings?.department || 'Data Entry');
    const isPerformsOtherDeptTasksChanged = editPerformsOtherDeptTasks !== (!!profile.global_settings?.performs_other_dept_tasks);
    const isOtherDepartmentChanged = editOtherDepartment !== (profile.global_settings?.other_department || 'IT');
    const isDelegatedLeaveSupervisorIdChanged = editDelegatedLeaveSupervisorId !== (profile.delegated_leave_supervisor_id || null);
    const isDelegatedKpiSupervisorIdChanged = editDelegatedKpiSupervisorId !== (profile.delegated_kpi_supervisor_id || null);

    const isUserFeatureFlagsChanged = JSON.stringify(userFeatureFlags) !== JSON.stringify(profile.global_settings?.user_feature_flags || {});

    return isUsernameChanged || isFullNameChanged || isWorkingHoursChanged || isBreakTimeChanged ||
           isJobRoleChanged || isSignInChanged || isSignOutChanged || isHasChutiAccessChanged ||
           isNeedsApprovalChanged || isSupervisorIdsChanged || isEligibleOfficeLeaveChanged ||
           isEligibleGovtHolidayChanged || isAllowOvertimeChanged || isAllowReserveChanged ||
           isHasQuotesAccessChanged || isAllowedTypesChanged || isCanManageRulesChanged ||
           isKpiSkillsChanged || isKpiDeptIndicatorsChanged || isKpiOtherDeptIndicatorsChanged ||
           isPerformsDataEntryChanged || isDepartmentChanged || isPerformsOtherDeptTasksChanged ||
           isOtherDepartmentChanged || isDelegatedLeaveSupervisorIdChanged || isDelegatedKpiSupervisorIdChanged ||
           isUserFeatureFlagsChanged;
  }, [
    profile, syncedProfileId, editUsername, editFullName, editWorkingHours, editBreakTime, editJobRole,
    profileSignInTime, profileSignOutTime, editHasChutiAccess, editNeedsApproval, editSupervisorIds,
    editEligibleOfficeLeave, editEligibleGovtHoliday, editAllowOvertime, editAllowReserve, editHasQuotesAccess,
    editAllowedTypes, editCanManageRules, editKpiSkills, editKpiDeptIndicators, editKpiOtherDeptIndicators,
    editPerformsDataEntry, editDepartment, editPerformsOtherDeptTasks, editOtherDepartment,
    editDelegatedLeaveSupervisorId, editDelegatedKpiSupervisorId, userFeatureFlags
  ]);

  return (
    <div className="w-full space-y-6 font-sans">
      {/* Decorative background blobs */}
      <div className="absolute top-[-10%] right-[-15%] w-[45%] h-[45%] rounded-full bg-blue-900/5 blur-[90px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-15%] w-[35%] h-[35%] rounded-full bg-purple-900/5 blur-[70px] pointer-events-none" />


      {/* Subtab Navigation (Scrollable on small displays) */}
      <div className="flex items-center gap-2 border-b border-theme-border-input/60 pb-3 overflow-x-auto overflow-y-hidden max-w-full whitespace-nowrap pt-0.5 scrollbar-thin touch-pan-x scrollbar-thumb-blue-500/20 hover:scrollbar-thumb-blue-500/40">
        {canSeeProfile && (
          <button
            type="button"
            onClick={() => handleSubTabChange('profile')}
            className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === 'profile'
                ? 'bg-blue-600/15 border border-blue-500/30 text-blue-400 shadow-sm'
                : 'text-theme-text-secondary hover:bg-theme-card-bg/60 border border-transparent'
            }`}
          >
            <User className="h-4 w-4 text-sky-400" />
            <span>Profile</span>
          </button>
        )}



        {canSeeSanitizer && (
          <button
            type="button"
            onClick={() => handleSubTabChange('sanitizer')}
            className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === 'sanitizer'
                ? 'bg-cyan-600/15 border border-cyan-500/30 text-cyan-400 shadow-sm'
                : 'text-theme-text-secondary hover:bg-theme-card-bg/60 border border-transparent'
            }`}
          >
            <FileText className="h-4 w-4 text-cyan-400" />
            <span>Sanitizer</span>
          </button>
        )}

        {canSeeAccess && (
          <button
            type="button"
            onClick={() => handleSubTabChange('access_controls')}
            className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === 'access_controls'
                ? 'bg-rose-600/15 border border-rose-500/30 text-rose-400 shadow-sm'
                : 'text-theme-text-secondary hover:bg-theme-card-bg/60 border border-transparent'
            }`}
          >
            <Shield className="h-4 w-4 text-rose-400" />
            <span>Access</span>
          </button>
        )}

        {canSeeFeatureFlags && (
          <button
            type="button"
            onClick={() => handleSubTabChange('feature_flags')}
            className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === 'feature_flags'
                ? 'bg-purple-600/15 border border-purple-500/30 text-purple-400 shadow-sm'
                : 'text-theme-text-secondary hover:bg-theme-card-bg/60 border border-transparent'
            }`}
          >
            <Settings className="h-4 w-4 text-purple-400" />
            <span>Feature Flags</span>
          </button>
        )}

        {canSeeUserManagement && (
          <button
            type="button"
            onClick={() => handleSubTabChange('user_management')}
            className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === 'user_management'
                ? 'bg-fuchsia-600/15 border border-fuchsia-500/30 text-fuchsia-400 shadow-sm'
                : 'text-theme-text-secondary hover:bg-theme-card-bg/60 border border-transparent'
            }`}
          >
            <Users className="h-4 w-4 text-fuchsia-400" />
            <span>Users</span>
          </button>
        )}
      </div>

      {profile?.profile_change_status === 'pending' && (
        <div className="p-3 bg-purple-955/50 border border-purple-800/50 text-purple-300 text-xs rounded-xl flex items-start gap-2.5 w-full animate-pulse">
          <AlertTriangle className="h-4.5 w-4.5 text-purple-400 shrink-0 mt-0.5" />
          <div>
            <strong className="block font-semibold">Change Request Pending</strong>
            <span className="block mt-0.5">Your profile updates are currently pending approval. You will be notified once an administrator reviews it.</span>
          </div>
        </div>
      )}

      {/* Main Layout (Profile Settings with Unified StaffSettingsForm) */}
      {activeSubTab === 'profile' && (
        <ProfileTab
          profile={profile} profilesList={profilesList} isAdmin={isAdminRole(profile)} isSuperAdmin={isSuperAdmin}
          handleSaveSettings={handleSaveSettings} handleUpdatePassword={handleUpdatePassword} submitting={submitting}
          hasChanges={hasChanges} effectiveAdminDelegatedFlags={effectiveAdminDelegatedFlags}
          editUsername={editUsername} setEditUsername={setEditUsername} editFullName={editFullName} setEditFullName={setEditFullName}
          editHasChutiAccess={editHasChutiAccess} setEditHasChutiAccess={setEditHasChutiAccess}
          editNeedsApproval={editNeedsApproval} setEditNeedsApproval={setEditNeedsApproval}
          editSupervisorIds={editSupervisorIds} setEditSupervisorIds={setEditSupervisorIds}
          editEligibleOfficeLeave={editEligibleOfficeLeave} setEditEligibleOfficeLeave={setEditEligibleOfficeLeave}
          editEligibleGovtHoliday={editEligibleGovtHoliday} setEditEligibleGovtHoliday={setEditEligibleGovtHoliday}
          editAllowOvertime={editAllowOvertime} setEditAllowOvertime={setEditAllowOvertime}
          editAllowReserve={editAllowReserve} setEditAllowReserve={setEditAllowReserve}
          editHasQuotesAccess={editHasQuotesAccess} setEditHasQuotesAccess={setEditHasQuotesAccess}
          editAllowedTypes={editAllowedTypes} setEditAllowedTypes={setEditAllowedTypes}
          editCanManageRules={editCanManageRules} setEditCanManageRules={setEditCanManageRules}
          editJobRole={editJobRole} setEditJobRole={setEditJobRole}
          editWorkingHours={editWorkingHours} setEditWorkingHours={setEditWorkingHours}
          editBreakTime={editBreakTime} setEditBreakTime={setEditBreakTime}
          profileSignInTime={profileSignInTime} setProfileSignInTime={setProfileSignInTime}
          profileSignOutTime={profileSignOutTime} setProfileSignOutTime={setProfileSignOutTime}
          editKpiSkills={editKpiSkills} setEditKpiSkills={setEditKpiSkills}
          editKpiDeptIndicators={editKpiDeptIndicators} setEditKpiDeptIndicators={setEditKpiDeptIndicators}
          editKpiOtherDeptIndicators={editKpiOtherDeptIndicators} setEditKpiOtherDeptIndicators={setEditKpiOtherDeptIndicators}
          editPerformsDataEntry={editPerformsDataEntry} setEditPerformsDataEntry={setEditPerformsDataEntry}
          editDepartment={editDepartment} setEditDepartment={setEditDepartment}
          editPerformsOtherDeptTasks={editPerformsOtherDeptTasks} setEditPerformsOtherDeptTasks={setEditPerformsOtherDeptTasks}
          editOtherDepartment={editOtherDepartment} setEditOtherDepartment={setEditOtherDepartment}
          editDelegatedLeaveSupervisorId={editDelegatedLeaveSupervisorId} setEditDelegatedLeaveSupervisorId={setEditDelegatedLeaveSupervisorId}
          editDelegatedKpiSupervisorId={editDelegatedKpiSupervisorId} setEditDelegatedKpiSupervisorId={setEditDelegatedKpiSupervisorId}
          userFeatureFlags={userFeatureFlags} setUserFeatureFlags={setUserFeatureFlags}
          showPasswordFields={showPasswordFields} setShowPasswordFields={setShowPasswordFields}
          newPassword={newPassword} setNewPassword={setNewPassword}
          confirmNewPassword={confirmNewPassword} setConfirmNewPassword={setConfirmNewPassword}
          passwordSubmitting={passwordSubmitting}
        />
      )}

      {/* File Name Sanitizer */}
      {activeSubTab === 'sanitizer' && (isSuperAdmin || canSeeSanitizer) && (
        <SanitizerTab
          sanitizerRules={sanitizerRules}
          sanitizerInput={sanitizerInput}
          setSanitizerInput={setSanitizerInput}
          handleAddSanitizerWord={handleAddSanitizerWord}
          handleToggleSanitizerWord={handleToggleSanitizerWord}
          handleRemoveSanitizerWord={handleRemoveSanitizerWord}
          handleSaveSanitizerRules={handleSaveSanitizerRules}
          sanitizerSubmitting={sanitizerSubmitting}
          hasChanges={hasChanges}
        />
      )}

      {/* Access & Feature Controls */}
      {activeSubTab === 'access_controls' && (isSuperAdmin || canSeeAccess) && (
        <AccessControlsTab
          isSuperAdmin={isSuperAdmin}
          isAdmin={isAdminRole(profile)}
          roleVisibility={roleVisibility}
          activeRoleVisKey={activeRoleVisKey}
          handleToggleRoleVisibility={handleToggleRoleVisibility}
          supervisorAccessOverrides={supervisorAccessOverrides}
          selectedSupervisorId={selectedSupervisorId}
          setSelectedSupervisorId={setSelectedSupervisorId}
          handleToggleSupervisorOverride={handleToggleSupervisorOverride}
          profilesList={profilesList}
          tempAccess={tempAccess}
          tempForm={tempForm}
          setTempForm={setTempForm}
          handleAddTempAccess={handleAddTempAccess}
          handleRemoveTempAccess={handleRemoveTempAccess}
          tempSubmitting={tempSubmitting}
          currentTimestamp={currentTimestamp}
          handleSaveTempAccess={handleSaveTempAccess}
          hasChanges={hasChanges}
          submitting={submitting}
        />
      )}

      {/* Feature Flags Subtab (Superadmin & Delegated Admin) */}
      {activeSubTab === 'feature_flags' && isAdminRole(profile) && (
        <FeatureFlagsTab
          featureFlags={featureFlags}
          effectiveAdminDelegatedFlags={effectiveAdminDelegatedFlags}
          roleVisibility={roleVisibility}
          activeFlagKey={activeFlagKey}
          isSuperAdmin={isSuperAdmin}
          handleToggleFeatureFlag={handleToggleFeatureFlag}
          handleToggleAdminDelegation={handleToggleAdminDelegation}
        />
      )}

      {activeSubTab === 'user_management' && canSeeUserManagement && (
        <div className="space-y-6">
          <UserManagement
            sessionUser={sessionUser}
            profile={profile}
            onLogout={() => {}}
            theme="dark"
            onThemeToggle={() => {}}
            isSidebarCollapsed={false}
            onSidebarToggle={() => {}}
            topPerformerBadges={topPerformerBadges}
            globalSettings={globalSettings}
          />
        </div>
      )}



      {/* Bottom Save Changes Bar (Profile subtab) */}
          </div>
  );
}
