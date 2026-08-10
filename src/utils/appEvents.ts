/**
 * AUDIT FIX M2: Centralized event registry for cross-component communication.
 * All custom window events are documented here to prevent naming collisions
 * and provide type safety.
 * 
 * NOTE: A full migration to React Context/Zustand is recommended for v2.
 * This registry is the interim solution to prevent event name typos and
 * ensure discoverability.
 */

// Navigation Events
export const APP_EVENTS = {
  // Tab navigation
  CHUTI_TAB_CHANGE: 'chuti-tab-change',
  QUOTES_TAB_CHANGE: 'quotes-tab-change',
  SETTINGS_SUBTAB_CHANGE: 'settings-subtab-change',
  CHUTI_SETTINGS_CHANGED: 'chuti-settings-changed',
  
  // Notification sync  
  CHUTI_NOTIFICATION_COUNT: 'chuti-notification-count-change',
  CHUTI_NOTIFICATION_LIST_SYNC: 'chuti-notification-list-sync',
  CHUTI_DISMISSED_SYNC: 'chuti-dismissed-notifications-sync',
  CHUTI_OFFLINE_COUNT: 'chuti-offline-count-change',
  CHUTI_APPROVALS_COUNT: 'chuti-approvals-count-sync',
  
  // Realtime data
  REALTIME_DATA_CHANGED: 'realtime-data-changed',
  REALTIME_TABLE_PAYLOAD: 'realtime-table-payload',
  REALTIME_PROFILE_PAYLOAD: 'realtime-profile-payload',
  
  // Actions
  OPEN_PROFILE_SETTINGS: 'open-profile-settings',
  TRIGGER_MANUAL_SYNC: 'trigger-manual-sync',
  OPEN_REVISION_MODAL: 'open-revision-modal',
  TRIGGER_VIEWING_STAFF: 'trigger-viewing-staff',
  
  // Approval actions
  APPROVE_CHUTI_REQUEST: 'approve-chuti-request',
  APPROVE_RESERVE_ADJUSTMENT: 'approve-reserve-adjustment',
  APPROVE_PROFILE_CHANGE: 'approve-profile-change',
  APPROVE_PASSWORD_RESET: 'approve-password-reset',
  SUPERVISOR_APPROVE_CHUTI: 'supervisor-approve-chuti',
  OPEN_ADMIN_APPROVALS: 'open-admin-approvals-modal',
  OPEN_SUPERVISOR_APPROVALS: 'open-supervisor-approvals-modal',
  
  // Theme
  THEME_CHANGE: 'theme-change',
  CHUTI_LAST_VIEWED_SYNC: 'chuti-last-viewed-time-sync',
} as const;

export type AppEventName = typeof APP_EVENTS[keyof typeof APP_EVENTS];

/** Type-safe event dispatcher */
export function dispatchAppEvent<T = unknown>(eventName: AppEventName, detail?: T): void {
  window.dispatchEvent(
    detail !== undefined 
      ? new CustomEvent(eventName, { detail })
      : new Event(eventName)
  );
}

/** Type-safe event listener with cleanup */
export function onAppEvent<T = unknown>(
  eventName: AppEventName,
  handler: (detail: T) => void
): () => void {
  const listener = (e: Event) => {
    handler((e as CustomEvent<T>).detail);
  };
  window.addEventListener(eventName, listener);
  return () => window.removeEventListener(eventName, listener);
}
