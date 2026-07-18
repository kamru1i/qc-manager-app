-- Migration: unique index to block duplicate record uploads
-- Date: 2026-07-18
--
-- Why: on 2026-07-18 07:03 UTC the quotes auto-restore path re-uploaded an
-- admin's entire IndexedDB cache into a NON-empty records table, creating
-- 4,200 exact duplicates (same user_id + file_name + submitted_at, created_at
-- preserved to the microsecond). Those rows were backed up to
-- supabase/backups/deleted_duplicate_records_2026-07-18.json and deleted.
--
-- This index makes Postgres itself reject any such re-upload: a genuine entry
-- can never legitimately share all three of user_id, file_name and
-- submitted_at (submitted_at carries second precision from the client).
-- Offline sync treats the resulting 23505 unique_violation as "already
-- synced" (see syncOfflineData in src/utils/quotesOfflineSync.ts).
--
-- Safety: additive only. Run AFTER the duplicate cleanup — CREATE UNIQUE
-- INDEX fails if duplicates still exist (verified 0 remaining on 2026-07-18).

CREATE UNIQUE INDEX IF NOT EXISTS uq_records_user_file_submitted
  ON public.records (user_id, file_name, submitted_at);
