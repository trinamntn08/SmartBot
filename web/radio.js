import { listenHeader } from './listen.js';
import { escapeHtml } from './news.js';
import { radioStations, radioStreamUrl } from './radio-provider.js';
import { radioRepository } from './radio-repository.js';

const playIcon = '<svg viewBox="0 0 24 24" width="19" height="19" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';
const removeIcon = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
  stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5"/>
</svg>`;

export function renderRadio(view, player, focusHeading) {
  const lifecycle = new AbortController();
  const options = { signal: lifecycle.signal };
  let settings = radioRepository.read();
  let stations;
  view.innerHTML = `<div class="listen">
    ${listenHeader('radio')}
    <section class="radio-stations" aria-labelledby="radio-heading">
      <h2 id="radio-heading">Live stations</h2>
      <ul class="radio-list" role="list"></ul>
      <p class="muted" data-radio-empty hidden>No stations saved.</p>
      <details class="radio-add">
        <summary>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
            stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
            <path d="M5 12h14"/><path class="radio-add-plus" d="M12 5v14"/>
          </svg>
          Add a station
        </summary>
        <form>
          <div class="radio-fields">
            <label>Station name
              <input name="station" maxlength="100" required>
            </label>
            <div>
              <label>Stream URL
                <input name="stream" type="url" maxlength="2048" spellcheck="false"
                  aria-describedby="radio-stream-help" required>
              </label>
              <p id="radio-stream-help" class="muted">Use the station’s direct HTTPS audio link.</p>
            </div>
          </div>
          <button type="submit">Save station</button>
        </form>
      </details>
      <button type="button" class="quiet radio-restore" hidden>Restore default stations</button>
      <p class="radio-status" role="status"></p>
    </section>
  </div>`;
  const list = view.querySelector('.radio-list');
  const form = view.querySelector('.radio-add form');
  const add = view.querySelector('.radio-add summary');
  const empty = view.querySelector('[data-radio-empty]');
  const restore = view.querySelector('.radio-restore');
  const status = view.querySelector('.radio-status');

  function renderStations() {
    stations = [...radioStations.filter(({ url }) => !settings.hidden.includes(url)), ...settings.custom];
    empty.hidden = stations.length > 0;
    list.hidden = !stations.length;
    restore.hidden = !settings.hidden.length;
    list.innerHTML = stations.map(({ name, genre }, index) => `<li>
      <button type="button" class="radio-tune" data-tune="${index}" aria-label="Play ${escapeHtml(name)} live">
        ${playIcon}<span><strong>${escapeHtml(name)}</strong>${genre ? `<small>${genre}</small>` : ''}</span>
      </button>
      <button type="button" class="quiet radio-icon radio-remove" data-remove="${index}"
        aria-label="Remove ${escapeHtml(name)}" title="Remove ${escapeHtml(name)}">${removeIcon}</button>
    </li>`).join('');
  }

  function saveStations(next, message) {
    settings = next;
    const saved = radioRepository.save(settings);
    renderStations();
    status.textContent = saved ? message : `${message} Changes are available for this session only.`;
  }

  list.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    if ('tune' in button.dataset) {
      player.play(stations[Number(button.dataset.tune)]);
      return;
    }
    const index = Number(button.dataset.remove);
    const station = stations[index];
    if (!station) return;
    player.remove(station);
    const next = radioStations.includes(station)
      ? { ...settings, hidden: [...settings.hidden, station.url] }
      : { ...settings, custom: settings.custom.filter(({ url }) => url !== station.url) };
    saveStations(next, `${station.name} removed.`);
    (list.querySelector(`[data-tune="${Math.min(index, stations.length - 1)}"]`) ?? add).focus();
  }, options);

  restore.addEventListener('click', () => {
    const firstRestored = radioStations.findIndex(({ url }) => settings.hidden.includes(url));
    saveStations({ ...settings, hidden: [] }, 'Default stations restored.');
    list.querySelector(`[data-tune="${firstRestored}"]`).focus();
  }, options);

  form.addEventListener('input', event => event.target.setCustomValidity(''), options);
  form.addEventListener('submit', event => {
    event.preventDefault();
    const { station, stream } = form.elements;
    const name = station.value.trim();
    const url = radioStreamUrl(stream.value.trim());
    if (!name) {
      station.setCustomValidity('Enter a station name.');
      station.reportValidity();
      return;
    }
    let streamError = '';
    if (!url) streamError = 'Enter a direct HTTPS audio stream URL.';
    else if (stations.some(item => item.url === url)) streamError = 'This stream is already in your stations.';
    else if (settings.hidden.includes(url)) streamError = 'Use Restore default stations to add this preset again.';
    if (streamError) {
      stream.setCustomValidity(streamError);
      stream.reportValidity();
      return;
    }
    saveStations({ ...settings, custom: [...settings.custom, { name, url }] }, 'Station saved.');
    form.reset();
    form.closest('details').open = false;
    list.lastElementChild.querySelector('[data-tune]').focus();
  }, options);

  renderStations();
  if (focusHeading) view.querySelector('h1').focus();
  return () => lifecycle.abort();
}
