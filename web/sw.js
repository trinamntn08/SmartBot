importScripts('./vendor/pdfjs/cache-files.js');

// The local preview fingerprints the web files. Bump the fallback for static hosts.
const cachePrefix = `smartbot:${self.registration.scope}:`;
const cacheName = `${cachePrefix}${self.smartBotPreviewRevision ?? 'v80'}`;
const files = [
  'index.html', 'appearance.js', 'appearance.css', 'styles.css', 'app.js', 'planner.js', 'repository.js',
  'today.css', 'today.js', 'activity.js', 'activity-repository.js',
  'markets.css', 'markets.js', 'market-chart.js', 'market-provider.js', 'market-repository.js', 'assets/markets.webp',
  'market-archive.js', 'market-crypto.js', 'market-symbols.js', 'vendor/market-parquet/parquet.js',
  'market-vietnam.js', 'assets/market-closes.json', 'assets/market-catalog.json', 'assets/market-vietnam-catalog.json',
  'market-euronext.js',
  'books.js', 'book-reader.js', 'book-reader.css', 'book-pagination.js', 'library-repository.js',
  'text-book.js', 'pdf-book.js', 'epub-book.js',
  'vendor/pdfjs/pdf.min.js', 'vendor/pdfjs/pdf.worker.min.js', 'vendor/jszip/jszip.min.js', ...pdfDataFiles,
  'news.js', 'news-provider.js', 'news-repository.js', 'news-preferences.js', 'news-rss.js', 'tuoitre.js',
  'listen.js', 'spotify-player.js', 'youtube-player.js', 'youtube-search.js', 'youtube-shelves.js',
  'radio.js', 'radio-player.js', 'radio-provider.js', 'radio-repository.js',
  'assets/youtube-logo.svg', 'assets/youtube-logo-dark.svg',
  'podcasts.js', 'podcast-native.js', 'podcast-provider.js', 'podcast-rss.js', 'podcast-repository.js', 'podcast-player.js',
  'workspace.js', 'workspace-repository.js', 'assistant.js', 'assets/books.webp', 'assets/sections.webp', 'assets/podcast-studio.webp',
  'assets/dm-sans.woff2', 'assets/instrument-serif.woff2',
  'assets/smartbot-favicon.svg', 'assets/smartbot-favicon-32.png', 'assets/smartbot-touch-icon.png',
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
