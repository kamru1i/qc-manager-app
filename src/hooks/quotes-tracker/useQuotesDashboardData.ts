'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';
import { Profile, RecordItem, AuditLogItem } from '@/types';
import { useQuotesTheme } from '@/hooks/quotes-tracker/useQuotesTheme';
import { useRecordActions } from '@/hooks/leave-tracker/useRecordActions';
import { useAdminActions } from '@/hooks/leave-tracker/useAdminActions';
import { toast } from 'react-hot-toast';
import { useRealtimeHandler } from '@/contexts/RealtimeContext';
import {
  syncOfflineData,
  setCacheData,
  getCacheData,
  mergeCacheData,
  getSyncTimestamp,
  setSyncTimestamp,
  purgeStaleCacheData,
  getOfflineRecords,
  deleteCacheItem,
  clearAllCache
} from '@/utils/quotesOfflineSync';

const sanitizeProfile = (p: Profile | null): Profile | null => {
  if (!p) return null;
  if (Array.isArray(p.allowed_types)) {
    return {
      ...p,
      allowed_types: p.allowed_types.filter((t: string) => t !== 'Review Van' && t !== 'Review Bike')
    };
  }
  return p;
};

const CACHE_THROTTLE_MS = 5 * 60 * 1000; // 5 minutes cache

const sanitizeProfilesList = (list: Profile[]): Profile[] => {
  if (!list) return [];
  return list.map(p => sanitizeProfile(p) as Profile);
};

