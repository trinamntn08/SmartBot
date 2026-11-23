import assert from 'node:assert/strict';
import test from 'node:test';
import { ensurePlan, newRoutine, savePreferences, updateNews } from '../web/planner.js';
import { feedStories, shortlist, starterStories } from '../web/news-provider.js';

const day = { date: '2026-11-23', timeZone: 'Europe/Paris' };
const story = starterStories[2];

test('a standalone pick survives setup, repeated actions, and the next day', () => {
  const routine = newRoutine();
  updateNews(routine, day, story, 'add');
  updateNews(routine, day, starterStories[1], 'add');
  savePreferences(routine, { title: 'Paper book', budget: 20, page: 7 });
  ensurePlan(routine, day);
  const plan = routine.plans[day.date];
  assert.deepEqual(plan.news.story, story);
  assert.equal(plan.budget, 20);
  for (let i = 0; i < 2; i++) updateNews(routine, day, story, 'read');
  updateNews(routine, day, story, 'remove');
  assert.equal(plan.news.status, 'completed');
  assert.equal(plan.reading.status, 'pending');
  const tomorrow = { ...day, date: '2026-11-24' };
  ensurePlan(routine, tomorrow);
  assert.equal(routine.plans[tomorrow.date].news, undefined);
  updateNews(routine, tomorrow, story, 'unread');
  assert.equal(plan.news.status, 'completed');
  assert.equal(routine.book.page, 7);
});

test('removing a pending article preserves older reading-only records', () => {
  const routine = newRoutine();
  savePreferences(routine, { title: 'Paper book', budget: 25, page: 15 });
  ensurePlan(routine, day);
  const old = structuredClone(routine);
  updateNews(routine, day, story, 'add');
  updateNews(routine, day, story, 'remove');
  assert.deepEqual(routine, old);
});

test('standalone reads, repeat taps and undo keep dated history without creating a reading routine', () => {
  const routine = newRoutine();
  for (const article of [story, story, starterStories[0]]) updateNews(routine, day, article, 'read');
  assert.equal(Object.keys(routine.plans[day.date].readStories).length, 2);
  updateNews(routine, day, story, 'unread');
  assert.deepEqual(routine.plans[day.date].readStories, { [starterStories[0].url]: starterStories[0].title });
  assert.equal(routine.settings, null);
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
  assert.deepEqual(shortlist(stories, { language: 'fr', topic: 'sports' }), [starterStories[0]]);
});
