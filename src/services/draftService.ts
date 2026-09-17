/**
 * Local-First Draft Recovery Service
 * 
 * Provides unsaved form protection for critical data-entry forms.
 * - 100% localStorage, zero Supabase queries, zero realtime traffic.
 * - Namespaced strictly by authenticated userId to prevent cross-user leakage.
 * - 48-hour TTL to prevent stale business data retention.
 * - Multi-tab safe with session tab tracking.
 */

export type DraftFormType =
  | 'quotation_entry'
  | 'leave_add'
  | 'quotation_add_mistake'
  | 'quotation_quick_import';

export interface DraftMetadata {
  timestamp: number;
  tabId?: string;
  formType: DraftFormType;
}

export interface QuotationEntryDraft {
  fileName: string;
  branchName: string;
  fileType: string;
  codenameInput?: string;
}

export interface LeaveAddDraft {
  leaveType: string;
  date: string;
  signInTime?: string;
  signOutTime?: string;
  leaveHour?: string;
  comment?: string;
  adjustment?: boolean;
  adjustmentCategory?: string;
  adjustShortLeave?: boolean;
  adjustJummah?: boolean;
  breakEnabled?: boolean;
  breakMinutes?: number;
  bulkDates?: string[];
  bulkAdjustments?: boolean[];
}

export interface QuotationMistakeDraft {
  date: string;
  filename: string;
  branch: string;
  userId: string;
  codename: string;
  details: string;
  penalty: string;
}

export interface QuotationQuickImportDraft {
  rawText: string;
  items?: any[];
}

export interface StoredDraft<T> {
  version: 1;
  formType: DraftFormType;
  userId: string;
  data: T;
  metadata: DraftMetadata;
}

const STORAGE_PREFIX = 'qc_draft';
export const DRAFT_TTL_MS = 48 * 60 * 60 * 1000; // 48 Hours

/**
 * Gets or initializes a unique browser tab identifier stored in sessionStorage.
 */
