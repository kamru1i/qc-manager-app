'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/utils/supabase';
import { Profile } from '@/types';
import { useAdminActions } from '@/hooks/useAdminActions';
import { Navbar } from '@/components/Navbar';
import { UnifiedSidebar } from '@/components/UnifiedSidebar';
import { EditProfileModal } from '@/components/modals/EditProfileModal';
import { ConfirmModal } from '@/components/modals/ConfirmModal';
import { Modal } from '@/components/Modal';
import { UserManagementSkeleton } from '@/components/skeleton/UserManagementSkeleton';
import toast from 'react-hot-toast';
import {
  Search,
  UserPlus,
  Shield,
  Edit,
  Trash2,
  CheckCircle2,
  XCircle,
  Loader2,
  X,
  ArrowLeft,
  AlertTriangle,
  KeyRound,
  Check,
  RefreshCw,
  Settings,
  Calendar,
  BarChart2,
  FileText
} from 'lucide-react';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import { UserDisplayName } from '@/components/UserDisplayName';
import { BadgeInfo } from '@/utils/leaderboardHelper';
import { CategoryCheckboxList } from '@/components/CategoryCheckboxList';
import { Toggle } from '@/components/Toggle';
import { StaffSettingsForm } from '@/components/StaffSettingsForm';

// Extracted Subtabs Panels
import { CreateUserPanel } from '@/components/user-management/CreateUserPanel';
import { UserProfileSettingsPanel } from '@/components/user-management/UserProfileSettingsPanel';
import { UserLeaveHistoryPanel } from '@/components/user-management/UserLeaveHistoryPanel';
import { UserQuotesHistoryPanel } from '@/components/user-management/UserQuotesHistoryPanel';
import { UserKpiPerformancePanel } from '@/components/user-management/UserKpiPerformancePanel';
import { AddLeave } from '@/components/AddLeave';
import { ChutiRecord } from '@/utils/offlineSync';
import { LeaveSettlement, GovtHolidayResponse } from '@/types';
import { GlobalSettings, getGlobalSettingsFromProfile, defaultGlobalSettings } from '@/utils/dashboardHelpers';


interface UserManagementDashboardProps {
  sessionUser: { id: string } | null;
  profile: Profile | null;
  onLogout: () => void;
  theme: 'dark' | 'light';
  onThemeToggle: () => void;
  isSidebarCollapsed: boolean;
  onSidebarToggle: () => void;
  topPerformerBadges?: Record<string, BadgeInfo>;
  onViewStateChange?: (isFullView: boolean) => void;
}

const ALL_FILE_TYPES = [
  'Quote', 'Requote', 'Requote Van', 'Requote Bike', 'Review', 'Individual Review', 'Other Site', 'Van', 'Bike', 'Sale'
];

