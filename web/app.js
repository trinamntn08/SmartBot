import { defaultBudget, ensurePlan, localDay, recentPlans, savePreferences, updateReading } from './planner.js';
import { openRepository } from './repository.js';
import { renderBooks } from './books.js';
import { renderAssistantSettings } from './assistant.js';
import { findSection, renderWorkspace, renderWorkspaceSettings, sectionPreview, workspaceEditRoute } from './workspace.js';
import { escapeHtml, renderNews, renderNewsSettings, renderSavedNews, renderStory } from './news.js';
import { createPodcastPlayer } from './podcast-player.js';
import { renderPodcasts } from './podcasts.js';
import { listeningPage, renderMusic } from './listen.js';
import { createSpotifyPlayer } from './spotify-player.js';
import { trackForegroundActivity } from './activity.js';
import { hasNativePodcastPlayer } from './podcast-native.js';
import { renderToday } from './today.js';
import { renderMarkets } from './markets.js';
import { marketRepository } from './market-repository.js';

const view = document.querySelector('#view');
const nav = document.querySelector('.header-nav');
const navLinks = document.querySelectorAll('.app-header a');
const navOverflow = nav.querySelector('.nav-overflow');
const navToggle = navOverflow.querySelector('summary');
const errorMessage = document.querySelector('#error');
const dateFormat = new Intl.DateTimeFormat(undefined, {
  weekday: 'long', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
});
const statusLabels = { pending: 'Planned', started: 'In progress', completed: 'Done', skipped: 'Skipped' };
let repository;
let podcastPlayer;
let spotifyPlayer;
let routine;
let displayedDate;
let busy = false;
let activitySaveFailed = false;
let loadActivity;
let keepReadingPlanOpen = false;
let stopMarkets;
let stopNews;
let stopPodcasts;

async function recordActivity(entries) {
  if (!entries.length) return;
  await repository.activity.record(entries);
  void loadActivity?.();
}

function recordAutomatically(entries) {
  recordActivity(entries).catch(() => {
    activitySaveFailed = true;
    void loadActivity?.();
  });
}

const track = trackForegroundActivity(recordAutomatically);
const activity = { foreground: track, record: recordActivity };

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

function readingPlan(plan) {
  if (!plan?.reading) return '<p><a href="#activities">Set up a reading plan</a></p>';
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

  return `<div class="today-plan">
      <p class="muted">${reading.status === 'skipped' ? 0 : reading.minutes} min planned · ${plan.budget} min budget</p>
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
    </div>`;
}

function progress() {
  const plans = recentPlans(routine, displayedDate);
  const completed = plans.filter(({ reading }) => reading?.status === 'completed').length;
  const articles = plans.reduce((count, plan) => count + Object.keys(plan.readStories ?? {}).length, 0);
  return `<h1 tabindex="-1">Progress</h1>
    <p>${completed} reading ${completed === 1 ? 'session' : 'sessions'}${articles ? ' · ' + articles + (articles === 1 ? ' article' : ' articles') : ''} in the last 7 days</p>
    <ul class="history" role="list">${plans.map(({ date, reading, news, readStories }) => {
      const { book, outcome } = reading ?? {};
      return `<li class="card">
        <time datetime="${date}"><strong>${formatDate(date)}</strong></time>
        ${news ? `<p>${escapeHtml(news.story.title)} · ${statusLabels[news.status]}</p>` : ''}
        ${Object.entries(readStories ?? {}).filter(([url]) => url !== news?.story.url)
          .map(([, title]) => `<p>${escapeHtml(title)} · Read</p>`).join('')}
        ${reading ? `<p>${book ? escapeHtml(book.title) : 'Reading'} · ${statusLabels[reading.status]}</p>` : ''}
        ${outcome ? `<p>${outcome.minutes} min read${outcome.page != null ? ` · Page ${outcome.page}` : ''}</p>` : ''}
      </li>`;
    }).join('')}</ul>`;
}

