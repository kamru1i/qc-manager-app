/**
 * Canonical Quotation Consistency Layer for QC Manager.
 * 
 * Single source of truth for:
 * - File type normalization (legacy Requote/Review aliases)
 * - Record counting & Other Site exclusion
 * - Sales conversion rate calculation
 * - "My Data" vs "All Data" scope resolution
 * - Date-based record filtering in Asia/Dhaka business context
 */

import { FileType, Profile, RecordItem } from '@/types';
import { isAdminRole } from '@/utils/permissionService';
import { getBusinessDateParts } from '@/utils/businessDateTime';

export const ALL_10_ACTIVE_FILE_TYPES: readonly FileType[] = [
  'Quote',
  'Requote',
  'Requote Van',
  'Requote Bike',
  'Review',
  'Individual Review',
  'Other Site',
  'Van',
  'Bike',
  'Sale',
] as const;

export const CANONICAL_FILE_TYPES: readonly FileType[] = [
  'Quote',
  'Requote',
  'Review',
  'Individual Review',
  'Other Site',
  'Van',
  'Bike',
  'Sale',
] as const;

/**
 * Normalizes legacy quotation file types to their canonical equivalents:
 * - 'Requote Van' | 'Requote Bike' -> 'Requote'
 * - 'Review Van' | 'Review Bike' -> 'Review'
 */
export function normalizeQuotationFileType(rawType: string | null | undefined): FileType {
  if (!rawType) return 'Quote';
  const trimmed = rawType.trim();
  if (trimmed === 'Requote Van' || trimmed === 'Requote Bike') {
    return 'Requote';
  }
  if (trimmed === 'Review Van' || trimmed === 'Review Bike') {
    return 'Review';
  }
  return trimmed as FileType;
}

/**
 * Determines whether a quotation record is counted in submission totals.
 * Per canonical business rules, 'Other Site' is excluded from primary productivity totals.
 */
export function isCountedInQuotationTotals(fileType: string | null | undefined): boolean {
  return Boolean(fileType && fileType.trim() !== 'Other Site');
}

/**
 * True if the logged-in admin has personal quotes workspace access turned OFF.
 * Admin retains administrative view & settings capabilities, but has no personal data entries.
 */
export function isQuotesOffAdmin(profile: Profile | null | undefined): boolean {
  return profile?.role === 'admin' && profile?.has_quotes_access !== true;
}

/**
 * True if the profile is eligible to see all users' quotation records (Approver / Supervisor / Admin scope).
 */
export function canAccessAllQuotesData(profile: Profile | null | undefined): boolean {
  if (!profile) return false;
  if (isQuotesOffAdmin(profile)) return false;
  return isAdminRole(profile) || profile.role === 'supervisor';
}

export interface CanonicalQuotationStats {
  total: number; // Total productivity submissions (records.length - otherSite)
  totalWithOtherSite: number; // All records including Other Site
  quote: number;
  requote: number; // Combined count (Requote + legacy Requote Van + legacy Requote Bike)
  requoteVan: number;
  requoteBike: number;
  review: number; // Combined count (Review + legacy Review Van + legacy Review Bike)
  reviewVan: number;
  reviewBike: number;
  individualReview: number;
  otherSite: number;
  van: number;
  bike: number;
  sale: number;
  conversionRate: number; // (sales / total) * 100 where total excludes Other Site
}

/**
 * Calculates canonical summary statistics for a set of quotation records.
 * Ensures consistent tallies across Daily Entry, Monthly Summary, and Reports.
 */
export function calculateCanonicalQuotationStats(records: RecordItem[]): CanonicalQuotationStats {
  let quote = 0;
  let requote = 0;
  let requoteVan = 0;
  let requoteBike = 0;
  let review = 0;
  let reviewVan = 0;
  let reviewBike = 0;
  let individualReview = 0;
  let otherSite = 0;
  let van = 0;
  let bike = 0;
  let sale = 0;

  records.forEach((r) => {
    const type = r.file_type;
    if (type === 'Quote') quote++;
    else if (type === 'Requote') requote++;
    else if (type === 'Requote Van') { requote++; requoteVan++; }
    else if (type === 'Requote Bike') { requote++; requoteBike++; }
    else if (type === 'Review') review++;
    else if (type === 'Review Van') { review++; reviewVan++; }
    else if (type === 'Review Bike') { review++; reviewBike++; }
    else if (type === 'Individual Review') individualReview++;
    else if (type === 'Other Site') otherSite++;
    else if (type === 'Van') van++;
    else if (type === 'Bike') bike++;
    else if (type === 'Sale') sale++;
  });

  const total = records.length - otherSite;
  const conversionRate = total > 0 ? parseFloat(((sale / total) * 100).toFixed(2)) : 0;

  return {
    total,
    totalWithOtherSite: records.length,
    quote,
    requote,
    requoteVan,
    requoteBike,
    review,
    reviewVan,
    reviewBike,
    individualReview,
    otherSite,
    van,
    bike,
    sale,
    conversionRate,
  };
}

/**
 * Filters a list of quotation records to those submitted on a specific business date (Asia/Dhaka).
 * Accepts 'YYYY-MM-DD', Date object, or any parseable date string.
 */
export function filterQuotationRecordsByDate(
  records: RecordItem[],
  targetDateKey?: string | Date | null
): RecordItem[] {
  if (!targetDateKey) return [];
  let normalizedKey = '';
  if (typeof targetDateKey === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(targetDateKey)) {
    normalizedKey = targetDateKey;
  } else {
    normalizedKey = getBusinessDateParts(targetDateKey).dateKey;
  }
  if (!normalizedKey) return [];
  return records.filter((r) => {
    if (!r.submitted_at) return false;
    const { dateKey } = getBusinessDateParts(r.submitted_at);
    return dateKey === normalizedKey;
  });
}

/**
 * Resolves quotation records against user permissions and "My Data" vs "All Data" scope.
 */
export function resolveQuotationRecordScope(
  records: RecordItem[],
  options: {
    profile: Profile | null | undefined;
    sessionUserId?: string;
    viewMode?: 'all' | 'mine';
  }
): RecordItem[] {
  const { profile, sessionUserId, viewMode = 'all' } = options;
  const isApprover = canAccessAllQuotesData(profile);
  const isMineOnly = !isApprover || viewMode === 'mine';

  if (!isMineOnly) {
    return records;
  }

  if (!sessionUserId) return [];
  return records.filter((r) => r.user_id === sessionUserId);
}
