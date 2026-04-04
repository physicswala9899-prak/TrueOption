import React, { useState, useEffect } from 'react';
import { supabase, UserProfile, Transaction } from '../lib/supabase';
import { Layout } from '../components/Layout';
import { AlertCircle, ChevronDown, ChevronRight, Building2, CreditCard, Zap, Percent } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function WalletPage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawLoading, setWithdrawLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (authUser) {
      const { data: userData } = await supabase.from('users').select('*').eq('id', authUser.id).single();
      setUser(userData);
    }
    setLoading(false);
  };

  const handleWithdraw = async () => {
    if (!user || !withdrawAmount) return;
    const wAmount = parseFloat(withdrawAmount);
    if (wAmount > user.balance) {
      alert('Insufficient balance');
      return;
    }
    
    setWithdrawLoading(true);
    
    const { error: balanceError } = await (supabase.rpc as any)('adjust_user_balance', {
      p_user_id: user.id,
      p_amount: -wAmount,
      p_reason: 'Withdrawal Request'
    });

    if (balanceError) {
      alert(balanceError.message);
      setWithdrawLoading(false);
      return;
    }

    const { error } = await (supabase.from('transactions') as any).insert({
      user_id: user.id,
      type: 'WITHDRAWAL',
      amount: wAmount,
      status: 'PENDING',
      reference: 'SIMULATED_WITHDRAWAL'
    });

    if (!error) {
      alert('Withdrawal request submitted!');
      setWithdrawAmount('');
      fetchData();
    }
    setWithdrawLoading(false);
  };

  const balance = user?.balance || 0;
  const bonusBalance = user?.bonus_balance || 0;
  const formattedBalance = balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formattedBonus = bonusBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const faqs = [
    "How to withdraw money from the account?",
    "How long does it take to withdraw funds?",
    "What is the minimum withdrawal amount?",
    "Is there any fee for depositing or withdrawing funds from the account?",
    "Do I need to provide any documents to make a withdrawal?",
    "What is account verification?",
    "How to understand that I need to go through account verification?",
    "How long does the verification process take?",
    "How do I know that I successfully passed verification?"
  ];

  return (
    <Layout>
      <div className="min-h-screen bg-[#1e222d] text-gray-300 font-sans flex flex-col">
        {/* Top Navigation Bar */}
        <div className="flex flex-wrap items-center justify-between bg-[#232833] px-4 py-0 border-b border-gray-700/50">
          <div className="flex items-center overflow-x-auto scrollbar-hide">
            {['Withdrawal', 'Transactions', 'My Account'].map((tab) => {
              if (tab === 'My Account') {
                return (
                  <Link 
                    key={tab} 
                    to="/settings"
                    className="px-4 py-4 text-sm font-medium text-gray-400 hover:text-gray-200 transition-colors whitespace-nowrap"
                  >
                    {tab}
                  </Link>
                );
              }
              if (tab === 'Transactions') {
                return (
                  <Link 
                    key={tab} 
                    to="/transactions"
                    className="px-4 py-4 text-sm font-medium text-gray-400 hover:text-gray-200 transition-colors whitespace-nowrap"
                  >
                    {tab}
                  </Link>
                );
              }
              return (
                <button 
                  key={tab} 
                  className={`px-4 py-4 text-sm font-medium whitespace-nowrap transition-colors ${
                    tab === 'Withdrawal' 
                      ? 'text-white bg-white/10 rounded-md' 
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {tab}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-8 py-2 hidden md:flex">
            <div className="text-right">
              <div className="text-xs text-gray-500">Available for withdrawal</div>
              <div className="text-sm font-bold text-white">{formattedBalance} ₹</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-500">In the account</div>
              <div className="text-sm font-bold text-white">{formattedBalance} ₹</div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 max-w-[1600px] w-full mx-auto p-6 grid grid-cols-1 md:grid-cols-12 gap-8">
          
          {/* Left Column: Account Info */}
          <div className="md:col-span-3 space-y-8">
            <div>
              <h2 className="text-white font-bold mb-6">Account:</h2>
              <div className="space-y-6">
                <div>
                  <div className="text-sm text-gray-500 mb-1">In the account:</div>
                  <div className="text-2xl font-bold text-white">{formattedBalance} ₹</div>
                </div>
                <div className="h-px bg-gray-700/50 w-full my-4"></div>
                <div>
                  <div className="text-sm text-gray-500 mb-1">Bonus Balance:</div>
                  <div className="text-2xl font-bold text-emerald-400">{formattedBonus} ₹</div>
                  <div className="text-xs text-gray-500 mt-1">Non-withdrawable. Can be used for trading.</div>
                </div>
                <div className="h-px bg-gray-700/50 w-full my-4"></div>
                <div>
                  <div className="text-sm text-gray-500 mb-1">Available for withdrawal:</div>
                  <div className="text-2xl font-bold text-white">{formattedBalance} ₹</div>
                </div>
              </div>
            </div>
            
            <div className="h-px bg-gray-700/50 w-full border-dashed border-t border-gray-600"></div>
            
            <div className="flex items-center justify-between">
              <h2 className="text-white font-bold">Some of your latest requests:</h2>
              <button className="flex items-center gap-1 text-blue-500 hover:text-blue-400 text-sm">
                All financial history
                <div className="bg-blue-500 rounded-full p-0.5">
                  <ChevronRight className="w-3 h-3 text-white" />
                </div>
              </button>
            </div>
          </div>

          {/* Middle Column: Withdrawal Action */}
          <div className="md:col-span-5">
            <h2 className="text-white font-bold mb-6">Withdrawal:</h2>
            
            {balance === 0 ? (
              <div className="bg-[#2a2525] border border-red-900/50 rounded-lg p-6 flex gap-4">
                <div className="mt-1 shrink-0">
                  <div className="w-6 h-6 bg-[#ff4a4a] rounded-full flex items-center justify-center text-white font-bold text-sm">
                    !
                  </div>
                </div>
                <div className="space-y-4">
                  <p className="text-sm text-gray-300 leading-relaxed">
                    You can withdraw money from your balance to your bank card or electronic purse you used for depositing. You can request withdrawal any time. Your withdrawal requests are processed in 3 business days.
                  </p>
                  <button onClick={() => window.dispatchEvent(new Event('openDepositModal'))} className="text-[#00b96b] hover:text-[#00d179] text-sm font-medium transition-colors">
                    Make a deposit
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-[#232833] border border-gray-700/50 rounded-lg p-6">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 bg-[#2a303c] rounded-lg flex items-center justify-center">
                    <CreditCard className="w-6 h-6 text-gray-400" />
                  </div>
                  <div>
                    <h3 className="text-white font-medium">Withdrawal</h3>
                    <p className="text-sm text-gray-400">Withdraw funds to your account</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Amount</label>
                    <div className="relative">
                      <input
                        type="number"
                        value={withdrawAmount}
                        onChange={(e) => setWithdrawAmount(e.target.value)}
                        className="w-full bg-[#1e222d] border border-gray-700/50 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
                        placeholder="0"
                      />
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium">
                        ₹
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Purse</label>
                    <input
                      type="text"
                      className="w-full bg-[#1e222d] border border-gray-700/50 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-2">First name</label>
                      <input
                        type="text"
                        className="w-full bg-[#1e222d] border border-gray-700/50 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-2">Last name</label>
                      <input
                        type="text"
                        className="w-full bg-[#1e222d] border border-gray-700/50 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Phone</label>
                    <input
                      type="text"
                      className="w-full bg-[#1e222d] border border-gray-700/50 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-2">IFSC</label>
                    <input
                      type="text"
                      className="w-full bg-[#1e222d] border border-gray-700/50 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
                    />
                  </div>
                  
                  <button
                    onClick={handleWithdraw}
                    disabled={withdrawLoading || !withdrawAmount || parseFloat(withdrawAmount) <= 0}
                    className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-3 rounded-lg transition-colors mt-2"
                  >
                    {withdrawLoading ? 'Processing...' : 'Confirm'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: FAQ */}
          <div className="md:col-span-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-white font-bold">FAQ:</h2>
              <button className="flex items-center gap-1 text-blue-500 hover:text-blue-400 text-sm">
                Check out full FAQ
                <div className="bg-blue-500 rounded-full p-0.5">
                  <ChevronRight className="w-3 h-3 text-white" />
                </div>
              </button>
            </div>
            
            <div className="space-y-4">
              {faqs.map((faq, index) => (
                <div key={index} className="flex items-start gap-2 cursor-pointer group">
                  <ChevronDown className="w-4 h-4 text-gray-500 mt-0.5 group-hover:text-gray-300 transition-colors" />
                  <span className="text-sm text-gray-300 group-hover:text-white transition-colors">{faq}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-auto border-t border-gray-700/50 bg-[#232833] p-6 md:px-12">
          <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-3">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#00b96b]" />
                <span className="text-sm text-gray-400">Minimum deposit amount: <span className="text-[#00b96b]">₹500</span></span>
              </div>
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-[#00b96b]" />
                <span className="text-sm text-gray-400">Minimum withdrawal amount: <span className="text-[#00b96b]">₹500</span></span>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-[#00b96b]" />
                <span className="text-sm text-gray-400">Quick withdrawal from your account</span>
              </div>
              <div className="flex items-center gap-2">
                <Percent className="w-4 h-4 text-[#00b96b]" />
                <span className="text-sm text-gray-400">First 2 withdrawals in 24 hours are commission-free; then a 3% fee applies</span>
              </div>
            </div>
            
            <div className="flex items-center gap-6 opacity-50 grayscale">
              {/* Placeholder for logos since we don't have the actual images */}
              <div className="text-xl font-bold italic">VISA</div>
              <div className="w-1.5 h-1.5 rounded-full bg-gray-600"></div>
              <div className="text-xl font-bold">SECURE</div>
              <div className="w-1.5 h-1.5 rounded-full bg-gray-600"></div>
              <div className="text-xl font-bold italic">MasterCard</div>
              <div className="w-1.5 h-1.5 rounded-full bg-gray-600"></div>
              <div className="text-xl font-bold">3D Secure</div>
              <div className="w-1.5 h-1.5 rounded-full bg-gray-600"></div>
              <div className="text-xl font-bold">SSL</div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
