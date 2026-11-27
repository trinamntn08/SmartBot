import { listenHeader } from './listen.js';
import { escapeHtml } from './news.js';
import { radioStations, radioStreamUrl } from './radio-provider.js';
import { radioRepository } from './radio-repository.js';

const playIcon = '<svg viewBox="0 0 24 24" width="19" height="19" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';

export function renderRadio(view, player, focusHeading) {
  const lifecycle = new AbortController();
  const options = { signal: lifecycle.signal };
  let customStations = radioRepository.read();
  view.innerHTML = `<div class="listen">
    ${listenHeader('radio')}
    <section class="radio-stations" aria-labelledby="radio-heading">
      <h2 id="radio-heading">Live stations</h2>
      <ul class="radio-list" role="list"></ul>
      <details class="radio-add">
        <summary>Add a station</summary>
        <form>
          <label>Station name <input name="station" maxlength="100" required></label>
          <label>Stream URL <input name="stream" type="url" maxlength="2048" required></label>
          <p class="muted">Paste a direct HTTPS audio stream from the station.</p>
          <button type="submit">Save station</button>
        </form>
      </details>
      <p class="radio-status" role="status"></p>
    </section>
  </div>`;
  const list = view.querySelector('.radio-list');
  const form = view.querySelector('.radio-add form');
  const status = view.querySelector('.radio-status');

  function renderStations() {
    list.innerHTML = [...radioStations, ...customStations].map(({ name, genre }, index) => `<li>
      <button type="button" class="radio-tune" data-tune="${index}" aria-label="Play ${escapeHtml(name)} live">
        ${playIcon}<span><strong>${escapeHtml(name)}</strong>${genre ? `<small>${genre}</small>` : ''}</span>
      </button>
      ${genre ? '' : `<button type="button" class="quiet radio-remove" data-remove="${index}" aria-label="Remove ${escapeHtml(name)}">Remove</button>`}
    </li>`).join('');
  }

  function saveStations(stations) {
    customStations = stations;
    const saved = radioRepository.save(stations);
    renderStations();
    status.textContent = saved ? '' : 'Station changes are available for this session only.';
  }

  list.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    if ('tune' in button.dataset) {
      player.play([...radioStations, ...customStations][Number(button.dataset.tune)]);
      return;
    }
    const index = Number(button.dataset.remove) - radioStations.length;
    if (index < 0 || !customStations[index]) return;
    player.remove(customStations[index]);
    saveStations(customStations.filter((_, position) => position !== index));
    (list.querySelector(`[data-tune="${index + radioStations.length}"]`) ?? view.querySelector('.radio-add summary')).focus();
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
    if (!url || [...radioStations, ...customStations].some(item => item.url === url)) {
      stream.setCustomValidity(url ? 'This stream is already in your stations.' : 'Enter a direct HTTPS audio stream URL.');
      stream.reportValidity();
      return;
    }
    saveStations([...customStations, { name, url }]);
    form.reset();
    form.closest('details').open = false;
    list.querySelector(`[data-tune="${radioStations.length + customStations.length - 1}"]`).focus();
  }, options);

  renderStations();
  if (focusHeading) view.querySelector('h1').focus();
  return () => lifecycle.abort();
}
