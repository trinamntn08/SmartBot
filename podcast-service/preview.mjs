import { createServer } from 'node:http';
import { feed, musicChart, musicSearch, musicStatus, search } from './handlers.mjs';

const port = Number(process.env.PORT ?? 8787);
const routes = new Map([
  ['/api/podcasts/search', search], ['/api/podcasts/feed', feed],
  ['/api/youtube/status', musicStatus], ['/api/youtube/chart', musicChart], ['/api/youtube/search', musicSearch],
]);

createServer((req, res) => {
  const handler = routes.get(req.url.split('?')[0]);
  if (handler) return handler(req, res);
  res.writeHead(404).end();
}).listen(port, '127.0.0.1', () => console.log(`Podcast service available at http://127.0.0.1:${port}`));
