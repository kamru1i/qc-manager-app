import { useCallback } from 'react';
import { Profile } from '@/types';
import { ChutiRecord } from '@/utils/offlineSync';

interface UseModalHandlersParams {
  profile: Profile | null;
  adminActiveTab: string;

  // Revision modal setters (from useChutiOperations)
  setRevisionRecord: (r: ChutiRecord | null) => void;
  setRevisionDate: (d: string) => void;
  setRevisionLeaveType: (t: string) => void;
  setRevisionAdjustment: (a: boolean) => void;
  setRevisionAdjustShortLeave: (v: boolean) => void;
  setRevisionSignInTime: (t: string) => void;
  setRevisionSignOutTime: (t: string) => void;
  setRevisionLeaveHour: (h: string) => void;
  setRevisionComment: (c: string) => void;
  setShowUserRevisionModal: (v: boolean) => void;

  // Admin edit modal setters (from useChutiOperations)
  setAdminEditRecord: (r: ChutiRecord | null) => void;
  setAdminEditDate: (d: string) => void;
  setAdminEditLeaveType: (t: string) => void;
  setAdminEditAdjustment: (a: boolean) => void;
  setAdminEditAdjustShortLeave: (v: boolean) => void;
  setAdminEditSignInTime: (t: string) => void;
  setAdminEditSignOutTime: (t: string) => void;
  setAdminEditLeaveHour: (h: string) => void;
  setAdminEditComment: (c: string) => void;
  setShowAdminEditModal: (v: boolean) => void;

  setComment: (c: string) => void;
  setAdjustShortLeave: (v: boolean) => void;
  setDate: (d: string) => void;
  setShowAddLeaveModal: (v: boolean) => void;
  setSelectedSupervisors?: (ids: string[]) => void;

  // Profile settings setters (from useAdminStaffOperations)
  setEditingStaffProfileId: (id: string | null) => void;
  setEditUsername: (u: string) => void;
  setIsCodenameEditable: (v: boolean) => void;
  setShowProfileSettingsModal: (v: boolean) => void;
  setIsEditRequestMode: (v: boolean) => void;
  setEditFullName: (n: string) => void;
  setEditWorkingHours: (h: string) => void;
  setProfileSignInTime: (t: string) => void;
  setProfileSignOutTime: (t: string) => void;
  setEditBreakTime: (t: string) => void;
  setEditJobRole: (r: string) => void;
  setEditNeedsApproval: (v: boolean) => void;
  setEditAllowReserve: (v: boolean) => void;
  setEditAllowOvertime: (v: boolean) => void;
  setEditMaxFullLeaves: (v: string) => void;
  setEditEligibleOfficeLeave: (v: boolean) => void;
  setEditEligibleGovtHoliday: (v: boolean) => void;
  setEditSupervisorIds: (ids: string[]) => void;

  // Credentials modal setters
  setCredTargetUserId: (id: string) => void;
  setCredNewUsername: (u: string) => void;
  setCredNewPassword: (p: string) => void;
  setShowCredentialsModal: (v: boolean) => void;

  // Delete user modal setters
  setDeleteTargetUser: (s: Profile | null) => void;
  setShowDeleteUserModal: (v: boolean) => void;

  // Notification modal
  setShowUserNotificationsModal: (v: boolean) => void;
  setShowLeaveApprovalModal: (v: boolean) => void;
  setShowSupervisorApprovalModal: (v: boolean) => void;
  setLastViewedTime: (t: string) => void;
  unreadUserNotificationsCount: number;

}

