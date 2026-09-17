'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { toast } from 'sonner';
import { mistakesService, getNavigationContext, saveNavigationContext } from '@/services';
import { Profile, QuotationMistake } from '@/types';
import { canWriteQuotationMistakes, isFeatureEnabled } from '@/utils/permissionService';
import { useRealtimeHandler, RealtimePayload } from '@/contexts/RealtimeContext';
import {
  getDhakaDateParts,
  computeSmartMistakePeriod,
} from '@/utils/quotesDashboardHelpers';
import {
  getBusinessYear,
  getBusinessMonth,
} from '@/utils/businessDateTime';

let _mistakesCache: {
  key: string;
  data: QuotationMistake[];
  count: number;
} | null = null;

let _availableFiltersCache: {
  scopeKey: string;
  branches: string[];
  dates: Array<{ year: string; month: string }>;
} | null = null;

const MONTH_NAMES: Record<string, string> = {
  '01': 'January',
  '02': 'February',
  '03': 'March',
  '04': 'April',
  '05': 'May',
  '06': 'June',
  '07': 'July',
  '08': 'August',
  '09': 'September',
  '10': 'October',
  '11': 'November',
  '12': 'December',
};

interface UseQuotationMistakesOptions {
  sessionUser: SupabaseUser | null;
  profile: Profile | null;
  globalSettings?: any;
  profilesList?: Profile[];
}

