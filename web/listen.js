import { spotifyOrigin } from './spotify-player.js';
import { renderYouTubeSearch } from './youtube-search.js';

const sectionKey = 'smartbot-listen-section';
const serviceKey = 'smartbot-music-service';
const playlistKey = 'smartbot-spotify-playlist';
const services = {
  spotify: { name: 'Spotify', url: `${spotifyOrigin}/` },
  apple: { name: 'Apple Music', url: 'https://music.apple.com/' },
  youtube: { name: 'YouTube Music', url: 'https://music.youtube.com/' },
  deezer: { name: 'Deezer', url: 'https://www.deezer.com/' },
  soundcloud: { name: 'SoundCloud', url: 'https://soundcloud.com/' },
};

let unsavedService;
let unsavedPlaylist;

function readMusicService() {
  if (unsavedService) return unsavedService;
  try {
    const stored = localStorage.getItem(serviceKey);
    if (Object.hasOwn(services, stored)) return stored;
  } catch {
    // The service can still be selected for this session.
  }
}

function readSpotifyPlaylist() {
  if (unsavedPlaylist !== undefined) return unsavedPlaylist;
  try {
    const id = localStorage.getItem(playlistKey);
    if (/^[a-zA-Z0-9]{22}$/.test(id ?? '')) return id;
  } catch {
    // The playlist can still be selected for this session.
  }
  return '';
}

function spotifyPlaylistId(value) {
  const uriId = /^spotify:playlist:([a-zA-Z0-9]{22})$/.exec(value)?.[1];
  if (uriId) return uriId;
  try {
    const url = new URL(value);
    if (url.origin !== spotifyOrigin || url.username || url.password) return '';
    return /^\/(?:intl-[a-z]{2}(?:-[a-z]{2})?\/|embed\/)?playlist\/([a-zA-Z0-9]{22})\/?$/.exec(url.pathname)?.[1] ?? '';
  } catch {
    return '';
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

export function renderMusic(view, spotifyPlayer, youtubePlayer, pausePodcasts, focus) {
  let service = readMusicService();
  let playlist = readSpotifyPlaylist();
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
  let stopYouTubeSearch;

  function savePlaylist(id) {
    playlist = id;
    try {
      if (id) localStorage.setItem(playlistKey, id);
      else localStorage.removeItem(playlistKey);
      unsavedPlaylist = undefined;
    } catch {
      unsavedPlaylist = id;
    }
    renderService(!id);
    if (id) spotifyPlayer.open(id);
    else {
      spotifyPlayer.close();
      content.querySelector('[name="playlist"]').focus();
    }
  }

  function spotifyMarkup(showPlaylistForm) {
    const playlistUrl = playlist ? `${spotifyOrigin}/playlist/${playlist}` : '';
    const playlistForm = `<form class="music-choice" data-spotify-playlist>
      <label for="spotify-playlist" class="visually-hidden">Spotify playlist link</label>
      <div class="music-choice-row">
        <input id="spotify-playlist" name="playlist" type="text" inputmode="url"
          spellcheck="false" autocapitalize="none" maxlength="2048" placeholder="Paste playlist link" value="${playlistUrl}" required>
        <button type="submit" aria-label="Save playlist">Save</button>
      </div>
    </form>`;
    if (!playlist) return `
      <details class="music-service-settings"${showPlaylistForm ? ' open' : ''}>
        <summary>Add a Spotify playlist</summary>
        ${playlistForm}
      </details>`;
    return `
      <button type="button" class="listen-tool spotify-open" data-open-spotify aria-controls="spotify-player">
        Saved Spotify playlist
      </button>
      <details class="music-service-settings">
        <summary>Change playlist</summary>
        ${playlistForm}
        <div class="spotify-actions">
          <button type="button" class="quiet" data-remove-playlist>Remove playlist</button>
          <a class="music-secondary-link" href="${playlistUrl}" rel="noopener noreferrer">Open in Spotify ${external}</a>
        </div>
      </details>`;
  }

  function renderService(showPlaylistForm = false) {
    stopYouTubeSearch?.();
    stopYouTubeSearch = undefined;
    const selected = services[service];
    const form = `<form class="music-choice" data-music-choice>
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
      ${service === 'youtube' ? '<section class="youtube-search" aria-labelledby="youtube-search-title"></section>' : `<a class="music-launch" href="${selected.url}" rel="noopener noreferrer">
        <span class="listen-art">${musicNote}</span>
        <span>Open ${selected.name}</span>
        ${external}
      </a>`}
      ${service === 'spotify' ? spotifyMarkup(showPlaylistForm) : ''}
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
    const youtubeSearch = content.querySelector('.youtube-search');
    if (youtubeSearch) stopYouTubeSearch = renderYouTubeSearch(youtubeSearch, youtubePlayer);
    for (const link of content.querySelectorAll('.music-launch, .music-secondary-link, .youtube-source')) {
      if (location.origin !== 'https://appassets.androidplatform.net') link.target = '_blank';
      link.addEventListener('click', () => {
        spotifyPlayer.close();
        youtubePlayer.close();
        pausePodcasts();
      });
    }
    content.querySelector('[data-open-spotify]')?.addEventListener('click', () => spotifyPlayer.open(playlist));
    const playlistForm = content.querySelector('[data-spotify-playlist]');
    if (playlistForm) {
      const input = playlistForm.elements.playlist;
      input.addEventListener('input', () => input.setCustomValidity(''));
      playlistForm.addEventListener('submit', event => {
        event.preventDefault();
        const id = spotifyPlaylistId(input.value.trim());
        if (!id) {
          input.setCustomValidity('Paste an open.spotify.com playlist link.');
          input.reportValidity();
        } else if (id === playlist) {
          playlistForm.closest('details').open = false;
          spotifyPlayer.open(id);
        } else {
          savePlaylist(id);
        }
      });
      content.querySelector('[data-remove-playlist]')?.addEventListener('click', () => savePlaylist(''));
    }
    content.querySelector('[data-music-choice]').addEventListener('submit', event => {
      event.preventDefault();
      const choice = event.currentTarget.elements.service.value;
      if (!Object.hasOwn(services, choice)) return;
      if (choice !== 'spotify') spotifyPlayer.close();
      if (choice !== 'youtube') youtubePlayer.close();
      service = choice;
      try {
        localStorage.setItem(serviceKey, choice);
        unsavedService = undefined;
      } catch {
        unsavedService = choice;
      }
      renderService();
      const showApproval = content.querySelector('.youtube-approval:not([hidden]) button');
      (showApproval ?? content.querySelector('.youtube-source, .music-launch')).focus();
    });
  }
  renderService();
  if (focus) view.querySelector('h1').focus();
  return () => stopYouTubeSearch?.();
}
