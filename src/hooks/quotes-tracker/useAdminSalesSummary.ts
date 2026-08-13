'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { recordsService } from '@/services';
import { RecordItem } from '@/types';
import {
  AdminSalesSummary,
  getTodaySalesRecords,
  calculateAdminSalesSummary,
  buildSummary,
} from '@/utils/adminSalesSummary';

interface UseAdminSalesSummaryOptions {
  /** Only fetch when the box is actually rendered (Sale permission + tab open). */
  enabled: boolean;
  /** Already-loaded month records — used as instant fallback and for admins (who have all rows locally). */
  records: RecordItem[];
  targetDateStr?: string;
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
export const useAdminSalesSummary = ({ enabled, records, targetDateStr }: UseAdminSalesSummaryOptions) => {
  const [serverSummary, setServerSummary] = useState<AdminSalesSummary | null>(null);
  const lastFetchRef = useRef(0);

  // Local fallback, memoized: selected date's Sale records → dedup → counts
  const localSummary = useMemo<AdminSalesSummary>(
    () => calculateAdminSalesSummary(getTodaySalesRecords(records, targetDateStr)),
    [records, targetDateStr]
  );

  const fetchSummary = useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && now - lastFetchRef.current < REFRESH_THROTTLE_MS) return;
    lastFetchRef.current = now;
    try {
      const parsedDate = targetDateStr ? new Date(targetDateStr) : new Date();
      const dateIso = !isNaN(parsedDate.getTime())
        ? `${parsedDate.getFullYear()}-${String(parsedDate.getMonth() + 1).padStart(2, '0')}-${String(parsedDate.getDate()).padStart(2, '0')}`
        : new Date().toLocaleDateString('en-CA');

      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      const { data: row, error } = await recordsService.getAdminSalesSummary(dateIso, timeZone);
      if (error) throw error;
      if (row) {
        setServerSummary(buildSummary(row.total_sold ?? 0, row.total_unsold ?? 0));
      }
    } catch (err) {
      // Keep local fallback; RPC may not be deployed yet or device is offline
      console.warn('[useAdminSalesSummary] RPC failed, using local records:', err);
    }
  }, [targetDateStr]);

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
