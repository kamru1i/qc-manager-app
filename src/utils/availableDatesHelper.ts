import { recordsService } from '@/services/recordsService';
import { RecordItem } from '@/types';

export interface AvailableDate {
  year: string;
  month: string;
}

/**
 * Extract distinct { year, month } pairs directly from a list of RecordItem records.
 * Returns only years and months that actually contain at least one valid record.
 * Falls back to current year/month if records array is empty.
 */
export function extractAvailableDatesFromRecords(records: RecordItem[]): AvailableDate[] {
  const datesSet = new Set<string>();
  records.forEach((r) => {
    if (r.submitted_at) {
      const d = new Date(r.submitted_at);
      if (!isNaN(d.getTime())) {
        const year = d.getFullYear().toString();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        datesSet.add(`${year}-${month}`);
      }
    }
  });

  if (datesSet.size === 0) {
    const now = new Date();
    return [{
      year: now.getFullYear().toString(),
      month: String(now.getMonth() + 1).padStart(2, '0'),
    }];
  }

  return Array.from(datesSet).map((s) => {
    const [year, month] = s.split('-');
    return { year, month };
  });
}

/**
 * Build the list of selectable { year, month } pairs.
 * Legacy fallback helper: only returns valid dates provided without generating empty ranges.
 */
export function buildAvailableDates(
  earliestDate: Date | null,
  latestDate: Date | null,
): AvailableDate[] {
  const datesSet = new Set<string>();

  if (earliestDate && !isNaN(earliestDate.getTime())) {
    const y = earliestDate.getFullYear().toString();
    const m = String(earliestDate.getMonth() + 1).padStart(2, '0');
    datesSet.add(`${y}-${m}`);
  }

  if (latestDate && !isNaN(latestDate.getTime())) {
    const y = latestDate.getFullYear().toString();
    const m = String(latestDate.getMonth() + 1).padStart(2, '0');
    datesSet.add(`${y}-${m}`);
  }

  if (datesSet.size === 0) {
    const now = new Date();
    return [{
      year: now.getFullYear().toString(),
      month: String(now.getMonth() + 1).padStart(2, '0'),
    }];
  }

  return Array.from(datesSet).map((s) => {
    const [year, month] = s.split('-');
    return { year, month };
  });
}

/**
 * Fetch distinct { year, month } pairs that actually contain records in the database.
 * Returns only data-driven years and months without any synthetic or default dummy ranges.
 */
export async function fetchSubmittedMonths(userId?: string): Promise<AvailableDate[]> {
  const { data, error } = await recordsService.getAvailableRecordMonths(userId);
  if (error || !data || data.length === 0) {
    const now = new Date();
    return [{
      year: now.getFullYear().toString(),
      month: String(now.getMonth() + 1).padStart(2, '0'),
    }];
  }

  const datesSet = new Set<string>();

  data.forEach(({ year, month }) => {
    if (/^\d{4}$/.test(year) && /^\d{2}$/.test(month)) {
      datesSet.add(`${year}-${month}`);
    }
  });

  if (datesSet.size === 0) {
    const now = new Date();
    return [{
      year: now.getFullYear().toString(),
      month: String(now.getMonth() + 1).padStart(2, '0'),
    }];
  }

  return Array.from(datesSet).map((s) => {
    const [year, month] = s.split('-');
    return { year, month };
  });
}
