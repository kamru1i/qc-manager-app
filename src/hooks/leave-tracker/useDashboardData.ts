'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { User as SupabaseUser, Session } from '@supabase/supabase-js';
import { supabase } from '@/utils/supabase';
import { Profile, ChutiRecordWithProfile, LeaveSettlement, GovtHolidayResponse } from '@/types';
import { mapProfilePasswordResetStatus } from '@/utils/profileHelpers';
import { ChutiRecord, SyncConflict, getOfflineRecords, syncOfflineData, getCacheData, setCacheData, mergeCacheData, removeCacheItems, upsertCacheItem, getGlobalSettingsCache, setGlobalSettingsCache, getSyncTimestamp, setSyncTimestamp, purgeStaleCacheData } from '@/utils/offlineSync';
import { checkSubscriptionStatus, sendPushNotification } from '@/utils/webPushHelper';
import { getGlobalSettingsFromProfile, defaultGlobalSettings, GlobalSettings, formatDate, parseHolidayItem } from '@/utils/dashboardHelpers';
import { useRealtimeHandler, RealtimePayload } from '@/contexts/RealtimeContext';

export const useDashboardData = () => {

  const fetchingRef = useRef<boolean>(false);
  const [sessionUser, setSessionUser] = useState<SupabaseUser | null>(null);
  const sessionUserRef = useRef<SupabaseUser | null>(null);
  useEffect(() => {
    sessionUserRef.current = sessionUser;
  }, [sessionUser]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isPushSubscribed, setIsPushSubscribed] = useState(false);
  const [isPushLoading, setIsPushLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [initialFetchDone, setInitialFetchDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [offlineCount, setOfflineCount] = useState(0);
  const [message, setMessageState] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const setMessage = useCallback((msg: { type: 'success' | 'error'; text: string } | null) => {
    setMessageState(msg);
    if (msg) {
      if (msg.type === 'success') {
        toast.success(msg.text, { id: msg.text });
      } else {
        toast.error(msg.text, { id: msg.text });
      }
    }
  }, []);

  // Lists states
  const [userRecords, setUserRecords] = useState<ChutiRecord[]>([]);
  const [adminRecords, setAdminRecords] = useState<ChutiRecordWithProfile[]>([]);
  const [profilesList, setProfilesList] = useState<Profile[]>([]);
  const [holidayResponses, setHolidayResponses] = useState<GovtHolidayResponse[]>([]);
  const [leaveSettlements, setLeaveSettlements] = useState<LeaveSettlement[]>([]);

  // Keep a ref of profilesList to avoid subscription re-run cycles
  const profilesListRef = useRef<Profile[]>([]);
  useEffect(() => {
    profilesListRef.current = profilesList;
  }, [profilesList]);

  const realtimeDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Navigation / Tab states
  const [adminActiveTab, setAdminActiveTab] = useState<'user' | 'admin'>('admin');
  const [viewingStaffId, setViewingStaffIdState] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('viewingStaffId') || null;
    }
    return null;
  });

  const setViewingStaffId = useCallback((idOrFn: string | null | ((prev: string | null) => string | null)) => {
    setViewingStaffIdState((prev) => {
      const next = typeof idOrFn === 'function' ? idOrFn(prev) : idOrFn;
      if (typeof window !== 'undefined') {
        if (next) {
          sessionStorage.setItem('viewingStaffId', next);
        } else {
          sessionStorage.removeItem('viewingStaffId');
        }
      }
      return next;
    });
  }, []);

  // Notification last viewed
  const [lastViewedTime, setLastViewedTime] = useState<string>('');

  // Theme Toggle state
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Global Settings state
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings>(defaultGlobalSettings);

  // Fetch Chuti Records based on Role
  const fetchRecords = useCallback(async () => {
    if (!sessionUser || !profile) return;
    if (fetchingRef.current) return;
    fetchingRef.current = true;

    // Check if offline
    if (typeof window !== 'undefined' && !navigator.onLine) {
      try {
        console.log('App is offline, loading cached data...');
        // Load profiles cache
        const cachedProfiles = await getCacheData('profiles_cache');
        if (cachedProfiles.length > 0) {
          setProfilesList(cachedProfiles);
        }

        // Load chuti records cache
        const cachedChuti = await getCacheData('chuti_cache');
        // Retrieve unsynced records
        const unsyncedRecords = await getOfflineRecords();

        // Merge them: if we have temp local records, prepend them.
        // Also, if any of the unsynced records are edits/deletes, handle them:
        // - For delete: exclude from display.
        // - For update: merge updates.
        const deletedIds = new Set(
          unsyncedRecords.filter(r => r.action === 'delete').map(r => r.id)
        );
        const updatedRecordsMap = new Map(
          unsyncedRecords.filter(r => r.action === 'update').map(r => [r.id, r.data])
        );

        const mergedChuti = cachedChuti
          .filter(r => !deletedIds.has(r.id))
          .map(r => {
            const updates = updatedRecordsMap.get(r.id);
            if (updates) {
              return { ...r, ...updates };
            }
            return r;
          });

        // Combine with pending inserts
        const pendingInserts = unsyncedRecords.filter(r => r.action === 'insert' || !r.action);
        const finalChuti = [...pendingInserts, ...mergedChuti];

        if (profile.role === 'admin' || profile.role === 'supervisor') {
          setAdminRecords(finalChuti as ChutiRecordWithProfile[]);
        }

        const loggedInUserChuti = finalChuti.filter(r => r.user_id === sessionUser.id);
        setUserRecords(loggedInUserChuti);

        // Load holiday responses cache
        const cachedResponses = await getCacheData('holiday_responses_cache');
        setHolidayResponses(cachedResponses);

        // Load leave settlements cache
        const cachedSettlements = await getCacheData('settlements_cache');
        setLeaveSettlements(cachedSettlements);

        // Load global settings cache
        const cachedSettings = await getGlobalSettingsCache();
        if (cachedSettings) {
          setGlobalSettings(cachedSettings);
        }
      } catch (err) {
        console.error('Error loading offline cache:', err);
      } finally {
        setInitialFetchDone(true);
      }
      return;
    }

    try {
      // Capture the sync timestamp BEFORE issuing queries. Using a post-fetch
      // timestamp would create a race window where rows modified during the fetch
      // could be missed by the next delta query.
      const syncStartedAt = new Date().toISOString();

      let profilesData: Profile[] = [];
      let adminRecordsData: ChutiRecordWithProfile[] = [];
      let userRecordsData: ChutiRecord[] = [];
      let responsesData: GovtHolidayResponse[] = [];
      let settlementsData: LeaveSettlement[] = [];

      // 1. Fetch profiles and admin chuti list if admin/supervisor
      if (profile.role === 'admin' || profile.role === 'supervisor') {
        const { data: profiles, error: profilesErr } = await supabase
          .from('profiles')
          .select('*')
          .order('username', { ascending: true });

        if (!profilesErr && profiles) {
          const mapped = profiles.map((p) => mapProfilePasswordResetStatus(p));
          profilesData = mapped;
          setProfilesList(mapped);
        }

        const lastChutiSync = await getSyncTimestamp('chuti');
        if (lastChutiSync) {
          const { data: deltaRecords, error } = await supabase
            .from('chuti')
            .select(`
              *,
              profiles (username, full_name, role, supervisor_ids)
            `)
            .gte('updated_at', lastChutiSync)
            .order('date', { ascending: false });

          if (!error && deltaRecords && deltaRecords.length > 0) {
            const deletedIds = deltaRecords.filter(r => r.deleted_at).map(r => r.id);
            const activeDelta = deltaRecords.filter(r => !r.deleted_at);

            if (activeDelta.length > 0) await mergeCacheData('chuti_cache', activeDelta);
            if (deletedIds.length > 0) await removeCacheItems('chuti_cache', deletedIds);

            const fullCachedChuti = await getCacheData('chuti_cache');
            setAdminRecords(fullCachedChuti as ChutiRecordWithProfile[]);
            adminRecordsData = fullCachedChuti as ChutiRecordWithProfile[];
          } else if (!error) {
            const fullCachedChuti = await getCacheData('chuti_cache');
            if (fullCachedChuti.length > 0) {
              setAdminRecords(fullCachedChuti as ChutiRecordWithProfile[]);
              adminRecordsData = fullCachedChuti as ChutiRecordWithProfile[];
            }
          } else if (error) {
            console.error('Delta fetch failed, falling back to full fetch:', error);
            let allData: ChutiRecordWithProfile[] = [];
            let page = 0;
            const pageSize = 1000;
            let hasMore = true;
            let syncError = null;

            while (hasMore) {
              const from = page * pageSize;
              const to = from + pageSize - 1;

              const { data, error: fullErr } = await supabase
                .from('chuti')
                .select(`*, profiles (username, full_name, role, supervisor_ids)`)
                .is('deleted_at', null)
                .order('date', { ascending: false })
                .range(from, to);

              if (fullErr) {
                syncError = fullErr;
                break;
              }

              if (data && data.length > 0) {
                allData = [...allData, ...data];
                if (data.length < pageSize) {
                  hasMore = false;
                } else {
                  page++;
                }
              } else {
                hasMore = false;
              }
            }

            if (!syncError && allData.length > 0) {
              setAdminRecords(allData);
              adminRecordsData = allData;
            }
          }
        } else {
          let allData: ChutiRecordWithProfile[] = [];
          let page = 0;
          const pageSize = 1000;
          let hasMore = true;
          let syncError = null;

          while (hasMore) {
            const from = page * pageSize;
            const to = from + pageSize - 1;

            const { data, error } = await supabase
              .from('chuti')
              .select(`
                *,
                profiles (username, full_name, role, supervisor_ids)
              `)
              .is('deleted_at', null)
              .order('date', { ascending: false })
              .range(from, to);

            if (error) {
              syncError = error;
              break;
            }

            if (data && data.length > 0) {
              allData = [...allData, ...data];
              if (data.length < pageSize) {
                hasMore = false;
              } else {
                page++;
              }
            } else {
              hasMore = false;
            }
          }

          if (!syncError && allData.length > 0) {
            setAdminRecords(allData);
            adminRecordsData = allData;
          }
        }
      } else {
        // For normal users, fetch only supervisor list
        const { data: supervisors, error: profilesErr } = await supabase
          .from('profiles')
          .select('id, username, role, full_name')
          .eq('role', 'supervisor')
          .order('username', { ascending: true });

        if (!profilesErr && supervisors) {
          profilesData = supervisors as Profile[];
          setProfilesList(supervisors as Profile[]);
        }
      }

      // 2. Fetch logged-in user records
      const lastUserChutiSync = await getSyncTimestamp('chuti_user');
      if (lastUserChutiSync) {
        const { data: deltaRecords, error } = await supabase
          .from('chuti')
          .select('*')
          .eq('user_id', sessionUser.id)
          .gte('updated_at', lastUserChutiSync)
          .order('date', { ascending: false });

        if (!error && deltaRecords && deltaRecords.length > 0) {
          const deletedIds = new Set(deltaRecords.filter(r => r.deleted_at).map(r => r.id));
          const cachedUserChuti = (await getCacheData('chuti_cache')).filter(r => r.user_id === sessionUser.id);
          const mergedMap = new Map(cachedUserChuti.map(r => [r.id, r]));
          deltaRecords.forEach(r => {
            if (r.deleted_at) {
              mergedMap.delete(r.id);
            } else {
              mergedMap.set(r.id, r);
            }
          });
          const mergedUserRecords = Array.from(mergedMap.values());
          setUserRecords(mergedUserRecords);
          userRecordsData = mergedUserRecords;

          if (deletedIds.size > 0) await removeCacheItems('chuti_cache', Array.from(deletedIds));
        } else if (!error) {
          const cachedUserChuti = (await getCacheData('chuti_cache')).filter(r => r.user_id === sessionUser.id);
          if (cachedUserChuti.length > 0) {
            setUserRecords(cachedUserChuti);
            userRecordsData = cachedUserChuti;
          }
        } else if (error) {
          console.error('User delta fetch failed, falling back to full fetch:', error);
          const { data: records, error: fullErr } = await supabase
            .from('chuti')
            .select('*')
            .eq('user_id', sessionUser.id)
            .is('deleted_at', null)
            .order('date', { ascending: false });
          if (!fullErr && records) {
            setUserRecords(records);
            userRecordsData = records;
          }
        }
      } else {
        const { data: records, error } = await supabase
          .from('chuti')
          .select('*')
          .eq('user_id', sessionUser.id)
          .is('deleted_at', null)
          .order('date', { ascending: false });

        if (!error && records) {
          setUserRecords(records);
          userRecordsData = records;
        }
      }

      // 3. Fetch Govt Holiday Responses and settlements
      if (profile.role === 'admin' || profile.role === 'supervisor') {
        const { data: responses, error: respError } = await supabase
          .from('govt_holiday_responses')
          .select(`
            *,
            profiles (full_name, username)
          `)
          .order('created_at', { ascending: false });
        if (!respError && responses) {
          setHolidayResponses(responses);
          responsesData = responses;
        }

        const { data: settlements, error: settError } = await supabase
          .from('leave_settlements')
          .select(`
            *,
            profiles!leave_settlements_user_id_fkey (full_name, username)
          `)
          .order('created_at', { ascending: false });
        if (!settError && settlements) {
          setLeaveSettlements(settlements);
          settlementsData = settlements;
        }
      } else {
        const { data: responses, error: respError } = await supabase
          .from('govt_holiday_responses')
          .select('*')
          .eq('user_id', sessionUser.id)
          .order('created_at', { ascending: false });
        if (!respError && responses) {
          setHolidayResponses(responses);
          responsesData = responses;
        }

        const { data: settlements, error: settError } = await supabase
          .from('leave_settlements')
          .select('*')
          .eq('user_id', sessionUser.id)
          .order('created_at', { ascending: false });
        if (!settError && settlements) {
          setLeaveSettlements(settlements);
          settlementsData = settlements;
        }
      }

      // 4. Asynchronously merge fetched data into IndexedDB cache (non-destructive upsert)
      try {
        if (profilesData.length > 0) {
          await mergeCacheData('profiles_cache', profilesData);
        }

        // Cache chuti records (merge-based since we use delta sync)
        const recordsToCache = (profile.role === 'admin' || profile.role === 'supervisor')
          ? adminRecordsData
          : userRecordsData;
        if (recordsToCache.length > 0) {
          await mergeCacheData('chuti_cache', recordsToCache);
        }

        if (profile.role === 'admin' || profile.role === 'supervisor') {
          if (adminRecordsData.length > 0) {
            await setSyncTimestamp('chuti', syncStartedAt);
          }
        }
        if (userRecordsData.length > 0) {
          await setSyncTimestamp('chuti_user', syncStartedAt);
        }

        if (responsesData.length > 0) {
          await setCacheData('holiday_responses_cache', responsesData);
          await setSyncTimestamp('govt_holiday_responses', syncStartedAt);
        }
        if (settlementsData.length > 0) {
          await setCacheData('settlements_cache', settlementsData);
          await setSyncTimestamp('leave_settlements', syncStartedAt);
        }

        await setSyncTimestamp('profiles', syncStartedAt);

        // Store current globalSettings to cache if they are derived
        const currentGlobalSettings = (profile.role === 'admin' || profile.role === 'supervisor')
          ? getGlobalSettingsFromProfile(profilesData.find(p => p.role === 'admin') || profile)
          : getGlobalSettingsFromProfile(profile);
        await setGlobalSettingsCache(currentGlobalSettings);

        // TTL: Purge chuti records older than 2 years from cache
        try {
          const purgedCount = await purgeStaleCacheData('chuti_cache', 'date', 90);
          if (purgedCount > 0) {
            console.log(`TTL: Purged ${purgedCount} stale chuti records (>90 days old) from cache.`);
          }
        } catch (ttlErr) {
          console.error('TTL purge failed (non-critical):', ttlErr);
        }
      } catch (cacheErr) {
        console.error('Failed to update IndexedDB cache:', cacheErr);
      }

    } catch (err) {
      console.error('Error fetching online records:', err);
    } finally {
      fetchingRef.current = false;
      setInitialFetchDone(true);
    }
  }, [sessionUser, profile]);

  const handleSaveGlobalSettings = useCallback(async (newSettings: GlobalSettings, options?: { silent?: boolean }) => {
    if (!profile) return false;
    const hasGlobalSettingsColumn = 'global_settings' in profile;
    const updates: Record<string, unknown> = {};
    if (hasGlobalSettingsColumn) {
      updates.global_settings = newSettings;
    } else {
      updates.requested_default_sign_in = JSON.stringify(newSettings);
    }

    // Compare old and new government holidays to detect newly added ones
    const oldHolidays = (globalSettings.govt_holidays || []).map((h: string) => parseHolidayItem(h));
    const newHolidays = (newSettings.govt_holidays || []).map((h: string) => parseHolidayItem(h));
    const oldDates = new Set(oldHolidays.map(h => h.date));
    const addedHolidays = newHolidays.filter(h => h.date && !oldDates.has(h.date));

    setLoading(true);
    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .neq('role', 'none');

    if (error) {
      console.error('Error saving global settings:', error);
      setMessage({ type: 'error', text: 'Failed to save settings: ' + error.message });
      setLoading(false);
      return false;
    }

    setGlobalSettings(newSettings);
    if (!options?.silent) {
      setMessage({ type: 'success', text: 'Leave quota settings successfully updated!' });
    }
    setLoading(false);
    fetchRecords();

    // Send push notifications for newly added holidays
    if (addedHolidays.length > 0) {
      addedHolidays.forEach((h) => {
        const reserveFalseIds = profilesList
          .filter(p => p.eligible_govt_holiday !== false && p.allow_reserve === false)
          .map(p => p.id);

        const reserveTrueIds = profilesList
          .filter(p => p.eligible_govt_holiday !== false && p.allow_reserve !== false)
          .map(p => p.id);

        if (reserveFalseIds.length > 0) {
          // Auto-save 'paid' response in govt_holiday_responses for reserve-disabled users
          const autoResponses = reserveFalseIds.map(userId => ({
            user_id: userId,
            holiday_date: h.date,
            holiday_name: h.name,
            response: 'paid'
          }));

          supabase
            .from('govt_holiday_responses')
            .upsert(autoResponses, { onConflict: 'user_id,holiday_date' })
            .then(({ error: upsertError }) => {
              if (upsertError) {
                console.error('Error auto-saving paid responses for holiday:', h.name, upsertError);
              }
            });

          sendPushNotification({
            userIds: reserveFalseIds,
            title: 'Govt Holiday Payment Approved 🎉',
            body: `${h.name} (${formatDate(h.date)}) Govt Holiday payment has been approved to be paid with your salary.`,
            url: '/'
          }).catch(err => console.error('Error sending push notification to paid users:', err));
        }

        if (reserveTrueIds.length > 0) {
          sendPushNotification({
            userIds: reserveTrueIds,
            title: 'Select Govt Holiday Preference 🔔',
            body: `What would you like to do for this government holiday: ${h.name} (${formatDate(h.date)})?`,
            url: '/'
          }).catch(err => console.error('Error sending push notification to reserve-enabled users:', err));
        }
      });
    }

    return true;
  }, [profile, globalSettings.govt_holidays, profilesList, fetchRecords, setMessage]);

  const handleSaveHolidayResponse = useCallback(async (holidayDate: string, holidayName: string, response: 'paid' | 'reserve') => {
    if (!sessionUser) return false;

    setLoading(true);
    const { error } = await supabase
      .from('govt_holiday_responses')
      .upsert({
        user_id: sessionUser.id,
        holiday_date: holidayDate,
        holiday_name: holidayName,
        response: response
      }, {
        onConflict: 'user_id,holiday_date'
      });

    if (error) {
      console.error('Error saving holiday response:', error);
      setMessage({ type: 'error', text: 'Failed to save response: ' + error.message });
      setLoading(false);
      return false;
    }

    // Trigger push notification to admins
    const staffName = profile?.full_name || 'Staff';
    const staffCode = profile?.username ? profile.username.toUpperCase() : 'N/A';
    const titleText = 'Govt Holiday Response Report 🔔';
    const bodyText = response === 'reserve'
      ? `${staffName} (${staffCode}) has requested to reserve the leave for ${holidayName} (${formatDate(holidayDate)}).`
      : `${staffName} (${staffCode}) has requested to get paid for ${holidayName} (${formatDate(holidayDate)}).`;

    sendPushNotification({
      userIds: ['admins'],
      title: titleText,
      body: bodyText,
      url: '/'
    }).catch(err => console.error('Error sending push notification to admins for holiday choice:', err));

    setMessage({ type: 'success', text: 'Your preference has been successfully saved!' });
    setLoading(false);
    fetchRecords();
    return true;
  }, [sessionUser, profile, fetchRecords, setMessage]);

  const handleAdminUpdateHolidayResponse = useCallback(async (targetUserId: string, holidayDate: string, holidayName: string, response: 'paid' | 'reserve') => {
    if (!profile || profile.role !== 'admin') return false;

    setLoading(true);

    // 1. Check existing preference
    const { data: existingResponse } = await supabase
      .from('govt_holiday_responses')
      .select('response')
      .eq('user_id', targetUserId)
      .eq('holiday_date', holidayDate)
      .maybeSingle();

    const wasReserved = existingResponse?.response === 'reserve';
    const isNowPaid = response === 'paid';

    // 2. Perform the update
    const { error } = await supabase
      .from('govt_holiday_responses')
      .upsert({
        user_id: targetUserId,
        holiday_date: holidayDate,
        holiday_name: holidayName,
        response: response,
        updated_by_admin: true,
        created_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,holiday_date'
      });

    if (error) {
      console.error('Error admin-saving holiday response:', error);
      setMessage({ type: 'error', text: 'Failed to update response: ' + error.message });
      setLoading(false);
      return false;
    }

    // 3. If preference was reserve and is now paid, automatically unadjust excess leaves
    if (wasReserved && isNowPaid) {
      try {
        const selectedYear = holidayDate.substring(0, 4);

        // Fetch new reserved count
        const { data: activeReserveResponses } = await supabase
          .from('govt_holiday_responses')
          .select('*')
          .eq('user_id', targetUserId)
          .eq('response', 'reserve');

        const newReservedCount = (activeReserveResponses || []).filter(
          r => r.holiday_date.substring(0, 4) === selectedYear
        ).length;

        // Fetch user's adjusted full leaves in the same year
        const { data: userLeaves } = await supabase
          .from('chuti')
          .select('*')
          .eq('user_id', targetUserId)
          .eq('leave_type', 'Full Leave')
          .eq('adjustment', true)
          .gte('date', `${selectedYear}-01-01`)
          .lte('date', `${selectedYear}-12-31`)
          .is('deleted_at', null);

        const govtHolidayLeaves = (userLeaves || []).filter(r =>
          r.comment?.includes("Govt Holiday") || r.reserve_holiday === "Govt Holiday"
        );

        // If taken adjusted leaves exceed reserve count, unadjust the excess
        if (govtHolidayLeaves.length > newReservedCount) {
          const excessCount = govtHolidayLeaves.length - newReservedCount;
          // Sort by date descending (unadjust most recent first)
          govtHolidayLeaves.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          const leavesToUnadjust = govtHolidayLeaves.slice(0, excessCount);

          for (const leaf of leavesToUnadjust) {
            let cleanComment = leaf.comment || '';
            // Clean prefix "Adjusted: Govt Holiday | "
            cleanComment = cleanComment.replace(/Adjusted:\s*Govt Holiday(?:\s*\|\s*)?/g, '').trim();

            await supabase
              .from('chuti')
              .update({
                adjustment: false,
                reserve_holiday: null,
                comment: cleanComment || null
              })
              .eq('id', leaf.id);
          }
        }
      } catch (unadjustErr) {
        console.error('Error auto-unadjusting leaves:', unadjustErr);
      }
    }

    // Trigger push notification to updated user
    sendPushNotification({
      userIds: [targetUserId],
      title: 'Govt Holiday Choice Updated 💸',
      body: `Admin has updated your preference for ${holidayName} (${formatDate(holidayDate)}) to ${response === 'reserve' ? 'Reserve' : 'Get Paid'}.`,
      url: '/'
    }).catch(err => console.error('Error sending push notification to user:', err));

    setMessage({ type: 'success', text: 'Holiday response updated successfully!' });
    setLoading(false);
    fetchRecords();
    return true;
  }, [profile, fetchRecords, setMessage]);

  const handleSaveLeaveSettlementsBulk = useCallback(async (
    settlementsList: Array<{
      id?: string;
      user_id: string;
      year: string;
      period: 'H1' | 'H2' | 'Instant';
      leave_category: 'Govt Holiday' | 'Eid-ul-Fitr' | 'Eid-ul-Adha' | 'Office Leave';
      remaining_days: number;
      action_type: 'carry_forward' | 'payment' | 'adjust_leave' | 'split';
      status?: 'initiated' | 'responded' | 'processed';
      processed_by?: string | null;
      action_by?: string;
      carry_forward_days?: number;
      payment_days?: number;
      adjust_leave_days?: number;
    }>
  ) => {
    try {
      setLoading(true);
      const formatted = settlementsList.map(item => {
        // Compute splits
        let cf = item.carry_forward_days;
        let pay = item.payment_days;
        let adj = item.adjust_leave_days;

        // Backward compatibility fallback
        if (cf === undefined && pay === undefined && adj === undefined) {
          cf = item.action_type === 'carry_forward' ? item.remaining_days : 0;
          pay = item.action_type === 'payment' ? item.remaining_days : 0;
          adj = item.action_type === 'adjust_leave' ? item.remaining_days : 0;
        } else {
          cf = cf ?? 0;
          pay = pay ?? 0;
          adj = adj ?? 0;
        }

        // Determine action_type
        let computedActionType: 'carry_forward' | 'payment' | 'adjust_leave' | 'split' = 'carry_forward';
        const activeCount = [Math.abs(cf) > 0.01, Math.abs(pay) > 0.01, Math.abs(adj) > 0.01].filter(Boolean).length;
        if (activeCount > 1) {
          computedActionType = 'split';
        } else if (Math.abs(cf) > 0.01) {
          computedActionType = 'carry_forward';
        } else if (Math.abs(pay) > 0.01) {
          computedActionType = 'payment';
        } else if (Math.abs(adj) > 0.01) {
          computedActionType = 'adjust_leave';
        }

        return {
          ...(item.id ? { id: item.id } : {}),
          user_id: item.user_id,
          year: item.year,
          period: item.period,
          leave_category: item.leave_category,
          remaining_days: item.remaining_days,
          action_type: computedActionType,
          status: item.status || 'processed',
          processed_by: item.processed_by || null,
          processed_at: (item.status === 'processed') ? new Date().toISOString() : null,
          action_by: item.action_by || item.user_id,
          carry_forward_days: cf,
          payment_days: pay,
          adjust_leave_days: adj,
        };
      });

      const { error } = await supabase
        .from('leave_settlements')
        .upsert(formatted, {
          onConflict: 'user_id,year,period,leave_category'
        });

      if (error) throw error;

      // Trigger push notifications conditionally based on status
      const uniqueUserIds = Array.from(new Set(formatted.map(s => s.user_id)));
      for (const targetUserId of uniqueUserIds) {
        const userSettlements = formatted.filter(s => s.user_id === targetUserId);
        const firstSettle = userSettlements[0];
        if (!firstSettle) continue;

        const staff = profilesList.find(p => p.id === targetUserId);
        const staffName = staff?.full_name || staff?.username || 'Staff';
        const periodLabel = firstSettle.period === 'H1' ? 'January-June (H1)' : firstSettle.period === 'H2' ? 'July-December (H2)' : 'Instant';

        const details = userSettlements.map(s => {
          let actionText = '';
          const cf = s.carry_forward_days ?? 0;
          const pay = s.payment_days ?? 0;
          const adj = s.adjust_leave_days ?? 0;

          if (s.remaining_days < 0) {
            if (s.action_type === 'payment') {
              actionText = 'Salary Deduction';
            } else if (s.action_type === 'carry_forward') {
              actionText = s.period === 'H1' ? 'Adjust with H2 Office Leave' : "Adjust with Next Year's H1";
            } else if (s.action_type === 'adjust_leave') {
              actionText = 'Adjust with Holiday/Eid Reserve';
            }
          } else {
            if (s.action_type === 'split') {
              const parts: string[] = [];
              if (cf > 0) parts.push(`${cf}d Carry Forward`);
              if (pay > 0) parts.push(`${pay}d Payout`);
              if (adj > 0) parts.push(`${adj}d Adjusted`);
              actionText = `Split (${parts.join(', ')})`;
            } else {
              actionText = s.action_type === 'carry_forward' ? 'Carry Forward' : s.action_type === 'payment' ? 'Payment' : 'Adjust Leaves';
            }
          }
          return `${s.leave_category}: ${actionText} (${s.remaining_days} days)`;
        }).join(', ');

        if (firstSettle.status === 'processed') {
          // Notify the user that their choices are processed
          sendPushNotification({
            userIds: [targetUserId],
            title: 'Leave Settlement Processed ✅',
            body: `Your leave preference/settlement for ${firstSettle.leave_category} (${periodLabel}) has been processed: ${details}.`,
            url: '/'
          }).catch(err => console.error('Error sending push notification to user:', err));
        } else if (firstSettle.status === 'initiated') {
          // Notify the user that preference is requested
          sendPushNotification({
            userIds: [targetUserId],
            title: 'Leave Preference Required 📥',
            body: `Admin requested your choice for ${firstSettle.leave_category} (${periodLabel}) leave settlement.`,
            url: '/'
          }).catch(err => console.error('Error sending push notification to user:', err));
        } else if (firstSettle.status === 'responded') {
          // Notify the admins/supervisors that user submitted preference
          const adminIds = profilesList.filter(p => p.role === 'admin').map(p => p.id);
          if (adminIds.length > 0) {
            sendPushNotification({
              userIds: adminIds,
              title: 'Leave Preference Submitted 📥',
              body: `${staffName} submitted choice for ${firstSettle.leave_category} (${periodLabel}): ${details}.`,
              url: '/?tab=admin'
            }).catch(err => console.error('Error sending push notification to admins:', err));
          }
        }
      }

      const isInitiated = formatted.every(s => s.status === 'initiated');
      const isResponded = formatted.every(s => s.status === 'responded');

      if (!isInitiated) {
        if (isResponded) {
          setMessage({ type: 'success', text: 'Leave preference submitted successfully!' });
        } else {
          setMessage({ type: 'success', text: 'Settlement choices processed successfully!' });
        }
      }

      await fetchRecords();
      setLoading(false);
      return true;
    } catch (err) {
      console.error('Error bulk saving leave settlements:', err);
      setMessage({ type: 'error', text: 'Failed to process settlements: ' + (err as Error).message });
      setLoading(false);
      return false;
    }
  }, [fetchRecords, setMessage, profilesList]);

  const handleDeleteLeaveSettlement = useCallback(async (id: string) => {
    try {
      setLoading(true);
      const { error } = await supabase
        .from('leave_settlements')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setMessage({ type: 'success', text: 'Settlement record removed successfully!' });
      await fetchRecords();
      setLoading(false);
      return true;
    } catch (err) {
      console.error('Error deleting leave settlement:', err);
      setMessage({ type: 'error', text: 'Failed to delete settlement: ' + (err as Error).message });
      setLoading(false);
      return false;
    }
  }, [fetchRecords, setMessage]);

  useEffect(() => {
    if (profile) {
      // Find the first admin profile in profilesList with custom settings, or fall back to the first admin profile
      const adminProfile = profilesList.find(p => p.role === 'admin' && p.global_settings && JSON.stringify(p.global_settings) !== JSON.stringify(defaultGlobalSettings))
        || profilesList.find(p => p.role === 'admin');

      if (adminProfile && (profile.role === 'admin' || profile.role === 'supervisor')) {
        setGlobalSettings(getGlobalSettingsFromProfile(adminProfile));
      } else {
        setGlobalSettings(getGlobalSettingsFromProfile(profile));
      }
    }
  }, [profile, profilesList]);

  // Load theme on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('theme') || 'dark';
      setTheme(savedTheme as 'dark' | 'light');
      if (savedTheme === 'light') {
        document.documentElement.classList.remove('dark');
      } else {
        document.documentElement.classList.add('dark');
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const handleGlobalThemeChange = (e: Event) => {
        const nextTheme = (e as CustomEvent).detail;
        setTheme(nextTheme);
      };
      window.addEventListener('theme-change', handleGlobalThemeChange);
      return () => {
        window.removeEventListener('theme-change', handleGlobalThemeChange);
      };
    }
  }, []);

  // Theme toggle handler
  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    if (typeof window !== 'undefined') {
      localStorage.setItem('theme', nextTheme);
    }
    if (nextTheme === 'light') {
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
    }
  };

  // Modal visibility states
  const [showLeaveApprovalModal, setShowLeaveApprovalModal] = useState(false);
  const [showSupervisorApprovalModal, setShowSupervisorApprovalModal] = useState(false);
  const [showUserNotificationsModal, setShowUserNotificationsModal] = useState(false);

  // Approval status sets
  const [approvingIds, setApprovingIds] = useState<Set<string>>(new Set());
  const [reviewingIds, setReviewingIds] = useState<Set<string>>(new Set());
  const [approvedIds, setApprovedIds] = useState<Set<string>>(new Set());


  // Sync Check Loop
  const checkOfflineQueue = useCallback(async () => {
    const records = await getOfflineRecords();
    setOfflineCount(records.length);
  }, []);

  useEffect(() => {
    checkOfflineQueue();
  }, [checkOfflineQueue]);



  useEffect(() => {
    if (!loading && sessionUser && profile) {
      fetchRecords();
    }
  }, [loading, sessionUser, profile, fetchRecords]);

  // Load last viewed notification timestamp
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('last_viewed_notifications_time');
      if (stored) {
        setLastViewedTime(stored);
      }
    }
  }, []);

  // Auto Sync Handler
  const triggerAutoSync = useCallback(async () => {
    if (!navigator.onLine) return;
    const res = await syncOfflineData();
    if (res.syncedCount > 0) {
      setMessage({ type: 'success', text: `${res.syncedCount} offline records successfully saved to cloud!` });
      checkOfflineQueue();
      fetchRecords();
    }
    // Show conflict notifications if any
    if (res.conflicts && res.conflicts.length > 0) {
      res.conflicts.forEach((c: SyncConflict) => {
        toast.error(c.reason, { duration: 8000, id: `conflict-${c.recordId}` });
      });
    }
  }, [checkOfflineQueue, fetchRecords, setMessage]);

  // Auto Sync on Mount / Login
  useEffect(() => {
    if (isOnline && sessionUser) {
      triggerAutoSync();
    }
  }, [isOnline, sessionUser, triggerAutoSync]);

  // Network Status Monitor
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsOnline(navigator.onLine);
      const handleOnline = () => {
        setIsOnline(true);
        triggerAutoSync();
      };
      const handleOffline = () => {
        setIsOnline(false);
      };

      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
  }, [triggerAutoSync]);

  // Listen for real-time updates via the centralized RealtimeProvider.
  // Throttle: prevent rapid cascading refetches — minimum 3s between full fetches
  const lastRealtimeFetchRef = useRef<number>(0);
  const REALTIME_THROTTLE_MS = 3000;

  const handleRealtimeChange = useCallback(() => {
    // Notify useGlobalNotifications via DOM event (replaces its duplicate subscription)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('realtime-data-changed'));
    }

    const now = Date.now();
    if (now - lastRealtimeFetchRef.current < REALTIME_THROTTLE_MS) return; // Throttle

    if (realtimeDebounceRef.current) clearTimeout(realtimeDebounceRef.current);
    realtimeDebounceRef.current = setTimeout(() => {
      lastRealtimeFetchRef.current = Date.now();
      fetchRecords();
    }, 800);
  }, [fetchRecords]);

  // ── chuti handler ──
  const handleChutiRealtime = useCallback((payload: RealtimePayload) => {
    console.log('Realtime chuti change received:', payload);
    // Forward so UserManagementDashboard can react without its own chuti subscription
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('realtime-table-payload', { detail: { table: 'chuti', payload } }));
    }
    handleRealtimeChange();
  }, [handleRealtimeChange]);

  // ── profiles handler ──
  const handleProfilesRealtime = useCallback((payload: RealtimePayload) => {
    if (!sessionUser) return;
    console.log('Realtime profile change received:', payload);
    const newRow = payload.new as Partial<Profile>;
    const oldRow = payload.old as Partial<Profile>;
    // Forward for quotes workspace
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('realtime-profile-payload', { detail: payload }));
    }
    if (payload.eventType === 'DELETE' && oldRow?.id === sessionUser.id) {
      console.log('Your profile has been deleted by admin. Logging out...');
      const handleForceLogout = async () => {
        try {
          await supabase.auth.signOut();
        } catch (e) {
          console.error(e);
        }
        localStorage.removeItem(`session_start_time_${sessionUser.id}`);
        localStorage.removeItem(`last_access_time_${sessionUser.id}`);
        setSessionUser(null);
        setProfile(null);
      };
      handleForceLogout();
      return;
    }
    if (payload.eventType === 'UPDATE' && newRow) {
      if (newRow.id === sessionUser.id) {
        setProfile(prev => prev ? { ...prev, ...newRow } : (newRow as Profile));
      }

      // Inline update profilesList from payload to avoid full refetch
      const oldUser = profilesListRef.current.find(p => p.id === newRow.id);
      const hasSubstantialChange = !oldUser ||
        oldUser.username !== newRow.username ||
        oldUser.role !== newRow.role ||
        oldUser.full_name !== newRow.full_name ||
        oldUser.job_role !== newRow.job_role ||
        oldUser.working_hours !== newRow.working_hours ||
        oldUser.break_time !== newRow.break_time ||
        oldUser.is_setup_completed !== newRow.is_setup_completed;

      const isApprover = profile?.role === 'admin' || profile?.role === 'supervisor';
      if (hasSubstantialChange && isApprover) {
        // Inline update the profiles list instead of full refetch
        setProfilesList(prev => {
          const idx = prev.findIndex(p => p.id === newRow.id);
          if (idx >= 0) {
            const updated = [...prev];
            updated[idx] = { ...updated[idx], ...newRow } as Profile;
            return updated;
          }
          return prev;
        });
        // Notify notification hook
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('realtime-data-changed'));
        }
      }
    } else {
      // INSERT or DELETE — needs full refetch for profiles
      const isApprover = profile?.role === 'admin' || profile?.role === 'supervisor';
      if (isApprover) {
        handleRealtimeChange();
      }
    }
  }, [sessionUser, profile, handleRealtimeChange]);

  // ── leave_settlements handler ──
  const handleSettlementsRealtime = useCallback((payload: RealtimePayload) => {
    console.log('Realtime settlement change received:', payload);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('realtime-table-payload', { detail: { table: 'leave_settlements', payload } }));
    }
    handleRealtimeChange();
  }, [handleRealtimeChange]);

  // Register handlers with the centralized RealtimeProvider
  useRealtimeHandler('chuti', handleChutiRealtime);
  useRealtimeHandler('profiles', handleProfilesRealtime);
  useRealtimeHandler('leave_settlements', handleSettlementsRealtime);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (realtimeDebounceRef.current) clearTimeout(realtimeDebounceRef.current);
    };
  }, []);

  // Check Authentication and Fetch Profile on Mount and Auth Changes
  useEffect(() => {
    const fetchSession = async (sessionParam?: Session | null) => {
      try {
        setLoading(true);
        let session = sessionParam;
        if (session === undefined) {
          const { data, error: sessionError } = await supabase.auth.getSession();

          if (sessionError) {
            console.error('Supabase session fetch error:', sessionError);
            
            // Clear any stale local storage auth keys to prevent loop console warnings
            if (typeof window !== 'undefined') {
              for (const key of Object.keys(localStorage)) {
                if (key.startsWith('sb-')) {
                  localStorage.removeItem(key);
                }
              }
            }
            try {
              await supabase.auth.signOut();
            } catch (signOutErr) {
              console.warn('Failed to clear stale auth session:', signOutErr);
            }

            // If offline, try to continue with cached profile instead of redirecting to login
            if (typeof window !== 'undefined' && !navigator.onLine) {
              console.log('Session error while offline, attempting cached profile recovery...');
              try {
                const cachedProfiles = await getCacheData('profiles_cache');
                // Find any cached profile to use as the session user
                if (cachedProfiles.length > 0) {
                  const cachedProfile = cachedProfiles[0];
                  setSessionUser({ id: cachedProfile.id } as unknown as SupabaseUser);
                  setProfile(cachedProfile);
                  setLoading(false);
                  return;
                }
              } catch (cacheErr) {
                console.error('Failed to recover from cache:', cacheErr);
              }
            }
            setInitialFetchDone(false);
            setSessionUser(null);
            setProfile(null);
            setLoading(false);
            return;
          }
          session = data?.session;
        }

        if (!session) {
          // If offline and no session, try cache recovery
          if (typeof window !== 'undefined' && !navigator.onLine) {
            try {
              const cachedProfiles = await getCacheData('profiles_cache');
              if (cachedProfiles.length > 0) {
                const cachedProfile = cachedProfiles[0];
                setSessionUser({ id: cachedProfile.id } as unknown as SupabaseUser);
                setProfile(cachedProfile);
                setLoading(false);
                return;
              }
            } catch (cacheErr) {
              console.error('Failed to recover from cache:', cacheErr);
            }
          }
          setInitialFetchDone(false);
          setSessionUser(null);
          setProfile(null);
          setLoading(false);
          return;
        }

        const userId = session.user.id;
        const now = Date.now();
        const oneWeekMs = 7 * 24 * 60 * 60 * 1000;

        const sessionStart = localStorage.getItem(`session_start_time_${userId}`);
        const lastAccess = localStorage.getItem(`last_access_time_${userId}`);

        if (sessionStart || lastAccess) {
          const startAge = sessionStart ? now - parseInt(sessionStart, 10) : 0;
          const accessAge = lastAccess ? now - parseInt(lastAccess, 10) : 0;

          if (startAge > oneWeekMs || accessAge > oneWeekMs) {
            localStorage.removeItem(`session_start_time_${userId}`);
            localStorage.removeItem(`last_access_time_${userId}`);
            try {
              await supabase.auth.signOut();
            } catch (signOutError) {
              console.error('Error signing out expired session:', signOutError);
            }
            setSessionUser(null);
            setProfile(null);
            setLoading(false);
            return;
          }
        }

        if (!sessionStart) {
          localStorage.setItem(`session_start_time_${userId}`, now.toString());
        }
        localStorage.setItem(`last_access_time_${userId}`, now.toString());

        setSessionUser(session.user);

        const savedMode = localStorage.getItem('admin_mode_' + userId);
        if (savedMode === 'user' || savedMode === 'admin') {
          setAdminActiveTab(savedMode as 'user' | 'admin');
        }

        // Fetch user profile
        let userProfile = null;
        let profileError = null;

        if (typeof window !== 'undefined' && navigator.onLine) {
          try {
            const { data, error } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .maybeSingle();
            userProfile = data;
            profileError = error;

            if (!profileError && userProfile) {
              userProfile = mapProfilePasswordResetStatus(userProfile);
              // Asynchronously update profile cache
              try {
                await upsertCacheItem('profiles_cache', userProfile);
              } catch (cacheErr) {
                console.error('Failed to cache user profile:', cacheErr);
              }
            }
          } catch (netErr) {
            console.error('Network error during profile fetch:', netErr);
          }
        }

        // Fallback to cache if offline or query failed
        if (!userProfile) {
          try {
            const cachedProfiles = await getCacheData('profiles_cache');
            userProfile = cachedProfiles.find(p => p.id === session.user.id) || null;
            if (userProfile) {
              console.log('Successfully loaded profile from local cache offline:', userProfile);
              profileError = null; // Clear error since we got it from cache
            }
          } catch (cacheErr) {
            console.error('Failed to load profile from cache:', cacheErr);
          }
        }

        if (profileError || !userProfile) {
          console.error('User profile not found. Logging out.', profileError);
          localStorage.removeItem(`session_start_time_${userId}`);
          localStorage.removeItem(`last_access_time_${userId}`);
          try {
            await supabase.auth.signOut();
          } catch (e) {
            console.error(e);
          }
          setSessionUser(null);
          setProfile(null);
          setLoading(false);
          return;
        }

        setProfile(userProfile as Profile);

        // Optimistically restore push preference from localStorage on reload
        const savedPref = localStorage.getItem('push_subscribed_pref_' + userId);
        setIsPushSubscribed(savedPref === 'true');

        // Verify actual subscription status asynchronously
        checkSubscriptionStatus(userId)
          .then((status) => {
            setIsPushSubscribed(status.isSubscribed);
            localStorage.setItem('push_subscribed_pref_' + userId, status.isSubscribed ? 'true' : 'false');
          })
          .catch((err) => {
            console.error('Error verifying push status:', err);
          });

        setLoading(false);
      } catch (err) {
        console.error('Fatal exception in fetchSession:', err);
        // If offline, attempt to recover from cached profile instead of redirecting
        if (typeof window !== 'undefined' && !navigator.onLine) {
          try {
            const cachedProfiles = await getCacheData('profiles_cache');
            if (cachedProfiles.length > 0) {
              const cachedProfile = cachedProfiles[0];
              console.log('Recovered from cache after session timeout (offline):', cachedProfile.username);
              setSessionUser({ id: cachedProfile.id } as unknown as SupabaseUser);
              setProfile(cachedProfile);
              setLoading(false);
              return;
            }
          } catch (cacheErr) {
            console.error('Cache recovery failed:', cacheErr);
          }
        }
        setInitialFetchDone(false);
        setSessionUser(null);
        setProfile(null);
        setLoading(false);
      }
    };

    fetchSession();

    // Subscribe to auth state changes to detect login/logout in real-time
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Real-time auth state changed:', event, session?.user?.id);
      if (event === 'SIGNED_IN') {
        const currentUserId = sessionUserRef.current?.id;
        if (currentUserId === session?.user?.id) {
          console.log('useDashboardData: Same user session already active. Skipping profile fetch.');
          if (session) {
            setSessionUser(session.user);
            sessionUserRef.current = session.user;
          }
          return;
        }

        if (session) {
          setSessionUser(session.user);
          sessionUserRef.current = session.user;
          fetchSession(session);
        }
      } else if (event === 'TOKEN_REFRESHED') {
        if (session) {
          setSessionUser(session.user);
          sessionUserRef.current = session.user;
        }
      } else if (event === 'SIGNED_OUT') {
        setSessionUser(null);
        sessionUserRef.current = null;
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Manual Sync Button Handler
  const handleManualSync = async () => {
    if (!isOnline) {
      setMessage({ type: 'error', text: 'You are still offline! Please connect to the internet.' });
      return;
    }
    setLoading(true);
    const res = await syncOfflineData();
    setLoading(false);

    if (res.success) {
      const conflictCount = res.conflicts?.length || 0;
      if (conflictCount > 0) {
        setMessage({ type: 'error', text: `${res.syncedCount} records synced, ${conflictCount} conflicts detected.` });
        res.conflicts.forEach((c: SyncConflict) => {
          toast.error(c.reason, { duration: 8000, id: `conflict-${c.recordId}` });
        });
      } else {
        setMessage({ type: 'success', text: `${res.syncedCount} offline records synced!` });
      }
      checkOfflineQueue();
      fetchRecords();
    } else {
      setMessage({ type: 'error', text: res.error || 'Sync failed.' });
    }
  };

  // Logout Handler
  const handleLogout = async () => {
    if (sessionUser) {
      localStorage.removeItem(`session_start_time_${sessionUser.id}`);
      localStorage.removeItem(`last_access_time_${sessionUser.id}`);
    }
    // Clear cache/sessionStorage items
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('selectedYear');
      sessionStorage.removeItem('viewingStaffId');
    }
    await supabase.auth.signOut();
    setSessionUser(null);
    setProfile(null);
    setInitialFetchDone(false);
    setUserRecords([]);
    setAdminRecords([]);
    setProfilesList([]);
    setHolidayResponses([]);
    setLeaveSettlements([]);
    setViewingStaffIdState(null);
  };

  return {
    sessionUser,
    profile,
    setProfile,
    isPushSubscribed,
    setIsPushSubscribed,
    isPushLoading,
    setIsPushLoading,
    loading,
    setLoading,
    submitting,
    setSubmitting,
    isOnline,
    setIsOnline,
    offlineCount,
    setOfflineCount,
    message,
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
    setHolidayResponses,
    handleSaveHolidayResponse,
    handleAdminUpdateHolidayResponse,
    leaveSettlements,
    setLeaveSettlements,
    handleSaveLeaveSettlementsBulk,
    handleDeleteLeaveSettlement,
    initialFetchDone,
  };
};
