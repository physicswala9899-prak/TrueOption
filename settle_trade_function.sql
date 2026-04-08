-- Function to automatically settle trades based on exit price
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
  
  -- Check if trade is already settled
  IF v_trade.result != 'PENDING' THEN
    RETURN;
  END IF;

  -- Determine result
  IF v_trade.direction = 'UP' THEN
    IF p_exit_price > v_trade.entry_price THEN
      v_result := 'WIN';
    ELSE
      v_result := 'LOSS';
    END IF;
  ELSE -- DOWN
    IF p_exit_price < v_trade.entry_price THEN
      v_result := 'WIN';
    ELSE
      v_result := 'LOSS';
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
    settled_at = NOW() 
  WHERE id = p_trade_id;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
