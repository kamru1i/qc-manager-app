import { supabase } from './supabase';
import { Profile } from '@/types';
import { toast } from 'sonner';

const ONE_WEEK = 7 * 24 * 60 * 60 * 1000;

interface ActiveSession {
  sessionId: string;
  lastActive: number;
}

export async function checkInactivity(userId: string): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  
  const lastActiveStr = localStorage.getItem(`last_active_time_${userId}`);
  if (lastActiveStr) {
    const lastActive = parseInt(lastActiveStr, 10);
    if (Date.now() - lastActive > ONE_WEEK) {
      // Clear session values
      localStorage.removeItem(`last_active_time_${userId}`);
      localStorage.removeItem(`session_start_time_${userId}`);
      localStorage.removeItem('qc_session_id');
      // Local scope: only this device's session is revoked — other devices stay logged in.
      await supabase.auth.signOut({ scope: 'local' });
      toast.error("Logged out: You have been logged out due to 1 week of inactivity.");
      return true;
    }
  }
  
  localStorage.setItem(`last_active_time_${userId}`, Date.now().toString());
  return false;
}

export async function registerAndCheckSession(
  userId: string, 
  userProfile: Profile,
  setProfileState: (p: Profile | null) => void
): Promise<boolean> {
  if (typeof window === 'undefined') return true;

  // 1. Get or generate qc_session_id
  let currentSessionId = localStorage.getItem('qc_session_id');
  if (!currentSessionId) {
    currentSessionId = crypto.randomUUID();
    localStorage.setItem('qc_session_id', currentSessionId);
  }

  // Read active_sessions from global_settings
  const settings = (userProfile.global_settings || {}) as Record<string, unknown>;
  let activeSessions: ActiveSession[] = Array.isArray(settings.active_sessions) ? (settings.active_sessions as ActiveSession[]) : [];

  const now = Date.now();
  // Filter out sessions older than 1 week
  activeSessions = activeSessions.filter((s: ActiveSession) => now - (s.lastActive || 0) < ONE_WEEK);

  // Check if currentSessionId exists
  const sessionExists = activeSessions.some((s: ActiveSession) => s.sessionId === currentSessionId);

  if (!sessionExists) {
    // The RPC locks the profile and merges the new device with the current DB
    // value, preventing simultaneous logins from overwriting each other.
    const { data, error } = await supabase.rpc('register_active_session' as any, {
      p_session_id: currentSessionId,
    } as any);

    if (!error && Array.isArray(data)) {
      activeSessions = data as unknown as ActiveSession[];
      const updatedSettings = {
        ...settings,
        active_sessions: activeSessions
      };
      userProfile.global_settings = updatedSettings;
      setProfileState(userProfile);
      localStorage.setItem(`cached_profile_${userId}`, JSON.stringify(userProfile));
    } else if (error) {
      // Session tracking is an availability guard, not the authentication
      // source of truth. Keep the valid Supabase session usable during a
      // transient RPC failure and retry registration on the next cold load.
      console.warn('[Session] Active-session registration failed:', error.message);
      activeSessions.push({ sessionId: currentSessionId, lastActive: now });
      activeSessions = activeSessions
        .sort((a, b) => (a.lastActive || 0) - (b.lastActive || 0))
        .slice(-10);
    }
  }
  // No heartbeat needed for existing sessions. The lastActive timestamp
  // set during registration is only consumed by the 1-week stale filter
  // above (line 54), and checkInactivity() already handles the 1-week
  // logout entirely via localStorage — zero DB writes required.

  // Check if currentSessionId is still in the activeSessions list
  const isStillValid = activeSessions.some((s: ActiveSession) => s.sessionId === currentSessionId);
  if (!isStillValid) {
    // Evicted!
    localStorage.removeItem('qc_session_id');
    localStorage.removeItem(`last_active_time_${userId}`);
    // Local scope: only THIS device signs out. The previous global default
    // revoked every refresh token for the user, killing all other devices too.
    await supabase.auth.signOut({ scope: 'local' });
    toast.error("Logged out: You are logged in on too many other devices/locations.");
    return false;
  }

  return true;
}
