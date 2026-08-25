--
-- PostgreSQL database dump
--
-- NOTE: This file is a REFERENCE SNAPSHOT, not the live source of truth.
-- The authoritative schema is the live Supabase database.
-- Attendance module tables (attendance_daily, attendance_breaks) were removed
-- from this snapshot on 2026-08-25 to match migration 20260821170000.
-- To regenerate from live DB: supabase db dump --linked -f supabase/schema.sql
--

\restrict KGgVatirYb3Y1Kz2ZWJ2YZ67B8HHFQkXzCDO3DNWRWxLMSHyKrnizOtueEfnchb

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';

--
-- Name: admin_insert_chuti_records_bulk(uuid, date[], text, boolean[], boolean, time without time zone, time without time zone, interval, text, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_insert_chuti_records_bulk(p_user_id uuid, p_dates date[], p_leave_type text, p_adjustments boolean[], p_adjust_short_leave boolean, p_sign_in_time time without time zone DEFAULT NULL::time without time zone, p_sign_out_time time without time zone DEFAULT NULL::time without time zone, p_leave_hour interval DEFAULT NULL::interval, p_reserve_holiday text DEFAULT NULL::text, p_comment text DEFAULT NULL::text, p_bulk_id uuid DEFAULT NULL::uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF NOT public.current_user_has_workspace('chuti') THEN
    RAISE EXCEPTION 'Leave workspace access is disabled.';
  END IF;
  PERFORM public.admin_insert_chuti_records_bulk_internal(
    p_user_id, p_dates, p_leave_type, p_adjustments, p_adjust_short_leave,
    p_sign_in_time, p_sign_out_time, p_leave_hour, p_reserve_holiday,
    p_comment, p_bulk_id
  );
END;
$$;

--
-- Name: admin_insert_chuti_records_bulk_internal(uuid, date[], text, boolean[], boolean, time without time zone, time without time zone, interval, text, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_insert_chuti_records_bulk_internal(p_user_id uuid, p_dates date[], p_leave_type text, p_adjustments boolean[], p_adjust_short_leave boolean, p_sign_in_time time without time zone DEFAULT NULL::time without time zone, p_sign_out_time time without time zone DEFAULT NULL::time without time zone, p_leave_hour interval DEFAULT NULL::interval, p_reserve_holiday text DEFAULT NULL::text, p_comment text DEFAULT NULL::text, p_bulk_id uuid DEFAULT NULL::uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_date DATE;
  v_idx INT := 1;
  v_adjustment BOOLEAN;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can insert chuti records for other users';
  END IF;

  FOREACH v_date IN ARRAY p_dates LOOP
    v_adjustment := p_adjustments[v_idx];
    INSERT INTO public.chuti (
      user_id,
      date,
      leave_type,
      adjustment,
      adjust_short_leave,
      sign_in_time,
      sign_out_time,
      leave_hour,
      reserve_holiday,
      reserve_adjustment_status,
      status,
      comment,
      bulk_id
    )
    VALUES (
      p_user_id,
      v_date,
      p_leave_type,
      v_adjustment,
      CASE WHEN p_leave_type = 'Overtime' AND v_adjustment THEN p_adjust_short_leave ELSE false END,
      p_sign_in_time,
      p_sign_out_time,
      p_leave_hour,
      p_reserve_holiday,
      'none'::TEXT,
      'approved', -- Admin added records are auto-approved
      p_comment,
      p_bulk_id
    );
    v_idx := v_idx + 1;
  END LOOP;
END;
$$;

--
-- Name: admin_update_user_credentials(uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_update_user_credentials(p_user_id uuid, p_new_username text DEFAULT NULL::text, p_new_password text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions', 'pg_temp'
    AS $_$
DECLARE
  v_actor_role text;
  v_target_role text;
  v_clean_username text;
  v_current_email text;
  v_email_domain text;
BEGIN
  SELECT role INTO v_actor_role FROM public.profiles WHERE id = auth.uid();
  SELECT role INTO v_target_role FROM public.profiles WHERE id = p_user_id FOR UPDATE;

  IF v_target_role IS NULL THEN
    RAISE EXCEPTION 'Target user not found.';
  END IF;

  IF v_actor_role = 'superadmin' THEN
    NULL;
  ELSIF v_actor_role = 'admin' AND v_target_role IN ('user', 'supervisor') THEN
    NULL;
  ELSIF v_actor_role = 'supervisor'
        AND v_target_role = 'user'
        AND public.has_leave_access(auth.uid(), p_user_id) THEN
    NULL;
  ELSE
    RAISE EXCEPTION 'Permission denied for this target account.';
  END IF;

  IF p_new_username IS NOT NULL AND btrim(p_new_username) <> '' THEN
    v_clean_username := upper(btrim(p_new_username));
    IF v_clean_username !~ '^[A-Z0-9._-]{2,50}$' THEN
      RAISE EXCEPTION 'Codename must be 2-50 characters using letters, numbers, dot, underscore, or hyphen.';
    END IF;

    SELECT email INTO v_current_email FROM auth.users WHERE id = p_user_id;
    v_email_domain := CASE
      WHEN position('@' IN COALESCE(v_current_email, '')) > 0
        THEN split_part(v_current_email, '@', 2)
      WHEN v_target_role IN ('admin', 'superadmin') THEN 'admin.local'
      WHEN v_target_role = 'supervisor' THEN 'supervisor.local'
      ELSE 'user.local'
    END;

    PERFORM set_config('app.bypass_profile_security', 'true', true);
    UPDATE public.profiles SET username = v_clean_username WHERE id = p_user_id;
    UPDATE public.records SET codename = v_clean_username WHERE user_id = p_user_id AND codename IS DISTINCT FROM v_clean_username;
    UPDATE public.todos SET codename = v_clean_username WHERE user_id = p_user_id AND codename IS DISTINCT FROM v_clean_username;
    UPDATE public.quotation_mistakes SET codename = v_clean_username WHERE user_id = p_user_id AND codename IS DISTINCT FROM v_clean_username;
    UPDATE auth.users
    SET email = lower(v_clean_username) || '@' || v_email_domain,
        raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('username', v_clean_username),
        updated_at = now()
    WHERE id = p_user_id;
  END IF;

  IF p_new_password IS NOT NULL AND p_new_password <> '' THEN
    IF length(p_new_password) < 6 OR length(p_new_password) > 72 THEN
      RAISE EXCEPTION 'Password must be between 6 and 72 characters.';
    END IF;
    UPDATE auth.users
    SET encrypted_password = crypt(p_new_password, gen_salt('bf')),
        updated_at = now()
    WHERE id = p_user_id;

    PERFORM set_config('app.bypass_profile_security', 'true', true);
    UPDATE public.profiles
    SET has_changed_password = p_new_password <> '1234',
        is_setup_completed = CASE
          WHEN p_new_password = '1234' THEN false
          ELSE true
        END,
        global_settings = jsonb_set(
          COALESCE(global_settings, '{}'::jsonb),
          '{password_reset_status}',
          '"none"'::jsonb,
          true
        )
    WHERE id = p_user_id;
  END IF;

  INSERT INTO public.audit_logs (
    actor_id, actor_codename, action_type, target_id, target_user_id, details, metadata
  )
  SELECT auth.uid(), a.username, 'UPDATE_CREDENTIALS', p_user_id::text, p_user_id,
         'User credentials updated',
         jsonb_build_object(
           'username_changed', p_new_username IS NOT NULL AND btrim(p_new_username) <> '',
           'password_changed', p_new_password IS NOT NULL AND p_new_password <> ''
         )
  FROM public.profiles a
  WHERE a.id = auth.uid();
END;
$_$;

--
-- Name: archive_and_prune_old_records(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.archive_and_prune_old_records(p_tz text DEFAULT 'Asia/Dhaka'::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_current_year INT := EXTRACT(YEAR FROM timezone(p_tz, now()))::INT;
  v_year INT;
  v_archived_users INT := 0;
  v_total_deleted INT := 0;
  v_years_archived INT[] := ARRAY[]::INT[];
  v_purged INT;
BEGIN
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
        COUNT(*) FILTER (WHERE r.file_type != 'Other Site')::INT AS total_submitted,
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
      DENSE_RANK() OVER (ORDER BY ys.total_submitted DESC, COALESCE(p.username, ys.user_id::text) ASC)::INT AS rank
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
    v_years_archived := array_append(v_years_archived, v_year);
  END LOOP;

  DELETE FROM public.records r
  WHERE EXTRACT(YEAR FROM timezone(p_tz, r.submitted_at))::INT < v_current_year - 2;
  GET DIAGNOSTICS v_total_deleted = ROW_COUNT;

  DELETE FROM public.audit_logs al
  WHERE EXTRACT(YEAR FROM timezone(p_tz, al.created_at))::INT < v_current_year - 2;
  GET DIAGNOSTICS v_purged = ROW_COUNT;

  RETURN jsonb_build_object(
    'status', 'success',
    'years_archived', v_years_archived,
    'records_deleted', v_total_deleted,
    'audit_logs_purged', v_purged,
    'archive_rows_upserted', v_archived_users
  );
END;
$$;

--
-- Name: audit_business_row_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.audit_business_row_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_actor_codename text;
  v_action text;
  v_target_id text;
  v_target_user_id uuid;
  v_details text;
  v_metadata jsonb := '{}'::jsonb;
BEGIN
  SELECT p.username INTO v_actor_codename
  FROM public.profiles p
  WHERE p.id = v_actor_id;

  v_actor_codename := COALESCE(v_actor_codename, auth.role(), session_user, 'System');

  IF TG_TABLE_NAME = 'chuti' THEN
    v_target_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.id::text ELSE NEW.id::text END;
    v_target_user_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.user_id ELSE NEW.user_id END;

    IF TG_OP = 'INSERT' THEN
      v_action := CASE WHEN NEW.adjustment IS TRUE THEN 'ADJUST_LEAVE' ELSE 'CREATE_LEAVE' END;
      v_details := CASE WHEN NEW.adjustment IS TRUE THEN 'Leave adjustment created' ELSE 'Leave record created' END;
      v_metadata := jsonb_build_object(
        'date', NEW.date,
        'leave_type', NEW.leave_type,
        'status', NEW.status,
        'adjustment', NEW.adjustment,
        'bulk_id', NEW.bulk_id
      );
    ELSIF TG_OP = 'DELETE' OR (OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL) THEN
      v_action := 'DELETE_LEAVE';
      v_details := 'Leave record deleted';
      v_metadata := jsonb_build_object(
        'date', CASE WHEN TG_OP = 'DELETE' THEN OLD.date ELSE NEW.date END,
        'leave_type', CASE WHEN TG_OP = 'DELETE' THEN OLD.leave_type ELSE NEW.leave_type END,
        'soft_delete', TG_OP <> 'DELETE'
      );
    ELSIF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('approved', 'approved_by_supervisor') THEN
      v_action := 'APPROVE_LEAVE';
      v_details := 'Leave request approved';
      v_metadata := jsonb_build_object('date', NEW.date, 'from_status', OLD.status, 'to_status', NEW.status);
    ELSIF NEW.status IS DISTINCT FROM OLD.status AND NEW.status = 'needs_review' THEN
      v_action := 'REJECT_LEAVE';
      v_details := 'Leave request returned for revision';
      v_metadata := jsonb_build_object('date', NEW.date, 'from_status', OLD.status, 'to_status', NEW.status);
    ELSIF NEW.adjustment IS DISTINCT FROM OLD.adjustment
       OR NEW.adjusted_hour IS DISTINCT FROM OLD.adjusted_hour
       OR NEW.adjust_short_leave IS DISTINCT FROM OLD.adjust_short_leave
       OR NEW.reserve_holiday IS DISTINCT FROM OLD.reserve_holiday
       OR NEW.reserve_adjustment_status IS DISTINCT FROM OLD.reserve_adjustment_status THEN
      v_action := 'ADJUST_LEAVE';
      v_details := 'Leave adjustment changed';
      v_metadata := jsonb_build_object(
        'date', NEW.date,
        'adjustment', NEW.adjustment,
        'reserve_holiday', NEW.reserve_holiday,
        'reserve_adjustment_status', NEW.reserve_adjustment_status
      );
    ELSE
      v_action := 'UPDATE_LEAVE';
      v_details := 'Leave record updated';
      v_metadata := jsonb_build_object(
        'old_date', OLD.date,
        'new_date', NEW.date,
        'old_leave_type', OLD.leave_type,
        'new_leave_type', NEW.leave_type
      );
    END IF;
  ELSIF TG_TABLE_NAME = 'quotation_mistakes' THEN
    v_target_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.id::text ELSE NEW.id::text END;
    v_target_user_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.user_id ELSE NEW.user_id END;
    v_action := CASE TG_OP
      WHEN 'INSERT' THEN 'CREATE_MISTAKE'
      WHEN 'UPDATE' THEN 'UPDATE_MISTAKE'
      ELSE 'DELETE_MISTAKE'
    END;
    v_details := CASE TG_OP
      WHEN 'INSERT' THEN 'Quotation mistake created'
      WHEN 'UPDATE' THEN 'Quotation mistake updated'
      ELSE 'Quotation mistake deleted'
    END;
    v_metadata := CASE WHEN TG_OP = 'DELETE'
      THEN jsonb_build_object('date', OLD.date, 'filename', OLD.filename, 'branch', OLD.branch)
      ELSE jsonb_build_object('date', NEW.date, 'filename', NEW.filename, 'branch', NEW.branch)
    END;
  ELSIF TG_TABLE_NAME = 'govt_holiday_responses' THEN
    v_target_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.id::text ELSE NEW.id::text END;
    v_target_user_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.user_id ELSE NEW.user_id END;
    v_action := 'ADJUST_LEAVE';
    v_details := CASE TG_OP
      WHEN 'INSERT' THEN 'Government holiday entitlement initialized'
      WHEN 'UPDATE' THEN 'Government holiday entitlement changed'
      ELSE 'Government holiday entitlement removed'
    END;
    v_metadata := CASE WHEN TG_OP = 'DELETE'
      THEN jsonb_build_object('holiday_date', OLD.holiday_date, 'holiday_name', OLD.holiday_name, 'old_response', OLD.response)
      ELSE jsonb_build_object(
        'holiday_date', NEW.holiday_date,
        'holiday_name', NEW.holiday_name,
        'old_response', CASE WHEN TG_OP = 'UPDATE' THEN OLD.response ELSE NULL END,
        'new_response', NEW.response,
        'updated_by_admin', NEW.updated_by_admin
      )
    END;
  ELSIF TG_TABLE_NAME = 'leave_settlements' THEN
    v_target_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.id::text ELSE NEW.id::text END;
    v_target_user_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.user_id ELSE NEW.user_id END;
    v_action := 'SETTLE_LEAVE';
    v_details := CASE TG_OP
      WHEN 'INSERT' THEN 'Leave settlement created'
      WHEN 'UPDATE' THEN 'Leave settlement updated'
      ELSE 'Leave settlement deleted'
    END;
    v_metadata := CASE WHEN TG_OP = 'DELETE'
      THEN jsonb_build_object('year', OLD.year, 'period', OLD.period, 'category', OLD.leave_category, 'status', OLD.status)
      ELSE jsonb_build_object(
        'year', NEW.year,
        'period', NEW.period,
        'category', NEW.leave_category,
        'old_status', CASE WHEN TG_OP = 'UPDATE' THEN OLD.status ELSE NULL END,
        'new_status', NEW.status,
        'action_type', NEW.action_type
      )
    END;
  ELSE
    RAISE EXCEPTION 'Unsupported audited table: %', TG_TABLE_NAME;
  END IF;

  INSERT INTO public.audit_logs (
    actor_id,
    actor_codename,
    action_type,
    target_id,
    target_user_id,
    details,
    metadata
  ) VALUES (
    v_actor_id,
    v_actor_codename,
    v_action,
    v_target_id,
    v_target_user_id,
    v_details,
    v_metadata
  );

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

--
-- Name: can_read_profile(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_read_profile(p_target_id uuid) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_actor_role text;
  v_supervisor_ids uuid[];
BEGIN
  IF p_target_id = auth.uid() THEN RETURN true; END IF;

  SELECT role, supervisor_ids
  INTO v_actor_role, v_supervisor_ids
  FROM public.profiles
  WHERE id = auth.uid();

  IF v_actor_role IN ('admin', 'superadmin', 'supervisor') THEN
    RETURN true;
  END IF;

  IF v_actor_role = 'user' THEN
    IF p_target_id = ANY(COALESCE(v_supervisor_ids, ARRAY[]::uuid[])) THEN
      RETURN true;
    END IF;
    RETURN EXISTS (
      SELECT 1
      FROM public.profiles supervisor
      WHERE supervisor.id = ANY(COALESCE(v_supervisor_ids, ARRAY[]::uuid[]))
        AND supervisor.delegated_supervisor_id = p_target_id
    );
  END IF;

  RETURN false;
END;
$$;

--
-- Name: can_write_quotation_mistakes(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_write_quotation_mistakes() RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_entry jsonb;
  v_now timestamptz := now();
  v_flag jsonb;
BEGIN
  SELECT * INTO v_profile FROM public.profiles WHERE id = auth.uid();
  IF NOT FOUND THEN RETURN false; END IF;
  IF v_profile.role = 'superadmin' THEN RETURN true; END IF;
  IF v_profile.role NOT IN ('admin', 'supervisor') THEN RETURN false; END IF;

  FOR v_entry IN
    SELECT value
    FROM jsonb_array_elements(
      CASE WHEN jsonb_typeof(v_profile.global_settings->'temp_access') = 'array'
        THEN v_profile.global_settings->'temp_access' ELSE '[]'::jsonb END
    )
  LOOP
    IF v_entry->>'target_type' = 'user'
       AND (v_entry->>'user_id' = v_profile.id::text
            OR upper(COALESCE(v_entry->>'user_codename', '')) = upper(v_profile.username))
       AND v_entry->>'tabKey' = 'quote_mistakes_write'
       AND COALESCE(v_entry->>'expires_at', '') <> ''
       AND (v_entry->>'expires_at')::timestamptz > v_now THEN
      RETURN v_entry->>'action' = 'grant';
    END IF;
  END LOOP;

  FOR v_entry IN
    SELECT value
    FROM jsonb_array_elements(
      CASE WHEN jsonb_typeof(v_profile.global_settings->'temp_access') = 'array'
        THEN v_profile.global_settings->'temp_access' ELSE '[]'::jsonb END
    )
  LOOP
    IF COALESCE(v_entry->>'target_type', 'role') = 'role'
       AND v_entry->>'role' = v_profile.role
       AND v_entry->>'tabKey' = 'quote_mistakes_write'
       AND COALESCE(v_entry->>'expires_at', '') <> ''
       AND (v_entry->>'expires_at')::timestamptz > v_now THEN
      RETURN v_entry->>'action' = 'grant';
    END IF;
  END LOOP;

  v_flag := v_profile.global_settings->'user_feature_flags'->'quote_mistakes_write';
  IF jsonb_typeof(v_flag) = 'boolean' THEN RETURN (v_flag #>> '{}')::boolean; END IF;

  v_flag := v_profile.global_settings->'feature_flags'->'quote_mistakes_write';
  IF jsonb_typeof(v_flag) = 'boolean' THEN RETURN (v_flag #>> '{}')::boolean; END IF;

  RETURN true;
EXCEPTION WHEN invalid_datetime_format THEN
  RETURN false;
END;
$$;

--
-- Name: change_default_password(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.change_default_password(p_new_password text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_has_changed boolean;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Not authenticated.');
  END IF;
  IF p_new_password IS NULL OR length(p_new_password) < 6 OR length(p_new_password) > 72 OR p_new_password = '1234' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Choose a non-default password between 6 and 72 characters.');
  END IF;

  SELECT has_changed_password INTO v_has_changed
  FROM public.profiles
  WHERE id = v_uid
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Profile not found.');
  END IF;
  IF v_has_changed IS TRUE THEN
    RETURN jsonb_build_object('success', false, 'message', 'The default password has already been changed.');
  END IF;
  IF EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = v_uid
      AND u.encrypted_password = crypt(p_new_password, u.encrypted_password)
  ) THEN
    RETURN jsonb_build_object('success', false, 'message', 'New password must differ from the current password.');
  END IF;

  UPDATE auth.users
  SET encrypted_password = crypt(p_new_password, gen_salt('bf')),
      updated_at = now()
  WHERE id = v_uid;

  PERFORM set_config('app.bypass_profile_security', 'true', true);
  UPDATE public.profiles
  SET has_changed_password = true
  WHERE id = v_uid;

  RETURN jsonb_build_object(
    'success', true,
    'profile', (SELECT to_jsonb(p) FROM public.profiles p WHERE p.id = v_uid)
  );
END;
$$;

--
-- Name: check_profile_role_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_profile_role_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_actor_role text;
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF OLD.role IS DISTINCT FROM NEW.role THEN
    IF auth.uid() = OLD.id THEN
      v_actor_role := OLD.role;
    ELSE
      SELECT role INTO v_actor_role
      FROM public.profiles
      WHERE id = auth.uid();
    END IF;

    IF v_actor_role NOT IN ('admin', 'superadmin') THEN
      RAISE EXCEPTION 'You are not allowed to change your role.';
    END IF;

    IF (NEW.role IN ('admin', 'superadmin') OR OLD.role IN ('admin', 'superadmin'))
       AND v_actor_role <> 'superadmin' THEN
      RAISE EXCEPTION 'Only a superadmin can create, promote, or demote admin/superadmin accounts.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

--
-- Name: check_profile_updates(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_profile_updates() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_actor_role text;
  v_safe_global_keys text[] := ARRAY[
    'active_sessions',
    'hidden_tabs',
    'kpi_skills',
    'kpi_dept_indicators',
    'kpi_other_dept_indicators',
    'performs_data_entry',
    'department',
    'performs_other_dept_tasks',
    'other_department'
  ];
  v_admin_global_keys text[] := ARRAY[
    'active_sessions',
    'hidden_tabs',
    'kpi_skills',
    'kpi_dept_indicators',
    'kpi_other_dept_indicators',
    'performs_data_entry',
    'department',
    'performs_other_dept_tasks',
    'other_department',
    'user_feature_flags',
    'emp_id',
    'date_of_joining'
  ];
BEGIN
  IF current_setting('app.bypass_profile_security', true) = 'true'
     OR auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF OLD.id = auth.uid() THEN
    v_actor_role := OLD.role;
  ELSE
    SELECT p.role INTO v_actor_role
    FROM public.profiles p
    WHERE p.id = auth.uid();
  END IF;

  IF v_actor_role = 'superadmin' THEN
    RETURN NEW;
  END IF;

  IF v_actor_role = 'admin' THEN
    IF OLD.role = 'superadmin' OR (OLD.role = 'admin' AND OLD.id <> auth.uid()) THEN
      RAISE EXCEPTION 'Admins cannot modify other admin or superadmin profiles.';
    END IF;

    IF (COALESCE(NEW.global_settings, '{}'::jsonb) - v_admin_global_keys)
       IS DISTINCT FROM
       (COALESCE(OLD.global_settings, '{}'::jsonb) - v_admin_global_keys) THEN
      RAISE EXCEPTION 'Global access, feature, leave, VPN, and system settings must be changed through their authorized settings RPC.';
    END IF;

    RETURN NEW;
  END IF;

  IF v_actor_role = 'supervisor' THEN
    IF NEW.id = auth.uid() THEN
      IF (to_jsonb(NEW) - ARRAY[
        'full_name', 'working_hours', 'break_time', 'job_role',
        'default_sign_in', 'default_sign_out', 'requested_full_name',
        'requested_working_hours', 'requested_break_time', 'requested_job_role',
        'requested_default_sign_in', 'requested_default_sign_out',
        'profile_change_status', 'has_edited_profile', 'global_settings'
      ]) IS DISTINCT FROM
      (to_jsonb(OLD) - ARRAY[
        'full_name', 'working_hours', 'break_time', 'job_role',
        'default_sign_in', 'default_sign_out', 'requested_full_name',
        'requested_working_hours', 'requested_break_time', 'requested_job_role',
        'requested_default_sign_in', 'requested_default_sign_out',
        'profile_change_status', 'has_edited_profile', 'global_settings'
      ]) THEN
        RAISE EXCEPTION 'Supervisors cannot change their own role, permissions, quotas, or delegation.';
      END IF;
    ELSIF public.has_leave_access(auth.uid(), NEW.id) THEN
      IF OLD.role IN ('admin', 'superadmin', 'supervisor') THEN
        RAISE EXCEPTION 'Supervisors can only manage assigned user profiles.';
      END IF;
      IF (to_jsonb(NEW) - ARRAY[
        'allowed_types', 'break_time', 'default_sign_in', 'default_sign_out',
        'global_settings'
      ]) IS DISTINCT FROM
      (to_jsonb(OLD) - ARRAY[
        'allowed_types', 'break_time', 'default_sign_in', 'default_sign_out',
        'global_settings'
      ]) THEN
        RAISE EXCEPTION 'Supervisors may only change assigned users'' quote types, break/default times, and non-privileged performance settings.';
      END IF;
    ELSE
      RAISE EXCEPTION 'Supervisors may only modify their own or assigned user profiles.';
    END IF;

    IF (COALESCE(NEW.global_settings, '{}'::jsonb) - v_safe_global_keys)
       IS DISTINCT FROM
       (COALESCE(OLD.global_settings, '{}'::jsonb) - v_safe_global_keys) THEN
      RAISE EXCEPTION 'Supervisors cannot modify privileged global settings.';
    END IF;

    RETURN NEW;
  END IF;

  IF v_actor_role = 'user' AND NEW.id = auth.uid() THEN
    IF (to_jsonb(NEW) - ARRAY[
      'username', 'full_name', 'working_hours', 'break_time', 'job_role',
      'default_sign_in', 'default_sign_out', 'requested_full_name',
      'requested_working_hours', 'requested_break_time', 'requested_job_role',
      'requested_default_sign_in', 'requested_default_sign_out',
      'profile_change_status', 'has_edited_profile',
      'global_settings'
    ]) IS DISTINCT FROM
    (to_jsonb(OLD) - ARRAY[
      'username', 'full_name', 'working_hours', 'break_time', 'job_role',
      'default_sign_in', 'default_sign_out', 'requested_full_name',
      'requested_working_hours', 'requested_break_time', 'requested_job_role',
      'requested_default_sign_in', 'requested_default_sign_out',
      'profile_change_status', 'has_edited_profile',
      'global_settings'
    ]) THEN
      RAISE EXCEPTION 'Users cannot modify roles, permissions, quotas, or supervisor assignments.';
    END IF;

    IF NEW.username IS DISTINCT FROM OLD.username AND OLD.has_changed_password IS TRUE THEN
      RAISE EXCEPTION 'Codename changes after onboarding require an authorized administrator.';
    END IF;

    IF (COALESCE(NEW.global_settings, '{}'::jsonb) - v_safe_global_keys)
       IS DISTINCT FROM
       (COALESCE(OLD.global_settings, '{}'::jsonb) - v_safe_global_keys) THEN
      RAISE EXCEPTION 'Users cannot modify privileged global settings.';
    END IF;

    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Unauthorized profile modification.';
END;
$$;

--
-- Name: complete_leave_profile_setup(text, numeric, integer, text, time without time zone, time without time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.complete_leave_profile_setup(p_full_name text, p_working_hours numeric, p_break_time integer, p_job_role text, p_default_sign_in time without time zone, p_default_sign_out time without time zone) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_has_changed boolean;
  v_is_complete boolean;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Not authenticated.');
  END IF;
  IF p_full_name IS NULL OR length(btrim(p_full_name)) < 2 OR length(btrim(p_full_name)) > 100 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Full name must be between 2 and 100 characters.');
  END IF;
  IF p_working_hours IS NULL OR p_working_hours <= 0 OR p_working_hours > 24
     OR p_break_time IS NULL OR p_break_time < 0 OR p_break_time > 24 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invalid working-hours or break-time value.');
  END IF;
  IF p_default_sign_in IS NULL OR p_default_sign_out IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Default sign-in and sign-out times are required.');
  END IF;

  SELECT has_changed_password, COALESCE(is_setup_completed, false)
  INTO v_has_changed, v_is_complete
  FROM public.profiles
  WHERE id = v_uid
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Profile not found.');
  END IF;
  IF v_has_changed IS NOT TRUE THEN
    RETURN jsonb_build_object('success', false, 'message', 'Change the default password before completing the profile.');
  END IF;
  IF v_is_complete IS TRUE THEN
    RETURN jsonb_build_object('success', false, 'message', 'Profile setup is already complete.');
  END IF;

  PERFORM set_config('app.bypass_profile_security', 'true', true);
  UPDATE public.profiles
  SET full_name = btrim(p_full_name),
      working_hours = p_working_hours,
      break_time = p_break_time,
      job_role = NULLIF(btrim(p_job_role), ''),
      default_sign_in = p_default_sign_in,
      default_sign_out = p_default_sign_out,
      is_setup_completed = true,
      has_edited_profile = true
  WHERE id = v_uid;

  RETURN jsonb_build_object(
    'success', true,
    'profile', (SELECT to_jsonb(p) FROM public.profiles p WHERE p.id = v_uid)
  );
END;
$$;

--
-- Name: complete_profile_setup(text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.complete_profile_setup(p_username text, p_full_name text, p_new_password text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions', 'pg_temp'
    AS $_$
DECLARE
  v_uid uuid := auth.uid();
  v_already_complete boolean;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Not authenticated.');
  END IF;
  IF p_username IS NULL OR upper(btrim(p_username)) !~ '^[A-Z0-9._-]{2,50}$' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Codename must be 2-50 characters using letters, numbers, dot, underscore, or hyphen.');
  END IF;
  IF p_full_name IS NULL OR length(btrim(p_full_name)) < 2 OR length(btrim(p_full_name)) > 100 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Full name must be between 2 and 100 characters.');
  END IF;
  IF p_new_password IS NULL OR length(p_new_password) < 6 OR length(p_new_password) > 72 OR p_new_password = '1234' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Choose a non-default password between 6 and 72 characters.');
  END IF;

  SELECT has_changed_password INTO v_already_complete
  FROM public.profiles WHERE id = v_uid FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Profile not found.');
  END IF;
  IF v_already_complete IS TRUE THEN
    RETURN jsonb_build_object('success', false, 'message', 'Profile setup is already complete.');
  END IF;

  IF EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = v_uid
      AND u.encrypted_password = crypt(p_new_password, u.encrypted_password)
  ) THEN
    RETURN jsonb_build_object('success', false, 'message', 'New password must differ from the current password.');
  END IF;

  BEGIN
    UPDATE auth.users
    SET encrypted_password = crypt(p_new_password, gen_salt('bf')),
        updated_at = now()
    WHERE id = v_uid;

    UPDATE public.profiles
    SET username = upper(btrim(p_username)),
        full_name = btrim(p_full_name),
        has_changed_password = true,
        is_setup_completed = true,
        has_edited_profile = true
    WHERE id = v_uid;
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'message', 'This codename is already taken. Please choose another.');
  END;

  RETURN jsonb_build_object(
    'success', true,
    'profile', (SELECT to_jsonb(p) FROM public.profiles p WHERE p.id = v_uid)
  );
END;
$_$;

--
-- Name: convert_govt_holiday_response(uuid, date, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.convert_govt_holiday_response(p_user_id uuid, p_holiday_date date, p_response text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF NOT public.current_user_has_workspace('chuti') THEN
    RAISE EXCEPTION 'Leave workspace access is disabled.';
  END IF;
  PERFORM public.convert_govt_holiday_response_internal(
    p_user_id, p_holiday_date, p_response
  );
END;
$$;

--
-- Name: convert_govt_holiday_response_internal(uuid, date, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.convert_govt_holiday_response_internal(p_user_id uuid, p_holiday_date date, p_response text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_holiday_name text;
  v_settings jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can convert government holiday entitlements.';
  END IF;
  IF p_response NOT IN ('reserve', 'paid') THEN
    RAISE EXCEPTION 'Invalid government holiday response.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_user_id AND eligible_govt_holiday IS DISTINCT FROM false
  ) THEN
    RAISE EXCEPTION 'Target user is not eligible for government holidays.';
  END IF;

  SELECT COALESCE(global_settings, '{}'::jsonb) INTO v_settings
  FROM public.profiles
  WHERE role IN ('superadmin', 'admin')
  ORDER BY CASE WHEN role = 'superadmin' THEN 0 ELSE 1 END, created_at
  LIMIT 1;

  SELECT value->>'name' INTO v_holiday_name
  FROM jsonb_array_elements(
    CASE WHEN jsonb_typeof(v_settings->'govt_holidays') = 'array'
      THEN v_settings->'govt_holidays' ELSE '[]'::jsonb END
  )
  WHERE (value->>'date')::date = p_holiday_date
  LIMIT 1;

  IF v_holiday_name IS NULL OR btrim(v_holiday_name) = '' THEN
    RAISE EXCEPTION 'Government holiday is not active.';
  END IF;

  INSERT INTO public.govt_holiday_responses (
    user_id, holiday_date, holiday_name, response, updated_by_admin
  ) VALUES (
    p_user_id, p_holiday_date, v_holiday_name, p_response, true
  )
  ON CONFLICT (user_id, holiday_date) DO UPDATE
  SET holiday_name = EXCLUDED.holiday_name,
      response = EXCLUDED.response,
      updated_by_admin = true
  WHERE public.govt_holiday_responses.holiday_name IS DISTINCT FROM EXCLUDED.holiday_name
     OR public.govt_holiday_responses.response IS DISTINCT FROM EXCLUDED.response
     OR public.govt_holiday_responses.updated_by_admin IS DISTINCT FROM true;

  IF p_response = 'paid' THEN
    PERFORM public.reconcile_govt_holiday_adjustments(p_user_id, extract(year FROM p_holiday_date)::integer);
  END IF;
END;
$$;

--
-- Name: convert_short_leave_to_full_leave(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.convert_short_leave_to_full_leave(p_user_id uuid, p_adjust_category text DEFAULT 'Office Leave'::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF NOT public.current_user_has_workspace('chuti') THEN
    RAISE EXCEPTION 'Leave workspace access is disabled.';
  END IF;
  RETURN public.convert_short_leave_to_full_leave_internal(
    p_user_id, p_adjust_category
  );
END;
$$;

--
-- Name: convert_short_leave_to_full_leave_internal(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.convert_short_leave_to_full_leave_internal(p_user_id uuid, p_adjust_category text DEFAULT 'Office Leave'::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_actor_role text;
  v_working_hours numeric;
  v_converted_hours numeric;
  v_converted_days integer;
  v_raw_short_minutes numeric;
  v_net_short_minutes numeric;
  v_minutes_per_day numeric;
  v_days integer;
  v_hours numeric;
  v_inserted integer;
  v_reserved integer;
  v_used_reserved integer;
BEGIN
  SELECT role INTO v_actor_role FROM public.profiles WHERE id = auth.uid();
  IF p_user_id <> auth.uid()
     AND NOT public.is_admin()
     AND NOT (v_actor_role = 'supervisor' AND public.has_leave_access(auth.uid(), p_user_id)) THEN
    RAISE EXCEPTION 'Permission denied for target user.';
  END IF;
  IF p_adjust_category NOT IN ('Office Leave', 'Govt Holiday') THEN
    RAISE EXCEPTION 'Invalid adjustment category.';
  END IF;

  -- Serializes concurrent conversion attempts for the same profile.
  SELECT COALESCE(working_hours, 9.5),
         COALESCE(converted_short_leaves_hours, 0),
         COALESCE(converted_short_leaves_days, 0)
  INTO v_working_hours, v_converted_hours, v_converted_days
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Target user not found.'; END IF;
  IF v_working_hours <= 0 OR v_working_hours > 24 THEN
    RAISE EXCEPTION 'Target user has invalid working hours.';
  END IF;

  SELECT COALESCE(sum(
    CASE
      WHEN c.leave_type = 'Short Leave' AND c.adjustment IS NOT TRUE THEN
        CASE WHEN extract(epoch FROM c.leave_hour) < 0 THEN -1 ELSE 1 END
        * greatest(
            abs(extract(epoch FROM c.leave_hour))
            - COALESCE(abs(extract(epoch FROM c.adjusted_hour)), 0),
            0
          ) / 60
      WHEN c.leave_type = 'Overtime' AND c.adjust_short_leave IS TRUE AND c.adjustment IS TRUE THEN
        -extract(epoch FROM c.leave_hour) / 60
      WHEN c.leave_type = 'Overtime' AND c.adjust_short_leave IS TRUE AND c.adjusted_hour IS NOT NULL THEN
        -extract(epoch FROM c.adjusted_hour) / 60
      ELSE 0
    END
  ), 0)
  INTO v_raw_short_minutes
  FROM public.chuti c
  WHERE c.user_id = p_user_id
    AND c.status = 'approved'
    AND c.deleted_at IS NULL;

  v_net_short_minutes := greatest(0, v_raw_short_minutes - (v_converted_hours * 60));
  v_minutes_per_day := v_working_hours * 60;
  v_days := floor(v_net_short_minutes / v_minutes_per_day)::integer;
  IF v_days < 1 THEN
    RAISE EXCEPTION 'There are not enough unconverted short-leave hours.';
  END IF;
  v_hours := v_days * v_working_hours;

  IF p_adjust_category = 'Govt Holiday' THEN
    SELECT count(*)::integer INTO v_reserved
    FROM public.govt_holiday_responses
    WHERE user_id = p_user_id AND response = 'reserve';

    SELECT count(*)::integer INTO v_used_reserved
    FROM public.chuti
    WHERE user_id = p_user_id
      AND status = 'approved'
      AND deleted_at IS NULL
      AND leave_type = 'Full Leave'
      AND adjustment IS TRUE
      AND (reserve_holiday = 'Govt Holiday' OR comment ILIKE '%Govt Holiday%');

    IF v_reserved - v_used_reserved < v_days THEN
      RAISE EXCEPTION 'Not enough unused reserved government holidays for this conversion.';
    END IF;
  END IF;

  PERFORM set_config('app.bypass_chuti_security', 'true', true);
  WITH free_dates AS (
    SELECT (current_date - offset_days)::date AS leave_date
    FROM generate_series(0, 3650) AS offset_days
    WHERE NOT EXISTS (
      SELECT 1 FROM public.chuti existing
      WHERE existing.user_id = p_user_id
        AND existing.date = (current_date - offset_days)::date
        AND existing.deleted_at IS NULL
    )
    ORDER BY offset_days
    LIMIT v_days
  )
  INSERT INTO public.chuti (
    user_id, date, leave_type, adjustment, status, comment, reserve_holiday
  )
  SELECT p_user_id,
         leave_date,
         'Full Leave',
         true,
         'approved',
         'Adjusted: ' || p_adjust_category || ' | Converted from Short Leave',
         p_adjust_category
  FROM free_dates;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  IF v_inserted <> v_days THEN
    RAISE EXCEPTION 'Unable to allocate enough free leave dates.';
  END IF;

  PERFORM set_config('app.bypass_profile_security', 'true', true);
  UPDATE public.profiles
  SET converted_short_leaves_days = v_converted_days + v_days,
      converted_short_leaves_hours = v_converted_hours + v_hours
  WHERE id = p_user_id;

  RETURN jsonb_build_object('days_converted', v_days, 'hours_converted', v_hours);
END;
$$;

--
-- Name: create_configured_user(text, text, text, text, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_configured_user(p_email text, p_password text, p_username text, p_role text, p_full_name text, p_profile_options jsonb DEFAULT '{}'::jsonb) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  v_user_id uuid;
  v_supervisor_ids uuid[];
  v_allowed_types text[];
  v_working_hours numeric;
  v_break_time numeric;
  v_default_sign_in text;
  v_default_sign_out text;
  v_actor_name text;
BEGIN
  IF jsonb_typeof(COALESCE(p_profile_options, '{}'::jsonb)) <> 'object' THEN
    RAISE EXCEPTION 'Profile options must be a JSON object.';
  END IF;

  SELECT COALESCE(array_agg(value::uuid), ARRAY[]::uuid[])
  INTO v_supervisor_ids
  FROM jsonb_array_elements_text(
    CASE WHEN jsonb_typeof(p_profile_options->'supervisor_ids') = 'array'
      THEN p_profile_options->'supervisor_ids' ELSE '[]'::jsonb END
  );

  SELECT COALESCE(array_agg(value), ARRAY[]::text[])
  INTO v_allowed_types
  FROM jsonb_array_elements_text(
    CASE WHEN jsonb_typeof(p_profile_options->'allowed_types') = 'array'
      THEN p_profile_options->'allowed_types' ELSE '[]'::jsonb END
  );

  v_working_hours := COALESCE((p_profile_options->>'working_hours')::numeric, 9.5);
  v_break_time := COALESCE((p_profile_options->>'break_time')::numeric, 0);
  IF v_working_hours <= 0 OR v_working_hours > 24 OR v_break_time < 0 OR v_break_time > 24 THEN
    RAISE EXCEPTION 'Invalid working-hours or break-time value.';
  END IF;

  v_default_sign_in := NULLIF(btrim(p_profile_options->>'default_sign_in'), '');
  v_default_sign_out := NULLIF(btrim(p_profile_options->>'default_sign_out'), '');
  IF v_default_sign_in IS NOT NULL THEN
    PERFORM v_default_sign_in::time;
  END IF;
  IF v_default_sign_out IS NOT NULL THEN
    PERFORM v_default_sign_out::time;
  END IF;

  v_user_id := public.create_new_user(
    p_email,
    p_password,
    p_username,
    p_role,
    p_full_name,
    COALESCE((p_profile_options->>'needs_supervisor_approval')::boolean, false),
    COALESCE((p_profile_options->>'allow_reserve')::boolean, false),
    COALESCE((p_profile_options->>'allow_overtime')::boolean, false),
    v_supervisor_ids
  );

  PERFORM set_config('app.bypass_profile_security', 'true', true);
  UPDATE public.profiles
  SET allowed_types = v_allowed_types,
      can_manage_rules = COALESCE((p_profile_options->>'can_manage_rules')::boolean, false),
      has_chuti_access = COALESCE((p_profile_options->>'has_chuti_access')::boolean, true),
      has_quotes_access = COALESCE((p_profile_options->>'has_quotes_access')::boolean, true),
      eligible_govt_holiday = COALESCE((p_profile_options->>'eligible_govt_holiday')::boolean, true),
      eligible_office_leave = COALESCE((p_profile_options->>'eligible_office_leave')::boolean, true),
      job_role = NULLIF(btrim(p_profile_options->>'job_role'), ''),
      working_hours = v_working_hours,
      break_time = v_break_time,
      default_sign_in = COALESCE(v_default_sign_in, default_sign_in),
      default_sign_out = COALESCE(v_default_sign_out, default_sign_out),
      global_settings = COALESCE(global_settings, '{}'::jsonb) || jsonb_build_object(
        'kpi_skills', CASE WHEN jsonb_typeof(p_profile_options->'kpi_skills') = 'array' THEN p_profile_options->'kpi_skills' ELSE '[]'::jsonb END,
        'kpi_dept_indicators', CASE WHEN jsonb_typeof(p_profile_options->'kpi_dept_indicators') = 'array' THEN p_profile_options->'kpi_dept_indicators' ELSE '[]'::jsonb END,
        'kpi_other_dept_indicators', CASE WHEN jsonb_typeof(p_profile_options->'kpi_other_dept_indicators') = 'array' THEN p_profile_options->'kpi_other_dept_indicators' ELSE '[]'::jsonb END,
        'performs_data_entry', COALESCE((p_profile_options->>'performs_data_entry')::boolean, true),
        'department', COALESCE(NULLIF(btrim(p_profile_options->>'department'), ''), 'Data Entry'),
        'performs_other_dept_tasks', COALESCE((p_profile_options->>'performs_other_dept_tasks')::boolean, false),
        'other_department', COALESCE(NULLIF(btrim(p_profile_options->>'other_department'), ''), 'IT')
      )
  WHERE id = v_user_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'New profile was not created.'; END IF;

  SELECT username INTO v_actor_name FROM public.profiles WHERE id = auth.uid();
  INSERT INTO public.audit_logs (
    actor_id, actor_codename, action_type, target_id, target_user_id, details, metadata
  ) VALUES (
    auth.uid(), COALESCE(v_actor_name, 'System'), 'CREATE_USER', v_user_id::text,
    v_user_id, 'User account created', jsonb_build_object('role', p_role, 'username', upper(btrim(p_username)))
  );

  RETURN v_user_id;
END;
$$;

--
-- Name: create_new_user(text, text, text, text, text, boolean, boolean, boolean, uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_new_user(p_email text, p_password text, p_username text, p_role text, p_full_name text, p_needs_supervisor_approval boolean DEFAULT false, p_allow_reserve boolean DEFAULT false, p_allow_overtime boolean DEFAULT false, p_supervisor_ids uuid[] DEFAULT NULL::uuid[]) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions', 'pg_temp'
    AS $_$
DECLARE
  v_user_id UUID;
  v_sql TEXT;
  v_cols TEXT[] := ARRAY[]::TEXT[];
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can create users';
  END IF;

  -- Whitelist the role and enforce the creation hierarchy.
  IF p_role NOT IN ('user', 'supervisor', 'admin', 'superadmin') THEN
    RAISE EXCEPTION 'Invalid role: %', p_role;
  END IF;
  IF p_role IN ('admin', 'superadmin') AND NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'Only a superadmin can create admin or superadmin accounts.';
  END IF;

  -- Create user in auth.users
  v_user_id := extensions.uuid_generate_v4();

  -- Base columns that are guaranteed to exist in auth.users
  v_cols := ARRAY['id', 'instance_id', 'email', 'encrypted_password', 'email_confirmed_at', 'created_at', 'updated_at', 'raw_app_meta_data', 'raw_user_meta_data', 'aud', 'role'];

  -- Construct the SQL query dynamically
  v_sql := 'INSERT INTO auth.users (' || array_to_string(v_cols, ', ');

  -- Check and append optional columns if they exist in the schema
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'confirmation_token') THEN
    v_sql := v_sql || ', confirmation_token';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'recovery_token') THEN
    v_sql := v_sql || ', recovery_token';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'email_change_token_new') THEN
    v_sql := v_sql || ', email_change_token_new';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'email_change') THEN
    v_sql := v_sql || ', email_change';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'phone_change_token') THEN
    v_sql := v_sql || ', phone_change_token';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'email_change_token_current') THEN
    v_sql := v_sql || ', email_change_token_current';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'reauthentication_token') THEN
    v_sql := v_sql || ', reauthentication_token';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'is_sso_user') THEN
    v_sql := v_sql || ', is_sso_user';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'is_anonymous') THEN
    v_sql := v_sql || ', is_anonymous';
  END IF;

  v_sql := v_sql || ') VALUES ($1, ''00000000-0000-0000-0000-000000000000'', $2, crypt($3, gen_salt(''bf'')), NOW(), NOW(), NOW(), ''{"provider":"email","providers":["email"]}''::jsonb, $4, ''authenticated'', ''authenticated''';

  -- Append matching value expressions for the optional columns
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'confirmation_token') THEN
    v_sql := v_sql || ', ''''';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'recovery_token') THEN
    v_sql := v_sql || ', ''''';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'email_change_token_new') THEN
    v_sql := v_sql || ', ''''';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'email_change') THEN
    v_sql := v_sql || ', ''''';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'phone_change_token') THEN
    v_sql := v_sql || ', ''''';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'email_change_token_current') THEN
    v_sql := v_sql || ', ''''';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'reauthentication_token') THEN
    v_sql := v_sql || ', ''''';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'is_sso_user') THEN
    v_sql := v_sql || ', false';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'is_anonymous') THEN
    v_sql := v_sql || ', false';
  END IF;

  v_sql := v_sql || ')';

  -- Execute dynamic insert
  EXECUTE v_sql USING
    v_user_id,
    p_email,
    p_password,
    jsonb_build_object(
      'username', UPPER(p_username),
      'role', p_role,
      'full_name', p_full_name,
      'needs_supervisor_approval', p_needs_supervisor_approval,
      'allow_reserve', p_allow_reserve,
      'allow_overtime', p_allow_overtime
    );

  -- The trigger will create the profile, but we need to update full_name, needs_supervisor_approval, allow_reserve, allow_overtime, and supervisor_ids
  UPDATE public.profiles
  SET full_name = p_full_name,
      needs_supervisor_approval = p_needs_supervisor_approval,
      allow_reserve = p_allow_reserve,
      allow_overtime = p_allow_overtime,
      supervisor_ids = p_supervisor_ids,
      is_setup_completed = false
  WHERE id = v_user_id;

  RETURN v_user_id;
END;
$_$;

--
-- Name: current_user_has_workspace(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.current_user_has_workspace(p_workspace text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT CASE
    WHEN auth.role() = 'service_role' THEN true
    WHEN p.role = 'superadmin' THEN true
    WHEN p_workspace = 'chuti' THEN COALESCE(p.has_chuti_access, false)
    WHEN p_workspace = 'quotes' THEN COALESCE(p.has_quotes_access, false)
    ELSE false
  END
  FROM public.profiles p
  WHERE p.id = auth.uid();
$$;

--
-- Name: delete_user_by_id(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_user_by_id(p_user_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_actor_role text;
  v_actor_name text;
  v_target_role text;
  v_target_name text;
BEGIN
  SELECT role, username INTO v_actor_role, v_actor_name FROM public.profiles WHERE id = auth.uid();
  SELECT role, username INTO v_target_role, v_target_name FROM public.profiles WHERE id = p_user_id FOR UPDATE;

  IF v_target_role IS NULL THEN
    RAISE EXCEPTION 'Target user not found.';
  END IF;
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Self-deletion is not allowed.';
  END IF;
  IF NOT (
    v_actor_role = 'superadmin'
    OR (v_actor_role = 'admin' AND v_target_role IN ('user', 'supervisor'))
  ) THEN
    RAISE EXCEPTION 'Permission denied for this target account.';
  END IF;

  INSERT INTO public.audit_logs (
    actor_id, actor_codename, action_type, target_id, target_user_id, details, metadata
  ) VALUES (
    auth.uid(), COALESCE(v_actor_name, 'System'), 'DELETE_USER', p_user_id::text,
    p_user_id, 'User account deleted', jsonb_build_object('target_role', v_target_role, 'target_codename', v_target_name)
  );

  DELETE FROM auth.users WHERE id = p_user_id;
END;
$$;

--
-- Name: enforce_chuti_write_permissions(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_chuti_write_permissions() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_actor_role text;
  v_needs_supervisor boolean;
BEGIN
  IF auth.role() = 'service_role'
     OR current_setting('app.bypass_chuti_security', true) = 'true' THEN
    RETURN NEW;
  END IF;

  IF NEW.date < DATE '2020-01-01' OR NEW.date > (current_date + 730) THEN
    RAISE EXCEPTION 'Leave date is outside the supported range.';
  END IF;

  SELECT role INTO v_actor_role FROM public.profiles WHERE id = auth.uid();

  IF v_actor_role IN ('admin', 'superadmin') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'A leave record cannot be reassigned to another user.';
  END IF;

  IF v_actor_role = 'supervisor' THEN
    IF NOT (NEW.user_id = auth.uid() OR public.has_leave_access(auth.uid(), NEW.user_id)) THEN
      RAISE EXCEPTION 'Supervisors may only change leave records for their assigned team.';
    END IF;
    IF TG_OP = 'INSERT' AND NEW.status NOT IN ('pending_supervisor', 'approved_by_supervisor') THEN
      RAISE EXCEPTION 'Supervisors cannot create final-approved leave records.';
    END IF;
    IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status
       AND NEW.status NOT IN ('pending_supervisor', 'approved_by_supervisor', 'needs_review') THEN
      RAISE EXCEPTION 'Supervisors cannot grant final admin approval.';
    END IF;
    IF TG_OP = 'UPDATE'
       AND NEW.reserve_adjustment_status IS DISTINCT FROM OLD.reserve_adjustment_status
       AND NEW.reserve_adjustment_status NOT IN ('none', 'pending') THEN
      RAISE EXCEPTION 'Supervisors cannot approve or reject reserve adjustments.';
    END IF;
    RETURN NEW;
  END IF;

  IF v_actor_role <> 'user' OR NEW.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Users may only change their own leave records.';
  END IF;

  SELECT COALESCE(needs_supervisor_approval, true)
  INTO v_needs_supervisor
  FROM public.profiles
  WHERE id = auth.uid();

  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'approved_by_supervisor' AND NOT v_needs_supervisor THEN
      NULL;
    ELSIF NEW.status <> 'pending_supervisor' THEN
      RAISE EXCEPTION 'Users cannot create approved or rejected leave records.';
    END IF;
    IF NEW.reserve_adjustment_status <> 'none'
       OR NEW.admin_edit_status <> 'none'
       OR NEW.is_edited
       OR NEW.deleted_at IS NOT NULL THEN
      RAISE EXCEPTION 'Users cannot set administrative leave fields.';
    END IF;
  ELSE
    IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Leave creation timestamps are immutable.';
    END IF;
    IF OLD.status NOT IN ('pending_supervisor', 'approved_by_supervisor', 'needs_review')
       AND (to_jsonb(NEW) - ARRAY[
         'reserve_adjustment_status', 'admin_edit_request', 'updated_at'
       ]) IS DISTINCT FROM
       (to_jsonb(OLD) - ARRAY[
         'reserve_adjustment_status', 'admin_edit_request', 'updated_at'
       ]) THEN
      RAISE EXCEPTION 'Approved leave details are immutable for users.';
    END IF;
    IF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at
       AND OLD.status NOT IN ('pending_supervisor', 'approved_by_supervisor', 'needs_review') THEN
      RAISE EXCEPTION 'Only an unapproved leave request can be withdrawn by its owner.';
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      IF NEW.status = 'approved_by_supervisor' AND NOT v_needs_supervisor THEN
        NULL;
      ELSIF NEW.status <> 'pending_supervisor' THEN
        RAISE EXCEPTION 'Users cannot approve or reject leave records.';
      END IF;
    END IF;
    IF NEW.reserve_adjustment_status IS DISTINCT FROM OLD.reserve_adjustment_status
       AND NEW.reserve_adjustment_status NOT IN ('none', 'pending') THEN
      RAISE EXCEPTION 'Users cannot approve or reject reserve adjustments.';
    END IF;
    IF NEW.admin_edit_status IS DISTINCT FROM OLD.admin_edit_status
       AND NEW.admin_edit_status NOT IN ('none', 'pending') THEN
      RAISE EXCEPTION 'Users cannot approve administrative edits.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

--
-- Name: enforce_kpi_assessment_permissions(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_kpi_assessment_permissions() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_actor_role text;
  v_primary_appraiser text;
BEGIN
  IF NEW.month_year IS NULL OR btrim(NEW.month_year) = '' OR length(NEW.month_year) > 100 THEN
    RAISE EXCEPTION 'Invalid KPI assessment period.';
  END IF;
  IF jsonb_typeof(NEW.kpis) <> 'object' THEN
    RAISE EXCEPTION 'KPI data must be a JSON object.';
  END IF;
  IF length(COALESCE(NEW.emp_id, '')) > 100
     OR length(COALESCE(NEW.date_of_joining, '')) > 100
     OR length(COALESCE(NEW.department, '')) > 100
     OR length(COALESCE(NEW.appraiser_name, '')) > 150
     OR length(COALESCE(NEW.reviewer_name, '')) > 150 THEN
    RAISE EXCEPTION 'KPI assessment metadata exceeds the supported length.';
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.created_at := timezone('utc', now());
  ELSE
    IF NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.month_year IS DISTINCT FROM OLD.month_year
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'KPI assessment identity and creation time are immutable.';
    END IF;
  END IF;
  NEW.updated_at := timezone('utc', now());

  IF auth.role() = 'service_role' THEN RETURN NEW; END IF;

  SELECT p.role INTO v_actor_role
  FROM public.profiles p
  WHERE p.id = auth.uid();

  IF v_actor_role IN ('admin', 'superadmin') THEN
    RETURN NEW;
  END IF;
  IF v_actor_role = 'supervisor'
     AND (NEW.user_id = auth.uid() OR public.has_kpi_access(auth.uid(), NEW.user_id)) THEN
    RETURN NEW;
  END IF;
  IF v_actor_role <> 'user' OR NEW.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Permission denied for this KPI assessment.';
  END IF;

  IF TG_OP = 'INSERT' THEN
    SELECT COALESCE(supervisor.full_name, supervisor.username)
    INTO v_primary_appraiser
    FROM public.profiles employee
    CROSS JOIN LATERAL unnest(COALESCE(employee.supervisor_ids, ARRAY[]::uuid[]))
      WITH ORDINALITY AS assigned(supervisor_id, position)
    JOIN public.profiles supervisor ON supervisor.id = assigned.supervisor_id
    WHERE employee.id = NEW.user_id
    ORDER BY assigned.position
    LIMIT 1;

    NEW.kpis := NEW.kpis - ARRAY['weightages', 'supervisorScores'];
    NEW.appraiser_name := v_primary_appraiser;
    NEW.appraiser_signed := false;
    NEW.appraiser_sign_date := NULL;
  ELSE
    NEW.kpis := NEW.kpis - ARRAY['weightages', 'supervisorScores'];
    IF OLD.kpis ? 'weightages' THEN
      NEW.kpis := jsonb_set(NEW.kpis, '{weightages}', OLD.kpis->'weightages', true);
    END IF;
    IF OLD.kpis ? 'supervisorScores' THEN
      NEW.kpis := jsonb_set(NEW.kpis, '{supervisorScores}', OLD.kpis->'supervisorScores', true);
    END IF;
    NEW.appraiser_name := OLD.appraiser_name;
    NEW.appraiser_signed := OLD.appraiser_signed;
    NEW.appraiser_sign_date := OLD.appraiser_sign_date;
  END IF;

  NEW.appraisee_sign_date := CASE
    WHEN NEW.appraisee_signed IS TRUE THEN to_char(current_date, 'DD-MM-YYYY')
    ELSE NULL
  END;
  RETURN NEW;
END;
$$;

--
-- Name: enforce_leave_settlement_permissions(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_leave_settlement_permissions() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $_$
DECLARE
  v_actor_role text;
  v_settings jsonb;
  v_sum numeric;
BEGIN
  IF auth.role() = 'service_role'
     OR current_setting('app.bypass_settlement_security', true) = 'true' THEN
    RETURN NEW;
  END IF;

  IF NEW.year !~ '^[0-9]{4}$'
     OR NEW.period NOT IN ('H1', 'H2', 'Instant')
     OR NEW.leave_category NOT IN ('Govt Holiday', 'Eid-ul-Fitr', 'Eid-ul-Adha', 'Office Leave')
     OR NEW.action_type NOT IN ('carry_forward', 'payment', 'adjust_leave', 'split')
     OR NEW.status NOT IN ('initiated', 'responded', 'processed') THEN
    RAISE EXCEPTION 'Invalid leave settlement value.';
  END IF;

  SELECT role, COALESCE(global_settings, '{}'::jsonb)
  INTO v_actor_role, v_settings
  FROM public.profiles
  WHERE id = auth.uid();

  IF v_actor_role IN ('admin', 'superadmin') THEN
    RETURN NEW;
  END IF;
  IF v_actor_role = 'supervisor' THEN
    IF NOT public.has_leave_access(auth.uid(), NEW.user_id) THEN
      RAISE EXCEPTION 'Supervisors may only manage settlements for their assigned team.';
    END IF;
    RETURN NEW;
  END IF;
  IF v_actor_role <> 'user' OR NEW.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Users may only submit their own settlement response.';
  END IF;

  IF NEW.status <> 'responded' OR NEW.processed_by IS NOT NULL OR NEW.processed_at IS NOT NULL THEN
    RAISE EXCEPTION 'Users cannot process leave settlements.';
  END IF;
  IF NEW.action_by IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Settlement action_by must identify the authenticated user.';
  END IF;

  v_sum := COALESCE(NEW.carry_forward_days, 0)
         + COALESCE(NEW.payment_days, 0)
         + COALESCE(NEW.adjust_leave_days, 0);
  IF abs(v_sum - NEW.remaining_days) >= 0.01 THEN
    RAISE EXCEPTION 'Settlement allocations must equal the remaining leave balance.';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NOT EXISTS (
         SELECT 1
         FROM public.leave_settlements existing
         WHERE existing.id = NEW.id
           AND existing.user_id = auth.uid()
           AND existing.status IN ('initiated', 'responded')
       )
       AND (
         v_settings->>'settlement_active_year' IS DISTINCT FROM NEW.year
         OR v_settings->>'settlement_active_period' IS DISTINCT FROM NEW.period
         OR v_settings->>'settlement_active_category' IS DISTINCT FROM NEW.leave_category
       ) THEN
      RAISE EXCEPTION 'No matching settlement response window is active.';
    END IF;
  ELSE
    IF OLD.user_id IS DISTINCT FROM NEW.user_id
       OR OLD.year IS DISTINCT FROM NEW.year
       OR OLD.period IS DISTINCT FROM NEW.period
       OR OLD.leave_category IS DISTINCT FROM NEW.leave_category
       OR OLD.remaining_days IS DISTINCT FROM NEW.remaining_days
       OR OLD.created_at IS DISTINCT FROM NEW.created_at THEN
      RAISE EXCEPTION 'Settlement identity and authoritative balance are immutable.';
    END IF;
    IF OLD.status NOT IN ('initiated', 'responded') THEN
      RAISE EXCEPTION 'Processed settlements cannot be revised by users.';
    END IF;
  END IF;

  RETURN NEW;
END;
$_$;

--
-- Name: enforce_quotation_mistake_metadata(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_quotation_mistake_metadata() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF NEW.date < DATE '2020-01-01' OR NEW.date > (current_date + 366) THEN
    RAISE EXCEPTION 'Mistake date is outside the supported range.';
  END IF;
  NEW.filename := btrim(NEW.filename);
  NEW.branch := btrim(NEW.branch);
  NEW.mistake_details := btrim(NEW.mistake_details);
  NEW.penalty := btrim(NEW.penalty);
  IF NEW.filename = '' OR length(NEW.filename) > 255
     OR NEW.branch = '' OR length(NEW.branch) > 100
     OR NEW.mistake_details = '' OR length(NEW.mistake_details) > 5000
     OR NEW.penalty = '' OR length(NEW.penalty) > 100 THEN
    RAISE EXCEPTION 'Quotation mistake fields are missing or exceed their supported length.';
  END IF;

  SELECT p.username INTO NEW.codename
  FROM public.profiles p
  WHERE p.id = NEW.user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The selected user profile does not exist.';
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.created_by := auth.uid();
    NEW.updated_by := auth.uid();
    NEW.created_at := timezone('utc', now());
    NEW.updated_at := timezone('utc', now());
  ELSE
    NEW.created_by := OLD.created_by;
    NEW.created_at := OLD.created_at;
    NEW.updated_by := auth.uid();
    NEW.updated_at := timezone('utc', now());
  END IF;
  RETURN NEW;
END;
$$;

--
-- Name: get_admin_sales_summary(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_admin_sales_summary(p_today text, p_tz text DEFAULT 'UTC'::text) RETURNS TABLE(total_sold integer, total_unsold integer, total_attempts integer)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $_$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Permission denied: Only admins can view sales summary.';
  END IF;

  RETURN QUERY
  WITH todays_sales AS (
    SELECT
      upper(btrim(regexp_replace(r.file_name, ' \[(SOLD|UNSOLD)\]$', ''))) AS file_key,
      (r.file_name LIKE '% [SOLD]') AS is_sold,
      r.submitted_at
    FROM public.records r
    WHERE r.file_type = 'Sale'
      AND r.submitted_at >= ((p_today::date)::timestamp AT TIME ZONE p_tz)
      AND r.submitted_at <  ((p_today::date + 1)::timestamp AT TIME ZONE p_tz)
  ),
  per_file AS (
    SELECT
      file_key,
      COUNT(*) FILTER (WHERE is_sold)::INT AS sold_count,
      CASE WHEN NOT (array_agg(is_sold ORDER BY submitted_at DESC, is_sold DESC))[1]
           THEN 1 ELSE 0 END AS unsold_count
    FROM todays_sales
    GROUP BY file_key
  )
  SELECT
    COALESCE(SUM(sold_count), 0)::INT                 AS total_sold,
    COALESCE(SUM(unsold_count), 0)::INT               AS total_unsold,
    COALESCE(SUM(sold_count + unsold_count), 0)::INT  AS total_attempts
  FROM per_file;
END;
$_$;

--
-- Name: get_available_record_months(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_available_record_months(p_user_id uuid DEFAULT NULL::uuid, p_tz text DEFAULT 'Asia/Dhaka'::text) RETURNS TABLE(year text, month text)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF auth.uid() IS NULL AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;
  IF p_user_id IS NOT NULL
     AND p_user_id <> auth.uid()
     AND NOT public.is_admin()
     AND NOT (public.is_supervisor() AND public.has_leave_access(auth.uid(), p_user_id)) THEN
    RAISE EXCEPTION 'Permission denied for target user.';
  END IF;

  RETURN QUERY
  SELECT to_char(date_trunc('month', r.submitted_at AT TIME ZONE p_tz), 'YYYY'),
         to_char(date_trunc('month', r.submitted_at AT TIME ZONE p_tz), 'MM')
  FROM public.records r
  WHERE p_user_id IS NULL OR r.user_id = p_user_id
  GROUP BY date_trunc('month', r.submitted_at AT TIME ZONE p_tz)
  ORDER BY date_trunc('month', r.submitted_at AT TIME ZONE p_tz);
END;
$$;

--
-- Name: get_leaderboard_data(text, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_leaderboard_data(p_year text, p_month text, p_period text, p_today text, p_tz text DEFAULT 'UTC'::text) RETURNS TABLE(user_id uuid, username text, full_name text, role text, job_role text, branch text, badge jsonb, quotes_count integer, requotes_count integer, reviews_count integer, sales_count integer, total_submitted integer, todays_count integer, months_count integer, overall_score integer, earliest_achievement_timestamp timestamp with time zone, rank integer)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_month_start timestamptz;
  v_month_end   timestamptz;
  v_year_start  timestamptz;
  v_year_end    timestamptz;
  v_today_start timestamptz;
  v_today_end   timestamptz;
BEGIN
  p_period := COALESCE(p_period, '');

  v_month_start := (make_date(p_year::int, p_month::int, 1)::timestamp AT TIME ZONE p_tz);
  v_month_end   := ((make_date(p_year::int, p_month::int, 1) + interval '1 month')::timestamp AT TIME ZONE p_tz);

  v_year_start  := (make_date(p_year::int, 1, 1)::timestamp AT TIME ZONE p_tz);
  v_year_end    := ((make_date(p_year::int, 1, 1) + interval '1 year')::timestamp AT TIME ZONE p_tz);

  v_today_start := ((p_today::date)::timestamp AT TIME ZONE p_tz);
  v_today_end   := (((p_today::date + 1))::timestamp AT TIME ZONE p_tz);

  RETURN QUERY
  WITH selected_month_stats AS (
    SELECT
      r.user_id,
      COUNT(*) FILTER (WHERE r.file_type != 'Other Site')::INT AS months_count,
      COUNT(*) FILTER (WHERE r.file_type = 'Quote')::INT AS quotes_count,
      COUNT(*) FILTER (WHERE r.file_type IN ('Requote', 'Requote Van', 'Requote Bike'))::INT AS requotes_count,
      COUNT(*) FILTER (WHERE r.file_type LIKE '%Review%')::INT AS reviews_count,
      COUNT(*) FILTER (WHERE r.file_type = 'Sale')::INT AS sales_count,
      MAX(r.submitted_at) FILTER (WHERE r.file_type != 'Other Site') AS earliest_achievement_timestamp
    FROM public.records r
    WHERE r.submitted_at >= v_month_start AND r.submitted_at < v_month_end
    GROUP BY r.user_id
  ),
  selected_year_stats AS (
    SELECT
      r.user_id,
      COUNT(*) FILTER (WHERE r.file_type != 'Other Site')::INT AS years_count
    FROM public.records r
    WHERE r.submitted_at >= v_year_start AND r.submitted_at < v_year_end
    GROUP BY r.user_id
  ),
  today_stats AS (
    SELECT
      r.user_id,
      COUNT(*) FILTER (WHERE r.file_type != 'Other Site')::INT AS todays_count
    FROM public.records r
    WHERE r.submitted_at >= v_today_start AND r.submitted_at < v_today_end
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
      GROUP BY r2.user_id, r2.branch_name
    ) b
    ORDER BY b.user_id, b.branch_cnt DESC, b.branch_latest DESC
  )
  SELECT
    p.id AS user_id,
    p.username,
    p.full_name,
    p.role,
    p.job_role,
    ub.branch_name AS branch,
    COALESCE(p.global_settings->'top_performer_badge', 'null'::jsonb) AS badge,
    COALESCE(sms.quotes_count, 0)::INT AS quotes_count,
    COALESCE(sms.requotes_count, 0)::INT AS requotes_count,
    COALESCE(sms.reviews_count, 0)::INT AS reviews_count,
    COALESCE(sms.sales_count, 0)::INT AS sales_count,
    COALESCE(sms.months_count, 0)::INT AS total_submitted,
    COALESCE(ts.todays_count, 0)::INT AS todays_count,
    COALESCE(sms.months_count, 0)::INT AS months_count,
    COALESCE(sys.years_count, 0)::INT AS overall_score,
    sms.earliest_achievement_timestamp AS earliest_achievement_timestamp,
    DENSE_RANK() OVER (
      ORDER BY
        COALESCE(sms.months_count, 0) DESC,
        sms.earliest_achievement_timestamp ASC NULLS LAST,
        p.username ASC
    )::INT AS rank
  FROM public.profiles p
  LEFT JOIN selected_month_stats sms ON p.id = sms.user_id
  LEFT JOIN selected_year_stats sys ON p.id = sys.user_id
  LEFT JOIN today_stats ts ON p.id = ts.user_id
  LEFT JOIN user_branches ub ON p.id = ub.user_id
  ORDER BY rank ASC;
END;
$$;

--
-- Name: get_my_role(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_my_role() RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT COALESCE((
    SELECT p.role
    FROM public.profiles p
    WHERE p.id = (SELECT auth.uid())
  ), 'none');
$$;

--
-- Name: get_user_email_by_username(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_email_by_username(p_username text) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_email TEXT;
BEGIN
  SELECT email INTO v_email
  FROM auth.users u
  JOIN public.profiles p ON u.id = p.id
  WHERE UPPER(p.username) = UPPER(p_username);
  
  RETURN v_email;
END;
$$;

--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  base_username TEXT;
  final_username TEXT;
  suffix INTEGER := 1;
  v_global_settings JSONB;
BEGIN
  -- Get current global settings from an existing admin/superadmin profile
  SELECT global_settings INTO v_global_settings
  FROM public.profiles
  WHERE role IN ('admin', 'superadmin')
  LIMIT 1;

  IF v_global_settings IS NULL THEN
    v_global_settings := '{"office_leave_default": 14, "eid_fitr_leave": 0, "eid_adha_leave": 0, "govt_holidays": []}'::jsonb;
  END IF;

  base_username := UPPER(COALESCE(NEW.raw_user_meta_data->>'username', SPLIT_PART(NEW.email, '@', 1)));
  final_username := base_username;
  
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = final_username) LOOP
    final_username := base_username || suffix;
    suffix := suffix + 1;
  END LOOP;

  INSERT INTO public.profiles (
    id,
    username,
    full_name,
    role,
    has_chuti_access,
    has_quotes_access,
    can_manage_rules,
    global_settings
  )
  VALUES (
    NEW.id,
    final_username,
    COALESCE(NEW.raw_user_meta_data->>'full_name', final_username),
    COALESCE(NEW.raw_user_meta_data->>'role', 'user'),
    COALESCE((NEW.raw_user_meta_data->>'has_chuti_access')::boolean, true),
    COALESCE((NEW.raw_user_meta_data->>'has_quotes_access')::boolean, true),
    COALESCE((NEW.raw_user_meta_data->>'can_manage_rules')::boolean, false),
    v_global_settings
  );

  RETURN NEW;
END;
$$;

--
-- Name: has_kpi_access(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_kpi_access(supervisor_id uuid, employee_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT
    (auth.role() = 'service_role' OR supervisor_id = auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.profiles employee
      WHERE employee.id = employee_id
        AND (
          supervisor_id = ANY(COALESCE(employee.supervisor_ids, ARRAY[]::uuid[]))
          OR employee.delegated_kpi_supervisor_id = supervisor_id
        )
    );
$$;

--
-- Name: has_leave_access(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_leave_access(supervisor_id uuid, employee_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT
    (auth.role() = 'service_role' OR supervisor_id = auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.profiles employee
      WHERE employee.id = employee_id
        AND (
          supervisor_id = ANY(COALESCE(employee.supervisor_ids, ARRAY[]::uuid[]))
          OR employee.delegated_leave_supervisor_id = supervisor_id
          OR EXISTS (
            SELECT 1
            FROM public.profiles direct_supervisor
            WHERE direct_supervisor.id = ANY(COALESCE(employee.supervisor_ids, ARRAY[]::uuid[]))
              AND direct_supervisor.delegated_supervisor_id = supervisor_id
          )
        )
    );
$$;

--
-- Name: is_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_admin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT public.get_my_role() IN ('admin', 'superadmin');
$$;

--
-- Name: is_admin_or_superadmin(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_admin_or_superadmin(user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $_$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = $1
      AND role IN ('admin', 'superadmin')
  );
$_$;

--
-- Name: is_admin_or_supervisor(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_admin_or_supervisor() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT public.get_my_role() IN ('admin', 'supervisor', 'superadmin');
$$;

--
-- Name: is_superadmin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_superadmin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT public.get_my_role() = 'superadmin';
$$;

--
-- Name: is_supervisor(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_supervisor() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT public.get_my_role() = 'supervisor';
$$;

--
-- Name: reconcile_govt_holiday_adjustments(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reconcile_govt_holiday_adjustments(p_user_id uuid, p_year integer) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_reserved integer;
  v_changed integer;
BEGIN
  SELECT count(*)::integer INTO v_reserved
  FROM public.govt_holiday_responses
  WHERE user_id = p_user_id
    AND response = 'reserve'
    AND holiday_date >= make_date(p_year, 1, 1)
    AND holiday_date < make_date(p_year + 1, 1, 1);

  WITH excess AS (
    SELECT c.id
    FROM public.chuti c
    WHERE c.user_id = p_user_id
      AND c.leave_type = 'Full Leave'
      AND c.adjustment IS TRUE
      AND c.date >= make_date(p_year, 1, 1)
      AND c.date < make_date(p_year + 1, 1, 1)
      AND c.deleted_at IS NULL
      AND (c.reserve_holiday = 'Govt Holiday' OR c.comment ILIKE '%Govt Holiday%')
    ORDER BY c.date ASC, c.created_at ASC
    OFFSET v_reserved
  )
  UPDATE public.chuti c
  SET adjustment = false,
      reserve_holiday = NULL,
      comment = NULLIF(
        btrim(regexp_replace(COALESCE(c.comment, ''), '^Adjusted:\s*Govt Holiday(?:\s*\|\s*)?', '', 'i')),
        ''
      )
  WHERE c.id IN (SELECT id FROM excess);

  GET DIAGNOSTICS v_changed = ROW_COUNT;
  RETURN v_changed;
END;
$$;

--
-- Name: register_active_session(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.register_active_session(p_session_id text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $_$
DECLARE
  v_uid uuid := auth.uid();
  v_now_ms bigint := floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint;
  v_existing jsonb;
  v_sessions jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated.';
  END IF;
  IF p_session_id IS NULL OR p_session_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
    RAISE EXCEPTION 'Invalid session identifier.';
  END IF;

  SELECT CASE
    WHEN jsonb_typeof(global_settings->'active_sessions') = 'array'
      THEN global_settings->'active_sessions'
    ELSE '[]'::jsonb
  END
  INTO v_existing
  FROM public.profiles
  WHERE id = v_uid
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found.';
  END IF;

  SELECT COALESCE(jsonb_agg(entry ORDER BY (entry->>'lastActive')::bigint), '[]'::jsonb)
  INTO v_sessions
  FROM (
    SELECT entry
    FROM (
      SELECT value AS entry
      FROM jsonb_array_elements(v_existing)
      WHERE value ? 'sessionId'
        AND value ? 'lastActive'
        AND value->>'sessionId' <> p_session_id
        AND value->>'lastActive' ~ '^[0-9]+$'
        AND (value->>'lastActive')::bigint > v_now_ms - 604800000
      UNION ALL
      SELECT jsonb_build_object('sessionId', p_session_id, 'lastActive', v_now_ms)
    ) candidates
    ORDER BY (entry->>'lastActive')::bigint DESC
    LIMIT 10
  ) recent;

  PERFORM set_config('app.bypass_profile_security', 'true', true);
  UPDATE public.profiles
  SET global_settings = jsonb_set(
    COALESCE(global_settings, '{}'::jsonb),
    '{active_sessions}',
    v_sessions,
    true
  )
  WHERE id = v_uid;

  RETURN v_sessions;
END;
$_$;

--
-- Name: request_password_reset(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.request_password_reset(p_username text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF auth.role() <> 'service_role' AND session_user NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'Service role required.';
  END IF;

  PERFORM set_config('app.bypass_profile_security', 'true', true);
  UPDATE public.profiles
  SET global_settings = jsonb_set(
    COALESCE(global_settings, '{}'::jsonb),
    '{password_reset_status}',
    '"pending"'::jsonb,
    true
  )
  WHERE upper(username) = upper(btrim(p_username))
    AND COALESCE(global_settings->>'password_reset_status', '') <> 'pending';
END;
$$;

--
-- Name: reset_all_user_feature_flags(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reset_all_user_feature_flags() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'Only a superadmin can reset user feature flags.';
  END IF;

  UPDATE public.profiles
  SET global_settings = global_settings - 'user_feature_flags'
  WHERE global_settings ? 'user_feature_flags';
END;
$$;

--
-- Name: resolve_password_reset(uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.resolve_password_reset(p_user_id uuid, p_approve boolean) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_actor_role text;
  v_target_role text;
BEGIN
  SELECT role INTO v_actor_role FROM public.profiles WHERE id = auth.uid();
  SELECT role INTO v_target_role FROM public.profiles WHERE id = p_user_id FOR UPDATE;

  IF v_target_role IS NULL THEN
    RAISE EXCEPTION 'Target user not found.';
  END IF;
  IF NOT (
    v_actor_role = 'superadmin'
    OR (v_actor_role = 'admin' AND v_target_role IN ('user', 'supervisor'))
  ) THEN
    RAISE EXCEPTION 'Permission denied for this target account.';
  END IF;

  IF p_approve THEN
    PERFORM public.admin_update_user_credentials(p_user_id, NULL, '1234');
  ELSE
    PERFORM set_config('app.bypass_profile_security', 'true', true);
    UPDATE public.profiles
    SET global_settings = jsonb_set(
      COALESCE(global_settings, '{}'::jsonb),
      '{password_reset_status}',
      '"none"'::jsonb,
      true
    )
    WHERE id = p_user_id;
  END IF;
END;
$$;

--
-- Name: save_global_leave_settings(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.save_global_leave_settings(p_settings jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF NOT public.current_user_has_workspace('chuti') THEN
    RAISE EXCEPTION 'Leave workspace access is disabled.';
  END IF;
  PERFORM public.save_global_leave_settings_internal(p_settings);
END;
$$;

--
-- Name: save_global_leave_settings_internal(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.save_global_leave_settings_internal(p_settings jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $_$
DECLARE
  v_old_settings jsonb := '{}'::jsonb;
  v_old_holidays jsonb := '[]'::jsonb;
  v_canonical_holidays jsonb := '[]'::jsonb;
  v_leave_settings jsonb;
  v_item jsonb;
  v_date_text text;
  v_date date;
  v_name text;
  v_created_at text;
  v_old_dates date[] := ARRAY[]::date[];
  v_new_dates date[] := ARRAY[]::date[];
  v_removed_date date;
  v_target_user uuid;
  v_target_year integer;
  v_mode text;
  v_h1 numeric;
  v_h2 numeric;
  v_default numeric;
  v_eid_fitr numeric;
  v_eid_adha numeric;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can change global leave settings.';
  END IF;
  IF jsonb_typeof(p_settings) <> 'object' THEN
    RAISE EXCEPTION 'Leave settings must be a JSON object.';
  END IF;

  SELECT COALESCE(global_settings, '{}'::jsonb)
  INTO v_old_settings
  FROM public.profiles
  WHERE role IN ('superadmin', 'admin')
  ORDER BY CASE WHEN role = 'superadmin' THEN 0 ELSE 1 END, created_at
  LIMIT 1
  FOR UPDATE;

  v_old_holidays := CASE WHEN jsonb_typeof(v_old_settings->'govt_holidays') = 'array'
    THEN v_old_settings->'govt_holidays' ELSE '[]'::jsonb END;

  SELECT COALESCE(array_agg(DISTINCT holiday_date), ARRAY[]::date[])
  INTO v_old_dates
  FROM (
    SELECT CASE
      WHEN jsonb_typeof(value) = 'object' THEN (value->>'date')::date
      ELSE trim(both '"' from value::text)::date
    END AS holiday_date
    FROM jsonb_array_elements(v_old_holidays)
  ) old_items;

  IF jsonb_typeof(COALESCE(p_settings->'govt_holidays', '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'govt_holidays must be an array.';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(COALESCE(p_settings->'govt_holidays', '[]'::jsonb))
  LOOP
    v_date_text := CASE WHEN jsonb_typeof(v_item) = 'object'
      THEN btrim(v_item->>'date')
      ELSE trim(both '"' from v_item::text)
    END;
    BEGIN
      v_date := v_date_text::date;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Invalid government holiday date: %', v_date_text;
    END;

    IF v_date = ANY(v_new_dates) THEN
      RAISE EXCEPTION 'Duplicate government holiday date: %', v_date;
    END IF;

    v_name := CASE WHEN jsonb_typeof(v_item) = 'object'
      THEN btrim(COALESCE(v_item->>'name', ''))
      ELSE ''
    END;
    IF v_name = '' THEN
      RAISE EXCEPTION 'A government holiday name is required for %.', v_date;
    END IF;

    v_created_at := CASE WHEN jsonb_typeof(v_item) = 'object'
      THEN COALESCE(NULLIF(v_item->>'created_at', ''), timezone('utc', now())::text)
      ELSE timezone('utc', now())::text
    END;
    v_new_dates := array_append(v_new_dates, v_date);
    v_canonical_holidays := v_canonical_holidays || jsonb_build_array(
      jsonb_build_object('date', v_date::text, 'name', v_name, 'created_at', v_created_at)
    );
  END LOOP;

  v_mode := COALESCE(NULLIF(p_settings->>'office_leave_mode', ''), 'split');
  IF v_mode NOT IN ('split', 'merged') THEN RAISE EXCEPTION 'Invalid office leave mode.'; END IF;
  v_h1 := COALESCE((p_settings->>'office_leave_h1')::numeric, 7);
  v_h2 := COALESCE((p_settings->>'office_leave_h2')::numeric, 7);
  v_default := COALESCE((p_settings->>'office_leave_default')::numeric, v_h1 + v_h2);
  v_eid_fitr := COALESCE((p_settings->>'eid_fitr_leave')::numeric, 0);
  v_eid_adha := COALESCE((p_settings->>'eid_adha_leave')::numeric, 0);
  IF v_h1 < 0 OR v_h2 < 0 OR v_default < 0 OR v_eid_fitr < 0 OR v_eid_adha < 0
     OR v_h1 > 366 OR v_h2 > 366 OR v_default > 366 OR v_eid_fitr > 366 OR v_eid_adha > 366 THEN
    RAISE EXCEPTION 'Leave quotas must be between 0 and 366.';
  END IF;

  IF COALESCE(p_settings->>'settlement_active_period', '') NOT IN ('', 'H1', 'H2', 'Instant') THEN
    RAISE EXCEPTION 'Invalid settlement period.';
  END IF;
  IF COALESCE(p_settings->>'settlement_active_category', '') NOT IN ('', 'Office Leave', 'Govt Holiday', 'Eid-ul-Fitr', 'Eid-ul-Adha') THEN
    RAISE EXCEPTION 'Invalid settlement category.';
  END IF;
  IF COALESCE(p_settings->>'settlement_active_year', '') <> ''
     AND p_settings->>'settlement_active_year' !~ '^20[0-9]{2}$' THEN
    RAISE EXCEPTION 'Invalid settlement year.';
  END IF;

  v_leave_settings := jsonb_build_object(
    'office_leave_mode', v_mode,
    'office_leave_h1', v_h1,
    'office_leave_h2', v_h2,
    'office_leave_split_h1', COALESCE((p_settings->>'office_leave_split_h1')::numeric, v_h1),
    'office_leave_split_h2', COALESCE((p_settings->>'office_leave_split_h2')::numeric, v_h2),
    'office_leave_default', v_default,
    'eid_fitr_leave', v_eid_fitr,
    'eid_adha_leave', v_eid_adha,
    'govt_holidays', v_canonical_holidays,
    'settlement_active_year', p_settings->'settlement_active_year',
    'settlement_active_period', p_settings->'settlement_active_period',
    'settlement_active_category', p_settings->'settlement_active_category'
  );

  PERFORM set_config('app.bypass_profile_security', 'true', true);
  UPDATE public.profiles
  SET global_settings = COALESCE(global_settings, '{}'::jsonb) || v_leave_settings
  WHERE (COALESCE(global_settings, '{}'::jsonb) || v_leave_settings) IS DISTINCT FROM global_settings;

  -- Delete removed entitlements and reconcile only the affected user/year pairs.
  FOR v_removed_date IN
    SELECT unnest(v_old_dates)
    EXCEPT
    SELECT unnest(v_new_dates)
  LOOP
    FOR v_target_user, v_target_year IN
      SELECT DISTINCT user_id, extract(year FROM holiday_date)::integer
      FROM public.govt_holiday_responses
      WHERE holiday_date = v_removed_date
    LOOP
      DELETE FROM public.govt_holiday_responses
      WHERE user_id = v_target_user AND holiday_date = v_removed_date;
      PERFORM public.reconcile_govt_holiday_adjustments(v_target_user, v_target_year);
    END LOOP;
  END LOOP;

  -- Every eligible user receives an explicit entitlement: reserve when enabled,
  -- otherwise payment. Existing admin conversions are preserved when unrelated
  -- leave settings are saved; only a profile eligibility/preference change may
  -- intentionally recompute them.
  INSERT INTO public.govt_holiday_responses (
    user_id, holiday_date, holiday_name, response, updated_by_admin
  )
  SELECT p.id,
         (h.value->>'date')::date,
         h.value->>'name',
         CASE WHEN p.allow_reserve IS TRUE THEN 'reserve' ELSE 'paid' END,
         true
  FROM public.profiles p
  CROSS JOIN LATERAL jsonb_array_elements(v_canonical_holidays) h(value)
  WHERE p.eligible_govt_holiday IS DISTINCT FROM false
  ON CONFLICT (user_id, holiday_date) DO UPDATE
  SET holiday_name = EXCLUDED.holiday_name
  WHERE public.govt_holiday_responses.holiday_name IS DISTINCT FROM EXCLUDED.holiday_name;

  INSERT INTO public.audit_logs (
    actor_id, actor_codename, action_type, details, metadata
  )
  SELECT auth.uid(), p.username, 'ADJUST_LEAVE', 'Global leave settings changed',
         jsonb_build_object(
           'added_holiday_dates', ARRAY(SELECT unnest(v_new_dates) EXCEPT SELECT unnest(v_old_dates)),
           'removed_holiday_dates', ARRAY(SELECT unnest(v_old_dates) EXCEPT SELECT unnest(v_new_dates))
         )
  FROM public.profiles p
  WHERE p.id = auth.uid();
END;
$_$;

--
-- Name: set_admin_delegated_flags(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_admin_delegated_flags(p_flags jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'Only a superadmin can configure admin delegated feature flags.';
  END IF;

  UPDATE public.profiles
  SET global_settings = jsonb_set(
        COALESCE(global_settings, '{}'::jsonb),
        '{admin_delegated_flags}',
        COALESCE(p_flags, '{}'::jsonb),
        true
      )
  WHERE true;  -- intentional: global_settings is replicated to every row
END;
$$;

--
-- Name: set_feature_flags(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_feature_flags(p_flags jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_actor_role text;
  v_current jsonb := '{}'::jsonb;
  v_delegated jsonb := '{}'::jsonb;
  v_key text;
BEGIN
  IF jsonb_typeof(COALESCE(p_flags, '{}'::jsonb)) <> 'object' THEN
    RAISE EXCEPTION 'Feature flags must be a JSON object.';
  END IF;

  SELECT role,
         COALESCE(global_settings->'feature_flags', '{}'::jsonb),
         COALESCE(global_settings->'admin_delegated_flags', '{}'::jsonb)
  INTO v_actor_role, v_current, v_delegated
  FROM public.profiles
  WHERE id = auth.uid();

  IF v_actor_role <> 'superadmin' THEN
    IF v_actor_role <> 'admin' THEN
      RAISE EXCEPTION 'Only a superadmin or delegated admin can configure feature flags.';
    END IF;
    FOR v_key IN
      SELECT key
      FROM (
        SELECT key, value FROM jsonb_each(COALESCE(p_flags, '{}'::jsonb))
        UNION
        SELECT key, value FROM jsonb_each(v_current)
      ) keys
      GROUP BY key
      HAVING (COALESCE(p_flags, '{}'::jsonb)->key) IS DISTINCT FROM (v_current->key)
    LOOP
      IF COALESCE((v_delegated->>v_key)::boolean, false) IS NOT TRUE THEN
        RAISE EXCEPTION 'Feature flag "%" has not been delegated to admins.', v_key;
      END IF;
    END LOOP;
  END IF;

  PERFORM set_config('app.bypass_profile_security', 'true', true);
  UPDATE public.profiles
  SET global_settings = jsonb_set(
    COALESCE(global_settings, '{}'::jsonb),
    '{feature_flags}',
    COALESCE(p_flags, '{}'::jsonb),
    true
  )
  WHERE (global_settings->'feature_flags') IS DISTINCT FROM COALESCE(p_flags, '{}'::jsonb);
END;
$$;

--
-- Name: set_govt_holiday_response_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_govt_holiday_response_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  NEW.updated_at := timezone('utc', now());
  RETURN NEW;
END;
$$;

--
-- Name: set_role_visibility(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_role_visibility(p_visibility jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'Only a superadmin can configure role visibility.';
  END IF;

  UPDATE public.profiles
  SET global_settings = jsonb_set(
        COALESCE(global_settings, '{}'::jsonb),
        '{role_visibility}',
        COALESCE(p_visibility, '{}'::jsonb),
        true
      )
  WHERE true;  -- intentional: global_settings is replicated to every row
END;
$$;

--
-- Name: set_sanitizer_rules(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_sanitizer_rules(p_rules jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'Only a superadmin can configure the filename sanitizer.';
  END IF;

  UPDATE public.profiles
  SET global_settings = jsonb_set(
        COALESCE(global_settings, '{}'::jsonb),
        '{sanitizer_rules}',
        COALESCE(p_rules, '[]'::jsonb),
        true
      )
  WHERE true;  -- intentional: global_settings is replicated to every row
END;
$$;

--
-- Name: set_sanitizer_words(text[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_sanitizer_words(p_words text[]) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'Only a superadmin can configure the filename sanitizer.';
  END IF;

  UPDATE public.profiles
  SET global_settings = jsonb_set(
        COALESCE(global_settings, '{}'::jsonb),
        '{sanitizer_words}',
        COALESCE(to_jsonb(p_words), '[]'::jsonb),
        true
      )
  WHERE true;  -- intentional: global_settings is replicated to every row
END;
$$;

--
-- Name: set_supervisor_access_overrides(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_supervisor_access_overrides(p_overrides jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only an admin can configure supervisor access overrides.';
  END IF;
  IF jsonb_typeof(COALESCE(p_overrides, '{}'::jsonb)) <> 'object' THEN
    RAISE EXCEPTION 'Supervisor access overrides must be a JSON object.';
  END IF;

  PERFORM set_config('app.bypass_profile_security', 'true', true);
  UPDATE public.profiles
  SET global_settings = jsonb_set(
    COALESCE(global_settings, '{}'::jsonb),
    '{supervisor_access_overrides}',
    COALESCE(p_overrides, '{}'::jsonb),
    true
  )
  WHERE global_settings->'supervisor_access_overrides'
        IS DISTINCT FROM COALESCE(p_overrides, '{}'::jsonb);
END;
$$;

--
-- Name: set_temp_access(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_temp_access(p_entries jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'Only a superadmin can configure temporary access.';
  END IF;

  UPDATE public.profiles
  SET global_settings = jsonb_set(
        COALESCE(global_settings, '{}'::jsonb),
        '{temp_access}',
        COALESCE(p_entries, '[]'::jsonb),
        true
      )
  WHERE true;  -- intentional: global_settings is replicated to every row
END;
$$;

--
-- Name: set_user_hidden_tabs(uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_user_hidden_tabs(p_user_id uuid, p_hidden_tabs jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF auth.uid() <> p_user_id AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: You can only update your own settings.';
  END IF;

  UPDATE public.profiles
  SET global_settings = jsonb_set(
        COALESCE(global_settings, '{}'::jsonb),
        '{hidden_tabs}',
        COALESCE(p_hidden_tabs, '[]'::jsonb),
        true
      )
  WHERE id = p_user_id;
END;
$$;

--
-- Name: sync_profile_govt_holiday_entitlements(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_profile_govt_holiday_entitlements() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_settings jsonb;
  v_year integer;
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.allow_reserve IS NOT DISTINCT FROM OLD.allow_reserve
     AND NEW.eligible_govt_holiday IS NOT DISTINCT FROM OLD.eligible_govt_holiday THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(global_settings, '{}'::jsonb) INTO v_settings
  FROM public.profiles
  WHERE role IN ('superadmin', 'admin') AND id <> NEW.id
  ORDER BY CASE WHEN role = 'superadmin' THEN 0 ELSE 1 END, created_at
  LIMIT 1;
  v_settings := COALESCE(v_settings, NEW.global_settings, '{}'::jsonb);

  IF NEW.eligible_govt_holiday IS FALSE THEN
    FOR v_year IN
      SELECT DISTINCT extract(year FROM holiday_date)::integer
      FROM public.govt_holiday_responses
      WHERE user_id = NEW.id
    LOOP
      DELETE FROM public.govt_holiday_responses WHERE user_id = NEW.id;
      PERFORM public.reconcile_govt_holiday_adjustments(NEW.id, v_year);
    END LOOP;
    RETURN NEW;
  END IF;

  INSERT INTO public.govt_holiday_responses (
    user_id, holiday_date, holiday_name, response, updated_by_admin
  )
  SELECT NEW.id,
         (h.value->>'date')::date,
         h.value->>'name',
         CASE WHEN NEW.allow_reserve IS TRUE THEN 'reserve' ELSE 'paid' END,
         true
  FROM jsonb_array_elements(
    CASE WHEN jsonb_typeof(v_settings->'govt_holidays') = 'array'
      THEN v_settings->'govt_holidays' ELSE '[]'::jsonb END
  ) h(value)
  ON CONFLICT (user_id, holiday_date) DO UPDATE
  SET holiday_name = EXCLUDED.holiday_name,
      response = EXCLUDED.response,
      updated_by_admin = true
  WHERE public.govt_holiday_responses.holiday_name IS DISTINCT FROM EXCLUDED.holiday_name
     OR public.govt_holiday_responses.response IS DISTINCT FROM EXCLUDED.response;

  DELETE FROM public.govt_holiday_responses r
  WHERE r.user_id = NEW.id
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(
        CASE WHEN jsonb_typeof(v_settings->'govt_holidays') = 'array'
          THEN v_settings->'govt_holidays' ELSE '[]'::jsonb END
      ) h(value)
      WHERE (h.value->>'date')::date = r.holiday_date
    );

  IF NEW.allow_reserve IS NOT TRUE THEN
    FOR v_year IN
      SELECT DISTINCT extract(year FROM date_value)::integer
      FROM (
        SELECT (h.value->>'date')::date AS date_value
        FROM jsonb_array_elements(
          CASE WHEN jsonb_typeof(v_settings->'govt_holidays') = 'array'
            THEN v_settings->'govt_holidays' ELSE '[]'::jsonb END
        ) h(value)
      ) years
    LOOP
      PERFORM public.reconcile_govt_holiday_adjustments(NEW.id, v_year);
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

--
-- Name: sync_top_performer_badges(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_top_performer_badges() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_prev_month date := (date_trunc('month', current_date) - interval '1 month')::date;
  v_current_year integer := extract(year FROM current_date)::integer;
  v_user record;
  v_badge jsonb;
BEGIN
  IF session_user NOT IN ('postgres', 'supabase_admin') AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Badge synchronization is a scheduled system operation.';
  END IF;

  PERFORM set_config('app.bypass_profile_security', 'true', true);

  WITH monthly_counts AS (
    SELECT r.user_id,
           date_trunc('month', r.submitted_at AT TIME ZONE 'Asia/Dhaka')::date AS month_start,
           count(*) FILTER (WHERE r.file_type != 'Other Site') AS record_count,
           p.username
    FROM public.records r
    JOIN public.profiles p ON p.id = r.user_id
    WHERE r.submitted_at >= ((v_prev_month - interval '24 months')::timestamp AT TIME ZONE 'Asia/Dhaka')
      AND r.submitted_at < ((v_prev_month + interval '1 month')::timestamp AT TIME ZONE 'Asia/Dhaka')
    GROUP BY r.user_id, date_trunc('month', r.submitted_at AT TIME ZONE 'Asia/Dhaka')::date, p.username
  ),
  monthly_ranks AS (
    SELECT user_id,
           month_start,
           row_number() OVER (PARTITION BY month_start ORDER BY record_count DESC, upper(username), user_id) AS rank
    FROM monthly_counts
  )
  UPDATE public.profiles p
  SET global_settings = COALESCE(p.global_settings, '{}'::jsonb) - 'top_performer_badge'
  WHERE p.global_settings ? 'top_performer_badge'
    AND NOT EXISTS (
      SELECT 1 FROM monthly_ranks r
      WHERE r.user_id = p.id AND r.month_start = v_prev_month AND r.rank <= 5
    );

  FOR v_user IN
    WITH monthly_counts AS (
      SELECT r.user_id,
             date_trunc('month', r.submitted_at AT TIME ZONE 'Asia/Dhaka')::date AS month_start,
             count(*) FILTER (WHERE r.file_type != 'Other Site') AS record_count,
             p.username
      FROM public.records r
      JOIN public.profiles p ON p.id = r.user_id
      WHERE r.submitted_at >= ((v_prev_month - interval '24 months')::timestamp AT TIME ZONE 'Asia/Dhaka')
        AND r.submitted_at < ((v_prev_month + interval '1 month')::timestamp AT TIME ZONE 'Asia/Dhaka')
      GROUP BY r.user_id, date_trunc('month', r.submitted_at AT TIME ZONE 'Asia/Dhaka')::date, p.username
    ),
    monthly_ranks AS (
      SELECT user_id,
             month_start,
             row_number() OVER (PARTITION BY month_start ORDER BY record_count DESC, upper(username), user_id) AS rank
      FROM monthly_counts
    ),
    current_top AS (
      SELECT user_id, rank
      FROM monthly_ranks
      WHERE month_start = v_prev_month AND rank <= 5
    )
    SELECT
      ct.user_id,
      ct.rank,
      (
        SELECT COALESCE(min(offset_value), 25)::integer
        FROM generate_series(0, 24) offset_value
        WHERE NOT EXISTS (
          SELECT 1
          FROM monthly_ranks r
          WHERE r.user_id = ct.user_id
            AND r.month_start = (v_prev_month - (offset_value || ' months')::interval)::date
            AND r.rank <= 5
        )
      ) AS consecutive_months,
      (
        SELECT count(DISTINCT month_start)::integer
        FROM monthly_ranks r
        WHERE r.user_id = ct.user_id
          AND r.rank <= 5
          AND extract(year FROM month_start)::integer = v_current_year
      ) AS yearly_wins
    FROM current_top ct
    ORDER BY ct.rank
  LOOP
    v_badge := jsonb_build_object(
      'userId', v_user.user_id,
      'rank', v_user.rank,
      'badgeType', CASE WHEN v_user.rank <= 3 THEN 'blue' ELSE 'grey' END,
      'monthName', to_char(v_prev_month, 'FMMonth'),
      'consecutiveMonths', v_user.consecutive_months,
      'yearlyTopPerformances', v_user.yearly_wins
    );

    UPDATE public.profiles
    SET global_settings = COALESCE(global_settings, '{}'::jsonb) || jsonb_build_object('top_performer_badge', v_badge)
    WHERE id = v_user.user_id
      AND global_settings->'top_performer_badge' IS DISTINCT FROM v_badge;
  END LOOP;
END;
$$;

--
-- Name: update_chuti_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_chuti_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

--
-- Name: update_compliance_rules_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_compliance_rules_updated_at() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  NEW.updated_at := now();
  NEW.updated_by := auth.uid();
  RETURN NEW;
END;
$$;

--
-- Name: update_global_settings_key(uuid, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_global_settings_key(p_user_id uuid, p_key text, p_value jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF auth.role() = 'service_role' THEN
    NULL;
  ELSIF auth.uid() = p_user_id AND p_key = 'hidden_tabs' THEN
    NULL;
  ELSE
    RAISE EXCEPTION 'Permission denied for global settings key "%".', p_key;
  END IF;

  IF p_key = 'hidden_tabs' AND jsonb_typeof(p_value) <> 'array' THEN
    RAISE EXCEPTION 'hidden_tabs must be an array.';
  END IF;

  PERFORM set_config('app.bypass_profile_security', 'true', true);
  UPDATE public.profiles
  SET global_settings = jsonb_set(COALESCE(global_settings, '{}'::jsonb), ARRAY[p_key], p_value, true)
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target profile not found.';
  END IF;
END;
$$;

--
-- Name: update_records_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_records_updated_at() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

--
-- Name: update_todos_last_activity(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_todos_last_activity() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  NEW.last_activity_at = NOW();
  RETURN NEW;
END;
$$;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    actor_id uuid,
    actor_codename text NOT NULL,
    action_type text NOT NULL,
    target_id text,
    details text NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    target_user_id uuid,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL
);

--
-- Name: chuti; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chuti (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    date date NOT NULL,
    leave_type text NOT NULL,
    adjustment boolean DEFAULT false NOT NULL,
    adjusted_hour interval,
    sign_in_time time without time zone,
    sign_out_time time without time zone,
    leave_hour interval,
    reserve_holiday text,
    reserve_adjustment_status text DEFAULT 'none'::text NOT NULL,
    status text DEFAULT 'pending_supervisor'::text NOT NULL,
    admin_edit_request jsonb,
    admin_edit_status text DEFAULT 'none'::text NOT NULL,
    is_edited boolean DEFAULT false NOT NULL,
    adjust_short_leave boolean DEFAULT false NOT NULL,
    comment text,
    created_at timestamp with time zone DEFAULT now(),
    bulk_id uuid,
    updated_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp with time zone,
    CONSTRAINT chuti_admin_edit_status_check CHECK ((admin_edit_status = ANY (ARRAY['none'::text, 'pending'::text, 'approved'::text, 'rejected'::text]))),
    CONSTRAINT chuti_leave_type_check CHECK ((leave_type = ANY (ARRAY['Short Leave'::text, 'Early Leave'::text, 'Full Leave'::text, 'Overtime'::text]))),
    CONSTRAINT chuti_reserve_adjustment_status_check CHECK ((reserve_adjustment_status = ANY (ARRAY['none'::text, 'pending'::text, 'approved'::text, 'rejected'::text]))),
    CONSTRAINT chuti_status_check CHECK ((status = ANY (ARRAY['pending_supervisor'::text, 'needs_review'::text, 'approved_by_supervisor'::text, 'approved'::text])))
);

--
-- Name: compliance_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.compliance_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    category text NOT NULL,
    sub_category text NOT NULL,
    company_name text,
    company_tags text[],
    title text,
    content text NOT NULL,
    extra_info text,
    is_deleted boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_by uuid,
    CONSTRAINT compliance_rules_category_check CHECK ((category = ANY (ARRAY['announcement'::text, 'fine'::text, 'universal'::text, 'company'::text]))),
    CONSTRAINT compliance_rules_sub_category_check CHECK ((sub_category = ANY (ARRAY['nby_rule'::text, 'general_pricing'::text, 'employment'::text, 'driver_and_usage'::text, 'license_and_residency'::text, 'file_processing'::text, 'branch_priority'::text, 'doc_extensions'::text, 'common_rules'::text])))
);

--
-- Name: dismissed_notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dismissed_notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    notification_id text NOT NULL,
    dismissed_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

--
-- Name: govt_holiday_responses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.govt_holiday_responses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    holiday_date date NOT NULL,
    holiday_name text NOT NULL,
    response text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_by_admin boolean DEFAULT false,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT govt_holiday_responses_response_check CHECK ((response = ANY (ARRAY['paid'::text, 'reserve'::text])))
);

--
-- Name: TABLE govt_holiday_responses; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.govt_holiday_responses IS 'Stores user choices (Get Paid vs Reserve) for each government holiday';

--
-- Name: kpi_assessments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.kpi_assessments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    month_year text NOT NULL,
    emp_id text,
    date_of_joining text,
    department text DEFAULT 'Data Entry'::text,
    appraiser_name text,
    reviewer_name text,
    kpis jsonb DEFAULT '{}'::jsonb NOT NULL,
    appraisee_signed boolean DEFAULT false,
    appraisee_sign_date text,
    appraiser_signed boolean DEFAULT false,
    appraiser_sign_date text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

--
-- Name: leaderboard_archive; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.leaderboard_archive (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    username text NOT NULL,
    full_name text,
    job_role text,
    branch text,
    year integer NOT NULL,
    quotes_count integer DEFAULT 0 NOT NULL,
    requotes_count integer DEFAULT 0 NOT NULL,
    reviews_count integer DEFAULT 0 NOT NULL,
    sales_count integer DEFAULT 0 NOT NULL,
    total_submitted integer DEFAULT 0 NOT NULL,
    rank integer NOT NULL,
    archived_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

--
-- Name: leave_settlements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.leave_settlements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    year character varying(4) NOT NULL,
    period character varying(10) DEFAULT 'H2'::character varying NOT NULL,
    leave_category text NOT NULL,
    remaining_days numeric(10,4) NOT NULL,
    action_type text NOT NULL,
    status text DEFAULT 'initiated'::text NOT NULL,
    processed_by uuid,
    processed_at timestamp with time zone,
    action_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    carry_forward_days numeric(10,4) DEFAULT 0,
    payment_days numeric(10,4) DEFAULT 0,
    adjust_leave_days numeric(10,4) DEFAULT 0,
    CONSTRAINT leave_settlements_action_type_check CHECK ((action_type = ANY (ARRAY['carry_forward'::text, 'payment'::text, 'adjust_leave'::text, 'split'::text]))),
    CONSTRAINT leave_settlements_leave_category_check CHECK ((leave_category = ANY (ARRAY['Govt Holiday'::text, 'Eid-ul-Fitr'::text, 'Eid-ul-Adha'::text, 'Office Leave'::text]))),
    CONSTRAINT leave_settlements_period_check CHECK (((period)::text = ANY ((ARRAY['H1'::character varying, 'H2'::character varying, 'Instant'::character varying])::text[]))),
    CONSTRAINT leave_settlements_status_check CHECK ((status = ANY (ARRAY['initiated'::text, 'responded'::text, 'processed'::text])))
);

--
-- Name: login_codes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.login_codes (
    login_id text NOT NULL,
    code text NOT NULL,
    name text,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

--
-- Name: mobile_app_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mobile_app_versions (
    id bigint NOT NULL,
    version text NOT NULL,
    zip_url text NOT NULL,
    required boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);

--
-- Name: mobile_app_versions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.mobile_app_versions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: mobile_app_versions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.mobile_app_versions_id_seq OWNED BY public.mobile_app_versions.id;

--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    username text NOT NULL,
    role text DEFAULT 'user'::text NOT NULL,
    username_changes integer DEFAULT 0 NOT NULL,
    username_request_status text DEFAULT 'none'::text NOT NULL,
    full_name text,
    working_hours numeric DEFAULT 9.5,
    break_time integer DEFAULT 0,
    is_setup_completed boolean DEFAULT false,
    job_role text,
    requested_full_name text,
    requested_working_hours numeric,
    requested_break_time integer,
    requested_job_role text,
    profile_change_status text DEFAULT 'none'::text NOT NULL,
    default_sign_in text,
    default_sign_out text,
    requested_default_sign_in text,
    requested_default_sign_out text,
    needs_supervisor_approval boolean DEFAULT true,
    allow_reserve boolean DEFAULT false,
    allow_overtime boolean DEFAULT false,
    has_edited_profile boolean DEFAULT false NOT NULL,
    has_changed_password boolean DEFAULT false NOT NULL,
    max_full_leaves integer DEFAULT 15,
    max_short_leaves integer DEFAULT 15,
    eligible_office_leave boolean DEFAULT true,
    eligible_govt_holiday boolean DEFAULT true,
    converted_short_leaves_days integer DEFAULT 0,
    converted_short_leaves_hours numeric DEFAULT 0,
    global_settings jsonb DEFAULT '{"govt_holidays": [], "eid_adha_leave": 0, "eid_fitr_leave": 0, "office_leave_default": 14}'::jsonb,
    supervisor_ids uuid[],
    allowed_types text[] DEFAULT ARRAY['Quote'::text, 'Requote'::text, 'Requote Van'::text, 'Requote Bike'::text, 'Review'::text, 'Review Van'::text, 'Review Bike'::text, 'Individual Review'::text, 'Other Site'::text, 'Van'::text, 'Bike'::text, 'Sale'::text] NOT NULL,
    can_manage_rules boolean DEFAULT false NOT NULL,
    quotes_role text DEFAULT 'user'::text,
    has_chuti_access boolean DEFAULT false,
    has_quotes_access boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    delegated_supervisor_id uuid,
    delegated_leave_supervisor_id uuid,
    delegated_kpi_supervisor_id uuid,
    CONSTRAINT profiles_profile_change_status_check CHECK ((profile_change_status = ANY (ARRAY['none'::text, 'pending'::text, 'approved'::text, 'rejected'::text]))),
    CONSTRAINT profiles_quotes_role_check CHECK ((quotes_role = ANY (ARRAY['admin'::text, 'user'::text]))),
    CONSTRAINT profiles_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'user'::text, 'supervisor'::text, 'superadmin'::text]))),
    CONSTRAINT profiles_username_request_status_check CHECK ((username_request_status = ANY (ARRAY['none'::text, 'pending'::text, 'approved'::text])))
);

--
-- Name: COLUMN profiles.global_settings; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.profiles.global_settings IS 'Global leave quotas and government holidays list stored in JSON format';

--
-- Name: quotation_mistakes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quotation_mistakes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    date date NOT NULL,
    filename text NOT NULL,
    branch text NOT NULL,
    user_id uuid NOT NULL,
    codename text NOT NULL,
    mistake_details text NOT NULL,
    penalty text NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

--
-- Name: records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    file_name text NOT NULL,
    branch_name text NOT NULL,
    codename text NOT NULL,
    file_type text NOT NULL,
    submitted_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT records_file_type_check CHECK ((file_type = ANY (ARRAY['Quote'::text, 'Requote'::text, 'Requote Van'::text, 'Requote Bike'::text, 'Review'::text, 'Review Van'::text, 'Review Bike'::text, 'Individual Review'::text, 'Other Site'::text, 'Van'::text, 'Bike'::text, 'Sale'::text])))
);

--
-- Name: todos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.todos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    codename text NOT NULL,
    task text NOT NULL,
    status text DEFAULT 'Idle'::text NOT NULL,
    comment text,
    todo_date date DEFAULT CURRENT_DATE NOT NULL,
    is_all_time boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    last_activity_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT todos_status_check CHECK ((status = ANY (ARRAY['Idle'::text, 'Working'::text, 'Completed'::text])))
);

--
-- Name: mobile_app_versions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mobile_app_versions ALTER COLUMN id SET DEFAULT nextval('public.mobile_app_versions_id_seq'::regclass);

--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);

--
-- Name: chuti chuti_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chuti
    ADD CONSTRAINT chuti_pkey PRIMARY KEY (id);

--
-- Name: compliance_rules compliance_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_rules
    ADD CONSTRAINT compliance_rules_pkey PRIMARY KEY (id);

--
-- Name: dismissed_notifications dismissed_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dismissed_notifications
    ADD CONSTRAINT dismissed_notifications_pkey PRIMARY KEY (id);

--
-- Name: govt_holiday_responses govt_holiday_responses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.govt_holiday_responses
    ADD CONSTRAINT govt_holiday_responses_pkey PRIMARY KEY (id);

--
-- Name: kpi_assessments kpi_assessments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kpi_assessments
    ADD CONSTRAINT kpi_assessments_pkey PRIMARY KEY (id);

--
-- Name: kpi_assessments kpi_assessments_user_id_month_year_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kpi_assessments
    ADD CONSTRAINT kpi_assessments_user_id_month_year_key UNIQUE (user_id, month_year);

--
-- Name: leaderboard_archive leaderboard_archive_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leaderboard_archive
    ADD CONSTRAINT leaderboard_archive_pkey PRIMARY KEY (id);

--
-- Name: leaderboard_archive leaderboard_archive_username_year_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leaderboard_archive
    ADD CONSTRAINT leaderboard_archive_username_year_unique UNIQUE (username, year);

--
-- Name: leave_settlements leave_settlements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_settlements
    ADD CONSTRAINT leave_settlements_pkey PRIMARY KEY (id);

--
-- Name: login_codes login_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.login_codes
    ADD CONSTRAINT login_codes_pkey PRIMARY KEY (login_id);

--
-- Name: mobile_app_versions mobile_app_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mobile_app_versions
    ADD CONSTRAINT mobile_app_versions_pkey PRIMARY KEY (id);

--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);

--
-- Name: profiles profiles_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_username_key UNIQUE (username);

--
-- Name: quotation_mistakes quotation_mistakes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotation_mistakes
    ADD CONSTRAINT quotation_mistakes_pkey PRIMARY KEY (id);

--
-- Name: records records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.records
    ADD CONSTRAINT records_pkey PRIMARY KEY (id);

--
-- Name: todos todos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.todos
    ADD CONSTRAINT todos_pkey PRIMARY KEY (id);

--
-- Name: govt_holiday_responses unique_user_holiday; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.govt_holiday_responses
    ADD CONSTRAINT unique_user_holiday UNIQUE (user_id, holiday_date);

--
-- Name: dismissed_notifications unique_user_notification; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dismissed_notifications
    ADD CONSTRAINT unique_user_notification UNIQUE (user_id, notification_id);

--
-- Name: leave_settlements unique_user_year_period_category; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_settlements
    ADD CONSTRAINT unique_user_year_period_category UNIQUE (user_id, year, period, leave_category);

--
-- Name: idx_audit_logs_action_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_action_created_at ON public.audit_logs USING btree (action_type, created_at DESC);

--
-- Name: idx_audit_logs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_created_at ON public.audit_logs USING btree (created_at DESC);

--
-- Name: idx_audit_logs_target_user_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_target_user_created_at ON public.audit_logs USING btree (target_user_id, created_at DESC) WHERE (target_user_id IS NOT NULL);

--
-- Name: idx_chuti_bulk_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chuti_bulk_id ON public.chuti USING btree (bulk_id) WHERE (bulk_id IS NOT NULL);

--
-- Name: idx_chuti_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chuti_deleted_at ON public.chuti USING btree (deleted_at);

--
-- Name: idx_chuti_pending_adjustments; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chuti_pending_adjustments ON public.chuti USING btree (reserve_adjustment_status, date DESC) WHERE ((deleted_at IS NULL) AND (reserve_adjustment_status = 'pending'::text));

--
-- Name: idx_chuti_pending_status_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chuti_pending_status_date ON public.chuti USING btree (status, date DESC) WHERE (deleted_at IS NULL);

--
-- Name: idx_chuti_updated_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chuti_updated_at ON public.chuti USING btree (updated_at);

--
-- Name: idx_chuti_user_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chuti_user_date ON public.chuti USING btree (user_id, date);

--
-- Name: idx_govt_holiday_responses_date_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_govt_holiday_responses_date_user ON public.govt_holiday_responses USING btree (holiday_date, user_id);

--
-- Name: idx_leaderboard_archive_year; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leaderboard_archive_year ON public.leaderboard_archive USING btree (year, rank);

--
-- Name: idx_leave_settlements_user_year; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leave_settlements_user_year ON public.leave_settlements USING btree (user_id, year);

--
-- Name: idx_quotation_mistakes_branch; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quotation_mistakes_branch ON public.quotation_mistakes USING btree (branch);

--
-- Name: idx_quotation_mistakes_branch_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quotation_mistakes_branch_date ON public.quotation_mistakes USING btree (branch, date DESC, id DESC);

--
-- Name: idx_quotation_mistakes_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quotation_mistakes_created_at ON public.quotation_mistakes USING btree (created_at DESC);

--
-- Name: idx_quotation_mistakes_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quotation_mistakes_date ON public.quotation_mistakes USING btree (date);

--
-- Name: idx_quotation_mistakes_user_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quotation_mistakes_user_date ON public.quotation_mistakes USING btree (user_id, date DESC, id DESC);

--
-- Name: idx_quotation_mistakes_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quotation_mistakes_user_id ON public.quotation_mistakes USING btree (user_id);

--
-- Name: idx_records_sale_submitted; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_records_sale_submitted ON public.records USING btree (submitted_at) WHERE (file_type = 'Sale'::text);

--
-- Name: idx_records_submitted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_records_submitted_at ON public.records USING btree (submitted_at);

--
-- Name: idx_records_updated_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_records_updated_at ON public.records USING btree (updated_at);

--
-- Name: idx_records_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_records_user_id ON public.records USING btree (user_id);

--
-- Name: idx_records_user_submitted; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_records_user_submitted ON public.records USING btree (user_id, submitted_at);

--
-- Name: idx_todos_last_activity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_todos_last_activity ON public.todos USING btree (user_id, todo_date, last_activity_at DESC);

--
-- Name: idx_todos_todo_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_todos_todo_date ON public.todos USING btree (todo_date);

--
-- Name: idx_todos_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_todos_user_id ON public.todos USING btree (user_id);

--
-- Name: unique_user_date; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX unique_user_date ON public.chuti USING btree (user_id, date) WHERE (deleted_at IS NULL);

--
-- Name: uq_records_user_file_submitted; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_records_user_file_submitted ON public.records USING btree (user_id, file_name, submitted_at);

--
-- Name: chuti audit_chuti_changes; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_chuti_changes AFTER INSERT OR DELETE OR UPDATE ON public.chuti FOR EACH ROW EXECUTE FUNCTION public.audit_business_row_change();

--
-- Name: govt_holiday_responses audit_govt_holiday_response_changes; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_govt_holiday_response_changes AFTER INSERT OR DELETE OR UPDATE ON public.govt_holiday_responses FOR EACH ROW EXECUTE FUNCTION public.audit_business_row_change();

--
-- Name: leave_settlements audit_leave_settlement_changes; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_leave_settlement_changes AFTER INSERT OR DELETE OR UPDATE ON public.leave_settlements FOR EACH ROW EXECUTE FUNCTION public.audit_business_row_change();

--
-- Name: quotation_mistakes audit_quotation_mistake_changes; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_quotation_mistake_changes AFTER INSERT OR DELETE OR UPDATE ON public.quotation_mistakes FOR EACH ROW EXECUTE FUNCTION public.audit_business_row_change();

--
-- Name: chuti chuti_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER chuti_set_updated_at BEFORE UPDATE ON public.chuti FOR EACH ROW EXECUTE FUNCTION public.update_chuti_updated_at();

--
-- Name: chuti enforce_chuti_write_permissions_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enforce_chuti_write_permissions_trigger BEFORE INSERT OR UPDATE ON public.chuti FOR EACH ROW EXECUTE FUNCTION public.enforce_chuti_write_permissions();

--
-- Name: kpi_assessments enforce_kpi_assessment_permissions_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enforce_kpi_assessment_permissions_trigger BEFORE INSERT OR UPDATE ON public.kpi_assessments FOR EACH ROW EXECUTE FUNCTION public.enforce_kpi_assessment_permissions();

--
-- Name: leave_settlements enforce_leave_settlement_permissions_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enforce_leave_settlement_permissions_trigger BEFORE INSERT OR UPDATE ON public.leave_settlements FOR EACH ROW EXECUTE FUNCTION public.enforce_leave_settlement_permissions();

--
-- Name: quotation_mistakes enforce_quotation_mistake_metadata_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enforce_quotation_mistake_metadata_trigger BEFORE INSERT OR UPDATE ON public.quotation_mistakes FOR EACH ROW EXECUTE FUNCTION public.enforce_quotation_mistake_metadata();

--
-- Name: govt_holiday_responses govt_holiday_response_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER govt_holiday_response_set_updated_at BEFORE UPDATE ON public.govt_holiday_responses FOR EACH ROW EXECUTE FUNCTION public.set_govt_holiday_response_updated_at();

--
-- Name: profiles on_profile_role_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_profile_role_update BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.check_profile_role_change();

--
-- Name: profiles on_profile_update_security; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_profile_update_security BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.check_profile_updates();

--
-- Name: records records_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER records_set_updated_at BEFORE UPDATE ON public.records FOR EACH ROW EXECUTE FUNCTION public.update_records_updated_at();

--
-- Name: profiles sync_profile_govt_holiday_entitlements_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER sync_profile_govt_holiday_entitlements_trigger AFTER INSERT OR UPDATE OF allow_reserve, eligible_govt_holiday ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.sync_profile_govt_holiday_entitlements();

--
-- Name: todos todos_set_last_activity; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER todos_set_last_activity BEFORE UPDATE ON public.todos FOR EACH ROW EXECUTE FUNCTION public.update_todos_last_activity();

--
-- Name: compliance_rules trg_update_compliance_rules_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_update_compliance_rules_updated_at BEFORE UPDATE ON public.compliance_rules FOR EACH ROW EXECUTE FUNCTION public.update_compliance_rules_updated_at();

--
-- Name: audit_logs audit_logs_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

--
-- Name: audit_logs audit_logs_target_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_target_user_id_fkey FOREIGN KEY (target_user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

--
-- Name: chuti chuti_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chuti
    ADD CONSTRAINT chuti_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

--
-- Name: compliance_rules compliance_rules_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_rules
    ADD CONSTRAINT compliance_rules_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

--
-- Name: dismissed_notifications dismissed_notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dismissed_notifications
    ADD CONSTRAINT dismissed_notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

--
-- Name: govt_holiday_responses govt_holiday_responses_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.govt_holiday_responses
    ADD CONSTRAINT govt_holiday_responses_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

--
-- Name: kpi_assessments kpi_assessments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kpi_assessments
    ADD CONSTRAINT kpi_assessments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

--
-- Name: leaderboard_archive leaderboard_archive_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leaderboard_archive
    ADD CONSTRAINT leaderboard_archive_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

--
-- Name: leave_settlements leave_settlements_action_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_settlements
    ADD CONSTRAINT leave_settlements_action_by_fkey FOREIGN KEY (action_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

--
-- Name: leave_settlements leave_settlements_processed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_settlements
    ADD CONSTRAINT leave_settlements_processed_by_fkey FOREIGN KEY (processed_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

--
-- Name: leave_settlements leave_settlements_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_settlements
    ADD CONSTRAINT leave_settlements_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

--
-- Name: profiles profiles_delegated_kpi_supervisor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_delegated_kpi_supervisor_id_fkey FOREIGN KEY (delegated_kpi_supervisor_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

--
-- Name: profiles profiles_delegated_leave_supervisor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_delegated_leave_supervisor_id_fkey FOREIGN KEY (delegated_leave_supervisor_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

--
-- Name: profiles profiles_delegated_supervisor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_delegated_supervisor_id_fkey FOREIGN KEY (delegated_supervisor_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: quotation_mistakes quotation_mistakes_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotation_mistakes
    ADD CONSTRAINT quotation_mistakes_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

--
-- Name: quotation_mistakes quotation_mistakes_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotation_mistakes
    ADD CONSTRAINT quotation_mistakes_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

--
-- Name: quotation_mistakes quotation_mistakes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotation_mistakes
    ADD CONSTRAINT quotation_mistakes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

--
-- Name: records records_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.records
    ADD CONSTRAINT records_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

--
-- Name: todos todos_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.todos
    ADD CONSTRAINT todos_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

--
-- Name: dismissed_notifications Admins can do everything on dismissed notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can do everything on dismissed notifications" ON public.dismissed_notifications USING (public.is_admin());

--
-- Name: govt_holiday_responses Admins can read all holiday responses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can read all holiday responses" ON public.govt_holiday_responses FOR SELECT TO authenticated USING ((public.current_user_has_workspace('chuti'::text) AND public.is_admin()));

--
-- Name: govt_holiday_responses Admins can update/delete responses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update/delete responses" ON public.govt_holiday_responses TO authenticated USING ((public.current_user_has_workspace('chuti'::text) AND public.is_admin())) WITH CHECK ((public.current_user_has_workspace('chuti'::text) AND public.is_admin()));

--
-- Name: login_codes Allow admins & supervisors to manage login codes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow admins & supervisors to manage login codes" ON public.login_codes TO authenticated USING ((public.current_user_has_workspace('quotes'::text) AND (public.is_admin() OR public.is_supervisor()))) WITH CHECK ((public.current_user_has_workspace('quotes'::text) AND (public.is_admin() OR public.is_supervisor())));

--
-- Name: profiles Allow admins to insert profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow admins to insert profiles" ON public.profiles FOR INSERT WITH CHECK (public.is_admin());

--
-- Name: compliance_rules Allow authenticated to read compliance rules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated to read compliance rules" ON public.compliance_rules FOR SELECT TO authenticated USING ((public.current_user_has_workspace('quotes'::text) AND ((NOT is_deleted) OR (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND ((p.role = ANY (ARRAY['admin'::text, 'superadmin'::text, 'supervisor'::text])) OR (p.can_manage_rules IS TRUE))))))));

--
-- Name: login_codes Allow authenticated to read login codes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated to read login codes" ON public.login_codes FOR SELECT TO authenticated USING (public.current_user_has_workspace('quotes'::text));

--
-- Name: compliance_rules Allow authorized editors to delete rules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authorized editors to delete rules" ON public.compliance_rules FOR DELETE TO authenticated USING ((public.current_user_has_workspace('quotes'::text) AND (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND ((p.role = ANY (ARRAY['admin'::text, 'superadmin'::text, 'supervisor'::text])) OR (p.can_manage_rules IS TRUE)))))));

--
-- Name: compliance_rules Allow authorized editors to insert rules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authorized editors to insert rules" ON public.compliance_rules FOR INSERT TO authenticated WITH CHECK ((public.current_user_has_workspace('quotes'::text) AND (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND ((p.role = ANY (ARRAY['admin'::text, 'superadmin'::text, 'supervisor'::text])) OR (p.can_manage_rules IS TRUE)))))));

--
-- Name: compliance_rules Allow authorized editors to update rules; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authorized editors to update rules" ON public.compliance_rules FOR UPDATE TO authenticated USING ((public.current_user_has_workspace('quotes'::text) AND (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND ((p.role = ANY (ARRAY['admin'::text, 'superadmin'::text, 'supervisor'::text])) OR (p.can_manage_rules IS TRUE))))))) WITH CHECK ((public.current_user_has_workspace('quotes'::text) AND (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND ((p.role = ANY (ARRAY['admin'::text, 'superadmin'::text, 'supervisor'::text])) OR (p.can_manage_rules IS TRUE)))))));

--
-- Name: mobile_app_versions Allow public read access to mobile_app_versions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public read access to mobile_app_versions" ON public.mobile_app_versions FOR SELECT USING (true);

--
-- Name: todos Allow users to delete own todos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow users to delete own todos" ON public.todos FOR DELETE TO authenticated USING ((auth.uid() = user_id));

--
-- Name: todos Allow users to insert own todos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow users to insert own todos" ON public.todos FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));

--
-- Name: profiles Allow users to insert their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow users to insert their own profile" ON public.profiles FOR INSERT WITH CHECK (((auth.uid() = id) AND (role = 'user'::text)));

--
-- Name: todos Allow users to read own todos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow users to read own todos" ON public.todos FOR SELECT TO authenticated USING ((auth.uid() = user_id));

--
-- Name: todos Allow users to update own todos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow users to update own todos" ON public.todos FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

--
-- Name: leaderboard_archive Authenticated users can read leaderboard archive; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can read leaderboard archive" ON public.leaderboard_archive FOR SELECT TO authenticated USING (true);

--
-- Name: quotation_mistakes Feature-controlled quotation mistake deletes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Feature-controlled quotation mistake deletes" ON public.quotation_mistakes FOR DELETE TO authenticated USING ((public.current_user_has_workspace('quotes'::text) AND public.can_write_quotation_mistakes()));

--
-- Name: quotation_mistakes Feature-controlled quotation mistake inserts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Feature-controlled quotation mistake inserts" ON public.quotation_mistakes FOR INSERT TO authenticated WITH CHECK ((public.current_user_has_workspace('quotes'::text) AND public.can_write_quotation_mistakes()));

--
-- Name: quotation_mistakes Feature-controlled quotation mistake updates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Feature-controlled quotation mistake updates" ON public.quotation_mistakes FOR UPDATE TO authenticated USING ((public.current_user_has_workspace('quotes'::text) AND public.can_write_quotation_mistakes())) WITH CHECK ((public.current_user_has_workspace('quotes'::text) AND public.can_write_quotation_mistakes()));

--
-- Name: profiles Role-hierarchical profile deletion; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Role-hierarchical profile deletion" ON public.profiles FOR DELETE TO authenticated USING (((public.is_superadmin() AND (id <> ( SELECT auth.uid() AS uid))) OR ((public.get_my_role() = 'admin'::text) AND (role = ANY (ARRAY['user'::text, 'supervisor'::text])))));

--
-- Name: profiles Role-scoped profile reads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Role-scoped profile reads" ON public.profiles FOR SELECT TO authenticated USING (public.can_read_profile(id));

--
-- Name: quotation_mistakes Role-scoped quotation mistake reads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Role-scoped quotation mistake reads" ON public.quotation_mistakes FOR SELECT TO authenticated USING ((public.current_user_has_workspace('quotes'::text) AND ((user_id = ( SELECT auth.uid() AS uid)) OR (public.get_my_role() = ANY (ARRAY['admin'::text, 'superadmin'::text, 'supervisor'::text])))));

--
-- Name: kpi_assessments Scoped KPI assessment deletion; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Scoped KPI assessment deletion" ON public.kpi_assessments FOR DELETE TO authenticated USING ((public.is_admin() OR (public.is_supervisor() AND public.has_kpi_access(( SELECT auth.uid() AS uid), user_id))));

--
-- Name: kpi_assessments Scoped KPI assessment inserts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Scoped KPI assessment inserts" ON public.kpi_assessments FOR INSERT TO authenticated WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) OR public.is_admin() OR (public.is_supervisor() AND public.has_kpi_access(( SELECT auth.uid() AS uid), user_id))));

--
-- Name: kpi_assessments Scoped KPI assessment reads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Scoped KPI assessment reads" ON public.kpi_assessments FOR SELECT TO authenticated USING (((user_id = ( SELECT auth.uid() AS uid)) OR public.is_admin() OR (public.is_supervisor() AND public.has_kpi_access(( SELECT auth.uid() AS uid), user_id))));

--
-- Name: kpi_assessments Scoped KPI assessment updates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Scoped KPI assessment updates" ON public.kpi_assessments FOR UPDATE TO authenticated USING (((user_id = ( SELECT auth.uid() AS uid)) OR public.is_admin() OR (public.is_supervisor() AND public.has_kpi_access(( SELECT auth.uid() AS uid), user_id)))) WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) OR public.is_admin() OR (public.is_supervisor() AND public.has_kpi_access(( SELECT auth.uid() AS uid), user_id))));

--
-- Name: audit_logs Scoped audit log visibility; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Scoped audit log visibility" ON public.audit_logs FOR SELECT TO authenticated USING ((public.is_admin() OR (actor_id = ( SELECT auth.uid() AS uid)) OR (target_user_id = ( SELECT auth.uid() AS uid)) OR (public.is_supervisor() AND (target_user_id IS NOT NULL) AND public.has_leave_access(( SELECT auth.uid() AS uid), target_user_id))));

--
-- Name: chuti Scoped leave deletion; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Scoped leave deletion" ON public.chuti FOR DELETE TO authenticated USING ((public.current_user_has_workspace('chuti'::text) AND (public.is_admin() OR (public.is_supervisor() AND public.has_leave_access(( SELECT auth.uid() AS uid), user_id)) OR ((user_id = ( SELECT auth.uid() AS uid)) AND (status = ANY (ARRAY['pending_supervisor'::text, 'approved_by_supervisor'::text, 'needs_review'::text]))))));

--
-- Name: chuti Scoped leave insertion; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Scoped leave insertion" ON public.chuti FOR INSERT TO authenticated WITH CHECK ((public.current_user_has_workspace('chuti'::text) AND ((user_id = ( SELECT auth.uid() AS uid)) OR public.is_admin() OR (public.is_supervisor() AND public.has_leave_access(( SELECT auth.uid() AS uid), user_id)))));

--
-- Name: chuti Scoped leave read access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Scoped leave read access" ON public.chuti FOR SELECT TO authenticated USING ((public.current_user_has_workspace('chuti'::text) AND ((user_id = ( SELECT auth.uid() AS uid)) OR public.is_admin() OR (public.is_supervisor() AND public.has_leave_access(( SELECT auth.uid() AS uid), user_id)))));

--
-- Name: chuti Scoped leave updates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Scoped leave updates" ON public.chuti FOR UPDATE TO authenticated USING ((public.current_user_has_workspace('chuti'::text) AND ((user_id = ( SELECT auth.uid() AS uid)) OR public.is_admin() OR (public.is_supervisor() AND public.has_leave_access(( SELECT auth.uid() AS uid), user_id))))) WITH CHECK ((public.current_user_has_workspace('chuti'::text) AND ((user_id = ( SELECT auth.uid() AS uid)) OR public.is_admin() OR (public.is_supervisor() AND public.has_leave_access(( SELECT auth.uid() AS uid), user_id)))));

--
-- Name: profiles Scoped profile updates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Scoped profile updates" ON public.profiles FOR UPDATE TO authenticated USING (((id = ( SELECT auth.uid() AS uid)) OR public.is_superadmin() OR ((public.get_my_role() = 'admin'::text) AND (role = ANY (ARRAY['user'::text, 'supervisor'::text]))) OR (public.is_supervisor() AND (role = 'user'::text) AND public.has_leave_access(( SELECT auth.uid() AS uid), id)))) WITH CHECK (((id = ( SELECT auth.uid() AS uid)) OR public.is_superadmin() OR ((public.get_my_role() = 'admin'::text) AND (role = ANY (ARRAY['user'::text, 'supervisor'::text]))) OR (public.is_supervisor() AND (role = 'user'::text) AND public.has_leave_access(( SELECT auth.uid() AS uid), id))));

--
-- Name: records Scoped records deletion; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Scoped records deletion" ON public.records FOR DELETE TO authenticated USING ((public.current_user_has_workspace('quotes'::text) AND ((user_id = ( SELECT auth.uid() AS uid)) OR public.is_admin() OR (public.is_supervisor() AND public.has_leave_access(( SELECT auth.uid() AS uid), user_id)))));

--
-- Name: records Scoped records insertion; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Scoped records insertion" ON public.records FOR INSERT TO authenticated WITH CHECK ((public.current_user_has_workspace('quotes'::text) AND ((user_id = ( SELECT auth.uid() AS uid)) OR public.is_admin() OR (public.is_supervisor() AND public.has_leave_access(( SELECT auth.uid() AS uid), user_id)))));

--
-- Name: records Scoped records read access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Scoped records read access" ON public.records FOR SELECT TO authenticated USING ((public.current_user_has_workspace('quotes'::text) AND ((user_id = ( SELECT auth.uid() AS uid)) OR public.is_admin() OR (public.is_supervisor() AND public.has_leave_access(( SELECT auth.uid() AS uid), user_id)))));

--
-- Name: records Scoped records updates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Scoped records updates" ON public.records FOR UPDATE TO authenticated USING ((public.current_user_has_workspace('quotes'::text) AND ((user_id = ( SELECT auth.uid() AS uid)) OR public.is_admin() OR (public.is_supervisor() AND public.has_leave_access(( SELECT auth.uid() AS uid), user_id))))) WITH CHECK ((public.current_user_has_workspace('quotes'::text) AND ((user_id = ( SELECT auth.uid() AS uid)) OR public.is_admin() OR (public.is_supervisor() AND public.has_leave_access(( SELECT auth.uid() AS uid), user_id)))));

--
-- Name: leave_settlements Scoped settlement management; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Scoped settlement management" ON public.leave_settlements TO authenticated USING ((public.current_user_has_workspace('chuti'::text) AND (public.is_admin() OR (public.is_supervisor() AND public.has_leave_access(( SELECT auth.uid() AS uid), user_id))))) WITH CHECK ((public.current_user_has_workspace('chuti'::text) AND (public.is_admin() OR (public.is_supervisor() AND public.has_leave_access(( SELECT auth.uid() AS uid), user_id)))));

--
-- Name: leave_settlements Scoped settlement read access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Scoped settlement read access" ON public.leave_settlements FOR SELECT TO authenticated USING ((public.current_user_has_workspace('chuti'::text) AND ((user_id = ( SELECT auth.uid() AS uid)) OR public.is_admin() OR (public.is_supervisor() AND public.has_leave_access(( SELECT auth.uid() AS uid), user_id)))));

--
-- Name: dismissed_notifications Users can delete own dismissed notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own dismissed notifications" ON public.dismissed_notifications FOR DELETE USING ((auth.uid() = user_id));

--
-- Name: dismissed_notifications Users can insert own dismissed notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own dismissed notifications" ON public.dismissed_notifications FOR INSERT WITH CHECK ((auth.uid() = user_id));

--
-- Name: dismissed_notifications Users can read own dismissed notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read own dismissed notifications" ON public.dismissed_notifications FOR SELECT USING ((auth.uid() = user_id));

--
-- Name: govt_holiday_responses Users can read own holiday responses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read own holiday responses" ON public.govt_holiday_responses FOR SELECT TO authenticated USING ((public.current_user_has_workspace('chuti'::text) AND (user_id = ( SELECT auth.uid() AS uid))));

--
-- Name: leave_settlements Users can revise own settlement response; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can revise own settlement response" ON public.leave_settlements FOR UPDATE TO authenticated USING ((public.current_user_has_workspace('chuti'::text) AND (user_id = ( SELECT auth.uid() AS uid)) AND (status = ANY (ARRAY['initiated'::text, 'responded'::text])))) WITH CHECK ((public.current_user_has_workspace('chuti'::text) AND (user_id = ( SELECT auth.uid() AS uid)) AND (status = 'responded'::text) AND (processed_by IS NULL) AND (processed_at IS NULL)));

--
-- Name: leave_settlements Users can submit own settlement response; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can submit own settlement response" ON public.leave_settlements FOR INSERT TO authenticated WITH CHECK ((public.current_user_has_workspace('chuti'::text) AND (user_id = ( SELECT auth.uid() AS uid)) AND (status = 'responded'::text) AND (processed_by IS NULL) AND (processed_at IS NULL)));

--
-- Name: audit_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: chuti; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chuti ENABLE ROW LEVEL SECURITY;

--
-- Name: compliance_rules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.compliance_rules ENABLE ROW LEVEL SECURITY;

--
-- Name: dismissed_notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.dismissed_notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: govt_holiday_responses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.govt_holiday_responses ENABLE ROW LEVEL SECURITY;

--
-- Name: kpi_assessments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.kpi_assessments ENABLE ROW LEVEL SECURITY;

--
-- Name: leaderboard_archive; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.leaderboard_archive ENABLE ROW LEVEL SECURITY;

--
-- Name: leave_settlements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.leave_settlements ENABLE ROW LEVEL SECURITY;

--
-- Name: login_codes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.login_codes ENABLE ROW LEVEL SECURITY;

--
-- Name: mobile_app_versions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mobile_app_versions ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: quotation_mistakes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.quotation_mistakes ENABLE ROW LEVEL SECURITY;

--
-- Name: records; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.records ENABLE ROW LEVEL SECURITY;

--
-- Name: todos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.todos ENABLE ROW LEVEL SECURITY;

--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;

--
-- Name: FUNCTION admin_insert_chuti_records_bulk(p_user_id uuid, p_dates date[], p_leave_type text, p_adjustments boolean[], p_adjust_short_leave boolean, p_sign_in_time time without time zone, p_sign_out_time time without time zone, p_leave_hour interval, p_reserve_holiday text, p_comment text, p_bulk_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_insert_chuti_records_bulk(p_user_id uuid, p_dates date[], p_leave_type text, p_adjustments boolean[], p_adjust_short_leave boolean, p_sign_in_time time without time zone, p_sign_out_time time without time zone, p_leave_hour interval, p_reserve_holiday text, p_comment text, p_bulk_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_insert_chuti_records_bulk(p_user_id uuid, p_dates date[], p_leave_type text, p_adjustments boolean[], p_adjust_short_leave boolean, p_sign_in_time time without time zone, p_sign_out_time time without time zone, p_leave_hour interval, p_reserve_holiday text, p_comment text, p_bulk_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.admin_insert_chuti_records_bulk(p_user_id uuid, p_dates date[], p_leave_type text, p_adjustments boolean[], p_adjust_short_leave boolean, p_sign_in_time time without time zone, p_sign_out_time time without time zone, p_leave_hour interval, p_reserve_holiday text, p_comment text, p_bulk_id uuid) TO service_role;

--
-- Name: FUNCTION admin_insert_chuti_records_bulk_internal(p_user_id uuid, p_dates date[], p_leave_type text, p_adjustments boolean[], p_adjust_short_leave boolean, p_sign_in_time time without time zone, p_sign_out_time time without time zone, p_leave_hour interval, p_reserve_holiday text, p_comment text, p_bulk_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_insert_chuti_records_bulk_internal(p_user_id uuid, p_dates date[], p_leave_type text, p_adjustments boolean[], p_adjust_short_leave boolean, p_sign_in_time time without time zone, p_sign_out_time time without time zone, p_leave_hour interval, p_reserve_holiday text, p_comment text, p_bulk_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_insert_chuti_records_bulk_internal(p_user_id uuid, p_dates date[], p_leave_type text, p_adjustments boolean[], p_adjust_short_leave boolean, p_sign_in_time time without time zone, p_sign_out_time time without time zone, p_leave_hour interval, p_reserve_holiday text, p_comment text, p_bulk_id uuid) TO service_role;

--
-- Name: FUNCTION admin_update_user_credentials(p_user_id uuid, p_new_username text, p_new_password text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_update_user_credentials(p_user_id uuid, p_new_username text, p_new_password text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_update_user_credentials(p_user_id uuid, p_new_username text, p_new_password text) TO authenticated;
GRANT ALL ON FUNCTION public.admin_update_user_credentials(p_user_id uuid, p_new_username text, p_new_password text) TO service_role;

--
-- Name: FUNCTION archive_and_prune_old_records(p_tz text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.archive_and_prune_old_records(p_tz text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.archive_and_prune_old_records(p_tz text) TO service_role;

--
-- Name: FUNCTION audit_business_row_change(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.audit_business_row_change() FROM PUBLIC;
GRANT ALL ON FUNCTION public.audit_business_row_change() TO service_role;

--
-- Name: FUNCTION can_read_profile(p_target_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.can_read_profile(p_target_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.can_read_profile(p_target_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.can_read_profile(p_target_id uuid) TO service_role;

--
-- Name: FUNCTION can_write_quotation_mistakes(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.can_write_quotation_mistakes() FROM PUBLIC;
GRANT ALL ON FUNCTION public.can_write_quotation_mistakes() TO authenticated;
GRANT ALL ON FUNCTION public.can_write_quotation_mistakes() TO service_role;

--
-- Name: FUNCTION change_default_password(p_new_password text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.change_default_password(p_new_password text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.change_default_password(p_new_password text) TO authenticated;
GRANT ALL ON FUNCTION public.change_default_password(p_new_password text) TO service_role;

--
-- Name: FUNCTION check_profile_role_change(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.check_profile_role_change() FROM PUBLIC;
GRANT ALL ON FUNCTION public.check_profile_role_change() TO service_role;

--
-- Name: FUNCTION check_profile_updates(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.check_profile_updates() FROM PUBLIC;
GRANT ALL ON FUNCTION public.check_profile_updates() TO service_role;

--
-- Name: FUNCTION complete_leave_profile_setup(p_full_name text, p_working_hours numeric, p_break_time integer, p_job_role text, p_default_sign_in time without time zone, p_default_sign_out time without time zone); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.complete_leave_profile_setup(p_full_name text, p_working_hours numeric, p_break_time integer, p_job_role text, p_default_sign_in time without time zone, p_default_sign_out time without time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION public.complete_leave_profile_setup(p_full_name text, p_working_hours numeric, p_break_time integer, p_job_role text, p_default_sign_in time without time zone, p_default_sign_out time without time zone) TO authenticated;
GRANT ALL ON FUNCTION public.complete_leave_profile_setup(p_full_name text, p_working_hours numeric, p_break_time integer, p_job_role text, p_default_sign_in time without time zone, p_default_sign_out time without time zone) TO service_role;

--
-- Name: FUNCTION complete_profile_setup(p_username text, p_full_name text, p_new_password text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.complete_profile_setup(p_username text, p_full_name text, p_new_password text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.complete_profile_setup(p_username text, p_full_name text, p_new_password text) TO authenticated;
GRANT ALL ON FUNCTION public.complete_profile_setup(p_username text, p_full_name text, p_new_password text) TO service_role;

--
-- Name: FUNCTION convert_govt_holiday_response(p_user_id uuid, p_holiday_date date, p_response text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.convert_govt_holiday_response(p_user_id uuid, p_holiday_date date, p_response text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.convert_govt_holiday_response(p_user_id uuid, p_holiday_date date, p_response text) TO authenticated;
GRANT ALL ON FUNCTION public.convert_govt_holiday_response(p_user_id uuid, p_holiday_date date, p_response text) TO service_role;

--
-- Name: FUNCTION convert_govt_holiday_response_internal(p_user_id uuid, p_holiday_date date, p_response text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.convert_govt_holiday_response_internal(p_user_id uuid, p_holiday_date date, p_response text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.convert_govt_holiday_response_internal(p_user_id uuid, p_holiday_date date, p_response text) TO service_role;

--
-- Name: FUNCTION convert_short_leave_to_full_leave(p_user_id uuid, p_adjust_category text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.convert_short_leave_to_full_leave(p_user_id uuid, p_adjust_category text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.convert_short_leave_to_full_leave(p_user_id uuid, p_adjust_category text) TO authenticated;
GRANT ALL ON FUNCTION public.convert_short_leave_to_full_leave(p_user_id uuid, p_adjust_category text) TO service_role;

--
-- Name: FUNCTION convert_short_leave_to_full_leave_internal(p_user_id uuid, p_adjust_category text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.convert_short_leave_to_full_leave_internal(p_user_id uuid, p_adjust_category text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.convert_short_leave_to_full_leave_internal(p_user_id uuid, p_adjust_category text) TO service_role;

--
-- Name: FUNCTION create_configured_user(p_email text, p_password text, p_username text, p_role text, p_full_name text, p_profile_options jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.create_configured_user(p_email text, p_password text, p_username text, p_role text, p_full_name text, p_profile_options jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.create_configured_user(p_email text, p_password text, p_username text, p_role text, p_full_name text, p_profile_options jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.create_configured_user(p_email text, p_password text, p_username text, p_role text, p_full_name text, p_profile_options jsonb) TO service_role;

--
-- Name: FUNCTION create_new_user(p_email text, p_password text, p_username text, p_role text, p_full_name text, p_needs_supervisor_approval boolean, p_allow_reserve boolean, p_allow_overtime boolean, p_supervisor_ids uuid[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.create_new_user(p_email text, p_password text, p_username text, p_role text, p_full_name text, p_needs_supervisor_approval boolean, p_allow_reserve boolean, p_allow_overtime boolean, p_supervisor_ids uuid[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.create_new_user(p_email text, p_password text, p_username text, p_role text, p_full_name text, p_needs_supervisor_approval boolean, p_allow_reserve boolean, p_allow_overtime boolean, p_supervisor_ids uuid[]) TO service_role;

--
-- Name: FUNCTION current_user_has_workspace(p_workspace text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.current_user_has_workspace(p_workspace text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.current_user_has_workspace(p_workspace text) TO authenticated;
GRANT ALL ON FUNCTION public.current_user_has_workspace(p_workspace text) TO service_role;

--
-- Name: FUNCTION delete_user_by_id(p_user_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.delete_user_by_id(p_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.delete_user_by_id(p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.delete_user_by_id(p_user_id uuid) TO service_role;

--
-- Name: FUNCTION enforce_chuti_write_permissions(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.enforce_chuti_write_permissions() FROM PUBLIC;
GRANT ALL ON FUNCTION public.enforce_chuti_write_permissions() TO service_role;

--
-- Name: FUNCTION enforce_kpi_assessment_permissions(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.enforce_kpi_assessment_permissions() FROM PUBLIC;
GRANT ALL ON FUNCTION public.enforce_kpi_assessment_permissions() TO service_role;

--
-- Name: FUNCTION enforce_leave_settlement_permissions(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.enforce_leave_settlement_permissions() FROM PUBLIC;
GRANT ALL ON FUNCTION public.enforce_leave_settlement_permissions() TO service_role;

--
-- Name: FUNCTION enforce_quotation_mistake_metadata(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.enforce_quotation_mistake_metadata() FROM PUBLIC;
GRANT ALL ON FUNCTION public.enforce_quotation_mistake_metadata() TO service_role;

--
-- Name: FUNCTION get_admin_sales_summary(p_today text, p_tz text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_admin_sales_summary(p_today text, p_tz text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_admin_sales_summary(p_today text, p_tz text) TO authenticated;
GRANT ALL ON FUNCTION public.get_admin_sales_summary(p_today text, p_tz text) TO service_role;

--
-- Name: FUNCTION get_available_record_months(p_user_id uuid, p_tz text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_available_record_months(p_user_id uuid, p_tz text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_available_record_months(p_user_id uuid, p_tz text) TO authenticated;
GRANT ALL ON FUNCTION public.get_available_record_months(p_user_id uuid, p_tz text) TO service_role;

--
-- Name: FUNCTION get_leaderboard_data(p_year text, p_month text, p_period text, p_today text, p_tz text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_leaderboard_data(p_year text, p_month text, p_period text, p_today text, p_tz text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_leaderboard_data(p_year text, p_month text, p_period text, p_today text, p_tz text) TO authenticated;
GRANT ALL ON FUNCTION public.get_leaderboard_data(p_year text, p_month text, p_period text, p_today text, p_tz text) TO service_role;

--
-- Name: FUNCTION get_my_role(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_my_role() FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_my_role() TO authenticated;
GRANT ALL ON FUNCTION public.get_my_role() TO service_role;

--
-- Name: FUNCTION get_user_email_by_username(p_username text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_user_email_by_username(p_username text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_user_email_by_username(p_username text) TO service_role;

--
-- Name: FUNCTION handle_new_user(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
GRANT ALL ON FUNCTION public.handle_new_user() TO service_role;

--
-- Name: FUNCTION has_kpi_access(supervisor_id uuid, employee_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.has_kpi_access(supervisor_id uuid, employee_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.has_kpi_access(supervisor_id uuid, employee_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.has_kpi_access(supervisor_id uuid, employee_id uuid) TO service_role;

--
-- Name: FUNCTION has_leave_access(supervisor_id uuid, employee_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.has_leave_access(supervisor_id uuid, employee_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.has_leave_access(supervisor_id uuid, employee_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.has_leave_access(supervisor_id uuid, employee_id uuid) TO service_role;

--
-- Name: FUNCTION is_admin(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT ALL ON FUNCTION public.is_admin() TO authenticated;
GRANT ALL ON FUNCTION public.is_admin() TO service_role;

--
-- Name: FUNCTION is_admin_or_superadmin(user_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.is_admin_or_superadmin(user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.is_admin_or_superadmin(user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.is_admin_or_superadmin(user_id uuid) TO service_role;

--
-- Name: FUNCTION is_admin_or_supervisor(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.is_admin_or_supervisor() FROM PUBLIC;
GRANT ALL ON FUNCTION public.is_admin_or_supervisor() TO authenticated;
GRANT ALL ON FUNCTION public.is_admin_or_supervisor() TO service_role;

--
-- Name: FUNCTION is_superadmin(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.is_superadmin() FROM PUBLIC;
GRANT ALL ON FUNCTION public.is_superadmin() TO authenticated;
GRANT ALL ON FUNCTION public.is_superadmin() TO service_role;

--
-- Name: FUNCTION is_supervisor(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.is_supervisor() FROM PUBLIC;
GRANT ALL ON FUNCTION public.is_supervisor() TO authenticated;
GRANT ALL ON FUNCTION public.is_supervisor() TO service_role;

--
-- Name: FUNCTION reconcile_govt_holiday_adjustments(p_user_id uuid, p_year integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.reconcile_govt_holiday_adjustments(p_user_id uuid, p_year integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.reconcile_govt_holiday_adjustments(p_user_id uuid, p_year integer) TO service_role;

--
-- Name: FUNCTION register_active_session(p_session_id text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.register_active_session(p_session_id text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.register_active_session(p_session_id text) TO authenticated;
GRANT ALL ON FUNCTION public.register_active_session(p_session_id text) TO service_role;

--
-- Name: FUNCTION request_password_reset(p_username text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.request_password_reset(p_username text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.request_password_reset(p_username text) TO service_role;

--
-- Name: FUNCTION reset_all_user_feature_flags(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.reset_all_user_feature_flags() FROM PUBLIC;
GRANT ALL ON FUNCTION public.reset_all_user_feature_flags() TO authenticated;
GRANT ALL ON FUNCTION public.reset_all_user_feature_flags() TO service_role;

--
-- Name: FUNCTION resolve_password_reset(p_user_id uuid, p_approve boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.resolve_password_reset(p_user_id uuid, p_approve boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.resolve_password_reset(p_user_id uuid, p_approve boolean) TO authenticated;
GRANT ALL ON FUNCTION public.resolve_password_reset(p_user_id uuid, p_approve boolean) TO service_role;

--
-- Name: FUNCTION save_global_leave_settings(p_settings jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.save_global_leave_settings(p_settings jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.save_global_leave_settings(p_settings jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.save_global_leave_settings(p_settings jsonb) TO service_role;

--
-- Name: FUNCTION save_global_leave_settings_internal(p_settings jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.save_global_leave_settings_internal(p_settings jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.save_global_leave_settings_internal(p_settings jsonb) TO service_role;

--
-- Name: FUNCTION set_admin_delegated_flags(p_flags jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.set_admin_delegated_flags(p_flags jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.set_admin_delegated_flags(p_flags jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.set_admin_delegated_flags(p_flags jsonb) TO service_role;

--
-- Name: FUNCTION set_feature_flags(p_flags jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.set_feature_flags(p_flags jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.set_feature_flags(p_flags jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.set_feature_flags(p_flags jsonb) TO service_role;

--
-- Name: FUNCTION set_govt_holiday_response_updated_at(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.set_govt_holiday_response_updated_at() FROM PUBLIC;
GRANT ALL ON FUNCTION public.set_govt_holiday_response_updated_at() TO service_role;

--
-- Name: FUNCTION set_role_visibility(p_visibility jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.set_role_visibility(p_visibility jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.set_role_visibility(p_visibility jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.set_role_visibility(p_visibility jsonb) TO service_role;

--
-- Name: FUNCTION set_sanitizer_rules(p_rules jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.set_sanitizer_rules(p_rules jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.set_sanitizer_rules(p_rules jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.set_sanitizer_rules(p_rules jsonb) TO service_role;

--
-- Name: FUNCTION set_sanitizer_words(p_words text[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.set_sanitizer_words(p_words text[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.set_sanitizer_words(p_words text[]) TO authenticated;
GRANT ALL ON FUNCTION public.set_sanitizer_words(p_words text[]) TO service_role;

--
-- Name: FUNCTION set_supervisor_access_overrides(p_overrides jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.set_supervisor_access_overrides(p_overrides jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.set_supervisor_access_overrides(p_overrides jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.set_supervisor_access_overrides(p_overrides jsonb) TO service_role;

--
-- Name: FUNCTION set_temp_access(p_entries jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.set_temp_access(p_entries jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.set_temp_access(p_entries jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.set_temp_access(p_entries jsonb) TO service_role;

--
-- Name: FUNCTION set_user_hidden_tabs(p_user_id uuid, p_hidden_tabs jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.set_user_hidden_tabs(p_user_id uuid, p_hidden_tabs jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.set_user_hidden_tabs(p_user_id uuid, p_hidden_tabs jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.set_user_hidden_tabs(p_user_id uuid, p_hidden_tabs jsonb) TO service_role;

--
-- Name: FUNCTION sync_profile_govt_holiday_entitlements(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.sync_profile_govt_holiday_entitlements() FROM PUBLIC;
GRANT ALL ON FUNCTION public.sync_profile_govt_holiday_entitlements() TO service_role;

--
-- Name: FUNCTION sync_top_performer_badges(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.sync_top_performer_badges() FROM PUBLIC;
GRANT ALL ON FUNCTION public.sync_top_performer_badges() TO service_role;

--
-- Name: FUNCTION update_chuti_updated_at(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.update_chuti_updated_at() FROM PUBLIC;
GRANT ALL ON FUNCTION public.update_chuti_updated_at() TO service_role;

--
-- Name: FUNCTION update_compliance_rules_updated_at(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.update_compliance_rules_updated_at() FROM PUBLIC;
GRANT ALL ON FUNCTION public.update_compliance_rules_updated_at() TO service_role;

--
-- Name: FUNCTION update_global_settings_key(p_user_id uuid, p_key text, p_value jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.update_global_settings_key(p_user_id uuid, p_key text, p_value jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.update_global_settings_key(p_user_id uuid, p_key text, p_value jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.update_global_settings_key(p_user_id uuid, p_key text, p_value jsonb) TO service_role;

--
-- Name: FUNCTION update_records_updated_at(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.update_records_updated_at() FROM PUBLIC;
GRANT ALL ON FUNCTION public.update_records_updated_at() TO service_role;

--
-- Name: FUNCTION update_todos_last_activity(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.update_todos_last_activity() FROM PUBLIC;
GRANT ALL ON FUNCTION public.update_todos_last_activity() TO service_role;

--
-- Name: TABLE audit_logs; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.audit_logs TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.audit_logs TO authenticated;
GRANT ALL ON TABLE public.audit_logs TO service_role;

--
-- Name: TABLE chuti; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.chuti TO anon;
GRANT ALL ON TABLE public.chuti TO authenticated;
GRANT ALL ON TABLE public.chuti TO service_role;

--
-- Name: TABLE compliance_rules; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.compliance_rules TO anon;
GRANT ALL ON TABLE public.compliance_rules TO authenticated;
GRANT ALL ON TABLE public.compliance_rules TO service_role;

--
-- Name: TABLE dismissed_notifications; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.dismissed_notifications TO anon;
GRANT ALL ON TABLE public.dismissed_notifications TO authenticated;
GRANT ALL ON TABLE public.dismissed_notifications TO service_role;

--
-- Name: TABLE govt_holiday_responses; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.govt_holiday_responses TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.govt_holiday_responses TO authenticated;
GRANT ALL ON TABLE public.govt_holiday_responses TO service_role;

--
-- Name: TABLE kpi_assessments; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.kpi_assessments TO anon;
GRANT ALL ON TABLE public.kpi_assessments TO authenticated;
GRANT ALL ON TABLE public.kpi_assessments TO service_role;

--
-- Name: TABLE leaderboard_archive; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.leaderboard_archive TO anon;
GRANT ALL ON TABLE public.leaderboard_archive TO authenticated;
GRANT ALL ON TABLE public.leaderboard_archive TO service_role;

--
-- Name: TABLE leave_settlements; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.leave_settlements TO anon;
GRANT ALL ON TABLE public.leave_settlements TO authenticated;
GRANT ALL ON TABLE public.leave_settlements TO service_role;

--
-- Name: TABLE login_codes; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.login_codes TO anon;
GRANT ALL ON TABLE public.login_codes TO authenticated;
GRANT ALL ON TABLE public.login_codes TO service_role;

--
-- Name: TABLE mobile_app_versions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.mobile_app_versions TO anon;
GRANT ALL ON TABLE public.mobile_app_versions TO authenticated;
GRANT ALL ON TABLE public.mobile_app_versions TO service_role;

--
-- Name: SEQUENCE mobile_app_versions_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.mobile_app_versions_id_seq TO anon;
GRANT ALL ON SEQUENCE public.mobile_app_versions_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.mobile_app_versions_id_seq TO service_role;

--
-- Name: TABLE profiles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.profiles TO anon;
GRANT ALL ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;

--
-- Name: TABLE quotation_mistakes; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.quotation_mistakes TO anon;
GRANT ALL ON TABLE public.quotation_mistakes TO authenticated;
GRANT ALL ON TABLE public.quotation_mistakes TO service_role;

--
-- Name: TABLE records; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.records TO anon;
GRANT ALL ON TABLE public.records TO authenticated;
GRANT ALL ON TABLE public.records TO service_role;

--
-- Name: TABLE todos; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.todos TO anon;
GRANT ALL ON TABLE public.todos TO authenticated;
GRANT ALL ON TABLE public.todos TO service_role;

--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;

--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;

--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;

--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;

--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;

--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO service_role;

--
-- PostgreSQL database dump complete
--

\unrestrict KGgVatirYb3Y1Kz2ZWJ2YZ67B8HHFQkXzCDO3DNWRWxLMSHyKrnizOtueEfnchb
