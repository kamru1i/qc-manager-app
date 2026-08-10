'use client';

import React, { createContext, useContext, useRef, useCallback, useEffect } from 'react';

// Event type map
export interface AppEventMap {
  'chuti-notification-count-change': { count: number };
  'chuti-notification-list-sync': { notifications: unknown[] };
  'chuti-dismissed-notifications-sync': { ids: string[] };
  'chuti-offline-count-change': { count: number };
  'chuti-approvals-count-sync': { count: number };
  'chuti-tab-change': { tab: string } | string | any;
  'quotes-tab-change': { tab: string } | string | any;
  'settings-subtab-change': { subtab: string } | string | any;
  'chuti-settings-changed': { subtab: string } | string | any;
  'workspace-change': string | any;
  'chuti-last-viewed-time-sync': { timestamp: number | string };
  'realtime-data-changed': void;
  'realtime-table-payload': { table: string; payload: unknown };
  'realtime-profile-payload': { payload: unknown };
  'realtime-connection-status': { status: string };
  'profile-updated': any;
  'open-profile-settings': void;
  'trigger-manual-sync': void;
  'trigger-viewing-staff': { userId: string };
  'open-revision-modal': { recordId: string | any };
  'approve-chuti-request': { requestId: string; approve?: boolean } | any;
  'approve-reserve-adjustment': { requestId?: string; record?: any; approve?: boolean } | any;
  'approve-profile-change': { requestId: string; approve?: boolean } | any;
  'approve-password-reset': { requestId: string; approve?: boolean } | any;
  'supervisor-approve-chuti': { requestId: string; approve?: boolean } | any;
  'open-admin-approvals-modal': void;
  'open-supervisor-approvals-modal': void;
  'open-user-notifications-modal': void;
  'theme-change': { theme: 'dark' | 'light' };
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

  return (
    <AppEventBusContext.Provider value={{ emit, on }}>
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
