'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { toast } from 'sonner';
import { mistakesService } from '@/services';
import { Profile, QuotationMistake } from '@/types';
import { canWriteQuotationMistakes, isFeatureEnabled } from '@/utils/permissionService';
import { useRealtimeHandler, RealtimePayload } from '@/contexts/RealtimeContext';

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
  const [mistakes, setMistakes] = useState<QuotationMistake[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);

  // Filter States
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');

  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 15;

  // Permission Checks
  const canWrite = useMemo(
    () => canWriteQuotationMistakes(profile, globalSettings, profilesList),
    [profile, globalSettings, profilesList]
  );

  const canRead = useMemo(
    () => isFeatureEnabled('quote_mistakes_read', globalSettings, profile),
    [globalSettings, profile]
  );

  const isUserRole = profile?.role === 'user';

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearchQuery(searchQuery.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  const fetchMistakes = useCallback(async (signal?: AbortSignal) => {
    if (!sessionUser || !profile || !canRead) {
      setMistakes([]);
      setTotalCount(0);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const { data, count, error: fetchErr } = await mistakesService.getQuotationMistakes({
        userId: isUserRole ? sessionUser.id : undefined,
        page: currentPage,
        pageSize,
        search: debouncedSearchQuery,
        branch: selectedBranch,
        year: selectedYear,
        month: selectedMonth,
        date: selectedDate,
        signal,
      });

      if (signal?.aborted) return;

      if (fetchErr) {
        console.error('Failed to fetch quotation mistakes:', fetchErr);
        setError(fetchErr.message);
        toast.error('Failed to load quotation mistakes.');
      } else {
        setMistakes((data as QuotationMistake[]) || []);
        setTotalCount(count);
      }
    } catch (err: any) {
      if (signal?.aborted || err?.name === 'AbortError') return;
      console.error('Error in fetchMistakes:', err);
      setError(err?.message || 'Error loading mistakes.');
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, [sessionUser, profile, canRead, isUserRole, currentPage, debouncedSearchQuery, selectedBranch, selectedYear, selectedMonth, selectedDate]);

  // Initial Fetch
  useEffect(() => {
    const controller = new AbortController();
    void fetchMistakes(controller.signal);
    return () => controller.abort();
  }, [fetchMistakes]);

  // Realtime Integration
  const realtimeDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const suppressRealtimeUntilRef = useRef(0);
  const handleRealtimePayload = useCallback(
    (_payload: RealtimePayload) => {
      if (Date.now() < suppressRealtimeUntilRef.current) return;
      if (realtimeDebounceRef.current) clearTimeout(realtimeDebounceRef.current);
      realtimeDebounceRef.current = setTimeout(() => {
        fetchMistakes();
      }, 350);
    },
    [fetchMistakes]
  );

  useRealtimeHandler('quotation_mistakes', handleRealtimePayload);

  useEffect(() => {
    return () => {
      if (realtimeDebounceRef.current) clearTimeout(realtimeDebounceRef.current);
    };
  }, []);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedBranch, selectedDate, selectedYear, selectedMonth]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  // Check if any filter is active
  const isFilterActive = useMemo(() => {
    return Boolean(searchQuery || selectedBranch || selectedYear || selectedMonth || selectedDate);
  }, [searchQuery, selectedBranch, selectedYear, selectedMonth, selectedDate]);

  // Reset all filters
  const resetFilters = useCallback(() => {
    setSearchQuery('');
    setSelectedBranch('');
    setSelectedYear('');
    setSelectedMonth('');
    setSelectedDate('');
    setCurrentPage(1);
  }, []);

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
    [canWrite, sessionUser, fetchMistakes]
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
    [canWrite, sessionUser, fetchMistakes]
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
    [canWrite, fetchMistakes]
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
    [canWrite, fetchMistakes]
  );

  return {
    mistakes,
    allFilteredCount: totalCount,
    totalCount,
    isLoading,
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
    isFilterActive,
    resetFilters,

    // Pagination
    currentPage,
    setCurrentPage,
    totalPages,
    pageSize,

    // Actions
    fetchMistakes,
    addMistake,
    updateMistake,
    deleteMistake,
    bulkDeleteMistakes,
  };
}
