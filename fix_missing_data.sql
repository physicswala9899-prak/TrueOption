-- 1. Add email column to public.users if it doesn't exist
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email TEXT;

-- 2. Update the signup trigger to save email, phone, and generate referral code automatically
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_referral_code TEXT;
  v_referred_by UUID := NULL;
  v_input_invite_code TEXT;
BEGIN
  -- Generate unique referral code
  LOOP
    v_referral_code := upper(substring(md5(random()::text) from 1 for 8));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.users WHERE referral_code = v_referral_code);
  END LOOP;

  v_input_invite_code := NEW.raw_user_meta_data->>'invite_code';

  IF v_input_invite_code IS NOT NULL AND v_input_invite_code != '' THEN
    SELECT id INTO v_referred_by FROM public.users WHERE referral_code = v_input_invite_code;
  END IF;

  INSERT INTO public.users (id, username, full_name, balance, phone, email, invite_code, referral_code, referred_by, is_admin)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || substr(NEW.id::text, 1, 5)), 
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'), 
    0,
    NEW.raw_user_meta_data->>'phone',
    NEW.email,
    v_input_invite_code,
    v_referral_code,
    v_referred_by,
    (NEW.email = 'physicswala9899@gmail.com')
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Backfill missing emails from auth.users to public.users for old accounts
UPDATE public.users pu
SET email = au.email
FROM auth.users au
WHERE pu.id = au.id AND pu.email IS NULL;

-- 4. Backfill missing referral codes for existing users who don't have one
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
