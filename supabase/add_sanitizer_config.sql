-- Superadmin-configurable filename sanitizer word list.
--
-- CONVENTION: the CREATE FUNCTION below is mirrored into schema.sql. The
-- runtime NOTIFY is migration-only. After applying, regenerate schema.sql from
-- the live DB so it stays the source of truth.
--
-- The sanitizer runs client-side reading each user's own profile.global_settings,
-- so the configured word list must be mirrored to every profile row. This RPC
-- uses jsonb_set to update ONLY the 'sanitizer_words' key, preserving every
-- other per-row global_settings value (notably each user's hidden_tabs).
--
-- Superadmin-only. Idempotent / re-runnable.

CREATE OR REPLACE FUNCTION public.set_sanitizer_words(p_words text[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'Only a superadmin can configure the filename sanitizer.';
  END IF;

  UPDATE public.profiles
  SET global_settings = jsonb_set(
        COALESCE(global_settings, '{}'::jsonb),
        '{sanitizer_words}',
        COALESCE(to_jsonb(p_words), '[]'::jsonb),
        true
      );
END;
$$;

REVOKE ALL ON FUNCTION public.set_sanitizer_words(text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_sanitizer_words(text[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_sanitizer_words(text[]) TO authenticated;

NOTIFY pgrst, 'reload schema';
