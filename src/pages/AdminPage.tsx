import React, { useState, useEffect } from 'react';
import { supabase, UserProfile, Trade, Transaction } from '../lib/supabase';
import { Layout } from '../components/Layout';
import { Users, BarChart3, Settings, CheckCircle, XCircle, DollarSign } from 'lucide-react';
import { format } from 'date-fns';

export default function AdminPage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    checkAdmin();
  }, []);

  const checkAdmin = async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (authUser) {
      const { data } = await supabase.from('users').select('is_admin').eq('id', authUser.id).single();
      if (data && (data as any).is_admin) {
        setIsAdmin(true);
        fetchAdminData();
      }
    }
    setLoading(false);
  };

  const fetchAdminData = async () => {
    const { data: usersData } = await supabase.from('users').select('*').order('created_at', { ascending: false });
    const { data: tradesData } = await supabase.from('trades').select('*').order('created_at', { ascending: false }).limit(50);
    const { data: transData } = await supabase.from('transactions').select('*').order('created_at', { ascending: false }).limit(50);
    
    if (usersData) setUsers(usersData);
    if (tradesData) setTrades(tradesData);
    if (transData) setTransactions(transData);
  };

  const handleAdjustBalance = async (userId: string) => {
    const amountStr = prompt('Enter amount to add (use negative for subtraction):');
    if (!amountStr) return;
    const amount = parseFloat(amountStr);
    if (isNaN(amount)) return alert('Invalid amount');

    const reason = prompt('Reason for adjustment:');
    if (!reason) return;

    const { error } = await (supabase.rpc as any)('adjust_user_balance', {
      p_user_id: userId,
      p_amount: amount,
      p_reason: reason
    });

    if (error) alert(error.message);
    else fetchAdminData();
  };

  const handleApproveTransaction = async (txId: string, status: 'COMPLETED' | 'FAILED', userId: string, amount: number, type: string) => {
    const { error } = await (supabase.from('transactions') as any).update({ status }).eq('id', txId);
    if (error) {
      alert(error.message);
      return;
    }

    if (status === 'COMPLETED' && type === 'DEPOSIT') {
      const { error: balanceError } = await (supabase.rpc as any)('adjust_user_balance', {
        p_user_id: userId,
        p_amount: amount,
        p_reason: 'Deposit Approved'
      });
      if (balanceError) alert('Transaction approved but failed to update balance: ' + balanceError.message);
    } else if (status === 'FAILED' && type === 'WITHDRAWAL') {
      // Refund the withdrawal amount
      const { error: balanceError } = await (supabase.rpc as any)('adjust_user_balance', {
        p_user_id: userId,
        p_amount: amount, // Positive amount to refund
        p_reason: 'Withdrawal Rejected (Refund)'
      });
      if (balanceError) alert('Transaction failed but failed to refund balance: ' + balanceError.message);
    }
    
    fetchAdminData();
  };

  if (loading) return <div className="p-8 text-center">Loading Admin...</div>;
  if (!isAdmin) return <div className="p-8 text-center text-rose-500 font-bold">ACCESS DENIED</div>;

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold text-white">Admin Control Center</h2>
          <div className="flex gap-4">
            <div className="bg-blue-600/10 border border-blue-600/20 px-4 py-2 rounded-xl flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-medium text-blue-400">{users.length} Users</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          {/* User Management */}
          <div className="bg-[#141414] rounded-2xl border border-white/5 overflow-hidden">
            <div className="p-4 border-b border-white/5 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-400" />
              <h3 className="font-semibold text-white">User Management</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-black/30 text-xs uppercase text-zinc-500">
                  <tr>
                    <th className="px-6 py-3">User</th>
                    <th className="px-6 py-3">Balance</th>
                    <th className="px-6 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {users.map(u => (
                    <tr key={u.id} className="text-sm hover:bg-white/5">
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-white font-medium">{u.username}</span>
                          <span className="text-xs text-zinc-500">{u.id.slice(0, 8)}...</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-mono text-blue-400 font-bold">${u.balance.toLocaleString()}</td>
                      <td className="px-6 py-4">
                        <button 
                          onClick={() => handleAdjustBalance(u.id)}
                          className="text-xs bg-blue-600/10 text-blue-400 px-3 py-1 rounded hover:bg-blue-600/20 transition-colors"
                        >
                          Adjust Balance
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pending Transactions */}
          <div className="bg-[#141414] rounded-2xl border border-white/5 overflow-hidden">
            <div className="p-4 border-b border-white/5 flex items-center gap-2">
              <Settings className="w-5 h-5 text-amber-400" />
              <h3 className="font-semibold text-white">Pending Requests</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-black/30 text-xs uppercase text-zinc-500">
                  <tr>
                    <th className="px-6 py-3">User</th>
                    <th className="px-6 py-3">Type</th>
                    <th className="px-6 py-3">Amount</th>
                    <th className="px-6 py-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {transactions.filter(t => t.status === 'PENDING').map(t => (
                    <tr key={t.id} className="text-sm">
                      <td className="px-6 py-4 text-zinc-400">{t.user_id.slice(0, 8)}</td>
                      <td className="px-6 py-4 font-medium text-white">{t.type}</td>
                      <td className="px-6 py-4 font-bold text-emerald-400">${t.amount}</td>
                      <td className="px-6 py-4 flex gap-2">
                        <button onClick={() => handleApproveTransaction(t.id, 'COMPLETED', t.user_id, t.amount, t.type)} className="text-emerald-400 hover:bg-emerald-400/10 p-1 rounded transition-colors">
                          <CheckCircle className="w-5 h-5" />
                        </button>
                        <button onClick={() => handleApproveTransaction(t.id, 'FAILED', t.user_id, t.amount, t.type)} className="text-rose-400 hover:bg-rose-400/10 p-1 rounded transition-colors">
                          <XCircle className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Global Trade Monitor */}
        <div className="bg-[#141414] rounded-2xl border border-white/5 overflow-hidden">
          <div className="p-4 border-b border-white/5 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-purple-400" />
            <h3 className="font-semibold text-white">Global Trade Monitor</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-black/30 text-xs uppercase text-zinc-500">
                <tr>
                  <th className="px-6 py-3">User</th>
                  <th className="px-6 py-3">Asset</th>
                  <th className="px-6 py-3">Amount</th>
                  <th className="px-6 py-3">Direction</th>
                  <th className="px-6 py-3">Result</th>
                  <th className="px-6 py-3">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {trades.map(trade => (
                  <tr key={trade.id} className="text-sm hover:bg-white/5">
                    <td className="px-6 py-4 text-zinc-500">{trade.user_id.slice(0, 8)}</td>
                    <td className="px-6 py-4 text-white font-medium">{trade.asset}</td>
                    <td className="px-6 py-4 text-zinc-300">${trade.amount}</td>
                    <td className={`px-6 py-4 font-bold ${trade.direction === 'UP' ? 'text-emerald-400' : 'text-rose-400'}`}>{trade.direction}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${
                        trade.result === 'WIN' ? 'bg-emerald-500/10 text-emerald-400' :
                        trade.result === 'LOSS' ? 'bg-rose-500/10 text-rose-400' :
                        'bg-zinc-500/10 text-zinc-400'
                      }`}>
                        {trade.result}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-zinc-500">{format(new Date(trade.created_at), 'HH:mm:ss')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  );
}
