-- Migration: Normalize legacy Requote variants to 'Requote' on all new records inserts
-- Preserves all existing historical records while guaranteeing database-level data integrity for new writes.

CREATE OR REPLACE FUNCTION public.trg_normalize_records_file_type()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.file_type IN ('Requote Van', 'Requote Bike') THEN
    NEW.file_type := 'Requote';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_records_normalize_file_type ON public.records;
CREATE TRIGGER trg_records_normalize_file_type
BEFORE INSERT ON public.records
FOR EACH ROW
EXECUTE FUNCTION public.trg_normalize_records_file_type();
