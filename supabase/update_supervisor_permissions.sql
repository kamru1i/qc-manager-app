-- Update Supervisor KPI & Performance Permissions (v2 - Scope Refinement & Centralized Checks)
-- Run this in your Supabase SQL Editor:

-- 1. Add delegation columns to profiles table if they don't exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS delegated_leave_supervisor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS delegated_kpi_supervisor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 2. Helper function to check if a supervisor supervises an employee (directly or via delegation)
CREATE OR REPLACE FUNCTION public.is_supervisor_of(supervisor_id UUID, employee_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = employee_id
    AND supervisor_id = ANY(supervisor_ids)
  ) OR EXISTS (
    SELECT 1 FROM public.profiles u
    JOIN public.profiles s ON s.id = ANY(u.supervisor_ids)
    WHERE u.id = employee_id
    AND s.delegated_supervisor_id = supervisor_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Helper functions to check specific leave and KPI access rights
CREATE OR REPLACE FUNCTION public.has_leave_access(supervisor_id UUID, employee_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles u
    WHERE u.id = employee_id
    AND (
      -- Direct team supervision
      supervisor_id = ANY(u.supervisor_ids)
      -- Explicit Leave delegation for this user
      OR u.delegated_leave_supervisor_id = supervisor_id
      -- Delegated team supervision
      OR EXISTS (
        SELECT 1 FROM public.profiles s
        WHERE s.id = ANY(u.supervisor_ids)
        AND s.delegated_supervisor_id = supervisor_id
      )
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.has_kpi_access(supervisor_id UUID, employee_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles u
    WHERE u.id = employee_id
    AND (
      -- Direct team supervision
      supervisor_id = ANY(u.supervisor_ids)
      -- Explicit KPI delegation for this user
      OR u.delegated_kpi_supervisor_id = supervisor_id
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Update Profiles SELECT and UPDATE policies
DROP POLICY IF EXISTS "Allow admin/supervisor to read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow admin to read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow supervisor to read supervised profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow supervisor to read all profiles" ON public.profiles;

CREATE POLICY "Allow admin to read all profiles"
ON public.profiles FOR SELECT
USING (public.is_admin());

CREATE POLICY "Allow supervisor to read all profiles"
ON public.profiles FOR SELECT
USING (public.is_supervisor());

DROP POLICY IF EXISTS "Allow supervisors to update supervised profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow supervisors to update profiles" ON public.profiles;

CREATE POLICY "Allow supervisors to update profiles"
ON public.profiles FOR UPDATE
USING (public.is_supervisor())
WITH CHECK (public.is_supervisor());

-- 5. Update Chuti (Leave History) Policies
DROP POLICY IF EXISTS "Allow supervisors to insert chuti for supervised users" ON public.chuti;
DROP POLICY IF EXISTS "Allow supervisors to update chuti status" ON public.chuti;
DROP POLICY IF EXISTS "Allow supervisors to delete chuti" ON public.chuti;

CREATE POLICY "Allow supervisors to insert chuti for supervised users"
ON public.chuti FOR INSERT
WITH CHECK (
  public.is_supervisor() AND public.has_leave_access(auth.uid(), user_id)
);

CREATE POLICY "Allow supervisors to update chuti status"
ON public.chuti FOR UPDATE
USING (
  public.is_supervisor() AND public.has_leave_access(auth.uid(), user_id)
);

CREATE POLICY "Allow supervisors to delete chuti"
ON public.chuti FOR DELETE
USING (
  public.is_supervisor() AND public.has_leave_access(auth.uid(), user_id)
);

-- 6. Update KPI Assessments SELECT and Write policies
DROP POLICY IF EXISTS "Allow select for all authenticated users" ON public.kpi_assessments;
DROP POLICY IF EXISTS "Allow select for owner, admin, or assigned supervisor" ON public.kpi_assessments;
DROP POLICY IF EXISTS "Allow insert/update/delete for admin, supervisor, or self" ON public.kpi_assessments;
DROP POLICY IF EXISTS "Allow insert/update/delete for owner, admin, or assigned supervisor" ON public.kpi_assessments;

CREATE POLICY "Allow select for owner, admin, or assigned supervisor" 
ON public.kpi_assessments FOR SELECT 
TO authenticated 
USING (
  auth.uid() = user_id 
  OR public.is_admin() 
  OR (public.is_supervisor() AND public.has_kpi_access(auth.uid(), user_id))
);

CREATE POLICY "Allow insert/update/delete for owner, admin, or assigned supervisor" 
ON public.kpi_assessments FOR ALL 
TO authenticated 
USING (
  auth.uid() = user_id 
  OR public.is_admin() 
  OR (public.is_supervisor() AND public.has_kpi_access(auth.uid(), user_id))
);

-- 7. Add update verification trigger to profiles to block unauthorized supervisor settings editing
CREATE OR REPLACE FUNCTION public.check_profile_updates()
RETURNS TRIGGER AS $$
BEGIN
  -- If the editor is the service_role (API routes / system), allow everything
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- If the editor is an admin, allow everything
  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RETURN NEW;
  END IF;

  -- If the editor is a supervisor
  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'supervisor'
  ) THEN
    -- If editing self, allow everything
    IF auth.uid() = NEW.id THEN
      RETURN NEW;
    END IF;

    -- If editing an employee they directly supervise, enforce key constraints (prevent privilege escalation/sensitive settings modification)
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

  -- Default fallback: only allow users to edit self (non-supervisors)
  IF auth.uid() = NEW.id THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Unauthorized profile modification.';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_profile_update_security ON public.profiles;
CREATE TRIGGER on_profile_update_security
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.check_profile_updates();
