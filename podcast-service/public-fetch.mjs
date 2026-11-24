import { lookup } from 'node:dns/promises';
import { request } from 'node:https';
import ipaddr from 'ipaddr.js';

export class PodcastError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const addressPrefix = ipaddr.parseCIDR('2000::/3');

export function isPublicAddress(address) {
  if (!ipaddr.isValid(address)) return false;
  const ip = ipaddr.process(address);
  return ip.range() === 'unicast' && (ip.kind() === 'ipv4' || ip.match(addressPrefix));
}

export function publicUrl(value, base) {
  if (typeof value !== 'string' || !value.trim() || value.length > 2048) return null;
  try {
    const url = new URL(value, base);
    const host = url.hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '');
    if (url.protocol !== 'https:' || url.port || url.username || url.password) return null;
    if (ipaddr.isValid(host) ? !isPublicAddress(host) : !host.includes('.') || /\.(local|internal|localhost|test|invalid)$/.test(host)) return null;
    url.hash = '';
    return url;
  } catch {
    return null;
  }
}

const unavailable = () => new PodcastError(502, 'The podcast source could not be reached. Try again.');

function fetchOnce(url, signal, headers) {
  return new Promise((resolve, reject) => {
    const req = request(url, {
      signal,
      agent: false,
      headers: { 'User-Agent': 'SmartBot/1.0 (podcast reader)', 'Accept-Encoding': 'identity', ...headers },
      // The TLS request connects only to an address validated by this lookup.
      lookup(host, options, callback) {
        lookup(host, { all: true, family: options.family }).then(addresses => {
          if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address))) {
            callback(new PodcastError(400, 'Use a public HTTPS podcast feed link.'));
          } else if (options.all) {
            callback(null, addresses);
          } else {
            callback(null, addresses[0].address, addresses[0].family);
          }
        }, callback);
      },
    }, resolve);
    req.on('error', reject);
    req.end();
  });
}

export async function fetchPublic(value, { headers = {}, redirects = 0 } = {}) {
  const signal = AbortSignal.timeout(8000);
  let url = publicUrl(value);
  try {
    for (let count = 0; url && count <= redirects; count++) {
      const response = await fetchOnce(url, signal, headers);
      try {
        if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
          url = publicUrl(response.headers.location, url);
          continue;
        }
        if (response.statusCode !== 200 || ![undefined, 'identity'].includes(response.headers['content-encoding'])) {
          throw unavailable();
        }
        const limit = 4 * 1024 * 1024;
        const chunks = [];
        let bytes = 0;
        for await (const chunk of response) {
          bytes += chunk.length;
          if (bytes > limit) throw new PodcastError(422, 'This podcast feed is too large to open.');
          chunks.push(chunk);
        }
        return { body: Buffer.concat(chunks), url };
      } finally {
        response.destroy();
      }
    }
  } catch (error) {
    if (error instanceof PodcastError) throw error;
    throw unavailable();
  }
  throw unavailable();
}
