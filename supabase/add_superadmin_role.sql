-- Superadmin role: a strict superset of admin.
--
-- CONVENTION: structural DDL below is mirrored into schema.sql. One-time
-- operations (the KAMRUL role UPDATE, DISABLE/ENABLE TRIGGER, NOTIFY) are
-- migration-only and MUST NOT be copied into schema.sql. After applying,
-- regenerate schema.sql from the live DB so it stays the source of truth.
--
-- Rationale: the app previously identified its super-user by hardcoded identity
-- checks (username/codename === 'KAMRUL'). This introduces a real 'superadmin'
-- role so the capability is data-driven and portable.
--
-- Design: superadmin ≥ admin. is_admin() is WIDENED to accept both roles, so
-- every existing admin-gated RLS policy, trigger, and SECURITY DEFINER function
-- automatically accepts superadmin with NO per-policy edits. is_superadmin() is
-- new, for the few superadmin-only gates (creating admins/superadmins).
--
-- Idempotent / re-runnable. Run once against the live project (SQL editor or
-- `supabase db push`).

-- 1. Allow 'superadmin' in the role CHECK constraint.
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK ((role = ANY (ARRAY['admin'::text, 'user'::text, 'supervisor'::text, 'superadmin'::text])));

-- 2. Widen is_admin() so admin-gated policies accept superadmin too.
CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
  );
$$;

-- 3. New is_superadmin() for superadmin-only gates.
CREATE OR REPLACE FUNCTION public.is_superadmin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'superadmin'
  );
$$;

-- 3b. Widen is_admin_or_supervisor() to include superadmin (superset principle).
CREATE OR REPLACE FUNCTION public.is_admin_or_supervisor() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND (role = 'admin' OR role = 'supervisor' OR role = 'superadmin')
  );
$$;

-- 4. Migrate the existing KAMRUL super-user to the new role (one row, idempotent).
--    The profile-guard triggers reject role changes when auth.uid() is not an
--    admin — and in the Supabase SQL editor auth.uid() is NULL. Disable the two
--    guard triggers just for this one-time system UPDATE, then re-enable them.
ALTER TABLE public.profiles DISABLE TRIGGER on_profile_role_update;
ALTER TABLE public.profiles DISABLE TRIGGER on_profile_update_security;

UPDATE public.profiles
SET role = 'superadmin'
WHERE (UPPER(username) = 'KAMRUL' OR full_name = 'Kamrul Islam')
  AND role <> 'superadmin';

ALTER TABLE public.profiles ENABLE TRIGGER on_profile_role_update;
ALTER TABLE public.profiles ENABLE TRIGGER on_profile_update_security;

-- 5. Role-change guard: only a superadmin may set a role to admin/superadmin.
--    (Admins can still manage supervisor/user roles.) service_role bypasses.
CREATE OR REPLACE FUNCTION public.check_profile_role_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  -- If the editor is the service_role (API routes / system), allow everything
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF OLD.role IS DISTINCT FROM NEW.role THEN
    -- Must be admin OR superadmin to change any role at all.
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
    ) THEN
      RAISE EXCEPTION 'You are not allowed to change your role.';
    END IF;

    -- Granting admin or superadmin requires superadmin.
    IF NEW.role IN ('admin', 'superadmin') AND NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'superadmin'
    ) THEN
      RAISE EXCEPTION 'Only a superadmin can assign the admin or superadmin role.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 6. Harden create_new_user: only superadmin may create admin/superadmin.
--    is_admin() (now incl. superadmin) still gates supervisor/user creation.
CREATE OR REPLACE FUNCTION public.create_new_user(p_email text, p_password text, p_username text, p_role text, p_full_name text, p_needs_supervisor_approval boolean DEFAULT false, p_allow_reserve boolean DEFAULT false, p_allow_overtime boolean DEFAULT false, p_supervisor_ids uuid[] DEFAULT NULL::uuid[]) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions', 'pg_temp'
    AS $_$
