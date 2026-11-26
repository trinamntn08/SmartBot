import { hasCandle } from './market-provider.js';

const dollars = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' });
const signedDollars = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', signDisplay: 'exceptZero' });
const smallDollars = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 8 });
const signedSmallDollars = new Intl.NumberFormat(undefined, {
  style: 'currency', currency: 'USD', signDisplay: 'exceptZero', maximumFractionDigits: 8,
});
const dong = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'VND' });
const signedDong = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'VND', signDisplay: 'exceptZero' });
const percent = new Intl.NumberFormat(undefined, { style: 'percent', signDisplay: 'exceptZero', maximumFractionDigits: 2 });
const dates = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: 'UTC' });
const quoteTimes = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const shortDates = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
const axisPrices = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
const smallAxisPrices = new Intl.NumberFormat(undefined, { maximumFractionDigits: 8 });
const dayLength = 86400000;
const plotWidth = 720;
const plotHeight = 260;
const plotInset = 8;

function trend(change) {
  return change < 0 ? 'down' : change > 0 ? 'up' : 'flat';
}

function formatPrice(price, currency, signed = false) {
  if (currency === 'VND') return (signed ? signedDong : dong).format(price);
  if (Math.abs(price) < 0.01) return (signed ? signedSmallDollars : smallDollars).format(price);
  return (signed ? signedDollars : dollars).format(price);
}

function visiblePrices(series, range) {
  const lastDate = Date.parse(series.at(-1).date);
  const start = range === 'ytd'
    ? Date.UTC(new Date(lastDate).getUTCFullYear(), 0, 1)
    : lastDate - (Number(range) - 1) * dayLength;
  return series.filter(({ date }) => Date.parse(date) >= start);
}

function chartScale(low, high) {
  const fractional = high < 0.01;
  const spread = Math.max(high - low, high * 0.004, fractional ? 1e-9 : 0.04);
  const increment = 10 ** Math.floor(Math.log10(spread / 4));
  const step = [1, 2, 2.5, 5, 10].find(factor => factor * increment >= spread / 4) * increment;
  const floor = Math.max(0, Math.floor((low - spread * 0.06) / step) * step);
  const ceiling = Math.ceil((high + spread * 0.06) / step) * step;
  const ticks = Array.from({ length: Math.round((ceiling - floor) / step) + 1 }, (_, index) => ceiling - index * step);
  const y = value => plotInset + (plotHeight - 2 * plotInset) * (ceiling - value) / (ceiling - floor);
  return { ticks, y, fractional };
}

function chartPoints(prices, y) {
  const start = Date.parse(prices[0].date);
  const end = Date.parse(prices.at(-1).date);
  return prices.map(price => {
    const time = Date.parse(price.date);
    const x = start === end ? plotWidth / 2 : plotInset + (plotWidth - 2 * plotInset) * (time - start) / (end - start);
    return { ...price, time, x, y: y(price.close) };
  });
}

export function renderMarketQuote(quote, series, trade, currency) {
  const latest = series?.at(-1);
  const lastCloseTime = latest ? Date.parse(latest.date) + dayLength : 0;
  const useTrade = trade && trade.time >= lastCloseTime;
  quote.hidden = !latest && !useTrade;
  if (quote.hidden) return;

  const price = useTrade ? trade.price : latest.close;
  const previous = useTrade
    ? (trade.time < lastCloseTime + dayLength ? latest : undefined)
    : series.at(-2);
  const change = previous ? price - previous.close : 0;
  const dailyChange = previous ? `<span class="market-day-change" data-trend="${trend(change)}">
    ${formatPrice(change, currency, true)} (${percent.format(change / previous.close)})
  </span>` : '';
  const time = useTrade
    ? `Last trade <time datetime="${new Date(trade.time).toISOString()}">${quoteTimes.format(trade.time)}</time> · Bitstamp`
    : `Closed <time datetime="${latest.date}">${dates.format(Date.parse(latest.date))}</time>`;
  quote.innerHTML = `<div class="market-price-row">
      <strong>${formatPrice(price, currency)}</strong>${dailyChange}
    </div>
    <p>${time} · ${currency}${previous ? ' · Change vs. prior close' : ''}</p>`;
}

function candleShapes(points, y) {
  let spacing = 48;
  for (let index = 1; index < points.length; index++) {
    spacing = Math.min(spacing, points[index].x - points[index - 1].x);
  }
  const width = spacing * 0.72;
  return points.filter(hasCandle).map(point => {
    const { x, open, high, low, close } = point;
    const bodyTop = y(Math.max(open, close));
    const height = Math.max(1, y(Math.min(open, close)) - bodyTop);
    return `<g class="market-candle" data-trend="${trend(close - open)}">
      <line x1="${x}" x2="${x}" y1="${y(high)}" y2="${y(low)}"/>
      <rect x="${x - width / 2}" y="${bodyTop}" width="${width}" height="${height}"/>
    </g>`;
  }).join('');
}

