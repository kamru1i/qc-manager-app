'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/utils/supabase';
import { Profile } from '@/types';


interface useAdminStaffOperationsParams {
  sessionUser: any;
  profile: Profile | null;
  setProfile: React.Dispatch<React.SetStateAction<Profile | null>>;
  fetchRecords: () => Promise<void>;
  profilesList: Profile[];
  setProfilesList: React.Dispatch<React.SetStateAction<Profile[]>>;
  setViewingStaffId: React.Dispatch<React.SetStateAction<string | null>>;
  setMessage: (msg: { type: 'success' | 'error'; text: string } | null) => void;
  router: any;
  setApprovingIds?: React.Dispatch<React.SetStateAction<Set<string>>>;
  setApprovedIds?: React.Dispatch<React.SetStateAction<Set<string>>>;
}

export const useAdminStaffOperations = ({
  sessionUser,
  profile,
  setProfile,
  fetchRecords,
  profilesList,
  setProfilesList,
  setViewingStaffId,
  setMessage,
  router,
  setApprovingIds,
  setApprovedIds,
}: useAdminStaffOperationsParams) => {
  // --- Welcome Onboarding Popup ---
  const [showWelcomePopup, setShowWelcomePopup] = useState(false);
  const [welcomePopupType, setWelcomePopupType] = useState<'onboarding' | 'password_reset'>('onboarding');

  // --- First-time password setup states ---
  const [showFirstTimePasswordModal, setShowFirstTimePasswordModal] = useState(false);
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  const [firstTimePassword, setFirstTimePassword] = useState('');
  const [firstTimeConfirmPassword, setFirstTimeConfirmPassword] = useState('');
  const [firstTimePasswordSubmitting, setFirstTimePasswordSubmitting] = useState(false);
  const [firstTimePasswordError, setFirstTimePasswordError] = useState('');


  // --- Onboarding setup states ---
  const [setupFullName, setSetupFullName] = useState('');
  const [setupUsername, setSetupUsername] = useState('');
  const [setupWorkingHours, setSetupWorkingHours] = useState('');
  const [setupBreakTime, setSetupBreakTime] = useState('');
  const [setupJobRole, setSetupJobRole] = useState('');
  const [setupSignInTime, setSetupSignInTime] = useState('');
  const [setupSignOutTime, setSetupSignOutTime] = useState('');
  const [setupSubmitting, setSetupSubmitting] = useState(false);
  const [setupError, setSetupError] = useState('');

  // --- Add New Staff Account states ---
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);

  const [newStaffPassword, setNewStaffPassword] = useState('');
  const [newStaffConfirmPassword, setNewStaffConfirmPassword] = useState('');
  const [newStaffUsername, setNewStaffUsername] = useState('');
  const [newStaffRole, setNewStaffRole] = useState('user');
  const [newStaffNeedsApproval, setNewStaffNeedsApproval] = useState(false);
  const [newStaffAllowReserve, setNewStaffAllowReserve] = useState(false);
  const [newStaffAllowOvertime, setNewStaffAllowOvertime] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);

  const [newStaffSupervisorIds, setNewStaffSupervisorIds] = useState<string[]>([]);
  const [editSupervisorIds, setEditSupervisorIds] = useState<string[]>([]);

  // New staff details and eligibility states
  const [newStaffEligibleOfficeLeave, setNewStaffEligibleOfficeLeave] = useState(true);
  const [newStaffEligibleGovtHoliday, setNewStaffEligibleGovtHoliday] = useState(true);

  // --- Edit Credentials states ---
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [credTargetUserId, setCredTargetUserId] = useState<string | null>(null);
  const [credNewUsername, setCredNewUsername] = useState('');
  const [credNewPassword, setCredNewPassword] = useState('');
  const [credConfirmPassword, setCredConfirmPassword] = useState('');
  const [updatingCredentials, setUpdatingCredentials] = useState(false);

  // --- Delete User states ---
  const [showDeleteUserModal, setShowDeleteUserModal] = useState(false);
  const [deleteTargetUser, setDeleteTargetUser] = useState<Profile | null>(null);
  const [deletingUser, setDeletingUser] = useState(false);

  // --- Profile settings states ---
  const [showProfileSettingsModal, setShowProfileSettingsModal] = useState(false);
  const [editingStaffProfileId, setEditingStaffProfileId] = useState<string | null>(null);
  const [isCodenameEditable, setIsCodenameEditable] = useState(false);
  const [editUsername, setEditUsername] = useState('');
  const [editFullName, setEditFullName] = useState('');
  const [editJobRole, setEditJobRole] = useState('');
  const [editWorkingHours, setEditWorkingHours] = useState('9.5');
  const [editBreakTime, setEditBreakTime] = useState('0');
  const [profileSignInTime, setProfileSignInTime] = useState('13:00');
  const [profileSignOutTime, setProfileSignOutTime] = useState('22:30');
  const [editNeedsApproval, setEditNeedsApproval] = useState(true);
  const [editAllowReserve, setEditAllowReserve] = useState(false);
  const [editAllowOvertime, setEditAllowOvertime] = useState(false);
  const [isEditRequestMode, setIsEditRequestMode] = useState(false);
  const [profileSubmitting, setProfileSubmitting] = useState(false);
  const [editMaxFullLeaves, setEditMaxFullLeaves] = useState('15');
  const [editEligibleOfficeLeave, setEditEligibleOfficeLeave] = useState(true);
  const [editEligibleGovtHoliday, setEditEligibleGovtHoliday] = useState(true);
  const [hiddenTabs, setHiddenTabs] = useState<string[]>([]);

  const lastInitializedProfileIdRef = useRef<string | null>(null);

  // Synchronize first-time setup modal states during render to prevent 1-frame flashes
  const [prevProfileState, setPrevProfileState] = useState<Profile | null>(null);

  if (profile !== prevProfileState) {
    setPrevProfileState(profile);
    if (profile) {
      if (profile.has_changed_password === false) {
        setShowFirstTimePasswordModal(true);
        setShowOnboardingModal(false);
      } else if (!profile.is_setup_completed) {
        setShowFirstTimePasswordModal(false);
        setShowOnboardingModal(true);
      } else {
        setShowFirstTimePasswordModal(false);
        setShowOnboardingModal(false);
      }
    }
  }

  // Sync state values on profile change
  useEffect(() => {
    if (profile) {
      // Only initialize/sync if the modal is not open, OR if the profile ID itself has changed
      const isNewProfileId = profile.id !== lastInitializedProfileIdRef.current;
      
      if (isNewProfileId) {
        lastInitializedProfileIdRef.current = profile.id;
      }

      if (!showOnboardingModal || isNewProfileId) {
        setSetupUsername((profile.username || '').toUpperCase());
        setSetupFullName(profile.full_name || '');
        setSetupWorkingHours(Number(profile.working_hours || 9.5).toFixed(1));
        setSetupBreakTime(String(profile.break_time || 0));
        setSetupJobRole(profile.job_role || '');
        setSetupSignInTime(profile.default_sign_in || '13:00');
        setSetupSignOutTime(profile.default_sign_out || '22:30');
      }

      if (!showProfileSettingsModal || isNewProfileId) {
        setEditFullName(profile.requested_full_name || profile.full_name || '');
        setEditWorkingHours(Number(profile.requested_working_hours || profile.working_hours || 9.5).toFixed(1));
        setEditBreakTime(String(profile.requested_break_time || profile.break_time || 0));
        setEditJobRole(profile.requested_job_role || profile.job_role || '');
        setProfileSignInTime(profile.requested_default_sign_in || profile.default_sign_in || '13:00');
        setProfileSignOutTime(profile.requested_default_sign_out || profile.default_sign_out || '22:30');
        setEditMaxFullLeaves(String(profile.max_full_leaves ?? 15));
        setEditEligibleOfficeLeave(profile.eligible_office_leave !== false);
        setEditEligibleGovtHoliday(profile.eligible_govt_holiday !== false);
        setEditUsername((profile.username || '').toUpperCase());
        setEditNeedsApproval(profile.needs_supervisor_approval !== false);
        setEditAllowReserve(profile.allow_reserve === true);
        setEditAllowOvertime(profile.allow_overtime === true);
        setHiddenTabs(profile.global_settings?.hidden_tabs || []);
      }
    }
  }, [profile, showOnboardingModal, showProfileSettingsModal]);

  // 10-minute auto-logout timer for first-time password change setup
  useEffect(() => {
    if (!showFirstTimePasswordModal || !sessionUser) return;

    const key = `first_time_modal_start_time_${sessionUser.id}`;
    let startTimeStr = localStorage.getItem(key);
    if (!startTimeStr) {
      startTimeStr = Date.now().toString();
      localStorage.setItem(key, startTimeStr);
    }
    const startTime = parseInt(startTimeStr, 10);
    const TEN_MINUTES_MS = 10 * 60 * 1050; // slightly padded 10m

    let timer: NodeJS.Timeout;
    let interval: NodeJS.Timeout;

    const checkAndLogout = async () => {
      const elapsed = Date.now() - startTime;
      if (elapsed >= TEN_MINUTES_MS) {
        try {
          localStorage.removeItem(`session_start_time_${sessionUser.id}`);
          localStorage.removeItem(`last_access_time_${sessionUser.id}`);
          localStorage.removeItem(key);
          await supabase.auth.signOut();
          router.push('/login');
        } catch (e) {
          console.error('Error during auto-logout:', e);
        }
        return true;
      }
      return false;
    };

    checkAndLogout().then((loggedOut) => {
      if (loggedOut) return;

      const remainingDelay = Math.max(0, TEN_MINUTES_MS - (Date.now() - startTime));
      timer = setTimeout(async () => {
        await checkAndLogout();
      }, remainingDelay);

      interval = setInterval(async () => {
        await checkAndLogout();
      }, 5000);
    });

    return () => {
      if (timer) clearTimeout(timer);
      if (interval) clearInterval(interval);
    };
  }, [showFirstTimePasswordModal, sessionUser, router]);

  // Submit Profile settings changes
  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionUser || !profile) return;

    const targetProfile = editingStaffProfileId
      ? profilesList.find(p => p.id === editingStaffProfileId)
      : profile;

    if (!targetProfile) return;

    // Check if any field changed
    const isUsernameChanged = editUsername.toUpperCase().trim() !== (targetProfile.username || '').toUpperCase().trim();
    const isFullNameChanged = editFullName.trim() !== (targetProfile.full_name || '').trim();
    const isWorkingHoursChanged = (parseFloat(editWorkingHours) || 9.5) !== (targetProfile.working_hours ?? 9.5);
    const isBreakTimeChanged = (parseInt(editBreakTime) || 0) !== (targetProfile.break_time ?? 0);
    const isJobRoleChanged = editJobRole.trim() !== (targetProfile.job_role || '').trim();
    const isSignInChanged = (profileSignInTime || '') !== (targetProfile.default_sign_in || '');
    const isSignOutChanged = (profileSignOutTime || '') !== (targetProfile.default_sign_out || '');
    
    const isNeedsApprovalChanged = editNeedsApproval !== !!targetProfile.needs_supervisor_approval;
    const isAllowReserveChanged = editAllowReserve !== !!targetProfile.allow_reserve;
    const isAllowOvertimeChanged = editAllowOvertime !== !!targetProfile.allow_overtime;
    const isMaxLeavesChanged = (parseInt(editMaxFullLeaves) || 15) !== (targetProfile.max_full_leaves ?? 15);
    const isEligibleOfficeChanged = editEligibleOfficeLeave !== !!targetProfile.eligible_office_leave;
    const isEligibleGovtChanged = editEligibleGovtHoliday !== !!targetProfile.eligible_govt_holiday;
    
    const isHiddenTabsChanged = !editingStaffProfileId && (
      JSON.stringify([...hiddenTabs].sort()) !== JSON.stringify([...(targetProfile.global_settings?.hidden_tabs || [])].sort())
    );

    let isSupervisorsChanged = false;
    if (editingStaffProfileId) {
      const oldSups = [...(targetProfile.supervisor_ids || [])].sort();
      const newSups = [...editSupervisorIds].sort();
      isSupervisorsChanged = oldSups.join(',') !== newSups.join(',');
    }

    let hasChanges = false;
    if (editingStaffProfileId) {
      hasChanges = isUsernameChanged || isFullNameChanged || isWorkingHoursChanged || isBreakTimeChanged || 
                   isJobRoleChanged || isSignInChanged || isSignOutChanged || isNeedsApprovalChanged || 
                   isAllowReserveChanged || isAllowOvertimeChanged || isMaxLeavesChanged || 
                   isEligibleOfficeChanged || isEligibleGovtChanged || (editNeedsApproval && isSupervisorsChanged);
    } else if (profile.role === 'admin') {
      hasChanges = isUsernameChanged || isFullNameChanged || isWorkingHoursChanged || isBreakTimeChanged || 
                   isJobRoleChanged || isSignInChanged || isSignOutChanged || isNeedsApprovalChanged || 
                   isAllowReserveChanged || isAllowOvertimeChanged || isMaxLeavesChanged || 
                   isEligibleOfficeChanged || isEligibleGovtChanged || isHiddenTabsChanged;
    } else {
      hasChanges = isFullNameChanged || isWorkingHoursChanged || isBreakTimeChanged || 
                   isJobRoleChanged || isSignInChanged || isSignOutChanged;
    }

    if (!hasChanges) {
      setMessage({ type: 'error', text: 'No changes detected. Profile was not updated.' });
      return;
    }

    setProfileSubmitting(true);
    setMessage(null);

    try {
      if (editingStaffProfileId) {
        const updates = {
          username: editUsername.toUpperCase().trim(),
          full_name: editFullName,
          working_hours: parseFloat(editWorkingHours) || 9.5,
          break_time: parseInt(editBreakTime) || 0,
          job_role: editJobRole,
          default_sign_in: profileSignInTime,
          default_sign_out: profileSignOutTime,
          needs_supervisor_approval: editNeedsApproval,
          allow_reserve: editAllowReserve,
          allow_overtime: editAllowOvertime,
          max_full_leaves: parseInt(editMaxFullLeaves) || 15,
          max_short_leaves: 0,
          eligible_office_leave: editEligibleOfficeLeave,
          eligible_govt_holiday: editEligibleGovtHoliday,
          supervisor_ids: editNeedsApproval ? editSupervisorIds : null,
        };

        const { error } = await supabase
          .from('profiles')
          .update(updates)
          .eq('id', editingStaffProfileId);

        if (error) throw error;

        setMessage({ type: 'success', text: 'Staff profile successfully updated!' });
        setShowProfileSettingsModal(false);
        setEditingStaffProfileId(null);
        fetchRecords();
      } else if (profile.role === 'admin') {
        const updates = {
          username: editUsername.toUpperCase().trim(),
          full_name: editFullName,
          working_hours: parseFloat(editWorkingHours) || 9.5,
          break_time: parseInt(editBreakTime) || 0,
          job_role: editJobRole,
          default_sign_in: profileSignInTime,
          default_sign_out: profileSignOutTime,
          needs_supervisor_approval: editNeedsApproval,
          allow_reserve: editAllowReserve,
          allow_overtime: editAllowOvertime,
          max_full_leaves: parseInt(editMaxFullLeaves) || 15,
          max_short_leaves: 0,
          eligible_office_leave: editEligibleOfficeLeave,
          eligible_govt_holiday: editEligibleGovtHoliday,
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

        setProfile(prev => prev ? { ...prev, ...updatedProfile } : (updatedProfile as Profile));
        localStorage.setItem(`cached_profile_${sessionUser.id}`, JSON.stringify({ ...profile, ...updatedProfile }));
        window.dispatchEvent(new CustomEvent("profile-updated", { detail: { ...profile, ...updatedProfile } }));
        setMessage({ type: 'success', text: 'Your profile successfully updated!' });
        setShowProfileSettingsModal(false);
      } else {

        if (!profile?.has_edited_profile) {
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

          // Log profile update in audit logs
          try {
            await supabase.from('audit_logs').insert({
              actor_id: sessionUser.id,
              actor_codename: profile?.username || 'SYSTEM',
              action_type: 'UPDATE_PROFILE',
              target_id: sessionUser.id,
              details: `User updated their own profile properties. Name: "${editFullName}", Job Role: "${editJobRole}", Working Hours: ${editWorkingHours}, Break: ${editBreakTime}m, Sign In: ${profileSignInTime}, Sign Out: ${profileSignOutTime}`
            });
          } catch (logErr) {
            console.error('Failed to log UPDATE_PROFILE:', logErr);
          }

          setProfile(prev => prev ? { ...prev, ...updatedProfile } : (updatedProfile as Profile));
          setIsEditRequestMode(false);
          setMessage({ type: 'success', text: 'Your profile successfully updated!' });
          setShowProfileSettingsModal(false);
        } else {
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

          // Log profile request submission in audit logs
          try {
            await supabase.from('audit_logs').insert({
              actor_id: sessionUser.id,
              actor_codename: profile?.username || 'SYSTEM',
              action_type: 'SUBMIT_PROFILE_REQUEST',
              target_id: sessionUser.id,
              details: `User submitted a profile change request. Requested Name: "${editFullName}", Job Role: "${editJobRole}", Working Hours: ${editWorkingHours}, Break: ${editBreakTime}m, Sign In: ${profileSignInTime}, Sign Out: ${profileSignOutTime}`
            });
          } catch (logErr) {
            console.error('Failed to log SUBMIT_PROFILE_REQUEST:', logErr);
          }



          setProfile(prev => prev ? { ...prev, ...updatedProfile } : (updatedProfile as Profile));
          setIsEditRequestMode(false);
          setMessage({ type: 'success', text: 'Profile change request has been sent to the admin.' });
          setShowProfileSettingsModal(false);
        }
      }
    } catch (err) {
      let errorMsg = (err as Error).message || 'Request failed.';
      if ((err as { code?: string }).code === '23505' || errorMsg.toLowerCase().includes('duplicate') || errorMsg.toLowerCase().includes('unique')) {
        errorMsg = 'This codename is already in use! Please use a different codename.';
      }
      setMessage({ type: 'error', text: errorMsg });
    } finally {
      setProfileSubmitting(false);
    }
  };

  // Setup / onboarding profile info submit
  const handleSetupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionUser || !profile) return;
    setSetupSubmitting(true);
    setSetupError('');

    try {
      const updates = {
        full_name: setupFullName,
        working_hours: parseFloat(setupWorkingHours) || 9.5,
        break_time: parseInt(setupBreakTime) || 0,
        job_role: setupJobRole,
        default_sign_in: setupSignInTime,
        default_sign_out: setupSignOutTime,
        is_setup_completed: true,
        has_edited_profile: true,
      };

      const { data: updatedProfile, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', sessionUser.id)
        .select()
        .single();

      if (error) throw error;

      setProfile(prev => prev ? { ...prev, ...updatedProfile } : (updatedProfile as Profile));
      localStorage.setItem(`cached_profile_${sessionUser.id}`, JSON.stringify({ ...profile, ...updatedProfile }));
      window.dispatchEvent(new CustomEvent("profile-updated", { detail: { ...profile, ...updatedProfile } }));
      setEditFullName(updatedProfile.full_name || '');
      setEditWorkingHours(Number(updatedProfile.working_hours || 9.5).toFixed(1));
      setEditBreakTime(String(updatedProfile.break_time || 0));
      setEditJobRole(updatedProfile.job_role || '');

      setShowOnboardingModal(false);
      setWelcomePopupType('onboarding');
      setShowWelcomePopup(true);
      setTimeout(() => {
        setShowWelcomePopup(false);
      }, 10000);

      setMessage({ type: 'success', text: 'Your profile setup has been successfully completed!' });
    } catch (err) {
      setSetupError((err as Error).message || 'Failed to update setup.');
    } finally {
      setSetupSubmitting(false);
    }
  };

  // First-time setups & password updates submit
  const handleFirstTimeSetupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionUser || !profile) return;
    if (firstTimePassword !== firstTimeConfirmPassword) {
      setFirstTimePasswordError('Passwords do not match!');
      return;
    }
    if (firstTimePassword.length < 6 || firstTimePassword.length > 12) {
      setFirstTimePasswordError('Password must be between 6 and 12 characters long!');
      return;
    }

    setFirstTimePasswordSubmitting(true);
    setFirstTimePasswordError('');

    try {
      const { error: authError } = await supabase.auth.updateUser({
        password: firstTimePassword,
      });
      if (authError) throw authError;

      const isAlreadyCompleted = profile.is_setup_completed || false;
      const updates: Record<string, unknown> = {
        has_changed_password: true,
        is_setup_completed: isAlreadyCompleted,
      };

      const { data: updatedProfile, error: profileError } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', sessionUser.id)
        .select()
        .single();

      if (profileError) throw profileError;

      const mergedProfile = { ...profile, ...updatedProfile } as Profile;
      setProfile(prev => prev ? { ...prev, ...updatedProfile } : (updatedProfile as Profile));
      localStorage.setItem(`cached_profile_${sessionUser.id}`, JSON.stringify(mergedProfile));
      window.dispatchEvent(new CustomEvent("profile-updated", { detail: mergedProfile }));
      setEditFullName(mergedProfile.full_name || '');
      setEditWorkingHours(Number(mergedProfile.working_hours || 9.5).toFixed(1));
      setEditBreakTime(String(mergedProfile.break_time || 0));
      setEditJobRole(mergedProfile.job_role || '');
      setProfileSignInTime(mergedProfile.default_sign_in || '09:30');
      setProfileSignOutTime(mergedProfile.default_sign_out || '19:00');



      setShowFirstTimePasswordModal(false);
      localStorage.removeItem(`first_time_modal_start_time_${sessionUser.id}`);

      if (isAlreadyCompleted) {
        setShowOnboardingModal(false);
        setWelcomePopupType('password_reset');
        setShowWelcomePopup(true);
        setTimeout(() => {
          setShowWelcomePopup(false);
        }, 10000);
      } else {
        setShowOnboardingModal(true);
      }

      setMessage({ type: 'success', text: 'Password change successful!' });
    } catch (err) {
      setFirstTimePasswordError((err as Error).message || 'Failed to update password.');
    } finally {
      setFirstTimePasswordSubmitting(false);
    }
  };

  // Create User Account (Admin feature)
  const handleCreateNewUser = async () => {
    if (!newStaffUsername) {
      setMessage({ type: 'error', text: 'Please fill in the codename!' });
      return;
    }
    setCreatingUser(true);
    try {
      const derivedEmail = `${newStaffUsername.toLowerCase().trim()}@office.local`;
      const { data: newUserId, error } = await supabase.rpc('create_new_user', {
        p_email: derivedEmail,
        p_password: newStaffPassword || '1234',
        p_username: newStaffUsername.toUpperCase(),
        p_role: newStaffRole,
        p_full_name: '', // Blank
        p_needs_supervisor_approval: newStaffNeedsApproval,
        p_allow_reserve: newStaffAllowReserve,
        p_allow_overtime: newStaffAllowOvertime,
        p_supervisor_ids: newStaffNeedsApproval ? newStaffSupervisorIds : null,
      });
      if (error) throw error;

      if (newUserId) {
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            job_role: null,
            working_hours: null,
            break_time: null,
            default_sign_in: null,
            default_sign_out: null,
            eligible_office_leave: newStaffEligibleOfficeLeave,
            eligible_govt_holiday: newStaffEligibleGovtHoliday,
          })
          .eq('id', newUserId);
        if (updateError) {
          console.error('Error setting profile defaults:', updateError);
        }
      }

      setMessage({ type: 'success', text: `New staff "${newStaffUsername.toUpperCase()}" successfully created! Please set their password via credentials.` });
      setShowCreateUserModal(false);
      setNewStaffPassword('');
      setNewStaffConfirmPassword('');
      setNewStaffUsername('');
      setNewStaffRole('user');
      setNewStaffNeedsApproval(false);
      setNewStaffAllowReserve(false);
      setNewStaffAllowOvertime(false);
      setNewStaffEligibleOfficeLeave(true);
      setNewStaffEligibleGovtHoliday(true);
      setNewStaffSupervisorIds([]);

      fetchRecords();
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to create user: ' + (err as Error).message });
    } finally {
      setCreatingUser(false);
    }
  };

  // Reset staff credentials (Admin feature)
  const handleUpdateCredentials = async () => {
    if (!credTargetUserId) return;
    if (!credNewUsername && !credNewPassword) {
      setMessage({ type: 'error', text: 'Please provide at least a codename or password!' });
      return;
    }
    if (credNewPassword && credNewPassword !== credConfirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match!' });
      return;
    }
    if (credNewPassword && (credNewPassword.length < 6 || credNewPassword.length > 12)) {
      setMessage({ type: 'error', text: 'Password must be between 6 and 12 characters long!' });
      return;
    }
    setUpdatingCredentials(true);
    try {
      const { error } = await supabase.rpc('admin_update_user_credentials', {
        p_user_id: credTargetUserId,
        p_new_username: credNewUsername || null,
        p_new_password: credNewPassword || null,
      });
      if (error) throw error;

      setMessage({ type: 'success', text: 'Credentials successfully updated!' });
      setShowCredentialsModal(false);
      setCredTargetUserId(null);
      setCredNewUsername('');
      setCredNewPassword('');
      setCredConfirmPassword('');
      fetchRecords();
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to update credentials: ' + (err as Error).message });
    } finally {
      setUpdatingCredentials(false);
    }
  };

  // Delete User Account (Admin feature)
  const handleDeleteUser = async () => {
    if (!deleteTargetUser) return;
    if (deleteTargetUser.role === 'admin') {
      setMessage({ type: 'error', text: 'Admin profile cannot be deleted!' });
      return;
    }
    setDeletingUser(true);
    try {
      const { error } = await supabase.rpc('delete_user_by_id', {
        p_user_id: deleteTargetUser.id,
      });
      if (error) throw error;

      setMessage({ type: 'success', text: `Staff "${deleteTargetUser.full_name || deleteTargetUser.username}" successfully deleted!` });
      setShowDeleteUserModal(false);
      setDeleteTargetUser(null);
      setViewingStaffId(null);
      fetchRecords();
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to delete user: ' + (err as Error).message });
    } finally {
      setDeletingUser(false);
    }
  };

  // Approve Profile update changes
  const handleApproveProfileChangeRequest = async (profileId: string, approve: boolean) => {
    if (setApprovingIds) {
      setApprovingIds(prev => new Set(prev).add(profileId));
    }
    try {
      let updates: Record<string, unknown> = {};
      if (approve) {
        const targetProfile = profilesList.find(p => p.id === profileId);
        if (!targetProfile) throw new Error('Profile not found.');

        updates = {
          full_name: targetProfile.requested_full_name || targetProfile.full_name,
          working_hours: targetProfile.requested_working_hours || targetProfile.working_hours,
          break_time: targetProfile.requested_break_time || targetProfile.break_time,
          job_role: targetProfile.requested_job_role || targetProfile.job_role,
          default_sign_in: targetProfile.requested_default_sign_in || targetProfile.default_sign_in,
          default_sign_out: targetProfile.requested_default_sign_out || targetProfile.default_sign_out,
          requested_full_name: null,
          requested_working_hours: null,
          requested_break_time: null,
          requested_job_role: null,
          requested_default_sign_in: null,
          requested_default_sign_out: null,
          profile_change_status: 'none'
        };
      } else {
        updates = {
          requested_full_name: null,
          requested_working_hours: null,
          requested_break_time: null,
          requested_job_role: null,
          requested_default_sign_in: null,
          requested_default_sign_out: null,
          profile_change_status: 'none'
        };
      }

      const targetProfile = profilesList.find(p => p.id === profileId);
      const targetName = targetProfile ? `${targetProfile.username}` : `ID ${profileId}`;

      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', profileId);

      if (error) throw error;

      // Log admin approval/rejection in audit logs
      try {
        if (approve && targetProfile) {
          await supabase.from('audit_logs').insert({
            actor_id: sessionUser?.id,
            actor_codename: profile?.username || 'SYSTEM',
            action_type: 'APPROVE_PROFILE_REQUEST',
            target_id: profileId,
            details: `Admin approved profile change request for user '${targetName}'. Changes: Name: "${targetProfile.requested_full_name || targetProfile.full_name}", Job Role: "${targetProfile.requested_job_role || targetProfile.job_role}", Working Hours: ${targetProfile.requested_working_hours || targetProfile.working_hours}, Break: ${targetProfile.requested_break_time || targetProfile.break_time}m, Sign In: ${targetProfile.requested_default_sign_in || targetProfile.default_sign_in}, Sign Out: ${targetProfile.requested_default_sign_out || targetProfile.default_sign_out}`
          });
        } else {
          await supabase.from('audit_logs').insert({
            actor_id: sessionUser?.id,
            actor_codename: profile?.username || 'SYSTEM',
            action_type: 'REJECT_PROFILE_REQUEST',
            target_id: profileId,
            details: `Admin rejected profile change request for user '${targetName}'.`
          });
        }
      } catch (logErr) {
        console.error('Failed to log profile change request response:', logErr);
      }



      const updateLocalState = () => {
        setProfilesList(prev => prev.map(p => {
          if (p.id === profileId) {
            return {
              ...p,
              ...(approve ? {
                full_name: p.requested_full_name || p.full_name,
                working_hours: p.requested_working_hours || p.working_hours,
                break_time: p.requested_break_time || p.break_time,
                job_role: p.requested_job_role || p.job_role,
                default_sign_in: p.requested_default_sign_in || p.default_sign_in,
                default_sign_out: p.requested_default_sign_out || p.default_sign_out,
              } : {}),
              requested_full_name: null,
              requested_working_hours: null,
              requested_break_time: null,
              requested_job_role: null,
              requested_default_sign_in: null,
              requested_default_sign_out: null,
              profile_change_status: 'none'
            };
          }
          return p;
        }));

        if (sessionUser && sessionUser.id === profileId) {
          setProfile((prev) => {
            if (!prev) return null;
            return {
              ...prev,
              ...(approve ? {
                full_name: prev.requested_full_name || prev.full_name,
                working_hours: prev.requested_working_hours || prev.working_hours,
                break_time: prev.requested_break_time || prev.break_time,
                job_role: prev.requested_job_role || prev.job_role,
                default_sign_in: prev.requested_default_sign_in || prev.default_sign_in,
                default_sign_out: prev.requested_default_sign_out || prev.default_sign_out,
              } : {}),
              requested_full_name: null,
              requested_working_hours: null,
              requested_break_time: null,
              requested_job_role: null,
              requested_default_sign_in: null,
              requested_default_sign_out: null,
              profile_change_status: 'none'
            };
          });
        }
        fetchRecords();
      };

      if (setApprovingIds) {
        setApprovingIds(prev => { const s = new Set(prev); s.delete(profileId); return s; });
      }

      if (approve) {
        if (setApprovedIds) {
          setApprovedIds(prev => new Set(prev).add(profileId));
          setTimeout(() => {
            setApprovedIds(prev => { const s = new Set(prev); s.delete(profileId); return s; });
            updateLocalState();
          }, 1500);
        } else {
          updateLocalState();
        }
      } else {
        updateLocalState();
      }

      setMessage({ type: 'success', text: approve ? 'Profile change request approved.' : 'Request rejected.' });
    } catch (err) {
      if (setApprovingIds) {
        setApprovingIds(prev => { const s = new Set(prev); s.delete(profileId); return s; });
      }
      setMessage({ type: 'error', text: 'Failed to complete action: ' + (err as Error).message });
    }
  };

  // Approve Password Reset Request
  const handleApprovePasswordResetRequest = async (profileId: string, approve: boolean) => {
    if (setApprovingIds) {
      setApprovingIds(prev => new Set(prev).add(profileId));
    }
    try {
      if (approve) {
        // Reset password to 1234 in auth
        const { error: rpcError } = await supabase.rpc('admin_update_user_credentials', {
          p_user_id: profileId,
          p_new_password: '1234'
        });
        if (rpcError) throw rpcError;

        // Reset fields in profiles
        const targetProfile = profilesList.find(p => p.id === profileId);
        const currentSettings = targetProfile?.global_settings || {};
        const updatedSettings = {
          ...currentSettings,
          password_reset_status: 'none'
        };

        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            has_changed_password: false,
            global_settings: updatedSettings
          })
          .eq('id', profileId);
        if (profileError) throw profileError;
      } else {
        // Just reject
        const targetProfile = profilesList.find(p => p.id === profileId);
        const currentSettings = targetProfile?.global_settings || {};
        const updatedSettings = {
          ...currentSettings,
          password_reset_status: 'none'
        };

        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            global_settings: updatedSettings
          })
          .eq('id', profileId);
        if (profileError) throw profileError;
      }



      const updateLocalState = () => {
        setProfilesList(prev => prev.map(p => {
          if (p.id === profileId) {
            return {
              ...p,
              has_changed_password: approve ? false : p.has_changed_password,
              password_reset_status: 'none'
            };
          }
          return p;
        }));

        if (sessionUser && sessionUser.id === profileId) {
          setProfile((prev) => {
            if (!prev) return null;
            return {
              ...prev,
              has_changed_password: approve ? false : prev.has_changed_password,
              password_reset_status: 'none'
            };
          });
        }
      };

      if (setApprovingIds) {
        setApprovingIds(prev => { const s = new Set(prev); s.delete(profileId); return s; });
      }

      if (approve) {
        if (setApprovedIds) {
          setApprovedIds(prev => new Set(prev).add(profileId));
          setTimeout(() => {
            setApprovedIds(prev => { const s = new Set(prev); s.delete(profileId); return s; });
            updateLocalState();
          }, 1500);
        } else {
          updateLocalState();
        }
      } else {
        updateLocalState();
      }

      setMessage({ type: 'success', text: approve ? 'Password reset approved. Temporary password set to 1234.' : 'Password reset request denied.' });
    } catch (err) {
      if (setApprovingIds) {
        setApprovingIds(prev => { const s = new Set(prev); s.delete(profileId); return s; });
      }
      setMessage({ type: 'error', text: 'Failed to complete action: ' + (err as Error).message });
    }
  };

  // Convert Short Leave to Full Leave
  const handleConvertShortLeaveToFullLeave = async (targetUserId: string, workingHours: number, shortMins: number) => {
    if (shortMins <= 0 || workingHours <= 0) return;
    const workingMins = workingHours * 60;
    if (shortMins < workingMins) {
      setMessage({ type: 'error', text: 'Short leave amount is less than Working Hours!' });
      return;
    }

    setProfileSubmitting(true);
    try {
      const staff = profilesList.find(p => p.id === targetUserId) || (profile && profile.id === targetUserId ? profile : null);
      if (!staff) throw new Error('Staff not found');

      const currentDays = staff.converted_short_leaves_days || 0;
      const currentHours = staff.converted_short_leaves_hours || 0;

      const daysToConvert = Math.floor(shortMins / workingMins);
      const hoursToConvert = daysToConvert * workingHours;

      // Ask for adjustment category if they are eligible for govt holiday and have reserve entries
      let adjustCategory = 'Office Leave';
      if (staff.eligible_govt_holiday !== false) {
        const { data: userResps } = await supabase
          .from('govt_holiday_responses')
          .select('id')
          .eq('user_id', targetUserId)
          .eq('response', 'reserve');

        const reserveCount = userResps ? userResps.length : 0;
        if (reserveCount > 0) {
          const choice = prompt(
            `Which category do you want to adjust the converted ${daysToConvert} days of leave from?\n\n` +
            `Enter '1' for: Office Leave\n` +
            `Enter '2' for: Reserved Govt Holiday`,
            "1"
          );
          if (choice === '2') {
            adjustCategory = 'Govt Holiday';
          }
        }
      }

      // Find free dates starting from today and going backward
      const datesToInsert: string[] = [];
      const currentDate = new Date();
      while (datesToInsert.length < daysToConvert) {
        const dateStr = currentDate.toISOString().split('T')[0];
        const { data: existingEntry } = await supabase
          .from('chuti')
          .select('id')
          .eq('user_id', targetUserId)
          .eq('date', dateStr)
          .is('deleted_at', null)
          .maybeSingle();

        if (!existingEntry) {
          datesToInsert.push(dateStr);
        }
        currentDate.setDate(currentDate.getDate() - 1);
      }

      // Insert chuti records for the converted days
      const recordsToInsert = datesToInsert.map(d => ({
        user_id: targetUserId,
        date: d,
        leave_type: 'Full Leave',
        adjustment: true,
        status: 'approved',
        comment: `Adjusted: ${adjustCategory} | Converted from Short Leave`
      }));

      const { error: insertError } = await supabase
        .from('chuti')
        .insert(recordsToInsert);

      if (insertError) throw insertError;

      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          converted_short_leaves_days: currentDays + daysToConvert,
          converted_short_leaves_hours: currentHours + hoursToConvert
        })
        .eq('id', targetUserId);

      if (profileError) throw profileError;

      setMessage({
        type: 'success',
        text: `Successfully converted ${hoursToConvert} hours of short leave to ${daysToConvert} days of full leave, and adjusted with ${adjustCategory === 'Govt Holiday' ? 'Reserved Govt Holiday' : 'Allocated Office Leave'}!`
      });
      fetchRecords();
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to convert: ' + (err as Error).message });
    } finally {
      setProfileSubmitting(false);
    }
  };

  return {
    showWelcomePopup,
    setShowWelcomePopup,
    welcomePopupType,

    showOnboardingModal,
    setShowOnboardingModal,

    showFirstTimePasswordModal,
    setShowFirstTimePasswordModal,
    firstTimePassword,
    setFirstTimePassword,
    firstTimeConfirmPassword,
    setFirstTimeConfirmPassword,
    firstTimePasswordSubmitting,
    firstTimePasswordError,
    setFirstTimePasswordError,


    setupFullName,
    setSetupFullName,
    setupUsername,
    setSetupUsername,
    setupWorkingHours,
    setSetupWorkingHours,
    setupBreakTime,
    setSetupBreakTime,
    setupJobRole,
    setSetupJobRole,
    setupSignInTime,
    setSetupSignInTime,
    setupSignOutTime,
    setSetupSignOutTime,
    setupSubmitting,
    setupError,

    showCreateUserModal,
    setShowCreateUserModal,

    newStaffPassword,
    setNewStaffPassword,
    newStaffConfirmPassword,
    setNewStaffConfirmPassword,
    newStaffUsername,
    setNewStaffUsername,
    newStaffRole,
    setNewStaffRole,
    newStaffNeedsApproval,
    setNewStaffNeedsApproval,
    newStaffAllowReserve,
    setNewStaffAllowReserve,
    newStaffAllowOvertime,
    setNewStaffAllowOvertime,
    creatingUser,
    newStaffEligibleOfficeLeave,
    setNewStaffEligibleOfficeLeave,
    newStaffEligibleGovtHoliday,
    setNewStaffEligibleGovtHoliday,
    newStaffSupervisorIds,
    setNewStaffSupervisorIds,

    showCredentialsModal,
    setShowCredentialsModal,
    credTargetUserId,
    setCredTargetUserId,
    credNewUsername,
    setCredNewUsername,
    credNewPassword,
    setCredNewPassword,
    credConfirmPassword,
    setCredConfirmPassword,
    updatingCredentials,

    showDeleteUserModal,
    setShowDeleteUserModal,
    deleteTargetUser,
    setDeleteTargetUser,
    deletingUser,

    showProfileSettingsModal,
    setShowProfileSettingsModal,
    editingStaffProfileId,
    setEditingStaffProfileId,
    isCodenameEditable,
    setIsCodenameEditable,
    editUsername,
    setEditUsername,
    editFullName,
    setEditFullName,
    editJobRole,
    setEditJobRole,
    editWorkingHours,
    setEditWorkingHours,
    editBreakTime,
    setEditBreakTime,
    profileSignInTime,
    setProfileSignInTime,
    profileSignOutTime,
    setProfileSignOutTime,
    editNeedsApproval,
    setEditNeedsApproval,
    editAllowReserve,
    setEditAllowReserve,
    editAllowOvertime,
    setEditAllowOvertime,
    editEligibleOfficeLeave,
    setEditEligibleOfficeLeave,
    editEligibleGovtHoliday,
    setEditEligibleGovtHoliday,
    editSupervisorIds,
    setEditSupervisorIds,
    isEditRequestMode,
    setIsEditRequestMode,
    profileSubmitting,
    editMaxFullLeaves,
    setEditMaxFullLeaves,
    hiddenTabs,
    setHiddenTabs,

    // Handlers
    handleUpdateSettings,
    handleSetupSubmit,
    handleFirstTimeSetupSubmit,
    handleCreateNewUser,
    handleUpdateCredentials,
    handleDeleteUser,
    handleApproveProfileChangeRequest,
    handleApprovePasswordResetRequest,
    handleConvertShortLeaveToFullLeave,
  };
};
