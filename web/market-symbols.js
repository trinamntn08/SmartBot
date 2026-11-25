const starters = [
  ['SPY', 'S&P 500 ETF', 'AMEX'],
  ['QQQ', 'Nasdaq-100 ETF', 'NASDAQ'],
  ['AAPL', 'Apple', 'NASDAQ'],
  ['AMZN', 'Amazon', 'NASDAQ'],
  ['GOOGL', 'Alphabet', 'NASDAQ'],
  ['MSFT', 'Microsoft', 'NASDAQ'],
  ['NVDA', 'NVIDIA', 'NASDAQ'],
  ['TSLA', 'Tesla', 'NASDAQ'],
  ['BTC-USD', 'Bitcoin'],
];
const cryptoNames = [
  ['ETH', 'Ethereum'], ['SOL', 'Solana'], ['XRP', 'XRP'], ['DOGE', 'Dogecoin'], ['ADA', 'Cardano'],
  ['AVAX', 'Avalanche'], ['LINK', 'Chainlink'], ['LTC', 'Litecoin'], ['BCH', 'Bitcoin Cash'],
  ['DOT', 'Polkadot'], ['PAXG', 'PAX Gold'], ['SHIB', 'Shiba Inu'], ['UNI', 'Uniswap'],
];
const equitySymbol = /^[A-Z][A-Z0-9]{0,8}(?:-[A-Z])?$/;
const cryptoSymbol = /^[A-Z0-9]{2,12}-USD$/;

export function marketSymbol(symbol, name = symbol, exchange = '') {
  const crypto = typeof symbol === 'string' && cryptoSymbol.test(symbol);
  if (typeof symbol !== 'string' || (!crypto && !equitySymbol.test(symbol))
      || typeof name !== 'string' || !name.trim() || name.length > 160) return null;
  return {
    symbol, name, exchange, label: crypto ? symbol.replace('-', '/') : symbol,
    market: crypto ? 'Crypto' : exchange || 'U.S. stock or ETF',
    tradingView: crypto ? `BITSTAMP-${symbol.replace('-', '')}` : [exchange, symbol.replace('-', '.')].filter(Boolean).join('-'),
  };
}

export const defaultMarkets = Object.freeze(starters.map(args => marketSymbol(...args)));
const knownCrypto = cryptoNames.map(([symbol, name]) => marketSymbol(`${symbol}-USD`, name));
let catalog;

async function equityCatalog() {
  try {
    catalog ??= fetch('./assets/market-catalog.json').then(async response => {
      if (!response.ok) throw new Error('Market symbol list unavailable.');
      return Object.entries(await response.json()).map(args => marketSymbol(...args)).filter(Boolean);
    });
    return await catalog;
  } catch {
    catalog = undefined;
    return [];
  }
}

export async function searchMarkets(text, saved) {
  const query = text.trim().toUpperCase();
  if (!query) return [];
  const typedPair = /^([A-Z0-9]{2,12})(?:[-/]|\s+)?USD$/.exec(query);
  const symbolQuery = typedPair ? `${typedPair[1]}-USD` : query.replace('.', '-');
  const available = [...defaultMarkets, ...saved, ...knownCrypto, ...await equityCatalog()];
  const matches = [];
  const seen = new Set();
  for (const listing of available) {
    if (seen.has(listing.symbol)) continue;
    seen.add(listing.symbol);
    const name = listing.name.toUpperCase();
    const base = listing.symbol.replace(/-USD$/, '');
    const rank = listing.symbol === symbolQuery || base === symbolQuery ? 0 : name === query ? 1
      : listing.symbol.startsWith(symbolQuery) ? 2 : name.startsWith(query) ? 3
      : name.includes(query) ? 4 : -1;
    if (rank >= 0) matches.push({ listing, rank });
  }
  if (typedPair && !seen.has(symbolQuery)) {
    const listing = marketSymbol(symbolQuery, symbolQuery.replace('-', '/'));
    matches.push({ listing, rank: 0 });
  }
  return matches.sort((a, b) => a.rank - b.rank).slice(0, 7).map(({ listing }) => listing);
}
