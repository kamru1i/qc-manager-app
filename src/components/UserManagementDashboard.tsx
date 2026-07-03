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
import { BadgeInfo } from '@/utils/leaderboardHelper';
import { CategoryCheckboxList } from '@/components/CategoryCheckboxList';
import { Toggle } from '@/components/Toggle';
import { StaffSettingsForm } from '@/components/StaffSettingsForm';

// Extracted Subtabs Panels
import { UserProfileSettingsPanel } from '@/components/user-management/UserProfileSettingsPanel';
import { UserLeaveHistoryPanel } from '@/components/user-management/UserLeaveHistoryPanel';
import { UserQuotesHistoryPanel } from '@/components/user-management/UserQuotesHistoryPanel';
import { UserKpiPerformancePanel } from '@/components/user-management/UserKpiPerformancePanel';
import { ChutiRecord } from '@/utils/offlineSync';
import { LeaveSettlement, GovtHolidayResponse } from '@/types';
import { GlobalSettings } from '@/utils/dashboardHelpers';

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
  const [newCodename, setNewCodename] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'supervisor' | 'user'>('user');
  const [hasChutiAccess, setHasChutiAccess] = useState(true);
  const [hasQuotesAccess, setHasQuotesAccess] = useState(false);
  const [allowedTypes, setAllowedTypes] = useState<string[]>([]);
  const [canManageRules, setCanManageRules] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);
  const [newNeedsApproval, setNewNeedsApproval] = useState(false);
  const [newSupervisorIds, setNewSupervisorIds] = useState<string[]>([]);
  const [newEligibleGovtHoliday, setNewEligibleGovtHoliday] = useState(false);
  const [newEligibleOfficeLeave, setNewEligibleOfficeLeave] = useState(false);
  const [newAllowOvertime, setNewAllowOvertime] = useState(false);
  const [newAllowReserve, setNewAllowReserve] = useState(false);

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
    return () => {
      if (detailNameHoverTimeoutRef.current) {
        clearTimeout(detailNameHoverTimeoutRef.current);
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
    if (viewingStaff && !viewingStaff.has_quotes_access && (activeSubTab === 'quotes' || activeSubTab === 'kpi')) {
      setActiveSubTab(profile?.role === 'supervisor' ? 'profile' : 'leave');
    }
  }, [viewingStaff, activeSubTab, profile]);

  // Reset subtab selection to 'leave' when viewingStaff is closed
  useEffect(() => {
    if (!viewingStaff) {
      setActiveSubTab('leave');
    }
  }, [viewingStaff]);

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
      // 1. Fetch chuti records
      const { data: chutiData, error: chutiError } = await supabase
        .from('chuti')
        .select('*')
        .eq('user_id', staffId)
        .is('deleted_at', null)
        .order('date', { ascending: false });

      if (chutiError) throw chutiError;
      setViewingStaffRecords(chutiData || []);

      // 2. Fetch leave settlements
      const { data: sData, error: sError } = await supabase
        .from('leave_settlements')
        .select('*')
        .eq('user_id', staffId);

      if (sError) throw sError;
      setViewingStaffSettlements(sData || []);

      // 3. Fetch holiday responses
      const { data: hrData, error: hrError } = await supabase
        .from('govt_holiday_responses')
        .select('*')
        .eq('user_id', staffId);

      if (hrError) throw hrError;
      setViewingStaffHolidayResponses(hrData || []);

      // 4. Fetch global settings from admin profile
      const { data: adminProfile, error: apError } = await supabase
        .from('profiles')
        .select('global_settings')
        .eq('role', 'admin')
        .limit(1)
        .single();

      if (!apError && adminProfile) {
        setGlobalSettings(adminProfile.global_settings);
      }
    } catch (e) {
      console.error('Failed to load staff leave data:', e);
      toast.error('Failed to load leave history.');
    } finally {
      setLoadingLeaveData(false);
    }
  }, []);

  // Fetch leave data on mount/change of selected staff member
  useEffect(() => {
    if (viewingStaff) {
      fetchStaffLeaveData(viewingStaff.id);
    }
  }, [viewingStaff, fetchStaffLeaveData]);

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
    } catch (e) {
      console.error('Failed to load profiles:', e);
      toast.error('Failed to load user accounts.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCodename.trim() || newCodename.trim().length < 3) {
      toast.error('Codename must be at least 3 characters long.');
      return;
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(newCodename.trim())) {
      toast.error('Codename can only contain letters, numbers, - and _.');
      return;
    }
    if (hasQuotesAccess && allowedTypes.length === 0) {
      toast.error('Please select at least one permitted file type for Quotes.');
      return;
    }
    if (!hasChutiAccess && !hasQuotesAccess) {
      toast.error('Please select at least one workspace access (Leave or Quotes Tracker).');
      return;
    }

    const pw = await createUser(
      newCodename.trim(),
      newRole,
      newFullName,
      hasQuotesAccess ? allowedTypes : [],
      canManageRules,
      hasChutiAccess,
      hasQuotesAccess,
      '1234',
      newNeedsApproval,
      newNeedsApproval ? newSupervisorIds : [],
      newEligibleGovtHoliday,
      newEligibleOfficeLeave,
      newAllowOvertime,
      newAllowReserve
    );

    if (pw) {
      setNewCodename('');
      setNewFullName('');
      setNewRole('user');
      setAllowedTypes([]);
      setCanManageRules(false);
      setHasChutiAccess(true);
      setHasQuotesAccess(false);
      setNewNeedsApproval(false);
      setNewSupervisorIds([]);
      setNewEligibleGovtHoliday(false);
      setNewEligibleOfficeLeave(false);
      setNewAllowOvertime(false);
      setNewAllowReserve(false);
      setIsCreatingNewUser(false);
      fetchProfiles();
    }
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
        // Supervisor only sees users who have quotes tracker access
        return !!u.has_quotes_access;
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
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    {isCreatingNewUser ? (
                      'Add New Staff'
                    ) : (
                      <>
                        <span 
                          onMouseEnter={() => {
                            detailNameHoverTimeoutRef.current = setTimeout(() => {
                              setShowDetailNameTooltip(true);
                            }, 2000);
                          }}
                          onMouseLeave={() => {
                            if (detailNameHoverTimeoutRef.current) {
                              clearTimeout(detailNameHoverTimeoutRef.current);
                              detailNameHoverTimeoutRef.current = null;
                            }
                            setShowDetailNameTooltip(false);
                          }}
                          className="relative group inline-flex items-center select-none cursor-help pb-0.5"
                        >
                          {viewingStaff?.full_name || 'Staff User'}
                          
                          {showDetailNameTooltip && (
                            <span className="absolute left-1/2 -translate-x-1/2 top-full mt-2.5 flex flex-col gap-1 z-50 w-40 p-2.5 text-[11px] leading-relaxed text-slate-350 bg-slate-950/95 border border-slate-800 rounded-xl shadow-2xl backdrop-blur-md animate-fade-in pointer-events-auto">
                              <div className="font-semibold text-white">
                                Codename: <span className="text-blue-400 font-mono select-all ml-1">{viewingStaff?.username ? viewingStaff.username.toUpperCase() : ''}</span>
                              </div>
                              <div className="border-t border-slate-850 my-0.5"></div>
                              <div className="text-slate-400 flex items-center gap-1.5 font-sans">
                                <span>Role:</span>
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-semibold border ${
                                  viewingStaff?.role === 'admin'
                                    ? 'bg-purple-955 border-purple-800 text-purple-300' 
                                    : 'bg-blue-955 border-blue-800 text-blue-300'
                                }`}>
                                  {viewingStaff?.role === 'admin' ? 'Admin' : (viewingStaff?.role === 'supervisor' ? 'Supervisor' : 'Staff')}
                                </span>
                              </div>
                            </span>
                          )}
                        </span>
                        {viewingStaff && topPerformerBadges[viewingStaff.id] && (
                          <VerifiedBadge badge={topPerformerBadges[viewingStaff.id]} position="bottom" />
                        )}
                      </>
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
                {profile?.role !== 'supervisor' && (
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
            <>
              <StaffSettingsForm
                isNewUser={true}
                codename={newCodename}
                setCodename={setNewCodename}
                fullName={newFullName}
                setFullName={setNewFullName}
                role={newRole}
                setRole={setNewRole}
                hasChutiAccess={hasChutiAccess}
                setHasChutiAccess={setHasChutiAccess}
                needsApproval={newNeedsApproval}
                setNeedsApproval={setNewNeedsApproval}
                supervisors={profiles.filter(p => p.role === 'supervisor')}
                supervisorIds={newSupervisorIds}
                setSupervisorIds={setNewSupervisorIds}
                eligibleOfficeLeave={newEligibleOfficeLeave}
                setEligibleOfficeLeave={setNewEligibleOfficeLeave}
                eligibleGovtHoliday={newEligibleGovtHoliday}
                setEligibleGovtHoliday={setNewEligibleGovtHoliday}
                allowOvertime={newAllowOvertime}
                setAllowOvertime={setNewAllowOvertime}
                allowReserve={newAllowReserve}
                setAllowReserve={setNewAllowReserve}
                hasQuotesAccess={hasQuotesAccess}
                setHasQuotesAccess={setHasQuotesAccess}
                allowedTypes={allowedTypes}
                setAllowedTypes={setAllowedTypes}
                canManageRules={canManageRules}
                setCanManageRules={setCanManageRules}
                isAdmin={isAdmin}
              />
              <div className="bg-slate-900/20 border border-slate-850/60 p-5 rounded-2xl flex flex-wrap justify-between items-center gap-4 mt-6">
                <div className="flex flex-wrap gap-2.5 font-sans">
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreatingNewUser(false);
                      setNewCodename('');
                      setNewFullName('');
                      setNewRole('user');
                      setAllowedTypes([]);
                      setCanManageRules(false);
                      setHasChutiAccess(true);
                      setHasQuotesAccess(false);
                      setNewNeedsApproval(false);
                      setNewSupervisorIds([]);
                      setNewEligibleGovtHoliday(false);
                      setNewEligibleOfficeLeave(false);
                      setNewAllowOvertime(false);
                      setNewAllowReserve(false);
                    }}
                    className="px-4 py-2 bg-slate-850 hover:bg-slate-750 border border-slate-700 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center gap-1.5"
                  >
                    <X className="h-3.5 w-3.5 text-red-400" /> Cancel
                  </button>
                </div>
                <div className="font-sans">
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={handleCreateUser}
                    className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-xl text-xs font-bold cursor-pointer transition-all shadow-lg shadow-blue-950/20 border border-blue-700/30 flex items-center gap-1.5 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
                  >
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    {submitting ? 'Creating...' : 'Create User'}
                  </button>
                </div>
              </div>
            </>
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
                />
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
                    setNewCodename('');
                    setNewFullName('');
                    setNewRole('user');
                    setHasChutiAccess(true);
                    setHasQuotesAccess(false);
                    setAllowedTypes([]);
                    setCanManageRules(false);
                    setGeneratedPassword(null);
                    setNewNeedsApproval(false);
                    setNewSupervisorIds([]);
                    setNewEligibleGovtHoliday(false);
                    setNewEligibleOfficeLeave(false);
                    setNewAllowOvertime(false);
                    setNewAllowReserve(false);
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
                  {isLoading ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-500">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Loader2 className="h-6 w-6 text-blue-500 animate-spin" />
                          <span>Loading user directory...</span>
                        </div>
                      </td>
                    </tr>
                  ) : visibleProfiles.length === 0 ? (
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
                          if (profile?.role === 'supervisor') {
                            setActiveSubTab(u.has_quotes_access ? 'quotes' : 'profile');
                          } else {
                            setActiveSubTab('leave');
                          }
                          setViewingStaff(u);
                        }}
                        className="hover:bg-slate-900/25 transition-colors cursor-pointer select-none"
                        title="Double-click to view details"
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center">
                            <span className="font-semibold text-white">{u.full_name || '—'}</span>
                            {topPerformerBadges[u.id] && (
                              <VerifiedBadge badge={topPerformerBadges[u.id]} />
                            )}
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
