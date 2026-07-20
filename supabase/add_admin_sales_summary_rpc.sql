-- get_admin_sales_summary: today's overall (all-users) sales report with
-- episode-based deduplication, computed server-side.
--
-- Why an RPC: RLS only lets regular users read their OWN records, but the
-- Copy Helper "Sales Report for Admin" box must aggregate every user's Sale
-- submissions for today. SECURITY DEFINER exposes only the aggregate counts
-- (never raw rows), mirroring the get_leaderboard_data pattern.
--
-- Attempt/episode model (per unique file name, chronological order):
--   - a run of UNSOLD submissions is ONE pending attempt
--   - a SOLD submission closes the attempt as Sold (prior unsolds absorbed)
--   - entries after a SOLD are a NEW attempt (same name, different details),
--     so every SOLD entry counts as its own sale
--   - a trailing unsold run that never gets sold counts as 1 Unsold
-- Therefore per file: sold = count of [SOLD] entries;
-- unsold = 1 if the latest entry is not [SOLD], else 0.
DROP FUNCTION IF EXISTS public.get_admin_sales_summary(TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.get_admin_sales_summary(
  p_today TEXT,
  p_tz TEXT DEFAULT 'UTC'
)
RETURNS TABLE (
  total_sold INT,
  total_unsold INT,
  total_attempts INT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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
$$;

REVOKE ALL ON FUNCTION public.get_admin_sales_summary(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_admin_sales_summary(TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_admin_sales_summary(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_sales_summary(TEXT, TEXT) TO service_role;

-- Index so the daily aggregate never scans non-Sale rows or other days
CREATE INDEX IF NOT EXISTS idx_records_sale_submitted
  ON public.records USING btree (submitted_at)
  WHERE file_type = 'Sale';

-- Refresh PostgREST schema cache so the new function is callable immediately
NOTIFY pgrst, 'reload schema';
