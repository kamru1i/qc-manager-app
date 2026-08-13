-- Final access-boundary follow-up: workspace revocation and KPI integrity.
-- This migration is deliberately separate from 20260813090000 because that
-- migration was already applied to the linked database before these additional
-- forensic findings were confirmed.

-- ---------------------------------------------------------------------------
-- Workspace assignment is enforced in PostgreSQL as well as in navigation.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.current_user_has_workspace(p_workspace text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN auth.role() = 'service_role' THEN true
    WHEN p.role = 'superadmin' THEN true
    WHEN p_workspace = 'chuti' THEN COALESCE(p.has_chuti_access, false)
    WHEN p_workspace = 'quotes' THEN COALESCE(p.has_quotes_access, false)
    ELSE false
  END
  FROM public.profiles p
  WHERE p.id = auth.uid();
$$;

-- Team predicates may be used by RLS, but callers must not be able to ask
-- whether arbitrary pairs of accounts have a supervisory relationship.
CREATE OR REPLACE FUNCTION public.has_leave_access(supervisor_id uuid, employee_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    (auth.role() = 'service_role' OR supervisor_id = auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.profiles employee
      WHERE employee.id = employee_id
        AND (
          supervisor_id = ANY(COALESCE(employee.supervisor_ids, ARRAY[]::uuid[]))
          OR employee.delegated_leave_supervisor_id = supervisor_id
          OR EXISTS (
            SELECT 1
            FROM public.profiles direct_supervisor
            WHERE direct_supervisor.id = ANY(COALESCE(employee.supervisor_ids, ARRAY[]::uuid[]))
              AND direct_supervisor.delegated_supervisor_id = supervisor_id
          )
        )
    );
$$;

CREATE OR REPLACE FUNCTION public.has_kpi_access(supervisor_id uuid, employee_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    (auth.role() = 'service_role' OR supervisor_id = auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.profiles employee
      WHERE employee.id = employee_id
        AND (
          supervisor_id = ANY(COALESCE(employee.supervisor_ids, ARRAY[]::uuid[]))
          OR employee.delegated_kpi_supervisor_id = supervisor_id
        )
    );
$$;

-- Obsolete and unreferenced. Its original definition also accepted arbitrary
-- account pairs, so retaining it only expanded the callable attack surface.
DROP FUNCTION IF EXISTS public.is_supervisor_of(uuid, uuid);

-- Records (quotation detail rows).
DROP POLICY IF EXISTS "Allow authenticated users to read all records" ON public.records;
DROP POLICY IF EXISTS "Scoped records read access" ON public.records;
DROP POLICY IF EXISTS "Allow users to insert own records, admins/supervisors insert al" ON public.records;
DROP POLICY IF EXISTS "Allow users to update own records, admins/supervisors update al" ON public.records;
DROP POLICY IF EXISTS "Allow users to delete own records, admins/supervisors delete al" ON public.records;

CREATE POLICY "Scoped records read access"
ON public.records FOR SELECT TO authenticated
USING (
  public.current_user_has_workspace('quotes')
  AND (
    user_id = (SELECT auth.uid())
    OR public.is_admin()
    OR (public.is_supervisor() AND public.has_leave_access((SELECT auth.uid()), user_id))
  )
);
CREATE POLICY "Scoped records insertion"
ON public.records FOR INSERT TO authenticated
WITH CHECK (
  public.current_user_has_workspace('quotes')
  AND (
    user_id = (SELECT auth.uid())
    OR public.is_admin()
    OR (public.is_supervisor() AND public.has_leave_access((SELECT auth.uid()), user_id))
  )
);
CREATE POLICY "Scoped records updates"
ON public.records FOR UPDATE TO authenticated
USING (
  public.current_user_has_workspace('quotes')
  AND (
    user_id = (SELECT auth.uid())
    OR public.is_admin()
    OR (public.is_supervisor() AND public.has_leave_access((SELECT auth.uid()), user_id))
  )
)
WITH CHECK (
  public.current_user_has_workspace('quotes')
  AND (
    user_id = (SELECT auth.uid())
    OR public.is_admin()
    OR (public.is_supervisor() AND public.has_leave_access((SELECT auth.uid()), user_id))
  )
);
CREATE POLICY "Scoped records deletion"
ON public.records FOR DELETE TO authenticated
USING (
  public.current_user_has_workspace('quotes')
  AND (
    user_id = (SELECT auth.uid())
    OR public.is_admin()
    OR (public.is_supervisor() AND public.has_leave_access((SELECT auth.uid()), user_id))
  )
);

-- Leave rows.
DROP POLICY IF EXISTS "Allow admins to insert chuti for all users" ON public.chuti;
DROP POLICY IF EXISTS "Allow admins to update all chuti" ON public.chuti;
DROP POLICY IF EXISTS "Allow supervisors to insert chuti for supervised users" ON public.chuti;
DROP POLICY IF EXISTS "Allow supervisors to update chuti status" ON public.chuti;
DROP POLICY IF EXISTS "Allow users to insert their own chuti" ON public.chuti;
DROP POLICY IF EXISTS "Allow users to read their own chuti" ON public.chuti;
DROP POLICY IF EXISTS "Allow users to update their own chuti" ON public.chuti;
DROP POLICY IF EXISTS "Scoped leave read access" ON public.chuti;
DROP POLICY IF EXISTS "Scoped leave insertion" ON public.chuti;
DROP POLICY IF EXISTS "Scoped leave updates" ON public.chuti;
DROP POLICY IF EXISTS "Scoped leave deletion" ON public.chuti;

CREATE POLICY "Scoped leave read access"
ON public.chuti FOR SELECT TO authenticated
USING (
  public.current_user_has_workspace('chuti')
  AND (
    user_id = (SELECT auth.uid())
    OR public.is_admin()
    OR (public.is_supervisor() AND public.has_leave_access((SELECT auth.uid()), user_id))
  )
);
CREATE POLICY "Scoped leave insertion"
ON public.chuti FOR INSERT TO authenticated
WITH CHECK (
  public.current_user_has_workspace('chuti')
  AND (
    user_id = (SELECT auth.uid())
    OR public.is_admin()
    OR (public.is_supervisor() AND public.has_leave_access((SELECT auth.uid()), user_id))
  )
);
CREATE POLICY "Scoped leave updates"
ON public.chuti FOR UPDATE TO authenticated
USING (
  public.current_user_has_workspace('chuti')
  AND (
    user_id = (SELECT auth.uid())
    OR public.is_admin()
    OR (public.is_supervisor() AND public.has_leave_access((SELECT auth.uid()), user_id))
  )
)
WITH CHECK (
  public.current_user_has_workspace('chuti')
  AND (
    user_id = (SELECT auth.uid())
    OR public.is_admin()
    OR (public.is_supervisor() AND public.has_leave_access((SELECT auth.uid()), user_id))
  )
);
CREATE POLICY "Scoped leave deletion"
ON public.chuti FOR DELETE TO authenticated
USING (
  public.current_user_has_workspace('chuti')
  AND (
    public.is_admin()
    OR (public.is_supervisor() AND public.has_leave_access((SELECT auth.uid()), user_id))
    OR (
      user_id = (SELECT auth.uid())
      AND status IN ('pending_supervisor', 'approved_by_supervisor', 'needs_review')
    )
  )
);

-- Settlements.
DROP POLICY IF EXISTS "Scoped settlement read access" ON public.leave_settlements;
DROP POLICY IF EXISTS "Scoped settlement management" ON public.leave_settlements;
DROP POLICY IF EXISTS "Users can submit own settlement response" ON public.leave_settlements;
DROP POLICY IF EXISTS "Users can revise own settlement response" ON public.leave_settlements;

CREATE POLICY "Scoped settlement read access"
ON public.leave_settlements FOR SELECT TO authenticated
USING (
  public.current_user_has_workspace('chuti')
  AND (
    user_id = (SELECT auth.uid())
    OR public.is_admin()
    OR (public.is_supervisor() AND public.has_leave_access((SELECT auth.uid()), user_id))
  )
);
CREATE POLICY "Scoped settlement management"
ON public.leave_settlements FOR ALL TO authenticated
USING (
  public.current_user_has_workspace('chuti')
  AND (
    public.is_admin()
    OR (public.is_supervisor() AND public.has_leave_access((SELECT auth.uid()), user_id))
  )
)
WITH CHECK (
  public.current_user_has_workspace('chuti')
  AND (
    public.is_admin()
    OR (public.is_supervisor() AND public.has_leave_access((SELECT auth.uid()), user_id))
  )
);
CREATE POLICY "Users can submit own settlement response"
ON public.leave_settlements FOR INSERT TO authenticated
WITH CHECK (
  public.current_user_has_workspace('chuti')
  AND user_id = (SELECT auth.uid())
  AND status = 'responded'
  AND processed_by IS NULL
  AND processed_at IS NULL
);
CREATE POLICY "Users can revise own settlement response"
ON public.leave_settlements FOR UPDATE TO authenticated
USING (
  public.current_user_has_workspace('chuti')
  AND user_id = (SELECT auth.uid())
  AND status IN ('initiated', 'responded')
)
WITH CHECK (
  public.current_user_has_workspace('chuti')
  AND user_id = (SELECT auth.uid())
  AND status = 'responded'
  AND processed_by IS NULL
  AND processed_at IS NULL
);

-- Government-holiday entitlements.
DROP POLICY IF EXISTS "Admins can read all holiday responses" ON public.govt_holiday_responses;
DROP POLICY IF EXISTS "Admins can update/delete responses" ON public.govt_holiday_responses;
DROP POLICY IF EXISTS "Users can read own holiday responses" ON public.govt_holiday_responses;
CREATE POLICY "Admins can read all holiday responses"
ON public.govt_holiday_responses FOR SELECT TO authenticated
USING (public.current_user_has_workspace('chuti') AND public.is_admin());
CREATE POLICY "Admins can update/delete responses"
ON public.govt_holiday_responses FOR ALL TO authenticated
USING (public.current_user_has_workspace('chuti') AND public.is_admin())
WITH CHECK (public.current_user_has_workspace('chuti') AND public.is_admin());
CREATE POLICY "Users can read own holiday responses"
ON public.govt_holiday_responses FOR SELECT TO authenticated
USING (
  public.current_user_has_workspace('chuti')
  AND user_id = (SELECT auth.uid())
);

-- Quotation mistakes.
DROP POLICY IF EXISTS "Role-scoped quotation mistake reads" ON public.quotation_mistakes;
DROP POLICY IF EXISTS "Feature-controlled quotation mistake inserts" ON public.quotation_mistakes;
DROP POLICY IF EXISTS "Feature-controlled quotation mistake updates" ON public.quotation_mistakes;
DROP POLICY IF EXISTS "Feature-controlled quotation mistake deletes" ON public.quotation_mistakes;
CREATE POLICY "Role-scoped quotation mistake reads"
ON public.quotation_mistakes FOR SELECT TO authenticated
USING (
  public.current_user_has_workspace('quotes')
  AND (
    user_id = (SELECT auth.uid())
    OR public.get_my_role() IN ('admin', 'superadmin', 'supervisor')
  )
);
CREATE POLICY "Feature-controlled quotation mistake inserts"
ON public.quotation_mistakes FOR INSERT TO authenticated
WITH CHECK (
  public.current_user_has_workspace('quotes')
  AND public.can_write_quotation_mistakes()
);
CREATE POLICY "Feature-controlled quotation mistake updates"
ON public.quotation_mistakes FOR UPDATE TO authenticated
USING (
  public.current_user_has_workspace('quotes')
  AND public.can_write_quotation_mistakes()
)
WITH CHECK (
  public.current_user_has_workspace('quotes')
  AND public.can_write_quotation_mistakes()
);
CREATE POLICY "Feature-controlled quotation mistake deletes"
ON public.quotation_mistakes FOR DELETE TO authenticated
USING (
  public.current_user_has_workspace('quotes')
  AND public.can_write_quotation_mistakes()
);

-- Quotes support data.
DROP POLICY IF EXISTS "Allow authenticated to read compliance rules" ON public.compliance_rules;
DROP POLICY IF EXISTS "Allow admins, supervisors or authorized editors to insert rules" ON public.compliance_rules;
DROP POLICY IF EXISTS "Allow admins, supervisors or authorized editors to update rules" ON public.compliance_rules;
DROP POLICY IF EXISTS "Allow admins, supervisors or authorized editors to delete rules" ON public.compliance_rules;
CREATE POLICY "Allow authenticated to read compliance rules"
ON public.compliance_rules FOR SELECT TO authenticated
USING (
  public.current_user_has_workspace('quotes')
  AND (
    NOT is_deleted
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND (p.role IN ('admin', 'superadmin', 'supervisor') OR p.can_manage_rules IS TRUE)
    )
  )
);
CREATE POLICY "Allow authorized editors to insert rules"
ON public.compliance_rules FOR INSERT TO authenticated
WITH CHECK (
  public.current_user_has_workspace('quotes')
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = (SELECT auth.uid())
      AND (p.role IN ('admin', 'superadmin', 'supervisor') OR p.can_manage_rules IS TRUE)
  )
);
CREATE POLICY "Allow authorized editors to update rules"
ON public.compliance_rules FOR UPDATE TO authenticated
USING (
  public.current_user_has_workspace('quotes')
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = (SELECT auth.uid())
      AND (p.role IN ('admin', 'superadmin', 'supervisor') OR p.can_manage_rules IS TRUE)
  )
)
WITH CHECK (
  public.current_user_has_workspace('quotes')
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = (SELECT auth.uid())
      AND (p.role IN ('admin', 'superadmin', 'supervisor') OR p.can_manage_rules IS TRUE)
  )
);
CREATE POLICY "Allow authorized editors to delete rules"
ON public.compliance_rules FOR DELETE TO authenticated
USING (
  public.current_user_has_workspace('quotes')
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = (SELECT auth.uid())
      AND (p.role IN ('admin', 'superadmin', 'supervisor') OR p.can_manage_rules IS TRUE)
  )
);

