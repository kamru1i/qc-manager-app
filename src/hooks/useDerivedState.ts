import { useMemo, useCallback } from 'react';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { Profile, ChutiRecordWithProfile, BulkRepresentative, LeaveSettlement } from '@/types';
import { ChutiRecord } from '@/utils/offlineSync';
import { formatDate, calculateStats, parseHolidayItem, GlobalSettings } from '@/utils/dashboardHelpers';

// Notification item type (shared across the app)
export interface NotificationItem {
  id: string;
  chutiId?: string;
  record?: ChutiRecord;
  profileRecord?: Profile;
  type: string;
  timestamp: string;
  title: string;
  body: string;
  text?: string;
  holidayDate?: string;
  holidayName?: string;
}

interface UseDerivedStateParams {
  sessionUser: SupabaseUser | null;
  profile: Profile | null;
  userRecords: ChutiRecord[];
  adminRecords: ChutiRecordWithProfile[];
  profilesList: Profile[];
  selectedYear: string;
  filterType: string;
  filterStartDate: string;
  filterEndDate: string;
  viewingStaffId: string | null;
  lastViewedTime: string | null;
  holidayResponses: any[];
  globalSettings: GlobalSettings;
  loading: boolean;
  initialFetchDone: boolean;
  adminActiveTab: 'user' | 'admin';
  dismissedNotificationIds?: Set<string>;
  leaveSettlements: LeaveSettlement[];
}

