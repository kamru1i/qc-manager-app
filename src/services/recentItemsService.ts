import { Profile } from '@/types';
import { canAccessModule, isAdminRole, hasTodoAccess } from '@/utils/permissionService';

export type RecentEntityType =
  | 'user'
  | 'quotation'
  | 'mistake'
  | 'leave'
  | 'rule'
  | 'branch'
  | 'login_codes'
  | 'todos'
  | 'navigation';

export interface RecentItemDestination {
  userId?: string;
  username?: string;
  codename?: string;
  fileName?: string;
  recordId?: string;
  mistakeId?: string;
  leaveId?: string;
  leaveUserId?: string;
  ruleId?: string;
  branch?: string;
  tab?: string;
  subtab?: string;
  search?: string;
}

export interface RecentItem {
  id: string;
  type: RecentEntityType;
  title: string;
  subtitle?: string;
  badge?: string;
  metadata: RecentItemDestination;
  timestamp: number;
}

export type RecentItemInput = Omit<RecentItem, 'timestamp'>;

const MAX_RECENT_ITEMS = 8;
const STORAGE_PREFIX = 'qc_recent_items';

function getStorageKey(userId?: string): string {
  return userId ? `${STORAGE_PREFIX}_${userId}` : `${STORAGE_PREFIX}_anon`;
}

/**
 * Validates whether the current user is authorized to view/access the recent item.
 * Prevents privilege escalation if user roles or permissions have changed.
 */
export function isRecentItemAuthorized(
  item: RecentItem,
  profile: Profile | null,
  sessionUser?: { id: string } | null
): boolean {
  if (!profile) return true;

  switch (item.type) {
    case 'user':
      // User overview is accessible to all authenticated team members
      return true;

    case 'quotation':
    case 'mistake':
    case 'branch':
      return canAccessModule(profile, null, 'quotes');

    case 'rule':
      return canAccessModule(profile, null, 'rules') || canAccessModule(profile, null, 'quotes');

    case 'leave': {
      if (!canAccessModule(profile, null, 'leave')) return false;
      // Non-admins can only view their own leave records
      const leaveOwnerId = item.metadata.leaveUserId;
      if (leaveOwnerId && sessionUser?.id && leaveOwnerId !== sessionUser.id && !isAdminRole(profile)) {
        return false;
      }
      return true;
    }

    case 'login_codes':
      return canAccessModule(profile, null, 'quotes');

    case 'todos':
      return hasTodoAccess(profile) || canAccessModule(profile, null, 'todo');

    case 'navigation': {
      const tab = item.metadata.tab;
      if (!tab) return true;
      if (tab === 'chuti' || tab === 'leave') return canAccessModule(profile, null, 'leave');
      if (tab === 'quotes') return canAccessModule(profile, null, 'quotes');
      if (tab === 'todo') return hasTodoAccess(profile) || canAccessModule(profile, null, 'todo');
      if (tab === 'kpi') return canAccessModule(profile, null, 'kpi');
      if (tab === 'user_management') return isAdminRole(profile);
      return true;
    }

    default:
      return true;
  }
}

/**
 * Retrieves recent items for a given user from localStorage,
 * filtering out any items the user is currently not authorized to see.
 */
export function getRecentItems(
  userId?: string,
  profile?: Profile | null,
  sessionUser?: { id: string } | null
): RecentItem[] {
  if (typeof window === 'undefined') return [];

  const key = getStorageKey(userId);
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    // Filter and sanitize
    const sanitized: RecentItem[] = [];
    for (const entry of parsed) {
      if (
        entry &&
        typeof entry === 'object' &&
        typeof (entry as RecentItem).id === 'string' &&
        typeof (entry as RecentItem).type === 'string' &&
        typeof (entry as RecentItem).title === 'string' &&
        typeof (entry as RecentItem).timestamp === 'number'
      ) {
        const item = entry as RecentItem;
        if (!profile || isRecentItemAuthorized(item, profile, sessionUser)) {
          sanitized.push(item);
        }
      }
    }

    return sanitized.slice(0, MAX_RECENT_ITEMS);
  } catch {
    return [];
  }
}

/**
 * Records an accessed entity into user-scoped localStorage.
 * Deduplicates by item id, updates timestamp, and caps at MAX_RECENT_ITEMS.
 */
export function recordRecentItem(
  userId: string | undefined,
  input: RecentItemInput
): RecentItem[] {
  if (typeof window === 'undefined') return [];

  const key = getStorageKey(userId);
  try {
    const raw = localStorage.getItem(key);
    const existing: RecentItem[] = raw ? JSON.parse(raw) : [];

    // Sanitize metadata to store ONLY lightweight keys, avoiding database rows
    const cleanMetadata: RecentItemDestination = {
      userId: input.metadata?.userId,
      username: input.metadata?.username,
      codename: input.metadata?.codename,
      fileName: input.metadata?.fileName,
      recordId: input.metadata?.recordId,
      mistakeId: input.metadata?.mistakeId,
      leaveId: input.metadata?.leaveId,
      leaveUserId: input.metadata?.leaveUserId,
      ruleId: input.metadata?.ruleId,
      branch: input.metadata?.branch,
      tab: input.metadata?.tab,
      subtab: input.metadata?.subtab,
      search: input.metadata?.search,
    };

    const newItem: RecentItem = {
      id: input.id,
      type: input.type,
      title: input.title,
      subtitle: input.subtitle,
      badge: input.badge,
      metadata: cleanMetadata,
      timestamp: Date.now(),
    };

    // Remove any previous occurrence of this item
    const filtered = existing.filter((item) => item.id !== input.id);

    // Prepend new item and bound capacity
    const updated = [newItem, ...filtered].slice(0, MAX_RECENT_ITEMS);

    localStorage.setItem(key, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

/**
 * Removes a single recent item by id.
 */
export function removeRecentItem(userId: string | undefined, itemId: string): RecentItem[] {
  if (typeof window === 'undefined') return [];

  const key = getStorageKey(userId);
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const existing: RecentItem[] = JSON.parse(raw);
    const updated = existing.filter((item) => item.id !== itemId);
    localStorage.setItem(key, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

/**
 * Clears all recent items for the current user.
 */
export function clearRecentItems(userId?: string): void {
  if (typeof window === 'undefined') return;
  const key = getStorageKey(userId);
  try {
    localStorage.removeItem(key);
  } catch {}
}
