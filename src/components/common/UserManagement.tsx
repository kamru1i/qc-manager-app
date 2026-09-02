'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAppEventBus } from '@/contexts/AppEventBusContext';
import { createPortal } from 'react-dom';
import { supabase } from '@/utils/supabase';
import { Profile } from '@/types';
import { mapProfilePasswordResetStatus } from '@/utils/profileHelpers';
import { useAdminActions } from '@/hooks/leave-tracker/useAdminActions';
import { canAccessModule, canAccessUserProfileSubtab, isAdminRole, getDisplayRole, getRoleLabel } from '@/utils/permissionService';
import { ConfirmModal } from '@/components/common/modals/ConfirmModal';
import { Modal } from '@/components/common/Modal';
import { UserManagementSkeleton } from '@/components/common/skeleton/UserManagementSkeleton';
import { toast } from 'sonner';
import { useRealtimeHandler, RealtimePayload } from '@/contexts/RealtimeContext';
import { useProfiles } from '@/contexts/ProfilesContext';
import { chutiService } from '@/services/chutiService';
import {
  Search,
  UserPlus,
  Shield,
  XCircle,
  Loader2,
  CheckCircle2,
  X,
  ArrowLeft,
  KeyRound,
  Settings,
  Calendar,
  BarChart2,
  FileText,
  TrendingUp
} from 'lucide-react';
import { UserDisplayName } from '@/components/common/UserDisplayName';
import { UserAnalyticsPanel } from '@/components/common/user-management/UserAnalyticsPanel';
import { BadgeInfo } from '@/utils/leaderboardHelper';

// Extracted Subtabs Panels
import { CreateUserPanel } from '@/components/common/user-management/CreateUserPanel';
import { UserProfileSettingsPanel } from '@/components/common/user-management/UserProfileSettingsPanel';
import { UserLeaveHistoryPanel } from '@/components/common/user-management/UserLeaveHistoryPanel';
import { UserQuotesHistoryPanel } from '@/components/common/user-management/UserQuotesHistoryPanel';
import { useAppEvent } from '@/contexts/AppEventBusContext';
import { UserKpiPerformancePanel } from '@/components/common/user-management/UserKpiPerformancePanel';
import { AddLeave } from '@/components/leave-tracker/AddLeave';
import { AdjustmentModal } from '@/components/leave-tracker/modals/AdjustmentModal';
import { ChutiRecord } from '@/utils/offlineSync';
import { LeaveSettlement, GovtHolidayResponse } from '@/types';
import { GlobalSettings, getGlobalSettingsFromProfile, defaultGlobalSettings, sortChutiRecordsDescending, findAdminProfileWithGlobalSettings, createNotification, getExistingNotifications, formatLeaveDuration, formatDate, getDetailedLeaveLabel, getCleanComment, getApprovalsPrefix } from '@/utils/dashboardHelpers';
import { PROFILE_COLUMNS, CHUTI_COLUMNS, LEAVE_SETTLEMENT_COLUMNS, GOVT_HOLIDAY_RESPONSE_COLUMNS } from '@/utils/dbColumns';
import { holidaysService } from '@/services/holidaysService';

interface UserManagementProps {
  sessionUser: { id: string } | null;
  profile: Profile | null;
  onLogout: () => void;
  theme: 'dark' | 'light';
  onThemeToggle: () => void;
  isSidebarCollapsed: boolean;
  onSidebarToggle: () => void;
  topPerformerBadges?: Record<string, BadgeInfo>;
  onViewStateChange?: (isFullView: boolean) => void;
  globalSettings?: GlobalSettings;
}

const ALL_FILE_TYPES = [
  'Bike', 'Individual Review', 'Other Site', 'Quote', 'Requote', 'Requote Bike', 'Requote Van', 'Review', 'Sale', 'Van'
];

