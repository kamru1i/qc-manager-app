import { clearAllCache as clearLeaveCache } from '@/utils/offlineSync';
import { clearAllCache as clearQuotesCache } from '@/utils/quotesOfflineSync';

const CACHE_OWNER_KEY = 'qc_offline_cache_owner';
const CACHE_SCOPE_VERSION_KEY = 'qc_offline_cache_scope_version';
const CACHE_SCOPE_VERSION = '2';

/**
 * IndexedDB stores are shared by the browser profile. Invalidate them before a
 * different account (or a stricter cache schema) can read the previous user's
 * cached profiles, leave rows, or records. Pending writes remain in their
 * outbox and are filtered by the account that queued them.
 */
export async function prepareOfflineCachesForUser(userId: string): Promise<void> {
  if (typeof window === 'undefined') return;

  const previousOwner = localStorage.getItem(CACHE_OWNER_KEY);
  const previousVersion = localStorage.getItem(CACHE_SCOPE_VERSION_KEY);
  if ((previousOwner && previousOwner !== userId) || previousVersion !== CACHE_SCOPE_VERSION) {
    await Promise.allSettled([clearLeaveCache(), clearQuotesCache()]);
  }

  localStorage.setItem(CACHE_OWNER_KEY, userId);
  localStorage.setItem(CACHE_SCOPE_VERSION_KEY, CACHE_SCOPE_VERSION);
}

export async function clearOwnedOfflineCaches(): Promise<void> {
  if (typeof window === 'undefined') return;
  await Promise.allSettled([clearLeaveCache(), clearQuotesCache()]);
  localStorage.removeItem(CACHE_OWNER_KEY);
}
