import { validatePrices } from './market-provider.js';

const prefix = 'smartbot-market:';
const cacheDuration = 4 * 60 * 60 * 1000;
const sources = new Set(['archive', 'dolthub', 'alphaVantage']);
let snapshot;

export const marketRepository = {
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
      const prices = validatePrices({ symbol, prices: data.series[symbol] }, symbol);
      if (prices.at(-1).date !== data.asOf) throw new Error('Included market history is incomplete.');
      return { prices, source: 'archive', bundled: true };
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
