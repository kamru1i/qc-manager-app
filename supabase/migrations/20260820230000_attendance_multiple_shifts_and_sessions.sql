-- Migration: 20260820230000_attendance_multiple_shifts_and_sessions.sql
-- Description: Add attendance_shifts table for multi-shift tracking per day, auto-close breaks, and link with Realtime

-- 1. Create attendance_shifts table
CREATE TABLE IF NOT EXISTS public.attendance_shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attendance_id UUID NOT NULL REFERENCES public.attendance_daily(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    attendance_date DATE NOT NULL,
    join_time TIMESTAMPTZ NOT NULL,
    close_time TIMESTAMPTZ,
    duration_seconds NUMERIC(10, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Add shift_id column to attendance_breaks for optional explicit shift association
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'attendance_breaks' 
        AND column_name = 'shift_id'
    ) THEN
        ALTER TABLE public.attendance_breaks ADD COLUMN shift_id UUID REFERENCES public.attendance_shifts(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_attendance_shifts_attendance_id ON public.attendance_shifts(attendance_id);
CREATE INDEX IF NOT EXISTS idx_attendance_shifts_user_id ON public.attendance_shifts(user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_shifts_user_date ON public.attendance_shifts(user_id, attendance_date);
CREATE INDEX IF NOT EXISTS idx_attendance_shifts_join_time ON public.attendance_shifts(join_time DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_breaks_shift_id ON public.attendance_breaks(shift_id);

-- 4. Updated_at Trigger for attendance_shifts
DROP TRIGGER IF EXISTS trigger_attendance_shifts_updated_at ON public.attendance_shifts;
CREATE TRIGGER trigger_attendance_shifts_updated_at
    BEFORE UPDATE ON public.attendance_shifts
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_attendance_updated_at();

-- 5. Row Level Security (RLS) for attendance_shifts
ALTER TABLE public.attendance_shifts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "attendance_shifts_select_scoped" ON public.attendance_shifts;
CREATE POLICY "attendance_shifts_select_scoped" ON public.attendance_shifts
    FOR SELECT TO authenticated
    USING (
        auth.uid() = user_id
        OR public.is_admin_or_superadmin(auth.uid())
        OR public.has_leave_access(auth.uid(), user_id)
    );

DROP POLICY IF EXISTS "attendance_shifts_insert_own_or_admin" ON public.attendance_shifts;
CREATE POLICY "attendance_shifts_insert_own_or_admin" ON public.attendance_shifts
    FOR INSERT TO authenticated
    WITH CHECK (
        public.is_admin_or_superadmin(auth.uid())
        OR (
            auth.uid() = user_id
            AND EXISTS (
                SELECT 1
                FROM public.attendance_daily d
                WHERE d.id = attendance_id
                  AND d.user_id = attendance_shifts.user_id
                  AND d.attendance_date = attendance_shifts.attendance_date
            )
        )
    );

DROP POLICY IF EXISTS "attendance_shifts_update_own_or_admin" ON public.attendance_shifts;
CREATE POLICY "attendance_shifts_update_own_or_admin" ON public.attendance_shifts
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id OR public.is_admin_or_superadmin(auth.uid()))
    WITH CHECK (
        public.is_admin_or_superadmin(auth.uid())
        OR (
            auth.uid() = user_id
            AND EXISTS (
                SELECT 1
                FROM public.attendance_daily d
                WHERE d.id = attendance_id
                  AND d.user_id = attendance_shifts.user_id
                  AND d.attendance_date = attendance_shifts.attendance_date
            )
        )
    );

DROP POLICY IF EXISTS "attendance_shifts_delete_admin" ON public.attendance_shifts;
CREATE POLICY "attendance_shifts_delete_admin" ON public.attendance_shifts
    FOR DELETE TO authenticated
    USING (public.is_admin_or_superadmin(auth.uid()));

-- 6. Add attendance_shifts to Realtime publication
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'attendance_shifts'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_shifts;
    END IF;
END $$;

-- 7. Data Backfill: Migrate any existing attendance_daily records with join_time into attendance_shifts
INSERT INTO public.attendance_shifts (attendance_id, user_id, attendance_date, join_time, close_time, duration_seconds, created_at, updated_at)
SELECT
    d.id,
    d.user_id,
    d.attendance_date,
    d.join_time,
    d.close_time,
    COALESCE(d.total_work_minutes * 60, 0),
    d.created_at,
    d.updated_at
FROM public.attendance_daily d
WHERE d.join_time IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM public.attendance_shifts s WHERE s.attendance_id = d.id
  );
