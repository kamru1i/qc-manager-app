'use client';

import { useState, useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { UnifiedSidebar } from '@/components/UnifiedSidebar';
import { UserDashboardView } from '@/components/UserDashboardView';
import { AdminDashboardView } from '@/components/AdminDashboardView';
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

export default function Dashboard() {
  const router = useRouter();

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
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  useEffect(() => {
    const savedSidebarState = localStorage.getItem('quotes_sales_sidebar_collapsed');
    if (savedSidebarState === 'true' || savedSidebarState === 'false') {
      setIsSidebarCollapsed(savedSidebarState === 'true');
    }
  }, []);

  const handleSidebarToggle = () => {
    setIsSidebarCollapsed((current) => {
      const next = !current;
      localStorage.setItem('quotes_sales_sidebar_collapsed', String(next));
      return next;
    });
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

  if (!sessionUser && !loading) {
    return <LoginPage />;
  }

  if (sessionUser && !profile) {
    return (
      <div className="flex-1 min-h-screen flex flex-col bg-slate-955 items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-slate-400">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
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
          <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-orange-600/10 blur-[120px] pointer-events-none" />
          <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-amber-600/10 blur-[120px] pointer-events-none" />
          
          <Toaster
            position="top-center"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#0f172a',
                color: '#cbd5e1',
                border: '1px solid #1e293b',
                fontSize: '12px',
                borderRadius: '12px',
                fontFamily: 'sans-serif',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
              },
            }}
          />

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
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
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
            <div className="absolute top-[-20%] right-[-20%] w-[50%] h-[50%] rounded-full bg-orange-900/10 blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-20%] left-[-20%] w-[50%] h-[50%] rounded-full bg-orange-900/10 blur-[120px] pointer-events-none" />

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
          <div className="absolute top-[-20%] right-[-20%] w-[50%] h-[50%] rounded-full bg-orange-900/10 blur-[120px] pointer-events-none" />
          <div className="absolute bottom-[-20%] left-[-20%] w-[50%] h-[50%] rounded-full bg-orange-900/10 blur-[120px] pointer-events-none" />

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
        <div className="absolute top-[-20%] right-[-20%] w-[50%] h-[50%] rounded-full bg-orange-900/10 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-20%] left-[-20%] w-[50%] h-[50%] rounded-full bg-orange-900/10 blur-[120px] pointer-events-none" />

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
      <div className="flex-1 min-h-screen flex flex-col bg-slate-955 relative overflow-hidden pb-12">
        {/* Glow backgrounds */}
        <div className="absolute top-[-20%] right-[-20%] w-[50%] h-[50%] rounded-full bg-orange-900/10 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-20%] left-[-20%] w-[50%] h-[50%] rounded-full bg-orange-900/10 blur-[120px] pointer-events-none" />

        {/* 1. Header Bar */}
      <Navbar
        profile={profile}
        isOnline={isOnline}
        offlineCount={offlineCount}
        theme={theme}
        onThemeToggle={toggleTheme}
        onManualSync={handleManualSync}
        onLogout={handleLogout}
        onProfileSettingsClick={handleOpenProfileSettingsForSelf}
        onNotificationClick={handleNotificationClick}
        unreadUserNotificationsCount={unreadUserNotificationsCount}
        groupedSupervisorRequestsCount={groupedSupervisorRequests.length}
        groupedChutiRequestsCount={groupedChutiRequests.length}
        pendingReserveRequestsCount={pendingReserveRequests.length}
        pendingProfileRequestsCount={pendingProfileRequests.length}
        adminActiveTab={adminActiveTab}
        adminHolidayNotificationsCount={adminHolidayNotifications.length}
        pendingPasswordResetRequestsCount={pendingPasswordResetRequests.length}
      />

      {/* Alert Messages */}
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#0f172a',
            color: '#cbd5e1',
            border: '1px solid #1e293b',
            fontSize: '12px',
            borderRadius: '12px',
            fontFamily: 'sans-serif',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
          },
          success: {
            iconTheme: {
              primary: '#10b981',
              secondary: '#0f172a',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#0f172a',
            },
          },
        }}
      />

      {/* 2. Main Content Body */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 w-full z-10 flex-1 flex flex-col md:flex-row gap-6 items-start">
        <UnifiedSidebar
          activeSection="chuti"
          profile={profile}
          isSidebarCollapsed={isSidebarCollapsed}
          onSidebarToggle={handleSidebarToggle}
        />
        <section className="flex-1 min-w-0 w-full bg-slate-900/50 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6 shadow-xl min-h-125">
        
        {/* ================= STAFF VIEW ================= */}
        {profile?.has_changed_password !== false && !!profile?.is_setup_completed && (profile?.role !== 'admin' || adminActiveTab === 'user') && (
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
            onAddLeaveClick={handleOpenAddLeaveModal}
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

        {/* ================= ADMIN VIEW ================= */}
        {profile?.has_changed_password !== false && !!profile?.is_setup_completed && profile?.role === 'admin' && adminActiveTab === 'admin' && (
          <AdminDashboardView
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
            onAddLeaveClick={() => setShowAdminAddLeaveModal(true)}
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

        </section>
      </main>
      
      <DashboardModals />
      </div>
    </DashboardProvider>
  );
}
