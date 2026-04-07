-- Fix the infinite recursion issue on the users table
-- We need to drop all policies that use is_admin() because is_admin() queries the users table.
-- Instead, we will use a policy that checks the JWT directly.

-- 1. Drop existing policies on users
DROP POLICY IF EXISTS "Admins have full access to users" ON public.users;
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;

-- 2. Re-create policies using JWT directly to avoid recursion
CREATE POLICY "Users can view own profile" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (auth.uid() = id);

-- 3. Create Admin policy using JWT
CREATE POLICY "Admins have full access to users" ON public.users
USING (
  (auth.jwt() ->> 'email') = 'physicswala9899@gmail.com' 
  OR 
  (auth.jwt() -> 'user_metadata' ->> 'is_admin') = 'true'
);

-- 4. Fix other policies that depend on is_admin()
DROP POLICY IF EXISTS "Admins have full access to trades" ON public.trades;
CREATE POLICY "Admins have full access to trades" ON public.trades
USING (
  (auth.jwt() ->> 'email') = 'physicswala9899@gmail.com' 
  OR 
  (auth.jwt() -> 'user_metadata' ->> 'is_admin') = 'true'
);

DROP POLICY IF EXISTS "Admins have full access to transactions" ON public.transactions;
CREATE POLICY "Admins have full access to transactions" ON public.transactions
USING (
  (auth.jwt() ->> 'email') = 'physicswala9899@gmail.com' 
  OR 
  (auth.jwt() -> 'user_metadata' ->> 'is_admin') = 'true'
);
