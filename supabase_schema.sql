-- DATABASE SCHEMA FOR TRUEOPTION

-- 1. Users Table (Extends Auth.Users)
CREATE TABLE public.users (
  id UUID REFERENCES auth.users NOT NULL PRIMARY KEY,
  username TEXT UNIQUE,
  full_name TEXT,
  balance NUMERIC DEFAULT 0 CHECK (balance >= 0),
  is_admin BOOLEAN DEFAULT FALSE,
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
INSERT INTO public.settings (key, value) VALUES ('payout_percentages', '{"BTC/USDT": 70, "ETH/USDT": 70, "BNB/USDT": 70}');

-- 5. RLS POLICIES

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

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
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
