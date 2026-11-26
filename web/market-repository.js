import { validatePrices } from './market-provider.js';
import { defaultMarkets, marketSymbol } from './market-symbols.js';

const prefix = 'smartbot-market:';
const cacheDuration = 4 * 60 * 60 * 1000;
const watchlistKey = 'smartbot-market-watchlist';
const chartKey = 'smartbot-market-chart';
const openKey = 'smartbot-markets-open';
const sources = new Set(['archive', 'dolthub', 'alphaVantage', 'bitstamp', 'bitcoinArchive', 'coinbaseArchive', 'dnse', 'euronext']);
const defaults = new Set(defaultMarkets.map(({ symbol }) => symbol));
let snapshot;

function readWatchlist() {
  try {
    const value = JSON.parse(localStorage.getItem(watchlistKey));
    const added = Array.isArray(value) ? value : value?.added;
    return {
      added: Array.isArray(added) ? added : [],
      removed: Array.isArray(value?.removed) ? value.removed : [],
    };
  } catch {
    return { added: [], removed: [] };
  }
}

export const marketRepository = {
  wasOpen() {
    try {
      return localStorage.getItem(openKey) === '1';
    } catch {
      return false;
    }
  },
  setOpen(open) {
    try {
      if (open) localStorage.setItem(openKey, '1');
      else localStorage.removeItem(openKey);
    } catch {
      // The chart remains usable when browser storage is blocked.
    }
  },
  lastChart() {
    try {
      return JSON.parse(localStorage.getItem(chartKey));
    } catch {
      return null;
    }
  },
  saveChart(symbol, range, style) {
    try {
      localStorage.setItem(chartKey, JSON.stringify({ symbol, range, style }));
    } catch {
      // The chart remains usable when browser storage is blocked.
    }
  },
  watchlist() {
    const { added, removed } = readWatchlist();
    const hidden = new Set(removed);
    const seen = new Set(defaults);
    const custom = added.flatMap(entry => {
      const listing = marketSymbol(entry?.symbol, entry?.name);
      if (!listing || seen.has(listing.symbol)) return [];
      seen.add(listing.symbol);
      return [listing];
    });
    return [...defaultMarkets.filter(({ symbol }) => !hidden.has(symbol)), ...custom];
  },
  setSaved(listing, saved) {
    const { added, removed } = readWatchlist();
    const { symbol, name } = listing;
    const preferences = { added, removed };
    if (defaults.has(symbol)) {
      preferences.removed = removed.filter(entry => entry !== symbol);
      if (!saved) preferences.removed.push(symbol);
    } else {
      preferences.added = added.filter(entry => entry?.symbol !== symbol);
      if (saved) preferences.added.push({ symbol, name });
    }
    try {
      localStorage.setItem(watchlistKey, JSON.stringify(preferences));
      return true;
    } catch {
      return false;
    }
  },
  get(symbol) {
    try {
      const saved = JSON.parse(localStorage.getItem(prefix + symbol));
      return {
        prices: validatePrices(saved, symbol),
        source: sources.has(saved.source) ? saved.source : 'alphaVantage',
        fresh: Number.isFinite(saved.savedAt) && Date.now() - saved.savedAt < cacheDuration,
      };
    } catch {
      return null;
    }
  },
  async bundled(symbol) {
    try {
      snapshot ??= fetch('./assets/market-closes.json').then((response) => {
        if (!response.ok) throw new Error('Included market history unavailable.');
        return response.json();
      });
      const data = await snapshot;
      if (!Object.hasOwn(data.series, symbol)) return null;
      const prices = validatePrices({ symbol, prices: data.series[symbol] }, symbol);
      const bitcoin = symbol === 'BTC-USD';
      if (prices.at(-1).date !== (bitcoin ? data.bitcoinAsOf : data.asOf)) {
        throw new Error('Included market history is incomplete.');
      }
      return { prices, source: bitcoin ? 'bitcoinArchive' : 'archive', bundled: true };
    } catch {
      snapshot = undefined;
      return null;
    }
  },
  save(symbol, prices, source) {
    try {
      localStorage.setItem(prefix + symbol, JSON.stringify({ symbol, prices, source, savedAt: Date.now() }));
    } catch {
      // The current chart is still available when browser storage is blocked.
    }
  },
};
