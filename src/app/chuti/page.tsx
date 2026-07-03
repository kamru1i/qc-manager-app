'use client';

import { useState, useEffect } from 'react';

import { createPortal } from 'react-dom';
import { useRouter, usePathname } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { UnifiedSidebar } from '@/components/UnifiedSidebar';
import { UserDashboardView } from '@/components/UserDashboardView';
import { AdminDashboardView } from '@/components/AdminDashboardView';
import { AddLeaveInline } from '@/components/AddLeaveInline';
import { AdminLeaveSettings } from '@/components/AdminLeaveSettings';
import { SkeletonLoader } from '@/components/SkeletonLoader';
import { DashboardProvider } from '@/contexts/DashboardContext';
import { DashboardModals } from '@/components/DashboardModals';
import LoginPage from '@/app/login/page';


import { useDashboardData } from '@/hooks/useDashboardData';
import { useChutiOperations } from '@/hooks/useChutiOperations';
import { useAdjustmentOperations } from '@/hooks/useAdjustmentOperations';
import { useAdminStaffOperations } from '@/hooks/useAdminStaffOperations';
import { useDerivedState } from '@/hooks/useDerivedState';
import { useExportOperations } from '@/hooks/useExportOperations';
import { useModalHandlers } from '@/hooks/useModalHandlers';
import { useDesktopNotifications } from '@/hooks/useDesktopNotifications';

interface DashboardProps {
  activeChutiTab: 'add_leave' | 'staff_master' | 'govt_responses' | 'settlement' | 'leave_settings';
  onChutiTabChange: (tab: 'add_leave' | 'staff_master' | 'govt_responses' | 'settlement' | 'leave_settings') => void;
}

