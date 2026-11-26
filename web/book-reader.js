import { loadReaderPreferences, saveReaderPreferences, saveBookPosition } from './library-repository.js';
import { localDay } from './planner.js';

const textSizes = [85, 100, 115, 130, 150, 175, 200];

function configureAppearance(panel, scroll, content, toggleSettings) {
  const saved = loadReaderPreferences();
  const smaller = panel.querySelector('[data-size="-1"]');
  const larger = panel.querySelector('[data-size="1"]');
  const size = panel.querySelector('#reader-size');
  const font = panel.querySelector('#reader-font');
  const spacing = panel.querySelector('#reader-spacing');
  const colors = [...panel.querySelectorAll('input[name="reader-color"]')];
  let sizeIndex = textSizes.indexOf(saved.size);
  if (sizeIndex === -1) sizeIndex = 1;
  if ([...font.options].some(option => option.value === saved.font)) font.value = saved.font;
  if ([...spacing.options].some(option => option.value === saved.spacing)) spacing.value = saved.spacing;
  const savedColor = colors.find(color => color.value === saved.color);
  if (savedColor) savedColor.checked = true;

  function apply() {
    const percent = textSizes[sizeIndex];
    const color = colors.find(option => option.checked).value;
    panel.dataset.readerFont = font.value;
    panel.dataset.readerColor = color;
    panel.style.setProperty('--reader-size', percent / 100);
    panel.style.setProperty('--reader-leading', spacing.value);
    size.value = `${percent}%`;
    smaller.disabled = sizeIndex === 0;
    larger.disabled = sizeIndex === textSizes.length - 1;
    return { size: percent, font: font.value, spacing: spacing.value, color };
  }

  function update() {
    // Preserve the relative place in the passage when text wraps differently.
    const oldHeight = content.offsetHeight;
    const top = scroll.scrollTop;
    const preferences = apply();
    if (oldHeight && top) scroll.scrollTop = top * content.offsetHeight / oldHeight;
    saveReaderPreferences(preferences);
  }

  for (const button of [smaller, larger]) {
    button.addEventListener('click', () => {
      sizeIndex += Number(button.dataset.size);
      update();
    });
  }
  for (const field of [font, spacing, ...colors]) field.addEventListener('change', update);
  panel.querySelector('[data-close-settings]').addEventListener('click', () => toggleSettings(false, true));
  apply();
}

