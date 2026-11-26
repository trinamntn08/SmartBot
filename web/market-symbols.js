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
  ['HOSE:VNINDEX'],
  ['XPAR:FR0003500008'],
];
const cryptoNames = [
  ['ETH', 'Ethereum'], ['SOL', 'Solana'], ['XRP', 'XRP'], ['DOGE', 'Dogecoin'], ['ADA', 'Cardano'],
  ['AVAX', 'Avalanche'], ['LINK', 'Chainlink'], ['LTC', 'Litecoin'], ['BCH', 'Bitcoin Cash'],
  ['DOT', 'Polkadot'], ['PAXG', 'PAX Gold'], ['SHIB', 'Shiba Inu'], ['UNI', 'Uniswap'],
];
const equitySymbol = /^[A-Z][A-Z0-9]{0,8}(?:-[A-Z])?$/;
const cryptoSymbol = /^[A-Z0-9]{2,12}-USD$/;
const vietnamSymbol = /^(HOSE|HNX|UPCOM):([A-Z0-9]{3})$/;
const euronextVenues = { XPAR: 'Paris', XAMS: 'Amsterdam', XBRU: 'Brussels', XLIS: 'Lisbon' };
const euronextListings = [
  ['XPAR', 'FR0003500008', 'PX1', 'CAC 40', 'points', 'CAC40', '^FCHI'],
  ['XPAR', 'FR0003999481', 'PX4', 'SBF 120', 'points', 'SBF120'],
  ['XAMS', 'NL0000000107', 'AEX', 'AEX Index', 'points'],
  ['XBRU', 'BE0389555039', 'BEL20', 'BEL 20', 'points'],
  ['XLIS', 'PTING0200002', 'PSI20', 'PSI Index', 'points', 'PSI', 'PSI 20'],
  ['XPAR', 'FR0013176526', 'FR', 'Valeo', 'EUR', 'FR.PA'],
  ['XPAR', 'NL0000235190', 'AIR', 'Airbus', 'EUR', 'AIR.PA'],
  ['XPAR', 'FR0000121014', 'MC', 'LVMH', 'EUR', 'MC.PA'],
  ['XPAR', 'FR0000120578', 'SAN', 'Sanofi', 'EUR', 'SAN.PA'],
  ['XPAR', 'FR0000120271', 'TTE', 'TotalEnergies', 'EUR', 'TTE.PA'],
  ['XAMS', 'NL0010273215', 'ASML', 'ASML Holding', 'EUR', 'ASML.AS'],
  ['XBRU', 'BE0974293251', 'ABI', 'AB InBev', 'EUR', 'ABI.BR', 'Anheuser-Busch InBev'],
  ['XLIS', 'PTEDP0AM0009', 'EDP', 'EDP Energias de Portugal', 'EUR', 'EDP.LS'],
].map(([venue, isin, label, name, currency, ...aliases]) => {
  const euronextCode = `${isin}-${venue}`;
  const type = currency === 'points' ? 'indices' : 'equities';
  return {
    symbol: `${venue}:${isin}`, label, name, currency,
    market: `Euronext ${euronextVenues[venue]}`, tradingView: `EURONEXT-${label}`,
    euronextCode, sourceUrl: `https://live.euronext.com/en/product/${type}/${euronextCode}`,
    aliases: [isin, `${venue}:${label}`, euronextVenues[venue], ...aliases],
  };
});
const vnIndex = {
  symbol: 'HOSE:VNINDEX', label: 'VNINDEX', name: 'VN-Index', currency: 'points',
  market: 'HOSE index', tradingView: 'HOSE-VNINDEX', aliases: ['VN Index', 'Vietnam Index'],
};
const regionalMarkets = new Map([vnIndex, ...euronextListings].map(listing => [listing.symbol, listing]));

export function marketSymbol(symbol, name = symbol, exchange = '') {
  if (typeof symbol !== 'string' || typeof name !== 'string' || !name.trim() || name.length > 160) return null;
  if (regionalMarkets.has(symbol)) return regionalMarkets.get(symbol);
  const crypto = cryptoSymbol.test(symbol);
  const vietnam = vietnamSymbol.exec(symbol);
  if (!crypto && !vietnam && !equitySymbol.test(symbol)) return null;
  const label = vietnam ? vietnam[2] : crypto ? symbol.replace('-', '/') : symbol;
  if (vietnam) exchange = vietnam[1];
  return {
    symbol, name, label, currency: vietnam ? 'VND' : 'USD',
    market: crypto ? 'Crypto' : exchange || 'U.S. stock or ETF',
    tradingView: crypto ? `BITSTAMP-${symbol.replace('-', '')}` : [exchange, label.replace('-', '.')].filter(Boolean).join('-'),
  };
}

export const defaultMarkets = Object.freeze(starters.map(args => marketSymbol(...args)));
const knownCrypto = cryptoNames.map(([symbol, name]) => marketSymbol(`${symbol}-USD`, name));
const catalogs = new Map();

async function equityCatalog(file) {
  if (!catalogs.has(file)) {
    const request = fetch(`./assets/${file}`).then(async response => {
      if (!response.ok) throw new Error('Market symbol list unavailable.');
      return Object.entries(await response.json()).flatMap(([symbol, entry]) => {
        const [name, ...aliases] = Array.isArray(entry) ? entry : [entry];
        const listing = marketSymbol(symbol, name);
        return listing ? [{ ...listing, aliases }] : [];
      });
    }).catch(() => {
      catalogs.delete(file);
      return [];
    });
    catalogs.set(file, request);
  }
  return catalogs.get(file);
}

function normalizeSearch(text) {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toUpperCase().replaceAll('Đ', 'D');
}

export async function searchMarkets(text, saved) {
  const query = normalizeSearch(text.trim());
  if (!query) return [];
  const typedPair = /^([A-Z0-9]{2,12})(?:[-/]|\s+)?USD$/.exec(query);
  const symbolQuery = typedPair ? `${typedPair[1]}-USD` : query.replace('.', '-');
  const [us, vietnam] = await Promise.all([
    equityCatalog('market-catalog.json'), equityCatalog('market-vietnam-catalog.json'),
  ]);
  const savedBySymbol = new Map(saved.map(listing => [listing.symbol, listing]));
  const available = [...defaultMarkets, ...euronextListings, ...knownCrypto, ...us, ...vietnam, ...saved];
  const matches = [];
  const seen = new Set();
  for (const listing of available) {
    if (seen.has(listing.symbol)) continue;
    seen.add(listing.symbol);
    const names = [listing.name, ...(listing.aliases ?? [])].map(normalizeSearch);
    const base = listing.label.replace(/\/USD$/, '');
    const rank = listing.symbol === symbolQuery || base === symbolQuery ? 0 : names.includes(query) ? 1
      : listing.symbol.startsWith(symbolQuery) || base.startsWith(symbolQuery) ? 2
      : names.some(name => name.startsWith(query)) ? 3
      : names.some(name => name.includes(query)) ? 4 : -1;
    if (rank >= 0) matches.push({ listing: savedBySymbol.get(listing.symbol) ?? listing, rank });
  }
  if (typedPair && !seen.has(symbolQuery)) {
    const listing = marketSymbol(symbolQuery, symbolQuery.replace('-', '/'));
    matches.push({ listing, rank: 0 });
  }
  return matches.sort((a, b) => a.rank - b.rank).slice(0, 7).map(({ listing }) => listing);
}
