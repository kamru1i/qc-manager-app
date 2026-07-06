'use client';

import React, { useEffect, useState } from 'react';
import { User, AlertTriangle, RefreshCw, X, Lock } from 'lucide-react';
import { Profile } from '@/types';
import { subscribeUserToPush, unsubscribeUserFromPush, sendPushNotification } from '@/utils/webPushHelper';
import { ProfileFields } from '../ProfileFields';
import toast from 'react-hot-toast';

interface AdminProfileSettingsModalProps {
  showProfileSettingsModal: boolean;
  setShowProfileSettingsModal: (val: boolean) => void;
  profile: Profile | null;
  editingStaffProfileId: string | null;
  sessionUser: any;
  isPushSubscribed: boolean;
  setIsPushSubscribed: (val: boolean) => void;
  isPushLoading: boolean;
  setIsPushLoading: (val: boolean) => void;
  adminActiveTab: 'user' | 'admin';
  setAdminActiveTab: (val: 'user' | 'admin') => void;
  setViewingStaffId: (val: string | null) => void;
  isCodenameEditable: boolean;
  setIsCodenameEditable: (val: boolean) => void;
  editUsername: string;
  setEditUsername: (val: string) => void;
  editFullName: string;
  setEditFullName: (val: string) => void;
  editJobRole: string;
  setEditJobRole: (val: string) => void;
  editWorkingHours: string;
  setEditWorkingHours: (val: string) => void;
  editBreakTime: string;
  setEditBreakTime: (val: string) => void;
  profileSignInTime: string;
  setProfileSignInTime: (val: string) => void;
  profileSignOutTime: string;
  setProfileSignOutTime: (val: string) => void;
  editNeedsApproval: boolean;
  setEditNeedsApproval: (val: boolean) => void;
  editAllowReserve: boolean;
  setEditAllowReserve: (val: boolean) => void;
  editAllowOvertime: boolean;
  setEditAllowOvertime: (val: boolean) => void;
  editEligibleOfficeLeave: boolean;
  setEditEligibleOfficeLeave: (val: boolean) => void;
  editEligibleGovtHoliday: boolean;
  setEditEligibleGovtHoliday: (val: boolean) => void;
  isEditRequestMode: boolean;
  setIsEditRequestMode: (val: boolean) => void;
  setupSubmitting: boolean;
  handleUpdateSettings: (e: React.FormEvent) => void;
  profilesList: Profile[];
  editSupervisorIds: string[];
  setEditSupervisorIds: (ids: string[]) => void;
}

