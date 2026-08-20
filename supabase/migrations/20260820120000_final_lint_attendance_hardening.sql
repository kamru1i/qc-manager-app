-- Final forensic hardening follow-up:
-- - fixes live DB lint/runtime function defects
-- - scopes the attendance module RLS introduced outside tracked migration history
-- - keeps new attendance realtime usable while relying on client-side user filters

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE((
    SELECT p.role
    FROM public.profiles p
    WHERE p.id = (SELECT auth.uid())
  ), 'none');
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_superadmin(user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = $1
      AND role IN ('admin', 'superadmin')
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin_or_superadmin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin_or_superadmin(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.handle_attendance_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.attendance_daily') IS NOT NULL THEN
    ALTER TABLE public.attendance_daily ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "attendance_daily_select_all" ON public.attendance_daily;
    DROP POLICY IF EXISTS "attendance_daily_select_scoped" ON public.attendance_daily;
    CREATE POLICY "attendance_daily_select_scoped" ON public.attendance_daily
      FOR SELECT TO authenticated
      USING (
        auth.uid() = user_id
        OR public.is_admin_or_superadmin(auth.uid())
        OR public.has_leave_access(auth.uid(), user_id)
      );

    DROP POLICY IF EXISTS "attendance_daily_insert_own_or_admin" ON public.attendance_daily;
    CREATE POLICY "attendance_daily_insert_own_or_admin" ON public.attendance_daily
      FOR INSERT TO authenticated
      WITH CHECK (auth.uid() = user_id OR public.is_admin_or_superadmin(auth.uid()));

    DROP POLICY IF EXISTS "attendance_daily_update_own_or_admin" ON public.attendance_daily;
    CREATE POLICY "attendance_daily_update_own_or_admin" ON public.attendance_daily
      FOR UPDATE TO authenticated
      USING (auth.uid() = user_id OR public.is_admin_or_superadmin(auth.uid()))
      WITH CHECK (auth.uid() = user_id OR public.is_admin_or_superadmin(auth.uid()));

    DROP POLICY IF EXISTS "attendance_daily_delete_admin" ON public.attendance_daily;
    CREATE POLICY "attendance_daily_delete_admin" ON public.attendance_daily
      FOR DELETE TO authenticated
      USING (public.is_admin_or_superadmin(auth.uid()));
  END IF;

  IF to_regclass('public.attendance_breaks') IS NOT NULL THEN
    ALTER TABLE public.attendance_breaks ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "attendance_breaks_select_all" ON public.attendance_breaks;
    DROP POLICY IF EXISTS "attendance_breaks_select_scoped" ON public.attendance_breaks;
    CREATE POLICY "attendance_breaks_select_scoped" ON public.attendance_breaks
      FOR SELECT TO authenticated
      USING (
        auth.uid() = user_id
        OR public.is_admin_or_superadmin(auth.uid())
        OR public.has_leave_access(auth.uid(), user_id)
      );

    DROP POLICY IF EXISTS "attendance_breaks_insert_own_or_admin" ON public.attendance_breaks;
    CREATE POLICY "attendance_breaks_insert_own_or_admin" ON public.attendance_breaks
      FOR INSERT TO authenticated
      WITH CHECK (
        public.is_admin_or_superadmin(auth.uid())
        OR (
          auth.uid() = user_id
          AND EXISTS (
            SELECT 1
            FROM public.attendance_daily d
            WHERE d.id = attendance_id
              AND d.user_id = attendance_breaks.user_id
              AND d.attendance_date = attendance_breaks.attendance_date
          )
        )
      );

    DROP POLICY IF EXISTS "attendance_breaks_update_own_or_admin" ON public.attendance_breaks;
    CREATE POLICY "attendance_breaks_update_own_or_admin" ON public.attendance_breaks
      FOR UPDATE TO authenticated
      USING (auth.uid() = user_id OR public.is_admin_or_superadmin(auth.uid()))
      WITH CHECK (
        public.is_admin_or_superadmin(auth.uid())
        OR (
          auth.uid() = user_id
          AND EXISTS (
            SELECT 1
            FROM public.attendance_daily d
            WHERE d.id = attendance_id
              AND d.user_id = attendance_breaks.user_id
              AND d.attendance_date = attendance_breaks.attendance_date
          )
        )
      );

    DROP POLICY IF EXISTS "attendance_breaks_delete_admin" ON public.attendance_breaks;
    CREATE POLICY "attendance_breaks_delete_admin" ON public.attendance_breaks
      FOR DELETE TO authenticated
      USING (public.is_admin_or_superadmin(auth.uid()));
  END IF;
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
  WHERE EXTRACT(YEAR FROM timezone(p_tz, al.changed_at))::INT < v_current_year - 2;
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

CREATE OR REPLACE FUNCTION public.create_configured_user(
  p_email text,
  p_password text,
  p_username text,
  p_role text,
  p_full_name text,
  p_profile_options jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_supervisor_ids uuid[];
  v_allowed_types text[];
  v_working_hours numeric;
  v_break_time numeric;
  v_default_sign_in text;
  v_default_sign_out text;
  v_actor_name text;
BEGIN
  IF jsonb_typeof(COALESCE(p_profile_options, '{}'::jsonb)) <> 'object' THEN
    RAISE EXCEPTION 'Profile options must be a JSON object.';
  END IF;

  SELECT COALESCE(array_agg(value::uuid), ARRAY[]::uuid[])
  INTO v_supervisor_ids
  FROM jsonb_array_elements_text(
    CASE WHEN jsonb_typeof(p_profile_options->'supervisor_ids') = 'array'
      THEN p_profile_options->'supervisor_ids' ELSE '[]'::jsonb END
  );

  SELECT COALESCE(array_agg(value), ARRAY[]::text[])
  INTO v_allowed_types
  FROM jsonb_array_elements_text(
    CASE WHEN jsonb_typeof(p_profile_options->'allowed_types') = 'array'
      THEN p_profile_options->'allowed_types' ELSE '[]'::jsonb END
  );

  v_working_hours := COALESCE((p_profile_options->>'working_hours')::numeric, 9.5);
  v_break_time := COALESCE((p_profile_options->>'break_time')::numeric, 0);
  IF v_working_hours <= 0 OR v_working_hours > 24 OR v_break_time < 0 OR v_break_time > 24 THEN
    RAISE EXCEPTION 'Invalid working-hours or break-time value.';
  END IF;

  v_default_sign_in := NULLIF(btrim(p_profile_options->>'default_sign_in'), '');
  v_default_sign_out := NULLIF(btrim(p_profile_options->>'default_sign_out'), '');
  IF v_default_sign_in IS NOT NULL THEN
    PERFORM v_default_sign_in::time;
  END IF;
  IF v_default_sign_out IS NOT NULL THEN
    PERFORM v_default_sign_out::time;
  END IF;

  v_user_id := public.create_new_user(
    p_email,
    p_password,
    p_username,
    p_role,
    p_full_name,
    COALESCE((p_profile_options->>'needs_supervisor_approval')::boolean, false),
    COALESCE((p_profile_options->>'allow_reserve')::boolean, false),
    COALESCE((p_profile_options->>'allow_overtime')::boolean, false),
    v_supervisor_ids
  );

  PERFORM set_config('app.bypass_profile_security', 'true', true);
  UPDATE public.profiles
  SET allowed_types = v_allowed_types,
      can_manage_rules = COALESCE((p_profile_options->>'can_manage_rules')::boolean, false),
      has_chuti_access = COALESCE((p_profile_options->>'has_chuti_access')::boolean, true),
      has_quotes_access = COALESCE((p_profile_options->>'has_quotes_access')::boolean, true),
      eligible_govt_holiday = COALESCE((p_profile_options->>'eligible_govt_holiday')::boolean, true),
      eligible_office_leave = COALESCE((p_profile_options->>'eligible_office_leave')::boolean, true),
      job_role = NULLIF(btrim(p_profile_options->>'job_role'), ''),
      working_hours = v_working_hours,
      break_time = v_break_time,
      default_sign_in = COALESCE(v_default_sign_in, default_sign_in),
      default_sign_out = COALESCE(v_default_sign_out, default_sign_out),
      global_settings = COALESCE(global_settings, '{}'::jsonb) || jsonb_build_object(
        'kpi_skills', CASE WHEN jsonb_typeof(p_profile_options->'kpi_skills') = 'array' THEN p_profile_options->'kpi_skills' ELSE '[]'::jsonb END,
        'kpi_dept_indicators', CASE WHEN jsonb_typeof(p_profile_options->'kpi_dept_indicators') = 'array' THEN p_profile_options->'kpi_dept_indicators' ELSE '[]'::jsonb END,
        'kpi_other_dept_indicators', CASE WHEN jsonb_typeof(p_profile_options->'kpi_other_dept_indicators') = 'array' THEN p_profile_options->'kpi_other_dept_indicators' ELSE '[]'::jsonb END,
        'performs_data_entry', COALESCE((p_profile_options->>'performs_data_entry')::boolean, true),
        'department', COALESCE(NULLIF(btrim(p_profile_options->>'department'), ''), 'Data Entry'),
        'performs_other_dept_tasks', COALESCE((p_profile_options->>'performs_other_dept_tasks')::boolean, false),
        'other_department', COALESCE(NULLIF(btrim(p_profile_options->>'other_department'), ''), 'IT')
      )
  WHERE id = v_user_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'New profile was not created.'; END IF;

  SELECT username INTO v_actor_name FROM public.profiles WHERE id = auth.uid();
  INSERT INTO public.audit_logs (
    actor_id, actor_codename, action_type, target_id, target_user_id, details, metadata
  ) VALUES (
    auth.uid(), COALESCE(v_actor_name, 'System'), 'CREATE_USER', v_user_id::text,
    v_user_id, 'User account created', jsonb_build_object('role', p_role, 'username', upper(btrim(p_username)))
  );

  RETURN v_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_leaderboard_data(p_year text, p_month text, p_period text, p_today text, p_tz text DEFAULT 'UTC'::text) RETURNS TABLE(user_id uuid, username text, full_name text, role text, job_role text, branch text, badge jsonb, quotes_count integer, requotes_count integer, reviews_count integer, sales_count integer, total_submitted integer, todays_count integer, months_count integer, overall_score integer, earliest_achievement_timestamp timestamp with time zone, rank integer)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_month_start timestamptz;
  v_month_end   timestamptz;
  v_year_start  timestamptz;
  v_year_end    timestamptz;
  v_today_start timestamptz;
  v_today_end   timestamptz;
BEGIN
  p_period := COALESCE(p_period, '');

  v_month_start := (make_date(p_year::int, p_month::int, 1)::timestamp AT TIME ZONE p_tz);
  v_month_end   := ((make_date(p_year::int, p_month::int, 1) + interval '1 month')::timestamp AT TIME ZONE p_tz);

  v_year_start  := (make_date(p_year::int, 1, 1)::timestamp AT TIME ZONE p_tz);
  v_year_end    := ((make_date(p_year::int, 1, 1) + interval '1 year')::timestamp AT TIME ZONE p_tz);

  v_today_start := ((p_today::date)::timestamp AT TIME ZONE p_tz);
  v_today_end   := (((p_today::date + 1))::timestamp AT TIME ZONE p_tz);

  RETURN QUERY
  WITH selected_month_stats AS (
    SELECT
      r.user_id,
      COUNT(*) FILTER (WHERE r.file_type != 'Other Site')::INT AS months_count,
      COUNT(*) FILTER (WHERE r.file_type = 'Quote')::INT AS quotes_count,
      COUNT(*) FILTER (WHERE r.file_type IN ('Requote', 'Requote Van', 'Requote Bike'))::INT AS requotes_count,
      COUNT(*) FILTER (WHERE r.file_type LIKE '%Review%')::INT AS reviews_count,
      COUNT(*) FILTER (WHERE r.file_type = 'Sale')::INT AS sales_count,
      MAX(r.submitted_at) FILTER (WHERE r.file_type != 'Other Site') AS earliest_achievement_timestamp
    FROM public.records r
    WHERE r.submitted_at >= v_month_start AND r.submitted_at < v_month_end
    GROUP BY r.user_id
  ),
  selected_year_stats AS (
    SELECT
      r.user_id,
      COUNT(*) FILTER (WHERE r.file_type != 'Other Site')::INT AS years_count
    FROM public.records r
    WHERE r.submitted_at >= v_year_start AND r.submitted_at < v_year_end
    GROUP BY r.user_id
  ),
  today_stats AS (
    SELECT
      r.user_id,
      COUNT(*) FILTER (WHERE r.file_type != 'Other Site')::INT AS todays_count
    FROM public.records r
    WHERE r.submitted_at >= v_today_start AND r.submitted_at < v_today_end
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

CREATE OR REPLACE FUNCTION public.sync_top_performer_badges() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_prev_month date := (date_trunc('month', current_date) - interval '1 month')::date;
  v_current_year integer := extract(year FROM current_date)::integer;
  v_user record;
  v_consecutive integer;
  v_yearly_wins integer;
  v_badge jsonb;
BEGIN
  IF session_user NOT IN ('postgres', 'supabase_admin') AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Badge synchronization is a scheduled system operation.';
  END IF;

  PERFORM set_config('app.bypass_profile_security', 'true', true);

  DROP TABLE IF EXISTS tmp_monthly_ranks;
  CREATE TEMP TABLE tmp_monthly_ranks (
    user_id uuid NOT NULL,
    month_start date NOT NULL,
    rank bigint NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO tmp_monthly_ranks (user_id, month_start, rank)
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
  )
  SELECT user_id,
         month_start,
         row_number() OVER (PARTITION BY month_start ORDER BY record_count DESC, upper(username), user_id) AS rank
  FROM monthly_counts;

  UPDATE public.profiles p
  SET global_settings = COALESCE(p.global_settings, '{}'::jsonb) - 'top_performer_badge'
  WHERE p.global_settings ? 'top_performer_badge'
    AND NOT EXISTS (
      SELECT 1 FROM tmp_monthly_ranks r
      WHERE r.user_id = p.id AND r.month_start = v_prev_month AND r.rank <= 5
    );

  FOR v_user IN
    SELECT user_id, rank
    FROM tmp_monthly_ranks
    WHERE month_start = v_prev_month AND rank <= 5
    ORDER BY rank
  LOOP
    SELECT COALESCE(min(offset_value), 25)
    INTO v_consecutive
    FROM generate_series(0, 24) offset_value
    WHERE NOT EXISTS (
      SELECT 1 FROM tmp_monthly_ranks r
      WHERE r.user_id = v_user.user_id
        AND r.month_start = (v_prev_month - (offset_value || ' months')::interval)::date
        AND r.rank <= 5
    );

    SELECT count(DISTINCT month_start)::integer INTO v_yearly_wins
    FROM tmp_monthly_ranks
    WHERE user_id = v_user.user_id
      AND rank <= 5
      AND extract(year FROM month_start)::integer = v_current_year;

    v_badge := jsonb_build_object(
      'userId', v_user.user_id,
      'rank', v_user.rank,
      'badgeType', CASE WHEN v_user.rank <= 3 THEN 'blue' ELSE 'grey' END,
      'monthName', to_char(v_prev_month, 'FMMonth'),
      'consecutiveMonths', v_consecutive,
      'yearlyTopPerformances', v_yearly_wins
    );

    UPDATE public.profiles
    SET global_settings = COALESCE(global_settings, '{}'::jsonb) || jsonb_build_object('top_performer_badge', v_badge)
    WHERE id = v_user.user_id
      AND global_settings->'top_performer_badge' IS DISTINCT FROM v_badge;
  END LOOP;
END;
$$;
