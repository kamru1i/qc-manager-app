'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { useAppEvent, useAppEventBus } from '@/contexts/AppEventBusContext';
import { toast } from 'sonner';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '@/utils/supabase';
import { Profile, ChutiRecordWithProfile, LeaveSettlement, GovtHolidayResponse } from '@/types';
import { ChutiRecord, SyncConflict, getOfflineRecords, syncOfflineData, getCacheData, setCacheData, mergeCacheData, removeCacheItems, getGlobalSettingsCache, setGlobalSettingsCache, getSyncTimestamp, setSyncTimestamp, purgeStaleCacheData } from '@/utils/offlineSync';

import { getGlobalSettingsFromProfile, defaultGlobalSettings, getInitialGlobalSettings, GlobalSettings, sortChutiRecordsDescending, findAdminProfileWithGlobalSettings } from '@/utils/dashboardHelpers';
import { useRealtimeHandler, RealtimePayload } from '@/contexts/RealtimeContext';
import { useProfiles } from '@/contexts/ProfilesContext';
import { CHUTI_COLUMNS, GOVT_HOLIDAY_RESPONSE_COLUMNS, LEAVE_SETTLEMENT_COLUMNS } from '@/utils/dbColumns';
import { isAdminRole } from '@/utils/permissionService';
import { holidaysService } from '@/services/holidaysService';

