CREATE OR REPLACE FUNCTION public.assign_referral_code()
RETURNS TEXT AS $$
DECLARE
  v_code TEXT;
  v_exists BOOLEAN;
BEGIN
  -- Check if user already has a code
  SELECT referral_code INTO v_code FROM public.users WHERE id = auth.uid();
  IF v_code IS NOT NULL THEN
    RETURN v_code;
  END IF;

  -- Generate unique code
  LOOP
    v_code := upper(substring(md5(random()::text) from 1 for 8));
    SELECT EXISTS(SELECT 1 FROM public.users WHERE referral_code = v_code) INTO v_exists;
    IF NOT v_exists THEN
      UPDATE public.users SET referral_code = v_code WHERE id = auth.uid();
      RETURN v_code;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
