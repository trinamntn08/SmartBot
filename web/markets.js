import { fetchMarketHistory, fetchPrices, mountPriceWidget } from './market-provider.js';
import { marketRepository } from './market-repository.js';

const listings = [
  ['AMEX:SPY', 'S&P 500 ETF'],
  ['NASDAQ:QQQ', 'Nasdaq-100 ETF'],
  ['NASDAQ:AAPL', 'Apple'],
  ['NASDAQ:AMZN', 'Amazon'],
  ['NASDAQ:GOOGL', 'Alphabet'],
  ['NASDAQ:MSFT', 'Microsoft'],
  ['NASDAQ:NVDA', 'Nvidia'],
  ['NASDAQ:TSLA', 'Tesla'],
];
const dollars = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' });
const percent = new Intl.NumberFormat(undefined, {
  style: 'percent', signDisplay: 'exceptZero', maximumFractionDigits: 2,
});
const dates = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: 'UTC' });
const dayLength = 24 * 60 * 60 * 1000;
const historySources = {
  dolthub: ['post-no-preference on DoltHub', 'https://www.dolthub.com/repositories/post-no-preference/stocks'],
  alphaVantage: ['Alpha Vantage', 'https://www.alphavantage.co/'],
};

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
    <div class="market-heading">
      <h1 tabindex="-1">Markets</h1>
      <label class="market-ticker">Stock or ETF
        <select name="symbol">${listings.map(([symbol, name]) => `<option value="${symbol}">${symbol.split(':')[1]} · ${name}</option>`).join('')}</select>
      </label>
    </div>
    <section class="card market-panel" aria-label="Market prices">
      <div class="market-widget"></div>
      <p class="market-status muted" role="status"></p>
      <div class="market-history" hidden>
        <label class="market-period">Period
          <select name="period"><option value="30">1 month</option><option value="90">3 months</option><option value="365">1 year</option></select>
        </label>
        <div class="market-result"></div>
        <p class="market-source muted">Daily closes in USD · <a></a></p>
      </div>
      <div class="market-footer">
        <p><a class="market-link" rel="nofollow">TradingView</a><span class="market-delay"> · Prices may be delayed</span></p>
        <button class="quiet" type="button" hidden>Retry chart</button>
      </div>
    </section>`;
  const panel = view.querySelector('.market-panel');
  const ticker = view.querySelector('[name="symbol"]');
  const period = panel.querySelector('[name="period"]');
  const widget = panel.querySelector('.market-widget');
  const history = panel.querySelector('.market-history');
  const retry = panel.querySelector('button');
  const status = panel.querySelector('[role="status"]');
  const result = panel.querySelector('.market-result');
  const historyLink = history.querySelector('a');
  const link = panel.querySelector('.market-link');
  const delay = panel.querySelector('.market-delay');
  const theme = matchMedia('(prefers-color-scheme: dark)');
  let prices;
  let request;

  function updateChart() {
    const wasOpen = result.querySelector('details')?.open;
    result.innerHTML = prices ? priceChart(prices, Number(period.value)) : '';
    if (wasOpen && prices) result.querySelector('details').open = true;
  }

  function showHistory(record, message = '') {
    prices = record.prices;
    const [label, url] = historySources[record.source];
    historyLink.textContent = label;
    historyLink.href = url;
    link.parentElement.hidden = true;
    status.textContent = message;
    history.hidden = false;
    updateChart();
  }

  async function load(force = false) {
    request?.abort();
    const controller = new AbortController();
    request = controller;
    const { signal } = controller;
    const selected = ticker.value.split(':')[1];
    const saved = marketRepository.get(selected);
    prices = undefined;
    widget.replaceChildren();
    widget.hidden = true;
    retry.hidden = true;
    history.hidden = true;
    delay.hidden = false;
    link.parentElement.hidden = true;
    link.href = `https://www.tradingview.com/symbols/${ticker.value.replace(':', '-')}/`;
    const online = navigator.onLine !== false;
    const savedMessage = 'Showing saved closing prices.';
    if (saved) showHistory(saved, online ? '' : savedMessage);
    if (!online) {
      if (!saved) status.textContent = 'Connect to the internet to load the price chart.';
      return;
    }
    if (!force && saved?.source === 'dolthub' && saved.fresh) return;

    if (!saved) status.textContent = `Loading ${selected} chart…`;
    try {
      const latest = await fetchMarketHistory(selected, signal);
      if (signal.aborted) return;
      marketRepository.save(selected, latest, 'dolthub');
      showHistory({ prices: latest, source: 'dolthub' });
      return;
    } catch {
      if (signal.aborted) return;
    }
    if (saved) {
      status.textContent = savedMessage;
      retry.hidden = false;
      return;
    }

    widget.hidden = false;
    link.parentElement.hidden = false;
    const embedded = await mountPriceWidget(widget, ticker.value, theme.matches ? 'dark' : 'light', signal);
    if (signal.aborted) return;
    if (embedded) {
      status.textContent = '';
      return;
    }
    widget.hidden = true;
    delay.hidden = true;
    try {
      const latest = await fetchPrices(selected, signal);
      if (signal.aborted) return;
      marketRepository.save(selected, latest, 'alphaVantage');
      showHistory({ prices: latest, source: 'alphaVantage' });
    } catch {
      if (signal.aborted) return;
      status.textContent = 'The price chart is unavailable right now.';
    }
    retry.hidden = false;
  }

  function reload() { void load(); }

  ticker.addEventListener('change', reload);
  period.addEventListener('change', updateChart);
  retry.addEventListener('click', () => void load(true));
  theme.addEventListener('change', reload);
  window.addEventListener('online', reload);
  window.addEventListener('offline', reload);
  if (focusHeading) view.querySelector('h1').focus();
  reload();
  return () => {
    request?.abort();
    theme.removeEventListener('change', reload);
    window.removeEventListener('online', reload);
    window.removeEventListener('offline', reload);
  };
}
