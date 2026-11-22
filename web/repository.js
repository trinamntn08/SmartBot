import { newRoutine } from './planner.js';

export async function openRepository() {
  const database = await new Promise((resolve, reject) => {
    const request = indexedDB.open('smartbot', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('routine');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  database.onversionchange = () => database.close();

  return {
    // A single transaction keeps plan outcomes and reading progress in sync across tabs.
    update(change) {
      return new Promise((resolve, reject) => {
        const transaction = database.transaction('routine', 'readwrite');
        const store = transaction.objectStore('routine');
        const request = store.get('current');
        let routine;
        let failure;

        request.onsuccess = () => {
          routine = request.result ?? newRoutine();
          try {
            change(routine);
            store.put(routine, 'current');
          } catch (error) {
            failure = error;
            transaction.abort();
          }
        };
        transaction.oncomplete = () => resolve(routine);
        transaction.onabort = () => reject(failure ?? transaction.error ?? new Error('Routine update aborted'));
      });
    },
  };
}
