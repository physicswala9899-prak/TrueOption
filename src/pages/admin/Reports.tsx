import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  FileText, 
  Download, 
  Calendar, 
  TrendingUp, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  Activity,
  DollarSign,
  AlertCircle
} from 'lucide-react';
import { format, startOfDay, endOfDay } from 'date-fns';

export default function AdminReports() {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);

  const fetchDailyReport = async () => {
    setLoading(true);
    try {
      const start = startOfDay(new Date(selectedDate)).toISOString();
      const end = endOfDay(new Date(selectedDate)).toISOString();

      // 1. Deposits
      const { data: deposits } = await supabase
        .from('transactions')
        .select('amount')
        .eq('type', 'DEPOSIT')
        .eq('status', 'COMPLETED')
        .gte('created_at', start)
        .lte('created_at', end) as any;
      const totalDeposits = deposits?.reduce((acc: number, d: any) => acc + Number(d.amount), 0) || 0;

      // 2. Withdrawals
      const { data: withdrawals } = await supabase
        .from('transactions')
        .select('amount')
        .eq('type', 'WITHDRAWAL')
        .eq('status', 'COMPLETED')
        .gte('created_at', start)
        .lte('created_at', end) as any;
      const totalWithdrawals = withdrawals?.reduce((acc: number, w: any) => acc + Number(w.amount), 0) || 0;

      // 3. Trade Volume
      const { data: trades } = await supabase
        .from('trades')
        .select('amount, result, payout')
        .gte('created_at', start)
        .lte('created_at', end) as any;
      const totalVolume = trades?.reduce((acc: number, t: any) => acc + Number(t.amount), 0) || 0;

      // 4. Platform Profit
      const winPayouts = trades?.filter((t: any) => t.result === 'WIN').reduce((acc: number, t: any) => acc + Number(t.payout), 0) || 0;
      const lossAmounts = trades?.filter((t: any) => t.result === 'LOSS').reduce((acc: number, t: any) => acc + Number(t.amount), 0) || 0;
      const platformProfit = lossAmounts - winPayouts;

      setReportData({
        totalDeposits,
        totalWithdrawals,
        totalVolume,
        platformProfit,
        tradeCount: trades?.length || 0
      });
    } catch (err) {
      console.error('Error fetching report:', err);
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = async (table: string) => {
    setExporting(table);
    try {
      const { data, error } = await supabase.from(table).select('*');
      if (error) throw error;

      if (!data || data.length === 0) {
        alert('No data to export');
        return;
      }

      const headers = Object.keys(data[0]);
      const csvContent = [
        headers.join(','),
        ...data.map(row => headers.map(h => JSON.stringify(row[h])).join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `${table}_export_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      alert(`Export failed: ${err.message}`);
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold text-white tracking-tight">Reports & Exports</h1>
          <p className="text-gray-500 text-sm">Generate daily summaries and export platform data</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Daily Summary Generator */}
        <div className="lg:col-span-7 bg-[#1e222d] rounded-2xl border border-white/5 shadow-xl overflow-hidden">
          <div className="p-6 border-b border-white/5 flex items-center justify-between bg-blue-600/5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 text-blue-500 rounded-lg">
                <Calendar size={20} />
              </div>
              <h3 className="text-lg font-bold text-white">Daily Summary Report</h3>
            </div>
          </div>
          <div className="p-8 space-y-8">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <label className="block text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-2">Select Date</label>
                <input 
                  type="date" 
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors [color-scheme:dark]"
                />
              </div>
              <button 
                onClick={fetchDailyReport}
                disabled={loading}
                className="mt-6 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold px-8 py-3 rounded-xl transition-all shadow-lg shadow-blue-900/20"
              >
                {loading ? 'Generating...' : 'Generate Report'}
              </button>
            </div>

            {reportData && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="bg-white/5 p-6 rounded-2xl border border-white/5">
                  <div className="flex items-center gap-3 mb-4">
                    <ArrowUpCircle className="text-emerald-500" size={20} />
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Total Deposits</span>
                  </div>
                  <div className="text-2xl font-bold text-white">₹{reportData.totalDeposits.toLocaleString()}</div>
                </div>
                <div className="bg-white/5 p-6 rounded-2xl border border-white/5">
                  <div className="flex items-center gap-3 mb-4">
                    <ArrowDownCircle className="text-rose-500" size={20} />
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Total Withdrawals</span>
                  </div>
                  <div className="text-2xl font-bold text-white">₹{reportData.totalWithdrawals.toLocaleString()}</div>
                </div>
                <div className="bg-white/5 p-6 rounded-2xl border border-white/5">
                  <div className="flex items-center gap-3 mb-4">
                    <Activity className="text-amber-500" size={20} />
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Trade Volume</span>
                  </div>
                  <div className="text-2xl font-bold text-white">₹{reportData.totalVolume.toLocaleString()}</div>
                  <div className="text-[10px] text-gray-500 mt-1 font-bold uppercase">{reportData.tradeCount} trades executed</div>
                </div>
                <div className="bg-white/5 p-6 rounded-2xl border border-white/5">
                  <div className="flex items-center gap-3 mb-4">
                    <DollarSign className={reportData.platformProfit >= 0 ? 'text-emerald-500' : 'text-rose-500'} size={20} />
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Platform Profit</span>
                  </div>
                  <div className={`text-2xl font-bold ${reportData.platformProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    ₹{reportData.platformProfit.toLocaleString()}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Export Section */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-[#1e222d] rounded-2xl border border-white/5 shadow-xl overflow-hidden">
            <div className="p-6 border-b border-white/5 flex items-center justify-between bg-amber-600/5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-500/10 text-amber-500 rounded-lg">
                  <Download size={20} />
                </div>
                <h3 className="text-lg font-bold text-white">Data Export (CSV)</h3>
              </div>
            </div>
            <div className="p-6 space-y-3">
              {[
                { name: 'Users', table: 'users' },
                { name: 'Trades', table: 'trades' },
                { name: 'Transactions', table: 'transactions' },
                { name: 'Admin Logs', table: 'admin_logs' }
              ].map((item) => (
                <button
                  key={item.table}
                  onClick={() => exportToCSV(item.table)}
                  disabled={exporting !== null}
                  className="w-full flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="text-gray-500 group-hover:text-blue-500 transition-colors" size={20} />
                    <span className="text-sm font-bold text-white">Export {item.name}</span>
                  </div>
                  {exporting === item.table ? (
                    <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Download className="text-gray-600 group-hover:text-white transition-colors" size={16} />
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-blue-600/10 border border-blue-500/20 rounded-2xl p-6 space-y-3">
            <div className="flex items-center gap-2 text-blue-500">
              <AlertCircle size={20} />
              <h4 className="font-bold text-sm">Export Information</h4>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed">
              CSV exports include all records from the selected table. For large datasets, the export may take a few seconds to process. The exported files are compatible with Excel and Google Sheets.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
