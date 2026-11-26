import { validatePrices } from './market-provider.js';

const parisClock = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

function latestClosedDay(now) {
  const { year, month, day, hour, minute } = Object.fromEntries(
    parisClock.formatToParts(now).map(({ type, value }) => [type, value]),
  );
  // Delayed data can include an intraday point labeled with today's date.
  const includeToday = Number(hour) * 60 + Number(minute) >= 18 * 60 + 15;
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day) - (includeToday ? 0 : 1)))
    .toISOString().slice(0, 10);
}

export async function euronextHistory(symbol, code, signal) {
  const query = new URLSearchParams({ symbol: code });
  const response = await fetch(`./api/markets/euronext?${query}`, {
    signal, cache: 'no-store', headers: { 'X-SmartBot-Market': 'daily' },
  });
  if (!response.ok) throw new Error('Euronext market prices are unavailable.');
  const rows = await response.json();
  if (!Array.isArray(rows)) throw new Error('The Euronext market history response was incomplete.');
  const lastDay = latestClosedDay(Date.now());
  const closes = new Map();
  for (const row of rows) {
    const date = typeof row?.time === 'string' && /^(\d{4}-\d{2}-\d{2}) \d{2}:\d{2}$/.exec(row.time)?.[1];
    if (date && date <= lastDay && Number.isFinite(row.price) && row.price > 0 && row.price <= 1e9) {
      closes.set(date, { date, close: row.price });
    }
  }
  const prices = [...closes.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(-400);
  return { prices: validatePrices({ symbol, prices }, symbol), source: 'euronext' };
}
