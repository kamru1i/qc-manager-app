'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { supabase } from '@/utils/supabase';
import { RecordItem } from '@/types';
import {
  AdminSalesSummary,
  getTodaySalesRecords,
  calculateAdminSalesSummary,
  withPercentages,
} from '@/utils/adminSalesSummary';

interface UseAdminSalesSummaryOptions {
  /** Only fetch when the box is actually rendered (Sale permission + tab open). */
  enabled: boolean;
  /** Already-loaded month records — used as instant fallback and for admins (who have all rows locally). */
  records: RecordItem[];
}

const REFRESH_THROTTLE_MS = 30000;

/**
 * Today's overall (all-users) deduplicated sales report.
 *
 * Primary source: get_admin_sales_summary RPC — server-side aggregate over
 * every user's Sale records for today (regular users can't read others' rows
 * under RLS, and admins avoid re-scanning locally). Fallback: local
 * calculation over the already-fetched records (offline / RPC unavailable).
 */
export const useAdminSalesSummary = ({ enabled, records }: UseAdminSalesSummaryOptions) => {
  const [serverSummary, setServerSummary] = useState<AdminSalesSummary | null>(null);
  const lastFetchRef = useRef(0);

  // Local fallback, memoized: today's Sale records → dedup → counts
  const localSummary = useMemo<AdminSalesSummary>(
    () => calculateAdminSalesSummary(getTodaySalesRecords(records)),
    [records]
  );

  const fetchSummary = useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && now - lastFetchRef.current < REFRESH_THROTTLE_MS) return;
    lastFetchRef.current = now;
    try {
      const todayStr = new Date().toLocaleDateString('en-CA');
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      const { data, error } = await supabase.rpc('get_admin_sales_summary', {
        p_today: todayStr,
        p_tz: timeZone,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      if (row) {
        setServerSummary(withPercentages(row.total_sold ?? 0, row.total_unsold ?? 0));
      }
    } catch (err) {
      // Keep local fallback; RPC may not be deployed yet or device is offline
      console.warn('[useAdminSalesSummary] RPC failed, using local records:', err);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    fetchSummary(true);
  }, [enabled, fetchSummary]);

  // Refresh (throttled) when today's records change while the box is visible —
  // records updates arrive via the existing realtime pipeline, so this stays
  // current without its own subscription.
  useEffect(() => {
    if (!enabled) return;
    fetchSummary();
  }, [enabled, localSummary, fetchSummary]);

  return serverSummary ?? localSummary;
};
