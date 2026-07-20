import { RecordItem } from '@/types';

/**
 * Pure helpers for the "Sales Report for Admin" box in Copy Helper.
 *
 * Sale records carry their sold-status as a file_name suffix
 * (" [SOLD]" / " [UNSOLD]") — set by the existing Daily Entry modal.
 *
 * Attempt/episode model (per unique file name, chronological order):
 * - A run of Unsold submissions is ONE pending attempt (multiple users
 *   logging the same unsold file don't inflate the count).
 * - A Sold submission closes the pending attempt as Sold — the preceding
 *   unsold entries are absorbed.
 * - A submission AFTER a Sold is a NEW attempt (same name, different
 *   details): every Sold entry counts as its own sale, and a trailing
 *   unsold run that never gets sold counts as 1 Unsold at end of day.
 *
 * Therefore per file: Sold = count of [SOLD] entries;
 * Unsold = 1 if the latest entry is not [SOLD], else 0.
 * Total Sale Attempt = Sold + Unsold.
 */

export interface AdminSalesSummary {
  totalSold: number;
  totalUnsold: number;
  totalAttempts: number;
}

const SOLD_SUFFIX_RE = / \[(SOLD|UNSOLD)\]$/;

const isSoldRecord = (r: RecordItem) => r.file_name.endsWith(' [SOLD]');

/** Filter to today's Sale submissions (local time), any user. */
export const getTodaySalesRecords = (records: RecordItem[]): RecordItem[] => {
  const todayStr = new Date().toDateString();
  return records.filter(
    (r) => r.file_type === 'Sale' && new Date(r.submitted_at).toDateString() === todayStr
  );
};

/**
 * Group Sale records by normalized file name, each group sorted
 * chronologically (oldest first). Key is case/whitespace-insensitive with
 * the [SOLD]/[UNSOLD] suffix stripped, so "abc001 [SOLD]" and
 * "ABC001 [UNSOLD]" are the same file.
 */
export const groupSalesByFile = (saleRecords: RecordItem[]): Map<string, RecordItem[]> => {
  const groups = new Map<string, RecordItem[]>();
  for (const r of saleRecords) {
    const key = r.file_name.replace(SOLD_SUFFIX_RE, '').trim().toUpperCase();
    const list = groups.get(key);
    if (list) list.push(r);
    else groups.set(key, [r]);
  }
  groups.forEach((list) =>
    list.sort((a, b) => new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime())
  );
  return groups;
};

/** Episode rule: every Sold counts; trailing unsold run counts once. */
export const calculateAdminSalesSummary = (saleRecords: RecordItem[]): AdminSalesSummary => {
  const groups = groupSalesByFile(saleRecords);
  let totalSold = 0;
  let totalUnsold = 0;
  groups.forEach((entries) => {
    totalSold += entries.filter(isSoldRecord).length;
    // Latest entry unsold → the file's final attempt is still open → 1 Unsold
    if (!isSoldRecord(entries[entries.length - 1])) totalUnsold += 1;
  });
  return buildSummary(totalSold, totalUnsold);
};

export const buildSummary = (totalSold: number, totalUnsold: number): AdminSalesSummary => ({
  totalSold,
  totalUnsold,
  totalAttempts: totalSold + totalUnsold,
});
