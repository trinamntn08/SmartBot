import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';
import { musicChart, musicSearch, musicStatus } from './handlers.mjs';

test('serves Android music with a server-only credential and caches charts', async t => {
  const clientFetch = fetch;
  const upstream = [];
  const secret = 'fixture-only-youtube-key';
  const old = process.env.SMARTBOT_YOUTUBE_API_KEY;
  delete process.env.SMARTBOT_YOUTUBE_API_KEY;
  t.after(() => {
    if (old === undefined) delete process.env.SMARTBOT_YOUTUBE_API_KEY;
    else process.env.SMARTBOT_YOUTUBE_API_KEY = old;
  });
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    upstream.push({ url, options });
    return Response.json({ items: [] });
  });
  const routes = new Map([
    ['/api/youtube/status', musicStatus], ['/api/youtube/chart', musicChart], ['/api/youtube/search', musicSearch],
  ]);
  const server = createServer((req, res) => routes.get(req.url.split('?')[0])(req, res));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/api/youtube/`;
  const headers = { 'X-SmartBot-YouTube': 'music', Origin: 'https://appassets.androidplatform.net' };

  assert.deepEqual(await (await clientFetch(base + 'status', { headers })).json(), { configured: false });
  assert.equal((await clientFetch(base + 'chart?region=FR', { headers })).status, 503);
  process.env.SMARTBOT_YOUTUBE_API_KEY = secret;
  const status = await clientFetch(base + 'status', { headers });
  assert.deepEqual(await status.json(), { configured: true });
  assert.equal(status.headers.get('cache-control'), 'no-store');
  assert.equal(status.headers.get('access-control-allow-origin'), headers.Origin);
  assert.equal((await clientFetch(base + 'chart?region=FR')).status, 403);
  assert.equal((await clientFetch(base + 'chart?region=FR&region=VN', { headers })).status, 400);
  assert.equal((await clientFetch(base + 'search?q=Faded&q=Other', { headers })).status, 400);
  assert.equal(upstream.length, 0);

  const results = await Promise.all([1, 2].map(() => clientFetch(base + 'chart?region=VN', { headers })));
  for (const response of results) assert.deepEqual(await response.json(), { items: [] });
  assert.equal(upstream.length, 1);
  const chart = upstream[0];
  assert.equal(chart.url.pathname, '/youtube/v3/videos');
  assert.equal(chart.url.searchParams.get('regionCode'), 'VN');
  assert.equal(chart.url.searchParams.get('chart'), 'mostPopular');

  const search = await clientFetch(base + 'search?q=Alan%20Walker', { headers });
  assert.deepEqual(await search.json(), { items: [] });
  assert.equal(upstream[1].url.searchParams.get('q'), 'Alan Walker');
  assert.equal(upstream[1].url.searchParams.get('videoEmbeddable'), 'true');
  for (const { url, options } of upstream) {
    assert.equal(url.hostname, 'www.googleapis.com');
    assert.equal(url.searchParams.has('key'), false);
    assert.equal(options.headers['X-Goog-Api-Key'], secret);
    assert.equal(options.redirect, 'error');
  }
});
