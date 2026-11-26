import { BookImportError, readTextBook } from './text-book.js';
import { convertPdf, importPdf } from './pdf-book.js';
import { makeEpub, saveBookFile } from './epub-book.js';
import { addBook, getBook, getOriginal, listBooks, rememberOpenedBook, saveConversion } from './library-repository.js';
import { renderReader } from './book-reader.js';

let savingFile = false;

function showError(panel, message) {
  const error = panel.querySelector('[role="alert"]');
  error.textContent = message;
  error.hidden = !message;
}

async function showLibrary(panel) {
  panel.innerHTML = `<h1 tabindex="-1">Books</h1>
    <details class="card book-import" open>
      <summary>Add a book</summary>
      <form>
        <label for="book-file">Choose a PDF or text file</label>
        <p id="book-source" class="muted">Choose from your device or select Google Drive if it appears in the file picker.</p>
        <input id="book-file" type="file" name="book" accept=".pdf,application/pdf,.txt,text/plain"
          aria-describedby="book-source" required>
        <button type="submit">Import book</button>
      </form>
    </details>
    <p class="book-error" role="alert" hidden></p>
    <p class="book-empty muted" hidden>No books yet. Add your first book above.</p>
    <ul class="book-list history" role="list" aria-label="Imported books"></ul>`;

  const importCard = panel.querySelector('details');
  const form = panel.querySelector('form');
  const button = form.querySelector('button');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (button.disabled) return;
    button.disabled = true;
    button.textContent = 'Importing…';
    showError(panel, '');
    try {
      const file = form.elements.book.files[0];
      const book = /\.pdf$/i.test(file.name) ? await importPdf(file) : await readTextBook(file);
      const id = await addBook(book);
      if (panel.isConnected) location.hash = `book=${id}`;
    } catch (error) {
      showError(panel, error instanceof BookImportError ? error.message : 'Could not import this book.');
    } finally {
      button.disabled = false;
      button.textContent = 'Import book';
    }
  });

  try {
    const books = await listBooks();
    const list = panel.querySelector('ul');
    panel.querySelector('.book-empty').hidden = books.length > 0;
    if (books.length && !importCard.matches(':focus-within')) importCard.open = false;
    for (const book of books) {
      const item = document.createElement('li');
      const link = document.createElement('a');
      link.className = 'card book-row';
      link.href = `#book=${book.id}`;
      const icon = document.createElement('span');
      icon.className = 'book-icon';
      icon.setAttribute('aria-hidden', 'true');
      const info = document.createElement('span');
      const title = document.createElement('strong');
      title.textContent = book.title;
      title.id = `book-title-${book.id}`;
      const detail = document.createElement('span');
      detail.className = 'book-detail muted';
      detail.id = `book-detail-${book.id}`;
      const format = book.originalName ? 'PDF' : 'Text';
      const position = book.count ? `Section ${book.position + 1} of ${book.count}` : 'Ready to convert';
      detail.textContent = `${format} · ${position}`;
      link.setAttribute('aria-labelledby', title.id);
      link.setAttribute('aria-describedby', detail.id);
      info.append(title, detail);
      link.append(icon, info);
      item.append(link);
      if (book.originalName) item.append(bookDownloads(book, title.id));
      list.append(item);
    }
  } catch {
    showError(panel, 'Could not open your book library.');
  }
}

async function showReader(panel, id, activity) {
  panel.innerHTML = `<a class="back-link" href="#books"><span class="arrow" aria-hidden="true"></span>Back to books</a>
    <h1 tabindex="-1">Book</h1>
    <button type="button" data-convert hidden>Convert to EPUB</button>
    <p class="book-error" role="alert" hidden></p>`;

  try {
    const book = await getBook(id);
    if (!panel.isConnected) return;
    if (!book) {
      showError(panel, 'This book is no longer in your library.');
      return;
    }

    const heading = panel.querySelector('h1');
    heading.textContent = book.title;
    rememberOpenedBook(id);
    if (!book.count) {
      if (book.originalName) configureConversion(panel, id, activity);
      return;
    }

    renderReader(panel, book, activity, heading === document.activeElement);
  } catch {
    showError(panel, 'Could not open this book.');
  }
}

function configureConversion(panel, id, activity) {
  const convert = panel.querySelector('[data-convert]');
  convert.hidden = false;
  convert.addEventListener('click', async () => {
    convert.disabled = true;
    convert.textContent = 'Converting…';
    showError(panel, '');
    try {
      const result = await convertPdf(await getOriginal(id));
      await saveConversion(id, result);
      if (panel.isConnected) {
        await showReader(panel, id, activity);
        panel.querySelector('h1').focus();
      }
    } catch (error) {
      showError(panel, error instanceof BookImportError ? error.message : 'Could not convert this PDF.');
    } finally {
      convert.disabled = false;
      convert.textContent = 'Convert to EPUB';
    }
  });
}

function bookDownloads(book, titleId) {
  const files = document.createElement('details');
  files.className = 'book-files';
  files.innerHTML = `<summary aria-describedby="${titleId}">Download files</summary>
    <div class="actions">
      ${book.count ? '<button type="button" data-epub>Save EPUB</button>' : ''}
      <button type="button" class="quiet" data-original>Save original PDF</button>
    </div>
    <p class="book-error" role="alert" hidden></p>`;
  const epub = files.querySelector('[data-epub]');
  const original = files.querySelector('[data-original]');

  async function save(format) {
    if (savingFile) return;
    savingFile = true;
    original.disabled = true;
    if (epub) epub.disabled = true;
    showError(files, '');
    try {
      const file = format === 'EPUB' ? await makeEpub(await getBook(book.id)) : await getOriginal(book.id);
      const name = format === 'EPUB' ? `${book.title}.epub` : book.originalName;
      const mime = format === 'EPUB' ? 'application/epub+zip' : 'application/pdf';
      await saveBookFile(file, name, mime);
    } catch {
      showError(files, `Could not save the ${format}.`);
    } finally {
      savingFile = false;
      original.disabled = false;
      if (epub) epub.disabled = false;
    }
  }

  epub?.addEventListener('click', () => save('EPUB'));
  original.addEventListener('click', () => save('PDF'));
  return files;
}

export function renderBooks(view, id, focus, activity) {
  const panel = document.createElement('div');
  view.replaceChildren(panel);
  if (id) showReader(panel, id, activity);
  else showLibrary(panel);
  if (focus) panel.querySelector('h1').focus();
}
