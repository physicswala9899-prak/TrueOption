import React, { useState, useEffect } from 'react';
import { supabase, UserProfile, Trade } from '../lib/supabase';
import { Layout } from '../components/Layout';
import { 
  Search, 
  Calendar as CalendarIcon, 
  ArrowUpRight, 
  ArrowDownRight, 
  Clock, 
  Filter,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  AlertCircle
} from 'lucide-react';
import { format, startOfDay, endOfDay, isWithinInterval, parseISO } from 'date-fns';
import { Link } from 'react-router-dom';

export default function TransactionsPage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'WIN' | 'LOSS' | 'PENDING'>('ALL');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (authUser) {
      const { data: userData } = await supabase.from('users').select('*').eq('id', authUser.id).single();
      setUser(userData);

      const { data: tradesData, error } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', authUser.id)
        .order('created_at', { ascending: false });

      if (tradesData) {
        setTrades(tradesData);
      }
    }
    setLoading(false);
  };

  const filteredTrades = trades.filter(trade => {
    const tradeDate = parseISO(trade.created_at);
    
    // Date filtering
    if (startDate && tradeDate < startOfDay(parseISO(startDate))) return false;
    if (endDate && tradeDate > endOfDay(parseISO(endDate))) return false;

    // Type filtering
    if (filterType !== 'ALL' && trade.result !== filterType) return false;

    return true;
  });

  const totalProfit = trades.reduce((acc, t) => {
    if (t.result === 'WIN') return acc + (t.amount * 0.7);
    if (t.result === 'LOSS') return acc - t.amount;
    return acc;
  }, 0);

  return (
    <Layout>
      <div className="min-h-screen bg-[#1e222d] text-gray-300 font-sans flex flex-col">
        {/* Top Navigation Bar */}
        <div className="flex flex-wrap items-center justify-between bg-[#232833] px-4 py-0 border-b border-gray-700/50">
          <div className="flex items-center overflow-x-auto scrollbar-hide">
            <Link to="/wallet" className="px-4 py-4 text-sm font-medium text-gray-400 hover:text-gray-200 transition-colors whitespace-nowrap">
              Withdrawal
            </Link>
            <button className="px-4 py-4 text-sm font-medium text-white bg-white/10 rounded-md whitespace-nowrap">
              Transactions
            </button>
            <Link to="/settings" className="px-4 py-4 text-sm font-medium text-gray-400 hover:text-gray-200 transition-colors whitespace-nowrap">
              My Account
            </Link>
          </div>
          
          <div className="flex items-center gap-8 py-2 hidden md:flex">
            <div className="text-right">
              <div className="text-xs text-gray-500">Total Trades</div>
              <div className="text-sm font-bold text-white">{trades.length}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-500">Net Result</div>
              <div className={`text-sm font-bold ${totalProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {totalProfit >= 0 ? '+' : ''}₹{totalProfit.toFixed(2)}
              </div>
            </div>
          </div>
        </div>

        {/* Filters Section */}
        <div className="bg-[#1e222d] p-4 sm:p-6 border-b border-gray-700/30">
          <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row gap-4 md:items-end">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 flex-1">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Start Date</label>
                <div className="relative">
                  <input 
                    type="date" 
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-[#232833] border border-gray-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">End Date</label>
                <div className="relative">
                  <input 
                    type="date" 
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-[#232833] border border-gray-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Status</label>
                <select 
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as any)}
                  className="w-full bg-[#232833] border border-gray-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors appearance-none cursor-pointer"
                >
                  <option value="ALL">All Status</option>
                  <option value="WIN">Profit</option>
                  <option value="LOSS">Loss</option>
                  <option value="PENDING">Pending</option>
                </select>
              </div>
              <div className="flex items-end">
                <button 
                  onClick={() => { setStartDate(''); setEndDate(''); setFilterType('ALL'); }}
                  className="w-full bg-gray-700/50 hover:bg-gray-700 text-white text-xs font-bold py-2.5 rounded-lg transition-colors"
                >
                  Reset Filters
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Trades List */}
        <div className="flex-1 max-w-[1600px] w-full mx-auto p-4 sm:p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredTrades.length === 0 ? (
            <div className="bg-[#232833] border border-dashed border-gray-700 rounded-2xl p-12 flex flex-col items-center justify-center text-center gap-4">
              <div className="w-16 h-16 rounded-full bg-gray-700/30 flex items-center justify-center">
                <Clock className="w-8 h-8 text-gray-500" />
              </div>
              <div>
                <h3 className="text-white font-bold text-lg">No trades found</h3>
                <p className="text-gray-500 text-sm max-w-xs mx-auto">Try adjusting your filters or open a new trade to see your history here.</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {/* Desktop Header */}
              <div className="hidden md:grid grid-cols-6 gap-4 px-6 py-3 text-[10px] uppercase font-bold text-gray-500 tracking-widest border-b border-gray-700/30">
                <span>Asset</span>
                <span>Type</span>
                <span>Amount</span>
                <span>Entry Price</span>
                <span>Time</span>
                <span className="text-right">Result</span>
              </div>

              {/* Trade Items */}
              {filteredTrades.map((trade) => (
                <div 
                  key={trade.id} 
                  className="bg-[#232833] border border-gray-700/30 rounded-xl p-4 sm:p-5 flex flex-col md:grid md:grid-cols-6 gap-4 items-center hover:bg-[#2a303c] transition-colors group"
                >
                  {/* Asset & Icon */}
                  <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className={`p-2 rounded-lg ${trade.direction === 'UP' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                      {trade.direction === 'UP' ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white">{trade.asset}</div>
                      <div className="text-[10px] text-gray-500 md:hidden">{format(parseISO(trade.created_at), 'MMM dd, HH:mm')}</div>
                    </div>
                  </div>

                  {/* Type */}
                  <div className="hidden md:flex items-center">
                    <span className={`text-xs font-bold ${trade.direction === 'UP' ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {trade.direction}
                    </span>
                  </div>

                  {/* Amount */}
                  <div className="flex justify-between w-full md:w-auto md:block">
                    <span className="text-xs text-gray-500 md:hidden">Amount:</span>
                    <span className="text-sm font-bold text-white">₹{trade.amount.toLocaleString()}</span>
                  </div>

                  {/* Entry Price */}
                  <div className="flex justify-between w-full md:w-auto md:block">
                    <span className="text-xs text-gray-500 md:hidden">Entry:</span>
                    <span className="text-sm font-mono text-gray-400">${trade.entry_price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>

                  {/* Time */}
                  <div className="hidden md:flex items-center text-xs text-gray-400">
                    {format(parseISO(trade.created_at), 'MMM dd, HH:mm')}
                  </div>

                  {/* Result */}
                  <div className="flex justify-between w-full md:w-auto md:block md:text-right">
                    <span className="text-xs text-gray-500 md:hidden">Result:</span>
                    <div className="flex flex-col items-end">
                      <span className={`text-sm font-bold ${
                        trade.result === 'WIN' ? 'text-emerald-400' : 
                        trade.result === 'LOSS' ? 'text-rose-400' : 
                        'text-amber-400'
                      }`}>
                        {trade.result === 'WIN' ? `+₹${(trade.amount * 0.7).toFixed(2)}` : 
                         trade.result === 'LOSS' ? `-₹${trade.amount.toFixed(2)}` : 
                         'PENDING'}
                      </span>
                      <span className="text-[9px] text-gray-500 uppercase font-bold tracking-tighter">
                        {trade.result === 'WIN' ? 'Profit' : trade.result === 'LOSS' ? 'Loss' : 'Active'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
