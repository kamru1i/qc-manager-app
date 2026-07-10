'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { User, AlertTriangle, RefreshCw, Lock, Settings, Bell, Key, Layout } from 'lucide-react';
import { Profile } from '@/types';
import { subscribeUserToPush, unsubscribeUserFromPush, sendPushNotification } from '@/utils/webPushHelper';
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
  onBack,
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

  // Push notifications state
  const [isPushSubscribed, setIsPushSubscribed] = useState(false);
  const [isPushLoading, setIsPushLoading] = useState(false);
  const [testingPush, setTestingPush] = useState(false);

  // Hidden tabs (for admin menu visibility)
  const [hiddenTabs, setHiddenTabs] = useState<string[]>([]);

  // Setup submissions state
  const [submitting, setSubmitting] = useState(false);
  const [isCodenameEditable, setIsCodenameEditable] = useState(false);

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

      if (typeof window !== 'undefined' && sessionUser) {
        const isSubbed = localStorage.getItem('push_subscribed_pref_' + sessionUser.id) === 'true';
        setIsPushSubscribed(isSubbed);
      }
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

    const isHiddenTabsChanged = profile.role === 'admin' && (
      JSON.stringify([...hiddenTabs].sort()) !== JSON.stringify([...(profile.global_settings?.hidden_tabs || [])].sort())
    );

    if (profile.role === 'admin') {
      return isUsernameChanged || isFullNameChanged || isWorkingHoursChanged || isBreakTimeChanged || 
             isJobRoleChanged || isSignInChanged || isSignOutChanged || isHiddenTabsChanged;
    } else {
      return isFullNameChanged || isWorkingHoursChanged || isBreakTimeChanged || 
             isJobRoleChanged || isSignInChanged || isSignOutChanged;
    }
  }, [profile, editUsername, editFullName, editWorkingHours, editBreakTime, editJobRole, profileSignInTime, profileSignOutTime, hiddenTabs]);

  const handleTestPushNotification = async () => {
    if (!sessionUser) return;
    setTestingPush(true);
    try {
      const isTauri = typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__ !== undefined;
      if (isTauri) {
        const { isPermissionGranted, requestPermission, sendNotification } = await import('@tauri-apps/plugin-notification');
        let permissionGranted = await isPermissionGranted();
        if (!permissionGranted) {
          const permission = await requestPermission();
          permissionGranted = permission === 'granted';
        }
        if (permissionGranted) {
          sendNotification({
            title: 'Notification Test 🧪',
            body: 'Desktop notifications are working perfectly on this device!'
          });
          toast.success('Test notification triggered locally!');
        } else {
          toast.error('OS Notification permission denied. Please allow in System Settings.');
        }
        return;
      }

      const success = await sendPushNotification({
        userIds: [sessionUser.id],
        title: 'Notification Test 🧪',
        body: 'Push notifications are working perfectly on this device!',
        url: '/'
      });
      if (success) {
        toast.success('Test notification sent successfully!');
      } else {
        toast.error('Failed to send test notification. Check if subscription is registered.');
      }
    } catch (err) {
      toast.error('Error sending test notification: ' + (err as Error).message);
    } finally {
      setTestingPush(false);
    }
  };

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
        if (!profile.has_edited_profile) {
          const updates = {
            full_name: editFullName,
            working_hours: parseFloat(editWorkingHours) || 9.5,
            break_time: parseInt(editBreakTime) || 0,
            job_role: editJobRole,
            default_sign_in: profileSignInTime,
            default_sign_out: profileSignOutTime,
            has_edited_profile: true
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
          // Submit request for approval
          const updates = {
            requested_full_name: editFullName,
            requested_working_hours: parseFloat(editWorkingHours) || 9.5,
            requested_break_time: parseInt(editBreakTime) || 0,
            requested_job_role: editJobRole,
            requested_default_sign_in: profileSignInTime,
            requested_default_sign_out: profileSignOutTime,
            profile_change_status: 'pending'
          };

          const { data: updatedProfile, error } = await supabase
            .from('profiles')
            .update(updates)
            .eq('id', sessionUser.id)
            .select()
            .single();

          if (error) throw error;

          // Log request in audit logs
          try {
            await supabase.from('audit_logs').insert({
              actor_id: sessionUser.id,
              actor_codename: profile.username || 'SYSTEM',
              action_type: 'SUBMIT_PROFILE_REQUEST',
              target_id: sessionUser.id,
              details: `User submitted a profile change request. Requested Name: "${editFullName}", Job Role: "${editJobRole}", Working Hours: ${editWorkingHours}, Break: ${editBreakTime}m, Sign In: ${profileSignInTime}, Sign Out: ${profileSignOutTime}`
            });
          } catch (logErr) {
            console.error('Failed to log SUBMIT_PROFILE_REQUEST:', logErr);
          }

          sendPushNotification({
            userIds: ['admins'],
            title: 'Profile Change Request 👤',
            body: `${profile.full_name || profile.username || 'Staff'} has requested a profile information change.`,
            url: '/'
          }).catch(err => console.error('Error triggering push notification:', err));

          setProfile({ ...profile, ...updatedProfile });
          localStorage.setItem(`cached_profile_${sessionUser.id}`, JSON.stringify({ ...profile, ...updatedProfile }));
          window.dispatchEvent(new CustomEvent("profile-updated", { detail: { ...profile, ...updatedProfile } }));
          toast.success('Profile change request has been sent to the admin.');
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
      <div className="flex justify-between items-center pb-4 border-b border-slate-800/80">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2.5">
            <Settings className="h-5.5 w-5.5 text-blue-500" />
            Profile Settings
          </h2>
          <p className="text-xs text-slate-400 mt-1">Manage your shift hours, default shift times, password settings, and custom preferences.</p>
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
        <div className="lg:col-span-7 bg-slate-900/40 rounded-2xl border border-slate-800/60 p-6 space-y-5">
          <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-slate-800/40">
            <User className="h-4 w-4 text-blue-400" />
            Personal & Shift Settings
          </h3>

          <form id="profile-settings-form" onSubmit={handleSaveSettings} className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider">Codename</label>
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
                className={`mt-1 block w-full px-3.5 py-2 bg-slate-955 border rounded-xl text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase font-mono ${
                  isCodenameEditable
                    ? 'border-blue-500/50 text-white cursor-text opacity-100 ring-1 ring-blue-500/30'
                    : 'border-slate-850 text-slate-500 cursor-not-allowed opacity-60'
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
          
          {/* Notifications Panel */}
          <div className="bg-slate-900/40 rounded-2xl border border-slate-800/60 p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-slate-800/40">
              <Bell className="h-4 w-4 text-blue-400" />
              Notifications
            </h3>
            
            {typeof window !== 'undefined' && (
              (('serviceWorker' in navigator && 'PushManager' in window) && !(window as any).__TAURI_INTERNALS__) || 
              (window as any).__TAURI_INTERNALS__
            ) && (
              <div className="push-notification-banner flex flex-col gap-3 p-4 bg-blue-955/30 rounded-xl border border-blue-900/20">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-white">Desktop Notifications</span>
                      {isPushSubscribed && (
                        <button
                          type="button"
                          disabled={testingPush}
                          onClick={handleTestPushNotification}
                          className="px-2 py-0.5 bg-blue-650 hover:bg-blue-550 text-white rounded text-[10px] font-bold cursor-pointer transition-all disabled:opacity-50 flex items-center gap-1"
                        >
                          {testingPush && <RefreshCw className="h-2.5 w-2.5 animate-spin" />}
                          <span>Test</span>
                        </button>
                      )}
                    </div>
                    <span className="block text-[10px] text-slate-400 mt-1">Receive live alerts and dashboard leave notifications.</span>
                  </div>
                  <button
                    type="button"
                    disabled={isPushLoading}
                    onClick={async () => {
                      if (!sessionUser || isPushLoading) return;
                      const willSubscribe = !isPushSubscribed;
                      setIsPushSubscribed(willSubscribe);
                      localStorage.setItem('push_subscribed_pref_' + sessionUser.id, willSubscribe ? 'true' : 'false');

                      const isTauri = typeof window !== 'undefined' && (
                        '__TAURI_INTERNALS__' in window || 
                        (window as any).__TAURI__ !== undefined || 
                        (window as any).Tauri !== undefined ||
                        window.location.protocol === 'tauri:'
                      );
                      if (isTauri) return;

                      setIsPushLoading(true);
                      try {
                        if (!willSubscribe) {
                          await unsubscribeUserFromPush(sessionUser.id);
                        } else {
                          await subscribeUserToPush(sessionUser.id);
                        }
                      } catch {
                        setIsPushSubscribed(!willSubscribe);
                        localStorage.setItem('push_subscribed_pref_' + sessionUser.id, (!willSubscribe) ? 'true' : 'false');
                      } finally {
                        setIsPushLoading(false);
                      }
                    }}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      isPushSubscribed ? 'bg-blue-600' : 'bg-slate-850'
                    } ${isPushLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${
                        isPushSubscribed ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Change Password Panel */}
          <div className="bg-slate-900/40 rounded-2xl border border-slate-800/60 p-6 space-y-4">
            <h3 
              onClick={() => setShowPasswordFields(!showPasswordFields)}
              className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center justify-between pb-2 border-b border-slate-800/40 cursor-pointer hover:text-blue-400 transition-colors select-none"
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
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">New Password</label>
                  <input
                    type="password"
                    placeholder="Enter at least 6 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="mt-1 block w-full px-3.5 py-2 bg-slate-955 border border-slate-850 rounded-xl text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Confirm New Password</label>
                  <input
                    type="password"
                    placeholder="Verify new password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    className="mt-1 block w-full px-3.5 py-2 bg-slate-955 border border-slate-850 rounded-xl text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-100"
                  />
                </div>
                <button
                  type="submit"
                  disabled={passwordSubmitting}
                  className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-xl shadow-md text-xs font-bold text-white bg-slate-800 hover:bg-slate-750 hover:text-white cursor-pointer disabled:opacity-50 transition-all items-center gap-2 active:scale-98"
                >
                  {passwordSubmitting && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                  <span>{passwordSubmitting ? 'Updating...' : 'Update Password'}</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* Admin Menu Visibility Configuration */}
      {profile?.role === 'admin' && (
        <div className="bg-slate-900/40 rounded-2xl border border-slate-800/60 p-6 space-y-4 max-w-4xl">
          <div>
            <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-slate-800/40">
              <Layout className="h-4 w-4 text-blue-400" />
              Menu Tab Visibility Settings ⚙️
            </h3>
            <p className="text-[11px] text-slate-400 mt-2">
              Uncheck options to hide them from your sidebar navigation dashboard, and click the <strong>Save Changes</strong> button above to persist.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
            {['Main Workspace Sections', 'Quotes Tracker Subtabs', 'Leave Tracker Subtabs'].map((category) => {
              const options = [
                { key: 'kpi', label: 'KPI & Performance', category: 'Main Workspace Sections' },
                { key: 'todo', label: 'Todos Panel', category: 'Main Workspace Sections' },
                { key: 'analytics', label: 'Analytics (Workspace)', category: 'Main Workspace Sections' },
                { key: 'audit_logs', label: 'Audit Logs (Workspace)', category: 'Main Workspace Sections' },
                { key: 'user_management', label: 'User Management', category: 'Main Workspace Sections' },

                { key: 'copy_helper', label: 'Copy Helper Subtab', category: 'Quotes Tracker Subtabs' },
                { key: 'save_file', label: 'Save File Subtab', category: 'Quotes Tracker Subtabs' },
                { key: 'monthly', label: 'Monthly List Subtab', category: 'Quotes Tracker Subtabs' },
                { key: 'rules', label: 'Quote Rules Subtab', category: 'Quotes Tracker Subtabs' },
                { key: 'login_codes', label: 'Login Codes Subtab', category: 'Quotes Tracker Subtabs' },
                { key: 'ip_checker', label: 'IP Checker Subtab', category: 'Quotes Tracker Subtabs' },
                { key: 'asitis_causality', label: 'Asitis Causality Subtab', category: 'Quotes Tracker Subtabs' },
                { key: 'eui_causality', label: 'EUI Causality Subtab', category: 'Quotes Tracker Subtabs' },

                { key: 'leave_history', label: 'My History Subtab', category: 'Leave Tracker Subtabs' },
                { key: 'govt_responses', label: 'Govt Responses Subtab', category: 'Leave Tracker Subtabs' },
                { key: 'settlement', label: 'Settlement Subtab', category: 'Leave Tracker Subtabs' },
                { key: 'leave_settings', label: 'Leave Settings Subtab', category: 'Leave Tracker Subtabs' },
                { key: 'team_leaves', label: 'Staff Leaves Subtab', category: 'Leave Tracker Subtabs' },
              ].filter((opt) => opt.category === category);

              return (
                <div key={category} className="space-y-2.5">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1 border-l-2 border-blue-500/60 pl-2">
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
                              ? 'border-blue-500/20 bg-blue-955/20 text-slate-200 hover:bg-blue-950/30'
                              : 'border-slate-850/60 bg-slate-900/30 text-slate-500 hover:bg-slate-850/20'
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
                            className="rounded border-slate-700 bg-slate-955 text-blue-600 accent-blue-600 focus:ring-blue-550 focus:ring-offset-slate-900 h-3.5 w-3.5 cursor-pointer"
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
        <div className="flex justify-end pt-4 border-t border-slate-800/60 max-w-4xl">
          <button
            type="submit"
            form="profile-settings-form"
            disabled={submitting || !hasChanges}
            className={`w-full md:w-auto md:px-10 flex justify-center py-3 px-6 border rounded-xl shadow-lg text-xs font-bold transition-all items-center gap-2 ${
              submitting || !hasChanges
                ? 'border-slate-800 bg-slate-800/40 text-slate-500 cursor-not-allowed opacity-50'
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
