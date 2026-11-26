const approvalKey = 'smartbot-youtube-enabled';
const bridge = globalThis.SmartBotYouTube;
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

export function renderYouTubeSearch(root, player) {
  const lifecycle = new AbortController();
  root.innerHTML = `<h2 id="youtube-search-title">Search YouTube music videos</h2>
    <section class="youtube-approval">
      <p>SmartBot sends search terms and playback requests to YouTube. Your key stays on this device.
      By enabling this feature, you agree to these privacy terms and the <a href="https://www.youtube.com/t/terms">YouTube Terms of Service</a>.
      See <a href="https://policies.google.com/privacy">Google’s privacy policy</a>.</p>
      <button type="button" data-enable-youtube>Enable YouTube search</button>
    </section>
    <div class="youtube-search-tools" hidden>
      <form data-youtube-search>
        <label class="visually-hidden" for="youtube-query">Song or artist</label>
        <div class="music-choice-row">
          <input id="youtube-query" data-youtube-query name="query" type="search" maxlength="120"
            placeholder="Search songs or artists" required>
          <button type="submit">Search</button>
        </div>
      </form>
      <p class="youtube-search-status" role="status"></p>
      <ul class="youtube-results" aria-label="YouTube video results"></ul>
      <details class="music-service-settings" data-youtube-setup>
        <summary>YouTube search setup</summary>
        <form method="post" action="./api/youtube" data-youtube-key${bridge ? '' : ' hidden'}>
          <label for="youtube-key">YouTube Data API key</label>
          <div class="music-choice-row">
            <input id="youtube-key" type="password" name="key" autocomplete="off" spellcheck="false"
              autocapitalize="none" maxlength="128" required>
            <button type="submit">Save key</button>
          </div>
        </form>
        <p data-youtube-environment hidden>Set <code>SMARTBOT_YOUTUBE_API_KEY</code> in the preview environment and restart the preview.</p>
        <p><a href="https://console.cloud.google.com/apis/credentials">Google Cloud credentials</a></p>
        <p><a href="https://www.youtube.com/t/terms">YouTube terms</a> · <a href="https://policies.google.com/privacy">Google privacy policy</a></p>
        <button type="button" class="quiet" data-disable-youtube>Disable YouTube search${bridge ? ' and remove key' : ''}</button>
      </details>
    </div>`;
  const approval = root.querySelector('.youtube-approval');
  const tools = root.querySelector('.youtube-search-tools');
  const form = root.querySelector('[data-youtube-search]');
  const input = form.elements.query;
  const setup = root.querySelector('[data-youtube-setup]');
  const keyForm = root.querySelector('[data-youtube-key]');
  const disable = root.querySelector('[data-disable-youtube]');
  const status = root.querySelector('.youtube-search-status');
  const list = root.querySelector('.youtube-results');
  let canSaveKey = Boolean(bridge);
  let search;

  for (const link of root.querySelectorAll('a')) {
    if (!bridge) link.target = '_blank';
    link.rel = 'noopener';
  }

  async function openSearch(focus = false) {
    approval.hidden = true;
    tools.hidden = false;
    if (focus) input.focus();
    try {
      const result = await youtubeRequest('', lifecycle.signal);
      canSaveKey = Boolean(bridge || result.canSaveKey);
      keyForm.hidden = !canSaveKey;
      root.querySelector('[data-youtube-environment]').hidden = canSaveKey;
      disable.textContent = canSaveKey ? 'Disable YouTube search and remove key' : 'Disable YouTube search';
      if (!result.configured) {
        setup.open = true;
        status.textContent = 'Set up a YouTube Data API key to search.';
        if (focus && canSaveKey && document.activeElement === input) keyForm.elements.key.focus();
      }
    } catch (error) {
      if (!lifecycle.signal.aborted) status.textContent = navigator.onLine ? error.message : 'Connect to the internet to search YouTube.';
    }
  }

  root.querySelector('[data-enable-youtube]').addEventListener('click', () => {
    enabled = true;
    try { localStorage.setItem(approvalKey, 'yes'); } catch { /* Enable for this session. */ }
    void openSearch(true);
  });

  disable.addEventListener('click', async event => {
    const button = event.currentTarget;
    button.disabled = true;
    try {
      if (canSaveKey) await saveKey('', lifecycle.signal);
      player.close();
      search?.abort();
      enabled = false;
      try { localStorage.removeItem(approvalKey); } catch { /* Disable for this session. */ }
      list.replaceChildren();
      status.textContent = '';
      tools.hidden = true;
      approval.hidden = false;
      approval.querySelector('button').focus();
    } catch (error) {
      status.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });

  keyForm.addEventListener('submit', async event => {
    event.preventDefault();
    const key = event.currentTarget.elements.key;
    const value = key.value.trim();
    if (!value) {
      status.textContent = 'Enter a YouTube Data API key.';
      return;
    }
    const button = event.submitter;
    if (button) button.disabled = true;
    try {
      await saveKey(value, lifecycle.signal);
      key.value = '';
      if (!lifecycle.signal.aborted) {
        status.textContent = bridge ? 'YouTube search is ready.' : 'Key saved on this computer.';
        setup.open = false;
        input.focus();
      }
    } catch (error) {
      if (!lifecycle.signal.aborted) status.textContent = error.message;
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

  if (approved()) void openSearch();
  return () => {
    lifecycle.abort();
    search?.abort();
  };
}