export const UserManagement: React.FC<UserManagementProps> = ({
  sessionUser,
  profile,
  topPerformerBadges = {},
  onViewStateChange,
  globalSettings: propsGlobalSettings,
}) => {
  const { emit } = useAppEventBus();
  // R1/R2: shared profiles list from ProfilesContext (was a local duplicate copy)
  const { profilesList: profiles, setProfilesList: setProfiles, refreshProfiles, isLoaded: profilesLoaded } = useProfiles();

  // Robust fallback: resolve top-performer badges from passed props or directly from profiles list
  const effectiveBadges = React.useMemo(() => {
    const map: Record<string, BadgeInfo> = { ...(topPerformerBadges || {}) };
    profiles.forEach((p) => {
      if (!map[p.id] && p.global_settings?.top_performer_badge) {
        map[p.id] = p.global_settings.top_performer_badge as BadgeInfo;
      }
    });
    return map;
  }, [topPerformerBadges, profiles]);

  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Add User State
  const [isCreatingNewUser, setIsCreatingNewUser] = useState(false);

  // Edit User State
  const [editUserCodename, setEditUserCodename] = useState('');
  const [editUserFullName, setEditUserFullName] = useState('');
  const [editUserRole, setEditUserRole] = useState<'admin' | 'supervisor' | 'user' | 'superadmin'>('user');
  const [editHasChutiAccess, setEditHasChutiAccess] = useState(false);
  const [editHasQuotesAccess, setEditHasQuotesAccess] = useState(false);
  const [editUserAllowedTypes, setEditUserAllowedTypes] = useState<string[]>([]);
  const [editUserCanManageRules, setEditUserCanManageRules] = useState(false);
  const [editNeedsApproval, setEditNeedsApproval] = useState(true);
  const [editSupervisorIds, setEditSupervisorIds] = useState<string[]>([]);
  const [editEligibleGovtHoliday, setEditEligibleGovtHoliday] = useState(true);
  const [editEligibleOfficeLeave, setEditEligibleOfficeLeave] = useState(true);
  const [editAllowOvertime, setEditAllowOvertime] = useState(false);
  const [editAllowReserve, setEditAllowReserve] = useState(false);
  const [editUserJobRole, setEditUserJobRole] = useState('');
  const [editUserWorkingHours, setEditUserWorkingHours] = useState('9.5');
  const [editUserBreakTime, setEditUserBreakTime] = useState('0');
  const [editUserSignInTime, setEditUserSignInTime] = useState('');
  const [editUserSignOutTime, setEditUserSignOutTime] = useState('');
  const [editUserKpiSkills, setEditUserKpiSkills] = useState<string[]>([]);
  const [editUserKpiDeptIndicators, setEditUserKpiDeptIndicators] = useState<string[]>([]);
  const [editUserKpiOtherDeptIndicators, setEditUserKpiOtherDeptIndicators] = useState<string[]>([]);
  const [editUserPerformsDataEntry, setEditUserPerformsDataEntry] = useState(true);
  const [editUserDepartment, setEditUserDepartment] = useState('Data Entry');
  const [editUserPerformsOtherDeptTasks, setEditUserPerformsOtherDeptTasks] = useState(false);
  const [editUserOtherDepartment, setEditUserOtherDepartment] = useState('IT');
  const [editDelegatedLeaveSupervisorId, setEditDelegatedLeaveSupervisorId] = useState<string | null>(null);
  const [editDelegatedKpiSupervisorId, setEditDelegatedKpiSupervisorId] = useState<string | null>(null);
  const [editUserFeatureFlags, setEditUserFeatureFlags] = useState<Record<string, boolean>>({});

  // Delete User State
  const [deletingUserAccount, setDeletingUserAccount] = useState<{ id: string; username: string } | null>(null);


  // Double-click viewing state (Employee 360 Hub)
  const [viewingStaff, setViewingStaff] = useState<Profile | null>(null);

  const updateViewingStaff = useCallback((staff: Profile | null) => {
    setViewingStaff(staff);
    if (staff) {
      localStorage.setItem('user_management_viewing_staff_id', staff.id);
    } else {
      localStorage.removeItem('user_management_viewing_staff_id');
    }
  }, []);

  const [activeSubTab, setActiveSubTab] = useState<'profile' | 'leave' | 'quotes' | 'analytics' | 'kpi'>(() => {
    if (typeof window === 'undefined') return 'leave';
    try {
      const saved = localStorage.getItem('user_management_active_subtab');
      if (saved === 'profile' || saved === 'leave' || saved === 'quotes' || saved === 'analytics' || saved === 'kpi') {
        return saved as any;
      }
    } catch {}
    return 'leave';
  });
  const prevViewingStaffRef = useRef<Profile | null>(null);

  // Restore viewingStaff on page reload/mount when profiles list is loaded
  useEffect(() => {
    if (profiles.length > 0 && !viewingStaff) {
      const savedStaffId = localStorage.getItem('user_management_viewing_staff_id');
      if (savedStaffId) {
        const found = profiles.find(p => p.id === savedStaffId);
        if (found) {
          setViewingStaff(found);
        }
      }
    }
  }, [profiles, viewingStaff]);

  const handleSetActiveSubTab = (tab: 'profile' | 'leave' | 'quotes' | 'analytics' | 'kpi') => {
    setActiveSubTab(tab);
    localStorage.setItem('user_management_active_subtab', tab);
  };
  const [preSelectedKpiPeriodKey, setPreSelectedKpiPeriodKey] = useState<string>('');
  const [viewingStaffRecords, setViewingStaffRecords] = useState<ChutiRecord[]>([]);
  const [viewingStaffSettlements, setViewingStaffSettlements] = useState<LeaveSettlement[]>([]);
  const [viewingStaffHolidayResponses, setViewingStaffHolidayResponses] = useState<GovtHolidayResponse[]>([]);
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings>(defaultGlobalSettings);
  const [loadingLeaveData, setLoadingLeaveData] = useState(false);
  const [showAddLeaveForStaff, setShowAddLeaveForStaff] = useState(false);
  const [editingLeaveRecord, setEditingLeaveRecord] = useState<ChutiRecord | null>(null);

  // Leave Records Filter parameters
  const [leaveFilterType, setLeaveFilterType] = useState('all');
  const [leaveFilterStartDate, setLeaveFilterStartDate] = useState('');
  const [leaveFilterEndDate, setLeaveFilterEndDate] = useState('');
  const [leaveSearchQuery, setLeaveSearchQuery] = useState('');

  const [detailSelectedYear, setDetailSelectedYear] = useState<string>(() => new Date().getFullYear().toString());

  // Change Credentials Modal State
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [credNewPassword, setCredNewPassword] = useState('');
  const [credConfirmPassword, setCredConfirmPassword] = useState('');
  const [updatingCredentials, setUpdatingCredentials] = useState(false);
  const [showResetConfirmModal, setShowResetConfirmModal] = useState(false);

  // Staff leave adjustment modal states
  const [showStaffAdjustmentModal, setShowStaffAdjustmentModal] = useState(false);
  const [staffAdjustmentRecord, setStaffAdjustmentRecord] = useState<ChutiRecord | null>(null);
  const [staffAdjustmentType, setStaffAdjustmentType] = useState<'full' | 'partial'>('full');
  const [staffPartialAdjustmentTime, setStaffPartialAdjustmentTime] = useState('02:00');
  const [staffAdjustShortLeaveOption, setStaffAdjustShortLeaveOption] = useState(false);
  const [staffAdjustmentSubmitting, setStaffAdjustmentSubmitting] = useState(false);

  const hasStaffAccess = useCallback((viewingStaffProfile: Profile) => {
    if (!profile) return false;
    if (isAdminRole(profile)) return true;
    if (viewingStaffProfile.id === profile.id) return true;
    
    if (profile.role === 'supervisor') {
      const supervisorIds = viewingStaffProfile.supervisor_ids || [];
      // 1. Direct supervision
      if (supervisorIds.includes(profile.id)) return true;
      
      // 2. Delegated supervision
      const delegatedFromSupervisorIds = profiles
        .filter(p => p.delegated_supervisor_id === profile.id)
        .map(p => p.id);
      if (supervisorIds.some(id => delegatedFromSupervisorIds.includes(id))) return true;
    }
    
    return false;
  }, [profile, profiles]);

  // Sync edit states when viewingStaff changes
  useEffect(() => {
    if (viewingStaff) {
      setEditUserCodename(viewingStaff.username || '');
      setEditUserFullName(viewingStaff.full_name || '');
      setEditUserRole(viewingStaff.role || 'user');
      setEditHasChutiAccess(!!viewingStaff.has_chuti_access);
      setEditHasQuotesAccess(!!viewingStaff.has_quotes_access);
      setEditUserAllowedTypes((viewingStaff.allowed_types || []).filter(t => t !== 'Review Van' && t !== 'Review Bike'));
      setEditUserCanManageRules(!!viewingStaff.can_manage_rules);
      setEditNeedsApproval(viewingStaff.needs_supervisor_approval !== false);
      setEditSupervisorIds(viewingStaff.supervisor_ids || []);
      setEditEligibleGovtHoliday(viewingStaff.eligible_govt_holiday !== false);
      setEditEligibleOfficeLeave(viewingStaff.eligible_office_leave !== false);
      setEditAllowOvertime(!!viewingStaff.allow_overtime);
      setEditAllowReserve(!!viewingStaff.allow_reserve);
      setEditUserJobRole(viewingStaff.job_role || '');
      setEditUserWorkingHours(Number(viewingStaff.working_hours ?? 9.5).toFixed(1));
      setEditUserBreakTime((viewingStaff.break_time ?? 0).toString());
      setEditUserSignInTime(viewingStaff.default_sign_in || '');
      setEditUserSignOutTime(viewingStaff.default_sign_out || '');
      setEditUserKpiSkills(viewingStaff.global_settings?.kpi_skills || []);
      setEditUserKpiDeptIndicators(viewingStaff.global_settings?.kpi_dept_indicators || []);
      setEditUserKpiOtherDeptIndicators(viewingStaff.global_settings?.kpi_other_dept_indicators || []);
      setEditUserPerformsDataEntry(viewingStaff.global_settings?.performs_data_entry !== false);
      setEditUserDepartment(viewingStaff.global_settings?.department || 'Data Entry');
      setEditUserPerformsOtherDeptTasks(!!viewingStaff.global_settings?.performs_other_dept_tasks);
      setEditUserOtherDepartment(viewingStaff.global_settings?.other_department || 'IT');
      setEditDelegatedLeaveSupervisorId(viewingStaff.delegated_leave_supervisor_id || null);
      setEditDelegatedKpiSupervisorId(viewingStaff.delegated_kpi_supervisor_id || null);
      setEditUserFeatureFlags(viewingStaff.global_settings?.user_feature_flags || {});
    } else {
      setEditUserFeatureFlags({});
    }
  }, [viewingStaff]);

  // Load saved viewingStaff on mount or when profiles finish loading
  useEffect(() => {
    if (profiles.length > 0) {
      const savedStaffId = localStorage.getItem('user_management_viewing_staff_id');
      if (savedStaffId) {
        const staff = profiles.find(p => p.id === savedStaffId);
        if (staff && hasStaffAccess(staff)) {
          setViewingStaff(staff);
        }
      }
    }
  }, [profiles, hasStaffAccess]);

  // Synchronize viewingStaff with latest data from profiles list (only if data changed)
  useEffect(() => {
    if (viewingStaff) {
      const updated = profiles.find(p => p.id === viewingStaff.id);
      if (!updated) {
        updateViewingStaff(null); // User was deleted
      } else if (JSON.stringify(updated) !== JSON.stringify(viewingStaff)) {
        updateViewingStaff(updated);
      }
    }
  }, [profiles, viewingStaff, updateViewingStaff]);

  // Pre-select staff member from sessionStorage when redirected from other pages
  useEffect(() => {
    if (profiles.length > 0) {
      const savedStaffId = sessionStorage.getItem("viewingStaffId");
      if (savedStaffId) {
        const staff = profiles.find(p => p.id === savedStaffId);
        if (staff) {
          updateViewingStaff(staff);
          handleSetActiveSubTab('profile');
          sessionStorage.removeItem("viewingStaffId");
        }
      }
    }
  }, [profiles, updateViewingStaff]);

  // Backspace to go back from details view
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!viewingStaff && !isCreatingNewUser) return;
      const activeEl = document.activeElement;
      if (activeEl) {
        const tagName = activeEl.tagName.toUpperCase();
        if (tagName === 'INPUT' || tagName === 'TEXTAREA' || activeEl.getAttribute('contenteditable') === 'true') {
          return;
        }
      }
      if (e.key === 'Backspace') {
        e.preventDefault();
        updateViewingStaff(null);
        setIsCreatingNewUser(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewingStaff, isCreatingNewUser, updateViewingStaff]);

  // Determine if viewingStaff profile inputs have changes
  const hasUserChanges = useMemo(() => {
    if (!viewingStaff) return false;

    const isCodenameChanged = (editUserCodename || '').toUpperCase().trim() !== (viewingStaff.username || '').toUpperCase().trim();
    const isFullNameChanged = (editUserFullName || '').trim() !== (viewingStaff.full_name || '').trim();
    const isRoleChanged = editUserRole !== (viewingStaff.role || 'user');
    const isWorkingHoursChanged = (parseFloat(editUserWorkingHours) || 9.5) !== (viewingStaff.working_hours ?? 9.5);
    const isBreakTimeChanged = (parseInt(editUserBreakTime) || 0) !== (viewingStaff.break_time ?? 0);
    const isJobRoleChanged = (editUserJobRole || '').trim() !== (viewingStaff.job_role || '').trim();
    const isSignInChanged = (editUserSignInTime || '') !== (viewingStaff.default_sign_in || '');
    const isSignOutChanged = (editUserSignOutTime || '') !== (viewingStaff.default_sign_out || '');

    const isHasChutiAccessChanged = editHasChutiAccess !== (viewingStaff.has_chuti_access !== false);
    const isNeedsApprovalChanged = editNeedsApproval !== (viewingStaff.needs_supervisor_approval !== false);
    const isSupervisorIdsChanged = JSON.stringify([...editSupervisorIds].sort()) !== JSON.stringify([...(viewingStaff.supervisor_ids || [])].sort());
    const isEligibleOfficeLeaveChanged = editEligibleOfficeLeave !== (viewingStaff.eligible_office_leave !== false);
    const isEligibleGovtHolidayChanged = editEligibleGovtHoliday !== (viewingStaff.eligible_govt_holiday !== false);
    const isAllowOvertimeChanged = editAllowOvertime !== (!!viewingStaff.allow_overtime);
    const isAllowReserveChanged = editAllowReserve !== (!!viewingStaff.allow_reserve);
    const isHasQuotesAccessChanged = editHasQuotesAccess !== (viewingStaff.has_quotes_access !== false);
    const isAllowedTypesChanged = JSON.stringify([...editUserAllowedTypes].sort()) !== JSON.stringify([...(viewingStaff.allowed_types || [])].sort());
    const isCanManageRulesChanged = editUserCanManageRules !== (!!viewingStaff.can_manage_rules);

    const isKpiSkillsChanged = JSON.stringify(editUserKpiSkills) !== JSON.stringify(viewingStaff.global_settings?.kpi_skills || []);
    const isKpiDeptIndicatorsChanged = JSON.stringify(editUserKpiDeptIndicators) !== JSON.stringify(viewingStaff.global_settings?.kpi_dept_indicators || []);
    const isKpiOtherDeptIndicatorsChanged = JSON.stringify(editUserKpiOtherDeptIndicators) !== JSON.stringify(viewingStaff.global_settings?.kpi_other_dept_indicators || []);
    const isPerformsDataEntryChanged = editUserPerformsDataEntry !== (viewingStaff.global_settings?.performs_data_entry !== false);
    const isDepartmentChanged = editUserDepartment !== (viewingStaff.global_settings?.department || 'Data Entry');
    const isPerformsOtherDeptTasksChanged = editUserPerformsOtherDeptTasks !== (!!viewingStaff.global_settings?.performs_other_dept_tasks);
    const isOtherDepartmentChanged = editUserOtherDepartment !== (viewingStaff.global_settings?.other_department || 'IT');
    const isDelegatedLeaveSupervisorIdChanged = editDelegatedLeaveSupervisorId !== (viewingStaff.delegated_leave_supervisor_id || null);
    const isDelegatedKpiSupervisorIdChanged = editDelegatedKpiSupervisorId !== (viewingStaff.delegated_kpi_supervisor_id || null);
    const isUserFeatureFlagsChanged = JSON.stringify(editUserFeatureFlags) !== JSON.stringify(viewingStaff.global_settings?.user_feature_flags || {});

    return isCodenameChanged || isFullNameChanged || isRoleChanged || isWorkingHoursChanged ||
           isBreakTimeChanged || isJobRoleChanged || isSignInChanged || isSignOutChanged ||
           isHasChutiAccessChanged || isNeedsApprovalChanged || isSupervisorIdsChanged ||
           isEligibleOfficeLeaveChanged || isEligibleGovtHolidayChanged || isAllowOvertimeChanged ||
           isAllowReserveChanged || isHasQuotesAccessChanged || isAllowedTypesChanged ||
           isCanManageRulesChanged || isKpiSkillsChanged || isKpiDeptIndicatorsChanged ||
           isKpiOtherDeptIndicatorsChanged || isPerformsDataEntryChanged || isDepartmentChanged ||
           isPerformsOtherDeptTasksChanged || isOtherDepartmentChanged || isDelegatedLeaveSupervisorIdChanged ||
           isDelegatedKpiSupervisorIdChanged || isUserFeatureFlagsChanged;
  }, [
    viewingStaff, editUserCodename, editUserFullName, editUserRole, editUserWorkingHours,
    editUserBreakTime, editUserJobRole, editUserSignInTime, editUserSignOutTime,
    editHasChutiAccess, editNeedsApproval, editSupervisorIds, editEligibleOfficeLeave,
    editEligibleGovtHoliday, editAllowOvertime, editAllowReserve, editHasQuotesAccess,
    editUserAllowedTypes, editUserCanManageRules, editUserKpiSkills, editUserKpiDeptIndicators,
    editUserKpiOtherDeptIndicators, editUserPerformsDataEntry, editUserDepartment,
    editUserPerformsOtherDeptTasks, editUserOtherDepartment, editDelegatedLeaveSupervisorId,
    editDelegatedKpiSupervisorId, editUserFeatureFlags
  ]);

  // Redirect to an authorized subtab if the current subtab is restricted
  useEffect(() => {
    if (viewingStaff) {
      const isLeaveAllowed = viewingStaff.has_chuti_access && canAccessUserProfileSubtab(profile, 'user_profile_leave', globalSettings, profiles) && canAccessModule(profile, viewingStaff, 'leave', profiles);
      const isQuotesAllowed = viewingStaff.has_quotes_access && canAccessUserProfileSubtab(profile, 'user_profile_quotes', globalSettings, profiles) && canAccessModule(profile, viewingStaff, 'quotes', profiles);
      const isAnalyticsAllowed = viewingStaff.has_quotes_access && canAccessUserProfileSubtab(profile, 'user_profile_analytics', globalSettings, profiles) && canAccessModule(profile, viewingStaff, 'quotes', profiles);
      const isKpiAllowed = viewingStaff.has_quotes_access && canAccessUserProfileSubtab(profile, 'user_profile_kpi', globalSettings, profiles) && canAccessModule(profile, viewingStaff, 'kpi', profiles);
      const isProfileSettingsAllowed = canAccessUserProfileSubtab(profile, 'user_profile_settings', globalSettings, profiles);
      
      if (activeSubTab === 'leave' && !isLeaveAllowed) {
        handleSetActiveSubTab(isQuotesAllowed ? 'quotes' : isAnalyticsAllowed ? 'analytics' : isKpiAllowed ? 'kpi' : isProfileSettingsAllowed ? 'profile' : 'profile');
      } else if (activeSubTab === 'quotes' && !isQuotesAllowed) {
        handleSetActiveSubTab(isLeaveAllowed ? 'leave' : isAnalyticsAllowed ? 'analytics' : isKpiAllowed ? 'kpi' : isProfileSettingsAllowed ? 'profile' : 'profile');
      } else if (activeSubTab === 'analytics' && !isAnalyticsAllowed) {
        handleSetActiveSubTab(isLeaveAllowed ? 'leave' : isQuotesAllowed ? 'quotes' : isKpiAllowed ? 'kpi' : isProfileSettingsAllowed ? 'profile' : 'profile');
      } else if (activeSubTab === 'kpi' && !isKpiAllowed) {
        handleSetActiveSubTab(isLeaveAllowed ? 'leave' : isQuotesAllowed ? 'quotes' : isAnalyticsAllowed ? 'analytics' : isProfileSettingsAllowed ? 'profile' : 'profile');
      } else if (activeSubTab === 'profile' && !isProfileSettingsAllowed) {
        handleSetActiveSubTab(isLeaveAllowed ? 'leave' : isQuotesAllowed ? 'quotes' : isAnalyticsAllowed ? 'analytics' : isKpiAllowed ? 'kpi' : 'profile');
      }
    }
  }, [viewingStaff, activeSubTab, profile, profiles, globalSettings]);

  // Reset subtab selection to 'leave' when viewingStaff is closed
  useEffect(() => {
    if (prevViewingStaffRef.current !== null && viewingStaff === null) {
      handleSetActiveSubTab('leave');
    }
    if (!viewingStaff) {
      setShowAddLeaveForStaff(false);
      setEditingLeaveRecord(null);
    }
    prevViewingStaffRef.current = viewingStaff;
  }, [viewingStaff]);

  // Reset add-leave view when subtab changes away from leave
  useEffect(() => {
    if (activeSubTab !== 'leave') {
      setShowAddLeaveForStaff(false);
      setEditingLeaveRecord(null);
    }
  }, [activeSubTab]);

  // Notify parent component when full-screen view state changes
  useEffect(() => {
    if (onViewStateChange) {
      onViewStateChange(!!viewingStaff || isCreatingNewUser);
    }
  }, [viewingStaff, isCreatingNewUser, onViewStateChange]);

  // Fetch all leave records, settlements, and holiday responses for the selected staff member
  const fetchStaffLeaveData = useCallback(async (staffId: string, isSilent = false) => {
    if (!isSilent) {
      setLoadingLeaveData(true);
    }
    try {
      const [chutiRes, sRes, hrRes] = await Promise.all([
        supabase
          .from('chuti')
          .select(CHUTI_COLUMNS)
          .eq('user_id', staffId)
          .is('deleted_at', null)
          .order('date', { ascending: false })
          .limit(500),
        supabase
          .from('leave_settlements')
          .select(LEAVE_SETTLEMENT_COLUMNS)
          .eq('user_id', staffId)
          .limit(500),
        supabase
          .from('govt_holiday_responses')
          .select(GOVT_HOLIDAY_RESPONSE_COLUMNS)
          .eq('user_id', staffId)
          .limit(500),
      ]);

      if (chutiRes.error) throw chutiRes.error;
      if (sRes.error) throw sRes.error;
      if (hrRes.error) throw hrRes.error;

      setViewingStaffRecords(sortChutiRecordsDescending((chutiRes.data || []) as unknown as ChutiRecord[]));
      setViewingStaffSettlements((sRes.data || []) as unknown as LeaveSettlement[]);
      setViewingStaffHolidayResponses((hrRes.data || []) as unknown as GovtHolidayResponse[]);
      // NOTE: admin global_settings are loaded once via a dedicated effect below,
      // not on every staff-data load — they rarely change and this fires on each realtime event.
    } catch (e: any) {
      console.error('Failed to load staff leave data:', {
        code: e?.code,
        message: e?.message,
        details: e?.details,
        hint: e?.hint
      });
      const errMsg = e?.message || '';
      if (errMsg.toLowerCase().includes('token') || errMsg.toLowerCase().includes('jwt') || e?.status === 401) {
        toast.error('Session expired. Logging out...');
        // Local: this device's token expired — other devices keep their sessions
        supabase.auth.signOut({ scope: 'local' });
      } else {
        toast.error(errMsg || 'Failed to load leave history.');
      }
    } finally {
      setLoadingLeaveData(false);
    }
  }, []);

  // Keep global_settings in sync with props or real-time admin profiles
  useEffect(() => {
    if (propsGlobalSettings) {
      setGlobalSettings(propsGlobalSettings);
      return;
    }

    if (profiles && profiles.length > 0) {
      const adminProf = findAdminProfileWithGlobalSettings(profiles, profile);
      if (adminProf?.global_settings) {
        setGlobalSettings(getGlobalSettingsFromProfile(adminProf));
        return;
      }
    }

    let cancelled = false;
    (async () => {
      const { data: adminProfiles, error: apError } = await supabase
        .from('profiles')
        .select('global_settings')
        .or('role.eq.admin,role.eq.superadmin')
        .not('global_settings', 'is', null);
      if (cancelled) return;
      if (!apError && adminProfiles && adminProfiles.length > 0) {
        const target = adminProfiles.find((p: any) => p.global_settings?.supervisor_access_overrides || p.global_settings?.role_visibility) || adminProfiles[0];
        setGlobalSettings(target.global_settings);
      } else if (profile) {
        setGlobalSettings(getGlobalSettingsFromProfile(profile));
      }
    })();
    return () => { cancelled = true; };
  }, [propsGlobalSettings, profile, profiles]);

  // Debounced + throttled wrapper to prevent cascading refetches from rapid realtime events
  const fetchTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const lastStaffFetchRef = React.useRef<number>(0);
  const STAFF_THROTTLE_MS = 3000;
  const debouncedFetchStaffLeaveData = useCallback((staffId: string, isSilent = true) => {
    const now = Date.now();
    if (now - lastStaffFetchRef.current < STAFF_THROTTLE_MS) return; // Throttle

    if (fetchTimerRef.current) {
      clearTimeout(fetchTimerRef.current);
    }
    fetchTimerRef.current = setTimeout(() => {
      lastStaffFetchRef.current = Date.now();
      fetchStaffLeaveData(staffId, isSilent);
    }, 150);
  }, [fetchStaffLeaveData]);

  // Fetch leave data on mount/change of selected staff member
  useEffect(() => {
    if (viewingStaff) {
      const isSupervisedByMe = hasStaffAccess(viewingStaff);
      if (isSupervisedByMe) {
        fetchStaffLeaveData(viewingStaff.id);
      } else {
        // Reset states for non-supervised users so no old values linger
        setViewingStaffRecords([]);
        setViewingStaffSettlements([]);
        setViewingStaffHolidayResponses([]);
        setGlobalSettings(getGlobalSettingsFromProfile(profile));
      }
    }
  }, [viewingStaff, fetchStaffLeaveData, profile, hasStaffAccess]);

  // Real-time synchronization for viewed staff leave data.
  //
  // All table changes now come via the centralized RealtimeProvider:
  // - govt_holiday_responses: directly via useRealtimeHandler (client-side filtered to viewed staff)
  // - chuti + leave_settlements: forwarded as DOM events by the dashboard handler

  // ── govt_holiday_responses handler ──
  const handleHolidayResponseRealtime = useCallback((payload: RealtimePayload) => {
    if (!viewingStaff) return;
    const rec = payload?.new || payload?.old;
    if (rec?.user_id === viewingStaff.id) {
      debouncedFetchStaffLeaveData(viewingStaff.id);
    }
  }, [viewingStaff, debouncedFetchStaffLeaveData]);

  useRealtimeHandler('govt_holiday_responses', handleHolidayResponseRealtime);

  // ── chuti + leave_settlements direct realtime handlers ──
  const handleChutiRealtime = useCallback((payload: RealtimePayload) => {
    if (!viewingStaff) return;
    const isSupervisedByMe = hasStaffAccess(viewingStaff);
    if (!isSupervisedByMe) return;

    const rec = payload?.new || payload?.old;
    if (rec?.user_id === viewingStaff.id) {
      debouncedFetchStaffLeaveData(viewingStaff.id);
    }
  }, [viewingStaff, debouncedFetchStaffLeaveData, hasStaffAccess]);

  useRealtimeHandler('chuti', handleChutiRealtime);
  useRealtimeHandler('leave_settlements', handleChutiRealtime);

  // ── chuti + leave_settlements (also forward via DOM events from dashboard) ──
  useAppEvent('realtime-table-payload', (payloadData) => {
    if (!viewingStaff) return;
    const isSupervisedByMe = hasStaffAccess(viewingStaff);
    if (!isSupervisedByMe) return;

    const detail = payloadData as { table?: string; payload?: RealtimePayload } | undefined;
    if (!detail || (detail.table !== 'chuti' && detail.table !== 'leave_settlements')) return;
    const rec = detail.payload?.new || detail.payload?.old;
    if (rec?.user_id === viewingStaff.id) {
      debouncedFetchStaffLeaveData(viewingStaff.id);
    }
  }, [viewingStaff, debouncedFetchStaffLeaveData, hasStaffAccess]);

  const handleAdminUpdateHolidayResponse = useCallback(async (
    targetUserId: string,
    holidayDate: string,
    holidayName: string,
    response: 'paid' | 'reserve',
    salaryMonth?: string,
    salaryYear?: string
  ) => {
    if (!profile || !isAdminRole(profile)) return false;

    const { error } = await holidaysService.convertGovtHolidayResponse(
      targetUserId,
      holidayDate,
      response,
    );

    if (error) {
      toast.error('Failed to update holiday response: ' + error.message);
      return false;
    }

    if (response === 'paid' && salaryMonth) {
      const year = salaryYear || new Date().getFullYear().toString();
      try {
        await chutiService.createLeaveSettlement({
          user_id: targetUserId,
          year,
          period: 'Instant',
          leave_category: 'Govt Holiday',
          remaining_days: 1,
          action_type: 'payment',
          payment_days: 1,
          status: 'processed',
          action_by: `Government Holiday dated ${formatDate(holidayDate)} (${holidayName || 'Govt Holiday'}) was converted to payment with ${salaryMonth} ${year} salary.`,
        });
      } catch (e) {
        console.error('Failed to create payment settlement log:', e);
      }
    }

    toast.success('Updated holiday response!');
    debouncedFetchStaffLeaveData(targetUserId);
    return true;
  }, [profile, debouncedFetchStaffLeaveData]);

  // Toggle adjustment handler for leaves in details view
  const handleToggleAdjustment = async (record: ChutiRecord) => {
    const isAdmin = isAdminRole(profile);
    const isSupervisor = profile?.role === 'supervisor';

    if (isAdmin) {
      if (record.adjustment || record.adjusted_hour) {
        // Toggle OFF directly
        try {
          const cleanComment = getCleanComment(record.comment);
          const approvalsPrefix = getApprovalsPrefix(record.comment);
          const restoredComment = cleanComment
            ? (approvalsPrefix ? `${approvalsPrefix} | ${cleanComment}` : cleanComment)
            : (approvalsPrefix || null);

          setViewingStaffRecords(prev => prev.map(r => r.id === record.id ? { 
            ...r, 
            adjustment: false, 
            adjusted_hour: null, 
            adjust_short_leave: false, 
            reserve_holiday: null, 
            comment: restoredComment 
          } : r));

          const existingNotifications = getExistingNotifications(record);
          const leaveLabel = getDetailedLeaveLabel(record);
          const dateTimeStr = formatDate(record.date);
          const newNotification = createNotification(
            'cancelled',
            'Leave Adjustment Cancelled ⚠️',
            `Your adjustment for ${leaveLabel} on date ${dateTimeStr} has been cancelled.`
          );
          const { error } = await supabase
            .from('chuti')
            .update({
              adjustment: false,
              adjusted_hour: null,
              adjust_short_leave: false,
              reserve_holiday: null,
              reserve_adjustment_status: 'none',
              comment: restoredComment,
              admin_edit_request: {
                notifications: [...existingNotifications, newNotification]
              }
            })
            .eq('id', record.id);
          if (error) throw error;
          toast.success('Adjustment status cancelled.');
          if (viewingStaff) debouncedFetchStaffLeaveData(viewingStaff.id, true);
        } catch (err: unknown) {
          console.error(err);
          toast.error('Failed to update adjustment: ' + ((err as Error).message || 'unknown error'));
          if (viewingStaff) fetchStaffLeaveData(viewingStaff.id, true);
        }
      } else {
        // Open modal to choose Salary Adjustment, Full, Partial, or Category
        setStaffAdjustmentRecord(record);
        setStaffAdjustShortLeaveOption(record.adjust_short_leave === true);
        if (['Short Leave', 'Early Leave', 'Late Join'].includes(record.leave_type)) {
          setStaffAdjustmentType('full');
          setStaffPartialAdjustmentTime(record.leave_hour ? record.leave_hour.toString().split('.')[0].substring(0, 5) : '02:00');
        }
        setShowStaffAdjustmentModal(true);
      }
    } else if (isSupervisor) {
      // ─── Supervisor: Toggle needs admin approval ───
      try {
        const newValue = !record.adjustment;
        // Set status to approved_by_supervisor → admin needs to approve
        setViewingStaffRecords(prev => prev.map(r => r.id === record.id ? { ...r, adjustment: newValue, status: 'approved_by_supervisor' as ChutiRecord['status'] } : r));
        const supervisorName = profile?.username?.toUpperCase() || 'SUPERVISOR';
        const editLog = `\n[Adjustment toggled to ${newValue ? 'Yes' : 'No'} by ${supervisorName} — pending admin approval]`;
        const updatedComment = (record.comment || '') + editLog;
        const { error } = await supabase
          .from('chuti')
          .update({ adjustment: newValue, status: 'approved_by_supervisor', comment: updatedComment, is_edited: true })
          .eq('id', record.id);
        if (error) throw error;
        toast.success('Adjustment toggled. Pending admin approval.');
        if (viewingStaff) debouncedFetchStaffLeaveData(viewingStaff.id, true);
      } catch (err: unknown) {
        console.error(err);
        toast.error('Failed to update adjustment: ' + ((err as Error).message || 'unknown error'));
        if (viewingStaff) fetchStaffLeaveData(viewingStaff.id, true);
      }
    } else {
      toast.error('You do not have permission to toggle adjustments.');
    }
  };

  // Save Staff Adjustment handler from modal
  const handleSaveStaffAdjustment = async (
    overrideAdjustShortLeave?: boolean,
    adjustmentCategoryInput?: string,
    specificHoliday?: { date: string; name: string } | null,
    salaryInfo?: { month: string; year: string } | null,
    generalDetails?: string | null
  ) => {
    if (!staffAdjustmentRecord || staffAdjustmentSubmitting) return;
    setStaffAdjustmentSubmitting(true);
    const record = staffAdjustmentRecord;
    try {
      const selectedCat = adjustmentCategoryInput || 'None';
      let requestedUpdates: Record<string, unknown> = {};

      if (selectedCat === 'Salary') {
        const salaryLabel = salaryInfo ? `${salaryInfo.month} ${salaryInfo.year}` : `${new Date().toLocaleString('en-US', { month: 'long' })} ${new Date().getFullYear()}`;
        const cleanComment = getCleanComment(record.comment);
        const approvalsPrefix = getApprovalsPrefix(record.comment);
        const adjMessage = `Adjusted with ${salaryLabel} salary deduction.`;
        const finalComment = `${approvalsPrefix ? `${approvalsPrefix} | ` : ''}${adjMessage}${cleanComment ? ` | ${cleanComment}` : ''}`;
        requestedUpdates = {
          adjustment: true,
          adjusted_hour: null,
          adjust_short_leave: false,
          reserve_holiday: 'Salary',
          comment: finalComment || null,
          admin_edit_request: {
            salary_month: salaryInfo?.month || null,
            salary_year: salaryInfo?.year || null,
          }
        };
      } else if (selectedCat === 'Govt Holiday' && specificHoliday) {
        const cleanComment = getCleanComment(record.comment);
        const approvalsPrefix = getApprovalsPrefix(record.comment);
        const adjMessage = `Adjusted with Government Holiday on ${formatDate(specificHoliday.date)} — ${specificHoliday.name}`;
        const finalComment = `${approvalsPrefix ? `${approvalsPrefix} | ` : ''}${adjMessage}${cleanComment ? ` | ${cleanComment}` : ''}`;
        requestedUpdates = {
          adjustment: true,
          adjusted_hour: null,
          adjust_short_leave: false,
          reserve_holiday: `${specificHoliday.date} — ${specificHoliday.name}`,
          comment: finalComment || null,
          admin_edit_request: {
            holiday_date: specificHoliday.date,
            holiday_name: specificHoliday.name,
          }
        };
      } else if (selectedCat === 'General Adjustment' || (record.leave_type === 'Full Leave' && selectedCat === 'None')) {
        const reason = generalDetails?.trim() || '';
        const cleanComment = getCleanComment(record.comment);
        const approvalsPrefix = getApprovalsPrefix(record.comment);
        const adjMessage = reason ? `Adjusted with General Adjustment — ${reason}` : 'Adjusted with General Adjustment';
        const finalComment = `${approvalsPrefix ? `${approvalsPrefix} | ` : ''}${adjMessage}${cleanComment ? ` | ${cleanComment}` : ''}`;
        requestedUpdates = {
          adjustment: true,
          adjusted_hour: null,
          adjust_short_leave: false,
          reserve_holiday: 'General Adjustment',
          comment: finalComment || null,
          admin_edit_request: {
            adjustment_source: 'General Adjustment',
            adjustment_reason: reason,
          }
        };
      } else if (['Short Leave', 'Early Leave', 'Late Join'].includes(record.leave_type)) {
        if (selectedCat === 'Govt Holiday' || selectedCat === 'Eid-ul-Fitr' || selectedCat === 'Eid-ul-Adha') {
          const cleanComment = getCleanComment(record.comment);
          const approvalsPrefix = getApprovalsPrefix(record.comment);
          const finalComment = `${approvalsPrefix ? `${approvalsPrefix} | ` : ''}Adjusted: ${selectedCat}${cleanComment ? ` | ${cleanComment}` : ''}`;
          requestedUpdates = {
            adjustment: true,
            adjusted_hour: null,
            adjust_short_leave: false,
            reserve_holiday: selectedCat,
            comment: finalComment || null
          };
        } else if (staffAdjustmentType === 'full') {
          const cleanComment = getCleanComment(record.comment);
          const approvalsPrefix = getApprovalsPrefix(record.comment);
          const finalComment = `${approvalsPrefix ? `${approvalsPrefix} | ` : ''}Adjusted: Overtime${cleanComment ? ` | ${cleanComment}` : ''}`;
          requestedUpdates = { adjustment: true, adjusted_hour: null, adjust_short_leave: false, reserve_holiday: null, comment: finalComment || null };
        } else {
          const cleanComment = getCleanComment(record.comment);
          const approvalsPrefix = getApprovalsPrefix(record.comment);
          const finalComment = `${approvalsPrefix ? `${approvalsPrefix} | ` : ''}Adjusted: partial (${staffPartialAdjustmentTime})${cleanComment ? ` | ${cleanComment}` : ''}`;
          requestedUpdates = { adjustment: false, adjusted_hour: `${staffPartialAdjustmentTime}:00`, adjust_short_leave: false, reserve_holiday: null, comment: finalComment || null };
        }
      } else if (record.leave_type === 'Overtime') {
        const shouldAdjust = overrideAdjustShortLeave !== undefined ? overrideAdjustShortLeave : staffAdjustShortLeaveOption;
        const cleanComment = getCleanComment(record.comment);
        const approvalsPrefix = getApprovalsPrefix(record.comment);
        const finalComment = shouldAdjust ? `${approvalsPrefix ? `${approvalsPrefix} | ` : ''}Adjusted: Short Leave${cleanComment ? ` | ${cleanComment}` : ''}` : (cleanComment ? `${approvalsPrefix ? `${approvalsPrefix} | ` : ''}${cleanComment}` : (approvalsPrefix || null));
        requestedUpdates = { adjustment: true, adjusted_hour: null, adjust_short_leave: shouldAdjust, reserve_holiday: null, comment: finalComment || null };
      } else {
        const isCat = selectedCat !== 'None';
        const cleanComment = getCleanComment(record.comment);
        const approvalsPrefix = getApprovalsPrefix(record.comment);
        const finalComment = isCat 
          ? `${approvalsPrefix ? `${approvalsPrefix} | ` : ''}Adjusted: ${selectedCat}${cleanComment ? ` | ${cleanComment}` : ''}`
          : (cleanComment ? `${approvalsPrefix ? `${approvalsPrefix} | ` : ''}${cleanComment}` : (approvalsPrefix || null));
        requestedUpdates = {
          adjustment: true,
          adjusted_hour: null,
          adjust_short_leave: false,
          reserve_holiday: isCat ? selectedCat : null,
          comment: finalComment || null
        };
      }

      const existingNotifications = getExistingNotifications(record);
      let notifTitle = 'Leave Adjustment Completed ✅';
      let notifBody = '';

      if (selectedCat === 'Salary') {
        const salaryLabel = salaryInfo ? `${salaryInfo.month} ${salaryInfo.year}` : `${new Date().toLocaleString('en-US', { month: 'long' })} ${new Date().getFullYear()}`;
        notifTitle = 'Salary Adjustment Applied 💸';
        notifBody = `Your leave for ${formatDate(record.date)} has been adjusted with ${salaryLabel} salary deduction.`;
      } else if (selectedCat === 'Govt Holiday' && specificHoliday) {
        notifTitle = 'Government Holiday Adjustment Applied 📅';
        notifBody = `Your leave for ${formatDate(record.date)} has been adjusted with the Government Holiday of ${formatDate(specificHoliday.date)} — ${specificHoliday.name}.`;
      } else if (selectedCat === 'General Adjustment' || (record.leave_type === 'Full Leave' && selectedCat === 'None')) {
        notifTitle = 'Leave Adjusted (General) ⚙️';
        notifBody = `Your Full Leave on ${formatDate(record.date)} has been adjusted: ${generalDetails?.trim() || 'General Adjustment'}.`;
      } else {
        const leaveLabel = getDetailedLeaveLabel(record);
        const dateTimeStr = formatDate(record.date);
        notifBody = `Your ${leaveLabel} adjustment for date ${dateTimeStr} has been completed.`;
      }

      const newNotification = createNotification('adjusted', notifTitle, notifBody);

      const mergedMeta = {
        ...((record.admin_edit_request as Record<string, unknown>) || {}),
        ...((requestedUpdates.admin_edit_request as Record<string, unknown>) || {}),
        notifications: [...existingNotifications, newNotification]
      };

      const updates = {
        ...requestedUpdates,
        reserve_adjustment_status: 'none',
        admin_edit_request: mergedMeta
      };

      setViewingStaffRecords(prev => prev.map(r => r.id === record.id ? { ...r, ...updates } : r));

      const { error } = await supabase
        .from('chuti')
        .update(updates)
        .eq('id', record.id);

      if (error) throw error;

      toast.success(selectedCat === 'Salary' ? 'Leave adjusted with salary deduction.' : 'Adjustment completed successfully.');
      if (viewingStaff) debouncedFetchStaffLeaveData(viewingStaff.id, true);
    } catch (err: unknown) {
      console.error(err);
      toast.error('Failed to update adjustment: ' + ((err as Error).message || 'unknown error'));
      if (viewingStaff) fetchStaffLeaveData(viewingStaff.id, true);
    } finally {
      setShowStaffAdjustmentModal(false);
      setStaffAdjustmentRecord(null);
      setStaffAdjustmentSubmitting(false);
    }
  };

  // Delete handler for leaves in details view
  const handleDeleteRecord = async (record: ChutiRecord) => {
    try {
      // Optimistically remove record from local state immediately
      setViewingStaffRecords(prev => prev.filter(r => r.id !== record.id));

      const { error } = await supabase
        .from('chuti')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', record.id);

      if (error) throw error;

      // Log direct deletion so the affected employee receives a notification
      if (sessionUser && record.id && record.user_id) {
        try {
          await supabase.from('leave_delete_requests').insert({
            leave_id: record.id,
            requester_id: record.user_id,
            status: 'approved',
            reason: 'Direct deletion by Admin',
            reviewed_by: sessionUser.id,
            reviewed_at: new Date().toISOString(),
          } as any);
        } catch (e) {
          console.error('Failed to log admin direct delete event:', e);
        }
      }

      toast.success('Leave entry deleted successfully.');
      if (viewingStaff) {
        debouncedFetchStaffLeaveData(viewingStaff.id, true);
      }
    } catch (err: unknown) {
      console.error(err);
      toast.error('Failed to delete entry: ' + ((err as Error).message || 'unknown error'));
      if (viewingStaff) {
        fetchStaffLeaveData(viewingStaff.id, true);
      }
    }
  };

  const showToast = useCallback((type: 'success' | 'error', text: string) => {
    if (type === 'success') toast.success(text);
    else toast.error(text);
  }, []);

  const logActivity = async (_actionType: string, _targetId: string | null, _details: string) => {};

  // Setup Admin Actions hook
  const { createUser, resetUserPassword, deleteUser, adminUpdateUserProfile, resetAllUserFeatureFlags } = useAdminActions({
    profilesList: profiles,
    setProfilesList: setProfiles,
    showToast,
    logActivity,
    setSubmitting,
    updateLastActivity: () => {},
  });

  // Handle password update for viewingStaff
  const handleUpdatePassword = async () => {
    if (!viewingStaff) return;
    if (credNewPassword !== credConfirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (credNewPassword.length < 4) {
      toast.error('Password must be at least 4 characters');
      return;
    }

    setUpdatingCredentials(true);
    const success = await resetUserPassword(viewingStaff.id, credNewPassword);
    setUpdatingCredentials(false);
    if (success) {
      toast.success('Password updated successfully.');
      setShowCredentialsModal(false);
      setCredNewPassword('');
      setCredConfirmPassword('');
      fetchProfiles();
    }
  };

  const handleResetPasswordDefault = async () => {
    if (!viewingStaff) return;
    setSubmitting(true);
    const success = await resetUserPassword(viewingStaff.id, '1234');
    if (success) {
      toast.success('Password reset to default (1234). User must change it next login.');
      fetchProfiles();
      setShowResetConfirmModal(false);
    }
    setSubmitting(false);
  };

  // R1/R2: fetchProfiles now proxies to the shared ProfilesContext refresh —
  // post-mutation refreshes update every consumer (chuti/quotes/navbar) at once.
  const fetchProfiles = useCallback(async () => {
    setIsLoading(true);
    try {
      await refreshProfiles({ force: true });
    } finally {
      setIsLoading(false);
    }
  }, [refreshProfiles]);

  useEffect(() => {
    // Provider owns the initial fetch — show the skeleton only until its
    // first load (cache or network) resolves, then just mirror its state.
    if (profilesLoaded) {
      setIsLoading(false);
    }
  }, [profilesLoaded]);

  const handleCreateUserWrapper = async (params: {
    codename: string;
    role: 'admin' | 'supervisor' | 'user' | 'superadmin';
    fullName: string;
    initialChutiCount: number; 
    initialPassword?: string; 
    quoteTypes: string[]; 
    canManageRules: boolean; 
    needsApproval: boolean; 
    supervisorIds: string[]; 
    eligibleGovtHoliday: boolean; 
    eligibleOfficeLeave: boolean; 
    allowOvertime: boolean; 
    allowReserve: boolean; 
    allowedTypes: string[]; 
    hasChutiAccess: boolean; 
    hasQuotesAccess: boolean; 
    password?: string;
    jobRole?: string;
    workingHours?: number;
    breakTime?: number;
    defaultSignIn?: string;
    defaultSignOut?: string;
    kpiSkills?: string[];
    kpiDeptIndicators?: string[];
    performsDataEntry?: boolean;
    department?: string;
    performsOtherDeptTasks?: boolean;
    otherDepartment?: string;
    kpiOtherDeptIndicators?: string[];
  }) => {
    const pw = await createUser(
      params.codename,
      params.role,
      params.fullName,
      params.allowedTypes,
      params.canManageRules,
      params.hasChutiAccess,
      params.hasQuotesAccess,
      params.password,
      params.needsApproval,
      params.supervisorIds,
      params.eligibleGovtHoliday,
      params.eligibleOfficeLeave,
      params.allowOvertime,
      params.allowReserve,
      params.jobRole,
      params.workingHours,
      params.breakTime,
      params.defaultSignIn,
      params.defaultSignOut,
      params.kpiSkills,
      params.kpiDeptIndicators,
      params.performsDataEntry,
      params.department,
      params.performsOtherDeptTasks,
      params.otherDepartment,
      params.kpiOtherDeptIndicators
    );
    return pw;
  };

  const handleUpdateUser = async () => {
    if (!viewingStaff) return;

    const canEdit = isAdmin || profile?.role === 'supervisor';
    if (!canEdit) {
      toast.error('You do not have permission to update this profile.');
      return;
    }

    if (editHasQuotesAccess && editUserAllowedTypes.length === 0) {
      toast.error('Please select at least one permitted file type for Quotes.');
      return;
    }
    if (editUserRole !== 'admin' && editUserRole !== 'superadmin' && !editHasChutiAccess && !editHasQuotesAccess) {
      toast.error('Please select at least one workspace access.');
      return;
    }

    setSubmitting(true);
    const success = await adminUpdateUserProfile(
      viewingStaff.id,
      editUserFullName,
      editUserRole,
      editHasQuotesAccess ? editUserAllowedTypes : [],
      editUserCanManageRules,
      editHasChutiAccess,
      editHasQuotesAccess,
      profile?.role === 'supervisor' ? 'supervisor' : 'admin',
      editNeedsApproval,
      editNeedsApproval ? editSupervisorIds : [],
      editEligibleGovtHoliday,
      editEligibleOfficeLeave,
      editAllowOvertime,
      editAllowReserve,
      editUserCodename,
      editUserJobRole,
      parseFloat(editUserWorkingHours) || 9.5,
      parseInt(editUserBreakTime) || 0,
      editUserSignInTime,
      editUserSignOutTime,
      editUserKpiSkills,
      editUserKpiDeptIndicators,
      editUserPerformsDataEntry,
      editUserDepartment,
      editUserPerformsOtherDeptTasks,
      editUserOtherDepartment,
      editUserKpiOtherDeptIndicators,
      editDelegatedLeaveSupervisorId,
      editDelegatedKpiSupervisorId,
      editUserFeatureFlags
    );

    setSubmitting(false);

    if (success) {
      // adminUpdateUserProfile already refreshed the shared profiles list via
      // ProfilesProvider — only the updated row is needed here to sync the
      // viewingStaff panel (single-row select, not another full-table fetch).
      const { data } = await supabase
        .from('profiles')
        .select(PROFILE_COLUMNS)
        .eq('id', viewingStaff.id)
        .maybeSingle();
      if (data) {
        const updated = mapProfilePasswordResetStatus(data as unknown as Profile);
        updateViewingStaff(updated);
        if (updated.id === profile?.id) {
          localStorage.setItem(`cached_profile_${profile.id}`, JSON.stringify(updated));
          emit('profile-updated', updated);
        }
      }
    }
  };

  const handleDeleteConfirm = async () => {
    if (deletingUserAccount) {
      await deleteUser(deletingUserAccount.id);
      setDeletingUserAccount(null);
      fetchProfiles();
    }
  };

  const visibleProfiles = profiles
    .filter(() => {
      // Supervisors and Admins can see all users in the list
      return true;
    })
    .filter((u) => {
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      return (
        u.username.toLowerCase().includes(q) ||
        (u.full_name || '').toLowerCase().includes(q)
      );
    });

  const isAdmin = isAdminRole(profile);

  // Available Years for viewed user
  const availableYears = React.useMemo(() => {
    const years = new Set([new Date().getFullYear().toString()]);
    viewingStaffRecords.forEach(r => {
      if (r.date) {
        years.add(r.date.substring(0, 4));
      }
    });
    return Array.from(years).sort().reverse();
  }, [viewingStaffRecords]);

  return (
    <>
      {(viewingStaff || isCreatingNewUser) ? (
        <div className="space-y-6 animate-modal-content">
          {/* Header/Top Box */}
          <div className="bg-theme-card-bg/40 backdrop-blur-xl border border-theme-border-muted shadow-2xl rounded-2xl p-6 flex flex-col gap-4">
            <div className="flex justify-between items-start md:items-center flex-col md:flex-row gap-6 w-full max-w-full overflow-hidden">
              <div className="flex items-start sm:items-center gap-3 sm:gap-4 max-w-full overflow-hidden">
                <button
                  id="user-manage-detail-back"
                  onClick={() => {
                    updateViewingStaff(null);
                    setIsCreatingNewUser(false);
                  }}
                  className="p-2.5 bg-theme-border-muted border border-theme-border-active text-theme-text-secondary rounded-xl hover:bg-theme-border-active transition-all cursor-pointer shrink-0 mt-0.5 sm:mt-0"
                  title="Go Back"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg sm:text-xl font-bold text-theme-text-primary flex items-center flex-wrap gap-y-1 break-words max-w-full">
                    {isCreatingNewUser ? (
                      'Add New Staff'
                    ) : (
                      viewingStaff && (
                        <UserDisplayName
                          profile={viewingStaff}
                          badge={effectiveBadges[viewingStaff.id] || (viewingStaff.global_settings?.top_performer_badge as BadgeInfo) || null}
                          tooltipPosition="bottom"
                        />
                      )
                    )}
                  </h2>
                  {!isCreatingNewUser && viewingStaff && (
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-theme-text-muted">
                      <div>Working Hours: <strong className="text-theme-text-primary">{viewingStaff.working_hours || 9.5} hrs</strong></div>
                      <div>Break Time: <strong className="text-theme-text-primary">{viewingStaff.break_time || 0} mins</strong></div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Employee 360 Hub Subtabs (Horizontal Top Tabs) */}
            {!isCreatingNewUser && viewingStaff && (
              <div className="flex border-b border-theme-border-input gap-1 mt-2 overflow-x-auto whitespace-nowrap scrollbar-none pb-px max-w-full">
                {viewingStaff.has_chuti_access && canAccessUserProfileSubtab(profile, 'user_profile_leave', globalSettings, profiles) && canAccessModule(profile, viewingStaff, 'leave', profiles) && (
                  <button
                    type="button"
                    onClick={() => handleSetActiveSubTab('leave')}
                    className={`px-4 py-2 text-xs font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                      activeSubTab === 'leave'
                        ? 'border-blue-500 text-blue-400 font-bold'
                        : 'border-transparent text-theme-text-muted hover:text-theme-text-primary'
                    }`}
                  >
                    <Calendar className="h-3.5 w-3.5" /> Leave History
                  </button>
                )}
                {viewingStaff.has_quotes_access && canAccessUserProfileSubtab(profile, 'user_profile_quotes', globalSettings, profiles) && canAccessModule(profile, viewingStaff, 'quotes', profiles) && (
                  <button
                    type="button"
                    onClick={() => handleSetActiveSubTab('quotes')}
                    className={`px-4 py-2 text-xs font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                      activeSubTab === 'quotes'
                        ? 'border-blue-500 text-blue-400 font-bold'
                        : 'border-transparent text-theme-text-muted hover:text-theme-text-primary'
                    }`}
                  >
                    <FileText className="h-3.5 w-3.5 text-purple-400" /> Quotes History
                  </button>
                )}
                {viewingStaff.has_quotes_access && canAccessUserProfileSubtab(profile, 'user_profile_analytics', globalSettings, profiles) && canAccessModule(profile, viewingStaff, 'quotes', profiles) && (
                  <button
                    type="button"
                    onClick={() => handleSetActiveSubTab('analytics')}
                    className={`px-4 py-2 text-xs font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                      activeSubTab === 'analytics'
                        ? 'border-blue-500 text-blue-400 font-bold'
                        : 'border-transparent text-theme-text-muted hover:text-theme-text-primary'
                    }`}
                  >
                    <TrendingUp className="h-3.5 w-3.5 text-indigo-400" /> Report
                  </button>
                )}
                {viewingStaff.has_quotes_access && canAccessUserProfileSubtab(profile, 'user_profile_kpi', globalSettings, profiles) && canAccessModule(profile, viewingStaff, 'kpi', profiles) && (
                  <button
                    type="button"
                    onClick={() => handleSetActiveSubTab('kpi')}
                    className={`px-4 py-2 text-xs font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                      activeSubTab === 'kpi'
                        ? 'border-blue-500 text-blue-400 font-bold'
                        : 'border-transparent text-theme-text-muted hover:text-theme-text-primary'
                    }`}
                  >
                    <BarChart2 className="h-3.5 w-3.5" /> KPI & Performance
                  </button>
                )}
                {canAccessUserProfileSubtab(profile, 'user_profile_settings', globalSettings, profiles) && (
                  <button
                    type="button"
                    onClick={() => handleSetActiveSubTab('profile')}
                    className={`px-4 py-2 text-xs font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                      activeSubTab === 'profile'
                        ? 'border-blue-500 text-blue-400 font-bold'
                        : 'border-transparent text-theme-text-muted hover:text-theme-text-primary'
                    }`}
                  >
                    <Settings className="h-3.5 w-3.5" /> Profile Settings
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Form / Tab contents */}
          {isCreatingNewUser ? (
            <CreateUserPanel
              isAdmin={isAdmin}
              currentUser={profile}
              profiles={profiles}
              submitting={submitting}
              onCancel={() => setIsCreatingNewUser(false)}
              onCreateUser={handleCreateUserWrapper}
              onSuccess={() => {
                setIsCreatingNewUser(false);
                fetchProfiles();
              }}
            />
          ) : (
            <>
              {activeSubTab === 'profile' && viewingStaff && (
                <UserProfileSettingsPanel
                  isAdmin={isAdmin}
                  currentUser={profile}
                  submitting={submitting}
                  profiles={profiles}
                  viewingStaff={viewingStaff}
                  editUserCodename={editUserCodename}
                  setEditUserCodename={setEditUserCodename}
                  editUserFullName={editUserFullName}
                  setEditUserFullName={setEditUserFullName}
                  editUserRole={editUserRole}
                  setEditUserRole={setEditUserRole}
                  editHasChutiAccess={editHasChutiAccess}
                  setEditHasChutiAccess={setEditHasChutiAccess}
                  editNeedsApproval={editNeedsApproval}
                  setEditNeedsApproval={setEditNeedsApproval}
                  editSupervisorIds={editSupervisorIds}
                  setEditSupervisorIds={setEditSupervisorIds}
                  editEligibleOfficeLeave={editEligibleOfficeLeave}
                  setEditEligibleOfficeLeave={setEditEligibleOfficeLeave}
                  editEligibleGovtHoliday={editEligibleGovtHoliday}
                  setEditEligibleGovtHoliday={setEditEligibleGovtHoliday}
                  editAllowOvertime={editAllowOvertime}
                  setEditAllowOvertime={setEditAllowOvertime}
                  editAllowReserve={editAllowReserve}
                  setEditAllowReserve={setEditAllowReserve}
                  editHasQuotesAccess={editHasQuotesAccess}
                  setEditHasQuotesAccess={setEditHasQuotesAccess}
                  editUserAllowedTypes={editUserAllowedTypes}
                  setEditUserAllowedTypes={setEditUserAllowedTypes}
                  editUserCanManageRules={editUserCanManageRules}
                  setEditUserCanManageRules={setEditUserCanManageRules}
                  onResetPasswordClick={() => setShowResetConfirmModal(true)}
                  onChangePasswordClick={() => {
                    setCredNewPassword('');
                    setCredConfirmPassword('');
                    setShowCredentialsModal(true);
                  }}
                  onDeleteAccountClick={() => setDeletingUserAccount({ id: viewingStaff.id, username: viewingStaff.username })}
                  onSaveProfileClick={handleUpdateUser}
                  isSupervisor={profile?.role === 'supervisor' && hasStaffAccess(viewingStaff)}
                  editUserJobRole={editUserJobRole}
                  setEditUserJobRole={setEditUserJobRole}
                  editUserWorkingHours={editUserWorkingHours}
                  setEditUserWorkingHours={setEditUserWorkingHours}
                  editUserBreakTime={editUserBreakTime}
                  setEditUserBreakTime={setEditUserBreakTime}
                  editUserSignInTime={editUserSignInTime}
                  setEditUserSignInTime={setEditUserSignInTime}
                  editUserSignOutTime={editUserSignOutTime}
                  setEditUserSignOutTime={setEditUserSignOutTime}
                  editUserKpiSkills={editUserKpiSkills}
                  setEditUserKpiSkills={setEditUserKpiSkills}
                  editUserKpiDeptIndicators={editUserKpiDeptIndicators}
                  setEditUserKpiDeptIndicators={setEditUserKpiDeptIndicators}
                  editUserKpiOtherDeptIndicators={editUserKpiOtherDeptIndicators}
                  setEditUserKpiOtherDeptIndicators={setEditUserKpiOtherDeptIndicators}
                  editUserPerformsDataEntry={editUserPerformsDataEntry}
                  setEditUserPerformsDataEntry={setEditUserPerformsDataEntry}
                  editUserDepartment={editUserDepartment}
                  setEditUserDepartment={setEditUserDepartment}
                  editUserPerformsOtherDeptTasks={editUserPerformsOtherDeptTasks}
                  setEditUserPerformsOtherDeptTasks={setEditUserPerformsOtherDeptTasks}
                  editUserOtherDepartment={editUserOtherDepartment}
                  setEditUserOtherDepartment={setEditUserOtherDepartment}
                  editDelegatedLeaveSupervisorId={editDelegatedLeaveSupervisorId}
                  setEditDelegatedLeaveSupervisorId={setEditDelegatedLeaveSupervisorId}
                  editDelegatedKpiSupervisorId={editDelegatedKpiSupervisorId}
                  setEditDelegatedKpiSupervisorId={setEditDelegatedKpiSupervisorId}
                  editUserFeatureFlags={editUserFeatureFlags}
                  setEditUserFeatureFlags={setEditUserFeatureFlags}
                  onResetAllUserFlags={resetAllUserFeatureFlags}
                  hasChanges={hasUserChanges}
                  onViewKpiReport={(periodKey) => {
                    setPreSelectedKpiPeriodKey(periodKey);
                    setActiveSubTab('kpi');
                  }}
                />
              )}

              {activeSubTab === 'leave' && viewingStaff && viewingStaff.has_chuti_access && canAccessModule(profile, viewingStaff, 'leave', profiles) && (
                (showAddLeaveForStaff || editingLeaveRecord) && (profile?.role === 'supervisor' || isAdminRole(profile)) && globalSettings ? (
                  // Full-page AddLeave view for supervisor/admin adding on behalf or editing
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 pb-3 border-b border-theme-border-input/60">
                      <button
                        onClick={() => {
                          setShowAddLeaveForStaff(false);
                          setEditingLeaveRecord(null);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-theme-border-input bg-theme-card-bg/60 hover:bg-theme-border-input text-xs font-semibold text-theme-text-secondary hover:text-theme-text-primary transition-all cursor-pointer"
                      >
                        <ArrowLeft className="h-3.5 w-3.5" />
                      </button>
                      <div>
                        <p className="text-xs text-theme-text-muted">
                          {editingLeaveRecord ? (
                            <>
                              Editing leave for{' '}
                              <span className="text-theme-text-primary font-semibold">{viewingStaff.full_name || viewingStaff.username}</span>{' '}
                              ({viewingStaff.username?.toUpperCase()})
                            </>
                          ) : (
                            <>
                              Adding leave on behalf of{' '}
                              <span className="text-theme-text-primary font-semibold">{viewingStaff.full_name || viewingStaff.username}</span>{' '}
                              ({viewingStaff.username?.toUpperCase()})
                            </>
                          )}
                        </p>
                      </div>
                    </div>
                    <AddLeave
                      profile={profile}
                      profilesList={profiles}
                      records={viewingStaffRecords}
                      globalSettings={globalSettings}
                      leaveSettlements={viewingStaffSettlements}
                      editingRecord={editingLeaveRecord}
                      onSuccess={(newRecords) => {
                        if (newRecords && Array.isArray(newRecords) && newRecords.length > 0) {
                          if (editingLeaveRecord) {
                            // Update existing record in list
                            setViewingStaffRecords(prev => sortChutiRecordsDescending(prev.map(r => r.id === editingLeaveRecord.id ? { ...r, ...newRecords[0] } : r)));
                          } else {
                            // Prepend new records & sort descending
                            setViewingStaffRecords(prev => sortChutiRecordsDescending([...newRecords, ...prev]));
                          }
                        }
                        setShowAddLeaveForStaff(false);
                        setEditingLeaveRecord(null);
                        setActiveSubTab('leave');
                        debouncedFetchStaffLeaveData(viewingStaff.id, true);
                      }}
                      onConvertShortLeaveToFullLeave={() => {}}
                      holidayResponses={viewingStaffHolidayResponses}
                      initialFetchDone={true}
                      targetUser={viewingStaff}
                      addedBySupervisor={profile?.role === 'supervisor' || isAdminRole(profile)}
                      adminDirectEdit={isAdminRole(profile) && viewingStaff?.id !== profile?.id}
                    />
                  </div>
                ) : (
                  <UserLeaveHistoryPanel
                    viewingStaff={viewingStaff}
                    viewingStaffRecords={viewingStaffRecords}
                    viewingStaffSettlements={viewingStaffSettlements}
                    viewingStaffHolidayResponses={viewingStaffHolidayResponses}
                    globalSettings={globalSettings}
                    loadingLeaveData={loadingLeaveData}
                    selectedYear={detailSelectedYear}
                    setSelectedYear={setDetailSelectedYear}
                    availableYears={availableYears}
                    leaveFilterType={leaveFilterType}
                    setLeaveFilterType={setLeaveFilterType}
                    leaveFilterStartDate={leaveFilterStartDate}
                    setLeaveFilterStartDate={setLeaveFilterStartDate}
                    leaveFilterEndDate={leaveFilterEndDate}
                    setLeaveFilterEndDate={setLeaveFilterEndDate}
                    leaveSearchQuery={leaveSearchQuery}
                    setLeaveSearchQuery={setLeaveSearchQuery}
                    onToggleAdjustment={handleToggleAdjustment}
                    onDeleteRecord={handleDeleteRecord}
                    isSupervisor={profile?.role === 'supervisor' || isAdminRole(profile)}
                    onAddLeaveClick={() => setShowAddLeaveForStaff(true)}
                    onEditClick={(record) => setEditingLeaveRecord(record)}
                    hideDelete={profile?.role === 'supervisor'}
                    showAddLeave={isAdminRole(profile) || profile?.role === 'supervisor'}
                    isAdmin={isAdminRole(profile)}
                    onAdminUpdateHolidayResponse={handleAdminUpdateHolidayResponse}
                  />
                )
              )}

              {activeSubTab === 'quotes' && viewingStaff && canAccessModule(profile, viewingStaff, 'quotes', profiles) && (
                <UserQuotesHistoryPanel viewingStaff={viewingStaff} />
              )}

              {activeSubTab === 'analytics' && viewingStaff && canAccessModule(profile, viewingStaff, 'quotes', profiles) && (
                <UserAnalyticsPanel viewingStaff={viewingStaff} profilesList={profiles} />
              )}

              {activeSubTab === 'kpi' && viewingStaff && canAccessModule(profile, viewingStaff, 'kpi', profiles) && (
                <UserKpiPerformancePanel
                  viewingStaff={viewingStaff}
                  preSelectedPeriodKey={preSelectedKpiPeriodKey}
                  setPreSelectedPeriodKey={setPreSelectedKpiPeriodKey}
                />
              )}
            </>
          )}
        </div>
      ) : isLoading ? (
        <UserManagementSkeleton rows={8} />
      ) : (
        <div className="space-y-5">
          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="relative w-full sm:w-80">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-theme-text-muted">
                <Search className="h-4 w-4" />
              </span>
              <input
                type="text"
                placeholder="Search by name or codename..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-theme-page-bg/80 border border-theme-border-input/60 rounded-xl text-xs text-theme-text-primary placeholder-theme-text-muted/50 focus:outline-none focus:border-blue-500/50 transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-theme-text-muted hover:text-theme-text-secondary cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-4 shrink-0">
              <div className="text-[11px] text-theme-text-muted">
                Showing <span className="text-theme-text-primary font-semibold">{visibleProfiles.length}</span> users
              </div>

              {isAdmin && (
                <button
                  onClick={() => {
                    setIsCreatingNewUser(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-blue-950/20 active:scale-95 transition-all cursor-pointer font-sans shrink-0"
                >
                  <UserPlus className="h-4 w-4" />
                  Add New Staff
                </button>
              )}
            </div>
          </div>

          {/* Users Table */}
          <div className="bg-theme-card-bg/40 backdrop-blur-xl rounded-2xl border border-theme-border-input/80 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-theme-border-input/60 bg-theme-page-bg/40 text-[10px] uppercase tracking-wider text-theme-text-muted font-bold">
                    <th className="py-3.5 px-6">Name / Codename</th>
                    <th className="py-3.5 px-4 text-center">Role</th>
                    <th className="py-3.5 px-4 text-center">Leave Tracker</th>
                    <th className="py-3.5 px-4 text-center">Quotes Tracker</th>
                    <th className="py-3.5 px-4 text-center">Todo Access</th>
                    <th className="py-3.5 px-6">File Type</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-theme-border-muted text-xs text-theme-text-secondary">
                  {visibleProfiles.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-theme-text-muted">
                        No users found.
                      </td>
                    </tr>
                  ) : (
                    visibleProfiles.map((u: Profile) => (
                      <tr 
                        key={u.id} 
                        onDoubleClick={() => {
                          const isSupervisedByMe = hasStaffAccess(u);
                          if (isSupervisedByMe && u.has_chuti_access) {
                            handleSetActiveSubTab('leave');
                          } else if (u.has_quotes_access) {
                            handleSetActiveSubTab('quotes');
                          } else if (canAccessUserProfileSubtab(profile, 'user_profile_kpi', globalSettings, profiles)) {
                            handleSetActiveSubTab('kpi');
                          } else {
                            handleSetActiveSubTab('profile');
                          }
                          updateViewingStaff(u);
                        }}
                        className="hover:bg-theme-card-bg/25 transition-colors cursor-pointer select-none"
                        title="Double-click to view details"
                      >
                        <td className="py-3.5 px-6">
                          <div className="flex items-center">
                            <UserDisplayName
                              profile={u}
                              badge={effectiveBadges[u.id] || (u.global_settings?.top_performer_badge as BadgeInfo) || null}
                              tooltipPosition="top"
                              showRank={false}
                            />
                          </div>
                          <div className="text-[10px] text-theme-text-muted uppercase mt-0.5 tracking-wider font-mono">
                            {u.username.trim()}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium border ${
                            getDisplayRole(u.role, profile) === 'superadmin'
                              ? 'bg-amber-950/40 border-amber-900/50 text-amber-400'
                              : getDisplayRole(u.role, profile) === 'admin'
                              ? 'bg-red-950/40 border-red-900/50 text-red-400'
                              : getDisplayRole(u.role, profile) === 'supervisor'
                              ? 'bg-purple-955/40 border-purple-800/50 text-purple-400'
                              : 'bg-theme-border-muted border-theme-border-active text-theme-text-muted'
                          }`}>
                            <Shield className="h-3 w-3 shrink-0" />
                            {getRoleLabel(u.role, profile)}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {u.has_chuti_access ? (
                            <CheckCircle2 className="h-4.5 w-4.5 text-emerald-500 mx-auto" />
                          ) : (
                            <XCircle className="h-4.5 w-4.5 text-theme-text-muted/65 mx-auto" />
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {u.has_quotes_access ? (
                            <CheckCircle2 className="h-4.5 w-4.5 text-emerald-500 mx-auto" />
                          ) : (
                            <XCircle className="h-4.5 w-4.5 text-theme-text-muted/65 mx-auto" />
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {u.role === 'superadmin' || u.has_todo_access ? (
                            <CheckCircle2 className="h-4.5 w-4.5 text-emerald-500 mx-auto" />
                          ) : (
                            <XCircle className="h-4.5 w-4.5 text-theme-text-muted/65 mx-auto" />
                          )}
                        </td>
                        <td className="py-3.5 px-6 max-w-xs truncate" title={(u.allowed_types || []).filter(t => t !== 'Review Van' && t !== 'Review Bike').join(', ')}>
                          {!u.has_quotes_access ? (
                            <span className="text-theme-text-muted/80 italic text-[11px]">No access</span>
                          ) : (u.allowed_types || []).filter(t => t !== 'Review Van' && t !== 'Review Bike').length === ALL_FILE_TYPES.length ? (
                            <span className="text-blue-400 font-medium text-[11px] block">All Categories</span>
                          ) : (u.allowed_types || []).filter(t => t !== 'Review Van' && t !== 'Review Bike').length === 0 ? (
                            <span className="text-red-400/80 font-medium text-[11px] block">None Allowed</span>
                          ) : (
                            <span className="text-theme-text-muted text-[11px] block">{(u.allowed_types || []).filter(t => t !== 'Review Van' && t !== 'Review Bike').join(', ')}</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {mounted && typeof window !== "undefined" && document.getElementById("root-modals-portal") ? (
        createPortal(
          <>


            {/* Reset Password Confirmation Modal */}
            <ConfirmModal
              isOpen={showResetConfirmModal}
              onClose={() => setShowResetConfirmModal(false)}
              onConfirm={handleResetPasswordDefault}
              title="Reset Password to Default"
              message={
                <div className="text-xs text-theme-text-secondary">
                  Are you sure you want to reset the password for <strong className="text-theme-text-primary">{(viewingStaff?.username || '').toUpperCase()}</strong> to the default <strong className="text-blue-400">1234</strong>?
                  <p className="text-[11px] text-theme-text-muted mt-2">The user will be forced to change this default password on their next login.</p>
                </div>
              }
              confirmText="Reset to 1234"
              cancelText="Cancel"
              isDanger={false}
            />

            {/* Change Password Credentials Modal */}
            {showCredentialsModal && viewingStaff && (
              <Modal
                isOpen={showCredentialsModal}
                onClose={() => setShowCredentialsModal(false)}
                title="Change Password Panel"
                icon={<KeyRound className="h-5 w-5 text-blue-500" />}
                maxWidthClass="max-w-md"
                glowClass="bg-blue-900/10"
              >
                <div className="space-y-4 font-sans">
                  <div className="p-3 bg-blue-955/20 border border-blue-900/30 rounded-xl text-xs text-blue-355">
                    <p>💡 Here you can set a new <strong>password</strong> for <strong className="text-theme-text-primary">{viewingStaff.username.toUpperCase()}</strong>.</p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-theme-text-muted uppercase tracking-wider mb-1">New Password</label>
                    <input
                      type="password"
                      placeholder="Enter new password"
                      value={credNewPassword}
                      onChange={(e) => setCredNewPassword(e.target.value)}
                      className="mt-1 block w-full px-3 py-2 bg-theme-page-bg border border-theme-border-input rounded-lg text-theme-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-blue-550"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-theme-text-muted uppercase tracking-wider mb-1">Confirm New Password</label>
                    <input
                      type="password"
                      placeholder="Confirm new password"
                      value={credConfirmPassword}
                      onChange={(e) => setCredConfirmPassword(e.target.value)}
                      className="mt-1 block w-full px-3 py-2 bg-theme-page-bg border border-theme-border-input rounded-lg text-theme-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-blue-550"
                    />
                  </div>

                  <div className="flex gap-3 pt-4 border-t border-theme-border-input/80 font-sans">
                    <button
                      type="button"
                      onClick={() => setShowCredentialsModal(false)}
                      className="flex-1 flex justify-center py-2 px-4 border border-theme-border-input rounded-lg text-xs font-semibold text-theme-text-muted hover:text-theme-text-secondary bg-theme-page-bg hover:bg-theme-card-bg cursor-pointer transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleUpdatePassword}
                      disabled={updatingCredentials || !credNewPassword || credNewPassword !== credConfirmPassword || credNewPassword.length < 4}
                      className="flex-1 py-2 px-4 border border-transparent rounded-lg shadow-sm text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 cursor-pointer transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                    >
                      {updatingCredentials && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      {updatingCredentials ? 'Saving...' : 'Update Password'}
                    </button>
                  </div>
                </div>
              </Modal>
            )}

            {/* Staff Leave Adjustment Modal */}
            <AdjustmentModal
              showAdjustmentModal={showStaffAdjustmentModal}
              setShowAdjustmentModal={setShowStaffAdjustmentModal}
              adjustmentRecord={staffAdjustmentRecord}
              setAdjustmentRecord={setStaffAdjustmentRecord}
              adjustmentType={staffAdjustmentType}
              setAdjustmentType={setStaffAdjustmentType}
              partialAdjustmentTime={staffPartialAdjustmentTime}
              setPartialAdjustmentTime={setStaffPartialAdjustmentTime}
              setAdjustShortLeaveOption={setStaffAdjustShortLeaveOption}
              handleSaveAdjustment={handleSaveStaffAdjustment}
              records={viewingStaffRecords}
              holidayResponses={viewingStaffHolidayResponses}
              globalSettings={globalSettings}
              submitting={staffAdjustmentSubmitting}
              targetProfile={viewingStaff}
              isAdmin={isAdminRole(profile)}
            />

            {/* Delete User Confirmation Modal */}
            <ConfirmModal
              isOpen={!!deletingUserAccount}
              onClose={() => setDeletingUserAccount(null)}
              onConfirm={handleDeleteConfirm}
              title="Delete User Account"
              message={
                <div>
                  Are you sure you want to permanently delete the user account{' '}
                  <strong className="text-theme-text-primary">{(deletingUserAccount?.username || '').toUpperCase()}</strong>?
                  This will delete all corresponding profile info, leaves, and activity records. This action cannot be undone.
                </div>
              }
              confirmText="Permanently Delete"
              cancelText="Cancel"
              isDanger={true}
            />
          </>,
          document.getElementById("root-modals-portal")!
        )
      ) : null}
    </>
  );
};
