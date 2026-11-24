import { mergeActivity } from './activity.js';

export function activityRepository(database) {
  const key = (date, id) => ['activity', date, id];

  function run(mode, operation) {
    return new Promise((resolve, reject) => {
      const transaction = database.transaction('routine', mode);
      const request = operation(transaction.objectStore('routine'));
      transaction.oncomplete = () => resolve(request?.result);
      transaction.onabort = () => reject(transaction.error ?? new Error('Activity storage unavailable'));
    });
  }

  return {
    day(date) {
      const range = IDBKeyRange.bound(key(date, ''), key(date, []));
      return run('readonly', store => store.getAll(range));
    },
    record(entries) {
      return run('readwrite', store => {
        for (const entry of entries) {
          const id = key(entry.date, entry.id);
          const previous = store.get(id);
          previous.onsuccess = () => store.put(mergeActivity(previous.result, entry), id);
        }
      });
    },
    add(entry) {
      return run('readwrite', store => store.add(entry, key(entry.date, entry.id)));
    },
    remove(date, id) {
      return run('readwrite', store => {
        const record = store.get(key(date, id));
        record.onsuccess = () => { if (record.result?.manual) store.delete(key(date, id)); };
      });
    },
  };
}
