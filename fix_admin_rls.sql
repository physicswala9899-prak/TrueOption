-- 1. Fix the is_admin() function to avoid infinite recursion while checking the users table
CREATE OR REPLACE FUNCTION public.is_admin() 
RETURNS BOOLEAN AS $$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  -- First check JWT email for the superadmin
  IF (auth.jwt() ->> 'email') = 'physicswala9899@gmail.com' THEN
    RETURN TRUE;
  END IF;

  -- Then check the users table, bypassing RLS because this is SECURITY DEFINER
  SELECT is_admin INTO v_is_admin FROM public.users WHERE id = auth.uid();
  RETURN COALESCE(v_is_admin, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Ensure RLS policies are correct
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to recreate them cleanly
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Admins have full access to users" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;

-- Recreate policies
CREATE POLICY "Users can view own profile" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins have full access to users" ON public.users USING (public.is_admin());