export function useQuotationMistakes({
  sessionUser,
  profile,
  globalSettings,
  profilesList = [],
}: UseQuotationMistakesOptions) {
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const profileId = profile?.id || '';
  const sessionUserId = sessionUser?.id || '';
  const isUserRole = profile?.role === 'user';
  const scopeKey = isUserRole ? sessionUserId : '__all__';

  const { year: currentYearStr, month: currentMonthStr } = useMemo(() => {
    return {
      year: getBusinessYear(),
      month: getBusinessMonth(),
    };
  }, []);

  const cachedFilters = _availableFiltersCache?.scopeKey === scopeKey ? _availableFiltersCache : null;

  const initialSmartPeriod = useMemo(() => {
    if (cachedFilters) {
      return computeSmartMistakePeriod(cachedFilters.dates, currentYearStr, currentMonthStr);
    }
    return {
      year: currentYearStr,
      month: '',
    };
  }, [cachedFilters, currentYearStr, currentMonthStr]);

  const [isFiltersReady, setIsFiltersReady] = useState<boolean>(() => Boolean(cachedFilters));
  const isDefaultInitializedRef = useRef<boolean>(Boolean(cachedFilters));
  const prevScopeKeyRef = useRef<string>(scopeKey);

  // Filter States
  const initialNav = typeof window !== 'undefined' && sessionUserId ? getNavigationContext(sessionUserId, profile) : null;
  const savedMistakes = initialNav?.quotesFilters?.mistakes;

  const [searchQuery, setSearchQueryState] = useState<string>(() => savedMistakes?.search || '');
  const setSearchQuery = useCallback((queryOrFn: string | ((prev: string) => string)) => {
    setSearchQueryState(prev => {
      const next = typeof queryOrFn === 'function' ? queryOrFn(prev) : queryOrFn;
      if (sessionUserId) {
        saveNavigationContext(sessionUserId, {
          quotesFilters: { mistakes: { search: next } }
        });
      }
      return next;
    });
  }, [sessionUserId]);

  const [selectedBranch, setSelectedBranchState] = useState<string>(() => savedMistakes?.branch || '');
  const setSelectedBranch = useCallback((branchOrFn: string | ((prev: string) => string)) => {
    setSelectedBranchState(prev => {
      const next = typeof branchOrFn === 'function' ? branchOrFn(prev) : branchOrFn;
      if (sessionUserId) {
        saveNavigationContext(sessionUserId, {
          quotesFilters: { mistakes: { branch: next } }
        });
      }
      return next;
    });
  }, [sessionUserId]);

  const [selectedYear, setSelectedYearState] = useState<string>(() => savedMistakes?.year || initialSmartPeriod.year);
  const setSelectedYear = useCallback((yearOrFn: string | ((prev: string) => string)) => {
    setSelectedYearState(prev => {
      const next = typeof yearOrFn === 'function' ? yearOrFn(prev) : yearOrFn;
      if (sessionUserId) {
        saveNavigationContext(sessionUserId, {
          quotesFilters: { mistakes: { year: next } }
        });
      }
      return next;
    });
  }, [sessionUserId]);

  const [selectedMonth, setSelectedMonthState] = useState<string>(() => savedMistakes?.month || initialSmartPeriod.month);
  const setSelectedMonth = useCallback((monthOrFn: string | ((prev: string) => string)) => {
    setSelectedMonthState(prev => {
      const next = typeof monthOrFn === 'function' ? monthOrFn(prev) : monthOrFn;
      if (sessionUserId) {
        saveNavigationContext(sessionUserId, {
          quotesFilters: { mistakes: { month: next } }
        });
      }
      return next;
    });
  }, [sessionUserId]);

  const [selectedDate, setSelectedDate] = useState<string>('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');

  // Available metadata derived dynamically from actual quotation mistake records
  const [availableBranches, setAvailableBranches] = useState<string[]>(() => cachedFilters?.branches || []);
  const [availableDates, setAvailableDates] = useState<Array<{ year: string; month: string }>>(() => cachedFilters?.dates || []);

  useEffect(() => {
    if (prevScopeKeyRef.current !== scopeKey) {
      prevScopeKeyRef.current = scopeKey;
      isDefaultInitializedRef.current = false;
      setIsFiltersReady(false);
    }
  }, [scopeKey]);

  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 15;

  const getCacheKey = useCallback(() => {
    return `${sessionUserId}_${debouncedSearchQuery}_${selectedBranch}_${selectedYear}_${selectedMonth}_${selectedDate}_${currentPage}`;
  }, [sessionUserId, debouncedSearchQuery, selectedBranch, selectedYear, selectedMonth, selectedDate, currentPage]);

  const [mistakes, setMistakes] = useState<QuotationMistake[]>(() => {
    const key = `${sessionUserId}_${debouncedSearchQuery}_${selectedBranch}_${selectedYear}_${selectedMonth}_${selectedDate}_${currentPage}`;
    return _mistakesCache?.key === key ? _mistakesCache.data : [];
  });
  
  const [isLoading, setIsLoading] = useState<boolean>(() => {
    const key = `${sessionUserId}_${debouncedSearchQuery}_${selectedBranch}_${selectedYear}_${selectedMonth}_${selectedDate}_${currentPage}`;
    return _mistakesCache?.key !== key;
  });
  
  const [totalCount, setTotalCount] = useState(() => {
    const key = `${sessionUserId}_${debouncedSearchQuery}_${selectedBranch}_${selectedYear}_${selectedMonth}_${selectedDate}_${currentPage}`;
    return _mistakesCache?.key === key ? _mistakesCache.count : 0;
  });

  // Permission Checks
  const canWrite = useMemo(
    () => canWriteQuotationMistakes(profile, globalSettings, profilesList),
    [profile, globalSettings, profilesList]
  );

  const canRead = useMemo(
    () => isFeatureEnabled('quote_mistakes_read', globalSettings, profile),
    [globalSettings, profile]
  );

  // Fetch distinct available branches and year/month dates from actual mistake data
  const fetchAvailableFilters = useCallback(async () => {
    if (!sessionUserId || !profileId || !canRead) return;
    try {
      const scopeUserId = isUserRole ? sessionUserId : undefined;
      const { data, error: rpcErr } = await mistakesService.getAvailableMistakeFilters(scopeUserId);
      if (!rpcErr && data) {
        const branches = data.branches || [];
        const dates = data.dates || [];
        setAvailableBranches(branches);
        setAvailableDates(dates);

        _availableFiltersCache = {
          scopeKey,
          branches,
          dates,
        };

        if (!isDefaultInitializedRef.current) {
          isDefaultInitializedRef.current = true;
          const { year: smartYear, month: smartMonth } = computeSmartMistakePeriod(
            dates,
            currentYearStr,
            currentMonthStr
          );
          setSelectedYear(smartYear);
          setSelectedMonth(smartMonth);
          setIsFiltersReady(true);
        }
      } else {
        if (!isDefaultInitializedRef.current) {
          isDefaultInitializedRef.current = true;
          setIsFiltersReady(true);
        }
      }
    } catch (err) {
      console.error('Failed to fetch available mistake filters:', err);
      if (!isDefaultInitializedRef.current) {
        isDefaultInitializedRef.current = true;
        setIsFiltersReady(true);
      }
    }
  }, [sessionUserId, profileId, canRead, isUserRole, scopeKey, currentYearStr, currentMonthStr]);

  useEffect(() => {
    void fetchAvailableFilters();
  }, [fetchAvailableFilters]);

  const availableYearsWithThisMonth = useMemo(() => {
    if (!selectedMonth) return [];
    return Array.from(
      new Set(
        availableDates
          .filter((d) => d.month === selectedMonth)
          .map((d) => d.year)
      )
    );
  }, [availableDates, selectedMonth]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearchQuery(searchQuery.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  const fetchMistakes = useCallback(async (isSilent = false, signal?: AbortSignal) => {
    if (!sessionUserId || !profileId || !canRead) {
      setMistakes([]);
      setTotalCount(0);
      setIsLoading(false);
      return;
    }

    try {
      if (!isSilent) setIsLoading(true);
      setError(null);

      const { data, count, error: fetchErr } = await mistakesService.getQuotationMistakes({
        userId: isUserRole ? sessionUserId : undefined,
        page: currentPage,
        pageSize,
        search: debouncedSearchQuery,
        branch: selectedBranch,
        year: selectedYear,
        month: selectedMonth,
        date: selectedDate,
        availableYearsForMonth: !selectedYear && selectedMonth ? availableYearsWithThisMonth : undefined,
        signal,
      });

      if (signal?.aborted) return;

      if (fetchErr) {
        console.error('Failed to fetch quotation mistakes:', fetchErr);
        setError(fetchErr.message);
        toast.error('Failed to load quotation mistakes.');
      } else {
        const mappedData = (data as QuotationMistake[]) || [];
        setMistakes(mappedData);
        setTotalCount(count);
        _mistakesCache = {
          key: getCacheKey(),
          data: mappedData,
          count,
        };
      }
    } catch (err: any) {
      if (signal?.aborted || err?.name === 'AbortError') return;
      console.error('Error in fetchMistakes:', err);
      setError(err?.message || 'Error loading mistakes.');
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, [sessionUserId, profileId, canRead, isUserRole, currentPage, debouncedSearchQuery, selectedBranch, selectedYear, selectedMonth, selectedDate, availableYearsWithThisMonth, getCacheKey]);

  // Fetch mistakes once filters are initialized
  useEffect(() => {
    if (!isFiltersReady) return;
    const isCached = _mistakesCache?.key === getCacheKey();
    const controller = new AbortController();
    void fetchMistakes(isCached, controller.signal);
    return () => controller.abort();
  }, [fetchMistakes, getCacheKey, isFiltersReady]);

  // Realtime Integration
  const realtimeDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const suppressRealtimeUntilRef = useRef(0);
  const handleRealtimePayload = useCallback(
    (_payload: RealtimePayload) => {
      if (Date.now() < suppressRealtimeUntilRef.current) return;
      if (realtimeDebounceRef.current) clearTimeout(realtimeDebounceRef.current);
      realtimeDebounceRef.current = setTimeout(() => {
        void fetchMistakes(true);
        void fetchAvailableFilters();
      }, 350);
    },
    [fetchMistakes, fetchAvailableFilters]
  );

  useRealtimeHandler('quotation_mistakes', handleRealtimePayload);

  useEffect(() => {
    return () => {
      if (realtimeDebounceRef.current) clearTimeout(realtimeDebounceRef.current);
    };
  }, []);

  // Dynamic Branch Options (only branches with actual mistake data + All Branches)
  const branchOptions = useMemo(() => {
    return [
      { value: '', label: 'All Branches' },
      ...availableBranches.map((b) => ({ value: b, label: b })),
    ];
  }, [availableBranches]);

  // Dynamic Year Options (only years with actual mistake data + All Years)
  const dynamicYears = useMemo(() => {
    const yearsSet = new Set<string>();
    availableDates.forEach((d) => {
      if (d.year && /^\d{4}$/.test(d.year)) {
        yearsSet.add(d.year);
      }
    });
    return Array.from(yearsSet).sort(
      (a, b) => parseInt(b, 10) - parseInt(a, 10)
    );
  }, [availableDates]);

  const yearOptions = useMemo(() => {
    const opts = [{ value: '', label: 'All Years' }];
    dynamicYears.forEach((y) => {
      opts.push({ value: y, label: y });
    });
    return opts;
  }, [dynamicYears]);

  // Dynamic Month Options (Year-Aware!)
  // If a year is selected, only show months that have mistakes in that year.
  // If "All Years" is selected, show all months with mistakes across all years.
  const dynamicMonths = useMemo(() => {
    const monthsSet = new Set<string>();
    availableDates.forEach((d) => {
      if (!selectedYear || d.year === selectedYear) {
        if (d.month && /^\d{2}$/.test(d.month)) {
          monthsSet.add(d.month);
        }
      }
    });

    const sortedKeys = Array.from(monthsSet).sort(
      (a, b) => parseInt(a, 10) - parseInt(b, 10)
    );

    return sortedKeys.map((m) => ({
      value: m,
      label: MONTH_NAMES[m] || m,
    }));
  }, [availableDates, selectedYear]);

  const monthOptions = useMemo(() => {
    return [{ value: '', label: 'All Months' }, ...dynamicMonths];
  }, [dynamicMonths]);

  // Year Auto-Revalidation:
  // If dynamicYears have loaded and selectedYear has no data, fall back to first available year or All Years
  useEffect(() => {
    if (availableDates.length > 0 && selectedYear && !dynamicYears.includes(selectedYear)) {
      setSelectedYear(dynamicYears[0] || '');
    }
  }, [availableDates, dynamicYears, selectedYear]);

  // Month Revalidation when Year changes:
  // If selectedMonth has no data in the newly selected year, reset to "All Months"
  const prevYearRef = useRef<string>(selectedYear);
  useEffect(() => {
    if (prevYearRef.current !== selectedYear) {
      prevYearRef.current = selectedYear;
      if (selectedMonth) {
        const availableMonthsForNewYear = availableDates
          .filter((d) => !selectedYear || d.year === selectedYear)
          .map((d) => d.month);
        if (availableMonthsForNewYear.length > 0 && !availableMonthsForNewYear.includes(selectedMonth)) {
          setSelectedMonth('');
        }
      }
    }
  }, [selectedYear, selectedMonth, availableDates]);

  // Branch Revalidation:
  // If selectedBranch is deleted/edited away, reset to "All Branches"
  useEffect(() => {
    if (selectedBranch && availableBranches.length > 0 && !availableBranches.includes(selectedBranch)) {
      setSelectedBranch('');
    }
  }, [availableBranches, selectedBranch]);

  // Synchronized Filter Handlers
  const handleYearChange = useCallback((year: string) => {
    setSelectedYear(year);
    if (selectedDate) {
      const parts = selectedDate.split('-');
      if (year && parts[0] !== year) {
        setSelectedDate('');
      }
    }
  }, [selectedDate]);

  const handleMonthChange = useCallback((month: string) => {
    setSelectedMonth(month);
    if (selectedDate) {
      const parts = selectedDate.split('-');
      if (month && parts[1] !== month) {
        setSelectedDate('');
      }
    }
  }, [selectedDate]);

  const handleDateChange = useCallback((dateStr: string) => {
    setSelectedDate(dateStr);
    if (dateStr) {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        setSelectedYear(parts[0]);
        setSelectedMonth(parts[1]);
      }
    }
  }, []);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedBranch, selectedDate, selectedYear, selectedMonth]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  // Check if any filter is active relative to smart defaults
  const isFilterActive = useMemo(() => {
    const { year: defaultYear, month: defaultMonth } = computeSmartMistakePeriod(
      availableDates,
      currentYearStr,
      currentMonthStr
    );
    return Boolean(
      searchQuery ||
      selectedBranch ||
      selectedDate ||
      selectedYear !== defaultYear ||
      selectedMonth !== defaultMonth
    );
  }, [searchQuery, selectedBranch, selectedDate, selectedYear, selectedMonth, availableDates, currentYearStr, currentMonthStr]);

  // Reset all filters to smart defaults
  const resetFilters = useCallback(() => {
    setSearchQuery('');
    setSelectedBranch('');
    setSelectedDate('');
    setCurrentPage(1);

    const { year: defaultYear, month: defaultMonth } = computeSmartMistakePeriod(
      availableDates,
      currentYearStr,
      currentMonthStr
    );
    setSelectedYear(defaultYear);
    setSelectedMonth(defaultMonth);
  }, [availableDates, currentYearStr, currentMonthStr]);

  // ADD MISTAKE
  const addMistake = useCallback(
    async (payload: {
      date: string;
      filename: string;
      branch: string;
      user_id: string;
      codename: string;
      mistake_details: string;
      penalty: string;
    }) => {
      if (!canWrite) {
        toast.error('You do not have permission to add mistakes.');
        return false;
      }

      try {
        setIsSubmitting(true);
        const newRecord = {
          date: payload.date,
          filename: payload.filename.trim(),
          branch: payload.branch.trim(),
          user_id: payload.user_id,
          codename: payload.codename.trim(),
          mistake_details: payload.mistake_details.trim(),
          penalty: payload.penalty.trim(),
          created_by: sessionUser?.id || null,
          updated_by: sessionUser?.id || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const { error: insertErr } = await mistakesService.createQuotationMistake(newRecord);

        if (insertErr) {
          console.error('Failed to add quotation mistake:', insertErr);
          toast.error(`Failed to add mistake: ${insertErr.message}`);
          return false;
        }

        suppressRealtimeUntilRef.current = Date.now() + 1000;
        toast.success('Quotation mistake added successfully!');
        void fetchAvailableFilters();
        await fetchMistakes();
        return true;
      } catch (err: any) {
        console.error('Error adding mistake:', err);
        toast.error(`Error: ${err?.message || err}`);
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [canWrite, sessionUser, fetchMistakes, fetchAvailableFilters]
  );

  // EDIT MISTAKE
  const updateMistake = useCallback(
    async (
      id: string,
      payload: {
        date: string;
        filename: string;
        branch: string;
        user_id: string;
        codename: string;
        mistake_details: string;
        penalty: string;
      }
    ) => {
      if (!canWrite) {
        toast.error('You do not have permission to edit mistakes.');
        return false;
      }

      try {
        setIsSubmitting(true);
        const updateData = {
          date: payload.date,
          filename: payload.filename.trim(),
          branch: payload.branch.trim(),
          user_id: payload.user_id,
          codename: payload.codename.trim(),
          mistake_details: payload.mistake_details.trim(),
          penalty: payload.penalty.trim(),
          updated_by: sessionUser?.id || null,
          updated_at: new Date().toISOString(),
        };

        const { error: updateErr } = await mistakesService.updateQuotationMistake(id, updateData);

        if (updateErr) {
          console.error('Failed to update quotation mistake:', updateErr);
          toast.error(`Failed to update mistake: ${updateErr.message}`);
          return false;
        }

        suppressRealtimeUntilRef.current = Date.now() + 1000;
        toast.success('Quotation mistake updated successfully!');
        void fetchAvailableFilters();
        await fetchMistakes();
        return true;
      } catch (err: any) {
        console.error('Error updating mistake:', err);
        toast.error(`Error: ${err?.message || err}`);
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [canWrite, sessionUser, fetchMistakes, fetchAvailableFilters]
  );

  // DELETE MISTAKE
  const deleteMistake = useCallback(
    async (item: QuotationMistake) => {
      if (!canWrite) {
        toast.error('You do not have permission to delete mistakes.');
        return false;
      }

      try {
        setIsSubmitting(true);
        const { error: deleteErr } = await mistakesService.deleteQuotationMistake(item.id);

        if (deleteErr) {
          console.error('Failed to delete quotation mistake:', deleteErr);
          toast.error(`Failed to delete mistake: ${deleteErr.message}`);
          return false;
        }

        suppressRealtimeUntilRef.current = Date.now() + 1000;
        toast.success('Quotation mistake deleted successfully!');
        void fetchAvailableFilters();
        await fetchMistakes();
        return true;
      } catch (err: any) {
        console.error('Error deleting mistake:', err);
        toast.error(`Error: ${err?.message || err}`);
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [canWrite, fetchMistakes, fetchAvailableFilters]
  );

  // BULK DELETE MISTAKES
  const bulkDeleteMistakes = useCallback(
    async (ids: string[]) => {
      if (!canWrite) {
        toast.error('You do not have permission to delete mistakes.');
        return false;
      }
      if (ids.length === 0) return true;

      try {
        setIsSubmitting(true);
        const { error: deleteErr } = await mistakesService.bulkDeleteQuotationMistakes(ids);

        if (deleteErr) {
          console.error('Failed to bulk delete quotation mistakes:', deleteErr);
          toast.error(`Failed to bulk delete: ${deleteErr.message}`);
          return false;
        }

        suppressRealtimeUntilRef.current = Date.now() + 1000;
        toast.success(`Successfully deleted ${ids.length} mistakes!`);
        void fetchAvailableFilters();
        await fetchMistakes();
        return true;
      } catch (err: any) {
        console.error('Error bulk deleting mistakes:', err);
        toast.error(`Error: ${err?.message || err}`);
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [canWrite, fetchMistakes, fetchAvailableFilters]
  );

  return {
    mistakes,
    allFilteredCount: totalCount,
    totalCount,
    isLoading: isLoading || !isFiltersReady,
    isSubmitting,
    error,
    canWrite,
    canRead,
    isUserRole,

    // Filter States & Handlers
    searchQuery,
    setSearchQuery,
    selectedBranch,
    setSelectedBranch,
    selectedYear,
    setSelectedYear,
    selectedMonth,
    setSelectedMonth,
    selectedDate,
    setSelectedDate,
    handleYearChange,
    handleMonthChange,
    handleDateChange,
    isFilterActive,
    resetFilters,

    // Dynamic Filter Options
    branchOptions,
    yearOptions,
    monthOptions,
    availableBranches,
    availableDates,

    // Pagination
    currentPage,
    setCurrentPage,
    totalPages,
    pageSize,

    // Actions
    fetchMistakes,
    fetchAvailableFilters,
    addMistake,
    updateMistake,
    deleteMistake,
    bulkDeleteMistakes,
  };
}
