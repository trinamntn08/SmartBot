let connection;

export function rememberOpenedBook(id) {
  try { localStorage.setItem('smartbot-last-opened-book', String(id)); }
  catch { /* Reading positions are saved independently in IndexedDB. */ }
}

export function resumeBookRoute() {
  try {
    const id = Number(localStorage.getItem('smartbot-last-opened-book'));
    if (Number.isSafeInteger(id) && id > 0) return '#book=' + id;
  } catch { /* Fall back to the library when the shortcut is unavailable. */ }
  return '#books';
}

function openLibrary() {
  if (!connection) {
    connection = new Promise((resolve, reject) => {
      const request = indexedDB.open('smartbot-library', 2);
      request.onupgradeneeded = ({ oldVersion }) => {
        if (oldVersion < 1) {
          request.result.createObjectStore('books', { keyPath: 'id', autoIncrement: true });
          request.result.createObjectStore('sections');
        }
        request.result.createObjectStore('originals');
      };
      request.onsuccess = () => {
        const database = request.result;
        database.onversionchange = () => {
          database.close();
          connection = null;
        };
        resolve(database);
      };
      request.onerror = () => reject(request.error);
    }).catch((error) => {
      connection = null;
      throw error;
    });
  }
  return connection;
}

async function runTransaction(stores, mode, operation) {
  const database = await openLibrary();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(stores, mode);
    const result = operation(transaction);
    transaction.oncomplete = () => resolve(result());
    transaction.onabort = () => reject(transaction.error ?? new Error('Library transaction aborted'));
  });
}

export function listBooks() {
  return runTransaction('books', 'readonly', (transaction) => {
    const request = transaction.objectStore('books').getAll();
    return () => request.result.reverse();
  });
}

export function addBook({ title, sections, original }) {
  return runTransaction(['books', 'sections', 'originals'], 'readwrite', (transaction) => {
    const request = transaction.objectStore('books').add({
      title, position: 0, count: sections.length, originalName: original?.name,
    });
    request.onsuccess = () => {
      transaction.objectStore('sections').add(sections, request.result);
      if (original) transaction.objectStore('originals').add(original, request.result);
    };
    return () => request.result;
  });
}

export function getOriginal(id) {
  return runTransaction('originals', 'readonly', (transaction) => {
    const request = transaction.objectStore('originals').get(id);
    return () => request.result;
  });
}

export function saveConversion(id, { sections, skippedPages }) {
  return runTransaction(['books', 'sections'], 'readwrite', (transaction) => {
    const books = transaction.objectStore('books');
    const request = books.get(id);
    request.onsuccess = () => {
      const book = request.result;
      if (!book?.originalName || book.count > 0) return;
      books.put({ ...book, count: sections.length, skippedPages });
      transaction.objectStore('sections').put(sections, id);
    };
    return () => undefined;
  });
}

export function getBook(id) {
  return runTransaction(['books', 'sections'], 'readonly', (transaction) => {
    const book = transaction.objectStore('books').get(id);
    const sections = transaction.objectStore('sections').get(id);
    return () => book.result ? { ...book.result, sections: sections.result } : null;
  });
}

export function saveBookPosition(id, position) {
  return runTransaction('books', 'readwrite', (transaction) => {
    const store = transaction.objectStore('books');
    const request = store.get(id);
    request.onsuccess = () => {
      const book = request.result;
      if (book && position >= 0 && position < book.count) store.put({ ...book, position });
    };
    return () => undefined;
  });
}
