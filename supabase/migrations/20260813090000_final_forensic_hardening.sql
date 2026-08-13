-- Final forensic hardening: authorization, transactional leave/holiday workflows,
-- auditable mutations, bounded leaderboard metadata, and RPC privilege hygiene.

-- ---------------------------------------------------------------------------
-- Audit log: transactionally generated, actor-bound, and not client-forgeable.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_codename text NOT NULL DEFAULT 'System',
  action_type text NOT NULL,
  target_id text,
  details text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS target_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at
  ON public.audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_created_at
  ON public.audit_logs (action_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target_user_created_at
  ON public.audit_logs (target_user_id, created_at DESC)
  WHERE target_user_id IS NOT NULL;

DROP POLICY IF EXISTS "Allow authenticated users to insert audit_logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Allow admins/supervisors to view audit_logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Scoped audit log visibility" ON public.audit_logs;
CREATE POLICY "Scoped audit log visibility"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (
  public.is_admin()
  OR actor_id = (SELECT auth.uid())
  OR target_user_id = (SELECT auth.uid())
  OR (
    public.is_supervisor()
    AND target_user_id IS NOT NULL
    AND public.has_leave_access((SELECT auth.uid()), target_user_id)
  )
);

REVOKE INSERT, UPDATE, DELETE ON public.audit_logs FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;

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

DROP TRIGGER IF EXISTS audit_chuti_changes ON public.chuti;
CREATE TRIGGER audit_chuti_changes
AFTER INSERT OR UPDATE OR DELETE ON public.chuti
FOR EACH ROW EXECUTE FUNCTION public.audit_business_row_change();

DROP TRIGGER IF EXISTS audit_quotation_mistake_changes ON public.quotation_mistakes;
CREATE TRIGGER audit_quotation_mistake_changes
AFTER INSERT OR UPDATE OR DELETE ON public.quotation_mistakes
FOR EACH ROW EXECUTE FUNCTION public.audit_business_row_change();

DROP TRIGGER IF EXISTS audit_govt_holiday_response_changes ON public.govt_holiday_responses;
CREATE TRIGGER audit_govt_holiday_response_changes
AFTER INSERT OR UPDATE OR DELETE ON public.govt_holiday_responses
FOR EACH ROW EXECUTE FUNCTION public.audit_business_row_change();

DROP TRIGGER IF EXISTS audit_leave_settlement_changes ON public.leave_settlements;
CREATE TRIGGER audit_leave_settlement_changes
AFTER INSERT OR UPDATE OR DELETE ON public.leave_settlements
FOR EACH ROW EXECUTE FUNCTION public.audit_business_row_change();

-- ---------------------------------------------------------------------------
-- Profile hierarchy and JSON privilege protection.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.can_read_profile(p_target_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_role text;
  v_supervisor_ids uuid[];
BEGIN
  IF p_target_id = auth.uid() THEN RETURN true; END IF;

  SELECT role, supervisor_ids
  INTO v_actor_role, v_supervisor_ids
  FROM public.profiles
  WHERE id = auth.uid();

  IF v_actor_role IN ('admin', 'superadmin', 'supervisor') THEN
    RETURN true;
  END IF;

  IF v_actor_role = 'user' THEN
    IF p_target_id = ANY(COALESCE(v_supervisor_ids, ARRAY[]::uuid[])) THEN
      RETURN true;
    END IF;
    RETURN EXISTS (
      SELECT 1
      FROM public.profiles supervisor
      WHERE supervisor.id = ANY(COALESCE(v_supervisor_ids, ARRAY[]::uuid[]))
        AND supervisor.delegated_supervisor_id = p_target_id
    );
  END IF;

  RETURN false;
END;
$$;

DROP POLICY IF EXISTS "Allow authenticated users to read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Role-scoped profile reads" ON public.profiles;
CREATE POLICY "Role-scoped profile reads"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.can_read_profile(id));

CREATE OR REPLACE FUNCTION public.check_profile_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
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
    'emp_id',
    'date_of_joining'
  ];
BEGIN
  IF current_setting('app.bypass_profile_security', true) = 'true'
     OR auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  SELECT p.role INTO v_actor_role
  FROM public.profiles p
  WHERE p.id = auth.uid();

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

DROP POLICY IF EXISTS "Allow admins to update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow supervisors to update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow users to update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Scoped profile updates" ON public.profiles;
CREATE POLICY "Scoped profile updates"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  id = (SELECT auth.uid())
  OR public.is_superadmin()
  OR (public.get_my_role() = 'admin' AND role IN ('user', 'supervisor'))
  OR (public.is_supervisor() AND role = 'user' AND public.has_leave_access((SELECT auth.uid()), id))
)
WITH CHECK (
  id = (SELECT auth.uid())
  OR public.is_superadmin()
  OR (public.get_my_role() = 'admin' AND role IN ('user', 'supervisor'))
  OR (public.is_supervisor() AND role = 'user' AND public.has_leave_access((SELECT auth.uid()), id))
);

DROP POLICY IF EXISTS "Allow admins to delete profiles" ON public.profiles;
DROP POLICY IF EXISTS "Role-hierarchical profile deletion" ON public.profiles;
CREATE POLICY "Role-hierarchical profile deletion"
ON public.profiles
FOR DELETE
TO authenticated
USING (
  (public.is_superadmin() AND id <> (SELECT auth.uid()))
  OR (public.get_my_role() = 'admin' AND role IN ('user', 'supervisor'))
);

