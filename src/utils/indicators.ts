export const calculateSMA = (data: any[], period: number) => {
  return data.map((d, i) => {
    if (i < period - 1) return null;
    const slice = data.slice(i - period + 1, i + 1);
    const sum = slice.reduce((acc, curr) => acc + curr.close, 0);
    return { time: d.time, value: sum / period };
  }).filter(d => d !== null);
};

export const calculateEMA = (data: any[], period: number) => {
  const k = 2 / (period + 1);
  let ema = data[0]?.close || 0;
  return data.map((d, i) => {
    if (i === 0) return { time: d.time, value: ema };
    ema = (d.close - ema) * k + ema;
    if (i < period - 1) return null;
    return { time: d.time, value: ema };
  }).filter(d => d !== null);
};

export const calculateBollingerBands = (data: any[], period: number, stdDev: number) => {
  return data.map((d, i) => {
    if (i < period - 1) return null;
    const slice = data.slice(i - period + 1, i + 1);
    const sum = slice.reduce((acc, curr) => acc + curr.close, 0);
    const sma = sum / period;
    const variance = slice.reduce((acc, curr) => acc + Math.pow(curr.close - sma, 2), 0) / period;
    const sd = Math.sqrt(variance);
    return {
      time: d.time,
      middle: sma,
      upper: sma + stdDev * sd,
      lower: sma - stdDev * sd
    };
  }).filter(d => d !== null);
};

export const calculateRSI = (data: any[], period: number) => {
  let gains = 0;
  let losses = 0;
  return data.map((d, i) => {
    if (i === 0) return null;
    const change = d.close - data[i - 1].close;
    if (i < period) {
      if (change > 0) gains += change;
      else losses -= change;
      if (i === period - 1) {
        const rs = (gains / period) / (losses / period);
        return { time: d.time, value: losses === 0 ? 100 : 100 - (100 / (1 + rs)) };
      }
      return null;
    } else {
      const avgGain = (gains * (period - 1) + (change > 0 ? change : 0)) / period;
      const avgLoss = (losses * (period - 1) + (change < 0 ? -change : 0)) / period;
      gains = avgGain;
      losses = avgLoss;
      const rs = avgGain / avgLoss;
      return { time: d.time, value: avgLoss === 0 ? 100 : 100 - (100 / (1 + rs)) };
    }
  }).filter(d => d !== null);
};

export const calculateMACD = (data: any[], fast: number, slow: number, signal: number) => {
  const fastEMA = calculateEMA(data, fast);
  const slowEMA = calculateEMA(data, slow);
  
  const macdLine = fastEMA.map((f, i) => {
    const s = slowEMA.find(x => x && x.time === f?.time);
    if (!s || !f) return null;
    return { time: f.time, value: f.value - s.value };
  }).filter(d => d !== null);

  const signalLine = calculateEMA(macdLine.map(d => ({ time: d?.time, close: d?.value })), signal);
  
  return macdLine.map(m => {
    const s = signalLine.find(x => x && x.time === m?.time);
    if (!s || !m) return null;
    return {
      time: m.time,
      macd: m.value,
      signal: s.value,
      histogram: m.value - s.value
    };
  }).filter(d => d !== null);
};
