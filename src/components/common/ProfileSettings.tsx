'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { User, AlertTriangle, RefreshCw, Settings, Key, Layout, Shield, FileText, Globe, Trash2, Users, Activity, ScrollText } from 'lucide-react';
import { UserManagementDashboard } from '@/components/common/UserManagementDashboard';
import { AuditLogsPanel } from '@/components/common/AuditLogsPanel';
import { Profile } from '@/types';
import { isSuperadmin, isAdminRole, isTabVisibleForRole, isFeatureEnabled, canAdminManageFeatureFlag, isAdminDelegatedFeature } from '@/utils/permissionService';
import { StaffSettingsForm } from '@/components/leave-tracker/StaffSettingsForm';
import SupabaseUsageWidget from '@/components/common/user-management/SupabaseUsageWidget';
import { supabase } from '@/utils/supabase';
import toast from 'react-hot-toast';
import { DateTimeInput } from '@/components/common/DateTimeInput';
import { SanitizerRule, resolveSanitizerRules } from '@/utils/fileNameSanitizer';
import { TempAccessEntry, DEFAULT_VPN_LIST } from '@/utils/dashboardHelpers';
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

interface ProfileSettingsProps {
  profile: Profile | null;
  setProfile: (profile: Profile | null) => void;
  sessionUser: any;
  onBack?: () => void;
}

