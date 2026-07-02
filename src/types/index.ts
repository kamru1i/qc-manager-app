import { ChutiRecord } from '@/utils/offlineSync';

export interface Profile {
  id: string;
  username: string;
  role: 'admin' | 'supervisor' | 'user';
  username_changes?: number;
  username_request_status?: 'none' | 'pending' | 'approved';
  full_name?: string | null;
  working_hours?: number;
  break_time?: number;
  is_setup_completed?: boolean;
  job_role?: string | null;
  requested_full_name?: string | null;
  requested_working_hours?: number | null;
  requested_break_time?: number | null;
  requested_job_role?: string | null;
  profile_change_status?: 'none' | 'pending' | 'approved' | 'rejected';
  default_sign_in?: string | null;
  default_sign_out?: string | null;
  requested_default_sign_in?: string | null;
  requested_default_sign_out?: string | null;
  needs_supervisor_approval?: boolean;
  allow_reserve?: boolean;
  allow_overtime?: boolean;
  has_edited_profile?: boolean;
  has_changed_password?: boolean;
  max_full_leaves?: number;
  max_short_leaves?: number;
  eligible_office_leave?: boolean;
  eligible_govt_holiday?: boolean;
  converted_short_leaves_days?: number;
  converted_short_leaves_hours?: number;
  global_settings?: any;
  supervisor_ids?: string[] | null;
  password_reset_status?: 'none' | 'pending' | 'approved' | 'rejected';
  
  // Quotes & Sales Tracker Integration
  allowed_types?: string[];
  quotes_role?: 'admin' | 'user';
  can_manage_rules?: boolean;
  has_chuti_access?: boolean;
  has_quotes_access?: boolean;
}

export interface ChutiRecordWithProfile extends ChutiRecord {
  id: string;
  profiles?: {
    username: string;
  } | null;
}

export interface BulkRepresentative extends ChutiRecordWithProfile {
  is_bulk?: boolean;
  all_bulk_dates?: string[];
  all_bulk_ids?: string[];
  all_bulk_records?: ChutiRecordWithProfile[];
  formatted_bulk_dates?: string;
}

export interface GovtHolidayResponse {
  id: string;
  user_id: string;
  holiday_date: string;
  holiday_name: string;
  response: 'paid' | 'reserve';
  created_at?: string;
  profiles?: {
    full_name: string | null;
    username: string;
  } | null;
}

export interface LeaveSettlement {
  id: string;
  user_id: string;
  year: string;
  period: 'H1' | 'H2' | 'Instant';
  leave_category: 'Govt Holiday' | 'Eid-ul-Fitr' | 'Eid-ul-Adha' | 'Office Leave';
  remaining_days: number;
  action_type: 'carry_forward' | 'payment' | 'adjust_leave' | 'split';
  status: 'initiated' | 'responded' | 'processed';
  processed_by?: string | null;
  processed_at?: string | null;
  action_by?: string | null;
  created_at?: string;
  carry_forward_days?: number;
  payment_days?: number;
  adjust_leave_days?: number;
  profiles?: {
    full_name: string | null;
    username: string;
  } | null;
}

export type FileType = 'Quote' | 'Requote' | 'Requote Van' | 'Requote Bike' | 'Review' | 'Review Van' | 'Review Bike' | 'Individual Review' | 'Other Site' | 'Van' | 'Bike' | 'Sale';

export interface RecordItem {
  id: string;
  user_id: string;
  file_name: string;
  branch_name: string;
  codename: string;
  file_type: FileType;
  submitted_at: string;
  created_at: string;
  profiles?: {
    username: string;
    full_name: string | null;
  } | null;
}

export interface AuditLogItem {
  id: string;
  actor_id: string | null;
  actor_codename: string;
  action_type: string;
  target_id: string | null;
  details: string;
  created_at: string;
}

export interface ComplianceRule {
  id: string;
  category: 'announcement' | 'fine' | 'universal' | 'company';
  sub_category: 'nby_rule' | 'general_pricing' | 'employment' | 'driver_and_usage' | 'license_and_residency' | 'file_processing' | 'branch_priority' | 'doc_extensions' | 'common_rules';
  company_name: string | null;
  company_tags: string[] | null;
  title: string | null;
  content: string;
  extra_info: string | null;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
  profiles?: {
    username: string;
    full_name: string | null;
  } | null;
}

export interface RuleHistory {
  id: string;
  rule_id: string;
  category: string;
  sub_category: string;
  company_name: string | null;
  company_tags: string[] | null;
  title: string | null;
  content: string;
  extra_info: string | null;
  action_type: 'INSERT' | 'UPDATE' | 'DELETE';
  archived_at: string;
  archived_by: string | null;
  profiles?: {
    username: string;
    full_name: string | null;
  } | null;
}

export interface SavedDocument {
  id: string;
  filename: string;
  filePath: string;
  htmlContent: string;
  recordId: string;
  savedAt: string;
}

export interface LoginCode {
  login_id: string;
  code: string;
  name?: string | null;
  updated_at?: string;
}

export interface TodoItem {
  id: string;
  user_id: string;
  codename: string;
  task: string;
  status: 'Working' | 'Completed' | 'Idle';
  comment?: string | null;
  todo_date: string; // Format: 'YYYY-MM-DD'
  is_all_time: boolean;
  created_at: string;
}
