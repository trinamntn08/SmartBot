import { fetchPrices } from './market-provider.js';
import { marketRepository } from './market-repository.js';

const listings = [
  ['SPY', 'S&P 500 ETF'],
  ['QQQ', 'Nasdaq-100 ETF'],
  ['AAPL', 'Apple'],
  ['AMZN', 'Amazon'],
  ['GOOGL', 'Alphabet'],
  ['MSFT', 'Microsoft'],
  ['NVDA', 'Nvidia'],
  ['TSLA', 'Tesla'],
];
const dollars = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' });
const percent = new Intl.NumberFormat(undefined, {
  style: 'percent', signDisplay: 'exceptZero', maximumFractionDigits: 2,
});
const dates = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: 'UTC' });
const dayLength = 24 * 60 * 60 * 1000;

function priceChart(series, days) {
  const last = series.at(-1);
  const end = Date.parse(last.date);
  const prices = series.filter(({ date }) => Date.parse(date) > end - days * dayLength);
  const first = prices[0];
  const start = Date.parse(first.date);
  const closes = prices.map(({ close }) => close);
  const low = Math.min(...closes);
  const high = Math.max(...closes);
  const padding = Math.max((high - low) * 0.08, high * 0.001, 0.01);
  const floor = Math.max(0, low - padding);
  const ceiling = high + padding;
  const ticks = Array.from({ length: 5 }, (_, index) => ceiling - (ceiling - floor) * index / 4);
  const points = prices.map(({ date, close }) => {
    const x = end === start ? 300 : 2 + 596 * (Date.parse(date) - start) / (end - start);
    const y = 4 + 192 * (ceiling - close) / (ceiling - floor);
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });
  const [lastX, lastY] = points.at(-1).split(',');
  return `<div class="market-quote">
      <strong>${dollars.format(last.close)}</strong>
      ${prices.length > 1 ? `<span>${percent.format(last.close / first.close - 1)} over this period</span>` : ''}
      <p>Closing price on <time datetime="${last.date}">${dates.format(end)}</time></p>
    </div>
    <div class="market-graph" aria-hidden="true">
      <div class="market-axis">${ticks.map((tick) => `<span>${dollars.format(tick)}</span>`).join('')}</div>
      <svg viewBox="0 0 600 200" preserveAspectRatio="none" focusable="false">
        ${ticks.map((_, index) => `<line x1="0" x2="600" y1="${4 + 48 * index}" y2="${4 + 48 * index}"/>`).join('')}
        <polyline points="${points.join(' ')}"/>
        <path d="M ${lastX},${lastY} h 0"/>
      </svg>
      <div class="market-dates"><span>${dates.format(start)}</span>${start === end ? '' : `<span>${dates.format(end)}</span>`}</div>
    </div>
    <details>
      <summary>Daily closing prices</summary>
      <table class="market-table">
        <thead><tr><th scope="col">Date</th><th scope="col">Price (USD)</th></tr></thead>
        <tbody>${prices.slice().reverse().map(({ date, close }) => `<tr>
          <td><time datetime="${date}">${dates.format(Date.parse(date))}</time></td>
          <td>${dollars.format(close)}</td></tr>`).join('')}</tbody>
      </table>
    </details>`;
}

export function renderMarkets(view, focusHeading) {
  view.innerHTML = `<a class="back-link" href="#workspace"><span class="arrow" aria-hidden="true"></span>Workspace</a>
    <h1 tabindex="-1">Markets</h1>
    <section class="card market-panel" aria-label="Market prices">
      <div class="market-controls">
        <label>Stock or ETF
          <select name="symbol">${listings.map(([symbol, name]) => `<option value="${symbol}">${symbol} · ${name}</option>`).join('')}</select>
        </label>
        <label>Period
          <select name="period"><option value="30">30 days</option><option value="90">90 days</option></select>
        </label>
        <button type="button" class="quiet market-refresh">Refresh prices</button>
      </div>
      <p class="market-status muted" role="status"></p>
      <div class="market-result"></div>
      <p class="market-source muted">Unadjusted daily closes in USD from <a href="https://www.alphavantage.co/">Alpha Vantage</a>.</p>
    </section>`;
  const panel = view.querySelector('.market-panel');
  const symbol = panel.querySelector('[name="symbol"]');
  const period = panel.querySelector('[name="period"]');
  const refresh = panel.querySelector('button');
  const status = panel.querySelector('[role="status"]');
  const result = panel.querySelector('.market-result');
  let prices;
  let request;

  function updateChart() {
    const wasOpen = result.querySelector('details')?.open;
    result.innerHTML = prices ? priceChart(prices, Number(period.value)) : '';
    if (wasOpen && prices) result.querySelector('details').open = true;
  }

  async function load(force = false) {
    request?.abort();
    const controller = new AbortController();
    request = controller;
    const selected = symbol.value;
    const saved = marketRepository.get(selected);
    if (!force || !prices) prices = saved?.prices;
    updateChart();
    refresh.disabled = false;
    status.textContent = '';
    if (navigator.onLine === false) {
      status.textContent = prices ? 'Showing saved prices while offline.' : 'Connect to load prices for this symbol.';
      return;
    }
    if (!force && saved?.fresh) return;

    refresh.disabled = true;
    status.textContent = prices ? `Refreshing ${selected} prices…` : `Loading ${selected} prices…`;
    try {
      const latest = await fetchPrices(selected, controller.signal);
      if (controller.signal.aborted) return;
      prices = latest;
      marketRepository.save(selected, prices);
      updateChart();
      status.textContent = `${selected} prices loaded.`;
    } catch (error) {
      if (controller.signal.aborted) return;
      const message = error instanceof TypeError || error instanceof SyntaxError
        ? 'Market prices could not be loaded. Try again.' : error.message;
      status.textContent = prices ? `Showing saved prices. ${message}` : message;
    } finally {
      if (!controller.signal.aborted) refresh.disabled = false;
    }
  }

  symbol.addEventListener('change', () => void load());
  period.addEventListener('change', updateChart);
  refresh.addEventListener('click', () => void load(true));
  if (focusHeading) view.querySelector('h1').focus();
  void load();
  return () => request?.abort();
}
