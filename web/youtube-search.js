import { createYouTubeShelves } from './youtube-shelves.js';

const approvalKey = 'smartbot-youtube-enabled';
const android = location.origin === 'https://appassets.androidplatform.net';
export const listenSearchIcon = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none"
  stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
  <circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>
</svg>`;

let enabled = false;

function approved() {
  try { return enabled || localStorage.getItem(approvalKey) === 'yes'; }
  catch { return enabled; }
}

async function youtubeRequest(path, signal, key) {
  const options = {
    headers: { 'X-SmartBot-YouTube': 'music' }, cache: 'no-store', signal,
  };
  if (key !== undefined) {
    options.method = 'POST';
    options.mode = 'same-origin';
    options.redirect = 'error';
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify({ key });
  }
  const response = await fetch(`./api/youtube${path}`, options);
  const data = await response.json().catch(() => null);
  if (!data) throw new Error('YouTube search is unavailable. Restart the SmartBot preview or update the Android app.');
  if (!response.ok) throw new Error(data.error || 'YouTube search is unavailable.');
  return data;
}

function showResults(list, items, player) {
  list.replaceChildren();
  for (const item of items ?? []) {
    const id = item?.id?.videoId;
    const title = item?.snippet?.title;
    if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{11}$/.test(id) || typeof title !== 'string' || !title) continue;
    const row = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'quiet youtube-result';
    const name = document.createElement('strong');
    name.textContent = title;
    const channel = document.createElement('span');
    channel.className = 'podcast-notice';
    channel.textContent = item.snippet.channelTitle || 'YouTube';
    button.append(name, channel);
    button.addEventListener('click', () => void player.open({ id, title }));
    row.append(button);
    list.append(row);
  }
}

export function renderYouTubeSearch(root, player, settings, searchToggle) {
  const lifecycle = new AbortController();
  root.innerHTML = `<form id="youtube-song-search" hidden>
      <label class="visually-hidden" for="youtube-query">Song or artist</label>
      <div class="music-choice-row">
        <input id="youtube-query" data-youtube-query name="query" type="search" maxlength="120"
          placeholder="Song or artist" required>
        <button type="submit" class="youtube-icon" aria-label="Search music" title="Search music">${listenSearchIcon}</button>
      </div>
    </form>
    <section class="youtube-approval">
      <p>SmartBot sends requests for charts, song searches, and playback to YouTube.
      By enabling this feature, you agree to these privacy terms and the <a href="https://www.youtube.com/t/terms">YouTube Terms of Service</a>.
      See <a href="https://policies.google.com/privacy">Google’s privacy policy</a>.</p>
      <button type="button" data-enable-youtube>${android ? 'Enable YouTube' : 'Enable YouTube search'}</button>
    </section>
    <div class="youtube-search-tools" hidden>
      <ul id="youtube-song-results" class="youtube-results" aria-label="YouTube video results"></ul>
      <p class="youtube-search-status" role="status"></p>
      <div class="youtube-shelves"></div>
      <details class="music-service-settings" data-youtube-setup hidden>
        <summary>YouTube search setup</summary>
        ${android ? '' : `<form method="post" action="./api/youtube" data-youtube-key hidden>
          <label for="youtube-key">YouTube Data API key</label>
          <div class="music-choice-row">
            <input id="youtube-key" type="password" name="key" autocomplete="off" spellcheck="false"
              autocapitalize="none" maxlength="128" required>
            <button type="submit">Save key</button>
          </div>
        </form>
        <p data-youtube-environment hidden>Set <code>SMARTBOT_YOUTUBE_API_KEY</code> in the preview environment and restart the preview.</p>
        <p><a href="https://console.cloud.google.com/apis/credentials">Google Cloud credentials</a></p>`}
        <p class="youtube-search-status" role="status"></p>
        <p><a href="https://www.youtube.com/t/terms">YouTube terms</a> · <a href="https://policies.google.com/privacy">Google privacy policy</a></p>
        <button type="button" class="quiet" data-disable-youtube>${android ? 'Disable YouTube' : 'Disable YouTube search'}</button>
      </details>
    </div>`;
  const approval = root.querySelector('.youtube-approval');
  const tools = root.querySelector('.youtube-search-tools');
  const form = root.querySelector('#youtube-song-search');
  const input = form.elements.query;
  const setup = root.querySelector('[data-youtube-setup]');
  const setupHeading = setup.querySelector('summary');
  const setupStatus = setup.querySelector('[role="status"]');
  const environmentNotice = setup.querySelector('[data-youtube-environment]');
  const keyForm = root.querySelector('[data-youtube-key]');
  const disable = root.querySelector('[data-disable-youtube]');
  const status = root.querySelector('.youtube-search-status');
  const list = root.querySelector('.youtube-results');
  const shelfList = root.querySelector('.youtube-shelves');
  const shelves = createYouTubeShelves(shelfList, youtubeRequest, video => void player.open(video));
  let configured = false;
  let canSaveKey = false;
  let search;

  for (const link of root.querySelectorAll('a')) {
    if (!android) link.target = '_blank';
    link.rel = 'noopener';
  }

  function showSearch(open) {
    const label = open ? 'Close music search' : 'Search music';
    searchToggle.setAttribute('aria-expanded', String(open));
    searchToggle.setAttribute('aria-label', label);
    searchToggle.title = label;
    form.hidden = !open;
    if (open) {
      input.placeholder = android && !configured ? 'Search YouTube Music' : 'Song or artist';
      input.focus();
    }
    else {
      search?.abort();
      input.value = '';
      list.replaceChildren();
      status.textContent = '';
      shelfList.hidden = false;
      searchToggle.focus();
    }
  }

  function showSettings() {
    if (setup.parentElement === settings) return;
    setup.open = false;
    setupHeading.textContent = android ? 'YouTube settings' : 'Manage YouTube key';
    settings.append(setup);
    setup.hidden = false;
  }

  function showBrowse(focus) {
    configured = true;
    input.placeholder = 'Song or artist';
    showSettings();
    searchToggle.hidden = false;
    shelves.load();
    if (focus) searchToggle.focus();
  }

  async function openBrowse(focus = false) {
    approval.hidden = true;
    tools.hidden = false;
    if (android) {
      showSettings();
      shelves.showPicks();
      searchToggle.hidden = false;
      if (focus) searchToggle.focus();
    }
    try {
      const result = await youtubeRequest('', lifecycle.signal);
      if (lifecycle.signal.aborted) return;
      if (!android) {
        canSaveKey = Boolean(result.canSaveKey);
        keyForm.hidden = !canSaveKey;
        environmentNotice.hidden = canSaveKey;
        disable.textContent = canSaveKey ? 'Disable YouTube search and remove key' : 'Disable YouTube search';
      }
      if (result.configured) {
        status.textContent = '';
        showBrowse(focus);
      }
      else if (!android) {
        setup.hidden = false;
        setup.open = true;
        status.textContent = 'Set up a YouTube Data API key to browse music.';
        if (focus) (canSaveKey ? keyForm.elements.key : setupHeading).focus();
      }
    } catch (error) {
      if (!lifecycle.signal.aborted && !android) status.textContent = navigator.onLine ? error.message : 'Connect to the internet to browse music.';
    }
  }

  root.querySelector('[data-enable-youtube]').addEventListener('click', () => {
    enabled = true;
    try { localStorage.setItem(approvalKey, 'yes'); } catch { /* Enable for this session. */ }
    void openBrowse(true);
  });

  searchToggle.addEventListener('click', () => showSearch(form.hidden), { signal: lifecycle.signal });
  form.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      event.preventDefault();
      showSearch(false);
    }
  });

  disable.addEventListener('click', async event => {
    const button = event.currentTarget;
    button.disabled = true;
    setupStatus.textContent = '';
    try {
      if (canSaveKey) await youtubeRequest('', lifecycle.signal, '');
      player.close();
      showSearch(false);
      searchToggle.hidden = true;
      shelves.reset();
      configured = false;
      enabled = false;
      try { localStorage.removeItem(approvalKey); } catch { /* Disable for this session. */ }
      settings.open = false;
      setup.hidden = true;
      setupHeading.textContent = 'YouTube search setup';
      tools.append(setup);
      tools.hidden = true;
      approval.hidden = false;
      approval.querySelector('button').focus();
    } catch (error) {
      setupStatus.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });

  keyForm?.addEventListener('submit', async event => {
    event.preventDefault();
    const key = event.currentTarget.elements.key;
    const value = key.value.trim();
    if (!value) {
      setupStatus.textContent = 'Enter a YouTube Data API key.';
      return;
    }
    setupStatus.textContent = '';
    const button = event.submitter;
    if (button) button.disabled = true;
    try {
      await youtubeRequest('', lifecycle.signal, value);
      key.value = '';
      if (!lifecycle.signal.aborted) {
        status.textContent = 'Key saved on this computer.';
        settings.open = false;
        setup.open = false;
        showBrowse(true);
      }
    } catch (error) {
      if (!lifecycle.signal.aborted) setupStatus.textContent = error.message;
    } finally {
      if (button) button.disabled = false;
    }
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const query = input.value.trim();
    if (!query) return;
    if (android && !configured) {
      location.assign(`https://music.youtube.com/search?${new URLSearchParams({ q: query })}`);
      return;
    }
    search?.abort();
    const request = search = new AbortController();
    shelfList.hidden = true;
    status.textContent = 'Searching YouTube…';
    list.replaceChildren();
    try {
      const result = await youtubeRequest(`/search?${new URLSearchParams({ q: query })}`, request.signal);
      if (request.signal.aborted) return;
      showResults(list, result.items, player);
      status.textContent = list.childElementCount ? '' : 'No embeddable music videos found.';
    } catch (error) {
      if (!request.signal.aborted) status.textContent = navigator.onLine ? error.message : 'Connect to the internet to search YouTube.';
    }
  });

  window.addEventListener('online', () => {
    if (approved() && !configured) void openBrowse();
  }, { signal: lifecycle.signal });
  if (approved()) void openBrowse();
  return () => {
    lifecycle.abort();
    searchToggle.hidden = true;
    searchToggle.setAttribute('aria-expanded', 'false');
    searchToggle.setAttribute('aria-label', 'Search music');
    searchToggle.title = 'Search music';
    search?.abort();
    shelves.stop();
  };
}
