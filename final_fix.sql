-- 1. Ensure columns exist in public.users
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;

-- 2. Update the trigger function to include email, phone, and referral_code
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, username, full_name, email, phone, referral_code, balance)
  VALUES (
    NEW.id, 
    NEW.raw_user_meta_data->>'username', 
    NEW.raw_user_meta_data->>'full_name', 
    NEW.email,
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'invite_code',
    0
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Sync existing users' emails and phones from auth.users
UPDATE public.users pu
SET 
  email = au.email,
  phone = au.raw_user_meta_data->>'phone',
  referral_code = au.raw_user_meta_data->>'invite_code'
FROM auth.users au
WHERE pu.id = au.id AND (pu.email IS NULL OR pu.phone IS NULL OR pu.referral_code IS NULL);

-- 4. Ensure the admin user has is_admin set to true
UPDATE public.users 
SET is_admin = true 
WHERE email = 'physicswala9899@gmail.com';

-- 5. Fix RLS Policies for users table (just in case they are missing)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Admins have full access to users" ON public.users;

CREATE POLICY "Users can view own profile" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Admins have full access to users" ON public.users USING (is_admin());

-- 6. Fix is_admin function (just in case it's missing)
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
