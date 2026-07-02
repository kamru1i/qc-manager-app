'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/utils/supabase';
import { Profile } from '@/types';
import { useAdminActions } from '@/hooks/useAdminActions';
import { Navbar } from '@/components/QuotesNavbar';
import { UnifiedSidebar } from '@/components/UnifiedSidebar';
import { AddUserModal } from '@/components/modals/AddUserModal';
import { EditProfileModal } from '@/components/modals/EditProfileModal';
import { ConfirmModal } from '@/components/modals/ConfirmModal';
import toast from 'react-hot-toast';
import { Search, UserPlus, Shield, Edit, Trash2, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

interface UserManagementDashboardProps {
  sessionUser: { id: string } | null;
  profile: Profile | null;
  onLogout: () => void;
  theme: 'dark' | 'light';
  onThemeToggle: () => void;
  isSidebarCollapsed: boolean;
  onSidebarToggle: () => void;
}

const ALL_FILE_TYPES = [
  'Quote', 'Requote', 'Requote Van', 'Requote Bike', 'Review', 'Review Van', 'Review Bike', 'Individual Review', 'Other Site', 'Van', 'Bike', 'Sale'
];

export const UserManagementDashboard: React.FC<UserManagementDashboardProps> = ({
  sessionUser,
  profile,
  onLogout,
  theme,
  onThemeToggle,
  isSidebarCollapsed,
  onSidebarToggle,
}) => {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Add User State
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [newCodename, setNewCodename] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newPassword, setNewPassword] = useState('1234');
  const [newRole, setNewRole] = useState<'admin' | 'supervisor' | 'user'>('user');
  const [hasChutiAccess, setHasChutiAccess] = useState(false);
  const [hasQuotesAccess, setHasQuotesAccess] = useState(false);
  const [allowedTypes, setAllowedTypes] = useState<string[]>(ALL_FILE_TYPES);
  const [canManageRules, setCanManageRules] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);

  // Edit User State
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [editUserFullName, setEditUserFullName] = useState('');
  const [editUserRole, setEditUserRole] = useState<'admin' | 'supervisor' | 'user'>('user');
  const [editHasChutiAccess, setEditHasChutiAccess] = useState(false);
  const [editHasQuotesAccess, setEditHasQuotesAccess] = useState(false);
  const [editUserAllowedTypes, setEditUserAllowedTypes] = useState<string[]>([]);
  const [editUserCanManageRules, setEditUserCanManageRules] = useState(false);

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
    if (newPassword.length < 4) {
      toast.error('Password must be at least 4 characters long.');
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
      newPassword
    );

    if (pw) {
      setGeneratedPassword(pw);
      setNewCodename('');
      setNewFullName('');
      setNewRole('user');
      setNewPassword('1234');
      setAllowedTypes(ALL_FILE_TYPES);
      setCanManageRules(false);
      setHasChutiAccess(false);
      setHasQuotesAccess(false);
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
      profile?.role === 'supervisor' ? 'supervisor' : 'admin'
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
    <div className="min-h-screen bg-slate-955 text-white font-sans selection:bg-purple-650 selection:text-white pb-10">
      {/* Dynamic Grid Background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-35 pointer-events-none" />

      {/* Navbar Component */}
      <Navbar
        profile={profile}
        isOnline={true}
        theme={theme}
        onThemeToggle={onThemeToggle}
        onLogout={onLogout}
      />

      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 pt-8 flex gap-6 relative z-10">
        {/* Unified Sidebar */}
        <UnifiedSidebar
          activeSection="user_management"
          profile={profile}
          isSidebarCollapsed={isSidebarCollapsed}
          onSidebarToggle={onSidebarToggle}
        />

        {/* Central Work Space */}
        <main className="flex-1 min-w-0">
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
                  <Shield className="h-6 w-6 text-purple-500" />
                  User & Permissions Directory
                </h1>
                <p className="text-xs text-slate-455 mt-1">
                  Manage user authentication roles, leave system access, and permitted categories.
                </p>
              </div>

              {isAdmin && (
                <button
                  onClick={() => setIsAddUserModalOpen(true)}
                  className="flex items-center gap-1.5 py-2.5 px-4 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:via-indigo-500 hover:to-blue-500 shadow-md shadow-purple-900/20 hover:scale-[1.02] active:scale-[0.98] transition-all duration-205 cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-slate-950"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  Add User
                </button>
              )}
            </div>

            {/* Directory Filter Bar */}
            <div className="bg-slate-900/40 border border-slate-900 shadow-2xl rounded-2xl p-4 flex flex-col md:flex-row items-center gap-4">
              <div className="relative w-full md:max-w-xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Search className="h-4 w-4" />
                </div>
                <input
                  type="text"
                  placeholder="Search by name or codename..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-10 py-1.5 bg-slate-955 border border-slate-800 rounded-lg text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 text-xs transition-all"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300 transition-colors cursor-pointer text-sm font-semibold"
                  >
                    ✕
                  </button>
                )}
              </div>

              <div className="text-xs text-slate-500 font-medium md:ml-auto">
                Showing {visibleProfiles.length} of {profiles.length} registered profiles
              </div>
            </div>

            {/* Users Directory Directory Grid/Table */}
            <div className="bg-slate-900/40 border border-slate-900 shadow-2xl rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-950 text-slate-400 font-bold border-b border-slate-850">
                      <th className="px-5 py-4">Codename</th>
                      <th className="px-5 py-4">Full Name</th>
                      <th className="px-5 py-4">Role</th>
                      <th className="px-5 py-4 text-center">Leave Tracker</th>
                      <th className="px-5 py-4 text-center">Quotes Tracker</th>
                      <th className="px-5 py-4">Permitted Categories</th>
                      <th className="px-5 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850/60 text-slate-300">
                    {isLoading ? (
                      Array.from({ length: 4 }).map((_, idx) => (
                        <tr key={idx} className="border-b border-slate-850/40 animate-pulse">
                          <td className="px-5 py-4"><div className="h-3 w-12 bg-slate-850 rounded" /></td>
                          <td className="px-5 py-4"><div className="h-3 w-28 bg-slate-850 rounded" /></td>
                          <td className="px-5 py-4"><div className="h-4.5 w-14 bg-slate-850/80 rounded-full" /></td>
                          <td className="px-5 py-4 text-center"><div className="h-5 w-5 mx-auto bg-slate-850 rounded-full" /></td>
                          <td className="px-5 py-4 text-center"><div className="h-5 w-5 mx-auto bg-slate-850 rounded-full" /></td>
                          <td className="px-5 py-4"><div className="h-3 w-40 bg-slate-850 rounded" /></td>
                          <td className="px-5 py-4 text-right"><div className="h-6 w-12 ml-auto bg-slate-850 rounded" /></td>
                        </tr>
                      ))
                    ) : visibleProfiles.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-5 py-12 text-center text-slate-500 font-medium">
                          No user profiles matched your filters.
                        </td>
                      </tr>
                    ) : (
                      visibleProfiles.map((u) => (
                        <tr key={u.id} className="hover:bg-slate-900/30 transition-all duration-150">
                          <td className="px-5 py-4 font-bold text-white tracking-wider">
                            {u.username.toUpperCase()}
                          </td>
                          <td className="px-5 py-4 font-medium text-slate-200">
                            {u.full_name || '-'}
                          </td>
                          <td className="px-5 py-4">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              u.role === 'admin'
                                ? 'bg-red-500/10 border-red-500/20 text-red-400'
                                : u.role === 'supervisor'
                                ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400'
                                : 'bg-slate-500/10 border-slate-700 text-slate-400'
                            }`}>
                              {u.role === 'admin' ? 'Admin' : u.role === 'supervisor' ? 'Supervisor' : 'User'}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-center">
                            <div className="flex justify-center">
                              {u.has_chuti_access ? (
                                <CheckCircle2 className="h-4.5 w-4.5 text-emerald-500" />
                              ) : (
                                <XCircle className="h-4.5 w-4.5 text-slate-700" />
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-4 text-center">
                            <div className="flex justify-center">
                              {u.has_quotes_access ? (
                                <CheckCircle2 className="h-4.5 w-4.5 text-blue-500" />
                              ) : (
                                <XCircle className="h-4.5 w-4.5 text-slate-700" />
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-4 max-w-xs">
                            {u.has_quotes_access ? (
                              <div className="flex flex-wrap gap-1">
                                {(u.allowed_types || []).map((t) => (
                                  <span key={t} className="bg-slate-955 border border-slate-800 text-slate-400 text-[9px] px-1.5 py-0.5 rounded">
                                    {t}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-slate-500 italic text-[10px]">No Quotes Access</span>
                            )}
                          </td>
                          <td className="px-5 py-4 text-right">
                            <div className="flex justify-end gap-2 items-center">
                              <button
                                onClick={() => {
                                  setEditingProfile(u);
                                  setEditUserFullName(u.full_name || '');
                                  setEditUserRole(u.role);
                                  setEditHasChutiAccess(!!u.has_chuti_access);
                                  setEditHasQuotesAccess(!!u.has_quotes_access);
                                  setEditUserAllowedTypes(u.allowed_types || []);
                                  setEditUserCanManageRules(u.role === 'admin' ? true : !!u.can_manage_rules);
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
        </main>
      </div>

      {/* Add User Modal */}
      {isAddUserModalOpen && (
        <AddUserModal
          newCodename={newCodename}
          setNewCodename={setNewCodename}
          newFullName={newFullName}
          setNewFullName={setNewFullName}
          newPassword={newPassword}
          setNewPassword={setNewPassword}
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
            setHasChutiAccess(false);
            setHasQuotesAccess(false);
          }}
          onCopyPassword={() => {
            if (generatedPassword) {
              navigator.clipboard.writeText(generatedPassword);
              toast.success('Password copied to clipboard!');
            }
          }}
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
    </div>
  );
};
