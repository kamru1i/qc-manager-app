-- Revoke Audit Logs Access for Supervisors
-- Run this in your Supabase SQL Editor to apply security updates:

DROP POLICY IF EXISTS "Allow admins and supervisors to read all audit logs" ON public.audit_logs;

CREATE POLICY "Allow admins to read all audit logs" ON public.audit_logs
  FOR SELECT TO authenticated USING (public.is_admin());
