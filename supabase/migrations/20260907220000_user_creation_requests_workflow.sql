-- Migration: 20260907220000_user_creation_requests_workflow.sql
-- Description: Table, RLS policies, indexes, and RPCs for supervisor-initiated user account creation requests and admin approval/review workflow.

-- 1. Create table for user creation requests
CREATE TABLE IF NOT EXISTS public.user_creation_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  requester_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  requester_role text NOT NULL,
  status text DEFAULT 'pending_admin_approval' NOT NULL 
    CHECK (status IN ('pending_admin_approval', 'needs_review', 'approved', 'rejected')),
  submitted_data jsonb NOT NULL,
  review_notes text,
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  version integer DEFAULT 1 NOT NULL,
  history jsonb DEFAULT '[]'::jsonb NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- 2. Indexes for fast filtering and lookup
CREATE INDEX IF NOT EXISTS idx_user_creation_requests_requester 
  ON public.user_creation_requests (requester_id);

CREATE INDEX IF NOT EXISTS idx_user_creation_requests_status 
  ON public.user_creation_requests (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_creation_requests_created_user 
  ON public.user_creation_requests (created_user_id) 
  WHERE created_user_id IS NOT NULL;

-- Prevent duplicate pending or in-review requests for the same codename
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_creation_requests_pending_codename 
  ON public.user_creation_requests ((lower(btrim(submitted_data->>'codename')))) 
  WHERE (status IN ('pending_admin_approval', 'needs_review'));

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.user_creation_requests ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
DROP POLICY IF EXISTS "user_creation_requests_select" ON public.user_creation_requests;
CREATE POLICY "user_creation_requests_select" ON public.user_creation_requests
  FOR SELECT TO authenticated
  USING (
    public.is_admin() 
    OR requester_id = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS "user_creation_requests_insert" ON public.user_creation_requests;
CREATE POLICY "user_creation_requests_insert" ON public.user_creation_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    requester_id = (SELECT auth.uid())
    AND (
      public.is_admin()
      OR (SELECT role FROM public.profiles WHERE id = (SELECT auth.uid())) = 'supervisor'
    )
  );

DROP POLICY IF EXISTS "user_creation_requests_update" ON public.user_creation_requests;
CREATE POLICY "user_creation_requests_update" ON public.user_creation_requests
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR (
      requester_id = (SELECT auth.uid()) 
      AND status = 'needs_review'
    )
  )
  WITH CHECK (
    public.is_admin()
    OR (
      requester_id = (SELECT auth.uid()) 
      AND status = 'pending_admin_approval'
    )
  );

DROP POLICY IF EXISTS "user_creation_requests_delete" ON public.user_creation_requests;
CREATE POLICY "user_creation_requests_delete" ON public.user_creation_requests
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- 5. Updated_at Trigger
CREATE OR REPLACE FUNCTION public.update_user_creation_requests_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_creation_requests_updated_at ON public.user_creation_requests;
CREATE TRIGGER trg_user_creation_requests_updated_at
  BEFORE UPDATE ON public.user_creation_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_user_creation_requests_updated_at();

-- 6. Add to Realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'user_creation_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_creation_requests;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    NULL; -- Publication might not exist or already contain table
END;
$$;

