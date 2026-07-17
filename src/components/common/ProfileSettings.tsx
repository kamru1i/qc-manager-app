'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { User, AlertTriangle, RefreshCw, Settings, Key, Layout } from 'lucide-react';
import { Profile } from '@/types';
import { ProfileFields } from '@/components/leave-tracker/ProfileFields';
import { supabase } from '@/utils/supabase';
import toast from 'react-hot-toast';

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
  // Input fields state
  const [editUsername, setEditUsername] = useState('');
  const [editFullName, setEditFullName] = useState('');
  const [editJobRole, setEditJobRole] = useState('');
  const [editWorkingHours, setEditWorkingHours] = useState('9.5');
  const [editBreakTime, setEditBreakTime] = useState('0');
  const [profileSignInTime, setProfileSignInTime] = useState('');
  const [profileSignOutTime, setProfileSignOutTime] = useState('');

  // Password fields state
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  const [showPasswordFields, setShowPasswordFields] = useState(false);



  // Hidden tabs (for admin menu visibility)
  const [hiddenTabs, setHiddenTabs] = useState<string[]>([]);

  // Setup submissions state
  const [submitting, setSubmitting] = useState(false);
  const [isCodenameEditable, setIsCodenameEditable] = useState(false);

  // Unified menu authorization rules (synchronized with UnifiedSidebar.tsx)
  const isSuperAdmin = profile?.codename?.toUpperCase() === 'KAMRUL' || profile?.full_name === 'Kamrul Islam';
  const showTodoTab = profile?.username?.toUpperCase() === 'KAMRUL' || profile?.full_name === 'Kamrul Islam';
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
        return profile.role === 'admin' || profile.role === 'supervisor';
      case 'audit_logs':
        return profile.role === 'admin';

      // Quotes Tracker Subtabs
      case 'copy_helper':
      case 'save_file':
        return hasQuotesAccess && isSuperAdmin;
      case 'monthly':
      case 'rules':
      case 'ip_checker':
      case 'login_codes':
      case 'causality':
        return hasQuotesAccess;

      // Leave Tracker Subtabs
      case 'leave_history':
        return hasChutiAccess;
      case 'team_leaves':
        return hasChutiAccess && (profile.role === 'admin' || profile.role === 'supervisor');
      case 'govt_responses':
      case 'settlement':
      case 'leave_settings':
        return hasChutiAccess && profile.role === 'admin';

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
      setEditWorkingHours((profile.working_hours ?? 9.5).toString());
      setEditBreakTime((profile.break_time ?? 0).toString());
      setProfileSignInTime(profile.default_sign_in || '');
      setProfileSignOutTime(profile.default_sign_out || '');
      setHiddenTabs(profile.global_settings?.hidden_tabs || []);
    }
  }, [profile, sessionUser]);

  // Determine if there are changes
  const hasChanges = useMemo(() => {
    if (!profile) return false;
    const isUsernameChanged = editUsername.toUpperCase().trim() !== (profile.username || '').toUpperCase().trim();
    const isFullNameChanged = editFullName.trim() !== (profile.full_name || '').trim();
    const isWorkingHoursChanged = (parseFloat(editWorkingHours) || 9.5) !== (profile.working_hours ?? 9.5);
    const isBreakTimeChanged = (parseInt(editBreakTime) || 0) !== (profile.break_time ?? 0);
    const isJobRoleChanged = editJobRole.trim() !== (profile.job_role || '').trim();
    const isSignInChanged = (profileSignInTime || '') !== (profile.default_sign_in || '');
    const isSignOutChanged = (profileSignOutTime || '') !== (profile.default_sign_out || '');

    const isHiddenTabsChanged = JSON.stringify([...hiddenTabs].sort()) !== JSON.stringify([...(profile.global_settings?.hidden_tabs || [])].sort());

    if (profile.role === 'admin') {
      return isUsernameChanged || isFullNameChanged || isWorkingHoursChanged || isBreakTimeChanged ||
             isJobRoleChanged || isSignInChanged || isSignOutChanged || isHiddenTabsChanged;
    } else {
      return isFullNameChanged || isWorkingHoursChanged || isBreakTimeChanged ||
             isJobRoleChanged || isSignInChanged || isSignOutChanged || isHiddenTabsChanged;
    }
  }, [profile, editUsername, editFullName, editWorkingHours, editBreakTime, editJobRole, profileSignInTime, profileSignOutTime, hiddenTabs]);



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

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionUser || !profile) return;
    setSubmitting(true);

    try {
      if (profile.role === 'admin') {
        const updates = {
          username: editUsername.toUpperCase().trim(),
          full_name: editFullName,
          working_hours: parseFloat(editWorkingHours) || 9.5,
          break_time: parseInt(editBreakTime) || 0,
          job_role: editJobRole,
          default_sign_in: profileSignInTime,
          default_sign_out: profileSignOutTime,
          global_settings: {
            ...(profile.global_settings || {}),
            hidden_tabs: hiddenTabs
          }
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
        const globalSettingsUpdate = {
          ...(profile.global_settings || {}),
          hidden_tabs: hiddenTabs
        };

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

          // Log in audit logs
          try {
            await supabase.from('audit_logs').insert({
              actor_id: sessionUser.id,
              actor_codename: profile.username || 'SYSTEM',
              action_type: 'UPDATE_PROFILE',
              target_id: sessionUser.id,
              details: `User updated their own profile properties. Name: "${editFullName}", Job Role: "${editJobRole}", Working Hours: ${editWorkingHours}, Break: ${editBreakTime}m, Sign In: ${profileSignInTime}, Sign Out: ${profileSignOutTime}`
            });
          } catch (logErr) {
            console.error('Failed to log UPDATE_PROFILE:', logErr);
          }

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

          // Log request or update in audit logs
          try {
            if (hasProfileFieldChanges) {
              await supabase.from('audit_logs').insert({
                actor_id: sessionUser.id,
                actor_codename: profile.username || 'SYSTEM',
                action_type: 'SUBMIT_PROFILE_REQUEST',
                target_id: sessionUser.id,
                details: `User submitted a profile change request. Requested Name: "${editFullName}", Job Role: "${editJobRole}", Working Hours: ${editWorkingHours}, Break: ${editBreakTime}m, Sign In: ${profileSignInTime}, Sign Out: ${profileSignOutTime}`
              });
            } else {
              await supabase.from('audit_logs').insert({
                actor_id: sessionUser.id,
                actor_codename: profile.username || 'SYSTEM',
                action_type: 'UPDATE_PROFILE',
                target_id: sessionUser.id,
                details: `User updated their own menu visibility settings.`
              });
            }
          } catch (logErr) {
            console.error('Failed to log profile update:', logErr);
          }

          setProfile({ ...profile, ...updatedProfile });
          localStorage.setItem(`cached_profile_${sessionUser.id}`, JSON.stringify({ ...profile, ...updatedProfile }));
          window.dispatchEvent(new CustomEvent("profile-updated", { detail: { ...profile, ...updatedProfile } }));

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

  return (
    <div className="w-full space-y-6 font-sans">
      {/* Decorative background blobs */}
      <div className="absolute top-[-10%] right-[-15%] w-[45%] h-[45%] rounded-full bg-blue-900/5 blur-[90px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-15%] w-[35%] h-[35%] rounded-full bg-purple-900/5 blur-[70px] pointer-events-none" />

      {/* Page Title Header */}
      <div className="flex justify-between items-center pb-4 border-b border-theme-border-input/80">
        <div>
          <h2 className="text-xl font-bold text-theme-text-primary flex items-center gap-2.5">
            <Settings className="h-5.5 w-5.5 text-blue-500" />
            Profile Settings
          </h2>
          <p className="text-xs text-theme-text-muted mt-1">Manage your shift hours, default shift times, password settings, and custom preferences.</p>
        </div>
      </div>

      {profile?.profile_change_status === 'pending' && (
        <div className="p-3 bg-purple-955/50 border border-purple-800/50 text-purple-300 text-xs rounded-xl flex items-start gap-2.5 max-w-3xl animate-pulse">
          <AlertTriangle className="h-4.5 w-4.5 text-purple-400 shrink-0 mt-0.5" />
          <div>
            <strong className="block font-semibold">Change Request Pending</strong>
            <span className="block mt-0.5">Your profile updates are currently pending approval. You will be notified once an administrator reviews it.</span>
          </div>
        </div>
      )}

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Column 1: Settings Form */}
        <div className="lg:col-span-7 bg-theme-card-bg/40 rounded-2xl border border-theme-border-input/60 p-6 space-y-5">
          <h3 className="text-sm font-bold text-theme-text-secondary uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-theme-border-input/40">
            <User className="h-4 w-4 text-blue-400" />
            Personal & Shift Settings
          </h3>

          <form id="profile-settings-form" onSubmit={handleSaveSettings} className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-theme-text-muted uppercase tracking-wider">Codename</label>
                {profile?.role === 'admin' && (
                  <button
                    type="button"
                    onClick={() => setIsCodenameEditable(!isCodenameEditable)}
                    className={`text-[10px] flex items-center gap-1 transition-colors px-2.5 py-1 rounded-md cursor-pointer ${
                      isCodenameEditable
                        ? 'text-purple-400 bg-purple-955/40 hover:bg-purple-955/60 border border-purple-800/30'
                        : 'text-blue-400 hover:text-blue-300 bg-blue-955/20 hover:bg-blue-950/40 border border-blue-900/20'
                    }`}
                  >
                    <span>{isCodenameEditable ? 'Lock' : 'Change Codename'}</span>
                  </button>
                )}
              </div>
              <input
                type="text"
                disabled={!isCodenameEditable}
                value={editUsername}
                onChange={(e) => setEditUsername(e.target.value)}
                className={`mt-1 block w-full px-3.5 py-2 bg-theme-page-bg border rounded-xl text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase font-mono ${
                  isCodenameEditable
                    ? 'border-blue-500/50 text-theme-text-primary cursor-text opacity-100 ring-1 ring-blue-500/30'
                    : 'border-theme-border-muted text-theme-text-muted/60 cursor-not-allowed opacity-60'
                }`}
              />
            </div>

            <ProfileFields
              fullName={editFullName}
              setFullName={setEditFullName}
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
              disabled={profile?.profile_change_status === 'pending'}
            />


          </form>
        </div>

        {/* Column 2: Notifications & Security */}
        <div className="lg:col-span-5 space-y-6">



          {/* Change Password Panel */}
          <div className="bg-theme-card-bg/40 rounded-2xl border border-theme-border-input/60 p-6 space-y-4">
            <h3
              onClick={() => setShowPasswordFields(!showPasswordFields)}
              className="text-sm font-bold text-theme-text-secondary uppercase tracking-wider flex items-center justify-between pb-2 border-b border-theme-border-input/40 cursor-pointer hover:text-blue-400 transition-colors select-none"
            >
              <span className="flex items-center gap-2">
                <Key className="h-4 w-4 text-blue-400" />
                Change Password
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
              <form onSubmit={handleUpdatePassword} className="space-y-3.5 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-theme-text-muted uppercase tracking-wider">New Password</label>
                  <input
                    type="password"
                    placeholder="Enter at least 6 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="mt-1 block w-full px-3.5 py-2 bg-theme-page-bg border border-theme-border-muted rounded-xl text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 text-theme-text-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-theme-text-muted uppercase tracking-wider">Confirm New Password</label>
                  <input
                    type="password"
                    placeholder="Verify new password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    className="mt-1 block w-full px-3.5 py-2 bg-theme-page-bg border border-theme-border-muted rounded-xl text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 text-theme-text-primary"
                  />
                </div>
                <button
                  type="submit"
                  disabled={passwordSubmitting}
                  className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-xl shadow-md text-xs font-bold text-theme-text-primary bg-theme-border-input hover:bg-theme-border-active hover:text-theme-text-inverse cursor-pointer disabled:opacity-50 transition-all items-center gap-2 active:scale-98"
                >
                  {passwordSubmitting && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                  <span>{passwordSubmitting ? 'Updating...' : 'Update Password'}</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* Menu Visibility Configuration */}
      {profile && (
        <div className="bg-theme-card-bg/40 rounded-2xl border border-theme-border-input/60 p-6 space-y-4 max-w-4xl">
          <div>
            <h3 className="text-sm font-bold text-theme-text-secondary uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-theme-border-input/40">
              <Layout className="h-4 w-4 text-blue-400" />
              Menu Tab Visibility Settings ⚙️
            </h3>
            <p className="text-[11px] text-theme-text-muted mt-2">
              Uncheck options to hide them from your sidebar navigation dashboard, and click the <strong>Save Changes</strong> button above to persist.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
            {['Main Workspace Sections', 'Quotes Tracker Subtabs', 'Leave Tracker Subtabs'].map((category) => {
              const options = [
                { key: 'kpi', label: 'KPI & Performance', category: 'Main Workspace Sections' },
                { key: 'todo', label: 'Todos Panel', category: 'Main Workspace Sections' },
                { key: 'leaderboard', label: 'Leaderboard (Workspace)', category: 'Main Workspace Sections' },
                { key: 'audit_logs', label: 'Audit Logs (Workspace)', category: 'Main Workspace Sections' },
                { key: 'user_management', label: 'User Management', category: 'Main Workspace Sections' },

                { key: 'copy_helper', label: 'Copy Helper Subtab', category: 'Quotes Tracker Subtabs' },
                { key: 'save_file', label: 'Save File Subtab', category: 'Quotes Tracker Subtabs' },
                { key: 'monthly', label: 'Monthly List Subtab', category: 'Quotes Tracker Subtabs' },
                { key: 'rules', label: 'Quote Rules Subtab', category: 'Quotes Tracker Subtabs' },
                { key: 'login_codes', label: 'Login Codes Subtab', category: 'Quotes Tracker Subtabs' },
                { key: 'ip_checker', label: 'IP Checker Subtab', category: 'Quotes Tracker Subtabs' },
                { key: 'causality', label: 'Causality Subtab', category: 'Quotes Tracker Subtabs' },

                { key: 'leave_history', label: 'My History Subtab', category: 'Leave Tracker Subtabs' },
                { key: 'govt_responses', label: 'Govt Responses Subtab', category: 'Leave Tracker Subtabs' },
                { key: 'settlement', label: 'Settlement Subtab', category: 'Leave Tracker Subtabs' },
                { key: 'leave_settings', label: 'Leave Settings Subtab', category: 'Leave Tracker Subtabs' },
                { key: 'team_leaves', label: 'Staff Leaves Subtab', category: 'Leave Tracker Subtabs' },
              ].filter((opt) => opt.category === category && isTabAuthorized(opt.key));

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

      {/* Bottom Save Changes Bar */}
      {profile?.profile_change_status !== 'pending' && (
        <div className="flex justify-end pt-4 border-t border-theme-border-input/60 max-w-4xl">
          <button
            type="submit"
            form="profile-settings-form"
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
              : (profile?.role === 'admin' || !profile?.has_edited_profile
                  ? 'Save Changes'
                  : 'Submit Request for Approval')}
          </button>
        </div>
      )}
    </div>
  );
}
