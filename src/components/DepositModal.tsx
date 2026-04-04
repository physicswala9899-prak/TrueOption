import React, { useEffect, useRef, useState } from 'react';
import { X, Wallet, Hexagon, ChevronRight, ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Custom Icons to match the design
const UpiIcon = ({ className = "h-5" }: { className?: string }) => (
  <div className={`flex items-center italic font-bold tracking-tighter ${className}`}>
    <span className="text-[#007a33]">U</span>
    <span className="text-[#f47b20]">P</span>
    <span className="text-[#007a33]">I</span>
    <svg className="w-3 h-3 ml-0.5 text-[#007a33]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
  </div>
);

const BinanceIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={`${className} text-[#F3BA2F] fill-current`}>
    <path d="M12 1.333L6.18 7.153l1.886 1.886L12 5.105l3.934 3.934 1.886-1.886L12 1.333zm0 5.658L8.066 10.925l1.886 1.886L12 10.877l2.048 1.934 1.886-1.886L12 6.991zm-5.82 5.82L2.246 16.745l1.886 1.886L10.114 12.65 6.18 8.716zm11.64 0l-3.934 3.934 1.886 1.886 5.82-5.82-1.886-1.886-1.886 1.886zm-5.82 5.82l-2.048-1.934-1.886 1.886L12 22.667l3.934-3.934-1.886-1.886L12 18.631z"/>
  </svg>
);

const PhonePeIcon = ({ className = "w-6 h-6 text-sm" }: { className?: string }) => (
  <div className={`${className} rounded-full bg-[#5f259f] text-white flex items-center justify-center font-bold font-sans`}>पे</div>
);

const PaytmIcon = ({ className = "text-sm" }: { className?: string }) => (
  <div className={`font-bold text-[#00baf2] tracking-tighter ${className}`}>PayTM</div>
);

const UsdtIcon = ({ network, className = "w-6 h-6 text-[12px]" }: { network?: string, className?: string }) => (
  <div className="relative flex items-center justify-center">
    <div className={`${className} rounded-full bg-[#26a17b] text-white flex items-center justify-center font-bold z-10`}>₮</div>
    {network === 'TRC-20' && <div className="absolute -right-1 -bottom-1 w-3.5 h-3.5 bg-red-500 rounded-full border-2 border-white flex items-center justify-center z-20"><div className="w-1.5 h-1.5 border-t border-r border-white transform rotate-45"></div></div>}
    {network === 'ERC-20' && <div className="absolute -right-1 -bottom-1 w-3.5 h-3.5 bg-gray-200 rounded-full border-2 border-white flex items-center justify-center z-20"><div className="w-1.5 h-1.5 bg-gray-500 transform rotate-45"></div></div>}
    {network === 'Polygon' && <div className="absolute -right-1 -bottom-1 w-3.5 h-3.5 bg-purple-500 rounded-full border-2 border-white flex items-center justify-center z-20"><div className="w-1.5 h-1.5 border-t border-r border-white transform rotate-45"></div></div>}
    {network === 'BEP-20' && <div className="absolute -right-1 -bottom-1 w-3.5 h-3.5 bg-yellow-500 rounded-full border-2 border-white flex items-center justify-center z-20"><div className="w-1 h-1 bg-white transform rotate-45"></div></div>}
  </div>
);

const BtcIcon = ({ className = "w-4 h-4 text-[8px]" }: { className?: string }) => (
  <div className={`${className} rounded-full bg-[#f7931a] text-white flex items-center justify-center font-bold`}>₿</div>
);

const EthIcon = ({ className = "w-4 h-4 text-[8px]" }: { className?: string }) => (
  <div className={`${className} rounded-full bg-[#627eea] text-white flex items-center justify-center font-bold`}>Ξ</div>
);

const IndiaFlag = () => (
  <div className="w-5 h-5 rounded-full overflow-hidden relative border border-gray-300 shrink-0">
    <div className="absolute top-0 w-full h-1/3 bg-[#FF9933]"></div>
    <div className="absolute top-1/3 w-full h-1/3 bg-white flex items-center justify-center">
      <div className="w-1.5 h-1.5 rounded-full border border-[#000080]"></div>
    </div>
    <div className="absolute bottom-0 w-full h-1/3 bg-[#138808]"></div>
  </div>
);

