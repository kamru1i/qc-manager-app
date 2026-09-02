-- Migration: Add yearly submission tie-breaker to get_leaderboard_data RPC
-- Rule:
-- 1. Order primarily by months_count DESC
-- 2. If months_count is equal, compare years_count (overall_score) DESC
-- 3. If both are equal, order by earliest_achievement_timestamp ASC NULLS LAST, then p.username ASC
-- 4. Produces sequential serial ranking consistent with Navbar display

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
  v_month_start timestamp with time zone;
  v_month_end timestamp with time zone;
  v_year_start timestamp with time zone;
  v_year_end timestamp with time zone;
  v_today_start timestamp with time zone;
  v_today_end timestamp with time zone;
  v_month_int integer;
  v_year_int integer;
BEGIN
  v_year_int := p_year::integer;
  v_month_int := p_month::integer;

  v_month_start := (p_year || '-' || lpad(p_month, 2, '0') || '-01 00:00:00')::timestamp AT TIME ZONE p_tz;
  v_month_end := (v_month_start + interval '1 month');

  v_year_start := (p_year || '-01-01 00:00:00')::timestamp AT TIME ZONE p_tz;
  v_year_end := (v_year_start + interval '1 year');

  v_today_start := (p_today || ' 00:00:00')::timestamp AT TIME ZONE p_tz;
  v_today_end := (v_today_start + interval '1 day');

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
        COALESCE(sys.years_count, 0) DESC,
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
