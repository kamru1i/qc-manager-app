'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { User, AlertTriangle, RefreshCw, Settings, Key, Layout, Shield, FileText } from 'lucide-react';
import { Profile } from '@/types';
import { isSuperadmin, isAdminRole } from '@/utils/permissionService';
import { ProfileFields } from '@/components/leave-tracker/ProfileFields';
import { supabase } from '@/utils/supabase';
import toast from 'react-hot-toast';
import { SanitizerRule, resolveSanitizerRules } from '@/utils/fileNameSanitizer';
import { TempAccessEntry } from '@/utils/dashboardHelpers';
import { MENU_TABS, CONFIGURABLE_ROLES } from '@/utils/menuTabsRegistry';
import { FEATURE_FLAGS } from '@/utils/featureFlagsRegistry';

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

  // Sanitizer rules (superadmin-only filename cleaner config; word + enabled).
  // Seeded from the built-in defaults so the list is never empty.
  const [sanitizerRules, setSanitizerRules] = useState<SanitizerRule[]>([]);
  const [sanitizerInput, setSanitizerInput] = useState('');
  const [sanitizerSubmitting, setSanitizerSubmitting] = useState(false);

  // Per-role tab visibility (superadmin-only Tab Access matrix).
  // Shape: { [role]: { [tabKey]: boolean } } — false = hidden for that role.
  const [roleVisibility, setRoleVisibility] = useState<Record<string, Record<string, boolean>>>({});
  const [activeRoleVisKey, setActiveRoleVisKey] = useState<string | null>(null);

  // Feature flags (superadmin-only). flagKey -> enabled. Absent = ON.
  const [featureFlags, setFeatureFlags] = useState<Record<string, boolean>>({});
  const [activeFlagKey, setActiveFlagKey] = useState<string | null>(null);

  // Temporary access controls (superadmin-only, time-boxed per-role overrides).
  const [tempAccess, setTempAccess] = useState<TempAccessEntry[]>([]);
  const [tempSubmitting, setTempSubmitting] = useState(false);
  const [tempForm, setTempForm] = useState<{ role: string; tabKey: string; action: 'grant' | 'revoke'; expires_at: string }>(
    { role: 'user', tabKey: MENU_TABS[0]?.key || '', action: 'revoke', expires_at: '' }
  );

  // Setup submissions state
  const [submitting, setSubmitting] = useState(false);
  const [isCodenameEditable, setIsCodenameEditable] = useState(false);

  // Subtabs state (Profile / Menu Visibility / superadmin-only Sanitizer & Access Controls)
  const [activeSubTab, setActiveSubTab] = useState<'profile' | 'menu_visibility' | 'sanitizer' | 'access_controls'>('profile');

  // Restore saved subtab on mount/profile load
  useEffect(() => {
    const saved = localStorage.getItem('settings_active_subtab');
    if (saved === 'profile' || saved === 'menu_visibility' || saved === 'sanitizer' || saved === 'access_controls') {
      if ((saved === 'sanitizer' || saved === 'access_controls') && !isSuperadmin(profile)) {
        setActiveSubTab('profile');
      } else {
        setActiveSubTab(saved as any);
      }
    }
  }, [profile]);

  const handleSubTabChange = (tab: 'profile' | 'menu_visibility' | 'sanitizer' | 'access_controls') => {
    setActiveSubTab(tab);
    localStorage.setItem('settings_active_subtab', tab);
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
      case 'ip_checker':
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
      setEditWorkingHours((profile.working_hours ?? 9.5).toString());
      setEditBreakTime((profile.break_time ?? 0).toString());
      setProfileSignInTime(profile.default_sign_in || '');
      setProfileSignOutTime(profile.default_sign_out || '');
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
      setTempAccess(
        Array.isArray(profile.global_settings?.temp_access)
          ? profile.global_settings.temp_access
          : []
      );
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

    if (isAdminRole(profile)) {
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

  const handleSaveSettings = async (e?: React.SyntheticEvent) => {
    if (e) e.preventDefault();
    if (!sessionUser || !profile) return;
    setSubmitting(true);

    try {
      if (activeSubTab === 'menu_visibility') {
        const globalSettingsUpdate = {
          ...(profile.global_settings || {}),
          hidden_tabs: hiddenTabs
        };

        const { data: updatedProfile, error } = await supabase
          .from('profiles')
          .update({ global_settings: globalSettingsUpdate })
          .eq('id', sessionUser.id)
          .select()
          .single();

        if (error) throw error;

        try {
          await supabase.from('audit_logs').insert({
            actor_id: sessionUser.id,
            actor_codename: profile.username || 'SYSTEM',
            action_type: 'UPDATE_PROFILE',
            target_id: sessionUser.id,
            details: `User updated their own menu visibility settings.`
          });
        } catch (logErr) {
          console.error('Failed to log profile update:', logErr);
        }

        setProfile({ ...profile, ...updatedProfile });
        localStorage.setItem(`cached_profile_${sessionUser.id}`, JSON.stringify({ ...profile, ...updatedProfile }));
        window.dispatchEvent(new CustomEvent("profile-updated", { detail: { ...profile, ...updatedProfile } }));
        toast.success('Your menu visibility settings successfully updated!');
        return;
      }

      if (isAdminRole(profile)) {
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

  // Toggle per-role tab visibility (superadmin). `visible=false` hides it.
  const handleToggleRoleVisibility = async (
    role: string,
    tabKey: string,
    nextVisible: boolean
  ) => {
    const itemKey = `${role}:${tabKey}`;
    if (!profile || !isSuperadmin(profile) || activeRoleVisKey === itemKey) return;
    // Build next map: omit the key when visible (default), set false when hidden.
    const roleMap = { ...(roleVisibility[role] || {}) };
    if (nextVisible) {
      delete roleMap[tabKey];
    } else {
      roleMap[tabKey] = false;
    }
    const next: Record<string, Record<string, boolean>> = { ...roleVisibility, [role]: roleMap };
    if (Object.keys(roleMap).length === 0) delete next[role];

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

  // Toggle a feature flag (superadmin). Stores explicit false to disable; omits
  // the key to re-enable (default ON), keeping the stored object minimal.
  const handleToggleFeatureFlag = async (flagKey: string, nextEnabled: boolean) => {
    if (!profile || !isSuperadmin(profile) || activeFlagKey === flagKey) return;
    const next = { ...featureFlags };
    if (nextEnabled) {
      delete next[flagKey];
    } else {
      next[flagKey] = false;
    }
    setActiveFlagKey(flagKey);
    try {
      const { error } = await supabase.rpc('set_feature_flags', { p_flags: next });
      if (error) throw error;
      setFeatureFlags(next);
      const updatedProfile = {
        ...profile,
        global_settings: { ...(profile.global_settings || {}), feature_flags: next },
      };
      setProfile(updatedProfile);
      localStorage.setItem(`cached_profile_${sessionUser.id}`, JSON.stringify(updatedProfile));
      window.dispatchEvent(new CustomEvent('profile-updated', { detail: updatedProfile }));
    } catch (err: any) {
      toast.error(err.message || 'Failed to update feature flag.');
    } finally {
      setActiveFlagKey(null);
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
    if (!tempForm.expires_at) {
      toast.error('Pick an expiry date/time.');
      return;
    }
    if (new Date(tempForm.expires_at).getTime() <= Date.now()) {
      toast.error('Expiry must be in the future.');
      return;
    }
    // Drop any existing override for the same role+tab, plus expired entries.
    const now = Date.now();
    const kept = tempAccess.filter(
      (t) =>
        !(t.role === tempForm.role && t.tabKey === tempForm.tabKey) &&
        new Date(t.expires_at).getTime() > now
    );
    handleSaveTempAccess([
      ...kept,
      {
        role: tempForm.role,
        tabKey: tempForm.tabKey,
        action: tempForm.action,
        expires_at: new Date(tempForm.expires_at).toISOString(),
      },
    ]);
  };

  const handleRemoveTempAccess = (entry: TempAccessEntry) => {
    handleSaveTempAccess(
      tempAccess.filter(
        (t) =>
          !(t.role === entry.role && t.tabKey === entry.tabKey && t.expires_at === entry.expires_at)
      )
    );
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
            Settings
          </h2>
          <p className="text-xs text-theme-text-muted mt-1">Manage your shift hours, default shift times, password settings, and custom preferences.</p>
        </div>
      </div>

      {/* Subtab Navigation */}
      <div className="flex items-center gap-2 border-b border-theme-border-input/60 pb-3">
        <button
          type="button"
          onClick={() => handleSubTabChange('profile')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'profile'
              ? 'bg-blue-600/15 border border-blue-500/30 text-blue-400 shadow-sm'
              : 'text-theme-text-secondary hover:bg-theme-card-bg/60 border border-transparent'
          }`}
        >
          <User className="h-4 w-4" />
          <span>Profile & Shift</span>
        </button>

        <button
          type="button"
          onClick={() => handleSubTabChange('menu_visibility')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'menu_visibility'
              ? 'bg-blue-600/15 border border-blue-500/30 text-blue-400 shadow-sm'
              : 'text-theme-text-secondary hover:bg-theme-card-bg/60 border border-transparent'
          }`}
        >
          <Layout className="h-4 w-4" />
          <span>Menu Visibility</span>
        </button>

        {isSuperAdmin && (
          <>
            <button
              type="button"
              onClick={() => handleSubTabChange('sanitizer')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeSubTab === 'sanitizer'
                  ? 'bg-blue-600/15 border border-blue-500/30 text-blue-400 shadow-sm'
                  : 'text-theme-text-secondary hover:bg-theme-card-bg/60 border border-transparent'
              }`}
            >
              <FileText className="h-4 w-4" />
              <span>Filename Sanitizer</span>
            </button>

            <button
              type="button"
              onClick={() => handleSubTabChange('access_controls')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeSubTab === 'access_controls'
                  ? 'bg-blue-600/15 border border-blue-500/30 text-blue-400 shadow-sm'
                  : 'text-theme-text-secondary hover:bg-theme-card-bg/60 border border-transparent'
              }`}
            >
              <Shield className="h-4 w-4" />
              <span>Access Controls</span>
            </button>
          </>
        )}
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

      {/* Main Grid Layout (Profile & Shift) */}
      {activeSubTab === 'profile' && (
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
                  {isAdminRole(profile) && (
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
      )}

      {/* Menu Visibility Configuration */}
      {activeSubTab === 'menu_visibility' && profile && (
        <div className="bg-theme-card-bg/40 rounded-2xl border border-theme-border-input/60 p-6 space-y-4 max-w-4xl">
          <div>
            <h3 className="text-sm font-bold text-theme-text-secondary uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-theme-border-input/40">
              <Layout className="h-4 w-4 text-blue-400" />
              Menu Tab Visibility Settings ⚙️
            </h3>
            <p className="text-[11px] text-theme-text-muted mt-2">
              Uncheck options to hide them from your sidebar navigation dashboard, and click the <strong>Save Changes</strong> button below to persist.
            </p>
          </div>

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

      {/* File Name Sanitizer (Superadmin only) */}
      {activeSubTab === 'sanitizer' && isSuperAdmin && (
        <div className="space-y-6 max-w-4xl">
          <div className="bg-theme-card-bg/40 rounded-2xl border border-theme-border-input/60 p-6 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-theme-text-secondary uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-theme-border-input/40">
                <FileText className="h-4 w-4 text-blue-400" />
                File Name Sanitizer
              </h3>
              <p className="text-[11px] text-theme-text-muted mt-2">
                Words stripped from quote file names (branch names, file types,
                comment phrases, etc.). The built-in defaults are pre-loaded below.
                Toggle to disable/re-enable without deleting, or remove entirely.
                Applies to all users. Changes save immediately.
              </p>
            </div>

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

      {/* Access & Feature Controls (Superadmin only) */}
      {activeSubTab === 'access_controls' && isSuperAdmin && (
        <div className="space-y-6 max-w-4xl">
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

            {['Main Workspace Sections', 'Quotes Tracker Subtabs', 'Leave Tracker Subtabs'].map(
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
                            const visible = roleVisibility[role]?.[tab.key] !== false;
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
                                    ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-400 hover:bg-emerald-950/50'
                                    : 'bg-rose-950/30 border-rose-500/30 text-rose-400 hover:bg-rose-950/50'
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

          {/* Feature Flags */}
          <div className="bg-theme-card-bg/40 rounded-2xl border border-theme-border-input/60 p-6 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-theme-text-secondary uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-theme-border-input/40">
                <Settings className="h-4 w-4 text-blue-400" />
                Feature Flags
              </h3>
              <p className="text-[11px] text-theme-text-muted mt-2">
                Turn app features on or off globally. All default ON — disabling
                one hides that functionality for users, supervisors, and admins. Superadmins retain full access. Changes save immediately.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              {FEATURE_FLAGS.map((flag) => {
                const enabled = featureFlags[flag.key] !== false;
                const isPending = activeFlagKey === flag.key;
                return (
                  <div
                    key={flag.key}
                    className="flex items-center justify-between gap-4 p-3 rounded-xl border border-theme-border-input/60 bg-theme-page-bg/40"
                  >
                    <div className="min-w-0">
                      <span className="block text-xs font-semibold text-theme-text-primary">
                        {flag.label}
                      </span>
                      <span className="block text-[10px] text-theme-text-muted mt-0.5">
                        {flag.description}
                      </span>
                    </div>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleToggleFeatureFlag(flag.key, !enabled)}
                      title={enabled ? 'Enabled — click to disable' : 'Disabled — click to enable'}
                      className={`shrink-0 w-16 h-6 rounded-lg border text-[9px] font-bold uppercase tracking-wider cursor-pointer transition-colors ${
                        enabled
                          ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-400 hover:bg-emerald-950/50'
                          : 'bg-rose-950/30 border-rose-500/30 text-rose-400 hover:bg-rose-950/50'
                      } ${isPending ? 'animate-pulse opacity-50 cursor-wait' : ''}`}
                    >
                      {enabled ? 'On' : 'Off'}
                    </button>
                  </div>
                );
              })}
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

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 items-end">
              <div>
                <label className="block text-[9px] font-bold text-theme-text-muted uppercase tracking-wider mb-1">Role</label>
                <select
                  value={tempForm.role}
                  onChange={(e) => setTempForm((f) => ({ ...f, role: e.target.value }))}
                  className="w-full h-9 px-2 bg-theme-page-bg border border-theme-border-input rounded-lg text-xs text-theme-text-primary capitalize focus:outline-none focus:border-blue-500/50"
                >
                  {CONFIGURABLE_ROLES.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[9px] font-bold text-theme-text-muted uppercase tracking-wider mb-1">Tab</label>
                <select
                  value={tempForm.tabKey}
                  onChange={(e) => setTempForm((f) => ({ ...f, tabKey: e.target.value }))}
                  className="w-full h-9 px-2 bg-theme-page-bg border border-theme-border-input rounded-lg text-xs text-theme-text-primary focus:outline-none focus:border-blue-500/50"
                >
                  {MENU_TABS.map((t) => (
                    <option key={t.key} value={t.key}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[9px] font-bold text-theme-text-muted uppercase tracking-wider mb-1">Action</label>
                <select
                  value={tempForm.action}
                  onChange={(e) => setTempForm((f) => ({ ...f, action: e.target.value as 'grant' | 'revoke' }))}
                  className="w-full h-9 px-2 bg-theme-page-bg border border-theme-border-input rounded-lg text-xs text-theme-text-primary capitalize focus:outline-none focus:border-blue-500/50"
                >
                  <option value="revoke">Revoke</option>
                  <option value="grant">Grant</option>
                </select>
              </div>
              <div>
                <label className="block text-[9px] font-bold text-theme-text-muted uppercase tracking-wider mb-1">Until</label>
                <input
                  type="datetime-local"
                  value={tempForm.expires_at}
                  onChange={(e) => setTempForm((f) => ({ ...f, expires_at: e.target.value }))}
                  className="w-full h-9 px-2 bg-theme-page-bg border border-theme-border-input rounded-lg text-xs text-theme-text-primary focus:outline-none focus:border-blue-500/50"
                />
              </div>
              <button
                type="button"
                onClick={handleAddTempAccess}
                disabled={tempSubmitting}
                className="h-9 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold cursor-pointer disabled:opacity-50 transition-all"
              >
                Add
              </button>
            </div>

            {tempAccess.length > 0 ? (
              <div className="flex flex-col gap-2">
                {tempAccess.map((entry, i) => {
                  const expired = new Date(entry.expires_at).getTime() <= Date.now();
                  const tabLabel = MENU_TABS.find((t) => t.key === entry.tabKey)?.label || entry.tabKey;
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
                        <strong className="capitalize">{entry.role}</strong> until{' '}
                        {new Date(entry.expires_at).toLocaleString()}
                        {expired && <span className="ml-2 italic">(expired)</span>}
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

      {/* Bottom Save Changes Bar (Profile & Menu Visibility subtabs) */}
      {activeSubTab !== 'sanitizer' && activeSubTab !== 'access_controls' && profile?.profile_change_status !== 'pending' && (
        <div className="flex justify-end pt-4 border-t border-theme-border-input/60 max-w-4xl">
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
