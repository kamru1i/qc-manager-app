-- 1. Redefine check_profile_updates to support the bypass flag
CREATE OR REPLACE FUNCTION public.check_profile_updates()
RETURNS TRIGGER AS $$
BEGIN
  -- If the session bypass variable is set, allow the update (system functions/syncs)
  IF current_setting('app.bypass_profile_security', true) = 'true' THEN
    RETURN NEW;
  END IF;

  -- If the editor is the service_role (API routes / system), allow everything
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- If the editor is an admin, allow everything
  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RETURN NEW;
  END IF;

  -- If the editor is a supervisor
  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'supervisor'
  ) THEN
    -- If editing self, allow everything
    IF auth.uid() = NEW.id THEN
      RETURN NEW;
    END IF;

    -- If editing an employee they directly supervise, enforce key constraints (prevent privilege escalation/sensitive settings modification)
    IF auth.uid() = ANY(NEW.supervisor_ids) OR auth.uid() = ANY(OLD.supervisor_ids) THEN
      IF OLD.role IS DISTINCT FROM NEW.role OR
         OLD.has_chuti_access IS DISTINCT FROM NEW.has_chuti_access OR
         OLD.has_quotes_access IS DISTINCT FROM NEW.has_quotes_access OR
         OLD.can_manage_rules IS DISTINCT FROM NEW.can_manage_rules OR
         OLD.supervisor_ids IS DISTINCT FROM NEW.supervisor_ids OR
         (NEW.global_settings->>'office_leave_default') IS DISTINCT FROM (OLD.global_settings->>'office_leave_default') OR
         (NEW.global_settings->>'eid_fitr_leave') IS DISTINCT FROM (OLD.global_settings->>'eid_fitr_leave') OR
         (NEW.global_settings->>'eid_adha_leave') IS DISTINCT FROM (OLD.global_settings->>'eid_adha_leave') OR
         (NEW.global_settings->>'govt_holidays') IS DISTINCT FROM (OLD.global_settings->>'govt_holidays') OR
         (NEW.global_settings->>'password_reset_status') IS DISTINCT FROM (OLD.global_settings->>'password_reset_status')
      THEN
        RAISE EXCEPTION 'Supervisors cannot modify roles, supervisor assignments, access permissions, or sensitive global leave settings for their team members.';
      END IF;
      RETURN NEW;
    END IF;

    -- If editing an employee they do NOT supervise, enforce column constraints
    IF OLD.role IS DISTINCT FROM NEW.role OR
       OLD.has_chuti_access IS DISTINCT FROM NEW.has_chuti_access OR
       OLD.has_quotes_access IS DISTINCT FROM NEW.has_quotes_access OR
       OLD.supervisor_ids IS DISTINCT FROM NEW.supervisor_ids OR
       OLD.delegated_supervisor_id IS DISTINCT FROM NEW.delegated_supervisor_id OR
       OLD.delegated_leave_supervisor_id IS DISTINCT FROM NEW.delegated_leave_supervisor_id OR
       OLD.delegated_kpi_supervisor_id IS DISTINCT FROM NEW.delegated_kpi_supervisor_id OR
       OLD.eligible_govt_holiday IS DISTINCT FROM NEW.eligible_govt_holiday OR
       OLD.eligible_office_leave IS DISTINCT FROM NEW.eligible_office_leave OR
       OLD.allow_overtime IS DISTINCT FROM NEW.allow_overtime OR
       OLD.allow_reserve IS DISTINCT FROM NEW.allow_reserve OR
       OLD.needs_supervisor_approval IS DISTINCT FROM NEW.needs_supervisor_approval OR
       OLD.global_settings IS DISTINCT FROM NEW.global_settings
    THEN
      RAISE EXCEPTION 'Supervisors can only modify basic settings (working hours, break time, default sign in/out, quotes allowed types) for users outside their team.';
    END IF;

    RETURN NEW;
  END IF;

  -- Default fallback: only allow users to edit self (non-supervisors)
  IF auth.uid() = NEW.id THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Unauthorized profile modification.';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Redefine sync_top_performer_badges to set the bypass flag during local transaction context
