import { createYouTubeShelves } from './youtube-shelves.js';

const approvalKey = 'smartbot-youtube-enabled';
const bridge = globalThis.SmartBotYouTube;
const searchIcon = `<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor"
  stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/></svg>`;
const closeSearchIcon = `<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor"
  stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>`;
let enabled = false;
let pendingKey;

if (bridge) {
  bridge.onmessage = event => {
    const pending = pendingKey;
    if (!pending) return;
    try {
      const result = JSON.parse(event.data);
      if (result.error) throw new Error(result.error);
      pending.resolve(result.configured);
    } catch (error) {
      pending.reject(error);
    }
  };
}

function saveNativeKey(value) {
  if (pendingKey) return Promise.reject(new Error('A key change is already in progress.'));
  const response = new Promise((resolve, reject) => {
    pendingKey = { resolve, reject };
  });
  const timeout = setTimeout(() => pendingKey?.reject(new Error('The Android app did not respond.')), 5000);
  try {
    bridge.postMessage(value);
  } catch (error) {
    pendingKey.reject(error);
  }
  return response.finally(() => {
    clearTimeout(timeout);
    pendingKey = undefined;
  });
}

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

function saveKey(key, signal) {
  return bridge ? saveNativeKey(key) : youtubeRequest('', signal, key);
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

export function renderYouTubeSearch(root, player, settings) {
  const lifecycle = new AbortController();
  root.innerHTML = `<div class="youtube-browse-header">
    <h2 id="youtube-search-title">Browse music</h2>
    <form id="youtube-song-search" class="youtube-browse-search" hidden>
      <label class="visually-hidden" for="youtube-query">Song or artist</label>
      <div class="music-choice-row">
        <input id="youtube-query" data-youtube-query name="query" type="search" maxlength="120"
          placeholder="Song or artist" required>
        <button type="submit" class="youtube-icon" aria-label="Search" title="Search">${searchIcon}</button>
      </div>
    </form>
    <div class="youtube-browse-actions">
      <a class="youtube-source" href="https://music.youtube.com/" aria-label="Open YouTube Music" title="Open YouTube Music">
        <img class="youtube-logo-light" src="./assets/youtube-logo.svg" alt="" width="76" height="18">
        <img class="youtube-logo-dark" src="./assets/youtube-logo-dark.svg" alt="" width="76" height="18">
      </a>
      <button type="button" class="listen-tool youtube-icon" data-youtube-search-toggle hidden
        aria-expanded="false" aria-controls="youtube-song-search youtube-song-results" aria-label="Search music" title="Search music">${searchIcon}</button>
    </div>
  </div>
    <section class="youtube-approval">
      <p>SmartBot sends requests for charts, song searches, and playback to YouTube. Your key stays on this device.
      By enabling this feature, you agree to these privacy terms and the <a href="https://www.youtube.com/t/terms">YouTube Terms of Service</a>.
      See <a href="https://policies.google.com/privacy">Google’s privacy policy</a>.</p>
      <button type="button" data-enable-youtube>Enable YouTube search</button>
    </section>
    <div class="youtube-search-tools" hidden>
      <ul id="youtube-song-results" class="youtube-results" aria-label="YouTube video results"></ul>
      <p class="youtube-search-status" role="status"></p>
      <div class="youtube-shelves"></div>
      <details class="music-service-settings" data-youtube-setup hidden>
        <summary>YouTube search setup</summary>
        <form method="post" action="./api/youtube" data-youtube-key${bridge ? '' : ' hidden'}>
          <label for="youtube-key">YouTube Data API key</label>
          <div class="music-choice-row">
            <input id="youtube-key" type="password" name="key" autocomplete="off" spellcheck="false"
              autocapitalize="none" maxlength="128" required>
            <button type="submit">Save key</button>
          </div>
        </form>
        <p class="youtube-search-status" role="status"></p>
        <p data-youtube-environment hidden>Set <code>SMARTBOT_YOUTUBE_API_KEY</code> in the preview environment and restart the preview.</p>
        <p><a href="https://console.cloud.google.com/apis/credentials">Google Cloud credentials</a></p>
        <p><a href="https://www.youtube.com/t/terms">YouTube terms</a> · <a href="https://policies.google.com/privacy">Google privacy policy</a></p>
        <button type="button" class="quiet" data-disable-youtube>Disable YouTube search${bridge ? ' and remove key' : ''}</button>
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
  const searchToggle = root.querySelector('[data-youtube-search-toggle]');
  const shelfList = root.querySelector('.youtube-shelves');
  const shelves = createYouTubeShelves(shelfList, youtubeRequest, video => void player.open(video));
  let configured = false;
  let canSaveKey = Boolean(bridge);
  let search;

  for (const link of root.querySelectorAll('a')) {
    if (!bridge) link.target = '_blank';
    link.rel = 'noopener';
  }

  function showSearch(open) {
    const label = open ? 'Close music search' : 'Search music';
    searchToggle.setAttribute('aria-expanded', String(open));
    searchToggle.setAttribute('aria-label', label);
    searchToggle.title = label;
    searchToggle.innerHTML = open ? closeSearchIcon : searchIcon;
    form.hidden = !open;
    if (open) input.focus();
    else {
      search?.abort();
      input.value = '';
      list.replaceChildren();
      status.textContent = '';
      shelfList.hidden = false;
      searchToggle.focus();
    }
  }

  function showBrowse(focus) {
    configured = true;
    setup.open = false;
    setupHeading.textContent = 'Manage YouTube key';
    settings.append(setup);
    setup.hidden = false;
    searchToggle.hidden = false;
    shelves.load();
    if (focus) searchToggle.focus();
  }

  async function openBrowse(focus = false) {
    approval.hidden = true;
    tools.hidden = false;
    try {
      const result = await youtubeRequest('', lifecycle.signal);
      if (lifecycle.signal.aborted) return;
      canSaveKey = Boolean(bridge || result.canSaveKey);
      keyForm.hidden = !canSaveKey;
      environmentNotice.hidden = canSaveKey;
      disable.textContent = canSaveKey ? 'Disable YouTube search and remove key' : 'Disable YouTube search';
      if (result.configured) showBrowse(focus);
      else {
        setup.hidden = false;
        setup.open = true;
        status.textContent = 'Set up a YouTube Data API key to browse music.';
        if (focus) (canSaveKey ? keyForm.elements.key : setupHeading).focus();
      }
    } catch (error) {
      if (!lifecycle.signal.aborted) status.textContent = navigator.onLine ? error.message : 'Connect to the internet to browse music.';
    }
  }

  root.querySelector('[data-enable-youtube]').addEventListener('click', () => {
    enabled = true;
    try { localStorage.setItem(approvalKey, 'yes'); } catch { /* Enable for this session. */ }
    void openBrowse(true);
  });

  searchToggle.addEventListener('click', () => showSearch(form.hidden));
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
      if (canSaveKey) await saveKey('', lifecycle.signal);
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

  keyForm.addEventListener('submit', async event => {
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
      await saveKey(value, lifecycle.signal);
      key.value = '';
      if (!lifecycle.signal.aborted) {
        status.textContent = bridge ? 'YouTube search is ready.' : 'Key saved on this computer.';
        settings.open = false;
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
    search?.abort();
    shelves.stop();
  };
}
