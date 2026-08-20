-- Final live fixes after post-deploy lint/security probes.

CREATE OR REPLACE FUNCTION public.check_profile_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_actor_role text;
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF OLD.role IS DISTINCT FROM NEW.role THEN
    IF auth.uid() = OLD.id THEN
      v_actor_role := OLD.role;
    ELSE
      SELECT role INTO v_actor_role
      FROM public.profiles
      WHERE id = auth.uid();
    END IF;

    IF v_actor_role NOT IN ('admin', 'superadmin') THEN
      RAISE EXCEPTION 'You are not allowed to change your role.';
    END IF;

    IF (NEW.role IN ('admin', 'superadmin') OR OLD.role IN ('admin', 'superadmin'))
       AND v_actor_role <> 'superadmin' THEN
      RAISE EXCEPTION 'Only a superadmin can create, promote, or demote admin/superadmin accounts.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_profile_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_actor_role text;
  v_safe_global_keys text[] := ARRAY[
    'active_sessions',
    'hidden_tabs',
    'kpi_skills',
    'kpi_dept_indicators',
    'kpi_other_dept_indicators',
    'performs_data_entry',
    'department',
    'performs_other_dept_tasks',
    'other_department'
  ];
  v_admin_global_keys text[] := ARRAY[
    'active_sessions',
    'hidden_tabs',
    'kpi_skills',
    'kpi_dept_indicators',
    'kpi_other_dept_indicators',
    'performs_data_entry',
    'department',
    'performs_other_dept_tasks',
    'other_department',
    'user_feature_flags',
    'emp_id',
    'date_of_joining'
  ];
BEGIN
  IF current_setting('app.bypass_profile_security', true) = 'true'
     OR auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF OLD.id = auth.uid() THEN
    v_actor_role := OLD.role;
  ELSE
    SELECT p.role INTO v_actor_role
    FROM public.profiles p
    WHERE p.id = auth.uid();
  END IF;

  IF v_actor_role = 'superadmin' THEN
    RETURN NEW;
  END IF;

  IF v_actor_role = 'admin' THEN
    IF OLD.role = 'superadmin' OR (OLD.role = 'admin' AND OLD.id <> auth.uid()) THEN
      RAISE EXCEPTION 'Admins cannot modify other admin or superadmin profiles.';
    END IF;

    IF (COALESCE(NEW.global_settings, '{}'::jsonb) - v_admin_global_keys)
       IS DISTINCT FROM
       (COALESCE(OLD.global_settings, '{}'::jsonb) - v_admin_global_keys) THEN
      RAISE EXCEPTION 'Global access, feature, leave, VPN, and system settings must be changed through their authorized settings RPC.';
    END IF;

    RETURN NEW;
  END IF;

  IF v_actor_role = 'supervisor' THEN
    IF NEW.id = auth.uid() THEN
      IF (to_jsonb(NEW) - ARRAY[
        'full_name', 'working_hours', 'break_time', 'job_role',
        'default_sign_in', 'default_sign_out', 'requested_full_name',
        'requested_working_hours', 'requested_break_time', 'requested_job_role',
        'requested_default_sign_in', 'requested_default_sign_out',
        'profile_change_status', 'has_edited_profile', 'global_settings'
      ]) IS DISTINCT FROM
      (to_jsonb(OLD) - ARRAY[
        'full_name', 'working_hours', 'break_time', 'job_role',
        'default_sign_in', 'default_sign_out', 'requested_full_name',
        'requested_working_hours', 'requested_break_time', 'requested_job_role',
        'requested_default_sign_in', 'requested_default_sign_out',
        'profile_change_status', 'has_edited_profile', 'global_settings'
      ]) THEN
        RAISE EXCEPTION 'Supervisors cannot change their own role, permissions, quotas, or delegation.';
      END IF;
    ELSIF public.has_leave_access(auth.uid(), NEW.id) THEN
      IF OLD.role IN ('admin', 'superadmin', 'supervisor') THEN
        RAISE EXCEPTION 'Supervisors can only manage assigned user profiles.';
      END IF;
      IF (to_jsonb(NEW) - ARRAY[
        'allowed_types', 'break_time', 'default_sign_in', 'default_sign_out',
        'global_settings'
      ]) IS DISTINCT FROM
      (to_jsonb(OLD) - ARRAY[
        'allowed_types', 'break_time', 'default_sign_in', 'default_sign_out',
        'global_settings'
      ]) THEN
        RAISE EXCEPTION 'Supervisors may only change assigned users'' quote types, break/default times, and non-privileged performance settings.';
      END IF;
    ELSE
      RAISE EXCEPTION 'Supervisors may only modify their own or assigned user profiles.';
    END IF;

    IF (COALESCE(NEW.global_settings, '{}'::jsonb) - v_safe_global_keys)
       IS DISTINCT FROM
       (COALESCE(OLD.global_settings, '{}'::jsonb) - v_safe_global_keys) THEN
      RAISE EXCEPTION 'Supervisors cannot modify privileged global settings.';
    END IF;

    RETURN NEW;
  END IF;

  IF v_actor_role = 'user' AND NEW.id = auth.uid() THEN
    IF (to_jsonb(NEW) - ARRAY[
      'username', 'full_name', 'working_hours', 'break_time', 'job_role',
      'default_sign_in', 'default_sign_out', 'requested_full_name',
      'requested_working_hours', 'requested_break_time', 'requested_job_role',
      'requested_default_sign_in', 'requested_default_sign_out',
      'profile_change_status', 'has_edited_profile',
      'global_settings'
    ]) IS DISTINCT FROM
    (to_jsonb(OLD) - ARRAY[
      'username', 'full_name', 'working_hours', 'break_time', 'job_role',
      'default_sign_in', 'default_sign_out', 'requested_full_name',
      'requested_working_hours', 'requested_break_time', 'requested_job_role',
      'requested_default_sign_in', 'requested_default_sign_out',
      'profile_change_status', 'has_edited_profile',
      'global_settings'
    ]) THEN
      RAISE EXCEPTION 'Users cannot modify roles, permissions, quotas, or supervisor assignments.';
    END IF;

    IF NEW.username IS DISTINCT FROM OLD.username AND OLD.has_changed_password IS TRUE THEN
      RAISE EXCEPTION 'Codename changes after onboarding require an authorized administrator.';
    END IF;

    IF (COALESCE(NEW.global_settings, '{}'::jsonb) - v_safe_global_keys)
       IS DISTINCT FROM
       (COALESCE(OLD.global_settings, '{}'::jsonb) - v_safe_global_keys) THEN
      RAISE EXCEPTION 'Users cannot modify privileged global settings.';
    END IF;

    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Unauthorized profile modification.';
