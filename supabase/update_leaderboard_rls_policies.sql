-- Drop the existing SELECT policies on profiles table
DROP POLICY IF EXISTS "Allow users to read their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Allow admin to read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow supervisor to read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow authenticated users to read supervisor profiles" ON public.profiles;

-- Create a single SELECT policy allowing all authenticated users to read all profiles
CREATE POLICY "Allow authenticated users to read all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (true);

-- Drop the existing SELECT policy on records table
DROP POLICY IF EXISTS "Allow users to read own records, admins/supervisors read all" ON public.records;

-- Create a new SELECT policy allowing all authenticated users to read all records
CREATE POLICY "Allow authenticated users to read all records" ON public.records
  FOR SELECT TO authenticated USING (true);
