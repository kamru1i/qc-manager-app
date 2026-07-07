-- Supabase Database Schema Setup SQL
--
-- MIGRATION NOTE FOR EXISTING DATABASE:
-- Run the following DDL in your Supabase SQL Editor:
-- ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS supervisor_ids UUID[] DEFAULT NULL;
-- DROP FUNCTION IF EXISTS public.create_new_user(TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, BOOLEAN, BOOLEAN) CASCADE;
-- (Then recreate the create_new_user function as defined below)

-- Drop tables first (with CASCADE) to automatically drop dependent policies and avoid dependency conflicts
DROP TABLE IF EXISTS public.chuti CASCADE;
DROP TABLE IF EXISTS public.govt_holiday_responses CASCADE;
DROP TABLE IF EXISTS public.push_subscriptions CASCADE;
DROP TABLE IF EXISTS public.leave_settlements CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Drop Quotes tables
DROP TABLE IF EXISTS public.records CASCADE;
DROP TABLE IF EXISTS public.todos CASCADE;
DROP TABLE IF EXISTS public.compliance_rules CASCADE;
DROP TABLE IF EXISTS public.rules_history CASCADE;
DROP TABLE IF EXISTS public.login_codes CASCADE;
DROP TABLE IF EXISTS public.audit_logs CASCADE;

