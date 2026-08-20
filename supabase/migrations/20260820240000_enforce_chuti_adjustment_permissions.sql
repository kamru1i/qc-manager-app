-- Migration: 20260820240000_enforce_chuti_adjustment_permissions.sql
-- Description: Enforce server-side permissions for leave adjustments (Overtime and Govt Holiday Reserve)

CREATE OR REPLACE FUNCTION public.enforce_chuti_write_permissions() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_actor_role text;
  v_needs_supervisor boolean;
  v_allow_overtime boolean;
  v_allow_reserve boolean;
BEGIN
  IF auth.role() = 'service_role'
     OR current_setting('app.bypass_chuti_security', true) = 'true' THEN
    RETURN NEW;
  END IF;

  IF NEW.date < DATE '2020-01-01' OR NEW.date > (current_date + 730) THEN
    RAISE EXCEPTION 'Leave date is outside the supported range.';
  END IF;

  SELECT role INTO v_actor_role FROM public.profiles WHERE id = auth.uid();

  IF v_actor_role IN ('admin', 'superadmin') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'A leave record cannot be reassigned to another user.';
  END IF;

  IF v_actor_role = 'supervisor' THEN
    IF NOT (NEW.user_id = auth.uid() OR public.has_leave_access(auth.uid(), NEW.user_id)) THEN
      RAISE EXCEPTION 'Supervisors may only change leave records for their assigned team.';
    END IF;
    IF TG_OP = 'INSERT' AND NEW.status NOT IN ('pending_supervisor', 'approved_by_supervisor') THEN
      RAISE EXCEPTION 'Supervisors cannot create final-approved leave records.';
    END IF;
    IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status
       AND NEW.status NOT IN ('pending_supervisor', 'approved_by_supervisor', 'needs_review') THEN
      RAISE EXCEPTION 'Supervisors cannot grant final admin approval.';
    END IF;
    IF TG_OP = 'UPDATE'
       AND NEW.reserve_adjustment_status IS DISTINCT FROM OLD.reserve_adjustment_status
       AND NEW.reserve_adjustment_status NOT IN ('none', 'pending') THEN
      RAISE EXCEPTION 'Supervisors cannot approve or reject reserve adjustments.';
    END IF;
    RETURN NEW;
  END IF;

  IF v_actor_role <> 'user' OR NEW.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Users may only change their own leave records.';
  END IF;

  SELECT 
    COALESCE(needs_supervisor_approval, true), 
    COALESCE(allow_overtime, false), 
    COALESCE(allow_reserve, false)
  INTO v_needs_supervisor, v_allow_overtime, v_allow_reserve
  FROM public.profiles
  WHERE id = auth.uid();

  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'approved_by_supervisor' AND NOT v_needs_supervisor THEN
      NULL;
    ELSIF NEW.status <> 'pending_supervisor' THEN
      RAISE EXCEPTION 'Users cannot create approved or rejected leave records.';
    END IF;
    IF NEW.reserve_adjustment_status <> 'none'
       OR NEW.admin_edit_status <> 'none'
       OR NEW.is_edited
       OR NEW.deleted_at IS NOT NULL THEN
      RAISE EXCEPTION 'Users cannot set administrative leave fields.';
    END IF;
  ELSE
    IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Leave creation timestamps are immutable.';
    END IF;
    IF OLD.status NOT IN ('pending_supervisor', 'approved_by_supervisor', 'needs_review')
       AND (to_jsonb(NEW) - ARRAY[
         'reserve_adjustment_status', 'admin_edit_request', 'updated_at'
       ]) IS DISTINCT FROM
       (to_jsonb(OLD) - ARRAY[
         'reserve_adjustment_status', 'admin_edit_request', 'updated_at'
       ]) THEN
      RAISE EXCEPTION 'Approved leave details are immutable for users.';
    END IF;
    IF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at
       AND OLD.status NOT IN ('pending_supervisor', 'approved_by_supervisor', 'needs_review') THEN
      RAISE EXCEPTION 'Only an unapproved leave request can be withdrawn by its owner.';
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      IF NEW.status = 'approved_by_supervisor' AND NOT v_needs_supervisor THEN
        NULL;
      ELSIF NEW.status <> 'pending_supervisor' THEN
        RAISE EXCEPTION 'Users cannot approve or reject leave records.';
      END IF;
    END IF;
    IF NEW.reserve_adjustment_status IS DISTINCT FROM OLD.reserve_adjustment_status THEN
      IF NEW.reserve_adjustment_status NOT IN ('none', 'pending') THEN
        RAISE EXCEPTION 'Users cannot approve or reject reserve adjustments.';
      END IF;
      -- Enforce user eligibility permissions on adjustment requests
      IF NEW.reserve_adjustment_status = 'pending' THEN
        IF NEW.leave_type IN ('Overtime', 'Short Leave') AND NOT v_allow_overtime THEN
          RAISE EXCEPTION 'Overtime and Short Leave adjustments are disabled for your profile.';
        END IF;
        IF NEW.leave_type = 'Full Leave' AND NOT v_allow_reserve THEN
          RAISE EXCEPTION 'Government Holiday Reserve adjustments are disabled for your profile.';
        END IF;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
