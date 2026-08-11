-- 1. Create the quotation_mistakes table
CREATE TABLE IF NOT EXISTS public.quotation_mistakes (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    codename TEXT NOT NULL,
    branch TEXT NOT NULL,
    filename TEXT NOT NULL,
    mistake_details TEXT NOT NULL,
    penalty TEXT NOT NULL,
    date TEXT NOT NULL,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.quotation_mistakes ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 3. AUDIT FIX C2: Replace blanket USING(true) policies with role-based access
--    Date: 2026-08-07
--
--    Previous state: All 4 policies used USING(true) / WITH CHECK(true),
--    allowing ANY authenticated user to CRUD ALL records.
--
--    New policies:
--      SELECT  → All authenticated users (app filters user_id client-side)
--      INSERT  → Admin or Supervisor only (matches canWriteQuotationMistakes)
--      UPDATE  → Admin or Supervisor only (matches canWriteQuotationMistakes)
--      DELETE  → Admin only (most destructive operation, restricted further)
-- ============================================================================

-- SELECT: All authenticated users can read (regular users see own records via client filter)
DROP POLICY IF EXISTS "Allow authenticated users to read quotation mistakes" ON public.quotation_mistakes;
CREATE POLICY "Allow authenticated users to read quotation mistakes"
ON public.quotation_mistakes
FOR SELECT
TO authenticated
USING (true);

-- INSERT: Only admins and supervisors can create mistake records
DROP POLICY IF EXISTS "Allow authenticated users to insert quotation mistakes" ON public.quotation_mistakes;
CREATE POLICY "Allow admins and supervisors to insert quotation mistakes"
ON public.quotation_mistakes
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin() OR public.is_supervisor());

-- UPDATE: Only admins and supervisors can update mistake records
DROP POLICY IF EXISTS "Allow authenticated users to update quotation mistakes" ON public.quotation_mistakes;
CREATE POLICY "Allow admins and supervisors to update quotation mistakes"
ON public.quotation_mistakes
FOR UPDATE
TO authenticated
USING (public.is_admin() OR public.is_supervisor());

-- DELETE: Only admins can delete mistake records (most destructive operation)
DROP POLICY IF EXISTS "Allow authenticated users to delete quotation mistakes" ON public.quotation_mistakes;
CREATE POLICY "Allow admins to delete quotation mistakes"
ON public.quotation_mistakes
FOR DELETE
TO authenticated
USING (public.is_admin());
