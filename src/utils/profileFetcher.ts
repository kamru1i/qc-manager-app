import { supabase } from './supabase';
import { PROFILE_COLUMNS } from './dbColumns';

/**
 * Deduplicated own-profile row fetch.
 *
 * Two independent onAuthStateChange listeners (AppPortal in page.tsx and
 * useDashboardData) each fetch the logged-in user's profiles row when a
 * SIGNED_IN event fires, issuing two identical single-row SELECTs per login.
 * Sharing one in-flight promise per user collapses those into a single
 * network request while keeping both callers' logic untouched.
 */
type ProfileRowResult = { data: any; error: any };

let inflight: { userId: string; promise: Promise<ProfileRowResult> } | null =
  null;

export function fetchOwnProfileRow(userId: string): Promise<ProfileRowResult> {
  if (inflight && inflight.userId === userId) {
    return inflight.promise;
  }

  const entry = { userId } as { userId: string; promise: Promise<ProfileRowResult> };
  entry.promise = (async () => {
    try {
      const res = await supabase
        .from('profiles')
        .select(PROFILE_COLUMNS)
        .eq('id', userId)
        .maybeSingle();
      return res as ProfileRowResult;
    } catch (err) {
      return { data: null, error: err };
    } finally {
      if (inflight === entry) {
        inflight = null;
      }
    }
  })();

  inflight = entry;
  return entry.promise;
}