export const useQuotesDashboardData = () => {
  const router = useRouter();
  const [sessionUser, setSessionUser] = useState<SupabaseUser | null>(null);
  const [profile, setRawProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [recordsLoading, setRecordsLoading] = useState(true);
  const [initialFetchDone, setInitialFetchDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  const setProfile = useCallback((val: Profile | null | ((prev: Profile | null) => Profile | null)) => {
    setRawProfile(prev => {
      const next = typeof val === 'function' ? val(prev) : val;
      const sanitized = sanitizeProfile(next);
      if (typeof window !== 'undefined' && sanitized) {
        localStorage.setItem('quotes_sales_profile', JSON.stringify(sanitized));
      }
      return sanitized;
    });
  }, []);

  // Helper to update last activity timestamp in localStorage
  const updateLastActivity = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('quotes_sales_last_activity', String(Date.now()));
    }
  }, []);

  // Records and Profiles lists
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [profilesList, setRawProfilesList] = useState<Profile[]>([]);

  const setProfilesList = useCallback((val: Profile[] | ((prev: Profile[]) => Profile[])) => {
    setRawProfilesList(prev => {
      const next = typeof val === 'function' ? val(prev) : val;
      return sanitizeProfilesList(next);
    });
  }, []);
  const [availableDates, setAvailableDates] = useState<{ year: string; month: string }[]>([]);

  // Keep a ref of profilesList to avoid subscription re-run cycles
  const profilesListRef = useRef<Profile[]>([]);
  useEffect(() => {
    profilesListRef.current = profilesList;
  }, [profilesList]);

  // Audit Logs
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [auditLogsLoading, setAuditLogsLoading] = useState(false);

  // Theme (extracted hook)
  const { theme, toggleTheme } = useQuotesTheme();

  // Filter States
  const [selectedYear, setSelectedYear] = useState<string>(() => new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState<string>(() => String(new Date().getMonth() + 1).padStart(2, '0'));

  // Show a message using react-hot-toast
  const showToast = useCallback((type: 'success' | 'error', text: string) => {
    if (type === 'success') {
      toast.success(text);
    } else {
      toast.error(text);
    }
  }, []);

  const fetchingRef = useRef(false);
  const lastFetchedKeyRef = useRef<string>('');
  const lastFetchedTimeRef = useRef<Map<string, number>>(new Map());

  // Fetch all records for the selected Month & Year
  const fetchRecords = useCallback(async (isSilent: boolean = false, force: boolean = false) => {
    if (!sessionUser || !profile) return;
    
    const fetchKey = `${selectedYear}-${selectedMonth}-${sessionUser.id}`;
    const now = Date.now();
    const lastFetched = lastFetchedTimeRef.current.get(fetchKey) || 0;
    
    // If not forced, not silent, and loaded within 5 mins: skip remote fetch
    const canSkipRemote = (now - lastFetched < CACHE_THROTTLE_MS) && !force && !isSilent;

    if (lastFetchedKeyRef.current === fetchKey && !force && !isSilent && canSkipRemote) {
      return;
    }

    if (fetchingRef.current) {
      return;
    }
    fetchingRef.current = true;
    if (!isSilent) setRecordsLoading(true);

    try {
      if (navigator.onLine) {
        try {
          // 0. Self-healing check: if the user switched accounts or local cache was wiped, clear database cache for full fresh sync
          const cachedUserId = await getSyncTimestamp('active_user_id');
          const localCachedItems = await getCacheData<RecordItem>('records_cache');
          
          if (cachedUserId !== sessionUser.id || localCachedItems.length === 0) {
            await clearAllCache();
            await setSyncTimestamp('active_user_id', sessionUser.id);
          }

          // 1. Sync pending offline mutations first
          try {
            const syncRes = await syncOfflineData();
            if (syncRes.success && syncRes.syncedCount > 0) {
              showToast('success', `Synced ${syncRes.syncedCount} offline actions to the server.`);
            }
            if (syncRes.conflicts && syncRes.conflicts.length > 0) {
              syncRes.conflicts.forEach(c => {
                showToast('error', c.reason);
              });
            }
          } catch (syncErr) {
            console.error('Failed to sync offline data before fetch:', syncErr);
          }

          // 2. Fetch data for the currently selected month and year to ensure absolute completeness
          // SKIP if isSilent (realtime updates only need delta sync) OR if we can skip remote queries due to throttling
          if (!isSilent && !canSkipRemote) {
            const yearNum = parseInt(selectedYear, 10);
            const monthNum = parseInt(selectedMonth, 10);
            const startDate = new Date(Date.UTC(yearNum, monthNum - 1, 1, 0, 0, 0, 0)).toISOString();
            const endDate = new Date(Date.UTC(yearNum, monthNum, 0, 23, 59, 59, 999)).toISOString();

            let monthlyData: RecordItem[] = [];
            let mPage = 0;
            const mPageSize = 1000;
            let mHasMore = true;

            while (mHasMore) {
              const from = mPage * mPageSize;
              const to = from + mPageSize - 1;

              const query = supabase
                .from('records')
                .select(`
                  *,
                  profiles (username, full_name)
                `)
                .gte('submitted_at', startDate)
                .lte('submitted_at', endDate)
                .order('submitted_at', { ascending: false })
                .range(from, to);

              const { data, error } = await query;
              if (error) throw error;

              if (data && data.length > 0) {
                monthlyData = [...monthlyData, ...data];
                if (data.length < mPageSize) {
                  mHasMore = false;
                } else {
                  mPage++;
                }
              } else {
                mHasMore = false;
              }
            }

            // Merge this month's fresh server records into IndexedDB cache
            await mergeCacheData('records_cache', monthlyData);

            // Get cached records for the current user/admin matching selectedMonth & selectedYear for active pruning
            const localCachedForPrune = await getCacheData<RecordItem>('records_cache');
            const localMonthRecords = localCachedForPrune.filter(r => {
              if (profile.role !== 'admin' && profile.role !== 'supervisor' && r.user_id !== sessionUser.id) return false;
              if (!r.submitted_at) return false;
              const date = new Date(r.submitted_at);
              const y = date.getFullYear().toString();
              const m = String(date.getMonth() + 1).padStart(2, '0');
              return y === selectedYear && m === selectedMonth;
            });

            // Delete cached records that are not on the server (deleted) and not in pending outbox
            const serverIdSet = new Set(monthlyData.map(row => row.id));
            const pending = await getOfflineRecords();
            const pendingInsertIds = new Set(
              pending.filter(p => p.action === 'insert').map(p => p.localId)
            );

            for (const r of localMonthRecords) {
              if (!serverIdSet.has(r.id) && !pendingInsertIds.has(r.id)) {
                await deleteCacheItem('records_cache', r.id);
              }
            }
          }

          // 3. Keep delta pull for other months in the background to keep offline capability working
          // SKIP if we can skip remote queries due to throttling
          if (!canSkipRemote) {
            const lastSynced = await getSyncTimestamp('records');

            if (lastSynced) {
              // Subtract 30 seconds to account for clock skew/latency between server and client
              const syncDate = new Date(lastSynced);
              syncDate.setSeconds(syncDate.getSeconds() - 30);
              const bufferedSyncTimestamp = syncDate.toISOString();

              // Fetch changes since last sync paginated to bypass the 1000 PostgREST row limit
              let deltaData: RecordItem[] = [];
              let deltaPage = 0;
              const deltaPageSize = 1000;
              let deltaHasMore = true;

              while (deltaHasMore) {
                const from = deltaPage * deltaPageSize;
                const to = from + deltaPageSize - 1;

                const query = supabase
                  .from('records')
                  .select(`
                    *,
                    profiles (username, full_name)
                  `)
                  .gte('updated_at', bufferedSyncTimestamp)
                  .range(from, to);

                const { data: pageData, error: pageError } = await query;
                if (pageError) throw pageError;

                if (pageData && pageData.length > 0) {
                  deltaData = [...deltaData, ...pageData];
                  if (pageData.length < deltaPageSize) {
                    deltaHasMore = false;
                  } else {
                    deltaPage++;
                  }
                } else {
                  deltaHasMore = false;
                }
              }

              if (deltaData && deltaData.length > 0) {
                // Merge delta changes into local IndexedDB cache
                await mergeCacheData('records_cache', deltaData);
              }
              // Set new sync timestamp
              await setSyncTimestamp('records', new Date().toISOString());
            } else {
              // First Sync: Pull all records from database to populate cache
              let allData: RecordItem[] = [];
              let page = 0;
              const pageSize = 1000;
              let hasMore = true;

              while (hasMore) {
                const from = page * pageSize;
                const to = from + pageSize - 1;

                const query = supabase
                  .from('records')
                  .select(`
                    *,
                    profiles (username, full_name)
                  `)
                  .gte('submitted_at', '2026-05-01T00:00:00.000Z')
                  .order('submitted_at', { ascending: false })
                  .range(from, to);

                const { data, error } = await query;
                if (error) throw error;

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

              // Set cache data with full load
              await setCacheData('records_cache', allData);
              await setSyncTimestamp('records', new Date().toISOString());
            }
          }

          // Clean up cache older than 90 days
          try {
            await purgeStaleCacheData('records_cache', 'submitted_at', 90);
          } catch (purgeErr) {
            console.error('Failed to purge stale cache:', purgeErr);
          }

          // If Admin, load profiles list from local cache (already populated by Chuti/User Management)
          if (profile.role === 'admin' || profile.role === 'supervisor') {
            const cachedProfiles = await getCacheData<Profile>('profiles_cache');
            setProfilesList(cachedProfiles);
          }

          // Record this fetch timestamp in our throttling ref
          if (!canSkipRemote) {
            lastFetchedTimeRef.current.set(fetchKey, now);
          }
        } catch (netError: unknown) {
          const errMsg = netError instanceof Error ? netError.message : String(netError);
          console.error('Network sync/fetch failed, falling back to cache:', errMsg, netError);
          showToast('error', 'Network error. Loading offline cache...');
        }
      }

      // 3. Load aggregated records from local IndexedDB cache (works both Online and Offline)
      const cachedRecords = await getCacheData<RecordItem>('records_cache');

      // DANGER RECOVERY AUTO-RESTORE TRIGGER
      // Only trigger if: admin/supervisor, has 100+ cached records, AND the server count is
      // explicitly 0 (not null/undefined which can happen during auth token refresh after password change).
      // Guard against re-triggering the restore. sessionStorage alone is per-tab, so a fresh tab
      // would have no guard and could re-upload everything (duplication). Also check a DB-level flag
      // in the admin's profile.global_settings, which persists across tabs AND devices.
      const existingSettings = (profile?.global_settings && typeof profile.global_settings === 'object')
        ? (profile.global_settings as Record<string, unknown>)
        : {};
      const restoreDoneInDb = !!existingSettings.records_restored_at;
      const hasAttemptedRestore = restoreDoneInDb ||
        (typeof window !== 'undefined' && sessionStorage.getItem('has_attempted_restore') === 'true');
      if (profile && (profile.role === 'admin' || profile.role === 'supervisor') && cachedRecords.length > 100 && !hasAttemptedRestore) {
        try {
          const { count, error: countErr } = await supabase
            .from('records')
            .select('id', { count: 'exact', head: true });
          
          // count must be a real number (not null/undefined) and must be exactly 0.
          // A null count typically means an RLS/auth error (e.g. during session refresh after password change).
          if (!countErr && count !== null && count !== undefined && count === 0) {
            // Double-confirm after a short delay to rule out transient auth token refresh states
            await new Promise(resolve => setTimeout(resolve, 2000));
            const { count: count2, error: countErr2 } = await supabase
              .from('records')
              .select('id', { count: 'exact', head: true });

            if (!countErr2 && count2 !== null && count2 !== undefined && count2 === 0) {
              if (typeof window !== 'undefined') {
                sessionStorage.setItem('has_attempted_restore', 'true');
              }

              // Persist a DB-level lock BEFORE uploading so other tabs/devices that also see an
              // empty server won't independently trigger a restore and duplicate everything.
              // If the lock write fails, skip the restore entirely — better to require a manual
              // recovery than to risk duplicating the whole dataset.
              const restoreLockSettings = { ...existingSettings, records_restored_at: new Date().toISOString() };
              const { error: lockErr } = await supabase
                .from('profiles')
                .update({ global_settings: restoreLockSettings })
                .eq('id', profile.id);

              if (lockErr) {
                console.error('RECOVERY: Failed to set DB restore lock — skipping restore to avoid duplication:', lockErr.message);
              } else {
                setProfile(prev => prev ? ({ ...prev, global_settings: restoreLockSettings } as Profile) : prev);
                showToast('success', `Restoring ${cachedRecords.length} records from local cache. Please do not close the app...`);

                // Upload in batches of 100
                const batchSize = 100;
                let successCount = 0;
                for (let i = 0; i < cachedRecords.length; i += batchSize) {
                  const batch = cachedRecords.slice(i, i + batchSize).map(r => ({
                    user_id: r.user_id,
                    file_name: r.file_name,
                    branch_name: r.branch_name,
                    codename: r.codename,
                    file_type: r.file_type,
                    submitted_at: r.submitted_at,
                    created_at: r.created_at
                  }));

                  const { error: insertError } = await supabase.from('records').insert(batch);
                  if (insertError) {
                    console.error(`RECOVERY: Error restoring batch ${i}:`, insertError.message, insertError.details, insertError.hint, insertError.code);
                  } else {
                    successCount += batch.length;
                  }
                }
                showToast('success', `Database successfully restored! ${successCount} records uploaded.`);
              }
            }
          }
        } catch (restoreErr) {
          console.error('RECOVERY: Automatic database restore failed:', restoreErr);
        }
      }
      
      // Filter the cached records in-memory based on selectedMonth/selectedYear and user permissions
      const filtered = cachedRecords.filter(r => {
        if (!r.submitted_at) return false;
        
        // Check role permission
        if (profile.role !== 'admin' && profile.role !== 'supervisor' && r.user_id !== sessionUser.id) return false;
        
        // Check year-month matching
        const date = new Date(r.submitted_at);
        if (isNaN(date.getTime())) return false;
        
        const y = date.getFullYear().toString();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        return y === selectedYear && m === selectedMonth;
      });

      // Sort by submitted_at descending
      filtered.sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime());
      
      setRecords(filtered);
      lastFetchedKeyRef.current = fetchKey;

      // If Offline or Net Error & Admin, load profiles list from cache
      if ((profile.role === 'admin' || profile.role === 'supervisor')) {
        const cachedProfiles = await getCacheData<Profile>('profiles_cache');
        setProfilesList(prev => {
          if (prev.length === 0 || !navigator.onLine) {
            return cachedProfiles;
          }
          return prev;
        });
      }

    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error('Error fetching records:', errMsg);
      showToast('error', 'Error loading data: ' + errMsg);
    } finally {
      setRecordsLoading(false);
      setInitialFetchDone(true);
      fetchingRef.current = false;
    }
  }, [sessionUser, profile, selectedYear, selectedMonth, showToast, setProfilesList, setProfile]);

  // Fetch unique month/year dates that contain submitted records for the logged-in user (or anyone if admin)
  const fetchAvailableDates = useCallback(async () => {
    if (!sessionUser || !profile) return;
    try {
      let earliestDate: Date | null = null;
      let latestDate: Date | null = null;

      if (navigator.onLine) {
        try {
          // Optimized: fetch only the earliest and latest submitted_at to determine
          // the range of year-month pairs, instead of paginating through ALL records.
          let earliestQuery = supabase
            .from('records')
            .select('submitted_at')
            .order('submitted_at', { ascending: true })
            .limit(1);

          let latestQuery = supabase
            .from('records')
            .select('submitted_at')
            .order('submitted_at', { ascending: false })
            .limit(1);

          if (profile.role !== 'admin' && profile.role !== 'supervisor') {
            earliestQuery = earliestQuery.eq('user_id', sessionUser.id);
            latestQuery = latestQuery.eq('user_id', sessionUser.id);
          }

          const [earliestResult, latestResult] = await Promise.all([earliestQuery, latestQuery]);

          if (earliestResult.error) throw earliestResult.error;
          if (latestResult.error) throw latestResult.error;

          earliestDate = earliestResult.data?.[0]?.submitted_at ? new Date(earliestResult.data[0].submitted_at) : null;
          latestDate = latestResult.data?.[0]?.submitted_at ? new Date(latestResult.data[0].submitted_at) : null;
        } catch (netError: unknown) {
          const errMsg = netError instanceof Error ? netError.message : String(netError);
          console.error('Failed to fetch available dates online, falling back to cache:', errMsg, netError);
          // Offline: read min/max from IndexedDB cache
          const cached = await getCacheData<RecordItem>('records_cache');
          const userRecords = cached.filter(r => (profile.role === 'admin' || profile.role === 'supervisor') || r.user_id === sessionUser.id);
          if (userRecords.length > 0) {
            const dates = userRecords
              .map(r => r.submitted_at ? new Date(r.submitted_at).getTime() : 0)
              .filter(t => t > 0);
            if (dates.length > 0) {
              earliestDate = new Date(Math.min(...dates));
              latestDate = new Date(Math.max(...dates));
            }
          }
        }
      } else {
        // Offline: read min/max from IndexedDB cache
        const cached = await getCacheData<RecordItem>('records_cache');
        const userRecords = cached.filter(r => (profile.role === 'admin' || profile.role === 'supervisor') || r.user_id === sessionUser.id);
        if (userRecords.length > 0) {
          const dates = userRecords
            .map(r => r.submitted_at ? new Date(r.submitted_at).getTime() : 0)
            .filter(t => t > 0);
          if (dates.length > 0) {
            earliestDate = new Date(Math.min(...dates));
            latestDate = new Date(Math.max(...dates));
          }
        }
      }

      const datesSet = new Set<string>();

      // Always include current year-month
      const now = new Date();
      const currentYearStr = now.getFullYear().toString();
      const currentMonthStr = String(now.getMonth() + 1).padStart(2, '0');
      datesSet.add(`${currentYearStr}-${currentMonthStr}`);
      // Ensure June 2026 is always available since it has been restored/backfilled
      datesSet.add('2026-06');

      if (earliestDate && !isNaN(earliestDate.getTime()) && latestDate && !isNaN(latestDate.getTime())) {
        // Generate all year-month pairs in the range [earliest, latest]
        const cursor = new Date(earliestDate.getFullYear(), earliestDate.getMonth(), 1);
        const end = new Date(latestDate.getFullYear(), latestDate.getMonth(), 1);

        while (cursor <= end) {
          const y = cursor.getFullYear().toString();
          const m = String(cursor.getMonth() + 1).padStart(2, '0');
          datesSet.add(`${y}-${m}`);
          cursor.setMonth(cursor.getMonth() + 1);
        }
      }

      const parsedDates = Array.from(datesSet).map(s => {
        const [year, month] = s.split('-');
        return { year, month };
      });

      setAvailableDates(parsedDates);
    } catch (err) {
      console.error('Error fetching available dates:', err);
    }
  }, [sessionUser, profile]);

  // Fetch System Audit Logs (Admins Only)
  const fetchAuditLogs = useCallback(async () => {
    if (!sessionUser || !profile || profile.role !== 'admin') return;
    setAuditLogsLoading(true);
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(150);
      
      if (error) {
        console.error('Error fetching audit logs - Message:', error.message, 'Code:', error.code, 'Details:', error.details);
        throw error;
      }
      setAuditLogs(data || []);
    } catch (err: any) {
      console.error('Error fetching audit logs:', err?.message || err);
    } finally {
      setAuditLogsLoading(false);
    }
  }, [sessionUser, profile]);

  // Insert a new activity log
  const logActivity = useCallback(async (actionType: string, targetId: string | null, details: string) => {
    if (!sessionUser || !profile) return;
    try {
      await supabase.from('audit_logs').insert({
        actor_id: sessionUser.id,
        actor_codename: profile.username,
        action_type: actionType,
        target_id: targetId,
        details: details
      });



      // Automatically refresh logs if active
      if (navigator.onLine && (profile.role === 'admin' || profile.role === 'supervisor')) {
        fetchAuditLogs();
      }
    } catch (err) {
      console.error('Failed to log audit activity:', err);
    }
  }, [sessionUser, profile, fetchAuditLogs]);

  // ── Record CRUD (extracted hook) ──────────────────────────────────
  const { addRecord, deleteRecord, deleteRecords, updateRecord, bulkUpdateRecords } = useRecordActions({
    sessionUser,
    profile,
    showToast,
    logActivity,
    fetchRecords,
    fetchAvailableDates,
    setSubmitting,
    updateLastActivity,
  });
  // ── Admin User Management (extracted hook) ──────────────────────────
  const { createUser, resetUserPassword, deleteUser, adminUpdateUserProfile } = useAdminActions({
    profilesList,
    setProfilesList,
    showToast,
    logActivity,
    setSubmitting,
    updateLastActivity,
  });

  // Logged-in user complete first-time setup (Customizes username, full name and password)
  const completeFirstTimeSetup = async (username: string, fullName: string, password: string) => {
    if (!navigator.onLine) {
      showToast('error', 'This action requires an active internet connection.');
      return false;
    }
    if (!sessionUser) return false;
    setSubmitting(true);

    try {
      // 1. Call complete_profile_setup RPC first to update username, full_name, and mark has_changed_password = true
      const { data, error: rpcError } = await supabase.rpc('complete_profile_setup', {
        p_username: username.toUpperCase().trim(),
        p_full_name: fullName.trim()
      });

      if (rpcError) throw rpcError;
      const result = Array.isArray(data) ? data[0] : data;

      if (result && result.success === false) {
        showToast('error', result.message || 'Failed to complete setup.');
        setSubmitting(false);
        return false;
      }

      // 2. Update password using official client SDK second
      const { error: authError } = await supabase.auth.updateUser({
        password: password
      });

      if (authError) {
        // If the password is the same as the current password (e.g. they already set it but has_changed_password was reset to false),
        // we treat this as success because the password has already been successfully changed.
        const isSamePassword = authError.message?.toLowerCase().includes('different from') ||
                               authError.message?.toLowerCase().includes('same password');
        if (!isSamePassword) {
          throw authError;
        }
      }

      // Reload profile
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', sessionUser.id)
        .maybeSingle();

      if (userProfile) {
        setProfile(userProfile as Profile);
        if (typeof window !== 'undefined') {
          localStorage.setItem('quotes_sales_profile', JSON.stringify(userProfile));
        }
      }

      // Audit Log
      await logActivity(
        'ONBOARD_USER',
        null,
        `Completed onboarding & customized profile (Codename: ${username.toUpperCase().trim()}, Name: ${fullName})`
      );

      showToast('success', 'Profile and password saved successfully!');

      setSubmitting(false);
      return true;
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error('Error completing first-time setup:', errMsg);
      showToast('error', 'Error during setup: ' + errMsg);
      setSubmitting(false);
      return false;
    }
  };


  useEffect(() => {
    const getSession = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          if (typeof window !== "undefined") {
            for (const key of Object.keys(localStorage)) {
              if (key.startsWith("sb-")) {
                localStorage.removeItem(key);
              }
            }
          }
          try {
            await supabase.auth.signOut();
          } catch (signOutErr) {
            console.warn("Failed to clear stale auth session:", signOutErr);
          }
          throw sessionError;
        }

        if (!session) {
          setLoading(false);
          router.push('/login');
          return;
        }

        // Check last activity timestamp for 21 days inactivity logout
        if (typeof window !== 'undefined') {
          const lastActivity = localStorage.getItem('quotes_sales_last_activity');
          const limitMs = 21 * 24 * 60 * 60 * 1000; // 21 days
          const currentTime = Date.now();

          if (lastActivity) {
            const lastTime = parseInt(lastActivity, 10);
            if (!isNaN(lastTime) && currentTime - lastTime > limitMs) {
              console.warn('Session expired due to 21 days of inactivity.');
              localStorage.removeItem('quotes_sales_last_activity');
              await supabase.auth.signOut();
              showToast('error', 'Logged out due to 21 days of inactivity.');
              setLoading(false);
              router.push('/login');
              return;
            }
          }
          localStorage.setItem('quotes_sales_last_activity', String(currentTime));
        }

        const userId = session.user.id;
        setSessionUser(session.user);

        // Fetch user profile
        let userProfile: Profile | null = null;
        let fetchSuccess = false;

        try {
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .maybeSingle();

          if (profileError) throw profileError;

          if (profileData) {
            userProfile = profileData;
            fetchSuccess = true;
            // Cache profile in localStorage
            if (typeof window !== 'undefined') {
              localStorage.setItem('quotes_sales_profile', JSON.stringify(userProfile));
            }
          }
        } catch (profileFetchErr) {
          console.warn('Failed to fetch profile from database, checking cache:', profileFetchErr);
        }

        // If fetch failed, try getting it from localStorage cache
        if (!fetchSuccess && typeof window !== 'undefined') {
          const cachedProfileStr = localStorage.getItem('quotes_sales_profile');
          if (cachedProfileStr) {
            try {
              userProfile = JSON.parse(cachedProfileStr);
            } catch (jsonErr) {
              console.error('Failed to parse cached profile:', jsonErr);
            }
          }
        }

        // If we still don't have a profile, check if we are truly offline or if it's a DB error
        if (!userProfile) {
          if (typeof navigator !== 'undefined' && navigator.onLine) {
            console.error('User profile not found. Logging out.');
            await supabase.auth.signOut();
            if (typeof window !== 'undefined') {
              localStorage.removeItem('quotes_sales_profile');
            }
            setLoading(false);
            router.push('/login');
            return;
          } else {
            throw new Error('No profile cache available and connection is offline.');
          }
        }

        setProfile(userProfile);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching session/profile on load:', err);

        // Try to recover using cached profile if session is available in local storage
        if (typeof window !== 'undefined') {
          const cachedProfileStr = localStorage.getItem('quotes_sales_profile');
          if (cachedProfileStr) {
            try {
              const cachedProfile = JSON.parse(cachedProfileStr);
              setProfile(cachedProfile);
              setLoading(false);
              return;
            } catch {}
          }
        }

        setLoading(false);
        router.push('/login');
      }
    };

    // Delay the initial session retrieval by 200ms on startup to allow 
    // the Tauri Webview network stack and disk handles to fully initialize.
    const timer = setTimeout(() => {
      getSession();
    }, 200);

    return () => clearTimeout(timer);
  }, [router, showToast, setProfile]);

  // Fetch records once authenticated & loaded
  useEffect(() => {
    if (!loading && sessionUser && profile) {
      fetchRecords();
      fetchAvailableDates();
    }
  }, [loading, sessionUser, profile, selectedYear, selectedMonth, fetchRecords, fetchAvailableDates]);



  // Network Status Monitor
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsOnline(navigator.onLine);
      const handleOnline = () => {
        setIsOnline(true);
        fetchRecords(true);
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
  }, [fetchRecords]);

  // Debounce ref for real-time record change events to prevent double-fetching
  // when user's own mutations already trigger explicit fetchRecords() calls.
  const realtimeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Throttle: prevent cascading refetches — minimum 3s between full fetches
  const lastQuotesRealtimeFetchRef = useRef<number>(0);
  const QUOTES_REALTIME_THROTTLE_MS = 3000;

  // ── records handler (via centralized RealtimeProvider) ──
  const handleRecordsRealtime = useCallback(() => {
    const now = Date.now();
    if (now - lastQuotesRealtimeFetchRef.current < QUOTES_REALTIME_THROTTLE_MS) return; // Throttle

    // Debounce: coalesce rapid realtime events (e.g. own mutation + realtime echo)
    if (realtimeDebounceRef.current) clearTimeout(realtimeDebounceRef.current);
    realtimeDebounceRef.current = setTimeout(() => {
      lastQuotesRealtimeFetchRef.current = Date.now();
      fetchRecords(true);
      fetchAvailableDates();
    }, 500);
  }, [fetchRecords, fetchAvailableDates]);

  useRealtimeHandler('records', handleRecordsRealtime);

  // Consume profile changes forwarded by the shared (leave-dashboard) profiles handler.
  // Same handling as before — only the event source changed, not the logic.
  useEffect(() => {
    if (!sessionUser) return;

    const handleProfilePayload = (e: Event) => {
      const payload = (e as CustomEvent).detail;
      if (!payload) return;

      if (payload.eventType === 'DELETE' && payload.old && payload.old.id === sessionUser.id) {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('quotes_sales_profile');
        }
        supabase.auth.signOut().then(() => {
          setSessionUser(null);
          setProfile(null);
          router.push('/login');
          router.refresh();
        });
        return;
      }
      if (payload.eventType === 'UPDATE' && payload.new) {
        if (payload.new.id === sessionUser.id) {
          setProfile(payload.new as Profile);
          if (typeof window !== 'undefined') {
            localStorage.setItem('quotes_sales_profile', JSON.stringify(payload.new));
          }
        }

        // Refresh profiles list for admin/supervisor only if substantial change occurred
        if ((profile?.role === 'admin' || profile?.role === 'supervisor')) {
          const oldUser = profilesListRef.current.find(p => p.id === payload.new.id);
          const hasSubstantialChange = !oldUser ||
            oldUser.username !== payload.new.username ||
            oldUser.role !== payload.new.role ||
            oldUser.full_name !== payload.new.full_name ||
            oldUser.job_role !== payload.new.job_role ||
            oldUser.working_hours !== payload.new.working_hours ||
            oldUser.break_time !== payload.new.break_time ||
            oldUser.is_setup_completed !== payload.new.is_setup_completed;

          if (hasSubstantialChange) {
            // Inline-update the changed profile from the realtime payload
            // instead of refetching the entire profiles list (egress saver).
            setProfilesList(prev => {
              const idx = prev.findIndex(p => p.id === payload.new.id);
              if (idx >= 0) {
                const updated = [...prev];
                updated[idx] = { ...updated[idx], ...payload.new } as Profile;
                return updated;
              }
              return prev;
            });
          }
        }
      } else {
        // INSERT, or DELETE of another user's profile
        if ((profile?.role === 'admin' || profile?.role === 'supervisor')) {
          supabase
            .from('profiles')
            .select('*')
            .order('username', { ascending: true })
            .then(({ data }) => {
              if (data) setProfilesList(data || []);
            });
        }
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('realtime-profile-payload', handleProfilePayload);
    }

    return () => {
      if (realtimeDebounceRef.current) clearTimeout(realtimeDebounceRef.current);
      if (typeof window !== 'undefined') {
        window.removeEventListener('realtime-profile-payload', handleProfilePayload);
      }
    };
  }, [sessionUser, profile, fetchRecords, fetchAvailableDates, router, setProfile, setProfilesList]);

  const handleLogout = async () => {
    lastFetchedKeyRef.current = '';
    if (typeof window !== 'undefined') {
      localStorage.removeItem('quotes_sales_profile');
    }
    try {
      await clearAllCache();
    } catch (err) {
      console.error('Failed to clear cache on logout:', err);
    }
    await supabase.auth.signOut();
    router.push('/login');
  };

  return {
    sessionUser,
    profile,
    loading,
    recordsLoading,
    initialFetchDone,
    submitting,
    isOnline,
    showToast,
    records,
    profilesList,
    theme,
    toggleTheme,
    selectedYear,
    setSelectedYear,
    selectedMonth,
    setSelectedMonth,
    availableDates,
    fetchAvailableDates,
    fetchRecords,
    addRecord,
    deleteRecord,
    deleteRecords,
    updateRecord,
    bulkUpdateRecords,
    createUser,
    resetUserPassword,
    deleteUser,
    adminUpdateUserProfile,
    auditLogs,
    auditLogsLoading,
    fetchAuditLogs,

    completeFirstTimeSetup,
    handleLogout,
    logActivity
  };
};
