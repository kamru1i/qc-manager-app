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
    key: 'todo_management',
    label: 'Todos & Task Management',
    description: 'Creating, assigning, and managing task todos in the Todos Panel.',
  },
  {
    key: 'audit_logs_inspection',
    label: 'Security Audit Logs Inspection',
    description: 'Inspecting system security, user activity, and admin audit log entries.',
  },
];
