'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { toast } from 'sonner';
import { supabase } from '@/utils/supabase';
import { Profile, QuotationMistake } from '@/types';
import { QUOTATION_MISTAKE_COLUMNS } from '@/utils/dbColumns';
import { canWriteQuotationMistakes, isFeatureEnabled } from '@/utils/permissionService';
import { useRealtimeHandler, RealtimePayload } from '@/contexts/RealtimeContext';
import { logAuditEvent } from '@/utils/auditLogger';

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

  // Filter States
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>('');

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

  const fetchMistakes = useCallback(async () => {
    if (!sessionUser || !profile) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      let query = supabase
        .from('quotation_mistakes')
        .select(QUOTATION_MISTAKE_COLUMNS)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });

      // STRICT USER ISOLATION: Regular users can ONLY query their own records
      if (isUserRole) {
        query = query.eq('user_id', sessionUser.id);
      }

      const { data, error: fetchErr } = await query.limit(1000);

      if (fetchErr) {
        console.error('Failed to fetch quotation mistakes:', fetchErr);
        setError(fetchErr.message);
        toast.error('Failed to load quotation mistakes.');
      } else {
        setMistakes((data as QuotationMistake[]) || []);
      }
    } catch (err: any) {
      console.error('Error in fetchMistakes:', err);
      setError(err?.message || 'Error loading mistakes.');
    } finally {
      setIsLoading(false);
    }
  }, [sessionUser, profile, isUserRole]);

  // Initial Fetch
  useEffect(() => {
    fetchMistakes();
  }, [fetchMistakes]);

  // Realtime Integration
  const realtimeDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const handleRealtimePayload = useCallback(
    (_payload: RealtimePayload) => {
      if (realtimeDebounceRef.current) clearTimeout(realtimeDebounceRef.current);
      realtimeDebounceRef.current = setTimeout(() => {
        fetchMistakes();
      }, 500);
    },
    [fetchMistakes]
  );

  useRealtimeHandler('quotation_mistakes', handleRealtimePayload);

  useEffect(() => {
    return () => {
      if (realtimeDebounceRef.current) clearTimeout(realtimeDebounceRef.current);
    };
  }, []);

  // Filtered Mistakes List
  const filteredMistakes = useMemo(() => {
    return mistakes.filter((item) => {
      // 1. Search Query (Filename, Codename)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesFilename = (item.filename || '').toLowerCase().includes(q);
        const matchesCodename = (item.codename || '').toLowerCase().includes(q);
        if (!matchesFilename && !matchesCodename) return false;
      }

      // 2. Branch Filter
      if (selectedBranch) {
        if ((item.branch || '').toUpperCase().trim() !== selectedBranch.toUpperCase().trim()) {
          return false;
        }
      }

      // 3. Specific Date Filter
      if (selectedDate) {
        if (item.date !== selectedDate) return false;
      }

      // 4. Year & Month Filter (if specific date is not selected)
      if (!selectedDate && item.date) {
        const itemDateObj = new Date(item.date);
        if (!isNaN(itemDateObj.getTime())) {
          if (selectedYear) {
            const itemYear = String(itemDateObj.getFullYear());
            if (itemYear !== selectedYear) return false;
          }
          if (selectedMonth) {
            const itemMonth = String(itemDateObj.getMonth() + 1).padStart(2, '0');
            if (itemMonth !== selectedMonth) return false;
          }
        }
      }

      return true;
    });
  }, [mistakes, searchQuery, selectedBranch, selectedDate, selectedYear, selectedMonth]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedBranch, selectedDate, selectedYear, selectedMonth]);

  const totalPages = Math.max(1, Math.ceil(filteredMistakes.length / pageSize));
  const paginatedMistakes = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredMistakes.slice(start, start + pageSize);
  }, [filteredMistakes, currentPage, pageSize]);

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

        const { data, error: insertErr } = await supabase
          .from('quotation_mistakes')
          .insert([newRecord])
          .select(QUOTATION_MISTAKE_COLUMNS)
          .single();

        if (insertErr) {
          console.error('Failed to add quotation mistake:', insertErr);
          toast.error(`Failed to add mistake: ${insertErr.message}`);
          return false;
        }

        // Audit Log
        await logAuditEvent({
          actor: profile,
          actionType: 'CREATE_MISTAKE',
          targetId: data?.id || null,
          details: `Created quotation mistake record for ${payload.codename} (${payload.filename}) on ${payload.date}`,
        });

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
    [canWrite, sessionUser, profile, fetchMistakes]
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

        const { error: updateErr } = await supabase
          .from('quotation_mistakes')
          .update(updateData)
          .eq('id', id);

        if (updateErr) {
          console.error('Failed to update quotation mistake:', updateErr);
          toast.error(`Failed to update mistake: ${updateErr.message}`);
          return false;
        }

        // Audit Log
        await logAuditEvent({
          actor: profile,
          actionType: 'UPDATE_MISTAKE',
          targetId: id,
          details: `Updated quotation mistake record for ${payload.codename} (${payload.filename}) on ${payload.date}`,
        });

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
    [canWrite, sessionUser, profile, fetchMistakes]
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
        const { error: deleteErr } = await supabase
          .from('quotation_mistakes')
          .delete()
          .eq('id', item.id);

        if (deleteErr) {
          console.error('Failed to delete quotation mistake:', deleteErr);
          toast.error(`Failed to delete mistake: ${deleteErr.message}`);
          return false;
        }

        // Audit Log
        await logAuditEvent({
          actor: profile,
          actionType: 'DELETE_MISTAKE',
          targetId: item.id,
          details: `Deleted quotation mistake record for ${item.codename} (${item.filename}) on ${item.date}`,
        });

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
    [canWrite, profile, fetchMistakes]
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
        const { error: deleteErr } = await supabase
          .from('quotation_mistakes')
          .delete()
          .in('id', ids);

        if (deleteErr) {
          console.error('Failed to bulk delete quotation mistakes:', deleteErr);
          toast.error(`Failed to bulk delete: ${deleteErr.message}`);
          return false;
        }

        // Audit Log
        await logAuditEvent({
          actor: profile,
          actionType: 'DELETE_MISTAKE',
          details: `Bulk deleted ${ids.length} quotation mistakes`,
        });

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
    [canWrite, profile, fetchMistakes]
  );

  return {
    mistakes: paginatedMistakes,
    allFilteredCount: filteredMistakes.length,
    totalCount: mistakes.length,
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
