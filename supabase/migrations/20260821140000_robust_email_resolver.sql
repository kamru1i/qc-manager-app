-- Robust email resolver function with prefix fallback
CREATE OR REPLACE FUNCTION public.get_user_email_by_username(p_username text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_email TEXT;
BEGIN
  -- 1. Look up by profiles.username
  SELECT u.email INTO v_email
  FROM auth.users u
  JOIN public.profiles p ON u.id = p.id
  WHERE UPPER(p.username) = UPPER(p_username)
  LIMIT 1;

  -- 2. Fallback: match by email prefix in auth.users
  IF v_email IS NULL THEN
    SELECT email INTO v_email
    FROM auth.users
    WHERE UPPER(SPLIT_PART(email, '@', 1)) = UPPER(p_username)
    LIMIT 1;
  END IF;

  RETURN v_email;
END;
$$;

-- Ensure service_role can execute
REVOKE ALL ON FUNCTION public.get_user_email_by_username(text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_user_email_by_username(text) TO service_role;
