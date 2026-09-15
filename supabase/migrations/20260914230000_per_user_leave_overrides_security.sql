-- Migration: 20260914230000_per_user_leave_overrides_security.sql
-- Description: Allow Admin and Superadmin to configure per-user leave_overrides in profiles.global_settings
-- Enforces database-level RBAC: supervisors and regular users CANNOT write or alter leave_overrides.

CREATE OR REPLACE FUNCTION public.check_profile_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_actor_role text;
  v_safe_global_keys text[] := ARRAY[
    'active_sessions',
    'hidden_tabs',
    'kpi_skills',
    'kpi_dept_indicators',
    'kpi_other_dept_indicators',
    'performs_data_entry',
    'department',
    'performs_other_dept_tasks',
    'other_department'
  ];
  v_admin_global_keys text[] := ARRAY[
    'active_sessions',
    'hidden_tabs',
    'kpi_skills',
    'kpi_dept_indicators',
    'kpi_other_dept_indicators',
    'performs_data_entry',
    'department',
    'performs_other_dept_tasks',
    'other_department',
    'user_feature_flags',
    'leave_overrides',
    'emp_id',
    'date_of_joining'
  ];
BEGIN
  IF current_setting('app.bypass_profile_security', true) = 'true'
     OR auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF OLD.id = auth.uid() THEN
    v_actor_role := OLD.role;
  ELSE
    SELECT p.role INTO v_actor_role
    FROM public.profiles p
    WHERE p.id = auth.uid();
  END IF;

  IF v_actor_role = 'superadmin' THEN
    RETURN NEW;
  END IF;

  IF v_actor_role = 'admin' THEN
    IF OLD.role = 'superadmin' OR (OLD.role = 'admin' AND OLD.id <> auth.uid()) THEN
      RAISE EXCEPTION 'Admins cannot modify other admin or superadmin profiles.';
    END IF;

    IF (COALESCE(NEW.global_settings, '{}'::jsonb) - v_admin_global_keys)
       IS DISTINCT FROM
       (COALESCE(OLD.global_settings, '{}'::jsonb) - v_admin_global_keys) THEN
      RAISE EXCEPTION 'Global access, feature, leave, VPN, and system settings must be changed through their authorized settings RPC.';
    END IF;

    RETURN NEW;
  END IF;

  IF v_actor_role = 'supervisor' THEN
    IF NEW.id = auth.uid() THEN
      IF (to_jsonb(NEW) - ARRAY[
        'full_name', 'working_hours', 'break_time', 'job_role',
        'default_sign_in', 'default_sign_out', 'requested_full_name',
        'requested_working_hours', 'requested_break_time', 'requested_job_role',
        'requested_default_sign_in', 'requested_default_sign_out',
        'profile_change_status', 'has_edited_profile', 'global_settings'
      ]) IS DISTINCT FROM
      (to_jsonb(OLD) - ARRAY[
        'full_name', 'working_hours', 'break_time', 'job_role',
        'default_sign_in', 'default_sign_out', 'requested_full_name',
        'requested_working_hours', 'requested_break_time', 'requested_job_role',
        'requested_default_sign_in', 'requested_default_sign_out',
        'profile_change_status', 'has_edited_profile', 'global_settings'
      ]) THEN
        RAISE EXCEPTION 'Supervisors cannot change their own role, permissions, quotas, or delegation.';
      END IF;
    ELSIF public.has_leave_access(auth.uid(), NEW.id) THEN
      IF OLD.role IN ('admin', 'superadmin', 'supervisor') THEN
        RAISE EXCEPTION 'Supervisors can only manage assigned user profiles.';
      END IF;
      IF (to_jsonb(NEW) - ARRAY[
        'allowed_types', 'break_time', 'default_sign_in', 'default_sign_out',
        'global_settings'
      ]) IS DISTINCT FROM
      (to_jsonb(OLD) - ARRAY[
        'allowed_types', 'break_time', 'default_sign_in', 'default_sign_out',
        'global_settings'
      ]) THEN
        RAISE EXCEPTION 'Supervisors may only change assigned users'' quote types, break/default times, and non-privileged performance settings.';
      END IF;
    ELSE
      RAISE EXCEPTION 'Supervisors may only modify their own or assigned user profiles.';
    END IF;

    IF (COALESCE(NEW.global_settings, '{}'::jsonb) - v_safe_global_keys)
       IS DISTINCT FROM
       (COALESCE(OLD.global_settings, '{}'::jsonb) - v_safe_global_keys) THEN
      RAISE EXCEPTION 'Supervisors cannot modify privileged global settings.';
    END IF;

    RETURN NEW;
  END IF;

  IF v_actor_role = 'user' AND NEW.id = auth.uid() THEN
    IF (to_jsonb(NEW) - ARRAY[
      'username', 'full_name', 'working_hours', 'break_time', 'job_role',
      'default_sign_in', 'default_sign_out', 'requested_full_name',
      'requested_working_hours', 'requested_break_time', 'requested_job_role',
      'requested_default_sign_in', 'requested_default_sign_out',
      'profile_change_status', 'has_edited_profile',
      'global_settings'
    ]) IS DISTINCT FROM
    (to_jsonb(OLD) - ARRAY[
      'username', 'full_name', 'working_hours', 'break_time', 'job_role',
      'default_sign_in', 'default_sign_out', 'requested_full_name',
      'requested_working_hours', 'requested_break_time', 'requested_job_role',
      'requested_default_sign_in', 'requested_default_sign_out',
      'profile_change_status', 'has_edited_profile',
      'global_settings'
    ]) THEN
      RAISE EXCEPTION 'Users cannot modify roles, permissions, quotas, or supervisor assignments.';
    END IF;

    IF NEW.username IS DISTINCT FROM OLD.username AND OLD.has_changed_password IS TRUE THEN
      RAISE EXCEPTION 'Codename changes after onboarding require an authorized administrator.';
    END IF;

    IF (COALESCE(NEW.global_settings, '{}'::jsonb) - v_safe_global_keys)
       IS DISTINCT FROM
       (COALESCE(OLD.global_settings, '{}'::jsonb) - v_safe_global_keys) THEN
      RAISE EXCEPTION 'Users cannot modify privileged global settings.';
    END IF;

    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Unauthorized profile modification.';
END;
$$;

-- Ensure permissions remain correctly locked down
REVOKE ALL ON FUNCTION public.check_profile_updates() FROM PUBLIC, anon, authenticated;
GRANT ALL ON FUNCTION public.check_profile_updates() TO service_role;
