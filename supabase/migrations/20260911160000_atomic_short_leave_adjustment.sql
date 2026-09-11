-- Migration: 20260911160000_atomic_short_leave_adjustment.sql
-- Description: Atomic Short Leave / Overtime / General Adjustment functions and bidirectional history support.

BEGIN;

-- 1. Function to atomically apply leave adjustments
CREATE OR REPLACE FUNCTION public.apply_leave_adjustment(
  p_leave_id uuid,
  p_source text,
  p_adjustment_type text,
  p_amount_minutes integer,
  p_reason text DEFAULT NULL,
  p_holiday_date text DEFAULT NULL,
  p_holiday_name text DEFAULT NULL,
  p_salary_month text DEFAULT NULL,
  p_salary_year text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id uuid;
  v_caller_role text;
  v_target_record record;
  v_original_minutes integer;
  v_existing_adj_minutes integer := 0;
  v_new_total_adj_minutes integer;
  v_remaining_minutes integer;
  v_available_ot_minutes integer := 0;
  v_total_earned_ot integer := 0;
  v_total_consumed_ot integer := 0;
  v_is_fully_adjusted boolean;
  v_formatted_adj_hour text;
  v_new_entry jsonb;
  v_adjustments jsonb;
  v_existing_notifications jsonb;
  v_new_notification jsonb;
  v_merged_admin_edit jsonb;
  v_clean_comment text;
  v_approvals_prefix text;
  v_adj_message text;
  v_final_comment text;
  v_is_partial_leave boolean;
  v_is_admin boolean;
  v_entry_id text;
BEGIN
  -- Set bypass flag for security trigger
  PERFORM set_config('app.bypass_chuti_security', 'true', true);

  v_caller_id := auth.uid();
  IF v_caller_id IS NOT NULL THEN
    SELECT role INTO v_caller_role FROM public.profiles WHERE id = v_caller_id;
  END IF;

  v_is_admin := (v_caller_role IN ('admin', 'superadmin'));

  -- Lock the target leave record
  SELECT * INTO v_target_record 
  FROM public.chuti 
  WHERE id = p_leave_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Leave record not found.';
  END IF;

  v_is_partial_leave := (v_target_record.leave_type IN ('Short Leave', 'Early Leave', 'Late Join'));

  IF NOT v_is_admin THEN
    IF v_caller_id <> v_target_record.user_id THEN
      RAISE EXCEPTION 'You are not authorized to adjust this leave record.';
    END IF;
  END IF;

  -- Compute original duration in minutes
  IF v_target_record.leave_hour IS NOT NULL THEN
    v_original_minutes := (EXTRACT(EPOCH FROM v_target_record.leave_hour)::integer / 60);
  ELSE
    v_original_minutes := 0;
  END IF;

  -- Calculate existing adjustments from admin_edit_request.adjustments
  IF v_target_record.admin_edit_request IS NOT NULL 
     AND jsonb_typeof(v_target_record.admin_edit_request->'adjustments') = 'array' THEN
    SELECT COALESCE(SUM((elem->>'amount_minutes')::integer), 0)
    INTO v_existing_adj_minutes
    FROM jsonb_array_elements(v_target_record.admin_edit_request->'adjustments') AS elem;
    v_adjustments := v_target_record.admin_edit_request->'adjustments';
  ELSE
    IF v_target_record.adjustment THEN
      v_existing_adj_minutes := v_original_minutes;
    ELSIF v_target_record.adjusted_hour IS NOT NULL THEN
      v_existing_adj_minutes := (EXTRACT(EPOCH FROM v_target_record.adjusted_hour)::integer / 60);
    ELSE
      v_existing_adj_minutes := 0;
    END IF;
    v_adjustments := '[]'::jsonb;
  END IF;

  v_remaining_minutes := GREATEST(0, v_original_minutes - v_existing_adj_minutes);

  IF p_amount_minutes <= 0 THEN
    RAISE EXCEPTION 'Adjustment amount must be greater than zero.';
  END IF;

  IF p_amount_minutes > v_remaining_minutes THEN
    RAISE EXCEPTION 'Adjustment amount (% minutes) exceeds remaining duration (% minutes).', 
      p_amount_minutes, v_remaining_minutes;
  END IF;

  -- If adjusting with Overtime, calculate available Overtime for user
  IF p_source = 'Overtime' THEN
    -- Earned Overtime: sum of approved Overtime records
    SELECT COALESCE(SUM(
      CASE 
        WHEN c.adjustment THEN 0
        WHEN c.adjusted_hour IS NOT NULL THEN GREATEST(0, (EXTRACT(EPOCH FROM c.leave_hour)::integer / 60) - (EXTRACT(EPOCH FROM c.adjusted_hour)::integer / 60))
        ELSE (EXTRACT(EPOCH FROM c.leave_hour)::integer / 60)
      END
    ), 0)
    INTO v_total_earned_ot
    FROM public.chuti c
    WHERE c.user_id = v_target_record.user_id
      AND c.leave_type = 'Overtime'
      AND c.status = 'approved'
      AND c.deleted_at IS NULL;

    -- Consumed Overtime: sum of Overtime adjustments on approved short leaves
    SELECT COALESCE(SUM((elem->>'amount_minutes')::integer), 0)
    INTO v_total_consumed_ot
    FROM public.chuti c,
         jsonb_array_elements(
           CASE 
             WHEN c.admin_edit_request IS NOT NULL AND jsonb_typeof(c.admin_edit_request->'adjustments') = 'array' 
             THEN c.admin_edit_request->'adjustments' 
             ELSE '[]'::jsonb 
           END
         ) AS elem
    WHERE c.user_id = v_target_record.user_id
      AND c.leave_type IN ('Short Leave', 'Early Leave', 'Late Join')
      AND c.status = 'approved'
      AND c.deleted_at IS NULL
      AND elem->>'source' = 'Overtime';

    v_available_ot_minutes := GREATEST(0, v_total_earned_ot - v_total_consumed_ot);

    IF p_amount_minutes > v_available_ot_minutes THEN
      RAISE EXCEPTION 'Insufficient overtime balance. Available: % minutes, Requested: % minutes.',
        v_available_ot_minutes, p_amount_minutes;
    END IF;
  END IF;

  -- Prepare adjustment entry
  v_entry_id := gen_random_uuid()::text;
  v_new_total_adj_minutes := v_existing_adj_minutes + p_amount_minutes;
  v_is_fully_adjusted := (v_new_total_adj_minutes >= v_original_minutes);
  v_formatted_adj_hour := format('%s:%s:00', 
    lpad((v_new_total_adj_minutes / 60)::text, 2, '0'), 
    lpad((v_new_total_adj_minutes % 60)::text, 2, '0'));

  -- Build audit comment
  IF p_source = 'Overtime' THEN
    v_adj_message := format('%s minutes adjusted with Overtime', p_amount_minutes);
  ELSIF p_source = 'General Adjustment' THEN
    IF p_reason IS NOT NULL AND trim(p_reason) <> '' THEN
      v_adj_message := format('%s minutes adjusted with General Adjustment — %s', p_amount_minutes, trim(p_reason));
    ELSE
      v_adj_message := format('%s minutes adjusted with General Adjustment', p_amount_minutes);
    END IF;
  ELSIF p_source = 'Govt Holiday' AND p_holiday_date IS NOT NULL THEN
    v_adj_message := format('Adjusted with Government Holiday on %s — %s', p_holiday_date, COALESCE(p_holiday_name, ''));
  ELSIF p_source = 'Salary' THEN
    v_adj_message := format('Adjusted with %s %s salary deduction', COALESCE(p_salary_month, ''), COALESCE(p_salary_year, ''));
  ELSE
    v_adj_message := format('Adjusted with %s', p_source);
  END IF;

  v_clean_comment := trim(regexp_replace(COALESCE(v_target_record.comment, ''), '^(\[Approved by[^\]]*\]\s*\|\s*)*', ''));
  v_final_comment := CASE 
    WHEN v_clean_comment <> '' THEN format('%s | %s', v_adj_message, v_clean_comment)
    ELSE v_adj_message
  END;

  v_new_entry := jsonb_build_object(
    'id', v_entry_id,
    'amount_minutes', p_amount_minutes,
    'source', p_source,
    'source_date', p_holiday_date,
    'source_name', p_holiday_name,
    'salary_month', p_salary_month,
    'salary_year', p_salary_year,
    'reason', p_reason,
    'action_date', timezone('utc', now())::text,
    'comment', v_adj_message,
    'adjusted_by', v_caller_id
  );

  v_adjustments := v_adjustments || jsonb_build_array(v_new_entry);

  -- Extract notifications
  IF v_target_record.admin_edit_request IS NOT NULL 
     AND jsonb_typeof(v_target_record.admin_edit_request->'notifications') = 'array' THEN
    v_existing_notifications := v_target_record.admin_edit_request->'notifications';
  ELSE
    v_existing_notifications := '[]'::jsonb;
  END IF;

  v_new_notification := jsonb_build_object(
    'id', gen_random_uuid()::text,
    'type', 'adjusted',
    'title', 'Leave Adjustment Completed ✅',
    'message', format('Your leave on %s has been adjusted: %s.', v_target_record.date, v_adj_message),
    'created_at', timezone('utc', now())::text,
    'read', false
  );

  v_merged_admin_edit := COALESCE(v_target_record.admin_edit_request, '{}'::jsonb) || jsonb_build_object(
    'adjustments', v_adjustments,
    'notifications', v_existing_notifications || jsonb_build_array(v_new_notification),
    'last_adjusted_at', timezone('utc', now())::text,
    'last_adjustment_source', p_source
  );

  IF v_is_admin THEN
    UPDATE public.chuti
    SET adjustment = v_is_fully_adjusted,
        adjusted_hour = v_formatted_adj_hour::interval,
        adjust_short_leave = false,
        reserve_holiday = CASE 
          WHEN p_source = 'Govt Holiday' AND p_holiday_date IS NOT NULL THEN format('%s — %s', p_holiday_date, COALESCE(p_holiday_name, ''))
          ELSE p_source
        END,
        reserve_adjustment_status = 'none',
        comment = v_final_comment,
        admin_edit_request = v_merged_admin_edit,
        updated_at = now()
    WHERE id = p_leave_id;
  ELSE
    UPDATE public.chuti
    SET reserve_adjustment_status = 'pending',
        admin_edit_request = v_merged_admin_edit || jsonb_build_object(
          'pending_adjustment', v_new_entry
        ),
        updated_at = now()
    WHERE id = p_leave_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'is_fully_adjusted', v_is_fully_adjusted,
    'total_adjusted_minutes', v_new_total_adj_minutes,
    'remaining_minutes', GREATEST(0, v_original_minutes - v_new_total_adj_minutes),
    'adjusted_hour', v_formatted_adj_hour,
    'entry', v_new_entry
  );
