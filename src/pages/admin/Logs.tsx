import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  ShieldAlert, 
  Search, 
  Filter, 
  ChevronLeft, 
  ChevronRight,
  Clock,
  User,
  Activity,
  Code
} from 'lucide-react';
import { format } from 'date-fns';

export default function AdminLogs() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');

  // Pagination
  const [page, setPage] = useState(0);
  const pageSize = 20;

  useEffect(() => {
    fetchLogs();
  }, [page, searchTerm, actionFilter]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('admin_logs')
        .select('*, users:admin_id(username, email)', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (actionFilter !== 'ALL') {
        query = query.eq('action', actionFilter);
      }

      if (searchTerm) {
        query = query.or(`action.ilike.%${searchTerm}%,details->>'user_id'.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      setLogs(data || []);
    } catch (err) {
      console.error('Error fetching logs:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold text-white tracking-tight">Admin Audit Logs</h1>
          <p className="text-gray-500 text-sm">Monitor all administrative actions and changes</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
            <input 
              type="text" 
              placeholder="Search action or user ID..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-[#1e222d] border border-white/5 rounded-xl pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors w-64"
            />
          </div>
          <select 
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="bg-[#1e222d] border border-white/5 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors appearance-none cursor-pointer"
          >
            <option value="ALL">All Actions</option>
            <option value="ADJUST_BALANCE">Adjust Balance</option>
            <option value="BLOCK_USER">Block User</option>
            <option value="UNBLOCK_USER">Unblock User</option>
            <option value="SETTLE_TRADE">Settle Trade</option>
            <option value="HANDLE_WITHDRAWAL">Handle Withdrawal</option>
          </select>
        </div>
      </div>

      <div className="bg-[#1e222d] rounded-2xl border border-white/5 shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] text-gray-500 uppercase tracking-widest border-b border-white/5">
                <th className="px-6 py-4 font-bold">Admin</th>
                <th className="px-6 py-4 font-bold">Action</th>
                <th className="px-6 py-4 font-bold">Details</th>
                <th className="px-6 py-4 font-bold">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center">
                    <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-500 text-sm">No logs found</td>
                </tr>
              ) : logs.map((log) => (
                <tr key={log.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-500 font-bold text-xs">
                        {log.users?.username?.[0]?.toUpperCase() || log.users?.email?.[0]?.toUpperCase()}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-white">{log.users?.username || 'Admin'}</span>
                        <span className="text-[10px] text-gray-500">{log.users?.email}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-500">
                        <Activity size={14} />
                      </div>
                      <span className="text-xs font-bold text-gray-300">{log.action}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Code size={14} className="text-gray-600 shrink-0" />
                      <span className="text-[10px] font-mono text-gray-400 truncate max-w-[300px]">
                        {JSON.stringify(log.details)}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-gray-500">
                      <Clock size={14} />
                      <span className="text-xs">{format(new Date(log.created_at), 'MMM dd, HH:mm:ss')}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        <div className="px-6 py-4 border-t border-white/5 flex items-center justify-between">
          <span className="text-xs text-gray-500">Showing {logs.length} logs</span>
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
              disabled={logs.length < pageSize}
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
