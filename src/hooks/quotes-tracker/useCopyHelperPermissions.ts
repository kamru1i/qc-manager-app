'use client';

import { useMemo } from 'react';
import { Profile } from '@/types';

/**
 * Centralized permission logic for the Copy Helper feature.
 *
 * Copy Helper itself is available to ALL authenticated users with quotes
 * access. Which boxes are visible depends on the user's File Type
 * Permissions (profiles.allowed_types):
 *
 * - "Sale" permission ON  → Session Info, Sales Summary, Quick Copy Actions,
 *                           Detailed Report, Admin Sales Summary
 * - "Sale" permission OFF → Detailed Report only
 *
 * allowed_types semantics (consistent with the daily entry form and
 * UserManagementDashboard): null/undefined = all categories allowed,
 * empty array = none allowed.
 */
export const useCopyHelperPermissions = (profile: Profile | null) => {
  const hasSalePermission = useMemo(() => {
    if (!profile) return false;
    if (!profile.allowed_types) return true; // null = "All Categories"
    return profile.allowed_types.includes('Sale');
  }, [profile]);

  return { hasSalePermission };
};
