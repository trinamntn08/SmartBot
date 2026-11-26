import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { ensurePlan, newRoutine, savePreferences } from '../web/planner.js';
import { feeds, newsAffinity, selectedFeeds, shortlist, starterStories } from '../web/news-provider.js';
import { myNewsTopics, newsBrowseTopic, newsEditionPreferences, newsPreferences, newsTopics } from '../web/news-preferences.js';
import { newsRepository } from '../web/news-repository.js';
import { isCurrentPublisherLink, rssFeeds, rssStory } from '../web/news-rss.js';
import { tuoitreStory } from '../web/tuoitre.js';

const day = { date: '2026-11-23', timeZone: 'Europe/Paris' };
const story = {
  title: 'Actualités de la semaine', url: 'https://example.org/weekly', date: '2026-11-23',
  source: 'Publisher', language: 'fr', topic: 'general',
};
const archivedStory = {
  ...story, title: 'Earlier Canada.ca release', source: 'Gouvernement du Canada',
  url: 'https://www.canada.ca/fr/patrimoine-canadien/nouvelles/2026/10/release.html',
};

test('reading activity ranks unread related headlines without overriding filters or freshness', () => {
  const now = Date.parse('2026-11-24T12:00:00Z');
  const posts = [
    { url: 'https://example.org/now', date: '2026-11-24', language: 'en', topic: 'sports', source: 'Sports' },
    { url: 'https://example.org/read', date: '2026-11-24', language: 'en', topic: 'ai', source: 'Tech' },
    { url: 'https://example.org/related', date: '2026-11-22', language: 'en', topic: 'ai', source: 'Tech' },
    { url: 'https://example.org/old', date: '2026-11-04', language: 'en', topic: 'ai', source: 'Tech' },
    { url: 'https://example.org/fr', date: '2026-11-24', language: 'fr', topic: 'ai', source: 'ActuIA' },
  ];
  const open = { url: posts[1].url, at: now, topics: ['tech', 'ai'], source: 'Tech' };
  const affinity = newsAffinity([open, open, { ...open, url: 'https://example.org/another' }], now);
  const prefs = { languages: ['en'], topics: [] };
  assert.equal(affinity.topics.get('ai'), 2);
  assert.equal(shortlist(posts, prefs)[0], posts[0]);
  assert.deepEqual(shortlist(posts, prefs, affinity), [posts[2], posts[0], posts[1], posts[3]]);
  assert.deepEqual(shortlist(posts, { ...prefs, topics: ['sports'] }, affinity), [posts[0]]);
  assert.equal(newsAffinity([{ ...open, at: now - 28 * 86400000 }], now).topics.get('ai'), 0.25);
});

test('All requests every feed in the selected languages and sections request relevant feeds', () => {
  assert.deepEqual(selectedFeeds({ languages: ['vi'], topics: [] }), feeds.filter(feed => feed.language === 'vi'));
  assert.deepEqual(selectedFeeds({ languages: ['vi'], topics: ['sports'] }).map(feed => feed.topic), ['sports']);
});

function useTestStorage(t) {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const storage = {
    getItem(key) { return this[key] ?? null; },
    setItem(key, value) { this[key] = value; },
    removeItem(key) { delete this[key]; },
  };
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
  t.after(() => {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else delete globalThis.localStorage;
  });
  return storage;
}

test('browsing a section or All preserves earlier topic and language preferences', t => {
  const storage = useTestStorage(t);
  storage.setItem('smartbot-news-filters', JSON.stringify({ language: 'vi', topic: 'sports' }));
  const prefs = newsRepository.preferences();
  assert.equal(newsBrowseTopic(newsRepository.browseTopic(), prefs), myNewsTopics);
  assert.deepEqual(newsEditionPreferences(prefs, myNewsTopics), { languages: ['vi'], topics: ['sports'] });

  newsRepository.saveBrowseTopic('');
  const all = newsBrowseTopic(newsRepository.browseTopic(), prefs);
  assert.equal(all, '');
  assert.deepEqual(newsEditionPreferences(prefs, all), { languages: ['vi'], topics: [] });

  newsRepository.saveBrowseTopic('culture');
  const culture = newsBrowseTopic(newsRepository.browseTopic(), prefs);
  assert.deepEqual(newsEditionPreferences(prefs, culture), { languages: ['vi'], topics: ['culture'] });
  assert.deepEqual(newsRepository.preferences(), { languages: ['vi'], topics: ['sports'] });
  assert.equal(newsBrowseTopic(myNewsTopics, { topics: [] }), '');
});

