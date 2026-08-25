-- Migration: Add missing FK indexes and updated_at triggers
-- Addresses audit findings M4 (missing FK indexes) and M5 (missing triggers)

-- ============================================================
-- M4: Missing B-tree indexes on foreign key columns
-- These prevent full table scans during JOINs and cascading deletes
-- ============================================================

-- audit_logs.actor_id — frequently joined/filtered by actor
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id
  ON public.audit_logs USING btree (actor_id);

-- dismissed_notifications.user_id — scoped by user in RLS
CREATE INDEX IF NOT EXISTS idx_dismissed_notifications_user_id
  ON public.dismissed_notifications USING btree (user_id);

-- kpi_assessments.user_id — filtered by user for KPI views
CREATE INDEX IF NOT EXISTS idx_kpi_assessments_user_id
  ON public.kpi_assessments USING btree (user_id);

-- leaderboard_archive.user_id — looked up by user for history
CREATE INDEX IF NOT EXISTS idx_leaderboard_archive_user_id
  ON public.leaderboard_archive USING btree (user_id);

-- leave_settlements.action_by — filtered in settlement workflows
CREATE INDEX IF NOT EXISTS idx_leave_settlements_action_by
  ON public.leave_settlements USING btree (action_by);

-- leave_settlements.processed_by — filtered in admin views
CREATE INDEX IF NOT EXISTS idx_leave_settlements_processed_by
  ON public.leave_settlements USING btree (processed_by);

-- quotation_mistakes.created_by — filtered in mistake review
CREATE INDEX IF NOT EXISTS idx_quotation_mistakes_created_by
  ON public.quotation_mistakes USING btree (created_by);

-- quotation_mistakes.updated_by — joined for edit audit trails
CREATE INDEX IF NOT EXISTS idx_quotation_mistakes_updated_by
  ON public.quotation_mistakes USING btree (updated_by);


-- ============================================================
-- M5: Missing updated_at triggers on 3 tables
-- Ensures updated_at is automatically set on every UPDATE
-- ============================================================

-- Generic trigger function (reusable, IF NOT EXISTS via CREATE OR REPLACE)
CREATE OR REPLACE FUNCTION public.set_generic_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  NEW.updated_at := timezone('utc', now());
  RETURN NEW;
END;
$$;

-- kpi_assessments
CREATE TRIGGER kpi_assessments_set_updated_at
  BEFORE UPDATE ON public.kpi_assessments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_generic_updated_at();

-- login_codes
CREATE TRIGGER login_codes_set_updated_at
  BEFORE UPDATE ON public.login_codes
  FOR EACH ROW
  EXECUTE FUNCTION public.set_generic_updated_at();

-- quotation_mistakes
CREATE TRIGGER quotation_mistakes_set_updated_at
  BEFORE UPDATE ON public.quotation_mistakes
  FOR EACH ROW
  EXECUTE FUNCTION public.set_generic_updated_at();
