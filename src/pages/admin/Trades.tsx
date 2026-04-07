import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  Search, 
  Filter, 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Calendar,
  User,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { format } from 'date-fns';

export default function AdminTrades() {
  const [trades, setTrades] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedTrade, setSelectedTrade] = useState<any>(null);
  const [isSettleModalOpen, setIsSettleModalOpen] = useState(false);
  const [settleResult, setSettleResult] = useState<'WIN' | 'LOSS'>('WIN');
  const [isProcessing, setIsProcessing] = useState(false);

  // Pagination
  const [page, setPage] = useState(0);
  const pageSize = 15;

  useEffect(() => {
    fetchTrades();
  }, [page, searchTerm, statusFilter]);

  const fetchTrades = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      let query = supabase
        .from('trades')
        .select('*, users(username, email)', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (statusFilter !== 'ALL') {
        query = query.eq('result', statusFilter);
      }

      if (searchTerm) {
        // Search by user email or username (requires join logic or separate query)
        // For simplicity, we'll search by asset or ID
        query = query.or(`asset.ilike.%${searchTerm}%,id.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      setTrades(data || []);
    } catch (err: any) {
      console.error('Error fetching trades:', err);
      setErrorMsg(err.message || 'An error occurred while fetching trades.');
    } finally {
      setLoading(false);
    }
  };

  const handleSettleTrade = async () => {
    if (!selectedTrade || !settleResult) return;
    setIsProcessing(true);
    try {
      const { error } = await (supabase.rpc as any)('admin_settle_trade', {
        p_trade_id: selectedTrade.id,
        p_result: settleResult
      });

      if (error) throw error;
      
      alert(`Trade settled as ${settleResult} successfully`);
      setIsSettleModalOpen(false);
      fetchTrades();
      setSelectedTrade(null);
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  if (errorMsg) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-4 py-12">
        <div className="p-4 bg-rose-500/10 text-rose-500 rounded-xl max-w-lg text-center">
          <h3 className="font-bold mb-2">Error Loading Trades</h3>
          <p className="text-sm">{errorMsg}</p>
          <p className="text-xs mt-4 text-rose-400">Please make sure you have run the final_fix.sql script in your Supabase SQL Editor.</p>
        </div>
        <button onClick={fetchTrades} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold text-white tracking-tight">Trade Management</h1>
          <p className="text-gray-500 text-sm">Monitor and manually settle platform trades</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
            <input 
              type="text" 
              placeholder="Search asset or ID..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-[#1e222d] border border-white/5 rounded-xl pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors w-64"
            />
          </div>
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-[#1e222d] border border-white/5 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors appearance-none cursor-pointer"
          >
            <option value="ALL">All Results</option>
            <option value="PENDING">Pending</option>
            <option value="WIN">Win</option>
            <option value="LOSS">Loss</option>
          </select>
        </div>
      </div>

      <div className="bg-[#1e222d] rounded-2xl border border-white/5 shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] text-gray-500 uppercase tracking-widest border-b border-white/5">
                <th className="px-6 py-4 font-bold">Trade ID</th>
                <th className="px-6 py-4 font-bold">User</th>
                <th className="px-6 py-4 font-bold">Asset</th>
                <th className="px-6 py-4 font-bold">Details</th>
                <th className="px-6 py-4 font-bold">Result</th>
                <th className="px-6 py-4 font-bold">Time</th>
                <th className="px-6 py-4 font-bold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
                  </td>
                </tr>
              ) : trades.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500 text-sm">No trades found</td>
                </tr>
              ) : trades.map((trade) => (
                <tr key={trade.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4">
                    <span className="text-[10px] font-mono text-gray-500 uppercase">{trade.id.substring(0, 8)}...</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-white">{trade.users?.username || 'User'}</span>
                      <span className="text-[10px] text-gray-500">{trade.users?.email}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className={`p-1.5 rounded-lg ${trade.direction === 'UP' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                        {trade.direction === 'UP' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                      </div>
                      <span className="text-xs font-bold text-gray-300">{trade.asset}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-white">₹{trade.amount}</span>
                      <span className="text-[10px] text-gray-500">Price: {trade.entry_price}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest ${
                      trade.result === 'WIN' ? 'bg-emerald-500/10 text-emerald-500' :
                      trade.result === 'LOSS' ? 'bg-rose-500/10 text-rose-500' :
                      'bg-amber-500/10 text-amber-500'
                    }`}>
                      {trade.result}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-xs text-gray-300">{format(new Date(trade.created_at), 'MMM dd, HH:mm')}</span>
                      <span className="text-[10px] text-gray-500">Expiry: {format(new Date(trade.expiry_time), 'HH:mm:ss')}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {trade.result === 'PENDING' ? (
                      <button 
                        onClick={() => {
                          setSelectedTrade(trade);
                          setIsSettleModalOpen(true);
                        }}
                        className="bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg uppercase tracking-widest transition-colors"
                      >
                        Settle
                      </button>
                    ) : (
                      <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">Settled</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        <div className="px-6 py-4 border-t border-white/5 flex items-center justify-between">
          <span className="text-xs text-gray-500">Showing {trades.length} trades</span>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-1.5 bg-white/5 rounded-lg text-gray-400 hover:text-white disabled:opacity-30 transition-colors"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="text-xs font-bold text-white px-2">Page {page + 1}</span>
            <button 
              onClick={() => setPage(p => p + 1)}
              disabled={trades.length < pageSize}
              className="p-1.5 bg-white/5 rounded-lg text-gray-400 hover:text-white disabled:opacity-30 transition-colors"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Settle Trade Modal */}
      {isSettleModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#1e222d] w-full max-w-md rounded-2xl border border-white/10 shadow-2xl p-8 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-white">Manual Settlement</h3>
              <button onClick={() => setIsSettleModalOpen(false)} className="text-gray-500 hover:text-white">
                <XCircle size={24} />
              </button>
            </div>

            <div className="bg-white/5 p-4 rounded-xl border border-white/5 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Trade ID</span>
                <span className="text-white font-mono">{selectedTrade?.id.substring(0, 12)}...</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">User</span>
                <span className="text-white font-bold">{selectedTrade?.users?.username || selectedTrade?.users?.email}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Amount</span>
                <span className="text-white font-bold">₹{selectedTrade?.amount}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Direction</span>
                <span className={`font-bold ${selectedTrade?.direction === 'UP' ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {selectedTrade?.direction}
                </span>
              </div>
            </div>

            <div className="space-y-4">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Select Result</label>
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => setSettleResult('WIN')}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${
                    settleResult === 'WIN' 
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-500' 
                      : 'bg-white/5 border-white/5 text-gray-400 hover:bg-white/10'
                  }`}
                >
                  <TrendingUp size={24} />
                  <span className="font-bold">WIN</span>
                </button>
                <button 
                  onClick={() => setSettleResult('LOSS')}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${
                    settleResult === 'LOSS' 
                      ? 'bg-rose-500/20 border-rose-500 text-rose-500' 
                      : 'bg-white/5 border-white/5 text-gray-400 hover:bg-white/10'
                  }`}
                >
                  <TrendingDown size={24} />
                  <span className="font-bold">LOSS</span>
                </button>
              </div>
            </div>

            <div className="flex gap-4">
              <button 
                onClick={() => setIsSettleModalOpen(false)}
                className="flex-1 bg-white/5 hover:bg-white/10 text-white font-bold py-3 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleSettleTrade}
                disabled={isProcessing}
                className={`flex-1 text-white font-bold py-3 rounded-xl transition-all shadow-lg ${
                  settleResult === 'WIN' ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/20' : 'bg-rose-600 hover:bg-rose-500 shadow-rose-900/20'
                }`}
              >
                {isProcessing ? 'Processing...' : 'Confirm Settle'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