export function useModalHandlers({
  profile,
  adminActiveTab,
  setRevisionRecord,
  setRevisionDate,
  setRevisionLeaveType,
  setRevisionAdjustment,
  setRevisionAdjustShortLeave,
  setRevisionSignInTime,
  setRevisionSignOutTime,
  setRevisionLeaveHour,
  setRevisionComment,
  setShowUserRevisionModal,
  setAdminEditRecord,
  setAdminEditDate,
  setAdminEditLeaveType,
  setAdminEditAdjustment,
  setAdminEditAdjustShortLeave,
  setAdminEditSignInTime,
  setAdminEditSignOutTime,
  setAdminEditLeaveHour,
  setAdminEditComment,
  setShowAdminEditModal,
  setComment,
  setAdjustShortLeave,
  setDate,
  setShowAddLeaveModal,
  setSelectedSupervisors,
  setEditingStaffProfileId,
  setEditUsername,
  setIsCodenameEditable,
  setShowProfileSettingsModal,
  setIsEditRequestMode,
  setEditFullName,
  setEditWorkingHours,
  setProfileSignInTime,
  setProfileSignOutTime,
  setEditBreakTime,
  setEditJobRole,
  setEditNeedsApproval,
  setEditAllowReserve,
  setEditAllowOvertime,
  setEditMaxFullLeaves,
  setEditEligibleOfficeLeave,
  setEditEligibleGovtHoliday,
  setEditSupervisorIds,
  setCredTargetUserId,
  setCredNewUsername,
  setCredNewPassword,
  setShowCredentialsModal,
  setDeleteTargetUser,
  setShowDeleteUserModal,
  setShowUserNotificationsModal,
  setShowLeaveApprovalModal,
  setShowSupervisorApprovalModal,
  setLastViewedTime,
  unreadUserNotificationsCount,
}: UseModalHandlersParams) {

  // Open "Add Leave" modal with default values
  const handleOpenAddLeaveModal = useCallback(() => {
    setComment('');
    setAdjustShortLeave(false);
    if (setSelectedSupervisors) {
      setSelectedSupervisors([]);
    }
    const today = new Date();
    const localDate = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
    setDate(localDate);
    setShowAddLeaveModal(true);
  }, [setComment, setAdjustShortLeave, setDate, setShowAddLeaveModal, setSelectedSupervisors]);

  // Open "User Revision" modal with record data
  const handleOpenRevisionModal = useCallback((r: ChutiRecord) => {
    setRevisionRecord(r);
    setRevisionDate(r.date);
    setRevisionLeaveType(r.leave_type);
    setRevisionAdjustment(r.adjustment);
    setRevisionAdjustShortLeave(r.adjust_short_leave === true);
    setRevisionSignInTime(r.sign_in_time ? r.sign_in_time.substring(0, 5) : '13:00');
    setRevisionSignOutTime(r.sign_out_time ? r.sign_out_time.substring(0, 5) : '22:30');
    setRevisionLeaveHour(r.leave_hour ? r.leave_hour.toString().split('.')[0].substring(0, 5) : '00:00');
    setRevisionComment('');
    setShowUserRevisionModal(true);
  }, [setRevisionRecord, setRevisionDate, setRevisionLeaveType, setRevisionAdjustment, setRevisionAdjustShortLeave, setRevisionSignInTime, setRevisionSignOutTime, setRevisionLeaveHour, setRevisionComment, setShowUserRevisionModal]);

  // Open "Admin Edit" modal with record data
  const handleOpenAdminEditModal = useCallback((r: ChutiRecord) => {
    setAdminEditRecord(r);
    setAdminEditDate(r.date);
    setAdminEditLeaveType(r.leave_type);
    setAdminEditAdjustment(r.adjustment);
    setAdminEditAdjustShortLeave(r.adjust_short_leave === true);
    setAdminEditSignInTime(r.sign_in_time ? r.sign_in_time.substring(0, 5) : '13:00');
    setAdminEditSignOutTime(r.sign_out_time ? r.sign_out_time.substring(0, 5) : '22:30');
    setAdminEditLeaveHour(r.leave_hour ? r.leave_hour.toString().split('.')[0].substring(0, 5) : '00:00');
    setAdminEditComment(r.comment || '');
    setShowAdminEditModal(true);
  }, [setAdminEditRecord, setAdminEditDate, setAdminEditLeaveType, setAdminEditAdjustment, setAdminEditAdjustShortLeave, setAdminEditSignInTime, setAdminEditSignOutTime, setAdminEditLeaveHour, setAdminEditComment, setShowAdminEditModal]);

  // Open Profile Settings for self (from Navbar)
  // Form fields are synchronized with the user's logged-in profile data to prevent stale values from editing other staff members.
  const handleOpenProfileSettingsForSelf = useCallback(() => {
    if (profile) {
      setEditUsername((profile.username || '').toUpperCase());
      setEditFullName(profile.requested_full_name || profile.full_name || '');
      setEditWorkingHours(Number(profile.requested_working_hours || profile.working_hours || 9.5).toFixed(1));
      setEditBreakTime(String(profile.requested_break_time || profile.break_time || 0));
      setEditJobRole(profile.requested_job_role || profile.job_role || '');
      setProfileSignInTime(profile.requested_default_sign_in || profile.default_sign_in || '13:00');
      setProfileSignOutTime(profile.requested_default_sign_out || profile.default_sign_out || '22:30');
      setEditMaxFullLeaves(String(profile.max_full_leaves ?? 15));
      setEditEligibleOfficeLeave(profile.eligible_office_leave !== false);
      setEditEligibleGovtHoliday(profile.eligible_govt_holiday !== false);
      setEditNeedsApproval(profile.needs_supervisor_approval !== false);
      setEditAllowReserve(profile.allow_reserve === true);
      setEditAllowOvertime(profile.allow_overtime === true);
      setEditSupervisorIds(profile.supervisor_ids || []);
      setIsEditRequestMode(false);
    }
    setEditingStaffProfileId(null);
    setIsCodenameEditable(false);
    setShowProfileSettingsModal(true);
  }, [
    profile,
    setEditingStaffProfileId,
    setEditUsername,
    setIsCodenameEditable,
    setEditFullName,
    setEditWorkingHours,
    setProfileSignInTime,
    setProfileSignOutTime,
    setEditBreakTime,
    setEditJobRole,
    setEditNeedsApproval,
    setEditAllowReserve,
    setEditAllowOvertime,
    setEditMaxFullLeaves,
    setEditEligibleOfficeLeave,
    setEditEligibleGovtHoliday,
    setEditSupervisorIds,
    setIsEditRequestMode,
    setShowProfileSettingsModal
  ]);

  // Open Profile Settings for a specific staff member (admin)
  const handleOpenProfileSettingsForStaff = useCallback((staff: Profile) => {
    setEditingStaffProfileId(staff.id);
    setEditUsername(staff.username || '');
    setIsCodenameEditable(false);
    setEditFullName(staff.full_name || '');
    setEditWorkingHours(staff.working_hours ? Number(staff.working_hours).toFixed(1) : '');
    setProfileSignInTime(staff.default_sign_in || '');
    setProfileSignOutTime(staff.default_sign_out || '');
    setEditBreakTime(staff.break_time !== null && staff.break_time !== undefined ? String(staff.break_time) : '');
    setEditJobRole(staff.job_role || '');
    setEditNeedsApproval(staff.needs_supervisor_approval !== false);
    setEditAllowReserve(staff.allow_reserve === true);
    setEditAllowOvertime(staff.allow_overtime === true);
    setEditMaxFullLeaves(String(staff.max_full_leaves ?? 15));
    setEditEligibleOfficeLeave(staff.eligible_office_leave !== false);
    setEditEligibleGovtHoliday(staff.eligible_govt_holiday !== false);
    setEditSupervisorIds(staff.supervisor_ids || []);
    setShowProfileSettingsModal(true);
  }, [setEditingStaffProfileId, setEditUsername, setIsCodenameEditable, setEditFullName, setEditWorkingHours, setProfileSignInTime, setProfileSignOutTime, setEditBreakTime, setEditJobRole, setEditNeedsApproval, setEditAllowReserve, setEditAllowOvertime, setEditMaxFullLeaves, setEditEligibleOfficeLeave, setEditEligibleGovtHoliday, setEditSupervisorIds, setShowProfileSettingsModal]);

  // Open Credentials modal
  const handleOpenCredentialsModal = useCallback((userId: string, username: string) => {
    setCredTargetUserId(userId);
    setCredNewUsername(username);
    setCredNewPassword('');
    setShowCredentialsModal(true);
  }, [setCredTargetUserId, setCredNewUsername, setCredNewPassword, setShowCredentialsModal]);

  // Open Delete User modal
  const handleOpenDeleteUserModal = useCallback((staff: Profile) => {
    setDeleteTargetUser(staff);
    setShowDeleteUserModal(true);
  }, [setDeleteTargetUser, setShowDeleteUserModal]);

  // Open Notifications (with time tracking)
  const handleOpenNotifications = useCallback(() => {
    setShowUserNotificationsModal(true);
    const now = new Date().toISOString();
    localStorage.setItem('last_viewed_notifications_time', now);
    setLastViewedTime(now);
  }, [setShowUserNotificationsModal, setLastViewedTime]);

  // Notification bell click (role-aware routing)
  const handleNotificationClick = useCallback(() => {
    if (!profile) return;
    const isAdmin = profile.role === 'admin';
    if (isAdmin) {
      const mode = sessionStorage.getItem('adminNotificationMode') || 'user';
      if (mode === 'admin') {
        setShowLeaveApprovalModal(true);
      } else {
        handleOpenNotifications();
      }
    } else if (profile.role === 'supervisor') {
      if (unreadUserNotificationsCount > 0) {
        handleOpenNotifications();
      } else {
        setShowSupervisorApprovalModal(true);
      }
    } else {
      handleOpenNotifications();
    }
  }, [profile, unreadUserNotificationsCount, setShowLeaveApprovalModal, setShowSupervisorApprovalModal, handleOpenNotifications]);

  // Reset filters
  const handleResetFilters = useCallback((
    setFilterType: (v: string) => void,
    setFilterStartDate: (v: string) => void,
    setFilterEndDate: (v: string) => void
  ) => {
    setFilterType('all');
    setFilterStartDate('');
    setFilterEndDate('');
  }, []);

  return {
    handleOpenAddLeaveModal,
    handleOpenRevisionModal,
    handleOpenAdminEditModal,
    handleOpenProfileSettingsForSelf,
    handleOpenProfileSettingsForStaff,
    handleOpenCredentialsModal,
    handleOpenDeleteUserModal,
    handleOpenNotifications,
    handleNotificationClick,
    handleResetFilters,
  };
}