test('the refresh time follows the latest saved edition for the selected feeds', t => {
  useTestStorage(t);
  const [unavailable, refreshed, ...others] = rssFeeds;
  const selected = [unavailable, refreshed, others[0]];
  const stale = Date.parse('2026-11-24T20:27:00Z');
  const fresh = Date.parse('2026-11-26T12:00:00Z');

  assert.equal(newsRepository.latestEditionTime(selected), 0);
  newsRepository.saveEdition(unavailable, { time: stale, stories: [story], pageSize: 10 });
  assert.equal(newsRepository.latestEditionTime(selected), stale);
  newsRepository.saveEdition(refreshed, { time: fresh, stories: [story], pageSize: 10 });
  newsRepository.saveEdition(others[1], { time: fresh + 60000, stories: [story], pageSize: 10 });
  assert.equal(newsRepository.latestEditionTime(selected), fresh);
  assert.equal(newsRepository.edition(unavailable).time, stale);
});

test('opened stories stay bounded and can be disabled and cleared without touching preferences', t => {
  const storage = useTestStorage(t);
  const now = Date.parse('2026-11-24T12:00:00Z');
  const prefs = { languages: ['fr'], topics: ['world'] };
  newsRepository.savePreferences(prefs);
  newsRepository.recordOpen(archivedStory, now);
  assert.deepEqual(newsRepository.opens(now), []);
  newsRepository.recordOpen(story, now - 3600000);
  newsRepository.recordOpen(story, now);
  assert.equal(newsRepository.opens(now).length, 1);
  assert.equal(newsRepository.opens(now)[0].at, now - 3600000);
  assert.deepEqual(newsRepository.opens(now + 90 * 86400000), []);
  newsRepository.setPersonalized(false);
  newsRepository.recordOpen(starterStories[0], now);
  assert.equal(newsRepository.opens(now).length, 1);
  newsRepository.setPersonalized(true);
  for (let i = 0; i < 125; i++) {
    newsRepository.recordOpen({ ...story, url: 'https://example.org/' + i }, now + i);
  }
  assert.equal(newsRepository.opens(now + 125).length, 120);
  assert.equal(Object.keys(storage).filter(key => key.startsWith('smartbot-news-open:')).length, 120);
  assert.ok(newsRepository.resetOpens());
  assert.deepEqual(newsRepository.opens(now), []);
  assert.deepEqual(newsRepository.preferences(), prefs);
});

test('setting up reading preserves an earlier news pick and its read history', () => {
  const routine = newRoutine();
  const news = { story: archivedStory, status: 'completed', minutes: 5 };
  const readStories = { [archivedStory.url]: archivedStory.title };
  routine.plans[day.date] = { ...day, news, readStories };
  savePreferences(routine, { title: 'Paper book', budget: 20, page: 7 });
  ensurePlan(routine, day);
  assert.deepEqual(routine.plans[day.date].news, news);
  assert.deepEqual(routine.plans[day.date].readStories, readStories);
  assert.equal(routine.plans[day.date].reading.minutes, 10);
});

test('archived Canada.ca headlines stay out of editions and recommendation signals', () => {
  const open = { url: archivedStory.url, at: Date.now(), topics: ['general'], source: archivedStory.source };
  const affinity = newsAffinity([open]);
  assert.equal(affinity.seen.size, 0);
  assert.deepEqual(shortlist([story, archivedStory, ...starterStories], { languages: ['fr'] }, affinity), [story]);
  assert.ok(shortlist(starterStories).every(item => item.source === 'NASA'));
});

