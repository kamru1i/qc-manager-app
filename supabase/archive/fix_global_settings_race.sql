-- AUDIT FIX M9: Atomic JSONB key-level update to prevent race conditions
-- when multiple components update global_settings concurrently.

CREATE OR REPLACE FUNCTION public.update_global_settings_key(
  p_user_id UUID,
  p_key TEXT,
  p_value JSONB
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  UPDATE profiles
  SET global_settings = jsonb_set(
    COALESCE(global_settings, '{}'::jsonb),
    ARRAY[p_key],
    p_value
  )
  WHERE id = p_user_id;
END;
$$;

-- Grant execute to authenticated users (RLS on profiles still applies)
GRANT EXECUTE ON FUNCTION public.update_global_settings_key(UUID, TEXT, JSONB) TO authenticated;
