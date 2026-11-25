import { fetchMarketHistory, fetchPrices, mountPriceWidget } from './market-provider.js';
import { marketRepository } from './market-repository.js';
import { renderPriceChart } from './market-chart.js';

const listings = [
  ['AMEX:SPY', 'S&P 500 ETF'],
  ['NASDAQ:QQQ', 'Nasdaq-100 ETF'],
  ['NASDAQ:AAPL', 'Apple'],
  ['NASDAQ:AMZN', 'Amazon'],
  ['NASDAQ:GOOGL', 'Alphabet'],
  ['NASDAQ:MSFT', 'Microsoft'],
  ['NASDAQ:NVDA', 'NVIDIA'],
  ['NASDAQ:TSLA', 'Tesla'],
];
const ranges = [
  ['7', '1W', '1 week'], ['30', '1M', '1 month'], ['90', '3M', '3 months'],
  ['180', '6M', '6 months'], ['ytd', 'YTD', 'Year to date'], ['365', '1Y', '1 year'],
];
const historySources = {
  dolthub: ['post-no-preference on DoltHub', 'https://www.dolthub.com/repositories/post-no-preference/stocks'],
  alphaVantage: ['Alpha Vantage', 'https://www.alphavantage.co/'],
};

export function renderMarkets(view, focusHeading) {
  view.innerHTML = `<a class="back-link" href="#workspace"><span class="arrow" aria-hidden="true"></span>Workspace</a>
    <div class="market-heading">
      <h1 tabindex="-1">Markets</h1>
      <label class="market-ticker">Stock or ETF
        <select name="symbol">${listings.map(([symbol, name]) => `<option value="${symbol}">${symbol.split(':')[1]} · ${name}</option>`).join('')}</select>
      </label>
    </div>
    <section class="market-panel" aria-labelledby="market-instrument-name">
      <header class="market-instrument">
        <h2 id="market-instrument-name"></h2>
        <p></p>
      </header>
      <p class="market-status" role="status"></p>
      <div class="market-widget" hidden></div>
      <div class="market-history" hidden>
        <div class="market-quote"></div>
        <figure class="market-chart"></figure>
        <div class="market-period" role="group" aria-label="Chart range">
          ${ranges.map(([value, short, label]) => `<button type="button" value="${value}" aria-label="${label}"
            aria-pressed="${value === '30'}">${short}</button>`).join('')}
        </div>
        <section class="market-summary" aria-labelledby="market-summary-title">
          <h3 id="market-summary-title">Range summary</h3>
          <dl></dl>
        </section>
        <details class="market-prices">
          <summary>Price history table</summary>
          <table class="market-table">
            <thead><tr><th scope="col">Date</th><th scope="col">Closing price (USD)</th></tr></thead>
            <tbody></tbody>
          </table>
        </details>
        <p class="market-source">Source · <a></a></p>
      </div>
      <div class="market-footer">
        <p><a class="market-link" rel="nofollow">TradingView</a><span class="market-delay"> · Prices may be delayed</span></p>
        <button class="market-retry" type="button" hidden>Retry chart</button>
      </div>
    </section>`;
  const panel = view.querySelector('.market-panel');
  const ticker = view.querySelector('[name="symbol"]');
  const name = panel.querySelector('#market-instrument-name');
  const exchangeLabel = panel.querySelector('.market-instrument p');
  const period = panel.querySelector('.market-period');
  const widget = panel.querySelector('.market-widget');
  const history = panel.querySelector('.market-history');
  const retry = panel.querySelector('.market-retry');
  const status = panel.querySelector('[role="status"]');
  const historyLink = history.querySelector('a');
  const link = panel.querySelector('.market-link');
  const delay = panel.querySelector('.market-delay');
  let range = '30';
  let prices;
  let request;

  function showHistory(record, message = '') {
    prices = record.prices;
    const [label, url] = historySources[record.source];
    historyLink.textContent = label;
    historyLink.href = url;
    link.parentElement.hidden = true;
    status.textContent = message;
    history.hidden = false;
    renderPriceChart(history, prices, range);
  }

  async function load(force = false) {
    request?.abort();
    const controller = new AbortController();
    request = controller;
    const { signal } = controller;
    const [exchange, selected] = ticker.value.split(':');
    name.textContent = listings[ticker.selectedIndex][1];
    exchangeLabel.textContent = `${selected} · ${exchange}`;
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
    const embedded = await mountPriceWidget(widget, ticker.value, 'dark', signal);
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
  period.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button || range === button.value || !prices) return;
    period.querySelector('[aria-pressed="true"]').setAttribute('aria-pressed', 'false');
    button.setAttribute('aria-pressed', 'true');
    range = button.value;
    renderPriceChart(history, prices, range);
  });
  retry.addEventListener('click', () => void load(true));
  window.addEventListener('online', reload);
  window.addEventListener('offline', reload);
  if (focusHeading) view.querySelector('h1').focus();
  reload();
  return () => {
    request?.abort();
    window.removeEventListener('online', reload);
    window.removeEventListener('offline', reload);
  };
}
