// Registry of superadmin-controllable feature flags.
//
// Flags gate FUNCTIONALITY inside pages (nav visibility is handled separately by
// Tab Access). Every flag DEFAULTS ON — absent or true = enabled — so behavior
// is unchanged until a superadmin explicitly turns one off. To add a flag: add
// one entry here, then guard the feature with isFeatureEnabled(key, settings).

export interface FeatureFlagDef {
  key: string;
  label: string;
  description: string;
}

export const FEATURE_FLAGS: FeatureFlagDef[] = [
  // Leave Tracker Features
  {
    key: 'break_time',
    label: 'Short-Leave Break Time',
    description: 'The break-time add-on toggle when signing in over an hour late.',
  },
  {
    key: 'jummah_adjustment',
    label: 'Jummah Prayer Adjustment',
    description: 'The Friday 20-minute short-leave adjustment toggle.',
  },
  {
    key: 'leave_adjustments',
    label: 'Deficit Leave Adjustments',
    description: 'Using accrued overtime or reserve holiday hours to offset short-leave deficits.',
  },
  {
    key: 'bulk_leave_submission',
    label: 'Bulk Full Leave Submissions',
    description: 'Submitting up to 10 separate full leave dates simultaneously using the calendar panel.',
  },
  {
    key: 'reserve_holiday_claiming',
    label: 'Reserve Holiday Claiming',
    description: 'Selecting paid compensation vs. banking reserve holiday days when working official holidays.',
  },

  // Quotes Tracker Features
  {
    key: 'quick_import',
    label: 'Bulk Quick Import',
    description: 'The Bulk Import / Quick Paste modal for multi-line text paste and file auto-detection in Daily Entry.',
  },
  {
    key: 'custom_entry',
    label: 'Custom Quote Entry',
    description: 'The Custom Entry modal for adding historical/backdated quote records.',
  },
  {
    key: 'copy_helper_save_file',
    label: 'Copy Helper Save File',
    description: 'The direct Word document file saving helper inside the Copy Helper panel.',
  },
  {
    key: 'copy_helper_admin_summary',
    label: 'Copy Helper Admin Sales Summary',
    description: 'The deduplicated daily Sales Report for Admin summary box in Copy Helper.',
  },
  {
    key: 'causality_generator',
    label: 'Causality Document Generator',
    description: 'Generating causality breakdown and compliance text templates.',
  },

  // Leaderboard & Reports Features
  {
    key: 'yearly_leaderboard',
    label: 'Yearly Leaderboard',
    description: 'The Monthly/Yearly period view toggle on the leaderboard table.',
  },
  {
    key: 'csv_export',
    label: 'Leaderboard & Reports CSV Export',
    description: 'The Export to Excel/CSV button on leaderboard tables and reports.',
  },
  {
    key: 'reports_analytics',
    label: 'Advanced Performance Analytics',
    description: 'Detailed analytics charts and visual metrics in Reports and User Profile dashboards.',
  },

  // System & Management Features
  {
    key: 'bd_clock',
    label: 'Navbar BD Clock',
    description: 'The Bangladesh (BD) live clock display in the top navbar header.',
  },
  {
    key: 'uk_clock',
    label: 'Navbar UK Clock',
    description: 'The United Kingdom (UK) live clock display with automatic DST in the top navbar header.',
  },
  {
    key: 'todo_management',
    label: 'Todos & Task Management',
    description: 'Creating, assigning, and managing task todos in the Todos Panel.',
  },
  {
    key: 'audit_logs_inspection',
    label: 'Security Audit Logs Inspection',
    description: 'Inspecting system security, user activity, and admin audit log entries.',
  },

  // User Profile Sections Features
  {
    key: 'user_profile_leave_workspace',
    label: 'Leave Tracker Workspace',
    description: 'Global toggle for Leave Tracker Workspace card on staff profiles.',
  },
  {
    key: 'user_profile_quotes_workspace',
    label: 'Quotes Manager Workspace',
    description: 'Global toggle for Quotes Manager Workspace card on staff profiles.',
  },
  {
    key: 'user_profile_kpi_settings',
    label: 'KPI & Performance Settings',
    description: 'Global toggle for KPI & Performance Settings card on staff profiles.',
  },
  {
    key: 'user_profile_change_password_feature',
    label: 'Change Password',
    description: 'Global toggle for Change Password? section on staff profiles.',
  },
];

/** Default state for a feature flag when no explicit superadmin toggle exists. */
export const getDefaultFeatureFlagState = (flagKey: string): boolean => {
  switch (flagKey) {
    case 'todo_management':
    case 'audit_logs_inspection':
    case 'copy_helper_save_file':
    case 'copy_helper_admin_summary':
      return false;
    default:
      return true;
  }
};

/** Mapping between feature flags and corresponding Tab Access keys. */
export const FLAG_TO_TAB_KEY: Record<string, string> = {
  todo_management: 'todo',
  audit_logs_inspection: 'audit_logs',
  copy_helper_save_file: 'save_file',
  causality_generator: 'causality',
  yearly_leaderboard: 'leaderboard',
  quick_import: 'quick_import',
  custom_entry: 'custom_entry',
  bd_clock: 'bd_clock',
  uk_clock: 'uk_clock',
  user_profile_leave_workspace: 'user_profile_leave',
  user_profile_quotes_workspace: 'user_profile_quotes',
  user_profile_kpi_settings: 'user_profile_kpi',
  user_profile_change_password_feature: 'user_profile_change_password',
};