DROP POLICY IF EXISTS "Allow authenticated to read login codes" ON public.login_codes;
DROP POLICY IF EXISTS "Allow admins & supervisors to manage login codes" ON public.login_codes;
CREATE POLICY "Allow authenticated to read login codes"
ON public.login_codes FOR SELECT TO authenticated
USING (public.current_user_has_workspace('quotes'));
CREATE POLICY "Allow admins & supervisors to manage login codes"
ON public.login_codes FOR ALL TO authenticated
USING (
  public.current_user_has_workspace('quotes')
  AND (public.is_admin() OR public.is_supervisor())
)
WITH CHECK (
  public.current_user_has_workspace('quotes')
  AND (public.is_admin() OR public.is_supervisor())
);

-- ---------------------------------------------------------------------------
-- Employee KPI writes cannot forge appraiser-controlled fields.
-- ---------------------------------------------------------------------------

UPDATE public.kpi_assessments
SET kpis = '{}'::jsonb
WHERE jsonb_typeof(kpis) <> 'object';
ALTER TABLE public.kpi_assessments
  ALTER COLUMN kpis SET DEFAULT '{}'::jsonb;

CREATE OR REPLACE FUNCTION public.enforce_kpi_assessment_permissions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_role text;
  v_primary_appraiser text;
