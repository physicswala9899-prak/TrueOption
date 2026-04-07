-- Fix the infinite recursion issue on the users table
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Drop the problematic policy that causes the infinite loop
DROP POLICY IF EXISTS "Admins have full access to users" ON public.users;

-- Create a safe policy that doesn't query the users table itself
CREATE POLICY "Admins have full access to users" ON public.users
USING (
  (auth.jwt() ->> 'email') = 'physicswala9899@gmail.com' 
  OR 
  (auth.jwt() -> 'user_metadata' ->> 'is_admin') = 'true'
);
