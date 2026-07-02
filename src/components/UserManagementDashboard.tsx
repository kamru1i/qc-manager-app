'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/utils/supabase';
import { Profile } from '@/types';
import { useAdminActions } from '@/hooks/useAdminActions';
import { Navbar } from '@/components/Navbar';
import { UnifiedSidebar } from '@/components/UnifiedSidebar';
import { AddUserModal } from '@/components/modals/AddUserModal';
import { EditProfileModal } from '@/components/modals/EditProfileModal';
import { ConfirmModal } from '@/components/modals/ConfirmModal';
import { Modal } from '@/components/Modal';
import toast from 'react-hot-toast';
import { Search, UserPlus, Shield, Edit, Trash2, CheckCircle2, XCircle, Loader2, X, ArrowLeft, AlertTriangle, KeyRound, Check, RefreshCw } from 'lucide-react';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import { BadgeInfo } from '@/utils/leaderboardHelper';
import { CategoryCheckboxList } from '@/components/CategoryCheckboxList';
import { Toggle } from '@/components/Toggle';

interface UserManagementDashboardProps {
  sessionUser: { id: string } | null;
  profile: Profile | null;
  onLogout: () => void;
  theme: 'dark' | 'light';
  onThemeToggle: () => void;
  isSidebarCollapsed: boolean;
  onSidebarToggle: () => void;
  topPerformerBadges?: Record<string, BadgeInfo>;
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
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
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

