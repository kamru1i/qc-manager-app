'use client';

import { useState, useEffect, Suspense, useCallback } from 'react';
import { useAppEventBus, useAppEvent } from '@/contexts/AppEventBusContext';

import { useRouter, usePathname } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { UserDashboardView } from '@/components/leave-tracker/UserDashboardView';
import { AdminDashboardView } from '@/components/leave-tracker/AdminDashboardView';
import { AddLeave } from '@/components/leave-tracker/AddLeave';
import { AdminLeaveSettings } from '@/components/leave-tracker/AdminLeaveSettings';
import { TeamLeaveRecords } from '@/components/leave-tracker/TeamLeaveRecords';
import { DashboardModals } from '@/components/leave-tracker/DashboardModals';
import { SkeletonLoader } from '@/components/common/SkeletonLoader';
import { DashboardProvider } from '@/contexts/DashboardContext';
import { ChutiRecord } from '@/utils/offlineSync';

import { useDashboardData } from '@/hooks/leave-tracker/useDashboardData';
import { useChutiOperations } from '@/hooks/leave-tracker/useChutiOperations';
import { useAdjustmentOperations } from '@/hooks/leave-tracker/useAdjustmentOperations';
import { useAdminStaffOperations } from '@/hooks/leave-tracker/useAdminStaffOperations';
import { useDerivedState } from '@/hooks/leave-tracker/useDerivedState';
import { useExportOperations } from '@/hooks/leave-tracker/useExportOperations';
import { useModalHandlers } from '@/hooks/leave-tracker/useModalHandlers';
import { supabase } from '@/utils/supabase';
import { useRealtimeHandler } from '@/contexts/RealtimeContext';
import { isAdminRole } from '@/utils/permissionService';


interface DashboardProps {
  activeChutiTab: 'add_leave' | 'leave_history' | 'settlement' | 'leave_settings' | 'team_leaves';
  onChutiTabChange: (tab: 'add_leave' | 'leave_history' | 'settlement' | 'leave_settings' | 'team_leaves') => void;
  /** R2: Callback to share data upward so useGlobalNotifications doesn't duplicate fetches */
  onDataReady?: (data: { userRecords: any[]; holidayResponses: any[]; initialFetchDone?: boolean }) => void;
}

