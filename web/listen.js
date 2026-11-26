const sectionKey = 'smartbot-listen-section';
const serviceKey = 'smartbot-music-service';
const services = {
  spotify: { name: 'Spotify', url: 'https://open.spotify.com/' },
  apple: { name: 'Apple Music', url: 'https://music.apple.com/' },
  youtube: { name: 'YouTube Music', url: 'https://music.youtube.com/' },
  deezer: { name: 'Deezer', url: 'https://www.deezer.com/' },
  soundcloud: { name: 'SoundCloud', url: 'https://soundcloud.com/' },
};

let unsavedService;

function readMusicService() {
  if (unsavedService) return unsavedService;
  try {
    const stored = localStorage.getItem(serviceKey);
    if (Object.hasOwn(services, stored)) return stored;
  } catch {
    // The service can still be selected for this session.
  }
}

export function listeningPage(route) {
  if (route === 'music' || route === 'podcasts') return 'podcasts';
  if (route === 'tracks') return 'tracks';
  if (route !== 'listen') return null;
  try {
    return localStorage.getItem(sectionKey) === 'tracks' ? 'tracks' : 'podcasts';
  } catch {
    return 'podcasts';
  }
}

export function listenHeader(page, action = '') {
  try {
    localStorage.setItem(sectionKey, page);
  } catch {
    // The current section is still usable without browser storage.
  }
  const current = id => page === id ? ' aria-current="page"' : '';
  return `<header class="listen-header">
    <h1 tabindex="-1">Listen</h1>
    <div class="listen-toolbar">
      <nav class="listen-nav" aria-label="Listening sections">
        <a href="#tracks"${current('tracks')}>Music</a>
        <a href="#podcasts"${current('podcasts')}>Podcasts</a>
      </nav>
      ${action}
    </div>
  </header>`;
}

export function renderMusic(view, pausePodcasts, focus) {
  let service = readMusicService();
  const musicNote = `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor"
    stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M9 18V5l12-2v13M9 9l12-2"/><ellipse cx="6" cy="18" rx="3" ry="2.5"/>
    <ellipse cx="18" cy="16" rx="3" ry="2.5"/>
  </svg>`;
  const external = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
    stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M13 5h6v6m0-6-8 8m8 1v5H5V5h5"/>
  </svg>`;
  view.innerHTML = `<div class="listen">
    ${listenHeader('tracks')}
    <div class="music-service"></div>
  </div>`;
  const content = view.querySelector('.music-service');

  function renderService() {
    const selected = services[service];
    const form = `<form class="music-choice">
      <label for="music-service" class="visually-hidden">Music service</label>
      <div class="music-choice-row">
        <select id="music-service" name="service" required>
          <option value="" disabled${selected ? '' : ' selected'}>Select a service</option>
          ${Object.entries(services).map(([id, entry]) =>
            `<option value="${id}"${id === service ? ' selected' : ''}>${entry.name}</option>`).join('')}
        </select>
        <button type="submit">Save</button>
      </div>
    </form>`;
    content.innerHTML = selected ? `
      <a class="music-launch" href="${selected.url}" rel="noopener noreferrer">
        <span class="listen-art">${musicNote}</span>
        <span>Open ${selected.name}</span>
        ${external}
      </a>
      <details class="music-service-settings">
        <summary>Change service</summary>
        ${form}
      </details>` : `
      <section class="music-setup" aria-labelledby="music-setup-title">
        <span class="listen-art">${musicNote}</span>
        <div>
          <h2 id="music-setup-title">Choose a music service</h2>
          ${form}
        </div>
      </section>`;
    const launch = content.querySelector('.music-launch');
    if (launch) {
      if (location.origin !== 'https://appassets.androidplatform.net') launch.target = '_blank';
      launch.addEventListener('click', pausePodcasts);
    }
    content.querySelector('form').addEventListener('submit', event => {
      event.preventDefault();
      const choice = event.currentTarget.elements.service.value;
      if (!Object.hasOwn(services, choice)) return;
      service = choice;
      try {
        localStorage.setItem(serviceKey, choice);
        unsavedService = undefined;
      } catch {
        unsavedService = choice;
      }
      renderService();
      content.querySelector('.music-launch').focus();
    });
  }
  renderService();
  if (focus) view.querySelector('h1').focus();
}
