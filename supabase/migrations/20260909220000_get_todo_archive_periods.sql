-- Migration: 20260909220000_get_todo_archive_periods.sql
-- Description: RPC to return distinct YYYY-MM periods for todos with submitted data (excluding Idle status).

CREATE OR REPLACE FUNCTION public.get_todo_archive_periods(p_user_id uuid DEFAULT NULL)
RETURNS TABLE (period text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT to_char(t.todo_date, 'YYYY-MM') AS period
  FROM public.todos t
  WHERE t.status != 'Idle'
    AND (p_user_id IS NULL OR t.user_id = p_user_id)
    AND (
      auth.role() = 'service_role'
      OR t.user_id = auth.uid()
      OR public.is_superadmin()
      OR EXISTS (
        SELECT 1 FROM public.todo_access ta
        WHERE ta.user_id = auth.uid()
          AND ta.permission = 'TODO_VIEW'
      )
    )
  ORDER BY period DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_todo_archive_periods(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_todo_archive_periods(uuid) TO authenticated, service_role;
