-- Fix: sync_top_performer_badges previously rewrote EVERY profile row on each run.
--
-- The badge-removal UPDATE had no filter on whether a badge actually existed, so
-- Postgres created a new row version for every non-top-5 profile even when nothing
-- changed. Each rewritten row emits a realtime UPDATE event to every connected
-- client, and since the app triggers this RPC on mount, realtime message usage
-- scaled as (mounts x profiles x connected clients).
--
-- Changes vs fix_badge_sync_security.sql:
--   1. Badge removal only touches rows that actually HAVE a top_performer_badge key.
--   2. Badge assignment only writes when the computed badge JSON differs from the
--      currently stored one (IS DISTINCT FROM), so repeat runs in the same month
--      are pure no-ops with zero row rewrites and zero realtime events.
-- Logic and output are otherwise identical.

CREATE OR REPLACE FUNCTION public.sync_top_performer_badges()
RETURNS void AS $$
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

  -- ক. আগের মাসের টপ ৫ পারফর্মারদের একটি সাময়িক টেবিল তৈরি করা
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
  -- Only rows that actually carry a badge — skip the no-op rewrites.
  UPDATE public.profiles
  SET global_settings = global_settings - 'top_performer_badge'
  WHERE id NOT IN (SELECT user_id FROM temp_top_5)
    AND global_settings ? 'top_performer_badge';

  -- গ. টপ ৫ পারফর্মারদের লুপ চালিয়ে ধারাবাহিকতা (streaks) ও বার্ষিক উইন ক্যালকুলেট করে আপডেট করা
  FOR r_user IN (SELECT * FROM temp_top_5) LOOP
    v_rank := r_user.rank;
    v_badge_type := CASE WHEN v_rank <= 3 THEN 'blue' ELSE 'grey' END;

    -- কন্টিনিউয়াস মান্থলি স্ট্রাক ক্যালকুলেশন
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
    -- Only write when the badge actually changed — repeat runs are no-ops.
    UPDATE public.profiles
    SET global_settings = COALESCE(global_settings, '{}'::JSONB) || JSONB_BUILD_OBJECT('top_performer_badge', v_badge_json)
    WHERE id = r_user.user_id
      AND (global_settings->'top_performer_badge') IS DISTINCT FROM v_badge_json;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
