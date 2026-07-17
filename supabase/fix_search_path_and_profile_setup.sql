-- Migration: pin search_path on all SECURITY DEFINER functions + restore complete_profile_setup RPC
-- Date: 2026-07-17
-- Safety: 100% additive — ALTER FUNCTION ... SET (config only, bodies untouched) + one CREATE FUNCTION.
--         No DROP, no table changes, no data touched. Safe to run on live.
--
-- Why:
-- 1) Supabase linter / audit: SECURITY DEFINER functions without a pinned search_path are
--    vulnerable to search-path hijacking. Only get_leaderboard_data was pinned.
-- 2) complete_profile_setup is called by the quotes first-time-setup flow
--    (useQuotesDashboardData.ts) but is MISSING from the live DB (lost in the earlier
--    restore) — users with has_changed_password = false are stuck at the setup screen.

-- ────────────────────────────────────────────────────────────────────
-- 1. Pin search_path on the 19 unpinned SECURITY DEFINER functions
-- ────────────────────────────────────────────────────────────────────

-- These two call crypt()/gen_salt() unqualified (they live in the `extensions`
-- schema on Supabase), so their path must include `extensions`:
ALTER FUNCTION public.create_new_user(text, text, text, text, text, boolean, boolean, boolean, uuid[])
  SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.admin_update_user_credentials(uuid, text, text)
  SET search_path = public, extensions, pg_temp;

-- The rest only reference public.* / auth.* (schema-qualified) / pg_catalog:
ALTER FUNCTION public.admin_insert_chuti_records_bulk(uuid, date[], text, boolean[], boolean, time without time zone, time without time zone, interval, text, text, uuid)
  SET search_path = public, pg_temp;
ALTER FUNCTION public.check_profile_role_change()          SET search_path = public, pg_temp;
ALTER FUNCTION public.check_profile_updates()              SET search_path = public, pg_temp;
ALTER FUNCTION public.cleanup_old_audit_logs()             SET search_path = public, pg_temp;
ALTER FUNCTION public.delete_user_by_id(uuid)              SET search_path = public, pg_temp;
ALTER FUNCTION public.get_user_email_by_username(text)     SET search_path = public, pg_temp;
ALTER FUNCTION public.handle_new_user()                    SET search_path = public, pg_temp;
ALTER FUNCTION public.has_kpi_access(uuid, uuid)           SET search_path = public, pg_temp;
ALTER FUNCTION public.has_leave_access(uuid, uuid)         SET search_path = public, pg_temp;
ALTER FUNCTION public.is_admin()                           SET search_path = public, pg_temp;
ALTER FUNCTION public.is_admin_or_supervisor()             SET search_path = public, pg_temp;
ALTER FUNCTION public.is_supervisor()                      SET search_path = public, pg_temp;
ALTER FUNCTION public.is_supervisor_of(uuid, uuid)         SET search_path = public, pg_temp;
ALTER FUNCTION public.is_user_in_top_5_for_month(uuid, integer, integer)
  SET search_path = public, pg_temp;
ALTER FUNCTION public.sync_top_performer_badges()          SET search_path = public, pg_temp;
ALTER FUNCTION public.update_compliance_rules_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.update_records_updated_at()          SET search_path = public, pg_temp;

-- ────────────────────────────────────────────────────────────────────
-- 2. Restore complete_profile_setup RPC (missing from live DB)
-- ────────────────────────────────────────────────────────────────────
-- Called by completeFirstTimeSetup() with { p_username, p_full_name }.
-- Updates the caller's own profile row: username, full_name, has_changed_password = true.
-- (The password itself is changed client-side via supabase.auth.updateUser afterwards.)
-- SECURITY INVOKER on purpose: the own-row RLS UPDATE policy and the
-- check_profile_updates self-edit path already authorize exactly this — no
-- definer privileges needed.

CREATE OR REPLACE FUNCTION public.complete_profile_setup(p_username text, p_full_name text)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Not authenticated.');
  END IF;

  IF p_username IS NULL OR length(trim(p_username)) = 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Username is required.');
  END IF;

  IF p_full_name IS NULL OR length(trim(p_full_name)) = 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Full name is required.');
  END IF;

  BEGIN
    UPDATE public.profiles
    SET username = upper(trim(p_username)),
        full_name = trim(p_full_name),
        has_changed_password = true
    WHERE id = v_uid;
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'message', 'This username is already taken. Please choose another.');
  END;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Profile not found.');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.complete_profile_setup(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_profile_setup(text, text) TO authenticated, service_role;