test('the shortlist keeps a bilingual topic mix, removes duplicates, and respects filters', () => {
  const sport = { ...story, url: 'https://example.org/sports', topic: 'sports' };
  const tech = { ...story, url: 'https://example.org/tech', language: 'en', topic: 'tech' };
  const stories = [...starterStories, ...starterStories, sport, tech, ...Array.from({ length: 8 }, (_, i) =>
    ({ ...story, date: '2026-11-23', url: 'https://example.org/' + i }))];
  const result = shortlist(stories);
  assert.equal(result.length, new Set(stories.map(item => item.url)).size);
  assert.equal(new Set(result.map(item => item.url)).size, result.length);
  const firstPage = result.slice(0, 10);
  assert.equal(firstPage.length, 10);
  assert.equal(new Set(firstPage.map(item => item.topic + item.language)).size, 4);
  assert.ok(result.slice(10).length > 0);
  assert.deepEqual(shortlist(stories, { language: 'fr', topic: 'sports' }), [sport]);
});

test('news preferences retain earlier choices and normalize multiple selections', () => {
  assert.deepEqual(newsPreferences({ language: 'fr', topic: 'sports' }), { languages: ['fr'], topics: ['sports'] });
  assert.deepEqual(newsPreferences(null), { languages: ['en', 'fr', 'vi'], topics: [] });
  assert.deepEqual(newsPreferences({ languages: ['fr', 'en', 'fr'], topics: ['tech', 'culture', 'other'] }),
    { languages: ['en', 'fr'], topics: ['culture', 'tech'] });
});

test('selected feeds match the available language and topic coverage', () => {
  for (const language of ['en', 'fr', 'vi']) {
    for (const { id } of newsTopics) {
      const selected = selectedFeeds({ languages: [language], topics: [id] });
      assert.ok(selected.every(feed => feed.language === language));
      assert.ok(selected.every(feed => feed.topic === id || feed.related?.includes(id)), language + '/' + id);
    }
  }
  const feeds = selectedFeeds({ languages: ['fr'], topics: ['culture', 'tech'] });
  assert.deepEqual(feeds.map(feed => feed.id), ['linuxfr-news', 'linuxfr-journals', 'actuia']);
  assert.deepEqual(selectedFeeds({ languages: ['fr'], topics: ['sports'] }), []);
});

test('regional RSS entries use matching topics and trusted publisher or discussion URLs', () => {
  const catalog = JSON.parse(readFileSync(new URL('../web/news-feeds.json', import.meta.url), 'utf8'));
  assert.deepEqual(Object.keys(catalog).sort(), rssFeeds.map(feed => feed.id).sort());
  for (const feed of rssFeeds) assert.equal(new URL(catalog[feed.id]).origin, 'https://' + feed.host);

  const hn = rssFeeds.find(feed => feed.id === 'hacker-news');
  const item = { title: 'Show HN: an open-source Postgres tool', link: 'http://example.org/',
    comments: 'https://news.ycombinator.com/item?id=123', published: 'Tue, 24 Nov 2026 18:00:00 GMT' };
  const project = rssStory(hn, item);
  assert.equal(project.url, item.comments);
  assert.equal(project.linkKind, 'discussion');
  assert.deepEqual(project.topics, ['tech', 'programming', 'open-source', 'show-hn']);
  assert.equal(rssStory(hn, { ...item, comments: 'https://news.ycombinator.com/from?id=123' }), null);
  assert.equal(rssStory(hn, { ...item, published: 'unknown' }), null);

  const linuxfr = rssFeeds.find(feed => feed.id === 'linuxfr-news');
  const danTri = rssFeeds.find(feed => feed.id === 'dan-tri-business');
  const french = rssStory(linuxfr, { ...item, title: 'Un autre modèle', categories: ['IA et algorithmes'],
    link: 'https://linuxfr.org/news/un-autre-modele#comment' });
  const vietnamese = rssStory(danTri, { ...item, title: 'Doanh nghiệp mở rộng hoạt động',
    link: 'https://dantri.com.vn/kinh-doanh/a.htm', description: 'Nhà sáng lập nói về kế hoạch gọi vốn.' });
  assert.equal(french.url, 'https://linuxfr.org/news/un-autre-modele');
  assert.deepEqual(shortlist([project, french, vietnamese], { topics: ['ai', 'startups'] }), [french, vietnamese]);
  assert.equal(vietnamese.description, undefined);
  assert.deepEqual(rssStory(linuxfr, { ...item, title: "J'ai acheté un portable", link: french.url }).topics, ['open-source', 'tech']);
  assert.equal(rssStory(linuxfr, { ...item, link: 'https://linuxfr.org.example.org/article' }), null);
});

