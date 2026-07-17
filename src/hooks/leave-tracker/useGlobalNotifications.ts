'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/utils/supabase';
import { Profile, GovtHolidayResponse, ComplianceRule, ChutiRecordWithProfile } from '@/types';
import { ChutiRecord } from '@/utils/offlineSync';
import { NotificationItem } from '@/hooks/leave-tracker/useDerivedState';
import { toast } from 'react-hot-toast';
import { parseHolidayItem, getGlobalSettingsFromProfile, defaultGlobalSettings } from '@/utils/dashboardHelpers';
import { mapProfilePasswordResetStatus } from '@/utils/profileHelpers';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { useRealtimeHandler, RealtimePayload } from '@/contexts/RealtimeContext';

export function useGlobalNotifications(
  sessionUser: SupabaseUser | null,
  profile: Profile | null,
  profilesList: Profile[],
  sharedUserRecords?: ChutiRecord[],
  sharedHolidayResponses?: GovtHolidayResponse[],
  initialFetchDone?: boolean,
  isProfileFresh: boolean = true
) {
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
  const realtimeDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const lastNotifFetchRef = useRef<number>(0);
  const NOTIF_THROTTLE_MS = 5000; // Minimum 5s between notification refetches

  const [isChutiLoaded, setIsChutiLoaded] = useState(false);

  useEffect(() => {
    if (initialFetchDone) {
      setIsChutiLoaded(true);
    }
  }, [initialFetchDone]);

  // Fallback trigger after 1 second if dashboard fails to report loaded status
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsChutiLoaded(true);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

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
  useEffect(() => {
    const handleSync = (e: Event) => {
      const customEvent = e as CustomEvent<number>;
      if (typeof customEvent.detail === 'number') {
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

  const fetchNotificationsData = useCallback(async (force = false) => {
    if (!sessionUser || !profile || !isChutiLoaded) return;

    try {
      // 1. Fetch user's own chuti records — SKIP if shared data from ChutiDashboard is available
      if (!hasSharedUserRecords || force) {
        const { data: chutiData, error: chutiError } = await supabase
          .from('chuti')
          .select('id, user_id, date, leave_type, leave_hour, status, comment, adjustment, reserve_holiday, reserve_adjustment_status, admin_edit_request, sign_in_time, sign_out_time, created_at, updated_at')
          .eq('user_id', sessionUser.id)
          .is('deleted_at', null)
          .order('date', { ascending: false });

        if (chutiError) {
          console.error('Failed to fetch user chuti records in useGlobalNotifications:', {
            code: chutiError.code,
            message: chutiError.message,
            details: chutiError.details,
            hint: chutiError.hint
          });
        } else if (chutiData) {
          setUserRecords(chutiData.map(r => ({ ...r, synced: true })));
        }
      }

      // 2. Fetch holiday responses — SKIP if shared data from ChutiDashboard is available
      if (!hasSharedHolidayResponses || force) {
        if (profile?.role === 'admin' || profile?.role === 'supervisor') {
          const { data: holidayData, error: holidayError } = await supabase
            .from('govt_holiday_responses')
            .select('id, user_id, holiday_date, holiday_name, response, created_at')
            .order('created_at', { ascending: false });

          if (holidayError) {
            console.error('Failed to fetch holiday responses in useGlobalNotifications:', {
              code: holidayError.code,
              message: holidayError.message,
              details: holidayError.details,
              hint: holidayError.hint
            });
          } else if (holidayData) {
            setHolidayResponses(holidayData);
          }
        } else {
          const { data: holidayData, error: holidayError } = await supabase
            .from('govt_holiday_responses')
            .select('id, user_id, holiday_date, holiday_name, response, created_at')
            .eq('user_id', sessionUser.id)
            .order('created_at', { ascending: false });

          if (holidayError) {
            console.error('Failed to fetch holiday responses in useGlobalNotifications:', {
              code: holidayError.code,
              message: holidayError.message,
              details: holidayError.details,
              hint: holidayError.hint
            });
          } else if (holidayData) {
            setHolidayResponses(holidayData);
          }
        }
      }

      // 3. Fetch active compliance rules (only if user has quotes workspace access).
      // Rule notifications are non-actionable and filtered out after 7 days
      // client-side, so only pull rules touched within the last 7 days —
      // avoids re-downloading every rule's full content on each refetch.
      if (profile?.has_quotes_access) {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const { data: rulesData, error: rulesError } = await supabase
          .from('compliance_rules')
          .select('id, updated_at, created_at, category, sub_category, content')
          .eq('is_deleted', false)
          .or(`updated_at.gte.${sevenDaysAgo},created_at.gte.${sevenDaysAgo}`);

        if (rulesError) {
          console.error('Failed to fetch compliance rules in useGlobalNotifications:', {
            code: rulesError.code,
            message: rulesError.message,
            details: rulesError.details,
            hint: rulesError.hint
          });
        } else if (rulesData) {
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

        if (adminChutiError) {
          console.error('Failed to fetch admin pending chuti records in useGlobalNotifications:', {
            code: adminChutiError.code,
            message: adminChutiError.message,
            details: adminChutiError.details,
            hint: adminChutiError.hint
          });
        } else if (adminChutiData) {
          // Partial row (count-only); cast to the state's record type.
          setAdminPendingRecords(adminChutiData as unknown as Pick<ChutiRecord, 'id' | 'status' | 'leave_type' | 'reserve_adjustment_status'>[]);
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

        if (supervisorChutiError) {
          console.error('Failed to fetch supervisor pending chuti records in useGlobalNotifications:', {
            code: supervisorChutiError.code,
            message: supervisorChutiError.message,
            details: supervisorChutiError.details,
            hint: supervisorChutiError.hint
          });
        } else if (supervisorChutiData) {
          // Partial row + profiles join (count-only); cast to the state's record type.
          setSupervisorPendingRecords(supervisorChutiData as unknown as ChutiRecordWithProfile[]);
        }
      } else {
        setSupervisorPendingRecords([]);
      }

      // 5. Fetch dismissed notification IDs from DB
      const { data: dismissedData, error: dismissedError } = await supabase
        .from('dismissed_notifications')
        .select('notification_id')
        .eq('user_id', sessionUser.id);

      if (!dismissedError && dismissedData) {
        const dbIds = dismissedData.map(d => d.notification_id);
        setDismissedNotificationIds(prev => {
          const merged = new Set(prev);
          dbIds.forEach(id => merged.add(id));
          
          // Sync merged set back to localStorage for faster initial loads on this device
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
      setIsInitialNotifFetchDone(true);
    } catch (err) {
      console.error('Failed to fetch global notifications data:', err);
      setIsInitialNotifFetchDone(true);
    }
  }, [sessionUser, profile, hasSharedUserRecords, hasSharedHolidayResponses, isChutiLoaded]);

  const handleRealtimeDataChanged = useCallback(() => {
    const now = Date.now();
    if (now - lastNotifFetchRef.current < NOTIF_THROTTLE_MS) return; // Throttle

    if (realtimeDebounceRef.current) clearTimeout(realtimeDebounceRef.current);
    realtimeDebounceRef.current = setTimeout(() => {
      lastNotifFetchRef.current = Date.now();
      fetchNotificationsData();
    }, 2000);
  }, [fetchNotificationsData]);

  // Sync with standard custom DOM event
  useEffect(() => {
    if (!sessionUser) return;
    window.addEventListener('realtime-data-changed', handleRealtimeDataChanged);
    return () => {
      if (realtimeDebounceRef.current) clearTimeout(realtimeDebounceRef.current);
      window.removeEventListener('realtime-data-changed', handleRealtimeDataChanged);
    };
  }, [sessionUser, handleRealtimeDataChanged]);

  const handleProfileRealtimeChange = useCallback((payload: RealtimePayload) => {
    if (payload.eventType === 'UPDATE') {
      // payload.old only contains the primary key (default REPLICA IDENTITY) —
      // compare against the cached previous row instead. password_reset_status
      // is virtual (derived from global_settings), so map the raw row first.
      const newRow = mapProfilePasswordResetStatus(
        payload.new as unknown as Profile,
      ) as Partial<Profile>;
      const prevRow = profilesListRef.current.find(p => p.id === newRow.id);

      const criticalFields: (keyof Profile)[] = [
        'username_request_status',
        'profile_change_status',
        'password_reset_status',
        'role',
        'supervisor_ids',
        'has_quotes_access',
        'has_chuti_access'
      ];

      const hasCriticalChange = !prevRow || criticalFields.some(field => {
        const prevVal = prevRow[field];
        const newVal = newRow[field];
        // supervisor_ids is an array — compare by value, not reference
        if (Array.isArray(prevVal) || Array.isArray(newVal)) {
          return JSON.stringify(prevVal ?? null) !== JSON.stringify(newVal ?? null);
        }
        return prevVal !== newVal;
      });
      if (!hasCriticalChange) return;
    }
    handleRealtimeDataChanged();
  }, [handleRealtimeDataChanged]);

  // Register realtime handlers for profiles and govt_holiday_responses to update notifications in real time
  useRealtimeHandler('profiles', handleProfileRealtimeChange);
  useRealtimeHandler(
    'govt_holiday_responses',
    useCallback(
      (payload) => {
        if (payload.eventType === 'INSERT') {
          const newResp = payload.new as unknown as GovtHolidayResponse;
          setHolidayResponses((prev) => {
            if (prev.some((r) => r.id === newResp.id)) return prev;
            return [newResp, ...prev];
          });
        } else if (payload.eventType === 'UPDATE') {
          const updatedResp = payload.new as unknown as GovtHolidayResponse;
          setHolidayResponses((prev) =>
            prev.map((r) => (r.id === updatedResp.id ? updatedResp : r))
          );
        } else if (payload.eventType === 'DELETE') {
          const oldRespId = payload.old.id as string;
          setHolidayResponses((prev) => prev.filter((r) => r.id !== oldRespId));
        }
        handleRealtimeDataChanged();
      },
      [setHolidayResponses, handleRealtimeDataChanged]
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
  useEffect(() => {
    const handleSync = (e: Event) => {
      const dbIds = (e as CustomEvent).detail as string[];
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
    };
    window.addEventListener('chuti-dismissed-notifications-sync', handleSync);
    return () => {
      window.removeEventListener('chuti-dismissed-notifications-sync', handleSync);
    };
  }, []);

  // Broadcast own dismissed notification changes
  useEffect(() => {
    if (dismissedNotificationIds.size > 0) {
      window.dispatchEvent(
        new CustomEvent('chuti-dismissed-notifications-sync', {
          detail: Array.from(dismissedNotificationIds)
        })
      );
    }
  }, [dismissedNotificationIds]);

  // Listen to last viewed time sync event from other components
  useEffect(() => {
    const handleSync = (e: Event) => {
      const time = (e as CustomEvent).detail as string;
      if (time) setLastViewedTime(time);
    };
    window.addEventListener('chuti-last-viewed-time-sync', handleSync);
    return () => {
      window.removeEventListener('chuti-last-viewed-time-sync', handleSync);
    };
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
    if (!sessionUser || !profile || !isProfileFresh || !isInitialNotifFetchDone) return [];
    const list: NotificationItem[] = [];

    // 1. Govt Holiday Notifications
    if (profile.eligible_govt_holiday !== false) {
      const activeHolidays = (globalSettings.govt_holidays || []).map((h: unknown) => parseHolidayItem(h));

      activeHolidays.forEach((holiday: { date: string; name: string }) => {
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
      const adminHolidayNotifCount = holidayResponses.filter((r: GovtHolidayResponse) => {
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
    window.dispatchEvent(new CustomEvent('chuti-last-viewed-time-sync', { detail: now }));
    // Propagate event so other components know it is read
    window.dispatchEvent(new CustomEvent('chuti-notification-count-change', { detail: 0 }));
  }, []);

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

  const handleSaveHolidayResponse = useCallback(async (holidayDate: string, holidayName: string, choice: 'paid' | 'reserve') => {
    if (!profile) return false;
    
    try {
      const { error } = await supabase
        .from('govt_holiday_responses')
        .upsert({
          user_id: profile.id,
          holiday_date: holidayDate,
          holiday_name: holidayName,
          response: choice
        }, { onConflict: 'user_id,holiday_date' });

      if (error) {
        throw error;
      }
      toast.success(`Choice '${choice === 'paid' ? 'Get Paid' : 'Reserve'}' saved successfully.`);
      await fetchNotificationsData(true);
      return true;
    } catch (err: unknown) {
      const pgErr = err as { message?: string; code?: string; details?: string; hint?: string; status?: number } | null;
      const errMsg = pgErr?.message || String(err);
      const errCode = pgErr?.code || '';
      const errDetails = pgErr?.details || '';
      const errHint = pgErr?.hint || '';
      const errStatus = pgErr?.status ? String(pgErr.status) : '';

      console.error('Failed to save holiday choice detailed error:', {
        message: errMsg,
        code: errCode,
        details: errDetails,
        hint: errHint,
        status: errStatus
      });
      toast.error(`Failed to save choice: ${errMsg}${errHint ? ` (${errHint})` : ''}`);
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

  // Identify government holidays that the user has not responded to yet
  const pendingHolidays = useMemo(() => {
    if (!profile || !isProfileFresh || !isInitialNotifFetchDone) return [];
    return (globalSettings.govt_holidays || [])
      .map((h: unknown) => parseHolidayItem(h))
      .filter((h: { date: string; name: string }) => {
        const responded = holidayResponses.some(r => r.user_id === profile.id && r.holiday_date === h.date);
        return !responded;
      });
  }, [globalSettings.govt_holidays, holidayResponses, profile, isProfileFresh, isInitialNotifFetchDone]);

  return {
    unreadCount,
    notificationsList,
    showNotificationsModal,
    setShowNotificationsModal: setOpenModal,
    handleSaveHolidayResponse,
    handleDismissNotification,
    handleDismissAllNotifications,
    fetchNotificationsData,
    approvalsCount,
    pendingHolidays,
    isInitialNotifFetchDone
  };
}
