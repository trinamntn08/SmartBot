import assert from 'node:assert/strict';
import test from 'node:test';
import { ensurePlan, localDay, newRoutine, recentPlans, savePreferences, updateReading } from '../web/planner.js';

function setup({ budget = 25, title = 'A book', page = null } = {}) {
  const routine = newRoutine();
  savePreferences(routine, { budget, title, page });
  return routine;
}

const date = '2026-11-22';
const day = { date, timeZone: 'Europe/Paris' };

test('a budget change applies to new plans and preserves edits on the same local date', () => {
  const routine = setup();
  ensurePlan(routine, day);
  assert.equal(routine.plans[date].reading.minutes, 10);
  updateReading(routine, date, { type: 'estimate', minutes: 17 });
  savePreferences(routine, { budget: 7, title: 'A book', page: null });
  ensurePlan(routine, { ...day, timeZone: 'America/New_York' });
  assert.equal(routine.plans[date].timeZone, 'Europe/Paris');
  assert.equal(routine.plans[date].budget, 25);
  assert.equal(routine.plans[date].reading.minutes, 17);

  const tomorrow = '2026-11-23';
  ensurePlan(routine, { date: tomorrow, timeZone: 'America/New_York' });
  assert.equal(routine.plans[tomorrow].budget, 7);
  assert.equal(routine.plans[tomorrow].reading.minutes, 5);
});

test('repeated finish keeps one outcome and undo retains the saved page', () => {
  const routine = setup({ page: 12 });
  ensurePlan(routine, day);
  updateReading(routine, date, { type: 'start' });
  updateReading(routine, date, { type: 'finish', minutes: 8, page: 27 });
  updateReading(routine, date, { type: 'finish', minutes: 9, page: 40 });
  assert.deepEqual(routine.plans[date].reading.outcome, { minutes: 8, page: 27, pages: 15 });
  assert.equal(routine.book.page, 27);

  updateReading(routine, date, { type: 'undo' });
  assert.equal(routine.plans[date].reading.status, 'started');
  assert.equal(routine.plans[date].reading.outcome, null);
  assert.equal(routine.book.page, 27);
  updateReading(routine, date, { type: 'finish', minutes: 8, page: null });
  assert.equal(routine.plans[date].reading.outcome.page, 27);
  assert.equal(routine.plans[date].reading.outcome.pages, 15);
});

test('a started session keeps its book after changing the current book', () => {
  const routine = setup({ page: 12 });
  ensurePlan(routine, day);
  updateReading(routine, date, { type: 'start' });
  savePreferences(routine, { budget: 25, title: 'Next book', page: null });
  updateReading(routine, date, { type: 'skip' });
  updateReading(routine, date, { type: 'undo' });
  updateReading(routine, date, { type: 'finish', minutes: 10, page: 19 });
  assert.equal(routine.plans[date].reading.book.title, 'A book');
  assert.equal(routine.plans[date].reading.outcome.page, 19);
  assert.equal(routine.book.title, 'Next book');
  assert.equal(routine.book.page, null);
});

test('local day and seven-day history follow calendar dates across zones', () => {
  const instant = new Date('2026-11-22T23:30:00Z');
  assert.equal(localDay(instant, 'Europe/Paris').date, '2026-11-23');
  assert.equal(localDay(instant, 'America/New_York').date, '2026-11-22');

  const routine = setup();
  for (const date of ['2026-11-15', '2026-11-16', '2026-11-22', '2026-11-23']) {
    ensurePlan(routine, { ...day, date });
  }
  assert.deepEqual(recentPlans(routine, date).map((plan) => plan.date), ['2026-11-22', '2026-11-16']);
});
