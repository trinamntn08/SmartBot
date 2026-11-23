import { fetchArticle, fetchFeed, newsPageSize, selectedFeeds, shortlist } from './news-provider.js';
import { isTuoitreStory } from './tuoitre.js';
import { newsLanguages, newsTopics } from './news-preferences.js';
import { newsRepository as store } from './news-repository.js';
import { resumeBookRoute } from './library-repository.js';

const dateFormat = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
const freshFor = 60 * 60 * 1000;
const storyDate = value => dateFormat.format(new Date(value.length === 10 ? value + 'T12:00:00' : value));
const starIcon = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m12 3 2.8 5.9 6.5.9-4.7 4.6 1.1 6.4-5.7-3-5.7 3 1.1-6.4-4.7-4.6 6.5-.9Z"/></svg>';

export function escapeHtml(text) {
  return String(text).replace(/[&<>"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char]);
}

function backLink(route, title) {
  return `<a class="back-link" href="#${route}"><span class="arrow" aria-hidden="true"></span>${title}</a>`;
}

function storyRows(stories, stars, saved = false) {
  return stories.map(story => {
    const original = isTuoitreStory(story.url);
    const href = original && navigator.onLine ? story.url : '#' + (saved ? 'saved-story=' : 'story=') + encodeURIComponent(story.url);
    return `<li><div><a class="news-headline" rel="noreferrer" href="${escapeHtml(href)}" lang="${story.language}">${escapeHtml(story.title)}</a>
      <small>${escapeHtml(story.source)} · ${story.language.toUpperCase()} · ${storyDate(story.date)}${original && saved && navigator.onLine ? ` · <a href="#saved-story=${escapeHtml(encodeURIComponent(story.url))}">Saved summary</a>` : ''}</small></div>
      ${original ? `<button class="news-star" type="button" data-url="${escapeHtml(story.url)}" aria-label="Save for later: ${escapeHtml(story.title)}" aria-pressed="${stars.has(story.url)}">${starIcon}</button>` : ''}
    </li>`;
  }).join('');
}

function listStars(panel, savedNews, stars, findStory, onChange) {
  const pending = new Set();
  panel.addEventListener('click', async event => {
    const button = event.target.closest('button[data-url]');
    if (!button) return;
    const url = button.dataset.url;
    const story = findStory(url);
    if (!story || pending.has(url)) return;
    pending.add(url);
    try {
      if (stars.has(url)) {
        await savedNews.remove(url);
        stars.delete(url);
      } else {
        await savedNews.save(story, null);
        stars.add(url);
      }
      const current = panel.querySelector('button[data-url="' + CSS.escape(url) + '"]');
      current?.setAttribute('aria-pressed', String(stars.has(url)));
      onChange?.(current);
    } catch { panel.querySelector('[role=status]').textContent = 'Could not update saved articles.'; }
    finally { pending.delete(url); }
  });
}

export async function renderSavedNews(view, savedNews, focus) {
  const panel = document.createElement('section');
  view.replaceChildren(panel);
  panel.innerHTML = `${backLink('news', 'News')}<h1 tabindex="-1">Saved</h1><ul class="news-list"></ul><p class="news-info" role="status"></p>`;
  if (focus) panel.querySelector('h1').focus();
  try {
    const records = await savedNews.list();
    records.sort((a, b) => b.savedAt - a.savedAt);
    const stories = new Map(records.map(({ story }) => [story.url, story]));
    const stars = new Set(stories.keys());
    panel.querySelector('ul').innerHTML = storyRows([...stories.values()], stars, true);
    listStars(panel, savedNews, stars, url => stories.get(url), button => {
      button?.closest('li').remove();
      if (!stars.size) panel.querySelector('[role=status]').textContent = 'No saved articles.';
    });
    if (!records.length) panel.querySelector('[role=status]').textContent = 'No saved articles.';
  } catch {
    panel.querySelector('[role=status]').textContent = 'Could not open saved articles.';
  }
}

export function renderNewsSettings(view) {
  const panel = document.createElement('section');
  panel.className = 'card news-settings';
  panel.setAttribute('aria-labelledby', 'news-settings-title');
  function choices(name, options) {
    return options.map(({ id, label }) => `<label><input type="checkbox" name="${name}" value="${id}"><span>${escapeHtml(label)}</span></label>`).join('');
  }
  panel.innerHTML = `<h2 id="news-settings-title">News</h2>
    <fieldset><legend>Languages</legend><div class="news-choices">${choices('languages', newsLanguages)}</div></fieldset>
    <fieldset><legend>Topics</legend><div class="news-choices">${choices('topics', [{ id: '', label: 'All topics' }, ...newsTopics])}</div></fieldset>
    <p class="news-info" role="status"></p>`;
  view.append(panel);
  let preferences = store.preferences();
  const message = panel.querySelector('[role=status]');
  function sync() {
    for (const input of panel.querySelectorAll('input')) {
      const values = preferences[input.name];
      input.checked = input.value ? values.includes(input.value) : values.length === 0;
    }
  }
  sync();
  panel.addEventListener('change', ({ target }) => {
    const { name, value } = target;
    let values = [];
    if (value) values = [...panel.querySelectorAll(`input[name="${name}"]:checked`)].map(input => input.value).filter(Boolean);
    message.textContent = '';
    if (name === 'languages' && !values.length) {
      message.textContent = 'Choose at least one language.';
    } else {
      const next = { ...store.preferences(), [name]: values };
      if (store.savePreferences(next)) preferences = next;
      else message.textContent = 'Could not save news preferences on this device.';
    }
    sync();
  });
}

export async function renderNews(view, savedNews, focus) {
  const panel = document.createElement('section');
  view.replaceChildren(panel);
  panel.innerHTML = `<div class="news-heading"><h1 tabindex="-1">News</h1><div class="news-tools">
    <a class="news-star" href="#saved-news" aria-label="Saved articles">${starIcon}</a>
    <button class="quiet" type="button">Refresh</button></div></div>
    <p class="news-info" role="status"></p><ul class="news-list" aria-label="Headlines"></ul>
    <button class="quiet news-more" type="button" hidden>More</button>
    <a class="book-fallback" href="${resumeBookRoute()}" hidden>Read a book instead</a>`;
  const refreshButton = panel.querySelector('button');
  const status = panel.querySelector('[role=status]');
  const fallback = panel.querySelector('.book-fallback');
  const preferences = store.preferences();
  const editionKey = JSON.stringify(preferences);
  let visible = history.state?.newsEdition === editionKey ? history.state.newsCount : newsPageSize;
  const more = panel.querySelector('.news-more');
  const list = panel.querySelector('ul');
  if (focus) panel.querySelector('h1').focus();
  const stars = new Set(await savedNews.urls().catch(() => []));
  if (!panel.isConnected) return;
  let stories = [];
  let request;

  function draw() {
    stories = shortlist(store.stories(), preferences);
    list.innerHTML = storyRows(stories.slice(0, visible), stars);
    more.hidden = visible >= stories.length;
    return stories.length;
  }
  listStars(panel, savedNews, stars, url => stories.find(story => story.url === url));
  more.onclick = () => {
    const next = stories.slice(visible, visible + newsPageSize);
    list.insertAdjacentHTML('beforeend', storyRows(next, stars));
    list.children[visible]?.querySelector('a').focus({ preventScroll: true });
    visible += newsPageSize;
    history.replaceState({ ...history.state, newsEdition: editionKey, newsCount: visible }, '');
    more.hidden = visible >= stories.length;
  };

  async function load(force = false) {
    request?.abort();
    const controller = new AbortController();
    request = controller;
    const selected = selectedFeeds(preferences);
    const pending = selected.filter(feed => {
      const edition = store.edition(feed);
      return force || edition?.pageSize !== newsPageSize || Date.now() - edition.time >= freshFor;
    });
    draw();
    const time = Date.now();
    let failures = 0;
    refreshButton.disabled = navigator.onLine && pending.length > 0;
    if (refreshButton.disabled) status.textContent = 'Updating…';
    const timeout = setTimeout(() => controller.abort(), 12000);
    if (navigator.onLine) await Promise.all(pending.map(async feed => {
      try {
        const stories = await fetchFeed(feed, controller.signal);
        if (!controller.signal.aborted && !store.saveEdition(feed, { time, stories, pageSize: newsPageSize })) failures++;
      } catch { failures++; }
    }));
    clearTimeout(timeout);
    if (request !== controller || !panel.isConnected) return;
    refreshButton.disabled = false;
    const available = draw();
    const times = selected.map(feed => store.edition(feed)?.time).filter(Boolean);
    const oldest = times.length ? new Date(Math.min(...times)) : null;
    const stamp = oldest ? 'Updated ' + oldest.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Starter edition · Nov 23, 2026';
    const note = !navigator.onLine ? 'Offline' : failures ? 'Some feeds unavailable' : '';
    status.textContent = [note, available ? stamp : 'No matching headlines.'].filter(Boolean).join(' · ');
    fallback.hidden = navigator.onLine && !failures && available > 0;
  }

  refreshButton.onclick = () => load(true);
  load();
}

export async function renderStory(view, savedNews, plans, url, fromSaved, focus) {
  const panel = document.createElement('article');
  view.replaceChildren(panel);
  panel.className = 'news-story';
  const back = fromSaved ? backLink('saved-news', 'Saved') : backLink('news', 'News');
  let saved;
  try { saved = await savedNews.get(url); } catch { /* Reading also works without bookmark storage. */ }
  if (!panel.isConnected) return;
  const cached = store.article(url);
  const story = saved?.story ?? store.stories().find(item => item.url === url)
    ?? cached?.story ?? Object.values(plans).find(plan => plan.news?.story.url === url)?.news.story;
  if (!story) {
    panel.innerHTML = back + '<h1 tabindex="-1">Story unavailable</h1>';
    if (focus) panel.querySelector('h1').focus();
    return;
  }

  panel.innerHTML = `<div class="news-reader-tools">${back}
    <button class="news-star" type="button" aria-label="Save for later" aria-pressed="${!!saved}">${starIcon}</button></div>
    <h1 lang="${story.language}" tabindex="-1">${escapeHtml(story.title)}</h1>
    <p class="news-info"><a rel="noreferrer" href="${escapeHtml(url)}">${escapeHtml(story.source)}</a> · ${storyDate(story.date)}</p>
    <p class="news-info" role="status"></p><div class="news-body" lang="${story.language}"></div>
    <a class="book-fallback" href="${resumeBookRoute()}" hidden>Read a book instead</a>`;
  if (focus) panel.querySelector('h1').focus();
  const status = panel.querySelector('[role=status]');
  const star = panel.querySelector('button');
  let body = saved?.body ?? cached?.body;
  star.onclick = async () => {
    if (star.disabled) return;
    star.disabled = true;
    const wasSaved = star.getAttribute('aria-pressed') === 'true';
    try {
      if (wasSaved) await savedNews.remove(url);
      else await savedNews.save(story, body);
      star.setAttribute('aria-pressed', String(!wasSaved));
    } catch { status.textContent = 'Could not update saved articles.'; }
    finally { star.disabled = false; }
  };
  function showBody() {
    const blocks = body.blocks ?? body.paragraphs.map(text => ({ text }));
    panel.querySelector('.news-body').replaceChildren(...blocks.map(block => {
      const element = document.createElement(block.heading ? 'h2' : 'p');
      element.textContent = block.text;
      return element;
    }));
    panel.querySelector('.news-info a').textContent = body.author || story.source;
  }

  if (body) showBody();
  else store.saveArticle(story, null);
  if (typeof story.summary === 'string') {
    const summary = document.createElement('p');
    summary.textContent = story.summary;
    panel.querySelector('.news-body').replaceChildren(summary);
    panel.querySelector('.news-info a').textContent = 'Full article at ' + story.source;
    if (!navigator.onLine) status.textContent = 'Offline · Cached summary';
    return;
  }
  if (body?.blocks) return;
  if (!navigator.onLine) {
    status.textContent = body ? 'Offline · Cached excerpt' : 'Connect to load the article.';
    panel.querySelector('.book-fallback').hidden = false;
    return;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  status.textContent = 'Loading article…';
  try {
    const fresh = await fetchArticle(url, controller.signal);
    if (!fresh) throw new Error('Article unavailable');
    body = fresh;
    store.saveArticle(story, body);
    showBody();
    status.textContent = '';
    // Complete a save made during loading, even if the reader has since navigated away.
    await savedNews.cacheIfSaved(url, body).catch(() => {
      if (star.getAttribute('aria-pressed') === 'true') status.textContent = 'Could not save the text offline.';
    });
  } catch {
    status.textContent = body ? 'Showing cached excerpt.' : 'Article unavailable. Open the source above.';
    panel.querySelector('.book-fallback').hidden = false;
  } finally {
    clearTimeout(timeout);
  }
}