DECLARE
  v_user_id UUID;
  v_sql TEXT;
  v_cols TEXT[] := ARRAY[]::TEXT[];
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can create users';
  END IF;

  -- Whitelist the role and enforce the creation hierarchy.
  IF p_role NOT IN ('user', 'supervisor', 'admin', 'superadmin') THEN
    RAISE EXCEPTION 'Invalid role: %', p_role;
  END IF;
  IF p_role IN ('admin', 'superadmin') AND NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'Only a superadmin can create admin or superadmin accounts.';
  END IF;

  -- Create user in auth.users
  v_user_id := extensions.uuid_generate_v4();

  -- Base columns that are guaranteed to exist in auth.users
  v_cols := ARRAY['id', 'instance_id', 'email', 'encrypted_password', 'email_confirmed_at', 'created_at', 'updated_at', 'raw_app_meta_data', 'raw_user_meta_data', 'aud', 'role'];

  -- Construct the SQL query dynamically
  v_sql := 'INSERT INTO auth.users (' || array_to_string(v_cols, ', ');

  -- Check and append optional columns if they exist in the schema
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'confirmation_token') THEN
    v_sql := v_sql || ', confirmation_token';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'recovery_token') THEN
    v_sql := v_sql || ', recovery_token';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'email_change_token_new') THEN
    v_sql := v_sql || ', email_change_token_new';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'email_change') THEN
    v_sql := v_sql || ', email_change';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'phone_change_token') THEN
    v_sql := v_sql || ', phone_change_token';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'email_change_token_current') THEN
    v_sql := v_sql || ', email_change_token_current';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'reauthentication_token') THEN
    v_sql := v_sql || ', reauthentication_token';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'is_sso_user') THEN
    v_sql := v_sql || ', is_sso_user';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'is_anonymous') THEN
    v_sql := v_sql || ', is_anonymous';
  END IF;

  v_sql := v_sql || ') VALUES ($1, ''00000000-0000-0000-0000-000000000000'', $2, crypt($3, gen_salt(''bf'')), NOW(), NOW(), NOW(), ''{"provider":"email","providers":["email"]}''::jsonb, $4, ''authenticated'', ''authenticated''';

  -- Append matching value expressions for the optional columns
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'confirmation_token') THEN
    v_sql := v_sql || ', ''''';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'recovery_token') THEN
    v_sql := v_sql || ', ''''';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'email_change_token_new') THEN
    v_sql := v_sql || ', ''''';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'email_change') THEN
    v_sql := v_sql || ', ''''';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'phone_change_token') THEN
    v_sql := v_sql || ', ''''';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'email_change_token_current') THEN
    v_sql := v_sql || ', ''''';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'reauthentication_token') THEN
    v_sql := v_sql || ', ''''';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'is_sso_user') THEN
    v_sql := v_sql || ', false';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'is_anonymous') THEN
    v_sql := v_sql || ', false';
  END IF;

  v_sql := v_sql || ')';

  -- Execute dynamic insert
  EXECUTE v_sql USING
    v_user_id,
    p_email,
    p_password,
    jsonb_build_object(
      'username', UPPER(p_username),
      'role', p_role,
      'full_name', p_full_name,
      'needs_supervisor_approval', p_needs_supervisor_approval,
      'allow_reserve', p_allow_reserve,
      'allow_overtime', p_allow_overtime
    );

  -- The trigger will create the profile, but we need to update full_name, needs_supervisor_approval, allow_reserve, allow_overtime, and supervisor_ids
  UPDATE public.profiles
  SET full_name = p_full_name,
      needs_supervisor_approval = p_needs_supervisor_approval,
      allow_reserve = p_allow_reserve,
      allow_overtime = p_allow_overtime,
      supervisor_ids = p_supervisor_ids,
      is_setup_completed = false
  WHERE id = v_user_id;

  RETURN v_user_id;
END;
$_$;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
