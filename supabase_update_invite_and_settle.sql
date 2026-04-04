-- 1. Users table mein invite_code column add karein
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS invite_code TEXT;

-- 2. handle_new_user function ko update karein taaki invite_code save ho sake
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, username, full_name, balance, phone, invite_code, is_admin)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || substr(NEW.id::text, 1, 5)), 
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'), 
    0,
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'invite_code',
    (NEW.email = 'physicswala9899@gmail.com')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. settle_trade (singular) function add karein jo TradePage.tsx use kar raha h
CREATE OR REPLACE FUNCTION public.settle_trade(
  p_trade_id UUID,
  p_exit_price NUMERIC
) RETURNS VOID AS $$
DECLARE
  v_trade RECORD;
  v_payout NUMERIC;
  v_result trade_result;
BEGIN
  -- Get trade details
  SELECT * INTO v_trade FROM public.trades WHERE id = p_trade_id FOR UPDATE;
  
  -- Check if already settled
  IF v_trade.result != 'PENDING' THEN
    RETURN;
  END IF;

  -- Determine result
  IF (v_trade.direction = 'UP' AND p_exit_price > v_trade.entry_price) OR
     (v_trade.direction = 'DOWN' AND p_exit_price < v_trade.entry_price) THEN
    v_result := 'WIN';
    v_payout := v_trade.amount + (v_trade.amount * v_trade.payout_percentage / 100);
    
    -- Credit user balance
    UPDATE public.users SET balance = balance + v_payout WHERE id = v_trade.user_id;
    
    -- Record transaction
    INSERT INTO public.transactions (user_id, type, amount, status, reference)
    VALUES (v_trade.user_id, 'TRADE_WIN', v_payout, 'COMPLETED', v_trade.id::TEXT);
  ELSE
    v_result := 'LOSS';
    v_payout := 0;
  END IF;

  -- Update trade record
  UPDATE public.trades 
  SET result = v_result, payout = v_payout, settled_at = NOW()
  WHERE id = p_trade_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
