-- Migration: Fix check_profile_updates() to prevent user self-service privilege escalation
-- Date: 2026-08-01
-- Severity: CRITICAL
--
-- Problem: The default fallback for regular users editing their own profile
-- had zero column restrictions — users could set has_chuti_access, can_manage_rules,
-- supervisor_ids, etc. on themselves.
--
-- Fix: Add column-level restrictions so regular users can only modify safe
-- profile fields (username request, full name request, working hours request,
-- break time request, sign-in/out request, global_settings for personal prefs,
-- has_edited_profile, has_changed_password, is_setup_completed, default_sign_in/out).
-- All access-control columns are locked to admin/superadmin only.

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
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Unauthorized profile modification.';
END;
$$;