export const UserManagementDashboard: React.FC<UserManagementDashboardProps> = ({
  sessionUser,
  profile,
  onLogout,
  theme,
  onThemeToggle,
  isSidebarCollapsed,
  onSidebarToggle,
  topPerformerBadges = {},
  onViewStateChange,
}) => {
  const [profiles, setProfiles] = useState<Profile[]>([]);
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
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [editUserFullName, setEditUserFullName] = useState('');
  const [editUserRole, setEditUserRole] = useState<'admin' | 'supervisor' | 'user'>('user');
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

  // Delete User State
  const [deletingUserAccount, setDeletingUserAccount] = useState<{ id: string; username: string } | null>(null);

  const [showDetailNameTooltip, setShowDetailNameTooltip] = useState(false);
  const detailNameHoverTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // Clear name tooltip timeout on unmount
  useEffect(() => {
    const timeout = detailNameHoverTimeoutRef.current;
    return () => {
      if (timeout) {
        clearTimeout(timeout);
      }
    };
  }, []);

  // Double-click viewing state (Employee 360 Hub)
  const [viewingStaff, setViewingStaff] = useState<Profile | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'profile' | 'leave' | 'quotes' | 'kpi'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('user_management_active_subtab');
      if (saved === 'profile' || saved === 'leave' || saved === 'quotes' || saved === 'kpi') {
        return saved as 'profile' | 'leave' | 'quotes' | 'kpi';
      }
    }
    return 'leave';
  });
  const [viewingStaffRecords, setViewingStaffRecords] = useState<ChutiRecord[]>([]);
  const [viewingStaffSettlements, setViewingStaffSettlements] = useState<LeaveSettlement[]>([]);
  const [viewingStaffHolidayResponses, setViewingStaffHolidayResponses] = useState<GovtHolidayResponse[]>([]);
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings | null>(null);
  const [loadingLeaveData, setLoadingLeaveData] = useState(false);
  const [showAddLeaveForStaff, setShowAddLeaveForStaff] = useState(false);

  // Leave Records Filter parameters
  const [leaveFilterType, setLeaveFilterType] = useState('all');
  const [leaveFilterStartDate, setLeaveFilterStartDate] = useState('');
  const [leaveFilterEndDate, setLeaveFilterEndDate] = useState('');
  const [leaveSearchQuery, setLeaveSearchQuery] = useState('');
  const [selectedYear, setSelectedYear] = useState<string>(() => new Date().getFullYear().toString());

  // Change Credentials Modal State
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [credNewPassword, setCredNewPassword] = useState('');
  const [credConfirmPassword, setCredConfirmPassword] = useState('');
  const [updatingCredentials, setUpdatingCredentials] = useState(false);
  const [showResetConfirmModal, setShowResetConfirmModal] = useState(false);

  // Sync edit states when viewingStaff changes
  useEffect(() => {
    if (viewingStaff) {
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
    }
  }, [viewingStaff]);

  // Synchronize viewingStaff with latest data from profiles list
  useEffect(() => {
    if (viewingStaff) {
      const updated = profiles.find(p => p.id === viewingStaff.id);
      if (updated) {
        setViewingStaff(updated);
      } else {
        setViewingStaff(null); // User was deleted
      }
    }
  }, [profiles, viewingStaff]);

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
        setViewingStaff(null);
        setIsCreatingNewUser(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewingStaff, isCreatingNewUser]);

  // Fallback if viewingStaff has no quotes access and active tab is quotes/kpi
  useEffect(() => {
    if (viewingStaff) {
      const isSupervisedByMe = profile?.role === 'admin' || (profile?.role === 'supervisor' && Array.isArray(viewingStaff.supervisor_ids) && viewingStaff.supervisor_ids.includes(profile.id));
      if (!viewingStaff.has_quotes_access && (activeSubTab === 'quotes' || activeSubTab === 'kpi')) {
        setActiveSubTab(isSupervisedByMe ? 'leave' : 'profile');
      }
    }
  }, [viewingStaff, activeSubTab, profile]);

  // Enforce access control for Leave History tab: redirect if active tab is leave but supervisor doesn't supervise user
  useEffect(() => {
    if (viewingStaff && profile?.role === 'supervisor') {
      const isSupervisedByMe = Array.isArray(viewingStaff.supervisor_ids) && viewingStaff.supervisor_ids.includes(profile.id);
      if (activeSubTab === 'leave' && !isSupervisedByMe) {
        setActiveSubTab(viewingStaff.has_quotes_access ? 'quotes' : 'profile');
      }
    }
  }, [viewingStaff, activeSubTab, profile]);

  // Reset subtab selection to 'leave' when viewingStaff is closed
  useEffect(() => {
    if (!viewingStaff) {
      setActiveSubTab('leave');
      setShowAddLeaveForStaff(false);
    }
  }, [viewingStaff]);

  // Reset add-leave view when subtab changes away from leave
  useEffect(() => {
    if (activeSubTab !== 'leave') {
      setShowAddLeaveForStaff(false);
    }
  }, [activeSubTab]);

  // Notify parent component when full-screen view state changes
  useEffect(() => {
    if (onViewStateChange) {
      onViewStateChange(!!viewingStaff || isCreatingNewUser);
    }
  }, [viewingStaff, isCreatingNewUser, onViewStateChange]);

  // Fetch all leave records, settlements, and holiday responses for the selected staff member
  const fetchStaffLeaveData = useCallback(async (staffId: string) => {
    setLoadingLeaveData(true);
    try {
      const [chutiRes, sRes, hrRes] = await Promise.all([
        supabase
          .from('chuti')
          .select('*')
          .eq('user_id', staffId)
          .is('deleted_at', null)
          .order('date', { ascending: false }),
        supabase
          .from('leave_settlements')
          .select('*')
          .eq('user_id', staffId),
        supabase
          .from('govt_holiday_responses')
          .select('*')
          .eq('user_id', staffId),
      ]);

      if (chutiRes.error) throw chutiRes.error;
      if (sRes.error) throw sRes.error;
      if (hrRes.error) throw hrRes.error;

      setViewingStaffRecords(chutiRes.data || []);
      setViewingStaffSettlements(sRes.data || []);
      setViewingStaffHolidayResponses(hrRes.data || []);

      // Fetch global settings from admin profile
      const { data: adminProfile, error: apError } = await supabase
        .from('profiles')
        .select('global_settings')
        .eq('role', 'admin')
        .limit(1)
        .single();

      if (!apError && adminProfile && adminProfile.global_settings) {
        setGlobalSettings(adminProfile.global_settings);
      } else {
        setGlobalSettings(getGlobalSettingsFromProfile(profile));
      }
    } catch (e: any) {
      console.error('Failed to load staff leave data:', e);
      toast.error(e.message || 'Failed to load leave history.');
    } finally {
      setLoadingLeaveData(false);
    }
  }, [profile]);

  // Fetch leave data on mount/change of selected staff member
  useEffect(() => {
    if (viewingStaff) {
      const isSupervisedByMe = profile?.role === 'admin' || (profile?.role === 'supervisor' && Array.isArray(viewingStaff.supervisor_ids) && viewingStaff.supervisor_ids.includes(profile?.id));
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
  }, [viewingStaff, fetchStaffLeaveData, profile]);

  // Real-time synchronization for viewed staff leave data
  useEffect(() => {
    if (!viewingStaff) return;

    const isSupervisedByMe = profile?.role === 'admin' || (profile?.role === 'supervisor' && Array.isArray(viewingStaff.supervisor_ids) && viewingStaff.supervisor_ids.includes(profile?.id));
    if (!isSupervisedByMe) return;

    const chutiChannel = supabase
      .channel(`rt-viewing-staff-chuti-${viewingStaff.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chuti', filter: `user_id=eq.${viewingStaff.id}` },
        () => {
          fetchStaffLeaveData(viewingStaff.id);
        }
      )
      .subscribe();

    const settlementsChannel = supabase
      .channel(`rt-viewing-staff-settlements-${viewingStaff.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leave_settlements', filter: `user_id=eq.${viewingStaff.id}` },
        () => {
          fetchStaffLeaveData(viewingStaff.id);
        }
      )
      .subscribe();

    const holidayResponsesChannel = supabase
      .channel(`rt-viewing-staff-holidays-${viewingStaff.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'govt_holiday_responses', filter: `user_id=eq.${viewingStaff.id}` },
        () => {
          fetchStaffLeaveData(viewingStaff.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(chutiChannel);
      supabase.removeChannel(settlementsChannel);
      supabase.removeChannel(holidayResponsesChannel);
    };
  }, [viewingStaff, fetchStaffLeaveData, profile]);

  // Toggle adjustment handler for leaves in details view
  const handleToggleAdjustment = async (record: ChutiRecord) => {
    try {
      const { error } = await supabase
        .from('chuti')
        .update({ adjustment: !record.adjustment })
        .eq('id', record.id);

      if (error) throw error;
      toast.success('Adjustment status updated.');
      if (viewingStaff) {
        fetchStaffLeaveData(viewingStaff.id);
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to update adjustment: ' + (err.message || 'unknown error'));
    }
  };

  // Delete handler for leaves in details view
  const handleDeleteRecord = async (record: ChutiRecord) => {
    if (!confirm('Are you sure you want to permanently delete this leave entry?')) return;

    try {
      const { error } = await supabase
        .from('chuti')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', record.id);

      if (error) throw error;
      toast.success('Leave entry deleted successfully.');
      if (viewingStaff) {
        fetchStaffLeaveData(viewingStaff.id);
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to delete entry: ' + (err.message || 'unknown error'));
    }
  };

  const showToast = useCallback((type: 'success' | 'error', text: string) => {
    if (type === 'success') toast.success(text);
    else toast.error(text);
  }, []);

  const logActivity = async (actionType: string, targetId: string | null, details: string) => {
    try {
      await supabase.from('audit_logs').insert({
        user_id: sessionUser?.id,
        action_type: actionType,
        target_id: targetId,
        details,
        ip_address: 'System',
      });
    } catch (e) {
      console.error('Audit logging failed:', e);
    }
  };

  // Setup Admin Actions hook
  const { createUser, resetUserPassword, deleteUser, adminUpdateUserProfile } = useAdminActions({
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
      // Also update has_changed_password to true since admin updated it to a custom one
      await supabase
        .from('profiles')
        .update({ has_changed_password: true, is_setup_completed: true })
        .eq('id', viewingStaff.id);

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
      const { error } = await supabase
        .from('profiles')
        .update({ has_changed_password: false, is_setup_completed: false })
        .eq('id', viewingStaff.id);
      
      if (error) {
        console.error('Error updating profiles has_changed_password flag:', error);
      } else {
        toast.success('Password reset to default (1234). User must change it next login.');
        fetchProfiles();
      }
      setShowResetConfirmModal(false);
    }
    setSubmitting(false);
  };

  const fetchProfiles = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('username', { ascending: true });
      if (error) throw error;
      if (data) setProfiles(data);
    } catch (e: any) {
      console.error('Failed to load profiles:', e);
      toast.error('Failed to load user accounts.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  const handleCreateUserWrapper = async (params: any) => {
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
      params.allowReserve
    );
    return pw;
  };

  const handleUpdateUser = async () => {
    if (!viewingStaff) return;

    if (editHasQuotesAccess && editUserAllowedTypes.length === 0) {
      toast.error('Please select at least one permitted file type for Quotes.');
      return;
    }
    if (profile?.role === 'admin' && !editHasChutiAccess && !editHasQuotesAccess) {
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
      editAllowReserve
    );

    setSubmitting(false);

    if (success) {
      // Refresh profiles list
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .order('username', { ascending: true });
      if (data) {
        setProfiles(data);
        const updated = data.find(p => p.id === viewingStaff.id);
        if (updated) {
          setViewingStaff(updated);
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

  // Filter visible profiles based on supervisor access constraint
  const visibleProfiles = profiles
    .filter((u) => {
      if (profile?.role === 'supervisor') {
        // Supervisor sees users they supervise OR users who have quotes access
        const isSupervisedByMe = Array.isArray(u.supervisor_ids) && u.supervisor_ids.includes(profile.id);
        return isSupervisedByMe || !!u.has_quotes_access;
      }
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

  const isAdmin = profile?.role === 'admin';

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
          <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-850 shadow-2xl rounded-2xl p-6 flex flex-col gap-4">
            <div className="flex justify-between items-start md:items-center flex-col md:flex-row gap-6 w-full">
              <div className="flex items-center gap-4">
                <button
                  id="user-manage-detail-back"
                  onClick={() => {
                    setViewingStaff(null);
                    setIsCreatingNewUser(false);
                  }}
                  className="p-2.5 bg-slate-850 border border-slate-700 text-slate-300 rounded-xl hover:bg-slate-750 transition-all cursor-pointer"
                  title="Go Back"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <div>
                  <h2 className="text-xl font-bold text-white flex items-center">
                    {isCreatingNewUser ? (
                      'Add New Staff'
                    ) : (
                      viewingStaff && (
                        <UserDisplayName
                          profile={viewingStaff}
                          badge={topPerformerBadges[viewingStaff.id]}
                          tooltipPosition="bottom"
                        />
                      )
                    )}
                  </h2>
                  {!isCreatingNewUser && viewingStaff && (
                    <div className="flex flex-wrap gap-4 mt-2 text-xs text-slate-405">
                      <div>Working Hours: <strong className="text-white">{viewingStaff.working_hours || 9.5} hrs</strong></div>
                      <div>Break Time: <strong className="text-white">{viewingStaff.break_time || 0} mins</strong></div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Employee 360 Hub Subtabs (Horizontal Top Tabs) */}
            {!isCreatingNewUser && viewingStaff && (
              <div className="flex border-b border-slate-800 gap-1 mt-2">
                {(profile?.role === 'admin' || (profile?.role === 'supervisor' && viewingStaff && Array.isArray(viewingStaff.supervisor_ids) && viewingStaff.supervisor_ids.includes(profile.id))) && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveSubTab('leave');
                      localStorage.setItem('user_management_active_subtab', 'leave');
                    }}
                    className={`px-4 py-2 text-xs font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                      activeSubTab === 'leave'
                        ? 'border-blue-500 text-blue-400 font-bold'
                        : 'border-transparent text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Calendar className="h-3.5 w-3.5" /> Leave History
                  </button>
                )}
                {viewingStaff.has_quotes_access && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveSubTab('quotes');
                      localStorage.setItem('user_management_active_subtab', 'quotes');
                    }}
                    className={`px-4 py-2 text-xs font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                      activeSubTab === 'quotes'
                        ? 'border-blue-500 text-blue-400 font-bold'
                        : 'border-transparent text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <FileText className="h-3.5 w-3.5 text-purple-400" /> Quotes History
                  </button>
                )}
                {viewingStaff.has_quotes_access && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveSubTab('kpi');
                      localStorage.setItem('user_management_active_subtab', 'kpi');
                    }}
                    className={`px-4 py-2 text-xs font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                      activeSubTab === 'kpi'
                        ? 'border-blue-500 text-blue-400 font-bold'
                        : 'border-transparent text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <BarChart2 className="h-3.5 w-3.5" /> KPI & Performance
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setActiveSubTab('profile');
                    localStorage.setItem('user_management_active_subtab', 'profile');
                  }}
                  className={`px-4 py-2 text-xs font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeSubTab === 'profile'
                      ? 'border-blue-500 text-blue-400 font-bold'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Settings className="h-3.5 w-3.5" /> Profile Settings
                </button>
              </div>
            )}
          </div>

          {/* Form / Tab contents */}
          {isCreatingNewUser ? (
            <CreateUserPanel
              isAdmin={isAdmin}
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
                  submitting={submitting}
                  profiles={profiles}
                  viewingStaff={viewingStaff}
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
                  isSupervisor={profile?.role === 'supervisor'}
                />
              )}

              {activeSubTab === 'leave' && viewingStaff && (
                showAddLeaveForStaff && (profile?.role === 'supervisor' || profile?.role === 'admin') && globalSettings ? (
                  // Full-page AddLeave view for supervisor/admin adding on behalf
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 pb-3 border-b border-slate-800/60">
                      <button
                        onClick={() => setShowAddLeaveForStaff(false)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-xs font-semibold text-slate-355 hover:text-white transition-all cursor-pointer"
                      >
                        <ArrowLeft className="h-3.5 w-3.5" />
                        Back to Leave History
                      </button>
                      <div>
                        <p className="text-xs text-slate-400">
                          Adding leave on behalf of{' '}
                          <span className="text-white font-semibold">{viewingStaff.full_name || viewingStaff.username}</span>{' '}
                          ({viewingStaff.username?.toUpperCase()})
                        </p>
                      </div>
                    </div>
                    <AddLeave
                      profile={profile}
                      profilesList={profiles}
                      records={viewingStaffRecords}
                      globalSettings={globalSettings}
                      leaveSettlements={viewingStaffSettlements}
                      onSuccess={() => {
                        setShowAddLeaveForStaff(false);
                        setActiveSubTab('leave');
                        // Refresh leave data
                        fetchStaffLeaveData(viewingStaff.id);
                      }}
                      onConvertShortLeaveToFullLeave={() => {}}
                      holidayResponses={viewingStaffHolidayResponses}
                      initialFetchDone={true}
                      targetUser={viewingStaff}
                      addedBySupervisor={profile?.role === 'supervisor'}
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
                    selectedYear={selectedYear}
                    setSelectedYear={setSelectedYear}
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
                    isSupervisor={profile?.role === 'supervisor'}
                    onAddLeaveClick={() => setShowAddLeaveForStaff(true)}
                    hideDelete={profile?.role === 'supervisor'}
                    showAddLeave={profile?.role === 'admin' || profile?.role === 'supervisor'}
                  />
                )
              )}

              {activeSubTab === 'quotes' && viewingStaff && viewingStaff.has_quotes_access && (
                <UserQuotesHistoryPanel viewingStaff={viewingStaff} />
              )}

              {activeSubTab === 'kpi' && viewingStaff && (
                <UserKpiPerformancePanel viewingStaff={viewingStaff} />
              )}
            </>
          )}
        </div>
      ) : isLoading ? (
        <UserManagementSkeleton rows={8} />
      ) : (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-white">User Management</h2>
              <p className="text-xs text-slate-450 mt-1">
                Add new staff members, set roles (Admin, Supervisor, User), and configure Leave and Quotes Tracker access permissions.
              </p>
            </div>

            <div className="flex items-center gap-2 font-sans">
              {isAdmin && (
                <button
                  onClick={() => {
                    setIsCreatingNewUser(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-blue-950/20 active:scale-95 transition-all cursor-pointer"
                >
                  <UserPlus className="h-4 w-4" />
                  Add New Staff
                </button>
              )}
            </div>
          </div>

          {/* Search and Filters */}
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-slate-955/45 p-4 rounded-xl border border-slate-800/40">
            <div className="relative w-full md:max-w-xs">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-500">
                <Search className="h-4 w-4" />
              </span>
              <input
                type="text"
                placeholder="Search by name or codename..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-slate-900/60 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/50 transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-500 hover:text-slate-350 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="text-[11px] text-slate-400">
              Showing <span className="text-white font-semibold">{visibleProfiles.length}</span> users
            </div>
          </div>

          {/* Users Table */}
          <div className="bg-slate-955/20 rounded-xl border border-slate-850 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/40 text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                    <th className="py-3 px-4">Name / Codename</th>
                    <th className="py-3 px-4 text-center">Role</th>
                    <th className="py-3 px-4 text-center">Leave Tracker</th>
                    <th className="py-3 px-4 text-center">Quotes Tracker</th>
                    <th className="py-3 px-4 text-center">File Type</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850 text-xs text-slate-300">
                  {visibleProfiles.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-500">
                        No users found.
                      </td>
                    </tr>
                  ) : (
                    visibleProfiles.map((u: Profile) => (
                      <tr 
                        key={u.id} 
                        onDoubleClick={() => {
                          const isSupervisedByMe = profile?.role === 'admin' || (profile?.role === 'supervisor' && Array.isArray(u.supervisor_ids) && u.supervisor_ids.includes(profile.id));
                          if (isSupervisedByMe) {
                            setActiveSubTab('leave');
                          } else {
                            setActiveSubTab(u.has_quotes_access ? 'quotes' : 'profile');
                          }
                          setViewingStaff(u);
                        }}
                        className="hover:bg-slate-900/25 transition-colors cursor-pointer select-none"
                        title="Double-click to view details"
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center">
                            <UserDisplayName
                              profile={u}
                              badge={topPerformerBadges[u.id]}
                              tooltipPosition="top"
                            />
                          </div>
                          <div className="text-[10px] text-slate-455 uppercase mt-0.5 tracking-wider font-mono">
                            {u.username.trim()}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium border ${
                            u.role === 'admin'
                              ? 'bg-red-950/40 border-red-900/50 text-red-400'
                              : u.role === 'supervisor'
                              ? 'bg-purple-955/40 border-purple-800/50 text-purple-400'
                              : 'bg-slate-850 border-slate-750 text-slate-400'
                          }`}>
                            <Shield className="h-3 w-3 shrink-0" />
                            {u.role === 'admin' ? 'Admin' : u.role === 'supervisor' ? 'Supervisor' : 'User'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {u.has_chuti_access ? (
                            <CheckCircle2 className="h-4.5 w-4.5 text-emerald-500 mx-auto" />
                          ) : (
                            <XCircle className="h-4.5 w-4.5 text-slate-700 mx-auto" />
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {u.has_quotes_access ? (
                            <CheckCircle2 className="h-4.5 w-4.5 text-emerald-500 mx-auto" />
                          ) : (
                            <XCircle className="h-4.5 w-4.5 text-slate-700 mx-auto" />
                          )}
                        </td>
                        <td className="py-3 px-4 text-center max-w-xs truncate" title={(u.allowed_types || []).filter(t => t !== 'Review Van' && t !== 'Review Bike').join(', ')}>
                          {!u.has_quotes_access ? (
                            <span className="text-slate-600 italic text-[11px]">No access</span>
                          ) : (u.allowed_types || []).filter(t => t !== 'Review Van' && t !== 'Review Bike').length === ALL_FILE_TYPES.length ? (
                            <span className="text-blue-400 font-medium text-[11px] block text-center">All Categories</span>
                          ) : (u.allowed_types || []).filter(t => t !== 'Review Van' && t !== 'Review Bike').length === 0 ? (
                            <span className="text-red-400/80 font-medium text-[11px] block text-center">None Allowed</span>
                          ) : (
                            <span className="text-slate-400 text-[11px] block text-center">{(u.allowed_types || []).filter(t => t !== 'Review Van' && t !== 'Review Bike').join(', ')}</span>
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
                <div className="text-xs text-slate-300">
                  Are you sure you want to reset the password for <strong className="text-white">{(viewingStaff?.username || '').toUpperCase()}</strong> to the default <strong className="text-blue-400">1234</strong>?
                  <p className="text-[11px] text-slate-500 mt-2">The user will be forced to change this default password on their next login.</p>
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
                    <p>💡 Here you can set a new <strong>password</strong> for <strong className="text-white">{viewingStaff.username.toUpperCase()}</strong>.</p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">New Password</label>
                    <input
                      type="password"
                      placeholder="Enter new password"
                      value={credNewPassword}
                      onChange={(e) => setCredNewPassword(e.target.value)}
                      className="mt-1 block w-full px-3 py-2 bg-slate-955 border border-slate-800 rounded-lg text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-550"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Confirm New Password</label>
                    <input
                      type="password"
                      placeholder="Confirm new password"
                      value={credConfirmPassword}
                      onChange={(e) => setCredConfirmPassword(e.target.value)}
                      className="mt-1 block w-full px-3 py-2 bg-slate-955 border border-slate-800 rounded-lg text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-550"
                    />
                  </div>

                  <div className="flex gap-3 pt-4 border-t border-slate-800/80 font-sans">
                    <button
                      type="button"
                      onClick={() => setShowCredentialsModal(false)}
                      className="flex-1 flex justify-center py-2 px-4 border border-slate-800 rounded-lg text-xs font-semibold text-slate-400 hover:text-slate-350 bg-slate-955 hover:bg-slate-900 cursor-pointer transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleUpdatePassword}
                      disabled={updatingCredentials || !credNewPassword || credNewPassword !== credConfirmPassword || credNewPassword.length < 4}
                      className="flex-1 flex justify-center py-2 px-4 border border-transparent rounded-lg shadow-sm text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 cursor-pointer transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                    >
                      {updatingCredentials && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      {updatingCredentials ? 'Saving...' : 'Update Password'}
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
              title="Delete User Account"
              message={
                <div>
                  Are you sure you want to permanently delete the user account{' '}
                  <strong className="text-white">{(deletingUserAccount?.username || '').toUpperCase()}</strong>?
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
