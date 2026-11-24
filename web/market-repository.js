import { validatePrices } from './market-provider.js';

const prefix = 'smartbot-market:';
const cacheDuration = 30 * 60 * 1000;

export const marketRepository = {
  get(symbol) {
    try {
      const saved = JSON.parse(localStorage.getItem(prefix + symbol));
      return {
        prices: validatePrices(saved, symbol),
        fresh: Number.isFinite(saved.savedAt) && Date.now() - saved.savedAt < cacheDuration,
      };
    } catch {
      return null;
    }
  },
  save(symbol, prices) {
    try {
      localStorage.setItem(prefix + symbol, JSON.stringify({ symbol, prices, savedAt: Date.now() }));
    } catch {
      // The current chart is still available when browser storage is blocked.
    }
  },
};
