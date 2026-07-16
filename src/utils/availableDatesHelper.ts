import { supabase } from '@/utils/supabase';

// Month that was restored/backfilled and must always be selectable,
// even when the earliest/latest record range doesn't cover it.
export const BACKFILL_MONTH = '2026-06';

export interface AvailableDate {
  year: string;
  month: string;
}

/**
 * Fetch the earliest and latest `submitted_at` from records (2 single-row queries).
 * Pass `userId` to scope the range to one user (non-admin views).
 */
export async function fetchSubmittedAtRange(
  userId?: string,
): Promise<{ earliestDate: Date | null; latestDate: Date | null }> {
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

  if (userId) {
    earliestQuery = earliestQuery.eq('user_id', userId);
    latestQuery = latestQuery.eq('user_id', userId);
  }

  const [earliestResult, latestResult] = await Promise.all([earliestQuery, latestQuery]);

  if (earliestResult.error) throw earliestResult.error;
  if (latestResult.error) throw latestResult.error;

  return {
    earliestDate: earliestResult.data?.[0]?.submitted_at
      ? new Date(earliestResult.data[0].submitted_at)
      : null,
    latestDate: latestResult.data?.[0]?.submitted_at
      ? new Date(latestResult.data[0].submitted_at)
      : null,
  };
}

/**
 * Build the list of selectable { year, month } pairs from a record date range.
 * Always includes the current month and the backfill month.
 */
export function buildAvailableDates(
  earliestDate: Date | null,
  latestDate: Date | null,
): AvailableDate[] {
  const datesSet = new Set<string>();

  // Always include current year-month
  const now = new Date();
  const currentYearStr = now.getFullYear().toString();
  const currentMonthStr = String(now.getMonth() + 1).padStart(2, '0');
  datesSet.add(`${currentYearStr}-${currentMonthStr}`);
  datesSet.add(BACKFILL_MONTH);

  if (
    earliestDate &&
    !isNaN(earliestDate.getTime()) &&
    latestDate &&
    !isNaN(latestDate.getTime())
  ) {
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

  return Array.from(datesSet).map(s => {
    const [year, month] = s.split('-');
    return { year, month };
  });
}
