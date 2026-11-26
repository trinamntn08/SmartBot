import { BookImportError, readTextBook } from './text-book.js';
import { convertPdf, importPdf } from './pdf-book.js';
import { makeEpub, saveBookFile } from './epub-book.js';
import {
  addBook, getBook, getOriginal, lastOpenedBookId, listBooks, rememberOpenedBook, saveConversion,
} from './library-repository.js';
import { renderReader } from './book-reader.js';

let pendingImport;
let savingFile = false;

function showError(alert, message) {
  alert.textContent = message;
  alert.hidden = !message;
}

function displayTitle(book) {
  if (book.metadataTitle) return book.metadataTitle;
  const name = book.originalName || book.fileName || book.title;
  return name.replace(/\.(?:pdf|txt)$/i, '')
    .replace(/(?:\s*\(\d+\))+\s*$/, '')
    .replace(/[_.\-–—]+/g, ' ')
    .replace(/\s+/g, ' ').trim() || 'Untitled book';
}

function bookRow(book) {
  const item = document.createElement('li');
  item.innerHTML = `<a class="book-row">
    <span class="book-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24"><path d="M6 19a2 2 0 0 1 2-2h10M9 4v13M8 4h10v17H8a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"/></svg>
    </span>
    <span class="book-row-copy">
      <strong class="book-title"></strong>
      <span class="book-detail"></span>
    </span>
  </a>`;
  const link = item.querySelector('a');
  const title = item.querySelector('strong');
  const detail = item.querySelector('.book-detail');
  link.href = `#book=${book.id}`;
  title.id = `book-title-${book.id}`;
  title.textContent = displayTitle(book);
  detail.id = `book-detail-${book.id}`;
  detail.textContent = book.count ? `Section ${book.position + 1} of ${book.count}` : 'Ready to convert';
  link.setAttribute('aria-labelledby', title.id);
  link.setAttribute('aria-describedby', detail.id);
  return item;
}

async function importBook(file) {
  if (/\.pdf$/i.test(file.name)) return addBook(await importPdf(file));
  if (/\.txt$/i.test(file.name)) return addBook(await readTextBook(file));
  throw new BookImportError('Choose a PDF or plain text (.txt) file.');
}

function showLibrary(panel) {
  panel.className = 'book-library';
  panel.innerHTML = `<header class="book-library-header">
      <h1 tabindex="-1">Books</h1>
      <button class="book-add" type="button" data-add aria-label="Add book">+</button>
    </header>
    <ul class="book-list" role="list" aria-label="Books in your library" hidden></ul>
    <div class="book-empty" hidden>
      <p>No books yet</p>
      <button type="button" data-add>Add book</button>
    </div>
    <p class="book-import-status" role="status"></p>
    <p class="book-error" role="alert" hidden></p>
    <input type="file" accept=".pdf,application/pdf,.txt,text/plain" hidden>`;

  const fileInput = panel.querySelector('input');
  const buttons = panel.querySelectorAll('[data-add]');
  const status = panel.querySelector('[role="status"]');
  const error = panel.querySelector('[role="alert"]');

  async function loadBooks() {
    try {
      const books = await listBooks();
      const lastOpened = lastOpenedBookId();
      books.sort((first, second) => Number(second.id === lastOpened) - Number(first.id === lastOpened));
      const list = panel.querySelector('ul');
      list.replaceChildren(...books.map(bookRow));
      list.hidden = !books.length;
      panel.querySelector('.book-empty').hidden = Boolean(books.length);
    } catch {
      showError(error, 'Could not open your book library.');
    }
  }

  async function showImport(importing, openReader) {
    for (const button of buttons) button.disabled = true;
    status.textContent = 'Importing book…';
    showError(error, '');
    try {
      const id = await importing;
      if (!panel.isConnected) return;
      if (openReader) location.hash = `book=${id}`;
      else await loadBooks();
    } catch (cause) {
      showError(error, cause instanceof BookImportError ? cause.message : 'Could not import this book.');
    } finally {
      for (const button of buttons) button.disabled = false;
      status.textContent = '';
    }
  }

  for (const button of buttons) button.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    fileInput.value = '';
    if (!file || pendingImport) return;
    pendingImport = importBook(file).finally(() => { pendingImport = undefined; });
    showImport(pendingImport, true);
  });

  loadBooks();
  if (pendingImport) showImport(pendingImport, false);
}