const MethodCard = ({ icon: Icon, name, min, network, onClick }: { icon: any, name: string, min: string, network?: string, onClick?: () => void }) => (
  <div 
    onClick={onClick}
    className="bg-white rounded-md p-3 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
  >
    <div className="flex items-center gap-3">
      <div className="w-8 flex justify-center">
        <Icon network={network} />
      </div>
      <div className="flex flex-col">
        <span className="text-[#1a1a1a] font-medium text-sm">{name}</span>
        <span className="text-[#8e9299] text-xs">Min. ₹{min}</span>
      </div>
    </div>
    <ChevronRight className="w-4 h-4 text-gray-400" />
  </div>
);

export const DepositModal: React.FC<DepositModalProps> = ({ isOpen, onClose }) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const popularRef = useRef<HTMLDivElement>(null);
  const epayRef = useRef<HTMLDivElement>(null);
  const cryptoRef = useRef<HTMLDivElement>(null);
  const [selectedMethod, setSelectedMethod] = useState<{name: string, icon: any, min: string} | null>(null);
  const [amount, setAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const scrollToSection = (ref: React.RefObject<HTMLDivElement>) => {
    if (ref.current) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleDeposit = async () => {
    if (!selectedMethod || !amount) return;
    setIsProcessing(true);
    
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return;

    const depAmount = parseFloat(amount);
    
    const { error: balanceError } = await (supabase.rpc as any)('adjust_user_balance', {
      p_user_id: authUser.id,
      p_amount: depAmount,
      p_reason: `Deposit via ${selectedMethod.name}`
    });

    if (balanceError) {
      alert(balanceError.message);
      setIsProcessing(false);
      return;
    }

    await (supabase.from('transactions') as any).insert({
      user_id: authUser.id,
      type: 'DEPOSIT',
      amount: depAmount,
      status: 'COMPLETED',
      reference: `SIMULATED_${selectedMethod.name.toUpperCase()}`
    });

    alert(`Successfully deposited ₹${depAmount} via ${selectedMethod.name}!`);
    setIsProcessing(false);
    setSelectedMethod(null);
    setAmount('');
    onClose();
    window.location.reload(); // Refresh to show new balance
  };

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0f111a]/80 backdrop-blur-sm p-0 sm:p-4"
      onClick={handleBackdropClick}
    >
      <div 
        ref={modalRef}
        className="bg-[#232833] w-full h-full sm:h-auto sm:max-w-[900px] sm:rounded-xl shadow-2xl flex flex-col max-h-screen sm:max-h-[90vh] overflow-hidden"
      >
        {/* Header */}
        <div className="flex justify-between items-center p-4 sm:p-6 border-b border-[#3a404d] border-dashed shrink-0">
          <h2 className="text-xl sm:text-2xl font-bold text-white">Deposit</h2>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-1"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-col lg:flex-row flex-1 overflow-hidden p-3 sm:p-6 gap-4 sm:gap-6">
          {selectedMethod ? (
            <div className="flex-1 flex flex-col gap-4 sm:gap-6 overflow-y-auto custom-scrollbar px-1">
              <button 
                onClick={() => setSelectedMethod(null)}
                className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors w-fit py-2"
              >
                <ArrowLeft size={16} />
                <span className="text-sm font-bold">Back to methods</span>
              </button>

              <div className="bg-[#2a303c] rounded-xl p-4 sm:p-6 border border-white/5">
                <div className="flex items-center gap-4 mb-6 sm:mb-8">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white rounded-lg flex items-center justify-center shrink-0">
                    <selectedMethod.icon className="scale-110 sm:scale-125" />
                  </div>
                  <div>
                    <h3 className="text-lg sm:text-xl font-bold text-white">{selectedMethod.name}</h3>
                    <p className="text-xs sm:text-sm text-gray-400">Instant deposit</p>
                  </div>
                </div>

                <div className="space-y-4 sm:space-y-6">
                  <div>
                    <label className="block text-xs sm:text-sm text-gray-400 mb-2 font-medium">Amount (Min. ₹{selectedMethod.min})</label>
                    <div className="relative">
                      <input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="w-full bg-[#1e222d] border border-gray-700/50 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors text-base"
                        placeholder={selectedMethod.min}
                        autoFocus
                      />
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">
                        ₹
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {['1000', '2000', '5000'].map((val) => (
                      <button
                        key={val}
                        onClick={() => setAmount(val)}
                        className="bg-white/5 hover:bg-white/10 text-white py-2.5 rounded-lg text-xs sm:text-sm font-bold transition-colors border border-white/5 active:scale-95"
                      >
                        ₹{val}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={handleDeposit}
                    disabled={isProcessing || !amount || parseFloat(amount) < parseFloat(selectedMethod.min)}
                    className="w-full bg-[#00b96b] hover:bg-[#00d179] disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-3.5 sm:py-4 rounded-lg transition-all text-base sm:text-lg shadow-lg shadow-[#00b96b]/20 active:scale-[0.98]"
                  >
                    {isProcessing ? 'Processing...' : `Deposit ₹${amount || '0'}`}
                  </button>

                  <div className="flex flex-col items-center gap-2">
                    <p className="text-[9px] sm:text-[10px] text-gray-500 text-center uppercase tracking-widest font-bold">
                      Secure 256-bit SSL Encrypted Payment
                    </p>
                    <div className="flex items-center gap-3 opacity-30 grayscale scale-75 sm:scale-90">
                      <div className="text-xs font-bold italic text-white">VISA</div>
                      <div className="text-xs font-bold text-white">MasterCard</div>
                      <div className="text-xs font-bold text-white">PCI DSS</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Left Sidebar / Top Categories on Mobile */}
              <div className="w-full lg:w-[260px] shrink-0 flex flex-row lg:flex-col gap-2 sm:gap-3 overflow-x-auto lg:overflow-y-auto custom-scrollbar pb-2 lg:pb-0 lg:pr-2 no-scrollbar lg:scrollbar-show">
                {/* Popular Card */}
                <div 
                  onClick={() => scrollToSection(popularRef)}
                  className="bg-[#1bb860] rounded-lg p-3 sm:p-4 cursor-pointer relative overflow-hidden shrink-0 w-[160px] lg:w-full active:scale-95 transition-transform"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <IndiaFlag />
                    <span className="text-white font-bold tracking-wide text-xs sm:text-sm">POPULAR</span>
                  </div>
                  <div className="text-white/80 text-[10px] sm:text-xs mb-3 sm:mb-4">8 methods</div>
                  <div className="flex items-center gap-1.5">
                    <UpiIcon className="h-2.5 sm:h-3 text-white" />
                    <BinanceIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
                    <div className="bg-white/20 text-white text-[8px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded">+6</div>
                  </div>
                </div>

                {/* E-Pay Card */}
                <div 
                  onClick={() => scrollToSection(epayRef)}
                  className="bg-[#2a303c] rounded-lg p-3 sm:p-4 cursor-pointer hover:bg-[#323947] transition-colors shrink-0 w-[140px] lg:w-full active:scale-95"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Wallet className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                    <span className="text-white font-bold tracking-wide text-xs sm:text-sm">E-PAY</span>
                  </div>
                  <div className="text-gray-400 text-[10px] sm:text-xs mb-3 sm:mb-4">3 methods</div>
                  <div className="flex items-center gap-1.5">
                    <UpiIcon className="h-2.5 sm:h-3" />
                    <PaytmIcon className="text-[8px] sm:text-[10px]" />
                  </div>
                </div>

                {/* Crypto Card */}
                <div 
                  onClick={() => scrollToSection(cryptoRef)}
                  className="bg-[#2a303c] rounded-lg p-3 sm:p-4 cursor-pointer hover:bg-[#323947] transition-colors shrink-0 w-[140px] lg:w-full active:scale-95"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Hexagon className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="currentColor" />
                    <span className="text-white font-bold tracking-wide text-xs sm:text-sm">CRYPTO</span>
                  </div>
                  <div className="text-gray-400 text-[10px] sm:text-xs mb-3 sm:mb-4">20 methods</div>
                  <div className="flex items-center gap-1.5">
                    <BinanceIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <UsdtIcon network="TRC-20" className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[8px]" />
                  </div>
                </div>
              </div>

              {/* Right Content */}
              <div className="flex-1 overflow-y-auto custom-scrollbar pr-0 lg:pr-2 scroll-smooth px-1">
                
                {/* Section 1 */}
                <div className="mb-8" ref={popularRef}>
                  <h3 className="text-white font-bold text-base sm:text-lg mb-4 flex items-center gap-2">
                    Popular in your region
                    <span className="text-gray-500 text-sm font-medium">(8)</span>
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                    <MethodCard onClick={() => setSelectedMethod({name: 'UPI', icon: UpiIcon, min: '500.00'})} icon={UpiIcon} name="UPI" min="500.00" />
                    <MethodCard onClick={() => setSelectedMethod({name: 'Binance Pay', icon: BinanceIcon, min: '970.00'})} icon={BinanceIcon} name="Binance Pay" min="970.00" />
                    <MethodCard onClick={() => setSelectedMethod({name: 'PhonePe', icon: PhonePeIcon, min: '500.00'})} icon={PhonePeIcon} name="PhonePe" min="500.00" />
                    <MethodCard onClick={() => setSelectedMethod({name: 'USDT (BEP-20)', icon: UsdtIcon, min: '970.00'})} icon={UsdtIcon} network="BEP-20" name="USDT (BEP-20)" min="970.00" />
                    <MethodCard onClick={() => setSelectedMethod({name: 'PayTM', icon: PaytmIcon, min: '500.00'})} icon={PaytmIcon} name="PayTM" min="500.00" />
                    <MethodCard onClick={() => setSelectedMethod({name: 'USDT (TRC-20)', icon: UsdtIcon, min: '970.00'})} icon={UsdtIcon} network="TRC-20" name="USDT (TRC-20)" min="970.00" />
                    <MethodCard onClick={() => setSelectedMethod({name: 'USDT (ERC-20)', icon: UsdtIcon, min: '970.00'})} icon={UsdtIcon} network="ERC-20" name="USDT (ERC-20)" min="970.00" />
                    <MethodCard onClick={() => setSelectedMethod({name: 'USDT (Polygon)', icon: UsdtIcon, min: '970.00'})} icon={UsdtIcon} network="Polygon" name="USDT (Polygon)" min="970.00" />
                  </div>
                </div>

                {/* Section 2 */}
                <div className="mb-8" ref={epayRef}>
                  <h3 className="text-white font-bold text-base sm:text-lg mb-4 flex items-center gap-2">
                    E-Pay
                    <span className="text-gray-500 text-sm font-medium">(3)</span>
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                    <MethodCard onClick={() => setSelectedMethod({name: 'UPI', icon: UpiIcon, min: '500.00'})} icon={UpiIcon} name="UPI" min="500.00" />
                    <MethodCard onClick={() => setSelectedMethod({name: 'PayTM', icon: PaytmIcon, min: '500.00'})} icon={PaytmIcon} name="PayTM" min="500.00" />
                    <MethodCard onClick={() => setSelectedMethod({name: 'PhonePe', icon: PhonePeIcon, min: '500.00'})} icon={PhonePeIcon} name="PhonePe" min="500.00" />
                  </div>
                </div>

                {/* Section 3 */}
                <div className="mb-8 pb-10" ref={cryptoRef}>
                  <div className="flex items-center gap-4 mb-4">
                    <h3 className="text-white font-bold text-base sm:text-lg whitespace-nowrap">Crypto (20)</h3>
                    <div className="h-px bg-white/5 flex-1"></div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 opacity-60">
                    <MethodCard onClick={() => setSelectedMethod({name: 'Bitcoin', icon: BtcIcon, min: '970.00'})} icon={BtcIcon} name="Bitcoin" min="970.00" />
                    <MethodCard onClick={() => setSelectedMethod({name: 'Ethereum', icon: EthIcon, min: '970.00'})} icon={EthIcon} name="Ethereum" min="970.00" />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
