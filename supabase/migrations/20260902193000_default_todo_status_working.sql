-- Migration: Update default status for public.todos from 'Idle' to 'Working'
-- When new todos are inserted without specifying status, they automatically become 'Working'.

ALTER TABLE public.todos ALTER COLUMN status SET DEFAULT 'Working'::text;