END;
$$;

CREATE OR REPLACE FUNCTION public.archive_and_prune_old_records(p_tz text DEFAULT 'Asia/Dhaka'::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_current_year INT := EXTRACT(YEAR FROM timezone(p_tz, now()))::INT;
  v_year INT;
  v_archived_users INT := 0;
  v_total_deleted INT := 0;
  v_years_archived INT[] := ARRAY[]::INT[];
  v_purged INT;
BEGIN
  IF auth.role() != 'service_role' AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Permission denied: only admins or service_role can archive and prune old records.';
  END IF;

  FOR v_year IN
    SELECT DISTINCT EXTRACT(YEAR FROM timezone(p_tz, r.submitted_at))::INT
    FROM public.records r
    WHERE EXTRACT(YEAR FROM timezone(p_tz, r.submitted_at))::INT < v_current_year - 2
    ORDER BY 1
  LOOP
    INSERT INTO public.leaderboard_archive
      (user_id, username, full_name, job_role, branch, year,
       quotes_count, requotes_count, reviews_count, sales_count,
       total_submitted, rank)
    WITH year_stats AS (
      SELECT
        r.user_id,
        COUNT(*) FILTER (WHERE r.file_type != 'Other Site')::INT AS total_submitted,
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
      DENSE_RANK() OVER (ORDER BY ys.total_submitted DESC, COALESCE(p.username, ys.user_id::text) ASC)::INT AS rank
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
    v_years_archived := array_append(v_years_archived, v_year);
  END LOOP;

  DELETE FROM public.records r
  WHERE EXTRACT(YEAR FROM timezone(p_tz, r.submitted_at))::INT < v_current_year - 2;
  GET DIAGNOSTICS v_total_deleted = ROW_COUNT;

  DELETE FROM public.audit_logs al
  WHERE EXTRACT(YEAR FROM timezone(p_tz, al.created_at))::INT < v_current_year - 2;
  GET DIAGNOSTICS v_purged = ROW_COUNT;

  RETURN jsonb_build_object(
    'status', 'success',
    'years_archived', v_years_archived,
    'records_deleted', v_total_deleted,
    'audit_logs_purged', v_purged,
    'archive_rows_upserted', v_archived_users
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_top_performer_badges() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_prev_month date := (date_trunc('month', current_date) - interval '1 month')::date;
  v_current_year integer := extract(year FROM current_date)::integer;
  v_user record;
  v_badge jsonb;
BEGIN
  IF session_user NOT IN ('postgres', 'supabase_admin') AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Badge synchronization is a scheduled system operation.';
  END IF;

  PERFORM set_config('app.bypass_profile_security', 'true', true);

  WITH monthly_counts AS (
    SELECT r.user_id,
           date_trunc('month', r.submitted_at AT TIME ZONE 'Asia/Dhaka')::date AS month_start,
           count(*) FILTER (WHERE r.file_type != 'Other Site') AS record_count,
           p.username
    FROM public.records r
    JOIN public.profiles p ON p.id = r.user_id
    WHERE r.submitted_at >= ((v_prev_month - interval '24 months')::timestamp AT TIME ZONE 'Asia/Dhaka')
      AND r.submitted_at < ((v_prev_month + interval '1 month')::timestamp AT TIME ZONE 'Asia/Dhaka')
    GROUP BY r.user_id, date_trunc('month', r.submitted_at AT TIME ZONE 'Asia/Dhaka')::date, p.username
  ),
  monthly_ranks AS (
    SELECT user_id,
           month_start,
           row_number() OVER (PARTITION BY month_start ORDER BY record_count DESC, upper(username), user_id) AS rank
    FROM monthly_counts
  )
  UPDATE public.profiles p
  SET global_settings = COALESCE(p.global_settings, '{}'::jsonb) - 'top_performer_badge'
  WHERE p.global_settings ? 'top_performer_badge'
    AND NOT EXISTS (
      SELECT 1 FROM monthly_ranks r
      WHERE r.user_id = p.id AND r.month_start = v_prev_month AND r.rank <= 5
    );

  FOR v_user IN
    WITH monthly_counts AS (
      SELECT r.user_id,
             date_trunc('month', r.submitted_at AT TIME ZONE 'Asia/Dhaka')::date AS month_start,
             count(*) FILTER (WHERE r.file_type != 'Other Site') AS record_count,
             p.username
      FROM public.records r
      JOIN public.profiles p ON p.id = r.user_id
      WHERE r.submitted_at >= ((v_prev_month - interval '24 months')::timestamp AT TIME ZONE 'Asia/Dhaka')
        AND r.submitted_at < ((v_prev_month + interval '1 month')::timestamp AT TIME ZONE 'Asia/Dhaka')
      GROUP BY r.user_id, date_trunc('month', r.submitted_at AT TIME ZONE 'Asia/Dhaka')::date, p.username
    ),
    monthly_ranks AS (
      SELECT user_id,
             month_start,
             row_number() OVER (PARTITION BY month_start ORDER BY record_count DESC, upper(username), user_id) AS rank
      FROM monthly_counts
    ),
    current_top AS (
      SELECT user_id, rank
      FROM monthly_ranks
      WHERE month_start = v_prev_month AND rank <= 5
    )
    SELECT
      ct.user_id,
      ct.rank,
      (
        SELECT COALESCE(min(offset_value), 25)::integer
        FROM generate_series(0, 24) offset_value
        WHERE NOT EXISTS (
          SELECT 1
          FROM monthly_ranks r
          WHERE r.user_id = ct.user_id
            AND r.month_start = (v_prev_month - (offset_value || ' months')::interval)::date
            AND r.rank <= 5
        )
      ) AS consecutive_months,
      (
        SELECT count(DISTINCT month_start)::integer
        FROM monthly_ranks r
        WHERE r.user_id = ct.user_id
          AND r.rank <= 5
          AND extract(year FROM month_start)::integer = v_current_year
      ) AS yearly_wins
    FROM current_top ct
    ORDER BY ct.rank
  LOOP
    v_badge := jsonb_build_object(
      'userId', v_user.user_id,
      'rank', v_user.rank,
      'badgeType', CASE WHEN v_user.rank <= 3 THEN 'blue' ELSE 'grey' END,
      'monthName', to_char(v_prev_month, 'FMMonth'),
      'consecutiveMonths', v_user.consecutive_months,
      'yearlyTopPerformances', v_user.yearly_wins
    );

    UPDATE public.profiles
    SET global_settings = COALESCE(global_settings, '{}'::jsonb) || jsonb_build_object('top_performer_badge', v_badge)
    WHERE id = v_user.user_id
      AND global_settings->'top_performer_badge' IS DISTINCT FROM v_badge;
  END LOOP;
END;
$$;
