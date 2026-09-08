-- Migration: 20260908220000_fix_user_deletion_audit_fkey.sql
-- Description: Fix audit_logs_target_user_id_fkey constraint violation when deleting user accounts.
-- During cascading user deletion from auth.users -> public.profiles -> child tables (chuti, govt_holiday_responses, leave_settlements, quotation_mistakes),
-- triggers on child tables attempt to log deletions into audit_logs referencing the already-deleted profile.
-- This migration updates audit_business_row_change() to safely set target_user_id to NULL (satisfying the FK constraint)
-- while preserving full target identification inside the audit metadata, and ensures delete_user_by_id retains complete target metadata.

CREATE OR REPLACE FUNCTION public.audit_business_row_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_actor_codename text;
  v_action text;
  v_target_id text;
  v_target_user_id uuid;
  v_details text;
  v_metadata jsonb := '{}'::jsonb;
BEGIN
  SELECT p.username INTO v_actor_codename
  FROM public.profiles p
  WHERE p.id = v_actor_id;

  v_actor_codename := COALESCE(v_actor_codename, auth.role(), session_user, 'System');

  IF TG_TABLE_NAME = 'chuti' THEN
    v_target_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.id::text ELSE NEW.id::text END;
    v_target_user_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.user_id ELSE NEW.user_id END;

    IF TG_OP = 'INSERT' THEN
      v_action := CASE WHEN NEW.adjustment IS TRUE THEN 'ADJUST_LEAVE' ELSE 'CREATE_LEAVE' END;
      v_details := CASE WHEN NEW.adjustment IS TRUE THEN 'Leave adjustment created' ELSE 'Leave record created' END;
      v_metadata := jsonb_build_object(
        'date', NEW.date,
        'leave_type', NEW.leave_type,
        'status', NEW.status,
        'adjustment', NEW.adjustment,
        'bulk_id', NEW.bulk_id
      );
    ELSIF TG_OP = 'DELETE' OR (OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL) THEN
      v_action := 'DELETE_LEAVE';
      v_details := 'Leave record deleted';
      v_metadata := jsonb_build_object(
        'date', CASE WHEN TG_OP = 'DELETE' THEN OLD.date ELSE NEW.date END,
        'leave_type', CASE WHEN TG_OP = 'DELETE' THEN OLD.leave_type ELSE NEW.leave_type END,
        'soft_delete', TG_OP <> 'DELETE'
      );
    ELSIF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('approved', 'approved_by_supervisor') THEN
      v_action := 'APPROVE_LEAVE';
      v_details := 'Leave request approved';
      v_metadata := jsonb_build_object('date', NEW.date, 'from_status', OLD.status, 'to_status', NEW.status);
    ELSIF NEW.status IS DISTINCT FROM OLD.status AND NEW.status = 'needs_review' THEN
      v_action := 'REJECT_LEAVE';
      v_details := 'Leave request returned for revision';
      v_metadata := jsonb_build_object('date', NEW.date, 'from_status', OLD.status, 'to_status', NEW.status);
    ELSIF NEW.adjustment IS DISTINCT FROM OLD.adjustment
       OR NEW.adjusted_hour IS DISTINCT FROM OLD.adjusted_hour
       OR NEW.adjust_short_leave IS DISTINCT FROM OLD.adjust_short_leave
       OR NEW.reserve_holiday IS DISTINCT FROM OLD.reserve_holiday
       OR NEW.reserve_adjustment_status IS DISTINCT FROM OLD.reserve_adjustment_status THEN
      v_action := 'ADJUST_LEAVE';
      v_details := 'Leave adjustment changed';
      v_metadata := jsonb_build_object(
        'date', NEW.date,
        'adjustment', NEW.adjustment,
        'reserve_holiday', NEW.reserve_holiday,
        'reserve_adjustment_status', NEW.reserve_adjustment_status
      );
    ELSE
      v_action := 'UPDATE_LEAVE';
      v_details := 'Leave record updated';
      v_metadata := jsonb_build_object(
        'old_date', OLD.date,
        'new_date', NEW.date,
        'old_leave_type', OLD.leave_type,
        'new_leave_type', NEW.leave_type
      );
    END IF;
  ELSIF TG_TABLE_NAME = 'quotation_mistakes' THEN
    v_target_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.id::text ELSE NEW.id::text END;
    v_target_user_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.user_id ELSE NEW.user_id END;
    v_action := CASE TG_OP
      WHEN 'INSERT' THEN 'CREATE_MISTAKE'
      WHEN 'UPDATE' THEN 'UPDATE_MISTAKE'
      ELSE 'DELETE_MISTAKE'
    END;
    v_details := CASE TG_OP
      WHEN 'INSERT' THEN 'Quotation mistake created'
      WHEN 'UPDATE' THEN 'Quotation mistake updated'
      ELSE 'Quotation mistake deleted'
    END;
    v_metadata := CASE WHEN TG_OP = 'DELETE'
      THEN jsonb_build_object('date', OLD.date, 'filename', OLD.filename, 'branch', OLD.branch)
      ELSE jsonb_build_object('date', NEW.date, 'filename', NEW.filename, 'branch', NEW.branch)
    END;
  ELSIF TG_TABLE_NAME = 'govt_holiday_responses' THEN
    v_target_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.id::text ELSE NEW.id::text END;
    v_target_user_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.user_id ELSE NEW.user_id END;
    v_action := 'ADJUST_LEAVE';
    v_details := CASE TG_OP
      WHEN 'INSERT' THEN 'Government holiday entitlement initialized'
      WHEN 'UPDATE' THEN 'Government holiday entitlement changed'
      ELSE 'Government holiday entitlement removed'
    END;
    v_metadata := CASE WHEN TG_OP = 'DELETE'
      THEN jsonb_build_object('holiday_date', OLD.holiday_date, 'holiday_name', OLD.holiday_name, 'old_response', OLD.response)
      ELSE jsonb_build_object(
        'holiday_date', NEW.holiday_date,
        'holiday_name', NEW.holiday_name,
        'old_response', CASE WHEN TG_OP = 'UPDATE' THEN OLD.response ELSE NULL END,
        'new_response', NEW.response,
        'updated_by_admin', NEW.updated_by_admin
      )
    END;
  ELSIF TG_TABLE_NAME = 'leave_settlements' THEN
    v_target_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.id::text ELSE NEW.id::text END;
    v_target_user_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.user_id ELSE NEW.user_id END;
    v_action := 'SETTLE_LEAVE';
    v_details := CASE TG_OP
      WHEN 'INSERT' THEN 'Leave settlement created'
      WHEN 'UPDATE' THEN 'Leave settlement updated'
      ELSE 'Leave settlement deleted'
    END;
    v_metadata := CASE WHEN TG_OP = 'DELETE'
      THEN jsonb_build_object('year', OLD.year, 'period', OLD.period, 'category', OLD.leave_category, 'status', OLD.status)
      ELSE jsonb_build_object(
        'year', NEW.year,
        'period', NEW.period,
        'category', NEW.leave_category,
        'old_status', CASE WHEN TG_OP = 'UPDATE' THEN OLD.status ELSE NULL END,
        'new_status', NEW.status,
        'action_type', NEW.action_type
      )
    END;
  ELSE
    RAISE EXCEPTION 'Unsupported audited table: %', TG_TABLE_NAME;
  END IF;

  -- If target_user_id does not exist in profiles (e.g. during cascading user deletion),
  -- set target_user_id to NULL to satisfy FK constraint while preserving identity in metadata
  IF v_target_user_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = v_target_user_id
  ) THEN
    v_metadata := jsonb_set(
      COALESCE(v_metadata, '{}'::jsonb),
      '{target_user_id}',
      to_jsonb(v_target_user_id::text)
    );
    v_target_user_id := NULL;
  END IF;

  -- Similarly, if actor_id does not exist in profiles, set to NULL to prevent FK error
  IF v_actor_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = v_actor_id
  ) THEN
    v_metadata := jsonb_set(
      COALESCE(v_metadata, '{}'::jsonb),
      '{actor_id}',
      to_jsonb(v_actor_id::text)
    );
    v_actor_id := NULL;
  END IF;

  INSERT INTO public.audit_logs (
    actor_id,
    actor_codename,
    action_type,
    target_id,
    target_user_id,
    details,
    metadata
  ) VALUES (
    v_actor_id,
    v_actor_codename,
    v_action,
    v_target_id,
    v_target_user_id,
    v_details,
    v_metadata
  );

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

