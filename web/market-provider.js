const tradingViewHost = 'https://www.tradingview-widget.com';

export function mountPriceWidget(container, symbol, theme, signal) {
  return new Promise((resolve) => {
    const loader = document.createElement('iframe');
    loader.hidden = true;
    loader.setAttribute('sandbox', 'allow-scripts');
    loader.title = 'Market chart loader';
    loader.src = `./market-widget.html#${new URLSearchParams({ symbol, theme })}`;
    let chart;
    const timeout = setTimeout(() => finish(false), 10000);

    function finish(loaded) {
      clearTimeout(timeout);
      window.removeEventListener('message', receiveUrl);
      signal.removeEventListener('abort', abort);
      loader.remove();
      if (!loaded) chart?.remove();
      resolve(loaded);
    }

    function abort() { finish(false); }

    function receiveUrl(event) {
      const source = event.data?.marketWidget;
      if (event.origin !== 'null' || event.source !== loader.contentWindow || source === undefined) return;
      window.removeEventListener('message', receiveUrl);
      let url;
      try { url = new URL(source); } catch { finish(false); return; }
      if (url.origin !== tradingViewHost || url.pathname !== '/embed-widget/symbol-overview/' || url.username || url.password) {
        finish(false);
        return;
      }
      loader.remove();
      chart = document.createElement('iframe');
      chart.title = `${symbol.split(':')[1]} price chart by TradingView`;
      chart.setAttribute('sandbox', 'allow-scripts allow-same-origin');
      chart.src = url.href;
      chart.addEventListener('load', () => finish(true), { once: true });
      container.append(chart);
    }

    if (signal.aborted) {
      finish(false);
      return;
    }
    signal.addEventListener('abort', abort, { once: true });
    window.addEventListener('message', receiveUrl);
    container.append(loader);
  });
}

export function validatePrices(data, symbol) {
  if (!data || data.symbol !== symbol || !Array.isArray(data.prices) || !data.prices.length || data.prices.length > 280) {
    throw new Error('The market data response was incomplete.');
  }
  let previous = '';
  for (const price of data.prices) {
    if (typeof price?.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(price.date)
      || !Number.isFinite(Date.parse(price.date)) || price.date <= previous
      || !Number.isFinite(price.close) || price.close <= 0 || price.close > 1e9) {
      throw new Error('The market data response was incomplete.');
    }
    previous = price.date;
  }
  return data.prices;
}

export async function fetchMarketHistory(symbol, signal) {
  const query = new URLSearchParams({ symbol });
  const response = await fetch(`./api/markets/history?${query}`, {
    signal, cache: 'no-store', headers: { 'X-SmartBot-Market': 'daily' },
  });
  if (!response.ok) throw new Error('Daily closing prices could not be downloaded.');
  const data = await response.json();
  if (!['Success', 'RowLimit'].includes(data?.query_execution_status) || !Array.isArray(data.rows)) {
    throw new Error('No closing prices were returned.');
  }
  const prices = data.rows.map((row) => ({
    date: row?.date,
    close: typeof row?.close === 'string' || typeof row?.close === 'number' ? Number(row.close) : NaN,
  })).filter(({ date, close }) => typeof date === 'string' && Number.isFinite(close) && close > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
  return validatePrices({ symbol, prices }, symbol);
}

export async function fetchPrices(symbol, signal) {
  if (navigator.onLine === false) throw new Error('You’re offline.');
  if (location.protocol !== 'http:' || !['localhost', '127.0.0.1'].includes(location.hostname)) {
    throw new Error('Open the local SmartBot browser preview to load market prices.');
  }

  const query = new URLSearchParams({ symbol });
  const response = await fetch(`./api/markets/daily?${query}`, {
    signal, cache: 'no-store', headers: { 'X-SmartBot-Market': 'daily' },
  });
  if (response.status === 404) throw new Error('Restart the local SmartBot preview to load market prices.');
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Market prices could not be loaded.');
  return validatePrices(data, symbol);
}