  // Double-click viewing state
  const [viewingStaff, setViewingStaff] = useState<Profile | null>(null);
  const [viewingStaffRecords, setViewingStaffRecords] = useState<any[]>([]);
  const [viewingStaffStats, setViewingStaffStats] = useState<any>(null);

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
      if (!viewingStaff) return;
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
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewingStaff]);

  // No database load required since leave record table is removed from User Management details view.

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
      newCodename,
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
      setIsAddUserModalOpen(false);
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
      toast.success('Profile settings updated successfully.');
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

  return (
    <>
      {viewingStaff ? (
        <div className="space-y-6 animate-modal-content">
          {/* Header/Top Box */}
          <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-850 shadow-2xl rounded-2xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setViewingStaff(null)}
                className="p-2.5 bg-slate-850 border border-slate-700 text-slate-300 rounded-xl hover:bg-slate-750 transition-all cursor-pointer"
                title="Go Back"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  {viewingStaff.full_name || 'Staff User'}{viewingStaff.username ? ` (${viewingStaff.username.toUpperCase()})` : ''}
                  <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${
                    viewingStaff.role === 'admin'
                      ? 'bg-red-950/60 border-red-900 text-red-300'
                      : viewingStaff.role === 'supervisor'
                        ? 'bg-amber-955/60 border-amber-805 text-amber-300'
                        : 'bg-slate-850 border-slate-750 text-slate-400'
                  }`}>
                    {viewingStaff.role === 'admin' ? 'Admin' : (viewingStaff.role === 'supervisor' ? 'Supervisor' : 'Staff')}
                  </span>
                </h2>
                <div className="flex flex-wrap gap-4 mt-2 text-xs text-slate-405">
                  <div>Working Hours: <strong className="text-white">{viewingStaff.working_hours || 9.5} hrs</strong></div>
                  <div>Break Time: <strong className="text-white">{viewingStaff.break_time || 0} mins</strong></div>
                </div>
              </div>
            </div>
          </div>

          {/* Profile Details Fields */}
          <div className="bg-slate-900/40 border border-slate-850 p-5 rounded-2xl shadow-xl grid grid-cols-1 md:grid-cols-2 gap-4">
            {isAdmin ? (
              <>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Full Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Kamrul Islam"
                    value={editUserFullName}
                    onChange={(e) => setEditUserFullName(e.target.value)}
                    className="block w-full px-3 py-2 bg-slate-955 border border-slate-800 rounded-lg text-white text-xs focus:outline-none focus:border-orange-500/50"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Account Role</label>
                  <select
                    value={editUserRole}
                    onChange={(e) => {
                      const val = e.target.value as 'admin' | 'user' | 'supervisor';
                      setEditUserRole(val);
                      if (val === 'admin') {
                        setEditUserCanManageRules(true);
                      }
                    }}
                    className="block w-full px-3 py-2 bg-slate-955 border border-slate-800 rounded-lg text-white text-xs focus:outline-none focus:border-orange-500/50 cursor-pointer"
                  >
                    <option value="user">User</option>
                    <option value="supervisor">Supervisor</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </>
            ) : (
              <>
                <div>
                  <span className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Full Name</span>
                  <span className="text-white text-sm font-semibold">{viewingStaff.full_name || '—'}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Account Role</span>
                  <span className="text-white text-sm font-semibold capitalize">{viewingStaff.role || '—'}</span>
                </div>
              </>
            )}
          </div>

          {/* Workspace Access & Permissions Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Leave Tracker Access Card */}
            <div className="bg-slate-900/40 border border-slate-850 p-5 rounded-2xl shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800/60 pb-3">
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${editHasChutiAccess ? 'bg-emerald-500 shadow-lg shadow-emerald-500/50' : 'bg-slate-600'}`} />
                  <h3 className="text-sm font-bold text-white">Leave Tracker Workspace</h3>
                </div>
                {isAdmin && (
                  <Toggle
                    checked={editHasChutiAccess}
                    onChange={setEditHasChutiAccess}
                    label="Access"
                  />
                )}
              </div>

              {editHasChutiAccess ? (
                <div className="space-y-4 text-xs text-slate-350">
                  {/* Supervisor Approval Required */}
                  <label className={`flex items-start gap-2.5 select-none ${isAdmin ? 'cursor-pointer group' : 'opacity-80 pointer-events-none'}`}>
                    <div className="relative flex items-center mt-0.5">
                      <input
                        type="checkbox"
                        checked={editNeedsApproval}
                        disabled={!isAdmin}
                        onChange={(e) => setEditNeedsApproval(e.target.checked)}
                        className="sr-only"
                      />
                      <div className={`h-4 w-4 rounded-full flex items-center justify-center border transition-all shrink-0 ${
                        editNeedsApproval
                          ? 'bg-orange-600 border-orange-500 text-white font-bold'
                          : 'border-slate-700 bg-slate-955 text-transparent'
                      }`}>
                        {editNeedsApproval && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                      </div>
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-slate-300 group-hover:text-white transition-colors block">
                        Supervisor Approval Required?
                      </span>
                      <span className="text-[10px] text-slate-500 block leading-tight">
                        Requires approval from a supervisor for any leave submissions.
                      </span>
                    </div>
                  </label>

                  {/* Supervisors List Selection */}
                  {editNeedsApproval && profiles.filter(p => p.role === 'supervisor').length > 0 && (
                    <div className="space-y-2 bg-slate-955/40 p-3 rounded-xl border border-slate-850 ml-6.5">
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="font-semibold text-slate-400">Select Supervisors</span>
                        <span className="text-slate-500 font-mono">
                          {editSupervisorIds.length > 0 ? `${editSupervisorIds.length} Selected` : 'All Selected'}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 max-h-[120px] overflow-y-auto pr-1">
                        <label className={`flex items-center gap-1.5 px-2 py-0.5 rounded border transition-all select-none text-[10px] ${
                          isAdmin ? 'cursor-pointer' : 'opacity-85 pointer-events-none'
                        } ${
                          editSupervisorIds.length === 0 
                            ? 'border-orange-600/60 bg-orange-955/20 text-orange-400 font-semibold' 
                            : 'border-slate-800 bg-slate-955 text-slate-400'
                        }`}>
                          <input
                            type="checkbox"
                            checked={editSupervisorIds.length === 0}
                            disabled={!isAdmin}
                            onChange={() => setEditSupervisorIds([])}
                            className="shrink-0 scale-75 cursor-pointer"
                          />
                          <span>All</span>
                        </label>
                        {profiles.filter(p => p.role === 'supervisor').map(sup => {
                          const isChecked = editSupervisorIds.includes(sup.id);
                          return (
                            <label 
                              key={sup.id} 
                              className={`flex items-center gap-1.5 px-2 py-0.5 rounded border transition-all select-none text-[10px] ${
                                isAdmin ? 'cursor-pointer' : 'opacity-85 pointer-events-none'
                              } ${
                                isChecked 
                                  ? 'border-orange-600/60 bg-orange-955/20 text-orange-400 font-semibold' 
                                  : 'border-slate-800 bg-slate-955 text-slate-400'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                disabled={!isAdmin}
                                onChange={() => {
                                  if (isChecked) {
                                    setEditSupervisorIds(editSupervisorIds.filter(id => id !== sup.id));
                                  } else {
                                    setEditSupervisorIds([...editSupervisorIds, sup.id]);
                                  }
                                }}
                                className="shrink-0 scale-75 cursor-pointer"
                              />
                              <span>{sup.username.toUpperCase()}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Office Leave Eligible */}
                  <label className={`flex items-start gap-2.5 select-none ${isAdmin ? 'cursor-pointer group' : 'opacity-80 pointer-events-none'}`}>
                    <div className="relative flex items-center mt-0.5">
                      <input
                        type="checkbox"
                        checked={editEligibleOfficeLeave}
                        disabled={!isAdmin}
                        onChange={(e) => setEditEligibleOfficeLeave(e.target.checked)}
                        className="sr-only"
                      />
                      <div className={`h-4 w-4 rounded-full flex items-center justify-center border transition-all shrink-0 ${
                        editEligibleOfficeLeave
                          ? 'bg-orange-600 border-orange-500 text-white font-bold'
                          : 'border-slate-700 bg-slate-955 text-transparent'
                      }`}>
                        {editEligibleOfficeLeave && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                      </div>

                    </div>
                    <div>
                      <span className="text-xs font-semibold text-slate-300 group-hover:text-white transition-colors block">
                        Office Leave Eligible?
                      </span>
                      <span className="text-[10px] text-slate-500 block leading-tight">
                        Eligible for annual office leaves & Eid holidays.
                      </span>
                    </div>
                  </label>

                  {/* Govt Holiday Eligible */}
                  <label className={`flex items-start gap-2.5 select-none ${isAdmin ? 'cursor-pointer group' : 'opacity-80 pointer-events-none'}`}>
                    <div className="relative flex items-center mt-0.5">
                      <input
                        type="checkbox"
                        checked={editEligibleGovtHoliday}
                        disabled={!isAdmin}
                        onChange={(e) => setEditEligibleGovtHoliday(e.target.checked)}
                        className="sr-only"
                      />
                      <div className={`h-4 w-4 rounded-full flex items-center justify-center border transition-all shrink-0 ${
                        editEligibleGovtHoliday
                          ? 'bg-orange-600 border-orange-500 text-white font-bold'
                          : 'border-slate-700 bg-slate-955 text-transparent'
                      }`}>
                        {editEligibleGovtHoliday && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                      </div>

                    </div>
                    <div>
                      <span className="text-xs font-semibold text-slate-300 group-hover:text-white transition-colors block">
                        Govt Holiday Eligible?
                      </span>
                      <span className="text-[10px] text-slate-500 block leading-tight">
                        Eligible for government list holidays.
                      </span>
                    </div>
                  </label>

                  {/* Overtime Category */}
                  <label className={`flex items-start gap-2.5 select-none ${isAdmin ? 'cursor-pointer group' : 'opacity-80 pointer-events-none'}`}>
                    <div className="relative flex items-center mt-0.5">
                      <input
                        type="checkbox"
                        checked={editAllowOvertime}
                        disabled={!isAdmin}
                        onChange={(e) => setEditAllowOvertime(e.target.checked)}
                        className="sr-only"
                      />
                      <div className={`h-4 w-4 rounded-full flex items-center justify-center border transition-all shrink-0 ${
                        editAllowOvertime
                          ? 'bg-orange-600 border-orange-500 text-white font-bold'
                          : 'border-slate-700 bg-slate-955 text-transparent'
                      }`}>
                        {editAllowOvertime && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                      </div>

                    </div>
                    <div>
                      <span className="text-xs font-semibold text-slate-300 group-hover:text-white transition-colors block">
                        Overtime Category?
                      </span>
                      <span className="text-[10px] text-slate-500 block leading-tight">
                        Allows overtime submission category.
                      </span>
                    </div>
                  </label>

                  {/* Reserve Govt Holiday */}
                  <label className={`flex items-start gap-2.5 select-none ${isAdmin ? 'cursor-pointer group' : 'opacity-80 pointer-events-none'}`}>
                    <div className="relative flex items-center mt-0.5">
                      <input
                        type="checkbox"
                        checked={editAllowReserve}
                        disabled={!isAdmin}
                        onChange={(e) => setEditAllowReserve(e.target.checked)}
                        className="sr-only"
                      />
                      <div className={`h-4 w-4 rounded-full flex items-center justify-center border transition-all shrink-0 ${
                        editAllowReserve
                          ? 'bg-orange-600 border-orange-500 text-white font-bold'
                          : 'border-slate-700 bg-slate-955 text-transparent'
                      }`}>
                        {editAllowReserve && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                      </div>

                    </div>
                    <div>
                      <span className="text-xs font-semibold text-slate-300 group-hover:text-white transition-colors block">
                        Reserve Govt Holiday?
                      </span>
                      <span className="text-[10px] text-slate-500 block leading-tight">
                        Provides option to reserve government list holidays.
                      </span>
                    </div>
                  </label>
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic py-4 text-center">This user does not have access to the Leave Tracker workspace.</p>
              )}
            </div>

            {/* Quotes Manager Access Card */}
            <div className="bg-slate-900/40 border border-slate-850 p-5 rounded-2xl shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800/60 pb-3">
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${editHasQuotesAccess ? 'bg-emerald-500 shadow-lg shadow-emerald-500/50' : 'bg-slate-600'}`} />
                  <h3 className="text-sm font-bold text-white">Quotes Manager Workspace</h3>
                </div>
                {isAdmin && (
                  <Toggle
                    checked={editHasQuotesAccess}
                    onChange={setEditHasQuotesAccess}
                    label="Access"
                  />
                )}
              </div>

              {editHasQuotesAccess ? (
                <div className="space-y-4">
                  {/* Category Checklist */}
                  <CategoryCheckboxList
                    allowedTypes={editUserAllowedTypes}
                    onChange={setEditUserAllowedTypes}
                  />

                  {/* Can Manage Quote Rules (Only Admin edits) */}
                  <div className="border-t border-slate-850/70 pt-3">
                    <label className={`flex items-center gap-2.5 select-none ${
                      isAdmin && editUserRole !== 'admin' ? 'cursor-pointer group' : 'opacity-70 pointer-events-none'
                    }`}>
                      <div className="relative flex items-center">
                        <input
                          type="checkbox"
                          checked={editUserCanManageRules || editUserRole === 'admin'}
                          disabled={!isAdmin || editUserRole === 'admin'}
                          onChange={(e) => setEditUserCanManageRules(e.target.checked)}
                          className="sr-only"
                        />
                        <div className={`h-4 w-4 rounded flex items-center justify-center border transition-all shrink-0 ${
                          (editUserCanManageRules || editUserRole === 'admin')
                            ? 'bg-orange-600 border-orange-500 text-white font-bold'
                            : 'border-slate-700 bg-slate-955 text-transparent'
                        }`}>
                          {(editUserCanManageRules || editUserRole === 'admin') && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                        </div>
                      </div>
                      <span className="text-xs font-semibold text-slate-300 group-hover:text-white transition-colors">
                        Can Manage Quote Rules? {editUserRole === 'admin' && <span className="text-[10px] text-slate-500 font-normal italic ml-1">(Always Allowed for Admin)</span>}
                      </span>
                    </label>
                    <p className="text-[10px] text-slate-500 mt-1 ml-6.5">
                      Allows user to add, edit, or delete compliance rules and view history.
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic py-4 text-center">This user does not have access to the Quotes Manager workspace.</p>
              )}
            </div>
          </div>

          {/* Action Buttons at the Bottom */}
          <div className="bg-slate-900/20 border border-slate-850/60 p-5 rounded-2xl flex flex-wrap justify-between items-center gap-4 mt-6">
            {/* Left side actions (Reset & Change Pass, Delete User) */}
            <div className="flex flex-wrap gap-2.5 font-sans">
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setShowResetConfirmModal(true)}
                  className="px-4 py-2 bg-slate-850 hover:bg-slate-750 border border-slate-700 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center gap-1.5"
                >
                  <RefreshCw className="h-3.5 w-3.5 text-amber-500" /> Reset Password?
                </button>
              )}
              
              <button
                type="button"
                onClick={() => {
                  setCredNewPassword('');
                  setCredConfirmPassword('');
                  setShowCredentialsModal(true);
                }}
                className="px-4 py-2 bg-slate-850 hover:bg-slate-750 border border-slate-700 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center gap-1.5"
              >
                <KeyRound className="h-3.5 w-3.5 text-blue-400" /> Change Password
              </button>

              {isAdmin && viewingStaff.role !== 'admin' && (
                <button
                  type="button"
                  onClick={() => setDeletingUserAccount({ id: viewingStaff.id, username: viewingStaff.username })}
                  className="px-4 py-2.5 bg-red-950/20 hover:bg-red-900/30 border border-red-900/50 text-red-400 rounded-xl text-xs font-semibold cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center gap-1.5"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete Account
                </button>
              )}
            </div>

            {/* Right side actions (Save Changes button) */}
            <div className="font-sans">
              <button
                type="button"
                disabled={submitting}
                onClick={handleUpdateUser}
                className="px-6 py-2.5 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white rounded-xl text-xs font-bold cursor-pointer transition-all shadow-lg shadow-orange-950/20 border border-orange-700/30 flex items-center gap-1.5 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {submitting ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
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

            <div className="flex items-center gap-2">
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
                    setIsAddUserModalOpen(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-orange-950/20 active:scale-95 transition-all cursor-pointer"
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
                className="w-full pl-9 pr-8 py-2 bg-slate-900/60 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-orange-500/50 transition-colors"
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
                          <Loader2 className="h-6 w-6 text-orange-500 animate-spin" />
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
                            {u.username}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium border ${
                            u.role === 'admin'
                              ? 'bg-red-950/40 border-red-900/50 text-red-400'
                              : u.role === 'supervisor'
                              ? 'bg-amber-955/40 border-amber-800/50 text-amber-400'
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
            {/* Add User Modal */}
            {isAddUserModalOpen && (
              <AddUserModal
                newCodename={newCodename}
                setNewCodename={setNewCodename}
                newFullName={newFullName}
                setNewFullName={setNewFullName}
                newRole={newRole}
                setNewRole={setNewRole}
                hasChutiAccess={hasChutiAccess}
                setHasChutiAccess={setHasChutiAccess}
                hasQuotesAccess={hasQuotesAccess}
                setHasQuotesAccess={setHasQuotesAccess}
                allowedTypes={allowedTypes}
                setAllowedTypes={setAllowedTypes}
                canManageRules={canManageRules}
                setCanManageRules={setCanManageRules}
                submitting={submitting}
                onSubmit={handleCreateUser}
                onClose={() => {
                  setIsAddUserModalOpen(false);
                  setGeneratedPassword(null);
                  setCanManageRules(false);
                  setHasChutiAccess(true);
                  setHasQuotesAccess(false);
                  setAllowedTypes([]);
                  setNewNeedsApproval(false);
                  setNewSupervisorIds([]);
                  setNewEligibleGovtHoliday(false);
                  setNewEligibleOfficeLeave(false);
                  setNewAllowOvertime(false);
                  setNewAllowReserve(false);
                }}
                supervisors={profiles.filter(p => p.role === 'supervisor')}
                needsSupervisorApproval={newNeedsApproval}
                setNeedsSupervisorApproval={setNewNeedsApproval}
                supervisorIds={newSupervisorIds}
                setSupervisorIds={setNewSupervisorIds}
                eligibleGovtHoliday={newEligibleGovtHoliday}
                setEligibleGovtHoliday={setNewEligibleGovtHoliday}
                eligibleOfficeLeave={newEligibleOfficeLeave}
                setEligibleOfficeLeave={setNewEligibleOfficeLeave}
                allowOvertime={newAllowOvertime}
                setAllowOvertime={setNewAllowOvertime}
                allowReserve={newAllowReserve}
                setAllowReserve={setNewAllowReserve}
              />
            )}

            {/* Reset Password Confirmation Modal */}
            <ConfirmModal
              isOpen={showResetConfirmModal}
              onClose={() => setShowResetConfirmModal(false)}
              onConfirm={handleResetPasswordDefault}
              title="Reset Password to Default"
              message={
                <div className="text-xs text-slate-300">
                  Are you sure you want to reset the password for <strong className="text-white">{(viewingStaff?.username || '').toUpperCase()}</strong> to the default <strong className="text-orange-400">1234</strong>?
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
                icon={<KeyRound className="h-5 w-5 text-orange-500" />}
                maxWidthClass="max-w-md"
                glowClass="bg-orange-900/10"
              >
                <div className="space-y-4 font-sans">
                  <div className="p-3 bg-orange-955/20 border border-orange-900/30 rounded-xl text-xs text-orange-355">
                    <p>💡 Here you can set a new <strong>password</strong> for <strong className="text-white">{viewingStaff.username.toUpperCase()}</strong>.</p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">New Password</label>
                    <input
                      type="password"
                      placeholder="Enter new password"
                      value={credNewPassword}
                      onChange={(e) => setCredNewPassword(e.target.value)}
                      className="mt-1 block w-full px-3 py-2 bg-slate-955 border border-slate-800 rounded-lg text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-550"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Confirm New Password</label>
                    <input
                      type="password"
                      placeholder="Confirm new password"
                      value={credConfirmPassword}
                      onChange={(e) => setCredConfirmPassword(e.target.value)}
                      className="mt-1 block w-full px-3 py-2 bg-slate-955 border border-slate-800 rounded-lg text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-550"
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
                      className="flex-1 flex justify-center py-2 px-4 border border-transparent rounded-lg shadow-sm text-xs font-semibold text-white bg-orange-600 hover:bg-orange-500 cursor-pointer transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
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
