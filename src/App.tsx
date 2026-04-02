import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import TradePage from './pages/TradePage';
import AuthPage from './pages/AuthPage';
import WalletPage from './pages/WalletPage';
import SettingsPage from './pages/SettingsPage';
import TransactionsPage from './pages/TransactionsPage';

// Admin Pages
import { AdminGuard } from './components/AdminGuard';
import { AdminLayout } from './components/AdminLayout';
import AdminDashboard from './pages/admin/Dashboard';
import AdminUsers from './pages/admin/Users';
import AdminTrades from './pages/admin/Trades';
import AdminTransactions from './pages/admin/Transactions';
import AdminSettings from './pages/admin/Settings';
import AdminReports from './pages/admin/Reports';
import AdminLogs from './pages/admin/Logs';

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session quickly
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Listen for auth changes to redirect immediately
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const hasSupabaseConfig = ((import.meta as any).env.VITE_SUPABASE_URL || 'https://ocvelmmtthttkdsdqsoc.supabase.co') && 
                            ((import.meta as any).env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_3Lemcidz035rrbIA6b6N2A_7JsfOSx_');

  if (!hasSupabaseConfig) {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-[#0a0a0a] border border-white/10 rounded-3xl p-8 text-center space-y-6">
          <div className="w-16 h-16 bg-amber-500/10 rounded-2xl flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold">Supabase Setup Required</h2>
          <p className="text-zinc-400 text-sm">
            To start trading, you need to connect your Supabase project. 
            Please add the following keys to the <strong>Secrets</strong> panel in the <strong>Settings</strong> menu:
          </p>
          <div className="space-y-3 text-left">
            <div className="bg-black/50 p-3 rounded-xl border border-white/5">
              <code className="text-xs text-blue-400">VITE_SUPABASE_URL</code>
            </div>
            <div className="bg-black/50 p-3 rounded-xl border border-white/5">
              <code className="text-xs text-blue-400">VITE_SUPABASE_ANON_KEY</code>
            </div>
          </div>
          <p className="text-xs text-zinc-500 italic">
            You can find these in your Supabase Project Settings under API.
          </p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route path="/auth" element={!session ? <AuthPage /> : <Navigate to="/" />} />
        <Route path="/" element={session ? <TradePage /> : <Navigate to="/auth" />} />
        <Route path="/trade" element={session ? <TradePage /> : <Navigate to="/auth" />} />
        <Route path="/wallet" element={session ? <WalletPage /> : <Navigate to="/auth" />} />
        <Route path="/transactions" element={session ? <TransactionsPage /> : <Navigate to="/auth" />} />
        <Route path="/settings" element={session ? <SettingsPage /> : <Navigate to="/auth" />} />

        {/* Admin Routes */}
        <Route path="/admin" element={
          <AdminGuard>
            <AdminLayout>
              <AdminDashboard />
            </AdminLayout>
          </AdminGuard>
        } />
        <Route path="/admin/users" element={
          <AdminGuard>
            <AdminLayout>
              <AdminUsers />
            </AdminLayout>
          </AdminGuard>
        } />
        <Route path="/admin/trades" element={
          <AdminGuard>
            <AdminLayout>
              <AdminTrades />
            </AdminLayout>
          </AdminGuard>
        } />
        <Route path="/admin/transactions" element={
          <AdminGuard>
            <AdminLayout>
              <AdminTransactions />
            </AdminLayout>
          </AdminGuard>
        } />
        <Route path="/admin/settings" element={
          <AdminGuard>
            <AdminLayout>
              <AdminSettings />
            </AdminLayout>
          </AdminGuard>
        } />
        <Route path="/admin/reports" element={
          <AdminGuard>
            <AdminLayout>
              <AdminReports />
            </AdminLayout>
          </AdminGuard>
        } />
        <Route path="/admin/logs" element={
          <AdminGuard>
            <AdminLayout>
              <AdminLogs />
            </AdminLayout>
          </AdminGuard>
        } />
      </Routes>
    </Router>
  );
}
