import React, { useState } from 'react';
import { 
  ArrowUp, 
  ArrowDown, 
  Plus, 
  Minus, 
  Info, 
  Clock,
  ChevronDown
} from 'lucide-react';
import { motion } from 'motion/react';

interface OrderFormProps {
  currentPrice: number | null;
  balance: number;
  onPlaceTrade: (direction: 'UP' | 'DOWN', amount: number, expiry: number) => void;
  payoutPercentage?: number;
  assetName?: string;
}

export const OrderForm: React.FC<OrderFormProps> = ({
  currentPrice,
  balance,
  onPlaceTrade,
  payoutPercentage = 70,
  assetName = 'BTC/USDT',
}) => {
  const [amount, setAmount] = useState<number>(100);
  const [amountStr, setAmountStr] = useState<string>('100');
  const [minutesStr, setMinutesStr] = useState<string>('01');
  const [secondsStr, setSecondsStr] = useState<string>('00');
  const [isPending, setIsPending] = useState(false);

  const minutes = parseInt(minutesStr) || 0;
  const seconds = parseInt(secondsStr) || 0;

  const potentialPayout = amount + (amount * payoutPercentage) / 100;

  const adjustAmount = (delta: number) => {
    const newAmount = Math.max(100, Math.min(50000, amount + delta));
    setAmount(newAmount);
    setAmountStr(newAmount.toString());
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (/^[0-9]*$/.test(val)) {
      let num = parseInt(val);
      if (!isNaN(num)) {
        if (num > 50000) {
          setAmount(50000);
          setAmountStr('50000');
        } else {
          setAmount(num);
          setAmountStr(val);
        }
      } else {
        setAmount(0);
        setAmountStr('');
      }
    }
  };

  const handleAmountKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      adjustAmount(100);
      e.preventDefault();
    } else if (e.key === 'ArrowDown') {
      adjustAmount(-100);
      e.preventDefault();
    }
  };

  const handleAmountBlur = () => {
    let num = parseInt(amountStr);
    if (isNaN(num)) num = 100;
    const finalAmount = Math.max(100, Math.min(50000, num));
    setAmount(finalAmount);
    setAmountStr(finalAmount.toString());
  };

  const adjustExpiry = (deltaSeconds: number) => {
    let totalSeconds = minutes * 60 + seconds + deltaSeconds;
    totalSeconds = Math.max(60, Math.min(600, totalSeconds));
    const newMin = Math.floor(totalSeconds / 60);
    const newSec = totalSeconds % 60;
    setMinutesStr(newMin.toString().padStart(2, '0'));
    setSecondsStr(newSec.toString().padStart(2, '0'));
  };

  const handleMinutesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9]/g, '');
    if (val.length > 2) return;
    
    setMinutesStr(val);
    
    const num = parseInt(val) || 0;
    if (num > 10) {
      setMinutesStr('10');
      setSecondsStr('00');
    } else if (num === 10) {
      setSecondsStr('00');
    }
  };

  const handleSecondsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9]/g, '');
    if (val.length > 2) return;

    if (minutes === 10) {
      setSecondsStr('00');
      return;
    }

    setSecondsStr(val);
    
    const num = parseInt(val) || 0;
    if (num > 59) {
      setSecondsStr('59');
    }
  };

  const handleMinutesKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      adjustExpiry(60);
      e.preventDefault();
    } else if (e.key === 'ArrowDown') {
      adjustExpiry(-60);
      e.preventDefault();
    }
  };

  const handleSecondsKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      adjustExpiry(1);
      e.preventDefault();
    } else if (e.key === 'ArrowDown') {
      adjustExpiry(-1);
      e.preventDefault();
    }
  };

  const handleTimeBlur = () => {
    let m = parseInt(minutesStr) || 0;
    let s = parseInt(secondsStr) || 0;
    
    let totalSeconds = m * 60 + s;
    if (totalSeconds < 60) totalSeconds = 60;
    if (totalSeconds > 600) totalSeconds = 600;
    
    const finalMin = Math.floor(totalSeconds / 60);
    const finalSec = totalSeconds % 60;
    
    setMinutesStr(finalMin.toString().padStart(2, '0'));
    setSecondsStr(finalSec.toString().padStart(2, '0'));
  };

  const handlePlaceTradeClick = (direction: 'UP' | 'DOWN') => {
    const expiryMinutes = minutes + seconds / 60;
    onPlaceTrade(direction, amount, expiryMinutes);
  };

  return (
    <div className="flex flex-col gap-3 sm:gap-6">
      {/* Asset Info Header - Desktop Only (Mobile has it in TradePage) */}
      <div className="hidden lg:flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-sm font-bold text-white uppercase tracking-tight">{assetName}</span>
          <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest">OTC Market</span>
        </div>
        <div className="flex items-center gap-2 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
          <span className="text-xs font-bold text-emerald-500">{payoutPercentage}%</span>
          <Info size={12} className="text-emerald-500" />
        </div>
      </div>

      {/* Mobile Asset Selector Row */}
      <div className="lg:hidden flex items-center justify-between bg-white/5 p-2 rounded-lg border border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-[10px] font-bold text-white">
            {assetName?.charAt(0)}
          </div>
          <span className="text-xs font-bold text-white uppercase">{assetName}</span>
          <span className="text-[10px] text-emerald-400 font-bold">{payoutPercentage}%</span>
          <ChevronDown size={12} className="text-gray-500" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-bold text-gray-500 uppercase">Pending Trade</span>
          <button 
            onClick={() => setIsPending(!isPending)}
            className={`w-7 h-3.5 rounded-full transition-colors relative ${isPending ? 'bg-blue-600' : 'bg-white/10'}`}
          >
            <div className={`absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white transition-all ${isPending ? 'left-4' : 'left-0.5'}`} />
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:gap-4">
        {/* Side-by-side Inputs on Mobile */}
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-col sm:gap-4">
          {/* Time Selector */}
          <div className="bg-[#0b0e14] p-2 sm:p-4 rounded-xl border border-white/5 shadow-inner">
            <div className="flex items-center justify-between mb-1 sm:mb-2">
              <label className="text-[8px] sm:text-[10px] uppercase tracking-widest text-gray-500 font-bold">Timer</label>
              <Clock size={10} className="text-gray-600 hidden sm:block" />
            </div>
            <div className="flex items-center justify-between gap-1 sm:gap-4">
              <button 
                onClick={() => adjustExpiry(-60)}
                className="w-6 h-6 sm:w-10 sm:h-10 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 transition-colors"
              >
                <Minus className="w-3 h-3 sm:w-4 sm:h-4" />
              </button>
              <div className="flex items-center justify-center bg-transparent px-1 flex-1">
                <input
                  type="text"
                  value={minutesStr}
                  onChange={handleMinutesChange}
                  onKeyDown={handleMinutesKeyDown}
                  onBlur={handleTimeBlur}
                  onMouseEnter={(e) => e.currentTarget.focus()}
                  onFocus={(e) => e.currentTarget.select()}
                  className="w-6 sm:w-8 text-center font-mono text-sm sm:text-xl font-bold text-white tracking-wider bg-transparent border-none outline-none cursor-pointer"
                  maxLength={2}
                />
                <span className="text-sm sm:text-xl font-bold text-white mx-0.5">:</span>
                <input
                  type="text"
                  value={secondsStr}
                  onChange={handleSecondsChange}
                  onKeyDown={handleSecondsKeyDown}
                  onBlur={handleTimeBlur}
                  onMouseEnter={(e) => e.currentTarget.focus()}
                  onFocus={(e) => e.currentTarget.select()}
                  className="w-6 sm:w-8 text-center font-mono text-sm sm:text-xl font-bold text-white tracking-wider bg-transparent border-none outline-none cursor-pointer"
                  maxLength={2}
                />
              </div>
              <button 
                onClick={() => adjustExpiry(60)}
                className="w-6 h-6 sm:w-10 sm:h-10 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 transition-colors"
              >
                <Plus className="w-3 h-3 sm:w-4 sm:h-4" />
              </button>
            </div>
          </div>

          {/* Investment Selector */}
          <div className="bg-[#0b0e14] p-2 sm:p-4 rounded-xl border border-white/5 shadow-inner">
            <div className="flex items-center justify-between mb-1 sm:mb-2">
              <label className="text-[8px] sm:text-[10px] uppercase tracking-widest text-gray-500 font-bold">Investment</label>
              <span className="text-[8px] sm:text-[10px] text-gray-600 font-bold hidden sm:block">₹</span>
            </div>
            <div className="flex items-center justify-between gap-1 sm:gap-4">
              <button 
                onClick={() => adjustAmount(-100)}
                className="w-6 h-6 sm:w-10 sm:h-10 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 transition-colors"
              >
                <Minus className="w-3 h-3 sm:w-4 sm:h-4" />
              </button>
              <div className="flex-1 flex items-center justify-center gap-0.5 bg-transparent">
                <input
                  type="text"
                  value={amountStr}
                  onChange={handleAmountChange}
                  onKeyDown={handleAmountKeyDown}
                  onBlur={handleAmountBlur}
                  onMouseEnter={(e) => e.currentTarget.focus()}
                  onFocus={(e) => e.currentTarget.select()}
                  className="text-center font-mono text-sm sm:text-xl font-bold text-white tracking-wider bg-transparent border-none outline-none w-12 sm:w-24 cursor-pointer"
                  placeholder="100"
                />
                <span className="text-sm sm:text-xl font-bold text-gray-400">₹</span>
              </div>
              <button 
                onClick={() => adjustAmount(100)}
                className="w-6 h-6 sm:w-10 sm:h-10 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 transition-colors"
              >
                <Plus className="w-3 h-3 sm:w-4 sm:h-4" />
              </button>
            </div>
            <div className="lg:hidden text-center mt-1">
              <button className="text-[8px] font-bold text-blue-500 uppercase">Switch</button>
            </div>
          </div>
        </div>

        {/* Payout Info */}
        <div className="flex flex-col gap-0.5 sm:gap-1 px-1">
          <div className="flex justify-between items-center">
            <span className="text-[9px] sm:text-[11px] text-gray-500 font-bold uppercase tracking-wider">Your payout:</span>
            <span className="text-xs sm:text-sm font-bold text-emerald-400">₹{potentialPayout.toFixed(2)}</span>
          </div>
          <div className="hidden sm:flex justify-between items-center">
            <span className="text-[11px] text-gray-500 font-bold uppercase tracking-wider">Total Return:</span>
            <span className="text-xs font-bold text-white">{payoutPercentage}%</span>
          </div>
        </div>

        {/* Action Buttons - Side-by-side on Mobile */}
        <div className="flex sm:flex-col gap-2 sm:gap-4 mt-1 sm:mt-2">
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={() => handlePlaceTradeClick('UP')}
            disabled={!currentPrice || amount > balance}
            className="flex-1 sm:w-full h-12 sm:h-20 bg-[#00b97a] hover:bg-[#00d18a] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg sm:rounded-2xl text-white font-bold flex items-center justify-between px-4 sm:px-8 transition-all shadow-lg group"
          >
            <span className="text-base sm:text-3xl font-bold tracking-tight">Up</span>
            <div className="w-6 h-6 sm:w-12 sm:h-12 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
              <ArrowUp className="w-4 h-4 sm:w-8 sm:h-8 stroke-[3px]" />
            </div>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={() => handlePlaceTradeClick('DOWN')}
            disabled={!currentPrice || amount > balance}
            className="flex-1 sm:w-full h-12 sm:h-20 bg-[#f6465d] hover:bg-[#ff5a72] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg sm:rounded-2xl text-white font-bold flex items-center justify-between px-4 sm:px-8 transition-all shadow-lg group"
          >
            <span className="text-base sm:text-3xl font-bold tracking-tight">Down</span>
            <div className="w-6 h-6 sm:w-12 sm:h-12 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
              <ArrowDown className="w-4 h-4 sm:w-8 sm:h-8 stroke-[3px]" />
            </div>
          </motion.button>
        </div>
      </div>
    </div>
  );
};
