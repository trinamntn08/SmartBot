import { BookImportError, readTextBook } from './text-book.js';
import { convertPdf, importPdf } from './pdf-book.js';
import { makeEpub, saveBookFile } from './epub-book.js';
import { addBook, getBook, getOriginal, listBooks, rememberOpenedBook, saveBookPosition, saveConversion } from './library-repository.js';
import { localDay } from './planner.js';

let savingFile = false;

function showError(panel, message) {
  const error = panel.querySelector('[role="alert"]');
  error.textContent = message;
  error.hidden = !message;
}

async function showLibrary(panel) {
  panel.innerHTML = `<a class="back-link" href="#workspace"><span class="arrow" aria-hidden="true"></span>Back to Workspace</a>
    <h1 tabindex="-1">Books</h1>
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
    <p class="book-error" role="alert" hidden></p>
    <section class="card book-reader" hidden aria-label="Book text">
      <p class="book-content"></p>
      <div class="actions book-pagination" hidden>
        <button type="button" class="quiet" data-step="-1">Previous section</button>
        <button type="button" data-step="1">Next section</button>
        <button type="button" data-finish-section hidden></button>
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
    if (panel.isConnected) rememberOpenedBook(id);
    if (!book.count) {
      if (book.originalName) configureConversion(panel, id, activity);
      return;
    }

    const content = panel.querySelector('.book-content');
    const previous = panel.querySelector('[data-step="-1"]');
    const next = panel.querySelector('[data-step="1"]');
    const finish = panel.querySelector('[data-finish-section]');
    const reading = { category: 'reading', id: `book:${id}`, topic: book.title };
    let section = book.position;

    function renderSection() {
      content.textContent = book.sections[section];
      previous.disabled = section === 0;
      previous.hidden = book.count < 2;
      next.disabled = section === book.count - 1;
      next.hidden = section === book.count - 1;
      finish.hidden = section < book.count - 1;
      finish.textContent = book.pageEnds ? 'Mark last page read' : 'Mark last section read';
      finish.disabled = false;
    }

    async function recordSection(index) {
      const pdfPage = book.pageEnds?.[index];
      const progress = book.pageEnds ? (pdfPage ? { pdfPages: [pdfPage] } : null) : { sections: [index] };
      if (progress) return activity.record([{ ...reading, ...progress, date: localDay().date }]);
    }

    async function turnSection(event) {
      const target = section + Number(event.currentTarget.dataset.step);
      if (target < 0 || target >= book.count) return;
      previous.disabled = true;
      next.disabled = true;
      finish.disabled = true;
      showError(panel, '');
      try {
        await saveBookPosition(id, target);
        const completed = section;
        section = target;
        heading.focus();
        if (target > completed) await recordSection(completed).catch(() => {
          showError(panel, 'Your place is saved. The activity report could not be updated.');
        });
      } catch {
        showError(panel, 'Could not save your reading position.');
      } finally {
        renderSection();
      }
    }

    panel.querySelector('section').hidden = false;
    panel.querySelector('.book-pagination').hidden = false;
    previous.addEventListener('click', turnSection);
    next.addEventListener('click', turnSection);
    finish.addEventListener('click', async () => {
      finish.disabled = true;
      try {
        await recordSection(section);
        finish.textContent = book.pageEnds ? 'Last page recorded' : 'Last section recorded';
        heading.focus({ preventScroll: true });
      } catch {
        finish.disabled = false;
        showError(panel, 'Could not update the activity report. Try again.');
      }
    });
    renderSection();
    if (panel.isConnected) activity.foreground(reading, panel);
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
