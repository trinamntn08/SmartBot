export function podcastUrl(value, base) {
  if (typeof value !== 'string' || !value.trim() || value.length > 2048) return null;
  try {
    const url = new URL(value, base);
    const host = url.hostname.replace(/\.$/, '');
    if (url.protocol !== 'https:' || url.username || url.password || url.port || url.href.length > 2048
        || !host.includes('.') || host.includes(':') || /^[\d.]+$|\.(?:local|internal|localhost|test|invalid)$/.test(host)) return null;
    url.hash = '';
    return url;
  } catch {
    return null;
  }
}

function decodeFeed(body) {
  const bytes = new Uint8Array(body);
  const encoding = bytes[0] === 0xff && bytes[1] === 0xfe ? 'utf-16le'
    : bytes[0] === 0xfe && bytes[1] === 0xff ? 'utf-16be'
    : new TextDecoder().decode(bytes.subarray(0, 256)).match(/^\s*<\?xml\s[^?]*\sencoding\s*=\s*['"]([^'"]+)['"]/i)?.[1];
  return new TextDecoder(encoding ?? 'utf-8').decode(bytes);
}

function children(node, name) {
  return Array.from(node.children).filter(child => child.tagName.toLowerCase() === name);
}

function field(node, name, limit = 300) {
  return children(node, name)[0]?.textContent.replace(/\s+/g, ' ').trim().slice(0, limit) ?? '';
}

function audioLink(item, feedUrl) {
  for (const enclosure of children(item, 'enclosure')) {
    const url = podcastUrl(enclosure.getAttribute('url'), feedUrl);
    if (!url) continue;
    const type = (enclosure.getAttribute('type') ?? '').toLowerCase().split(';')[0].trim();
    if (type.startsWith('audio/') || type === 'application/ogg' ||
        (type === '' || type === 'application/octet-stream') && /\.(mp3|m4a|aac|ogg|opus|wav|flac)$/i.test(url.pathname)) {
      return url.href;
    }
  }
  return null;
}

async function episodeId(key) {
  // Match IDs issued by the hosted service so saved positions survive an APK update.
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function parsePodcastFeed(body, feedUrl) {
  const invalid = () => new Error('This link does not contain a valid podcast RSS feed.');
  let xml;
  try {
    xml = new DOMParser().parseFromString(decodeFeed(body), 'application/xml');
  } catch {
    throw invalid();
  }
  if (xml.doctype || xml.documentElement?.tagName.toLowerCase() !== 'rss' || xml.querySelector('parsererror')) throw invalid();
  const channel = children(xml.documentElement, 'channel')[0];
  const title = channel && field(channel, 'title');
  if (!title) throw invalid();

  const episodes = new Map();
  for (const item of children(channel, 'item')) {
    const title = field(item, 'title');
    const audioUrl = title && audioLink(item, feedUrl);
    if (!audioUrl) continue;
    const key = field(item, 'guid', 2048) || audioUrl;
    const time = Date.parse(field(item, 'pubdate'));
    if (!episodes.has(key)) episodes.set(key, { title, audioUrl, publishedAt: Number.isFinite(time) ? time : null });
  }
  const recent = [...episodes].sort(([, a], [, b]) => (b.publishedAt ?? 0) - (a.publishedAt ?? 0)).slice(0, 30);
  return {
    feedUrl, title,
    publisher: field(channel, 'itunes:author') || field(channel, 'author') || field(channel, 'managingeditor') || new URL(feedUrl).hostname,
    website: podcastUrl(field(channel, 'link', 2048), feedUrl)?.href ?? null,
    episodes: await Promise.all(recent.map(async ([key, episode]) => ({ id: await episodeId(key), ...episode }))),
  };
}
