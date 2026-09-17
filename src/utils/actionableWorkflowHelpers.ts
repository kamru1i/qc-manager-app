import { ActionableCategory, ActionableType } from '@/types/actionableWorkflows';
import { Profile } from '@/types';
import { isAdminRole } from '@/utils/permissionService';

/**
 * Resolves the destination tab within the target User Profile based on the request type and category.
 *
 * Case A (Leave Workflows):
 * - Leave approvals, reserve/overtime adjustments, leave removals, holiday/settlement responses
 * -> Opens target user's 'leave' (Leave History) tab.
 *
 * Case B (Profile / User Management Workflows):
 * - Profile changes, password resets, account creations, permission reviews
 * -> Opens target user's 'profile' (Profile Settings) tab.
 */
export function resolveActionableProfileDestination(
  type?: ActionableType,
  category?: ActionableCategory
): 'leave' | 'profile' {
  if (
    category === 'leave' ||
    type === 'leave_request' ||
    type === 'reserve_adjustment' ||
    type === 'leave_removal' ||
    type === 'holiday_response' ||
    type === 'settlement_response'
  ) {
    return 'leave';
  }

  if (
    category === 'user_management' ||
    type === 'profile_change' ||
    type === 'password_reset' ||
    type === 'user_creation'
  ) {
    return 'profile';
  }

  return 'profile';
}

export type UserProfileSubtab = 'profile' | 'leave' | 'quotes' | 'analytics' | 'kpi';

export interface NavigateToUserProfileParams {
  userId: string;
  subtab?: UserProfileSubtab | 'leave_history';
  emit: (event: any, ...args: any[]) => void;
  onNavigateTab?: (tab: string, subtab?: string) => void;
  onCloseModal?: () => void;
}

/**
 * Canonical helper for navigating to a specific target user's profile within Settings > Users.
 * Stages identity in sessionStorage/localStorage for unmounted hydration and dispatches
 * real-time event bus notifications for mounted hydration.
 */
export function navigateToUserProfile({
  userId,
  subtab = 'profile',
  emit,
  onNavigateTab,
  onCloseModal,
}: NavigateToUserProfileParams): void {
  if (!userId) return;

  const normalizedSubtab: UserProfileSubtab = subtab === 'leave_history' ? 'leave' : subtab;

  if (onCloseModal) {
    try {
      onCloseModal();
    } catch {}
  }
  try {
    emit('close-approval-modals');
  } catch {}

  // 1. Stage target user and subtab in session/local storage for deterministic mount hydration
  try {
    sessionStorage.setItem('viewingStaffId', userId);
    sessionStorage.setItem('viewingStaffSubTab', normalizedSubtab);
    sessionStorage.setItem('viewingStaffFromUserManagement', 'true');

    localStorage.setItem('user_management_viewing_staff_id', userId);
    localStorage.setItem('user_management_active_subtab', normalizedSubtab);
    localStorage.setItem('settings_active_subtab', 'user_management');
    localStorage.setItem('last_active_dashboard', 'profile_settings');
  } catch (err) {
    console.error('Failed to set storage for user profile navigation:', err);
  }

  // 2. Coordinate navigation via event bus
  try {
    emit('workspace-change', 'user_management');
    emit('settings-subtab-change', { subtab: 'user_management' });
    emit('open-user-profile', { userId, subtab: normalizedSubtab });
  } catch (err) {
    console.error('Failed to dispatch user profile navigation events:', err);
  }

  // 3. Trigger direct tab navigation callback if provided
  if (onNavigateTab) {
    onNavigateTab('user_management', normalizedSubtab);
  }
}

export interface ExecuteActionableProfileNavigationParams {
  userId: string;
  destinationTab: 'leave' | 'profile';
  emit: (event: any, ...args: any[]) => void;
  onCloseModal?: () => void;
}

/**
 * Deterministically closes the Action Center modal and navigates to the canonical target user profile
 * with the specified subtab (Leave History or Profile Settings).
 */
export function executeActionableProfileNavigation({
  userId,
  destinationTab,
  emit,
  onCloseModal,
}: ExecuteActionableProfileNavigationParams): void {
  navigateToUserProfile({
    userId,
    subtab: destinationTab,
    emit,
    onCloseModal,
  });
}

export interface NavigateToLeaveTrackerParams {
  userId?: string;
  subtab?: 'add_leave' | 'leave_history' | 'settlement' | 'leave_settings' | 'team_leaves';
  date?: string;
  search?: string;
  viewerProfile?: Profile | null;
  emit: (event: any, ...args: any[]) => void;
  onNavigateTab?: (tab: string, subtab?: string) => void;
}

/**
 * Canonical helper for navigating to the Leave Tracker workspace with target user, subtab,
 * and date filter context safely preserved.
 */
export function navigateToLeaveTracker({
  userId,
  subtab,
  date,
  search,
  viewerProfile,
  emit,
  onNavigateTab,
}: NavigateToLeaveTrackerParams): void {
  const isViewerAdmin = isAdminRole(viewerProfile || null);
  const isSelf = !!(userId && viewerProfile?.id === userId);

  // Resolve canonical target subtab
  let resolvedSubtab = subtab;
  if (!resolvedSubtab) {
    if (isViewerAdmin && userId && !isSelf) {
      resolvedSubtab = 'settlement';
    } else {
      resolvedSubtab = 'leave_history';
    }
  }

  // Stage target staff if specified
  if (userId) {
    sessionStorage.setItem('viewingStaffId', userId);
    emit('trigger-viewing-staff', { userId });
  }

  // Stage and dispatch filters
  if (date) {
    sessionStorage.setItem('filterStartDate', date);
    sessionStorage.setItem('filterEndDate', date);
    emit('filter-leave', { date, search });
  } else if (search) {
    emit('filter-leave', { search });
  }

  emit('workspace-change', 'chuti');
  emit('chuti-tab-change', { tab: resolvedSubtab });
  if (onNavigateTab) {
    onNavigateTab('chuti', resolvedSubtab);
  }
}
