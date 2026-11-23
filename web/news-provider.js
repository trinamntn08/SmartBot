import { newsPreferences, newsTopics } from './news-preferences.js';
import { fetchTuoitre, tuoitreFeeds } from './tuoitre.js';

// Starter links checked in a mobile-sized browser with cookies disabled.
export const starterStories = [
  {
    title: 'NASA Awards Contract for NOAA’s Near Earth Orbit Network Program', source: 'NASA',
    language: 'en', topic: 'general', date: '2026-11-23',
    url: 'https://www.nasa.gov/news-release/nasa-awards-contract-for-noaas-near-earth-orbit-network-program/',
  },
  {
    title: 'Le secrétaire d’État van Koeverden annonce un appui pour renforcer les capacités du Canada à accueillir des rencontres sportives',
    source: 'Patrimoine canadien', language: 'fr', topic: 'sports', date: '2026-10-01',
    url: 'https://www.canada.ca/fr/patrimoine-canadien/nouvelles/2026/10/le-secretaire-detat-van-koeverden-annonce-un-appui-pour-renforcer-les-capacites-du-canada-a-accueillir-des-rencontres-sportives.html',
  },
  {
    title: 'NASA’s ESCAPADE Completes Powered Earth Flybys, Now En Route to Mars', source: 'NASA',
    language: 'en', topic: 'general', date: '2026-11-09',
    url: 'https://science.nasa.gov/science-research/heliophysics/nasas-escapade-completes-powered-earth-flybys-now-en-route-to-mars/',
  },
  {
    title: 'La ministre Anand participera à la 48e session de la Conférence ministérielle de la Francophonie, au 20e Sommet de la Francophonie et à la réunion de l’APEC',
    source: 'Affaires mondiales Canada', language: 'fr', topic: 'general', topics: ['general', 'world'], date: '2026-11-13',
    url: 'https://www.canada.ca/fr/affaires-mondiales/nouvelles/2026/11/la-ministre-anand-participera-a-la-48e-session-de-la-conference-ministerielle-de-la-francophonie-au-20e-sommet-de-la-francophonie-et-a-la-reunion-d.html',
  },
  {
    title: 'Building Canada Strong through sport: Secretary of State van Koeverden unveils vision to strengthen Canada’s sport system as the Playground to Podium Summit opens in Ottawa',
    source: 'Canadian Heritage', language: 'en', topic: 'sports', date: '2026-11-09',
    url: 'https://www.canada.ca/en/canadian-heritage/news/2026/11/building-canada-strong-through-sport-secretary-of-state-van-koeverden-unveils-vision-to-strengthen-canadas-sport-system-as-the-playground-to-podium.html',
  },
];

export const feeds = ['en', 'fr'].flatMap(language =>
  newsTopics.filter(item => item.id === 'general' || item.subject || item.department)
    .map(({ id: topic, subject, department, related }) => ({ id: language + '-' + topic, language, topic, subject, department, related })));
feeds.push({ id: 'nasa', language: 'en', topic: 'general' });
feeds.push(...tuoitreFeeds);

export function selectedFeeds({ languages, topics }) {
  const interests = topics.length ? topics : ['general', 'sports'];
  return feeds.filter(feed => languages.includes(feed.language) && (feed.id === 'nasa'
    ? interests.some(id => ['general', 'space', 'science', 'tech'].includes(id))
    : interests.includes(feed.topic) || feed.related?.some(topic => interests.includes(topic))));
}

export function isCanadaStory(url) {
  try {
    const link = new URL(url);
    return link.origin === 'https://www.canada.ca' && !link.username && !link.password
      && /^\/(en\/[^/]+\/news|fr\/[^/]+\/nouvelles)\/\d{4}\/\d{2}\/[^/]+\.html$/.test(link.pathname);
  } catch { return false; }
}

