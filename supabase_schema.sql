-- DATABASE SCHEMA FOR TRUEOPTION

-- 1. Users Table (Extends Auth.Users)
CREATE TABLE public.users (
  id UUID REFERENCES auth.users NOT NULL PRIMARY KEY,
  username TEXT UNIQUE,
  full_name TEXT,
  balance NUMERIC DEFAULT 0 CHECK (balance >= 0),
  is_admin BOOLEAN DEFAULT FALSE,
  is_blocked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.1 Admin Logs Table
CREATE TABLE public.admin_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id UUID REFERENCES public.users(id) NOT NULL,
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Trades Table
CREATE TYPE trade_direction AS ENUM ('UP', 'DOWN');
CREATE TYPE trade_result AS ENUM ('WIN', 'LOSS', 'PENDING');

CREATE TABLE public.trades (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) NOT NULL,
  asset TEXT NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  direction trade_direction NOT NULL,
  entry_price NUMERIC NOT NULL,
  expiry_time TIMESTAMPTZ NOT NULL,
  payout_percentage NUMERIC DEFAULT 70,
  result trade_result DEFAULT 'PENDING',
  payout NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  settled_at TIMESTAMPTZ
);

-- 3. Transactions Table
CREATE TYPE transaction_type AS ENUM ('DEPOSIT', 'WITHDRAWAL', 'TRADE_LOSS', 'TRADE_WIN');
CREATE TYPE transaction_status AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

CREATE TABLE public.transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) NOT NULL,
  type transaction_type NOT NULL,
  amount NUMERIC NOT NULL,
  status transaction_status DEFAULT 'PENDING',
  reference TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Settings Table
CREATE TABLE public.settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL
);

-- INSERT DEFAULT SETTINGS
INSERT INTO public.settings (key, value) VALUES ('payout_percentages', '{"BTCUSDT": 70}');

-- 5. RLS POLICIES

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;

-- Users Policies
CREATE POLICY "Users can view own profile" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (auth.uid() = id);

-- Trades Policies
CREATE POLICY "Users can view own trades" ON public.trades FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own trades" ON public.trades FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Transactions Policies
CREATE POLICY "Users can view own transactions" ON public.transactions FOR SELECT USING (auth.uid() = user_id);

-- Admin Policies
CREATE POLICY "Admins have full access to users" ON public.users USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = TRUE)
);
CREATE POLICY "Admins have full access to trades" ON public.trades USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = TRUE)
);
CREATE POLICY "Admins have full access to transactions" ON public.transactions USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = TRUE)
);
CREATE POLICY "Admins have full access to admin_logs" ON public.admin_logs USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = TRUE)
);
CREATE POLICY "Admins have full access to settings" ON public.settings USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = TRUE)
);

-- 6. FUNCTIONS & TRIGGERS

-- Automatically create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, username, full_name, balance)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'username', NEW.raw_user_meta_data->>'full_name', 0);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Atomic Trade Placement (Deduct balance and insert trade)
CREATE OR REPLACE FUNCTION public.place_trade(
  p_asset TEXT,
  p_amount NUMERIC,
  p_direction trade_direction,
  p_entry_price NUMERIC,
  p_expiry_time TIMESTAMPTZ
) RETURNS UUID AS $$
DECLARE
  v_trade_id UUID;
  v_balance NUMERIC;
BEGIN
  -- Check balance
  SELECT balance INTO v_balance FROM public.users WHERE id = auth.uid() FOR UPDATE;
  
  IF v_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  -- Deduct balance
  UPDATE public.users SET balance = balance - p_amount WHERE id = auth.uid();

  -- Insert trade
  INSERT INTO public.trades (user_id, asset, amount, direction, entry_price, expiry_time)
  VALUES (auth.uid(), p_asset, p_amount, p_direction, p_entry_price, p_expiry_time)
  RETURNING id INTO v_trade_id;

  -- Record transaction
  INSERT INTO public.transactions (user_id, type, amount, status, reference)
  VALUES (auth.uid(), 'TRADE_LOSS', p_amount, 'COMPLETED', v_trade_id::TEXT);

  RETURN v_trade_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Admin Balance Adjustment
CREATE OR REPLACE FUNCTION public.adjust_user_balance(
  p_user_id UUID,
  p_amount NUMERIC,
  p_reason TEXT
) RETURNS VOID AS $$
BEGIN
  -- Check if caller is admin
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = TRUE) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Update balance
  UPDATE public.users SET balance = balance + p_amount WHERE id = p_user_id;

  -- Record transaction
  INSERT INTO public.transactions (user_id, type, amount, status, reference)
  VALUES (p_user_id, CASE WHEN p_amount > 0 THEN 'DEPOSIT'::transaction_type ELSE 'WITHDRAWAL'::transaction_type END, ABS(p_amount), 'COMPLETED', p_reason);

  -- Log action
  INSERT INTO public.admin_logs (admin_id, action, details)
  VALUES (auth.uid(), 'ADJUST_BALANCE', jsonb_build_object('user_id', p_user_id, 'amount', p_amount, 'reason', p_reason));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Admin Block/Unblock User