-- 7. Workflow RPC: submit_user_creation_request
CREATE OR REPLACE FUNCTION public.submit_user_creation_request(p_data jsonb)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_caller_role text;
  v_caller_name text;
  v_codename text;
  v_full_name text;
  v_request_id uuid;
  v_has_quotes boolean;
  v_sanitized_data jsonb;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated.';
  END IF;

  SELECT role, COALESCE(username, full_name, 'Supervisor')
  INTO v_caller_role, v_caller_name
  FROM public.profiles
  WHERE id = v_caller_id;

  IF v_caller_role <> 'supervisor' AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only supervisors can submit user creation requests.';
  END IF;

  IF jsonb_typeof(p_data) <> 'object' THEN
    RAISE EXCEPTION 'Submitted data must be a JSON object.';
  END IF;

  v_codename := upper(btrim(p_data->>'codename'));
  v_full_name := btrim(COALESCE(p_data->>'fullName', p_data->>'full_name', ''));
  v_has_quotes := COALESCE((p_data->>'hasQuotesAccess')::boolean, (p_data->>'has_quotes_access')::boolean, false);

  IF length(v_codename) < 3 THEN
    RAISE EXCEPTION 'Codename must be at least 3 characters long.';
  END IF;

  IF NOT (v_codename ~ '^[A-Z0-9_-]+$') THEN
    RAISE EXCEPTION 'Codename can only contain letters, numbers, hyphens, and underscores.';
  END IF;

  -- Role restriction: Supervisors can ONLY request 'user' role
  IF COALESCE(p_data->>'role', 'user') <> 'user' THEN
    RAISE EXCEPTION 'Supervisors can only request user accounts with user role.';
  END IF;

  -- Quotes Workspace is required for supervisor creation
  IF NOT v_has_quotes THEN
    RAISE EXCEPTION 'Quotes Manager Workspace access is required for supervisor-created accounts.';
  END IF;

  -- Check if user already exists in active profiles
  IF EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE upper(btrim(username)) = v_codename
  ) THEN
    RAISE EXCEPTION 'A user with codename "%" already exists in active profiles.', v_codename;
  END IF;

  -- Sanitize and ensure role is 'user', codename is uppercase
  v_sanitized_data := p_data || jsonb_build_object(
    'role', 'user',
    'codename', v_codename,
    'fullName', v_full_name,
    'full_name', v_full_name,
    'hasQuotesAccess', true,
    'has_quotes_access', true,
    'hasChutiAccess', true,
    'has_chuti_access', true
  );

  INSERT INTO public.user_creation_requests (
    requester_id,
    requester_role,
    status,
    submitted_data,
    version,
    history
  ) VALUES (
    v_caller_id,
    v_caller_role,
    'pending_admin_approval',
    v_sanitized_data,
    1,
    jsonb_build_array(
      jsonb_build_object(
        'action', 'submitted',
        'actor_id', v_caller_id,
        'actor_name', v_caller_name,
        'timestamp', now(),
        'version', 1
      )
    )
  )
  RETURNING id INTO v_request_id;

  -- Audit log entry
  INSERT INTO public.audit_logs (
    actor_id,
    actor_codename,
    action_type,
    target_id,
    details,
    metadata
  ) VALUES (
    v_caller_id,
    v_caller_name,
    'SUBMIT_USER_CREATION_REQUEST',
    v_request_id::text,
    'Supervisor submitted user creation request for ' || v_codename,
    jsonb_build_object('codename', v_codename, 'role', 'user', 'requester_role', v_caller_role)
  );

  RETURN v_request_id;
END;
$$;

