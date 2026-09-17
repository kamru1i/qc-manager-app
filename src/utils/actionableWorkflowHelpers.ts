import { ActionableCategory, ActionableType } from '@/types/actionableWorkflows';

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
  if (!userId) return;

  // 1. Immediately and deterministically close the approval modal
  try {
    if (onCloseModal) {
      onCloseModal();
    }
    emit('close-approval-modals');
  } catch (err) {
    console.error('Failed to close approval modal on navigation:', err);
  }

  // 2. Set canonical session and local storage keys for target user and subtab
  try {
    sessionStorage.setItem('viewingStaffId', userId);
    sessionStorage.setItem('viewingStaffSubTab', destinationTab);
    sessionStorage.setItem('viewingStaffFromUserManagement', 'true');

    localStorage.setItem('user_management_viewing_staff_id', userId);
    localStorage.setItem('user_management_active_subtab', destinationTab);
    localStorage.setItem('settings_active_subtab', 'user_management');
    localStorage.setItem('last_active_dashboard', 'profile_settings');
  } catch (err) {
    console.error('Failed to set storage for user profile navigation:', err);
  }

  // 3. Coordinate navigation and profile activation via event bus
  try {
    emit('workspace-change', 'user_management');
    emit('settings-subtab-change', { subtab: 'user_management' });
    emit('open-user-profile', { userId, subtab: destinationTab });
  } catch (err) {
    console.error('Failed to dispatch user profile navigation events:', err);
  }
}
