import assert from 'node:assert/strict';
import test from 'node:test';

import { fetchMarketHistory } from '../web/market-provider.js';
import { defaultMarkets, marketSymbol, searchMarkets } from '../web/market-symbols.js';

test('regional listings are searchable and preserve their exchange and units on restore', async (context) => {
  context.mock.method(globalThis, 'fetch', async () => new Response('{}'));
  for (const [query, symbol, units] of [
    ['VNIndex', 'HOSE:VNINDEX', 'points'],
    ['VN Index', 'HOSE:VNINDEX', 'points'],
    ['CAC40', 'XPAR:FR0003500008', 'points'],
    ['Valeo', 'XPAR:FR0013176526', 'EUR'],
    ['FR.PA', 'XPAR:FR0013176526', 'EUR'],
    ['BEL 20', 'XBRU:BE0389555039', 'points'],
  ]) {
    const [listing] = await searchMarkets(query, []);
    assert.equal(listing.symbol, symbol);
    assert.equal(listing.currency, units);
    assert.deepEqual(marketSymbol(symbol, listing.name), listing);
  }
  assert(defaultMarkets.some(({ symbol }) => symbol === 'HOSE:VNINDEX'));
  assert(defaultMarkets.some(({ symbol }) => symbol === 'XPAR:FR0003500008'));
});

test('VN-Index candles use points while Vietnamese stocks still use dong', async (context) => {
  context.mock.method(Date, 'now', () => Date.parse('2026-11-26T13:00:00Z'));
  const request = context.mock.method(globalThis, 'fetch', async () => Response.json({
    t: [Date.parse('2026-11-26T02:00:00Z') / 1000], o: [1670], h: [1680], l: [1660], c: [1675.35],
  }));
  const index = await fetchMarketHistory('HOSE:VNINDEX');
  assert.equal(request.mock.calls[0].arguments[0], './api/markets/vietnam?symbol=VNINDEX');
  assert.deepEqual(index, {
    source: 'dnse', prices: [{ date: '2026-11-26', open: 1670, high: 1680, low: 1660, close: 1675.35 }],
  });
  const stock = await fetchMarketHistory('HOSE:FPT');
  assert.equal(request.mock.calls[1].arguments[0], './api/markets/vietnam?symbol=FPT');
  assert.equal(stock.prices[0].close, 1675350);
});

test('Euronext charts use the market-local closing cutoff and retain ordered daily closes', async (context) => {
  const parisSummerCutoff = Date.parse('2026-07-21T16:15:00Z');
  let now = parisSummerCutoff - 60_000;
  context.mock.method(Date, 'now', () => now);
  const request = context.mock.method(globalThis, 'fetch', async () => Response.json([
    { time: '2026-07-21 01:00', price: 11.065 },
    { time: '2026-07-20 01:00', price: 10.62 },
    { time: '2026-07-17 01:00', price: 10.35 },
    { time: 'bad date', price: 999 },
    { time: '2026-07-16 01:00', price: null },
  ]));
  const symbol = 'XPAR:FR0013176526';
  const beforeClose = await fetchMarketHistory(symbol);
  assert.equal(request.mock.calls[0].arguments[0], './api/markets/euronext?symbol=FR0013176526-XPAR');
  assert.deepEqual(beforeClose, {
    source: 'euronext', prices: [{ date: '2026-07-17', close: 10.35 }, { date: '2026-07-20', close: 10.62 }],
  });
  now = parisSummerCutoff;
  const atClose = await fetchMarketHistory(symbol);
  assert.deepEqual(atClose.prices.at(-1), { date: '2026-07-21', close: 11.065 });
});
