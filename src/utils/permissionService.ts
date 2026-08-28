import { Profile } from "@/types";
import { getDefaultRoleVisibility } from '@/utils/menuTabsRegistry';
import { getDefaultFeatureFlagState, FLAG_TO_TAB_KEY } from '@/utils/featureFlagsRegistry';

/**
 * True only for the superadmin role. Use for superadmin-exclusive capabilities
 * (Todos, Save File helper, sanitizer config, creating admins/superadmins).
 */
export const isSuperadmin = (user: Profile | null): boolean =>
  user?.role === 'superadmin';

/**
 * True if user has access to view the Todo page (Superadmin or explicitly granted user).
 */
export const hasTodoAccess = (user: Profile | null): boolean =>
  isSuperadmin(user) || user?.has_todo_access === true;

/**
 * True if user has View-Only access to the Todo page (granted user, but not superadmin).
 */
export const hasTodoViewOnly = (user: Profile | null): boolean =>
  !isSuperadmin(user) && user?.has_todo_access === true;

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
 * Superadmin feature flag check. Gates functionality (not nav). Reading an
 * unset flag falls back to default feature state (getDefaultFeatureFlagState).
 * Per-user override takes precedence over global setting.
 */
export const isFeatureEnabled = (
  flagKey: string,
  globalSettings?: VisibilitySettings | null,
  user?: Profile | null
): boolean => {
  if (!user) {
    const configuredFlag = globalSettings?.feature_flags?.[flagKey];
    if (typeof configuredFlag === 'boolean') return configuredFlag;
    return getDefaultFeatureFlagState(flagKey);
  }

  const now = Date.now();
  const tempEntries = globalSettings?.temp_access ?? user?.global_settings?.temp_access ?? [];

  // 1st Priority: Active per-user temporary access control rule (matches user ID or codename)
  const userTempOverride = tempEntries.find(
    (t: any) =>
      t.target_type === 'user' &&
      (t.user_id === user.id ||
        (t.user_codename &&
          (t.user_codename === user.codename ||
            t.user_codename === user.full_name ||
            t.user_codename === user.username))) &&
      t.tabKey === flagKey &&
      t.expires_at &&
      new Date(t.expires_at).getTime() > now
  );
  if (userTempOverride) {
    return userTempOverride.action === 'grant';
  }

  // 2nd Priority: Active per-role temporary access control rule (matches role)
  const roleTempOverride = tempEntries.find(
    (t: any) =>
      (!t.target_type || t.target_type === 'role') &&
      t.role === user.role &&
      t.tabKey === flagKey &&
      t.expires_at &&
      new Date(t.expires_at).getTime() > now
  );
  if (roleTempOverride) {
    return roleTempOverride.action === 'grant';
  }

  // 3rd Priority: Per-user feature flag override (if explicitly configured)
  const userOverride = user?.global_settings?.user_feature_flags?.[flagKey];
  if (typeof userOverride === 'boolean') {
    return userOverride;
  }

  if (isSuperadmin(user)) return true;

  const configuredFlag = globalSettings?.feature_flags?.[flagKey];
  if (typeof configuredFlag === 'boolean') {
    return configuredFlag;
  }

  return getDefaultFeatureFlagState(flagKey);
};

/**
 * Checks if Superadmin has delegated control of a specific feature flag to Admins.
 */
export const isAdminDelegatedFeature = (
  flagKey: string,
  globalSettings?: { admin_delegated_flags?: Record<string, boolean> } | null,
  superadminProfile?: Profile | null
): boolean => {
  if (globalSettings?.admin_delegated_flags?.[flagKey]) return true;
  if (superadminProfile?.global_settings?.admin_delegated_flags?.[flagKey]) return true;
  return false;
};

/**
 * True if currentUser is a Superadmin OR (isAdminRole AND the feature flag is delegated to Admins by Superadmin).
 */
