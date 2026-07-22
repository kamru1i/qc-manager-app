import { Profile } from "@/types";

/**
 * True only for the superadmin role. Use for superadmin-exclusive capabilities
 * (Todos, Save File helper, sanitizer config, creating admins/superadmins).
 */
export const isSuperadmin = (user: Profile | null): boolean =>
  user?.role === 'superadmin';

/**
 * True for admin OR superadmin. Superadmin is a strict superset of admin, so
 * every admin-level capability check should use this to let superadmin inherit.
 */
export const isAdminRole = (user: Profile | null): boolean =>
  user?.role === 'admin' || user?.role === 'superadmin';

/** Alias for clarity — Superadmin inherits all Admin capabilities. */
export const hasAdminAccess = isAdminRole;
/** Alias — reads naturally at call sites gating admin-or-above capabilities. */
export const isAdminOrHigher = isAdminRole;

/**
 * Numeric role rank for hierarchy comparisons.
 * Superadmin > Admin > Supervisor > User.
 */
export const ROLE_RANK: Record<string, number> = {
  user: 1,
  supervisor: 2,
  admin: 3,
  superadmin: 4,
};

/**
 * Superadmin feature flag check. Gates functionality (not nav). Absent or
 * true = enabled (default ON); only an explicit false disables. Reading an
 * unset flag never disables a feature, so wiring gaps can't cause lockouts.
 */
export const isFeatureEnabled = (
  flagKey: string,
  globalSettings?: { feature_flags?: Record<string, boolean> } | null,
  user?: Profile | null
): boolean => {
  if (user && isSuperadmin(user)) return true;

  // Check per-user feature flag override (if explicitly configured by Superadmin)
  const userOverride = user?.global_settings?.user_feature_flags?.[flagKey];
  if (typeof userOverride === 'boolean') {
    return userOverride;
  }

  return globalSettings?.feature_flags?.[flagKey] !== false;
};

interface VisibilitySettings {
  role_visibility?: Record<string, Record<string, boolean>>;
  temp_access?: Array<{ role: string; tabKey: string; action: 'grant' | 'revoke'; expires_at: string }>;
}

/**
 * Superadmin-configurable per-role tab visibility, with time-boxed overrides.
 *
 * Base: a tab is hidden for a role only when role_visibility[role][tabKey] ===
 * false (absent = visible). An active (non-expired) temp_access entry for the
 * (role, tabKey) overrides the base: 'revoke' forces hidden, 'grant' forces
 * visible. Expired entries are ignored (client-side, compared to now).
 * Superadmins always bypass everything. Composes with per-user hidden_tabs.
 */
export const isTabVisibleForRole = (
  user: Profile | null,
  tabKey: string,
  globalSettings?: VisibilitySettings | null
): boolean => {
  if (!user) return false;
  if (isSuperadmin(user)) return true; // superadmin always sees everything

  const base = globalSettings?.role_visibility?.[user.role]?.[tabKey] !== false;

  const now = Date.now();
  const override = (globalSettings?.temp_access ?? []).find(
    (t) =>
      t.role === user.role &&
      t.tabKey === tabKey &&
      t.expires_at &&
      new Date(t.expires_at).getTime() > now
  );
  if (override) return override.action === 'grant';

  return base;
};

/** True if `user`'s role is at least `minRole` in the hierarchy. */
export const hasRoleLevel = (
  user: Profile | null,
  minRole: 'user' | 'supervisor' | 'admin' | 'superadmin'
): boolean => {
  if (!user) return false;
  return (ROLE_RANK[user.role] ?? 0) >= (ROLE_RANK[minRole] ?? 0);
};

// Role assignment options live in getAllowedRoleOptions() below — single source
// of truth for the role-management dropdown, mirrored by backend RPC/trigger.

/**
 * Returns the role string to display based on viewer permissions.
 * For non-superadmins, superadmin target roles are masked as 'user' to hide special status.
 */
export const getDisplayRole = (
  targetRole: 'admin' | 'supervisor' | 'user' | 'superadmin' | string | undefined,
  viewer: Profile | null
): 'admin' | 'supervisor' | 'user' | 'superadmin' | string => {
  if (targetRole === 'superadmin') {
    return isSuperadmin(viewer) ? 'superadmin' : 'user';
  }
  return targetRole || 'user';
};

/**
 * Returns a user-friendly role label (e.g. 'Admin', 'Supervisor', 'User', 'Superadmin').
 * Masked as 'User' for non-superadmin viewers when viewing a superadmin profile.
 */
export const getRoleLabel = (
  targetRole: 'admin' | 'supervisor' | 'user' | 'superadmin' | string | undefined,
  viewer: Profile | null
): string => {
  const role = getDisplayRole(targetRole, viewer);
  if (role === 'superadmin') return 'Superadmin';
  if (role === 'admin') return 'Admin';
  if (role === 'supervisor') return 'Supervisor';
  return 'User';
};

/**
 * Determines if currentUser has permission to manage/edit targetProfile's role & settings.
 * Superadmin can manage everyone; Admin can manage ONLY User and Supervisor accounts.
 */
export const canManageUserRole = (
  currentUser: Profile | null,
  targetProfile: Profile | null
): boolean => {
  if (!currentUser) return false;
  if (isSuperadmin(currentUser)) return true;
  if (isAdminRole(currentUser)) {
    if (!targetProfile) return true; // new user creation
    // Admin cannot edit Admin or Superadmin accounts
    return targetProfile.role !== 'admin' && targetProfile.role !== 'superadmin';
  }
  return false;
};

