import { supabase } from './supabase';
import { Profile } from '@/types';
import toast from 'react-hot-toast';

const ONE_WEEK = 7 * 24 * 60 * 60 * 1000;

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
      await supabase.auth.signOut();
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
  setProfileState: (p: any) => void
): Promise<boolean> {
  if (typeof window === 'undefined') return true;

  // 1. Get or generate qc_session_id
  let currentSessionId = localStorage.getItem('qc_session_id');
  if (!currentSessionId) {
    currentSessionId = Math.random().toString(36).substring(2) + Date.now().toString(36);
    localStorage.setItem('qc_session_id', currentSessionId);
  }

  // 2. Read active_sessions from global_settings
  const settings = userProfile.global_settings || {};
  let activeSessions = Array.isArray(settings.active_sessions) ? settings.active_sessions : [];

  const now = Date.now();
  // Filter out sessions older than 1 week
  activeSessions = activeSessions.filter((s: any) => now - (s.lastActive || 0) < ONE_WEEK);

  // Check if currentSessionId exists
  const sessionExists = activeSessions.some((s: any) => s.sessionId === currentSessionId);

  if (!sessionExists) {
    // New login session
    activeSessions.push({ sessionId: currentSessionId, lastActive: now });

    // Enforce max 3 sessions limit: Sort oldest first (ascending)
    activeSessions.sort((a: any, b: any) => (a.lastActive || 0) - (b.lastActive || 0));

    if (activeSessions.length > 3) {
      activeSessions = activeSessions.slice(activeSessions.length - 3);
    }

    const updatedSettings = {
      ...settings,
      active_sessions: activeSessions
    };

    // Update DB
    const { error } = await supabase
      .from('profiles')
      .update({ global_settings: updatedSettings })
      .eq('id', userId);

    if (!error) {
      userProfile.global_settings = updatedSettings;
      setProfileState(userProfile);
      // Update cache too
      localStorage.setItem('profiles_cache_' + userId, JSON.stringify(userProfile));
    }
  } else {
    // Session exists, check if lastActive is old (> 30s) and update
    const currentSession = activeSessions.find((s: any) => s.sessionId === currentSessionId);
    if (currentSession && now - (currentSession.lastActive || 0) > 30000) {
      activeSessions = activeSessions.map((s: any) => {
        if (s.sessionId === currentSessionId) {
          return { ...s, lastActive: now };
        }
        return s;
      });

      const updatedSettings = {
        ...settings,
        active_sessions: activeSessions
      };

      await supabase
        .from('profiles')
        .update({ global_settings: updatedSettings })
        .eq('id', userId);
    }
  }

  // Check if currentSessionId is still in the activeSessions list
  const isStillValid = activeSessions.some((s: any) => s.sessionId === currentSessionId);
  if (!isStillValid) {
    // Evicted!
    localStorage.removeItem('qc_session_id');
    localStorage.removeItem(`last_active_time_${userId}`);
    await supabase.auth.signOut();
    toast.error("Logged out: You are logged in on 3 other devices/locations.");
    return false;
  }

  return true;
}

export async function updateSessionLastActiveInDb(userId: string): Promise<void> {
  if (typeof window === 'undefined') return;
  const currentSessionId = localStorage.getItem('qc_session_id');
  if (!currentSessionId) return;

  const { data, error } = await supabase
    .from('profiles')
    .select('global_settings')
    .eq('id', userId)
    .single();

  if (!error && data) {
    const settings = data.global_settings || {};
    let activeSessions = Array.isArray(settings.active_sessions) ? settings.active_sessions : [];
    const now = Date.now();

    let updated = false;
    activeSessions = activeSessions.map((s: any) => {
      if (s.sessionId === currentSessionId) {
        updated = true;
        return { ...s, lastActive: now };
      }
      return s;
    });

    if (updated) {
      await supabase
        .from('profiles')
        .update({
          global_settings: {
            ...settings,
            active_sessions: activeSessions
          }
        })
        .eq('id', userId);
    }
  }
}
