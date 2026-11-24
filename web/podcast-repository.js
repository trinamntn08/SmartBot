export function podcastRepository(database) {
  const showKey = url => ['podcast-show', url];
  const progressKey = id => ['podcast-position', id];
  const latestKey = 'podcast-latest';

  function run(mode, operation) {
    return new Promise((resolve, reject) => {
      const transaction = database.transaction('routine', mode);
      const result = operation(transaction.objectStore('routine'));
      transaction.oncomplete = () => resolve(result?.result);
      transaction.onabort = () => reject(transaction.error ?? new Error('Podcast storage unavailable'));
    });
  }

  return {
    shows() {
      const range = IDBKeyRange.bound(['podcast-show'], ['podcast-show', []]);
      return run('readonly', store => store.getAll(range));
    },
    saveShow(show, previousUrl) {
      return run('readwrite', store => {
        const previous = store.get(showKey(previousUrl ?? show.feedUrl));
        previous.onsuccess = () => {
          if (previousUrl && !previous.result) return;
          const key = showKey(show.feedUrl);
          const existing = store.get(key);
          existing.onsuccess = () => {
            const id = existing.result?.id ?? previous.result?.id ?? show.feedUrl;
            store.put({ ...show, id }, key);
            if (previousUrl && previousUrl !== show.feedUrl) store.delete(showKey(previousUrl));
          };
        };
      });
    },
    removeShow(url) { return run('readwrite', store => store.delete(showKey(url))); },
    position(id) { return run('readonly', store => store.get(progressKey(id))); },
    latest() { return run('readonly', store => store.get(latestKey)); },
    savePosition(progress) {
      return run('readwrite', store => {
        const existing = store.get(progressKey(progress.episode.id));
        existing.onsuccess = () => {
          if ((existing.result?.updatedAt ?? 0) <= progress.updatedAt) {
            store.put(progress, progressKey(progress.episode.id));
          }
        };
        const latest = store.get(latestKey);
        latest.onsuccess = () => {
          if ((latest.result?.updatedAt ?? 0) <= progress.updatedAt) store.put(progress, latestKey);
        };
      });
    },
  };
}
