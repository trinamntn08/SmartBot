import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { test } from 'node:test';
import { franceinfo, loadFeed, parseFeed, searchCatalog } from './catalog.mjs';
import { feed, search } from './handlers.mjs';
import { isPublicAddress, publicUrl } from './public-fetch.mjs';

const feedUrl = new URL('https://shows.example.com/feed.xml');
const xml = Buffer.from(`<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"><channel>
  <title>Les informés &amp; vous</title><itunes:author>franceinfo</itunes:author><link>https://shows.example.com/</link>
  <item><title>Épisode 1</title><guid>first</guid><pubDate>Sun, 22 Nov 2026 08:00:00 GMT</pubDate><enclosure type="audio/mpeg" url="https://cdn.example.com/1.mp3?x=1&amp;y=2"/></item>
  <item><title><![CDATA[Épisode 2 <live>]]></title><guid>second</guid><pubDate>Mon, 23 Nov 2026 08:00:00 GMT</pubDate><enclosure type="audio/mp4" url="/2.m4a"/></item>
  <item><title>Duplicate</title><guid>second</guid><enclosure type="audio/mp4" url="/duplicate.m4a"/></item>
  <item><title>Video</title><enclosure type="video/mp4" url="/video.mp4"/></item>
  <item><title>Private</title><enclosure type="audio/mpeg" url="https://127.1/song.mp3"/></item>
</channel></rss>`);

test('normalizes podcast feeds, sorts and deduplicates stable playable episodes', () => {
  const show = parseFeed(xml, feedUrl);
  assert.equal(show.title, 'Les informés & vous');
  assert.equal(show.publisher, 'franceinfo');
  assert.equal(show.website, 'https://shows.example.com/');
  assert.deepEqual(show.episodes.map(item => item.title), ['Épisode 2 <live>', 'Épisode 1']);
  assert.deepEqual(show.episodes.map(item => item.audioUrl), [
    'https://shows.example.com/2.m4a', 'https://cdn.example.com/1.mp3?x=1&y=2',
  ]);
  const moved = xml.toString().replace('/2.m4a', 'https://new.example.com/2.m4a');
  assert.equal(parseFeed(Buffer.from(moved), feedUrl).episodes[0].id, show.episodes[0].id);
});

test('rejects malformed and DTD-bearing XML and differentiates a feed with no audio', () => {
  for (const invalid of ['<html><title>Web page</title></html>', '<rss><channel>', '<!DOCTYPE rss SYSTEM "https://example.com/test"><rss/>']) {
    assert.throws(() => parseFeed(Buffer.from(invalid), feedUrl), { status: 422 });
  }
  assert.deepEqual(parseFeed(Buffer.from('<rss><channel><title>Empty</title></channel></rss>'), feedUrl).episodes, []);
});

test('restricts destinations and keeps pasted feeds independent of directory credentials', async () => {
  for (const address of ['127.0.0.1', '10.0.0.1', '100.64.0.1', '169.254.169.254', '::1', '::ffff:192.168.0.1', '2001:db8::1']) {
    assert.equal(isPublicAddress(address), false, address);
  }
  assert.equal(isPublicAddress('8.8.8.8'), true);
  assert.equal(isPublicAddress('2606:4700:4700::1111'), true);
  for (const url of ['http://example.com/rss', 'https://[::1]/', 'https://127.1/', 'https://user@example.com/', 'https://example.com:81/', 'https://x.local/']) {
    assert.equal(publicUrl(url), null, url);
  }
  assert.equal((await loadFeed(feedUrl.href, async (url, options) => {
    assert.equal(url, feedUrl.href);
    assert.equal(options.redirects, 4);
    return { body: xml, url: feedUrl };
  })).episodes.length, 2);
});

test('uses the configured Podcast Index catalog', async () => {
  const result = await searchCatalog('other show', { PODCAST_INDEX_KEY: 'key', PODCAST_INDEX_SECRET: 'secret' }, async (url, options) => {
    assert.equal(new URL(url).searchParams.get('q'), 'other show');
    assert.equal(options.headers['X-Auth-Key'], 'key');
    assert.match(options.headers.Authorization, /^[a-f0-9]{40}$/);
    return { body: Buffer.from(JSON.stringify({ feeds: [
      { title: 'Other Show', author: 'Publisher', url: feedUrl.href },
      { title: 'Duplicate', url: feedUrl.href }, { title: 'Private', url: 'https://127.0.0.1/feed' },
    ] })) };
  });
  assert.deepEqual(result, { shows: [{ title: 'Other Show', publisher: 'Publisher', feedUrl: feedUrl.href }], limited: false });
});

test('searches Apple Podcasts without credentials and returns distinct public feeds', async () => {
  const result = await searchCatalog('tri ki cam xuc', {}, async (url, { headers }) => {
    const endpoint = new URL(url);
    assert.equal(endpoint.origin + endpoint.pathname, 'https://itunes.apple.com/search');
    assert.equal(endpoint.searchParams.get('term'), 'tri ki cam xuc');
    assert.equal(endpoint.searchParams.get('entity'), 'podcast');
    assert.deepEqual(headers, { Accept: 'application/json' });
    return { body: Buffer.from(JSON.stringify({ results: [
      { collectionName: 'Tri Kỷ Cảm Xúc', artistName: 'Publisher', feedUrl: feedUrl.href },
      { collectionName: 'Duplicate', feedUrl: feedUrl.href },
      { collectionName: 'Private', feedUrl: 'https://127.0.0.1/feed' },
      { collectionName: 'Without a feed' },
    ] })) };
  });
  assert.deepEqual(result, { shows: [{ title: 'Tri Kỷ Cảm Xúc', publisher: 'Publisher', feedUrl: feedUrl.href }], limited: false });
  const empty = await searchCatalog('other show', {}, async () => ({ body: Buffer.from('{"results":[]}') }));
  assert.deepEqual(empty, { shows: [], limited: false });
});

test('offers the matching starter if catalog search is unavailable', async () => {
  const unavailable = async () => { throw new Error('Catalog unreachable'); };
  assert.deepEqual(await searchCatalog('Les informes', {}, unavailable), { shows: [franceinfo], limited: true });
  await assert.rejects(searchCatalog('other show', {}, unavailable), { status: 503 });
});

test('serves errors and allows cross-origin requests from the bundled Android app', async t => {
  const server = createServer((req, res) => (req.url.startsWith('/feed') ? feed : search)(req, res));
  await new Promise((resolve, reject) => server.listen(0, '127.0.0.1', resolve).once('error', reject));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const endpoint = `http://127.0.0.1:${server.address().port}`;
  const android = 'https://appassets.androidplatform.net';
  const cors = await fetch(`${endpoint}/feed`, { method: 'OPTIONS', headers: { Origin: android } });
  assert.equal(cors.status, 204);
  assert.equal(cors.headers.get('Access-Control-Allow-Origin'), android);
  assert.equal((await fetch(`${endpoint}/search?q=x`, { headers: { Origin: 'https://unrelated.example' } })).status, 403);
  const blocked = await fetch(`${endpoint}/feed`, {
    method: 'POST', headers: { Origin: android, 'Content-Type': 'application/json' }, body: '{"url":"https://127.0.0.1/a"}',
  });
  assert.equal(blocked.status, 400);
  assert.equal((await blocked.json()).error, 'Enter a public HTTPS podcast RSS link.');
  assert.equal((await fetch(`${endpoint}/feed`, { method: 'POST', body: 'invalid' })).status, 415);
});
