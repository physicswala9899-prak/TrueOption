import { createClient } from '@supabase/supabase-js';

let supabaseInstance: any = null;

const getSupabase = () => {
  if (supabaseInstance) return supabaseInstance;

  const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL || 'https://ocvelmmtthttkdsdqsoc.supabase.co';
  const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_3Lemcidz035rrbIA6b6N2A_7JsfOSx_';

  if (!supabaseUrl || !supabaseAnonKey) {
    const errorMsg = 'Supabase credentials missing. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in the Secrets panel (Settings > Secrets).';
    console.error(errorMsg);
    // Return a dummy object that throws on access to prevent immediate crash but alert developer
    return new Proxy({}, {
      get: () => { throw new Error(errorMsg); }
    });
  }

  supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
  return supabaseInstance;
};

export const supabase = new Proxy({}, {
  get: (target, prop) => {
    const instance = getSupabase();
    const value = instance[prop];
    return typeof value === 'function' ? value.bind(instance) : value;
  }
}) as ReturnType<typeof createClient>;

export type TradeDirection = 'UP' | 'DOWN';
export type TradeResult = 'WIN' | 'LOSS' | 'PENDING';

export interface UserProfile {
  id: string;
  username: string;
  full_name: string;
  balance: number;
  email?: string;
  is_admin: boolean;
  created_at: string;
}

export interface Trade {
  id: string;
  user_id: string;
  asset: string;
  amount: number;
  direction: TradeDirection;
  entry_price: number;
  expiry_time: string;
  payout_percentage: number;
  result: TradeResult;
  payout: number;
  created_at: string;
  settled_at?: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  type: 'DEPOSIT' | 'WITHDRAWAL' | 'TRADE_LOSS' | 'TRADE_WIN';
  amount: number;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  reference?: string;
  created_at: string;
}
