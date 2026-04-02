import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  Settings, 
  Plus, 
  Trash2, 
  Save, 
  AlertTriangle,
  Clock,
  Percent,
  Power,
  ShieldAlert
} from 'lucide-react';

export default function AdminSettings() {
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [payoutPercentages, setPayoutPercentages] = useState<any>({});
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [enabledExpiries, setEnabledExpiries] = useState(['1m', '5m', '15m']);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('settings').select('*') as any;
      if (error) throw error;
      
      const settingsMap: any = {};
      data?.forEach((s: any) => {
        settingsMap[s.key] = s.value;
      });

      setSettings(settingsMap);
      setPayoutPercentages(settingsMap.payout_percentages || { "BTCUSDT": 70 });
      setMaintenanceMode(settingsMap.maintenance_mode || false);
      setEnabledExpiries(settingsMap.enabled_expiries || ['1m', '5m', '15m']);
    } catch (err) {
      console.error('Error fetching settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      const updates = [
        { key: 'payout_percentages', value: payoutPercentages },
        { key: 'maintenance_mode', value: maintenanceMode },
        { key: 'enabled_expiries', value: enabledExpiries }
      ];

      for (const update of updates) {
        const { error } = await (supabase
          .from('settings') as any)
          .upsert(update);
        if (error) throw error;
      }

      alert('Settings saved successfully');
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold text-white tracking-tight">Platform Settings</h1>
        <p className="text-gray-500 text-sm">Configure global trading parameters and platform behavior</p>
      </div>

      <div className="grid grid-cols-1 gap-8">
        {/* Asset Payouts */}
        <div className="bg-[#1e222d] rounded-2xl border border-white/5 shadow-xl overflow-hidden">
          <div className="p-6 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 text-blue-500 rounded-lg">
                <Percent size={20} />
              </div>
              <h3 className="text-lg font-bold text-white">Asset Payout Percentages</h3>
            </div>
          </div>
          <div className="p-6 space-y-4">
            {Object.entries(payoutPercentages).map(([asset, payout]: [string, any]) => (
              <div key={asset} className="flex items-center gap-4 bg-white/5 p-4 rounded-xl border border-white/5">
                <div className="flex-1">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1 block">Asset Symbol</span>
                  <span className="text-sm font-bold text-white">{asset}</span>
                </div>
                <div className="w-32">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1 block">Payout %</span>
                  <div className="relative">
                    <input 
                      type="number" 
                      value={payout}
                      onChange={(e) => setPayoutPercentages({ ...payoutPercentages, [asset]: Number(e.target.value) })}
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs">%</span>
                  </div>
                </div>
              </div>
            ))}
            <button 
              onClick={() => {
                const symbol = prompt('Enter asset symbol (e.g., ETHUSDT):');
                if (symbol) setPayoutPercentages({ ...payoutPercentages, [symbol.toUpperCase()]: 70 });
              }}
              className="flex items-center gap-2 text-sm font-bold text-blue-500 hover:text-blue-400 transition-colors"
            >
              <Plus size={16} />
              Add New Asset
            </button>
          </div>
        </div>

        {/* Expiry Times */}
        <div className="bg-[#1e222d] rounded-2xl border border-white/5 shadow-xl overflow-hidden">
          <div className="p-6 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/10 text-amber-500 rounded-lg">
                <Clock size={20} />
              </div>
              <h3 className="text-lg font-bold text-white">Enabled Expiry Times</h3>
            </div>
          </div>
          <div className="p-6">
            <div className="flex flex-wrap gap-3">
              {['1m', '2m', '5m', '15m', '30m', '1h'].map((time) => {
                const isEnabled = enabledExpiries.includes(time);
                return (
                  <button
                    key={time}
                    onClick={() => {
                      if (isEnabled) setEnabledExpiries(enabledExpiries.filter(t => t !== time));
                      else setEnabledExpiries([...enabledExpiries, time]);
                    }}
                    className={`px-6 py-3 rounded-xl font-bold text-sm transition-all border ${
                      isEnabled 
                        ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-900/20' 
                        : 'bg-white/5 border-white/5 text-gray-500 hover:bg-white/10'
                    }`}
                  >
                    {time}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Maintenance Mode */}
        <div className="bg-[#1e222d] rounded-2xl border border-white/5 shadow-xl overflow-hidden">
          <div className="p-6 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-rose-500/10 text-rose-500 rounded-lg">
                <ShieldAlert size={20} />
              </div>
              <h3 className="text-lg font-bold text-white">System Status</h3>
            </div>
          </div>
          <div className="p-6">
            <div className="flex items-center justify-between p-4 bg-rose-500/5 rounded-xl border border-rose-500/10">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${maintenanceMode ? 'bg-rose-600' : 'bg-gray-700'}`} onClick={() => setMaintenanceMode(!maintenanceMode)}>
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${maintenanceMode ? 'left-7' : 'left-1'}`} />
                </div>
                <div>
                  <div className="text-sm font-bold text-white">Maintenance Mode</div>
                  <div className="text-xs text-gray-500">Blocks all trading activities when enabled</div>
                </div>
              </div>
              {maintenanceMode && (
                <div className="flex items-center gap-2 text-rose-500 animate-pulse">
                  <AlertTriangle size={16} />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Active</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button 
            onClick={handleSaveSettings}
            disabled={saving}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold px-8 py-4 rounded-xl transition-all shadow-xl shadow-blue-900/20"
          >
            <Save size={20} />
            {saving ? 'Saving...' : 'Save All Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}
