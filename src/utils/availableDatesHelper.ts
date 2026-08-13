import { recordsService } from '@/services/recordsService';

// Month that was restored/backfilled and must always be selectable,
// even when the earliest/latest record range doesn't cover it.
export const BACKFILL_MONTH = '2026-06';

export interface AvailableDate {
  year: string;
  month: string;
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

/**
 * Fetch distinct { year, month } pairs that actually contain records in the database.
 */
export async function fetchSubmittedMonths(userId?: string): Promise<AvailableDate[]> {
  const { data, error } = await recordsService.getAvailableRecordMonths(userId);
  if (error || !data || data.length === 0) {
    const now = new Date();
    return [{
      year: now.getFullYear().toString(),
      month: String(now.getMonth() + 1).padStart(2, '0')
    }];
  }

  const datesSet = new Set<string>();
  const now = new Date();
  const currentYearStr = now.getFullYear().toString();
  const currentMonthNum = now.getMonth() + 1;

  let minMonthForCurrentYear = 12;
  let hasCurrentYearRecords = false;

  data.forEach(({ year, month }) => {
    if (/^\d{4}$/.test(year) && /^\d{2}$/.test(month)) {
      datesSet.add(`${year}-${month}`);
      if (year === currentYearStr) {
        hasCurrentYearRecords = true;
        const monthVal = Number(month);
        if (monthVal < minMonthForCurrentYear) minMonthForCurrentYear = monthVal;
      }
    }
  });

  // Always ensure current year includes months from app launch (June = 6) up to current month
  const startM = hasCurrentYearRecords ? Math.min(minMonthForCurrentYear, 6) : 6;
  const endM = Math.max(startM, currentMonthNum);
  for (let m = startM; m <= endM; m++) {
    datesSet.add(`${currentYearStr}-${String(m).padStart(2, '0')}`);
  }

  return Array.from(datesSet).map(s => {
    const [year, month] = s.split('-');
    return { year, month };
  });
}
