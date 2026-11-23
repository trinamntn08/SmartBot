// The local preview fingerprints the web files. Bump the fallback for static hosts.
const cachePrefix = `smartbot:${self.registration.scope}:`;
const cacheName = `${cachePrefix}${self.smartBotPreviewRevision ?? 'v8'}`;
const files = [
  'index.html', 'styles.css', 'app.js', 'planner.js', 'repository.js',
  'books.js', 'library-repository.js', 'text-book.js',
  'news.js', 'news-provider.js', 'news-repository.js',
  'workspace.js', 'assistant.js', 'assets/books.webp', 'assets/sections.webp',
  'assets/dm-sans.woff2', 'assets/instrument-serif.woff2',
];
const urls = files.map((file) => new URL(file, self.registration.scope).href);

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(cacheName).then(async (cache) => {
    await cache.addAll(urls.map((url) => new Request(url, { cache: 'reload' })));
    if (self.smartBotPreviewRevision) await self.skipWaiting();
  }));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(Promise.all([
    caches.keys().then((keys) => Promise.all(keys
      .filter((key) => key.startsWith(cachePrefix) && key !== cacheName)
      .map((key) => caches.delete(key)))),
    self.clients.claim(),
  ]));
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  const isHome = event.request.mode === 'navigate' && url.origin + url.pathname === self.registration.scope;
  const cachedUrl = isHome ? urls[0] : url.href;
  if (!urls.includes(cachedUrl)) return;
  event.respondWith(caches.open(cacheName).then(async (cache) => (
    await cache.match(cachedUrl) ?? fetch(event.request)
  )));
});
