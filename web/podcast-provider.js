import { hasNativePodcastPlayer, nativePodcast } from './podcast-native.js';
import { parsePodcastFeed, podcastUrl } from './podcast-rss.js';

export const franceinfo = {
  title: 'Les informés de franceinfo',
  publisher: 'franceinfo',
  feedUrl: 'https://radiofrance-podcast.net/podcast09/35099478-7c72-4f9e-a6de-1b928400e9e5/podcast_28147243-2a52-4fc0-a01f-637d8f300f6b.xml',
};

let serviceUrl;

function httpsOrigin(value) {
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' && !url.username && !url.password) return url.origin;
  } catch {
    // No hosted service is configured.
  }
  return null;
}

async function getService() {
  if (navigator.onLine === false) throw new Error('You’re offline. Connect to refresh or add podcasts.');
  if (serviceUrl !== undefined) return serviceUrl;
  const android = location.origin === 'https://appassets.androidplatform.net';
  const configured = document.querySelector('meta[name="smartbot-podcast-service"]')?.content.trim();
  const origin = httpsOrigin(configured || (hasNativePodcastPlayer ? await nativePodcast('configuration').catch(() => '') : ''));
  if (origin) serviceUrl = origin;
  else if (android) serviceUrl = null;
  else if (['localhost', '127.0.0.1'].includes(location.hostname)) {
    serviceUrl = 'http://127.0.0.1:8787';
  } else {
    throw new Error('Podcast discovery is unavailable on this build. Saved shows are still here.');
  }
  return serviceUrl;
}

async function request(url, options, signal, read = response => response.json()) {
  let payload;
  let response;
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) abort();
  const timer = setTimeout(abort, 12000);
  signal?.addEventListener('abort', abort, { once: true });
  try {
    response = await fetch(url, { ...options, signal: controller.signal });
    payload = await (response.ok ? read(response) : response.json());
  } catch {
    if (response?.status === 429) throw new Error('Too many podcast requests. Wait a moment and try again.');
    throw new Error('The podcast service could not be reached. Try again.');
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
  if (!response.ok) throw new Error(payload?.error || 'The podcast service is unavailable. Try again.');
  return payload;
}

export async function searchPodcasts(query, signal) {
  const origin = await getService();
  const path = `/api/podcasts/search?${new URLSearchParams({ q: query })}`;
  if (origin) return request(origin + path, {}, signal);

  const searchable = value => value.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
  const words = searchable(query.trim()).split(/\s+/);
  const suggested = words[0] && words.every(word => searchable(franceinfo.title).includes(word));
  const shows = new Map(suggested ? [[franceinfo.feedUrl, franceinfo]] : []);
  try {
    const { results } = await request('.' + path, {}, signal);
    if (!Array.isArray(results)) throw new Error('Podcast search is unavailable. You can still paste an RSS feed link.');
    for (const result of results) {
      const url = podcastUrl(result?.feedUrl);
      const title = typeof result?.collectionName === 'string' ? result.collectionName.trim().slice(0, 300) : '';
      if (!url || !title || shows.has(url.href)) continue;
      const publisher = typeof result.artistName === 'string' ? result.artistName.trim().slice(0, 300) : '';
      shows.set(url.href, { feedUrl: url.href, title, publisher: publisher || url.hostname });
    }
    return { shows: [...shows.values()].slice(0, 15), limited: false };
  } catch (error) {
    if (suggested && !signal?.aborted) return { shows: [franceinfo], limited: true };
    throw error;
  }
}

export async function loadPodcast(url, signal) {
  const origin = await getService();
  if (origin) {
    return request(`${origin}/api/podcasts/feed`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }),
    }, signal);
  }
  const normalized = podcastUrl(url);
  if (!normalized) throw new Error('Enter a public HTTPS podcast RSS link.');
  const query = new URLSearchParams({ url: normalized.href });
  const { body, feedUrl } = await request(`./api/podcasts/feed?${query}`, {}, signal, async response => ({
    body: await response.arrayBuffer(), feedUrl: response.headers.get('X-SmartBot-Feed-Url'),
  }));
  return parsePodcastFeed(body, feedUrl || normalized.href);
}
