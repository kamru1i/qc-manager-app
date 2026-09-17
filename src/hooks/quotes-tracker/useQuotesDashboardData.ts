'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';
import { Profile, RecordItem } from '@/types';
import { useAppEvent } from '@/contexts/AppEventBusContext';
import { RealtimePayload } from '@/contexts/RealtimeContext';
import { useQuotesTheme } from '@/hooks/quotes-tracker/useQuotesTheme';
import { useRecordActions } from '@/hooks/leave-tracker/useRecordActions';
import { useAdminActions } from '@/hooks/leave-tracker/useAdminActions';
import { toast } from 'sonner';
import { useRealtimeHandler } from '@/contexts/RealtimeContext';
import { useProfiles } from '@/contexts/ProfilesContext';
import { fetchSubmittedMonths, extractAvailableDatesFromRecords } from '@/utils/availableDatesHelper';
import { getDhakaMonthRange, getDhakaDateParts } from '@/utils/quotesDashboardHelpers';
import { PROFILE_COLUMNS, RECORD_COLUMNS } from '@/utils/dbColumns';
import { isAdminRole } from '@/utils/permissionService';
import {
  syncOfflineData,
  setCacheData,
  getCacheData,
  mergeCacheData,
  getSyncTimestamp,
  setSyncTimestamp,
  getOfflineRecords,
  removeCacheItems,
  clearAllCache
} from '@/utils/quotesOfflineSync';
import { clearOwnedOfflineCaches } from '@/utils/cacheOwnership';
import { getNavigationContext, saveNavigationContext } from '@/services';

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

export const useQuotesDashboardData = (
  sessionUser: SupabaseUser,
  rootProfile: Profile,
  setRootProfile: Dispatch<SetStateAction<Profile | null>>,
) => {
  const router = useRouter();
  const profile = useMemo(() => sanitizeProfile(rootProfile), [rootProfile]);
  const loading = false;
  const [recordsLoading, setRecordsLoading] = useState(true);
  const [initialFetchDone, setInitialFetchDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  const setProfile = useCallback((val: Profile | null | ((prev: Profile | null) => Profile | null)) => {
    setRootProfile(prev => {
      const next = typeof val === 'function' ? val(prev) : val;
      const sanitized = sanitizeProfile(next);
      if (typeof window !== 'undefined' && sanitized) {
        localStorage.setItem('quotes_sales_profile', JSON.stringify(sanitized));
      }
      return sanitized;
    });
  }, [setRootProfile]);

  // Helper to update last activity timestamp in localStorage
  const updateLastActivity = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('quotes_sales_last_activity', String(Date.now()));
    }
  }, []);

  // Records and Profiles lists
  const [records, setRecords] = useState<RecordItem[]>([]);
  // R1/R2: shared profiles list from ProfilesContext. Sanitization (stripping
  // legacy 'Review Van'/'Review Bike' allowed_types) is applied read-side so
  // quotes consumers see the same shape as before while the shared store keeps
  // raw rows for chuti/user-management views.
  const {
    profilesList: rawProfilesList,
    setProfilesList,
  } = useProfiles();
  const profilesList = useMemo(
    () => sanitizeProfilesList(rawProfilesList),
    [rawProfilesList],
  );
  const [availableDates, setAvailableDates] = useState<{ year: string; month: string }[]>([]);



