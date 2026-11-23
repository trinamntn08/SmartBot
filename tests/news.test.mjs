import assert from 'node:assert/strict';
import test from 'node:test';
import { ensurePlan, newRoutine, savePreferences } from '../web/planner.js';
import { feedStories, selectedFeeds, shortlist, starterStories } from '../web/news-provider.js';
import { newsPreferences, newsTopics } from '../web/news-preferences.js';
import { tuoitreStory } from '../web/tuoitre.js';

const day = { date: '2026-11-23', timeZone: 'Europe/Paris' };
const story = starterStories.find(item => item.source === 'Affaires mondiales Canada');

test('setting up reading preserves an earlier news pick and its read history', () => {
  const routine = newRoutine();
  const news = { story, status: 'completed', minutes: 5 };
  const readStories = { [story.url]: story.title };
  routine.plans[day.date] = { ...day, news, readStories };
  savePreferences(routine, { title: 'Paper book', budget: 20, page: 7 });
  ensurePlan(routine, day);
  assert.deepEqual(routine.plans[day.date].news, news);
  assert.deepEqual(routine.plans[day.date].readStories, readStories);
  assert.equal(routine.plans[day.date].reading.minutes, 10);
});

test('live feed keeps approved language, topic, and publisher article links', () => {
  const entry = { title: 'Du nouveau pour le sport', link: story.url, publishedDate: '2026-11-20' };
  const entries = [entry, { ...entry, title: 'Arts et musique' }, { ...entry, link: 'https://example.org/paywall' }];
  const output = feedStories(entries, { language: 'fr', topic: 'sports' });
  assert.deepEqual(output.map(item => item.url), [story.url]);
  assert.equal(feedStories(entries, { language: 'en', topic: 'sports' }).length, 0);
});

test('the shortlist keeps a bilingual topic mix, removes duplicates, and respects filters', () => {
  const stories = [...starterStories, ...starterStories, ...Array.from({ length: 8 }, (_, i) =>
    ({ ...story, date: '2026-11-23', url: 'https://example.org/' + i }))];
  const result = shortlist(stories);
  assert.equal(result.length, new Set(stories.map(item => item.url)).size);
  assert.equal(new Set(result.map(item => item.url)).size, result.length);
  const firstPage = result.slice(0, 10);
  assert.equal(firstPage.length, 10);
  assert.equal(new Set(firstPage.map(item => item.topic + item.language)).size, 4);
  assert.ok(result.slice(10).length > 0);
  assert.deepEqual(shortlist(stories, { language: 'fr', topic: 'sports' }), starterStories.filter(item => item.language === 'fr' && item.topic === 'sports'));
});

test('news preferences retain earlier choices and normalize multiple selections', () => {
  assert.deepEqual(newsPreferences({ language: 'fr', topic: 'sports' }), { languages: ['fr'], topics: ['sports'] });
  assert.deepEqual(newsPreferences({ language: '', topic: '' }), { languages: ['en', 'fr'], topics: [] });
  assert.deepEqual(newsPreferences({ languages: ['fr', 'en', 'fr'], topics: ['tech', 'culture', 'other'] }),
    { languages: ['en', 'fr'], topics: ['culture', 'tech'] });
});

test('each suggested interest has a feed in each language', () => {
  for (const language of ['en', 'fr', 'vi']) {
    for (const { id } of newsTopics) {
      const selected = selectedFeeds({ languages: [language], topics: [id] });
      assert.ok(selected.some(feed => feed.topic === id || feed.related?.includes(id)), language + '/' + id);
      assert.ok(selected.every(feed => feed.language === language));
    }
  }
  const feeds = selectedFeeds({ languages: ['fr'], topics: ['culture', 'tech'] });
  assert.deepEqual(feeds.map(feed => feed.subject), ['artsandmedia', 'scienceandinnovation']);
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
  const entry = { title: 'Festival de cinéma', link: story.url, publishedDate: '2026-11-20' };
  const second = { ...entry, title: 'Recherche en intelligence artificielle', link: entry.link.replace('.html', '-2.html') };
  const culture = feedStories([entry], { language: 'fr', topic: 'culture' });
  const tech = feedStories([entry, second], { language: 'fr', topic: 'tech' });
  assert.deepEqual(tech.map(item => item.title), [second.title]);
  const result = shortlist([...culture, ...tech, ...starterStories], { languages: ['fr'], topics: ['culture', 'tech'] });
  assert.deepEqual(result.map(item => item.url).sort(), [entry.link, second.link].sort());
});
