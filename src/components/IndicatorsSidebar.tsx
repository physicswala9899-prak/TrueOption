import React from 'react';
import { X, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface IndicatorsSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectIndicator: (indicator: string) => void;
  activeIndicators: string[];
}

const TREND_INDICATORS = [
  'Alligator',
  'Bollinger Bands',
  'Envelopes',
  'Fractal',
  'Ichimoku Cloud',
  'Keltner channel',
  'Donchian channel',
  'Supertrend',
  'Moving Average',
  'Parabolic SAR',
  'Zig Zag'
];

const OSCILLATORS = [
  'ADX',
  'Aroon',
  'Awesome Oscillator',
  'Bears power',
  'Bulls power',
  'CCI',
  'DeMarker',
  'ATR',
  'MACD',
  'Momentum',
  'RSI',
  'Rate Of Change'
];

export const IndicatorsSidebar: React.FC<IndicatorsSidebarProps> = ({ isOpen, onClose, onSelectIndicator, activeIndicators }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 z-40 bg-black/20"
          />
          
          {/* Sidebar */}
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'tween', duration: 0.3 }}
            className="absolute top-0 left-0 bottom-0 w-[300px] bg-[#1e222d] z-50 flex flex-col shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 pb-4">
              <h2 className="text-xl font-bold text-white">Indicators</h2>
              <button 
                onClick={onClose}
                className="text-gray-500 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar pb-6">
              <div className="px-5 mb-6">
                <div className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-3">
                  TREND INDICATORS
                </div>
                <div className="flex flex-col">
                  {TREND_INDICATORS.map((indicator) => {
                    const isActive = activeIndicators.includes(indicator);
                    return (
                      <button
                        key={indicator}
                        onClick={() => {
                          onSelectIndicator(indicator);
                          onClose();
                        }}
                        className={`flex items-center justify-between py-3.5 text-[15px] font-bold transition-colors group ${isActive ? 'text-blue-500' : 'text-gray-200 hover:text-white'}`}
                      >
                        <span>{indicator}</span>
                        <ChevronRight size={16} className={isActive ? 'text-blue-500' : 'text-gray-500 group-hover:text-gray-300'} />
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="px-5">
                <div className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-3">
                  OSCILLATORS
                </div>
                <div className="flex flex-col">
                  {OSCILLATORS.map((indicator) => {
                    const isActive = activeIndicators.includes(indicator);
                    return (
                      <button
                        key={indicator}
                        onClick={() => {
                          onSelectIndicator(indicator);
                          onClose();
                        }}
                        className={`flex items-center justify-between py-3.5 text-[15px] font-bold transition-colors group ${isActive ? 'text-blue-500' : 'text-gray-200 hover:text-white'}`}
                      >
                        <span>{indicator}</span>
                        <ChevronRight size={16} className={isActive ? 'text-blue-500' : 'text-gray-500 group-hover:text-gray-300'} />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
