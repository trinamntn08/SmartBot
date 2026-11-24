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
    <form>
      <label>Choose a PDF or text file <input type="file" name="book" accept=".pdf,application/pdf,.txt,text/plain" required></label>
      <p>On Android, choose Google Drive from the file picker. In a browser, you can also import a file downloaded from Drive.</p>
      <button type="submit">Import book</button>
    </form>
    <p role="alert" hidden></p>
    <ul class="history" role="list" aria-label="Imported books"></ul>`;

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
    for (const book of books) {
      const item = document.createElement('li');
      item.className = 'card';
      const link = document.createElement('a');
      link.href = `#book=${book.id}`;
      link.textContent = book.title;
      item.append(link);
      list.append(item);
    }
  } catch {
    showError(panel, 'Could not open your book library.');
  }
}

async function showReader(panel, id) {
  panel.innerHTML = `<h1 tabindex="-1">Book</h1>
    <p><a href="#books">Back to books</a></p>
    <p role="alert" hidden></p>
    <div class="actions" role="group" aria-label="Book files" hidden>
      <button type="button" data-convert>Convert to EPUB</button>
      <button type="button" data-epub>Save EPUB</button>
      <button type="button" data-original>Save original PDF</button>
    </div>
    <p data-file-status role="status"></p>
    <p data-conversion-note hidden></p>
    <section hidden aria-label="Book text">
      <p class="book-position" role="status"></p>
      <p class="book-content"></p>
      <div class="actions">
        <button type="button" data-step="-1">Previous section</button>
        <button type="button" data-step="1">Next section</button>
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
    const content = panel.querySelector('.book-content');
    const previous = panel.querySelector('[data-step="-1"]');
    const next = panel.querySelector('[data-step="1"]');
    let section = book.position;

    function renderSection() {
      content.textContent = book.sections[section];
      position.textContent = `Section ${section + 1} of ${book.count}`;
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
  const convert = panel.querySelector('[data-convert]');
  const epub = panel.querySelector('[data-epub]');
  const original = panel.querySelector('[data-original]');
  const status = panel.querySelector('[data-file-status]');
  const note = panel.querySelector('[data-conversion-note]');
  convert.parentElement.hidden = false;
  convert.hidden = book.count > 0;
  epub.hidden = book.count === 0;
  if (book.skippedPages) {
    note.hidden = false;
    note.textContent = `Some pages had no selectable text (${book.skippedPages}). You can find them in the original PDF.`;
  }

  convert.addEventListener('click', async () => {
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
        panel.querySelector('[data-file-status]').textContent = 'Ready to read or save as EPUB.';
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
    epub.disabled = true;
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
      epub.disabled = false;
    }
  }

  epub.addEventListener('click', () => save('EPUB'));
  original.addEventListener('click', () => save('PDF'));
}

export function renderBooks(view, id, focus) {
  const panel = document.createElement('div');
  view.replaceChildren(panel);
  if (id) showReader(panel, id);
  else showLibrary(panel);
  if (focus) panel.querySelector('h1').focus();
}