function renderGraph(figure, points, scale, change, previous, style, currency) {
  const first = points[0];
  const last = points.at(-1);
  const candles = style === 'candles' ? candleShapes(points, scale.y) : '';
  const label = candles ? 'Daily candlesticks' : 'Daily closing prices';
  const line = points.map(({ x, y }) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
  const bottom = plotHeight - plotInset;
  const referenceY = previous ? scale.y(previous.close) : null;
  const dateLabels = [first.time];
  const axis = scale.fractional ? smallAxisPrices : axisPrices;
  if (last.time - first.time >= 4 * dayLength) dateLabels.push((first.time + last.time) / 2);
  if (last.time !== first.time) dateLabels.push(last.time);
  figure.innerHTML = `<figcaption class="market-chart-caption">
      <span>${label}</span>
      <span class="market-point-reading" aria-hidden="true"></span>
    </figcaption>
    ${style === 'candles' && !candles ? '<p class="market-chart-notice">Candlesticks are unavailable for this range. Showing closing prices.</p>' : ''}
    <div class="market-graph" data-trend="${trend(change)}" data-fractional="${scale.fractional}">
      <div class="market-plot">
        <svg viewBox="0 0 ${plotWidth} ${plotHeight}" preserveAspectRatio="none" aria-hidden="true" focusable="false">
          <defs><linearGradient id="market-area-fill" x2="0" y2="1">
            <stop offset="0" stop-color="currentColor" stop-opacity="0.2"/>
            <stop offset="1" stop-color="currentColor" stop-opacity="0"/>
          </linearGradient></defs>
          ${scale.ticks.map(tick => `<line class="market-grid-line" x1="0" x2="${plotWidth}" y1="${scale.y(tick)}" y2="${scale.y(tick)}"/>`).join('')}
          ${referenceY !== null && referenceY >= plotInset && referenceY <= bottom
            ? `<line class="market-reference-line" x1="0" x2="${plotWidth}" y1="${referenceY}" y2="${referenceY}"/>` : ''}
          ${candles || (points.length > 1 ? `<polygon points="${first.x},${bottom} ${line} ${last.x},${bottom}" fill="url(#market-area-fill)"/>
            <polyline class="market-price-line" points="${line}"/>` : '')}
          <line class="market-crosshair" y1="${plotInset}" y2="${bottom}"/>
          <path class="market-marker"/>
        </svg>
        ${points.length > 1 || candles ? `<input class="market-scrubber" type="range" min="0" max="${points.length - 1}"
          value="${points.length - 1}" aria-label="Explore ${label.toLowerCase()}">` : ''}
      </div>
      <div class="market-axis" aria-hidden="true">${scale.ticks.map(tick =>
        `<span style="top:${scale.y(tick) / plotHeight * 100}%">${axis.format(tick)}</span>`).join('')}</div>
      <div class="market-dates" aria-hidden="true">${dateLabels.map(time => `<span>${shortDates.format(time)}</span>`).join('')}</div>
    </div>`;

  const plot = figure.querySelector('.market-plot');
  const slider = plot.querySelector('input');
  const reading = figure.querySelector('.market-point-reading');
  const marker = plot.querySelector('.market-marker');
  const crosshair = plot.querySelector('.market-crosshair');

  function inspect(index) {
    const point = points[index];
    const close = formatPrice(point.close, currency);
    const fields = candles && hasCandle(point)
      ? [['Open', point.open], ['High', point.high], ['Low', point.low], ['Close', point.close]] : [];
    reading.textContent = fields.length ? shortDates.format(point.time) : `${shortDates.format(point.time)} · ${close}`;
    for (const [field, value] of fields) {
      const label = document.createElement('span');
      label.textContent = `${field[0]} ${formatPrice(value, currency)}`;
      reading.append(' ', label);
    }
    marker.setAttribute('d', `M ${point.x},${point.y} h 0`);
    marker.toggleAttribute('hidden', Boolean(candles) && fields.length > 0);
    crosshair.setAttribute('x1', point.x);
    crosshair.setAttribute('x2', point.x);
    crosshair.toggleAttribute('hidden', index === points.length - 1);
    if (slider) {
      slider.value = index;
      const values = fields.length ? fields.map(([field, value]) => `${field} ${formatPrice(value, currency)}`).join(', ') : close;
      slider.setAttribute('aria-valuetext', `${dates.format(point.time)}, ${values}`);
    }
  }

  function inspectPointer(event) {
    const bounds = plot.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width * plotWidth;
    const closest = points.reduce((best, point, index) =>
      Math.abs(point.x - x) < Math.abs(points[best].x - x) ? index : best, 0);
    inspect(closest);
  }

  if (slider) {
    slider.addEventListener('input', () => inspect(slider.valueAsNumber));
    plot.addEventListener('pointermove', inspectPointer);
    plot.addEventListener('pointerdown', inspectPointer);
  }
  inspect(points.length - 1);
}

export function renderPriceChart(view, series, range, style, currency) {
  const prices = visiblePrices(series, range);
  const latest = prices.at(-1);
  const previous = series.at(-2);
  const closes = prices.map(({ close }) => close);
  const low = Math.min(...closes);
  const high = Math.max(...closes);
  const change = latest.close / prices[0].close - 1;
  const candles = style === 'candles' ? prices.filter(hasCandle) : [];
  const scale = chartScale(Math.min(low, ...candles.map(price => price.low)), Math.max(high, ...candles.map(price => price.high)));
  const format = price => formatPrice(price, currency);
  renderGraph(view.querySelector('.market-chart'), chartPoints(prices, scale.y), scale, change,
    range === '7' || range === '30' ? previous : null, style, currency);
  view.querySelector('.market-summary dl').innerHTML = `<div><dt>Previous close</dt><dd>${previous ? format(previous.close) : '—'}</dd></div>
    <div><dt>Range change</dt><dd data-trend="${trend(change)}">${prices.length > 1 ? percent.format(change) : '—'}</dd></div>
    <div><dt>Lowest close</dt><dd>${format(low)}</dd></div>
    <div><dt>Highest close</dt><dd>${format(high)}</dd></div>`;
  view.querySelector('.market-table-currency').textContent = `Closing price (${currency})`;
  view.querySelector('.market-table tbody').innerHTML = prices.slice().reverse().map(({ date, close }) => `<tr>
    <td><time datetime="${date}">${dates.format(Date.parse(date))}</time></td><td>${format(close)}</td></tr>`).join('');
}
