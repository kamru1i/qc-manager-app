import { useReducer, useEffect, useMemo } from 'react';
import { Profile } from '@/types';
import { SanitizerRule, resolveSanitizerRules } from '@/utils/fileNameSanitizer';
import { TempAccessEntry } from '@/utils/dashboardHelpers';
import { MENU_TABS, getDefaultRoleVisibility, CONFIGURABLE_ROLES } from '@/utils/menuTabsRegistry';
import { FEATURE_FLAGS, getDefaultFeatureFlagState, FLAG_TO_TAB_KEY } from '@/utils/featureFlagsRegistry';

export function useProfileSettingsState(profile: Profile | null, sessionUser: any) {
  const [state, dispatch] = useReducer((state: any, action: any) => ({ ...state, ...action }), {
    editUsername: profile?.username || '',
    editFullName: profile?.full_name || '',
    editJobRole: profile?.job_role || '',
    editWorkingHours: Number(profile?.working_hours ?? 9.5).toFixed(1),
    editBreakTime: (profile?.break_time ?? 0).toString(),
    profileSignInTime: profile?.default_sign_in || '',
    profileSignOutTime: profile?.default_sign_out || '',
    editHasChutiAccess: profile?.has_chuti_access !== false,
    editNeedsApproval: profile?.needs_supervisor_approval !== false,
    editSupervisorIds: profile?.supervisor_ids || [],
    editEligibleOfficeLeave: profile?.eligible_office_leave !== false,
    editEligibleGovtHoliday: profile?.eligible_govt_holiday !== false,
    editAllowOvertime: !!profile?.allow_overtime,
    editAllowReserve: !!profile?.allow_reserve,
    editHasQuotesAccess: profile?.has_quotes_access !== false,
    editAllowedTypes: profile?.allowed_types || [],
    editCanManageRules: !!profile?.can_manage_rules,
    editKpiSkills: profile?.global_settings?.kpi_skills || [],
    editKpiDeptIndicators: profile?.global_settings?.kpi_dept_indicators || [],
    editKpiOtherDeptIndicators: profile?.global_settings?.kpi_other_dept_indicators || [],
    editPerformsDataEntry: profile?.global_settings?.performs_data_entry !== false,
    editDepartment: profile?.global_settings?.department || 'Data Entry',
    editPerformsOtherDeptTasks: !!profile?.global_settings?.performs_other_dept_tasks,
    editOtherDepartment: profile?.global_settings?.other_department || 'IT',
    editDelegatedLeaveSupervisorId: profile?.delegated_leave_supervisor_id || null,
    editDelegatedKpiSupervisorId: profile?.delegated_kpi_supervisor_id || null,
    newPassword: '',
    confirmNewPassword: '',
    passwordSubmitting: false,
    showPasswordFields: false,
    syncedProfileId: profile?.id || null,
    sanitizerRules: [],
    sanitizerInput: '',
    sanitizerSubmitting: false,
    roleVisibility: {},
    activeRoleVisKey: null,
    supervisorAccessOverrides: {},
    selectedSupervisorId: '',
    featureFlags: {},
    userFeatureFlags: profile?.global_settings?.user_feature_flags || {},
    adminDelegatedFlags: {},
    activeFlagKey: null,
    tempAccess: [],
    tempSubmitting: false,
    tempForm: { target_type: 'role', user_id: '', user_codename: '', role: 'user', tabKey: '', action: 'revoke', expires_at: '', comment: '' },
    submitting: false,
    isCodenameEditable: false,
    activeSubTab: (typeof window !== 'undefined' && localStorage.getItem('settings_active_subtab'))
      ? (localStorage.getItem('settings_active_subtab') as any)
      : 'profile',
    currentTimestamp: 0,
  });

  useEffect(() => {
    try {
      const savedSubtab = localStorage.getItem('settings_active_subtab');
      if (savedSubtab && ['profile', 'user_management', 'sanitizer', 'access_controls', 'feature_flags'].includes(savedSubtab)) {
        dispatch({ activeSubTab: savedSubtab });
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  useEffect(() => {
    const updateTimestamp = () => dispatch({ currentTimestamp: Date.now() });
    updateTimestamp();
    const interval = window.setInterval(updateTimestamp, 60_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (profile) {
      dispatch({
        editUsername: profile.username || '',
        editFullName: profile.full_name || '',
        editJobRole: profile.job_role || '',
        editWorkingHours: Number(profile.working_hours ?? 9.5).toFixed(1),
        editBreakTime: (profile.break_time ?? 0).toString(),
        profileSignInTime: profile.default_sign_in || '',
        profileSignOutTime: profile.default_sign_out || '',
        editHasChutiAccess: profile.has_chuti_access !== false,
        editNeedsApproval: profile.needs_supervisor_approval !== false,
        editSupervisorIds: profile.supervisor_ids || [],
        editEligibleOfficeLeave: profile.eligible_office_leave !== false,
        editEligibleGovtHoliday: profile.eligible_govt_holiday !== false,
        editAllowOvertime: !!profile.allow_overtime,
        editAllowReserve: !!profile.allow_reserve,
        editHasQuotesAccess: profile.has_quotes_access !== false,
        editAllowedTypes: profile.allowed_types || [],
        editCanManageRules: !!profile.can_manage_rules,
        editKpiSkills: profile.global_settings?.kpi_skills || [],
        editKpiDeptIndicators: profile.global_settings?.kpi_dept_indicators || [],
        editKpiOtherDeptIndicators: profile.global_settings?.kpi_other_dept_indicators || [],
        editPerformsDataEntry: profile.global_settings?.performs_data_entry !== false,
        editDepartment: profile.global_settings?.department || 'Data Entry',
        editPerformsOtherDeptTasks: !!profile.global_settings?.performs_other_dept_tasks,
        editOtherDepartment: profile.global_settings?.other_department || 'IT',
        editDelegatedLeaveSupervisorId: profile.delegated_leave_supervisor_id || null,
        editDelegatedKpiSupervisorId: profile.delegated_kpi_supervisor_id || null,
        syncedProfileId: profile.id,
        sanitizerRules: resolveSanitizerRules(profile.global_settings?.sanitizer_rules, profile.global_settings?.sanitizer_words),
        roleVisibility: (profile.global_settings?.role_visibility && typeof profile.global_settings.role_visibility === 'object') ? profile.global_settings.role_visibility : {},
        featureFlags: (profile.global_settings?.feature_flags && typeof profile.global_settings.feature_flags === 'object') ? profile.global_settings.feature_flags : {},
        userFeatureFlags: profile.global_settings?.user_feature_flags || {},
        adminDelegatedFlags: (profile.global_settings?.admin_delegated_flags && typeof profile.global_settings.admin_delegated_flags === 'object') ? profile.global_settings.admin_delegated_flags : {},
        supervisorAccessOverrides: (profile.global_settings?.supervisor_access_overrides && typeof profile.global_settings.supervisor_access_overrides === 'object') ? profile.global_settings.supervisor_access_overrides : {},
        tempAccess: Array.isArray(profile.global_settings?.temp_access) ? profile.global_settings.temp_access : [],
      });
    }
  }, [profile, sessionUser]);

  const setEditUsername = (val: any) => dispatch({ editUsername: typeof val === 'function' ? val(state.editUsername) : val });
  const setEditFullName = (val: any) => dispatch({ editFullName: typeof val === 'function' ? val(state.editFullName) : val });
  const setEditJobRole = (val: any) => dispatch({ editJobRole: typeof val === 'function' ? val(state.editJobRole) : val });
  const setEditWorkingHours = (val: any) => dispatch({ editWorkingHours: typeof val === 'function' ? val(state.editWorkingHours) : val });
  const setEditBreakTime = (val: any) => dispatch({ editBreakTime: typeof val === 'function' ? val(state.editBreakTime) : val });
  const setProfileSignInTime = (val: any) => dispatch({ profileSignInTime: typeof val === 'function' ? val(state.profileSignInTime) : val });
  const setProfileSignOutTime = (val: any) => dispatch({ profileSignOutTime: typeof val === 'function' ? val(state.profileSignOutTime) : val });
  const setEditHasChutiAccess = (val: any) => dispatch({ editHasChutiAccess: typeof val === 'function' ? val(state.editHasChutiAccess) : val });
  const setEditNeedsApproval = (val: any) => dispatch({ editNeedsApproval: typeof val === 'function' ? val(state.editNeedsApproval) : val });
  const setEditSupervisorIds = (val: any) => dispatch({ editSupervisorIds: typeof val === 'function' ? val(state.editSupervisorIds) : val });
  const setEditEligibleOfficeLeave = (val: any) => dispatch({ editEligibleOfficeLeave: typeof val === 'function' ? val(state.editEligibleOfficeLeave) : val });
  const setEditEligibleGovtHoliday = (val: any) => dispatch({ editEligibleGovtHoliday: typeof val === 'function' ? val(state.editEligibleGovtHoliday) : val });
  const setEditAllowOvertime = (val: any) => dispatch({ editAllowOvertime: typeof val === 'function' ? val(state.editAllowOvertime) : val });
  const setEditAllowReserve = (val: any) => dispatch({ editAllowReserve: typeof val === 'function' ? val(state.editAllowReserve) : val });
  const setEditHasQuotesAccess = (val: any) => dispatch({ editHasQuotesAccess: typeof val === 'function' ? val(state.editHasQuotesAccess) : val });
  const setEditAllowedTypes = (val: any) => dispatch({ editAllowedTypes: typeof val === 'function' ? val(state.editAllowedTypes) : val });
  const setEditCanManageRules = (val: any) => dispatch({ editCanManageRules: typeof val === 'function' ? val(state.editCanManageRules) : val });
  const setEditKpiSkills = (val: any) => dispatch({ editKpiSkills: typeof val === 'function' ? val(state.editKpiSkills) : val });
  const setEditKpiDeptIndicators = (val: any) => dispatch({ editKpiDeptIndicators: typeof val === 'function' ? val(state.editKpiDeptIndicators) : val });
  const setEditKpiOtherDeptIndicators = (val: any) => dispatch({ editKpiOtherDeptIndicators: typeof val === 'function' ? val(state.editKpiOtherDeptIndicators) : val });
  const setEditPerformsDataEntry = (val: any) => dispatch({ editPerformsDataEntry: typeof val === 'function' ? val(state.editPerformsDataEntry) : val });
  const setEditDepartment = (val: any) => dispatch({ editDepartment: typeof val === 'function' ? val(state.editDepartment) : val });
  const setEditPerformsOtherDeptTasks = (val: any) => dispatch({ editPerformsOtherDeptTasks: typeof val === 'function' ? val(state.editPerformsOtherDeptTasks) : val });
  const setEditOtherDepartment = (val: any) => dispatch({ editOtherDepartment: typeof val === 'function' ? val(state.editOtherDepartment) : val });
  const setEditDelegatedLeaveSupervisorId = (val: any) => dispatch({ editDelegatedLeaveSupervisorId: typeof val === 'function' ? val(state.editDelegatedLeaveSupervisorId) : val });
  const setEditDelegatedKpiSupervisorId = (val: any) => dispatch({ editDelegatedKpiSupervisorId: typeof val === 'function' ? val(state.editDelegatedKpiSupervisorId) : val });
  const setNewPassword = (val: any) => dispatch({ newPassword: typeof val === 'function' ? val(state.newPassword) : val });
  const setConfirmNewPassword = (val: any) => dispatch({ confirmNewPassword: typeof val === 'function' ? val(state.confirmNewPassword) : val });
  const setPasswordSubmitting = (val: any) => dispatch({ passwordSubmitting: typeof val === 'function' ? val(state.passwordSubmitting) : val });
  const setShowPasswordFields = (val: any) => dispatch({ showPasswordFields: typeof val === 'function' ? val(state.showPasswordFields) : val });
  const setSyncedProfileId = (val: any) => dispatch({ syncedProfileId: typeof val === 'function' ? val(state.syncedProfileId) : val });
  const setSanitizerRules = (val: any) => dispatch({ sanitizerRules: typeof val === 'function' ? val(state.sanitizerRules) : val });
  const setSanitizerInput = (val: any) => dispatch({ sanitizerInput: typeof val === 'function' ? val(state.sanitizerInput) : val });
  const setSanitizerSubmitting = (val: any) => dispatch({ sanitizerSubmitting: typeof val === 'function' ? val(state.sanitizerSubmitting) : val });
  const setRoleVisibility = (val: any) => dispatch({ roleVisibility: typeof val === 'function' ? val(state.roleVisibility) : val });
  const setActiveRoleVisKey = (val: any) => dispatch({ activeRoleVisKey: typeof val === 'function' ? val(state.activeRoleVisKey) : val });
  const setSupervisorAccessOverrides = (val: any) => dispatch({ supervisorAccessOverrides: typeof val === 'function' ? val(state.supervisorAccessOverrides) : val });
  const setSelectedSupervisorId = (val: any) => dispatch({ selectedSupervisorId: typeof val === 'function' ? val(state.selectedSupervisorId) : val });
  const setFeatureFlags = (val: any) => dispatch({ featureFlags: typeof val === 'function' ? val(state.featureFlags) : val });
  const setUserFeatureFlags = (val: any) => dispatch({ userFeatureFlags: typeof val === 'function' ? val(state.userFeatureFlags) : val });
  const setAdminDelegatedFlags = (val: any) => dispatch({ adminDelegatedFlags: typeof val === 'function' ? val(state.adminDelegatedFlags) : val });
  const setActiveFlagKey = (val: any) => dispatch({ activeFlagKey: typeof val === 'function' ? val(state.activeFlagKey) : val });
  const setTempAccess = (val: any) => dispatch({ tempAccess: typeof val === 'function' ? val(state.tempAccess) : val });
  const setTempSubmitting = (val: any) => dispatch({ tempSubmitting: typeof val === 'function' ? val(state.tempSubmitting) : val });
  const setTempForm = (val: any) => dispatch({ tempForm: typeof val === 'function' ? val(state.tempForm) : val });
  const setSubmitting = (val: any) => dispatch({ submitting: typeof val === 'function' ? val(state.submitting) : val });
  const setIsCodenameEditable = (val: any) => dispatch({ isCodenameEditable: typeof val === 'function' ? val(state.isCodenameEditable) : val });
  const setActiveSubTab = (val: any) => {
    const nextTab = typeof val === 'function' ? val(state.activeSubTab) : val;
    if (typeof window !== 'undefined' && nextTab) {
      try {
        localStorage.setItem('settings_active_subtab', nextTab);
      } catch {}
    }
    dispatch({ activeSubTab: nextTab });
  };
  const setCurrentTimestamp = (val: any) => dispatch({ currentTimestamp: typeof val === 'function' ? val(state.currentTimestamp) : val });

  return { state, dispatch,
    editUsername: state.editUsername,
    setEditUsername,
    editFullName: state.editFullName,
    setEditFullName,
    editJobRole: state.editJobRole,
    setEditJobRole,
    editWorkingHours: state.editWorkingHours,
    setEditWorkingHours,
    editBreakTime: state.editBreakTime,
    setEditBreakTime,
    profileSignInTime: state.profileSignInTime,
    setProfileSignInTime,
    profileSignOutTime: state.profileSignOutTime,
    setProfileSignOutTime,
    editHasChutiAccess: state.editHasChutiAccess,
    setEditHasChutiAccess,
    editNeedsApproval: state.editNeedsApproval,
    setEditNeedsApproval,
    editSupervisorIds: state.editSupervisorIds as string[],
    setEditSupervisorIds,
    editEligibleOfficeLeave: state.editEligibleOfficeLeave,
    setEditEligibleOfficeLeave,
    editEligibleGovtHoliday: state.editEligibleGovtHoliday,
    setEditEligibleGovtHoliday,
    editAllowOvertime: state.editAllowOvertime,
    setEditAllowOvertime,
    editAllowReserve: state.editAllowReserve,
    setEditAllowReserve,
    editHasQuotesAccess: state.editHasQuotesAccess,
    setEditHasQuotesAccess,
    editAllowedTypes: state.editAllowedTypes as string[],
    setEditAllowedTypes,
    editCanManageRules: state.editCanManageRules,
    setEditCanManageRules,
    editKpiSkills: state.editKpiSkills as string[],
    setEditKpiSkills,
    editKpiDeptIndicators: state.editKpiDeptIndicators as string[],
    setEditKpiDeptIndicators,
    editKpiOtherDeptIndicators: state.editKpiOtherDeptIndicators as string[],
    setEditKpiOtherDeptIndicators,
    editPerformsDataEntry: state.editPerformsDataEntry,
    setEditPerformsDataEntry,
    editDepartment: state.editDepartment,
    setEditDepartment,
    editPerformsOtherDeptTasks: state.editPerformsOtherDeptTasks,
    setEditPerformsOtherDeptTasks,
    editOtherDepartment: state.editOtherDepartment,
    setEditOtherDepartment,
    editDelegatedLeaveSupervisorId: state.editDelegatedLeaveSupervisorId,
    setEditDelegatedLeaveSupervisorId,
    editDelegatedKpiSupervisorId: state.editDelegatedKpiSupervisorId,
    setEditDelegatedKpiSupervisorId,
    newPassword: state.newPassword,
    setNewPassword,
    confirmNewPassword: state.confirmNewPassword,
    setConfirmNewPassword,
    passwordSubmitting: state.passwordSubmitting,
    setPasswordSubmitting,
    showPasswordFields: state.showPasswordFields,
    setShowPasswordFields,
    syncedProfileId: state.syncedProfileId,
    setSyncedProfileId,
    sanitizerRules: state.sanitizerRules as SanitizerRule[],
    setSanitizerRules,
    sanitizerInput: state.sanitizerInput,
    setSanitizerInput,
    sanitizerSubmitting: state.sanitizerSubmitting,
    setSanitizerSubmitting,
    roleVisibility: state.roleVisibility,
    setRoleVisibility,
    activeRoleVisKey: state.activeRoleVisKey,
    setActiveRoleVisKey,
    supervisorAccessOverrides: state.supervisorAccessOverrides,
    setSupervisorAccessOverrides,
    selectedSupervisorId: state.selectedSupervisorId,
    setSelectedSupervisorId,
    featureFlags: state.featureFlags,
    setFeatureFlags,
    userFeatureFlags: state.userFeatureFlags,
    setUserFeatureFlags,
    adminDelegatedFlags: state.adminDelegatedFlags,
    setAdminDelegatedFlags,
    activeFlagKey: state.activeFlagKey,
    setActiveFlagKey,
    tempAccess: state.tempAccess as TempAccessEntry[],
    setTempAccess,
    tempSubmitting: state.tempSubmitting,
    setTempSubmitting,
    tempForm: state.tempForm,
    setTempForm,
    submitting: state.submitting,
    setSubmitting,
    isCodenameEditable: state.isCodenameEditable,
    setIsCodenameEditable,
    activeSubTab: state.activeSubTab,
    setActiveSubTab,
    currentTimestamp: state.currentTimestamp,
    setCurrentTimestamp,
  };
}
