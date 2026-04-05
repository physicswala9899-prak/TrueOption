-- 1. Ensure email column exists
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email TEXT;

-- 2. Sync all missing users from auth.users to public.users
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

-- 3. Update emails for existing users
UPDATE public.users pu
SET email = au.email
FROM auth.users au
WHERE pu.id = au.id AND pu.email IS NULL;

-- 4. Force admin status for the specific email
UPDATE public.users 
SET is_admin = true 
WHERE email = 'physicswala9899@gmail.com';

-- 5. Backfill missing referral codes
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
