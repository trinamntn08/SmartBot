const source = 'https://www.googleapis.com/youtube/v3/';
const maxBytes = 128 * 1024;
const charts = new Map();
const chartLifetime = 15 * 60 * 1000;

export class YouTubeError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const key = () => process.env.SMARTBOT_YOUTUBE_API_KEY?.trim();

export function youtubeStatus() {
  return { configured: Boolean(key()) };
}

async function request(resource, params) {
  const credential = key();
  if (!credential) throw new YouTubeError(503, 'Live YouTube browsing is unavailable.');
  const url = new URL(resource, source);
  url.search = new URLSearchParams(params);
  const response = await fetch(url, {
    headers: { 'X-Goog-Api-Key': credential },
    redirect: 'error',
    signal: AbortSignal.timeout(8000),
  });
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new YouTubeError(502, 'YouTube returned too much data.');
    }
    chunks.push(value);
  }
  const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if (response.ok && Array.isArray(data?.items)) return { items: data.items };
  const exhausted = ['quotaExceeded', 'dailyLimitExceeded', 'rateLimitExceeded'];
  if (response.status === 429 || data?.error?.errors?.some(error => exhausted.includes(error.reason))) {
    throw new YouTubeError(429, 'YouTube’s limit was reached. Try again later.');
  }
  throw new YouTubeError(502, 'YouTube could not be reached. Try again.');
}

export function searchMusic(values) {
  const query = values.length === 1 ? values[0].trim() : '';
  if (!query || query.length > 120) throw new YouTubeError(400, 'Enter a song or artist name.');
  return request('search', {
    part: 'snippet', type: 'video', videoCategoryId: '10', videoEmbeddable: 'true', videoSyndicated: 'true',
    maxResults: '8', fields: 'items(id/videoId,snippet(title,channelTitle))', q: query,
  });
}

export async function popularMusic(values) {
  const region = values.length === 1 ? values[0] : '';
  if (!['FR', 'VN', 'US'].includes(region)) throw new YouTubeError(400, 'Choose an available YouTube chart.');
  if (!key()) throw new YouTubeError(503, 'Live YouTube browsing is unavailable.');
  const cached = charts.get(region);
  if (cached && cached.until > Date.now()) return cached.result;
  const result = request('videos', {
    part: 'snippet,status', chart: 'mostPopular', regionCode: region, videoCategoryId: '10', maxResults: '16',
    fields: 'items(id,snippet(title,channelTitle,thumbnails(medium/url)),status/embeddable)',
  });
  const entry = { until: Date.now() + chartLifetime, result };
  charts.set(region, entry);
  try { return await result; }
  catch (error) {
    if (charts.get(region) === entry) charts.delete(region);
    throw error;
  }
}
