'use client';

import React, { createContext, useContext, useRef, useCallback, useEffect, useMemo } from 'react';

// Event type map — all custom app events with their typed payloads
export interface AppEventMap {
  // NOTIFICATION_SYNC
  'chuti-notification-count-change': { count: number } | number;
  'chuti-notification-list-sync': { notifications: unknown[] } | unknown[];
  'chuti-dismissed-notifications-sync': { ids: string[] } | string[];
  'chuti-offline-count-change': { count: number } | number;
  'chuti-approvals-count-sync': { count: number } | number;

  // NAVIGATION
  'chuti-tab-change': { tab: string } | string;
  'quotes-tab-change': { tab: string } | string;
  'settings-subtab-change': { subtab: string } | string;
  'chuti-settings-changed': { subtab: string } | string;
  'workspace-change': { target: string } | string;
  'chuti-last-viewed-time-sync': { timestamp: number | string } | string;

  // REALTIME
  'realtime-data-changed': void;
  'realtime-table-payload': { table: string; payload: unknown };
  'realtime-profile-payload': { payload: unknown } | unknown;
  'realtime-connection-status': { status: 'connected' | 'disconnected' } | string;

  // ACTION
  'open-profile-settings': void;
  'trigger-manual-sync': void;
  'trigger-viewing-staff': { userId: string | null } | string | null;
  'open-revision-modal': { recordId: string } | unknown;
  'approve-chuti-request': { id: string; approve: boolean };
  'approve-reserve-adjustment': { record: unknown; approve: boolean };
  'approve-profile-change': { id: string; approve: boolean };
  'approve-password-reset': { id: string; approve: boolean };
  'supervisor-approve-chuti': { id: string; approve: boolean };
  'open-admin-approvals-modal': void;
  'open-supervisor-approvals-modal': void;
  'open-user-notifications-modal': void;
  'profile-updated': object;
  'profile-access-updated': { table?: string; userIds?: string[]; payload?: unknown } | unknown;

  // THEME
  'theme-change': { theme: 'dark' | 'light' } | string;
}

export type AppEventName = keyof AppEventMap;

type EventCallback<T> = (data: T) => void;

interface AppEventBusContextType {
  emit: <K extends AppEventName>(event: K, ...args: AppEventMap[K] extends void ? [] : [AppEventMap[K]]) => void;
  on: <K extends AppEventName>(event: K, callback: EventCallback<AppEventMap[K]>) => () => void;
}

const AppEventBusContext = createContext<AppEventBusContextType | null>(null);

export function AppEventBusProvider({ children }: { children: React.ReactNode }) {
  const listenersRef = useRef<Map<string, Set<EventCallback<any>>>>(new Map());

  const on = useCallback(<K extends AppEventName>(event: K, callback: EventCallback<AppEventMap[K]>) => {
    if (!listenersRef.current.has(event)) {
      listenersRef.current.set(event, new Set());
    }
    listenersRef.current.get(event)!.add(callback as EventCallback<any>);
    
    // Return unsubscribe function
    return () => {
      listenersRef.current.get(event)?.delete(callback as EventCallback<any>);
    };
  }, []);

  const emit = useCallback(<K extends AppEventName>(event: K, ...args: AppEventMap[K] extends void ? [] : [AppEventMap[K]]) => {
    const data = args[0];
    listenersRef.current.get(event)?.forEach((cb) => {
      try {
        cb(data as any);
      } catch (err) {
        console.error(`[AppEventBus] Error in handler for '${event}':`, err);
      }
    });
  }, []);

  const value = useMemo(() => ({ emit, on }), [emit, on]);

  return (
    <AppEventBusContext.Provider value={value}>
      {children}
    </AppEventBusContext.Provider>
  );
}

/** Hook to access the event bus */
export function useAppEventBus() {
  const ctx = useContext(AppEventBusContext);
  if (!ctx) throw new Error('useAppEventBus must be used within AppEventBusProvider');
  return ctx;
}

/** Hook to subscribe to a specific event with auto-cleanup */
export function useAppEvent<K extends AppEventName>(
  event: K,
  callback: EventCallback<AppEventMap[K]>,
  deps: React.DependencyList = []
) {
  const { on } = useAppEventBus();
  useEffect(() => {
    return on(event, callback);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, event, ...deps]);
}
