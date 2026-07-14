-- =========================================================================
-- SQL Script: Create mobile_app_versions Table for Self-Hosted OTA Updates
-- Run this in your Supabase SQL Editor.
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.mobile_app_versions (
    id BIGSERIAL PRIMARY KEY,
    version TEXT NOT NULL,
    zip_url TEXT NOT NULL,
    required BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.mobile_app_versions ENABLE ROW LEVEL SECURITY;

-- Allow public read access to mobile_app_versions (everyone can query versions)
DROP POLICY IF EXISTS "Allow public read access to mobile_app_versions" ON public.mobile_app_versions;
CREATE POLICY "Allow public read access to mobile_app_versions" ON public.mobile_app_versions
    FOR SELECT USING (true);
