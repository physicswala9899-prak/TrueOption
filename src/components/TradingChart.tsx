import React, { useEffect, useRef, useState, useCallback } from 'react';
import { 
  createChart, 
  IChartApi, 
  ISeriesApi, 
  CandlestickSeries, 
  LineSeries, 
  AreaSeries, 
  BarSeries, 
  ColorType,
  createSeriesMarkers
} from 'lightweight-charts';

import { 
  BarChart3, 
  BarChart2,
  Activity,
  Settings2, 
  Pencil, 
  Plus, 
  Minus, 
  Maximize2,
  ChevronDown,
  Clock,
  X,
  PenTool
} from 'lucide-react';

import { DrawingsSidebar } from './DrawingsSidebar';
import { IndicatorsSidebar } from './IndicatorsSidebar';
import { calculateSMA, calculateBollingerBands, calculateRSI, calculateMACD } from '../utils/indicators';

interface TradingChartProps {
  data: any[];
  asset: string;
  trades?: any[];
  onTimeframeChange?: (timeframe: string) => void;
}

const TIMEFRAMES = [
  { label: '1m', value: '1m' },
  { label: '3m', value: '3m' },
  { label: '5m', value: '5m' },
  { label: '30m', value: '30m' },
  { label: '1h', value: '1h' },
  { label: '1d', value: '1d' },
];

const CHART_TYPES = [
  { id: 'area', label: 'Area', icon: Activity },
  { id: 'candles', label: 'Candles', icon: BarChart3 },
  { id: 'bars', label: 'Bars', icon: BarChart2 },
  { id: 'heikenAshi', label: 'Heiken Ashi', icon: BarChart3 },
];

const calculateHeikenAshi = (data: any[]) => {
  if (data.length === 0) return [];
  
  const haData = [];
  let prevHaOpen = (data[0].open + data[0].close) / 2;
  let prevHaClose = (data[0].open + data[0].high + data[0].low + data[0].close) / 4;

  haData.push({
    time: data[0].time,
    open: prevHaOpen,
    high: Math.max(data[0].high, prevHaOpen, prevHaClose),
    low: Math.min(data[0].low, prevHaOpen, prevHaClose),
    close: prevHaClose,
  });

  for (let i = 1; i < data.length; i++) {
    const curr = data[i];
    const haClose = (curr.open + curr.high + curr.low + curr.close) / 4;
    const haOpen = (prevHaOpen + prevHaClose) / 2;
    const haHigh = Math.max(curr.high, haOpen, haClose);
    const haLow = Math.min(curr.low, haOpen, haClose);

    haData.push({
      time: curr.time,
      open: haOpen,
      high: haHigh,
      low: haLow,
      close: haClose,
    });

    prevHaOpen = haOpen;
    prevHaClose = haClose;
  }

  return haData;
};

