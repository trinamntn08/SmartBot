import assert from 'node:assert/strict';
import { test } from 'node:test';

test('an Android build without a hosted service can search and import RSS', async t => {
  const origin = 'https://appassets.androidplatform.net';
  globalThis.location = { origin, hostname: new URL(origin).hostname };
  globalThis.document = { querySelector: () => null };
  t.after(() => {
    delete globalThis.location;
    delete globalThis.document;
  });
  const feedUrl = 'https://feeds.soundcloud.com/users/soundcloud:users:123/sounds.rss';
  const requests = [];
  t.mock.method(globalThis, 'fetch', async (path, options) => {
    const url = new URL(path, `${origin}/assets/index.html`);
    requests.push({ path: url.pathname, params: Object.fromEntries(url.searchParams), method: options.method });
    return url.pathname.endsWith('/search')
      ? Response.json({ results: [
        { collectionName: 'Sample Show', artistName: 'Sample Publisher', feedUrl },
        { collectionName: 'No RSS link' },
      ] })
      : Response.json({ error: 'The podcast source could not be reached. Try again.' }, { status: 502 });
  });

  const { searchPodcasts, loadPodcast } = await import('../web/podcast-provider.js');
  assert.deepEqual(await searchPodcasts('Sample Show'), {
    shows: [{ title: 'Sample Show', publisher: 'Sample Publisher', feedUrl }], limited: false,
  });
  await assert.rejects(loadPodcast(feedUrl), /podcast source could not be reached/);
  await assert.rejects(loadPodcast('https://127.0.0.1/feed'), /public HTTPS podcast RSS link/);
  assert.deepEqual(requests, [
    { path: '/assets/api/podcasts/search', params: { q: 'Sample Show' }, method: undefined },
    { path: '/assets/api/podcasts/feed', params: { url: feedUrl }, method: undefined },
  ]);
});
