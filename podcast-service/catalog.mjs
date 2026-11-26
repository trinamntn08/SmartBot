import { createHash } from 'node:crypto';
import { SaxesParser } from 'saxes';
import { fetchPublic, PodcastError, publicUrl } from './public-fetch.mjs';

export const franceinfo = {
  title: 'Les informés de franceinfo',
  publisher: 'franceinfo',
  feedUrl: 'https://radiofrance-podcast.net/podcast09/35099478-7c72-4f9e-a6de-1b928400e9e5/podcast_28147243-2a52-4fc0-a01f-637d8f300f6b.xml',
};

function clean(value, limit = 300) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, limit) : '';
}

function assignText(target, name, value) {
  if (name.toLowerCase() === 'itunes:author') name = 'author';
  if (['title', 'author', 'managingeditor', 'guid', 'pubdate', 'link'].includes(name.toLowerCase())) {
    target[name.toLowerCase()] = clean(value, name.toLowerCase() === 'link' || name.toLowerCase() === 'guid' ? 2048 : 300);
  }
}

export function parseFeed(body, url) {
  const parser = new SaxesParser();
  const path = [];
  const show = {};
  const episodes = new Map();
  let item;
  let value = '';
  let foundChannel = false;
  const invalid = () => new PodcastError(422, 'This link does not contain a valid podcast RSS feed.');

  parser.on('doctype', () => { throw invalid(); });
  parser.on('error', () => { throw invalid(); });
  parser.on('opentag', ({ name, attributes }) => {
    path.push(name.toLowerCase());
    if (path.length === 2 && path.join('/') === 'rss/channel') foundChannel = true;
    if (path.length === 3 && path.join('/') === 'rss/channel/item') item = {};
    if (item && path.length === 4 && name.toLowerCase() === 'enclosure' && !item.audioUrl) {
      const audio = publicUrl(attributes.url, url);
      const type = clean(attributes.type).toLowerCase().split(';')[0].trim();
      if (audio && (type.startsWith('audio/') || type === 'application/ogg' ||
          ['', 'application/octet-stream'].includes(type) && /\.(mp3|m4a|aac|ogg|opus|wav|flac)$/i.test(audio.pathname))) {
        item.audioUrl = audio.href;
      }
    }
    if (path.length <= (item ? 4 : 3)) value = '';
  });
  const append = text => { if (value.length < 2048) value += text.slice(0, 2048 - value.length); };
  parser.on('text', append);
  parser.on('cdata', append);
  parser.on('closetag', ({ name }) => {
    if (item && path.length === 4) assignText(item, name, value);
    if (item && path.length === 3) {
      if (item.audioUrl && item.title) {
        const id = createHash('sha256').update(item.guid || item.audioUrl).digest('hex');
        const time = Date.parse(item.pubdate);
        if (!episodes.has(id)) episodes.set(id, {
          id, title: item.title, audioUrl: item.audioUrl,
          publishedAt: Number.isFinite(time) ? time : null,
        });
      }
      item = null;
    } else if (!item && path.length === 3 && path[0] === 'rss' && path[1] === 'channel') {
      assignText(show, name, value);
    }
    path.pop();
  });
  const encoding = body[0] === 0xff && body[1] === 0xfe ? 'utf-16le'
    : body[0] === 0xfe && body[1] === 0xff ? 'utf-16be' : 'utf-8';
  parser.write(new TextDecoder(encoding).decode(body)).close();
  if (!foundChannel || !show.title) throw invalid();
  return {
    feedUrl: url.href,
    title: show.title,
    publisher: show.author || show.managingeditor || url.hostname,
    website: publicUrl(show.link, url)?.href ?? null,
    episodes: [...episodes.values()].sort((a, b) => (b.publishedAt ?? 0) - (a.publishedAt ?? 0)).slice(0, 30),
  };
}

export async function loadFeed(value, fetcher = fetchPublic) {
  const requested = publicUrl(value);
  if (!requested) throw new PodcastError(400, 'Enter a public HTTPS podcast RSS link.');
  const { body, url } = await fetcher(requested.href, { redirects: 4, headers: { Accept: 'application/rss+xml, application/xml, text/xml, */*;q=0.1' } });
  return parseFeed(body, url);
}

function starterMatches(query) {
  const searchable = text => text.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
  const words = searchable(query).split(/\s+/);
  return words.every(word => searchable(franceinfo.title).includes(word));
}

async function searchPodcastIndex(query, key, secret, fetcher) {
  const date = String(Math.floor(Date.now() / 1000));
  const signature = createHash('sha1').update(key + secret + date).digest('hex');
  const url = new URL('https://api.podcastindex.org/api/1.0/search/byterm');
  url.search = new URLSearchParams({ q: query, max: '15' });
  const { body } = await fetcher(url.href, { headers: {
    'X-Auth-Key': key, 'X-Auth-Date': date, Authorization: signature, Accept: 'application/json',
  } });
  const { feeds } = JSON.parse(body.toString('utf8'));
  if (!Array.isArray(feeds)) throw new Error('Invalid Podcast Index response');
  return feeds.map(feed => ({ url: feed?.url, title: feed?.title, publisher: feed?.author }));
}

async function searchApplePodcasts(query, fetcher) {
  const url = new URL('https://itunes.apple.com/search');
  url.search = new URLSearchParams({ term: query, country: 'US', media: 'podcast', entity: 'podcast', limit: '15' });
  const { body } = await fetcher(url.href, { headers: { Accept: 'application/json' } });
  const { results } = JSON.parse(body.toString('utf8'));
  if (!Array.isArray(results)) throw new Error('Invalid Apple Podcasts response');
  return results.map(show => ({ url: show?.feedUrl, title: show?.collectionName, publisher: show?.artistName }));
}

export async function searchCatalog(value, env = process.env, fetcher = fetchPublic) {
  const query = typeof value === 'string' ? value.trim() : '';
  if (!query || query.length > 120) throw new PodcastError(400, 'Enter a podcast name up to 120 characters.');
  const starter = starterMatches(query) ? [franceinfo] : [];
  const { PODCAST_INDEX_KEY: key, PODCAST_INDEX_SECRET: secret } = env;
  try {
    const feeds = key && secret
      ? await searchPodcastIndex(query, key, secret, fetcher)
      : await searchApplePodcasts(query, fetcher);
    const shows = new Map(starter.map(show => [show.feedUrl, show]));
    for (const feed of feeds) {
      const feedUrl = publicUrl(feed.url)?.href;
      const title = clean(feed.title);
      if (feedUrl && title && !shows.has(feedUrl)) {
        shows.set(feedUrl, { feedUrl, title, publisher: clean(feed.publisher) || new URL(feedUrl).hostname });
      }
    }
    return { shows: [...shows.values()].slice(0, 15), limited: false };
  } catch {
    if (starter.length) return { shows: starter, limited: true };
    throw new PodcastError(503, 'Podcast search is unavailable. You can still paste an RSS feed link.');
  }
}