export function AdminProfileSettingsModal({
  showProfileSettingsModal,
  setShowProfileSettingsModal,
  profile,
  editingStaffProfileId,
  sessionUser,
  isPushSubscribed,
  setIsPushSubscribed,
  isPushLoading,
  setIsPushLoading,
  adminActiveTab,
  setAdminActiveTab,
  setViewingStaffId,
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
  isEditRequestMode,
  setIsEditRequestMode,
  setupSubmitting,
  handleUpdateSettings,
  profilesList,
  editSupervisorIds,
  setEditSupervisorIds,
}: AdminProfileSettingsModalProps) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  const [showPasswordFields, setShowPasswordFields] = useState(false);
  const [testingPush, setTestingPush] = useState(false);

  const targetProfile = editingStaffProfileId
    ? profilesList.find(p => p.id === editingStaffProfileId)
    : profile;

  let hasChanges = false;
  if (targetProfile) {
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
    const isEligibleOfficeChanged = editEligibleOfficeLeave !== !!targetProfile.eligible_office_leave;
    const isEligibleGovtChanged = editEligibleGovtHoliday !== !!targetProfile.eligible_govt_holiday;
    
    let isSupervisorsChanged = false;
    if (editingStaffProfileId) {
      const oldSups = [...(targetProfile.supervisor_ids || [])].sort();
      const newSups = [...editSupervisorIds].sort();
      isSupervisorsChanged = oldSups.join(',') !== newSups.join(',');
    }

    if (editingStaffProfileId) {
      hasChanges = isUsernameChanged || isFullNameChanged || isWorkingHoursChanged || isBreakTimeChanged || 
                   isJobRoleChanged || isSignInChanged || isSignOutChanged || isNeedsApprovalChanged || 
                   isAllowReserveChanged || isAllowOvertimeChanged || 
                   isEligibleOfficeChanged || isEligibleGovtChanged || (editNeedsApproval && isSupervisorsChanged);
    } else if (profile?.role === 'admin') {
      hasChanges = isUsernameChanged || isFullNameChanged || isWorkingHoursChanged || isBreakTimeChanged || 
                   isJobRoleChanged || isSignInChanged || isSignOutChanged || isNeedsApprovalChanged || 
                   isAllowReserveChanged || isAllowOvertimeChanged || 
                   isEligibleOfficeChanged || isEligibleGovtChanged;
    } else {
      hasChanges = isFullNameChanged || isWorkingHoursChanged || isBreakTimeChanged || 
                   isJobRoleChanged || isSignInChanged || isSignOutChanged;
    }
  }

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
      const { supabase } = await import('@/utils/supabase');
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

  // ESC key handler — close drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showProfileSettingsModal) {
        setShowProfileSettingsModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showProfileSettingsModal, setShowProfileSettingsModal]);

  const handleClose = () => {
    setShowProfileSettingsModal(false);
    // Form data is intentionally NOT reset here — persists until page reload
  };

  const drawerContent = (
    <>
      {/* Decorative glow bubble */}
      <div className="absolute top-[-15%] right-[-25%] w-[55%] h-[55%] rounded-full bg-blue-900/10 blur-[80px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-15%] w-[40%] h-[40%] rounded-full bg-blue-900/8 blur-[60px] pointer-events-none" />

      {/* Header */}
      <div className="flex justify-between items-center border-b border-slate-800/80 px-6 py-4 shrink-0 relative z-10">
        <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
          <User className="h-5 w-5 text-blue-500" />
          Profile Settings
        </h3>
        <button
          type="button"
          onClick={handleClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition-all cursor-pointer"
          aria-label="Close drawer"
        >
          <X className="h-4.5 w-4.5" />
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-6 py-5 relative z-10 scrollbar-thin">
        {profile?.profile_change_status === 'pending' && (
          <div className="p-3 bg-purple-955/50 border border-purple-800/50 text-purple-300 text-xs rounded-lg mb-4 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-purple-400 shrink-0 mt-0.5" />
            <span>Your profile update request is currently pending. Please wait for admin approval.</span>
          </div>
        )}

        <form onSubmit={handleUpdateSettings} className="space-y-4 font-sans">
          {/* Web/Desktop Push Notification Toggle */}
          {!editingStaffProfileId && typeof window !== 'undefined' && (
            (('serviceWorker' in navigator && 'PushManager' in window) && !(window as any).__TAURI_INTERNALS__) || 
            (window as any).__TAURI_INTERNALS__
          ) && (
            <div className="push-notification-banner flex flex-col gap-3 p-3 bg-blue-955/45 rounded-lg border border-blue-900/35 mb-4 shadow-inner">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white">Desktop Notifications 🔔</span>
                    {isPushSubscribed && (
                      <button
                        type="button"
                        disabled={testingPush}
                        onClick={handleTestPushNotification}
                        className="px-2 py-0.5 bg-blue-650 hover:bg-blue-550 text-white rounded text-[10px] font-bold cursor-pointer transition-all disabled:opacity-50 flex items-center gap-1 font-sans"
                      >
                        {testingPush ? (
                          <RefreshCw className="h-2.5 w-2.5 animate-spin" />
                        ) : null}
                        <span>Test</span>
                      </button>
                    )}
                  </div>
                  <span className="block text-[11px] text-slate-400 mt-0.5">Receive instant alerts for leave updates and new requests</span>
                </div>
                <button
                  type="button"
                  disabled={isPushLoading}
                  onClick={async () => {
                    if (!sessionUser || isPushLoading) return;

                    const willSubscribe = !isPushSubscribed;

                    // Optimistically update the UI toggle state immediately
                    setIsPushSubscribed(willSubscribe);
                    localStorage.setItem('push_subscribed_pref_' + sessionUser.id, willSubscribe ? 'true' : 'false');

                    const isTauri = (window as any).__TAURI_INTERNALS__;
                    if (isTauri) {
                      return; // Done for Tauri (it reads from localStorage directly)
                    }

                    setIsPushLoading(true);

                    try {
                      if (!willSubscribe) {
                        const success = await unsubscribeUserFromPush(sessionUser.id);
                        if (!success) {
                          // Revert state if failed
                          setIsPushSubscribed(true);
                          localStorage.setItem('push_subscribed_pref_' + sessionUser.id, 'true');
                        }
                      } else {
                        const success = await subscribeUserToPush(sessionUser.id);
                        if (!success) {
                          // Revert state if failed
                          setIsPushSubscribed(false);
                          localStorage.setItem('push_subscribed_pref_' + sessionUser.id, 'false');
                        }
                      }
                    } catch {
                      // Revert on error
                      setIsPushSubscribed(!willSubscribe);
                      localStorage.setItem('push_subscribed_pref_' + sessionUser.id, (!willSubscribe) ? 'true' : 'false');
                    } finally {
                      setIsPushLoading(false);
                    }
                  }}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${isPushSubscribed ? 'bg-blue-600' : 'bg-slate-800'
                    } ${isPushLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isPushSubscribed ? 'translate-x-5' : 'translate-x-0'
                      }`}
                  />
                </button>
              </div>
            </div>
          )}



          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider">Codename</label>
              {profile?.role === 'admin' && adminActiveTab === 'admin' && (
                <button
                  type="button"
                  onClick={() => setIsCodenameEditable(!isCodenameEditable)}
                  className={`text-[10px] flex items-center gap-1 transition-colors px-2 py-0.5 rounded cursor-pointer ${isCodenameEditable
                      ? 'text-purple-400 bg-purple-955/40 hover:bg-purple-955/60 border border-purple-800/30'
                      : 'text-blue-400 hover:text-blue-300 bg-blue-955/20 hover:bg-blue-950/40 border border-blue-900/20'
                    }`}
                  title={isCodenameEditable ? "Exit Edit Mode" : "Change Codename"}
                >
                  <EditIcon className="h-3 w-3" />
                  <span>{isCodenameEditable ? 'Lock' : 'Change'}</span>
                </button>
              )}
            </div>
            <input
              type="text"
              disabled={!isCodenameEditable}
              value={editUsername}
              onChange={(e) => setEditUsername(e.target.value)}
              className={`mt-1 block w-full px-3 py-2 bg-slate-955 border rounded-lg text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase font-mono ${isCodenameEditable
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

          {/* Settings Toggles (Admin only) */}
          {profile?.role === 'admin' && adminActiveTab === 'admin' && (
            <div className="flex flex-col gap-3 font-sans">
              <label className="flex items-center gap-3 p-3 bg-slate-955/60 rounded-lg border border-slate-800/80 cursor-pointer hover:bg-slate-900 transition-colors">
                <input
                  type="checkbox"
                  checked={editNeedsApproval}
                  onChange={(e) => setEditNeedsApproval(e.target.checked)}
                  className="h-4.5 w-4.5 rounded-full border-slate-800 bg-slate-955 text-blue-600 accent-blue-600 focus:ring-blue-550 focus:ring-offset-slate-900 focus:ring-2 cursor-pointer"
                />
                <div>
                  <span className="block text-xs font-semibold text-slate-100">Supervisor Approval?</span>
                  <span className="block text-[10px] text-slate-400">If checked, leaves will require supervisor approval</span>
                </div>
              </label>

              {editNeedsApproval && (
                <div className="space-y-2 bg-slate-955/40 p-3 rounded-lg border border-slate-800/80 -mt-1 ml-2">
                  <div className="flex justify-between items-center">
                    <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Select Supervisors
                    </label>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {(editSupervisorIds || []).length > 0 ? `${editSupervisorIds.length} Selected` : 'All Selected'}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <label className={`flex items-center gap-2 px-2.5 py-1 rounded-md border cursor-pointer transition-all select-none text-[11px] ${
                      (editSupervisorIds || []).length === 0 
                        ? 'border-blue-600 bg-blue-955/20 text-blue-400' 
                        : 'border-slate-850 bg-slate-900/60 text-slate-300'
                    }`}>
                      <input
                        type="checkbox"
                        checked={(editSupervisorIds || []).length === 0}
                        onChange={() => setEditSupervisorIds([])}
                        className="rounded-full border-slate-700 bg-slate-955 text-blue-600 accent-blue-600 focus:ring-blue-550 focus:ring-offset-slate-900 h-3.5 w-3.5 cursor-pointer"
                      />
                      <span className="font-semibold">All</span>
                    </label>
                    
                    {((profilesList || []).filter(p => p.role === 'supervisor')).map(sup => {
                      const isChecked = (editSupervisorIds || []).includes(sup.id);
                      return (
                        <label 
                          key={sup.id} 
                          className={`flex items-center gap-2 px-2.5 py-1 rounded-md border cursor-pointer transition-all select-none text-[11px] ${
                            isChecked 
                              ? 'border-blue-600 bg-blue-955/20 text-blue-400' 
                              : 'border-slate-850 bg-slate-900/60 text-slate-300'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              if (isChecked) {
                                setEditSupervisorIds((editSupervisorIds || []).filter(id => id !== sup.id));
                              } else {
                                setEditSupervisorIds([...(editSupervisorIds || []), sup.id]);
                              }
                            }}
                            className="rounded-full border-slate-700 bg-slate-955 text-blue-600 accent-blue-600 focus:ring-blue-550 focus:ring-offset-slate-900 h-3.5 w-3.5 cursor-pointer"
                          />
                          <span className="font-semibold">
                            {sup.username} {sup.full_name ? `(${sup.full_name})` : ''}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              <label className="flex items-center gap-3 p-3 bg-slate-955/60 rounded-lg border border-slate-800/80 cursor-pointer hover:bg-slate-900 transition-colors">
                <input
                  type="checkbox"
                  checked={editEligibleOfficeLeave}
                  onChange={(e) => setEditEligibleOfficeLeave(e.target.checked)}
                  className="h-4.5 w-4.5 rounded-full border-slate-800 bg-slate-955 text-blue-600 accent-blue-600 focus:ring-blue-550 focus:ring-offset-slate-900 focus:ring-2 cursor-pointer"
                />
                <div>
                  <span className="block text-xs font-semibold text-slate-100">Office Leave Eligible?</span>
                  <span className="block text-[10px] text-slate-400">If enabled, eligible for annual office leaves and Eid holidays</span>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 bg-slate-955/60 rounded-lg border border-slate-800/80 cursor-pointer hover:bg-slate-900 transition-colors">
                <input
                  type="checkbox"
                  checked={editEligibleGovtHoliday}
                  onChange={(e) => setEditEligibleGovtHoliday(e.target.checked)}
                  className="h-4.5 w-4.5 rounded-full border-slate-800 bg-slate-955 text-blue-600 accent-blue-600 focus:ring-blue-550 focus:ring-offset-slate-900 focus:ring-2 cursor-pointer"
                />
                <div>
                  <span className="block text-xs font-semibold text-slate-100">Govt Holiday Eligible?</span>
                  <span className="block text-[10px] text-slate-400">If enabled, eligible for leaves according to the government holiday list</span>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 bg-slate-955/60 rounded-lg border border-slate-800/80 cursor-pointer hover:bg-slate-900 transition-colors">
                <input
                  type="checkbox"
                  checked={editAllowReserve}
                  onChange={(e) => setEditAllowReserve(e.target.checked)}
                  className="h-4.5 w-4.5 rounded-full border-slate-800 bg-slate-955 text-blue-600 accent-blue-600 focus:ring-blue-550 focus:ring-offset-slate-900 focus:ring-2 cursor-pointer"
                />
                <div>
                  <span className="block text-xs font-semibold text-slate-100">Reserve Govt Holiday?</span>
                  <span className="block text-[10px] text-slate-400">If checked, will have option to reserve government holidays</span>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 bg-slate-955/60 rounded-lg border border-slate-800/80 cursor-pointer hover:bg-slate-900 transition-colors">
                <input
                  type="checkbox"
                  checked={editAllowOvertime}
                  onChange={(e) => setEditAllowOvertime(e.target.checked)}
                  className="h-4.5 w-4.5 rounded-full border-slate-800 bg-slate-955 text-blue-600 accent-blue-600 focus:ring-blue-550 focus:ring-offset-slate-900 focus:ring-2 cursor-pointer"
                />
                <div>
                  <span className="block text-xs font-semibold text-slate-100">Overtime?</span>
                  <span className="block text-[10px] text-slate-400">If checked, overtime leave category will be enabled</span>
                </div>
              </label>
            </div>
          )}

          {profile?.profile_change_status !== 'pending' && (
            <div className="flex gap-3 mt-6 pb-2">
              <button
                type="submit"
                disabled={setupSubmitting || !hasChanges}
                className={`flex-1 flex justify-center py-2 px-4 border rounded-lg shadow-sm text-xs font-semibold transition-all items-center gap-1.5 ${
                  setupSubmitting || !hasChanges
                    ? 'border-slate-800/80 bg-slate-800/40 text-slate-500 cursor-not-allowed opacity-50'
                    : 'border-transparent text-white bg-blue-600 hover:bg-blue-500 cursor-pointer active:scale-95'
                }`}
              >
                {setupSubmitting && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                {setupSubmitting
                  ? 'Saving...'
                  : ((profile?.role === 'admin' && adminActiveTab === 'admin') || !profile?.has_edited_profile
                      ? 'Save Settings'
                      : 'Submit Request for Approval')}
              </button>
            </div>
          )}
        </form>

        {!editingStaffProfileId && (
          <div className="mt-8 pt-6 border-t border-slate-800/80">
            <h4 
              onClick={() => setShowPasswordFields(!showPasswordFields)}
              className="text-sm font-bold text-slate-100 flex items-center gap-2 cursor-pointer hover:text-blue-400 transition-colors select-none w-fit"
            >
              <Lock className="h-4 w-4 text-blue-500" />
              Change Password?
            </h4>
            <div 
              className={`transition-all duration-300 ease-in-out ${
                showPasswordFields 
                  ? 'max-h-[300px] opacity-100 mt-4 overflow-visible' 
                  : 'max-h-0 opacity-0 mt-0 overflow-hidden pointer-events-none'
              }`}
            >
              <form onSubmit={handleUpdatePassword} className="space-y-3 pt-1">
                <div>
                  <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider">New Password</label>
                  <input
                    type="password"
                    placeholder="Enter new password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 bg-slate-955 border border-slate-850 rounded-lg text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider">Confirm New Password</label>
                  <input
                    type="password"
                    placeholder="Confirm new password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 bg-slate-955 border border-slate-850 rounded-lg text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-100"
                  />
                </div>
                <button
                  type="submit"
                  disabled={passwordSubmitting}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-lg shadow-sm text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 cursor-pointer disabled:opacity-50 transition-all items-center gap-1.5"
                >
                  {passwordSubmitting && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                  {passwordSubmitting ? 'Updating...' : 'Update Password'}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </>
  );

  return (
    <div
      className={`fixed inset-0 z-50 ${showProfileSettingsModal ? '' : 'pointer-events-none'}`}
      aria-hidden={!showProfileSettingsModal}
    >
      {/* Backdrop overlay — no click-to-close */}
      <div
        className={`absolute inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity duration-300 ease-in-out ${
          showProfileSettingsModal ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Left drawer (Self edit) */}
      <div
        className={`absolute top-0 left-0 h-full w-full max-w-md bg-slate-900 border-r border-slate-700/50 shadow-2xl shadow-black/50 transform transition-transform duration-300 ease-in-out flex flex-col overflow-hidden ${
          !editingStaffProfileId && showProfileSettingsModal ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {drawerContent}
      </div>

      {/* Right drawer (Staff edit) */}
      <div
        className={`absolute top-0 right-0 h-full w-full max-w-md bg-slate-900 border-l border-slate-700/50 shadow-2xl shadow-black/50 transform transition-transform duration-300 ease-in-out flex flex-col overflow-hidden ${
          editingStaffProfileId && showProfileSettingsModal ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {drawerContent}
      </div>
    </div>
  );
}

// Simple Edit icon replacement to avoid extra lucide imports
function EditIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}