export default function Dashboard({
  activeChutiTab,
  onChutiTabChange,
}: DashboardProps) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (pathname === '/chuti') {
      router.replace('/');
    }
  }, [pathname, router]);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Core Dashboard State & Real-time monitors
  const dashboardData = useDashboardData();
  const {
    sessionUser,
    profile,
    setProfile,
    isPushSubscribed,
    setIsPushSubscribed,
    isPushLoading,
    setIsPushLoading,
    loading,

    submitting,
    setSubmitting,
    isOnline,
    offlineCount,
    setMessage,
    userRecords,
    setUserRecords,
    adminRecords,
    setAdminRecords,
    profilesList,
    setProfilesList,
    adminActiveTab,
    setAdminActiveTab,
    viewingStaffId,
    setViewingStaffId,
    lastViewedTime,
    setLastViewedTime,
    theme,
    toggleTheme,
    showLeaveApprovalModal,
    setShowLeaveApprovalModal,
    showSupervisorApprovalModal,
    setShowSupervisorApprovalModal,
    showUserNotificationsModal,
    setShowUserNotificationsModal,
    approvingIds,
    setApprovingIds,
    reviewingIds,
    setReviewingIds,
    approvedIds,
    setApprovedIds,
    fetchRecords,
    checkOfflineQueue,
    handleManualSync,
    handleLogout,
    globalSettings,
    handleSaveGlobalSettings,
    holidayResponses,
    handleSaveHolidayResponse,
    handleAdminUpdateHolidayResponse,
    leaveSettlements,
    handleSaveLeaveSettlementsBulk,
    handleDeleteLeaveSettlement,
    initialFetchDone,
  } = dashboardData;

  // View Filter states
  const [filterType, setFilterType] = useState('all');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAdminAddLeaveModal, setShowAdminAddLeaveModal] = useState(false);

  const handleChutiTabChange = (tab: 'add_leave' | 'staff_master' | 'govt_responses' | 'settlement' | 'leave_settings') => {
    onChutiTabChange(tab);
    if (adminActiveTab !== 'admin' && tab !== 'add_leave' && tab !== 'leave_settings') {
      setAdminActiveTab('admin');
      if (typeof window !== 'undefined' && profile?.id) {
        localStorage.setItem('admin_mode_' + profile.id, 'admin');
      }
    }
  };

  const [selectedYear, setSelectedYear] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('selectedYear') || new Date().getFullYear().toString();
    }
    return new Date().getFullYear().toString();
  });

  // State to track dismissed notifications (persistent in localStorage, cleaned after 24 hrs)
  const [dismissedNotificationIds, setDismissedNotificationIds] = useState<Set<string>>(new Set());

  // Load and clean up old dismissed notifications
  useEffect(() => {
    try {
      const stored = localStorage.getItem('dismissed_notifications');
      if (stored) {
        const parsed = JSON.parse(stored) as Record<string, number>;
        const now = Date.now();
        const fresh: Record<string, number> = {};
        const freshIds = new Set<string>();
        
        for (const [id, timestamp] of Object.entries(parsed)) {
          if (now - timestamp < 24 * 60 * 60 * 1000) {
            fresh[id] = timestamp;
            freshIds.add(id);
          }
        }
        localStorage.setItem('dismissed_notifications', JSON.stringify(fresh));
        setDismissedNotificationIds(freshIds);
      }
    } catch (e) {
      console.error('Failed to load dismissed notifications:', e);
    }
  }, []);

  // Listen for view details events dispatched from User Management
  useEffect(() => {
    const handleTrigger = (e: Event) => {
      const customEvent = e as CustomEvent;
      setViewingStaffId(customEvent.detail);
    };
    window.addEventListener('trigger-viewing-staff', handleTrigger);
    return () => window.removeEventListener('trigger-viewing-staff', handleTrigger);
  }, [setViewingStaffId]);

  // Start Tauri Desktop Notification Listener
  useDesktopNotifications(profile?.id);

  // Derived state (filtering, grouping, notifications, stats)
  const derivedState = useDerivedState({
    sessionUser,
    profile,
    userRecords,
    adminRecords,
    profilesList,
    selectedYear,
    filterType,
    filterStartDate,
    filterEndDate,
    viewingStaffId,
    lastViewedTime,
    holidayResponses,
    globalSettings,
    loading,
    initialFetchDone,
    adminActiveTab,
    dismissedNotificationIds,
    leaveSettlements,
  });

  const {
    filteredUserRecords,
    getFilteredRecordsForUser,
    userStats,
    getUserSummaryStats,
    pendingProfileRequests,
    pendingPasswordResetRequests,
    pendingReserveRequests,
    groupedSupervisorRequests,
    groupedChutiRequests,
    userNotificationsList,
    unreadUserNotificationsCount,
    adminHolidayNotifications,
    staffProfile,
    individualRecords,
    staffStats,
    availableYears,
  } = derivedState;

  // Dismiss currently visible notifications from the panel
  const handleDismissNotifications = (type: 'user' | 'admin') => {
    const listToDismiss = type === 'user' ? userNotificationsList : adminHolidayNotifications;
    if (!listToDismiss || listToDismiss.length === 0) return;
    
    try {
      const stored = localStorage.getItem('dismissed_notifications');
      const current = stored ? JSON.parse(stored) as Record<string, number> : {};
      const now = Date.now();
      
      const newIds = new Set(dismissedNotificationIds);
      listToDismiss.forEach((n: any) => {
        current[n.id] = now;
        newIds.add(n.id);
      });
      
      localStorage.setItem('dismissed_notifications', JSON.stringify(current));
      setDismissedNotificationIds(newIds);
    } catch (e) {
      console.error('Failed to dismiss notifications:', e);
    }
  };

  // Leave operations controller
  const chutiOps = useChutiOperations({
    sessionUser,
    profile,
    isOnline,
    fetchRecords,
    checkOfflineQueue,
    userRecords,
    setUserRecords,
    adminRecords,
    setAdminRecords,
    setMessage,
    setSubmitting,
    profilesList,
    approvingIds,
    setApprovingIds,
    reviewingIds,
    setReviewingIds,
    approvedIds,
    setApprovedIds,
    globalSettings,
  });

  const {
    // Add Leave
    showAddLeaveModal,
    setShowAddLeaveModal,
    date,
    setDate,
    leaveType,
    setLeaveType,
    adjustment,
    setAdjustment,
    adjustmentCategory,
    setAdjustmentCategory,
    adjustShortLeave,
    setAdjustShortLeave,
    signInTime,
    setSignInTime,
    signOutTime,
    setSignOutTime,
    leaveHour,
    setLeaveHour,
    comment,
    setComment,
    selectedSupervisors,
    setSelectedSupervisors,
    bulkDates,
    bulkAdjustments,
    handleAddBulkDate,
    handleUpdateBulkDate,
    handleUpdateBulkAdjustment,
    handleRemoveBulkDate,
    handleSubmit,

    // Delete
    showDeleteModal,
    setShowDeleteModal,
    recordToDelete,
    setRecordToDelete,
    deletingRecord,
    triggerDeleteRecord,
    handleConfirmDelete,

    // User Revision
    showUserRevisionModal,
    setShowUserRevisionModal,
    revisionRecord,
    setRevisionRecord,
    revisionDate,
    setRevisionDate,
    revisionLeaveType,
    setRevisionLeaveType,
    revisionAdjustment,
    setRevisionAdjustment,
    revisionAdjustShortLeave,
    setRevisionAdjustShortLeave,
    revisionSignInTime,
    setRevisionSignInTime,
    revisionSignOutTime,
    setRevisionSignOutTime,
    revisionLeaveHour,
    setRevisionLeaveHour,
    revisionComment,
    setRevisionComment,
    handleUserSubmitRevision,

    // Admin Edit
    showAdminEditModal,
    setShowAdminEditModal,
    adminEditRecord,
    adminEditDate,
    setAdminEditDate,
    adminEditLeaveType,
    setAdminEditLeaveType,
    adminEditSignInTime,
    setAdminEditSignInTime,
    adminEditSignOutTime,
    setAdminEditSignOutTime,
    adminEditLeaveHour,
    setAdminEditLeaveHour,
    adminEditAdjustment,
    setAdminEditAdjustment,
    adminEditAdjustShortLeave,
    setAdminEditAdjustShortLeave,
    adminEditComment,
    setAdminEditComment,
    handleAdminSaveEdit,

    // Approvals
    handleSupervisorApproveChuti,
    handleApproveChutiRequest,

    // Revision prompt
    showRevisionPromptModal,
    setShowRevisionPromptModal,
    submittingRevision,
    setRevisionPromptChutiId,
    revisionPromptText,
    setRevisionPromptText,
    submitRevisionWithReason,
  } = chutiOps;

  // Adjustment operations controller
  const adjustmentOps = useAdjustmentOperations({
    profile,
    adminActiveTab,
    isOnline,
    fetchRecords,
    setUserRecords,
    setAdminRecords,
    setMessage,
    submitting,
    setSubmitting,
    setApprovingIds,
    setApprovedIds,
  });

  const {
    showAdjustmentModal,
    setShowAdjustmentModal,
    adjustmentRecord,
    setAdjustmentRecord,
    adjustmentType,
    setAdjustmentType,
    partialAdjustmentTime,
    setPartialAdjustmentTime,
    setAdjustShortLeaveOption,
    showCancelAdjustmentModal,
    setShowCancelAdjustmentModal,
    cancelAdjustmentRecord,
    setCancelAdjustmentRecord,
    handleToggleAdjustmentClick,
    handleConfirmCancelAdjustment,
    handleSaveAdjustment,
    handleApproveReserveAdjustment,
  } = adjustmentOps;

  // Admin & Staff operations controller
  const adminStaffOps = useAdminStaffOperations({
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
  });

  const {
    showWelcomePopup,
    setShowWelcomePopup,
    showFirstTimePasswordModal,
    showOnboardingModal,
    firstTimePassword,
    setFirstTimePassword,
    firstTimeConfirmPassword,
    setFirstTimeConfirmPassword,
    firstTimePasswordSubmitting,
    firstTimePasswordError,

    handleFirstTimeSetupSubmit,

    setupFullName,
    setSetupFullName,
    setupUsername,
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
    handleSetupSubmit,

    showCreateUserModal,
    setShowCreateUserModal,
    setNewStaffPassword,
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
    handleCreateNewUser,

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
    handleUpdateCredentials,

    showDeleteUserModal,
    setShowDeleteUserModal,
    deleteTargetUser,
    setDeleteTargetUser,
    deletingUser,
    handleDeleteUser,

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
    isEditRequestMode,
    setIsEditRequestMode,
    setEditMaxFullLeaves,
    newStaffEligibleOfficeLeave,
    setNewStaffEligibleOfficeLeave,
    newStaffEligibleGovtHoliday,
    setNewStaffEligibleGovtHoliday,

    handleUpdateSettings,
    handleApproveProfileChangeRequest,
    handleApprovePasswordResetRequest,
    handleConvertShortLeaveToFullLeave,
    newStaffSupervisorIds,
    setNewStaffSupervisorIds,
    editSupervisorIds,
    setEditSupervisorIds,
  } = adminStaffOps;

  // Export operations
  const exportOps = useExportOperations({
    profilesList,
    sessionUser,
    profile,
    selectedYear,
    filterType,
    filterStartDate,
    filterEndDate,
    searchQuery,
    setMessage,
    getFilteredRecordsForUser,
    getUserSummaryStats,
  });

  const {
    handleExportIndividualExcel,
    handleExportIndividualPDF,
    handleExportSummaryExcel,
    handleExportSummaryPDF,
    handleExportHolidayResponsesExcel,
    handleExportHolidayResponsesPDF,
  } = exportOps;

  // Modal open/close handlers
  const modalHandlers = useModalHandlers({
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
    setAdminEditRecord: chutiOps.setAdminEditRecord,
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
    setEditEligibleOfficeLeave,
    setEditEligibleGovtHoliday,
    setEditMaxFullLeaves,
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
  });

  const {
    handleOpenAddLeaveModal,
    handleOpenRevisionModal,
    handleOpenAdminEditModal,
    handleOpenProfileSettingsForSelf,
    handleOpenProfileSettingsForStaff,
    handleOpenCredentialsModal,
    handleOpenDeleteUserModal,
    handleNotificationClick,
    handleResetFilters,
  } = modalHandlers;

  const contextValue = {
    dashboardData,
    derivedState,
    chutiOps: {
      ...chutiOps,
      showAdminAddLeaveModal,
      setShowAdminAddLeaveModal
    },
    adjustmentOps,
    adminStaffOps,
    exportOps,
    modalHandlers
  };

  // Redirect to login if unauthenticated
  useEffect(() => {
    if (!sessionUser && !loading) {
      router.replace('/login');
    }
  }, [sessionUser, loading, router]);

  // Synchronize notification counts and full list to root page
  useEffect(() => {
    let count = 0;
    if (profile) {
      if (profile.role === 'supervisor') {
        count = groupedSupervisorRequests.length + unreadUserNotificationsCount;
      } else if (profile.role === 'admin') {
        count = unreadUserNotificationsCount;
      } else {
        count = unreadUserNotificationsCount;
      }
    }
    window.dispatchEvent(new CustomEvent('chuti-notification-count-change', { detail: count }));
  }, [
    profile,
    groupedSupervisorRequests,
    unreadUserNotificationsCount,
    groupedChutiRequests,
    pendingReserveRequests,
    pendingProfileRequests,
    pendingPasswordResetRequests,
    adminHolidayNotifications
  ]);

  // Sync the full notifications list to root page for the global unified modal
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('chuti-notification-list-sync', { detail: userNotificationsList }));
  }, [userNotificationsList]);

  // Synchronize offline count to root page
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('chuti-offline-count-change', { detail: offlineCount }));
  }, [offlineCount]);

  // Handle events from unified root Navbar and global modals
  useEffect(() => {
    const handleOpenProfileSettings = () => {
      handleOpenProfileSettingsForSelf();
    };
    const handleTriggerSync = () => {
      handleManualSync();
    };
    const handleOpenRevisionModal = (e: Event) => {
      const r = (e as CustomEvent).detail;
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
    };
    // Approval action handlers dispatched from unified notification modal
    const handleApproveChutiEvent = (e: Event) => {
      const { id, approve } = (e as CustomEvent).detail;
      handleApproveChutiRequest(id, approve);
    };
    const handleApproveReserveEvent = (e: Event) => {
      const { record, approve } = (e as CustomEvent).detail;
      handleApproveReserveAdjustment(record, approve);
    };
    const handleApproveProfileEvent = (e: Event) => {
      const { id, approve } = (e as CustomEvent).detail;
      handleApproveProfileChangeRequest(id, approve);
    };
    const handleApprovePasswordEvent = (e: Event) => {
      const { id, approve } = (e as CustomEvent).detail;
      handleApprovePasswordResetRequest(id, approve);
    };
    const handleSupervisorApproveEvent = (e: Event) => {
      const { id, approve } = (e as CustomEvent).detail;
      handleSupervisorApproveChuti(id, approve);
    };

    window.addEventListener('open-profile-settings', handleOpenProfileSettings);
    window.addEventListener('trigger-manual-sync', handleTriggerSync);
    window.addEventListener('open-revision-modal', handleOpenRevisionModal);
    window.addEventListener('approve-chuti-request', handleApproveChutiEvent);
    window.addEventListener('approve-reserve-adjustment', handleApproveReserveEvent);
    window.addEventListener('approve-profile-change', handleApproveProfileEvent);
    window.addEventListener('approve-password-reset', handleApprovePasswordEvent);
    window.addEventListener('supervisor-approve-chuti', handleSupervisorApproveEvent);

    return () => {
      window.removeEventListener('open-profile-settings', handleOpenProfileSettings);
      window.removeEventListener('trigger-manual-sync', handleTriggerSync);
      window.removeEventListener('open-revision-modal', handleOpenRevisionModal);
      window.removeEventListener('approve-chuti-request', handleApproveChutiEvent);
      window.removeEventListener('approve-reserve-adjustment', handleApproveReserveEvent);
      window.removeEventListener('approve-profile-change', handleApproveProfileEvent);
      window.removeEventListener('approve-password-reset', handleApprovePasswordEvent);
      window.removeEventListener('supervisor-approve-chuti', handleSupervisorApproveEvent);
    };
  }, [
    handleOpenProfileSettingsForSelf,
    handleManualSync,
    profile,
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
    handleApproveChutiRequest,
    handleApproveReserveAdjustment,
    handleApproveProfileChangeRequest,
    handleApprovePasswordResetRequest,
    handleSupervisorApproveChuti,
  ]);

  if (!sessionUser && !loading) {
    return (
      <div className="flex-1 min-h-screen flex flex-col bg-slate-955 items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-slate-400">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          <p className="text-sm font-medium tracking-wide">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  if (sessionUser && !profile) {
    return (
      <div className="flex-1 min-h-screen flex flex-col bg-slate-955 items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-slate-400">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          <p className="text-sm font-medium tracking-wide">Loading...</p>
        </div>
      </div>
    );
  }

  if (profile && (profile.has_changed_password === false || !profile.is_setup_completed)) {
    return (
      <DashboardProvider value={contextValue}>
        <div className="flex-1 min-h-screen flex flex-col bg-slate-955 relative overflow-hidden justify-center items-center py-12 px-4 sm:px-6 lg:px-8">
          {/* Background gradients */}
          <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-blue-600/10 blur-[120px] pointer-events-none" />
          <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-purple-600/10 blur-[120px] pointer-events-none" />

          <DashboardModals />
        </div>
      </DashboardProvider>
    );
  }

  if (loading && !initialFetchDone) {
    if (!sessionUser) {
      return (
        <div className="flex-1 min-h-screen flex flex-col bg-slate-955 items-center justify-center">
          <div className="flex flex-col items-center gap-4 text-slate-400">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            <p className="text-sm font-medium tracking-wide">Loading...</p>
          </div>
        </div>
      );
    }

    if (profile && profile.role === 'admin') {
      if (viewingStaffId) {
        return (
          <div className="flex-1 min-h-screen flex flex-col bg-slate-955 relative overflow-hidden pb-12">
            {/* Glow backgrounds */}
            <div className="absolute top-[-20%] right-[-20%] w-[50%] h-[50%] rounded-full bg-blue-900/10 blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-20%] left-[-20%] w-[50%] h-[50%] rounded-full bg-blue-900/10 blur-[120px] pointer-events-none" />

            {/* Placeholder Navbar */}
            <div className="w-full bg-slate-900/40 backdrop-blur-xl border-b border-slate-850 px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center animate-pulse">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 bg-slate-800 rounded-xl"></div>
                <div className="h-4 w-32 bg-slate-800 rounded"></div>
              </div>
              <div className="flex items-center gap-4">
                <div className="h-8 w-8 bg-slate-800 rounded-full"></div>
              </div>
            </div>

            {/* Placeholder Main Content Area for Staff Details */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 w-full flex-1 flex flex-col gap-6">
              {/* Mock Profile Header */}
              <SkeletonLoader variant="profile-header" />

              {/* Mock Stats Grid */}
              <SkeletonLoader variant="stats" cards={4} />

              {/* Mock Records Table */}
              <SkeletonLoader variant="leaves-table" rows={5} />
            </main>
          </div>
        );
      }

      return (
        <div className="flex-1 min-h-screen flex flex-col bg-slate-955 relative overflow-hidden pb-12">
          {/* Glow backgrounds */}
          <div className="absolute top-[-20%] right-[-20%] w-[50%] h-[50%] rounded-full bg-blue-900/10 blur-[120px] pointer-events-none" />
          <div className="absolute bottom-[-20%] left-[-20%] w-[50%] h-[50%] rounded-full bg-blue-900/10 blur-[120px] pointer-events-none" />

          {/* Placeholder Navbar */}
          <div className="w-full bg-slate-900/40 backdrop-blur-xl border-b border-slate-850 px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center animate-pulse">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 bg-slate-800 rounded-xl"></div>
              <div className="h-4 w-32 bg-slate-800 rounded"></div>
            </div>
            <div className="flex items-center gap-4">
              <div className="h-8 w-8 bg-slate-800 rounded-full"></div>
            </div>
          </div>

          {/* Placeholder Main Content Area */}
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 w-full flex-1 flex flex-col gap-6">
            {/* Mock Stats Grid */}
            <SkeletonLoader variant="stats" cards={3} />

            {/* Mock Records Table */}
            <SkeletonLoader variant="staff-table" rows={6} />
          </main>
        </div>
      );
    }

    return (
      <div className="flex-1 min-h-screen flex flex-col bg-slate-955 relative overflow-hidden pb-12">
        {/* Glow backgrounds */}
        <div className="absolute top-[-20%] right-[-20%] w-[50%] h-[50%] rounded-full bg-blue-900/10 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-20%] left-[-20%] w-[50%] h-[50%] rounded-full bg-blue-900/10 blur-[120px] pointer-events-none" />

        {/* Placeholder Navbar */}
        <div className="w-full bg-slate-900/40 backdrop-blur-xl border-b border-slate-850 px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center animate-pulse">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 bg-slate-800 rounded-xl"></div>
            <div className="h-4 w-32 bg-slate-800 rounded"></div>
          </div>
          <div className="flex items-center gap-4">
            <div className="h-8 w-8 bg-slate-800 rounded-full"></div>
          </div>
        </div>

        {/* Placeholder Main Content Area */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 w-full flex-1 flex flex-col gap-6">
          <SkeletonLoader variant="profile-header" />
          <SkeletonLoader variant="stats" cards={4} />
          <SkeletonLoader variant="leaves-table" rows={5} />
        </main>
      </div>
    );
  }


  return (
    <DashboardProvider value={contextValue}>


        
        {/* ================= ADD LEAVE INLINE VIEW ================= */}
        {profile?.has_changed_password !== false && !!profile?.is_setup_completed && activeChutiTab === 'add_leave' && (
          <AddLeaveInline
            profile={profile}
            profilesList={profilesList}
            records={profile?.role === 'admin' ? adminRecords : userRecords}
            globalSettings={globalSettings}
            leaveSettlements={leaveSettlements}
            onSuccess={fetchRecords}
            onConvertShortLeaveToFullLeave={handleConvertShortLeaveToFullLeave}
            holidayResponses={holidayResponses}
            initialFetchDone={initialFetchDone}
          />
        )}

        {/* ================= LEAVE SETTINGS INLINE VIEW ================= */}
        {profile?.has_changed_password !== false && !!profile?.is_setup_completed && profile?.role === 'admin' && activeChutiTab === 'leave_settings' && (
          <AdminLeaveSettings
            globalSettings={globalSettings}
            onSaveGlobalSettings={handleSaveGlobalSettings}
            initialFetchDone={initialFetchDone}
          />
        )}

        {/* ================= USER'S OWN LEAVE VIEW (Everyone) ================= */}
        {profile?.has_changed_password !== false && !!profile?.is_setup_completed && activeChutiTab !== 'add_leave' && activeChutiTab !== 'leave_settings' && (
          <UserDashboardView
            profile={profile}
            userStats={userStats}
            globalSettings={globalSettings}
            filteredUserRecords={filteredUserRecords}
            userRecords={userRecords}
            selectedYear={selectedYear}
            setSelectedYear={(val) => {
              setSelectedYear(val);
              sessionStorage.setItem('selectedYear', val);
            }}
            availableYears={availableYears}
            filterType={filterType}
            setFilterType={setFilterType}
            filterStartDate={filterStartDate}
            setFilterStartDate={setFilterStartDate}
            filterEndDate={filterEndDate}
            setFilterEndDate={setFilterEndDate}
            onResetFilters={() => handleResetFilters(setFilterType, setFilterStartDate, setFilterEndDate)}
            onExportExcel={(filtered, term) => handleExportIndividualExcel(sessionUser?.id || '', filtered, term)}
            onExportPDF={(filtered, term) => handleExportIndividualPDF(sessionUser?.id || '', filtered, term)}
            onAddLeaveClick={() => {
              onChutiTabChange('add_leave');
            }}
            onToggleAdjustment={handleToggleAdjustmentClick}
            onDeleteClick={triggerDeleteRecord}
            onRevisionClick={handleOpenRevisionModal}
            onConvertShortLeaveToFullLeave={handleConvertShortLeaveToFullLeave}
            holidayResponses={holidayResponses}
            onSaveHolidayResponse={handleSaveHolidayResponse}
            initialFetchDone={initialFetchDone}
            leaveSettlements={leaveSettlements}
            onSaveLeaveSettlementsBulk={handleSaveLeaveSettlementsBulk}
          />
        )}

        {/* ================= ADMIN STAFF VIEW (Below user's own view) ================= */}
        {profile?.has_changed_password !== false && !!profile?.is_setup_completed && profile?.role === 'admin' && activeChutiTab !== 'add_leave' && activeChutiTab !== 'leave_settings' && (
          <AdminDashboardView
            activeTab={activeChutiTab}
            setActiveTab={handleChutiTabChange}
            profilesList={profilesList}
            viewingStaffId={viewingStaffId}
            setViewingStaffId={setViewingStaffId}
            staffProfile={staffProfile}
            individualRecords={individualRecords}
            unfilteredStaffRecords={viewingStaffId ? adminRecords.filter(r => r.user_id === viewingStaffId) : []}
            staffStats={staffStats}
            filterType={filterType}
            setFilterType={setFilterType}
            filterStartDate={filterStartDate}
            setFilterStartDate={setFilterStartDate}
            filterEndDate={filterEndDate}
            setFilterEndDate={setFilterEndDate}
            onResetFilters={() => handleResetFilters(setFilterType, setFilterStartDate, setFilterEndDate)}
            onExportIndividualExcel={(filtered, term) => handleExportIndividualExcel(viewingStaffId || '', filtered, term)}
            onExportIndividualPDF={(filtered, term) => handleExportIndividualPDF(viewingStaffId || '', filtered, term)}
            onToggleAdjustment={handleToggleAdjustmentClick}
            onEditClick={handleOpenAdminEditModal}
            onDeleteClick={triggerDeleteRecord}
            selectedYear={selectedYear}
            setSelectedYear={(val) => {
              setSelectedYear(val);
              sessionStorage.setItem('selectedYear', val);
            }}
            availableYears={availableYears}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            getUserSummaryStats={getUserSummaryStats}
            onChangePasswordClick={handleOpenCredentialsModal}
            onEditProfileClick={handleOpenProfileSettingsForStaff}
            onDeleteUserClick={handleOpenDeleteUserModal}
            onAddStaffClick={() => setShowCreateUserModal(true)}
            onExportSummaryExcel={handleExportSummaryExcel}
            onExportSummaryPDF={handleExportSummaryPDF}
            onAddLeaveClick={() => {
              if (viewingStaffId) {
                sessionStorage.setItem('addLeaveTargetUserId', viewingStaffId);
              }
              onChutiTabChange('add_leave');
            }}
            globalSettings={globalSettings}
            onSaveGlobalSettings={handleSaveGlobalSettings}
            onConvertShortLeaveToFullLeave={handleConvertShortLeaveToFullLeave}
            holidayResponses={holidayResponses}
            onExportHolidayResponsesExcel={handleExportHolidayResponsesExcel}
            onExportHolidayResponsesPDF={handleExportHolidayResponsesPDF}
            onUpdateHolidayResponse={handleAdminUpdateHolidayResponse}
            leaveSettlements={leaveSettlements}
            onSaveLeaveSettlementsBulk={handleSaveLeaveSettlementsBulk}
            onDeleteSettlement={handleDeleteLeaveSettlement}
            adminRecords={adminRecords}
            currentUserProfile={profile}
            initialFetchDone={initialFetchDone}
          />
        )}

      <DashboardModals />
    </DashboardProvider>
  );
}