export default function Dashboard({
  activeChutiTab,
  onChutiTabChange,
  onDataReady,
  }: DashboardProps) {
  const { emit } = useAppEventBus();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (pathname === '/chuti') {
      router.replace('/');
    }
  }, [pathname, router]);

  // Core Dashboard State & Real-time monitors
  const dashboardData = useDashboardData();
  const {
    sessionUser,
    profile,
    setProfile,
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
    setShowLeaveApprovalModal,
    setShowSupervisorApprovalModal,
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

  // R2: Push data upward so useGlobalNotifications can skip its own duplicate fetches.
  useEffect(() => {
    if (onDataReady) {
      onDataReady({ userRecords, holidayResponses, initialFetchDone });
    }
  }, [userRecords, holidayResponses, initialFetchDone, onDataReady]);

  // View Filter states
  const [filterType, setFilterType] = useState('all');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAdminAddLeaveModal, setShowAdminAddLeaveModal] = useState(false);

  const handleChutiTabChange = (tab: 'add_leave' | 'leave_history' | 'settlement' | 'leave_settings' | 'team_leaves') => {
    onChutiTabChange(tab);
    if (tab !== 'add_leave') {
      setEditingRecord(null);
    }
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

  // State to track dismissed notifications (persistent in localStorage, cleaned after 30 days, synced with DB)
  const [dismissedNotificationIds, setDismissedNotificationIds] = useState<Set<string>>(new Set());

  // Load and clean up old dismissed notifications on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('dismissed_notifications');
      if (stored) {
        const parsed = JSON.parse(stored) as Record<string, number>;
        const now = Date.now();
        const fresh: Record<string, number> = {};
        const freshIds = new Set<string>();

        for (const [id, timestamp] of Object.entries(parsed)) {
          if (now - timestamp < 30 * 24 * 60 * 60 * 1000) {
            fresh[id] = timestamp;
            freshIds.add(id);
          }
        }
        localStorage.setItem('dismissed_notifications', JSON.stringify(fresh));
        setDismissedNotificationIds(freshIds);
      }
    } catch (e) {
      console.error('Failed to load dismissed notifications from localStorage:', e);
    }
  }, []);

  // Fetch dismissed notifications from DB on mount / login
  useEffect(() => {
    if (!sessionUser) return;
    const fetchDismissed = async () => {
      try {
        const { data, error } = await supabase
          .from('dismissed_notifications')
          .select('notification_id')
          .eq('user_id', sessionUser.id);
        if (!error && data) {
          const dbIds = data.map(d => d.notification_id);
          setDismissedNotificationIds(prev => {
            const merged = new Set(prev);
            dbIds.forEach(id => merged.add(id));

            // Sync merged set back to localStorage
            try {
              const stored = localStorage.getItem('dismissed_notifications');
              const current = stored ? JSON.parse(stored) as Record<string, number> : {};
              const now = Date.now();
              let changed = false;
              dbIds.forEach(id => {
                if (!current[id]) {
                  current[id] = now;
                  changed = true;
                }
              });
              if (changed) {
                localStorage.setItem('dismissed_notifications', JSON.stringify(current));
              }
            } catch (e) {
              console.error('Failed to sync DB dismissals to localStorage:', e);
            }

            return merged;
          });
        }
      } catch (err) {
        console.error('Failed to fetch dismissed notifications from DB:', err);
      }
    };
    fetchDismissed();
  }, [sessionUser]);

  // Realtime synchronization for dismissed notifications across devices
  useRealtimeHandler(
    'dismissed_notifications',
    useCallback(
      (payload) => {
        if (payload.eventType === 'INSERT') {
          const nid = payload.new.notification_id as string;
          if (nid) {
            setDismissedNotificationIds((prev) => {
              const next = new Set(prev);
              next.add(nid);
              return next;
            });
            // Update local storage too to keep it in sync
            try {
              const stored = localStorage.getItem('dismissed_notifications');
              const current = stored ? JSON.parse(stored) as Record<string, number> : {};
              current[nid] = Date.now();
              localStorage.setItem('dismissed_notifications', JSON.stringify(current));
            } catch (e) {
              console.error('Failed to sync realtime dismiss to localStorage:', e);
            }
          }
        }
      },
      [setDismissedNotificationIds]
    )
  );
  // Listen to dismissed notifications sync event from other components
  useAppEvent('chuti-dismissed-notifications-sync', (payload) => {
    const dbIds = payload.ids;
    if (dbIds && Array.isArray(dbIds)) {
      setDismissedNotificationIds(prev => {
        const next = new Set(prev);
        let changed = false;
        dbIds.forEach(id => {
          if (!next.has(id)) {
            next.add(id);
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }
  }, []);

  // Broadcast own dismissed notification changes
  useEffect(() => {
    if (dismissedNotificationIds.size > 0) {
      emit('chuti-dismissed-notifications-sync', {
        ids: Array.from(dismissedNotificationIds)
      });
    }
  }, [dismissedNotificationIds, emit]);

  const [editingRecord, setEditingRecord] = useState<ChutiRecord | null>(null);

  // Listen for view details events dispatched from User Management
  useAppEvent('trigger-viewing-staff', (payload) => {
    setViewingStaffId(payload.userId);
  }, [setViewingStaffId]);



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
  const handleDismissNotifications = useCallback(async (type: 'user' | 'admin') => {
    const listToDismiss = type === 'user' ? userNotificationsList : adminHolidayNotifications;
    if (!listToDismiss || listToDismiss.length === 0 || !sessionUser) return;

    // 1. Local update
    try {
      const stored = localStorage.getItem('dismissed_notifications');
      const current = stored ? JSON.parse(stored) as Record<string, number> : {};
      const now = Date.now();

      const newIds = new Set(dismissedNotificationIds);
      listToDismiss.forEach((n: { id: string }) => {
        current[n.id] = now;
        newIds.add(n.id);
      });

      localStorage.setItem('dismissed_notifications', JSON.stringify(current));
      setDismissedNotificationIds(newIds);
    } catch (e) {
      console.error('Failed to dismiss notifications locally:', e);
    }

    // 2. DB persistence
    try {
      const inserts = listToDismiss.map((n: { id: string }) => ({
        user_id: sessionUser.id,
        notification_id: n.id
      }));

      const { error } = await supabase
        .from('dismissed_notifications')
        .insert(inserts);

      if (error) throw error;
    } catch (e) {
      console.error('Failed to persist dismissed notifications:', e);
    }
  }, [userNotificationsList, adminHolidayNotifications, dismissedNotificationIds, sessionUser, setDismissedNotificationIds]);

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
    submitting,
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
    setShowUserRevisionModal,
    setRevisionRecord,
    setRevisionDate,
    setRevisionLeaveType,
    setRevisionAdjustment,
    setRevisionAdjustShortLeave,
    setRevisionSignInTime,
    setRevisionSignOutTime,
    setRevisionLeaveHour,
    setRevisionComment,
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
    handleSupervisorApproveChuti,
    handleApproveChutiRequest,
    triggerDeleteRecord,
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
    handleToggleAdjustmentClick,
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
    handleApproveProfileChangeRequest,
    handleApprovePasswordResetRequest,
    handleConvertShortLeaveToFullLeave,
    setShowCreateUserModal,
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
    handleOpenRevisionModal,
    handleOpenAdminEditModal,
    handleOpenProfileSettingsForSelf,
    handleOpenProfileSettingsForStaff,
    handleOpenCredentialsModal,
    handleOpenDeleteUserModal,
    handleResetFilters,
  } = modalHandlers;

  const contextValue = {
    dashboardData: {
      ...dashboardData,
      handleDismissNotifications
    },
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
      } else if (isAdminRole(profile)) {
        count = unreadUserNotificationsCount;
      } else {
        count = unreadUserNotificationsCount;
      }
    }
    emit('chuti-notification-count-change', { count });
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
    emit('chuti-notification-list-sync', { notifications: userNotificationsList });
  }, [userNotificationsList, emit]);

  // Synchronize offline count to root page
  useEffect(() => {
    emit('chuti-offline-count-change', { count: offlineCount });
  }, [offlineCount, emit]);

  // Synchronize approvals count to root page
  useEffect(() => {
    let count = 0;
    if (profile) {
      if (isAdminRole(profile)) {
        count = groupedChutiRequests.length +
                pendingReserveRequests.length +
                pendingProfileRequests.length +
                pendingPasswordResetRequests.length +
                adminHolidayNotifications.length;
      } else if (profile.role === 'supervisor') {
        count = groupedSupervisorRequests.length;
      }
    }
    emit('chuti-approvals-count-sync', { count });
  }, [
    profile,
    groupedChutiRequests,
    pendingReserveRequests,
    pendingProfileRequests,
    pendingPasswordResetRequests,
    adminHolidayNotifications,
    groupedSupervisorRequests
  ]);

  // Handle events from unified root Navbar and global modals
  const { on } = useAppEventBus();
  useEffect(() => {
    const unsubOpenProfileSettings = on('open-profile-settings', () => {
      handleOpenProfileSettingsForSelf();
    });
    
    const unsubTriggerSync = on('trigger-manual-sync', () => {
      handleManualSync();
    });
    
    const unsubOpenRevisionModal = on('open-revision-modal', (payload) => {
      const r = payload.recordId as unknown as ChutiRecord; // AppEventMap defines this as { recordId: string }, but existing code casts detail to record object. Wait, let me adjust based on existing code logic.
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
    });
    
    const unsubApproveChuti = on('approve-chuti-request', (payload) => {
      handleApproveChutiRequest(payload.requestId as string, (payload as any).approve);
    });
    
    const unsubApproveReserve = on('approve-reserve-adjustment', (payload) => {
      handleApproveReserveAdjustment((payload as any).record, (payload as any).approve);
    });
    
    const unsubApproveProfile = on('approve-profile-change', (payload) => {
      handleApproveProfileChangeRequest(payload.requestId as string, (payload as any).approve);
    });
    
    const unsubApprovePassword = on('approve-password-reset', (payload) => {
      handleApprovePasswordResetRequest(payload.requestId as string, (payload as any).approve);
    });
    
    const unsubSupervisorApprove = on('supervisor-approve-chuti', (payload) => {
      handleSupervisorApproveChuti(payload.requestId as string, (payload as any).approve);
    });

    const unsubOpenAdminApprovalsModal = on('open-admin-approvals-modal', () => {
      setShowLeaveApprovalModal(true);
    });

    const unsubOpenSupervisorApprovalsModal = on('open-supervisor-approvals-modal', () => {
      setShowSupervisorApprovalModal(true);
    });

    return () => {
      unsubOpenProfileSettings();
      unsubTriggerSync();
      unsubOpenRevisionModal();
      unsubApproveChuti();
      unsubApproveReserve();
      unsubApproveProfile();
      unsubApprovePassword();
      unsubSupervisorApprove();
      unsubOpenAdminApprovalsModal();
      unsubOpenSupervisorApprovalsModal();
    };
  }, [
    on,
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
    setShowLeaveApprovalModal,
    setShowSupervisorApprovalModal,
  ]);

  if (!sessionUser && !loading) {
    return (
      <div className="flex-1 min-h-screen flex flex-col bg-theme-page-bg items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-theme-text-muted">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          <p className="text-sm font-medium tracking-wide">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  if (sessionUser && !profile) {
    if (activeChutiTab !== 'leave_history') {
      return (
        <div className="w-full">
          <SkeletonLoader variant={
            activeChutiTab === 'add_leave' ? 'chuti-form' :
            activeChutiTab === 'settlement' ? 'settlements-table' :
            activeChutiTab === 'leave_settings' ? 'leave-settings' :
            activeChutiTab === 'team_leaves' ? 'team-leaves-report' :
            'leaves-table'
          } />
        </div>
      );
    }
  }

  if (profile && (profile.has_changed_password === false || !profile.is_setup_completed)) {
    return (
      <DashboardProvider value={contextValue}>
        <div className="flex-1 min-h-screen flex flex-col bg-theme-page-bg relative overflow-hidden justify-center items-center py-12 px-4 sm:px-6 lg:px-8">
          {/* Background gradients */}
          <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-blue-600/10 blur-[120px] pointer-events-none" />
          <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-purple-600/10 blur-[120px] pointer-events-none" />

          <DashboardModals />
        </div>
      </DashboardProvider>
    );
  }

  if (loading && !initialFetchDone) {
    if (activeChutiTab !== 'leave_history') {
      let loaderVariant: 'chuti-form' | 'leaves-table' | 'responses-table' | 'settlements-table' | 'leave-history' | 'leave-settings' | 'team-leaves-report' = 'leaves-table';
      if (activeChutiTab === 'add_leave') loaderVariant = 'chuti-form';
      else if (activeChutiTab === 'settlement') loaderVariant = 'settlements-table';
      else if (activeChutiTab === 'leave_settings') loaderVariant = 'leave-settings';
      else if (activeChutiTab === 'team_leaves') loaderVariant = 'team-leaves-report';

      return (
        <div className="w-full">
          <SkeletonLoader variant={loaderVariant} />
        </div>
      );
    }
  }


  return (
    <DashboardProvider value={contextValue}>
      <Suspense fallback={
        <div className="w-full flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 text-purple-550 animate-spin" />
        </div>
      }>

        {/* ================= ADD LEAVE INLINE VIEW ================= */}
        {profile?.has_changed_password !== false && !!profile?.is_setup_completed && activeChutiTab === 'add_leave' && (
          <div className="space-y-4">
            {editingRecord && (
              <div className="flex items-center gap-3 pb-3 border-b border-theme-border-input/60">
                <button
                  onClick={() => {
                    setEditingRecord(null);
                    onChutiTabChange('leave_history');
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-theme-border-input bg-theme-card-bg/60 hover:bg-theme-border-input text-xs font-semibold text-theme-text-secondary hover:text-theme-text-primary transition-all cursor-pointer"
                >
                  Cancel Edit
                </button>
              </div>
            )}
            <AddLeave
              profile={profile}
              profilesList={profilesList}
              records={isAdminRole(profile) ? adminRecords : userRecords}
              globalSettings={globalSettings}
              leaveSettlements={leaveSettlements}
              editingRecord={editingRecord}
              onSuccess={() => {
                setEditingRecord(null);
                onChutiTabChange('leave_history');
                fetchRecords();
              }}
              onConvertShortLeaveToFullLeave={handleConvertShortLeaveToFullLeave}
              holidayResponses={holidayResponses}
              initialFetchDone={initialFetchDone}
            />
          </div>
        )}

        {/* ================= LEAVE SETTINGS INLINE VIEW ================= */}
        {profile?.has_changed_password !== false && !!profile?.is_setup_completed && isAdminRole(profile) && activeChutiTab === 'leave_settings' && (
          <AdminLeaveSettings
            globalSettings={globalSettings}
            onSaveGlobalSettings={handleSaveGlobalSettings}
            initialFetchDone={initialFetchDone}
          />
        )}

        {((!profile && activeChutiTab === 'leave_history') || (profile?.has_changed_password !== false && !!profile?.is_setup_completed && activeChutiTab === 'leave_history')) && (
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
            onEditClick={(record) => {
              setEditingRecord(record);
              onChutiTabChange('add_leave');
            }}
            onRevisionClick={handleOpenRevisionModal}
            onConvertShortLeaveToFullLeave={handleConvertShortLeaveToFullLeave}
            holidayResponses={holidayResponses}
            initialFetchDone={initialFetchDone}
            leaveSettlements={leaveSettlements}
            onSaveLeaveSettlementsBulk={handleSaveLeaveSettlementsBulk}
            onBackClick={() => onChutiTabChange('add_leave')}
            showAddLeave={false}
          />
        )}

        {/* ================= ADMIN STAFF VIEW (Leave Dashboard) ================= */}
        {profile?.has_changed_password !== false && !!profile?.is_setup_completed && isAdminRole(profile) &&
          activeChutiTab === 'settlement' && (
          <AdminDashboardView
            activeTab="settlement"
            setActiveTab={(tab) => handleChutiTabChange(tab as any)}
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

        {/* ================= TEAM LEAVE RECORDS ================= */}
        {profile?.has_changed_password !== false && !!profile?.is_setup_completed && activeChutiTab === 'team_leaves' && profile && (
          <TeamLeaveRecords
            profile={profile}
            profilesList={profilesList}
            adminRecords={adminRecords}
            initialFetchDone={initialFetchDone}
            onBack={() => onChutiTabChange('add_leave')}
            setProfile={setProfile}
            setProfilesList={setProfilesList}
          />
        )}

        <DashboardModals />
      </Suspense>
    </DashboardProvider>
  );
}
