import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  Search, 
  Filter, 
  MoreVertical, 
  ShieldCheck, 
  ShieldX, 
  Wallet, 
  History,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Ban,
  Unlock
} from 'lucide-react';
import { format } from 'date-fns';

export default function AdminUsers() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Pagination
  const [page, setPage] = useState(0);
  const pageSize = 10;

  useEffect(() => {
    fetchUsers();
  }, [page, searchTerm]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('users')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (searchTerm) {
        query = query.or(`username.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      setUsers(data || []);
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAdjustBalance = async () => {
    if (!selectedUser || !adjustAmount || !adjustReason) return;
    setIsProcessing(true);
    try {
      const { error } = await (supabase.rpc as any)('adjust_user_balance', {
        p_user_id: selectedUser.id,
        p_amount: Number(adjustAmount),
        p_reason: adjustReason
      });

      if (error) throw error;
      
      alert('Balance adjusted successfully');
      setIsAdjustModalOpen(false);
      setAdjustAmount('');
      setAdjustReason('');
      fetchUsers();
      if (selectedUser) {
        const { data } = await supabase.from('users').select('*').eq('id', selectedUser.id).single();
        setSelectedUser(data);
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToggleBlock = async (user: any) => {
    const action = user.is_blocked ? 'unblock' : 'block';
    if (!window.confirm(`Are you sure you want to ${action} ${user.username || user.email}?`)) return;
    
    setIsProcessing(true);
    try {
      const { error } = await (supabase.rpc as any)('admin_set_user_blocked', {
        p_user_id: user.id,
        p_blocked: !user.is_blocked
      });

      if (error) throw error;
      fetchUsers();
      if (selectedUser?.id === user.id) {
        setSelectedUser({ ...selectedUser, is_blocked: !user.is_blocked });
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold text-white tracking-tight">User Management</h1>
          <p className="text-gray-500 text-sm">Manage platform users and their accounts</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
            <input 
              type="text" 
              placeholder="Search users..." 
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

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        {/* User List */}
        <div className="xl:col-span-8 bg-[#1e222d] rounded-2xl border border-white/5 shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] text-gray-500 uppercase tracking-widest border-b border-white/5">
                  <th className="px-6 py-4 font-bold">User</th>
                  <th className="px-6 py-4 font-bold">Balance</th>
                  <th className="px-6 py-4 font-bold">Status</th>
                  <th className="px-6 py-4 font-bold">Joined</th>
                  <th className="px-6 py-4 font-bold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center">
                      <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500 text-sm">No users found</td>
                  </tr>
                ) : users.map((user) => (
                  <tr 
                    key={user.id} 
                    className={`hover:bg-white/5 transition-colors cursor-pointer ${selectedUser?.id === user.id ? 'bg-blue-600/5' : ''}`}
                    onClick={() => setSelectedUser(user)}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-600/20 flex items-center justify-center text-blue-500 font-bold text-xs">
                          {user.username?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase()}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-white">{user.username || 'No Username'}</span>
                          <span className="text-[10px] text-gray-500">{user.email}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-bold text-white">₹{user.balance?.toLocaleString()}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {user.is_admin && <ShieldCheck size={14} className="text-blue-500" />}
                        {user.is_blocked ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-500 uppercase tracking-widest">Blocked</span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 uppercase tracking-widest">Active</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs text-gray-500">{format(new Date(user.created_at), 'MMM dd, yyyy')}</span>
                    </td>
                    <td className="px-6 py-4">
                      <button className="p-1 text-gray-500 hover:text-white transition-colors">
                        <MoreVertical size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Pagination */}
          <div className="px-6 py-4 border-t border-white/5 flex items-center justify-between">
            <span className="text-xs text-gray-500">Showing {users.length} users</span>
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
                disabled={users.length < pageSize}
                className="p-1.5 bg-white/5 rounded-lg text-gray-400 hover:text-white disabled:opacity-30 transition-colors"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* User Details Sidebar */}
        <div className="xl:col-span-4 space-y-6">
          {selectedUser ? (
            <div className="bg-[#1e222d] rounded-2xl border border-white/5 shadow-xl p-6 space-y-8 sticky top-8">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white">User Details</h3>
                <button 
                  onClick={() => setSelectedUser(null)}
                  className="text-gray-500 hover:text-white"
                >
                  <XCircle size={20} />
                </button>
              </div>

              <div className="flex flex-col items-center gap-4 py-4 border-b border-white/5">
                <div className="w-20 h-20 rounded-full bg-blue-600 flex items-center justify-center text-white text-3xl font-bold shadow-2xl shadow-blue-900/40">
                  {selectedUser.username?.[0]?.toUpperCase() || selectedUser.email?.[0]?.toUpperCase()}
                </div>
                <div className="text-center">
                  <h4 className="text-xl font-bold text-white">{selectedUser.username || 'No Username'}</h4>
                  <p className="text-sm text-gray-500">{selectedUser.email}</p>
                  <p className="text-[10px] text-gray-600 mt-1 font-mono uppercase">{selectedUser.id}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                  <div className="text-[10px] text-gray-500 uppercase font-bold mb-1">Balance</div>
                  <div className="text-lg font-bold text-white">₹{selectedUser.balance?.toLocaleString()}</div>
                </div>
                <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                  <div className="text-[10px] text-gray-500 uppercase font-bold mb-1">Status</div>
                  <div className={`text-sm font-bold ${selectedUser.is_blocked ? 'text-rose-500' : 'text-emerald-500'}`}>
                    {selectedUser.is_blocked ? 'Blocked' : 'Active'}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <button 
                  onClick={() => setIsAdjustModalOpen(true)}
                  className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-blue-900/20"
                >
                  <Wallet size={18} />
                  Adjust Balance
                </button>
                <button 
                  onClick={() => handleToggleBlock(selectedUser)}
                  className={`w-full flex items-center justify-center gap-2 font-bold py-3 rounded-xl transition-all border ${
                    selectedUser.is_blocked 
                      ? 'border-emerald-500/50 text-emerald-500 hover:bg-emerald-500/10' 
                      : 'border-rose-500/50 text-rose-500 hover:bg-rose-500/10'
                  }`}
                >
                  {selectedUser.is_blocked ? <Unlock size={18} /> : <Ban size={18} />}
                  {selectedUser.is_blocked ? 'Unblock User' : 'Block User'}
                </button>
              </div>

              <div className="pt-6 border-t border-white/5">
                <h5 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Quick Stats</h5>
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Total Trades</span>
                    <span className="text-white font-bold">--</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Win Rate</span>
                    <span className="text-white font-bold">--</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Total Profit</span>
                    <span className="text-white font-bold">--</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-[#1e222d] rounded-2xl border border-white/5 border-dashed p-12 text-center space-y-4">
              <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto text-gray-600">
                <AlertCircle size={32} />
              </div>
              <div className="space-y-1">
                <h3 className="text-white font-bold">No User Selected</h3>
                <p className="text-sm text-gray-500">Select a user from the list to view details and manage their account.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Adjust Balance Modal */}
      {isAdjustModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#1e222d] w-full max-w-md rounded-2xl border border-white/10 shadow-2xl p-8 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-white">Adjust Balance</h3>
              <button onClick={() => setIsAdjustModalOpen(false)} className="text-gray-500 hover:text-white">
                <XCircle size={24} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Amount (Negative to deduct)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold">₹</span>
                  <input 
                    type="number" 
                    value={adjustAmount}
                    onChange={(e) => setAdjustAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-black/40 border border-white/10 rounded-xl pl-8 pr-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Reason</label>
                <textarea 
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="e.g., Manual deposit bonus"
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors h-24 resize-none"
                />
              </div>
            </div>

            <div className="flex gap-4">
              <button 
                onClick={() => setIsAdjustModalOpen(false)}
                className="flex-1 bg-white/5 hover:bg-white/10 text-white font-bold py-3 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleAdjustBalance}
                disabled={isProcessing || !adjustAmount || !adjustReason}
                className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-blue-900/20"
              >
                {isProcessing ? 'Processing...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
