import { fetchMarketHistory, fetchPrices, hasCandle } from './market-provider.js';
import { fetchCryptoQuote } from './market-crypto.js';
import { marketRepository } from './market-repository.js';
import { renderMarketQuote, renderPriceChart } from './market-chart.js';
import { defaultMarkets, searchMarkets } from './market-symbols.js';

const ranges = [
  ['7', '1W', '1 week'], ['30', '1M', '1 month'], ['90', '3M', '3 months'],
  ['180', '6M', '6 months'], ['ytd', 'YTD', 'Year to date'], ['365', '1Y', '1 year'],
];
const chartStyles = [['line', 'Line'], ['candles', 'Candles']];
const cryptoRefreshInterval = 5 * 60 * 1000;
const historySources = {
  archive: ['S&P 500 archive on GitHub', 'https://github.com/Johnbrick123/sp500-data'],
  dolthub: ['post-no-preference on DoltHub', 'https://www.dolthub.com/repositories/post-no-preference/stocks'],
  alphaVantage: ['Alpha Vantage', 'https://www.alphavantage.co/'],
  bitstamp: ['Bitstamp', 'https://www.bitstamp.net/api/'],
  bitcoinArchive: ['Bitstamp daily candles on GitHub', 'https://github.com/daniegitx1/btc-price-history'],
  coinbaseArchive: ['Coinbase daily closes on GitHub', 'https://github.com/akpasz/btc-data'],
  dnse: ['DNSE', 'https://www.dnse.com.vn/'],
  euronext: ['Euronext', 'https://live.euronext.com/en'],
};

