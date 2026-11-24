import { isIP } from 'node:net';
import { loadFeed, searchCatalog } from './catalog.mjs';
import { PodcastError } from './public-fetch.mjs';

const maxBody = 4096;
const requests = new Map();
let minute;

function overLimit(req) {
  const now = Math.floor(Date.now() / 60000);
  if (now !== minute) {
    requests.clear();
    minute = now;
  }
  const forwarded = process.env.VERCEL === '1' ? req.headers['x-vercel-forwarded-for'] : null;
  const address = typeof forwarded === 'string' && isIP(forwarded) ? forwarded : req.socket.remoteAddress;
  const count = requests.get(address) ?? 0;
  if (count >= 60 || !count && requests.size >= 4096) return true;
  requests.set(address, count + 1);
  return false;
}

function allowedOrigin(origin) {
  return origin === 'https://appassets.androidplatform.net' || /^http:\/\/(localhost|127\.0\.0\.1):\d{1,5}$/.test(origin)
    || (process.env.SMARTBOT_PODCAST_ORIGINS ?? '').split(',').some(value => value.trim() === origin);
}

async function body(req) {
  const type = req.headers['content-type']?.split(';')[0];
  if (type !== 'application/json') throw new PodcastError(415, 'Send a JSON request.');
  if (Number(req.headers['content-length']) > maxBody) throw new PodcastError(413, 'This request is too large.');
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    if (Buffer.byteLength(JSON.stringify(req.body)) > maxBody) throw new PodcastError(413, 'This request is too large.');
    return req.body;
  }
  let bytes = 0;
  const chunks = [];
  for await (const chunk of req.body == null ? req.iterator({ destroyOnReturn: false }) : [Buffer.from(req.body)]) {
    bytes += chunk.length;
    if (bytes > maxBody) throw new PodcastError(413, 'This request is too large.');
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new PodcastError(400, 'Send a valid RSS link request.');
  }
}

function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function endpoint(method, run) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Vary', 'Origin');
    const origin = req.headers.origin;
    if (origin) {
      if (!allowedOrigin(origin)) return json(res, 403, { error: 'This app origin is unavailable.' });
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', method);
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.setHeader('Access-Control-Max-Age', '600');
      res.statusCode = 204;
      res.end();
      return;
    }
    if (req.method !== method) {
      res.setHeader('Allow', `${method}, OPTIONS`);
      return json(res, 405, { error: 'This podcast endpoint uses a different method.' });
    }
    if (overLimit(req)) {
      res.setHeader('Retry-After', '60');
      return json(res, 429, { error: 'Too many podcast requests. Wait a moment and try again.' });
    }
    try {
      json(res, 200, await run(req));
    } catch (error) {
      if (error instanceof PodcastError) json(res, error.status, { error: error.message });
      else json(res, 502, { error: 'The podcast source could not be opened. Try again.' });
    }
  };
}

export const search = endpoint('GET', req => searchCatalog(new URL(req.url, 'http://localhost').searchParams.get('q')));
export const feed = endpoint('POST', async req => loadFeed((await body(req))?.url));
