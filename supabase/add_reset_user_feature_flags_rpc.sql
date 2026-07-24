-- Resets/removes individual 'user_feature_flags' overrides from all profile rows
-- so every user defaults to Inherit (global settings).
-- Superadmin-only. Idempotent.

CREATE OR REPLACE FUNCTION public.reset_all_user_feature_flags()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'Only a superadmin can reset user feature flags.';
  END IF;

  UPDATE public.profiles
  SET global_settings = global_settings - 'user_feature_flags'
  WHERE global_settings ? 'user_feature_flags';
END;
$$;

REVOKE ALL ON FUNCTION public.reset_all_user_feature_flags() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reset_all_user_feature_flags() FROM anon;
GRANT EXECUTE ON FUNCTION public.reset_all_user_feature_flags() TO authenticated;

NOTIFY pgrst, 'reload schema';
