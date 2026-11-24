import { activityCategories, summarizeActivity } from './activity.js';
import { escapeHtml } from './news.js';
import { localDay } from './planner.js';
import { hasNativePodcastPlayer, nativePodcast } from './podcast-native.js';

function duration(ms) {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return ms === 0 ? '0 min' : seconds ? `${seconds} sec` : '<1 sec';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} hr${minutes % 60 ? ` ${minutes % 60} min` : ''}`;
}

const number = new Intl.NumberFormat();
const count = (amount, singular) => `${number.format(amount)} ${singular}${amount === 1 ? '' : 's'}`;

function details({ ms, pages, sections }) {
  return [pages && count(pages, 'page'), sections && count(sections, 'section'), ms && duration(ms)]
    .filter(Boolean).join(' · ');
}

export function renderToday(view, { date, dateLabel, plan, routineMarkup, planOpen, repository, trackingError }) {
  view.innerHTML = `<header class="today-heading">
    <h1 tabindex="-1">Today</h1>
    <time datetime="${date}">${dateLabel}</time>
  </header>
  <dl class="today-metrics" aria-label="Daily activity totals" aria-busy="true">
    <div><dt>Activity time</dt><dd data-total="time">—</dd></div>
    <div><dt>Pages read</dt><dd data-total="pages">—</dd></div>
    <div><dt>Listening</dt><dd data-total="listening">—</dd></div>
  </dl>
  <p class="today-report-note muted" data-report-note role="status">Loading activity…</p>
  <div class="today-layout">
    <div class="today-log">
      <details class="card today-disclosure" data-log>
        <summary>Log activity</summary>
        <form>
          <label>Activity
            <select name="category">${activityCategories.map(({ id, label }) => `<option value="${id}">${label}</option>`).join('')}</select>
          </label>
          <label>Title or topic (optional)<input name="topic" maxlength="160"></label>
          <label><span data-minutes-label>Minutes</span><input type="number" name="minutes" min="1" max="1440" inputmode="numeric"></label>
          <label data-pages>Pages read (optional)<input type="number" name="pages" min="1" max="100000" inputmode="numeric"></label>
          <button type="submit">Save activity</button>
        </form>
      </details>
      <p class="today-feedback muted" data-log-status role="status"></p>
      <details class="today-manual" hidden>
        <summary>Manual entries</summary>
        <ul role="list"></ul>
      </details>
    </div>
    <section class="today-activity" aria-labelledby="today-activity-title">
      <h2 id="today-activity-title">Time by activity</h2>
      <ul class="today-breakdown" role="list">${activityCategories.map(({ id, label, route }) => `
        <li data-category="${id}">
          <div class="today-row">
            <h3>${route ? `<a href="#${route}">${label}</a>` : label}</h3>
            <span data-category-time>—</span>
          </div>
          <div class="today-bar" aria-hidden="true"><span></span></div>
          <ul class="today-topics" data-topics role="list" hidden></ul>
        </li>`).join('')}</ul>
    </section>
    <details class="card today-disclosure today-routine"${planOpen || plan?.reading?.status === 'started' ? ' open' : ''}>
      <summary>Reading plan</summary>
      ${routineMarkup}
    </details>
  </div>`;

  const note = view.querySelector('[data-report-note]');
  const metrics = view.querySelector('.today-metrics');
  const log = view.querySelector('[data-log]');
  const status = view.querySelector('[data-log-status]');
  const form = log.querySelector('form');
  const manual = view.querySelector('.today-manual');
  const list = manual.querySelector('ul');
  let sequence = 0;
  let busy = false;
  let latestEntries;

  function drawManual(entries) {
    const logged = entries.filter(entry => entry.manual).sort((a, b) => b.createdAt - a.createdAt);
    const version = logged.map(entry => entry.id).join();
    if (version === latestEntries) return;
    latestEntries = version;
    manual.hidden = !logged.length;
    list.innerHTML = logged.map(entry => {
      const label = activityCategories.find(({ id }) => entry.category === id).label;
      const name = escapeHtml(entry.topic || label);
      return `<li><div><strong>${name}</strong><small>${escapeHtml(details(entry))}</small></div>
        <button class="quiet" type="button" data-remove="${entry.id}" aria-label="Remove entry for ${name}">Remove</button></li>`;
    }).join('');
  }

  async function load() {
    if (!note.isConnected) return;
    const request = ++sequence;
    const [local, native] = await Promise.allSettled([
      repository.day(date), hasNativePodcastPlayer ? nativePodcast('activity', { date }) : [],
    ]);
    if (request !== sequence || !note.isConnected) return;
    const entries = local.status === 'fulfilled' ? local.value : [];
    const groups = summarizeActivity([...entries, ...(Array.isArray(native.value) ? native.value : [])], plan?.reading);
    const total = groups.reduce((sum, group) => sum + group.ms, 0);
    const pages = groups.reduce((sum, group) => sum + group.pages, 0);
    const listening = groups.filter(group => ['podcasts', 'music'].includes(group.id)).reduce((sum, group) => sum + group.ms, 0);
    metrics.querySelector('[data-total="time"]').textContent = duration(total);
    metrics.querySelector('[data-total="pages"]').textContent = number.format(pages);
    metrics.querySelector('[data-total="listening"]').textContent = duration(listening);
    metrics.removeAttribute('aria-busy');

    for (const { id, ms, details: topics } of groups) {
      const row = view.querySelector(`[data-category="${id}"]`);
      row.querySelector('[data-category-time]').textContent = duration(ms);
      row.querySelector('.today-bar span').style.inlineSize = total ? `${100 * ms / total}%` : '0';
      const topicList = row.querySelector('[data-topics]');
      topicList.hidden = !topics.length;
      topicList.innerHTML = topics.map(topic => `<li><span>${escapeHtml(topic.label)}</span><span>${escapeHtml(details(topic))}</span></li>`).join('');
    }
    drawManual(entries);

    const message = local.status === 'rejected' ? 'Could not open saved activity on this device.'
      : native.status === 'rejected' ? 'Android listening time is temporarily unavailable.'
        : trackingError() ? 'Some activity could not be saved on this device.'
          : groups.some(group => group.details.length) ? '' : 'Open a book, read the news, or play a podcast to start tracking.';
    if (note.textContent !== message) note.textContent = message;
    note.hidden = !message;
  }

  const fields = form.elements;
  function syncFields() {
    const isReading = fields.category.value === 'reading';
    form.querySelector('[data-minutes-label]').textContent = isReading ? 'Minutes (optional with pages)' : 'Minutes';
    fields.pages.disabled = !isReading;
    fields.pages.closest('label').hidden = !isReading;
    fields.minutes.required = !isReading;
    fields.minutes.setCustomValidity('');
  }
  fields.category.addEventListener('change', syncFields);
  form.addEventListener('input', () => fields.minutes.setCustomValidity(''));
  log.addEventListener('toggle', () => { if (log.open) status.textContent = ''; });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy) return;
    const minutes = fields.minutes.valueAsNumber || 0;
    const pages = fields.pages.disabled ? 0 : fields.pages.valueAsNumber || 0;
    if (!pages && !minutes) {
      fields.minutes.setCustomValidity('Enter minutes or pages read.');
      fields.minutes.reportValidity();
      return;
    }
    const button = form.querySelector('button[type="submit"]');
    busy = true;
    button.disabled = true;
    try {
      const current = localDay().date;
      await repository.add({
        date: current, id: `manual:${crypto.randomUUID()}`, category: fields.category.value,
        topic: fields.topic.value.trim(), ms: minutes * 60_000, pages, manual: true, createdAt: Date.now(),
      });
      form.reset();
      syncFields();
      log.open = false;
      log.querySelector('summary').focus({ preventScroll: true });
      status.textContent = 'Activity saved.';
      await load();
    } catch {
      status.textContent = 'Could not save activity. Try again.';
    } finally {
      button.disabled = false;
      busy = false;
    }
  });
  list.addEventListener('click', async event => {
    const button = event.target.closest('[data-remove]');
    if (!button || busy) return;
    busy = true;
    button.disabled = true;
    try {
      await repository.remove(date, button.dataset.remove);
      await load();
      (list.querySelector('button') ?? log.querySelector('summary')).focus({ preventScroll: true });
      status.textContent = 'Entry removed.';
    } catch {
      button.disabled = false;
      status.textContent = 'Could not remove the entry. Try again.';
    } finally {
      busy = false;
    }
  });
  void load();
  return load;
}
