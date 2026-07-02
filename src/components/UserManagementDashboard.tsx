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
import toast from 'react-hot-toast';
import { Search, UserPlus, Shield, Edit, Trash2, CheckCircle2, XCircle, Loader2, X } from 'lucide-react';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import { BadgeInfo } from '@/utils/leaderboardHelper';

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
      setGeneratedPassword(pw);
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
      fetchProfiles();
    }
  };

  const handleUpdateUser = async (newPasswordToSet?: string) => {
    if (!editingProfile) return;

    if (editHasQuotesAccess && editUserAllowedTypes.length === 0) {
      toast.error('Please select at least one permitted file type for Quotes.');
      return;
    }
    if (profile?.role === 'admin' && !editHasChutiAccess && !editHasQuotesAccess) {
      toast.error('Please select at least one workspace access.');
      return;
    }

    const success = await adminUpdateUserProfile(
      editingProfile.id,
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

    if (success) {
      if (newPasswordToSet) {
        const resetSuccess = await resetUserPassword(editingProfile.id, newPasswordToSet);
        if (resetSuccess) {
          toast.success('Password updated successfully.');
        }
      }
      setEditingProfile(null);
      fetchProfiles();
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
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-slate-950/45 p-4 rounded-xl border border-slate-800/40">
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
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850 text-xs text-slate-300">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-500">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Loader2 className="h-6 w-6 text-orange-500 animate-spin" />
                        <span>Loading user directory...</span>
                      </div>
                    </td>
                  </tr>
                ) : visibleProfiles.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-500">
                      No users found.
                    </td>
                  </tr>
                ) : (
                  visibleProfiles.map((u: Profile) => (
                    <tr key={u.id} className="hover:bg-slate-900/25 transition-colors">
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
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => {
                              setEditingProfile(u);
                              setEditUserFullName(u.full_name || '');
                              setEditUserRole(u.role || 'user');
                              setEditHasChutiAccess(!!u.has_chuti_access);
                              setEditHasQuotesAccess(!!u.has_quotes_access);
                              setEditUserAllowedTypes((u.allowed_types || []).filter(t => t !== 'Review Van' && t !== 'Review Bike'));
                              setEditUserCanManageRules(!!u.can_manage_rules);
                              setEditNeedsApproval(u.needs_supervisor_approval !== false);
                              setEditSupervisorIds(u.supervisor_ids || []);
                              setEditEligibleGovtHoliday(u.eligible_govt_holiday !== false);
                              setEditEligibleOfficeLeave(u.eligible_office_leave !== false);
                              setEditAllowOvertime(!!u.allow_overtime);
                              setEditAllowReserve(!!u.allow_reserve);
                            }}
                            className="p-1.5 bg-slate-900 border border-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                            title="Edit permissions"
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </button>

                          {isAdmin && (
                            <button
                              onClick={() => setDeletingUserAccount({ id: u.id, username: u.username })}
                              disabled={u.id === sessionUser?.id}
                              className="p-1.5 bg-slate-900 border border-slate-800 text-slate-500 hover:text-red-400 hover:border-red-950 rounded-lg transition-colors cursor-not-allowed disabled:opacity-30 disabled:hover:text-slate-500 cursor-pointer"
                              title="Delete user"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

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
                generatedPassword={generatedPassword}
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
                onCopyPassword={() => {
                  if (generatedPassword) {
                    navigator.clipboard.writeText(generatedPassword);
                    toast.success('Password copied to clipboard!');
                  }
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

            {/* Edit User Modal */}
            {editingProfile && (
              <EditProfileModal
                username={editingProfile.username}
                fullName={editUserFullName}
                setFullName={setEditUserFullName}
                role={editUserRole}
                setRole={setEditUserRole}
                hasChutiAccess={editHasChutiAccess}
                setHasChutiAccess={setEditHasChutiAccess}
                hasQuotesAccess={editHasQuotesAccess}
                setHasQuotesAccess={setEditHasQuotesAccess}
                allowedTypes={editUserAllowedTypes}
                setAllowedTypes={setEditUserAllowedTypes}
                canManageRules={editUserCanManageRules}
                setCanManageRules={setEditUserCanManageRules}
                submitting={submitting}
                onClose={() => setEditingProfile(null)}
                onSave={handleUpdateUser}
                editorRole={profile?.role === 'supervisor' ? 'supervisor' : 'admin'}
                supervisors={profiles.filter(p => p.role === 'supervisor')}
                needsSupervisorApproval={editNeedsApproval}
                setNeedsSupervisorApproval={setEditNeedsApproval}
                supervisorIds={editSupervisorIds}
                setSupervisorIds={setEditSupervisorIds}
                eligibleGovtHoliday={editEligibleGovtHoliday}
                setEligibleGovtHoliday={setEditEligibleGovtHoliday}
                eligibleOfficeLeave={editEligibleOfficeLeave}
                setEligibleOfficeLeave={setEditEligibleOfficeLeave}
                allowOvertime={editAllowOvertime}
                setAllowOvertime={setEditAllowOvertime}
                allowReserve={editAllowReserve}
                setAllowReserve={setEditAllowReserve}
              />
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
