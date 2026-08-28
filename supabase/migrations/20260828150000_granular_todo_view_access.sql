-- ====================================================================
-- MIGRATION: Granular Todo View Access for Specific Registered Users
-- Version: 20260828150000
-- ====================================================================

-- 1. Add has_todo_access column to public.profiles if not exists
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS has_todo_access boolean DEFAULT false NOT NULL;

-- 2. Create todo_access table for granular access control and audit trail
CREATE TABLE IF NOT EXISTS public.todo_access (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    permission text DEFAULT 'TODO_VIEW' NOT NULL,
    granted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_user_todo_permission UNIQUE (user_id, permission),
    CONSTRAINT check_todo_permission CHECK (permission IN ('TODO_VIEW'))
);

-- Index for fast user lookup
CREATE INDEX IF NOT EXISTS idx_todo_access_user_id ON public.todo_access USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_todo_access_permission ON public.todo_access USING btree (permission);

-- Enable RLS on todo_access
ALTER TABLE public.todo_access ENABLE ROW LEVEL SECURITY;

-- 3. Trigger Function to keep profiles.has_todo_access perfectly in sync with todo_access table
CREATE OR REPLACE FUNCTION public.sync_profile_todo_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE public.profiles
    SET has_todo_access = true
    WHERE id = NEW.user_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.profiles
    SET has_todo_access = false
    WHERE id = OLD.user_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_profile_todo_access ON public.todo_access;
CREATE TRIGGER trg_sync_profile_todo_access
AFTER INSERT OR UPDATE OR DELETE ON public.todo_access
FOR EACH ROW EXECUTE FUNCTION public.sync_profile_todo_access();

-- 4. RLS Policies on todo_access table
DROP POLICY IF EXISTS "Superadmin full access on todo_access" ON public.todo_access;
CREATE POLICY "Superadmin full access on todo_access" ON public.todo_access
FOR ALL TO authenticated
USING (public.is_superadmin())
WITH CHECK (public.is_superadmin());

DROP POLICY IF EXISTS "Users can read own todo_access" ON public.todo_access;
CREATE POLICY "Users can read own todo_access" ON public.todo_access
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- 5. Hardened RLS Policies on todos table
-- SELECT: Superadmin OR own todos OR users with TODO_VIEW permission
DROP POLICY IF EXISTS "Allow users to read own todos" ON public.todos;
DROP POLICY IF EXISTS "Allow users to read todos if authorized" ON public.todos;

CREATE POLICY "Allow users to read todos if authorized" ON public.todos
FOR SELECT TO authenticated
USING (
  (auth.uid() = user_id)
  OR public.is_superadmin()
  OR EXISTS (
    SELECT 1 FROM public.todo_access ta
    WHERE ta.user_id = auth.uid() AND ta.permission = 'TODO_VIEW'
  )
);

-- INSERT: Strictly Superadmin
DROP POLICY IF EXISTS "Allow users to insert own todos" ON public.todos;
DROP POLICY IF EXISTS "Allow superadmin to insert todos" ON public.todos;

CREATE POLICY "Allow superadmin to insert todos" ON public.todos
FOR INSERT TO authenticated
WITH CHECK (
  public.is_superadmin() AND (auth.uid() = user_id)
);

-- UPDATE: Strictly Superadmin
DROP POLICY IF EXISTS "Allow users to update own todos" ON public.todos;
DROP POLICY IF EXISTS "Allow superadmin to update todos" ON public.todos;

CREATE POLICY "Allow superadmin to update todos" ON public.todos
FOR UPDATE TO authenticated
USING (
  public.is_superadmin() AND (auth.uid() = user_id)
)
WITH CHECK (
  public.is_superadmin() AND (auth.uid() = user_id)
);

-- DELETE: Strictly Superadmin
DROP POLICY IF EXISTS "Allow users to delete own todos" ON public.todos;
DROP POLICY IF EXISTS "Allow superadmin to delete todos" ON public.todos;

CREATE POLICY "Allow superadmin to delete todos" ON public.todos
FOR DELETE TO authenticated
USING (
  public.is_superadmin() AND (auth.uid() = user_id)
);

-- 6. Permissions and Grants
REVOKE ALL ON TABLE public.todo_access FROM PUBLIC, anon;
GRANT ALL ON TABLE public.todo_access TO authenticated, service_role;
