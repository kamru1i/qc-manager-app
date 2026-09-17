import { Profile } from '@/types';
import { canAccessModule, isAdminRole } from '@/utils/permissionService';

export interface MonthlyQuotesFilterState {
  year?: string;
  month?: string;
  branch?: string;
  search?: string;
}

export interface SaleSummaryQuotesFilterState {
  year?: string;
  month?: string;
  branch?: string;
  search?: string;
}

export interface MistakesQuotesFilterState {
  year?: string;
  month?: string;
  branch?: string;
  search?: string;
}

export interface NavigationQuotesFilters {
  monthly?: MonthlyQuotesFilterState;
  saleSummary?: SaleSummaryQuotesFilterState;
  mistakes?: MistakesQuotesFilterState;
}

export interface NavigationLeaveFilters {
  filterType?: string; // 'all' | 'Early Leave' | 'Full Leave' | 'Late Join' | 'Overtime' | 'Short Leave'
  search?: string;
}

export interface NavigationLeaderboardFilters {
  period?: 'monthly' | 'yearly';
  year?: string;
  month?: string;
}

export interface NavigationContextState {
  mainTab: string; // 'quotes' | 'chuti' | 'todo' | 'profile_settings' | 'kpi' | 'all_report' | 'leaderboard'
  subtab?: string; // e.g. 'monthly', 'sale_summary', 'mistakes', 'leave_history', 'team_leaves', 'user_management'
  quotesFilters?: NavigationQuotesFilters;
  leaveFilters?: NavigationLeaveFilters;
  leaderboardFilters?: NavigationLeaderboardFilters;
  timestamp: number;
}

const STORAGE_PREFIX = 'qc_nav_context';

function getStorageKey(userId?: string): string {
  return userId ? `${STORAGE_PREFIX}_${userId}` : `${STORAGE_PREFIX}_anon`;
}

/**
 * Validates and adjusts the navigation context based on the user's current permissions.
 * If a previously accessible tab/subtab was revoked, falls back to the nearest valid view.
 */
export function validateNavigationPermissions(
  context: NavigationContextState,
  profile: Profile | null
): NavigationContextState {
  if (!profile) return context;

  const validTabs = ['chuti', 'quotes', 'todo', 'profile_settings', 'kpi', 'leaderboard', 'my_report', 'all_report'];
  let mainTab = context.mainTab;
  let subtab = context.subtab;

  // 1. Validate mainTab
  if (!validTabs.includes(mainTab) || !canAccessModule(profile, null, mainTab === 'reports' ? 'leaderboard' : mainTab)) {
    // Resolve fallback tab in priority order
    if (canAccessModule(profile, null, 'leave')) {
      mainTab = 'chuti';
    } else if (canAccessModule(profile, null, 'quotes')) {
      mainTab = 'quotes';
    } else if (canAccessModule(profile, null, 'todo')) {
      mainTab = 'todo';
    } else if (canAccessModule(profile, null, 'user_management')) {
      mainTab = 'profile_settings';
    } else if (canAccessModule(profile, null, 'kpi')) {
      mainTab = 'kpi';
    } else {
      mainTab = 'profile_settings';
    }
    // If mainTab had to change due to permission revocation, reset subtab
    subtab = undefined;
  }

  // 2. Validate subtab for mainTab
  if (mainTab === 'quotes' && subtab) {
    const validQuotesSubtabs = [
      'entry',
      'monthly',
      'sale_summary',
      'leaderboard',
      'reports',
      'rules',
      'login_codes',
      'causality',
      'copy_helper',
      'save_file',
      'quick_import',
      'mistakes',
    ];
    if (!validQuotesSubtabs.includes(subtab)) {
      subtab = 'monthly';
    }
  } else if (mainTab === 'chuti' && subtab) {
    const validChutiSubtabs = ['add_leave', 'leave_history', 'settlement', 'leave_settings', 'team_leaves'];
    if (!validChutiSubtabs.includes(subtab)) {
      subtab = isAdminRole(profile) ? 'settlement' : 'leave_history';
    }
  } else if (mainTab === 'profile_settings' && subtab) {
    if (subtab === 'user_management' && !isAdminRole(profile) && !profile?.can_manage_rules) {
      subtab = 'profile';
    }
  }

  return {
    ...context,
    mainTab,
    subtab,
  };
}

/**
 * Retrieves the saved navigation context for a user, validating permissions.
 */
export function getNavigationContext(
  userId?: string,
  profile?: Profile | null
): NavigationContextState | null {
  if (typeof window === 'undefined') return null;

  const key = getStorageKey(userId);
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;

    const state = parsed as NavigationContextState;
    if (!state.mainTab || typeof state.mainTab !== 'string') return null;

    return validateNavigationPermissions(state, profile || null);
  } catch {
    return null;
  }
}

/**
 * Persists partial navigation updates into user-scoped localStorage.
 * Merges updates cleanly without dropping previously saved filters.
 */
export function saveNavigationContext(
  userId: string | undefined,
  updates: Partial<NavigationContextState>
): void {
  if (typeof window === 'undefined') return;

  const key = getStorageKey(userId);
  try {
    let existing: NavigationContextState | null = null;
    const raw = localStorage.getItem(key);
    if (raw) {
      existing = JSON.parse(raw);
    }

    const merged: NavigationContextState = {
      mainTab: updates.mainTab || existing?.mainTab || 'chuti',
      subtab: updates.subtab !== undefined ? updates.subtab : existing?.subtab,
      quotesFilters: {
        monthly: {
          ...existing?.quotesFilters?.monthly,
          ...updates.quotesFilters?.monthly,
        },
        saleSummary: {
          ...existing?.quotesFilters?.saleSummary,
          ...updates.quotesFilters?.saleSummary,
        },
        mistakes: {
          ...existing?.quotesFilters?.mistakes,
          ...updates.quotesFilters?.mistakes,
        },
      },
      leaveFilters: {
        ...existing?.leaveFilters,
        ...updates.leaveFilters,
      },
      leaderboardFilters: {
        ...existing?.leaderboardFilters,
        ...updates.leaderboardFilters,
      },
      timestamp: Date.now(),
    };

    localStorage.setItem(key, JSON.stringify(merged));
  } catch {}
}

/**
 * Clears saved navigation context for the user.
 */
export function clearNavigationContext(userId?: string): void {
  if (typeof window === 'undefined') return;
  const key = getStorageKey(userId);
  try {
    localStorage.removeItem(key);
  } catch {}
}
