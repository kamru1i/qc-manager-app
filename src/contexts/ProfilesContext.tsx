'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { Profile } from '@/types';
import { mapProfilePasswordResetStatus } from '@/utils/profileHelpers';
import { getCacheData, setCacheData } from '@/utils/offlineSync';
import { useRealtimeHandler, RealtimePayload } from '@/contexts/RealtimeContext';
import { profilesService } from '@/services';

// ─── Types ───────────────────────────────────────────────────────────

interface ProfilesContextValue {
  /** The single shared profiles list (full table, username-ordered, password_reset_status mapped). */
  profilesList: Profile[];
  /** Direct setter — prefer refreshProfiles for post-mutation refreshes. */
  setProfilesList: React.Dispatch<React.SetStateAction<Profile[]>>;
  /** Refetch the full list from Supabase. Pass { force: true } after mutations to bypass count-check. */
  refreshProfiles: (options?: { force?: boolean }) => Promise<void>;
  /** True once the initial load (cache or network) has completed. */
  isLoaded: boolean;
}

// ─── Context ─────────────────────────────────────────────────────────

const ProfilesContext = createContext<ProfilesContextValue | null>(null);

// ─── Provider ────────────────────────────────────────────────────────

interface ProfilesProviderProps {
  children: React.ReactNode;
  sessionUser: SupabaseUser | null;
  profile: Profile | null;
}

/**
 * Single owner of the shared profiles list (R1/R2 consolidation).
 *
 * Previously page.tsx, useDashboardData, useQuotesDashboardData and
 * UserManagementDashboard each fetched and realtime-patched their own copy
 * of the profiles table. This provider fetches ONCE, patches UPDATE events
 * inline, refetches on INSERT/DELETE, and mirrors to the `profiles_cache`
 * IndexedDB store so offline loads keep working for all consumers.
 *
 * Must be mounted inside RealtimeProvider.
 */
