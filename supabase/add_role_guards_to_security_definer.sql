-- Migration: Add role guards to SECURITY DEFINER functions
-- Date: 2026-07-27
-- Issue: archive_and_prune_old_records and cleanup_old_audit_logs lack role checks,
--        allowing any authenticated user to invoke data-destructive operations.

-- Fix 1: archive_and_prune_old_records — restrict to service_role or admin
CREATE OR REPLACE FUNCTION "public"."archive_and_prune_old_records"("p_tz" "text" DEFAULT 'Asia/Dhaka'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_current_year INT := EXTRACT(YEAR FROM timezone(p_tz, now()))::INT;
  v_year INT;
  v_archived_users INT;
  v_deleted INT;
  v_total_deleted INT := 0;
  v_years_archived INT[] := '{}';
  v_purged INT;
BEGIN
  -- ROLE GUARD: Only service_role (cron jobs, system tasks) or admins may invoke this.
  IF auth.role() != 'service_role' AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Permission denied: only admins or service_role can archive and prune old records.';
  END IF;

  FOR v_year IN
    SELECT DISTINCT EXTRACT(YEAR FROM timezone(p_tz, r.submitted_at))::INT
    FROM public.records r
    WHERE EXTRACT(YEAR FROM timezone(p_tz, r.submitted_at))::INT < v_current_year - 2
    ORDER BY 1
  LOOP
    INSERT INTO public.leaderboard_archive
      (user_id, username, full_name, job_role, branch, year,
       quotes_count, requotes_count, reviews_count, sales_count,
       total_submitted, rank)
    WITH year_stats AS (
      SELECT
        r.user_id,
        COUNT(*)::INT AS total_submitted,
        COUNT(*) FILTER (WHERE r.file_type = 'Quote')::INT AS quotes_count,
        COUNT(*) FILTER (WHERE r.file_type IN ('Requote', 'Requote Van', 'Requote Bike'))::INT AS requotes_count,
        COUNT(*) FILTER (WHERE r.file_type LIKE '%Review%')::INT AS reviews_count,
        COUNT(*) FILTER (WHERE r.file_type = 'Sale')::INT AS sales_count
      FROM public.records r
      WHERE EXTRACT(YEAR FROM timezone(p_tz, r.submitted_at))::INT = v_year
      GROUP BY r.user_id
    ),
    user_branches AS (
      SELECT DISTINCT ON (b.user_id)
        b.user_id,
        b.branch_name
      FROM (
        SELECT
          r2.user_id,
          r2.branch_name,
          COUNT(*) AS branch_cnt,
          MAX(r2.submitted_at) AS branch_latest
        FROM public.records r2
        WHERE EXTRACT(YEAR FROM timezone(p_tz, r2.submitted_at))::INT = v_year
        GROUP BY r2.user_id, r2.branch_name
      ) b
      ORDER BY b.user_id, b.branch_cnt DESC, b.branch_latest DESC
    )
    SELECT
      ys.user_id,
      COALESCE(p.username, ys.user_id::text) AS username,
      p.full_name,
      p.job_role,
      ub.branch_name,
      v_year,
      ys.quotes_count,
      ys.requotes_count,
      ys.reviews_count,
      ys.sales_count,
      ys.total_submitted,
      DENSE_RANK() OVER (
        ORDER BY ys.total_submitted DESC, COALESCE(p.username, ys.user_id::text) ASC
      )::INT AS rank
    FROM year_stats ys
    LEFT JOIN public.profiles p ON p.id = ys.user_id
    LEFT JOIN user_branches ub ON ub.user_id = ys.user_id
    ON CONFLICT (username, year) DO UPDATE SET
      user_id = EXCLUDED.user_id,
      full_name = EXCLUDED.full_name,
      job_role = EXCLUDED.job_role,
      branch = EXCLUDED.branch,
      quotes_count = EXCLUDED.quotes_count,
      requotes_count = EXCLUDED.requotes_count,
      reviews_count = EXCLUDED.reviews_count,
      sales_count = EXCLUDED.sales_count,
      total_submitted = EXCLUDED.total_submitted,
      rank = EXCLUDED.rank,
      archived_at = timezone('utc'::text, now());

    GET DIAGNOSTICS v_archived_users = ROW_COUNT;

    DELETE FROM public.records r
    WHERE EXTRACT(YEAR FROM timezone(p_tz, r.submitted_at))::INT = v_year;
    GET DIAGNOSTICS v_deleted = ROW_COUNT;

    v_total_deleted := v_total_deleted + v_deleted;
    v_years_archived := v_years_archived || v_year;

    RAISE NOTICE 'Archived year %: % users snapshotted, % records deleted',
      v_year, v_archived_users, v_deleted;
  END LOOP;

  DELETE FROM public.leaderboard_archive WHERE year < v_current_year - 5;
  GET DIAGNOSTICS v_purged = ROW_COUNT;

  RETURN jsonb_build_object(
    'years_archived', to_jsonb(v_years_archived),
    'records_deleted', v_total_deleted,
    'archive_rows_purged', v_purged,
    'run_at', timezone('utc'::text, now())
  );
END;
$$;

-- Fix 2: cleanup_old_audit_logs — restrict to service_role or admin
CREATE OR REPLACE FUNCTION "public"."cleanup_old_audit_logs"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  -- ROLE GUARD: Only service_role (cron jobs) or admins may invoke this.
  IF auth.role() != 'service_role' AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Permission denied: only admins or service_role can clean up audit logs.';
  END IF;

  DELETE FROM public.audit_logs
  WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$;

-- Fix 3: Lock down ACL for cleanup_old_audit_logs (was wide open to anon/authenticated)
REVOKE ALL ON FUNCTION "public"."cleanup_old_audit_logs"() FROM PUBLIC;
REVOKE ALL ON FUNCTION "public"."cleanup_old_audit_logs"() FROM "anon";
REVOKE ALL ON FUNCTION "public"."cleanup_old_audit_logs"() FROM "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_old_audit_logs"() TO "service_role";