-- Drop trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Drop functions (with CASCADE to be absolutely safe)
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.is_admin() CASCADE;
DROP FUNCTION IF EXISTS public.is_supervisor() CASCADE;
DROP FUNCTION IF EXISTS public.is_admin_or_supervisor() CASCADE;
DROP FUNCTION IF EXISTS public.get_user_email_by_username(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.create_new_user(TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, BOOLEAN, BOOLEAN) CASCADE;
DROP FUNCTION IF EXISTS public.create_new_user(TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, BOOLEAN, BOOLEAN, UUID[]) CASCADE;
DROP FUNCTION IF EXISTS public.delete_user_by_id(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.admin_update_user_credentials(UUID, TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.admin_insert_chuti_records_bulk(UUID, DATE[], TEXT, BOOLEAN[], BOOLEAN, TIME, TIME, INTERVAL, TEXT, TEXT, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.get_user_ids_by_roles(TEXT[]) CASCADE;
DROP FUNCTION IF EXISTS public.get_push_subscriptions_for_users(UUID[]) CASCADE;
DROP FUNCTION IF EXISTS public.delete_push_subscription(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.register_push_subscription(UUID, TEXT, TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.update_chuti_updated_at() CASCADE;

-- ==========================================
-- 1. Create Profiles Table (Stores user roles: admin, supervisor, or user)
-- ==========================================
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user', 'supervisor')),
  username_changes INTEGER NOT NULL DEFAULT 0,
  username_request_status TEXT NOT NULL DEFAULT 'none' CHECK (username_request_status IN ('none', 'pending', 'approved')),
  full_name TEXT,
  working_hours NUMERIC DEFAULT 9.5,
  break_time INTEGER DEFAULT 0,
  is_setup_completed BOOLEAN DEFAULT FALSE,
  job_role TEXT,
  requested_full_name TEXT,
  requested_working_hours NUMERIC,
  requested_break_time INTEGER,
  requested_job_role TEXT,
  profile_change_status TEXT NOT NULL DEFAULT 'none' CHECK (profile_change_status IN ('none', 'pending', 'approved', 'rejected')),
  
  -- Default sign-in/out times
  default_sign_in TEXT DEFAULT NULL,
  default_sign_out TEXT DEFAULT NULL,
  requested_default_sign_in TEXT,
  requested_default_sign_out TEXT,
  needs_supervisor_approval BOOLEAN DEFAULT TRUE,
  allow_reserve BOOLEAN DEFAULT FALSE,
  allow_overtime BOOLEAN DEFAULT FALSE,
  has_edited_profile BOOLEAN NOT NULL DEFAULT FALSE,
  has_changed_password BOOLEAN NOT NULL DEFAULT FALSE,
  max_full_leaves INTEGER DEFAULT 15,
  max_short_leaves INTEGER DEFAULT 15,
  eligible_office_leave BOOLEAN DEFAULT TRUE,
  eligible_govt_holiday BOOLEAN DEFAULT TRUE,
  converted_short_leaves_days INTEGER DEFAULT 0,
  converted_short_leaves_hours NUMERIC DEFAULT 0,
  global_settings JSONB DEFAULT '{"office_leave_default": 14, "eid_fitr_leave": 0, "eid_adha_leave": 0, "govt_holidays": []}'::jsonb,
  supervisor_ids UUID[] DEFAULT NULL,
  delegated_supervisor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  
  -- Quotes App Integration Columns
  allowed_types TEXT[] DEFAULT ARRAY['Quote', 'Requote', 'Requote Van', 'Requote Bike', 'Review', 'Review Van', 'Review Bike', 'Individual Review', 'Other Site', 'Van', 'Bike', 'Sale']::TEXT[] NOT NULL,
  can_manage_rules BOOLEAN NOT NULL DEFAULT FALSE,
  quotes_role TEXT DEFAULT 'user' CHECK (quotes_role IN ('admin', 'user')),
  
  -- Unified Access Flags
  has_chuti_access BOOLEAN DEFAULT FALSE,
  has_quotes_access BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

COMMENT ON COLUMN public.profiles.global_settings IS 'Global leave quotas and government holidays list stored in JSON format';

-- Enable RLS on Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
  
-- ==========================================
-- 2. Create Chuti Table
-- ==========================================
CREATE TABLE public.chuti (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  leave_type TEXT NOT NULL CHECK (leave_type IN ('Short Leave', 'Full Leave', 'Overtime')),
  adjustment BOOLEAN NOT NULL DEFAULT FALSE,
  adjusted_hour INTERVAL, -- Stores partial adjustment amount if any
  sign_in_time TIME,
  sign_out_time TIME,
  leave_hour INTERVAL, -- Stores calculated time, e.g. "04:30:00"
  reserve_holiday TEXT, -- Holds the custom holiday name
  reserve_adjustment_status TEXT NOT NULL DEFAULT 'none' CHECK (reserve_adjustment_status IN ('none', 'pending', 'approved', 'rejected')),
  status TEXT NOT NULL DEFAULT 'pending_supervisor' CHECK (status IN ('pending_supervisor', 'needs_review', 'approved_by_supervisor', 'approved')),
  admin_edit_request JSONB,
  admin_edit_status TEXT NOT NULL DEFAULT 'none' CHECK (admin_edit_status IN ('none', 'pending', 'approved', 'rejected')),
  is_edited BOOLEAN NOT NULL DEFAULT FALSE,
  adjust_short_leave BOOLEAN NOT NULL DEFAULT FALSE,
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  bulk_id UUID, -- Group identifier for bulk leave submissions
  updated_at TIMESTAMPTZ DEFAULT NOW(), -- Required for offline delta sync
  deleted_at TIMESTAMPTZ DEFAULT NULL -- Required for soft-delete support
);

-- Enable RLS on Chuti
ALTER TABLE public.chuti ENABLE ROW LEVEL SECURITY;

-- Trigger to auto-update updated_at on chuti table modifications
CREATE OR REPLACE FUNCTION public.update_chuti_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS chuti_set_updated_at ON public.chuti;
CREATE TRIGGER chuti_set_updated_at
  BEFORE UPDATE ON public.chuti
  FOR EACH ROW
  EXECUTE FUNCTION public.update_chuti_updated_at();

-- ==========================================
-- 3. Helper Functions
-- ==========================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_supervisor()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'supervisor'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_admin_or_supervisor()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND (role = 'admin' OR role = 'supervisor')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC function to map username to registered email (Used for simplified login)
CREATE OR REPLACE FUNCTION public.get_user_email_by_username(p_username TEXT)
RETURNS TEXT AS $$
DECLARE
  v_email TEXT;
BEGIN
  SELECT email INTO v_email
  FROM auth.users u
  JOIN public.profiles p ON u.id = p.id
  WHERE UPPER(p.username) = UPPER(p_username);
  
  RETURN v_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Revoke execute permissions on this function from PUBLIC (anon and authenticated)
REVOKE EXECUTE ON FUNCTION public.get_user_email_by_username(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_email_by_username(TEXT) TO service_role;

-- RPC function to create a new user (admin only)
CREATE OR REPLACE FUNCTION public.create_new_user(
  p_email TEXT, 
  p_password TEXT, 
  p_username TEXT, 
  p_role TEXT, 
  p_full_name TEXT, 
  p_needs_supervisor_approval BOOLEAN DEFAULT FALSE,
  p_allow_reserve BOOLEAN DEFAULT FALSE,
  p_allow_overtime BOOLEAN DEFAULT FALSE,
  p_supervisor_ids UUID[] DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_user_id UUID;
  v_sql TEXT;
  v_cols TEXT[] := ARRAY[]::TEXT[];
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can create users';
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC function to delete a user (admin only)
CREATE OR REPLACE FUNCTION public.delete_user_by_id(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can delete users';
  END IF;

  -- Delete from auth.users (cascade will handle profiles and chuti)
  DELETE FROM auth.users WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC function to update user credentials (admin only)
CREATE OR REPLACE FUNCTION public.admin_update_user_credentials(
  p_user_id UUID, 
  p_new_username TEXT DEFAULT NULL, 
  p_new_password TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can update credentials';
  END IF;

  -- Update username in profiles if provided
  IF p_new_username IS NOT NULL AND p_new_username != '' THEN
    UPDATE public.profiles SET username = UPPER(p_new_username) WHERE id = p_user_id;
  END IF;

  -- Update password in auth.users if provided
  IF p_new_password IS NOT NULL AND p_new_password != '' THEN
    UPDATE auth.users
    SET encrypted_password = crypt(p_new_password, gen_salt('bf')),
        updated_at = NOW()
    WHERE id = p_user_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC function to bulk insert approved chuti records for a user (admin only)
CREATE OR REPLACE FUNCTION public.admin_insert_chuti_records_bulk(
  p_user_id UUID,
  p_dates DATE[],
  p_leave_type TEXT,
  p_adjustments BOOLEAN[],
  p_adjust_short_leave BOOLEAN,
  p_sign_in_time TIME DEFAULT NULL,
  p_sign_out_time TIME DEFAULT NULL,
  p_leave_hour INTERVAL DEFAULT NULL,
  p_reserve_holiday TEXT DEFAULT NULL,
  p_comment TEXT DEFAULT NULL,
  p_bulk_id UUID DEFAULT NULL
)
RETURNS VOID AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- 4. Row Level Security (RLS) Policies
-- ==========================================

-- Profiles Policies
CREATE POLICY "Allow users to read their own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Allow admin/supervisor to read all profiles"
ON public.profiles FOR SELECT
USING (public.is_admin_or_supervisor());

CREATE POLICY "Allow authenticated users to read supervisor profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (role = 'supervisor');

CREATE POLICY "Allow admins to insert profiles"
ON public.profiles FOR INSERT
WITH CHECK (public.is_admin());

CREATE POLICY "Allow users to insert their own profile"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = id AND role = 'user');

CREATE POLICY "Allow users to update their own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY "Allow admins to update all profiles"
ON public.profiles FOR UPDATE
USING (public.is_admin());

CREATE POLICY "Allow supervisors to update supervised profiles"
ON public.profiles FOR UPDATE
USING (
  public.is_supervisor() AND auth.uid() = ANY(supervisor_ids)
)
WITH CHECK (
  public.is_supervisor() AND auth.uid() = ANY(supervisor_ids)
);

CREATE POLICY "Allow admins to delete profiles"
ON public.profiles FOR DELETE
USING (public.is_admin());

-- Role update protection trigger
CREATE OR REPLACE FUNCTION public.check_profile_role_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.role IS DISTINCT FROM NEW.role THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    ) THEN
      RAISE EXCEPTION 'You are not allowed to change your role.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_profile_role_update ON public.profiles;
CREATE TRIGGER on_profile_role_update
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.check_profile_role_change();

-- Chuti Policies
CREATE POLICY "Allow users to read their own chuti"
ON public.chuti FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Allow admin/supervisor to read all chuti"
ON public.chuti FOR SELECT
USING (public.is_admin_or_supervisor());

CREATE POLICY "Allow users to insert their own chuti"
ON public.chuti FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow admins to insert chuti for all users"
ON public.chuti FOR INSERT
WITH CHECK (public.is_admin());

CREATE POLICY "Allow users to update their own chuti"
ON public.chuti FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow supervisors to update chuti status"
ON public.chuti FOR UPDATE
USING (public.is_supervisor());

CREATE POLICY "Allow admins to update all chuti"
ON public.chuti FOR UPDATE
USING (public.is_admin());

CREATE POLICY "Allow users to delete their own chuti"
ON public.chuti FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Allow supervisors to delete chuti"
ON public.chuti FOR DELETE
USING (public.is_supervisor());

CREATE POLICY "Allow admins to delete chuti"
ON public.chuti FOR DELETE
USING (public.is_admin());

-- ==========================================
-- 5. Triggers to automatically create a profile when a new user signs up in Auth.users
-- ==========================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  base_username TEXT;
  final_username TEXT;
  suffix INTEGER := 1;
  v_global_settings JSONB;
BEGIN
  -- Get the current global settings from an existing admin profile to keep settings synchronized
  SELECT global_settings INTO v_global_settings
  FROM public.profiles
  WHERE role = 'admin'
  LIMIT 1;

  -- Fallback if no admin profile exists (e.g. first registration)
  IF v_global_settings IS NULL THEN
    v_global_settings := '{"office_leave_default": 14, "eid_fitr_leave": 0, "eid_adha_leave": 0, "govt_holidays": []}'::jsonb;
  END IF;

  base_username := UPPER(COALESCE(NEW.raw_user_meta_data->>'username', SPLIT_PART(NEW.email, '@', 1)));
  final_username := base_username;
  
  -- Loop to find a unique username if it already exists
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = final_username) LOOP
    final_username := base_username || suffix::TEXT;
    suffix := suffix + 1;
  END LOOP;

  -- Insert into public.profiles
  INSERT INTO public.profiles (
    id, username, role, needs_supervisor_approval, allow_reserve, allow_overtime, 
    eligible_office_leave, eligible_govt_holiday, global_settings,
    has_chuti_access, has_quotes_access, can_manage_rules, allowed_types
  )
  VALUES (
    NEW.id,
    final_username,
    COALESCE(
      NEW.raw_user_meta_data->>'role',
      CASE 
        WHEN NEW.email LIKE '%@admin.chuti' OR NEW.email LIKE '%@admin.local' OR NEW.email = 'admin@office.local' THEN 'admin'
        WHEN NEW.email LIKE '%@supervisor.chuti' OR NEW.email LIKE '%@supervisor.local' OR NEW.email = 'supervisor@office.local' THEN 'supervisor'
        ELSE 'user'
      END
    ),
    COALESCE(
      (NEW.raw_user_meta_data->>'needs_supervisor_approval')::BOOLEAN,
      CASE 
        WHEN NEW.email LIKE '%@admin.chuti' OR NEW.email LIKE '%@admin.local' OR NEW.email = 'admin@office.local' THEN FALSE
        WHEN NEW.email LIKE '%@supervisor.chuti' OR NEW.email LIKE '%@supervisor.local' OR NEW.email = 'supervisor@office.local' THEN FALSE
        ELSE TRUE
      END
    ),
    COALESCE((NEW.raw_user_meta_data->>'allow_reserve')::BOOLEAN, FALSE),
    COALESCE((NEW.raw_user_meta_data->>'allow_overtime')::BOOLEAN, FALSE),
    COALESCE((NEW.raw_user_meta_data->>'eligible_office_leave')::BOOLEAN, TRUE),
    COALESCE((NEW.raw_user_meta_data->>'eligible_govt_holiday')::BOOLEAN, TRUE),
    v_global_settings,
    COALESCE((NEW.raw_user_meta_data->>'has_chuti_access')::BOOLEAN, TRUE),
    COALESCE((NEW.raw_user_meta_data->>'has_quotes_access')::BOOLEAN, TRUE),
    COALESCE((NEW.raw_user_meta_data->>'can_manage_rules')::BOOLEAN, FALSE),
    COALESCE(
      (SELECT ARRAY(SELECT jsonb_array_elements_text(NEW.raw_user_meta_data->'allowed_types')) WHERE NEW.raw_user_meta_data ? 'allowed_types'),
      ARRAY['Quote', 'Requote', 'Requote Van', 'Requote Bike', 'Review', 'Review Van', 'Review Bike', 'Individual Review', 'Other Site', 'Van', 'Bike', 'Sale']::TEXT[]
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==========================================
-- 6. Government Holiday Responses Table
-- ==========================================
CREATE TABLE public.govt_holiday_responses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  holiday_date DATE NOT NULL,
  holiday_name TEXT NOT NULL,
  response TEXT NOT NULL CHECK (response IN ('paid', 'reserve')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by_admin BOOLEAN DEFAULT FALSE,
  CONSTRAINT unique_user_holiday UNIQUE (user_id, holiday_date)
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.govt_holiday_responses ENABLE ROW LEVEL SECURITY;

-- Create Policies for govt_holiday_responses
CREATE POLICY "Users can read own holiday responses" 
  ON public.govt_holiday_responses 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own holiday responses" 
  ON public.govt_holiday_responses 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own holiday responses" 
  ON public.govt_holiday_responses 
  FOR UPDATE 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can read all holiday responses" 
  ON public.govt_holiday_responses 
  FOR SELECT 
  USING (public.is_admin());

CREATE POLICY "Admins can update/delete responses" 
  ON public.govt_holiday_responses 
  FOR ALL 
  USING (public.is_admin());

COMMENT ON TABLE public.govt_holiday_responses IS 'Stores user choices (Get Paid vs Reserve) for each government holiday';


-- ==========================================
-- 7. Push Subscriptions Table & Policies for Web Push Notifications
-- ==========================================
CREATE TABLE public.push_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Create Policies for push_subscriptions
CREATE POLICY "push_sub_insert_own" 
  ON public.push_subscriptions FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "push_sub_select_own" 
  ON public.push_subscriptions FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "push_sub_delete_own" 
  ON public.push_subscriptions FOR DELETE 
  USING (true);

CREATE POLICY "push_sub_update_own"
  ON public.push_subscriptions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- SECURITY DEFINER RPC Functions for Push Notifications
CREATE OR REPLACE FUNCTION public.get_user_ids_by_roles(p_roles TEXT[])
RETURNS TABLE(user_id UUID) AS $$
BEGIN
  RETURN QUERY
    SELECT p.id
    FROM public.profiles p
    WHERE p.role = ANY(p_roles);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_push_subscriptions_for_users(p_user_ids UUID[])
RETURNS TABLE(
  sub_id UUID,
  sub_user_id UUID,
  sub_endpoint TEXT,
  sub_p256dh TEXT,
  sub_auth TEXT
) AS $$
BEGIN
  RETURN QUERY
    SELECT ps.id, ps.user_id, ps.endpoint, ps.p256dh, ps.auth
    FROM public.push_subscriptions ps
    WHERE ps.user_id = ANY(p_user_ids);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.delete_push_subscription(p_sub_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Security check: only allow if user owns the sub, or is admin, or is service_role
  IF NOT EXISTS (
    SELECT 1 FROM public.push_subscriptions 
    WHERE id = p_sub_id 
      AND (
        user_id = auth.uid() 
        OR public.is_admin() 
        OR auth.role() = 'service_role'
      )
  ) THEN
    RAISE EXCEPTION 'Unauthorized: subscription not found or permission denied';
  END IF;

  DELETE FROM public.push_subscriptions WHERE id = p_sub_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.register_push_subscription(
  p_user_id UUID,
  p_endpoint TEXT,
  p_p256dh TEXT,
  p_auth TEXT
)
RETURNS VOID AS $$
BEGIN
  -- Security check: user must match auth.uid() unless executing as service_role
  IF auth.uid() <> p_user_id AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized: cannot register push subscription for another user';
  END IF;

  DELETE FROM public.push_subscriptions WHERE endpoint = p_endpoint;
  INSERT INTO public.push_subscriptions (user_id, endpoint, p256dh, auth)
  VALUES (p_user_id, p_endpoint, p_p256dh, p_auth);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- 8. Leave Settlements Table
-- ==========================================
CREATE TABLE public.leave_settlements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  year VARCHAR(4) NOT NULL,
  period VARCHAR(10) NOT NULL DEFAULT 'H2' CHECK (period IN ('H1', 'H2', 'Instant')),
  leave_category TEXT NOT NULL CHECK (leave_category IN ('Govt Holiday', 'Eid-ul-Fitr', 'Eid-ul-Adha', 'Office Leave')),
  remaining_days NUMERIC(10, 4) NOT NULL,
  action_type TEXT NOT NULL CHECK (action_type IN ('carry_forward', 'payment', 'adjust_leave', 'split')),
  status TEXT NOT NULL DEFAULT 'initiated' CHECK (status IN ('initiated', 'responded', 'processed')),
  processed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  processed_at TIMESTAMPTZ,
  action_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  carry_forward_days NUMERIC(10, 4) DEFAULT 0,
  payment_days NUMERIC(10, 4) DEFAULT 0,
  adjust_leave_days NUMERIC(10, 4) DEFAULT 0,
  CONSTRAINT unique_user_year_period_category UNIQUE (user_id, year, period, leave_category)
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.leave_settlements ENABLE ROW LEVEL SECURITY;

-- Policies for leave_settlements
CREATE POLICY "Users can read own settlements"
  ON public.leave_settlements
  FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin() OR public.is_supervisor());

CREATE POLICY "Users can insert own settlements"
  ON public.leave_settlements
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own settlements"
  ON public.leave_settlements
  FOR UPDATE
  USING (auth.uid() = user_id AND status <> 'processed')
  WITH CHECK (auth.uid() = user_id AND status <> 'processed');

CREATE POLICY "Admins/supervisors can manage settlements"
  ON public.leave_settlements
  FOR ALL
  USING (public.is_admin() OR public.is_supervisor())
  WITH CHECK (public.is_admin() OR public.is_supervisor());

-- Create indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON public.push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_chuti_bulk_id ON public.chuti(bulk_id) WHERE bulk_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leave_settlements_user_year ON public.leave_settlements(user_id, year);
CREATE INDEX IF NOT EXISTS idx_chuti_updated_at ON public.chuti(updated_at);
CREATE INDEX IF NOT EXISTS idx_chuti_deleted_at ON public.chuti(deleted_at);
CREATE UNIQUE INDEX IF NOT EXISTS unique_user_date ON public.chuti (user_id, date) WHERE (deleted_at IS NULL);

-- Enable Realtime for chuti, profiles, and leave_settlements tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.chuti;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.leave_settlements;

-- ==========================================
-- 9. Quotes App: records Table (Stores daily quotes and sales files)
-- ==========================================
CREATE TABLE public.records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  file_name TEXT NOT NULL,
  branch_name TEXT NOT NULL,
  codename TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('Quote', 'Requote', 'Requote Van', 'Requote Bike', 'Review', 'Review Van', 'Review Bike', 'Individual Review', 'Other Site', 'Van', 'Bike', 'Sale')),
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on Records
ALTER TABLE public.records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow users to read own records, admins/supervisors read all" ON public.records
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_admin() OR public.is_supervisor());

CREATE POLICY "Allow users to insert own records, admins/supervisors insert all" ON public.records
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id OR public.is_admin() OR public.is_supervisor());

CREATE POLICY "Allow users to update own records, admins/supervisors update all" ON public.records
  FOR UPDATE TO authenticated USING (auth.uid() = user_id OR public.is_admin() OR public.is_supervisor()) 
  WITH CHECK (auth.uid() = user_id OR public.is_admin() OR public.is_supervisor());

CREATE POLICY "Allow users to delete own records, admins/supervisors delete all" ON public.records
  FOR DELETE TO authenticated USING (auth.uid() = user_id OR public.is_admin() OR public.is_supervisor());

-- Indexes for performance optimization on records
CREATE INDEX IF NOT EXISTS idx_records_updated_at ON public.records(updated_at);
CREATE INDEX IF NOT EXISTS idx_records_user_id ON public.records(user_id);
CREATE INDEX IF NOT EXISTS idx_records_submitted_at ON public.records(submitted_at);

-- Trigger to auto-update updated_at on records table modifications
CREATE OR REPLACE FUNCTION public.update_records_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER records_set_updated_at
  BEFORE UPDATE ON public.records
  FOR EACH ROW
  EXECUTE FUNCTION public.update_records_updated_at();

-- ==========================================
-- 10. Quotes App: login_codes Table
-- ==========================================
CREATE TABLE public.login_codes (
  login_id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  name TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on Login Codes
ALTER TABLE public.login_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated to read login codes" ON public.login_codes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow admins & supervisors to manage login codes" ON public.login_codes
  FOR ALL TO authenticated USING (public.is_admin() OR public.is_supervisor());

-- ==========================================
-- 11. Quotes App: compliance_rules & rules_history Tables
-- ==========================================
CREATE TABLE public.compliance_rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL CHECK (category IN ('announcement', 'fine', 'universal', 'company')),
  sub_category TEXT NOT NULL CHECK (sub_category IN ('nby_rule', 'general_pricing', 'employment', 'driver_and_usage', 'license_and_residency', 'file_processing', 'branch_priority', 'doc_extensions', 'common_rules')),
  company_name TEXT,
  company_tags TEXT[],
  title TEXT,
  content TEXT NOT NULL,
  extra_info TEXT,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- Enable RLS on compliance_rules
ALTER TABLE public.compliance_rules ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.rules_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  rule_id UUID NOT NULL,
  category TEXT NOT NULL,
  sub_category TEXT NOT NULL,
  company_name TEXT,
  company_tags TEXT[],
  title TEXT,
  content TEXT NOT NULL,
  extra_info TEXT,
  action_type TEXT NOT NULL CHECK (action_type IN ('INSERT', 'UPDATE', 'DELETE')),
  archived_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  archived_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- Enable RLS on rules_history
ALTER TABLE public.rules_history ENABLE ROW LEVEL SECURITY;

-- Archive Rules Changes Trigger Function
CREATE OR REPLACE FUNCTION public.archive_rule_changes()
RETURNS TRIGGER AS $$
BEGIN
  -- Archive if it's a soft delete
  IF (OLD.is_deleted = false AND NEW.is_deleted = true) THEN
    INSERT INTO public.rules_history (
      rule_id, category, sub_category, company_name, company_tags, title, content, extra_info, action_type, archived_by
    )
    VALUES (
      OLD.id, OLD.category, OLD.sub_category, OLD.company_name, OLD.company_tags, OLD.title, OLD.content, OLD.extra_info, 'DELETE', auth.uid()
    );
  -- Only archive if the content actually changed
  ELSIF (OLD.content <> NEW.content OR OLD.title IS DISTINCT FROM NEW.title OR OLD.extra_info IS DISTINCT FROM NEW.extra_info OR OLD.company_name IS DISTINCT FROM NEW.company_name) THEN
    INSERT INTO public.rules_history (
      rule_id, category, sub_category, company_name, company_tags, title, content, extra_info, action_type, archived_by
    )
    VALUES (
      OLD.id, OLD.category, OLD.sub_category, OLD.company_name, OLD.company_tags, OLD.title, OLD.content, OLD.extra_info, 'UPDATE', auth.uid()
    );
  END IF;
  NEW.updated_at := now();
  NEW.updated_by := auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind trigger to compliance_rules
DROP TRIGGER IF EXISTS trg_archive_rule_changes ON public.compliance_rules;
CREATE TRIGGER trg_archive_rule_changes
  BEFORE UPDATE ON public.compliance_rules
  FOR EACH ROW EXECUTE FUNCTION public.archive_rule_changes();

-- Policies for compliance_rules
CREATE POLICY "Allow authenticated to read compliance rules" ON public.compliance_rules
  FOR SELECT TO authenticated USING (
    NOT is_deleted 
    OR EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND (role = 'admin' OR role = 'supervisor' OR can_manage_rules = TRUE)
    )
  );

CREATE POLICY "Allow admins, supervisors or authorized editors to insert rules" ON public.compliance_rules
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND (role = 'admin' OR role = 'supervisor' OR can_manage_rules = TRUE)
    )
  );

CREATE POLICY "Allow admins, supervisors or authorized editors to update rules" ON public.compliance_rules
  FOR UPDATE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND (role = 'admin' OR role = 'supervisor' OR can_manage_rules = TRUE)
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND (role = 'admin' OR role = 'supervisor' OR can_manage_rules = TRUE)
    )
  );

CREATE POLICY "Allow admins, supervisors or authorized editors to delete rules" ON public.compliance_rules
  FOR DELETE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND (role = 'admin' OR role = 'supervisor' OR can_manage_rules = TRUE)
    )
  );

-- Policies for rules_history
CREATE POLICY "Allow admins & supervisors to read rules history" ON public.rules_history
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND (role = 'admin' OR role = 'supervisor' OR can_manage_rules = TRUE)
    )
  );

