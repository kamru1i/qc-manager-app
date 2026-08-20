-- Migration: 20260820250000_attendance_cross_user_visibility_rls.sql
-- Description: Allow authenticated users to SELECT attendance records for live cross-user visibility
-- while maintaining strict write RLS policies (insert/update own or admin, delete admin only).

-- 1. attendance_daily
DROP POLICY IF EXISTS "attendance_daily_select_scoped" ON public.attendance_daily;
CREATE POLICY "attendance_daily_select_scoped" ON public.attendance_daily
    FOR SELECT TO authenticated
    USING (auth.uid() IS NOT NULL);

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

-- 2. attendance_shifts
DROP POLICY IF EXISTS "attendance_shifts_select_scoped" ON public.attendance_shifts;
CREATE POLICY "attendance_shifts_select_scoped" ON public.attendance_shifts
    FOR SELECT TO authenticated
    USING (auth.uid() IS NOT NULL);

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

-- 3. attendance_breaks
DROP POLICY IF EXISTS "attendance_breaks_select_scoped" ON public.attendance_breaks;
CREATE POLICY "attendance_breaks_select_scoped" ON public.attendance_breaks
    FOR SELECT TO authenticated
    USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "attendance_breaks_insert_own_or_admin" ON public.attendance_breaks;
CREATE POLICY "attendance_breaks_insert_own_or_admin" ON public.attendance_breaks
    FOR INSERT TO authenticated
    WITH CHECK (
        public.is_admin_or_superadmin(auth.uid())
        OR (
            auth.uid() = user_id
            AND EXISTS (
                SELECT 1
                FROM public.attendance_daily d
                WHERE d.id = attendance_id
                  AND d.user_id = attendance_breaks.user_id
                  AND d.attendance_date = attendance_breaks.attendance_date
            )
        )
    );

DROP POLICY IF EXISTS "attendance_breaks_update_own_or_admin" ON public.attendance_breaks;
CREATE POLICY "attendance_breaks_update_own_or_admin" ON public.attendance_breaks
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
                  AND d.user_id = attendance_breaks.user_id
                  AND d.attendance_date = attendance_breaks.attendance_date
            )
        )
    );

DROP POLICY IF EXISTS "attendance_breaks_delete_admin" ON public.attendance_breaks;
CREATE POLICY "attendance_breaks_delete_admin" ON public.attendance_breaks
    FOR DELETE TO authenticated
    USING (public.is_admin_or_superadmin(auth.uid()));

-- 4. Ensure publication membership for Realtime
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
        AND tablename = 'attendance_shifts'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_shifts;
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
