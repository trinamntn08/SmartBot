import { BookImportError, readTextBook } from './text-book.js';
import { convertPdf, importPdf } from './pdf-book.js';
import { makeEpub, saveBookFile } from './epub-book.js';
import { addBook, getBook, getOriginal, listBooks, saveBookPosition, saveConversion } from './library-repository.js';

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
      list.append(item);
    }
  } catch {
    showError(panel, 'Could not open your book library.');
  }
}

async function showReader(panel, id) {
  panel.innerHTML = `<a class="book-back" href="#books"><span aria-hidden="true">←</span> Back to books</a>
    <h1 tabindex="-1">Book</h1>
    <div data-pdf-tools></div>
    <p class="book-error" role="alert" hidden></p>
    <p class="book-file-status muted" data-file-status role="status"></p>
    <p class="muted" data-conversion-note hidden></p>
    <section class="card book-reader" hidden aria-label="Book text">
      <header class="book-reader-progress">
        <p class="book-position muted" role="status"></p>
        <progress aria-label="Reading progress"></progress>
      </header>
      <p class="book-content"></p>
      <div class="actions book-pagination" hidden>
        <button type="button" data-step="-1">Previous section</button>
        <button type="button" class="primary" data-step="1">Next section</button>
      </div>
    </section>`;

  try {
    const book = await getBook(id);
    if (!book) {
      showError(panel, 'This book is no longer in your library.');
      return;
    }

    const heading = panel.querySelector('h1');
    heading.textContent = book.title;
    if (book.originalName) configurePdf(panel, book);
    if (!book.count) return;

    const position = panel.querySelector('.book-position');
    const progress = panel.querySelector('progress');
    const content = panel.querySelector('.book-content');
    const previous = panel.querySelector('[data-step="-1"]');
    const next = panel.querySelector('[data-step="1"]');
    panel.querySelector('.book-pagination').hidden = book.count < 2;
    let section = book.position;
    progress.max = book.count;

    function renderSection() {
      content.textContent = book.sections[section];
      position.textContent = `Section ${section + 1} of ${book.count}`;
      progress.value = section + 1;
      previous.disabled = section === 0;
      next.disabled = section === book.count - 1;
    }

    async function turnSection(event) {
      const target = section + Number(event.currentTarget.dataset.step);
      if (target < 0 || target >= book.count) return;
      previous.disabled = true;
      next.disabled = true;
      showError(panel, '');
      try {
        await saveBookPosition(id, target);
        section = target;
        heading.focus();
      } catch {
        showError(panel, 'Could not save your reading position.');
      } finally {
        renderSection();
      }
    }

    panel.querySelector('section').hidden = false;
    previous.addEventListener('click', turnSection);
    next.addEventListener('click', turnSection);
    renderSection();
  } catch {
    showError(panel, 'Could not open this book.');
  }
}

function configurePdf(panel, book) {
  const tools = panel.querySelector('[data-pdf-tools]');
  const originalButton = '<button type="button" data-original>Save original PDF</button>';
  tools.innerHTML = book.count
    ? `<details class="book-files">
        <summary>Book files</summary>
        <div class="actions">
          <button type="button" class="primary" data-epub>Save EPUB</button>
          ${originalButton}
        </div>
      </details>`
    : `<section class="card book-conversion" aria-labelledby="book-conversion-title">
        <h2 id="book-conversion-title">PDF to EPUB</h2>
        <p class="muted">Convert selectable text to a layout that fits your screen.</p>
        <div class="actions">
          <button type="button" class="primary" data-convert>Convert to EPUB</button>
          ${originalButton}
        </div>
      </section>`;
  const convert = panel.querySelector('[data-convert]');
  const epub = panel.querySelector('[data-epub]');
  const original = panel.querySelector('[data-original]');
  const status = panel.querySelector('[data-file-status]');
  const note = panel.querySelector('[data-conversion-note]');
  if (book.skippedPages) {
    note.hidden = false;
    note.textContent = `Some pages had no selectable text (${book.skippedPages}). You can find them in the original PDF.`;
  }

  convert?.addEventListener('click', async () => {
    convert.disabled = true;
    showError(panel, '');
    status.textContent = 'Preparing PDF…';
    try {
      const result = await convertPdf(await getOriginal(book.id), (page, total) => {
        status.textContent = `Converting page ${page} of ${total}…`;
      });
      await saveConversion(book.id, result);
      if (panel.isConnected) {
        await showReader(panel, book.id);
        panel.querySelector('h1').focus();
        panel.querySelector('[data-file-status]').textContent = 'EPUB ready.';
      }
    } catch (error) {
      status.textContent = '';
      showError(panel, error instanceof BookImportError ? error.message : 'Could not convert this PDF.');
    } finally {
      convert.disabled = false;
    }
  });

  async function save(format) {
    if (savingFile) return;
    savingFile = true;
    original.disabled = true;
    if (epub) epub.disabled = true;
    showError(panel, '');
    status.textContent = `Preparing ${format}…`;
    try {
      const file = format === 'EPUB' ? await makeEpub(book) : await getOriginal(book.id);
      const name = format === 'EPUB' ? `${book.title}.epub` : book.originalName;
      const mime = format === 'EPUB' ? 'application/epub+zip' : 'application/pdf';
      const saved = await saveBookFile(file, name, mime);
      status.textContent = saved ? `${format} export requested.` : '';
    } catch {
      status.textContent = '';
      showError(panel, `Could not save the ${format}.`);
    } finally {
      savingFile = false;
      original.disabled = false;
      if (epub) epub.disabled = false;
    }
  }

  epub?.addEventListener('click', () => save('EPUB'));
  original.addEventListener('click', () => save('PDF'));
}

export function renderBooks(view, id, focus) {
  const panel = document.createElement('div');
  view.replaceChildren(panel);
  if (id) showReader(panel, id);
  else showLibrary(panel);
  if (focus) panel.querySelector('h1').focus();
}
