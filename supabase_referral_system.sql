-- 1. Update ENUMs
ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'REFERRAL_BONUS_REFERRER';
ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'REFERRAL_BONUS_REFEREE';
ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'REFERRAL_COMMISSION';

-- 2. Update Users Table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES public.users(id);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS bonus_balance NUMERIC DEFAULT 0 CHECK (bonus_balance >= 0);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS referral_bonus_received BOOLEAN DEFAULT FALSE;

-- 3. Update Trades Table
DO $$ BEGIN
    CREATE TYPE balance_type AS ENUM ('MAIN', 'BONUS');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS balance_type_used balance_type DEFAULT 'MAIN';

-- 4. Create Referral Bonus Events Table
CREATE TABLE IF NOT EXISTS public.referral_bonus_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_id UUID REFERENCES public.users(id) NOT NULL,
  referee_id UUID REFERENCES public.users(id) NOT NULL,
  deposit_id UUID REFERENCES public.transactions(id),
  referrer_bonus_amount NUMERIC NOT NULL,
  referee_bonus_amount NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Create Referral Commissions Table
CREATE TABLE IF NOT EXISTS public.referral_commissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_id UUID REFERENCES public.users(id) NOT NULL,
  referee_id UUID REFERENCES public.users(id) NOT NULL,
  trade_id UUID REFERENCES public.trades(id) NOT NULL,
  stake_amount NUMERIC NOT NULL,
  commission_amount NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. RLS Policies for new tables
ALTER TABLE public.referral_bonus_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_commissions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "Users can view own referral bonus events" ON public.referral_bonus_events FOR SELECT USING (auth.uid() = referrer_id OR auth.uid() = referee_id);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE POLICY "Users can view own referral commissions" ON public.referral_commissions FOR SELECT USING (auth.uid() = referrer_id);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE POLICY "Admins have full access to referral_bonus_events" ON public.referral_bonus_events USING (is_admin());
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE POLICY "Admins have full access to referral_commissions" ON public.referral_commissions USING (is_admin());
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 7. Function to generate unique referral code
CREATE OR REPLACE FUNCTION public.generate_unique_referral_code()
RETURNS TEXT AS $$
DECLARE
  v_code TEXT;
  v_exists BOOLEAN;
BEGIN
  LOOP
    -- Generate 8 character random string
    v_code := upper(substring(md5(random()::text) from 1 for 8));
    
    SELECT EXISTS(SELECT 1 FROM public.users WHERE referral_code = v_code) INTO v_exists;
    
    IF NOT v_exists THEN
      RETURN v_code;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Update handle_new_user to generate referral code and handle referred_by
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_referral_code TEXT;
  v_referred_by UUID := NULL;
  v_input_invite_code TEXT;
BEGIN
  v_referral_code := public.generate_unique_referral_code();
  v_input_invite_code := NEW.raw_user_meta_data->>'invite_code';

  IF v_input_invite_code IS NOT NULL AND v_input_invite_code != '' THEN
    SELECT id INTO v_referred_by FROM public.users WHERE referral_code = v_input_invite_code;
  END IF;

  INSERT INTO public.users (id, username, full_name, balance, phone, invite_code, referral_code, referred_by, is_admin)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || substr(NEW.id::text, 1, 5)), 
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'), 
    0,
    NEW.raw_user_meta_data->>'phone',
    v_input_invite_code,
    v_referral_code,
    v_referred_by,
    (NEW.email = 'physicswala9899@gmail.com')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Function to handle deposit referral bonus
CREATE OR REPLACE FUNCTION public.handle_deposit_referral_bonus(p_transaction_id UUID)
RETURNS VOID AS $$
DECLARE
  v_transaction RECORD;
  v_referee RECORD;
  v_referrer RECORD;
  v_referrer_bonus NUMERIC := 189;
  v_referee_bonus NUMERIC := 89;
