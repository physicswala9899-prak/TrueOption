import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Users, Gift, TrendingUp, Search, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';

export default function AdminReferrals() {
  const [referrals, setReferrals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [stats, setStats] = useState({
    totalReferrals: 0,
    qualifiedReferrals: 0,
    totalBonusPaid: 0,
    totalCommissionPaid: 0
  });

  // Pagination
  const [page, setPage] = useState(0);
  const pageSize = 10;

  useEffect(() => {
    fetchData();
  }, [page, searchTerm]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch stats
      const { data: usersData } = await supabase.from('users').select('id, referral_bonus_received, referred_by');
      const { data: bonusData } = await supabase.from('referral_bonus_events').select('referrer_bonus_amount, referee_bonus_amount');
      const { data: commData } = await supabase.from('referral_commissions').select('commission_amount');

      if (usersData && bonusData && commData) {
        const totalRefs = (usersData as any[]).filter(u => u.referred_by !== null).length;
        const qualifiedRefs = (usersData as any[]).filter(u => u.referral_bonus_received).length;
        const totalBonus = (bonusData as any[]).reduce((sum, b) => sum + Number(b.referrer_bonus_amount) + Number(b.referee_bonus_amount), 0);
        const totalComm = (commData as any[]).reduce((sum, c) => sum + Number(c.commission_amount), 0);

        setStats({
          totalReferrals: totalRefs,
          qualifiedReferrals: qualifiedRefs,
          totalBonusPaid: totalBonus,
          totalCommissionPaid: totalComm
        });
      }

      // Fetch referral list (users who referred others)
      // For simplicity, we'll fetch users who have a referral code and count their referrals
      let query = supabase
        .from('users')
        .select('id, username, email, referral_code, created_at')
        .order('created_at', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (searchTerm) {
        query = query.or(`username.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,referral_code.ilike.%${searchTerm}%`);
      }

      const { data: usersList, error } = await query;
      if (error) throw error;

      // Enhance with referral counts
      if (usersList) {
        const enhancedUsers = await Promise.all((usersList as any[]).map(async (u) => {
          const { count: totalCount } = await supabase
            .from('users')
            .select('*', { count: 'exact', head: true })
            .eq('referred_by', u.id);
            
          const { count: qualifiedCount } = await supabase
            .from('users')
            .select('*', { count: 'exact', head: true })
            .eq('referred_by', u.id)
            .eq('referral_bonus_received', true);

          const { data: bonusEvents } = await supabase
            .from('referral_bonus_events')
            .select('referrer_bonus_amount')
            .eq('referrer_id', u.id);
          
          const bonusEarned = (bonusEvents as any[])?.reduce((sum, e) => sum + Number(e.referrer_bonus_amount), 0) || 0;

          const { data: commEvents } = await supabase
            .from('referral_commissions')
            .select('commission_amount')
            .eq('referrer_id', u.id);
            
          const commEarned = (commEvents as any[])?.reduce((sum, e) => sum + Number(e.commission_amount), 0) || 0;

          return {
            ...u,
            totalReferrals: totalCount || 0,
            qualifiedReferrals: qualifiedCount || 0,
            bonusEarned,
            commEarned
          };
        }));
        
        // Filter out users with 0 referrals if not searching
        const filteredUsers = searchTerm ? enhancedUsers : enhancedUsers.filter(u => u.totalReferrals > 0);
        setReferrals(filteredUsers);
      }

    } catch (err) {
      console.error('Error fetching referral data:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold text-white tracking-tight">Referral System</h1>
          <p className="text-gray-500 text-sm">Monitor referral activity, bonuses, and commissions</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
            <input 
              type="text" 
              placeholder="Search users or codes..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-[#1e222d] border border-white/5 rounded-xl pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors w-64"
            />
          </div>
          <button className="p-2 bg-[#1e222d] border border-white/5 rounded-xl text-gray-400 hover:text-white transition-colors">
            <Filter size={20} />
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#1e222d] p-6 rounded-2xl border border-white/5 shadow-lg">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center text-blue-500">
              <Users size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Total Referrals</p>
              <p className="text-2xl font-bold text-white">{stats.totalReferrals}</p>
            </div>
          </div>
        </div>

        <div className="bg-[#1e222d] p-6 rounded-2xl border border-white/5 shadow-lg">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center text-emerald-500">
              <Users size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Qualified Referrals</p>
              <p className="text-2xl font-bold text-white">{stats.qualifiedReferrals}</p>
            </div>
          </div>
        </div>

        <div className="bg-[#1e222d] p-6 rounded-2xl border border-white/5 shadow-lg">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center text-purple-500">
              <Gift size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Total Bonus Paid</p>
              <p className="text-2xl font-bold text-white">₹{stats.totalBonusPaid.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="bg-[#1e222d] p-6 rounded-2xl border border-white/5 shadow-lg">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-500/20 rounded-xl flex items-center justify-center text-amber-500">
              <TrendingUp size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Total Commission Paid</p>
              <p className="text-2xl font-bold text-white">₹{stats.totalCommissionPaid.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Referrers List */}
      <div className="bg-[#1e222d] rounded-2xl border border-white/5 shadow-xl overflow-hidden">
        <div className="p-6 border-b border-white/5 flex justify-between items-center">
          <h2 className="text-lg font-bold text-white">Top Referrers</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] text-gray-500 uppercase tracking-widest border-b border-white/5 bg-black/20">
                <th className="px-6 py-4 font-bold">User</th>
                <th className="px-6 py-4 font-bold">Referral Code</th>
                <th className="px-6 py-4 font-bold">Total Refs</th>
                <th className="px-6 py-4 font-bold">Qualified</th>
                <th className="px-6 py-4 font-bold">Bonus Earned</th>
                <th className="px-6 py-4 font-bold">Commission Earned</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
                  </td>
                </tr>
              ) : referrals.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500 text-sm">No referrers found</td>
                </tr>
              ) : referrals.map((user) => (
                <tr key={user.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-600/20 flex items-center justify-center text-blue-500 font-bold text-xs">
                        {user.username?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || 'U'}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-white">{user.username || 'No Username'}</span>
                        <span className="text-[10px] text-gray-500">{user.email}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-mono text-blue-400">{user.referral_code}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-bold text-white">{user.totalReferrals}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-bold text-emerald-400">{user.qualifiedReferrals}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-bold text-emerald-400">₹{user.bonusEarned.toLocaleString()}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-bold text-purple-400">₹{user.commEarned.toLocaleString()}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        <div className="px-6 py-4 border-t border-white/5 flex items-center justify-between">
          <span className="text-xs text-gray-500">Showing {referrals.length} referrers</span>
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
              disabled={referrals.length < pageSize}
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