export function getTabId(): string {
  if (typeof window === 'undefined') return 'server';
  try {
    let tabId = sessionStorage.getItem('qc_tab_id');
    if (!tabId) {
      tabId = `tab_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      sessionStorage.setItem('qc_tab_id', tabId);
    }
    return tabId;
  } catch {
    return 'fallback_tab';
  }
}

/**
 * Constructs the deterministic user-scoped draft storage key.
 */
export function getDraftStorageKey(userId: string | undefined, formType: DraftFormType): string {
  const safeUser = userId || 'anon';
  return `${STORAGE_PREFIX}_${safeUser}_${formType}`;
}

/**
 * Determines whether the user input in the draft is meaningful
 * (i.e. not completely blank or default state).
 */
export function isDraftMeaningful(formType: DraftFormType, data: any): boolean {
  if (!data || typeof data !== 'object') return false;

  switch (formType) {
    case 'quotation_entry': {
      const d = data as QuotationEntryDraft;
      return Boolean(d.fileName && d.fileName.trim().length > 0);
    }
    case 'leave_add': {
      const d = data as LeaveAddDraft;
      const hasMeaningfulType = Boolean(d.leaveType && d.leaveType !== 'Select' && d.leaveType.trim().length > 0);
      const hasComment = Boolean(d.comment && d.comment.trim().length > 0);
      const hasBulk = Array.isArray(d.bulkDates) && d.bulkDates.length > 0;
      return hasMeaningfulType || hasComment || hasBulk;
    }
    case 'quotation_add_mistake': {
      const d = data as QuotationMistakeDraft;
      const hasFilename = Boolean(d.filename && d.filename.trim().length > 0);
      const hasDetails = Boolean(d.details && d.details.trim().length > 0);
      const hasPenalty = Boolean(d.penalty && d.penalty.trim().length > 0);
      return hasFilename || hasDetails || hasPenalty;
    }
    case 'quotation_quick_import': {
      const d = data as QuotationQuickImportDraft;
      const hasText = Boolean(d.rawText && d.rawText.trim().length > 0);
      const hasItems = Array.isArray(d.items) && d.items.length > 0;
      return hasText || hasItems;
    }
    default:
      return false;
  }
}

/**
 * Cleans irrelevant/hidden fields when switching leave types according to form semantics.
 */
export function sanitizeLeaveDraft(data: LeaveAddDraft): LeaveAddDraft {
  const sanitized = { ...data };
  const leaveType = sanitized.leaveType;

  if (leaveType === 'Full Leave') {
    // Times are irrelevant for Full Leave
    sanitized.signInTime = '13:00';
    sanitized.signOutTime = '22:30';
    sanitized.adjustJummah = false;
    sanitized.breakEnabled = false;
  } else if (leaveType === 'Short Leave') {
    // Bulk dates are not applicable for partial leaves
    sanitized.bulkDates = [];
    sanitized.bulkAdjustments = [];
  } else if (leaveType === 'Late Join') {
    sanitized.signOutTime = '22:30';
    sanitized.bulkDates = [];
    sanitized.bulkAdjustments = [];
    sanitized.breakEnabled = false;
  } else if (leaveType === 'Early Leave') {
    sanitized.signInTime = '13:00';
    sanitized.bulkDates = [];
    sanitized.bulkAdjustments = [];
    sanitized.breakEnabled = false;
  } else if (leaveType === 'Overtime') {
    sanitized.bulkDates = [];
    sanitized.bulkAdjustments = [];
    sanitized.breakEnabled = false;
  }

  return sanitized;
}

/**
 * Retrieves an unexpired, meaningful stored draft for the specified user and form.
 */
export function getDraft<T>(userId: string | undefined, formType: DraftFormType): StoredDraft<T> | null {
  if (typeof window === 'undefined') return null;
  const key = getDraftStorageKey(userId, formType);

  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as StoredDraft<T>;
    if (!parsed || parsed.version !== 1 || !parsed.metadata || !parsed.data) {
      localStorage.removeItem(key);
      return null;
    }

    // TTL verification (48 hours)
    const now = Date.now();
    if (now - parsed.metadata.timestamp > DRAFT_TTL_MS) {
      localStorage.removeItem(key);
      return null;
    }

    // Check user isolation (in case of anonymous key mismatch)
    if (userId && parsed.userId && parsed.userId !== userId) {
      return null;
    }

    // Verify draft is actually meaningful
    if (!isDraftMeaningful(formType, parsed.data)) {
      localStorage.removeItem(key);
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

/**
 * Saves or updates a draft in localStorage with atomic timestamp and tab ID.
 */
export function saveDraft<T>(userId: string | undefined, formType: DraftFormType, data: T): void {
  if (typeof window === 'undefined') return;
  if (!isDraftMeaningful(formType, data)) {
    // If data is empty or cleared back to default, prune the draft key
    clearDraft(userId, formType);
    return;
  }

  const key = getDraftStorageKey(userId, formType);
  const draft: StoredDraft<T> = {
    version: 1,
    formType,
    userId: userId || 'anon',
    data,
    metadata: {
      timestamp: Date.now(),
      tabId: getTabId(),
      formType,
    },
  };

  try {
    localStorage.setItem(key, JSON.stringify(draft));
  } catch {
    // LocalStorage quota handling or private mode
  }
}

/**
 * Explicitly removes a draft from localStorage.
 */
export function clearDraft(userId: string | undefined, formType: DraftFormType): void {
  if (typeof window === 'undefined') return;
  const key = getDraftStorageKey(userId, formType);
  try {
    localStorage.removeItem(key);
  } catch {}
}

/**
 * Formats a timestamp into a human-friendly relative age (e.g. "Saved 5 minutes ago").
 */
export function formatDraftAge(timestamp?: number): string {
  if (!timestamp || timestamp <= 0) {
    return 'Saved recently';
  }
  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (elapsedSeconds < 60) {
    return 'Saved just now';
  }
  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  if (elapsedMinutes < 60) {
    return `Saved ${elapsedMinutes} minute${elapsedMinutes === 1 ? '' : 's'} ago`;
  }
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) {
    return `Saved ${elapsedHours} hour${elapsedHours === 1 ? '' : 's'} ago`;
  }
  const elapsedDays = Math.floor(elapsedHours / 24);
  return `Saved ${elapsedDays} day${elapsedDays === 1 ? '' : 's'} ago`;
}

/**
 * Sweeps localStorage to prune all expired drafts for the user.
 */
export function pruneExpiredDrafts(userId: string | undefined): void {
  if (typeof window === 'undefined') return;
  try {
    const keys = Object.keys(localStorage);
    const prefix = userId ? `${STORAGE_PREFIX}_${userId}_` : `${STORAGE_PREFIX}_`;
    const now = Date.now();

    for (const key of keys) {
      if (key.startsWith(prefix)) {
        try {
          const raw = localStorage.getItem(key);
          if (!raw) continue;
          const parsed = JSON.parse(raw);
          if (parsed?.metadata?.timestamp && now - parsed.metadata.timestamp > DRAFT_TTL_MS) {
            localStorage.removeItem(key);
          }
        } catch {
          localStorage.removeItem(key);
        }
      }
    }
  } catch {}
}