CREATE OR REPLACE FUNCTION public.admin_set_user_blocked(
  p_user_id UUID,
  p_blocked BOOLEAN
) RETURNS VOID AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = TRUE) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE public.users SET is_blocked = p_blocked WHERE id = p_user_id;

  INSERT INTO public.admin_logs (admin_id, action, details)
  VALUES (auth.uid(), CASE WHEN p_blocked THEN 'BLOCK_USER' ELSE 'UNBLOCK_USER' END, jsonb_build_object('user_id', p_user_id));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Admin Manual Settlement
CREATE OR REPLACE FUNCTION public.admin_settle_trade(
  p_trade_id UUID,
  p_result trade_result
) RETURNS VOID AS $$
DECLARE
  v_trade RECORD;
  v_payout NUMERIC;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = TRUE) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT * INTO v_trade FROM public.trades WHERE id = p_trade_id FOR UPDATE;
  
  IF v_trade.result != 'PENDING' THEN
    RAISE EXCEPTION 'Trade already settled';
  END IF;

  IF p_result = 'WIN' THEN
    v_payout := v_trade.amount + (v_trade.amount * v_trade.payout_percentage / 100);
    UPDATE public.users SET balance = balance + v_payout WHERE id = v_trade.user_id;
    INSERT INTO public.transactions (user_id, type, amount, status, reference)
    VALUES (v_trade.user_id, 'TRADE_WIN', v_payout, 'COMPLETED', v_trade.id::TEXT);
  ELSE
    v_payout := 0;
  END IF;

  UPDATE public.trades 
  SET result = p_result, payout = v_payout, settled_at = NOW()
  WHERE id = p_trade_id;

  INSERT INTO public.admin_logs (admin_id, action, details)
  VALUES (auth.uid(), 'SETTLE_TRADE', jsonb_build_object('trade_id', p_trade_id, 'result', p_result));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Admin Withdrawal Management
CREATE OR REPLACE FUNCTION public.admin_handle_withdrawal(
  p_transaction_id UUID,
  p_status transaction_status
) RETURNS VOID AS $$
DECLARE
  v_transaction RECORD;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = TRUE) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT * INTO v_transaction FROM public.transactions WHERE id = p_transaction_id FOR UPDATE;
  
  IF v_transaction.type != 'WITHDRAWAL' OR v_transaction.status != 'PENDING' THEN
    RAISE EXCEPTION 'Invalid transaction';
  END IF;

  IF p_status = 'COMPLETED' THEN
    -- Balance was already deducted when withdrawal was requested (assuming standard flow)
    -- If not, deduct here. Let's assume it was deducted on request.
    UPDATE public.transactions SET status = 'COMPLETED' WHERE id = p_transaction_id;
  ELSIF p_status = 'FAILED' THEN
    -- Refund balance
    UPDATE public.users SET balance = balance + v_transaction.amount WHERE id = v_transaction.user_id;
    UPDATE public.transactions SET status = 'FAILED' WHERE id = p_transaction_id;
  END IF;

  INSERT INTO public.admin_logs (admin_id, action, details)
  VALUES (auth.uid(), 'HANDLE_WITHDRAWAL', jsonb_build_object('transaction_id', p_transaction_id, 'status', p_status));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. INITIAL ADMIN SETUP (Run this after the user signs up)
-- UPDATE public.users SET is_admin = TRUE WHERE email = 'riddhaanleo@gmail.com';

-- Trade Settlement Logic
CREATE OR REPLACE FUNCTION public.settle_trades(p_asset TEXT, p_current_price NUMERIC)
RETURNS VOID AS $$
DECLARE
  v_trade RECORD;
  v_payout NUMERIC;
  v_result trade_result;
BEGIN
  FOR v_trade IN 
    SELECT * FROM public.trades 
    WHERE asset = p_asset AND result = 'PENDING' AND expiry_time <= NOW()
  LOOP
    -- Determine result
    IF (v_trade.direction = 'UP' AND p_current_price > v_trade.entry_price) OR
       (v_trade.direction = 'DOWN' AND p_current_price < v_trade.entry_price) THEN
      v_result := 'WIN';
      v_payout := v_trade.amount + (v_trade.amount * v_trade.payout_percentage / 100);
      
      -- Credit user
      UPDATE public.users SET balance = balance + v_payout WHERE id = v_trade.user_id;
      
      -- Record transaction
      INSERT INTO public.transactions (user_id, type, amount, status, reference)
      VALUES (v_trade.user_id, 'TRADE_WIN', v_payout, 'COMPLETED', v_trade.id::TEXT);
    ELSE
      v_result := 'LOSS';
      v_payout := 0;
    END IF;

    -- Update trade
    UPDATE public.trades 
    SET result = v_result, payout = v_payout, settled_at = NOW()
    WHERE id = v_trade.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
