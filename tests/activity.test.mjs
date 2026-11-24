import assert from 'node:assert/strict';
import test from 'node:test';
import { activityIntervals, mergeActivity, summarizeActivity } from '../web/activity.js';
import { updateReading } from '../web/planner.js';

test('a timed interval is split by local midnight and keeps all elapsed time', () => {
  const before = new Date(2026, 10, 24, 23, 59, 57).valueOf();
  const after = new Date(2026, 10, 25, 0, 0, 2).valueOf();
  assert.deepEqual(activityIntervals({ category: 'podcasts' }, before, after), [
    { category: 'podcasts', date: '2026-11-24', ms: 3000 },
    { category: 'podcasts', date: '2026-11-25', ms: 2000 },
  ]);
});

test('book page and section counts remain distinct across repeated actions', () => {
  const book = { category: 'reading', topic: 'Introduction' };
  const first = mergeActivity(null, { ...book, ms: 1800, pdfPages: [1], sections: [0] });
  const again = mergeActivity(first, { ...book, ms: 2500, pdfPages: [1, 3], sections: [0, 1] });
  const log = { ...book, ms: 0, pages: 5, manual: true };
  const [reading] = summarizeActivity([again, log]);
  assert.deepEqual(reading.details, [{ label: 'Introduction', ms: 4300, pages: 7, sections: 2 }]);
});

test('historical reading time contributes without interpreting a bookmark as pages read', () => {
  const entry = { status: 'completed', book: { id: 1, title: 'Book', page: 48 }, outcome: { minutes: 9, page: 48 } };
  const date = '2026-11-24';
  const routine = { plans: { [date]: { reading: entry } }, book: { id: 1, page: 48 } };
  assert.equal(summarizeActivity([], entry)[0].ms, 9 * 60_000);
  assert.equal(summarizeActivity([], entry)[0].pages, 0);
  updateReading(routine, date, { type: 'undo' });
  assert.equal(summarizeActivity([], entry)[0].ms, 0);
  assert.equal(routine.book.page, 48);
});
