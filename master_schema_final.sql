-- MASTER SCHEMA FOR TRUEOPTION (FINAL VERSION)
-- This script sets up the entire database, fixes infinite recursion, and ensures admin access.

-- 0. CLEANUP (Optional: Only run if you want to reset everything)
-- DROP SCHEMA public CASCADE;
-- CREATE SCHEMA public;
-- GRANT ALL ON SCHEMA public TO postgres;
-- GRANT ALL ON SCHEMA public TO public;

-- 1. ENUMS
DO $$ BEGIN
    CREATE TYPE trade_direction AS ENUM ('UP', 'DOWN');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE trade_result AS ENUM ('WIN', 'LOSS', 'PENDING');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE transaction_type AS ENUM ('DEPOSIT', 'WITHDRAWAL', 'TRADE_LOSS', 'TRADE_WIN');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE transaction_status AS ENUM ('PENDING', 'COMPLETED', 'FAILED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. TABLES

-- Users Table
CREATE TABLE IF NOT EXISTS public.users (
  id UUID REFERENCES auth.users NOT NULL PRIMARY KEY,
  username TEXT UNIQUE,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  referral_code TEXT UNIQUE,
  balance NUMERIC DEFAULT 0 CHECK (balance >= 0),
  is_admin BOOLEAN DEFAULT FALSE,
  is_blocked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Admin Logs Table
CREATE TABLE IF NOT EXISTS public.admin_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id UUID REFERENCES public.users(id) NOT NULL,
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trades Table
CREATE TABLE IF NOT EXISTS public.trades (
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

-- Transactions Table
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) NOT NULL,
  type transaction_type NOT NULL,
  amount NUMERIC NOT NULL,
  status transaction_status DEFAULT 'PENDING',
  reference TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Settings Table
CREATE TABLE IF NOT EXISTS public.settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL
);

-- 3. INITIAL DATA
INSERT INTO public.settings (key, value) 
VALUES ('payout_percentages', '{"BTCUSDT": 70}')
ON CONFLICT (key) DO NOTHING;

-- 4. SECURITY (RLS)

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;

-- CRITICAL: Non-recursive Admin Check
-- This function checks JWT metadata or hardcoded email to avoid querying the users table itself.
CREATE OR REPLACE FUNCTION public.is_admin() 
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    (auth.jwt() ->> 'email') = 'physicswala9899@gmail.com' 
    OR 
    (auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- DROP OLD POLICIES TO PREVENT CONFLICTS
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Admins have full access to users" ON public.users;
DROP POLICY IF EXISTS "Users can view own trades" ON public.trades;
DROP POLICY IF EXISTS "Users can insert own trades" ON public.trades;
DROP POLICY IF EXISTS "Admins have full access to trades" ON public.trades;
DROP POLICY IF EXISTS "Users can view own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Admins have full access to transactions" ON public.transactions;
DROP POLICY IF EXISTS "Admins have full access to admin_logs" ON public.admin_logs;
DROP POLICY IF EXISTS "Admins have full access to settings" ON public.settings;

-- CREATE NEW POLICIES
CREATE POLICY "Users can view own profile" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins have full access to users" ON public.users USING (is_admin());

CREATE POLICY "Users can view own trades" ON public.trades FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own trades" ON public.trades FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins have full access to trades" ON public.trades USING (is_admin());

CREATE POLICY "Users can view own transactions" ON public.transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins have full access to transactions" ON public.transactions USING (is_admin());

CREATE POLICY "Admins have full access to admin_logs" ON public.admin_logs USING (is_admin());
CREATE POLICY "Admins have full access to settings" ON public.settings USING (is_admin());

-- 5. TRIGGERS & FUNCTIONS

-- Handle New User Signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_username TEXT;
  v_referral_code TEXT;
BEGIN
  v_username := COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1));
  v_referral_code := UPPER(SUBSTRING(MD5(RANDOM()::TEXT), 1, 8));

  INSERT INTO public.users (id, username, full_name, email, phone, referral_code, balance, is_admin)
  VALUES (
    NEW.id, 
    v_username, 
    NEW.raw_user_meta_data->>'full_name', 
    NEW.email,
    NEW.raw_user_meta_data->>'phone',
    v_referral_code,
    0,
    (NEW.email = 'physicswala9899@gmail.com') -- Auto-promote this email to admin
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Place Trade Function
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
  SELECT balance INTO v_balance FROM public.users WHERE id = auth.uid() FOR UPDATE;
  IF v_balance < p_amount THEN RAISE EXCEPTION 'Insufficient balance'; END IF;
  UPDATE public.users SET balance = balance - p_amount WHERE id = auth.uid();
  INSERT INTO public.trades (user_id, asset, amount, direction, entry_price, expiry_time)
  VALUES (auth.uid(), p_asset, p_amount, p_direction, p_entry_price, p_expiry_time)
  RETURNING id INTO v_trade_id;
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
  IF NOT is_admin() THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  UPDATE public.users SET balance = balance + p_amount WHERE id = p_user_id;
  INSERT INTO public.transactions (user_id, type, amount, status, reference)
  VALUES (p_user_id, CASE WHEN p_amount > 0 THEN 'DEPOSIT'::transaction_type ELSE 'WITHDRAWAL'::transaction_type END, ABS(p_amount), 'COMPLETED', p_reason);
  INSERT INTO public.admin_logs (admin_id, action, details)
  VALUES (auth.uid(), 'ADJUST_BALANCE', jsonb_build_object('user_id', p_user_id, 'amount', p_amount, 'reason', p_reason));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Admin Settle Trade
CREATE OR REPLACE FUNCTION public.admin_settle_trade(
  p_trade_id UUID,
  p_result trade_result
) RETURNS VOID AS $$
DECLARE
  v_trade RECORD;
  v_payout NUMERIC;
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Unauthorized'; END IF;
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

-- Admin Withdrawal Management
CREATE OR REPLACE FUNCTION public.admin_handle_withdrawal(
  p_transaction_id UUID,
  p_status transaction_status
) RETURNS VOID AS $$
DECLARE
  v_transaction RECORD;
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Unauthorized'; END IF;
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

-- 6. BACKFILL EXISTING USERS (Sync emails and referral codes)
UPDATE public.users u
SET 
  email = a.email,
  referral_code = COALESCE(u.referral_code, UPPER(SUBSTRING(MD5(u.id::TEXT), 1, 8)))
FROM auth.users a
WHERE u.id = a.id AND (u.email IS NULL OR u.referral_code IS NULL);

-- Promote you to admin immediately
UPDATE public.users SET is_admin = TRUE WHERE email = 'physicswala9899@gmail.com';
