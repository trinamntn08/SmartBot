import { BookImportError, readTextBook } from './text-book.js';
import { addBook, getBook, listBooks, saveBookPosition } from './library-repository.js';

function showError(panel, message) {
  const error = panel.querySelector('[role="alert"]');
  error.textContent = message;
  error.hidden = !message;
}

async function showLibrary(panel) {
  panel.innerHTML = `<header class="page-heading">
      <h1 tabindex="-1">Books</h1>
      <p>Import a book and pick up where you left off, even offline.</p>
    </header>
    <ul class="record-list" role="list" aria-label="Imported books" hidden></ul>
    <form class="panel import-form" aria-labelledby="import-title">
      <h2 id="import-title">Import a book</h2>
      <label>Text file (.txt)
        <input type="file" name="book" accept=".txt,text/plain" required>
      </label>
      <button class="button primary" type="submit">Import book</button>
      <p role="alert" hidden></p>
    </form>
    <p class="library-error" role="alert" hidden></p>`;

  const form = panel.querySelector('form');
  const button = form.querySelector('button');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (button.disabled) return;
    button.disabled = true;
    button.textContent = 'Importing…';
    showError(form, '');
    try {
      const book = await readTextBook(form.elements.book.files[0]);
      const id = await addBook(book);
      if (panel.isConnected) location.hash = `book=${id}`;
    } catch (error) {
      showError(form, error instanceof BookImportError ? error.message : 'Could not import this book.');
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
      const link = document.createElement('a');
      link.className = 'book-link';
      link.href = `#book=${book.id}`;
      link.textContent = book.title;
      const position = document.createElement('span');
      position.textContent = `Section ${book.position + 1} of ${book.count}`;
      link.append(position);
      item.append(link);
      list.append(item);
    }
    list.hidden = books.length === 0;
  } catch {
    const error = panel.querySelector('.library-error');
    error.textContent = 'Could not open your book library.';
    error.hidden = false;
  }
}

async function showReader(panel, id) {
  panel.innerHTML = `<a class="button quiet reader-back" href="#books">Back to books</a>
    <header class="page-heading">
      <h1 tabindex="-1">Book</h1>
    </header>
    <p role="alert" hidden></p>
    <section class="reader" hidden aria-label="Book text">
      <p class="book-position muted" role="status"></p>
      <p class="book-content"></p>
      <div class="actions reader-actions">
        <button class="button" type="button" data-step="-1">Previous section</button>
        <button class="button primary" type="button" data-step="1">Next section</button>
      </div>
    </section>`;

  try {
    const book = await getBook(id);
    if (!book) {
      showError(panel, 'This book is no longer in your library.');
      return;
    }

    const heading = panel.querySelector('h1');
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

    heading.textContent = book.title;
    panel.querySelector('section').hidden = false;
    previous.addEventListener('click', turnSection);
    next.addEventListener('click', turnSection);
    renderSection();
  } catch {
    showError(panel, 'Could not open this book.');
  }
}

export function renderBooks(view, id, focus) {
  const panel = document.createElement('div');
  view.replaceChildren(panel);
  if (id) showReader(panel, id);
  else showLibrary(panel);
  if (focus) panel.querySelector('h1').focus();
}
