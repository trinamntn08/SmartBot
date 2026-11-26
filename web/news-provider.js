import { newsPreferences } from './news-preferences.js';
import { fetchTuoitre, tuoitreFeeds } from './tuoitre.js';
import { fetchPublisherFeed, rssFeeds } from './news-rss.js';

export const newsPageSize = 10;

// Starter links checked in a mobile-sized browser with cookies disabled.
export const starterStories = [
  {
    title: 'NASA Awards Contract for NOAA’s Near Earth Orbit Network Program', source: 'NASA',
    language: 'en', topic: 'general', date: '2026-11-23',
    url: 'https://www.nasa.gov/news-release/nasa-awards-contract-for-noaas-near-earth-orbit-network-program/',
  },
  {
    title: 'NASA’s ESCAPADE Completes Powered Earth Flybys, Now En Route to Mars', source: 'NASA',
    language: 'en', topic: 'general', date: '2026-11-09',
    url: 'https://science.nasa.gov/science-research/heliophysics/nasas-escapade-completes-powered-earth-flybys-now-en-route-to-mars/',
  },
];

export const feeds = [
  { id: 'nasa', language: 'en', topic: 'general', related: ['space', 'science', 'tech'] },
  ...tuoitreFeeds,
  ...rssFeeds,
];

export function selectedFeeds({ languages, topics }, affinity) {
  const learned = topics.length || !affinity ? [] : [...affinity.topics]
    .sort((a, b) => b[1] - a[1]).slice(0, 2).map(([topic]) => topic);
  const interests = topics.length ? topics : ['general', 'sports', ...learned];
  return feeds.filter(feed => {
    if (!languages.includes(feed.language)) return false;
    if (!topics.length && feed.provider === 'rss') return true;
    return interests.includes(feed.topic) || feed.related?.some(topic => interests.includes(topic));
  });
}

export function isCanadaStory(url) {
  try {
    const link = new URL(url);
    return link.origin === 'https://www.canada.ca' && !link.username && !link.password
      && /^\/(en\/[^/]+\/news|fr\/[^/]+\/nouvelles)\/\d{4}\/\d{2}\/[^/]+\.html$/.test(link.pathname);
  } catch { return false; }
}

const techWords = /\b(technolog\w*|digital\w*|numérique\w*|cyber\w*|artificial intelligence|intelligence artificielle|robot\w*|semiconductor\w*|semi-conducteur\w*|software|logiciel\w*|quantum|quantique\w*|sensor\w*|capteur\w*|satellite\w*|broadband|haut débit|AI|IA)\b/i;

export async function fetchFeed(feed, signal) {
  const options = { cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer', redirect: 'error', signal };
  if (feed.provider === 'rss') return fetchPublisherFeed(feed, options);
  if (feed.language === 'vi') return fetchTuoitre(feed, options);
  if (feed.id !== 'nasa') throw new Error('Unknown feed');
  const response = await fetch('https://www.nasa.gov/news-release/feed/', options);
  if (!response.ok) throw new Error('Feed unavailable');
  const xml = new DOMParser().parseFromString(await response.text(), 'application/xml');
  const stories = Array.from(xml.querySelectorAll('channel > item'), item => ({
    title: item.querySelector('title')?.textContent.trim(), url: item.querySelector('link')?.textContent.trim(),
    date: item.querySelector('pubDate')?.textContent, source: 'NASA', language: 'en', topic: 'general',
  })).filter(story => story.title && story.url?.startsWith('https://www.nasa.gov/news-release/')
    && Number.isFinite(Date.parse(story.date)));
  if (!stories.length) throw new Error('Empty feed');
  return stories.slice(0, 40);
}

export function storyTopics(story) {
  if (story.source !== 'NASA') return story.topics ?? [story.topic];
  return techWords.test(story.title) ? ['general', 'space', 'science', 'tech'] : ['general', 'space', 'science'];
}

const dayInMs = 86400000;

export function newsAffinity(opens, now = Date.now()) {
  const seen = new Set();
  const topics = new Map();
  const sources = new Map();
  for (const open of opens) {
    if (seen.has(open.url) || isCanadaStory(open.url)) continue;
    seen.add(open.url);
    const weight = 2 ** (-Math.max(0, now - open.at) / (14 * dayInMs));
    const tags = [...new Set(open.topics)].filter(topic => topic && topic !== 'general');
    if (tags.length > 1 && tags.includes('tech')) tags.splice(tags.indexOf('tech'), 1);
    for (const tag of tags) topics.set(tag, (topics.get(tag) ?? 0) + weight / tags.length);
    sources.set(open.source, (sources.get(open.source) ?? 0) + weight);
  }
  return { seen, topics, sources };
}

function compareHeadlines(stories, affinity) {
  const byDate = (a, b) => Date.parse(b.date) - Date.parse(a.date);
  if (!affinity?.seen.size) return byDate;
  const { seen, topics, sources } = affinity;
  const scores = new Map(stories.map(story => {
    const strongestTopic = Math.max(0, ...storyTopics(story).map(topic => topics.get(topic) ?? 0));
    const publisherWeight = sources.get(story.source) ?? 0;
    // Limit the lift to a week of freshness so new coverage can still surface.
    const lift = seen.has(story.url) ? -3 : 2 * Math.min(3, strongestTopic) + 0.5 * Math.min(2, publisherWeight);
    return [story, Date.parse(story.date) + lift * dayInMs];
  }));
  return (a, b) => scores.get(b) - scores.get(a) || byDate(a, b);
}

export function shortlist(articles, preferences, affinity) {
  const { languages, topics } = newsPreferences(preferences);
  const sorted = articles.filter(story => !isCanadaStory(story.url) && languages.includes(story.language)
    && (!topics.length || storyTopics(story).some(id => topics.includes(id))));
  const compare = compareHeadlines(sorted, affinity);
  sorted.sort(compare);
  const selected = new Map();
  const groups = new Set();
  function add(story) {
    if (selected.has(story.url)) return false;
    selected.set(story.url, story);
    return true;
  }
  // Reserve first-page places for each language and favor recent stories in the default edition.
  const latest = Math.max(...sorted.map(story => Date.parse(story.date)));
  const recent = sorted.filter(story => latest - Date.parse(story.date) < 7 * dayInMs);
  for (const language of languages) {
    const first = sorted.find(story => story.language === language && add(story));
    if (first) groups.add(first.language + '-' + first.topic);
  }
  if (!topics.length) {
    for (const language of languages) {
      const first = recent.find(story => story.language === language && story.linkKind
        && (selected.has(story.url) || add(story)));
      if (first) groups.add(first.language + '-' + first.topic);
    }
  }
  for (const story of sorted) {
    if (selected.size >= newsPageSize) break;
    const group = story.language + '-' + story.topic;
    if (!groups.has(group) && add(story)) groups.add(group);
  }
  const sources = new Set(sorted.filter(story => selected.has(story.url)).map(story => story.source));
  for (const story of recent) {
    if (selected.size >= newsPageSize) break;
    if (!sources.has(story.source)) {
      if (add(story)) sources.add(story.source);
    }
  }
  for (const story of sorted) {
    if (selected.size >= newsPageSize) break;
    add(story);
  }
  const edition = [...selected.values()].sort(compare);
  for (const story of sorted) {
    if (add(story)) edition.push(story);
  }
  return edition;
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