test('current edition links exclude publishers removed for gated access', () => {
  assert.equal(isCurrentPublisherLink('https://www.lemonde.fr/pixels/article/example.html'), false);
  assert.equal(isCurrentPublisherLink('https://next.ink/123/example/'), false);
  assert.equal(isCurrentPublisherLink('https://arstechnica.com/gadgets/example/'), false);
  assert.equal(isCurrentPublisherLink('https://e.vnexpress.net/news/tech/example.html'), false);
  assert.equal(isCurrentPublisherLink('https://linuxfr.org/news/luneos-en-2026'), true);
  assert.equal(isCurrentPublisherLink('http://linuxfr.org/news/luneos-en-2026'), false);
});

test('the default edition surfaces regional publishers when general feeds are busy', () => {
  const recent = '2026-11-24T18:00:00Z';
  const general = Array.from({ length: 15 }, (_, i) => ({
    ...story, date: recent, url: 'https://example.org/' + i,
  }));
  const regional = ['hacker-news', 'linuxfr-news', 'dan-tri-tech'].map(id => {
    const feed = rssFeeds.find(feed => feed.id === id);
    return rssStory(feed, { title: 'New software', link: 'https://' + feed.host + '/item?id=1',
      published: '2026-11-23T18:00:00Z' });
  });
  const firstPage = shortlist([...general, ...regional]).slice(0, 10);
  assert.ok(regional.every(article => firstPage.includes(article)));
});

test('Vietnamese entertainment uses one feed, with cinema as a separate interest', () => {
  const prefs = { languages: ['vi'], topics: ['movies', 'showbiz'] };
  assert.deepEqual(newsPreferences(prefs), { languages: ['vi'], topics: ['showbiz', 'movies'] });
  const feeds = selectedFeeds(prefs);
  assert.deepEqual(feeds.map(feed => feed.section), ['giai-tri']);
  const item = { title: 'Ca sĩ ra album', published: '11/23/2026 12:30:00 AM',
    url: 'https://tuoitre.vn/ca-si-123456.htm', summary: 'Album mới' };
  const music = tuoitreStory(feeds[0], item);
  const movie = tuoitreStory(feeds[0], { ...item, title: 'Liên hoan phim', url: 'https://tuoitre.vn/phim-234567.htm' });
  assert.equal(music.date, '2026-11-22T17:30:00.000Z');
  assert.equal(music.summary, item.summary);
  assert.equal(tuoitreStory(feeds[0], { ...item, url: 'https://example.org/a' }), null);
  assert.equal(tuoitreStory(feeds[0], { ...item, published: '' }), null);
  assert.deepEqual(shortlist([music, movie, story], { languages: ['vi'], topics: ['movies'] }), [movie]);
  assert.equal(shortlist([music, movie, story], prefs).length, 2);
});

test('multiple interests show the union of matching headlines in the chosen language', () => {
  const culture = { ...story, title: 'Festival de cinéma', topic: 'culture' };
  const tech = { ...story, title: 'Recherche en intelligence artificielle', url: 'https://example.org/tech', topic: 'tech' };
  assert.deepEqual(shortlist([culture, tech, ...starterStories], { languages: ['fr'], topics: ['culture', 'tech'] }), [culture, tech]);
});
