-- Migration: Fix check_profile_updates() to prevent user self-service privilege escalation
-- Date: 2026-08-01
-- Severity: CRITICAL
-- Updated: 2026-08-07 — AUDIT FIX C1: Added global_settings key-level restrictions
--          for regular users to prevent privilege escalation via JSON injection.
--
-- Problem: The default fallback for regular users editing their own profile
-- had zero column restrictions — users could set has_chuti_access, can_manage_rules,
-- supervisor_ids, etc. on themselves.
--
-- Fix: Add column-level restrictions so regular users can only modify safe
-- profile fields (username request, full name request, working hours request,
-- break time request, sign-in/out request, has_edited_profile, has_changed_password,
-- is_setup_completed, default_sign_in/out).
--
-- AUDIT FIX C1: global_settings is now restricted at the key level for regular users.
-- Users may update safe keys (e.g. active_sessions) but NOT privileged keys
-- (temp_access, role_visibility, admin_delegated_flags, feature_flags,
-- supervisor_access_overrides, user_feature_flags, password_reset_status,
-- office_leave_default, eid_fitr_leave, eid_adha_leave, govt_holidays, vpn_list).

CREATE OR REPLACE FUNCTION public.check_profile_updates() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  -- If the session bypass variable is set, allow the update (system functions/syncs)
  IF current_setting('app.bypass_profile_security', true) = 'true' THEN
    RETURN NEW;
  END IF;

  -- If the editor is the service_role (API routes / system), allow everything
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- If the editor is an admin or superadmin, allow everything
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- If the editor is a supervisor
  IF public.is_supervisor() THEN
    -- If editing self, allow everything (supervisors are trusted)
    IF auth.uid() = NEW.id THEN
      RETURN NEW;
    END IF;

    -- If editing an employee they directly supervise, enforce key constraints
    IF auth.uid() = ANY(NEW.supervisor_ids) OR auth.uid() = ANY(OLD.supervisor_ids) THEN
      IF OLD.role IS DISTINCT FROM NEW.role OR
         OLD.has_chuti_access IS DISTINCT FROM NEW.has_chuti_access OR
         OLD.has_quotes_access IS DISTINCT FROM NEW.has_quotes_access OR
         OLD.can_manage_rules IS DISTINCT FROM NEW.can_manage_rules OR
         OLD.supervisor_ids IS DISTINCT FROM NEW.supervisor_ids OR
         (NEW.global_settings->>'office_leave_default') IS DISTINCT FROM (OLD.global_settings->>'office_leave_default') OR
         (NEW.global_settings->>'eid_fitr_leave') IS DISTINCT FROM (OLD.global_settings->>'eid_fitr_leave') OR
         (NEW.global_settings->>'eid_adha_leave') IS DISTINCT FROM (OLD.global_settings->>'eid_adha_leave') OR
         (NEW.global_settings->>'govt_holidays') IS DISTINCT FROM (OLD.global_settings->>'govt_holidays') OR
         (NEW.global_settings->>'password_reset_status') IS DISTINCT FROM (OLD.global_settings->>'password_reset_status')
      THEN
        RAISE EXCEPTION 'Supervisors cannot modify roles, supervisor assignments, access permissions, or sensitive global leave settings for their team members.';
      END IF;
      RETURN NEW;
    END IF;

    -- AUDIT FIX H3: Block supervisors from modifying admin/superadmin profiles entirely.
    -- Supervisors should never modify any field on an admin or superadmin account.
    IF OLD.role IN ('admin', 'superadmin') THEN
      RAISE EXCEPTION 'Supervisors cannot modify admin or superadmin profiles.';
    END IF;

    -- If editing an employee they do NOT supervise, enforce column constraints
    IF OLD.role IS DISTINCT FROM NEW.role OR
       OLD.has_chuti_access IS DISTINCT FROM NEW.has_chuti_access OR
       OLD.has_quotes_access IS DISTINCT FROM NEW.has_quotes_access OR
       OLD.supervisor_ids IS DISTINCT FROM NEW.supervisor_ids OR
       OLD.delegated_supervisor_id IS DISTINCT FROM NEW.delegated_supervisor_id OR
       OLD.delegated_leave_supervisor_id IS DISTINCT FROM NEW.delegated_leave_supervisor_id OR
       OLD.delegated_kpi_supervisor_id IS DISTINCT FROM NEW.delegated_kpi_supervisor_id OR
       OLD.eligible_govt_holiday IS DISTINCT FROM NEW.eligible_govt_holiday OR
       OLD.eligible_office_leave IS DISTINCT FROM NEW.eligible_office_leave OR
       OLD.allow_overtime IS DISTINCT FROM NEW.allow_overtime OR
       OLD.allow_reserve IS DISTINCT FROM NEW.allow_reserve OR
       OLD.needs_supervisor_approval IS DISTINCT FROM NEW.needs_supervisor_approval OR
       OLD.global_settings IS DISTINCT FROM NEW.global_settings
    THEN
      RAISE EXCEPTION 'Supervisors can only modify basic settings (working hours, break time, default sign in/out, quotes allowed types) for users outside their team.';
    END IF;

    RETURN NEW;
  END IF;

  -- Default fallback: regular users editing their own profile
  -- ONLY allow safe, non-privileged columns to be modified
  IF auth.uid() = NEW.id THEN
    -- Block privileged column modifications
    IF OLD.role IS DISTINCT FROM NEW.role OR
       OLD.has_chuti_access IS DISTINCT FROM NEW.has_chuti_access OR
       OLD.has_quotes_access IS DISTINCT FROM NEW.has_quotes_access OR
       OLD.can_manage_rules IS DISTINCT FROM NEW.can_manage_rules OR
       OLD.allow_overtime IS DISTINCT FROM NEW.allow_overtime OR
       OLD.allow_reserve IS DISTINCT FROM NEW.allow_reserve OR
       OLD.supervisor_ids IS DISTINCT FROM NEW.supervisor_ids OR
       OLD.delegated_supervisor_id IS DISTINCT FROM NEW.delegated_supervisor_id OR
       OLD.delegated_leave_supervisor_id IS DISTINCT FROM NEW.delegated_leave_supervisor_id OR
       OLD.delegated_kpi_supervisor_id IS DISTINCT FROM NEW.delegated_kpi_supervisor_id OR
       OLD.eligible_govt_holiday IS DISTINCT FROM NEW.eligible_govt_holiday OR
       OLD.eligible_office_leave IS DISTINCT FROM NEW.eligible_office_leave OR
       OLD.needs_supervisor_approval IS DISTINCT FROM NEW.needs_supervisor_approval OR
       OLD.max_full_leaves IS DISTINCT FROM NEW.max_full_leaves OR
       OLD.max_short_leaves IS DISTINCT FROM NEW.max_short_leaves OR
       OLD.quotes_role IS DISTINCT FROM NEW.quotes_role OR
       OLD.converted_short_leaves_days IS DISTINCT FROM NEW.converted_short_leaves_days OR
       OLD.converted_short_leaves_hours IS DISTINCT FROM NEW.converted_short_leaves_hours
    THEN
      RAISE EXCEPTION 'Users cannot modify access control, permissions, quotas, or supervisor assignments. These are managed by superadmin.';
    END IF;

    -- AUDIT FIX C1: Block privilege-escalation via global_settings JSON keys.
    -- Regular users may still update safe keys (e.g. active_sessions for session
    -- tracking), but must NOT modify any key that controls access, features,
    -- role visibility, or admin-level configuration.
    IF OLD.global_settings IS DISTINCT FROM NEW.global_settings THEN
      IF (NEW.global_settings->>'temp_access') IS DISTINCT FROM (OLD.global_settings->>'temp_access') OR
         (NEW.global_settings->>'role_visibility') IS DISTINCT FROM (OLD.global_settings->>'role_visibility') OR
         (NEW.global_settings->>'supervisor_access_overrides') IS DISTINCT FROM (OLD.global_settings->>'supervisor_access_overrides') OR
         (NEW.global_settings->>'admin_delegated_flags') IS DISTINCT FROM (OLD.global_settings->>'admin_delegated_flags') OR
         (NEW.global_settings->>'user_feature_flags') IS DISTINCT FROM (OLD.global_settings->>'user_feature_flags') OR
         (NEW.global_settings->>'feature_flags') IS DISTINCT FROM (OLD.global_settings->>'feature_flags') OR
         (NEW.global_settings->>'password_reset_status') IS DISTINCT FROM (OLD.global_settings->>'password_reset_status') OR
         (NEW.global_settings->>'office_leave_default') IS DISTINCT FROM (OLD.global_settings->>'office_leave_default') OR
         (NEW.global_settings->>'eid_fitr_leave') IS DISTINCT FROM (OLD.global_settings->>'eid_fitr_leave') OR
         (NEW.global_settings->>'eid_adha_leave') IS DISTINCT FROM (OLD.global_settings->>'eid_adha_leave') OR
         (NEW.global_settings->>'govt_holidays') IS DISTINCT FROM (OLD.global_settings->>'govt_holidays') OR
         (NEW.global_settings->>'vpn_list') IS DISTINCT FROM (OLD.global_settings->>'vpn_list')
      THEN
        RAISE EXCEPTION 'Users cannot modify privileged global_settings keys (access controls, feature flags, leave settings, VPN). These are managed by superadmin.';
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Unauthorized profile modification.';
END;
$$;

