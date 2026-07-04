'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/utils/supabase';
import { Profile } from '@/types';
import { ChutiRecord } from '@/utils/offlineSync';
import { NotificationItem } from '@/hooks/useDerivedState';
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
      const { data: holidayData, error: holidayError } = await supabase
        .from('govt_holiday_responses')
        .select('*')
        .eq('user_id', sessionUser.id);

      if (!holidayError && holidayData) {
        setHolidayResponses(holidayData);
      }

      // 3. Fetch active compliance rules
      const { data: rulesData, error: rulesError } = await supabase
        .from('compliance_rules')
        .select('*')
        .eq('is_deleted', false);

      if (!rulesError && rulesData) {
        setRulesRecords(rulesData);
      }

      // 4. Fetch admin approvals (if admin)
      if (profile.role === 'admin') {
        const { data: adminData, error: adminError } = await supabase
          .from('chuti')
          .select('*')
          .or("status.eq.approved_by_supervisor,reserve_adjustment_status.eq.pending")
          .is('deleted_at', null);
        if (!adminError && adminData) {
          setAdminPendingRecords(adminData);
        }
      } else {
        setAdminPendingRecords([]);
      }

      // 5. Fetch supervisor approvals (if supervisor)
      if (profile.role === 'supervisor') {
        const { data: supData, error: supError } = await supabase
          .from('chuti')
          .select('*')
          .eq('status', 'pending_supervisor')
          .is('deleted_at', null);
        if (!supError && supData) {
          const filtered = supData.filter(r => {
            const meta = r.admin_edit_request && typeof r.admin_edit_request === 'object'
              ? (r.admin_edit_request as { supervisor_ids?: string[] })
              : null;
            return meta && Array.isArray(meta.supervisor_ids) && meta.supervisor_ids.includes(profile.id);
          });
          setSupervisorPendingRecords(filtered);
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
    }
  }, []);

  // Run fetch on mount / session change
  useEffect(() => {
    if (sessionUser && profile) {
      fetchNotificationsData();
    }
  }, [sessionUser, profile, fetchNotificationsData]);

  // Subscribe to changes for real-time notifications
  useEffect(() => {
    if (!sessionUser) return;

    const isPrivileged = profile?.role === 'admin' || profile?.role === 'supervisor';
    const filter = isPrivileged ? undefined : `user_id=eq.${sessionUser.id}`;

    const chutiChannel = supabase
      .channel('global-chuti-notif-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chuti', ...(filter ? { filter } : {}) },
        () => {
          fetchNotificationsData();
        }
      )
      .subscribe();

    const holidayChannel = supabase
      .channel('global-holiday-notif-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'govt_holiday_responses', filter: `user_id=eq.${sessionUser.id}` },
        () => {
          fetchNotificationsData();
        }
      )
      .subscribe();

    const rulesChannel = supabase
      .channel('global-rules-notif-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'compliance_rules' },
        () => {
          fetchNotificationsData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(chutiChannel);
      supabase.removeChannel(holidayChannel);
      supabase.removeChannel(rulesChannel);
    };
  }, [sessionUser, profile, fetchNotificationsData]);

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

    // 4. Admin Approvals Notifications
    if (profile.role === 'admin') {
      adminPendingRecords.forEach(r => {
        if (r.status === 'approved_by_supervisor' && r.leave_type !== 'Overtime') {
          list.push({
            id: `pending-leave-${r.id}`,
            type: 'pending_admin_chuti_request',
            timestamp: r.created_at || currentSessionTime,
            title: 'New Leave Request (Admin Approval Pending) ⏳',
            body: `A leave request from ${profilesList.find(p => p.id === r.user_id)?.full_name || 'Staff'} is pending your approval.`,
            chutiId: r.id,
            record: r
          });
        }
        if (r.reserve_adjustment_status === 'pending' || (r.leave_type === 'Overtime' && r.status === 'approved_by_supervisor')) {
          list.push({
            id: `pending-reserve-${r.id}`,
            type: 'pending_admin_reserve_request',
            timestamp: r.created_at || currentSessionTime,
            title: 'Reserve Adjustment Pending Approval ⏳',
            body: `A reserve adjustment request from ${profilesList.find(p => p.id === r.user_id)?.full_name || 'Staff'} is pending your approval.`,
            chutiId: r.id,
            record: r
          });
        }
      });

      profilesList.forEach(p => {
        if (p.profile_change_status === 'pending') {
          list.push({
            id: `pending-profile-${p.id}`,
            type: 'pending_admin_profile_request',
            timestamp: p.created_at || currentSessionTime,
            title: 'Profile Change Request ⏳',
            body: `Profile updates for ${p.full_name || p.username} require your approval.`
          });
        }
        if (p.password_reset_status === 'pending') {
          list.push({
            id: `pending-pwd-${p.id}`,
            type: 'pending_admin_password_request',
            timestamp: p.created_at || currentSessionTime,
            title: 'Password Reset Request ⏳',
            body: `Password reset request for ${p.full_name || p.username} requires your approval.`
          });
        }
      });
    }

    // 5. Supervisor Approvals Notifications
    if (profile.role === 'supervisor') {
      supervisorPendingRecords.forEach(r => {
        list.push({
          id: `pending-sup-${r.id}`,
          type: 'pending_supervisor_request',
          timestamp: r.created_at || currentSessionTime,
          title: 'Supervisor Approval Pending ⏳',
          body: `A leave request from ${profilesList.find(p => p.id === r.user_id)?.full_name || 'Staff'} is pending your approval.`,
          chutiId: r.id,
          record: r
        });
      });
    }

    const filtered = list.filter(n => !dismissedNotificationIds?.has(n.id));
    return filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [
    sessionUser, 
    profile, 
    userRecords, 
    holidayResponses, 
    rulesRecords, 
    adminPendingRecords, 
    supervisorPendingRecords, 
    profilesList, 
    globalSettings.govt_holidays, 
    currentSessionTime, 
    dismissedNotificationIds
  ]);

  // Compute unread count
  const unreadCount = useMemo(() => {
    return notificationsList.filter(
      n => !lastViewedTime || new Date(n.timestamp).getTime() > new Date(lastViewedTime).getTime()
    ).length;
  }, [notificationsList, lastViewedTime]);

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
    // Dismiss all currently visible notifications
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
      console.error('Failed to dismiss notifications:', e);
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
    fetchNotificationsData
  };
}
