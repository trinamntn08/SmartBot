import { hasNativePodcastPlayer, nativePodcast } from './podcast-native.js';

export const franceinfo = {
  title: 'Les informés de franceinfo',
  feedUrl: 'https://radiofrance-podcast.net/podcast09/35099478-7c72-4f9e-a6de-1b928400e9e5/podcast_28147243-2a52-4fc0-a01f-637d8f300f6b.xml',
};

let serviceUrl;

async function getService() {
  if (serviceUrl) return serviceUrl;
  const configured = document.querySelector('meta[name="smartbot-podcast-service"]')?.content.trim();
  const origin = configured || (hasNativePodcastPlayer ? await nativePodcast('configuration') : '');
  if (origin) {
    const url = new URL(origin);
    if (url.protocol === 'https:') serviceUrl = url.origin;
  } else if (['localhost', '127.0.0.1'].includes(location.hostname) && !hasNativePodcastPlayer) {
    serviceUrl = 'http://127.0.0.1:8787';
  }
  if (!serviceUrl) throw new Error('Podcast discovery is unavailable on this build. Saved shows are still here.');
  return serviceUrl;
}

async function request(path, options, signal) {
  if (navigator.onLine === false) throw new Error('You’re offline. Connect to refresh or add podcasts.');
  const origin = await getService();
  let response;
  let payload;
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) abort();
  const timer = setTimeout(abort, 12000);
  signal?.addEventListener('abort', abort, { once: true });
  try {
    response = await fetch(`${origin}/api/podcasts/${path}`, { ...options, signal: controller.signal });
    payload = await response.json();
  } catch {
    if (response?.status === 429) throw new Error('Too many podcast requests. Wait a moment and try again.');
    throw new Error('The podcast service could not be reached. Try again.');
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
  if (!response.ok) throw new Error(payload.error || 'The podcast service is unavailable. Try again.');
  return payload;
}

export function searchPodcasts(query, signal) {
  return request(`search?${new URLSearchParams({ q: query })}`, {}, signal);
}

export function loadPodcast(url, signal) {
  return request('feed', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }),
  }, signal);
}
