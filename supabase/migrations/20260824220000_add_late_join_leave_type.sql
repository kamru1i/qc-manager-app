-- Migration to add 'Late Join' to the leave_type check constraint in the chuti table
-- and enforce same-day full day vs partial leave conflict rules at the database layer.

BEGIN;

ALTER TABLE public.chuti 
DROP CONSTRAINT IF EXISTS chuti_leave_type_check;

ALTER TABLE public.chuti 
ADD CONSTRAINT chuti_leave_type_check 
CHECK (leave_type IN ('Short Leave', 'Early Leave', 'Late Join', 'Full Leave', 'Overtime'));

-- Trigger function to validate same-day leave conflicts
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
  IF NEW.status = 'rejected' THEN
    RETURN NEW;
  END IF;

  -- 1. Check if Full Leave exists on same date
  SELECT EXISTS(
    SELECT 1 FROM public.chuti
    WHERE user_id = NEW.user_id
      AND date = NEW.date
      AND (TG_OP = 'INSERT' OR id <> NEW.id)
      AND status <> 'rejected'
      AND leave_type = 'Full Leave'
  ) INTO v_has_full_leave;

  -- 2. Check if partial leaves exist on same date
  SELECT EXISTS(
    SELECT 1 FROM public.chuti
    WHERE user_id = NEW.user_id
      AND date = NEW.date
      AND (TG_OP = 'INSERT' OR id <> NEW.id)
      AND status <> 'rejected'
      AND leave_type IN ('Short Leave', 'Early Leave', 'Late Join')
  ) INTO v_has_partial_leave;

  -- If inserting/updating Full Leave on a date that already has any leave record:
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
BEFORE INSERT OR UPDATE OF date, leave_type, status ON public.chuti
FOR EACH ROW EXECUTE FUNCTION public.enforce_chuti_same_day_conflicts();

COMMIT;