export const canAdminManageFeatureFlag = (
  currentUser: Profile | null,
  flagKey: string,
  globalSettings?: { admin_delegated_flags?: Record<string, boolean> } | null,
  superadminProfile?: Profile | null
): boolean => {
  if (!currentUser) return false;
  if (isSuperadmin(currentUser)) return true;
  if (isAdminRole(currentUser)) {
    return isAdminDelegatedFeature(flagKey, globalSettings, superadminProfile);
  }
  return false;
};

/**
 * True if the user has write permission for Quotation Mistakes (Add, Edit, Delete).
 * Super Admin: always true.
 * User: always false.
 * Admin / Supervisor: true only if quote_mistakes_write feature flag is enabled.
 */
export const canWriteQuotationMistakes = (
  user: Profile | null,
  globalSettings?: VisibilitySettings | null,
  profilesList: Profile[] = []
): boolean => {
  if (!user) return false;
  if (isSuperadmin(user)) return true;
  if (user.role === 'user') return false;

  if (user.role === 'admin' || user.role === 'supervisor') {
    const gs = getEffectiveGlobalSettings(user, globalSettings, profilesList);
    return isFeatureEnabled('quote_mistakes_write', gs, user);
  }

  return false;
};

interface VisibilitySettings {
  feature_flags?: Record<string, boolean>;
  role_visibility?: Record<string, Record<string, boolean>>;
  supervisor_access_overrides?: Record<string, Record<string, boolean>>;
  temp_access?: Array<{
    target_type?: 'role' | 'user';
    user_id?: string;
    user_codename?: string;
    role: string;
    tabKey: string;
    action: 'grant' | 'revoke';
    expires_at: string;
    comment?: string;
  }>;
}

/**
 * Resolves effective global settings across passed settings, profile settings, or profiles list.
 * Central superadmin / admin settings with supervisor_access_overrides take priority over empty user profile settings.
 */
export const getEffectiveGlobalSettings = (
  user?: Profile | null,
  globalSettings?: VisibilitySettings | null,
  profilesList: Profile[] = []
): VisibilitySettings => {
  if (globalSettings?.supervisor_access_overrides || globalSettings?.role_visibility) {
    return globalSettings;
  }
  if (user?.global_settings?.supervisor_access_overrides) {
    return user.global_settings;
  }
  const sa = profilesList.find((p) => p.role === 'superadmin' && p.global_settings);
  if (sa?.global_settings?.supervisor_access_overrides || sa?.global_settings?.role_visibility) {
    return sa.global_settings;
  }

  const admin = profilesList.find(
    (p) => isAdminRole(p) && (p.global_settings?.supervisor_access_overrides || p.global_settings?.role_visibility)
  );
  if (admin?.global_settings) return admin.global_settings;

  if (user?.global_settings) {
    return user.global_settings;
  }

  return {};
};

/**
 * Checks if a supervisor or admin can access a specific subtab in User Profile View
 * ('user_profile_leave', 'user_profile_quotes', 'user_profile_analytics', 'user_profile_kpi', 'user_profile_settings').
 *
 * Evaluates:
 * 1. Superadmin -> true
 * 2. Per-supervisor specific override in supervisor_access_overrides[supervisor.id][subtabKey]
 * 3. Role-level tab visibility (isTabVisibleForRole)
 */
export const canAccessUserProfileSubtab = (
  supervisor: Profile | null,
  subtabKey: 'user_profile_leave' | 'user_profile_quotes' | 'user_profile_analytics' | 'user_profile_kpi' | 'user_profile_settings' | string,
  globalSettings?: VisibilitySettings | null,
  profilesList: Profile[] = []
): boolean => {
  if (!supervisor) return false;
  if (isSuperadmin(supervisor)) return true;

  const gs = getEffectiveGlobalSettings(supervisor, globalSettings, profilesList);

  // 1. Per-supervisor specific override
  const supervisorOverrides = gs?.supervisor_access_overrides?.[supervisor.id];
  if (supervisorOverrides && typeof supervisorOverrides[subtabKey] === 'boolean') {
    return supervisorOverrides[subtabKey];
  }

  // 2. Fallback to per-role visibility
  return isTabVisibleForRole(supervisor, subtabKey, gs);
};