-- 8. Workflow RPC: review_user_creation_request
CREATE OR REPLACE FUNCTION public.review_user_creation_request(
  p_request_id uuid,
  p_notes text,
  p_expected_version integer DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $$
DECLARE
  v_admin_id uuid := auth.uid();
  v_admin_name text;
  v_req record;
  v_clean_notes text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only administrators can review user creation requests.';
  END IF;

  v_clean_notes := btrim(COALESCE(p_notes, ''));
  IF v_clean_notes = '' THEN
    RAISE EXCEPTION 'Review notes are required when sending request back for review.';
  END IF;

  SELECT role, COALESCE(username, full_name, 'Admin')
  INTO v_admin_name, v_admin_name
  FROM public.profiles
  WHERE id = v_admin_id;

  SELECT * INTO v_req 
  FROM public.user_creation_requests 
  WHERE id = p_request_id 
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User creation request % not found.', p_request_id;
  END IF;

  IF v_req.status <> 'pending_admin_approval' THEN
    RAISE EXCEPTION 'Only requests in pending_admin_approval status can be reviewed. Current status: %', v_req.status;
  END IF;

  -- Optimistic concurrency check
  IF p_expected_version IS NOT NULL AND v_req.version <> p_expected_version THEN
    RAISE EXCEPTION 'Concurrency conflict: Request version (%) does not match expected version (%). Please refresh.', v_req.version, p_expected_version;
  END IF;

  UPDATE public.user_creation_requests
  SET status = 'needs_review',
      review_notes = v_clean_notes,
      reviewed_by = v_admin_id,
      reviewed_at = now(),
      history = history || jsonb_build_array(
        jsonb_build_object(
          'action', 'reviewed',
          'actor_id', v_admin_id,
          'actor_name', v_admin_name,
          'notes', v_clean_notes,
          'timestamp', now(),
          'version', v_req.version
        )
      ),
      updated_at = now()
  WHERE id = p_request_id;

  -- Audit log entry
  INSERT INTO public.audit_logs (
    actor_id,
    actor_codename,
    action_type,
    target_id,
    details,
    metadata
  ) VALUES (
    v_admin_id,
    v_admin_name,
    'REVIEW_USER_CREATION_REQUEST',
    p_request_id::text,
    'Admin requested changes on user creation request for ' || (v_req.submitted_data->>'codename'),
    jsonb_build_object('review_notes', v_clean_notes, 'version', v_req.version)
  );
END;
$$;

-- 9. Workflow RPC: resubmit_user_creation_request
CREATE OR REPLACE FUNCTION public.resubmit_user_creation_request(
  p_request_id uuid,
  p_data jsonb,
  p_expected_version integer
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_caller_role text;
  v_caller_name text;
  v_req record;
  v_codename text;
  v_full_name text;
  v_has_quotes boolean;
  v_sanitized_data jsonb;
  v_new_version integer;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated.';
  END IF;

  SELECT role, COALESCE(username, full_name, 'Supervisor')
  INTO v_caller_role, v_caller_name
  FROM public.profiles
  WHERE id = v_caller_id;

  SELECT * INTO v_req 
  FROM public.user_creation_requests 
  WHERE id = p_request_id 
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User creation request % not found.', p_request_id;
  END IF;

  IF v_req.requester_id <> v_caller_id AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: You can only resubmit your own creation requests.';
  END IF;

  IF v_req.status <> 'needs_review' THEN
    RAISE EXCEPTION 'Only requests in needs_review status can be resubmitted. Current status: %', v_req.status;
  END IF;

  -- Concurrency check
  IF v_req.version <> p_expected_version THEN
    RAISE EXCEPTION 'Concurrency conflict: Request version (%) does not match expected version (%). Please refresh.', v_req.version, p_expected_version;
  END IF;

  v_codename := upper(btrim(p_data->>'codename'));
  v_full_name := btrim(COALESCE(p_data->>'fullName', p_data->>'full_name', ''));
  v_has_quotes := COALESCE((p_data->>'hasQuotesAccess')::boolean, (p_data->>'has_quotes_access')::boolean, false);

  IF length(v_codename) < 3 THEN
    RAISE EXCEPTION 'Codename must be at least 3 characters long.';
  END IF;

  IF NOT (v_codename ~ '^[A-Z0-9_-]+$') THEN
    RAISE EXCEPTION 'Codename can only contain letters, numbers, hyphens, and underscores.';
  END IF;

  -- Role restriction: Supervisors can ONLY request 'user' role
  IF COALESCE(p_data->>'role', 'user') <> 'user' THEN
    RAISE EXCEPTION 'Supervisors can only request user accounts with user role.';
  END IF;

  IF NOT v_has_quotes THEN
    RAISE EXCEPTION 'Quotes Manager Workspace access is required for supervisor-created accounts.';
  END IF;

  -- Check codename against active profiles
  IF EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE upper(btrim(username)) = v_codename
  ) THEN
    RAISE EXCEPTION 'A user with codename "%" already exists in active profiles.', v_codename;
  END IF;

  v_new_version := v_req.version + 1;

  v_sanitized_data := p_data || jsonb_build_object(
    'role', 'user',
    'codename', v_codename,
    'fullName', v_full_name,
    'full_name', v_full_name,
    'hasQuotesAccess', true,
    'has_quotes_access', true,
    'hasChutiAccess', true,
    'has_chuti_access', true
  );

  UPDATE public.user_creation_requests
  SET status = 'pending_admin_approval',
      submitted_data = v_sanitized_data,
      version = v_new_version,
      history = history || jsonb_build_array(
        jsonb_build_object(
          'action', 'resubmitted',
          'actor_id', v_caller_id,
          'actor_name', v_caller_name,
          'timestamp', now(),
          'version', v_new_version
        )
      ),
      updated_at = now()
  WHERE id = p_request_id;

  -- Audit log entry
  INSERT INTO public.audit_logs (
    actor_id,
    actor_codename,
    action_type,
    target_id,
    details,
    metadata
  ) VALUES (
    v_caller_id,
    v_caller_name,
    'RESUBMIT_USER_CREATION_REQUEST',
    p_request_id::text,
    'Supervisor resubmitted user creation request for ' || v_codename,
    jsonb_build_object('codename', v_codename, 'version', v_new_version)
  );
END;
$$;

-- 10. Workflow RPC: approve_user_creation_request
CREATE OR REPLACE FUNCTION public.approve_user_creation_request(
  p_request_id uuid,
  p_expected_version integer DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $$
DECLARE
  v_admin_id uuid := auth.uid();
  v_admin_name text;
  v_req record;
  v_data jsonb;
  v_codename text;
  v_full_name text;
  v_email text;
  v_password text := '1234';
  v_created_user_id uuid;
  v_profile_options jsonb;
  v_allowed_types jsonb;
  v_supervisor_ids jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only administrators can approve user creation requests.';
  END IF;

  SELECT role, COALESCE(username, full_name, 'Admin')
  INTO v_admin_name, v_admin_name
  FROM public.profiles
  WHERE id = v_admin_id;

  SELECT * INTO v_req 
  FROM public.user_creation_requests 
  WHERE id = p_request_id 
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User creation request % not found.', p_request_id;
  END IF;

  IF v_req.status <> 'pending_admin_approval' THEN
    RAISE EXCEPTION 'Only requests in pending_admin_approval status can be approved. Current status: %', v_req.status;
  END IF;

  -- Concurrency check against stale approval
  IF p_expected_version IS NOT NULL AND v_req.version <> p_expected_version THEN
    RAISE EXCEPTION 'Concurrency conflict: Request version (%) does not match expected version (%). Please refresh.', v_req.version, p_expected_version;
  END IF;

  v_data := v_req.submitted_data;
  v_codename := upper(btrim(v_data->>'codename'));
  v_full_name := btrim(COALESCE(v_data->>'fullName', v_data->>'full_name', v_codename));
  v_email := lower(v_codename) || '@office.local';

  -- Double check username doesn't already exist in active profiles
  IF EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE upper(btrim(username)) = v_codename
  ) THEN
    RAISE EXCEPTION 'User "%" already exists in active profiles. Cannot approve duplicate account.', v_codename;
  END IF;

  -- Format allowed_types and supervisor_ids
  IF jsonb_typeof(v_data->'allowedTypes') = 'array' THEN
    v_allowed_types := v_data->'allowedTypes';
  ELSIF jsonb_typeof(v_data->'allowed_types') = 'array' THEN
    v_allowed_types := v_data->'allowed_types';
  ELSE
    v_allowed_types := '[]'::jsonb;
  END IF;

  IF jsonb_typeof(v_data->'supervisorIds') = 'array' THEN
    v_supervisor_ids := v_data->'supervisorIds';
  ELSIF jsonb_typeof(v_data->'supervisor_ids') = 'array' THEN
    v_supervisor_ids := v_data->'supervisor_ids';
  ELSE
    v_supervisor_ids := '[]'::jsonb;
  END IF;

  -- Build profile options matching create_configured_user structure
  v_profile_options := jsonb_build_object(
    'allowed_types', v_allowed_types,
    'can_manage_rules', COALESCE((v_data->>'canManageRules')::boolean, (v_data->>'can_manage_rules')::boolean, false),
    'has_chuti_access', true,
    'has_quotes_access', true,
    'needs_supervisor_approval', COALESCE((v_data->>'needsApproval')::boolean, (v_data->>'needs_supervisor_approval')::boolean, true),
    'supervisor_ids', v_supervisor_ids,
    'eligible_govt_holiday', COALESCE((v_data->>'eligibleGovtHoliday')::boolean, (v_data->>'eligible_govt_holiday')::boolean, false),
    'eligible_office_leave', COALESCE((v_data->>'eligibleOfficeLeave')::boolean, (v_data->>'eligible_office_leave')::boolean, false),
    'allow_overtime', COALESCE((v_data->>'allowOvertime')::boolean, (v_data->>'allow_overtime')::boolean, false),
    'allow_reserve', COALESCE((v_data->>'allowReserve')::boolean, (v_data->>'allow_reserve')::boolean, false),
    'job_role', COALESCE(v_data->>'jobRole', v_data->>'job_role'),
    'working_hours', COALESCE((v_data->>'workingHours')::numeric, (v_data->>'working_hours')::numeric, 9.5),
    'break_time', COALESCE((v_data->>'breakTime')::numeric, (v_data->>'break_time')::numeric, 0),
    'default_sign_in', COALESCE(v_data->>'signInTime', v_data->>'default_sign_in'),
    'default_sign_out', COALESCE(v_data->>'signOutTime', v_data->>'default_sign_out'),
    'kpi_skills', CASE WHEN jsonb_typeof(v_data->'kpiSkills') = 'array' THEN v_data->'kpiSkills' WHEN jsonb_typeof(v_data->'kpi_skills') = 'array' THEN v_data->'kpi_skills' ELSE '[]'::jsonb END,
    'kpi_dept_indicators', CASE WHEN jsonb_typeof(v_data->'kpiDeptIndicators') = 'array' THEN v_data->'kpiDeptIndicators' WHEN jsonb_typeof(v_data->'kpi_dept_indicators') = 'array' THEN v_data->'kpi_dept_indicators' ELSE '[]'::jsonb END,
    'kpi_other_dept_indicators', CASE WHEN jsonb_typeof(v_data->'kpiOtherDeptIndicators') = 'array' THEN v_data->'kpiOtherDeptIndicators' WHEN jsonb_typeof(v_data->'kpi_other_dept_indicators') = 'array' THEN v_data->'kpi_other_dept_indicators' ELSE '[]'::jsonb END,
    'performs_data_entry', COALESCE((v_data->>'performsDataEntry')::boolean, (v_data->>'performs_data_entry')::boolean, true),
    'department', COALESCE(v_data->>'department', 'Data Entry'),
    'performs_other_dept_tasks', COALESCE((v_data->>'performsOtherDeptTasks')::boolean, (v_data->>'performs_other_dept_tasks')::boolean, false),
    'other_department', COALESCE(v_data->>'otherDepartment', v_data->>'other_department', 'IT')
  );

  -- Call the canonical user provisioning function
  v_created_user_id := public.create_configured_user(
    v_email,
    v_password,
    v_codename,
    'user',
    v_full_name,
    v_profile_options
  );

  IF v_created_user_id IS NULL THEN
    RAISE EXCEPTION 'Failed to provision active user account.';
  END IF;

  -- Mark request approved
  UPDATE public.user_creation_requests
  SET status = 'approved',
      created_user_id = v_created_user_id,
      reviewed_by = v_admin_id,
      reviewed_at = now(),
      history = history || jsonb_build_array(
        jsonb_build_object(
          'action', 'approved',
          'actor_id', v_admin_id,
          'actor_name', v_admin_name,
          'created_user_id', v_created_user_id,
          'timestamp', now(),
          'version', v_req.version
        )
      ),
      updated_at = now()
  WHERE id = p_request_id;

  -- Audit log entry
  INSERT INTO public.audit_logs (
    actor_id,
    actor_codename,
    action_type,
    target_id,
    target_user_id,
    details,
    metadata
  ) VALUES (
    v_admin_id,
    v_admin_name,
    'APPROVE_USER_CREATION_REQUEST',
    p_request_id::text,
    v_created_user_id,
    'Admin approved user creation request and provisioned account ' || v_codename,
    jsonb_build_object('created_user_id', v_created_user_id, 'codename', v_codename, 'role', 'user')
  );

  RETURN v_created_user_id;
END;
$$;

-- 11. Grants
GRANT SELECT, INSERT, UPDATE ON public.user_creation_requests TO authenticated;
GRANT ALL ON public.user_creation_requests TO service_role;

GRANT EXECUTE ON FUNCTION public.submit_user_creation_request(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_user_creation_request(uuid, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resubmit_user_creation_request(uuid, jsonb, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_user_creation_request(uuid, integer) TO authenticated;
