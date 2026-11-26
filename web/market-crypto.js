import { hasCandle, validatePrices } from './market-provider.js';

const archivedPairs = new Set(['BTC-USD', 'ETH-USD', 'SOL-USD', 'PAXG-USD']);
const dayLength = 86400000;

async function readCrypto(symbol, source, signal) {
  const query = new URLSearchParams({ symbol, source });
  const response = await fetch(`./api/markets/crypto?${query}`, {
    signal, cache: 'no-store', headers: { 'X-SmartBot-Market': 'daily' },
  });
  if (!response.ok) throw new Error('Cryptocurrency prices are unavailable.');
  return response;
}

export async function fetchCryptoQuote(symbol, signal) {
  const response = await readCrypto(symbol, 'bitstamp-ticker', signal);
  const { last, timestamp } = await response.json();
  const price = typeof last === 'string' ? Number(last) : NaN;
  const time = typeof timestamp === 'string' ? Number(timestamp) * 1000 : NaN;
  if (!Number.isFinite(price) || price <= 0 || price > 1e9
    || !Number.isSafeInteger(time) || time <= 0 || time > 8.64e15) {
    throw new Error('The cryptocurrency quote was incomplete.');
  }
  return { price, time };
}

async function livePrices(symbol, signal) {
  const response = await readCrypto(symbol, 'bitstamp', signal);
  const { data } = await response.json();
  if (data?.pair?.replace('/', '-') !== symbol || !Array.isArray(data.ohlc)) {
    throw new Error('The cryptocurrency pair was not found.');
  }
  const candles = data.ohlc.map(({ timestamp, close, open, high, low }) => [
    new Date(Number(timestamp) * 1000).toISOString().slice(0, 10), Number(close), Number(open), Number(high), Number(low),
  ]);
  return { prices: dailyPrices(symbol, candles), source: 'bitstamp' };
}

async function archivedPrices(symbol, signal) {
  const response = await readCrypto(symbol, 'archive', signal);
  if (symbol === 'BTC-USD') {
    const [header, ...lines] = (await response.text()).trim().split(/\r?\n/);
    if (!header.startsWith('date_utc,open,high,low,close,')) throw new Error('Invalid Bitcoin archive.');
    const candles = lines.map(line => {
      const [date, open, high, low, close] = line.split(',');
      return [date, Number(close), Number(open), Number(high), Number(low)];
    });
    return { prices: dailyPrices(symbol, candles), source: 'bitcoinArchive' };
  }
  const { series, fetched_at: fetchedAt } = await response.json();
  const cutoff = new Date(fetchedAt).toISOString().slice(0, 10);
  const candles = series[symbol.replace('-', '_').toLowerCase()];
  return { prices: dailyPrices(symbol, candles, cutoff), source: 'coinbaseArchive' };
}

function dailyPrices(symbol, candles, cutoff = new Date().toISOString().slice(0, 10)) {
  const today = new Date().toISOString().slice(0, 10);
  const prices = candles.filter(([date, close]) => date < cutoff && date < today && close > 0)
    .map(([date, close, open, high, low]) => hasCandle({ open, high, low, close })
      ? { date, close, open, high, low } : { date, close })
    .sort((a, b) => a.date.localeCompare(b.date)).slice(-400);
  return validatePrices({ symbol, prices }, symbol);
}

export async function cryptoHistory(symbol, signal) {
  let archived;
  if (archivedPairs.has(symbol)) {
    try {
      archived = await archivedPrices(symbol, signal);
      const lastClosedDate = new Date(Date.now() - dayLength).toISOString().slice(0, 10);
      if (archived.prices.at(-1).date === lastClosedDate && hasCandle(archived.prices.at(-1))) return archived;
    } catch (error) {
      if (signal?.aborted) throw error;
    }
  }
  try {
    const live = await livePrices(symbol, signal);
    if (!archived) return live;
    const current = live.prices.at(-1);
    const saved = archived.prices.at(-1);
    return current.date > saved.date
      || (current.date === saved.date && hasCandle(current) && !hasCandle(saved)) ? live : archived;
  } catch (error) {
    if (!archived || signal?.aborted) throw error;
    return archived;
  }
}
