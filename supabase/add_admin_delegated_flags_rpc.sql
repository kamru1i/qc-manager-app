-- Superadmin feature flags delegation to admins.
--
-- Writes ONLY the 'admin_delegated_flags' key via jsonb_set, preserving every
-- other per-row global_settings value. Mirrored to all profile rows so each
-- admin reads the delegated flags. Shape: { "flag_key": true, ... }.
--
-- Superadmin-only. Idempotent. DDL-only (safe).

CREATE OR REPLACE FUNCTION public.set_admin_delegated_flags(p_flags jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'Only a superadmin can configure admin delegated feature flags.';
  END IF;

  UPDATE public.profiles
  SET global_settings = jsonb_set(
        COALESCE(global_settings, '{}'::jsonb),
        '{admin_delegated_flags}',
        COALESCE(p_flags, '{}'::jsonb),
        true
      )
  WHERE true;  -- intentional: global_settings is replicated to every row
END;
$$;

REVOKE ALL ON FUNCTION public.set_admin_delegated_flags(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_admin_delegated_flags(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_admin_delegated_flags(jsonb) TO authenticated;

NOTIFY pgrst, 'reload schema';
