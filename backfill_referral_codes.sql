DO $$ 
DECLARE
    r RECORD;
    v_code TEXT;
    v_exists BOOLEAN;
BEGIN
    FOR r IN SELECT id FROM public.users WHERE referral_code IS NULL LOOP
        -- Generate unique code
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
