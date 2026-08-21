-- Drop the unique index to allow multiple short leaves or same-day leave entries
DROP INDEX IF EXISTS public.unique_user_date;

-- Recreate as a regular (non-unique) index for performance
CREATE INDEX IF NOT EXISTS idx_chuti_user_date ON public.chuti USING btree (user_id, date) WHERE (deleted_at IS NULL);
