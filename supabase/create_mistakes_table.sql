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

-- 3. Create RLS Policies for authenticated users
-- Allow read access
DROP POLICY IF EXISTS "Allow authenticated users to read quotation mistakes" ON public.quotation_mistakes;
CREATE POLICY "Allow authenticated users to read quotation mistakes"
ON public.quotation_mistakes
FOR SELECT
TO authenticated
USING (true);

-- Allow insert access
DROP POLICY IF EXISTS "Allow authenticated users to insert quotation mistakes" ON public.quotation_mistakes;
CREATE POLICY "Allow authenticated users to insert quotation mistakes"
ON public.quotation_mistakes
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow update access
DROP POLICY IF EXISTS "Allow authenticated users to update quotation mistakes" ON public.quotation_mistakes;
CREATE POLICY "Allow authenticated users to update quotation mistakes"
ON public.quotation_mistakes
FOR UPDATE
TO authenticated
USING (true);

-- Allow delete access
DROP POLICY IF EXISTS "Allow authenticated users to delete quotation mistakes" ON public.quotation_mistakes;
CREATE POLICY "Allow authenticated users to delete quotation mistakes"
ON public.quotation_mistakes
FOR DELETE
TO authenticated
USING (true);