const sportWords = /\b(sports?|sportif\w*|sportive\w*|athl[eè]tes?|athletes?|olympi\w*|paralympi\w*|hockey|rinks?|patinoires?|soccer|rugby|football|curling|skating|patinage)\b/i;
const techWords = /\b(technolog\w*|digital\w*|numérique\w*|cyber\w*|artificial intelligence|intelligence artificielle|robot\w*|semiconductor\w*|semi-conducteur\w*|software|logiciel\w*|quantum|quantique\w*|sensor\w*|capteur\w*|satellite\w*|broadband|haut débit|AI|IA)\b/i;
const housingWords = /\b(housing|homes?|homeless\w*|rentals?|logements?|habitation\w*|itinérance|locatifs?|locatives?|loyers?)\b/i;

export function feedStories(entries, { language, topic }) {
  const result = [];
  for (const entry of entries) {
    if (!isCanadaStory(entry.link) || !entry.link.includes('/' + language + '/')
        || !entry.title?.trim() || !Number.isFinite(Date.parse(entry.publishedDate))) continue;
    const text = entry.title + ' ' + (entry.teaser ?? '');
    if (topic === 'sports' && !sportWords.test(text)) continue;
    if (topic === 'general' && sportWords.test(text)) continue;
    if (topic === 'tech' && !techWords.test(text)) continue;
    if (topic === 'housing' && !housingWords.test(text)) continue;
    const topics = [topic];
    const performers = /\b(actor|actors|actress|actresses|acteur|actrice|singer|chanteur|chanteuse|comedian|comédien|musician|musicien|cinéaste|filmmaker|vedette)s?\b|tapis rouge|red carpet/i;
    if ((topic === 'movies' || topic === 'culture') && performers.test(text)) topics.push('showbiz');
    else if (topic === 'movies' && /festival|premi[eè]re|box.office|awards?|prix|gala|oscars?/i.test(text)) topics.push('showbiz');
    result.push({
      title: entry.title.trim(), url: entry.link, date: entry.publishedDate, language, topic, topics,
      source: language === 'en' ? 'Government of Canada' : 'Gouvernement du Canada',
    });
    if (result.length === 8 && topic !== 'movies') break;
  }
  return result;
}

export async function fetchFeed(feed, signal) {
  const options = { credentials: 'omit', referrerPolicy: 'no-referrer', redirect: 'error', signal };
  if (feed.language === 'vi') return fetchTuoitre(feed, options);
  if (feed.id === 'nasa') {
    const response = await fetch('https://www.nasa.gov/news-release/feed/', options);
    if (!response.ok) throw new Error('Feed unavailable');
    const xml = new DOMParser().parseFromString(await response.text(), 'application/xml');
    const stories = Array.from(xml.querySelectorAll('channel > item'), item => ({
      title: item.querySelector('title')?.textContent.trim(), url: item.querySelector('link')?.textContent.trim(),
      date: item.querySelector('pubDate')?.textContent, source: 'NASA', language: 'en', topic: 'general',
    })).filter(story => story.title && story.url?.startsWith('https://www.nasa.gov/news-release/')
      && Number.isFinite(Date.parse(story.date)));
    if (!stories.length) throw new Error('Empty feed');
    return stories.slice(0, 8);
  }
  const query = new URLSearchParams({ sort: 'publishedDate', orderBy: 'desc', type: 'newsreleases', pick: '40' });
  if (feed.department) query.set('dept', feed.department);
  if (feed.subject) query.set('topic', feed.subject);
  const url = 'https://api.io.canada.ca/io-server/gc/news/' + feed.language + '/v2?' + query;
  const response = await fetch(url, options);
  if (!response.ok) throw new Error('Feed unavailable');
  const data = await response.json();
  return feedStories(data.feed.entry, feed);
}

function storyTopics(story) {
  if (story.source !== 'NASA') return story.topics ?? [story.topic];
  return techWords.test(story.title) ? ['general', 'space', 'science', 'tech'] : ['general', 'space', 'science'];
}