export function renderMarkets(view, focusHeading) {
  const lastChart = marketRepository.lastChart();
  let range = ranges.some(([value]) => value === lastChart?.range) ? lastChart.range : '30';
  let chartStyle = lastChart?.style === 'candles' ? 'candles' : 'line';
  view.innerHTML = `<div class="market-heading">
      <h1 tabindex="-1">Markets</h1>
      <div class="market-ticker">
        <label for="market-symbol">Watchlist</label>
        <select id="market-symbol" name="symbol"></select>
      </div>
    </div>
    <form class="market-search" role="search" aria-label="Market symbols">
      <label for="market-search-input" class="market-search-label">Search Markets</label>
      <input id="market-search-input" type="search" placeholder="Symbol or name"
        enterkeyhint="search" autocomplete="off" spellcheck="false" maxlength="100"
        aria-controls="market-search-results">
      <ul id="market-search-results" class="market-search-results" hidden></ul>
      <p class="market-search-status" role="status"></p>
    </form>
    <p class="market-empty" role="status" hidden>Your watchlist is empty. Search to add a symbol.</p>
    <section class="market-panel" aria-labelledby="market-instrument-name">
      <header class="market-instrument-row">
        <div class="market-instrument">
          <h2 id="market-instrument-name"></h2>
          <p></p>
        </div>
        <button type="button" class="market-remove">Remove</button>
      </header>
      <p class="market-status" role="status"></p>
      <div class="market-quote" hidden></div>
      <div class="market-history" hidden>
        <div class="market-chart-style" role="group" aria-label="Chart type">
          ${chartStyles.map(([value, label]) => `<button type="button" value="${value}"
            aria-pressed="${value === chartStyle}">${label}</button>`).join('')}
        </div>
        <figure class="market-chart"></figure>
        <div class="market-period" role="group" aria-label="Chart range">
          ${ranges.map(([value, short, label]) => `<button type="button" value="${value}" aria-label="${label}"
            aria-pressed="${value === range}">${short}</button>`).join('')}
        </div>
        <section class="market-summary" aria-labelledby="market-summary-title">
          <h3 id="market-summary-title">Range summary</h3>
          <dl></dl>
        </section>
        <details class="market-prices">
          <summary>Price history table</summary>
          <table class="market-table">
            <thead><tr><th scope="col">Date</th><th scope="col" class="market-table-currency">Closing price</th></tr></thead>
            <tbody></tbody>
          </table>
        </details>
        <p class="market-source">Source · <a></a></p>
      </div>
      <div class="market-actions" hidden>
        <button class="market-retry" type="button">Retry chart</button>
        <a class="market-link" rel="nofollow">Open on TradingView</a>
      </div>
    </section>`;
  const panel = view.querySelector('.market-panel');
  const ticker = view.querySelector('[name="symbol"]');
  const empty = view.querySelector('.market-empty');
  const search = view.querySelector('.market-search');
  const searchInput = search.querySelector('input');
  const results = search.querySelector('ul');
  const searchStatus = search.querySelector('[role="status"]');
  const name = panel.querySelector('#market-instrument-name');
  const exchangeLabel = panel.querySelector('.market-instrument p');
  const remove = panel.querySelector('.market-remove');
  const styleControls = panel.querySelector('.market-chart-style');
  const period = panel.querySelector('.market-period');
  const quote = panel.querySelector('.market-quote');
  const history = panel.querySelector('.market-history');
  const actions = panel.querySelector('.market-actions');
  const retry = panel.querySelector('.market-retry');
  const status = panel.querySelector('[role="status"]');
  const historyLink = history.querySelector('a');
  const link = panel.querySelector('.market-link');
  let prices;
  let request;
  let quoteRequest;
  let quoteTimer;
  let trade;
  let searchRequest;
  let listings;
  let matches = [];

  function setListings(selected) {
    listings = marketRepository.watchlist();
    ticker.replaceChildren(...listings.map(({ symbol, label, name }) =>
      new Option(name === label ? label : `${label} · ${name}`, symbol)));
    if (listings.some(({ symbol }) => symbol === selected)) ticker.value = selected;
    const hasListings = listings.length > 0;
    ticker.closest('.market-ticker').hidden = !hasListings;
    panel.hidden = !hasListings;
    empty.hidden = hasListings;
  }

  function clearSearch() {
    searchRequest?.abort();
    searchInput.value = '';
    searchStatus.textContent = '';
    matches = [];
    results.replaceChildren();
    results.hidden = true;
  }

  async function updateSearch() {
    searchRequest?.abort();
    const controller = new AbortController();
    searchRequest = controller;
    const query = searchInput.value;
    matches = [];
    results.replaceChildren();
    results.hidden = true;
    searchStatus.textContent = '';
    if (!query.trim()) return;
    const found = await searchMarkets(query, listings);
    if (controller.signal.aborted) return;
    matches = found;
    for (const listing of matches) {
      const item = document.createElement('li');
      const button = document.createElement('button');
      const symbol = document.createElement('strong');
      const detail = document.createElement('span');
      const action = document.createElement('span');
      button.type = 'button';
      symbol.textContent = listing.label;
      detail.textContent = listing.name === listing.label ? listing.market : `${listing.name} · ${listing.market}`;
      action.textContent = listings.some(({ symbol }) => symbol === listing.symbol) ? 'Open' : 'Add';
      button.append(symbol, detail, action);
      button.addEventListener('click', () => void choose(listing));
      item.append(button);
      results.append(item);
    }
    results.hidden = !matches.length;
    if (!matches.length) searchStatus.textContent = 'No matches. For crypto, try a pair like ETH/USD.';
  }

  async function choose(listing) {
    const { symbol, label } = listing;
    if (listings.some(item => item.symbol === symbol)) {
      openListing(symbol);
      return;
    }
    searchRequest?.abort();
    const controller = new AbortController();
    searchRequest = controller;
    const { signal } = controller;
    try {
      if (!defaultMarkets.some(item => item.symbol === symbol) && !marketRepository.get(symbol)) {
        if (navigator.onLine === false) {
          searchStatus.textContent = 'Connect to the internet to add this symbol.';
          return;
        }
        searchStatus.textContent = `Checking price history for ${label}…`;
        const record = await fetchMarketHistory(symbol, signal);
        if (signal.aborted) return;
        marketRepository.save(symbol, record.prices, record.source);
      }
      if (!marketRepository.setSaved(listing, true)) {
        searchStatus.textContent = 'This device could not save your watchlist.';
        return;
      }
      openListing(symbol);
    } catch {
      if (!signal.aborted) searchStatus.textContent = `Price history for ${label} is unavailable. Try another symbol or try again later.`;
    }
  }

  function openListing(symbol) {
    clearSearch();
    setListings(symbol);
    (listings.length ? ticker : searchInput).focus();
    selectListing();
  }

  function drawQuote() {
    const { currency } = listings[ticker.selectedIndex];
    renderMarketQuote(quote, prices, trade, currency);
  }

  async function refreshQuote() {
    const listing = listings[ticker.selectedIndex];
    if (listing?.market !== 'Crypto' || document.hidden || navigator.onLine === false || quoteRequest) return;
    const controller = new AbortController();
    quoteRequest = controller;
    try {
      const latest = await fetchCryptoQuote(listing.symbol, controller.signal);
      if (controller.signal.aborted || (trade && latest.time < trade.time)) return;
      trade = latest;
      drawQuote();
    } catch {
      // Keep the timestamped quote or the most recent available close.
    } finally {
      if (quoteRequest === controller) quoteRequest = undefined;
    }
  }

  function drawChart() {
    const { symbol, currency } = listings[ticker.selectedIndex];
    renderPriceChart(history, prices, range, chartStyle, currency);
    marketRepository.saveChart(symbol, range, chartStyle);
  }

  function showHistory(record, message = '') {
    prices = record.prices;
    const [label, url] = historySources[record.source];
    historyLink.textContent = label;
    historyLink.href = listings[ticker.selectedIndex].sourceUrl ?? url;
    status.textContent = message;
    history.hidden = false;
    drawQuote();
    drawChart();
  }

  async function load(force = false) {
    request?.abort();
    const listing = listings[ticker.selectedIndex];
    if (!listing) return;
    const controller = new AbortController();
    request = controller;
    const { signal } = controller;
    const { symbol: selected, name: title, label, market, tradingView } = listing;
    name.textContent = title;
    exchangeLabel.textContent = `${label} · ${market}`;
    remove.setAttribute('aria-label', `Remove ${label} from watchlist`);
    const saved = marketRepository.get(selected);
    prices = undefined;
    actions.hidden = true;
    history.hidden = true;
    link.href = `https://www.tradingview.com/symbols/${tradingView}/`;
    const online = navigator.onLine !== false;
    if (saved) showHistory(saved);
    else {
      drawQuote();
      status.textContent = `Loading ${label} chart…`;
    }
    const bundled = await marketRepository.bundled(selected);
    if (signal.aborted) return;
    const bundledDate = bundled?.prices.at(-1).date;
    const savedDate = saved?.prices.at(-1).date;
    const useBundled = bundled && (!saved || bundledDate > savedDate
      || (bundledDate === savedDate && (bundled.prices.length > saved.prices.length
        || (hasCandle(bundled.prices.at(-1)) && !hasCandle(saved.prices.at(-1))))));
    const current = useBundled ? bundled : saved;
    const savedMessage = current?.bundled ? 'Showing closing prices included with this build.' : 'Showing saved closing prices.';
    if (current?.bundled) showHistory(current, savedMessage);
    if (!online) {
      status.textContent = current ? savedMessage : 'Connect to the internet to load the price chart.';
      return;
    }
    if (!force && current?.fresh && current.source !== 'dolthub' && current.source !== 'alphaVantage'
      && (chartStyle === 'line' || current.source === 'euronext' || hasCandle(current.prices.at(-1)))) return;

    try {
      const latest = await fetchMarketHistory(selected, signal);
      if (signal.aborted) return;
      if (current && latest.prices.at(-1).date < current.prices.at(-1).date) {
        throw new Error('The market archive is older than the prices on this device.');
      }
      marketRepository.save(selected, latest.prices, latest.source);
      showHistory(latest);
      return;
    } catch {
      if (signal.aborted) return;
    }
    if (!current && !selected.endsWith('-USD') && !selected.includes(':')) {
      try {
        const latest = await fetchPrices(selected, signal);
        if (signal.aborted) return;
        marketRepository.save(selected, latest, 'alphaVantage');
        showHistory({ prices: latest, source: 'alphaVantage' });
        return;
      } catch {
        if (signal.aborted) return;
      }
    }
    status.textContent = current ? savedMessage : 'Daily closing prices are unavailable right now.';
    actions.hidden = false;
  }

  function reload() { void load(); }
  function refresh() {
    void load(true);
    void refreshQuote();
  }

  function selectListing(force = false) {
    quoteRequest?.abort();
    quoteRequest = undefined;
    trade = undefined;
    window.clearInterval(quoteTimer);
    void load(force);
    if (listings[ticker.selectedIndex]?.market === 'Crypto') {
      void refreshQuote();
      quoteTimer = window.setInterval(refreshQuote, cryptoRefreshInterval);
    }
  }

  ticker.addEventListener('change', () => {
    clearSearch();
    selectListing();
  });
  searchInput.addEventListener('input', () => void updateSearch());
  search.addEventListener('submit', (event) => {
    event.preventDefault();
    if (matches.length) void choose(matches[0]);
  });
  search.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && searchInput.value) {
      clearSearch();
      searchInput.focus();
    }
  });
  remove.addEventListener('click', () => {
    const selected = listings[ticker.selectedIndex];
    if (marketRepository.setSaved(selected, false)) openListing();
    else status.textContent = 'This device could not update your watchlist.';
  });
  period.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button || range === button.value || !prices) return;
    period.querySelector('[aria-pressed="true"]').setAttribute('aria-pressed', 'false');
    button.setAttribute('aria-pressed', 'true');
    range = button.value;
    drawChart();
  });
  styleControls.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button || chartStyle === button.value || !prices) return;
    styleControls.querySelector('[aria-pressed="true"]').setAttribute('aria-pressed', 'false');
    button.setAttribute('aria-pressed', 'true');
    chartStyle = button.value;
    drawChart();
    if (chartStyle === 'candles' && !hasCandle(prices.at(-1))) reload();
  });
  retry.addEventListener('click', refresh);
  window.addEventListener('online', refresh);
  window.addEventListener('offline', reload);
  document.addEventListener('visibilitychange', refreshQuote);
  setListings(lastChart?.symbol);
  if (focusHeading) view.querySelector('h1').focus();
  selectListing(true);
  return () => {
    request?.abort();
    quoteRequest?.abort();
    window.clearInterval(quoteTimer);
    searchRequest?.abort();
    window.removeEventListener('online', refresh);
    window.removeEventListener('offline', reload);
    document.removeEventListener('visibilitychange', refreshQuote);
  };
}
