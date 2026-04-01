import React, { useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, CheckCircle2, Circle, RefreshCw, Edit2, LogOut, Send } from 'lucide-react';
import { UserProfile, supabase } from '../lib/supabase';
import { generateNumericId } from '../lib/utils';

interface AccountDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile | null;
  authUser?: any;
}

export const AccountDropdown: React.FC<AccountDropdownProps> = ({ isOpen, onClose, user, authUser }) => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  if (!isOpen) return null;

  const displayEmail = authUser?.email || user?.email || 'user@example.com';
  const displayId = authUser?.id ? generateNumericId(authUser.id) : (user?.id ? generateNumericId(user.id) : '85162570');

  return (
    <div 
      className="absolute top-full right-0 mt-2 w-[480px] bg-[#0a0e17] rounded-lg shadow-2xl flex overflow-hidden z-50 border border-gray-800"
    >
      {/* Left Column - Account Info */}
      <div className="w-[280px] bg-[#1e222d] p-4 flex flex-col">
        {/* Status Box */}
        <div className="flex items-center justify-between bg-black/20 rounded-md p-3 mb-4">
          <div className="flex items-center gap-3">
            <Send className="w-5 h-5 text-[#00b96b] transform -rotate-45" fill="currentColor" />
            <div>
              <div className="text-[10px] text-gray-400 font-bold">STANDARD:</div>
              <div className="text-sm font-bold text-white">+0% profit</div>
            </div>
          </div>
          <button className="text-gray-400 hover:text-white transition-colors">
            <Eye className="w-5 h-5" />
          </button>
        </div>

        {/* User Details */}
        <div className="mb-4">
          <div className="text-white font-bold text-sm mb-1 truncate">{displayEmail}</div>
          <div className="text-gray-500 text-xs mb-3">ID: {displayId}</div>
          <div className="flex items-center gap-2">
            <span className="text-gray-500 text-xs">Currency:</span>
            <span className="text-white font-bold text-sm">INR</span>
            <button className="bg-[#007aff] text-white text-[10px] font-bold px-2 py-0.5 rounded">CHANGE</button>
          </div>
        </div>

        <div className="h-px bg-gray-700/50 w-full my-2"></div>

        {/* Live Account */}
        <div className="py-3">
          <div className="flex items-start gap-3">
            <div className="mt-0.5">
              <div className="w-5 h-5 bg-[#007aff] rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4 text-white" />
              </div>
            </div>
            <div className="flex-1">
              <div className="text-white text-[15px] mb-1">Live Account</div>
              <div className="text-white font-bold text-lg mb-2">₹{user?.balance?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}</div>
              <div className="text-gray-400 text-sm mb-2">The daily limit is not set</div>
              <button className="text-[#007aff] text-xs font-bold uppercase">SET LIMIT</button>
            </div>
          </div>
        </div>
      </div>

      {/* Right Column - Menu */}
      <div className="flex-1 bg-[#0a0e17] py-2 flex flex-col">
        <div className="flex flex-col flex-1">
          <button onClick={() => { onClose(); window.dispatchEvent(new Event('openDepositModal')); }} className="text-left px-5 py-3 text-gray-100 hover:bg-white/5 hover:text-white transition-colors text-[15px]">
            Deposit
          </button>
          <Link to="/wallet" onClick={onClose} className="text-left px-5 py-3 text-gray-100 hover:bg-white/5 hover:text-white transition-colors text-[15px]">
            Withdrawal
          </Link>
          <Link to="/wallet" onClick={onClose} className="text-left px-5 py-3 text-gray-100 hover:bg-white/5 hover:text-white transition-colors text-[15px]">
            Transactions
          </Link>
          <Link to="/trade" onClick={onClose} className="text-left px-5 py-3 text-gray-100 hover:bg-white/5 hover:text-white transition-colors text-[15px]">
            Trades
          </Link>
          <Link to="/settings" onClick={onClose} className="text-left px-5 py-3 text-gray-100 hover:bg-white/5 hover:text-white transition-colors text-[15px]">
            My account
          </Link>
        </div>
        
        <div className="h-px bg-gray-800/50 w-full my-2"></div>
        
        <button onClick={handleLogout} className="flex items-center gap-2 px-5 py-3 text-[#ff4a4a] hover:bg-white/5 transition-colors text-[15px]">
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </div>
    </div>
  );
};
