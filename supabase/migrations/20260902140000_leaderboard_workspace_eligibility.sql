-- Migration: Enforce Quotes Workspace eligibility in Leaderboard and Top Performer Badges
-- Users with has_quotes_access = false / null are excluded from Leaderboard calculations and rankings.

CREATE OR REPLACE FUNCTION public.get_leaderboard_data(
    p_year text,
    p_month text,
    p_period text,
    p_today text,
    p_tz text DEFAULT 'UTC'::text
) RETURNS TABLE(
    user_id uuid,
    username text,
    full_name text,
    role text,
    job_role text,
    branch text,
    badge jsonb,
    quotes_count integer,
    requotes_count integer,
    reviews_count integer,
    sales_count integer,
    total_submitted integer,
    todays_count integer,
    months_count integer,
    overall_score integer,
    earliest_achievement_timestamp timestamp with time zone,
    rank integer
)
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
  WHERE p.has_quotes_access IS TRUE
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
    WHERE p.has_quotes_access IS TRUE
      AND r.submitted_at >= ((v_prev_month - interval '24 months')::timestamp AT TIME ZONE 'Asia/Dhaka')
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