export function renderReader(panel, book, activity, focus) {
  panel.className = 'book-reader';
  panel.innerHTML = `
    <header class="book-toolbar">
      <div class="book-toolbar-row">
        <a href="#books" class="book-tool" aria-label="Back to books">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12H4m7-7-7 7 7 7"/></svg>
          <span>Books</span>
        </a>
        <h1 tabindex="-1"></h1>
        <div class="book-tool-group">
          <button type="button" class="book-tool" data-settings aria-label="Reading settings"
            aria-expanded="false" aria-controls="reader-settings">Aa</button>
          <button type="button" class="book-tool" data-focus aria-label="Enter full view" title="Enter full view">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4H4v5m11-5h5v5M4 15v5h5m11-5v5h-5"/></svg>
          </button>
        </div>
      </div>
      <section class="book-settings" id="reader-settings" aria-labelledby="reader-settings-title" hidden>
        <header>
          <h2 id="reader-settings-title" tabindex="-1">Reading settings</h2>
          <button type="button" class="book-tool" data-close-settings aria-label="Close reading settings">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>
          </button>
        </header>
        <div class="book-size" role="group" aria-label="Text size">
          <span aria-hidden="true">Text size</span>
          <div class="book-stepper">
            <button type="button" class="book-tool" data-size="-1" aria-label="Decrease text size">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h12"/></svg>
            </button>
            <output id="reader-size" aria-label="Current text size"></output>
            <button type="button" class="book-tool" data-size="1" aria-label="Increase text size">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h12m-6-6v12"/></svg>
            </button>
          </div>
        </div>
        <div class="book-type">
          <label for="reader-font">Typeface
            <select id="reader-font">
              <option value="serif">Serif</option>
              <option value="sans">Sans serif</option>
            </select>
          </label>
          <label for="reader-spacing">Line spacing
            <select id="reader-spacing">
              <option value="1.45">Compact</option>
              <option value="1.7" selected>Standard</option>
              <option value="2">Open</option>
            </select>
          </label>
        </div>
        <fieldset class="book-colors">
          <legend>Page color</legend>
          <div>
            <label><input name="reader-color" type="radio" value="app" checked><span>App</span></label>
            <label><input name="reader-color" type="radio" value="light"><span>Light</span></label>
            <label><input name="reader-color" type="radio" value="sepia"><span>Sepia</span></label>
            <label><input name="reader-color" type="radio" value="dark"><span>Dark</span></label>
          </div>
        </fieldset>
      </section>
    </header>
    <section class="book-scroll" tabindex="0" aria-label="Book text">
      <div class="book-page">
        <p class="book-content"></p>
        <div class="book-pagination">
          <button type="button" class="book-tool" data-step="-1">Previous section</button>
          <button type="button" class="book-tool" data-step="1">Next section</button>
          <button type="button" class="book-tool" data-finish-section hidden></button>
        </div>
        <p class="book-error" role="alert" hidden></p>
      </div>
    </section>
    <footer class="book-footer">
      <div class="book-progress-track" aria-hidden="true"><span></span></div>
      <div class="book-footer-row">
        <span class="book-location" role="status"></span>
        <button type="button" class="book-tool" data-show-controls hidden>Show controls</button>
      </div>
    </footer>`;

  const toolbar = panel.querySelector('.book-toolbar');
  const heading = toolbar.querySelector('h1');
  const settings = panel.querySelector('#reader-settings');
  const settingsButton = panel.querySelector('[data-settings]');
  const focusButton = panel.querySelector('[data-focus]');
  const showControls = panel.querySelector('[data-show-controls]');
  const scroll = panel.querySelector('.book-scroll');
  const content = panel.querySelector('.book-content');
  const location = panel.querySelector('.book-location');
  const progress = panel.querySelector('.book-progress-track span');
  const error = panel.querySelector('.book-error');
  const previous = panel.querySelector('[data-step="-1"]');
  const next = panel.querySelector('[data-step="1"]');
  const finish = panel.querySelector('[data-finish-section]');
  const reading = { category: 'reading', id: `book:${book.id}`, topic: book.title };
  let section = book.position;
  let savingProgress = false;

  heading.textContent = book.title;
  scroll.setAttribute('aria-label', `Book text: ${book.title}`);

  function toggleSettings(open, restoreFocus = false) {
    settings.hidden = !open;
    settingsButton.setAttribute('aria-expanded', String(open));
    if (open) settings.querySelector('h2').focus();
    else if (restoreFocus) settingsButton.focus();
  }

  function setFullView(full, moveFocus) {
    toggleSettings(false);
    toolbar.hidden = full;
    showControls.hidden = !full;
    if (moveFocus) (full ? scroll : focusButton).focus({ preventScroll: true });
  }

  settingsButton.addEventListener('click', () => toggleSettings(settings.hidden, true));
  focusButton.addEventListener('click', () => setFullView(true, true));
  showControls.addEventListener('click', () => setFullView(false, true));
  panel.addEventListener('click', (event) => {
    if (!settings.hidden) {
      if (!settings.contains(event.target) && !settingsButton.contains(event.target)) toggleSettings(false);
      return;
    }
    if (event.target === content && document.getSelection()?.isCollapsed) {
      setFullView(!toolbar.hidden, toolbar.contains(document.activeElement));
    }
  });
  panel.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (!settings.hidden) toggleSettings(false, true);
    else if (toolbar.hidden) setFullView(false, true);
  });
  configureAppearance(panel, scroll, content, toggleSettings);

  function showError(message) {
    error.textContent = message;
    error.hidden = !message;
  }

  function renderSection() {
    content.textContent = book.sections[section];
    location.textContent = `Section ${section + 1} of ${book.count}`;
    progress.style.inlineSize = `${100 * (section + 1) / book.count}%`;
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
    if (progress) await activity.record([{ ...reading, ...progress, date: localDay().date }]);
  }

  async function turnSection(event) {
    const target = section + Number(event.currentTarget.dataset.step);
    if (savingProgress || target < 0 || target >= book.count) return;
    savingProgress = true;
    showError('');
    try {
      await saveBookPosition(book.id, target);
      const completed = section;
      section = target;
      renderSection();
      scroll.scrollTop = 0;
      if (panel.isConnected) scroll.focus({ preventScroll: true });
      if (target > completed) await recordSection(completed).catch(() => {
        showError('Your place is saved. The activity report could not be updated.');
      });
    } catch {
      showError('Could not save your reading position.');
    } finally {
      savingProgress = false;
    }
  }

  previous.addEventListener('click', turnSection);
  next.addEventListener('click', turnSection);
  finish.addEventListener('click', async () => {
    if (savingProgress) return;
    savingProgress = true;
    finish.disabled = true;
    showError('');
    try {
      await recordSection(section);
      finish.textContent = book.pageEnds ? 'Last page recorded' : 'Last section recorded';
      if (panel.isConnected) scroll.focus({ preventScroll: true });
    } catch {
      finish.disabled = false;
      showError('Could not update the activity report. Try again.');
    } finally {
      savingProgress = false;
    }
  });
  renderSection();
  if (focus) heading.focus({ preventScroll: true });
  activity.foreground(reading, panel);
}