/**
 * Superadmin-configurable per-role tab visibility, with time-boxed overrides & feature flag gating.
 *
 * Base: a tab is hidden for a role when role_visibility[role][tabKey] === false,
 * or when unset and default role permission is false (getDefaultRoleVisibility).
 * An active (non-expired) temp_access entry for the (role/user, tabKey) overrides the base:
 * 'revoke' forces hidden, 'grant' forces visible.
 */
export const isTabVisibleForRole = (
  user: Profile | null,
  tabKey: string,
  globalSettings?: VisibilitySettings | null,
  profilesList: Profile[] = []
): boolean => {
  if (!user) return false;

  const gs = getEffectiveGlobalSettings(user, globalSettings, profilesList);

  // Check mapped feature flag first
  const mappedFlag = Object.keys(FLAG_TO_TAB_KEY).find((flag) => FLAG_TO_TAB_KEY[flag] === tabKey);
  if (mappedFlag && !isFeatureEnabled(mappedFlag, gs, user)) {
    return false;
  }

  if (isSuperadmin(user)) return true; // superadmin always sees everything

  const roleVis = gs?.role_visibility?.[user.role];
  let base: boolean;
  if (roleVis && typeof roleVis[tabKey] === 'boolean') {
    base = roleVis[tabKey];
  } else {
    base = getDefaultRoleVisibility(user.role, tabKey);
  }

  const now = Date.now();
  const tempEntries = globalSettings?.temp_access ?? [];

  // 1st Priority: Specific Per-User temporary override (matches user.id or user.codename/username/full_name)
  const userOverride = tempEntries.find(
    (t) =>
      t.target_type === 'user' &&
      (t.user_id === user.id ||
        (t.user_codename &&
          (t.user_codename === user.codename ||
            t.user_codename === user.full_name ||
            t.user_codename === user.username))) &&
      t.tabKey === tabKey &&
      t.expires_at &&
      new Date(t.expires_at).getTime() > now
  );
  if (userOverride) return userOverride.action === 'grant';

  // 2nd Priority: Per-Role temporary override (matches user.role)
  const roleOverride = tempEntries.find(
    (t) =>
      (!t.target_type || t.target_type === 'role') &&
      t.role === user.role &&
      t.tabKey === tabKey &&
      t.expires_at &&
      new Date(t.expires_at).getTime() > now
  );
  if (roleOverride) return roleOverride.action === 'grant';

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
  module: 'kpi' | 'leave' | 'profile_settings' | 'quotes' | 'user_management' | 'todo' | 'leaderboard' | 'reports' | string,
  profilesList: Profile[] = [],
  globalSettings?: VisibilitySettings | null
): boolean => {
  if (!currentUser) return false;
  if (isSuperadmin(currentUser)) return true;

  // Workspace assignment is an authorization boundary, not merely a menu
  // preference. Keep this check aligned with database RLS so revoked access
  // takes effect both in the UI and for direct Supabase requests.
  if (module === 'leave' && currentUser.has_chuti_access !== true) return false;
  if (module === 'quotes' && currentUser.has_quotes_access !== true) return false;
  if (module === 'todo') return currentUser.has_todo_access === true;

  // Single source of truth: Tab Access (per role) configuration in global_settings
  const gs = globalSettings || currentUser.global_settings;
  const isVisible = isTabVisibleForRole(currentUser, module, gs);
  if (!isVisible) return false;

  // Additional target-user supervision checks for team management
  if (targetUser && currentUser.role === 'supervisor') {
    if (targetUser.id === currentUser.id) return true;
    if (module === 'leave') {
      return (
        isSupervisedTeam(currentUser, targetUser, profilesList) ||
        targetUser.delegated_leave_supervisor_id === currentUser.id
      );
    }
    if (module === 'kpi') {
      return (
        isDirectlySupervised(currentUser, targetUser) ||
        targetUser.delegated_kpi_supervisor_id === currentUser.id
      );
    }
  }

  return true;
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
        return true; // supervisors can view quotes settings of all users (editing is restricted to assigned/delegated supervisors)
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
