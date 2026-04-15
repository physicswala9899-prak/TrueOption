-- 1. Ensure check_is_admin exists and works correctly
CREATE OR REPLACE FUNCTION public.check_is_admin(user_uid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if the user is the hardcoded admin email or has is_admin = true
  RETURN EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = user_uid AND (is_admin = TRUE OR email = 'physicswala9899@gmail.com')
  ) OR (auth.jwt() ->> 'email') = 'physicswala9899@gmail.com';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Ensure is_admin() (no args) also works by calling check_is_admin(auth.uid())
CREATE OR REPLACE FUNCTION public.is_admin() 
RETURNS BOOLEAN AS $$
BEGIN
  RETURN public.check_is_admin(auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Re-define admin_settle_trade to be robust
CREATE OR REPLACE FUNCTION public.admin_settle_trade(
  p_trade_id UUID,
  p_result TEXT -- Use TEXT to avoid enum cast issues from RPC
) RETURNS VOID AS $$
DECLARE
  v_trade RECORD;
  v_payout NUMERIC;
  v_exit_price NUMERIC;
  v_result trade_result;
BEGIN
  -- Security check
  IF NOT public.is_admin() THEN 
    RAISE EXCEPTION 'Unauthorized: Admin access required'; 
  END IF;
  
  -- Cast text to enum
  v_result := p_result::trade_result;
  
  -- Get trade and lock it
  SELECT * INTO v_trade FROM public.trades WHERE id = p_trade_id FOR UPDATE;
  
  IF v_trade IS NULL THEN
    RAISE EXCEPTION 'Trade not found';
  END IF;
  
  IF v_trade.result != 'PENDING' THEN 
    RAISE EXCEPTION 'Trade already settled'; 
  END IF;
  
  -- Calculate a dummy exit price that matches the result for visual consistency
  IF v_result = 'WIN' THEN
    IF v_trade.direction = 'UP' THEN
      v_exit_price := v_trade.entry_price + (v_trade.entry_price * 0.001);
    ELSE
      v_exit_price := v_trade.entry_price - (v_trade.entry_price * 0.001);
    END IF;
    
    v_payout := v_trade.amount + (v_trade.amount * v_trade.payout_percentage / 100);
    
    -- Update user balance
    UPDATE public.users SET balance = balance + v_payout WHERE id = v_trade.user_id;
    
    -- Log WIN transaction
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
  
  -- Update trade record
  UPDATE public.trades 
  SET 
    result = v_result, 
    payout = v_payout, 
    exit_price = v_exit_price,
    settled_at = NOW() 
  WHERE id = p_trade_id;
  
  -- Log admin action
  INSERT INTO public.admin_logs (admin_id, action, details)
  VALUES (auth.uid(), 'SETTLE_TRADE', jsonb_build_object(
    'trade_id', p_trade_id, 
    'result', v_result, 
    'exit_price', v_exit_price,
    'payout', v_payout
  ));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Re-define set_trade_force_result to be robust
CREATE OR REPLACE FUNCTION public.set_trade_force_result(
  p_trade_id UUID,
  p_force_result TEXT -- Use TEXT to avoid enum cast issues from RPC
) RETURNS VOID AS $$
DECLARE
  v_force_result trade_result;
BEGIN
  -- Security check
  IF NOT public.is_admin() THEN 
    RAISE EXCEPTION 'Unauthorized: Admin access required'; 
  END IF;
  
  -- Handle NULL or empty string for clearing force result
  IF p_force_result IS NULL OR p_force_result = '' THEN
    UPDATE public.trades 
    SET force_result = NULL 
    WHERE id = p_trade_id AND result = 'PENDING';
  ELSE
    v_force_result := p_force_result::trade_result;
    UPDATE public.trades 
    SET force_result = v_force_result 
    WHERE id = p_trade_id AND result = 'PENDING';
  END IF;
  
  -- Log admin action
  INSERT INTO public.admin_logs (admin_id, action, details)
  VALUES (auth.uid(), 'SET_FORCE_RESULT', jsonb_build_object(
    'trade_id', p_trade_id, 
    'force_result', p_force_result
  ));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Fix RLS policies that might be using check_is_admin
DROP POLICY IF EXISTS "Admins have full access to users" ON public.users;
CREATE POLICY "Admins have full access to users" ON public.users FOR ALL USING (public.check_is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins have full access to trades" ON public.trades;
CREATE POLICY "Admins have full access to trades" ON public.trades FOR ALL USING (public.check_is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins have full access to transactions" ON public.transactions;
CREATE POLICY "Admins have full access to transactions" ON public.transactions FOR ALL USING (public.check_is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins have full access to admin_logs" ON public.admin_logs;
CREATE POLICY "Admins have full access to admin_logs" ON public.admin_logs FOR ALL USING (public.check_is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins have full access to settings" ON public.settings;
CREATE POLICY "Admins have full access to settings" ON public.settings FOR ALL USING (public.check_is_admin(auth.uid()));