BEGIN
  SELECT * INTO v_transaction FROM public.transactions WHERE id = p_transaction_id;
  
  IF v_transaction.type = 'DEPOSIT' AND v_transaction.status = 'COMPLETED' AND v_transaction.amount >= 500 THEN
    SELECT * INTO v_referee FROM public.users WHERE id = v_transaction.user_id FOR UPDATE;
    
    IF v_referee.referred_by IS NOT NULL AND v_referee.referral_bonus_received = FALSE THEN
      SELECT * INTO v_referrer FROM public.users WHERE id = v_referee.referred_by FOR UPDATE;
      
      IF FOUND THEN
        -- Update balances
        UPDATE public.users SET bonus_balance = bonus_balance + v_referrer_bonus WHERE id = v_referrer.id;
        UPDATE public.users SET bonus_balance = bonus_balance + v_referee_bonus, referral_bonus_received = TRUE WHERE id = v_referee.id;
        
        -- Insert events
        INSERT INTO public.referral_bonus_events (referrer_id, referee_id, deposit_id, referrer_bonus_amount, referee_bonus_amount)
        VALUES (v_referrer.id, v_referee.id, v_transaction.id, v_referrer_bonus, v_referee_bonus);
        
        -- Insert transactions
        INSERT INTO public.transactions (user_id, type, amount, status, reference)
        VALUES (v_referrer.id, 'REFERRAL_BONUS_REFERRER', v_referrer_bonus, 'COMPLETED', 'Bonus from ' || v_referee.username);
        
        INSERT INTO public.transactions (user_id, type, amount, status, reference)
        VALUES (v_referee.id, 'REFERRAL_BONUS_REFEREE', v_referee_bonus, 'COMPLETED', 'Welcome bonus');
      END IF;
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update adjust_user_balance to trigger handle_deposit_referral_bonus
CREATE OR REPLACE FUNCTION public.adjust_user_balance(
  p_user_id UUID,
  p_amount NUMERIC,
  p_reason TEXT
) RETURNS VOID AS $$
DECLARE
  v_transaction_id UUID;
BEGIN
  -- Check if caller is admin
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = TRUE) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Update balance
  UPDATE public.users SET balance = balance + p_amount WHERE id = p_user_id;

  -- Record transaction
  INSERT INTO public.transactions (user_id, type, amount, status, reference)
  VALUES (p_user_id, CASE WHEN p_amount > 0 THEN 'DEPOSIT'::transaction_type ELSE 'WITHDRAWAL'::transaction_type END, ABS(p_amount), 'COMPLETED', p_reason)
  RETURNING id INTO v_transaction_id;

  -- Log action
  INSERT INTO public.admin_logs (admin_id, action, details)
  VALUES (auth.uid(), 'ADJUST_BALANCE', jsonb_build_object('user_id', p_user_id, 'amount', p_amount, 'reason', p_reason));

  -- Trigger referral bonus check if it's a deposit
  IF p_amount > 0 THEN
    PERFORM public.handle_deposit_referral_bonus(v_transaction_id);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Update place_trade to handle bonus balance and commissions
CREATE OR REPLACE FUNCTION public.place_trade(
  p_asset TEXT,
  p_amount NUMERIC,
  p_direction trade_direction,
  p_entry_price NUMERIC,
  p_expiry_time TIMESTAMPTZ,
  p_use_bonus BOOLEAN DEFAULT FALSE
) RETURNS UUID AS $$
DECLARE
  v_trade_id UUID;
  v_user RECORD;
  v_commission NUMERIC;
  v_balance_type balance_type;
BEGIN
  -- Get user
  SELECT * INTO v_user FROM public.users WHERE id = auth.uid() FOR UPDATE;
  
  IF p_use_bonus THEN
    IF v_user.bonus_balance < p_amount THEN
      RAISE EXCEPTION 'Insufficient bonus balance';
    END IF;
    UPDATE public.users SET bonus_balance = bonus_balance - p_amount WHERE id = auth.uid();
    v_balance_type := 'BONUS';
  ELSE
    IF v_user.balance < p_amount THEN
      RAISE EXCEPTION 'Insufficient main balance';
    END IF;
    UPDATE public.users SET balance = balance - p_amount WHERE id = auth.uid();
    v_balance_type := 'MAIN';
  END IF;

  -- Insert trade
  INSERT INTO public.trades (user_id, asset, amount, direction, entry_price, expiry_time, balance_type_used)
  VALUES (auth.uid(), p_asset, p_amount, p_direction, p_entry_price, p_expiry_time, v_balance_type)
  RETURNING id INTO v_trade_id;

  -- Record transaction
  INSERT INTO public.transactions (user_id, type, amount, status, reference)
  VALUES (auth.uid(), 'TRADE_LOSS', p_amount, 'COMPLETED', v_trade_id::TEXT);

  -- Handle Referral Commission (5%)
  IF v_user.referred_by IS NOT NULL THEN
    v_commission := p_amount * 0.05;
    
    -- Add to referrer's main balance
    UPDATE public.users SET balance = balance + v_commission WHERE id = v_user.referred_by;
    
    -- Insert commission record
    INSERT INTO public.referral_commissions (referrer_id, referee_id, trade_id, stake_amount, commission_amount)
    VALUES (v_user.referred_by, auth.uid(), v_trade_id, p_amount, v_commission);
    
    -- Insert transaction for referrer
    INSERT INTO public.transactions (user_id, type, amount, status, reference)
    VALUES (v_user.referred_by, 'REFERRAL_COMMISSION', v_commission, 'COMPLETED', 'Commission from trade ' || v_trade_id::TEXT);
  END IF;

  RETURN v_trade_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
