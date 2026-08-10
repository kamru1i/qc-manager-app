// @ts-nocheck
import { supabase } from '@/utils/supabase';
import { toast } from 'sonner';
import { MENU_TABS, CONFIGURABLE_ROLES } from '@/utils/menuTabsRegistry';
import { isSuperadmin, isAdminRole, canAdminManageFeatureFlag } from '@/utils/permissionService';
import { FLAG_TO_TAB_KEY } from '@/utils/featureFlagsRegistry';
import { useAppEventBus } from '@/contexts/AppEventBusContext';

export function useProfileSettingsHandlers(props: any, stateHook: any) {
  const { emit } = useAppEventBus();
  const { profile, setProfile, sessionUser, profilesList, refreshProfiles } = props;
  const { state, dispatch, hasChanges, ...setters } = stateHook;
  const {
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
    editHasChutiAccess,
    setEditHasChutiAccess,
    editNeedsApproval,
    setEditNeedsApproval,
    editSupervisorIds,
    setEditSupervisorIds,
    editEligibleOfficeLeave,
    setEditEligibleOfficeLeave,
    editEligibleGovtHoliday,
    setEditEligibleGovtHoliday,
    editAllowOvertime,
    setEditAllowOvertime,
    editAllowReserve,
    setEditAllowReserve,
    editHasQuotesAccess,
    setEditHasQuotesAccess,
    editAllowedTypes,
    setEditAllowedTypes,
    editCanManageRules,
    setEditCanManageRules,
    editKpiSkills,
    setEditKpiSkills,
    editKpiDeptIndicators,
    setEditKpiDeptIndicators,
    editKpiOtherDeptIndicators,
    setEditKpiOtherDeptIndicators,
    editPerformsDataEntry,
    setEditPerformsDataEntry,
    editDepartment,
    setEditDepartment,
    editPerformsOtherDeptTasks,
    setEditPerformsOtherDeptTasks,
    editOtherDepartment,
    setEditOtherDepartment,
    editDelegatedLeaveSupervisorId,
    setEditDelegatedLeaveSupervisorId,
    editDelegatedKpiSupervisorId,
    setEditDelegatedKpiSupervisorId,
    newPassword,
    setNewPassword,
    confirmNewPassword,
    setConfirmNewPassword,
    passwordSubmitting,
    setPasswordSubmitting,
    showPasswordFields,
    setShowPasswordFields,
    syncedProfileId,
    setSyncedProfileId,
    sanitizerRules,
    setSanitizerRules,
    sanitizerInput,
    setSanitizerInput,
    sanitizerSubmitting,
    setSanitizerSubmitting,
    roleVisibility,
    setRoleVisibility,
    activeRoleVisKey,
    setActiveRoleVisKey,
    supervisorAccessOverrides,
    setSupervisorAccessOverrides,
    selectedSupervisorId,
    setSelectedSupervisorId,
    featureFlags,
    setFeatureFlags,
    userFeatureFlags,
    setUserFeatureFlags,
    adminDelegatedFlags,
    setAdminDelegatedFlags,
    activeFlagKey,
    setActiveFlagKey,
    tempAccess,
    setTempAccess,
    tempSubmitting,
    setTempSubmitting,
    tempForm,
    setTempForm,
    submitting,
    setSubmitting,
    isCodenameEditable,
    setIsCodenameEditable,
    vpnList,
    setVpnList,
    newVpnInput,
    setNewVpnInput,
    vpnSubmitting,
    setVpnSubmitting,
    activeSubTab,
    setActiveSubTab,
    currentTimestamp,
    setCurrentTimestamp,
  } = stateHook;

  const effectiveAdminDelegatedFlags = props.effectiveAdminDelegatedFlags;

  const handleToggleSupervisorOverride = async (supervisorId: string, tabKey: string, enabled: boolean) => {
    if (!profile) return;
    if (!isAdminRole(profile)) {
      toast.error('Only Admin or Superadmin can configure supervisor access overrides.');
      return;
    }
    try {
      const currentOverrides = { ...(supervisorAccessOverrides[supervisorId] || {}) };
      currentOverrides[tabKey] = enabled;
      const nextAllOverrides = {
        ...supervisorAccessOverrides,
        [supervisorId]: currentOverrides,
      };

      const baseGs = (profile.global_settings && typeof profile.global_settings === 'object')
        ? profile.global_settings
        : {};

      const updatedGs = {
        ...baseGs,
        supervisor_access_overrides: nextAllOverrides,
      };

      const { error } = await supabase
        .from('profiles')
        .update({ global_settings: updatedGs })
        .eq('id', sessionUser?.id || profile.id);

      if (error) throw error;

      setSupervisorAccessOverrides(nextAllOverrides);
      const updatedProfile = { ...profile, global_settings: updatedGs };
      setProfile(updatedProfile);
      if (sessionUser) {
        localStorage.setItem(`cached_profile_${sessionUser.id}`, JSON.stringify(updatedProfile));
      }
      emit('profile-updated', updatedProfile);
      toast.success('Supervisor access override updated!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update supervisor access override');
    }
  };

  const handleSubTabChange = (tab: 'profile' | 'user_management' | 'sanitizer' | 'access_controls' | 'feature_flags' | 'vpn_list') => {
    setActiveSubTab(tab);
    localStorage.setItem('settings_active_subtab', tab);
  };

  const handleSaveVpnList = async (nextVpnList: string[]) => {
    if (!profile) return;
    setVpnSubmitting(true);
    try {
      // 1. Attempt atomic jsonb_set RPC across all profiles
      const { error: rpcError } = await supabase.rpc('set_user_vpn_list' as any, {
        p_vpn_list: nextVpnList
      });

      let updatedGs = {
        ...(profile.global_settings || {}),
        vpn_list: nextVpnList,
      };

      if (rpcError) {
        // Fallback: fetch fresh global_settings from DB to avoid overwriting concurrent changes
        const { data: fresh } = await supabase
          .from('profiles')
          .select('global_settings')
          .eq('id', sessionUser?.id || profile.id)
          .maybeSingle();

        updatedGs = {
          ...((fresh?.global_settings as Record<string, any>) || profile.global_settings || {}),
          vpn_list: nextVpnList,
        };

        const { error } = await supabase
          .from('profiles')
          .update({ global_settings: updatedGs })
          .eq('id', sessionUser?.id || profile.id);
        if (error) throw error;
      }

      setVpnList(nextVpnList);
      const updatedProfile = { ...profile, global_settings: updatedGs };
      setProfile(updatedProfile);
      if (sessionUser) {
        localStorage.setItem(`cached_profile_${sessionUser.id}`, JSON.stringify(updatedProfile));
      }
      emit('profile-updated', updatedProfile);
      toast.success('VPN List updated successfully!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update VPN List');
    } finally {
      setVpnSubmitting(false);
    }
  };

  const handleAddVpnName = () => {
    const val = newVpnInput.trim();
    if (!val) return;
    if (vpnList.some(v => v.toLowerCase() === val.toLowerCase())) {
      toast.error('VPN name already exists in list');
      return;
    }
    const nextList = [...vpnList, val];
    setNewVpnInput('');
    handleSaveVpnList(nextList);
  };

  const handleRemoveVpnName = (nameToRemove: string) => {
    const nextList = vpnList.filter(v => v !== nameToRemove);
    handleSaveVpnList(nextList);
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

  const handleSaveSettings = async (e?: React.SyntheticEvent) => {
    if (e) e.preventDefault();
    if (!sessionUser || !profile) return;
    setSubmitting(true);

    try {
      // Helper to retrieve fresh global_settings from DB before updating, preventing stale state overwrites
      const fetchFreshGs = async () => {
        const { data: fresh } = await supabase
          .from('profiles')
          .select('global_settings')
          .eq('id', sessionUser.id)
          .maybeSingle();
        return (fresh?.global_settings as Record<string, any>) || profile.global_settings || {};
      };

      const freshGs = await fetchFreshGs();
      const globalSettingsUpdate = {
        ...freshGs,
        user_feature_flags: userFeatureFlags,
        kpi_skills: editKpiSkills,
        kpi_dept_indicators: editKpiDeptIndicators,
        kpi_other_dept_indicators: editKpiOtherDeptIndicators,
        performs_data_entry: editPerformsDataEntry,
        department: editDepartment,
        performs_other_dept_tasks: editPerformsOtherDeptTasks,
        other_department: editOtherDepartment,
      };

      if (isAdminRole(profile)) {
        const updates: any = {
          username: editUsername.toUpperCase().trim(),
          full_name: editFullName,
          working_hours: parseFloat(editWorkingHours) || 9.5,
          break_time: parseInt(editBreakTime) || 0,
          job_role: editJobRole,
          default_sign_in: profileSignInTime,
          default_sign_out: profileSignOutTime,
          has_chuti_access: editHasChutiAccess,
          needs_supervisor_approval: editNeedsApproval,
          supervisor_ids: editSupervisorIds,
          eligible_office_leave: editEligibleOfficeLeave,
          eligible_govt_holiday: editEligibleGovtHoliday,
          allow_overtime: editAllowOvertime,
          allow_reserve: editAllowReserve,
          has_quotes_access: editHasQuotesAccess,
          allowed_types: editAllowedTypes,
          can_manage_rules: editCanManageRules,
          delegated_leave_supervisor_id: editDelegatedLeaveSupervisorId,
          delegated_kpi_supervisor_id: editDelegatedKpiSupervisorId,
          global_settings: globalSettingsUpdate
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
        emit("profile-updated", { ...profile, ...updatedProfile });
        await refreshProfiles({ force: true });
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

          setProfile({ ...profile, ...updatedProfile });
          localStorage.setItem(`cached_profile_${sessionUser.id}`, JSON.stringify({ ...profile, ...updatedProfile }));
          emit("profile-updated", { ...profile, ...updatedProfile });
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

          setProfile({ ...profile, ...updatedProfile });
          localStorage.setItem(`cached_profile_${sessionUser.id}`, JSON.stringify({ ...profile, ...updatedProfile }));
          emit("profile-updated", { ...profile, ...updatedProfile });
          await refreshProfiles({ force: true });

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
      emit('profile-updated', updatedProfile);
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

  const handleToggleRoleVisibility = async (
    role: string,
    tabKey: string,
    nextVisible: boolean
  ) => {
    const itemKey = `${role}:${tabKey}`;
    if (!profile || !isSuperadmin(profile) || activeRoleVisKey === itemKey) return;

    const roleMap = { ...(roleVisibility[role] || {}), [tabKey]: nextVisible };
    const next: Record<string, Record<string, boolean>> = { ...roleVisibility, [role]: roleMap };

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
      emit('profile-updated', updatedProfile);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update tab access.');
    } finally {
      setActiveRoleVisKey(null);
    }
  };

  const handleToggleFeatureFlag = async (flagKey: string, nextEnabled: boolean) => {
    if (!profile || activeFlagKey === flagKey) return;
    if (!isSuperadmin(profile) && !canAdminManageFeatureFlag(profile, flagKey, profile.global_settings)) {
      toast.error('You do not have permission to manage this feature flag.');
      return;
    }

    const nextFlags = { ...featureFlags, [flagKey]: nextEnabled };
    const tabKey = FLAG_TO_TAB_KEY[flagKey];

    let nextRoleVis = { ...roleVisibility };
    if (tabKey) {
      const updatedRoles: Record<string, Record<string, boolean>> = { ...nextRoleVis };
      CONFIGURABLE_ROLES.forEach((role) => {
        const roleMap = { ...(updatedRoles[role] || {}), [tabKey]: nextEnabled };
        updatedRoles[role] = roleMap;
      });
      nextRoleVis = updatedRoles;
    }

    setActiveFlagKey(flagKey);
    try {
      const { error: flagErr } = await supabase.rpc('set_feature_flags', { p_flags: nextFlags });
      if (flagErr) throw flagErr;

      if (tabKey) {
        const { error: visErr } = await supabase.rpc('set_role_visibility', { p_visibility: nextRoleVis });
        if (visErr) console.error('Failed to sync role visibility:', visErr);
      }

      setFeatureFlags(nextFlags);
      if (tabKey) setRoleVisibility(nextRoleVis);

      const updatedProfile = {
        ...profile,
        global_settings: {
          ...(profile.global_settings || {}),
          feature_flags: nextFlags,
          ...(tabKey ? { role_visibility: nextRoleVis } : {}),
        },
      };
      setProfile(updatedProfile);
      localStorage.setItem(`cached_profile_${sessionUser.id}`, JSON.stringify(updatedProfile));
      emit('profile-updated', updatedProfile);
      await refreshProfiles({ force: true });
    } catch (err: any) {
      toast.error(err.message || 'Failed to update feature flag.');
    } finally {
      setActiveFlagKey(null);
    }
  };

  const handleToggleAdminDelegation = async (flagKey: string, nextDelegated: boolean) => {
    if (!profile || !isSuperadmin(profile) || activeFlagKey === `delegate:${flagKey}`) return;

    const nextDelegatedFlags = { ...(effectiveAdminDelegatedFlags || {}), [flagKey]: nextDelegated };
    setActiveFlagKey(`delegate:${flagKey}`);
    try {
      // 1. Try set_admin_delegated_flags RPC first to replicate across all rows
      const { error: rpcErr } = await supabase.rpc('set_admin_delegated_flags' as any, { p_flags: nextDelegatedFlags });

      // 2. Fallback: update across all profiles if RPC function isn't created in DB yet
      if (rpcErr) {
        console.warn('set_admin_delegated_flags RPC fallback:', rpcErr.message);
        const updatedGs = {
          ...(profile.global_settings || {}),
          admin_delegated_flags: nextDelegatedFlags
        };
        const { error: updateErr } = await supabase
          .from('profiles')
          .update({ global_settings: updatedGs })
          .eq('id', sessionUser?.id || profile.id);
        if (updateErr) throw updateErr;
      }

      setAdminDelegatedFlags(nextDelegatedFlags);
      const updatedProfile = {
        ...profile,
        global_settings: {
          ...(profile.global_settings || {}),
          admin_delegated_flags: nextDelegatedFlags
        }
      };
      setProfile(updatedProfile);
      localStorage.setItem(`cached_profile_${sessionUser.id}`, JSON.stringify(updatedProfile));
      emit('profile-updated', updatedProfile);
      toast.success(nextDelegated ? `Admin allowed to manage ${flagKey}` : `Admin access revoked for ${flagKey}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update admin delegation.');
    } finally {
      setActiveFlagKey(null);
    }
  };

  const handleResetAllUserFeatureFlags = async () => {
    if (!profile || !isSuperadmin(profile)) return;
    setSubmitting(true);
    try {
      const { error: rpcErr } = await supabase.rpc('reset_all_user_feature_flags' as any);
      if (rpcErr) {
        console.warn('reset_all_user_feature_flags RPC fallback:', rpcErr.message);
        const { data: allProfiles } = await supabase.from('profiles').select('id, global_settings');
        if (allProfiles) {
          for (const p of allProfiles) {
            if (p.global_settings && typeof p.global_settings === 'object' && 'user_feature_flags' in p.global_settings) {
              const updatedGs = { ...(p.global_settings as Record<string, any>) };
              delete updatedGs.user_feature_flags;
              await supabase.from('profiles').update({ global_settings: updatedGs }).eq('id', p.id);
            }
          }
        }
      }

      // Update local profile state
      const cleanedGs = { ...(profile.global_settings || {}) };
      delete cleanedGs.user_feature_flags;
      const updatedProfile = { ...profile, global_settings: cleanedGs };
      setProfile(updatedProfile);
      if (sessionUser?.id) {
        localStorage.setItem(`cached_profile_${sessionUser.id}`, JSON.stringify(updatedProfile));
      }
      emit('profile-updated', updatedProfile);

      // Refresh shared profiles context across app
      await refreshProfiles({ force: true });

      toast.success('All individual user overrides reset to Inherit!');
    } catch (err: any) {
      toast.error('Failed to reset overrides: ' + (err?.message || String(err)));
    } finally {
      setSubmitting(false);
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
      emit('profile-updated', updatedProfile);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update temporary access.');
    } finally {
      setTempSubmitting(false);
    }
  };

  const handleAddTempAccess = () => {
    if (tempForm.target_type === 'user' && !tempForm.user_id) {
      toast.error('Select a specific user.');
      return;
    }
    if (!tempForm.expires_at) {
      toast.error('Pick an expiry date/time.');
      return;
    }
    if (new Date(tempForm.expires_at).getTime() <= Date.now()) {
      toast.error('Expiry must be in the future.');
      return;
    }
    const now = Date.now();
    const kept = tempAccess.filter((t) => {
      if (new Date(t.expires_at).getTime() <= now) return false;
      if (tempForm.target_type === 'user') {
        return !(t.target_type === 'user' && (t.user_id === tempForm.user_id || t.user_codename === tempForm.user_codename) && t.tabKey === tempForm.tabKey);
      } else {
        return !((!t.target_type || t.target_type === 'role') && t.role === tempForm.role && t.tabKey === tempForm.tabKey);
      }
    });

    const targetUserObj = profilesList.find((p) => p.id === tempForm.user_id);
    const targetUserRole = targetUserObj?.role || 'user';
    const targetCodename = targetUserObj
      ? (targetUserObj.codename || targetUserObj.username || 'User')
      : tempForm.user_codename;
    const displayUserLabel = targetUserObj?.full_name
      ? `${targetCodename} (${targetUserObj.full_name})`
      : targetCodename;

    handleSaveTempAccess([
      ...kept,
      {
        target_type: tempForm.target_type,
        user_id: tempForm.target_type === 'user' ? tempForm.user_id : undefined,
        user_codename: tempForm.target_type === 'user' ? displayUserLabel : undefined,
        role: tempForm.target_type === 'user' ? targetUserRole : tempForm.role,
        tabKey: tempForm.tabKey,
        action: tempForm.action,
        expires_at: new Date(tempForm.expires_at).toISOString(),
        comment: tempForm.comment.trim() || undefined,
      },
    ]);
    setTempForm((f: any) => ({ ...f, comment: '' }));
  };

  const handleRemoveTempAccess = (entry: TempAccessEntry) => {
    handleSaveTempAccess(
      tempAccess.filter(
        (t) =>
          !(t.role === entry.role && t.tabKey === entry.tabKey && t.expires_at === entry.expires_at)
      )
    );
  };

  return {
    handleToggleSupervisorOverride,
    handleSubTabChange,
    handleSaveVpnList,
    handleAddVpnName,
    handleRemoveVpnName,
    handleUpdatePassword,
    handleSaveSettings,
    handleSaveSanitizerRules,
    handleAddSanitizerWord,
    handleToggleSanitizerWord,
    handleRemoveSanitizerWord,
    handleToggleRoleVisibility,
    handleToggleFeatureFlag,
    handleToggleAdminDelegation,
    handleResetAllUserFeatureFlags,
    handleSaveTempAccess,
    handleAddTempAccess,
    handleRemoveTempAccess,
  };
}
