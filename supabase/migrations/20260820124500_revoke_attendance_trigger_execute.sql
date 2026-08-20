-- Keep trigger helpers aligned with the hardened routine grant model.
REVOKE ALL ON FUNCTION public.handle_attendance_updated_at() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_attendance_updated_at() TO service_role;
