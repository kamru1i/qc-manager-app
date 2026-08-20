'use client';

import React, { createContext, useContext, useEffect, useRef, useCallback } from 'react';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '@/utils/supabase';
import { Profile } from '@/types';
import { canAccessModule, isAdminRole } from '@/utils/permissionService';
import { useAppEventBus } from '@/contexts/AppEventBusContext';

// ─── Types ───────────────────────────────────────────────────────────

export type RealtimeTable =
  | 'chuti'
  | 'profiles'
  | 'leave_settlements'
  | 'records'
  | 'govt_holiday_responses'
  | 'dismissed_notifications'
  | 'todos'
  | 'quotation_mistakes'
  | 'compliance_rules'
  | 'attendance_daily'
  | 'attendance_breaks';

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
  const { emit } = useAppEventBus();
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
  useEffect(() => {
    if (!sessionUser?.id || !profile) return;

    const isApprover = isAdminRole(profile) || profile.role === 'supervisor';
    const isHolidayAdmin = isAdminRole(profile);
    // Todos are superadmin-only — skip the listener entirely for everyone else
    // so the extra postgres_changes subscription adds zero cost fleet-wide.
    const hasTodoAccess = canAccessModule(profile, null, 'todo');
    const hasChutiAccess = canAccessModule(profile, null, 'leave');
    const hasQuotesAccess = canAccessModule(profile, null, 'quotes');
    const hasAttendanceAccess = canAccessModule(profile, null, 'attendance');
    const hasAdminAttendanceAccess = isAdminRole(profile);


    let active = true;
    let resubscribeTimer: ReturnType<typeof setTimeout> | null = null;
    let resubscribeAttempt = 0;
    // Tears down the current channel instance. Marks it stale first so its
    // synchronously-fired CLOSED callback can't re-enter the resubscribe path.
    let disposeChannel: (() => void) | null = null;

    const dispatch = (table: RealtimeTable, payload: RealtimePayload) => {
      handlersRef.current.get(table)?.forEach((handler) => {
        try {
          handler(payload);
        } catch (err) {
          console.error(`[RealtimeProvider] handler error (${table}):`, err);
        }
      });
    };

    const createChannel = () => {
      // Per-instance staleness: our own removeChannel fires CLOSED
      // synchronously, which must not be mistaken for a server-side close.
      let stale = false;
      const channel = supabase.channel(`realtime-unified-${sessionUser.id}`);

      // Profiles keep role/workspace revocation and shared settings current.
      channel.on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'profiles',
            ...(isApprover ? {} : { filter: `id=eq.${sessionUser.id}` }),
          },
          (payload) => dispatch('profiles', payload as unknown as RealtimePayload)
        );

      channel.on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'dismissed_notifications',
            filter: `user_id=eq.${sessionUser.id}`,
          },
          (payload) => dispatch('dismissed_notifications', payload as unknown as RealtimePayload)
        );

      if (hasChutiAccess) {
        // Users receive only their own leave rows; RLS scopes approvers.
        channel.on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'chuti',
            ...(isApprover ? {} : { filter: `user_id=eq.${sessionUser.id}` }),
          },
          (payload) => dispatch('chuti', payload as unknown as RealtimePayload)
        );
        channel.on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'leave_settlements',
            ...(isApprover ? {} : { filter: `user_id=eq.${sessionUser.id}` }),
          },
          (payload) => dispatch('leave_settlements', payload as unknown as RealtimePayload)
        );
        channel.on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'govt_holiday_responses',
            ...(isHolidayAdmin ? {} : { filter: `user_id=eq.${sessionUser.id}` }),
          },
          (payload) => dispatch('govt_holiday_responses', payload as unknown as RealtimePayload)
        );
      }

      if (hasQuotesAccess) {
        channel.on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'records',
            filter: `user_id=eq.${sessionUser.id}`,
          },
          (payload) => dispatch('records', payload as unknown as RealtimePayload)
        );
        channel.on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'quotation_mistakes',
            ...(isApprover ? {} : { filter: `user_id=eq.${sessionUser.id}` }),
          },
          (payload) => dispatch('quotation_mistakes', payload as unknown as RealtimePayload)
        );
        // Compliance-rule payloads are consumed directly; no full-table refetch.
        channel.on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'compliance_rules' },
          (payload) => dispatch('compliance_rules', payload as unknown as RealtimePayload)
        );
      }

      // ── todos (superadmin-only) — always user-scoped ──
      if (hasTodoAccess) {
        channel.on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'todos',
            filter: `user_id=eq.${sessionUser.id}`,
          },
          (payload) => dispatch('todos', payload as unknown as RealtimePayload)
        );
      }

      // ── attendance_daily & attendance_breaks (state transitions only) ──
      if (hasAttendanceAccess) {
        channel.on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'attendance_daily',
            ...(hasAdminAttendanceAccess ? {} : { filter: `user_id=eq.${sessionUser.id}` }),
          },
          (payload) => dispatch('attendance_daily', payload as unknown as RealtimePayload)
        );
        channel.on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'attendance_breaks',
            ...(hasAdminAttendanceAccess ? {} : { filter: `user_id=eq.${sessionUser.id}` }),
          },
          (payload) => dispatch('attendance_breaks', payload as unknown as RealtimePayload)
        );
      }


      channel.subscribe((status, err) => {
          if (!active || stale) return;
          if (typeof window === 'undefined') return;

          if (status === 'SUBSCRIBED') {
            resubscribeAttempt = 0;
            emit('realtime-connection-status', { status: 'connected' });
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            // Socket-level drops surface here; phoenix auto-rejoins errored
            // channels with its own backoff once the socket reconnects, so no
            // manual action — just report. err is only populated for these.
            console.warn(`[RealtimeProvider] unified channel connection status changed: ${status}`, err);
            emit('realtime-connection-status', { status: 'disconnected' });
          } else if (status === 'CLOSED') {
            // CLOSED with active still true = the server/service closed the
            // channel (restart, auth expiry), NOT our own cleanup (which flips
            // active first). realtime-js removes closed channels from the
            // socket and never rejoins them, so without this the app would
            // silently lose realtime until remount. Note: the library passes
            // no error argument for CLOSED — nothing useful to log there.
            emit('realtime-connection-status', { status: 'disconnected' });

            const delay = Math.min(3000 * 2 ** resubscribeAttempt, 60000);
            resubscribeAttempt += 1;
            console.info(`[RealtimeProvider] unified channel closed by server — resubscribing in ${delay / 1000}s (attempt ${resubscribeAttempt})`);

            if (resubscribeTimer) clearTimeout(resubscribeTimer);
            resubscribeTimer = setTimeout(() => {
              resubscribeTimer = null;
              if (!active) return;
              disposeChannel?.();
              createChannel();
            }, delay);
          }
        });

      disposeChannel = () => {
        stale = true;
        supabase.removeChannel(channel);
      };
    };

    createChannel();

    return () => {
      active = false;
      if (resubscribeTimer) clearTimeout(resubscribeTimer);
      disposeChannel?.();
    };
    // Only re-create when user identity or role changes — not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionUser?.id, profile?.role, profile?.has_chuti_access, profile?.has_quotes_access]);

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