export const useDashboardData = (
  sessionUser: SupabaseUser,
  profile: Profile,
  setProfile: Dispatch<SetStateAction<Profile | null>>,
) => {
  const { emit } = useAppEventBus();
  const fetchingRef = useRef<boolean>(false);

  const [loading, setLoading] = useState(false);
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
  // R1/R2: shared profiles list from ProfilesContext (was a local duplicate copy)
  const { profilesList, setProfilesList } = useProfiles();
  const [holidayResponses, setHolidayResponses] = useState<GovtHolidayResponse[]>([]);
  const [leaveSettlements, setLeaveSettlements] = useState<LeaveSettlement[]>([]);

  // Keep a ref of profilesList to avoid subscription re-run cycles
  const profilesListRef = useRef<Profile[]>([]);
  useEffect(() => {
    profilesListRef.current = profilesList;
  }, [profilesList]);

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

  useAppEvent('chuti-last-viewed-time-sync', (payload) => {
    const time = typeof payload === 'string' ? payload : String(payload.timestamp);
    if (time) setLastViewedTime(time);
  }, []);

  // Theme Toggle state
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Global Settings state (synchronously loaded from local cache to prevent mode flash on reload)
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings>(() => getInitialGlobalSettings());

  // Fetch Chuti Records based on Role
  const fetchRecords = useCallback(async () => {
    if (!sessionUser || !profile) return;
    if (fetchingRef.current) return;
    fetchingRef.current = true;

    // Check if offline
    if (typeof window !== 'undefined' && !navigator.onLine) {
      try {
        // R1/R2: profiles cache is loaded by ProfilesProvider — only chuti data here

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

        if (isAdminRole(profile) || profile.role === 'supervisor') {
          setAdminRecords(sortChutiRecordsDescending(finalChuti as ChutiRecordWithProfile[]));
        }

        const loggedInUserChuti = finalChuti.filter(r => r.user_id === sessionUser.id);
        setUserRecords(sortChutiRecordsDescending(loggedInUserChuti));

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

      // R1/R2: profiles are fetched once by ProfilesProvider — read the shared
      // list here for cache mirroring and globalSettings derivation below.
      const profilesData: Profile[] = profilesListRef.current;
      let adminRecordsData: ChutiRecordWithProfile[] = [];
      let userRecordsData: ChutiRecord[] = [];
      let responsesData: GovtHolidayResponse[] = [];
      let settlementsData: LeaveSettlement[] = [];

      // 1. Fetch admin chuti list if admin/supervisor
      if (isAdminRole(profile) || profile.role === 'supervisor') {
        const lastChutiSync = await getSyncTimestamp('chuti');
        if (lastChutiSync) {
          const { data: deltaRaw, error } = await supabase
            .from('chuti')
            .select(`${CHUTI_COLUMNS}, profiles (username, full_name, role, supervisor_ids)`)
            .gte('updated_at', lastChutiSync)
            .order('date', { ascending: false });
          const deltaRecords = deltaRaw as unknown as ChutiRecordWithProfile[] | null;

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
            // E2 fix: Bound fallback fetch to last 90 days (matches cache purge TTL)
            const chutiCutoff1 = new Date();
            chutiCutoff1.setDate(chutiCutoff1.getDate() - 90);
            const chutiCutoffStr1 = chutiCutoff1.toISOString().split('T')[0];

            while (hasMore) {
              const from = page * pageSize;
              const to = from + pageSize - 1;

              const { data, error: fullErr } = await supabase
                .from('chuti')
                .select(`${CHUTI_COLUMNS}, profiles (username, full_name, role, supervisor_ids)`)
                .is('deleted_at', null)
                .gte('date', chutiCutoffStr1)
                .order('date', { ascending: false })
                .range(from, to);

              if (fullErr) {
                syncError = fullErr;
                break;
              }

              if (data && data.length > 0) {
                allData = [...allData, ...(data as unknown as ChutiRecordWithProfile[])];
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
          // E2 fix: Bound first-load fetch to last 90 days (matches cache purge TTL)
          const chutiCutoff = new Date();
          chutiCutoff.setDate(chutiCutoff.getDate() - 90);
          const chutiCutoffStr = chutiCutoff.toISOString().split('T')[0];

          while (hasMore) {
            const from = page * pageSize;
            const to = from + pageSize - 1;

            const { data, error } = await supabase
              .from('chuti')
              .select(`${CHUTI_COLUMNS}, profiles (username, full_name, role, supervisor_ids)`)
              .is('deleted_at', null)
              .gte('date', chutiCutoffStr)
              .order('date', { ascending: false })
              .range(from, to);

            if (error) {
              syncError = error;
              break;
            }

            if (data && data.length > 0) {
              allData = [...allData, ...(data as unknown as ChutiRecordWithProfile[])];
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
      }
      // R1/R2: normal users previously fetched a supervisors-only list here.
      // The shared ProfilesProvider list is a superset (consumers like AddLeave
      // filter by role === 'supervisor' themselves), so no extra fetch is needed.

      // 2. Fetch logged-in user records
      const lastUserChutiSync = await getSyncTimestamp('chuti_user');
      if (lastUserChutiSync) {
        const { data: deltaRaw2, error } = await supabase
          .from('chuti')
          .select(CHUTI_COLUMNS)
          .eq('user_id', sessionUser.id)
          .gte('updated_at', lastUserChutiSync)
          .order('date', { ascending: false });
        const deltaRecords = deltaRaw2 as unknown as ChutiRecord[] | null;

        if (!error && deltaRecords && deltaRecords.length > 0) {
          const deletedIds = new Set(
            deltaRecords.filter(r => r.deleted_at && r.id).map(r => r.id as string),
          );
          const cachedUserChuti = (await getCacheData('chuti_cache')).filter(r => r.user_id === sessionUser.id);
          const mergedMap = new Map(cachedUserChuti.map(r => [r.id, r]));
          deltaRecords.forEach(r => {
            if (r.deleted_at) {
              mergedMap.delete(r.id);
            } else {
              mergedMap.set(r.id, r);
            }
          });
          const mergedUserRecords = sortChutiRecordsDescending(Array.from(mergedMap.values()));
          setUserRecords(mergedUserRecords);
          userRecordsData = mergedUserRecords;

          if (deletedIds.size > 0) await removeCacheItems('chuti_cache', Array.from(deletedIds));
        } else if (!error) {
          const cachedUserChuti = sortChutiRecordsDescending((await getCacheData('chuti_cache')).filter(r => r.user_id === sessionUser.id));
          if (cachedUserChuti.length > 0) {
            setUserRecords(cachedUserChuti);
            userRecordsData = cachedUserChuti;
          }
        } else if (error) {
          console.error('User delta fetch failed, falling back to full fetch:', error);
          const { data: recordsRaw, error: fullErr } = await supabase
            .from('chuti')
            .select(CHUTI_COLUMNS)
            .eq('user_id', sessionUser.id)
            .is('deleted_at', null)
            .order('date', { ascending: false });
          const records = sortChutiRecordsDescending((recordsRaw as unknown as ChutiRecord[] | null) || []);
          if (!fullErr && records) {
            setUserRecords(records);
            userRecordsData = records;
          }
        }
      } else {
        const { data: recordsRaw, error } = await supabase
          .from('chuti')
          .select(CHUTI_COLUMNS)
          .eq('user_id', sessionUser.id)
          .is('deleted_at', null)
          .order('date', { ascending: false });
        const records = sortChutiRecordsDescending((recordsRaw as unknown as ChutiRecord[] | null) || []);

        if (!error && records) {
          setUserRecords(records);
          userRecordsData = records;
        }
      }

      // 3. Fetch Govt Holiday Responses and settlements
      if (isAdminRole(profile) || profile.role === 'supervisor') {
        // E4 fix: Bound admin responses fetch to prevent unbounded growth
        const { data: responsesRaw, error: respError } = await supabase
          .from('govt_holiday_responses')
          .select(`${GOVT_HOLIDAY_RESPONSE_COLUMNS}, profiles (full_name, username)`)
          .order('created_at', { ascending: false })
          .limit(1000);
        const responses = responsesRaw as unknown as GovtHolidayResponse[] | null;
        if (!respError && responses) {
          setHolidayResponses(responses);
          responsesData = responses;
        }

        // E4 fix: Bound admin settlements fetch to prevent unbounded growth
        const { data: settlementsRaw, error: settError } = await supabase
          .from('leave_settlements')
          .select(`${LEAVE_SETTLEMENT_COLUMNS}, profiles!leave_settlements_user_id_fkey (full_name, username)`)
          .order('created_at', { ascending: false })
          .limit(1000);
        const settlements = settlementsRaw as unknown as LeaveSettlement[] | null;
        if (!settError && settlements) {
          setLeaveSettlements(settlements);
          settlementsData = settlements;
        }
      } else {
        const { data: responsesRaw, error: respError } = await supabase
          .from('govt_holiday_responses')
          .select(GOVT_HOLIDAY_RESPONSE_COLUMNS)
          .eq('user_id', sessionUser.id)
          .order('created_at', { ascending: false });
        const responses = responsesRaw as unknown as GovtHolidayResponse[] | null;
        if (!respError && responses) {
          setHolidayResponses(responses);
          responsesData = responses;
        }

        const { data: settlementsRaw, error: settError } = await supabase
          .from('leave_settlements')
          .select(LEAVE_SETTLEMENT_COLUMNS)
          .eq('user_id', sessionUser.id)
          .order('created_at', { ascending: false });
        const settlements = settlementsRaw as unknown as LeaveSettlement[] | null;
        if (!settError && settlements) {
          setLeaveSettlements(settlements);
          settlementsData = settlements;
        }
      }

      // 4. Asynchronously merge fetched data into IndexedDB cache (non-destructive upsert)
      try {
        // R1/R2: profiles_cache is maintained by ProfilesProvider

        // Cache chuti records (merge-based since we use delta sync)
        const recordsToCache = (isAdminRole(profile) || profile.role === 'supervisor')
          ? adminRecordsData
          : userRecordsData;
        if (recordsToCache.length > 0) {
          await mergeCacheData('chuti_cache', recordsToCache);
        }

        if (isAdminRole(profile) || profile.role === 'supervisor') {
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

        // TTL: Purge chuti records older than 2 years from cache
        try {
          await purgeStaleCacheData('chuti_cache', 'date', 90);
        } catch (ttlErr) {
        }
      } catch (cacheErr) {
      }

    } catch (err) {
    } finally {
      fetchingRef.current = false;
      setInitialFetchDone(true);
    }
  }, [sessionUser, profile]);

  const handleSaveGlobalSettings = useCallback(async (newSettings: GlobalSettings, options?: { silent?: boolean }) => {
    if (!profile || !sessionUser) return false;

    setLoading(true);
    const { error } = await holidaysService.saveGlobalLeaveSettings(
      newSettings as unknown as Record<string, unknown>,
    );

    if (error) {
      setMessage({ type: 'error', text: 'Failed to save settings: ' + error.message });
      setLoading(false);
      return false;
    }

    const updatedProfile: Profile = {
      ...profile,
      global_settings: { ...(profile.global_settings || {}), ...newSettings },
    };
    setProfile(updatedProfile);
    setProfilesList(prev => prev.map(p => ({
      ...p,
      global_settings: { ...(p.global_settings || {}), ...newSettings },
    })));

    profilesListRef.current = profilesListRef.current.map(p => ({
      ...p,
      global_settings: { ...(p.global_settings || {}), ...newSettings },
    }));

    setGlobalSettings(newSettings);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('global_settings_cache', JSON.stringify(newSettings));
        if (sessionUser) {
          const cacheKey = `cached_profile_${sessionUser.id}`;
          const raw = localStorage.getItem(cacheKey);
          if (raw) {
            const p = JSON.parse(raw);
            p.global_settings = { ...(p.global_settings || {}), ...newSettings };
            localStorage.setItem(cacheKey, JSON.stringify(p));
          }
        }
      } catch (e) {
        console.warn('Error updating local global_settings cache:', e);
      }
    }
    if (!options?.silent) {
      setMessage({ type: 'success', text: 'Leave quota settings successfully updated!' });
    }
    setLoading(false);
    await fetchRecords();

    return true;
  }, [profile, sessionUser, fetchRecords, setMessage, setProfile, setProfilesList]);

  const handleAdminUpdateHolidayResponse = useCallback(async (targetUserId: string, holidayDate: string, _holidayName: string, response: 'paid' | 'reserve') => {
    if (!profile || !isAdminRole(profile)) return false;

    setLoading(true);
    const { error } = await holidaysService.convertGovtHolidayResponse(
      targetUserId,
      holidayDate,
      response,
    );

    if (error) {
      setMessage({ type: 'error', text: 'Failed to update response: ' + error.message });
      setLoading(false);
      return false;
    }

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
      setMessage({ type: 'error', text: 'Failed to process settlements: ' + (err as Error).message });
      setLoading(false);
      return false;
    }
  }, [fetchRecords, setMessage]);

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
      setMessage({ type: 'error', text: 'Failed to delete settlement: ' + (err as Error).message });
      setLoading(false);
      return false;
    }
  }, [fetchRecords, setMessage]);

  useEffect(() => {
    if (profile) {
      const adminProfile = findAdminProfileWithGlobalSettings(profilesList, profile);
      if (adminProfile) {
        const derived = getGlobalSettingsFromProfile(adminProfile);
        setGlobalSettings(derived);
        setGlobalSettingsCache(derived).catch(() => {});
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

  useAppEvent('theme-change', (payload) => {
    const nextTheme = (typeof payload === 'string' ? payload : payload.theme) as 'dark' | 'light';
    setTheme(nextTheme);
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

  // ── chuti handler ──
  const handleChutiRealtime = useCallback((payload: RealtimePayload) => {
    emit('realtime-table-payload', { table: 'chuti', payload });

    const id = String(payload.eventType === 'DELETE' ? payload.old.id ?? '' : payload.new.id ?? '');
    if (!id) return;
    const incoming = payload.new as unknown as ChutiRecord;
    const remove = payload.eventType === 'DELETE' || Boolean(incoming.deleted_at);

    setUserRecords((prev) => {
      const without = prev.filter((row) => row.id !== id);
      if (remove || incoming.user_id !== sessionUser.id) return without;
      return sortChutiRecordsDescending([{ ...incoming, synced: true }, ...without]);
    });

    if (isAdminRole(profile) || profile.role === 'supervisor') {
      setAdminRecords((prev) => {
        const without = prev.filter((row) => row.id !== id);
        if (remove) return without;
        const target = profilesListRef.current.find((p) => p.id === incoming.user_id);
        const hydrated: ChutiRecordWithProfile = {
          ...incoming,
          id,
          synced: true,
          profiles: target ? {
            username: target.username,
            full_name: target.full_name,
            role: target.role,
            supervisor_ids: target.supervisor_ids,
          } : null,
        };
        return sortChutiRecordsDescending([hydrated, ...without]);
      });
    }
  }, [emit, profile, sessionUser.id]);

  // ── profiles handler ──
  const handleProfilesRealtime = useCallback((payload: RealtimePayload) => {
    if (!sessionUser) return;
    const newRow = payload.new as Partial<Profile>;
    const oldRow = payload.old as Partial<Profile>;
      // Forward for quotes workspace.
      emit('realtime-profile-payload', { payload });
    if (payload.eventType === 'DELETE' && oldRow?.id === sessionUser.id) {
      const handleForceLogout = async () => {
        try {
          await supabase.auth.signOut();
        } catch (e) {
        }
        localStorage.removeItem(`session_start_time_${sessionUser.id}`);
        localStorage.removeItem(`last_access_time_${sessionUser.id}`);
        setProfile(null);
      };
      handleForceLogout();
      return;
    }
    if (payload.eventType === 'UPDATE' && newRow) {
      if (newRow.id === sessionUser.id) {
        setProfile(prev => prev ? { ...prev, ...newRow } : (newRow as Profile));
      }

    }
  }, [sessionUser, setProfile, emit]);

  // ── leave_settlements handler ──
  const handleSettlementsRealtime = useCallback((payload: RealtimePayload) => {
    emit('realtime-table-payload', { table: 'leave_settlements', payload });
    const id = String(payload.eventType === 'DELETE' ? payload.old.id ?? '' : payload.new.id ?? '');
    if (!id) return;
    setLeaveSettlements((prev) => {
      const without = prev.filter((row) => row.id !== id);
      if (payload.eventType === 'DELETE') return without;
      const incoming = payload.new as unknown as LeaveSettlement;
      const target = profilesListRef.current.find((p) => p.id === incoming.user_id);
      return [{
        ...incoming,
        id,
        profiles: target ? { full_name: target.full_name ?? null, username: target.username } : null,
      }, ...without];
    });
  }, [emit]);

  // Register handlers with the centralized RealtimeProvider
  useRealtimeHandler('chuti', handleChutiRealtime);
  useRealtimeHandler('profiles', handleProfilesRealtime);
  useRealtimeHandler('leave_settlements', handleSettlementsRealtime);

  // ── govt_holiday_responses handler ──
  const handleHolidayResponseRealtime = useCallback((payload: RealtimePayload) => {
    emit('realtime-table-payload', { table: 'govt_holiday_responses', payload });
    const id = String(payload.eventType === 'DELETE' ? payload.old.id ?? '' : payload.new.id ?? '');
    if (!id) return;
    setHolidayResponses((prev) => {
      const without = prev.filter((row) => row.id !== id);
      if (payload.eventType === 'DELETE') return without;
      const incoming = payload.new as unknown as GovtHolidayResponse;
      const target = profilesListRef.current.find((p) => p.id === incoming.user_id);
      return [{
        ...incoming,
        id,
        profiles: target ? { full_name: target.full_name ?? null, username: target.username } : null,
      }, ...without];
    });
  }, [emit]);

  useRealtimeHandler('govt_holiday_responses', handleHolidayResponseRealtime);

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

  return {
    sessionUser,
    profile,
    setProfile,

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
    globalSettings,
    handleSaveGlobalSettings,
    holidayResponses,
    setHolidayResponses,
    handleAdminUpdateHolidayResponse,
    leaveSettlements,
    setLeaveSettlements,
    handleSaveLeaveSettlementsBulk,
    handleDeleteLeaveSettlement,
    initialFetchDone,
  };
};
