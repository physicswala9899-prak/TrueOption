import { useEffect, useRef, useState } from 'react';

export interface OHLCData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export function usePriceFeed(asset: string = 'BTCUSDT', interval: string = '1m') {
  const [price, setPrice] = useState<number | null>(null);
  const [history, setHistory] = useState<OHLCData[]>([]);
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    const symbol = asset.toLowerCase();
    const symbolUpper = asset.toUpperCase();
    setHistory([]);
    setPrice(null);

    let isMounted = true;

    // Fetch historical data first
    const fetchHistory = async () => {
      try {
        const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbolUpper}&interval=${interval}&limit=200`);
        const data = await res.json();
        
        if (!isMounted) return;

        const formattedData: OHLCData[] = data.map((d: any) => ({
          time: Math.floor(d[0] / 1000),
          open: parseFloat(d[1]),
          high: parseFloat(d[2]),
          low: parseFloat(d[3]),
          close: parseFloat(d[4]),
        }));

        setHistory(formattedData);
        if (formattedData.length > 0) {
          setPrice(formattedData[formattedData.length - 1].close);
        }

        // Connect WebSocket after history is loaded
        connectWebSocket();
      } catch (err) {
        console.error('Failed to fetch historical data:', err);
        if (isMounted) connectWebSocket(); // Fallback to WS only
      }
    };

    const connectWebSocket = () => {
      const url = `wss://stream.binance.com:9443/ws/${symbol}@kline_${interval}`;
      ws.current = new WebSocket(url);

      ws.current.onmessage = (event) => {
        const data = JSON.parse(event.data);
        const k = data.k; // Kline data
        
        const newPrice = parseFloat(k.c); // Close price
        const timestamp = Math.floor(k.t / 1000); // Kline start time

        setPrice(newPrice);
        
        setHistory((prev) => {
          const newData: OHLCData = {
            time: timestamp,
            open: parseFloat(k.o),
            high: parseFloat(k.h),
            low: parseFloat(k.l),
            close: parseFloat(k.c),
          };

          if (prev.length === 0) return [newData];

          const lastEntry = prev[prev.length - 1];
          
          if (lastEntry.time === timestamp) {
            const updated = [...prev];
            updated[updated.length - 1] = newData;
            return updated;
          }
          if (timestamp < lastEntry.time) {
            // Ignore out-of-order data
            return prev;
          }

          const updated = [...prev, newData].slice(-200);
          return updated;
        });
      };

      ws.current.onerror = (error) => {
        console.error('WebSocket Error:', error);
      };
    };

    fetchHistory();

    return () => {
      isMounted = false;
      if (ws.current) ws.current.close();
    };
  }, [asset, interval]);

  return { price, history };
}
