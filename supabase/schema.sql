--
-- PostgreSQL database dump
--

\restrict Ljbuwue4xcOSSc8Ga8MY5QHbZMSZWtpWfgrISg0IHd4hASKBk2tkO8m250nGABa

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

DROP POLICY IF EXISTS "Users can update own settlements" ON public.leave_settlements;
DROP POLICY IF EXISTS "Users can update own holiday responses" ON public.govt_holiday_responses;
DROP POLICY IF EXISTS "Users can read own settlements" ON public.leave_settlements;
DROP POLICY IF EXISTS "Users can read own holiday responses" ON public.govt_holiday_responses;
DROP POLICY IF EXISTS "Users can read own dismissed notifications" ON public.dismissed_notifications;
DROP POLICY IF EXISTS "Users can insert own settlements" ON public.leave_settlements;
DROP POLICY IF EXISTS "Users can insert own holiday responses" ON public.govt_holiday_responses;
DROP POLICY IF EXISTS "Users can insert own dismissed notifications" ON public.dismissed_notifications;
DROP POLICY IF EXISTS "Users can delete own dismissed notifications" ON public.dismissed_notifications;
DROP POLICY IF EXISTS "Authenticated users can read leaderboard archive" ON public.leaderboard_archive;
DROP POLICY IF EXISTS "Allow users to update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Allow users to update their own chuti" ON public.chuti;
DROP POLICY IF EXISTS "Allow users to update own todos" ON public.todos;
DROP POLICY IF EXISTS "Allow users to update own records, admins/supervisors update al" ON public.records;
DROP POLICY IF EXISTS "Allow users to read their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Allow users to read their own chuti" ON public.chuti;
DROP POLICY IF EXISTS "Allow users to read own todos" ON public.todos;
DROP POLICY IF EXISTS "Allow users to read own records, admins/supervisors read all" ON public.records;
DROP POLICY IF EXISTS "Allow users to insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Allow users to insert their own chuti" ON public.chuti;
DROP POLICY IF EXISTS "Allow users to insert own todos" ON public.todos;
DROP POLICY IF EXISTS "Allow users to insert own records, admins/supervisors insert al" ON public.records;
DROP POLICY IF EXISTS "Allow users to delete their own chuti" ON public.chuti;
DROP POLICY IF EXISTS "Allow users to delete own todos" ON public.todos;
DROP POLICY IF EXISTS "Allow users to delete own records, admins/supervisors delete al" ON public.records;
DROP POLICY IF EXISTS "Allow supervisors to update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow supervisors to update chuti status" ON public.chuti;
DROP POLICY IF EXISTS "Allow supervisors to insert chuti for supervised users" ON public.chuti;
DROP POLICY IF EXISTS "Allow supervisors to delete chuti" ON public.chuti;
DROP POLICY IF EXISTS "Allow supervisor to read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow select for owner, admin, or assigned supervisor" ON public.kpi_assessments;
DROP POLICY IF EXISTS "Allow public read access to mobile_app_versions" ON public.mobile_app_versions;
DROP POLICY IF EXISTS "Allow insert/update/delete for owner, admin, or assigned superv" ON public.kpi_assessments;
DROP POLICY IF EXISTS "Allow authenticated users to read supervisor profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow authenticated users to insert audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Allow authenticated to read login codes" ON public.login_codes;
DROP POLICY IF EXISTS "Allow authenticated to read compliance rules" ON public.compliance_rules;
DROP POLICY IF EXISTS "Allow admins, supervisors or authorized editors to update rules" ON public.compliance_rules;
DROP POLICY IF EXISTS "Allow admins, supervisors or authorized editors to insert rules" ON public.compliance_rules;
DROP POLICY IF EXISTS "Allow admins, supervisors or authorized editors to delete rules" ON public.compliance_rules;
DROP POLICY IF EXISTS "Allow admins to update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow admins to update all chuti" ON public.chuti;
DROP POLICY IF EXISTS "Allow admins to read all audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Allow admins to insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow admins to insert chuti for all users" ON public.chuti;
DROP POLICY IF EXISTS "Allow admins to delete profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow admins to delete chuti" ON public.chuti;
DROP POLICY IF EXISTS "Allow admins & supervisors to manage login codes" ON public.login_codes;
DROP POLICY IF EXISTS "Allow admin/supervisor to read all chuti" ON public.chuti;
DROP POLICY IF EXISTS "Allow admin to read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins/supervisors can manage settlements" ON public.leave_settlements;
DROP POLICY IF EXISTS "Admins can update/delete responses" ON public.govt_holiday_responses;
DROP POLICY IF EXISTS "Admins can read all holiday responses" ON public.govt_holiday_responses;
DROP POLICY IF EXISTS "Admins can do everything on dismissed notifications" ON public.dismissed_notifications;
ALTER TABLE IF EXISTS ONLY public.todos DROP CONSTRAINT IF EXISTS todos_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.records DROP CONSTRAINT IF EXISTS records_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
ALTER TABLE IF EXISTS ONLY public.profiles DROP CONSTRAINT IF EXISTS profiles_delegated_supervisor_id_fkey;
ALTER TABLE IF EXISTS ONLY public.profiles DROP CONSTRAINT IF EXISTS profiles_delegated_leave_supervisor_id_fkey;
ALTER TABLE IF EXISTS ONLY public.profiles DROP CONSTRAINT IF EXISTS profiles_delegated_kpi_supervisor_id_fkey;
ALTER TABLE IF EXISTS ONLY public.leave_settlements DROP CONSTRAINT IF EXISTS leave_settlements_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.leave_settlements DROP CONSTRAINT IF EXISTS leave_settlements_processed_by_fkey;
ALTER TABLE IF EXISTS ONLY public.leave_settlements DROP CONSTRAINT IF EXISTS leave_settlements_action_by_fkey;
ALTER TABLE IF EXISTS ONLY public.leaderboard_archive DROP CONSTRAINT IF EXISTS leaderboard_archive_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.kpi_assessments DROP CONSTRAINT IF EXISTS kpi_assessments_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.govt_holiday_responses DROP CONSTRAINT IF EXISTS govt_holiday_responses_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.dismissed_notifications DROP CONSTRAINT IF EXISTS dismissed_notifications_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.compliance_rules DROP CONSTRAINT IF EXISTS compliance_rules_updated_by_fkey;
ALTER TABLE IF EXISTS ONLY public.chuti DROP CONSTRAINT IF EXISTS chuti_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_actor_id_fkey;
DROP TRIGGER IF EXISTS trg_update_compliance_rules_updated_at ON public.compliance_rules;
DROP TRIGGER IF EXISTS todos_set_last_activity ON public.todos;
DROP TRIGGER IF EXISTS records_set_updated_at ON public.records;
DROP TRIGGER IF EXISTS on_profile_update_security ON public.profiles;
DROP TRIGGER IF EXISTS on_profile_role_update ON public.profiles;
DROP TRIGGER IF EXISTS chuti_set_updated_at ON public.chuti;
DROP INDEX IF EXISTS public.uq_records_user_file_submitted;
DROP INDEX IF EXISTS public.unique_user_date;
DROP INDEX IF EXISTS public.idx_todos_user_id;
DROP INDEX IF EXISTS public.idx_todos_todo_date;
DROP INDEX IF EXISTS public.idx_todos_last_activity;
DROP INDEX IF EXISTS public.idx_records_user_submitted;
DROP INDEX IF EXISTS public.idx_records_user_id;
DROP INDEX IF EXISTS public.idx_records_updated_at;
DROP INDEX IF EXISTS public.idx_records_sale_submitted;
DROP INDEX IF EXISTS public.idx_leave_settlements_user_year;
DROP INDEX IF EXISTS public.idx_leaderboard_archive_year;
DROP INDEX IF EXISTS public.idx_chuti_user_date;
DROP INDEX IF EXISTS public.idx_chuti_updated_at;
DROP INDEX IF EXISTS public.idx_chuti_deleted_at;
DROP INDEX IF EXISTS public.idx_chuti_bulk_id;
DROP INDEX IF EXISTS public.idx_audit_logs_created_at;
DROP INDEX IF EXISTS public.idx_audit_logs_created;
DROP INDEX IF EXISTS public.idx_audit_logs_actor_id;
ALTER TABLE IF EXISTS ONLY public.leave_settlements DROP CONSTRAINT IF EXISTS unique_user_year_period_category;
ALTER TABLE IF EXISTS ONLY public.dismissed_notifications DROP CONSTRAINT IF EXISTS unique_user_notification;
ALTER TABLE IF EXISTS ONLY public.govt_holiday_responses DROP CONSTRAINT IF EXISTS unique_user_holiday;
ALTER TABLE IF EXISTS ONLY public.todos DROP CONSTRAINT IF EXISTS todos_pkey;
ALTER TABLE IF EXISTS ONLY public.records DROP CONSTRAINT IF EXISTS records_pkey;
ALTER TABLE IF EXISTS ONLY public.profiles DROP CONSTRAINT IF EXISTS profiles_username_key;
ALTER TABLE IF EXISTS ONLY public.profiles DROP CONSTRAINT IF EXISTS profiles_pkey;
ALTER TABLE IF EXISTS ONLY public.mobile_app_versions DROP CONSTRAINT IF EXISTS mobile_app_versions_pkey;
ALTER TABLE IF EXISTS ONLY public.login_codes DROP CONSTRAINT IF EXISTS login_codes_pkey;
ALTER TABLE IF EXISTS ONLY public.leave_settlements DROP CONSTRAINT IF EXISTS leave_settlements_pkey;
ALTER TABLE IF EXISTS ONLY public.leaderboard_archive DROP CONSTRAINT IF EXISTS leaderboard_archive_username_year_unique;
ALTER TABLE IF EXISTS ONLY public.leaderboard_archive DROP CONSTRAINT IF EXISTS leaderboard_archive_pkey;
ALTER TABLE IF EXISTS ONLY public.kpi_assessments DROP CONSTRAINT IF EXISTS kpi_assessments_user_id_month_year_key;
ALTER TABLE IF EXISTS ONLY public.kpi_assessments DROP CONSTRAINT IF EXISTS kpi_assessments_pkey;
ALTER TABLE IF EXISTS ONLY public.govt_holiday_responses DROP CONSTRAINT IF EXISTS govt_holiday_responses_pkey;
ALTER TABLE IF EXISTS ONLY public.dismissed_notifications DROP CONSTRAINT IF EXISTS dismissed_notifications_pkey;
ALTER TABLE IF EXISTS ONLY public.compliance_rules DROP CONSTRAINT IF EXISTS compliance_rules_pkey;
ALTER TABLE IF EXISTS ONLY public.chuti DROP CONSTRAINT IF EXISTS chuti_pkey;
ALTER TABLE IF EXISTS ONLY public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_pkey;
ALTER TABLE IF EXISTS public.mobile_app_versions ALTER COLUMN id DROP DEFAULT;
DROP TABLE IF EXISTS public.todos;
DROP TABLE IF EXISTS public.records;
DROP TABLE IF EXISTS public.profiles;
DROP SEQUENCE IF EXISTS public.mobile_app_versions_id_seq;
DROP TABLE IF EXISTS public.mobile_app_versions;
DROP TABLE IF EXISTS public.login_codes;
DROP TABLE IF EXISTS public.leave_settlements;
DROP TABLE IF EXISTS public.leaderboard_archive;
DROP TABLE IF EXISTS public.kpi_assessments;
DROP TABLE IF EXISTS public.govt_holiday_responses;
DROP TABLE IF EXISTS public.dismissed_notifications;
DROP TABLE IF EXISTS public.compliance_rules;
DROP TABLE IF EXISTS public.chuti;
DROP TABLE IF EXISTS public.audit_logs;
DROP FUNCTION IF EXISTS public.update_todos_last_activity();
DROP FUNCTION IF EXISTS public.update_records_updated_at();
DROP FUNCTION IF EXISTS public.update_compliance_rules_updated_at();
DROP FUNCTION IF EXISTS public.update_chuti_updated_at();
DROP FUNCTION IF EXISTS public.sync_top_performer_badges();
DROP FUNCTION IF EXISTS public.set_user_vpn_list(p_vpn_list jsonb);
DROP FUNCTION IF EXISTS public.set_user_hidden_tabs(p_user_id uuid, p_hidden_tabs jsonb);
DROP FUNCTION IF EXISTS public.set_temp_access(p_entries jsonb);
DROP FUNCTION IF EXISTS public.set_sanitizer_words(p_words text[]);
DROP FUNCTION IF EXISTS public.set_sanitizer_rules(p_rules jsonb);
DROP FUNCTION IF EXISTS public.set_role_visibility(p_visibility jsonb);
DROP FUNCTION IF EXISTS public.set_feature_flags(p_flags jsonb);
DROP FUNCTION IF EXISTS public.set_admin_delegated_flags(p_flags jsonb);
DROP FUNCTION IF EXISTS public.is_user_in_top_5_for_month(p_user_id uuid, p_year integer, p_month integer);
DROP FUNCTION IF EXISTS public.is_supervisor_of(supervisor_id uuid, employee_id uuid);
DROP FUNCTION IF EXISTS public.is_supervisor();
DROP FUNCTION IF EXISTS public.is_superadmin();
DROP FUNCTION IF EXISTS public.is_admin_or_supervisor();
DROP FUNCTION IF EXISTS public.is_admin();
DROP FUNCTION IF EXISTS public.has_leave_access(supervisor_id uuid, employee_id uuid);
DROP FUNCTION IF EXISTS public.has_kpi_access(supervisor_id uuid, employee_id uuid);
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.get_user_email_by_username(p_username text);
DROP FUNCTION IF EXISTS public.get_leaderboard_data(p_year text, p_month text, p_period text, p_today text, p_tz text);
DROP FUNCTION IF EXISTS public.get_admin_sales_summary(p_today text, p_tz text);
DROP FUNCTION IF EXISTS public.delete_user_by_id(p_user_id uuid);
DROP FUNCTION IF EXISTS public.create_new_user(p_email text, p_password text, p_username text, p_role text, p_full_name text, p_needs_supervisor_approval boolean, p_allow_reserve boolean, p_allow_overtime boolean, p_supervisor_ids uuid[]);
DROP FUNCTION IF EXISTS public.complete_profile_setup(p_username text, p_full_name text);
DROP FUNCTION IF EXISTS public.cleanup_old_audit_logs();
DROP FUNCTION IF EXISTS public.check_profile_updates();
DROP FUNCTION IF EXISTS public.check_profile_role_change();
DROP FUNCTION IF EXISTS public.archive_and_prune_old_records(p_tz text);
DROP FUNCTION IF EXISTS public.admin_update_user_credentials(p_user_id uuid, p_new_username text, p_new_password text);
DROP FUNCTION IF EXISTS public.admin_insert_chuti_records_bulk(p_user_id uuid, p_dates date[], p_leave_type text, p_adjustments boolean[], p_adjust_short_leave boolean, p_sign_in_time time without time zone, p_sign_out_time time without time zone, p_leave_hour interval, p_reserve_holiday text, p_comment text, p_bulk_id uuid);
DROP SCHEMA IF EXISTS public;
--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: admin_insert_chuti_records_bulk(uuid, date[], text, boolean[], boolean, time without time zone, time without time zone, interval, text, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_insert_chuti_records_bulk(p_user_id uuid, p_dates date[], p_leave_type text, p_adjustments boolean[], p_adjust_short_leave boolean, p_sign_in_time time without time zone DEFAULT NULL::time without time zone, p_sign_out_time time without time zone DEFAULT NULL::time without time zone, p_leave_hour interval DEFAULT NULL::interval, p_reserve_holiday text DEFAULT NULL::text, p_comment text DEFAULT NULL::text, p_bulk_id uuid DEFAULT NULL::uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_date DATE;
  v_idx INT := 1;
  v_adjustment BOOLEAN;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can insert chuti records for other users';
  END IF;

  FOREACH v_date IN ARRAY p_dates LOOP
    v_adjustment := p_adjustments[v_idx];
    INSERT INTO public.chuti (
      user_id,
      date,
      leave_type,
      adjustment,
      adjust_short_leave,
      sign_in_time,
      sign_out_time,
      leave_hour,
      reserve_holiday,
      reserve_adjustment_status,
      status,
      comment,
      bulk_id
    )
    VALUES (
      p_user_id,
      v_date,
      p_leave_type,
      v_adjustment,
      CASE WHEN p_leave_type = 'Overtime' AND v_adjustment THEN p_adjust_short_leave ELSE false END,
      p_sign_in_time,
      p_sign_out_time,
      p_leave_hour,
      p_reserve_holiday,
      'none'::TEXT,
      'approved', -- Admin added records are auto-approved
      p_comment,
      p_bulk_id
    );
    v_idx := v_idx + 1;
  END LOOP;
END;
$$;


--
-- Name: admin_update_user_credentials(uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_update_user_credentials(p_user_id uuid, p_new_username text DEFAULT NULL::text, p_new_password text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions', 'pg_temp'
    AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can update credentials';
  END IF;

  -- Update username in profiles if provided
  IF p_new_username IS NOT NULL AND p_new_username != '' THEN
    UPDATE public.profiles SET username = UPPER(p_new_username) WHERE id = p_user_id;
  END IF;

  -- Update password in auth.users if provided
  IF p_new_password IS NOT NULL AND p_new_password != '' THEN
    UPDATE auth.users
    SET encrypted_password = crypt(p_new_password, gen_salt('bf')),
        updated_at = NOW()
    WHERE id = p_user_id;
  END IF;
END;
$$;


--
-- Name: archive_and_prune_old_records(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.archive_and_prune_old_records(p_tz text DEFAULT 'Asia/Dhaka'::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_current_year INT := EXTRACT(YEAR FROM timezone(p_tz, now()))::INT;
  v_year INT;
  v_archived_users INT;
  v_deleted INT;
  v_total_deleted INT := 0;
  v_years_archived INT[] := '{}';
  v_purged INT;
BEGIN
  FOR v_year IN
    SELECT DISTINCT EXTRACT(YEAR FROM timezone(p_tz, r.submitted_at))::INT
    FROM public.records r
    WHERE EXTRACT(YEAR FROM timezone(p_tz, r.submitted_at))::INT < v_current_year - 2
    ORDER BY 1
  LOOP
    -- Snapshot the year's leaderboard (only users who actually submitted).
    -- Re-runs refresh the row — safe because the year's records are always
    -- complete at this point (deletion happens below in the same transaction).
    INSERT INTO public.leaderboard_archive
      (user_id, username, full_name, job_role, branch, year,
       quotes_count, requotes_count, reviews_count, sales_count,
       total_submitted, rank)
    WITH year_stats AS (
      SELECT
        r.user_id,
        COUNT(*)::INT AS total_submitted,
        COUNT(*) FILTER (WHERE r.file_type = 'Quote')::INT AS quotes_count,
        COUNT(*) FILTER (WHERE r.file_type IN ('Requote', 'Requote Van', 'Requote Bike'))::INT AS requotes_count,
        COUNT(*) FILTER (WHERE r.file_type LIKE '%Review%')::INT AS reviews_count,
        COUNT(*) FILTER (WHERE r.file_type = 'Sale')::INT AS sales_count
      FROM public.records r
      WHERE EXTRACT(YEAR FROM timezone(p_tz, r.submitted_at))::INT = v_year
      GROUP BY r.user_id
    ),
    user_branches AS (
      SELECT DISTINCT ON (b.user_id)
        b.user_id,
        b.branch_name
      FROM (
        SELECT
          r2.user_id,
          r2.branch_name,
          COUNT(*) AS branch_cnt,
          MAX(r2.submitted_at) AS branch_latest
        FROM public.records r2
        WHERE EXTRACT(YEAR FROM timezone(p_tz, r2.submitted_at))::INT = v_year
        GROUP BY r2.user_id, r2.branch_name
      ) b
      ORDER BY b.user_id, b.branch_cnt DESC, b.branch_latest DESC
    )
    SELECT
      ys.user_id,
      COALESCE(p.username, ys.user_id::text) AS username,
      p.full_name,
      p.job_role,
      ub.branch_name,
      v_year,
      ys.quotes_count,
      ys.requotes_count,
      ys.reviews_count,
      ys.sales_count,
      ys.total_submitted,
      DENSE_RANK() OVER (
        ORDER BY ys.total_submitted DESC, COALESCE(p.username, ys.user_id::text) ASC
      )::INT AS rank
    FROM year_stats ys
    LEFT JOIN public.profiles p ON p.id = ys.user_id
    LEFT JOIN user_branches ub ON ub.user_id = ys.user_id
    ON CONFLICT (username, year) DO UPDATE SET
      user_id = EXCLUDED.user_id,
      full_name = EXCLUDED.full_name,
      job_role = EXCLUDED.job_role,
      branch = EXCLUDED.branch,
      quotes_count = EXCLUDED.quotes_count,
      requotes_count = EXCLUDED.requotes_count,
      reviews_count = EXCLUDED.reviews_count,
      sales_count = EXCLUDED.sales_count,
      total_submitted = EXCLUDED.total_submitted,
      rank = EXCLUDED.rank,
      archived_at = timezone('utc'::text, now());

    GET DIAGNOSTICS v_archived_users = ROW_COUNT;

    -- Delete the archived year's records (all guaranteed older than 2 years)
    DELETE FROM public.records r
    WHERE EXTRACT(YEAR FROM timezone(p_tz, r.submitted_at))::INT = v_year;
    GET DIAGNOSTICS v_deleted = ROW_COUNT;

    v_total_deleted := v_total_deleted + v_deleted;
    v_years_archived := v_years_archived || v_year;

    RAISE NOTICE 'Archived year %: % users snapshotted, % records deleted',
      v_year, v_archived_users, v_deleted;
  END LOOP;

  -- Purge archive snapshots once the data year is older than 5 years
  DELETE FROM public.leaderboard_archive WHERE year < v_current_year - 5;
  GET DIAGNOSTICS v_purged = ROW_COUNT;

  RETURN jsonb_build_object(
    'years_archived', to_jsonb(v_years_archived),
    'records_deleted', v_total_deleted,
    'archive_rows_purged', v_purged,
    'run_at', timezone('utc'::text, now())
  );
END;
$$;


--
-- Name: check_profile_role_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_profile_role_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  -- service_role (API routes / system / migrations) bypasses.
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF OLD.role IS DISTINCT FROM NEW.role THEN
    -- Must be admin OR superadmin to change any role at all.
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
    ) THEN
      RAISE EXCEPTION 'You are not allowed to change your role.';
    END IF;

    -- Touching an admin/superadmin role in EITHER direction requires superadmin.
    IF (NEW.role IN ('admin', 'superadmin') OR OLD.role IN ('admin', 'superadmin'))
       AND NOT EXISTS (
         SELECT 1 FROM public.profiles
         WHERE id = auth.uid() AND role = 'superadmin'
       ) THEN
      RAISE EXCEPTION 'Only a superadmin can create, promote, or demote admin/superadmin accounts.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: check_profile_updates(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_profile_updates() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  -- If the session bypass variable is set, allow the update (system functions/syncs)
  IF current_setting('app.bypass_profile_security', true) = 'true' THEN
    RETURN NEW;
  END IF;

  -- If the editor is the service_role (API routes / system), allow everything
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- If the editor is an admin or superadmin, allow everything
  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
  ) THEN
    RETURN NEW;
  END IF;

  -- If the editor is a supervisor
  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'supervisor'
  ) THEN
    -- If editing self, allow everything
    IF auth.uid() = NEW.id THEN
      RETURN NEW;
    END IF;

    -- If editing an employee they directly supervise, enforce key constraints (prevent privilege escalation/sensitive settings modification)
    IF auth.uid() = ANY(NEW.supervisor_ids) OR auth.uid() = ANY(OLD.supervisor_ids) THEN
      IF OLD.role IS DISTINCT FROM NEW.role OR
         OLD.has_chuti_access IS DISTINCT FROM NEW.has_chuti_access OR
         OLD.has_quotes_access IS DISTINCT FROM NEW.has_quotes_access OR
         OLD.can_manage_rules IS DISTINCT FROM NEW.can_manage_rules OR
         OLD.supervisor_ids IS DISTINCT FROM NEW.supervisor_ids OR
         (NEW.global_settings->>'office_leave_default') IS DISTINCT FROM (OLD.global_settings->>'office_leave_default') OR
         (NEW.global_settings->>'eid_fitr_leave') IS DISTINCT FROM (OLD.global_settings->>'eid_fitr_leave') OR
         (NEW.global_settings->>'eid_adha_leave') IS DISTINCT FROM (OLD.global_settings->>'eid_adha_leave') OR
         (NEW.global_settings->>'govt_holidays') IS DISTINCT FROM (OLD.global_settings->>'govt_holidays') OR
         (NEW.global_settings->>'password_reset_status') IS DISTINCT FROM (OLD.global_settings->>'password_reset_status')
      THEN
        RAISE EXCEPTION 'Supervisors cannot modify roles, supervisor assignments, access permissions, or sensitive global leave settings for their team members.';
      END IF;
      RETURN NEW;
    END IF;

    -- If editing an employee they do NOT supervise, enforce column constraints
    IF OLD.role IS DISTINCT FROM NEW.role OR
       OLD.has_chuti_access IS DISTINCT FROM NEW.has_chuti_access OR
       OLD.has_quotes_access IS DISTINCT FROM NEW.has_quotes_access OR
       OLD.supervisor_ids IS DISTINCT FROM NEW.supervisor_ids OR
       OLD.delegated_supervisor_id IS DISTINCT FROM NEW.delegated_supervisor_id OR
       OLD.delegated_leave_supervisor_id IS DISTINCT FROM NEW.delegated_leave_supervisor_id OR
       OLD.delegated_kpi_supervisor_id IS DISTINCT FROM NEW.delegated_kpi_supervisor_id OR
       OLD.eligible_govt_holiday IS DISTINCT FROM NEW.eligible_govt_holiday OR
       OLD.eligible_office_leave IS DISTINCT FROM NEW.eligible_office_leave OR
       OLD.allow_overtime IS DISTINCT FROM NEW.allow_overtime OR
       OLD.allow_reserve IS DISTINCT FROM NEW.allow_reserve OR
       OLD.needs_supervisor_approval IS DISTINCT FROM NEW.needs_supervisor_approval OR
       OLD.global_settings IS DISTINCT FROM NEW.global_settings
    THEN
      RAISE EXCEPTION 'Supervisors can only modify basic settings (working hours, break time, default sign in/out, quotes allowed types) for users outside their team.';
    END IF;

    RETURN NEW;
  END IF;

  -- Default fallback: only allow users to edit self (non-supervisors)
  IF auth.uid() = NEW.id THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Unauthorized profile modification.';
END;
$$;


--
-- Name: cleanup_old_audit_logs(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_old_audit_logs() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  DELETE FROM public.audit_logs
  WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$;


--
-- Name: complete_profile_setup(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.complete_profile_setup(p_username text, p_full_name text) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Not authenticated.');
  END IF;

  IF p_username IS NULL OR length(trim(p_username)) = 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Username is required.');
  END IF;

  IF p_full_name IS NULL OR length(trim(p_full_name)) = 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Full name is required.');
  END IF;

  BEGIN
    UPDATE public.profiles
    SET username = upper(trim(p_username)),
        full_name = trim(p_full_name),
        has_changed_password = true
    WHERE id = v_uid;
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'message', 'This username is already taken. Please choose another.');
  END;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Profile not found.');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;


--
-- Name: create_new_user(text, text, text, text, text, boolean, boolean, boolean, uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_new_user(p_email text, p_password text, p_username text, p_role text, p_full_name text, p_needs_supervisor_approval boolean DEFAULT false, p_allow_reserve boolean DEFAULT false, p_allow_overtime boolean DEFAULT false, p_supervisor_ids uuid[] DEFAULT NULL::uuid[]) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions', 'pg_temp'
    AS $_$
DECLARE
  v_user_id UUID;
  v_sql TEXT;
  v_cols TEXT[] := ARRAY[]::TEXT[];
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can create users';
  END IF;

  -- Whitelist the role and enforce the creation hierarchy.
  IF p_role NOT IN ('user', 'supervisor', 'admin', 'superadmin') THEN
    RAISE EXCEPTION 'Invalid role: %', p_role;
  END IF;
  IF p_role IN ('admin', 'superadmin') AND NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'Only a superadmin can create admin or superadmin accounts.';
  END IF;

  -- Create user in auth.users
  v_user_id := extensions.uuid_generate_v4();

  -- Base columns that are guaranteed to exist in auth.users
  v_cols := ARRAY['id', 'instance_id', 'email', 'encrypted_password', 'email_confirmed_at', 'created_at', 'updated_at', 'raw_app_meta_data', 'raw_user_meta_data', 'aud', 'role'];

  -- Construct the SQL query dynamically
  v_sql := 'INSERT INTO auth.users (' || array_to_string(v_cols, ', ');

  -- Check and append optional columns if they exist in the schema
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'confirmation_token') THEN
    v_sql := v_sql || ', confirmation_token';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'recovery_token') THEN
    v_sql := v_sql || ', recovery_token';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'email_change_token_new') THEN
    v_sql := v_sql || ', email_change_token_new';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'email_change') THEN
    v_sql := v_sql || ', email_change';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'phone_change_token') THEN
    v_sql := v_sql || ', phone_change_token';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'email_change_token_current') THEN
    v_sql := v_sql || ', email_change_token_current';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'reauthentication_token') THEN
    v_sql := v_sql || ', reauthentication_token';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'is_sso_user') THEN
    v_sql := v_sql || ', is_sso_user';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'is_anonymous') THEN
    v_sql := v_sql || ', is_anonymous';
  END IF;

  v_sql := v_sql || ') VALUES ($1, ''00000000-0000-0000-0000-000000000000'', $2, crypt($3, gen_salt(''bf'')), NOW(), NOW(), NOW(), ''{"provider":"email","providers":["email"]}''::jsonb, $4, ''authenticated'', ''authenticated''';

  -- Append matching value expressions for the optional columns
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'confirmation_token') THEN
    v_sql := v_sql || ', ''''';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'recovery_token') THEN
    v_sql := v_sql || ', ''''';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'email_change_token_new') THEN
    v_sql := v_sql || ', ''''';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'email_change') THEN
    v_sql := v_sql || ', ''''';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'phone_change_token') THEN
    v_sql := v_sql || ', ''''';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'email_change_token_current') THEN
    v_sql := v_sql || ', ''''';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'reauthentication_token') THEN
    v_sql := v_sql || ', ''''';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'is_sso_user') THEN
    v_sql := v_sql || ', false';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'is_anonymous') THEN
    v_sql := v_sql || ', false';
  END IF;

  v_sql := v_sql || ')';

  -- Execute dynamic insert
  EXECUTE v_sql USING
    v_user_id,
    p_email,
    p_password,
    jsonb_build_object(
      'username', UPPER(p_username),
      'role', p_role,
      'full_name', p_full_name,
      'needs_supervisor_approval', p_needs_supervisor_approval,
      'allow_reserve', p_allow_reserve,
      'allow_overtime', p_allow_overtime
    );

  -- The trigger will create the profile, but we need to update full_name, needs_supervisor_approval, allow_reserve, allow_overtime, and supervisor_ids
  UPDATE public.profiles
  SET full_name = p_full_name,
      needs_supervisor_approval = p_needs_supervisor_approval,
      allow_reserve = p_allow_reserve,
      allow_overtime = p_allow_overtime,
      supervisor_ids = p_supervisor_ids,
      is_setup_completed = false
  WHERE id = v_user_id;

  RETURN v_user_id;
END;
$_$;


--
-- Name: delete_user_by_id(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_user_by_id(p_user_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can delete users';
  END IF;

  -- Delete from auth.users (cascade will handle profiles and chuti)
  DELETE FROM auth.users WHERE id = p_user_id;
END;
$$;


--
-- Name: get_admin_sales_summary(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_admin_sales_summary(p_today text, p_tz text DEFAULT 'UTC'::text) RETURNS TABLE(total_sold integer, total_unsold integer, total_attempts integer)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $_$
  WITH todays_sales AS (
    SELECT
      -- Group key: file name without its sold-status suffix, case/space-insensitive
      upper(btrim(regexp_replace(r.file_name, ' \[(SOLD|UNSOLD)\]$', ''))) AS file_key,
      (r.file_name LIKE '% [SOLD]') AS is_sold,
      r.submitted_at
    FROM public.records r
    WHERE r.file_type = 'Sale'
      -- Sargable range on submitted_at: [local midnight, next local midnight) in UTC
      AND r.submitted_at >= ((p_today::date)::timestamp AT TIME ZONE p_tz)
      AND r.submitted_at <  ((p_today::date + 1)::timestamp AT TIME ZONE p_tz)
  ),
  per_file AS (
    SELECT
      file_key,
      -- Every SOLD entry is its own closed sale
      COUNT(*) FILTER (WHERE is_sold)::INT AS sold_count,
      -- Latest entry unsold -> one still-open attempt
      -- (tie on submitted_at prefers SOLD via is_sold DESC)
      CASE WHEN NOT (array_agg(is_sold ORDER BY submitted_at DESC, is_sold DESC))[1]
           THEN 1 ELSE 0 END AS unsold_count
    FROM todays_sales
    GROUP BY file_key
  )
  SELECT
    COALESCE(SUM(sold_count), 0)::INT                 AS total_sold,
    COALESCE(SUM(unsold_count), 0)::INT               AS total_unsold,
    COALESCE(SUM(sold_count + unsold_count), 0)::INT  AS total_attempts
  FROM per_file;
$_$;


--
-- Name: get_leaderboard_data(text, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_leaderboard_data(p_year text, p_month text, p_period text, p_today text, p_tz text DEFAULT 'UTC'::text) RETURNS TABLE(user_id uuid, username text, full_name text, role text, job_role text, branch text, badge jsonb, quotes_count integer, requotes_count integer, reviews_count integer, sales_count integer, total_submitted integer, todays_count integer, months_count integer, overall_score integer, earliest_achievement_timestamp timestamp with time zone, rank integer)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  RETURN QUERY
  WITH localized AS (
    SELECT
      r.user_id,
      r.file_type,
      r.submitted_at,
      timezone(p_tz, r.submitted_at) AS local_ts
    FROM public.records r
  ),
  selected_month_stats AS (
    SELECT
      l.user_id,
      COUNT(*)::INT AS months_count,
      COUNT(*) FILTER (WHERE l.file_type = 'Quote')::INT AS quotes_count,
      COUNT(*) FILTER (WHERE l.file_type IN ('Requote', 'Requote Van', 'Requote Bike'))::INT AS requotes_count,
      COUNT(*) FILTER (WHERE l.file_type LIKE '%Review%')::INT AS reviews_count,
      COUNT(*) FILTER (WHERE l.file_type = 'Sale')::INT AS sales_count,
      MAX(l.submitted_at) AS earliest_achievement_timestamp
    FROM localized l
    WHERE
      EXTRACT(YEAR FROM l.local_ts)::INT = p_year::INT
      AND EXTRACT(MONTH FROM l.local_ts)::INT = p_month::INT
    GROUP BY l.user_id
  ),
  selected_year_stats AS (
    SELECT
      l.user_id,
      COUNT(*)::INT AS years_count
    FROM localized l
    WHERE
      EXTRACT(YEAR FROM l.local_ts)::INT = p_year::INT
    GROUP BY l.user_id
  ),
  today_stats AS (
    SELECT
      l.user_id,
      COUNT(*)::INT AS todays_count
    FROM localized l
    WHERE l.local_ts::DATE = p_today::DATE
    GROUP BY l.user_id
  ),
  -- Profiles carry no branch column; derive each user's primary branch from
  -- their most frequent (latest-active on ties) records.branch_name.
  user_branches AS (
    SELECT DISTINCT ON (b.user_id)
      b.user_id,
      b.branch_name
    FROM (
      SELECT
        r2.user_id,
        r2.branch_name,
        COUNT(*) AS branch_cnt,
        MAX(r2.submitted_at) AS branch_latest
      FROM public.records r2
      GROUP BY r2.user_id, r2.branch_name
    ) b
    ORDER BY b.user_id, b.branch_cnt DESC, b.branch_latest DESC
  )
  SELECT
    p.id AS user_id,
    p.username,
    p.full_name,
    p.role,
    p.job_role,
    ub.branch_name AS branch,
    COALESCE(p.global_settings->'top_performer_badge', 'null'::jsonb) AS badge,
    COALESCE(sms.quotes_count, 0)::INT AS quotes_count,
    COALESCE(sms.requotes_count, 0)::INT AS requotes_count,
    COALESCE(sms.reviews_count, 0)::INT AS reviews_count,
    COALESCE(sms.sales_count, 0)::INT AS sales_count,
    COALESCE(sms.months_count, 0)::INT AS total_submitted,
    COALESCE(ts.todays_count, 0)::INT AS todays_count,
    COALESCE(sms.months_count, 0)::INT AS months_count,
    COALESCE(sys.years_count, 0)::INT AS overall_score,
    sms.earliest_achievement_timestamp AS earliest_achievement_timestamp,
    DENSE_RANK() OVER (
      ORDER BY
        COALESCE(sms.months_count, 0) DESC,
        sms.earliest_achievement_timestamp ASC NULLS LAST,
        p.username ASC
    )::INT AS rank
  FROM public.profiles p
  LEFT JOIN selected_month_stats sms ON p.id = sms.user_id
  LEFT JOIN selected_year_stats sys ON p.id = sys.user_id
  LEFT JOIN today_stats ts ON p.id = ts.user_id
  LEFT JOIN user_branches ub ON p.id = ub.user_id
  ORDER BY rank ASC;
END;
$$;


--
-- Name: get_user_email_by_username(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_email_by_username(p_username text) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_email TEXT;
BEGIN
  SELECT email INTO v_email
  FROM auth.users u
  JOIN public.profiles p ON u.id = p.id
  WHERE UPPER(p.username) = UPPER(p_username);
  
  RETURN v_email;
END;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  base_username TEXT;
  final_username TEXT;
  suffix INTEGER := 1;
  v_global_settings JSONB;
BEGIN
  -- Get current global settings from an existing admin/superadmin profile
  SELECT global_settings INTO v_global_settings
  FROM public.profiles
  WHERE role IN ('admin', 'superadmin')
  LIMIT 1;

  IF v_global_settings IS NULL THEN
    v_global_settings := '{"office_leave_default": 14, "eid_fitr_leave": 0, "eid_adha_leave": 0, "govt_holidays": []}'::jsonb;
  END IF;

  base_username := UPPER(COALESCE(NEW.raw_user_meta_data->>'username', SPLIT_PART(NEW.email, '@', 1)));
  final_username := base_username;
  
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = final_username) LOOP
    final_username := base_username || suffix;
    suffix := suffix + 1;
  END LOOP;

  INSERT INTO public.profiles (
    id,
    username,
    full_name,
    role,
    has_chuti_access,
    has_quotes_access,
    can_manage_rules,
    global_settings
  )
  VALUES (
    NEW.id,
    final_username,
    COALESCE(NEW.raw_user_meta_data->>'full_name', final_username),
    COALESCE(NEW.raw_user_meta_data->>'role', 'user'),
    COALESCE((NEW.raw_user_meta_data->>'has_chuti_access')::boolean, true),
    COALESCE((NEW.raw_user_meta_data->>'has_quotes_access')::boolean, true),
    COALESCE((NEW.raw_user_meta_data->>'can_manage_rules')::boolean, false),
    v_global_settings
  );

  RETURN NEW;
END;
$$;


--
-- Name: has_kpi_access(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_kpi_access(supervisor_id uuid, employee_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles u
    WHERE u.id = employee_id
    AND (
      -- Direct team supervision
      supervisor_id = ANY(u.supervisor_ids)
      -- Explicit KPI delegation for this user
      OR u.delegated_kpi_supervisor_id = supervisor_id
    )
  );
END;
$$;


--
-- Name: has_leave_access(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_leave_access(supervisor_id uuid, employee_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles u
    WHERE u.id = employee_id
    AND (
      -- Direct team supervision
      supervisor_id = ANY(u.supervisor_ids)
      -- Explicit Leave delegation for this user
      OR u.delegated_leave_supervisor_id = supervisor_id
      -- Delegated team supervision
      OR EXISTS (
        SELECT 1 FROM public.profiles s
        WHERE s.id = ANY(u.supervisor_ids)
        AND s.delegated_supervisor_id = supervisor_id
      )
    )
  );
END;
$$;


--
-- Name: is_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_admin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
  );
$$;


--
-- Name: is_admin_or_supervisor(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_admin_or_supervisor() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND (role = 'admin' OR role = 'supervisor' OR role = 'superadmin')
  );
$$;


--
-- Name: is_superadmin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_superadmin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'superadmin'
  );
$$;


--
-- Name: is_supervisor(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_supervisor() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'supervisor'
  );
$$;


--
-- Name: is_supervisor_of(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_supervisor_of(supervisor_id uuid, employee_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = employee_id
    AND supervisor_id = ANY(supervisor_ids)
  ) OR EXISTS (
    SELECT 1 FROM public.profiles u
    JOIN public.profiles s ON s.id = ANY(u.supervisor_ids)
    WHERE u.id = employee_id
    AND s.delegated_supervisor_id = supervisor_id
  );
END;
$$;


--
-- Name: is_user_in_top_5_for_month(uuid, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_user_in_top_5_for_month(p_user_id uuid, p_year integer, p_month integer) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_rank INT;
BEGIN
  WITH monthly_counts AS (
    SELECT 
      r.user_id,
      COUNT(*) AS record_count,
      p.username
    FROM public.records r
    JOIN public.profiles p ON r.user_id = p.id
    WHERE 
      EXTRACT(YEAR FROM r.submitted_at) = p_year
      AND EXTRACT(MONTH FROM r.submitted_at) = p_month
    GROUP BY r.user_id, p.username
  ),
  ranked_users AS (
    SELECT 
      user_id,
      ROW_NUMBER() OVER (ORDER BY record_count DESC, UPPER(username) ASC) AS rank
    FROM monthly_counts
  )
  SELECT rank INTO v_rank
  FROM ranked_users
  WHERE user_id = p_user_id;

  RETURN (v_rank IS NOT NULL AND v_rank <= 5);
END;
$$;


--
-- Name: set_admin_delegated_flags(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_admin_delegated_flags(p_flags jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'Only a superadmin can configure admin delegated feature flags.';
  END IF;

  UPDATE public.profiles
  SET global_settings = jsonb_set(
        COALESCE(global_settings, '{}'::jsonb),
        '{admin_delegated_flags}',
        COALESCE(p_flags, '{}'::jsonb),
        true
      )
  WHERE true;  -- intentional: global_settings is replicated to every row
END;
$$;


--
-- Name: set_feature_flags(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_feature_flags(p_flags jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'Only a superadmin can configure feature flags.';
  END IF;

  UPDATE public.profiles
  SET global_settings = jsonb_set(
        COALESCE(global_settings, '{}'::jsonb),
        '{feature_flags}',
        COALESCE(p_flags, '{}'::jsonb),
        true
      )
  WHERE true;  -- intentional: global_settings is replicated to every row
END;
$$;


--
-- Name: set_role_visibility(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_role_visibility(p_visibility jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'Only a superadmin can configure role visibility.';
  END IF;

  UPDATE public.profiles
  SET global_settings = jsonb_set(
        COALESCE(global_settings, '{}'::jsonb),
        '{role_visibility}',
        COALESCE(p_visibility, '{}'::jsonb),
        true
      )
  WHERE true;  -- intentional: global_settings is replicated to every row
END;
$$;


--
-- Name: set_sanitizer_rules(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_sanitizer_rules(p_rules jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'Only a superadmin can configure the filename sanitizer.';
  END IF;

  UPDATE public.profiles
  SET global_settings = jsonb_set(
        COALESCE(global_settings, '{}'::jsonb),
        '{sanitizer_rules}',
        COALESCE(p_rules, '[]'::jsonb),
        true
      )
  WHERE true;  -- intentional: global_settings is replicated to every row
END;
$$;


--
-- Name: set_sanitizer_words(text[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_sanitizer_words(p_words text[]) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'Only a superadmin can configure the filename sanitizer.';
  END IF;

  UPDATE public.profiles
  SET global_settings = jsonb_set(
        COALESCE(global_settings, '{}'::jsonb),
        '{sanitizer_words}',
        COALESCE(to_jsonb(p_words), '[]'::jsonb),
        true
      )
  WHERE true;  -- intentional: global_settings is replicated to every row
END;
$$;


--
-- Name: set_temp_access(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_temp_access(p_entries jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'Only a superadmin can configure temporary access.';
  END IF;

  UPDATE public.profiles
  SET global_settings = jsonb_set(
        COALESCE(global_settings, '{}'::jsonb),
        '{temp_access}',
        COALESCE(p_entries, '[]'::jsonb),
        true
      )
  WHERE true;  -- intentional: global_settings is replicated to every row
END;
$$;


--
-- Name: set_user_hidden_tabs(uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_user_hidden_tabs(p_user_id uuid, p_hidden_tabs jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF auth.uid() <> p_user_id AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: You can only update your own settings.';
  END IF;

  UPDATE public.profiles
  SET global_settings = jsonb_set(
        COALESCE(global_settings, '{}'::jsonb),
        '{hidden_tabs}',
        COALESCE(p_hidden_tabs, '[]'::jsonb),
        true
      )
  WHERE id = p_user_id;
END;
$$;


--
-- Name: set_user_vpn_list(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_user_vpn_list(p_vpn_list jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF NOT public.is_supervisor() AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: Only supervisor or admin can configure VPN list.';
  END IF;

  UPDATE public.profiles
  SET global_settings = jsonb_set(
        COALESCE(global_settings, '{}'::jsonb),
        '{vpn_list}',
        COALESCE(p_vpn_list, '[]'::jsonb),
        true
      )
  WHERE true;
END;
$$;


--
-- Name: sync_top_performer_badges(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_top_performer_badges() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_today DATE := CURRENT_DATE;
  v_prev_month_date DATE := (DATE_TRUNC('month', v_today) - INTERVAL '1 month')::DATE;
  v_prev_year INT := EXTRACT(YEAR FROM v_prev_month_date)::INT;
  v_prev_month INT := EXTRACT(MONTH FROM v_prev_month_date)::INT;
  v_prev_month_name TEXT := TO_CHAR(v_prev_month_date, 'Month');
  
  v_current_year INT := EXTRACT(YEAR FROM v_today)::INT;
  
  r_user RECORD;
  v_rank INT := 0;
  v_badge_type TEXT;
  v_consecutive_months INT;
  v_yearly_wins INT;
  v_check_date DATE;
  v_badge_json JSONB;
BEGIN
  -- Set local parameter so the triggers bypass security checks
  PERFORM set_config('app.bypass_profile_security', 'true', true);

  -- ক. আগের মাসের টপ ৫ পারফর্মারদের একটি সাময়িক টেবিল তৈরি করা
  CREATE TEMP TABLE temp_top_5 ON COMMIT DROP AS
  WITH monthly_counts AS (
    SELECT 
      r.user_id,
      COUNT(*) AS record_count,
      p.username
    FROM public.records r
    JOIN public.profiles p ON r.user_id = p.id
    WHERE 
      EXTRACT(YEAR FROM r.submitted_at) = v_prev_year
      AND EXTRACT(MONTH FROM r.submitted_at) = v_prev_month
    GROUP BY r.user_id, p.username
  )
  SELECT 
    user_id,
    ROW_NUMBER() OVER (ORDER BY record_count DESC, UPPER(username) ASC) AS rank
  FROM monthly_counts
  LIMIT 5;

  -- খ. যারা আগের মাসের টপ ৫-এ নেই, তাদের প্রোফাইলের ব্যাজ মুছে ফেলা
  -- Only touch rows that actually carry the badge — otherwise every profile row
  -- gets a new version on each run and realtime emits an UPDATE per profile.
  UPDATE public.profiles
  SET global_settings = COALESCE(global_settings, '{}'::JSONB) - 'top_performer_badge'
  WHERE id NOT IN (SELECT user_id FROM temp_top_5)
    AND global_settings ? 'top_performer_badge';

  -- গ. টপ ৫ পারফর্মারদের লুপ চালিয়ে ধারাবাহিকতা (streaks) ও বার্ষিক উইন ক্যালকুলেট করে আপডেট করা
  FOR r_user IN (SELECT * FROM temp_top_5) LOOP
    v_rank := r_user.rank;
    v_badge_type := CASE WHEN v_rank <= 3 THEN 'blue' ELSE 'grey' END;

    -- কন্টিনিউয়াস মান্থলি স্ট্রাক ক্যালকুলেশন
    v_consecutive_months := 0;
    v_check_date := v_prev_month_date;
    
    WHILE public.is_user_in_top_5_for_month(r_user.user_id, EXTRACT(YEAR FROM v_check_date)::INT, EXTRACT(MONTH FROM v_check_date)::INT) LOOP
      v_consecutive_months := v_consecutive_months + 1;
      v_check_date := (v_check_date - INTERVAL '1 month')::DATE;
    END LOOP;

    -- চলতি ক্যালেন্ডার বছরে টোটাল উইন
    v_yearly_wins := 0;
    FOR m IN 1..12 LOOP
      IF public.is_user_in_top_5_for_month(r_user.user_id, v_current_year, m) THEN
        v_yearly_wins := v_yearly_wins + 1;
      END IF;
    END LOOP;

    -- JSON ডাটা প্রস্তুত করা
    v_badge_json := JSONB_BUILD_OBJECT(
      'userId', r_user.user_id,
      'rank', v_rank,
      'badgeType', v_badge_type,
      'monthName', TRIM(v_prev_month_name),
      'consecutiveMonths', v_consecutive_months,
      'yearlyTopPerformances', v_yearly_wins
    );

    -- ইউজারের প্রোফাইলে ব্যাজ সেট করা
    UPDATE public.profiles
    SET global_settings = COALESCE(global_settings, '{}'::JSONB) || JSONB_BUILD_OBJECT('top_performer_badge', v_badge_json)
    WHERE id = r_user.user_id;
  END LOOP;
END;
$$;


--
-- Name: update_chuti_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_chuti_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_compliance_rules_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_compliance_rules_updated_at() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  NEW.updated_at := now();
  NEW.updated_by := auth.uid();
  RETURN NEW;
END;
$$;


--
-- Name: update_records_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_records_updated_at() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_todos_last_activity(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_todos_last_activity() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  NEW.last_activity_at = NOW();
  RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    actor_id uuid,
    actor_codename text NOT NULL,
    action_type text NOT NULL,
    target_id text,
    details text NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


--
-- Name: chuti; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chuti (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    date date NOT NULL,
    leave_type text NOT NULL,
    adjustment boolean DEFAULT false NOT NULL,
    adjusted_hour interval,
    sign_in_time time without time zone,
    sign_out_time time without time zone,
    leave_hour interval,
    reserve_holiday text,
    reserve_adjustment_status text DEFAULT 'none'::text NOT NULL,
    status text DEFAULT 'pending_supervisor'::text NOT NULL,
    admin_edit_request jsonb,
    admin_edit_status text DEFAULT 'none'::text NOT NULL,
    is_edited boolean DEFAULT false NOT NULL,
    adjust_short_leave boolean DEFAULT false NOT NULL,
    comment text,
    created_at timestamp with time zone DEFAULT now(),
    bulk_id uuid,
    updated_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp with time zone,
    CONSTRAINT chuti_admin_edit_status_check CHECK ((admin_edit_status = ANY (ARRAY['none'::text, 'pending'::text, 'approved'::text, 'rejected'::text]))),
    CONSTRAINT chuti_leave_type_check CHECK ((leave_type = ANY (ARRAY['Short Leave'::text, 'Full Leave'::text, 'Overtime'::text]))),
    CONSTRAINT chuti_reserve_adjustment_status_check CHECK ((reserve_adjustment_status = ANY (ARRAY['none'::text, 'pending'::text, 'approved'::text, 'rejected'::text]))),
    CONSTRAINT chuti_status_check CHECK ((status = ANY (ARRAY['pending_supervisor'::text, 'needs_review'::text, 'approved_by_supervisor'::text, 'approved'::text])))
);


--
-- Name: compliance_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.compliance_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    category text NOT NULL,
    sub_category text NOT NULL,
    company_name text,
    company_tags text[],
    title text,
    content text NOT NULL,
    extra_info text,
    is_deleted boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_by uuid,
    CONSTRAINT compliance_rules_category_check CHECK ((category = ANY (ARRAY['announcement'::text, 'fine'::text, 'universal'::text, 'company'::text]))),
    CONSTRAINT compliance_rules_sub_category_check CHECK ((sub_category = ANY (ARRAY['nby_rule'::text, 'general_pricing'::text, 'employment'::text, 'driver_and_usage'::text, 'license_and_residency'::text, 'file_processing'::text, 'branch_priority'::text, 'doc_extensions'::text, 'common_rules'::text])))
);


--
-- Name: dismissed_notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dismissed_notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    notification_id text NOT NULL,
    dismissed_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


--
-- Name: govt_holiday_responses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.govt_holiday_responses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    holiday_date date NOT NULL,
    holiday_name text NOT NULL,
    response text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_by_admin boolean DEFAULT false,
    CONSTRAINT govt_holiday_responses_response_check CHECK ((response = ANY (ARRAY['paid'::text, 'reserve'::text])))
);


--
-- Name: TABLE govt_holiday_responses; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.govt_holiday_responses IS 'Stores user choices (Get Paid vs Reserve) for each government holiday';


--
-- Name: kpi_assessments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.kpi_assessments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    month_year text NOT NULL,
    emp_id text,
    date_of_joining text,
    department text DEFAULT 'Data Entry'::text,
    appraiser_name text,
    reviewer_name text,
    kpis jsonb DEFAULT '[]'::jsonb NOT NULL,
    appraisee_signed boolean DEFAULT false,
    appraisee_sign_date text,
    appraiser_signed boolean DEFAULT false,
    appraiser_sign_date text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


--
-- Name: leaderboard_archive; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.leaderboard_archive (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    username text NOT NULL,
    full_name text,
    job_role text,
    branch text,
    year integer NOT NULL,
    quotes_count integer DEFAULT 0 NOT NULL,
    requotes_count integer DEFAULT 0 NOT NULL,
    reviews_count integer DEFAULT 0 NOT NULL,
    sales_count integer DEFAULT 0 NOT NULL,
    total_submitted integer DEFAULT 0 NOT NULL,
    rank integer NOT NULL,
    archived_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


--
-- Name: leave_settlements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.leave_settlements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    year character varying(4) NOT NULL,
    period character varying(10) DEFAULT 'H2'::character varying NOT NULL,
    leave_category text NOT NULL,
    remaining_days numeric(10,4) NOT NULL,
    action_type text NOT NULL,
    status text DEFAULT 'initiated'::text NOT NULL,
    processed_by uuid,
    processed_at timestamp with time zone,
    action_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    carry_forward_days numeric(10,4) DEFAULT 0,
    payment_days numeric(10,4) DEFAULT 0,
    adjust_leave_days numeric(10,4) DEFAULT 0,
    CONSTRAINT leave_settlements_action_type_check CHECK ((action_type = ANY (ARRAY['carry_forward'::text, 'payment'::text, 'adjust_leave'::text, 'split'::text]))),
    CONSTRAINT leave_settlements_leave_category_check CHECK ((leave_category = ANY (ARRAY['Govt Holiday'::text, 'Eid-ul-Fitr'::text, 'Eid-ul-Adha'::text, 'Office Leave'::text]))),
    CONSTRAINT leave_settlements_period_check CHECK (((period)::text = ANY ((ARRAY['H1'::character varying, 'H2'::character varying, 'Instant'::character varying])::text[]))),
    CONSTRAINT leave_settlements_status_check CHECK ((status = ANY (ARRAY['initiated'::text, 'responded'::text, 'processed'::text])))
);


--
-- Name: login_codes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.login_codes (
    login_id text NOT NULL,
    code text NOT NULL,
    name text,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


--
-- Name: mobile_app_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mobile_app_versions (
    id bigint NOT NULL,
    version text NOT NULL,
    zip_url text NOT NULL,
    required boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: mobile_app_versions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.mobile_app_versions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: mobile_app_versions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.mobile_app_versions_id_seq OWNED BY public.mobile_app_versions.id;


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    username text NOT NULL,
    role text DEFAULT 'user'::text NOT NULL,
    username_changes integer DEFAULT 0 NOT NULL,
    username_request_status text DEFAULT 'none'::text NOT NULL,
    full_name text,
    working_hours numeric DEFAULT 9.5,
    break_time integer DEFAULT 0,
    is_setup_completed boolean DEFAULT false,
    job_role text,
    requested_full_name text,
    requested_working_hours numeric,
    requested_break_time integer,
    requested_job_role text,
    profile_change_status text DEFAULT 'none'::text NOT NULL,
    default_sign_in text,
    default_sign_out text,
    requested_default_sign_in text,
    requested_default_sign_out text,
    needs_supervisor_approval boolean DEFAULT true,
    allow_reserve boolean DEFAULT false,
    allow_overtime boolean DEFAULT false,
    has_edited_profile boolean DEFAULT false NOT NULL,
    has_changed_password boolean DEFAULT false NOT NULL,
    max_full_leaves integer DEFAULT 15,
    max_short_leaves integer DEFAULT 15,
    eligible_office_leave boolean DEFAULT true,
    eligible_govt_holiday boolean DEFAULT true,
    converted_short_leaves_days integer DEFAULT 0,
    converted_short_leaves_hours numeric DEFAULT 0,
    global_settings jsonb DEFAULT '{"govt_holidays": [], "eid_adha_leave": 0, "eid_fitr_leave": 0, "office_leave_default": 14}'::jsonb,
    supervisor_ids uuid[],
    allowed_types text[] DEFAULT ARRAY['Quote'::text, 'Requote'::text, 'Requote Van'::text, 'Requote Bike'::text, 'Review'::text, 'Review Van'::text, 'Review Bike'::text, 'Individual Review'::text, 'Other Site'::text, 'Van'::text, 'Bike'::text, 'Sale'::text] NOT NULL,
    can_manage_rules boolean DEFAULT false NOT NULL,
    quotes_role text DEFAULT 'user'::text,
    has_chuti_access boolean DEFAULT false,
    has_quotes_access boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    delegated_supervisor_id uuid,
    delegated_leave_supervisor_id uuid,
    delegated_kpi_supervisor_id uuid,
    CONSTRAINT profiles_profile_change_status_check CHECK ((profile_change_status = ANY (ARRAY['none'::text, 'pending'::text, 'approved'::text, 'rejected'::text]))),
    CONSTRAINT profiles_quotes_role_check CHECK ((quotes_role = ANY (ARRAY['admin'::text, 'user'::text]))),
    CONSTRAINT profiles_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'user'::text, 'supervisor'::text, 'superadmin'::text]))),
    CONSTRAINT profiles_username_request_status_check CHECK ((username_request_status = ANY (ARRAY['none'::text, 'pending'::text, 'approved'::text])))
);


--
-- Name: COLUMN profiles.global_settings; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.profiles.global_settings IS 'Global leave quotas and government holidays list stored in JSON format';


--
-- Name: records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    file_name text NOT NULL,
    branch_name text NOT NULL,
    codename text NOT NULL,
    file_type text NOT NULL,
    submitted_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT records_file_type_check CHECK ((file_type = ANY (ARRAY['Quote'::text, 'Requote'::text, 'Requote Van'::text, 'Requote Bike'::text, 'Review'::text, 'Review Van'::text, 'Review Bike'::text, 'Individual Review'::text, 'Other Site'::text, 'Van'::text, 'Bike'::text, 'Sale'::text])))
);


--
-- Name: todos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.todos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    codename text NOT NULL,
    task text NOT NULL,
    status text DEFAULT 'Idle'::text NOT NULL,
    comment text,
    todo_date date DEFAULT CURRENT_DATE NOT NULL,
    is_all_time boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    last_activity_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT todos_status_check CHECK ((status = ANY (ARRAY['Idle'::text, 'Working'::text, 'Completed'::text])))
);


--
-- Name: mobile_app_versions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mobile_app_versions ALTER COLUMN id SET DEFAULT nextval('public.mobile_app_versions_id_seq'::regclass);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: chuti chuti_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chuti
    ADD CONSTRAINT chuti_pkey PRIMARY KEY (id);


--
-- Name: compliance_rules compliance_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_rules
    ADD CONSTRAINT compliance_rules_pkey PRIMARY KEY (id);


--
-- Name: dismissed_notifications dismissed_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dismissed_notifications
    ADD CONSTRAINT dismissed_notifications_pkey PRIMARY KEY (id);


--
-- Name: govt_holiday_responses govt_holiday_responses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.govt_holiday_responses
    ADD CONSTRAINT govt_holiday_responses_pkey PRIMARY KEY (id);


--
-- Name: kpi_assessments kpi_assessments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kpi_assessments
    ADD CONSTRAINT kpi_assessments_pkey PRIMARY KEY (id);


--
-- Name: kpi_assessments kpi_assessments_user_id_month_year_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kpi_assessments
    ADD CONSTRAINT kpi_assessments_user_id_month_year_key UNIQUE (user_id, month_year);


--
-- Name: leaderboard_archive leaderboard_archive_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leaderboard_archive
    ADD CONSTRAINT leaderboard_archive_pkey PRIMARY KEY (id);


--
-- Name: leaderboard_archive leaderboard_archive_username_year_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leaderboard_archive
    ADD CONSTRAINT leaderboard_archive_username_year_unique UNIQUE (username, year);


--
-- Name: leave_settlements leave_settlements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_settlements
    ADD CONSTRAINT leave_settlements_pkey PRIMARY KEY (id);


--
-- Name: login_codes login_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.login_codes
    ADD CONSTRAINT login_codes_pkey PRIMARY KEY (login_id);


--
-- Name: mobile_app_versions mobile_app_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mobile_app_versions
    ADD CONSTRAINT mobile_app_versions_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_username_key UNIQUE (username);


--
-- Name: records records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.records
    ADD CONSTRAINT records_pkey PRIMARY KEY (id);


--
-- Name: todos todos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.todos
    ADD CONSTRAINT todos_pkey PRIMARY KEY (id);


--
-- Name: govt_holiday_responses unique_user_holiday; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.govt_holiday_responses
    ADD CONSTRAINT unique_user_holiday UNIQUE (user_id, holiday_date);


--
-- Name: dismissed_notifications unique_user_notification; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dismissed_notifications
    ADD CONSTRAINT unique_user_notification UNIQUE (user_id, notification_id);


--
-- Name: leave_settlements unique_user_year_period_category; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_settlements
    ADD CONSTRAINT unique_user_year_period_category UNIQUE (user_id, year, period, leave_category);


--
-- Name: idx_audit_logs_actor_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_actor_id ON public.audit_logs USING btree (actor_id);


--
-- Name: idx_audit_logs_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_created ON public.audit_logs USING btree (created_at DESC);


--
-- Name: idx_audit_logs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_created_at ON public.audit_logs USING btree (created_at);


--
-- Name: idx_chuti_bulk_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chuti_bulk_id ON public.chuti USING btree (bulk_id) WHERE (bulk_id IS NOT NULL);


--
-- Name: idx_chuti_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chuti_deleted_at ON public.chuti USING btree (deleted_at);


--
-- Name: idx_chuti_updated_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chuti_updated_at ON public.chuti USING btree (updated_at);


--
-- Name: idx_chuti_user_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chuti_user_date ON public.chuti USING btree (user_id, date);


--
-- Name: idx_leaderboard_archive_year; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leaderboard_archive_year ON public.leaderboard_archive USING btree (year, rank);


--
-- Name: idx_leave_settlements_user_year; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leave_settlements_user_year ON public.leave_settlements USING btree (user_id, year);


--
-- Name: idx_records_sale_submitted; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_records_sale_submitted ON public.records USING btree (submitted_at) WHERE (file_type = 'Sale'::text);


--
-- Name: idx_records_updated_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_records_updated_at ON public.records USING btree (updated_at);


--
-- Name: idx_records_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_records_user_id ON public.records USING btree (user_id);


--
-- Name: idx_records_user_submitted; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_records_user_submitted ON public.records USING btree (user_id, submitted_at);


--
-- Name: idx_todos_last_activity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_todos_last_activity ON public.todos USING btree (user_id, todo_date, last_activity_at DESC);


--
-- Name: idx_todos_todo_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_todos_todo_date ON public.todos USING btree (todo_date);


--
-- Name: idx_todos_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_todos_user_id ON public.todos USING btree (user_id);


--
-- Name: unique_user_date; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX unique_user_date ON public.chuti USING btree (user_id, date) WHERE (deleted_at IS NULL);


--
-- Name: uq_records_user_file_submitted; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_records_user_file_submitted ON public.records USING btree (user_id, file_name, submitted_at);


--
-- Name: chuti chuti_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER chuti_set_updated_at BEFORE UPDATE ON public.chuti FOR EACH ROW EXECUTE FUNCTION public.update_chuti_updated_at();


--
-- Name: profiles on_profile_role_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_profile_role_update BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.check_profile_role_change();


--
-- Name: profiles on_profile_update_security; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_profile_update_security BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.check_profile_updates();


--
-- Name: records records_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER records_set_updated_at BEFORE UPDATE ON public.records FOR EACH ROW EXECUTE FUNCTION public.update_records_updated_at();


--
-- Name: todos todos_set_last_activity; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER todos_set_last_activity BEFORE UPDATE ON public.todos FOR EACH ROW EXECUTE FUNCTION public.update_todos_last_activity();


--
-- Name: compliance_rules trg_update_compliance_rules_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_update_compliance_rules_updated_at BEFORE UPDATE ON public.compliance_rules FOR EACH ROW EXECUTE FUNCTION public.update_compliance_rules_updated_at();


--
-- Name: audit_logs audit_logs_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: chuti chuti_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chuti
    ADD CONSTRAINT chuti_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: compliance_rules compliance_rules_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_rules
    ADD CONSTRAINT compliance_rules_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: dismissed_notifications dismissed_notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dismissed_notifications
    ADD CONSTRAINT dismissed_notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: govt_holiday_responses govt_holiday_responses_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.govt_holiday_responses
    ADD CONSTRAINT govt_holiday_responses_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: kpi_assessments kpi_assessments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kpi_assessments
    ADD CONSTRAINT kpi_assessments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: leaderboard_archive leaderboard_archive_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leaderboard_archive
    ADD CONSTRAINT leaderboard_archive_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: leave_settlements leave_settlements_action_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_settlements
    ADD CONSTRAINT leave_settlements_action_by_fkey FOREIGN KEY (action_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: leave_settlements leave_settlements_processed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_settlements
    ADD CONSTRAINT leave_settlements_processed_by_fkey FOREIGN KEY (processed_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: leave_settlements leave_settlements_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_settlements
    ADD CONSTRAINT leave_settlements_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_delegated_kpi_supervisor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_delegated_kpi_supervisor_id_fkey FOREIGN KEY (delegated_kpi_supervisor_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: profiles profiles_delegated_leave_supervisor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_delegated_leave_supervisor_id_fkey FOREIGN KEY (delegated_leave_supervisor_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: profiles profiles_delegated_supervisor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_delegated_supervisor_id_fkey FOREIGN KEY (delegated_supervisor_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: records records_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.records
    ADD CONSTRAINT records_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: todos todos_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.todos
    ADD CONSTRAINT todos_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: dismissed_notifications Admins can do everything on dismissed notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can do everything on dismissed notifications" ON public.dismissed_notifications USING (public.is_admin());


--
-- Name: govt_holiday_responses Admins can read all holiday responses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can read all holiday responses" ON public.govt_holiday_responses FOR SELECT USING (public.is_admin());


--
-- Name: govt_holiday_responses Admins can update/delete responses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update/delete responses" ON public.govt_holiday_responses USING (public.is_admin());


--
-- Name: leave_settlements Admins/supervisors can manage settlements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins/supervisors can manage settlements" ON public.leave_settlements USING ((public.is_admin() OR public.is_supervisor())) WITH CHECK ((public.is_admin() OR public.is_supervisor()));


--
-- Name: profiles Allow admin to read all profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow admin to read all profiles" ON public.profiles FOR SELECT USING (public.is_admin());


--
-- Name: chuti Allow admin/supervisor to read all chuti; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow admin/supervisor to read all chuti" ON public.chuti FOR SELECT USING (public.is_admin_or_supervisor());


--
-- Name: login_codes Allow admins & supervisors to manage login codes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow admins & supervisors to manage login codes" ON public.login_codes TO authenticated USING ((public.is_admin() OR public.is_supervisor()));


--
-- Name: chuti Allow admins to delete chuti; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow admins to delete chuti" ON public.chuti FOR DELETE USING (public.is_admin());


--
-- Name: profiles Allow admins to delete profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow admins to delete profiles" ON public.profiles FOR DELETE USING (public.is_admin());


--
-- Name: chuti Allow admins to insert chuti for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow admins to insert chuti for all users" ON public.chuti FOR INSERT WITH CHECK (public.is_admin());


--
-- Name: profiles Allow admins to insert profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow admins to insert profiles" ON public.profiles FOR INSERT WITH CHECK (public.is_admin());


--
-- Name: audit_logs Allow admins to read all audit logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow admins to read all audit logs" ON public.audit_logs FOR SELECT TO authenticated USING (public.is_admin());


--
-- Name: chuti Allow admins to update all chuti; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow admins to update all chuti" ON public.chuti FOR UPDATE USING (public.is_admin());


--
-- Name: profiles Allow admins to update all profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow admins to update all profiles" ON public.profiles FOR UPDATE USING (public.is_admin());


--
-- Name: compliance_rules Allow admins, supervisors or authorized editors to delete rules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow admins, supervisors or authorized editors to delete rules" ON public.compliance_rules FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND ((profiles.role = ANY (ARRAY['admin'::text, 'superadmin'::text, 'supervisor'::text])) OR (profiles.can_manage_rules = true))))));


--
-- Name: compliance_rules Allow admins, supervisors or authorized editors to insert rules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow admins, supervisors or authorized editors to insert rules" ON public.compliance_rules FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND ((profiles.role = ANY (ARRAY['admin'::text, 'superadmin'::text, 'supervisor'::text])) OR (profiles.can_manage_rules = true))))));


--
-- Name: compliance_rules Allow admins, supervisors or authorized editors to update rules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow admins, supervisors or authorized editors to update rules" ON public.compliance_rules FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND ((profiles.role = ANY (ARRAY['admin'::text, 'superadmin'::text, 'supervisor'::text])) OR (profiles.can_manage_rules = true)))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND ((profiles.role = ANY (ARRAY['admin'::text, 'superadmin'::text, 'supervisor'::text])) OR (profiles.can_manage_rules = true))))));


--
-- Name: compliance_rules Allow authenticated to read compliance rules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated to read compliance rules" ON public.compliance_rules FOR SELECT TO authenticated USING (((NOT is_deleted) OR (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND ((profiles.role = ANY (ARRAY['admin'::text, 'superadmin'::text, 'supervisor'::text])) OR (profiles.can_manage_rules = true)))))));


--
-- Name: login_codes Allow authenticated to read login codes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated to read login codes" ON public.login_codes FOR SELECT TO authenticated USING (true);


--
-- Name: audit_logs Allow authenticated users to insert audit logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated users to insert audit logs" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK ((actor_id = auth.uid()));


--
-- Name: profiles Allow authenticated users to read supervisor profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated users to read supervisor profiles" ON public.profiles FOR SELECT TO authenticated USING ((role = 'supervisor'::text));


--
-- Name: kpi_assessments Allow insert/update/delete for owner, admin, or assigned superv; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow insert/update/delete for owner, admin, or assigned superv" ON public.kpi_assessments TO authenticated USING (((auth.uid() = user_id) OR public.is_admin() OR (public.is_supervisor() AND public.has_kpi_access(auth.uid(), user_id))));


--
-- Name: mobile_app_versions Allow public read access to mobile_app_versions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public read access to mobile_app_versions" ON public.mobile_app_versions FOR SELECT USING (true);


--
-- Name: kpi_assessments Allow select for owner, admin, or assigned supervisor; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow select for owner, admin, or assigned supervisor" ON public.kpi_assessments FOR SELECT TO authenticated USING (((auth.uid() = user_id) OR public.is_admin() OR (public.is_supervisor() AND public.has_kpi_access(auth.uid(), user_id))));


--
-- Name: profiles Allow supervisor to read all profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow supervisor to read all profiles" ON public.profiles FOR SELECT USING (public.is_supervisor());


--
-- Name: chuti Allow supervisors to delete chuti; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow supervisors to delete chuti" ON public.chuti FOR DELETE USING ((public.is_supervisor() AND public.has_leave_access(auth.uid(), user_id)));


--
-- Name: chuti Allow supervisors to insert chuti for supervised users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow supervisors to insert chuti for supervised users" ON public.chuti FOR INSERT WITH CHECK ((public.is_supervisor() AND public.has_leave_access(auth.uid(), user_id)));


--
-- Name: chuti Allow supervisors to update chuti status; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow supervisors to update chuti status" ON public.chuti FOR UPDATE USING ((public.is_supervisor() AND public.has_leave_access(auth.uid(), user_id)));


--
-- Name: profiles Allow supervisors to update profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow supervisors to update profiles" ON public.profiles FOR UPDATE USING (public.is_supervisor()) WITH CHECK (public.is_supervisor());


--
-- Name: records Allow users to delete own records, admins/supervisors delete al; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow users to delete own records, admins/supervisors delete al" ON public.records FOR DELETE TO authenticated USING (((auth.uid() = user_id) OR public.is_admin() OR public.is_supervisor()));


--
-- Name: todos Allow users to delete own todos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow users to delete own todos" ON public.todos FOR DELETE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: chuti Allow users to delete their own chuti; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow users to delete their own chuti" ON public.chuti FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: records Allow users to insert own records, admins/supervisors insert al; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow users to insert own records, admins/supervisors insert al" ON public.records FOR INSERT TO authenticated WITH CHECK (((auth.uid() = user_id) OR public.is_admin() OR public.is_supervisor()));


--
-- Name: todos Allow users to insert own todos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow users to insert own todos" ON public.todos FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: chuti Allow users to insert their own chuti; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow users to insert their own chuti" ON public.chuti FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: profiles Allow users to insert their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow users to insert their own profile" ON public.profiles FOR INSERT WITH CHECK (((auth.uid() = id) AND (role = 'user'::text)));


--
-- Name: records Allow users to read own records, admins/supervisors read all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow users to read own records, admins/supervisors read all" ON public.records FOR SELECT TO authenticated USING (((auth.uid() = user_id) OR public.is_admin() OR public.is_supervisor()));


--
-- Name: todos Allow users to read own todos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow users to read own todos" ON public.todos FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: chuti Allow users to read their own chuti; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow users to read their own chuti" ON public.chuti FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: profiles Allow users to read their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow users to read their own profile" ON public.profiles FOR SELECT USING ((auth.uid() = id));


--
-- Name: records Allow users to update own records, admins/supervisors update al; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow users to update own records, admins/supervisors update al" ON public.records FOR UPDATE TO authenticated USING (((auth.uid() = user_id) OR public.is_admin() OR public.is_supervisor())) WITH CHECK (((auth.uid() = user_id) OR public.is_admin() OR public.is_supervisor()));


--
-- Name: todos Allow users to update own todos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow users to update own todos" ON public.todos FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: chuti Allow users to update their own chuti; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow users to update their own chuti" ON public.chuti FOR UPDATE USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: profiles Allow users to update their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow users to update their own profile" ON public.profiles FOR UPDATE USING ((auth.uid() = id)) WITH CHECK ((auth.uid() = id));


--
-- Name: leaderboard_archive Authenticated users can read leaderboard archive; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can read leaderboard archive" ON public.leaderboard_archive FOR SELECT TO authenticated USING (true);


--
-- Name: dismissed_notifications Users can delete own dismissed notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own dismissed notifications" ON public.dismissed_notifications FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: dismissed_notifications Users can insert own dismissed notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own dismissed notifications" ON public.dismissed_notifications FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: govt_holiday_responses Users can insert own holiday responses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own holiday responses" ON public.govt_holiday_responses FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: leave_settlements Users can insert own settlements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own settlements" ON public.leave_settlements FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: dismissed_notifications Users can read own dismissed notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read own dismissed notifications" ON public.dismissed_notifications FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: govt_holiday_responses Users can read own holiday responses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read own holiday responses" ON public.govt_holiday_responses FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: leave_settlements Users can read own settlements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read own settlements" ON public.leave_settlements FOR SELECT USING (((auth.uid() = user_id) OR public.is_admin() OR public.is_supervisor()));


--
-- Name: govt_holiday_responses Users can update own holiday responses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own holiday responses" ON public.govt_holiday_responses FOR UPDATE USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: leave_settlements Users can update own settlements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own settlements" ON public.leave_settlements FOR UPDATE USING (((auth.uid() = user_id) AND (status <> 'processed'::text))) WITH CHECK (((auth.uid() = user_id) AND (status <> 'processed'::text)));


--
-- Name: audit_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: chuti; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chuti ENABLE ROW LEVEL SECURITY;

--
-- Name: compliance_rules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.compliance_rules ENABLE ROW LEVEL SECURITY;

--
-- Name: dismissed_notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.dismissed_notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: govt_holiday_responses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.govt_holiday_responses ENABLE ROW LEVEL SECURITY;

--
-- Name: kpi_assessments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.kpi_assessments ENABLE ROW LEVEL SECURITY;

--
-- Name: leaderboard_archive; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.leaderboard_archive ENABLE ROW LEVEL SECURITY;

--
-- Name: leave_settlements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.leave_settlements ENABLE ROW LEVEL SECURITY;

--
-- Name: login_codes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.login_codes ENABLE ROW LEVEL SECURITY;

--
-- Name: mobile_app_versions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mobile_app_versions ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: records; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.records ENABLE ROW LEVEL SECURITY;

--
-- Name: todos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.todos ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

\unrestrict Ljbuwue4xcOSSc8Ga8MY5QHbZMSZWtpWfgrISg0IHd4hASKBk2tkO8m250nGABa

