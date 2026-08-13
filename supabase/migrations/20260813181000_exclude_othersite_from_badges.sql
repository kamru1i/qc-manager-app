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

  CREATE TEMP TABLE tmp_monthly_ranks ON COMMIT DROP AS
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