END;
$$;

-- 2. Function to atomically cancel / revert leave adjustments
CREATE OR REPLACE FUNCTION public.cancel_leave_adjustment(
  p_leave_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id uuid;
  v_caller_role text;
  v_target_record record;
  v_clean_comment text;
  v_is_admin boolean;
  v_existing_notifications jsonb;
  v_new_notification jsonb;
BEGIN
  PERFORM set_config('app.bypass_chuti_security', 'true', true);

  v_caller_id := auth.uid();
  IF v_caller_id IS NOT NULL THEN
    SELECT role INTO v_caller_role FROM public.profiles WHERE id = v_caller_id;
  END IF;

  v_is_admin := (v_caller_role IN ('admin', 'superadmin'));

  SELECT * INTO v_target_record 
  FROM public.chuti 
  WHERE id = p_leave_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Leave record not found.';
  END IF;

  IF NOT v_is_admin THEN
    IF v_caller_id <> v_target_record.user_id THEN
      RAISE EXCEPTION 'You are not authorized to cancel this adjustment.';
    END IF;
  END IF;

  v_clean_comment := trim(regexp_replace(COALESCE(v_target_record.comment, ''), '^(\[Approved by[^\]]*\]\s*\|\s*)*', ''));
  -- Also remove "Adjusted: ..." or "Adjusted with ..."
  v_clean_comment := trim(regexp_replace(v_clean_comment, 'Adjusted[^|]*(\|\s*)?', '', 'gi'));

  IF v_target_record.admin_edit_request IS NOT NULL 
     AND jsonb_typeof(v_target_record.admin_edit_request->'notifications') = 'array' THEN
    v_existing_notifications := v_target_record.admin_edit_request->'notifications';
  ELSE
    v_existing_notifications := '[]'::jsonb;
  END IF;

  v_new_notification := jsonb_build_object(
    'id', gen_random_uuid()::text,
    'type', 'cancelled',
    'title', 'Leave Adjustment Cancelled ⚠️',
    'message', format('Adjustment for your leave on %s has been cancelled.', v_target_record.date),
    'created_at', timezone('utc', now())::text,
    'read', false
  );

  IF v_is_admin THEN
    UPDATE public.chuti
    SET adjustment = false,
        adjusted_hour = NULL,
        adjust_short_leave = false,
        reserve_holiday = NULL,
        reserve_adjustment_status = 'none',
        comment = NULLIF(v_clean_comment, ''),
        admin_edit_request = COALESCE(v_target_record.admin_edit_request, '{}'::jsonb) - 'adjustments' - 'last_adjusted_at' - 'last_adjustment_source' || jsonb_build_object(
          'notifications', v_existing_notifications || jsonb_build_array(v_new_notification)
        ),
        updated_at = now()
    WHERE id = p_leave_id;
  ELSE
    UPDATE public.chuti
    SET reserve_adjustment_status = 'pending',
        admin_edit_request = COALESCE(v_target_record.admin_edit_request, '{}'::jsonb) || jsonb_build_object(
          'pending_cancel_adjustment', true,
          'notifications', v_existing_notifications
        ),
        updated_at = now()
    WHERE id = p_leave_id;
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_leave_adjustment TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cancel_leave_adjustment TO authenticated, service_role;

COMMIT;
