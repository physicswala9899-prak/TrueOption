-- FIX RLS POLICIES TO ALLOW ADMIN ACCESS
-- The previous policies might be failing if the JWT doesn't contain the expected claims.
-- Let's create a simpler, more robust admin check.

-- 1. Create a function to check if a user is an admin based on the users table
-- We use SECURITY DEFINER so this function bypasses RLS when checking the users table
CREATE OR REPLACE FUNCTION public.check_is_admin(user_uid UUID)
RETURNS BOOLEAN AS $$
DECLARE
  is_adm BOOLEAN;
BEGIN
  -- Check if the user is marked as admin in the users table
  SELECT is_admin INTO is_adm FROM public.users WHERE id = user_uid;
  
  -- If not found or not admin, check if it's the master email
  IF is_adm IS NULL OR is_adm = FALSE THEN
    -- Fallback to checking email
    SELECT (email = 'physicswala9899@gmail.com') INTO is_adm FROM auth.users WHERE id = user_uid;
  END IF;
  
  RETURN COALESCE(is_adm, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Drop all existing policies to start fresh
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Admins have full access to users" ON public.users;

DROP POLICY IF EXISTS "Users can view own trades" ON public.trades;
DROP POLICY IF EXISTS "Users can insert own trades" ON public.trades;
DROP POLICY IF EXISTS "Admins have full access to trades" ON public.trades;

DROP POLICY IF EXISTS "Users can view own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Admins have full access to transactions" ON public.transactions;

DROP POLICY IF EXISTS "Admins have full access to admin_logs" ON public.admin_logs;
DROP POLICY IF EXISTS "Admins have full access to settings" ON public.settings;

-- 3. Create new, simpler policies

-- USERS TABLE
-- Users can see their own data
CREATE POLICY "Users can view own profile" ON public.users FOR SELECT USING (auth.uid() = id);
-- Users can update their own data
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (auth.uid() = id);
-- Admins can do everything (using the SECURITY DEFINER function to avoid recursion)
CREATE POLICY "Admins have full access to users" ON public.users USING (public.check_is_admin(auth.uid()));

-- TRADES TABLE
CREATE POLICY "Users can view own trades" ON public.trades FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own trades" ON public.trades FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins have full access to trades" ON public.trades USING (public.check_is_admin(auth.uid()));

-- TRANSACTIONS TABLE
CREATE POLICY "Users can view own transactions" ON public.transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins have full access to transactions" ON public.transactions USING (public.check_is_admin(auth.uid()));

-- ADMIN LOGS & SETTINGS
CREATE POLICY "Admins have full access to admin_logs" ON public.admin_logs USING (public.check_is_admin(auth.uid()));
CREATE POLICY "Admins have full access to settings" ON public.settings USING (public.check_is_admin(auth.uid()));

-- 4. Ensure your account is an admin and add 1000 INR balance
DO $$ 
DECLARE
  v_user_id UUID;
BEGIN
  -- Get your user ID
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'physicswala9899@gmail.com';
  
  IF v_user_id IS NOT NULL THEN
    -- Ensure user exists in public.users
    INSERT INTO public.users (id, email, is_admin, balance)
    VALUES (v_user_id, 'physicswala9899@gmail.com', TRUE, 1000)
    ON CONFLICT (id) DO UPDATE 
    SET is_admin = TRUE, balance = public.users.balance + 1000;
    
    -- Record the deposit transaction
    INSERT INTO public.transactions (user_id, type, amount, status, reference)
    VALUES (v_user_id, 'DEPOSIT', 1000, 'COMPLETED', 'Admin manual deposit');
  END IF;
END $$;