BEGIN
  IF NEW.month_year IS NULL OR btrim(NEW.month_year) = '' OR length(NEW.month_year) > 100 THEN
    RAISE EXCEPTION 'Invalid KPI assessment period.';
  END IF;
  IF jsonb_typeof(NEW.kpis) <> 'object' THEN
    RAISE EXCEPTION 'KPI data must be a JSON object.';
  END IF;
  IF length(COALESCE(NEW.emp_id, '')) > 100
     OR length(COALESCE(NEW.date_of_joining, '')) > 100
     OR length(COALESCE(NEW.department, '')) > 100
     OR length(COALESCE(NEW.appraiser_name, '')) > 150
     OR length(COALESCE(NEW.reviewer_name, '')) > 150 THEN
    RAISE EXCEPTION 'KPI assessment metadata exceeds the supported length.';
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.created_at := timezone('utc', now());
  ELSE
    IF NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.month_year IS DISTINCT FROM OLD.month_year
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'KPI assessment identity and creation time are immutable.';
    END IF;
  END IF;
  NEW.updated_at := timezone('utc', now());

  IF auth.role() = 'service_role' THEN RETURN NEW; END IF;

  SELECT p.role INTO v_actor_role
  FROM public.profiles p
  WHERE p.id = auth.uid();

  IF v_actor_role IN ('admin', 'superadmin') THEN
    RETURN NEW;
  END IF;
  IF v_actor_role = 'supervisor'
     AND (NEW.user_id = auth.uid() OR public.has_kpi_access(auth.uid(), NEW.user_id)) THEN
    RETURN NEW;
  END IF;
  IF v_actor_role <> 'user' OR NEW.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Permission denied for this KPI assessment.';
  END IF;

  IF TG_OP = 'INSERT' THEN
    SELECT COALESCE(supervisor.full_name, supervisor.username)
    INTO v_primary_appraiser
    FROM public.profiles employee
    CROSS JOIN LATERAL unnest(COALESCE(employee.supervisor_ids, ARRAY[]::uuid[]))
      WITH ORDINALITY AS assigned(supervisor_id, position)
    JOIN public.profiles supervisor ON supervisor.id = assigned.supervisor_id
    WHERE employee.id = NEW.user_id
    ORDER BY assigned.position
    LIMIT 1;

    NEW.kpis := NEW.kpis - ARRAY['weightages', 'supervisorScores'];
    NEW.appraiser_name := v_primary_appraiser;
    NEW.appraiser_signed := false;
    NEW.appraiser_sign_date := NULL;
  ELSE
    NEW.kpis := NEW.kpis - ARRAY['weightages', 'supervisorScores'];
    IF OLD.kpis ? 'weightages' THEN
      NEW.kpis := jsonb_set(NEW.kpis, '{weightages}', OLD.kpis->'weightages', true);
    END IF;
    IF OLD.kpis ? 'supervisorScores' THEN
      NEW.kpis := jsonb_set(NEW.kpis, '{supervisorScores}', OLD.kpis->'supervisorScores', true);
    END IF;
    NEW.appraiser_name := OLD.appraiser_name;
    NEW.appraiser_signed := OLD.appraiser_signed;
    NEW.appraiser_sign_date := OLD.appraiser_sign_date;
  END IF;

  NEW.appraisee_sign_date := CASE
    WHEN NEW.appraisee_signed IS TRUE THEN to_char(current_date, 'DD-MM-YYYY')
    ELSE NULL
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_kpi_assessment_permissions_trigger ON public.kpi_assessments;
CREATE TRIGGER enforce_kpi_assessment_permissions_trigger
BEFORE INSERT OR UPDATE ON public.kpi_assessments
FOR EACH ROW EXECUTE FUNCTION public.enforce_kpi_assessment_permissions();

