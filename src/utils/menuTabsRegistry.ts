// Central registry of controllable menu tabs/subtabs.
//
// Single source of truth for BOTH the per-user "Menu Visibility" list and the
// superadmin per-role "Tab Access" matrix. To register a future tab, add one
// entry here — it automatically appears in both UIs and is enforced by the
// combined visibility helper (see permissionService.isTabVisibleForRole).

export interface MenuTabDef {
  key: string;
  label: string;
  category: 'Main Workspace Sections' | 'Quotes Tracker Subtabs' | 'Leave Tracker Subtabs' | 'Settings Subtabs' | 'User Profile View Subtabs';
}

export const MENU_TABS: MenuTabDef[] = [
  // Main Workspace Sections
  { key: 'kpi', label: 'KPI & Performance', category: 'Main Workspace Sections' },
  { key: 'todo', label: 'Todos Panel', category: 'Main Workspace Sections' },
  { key: 'leaderboard', label: 'Leaderboard (Workspace)', category: 'Main Workspace Sections' },
  { key: 'audit_logs', label: 'Audit Logs (Workspace)', category: 'Main Workspace Sections' },
  { key: 'user_management', label: 'User Management', category: 'Main Workspace Sections' },
  { key: 'bd_clock', label: 'Navbar BD Clock', category: 'Main Workspace Sections' },
  { key: 'uk_clock', label: 'Navbar UK Clock', category: 'Main Workspace Sections' },

  // Quotes Tracker Subtabs
  { key: 'copy_helper', label: 'Copy Helper Subtab', category: 'Quotes Tracker Subtabs' },
  { key: 'save_file', label: 'Save File Subtab', category: 'Quotes Tracker Subtabs' },
  { key: 'monthly', label: 'Monthly List Subtab', category: 'Quotes Tracker Subtabs' },
  { key: 'rules', label: 'Quote Rules Subtab', category: 'Quotes Tracker Subtabs' },
  { key: 'login_codes', label: 'Login Codes Subtab', category: 'Quotes Tracker Subtabs' },
  { key: 'causality', label: 'Causality Subtab', category: 'Quotes Tracker Subtabs' },
  { key: 'quick_import', label: 'Quick Import Feature', category: 'Quotes Tracker Subtabs' },
  { key: 'custom_entry', label: 'Custom Entry Feature', category: 'Quotes Tracker Subtabs' },

  // Leave Tracker Subtabs
  { key: 'leave_history', label: 'My History Subtab', category: 'Leave Tracker Subtabs' },
  { key: 'govt_responses', label: 'Govt Responses Subtab', category: 'Leave Tracker Subtabs' },
  { key: 'settlement', label: 'Settlement Subtab', category: 'Leave Tracker Subtabs' },
  { key: 'leave_settings', label: 'Leave Settings Subtab', category: 'Leave Tracker Subtabs' },
  { key: 'team_leaves', label: 'Staff Leaves Subtab', category: 'Leave Tracker Subtabs' },

  // Settings Subtabs
  { key: 'settings_profile', label: 'Settings > Profile', category: 'Settings Subtabs' },
  { key: 'settings_menu', label: 'Settings > Menu', category: 'Settings Subtabs' },
  { key: 'settings_sanitizer', label: 'Settings > Sanitizer', category: 'Settings Subtabs' },
  { key: 'settings_access', label: 'Settings > Access', category: 'Settings Subtabs' },
  { key: 'settings_feature_flags', label: 'Settings > Feature Flags', category: 'Settings Subtabs' },
  { key: 'settings_vpn', label: 'Settings > VPN', category: 'Settings Subtabs' },

  // User Profile View Subtabs (Supervisor Access)
  { key: 'user_profile_leave', label: 'User Profile > Leave History', category: 'User Profile View Subtabs' },
  { key: 'user_profile_quotes', label: 'User Profile > Quotes History', category: 'User Profile View Subtabs' },
  { key: 'user_profile_analytics', label: 'User Profile > Analytics', category: 'User Profile View Subtabs' },
  { key: 'user_profile_kpi', label: 'User Profile > KPI & Performance', category: 'User Profile View Subtabs' },
  { key: 'user_profile_settings', label: 'User Profile > Profile Settings', category: 'User Profile View Subtabs' },
];

/** Roles a superadmin can configure visibility for (never superadmin itself). */
export const CONFIGURABLE_ROLES: Array<'user' | 'supervisor' | 'admin'> = [
  'user',
  'supervisor',
  'admin',
];

/**
 * Default visibility for a tab/subtab per role when no explicit superadmin override exists.
 * Accurately reflects built-in app permission boundaries.
 */
export const getDefaultRoleVisibility = (
  role: 'user' | 'supervisor' | 'admin' | string,
  tabKey: string
): boolean => {
  switch (tabKey) {
    case 'todo':
    case 'save_file':
      return false;

    case 'audit_logs':
    case 'govt_responses':
    case 'settlement':
    case 'leave_settings':
    case 'settings_menu':
    case 'settings_sanitizer':
    case 'settings_access':
    case 'settings_feature_flags':
      return role === 'admin';

    case 'user_management':
    case 'team_leaves':
    case 'settings_vpn':
    case 'user_profile_leave':
    case 'user_profile_quotes':
    case 'user_profile_analytics':
    case 'user_profile_kpi':
    case 'user_profile_settings':
      return role === 'supervisor' || role === 'admin';

    case 'settings_profile':
    case 'kpi':
    case 'leaderboard':
    case 'copy_helper':
    case 'monthly':
    case 'rules':
    case 'login_codes':
    case 'causality':
    case 'leave_history':
    case 'quick_import':
    case 'custom_entry':
    case 'bd_clock':
    case 'uk_clock':
      return true;

    default:
      return true;
  }
};