/**
 * Returns the list of role options available to currentUser when creating or updating users.
 * Superadmin can assign: superadmin, admin, supervisor, user.
 * Admin can assign ONLY: supervisor, user.
 */
export const getAllowedRoleOptions = (
  currentUser: Profile | null
): Array<'user' | 'supervisor' | 'admin' | 'superadmin'> => {
  if (isSuperadmin(currentUser)) {
    return ['user', 'supervisor', 'admin', 'superadmin'];
  }
  if (isAdminRole(currentUser)) {
    return ['user', 'supervisor'];
  }
  return [];
};

/**
 * Checks if targetUser is in the supervisor's team (either direct or delegated team-level supervision).
 */
export const isSupervisedTeam = (
  currentUser: Profile | null,
  targetUser: Profile | null,
  profilesList: Profile[]
): boolean => {
  if (!currentUser || !targetUser) return false;
  if (targetUser.id === currentUser.id) return true;
  
  // Direct team supervision
  const supervisorIds = targetUser.supervisor_ids || [];
  if (supervisorIds.includes(currentUser.id)) return true;
  
  // Delegated team-level supervision (B is delegated supervisor of A, where employee has supervisor A)
  if (currentUser.role === 'supervisor') {
    const delegatedFromSupervisorIds = profilesList
      .filter((p) => p.delegated_supervisor_id === currentUser.id)
      .map((p) => p.id);
    if (supervisorIds.some((id) => delegatedFromSupervisorIds.includes(id))) return true;
  }
  
  return false;
};

/**
 * Checks if targetUser is directly supervised by currentUser.
 */
export const isDirectlySupervised = (
  currentUser: Profile | null,
  targetUser: Profile | null
): boolean => {
  if (!currentUser || !targetUser) return false;
  if (targetUser.id === currentUser.id) return true;
  
  const supervisorIds = targetUser.supervisor_ids || [];
  return supervisorIds.includes(currentUser.id);
};

/**
 * Centralized authorization rules for module access.
 */
export const canAccessModule = (
  currentUser: Profile | null,
  targetUser: Profile | null,
  module: 'kpi' | 'leave' | 'profile_settings' | 'quotes' | 'user_management' | 'todo' | 'leaderboard' | 'reports' | 'audit_logs',
  profilesList: Profile[] = []
): boolean => {
  if (!currentUser) return false;
  
  // Admin / Superadmin (highest permission priority). Superadmin inherits all
  // admin capabilities; Todos is superadmin-only.
  if (isAdminRole(currentUser)) {
    if (module === 'todo') {
      return isSuperadmin(currentUser);
    }
    return true;
  }

  // Regular User permissions
  if (currentUser.role === 'user') {
    if (module === 'todo') {
      return isSuperadmin(currentUser);
    }
    if (module === 'kpi') return targetUser ? targetUser.id === currentUser.id : true;
    if (module === 'leave') return targetUser ? targetUser.id === currentUser.id : true;
    if (module === 'profile_settings') return true;
    if (module === 'quotes') return !!currentUser.has_quotes_access;
    if (module === 'leaderboard' || module === 'reports') return true;
    return false;
  }
  
  // Supervisor permissions
  if (currentUser.role === 'supervisor') {
    if (module === 'audit_logs') return false; // explicitly revoked for supervisors
    if (module === 'todo') {
      return isSuperadmin(currentUser);
    }
    if (module === 'user_management') return true;
    if (module === 'quotes') return !!currentUser.has_quotes_access;
    if (module === 'leaderboard' || module === 'reports') return true;
    
    // Checks for specific target users
    if (targetUser) {
      if (targetUser.id === currentUser.id) return true; // full access to self
      
      switch (module) {
        case 'leave':
          return (
            isSupervisedTeam(currentUser, targetUser, profilesList) ||
            targetUser.delegated_leave_supervisor_id === currentUser.id
          );
        case 'kpi':
          return (
            isDirectlySupervised(currentUser, targetUser) ||
            targetUser.delegated_kpi_supervisor_id === currentUser.id
          );
        case 'profile_settings':
          return true; // allowed to access Profile Settings tab, but specific sections are restricted
        default:
          return false;
      }
    }
    return true;
  }
  
  return false;
};

/**
 * Checks supervisor permissions on specific sections inside User Profile Settings.
 */
export const canAccessProfileSection = (
  currentUser: Profile | null,
  targetUser: Profile | null,
  section: 'leave_settings' | 'kpi_settings' | 'quotes_settings' | 'basic_details'
): boolean => {
  if (!currentUser || !targetUser) return false;
  if (isAdminRole(currentUser)) return true;
  if (targetUser.id === currentUser.id) return true;
  
  if (currentUser.role === 'supervisor') {
    switch (section) {
      case 'basic_details':
      case 'quotes_settings':
        return true; // supervisors can edit basic details and quotes settings of all users
      case 'leave_settings':
        return true; // supervisors can read leave settings of all users (write is blocked via disabled={!isAdmin} in form)
      case 'kpi_settings':
        return isDirectlySupervised(currentUser, targetUser);
      default:
        return false;
    }
  }
  
  return false;
};
