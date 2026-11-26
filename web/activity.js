import { localDay } from './planner.js';

export const activityCategories = [
  { id: 'reading', label: 'Books', route: 'books' },
  { id: 'podcasts', label: 'Podcasts', route: 'podcasts' },
  { id: 'music', label: 'Music', route: 'tracks' },
  { id: 'news', label: 'News', route: 'news' },
  { id: 'languages', label: 'Languages' },
  { id: 'movies', label: 'Movies' },
];

export function activityIntervals(activity, start, end) {
  const entries = [];
  while (start < end) {
    const nextDay = new Date(start).setHours(24, 0, 0, 0);
    const until = Math.min(end, nextDay);
    entries.push({ ...activity, date: localDay(new Date(start)).date, ms: until - start });
    start = until;
  }
  return entries;
}

export function mergeActivity(previous, entry) {
  return {
    ...previous, ...entry,
    ms: (previous?.ms ?? 0) + (entry.ms ?? 0),
    sections: [...new Set([...(previous?.sections ?? []), ...(entry.sections ?? [])])],
    pdfPages: [...new Set([...(previous?.pdfPages ?? []), ...(entry.pdfPages ?? [])])],
  };
}

export function summarizeActivity(entries, reading) {
  const outcome = reading?.status === 'completed' && reading.outcome;
  const records = outcome ? [...entries, {
    category: 'reading', topic: reading.book?.title || 'Reading routine',
    ms: outcome.minutes * 60_000, pages: outcome.pages ?? 0,
  }] : entries;

  const groups = activityCategories.map(category => {
    const topics = new Map();
    for (const entry of records) {
      if (entry.category !== category.id) continue;
      const label = entry.topic || category.label;
      const topic = topics.get(label) ?? { label, ms: 0, pages: 0, sections: 0 };
      topic.ms += entry.ms;
      topic.pages += (entry.pages ?? 0) + (entry.pdfPages?.length ?? 0);
      topic.sections += entry.sections?.length ?? 0;
      topics.set(label, topic);
    }
    const details = [...topics.values()].sort((a, b) => b.ms - a.ms || a.label.localeCompare(b.label));
    return {
      ...category, details,
      ms: details.reduce((sum, topic) => sum + topic.ms, 0),
      pages: details.reduce((sum, topic) => sum + topic.pages, 0),
    };
  });
  return groups;
}

export function trackForegroundActivity(record) {
  const interval = 5_000;
  const idleLimit = 120_000;
  let activity;
  let panel;
  let start = null;
  let lastInput = performance.now();

  function checkpoint(now = performance.now()) {
    if (start === null) return;
    const elapsed = Math.min(now, lastInput + idleLimit) - start;
    // Timer callbacks can be delayed during system sleep or browser suspension.
    if (elapsed > 0 && now - start <= interval * 3 && panel.isConnected) {
      const end = Date.now() - (now - start - elapsed);
      record(activityIntervals(activity, end - elapsed, end));
    }
    start = null;
  }

  function resume(now = performance.now()) {
    if (panel?.isConnected && !document.hidden && document.hasFocus() && now < lastInput + idleLimit) start = now;
  }

  function interact() {
    const now = performance.now();
    if (now >= lastInput + idleLimit) checkpoint(now);
    lastInput = now;
    if (start === null) resume(now);
  }

  for (const type of ['pointerdown', 'keydown', 'scroll']) {
    document.addEventListener(type, interact, { passive: true, capture: true });
  }
  window.addEventListener('blur', () => checkpoint());
  window.addEventListener('focus', interact);
  window.addEventListener('pagehide', () => checkpoint());
  window.addEventListener('pageshow', interact);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) checkpoint();
    else interact();
  });
  setInterval(() => {
    const now = performance.now();
    checkpoint(now);
    resume(now);
  }, interval);

  return (next, element) => {
    checkpoint();
    activity = next;
    panel = element;
    if (next) interact();
  };
}