async function showReader(panel, id, activity) {
  panel.className = 'book-entry';
  panel.innerHTML = `<a class="back-link" href="#books"><span class="arrow" aria-hidden="true"></span>Back to books</a>
    <header class="book-entry-header">
      <h1 tabindex="-1">Book</h1>
    </header>
    <button type="button" data-convert hidden>Convert to EPUB</button>
    <p class="book-error" role="alert" hidden></p>`;
  const error = panel.querySelector('[role="alert"]');

  try {
    const book = await getBook(id);
    if (!panel.isConnected) return;
    if (!book) {
      showError(error, 'This book is no longer in your library.');
      return;
    }

    const title = displayTitle(book);
    const heading = panel.querySelector('h1');
    const options = bookOptions(book, title);
    rememberOpenedBook(id);
    if (!book.count) {
      heading.textContent = title;
      heading.after(options);
      if (book.originalName) configureConversion(panel, id, activity, error);
    } else {
      renderReader(panel, book, activity, { title, options, focus: heading === document.activeElement });
    }

    // Scope dismissal to this screen so leaving the reader removes its handlers.
    panel.addEventListener('click', (event) => {
      if (options.open && !options.contains(event.target)) options.open = false;
    });
    panel.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape' || !options.open) return;
      options.open = false;
      options.querySelector('summary').focus();
    });
  } catch {
    showError(panel.querySelector(':scope > .book-error, .book-page > .book-error'), 'Could not open this book.');
  }
}

function configureConversion(panel, id, activity, error) {
  const convert = panel.querySelector('[data-convert]');
  convert.hidden = false;
  convert.addEventListener('click', async () => {
    convert.disabled = true;
    convert.textContent = 'Converting…';
    showError(error, '');
    try {
      const result = await convertPdf(await getOriginal(id));
      await saveConversion(id, result);
      if (panel.isConnected) {
        // Replace the entry panel and its handlers when the converted reader opens.
        renderBooks(panel.parentElement, id, true, activity);
      }
    } catch (cause) {
      showError(error, cause instanceof BookImportError ? cause.message : 'Could not convert this PDF.');
    } finally {
      convert.disabled = false;
      convert.textContent = 'Convert to EPUB';
    }
  });
}

function bookOptions(book, title) {
  const options = document.createElement('details');
  options.className = 'book-options';
  options.innerHTML = `<summary class="book-tool" aria-label="Book options"><span aria-hidden="true">⋯</span></summary>
    <div class="book-options-panel">
      <p class="book-full-title"></p>
      <dl class="book-file-name" hidden><dt>File name</dt><dd></dd></dl>
      ${book.originalName ? `<div class="book-downloads">
        ${book.count ? '<button class="book-tool" type="button" data-save="EPUB">Save EPUB</button>' : ''}
        <button class="book-tool" type="button" data-save="PDF">Save original PDF</button>
      </div>` : ''}
      <p class="book-error" role="alert" hidden></p>
    </div>`;
  options.querySelector('.book-full-title').textContent = title;
  const fileName = book.originalName || book.fileName || book.title;
  if (fileName !== title) {
    options.querySelector('dd').textContent = fileName;
    options.querySelector('dl').hidden = false;
  }

  const summary = options.querySelector('summary');
  const buttons = options.querySelectorAll('[data-save]');
  const error = options.querySelector('[role="alert"]');
  for (const button of buttons) button.addEventListener('click', async () => {
    if (savingFile) return;
    const format = button.dataset.save;
    savingFile = true;
    for (const action of buttons) action.disabled = true;
    showError(error, '');
    try {
      const epub = format === 'EPUB';
      const file = epub ? await makeEpub(book) : await getOriginal(book.id);
      const name = epub ? `${book.title}.epub` : book.originalName;
      const type = epub ? 'application/epub+zip' : 'application/pdf';
      if (await saveBookFile(file, name, type) && options.open) {
        options.open = false;
        if (options.isConnected) summary.focus({ preventScroll: true });
      }
    } catch {
      showError(error, `Could not save the ${format}.`);
    } finally {
      savingFile = false;
      for (const action of buttons) action.disabled = false;
    }
  });
  return options;
}

export function renderBooks(view, id, focus, activity) {
  const panel = document.createElement('div');
  view.replaceChildren(panel);
  if (id) showReader(panel, id, activity);
  else showLibrary(panel);
  if (focus) panel.querySelector('h1').focus();
}
