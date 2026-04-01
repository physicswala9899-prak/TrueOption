import React, { useState, useEffect } from 'react';
import { supabase, UserProfile, Trade } from '../lib/supabase';
import { TradingChart } from '../components/TradingChart';
import { OrderForm } from '../components/OrderForm';
import { usePriceFeed } from '../hooks/usePriceFeed';
import { Layout } from '../components/Layout';
import { History, TrendingUp, TrendingDown, AlertCircle, Clock, Wallet, Plus } from 'lucide-react';
import { format } from 'date-fns';

const ASSETS = [
  { id: 'BTCUSDT', name: 'Bitcoin', icon: '₿' },
  { id: 'ETHUSDT', name: 'Ethereum', icon: 'Ξ' },
  { id: 'BNBUSDT', name: 'Binance Coin', icon: 'BNB' },
];

export default function TradePage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [asset, setAsset] = useState('BTCUSDT');
  const [timeframe, setTimeframe] = useState('1m');
  const { price, history } = usePriceFeed(asset, timeframe);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const tradesRef = React.useRef<Trade[]>([]);
  const priceRef = React.useRef<number | null>(null);

  useEffect(() => {
    tradesRef.current = trades;
  }, [trades]);

  useEffect(() => {
    priceRef.current = price;
  }, [price]);

  useEffect(() => {
    fetchUser();
    fetchTrades();

    const tradeSubscription = supabase
      .channel('trades-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trades' }, () => {
        fetchTrades();
        fetchUser();
      })
      .subscribe();

    const settlementInterval = setInterval(() => {
      checkAndSettleTrades();
    }, 1000);

    return () => {
      supabase.removeChannel(tradeSubscription);
      clearInterval(settlementInterval);
    };
  }, []);

  const checkAndSettleTrades = async () => {
    const currentPrice = priceRef.current;
    const currentTrades = tradesRef.current;
    
    if (!currentPrice) return;
    
    const now = new Date();
    const pendingTrades = currentTrades.filter(t => t.result === 'PENDING');
    
    for (const trade of pendingTrades) {
      const expiryDate = new Date(trade.expiry_time);
      if (expiryDate <= now) {
        try {
          await (supabase.rpc as any)('settle_trade', {
            p_trade_id: trade.id,
            p_exit_price: currentPrice
          });
          
          fetchTrades();
          fetchUser();
        } catch (err) {
          console.error('Settlement failed for trade:', trade.id, err);
        }
      }
    }
  };

  const fetchUser = async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (authUser) {
      const { data } = await supabase.from('users').select('*').eq('id', authUser.id).single();
      setUser(data);
    }
    setLoading(false);
  };

  const fetchTrades = async () => {
    const { data } = await supabase
      .from('trades')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);
    if (data) setTrades(data);
  };

  const handlePlaceTrade = async (direction: 'UP' | 'DOWN', amount: number, expiryMinutes: number) => {
    if (!price || !user) return;

    const expiryTime = new Date(Date.now() + expiryMinutes * 60000).toISOString();

    try {
      const { data, error } = await (supabase.rpc as any)('place_trade', {
        p_asset: asset,
        p_amount: amount,
        p_direction: direction,
        p_entry_price: price,
        p_expiry_time: expiryTime
      });

      if (error) throw error;
      
      fetchUser();
      fetchTrades();
    } catch (err: any) {
      setError(err.message);
      setTimeout(() => setError(null), 3000);
    }
  };

  return (
    <Layout>
      <div className="flex flex-col md:flex-row h-[calc(100vh-56px)] sm:h-[calc(100vh-64px)] bg-[#0a0a0a] overflow-hidden">
        {/* Main Content - Full Screen Chart */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#0a0a0a] relative">
          {/* Integrated Header & Asset Tabs */}
          <div className="absolute top-[40px] md:top-0 left-0 right-0 z-20 pointer-events-none">
            <div className="flex items-center justify-between px-2 sm:px-4 py-2 sm:py-3 bg-gradient-to-b from-black/60 to-transparent">
              <div className="flex items-center gap-2 pointer-events-auto overflow-x-auto pb-1 scrollbar-hide w-full sm:w-auto">
                {ASSETS.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => setAsset(a.id)}
                    className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg border transition-all whitespace-nowrap shrink-0 ${
                      asset === a.id
                        ? 'bg-[#1e222d] border-blue-500/50 text-white shadow-lg'
                        : 'bg-black/40 border-white/5 text-gray-400 hover:bg-white/5'
                    }`}
                  >
                    <span className="text-xs sm:text-sm font-bold">{a.icon}</span>
                    <div className="flex flex-col items-start">
                      <span className="text-[9px] sm:text-[10px] font-bold leading-none">{a.id}</span>
                      <span className="text-[8px] sm:text-[9px] text-emerald-400 font-bold">70%</span>
                    </div>
                  </button>
                ))}
                <button className="w-8 h-8 sm:w-9 sm:h-9 shrink-0 flex items-center justify-center rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition-colors shadow-lg shadow-blue-900/20">
                  <Plus size={16} className="sm:w-[18px] sm:h-[18px]" />
                </button>
              </div>

              <div className="hidden sm:flex items-center gap-4 pointer-events-auto">
                <div className="bg-[#1e222d]/80 backdrop-blur-md px-4 py-2 rounded-lg border border-white/10 flex flex-col items-end">
                  <div className="text-[9px] text-gray-500 uppercase font-bold leading-none mb-1">Live Price</div>
                  <div className={`text-sm font-mono font-bold ${price ? 'text-green-400' : 'text-gray-400'}`}>
                    {price ? `$${price.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '...'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 relative">
            <TradingChart 
              data={history} 
              asset={asset} 
              onTimeframeChange={setTimeframe}
            />
          </div>
        </div>

        {/* Trading Panel - Bottom on Mobile, Right Sidebar on Desktop */}
        <div className="w-full md:w-64 lg:w-80 bg-[#111111] border-t md:border-t-0 md:border-l border-white/5 flex flex-col flex-none h-auto md:h-auto overflow-hidden">
          <div className="overflow-y-auto p-3 sm:p-6 flex flex-col gap-4 sm:gap-6">
            {error && (
              <div className="bg-rose-500/10 border border-rose-500/20 p-3 rounded-xl flex items-center gap-3 text-rose-400">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <p className="text-xs font-medium">{error}</p>
              </div>
            )}
            <OrderForm 
              currentPrice={price} 
              balance={user?.balance || 0} 
              onPlaceTrade={handlePlaceTrade} 
              assetName={ASSETS.find(a => a.id === asset)?.name}
            />

            {/* Integrated History - Hidden on small mobile screens to save space */}
            <div className="hidden sm:flex mt-4 flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <History size={16} className="text-blue-500" />
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">Recent Trades</h3>
                </div>
                <span className="text-[10px] bg-white/5 px-2 py-0.5 rounded text-gray-400">{trades.length}</span>
              </div>
              
              <div className="flex flex-col gap-2">
                {trades.length === 0 ? (
                  <div className="bg-white/5 border border-dashed border-white/10 rounded-xl p-8 flex flex-col items-center justify-center text-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center">
                      <Clock size={18} className="text-gray-600" />
                    </div>
                    <p className="text-xs text-gray-500">No trade history yet. Open a trade to see it here.</p>
                  </div>
                ) : (
                  trades.map((trade) => (
                    <div key={trade.id} className="bg-white/5 p-3 rounded-xl border border-white/5 flex items-center justify-between hover:bg-white/10 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${trade.direction === 'UP' ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}`}>
                          {trade.direction === 'UP' ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-white">{trade.asset}</div>
                          <div className="text-[10px] text-gray-500">{format(new Date(trade.created_at), 'HH:mm')}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-bold text-white">${trade.amount}</div>
                        <div className={`text-[10px] font-bold ${trade.result === 'WIN' ? 'text-green-500' : trade.result === 'LOSS' ? 'text-red-500' : 'text-yellow-500'}`}>
                          {trade.result || 'PENDING'}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
