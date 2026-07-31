-- Migration: Allow supervisors to update credentials for users under their supervision
-- Date: 2026-07-31

CREATE OR REPLACE FUNCTION public.admin_update_user_credentials(
    p_user_id uuid,
    p_new_username text DEFAULT NULL::text,
    p_new_password text DEFAULT NULL::text
) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions', 'pg_temp'
    AS $$
BEGIN
  -- Permission Guard: Admins/Superadmins can update any credentials;
  -- Supervisors can update credentials for employees under their supervision/delegation.
  IF NOT (
    public.is_admin() OR 
    (public.is_supervisor() AND public.has_leave_access(auth.uid(), p_user_id))
  ) THEN
    RAISE EXCEPTION 'Permission denied: Only admins or assigned supervisors can update user credentials.';
  END IF;

  -- Update username in profiles if provided
  IF p_new_username IS NOT NULL AND p_new_username != '' THEN
    UPDATE public.profiles SET username = UPPER(p_new_username) WHERE id = p_user_id;
  END IF;

  -- Update password in auth.users if provided
  IF p_new_password IS NOT NULL AND p_new_password != '' THEN
    UPDATE auth.users
    SET encrypted_password = crypt(p_new_password, gen_salt('bf')),
        updated_at = NOW()
    WHERE id = p_user_id;
  END IF;
END;
$$;

GRANT ALL ON FUNCTION public.admin_update_user_credentials(p_user_id uuid, p_new_username text, p_new_password text) TO authenticated;