DROP POLICY IF EXISTS "Allow insert/update/delete for owner, admin, or assigned superv" ON public.kpi_assessments;
DROP POLICY IF EXISTS "Allow select for owner, admin, or assigned supervisor" ON public.kpi_assessments;
DROP POLICY IF EXISTS "Scoped KPI assessment reads" ON public.kpi_assessments;
DROP POLICY IF EXISTS "Scoped KPI assessment inserts" ON public.kpi_assessments;
DROP POLICY IF EXISTS "Scoped KPI assessment updates" ON public.kpi_assessments;
DROP POLICY IF EXISTS "Scoped KPI assessment deletion" ON public.kpi_assessments;

CREATE POLICY "Scoped KPI assessment reads"
ON public.kpi_assessments FOR SELECT TO authenticated
USING (
  user_id = (SELECT auth.uid())
  OR public.is_admin()
  OR (public.is_supervisor() AND public.has_kpi_access((SELECT auth.uid()), user_id))
);
CREATE POLICY "Scoped KPI assessment inserts"
ON public.kpi_assessments FOR INSERT TO authenticated
WITH CHECK (
  user_id = (SELECT auth.uid())
  OR public.is_admin()
  OR (public.is_supervisor() AND public.has_kpi_access((SELECT auth.uid()), user_id))
);
CREATE POLICY "Scoped KPI assessment updates"
ON public.kpi_assessments FOR UPDATE TO authenticated
USING (
  user_id = (SELECT auth.uid())
  OR public.is_admin()
  OR (public.is_supervisor() AND public.has_kpi_access((SELECT auth.uid()), user_id))
)
WITH CHECK (
  user_id = (SELECT auth.uid())
  OR public.is_admin()
  OR (public.is_supervisor() AND public.has_kpi_access((SELECT auth.uid()), user_id))
);
CREATE POLICY "Scoped KPI assessment deletion"
ON public.kpi_assessments FOR DELETE TO authenticated
USING (
  public.is_admin()
  OR (public.is_supervisor() AND public.has_kpi_access((SELECT auth.uid()), user_id))
);

