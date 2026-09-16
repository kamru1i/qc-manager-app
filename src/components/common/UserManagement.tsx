'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAppEventBus } from '@/contexts/AppEventBusContext';
import { createPortal } from 'react-dom';
import { supabase } from '@/utils/supabase';
import { Profile, UserLeaveOverrides } from '@/types';
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
  TrendingUp,
  Clock,
  AlertTriangle,
  AlertCircle,
  Check,
  Trash2,
  Edit
} from 'lucide-react';
import { UserDisplayName } from '@/components/common/UserDisplayName';
import { UserAnalyticsPanel } from '@/components/common/user-management/UserAnalyticsPanel';
import { BadgeInfo } from '@/utils/leaderboardHelper';
import { userCreationRequestService } from '@/services/userCreationRequestService';
import { UserCreationRequest, UserCreationSubmittedData } from '@/types';
import { resolveAssignedSupervisor } from '@/utils/profileHelpers';

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
import {
  getRecordAdjustmentEntries,
  getRecordAdjustedMinutes,
  getRecordRemainingMinutes,
  formatDuration,
  parseIntervalToMinutes,
  calculateStats,
  LeaveAdjustmentEntry
} from '@/utils/leaveCalculations';

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
  const [pendingUserRequests, setPendingUserRequests] = useState<UserCreationRequest[]>([]);
  const [editingUserCreationRequest, setEditingUserCreationRequest] = useState<UserCreationRequest | null>(null);
  const [reviewModalRequest, setReviewModalRequest] = useState<UserCreationRequest | null>(null);
  const [reviewNotesInput, setReviewNotesInput] = useState('');

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
  const [editUserLeaveOverrides, setEditUserLeaveOverrides] = useState<UserLeaveOverrides>({});

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

  // Active supervisor creation requests (strictly non-terminal, actionable states: pending_admin_approval, needs_review)
  const activeUserCreationRequests = useMemo(() => {
    return pendingUserRequests.filter(
      (req) => req.status === 'pending_admin_approval' || req.status === 'needs_review'
    );
  }, [pendingUserRequests]);

  // Synthesize pending display profiles from supervisor creation requests (dimmed profiles)
  const pendingDisplayProfiles = useMemo(() => {
    const activeCodenames = new Set(profiles.map(p => (p.username || '').toLowerCase().trim()));
    const activeIds = new Set(profiles.map(p => p.id));

    return activeUserCreationRequests
      .filter(req => {
        const data = req.data || req.submitted_data || {};
        const codename = (data.codename || '').toLowerCase().trim();
        if (!codename) return false;
        if (activeCodenames.has(codename)) return false;
        if (req.created_user_id && activeIds.has(req.created_user_id)) return false;
        return true;
      })
      .map(req => {
        const data = req.data || req.submitted_data || {};
        const syntheticProfile: Profile = {
          id: `pending-${req.id}`,
          username: (data.codename || '').toLowerCase().trim(),
          codename: (data.codename || '').toLowerCase().trim(),
          full_name: data.fullName || data.full_name || data.codename || 'Unnamed',
          role: (data.role as any) || 'user',
          allowed_types: data.allowedTypes || data.allowed_types || [],
          can_manage_rules: !!(data.canManageRules ?? data.can_manage_rules),
          has_chuti_access: data.hasChutiAccess ?? data.has_chuti_access ?? true,
          has_quotes_access: data.hasQuotesAccess ?? data.has_quotes_access ?? false,
          needs_supervisor_approval: data.needsApproval ?? data.needs_supervisor_approval ?? true,
          supervisor_ids: data.supervisorIds || data.supervisor_ids || (req.requester_id ? [req.requester_id] : []),
          eligible_govt_holiday: data.eligibleGovtHoliday ?? data.eligible_govt_holiday ?? true,
          eligible_office_leave: data.eligibleOfficeLeave ?? data.eligible_office_leave ?? true,
          allow_overtime: !!(data.allowOvertime ?? data.allow_overtime),
          allow_reserve: !!(data.allowReserve ?? data.allow_reserve),
          default_sign_in: data.signInTime || data.default_sign_in || '',
          default_sign_out: data.signOutTime || data.default_sign_out || '',
          job_role: data.jobRole || data.job_role || '',
          working_hours: parseFloat(String(data.workingHours ?? data.working_hours ?? 9.5)) || 9.5,
          break_time: parseInt(String(data.breakTime ?? data.break_time ?? 0)) || 0,
          global_settings: {
            kpi_skills: data.kpiSkills || data.kpi_skills || [],
            kpi_dept_indicators: data.kpiDeptIndicators || data.kpi_dept_indicators || [],
            kpi_other_dept_indicators: data.kpiOtherDeptIndicators || data.kpi_other_dept_indicators || [],
            performs_data_entry: data.performsDataEntry ?? data.performs_data_entry ?? true,
            department: data.department || 'Data Entry',
            performs_other_dept_tasks: !!(data.performsOtherDeptTasks ?? data.performs_other_dept_tasks),
            other_department: data.otherDepartment || data.other_department || 'IT',
          },
          delegated_supervisor_id: null,
          delegated_leave_supervisor_id: null,
          delegated_kpi_supervisor_id: null,
          has_todo_access: false,
          is_pending_approval: true,
          pending_request_status: req.status,
          pending_request_id: req.id,
          pending_request: req,
        };
        return syntheticProfile;
      });
  }, [activeUserCreationRequests, profiles]);

  // Combined list of active profiles + dimmed pending profiles, sorted alphabetically
  const allDisplayProfiles = useMemo(() => {
    const combined = [...profiles, ...pendingDisplayProfiles];
    return combined.sort((a, b) => {
      const nameA = (a.full_name || a.username || '').toLowerCase();
      const nameB = (b.full_name || b.username || '').toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [profiles, pendingDisplayProfiles]);

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
    
    // For pending profiles, requester supervisor has access to view/manage
    if (viewingStaffProfile.is_pending_approval) {
      if (viewingStaffProfile.pending_request?.requester_id === profile.id) return true;
      return false;
    }

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
      setEditUserLeaveOverrides(viewingStaff.global_settings?.leave_overrides || {});
    } else {
      setEditUserFeatureFlags({});
      setEditUserLeaveOverrides({});
    }
  }, [viewingStaff]);

  // Load saved viewingStaff on mount or when profiles finish loading
  useEffect(() => {
    if ((profiles.length > 0 || pendingDisplayProfiles.length > 0) && !viewingStaff) {
      const savedStaffId = localStorage.getItem('user_management_viewing_staff_id');
      if (savedStaffId) {
        const staff = allDisplayProfiles.find(p => p.id === savedStaffId);
        if (staff && hasStaffAccess(staff)) {
          setViewingStaff(staff);
        }
      }
    }
  }, [allDisplayProfiles, viewingStaff, hasStaffAccess, profiles.length, pendingDisplayProfiles.length]);

  // Synchronize viewingStaff with latest data from profiles or pending list (only if data changed)
  useEffect(() => {
    if (viewingStaff) {
      if (viewingStaff.is_pending_approval) {
        const updated = pendingDisplayProfiles.find(p => p.id === viewingStaff.id);
        if (!updated) {
          // If the pending request was approved, it transitions into profiles:
          const approvedProfile = profiles.find(
            p => (p.username || '').toLowerCase().trim() === viewingStaff.username.toLowerCase().trim()
          );
          if (approvedProfile) {
            updateViewingStaff(approvedProfile);
          } else {
            updateViewingStaff(null);
          }
        } else if (JSON.stringify(updated) !== JSON.stringify(viewingStaff)) {
          updateViewingStaff(updated);
        }
        return;
      }
      const updated = profiles.find(p => p.id === viewingStaff.id);
      if (!updated) {
        updateViewingStaff(null); // User was deleted
      } else if (JSON.stringify(updated) !== JSON.stringify(viewingStaff)) {
        updateViewingStaff(updated);
      }
    }
  }, [profiles, pendingDisplayProfiles, viewingStaff, updateViewingStaff]);

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
    const isLeaveOverridesChanged = JSON.stringify(editUserLeaveOverrides) !== JSON.stringify(viewingStaff.global_settings?.leave_overrides || {});

    return isCodenameChanged || isFullNameChanged || isRoleChanged || isWorkingHoursChanged ||
           isBreakTimeChanged || isJobRoleChanged || isSignInChanged || isSignOutChanged ||
           isHasChutiAccessChanged || isNeedsApprovalChanged || isSupervisorIdsChanged ||
           isEligibleOfficeLeaveChanged || isEligibleGovtHolidayChanged || isAllowOvertimeChanged ||
           isAllowReserveChanged || isHasQuotesAccessChanged || isAllowedTypesChanged ||
           isCanManageRulesChanged || isKpiSkillsChanged || isKpiDeptIndicatorsChanged ||
           isKpiOtherDeptIndicatorsChanged || isPerformsDataEntryChanged || isDepartmentChanged ||
           isPerformsOtherDeptTasksChanged || isOtherDepartmentChanged || isDelegatedLeaveSupervisorIdChanged ||
           isDelegatedKpiSupervisorIdChanged || isUserFeatureFlagsChanged || isLeaveOverridesChanged;
  }, [
    viewingStaff, editUserCodename, editUserFullName, editUserRole, editUserWorkingHours,
    editUserBreakTime, editUserJobRole, editUserSignInTime, editUserSignOutTime,
    editHasChutiAccess, editNeedsApproval, editSupervisorIds, editEligibleOfficeLeave,
    editEligibleGovtHoliday, editAllowOvertime, editAllowReserve, editHasQuotesAccess,
    editUserAllowedTypes, editUserCanManageRules, editUserKpiSkills, editUserKpiDeptIndicators,
    editUserKpiOtherDeptIndicators, editUserPerformsDataEntry, editUserDepartment,
    editUserPerformsOtherDeptTasks, editUserOtherDepartment, editDelegatedLeaveSupervisorId,
    editDelegatedKpiSupervisorId, editUserFeatureFlags, editUserLeaveOverrides
  ]);

  // Redirect to an authorized subtab if the current subtab is restricted
  useEffect(() => {
    if (viewingStaff) {
      if (viewingStaff.is_pending_approval) {
        if (activeSubTab !== 'profile') {
          handleSetActiveSubTab('profile');
        }
        return;
      }
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
      if (viewingStaff.is_pending_approval) {
        setViewingStaffRecords([]);
        setViewingStaffSettlements([]);
        setViewingStaffHolidayResponses([]);
        return;
      }
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
    if (!viewingStaff || viewingStaff.is_pending_approval) return;
    const rec = payload?.new || payload?.old;
    if (rec?.user_id === viewingStaff.id) {
      debouncedFetchStaffLeaveData(viewingStaff.id);
    }
  }, [viewingStaff, debouncedFetchStaffLeaveData]);

  useRealtimeHandler('govt_holiday_responses', handleHolidayResponseRealtime);

  // ── chuti + leave_settlements direct realtime handlers ──
  const handleChutiRealtime = useCallback((payload: RealtimePayload) => {
    if (!viewingStaff || viewingStaff.is_pending_approval) return;
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
    if (!viewingStaff || viewingStaff.is_pending_approval) return;
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
            comment: restoredComment,
            admin_edit_request: {
              ...((r.admin_edit_request as Record<string, unknown>) || {}),
              adjustments: []
            }
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
                ...((record.admin_edit_request as Record<string, unknown>) || {}),
                adjustments: [],
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
        const originalMins = record.leave_hour ? parseIntervalToMinutes(record.leave_hour) : 0;
        const alreadyAdjustedMins = getRecordAdjustedMinutes(record);
        const remainingMins = Math.max(0, originalMins - alreadyAdjustedMins);

        if (remainingMins <= 0) {
          toast.error('This leave record is already fully adjusted.');
          setStaffAdjustmentSubmitting(false);
          return;
        }

        let amountToAdjust = remainingMins;
        let adjSource = selectedCat;
        let adjMessage = '';

        if (selectedCat === 'Overtime') {
          adjSource = 'Overtime';

          // Query approved records for this user in the relevant year to compute available Overtime
          const recordYear = record.date ? record.date.substring(0, 4) : new Date().getFullYear().toString();
          let availableOvertimeMins = 0;
          try {
            const { data: userApprovedRecords, error: fetchErr } = await supabase
              .from('chuti')
              .select('*')
              .eq('user_id', record.user_id)
              .eq('status', 'approved')
              .gte('date', `${recordYear}-01-01`)
              .lte('date', `${recordYear}-12-31`);

            if (!fetchErr && userApprovedRecords) {
              const userStats = calculateStats(userApprovedRecords as ChutiRecord[], viewingStaff?.working_hours || 9.5);
              availableOvertimeMins = parseIntervalToMinutes(userStats.overtimeHours);
            }
          } catch (e) {
            console.error('Failed to compute available overtime balance:', e);
          }

          if (availableOvertimeMins <= 0) {
            toast.error('No available Overtime balance to adjust.');
            setStaffAdjustmentSubmitting(false);
            return;
          }

          if (staffAdjustmentType === 'partial') {
            const timeRegex = /^([0-9]{1,2}):([0-5][0-9])$/;
            if (!timeRegex.test(staffPartialAdjustmentTime)) {
              toast.error('Please use correct time format (e.g. 00:30).');
              setStaffAdjustmentSubmitting(false);
              return;
            }
            amountToAdjust = parseIntervalToMinutes(staffPartialAdjustmentTime);
          } else {
            amountToAdjust = Math.min(remainingMins, availableOvertimeMins);
          }

          if (amountToAdjust <= 0) {
            toast.error('Adjustment time must be greater than zero.');
            setStaffAdjustmentSubmitting(false);
            return;
          }
          if (amountToAdjust > remainingMins) {
            toast.error(`Adjustment amount (${formatDuration(amountToAdjust)}) cannot exceed remaining leave duration (${formatDuration(remainingMins)}).`);
            setStaffAdjustmentSubmitting(false);
            return;
          }
          if (amountToAdjust > availableOvertimeMins) {
            toast.error(`Adjustment amount (${formatDuration(amountToAdjust)}) cannot exceed available Overtime (${formatDuration(availableOvertimeMins)}).`);
            setStaffAdjustmentSubmitting(false);
            return;
          }
          adjMessage = `${formatDuration(amountToAdjust)} minutes of ${record.leave_type} adjusted with Overtime`;
        } else if (selectedCat === 'None' || selectedCat === 'General Adjustment') {
          adjSource = 'General Adjustment';
          if (staffAdjustmentType === 'partial') {
            const timeRegex = /^([0-9]{1,2}):([0-5][0-9])$/;
            if (!timeRegex.test(staffPartialAdjustmentTime)) {
              toast.error('Please use correct time format (e.g. 00:30).');
              setStaffAdjustmentSubmitting(false);
              return;
            }
            amountToAdjust = parseIntervalToMinutes(staffPartialAdjustmentTime);
          } else {
            amountToAdjust = remainingMins;
          }

          if (amountToAdjust <= 0) {
            toast.error('Adjustment time must be greater than zero.');
            setStaffAdjustmentSubmitting(false);
            return;
          }
          if (amountToAdjust > remainingMins) {
            toast.error(`Adjustment amount (${formatDuration(amountToAdjust)}) cannot exceed remaining leave duration (${formatDuration(remainingMins)}).`);
            setStaffAdjustmentSubmitting(false);
            return;
          }
          const reason = generalDetails?.trim();
          adjMessage = reason 
            ? `${formatDuration(amountToAdjust)} minutes of ${record.leave_type} adjusted with General Adjustment — ${reason}`
            : `${formatDuration(amountToAdjust)} minutes of ${record.leave_type} adjusted with General Adjustment`;
        } else if (selectedCat === 'Govt Holiday' && specificHoliday) {
          adjSource = 'Govt Holiday';
          amountToAdjust = remainingMins;
          adjMessage = `Adjusted with Government Holiday on ${formatDate(specificHoliday.date)} — ${specificHoliday.name}`;
        } else if (selectedCat === 'Salary') {
          adjSource = 'Salary';
          amountToAdjust = remainingMins;
          const salaryLabel = salaryInfo ? `${salaryInfo.month} ${salaryInfo.year}` : `${new Date().toLocaleString('en-US', { month: 'long' })} ${new Date().getFullYear()}`;
          adjMessage = `Adjusted with ${salaryLabel} salary deduction`;
        } else if (selectedCat === 'Eid-ul-Fitr' || selectedCat === 'Eid-ul-Adha') {
          adjSource = selectedCat;
          amountToAdjust = remainingMins;
          adjMessage = `Adjusted with ${selectedCat}`;
        }

        const existingAdjustments = getRecordAdjustmentEntries(record);
        const newEntry: LeaveAdjustmentEntry = {
          id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `adj-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          amount_minutes: amountToAdjust,
          source: adjSource,
          source_date: specificHoliday?.date || null,
          source_name: specificHoliday?.name || null,
          salary_month: salaryInfo?.month || null,
          salary_year: salaryInfo?.year || null,
          reason: generalDetails?.trim() || null,
          action_date: new Date().toISOString(),
          comment: adjMessage,
          adjusted_by: profile?.id || null
        };

        const updatedAdjustments = [...existingAdjustments, newEntry];
        const newTotalAdjusted = updatedAdjustments.reduce((sum, a) => sum + (Number(a.amount_minutes) || 0), 0);
        const newRemaining = Math.max(0, originalMins - newTotalAdjusted);
        const isFullyAdjusted = (newRemaining === 0);
        const formattedAdjHour = `${formatDuration(newTotalAdjusted)}:00`;

        const cleanComment = getCleanComment(record.comment);
        const approvalsPrefix = getApprovalsPrefix(record.comment);
        const finalComment = `${approvalsPrefix ? `${approvalsPrefix} | ` : ''}${adjMessage}${cleanComment ? ` | ${cleanComment}` : ''}`;

        requestedUpdates = {
          adjustment: isFullyAdjusted,
          adjusted_hour: formattedAdjHour,
          adjust_short_leave: false,
          reserve_holiday: isFullyAdjusted 
            ? (updatedAdjustments.length === 1 ? updatedAdjustments[0].source : 'Multiple Adjustments') 
            : (adjSource === 'General Adjustment' ? 'General Adjustment' : (record.reserve_holiday || adjSource)),
          comment: finalComment || null,
          admin_edit_request: {
            adjustments: updatedAdjustments,
            last_adjustment_source: adjSource,
            last_adjusted_at: new Date().toISOString()
          }
        };
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
      } else if (selectedCat === 'General Adjustment' || selectedCat === 'None') {
        notifTitle = 'Leave Adjusted (General) ⚙️';
        notifBody = `Your ${record.leave_type} on ${formatDate(record.date)} has been adjusted: ${generalDetails?.trim() || 'General Adjustment'}.`;
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

  const fetchUserCreationRequests = useCallback(async () => {
    if (!profile) return;
    const { data } = await userCreationRequestService.fetchRequests({
      requesterId: profile.role === 'supervisor' ? profile.id : undefined,
    });
    if (data) {
      setPendingUserRequests(data);
    }
  }, [profile]);

  useEffect(() => {
    fetchUserCreationRequests();
  }, [fetchUserCreationRequests]);

  useAppEvent('user-creation-requests-updated', () => {
    fetchUserCreationRequests();
  }, [fetchUserCreationRequests]);

  useRealtimeHandler('user_creation_requests', useCallback(() => {
    fetchUserCreationRequests();
  }, [fetchUserCreationRequests]));

  useAppEvent('open-user-creation-review', (req: UserCreationRequest) => {
    if (req) {
      setEditingUserCreationRequest(req);
      setIsCreatingNewUser(true);
    }
  }, []);

  useAppEvent('open-user-profile', ({ userId, subtab }: { userId: string; subtab?: 'profile' | 'leave' | 'quotes' | 'analytics' | 'kpi' }) => {
    if (!userId) return;
    const target = profiles.find((p) => p.id === userId);
    if (target) {
      updateViewingStaff(target);
      if (subtab) {
        setActiveSubTab(subtab);
      }
    }
  }, [profiles, updateViewingStaff]);

  const handleSubmitRequestWrapper = async (data: UserCreationSubmittedData) => {
    setSubmitting(true);
    try {
      const { data: reqId, error } = await userCreationRequestService.submitRequest(data);
      if (error) {
        toast.error(error.message || 'Failed to submit account creation request.');
        setSubmitting(false);
        return null;
      }
      toast.success('User creation request submitted for Admin approval!');
      setSubmitting(false);
      fetchUserCreationRequests();
      emit('user-creation-requests-updated');
      return reqId;
    } catch (err: any) {
      toast.error(err?.message || 'Error submitting request');
      setSubmitting(false);
      return null;
    }
  };

  const handleResubmitRequestWrapper = async (
    requestId: string,
    data: UserCreationSubmittedData,
    expectedVersion: number
  ) => {
    setSubmitting(true);
    try {
      const { success, error } = await userCreationRequestService.resubmitRequest(
        requestId,
        data,
        expectedVersion
      );
      if (error) {
        toast.error(error.message || 'Failed to resubmit account creation request.');
        setSubmitting(false);
        return false;
      }
      toast.success('User creation request resubmitted for Admin approval!');
      setSubmitting(false);
      setEditingUserCreationRequest(null);
      fetchUserCreationRequests();
      emit('user-creation-requests-updated');
      return true;
    } catch (err: any) {
      toast.error(err?.message || 'Error resubmitting request');
      setSubmitting(false);
      return false;
    }
  };

  const handleApprovePendingRequest = async (requestId: string) => {
    setSubmitting(true);
    try {
      const { success, error } = await userCreationRequestService.approveRequest(requestId);
      if (error || !success) {
        toast.error(error?.message || 'Failed to approve user creation request.');
        setSubmitting(false);
        return;
      }
      toast.success('User account approved and activated successfully!');
      setSubmitting(false);
      await fetchProfiles();
      await fetchUserCreationRequests();
      emit('user-creation-requests-updated');
    } catch (err: any) {
      toast.error(err?.message || 'Error approving request');
      setSubmitting(false);
    }
  };

  const handleSendReviewRequest = async () => {
    if (!reviewModalRequest || !reviewNotesInput.trim()) {
      toast.error('Please enter review notes explaining what needs to be corrected.');
      return;
    }
    setSubmitting(true);
    try {
      const { success, error } = await userCreationRequestService.reviewRequest(
        reviewModalRequest.id,
        reviewNotesInput.trim(),
        reviewModalRequest.version
      );
      if (error || !success) {
        toast.error(error?.message || 'Failed to send review request.');
      } else {
        toast.success('Request returned to supervisor for review.');
        setReviewModalRequest(null);
        setReviewNotesInput('');
        fetchUserCreationRequests();
        emit('user-creation-requests-updated');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Error returning request for review');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateUser = async () => {
    if (!viewingStaff) return;

    const canEdit = isAdmin || profile?.role === 'supervisor';
    if (!canEdit) {
      toast.error('You do not have permission to edit user profiles.');
      return;
    }

    setSubmitting(true);
    try {
      if (viewingStaff.is_pending_approval && viewingStaff.pending_request) {
        // Pending approval user edited by supervisor/admin
        const req = viewingStaff.pending_request;
        const currentData = req.data || req.submitted_data || {};
        const updatedData: UserCreationSubmittedData = {
          ...currentData,
          fullName: editUserFullName.trim(),
          allowedTypes: editUserAllowedTypes,
          canManageRules: editUserCanManageRules,
          hasChutiAccess: editHasChutiAccess,
          hasQuotesAccess: editHasQuotesAccess,
          needsApproval: editNeedsApproval,
          supervisorIds: editSupervisorIds,
          eligibleGovtHoliday: editEligibleGovtHoliday,
          eligibleOfficeLeave: editEligibleOfficeLeave,
          allowOvertime: editAllowOvertime,
          allowReserve: editAllowReserve,
          jobRole: editUserJobRole,
          workingHours: parseFloat(editUserWorkingHours) || 9.5,
          breakTime: parseInt(editUserBreakTime) || 0,
          signInTime: editUserSignInTime,
          signOutTime: editUserSignOutTime,
          kpiSkills: editUserKpiSkills,
          kpiDeptIndicators: editUserKpiDeptIndicators,
          kpiOtherDeptIndicators: editUserKpiOtherDeptIndicators,
          performsDataEntry: editUserPerformsDataEntry,
          department: editUserDepartment,
          performsOtherDeptTasks: editUserPerformsOtherDeptTasks,
          otherDepartment: editUserOtherDepartment,
        };

        const { success, error } = await userCreationRequestService.resubmitRequest(
          req.id,
          updatedData,
          req.version
        );

        if (error || !success) {
          toast.error(error?.message || 'Failed to update pending request.');
        } else {
          toast.success('Pending account request updated successfully!');
          fetchUserCreationRequests();
          emit('user-creation-requests-updated');
        }
      } else {
        const success = await adminUpdateUserProfile(
          viewingStaff.id,
          editUserFullName.trim(),
          editUserRole,
          editUserAllowedTypes,
          editUserCanManageRules,
          editHasChutiAccess,
          editHasQuotesAccess,
          isAdmin ? 'admin' : 'supervisor',
          editNeedsApproval,
          editSupervisorIds,
          editEligibleGovtHoliday,
          editEligibleOfficeLeave,
          editAllowOvertime,
          editAllowReserve,
          editUserCodename.trim().toUpperCase(),
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
          editUserFeatureFlags,
          editUserLeaveOverrides
        );

        if (success) {
          const updated = {
            ...viewingStaff,
            username: editUserCodename.trim().toUpperCase(),
            full_name: editUserFullName.trim(),
            role: editUserRole,
            allowed_types: editUserAllowedTypes,
            can_manage_rules: editUserCanManageRules,
            has_chuti_access: editHasChutiAccess,
            has_quotes_access: editHasQuotesAccess,
            needs_supervisor_approval: editNeedsApproval,
            supervisor_ids: editSupervisorIds,
            eligible_govt_holiday: editEligibleGovtHoliday,
            eligible_office_leave: editEligibleOfficeLeave,
            allow_overtime: editAllowOvertime,
            allow_reserve: editAllowReserve,
            job_role: editUserJobRole,
            working_hours: parseFloat(editUserWorkingHours) || 9.5,
            break_time: parseInt(editUserBreakTime) || 0,
            default_sign_in: editUserSignInTime,
            default_sign_out: editUserSignOutTime,
            delegated_leave_supervisor_id: editDelegatedLeaveSupervisorId,
            delegated_kpi_supervisor_id: editDelegatedKpiSupervisorId,
            global_settings: {
              ...viewingStaff.global_settings,
              kpi_skills: editUserKpiSkills,
              kpi_dept_indicators: editUserKpiDeptIndicators,
              kpi_other_dept_indicators: editUserKpiOtherDeptIndicators,
              performs_data_entry: editUserPerformsDataEntry,
              department: editUserDepartment,
              performs_other_dept_tasks: editUserPerformsOtherDeptTasks,
              other_department: editUserOtherDepartment,
              user_feature_flags: editUserFeatureFlags,
              leave_overrides: editUserLeaveOverrides,
            },
          };
          updateViewingStaff(updated);
          // Only emit current session profile update if editing own profile!
          if (viewingStaff.id === sessionUser?.id) {
            emit('profile-updated', updated);
          }
        }
      }
    } catch (err: any) {
      toast.error(err?.message || 'Error updating profile');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (deletingUserAccount) {
      if (deletingUserAccount.id.startsWith('pending-')) {
        const reqId = deletingUserAccount.id.replace('pending-', '');
        const { success, error } = await userCreationRequestService.deleteRequest(reqId);
        if (error || !success) {
          toast.error(error?.message || 'Failed to dismiss request.');
        } else {
          toast.success('Account creation request dismissed.');
          if (viewingStaff?.id === deletingUserAccount.id) {
            updateViewingStaff(null);
          }
          fetchUserCreationRequests();
          emit('user-creation-requests-updated');
        }
      } else {
        await deleteUser(deletingUserAccount.id);
        fetchProfiles();
      }
      setDeletingUserAccount(null);
    }
  };

  const visibleProfiles = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return allDisplayProfiles.filter((u) => {
      if (!q) return true;
      return (
        u.username.toLowerCase().includes(q) ||
        (u.full_name || '').toLowerCase().includes(q)
      );
    });
  }, [allDisplayProfiles, searchQuery]);

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
                      editingUserCreationRequest ? (
                        'Review & Resubmit Account Request'
                      ) : profile?.role === 'supervisor' ? (
                        'Request New User Account'
                      ) : (
                        'Add New Staff'
                      )
                    ) : (
                      viewingStaff && (
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <UserDisplayName
                            profile={viewingStaff}
                            badge={effectiveBadges[viewingStaff.id] || (viewingStaff.global_settings?.top_performer_badge as BadgeInfo) || null}
                            tooltipPosition="bottom"
                          />
                          {viewingStaff.is_pending_approval && (
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                viewingStaff.pending_request_status === 'needs_review'
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                  : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                              }`}
                            >
                              <Clock className="h-3 w-3" />
                              {viewingStaff.pending_request_status === 'needs_review'
                                ? 'Needs Review'
                                : 'Pending Approval'}
                            </span>
                          )}
                        </div>
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

            {/* Pending Approval Notice / Action Banner for Employee 360 Hub */}
            {!isCreatingNewUser && viewingStaff && viewingStaff.is_pending_approval && (
              <div className={`p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-2 ${
                viewingStaff.pending_request_status === 'needs_review'
                  ? 'bg-amber-500/10 border-amber-500/30'
                  : 'bg-amber-500/5 border-amber-500/20'
              }`}>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-amber-400 shrink-0" />
                    <span className="font-bold text-sm text-theme-text-primary">
                      {viewingStaff.pending_request_status === 'needs_review'
                        ? 'Account Creation Needs Review'
                        : 'Account Creation Pending Admin Approval'}
                    </span>
                  </div>
                  <p className="text-xs text-theme-text-muted">
                    {viewingStaff.pending_request_status === 'needs_review'
                      ? 'Admin requested adjustments to this user creation request before it can be activated.'
                      : 'This user profile is currently pending approval. Once approved by an Admin, the account will become fully active.'}
                  </p>
                  {viewingStaff.pending_request?.admin_review_notes && (
                    <div className="mt-2 p-2.5 bg-amber-950/40 border border-amber-500/30 rounded-lg text-xs text-amber-200">
                      <strong className="block text-[10px] uppercase font-bold text-amber-400 mb-0.5">Admin Review Notes:</strong>
                      {viewingStaff.pending_request.admin_review_notes}
                    </div>
                  )}
                  {viewingStaff.pending_request?.submitted_by_name && (
                    <div className="text-[11px] text-theme-text-muted">
                      Submitted by: <strong className="text-theme-text-secondary">{viewingStaff.pending_request.submitted_by_name}</strong>
                    </div>
                  )}
                </div>

                {/* Quick Action Buttons */}
                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  {isAdmin && (
                    <>
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() => handleApprovePendingRequest(viewingStaff.pending_request_id!)}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow transition-all cursor-pointer disabled:opacity-50"
                      >
                        {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                        Approve & Activate
                      </button>
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() => {
                          setReviewModalRequest(viewingStaff.pending_request!);
                          setReviewNotesInput('');
                        }}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-semibold shadow transition-all cursor-pointer disabled:opacity-50"
                      >
                        <AlertCircle className="h-3.5 w-3.5" />
                        Request Review
                      </button>
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() => setDeletingUserAccount({ id: viewingStaff.id, username: viewingStaff.username })}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 bg-red-950/50 hover:bg-red-900/60 text-red-300 border border-red-800/40 rounded-xl text-xs font-semibold shadow transition-all cursor-pointer disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Dismiss
                      </button>
                    </>
                  )}

                  {profile?.role === 'supervisor' && viewingStaff.pending_request?.requester_id === profile.id && (
                    viewingStaff.pending_request_status === 'needs_review' ? (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingUserCreationRequest(viewingStaff.pending_request!);
                          updateViewingStaff(null);
                          setIsCreatingNewUser(true);
                        }}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-bold shadow transition-all cursor-pointer"
                      >
                        <Edit className="h-3.5 w-3.5" />
                        Review & Resubmit
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingUserCreationRequest(viewingStaff.pending_request!);
                          updateViewingStaff(null);
                          setIsCreatingNewUser(true);
                        }}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow transition-all cursor-pointer"
                      >
                        <Edit className="h-3.5 w-3.5" />
                        Edit Request
                      </button>
                    )
                  )}
                </div>
              </div>
            )}

            {/* Employee 360 Hub Subtabs (Horizontal Top Tabs) */}
            {!isCreatingNewUser && viewingStaff && (
              <div className="flex border-b border-theme-border-input gap-1 mt-2 overflow-x-auto whitespace-nowrap scrollbar-none pb-px max-w-full">
                {!viewingStaff.is_pending_approval && viewingStaff.has_chuti_access && canAccessUserProfileSubtab(profile, 'user_profile_leave', globalSettings, profiles) && canAccessModule(profile, viewingStaff, 'leave', profiles) && (
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
                {!viewingStaff.is_pending_approval && viewingStaff.has_quotes_access && canAccessUserProfileSubtab(profile, 'user_profile_quotes', globalSettings, profiles) && canAccessModule(profile, viewingStaff, 'quotes', profiles) && (
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
                {!viewingStaff.is_pending_approval && viewingStaff.has_quotes_access && canAccessUserProfileSubtab(profile, 'user_profile_analytics', globalSettings, profiles) && canAccessModule(profile, viewingStaff, 'quotes', profiles) && (
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
                {!viewingStaff.is_pending_approval && viewingStaff.has_quotes_access && canAccessUserProfileSubtab(profile, 'user_profile_kpi', globalSettings, profiles) && canAccessModule(profile, viewingStaff, 'kpi', profiles) && (
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
              editingRequest={editingUserCreationRequest}
              onCancel={() => {
                setIsCreatingNewUser(false);
                setEditingUserCreationRequest(null);
              }}
              onCreateUser={handleCreateUserWrapper}
              onSubmitRequest={handleSubmitRequestWrapper}
              onResubmitRequest={handleResubmitRequestWrapper}
              onSuccess={() => {
                setIsCreatingNewUser(false);
                setEditingUserCreationRequest(null);
                fetchProfiles();
                fetchUserCreationRequests();
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
                  editUserLeaveOverrides={editUserLeaveOverrides}
                  setEditUserLeaveOverrides={setEditUserLeaveOverrides}
                  globalSettings={globalSettings}
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

              {(isAdmin || profile?.role === 'supervisor') && (
                <button
                  onClick={() => {
                    setEditingUserCreationRequest(null);
                    setIsCreatingNewUser(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-blue-950/20 active:scale-95 transition-all cursor-pointer font-sans shrink-0"
                >
                  <UserPlus className="h-4 w-4" />
                  {isAdmin ? 'Add New Staff' : 'Request New User'}
                </button>
              )}
            </div>
          </div>

          {/* Supervisor Account Creation Requests Section (Active: Pending & Needs Review) */}
          {profile?.role === 'supervisor' && activeUserCreationRequests.length > 0 && (
            <div className="bg-theme-card-bg/40 backdrop-blur-xl rounded-2xl border border-theme-border-input/80 overflow-hidden shadow-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <UserPlus className="h-4 w-4 text-blue-400" />
                  <h3 className="text-sm font-bold text-theme-text-primary">
                    My Account Creation Requests
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    {activeUserCreationRequests.length}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {activeUserCreationRequests.map((req) => {
                  const sup = resolveAssignedSupervisor(req, profiles);
                  return (
                    <div
                      key={req.id}
                      className={`p-4 rounded-xl border transition-all ${
                        req.status === 'needs_review'
                          ? 'bg-amber-500/5 border-amber-500/30'
                          : req.status === 'approved'
                          ? 'bg-emerald-500/5 border-emerald-500/20'
                          : req.status === 'rejected'
                          ? 'bg-rose-500/5 border-rose-500/20'
                          : 'bg-theme-page-bg/40 border-theme-border-input/60'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <div className="font-semibold text-xs text-theme-text-primary">
                            {req.data?.full_name || 'Unnamed'}
                          </div>
                          <div className="text-[11px] font-mono text-theme-text-muted">
                            @{req.data?.codename || '—'}
                          </div>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider ${
                            req.status === 'pending_admin_approval'
                              ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                              : req.status === 'needs_review'
                              ? 'bg-orange-500/15 text-orange-400 border border-orange-500/30'
                              : req.status === 'approved'
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                          }`}
                        >
                          {req.status === 'pending_admin_approval'
                            ? 'Pending'
                            : req.status === 'needs_review'
                            ? 'Needs Review'
                            : req.status === 'approved'
                            ? 'Approved'
                            : 'Rejected'}
                        </span>
                      </div>

                      <div className="text-[11px] text-theme-text-muted space-y-1 mb-3">
                        <div>
                          Manager:{' '}
                          {sup.codename ? (
                            <span
                              className="text-theme-text-secondary font-mono font-semibold"
                              title={sup.fullName ? `${sup.fullName} (${sup.codename})` : sup.codename}
                            >
                              {sup.codename}
                            </span>
                          ) : (
                            <span className="text-theme-text-muted">None</span>
                          )}
                        </div>
                        <div>
                          Submitted:{' '}
                          <span className="text-theme-text-secondary">
                            {new Date(req.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        {req.admin_review_notes && (
                          <div className="mt-2 p-2 bg-amber-500/10 rounded-lg border border-amber-500/20 text-amber-300 text-[11px] leading-relaxed">
                            <strong className="block text-[10px] uppercase font-bold text-amber-400 mb-0.5">
                              Admin Note:
                            </strong>
                            {req.admin_review_notes}
                          </div>
                        )}
                      </div>

                      {req.status === 'needs_review' && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingUserCreationRequest(req);
                            setIsCreatingNewUser(true);
                          }}
                          className="w-full mt-1 py-1.5 px-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          Review & Resubmit
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

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
                    <th className="py-3.5 px-6 w-64 max-w-[260px]">File Type</th>
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
                          if (u.is_pending_approval) {
                            handleSetActiveSubTab('profile');
                            updateViewingStaff(u);
                            return;
                          }
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
                        className={`transition-colors cursor-pointer select-none ${
                          u.is_pending_approval
                            ? 'opacity-60 hover:opacity-85 bg-amber-500/[0.03] border-l-2 border-l-amber-500/50 hover:bg-amber-500/[0.07]'
                            : 'hover:bg-theme-card-bg/25'
                        }`}
                        title={u.is_pending_approval ? "Double-click to view pending creation request" : "Double-click to view details"}
                      >
                        <td className="py-3.5 px-6">
                          <div className="flex items-center gap-2 flex-wrap">
                            <UserDisplayName
                              profile={u}
                              badge={effectiveBadges[u.id] || (u.global_settings?.top_performer_badge as BadgeInfo) || null}
                              tooltipPosition="top"
                              showRank={false}
                            />
                            {u.is_pending_approval && (
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                                  u.pending_request_status === 'needs_review'
                                    ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                                    : 'bg-amber-500/10 text-amber-500/90 border border-amber-500/20'
                                }`}
                                title={u.pending_request_status === 'needs_review' ? 'Sent back for review' : 'Awaiting admin approval'}
                              >
                                <Clock className="h-2.5 w-2.5" />
                                {u.pending_request_status === 'needs_review' ? 'Needs Review' : 'Pending Approval'}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-theme-text-muted uppercase mt-0.5 tracking-wider font-mono">
                            {u.username.trim()}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium border ${
                            u.is_pending_approval
                              ? 'bg-theme-border-muted/40 border-theme-border-active/40 text-theme-text-muted'
                              : getDisplayRole(u.role, profile) === 'superadmin'
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
                        {(() => {
                          const cleanTypes = (u.allowed_types || []).filter(
                            (t) => t !== 'Review Van' && t !== 'Review Bike'
                          );
                          const isAllCategories =
                            cleanTypes.length === ALL_FILE_TYPES.length ||
                            (cleanTypes.length > 0 && ALL_FILE_TYPES.every((t) => cleanTypes.includes(t)));

                          const fullTypesList = cleanTypes.join(', ');
                          const tooltipText = !u.has_quotes_access
                            ? 'Quotes Workspace access is disabled'
                            : isAllCategories
                            ? `All Categories (${cleanTypes.length}):\n• ${cleanTypes.join('\n• ')}`
                            : cleanTypes.length === 0
                            ? 'No quotation categories assigned'
                            : `Allowed Categories (${cleanTypes.length}):\n• ${cleanTypes.join('\n• ')}`;

                          return (
                            <td
                              className="py-3.5 px-6 w-64 max-w-[260px] min-w-0 overflow-hidden"
                              title={tooltipText}
                            >
                              {!u.has_quotes_access ? (
                                <span className="text-theme-text-muted/80 italic text-[11px] block truncate">
                                  No access
                                </span>
                              ) : isAllCategories ? (
                                <span className="text-blue-400 font-medium text-[11px] block truncate">
                                  All Categories
                                </span>
                              ) : cleanTypes.length === 0 ? (
                                <span className="text-red-400/80 font-medium text-[11px] block truncate">
                                  None Allowed
                                </span>
                              ) : (
                                <div className="w-full max-w-[210px] min-w-0">
                                  <span className="text-theme-text-muted text-[11px] block truncate font-normal">
                                    {fullTypesList}
                                  </span>
                                </div>
                              )}
                            </td>
                          );
                        })()}
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

            {/* Review Notes Input Modal for Admin */}
            {reviewModalRequest && (
              <Modal
                isOpen={!!reviewModalRequest}
                onClose={() => setReviewModalRequest(null)}
                title="Request Review & Corrections"
                icon={<AlertCircle className="h-5 w-5 text-amber-500" />}
                maxWidthClass="max-w-md"
                glowClass="bg-amber-900/10"
              >
                <div className="space-y-4 font-sans">
                  <div className="p-3 bg-amber-955/20 border border-amber-900/30 rounded-xl text-xs text-amber-300 leading-relaxed">
                    <p>
                      Send this account creation request back to <strong>{reviewModalRequest.submitted_by_name || 'the supervisor'}</strong> with specific feedback or required corrections.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-theme-text-muted uppercase tracking-wider mb-1.5">
                      Review Feedback / Notes <span className="text-red-400">*</span>
                    </label>
                    <textarea
                      rows={4}
                      placeholder="e.g. Please update working hours to 9.0 and assign to correct department..."
                      value={reviewNotesInput}
                      onChange={(e) => setReviewNotesInput(e.target.value)}
                      className="w-full px-3 py-2 bg-theme-page-bg border border-theme-border-input rounded-xl text-theme-text-primary text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                    />
                  </div>

                  <div className="flex gap-3 pt-3 border-t border-theme-border-input/80">
                    <button
                      type="button"
                      onClick={() => setReviewModalRequest(null)}
                      className="flex-1 py-2 px-4 border border-theme-border-input rounded-xl text-xs font-semibold text-theme-text-muted hover:text-theme-text-secondary bg-theme-page-bg hover:bg-theme-card-bg cursor-pointer transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={submitting || !reviewNotesInput.trim()}
                      onClick={handleSendReviewRequest}
                      className="flex-1 py-2 px-4 rounded-xl shadow-sm text-xs font-semibold text-slate-950 bg-amber-500 hover:bg-amber-400 cursor-pointer transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                    >
                      {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      {submitting ? 'Sending...' : 'Send for Review'}
                    </button>
                  </div>
                </div>
              </Modal>
            )}

            {/* Delete User Confirmation Modal */}
            <ConfirmModal
              isOpen={!!deletingUserAccount}
              onClose={() => setDeletingUserAccount(null)}
              onConfirm={handleDeleteConfirm}
              title={deletingUserAccount?.id.startsWith('pending-') ? "Dismiss Creation Request" : "Delete User Account"}
              message={
                <div>
                  {deletingUserAccount?.id.startsWith('pending-') ? (
                    <>
                      Are you sure you want to dismiss the user creation request for{' '}
                      <strong className="text-theme-text-primary">{(deletingUserAccount?.username || '').toUpperCase()}</strong>?
                      This will remove the pending request.
                    </>
                  ) : (
                    <>
                      Are you sure you want to permanently delete the user account{' '}
                      <strong className="text-theme-text-primary">{(deletingUserAccount?.username || '').toUpperCase()}</strong>?
                      This will delete all corresponding profile info, leaves, and activity records. This action cannot be undone.
                    </>
                  )}
                </div>
              }
              confirmText={deletingUserAccount?.id.startsWith('pending-') ? "Dismiss Request" : "Permanently Delete"}
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
