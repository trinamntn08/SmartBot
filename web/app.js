import { defaultBudget, ensurePlan, localDay, recentPlans, savePreferences, updateReading } from './planner.js';
import { openRepository } from './repository.js';
import { renderBooks } from './books.js';

const view = document.querySelector('#view');
const nav = document.querySelector('nav');
const errorMessage = document.querySelector('#error');
const dateFormat = new Intl.DateTimeFormat(undefined, {
  weekday: 'long', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
});
const statusLabels = { pending: 'Planned', started: 'In progress', completed: 'Done', skipped: 'Skipped' };
let repository;
let routine;
let displayedDate;
let busy = false;

function escapeHtml(text) {
  const replacements = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
  return text.replace(/[&<>"]/g, (character) => replacements[character]);
}

function formatDate(date) {
  return dateFormat.format(new Date(`${date}T00:00:00Z`));
}

function numberField(label, name, value, min, max, required = true) {
  return `<label>${label}
    <input type="number" name="${name}" inputmode="numeric" value="${value ?? ''}"
      min="${min}" max="${max}" ${required ? 'required' : ''}>
  </label>`;
}

function preferences() {
  const book = routine.book;
  return `<h1 tabindex="-1">${routine.settings ? 'Activities' : 'Set up SmartBot'}</h1>
    <form data-action="preferences" class="card">
      ${numberField('Daily budget (minutes)', 'budget', routine.settings?.budget ?? defaultBudget, 5, 120)}
      ${routine.settings ? '<p>Budget changes apply to future plans.</p>' : ''}
      <label>Book title (optional)
        <input name="title" maxlength="160" value="${escapeHtml(book?.title ?? '')}">
      </label>
      ${book?.page != null ? `<p>Current page ${book.page}</p>` : ''}
      ${numberField(book ? 'Update current page (optional)' : 'Current page (optional)', 'page', null, 0, 100000, false)}
      <button type="submit">${routine.settings ? 'Save changes' : 'Start my routine'}</button>
    </form>`;
}

function today(plan) {
  const reading = plan.reading;
  const book = reading.book ?? routine.book;
  const page = routine.book && book?.id === routine.book.id ? routine.book.page : book?.page;
  const open = reading.status === 'pending' || reading.status === 'started';
  let primaryAction = '';

  if (reading.status === 'pending') {
    primaryAction = book ? '<button data-action="start">Start reading</button>' : '<a class="add-book" href="#activities">Add a book</a>';
  } else if (reading.status === 'started') {
    primaryAction = `<form data-action="finish">
      ${numberField('Minutes read', 'minutes', reading.minutes, 1, 120)}
      ${numberField('Page reached (optional)', 'page', null, 0, 100000, false)}
      <button type="submit">Finish reading</button>
    </form>`;
  }

  return `<h1 tabindex="-1">Today</h1>
    <p><time datetime="${plan.date}">${formatDate(plan.date)}</time></p>
    <p>${reading.status === 'skipped' ? 0 : reading.minutes} min planned · ${plan.budget} min budget</p>
    <section class="card" aria-labelledby="reading-title">
      <h2 id="reading-title">Read a book</h2>
      ${book ? `<p>${escapeHtml(book.title)}</p>` : ''}
      <p><a href="#books">Read an imported book</a></p>
      <p>${statusLabels[reading.status]}${reading.outcome ? ` · ${reading.outcome.minutes} min read` : ''}</p>
      ${open && page != null ? `<p>Current page ${page}</p>` : ''}
      ${reading.outcome?.page != null ? `<p>Reached page ${reading.outcome.page}</p>` : ''}
      ${primaryAction}
      ${open ? `<details>
        <summary>Edit plan</summary>
        <form data-action="estimate">
          ${numberField('Planned minutes', 'minutes', reading.minutes, 1, 120)}
          <div class="actions">
            <button type="submit">Save time</button>
            <button type="button" data-action="skip">Skip today</button>
          </div>
        </form>
      </details>` : '<button data-action="undo">Undo</button>'}
    </section>`;
}

function progress() {
  const plans = recentPlans(routine, displayedDate);
  const completed = plans.filter(({ reading }) => reading.status === 'completed').length;
  return `<h1 tabindex="-1">Progress</h1>
    <p>${completed} reading ${completed === 1 ? 'session' : 'sessions'} in the last 7 days</p>
    <ul class="history" role="list">${plans.map(({ date, reading }) => {
      const { book, outcome } = reading;
      return `<li class="card">
        <time datetime="${date}"><strong>${formatDate(date)}</strong></time>
        <p>${book ? escapeHtml(book.title) : 'Reading'} · ${statusLabels[reading.status]}</p>
        ${outcome ? `<p>${outcome.minutes} min read${outcome.page != null ? ` · Page ${outcome.page}` : ''}</p>` : ''}
      </li>`;
    }).join('')}</ul>`;
}

function render(focusHeading = false) {
  const route = location.hash.slice(1);
  const bookId = Number(/^book=([1-9]\d*)$/.exec(route)?.[1]);
  const isLibrary = route === 'books' || Number.isSafeInteger(bookId);
  const page = isLibrary ? 'books' : ['activities', 'progress'].includes(route) ? route : 'today';
  nav.hidden = false;
  for (const link of nav.querySelectorAll('a')) {
    link.hidden = !routine.settings && ['#activities', '#progress'].includes(link.hash);
    if (link.hash === `#${page}`) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }

  if (isLibrary) {
    renderBooks(view, bookId, focusHeading);
    return;
  }
  if (!routine.settings || page === 'activities') view.innerHTML = preferences();
  else if (page === 'progress') view.innerHTML = progress();
  else view.innerHTML = today(routine.plans[displayedDate]);

  if (focusHeading) view.querySelector('h1').focus();
}

function showError(message) {
  errorMessage.textContent = message;
  errorMessage.hidden = !message;
}

async function refresh(change, { focus = false, openToday = false } = {}) {
  if (busy) return;
  busy = true;
  view.setAttribute('aria-busy', 'true');
  showError('');
  const day = localDay();
  try {
    routine = await repository.update((current) => {
      change?.(current);
      ensurePlan(current, day);
    });
    displayedDate = day.date;
    if (openToday) history.replaceState(null, '', '#today');
    render(focus);
  } catch {
    if (!routine) view.textContent = 'Your routine could not be opened.';
    showError('SmartBot could not access browser storage. Check site storage settings and try again.');
  } finally {
    view.setAttribute('aria-busy', 'false');
    busy = false;
  }
}

view.addEventListener('submit', (event) => {
  const form = event.target;
  const type = form.dataset.action;
  if (!type) return;
  event.preventDefault();
  const page = form.elements.page?.valueAsNumber;
  if (type === 'preferences') {
    const title = form.elements.title.value.trim();
    if (!title && Number.isFinite(page)) {
      form.elements.title.focus();
      showError('Enter a book title to save a page.');
      return;
    }
    refresh((current) => savePreferences(current, {
      budget: form.elements.budget.valueAsNumber,
      title,
      page: Number.isFinite(page) ? page : null,
    }), { focus: true, openToday: true });
    return;
  }

  const action = {
    type,
    minutes: form.elements.minutes.valueAsNumber,
    page: Number.isFinite(page) ? page : null,
  };
  refresh((current) => updateReading(current, displayedDate, action), { focus: true });
});

view.addEventListener('click', (event) => {
  const type = event.target.closest('button[data-action]')?.dataset.action;
  if (type) refresh((current) => updateReading(current, displayedDate, { type }), { focus: true });
});

function refreshOnDateChange() {
  if (routine && localDay().date !== displayedDate) refresh();
}

window.addEventListener('hashchange', () => {
  if (routine) {
    showError('');
    render(true);
    refreshOnDateChange();
  }
});
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) refreshOnDateChange();
});
setInterval(refreshOnDateChange, 30_000);

try {
  repository = await openRepository();
  await refresh();
} catch {
  view.setAttribute('aria-busy', 'false');
  view.textContent = 'SmartBot could not open browser storage.';
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {
    showError('Offline access could not be enabled in this browser.');
  });
}
