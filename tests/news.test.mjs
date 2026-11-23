import assert from 'node:assert/strict';
import test from 'node:test';
import { ensurePlan, newRoutine, savePreferences } from '../web/planner.js';
import { feedStories, shortlist, starterStories } from '../web/news-provider.js';

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
