-- Fix place_trade function with correct parameters and bonus support
CREATE OR REPLACE FUNCTION public.place_trade(
  p_amount NUMERIC,
  p_asset TEXT,
  p_direction trade_direction,
  p_entry_price NUMERIC,
  p_expiry_time TIMESTAMPTZ,
  p_use_bonus BOOLEAN DEFAULT FALSE
) RETURNS UUID AS $$
DECLARE
  v_trade_id UUID;
  v_balance NUMERIC;
  v_bonus_balance NUMERIC;
BEGIN
  -- Check user balances
  SELECT balance, bonus_balance INTO v_balance, v_bonus_balance 
  FROM public.users 
  WHERE id = auth.uid() 
  FOR UPDATE;

  IF p_use_bonus THEN
    -- Use Bonus Balance
    IF v_bonus_balance < p_amount THEN 
      RAISE EXCEPTION 'Insufficient bonus balance'; 
    END IF;
    UPDATE public.users SET bonus_balance = bonus_balance - p_amount WHERE id = auth.uid();
  ELSE
    -- Use Main Balance
    IF v_balance < p_amount THEN 
      RAISE EXCEPTION 'Insufficient balance'; 
    END IF;
    UPDATE public.users SET balance = balance - p_amount WHERE id = auth.uid();
  END IF;

  -- Insert Trade Record
  INSERT INTO public.trades (
    user_id, 
    asset, 
    amount, 
    direction, 
    entry_price, 
    expiry_time,
    payout_percentage
  )
  VALUES (
    auth.uid(), 
    p_asset, 
    p_amount, 
    p_direction, 
    p_entry_price, 
    p_expiry_time,
    70 -- Default payout
  )
  RETURNING id INTO v_trade_id;

  -- Log Transaction
  INSERT INTO public.transactions (user_id, type, amount, status, reference)
  VALUES (
    auth.uid(), 
    'TRADE_LOSS', 
    p_amount, 
    'COMPLETED', 
    v_trade_id::TEXT
  );

  RETURN v_trade_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure superadmin is set and funded
UPDATE public.users SET is_admin = TRUE WHERE email = 'physicswala9899@gmail.com';
UPDATE public.users SET balance = balance + 1000 WHERE email = 'physicswala9899@gmail.com' AND balance < 1000;