export function useDerivedState({
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
  loading: _loading,
  initialFetchDone,
  adminActiveTab,
  dismissedNotificationIds,
  leaveSettlements,
}: UseDerivedStateParams) {

  // --- Record Filtering ---
  const applyFilters = useCallback(<T extends ChutiRecord>(records: T[]): T[] => {
    return records.filter(r => {
      if (selectedYear !== 'all' && r.date && r.date.substring(0, 4) !== selectedYear) return false;
      if (filterType !== 'all' && r.leave_type !== filterType) return false;
      if (filterStartDate && r.date < filterStartDate) return false;
      if (filterEndDate && r.date > filterEndDate) return false;
      return true;
    });
  }, [selectedYear, filterType, filterStartDate, filterEndDate]);

  const filteredUserRecords = useMemo(() => applyFilters(userRecords), [applyFilters, userRecords]);

  const getFilteredRecordsForUser = useCallback((userId: string) => {
    const baseRecords = (profile?.role === 'admin' || (profile?.role === 'supervisor' && userId !== sessionUser?.id)) 
      ? adminRecords.filter(r => r.user_id === userId) 
      : userRecords;
    return applyFilters(baseRecords);
  }, [profile, sessionUser, adminRecords, userRecords, applyFilters]);

  // --- Stats ---
  const userYearlyRecords = useMemo(() => {
    return userRecords.filter(r => selectedYear === 'all' || (r.date && r.date.substring(0, 4) === selectedYear));
  }, [userRecords, selectedYear]);

  const userStats = useMemo(() => calculateStats(userYearlyRecords), [userYearlyRecords]);

  const getUserSummaryStats = useCallback((userId: string) => {
    const userRecs = adminRecords.filter(r => {
      if (r.user_id !== userId) return false;
      if (r.status !== 'approved') return false;
      if (selectedYear !== 'all' && r.date && r.date.substring(0, 4) !== selectedYear) return false;
      if (filterType !== 'all' && r.leave_type !== filterType) return false;
      if (filterStartDate && r.date < filterStartDate) return false;
      if (filterEndDate && r.date > filterEndDate) return false;
      return true;
    });
    const stats = calculateStats(userRecs);
    return {
      full: stats.fullLeaves,
      short: stats.shortHours,
      overtime: stats.overtimeHours
    };
  }, [adminRecords, selectedYear, filterType, filterStartDate, filterEndDate]);

  // --- Pending Request Grouping ---
  const groupPendingRequests = useCallback((requests: ChutiRecordWithProfile[]): BulkRepresentative[] => {
    const grouped: BulkRepresentative[] = [];
    const bulkMap = new Map<string, ChutiRecordWithProfile[]>();

    for (const req of requests) {
      if (req.bulk_id) {
        if (!bulkMap.has(req.bulk_id)) {
          bulkMap.set(req.bulk_id, []);
        }
        bulkMap.get(req.bulk_id)!.push(req);
      } else {
        grouped.push(req);
      }
    }

    bulkMap.forEach((subRequests, bulkId) => {
      subRequests.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      const representative = {
        ...subRequests[0],
        id: `bulk-${bulkId}`,
        is_bulk: true,
        bulk_id: bulkId,
        all_bulk_dates: subRequests.map(s => s.date),
        all_bulk_ids: subRequests.map(s => s.id),
        all_bulk_records: subRequests,
        formatted_bulk_dates: subRequests.map(s => formatDate(s.date)).join(', '),
      };
      grouped.push(representative);
    });

    return grouped.sort((a, b) => {
      const aTime = new Date(a.created_at || a.date).getTime();
      const bTime = new Date(b.created_at || b.date).getTime();
      return bTime - aTime;
    });
  }, []);

  // --- Pending Request Lists ---
  const pendingProfileRequests = useMemo(() => 
    profilesList.filter(p => p.profile_change_status === 'pending'), 
    [profilesList]
  );

  const pendingPasswordResetRequests = useMemo(() => 
    profilesList.filter(p => p.password_reset_status === 'pending'), 
    [profilesList]
  );

  const pendingReserveRequests = useMemo(() => 
    adminRecords.filter(r => 
      (r.leave_type === 'Overtime' && r.status === 'approved_by_supervisor') ||
      (r.reserve_adjustment_status === 'pending')
    ), 
    [adminRecords]
  );

  const pendingChutiRequests = useMemo(() => 
    adminRecords.filter(r => r.status === 'approved_by_supervisor' && r.leave_type !== 'Overtime'), 
    [adminRecords]
  );

  const pendingSupervisorRequests = useMemo(() => {
    return adminRecords.filter(r => {
      if (r.status !== 'pending_supervisor') return false;
      if (r.user_id === sessionUser?.id) return false;

      const meta = r.admin_edit_request && typeof r.admin_edit_request === 'object'
        ? (r.admin_edit_request as { supervisor_ids?: string[] })
        : null;

      if (meta && Array.isArray(meta.supervisor_ids) && meta.supervisor_ids.length > 0) {
        return meta.supervisor_ids.includes(sessionUser?.id || '');
      }

      return true;
    });
  }, [adminRecords, sessionUser]);

  const groupedSupervisorRequests = useMemo(() => 
    groupPendingRequests(pendingSupervisorRequests as ChutiRecordWithProfile[]), 
    [groupPendingRequests, pendingSupervisorRequests]
  );

  const groupedChutiRequests = useMemo(() => 
    groupPendingRequests(pendingChutiRequests as ChutiRecordWithProfile[]), 
    [groupPendingRequests, pendingChutiRequests]
  );



  // --- User Notifications ---
  const currentSessionTime = useMemo(() => new Date().toISOString(), []);

  const userNotificationsList = useMemo(() => {
    if (!sessionUser || !profile) return [];

    const list: NotificationItem[] = [];

    // Inject active government holiday notifications once initial load is complete
    if (initialFetchDone && profile.eligible_govt_holiday !== false) {
      const activeHolidays = (globalSettings.govt_holidays || []).map((h: any) => parseHolidayItem(h));

      activeHolidays.forEach((holiday: any) => {
        // Look up this user's response to this holiday
        const response = holidayResponses.find(r => r.user_id === profile.id && r.holiday_date === holiday.date);
        
        if (response) {
          // If reserve option is off, show them they will automatically get paid with salary
          if (profile.allow_reserve === false) {
            list.push({
              id: `govt-holiday-choice-${holiday.date}`,
              type: 'govt_holiday_choice',
              timestamp: response.created_at || currentSessionTime,
              title: 'Govt Holiday Payment Notification 💸',
              body: `${holiday.name} (${formatDate(holiday.date)}) government holiday payment will be added to your salary.`
            });
          } else if (response.updated_by_admin) {
            // If the preference was updated by the admin, notify the user.
            list.push({
              id: `govt-holiday-admin-update-${holiday.date}`,
              type: 'govt_holiday_choice',
              timestamp: response.created_at || currentSessionTime,
              title: 'Govt Holiday Choice Updated By Admin 💸',
              body: `Admin has updated your preference for ${holiday.name} (${formatDate(holiday.date)}) to ${response.response === 'reserve' ? 'Reserve' : 'Get Paid'}.`
            });
          }
          // If reserve option is on and not updated by admin, they made the choice themselves, so NO user notification is needed.
        } else if (profile.allow_reserve !== false) {
          // Actionable prompt: only show if the user is allowed to reserve
          list.push({
            id: `govt-holiday-prompt-${holiday.date}`,
            type: 'govt_holiday_prompt',
            timestamp: currentSessionTime,
            title: 'Select Govt Holiday Preference 🔔',
            body: `What would you like to do for this government holiday: ${holiday.name} (${formatDate(holiday.date)})?`,
            holidayDate: holiday.date,
            holidayName: holiday.name
          });
        }
      });
    }

    // For Supervisor: inject relevant pending staff requests into notify feed
    if (initialFetchDone) {
      const isSupervisor = profile.role === 'supervisor';

      if (isSupervisor) {
        // 1. Pending Supervisor Verification Requests (For Supervisors only)
        groupedSupervisorRequests.forEach(r => {
          const staff = profilesList.find(p => p.id === r.user_id);
          const staffName = staff?.full_name || 'Staff';
          const staffCode = staff?.username?.toUpperCase() || 'N/A';
          const datesLabel = r.is_bulk ? r.formatted_bulk_dates : formatDate(r.date);
          list.push({
            id: `sup-req-${r.id}`,
            type: 'pending_supervisor_request',
            timestamp: r.created_at || r.date || currentSessionTime,
            title: 'Leave Verification Needed 🔔',
            body: `${staffName} (${staffCode}) applied for ${r.leave_type} (Date: ${datesLabel}).`,
            record: r
          });
        });
      }
    }

    userRecords.forEach(r => {
      const hasRequest = r.admin_edit_request && typeof r.admin_edit_request === 'object';
      const editRequestObj = r.admin_edit_request as { notifications?: NotificationItem[] } | null;
      const savedNotifications = hasRequest && editRequestObj && Array.isArray(editRequestObj.notifications)
        ? editRequestObj.notifications
        : [];

      savedNotifications.forEach(n => {
        list.push({
          ...n,
          chutiId: r.id,
          record: r
        });
      });

      if (r.status === 'needs_review') {
        const hasRevisionSaved = savedNotifications.some(n => n.type === 'revision');
        if (!hasRevisionSaved) {
          list.push({
            id: `synth-rev-${r.id}`,
            chutiId: r.id,
            record: r,
            type: 'revision',
            timestamp: r.created_at || currentSessionTime,
            title: 'Leave Revision Request ⚠️',
            body: `Your ${r.leave_type} application has been sent back for revision.`
          });
        }
      }
    });

    // Inject processed settlements as user notifications
    leaveSettlements.forEach((s) => {
      if (s.status === 'processed' && s.user_id === profile.id) {
        const periodLabel = s.period === 'H1' ? 'January-June (H1)' : s.period === 'H2' ? 'July-December (H2)' : 'Instant';
        let bodyText = '';
        if (s.remaining_days < 0) {
          const absDays = Math.abs(s.remaining_days);
          if (s.action_type === 'payment') {
            bodyText = `Your deficit of ${absDays} day(s) for ${s.leave_category} (${periodLabel}) has been settled via salary deduction.`;
          } else if (s.action_type === 'carry_forward') {
            if (s.period === 'H1') {
              bodyText = `Your deficit of ${absDays} day(s) for ${s.leave_category} (${periodLabel}) has been adjusted with H2 Office Leave quota.`;
            } else {
              bodyText = `Your deficit of ${absDays} day(s) for ${s.leave_category} (${periodLabel}) has been adjusted with next year's H1 Office Leave quota.`;
            }
          } else if (s.action_type === 'adjust_leave') {
            bodyText = `Your deficit of ${absDays} day(s) for ${s.leave_category} (${periodLabel}) has been adjusted against holiday/Eid reserves.`;
          }
        } else {
          if (s.action_type === 'split') {
            const parts: string[] = [];
            if (s.carry_forward_days && s.carry_forward_days > 0) parts.push(`${s.carry_forward_days} days carried forward`);
            if (s.payment_days && s.payment_days > 0) parts.push(`${s.payment_days} days paid out`);
            if (s.adjust_leave_days && s.adjust_leave_days > 0) parts.push(`${s.adjust_leave_days} days adjusted against leaves`);
            bodyText = `Your unused leave for ${s.leave_category} (${periodLabel}) has been settled: ${parts.join(', ')}.`;
          } else if (s.action_type === 'carry_forward') {
            bodyText = `Your ${s.remaining_days} days of unused leave for ${s.leave_category} (${periodLabel}) has been carried forward/reserved.`;
          } else if (s.action_type === 'payment') {
            bodyText = `Your ${s.remaining_days} days of unused leave for ${s.leave_category} (${periodLabel}) will be paid out along with your salary.`;
          } else if (s.action_type === 'adjust_leave') {
            bodyText = `Your ${s.remaining_days} days of unused leave for ${s.leave_category} (${periodLabel}) has been adjusted against leaves.`;
          }
        }

        list.push({
          id: `settlement-processed-${s.id}`,
          type: 'settlement_processed',
          timestamp: s.processed_at || currentSessionTime,
          title: 'Leave Settlement Processed 💸',
          body: bodyText
        });
      }
    });

    const filtered = list.filter(n => !dismissedNotificationIds?.has(n.id));
    return filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [
      currentSessionTime,
      sessionUser,
      profile,
      userRecords,
      holidayResponses,
      globalSettings.govt_holidays,
      initialFetchDone,
      adminActiveTab,
      profilesList,
      dismissedNotificationIds,
      leaveSettlements,
      groupedSupervisorRequests,
      groupedChutiRequests,
      pendingReserveRequests,
      pendingProfileRequests,
      pendingPasswordResetRequests
  ]);

  // --- Admin/Supervisor Holiday Notifications ---
  const adminHolidayNotifications = useMemo(() => {
    if (!initialFetchDone || !sessionUser || !profile || profile.role !== 'admin') {
      return [];
    }

    const list: NotificationItem[] = [];
    holidayResponses.forEach((r: any) => {
      // Find the staff profile to check if they have allow_reserve enabled
      const staff = profilesList.find(p => p.id === r.user_id);
      const isReserveEnabled = staff ? staff.allow_reserve !== false : true;

      // Only notify admin if the staff member has reserve option ON
      if (isReserveEnabled) {
        const staffName = r.profiles?.full_name || 'Staff';
        const staffCode = r.profiles?.username?.toUpperCase() || 'N/A';
        const title = r.response === 'reserve' ? 'Govt Holiday Reserve Request 🔔' : 'Govt Holiday Payment Request 🔔';
        const body = `${staffName} (${staffCode}) ${r.holiday_name} (${formatDate(r.holiday_date)}) ${
          r.response === 'reserve' ? 'has requested to reserve the leave.' : 'has requested to get paid for the holiday.'
        }`;
        
        list.push({
          id: `admin-holiday-resp-${r.id}`,
          type: 'admin_holiday_response',
          timestamp: r.created_at || currentSessionTime,
          title,
          body
        });
      }
    });

    const filtered = list.filter(n => !dismissedNotificationIds?.has(n.id));
    return filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [initialFetchDone, sessionUser, profile, holidayResponses, profilesList, dismissedNotificationIds]);

  const unreadUserNotificationsCount = useMemo(() => 
    userNotificationsList.filter(
      n => !lastViewedTime || new Date(n.timestamp).getTime() > new Date(lastViewedTime).getTime()
    ).length,
    [userNotificationsList, lastViewedTime]
  );

  // --- Viewed Staff Member (individual view) ---
  const staffProfile = useMemo(() => 
    viewingStaffId ? (profilesList.find(p => p.id === viewingStaffId) || null) : null,
    [viewingStaffId, profilesList]
  );

  const individualRecords = useMemo(() => 
    viewingStaffId ? applyFilters(adminRecords.filter(r => r.user_id === viewingStaffId)) : [],
    [viewingStaffId, adminRecords, applyFilters]
  );

  const staffYearlyRecords = useMemo(() => 
    viewingStaffId ? adminRecords.filter(r => r.user_id === viewingStaffId && (selectedYear === 'all' || (r.date && r.date.substring(0, 4) === selectedYear))) : [],
    [viewingStaffId, adminRecords, selectedYear]
  );

  const staffStats = useMemo(() => calculateStats(staffYearlyRecords), [staffYearlyRecords]);

  // --- Available Years ---
  const availableYears = useMemo(() => 
    Array.from(new Set([
      new Date().getFullYear().toString(),
      ...userRecords.map(r => r.date ? r.date.substring(0, 4) : ''),
      ...adminRecords.map(r => r.date ? r.date.substring(0, 4) : '')
    ].filter(Boolean))).sort((a, b) => b.localeCompare(a)),
    [userRecords, adminRecords]
  );

  return {
    // Filtering
    filteredUserRecords,
    getFilteredRecordsForUser,

    // Stats
    userStats,
    getUserSummaryStats,

    // Pending Requests
    pendingProfileRequests,
    pendingPasswordResetRequests,
    pendingReserveRequests,
    pendingChutiRequests,
    pendingSupervisorRequests,
    groupedSupervisorRequests,
    groupedChutiRequests,

    // Notifications
    userNotificationsList,
    unreadUserNotificationsCount,
    adminHolidayNotifications,

    // Staff view
    staffProfile,
    individualRecords,
    staffStats,

    // Years
    availableYears,
  };
}