export function ProfilesProvider({ children, sessionUser, profile }: ProfilesProviderProps) {
  const [profilesList, setProfilesList] = useState<Profile[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const fetchingRef = useRef(false);
  const requestSequenceRef = useRef(0);
  const requestControllerRef = useRef<AbortController | null>(null);
  const loadedUserIdRef = useRef<string | null>(null);
  // Stable ref so the count-check inside refreshProfiles reads the latest list
  // without creating a new closure (which would recreate the channel).
  const profilesListRef = useRef<Profile[]>([]);
  useEffect(() => { profilesListRef.current = profilesList; }, [profilesList]);

  const sessionUserId = sessionUser?.id;

  const refreshProfiles = useCallback(async (options?: { force?: boolean }) => {
    if (!sessionUserId) return;
    if (fetchingRef.current && !options?.force) return;

    // A forced post-mutation refresh supersedes an older in-flight result.
    // This also prevents a response belonging to a previous account from
    // populating the provider after a rapid logout/login transition.
    requestControllerRef.current?.abort();
    const controller = new AbortController();
    requestControllerRef.current = controller;
    const requestSequence = ++requestSequenceRef.current;
    fetchingRef.current = true;
    try {
      // Fetch fresh profiles from Supabase to guarantee global_settings, tab access & feature flags sync
      const { data, error } = await profilesService.getAllProfiles(controller.signal);
      if (
        !controller.signal.aborted
        && requestSequence === requestSequenceRef.current
        && loadedUserIdRef.current === sessionUserId
        && !error
      ) {
        const mapped = data
          .map((p) => mapProfilePasswordResetStatus(p as unknown as Profile) as Profile)
          .sort((a, b) => (a.username || '').localeCompare(b.username || ''));
        setProfilesList(mapped);
        // Mirror to IndexedDB so offline sessions still get the list
        try {
          await setCacheData('profiles_cache', mapped);
        } catch {
          // cache write failures are non-fatal
        }
      }
    } catch (err) {
      if (controller.signal.aborted) return;
      console.error('ProfilesProvider: failed to fetch profiles:', err);
    } finally {
      if (requestSequence === requestSequenceRef.current) {
        fetchingRef.current = false;
        requestControllerRef.current = null;
        if (!controller.signal.aborted) setIsLoaded(true);
      }
    }
  }, [sessionUserId]);

  // Initial load: cache-first for instant paint/offline, then network
  const profileRole = profile?.role;
  const supervisorIdsKey = (profile?.supervisor_ids || []).join(',');

  useEffect(() => {
    if (!sessionUserId) {
      requestControllerRef.current?.abort();
      requestControllerRef.current = null;
      requestSequenceRef.current += 1;
      fetchingRef.current = false;
      setProfilesList([]);
      setIsLoaded(false);
      loadedUserIdRef.current = null;
      return;
    }
    let active = true;

    (async () => {
      if (loadedUserIdRef.current !== sessionUserId) {
        try {
          const cached = (await getCacheData('profiles_cache')) as Profile[];
          if (active && cached.length > 0) {
            const visibleSupervisorIds = supervisorIdsKey ? supervisorIdsKey.split(',') : [];
            const visibleCached = profileRole === 'user'
              ? cached.filter((candidate) =>
                  candidate.id === sessionUserId
                  || visibleSupervisorIds.includes(candidate.id)
                  || visibleSupervisorIds.some((supervisorId) =>
                    cached.find((row) => row.id === supervisorId)?.delegated_supervisor_id === candidate.id
                  )
                )
              : cached;
            const mappedAndSorted = visibleCached
              .map((p) => mapProfilePasswordResetStatus(p) as Profile)
              .sort((a, b) => (a.username || '').localeCompare(b.username || ''));
            setProfilesList(mappedAndSorted);
            setIsLoaded(true);
          }
        } catch {
          // no cache — network fetch below covers it
        }
        loadedUserIdRef.current = sessionUserId;
      }

      if (typeof window === 'undefined' || navigator.onLine) {
        await refreshProfiles({ force: true });
      } else if (active) {
        setIsLoaded(true);
      }
    })();

    return () => {
      active = false;
      requestControllerRef.current?.abort();
    };
  }, [sessionUserId, profileRole, supervisorIdsKey, refreshProfiles]);

  // Single realtime patcher for the whole app
  const handleProfilesRealtime = useCallback(
    (payload: RealtimePayload) => {
      if (payload.eventType === 'UPDATE') {
        const mapped = mapProfilePasswordResetStatus(
          payload.new as unknown as Profile,
        ) as Profile;
        setProfilesList((prev) => {
          const updated = prev.map((p) => (p.id === mapped.id ? mapped : p));
          return updated.sort((a, b) => (a.username || '').localeCompare(b.username || ''));
        });
      } else if (payload.eventType === 'INSERT') {
        // Add new profile inline — no full refetch needed
        const mapped = mapProfilePasswordResetStatus(
          payload.new as unknown as Profile,
        ) as Profile;
        setProfilesList((prev) => {
          // Avoid duplicates if event fires twice
          if (prev.some((p) => p.id === mapped.id)) return prev;
          return [...prev, mapped].sort((a, b) => (a.username || '').localeCompare(b.username || ''));
        });
      } else if (payload.eventType === 'DELETE') {
        // Remove deleted profile inline — no full refetch needed
        const deletedId = (payload.old as Record<string, unknown>)?.id as string;
        if (deletedId) {
          setProfilesList((prev) => prev.filter((p) => p.id !== deletedId));
        }
      }
    },
    [],
  );
  useRealtimeHandler('profiles', handleProfilesRealtime);

  const value = useMemo(
    () => ({ profilesList, setProfilesList, refreshProfiles, isLoaded }),
    [profilesList, refreshProfiles, isLoaded],
  );

  return <ProfilesContext.Provider value={value}>{children}</ProfilesContext.Provider>;
}

// ─── Consumer hook ───────────────────────────────────────────────────

const noopSetter: React.Dispatch<React.SetStateAction<Profile[]>> = () => {};
const noopRefresh = async (_options?: { force?: boolean }) => {};

/**
 * Access the shared profiles list. Safe without a provider (returns an
 * empty list and no-ops) so standalone routes (/chuti, /quotes) don't
 * crash during their redirect-to-/ flash.
 */
export function useProfiles(): ProfilesContextValue {
  const ctx = useContext(ProfilesContext);
  if (!ctx) {
    return {
      profilesList: [],
      setProfilesList: noopSetter,
      refreshProfiles: noopRefresh,
      isLoaded: false,
    };
  }
  return ctx;
}
