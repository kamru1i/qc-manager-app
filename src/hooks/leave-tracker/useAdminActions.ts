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
    defaultSignOut?: string,
    kpiSkills?: string[],
    kpiDeptIndicators?: string[],
    performsDataEntry?: boolean,
    department?: string,
    performsOtherDeptTasks?: boolean,
    otherDepartment?: string,
    kpiOtherDeptIndicators?: string[]
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
          allow_reserve: allowReserve,
          global_settings: {
            kpi_skills: kpiSkills || [],
            kpi_dept_indicators: kpiDeptIndicators || [],
            kpi_other_dept_indicators: kpiOtherDeptIndicators || [],
            performs_data_entry: performsDataEntry !== undefined ? performsDataEntry : true,
            department: department || 'Data Entry',
            performs_other_dept_tasks: performsOtherDeptTasks !== undefined ? performsOtherDeptTasks : false,
            other_department: otherDepartment || 'IT'
          }
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
    department?: string,
    performsOtherDeptTasks?: boolean,
    otherDepartment?: string,
    kpiOtherDeptIndicators?: string[],
    delegatedLeaveSupervisorId?: string | null,
    delegatedKpiSupervisorId?: string | null
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
        kpi_other_dept_indicators: kpiOtherDeptIndicators || [],
        performs_data_entry: performsDataEntry !== undefined ? performsDataEntry : true,
        department: department || 'Data Entry',
        performs_other_dept_tasks: performsOtherDeptTasks !== undefined ? performsOtherDeptTasks : false,
        other_department: otherDepartment || 'IT'
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
        updatePayload.delegated_leave_supervisor_id = delegatedLeaveSupervisorId;
        updatePayload.delegated_kpi_supervisor_id = delegatedKpiSupervisorId;
        
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
        if (delegatedLeaveSupervisorId !== undefined) updatePayload.delegated_leave_supervisor_id = delegatedLeaveSupervisorId;
        if (delegatedKpiSupervisorId !== undefined) updatePayload.delegated_kpi_supervisor_id = delegatedKpiSupervisorId;
      }

      const { error } = await supabase
        .from('profiles')
        .update(updatePayload)
        .eq('id', userId);

      if (error) throw error;

      // Try to resolve target user info and track specific changes
      const changes: string[] = [];
      const formatBool = (val: boolean) => val ? 'Yes' : 'No';

      if (targetProfile) {
        // 1. Codename
        if (editorRole === 'admin' && oldUsername && cleanUsername && oldUsername.toUpperCase() !== cleanUsername.toUpperCase()) {
          changes.push(`Codename:\n${oldUsername} → ${cleanUsername}`);
        }

        // 2. Full Name
        if (editorRole === 'admin') {
          const oldName = (targetProfile.full_name || '').trim();
          const newName = fullName.trim();
          if (oldName !== newName) {
            changes.push(`Full Name:\n${oldName || 'None'} → ${newName || 'None'}`);
          }
        }

        // 3. Role
        if (editorRole === 'admin') {
          const oldRole = targetProfile.role;
          const newRole = role;
          if (oldRole !== newRole) {
            changes.push(`Role:\n${oldRole} → ${newRole}`);
          }
        }

        // 4. Leave Tracker Access
        if (editorRole === 'admin') {
          const oldChuti = !!targetProfile.has_chuti_access;
          if (oldChuti !== hasChutiAccess) {
            changes.push(`Leave Tracker:\n${formatBool(oldChuti)} → ${formatBool(hasChutiAccess)}`);
          }
        }

        // 5. Quotes Tracker Access
        if (editorRole === 'admin') {
          const oldQuotes = !!targetProfile.has_quotes_access;
          if (oldQuotes !== hasQuotesAccess) {
            changes.push(`Quotes Tracker:\n${formatBool(oldQuotes)} → ${formatBool(hasQuotesAccess)}`);
          }
        }

        // 6. Allowed Types
        const oldAllowed = [...(targetProfile.allowed_types || [])].sort().join(', ');
        const newAllowed = [...allowedTypes].sort().join(', ');
        if (oldAllowed !== newAllowed) {
          changes.push(`Allowed Types:\n${oldAllowed || 'None'} → ${newAllowed || 'None'}`);
        }

        // 7. Quote Rules Permission
        if (editorRole === 'admin') {
          const oldCanManage = !!targetProfile.can_manage_rules;
          const newCanManage = canManageRules;
          if (oldCanManage !== newCanManage) {
            changes.push(`Quote Rules Permission:\n${formatBool(oldCanManage)} → ${formatBool(newCanManage)}`);
          }
        }

        // 8. Needs Supervisor Approval
        if (editorRole === 'admin') {
          const oldNeedsApproval = !!targetProfile.needs_supervisor_approval;
          const newNeedsApproval = !!needsSupervisorApproval;
          if (oldNeedsApproval !== newNeedsApproval) {
            changes.push(`Needs Supervisor Approval:\n${formatBool(oldNeedsApproval)} → ${formatBool(newNeedsApproval)}`);
          }
        }

        // 9. Supervisor IDs
        if (editorRole === 'admin') {
          const getSupervisorNames = (ids: string[] | null | undefined): string => {
            if (!ids || ids.length === 0) return 'None';
            return ids
              .map(id => {
                const p = profilesList.find(prof => prof.id === id);
                return p ? p.username : id;
              })
              .sort()
              .join(', ');
          };
          const oldSups = getSupervisorNames(targetProfile.supervisor_ids);
          const newSups = getSupervisorNames(supervisorIds);
          if (oldSups !== newSups) {
            changes.push(`Supervisors:\n${oldSups} → ${newSups}`);
          }
        }

        // 10. Eligible Govt Holiday
        if (editorRole === 'admin') {
          const oldEligibleGovt = !!targetProfile.eligible_govt_holiday;
          const newEligibleGovt = !!eligibleGovtHoliday;
          if (oldEligibleGovt !== newEligibleGovt) {
            changes.push(`Eligible for Govt Holiday:\n${formatBool(oldEligibleGovt)} → ${formatBool(newEligibleGovt)}`);
          }
        }

        // 11. Eligible Office Leave
        if (editorRole === 'admin') {
          const oldEligibleOffice = !!targetProfile.eligible_office_leave;
          const newEligibleOffice = !!eligibleOfficeLeave;
          if (oldEligibleOffice !== newEligibleOffice) {
            changes.push(`Eligible for Office Leave:\n${formatBool(oldEligibleOffice)} → ${formatBool(newEligibleOffice)}`);
          }
        }

        // 12. Allow Overtime
        if (editorRole === 'admin') {
          const oldAllowOT = !!targetProfile.allow_overtime;
          const newAllowOT = !!allowOvertime;
          if (oldAllowOT !== newAllowOT) {
            changes.push(`Allow Overtime:\n${formatBool(oldAllowOT)} → ${formatBool(newAllowOT)}`);
          }
        }

        // 13. Allow Reserve
        if (editorRole === 'admin') {
          const oldAllowReserve = !!targetProfile.allow_reserve;
          const newAllowReserve = !!allowReserve;
          if (oldAllowReserve !== newAllowReserve) {
            changes.push(`Allow Reserve:\n${formatBool(oldAllowReserve)} → ${formatBool(newAllowReserve)}`);
          }
        }

        // 14. Job Role
        if (editorRole === 'admin' && jobRole !== undefined) {
          const oldJobRole = (targetProfile.job_role || '').trim();
          const newJobRole = jobRole.trim();
          if (oldJobRole !== newJobRole) {
            changes.push(`Job Role:\n${oldJobRole || 'None'} → ${newJobRole || 'None'}`);
          }
        }

        // 15. Working Hours
        if (editorRole === 'admin' && workingHours !== undefined) {
          const oldHours = targetProfile.working_hours ?? 9.5;
          if (oldHours !== workingHours) {
            changes.push(`Working Hours:\n${oldHours} → ${workingHours}`);
          }
        }

        // 16. Break Time
        const oldBreak = targetProfile.break_time ?? 0;
        if (breakTime !== undefined && oldBreak !== breakTime) {
          changes.push(`Break:\n${oldBreak} → ${breakTime}`);
        }

        // 17. Default Sign-in
        const oldSignIn = (targetProfile.default_sign_in || '').trim();
        if (defaultSignIn !== undefined && oldSignIn !== defaultSignIn.trim()) {
          changes.push(`Sign-in:\n${oldSignIn || 'None'} → ${defaultSignIn.trim() || 'None'}`);
        }

        // 18. Default Sign-out
        const oldSignOut = (targetProfile.default_sign_out || '').trim();
        if (defaultSignOut !== undefined && oldSignOut !== defaultSignOut.trim()) {
          changes.push(`Sign-out:\n${oldSignOut || 'None'} → ${defaultSignOut.trim() || 'None'}`);
        }

        // 19. Department
        const oldDept = (existingSettings.department || 'Data Entry').trim();
        const newDept = (department || 'Data Entry').trim();
        if (oldDept !== newDept) {
          changes.push(`Department:\n${oldDept} → ${newDept}`);
        }

        // 20. Other Department
        const oldOtherDept = (existingSettings.other_department || 'IT').trim();
        const newOtherDept = (otherDepartment || 'IT').trim();
        if (oldOtherDept !== newOtherDept) {
          changes.push(`Other Department:\n${oldOtherDept} → ${newOtherDept}`);
        }

        // 21. Performs Data Entry
        const oldPDE = existingSettings.performs_data_entry !== false;
        const newPDE = performsDataEntry !== false;
        if (performsDataEntry !== undefined && oldPDE !== newPDE) {
          changes.push(`Performs Data Entry:\n${formatBool(oldPDE)} → ${formatBool(newPDE)}`);
        }

        // 22. Performs Other Dept Tasks
        const oldPOD = !!existingSettings.performs_other_dept_tasks;
        const newPOD = !!performsOtherDeptTasks;
        if (performsOtherDeptTasks !== undefined && oldPOD !== newPOD) {
          changes.push(`Performs Other Department Tasks:\n${formatBool(oldPOD)} → ${formatBool(newPOD)}`);
        }

        // 23. KPI Skills
        const oldKpiSkills = [...(existingSettings.kpi_skills || [])].sort().join(', ');
        const newKpiSkills = [...(kpiSkills || [])].sort().join(', ');
        if (kpiSkills !== undefined && oldKpiSkills !== newKpiSkills) {
          changes.push(`KPI Skills:\n${oldKpiSkills || 'None'} → ${newKpiSkills || 'None'}`);
        }

        // 24. KPI Dept Indicators
        const oldKpiDept = [...(existingSettings.kpi_dept_indicators || [])].sort().join(', ');
        const newKpiDept = [...(kpiDeptIndicators || [])].sort().join(', ');
        if (kpiDeptIndicators !== undefined && oldKpiDept !== newKpiDept) {
          changes.push(`KPI Department Indicators:\n${oldKpiDept || 'None'} → ${newKpiDept || 'None'}`);
        }

        // 25. KPI Other Dept Indicators
        const oldKpiOtherDept = [...(existingSettings.kpi_other_dept_indicators || [])].sort().join(', ');
        const newKpiOtherDept = [...(kpiOtherDeptIndicators || [])].sort().join(', ');
        if (kpiOtherDeptIndicators !== undefined && oldKpiOtherDept !== newKpiOtherDept) {
          changes.push(`KPI Other Department Indicators:\n${oldKpiOtherDept || 'None'} → ${newKpiOtherDept || 'None'}`);
        }
      } else {
        changes.push(`Full Name:\nNone → ${fullName.trim()}`);
        changes.push(`Role:\nNone → ${role}`);
        changes.push(`Allowed Types:\nNone → ${allowedTypes.join(', ')}`);
        changes.push(`Quote Rules Permission:\nNone → ${formatBool(canManageRules)}`);
      }

      // Audit Log: Only create if at least one field has changed
      if (changes.length > 0) {
        const logDetails = `Updated user profile\n\n${changes.join('\n\n')}`;
        await logActivity(
          'UPDATE_USER',
          userId,
          logDetails
        );
      }

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
