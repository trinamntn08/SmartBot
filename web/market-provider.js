export function validatePrices(data, symbol) {
  if (!data || data.symbol !== symbol || !Array.isArray(data.prices) || !data.prices.length || data.prices.length > 400) {
    throw new Error('The market data response was incomplete.');
  }
  let previous = '';
  for (const price of data.prices) {
    if (typeof price?.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(price.date)
      || !Number.isFinite(Date.parse(price.date)) || price.date <= previous
      || !Number.isFinite(price.close) || price.close <= 0 || price.close > 1e9) {
      throw new Error('The market data response was incomplete.');
    }
    previous = price.date;
  }
  return data.prices;
}

export async function fetchMarketHistory(symbol, signal) {
  if (symbol.endsWith('-USD')) {
    const { cryptoHistory } = await import('./market-crypto.js');
    return cryptoHistory(symbol, signal);
  }
  const { archivePrices } = await import('./market-archive.js');
  const prices = await archivePrices(symbol, signal);
  return { prices: validatePrices({ symbol, prices }, symbol), source: 'archive' };
}

export async function fetchPrices(symbol, signal) {
  if (navigator.onLine === false) throw new Error('You’re offline.');
  if (location.protocol !== 'http:' || !['localhost', '127.0.0.1'].includes(location.hostname)) {
    throw new Error('Open the local SmartBot browser preview to load market prices.');
  }

  const query = new URLSearchParams({ symbol });
  const response = await fetch(`./api/markets/daily?${query}`, {
    signal, cache: 'no-store', headers: { 'X-SmartBot-Market': 'daily' },
  });
  if (response.status === 404) throw new Error('Restart the local SmartBot preview to load market prices.');
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Market prices could not be loaded.');
  return validatePrices(data, symbol);
}
