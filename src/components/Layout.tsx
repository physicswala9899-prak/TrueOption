import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  TrendingUp, 
  Wallet, 
  Settings, 
  LogOut, 
  User,
  Menu,
  X,
  ShieldCheck,
  Send,
  ChevronDown,
  Plus,
  Maximize,
  ArrowLeft,
  Volume2,
  VolumeX,
  HelpCircle,
  Trophy,
  MoreHorizontal,
  History
} from 'lucide-react';
import { Logo } from './Logo';
import { supabase, UserProfile } from '../lib/supabase';

import { DepositModal } from './DepositModal';
import { AccountDropdown } from './AccountDropdown';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authUser, setAuthUser] = useState<any>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 768);
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [isAccountDropdownOpen, setIsAccountDropdownOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let authSubscription: any;
    let profileSubscription: any;

    const setupAuth = async () => {
      try {
        const { data: { user: currentAuthUser }, error } = await supabase.auth.getUser();
        
        if (error) {
          console.error("Layout auth error:", error.message);
          if (error.message.includes('Refresh Token')) {
            await supabase.auth.signOut().catch(console.error);
          }
        }

        if (currentAuthUser) {
          setAuthUser(currentAuthUser);
          fetchUser(currentAuthUser);
          
          // Subscribe to profile changes
          profileSubscription = supabase
            .channel('profile-changes')
            .on(
              'postgres_changes',
              {
                event: '*',
                schema: 'public',
                table: 'users',
                filter: `id=eq.${currentAuthUser.id}`
              },
              (payload) => {
                setUser({ ...(payload.new as UserProfile), email: currentAuthUser.email });
              }
            )
            .subscribe();
        }
      } catch (err) {
        console.error("Unexpected error in setupAuth:", err);
      }

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user) {
          setAuthUser(session.user);
          fetchUser(session.user);
        } else {
          setAuthUser(null);
          setUser(null);
        }
      });
      authSubscription = subscription;
    };

    setupAuth();
    
    const handleOpenDeposit = () => setIsDepositModalOpen(true);
    window.addEventListener('openDepositModal', handleOpenDeposit);
    
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsAccountDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    
    return () => {
      window.removeEventListener('openDepositModal', handleOpenDeposit);
      document.removeEventListener('mousedown', handleClickOutside);
      if (authSubscription) authSubscription.unsubscribe();
      if (profileSubscription) supabase.removeChannel(profileSubscription);
    };
  }, []);

  const fetchUser = async (authUser: any) => {
    const { data } = await supabase.from('users').select('*').eq('id', authUser.id).single();
    if (data) {
      setUser({ ...(data as UserProfile), email: authUser.email });
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  const handleBack = () => {
    navigate(-1);
  };

  const handleSettings = () => {
    navigate('/settings');
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  const navItems = [
    { icon: TrendingUp, label: 'Trade', path: '/trade' },
    { icon: Wallet, label: 'Wallet', path: '/wallet' },
    { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
    { icon: Trophy, label: 'Refer & Earn', path: '/refer' },
    ...(user?.is_admin ? [{ icon: ShieldCheck, label: 'Admin', path: '/admin' }] : []),
    { icon: Settings, label: 'Settings', path: '/settings' },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex">
      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar - Hidden on mobile */}
      <aside 
        className={`fixed md:static inset-y-0 left-0 z-50 bg-[#111111] border-r border-white/5 flex-col transition-all duration-300 hidden md:flex ${
          isSidebarOpen ? 'translate-x-0 w-64' : '-translate-x-full md:translate-x-0 md:w-16'
        }`}
      >
        <div className="h-16 flex items-center justify-center border-b border-white/5">
          <Logo className="w-8 h-8 shrink-0" />
          {isSidebarOpen && (
            <span className="ml-3 text-xl font-bold tracking-tighter">True<span className="text-blue-500">Option</span></span>
          )}
        </div>

        <nav className="flex-1 py-6 px-2 space-y-2">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center justify-center ${isSidebarOpen ? 'px-4 py-3' : 'p-3'} rounded-xl transition-all group ${
                location.pathname === item.path
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                  : 'text-gray-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <item.icon className={`w-6 h-6 shrink-0 ${location.pathname === item.path ? 'text-white' : 'group-hover:text-blue-400'}`} />
              {isSidebarOpen && <span className="ml-4 font-medium flex-1">{item.label}</span>}
            </Link>
          ))}
        </nav>

        <div className={`border-t border-white/5 flex flex-col gap-4 ${isSidebarOpen ? 'p-4' : 'p-2'}`}>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={toggleFullscreen} className="flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors py-2" title="Fullscreen">
              <Maximize className="w-5 h-5" />
            </button>
            <button onClick={handleBack} className="flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors py-2" title="Back">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <button onClick={handleSettings} className="flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors py-2" title="Settings">
              <Settings className="w-5 h-5" />
            </button>
            <button onClick={toggleMute} className="flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors py-2" title={isMuted ? "Unmute" : "Mute"}>
              {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>
          </div>

          <button
            onClick={handleLogout}
            className={`w-full flex items-center rounded-xl text-gray-400 hover:bg-red-500/10 hover:text-red-500 transition-all group ${isSidebarOpen ? 'p-3' : 'p-2 justify-center'}`}
          >
            <LogOut className="w-6 h-6 shrink-0" />
            {isSidebarOpen && <span className="ml-4 font-medium">Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-14 sm:h-16 bg-[#111111] border-b border-white/5 flex items-center justify-between px-3 sm:px-4">
          <div className="flex items-center gap-2 sm:gap-4">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 hover:bg-white/5 rounded-lg text-gray-400 transition-colors hidden md:block"
            >
              {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            
            {/* Mobile "LIVE" Badge */}
            <div className="flex md:hidden items-center gap-1.5 bg-[#232833] px-2 py-1 rounded text-[10px] font-bold text-[#00b96b]">
              <Send className="w-3 h-3 transform -rotate-45" fill="currentColor" />
              LIVE
            </div>

            <div className="h-8 w-px bg-white/5 hidden sm:block" />
            <div className="hidden md:flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-widest">
              Web Trading Platform
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            {/* Mobile Balance */}
            <div className="flex md:hidden flex-col items-end mr-1">
              <div className="text-[11px] font-bold text-white leading-none">₹{user?.balance?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}</div>
              <ChevronDown className="w-3 h-3 text-gray-500" />
            </div>

            {/* Account Dropdown Trigger - Desktop Only */}
            <div className="relative hidden md:block" ref={dropdownRef}>
              <button 
                onClick={() => setIsAccountDropdownOpen(!isAccountDropdownOpen)}
                className="flex items-center gap-3 bg-black px-3 py-1.5 rounded-md hover:bg-[#111] transition-colors"
              >
                <Send className="w-5 h-5 text-[#00b96b] transform -rotate-45" fill="currentColor" />
                <div className="flex flex-col items-start">
                  <div className="text-[10px] text-[#00b96b] font-bold leading-none mb-0.5">LIVE ACCOUNT</div>
                  <div className="text-sm font-bold text-white leading-none">₹{user?.balance?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}</div>
                </div>
                <ChevronDown className={`w-4 h-4 text-white ml-2 transition-transform ${isAccountDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              
              <AccountDropdown 
                isOpen={isAccountDropdownOpen} 
                onClose={() => setIsAccountDropdownOpen(false)} 
                user={user} 
                authUser={authUser}
              />
            </div>

            {/* Deposit & Withdrawal Buttons */}
            <div className="flex items-center gap-2">
              <button 
                onClick={() => window.dispatchEvent(new Event('openDepositModal'))} 
                className="flex items-center gap-1 bg-[#00b96b] hover:bg-[#00d179] text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-md text-xs sm:text-sm font-bold transition-colors"
              >
                <Plus className="w-3.5 h-3.5 sm:w-4 h-4" />
                Deposit
              </button>
              <Link 
                to="/wallet" 
                className="hidden md:flex items-center bg-[#2a303c] hover:bg-[#3a404d] text-white px-4 py-2 rounded-md text-sm font-bold transition-colors"
              >
                Withdrawal
              </Link>
            </div>
          </div>
        </header>

        <div className="flex-1 pb-16 md:pb-0">
          {children}
        </div>

        {/* Bottom Navigation Bar - Mobile Only */}
        <nav className="fixed bottom-0 left-0 right-0 h-16 bg-[#111111] border-t border-white/5 flex items-center justify-around px-2 z-50 md:hidden">
          <Link to="/trade" className={`flex flex-col items-center gap-1 ${location.pathname === '/trade' ? 'text-blue-500' : 'text-gray-500'}`}>
            <TrendingUp size={20} />
            <span className="text-[10px] font-bold">Trade</span>
          </Link>
          <Link to="/transactions" className={`flex flex-col items-center gap-1 ${location.pathname === '/transactions' ? 'text-blue-500' : 'text-gray-500'}`}>
            <History size={20} />
            <span className="text-[10px] font-bold">Transaction</span>
          </Link>
          <Link to="/settings" className={`flex flex-col items-center gap-1 ${location.pathname === '/settings' ? 'text-blue-500' : 'text-gray-500'}`}>
            <User size={20} />
            <span className="text-[10px] font-bold">Profile</span>
          </Link>
          <Link to="/wallet" className={`flex flex-col items-center gap-1 ${location.pathname === '/wallet' ? 'text-blue-500' : 'text-gray-500'}`}>
            <Wallet size={20} />
            <span className="text-[10px] font-bold">Wallet</span>
          </Link>
          <button 
            onClick={() => window.dispatchEvent(new Event('openDepositModal'))}
            className="flex flex-col items-center gap-1 text-gray-500"
          >
            <Plus size={20} />
            <span className="text-[10px] font-bold">Deposit</span>
          </button>
        </nav>
      </main>

      <DepositModal 
        isOpen={isDepositModalOpen} 
        onClose={() => setIsDepositModalOpen(false)} 
      />
    </div>
  );
};
