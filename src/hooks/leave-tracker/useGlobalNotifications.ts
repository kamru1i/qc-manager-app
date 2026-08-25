'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/utils/supabase';
import { Profile, GovtHolidayResponse, ComplianceRule, ChutiRecordWithProfile } from '@/types';
import { ChutiRecord } from '@/utils/offlineSync';
import { NotificationItem } from '@/hooks/leave-tracker/useDerivedState';
import { toast } from 'sonner';
import { parseHolidayItem, getGlobalSettingsFromProfile, defaultGlobalSettings, findAdminProfileWithGlobalSettings } from '@/utils/dashboardHelpers';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { useRealtimeHandler } from '@/contexts/RealtimeContext';
import { isAdminRole } from '@/utils/permissionService';
import { useAppEventBus, useAppEvent } from '@/contexts/AppEventBusContext';

export function useGlobalNotifications(
  sessionUser: SupabaseUser | null,
  profile: Profile | null,
  profilesList: Profile[],
  sharedUserRecords?: ChutiRecord[],
  sharedHolidayResponses?: GovtHolidayResponse[],
  initialFetchDone?: boolean,
  isProfileFresh: boolean = true
) {
  const { emit } = useAppEventBus();
  const [userRecords, setUserRecords] = useState<ChutiRecord[]>([]);
  const [holidayResponses, setHolidayResponses] = useState<GovtHolidayResponse[]>([]);
  const [rulesRecords, setRulesRecords] = useState<Pick<ComplianceRule, 'id' | 'updated_at' | 'created_at' | 'category' | 'sub_category' | 'content'>[]>([]);
  const [adminPendingRecords, setAdminPendingRecords] = useState<Pick<ChutiRecord, 'id' | 'status' | 'leave_type' | 'reserve_adjustment_status'>[]>([]);
  const [supervisorPendingRecords, setSupervisorPendingRecords] = useState<ChutiRecordWithProfile[]>([]);
  const [isInitialNotifFetchDone, setIsInitialNotifFetchDone] = useState(false);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [lastViewedTime, setLastViewedTime] = useState<string>('');
  const [dismissedNotificationIds, setDismissedNotificationIds] = useState<Set<string>>(new Set());
  const [syncedApprovalsCount, setSyncedApprovalsCount] = useState<number | null>(null);
  const [isChutiLoaded, setIsChutiLoaded] = useState(false);

  useEffect(() => {
    if (initialFetchDone) {
      setIsChutiLoaded(true);
    }
  }, [initialFetchDone]);

  // R2: When shared data is available from the always-mounted ChutiDashboard,
  // sync it into local state instead of fetching independently.
  useEffect(() => {
    if (sharedUserRecords) {
      setUserRecords(sharedUserRecords);
    }
  }, [sharedUserRecords]);

  useEffect(() => {
    if (sharedHolidayResponses) {
      setHolidayResponses(sharedHolidayResponses);
    }
  }, [sharedHolidayResponses]);

  // Sync approvals count from dashboard event in real-time
  useAppEvent('chuti-approvals-count-sync', (payload) => {
    const count = typeof payload === 'number' ? payload : payload.count;
    if (typeof count === 'number') {
      setSyncedApprovalsCount(count);
    }
  }, []);

  // Get stable session time for notification timestamp fallback
  const currentSessionTime = useMemo(() => new Date().toISOString(), []);

  // Realtime UPDATE payloads only carry the primary key in `old` (default
  // REPLICA IDENTITY), so change detection must compare against the locally
  // cached previous row from the shared profiles list.
  const profilesListRef = useRef<Profile[]>([]);
  useEffect(() => {
    profilesListRef.current = profilesList;
  }, [profilesList]);

  // Fetch notifications data. When shared data is available, skip the
  // user-records and holiday-responses queries (R2 data sharing).
  const hasSharedUserRecords = !!sharedUserRecords && (sharedUserRecords.length > 0 || !!initialFetchDone);
  const hasSharedHolidayResponses = !!sharedHolidayResponses && (sharedHolidayResponses.length > 0 || !!initialFetchDone);

  const fetchNotificationsData = useCallback(async () => {
    if (!sessionUser || !profile || !isChutiLoaded) return;

    try {
      // Define concurrent queries
      const fetchChutiPromise = async () => {
        if (hasSharedUserRecords) return null;
        const { data, error } = await supabase
          .from('chuti')
          .select('id, user_id, date, leave_type, leave_hour, status, comment, adjustment, reserve_holiday, reserve_adjustment_status, admin_edit_request, sign_in_time, sign_out_time, created_at, updated_at')
          .eq('user_id', sessionUser.id)
          .is('deleted_at', null)
          .order('date', { ascending: false });
        if (error) {
          console.error('Failed to fetch user chuti records in useGlobalNotifications:', error);
          return null;
        }
        return data ? data.map(r => ({ ...r, synced: true })) : null;
      };

      const fetchHolidayResponsesPromise = async () => {
        if (hasSharedHolidayResponses) return null;
        if (isAdminRole(profile)) {
          const { data, error } = await supabase
            .from('govt_holiday_responses')
            .select('id, user_id, holiday_date, holiday_name, response, created_at')
            .order('created_at', { ascending: false })
            .limit(100);
          if (error) {
            console.error('Failed to fetch holiday responses in useGlobalNotifications:', error);
            return null;
          }
          return (data as unknown as GovtHolidayResponse[]) || null;
        } else {
          const { data, error } = await supabase
            .from('govt_holiday_responses')
            .select('id, user_id, holiday_date, holiday_name, response, created_at')
            .eq('user_id', sessionUser.id)
            .order('created_at', { ascending: false });
          if (error) {
            console.error('Failed to fetch holiday responses in useGlobalNotifications:', error);
            return null;
          }
          return (data as unknown as GovtHolidayResponse[]) || null;
        }
      };

      const fetchRulesPromise = async () => {
        if (!profile?.has_quotes_access) return [];
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const { data, error } = await supabase
          .from('compliance_rules')
          .select('id, updated_at, created_at, category, sub_category, content')
          .eq('is_deleted', false)
          .or(`updated_at.gte.${sevenDaysAgo},created_at.gte.${sevenDaysAgo}`);
        if (error) {
          console.error('Failed to fetch compliance rules in useGlobalNotifications:', error);
          return [];
        }
        return data || [];
      };

      const fetchAdminPendingPromise = async () => {
        if (!isAdminRole(profile)) return [];
        const { data, error } = await supabase
          .from('chuti')
          .select('id, status, leave_type, reserve_adjustment_status')
          .is('deleted_at', null)
          .or('status.eq.approved_by_supervisor,reserve_adjustment_status.eq.pending');
        if (error) {
          console.error('Failed to fetch admin pending chuti records in useGlobalNotifications:', error);
          return [];
        }
        return (data as unknown as Pick<ChutiRecord, 'id' | 'status' | 'leave_type' | 'reserve_adjustment_status'>[]) || [];
      };

      const fetchSupervisorPendingPromise = async () => {
        if (profile?.role !== 'supervisor') return [];
        const { data, error } = await supabase
          .from('chuti')
          .select('id, status, admin_edit_request, profiles (username, full_name, role, supervisor_ids)')
          .eq('status', 'pending_supervisor')
          .is('deleted_at', null);
        if (error) {
          console.error('Failed to fetch supervisor pending chuti records in useGlobalNotifications:', error);
          return [];
        }
        return (data as unknown as ChutiRecordWithProfile[]) || [];
      };

      const fetchDismissedPromise = async () => {
        const { data, error } = await supabase
          .from('dismissed_notifications')
          .select('notification_id')
          .eq('user_id', sessionUser.id);
        if (error) return [];
        return data ? data.map(d => d.notification_id) : [];
      };

      // Execute all 6 queries in parallel
      const [
        chutiData,
        holidayData,
        rulesData,
        adminChutiData,
        supervisorChutiData,
        dismissedIds
      ] = await Promise.all([
        fetchChutiPromise(),
        fetchHolidayResponsesPromise(),
        fetchRulesPromise(),
        fetchAdminPendingPromise(),
        fetchSupervisorPendingPromise(),
        fetchDismissedPromise(),
      ]);

      if (chutiData) setUserRecords(chutiData as ChutiRecord[]);
      if (holidayData) setHolidayResponses(holidayData);
      setRulesRecords(rulesData);
      setAdminPendingRecords(adminChutiData);
      setSupervisorPendingRecords(supervisorChutiData);

      if (dismissedIds && dismissedIds.length > 0) {
        setDismissedNotificationIds(prev => {
          const merged = new Set(prev);
          dismissedIds.forEach(id => merged.add(id));
          
          try {
            const stored = localStorage.getItem('dismissed_notifications');
            const current = stored ? JSON.parse(stored) as Record<string, number> : {};
            const now = Date.now();
            let changed = false;
            dismissedIds.forEach(id => {
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

      setIsInitialNotifFetchDone(true);
    } catch (err) {
      console.error('Failed to fetch global notifications data:', err);
      setIsInitialNotifFetchDone(true);
    }
  }, [sessionUser, profile, hasSharedUserRecords, hasSharedHolidayResponses, isChutiLoaded]);

  // Realtime payloads patch notification inputs in memory. No event causes a
  // multi-table notification refetch.
  useRealtimeHandler(
    'chuti',
    useCallback((payload) => {
      const id = String(payload.eventType === 'DELETE' ? payload.old.id ?? '' : payload.new.id ?? '');
      if (!id) return;
      const incoming = payload.new as unknown as ChutiRecordWithProfile;
      const remove = payload.eventType === 'DELETE' || Boolean(incoming.deleted_at);

      if (isAdminRole(profile)) {
        setAdminPendingRecords((prev) => {
          const without = prev.filter((row) => row.id !== id);
          if (remove || !(
            incoming.status === 'approved_by_supervisor'
            || incoming.reserve_adjustment_status === 'pending'
          )) return without;
          return [{
            id,
            status: incoming.status,
            leave_type: incoming.leave_type,
            reserve_adjustment_status: incoming.reserve_adjustment_status,
          }, ...without];
        });
      }

      if (profile?.role === 'supervisor') {
        setSupervisorPendingRecords((prev) => {
          const without = prev.filter((row) => row.id !== id);
          if (remove || incoming.status !== 'pending_supervisor') return without;
          const target = profilesListRef.current.find((p) => p.id === incoming.user_id);
          return [{
            ...incoming,
            id,
            profiles: target ? {
              username: target.username,
              full_name: target.full_name,
              role: target.role,
              supervisor_ids: target.supervisor_ids,
            } : null,
          }, ...without];
        });
      }
    }, [profile])
  );

  useRealtimeHandler(
    'compliance_rules',
    useCallback((payload) => {
      const id = String(payload.eventType === 'DELETE' ? payload.old.id ?? '' : payload.new.id ?? '');
      if (!id) return;
      const incoming = payload.new as unknown as ComplianceRule;
      setRulesRecords((prev) => {
        const without = prev.filter((row) => row.id !== id);
        if (payload.eventType === 'DELETE' || incoming.is_deleted) return without;
        return [{
          id,
          updated_at: incoming.updated_at,
          created_at: incoming.created_at,
          category: incoming.category,
          sub_category: incoming.sub_category,
          content: incoming.content,
        }, ...without];
      });
    }, [])
  );

  useRealtimeHandler(
    'govt_holiday_responses',
    useCallback(
      (payload) => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const newResp = payload.new as unknown as GovtHolidayResponse;
          setHolidayResponses((prev) => {
            const filtered = prev.filter(
              (r) => !(r.id === newResp.id || (r.user_id === newResp.user_id && r.holiday_date === newResp.holiday_date))
            );
            return [newResp, ...filtered];
          });
        } else if (payload.eventType === 'DELETE') {
          const oldRespId = payload.old.id as string;
          setHolidayResponses((prev) => prev.filter((r) => r.id !== oldRespId));
        }
      },
      [setHolidayResponses]
    )
  );

  // Register realtime handler to sync dismissals across active sessions in real time
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

  // Listen to dismissed notifications sync event from other components
  useAppEvent('chuti-dismissed-notifications-sync', (payload) => {
    const dbIds = Array.isArray(payload) ? payload : payload.ids;
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
      emit('chuti-dismissed-notifications-sync', { ids: Array.from(dismissedNotificationIds) });
    }
  }, [dismissedNotificationIds, emit]);

  // Listen to last viewed time sync event from other components
  useAppEvent('chuti-last-viewed-time-sync', (payload) => {
    const time = typeof payload === 'string' ? payload : String(payload.timestamp);
    if (time) setLastViewedTime(time);
  }, []);

  // Run fetch on mount / session change / loading status change
  useEffect(() => {
    if (sessionUser && profile && isChutiLoaded) {
      fetchNotificationsData();
    }
  }, [sessionUser, profile, isChutiLoaded, fetchNotificationsData]);

  // Event listeners and refetches are configured at the top hook level.

  // Compute global settings (needed for govt holidays list)
  const globalSettings = useMemo(() => {
    if (!profile) return defaultGlobalSettings;
    const adminProfile = findAdminProfileWithGlobalSettings(profilesList, profile);

    if (adminProfile) {
      return getGlobalSettingsFromProfile(adminProfile);
    } else {
      return getGlobalSettingsFromProfile(profile);
    }
  }, [profile, profilesList]);

  // Derive notifications list (standard user notifications)
  const notificationsList = useMemo(() => {
    if (!sessionUser || !profile || !isProfileFresh || !isInitialNotifFetchDone) return [];
    const list: NotificationItem[] = [];

    // 1. Govt Holiday Notifications (strictly for users who have allow_reserve enabled)
    if (profile.eligible_govt_holiday !== false && !!profile.allow_reserve) {
      const activeHolidays = (globalSettings.govt_holidays || []).map((h: unknown) => parseHolidayItem(h));

      activeHolidays.forEach((holiday: { date: string; name: string }) => {
        const response = holidayResponses.find(r => r.user_id === profile.id && r.holiday_date === holiday.date);
        
        if (response && response.response === 'paid') {
          list.push({
            id: `govt-holiday-paid-${holiday.date}`,
            type: 'govt_holiday_history',
            timestamp: response.updated_at || response.created_at || currentSessionTime,
            title: 'Reserve Holiday Converted to Payment 💸',
            body: `Your Govt Holiday reserve for ${holiday.date} (${holiday.name}) has been converted to payment based on verbal agreement.`
          });
        } else {
          list.push({
            id: `govt-holiday-reserve-${holiday.date}`,
            type: 'govt_holiday_history',
            timestamp: response?.created_at || currentSessionTime,
            title: 'Govt Holiday Reserved 📅',
            body: `The Government Holiday on ${holiday.date} (${holiday.name}) has been reserved for you.`
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
    globalSettings.govt_holidays, 
    currentSessionTime, 
    dismissedNotificationIds,
    isProfileFresh,
    isInitialNotifFetchDone
  ]);

  const approvalsCount = useMemo(() => {
    if (syncedApprovalsCount !== null) {
      return syncedApprovalsCount;
    }

    let count = 0;
    if (isAdminRole(profile)) {
      const adminPendingChutiCount = adminPendingRecords.filter(
        r => r.status === 'approved_by_supervisor' && r.leave_type !== 'Overtime'
      ).length;
      
      const adminPendingReserveCount = adminPendingRecords.filter(
        r => (r.leave_type === 'Overtime' && r.status === 'approved_by_supervisor') ||
             (r.reserve_adjustment_status === 'pending')
      ).length;
      
      const profileChangeCount = profilesList.filter(p => p.profile_change_status === 'pending').length;
      const passwordResetCount = profilesList.filter(p => p.password_reset_status === 'pending').length;
      
      // Government-holiday entitlements are created automatically and are not
      // pending user choices, so they must not inflate the approval badge.
      count += adminPendingChutiCount + adminPendingReserveCount + profileChangeCount + passwordResetCount;
    }
    
    if (profile?.role === 'supervisor') {
      const delegatedFromSupervisorIds = profilesList.filter(p => p.delegated_supervisor_id === profile.id).map(p => p.id);

      const myTeamPendingCount = supervisorPendingRecords.filter(r => {
        // Only count if this supervisor is assigned to the user, or if someone who delegated to them is assigned
        const userSupervisorIds = r.profiles?.supervisor_ids || [];
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
    emit('chuti-last-viewed-time-sync', { timestamp: now });
    // Propagate event so other components know it is read
    emit('chuti-notification-count-change', { count: 0 });
  }, [emit]);

  const handleCloseNotifications = useCallback(() => {
    setShowNotificationsModal(false);
  }, []);

  const handleDismissNotification = useCallback(async (id: string) => {
    if (!sessionUser) return;

    // 1. Find the notification from the list to see if it has a chutiId
    const targetNotif = notificationsList.find(n => n.id === id);

    // 2. Optimistic local update
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
      console.error('Failed to save dismissal locally:', e);
    }

    // 3. DB persistence (dismissed_notifications table)
    try {
      const { error } = await supabase
        .from('dismissed_notifications')
        .insert({
          user_id: sessionUser.id,
          notification_id: id
        });
      if (error && error.code !== '23505') { // Ignore unique constraint violation
        throw error;
      }
    } catch (e) {
      console.error('Failed to persist notification dismissal:', e);
    }

    // 4. DB persistence (clean chuti record's admin_edit_request.notifications array)
    // NOTE: admin_edit_request lives on the `chuti` table (the quotes `records`
    // table has no such column — querying it 400s silently).
    if (targetNotif && targetNotif.chutiId) {
      try {
        const { data: record } = await supabase
          .from('chuti')
          .select('admin_edit_request')
          .eq('id', targetNotif.chutiId)
          .single();

        if (record) {
          const editRequest = record.admin_edit_request as { notifications?: any[] } | null;
          if (editRequest && Array.isArray(editRequest.notifications)) {
            const updatedNotifs = editRequest.notifications.filter((n: any) => n.id !== id);
            await supabase
              .from('chuti')
              .update({
                admin_edit_request: {
                  ...editRequest,
                  notifications: updatedNotifs
                }
              })
              .eq('id', targetNotif.chutiId);
          }
        }
      } catch (err) {
        console.error('Failed to clean notification from records table in DB:', err);
      }
    }
  }, [sessionUser, notificationsList, setDismissedNotificationIds]);

  const handleDismissAllNotifications = useCallback(async () => {
    if (notificationsList.length === 0 || !sessionUser) return;

    // 1. Optimistic local update
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
      console.error('Failed to save dismiss all locally:', e);
    }

    // 2. DB persistence (dismissed_notifications table)
    try {
      const inserts = notificationsList.map((n) => ({
        user_id: sessionUser.id,
        notification_id: n.id
      }));

      const { error } = await supabase
        .from('dismissed_notifications')
        .insert(inserts);

      if (error) throw error;
    } catch (e) {
      console.error('Failed to persist dismiss all notifications:', e);
    }

    // 3. DB persistence (clean all matching chuti records' admin_edit_request.notifications in parallel)
    // NOTE: admin_edit_request lives on the `chuti` table, not `records`.
    const chutiNotifs = notificationsList.filter(n => n.chutiId);
    if (chutiNotifs.length > 0) {
      const groupedByChuti: Record<string, string[]> = {};
      chutiNotifs.forEach(n => {
        if (!groupedByChuti[n.chutiId!]) {
          groupedByChuti[n.chutiId!] = [];
        }
        groupedByChuti[n.chutiId!].push(n.id);
      });

      await Promise.all(
        Object.entries(groupedByChuti).map(async ([chutiId, notifIds]) => {
          try {
            const { data: record } = await supabase
              .from('chuti')
              .select('admin_edit_request')
              .eq('id', chutiId)
              .single();

            if (record) {
              const editRequest = record.admin_edit_request as { notifications?: any[] } | null;
              if (editRequest && Array.isArray(editRequest.notifications)) {
                const updatedNotifs = editRequest.notifications.filter((n: any) => !notifIds.includes(n.id));
                await supabase
                  .from('chuti')
                  .update({
                    admin_edit_request: {
                      ...editRequest,
                      notifications: updatedNotifs
                    }
                  })
                  .eq('id', chutiId);
              }
            }
          } catch (err) {
            console.error(`Failed to clean notification list for record ${chutiId} in DB:`, err);
          }
        })
      );
    }
  }, [notificationsList, dismissedNotificationIds, sessionUser, setDismissedNotificationIds]);

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
    handleDismissNotification,
    handleDismissAllNotifications,
    fetchNotificationsData,
    approvalsCount,
    isInitialNotifFetchDone
  };
}
