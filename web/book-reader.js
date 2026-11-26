import { loadReaderPreferences, saveReaderPreferences, saveBookPosition } from './library-repository.js';
import { localDay } from './planner.js';
import { pageStarts } from './book-pagination.js';

const textSizes = [85, 100, 115, 130, 150, 175, 200];

function configureAppearance(panel, toggleSettings, reflow) {
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
    saveReaderPreferences(apply());
    reflow();
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

export function renderReader(panel, book, activity, { title, options, focus }) {
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
    <section class="book-page" tabindex="0" aria-label="Book text">
      <div class="book-page-frame">
        <p class="book-content"></p>
        <div class="book-measure-frame" aria-hidden="true"><p class="book-measure"></p></div>
      </div>
    </section>
    <footer class="book-footer">
      <p class="book-error" role="alert" hidden></p>
      <div class="book-progress-track" aria-hidden="true"><span></span></div>
      <div class="book-footer-row">
        <button type="button" class="book-tool" data-step="-1" aria-label="Previous page">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 6-6 6 6 6"/></svg>Previous
        </button>
        <div class="book-footer-center">
          <div class="book-location" role="status" aria-atomic="true">
            <span data-current-section></span>
            <span data-current-page></span>
          </div>
          <button type="button" class="book-tool" data-show-controls hidden>Show controls</button>
        </div>
        <button type="button" class="book-tool" data-step="1" aria-label="Next page">
          Next<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m10 6 6 6-6 6"/></svg>
        </button>
        <button type="button" class="book-tool" data-finish-section hidden>Mark read</button>
      </div>
    </footer>`;

  const toolbar = panel.querySelector('.book-toolbar');
  const heading = toolbar.querySelector('h1');
  const settings = panel.querySelector('#reader-settings');
  const settingsButton = panel.querySelector('[data-settings]');
  const focusButton = panel.querySelector('[data-focus]');
  const showControls = panel.querySelector('[data-show-controls]');
  const page = panel.querySelector('.book-page');
  const frame = panel.querySelector('.book-page-frame');
  const content = panel.querySelector('.book-content');
  const measure = panel.querySelector('.book-measure');
  const sectionLabel = panel.querySelector('[data-current-section]');
  const pageLabel = panel.querySelector('[data-current-page]');
  const progress = panel.querySelector('.book-progress-track span');
  const error = panel.querySelector('.book-error');
  const previous = panel.querySelector('[data-step="-1"]');
  const next = panel.querySelector('[data-step="1"]');
  const finish = panel.querySelector('[data-finish-section]');
  const reading = { category: 'reading', id: `book:${book.id}`, topic: book.title };
  let section = book.position;
  let offset = book.offset ?? 0;
  let starts;
  let pageIndex;
  let finished = false;
  let savingProgress = false;

  heading.textContent = title;
  page.setAttribute('aria-label', `Book text: ${title}`);
  toolbar.querySelector('.book-tool-group').append(options);

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
    if (moveFocus) (full ? page : focusButton).focus({ preventScroll: true });
  }

  settingsButton.addEventListener('click', () => toggleSettings(settings.hidden, true));
  focusButton.addEventListener('click', () => setFullView(true, true));
  showControls.addEventListener('click', () => setFullView(false, true));
  panel.addEventListener('click', (event) => {
    if (!settings.hidden) {
      if (!settings.contains(event.target) && !settingsButton.contains(event.target)) toggleSettings(false);
      return;
    }
    if (!options.open && page.contains(event.target) && document.getSelection()?.isCollapsed) {
      setFullView(!toolbar.hidden, toolbar.contains(document.activeElement));
    }
  });
  panel.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (!settings.hidden) toggleSettings(false, true);
    else if (toolbar.hidden) setFullView(false, true);
  });

  function showError(message) {
    error.textContent = message;
    error.hidden = !message;
  }

  function paginate(index) {
    const lineHeight = parseFloat(getComputedStyle(measure).lineHeight);
    const height = Math.max(frame.getBoundingClientRect().height, lineHeight);
    const result = pageStarts(book.sections[index], (text) => {
      measure.textContent = text;
      return measure.getBoundingClientRect().height <= height;
    });
    measure.textContent = '';
    return result;
  }

  function renderPage() {
    const text = book.sections[section];
    const following = starts.findIndex(start => start > offset);
    pageIndex = (following < 0 ? starts.length : following) - 1;
    const end = starts[pageIndex + 1] ?? text.length;
    const visibleText = text.slice(starts[pageIndex], end);
    if (content.textContent !== visibleText) content.textContent = visibleText;
    frame.scrollTop = 0;
    sectionLabel.textContent = `Section ${section + 1} of ${book.count}`;
    pageLabel.hidden = starts.length === 1;
    pageLabel.textContent = `Page ${pageIndex + 1} of ${starts.length}`;
    progress.style.inlineSize = `${100 * (section + (text ? end / text.length : 1)) / book.count}%`;
    previous.disabled = section === 0 && pageIndex === 0;
    const atEnd = section === book.count - 1 && pageIndex === starts.length - 1;
    next.hidden = atEnd;
    finish.hidden = !atEnd;
    finish.textContent = finished ? 'Recorded' : 'Mark read';
    finish.disabled = finished;
  }

  function reflow() {
    starts = paginate(section);
    renderPage();
  }

  function applyLayout() {
    reflow();
    if (document.fonts.status === 'loading') {
      document.fonts.ready.then(() => {
        if (panel.isConnected) reflow();
      });
    }
  }

  async function recordSection(index) {
    const pdfPage = book.pageEnds?.[index];
    const progress = book.pageEnds ? (pdfPage ? { pdfPages: [pdfPage] } : null) : { sections: [index] };
    if (progress) await activity.record([{ ...reading, ...progress, date: localDay().date }]);
  }

  async function turnPage(event) {
    if (savingProgress) return;
    const button = event.currentTarget;
    const step = Number(button.dataset.step);
    let targetPage = pageIndex + step;
    let targetSection = section;
    let targetStarts = starts;
    if (targetPage < 0 || targetPage >= starts.length) {
      targetSection += step;
      if (targetSection < 0 || targetSection >= book.count) return;
      targetStarts = paginate(targetSection);
      targetPage = step < 0 ? targetStarts.length - 1 : 0;
    }
    const oldStarts = starts;
    const targetOffset = targetStarts[targetPage];
    savingProgress = true;
    showError('');
    try {
      await saveBookPosition(book.id, targetSection, targetOffset);
      const completed = section;
      section = targetSection;
      offset = targetOffset;
      if (panel.isConnected) {
        starts = starts === oldStarts ? targetStarts : paginate(section);
        renderPage();
        if (button.hidden || button.disabled) page.focus({ preventScroll: true });
      }
      if (targetSection > completed) await recordSection(completed).catch(() => {
        showError('Your place is saved. The activity report could not be updated.');
      });
    } catch {
      showError('Could not save your reading position.');
    } finally {
      savingProgress = false;
    }
  }

  previous.addEventListener('click', turnPage);
  next.addEventListener('click', turnPage);
  finish.addEventListener('click', async () => {
    if (savingProgress) return;
    savingProgress = true;
    finish.disabled = true;
    showError('');
    try {
      await recordSection(section);
      finished = true;
      finish.textContent = 'Recorded';
      if (panel.isConnected) page.focus({ preventScroll: true });
    } catch {
      finish.disabled = false;
      showError('Could not update the activity report. Try again.');
    } finally {
      savingProgress = false;
    }
  });
  configureAppearance(panel, toggleSettings, applyLayout);
  applyLayout();
  const viewport = new ResizeObserver(() => {
    if (panel.isConnected) reflow();
    else viewport.disconnect();
  });
  viewport.observe(frame);
  if (focus) heading.focus({ preventScroll: true });
  activity.foreground(reading, panel);
}
