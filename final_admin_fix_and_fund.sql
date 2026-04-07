-- 1. Create a robust, non-recursive admin check function
CREATE OR REPLACE FUNCTION public.check_is_admin(user_uid UUID)
RETURNS BOOLEAN AS $$
DECLARE
    admin_status BOOLEAN;
    user_email TEXT;
BEGIN
    -- Fallback check auth.users directly FIRST to avoid touching public.users if possible
    SELECT email INTO user_email
    FROM auth.users
    WHERE id = user_uid;

    IF user_email = 'physicswala9899@gmail.com' THEN
        RETURN TRUE;
    END IF;

    -- Bypass RLS completely to check the users table using a direct query
    -- This prevents the "infinite recursion" error
    SELECT is_admin INTO admin_status
    FROM public.users
    WHERE id = user_uid;

    IF admin_status IS TRUE THEN
        RETURN TRUE;
    END IF;

    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Fix RLS Policies for all tables (Drop old ones first to avoid conflicts)
-- Users Table
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Admins can view all users" ON public.users;
DROP POLICY IF EXISTS "Admins can update all users" ON public.users;
DROP POLICY IF EXISTS "Admins can insert users" ON public.users;
DROP POLICY IF EXISTS "Admins can delete users" ON public.users;
DROP POLICY IF EXISTS "Admins have full access to users" ON public.users;

CREATE POLICY "Users can view own profile" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins have full access to users" ON public.users FOR ALL USING (public.check_is_admin(auth.uid()));

-- Trades Table
DROP POLICY IF EXISTS "Users can view own trades" ON public.trades;
DROP POLICY IF EXISTS "Users can insert own trades" ON public.trades;
DROP POLICY IF EXISTS "Admins can view all trades" ON public.trades;
DROP POLICY IF EXISTS "Admins can update all trades" ON public.trades;
DROP POLICY IF EXISTS "Admins have full access to trades" ON public.trades;

CREATE POLICY "Users can view own trades" ON public.trades FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own trades" ON public.trades FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins have full access to trades" ON public.trades FOR ALL USING (public.check_is_admin(auth.uid()));

-- Transactions Table
DROP POLICY IF EXISTS "Users can view own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can insert own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Admins can view all transactions" ON public.transactions;
DROP POLICY IF EXISTS "Admins can update all transactions" ON public.transactions;
DROP POLICY IF EXISTS "Admins have full access to transactions" ON public.transactions;

CREATE POLICY "Users can view own transactions" ON public.transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own transactions" ON public.transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins have full access to transactions" ON public.transactions FOR ALL USING (public.check_is_admin(auth.uid()));

-- Admin Logs Table
DROP POLICY IF EXISTS "Admins can view admin logs" ON public.admin_logs;
DROP POLICY IF EXISTS "Admins can insert admin logs" ON public.admin_logs;
DROP POLICY IF EXISTS "Admins have full access to admin_logs" ON public.admin_logs;

CREATE POLICY "Admins have full access to admin_logs" ON public.admin_logs FOR ALL USING (public.check_is_admin(auth.uid()));

-- Settings Table
DROP POLICY IF EXISTS "Anyone can view settings" ON public.settings;
DROP POLICY IF EXISTS "Admins can update settings" ON public.settings;
DROP POLICY IF EXISTS "Admins have full access to settings" ON public.settings;

CREATE POLICY "Anyone can view settings" ON public.settings FOR SELECT USING (true);
CREATE POLICY "Admins have full access to settings" ON public.settings FOR ALL USING (public.check_is_admin(auth.uid()));

-- 3. Add 1000 INR and make admin
DO $$
DECLARE
    target_user_id UUID;
BEGIN
    -- Find the user ID for the given email
    SELECT id INTO target_user_id FROM auth.users WHERE email = 'physicswala9899@gmail.com' LIMIT 1;

    IF target_user_id IS NOT NULL THEN
        -- Update or Insert into public.users
        INSERT INTO public.users (id, email, is_admin, balance, created_at)
        VALUES (target_user_id, 'physicswala9899@gmail.com', TRUE, 1000, NOW())
        ON CONFLICT (id) DO UPDATE
        SET 
            is_admin = TRUE,
            balance = public.users.balance + 1000;

        -- Add a transaction record for the deposit
        INSERT INTO public.transactions (user_id, type, amount, status, created_at)
        VALUES (target_user_id, 'DEPOSIT', 1000, 'COMPLETED', NOW());

        RAISE NOTICE 'Successfully added 1000 INR and set admin rights for physicswala9899@gmail.com';
    ELSE
        RAISE NOTICE 'User physicswala9899@gmail.com not found in auth.users. Please ensure they have signed up.';
    END IF;
END;
$$;
