-- Migration: 20260826194500_enforce_leave_type_consistency_and_adjustments.sql
-- Description: Enforce server-side permissions for all partial leave types (Short Leave, Early Leave, Late Join, Overtime) and preserve exact leave types.

BEGIN;

-- 1. Ensure check constraint includes all supported leave types
ALTER TABLE public.chuti 
DROP CONSTRAINT IF EXISTS chuti_leave_type_check;

ALTER TABLE public.chuti 
ADD CONSTRAINT chuti_leave_type_check 
CHECK (leave_type IN ('Short Leave', 'Early Leave', 'Late Join', 'Full Leave', 'Overtime'));

-- 2. Update trigger function to enforce write & adjustment permissions across all leave types
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
      -- Enforce user eligibility permissions on adjustment requests for all partial leave types
      IF NEW.reserve_adjustment_status = 'pending' THEN
        IF NEW.leave_type IN ('Overtime', 'Short Leave', 'Early Leave', 'Late Join') AND NOT v_allow_overtime THEN
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

-- 3. Update same-day conflict validation trigger function to respect soft deletes (deleted_at IS NULL)
CREATE OR REPLACE FUNCTION public.enforce_chuti_same_day_conflicts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_has_full_leave boolean;
  v_has_partial_leave boolean;
  v_has_same_early boolean;
  v_has_same_late boolean;
  v_has_same_ot boolean;
BEGIN
  -- If record is being soft-deleted or rejected, skip conflict validation
  IF NEW.deleted_at IS NOT NULL OR NEW.status = 'rejected' THEN
    RETURN NEW;
  END IF;

  -- 1. Check if Full Leave exists on same date (ignoring soft-deleted and rejected records)
  SELECT EXISTS(
    SELECT 1 FROM public.chuti
    WHERE user_id = NEW.user_id
      AND date = NEW.date
      AND (TG_OP = 'INSERT' OR id <> NEW.id)
      AND status <> 'rejected'
      AND deleted_at IS NULL
      AND leave_type = 'Full Leave'
  ) INTO v_has_full_leave;

  -- 2. Check if partial leaves exist on same date (ignoring soft-deleted and rejected records)
  SELECT EXISTS(
    SELECT 1 FROM public.chuti
    WHERE user_id = NEW.user_id
      AND date = NEW.date
      AND (TG_OP = 'INSERT' OR id <> NEW.id)
      AND status <> 'rejected'
      AND deleted_at IS NULL
      AND leave_type IN ('Short Leave', 'Early Leave', 'Late Join')
  ) INTO v_has_partial_leave;

  -- If inserting/updating Full Leave on a date that already has any active leave record:
  IF NEW.leave_type = 'Full Leave' AND (v_has_full_leave OR v_has_partial_leave) THEN
    RAISE EXCEPTION 'Full Day Leave cannot coexist with other leave records on %', NEW.date;
  END IF;

  -- If inserting/updating partial leave on a date that already has Full Leave:
  IF NEW.leave_type IN ('Short Leave', 'Early Leave', 'Late Join') AND v_has_full_leave THEN
    RAISE EXCEPTION 'Partial leave cannot be added because Full Day Leave already exists on %', NEW.date;
  END IF;

  -- At most 1 Early Leave per day
  IF NEW.leave_type = 'Early Leave' THEN
    SELECT EXISTS(
      SELECT 1 FROM public.chuti
      WHERE user_id = NEW.user_id
        AND date = NEW.date
        AND (TG_OP = 'INSERT' OR id <> NEW.id)
        AND status <> 'rejected'
        AND deleted_at IS NULL
        AND leave_type = 'Early Leave'
    ) INTO v_has_same_early;
    IF v_has_same_early THEN
      RAISE EXCEPTION 'An Early Leave record already exists on %', NEW.date;
    END IF;
  END IF;

  -- At most 1 Late Join per day
  IF NEW.leave_type = 'Late Join' THEN
    SELECT EXISTS(
      SELECT 1 FROM public.chuti
      WHERE user_id = NEW.user_id
        AND date = NEW.date
        AND (TG_OP = 'INSERT' OR id <> NEW.id)
        AND status <> 'rejected'
        AND deleted_at IS NULL
        AND leave_type = 'Late Join'
    ) INTO v_has_same_late;
    IF v_has_same_late THEN
      RAISE EXCEPTION 'A Late Join record already exists on %', NEW.date;
    END IF;
  END IF;

  -- At most 1 Overtime per day
  IF NEW.leave_type = 'Overtime' THEN
    SELECT EXISTS(
      SELECT 1 FROM public.chuti
      WHERE user_id = NEW.user_id
        AND date = NEW.date
        AND (TG_OP = 'INSERT' OR id <> NEW.id)
        AND status <> 'rejected'
        AND deleted_at IS NULL
        AND leave_type = 'Overtime'
    ) INTO v_has_same_ot;
    IF v_has_same_ot THEN
      RAISE EXCEPTION 'An Overtime record already exists on %', NEW.date;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_chuti_same_day_conflicts ON public.chuti;
CREATE TRIGGER trg_enforce_chuti_same_day_conflicts
BEFORE INSERT OR UPDATE OF date, leave_type, status, deleted_at ON public.chuti
FOR EACH ROW EXECUTE FUNCTION public.enforce_chuti_same_day_conflicts();

COMMIT;
