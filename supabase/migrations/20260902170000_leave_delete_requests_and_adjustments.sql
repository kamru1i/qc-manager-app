-- Migration: 20260902170000_leave_delete_requests_and_adjustments.sql
-- Description: Leave delete requests table, RLS, indexes, and RPCs for removal approval workflow

-- 1. Create table for leave delete requests if not exists
CREATE TABLE IF NOT EXISTS public.leave_delete_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  leave_id uuid NOT NULL REFERENCES public.chuti(id) ON DELETE CASCADE,
  requester_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason text,
  status text DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- 2. Indexes for performance and uniqueness
CREATE INDEX IF NOT EXISTS idx_leave_delete_requests_requester ON public.leave_delete_requests (requester_id);
CREATE INDEX IF NOT EXISTS idx_leave_delete_requests_leave ON public.leave_delete_requests (leave_id);
CREATE INDEX IF NOT EXISTS idx_leave_delete_requests_status ON public.leave_delete_requests (status, created_at DESC);

-- Prevent duplicate active pending removal requests for the same leave record
CREATE UNIQUE INDEX IF NOT EXISTS idx_leave_delete_requests_active_unique 
  ON public.leave_delete_requests (leave_id) 
  WHERE (status = 'pending');

-- 3. Enable RLS
ALTER TABLE public.leave_delete_requests ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
DROP POLICY IF EXISTS "leave_delete_requests_select" ON public.leave_delete_requests;
CREATE POLICY "leave_delete_requests_select" ON public.leave_delete_requests
  FOR SELECT TO authenticated
  USING (
    public.is_admin() 
    OR requester_id = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS "leave_delete_requests_insert" ON public.leave_delete_requests;
CREATE POLICY "leave_delete_requests_insert" ON public.leave_delete_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    requester_id = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS "leave_delete_requests_update" ON public.leave_delete_requests;
CREATE POLICY "leave_delete_requests_update" ON public.leave_delete_requests
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "leave_delete_requests_delete" ON public.leave_delete_requests;
CREATE POLICY "leave_delete_requests_delete" ON public.leave_delete_requests
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- 5. Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_leave_delete_requests_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_leave_delete_requests_updated_at ON public.leave_delete_requests;
CREATE TRIGGER trg_leave_delete_requests_updated_at
  BEFORE UPDATE ON public.leave_delete_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_leave_delete_requests_updated_at();

-- 6. Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leave_delete_requests TO authenticated;
GRANT ALL ON public.leave_delete_requests TO service_role;