// Helper to merge a specific month's records into the in-memory records list
const mergeMonthRecords = (
  prev: RecordItem[],
  freshMonthRecords: RecordItem[],
  year: string,
  month: string
): RecordItem[] => {
  const freshIds = new Set(freshMonthRecords.map(r => r.id));
  const remaining = prev.filter(r => {
    if (freshIds.has(r.id)) return false;
    if (!r.submitted_at) return true;
    const { year: rYear, month: rMonth } = getDhakaDateParts(r.submitted_at);
    if (!rYear || !rMonth) return true;
    return !(rYear === year && rMonth === month);
  });

  const combined = [...remaining, ...freshMonthRecords];
  combined.sort((a, b) => (b.submitted_at > a.submitted_at ? 1 : b.submitted_at < a.submitted_at ? -1 : 0));
  return combined;
};

  // Theme (extracted hook)
  const { theme, toggleTheme } = useQuotesTheme();

  // Filter States - Monthly Tab
  const [selectedYear, setSelectedYearState] = useState<string>(() => {
    if (typeof window !== 'undefined' && sessionUser?.id) {
      const nav = getNavigationContext(sessionUser.id, rootProfile);
      if (nav?.quotesFilters?.monthly?.year) {
        return nav.quotesFilters.monthly.year;
      }
    }
    return new Date().getFullYear().toString();
  });
  const [selectedMonth, setSelectedMonthState] = useState<string>(() => {
    if (typeof window !== 'undefined' && sessionUser?.id) {
      const nav = getNavigationContext(sessionUser.id, rootProfile);
      if (nav?.quotesFilters?.monthly?.month) {
        return nav.quotesFilters.monthly.month;
      }
    }
    return String(new Date().getMonth() + 1).padStart(2, '0');
  });

  // Filter States - Sale Summary Tab
  const [saleSelectedYear, setSaleSelectedYearState] = useState<string>(() => {
    if (typeof window !== 'undefined' && sessionUser?.id) {
      const nav = getNavigationContext(sessionUser.id, rootProfile);
      if (nav?.quotesFilters?.saleSummary?.year) {
        return nav.quotesFilters.saleSummary.year;
      }
    }
    return new Date().getFullYear().toString();
  });
  const [saleSelectedMonth, setSaleSelectedMonthState] = useState<string>(() => {
    if (typeof window !== 'undefined' && sessionUser?.id) {
      const nav = getNavigationContext(sessionUser.id, rootProfile);
      if (nav?.quotesFilters?.saleSummary?.month) {
        return nav.quotesFilters.saleSummary.month;
      }
    }
    return String(new Date().getMonth() + 1).padStart(2, '0');
  });

  const [saleRecordsLoading, setSaleRecordsLoading] = useState(true);

  // Synchronous refs for accurate closure-free state inspection
  const recordsRef = useRef<RecordItem[]>([]);
  useEffect(() => {
    recordsRef.current = records;
  }, [records]);

  const selectedYearRef = useRef(selectedYear);
  useEffect(() => {
    selectedYearRef.current = selectedYear;
  }, [selectedYear]);

  const selectedMonthRef = useRef(selectedMonth);
  useEffect(() => {
    selectedMonthRef.current = selectedMonth;
  }, [selectedMonth]);

  const saleSelectedYearRef = useRef(saleSelectedYear);
  useEffect(() => {
    saleSelectedYearRef.current = saleSelectedYear;
  }, [saleSelectedYear]);

  const saleSelectedMonthRef = useRef(saleSelectedMonth);
  useEffect(() => {
    saleSelectedMonthRef.current = saleSelectedMonth;
  }, [saleSelectedMonth]);

  // Track periods (YYYY-MM) that have completed at least one fetch/cache check
  const fetchedPeriodsRef = useRef<Set<string>>(new Set());
  const [fetchedPeriods, setFetchedPeriods] = useState<Set<string>>(() => new Set());

  const markPeriodFetched = useCallback((year: string, month: string) => {
    const key = `${year}-${month}`;
    fetchedPeriodsRef.current.add(key);
    setFetchedPeriods(prev => {
      if (prev.has(key)) return prev;
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  }, []);

  const hasRecordsInState = useCallback((year: string, month: string) => {
    return recordsRef.current.some(r => {
      if (!r.submitted_at) return false;
      const { year: rYear, month: rMonth } = getDhakaDateParts(r.submitted_at);
      return rYear === year && rMonth === month;
    });
  }, []);

  // Synchronous setters: if target period is not in state and not yet fetched, immediately set loading true
  // to eliminate any 1-frame flash of 'no data' before async fetch starts
  const setSelectedYear = useCallback((year: string) => {
    setSelectedYearState(year);
    selectedYearRef.current = year;
    if (sessionUser?.id) {
      saveNavigationContext(sessionUser.id, {
        quotesFilters: {
          monthly: { year }
        }
      });
    }
    const month = selectedMonthRef.current;
    const key = `${year}-${month}`;
    const hasData = hasRecordsInState(year, month);
    if (!hasData && !fetchedPeriodsRef.current.has(key)) {
      setRecordsLoading(true);
    } else {
      setRecordsLoading(false);
    }
  }, [hasRecordsInState, sessionUser]);

  const setSelectedMonth = useCallback((month: string) => {
    setSelectedMonthState(month);
    selectedMonthRef.current = month;
    if (sessionUser?.id) {
      saveNavigationContext(sessionUser.id, {
        quotesFilters: {
          monthly: { month }
        }
      });
    }
    const year = selectedYearRef.current;
    const key = `${year}-${month}`;
    const hasData = hasRecordsInState(year, month);
    if (!hasData && !fetchedPeriodsRef.current.has(key)) {
      setRecordsLoading(true);
    } else {
      setRecordsLoading(false);
    }
  }, [hasRecordsInState, sessionUser]);

  const setSaleSelectedYear = useCallback((year: string) => {
    setSaleSelectedYearState(year);
    saleSelectedYearRef.current = year;
    if (sessionUser?.id) {
      saveNavigationContext(sessionUser.id, {
        quotesFilters: {
          saleSummary: { year }
        }
      });
    }
    const month = saleSelectedMonthRef.current;
    const key = `${year}-${month}`;
    const hasData = hasRecordsInState(year, month);
    if (!hasData && !fetchedPeriodsRef.current.has(key)) {
      setSaleRecordsLoading(true);
    } else {
      setSaleRecordsLoading(false);
    }
  }, [hasRecordsInState, sessionUser]);

  const setSaleSelectedMonth = useCallback((month: string) => {
    setSaleSelectedMonthState(month);
    saleSelectedMonthRef.current = month;
    if (sessionUser?.id) {
      saveNavigationContext(sessionUser.id, {
        quotesFilters: {
          saleSummary: { month }
        }
      });
    }
    const year = saleSelectedYearRef.current;
    const key = `${year}-${month}`;
    const hasData = hasRecordsInState(year, month);
    if (!hasData && !fetchedPeriodsRef.current.has(key)) {
      setSaleRecordsLoading(true);
    } else {
      setSaleRecordsLoading(false);
    }
  }, [hasRecordsInState, sessionUser]);

  // Show a message using sonner
  const showToast = useCallback((type: 'success' | 'error', text: string) => {
    if (type === 'success') {
      toast.success(text);
    } else {
      toast.error(text);
    }
  }, []);

  const monthlyAbortControllerRef = useRef<AbortController | null>(null);
  const saleAbortControllerRef = useRef<AbortController | null>(null);
  const monthlyReqIdRef = useRef<number>(0);
  const saleReqIdRef = useRef<number>(0);
  const lastFetchedTimeRef = useRef<Map<string, number>>(new Map());

  // Abort any active fetches when component unmounts
  useEffect(() => {
    return () => {
      monthlyAbortControllerRef.current?.abort();
      saleAbortControllerRef.current?.abort();
    };
  }, []);

  // Self-healing account check: if user switched accounts, clear database cache
  useEffect(() => {
    if (!sessionUser?.id) return;
    const verifyUserCache = async () => {
      try {
        const cachedUserId = await getSyncTimestamp('active_user_id');
        if (cachedUserId && cachedUserId !== sessionUser.id) {
          await clearAllCache();
        }
        await setSyncTimestamp('active_user_id', sessionUser.id);
      } catch (err) {
        console.error('Failed to verify user cache:', err);
      }
    };
    verifyUserCache();
  }, [sessionUser?.id]);

  // Helper to extract and filter records from cache for current view
  const getFilteredLocalRecords = useCallback(async (year: string, month: string) => {
    try {
      const cached = await getCacheData<RecordItem>('records_cache');
      const isApproverScope = isAdminRole(profile) || profile?.role === 'supervisor';
      const filtered = cached.filter(r => {
        if (!r.submitted_at) return false;
        if (!isApproverScope && r.user_id !== sessionUser?.id) return false;
        const { year: rYear, month: rMonth } = getDhakaDateParts(r.submitted_at);
        return rYear === year && rMonth === month;
      });
      filtered.sort((a, b) => (b.submitted_at > a.submitted_at ? 1 : b.submitted_at < a.submitted_at ? -1 : 0));
      return filtered;
    } catch {
      return [];
    }
  }, [profile, sessionUser?.id]);

  // Fetch all records for a specific Month & Year with true SWR (instant paint + background sync)
  const fetchRecordsForMonth = useCallback(async (
    targetYear: string,
    targetMonth: string,
    isSilent: boolean = false,
    force: boolean = false,
    _isSale: boolean = false
  ) => {
    if (!sessionUser || !profile) return;

    const isSale = _isSale;
    const controllerRef = isSale ? saleAbortControllerRef : monthlyAbortControllerRef;
    const reqIdRef = isSale ? saleReqIdRef : monthlyReqIdRef;

    // 1. Immediately abort any active fetch on this channel
    if (controllerRef.current) {
      controllerRef.current.abort();
    }
    const controller = new AbortController();
    controllerRef.current = controller;
    const currentReqId = ++reqIdRef.current;
    const signal = controller.signal;

    const fetchKey = `${targetYear}-${targetMonth}-${sessionUser.id}`;
    const now = Date.now();
    const lastFetched = lastFetchedTimeRef.current.get(fetchKey) || 0;
    const canSkipRemote = (now - lastFetched < CACHE_THROTTLE_MS) && !force && !isSilent;

    // 2. SWR Instant Paint:
    // First, check in-memory recordsRef (0ms instantaneous lookup)
    const inMemoryRecords = recordsRef.current.filter(r => {
      if (!r.submitted_at) return false;
      const { year: y, month: m } = getDhakaDateParts(r.submitted_at);
      return y === targetYear && m === targetMonth;
    });

    if (inMemoryRecords.length > 0) {
      if (!isSale && targetYear === selectedYearRef.current && targetMonth === selectedMonthRef.current) {
        setRecordsLoading(false);
      }
      if (isSale && targetYear === saleSelectedYearRef.current && targetMonth === saleSelectedMonthRef.current) {
        setSaleRecordsLoading(false);
      }
    } else {
      // If not in state, check IndexedDB local cache
      const localRecords = await getFilteredLocalRecords(targetYear, targetMonth);
      if (signal.aborted || currentReqId !== reqIdRef.current) return;
      if (localRecords.length > 0) {
        setRecords(prev => mergeMonthRecords(prev, localRecords, targetYear, targetMonth));
        if (!isSale && targetYear === selectedYearRef.current && targetMonth === selectedMonthRef.current) {
          setRecordsLoading(false);
        }
        if (isSale && targetYear === saleSelectedYearRef.current && targetMonth === saleSelectedMonthRef.current) {
          setSaleRecordsLoading(false);
        }
      } else if (!isSilent) {
        if (!isSale && targetYear === selectedYearRef.current && targetMonth === selectedMonthRef.current) {
          setRecordsLoading(true);
        }
        if (isSale && targetYear === saleSelectedYearRef.current && targetMonth === saleSelectedMonthRef.current) {
          setSaleRecordsLoading(true);
        }
      }
    }

    if (canSkipRemote) {
      markPeriodFetched(targetYear, targetMonth);
      if (!isSale && targetYear === selectedYearRef.current && targetMonth === selectedMonthRef.current) {
        setRecordsLoading(false);
      }
      if (isSale && targetYear === saleSelectedYearRef.current && targetMonth === saleSelectedMonthRef.current) {
        setSaleRecordsLoading(false);
      }
      setInitialFetchDone(true);
      return;
    }

    try {
      if (navigator.onLine) {
        const isApproverScope = isAdminRole(profile) || profile.role === 'supervisor';
        const { startIso: startDate, endIso: endDate } = getDhakaMonthRange(targetYear, targetMonth);

        let monthlyData: RecordItem[] = [];
        let mPage = 0;
        const mPageSize = 1000;
        let mHasMore = true;

        while (mHasMore) {
          if (signal.aborted || currentReqId !== reqIdRef.current) return;
          const from = mPage * mPageSize;
          const to = from + mPageSize - 1;

          let query = supabase
            .from('records')
            .select(`${RECORD_COLUMNS}, profiles (username, full_name)`)
            .gte('submitted_at', startDate)
            .lte('submitted_at', endDate)
            .order('submitted_at', { ascending: false })
            .range(from, to)
            .abortSignal(signal);

          if (!isApproverScope) query = query.eq('user_id', sessionUser.id);

          const { data, error } = await query;
          if (signal.aborted || currentReqId !== reqIdRef.current) return;
          if (error) {
            if (signal.aborted) return;
            throw error;
          }

          if (data && data.length > 0) {
            monthlyData = [...monthlyData, ...(data as unknown as RecordItem[])];
            if (data.length < mPageSize) {
              mHasMore = false;
            } else {
              mPage++;
            }
          } else {
            mHasMore = false;
          }
        }

        if (signal.aborted || currentReqId !== reqIdRef.current) return;

        // Pending offline inserts for this month
        const pending = await getOfflineRecords();
        if (signal.aborted || currentReqId !== reqIdRef.current) return;

        const pendingForMonth = pending.filter(p => {
          if (p.action !== 'insert') return false;
          const { year: py, month: pm } = getDhakaDateParts(p.submitted_at);
          return py === targetYear && pm === targetMonth;
        }).map(p => ({
          id: p.localId || crypto.randomUUID(),
          user_id: p.user_id,
          file_name: p.file_name,
          branch_name: p.branch_name,
          codename: p.codename,
          file_type: p.file_type,
          submitted_at: p.submitted_at,
          created_at: p.submitted_at,
          profiles: {
            username: p.codename,
            full_name: profile?.full_name || null,
          },
        } as RecordItem));

        const combinedFresh = [...monthlyData, ...pendingForMonth];

        // Update React state directly with fresh data
        setRecords(prev => mergeMonthRecords(prev, combinedFresh, targetYear, targetMonth));
        lastFetchedTimeRef.current.set(fetchKey, Date.now());
        markPeriodFetched(targetYear, targetMonth);

        // Background cache update & pruning (non-blocking for UI)
        mergeCacheData('records_cache', monthlyData).then(async () => {
          try {
            const localCached = await getCacheData<RecordItem>('records_cache');
            const serverIdSet = new Set(monthlyData.map(row => row.id));
            const pendingInsertIds = new Set(
              pending.filter(p => p.action === 'insert').map(p => p.localId)
            );
            const toDeleteIds = localCached
              .filter(r => {
                if (!r.submitted_at) return false;
                const { year: y, month: m } = getDhakaDateParts(r.submitted_at);
                return y === targetYear && m === targetMonth && !serverIdSet.has(r.id) && !pendingInsertIds.has(r.id);
              })
              .map(r => r.id);

            if (toDeleteIds.length > 0) {
              await removeCacheItems('records_cache', toDeleteIds);
            }
          } catch (pruneErr) {
            console.warn('Background cache pruning error:', pruneErr);
          }
        }).catch(console.error);

      } else {
        // Offline: load from cache
        const offlineFiltered = await getFilteredLocalRecords(targetYear, targetMonth);
        if (signal.aborted || currentReqId !== reqIdRef.current) return;
        setRecords(prev => mergeMonthRecords(prev, offlineFiltered, targetYear, targetMonth));
        markPeriodFetched(targetYear, targetMonth);
      }
    } catch (netError: unknown) {
      if (signal.aborted || currentReqId !== reqIdRef.current) {
        return; // aborted intentionally, ignore
      }
      const errMsg = netError instanceof Error ? netError.message : String(netError);
      console.error(`Network sync/fetch failed for ${targetYear}-${targetMonth}, falling back to cache:`, errMsg, netError);
      const fallbackFiltered = await getFilteredLocalRecords(targetYear, targetMonth);
      if (signal.aborted || currentReqId !== reqIdRef.current) return;
      setRecords(prev => mergeMonthRecords(prev, fallbackFiltered, targetYear, targetMonth));
      markPeriodFetched(targetYear, targetMonth);
    } finally {
      if (!signal.aborted && currentReqId === reqIdRef.current) {
        markPeriodFetched(targetYear, targetMonth);
        if (!isSale && targetYear === selectedYearRef.current && targetMonth === selectedMonthRef.current) {
          setRecordsLoading(false);
        }
        if (isSale && targetYear === saleSelectedYearRef.current && targetMonth === saleSelectedMonthRef.current) {
          setSaleRecordsLoading(false);
        }
        setInitialFetchDone(true);
      }
    }
  }, [sessionUser, profile, getFilteredLocalRecords, markPeriodFetched]);

  // Fetch all active records (Monthly tab and Sale Summary tab if different) with true SWR
  const fetchRecords = useCallback(async (forceOrSilent: boolean = false, optionalForce: boolean = false) => {
    const force = typeof forceOrSilent === 'boolean' ? (optionalForce || forceOrSilent) : false;
    const isSilent = optionalForce ? forceOrSilent : false;
    const p1 = fetchRecordsForMonth(selectedYear, selectedMonth, isSilent, force, false);
    if (saleSelectedYear !== selectedYear || saleSelectedMonth !== selectedMonth) {
      const p2 = fetchRecordsForMonth(saleSelectedYear, saleSelectedMonth, isSilent, force, true);
      await Promise.all([p1, p2]);
    } else {
      await p1;
    }
  }, [selectedYear, selectedMonth, saleSelectedYear, saleSelectedMonth, fetchRecordsForMonth]);

  // Fetch unique month/year dates that contain submitted records for the logged-in user (or anyone if admin)
  const fetchAvailableDates = useCallback(async () => {
    if (!sessionUser || !profile) return;
    try {
      if (navigator.onLine) {
        try {
          const scopeUserId =
            !isAdminRole(profile) && profile.role !== 'supervisor' ? sessionUser.id : undefined;
          const remoteDates = await fetchSubmittedMonths(scopeUserId);
          setAvailableDates(remoteDates);
          return;
        } catch (netError: unknown) {
          const errMsg = netError instanceof Error ? netError.message : String(netError);
          console.error('Failed to fetch available dates online, falling back to cache:', errMsg, netError);
        }
      }

      // Offline / network fallback: derive distinct year/month pairs directly from cached records
      const cached = await getCacheData<RecordItem>('records_cache');
      const userRecords = cached.filter(r => (isAdminRole(profile) || profile.role === 'supervisor') || r.user_id === sessionUser.id);
      setAvailableDates(extractAvailableDatesFromRecords(userRecords));
    } catch (err) {
      console.error('Error fetching available dates:', err);
    }
  }, [sessionUser, profile]);

  // No-op activity logger (audit_logs removed)
  const logActivity = useCallback(async (_actionType: string, _targetId: string | null, _details: string) => {}, []);

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
      // One self-scoped transaction changes the credential and completes the
      // profile, so neither half can succeed on its own.
      const { data, error: rpcError } = await supabase.rpc('complete_profile_setup' as any, {
        p_username: username.toUpperCase().trim(),
        p_full_name: fullName.trim(),
        p_new_password: password,
      } as any);

      if (rpcError) throw rpcError;
      const result = Array.isArray(data) ? data[0] : data;

      const typedResult = result as { success?: boolean; message?: string; profile?: Profile } | null;
      if (!typedResult?.success || !typedResult.profile) {
        showToast('error', typedResult?.message || 'Failed to complete setup.');
        setSubmitting(false);
        return false;
      }

      const userProfile = typedResult.profile;
      setProfile(userProfile);
      if (typeof window !== 'undefined') {
        localStorage.setItem('quotes_sales_profile', JSON.stringify(userProfile));
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


  // Populate initial in-memory records from all cached records in IndexedDB
  useEffect(() => {
    let isMounted = true;
    const loadInitialCache = async () => {
      try {
        const cached = await getCacheData<RecordItem>('records_cache');
        if (isMounted && cached && cached.length > 0) {
          const isApproverScope = isAdminRole(profile) || profile?.role === 'supervisor';
          const filtered = cached.filter(r => {
            if (!r.submitted_at) return false;
            if (!isApproverScope && r.user_id !== sessionUser?.id) return false;
            return true;
          });
          filtered.sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime());
          setRecords(prev => (prev.length === 0 ? filtered : prev));
        }
      } catch (err) {
        console.error('Initial cache load error:', err);
      }
    };
    if (sessionUser && profile) {
      loadInitialCache();
    }
    return () => {
      isMounted = false;
    };
  }, [sessionUser?.id, profile?.role]);

  // Fetch available dates once upon authentication
  useEffect(() => {
    if (!loading && sessionUser && profile) {
      fetchAvailableDates();
    }
  }, [loading, sessionUser?.id, profile?.role, fetchAvailableDates]);

  // Fetch records when year/month changes for Monthly Tab
  useEffect(() => {
    if (!loading && sessionUser && profile) {
      fetchRecordsForMonth(selectedYear, selectedMonth, false, false, false);
    }
  }, [loading, sessionUser?.id, selectedYear, selectedMonth, fetchRecordsForMonth]);

  // Fetch records when year/month changes for Sale Summary Tab
  useEffect(() => {
    if (!loading && sessionUser && profile) {
      fetchRecordsForMonth(saleSelectedYear, saleSelectedMonth, false, false, true);
    }
  }, [loading, sessionUser?.id, saleSelectedYear, saleSelectedMonth, fetchRecordsForMonth]);



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
  // Throttle: prevent cascading refetches — minimum 5s between full fetches
  const lastQuotesRealtimeFetchRef = useRef<number>(0);
  const QUOTES_REALTIME_THROTTLE_MS = 5000;

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

  useAppEvent('realtime-profile-payload', (payloadData) => {
    const payload = (payloadData && typeof payloadData === 'object' && 'payload' in payloadData ? (payloadData as { payload: unknown }).payload : payloadData) as RealtimePayload;
    if (payload.eventType === 'INSERT') {
      // Force refresh on new profile
      handleRecordsRealtime();
      return;
    }
    if (payload.eventType === 'DELETE') {
      const deletedId = payload.old.id as string;
      if (sessionUser && deletedId === sessionUser.id) {
        // User deleted themselves or was deleted by admin
        toast.error('Your account has been deactivated.');
        if (typeof window !== 'undefined') {
          localStorage.removeItem('quotes_sales_profile');
        }
        router.replace('/login');
      } else {
        handleRecordsRealtime();
      }
      return;
    }
    if (payload.eventType === 'UPDATE' && payload.new) {
      if (payload.new.id === sessionUser?.id) {
        setProfile(payload.new as unknown as Profile);
        if (typeof window !== 'undefined') {
          localStorage.setItem('quotes_sales_profile', JSON.stringify(payload.new));
        }
      }
    }
  }, [sessionUser, profile, fetchRecords, fetchAvailableDates, router, setProfile]);

  useEffect(() => {
    return () => {
      if (realtimeDebounceRef.current) clearTimeout(realtimeDebounceRef.current);
    };
  }, []);

  const handleLogout = async () => {
    lastFetchedTimeRef.current.clear();
    if (typeof window !== 'undefined') {
      localStorage.removeItem('quotes_sales_profile');
    }
    try {
      await clearOwnedOfflineCaches();
    } catch (err) {
      console.error('Failed to clear cache on logout:', err);
    }
    // Local scope: log out this device only — other devices stay signed in
    await supabase.auth.signOut({ scope: 'local' });
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
    saleSelectedYear,
    setSaleSelectedYear,
    saleSelectedMonth,
    setSaleSelectedMonth,
    saleRecordsLoading,
    availableDates,
    fetchedPeriods,
    fetchAvailableDates,
    fetchRecords,
    fetchRecordsForMonth,
    addRecord,
    deleteRecord,
    deleteRecords,
    updateRecord,
    bulkUpdateRecords,
    createUser,
    resetUserPassword,
    deleteUser,
    adminUpdateUserProfile,
    auditLogs: [],
    auditLogsLoading: false,
    fetchAuditLogs: async () => {},

    completeFirstTimeSetup,
    handleLogout,
    logActivity
  };
};
