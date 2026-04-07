import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  Search, 
  Filter, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Calendar,
  User,
  MoreVertical,
  Check,
  X
} from 'lucide-react';
import { format } from 'date-fns';

export default function AdminTransactions() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [isProcessing, setIsProcessing] = useState<string | null>(null);

  // Pagination
  const [page, setPage] = useState(0);
  const pageSize = 15;

  useEffect(() => {
    fetchTransactions();

    const txSubscription = supabase
      .channel('admin-tx-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => {
        fetchTransactions();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(txSubscription);
    };
  }, [page, searchTerm, typeFilter, statusFilter]);

  const fetchTransactions = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      let query = supabase
        .from('transactions')
        .select('*, users(username, email)', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (typeFilter !== 'ALL') {
        query = query.eq('type', typeFilter);
      }

      if (statusFilter !== 'ALL') {
        query = query.eq('status', statusFilter);
      }

      if (searchTerm) {
        query = query.or(`reference.ilike.%${searchTerm}%,id.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      setTransactions(data || []);
    } catch (err: any) {
      console.error('Error fetching transactions:', err);
      setErrorMsg(err.message || 'An error occurred while fetching transactions.');
    } finally {
      setLoading(false);
    }
  };

  const handleWithdrawal = async (id: string, status: 'COMPLETED' | 'FAILED') => {
    const action = status === 'COMPLETED' ? 'approve' : 'reject';
    if (!window.confirm(`Are you sure you want to ${action} this withdrawal?`)) return;
    
    setIsProcessing(id);
    try {
      const { error } = await (supabase.rpc as any)('admin_handle_withdrawal', {
        p_transaction_id: id,
        p_status: status
      });

      if (error) throw error;
      
      alert(`Withdrawal ${action}d successfully`);
      fetchTransactions();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setIsProcessing(null);
    }
  };

  if (errorMsg) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-4 py-12">
        <div className="p-4 bg-rose-500/10 text-rose-500 rounded-xl max-w-lg text-center">
          <h3 className="font-bold mb-2">Error Loading Transactions</h3>
          <p className="text-sm">{errorMsg}</p>
          <p className="text-xs mt-4 text-rose-400">Please make sure you have run the latest SQL scripts in your Supabase SQL Editor.</p>
        </div>
        <button onClick={fetchTransactions} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold text-white tracking-tight">Transactions</h1>
          <p className="text-gray-500 text-sm">Monitor deposits, withdrawals, and trade payouts</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
            <input 
              type="text" 
              placeholder="Search reference..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-[#1e222d] border border-white/5 rounded-xl pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors w-64"
            />
          </div>
          <select 
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-[#1e222d] border border-white/5 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors appearance-none cursor-pointer"
          >
            <option value="ALL">All Types</option>
            <option value="DEPOSIT">Deposit</option>
            <option value="WITHDRAWAL">Withdrawal</option>
            <option value="TRADE_WIN">Trade Win</option>
            <option value="TRADE_LOSS">Trade Loss</option>
          </select>
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-[#1e222d] border border-white/5 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors appearance-none cursor-pointer"
          >
            <option value="ALL">All Status</option>
            <option value="PENDING">Pending</option>
            <option value="COMPLETED">Completed</option>
            <option value="FAILED">Failed</option>
          </select>
        </div>
      </div>

      <div className="bg-[#1e222d] rounded-2xl border border-white/5 shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] text-gray-500 uppercase tracking-widest border-b border-white/5">
                <th className="px-6 py-4 font-bold">Transaction ID</th>
                <th className="px-6 py-4 font-bold">User</th>
                <th className="px-6 py-4 font-bold">Type</th>
                <th className="px-6 py-4 font-bold">Amount</th>
                <th className="px-6 py-4 font-bold">Status</th>
                <th className="px-6 py-4 font-bold">Date</th>
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
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500 text-sm">No transactions found</td>
                </tr>
              ) : transactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4">
                    <span className="text-[10px] font-mono text-gray-500 uppercase">{tx.id.substring(0, 8)}...</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-white">{tx.users?.username || 'User'}</span>
                      <span className="text-[10px] text-gray-500">{tx.users?.email}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className={`p-1.5 rounded-lg ${
                        tx.type === 'DEPOSIT' || tx.type === 'TRADE_WIN' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'
                      }`}>
                        {tx.type === 'DEPOSIT' || tx.type === 'TRADE_WIN' ? <ArrowUpCircle size={14} /> : <ArrowDownCircle size={14} />}
                      </div>
                      <span className="text-xs font-bold text-gray-300">{tx.type}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-sm font-bold ${
                      tx.type === 'DEPOSIT' || tx.type === 'TRADE_WIN' ? 'text-emerald-400' : 'text-rose-400'
                    }`}>
                      {tx.type === 'DEPOSIT' || tx.type === 'TRADE_WIN' ? '+' : '-'}₹{tx.amount}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest ${
                      tx.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-500' :
                      tx.status === 'FAILED' ? 'bg-rose-500/10 text-rose-500' :
                      'bg-amber-500/10 text-amber-500'
                    }`}>
                      {tx.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs text-gray-500">{format(new Date(tx.created_at), 'MMM dd, HH:mm')}</span>
                  </td>
                  <td className="px-6 py-4">
                    {tx.type === 'WITHDRAWAL' && tx.status === 'PENDING' ? (
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => handleWithdrawal(tx.id, 'COMPLETED')}
                          disabled={isProcessing === tx.id}
                          className="p-1.5 bg-emerald-600/20 text-emerald-500 hover:bg-emerald-600/30 rounded-lg transition-colors disabled:opacity-50"
                          title="Approve"
                        >
                          <Check size={16} />
                        </button>
                        <button 
                          onClick={() => handleWithdrawal(tx.id, 'FAILED')}
                          disabled={isProcessing === tx.id}
                          className="p-1.5 bg-rose-600/20 text-rose-500 hover:bg-rose-600/30 rounded-lg transition-colors disabled:opacity-50"
                          title="Reject"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <button className="p-1 text-gray-500 hover:text-white transition-colors">
                        <MoreVertical size={18} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        <div className="px-6 py-4 border-t border-white/5 flex items-center justify-between">
          <span className="text-xs text-gray-500">Showing {transactions.length} transactions</span>
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
              disabled={transactions.length < pageSize}
              className="p-1.5 bg-white/5 rounded-lg text-gray-400 hover:text-white disabled:opacity-30 transition-colors"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
