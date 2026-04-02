import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  TrendingUp, 
  History, 
  Settings, 
  FileText, 
  LogOut, 
  Menu, 
  X,
  ShieldAlert,
  ArrowLeft
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const menuItems = [
    { name: 'Dashboard', path: '/admin', icon: LayoutDashboard },
    { name: 'Users', path: '/admin/users', icon: Users },
    { name: 'Trades', path: '/admin/trades', icon: TrendingUp },
    { name: 'Transactions', path: '/admin/transactions', icon: History },
    { name: 'Settings', path: '/admin/settings', icon: Settings },
    { name: 'Reports', path: '/admin/reports', icon: FileText },
    { name: 'Admin Logs', path: '/admin/logs', icon: ShieldAlert },
  ];

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  return (
    <div className="min-h-screen bg-[#0b0e14] text-gray-300 font-sans flex">
      {/* Sidebar */}
      <aside 
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#1e222d] border-r border-white/5 transition-transform duration-300 transform ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:relative lg:translate-x-0`}
      >
        <div className="h-full flex flex-col">
          <div className="p-6 flex items-center justify-between">
            <Link to="/admin" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-900/20">
                <ShieldAlert className="text-white" size={20} />
              </div>
              <span className="text-xl font-bold text-white tracking-tight">Admin Panel</span>
            </Link>
            <button 
              onClick={() => setIsSidebarOpen(false)}
              className="lg:hidden text-gray-400 hover:text-white"
            >
              <X size={20} />
            </button>
          </div>

          <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all group ${
                    isActive 
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' 
                      : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                  }`}
                >
                  <Icon size={20} className={isActive ? 'text-white' : 'text-gray-400 group-hover:text-gray-200'} />
                  <span className="font-medium">{item.name}</span>
                </Link>
              );
            })}
          </nav>

          <div className="p-4 border-t border-white/5 space-y-2">
            <Link 
              to="/trade"
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-400 hover:bg-white/5 hover:text-gray-200 transition-all"
            >
              <ArrowLeft size={20} />
              <span className="font-medium">Back to App</span>
            </Link>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-rose-400 hover:bg-rose-400/10 transition-all"
            >
              <LogOut size={20} />
              <span className="font-medium">Logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-[#1e222d]/80 backdrop-blur-md border-b border-white/5 flex items-center justify-between px-6 lg:px-8 shrink-0 z-40">
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className={`lg:hidden text-gray-400 hover:text-white transition-opacity ${isSidebarOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
          >
            <Menu size={24} />
          </button>
          
          <div className="flex items-center gap-4 ml-auto">
            <div className="flex flex-col items-end">
              <span className="text-xs font-bold text-blue-500 uppercase tracking-widest">Admin</span>
              <span className="text-sm font-medium text-white">TrueOption Control</span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto p-6 lg:p-8 custom-scrollbar">
          {children}
        </div>
      </main>
    </div>
  );
};