CREATE OR REPLACE FUNCTION public.sync_top_performer_badges()
RETURNS void AS $$
DECLARE
  v_today DATE := CURRENT_DATE;
  v_prev_month_date DATE := (DATE_TRUNC('month', v_today) - INTERVAL '1 month')::DATE;
  v_prev_year INT := EXTRACT(YEAR FROM v_prev_month_date)::INT;
  v_prev_month INT := EXTRACT(MONTH FROM v_prev_month_date)::INT;
  v_prev_month_name TEXT := TO_CHAR(v_prev_month_date, 'Month');
  
  v_current_year INT := EXTRACT(YEAR FROM v_today)::INT;
  
  r_user RECORD;
  v_rank INT := 0;
  v_badge_type TEXT;
  v_consecutive_months INT;
  v_yearly_wins INT;
  v_check_date DATE;
  v_badge_json JSONB;
BEGIN
  -- Set local parameter so the triggers bypass security checks
  PERFORM set_config('app.bypass_profile_security', 'true', true);

  -- ক. আগের মাসের টপ ৫ পারফর্মারদের একটি সাময়িক টেবিল তৈরি করা
  CREATE TEMP TABLE temp_top_5 ON COMMIT DROP AS
  WITH monthly_counts AS (
    SELECT 
      r.user_id,
      COUNT(*) AS record_count,
      p.username
    FROM public.records r
    JOIN public.profiles p ON r.user_id = p.id
    WHERE 
      EXTRACT(YEAR FROM r.submitted_at) = v_prev_year
      AND EXTRACT(MONTH FROM r.submitted_at) = v_prev_month
    GROUP BY r.user_id, p.username
  )
  SELECT 
    user_id,
    ROW_NUMBER() OVER (ORDER BY record_count DESC, UPPER(username) ASC) AS rank
  FROM monthly_counts
  LIMIT 5;

  -- খ. যারা আগের মাসের টপ ৫-এ নেই, তাদের প্রোফাইলের ব্যাজ মুছে ফেলা
  UPDATE public.profiles
  SET global_settings = COALESCE(global_settings, '{}'::JSONB) - 'top_performer_badge'
  WHERE id NOT IN (SELECT user_id FROM temp_top_5);

  -- গ. টপ ৫ পারফর্মারদের লুপ চালিয়ে ধারাবাহিকতা (streaks) ও বার্ষিক উইন ক্যালকুলেট করে আপডেট করা
  FOR r_user IN (SELECT * FROM temp_top_5) LOOP
    v_rank := r_user.rank;
    v_badge_type := CASE WHEN v_rank <= 3 THEN 'blue' ELSE 'grey' END;

    -- কন্টিনিউয়াস মান্থলি স্ট্রাক ক্যালকুলেশন
    v_consecutive_months := 0;
    v_check_date := v_prev_month_date;
    
    WHILE public.is_user_in_top_5_for_month(r_user.user_id, EXTRACT(YEAR FROM v_check_date)::INT, EXTRACT(MONTH FROM v_check_date)::INT) LOOP
      v_consecutive_months := v_consecutive_months + 1;
      v_check_date := (v_check_date - INTERVAL '1 month')::DATE;
    END LOOP;

    -- চলতি ক্যালেন্ডার বছরে টোটাল উইন
    v_yearly_wins := 0;
    FOR m IN 1..12 LOOP
      IF public.is_user_in_top_5_for_month(r_user.user_id, v_current_year, m) THEN
        v_yearly_wins := v_yearly_wins + 1;
      END IF;
    END LOOP;

    -- JSON ডাটা প্রস্তুত করা
    v_badge_json := JSONB_BUILD_OBJECT(
      'userId', r_user.user_id,
      'rank', v_rank,
      'badgeType', v_badge_type,
      'monthName', TRIM(v_prev_month_name),
      'consecutiveMonths', v_consecutive_months,
      'yearlyTopPerformances', v_yearly_wins
    );

    -- ইউজারের প্রোফাইলে ব্যাজ সেট করা
    UPDATE public.profiles
    SET global_settings = COALESCE(global_settings, '{}'::JSONB) || JSONB_BUILD_OBJECT('top_performer_badge', v_badge_json)
    WHERE id = r_user.user_id;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
