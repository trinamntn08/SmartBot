import { hasCandle, validatePrices } from './market-provider.js';

const hour = 3600000;

export async function vietnamHistory(symbol, signal) {
  const ticker = symbol.split(':')[1];
  const scale = ticker === 'VNINDEX' ? 1 : 1000;
  const query = new URLSearchParams({ symbol: ticker });
  const response = await fetch(`./api/markets/vietnam?${query}`, {
    signal, cache: 'no-store', headers: { 'X-SmartBot-Market': 'daily' },
  });
  if (!response.ok) throw new Error('Vietnamese market prices are unavailable.');
  const { t, o, h, l, c } = await response.json();
  if (![t, o, h, l, c].every(values => Array.isArray(values) && values.length === t.length)
      || t.length > 400) {
    throw new Error('The Vietnamese market history response was incomplete.');
  }
  // Vietnam uses UTC+7. Exclude the current session until the 15:00 local close.
  const latestClosedDate = new Date(Date.now() - 8 * hour).toISOString().slice(0, 10);
  const prices = t.flatMap((timestamp, index) => {
    const tradingDay = new Date(timestamp * 1000 + 7 * hour);
    if (!Number.isFinite(timestamp) || timestamp <= 0 || !Number.isFinite(tradingDay.getTime())) return [];
    const date = tradingDay.toISOString().slice(0, 10);
    if (date > latestClosedDate) return [];
    // Stocks are quoted in thousands of dong. Index levels are already in points.
    const [open, high, low, close] = [o[index], h[index], l[index], c[index]].map(value => Number(value) * scale);
    if (!Number.isFinite(close) || close <= 0 || close > 1e9) return [];
    return [hasCandle({ open, high, low, close }) ? { date, close, open, high, low } : { date, close }];
  }).sort((a, b) => a.date.localeCompare(b.date));
  return { prices: validatePrices({ symbol, prices }, symbol), source: 'dnse' };
}
