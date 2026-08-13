-- Migration to add 'Early Leave' to the leave_type check constraint in the chuti table

BEGIN;

ALTER TABLE public.chuti 
DROP CONSTRAINT IF EXISTS chuti_leave_type_check;

ALTER TABLE public.chuti 
ADD CONSTRAINT chuti_leave_type_check 
CHECK (leave_type IN ('Short Leave', 'Early Leave', 'Full Leave', 'Overtime'));

COMMIT;
