ALTER TABLE public.users ADD COLUMN IF NOT EXISTS bonus_balance NUMERIC DEFAULT 0 CHECK (bonus_balance >= 0);

CREATE OR REPLACE FUNCTION public.adjust_user_bonus_balance(
  p_user_id UUID,
  p_amount NUMERIC,
  p_reason TEXT
) RETURNS VOID AS $$
BEGIN
  IF NOT public.check_is_admin(auth.uid()) THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  UPDATE public.users SET bonus_balance = bonus_balance + p_amount WHERE id = p_user_id;
  INSERT INTO public.admin_logs (admin_id, action, details)
  VALUES (auth.uid(), 'ADJUST_BONUS_BALANCE', jsonb_build_object('user_id', p_user_id, 'amount', p_amount, 'reason', p_reason));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update other RPCs to use check_is_admin
CREATE OR REPLACE FUNCTION public.adjust_user_balance(
  p_user_id UUID,
  p_amount NUMERIC,
  p_reason TEXT
) RETURNS VOID AS $$
BEGIN
  IF NOT public.check_is_admin(auth.uid()) THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  UPDATE public.users SET balance = balance + p_amount WHERE id = p_user_id;
  INSERT INTO public.transactions (user_id, type, amount, status, reference)
  VALUES (p_user_id, CASE WHEN p_amount > 0 THEN 'DEPOSIT'::transaction_type ELSE 'WITHDRAWAL'::transaction_type END, ABS(p_amount), 'COMPLETED', p_reason);
  INSERT INTO public.admin_logs (admin_id, action, details)
  VALUES (auth.uid(), 'ADJUST_BALANCE', jsonb_build_object('user_id', p_user_id, 'amount', p_amount, 'reason', p_reason));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.admin_settle_trade(
  p_trade_id UUID,
  p_result trade_result
) RETURNS VOID AS $$
DECLARE
  v_trade RECORD;
  v_payout NUMERIC;
BEGIN
  IF NOT public.check_is_admin(auth.uid()) THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  SELECT * INTO v_trade FROM public.trades WHERE id = p_trade_id FOR UPDATE;
  IF v_trade.result != 'PENDING' THEN RAISE EXCEPTION 'Trade already settled'; END IF;
  IF p_result = 'WIN' THEN
    v_payout := v_trade.amount + (v_trade.amount * v_trade.payout_percentage / 100);
    UPDATE public.users SET balance = balance + v_payout WHERE id = v_trade.user_id;
    INSERT INTO public.transactions (user_id, type, amount, status, reference)
    VALUES (v_trade.user_id, 'TRADE_WIN', v_payout, 'COMPLETED', v_trade.id::TEXT);
  ELSE
    v_payout := 0;
  END IF;
  UPDATE public.trades SET result = p_result, payout = v_payout, settled_at = NOW() WHERE id = p_trade_id;
  INSERT INTO public.admin_logs (admin_id, action, details)
  VALUES (auth.uid(), 'SETTLE_TRADE', jsonb_build_object('trade_id', p_trade_id, 'result', p_result));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.admin_handle_withdrawal(
  p_transaction_id UUID,
  p_status transaction_status
) RETURNS VOID AS $$
DECLARE
  v_transaction RECORD;
BEGIN
  IF NOT public.check_is_admin(auth.uid()) THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  SELECT * INTO v_transaction FROM public.transactions WHERE id = p_transaction_id FOR UPDATE;
  IF v_transaction.type != 'WITHDRAWAL' OR v_transaction.status != 'PENDING' THEN RAISE EXCEPTION 'Invalid transaction'; END IF;
  IF p_status = 'COMPLETED' THEN
    UPDATE public.transactions SET status = 'COMPLETED' WHERE id = p_transaction_id;
  ELSIF p_status = 'FAILED' THEN
    UPDATE public.users SET balance = balance + v_transaction.amount WHERE id = v_transaction.user_id;
    UPDATE public.transactions SET status = 'FAILED' WHERE id = p_transaction_id;
  END IF;
  INSERT INTO public.admin_logs (admin_id, action, details)
  VALUES (auth.uid(), 'HANDLE_WITHDRAWAL', jsonb_build_object('transaction_id', p_transaction_id, 'status', p_status));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.admin_set_user_blocked(
  p_user_id UUID,
  p_blocked BOOLEAN
) RETURNS VOID AS $$
BEGIN
  IF NOT public.check_is_admin(auth.uid()) THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  UPDATE public.users SET is_blocked = p_blocked WHERE id = p_user_id;
  INSERT INTO public.admin_logs (admin_id, action, details)
  VALUES (auth.uid(), CASE WHEN p_blocked THEN 'BLOCK_USER' ELSE 'UNBLOCK_USER' END, jsonb_build_object('user_id', p_user_id));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
