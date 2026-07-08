'use client';

import { useCallback } from 'react';
import { supabase } from '@/utils/supabase';
import { Profile } from '@/types';

interface UseAdminActionsOptions {
  profilesList: Profile[];
  setProfilesList: React.Dispatch<React.SetStateAction<Profile[]>>;
  showToast: (type: 'success' | 'error', text: string) => void;
  logActivity: (actionType: string, targetId: string | null, details: string) => Promise<void>;
  setSubmitting: React.Dispatch<React.SetStateAction<boolean>>;
  updateLastActivity: () => void;
}

export const useAdminActions = ({
  profilesList,
  setProfilesList,
  showToast,
  logActivity,
  setSubmitting,
  updateLastActivity,
}: UseAdminActionsOptions) => {

  // Admin: Create a new user account
  const createUser = useCallback(async (
    username: string, 
    role: 'admin' | 'supervisor' | 'user', 
    fullName: string, 
    allowedTypes: string[], 
    canManageRules: boolean,
    hasChutiAccess: boolean,
    hasQuotesAccess: boolean,
    password?: string,
    needsSupervisorApproval?: boolean,
    supervisorIds?: string[] | null,
    eligibleGovtHoliday?: boolean,
    eligibleOfficeLeave?: boolean,
    allowOvertime?: boolean,
    allowReserve?: boolean,
    jobRole?: string,
    workingHours?: number,
    breakTime?: number,
    defaultSignIn?: string,
    defaultSignOut?: string
  ) => {
    if (!navigator.onLine) {
      showToast('error', 'This action requires an active internet connection.');
      return null;
    }
    const activePassword = password || '1234';
    setSubmitting(true);

    try {
      const derivedEmail = `${username.toLowerCase().trim()}@office.local`;
      const { data, error } = await supabase.rpc('create_new_user', {
        p_email: derivedEmail,
        p_password: activePassword,
        p_username: username.toUpperCase().trim(),
        p_role: role,
        p_full_name: fullName,
        p_needs_supervisor_approval: needsSupervisorApproval ?? false,
        p_allow_reserve: allowReserve ?? false,
        p_allow_overtime: allowOvertime ?? false,
        p_supervisor_ids: supervisorIds ?? null,
      });

      if (error) throw error;

      const newUserId = data;

      // Update the newly created user profile with permissions and access flags
      const { data: newProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', username.toUpperCase().trim())
        .single();
      
      if (newProfile) {
        const updatePayload: any = { 
          can_manage_rules: canManageRules,
          has_chuti_access: hasChutiAccess,
          has_quotes_access: hasQuotesAccess,
          needs_supervisor_approval: needsSupervisorApproval,
          supervisor_ids: supervisorIds,
          eligible_govt_holiday: eligibleGovtHoliday,
          eligible_office_leave: eligibleOfficeLeave,
          allow_overtime: allowOvertime,
          allow_reserve: allowReserve
        };

        if (jobRole !== undefined) updatePayload.job_role = jobRole;
        if (workingHours !== undefined) updatePayload.working_hours = workingHours;
        if (breakTime !== undefined) updatePayload.break_time = breakTime;
        if (defaultSignIn !== undefined) updatePayload.default_sign_in = defaultSignIn;
        if (defaultSignOut !== undefined) updatePayload.default_sign_out = defaultSignOut;

        await supabase
          .from('profiles')
          .update(updatePayload)
          .eq('id', newProfile.id);
      }

      // Audit Log
      await logActivity(
        'CREATE_USER',
        null,
        `Created new user account '${username.toUpperCase().trim()}' (${fullName}) with role '${role}'${canManageRules ? ' [Quote Rules Permission Granted]' : ''}`
      );

      // Refresh the profiles list
      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .order('username', { ascending: true });
      if (profiles) setProfilesList(profiles);

      showToast('success', `User created successfully! Password: ${activePassword}`);

      setSubmitting(false);
      return activePassword; // return the password so admin can copy it
    } catch (err: any) {
      const errMsg = err?.message || err?.details || err?.hint || (err instanceof Error ? err.message : JSON.stringify(err));
      console.error('Error creating user:', errMsg, err);
      showToast('error', 'Error creating user: ' + errMsg);
      setSubmitting(false);
      return null;
    }
  }, [showToast, logActivity, setProfilesList, setSubmitting]);

  // Admin: Reset password of another user
  const resetUserPassword = useCallback(async (userId: string, newPassword: string) => {
    if (!navigator.onLine) {
      showToast('error', 'This action requires an active internet connection.');
      return false;
    }
    try {
      const { data, error } = await supabase.rpc('admin_update_user_credentials', {
        p_user_id: userId,
        p_new_password: newPassword
      });

      if (error) throw error;
      const result = Array.isArray(data) ? data[0] : data;

      if (result && result.success === false) {
        showToast('error', result.message || 'Failed to reset password.');
        return false;
      }

      // Audit Log
      const targetProfile = profilesList.find(p => p.id === userId);
      const targetName = targetProfile ? `${targetProfile.username} (${targetProfile.full_name || 'N/A'})` : `ID ${userId}`;
      await logActivity(
        'RESET_PASSWORD',
        userId,
        `Reset password for user: ${targetName}`
      );
      return true;
    } catch (err) {
      console.error('Error resetting password:', err);
      showToast('error', 'Error changing password: ' + (err instanceof Error ? err.message : String(err)));
      return false;
    }
  }, [showToast, logActivity, profilesList]);

  // Admin: Delete user
  const deleteUser = useCallback(async (userId: string) => {
    if (!navigator.onLine) {
      showToast('error', 'This action requires an active internet connection.');
      return false;
    }
    updateLastActivity();
    try {
      const { data, error } = await supabase.rpc('delete_user_by_id', {
        p_user_id: userId
      });

      if (error) throw error;
      const result = Array.isArray(data) ? data[0] : data;

      if (result && result.success === false) {
        showToast('error', result.message || 'Failed to delete user.');
        return false;
      }

      // Audit Log
      const targetProfile = profilesList.find(p => p.id === userId);
      const targetName = targetProfile ? `${targetProfile.username} (${targetProfile.full_name || 'N/A'})` : `ID ${userId}`;
      await logActivity(
        'DELETE_USER',
        userId,
        `Deleted user account: ${targetName}`
      );

      setProfilesList(prev => prev.filter(p => p.id !== userId));
      showToast('success', 'User deleted successfully!');
      return true;
    } catch (err) {
      console.error('Error deleting user:', err);
      showToast('error', 'Error deleting user: ' + (err instanceof Error ? err.message : String(err)));
      return false;
    }
  }, [showToast, logActivity, profilesList, setProfilesList, updateLastActivity]);

  // Admin/Supervisor: Update user profile details
  const adminUpdateUserProfile = useCallback(async (
    userId: string, 
    fullName: string, 
    role: 'admin' | 'user' | 'supervisor', 
    allowedTypes: string[], 
    canManageRules: boolean,
    hasChutiAccess: boolean,
    hasQuotesAccess: boolean,
    editorRole: 'admin' | 'supervisor',
    needsSupervisorApproval?: boolean,
    supervisorIds?: string[] | null,
    eligibleGovtHoliday?: boolean,
    eligibleOfficeLeave?: boolean,
    allowOvertime?: boolean,
    allowReserve?: boolean,
    newUsername?: string,
    jobRole?: string,
    workingHours?: number,
    breakTime?: number,
    defaultSignIn?: string,
    defaultSignOut?: string,
    kpiSkills?: string[],
    kpiDeptIndicators?: string[],
    performsDataEntry?: boolean,
    department?: string
  ) => {
    if (!navigator.onLine) {
      showToast('error', 'This action requires an active internet connection.');
      return false;
    }
    updateLastActivity();
    setSubmitting(true);
    try {
      const targetProfile = profilesList.find(p => p.id === userId);
      const oldUsername = targetProfile?.username || '';
      const cleanUsername = newUsername?.trim().toUpperCase();

      if (editorRole === 'admin' && cleanUsername && targetProfile && cleanUsername !== oldUsername) {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;

        const res = await fetch('/api/admin/update-user-codename', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          body: JSON.stringify({
            userId,
            newUsername: cleanUsername,
            role: role
          })
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Failed to update user codename');
        }

        targetProfile.username = cleanUsername;
      }

      const existingSettings = targetProfile?.global_settings || {};
      const updatedSettings = {
        ...existingSettings,
        kpi_skills: kpiSkills || [],
        kpi_dept_indicators: kpiDeptIndicators || [],
        performs_data_entry: performsDataEntry !== undefined ? performsDataEntry : true,
        department: department || 'Data Entry'
      };

      const updatePayload: any = {
        global_settings: updatedSettings
      };

      if (editorRole === 'admin') {
        updatePayload.full_name = fullName.trim() || null;
        updatePayload.role = role;
        updatePayload.allowed_types = allowedTypes;
        updatePayload.can_manage_rules = canManageRules;
        updatePayload.has_chuti_access = hasChutiAccess;
        updatePayload.has_quotes_access = hasQuotesAccess;
        updatePayload.needs_supervisor_approval = needsSupervisorApproval;
        updatePayload.supervisor_ids = supervisorIds;
        updatePayload.eligible_govt_holiday = eligibleGovtHoliday;
        updatePayload.eligible_office_leave = eligibleOfficeLeave;
        updatePayload.allow_overtime = allowOvertime;
        updatePayload.allow_reserve = allowReserve;
        
        if (jobRole !== undefined) updatePayload.job_role = jobRole;
        if (workingHours !== undefined) updatePayload.working_hours = workingHours;
        if (breakTime !== undefined) updatePayload.break_time = breakTime;
        if (defaultSignIn !== undefined) updatePayload.default_sign_in = defaultSignIn;
        if (defaultSignOut !== undefined) updatePayload.default_sign_out = defaultSignOut;
      } else {
        // Supervisor can update allowed_types, break_time, default_sign_in, default_sign_out
        updatePayload.allowed_types = allowedTypes;
        if (breakTime !== undefined) updatePayload.break_time = breakTime;
        if (defaultSignIn !== undefined) updatePayload.default_sign_in = defaultSignIn;
        if (defaultSignOut !== undefined) updatePayload.default_sign_out = defaultSignOut;
      }

      const { error } = await supabase
        .from('profiles')
        .update(updatePayload)
        .eq('id', userId);

      if (error) throw error;

      // Try to resolve target user info and track specific changes
      const targetName = targetProfile ? `${targetProfile.username}` : `ID ${userId}`;

      const changes: string[] = [];
      if (targetProfile) {
        if (editorRole === 'admin' && oldUsername && cleanUsername && oldUsername !== cleanUsername) {
          changes.push(`Codename: '${oldUsername}' → '${cleanUsername}'`);
        }
        const oldName = (targetProfile.full_name || '').trim();
        const newName = fullName.trim();
        if (oldName !== newName) {
          changes.push(`Name: '${oldName}' → '${newName}'`);
        }

        const oldRole = targetProfile.role;
        const newRole = role;
        if (editorRole === 'admin' && oldRole !== newRole) {
          changes.push(`Role: '${oldRole}' → '${newRole}'`);
        }

        const oldChuti = !!targetProfile.has_chuti_access;
        if (editorRole === 'admin' && oldChuti !== hasChutiAccess) {
          changes.push(`Leave Tracker: ${oldChuti} → ${hasChutiAccess}`);
        }

        const oldQuotes = !!targetProfile.has_quotes_access;
        if (editorRole === 'admin' && oldQuotes !== hasQuotesAccess) {
          changes.push(`Quotes Tracker: ${oldQuotes} → ${hasQuotesAccess}`);
        }

        const oldAllowed = [...(targetProfile.allowed_types || [])].sort();
        const newAllowed = [...allowedTypes].sort();
        const oldAllowedStr = oldAllowed.join(', ');
        const newAllowedStr = newAllowed.join(', ');

        if (oldAllowedStr !== newAllowedStr) {
          const added = allowedTypes.filter(x => !(targetProfile.allowed_types || []).includes(x));
          const removed = (targetProfile.allowed_types || []).filter(x => !allowedTypes.includes(x));

          const permChanges: string[] = [];
          if (added.length > 0) {
            permChanges.push(`Granted: [${added.join(', ')}]`);
          }
          if (removed.length > 0) {
            permChanges.push(`Revoked: [${removed.join(', ')}]`);
          }
          changes.push(`Permissions: ${permChanges.join(' & ')}`);
        }

        const oldCanManage = !!targetProfile.can_manage_rules;
        const newCanManage = canManageRules;
        if (oldCanManage !== newCanManage) {
          changes.push(`Quote Rules Permission: '${oldCanManage}' → '${newCanManage}'`);
        }

        if (jobRole !== undefined && (targetProfile.job_role || '') !== jobRole) {
          changes.push(`Job Role: '${targetProfile.job_role || ''}' → '${jobRole}'`);
        }
        if (workingHours !== undefined && (targetProfile.working_hours ?? 9.5) !== workingHours) {
          changes.push(`Working Hours: '${targetProfile.working_hours ?? 9.5}' → '${workingHours}'`);
        }
        if (breakTime !== undefined && (targetProfile.break_time ?? 0) !== breakTime) {
          changes.push(`Break: '${targetProfile.break_time ?? 0}' → '${breakTime}'`);
        }
        if (defaultSignIn !== undefined && (targetProfile.default_sign_in || '') !== defaultSignIn) {
          changes.push(`Sign-in: '${targetProfile.default_sign_in || ''}' → '${defaultSignIn}'`);
        }
        if (defaultSignOut !== undefined && (targetProfile.default_sign_out || '') !== defaultSignOut) {
          changes.push(`Sign-out: '${targetProfile.default_sign_out || ''}' → '${defaultSignOut}'`);
        }
      } else {
        changes.push(`Name: '${fullName.trim()}', Role: '${role}', Allowed Types: [${allowedTypes.join(', ')}], Quote Rules Permission: ${canManageRules}`);
      }

      const logDetails = changes.length > 0 
        ? `Updated user '${targetName}' properties (${changes.join(' | ')})`
        : `Updated user '${targetName}' (no changes made)`;

      // Audit Log
      await logActivity(
        'UPDATE_USER',
        userId,
        logDetails
      );

      // Refresh profiles list
      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .order('username', { ascending: true });
      if (profiles) setProfilesList(profiles);

      showToast('success', 'User profile updated successfully!');

      setSubmitting(false);
      return true;
    } catch (err) {
      console.error('Error updating user profile:', err);
      showToast('error', 'Error updating profile: ' + (err instanceof Error ? err.message : String(err)));
      setSubmitting(false);
      return false;
    }
  }, [showToast, logActivity, profilesList, setProfilesList, setSubmitting, updateLastActivity]);

  return {
    createUser,
    resetUserPassword,
    deleteUser,
    adminUpdateUserProfile,
  };
};
