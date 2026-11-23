import assert from 'node:assert/strict';
import test from 'node:test';
import { ensurePlan, newRoutine, savePreferences } from '../web/planner.js';
import { feedStories, selectedFeeds, shortlist, starterStories } from '../web/news-provider.js';
import { newsPreferences, newsTopics } from '../web/news-preferences.js';

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
  assert.equal(result.length, 5);
  assert.equal(new Set(result.map(item => item.url)).size, 5);
  assert.equal(new Set(result.map(item => item.topic + item.language)).size, 4);
  assert.deepEqual(shortlist(stories, { language: 'fr', topic: 'sports' }), starterStories.filter(item => item.language === 'fr' && item.topic === 'sports'));
});

test('news preferences retain earlier choices and normalize multiple selections', () => {
  assert.deepEqual(newsPreferences({ language: 'fr', topic: 'sports' }), { languages: ['fr'], topics: ['sports'] });
  assert.deepEqual(newsPreferences({ language: '', topic: '' }), { languages: ['en', 'fr'], topics: [] });
  assert.deepEqual(newsPreferences({ languages: ['fr', 'en', 'fr'], topics: ['tech', 'culture', 'other'] }),
    { languages: ['en', 'fr'], topics: ['culture', 'tech'] });
});

test('each suggested interest has a feed in each language', () => {
  for (const language of ['en', 'fr']) {
    for (const { id } of newsTopics) {
      const selected = selectedFeeds({ languages: [language], topics: [id] });
      assert.ok(selected.some(feed => feed.topic === id && (id === 'general' || feed.subject || feed.department)));
      assert.ok(selected.every(feed => feed.language === language));
    }
  }
  const feeds = selectedFeeds({ languages: ['fr'], topics: ['culture', 'tech'] });
  assert.deepEqual(feeds.map(feed => feed.subject), ['artsandmedia', 'scienceandinnovation']);
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
