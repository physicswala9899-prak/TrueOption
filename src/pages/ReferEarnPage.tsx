import React, { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { supabase, UserProfile } from '../lib/supabase';
import { Copy, Users, Gift, TrendingUp, CheckCircle2, Share2 } from 'lucide-react';

export default function ReferEarnPage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [referrals, setReferrals] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalReferrals: 0,
    totalBonus: 0,
    totalCommission: 0
  });
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return;

    // Get user profile
    const { data: userData } = await supabase
      .from('users')
      .select('*')
      .eq('id', authUser.id)
      .single();
    
    setUser(userData);

    if (userData) {
      // If user doesn't have a referral code, generate one
      if (!userData.referral_code) {
        try {
          const { data: newCode, error } = await supabase.rpc('assign_referral_code');
          if (!error && newCode) {
            userData.referral_code = newCode;
            setUser({ ...userData });
          }
        } catch (err) {
          console.error('Failed to assign referral code:', err);
        }
      }

      // Get referrals
      const { data: refs } = await supabase
        .from('users')
        .select('username, created_at, referral_bonus_received')
        .eq('referred_by', userData.id)
        .order('created_at', { ascending: false });
      
      setReferrals(refs || []);

      // Get total bonus earned
      const { data: bonusEvents } = await supabase
        .from('referral_bonus_events')
        .select('referrer_bonus_amount')
        .eq('referrer_id', userData.id);
      
      const totalBonus = bonusEvents?.reduce((sum, event) => sum + Number(event.referrer_bonus_amount), 0) || 0;

      // Get total commission earned
      const { data: commissions } = await supabase
        .from('referral_commissions')
        .select('commission_amount')
        .eq('referrer_id', userData.id);
      
      const totalCommission = commissions?.reduce((sum, comm) => sum + Number(comm.commission_amount), 0) || 0;

      setStats({
        totalReferrals: refs?.filter(r => r.referral_bonus_received).length || 0,
        totalBonus,
        totalCommission
      });
    }

    setLoading(false);
  };

  const referralLink = user?.referral_code 
    ? `${window.location.origin}/auth?ref=${user.referral_code}`
    : '';

  const handleCopy = async () => {
    if (!referralLink) return;
    
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(referralLink);
      } else {
        // Fallback for older browsers or insecure contexts
        const textArea = document.createElement("textarea");
        textArea.value = referralLink;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
          document.execCommand('copy');
        } catch (err) {
          console.error('Fallback copy failed', err);
        }
        textArea.remove();
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen bg-[#0b0e14] flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-[#0b0e14] p-4 sm:p-6 lg:p-8">
        <div className="max-w-6xl mx-auto space-y-8">
          
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-900/40 to-purple-900/40 rounded-3xl p-8 border border-white/10 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-12 opacity-10 pointer-events-none">
              <Gift size={200} />
            </div>
            
            <div className="relative z-10 max-w-2xl">
              <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4">Refer & Earn</h1>
              <p className="text-gray-300 text-lg mb-8">
                Invite your friends to TrueOption and earn rewards together! 
                Get a <span className="text-emerald-400 font-bold">₹189 bonus</span> when your friend makes their first deposit of ₹500 or more. 
                Plus, earn <span className="text-blue-400 font-bold">5% commission</span> on every trade they make, forever!
              </p>

              <div className="bg-black/40 backdrop-blur-md rounded-2xl p-4 border border-white/10 flex flex-col sm:flex-row items-center gap-4">
                <div className="flex-1 w-full">
                  <label className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1 block">Your Referral Link</label>
                  <div className="text-white font-mono text-sm sm:text-base truncate">
                    {referralLink}
                  </div>
                </div>
                <button 
                  onClick={handleCopy}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-bold transition-all"
                >
                  {copied ? <CheckCircle2 size={18} /> : <Copy size={18} />}
                  {copied ? 'Copied!' : 'Copy Link'}
                </button>
              </div>
            </div>
          </div>

          {/* How it works */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-[#1e222d] rounded-2xl p-6 border border-white/5">
              <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center text-blue-500 mb-4">
                <Share2 size={24} />
              </div>
              <h3 className="text-white font-bold text-lg mb-2">1. Share Link</h3>
              <p className="text-gray-400 text-sm">Share your unique referral link or code with your friends.</p>
            </div>
            <div className="bg-[#1e222d] rounded-2xl p-6 border border-white/5">
              <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center text-emerald-500 mb-4">
                <Gift size={24} />
              </div>
              <h3 className="text-white font-bold text-lg mb-2">2. Get Bonus</h3>
              <p className="text-gray-400 text-sm">When they deposit ₹500+, you get ₹189 and they get ₹89 as a trading bonus.</p>
            </div>
            <div className="bg-[#1e222d] rounded-2xl p-6 border border-white/5">
              <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center text-purple-500 mb-4">
                <TrendingUp size={24} />
              </div>
              <h3 className="text-white font-bold text-lg mb-2">3. Earn Commission</h3>
              <p className="text-gray-400 text-sm">Earn 5% of their trade stakes as withdrawable commission, for life!</p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="bg-[#1e222d] rounded-2xl p-6 border border-white/5 flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center text-blue-500">
                <Users size={24} />
              </div>
              <div>
                <div className="text-sm text-gray-500 font-medium">Qualified Referrals</div>
                <div className="text-2xl font-bold text-white">{stats.totalReferrals}</div>
              </div>
            </div>
            <div className="bg-[#1e222d] rounded-2xl p-6 border border-white/5 flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center text-emerald-500">
                <Gift size={24} />
              </div>
              <div>
                <div className="text-sm text-gray-500 font-medium">Bonus Earned</div>
                <div className="text-2xl font-bold text-emerald-400">₹{stats.totalBonus.toFixed(2)}</div>
              </div>
            </div>
            <div className="bg-[#1e222d] rounded-2xl p-6 border border-white/5 flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-500/20 rounded-full flex items-center justify-center text-purple-500">
                <TrendingUp size={24} />
              </div>
              <div>
                <div className="text-sm text-gray-500 font-medium">Commission Earned</div>
                <div className="text-2xl font-bold text-purple-400">₹{stats.totalCommission.toFixed(2)}</div>
              </div>
            </div>
          </div>

          {/* Referrals List */}
          <div className="bg-[#1e222d] rounded-2xl border border-white/5 overflow-hidden">
            <div className="p-6 border-b border-white/5">
              <h2 className="text-xl font-bold text-white">Your Referrals</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-xs text-gray-500 uppercase tracking-widest bg-black/20">
                    <th className="px-6 py-4 font-bold">User</th>
                    <th className="px-6 py-4 font-bold">Joined Date</th>
                    <th className="px-6 py-4 font-bold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {referrals.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-6 py-12 text-center text-gray-500">
                        You haven't referred anyone yet. Share your link to get started!
                      </td>
                    </tr>
                  ) : (
                    referrals.map((ref, i) => (
                      <tr key={i} className="hover:bg-white/5 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-blue-600/20 flex items-center justify-center text-blue-500 font-bold text-xs">
                              {ref.username?.[0]?.toUpperCase() || 'U'}
                            </div>
                            <span className="text-sm font-bold text-white">{ref.username || 'Anonymous'}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-gray-400">
                            {new Date(ref.created_at).toLocaleDateString()}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {ref.referral_bonus_received ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-500 text-xs font-bold">
                              <CheckCircle2 size={14} />
                              Qualified
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-yellow-500/10 text-yellow-500 text-xs font-bold">
                              <Clock size={14} />
                              Pending Deposit
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
    </Layout>
  );
}
