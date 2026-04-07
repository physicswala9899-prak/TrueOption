import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  Users, 
  TrendingUp, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  DollarSign, 
  Activity,
  Clock
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area 
} from 'recharts';
import { format, subDays, startOfDay } from 'date-fns';

const StatCard = ({ title, value, icon: Icon, trend, color }: any) => (
  <div className="bg-[#1e222d] p-6 rounded-2xl border border-white/5 shadow-xl shadow-black/20">
    <div className="flex items-center justify-between mb-4">
      <div className={`p-3 rounded-xl bg-${color}-500/10 text-${color}-500`}>
        <Icon size={24} />
      </div>
      {trend && (
        <span className={`text-xs font-bold px-2 py-1 rounded-full ${trend > 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
          {trend > 0 ? '+' : ''}{trend}%
        </span>
      )}
    </div>
    <div className="flex flex-col">
      <span className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">{title}</span>
      <span className="text-2xl font-bold text-white tracking-tight">{value}</span>
    </div>
  </div>
);

export default function AdminDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const [recentTrades, setRecentTrades] = useState<any[]>([]);
  const [pendingWithdrawals, setPendingWithdrawals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      // 1. Total Users
      const { count: userCount } = await supabase.from('users').select('*', { count: 'exact', head: true });
      
      // 2. Total Deposits
      const { data: deposits } = await supabase.from('transactions').select('amount').eq('type', 'DEPOSIT').eq('status', 'COMPLETED') as any;
      const totalDeposits = deposits?.reduce((acc: number, d: any) => acc + Number(d.amount), 0) || 0;

      // 3. Total Withdrawals
      const { data: withdrawals } = await supabase.from('transactions').select('amount').eq('type', 'WITHDRAWAL').eq('status', 'COMPLETED') as any;
      const totalWithdrawals = withdrawals?.reduce((acc: number, w: any) => acc + Number(w.amount), 0) || 0;

      // 4. Total Trade Volume
      const { data: trades } = await supabase.from('trades').select('amount') as any;
      const totalVolume = trades?.reduce((acc: number, t: any) => acc + Number(t.amount), 0) || 0;

      // 5. Platform Profit/Loss
      // Profit = (Total Loss Trades) - (Total Win Payouts)
      const { data: winTrades } = await supabase.from('trades').select('payout').eq('result', 'WIN') as any;
      const { data: lossTrades } = await supabase.from('trades').select('amount').eq('result', 'LOSS') as any;
      
      const totalLossAmount = lossTrades?.reduce((acc: number, t: any) => acc + Number(t.amount), 0) || 0;
      const totalWinPayout = winTrades?.reduce((acc: number, t: any) => acc + Number(t.payout), 0) || 0;
      const platformProfit = totalLossAmount - totalWinPayout;

      setStats({
        userCount,
        totalDeposits,
        totalWithdrawals,
        totalVolume,
        platformProfit
      });

      // 6. Chart Data (Last 7 Days)
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const date = subDays(new Date(), i);
        return {
          date: format(date, 'MMM dd'),
          fullDate: startOfDay(date),
          deposits: 0,
          users: 0
        };
      }).reverse();

      // Fetch daily deposits
      const { data: dailyDeposits } = await supabase
        .from('transactions')
        .select('amount, created_at')
        .eq('type', 'DEPOSIT')
        .eq('status', 'COMPLETED')
        .gte('created_at', subDays(new Date(), 7).toISOString()) as any;

      dailyDeposits?.forEach((d: any) => {
        const dDate = format(new Date(d.created_at), 'MMM dd');
        const day = last7Days.find(day => day.date === dDate);
        if (day) day.deposits += Number(d.amount);
      });

      setChartData(last7Days);

      // 7. Recent Trades
      const { data: recent } = await supabase
        .from('trades')
        .select('*, users(username, email)')
        .order('created_at', { ascending: false })
        .limit(5);
      setRecentTrades(recent || []);

      // 8. Pending Withdrawals
      const { data: pending } = await supabase
        .from('transactions')
        .select('*, users(username, email)')
        .eq('type', 'WITHDRAWAL')
        .eq('status', 'PENDING')
        .order('created_at', { ascending: false })
        .limit(5);
      setPendingWithdrawals(pending || []);

    } catch (err: any) {
      console.error('Error fetching dashboard data:', err);
      setErrorMsg(err.message || 'An error occurred while fetching data.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-4">
        <div className="p-4 bg-rose-500/10 text-rose-500 rounded-xl max-w-lg text-center">
          <h3 className="font-bold mb-2">Error Loading Dashboard</h3>
          <p className="text-sm">{errorMsg}</p>
          <p className="text-xs mt-4 text-rose-400">Please make sure you have run the final_fix.sql script in your Supabase SQL Editor.</p>
        </div>
        <button onClick={fetchDashboardData} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold text-white tracking-tight">Dashboard</h1>
        <p className="text-gray-500 text-sm">Platform overview and key metrics</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6">
        <StatCard title="Total Users" value={stats?.userCount || 0} icon={Users} color="blue" />
        <StatCard title="Total Deposits" value={`₹${stats?.totalDeposits?.toLocaleString()}`} icon={ArrowUpCircle} color="emerald" />
        <StatCard title="Total Withdrawals" value={`₹${stats?.totalWithdrawals?.toLocaleString()}`} icon={ArrowDownCircle} color="rose" />
        <StatCard title="Trade Volume" value={`₹${stats?.totalVolume?.toLocaleString()}`} icon={Activity} color="amber" />
        <StatCard title="Platform Profit" value={`₹${stats?.platformProfit?.toLocaleString()}`} icon={DollarSign} color={stats?.platformProfit >= 0 ? 'emerald' : 'rose'} />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-[#1e222d] p-6 rounded-2xl border border-white/5 shadow-xl">
          <h3 className="text-lg font-bold text-white mb-6">Deposit Trends (Last 7 Days)</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorDeposits" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                <XAxis dataKey="date" stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `₹${value}`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e222d', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Area type="monotone" dataKey="deposits" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorDeposits)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-[#1e222d] p-6 rounded-2xl border border-white/5 shadow-xl">
          <h3 className="text-lg font-bold text-white mb-6">Activity Overview</h3>
          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 text-blue-500 rounded-lg">
                  <Activity size={20} />
                </div>
                <div>
                  <div className="text-sm font-bold text-white">Active Trades</div>
                  <div className="text-xs text-gray-500">Currently running</div>
                </div>
              </div>
              <span className="text-xl font-bold text-white">{recentTrades.filter(t => t.result === 'PENDING').length}</span>
            </div>
            
            <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-rose-500/10 text-rose-500 rounded-lg">
                  <Clock size={20} />
                </div>
                <div>
                  <div className="text-sm font-bold text-white">Pending Withdrawals</div>
                  <div className="text-xs text-gray-500">Awaiting approval</div>
                </div>
              </div>
              <span className="text-xl font-bold text-white">{pendingWithdrawals.length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity Tables */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* Recent Trades */}
        <div className="bg-[#1e222d] rounded-2xl border border-white/5 shadow-xl overflow-hidden">
          <div className="p-6 border-b border-white/5 flex items-center justify-between">
            <h3 className="text-lg font-bold text-white">Recent Trades</h3>
            <button className="text-xs font-bold text-blue-500 hover:text-blue-400 uppercase tracking-widest">View All</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] text-gray-500 uppercase tracking-widest border-b border-white/5">
                  <th className="px-6 py-4 font-bold">User</th>
                  <th className="px-6 py-4 font-bold">Asset</th>
                  <th className="px-6 py-4 font-bold">Amount</th>
                  <th className="px-6 py-4 font-bold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {recentTrades.map((trade) => (
                  <tr key={trade.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-white">{trade.users?.username || 'User'}</span>
                        <span className="text-[10px] text-gray-500">{trade.users?.email}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-bold text-gray-300">{trade.asset}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-bold text-white">₹{trade.amount}</span>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pending Withdrawals */}
        <div className="bg-[#1e222d] rounded-2xl border border-white/5 shadow-xl overflow-hidden">
          <div className="p-6 border-b border-white/5 flex items-center justify-between">
            <h3 className="text-lg font-bold text-white">Pending Withdrawals</h3>
            <button className="text-xs font-bold text-blue-500 hover:text-blue-400 uppercase tracking-widest">View All</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] text-gray-500 uppercase tracking-widest border-b border-white/5">
                  <th className="px-6 py-4 font-bold">User</th>
                  <th className="px-6 py-4 font-bold">Amount</th>
                  <th className="px-6 py-4 font-bold">Date</th>
                  <th className="px-6 py-4 font-bold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {pendingWithdrawals.map((tx) => (
                  <tr key={tx.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-white">{tx.users?.username || 'User'}</span>
                        <span className="text-[10px] text-gray-500">{tx.users?.email}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-bold text-white">₹{tx.amount}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs text-gray-500">{format(new Date(tx.created_at), 'MMM dd, HH:mm')}</span>
                    </td>
                    <td className="px-6 py-4">
                      <button className="bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold px-3 py-1 rounded-lg uppercase tracking-widest transition-colors">
                        Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
