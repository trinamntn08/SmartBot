const regions = [
  ['FR', 'France'],
  ['VN', 'Vietnam'],
  ['US', 'United States'],
];
const picks = [
  ['-Ww_TxYfeLA', 'Về Đi Em', 'Trúc Nhân ft. Rhymastic'],
  ['oiKj0Z_Xnjc', 'Papaoutai', 'Stromae'],
  ['60ItHLz5WEA', 'Faded', 'Alan Walker'],
  ['FN7ALfpGxiI', 'Nơi Này Có Anh', 'Sơn Tùng M-TP'],
  ['VHoT4N43jK8', 'Alors on danse', 'Stromae'],
  ['VPRjCeoBqrI', 'A Sky Full of Stars', 'Coldplay'],
  ['4NRXx6U8ABQ', 'Blinding Lights', 'The Weeknd'],
].map(([id, title, channel]) => ({ id, title, channel, thumbnail: `https://i.ytimg.com/vi/${id}/mqdefault.jpg` }));
const cache = new Map();
const cacheDuration = 15 * 60 * 1000;
const chevron = path => `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
  stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${path}"/></svg>`;
const playIcon = `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
  <path d="M8 5v14l11-7z"/>
</svg>`;

function thumbnailUrl(value) {
  try {
    const url = new URL(value);
    if (url.origin === 'https://i.ytimg.com' && !url.username && !url.password) return url.href;
  } catch { /* A missing thumbnail can use the play icon alone. */ }
  return '';
}

function chartVideos(items) {
  const videos = new Map();
  for (const item of items ?? []) {
    if (item?.status?.embeddable !== true || typeof item.id !== 'string' || !/^[A-Za-z0-9_-]{11}$/.test(item.id)) continue;
    const title = item.snippet?.title;
    if (typeof title !== 'string' || !title.trim()) continue;
    videos.set(item.id, {
      id: item.id, title, channel: item.snippet.channelTitle || 'YouTube',
      thumbnail: thumbnailUrl(item.snippet.thumbnails?.medium?.url),
    });
    if (videos.size === 12) break;
  }
  return [...videos.values()];
}

function videoCard(video, onPlay) {
  const item = document.createElement('li');
  item.innerHTML = `<button class="quiet youtube-video-card" type="button">
    <span class="youtube-cover"><span class="youtube-card-play">${playIcon}</span></span>
    <strong></strong><span class="youtube-channel"></span>
  </button>`;
  const button = item.firstElementChild;
  button.querySelector('strong').textContent = video.title;
  button.querySelector('.youtube-channel').textContent = video.channel;
  button.addEventListener('click', () => onPlay(video));
  if (video.thumbnail) {
    const image = document.createElement('img');
    image.alt = '';
    image.width = 320;
    image.height = 180;
    image.loading = 'lazy';
    image.decoding = 'async';
    image.referrerPolicy = 'no-referrer';
    image.addEventListener('error', () => image.remove(), { once: true });
    image.src = video.thumbnail;
    button.querySelector('.youtube-cover').prepend(image);
  }
  return item;
}

export function createYouTubeShelves(root, request, onPlay) {
  const observer = new ResizeObserver(entries => {
    for (const { target } of entries) syncButtons(target);
  });
  let loading;
  let view;

  function syncButtons(track) {
    const buttons = track.closest('.youtube-shelf')?.querySelector('.youtube-shelf-controls');
    if (!buttons) return;
    const maxScroll = track.scrollWidth - track.clientWidth;
    buttons.hidden = maxScroll <= 1 || track.hidden;
    buttons.firstElementChild.setAttribute('aria-disabled', String(track.scrollLeft <= 1));
    buttons.lastElementChild.setAttribute('aria-disabled', String(track.scrollLeft >= maxScroll - 1));
  }

  function stop() {
    loading?.abort();
    observer.disconnect();
  }

  function show(next, entries, getVideos) {
    if (view === next) return;
    view = next;
    stop();
    loading = new AbortController();
    const { signal } = loading;
    root.innerHTML = entries.map(([code, name]) => {
      const chart = next === 'charts';
      const title = chart ? `Popular in ${name === 'United States' ? 'the ' : ''}${name}` : name;
      const navigation = chart ? ` in ${name}` : '';
      return `<section class="youtube-shelf" aria-labelledby="youtube-chart-${code}">
      <div class="youtube-shelf-heading">
        <h3 id="youtube-chart-${code}">${title}</h3>
        <div class="youtube-shelf-controls" hidden>
          <button type="button" class="listen-tool youtube-icon" aria-label="Previous videos${navigation}" title="Previous videos">${chevron('m14 6-6 6 6 6')}</button>
          <button type="button" class="listen-tool youtube-icon" aria-label="Next videos${navigation}" title="Next videos">${chevron('m10 6 6 6-6 6')}</button>
        </div>
      </div>
      <div class="youtube-shelf-loading" aria-hidden="true"><span></span><span></span><span></span></div>
      <p class="youtube-shelf-status" role="status"></p>
      <ul class="youtube-shelf-track" aria-labelledby="youtube-chart-${code}" hidden></ul>
    </section>`;
    }).join('');
    [...root.children].forEach(async (shelf, index) => {
      const [code] = entries[index];
      const track = shelf.querySelector('ul');
      const feedback = shelf.querySelector('[role="status"]');
      const skeleton = shelf.querySelector('.youtube-shelf-loading');
      const buttons = [...shelf.querySelectorAll('button')];
      buttons.forEach((button, index) => button.addEventListener('click', () => {
        if (button.getAttribute('aria-disabled') === 'true') return;
        const direction = index === 0 ? -1 : 1;
        track.scrollBy({ left: direction * track.clientWidth * 0.8 });
      }));
      try {
        const videos = await getVideos(code, signal);
        if (signal.aborted) return;
        if (videos.length === 0) {
          feedback.textContent = 'No playable videos in this chart right now.';
          return;
        }
        track.replaceChildren(...videos.map(video => videoCard(video, onPlay)));
        track.hidden = false;
        syncButtons(track);
        track.addEventListener('scroll', () => syncButtons(track), { passive: true });
        observer.observe(track);
      } catch {
        if (!signal.aborted) feedback.textContent = navigator.onLine
          ? 'This chart is unavailable right now.' : 'Go online to load this chart.';
      } finally {
        skeleton.remove();
      }
    });
  }

  return {
    load() {
      show('charts', regions, async (code, signal) => {
        const stored = cache.get(code);
        if (stored && Date.now() - stored.time < cacheDuration) return stored.videos;
        const videos = chartVideos((await request(`/chart?region=${code}`, signal)).items);
        if (videos.length && !signal.aborted) cache.set(code, { time: Date.now(), videos });
        return videos;
      });
    },
    showPicks() {
      show('picks', [['picks', 'Music picks']], () => picks);
    },
    stop,
    reset() {
      stop();
      cache.clear();
      view = undefined;
      root.replaceChildren();
    },
  };
}