export const TradingChart: React.FC<TradingChartProps> = ({ data, asset, trades = [], onTimeframeChange }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const mainSeriesRef = useRef<ISeriesApi<any> | null>(null);
  const maSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const markersPluginRef = useRef<any>(null);
  
  const [activeTimeframe, setActiveTimeframe] = useState('1m');
  const [chartType, setChartType] = useState('candles');
  const [isChartTypeMenuOpen, setIsChartTypeMenuOpen] = useState(false);
  const [isTimeframeMenuOpen, setIsTimeframeMenuOpen] = useState(false);
  
  const [isDrawingsSidebarOpen, setIsDrawingsSidebarOpen] = useState(false);
  const [isIndicatorsSidebarOpen, setIsIndicatorsSidebarOpen] = useState(false);
  const [activeDrawingTool, setActiveDrawingTool] = useState<string | null>(null);
  const [activeIndicators, setActiveIndicators] = useState<string[]>([]);
  const indicatorSeriesRefs = useRef<Record<string, ISeriesApi<any>[]>>({});
  const [horizontalLines, setHorizontalLines] = useState<number[]>([]);
  const [markers, setMarkers] = useState<any[]>([]);
  const [showSMA, setShowSMA] = useState(true);
  const priceLinesRef = useRef<any[]>([]);
  const lastFittedAssetRef = useRef<string | null>(null);

  // Update markers when trades change
  useEffect(() => {
    if (trades.length === 0) {
      setMarkers([]);
      return;
    }

    const tradeMarkers = trades.map(trade => {
      const tradeTime = Math.floor(new Date(trade.created_at).getTime() / 1000);
      return {
        time: tradeTime,
        position: trade.direction === 'UP' ? 'belowBar' : 'aboveBar',
        color: trade.direction === 'UP' ? '#26a69a' : '#ef5350',
        shape: trade.direction === 'UP' ? 'arrowUp' : 'arrowDown',
        text: `${trade.direction} $${trade.amount}`,
      };
    });

    setMarkers(tradeMarkers);
  }, [trades]);

  // 1. Initialize Chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#0b0e14' },
        textColor: '#70757a',
        fontSize: 11,
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: '#1e222d', style: 1 },
        horzLines: { color: '#1e222d', style: 1 },
      },
      crosshair: {
        mode: 1, // Magnet mode
        vertLine: {
          color: '#70757a',
          width: 1,
          style: 1,
          labelBackgroundColor: '#1e222d',
        },
        horzLine: {
          color: '#70757a',
          width: 1,
          style: 1,
          labelBackgroundColor: '#1e222d',
        },
      },
      timeScale: {
        borderColor: '#1e222d',
        timeVisible: true,
        secondsVisible: false,
        barSpacing: 10,
        rightOffset: 12,
      },
      rightPriceScale: {
        borderColor: '#1e222d',
        autoScale: true,
        scaleMargins: {
          top: 0.1,
          bottom: 0.1,
        },
      },
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
    });

    chartRef.current = chart;

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        const width = chartContainerRef.current.clientWidth;
        chartRef.current.applyOptions({
          width: width,
          height: chartContainerRef.current.clientHeight,
        });

        // Adjust bar spacing for narrow views
        if (width < 600) {
          chartRef.current.timeScale().applyOptions({ barSpacing: 6 });
        } else {
          chartRef.current.timeScale().applyOptions({ barSpacing: 10 });
        }
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      chartRef.current = null;
      mainSeriesRef.current = null;
      maSeriesRef.current = null;
      markersPluginRef.current = null;
    };
  }, []);

  // 2. Manage Series based on Chart Type
  useEffect(() => {
    if (!chartRef.current) return;

    if (mainSeriesRef.current) {
      try {
        if (markersPluginRef.current) {
          markersPluginRef.current.detach();
          markersPluginRef.current = null;
        }
        chartRef.current.removeSeries(mainSeriesRef.current);
      } catch (e) {}
    }
    if (maSeriesRef.current) {
      try {
        chartRef.current.removeSeries(maSeriesRef.current);
      } catch (e) {}
    }

    let newMainSeries;
    if (chartType === 'area') {
      newMainSeries = chartRef.current.addSeries(AreaSeries, {
        lineColor: '#26a69a',
        topColor: 'rgba(38, 166, 154, 0.56)',
        bottomColor: 'rgba(38, 166, 154, 0.04)',
        lineWidth: 2,
      });
    } else if (chartType === 'bars') {
      newMainSeries = chartRef.current.addSeries(BarSeries, {
        upColor: '#26a69a',
        downColor: '#ef5350',
      });
    } else {
      newMainSeries = chartRef.current.addSeries(CandlestickSeries, {
        upColor: '#26a69a',
        downColor: '#ef5350',
        borderVisible: true,
        borderColor: '#26a69a',
        borderUpColor: '#26a69a',
        borderDownColor: '#ef5350',
        wickUpColor: '#26a69a',
        wickDownColor: '#ef5350',
      });
    }

    const newMaSeries = chartRef.current.addSeries(LineSeries, {
      color: 'rgba(41, 98, 255, 0.5)',
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    mainSeriesRef.current = newMainSeries;
    maSeriesRef.current = newMaSeries;
    markersPluginRef.current = createSeriesMarkers(newMainSeries);

    // Trigger data update for new series
    updateData();
  }, [chartType]);

  // 3. Update Data
  const updateData = useCallback(() => {
    if (!mainSeriesRef.current || !maSeriesRef.current || data.length === 0) return;

    // Ensure data is strictly increasing by time
    const uniqueData = data.reduce((acc: any[], curr) => {
      if (acc.length === 0) {
        acc.push(curr);
      } else {
        const last = acc[acc.length - 1];
        if (curr.time > last.time) {
          acc.push(curr);
        } else if (curr.time === last.time) {
          acc[acc.length - 1] = curr; // Update existing
        }
      }
      return acc;
    }, []);

    let formattedData = uniqueData;

    if (chartType === 'heikenAshi') {
      formattedData = calculateHeikenAshi(uniqueData);
    } else if (chartType === 'area') {
      formattedData = uniqueData.map((d: any) => ({ time: d.time, value: d.close }));
    }

    mainSeriesRef.current.setData(formattedData);

    // Simple Moving Average (SMA 20)
    if (showSMA && uniqueData.length >= 20) {
      const maData = uniqueData.map((d: any, i: number) => {
        if (i < 19) return null;
        const slice = uniqueData.slice(i - 19, i + 1);
        const sum = slice.reduce((acc: number, curr: any) => acc + curr.close, 0);
        return { time: d.time, value: sum / 20 };
      }).filter((d: any) => d !== null);
      
      maSeriesRef.current.setData(maData as any);
    } else {
      maSeriesRef.current.setData([]);
    }
  }, [data, chartType, showSMA]);

  const updateIndicators = useCallback(() => {
    if (!chartRef.current || data.length === 0) return;

    const uniqueData = data.reduce((acc: any[], curr) => {
      if (acc.length === 0) {
        acc.push(curr);
      } else {
        const last = acc[acc.length - 1];
        if (curr.time > last.time) {
          acc.push(curr);
        } else if (curr.time === last.time) {
          acc[acc.length - 1] = curr;
        }
      }
      return acc;
    }, []);

    // Clean up removed indicators
    Object.keys(indicatorSeriesRefs.current).forEach(indicatorName => {
      if (!activeIndicators.includes(indicatorName)) {
        indicatorSeriesRefs.current[indicatorName].forEach(series => {
          try {
            chartRef.current?.removeSeries(series);
          } catch (e) {}
        });
        delete indicatorSeriesRefs.current[indicatorName];
      }
    });

    // Update or create active indicators
    activeIndicators.forEach(indicatorName => {
      if (!indicatorSeriesRefs.current[indicatorName]) {
        indicatorSeriesRefs.current[indicatorName] = [];
        
        // Create series based on indicator type
        if (indicatorName === 'Moving Average') {
          const series = chartRef.current!.addSeries(LineSeries, { color: '#2962FF', lineWidth: 2, title: 'SMA 20' });
          indicatorSeriesRefs.current[indicatorName].push(series);
        } else if (indicatorName === 'Bollinger Bands') {
          const upper = chartRef.current!.addSeries(LineSeries, { color: '#00B0FF', lineWidth: 1, title: 'BB Upper' });
          const middle = chartRef.current!.addSeries(LineSeries, { color: '#FF6D00', lineWidth: 1, title: 'BB Middle' });
          const lower = chartRef.current!.addSeries(LineSeries, { color: '#00B0FF', lineWidth: 1, title: 'BB Lower' });
          indicatorSeriesRefs.current[indicatorName].push(upper, middle, lower);
        } else if (indicatorName === 'RSI') {
          const series = chartRef.current!.addSeries(LineSeries, { 
            color: '#AA00FF', 
            lineWidth: 2, 
            title: 'RSI 14',
            priceScaleId: 'rsi'
          });
          chartRef.current!.priceScale('rsi').applyOptions({
            scaleMargins: { top: 0.8, bottom: 0 },
          });
          indicatorSeriesRefs.current[indicatorName].push(series);
        } else if (indicatorName === 'MACD') {
          const macd = chartRef.current!.addSeries(LineSeries, { color: '#2962FF', lineWidth: 2, title: 'MACD', priceScaleId: 'macd' });
          const signal = chartRef.current!.addSeries(LineSeries, { color: '#FF6D00', lineWidth: 2, title: 'Signal', priceScaleId: 'macd' });
          // Note: HistogramSeries is not exported from lightweight-charts in the same way, we'll just use lines for simplicity or ignore histogram
          chartRef.current!.priceScale('macd').applyOptions({
            scaleMargins: { top: 0.8, bottom: 0 },
          });
          indicatorSeriesRefs.current[indicatorName].push(macd, signal);
        } else {
          // Generic fallback for others, just an SMA with different period or color
          const series = chartRef.current!.addSeries(LineSeries, { color: '#00E676', lineWidth: 1, title: indicatorName });
          indicatorSeriesRefs.current[indicatorName].push(series);
        }
      }

      // Calculate and set data
      const seriesList = indicatorSeriesRefs.current[indicatorName];
      if (indicatorName === 'Moving Average') {
        const smaData = calculateSMA(uniqueData, 20);
        seriesList[0].setData(smaData as any);
      } else if (indicatorName === 'Bollinger Bands') {
        const bbData = calculateBollingerBands(uniqueData, 20, 2);
        seriesList[0].setData(bbData.map(d => ({ time: d.time, value: d.upper })) as any);
        seriesList[1].setData(bbData.map(d => ({ time: d.time, value: d.middle })) as any);
        seriesList[2].setData(bbData.map(d => ({ time: d.time, value: d.lower })) as any);
      } else if (indicatorName === 'RSI') {
        const rsiData = calculateRSI(uniqueData, 14);
        seriesList[0].setData(rsiData as any);
      } else if (indicatorName === 'MACD') {
        const macdData = calculateMACD(uniqueData, 12, 26, 9);
        seriesList[0].setData(macdData.map(d => ({ time: d.time, value: d.macd })) as any);
        seriesList[1].setData(macdData.map(d => ({ time: d.time, value: d.signal })) as any);
      } else {
        // Fallback: just SMA 10
        const smaData = calculateSMA(uniqueData, 10);
        seriesList[0].setData(smaData as any);
      }
    });
  }, [data, activeIndicators]);

  useEffect(() => {
    updateData();
    updateIndicators();
  }, [updateData, updateIndicators]);

  // Fit content only once when asset changes or data first arrives for a new asset
  useEffect(() => {
    if (chartRef.current && data.length > 0 && lastFittedAssetRef.current !== asset) {
      chartRef.current.timeScale().fitContent();
      lastFittedAssetRef.current = asset;
    }
  }, [asset, data.length]);

  // Apply drawings to the current series
  useEffect(() => {
    if (!mainSeriesRef.current) return;
    
    // Apply markers
    if (markers.length > 0) {
      if (markersPluginRef.current) {
        markersPluginRef.current.setMarkers([...markers].sort((a, b) => a.time - b.time));
      }
    } else {
      if (markersPluginRef.current) {
        markersPluginRef.current.setMarkers([]);
      }
    }

    // Apply horizontal lines
    // First clear existing
    priceLinesRef.current.forEach(line => {
      try {
        mainSeriesRef.current?.removePriceLine(line);
      } catch (e) {}
    });
    priceLinesRef.current = [];

    // Add new ones
    horizontalLines.forEach(price => {
      const line = mainSeriesRef.current?.createPriceLine({
        price: price,
        color: '#2962FF',
        lineWidth: 2,
        lineStyle: 0,
        axisLabelVisible: true,
        title: 'Line',
      });
      if (line) priceLinesRef.current.push(line);
    });
  }, [chartType, horizontalLines, markers]);

  // Handle drawing tool clicks
  useEffect(() => {
    if (!chartRef.current || !mainSeriesRef.current || !activeDrawingTool) return;

    const chart = chartRef.current;
    const series = mainSeriesRef.current;

    const clickHandler = (param: any) => {
      if (!param.point || !param.time) return;

      const price = series.coordinateToPrice(param.point.y);
      if (price !== null) {
        if (activeDrawingTool.toLowerCase().includes('horizontal')) {
          setHorizontalLines(prev => [...prev, price]);
        } else {
          setMarkers(prev => [
            ...prev,
            {
              time: param.time,
              position: 'aboveBar',
              color: '#2962FF',
              shape: 'arrowDown',
              text: activeDrawingTool,
            }
          ]);
        }
        setActiveDrawingTool(null);
      }
    };

    chart.subscribeClick(clickHandler);

    return () => {
      chart.unsubscribeClick(clickHandler);
    };
  }, [activeDrawingTool]);

  const handleTimeframeClick = (tf: string) => {
    setActiveTimeframe(tf);
    setIsTimeframeMenuOpen(false);
    if (onTimeframeChange) onTimeframeChange(tf);
  };

  const ActiveChartIcon = CHART_TYPES.find(t => t.id === chartType)?.icon || BarChart3;

  return (
    <div className="relative w-full h-full bg-[#0b0e14] overflow-hidden group">
      
      {/* Vertical Toolbar (Left) */}
      <div className="absolute top-1/2 -translate-y-1/2 left-2 sm:left-4 z-30 flex flex-col gap-2 bg-[#1e222d]/90 backdrop-blur-md p-1.5 rounded-lg border border-white/10 shadow-2xl">
        
        {/* Settings / Edit */}
        <button 
          onClick={() => setShowSMA(!showSMA)}
          className={`p-2 rounded-md transition-all ${showSMA ? 'text-white bg-white/10' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
          title="Toggle SMA 20"
        >
          <Settings2 size={18} />
        </button>
        
        {/* Timeframe */}
        <div className="relative">
          <button 
            onClick={() => {
              setIsTimeframeMenuOpen(!isTimeframeMenuOpen);
              setIsChartTypeMenuOpen(false);
            }}
            className={`w-full p-2 text-sm font-bold rounded-md transition-all ${isTimeframeMenuOpen ? 'text-white bg-white/10' : 'text-gray-300 hover:text-white hover:bg-white/5'}`}
          >
            {activeTimeframe}
          </button>
          
          {isTimeframeMenuOpen && (
            <div className="absolute left-full ml-2 top-0 w-32 bg-[#1e222d] border border-white/10 rounded-lg shadow-xl py-1 z-50">
              {TIMEFRAMES.map((tf) => (
                <button
                  key={tf.value}
                  onClick={() => handleTimeframeClick(tf.value)}
                  className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                    activeTimeframe === tf.value ? 'text-white bg-white/5' : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                  }`}
                >
                  {tf.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Chart Type */}
        <div className="relative">
          <button 
            onClick={() => {
              setIsChartTypeMenuOpen(!isChartTypeMenuOpen);
              setIsTimeframeMenuOpen(false);
            }}
            className={`p-2 rounded-md transition-all ${isChartTypeMenuOpen ? 'text-white bg-white/10' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
          >
            <ActiveChartIcon size={18} />
          </button>

          {isChartTypeMenuOpen && (
            <div className="absolute left-full ml-2 top-0 w-40 bg-[#1e222d] border border-white/10 rounded-lg shadow-xl py-1 z-50">
              {CHART_TYPES.map(type => (
                <button
                  key={type.id}
                  onClick={() => {
                    setChartType(type.id);
                    setIsChartTypeMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                    chartType === type.id ? 'text-white bg-white/5' : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                  }`}
                >
                  <type.icon size={16} className={chartType === type.id ? 'text-blue-500' : ''} />
                  <span className="font-medium">{type.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Indicators */}
        <button 
          onClick={() => {
            setIsIndicatorsSidebarOpen(true);
            setIsDrawingsSidebarOpen(false);
            setIsChartTypeMenuOpen(false);
            setIsTimeframeMenuOpen(false);
          }}
          className={`p-2 rounded-md transition-all ${activeIndicators.length > 0 ? 'text-white bg-blue-600' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
        >
          <Activity size={18} />
        </button>

        {/* Drawings */}
        <button 
          onClick={() => {
            setIsDrawingsSidebarOpen(true);
            setIsIndicatorsSidebarOpen(false);
            setIsChartTypeMenuOpen(false);
            setIsTimeframeMenuOpen(false);
          }}
          className={`p-2 rounded-md transition-all ${activeDrawingTool ? 'text-white bg-blue-600' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
        >
          <PenTool size={18} />
        </button>
      </div>

      {/* Bottom Right Controls (Zoom) */}
      <div className="absolute bottom-8 right-2 sm:bottom-6 sm:right-6 z-20 flex flex-col gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-300">
        <div className="flex flex-col gap-1 bg-[#1e222d]/90 backdrop-blur-md p-1 rounded-lg border border-white/10 shadow-2xl">
          <button 
            onClick={() => chartRef.current?.timeScale().applyOptions({ barSpacing: (chartRef.current?.timeScale().options().barSpacing || 10) * 1.2 })}
            className="p-1.5 sm:p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-md transition-all"
          >
            <Plus size={16} />
          </button>
          <div className="h-px w-4 sm:w-6 bg-white/10 mx-auto" />
          <button 
            onClick={() => chartRef.current?.timeScale().applyOptions({ barSpacing: (chartRef.current?.timeScale().options().barSpacing || 10) * 0.8 })}
            className="p-1.5 sm:p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-md transition-all"
          >
            <Minus size={16} />
          </button>
        </div>
        <button 
          onClick={() => chartRef.current?.timeScale().fitContent()}
          className="bg-[#1e222d]/90 backdrop-blur-md p-1.5 sm:p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg border border-white/10 shadow-2xl transition-all"
        >
          <Maximize2 size={16} />
        </button>
      </div>

      {/* Top Right Status */}
      <div className="absolute top-2 right-2 sm:top-6 sm:right-6 z-20 flex items-center gap-3 pointer-events-none">
        {activeDrawingTool && (
          <div className="bg-blue-600/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-blue-500/50 flex items-center gap-2 shadow-lg shadow-blue-900/20">
            <Pencil size={12} className="text-white" />
            <span className="text-[10px] font-bold text-white uppercase tracking-widest">
              Select point for {activeDrawingTool}
            </span>
          </div>
        )}
        <div className="bg-[#1e222d]/80 backdrop-blur-md px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg border border-white/10 flex items-center gap-1.5 sm:gap-2">
          <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
          <span className="text-[8px] sm:text-[10px] font-bold text-gray-300 uppercase tracking-widest">Market Open</span>
        </div>
      </div>

      <div ref={chartContainerRef} className={`w-full h-full ${activeDrawingTool ? 'cursor-crosshair' : ''}`} />
      
      <DrawingsSidebar 
        isOpen={isDrawingsSidebarOpen} 
        onClose={() => setIsDrawingsSidebarOpen(false)} 
        onSelectTool={setActiveDrawingTool}
      />

      <IndicatorsSidebar
        isOpen={isIndicatorsSidebarOpen}
        onClose={() => setIsIndicatorsSidebarOpen(false)}
        activeIndicators={activeIndicators}
        onSelectIndicator={(indicator) => {
          setActiveIndicators(prev => 
            prev.includes(indicator) 
              ? prev.filter(i => i !== indicator)
              : [...prev, indicator]
          );
        }}
      />
    </div>
  );
};
