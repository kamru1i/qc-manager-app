-- Migration: 20260818180000_attendance_module.sql
-- Description: Add Attendance & Shift Tracking tables with RLS and realtime publication

-- 1. Daily Attendance Table
CREATE TABLE IF NOT EXISTS public.attendance_daily (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    attendance_date DATE NOT NULL,
    join_time TIMESTAMPTZ,
    close_time TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'WORKING' CHECK (status IN ('WORKING', 'SNACK_BREAK', 'PRAYER_BREAK', 'CLOSED', 'DAY_OFF')),
    total_work_minutes NUMERIC(8, 2) NOT NULL DEFAULT 0,
    total_break_minutes NUMERIC(8, 2) NOT NULL DEFAULT 0,
    total_prayer_minutes NUMERIC(8, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_user_attendance_date UNIQUE (user_id, attendance_date)
);

-- 2. Attendance Breaks & Prayer Sessions Table
CREATE TABLE IF NOT EXISTS public.attendance_breaks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attendance_id UUID NOT NULL REFERENCES public.attendance_daily(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    attendance_date DATE NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('snack', 'prayer')),
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ,
    duration_minutes NUMERIC(8, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Indexes for fast daily & monthly queries
CREATE INDEX IF NOT EXISTS idx_attendance_daily_date ON public.attendance_daily(attendance_date);
CREATE INDEX IF NOT EXISTS idx_attendance_daily_user_id ON public.attendance_daily(user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_daily_user_date ON public.attendance_daily(user_id, attendance_date);

CREATE INDEX IF NOT EXISTS idx_attendance_breaks_attendance_id ON public.attendance_breaks(attendance_id);
CREATE INDEX IF NOT EXISTS idx_attendance_breaks_user_id ON public.attendance_breaks(user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_breaks_user_date ON public.attendance_breaks(user_id, attendance_date);
CREATE INDEX IF NOT EXISTS idx_attendance_breaks_type ON public.attendance_breaks(type);

-- 4. Automatic updated_at trigger function
CREATE OR REPLACE FUNCTION public.handle_attendance_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_attendance_daily_updated_at ON public.attendance_daily;
CREATE TRIGGER trigger_attendance_daily_updated_at
    BEFORE UPDATE ON public.attendance_daily
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_attendance_updated_at();

DROP TRIGGER IF EXISTS trigger_attendance_breaks_updated_at ON public.attendance_breaks;
CREATE TRIGGER trigger_attendance_breaks_updated_at
    BEFORE UPDATE ON public.attendance_breaks
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_attendance_updated_at();

-- 5. Enable Row Level Security (RLS)
ALTER TABLE public.attendance_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_breaks ENABLE ROW LEVEL SECURITY;

-- Helper check for admin role
CREATE OR REPLACE FUNCTION public.is_admin_or_superadmin(user_id uuid)
RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = user_id AND role IN ('admin', 'superadmin')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS Policies: attendance_daily
DROP POLICY IF EXISTS "attendance_daily_select_all" ON public.attendance_daily;
CREATE POLICY "attendance_daily_select_all" ON public.attendance_daily
    FOR SELECT TO authenticated
    USING (true);

DROP POLICY IF EXISTS "attendance_daily_insert_own_or_admin" ON public.attendance_daily;
CREATE POLICY "attendance_daily_insert_own_or_admin" ON public.attendance_daily
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id OR public.is_admin_or_superadmin(auth.uid()));

DROP POLICY IF EXISTS "attendance_daily_update_own_or_admin" ON public.attendance_daily;
CREATE POLICY "attendance_daily_update_own_or_admin" ON public.attendance_daily
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id OR public.is_admin_or_superadmin(auth.uid()))
    WITH CHECK (auth.uid() = user_id OR public.is_admin_or_superadmin(auth.uid()));

DROP POLICY IF EXISTS "attendance_daily_delete_admin" ON public.attendance_daily;
CREATE POLICY "attendance_daily_delete_admin" ON public.attendance_daily
    FOR DELETE TO authenticated
    USING (public.is_admin_or_superadmin(auth.uid()));

-- RLS Policies: attendance_breaks
DROP POLICY IF EXISTS "attendance_breaks_select_all" ON public.attendance_breaks;
CREATE POLICY "attendance_breaks_select_all" ON public.attendance_breaks
    FOR SELECT TO authenticated
    USING (true);

DROP POLICY IF EXISTS "attendance_breaks_insert_own_or_admin" ON public.attendance_breaks;
CREATE POLICY "attendance_breaks_insert_own_or_admin" ON public.attendance_breaks
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id OR public.is_admin_or_superadmin(auth.uid()));

DROP POLICY IF EXISTS "attendance_breaks_update_own_or_admin" ON public.attendance_breaks;
CREATE POLICY "attendance_breaks_update_own_or_admin" ON public.attendance_breaks
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id OR public.is_admin_or_superadmin(auth.uid()))
    WITH CHECK (auth.uid() = user_id OR public.is_admin_or_superadmin(auth.uid()));

DROP POLICY IF EXISTS "attendance_breaks_delete_admin" ON public.attendance_breaks;
CREATE POLICY "attendance_breaks_delete_admin" ON public.attendance_breaks
    FOR DELETE TO authenticated
    USING (public.is_admin_or_superadmin(auth.uid()));

-- 6. Add to Realtime publication
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'attendance_daily'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_daily;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'attendance_breaks'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_breaks;
    END IF;
END $$;
