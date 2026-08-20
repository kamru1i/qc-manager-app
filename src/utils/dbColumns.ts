/**
 * Explicit column lists for Supabase selects (C4 — no select('*')).
 *
 * SOURCE OF TRUTH: src/types/database.types.ts, generated read-only from the
 * live DB via `supabase gen types typescript --linked`. Do NOT derive columns
 * from supabase/schema.sql (known stale) or the TS interfaces in src/types
 * (they mix client-only and join-derived fields).
 *
 * NOTE: these must stay single string literals (not array.join) — supabase-js
 * parses the select string at the type level and needs a literal type.
 *
 * If a query needs a new column after a migration, regenerate the types file
 * first, then add the column here.
 */

// All live columns — full row is genuinely consumed by profile settings forms,
// permission checks, and global_settings (badges / sessions / password_reset_status).
export const PROFILE_COLUMNS =
  'id, username, full_name, role, job_role, created_at, global_settings, allowed_types, allow_overtime, allow_reserve, break_time, can_manage_rules, converted_short_leaves_days, converted_short_leaves_hours, default_sign_in, default_sign_out, delegated_kpi_supervisor_id, delegated_leave_supervisor_id, delegated_supervisor_id, eligible_govt_holiday, eligible_office_leave, has_changed_password, has_chuti_access, has_edited_profile, has_quotes_access, is_setup_completed, max_full_leaves, max_short_leaves, needs_supervisor_approval, profile_change_status, quotes_role, requested_break_time, requested_default_sign_in, requested_default_sign_out, requested_full_name, requested_job_role, requested_working_hours, supervisor_ids, username_changes, username_request_status, working_hours';

export const RECORD_COLUMNS =
  'id, user_id, file_name, branch_name, codename, file_type, submitted_at, created_at, updated_at';

export const CHUTI_COLUMNS =
  'id, user_id, date, leave_type, status, leave_hour, sign_in_time, sign_out_time, comment, adjustment, adjust_short_leave, adjusted_hour, admin_edit_request, admin_edit_status, bulk_id, is_edited, reserve_adjustment_status, reserve_holiday, deleted_at, created_at, updated_at';

export const GOVT_HOLIDAY_RESPONSE_COLUMNS =
  'id, user_id, holiday_date, holiday_name, response, updated_by_admin, created_at, updated_at';

export const LEAVE_SETTLEMENT_COLUMNS =
  'id, user_id, action_type, action_by, adjust_leave_days, carry_forward_days, leave_category, payment_days, period, processed_at, processed_by, remaining_days, status, year, created_at';

export const KPI_ASSESSMENT_COLUMNS =
  'id, user_id, month_year, kpis, emp_id, department, date_of_joining, appraiser_name, reviewer_name, appraisee_signed, appraisee_sign_date, appraiser_signed, appraiser_sign_date, created_at, updated_at';

export const AUDIT_LOG_COLUMNS =
  'id, actor_id, actor_codename, action_type, target_id, details, created_at';

export const TODO_COLUMNS =
  'id, user_id, codename, task, todo_date, status, comment, is_all_time, created_at, last_activity_at';

export const LOGIN_CODE_COLUMNS = 'login_id, code, name, updated_at';

export const COMPLIANCE_RULE_COLUMNS =
  'id, category, sub_category, company_name, company_tags, title, content, extra_info, is_deleted, created_at, updated_at, updated_by';

export const LEADERBOARD_ARCHIVE_COLUMNS =
  'user_id, username, full_name, job_role, branch, year, quotes_count, requotes_count, reviews_count, sales_count, total_submitted, rank';

export const QUOTATION_MISTAKE_COLUMNS =
  'id, date, filename, branch, user_id, codename, mistake_details, penalty, created_by, updated_by, created_at, updated_at';

export const ATTENDANCE_DAILY_COLUMNS =
  'id, user_id, attendance_date, join_time, close_time, status, total_work_minutes, total_break_minutes, total_prayer_minutes, created_at, updated_at';

export const ATTENDANCE_SHIFT_COLUMNS =
  'id, attendance_id, user_id, attendance_date, join_time, close_time, duration_seconds, created_at, updated_at';

export const ATTENDANCE_BREAK_COLUMNS =
  'id, attendance_id, shift_id, user_id, attendance_date, type, start_time, end_time, duration_minutes, created_at, updated_at';

