-- Migration: 20260821170000_remove_attendance_module.sql
-- Description: Safely drop attendance tables, triggers, functions, and remove from realtime publication

-- 1. Remove tables from realtime publication if present
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'attendance_shifts'
    ) THEN
        ALTER PUBLICATION supabase_realtime DROP TABLE public.attendance_shifts;
    END IF;

    IF EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'attendance_breaks'
    ) THEN
        ALTER PUBLICATION supabase_realtime DROP TABLE public.attendance_breaks;
    END IF;

    IF EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'attendance_daily'
    ) THEN
        ALTER PUBLICATION supabase_realtime DROP TABLE public.attendance_daily;
    END IF;
END $$;

-- 2. Drop attendance tables with CASCADE to automatically drop dependent foreign keys, triggers, indexes, and RLS policies
DROP TABLE IF EXISTS public.attendance_shifts CASCADE;
DROP TABLE IF EXISTS public.attendance_breaks CASCADE;
DROP TABLE IF EXISTS public.attendance_daily CASCADE;

-- 3. Drop attendance-specific trigger function
DROP FUNCTION IF EXISTS public.handle_attendance_updated_at() CASCADE;
