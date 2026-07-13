'use client';

import React, { createContext, useContext, useEffect, useRef, useCallback } from 'react';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '@/utils/supabase';
import { Profile } from '@/types';

// ─── Types ───────────────────────────────────────────────────────────

export type RealtimeTable =
  | 'chuti'
  | 'profiles'
  | 'leave_settlements'
  | 'records'
  | 'govt_holiday_responses'
  | 'dismissed_notifications';

/** Minimal interface for Supabase postgres_changes payloads */
export interface RealtimePayload {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: Record<string, unknown>;
  old: Record<string, unknown>;
  schema: string;
  table: string;
  commit_timestamp?: string;
}

export type RealtimeHandler = (payload: RealtimePayload) => void;

interface RealtimeContextValue {
  /** Register a handler for a table. Returns an unsubscribe function. */
  registerHandler: (table: RealtimeTable, handler: RealtimeHandler) => () => void;
}

// ─── Context ─────────────────────────────────────────────────────────

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

// ─── Provider ────────────────────────────────────────────────────────

interface RealtimeProviderProps {
  children: React.ReactNode;
  sessionUser: SupabaseUser | null;
  profile: Profile | null;
}

/**
 * Centralised Supabase Realtime provider.
 *
 * Creates **one** channel that subscribes to all tables the app needs
 * (chuti, profiles, leave_settlements, records, govt_holiday_responses)
 * and routes incoming payloads to registered handler functions.
 *
 * Mount this once at the root level. Consumers call `useRealtimeHandler`
 * to register interest in a specific table – no duplicate channels are
 * created.
 */
export function RealtimeProvider({ children, sessionUser, profile }: RealtimeProviderProps) {
  // Map<table, Set<handler>> — mutable ref so the channel callback always
  // reads the latest set of handlers without re-creating the channel.
  const handlersRef = useRef<Map<RealtimeTable, Set<RealtimeHandler>>>(new Map());

  const registerHandler = useCallback(
    (table: RealtimeTable, handler: RealtimeHandler): (() => void) => {
      if (!handlersRef.current.has(table)) {
        handlersRef.current.set(table, new Set());
      }
      handlersRef.current.get(table)!.add(handler);

      // Return cleanup
      return () => {
        handlersRef.current.get(table)?.delete(handler);
      };
    },
    []
  );

  // Create the single unified channel
  // Create the single unified channel
  useEffect(() => {
    if (!sessionUser?.id || !profile) return;

    const isApprover = profile.role === 'admin' || profile.role === 'supervisor';

    let active = true;

    // Check Tauri notification permission on mount
    const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
    if (isTauri) {
      import('@tauri-apps/plugin-notification')
        .then(async ({ isPermissionGranted, requestPermission }) => {
          let permissionGranted = await isPermissionGranted();
          if (!permissionGranted) {
            await requestPermission();
          }
        })
        .catch((e) => console.error('[RealtimeProvider] Tauri notification permission request failed:', e));
    }

    const dispatch = (table: RealtimeTable, payload: RealtimePayload) => {
      handlersRef.current.get(table)?.forEach((handler) => {
        try {
          handler(payload);
        } catch (err) {
          console.error(`[RealtimeProvider] handler error (${table}):`, err);
        }
      });
    };

    const channel = supabase
      .channel(`realtime-unified-${sessionUser.id}`)
      // ── chuti ──
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chuti',
          ...(isApprover ? {} : { filter: `user_id=eq.${sessionUser.id}` }),
        },
        (payload) => dispatch('chuti', payload as unknown as RealtimePayload)
      )
      // ── profiles ──
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
          ...(isApprover ? {} : { filter: `id=eq.${sessionUser.id}` }),
        },
        (payload) => dispatch('profiles', payload as unknown as RealtimePayload)
      )
      // ── leave_settlements ──
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'leave_settlements',
          ...(isApprover ? {} : { filter: `user_id=eq.${sessionUser.id}` }),
        },
        (payload) => dispatch('leave_settlements', payload as unknown as RealtimePayload)
      )
      // ── records (quotes) — always user-scoped ──
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'records',
          filter: `user_id=eq.${sessionUser.id}`,
        },
        (payload) => dispatch('records', payload as unknown as RealtimePayload)
      )
      // ── govt_holiday_responses ──
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'govt_holiday_responses',
          ...(isApprover ? {} : { filter: `user_id=eq.${sessionUser.id}` }),
        },
        (payload) => dispatch('govt_holiday_responses', payload as unknown as RealtimePayload)
      )
      // ── dismissed_notifications ──
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'dismissed_notifications',
          filter: `user_id=eq.${sessionUser.id}`,
        },
        (payload) => dispatch('dismissed_notifications', payload as unknown as RealtimePayload)
      )
      // ── Tauri Desktop Notifications Broadcast listener ──
      .on(
        'broadcast',
        { event: 'os-push' },
        (payload) => {
          if (!isTauri) return;

          // Check user preference toggle dynamically
          const pushPref = localStorage.getItem('push_subscribed_pref_' + sessionUser.id);
          if (pushPref === 'false') return;

          const { targetUserIds, title, body } = payload.payload;

          // Only trigger if this notification was meant for the current user
          if (targetUserIds && Array.isArray(targetUserIds) && targetUserIds.includes(sessionUser.id)) {
            import('@tauri-apps/plugin-notification')
              .then(({ sendNotification }) => {
                sendNotification({
                  title: title || 'Chuti Tracker',
                  body: body || 'You have a new notification',
                });
              })
              .catch((err) => console.error('[RealtimeProvider] failed to send desktop notification:', err));
          }
        }
      )
      .subscribe((status, err) => {
        if (!active) return;
        if (typeof window !== 'undefined') {
          if (status === 'SUBSCRIBED') {
            window.dispatchEvent(new CustomEvent('realtime-connection-status', { detail: 'connected' }));
          } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.warn(`[RealtimeProvider] unified channel connection status changed: ${status}`, err);
            window.dispatchEvent(new CustomEvent('realtime-connection-status', { detail: 'disconnected' }));
          }
        }
      });

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
    // Only re-create when user identity or role changes — not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionUser?.id, profile?.role]);

  const value = React.useMemo(() => ({ registerHandler }), [registerHandler]);

  return (
    <RealtimeContext.Provider value={value}>
      {children}
    </RealtimeContext.Provider>
  );
}

// ─── Consumer Hook ───────────────────────────────────────────────────

/**
 * Register a handler for realtime events on a specific table.
 *
 * The handler is automatically unregistered on unmount or when it changes.
 * The handler MUST be wrapped in `useCallback` by the caller to avoid
 * constant re-registration.
 */
export function useRealtimeHandler(table: RealtimeTable, handler: RealtimeHandler) {
  const context = useContext(RealtimeContext);

  useEffect(() => {
    if (!context) return;
    return context.registerHandler(table, handler);
  }, [context, table, handler]);
}
