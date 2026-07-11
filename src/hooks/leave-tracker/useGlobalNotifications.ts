'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/utils/supabase';
import { Profile } from '@/types';
import { ChutiRecord } from '@/utils/offlineSync';
import { NotificationItem } from '@/hooks/leave-tracker/useDerivedState';
import { toast } from 'react-hot-toast';
import { parseHolidayItem, getGlobalSettingsFromProfile, defaultGlobalSettings } from '@/utils/dashboardHelpers';

export function useGlobalNotifications(
  sessionUser: any,
  profile: Profile | null,
  profilesList: Profile[]
) {
  const [userRecords, setUserRecords] = useState<ChutiRecord[]>([]);
  const [holidayResponses, setHolidayResponses] = useState<any[]>([]);
  const [rulesRecords, setRulesRecords] = useState<any[]>([]);
  const [adminPendingRecords, setAdminPendingRecords] = useState<ChutiRecord[]>([]);
  const [supervisorPendingRecords, setSupervisorPendingRecords] = useState<ChutiRecord[]>([]);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [lastViewedTime, setLastViewedTime] = useState<string>('');
  const [dismissedNotificationIds, setDismissedNotificationIds] = useState<Set<string>>(new Set());
  const [syncedApprovalsCount, setSyncedApprovalsCount] = useState<number | null>(null);
  const realtimeDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Sync approvals count from dashboard event in real-time
  useEffect(() => {
    const handleSync = (e: Event) => {
      const customEvent = e as CustomEvent<number>;
      if (typeof customEvent.detail === 'number') {
        console.log('useGlobalNotifications received synced count:', customEvent.detail);
        setSyncedApprovalsCount(customEvent.detail);
      }
    };
    window.addEventListener('chuti-approvals-count-sync', handleSync);
    return () => {
      window.removeEventListener('chuti-approvals-count-sync', handleSync);
    };
  }, []);

  // Get stable session time for notification timestamp fallback
  const currentSessionTime = useMemo(() => new Date().toISOString(), []);

  // Fetch initial notifications data (only for the logged-in user)
  const fetchNotificationsData = useCallback(async () => {
    if (!sessionUser || !profile) return;

    try {
      // 1. Fetch user's own chuti records
      const { data: chutiData, error: chutiError } = await supabase
        .from('chuti')
        .select('*')
        .eq('user_id', sessionUser.id)
        .is('deleted_at', null)
        .order('date', { ascending: false });

      if (!chutiError && chutiData) {
        setUserRecords(chutiData);
      }

      // 2. Fetch user's holiday responses
      if (profile?.role === 'admin' || profile?.role === 'supervisor') {
        const { data: holidayData, error: holidayError } = await supabase
          .from('govt_holiday_responses')
          .select('*')
          .order('created_at', { ascending: false });

        if (!holidayError && holidayData) {
          setHolidayResponses(holidayData);
        }
      } else {
        const { data: holidayData, error: holidayError } = await supabase
          .from('govt_holiday_responses')
          .select('*')
          .eq('user_id', sessionUser.id)
          .order('created_at', { ascending: false });

        if (!holidayError && holidayData) {
          setHolidayResponses(holidayData);
        }
      }

      // 3. Fetch active compliance rules (only if user has quotes workspace access)
      if (profile?.has_quotes_access) {
        const { data: rulesData, error: rulesError } = await supabase
          .from('compliance_rules')
          .select('*')
          .eq('is_deleted', false);

        if (!rulesError && rulesData) {
          setRulesRecords(rulesData);
        }
      } else {
        setRulesRecords([]);
      }

      // 4. Fetch admin/supervisor approvals
      if (profile?.role === 'admin') {
        // Only used for the approvals count below (status / leave_type / reserve_adjustment_status),
        // so select just those columns instead of every chuti field incl. heavy JSON.
        const { data: adminChutiData, error: adminChutiError } = await supabase
          .from('chuti')
          .select('id, status, leave_type, reserve_adjustment_status')
          .is('deleted_at', null)
          .or('status.eq.approved_by_supervisor,reserve_adjustment_status.eq.pending');

        if (!adminChutiError && adminChutiData) {
          // Partial row (count-only); cast to the state's record type.
          setAdminPendingRecords(adminChutiData as unknown as ChutiRecord[]);
        }
      } else {
        setAdminPendingRecords([]);
      }

      if (profile?.role === 'supervisor') {
        // Only used for the team-pending count below, which reads admin_edit_request and the
        // joined profiles.supervisor_ids — so skip the rest of the chuti columns.
        const { data: supervisorChutiData, error: supervisorChutiError } = await supabase
          .from('chuti')
          .select('id, status, admin_edit_request, profiles (username, full_name, role, supervisor_ids)')
          .eq('status', 'pending_supervisor')
          .is('deleted_at', null);

        if (!supervisorChutiError && supervisorChutiData) {
          // Partial row + profiles join (count-only); cast to the state's record type.
          setSupervisorPendingRecords(supervisorChutiData as unknown as ChutiRecord[]);
        }
      } else {
        setSupervisorPendingRecords([]);
      }
    } catch (err) {
      console.error('Failed to fetch global notifications data:', err);
    }
  }, [sessionUser, profile]);

  // Load last viewed time and clean up dismissed notifications on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedTime = localStorage.getItem('last_viewed_notifications_time');
      if (storedTime) {
        setLastViewedTime(storedTime);
      }

      try {
        const storedDismissed = localStorage.getItem('dismissed_notifications');
        if (storedDismissed) {
          const parsed = JSON.parse(storedDismissed) as Record<string, number>;
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
        console.error('Failed to load dismissed notifications:', e);
      }
    }
  }, []);

  // Run fetch on mount / session change
  useEffect(() => {
    if (sessionUser && profile) {
      fetchNotificationsData();
    }
  }, [sessionUser, profile, fetchNotificationsData]);

  // Instead of subscribing to Supabase realtime channels (which duplicates
  // the subscriptions in useDashboardData and useQuotesDashboardData), listen
  // for a lightweight custom DOM event that those hooks dispatch whenever
  // they receive a realtime change. This eliminates 2-3 duplicate Supabase
  // channels and prevents cascading full-refetches.
  const lastNotifFetchRef = useRef<number>(0);
  const NOTIF_THROTTLE_MS = 5000; // Minimum 5s between notification refetches

  useEffect(() => {
    if (!sessionUser) return;

    const handleRealtimeDataChanged = () => {
      const now = Date.now();
      if (now - lastNotifFetchRef.current < NOTIF_THROTTLE_MS) return; // Throttle

      if (realtimeDebounceRef.current) clearTimeout(realtimeDebounceRef.current);
      realtimeDebounceRef.current = setTimeout(() => {
        lastNotifFetchRef.current = Date.now();
        fetchNotificationsData();
      }, 2000);
    };

    window.addEventListener('realtime-data-changed', handleRealtimeDataChanged);

    return () => {
      if (realtimeDebounceRef.current) clearTimeout(realtimeDebounceRef.current);
      window.removeEventListener('realtime-data-changed', handleRealtimeDataChanged);
    };
  }, [sessionUser, fetchNotificationsData]);

  // Compute global settings (needed for govt holidays list)
  const globalSettings = useMemo(() => {
    if (!profile) return defaultGlobalSettings;
    const adminProfile = profilesList.find(
      p => p.role === 'admin' && p.global_settings && JSON.stringify(p.global_settings) !== JSON.stringify(defaultGlobalSettings)
    ) || profilesList.find(p => p.role === 'admin');

    if (adminProfile && (profile.role === 'admin' || profile.role === 'supervisor')) {
      return getGlobalSettingsFromProfile(adminProfile);
    } else {
      return getGlobalSettingsFromProfile(profile);
    }
  }, [profile, profilesList]);

  // Derive notifications list (standard user notifications)
  const notificationsList = useMemo(() => {
    if (!sessionUser || !profile) return [];
    const list: NotificationItem[] = [];

    // 1. Govt Holiday Notifications
    if (profile.eligible_govt_holiday !== false) {
      const activeHolidays = (globalSettings.govt_holidays || []).map((h: any) => parseHolidayItem(h));

      activeHolidays.forEach((holiday: any) => {
        const response = holidayResponses.find(r => r.user_id === profile.id && r.holiday_date === holiday.date);
        
        if (response) {
          if (profile.allow_reserve === false) {
            list.push({
              id: `govt-holiday-choice-${holiday.date}`,
              type: 'govt_holiday_choice',
              timestamp: response.created_at || currentSessionTime,
              title: 'Govt Holiday Payment Notification 💸',
              body: `${holiday.name} (${holiday.date}) government holiday payment will be added to your salary.`
            });
          } else {
            list.push({
              id: `govt-holiday-choice-${holiday.date}`,
              type: 'govt_holiday_choice',
              timestamp: response.created_at || currentSessionTime,
              title: 'Govt Holiday Choice Updated By Admin 💸',
              body: `Admin has updated your preference for ${holiday.name} (${holiday.date}) to ${response.response === 'reserve' ? 'Reserve' : 'Get Paid'}.`
            });
          }
        } else if (profile.allow_reserve !== false) {
          list.push({
            id: `govt-holiday-prompt-${holiday.date}`,
            type: 'govt_holiday_prompt',
            timestamp: currentSessionTime,
            title: 'Select Govt Holiday Preference 🔔',
            body: `What would you like to do for this government holiday: ${holiday.name} (${holiday.date})?`,
            holidayDate: holiday.date,
            holidayName: holiday.name
          });
        }
      });
    }

    // 2. Chuti Notification Items (Approved, Rejected, Revision)
    userRecords.forEach(r => {
      const editRequestObj = r.admin_edit_request as { notifications?: NotificationItem[] } | null;
      const savedNotifications = editRequestObj?.notifications || [];

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

    // 3. Compliance Rules Notifications (New & Updates)
    rulesRecords.forEach(r => {
      list.push({
        id: `rule-${r.id}`,
        type: 'compliance_rule',
        timestamp: r.updated_at || r.created_at || currentSessionTime,
        title: `Compliance Rule Added/Updated 🚨`,
        body: `Category: ${r.category.toUpperCase()} -> ${r.sub_category.toUpperCase()}\n\n${r.content}`,
      });
    });

    const filtered = list.filter(n => {
      // 1. Filter out dismissed notifications
      if (dismissedNotificationIds?.has(n.id)) return false;

      // 2. Filter out non-actionable notifications older than 7 days
      const isActionable = n.type === 'govt_holiday_prompt' || (n.type === 'revision' && n.record?.status === 'needs_review');
      if (!isActionable && n.timestamp) {
        const ageMs = new Date(currentSessionTime).getTime() - new Date(n.timestamp).getTime();
        const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
        if (ageMs > sevenDaysMs) {
          return false;
        }
      }
      return true;
    });
    return filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [
    sessionUser, 
    profile, 
    userRecords, 
    holidayResponses, 
    rulesRecords, 
    profilesList, 
    globalSettings.govt_holidays, 
    currentSessionTime, 
    dismissedNotificationIds
  ]);

  const approvalsCount = useMemo(() => {
    if (syncedApprovalsCount !== null) {
      return syncedApprovalsCount;
    }

    let count = 0;
    if (profile?.role === 'admin') {
      const adminPendingChutiCount = adminPendingRecords.filter(
        r => r.status === 'approved_by_supervisor' && r.leave_type !== 'Overtime'
      ).length;
      
      const adminPendingReserveCount = adminPendingRecords.filter(
        r => (r.leave_type === 'Overtime' && r.status === 'approved_by_supervisor') ||
             (r.reserve_adjustment_status === 'pending')
      ).length;
      
      const profileChangeCount = profilesList.filter(p => p.profile_change_status === 'pending').length;
      const passwordResetCount = profilesList.filter(p => p.password_reset_status === 'pending').length;
      
      // Count govt holiday responses for admin (where user is reserve-enabled)
      const adminHolidayNotifCount = holidayResponses.filter((r: any) => {
        const staff = profilesList.find(p => p.id === r.user_id);
        const isReserveEnabled = staff ? staff.allow_reserve !== false : true;
        if (!isReserveEnabled) return false;
        
        // Also check if dismissed
        const notifId = `admin-holiday-resp-${r.id}`;
        return !dismissedNotificationIds?.has(notifId);
      }).length;

      count += adminPendingChutiCount + adminPendingReserveCount + profileChangeCount + passwordResetCount + adminHolidayNotifCount;
    }
    
    if (profile?.role === 'supervisor') {
      const delegatedFromSupervisorIds = profilesList.filter(p => p.delegated_supervisor_id === profile.id).map(p => p.id);

      const myTeamPendingCount = supervisorPendingRecords.filter(r => {
        // Only count if this supervisor is assigned to the user, or if someone who delegated to them is assigned
        const userSupervisorIds = (r as any).profiles?.supervisor_ids || [];
        const isSupervised = userSupervisorIds.includes(profile.id) ||
                             userSupervisorIds.some((id: string) => delegatedFromSupervisorIds.includes(id));
        if (!isSupervised) return false;

        const meta = r.admin_edit_request && typeof r.admin_edit_request === 'object'
          ? (r.admin_edit_request as { supervisor_ids?: string[] })
          : null;
        if (meta && Array.isArray(meta.supervisor_ids) && meta.supervisor_ids.length > 0) {
          return meta.supervisor_ids.includes(profile.id) ||
                 meta.supervisor_ids.some((id: string) => delegatedFromSupervisorIds.includes(id));
        }
        return true;
      }).length;
      
      count += myTeamPendingCount;
    }
    return count;
  }, [syncedApprovalsCount, profile, adminPendingRecords, supervisorPendingRecords, profilesList, holidayResponses, dismissedNotificationIds]);

  // Compute unread count
  const unreadCount = useMemo(() => {
    const standardUnread = notificationsList.filter(
      n => !lastViewedTime || new Date(n.timestamp).getTime() > new Date(lastViewedTime).getTime()
    ).length;
    return standardUnread + approvalsCount;
  }, [notificationsList, lastViewedTime, approvalsCount]);

  const handleOpenNotifications = useCallback(() => {
    setShowNotificationsModal(true);
    const now = new Date().toISOString();
    localStorage.setItem('last_viewed_notifications_time', now);
    setLastViewedTime(now);
    // Propagate event so other components know it is read
    window.dispatchEvent(new CustomEvent('chuti-notification-count-change', { detail: 0 }));
  }, []);

  const handleCloseNotifications = useCallback(() => {
    setShowNotificationsModal(false);
  }, []);

  const handleDismissNotification = useCallback((id: string) => {
    try {
      const stored = localStorage.getItem('dismissed_notifications');
      const current = stored ? JSON.parse(stored) as Record<string, number> : {};
      const now = Date.now();
      
      current[id] = now;
      
      localStorage.setItem('dismissed_notifications', JSON.stringify(current));
      setDismissedNotificationIds(prev => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });
    } catch (e) {
      console.error('Failed to dismiss notification:', e);
    }
  }, []);

  const handleDismissAllNotifications = useCallback(() => {
    if (notificationsList.length === 0) return;
    try {
      const stored = localStorage.getItem('dismissed_notifications');
      const current = stored ? JSON.parse(stored) as Record<string, number> : {};
      const now = Date.now();
      
      const newIds = new Set(dismissedNotificationIds);
      notificationsList.forEach((n) => {
        current[n.id] = now;
        newIds.add(n.id);
      });
      
      localStorage.setItem('dismissed_notifications', JSON.stringify(current));
      setDismissedNotificationIds(newIds);
    } catch (e) {
      console.error('Failed to dismiss all notifications:', e);
    }
  }, [notificationsList, dismissedNotificationIds]);

  const handleSaveHolidayResponse = useCallback(async (holidayDate: string, holidayName: string, choice: 'paid' | 'reserve') => {
    if (!profile) return false;
    
    try {
      const { error } = await supabase
        .from('govt_holiday_responses')
        .upsert({
          user_id: profile.id,
          holiday_date: holidayDate,
          response: choice,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id,holiday_date' });

      if (error) throw error;
      toast.success(`Choice '${choice === 'paid' ? 'Get Paid' : 'Reserve'}' saved successfully.`);
      await fetchNotificationsData();
      return true;
    } catch (err: any) {
      console.error('Failed to save holiday choice:', err);
      toast.error('Failed to save choice: ' + err.message);
      return false;
    }
  }, [profile, fetchNotificationsData]);

  const setOpenModal = useCallback((val: boolean) => {
    if (val) {
      handleOpenNotifications();
    } else {
      handleCloseNotifications();
    }
  }, [handleOpenNotifications, handleCloseNotifications]);

  return {
    unreadCount,
    notificationsList,
    showNotificationsModal,
    setShowNotificationsModal: setOpenModal,
    handleSaveHolidayResponse,
    handleDismissNotification,
    handleDismissAllNotifications,
    fetchNotificationsData,
    approvalsCount
  };
}
