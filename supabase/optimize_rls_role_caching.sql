-- E7 Fix: Optimize RLS policies on high-traffic tables (records, chuti, kpi_assessments)
--
-- PROBLEM: Every row returned by SELECT/INSERT/UPDATE/DELETE on these tables evaluates
-- is_admin(), is_supervisor(), or is_admin_or_supervisor() as a subquery. Each function
-- does: SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN (...).
-- While this is a PK lookup (fast), it's evaluated PER ROW. For a query returning 1000
-- chuti records, that's 1000+ redundant lookups of the same profile row.
--
-- FIX: Replace the SQL STABLE functions with session-cached versions using
-- current_setting() so the role check is computed ONCE per transaction, not per row.
-- We create a helper that caches the user's role in a session variable, then the
-- RLS functions read from that cache.
--
-- This is safe because:
-- 1. auth.uid() never changes within a single request
-- 2. A user's role doesn't change during a single query
-- 3. The 'true' parameter in set_config means it resets at transaction end

-- Step 1: Create a role-caching helper function
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_role text;
BEGIN
  -- Try to read from the per-transaction cache first
  BEGIN
    v_role := current_setting('app.user_role', true);
    IF v_role IS NOT NULL AND v_role <> '' THEN
      RETURN v_role;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Setting doesn't exist yet, compute it
  END;

  -- Cache miss: look up the role from profiles (single PK lookup)
  SELECT role INTO v_role
  FROM public.profiles
  WHERE id = auth.uid();

  -- Store in transaction-scoped session variable (resets at txn end)
  IF v_role IS NOT NULL THEN
    PERFORM set_config('app.user_role', v_role, true);
  ELSE
    PERFORM set_config('app.user_role', 'none', true);
    v_role := 'none';
  END IF;

  RETURN v_role;
END;
$$;

-- Step 2: Rewrite is_admin() to use the cached role
CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT public.get_my_role() IN ('admin', 'superadmin');
$$;

-- Step 3: Rewrite is_superadmin() to use the cached role
CREATE OR REPLACE FUNCTION public.is_superadmin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT public.get_my_role() = 'superadmin';
$$;

-- Step 4: Rewrite is_supervisor() to use the cached role
CREATE OR REPLACE FUNCTION public.is_supervisor() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT public.get_my_role() = 'supervisor';
$$;

-- Step 5: Rewrite is_admin_or_supervisor() to use the cached role
CREATE OR REPLACE FUNCTION public.is_admin_or_supervisor() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT public.get_my_role() IN ('admin', 'supervisor', 'superadmin');
$$;
