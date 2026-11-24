import { feeds, isCanadaStory, starterStories, storyTopics } from './news-provider.js';
import { newsPreferences } from './news-preferences.js';

const storagePrefix = 'smartbot-news-';
const openPrefix = 'open:';
const maxOpens = 120;
const activityWindow = 90 * 86400000;

function read(key) {
  try { return JSON.parse(localStorage.getItem(storagePrefix + key)); }
  catch { return null; }
}

function write(key, value) {
  try {
    localStorage.setItem(storagePrefix + key, JSON.stringify(value));
    return true;
  } catch { return false; }
}

function openKeys() {
  return Object.keys(localStorage).filter(key => key.startsWith(storagePrefix + openPrefix))
    .map(key => key.slice(storagePrefix.length));
}

function readOpens() {
  return openKeys().map(key => {
    const value = read(key);
    return { ...value, url: key.slice(openPrefix.length) };
  }).filter(open => Number.isFinite(open.at) && Array.isArray(open.topics))
    .sort((a, b) => b.at - a.at);
}

export const newsRepository = {
  preferences() { return newsPreferences(read('filters')); },
  savePreferences(value) { return write('filters', value); },
  personalized() { return read('personalized') !== false; },
  setPersonalized(enabled) { return write('personalized', enabled); },
  opens(now = Date.now()) {
    try { return readOpens().filter(open => open.at > now - activityWindow).slice(0, maxOpens); }
    catch { return []; }
  },
  recordOpen(story, now = Date.now()) {
    if (!this.personalized() || isCanadaStory(story.url)) return;
    const key = openPrefix + story.url;
    if (read(key)?.at > now - activityWindow) return;
    // One key per article lets tabs record different opens without overwriting each other.
    if (!write(key, { at: now, source: story.source, topics: storyTopics(story) })) return;
    try {
      readOpens().forEach((open, index) => {
        if (index >= maxOpens || open.at <= now - activityWindow) {
          localStorage.removeItem(storagePrefix + openPrefix + open.url);
        }
      });
    } catch { /* Ranking still uses a bounded history if storage cleanup is unavailable. */ }
  },
  resetOpens() {
    try {
      for (const key of openKeys()) localStorage.removeItem(storagePrefix + key);
      return true;
    } catch { return false; }
  },
  edition(feed) { return read(feed.id); },
  saveEdition(feed, edition) {
    if (this.edition(feed)?.time > edition.time) return true;
    return write(feed.id, edition);
  },
  stories() {
    return [...feeds.flatMap(feed => this.edition(feed)?.stories ?? []), ...starterStories];
  },
  article(url) { return (read('articles') ?? []).find(item => item.story.url === url); },
  saveArticle(story, body) {
    const others = (read('articles') ?? []).filter(item => item.story.url !== story.url);
    return write('articles', [{ story, body }, ...others.slice(0, 7)]);
  },
};

// Each star is a separate IndexedDB record, independent of the rolling feed and recent cache.
export function savedNewsRepository(database) {
  const key = url => ['saved-news', url];
  function run(mode, operation) {
    return new Promise((resolve, reject) => {
      const tx = database.transaction('routine', mode);
      const request = operation(tx.objectStore('routine'));
      tx.oncomplete = () => resolve(request.result);
      tx.onabort = () => reject(tx.error ?? new Error('Saved stories unavailable'));
    });
  }
  return {
    get(url) { return run('readonly', store => store.get(key(url))); },
    list() {
      const range = IDBKeyRange.bound(['saved-news'], ['saved-news', []]);
      return run('readonly', store => store.getAll(range));
    },
    async urls() {
      const range = IDBKeyRange.bound(['saved-news'], ['saved-news', []]);
      const keys = await run('readonly', store => store.getAllKeys(range));
      return keys.map(key => key[1]);
    },
    save(story, body) {
      return run('readwrite', store => {
        const request = store.get(key(story.url));
        request.onsuccess = () => {
          const existing = request.result;
          store.put({ story, body: existing?.body?.blocks ? existing.body : body ?? existing?.body,
            savedAt: existing?.savedAt ?? Date.now() }, key(story.url));
        };
        return request;
      });
    },
    remove(url) { return run('readwrite', store => store.delete(key(url))); },
    cacheIfSaved(url, body) {
      return run('readwrite', store => {
        const request = store.get(key(url));
        request.onsuccess = () => {
          if (request.result) store.put({ ...request.result, body }, key(url));
        };
        return request;
      });
    },
  };
}
