-- Migration: 20260820220000_fix_quotation_permissions_and_rpc_guards.sql
-- Description: Ensure full quotation visibility for Supervisor, Admin, and Superadmin while maintaining strict user isolation.

-- 1. Update get_admin_sales_summary RPC to allow Supervisors in addition to Admins and Superadmins
CREATE OR REPLACE FUNCTION public.get_admin_sales_summary(p_today text, p_tz text DEFAULT 'UTC'::text)
RETURNS TABLE(total_sold integer, total_unsold integer, total_attempts integer)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF NOT public.is_admin_or_supervisor() THEN
    RAISE EXCEPTION 'Permission denied: Only admins and supervisors can view sales summary.';
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

REVOKE ALL ON FUNCTION public.get_admin_sales_summary(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_sales_summary(text, text) TO authenticated, service_role;

-- 2. Update get_available_record_months RPC to scope normal users to their own records while allowing Supervisors/Admins/Superadmins full range
CREATE OR REPLACE FUNCTION public.get_available_record_months(p_user_id uuid DEFAULT NULL::uuid, p_tz text DEFAULT 'Asia/Dhaka'::text)
RETURNS TABLE(year text, month text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_effective_user_id uuid := p_user_id;
BEGIN
  IF auth.uid() IS NULL AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  -- Normal users are restricted to their own submitted months
  IF NOT public.is_admin_or_supervisor() THEN
    v_effective_user_id := auth.uid();
  END IF;

  RETURN QUERY
  SELECT to_char(date_trunc('month', r.submitted_at AT TIME ZONE p_tz), 'YYYY'),
         to_char(date_trunc('month', r.submitted_at AT TIME ZONE p_tz), 'MM')
  FROM public.records r
  WHERE v_effective_user_id IS NULL OR r.user_id = v_effective_user_id
  GROUP BY date_trunc('month', r.submitted_at AT TIME ZONE p_tz)
  ORDER BY date_trunc('month', r.submitted_at AT TIME ZONE p_tz);
END;
$$;

REVOKE ALL ON FUNCTION public.get_available_record_months(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_available_record_months(uuid, text) TO authenticated, service_role;

-- 3. Update records table RLS policies:
-- Users see/modify their own records; Supervisors, Admins, and Superadmins have full quotation visibility and management.
DROP POLICY IF EXISTS "Allow authenticated users to read all records" ON public.records;
DROP POLICY IF EXISTS "Scoped records read access" ON public.records;
DROP POLICY IF EXISTS "Allow users to insert own records, admins/supervisors insert al" ON public.records;
DROP POLICY IF EXISTS "Scoped records insertion" ON public.records;
DROP POLICY IF EXISTS "Allow users to update own records, admins/supervisors update al" ON public.records;
DROP POLICY IF EXISTS "Scoped records updates" ON public.records;
DROP POLICY IF EXISTS "Allow users to delete own records, admins/supervisors delete al" ON public.records;
DROP POLICY IF EXISTS "Scoped records deletion" ON public.records;

CREATE POLICY "Scoped records read access"
ON public.records FOR SELECT TO authenticated
USING (
  public.current_user_has_workspace('quotes')
  AND (
    user_id = (SELECT auth.uid())
    OR public.is_admin_or_supervisor()
  )
);

CREATE POLICY "Scoped records insertion"
ON public.records FOR INSERT TO authenticated
WITH CHECK (
  public.current_user_has_workspace('quotes')
  AND (
    user_id = (SELECT auth.uid())
    OR public.is_admin_or_supervisor()
  )
);

CREATE POLICY "Scoped records updates"
ON public.records FOR UPDATE TO authenticated
USING (
  public.current_user_has_workspace('quotes')
  AND (
    user_id = (SELECT auth.uid())
    OR public.is_admin_or_supervisor()
  )
)
WITH CHECK (
  public.current_user_has_workspace('quotes')
  AND (
    user_id = (SELECT auth.uid())
    OR public.is_admin_or_supervisor()
  )
);

CREATE POLICY "Scoped records deletion"
ON public.records FOR DELETE TO authenticated
USING (
  public.current_user_has_workspace('quotes')
  AND (
    user_id = (SELECT auth.uid())
    OR public.is_admin_or_supervisor()
  )
);
