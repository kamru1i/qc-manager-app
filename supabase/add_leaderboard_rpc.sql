-- get_leaderboard_data: per-employee submission aggregates + live dense ranks,
-- computed server-side so clients never download the full records table.
-- All date bucketing happens in the caller's timezone (p_tz) so counts match
-- what the frontend computes locally with new Date(...).getMonth()/getFullYear().
DROP FUNCTION IF EXISTS public.get_leaderboard_data(TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.get_leaderboard_data(TEXT, TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.get_leaderboard_data(
  p_year TEXT,
  p_month TEXT,
  p_period TEXT,
  p_today TEXT,
  p_tz TEXT DEFAULT 'UTC'
)
RETURNS TABLE (
  user_id UUID,
  username TEXT,
  full_name TEXT,
  role TEXT,
  job_role TEXT,
  branch TEXT,
  badge JSONB,
  quotes_count INT,
  requotes_count INT,
  reviews_count INT,
  sales_count INT,
  total_submitted INT,
  todays_count INT,
  months_count INT,
  overall_score INT,
  earliest_achievement_timestamp TIMESTAMPTZ,
  rank INT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
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

REVOKE ALL ON FUNCTION public.get_leaderboard_data(TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_leaderboard_data(TEXT, TEXT, TEXT, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_leaderboard_data(TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_leaderboard_data(TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role;

-- Refresh PostgREST schema cache so the new function is callable immediately
NOTIFY pgrst, 'reload schema';