function render(focusHeading = false) {
  loadActivity = undefined;
  stopMarkets?.();
  stopMarkets = undefined;
  stopNews?.();
  stopNews = undefined;
  stopPodcasts?.();
  stopPodcasts = undefined;
  track();
  if (focusHeading) window.scrollTo(0, 0);
  const route = location.hash.slice(1);
  const bookId = Number(/^book=([1-9]\d*)$/.exec(route)?.[1]);
  const isLibrary = route === 'books' || Number.isSafeInteger(bookId);
  const isStory = route.startsWith('story=') || route.startsWith('saved-story=');
  const section = findSection(isStory || route === 'saved-news' ? 'news' : route);
  const listenPage = listeningPage(route);
  const appPage = ['today', 'activities', 'progress', 'settings'].includes(route);
  const page = isLibrary ? 'books' : listenPage ?? section?.id ?? (appPage ? route : 'workspace');
  view.dataset.page = page;
  podcastPlayer.setExpanded(page === 'podcasts');
  spotifyPlayer.setExpanded(page === 'tracks');
  marketRepository.setOpen(page === 'markets');
  document.body.classList.toggle('reading-book', Number.isSafeInteger(bookId));
  nav.hidden = false;
  for (const link of navLinks) {
    link.hidden = !routine.settings && (link.hash === '#activities' || (link.hash === '#progress' && !Object.keys(routine.plans).length));
    if (link.hash === `#${page}` || (listenPage && link.hash === '#listen')) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }

  if (isLibrary) {
    renderBooks(view, bookId, focusHeading, activity);
    return;
  }
  if (isStory) {
    let url;
    try { url = decodeURIComponent(route.slice(route.indexOf('=') + 1)); } catch { url = ''; }
    renderStory(view, repository.savedNews, routine.plans, url, route.startsWith('saved-story='), focusHeading, track);
    return;
  }
  if (route === 'saved-news') {
    renderSavedNews(view, repository.savedNews, focusHeading, track);
    return;
  }
  if (page === 'news') {
    stopNews = renderNews(view, repository.savedNews, focusHeading, track);
    return;
  }
  if (page === 'podcasts') {
    stopPodcasts = renderPodcasts(view, repository.podcasts, podcastPlayer, focusHeading);
    return;
  }
  if (page === 'tracks') {
    renderMusic(view, spotifyPlayer, podcastPlayer.pause, focusHeading);
    return;
  }
  if (page === 'markets') {
    stopMarkets = renderMarkets(view, focusHeading);
    return;
  }
  if (page === 'workspace') {
    renderWorkspace(view, focusHeading, route === workspaceEditRoute);
    return;
  }
  if (section) view.innerHTML = sectionPreview(section);
  else if (page === 'settings') {
    view.innerHTML = '<h1 tabindex="-1">Settings</h1>';
    window.smartBotAppearance?.renderSettings(view);
    renderWorkspaceSettings(view);
    renderNewsSettings(view);
    renderAssistantSettings(view);
  }
  else if (page === 'activities') view.innerHTML = preferences();
  else if (page === 'progress') view.innerHTML = progress();
  else {
    const plan = routine.plans[displayedDate];
    loadActivity = renderToday(view, {
      date: displayedDate, dateLabel: formatDate(displayedDate), plan,
      routineMarkup: readingPlan(plan), planOpen: keepReadingPlanOpen,
      repository: repository.activity, trackingError: () => activitySaveFailed,
    });
    keepReadingPlanOpen = false;
  }

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
      change?.(current, day);
      ensurePlan(current, day);
    });
    displayedDate = day.date;
    if (openToday) {
      history.replaceState(null, '', '#today');
      keepReadingPlanOpen = true;
    }
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
  keepReadingPlanOpen = true;
  refresh((current) => updateReading(current, displayedDate, action), { focus: true });
});

view.addEventListener('click', (event) => {
  const type = event.target.closest('button[data-action]')?.dataset.action;
  if (type) {
    keepReadingPlanOpen = true;
    refresh((current) => updateReading(current, displayedDate, { type }), { focus: true });
  }
});

function refreshOnDateChange() {
  if (routine && localDay().date !== displayedDate) refresh();
}

navOverflow.addEventListener('click', (event) => {
  if (event.target.closest('a')) {
    navOverflow.open = false;
    navToggle.focus();
  }
});
navOverflow.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && navOverflow.open) {
    event.preventDefault();
    navOverflow.open = false;
    navToggle.focus();
  }
});
navOverflow.addEventListener('focusout', (event) => {
  if (event.relatedTarget && !navOverflow.contains(event.relatedTarget)) navOverflow.open = false;
});
document.addEventListener('click', (event) => {
  if (navOverflow.open && !navOverflow.contains(event.target)) navOverflow.open = false;
});

window.addEventListener('hashchange', () => {
  navOverflow.open = false;
  if (routine) {
    showError('');
    render(true);
    refreshOnDateChange();
  }
});
function refreshNewsConnection() {
  if (routine && view.dataset.page === 'news') render();
}
window.addEventListener('online', refreshNewsConnection);
window.addEventListener('offline', refreshNewsConnection);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    refreshOnDateChange();
    void loadActivity?.();
  }
});
setInterval(refreshOnDateChange, 30_000);
if (hasNativePodcastPlayer) setInterval(() => { if (!document.hidden) void loadActivity?.(); }, 5000);

try {
  repository = await openRepository();
  spotifyPlayer = createSpotifyPlayer(document.querySelector('#spotify-player'), view, () => podcastPlayer.pause());
  podcastPlayer = createPodcastPlayer(repository.podcasts, document.querySelector('#podcast-player'),
    recordAutomatically, spotifyPlayer.close);
  if (!location.hash && marketRepository.wasOpen() && marketRepository.lastChart()?.symbol) {
    history.replaceState(null, '', '#markets');
  }
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