REVOKE ALL ON FUNCTION public.audit_business_row_change() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.audit_business_row_change() TO service_role;

-- Update delete_user_by_id to guarantee metadata preservation on user deletion
CREATE OR REPLACE FUNCTION public.delete_user_by_id(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_role text;
  v_actor_name text;
  v_target_role text;
  v_target_name text;
BEGIN
  SELECT role, username INTO v_actor_role, v_actor_name FROM public.profiles WHERE id = auth.uid();
  SELECT role, username INTO v_target_role, v_target_name FROM public.profiles WHERE id = p_user_id FOR UPDATE;

  IF v_target_role IS NULL THEN
    RAISE EXCEPTION 'Target user not found.';
  END IF;
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Self-deletion is not allowed.';
  END IF;
  IF NOT (
    v_actor_role = 'superadmin'
    OR (v_actor_role = 'admin' AND v_target_role IN ('user', 'supervisor'))
  ) THEN
    RAISE EXCEPTION 'Permission denied for this target account.';
  END IF;

  INSERT INTO public.audit_logs (
    actor_id, actor_codename, action_type, target_id, target_user_id, details, metadata
  ) VALUES (
    auth.uid(), COALESCE(v_actor_name, 'System'), 'DELETE_USER', p_user_id::text,
    p_user_id, 'User account deleted', jsonb_build_object(
      'target_role', v_target_role,
      'target_codename', v_target_name,
      'target_user_id', p_user_id::text
    )
  );

  DELETE FROM auth.users WHERE id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_user_by_id(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_user_by_id(uuid) TO authenticated, service_role;
