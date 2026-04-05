-- ==========================================
-- COMPLETE SYNC & FIX SCRIPT FOR ADMIN PANEL
-- ==========================================

-- 1. Ensure email column exists in public.users
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email TEXT;

-- 2. Fix the is_admin() function to avoid infinite recursion
CREATE OR REPLACE FUNCTION public.is_admin() 
RETURNS BOOLEAN AS $$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  -- First check JWT email for the superadmin (fallback)
  IF (auth.jwt() ->> 'email') = 'physicswala9899@gmail.com' THEN
    RETURN TRUE;
  END IF;

  -- Then check the users table, bypassing RLS because this is SECURITY DEFINER
  SELECT is_admin INTO v_is_admin FROM public.users WHERE id = auth.uid();
  RETURN COALESCE(v_is_admin, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Fix RLS Policies for users table
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Admins have full access to users" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;

CREATE POLICY "Users can view own profile" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins have full access to users" ON public.users USING (public.is_admin());

-- 4. Sync missing users from auth.users to public.users
INSERT INTO public.users (id, username, full_name, balance, email, is_admin)
SELECT 
  au.id, 
  COALESCE(au.raw_user_meta_data->>'username', 'user_' || substr(au.id::text, 1, 5)),
  COALESCE(au.raw_user_meta_data->>'full_name', 'User'),
  0,
  au.email,
  (au.email = 'physicswala9899@gmail.com')
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
WHERE pu.id IS NULL;

-- 5. Update emails for existing users
UPDATE public.users pu
SET email = au.email
FROM auth.users au
WHERE pu.id = au.id AND pu.email IS NULL;

-- 6. Force admin status for the specific email
UPDATE public.users 
SET is_admin = true 
WHERE email = 'physicswala9899@gmail.com';

-- 7. Backfill missing referral codes
DO $$ 
DECLARE
    r RECORD;
    v_code TEXT;
    v_exists BOOLEAN;
BEGIN
    FOR r IN SELECT id FROM public.users WHERE referral_code IS NULL LOOP
        LOOP
            v_code := upper(substring(md5(random()::text) from 1 for 8));
            SELECT EXISTS(SELECT 1 FROM public.users WHERE referral_code = v_code) INTO v_exists;
            IF NOT v_exists THEN
                UPDATE public.users SET referral_code = v_code WHERE id = r.id;
                EXIT;
            END IF;
        END LOOP;
    END LOOP;
END $$;