export function ProfileSettings({
  profile,
  setProfile,
  sessionUser,
}: ProfileSettingsProps) {
  // Input fields state (seeded synchronously from profile to prevent initial render flicker)
  const [editUsername, setEditUsername] = useState(() => profile?.username || '');
  const [editFullName, setEditFullName] = useState(() => profile?.full_name || '');
  const [editJobRole, setEditJobRole] = useState(() => profile?.job_role || '');
  const [editWorkingHours, setEditWorkingHours] = useState(() => Number(profile?.working_hours ?? 9.5).toFixed(1));
  const [editBreakTime, setEditBreakTime] = useState(() => (profile?.break_time ?? 0).toString());
  const [profileSignInTime, setProfileSignInTime] = useState(() => profile?.default_sign_in || '');
  const [profileSignOutTime, setProfileSignOutTime] = useState(() => profile?.default_sign_out || '');

  // Workspace & KPI settings state
  const [editHasChutiAccess, setEditHasChutiAccess] = useState(() => profile?.has_chuti_access !== false);
  const [editNeedsApproval, setEditNeedsApproval] = useState(() => profile?.needs_supervisor_approval !== false);
  const [editSupervisorIds, setEditSupervisorIds] = useState<string[]>(() => profile?.supervisor_ids || []);
  const [editEligibleOfficeLeave, setEditEligibleOfficeLeave] = useState(() => profile?.eligible_office_leave !== false);
  const [editEligibleGovtHoliday, setEditEligibleGovtHoliday] = useState(() => profile?.eligible_govt_holiday !== false);
  const [editAllowOvertime, setEditAllowOvertime] = useState(() => !!profile?.allow_overtime);
  const [editAllowReserve, setEditAllowReserve] = useState(() => !!profile?.allow_reserve);
  const [editHasQuotesAccess, setEditHasQuotesAccess] = useState(() => profile?.has_quotes_access !== false);
  const [editAllowedTypes, setEditAllowedTypes] = useState<string[]>(() => profile?.allowed_types || []);
  const [editCanManageRules, setEditCanManageRules] = useState(() => !!profile?.can_manage_rules);
  const [editKpiSkills, setEditKpiSkills] = useState<string[]>(() => profile?.global_settings?.kpi_skills || []);
  const [editKpiDeptIndicators, setEditKpiDeptIndicators] = useState<string[]>(() => profile?.global_settings?.kpi_dept_indicators || []);
  const [editKpiOtherDeptIndicators, setEditKpiOtherDeptIndicators] = useState<string[]>(() => profile?.global_settings?.kpi_other_dept_indicators || []);
  const [editPerformsDataEntry, setEditPerformsDataEntry] = useState(() => profile?.global_settings?.performs_data_entry !== false);
  const [editDepartment, setEditDepartment] = useState(() => profile?.global_settings?.department || 'Data Entry');
  const [editPerformsOtherDeptTasks, setEditPerformsOtherDeptTasks] = useState(() => !!profile?.global_settings?.performs_other_dept_tasks);
  const [editOtherDepartment, setEditOtherDepartment] = useState(() => profile?.global_settings?.other_department || 'IT');
  const [editDelegatedLeaveSupervisorId, setEditDelegatedLeaveSupervisorId] = useState<string | null>(() => profile?.delegated_leave_supervisor_id || null);
  const [editDelegatedKpiSupervisorId, setEditDelegatedKpiSupervisorId] = useState<string | null>(() => profile?.delegated_kpi_supervisor_id || null);

  // Password fields state
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  const [showPasswordFields, setShowPasswordFields] = useState(false);

  // Hidden tabs (for admin menu visibility)
  const [hiddenTabs, setHiddenTabs] = useState<string[]>(() => profile?.global_settings?.hidden_tabs || []);

  // Tracking profile synchronization state to prevent brief hasChanges flicker on reload
  const [syncedProfileId, setSyncedProfileId] = useState<string | null>(() => profile?.id || null);

  // Sanitizer rules (superadmin-only filename cleaner config; word + enabled).
  // Seeded from the built-in defaults so the list is never empty.
  const [sanitizerRules, setSanitizerRules] = useState<SanitizerRule[]>([]);
  const [sanitizerInput, setSanitizerInput] = useState('');
  const [sanitizerSubmitting, setSanitizerSubmitting] = useState(false);

  // Per-role tab visibility (superadmin-only Tab Access matrix).
  // Shape: { [role]: { [tabKey]: boolean } } — false = hidden for that role.
  const [roleVisibility, setRoleVisibility] = useState<Record<string, Record<string, boolean>>>({});
  const [activeRoleVisKey, setActiveRoleVisKey] = useState<string | null>(null);

  // Per-supervisor specific access overrides
  const [supervisorAccessOverrides, setSupervisorAccessOverrides] = useState<Record<string, Record<string, boolean>>>(
    () => profile?.global_settings?.supervisor_access_overrides || {}
  );
  const [selectedSupervisorId, setSelectedSupervisorId] = useState<string>('');

  const handleToggleSupervisorOverride = async (supervisorId: string, tabKey: string, enabled: boolean) => {
    if (!profile) return;
    if (!isAdminRole(profile)) {
      toast.error('Only Admin or Superadmin can configure supervisor access overrides.');
      return;
    }
    try {
      const currentOverrides = { ...(supervisorAccessOverrides[supervisorId] || {}) };
      currentOverrides[tabKey] = enabled;
      const nextAllOverrides = {
        ...supervisorAccessOverrides,
        [supervisorId]: currentOverrides,
      };

      const baseGs = (profile.global_settings && typeof profile.global_settings === 'object')
        ? profile.global_settings
        : {};

      const updatedGs = {
        ...baseGs,
        supervisor_access_overrides: nextAllOverrides,
      };

      const { error } = await supabase
        .from('profiles')
        .update({ global_settings: updatedGs })
        .eq('id', sessionUser?.id || profile.id);

      if (error) throw error;

      setSupervisorAccessOverrides(nextAllOverrides);
      const updatedProfile = { ...profile, global_settings: updatedGs };
      setProfile(updatedProfile);
      if (sessionUser) {
        localStorage.setItem(`cached_profile_${sessionUser.id}`, JSON.stringify(updatedProfile));
      }
      window.dispatchEvent(new CustomEvent('profile-updated', { detail: updatedProfile }));
      toast.success('Supervisor access override updated!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update supervisor access override');
    }
  };

  // Feature flags (superadmin-only by default, delegated operational flags available to admins).
  const [featureFlags, setFeatureFlags] = useState<Record<string, boolean>>({});
  const [userFeatureFlags, setUserFeatureFlags] = useState<Record<string, boolean>>(() => profile?.global_settings?.user_feature_flags || {});
  const [adminDelegatedFlags, setAdminDelegatedFlags] = useState<Record<string, boolean>>({});
  const [activeFlagKey, setActiveFlagKey] = useState<string | null>(null);

  const { profilesList, refreshProfiles } = useProfiles();
  const superadminProfile = useMemo(() => profilesList.find((p) => p.role === 'superadmin'), [profilesList]);

  // Dynamic access check for each Settings subtab (superadmin always sees everything, otherwise role_visibility / isTabVisibleForRole)
  const canSeeProfile = useMemo(() => isSuperadmin(profile) || isTabVisibleForRole(profile, 'settings_profile', profile?.global_settings), [profile]);
  const canSeeUserManagement = useMemo(() => isAdminRole(profile) || profile?.role === 'supervisor', [profile]);
  const canSeeAuditLogs = useMemo(() => isAdminRole(profile), [profile]);
  const canSeeMenu = useMemo(() => true, []); // Navigation Menu Visibility subtab is available for all users to customize their personal workflow
  const canSeeSanitizer = useMemo(() => isSuperadmin(profile) || isTabVisibleForRole(profile, 'settings_sanitizer', profile?.global_settings), [profile]);
  const canSeeAccess = useMemo(() => isSuperadmin(profile) || isTabVisibleForRole(profile, 'settings_access', profile?.global_settings), [profile]);
  const canSeeFeatureFlags = useMemo(() => isSuperadmin(profile) || isTabVisibleForRole(profile, 'settings_feature_flags', profile?.global_settings), [profile]);
  const canSeeSystemHealth = useMemo(() => isSuperadmin(profile) || isFeatureEnabled('system_health_metrics', profile?.global_settings, profile), [profile]);
  const canSeeVpn = useMemo(() => isSuperadmin(profile) || isTabVisibleForRole(profile, 'settings_vpn', profile?.global_settings), [profile]);

  // Derived effective admin delegated flags (combines superadmin profile settings with local state and current profile)
  const effectiveAdminDelegatedFlags = useMemo(() => {
    const saFlags = superadminProfile?.global_settings?.admin_delegated_flags;
    const userFlags = profile?.global_settings?.admin_delegated_flags;
    return { ...(userFlags || {}), ...(saFlags || {}), ...(adminDelegatedFlags || {}) };
  }, [superadminProfile, profile, adminDelegatedFlags]);

  // Temporary access controls (superadmin-only, time-boxed per-role overrides).
  const [tempAccess, setTempAccess] = useState<TempAccessEntry[]>([]);
  const [tempSubmitting, setTempSubmitting] = useState(false);
  const [tempForm, setTempForm] = useState<{
    target_type: 'role' | 'user';
    user_id: string;
    user_codename: string;
    role: string;
    tabKey: string;
    action: 'grant' | 'revoke';
    expires_at: string;
    comment: string;
  }>({
    target_type: 'role',
    user_id: '',
    user_codename: '',
    role: 'user',
    tabKey: MENU_TABS[0]?.key || '',
    action: 'revoke',
    expires_at: '',
    comment: '',
  });

  // Setup submissions state
  const [submitting, setSubmitting] = useState(false);
  const [isCodenameEditable, setIsCodenameEditable] = useState(false);

  // VPN List state (managed for Quotes Copy Helper)
  const [vpnList, setVpnList] = useState<string[]>(() => profile?.global_settings?.vpn_list || DEFAULT_VPN_LIST);
  const [newVpnInput, setNewVpnInput] = useState('');
  const [vpnSubmitting, setVpnSubmitting] = useState(false);

  // Subtabs state (Profile / User Management / Audit Logs / Menu / Sanitizer / Access / Feature Flags / Database Health / VPN)
  const [activeSubTab, setActiveSubTab] = useState<'profile' | 'user_management' | 'audit_logs' | 'menu_visibility' | 'sanitizer' | 'access_controls' | 'feature_flags' | 'system_health' | 'vpn_list'>(() => {
    try {
      const saved = localStorage.getItem('settings_active_subtab');
      if (saved === 'profile' || saved === 'user_management' || saved === 'audit_logs' || saved === 'menu_visibility' || saved === 'sanitizer' || saved === 'access_controls' || saved === 'feature_flags' || saved === 'system_health' || saved === 'vpn_list') {
        return saved as any;
      }
    } catch {}
    return 'profile';
  });

  useEffect(() => {
    const handleSubTabEvent = (e: Event) => {
      const tab = (e as CustomEvent).detail;
      if (tab) {
        setActiveSubTab(tab as any);
        localStorage.setItem('settings_active_subtab', tab);
      }
    };
    window.addEventListener('settings-subtab-change', handleSubTabEvent);
    return () => window.removeEventListener('settings-subtab-change', handleSubTabEvent);
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
    } else if (activeSubTab === 'system_health' && !canSeeSystemHealth) {
      setActiveSubTab('profile');
      localStorage.setItem('settings_active_subtab', 'profile');
    } else if (activeSubTab === 'vpn_list' && !canSeeVpn) {
      setActiveSubTab('profile');
      localStorage.setItem('settings_active_subtab', 'profile');
    } else if (activeSubTab === 'menu_visibility' && !canSeeMenu) {
      setActiveSubTab('profile');
      localStorage.setItem('settings_active_subtab', 'profile');
    }
  }, [profile, activeSubTab, canSeeSanitizer, canSeeAccess, canSeeFeatureFlags, canSeeSystemHealth, canSeeVpn, canSeeMenu]);

  const handleSubTabChange = (tab: 'profile' | 'user_management' | 'audit_logs' | 'menu_visibility' | 'sanitizer' | 'access_controls' | 'feature_flags' | 'system_health' | 'vpn_list') => {
    setActiveSubTab(tab);
    localStorage.setItem('settings_active_subtab', tab);
  };

  const handleSaveVpnList = async (nextVpnList: string[]) => {
    if (!profile) return;
    setVpnSubmitting(true);
    try {
      // 1. Attempt atomic jsonb_set RPC across all profiles
      const { error: rpcError } = await supabase.rpc('set_user_vpn_list' as any, {
        p_vpn_list: nextVpnList
      });

      let updatedGs = {
        ...(profile.global_settings || {}),
        vpn_list: nextVpnList,
      };

      if (rpcError) {
        // Fallback: fetch fresh global_settings from DB to avoid overwriting concurrent changes
        const { data: fresh } = await supabase
          .from('profiles')
          .select('global_settings')
          .eq('id', sessionUser?.id || profile.id)
          .maybeSingle();

        updatedGs = {
          ...((fresh?.global_settings as Record<string, any>) || profile.global_settings || {}),
          vpn_list: nextVpnList,
        };

        const { error } = await supabase
          .from('profiles')
          .update({ global_settings: updatedGs })
          .eq('id', sessionUser?.id || profile.id);
        if (error) throw error;
      }

      setVpnList(nextVpnList);
      const updatedProfile = { ...profile, global_settings: updatedGs };
      setProfile(updatedProfile);
      if (sessionUser) {
        localStorage.setItem(`cached_profile_${sessionUser.id}`, JSON.stringify(updatedProfile));
      }
      window.dispatchEvent(new CustomEvent('profile-updated', { detail: updatedProfile }));
      toast.success('VPN List updated successfully!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update VPN List');
    } finally {
      setVpnSubmitting(false);
    }
  };

  const handleAddVpnName = () => {
    const val = newVpnInput.trim();
    if (!val) return;
    if (vpnList.some(v => v.toLowerCase() === val.toLowerCase())) {
      toast.error('VPN name already exists in list');
      return;
    }
    const nextList = [...vpnList, val];
    setNewVpnInput('');
    handleSaveVpnList(nextList);
  };

  const handleRemoveVpnName = (nameToRemove: string) => {
    const nextList = vpnList.filter(v => v !== nameToRemove);
    handleSaveVpnList(nextList);
  };

  // Unified menu authorization rules (synchronized with UnifiedSidebar.tsx)
  const isSuperAdmin = isSuperadmin(profile);
  const showTodoTab = isSuperadmin(profile);
  const hasChutiAccess = !!profile?.has_chuti_access;
  const hasQuotesAccess = !!profile?.has_quotes_access;

  const isTabAuthorized = (key: string): boolean => {
    if (!profile) return false;
    switch (key) {
      // Main Sections
      case 'kpi':
        return true;
      case 'todo':
        return showTodoTab;
      case 'leaderboard':
        return true;
      case 'user_management':
        return isAdminRole(profile) || profile.role === 'supervisor';
      case 'audit_logs':
        return isAdminRole(profile);

      // Quotes Tracker Subtabs
      case 'copy_helper':
        return hasQuotesAccess; // available to all authenticated quotes users
      case 'save_file':
        return hasQuotesAccess && isSuperAdmin;
      case 'monthly':
      case 'rules':
      case 'login_codes':
      case 'causality':
        return hasQuotesAccess;

      // Leave Tracker Subtabs
      case 'leave_history':
        return hasChutiAccess;
      case 'team_leaves':
        return hasChutiAccess && (isAdminRole(profile) || profile.role === 'supervisor');
      case 'govt_responses':
      case 'settlement':
      case 'leave_settings':
        return hasChutiAccess && isAdminRole(profile);

      default:
        return false;
    }
  };

  // Initialize fields
  useEffect(() => {
    if (profile) {
      setEditUsername(profile.username || '');
      setEditFullName(profile.full_name || '');
      setEditJobRole(profile.job_role || '');
      setEditWorkingHours(Number(profile.working_hours ?? 9.5).toFixed(1));
      setEditBreakTime((profile.break_time ?? 0).toString());
      setProfileSignInTime(profile.default_sign_in || '');
      setProfileSignOutTime(profile.default_sign_out || '');
      setEditHasChutiAccess(profile.has_chuti_access !== false);
      setEditNeedsApproval(profile.needs_supervisor_approval !== false);
      setEditSupervisorIds(profile.supervisor_ids || []);
      setEditEligibleOfficeLeave(profile.eligible_office_leave !== false);
      setEditEligibleGovtHoliday(profile.eligible_govt_holiday !== false);
      setEditAllowOvertime(!!profile.allow_overtime);
      setEditAllowReserve(!!profile.allow_reserve);
      setEditHasQuotesAccess(profile.has_quotes_access !== false);
      setEditAllowedTypes(profile.allowed_types || []);
      setEditCanManageRules(!!profile.can_manage_rules);
      setEditKpiSkills(profile.global_settings?.kpi_skills || []);
      setEditKpiDeptIndicators(profile.global_settings?.kpi_dept_indicators || []);
      setEditKpiOtherDeptIndicators(profile.global_settings?.kpi_other_dept_indicators || []);
      setEditPerformsDataEntry(profile.global_settings?.performs_data_entry !== false);
      setEditDepartment(profile.global_settings?.department || 'Data Entry');
      setEditPerformsOtherDeptTasks(!!profile.global_settings?.performs_other_dept_tasks);
      setEditOtherDepartment(profile.global_settings?.other_department || 'IT');
      setEditDelegatedLeaveSupervisorId(profile.delegated_leave_supervisor_id || null);
      setEditDelegatedKpiSupervisorId(profile.delegated_kpi_supervisor_id || null);
      setHiddenTabs(profile.global_settings?.hidden_tabs || []);
      // Seed from defaults + any saved rules/legacy words so the list is never empty.
      setSanitizerRules(
        resolveSanitizerRules(
          profile.global_settings?.sanitizer_rules,
          profile.global_settings?.sanitizer_words
        )
      );
      setRoleVisibility(
        (profile.global_settings?.role_visibility &&
          typeof profile.global_settings.role_visibility === 'object')
          ? profile.global_settings.role_visibility
          : {}
      );
      setFeatureFlags(
        (profile.global_settings?.feature_flags &&
          typeof profile.global_settings.feature_flags === 'object')
          ? profile.global_settings.feature_flags
          : {}
      );
      setUserFeatureFlags(profile.global_settings?.user_feature_flags || {});
      setAdminDelegatedFlags(
        (profile.global_settings?.admin_delegated_flags &&
          typeof profile.global_settings.admin_delegated_flags === 'object')
          ? profile.global_settings.admin_delegated_flags
          : {}
      );
      setSupervisorAccessOverrides(
        (profile.global_settings?.supervisor_access_overrides &&
          typeof profile.global_settings.supervisor_access_overrides === 'object')
          ? profile.global_settings.supervisor_access_overrides
          : {}
      );
      setTempAccess(
        Array.isArray(profile.global_settings?.temp_access)
          ? profile.global_settings.temp_access
          : []
      );
      setSyncedProfileId(profile.id);
    }
  }, [profile, sessionUser]);

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
    const isHiddenTabsChanged = JSON.stringify([...hiddenTabs].sort()) !== JSON.stringify([...(profile.global_settings?.hidden_tabs || [])].sort());

    return isUsernameChanged || isFullNameChanged || isWorkingHoursChanged || isBreakTimeChanged ||
           isJobRoleChanged || isSignInChanged || isSignOutChanged || isHasChutiAccessChanged ||
           isNeedsApprovalChanged || isSupervisorIdsChanged || isEligibleOfficeLeaveChanged ||
           isEligibleGovtHolidayChanged || isAllowOvertimeChanged || isAllowReserveChanged ||
           isHasQuotesAccessChanged || isAllowedTypesChanged || isCanManageRulesChanged ||
           isKpiSkillsChanged || isKpiDeptIndicatorsChanged || isKpiOtherDeptIndicatorsChanged ||
           isPerformsDataEntryChanged || isDepartmentChanged || isPerformsOtherDeptTasksChanged ||
           isOtherDepartmentChanged || isDelegatedLeaveSupervisorIdChanged || isDelegatedKpiSupervisorIdChanged ||
           isUserFeatureFlagsChanged || isHiddenTabsChanged;
  }, [
    profile, syncedProfileId, editUsername, editFullName, editWorkingHours, editBreakTime, editJobRole,
    profileSignInTime, profileSignOutTime, editHasChutiAccess, editNeedsApproval, editSupervisorIds,
    editEligibleOfficeLeave, editEligibleGovtHoliday, editAllowOvertime, editAllowReserve, editHasQuotesAccess,
    editAllowedTypes, editCanManageRules, editKpiSkills, editKpiDeptIndicators, editKpiOtherDeptIndicators,
    editPerformsDataEntry, editDepartment, editPerformsOtherDeptTasks, editOtherDepartment,
    editDelegatedLeaveSupervisorId, editDelegatedKpiSupervisorId, userFeatureFlags, hiddenTabs
  ]);



  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword) {
      toast.error('Password cannot be empty');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setPasswordSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        toast.error(error.message);
      } else {
        toast.success('Password updated successfully!');
        setNewPassword('');
        setConfirmNewPassword('');
        setShowPasswordFields(false);
      }
    } catch (err: any) {
      toast.error(err.message || 'An error occurred');
    } finally {
      setPasswordSubmitting(false);
    }
  };

  const handleSaveSettings = async (e?: React.SyntheticEvent) => {
    if (e) e.preventDefault();
    if (!sessionUser || !profile) return;
    setSubmitting(true);

    try {
      // Helper to retrieve fresh global_settings from DB before updating, preventing stale state overwrites
      const fetchFreshGs = async () => {
        const { data: fresh } = await supabase
          .from('profiles')
          .select('global_settings')
          .eq('id', sessionUser.id)
          .maybeSingle();
        return (fresh?.global_settings as Record<string, any>) || profile.global_settings || {};
      };

      if (activeSubTab === 'menu_visibility') {
        const { error: rpcErr } = await supabase.rpc('set_user_hidden_tabs' as any, {
          p_user_id: sessionUser.id,
          p_hidden_tabs: hiddenTabs
        });

        let updatedGs = {
          ...(profile.global_settings || {}),
          hidden_tabs: hiddenTabs
        };

        if (rpcErr) {
          const freshGs = await fetchFreshGs();
          updatedGs = {
            ...freshGs,
            hidden_tabs: hiddenTabs
          };

          const { error: updateErr } = await supabase
            .from('profiles')
            .update({ global_settings: updatedGs })
            .eq('id', sessionUser.id);
          if (updateErr) throw updateErr;
        }

        const mergedProfile = { ...profile, global_settings: updatedGs };
        setProfile(mergedProfile);
        localStorage.setItem(`cached_profile_${sessionUser.id}`, JSON.stringify(mergedProfile));
        window.dispatchEvent(new CustomEvent("profile-updated", { detail: mergedProfile }));
        await refreshProfiles({ force: true });
        toast.success('Your menu visibility settings successfully updated!');
        return;
      }

      const freshGs = await fetchFreshGs();
      const globalSettingsUpdate = {
        ...freshGs,
        hidden_tabs: hiddenTabs,
        user_feature_flags: userFeatureFlags,
        kpi_skills: editKpiSkills,
        kpi_dept_indicators: editKpiDeptIndicators,
        kpi_other_dept_indicators: editKpiOtherDeptIndicators,
        performs_data_entry: editPerformsDataEntry,
        department: editDepartment,
        performs_other_dept_tasks: editPerformsOtherDeptTasks,
        other_department: editOtherDepartment,
      };

      if (isAdminRole(profile)) {
        const updates: any = {
          username: editUsername.toUpperCase().trim(),
          full_name: editFullName,
          working_hours: parseFloat(editWorkingHours) || 9.5,
          break_time: parseInt(editBreakTime) || 0,
          job_role: editJobRole,
          default_sign_in: profileSignInTime,
          default_sign_out: profileSignOutTime,
          has_chuti_access: editHasChutiAccess,
          needs_supervisor_approval: editNeedsApproval,
          supervisor_ids: editSupervisorIds,
          eligible_office_leave: editEligibleOfficeLeave,
          eligible_govt_holiday: editEligibleGovtHoliday,
          allow_overtime: editAllowOvertime,
          allow_reserve: editAllowReserve,
          has_quotes_access: editHasQuotesAccess,
          allowed_types: editAllowedTypes,
          can_manage_rules: editCanManageRules,
          delegated_leave_supervisor_id: editDelegatedLeaveSupervisorId,
          delegated_kpi_supervisor_id: editDelegatedKpiSupervisorId,
          global_settings: globalSettingsUpdate
        };

        const { data: updatedProfile, error } = await supabase
          .from('profiles')
          .update(updates)
          .eq('id', sessionUser.id)
          .select()
          .single();

        if (error) throw error;

        setProfile({ ...profile, ...updatedProfile });
        localStorage.setItem(`cached_profile_${sessionUser.id}`, JSON.stringify({ ...profile, ...updatedProfile }));
        window.dispatchEvent(new CustomEvent("profile-updated", { detail: { ...profile, ...updatedProfile } }));
        await refreshProfiles({ force: true });
        toast.success('Your profile settings successfully updated!');
      } else {
        if (!profile.has_edited_profile) {
          const updates = {
            full_name: editFullName,
            working_hours: parseFloat(editWorkingHours) || 9.5,
            break_time: parseInt(editBreakTime) || 0,
            job_role: editJobRole,
            default_sign_in: profileSignInTime,
            default_sign_out: profileSignOutTime,
            has_edited_profile: true,
            global_settings: globalSettingsUpdate
          };

          const { data: updatedProfile, error } = await supabase
            .from('profiles')
            .update(updates)
            .eq('id', sessionUser.id)
            .select()
            .single();

          if (error) throw error;

          setProfile({ ...profile, ...updatedProfile });
          localStorage.setItem(`cached_profile_${sessionUser.id}`, JSON.stringify({ ...profile, ...updatedProfile }));
          window.dispatchEvent(new CustomEvent("profile-updated", { detail: { ...profile, ...updatedProfile } }));
          toast.success('Your profile settings successfully updated!');
        } else {
          // Check if profile fields (that require approval) changed
          const hasProfileFieldChanges =
            editFullName.trim() !== (profile.full_name || '').trim() ||
            (parseFloat(editWorkingHours) || 9.5) !== (profile.working_hours ?? 9.5) ||
            (parseInt(editBreakTime) || 0) !== (profile.break_time ?? 0) ||
            editJobRole.trim() !== (profile.job_role || '').trim() ||
            (profileSignInTime || '') !== (profile.default_sign_in || '') ||
            (profileSignOutTime || '') !== (profile.default_sign_out || '');

          const updates: any = {
            global_settings: globalSettingsUpdate
          };

          if (hasProfileFieldChanges) {
            updates.requested_full_name = editFullName;
            updates.requested_working_hours = parseFloat(editWorkingHours) || 9.5;
            updates.requested_break_time = parseInt(editBreakTime) || 0;
            updates.requested_job_role = editJobRole;
            updates.requested_default_sign_in = profileSignInTime;
            updates.requested_default_sign_out = profileSignOutTime;
            updates.profile_change_status = 'pending';
          }

          const { data: updatedProfile, error } = await supabase
            .from('profiles')
            .update(updates)
            .eq('id', sessionUser.id)
            .select()
            .single();

          if (error) throw error;

          setProfile({ ...profile, ...updatedProfile });
          localStorage.setItem(`cached_profile_${sessionUser.id}`, JSON.stringify({ ...profile, ...updatedProfile }));
          window.dispatchEvent(new CustomEvent("profile-updated", { detail: { ...profile, ...updatedProfile } }));
          await refreshProfiles({ force: true });

          if (hasProfileFieldChanges) {
            toast.success('Profile change request has been sent to the admin.');
          } else {
            toast.success('Your menu visibility settings successfully updated!');
          }
        }
      }
    } catch (err: any) {
      let errorMsg = err.message || 'Update failed.';
      if (err.code === '23505' || errorMsg.toLowerCase().includes('duplicate')) {
        errorMsg = 'This codename is already in use!';
      }
      toast.error(errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveSanitizerRules = async (nextRules: SanitizerRule[]) => {
    if (!profile || !isSuperadmin(profile)) return;
    setSanitizerSubmitting(true);
    try {
      // RPC updates only the sanitizer_rules key across all profiles,
      // preserving every other per-user global_settings value.
      const { error } = await supabase.rpc('set_sanitizer_rules', { p_rules: nextRules });
      if (error) throw error;

      setSanitizerRules(nextRules);
      // Reflect locally so the current session's cleaner picks it up immediately.
      const updatedProfile = {
        ...profile,
        global_settings: { ...(profile.global_settings || {}), sanitizer_rules: nextRules },
      };
      setProfile(updatedProfile);
      localStorage.setItem(`cached_profile_${sessionUser.id}`, JSON.stringify(updatedProfile));
      window.dispatchEvent(new CustomEvent('profile-updated', { detail: updatedProfile }));
      toast.success('Sanitizer list updated.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update sanitizer list.');
    } finally {
      setSanitizerSubmitting(false);
    }
  };

  const handleAddSanitizerWord = () => {
    const word = sanitizerInput.trim();
    if (!word) return;
    if (sanitizerRules.some((r) => r.word.toLowerCase() === word.toLowerCase())) {
      toast.error('That word is already in the list.');
      return;
    }
    setSanitizerInput('');
    handleSaveSanitizerRules([...sanitizerRules, { word, enabled: true }]);
  };

  const handleToggleSanitizerWord = (word: string) => {
    handleSaveSanitizerRules(
      sanitizerRules.map((r) => (r.word === word ? { ...r, enabled: !r.enabled } : r))
    );
  };

  const handleRemoveSanitizerWord = (word: string) => {
    handleSaveSanitizerRules(sanitizerRules.filter((r) => r.word !== word));
  };

  // Toggle per-role tab visibility (superadmin). Sets explicit boolean (true/false).
  const handleToggleRoleVisibility = async (
    role: string,
    tabKey: string,
    nextVisible: boolean
  ) => {
    const itemKey = `${role}:${tabKey}`;
    if (!profile || !isSuperadmin(profile) || activeRoleVisKey === itemKey) return;

    const roleMap = { ...(roleVisibility[role] || {}), [tabKey]: nextVisible };
    const next: Record<string, Record<string, boolean>> = { ...roleVisibility, [role]: roleMap };

    setActiveRoleVisKey(itemKey);
    try {
      const { error } = await supabase.rpc('set_role_visibility', { p_visibility: next });
      if (error) throw error;
      setRoleVisibility(next);
      const updatedProfile = {
        ...profile,
        global_settings: { ...(profile.global_settings || {}), role_visibility: next },
      };
      setProfile(updatedProfile);
      localStorage.setItem(`cached_profile_${sessionUser.id}`, JSON.stringify(updatedProfile));
      window.dispatchEvent(new CustomEvent('profile-updated', { detail: updatedProfile }));
    } catch (err: any) {
      toast.error(err.message || 'Failed to update tab access.');
    } finally {
      setActiveRoleVisKey(null);
    }
  };

  // Toggle a feature flag (superadmin or admin with delegated permission). Syncs with per-role Tab Access if mapped to a tab.
  const handleToggleFeatureFlag = async (flagKey: string, nextEnabled: boolean) => {
    if (!profile || activeFlagKey === flagKey) return;
    if (!isSuperadmin(profile) && !canAdminManageFeatureFlag(profile, flagKey, profile.global_settings)) {
      toast.error('You do not have permission to manage this feature flag.');
      return;
    }

    const nextFlags = { ...featureFlags, [flagKey]: nextEnabled };
    const tabKey = FLAG_TO_TAB_KEY[flagKey];

    let nextRoleVis = { ...roleVisibility };
    if (tabKey) {
      const updatedRoles: Record<string, Record<string, boolean>> = { ...nextRoleVis };
      CONFIGURABLE_ROLES.forEach((role) => {
        const roleMap = { ...(updatedRoles[role] || {}), [tabKey]: nextEnabled };
        updatedRoles[role] = roleMap;
      });
      nextRoleVis = updatedRoles;
    }

    setActiveFlagKey(flagKey);
    try {
      const { error: flagErr } = await supabase.rpc('set_feature_flags', { p_flags: nextFlags });
      if (flagErr) throw flagErr;

      if (tabKey) {
        const { error: visErr } = await supabase.rpc('set_role_visibility', { p_visibility: nextRoleVis });
        if (visErr) console.error('Failed to sync role visibility:', visErr);
      }

      setFeatureFlags(nextFlags);
      if (tabKey) setRoleVisibility(nextRoleVis);

      const updatedProfile = {
        ...profile,
        global_settings: {
          ...(profile.global_settings || {}),
          feature_flags: nextFlags,
          ...(tabKey ? { role_visibility: nextRoleVis } : {}),
        },
      };
      setProfile(updatedProfile);
      localStorage.setItem(`cached_profile_${sessionUser.id}`, JSON.stringify(updatedProfile));
      window.dispatchEvent(new CustomEvent('profile-updated', { detail: updatedProfile }));
      await refreshProfiles({ force: true });
    } catch (err: any) {
      toast.error(err.message || 'Failed to update feature flag.');
    } finally {
      setActiveFlagKey(null);
    }
  };

  // Toggle admin delegation for a feature flag (superadmin only)
  const handleToggleAdminDelegation = async (flagKey: string, nextDelegated: boolean) => {
    if (!profile || !isSuperadmin(profile) || activeFlagKey === `delegate:${flagKey}`) return;

    const nextDelegatedFlags = { ...(effectiveAdminDelegatedFlags || {}), [flagKey]: nextDelegated };
    setActiveFlagKey(`delegate:${flagKey}`);
    try {
      // 1. Try set_admin_delegated_flags RPC first to replicate across all rows
      const { error: rpcErr } = await supabase.rpc('set_admin_delegated_flags' as any, { p_flags: nextDelegatedFlags });

      // 2. Fallback: update across all profiles if RPC function isn't created in DB yet
      if (rpcErr) {
        console.warn('set_admin_delegated_flags RPC fallback:', rpcErr.message);
        const updatedGs = {
          ...(profile.global_settings || {}),
          admin_delegated_flags: nextDelegatedFlags
        };
        const { error: updateErr } = await supabase
          .from('profiles')
          .update({ global_settings: updatedGs })
          .eq('id', sessionUser?.id || profile.id);
        if (updateErr) throw updateErr;
      }

      setAdminDelegatedFlags(nextDelegatedFlags);
      const updatedProfile = {
        ...profile,
        global_settings: {
          ...(profile.global_settings || {}),
          admin_delegated_flags: nextDelegatedFlags
        }
      };
      setProfile(updatedProfile);
      localStorage.setItem(`cached_profile_${sessionUser.id}`, JSON.stringify(updatedProfile));
      window.dispatchEvent(new CustomEvent('profile-updated', { detail: updatedProfile }));
      toast.success(nextDelegated ? `Admin allowed to manage ${flagKey}` : `Admin access revoked for ${flagKey}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update admin delegation.');
    } finally {
      setActiveFlagKey(null);
    }
  };

  const handleResetAllUserFeatureFlags = async () => {
    if (!profile || !isSuperadmin(profile)) return;
    setSubmitting(true);
    try {
      const { error: rpcErr } = await supabase.rpc('reset_all_user_feature_flags' as any);
      if (rpcErr) {
        console.warn('reset_all_user_feature_flags RPC fallback:', rpcErr.message);
        const { data: allProfiles } = await supabase.from('profiles').select('id, global_settings');
        if (allProfiles) {
          for (const p of allProfiles) {
            if (p.global_settings && typeof p.global_settings === 'object' && 'user_feature_flags' in p.global_settings) {
              const updatedGs = { ...(p.global_settings as Record<string, any>) };
              delete updatedGs.user_feature_flags;
              await supabase.from('profiles').update({ global_settings: updatedGs }).eq('id', p.id);
            }
          }
        }
      }

      // Update local profile state
      const cleanedGs = { ...(profile.global_settings || {}) };
      delete cleanedGs.user_feature_flags;
      const updatedProfile = { ...profile, global_settings: cleanedGs };
      setProfile(updatedProfile);
      if (sessionUser?.id) {
        localStorage.setItem(`cached_profile_${sessionUser.id}`, JSON.stringify(updatedProfile));
      }
      window.dispatchEvent(new CustomEvent('profile-updated', { detail: updatedProfile }));

      // Refresh shared profiles context across app
      await refreshProfiles({ force: true });

      toast.success('All individual user overrides reset to Inherit!');
    } catch (err: any) {
      toast.error('Failed to reset overrides: ' + (err?.message || String(err)));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveTempAccess = async (nextEntries: TempAccessEntry[]) => {
    if (!profile || !isSuperadmin(profile)) return;
    setTempSubmitting(true);
    try {
      const { error } = await supabase.rpc('set_temp_access', { p_entries: nextEntries });
      if (error) throw error;
      setTempAccess(nextEntries);
      const updatedProfile = {
        ...profile,
        global_settings: { ...(profile.global_settings || {}), temp_access: nextEntries },
      };
      setProfile(updatedProfile);
      localStorage.setItem(`cached_profile_${sessionUser.id}`, JSON.stringify(updatedProfile));
      window.dispatchEvent(new CustomEvent('profile-updated', { detail: updatedProfile }));
    } catch (err: any) {
      toast.error(err.message || 'Failed to update temporary access.');
    } finally {
      setTempSubmitting(false);
    }
  };

  const handleAddTempAccess = () => {
    if (tempForm.target_type === 'user' && !tempForm.user_id) {
      toast.error('Select a specific user.');
      return;
    }
    if (!tempForm.expires_at) {
      toast.error('Pick an expiry date/time.');
      return;
    }
    if (new Date(tempForm.expires_at).getTime() <= Date.now()) {
      toast.error('Expiry must be in the future.');
      return;
    }
    const now = Date.now();
    const kept = tempAccess.filter((t) => {
      if (new Date(t.expires_at).getTime() <= now) return false;
      if (tempForm.target_type === 'user') {
        return !(t.target_type === 'user' && (t.user_id === tempForm.user_id || t.user_codename === tempForm.user_codename) && t.tabKey === tempForm.tabKey);
      } else {
        return !((!t.target_type || t.target_type === 'role') && t.role === tempForm.role && t.tabKey === tempForm.tabKey);
      }
    });

    const targetUserObj = profilesList.find((p) => p.id === tempForm.user_id);
    const targetUserRole = targetUserObj?.role || 'user';
    const targetCodename = targetUserObj
      ? (targetUserObj.codename || targetUserObj.username || 'User')
      : tempForm.user_codename;
    const displayUserLabel = targetUserObj?.full_name
      ? `${targetCodename} (${targetUserObj.full_name})`
      : targetCodename;

    handleSaveTempAccess([
      ...kept,
      {
        target_type: tempForm.target_type,
        user_id: tempForm.target_type === 'user' ? tempForm.user_id : undefined,
        user_codename: tempForm.target_type === 'user' ? displayUserLabel : undefined,
        role: tempForm.target_type === 'user' ? targetUserRole : tempForm.role,
        tabKey: tempForm.tabKey,
        action: tempForm.action,
        expires_at: new Date(tempForm.expires_at).toISOString(),
        comment: tempForm.comment.trim() || undefined,
      },
    ]);
    setTempForm((f) => ({ ...f, comment: '' }));
  };

  const handleRemoveTempAccess = (entry: TempAccessEntry) => {
    handleSaveTempAccess(
      tempAccess.filter(
        (t) =>
          !(t.role === entry.role && t.tabKey === entry.tabKey && t.expires_at === entry.expires_at)
      )
    );
  };

  // Timestamp updated in effect to satisfy React compiler / react-hooks/purity rules
  const [currentTimestamp, setCurrentTimestamp] = useState<number>(() => Date.now());

  useEffect(() => {
    setCurrentTimestamp(Date.now());
  }, [tempAccess]);

  return (
    <div className="w-full space-y-6 font-sans">
      {/* Decorative background blobs */}
      <div className="absolute top-[-10%] right-[-15%] w-[45%] h-[45%] rounded-full bg-blue-900/5 blur-[90px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-15%] w-[35%] h-[35%] rounded-full bg-purple-900/5 blur-[70px] pointer-events-none" />


      {/* Subtab Navigation */}
      <div className="flex items-center gap-2 border-b border-theme-border-input/60 pb-3 overflow-x-auto max-w-full scrollbar-thin whitespace-nowrap pt-0.5">
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
            <span>Profile Settings</span>
          </button>
        )}

        {canSeeMenu && (
          <button
            type="button"
            onClick={() => handleSubTabChange('menu_visibility')}
            className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === 'menu_visibility'
                ? 'bg-amber-600/15 border border-amber-500/30 text-amber-400 shadow-sm'
                : 'text-theme-text-secondary hover:bg-theme-card-bg/60 border border-transparent'
            }`}
          >
            <Layout className="h-4 w-4 text-amber-400" />
            <span>Menu</span>
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

        {canSeeSystemHealth && (
          <button
            type="button"
            onClick={() => handleSubTabChange('system_health')}
            className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === 'system_health'
                ? 'bg-emerald-600/15 border border-emerald-500/30 text-emerald-400 shadow-sm'
                : 'text-theme-text-secondary hover:bg-theme-card-bg/60 border border-transparent'
            }`}
          >
            <Activity className="h-4 w-4 text-emerald-400" />
            <span>Database</span>
          </button>
        )}

        {canSeeVpn && (
          <button
            type="button"
            onClick={() => handleSubTabChange('vpn_list')}
            className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === 'vpn_list'
                ? 'bg-blue-600/15 border border-blue-500/30 text-blue-400 shadow-sm'
                : 'text-theme-text-secondary hover:bg-theme-card-bg/60 border border-transparent'
            }`}
          >
            <Globe className="h-4 w-4 text-blue-400" />
            <span>VPN</span>
          </button>
        )}

        {canSeeAuditLogs && (
          <button
            type="button"
            onClick={() => handleSubTabChange('audit_logs')}
            className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === 'audit_logs'
                ? 'bg-orange-600/15 border border-orange-500/30 text-orange-400 shadow-sm'
                : 'text-theme-text-secondary hover:bg-theme-card-bg/60 border border-transparent'
            }`}
          >
            <ScrollText className="h-4 w-4 text-orange-400" />
            <span>Audit Logs</span>
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
            <span>User Management</span>
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
              isAdmin={isAdminRole(profile)}
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

          {/* Security & Password Section */}
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
      )}

      {/* Menu Visibility Configuration */}
      {activeSubTab === 'menu_visibility' && profile && (
        <div className="bg-theme-card-bg/40 rounded-2xl border border-theme-border-input/60 p-6 space-y-4 w-full">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
            {['Main Workspace Sections', 'Quotes Tracker Subtabs', 'Leave Tracker Subtabs'].map((category) => {
              // Single source of truth — the shared MENU_TABS registry.
              const options = MENU_TABS.filter(
                (opt) => opt.category === category && isTabAuthorized(opt.key)
              );

              if (options.length === 0) return null;

              return (
                <div key={category} className="space-y-2.5">
                  <span className="block text-[10px] font-bold text-theme-text-muted uppercase tracking-wider pl-1 border-l-2 border-blue-500/60">
                    {category}
                  </span>
                  <div className="flex flex-col gap-2">
                    {options.map((opt) => {
                      const isVisible = !hiddenTabs.includes(opt.key);
                      return (
                        <label
                          key={opt.key}
                          className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-all cursor-pointer select-none text-[11px] font-medium ${
                            isVisible
                              ? 'border-blue-500/20 bg-blue-955/20 text-theme-text-secondary hover:bg-blue-955/30'
                              : 'border-theme-border-muted/60 bg-theme-card-bg/30 text-theme-text-muted/70 hover:bg-theme-border-muted/20'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isVisible}
                            onChange={() => {
                              const newHidden = isVisible
                                ? [...hiddenTabs, opt.key]
                                : hiddenTabs.filter((k) => k !== opt.key);
                              setHiddenTabs(newHidden);
                            }}
                            className="rounded border-theme-border-active bg-theme-page-bg text-blue-600 accent-blue-600 focus:ring-blue-550 focus:ring-offset-theme-page-bg h-3.5 w-3.5 cursor-pointer"
                          />
                          <span>{opt.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* File Name Sanitizer */}
      {activeSubTab === 'sanitizer' && (isSuperAdmin || canSeeSanitizer) && (
        <div className="space-y-6 w-full">
          <div className="bg-theme-card-bg/40 rounded-2xl border border-theme-border-input/60 p-6 space-y-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={sanitizerInput}
                onChange={(e) => setSanitizerInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddSanitizerWord();
                  }
                }}
                placeholder="Add a word or phrase, e.g. prioritize, othersite, test"
                disabled={sanitizerSubmitting}
                className="flex-1 px-3.5 py-2 bg-theme-page-bg border border-theme-border-muted rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-theme-text-primary disabled:opacity-50"
              />
              <button
                type="button"
                onClick={handleAddSanitizerWord}
                disabled={sanitizerSubmitting || !sanitizerInput.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Add
              </button>
            </div>

            <div className="flex items-center justify-between text-[10px] text-theme-text-muted uppercase tracking-wider">
              <span>{sanitizerRules.length} entries · {sanitizerRules.filter((r) => r.enabled).length} active</span>
            </div>

            <div className="flex flex-wrap gap-2">
              {sanitizerRules.map((rule) => (
                <span
                  key={rule.word}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-colors ${
                    rule.enabled
                      ? 'bg-blue-955/30 border-blue-500/20 text-theme-text-secondary'
                      : 'bg-theme-border-muted/30 border-theme-border-muted/60 text-theme-text-muted/60 line-through'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => handleToggleSanitizerWord(rule.word)}
                    disabled={sanitizerSubmitting}
                    className="cursor-pointer disabled:opacity-50"
                    title={rule.enabled ? 'Disable (keep in list)' : 'Enable'}
                  >
                    {rule.word}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveSanitizerWord(rule.word)}
                    disabled={sanitizerSubmitting}
                    className="text-theme-text-muted hover:text-rose-400 cursor-pointer disabled:opacity-50"
                    title="Remove permanently"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Access & Feature Controls */}
      {activeSubTab === 'access_controls' && (isSuperAdmin || canSeeAccess) && (
        <div className="space-y-6 w-full">
          {/* Tab Access — per-role visibility matrix */}
          <div className="bg-theme-card-bg/40 rounded-2xl border border-theme-border-input/60 p-6 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-theme-text-secondary uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-theme-border-input/40">
                <Layout className="h-4 w-4 text-blue-400" />
                Tab Access (per role)
              </h3>
              <p className="text-[11px] text-theme-text-muted mt-2">
                Enable or disable each tab/subtab for <strong>User</strong>,{' '}
                <strong>Supervisor</strong>, and <strong>Admin</strong>. Disabling
                hides it from the sidebar for everyone in that role (individual
                users can still hide their own tabs). Changes save immediately.
              </p>
            </div>

            {['Main Workspace Sections', 'Quotes Tracker Subtabs', 'Leave Tracker Subtabs', 'Settings Subtabs', 'User Profile View Subtabs', 'User Profile Settings Components'].map(
              (category) => {
                const tabs = MENU_TABS.filter((t) => t.category === category);
                if (tabs.length === 0) return null;
                return (
                  <div key={category} className="space-y-2">
                    <div className="grid grid-cols-[1fr_repeat(3,auto)] gap-x-4 gap-y-1 items-center">
                      <span className="text-[10px] font-bold text-theme-text-muted uppercase tracking-wider pl-1 border-l-2 border-blue-500/60">
                        {category}
                      </span>
                      {CONFIGURABLE_ROLES.map((role) => (
                        <span
                          key={role}
                          className="text-[9px] font-bold text-theme-text-muted uppercase tracking-wider text-center w-16 capitalize"
                        >
                          {role}
                        </span>
                      ))}
                      {tabs.map((tab) => (
                        <React.Fragment key={tab.key}>
                          <span className="text-[11px] text-theme-text-secondary py-1.5">
                            {tab.label}
                          </span>
                          {CONFIGURABLE_ROLES.map((role) => {
                            const configured = roleVisibility[role]?.[tab.key];
                            const visible = typeof configured === 'boolean'
                              ? configured
                              : getDefaultRoleVisibility(role, tab.key);
                            const itemKey = `${role}:${tab.key}`;
                            const isPending = activeRoleVisKey === itemKey;
                            return (
                              <button
                                key={role}
                                type="button"
                                disabled={isPending}
                                onClick={() => handleToggleRoleVisibility(role, tab.key, !visible)}
                                title={visible ? `Visible to ${role}` : `Hidden from ${role}`}
                                className={`mx-auto w-16 h-6 rounded-lg border text-[9px] font-bold uppercase tracking-wider cursor-pointer transition-colors ${
                                  visible
                                    ? 'bg-emerald-955/30 border-emerald-500/30 text-emerald-400 hover:bg-emerald-955/50'
                                    : 'bg-rose-955/30 border-rose-500/30 text-rose-400 hover:bg-rose-955/50'
                                } ${isPending ? 'animate-pulse opacity-50 cursor-wait' : ''}`}
                              >
                                {visible ? 'On' : 'Off'}
                              </button>
                            );
                          })}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                );
              }
            )}
          </div>

          {/* Per-Supervisor Specific Access Controls (User Profile View & Features) */}
          <div className="bg-theme-card-bg/40 rounded-2xl border border-theme-border-input/60 p-6 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-theme-text-secondary uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-theme-border-input/40">
                <Users className="h-4 w-4 text-purple-400" />
                Per-Supervisor Specific Access Controls
              </h3>
              <p className="text-[11px] text-theme-text-muted mt-2">
                Configure feature and profile subtab access for an individual <strong>Supervisor</strong> when viewing their assigned team members. Specific supervisor settings override role defaults.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-theme-text-muted uppercase tracking-wider mb-1.5">
                  Select Supervisor
                </label>
                <select
                  value={selectedSupervisorId}
                  onChange={(e) => setSelectedSupervisorId(e.target.value)}
                  className="w-full sm:w-80 h-9 px-3 bg-theme-page-bg border border-theme-border-input rounded-xl text-xs text-theme-text-primary font-medium outline-none focus:border-blue-500 transition-colors"
                >
                  <option value="">-- Choose a Supervisor --</option>
                  {profilesList
                    .filter((p) => p.role === 'supervisor' || p.role === 'admin')
                    .map((sup) => (
                      <option key={sup.id} value={sup.id}>
                        {sup.full_name || sup.username} ({sup.role})
                      </option>
                    ))}
                </select>
              </div>

              {selectedSupervisorId && (
                <div className="bg-theme-card-container/80 rounded-xl border border-theme-border-input p-4 space-y-3">
                  <div className="text-xs font-bold text-theme-text-primary border-b border-theme-border-input/40 pb-2 flex justify-between items-center">
                    <span>Subtab & Feature Permissions for: <strong className="text-blue-400">{profilesList.find((p) => p.id === selectedSupervisorId)?.full_name || profilesList.find((p) => p.id === selectedSupervisorId)?.username}</strong></span>
                    <span className="text-[10px] text-theme-text-muted font-normal">Saves automatically</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    {[
                      { key: 'user_profile_leave', label: 'User Management > User Profile > Leave Tracker Workspace' },
                      { key: 'user_profile_quotes', label: 'User Management > User Profile > Quotes Manager Workspace' },
                      { key: 'user_profile_analytics', label: 'User Management > User Profile > Analytics' },
                      { key: 'user_profile_kpi', label: 'User Management > User Profile > KPI & Performance Settings' },
                      { key: 'user_profile_settings', label: 'User Management > User Profile > Profile Settings' },
                      { key: 'user_profile_change_password', label: 'User Management > User Profile > Change Password?' },
                    ].map((item) => {
                      const supOverrides = supervisorAccessOverrides[selectedSupervisorId];
                      const isConfigured = supOverrides && typeof supOverrides[item.key] === 'boolean';
                      const activeVal = isConfigured
                        ? supOverrides[item.key]
                        : getDefaultRoleVisibility('supervisor', item.key);

                      return (
                        <div
                          key={item.key}
                          className="flex items-center justify-between p-3 bg-theme-page-bg/80 border border-theme-border-input/60 rounded-xl"
                        >
                          <div>
                            <span className="text-xs font-semibold text-theme-text-primary block">{item.label}</span>
                            <span className="text-[10px] text-theme-text-muted">
                              {isConfigured ? 'Custom Supervisor Override' : 'Supervisor Role Default'}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleToggleSupervisorOverride(selectedSupervisorId, item.key, !activeVal)}
                            className={`w-20 h-7 rounded-lg border text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                              activeVal
                                ? 'bg-emerald-955/30 border-emerald-500/30 text-emerald-400 hover:bg-emerald-955/50'
                                : 'bg-rose-955/30 border-rose-500/30 text-rose-400 hover:bg-rose-955/50'
                            }`}
                          >
                            {activeVal ? 'Allowed' : 'Hidden'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Temporary Access Controls */}
          <div className="bg-theme-card-bg/40 rounded-2xl border border-theme-border-input/60 p-6 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-theme-text-secondary uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-theme-border-input/40">
                <Shield className="h-4 w-4 text-blue-400" />
                Temporary Access Controls
              </h3>
              <p className="text-[11px] text-theme-text-muted mt-2">
                Time-boxed override: temporarily <strong>grant</strong> or{' '}
                <strong>revoke</strong> a tab for a role until a chosen time, then
                it reverts automatically. Overrides the per-role Tab Access above
                while active.
              </p>
            </div>

            <div className="space-y-3">
              {/* Line 1: Target Type (Role vs User), Role/User Selector, Tab, Action */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-3">
                  <label className="block text-[9px] font-bold text-theme-text-muted uppercase tracking-wider mb-1">Target Type</label>
                  <select
                    value={tempForm.target_type}
                    onChange={(e) => {
                      const val = e.target.value as 'role' | 'user';
                      const defaultUser = profilesList[0];
                      setTempForm((f) => ({
                        ...f,
                        target_type: val,
                        user_id: val === 'user' && !f.user_id && defaultUser ? defaultUser.id : f.user_id,
                        user_codename: val === 'user' && !f.user_codename && defaultUser ? (defaultUser.codename || defaultUser.full_name || defaultUser.username) : f.user_codename,
                      }));
                    }}
                    className="w-full h-9 px-2.5 bg-theme-page-bg border border-theme-border-input rounded-lg text-xs text-theme-text-primary focus:outline-none focus:border-blue-500/50 font-semibold"
                  >
                    <option value="role">By Role (Group)</option>
                    <option value="user">Specific User (Codename)</option>
                  </select>
                </div>

                {tempForm.target_type === 'role' ? (
                  <div className="sm:col-span-3">
                    <label className="block text-[9px] font-bold text-theme-text-muted uppercase tracking-wider mb-1">Role</label>
                    <select
                      value={tempForm.role}
                      onChange={(e) => setTempForm((f) => ({ ...f, role: e.target.value }))}
                      className="w-full h-9 px-2.5 bg-theme-page-bg border border-theme-border-input rounded-lg text-xs text-theme-text-primary capitalize focus:outline-none focus:border-blue-500/50"
                    >
                      {CONFIGURABLE_ROLES.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="sm:col-span-3">
                    <label className="block text-[9px] font-bold text-theme-text-muted uppercase tracking-wider mb-1">Select User (Codename)</label>
                    <select
                      value={tempForm.user_id}
                      onChange={(e) => {
                        const targetId = e.target.value;
                        const u = profilesList.find((p) => p.id === targetId);
                        setTempForm((f) => ({
                          ...f,
                          user_id: targetId,
                          user_codename: u ? (u.codename || u.full_name || u.username) : '',
                          role: u?.role || 'user',
                        }));
                      }}
                      className="w-full h-9 px-2.5 bg-theme-page-bg border border-theme-border-input rounded-lg text-xs text-theme-text-primary focus:outline-none focus:border-blue-500/50"
                    >
                      <option value="">-- Choose User --</option>
                      {profilesList.map((p) => {
                        const codename = p.codename || p.username || 'User';
                        const label = p.full_name ? `${codename} (${p.full_name})` : codename;
                        return (
                          <option key={p.id} value={p.id}>
                            {label}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                )}

                <div className="sm:col-span-3">
                  <label className="block text-[9px] font-bold text-theme-text-muted uppercase tracking-wider mb-1">Tab / Feature</label>
                  <select
                    value={tempForm.tabKey}
                    onChange={(e) => setTempForm((f) => ({ ...f, tabKey: e.target.value }))}
                    className="w-full h-9 px-2.5 bg-theme-page-bg border border-theme-border-input rounded-lg text-xs text-theme-text-primary focus:outline-none focus:border-blue-500/50"
                  >
                    <optgroup label="Navigation Tabs">
                      {MENU_TABS.map((t) => (
                        <option key={t.key} value={t.key}>{t.label}</option>
                      ))}
                    </optgroup>
                    <optgroup label="Feature Flags & Operational Tools">
                      {FEATURE_FLAGS.map((f) => (
                        <option key={f.key} value={f.key}>{f.label}</option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-[9px] font-bold text-theme-text-muted uppercase tracking-wider mb-1">Action</label>
                  <select
                    value={tempForm.action}
                    onChange={(e) => setTempForm((f) => ({ ...f, action: e.target.value as 'grant' | 'revoke' }))}
                    className="w-full h-9 px-2.5 bg-theme-page-bg border border-theme-border-input rounded-lg text-xs text-theme-text-primary capitalize focus:outline-none focus:border-blue-500/50 font-semibold"
                  >
                    <option value="revoke">Revoke (Turn OFF / Block)</option>
                    <option value="grant">Grant (Turn ON / Access)</option>
                  </select>
                </div>
              </div>

              {/* Line 2: Until (Date-Time Picker) + Comment / Reason + Add Button */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                <div className="sm:col-span-5">
                  <label className="block text-[9px] font-bold text-theme-text-muted uppercase tracking-wider mb-1">Until Expiration Date & Time</label>
                  <DateTimeInput
                    value={tempForm.expires_at}
                    onChange={(val) => setTempForm((f) => ({ ...f, expires_at: val }))}
                  />
                </div>
                <div className="sm:col-span-5">
                  <label className="block text-[9px] font-bold text-theme-text-muted uppercase tracking-wider mb-1">Comment / Reason (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Audit requirement, temp project access"
                    value={tempForm.comment || ""}
                    onChange={(e) => setTempForm((f) => ({ ...f, comment: e.target.value }))}
                    className="w-full h-9 px-3 bg-theme-page-bg border border-theme-border-input rounded-lg text-xs text-theme-text-primary placeholder-theme-text-muted/50 focus:outline-none focus:border-blue-500/50"
                  />
                </div>
                <div className="sm:col-span-2">
                  <button
                    type="button"
                    onClick={handleAddTempAccess}
                    disabled={tempSubmitting}
                    className="w-full h-9 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold cursor-pointer disabled:opacity-50 transition-all shadow-md"
                  >
                    Add Rule
                  </button>
                </div>
              </div>
            </div>

            {tempAccess.length > 0 ? (
              <div className="flex flex-col gap-2">
                {tempAccess.map((entry, i) => {
                  const expired = new Date(entry.expires_at).getTime() <= currentTimestamp;
                  const tabLabel = MENU_TABS.find((t) => t.key === entry.tabKey)?.label
                    || FEATURE_FLAGS.find((f) => f.key === entry.tabKey)?.label
                    || entry.tabKey;
                  return (
                    <div
                      key={`${entry.role}-${entry.tabKey}-${entry.expires_at}-${i}`}
                      className={`flex items-center justify-between gap-3 p-2.5 rounded-lg border text-[11px] ${
                        expired
                          ? 'border-theme-border-muted/50 bg-theme-page-bg/20 text-theme-text-muted/60'
                          : 'border-theme-border-input/60 bg-theme-page-bg/40 text-theme-text-secondary'
                      }`}
                    >
                      <span>
                        <strong className="capitalize">{entry.action}</strong> “{tabLabel}” for{' '}
                        {entry.target_type === 'user' ? (
                          <span>
                            user <strong className="text-blue-400 font-bold">{entry.user_codename || 'User'}</strong>
                          </span>
                        ) : (
                          <span>
                            role <strong className="capitalize">{entry.role}</strong>
                          </span>
                        )}{' '}
                        until {formatCustomDateTime(entry.expires_at)}
                        {entry.comment && (
                          <span className="ml-2 font-medium text-amber-300">
                            — "{entry.comment}"
                          </span>
                        )}
                        {expired && <span className="ml-2 italic text-red-400">(expired)</span>}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveTempAccess(entry)}
                        disabled={tempSubmitting}
                        className="text-theme-text-muted hover:text-rose-400 cursor-pointer disabled:opacity-50 shrink-0"
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-[11px] text-theme-text-muted/70 italic">No temporary overrides active.</p>
            )}
          </div>
        </div>
      )}

      {/* Feature Flags Subtab (Superadmin & Delegated Admin) */}
      {activeSubTab === 'feature_flags' && isAdminRole(profile) && (
        <div className="space-y-6 w-full">
          <div className="bg-theme-card-bg/40 rounded-2xl border border-theme-border-input/60 p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-theme-border-input/40 pb-2">
              <div>
                <h3 className="text-sm font-bold text-theme-text-secondary uppercase tracking-wider flex items-center gap-2">
                  <Settings className="h-4 w-4 text-blue-400" />
                  Global Feature Flags
                </h3>
                <p className="text-[11px] text-theme-text-muted mt-2">
                  {isSuperAdmin
                    ? 'Turn app features on or off globally. You can also grant Admins permission to manage specific operational flags.'
                    : 'Turn operational features on or off globally for all users. Superadmin has granted you access to manage these flags.'}
                </p>
              </div>
              {isSuperAdmin && (
                <button
                  type="button"
                  onClick={handleResetAllUserFeatureFlags}
                  className="px-3 py-1.5 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/40 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0"
                >
                  Reset All Users to Inherit
                </button>
              )}
            </div>
            <div className="flex flex-col gap-2">
              {FEATURE_FLAGS.filter((flag) => isSuperAdmin || effectiveAdminDelegatedFlags[flag.key] === true).map((flag) => {
                const configured = featureFlags[flag.key];
                const isGlobalEnabled = typeof configured === 'boolean'
                  ? configured
                  : getDefaultFeatureFlagState(flag.key);

                const tabKey = FLAG_TO_TAB_KEY[flag.key];
                let rolesOnCount = 3;
                let hasRoleMapping = false;

                if (tabKey) {
                  hasRoleMapping = true;
                  const activeRoles = CONFIGURABLE_ROLES.filter((role) => {
                    const cfg = roleVisibility[role]?.[tabKey];
                    return typeof cfg === 'boolean' ? cfg : getDefaultRoleVisibility(role, tabKey);
                  });
                  rolesOnCount = activeRoles.length;
                }

                const isFullyOn = isGlobalEnabled && (!hasRoleMapping || rolesOnCount === 3);
                const isPartialOn = isGlobalEnabled && hasRoleMapping && rolesOnCount > 0 && rolesOnCount < 3;
                const isFullyOff = !isGlobalEnabled || (hasRoleMapping && rolesOnCount === 0);

                const isPending = activeFlagKey === flag.key;
                const isDelegated = !!effectiveAdminDelegatedFlags[flag.key];
                const isDelegatePending = activeFlagKey === `delegate:${flag.key}`;

                return (
                  <div
                    key={flag.key}
                    className="flex items-center justify-between gap-4 p-3.5 rounded-xl border border-theme-border-input/60 bg-theme-page-bg/40 hover:bg-theme-page-bg/60 transition-all"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="block text-xs font-semibold text-theme-text-primary">
                          {flag.label}
                        </span>
                        {isPartialOn && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/30">
                            Partial ({rolesOnCount}/3 Roles)
                          </span>
                        )}
                        {isSuperAdmin && isDelegated && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/30">
                            Admin Allowed
                          </span>
                        )}
                      </div>
                      <span className="block text-[10px] text-theme-text-muted mt-0.5">
                        {flag.description}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {isSuperAdmin && (
                        <button
                          type="button"
                          disabled={isDelegatePending}
                          onClick={() => handleToggleAdminDelegation(flag.key, !isDelegated)}
                          title={
                            isDelegated
                              ? 'Delegated to Admins — Click to restrict to Superadmin only'
                              : 'Superadmin Only — Click to allow Admins to manage this feature flag'
                          }
                          className={`px-2.5 h-7 rounded-lg border text-[9px] font-bold uppercase tracking-wider cursor-pointer transition-all flex items-center justify-center ${
                            isDelegated
                              ? 'bg-purple-500/20 border-purple-500/40 text-purple-300 hover:bg-purple-500/30'
                              : 'bg-theme-border-muted/50 border-theme-border-active/60 text-theme-text-muted hover:bg-theme-border-active/80'
                          } ${isDelegatePending ? 'animate-pulse opacity-50 cursor-wait' : ''}`}
                        >
                          {isDelegated ? 'Admin Allowed' : 'Superadmin Only'}
                        </button>
                      )}

                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => handleToggleFeatureFlag(flag.key, !isFullyOn)}
                        title={
                          isFullyOn
                            ? 'Fully Enabled — Click to disable globally for all roles'
                            : isPartialOn
                            ? `Partially Enabled (${rolesOnCount}/3 roles) — Click to disable globally`
                            : 'Disabled — Click to enable for all roles'
                        }
                        className={`min-w-[75px] px-2.5 h-7 rounded-lg border text-[9px] font-bold uppercase tracking-wider cursor-pointer transition-all flex items-center justify-center gap-1 ${
                          isFullyOn
                            ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/30'
                            : isPartialOn
                            ? 'bg-amber-500/20 border-amber-500/40 text-amber-400 hover:bg-amber-500/30'
                            : 'bg-rose-500/20 border-rose-500/40 text-rose-400 hover:bg-rose-500/30'
                        } ${isPending ? 'animate-pulse opacity-50 cursor-wait' : ''}`}
                      >
                        {isFullyOn ? 'On' : isPartialOn ? 'Partial On' : 'Off'}
                      </button>
                    </div>
                  </div>
                );
              })}

              {!isSuperAdmin && FEATURE_FLAGS.filter((flag) => effectiveAdminDelegatedFlags[flag.key] === true).length === 0 && (
                <div className="p-6 text-center text-xs text-theme-text-muted italic bg-theme-page-bg/30 rounded-xl border border-theme-border-input/40">
                  No operational feature flags have been delegated to Admins by Superadmin yet.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Database & System Health Subtab */}
      {activeSubTab === 'system_health' && canSeeSystemHealth && (
        <div className="space-y-6 w-full">
          <SupabaseUsageWidget />
        </div>
      )}

      {/* VPN List Subtab */}
      {activeSubTab === 'vpn_list' && (isSuperAdmin || canSeeVpn) && (
        <div className="space-y-6 w-full font-sans">
          <div className="bg-theme-card-bg/40 rounded-2xl border border-theme-border-input/60 p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-theme-border-input/40">
              <h3 className="text-sm font-bold text-theme-text-secondary uppercase tracking-wider flex items-center gap-2 shrink-0">
                <Globe className="h-4 w-4 text-blue-400" />
                VPN List Management
              </h3>

              <div className="flex items-center gap-2 flex-1 max-w-md">
                <input
                  type="text"
                  value={newVpnInput}
                  onChange={(e) => setNewVpnInput(e.target.value)}
                  placeholder="e.g. ExpressVPN, NordVPN, Surfshark"
                  className="flex-1 bg-theme-page-bg/80 border border-theme-border-input rounded-xl px-3 py-2 text-xs text-theme-text-primary placeholder-theme-text-muted/60 focus:outline-none focus:border-blue-500 font-sans"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddVpnName();
                    }
                  }}
                />
                <button
                  type="button"
                  disabled={vpnSubmitting || !newVpnInput.trim()}
                  onClick={handleAddVpnName}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all cursor-pointer font-sans shrink-0"
                >
                  Add VPN
                </button>
              </div>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {vpnList.map((vpnName, idx) => (
                <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-theme-page-bg/40 border border-theme-border-input/60">
                  <span className="text-xs font-medium text-theme-text-primary font-sans">{vpnName}</span>
                  <button
                    type="button"
                    disabled={vpnSubmitting}
                    onClick={() => handleRemoveVpnName(vpnName)}
                    className="p-1 text-red-400 hover:text-red-300 rounded hover:bg-red-955/30 transition-all cursor-pointer"
                    title="Remove VPN"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'user_management' && canSeeUserManagement && (
        <div className="space-y-6">
          <UserManagementDashboard
            sessionUser={sessionUser}
            profile={profile}
            onLogout={() => {}}
            theme="dark"
            onThemeToggle={() => {}}
            isSidebarCollapsed={false}
            onSidebarToggle={() => {}}
          />
        </div>
      )}

      {activeSubTab === 'audit_logs' && canSeeAuditLogs && (
        <div className="space-y-6">
          <AuditLogsPanel />
        </div>
      )}

      {/* Bottom Save Changes Bar (Profile & Menu Visibility subtabs) */}
      {activeSubTab !== 'user_management' && activeSubTab !== 'audit_logs' && activeSubTab !== 'sanitizer' && activeSubTab !== 'access_controls' && activeSubTab !== 'feature_flags' && activeSubTab !== 'vpn_list' && activeSubTab !== 'system_health' && profile?.profile_change_status !== 'pending' && (
        <div className="flex justify-end pt-4 border-t border-theme-border-input/60 w-full">
          <button
            type={activeSubTab === 'profile' ? 'submit' : 'button'}
            form={activeSubTab === 'profile' ? 'profile-settings-form' : undefined}
            onClick={activeSubTab === 'menu_visibility' ? handleSaveSettings : undefined}
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
              : (isAdminRole(profile) || !profile?.has_edited_profile || activeSubTab === 'menu_visibility'
                  ? 'Save Changes'
                  : 'Submit Request for Approval')}
          </button>
        </div>
      )}
    </div>
  );
}