export function shortlist(articles, preferences) {
  const { languages, topics } = newsPreferences(preferences);
  const sorted = articles.filter(story => languages.includes(story.language)
      && (!topics.length || storyTopics(story).some(id => topics.includes(id))))
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  const selected = new Map();
  const groups = new Set();
  // The Canadian feed generally publishes both translations at the same instant.
  // Prefer different releases in a mixed edition. Single-language browsing keeps all releases.
  function add(story) {
    if (selected.has(story.url)) return false;
    if (languages.length > 1 && isCanadaStory(story.url) && [...selected.values()].some(other =>
      other.language !== story.language && other.date === story.date && other.topic === story.topic
      && isCanadaStory(other.url))) return false;
    selected.set(story.url, story);
    return true;
  }
  // Give each available language a place, then vary the topics up to the five-story limit.
  for (const language of languages) {
    const first = sorted.find(story => story.language === language && add(story));
    if (first) groups.add(first.language + '-' + first.topic);
  }
  for (const story of sorted) {
    if (selected.size >= 5) break;
    const group = story.language + '-' + story.topic;
    if (!groups.has(group) && add(story)) groups.add(group);
  }
  const sources = new Set(sorted.filter(story => selected.has(story.url)).map(story => story.source));
  for (const story of sorted) {
    if (selected.size >= 5) break;
    if (!sources.has(story.source) && Date.parse(sorted[0].date) - Date.parse(story.date) < 7 * 86400000) {
      if (add(story)) sources.add(story.source);
    }
  }
  for (const story of sorted) {
    if (selected.size >= 5) break;
    add(story);
  }
  return [...selected.values()].sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
}

export async function fetchArticle(url, signal) {
  const options = { credentials: 'omit', referrerPolicy: 'no-referrer', redirect: 'error', signal };
  // Parse publisher markup in an inert template and return only text.
  const template = document.createElement('template');
  let root;
  let author;
  let start;
  if (isCanadaStory(url)) {
    const response = await fetch(url, options);
    if (!response.ok) return null;
    template.innerHTML = await response.text();
    root = template.content.querySelector('main');
    start = root?.querySelector('.col-md-auto .cmp-text');
    author = root?.querySelector('.gc-byline a')?.textContent.trim();
    if (!start || !author) return null;
  } else {
    const { origin, pathname } = new URL(url);
    const release = origin === 'https://www.nasa.gov' && pathname.startsWith('/news-release/');
    if (!release && origin !== 'https://science.nasa.gov') return null;
    const slug = pathname.split('/').filter(Boolean).pop();
    const query = new URLSearchParams({ slug, _fields: 'link,content' });
    const endpoint = origin + '/wp-json/wp/v2/' + (release ? 'press-release' : 'posts');
    const response = await fetch(endpoint + '?' + query, options);
    if (!response.ok) return null;
    const post = (await response.json()).find(item => item.link === url);
    if (!post?.content?.rendered || post.content.protected) return null;
    template.innerHTML = post.content.rendered;
    root = template.content;
    author = 'NASA';
  }
  root.querySelectorAll('figure, figcaption, video, audio, aside, nav, form, script, style, [hidden]').forEach(el => el.remove());
  const blocks = [];
  for (const el of root.querySelectorAll('p, li, h2, h3, h4, cite')) {
    if (start && !(start.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING)) continue;
    const text = el.textContent.trim();
    if (!text || el.parentElement?.closest('li')) continue;
    const heading = /^H[234]$/.test(el.tagName);
    if (start && heading && /^(contacts?|personnes-ressources|related products|associated links|produits connexes|liens connexes|page details|détails de la page)$/i.test(text)) break;
    if (/^[-–—]\s*end\s*[-–—]$/i.test(text)) break;
    blocks.push({ heading, text });
  }
  return blocks.length ? { author, blocks } : null;
}
