-- Fix Bug 6 (H7): Add admin role guard to get_admin_sales_summary
CREATE OR REPLACE FUNCTION public.get_admin_sales_summary(p_today text, p_tz text DEFAULT 'UTC'::text) 
RETURNS TABLE(total_sold integer, total_unsold integer, total_attempts integer)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Permission denied: Only admins can view sales summary.';
  END IF;

  RETURN QUERY
  WITH todays_sales AS (
    SELECT
      upper(btrim(regexp_replace(r.file_name, ' \[(SOLD|UNSOLD)\]$', ''))) AS file_key,
      (r.file_name LIKE '% [SOLD]') AS is_sold,
      r.submitted_at
    FROM public.records r
    WHERE r.file_type = 'Sale'
      AND r.submitted_at >= ((p_today::date)::timestamp AT TIME ZONE p_tz)
      AND r.submitted_at <  ((p_today::date + 1)::timestamp AT TIME ZONE p_tz)
  ),
  per_file AS (
    SELECT
      file_key,
      COUNT(*) FILTER (WHERE is_sold)::INT AS sold_count,
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
END;
$$;

-- Fix Bug 5 (H2): Team-scoped records RLS policies for supervisors
DROP POLICY IF EXISTS "Allow users to delete own records, admins/supervisors delete al" ON public.records;
CREATE POLICY "Allow users to delete own records, admins/supervisors delete al" ON public.records 
FOR DELETE TO authenticated 
USING (((auth.uid() = user_id) OR public.is_admin() OR (public.is_supervisor() AND public.has_leave_access(auth.uid(), user_id))));

DROP POLICY IF EXISTS "Allow users to insert own records, admins/supervisors insert al" ON public.records;
CREATE POLICY "Allow users to insert own records, admins/supervisors insert al" ON public.records 
FOR INSERT TO authenticated 
WITH CHECK (((auth.uid() = user_id) OR public.is_admin() OR (public.is_supervisor() AND public.has_leave_access(auth.uid(), user_id))));

DROP POLICY IF EXISTS "Allow users to update own records, admins/supervisors update al" ON public.records;
CREATE POLICY "Allow users to update own records, admins/supervisors update al" ON public.records 
FOR UPDATE TO authenticated 
USING (((auth.uid() = user_id) OR public.is_admin() OR (public.is_supervisor() AND public.has_leave_access(auth.uid(), user_id)))) 
WITH CHECK (((auth.uid() = user_id) OR public.is_admin() OR (public.is_supervisor() AND public.has_leave_access(auth.uid(), user_id))));