-- ==========================================
-- 12. Quotes App: todos Table
-- ==========================================
CREATE TABLE public.todos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  codename TEXT NOT NULL,
  task TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Idle' CHECK (status IN ('Idle', 'Working', 'Completed')),
  comment TEXT,
  todo_date DATE DEFAULT CURRENT_DATE NOT NULL,
  is_all_time BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on todos
ALTER TABLE public.todos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow users to read own todos" ON public.todos
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Allow users to insert own todos" ON public.todos
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow users to update own todos" ON public.todos
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow users to delete own todos" ON public.todos
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Performance Indexes for Quotes App
CREATE INDEX IF NOT EXISTS idx_records_user_id ON public.records(user_id);
CREATE INDEX IF NOT EXISTS idx_todos_user_id ON public.todos(user_id);
CREATE INDEX IF NOT EXISTS idx_todos_todo_date ON public.todos(todo_date);

-- Enable Realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.records;
ALTER PUBLICATION supabase_realtime ADD TABLE public.todos;
ALTER PUBLICATION supabase_realtime ADD TABLE public.compliance_rules;
ALTER PUBLICATION supabase_realtime ADD TABLE public.rules_history;

-- ==========================================
-- 11. Audit Logs Table
-- ==========================================
CREATE TABLE public.audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_codename TEXT NOT NULL,
  action_type TEXT NOT NULL,
  target_id TEXT,
  details TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on audit_logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow admins and supervisors to read all audit logs" ON public.audit_logs
  FOR SELECT TO authenticated USING (public.is_admin_or_supervisor());

CREATE POLICY "Allow authenticated users to insert audit logs" ON public.audit_logs
  FOR INSERT TO authenticated WITH CHECK (auth.role() = 'authenticated');

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON public.audit_logs(actor_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.audit_logs;
