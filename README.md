# TrueOption - Binary Options Trading Platform

A high-performance trading platform built with Next.js (simulated via Vite/Express), Supabase, and Lightweight Charts.

## Features
- **Real-time Trading**: Instant execution with atomic balance deduction.
- **Live Charts**: High-performance charts using `lightweight-charts`.
- **Wallet Management**: Deposit/Withdrawal simulation with transaction history.
- **Admin Panel**: User management, balance adjustments, and trade monitoring.
- **Security**: Row Level Security (RLS) and atomic database functions.

## Setup Instructions

### 1. Supabase Setup
1. Create a new project at [supabase.com](https://supabase.com).
2. Go to the **SQL Editor** and run the contents of `supabase_schema.sql`.
3. Go to **Project Settings > API** and copy your `URL` and `anon public` key.

### 2. Environment Variables
Create a `.env` file in the root directory:
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Installation
```bash
npm install
```

### 4. Development
```bash
npm run dev
```

### 5. Trade Settlement
The settlement logic is included in the SQL schema as a function `settle_trades`. To automate this:
- **Option A (Supabase Edge Functions)**: Create an Edge Function that polls the price and calls `rpc('settle_trades')`.
- **Option B (pg_cron)**: If enabled in your Supabase project, schedule the function:
  ```sql
  SELECT cron.schedule('settle-every-minute', '* * * * *', 'SELECT settle_trades(''BTCUSDT'', 50000)'); -- You'll need a real price source here
  ```

## Tech Stack
- **Frontend**: React 19, Vite, Tailwind CSS, Lucide Icons.
- **Backend**: Express (Node.js), Supabase (PostgreSQL, Auth, Realtime).
- **Charts**: Lightweight Charts by TradingView.
- **Animations**: Motion (formerly Framer Motion).