-- ---------------------------------------------------------------------------
-- Wrap existing leave SECURITY DEFINER entry points with workspace checks.
-- Keeping the implementation internal avoids duplicating complex transactions.
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF to_regprocedure('public.save_global_leave_settings_internal(jsonb)') IS NULL THEN
    ALTER FUNCTION public.save_global_leave_settings(jsonb)
      RENAME TO save_global_leave_settings_internal;
  END IF;
  IF to_regprocedure('public.convert_govt_holiday_response_internal(uuid,date,text)') IS NULL THEN
    ALTER FUNCTION public.convert_govt_holiday_response(uuid, date, text)
      RENAME TO convert_govt_holiday_response_internal;
  END IF;
  IF to_regprocedure('public.convert_short_leave_to_full_leave_internal(uuid,text)') IS NULL THEN
    ALTER FUNCTION public.convert_short_leave_to_full_leave(uuid, text)
      RENAME TO convert_short_leave_to_full_leave_internal;
  END IF;
  IF to_regprocedure('public.admin_insert_chuti_records_bulk_internal(uuid,date[],text,boolean[],boolean,time,time,interval,text,text,uuid)') IS NULL THEN
    ALTER FUNCTION public.admin_insert_chuti_records_bulk(uuid, date[], text, boolean[], boolean, time, time, interval, text, text, uuid)
      RENAME TO admin_insert_chuti_records_bulk_internal;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_global_leave_settings(p_settings jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.current_user_has_workspace('chuti') THEN
    RAISE EXCEPTION 'Leave workspace access is disabled.';
  END IF;
  PERFORM public.save_global_leave_settings_internal(p_settings);
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
BEGIN
  IF NOT public.current_user_has_workspace('chuti') THEN
    RAISE EXCEPTION 'Leave workspace access is disabled.';
  END IF;
  PERFORM public.convert_govt_holiday_response_internal(
    p_user_id, p_holiday_date, p_response
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.convert_short_leave_to_full_leave(
  p_user_id uuid,
  p_adjust_category text DEFAULT 'Office Leave'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.current_user_has_workspace('chuti') THEN
    RAISE EXCEPTION 'Leave workspace access is disabled.';
  END IF;
  RETURN public.convert_short_leave_to_full_leave_internal(
    p_user_id, p_adjust_category
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_insert_chuti_records_bulk(
  p_user_id uuid,
  p_dates date[],
  p_leave_type text,
  p_adjustments boolean[],
  p_adjust_short_leave boolean,
  p_sign_in_time time DEFAULT NULL,
  p_sign_out_time time DEFAULT NULL,
  p_leave_hour interval DEFAULT NULL,
  p_reserve_holiday text DEFAULT NULL,
  p_comment text DEFAULT NULL,
  p_bulk_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.current_user_has_workspace('chuti') THEN
    RAISE EXCEPTION 'Leave workspace access is disabled.';
  END IF;
  PERFORM public.admin_insert_chuti_records_bulk_internal(
    p_user_id, p_dates, p_leave_type, p_adjustments, p_adjust_short_leave,
    p_sign_in_time, p_sign_out_time, p_leave_hour, p_reserve_holiday,
    p_comment, p_bulk_id
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Execute privilege hygiene.
-- ---------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.current_user_has_workspace(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_leave_access(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_kpi_access(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_my_role() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_admin_or_supervisor() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_superadmin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_supervisor() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.enforce_kpi_assessment_permissions() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.save_global_leave_settings_internal(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.convert_govt_holiday_response_internal(uuid, date, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.convert_short_leave_to_full_leave_internal(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_insert_chuti_records_bulk_internal(uuid, date[], text, boolean[], boolean, time, time, interval, text, text, uuid) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.save_global_leave_settings(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.convert_govt_holiday_response(uuid, date, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.convert_short_leave_to_full_leave(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_insert_chuti_records_bulk(uuid, date[], text, boolean[], boolean, time, time, interval, text, text, uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.current_user_has_workspace(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_leave_access(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_kpi_access(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin_or_supervisor() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_superadmin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_supervisor() TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.save_global_leave_settings(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.convert_govt_holiday_response(uuid, date, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.convert_short_leave_to_full_leave(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_insert_chuti_records_bulk(uuid, date[], text, boolean[], boolean, time, time, interval, text, text, uuid) TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.save_global_leave_settings_internal(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.convert_govt_holiday_response_internal(uuid, date, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.convert_short_leave_to_full_leave_internal(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_insert_chuti_records_bulk_internal(uuid, date[], text, boolean[], boolean, time, time, interval, text, text, uuid) TO service_role;
