const dollars = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' });
const signedDollars = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', signDisplay: 'exceptZero' });
const smallDollars = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 8 });
const signedSmallDollars = new Intl.NumberFormat(undefined, {
  style: 'currency', currency: 'USD', signDisplay: 'exceptZero', maximumFractionDigits: 8,
});
const percent = new Intl.NumberFormat(undefined, { style: 'percent', signDisplay: 'exceptZero', maximumFractionDigits: 2 });
const dates = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: 'UTC' });
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

function formatPrice(price) {
  return (price < 0.01 ? smallDollars : dollars).format(price);
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

function renderQuote(quote, latest, previous) {
  const change = previous ? latest.close - previous.close : 0;
  const changeFormat = latest.close < 0.01 ? signedSmallDollars : signedDollars;
  const dailyChange = previous ? `<span class="market-day-change" data-trend="${trend(change)}">
    ${changeFormat.format(change)} (${percent.format(change / previous.close)})
  </span>` : '';
  quote.innerHTML = `<div class="market-price-row">
      <strong>${formatPrice(latest.close)}</strong>${dailyChange}
    </div>
    <p>Closed <time datetime="${latest.date}">${dates.format(Date.parse(latest.date))}</time> · USD${previous ? ' · Change vs. prior close' : ''}</p>`;
}

function renderGraph(figure, points, scale, change, previous) {
  const first = points[0];
  const last = points.at(-1);
  const line = points.map(({ x, y }) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
  const bottom = plotHeight - plotInset;
  const referenceY = previous ? scale.y(previous.close) : null;
  const dateLabels = [first.time];
  const axis = scale.fractional ? smallAxisPrices : axisPrices;
  if (last.time - first.time >= 4 * dayLength) dateLabels.push((first.time + last.time) / 2);
  if (last.time !== first.time) dateLabels.push(last.time);
  figure.innerHTML = `<figcaption class="market-chart-caption">
      <span>Daily closing prices</span>
      <span class="market-point-reading" aria-hidden="true"></span>
    </figcaption>
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
          ${points.length > 1 ? `<polygon points="${first.x},${bottom} ${line} ${last.x},${bottom}" fill="url(#market-area-fill)"/>
            <polyline class="market-price-line" points="${line}"/>` : ''}
          <line class="market-crosshair" y1="${plotInset}" y2="${bottom}"/>
          <path class="market-marker"/>
        </svg>
        ${points.length > 1 ? `<input class="market-scrubber" type="range" min="0" max="${points.length - 1}"
          value="${points.length - 1}" aria-label="Explore daily closing prices">` : ''}
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
    reading.textContent = `${shortDates.format(point.time)} · ${formatPrice(point.close)}`;
    marker.setAttribute('d', `M ${point.x},${point.y} h 0`);
    crosshair.setAttribute('x1', point.x);
    crosshair.setAttribute('x2', point.x);
    crosshair.toggleAttribute('hidden', index === points.length - 1);
    if (slider) {
      slider.value = index;
      slider.setAttribute('aria-valuetext', `${dates.format(point.time)}, ${formatPrice(point.close)}`);
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

export function renderPriceChart(view, series, range) {
  const prices = visiblePrices(series, range);
  const latest = prices.at(-1);
  const previous = series.at(-2);
  const closes = prices.map(({ close }) => close);
  const low = Math.min(...closes);
  const high = Math.max(...closes);
  const change = latest.close / prices[0].close - 1;
  const scale = chartScale(low, high);
  renderQuote(view.querySelector('.market-quote'), latest, previous);
  renderGraph(view.querySelector('.market-chart'), chartPoints(prices, scale.y), scale, change,
    range === '7' || range === '30' ? previous : null);
  view.querySelector('.market-summary dl').innerHTML = `<div><dt>Previous close</dt><dd>${previous ? formatPrice(previous.close) : '—'}</dd></div>
    <div><dt>Range change</dt><dd data-trend="${trend(change)}">${prices.length > 1 ? percent.format(change) : '—'}</dd></div>
    <div><dt>Lowest close</dt><dd>${formatPrice(low)}</dd></div>
    <div><dt>Highest close</dt><dd>${formatPrice(high)}</dd></div>`;
  view.querySelector('.market-table tbody').innerHTML = prices.slice().reverse().map(({ date, close }) => `<tr>
    <td><time datetime="${date}">${dates.format(Date.parse(date))}</time></td><td>${formatPrice(close)}</td></tr>`).join('');
}
