-- Migration: Dynamic mistake filter options metadata RPC
-- Provides distinct branches and distinct year/month pairs from actual submitted quotation_mistakes
-- Scoped to user's permitted mistakes (enforces role/RLS boundaries)

CREATE OR REPLACE FUNCTION public.get_available_mistake_filters(
    p_user_id uuid DEFAULT NULL::uuid,
    p_tz text DEFAULT 'Asia/Dhaka'::text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_effective_user_id uuid := p_user_id;
  v_branches jsonb;
  v_dates jsonb;
BEGIN
  IF auth.uid() IS NULL AND auth.role() <> 'service_role' THEN
    IF session_user NOT IN ('postgres', 'supabase_admin') THEN
      RAISE EXCEPTION 'Authentication required.';
    END IF;
  END IF;

  -- Normal users are restricted to their own submitted mistakes
  IF auth.uid() IS NOT NULL AND NOT public.is_admin_or_supervisor() THEN
    v_effective_user_id := auth.uid();
  END IF;

  -- 1. Distinct branches from active mistakes
  SELECT COALESCE(jsonb_agg(DISTINCT branch ORDER BY branch ASC), '[]'::jsonb)
  INTO v_branches
  FROM public.quotation_mistakes
  WHERE (v_effective_user_id IS NULL OR user_id = v_effective_user_id)
    AND branch IS NOT NULL AND TRIM(branch) <> '';

  -- 2. Distinct year/month pairs from active mistakes
  SELECT COALESCE(jsonb_agg(d ORDER BY d->>'year' DESC, d->>'month' ASC), '[]'::jsonb)
  INTO v_dates
  FROM (
    SELECT jsonb_build_object(
      'year', to_char(date, 'YYYY'),
      'month', to_char(date, 'MM')
    ) AS d
    FROM public.quotation_mistakes
    WHERE (v_effective_user_id IS NULL OR user_id = v_effective_user_id)
      AND date IS NOT NULL
    GROUP BY to_char(date, 'YYYY'), to_char(date, 'MM')
  ) sub;

  RETURN jsonb_build_object(
    'branches', v_branches,
    'dates', v_dates
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_available_mistake_filters(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_available_mistake_filters(uuid, text) TO authenticated, service_role;