-- ---------------------------------------------------------------------------
-- Credential/user administration hierarchy.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_configured_user(
  p_email text,
  p_password text,
  p_username text,
  p_role text,
  p_full_name text,
  p_profile_options jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_supervisor_ids uuid[];
  v_allowed_types text[];
  v_working_hours numeric;
  v_break_time numeric;
  v_actor_name text;
BEGIN
  IF jsonb_typeof(COALESCE(p_profile_options, '{}'::jsonb)) <> 'object' THEN
    RAISE EXCEPTION 'Profile options must be a JSON object.';
  END IF;

  SELECT COALESCE(array_agg(value::uuid), ARRAY[]::uuid[])
  INTO v_supervisor_ids
  FROM jsonb_array_elements_text(
    CASE WHEN jsonb_typeof(p_profile_options->'supervisor_ids') = 'array'
      THEN p_profile_options->'supervisor_ids' ELSE '[]'::jsonb END
  );

  SELECT COALESCE(array_agg(value), ARRAY[]::text[])
  INTO v_allowed_types
  FROM jsonb_array_elements_text(
    CASE WHEN jsonb_typeof(p_profile_options->'allowed_types') = 'array'
      THEN p_profile_options->'allowed_types' ELSE '[]'::jsonb END
  );

  v_working_hours := COALESCE((p_profile_options->>'working_hours')::numeric, 9.5);
  v_break_time := COALESCE((p_profile_options->>'break_time')::numeric, 0);
  IF v_working_hours <= 0 OR v_working_hours > 24 OR v_break_time < 0 OR v_break_time > 24 THEN
    RAISE EXCEPTION 'Invalid working-hours or break-time value.';
  END IF;

  -- The existing, hardened creator owns auth.users compatibility. Calling it
  -- inside this function keeps auth creation and profile completion in one DB
  -- transaction, so a validation/update error rolls the account back too.
  v_user_id := public.create_new_user(
    p_email,
    p_password,
    p_username,
    p_role,
    p_full_name,
    COALESCE((p_profile_options->>'needs_supervisor_approval')::boolean, false),
    COALESCE((p_profile_options->>'allow_reserve')::boolean, false),
    COALESCE((p_profile_options->>'allow_overtime')::boolean, false),
    v_supervisor_ids
  );

  PERFORM set_config('app.bypass_profile_security', 'true', true);
  UPDATE public.profiles
  SET allowed_types = v_allowed_types,
      can_manage_rules = COALESCE((p_profile_options->>'can_manage_rules')::boolean, false),
      has_chuti_access = COALESCE((p_profile_options->>'has_chuti_access')::boolean, true),
      has_quotes_access = COALESCE((p_profile_options->>'has_quotes_access')::boolean, true),
      eligible_govt_holiday = COALESCE((p_profile_options->>'eligible_govt_holiday')::boolean, true),
      eligible_office_leave = COALESCE((p_profile_options->>'eligible_office_leave')::boolean, true),
      job_role = NULLIF(btrim(p_profile_options->>'job_role'), ''),
      working_hours = v_working_hours,
      break_time = v_break_time,
      default_sign_in = COALESCE(NULLIF(p_profile_options->>'default_sign_in', '')::time, default_sign_in),
      default_sign_out = COALESCE(NULLIF(p_profile_options->>'default_sign_out', '')::time, default_sign_out),
      global_settings = COALESCE(global_settings, '{}'::jsonb) || jsonb_build_object(
        'kpi_skills', CASE WHEN jsonb_typeof(p_profile_options->'kpi_skills') = 'array' THEN p_profile_options->'kpi_skills' ELSE '[]'::jsonb END,
        'kpi_dept_indicators', CASE WHEN jsonb_typeof(p_profile_options->'kpi_dept_indicators') = 'array' THEN p_profile_options->'kpi_dept_indicators' ELSE '[]'::jsonb END,
        'kpi_other_dept_indicators', CASE WHEN jsonb_typeof(p_profile_options->'kpi_other_dept_indicators') = 'array' THEN p_profile_options->'kpi_other_dept_indicators' ELSE '[]'::jsonb END,
        'performs_data_entry', COALESCE((p_profile_options->>'performs_data_entry')::boolean, true),
        'department', COALESCE(NULLIF(btrim(p_profile_options->>'department'), ''), 'Data Entry'),
        'performs_other_dept_tasks', COALESCE((p_profile_options->>'performs_other_dept_tasks')::boolean, false),
        'other_department', COALESCE(NULLIF(btrim(p_profile_options->>'other_department'), ''), 'IT')
      )
  WHERE id = v_user_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'New profile was not created.'; END IF;

  SELECT username INTO v_actor_name FROM public.profiles WHERE id = auth.uid();
  INSERT INTO public.audit_logs (
    actor_id, actor_codename, action_type, target_id, target_user_id, details, metadata
  ) VALUES (
    auth.uid(), COALESCE(v_actor_name, 'System'), 'CREATE_USER', v_user_id::text,
    v_user_id, 'User account created', jsonb_build_object('role', p_role, 'username', upper(btrim(p_username)))
  );

  RETURN v_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_user_credentials(
  p_user_id uuid,
  p_new_username text DEFAULT NULL,
  p_new_password text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_actor_role text;
  v_target_role text;
  v_clean_username text;
  v_current_email text;
  v_email_domain text;
BEGIN
  SELECT role INTO v_actor_role FROM public.profiles WHERE id = auth.uid();
  SELECT role INTO v_target_role FROM public.profiles WHERE id = p_user_id FOR UPDATE;

  IF v_target_role IS NULL THEN
    RAISE EXCEPTION 'Target user not found.';
  END IF;

  IF v_actor_role = 'superadmin' THEN
    NULL;
  ELSIF v_actor_role = 'admin' AND v_target_role IN ('user', 'supervisor') THEN
    NULL;
  ELSIF v_actor_role = 'supervisor'
        AND v_target_role = 'user'
        AND public.has_leave_access(auth.uid(), p_user_id) THEN
    NULL;
  ELSE
    RAISE EXCEPTION 'Permission denied for this target account.';
  END IF;

  IF p_new_username IS NOT NULL AND btrim(p_new_username) <> '' THEN
    v_clean_username := upper(btrim(p_new_username));
    IF v_clean_username !~ '^[A-Z0-9._-]{2,50}$' THEN
      RAISE EXCEPTION 'Codename must be 2-50 characters using letters, numbers, dot, underscore, or hyphen.';
    END IF;

    SELECT email INTO v_current_email FROM auth.users WHERE id = p_user_id;
    v_email_domain := CASE
      WHEN position('@' IN COALESCE(v_current_email, '')) > 0
        THEN split_part(v_current_email, '@', 2)
      WHEN v_target_role IN ('admin', 'superadmin') THEN 'admin.local'
      WHEN v_target_role = 'supervisor' THEN 'supervisor.local'
      ELSE 'user.local'
    END;

    PERFORM set_config('app.bypass_profile_security', 'true', true);
    UPDATE public.profiles SET username = v_clean_username WHERE id = p_user_id;
    UPDATE public.records SET codename = v_clean_username WHERE user_id = p_user_id AND codename IS DISTINCT FROM v_clean_username;
    UPDATE public.todos SET codename = v_clean_username WHERE user_id = p_user_id AND codename IS DISTINCT FROM v_clean_username;
    UPDATE public.quotation_mistakes SET codename = v_clean_username WHERE user_id = p_user_id AND codename IS DISTINCT FROM v_clean_username;
    UPDATE auth.users
    SET email = lower(v_clean_username) || '@' || v_email_domain,
        raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('username', v_clean_username),
        updated_at = now()
    WHERE id = p_user_id;
  END IF;

  IF p_new_password IS NOT NULL AND p_new_password <> '' THEN
    IF length(p_new_password) < 6 OR length(p_new_password) > 72 THEN
      RAISE EXCEPTION 'Password must be between 6 and 72 characters.';
    END IF;
    UPDATE auth.users
    SET encrypted_password = crypt(p_new_password, gen_salt('bf')),
        updated_at = now()
    WHERE id = p_user_id;

    PERFORM set_config('app.bypass_profile_security', 'true', true);
    UPDATE public.profiles
    SET has_changed_password = p_new_password <> '1234',
        is_setup_completed = CASE
          WHEN p_new_password = '1234' THEN false
          ELSE true
        END,
        global_settings = jsonb_set(
          COALESCE(global_settings, '{}'::jsonb),
          '{password_reset_status}',
          '"none"'::jsonb,
          true
        )
    WHERE id = p_user_id;
  END IF;

  INSERT INTO public.audit_logs (
    actor_id, actor_codename, action_type, target_id, target_user_id, details, metadata
  )
  SELECT auth.uid(), a.username, 'UPDATE_CREDENTIALS', p_user_id::text, p_user_id,
         'User credentials updated',
         jsonb_build_object(
           'username_changed', p_new_username IS NOT NULL AND btrim(p_new_username) <> '',
           'password_changed', p_new_password IS NOT NULL AND p_new_password <> ''
         )
  FROM public.profiles a
  WHERE a.id = auth.uid();
END;
$$;

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
    p_user_id, 'User account deleted', jsonb_build_object('target_role', v_target_role, 'target_codename', v_target_name)
  );

  DELETE FROM auth.users WHERE id = p_user_id;
END;
$$;

-- Own-profile JSON updates are intentionally restricted to device/UI preferences.
CREATE OR REPLACE FUNCTION public.update_global_settings_key(
  p_user_id uuid,
  p_key text,
  p_value jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.role() = 'service_role' THEN
    NULL;
  ELSIF auth.uid() = p_user_id AND p_key = 'hidden_tabs' THEN
    NULL;
  ELSE
    RAISE EXCEPTION 'Permission denied for global settings key "%".', p_key;
  END IF;

  IF p_key = 'hidden_tabs' AND jsonb_typeof(p_value) <> 'array' THEN
    RAISE EXCEPTION 'hidden_tabs must be an array.';
  END IF;

  PERFORM set_config('app.bypass_profile_security', 'true', true);
  UPDATE public.profiles
  SET global_settings = jsonb_set(COALESCE(global_settings, '{}'::jsonb), ARRAY[p_key], p_value, true)
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target profile not found.';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.register_active_session(p_session_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_now_ms bigint := floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint;
  v_existing jsonb;
  v_sessions jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated.';
  END IF;
  IF p_session_id IS NULL OR p_session_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
    RAISE EXCEPTION 'Invalid session identifier.';
  END IF;

  SELECT CASE
    WHEN jsonb_typeof(global_settings->'active_sessions') = 'array'
      THEN global_settings->'active_sessions'
    ELSE '[]'::jsonb
  END
  INTO v_existing
  FROM public.profiles
  WHERE id = v_uid
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found.';
  END IF;

  SELECT COALESCE(jsonb_agg(entry ORDER BY (entry->>'lastActive')::bigint), '[]'::jsonb)
  INTO v_sessions
  FROM (
    SELECT entry
    FROM (
      SELECT value AS entry
      FROM jsonb_array_elements(v_existing)
      WHERE value ? 'sessionId'
        AND value ? 'lastActive'
        AND value->>'sessionId' <> p_session_id
        AND value->>'lastActive' ~ '^[0-9]+$'
        AND (value->>'lastActive')::bigint > v_now_ms - 604800000
      UNION ALL
      SELECT jsonb_build_object('sessionId', p_session_id, 'lastActive', v_now_ms)
    ) candidates
    ORDER BY (entry->>'lastActive')::bigint DESC
    LIMIT 10
  ) recent;

  PERFORM set_config('app.bypass_profile_security', 'true', true);
  UPDATE public.profiles
  SET global_settings = jsonb_set(
    COALESCE(global_settings, '{}'::jsonb),
    '{active_sessions}',
    v_sessions,
    true
  )
  WHERE id = v_uid;

  RETURN v_sessions;
END;
$$;

-- Service-only, non-enumerating password-reset request. A single jsonb_set
-- prevents the public API route from overwriting concurrent settings changes.
CREATE OR REPLACE FUNCTION public.request_password_reset(p_username text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.role() <> 'service_role' AND session_user NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'Service role required.';
  END IF;

  PERFORM set_config('app.bypass_profile_security', 'true', true);
  UPDATE public.profiles
  SET global_settings = jsonb_set(
    COALESCE(global_settings, '{}'::jsonb),
    '{password_reset_status}',
    '"pending"'::jsonb,
    true
  )
  WHERE upper(username) = upper(btrim(p_username))
    AND COALESCE(global_settings->>'password_reset_status', '') <> 'pending';
END;
$$;

DROP FUNCTION IF EXISTS public.complete_profile_setup(text, text);
CREATE OR REPLACE FUNCTION public.complete_profile_setup(
  p_username text,
  p_full_name text,
  p_new_password text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_already_complete boolean;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Not authenticated.');
  END IF;
  IF p_username IS NULL OR upper(btrim(p_username)) !~ '^[A-Z0-9._-]{2,50}$' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Codename must be 2-50 characters using letters, numbers, dot, underscore, or hyphen.');
  END IF;
  IF p_full_name IS NULL OR length(btrim(p_full_name)) < 2 OR length(btrim(p_full_name)) > 100 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Full name must be between 2 and 100 characters.');
  END IF;
  IF p_new_password IS NULL OR length(p_new_password) < 6 OR length(p_new_password) > 72 OR p_new_password = '1234' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Choose a non-default password between 6 and 72 characters.');
  END IF;

  SELECT has_changed_password INTO v_already_complete
  FROM public.profiles WHERE id = v_uid FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Profile not found.');
  END IF;
  IF v_already_complete IS TRUE THEN
    RETURN jsonb_build_object('success', false, 'message', 'Profile setup is already complete.');
  END IF;

  IF EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = v_uid
      AND u.encrypted_password = crypt(p_new_password, u.encrypted_password)
  ) THEN
    RETURN jsonb_build_object('success', false, 'message', 'New password must differ from the current password.');
  END IF;

  BEGIN
    UPDATE auth.users
    SET encrypted_password = crypt(p_new_password, gen_salt('bf')),
        updated_at = now()
    WHERE id = v_uid;

    UPDATE public.profiles
    SET username = upper(btrim(p_username)),
        full_name = btrim(p_full_name),
        has_changed_password = true,
        is_setup_completed = true,
        has_edited_profile = true
    WHERE id = v_uid;
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'message', 'This codename is already taken. Please choose another.');
  END;

  RETURN jsonb_build_object(
    'success', true,
    'profile', (SELECT to_jsonb(p) FROM public.profiles p WHERE p.id = v_uid)
  );
END;
$$;

-- The leave workspace intentionally separates the first password change from
-- collection of work-profile details. Each stage is nevertheless atomic so an
-- auth password cannot diverge from the corresponding profile gate.
CREATE OR REPLACE FUNCTION public.change_default_password(p_new_password text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_has_changed boolean;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Not authenticated.');
  END IF;
  IF p_new_password IS NULL OR length(p_new_password) < 6 OR length(p_new_password) > 72 OR p_new_password = '1234' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Choose a non-default password between 6 and 72 characters.');
  END IF;

  SELECT has_changed_password INTO v_has_changed
  FROM public.profiles
  WHERE id = v_uid
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Profile not found.');
  END IF;
  IF v_has_changed IS TRUE THEN
    RETURN jsonb_build_object('success', false, 'message', 'The default password has already been changed.');
  END IF;
  IF EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = v_uid
      AND u.encrypted_password = crypt(p_new_password, u.encrypted_password)
  ) THEN
    RETURN jsonb_build_object('success', false, 'message', 'New password must differ from the current password.');
  END IF;

  UPDATE auth.users
  SET encrypted_password = crypt(p_new_password, gen_salt('bf')),
      updated_at = now()
  WHERE id = v_uid;

  PERFORM set_config('app.bypass_profile_security', 'true', true);
  UPDATE public.profiles
  SET has_changed_password = true
  WHERE id = v_uid;

  RETURN jsonb_build_object(
    'success', true,
    'profile', (SELECT to_jsonb(p) FROM public.profiles p WHERE p.id = v_uid)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_leave_profile_setup(
  p_full_name text,
  p_working_hours numeric,
  p_break_time integer,
  p_job_role text,
  p_default_sign_in time,
  p_default_sign_out time
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_has_changed boolean;
  v_is_complete boolean;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Not authenticated.');
  END IF;
  IF p_full_name IS NULL OR length(btrim(p_full_name)) < 2 OR length(btrim(p_full_name)) > 100 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Full name must be between 2 and 100 characters.');
  END IF;
  IF p_working_hours IS NULL OR p_working_hours <= 0 OR p_working_hours > 24
     OR p_break_time IS NULL OR p_break_time < 0 OR p_break_time > 24 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invalid working-hours or break-time value.');
  END IF;
  IF p_default_sign_in IS NULL OR p_default_sign_out IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Default sign-in and sign-out times are required.');
  END IF;

  SELECT has_changed_password, COALESCE(is_setup_completed, false)
  INTO v_has_changed, v_is_complete
  FROM public.profiles
  WHERE id = v_uid
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Profile not found.');
  END IF;
  IF v_has_changed IS NOT TRUE THEN
    RETURN jsonb_build_object('success', false, 'message', 'Change the default password before completing the profile.');
  END IF;
  IF v_is_complete IS TRUE THEN
    RETURN jsonb_build_object('success', false, 'message', 'Profile setup is already complete.');
  END IF;

  PERFORM set_config('app.bypass_profile_security', 'true', true);
  UPDATE public.profiles
  SET full_name = btrim(p_full_name),
      working_hours = p_working_hours,
      break_time = p_break_time,
      job_role = NULLIF(btrim(p_job_role), ''),
      default_sign_in = p_default_sign_in,
      default_sign_out = p_default_sign_out,
      is_setup_completed = true,
      has_edited_profile = true
  WHERE id = v_uid;

  RETURN jsonb_build_object(
    'success', true,
    'profile', (SELECT to_jsonb(p) FROM public.profiles p WHERE p.id = v_uid)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_password_reset(
  p_user_id uuid,
  p_approve boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_role text;
  v_target_role text;
BEGIN
  SELECT role INTO v_actor_role FROM public.profiles WHERE id = auth.uid();
  SELECT role INTO v_target_role FROM public.profiles WHERE id = p_user_id FOR UPDATE;

  IF v_target_role IS NULL THEN
    RAISE EXCEPTION 'Target user not found.';
  END IF;
  IF NOT (
    v_actor_role = 'superadmin'
    OR (v_actor_role = 'admin' AND v_target_role IN ('user', 'supervisor'))
  ) THEN
    RAISE EXCEPTION 'Permission denied for this target account.';
  END IF;

  IF p_approve THEN
    PERFORM public.admin_update_user_credentials(p_user_id, NULL, '1234');
  ELSE
    PERFORM set_config('app.bypass_profile_security', 'true', true);
    UPDATE public.profiles
    SET global_settings = jsonb_set(
      COALESCE(global_settings, '{}'::jsonb),
      '{password_reset_status}',
      '"none"'::jsonb,
      true
    )
    WHERE id = p_user_id;
  END IF;
END;
$$;

-- Repair the one historical shape produced by JSON-stringifying an array before
-- passing it to a jsonb RPC. Invalid strings are left untouched for manual review.
DO $$
DECLARE
  v_row record;
  v_parsed jsonb;
BEGIN
  FOR v_row IN
    SELECT id, global_settings->>'active_sessions' AS raw_value
    FROM public.profiles
    WHERE jsonb_typeof(global_settings->'active_sessions') = 'string'
  LOOP
    BEGIN
      v_parsed := v_row.raw_value::jsonb;
      IF jsonb_typeof(v_parsed) = 'array' THEN
        UPDATE public.profiles
        SET global_settings = jsonb_set(global_settings, '{active_sessions}', v_parsed, true)
        WHERE id = v_row.id;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;
END;
$$;

-- Delegated admins may change only explicitly delegated feature keys.
CREATE OR REPLACE FUNCTION public.set_feature_flags(p_flags jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_role text;
  v_current jsonb := '{}'::jsonb;
  v_delegated jsonb := '{}'::jsonb;
  v_key text;
BEGIN
  IF jsonb_typeof(COALESCE(p_flags, '{}'::jsonb)) <> 'object' THEN
    RAISE EXCEPTION 'Feature flags must be a JSON object.';
  END IF;

  SELECT role,
         COALESCE(global_settings->'feature_flags', '{}'::jsonb),
         COALESCE(global_settings->'admin_delegated_flags', '{}'::jsonb)
  INTO v_actor_role, v_current, v_delegated
  FROM public.profiles
  WHERE id = auth.uid();

  IF v_actor_role <> 'superadmin' THEN
    IF v_actor_role <> 'admin' THEN
      RAISE EXCEPTION 'Only a superadmin or delegated admin can configure feature flags.';
    END IF;
    FOR v_key IN
      SELECT key
      FROM (
        SELECT key, value FROM jsonb_each(COALESCE(p_flags, '{}'::jsonb))
        UNION
        SELECT key, value FROM jsonb_each(v_current)
      ) keys
      GROUP BY key
      HAVING (COALESCE(p_flags, '{}'::jsonb)->key) IS DISTINCT FROM (v_current->key)
    LOOP
      IF COALESCE((v_delegated->>v_key)::boolean, false) IS NOT TRUE THEN
        RAISE EXCEPTION 'Feature flag "%" has not been delegated to admins.', v_key;
      END IF;
    END LOOP;
  END IF;

  PERFORM set_config('app.bypass_profile_security', 'true', true);
  UPDATE public.profiles
  SET global_settings = jsonb_set(
    COALESCE(global_settings, '{}'::jsonb),
    '{feature_flags}',
    COALESCE(p_flags, '{}'::jsonb),
    true
  )
  WHERE (global_settings->'feature_flags') IS DISTINCT FROM COALESCE(p_flags, '{}'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.set_supervisor_access_overrides(p_overrides jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only an admin can configure supervisor access overrides.';
  END IF;
  IF jsonb_typeof(COALESCE(p_overrides, '{}'::jsonb)) <> 'object' THEN
    RAISE EXCEPTION 'Supervisor access overrides must be a JSON object.';
  END IF;

  PERFORM set_config('app.bypass_profile_security', 'true', true);
  UPDATE public.profiles
  SET global_settings = jsonb_set(
    COALESCE(global_settings, '{}'::jsonb),
    '{supervisor_access_overrides}',
    COALESCE(p_overrides, '{}'::jsonb),
    true
  )
  WHERE global_settings->'supervisor_access_overrides'
        IS DISTINCT FROM COALESCE(p_overrides, '{}'::jsonb);
END;
$$;

-- ---------------------------------------------------------------------------
-- Detailed records and team data isolation.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Allow authenticated users to read all records" ON public.records;
DROP POLICY IF EXISTS "Scoped records read access" ON public.records;
CREATE POLICY "Scoped records read access"
ON public.records
FOR SELECT
TO authenticated
USING (
  user_id = (SELECT auth.uid())
  OR public.is_admin()
  OR (public.is_supervisor() AND public.has_leave_access((SELECT auth.uid()), user_id))
);

DROP POLICY IF EXISTS "Allow admin/supervisor to read all chuti" ON public.chuti;
DROP POLICY IF EXISTS "Scoped leave read access" ON public.chuti;
CREATE POLICY "Scoped leave read access"
ON public.chuti
FOR SELECT
TO authenticated
USING (
  user_id = (SELECT auth.uid())
  OR public.is_admin()
  OR (public.is_supervisor() AND public.has_leave_access((SELECT auth.uid()), user_id))
);

-- A normal employee may withdraw only an unapproved request. Approved leave is
-- payroll/quota history and cannot be erased through a forged REST delete.
DROP POLICY IF EXISTS "Allow users to delete their own chuti" ON public.chuti;
DROP POLICY IF EXISTS "Allow supervisors to delete chuti" ON public.chuti;
DROP POLICY IF EXISTS "Allow admins to delete chuti" ON public.chuti;
DROP POLICY IF EXISTS "Scoped leave deletion" ON public.chuti;
CREATE POLICY "Scoped leave deletion"
ON public.chuti
FOR DELETE
TO authenticated
USING (
  public.is_admin()
  OR (public.is_supervisor() AND public.has_leave_access((SELECT auth.uid()), user_id))
  OR (
    user_id = (SELECT auth.uid())
    AND status IN ('pending_supervisor', 'approved_by_supervisor', 'needs_review')
  )
);

DROP POLICY IF EXISTS "Admins/supervisors can manage settlements" ON public.leave_settlements;
DROP POLICY IF EXISTS "Users can read own settlements" ON public.leave_settlements;
DROP POLICY IF EXISTS "Users can insert own settlements" ON public.leave_settlements;
DROP POLICY IF EXISTS "Users can update own settlements" ON public.leave_settlements;
DROP POLICY IF EXISTS "Scoped settlement read access" ON public.leave_settlements;
DROP POLICY IF EXISTS "Scoped settlement management" ON public.leave_settlements;
DROP POLICY IF EXISTS "Users can submit own settlement response" ON public.leave_settlements;
DROP POLICY IF EXISTS "Users can revise own settlement response" ON public.leave_settlements;
CREATE POLICY "Scoped settlement read access"
ON public.leave_settlements
FOR SELECT
TO authenticated
USING (
  user_id = (SELECT auth.uid())
  OR public.is_admin()
  OR (public.is_supervisor() AND public.has_leave_access((SELECT auth.uid()), user_id))
);
CREATE POLICY "Scoped settlement management"
ON public.leave_settlements
FOR ALL
TO authenticated
USING (
  public.is_admin()
  OR (public.is_supervisor() AND public.has_leave_access((SELECT auth.uid()), user_id))
)
WITH CHECK (
  public.is_admin()
  OR (public.is_supervisor() AND public.has_leave_access((SELECT auth.uid()), user_id))
);

CREATE POLICY "Users can submit own settlement response"
ON public.leave_settlements
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = (SELECT auth.uid())
  AND status = 'responded'
  AND processed_by IS NULL
  AND processed_at IS NULL
);

CREATE POLICY "Users can revise own settlement response"
ON public.leave_settlements
FOR UPDATE
TO authenticated
USING (
  user_id = (SELECT auth.uid())
  AND status IN ('initiated', 'responded')
)
WITH CHECK (
  user_id = (SELECT auth.uid())
  AND status = 'responded'
  AND processed_by IS NULL
  AND processed_at IS NULL
);

CREATE OR REPLACE FUNCTION public.enforce_leave_settlement_permissions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_role text;
  v_settings jsonb;
  v_sum numeric;
BEGIN
  IF auth.role() = 'service_role'
     OR current_setting('app.bypass_settlement_security', true) = 'true' THEN
    RETURN NEW;
  END IF;

  IF NEW.year !~ '^[0-9]{4}$'
     OR NEW.period NOT IN ('H1', 'H2', 'Instant')
     OR NEW.leave_category NOT IN ('Govt Holiday', 'Eid-ul-Fitr', 'Eid-ul-Adha', 'Office Leave')
     OR NEW.action_type NOT IN ('carry_forward', 'payment', 'adjust_leave', 'split')
     OR NEW.status NOT IN ('initiated', 'responded', 'processed') THEN
    RAISE EXCEPTION 'Invalid leave settlement value.';
  END IF;

  SELECT role, COALESCE(global_settings, '{}'::jsonb)
  INTO v_actor_role, v_settings
  FROM public.profiles
  WHERE id = auth.uid();

  IF v_actor_role IN ('admin', 'superadmin') THEN
    RETURN NEW;
  END IF;
  IF v_actor_role = 'supervisor' THEN
    IF NOT public.has_leave_access(auth.uid(), NEW.user_id) THEN
      RAISE EXCEPTION 'Supervisors may only manage settlements for their assigned team.';
    END IF;
    RETURN NEW;
  END IF;
  IF v_actor_role <> 'user' OR NEW.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Users may only submit their own settlement response.';
  END IF;

  IF NEW.status <> 'responded' OR NEW.processed_by IS NOT NULL OR NEW.processed_at IS NOT NULL THEN
    RAISE EXCEPTION 'Users cannot process leave settlements.';
  END IF;
  IF NEW.action_by IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Settlement action_by must identify the authenticated user.';
  END IF;

  v_sum := COALESCE(NEW.carry_forward_days, 0)
         + COALESCE(NEW.payment_days, 0)
         + COALESCE(NEW.adjust_leave_days, 0);
  IF abs(v_sum - NEW.remaining_days) >= 0.01 THEN
    RAISE EXCEPTION 'Settlement allocations must equal the remaining leave balance.';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NOT EXISTS (
         SELECT 1
         FROM public.leave_settlements existing
         WHERE existing.id = NEW.id
           AND existing.user_id = auth.uid()
           AND existing.status IN ('initiated', 'responded')
       )
       AND (
         v_settings->>'settlement_active_year' IS DISTINCT FROM NEW.year
         OR v_settings->>'settlement_active_period' IS DISTINCT FROM NEW.period
         OR v_settings->>'settlement_active_category' IS DISTINCT FROM NEW.leave_category
       ) THEN
      RAISE EXCEPTION 'No matching settlement response window is active.';
    END IF;
  ELSE
    IF OLD.user_id IS DISTINCT FROM NEW.user_id
       OR OLD.year IS DISTINCT FROM NEW.year
       OR OLD.period IS DISTINCT FROM NEW.period
       OR OLD.leave_category IS DISTINCT FROM NEW.leave_category
       OR OLD.remaining_days IS DISTINCT FROM NEW.remaining_days
       OR OLD.created_at IS DISTINCT FROM NEW.created_at THEN
      RAISE EXCEPTION 'Settlement identity and authoritative balance are immutable.';
    END IF;
    IF OLD.status NOT IN ('initiated', 'responded') THEN
      RAISE EXCEPTION 'Processed settlements cannot be revised by users.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_leave_settlement_permissions_trigger ON public.leave_settlements;
CREATE TRIGGER enforce_leave_settlement_permissions_trigger
BEFORE INSERT OR UPDATE ON public.leave_settlements
FOR EACH ROW EXECUTE FUNCTION public.enforce_leave_settlement_permissions();

CREATE OR REPLACE FUNCTION public.enforce_chuti_write_permissions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_role text;
  v_needs_supervisor boolean;
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

  SELECT COALESCE(needs_supervisor_approval, true)
  INTO v_needs_supervisor
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
    IF NEW.reserve_adjustment_status IS DISTINCT FROM OLD.reserve_adjustment_status
       AND NEW.reserve_adjustment_status NOT IN ('none', 'pending') THEN
      RAISE EXCEPTION 'Users cannot approve or reject reserve adjustments.';
    END IF;
    IF NEW.admin_edit_status IS DISTINCT FROM OLD.admin_edit_status
       AND NEW.admin_edit_status NOT IN ('none', 'pending') THEN
      RAISE EXCEPTION 'Users cannot approve administrative edits.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_chuti_write_permissions_trigger ON public.chuti;
CREATE TRIGGER enforce_chuti_write_permissions_trigger
BEFORE INSERT OR UPDATE ON public.chuti
FOR EACH ROW EXECUTE FUNCTION public.enforce_chuti_write_permissions();

-- ---------------------------------------------------------------------------
-- Quotation mistakes: role isolation plus feature-flag-enforced writes.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.can_write_quotation_mistakes()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_entry jsonb;
  v_now timestamptz := now();
  v_flag jsonb;
BEGIN
  SELECT * INTO v_profile FROM public.profiles WHERE id = auth.uid();
  IF NOT FOUND THEN RETURN false; END IF;
  IF v_profile.role = 'superadmin' THEN RETURN true; END IF;
  IF v_profile.role NOT IN ('admin', 'supervisor') THEN RETURN false; END IF;

  FOR v_entry IN
    SELECT value
    FROM jsonb_array_elements(
      CASE WHEN jsonb_typeof(v_profile.global_settings->'temp_access') = 'array'
        THEN v_profile.global_settings->'temp_access' ELSE '[]'::jsonb END
    )
  LOOP
    IF v_entry->>'target_type' = 'user'
       AND (v_entry->>'user_id' = v_profile.id::text
            OR upper(COALESCE(v_entry->>'user_codename', '')) = upper(v_profile.username))
       AND v_entry->>'tabKey' = 'quote_mistakes_write'
       AND COALESCE(v_entry->>'expires_at', '') <> ''
       AND (v_entry->>'expires_at')::timestamptz > v_now THEN
      RETURN v_entry->>'action' = 'grant';
    END IF;
  END LOOP;

  FOR v_entry IN
    SELECT value
    FROM jsonb_array_elements(
      CASE WHEN jsonb_typeof(v_profile.global_settings->'temp_access') = 'array'
        THEN v_profile.global_settings->'temp_access' ELSE '[]'::jsonb END
    )
  LOOP
    IF COALESCE(v_entry->>'target_type', 'role') = 'role'
       AND v_entry->>'role' = v_profile.role
       AND v_entry->>'tabKey' = 'quote_mistakes_write'
       AND COALESCE(v_entry->>'expires_at', '') <> ''
       AND (v_entry->>'expires_at')::timestamptz > v_now THEN
      RETURN v_entry->>'action' = 'grant';
    END IF;
  END LOOP;

  v_flag := v_profile.global_settings->'user_feature_flags'->'quote_mistakes_write';
  IF jsonb_typeof(v_flag) = 'boolean' THEN RETURN (v_flag #>> '{}')::boolean; END IF;

  v_flag := v_profile.global_settings->'feature_flags'->'quote_mistakes_write';
  IF jsonb_typeof(v_flag) = 'boolean' THEN RETURN (v_flag #>> '{}')::boolean; END IF;

  RETURN true;
EXCEPTION WHEN invalid_datetime_format THEN
  RETURN false;
END;
$$;

DROP POLICY IF EXISTS "Allow authenticated users to read quotation mistakes" ON public.quotation_mistakes;
DROP POLICY IF EXISTS "Allow authenticated users to insert quotation mistakes" ON public.quotation_mistakes;
DROP POLICY IF EXISTS "Allow authenticated users to update quotation mistakes" ON public.quotation_mistakes;
DROP POLICY IF EXISTS "Allow authenticated users to delete quotation mistakes" ON public.quotation_mistakes;
DROP POLICY IF EXISTS "Allow admins and supervisors to insert quotation mistakes" ON public.quotation_mistakes;
DROP POLICY IF EXISTS "Allow admins and supervisors to update quotation mistakes" ON public.quotation_mistakes;
DROP POLICY IF EXISTS "Allow admins to delete quotation mistakes" ON public.quotation_mistakes;
DROP POLICY IF EXISTS "Role-scoped quotation mistake reads" ON public.quotation_mistakes;
DROP POLICY IF EXISTS "Feature-controlled quotation mistake inserts" ON public.quotation_mistakes;
DROP POLICY IF EXISTS "Feature-controlled quotation mistake updates" ON public.quotation_mistakes;
DROP POLICY IF EXISTS "Feature-controlled quotation mistake deletes" ON public.quotation_mistakes;

CREATE POLICY "Role-scoped quotation mistake reads"
ON public.quotation_mistakes
FOR SELECT
TO authenticated
USING (
  user_id = (SELECT auth.uid())
  OR public.get_my_role() IN ('admin', 'superadmin', 'supervisor')
);
CREATE POLICY "Feature-controlled quotation mistake inserts"
ON public.quotation_mistakes
FOR INSERT
TO authenticated
WITH CHECK (public.can_write_quotation_mistakes());
CREATE POLICY "Feature-controlled quotation mistake updates"
ON public.quotation_mistakes
FOR UPDATE
TO authenticated
USING (public.can_write_quotation_mistakes())
WITH CHECK (public.can_write_quotation_mistakes());
CREATE POLICY "Feature-controlled quotation mistake deletes"
ON public.quotation_mistakes
FOR DELETE
TO authenticated
USING (public.can_write_quotation_mistakes());

CREATE INDEX IF NOT EXISTS idx_quotation_mistakes_user_date
  ON public.quotation_mistakes (user_id, date DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_quotation_mistakes_branch_date
  ON public.quotation_mistakes (branch, date DESC, id DESC);

CREATE OR REPLACE FUNCTION public.enforce_quotation_mistake_metadata()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.date < DATE '2020-01-01' OR NEW.date > (current_date + 366) THEN
    RAISE EXCEPTION 'Mistake date is outside the supported range.';
  END IF;
  NEW.filename := btrim(NEW.filename);
  NEW.branch := btrim(NEW.branch);
  NEW.mistake_details := btrim(NEW.mistake_details);
  NEW.penalty := btrim(NEW.penalty);
  IF NEW.filename = '' OR length(NEW.filename) > 255
     OR NEW.branch = '' OR length(NEW.branch) > 100
     OR NEW.mistake_details = '' OR length(NEW.mistake_details) > 5000
     OR NEW.penalty = '' OR length(NEW.penalty) > 100 THEN
    RAISE EXCEPTION 'Quotation mistake fields are missing or exceed their supported length.';
  END IF;

  SELECT p.username INTO NEW.codename
  FROM public.profiles p
  WHERE p.id = NEW.user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The selected user profile does not exist.';
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.created_by := auth.uid();
    NEW.updated_by := auth.uid();
    NEW.created_at := timezone('utc', now());
    NEW.updated_at := timezone('utc', now());
  ELSE
    NEW.created_by := OLD.created_by;
    NEW.created_at := OLD.created_at;
    NEW.updated_by := auth.uid();
    NEW.updated_at := timezone('utc', now());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_quotation_mistake_metadata_trigger ON public.quotation_mistakes;
CREATE TRIGGER enforce_quotation_mistake_metadata_trigger
BEFORE INSERT OR UPDATE ON public.quotation_mistakes
FOR EACH ROW EXECUTE FUNCTION public.enforce_quotation_mistake_metadata();

-- ---------------------------------------------------------------------------
-- Government holidays: one transaction owns settings, entitlements, cleanup,
-- reserve-to-payment conversion, and excess leave reconciliation.
-- ---------------------------------------------------------------------------

ALTER TABLE public.govt_holiday_responses
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT timezone('utc', now());

CREATE INDEX IF NOT EXISTS idx_govt_holiday_responses_date_user
  ON public.govt_holiday_responses (holiday_date, user_id);
CREATE INDEX IF NOT EXISTS idx_chuti_pending_status_date
  ON public.chuti (status, date DESC)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_chuti_pending_adjustments
  ON public.chuti (reserve_adjustment_status, date DESC)
  WHERE deleted_at IS NULL AND reserve_adjustment_status = 'pending';

CREATE OR REPLACE FUNCTION public.set_govt_holiday_response_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at := timezone('utc', now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS govt_holiday_response_set_updated_at ON public.govt_holiday_responses;
CREATE TRIGGER govt_holiday_response_set_updated_at
BEFORE UPDATE ON public.govt_holiday_responses
FOR EACH ROW EXECUTE FUNCTION public.set_govt_holiday_response_updated_at();

CREATE OR REPLACE FUNCTION public.reconcile_govt_holiday_adjustments(
  p_user_id uuid,
  p_year integer
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_reserved integer;
  v_changed integer;
BEGIN
  SELECT count(*)::integer INTO v_reserved
  FROM public.govt_holiday_responses
  WHERE user_id = p_user_id
    AND response = 'reserve'
    AND holiday_date >= make_date(p_year, 1, 1)
    AND holiday_date < make_date(p_year + 1, 1, 1);

  WITH excess AS (
    SELECT c.id
    FROM public.chuti c
    WHERE c.user_id = p_user_id
      AND c.leave_type = 'Full Leave'
      AND c.adjustment IS TRUE
      AND c.date >= make_date(p_year, 1, 1)
      AND c.date < make_date(p_year + 1, 1, 1)
      AND c.deleted_at IS NULL
      AND (c.reserve_holiday = 'Govt Holiday' OR c.comment ILIKE '%Govt Holiday%')
    ORDER BY c.date ASC, c.created_at ASC
    OFFSET v_reserved
  )
  UPDATE public.chuti c
  SET adjustment = false,
      reserve_holiday = NULL,
      comment = NULLIF(
        btrim(regexp_replace(COALESCE(c.comment, ''), '^Adjusted:\s*Govt Holiday(?:\s*\|\s*)?', '', 'i')),
        ''
      )
  WHERE c.id IN (SELECT id FROM excess);

  GET DIAGNOSTICS v_changed = ROW_COUNT;
  RETURN v_changed;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_global_leave_settings(p_settings jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_old_settings jsonb := '{}'::jsonb;
  v_old_holidays jsonb := '[]'::jsonb;
  v_canonical_holidays jsonb := '[]'::jsonb;
  v_leave_settings jsonb;
  v_item jsonb;
  v_date_text text;
  v_date date;
  v_name text;
  v_created_at text;
  v_old_dates date[] := ARRAY[]::date[];
  v_new_dates date[] := ARRAY[]::date[];
  v_removed_date date;
  v_target_user uuid;
  v_target_year integer;
  v_mode text;
  v_h1 numeric;
  v_h2 numeric;
  v_default numeric;
  v_eid_fitr numeric;
  v_eid_adha numeric;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can change global leave settings.';
  END IF;
  IF jsonb_typeof(p_settings) <> 'object' THEN
    RAISE EXCEPTION 'Leave settings must be a JSON object.';
  END IF;

  SELECT COALESCE(global_settings, '{}'::jsonb)
  INTO v_old_settings
  FROM public.profiles
  WHERE role IN ('superadmin', 'admin')
  ORDER BY CASE WHEN role = 'superadmin' THEN 0 ELSE 1 END, created_at
  LIMIT 1
  FOR UPDATE;

  v_old_holidays := CASE WHEN jsonb_typeof(v_old_settings->'govt_holidays') = 'array'
    THEN v_old_settings->'govt_holidays' ELSE '[]'::jsonb END;

  SELECT COALESCE(array_agg(DISTINCT holiday_date), ARRAY[]::date[])
  INTO v_old_dates
  FROM (
    SELECT CASE
      WHEN jsonb_typeof(value) = 'object' THEN (value->>'date')::date
      ELSE trim(both '"' from value::text)::date
    END AS holiday_date
    FROM jsonb_array_elements(v_old_holidays)
  ) old_items;

  IF jsonb_typeof(COALESCE(p_settings->'govt_holidays', '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'govt_holidays must be an array.';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(COALESCE(p_settings->'govt_holidays', '[]'::jsonb))
  LOOP
    v_date_text := CASE WHEN jsonb_typeof(v_item) = 'object'
      THEN btrim(v_item->>'date')
      ELSE trim(both '"' from v_item::text)
    END;
    BEGIN
      v_date := v_date_text::date;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Invalid government holiday date: %', v_date_text;
    END;

    IF v_date = ANY(v_new_dates) THEN
      RAISE EXCEPTION 'Duplicate government holiday date: %', v_date;
    END IF;

    v_name := CASE WHEN jsonb_typeof(v_item) = 'object'
      THEN btrim(COALESCE(v_item->>'name', ''))
      ELSE ''
    END;
    IF v_name = '' THEN
      RAISE EXCEPTION 'A government holiday name is required for %.', v_date;
    END IF;

    v_created_at := CASE WHEN jsonb_typeof(v_item) = 'object'
      THEN COALESCE(NULLIF(v_item->>'created_at', ''), timezone('utc', now())::text)
      ELSE timezone('utc', now())::text
    END;
    v_new_dates := array_append(v_new_dates, v_date);
    v_canonical_holidays := v_canonical_holidays || jsonb_build_array(
      jsonb_build_object('date', v_date::text, 'name', v_name, 'created_at', v_created_at)
    );
  END LOOP;

  v_mode := COALESCE(NULLIF(p_settings->>'office_leave_mode', ''), 'split');
  IF v_mode NOT IN ('split', 'merged') THEN RAISE EXCEPTION 'Invalid office leave mode.'; END IF;
  v_h1 := COALESCE((p_settings->>'office_leave_h1')::numeric, 7);
  v_h2 := COALESCE((p_settings->>'office_leave_h2')::numeric, 7);
  v_default := COALESCE((p_settings->>'office_leave_default')::numeric, v_h1 + v_h2);
  v_eid_fitr := COALESCE((p_settings->>'eid_fitr_leave')::numeric, 0);
  v_eid_adha := COALESCE((p_settings->>'eid_adha_leave')::numeric, 0);
  IF v_h1 < 0 OR v_h2 < 0 OR v_default < 0 OR v_eid_fitr < 0 OR v_eid_adha < 0
     OR v_h1 > 366 OR v_h2 > 366 OR v_default > 366 OR v_eid_fitr > 366 OR v_eid_adha > 366 THEN
    RAISE EXCEPTION 'Leave quotas must be between 0 and 366.';
  END IF;

  IF COALESCE(p_settings->>'settlement_active_period', '') NOT IN ('', 'H1', 'H2', 'Instant') THEN
    RAISE EXCEPTION 'Invalid settlement period.';
  END IF;
  IF COALESCE(p_settings->>'settlement_active_category', '') NOT IN ('', 'Office Leave', 'Govt Holiday', 'Eid-ul-Fitr', 'Eid-ul-Adha') THEN
    RAISE EXCEPTION 'Invalid settlement category.';
  END IF;
  IF COALESCE(p_settings->>'settlement_active_year', '') <> ''
     AND p_settings->>'settlement_active_year' !~ '^20[0-9]{2}$' THEN
    RAISE EXCEPTION 'Invalid settlement year.';
  END IF;

  v_leave_settings := jsonb_build_object(
    'office_leave_mode', v_mode,
    'office_leave_h1', v_h1,
    'office_leave_h2', v_h2,
    'office_leave_split_h1', COALESCE((p_settings->>'office_leave_split_h1')::numeric, v_h1),
    'office_leave_split_h2', COALESCE((p_settings->>'office_leave_split_h2')::numeric, v_h2),
    'office_leave_default', v_default,
    'eid_fitr_leave', v_eid_fitr,
    'eid_adha_leave', v_eid_adha,
    'govt_holidays', v_canonical_holidays,
    'settlement_active_year', p_settings->'settlement_active_year',
    'settlement_active_period', p_settings->'settlement_active_period',
    'settlement_active_category', p_settings->'settlement_active_category'
  );

  PERFORM set_config('app.bypass_profile_security', 'true', true);
  UPDATE public.profiles
  SET global_settings = COALESCE(global_settings, '{}'::jsonb) || v_leave_settings
  WHERE (COALESCE(global_settings, '{}'::jsonb) || v_leave_settings) IS DISTINCT FROM global_settings;

  -- Delete removed entitlements and reconcile only the affected user/year pairs.
  FOR v_removed_date IN
    SELECT unnest(v_old_dates)
    EXCEPT
    SELECT unnest(v_new_dates)
  LOOP
    FOR v_target_user, v_target_year IN
      SELECT DISTINCT user_id, extract(year FROM holiday_date)::integer
      FROM public.govt_holiday_responses
      WHERE holiday_date = v_removed_date
    LOOP
      DELETE FROM public.govt_holiday_responses
      WHERE user_id = v_target_user AND holiday_date = v_removed_date;
      PERFORM public.reconcile_govt_holiday_adjustments(v_target_user, v_target_year);
    END LOOP;
  END LOOP;

  -- Every eligible user receives an explicit entitlement: reserve when enabled,
  -- otherwise payment. Existing admin conversions are preserved when unrelated
  -- leave settings are saved; only a profile eligibility/preference change may
  -- intentionally recompute them.
  INSERT INTO public.govt_holiday_responses (
    user_id, holiday_date, holiday_name, response, updated_by_admin
  )
  SELECT p.id,
         (h.value->>'date')::date,
         h.value->>'name',
         CASE WHEN p.allow_reserve IS TRUE THEN 'reserve' ELSE 'paid' END,
         true
  FROM public.profiles p
  CROSS JOIN LATERAL jsonb_array_elements(v_canonical_holidays) h(value)
  WHERE p.eligible_govt_holiday IS DISTINCT FROM false
  ON CONFLICT (user_id, holiday_date) DO UPDATE
  SET holiday_name = EXCLUDED.holiday_name
  WHERE public.govt_holiday_responses.holiday_name IS DISTINCT FROM EXCLUDED.holiday_name;

  INSERT INTO public.audit_logs (
    actor_id, actor_codename, action_type, details, metadata
  )
  SELECT auth.uid(), p.username, 'ADJUST_LEAVE', 'Global leave settings changed',
         jsonb_build_object(
           'added_holiday_dates', ARRAY(SELECT unnest(v_new_dates) EXCEPT SELECT unnest(v_old_dates)),
           'removed_holiday_dates', ARRAY(SELECT unnest(v_old_dates) EXCEPT SELECT unnest(v_new_dates))
         )
  FROM public.profiles p
  WHERE p.id = auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION public.convert_govt_holiday_response(
  p_user_id uuid,
  p_holiday_date date,
  p_response text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_holiday_name text;
  v_settings jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can convert government holiday entitlements.';
  END IF;
  IF p_response NOT IN ('reserve', 'paid') THEN
    RAISE EXCEPTION 'Invalid government holiday response.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_user_id AND eligible_govt_holiday IS DISTINCT FROM false
  ) THEN
    RAISE EXCEPTION 'Target user is not eligible for government holidays.';
  END IF;

  SELECT COALESCE(global_settings, '{}'::jsonb) INTO v_settings
  FROM public.profiles
  WHERE role IN ('superadmin', 'admin')
  ORDER BY CASE WHEN role = 'superadmin' THEN 0 ELSE 1 END, created_at
  LIMIT 1;

  SELECT value->>'name' INTO v_holiday_name
  FROM jsonb_array_elements(
    CASE WHEN jsonb_typeof(v_settings->'govt_holidays') = 'array'
      THEN v_settings->'govt_holidays' ELSE '[]'::jsonb END
  )
  WHERE (value->>'date')::date = p_holiday_date
  LIMIT 1;

  IF v_holiday_name IS NULL OR btrim(v_holiday_name) = '' THEN
    RAISE EXCEPTION 'Government holiday is not active.';
  END IF;

  INSERT INTO public.govt_holiday_responses (
    user_id, holiday_date, holiday_name, response, updated_by_admin
  ) VALUES (
    p_user_id, p_holiday_date, v_holiday_name, p_response, true
  )
  ON CONFLICT (user_id, holiday_date) DO UPDATE
  SET holiday_name = EXCLUDED.holiday_name,
      response = EXCLUDED.response,
      updated_by_admin = true
  WHERE public.govt_holiday_responses.holiday_name IS DISTINCT FROM EXCLUDED.holiday_name
     OR public.govt_holiday_responses.response IS DISTINCT FROM EXCLUDED.response
     OR public.govt_holiday_responses.updated_by_admin IS DISTINCT FROM true;

  IF p_response = 'paid' THEN
    PERFORM public.reconcile_govt_holiday_adjustments(p_user_id, extract(year FROM p_holiday_date)::integer);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_profile_govt_holiday_entitlements()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_settings jsonb;
  v_year integer;
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.allow_reserve IS NOT DISTINCT FROM OLD.allow_reserve
     AND NEW.eligible_govt_holiday IS NOT DISTINCT FROM OLD.eligible_govt_holiday THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(global_settings, '{}'::jsonb) INTO v_settings
  FROM public.profiles
  WHERE role IN ('superadmin', 'admin') AND id <> NEW.id
  ORDER BY CASE WHEN role = 'superadmin' THEN 0 ELSE 1 END, created_at
  LIMIT 1;
  v_settings := COALESCE(v_settings, NEW.global_settings, '{}'::jsonb);

  IF NEW.eligible_govt_holiday IS FALSE THEN
    FOR v_year IN
      SELECT DISTINCT extract(year FROM holiday_date)::integer
      FROM public.govt_holiday_responses
      WHERE user_id = NEW.id
    LOOP
      DELETE FROM public.govt_holiday_responses WHERE user_id = NEW.id;
      PERFORM public.reconcile_govt_holiday_adjustments(NEW.id, v_year);
    END LOOP;
    RETURN NEW;
  END IF;

  INSERT INTO public.govt_holiday_responses (
    user_id, holiday_date, holiday_name, response, updated_by_admin
  )
  SELECT NEW.id,
         (h.value->>'date')::date,
         h.value->>'name',
         CASE WHEN NEW.allow_reserve IS TRUE THEN 'reserve' ELSE 'paid' END,
         true
  FROM jsonb_array_elements(
    CASE WHEN jsonb_typeof(v_settings->'govt_holidays') = 'array'
      THEN v_settings->'govt_holidays' ELSE '[]'::jsonb END
  ) h(value)
  ON CONFLICT (user_id, holiday_date) DO UPDATE
  SET holiday_name = EXCLUDED.holiday_name,
      response = EXCLUDED.response,
      updated_by_admin = true
  WHERE public.govt_holiday_responses.holiday_name IS DISTINCT FROM EXCLUDED.holiday_name
     OR public.govt_holiday_responses.response IS DISTINCT FROM EXCLUDED.response;

  DELETE FROM public.govt_holiday_responses r
  WHERE r.user_id = NEW.id
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(
        CASE WHEN jsonb_typeof(v_settings->'govt_holidays') = 'array'
          THEN v_settings->'govt_holidays' ELSE '[]'::jsonb END
      ) h(value)
      WHERE (h.value->>'date')::date = r.holiday_date
    );

  IF NEW.allow_reserve IS NOT TRUE THEN
    FOR v_year IN
      SELECT DISTINCT extract(year FROM date_value)::integer
      FROM (
        SELECT (h.value->>'date')::date AS date_value
        FROM jsonb_array_elements(
          CASE WHEN jsonb_typeof(v_settings->'govt_holidays') = 'array'
            THEN v_settings->'govt_holidays' ELSE '[]'::jsonb END
        ) h(value)
      ) years
    LOOP
      PERFORM public.reconcile_govt_holiday_adjustments(NEW.id, v_year);
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_profile_govt_holiday_entitlements_trigger ON public.profiles;
CREATE TRIGGER sync_profile_govt_holiday_entitlements_trigger
AFTER INSERT OR UPDATE OF allow_reserve, eligible_govt_holiday ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.sync_profile_govt_holiday_entitlements();

-- There is no user choice dialog: users can read their entitlement, while only
-- the transactional admin RPC can change it.
DROP POLICY IF EXISTS "Users can insert own holiday responses" ON public.govt_holiday_responses;
DROP POLICY IF EXISTS "Users can update own holiday responses" ON public.govt_holiday_responses;
REVOKE INSERT, UPDATE, DELETE ON public.govt_holiday_responses FROM anon, authenticated;
GRANT SELECT ON public.govt_holiday_responses TO authenticated;
GRANT ALL ON public.govt_holiday_responses TO service_role;

-- Short-leave conversion used to be three client-side operations (N date
-- probes, a leave insert, and a profile update). Compute the entitlement from
-- authoritative rows and commit the conversion atomically instead.
CREATE OR REPLACE FUNCTION public.convert_short_leave_to_full_leave(
  p_user_id uuid,
  p_adjust_category text DEFAULT 'Office Leave'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_role text;
  v_working_hours numeric;
  v_converted_hours numeric;
  v_converted_days integer;
  v_raw_short_minutes numeric;
  v_net_short_minutes numeric;
  v_minutes_per_day numeric;
  v_days integer;
  v_hours numeric;
  v_inserted integer;
  v_reserved integer;
  v_used_reserved integer;
BEGIN
  SELECT role INTO v_actor_role FROM public.profiles WHERE id = auth.uid();
  IF p_user_id <> auth.uid()
     AND NOT public.is_admin()
     AND NOT (v_actor_role = 'supervisor' AND public.has_leave_access(auth.uid(), p_user_id)) THEN
    RAISE EXCEPTION 'Permission denied for target user.';
  END IF;
  IF p_adjust_category NOT IN ('Office Leave', 'Govt Holiday') THEN
    RAISE EXCEPTION 'Invalid adjustment category.';
  END IF;

  -- Serializes concurrent conversion attempts for the same profile.
  SELECT COALESCE(working_hours, 9.5),
         COALESCE(converted_short_leaves_hours, 0),
         COALESCE(converted_short_leaves_days, 0)
  INTO v_working_hours, v_converted_hours, v_converted_days
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Target user not found.'; END IF;
  IF v_working_hours <= 0 OR v_working_hours > 24 THEN
    RAISE EXCEPTION 'Target user has invalid working hours.';
  END IF;

  SELECT COALESCE(sum(
    CASE
      WHEN c.leave_type = 'Short Leave' AND c.adjustment IS NOT TRUE THEN
        CASE WHEN extract(epoch FROM c.leave_hour) < 0 THEN -1 ELSE 1 END
        * greatest(
            abs(extract(epoch FROM c.leave_hour))
            - COALESCE(abs(extract(epoch FROM c.adjusted_hour)), 0),
            0
          ) / 60
      WHEN c.leave_type = 'Overtime' AND c.adjust_short_leave IS TRUE AND c.adjustment IS TRUE THEN
        -extract(epoch FROM c.leave_hour) / 60
      WHEN c.leave_type = 'Overtime' AND c.adjust_short_leave IS TRUE AND c.adjusted_hour IS NOT NULL THEN
        -extract(epoch FROM c.adjusted_hour) / 60
      ELSE 0
    END
  ), 0)
  INTO v_raw_short_minutes
  FROM public.chuti c
  WHERE c.user_id = p_user_id
    AND c.status = 'approved'
    AND c.deleted_at IS NULL;

  v_net_short_minutes := greatest(0, v_raw_short_minutes - (v_converted_hours * 60));
  v_minutes_per_day := v_working_hours * 60;
  v_days := floor(v_net_short_minutes / v_minutes_per_day)::integer;
  IF v_days < 1 THEN
    RAISE EXCEPTION 'There are not enough unconverted short-leave hours.';
  END IF;
  v_hours := v_days * v_working_hours;

  IF p_adjust_category = 'Govt Holiday' THEN
    SELECT count(*)::integer INTO v_reserved
    FROM public.govt_holiday_responses
    WHERE user_id = p_user_id AND response = 'reserve';

    SELECT count(*)::integer INTO v_used_reserved
    FROM public.chuti
    WHERE user_id = p_user_id
      AND status = 'approved'
      AND deleted_at IS NULL
      AND leave_type = 'Full Leave'
      AND adjustment IS TRUE
      AND (reserve_holiday = 'Govt Holiday' OR comment ILIKE '%Govt Holiday%');

    IF v_reserved - v_used_reserved < v_days THEN
      RAISE EXCEPTION 'Not enough unused reserved government holidays for this conversion.';
    END IF;
  END IF;

  PERFORM set_config('app.bypass_chuti_security', 'true', true);
  WITH free_dates AS (
    SELECT (current_date - offset_days)::date AS leave_date
    FROM generate_series(0, 3650) AS offset_days
    WHERE NOT EXISTS (
      SELECT 1 FROM public.chuti existing
      WHERE existing.user_id = p_user_id
        AND existing.date = (current_date - offset_days)::date
        AND existing.deleted_at IS NULL
    )
    ORDER BY offset_days
    LIMIT v_days
  )
  INSERT INTO public.chuti (
    user_id, date, leave_type, adjustment, status, comment, reserve_holiday
  )
  SELECT p_user_id,
         leave_date,
         'Full Leave',
         true,
         'approved',
         'Adjusted: ' || p_adjust_category || ' | Converted from Short Leave',
         p_adjust_category
  FROM free_dates;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  IF v_inserted <> v_days THEN
    RAISE EXCEPTION 'Unable to allocate enough free leave dates.';
  END IF;

  PERFORM set_config('app.bypass_profile_security', 'true', true);
  UPDATE public.profiles
  SET converted_short_leaves_days = v_converted_days + v_days,
      converted_short_leaves_hours = v_converted_hours + v_hours
  WHERE id = p_user_id;

  RETURN jsonb_build_object('days_converted', v_days, 'hours_converted', v_hours);
END;
$$;

-- ---------------------------------------------------------------------------
-- Egress and badge maintenance.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_available_record_months(
  p_user_id uuid DEFAULT NULL,
  p_tz text DEFAULT 'Asia/Dhaka'
)
RETURNS TABLE(year text, month text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;
  IF p_user_id IS NOT NULL
     AND p_user_id <> auth.uid()
     AND NOT public.is_admin()
     AND NOT (public.is_supervisor() AND public.has_leave_access(auth.uid(), p_user_id)) THEN
    RAISE EXCEPTION 'Permission denied for target user.';
  END IF;

  RETURN QUERY
  SELECT to_char(date_trunc('month', r.submitted_at AT TIME ZONE p_tz), 'YYYY'),
         to_char(date_trunc('month', r.submitted_at AT TIME ZONE p_tz), 'MM')
  FROM public.records r
  WHERE p_user_id IS NULL OR r.user_id = p_user_id
  GROUP BY date_trunc('month', r.submitted_at AT TIME ZONE p_tz)
  ORDER BY date_trunc('month', r.submitted_at AT TIME ZONE p_tz);
END;
$$;

DROP FUNCTION IF EXISTS public.is_user_in_top_5_for_month(uuid, integer, integer);

CREATE OR REPLACE FUNCTION public.sync_top_performer_badges()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_prev_month date := (date_trunc('month', current_date) - interval '1 month')::date;
  v_current_year integer := extract(year FROM current_date)::integer;
  v_user record;
  v_consecutive integer;
  v_yearly_wins integer;
  v_badge jsonb;
BEGIN
  IF session_user NOT IN ('postgres', 'supabase_admin') AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Badge synchronization is a scheduled system operation.';
  END IF;

  PERFORM set_config('app.bypass_profile_security', 'true', true);

  CREATE TEMP TABLE tmp_monthly_ranks ON COMMIT DROP AS
  WITH monthly_counts AS (
    SELECT r.user_id,
           date_trunc('month', r.submitted_at AT TIME ZONE 'Asia/Dhaka')::date AS month_start,
           count(*) AS record_count,
           p.username
    FROM public.records r
    JOIN public.profiles p ON p.id = r.user_id
    WHERE r.submitted_at >= ((v_prev_month - interval '24 months')::timestamp AT TIME ZONE 'Asia/Dhaka')
      AND r.submitted_at < ((v_prev_month + interval '1 month')::timestamp AT TIME ZONE 'Asia/Dhaka')
    GROUP BY r.user_id, date_trunc('month', r.submitted_at AT TIME ZONE 'Asia/Dhaka')::date, p.username
  )
  SELECT user_id,
         month_start,
         row_number() OVER (PARTITION BY month_start ORDER BY record_count DESC, upper(username), user_id) AS rank
  FROM monthly_counts;

  UPDATE public.profiles p
  SET global_settings = COALESCE(p.global_settings, '{}'::jsonb) - 'top_performer_badge'
  WHERE p.global_settings ? 'top_performer_badge'
    AND NOT EXISTS (
      SELECT 1 FROM tmp_monthly_ranks r
      WHERE r.user_id = p.id AND r.month_start = v_prev_month AND r.rank <= 5
    );

  FOR v_user IN
    SELECT user_id, rank
    FROM tmp_monthly_ranks
    WHERE month_start = v_prev_month AND rank <= 5
    ORDER BY rank
  LOOP
    SELECT COALESCE(min(offset_value), 25)
    INTO v_consecutive
    FROM generate_series(0, 24) offset_value
    WHERE NOT EXISTS (
      SELECT 1 FROM tmp_monthly_ranks r
      WHERE r.user_id = v_user.user_id
        AND r.month_start = (v_prev_month - (offset_value || ' months')::interval)::date
        AND r.rank <= 5
    );

    SELECT count(DISTINCT month_start)::integer INTO v_yearly_wins
    FROM tmp_monthly_ranks
    WHERE user_id = v_user.user_id
      AND rank <= 5
      AND extract(year FROM month_start)::integer = v_current_year;

    v_badge := jsonb_build_object(
      'userId', v_user.user_id,
      'rank', v_user.rank,
      'badgeType', CASE WHEN v_user.rank <= 3 THEN 'blue' ELSE 'grey' END,
      'monthName', to_char(v_prev_month, 'FMMonth'),
      'consecutiveMonths', v_consecutive,
      'yearlyTopPerformances', v_yearly_wins
    );

    UPDATE public.profiles
    SET global_settings = COALESCE(global_settings, '{}'::jsonb) || jsonb_build_object('top_performer_badge', v_badge)
    WHERE id = v_user.user_id
      AND global_settings->'top_performer_badge' IS DISTINCT FROM v_badge;
  END LOOP;
END;
$$;

DO $$
DECLARE
  v_job_id bigint;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-audit-logs-cleanup') THEN
      PERFORM cron.schedule(
        'daily-audit-logs-cleanup',
        '0 0 * * *',
        'SELECT public.cleanup_old_audit_logs();'
      );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'archive-prune-old-records') THEN
      PERFORM cron.schedule(
        'archive-prune-old-records',
        '17 3 2 1 *',
        'SELECT public.archive_and_prune_old_records(''Asia/Dhaka'');'
      );
    END IF;
    FOR v_job_id IN SELECT jobid FROM cron.job WHERE jobname = 'sync-top-performer-badges'
    LOOP
      PERFORM cron.unschedule(v_job_id);
    END LOOP;
    PERFORM cron.schedule(
      'sync-top-performer-badges',
      '15 0 1 * *',
      'SELECT public.sync_top_performer_badges();'
    );
  END IF;
END;
$$;

DROP FUNCTION IF EXISTS public.get_system_health_metrics();

-- ---------------------------------------------------------------------------
-- Existing and future SECURITY DEFINER privilege hygiene.
-- ---------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.admin_update_user_credentials(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_user_by_id(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_new_user(text, text, text, text, text, boolean, boolean, boolean, uuid[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_configured_user(text, text, text, text, text, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_insert_chuti_records_bulk(uuid, date[], text, boolean[], boolean, time, time, interval, text, text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_global_settings_key(uuid, text, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.register_active_session(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.request_password_reset(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_profile_setup(text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.change_default_password(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.complete_leave_profile_setup(text, numeric, integer, text, time, time) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.resolve_password_reset(uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_feature_flags(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_supervisor_access_overrides(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.save_global_leave_settings(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.convert_govt_holiday_response(uuid, date, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.convert_short_leave_to_full_leave(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_available_record_months(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_write_quotation_mistakes() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_read_profile(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sync_top_performer_badges() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reconcile_govt_holiday_adjustments(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.audit_business_row_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_chuti_write_permissions() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_leave_settlement_permissions() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_quotation_mistake_metadata() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_profile_govt_holiday_entitlements() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_govt_holiday_response_updated_at() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.admin_update_user_credentials(uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_user_by_id(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_new_user(text, text, text, text, text, boolean, boolean, boolean, uuid[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_configured_user(text, text, text, text, text, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_insert_chuti_records_bulk(uuid, date[], text, boolean[], boolean, time, time, interval, text, text, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_global_settings_key(uuid, text, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.register_active_session(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.request_password_reset(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_profile_setup(text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.change_default_password(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.complete_leave_profile_setup(text, numeric, integer, text, time, time) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.resolve_password_reset(uuid, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_feature_flags(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_supervisor_access_overrides(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.save_global_leave_settings(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.convert_govt_holiday_response(uuid, date, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.convert_short_leave_to_full_leave(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_available_record_months(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_write_quotation_mistakes() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_read_profile(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sync_top_performer_badges() TO service_role;

REVOKE ALL ON FUNCTION public.check_profile_updates() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.check_profile_role_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_chuti_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_records_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_todos_last_activity() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_compliance_rules_updated_at() FROM PUBLIC, anon, authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon;
