import React from 'react';
import { X, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface DrawingsSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTool: (tool: string) => void;
}

const DRAWING_TOOLS = [
  'Arc',
  'Cross Line',
  'Curve',
  'Cyclic Lines',
  'Date Range',
  'Date and Price Range',
  'Disjoint Channel',
  'Extended Line',
  'Fibonacci Fan',
  'Fibonacci Retracement',
  'Flat Top/Bottom',
  'Gann Box',
  'Horizontal line',
  'Parallel Channel',
  'Pitchfan',
  'Pitchfork',
  'Price Range',
  'Ray',
  'Rectangle',
  'Trend Angle',
  'Trend Line',
  'Triangle',
  'Vertical line'
];

export const DrawingsSidebar: React.FC<DrawingsSidebarProps> = ({ isOpen, onClose, onSelectTool }) => {
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
              <h2 className="text-xl font-bold text-white">Drawings</h2>
              <button 
                onClick={onClose}
                className="text-gray-500 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar pb-6">
              <div className="px-5">
                <div className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-3">
                  DRAWINGS
                </div>
                <div className="flex flex-col">
                  {DRAWING_TOOLS.map((tool) => (
                    <button
                      key={tool}
                      onClick={() => {
                        onSelectTool(tool);
                        onClose();
                      }}
                      className="flex items-center justify-between py-3.5 text-[15px] font-bold text-gray-200 hover:text-white transition-colors group"
                    >
                      <span>{tool}</span>
                      <ChevronRight size={16} className="text-gray-500 group-hover:text-gray-300" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
