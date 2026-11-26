import { fetchArticle, fetchFeed, newsAffinity, newsPageSize, selectedFeeds, shortlist } from './news-provider.js';
import { isCurrentPublisherLink } from './news-rss.js';
import { isTuoitreStory } from './tuoitre.js';
import { newsLanguages, newsTopics } from './news-preferences.js';
import { newsRepository as store } from './news-repository.js';

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
    const tuoitre = isTuoitreStory(story.url);
    const original = story.linkKind ? isCurrentPublisherLink(story.url) : tuoitre;
    const savedLabel = story.linkKind ? 'Saved headline' : 'Saved summary';
    const href = original && navigator.onLine ? story.url : '#' + (saved ? 'saved-story=' : 'story=') + encodeURIComponent(story.url);
    return `<li><div><a class="news-headline" rel="noreferrer" href="${escapeHtml(href)}" lang="${story.language}"${original && navigator.onLine ? ` data-publisher-story="${escapeHtml(story.url)}"` : ''}>${escapeHtml(story.title)}</a>
      <small>${escapeHtml(story.source)} · ${story.language.toUpperCase()} · ${storyDate(story.date)}${original && saved && navigator.onLine ? ` · <a href="#saved-story=${escapeHtml(encodeURIComponent(story.url))}">${savedLabel}</a>` : ''}</small></div>
      ${(story.linkKind || tuoitre) ? `<button class="news-star" type="button" data-url="${escapeHtml(story.url)}" aria-label="Save for later: ${escapeHtml(story.title)}" aria-pressed="${stars.has(story.url)}">${starIcon}</button>` : ''}
    </li>`;
  }).join('');
}

function trackPublisherOpens(panel, findStory) {
  function track(event) {
    if (event.defaultPrevented || (event.type === 'auxclick' && event.button !== 1)) return;
    const link = event.target.closest('a[data-publisher-story]');
    const story = link && findStory(link.dataset.publisherStory);
    if (story) store.recordOpen(story);
  }
  panel.addEventListener('click', track);
  panel.addEventListener('auxclick', track);
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

export async function renderSavedNews(view, savedNews, focus, track) {
  const panel = document.createElement('section');
  view.replaceChildren(panel);
  panel.innerHTML = `${backLink('news', 'News')}<h1 tabindex="-1">Saved</h1><ul class="news-list"></ul><p class="news-info" role="status"></p>`;
  if (focus) panel.querySelector('h1').focus();
  track({ category: 'news', id: 'news:saved', topic: 'Saved articles' }, panel);
  try {
    const records = await savedNews.list();
    records.sort((a, b) => b.savedAt - a.savedAt);
    const stories = new Map(records.map(({ story }) => [story.url, story]));
    const stars = new Set(stories.keys());
    panel.querySelector('ul').innerHTML = storyRows([...stories.values()], stars, true);
    trackPublisherOpens(panel, url => stories.get(url));
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
    <fieldset><legend>Recommendations</legend>
      <div class="news-setting-choice"><label><input type="checkbox" data-personalize aria-describedby="news-personalization-note"><span>Personalize headlines</span></label></div>
      <p class="news-info news-personalization-note" id="news-personalization-note">Use articles you open to rank headlines. Your reading activity stays on this device.</p>
      <button type="button" class="quiet" data-reset-opens>Reset recommendations</button>
      <p class="news-info" role="status" data-recommendation-status></p>
    </fieldset>
    <fieldset><legend>Topics</legend><div class="news-choices">${choices('topics', [{ id: '', label: 'All topics' }, ...newsTopics])}</div></fieldset>
    <p class="news-info" role="status"></p>`;
  view.append(panel);
  let preferences = store.preferences();
  const message = panel.querySelector(':scope > [role=status]');
  const recommendationMessage = panel.querySelector('[data-recommendation-status]');
  const personalize = panel.querySelector('[data-personalize]');
  personalize.checked = store.personalized();
  panel.querySelector('[data-reset-opens]').onclick = () => {
    recommendationMessage.textContent = store.resetOpens() ? 'Recommendations reset.' : 'Could not reset recommendations.';
  };
  function sync() {
    for (const input of panel.querySelectorAll('input[name]')) {
      const values = preferences[input.name];
      input.checked = input.value ? values.includes(input.value) : values.length === 0;
    }
  }
  sync();
  panel.addEventListener('change', ({ target }) => {
    if (target === personalize) {
      recommendationMessage.textContent = '';
      if (!store.setPersonalized(target.checked)) {
        target.checked = store.personalized();
        recommendationMessage.textContent = 'Could not save the personalization setting.';
      }
      return;
    }
    message.textContent = '';
    const { name, value } = target;
    let values = [];
    if (value) values = [...panel.querySelectorAll(`input[name="${name}"]:checked`)].map(input => input.value).filter(Boolean);
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

export function renderNews(view, savedNews, focus, track) {
  const panel = document.createElement('section');
  view.replaceChildren(panel);
  panel.innerHTML = `<div class="news-heading"><h1 tabindex="-1">News</h1><div class="news-tools">
    <a class="news-star" href="#saved-news" aria-label="Saved articles">${starIcon}</a>
    <button class="quiet" type="button">Refresh</button></div></div>
    <p class="news-info" role="status"></p><ul class="news-list" aria-label="Headlines"></ul>
    <div data-news-end aria-hidden="true" hidden></div>`;
  const refreshButton = panel.querySelector('button');
  const status = panel.querySelector('[role=status]');
  const preferences = store.preferences();
  const personalized = store.personalized();
  const editionKey = JSON.stringify({ ...preferences, personalized });
  let visible = history.state?.newsEdition === editionKey ? history.state.newsCount : newsPageSize;
  const end = panel.querySelector('[data-news-end]');
  const list = panel.querySelector('ul');
  if (focus) panel.querySelector('h1').focus();
  track({ category: 'news', id: 'news:headlines', topic: 'Headlines' }, panel);
  const stars = new Set();
  let stories = [];
  let affinity;
  let request;

  function draw() {
    stories = shortlist(store.stories(), preferences, affinity);
    list.innerHTML = storyRows(stories.slice(0, visible), stars);
    watchEnd();
    return stories.length;
  }
  listStars(panel, savedNews, stars, url => stories.find(story => story.url === url));
  trackPublisherOpens(panel, url => stories.find(story => story.url === url));
  const observer = new IntersectionObserver(entries => {
    if (!panel.isConnected || end.hidden || !entries.some(entry => entry.isIntersecting)) return;
    const next = stories.slice(visible, visible + newsPageSize);
    list.insertAdjacentHTML('beforeend', storyRows(next, stars));
    visible += newsPageSize;
    history.replaceState({ ...history.state, newsEdition: editionKey, newsCount: visible }, '');
    // Recheck after appending in case the viewport still reaches the end.
    watchEnd();
  });

  function watchEnd() {
    end.hidden = visible >= stories.length;
    observer.unobserve(end);
    if (!end.hidden) observer.observe(end);
  }

  async function load(force = false) {
    request?.abort();
    const controller = new AbortController();
    request = controller;
    affinity = personalized ? newsAffinity(store.opens()) : undefined;
    const selected = selectedFeeds(preferences, affinity);
    const pending = selected.filter(feed => {
      const edition = store.edition(feed);
      return force || edition?.pageSize !== newsPageSize || Date.now() - edition.time >= freshFor;
    });
    draw();
    const time = Date.now();
    refreshButton.disabled = navigator.onLine && pending.length > 0;
    if (refreshButton.disabled) {
      status.textContent = 'Updating…';
      const timeout = setTimeout(() => controller.abort(), 12000);
      await Promise.all(pending.map(async feed => {
        try {
          const stories = await fetchFeed(feed, controller.signal);
          if (!controller.signal.aborted) store.saveEdition(feed, { time, stories, pageSize: newsPageSize });
        } catch { /* Keep the cached edition for this feed. */ }
      }));
      clearTimeout(timeout);
    }
    if (request !== controller || !panel.isConnected) return;
    refreshButton.disabled = false;
    const available = draw();
    const latest = store.latestEditionTime(selected);
    const stamp = latest ? 'Updated ' + new Date(latest).toLocaleString(undefined, {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    }) : '';
    status.textContent = available
      ? [affinity?.seen.size ? 'For you' : '', stamp].filter(Boolean).join(' · ')
      : 'No matching headlines.';
  }

  refreshButton.disabled = true;
  refreshButton.onclick = () => load(true);
  savedNews.urls().catch(() => []).then(urls => {
    if (!panel.isConnected) return;
    for (const url of urls) stars.add(url);
    load();
  });
  return () => {
    observer.disconnect();
    request?.abort();
  };
}

export async function renderStory(view, savedNews, plans, url, fromSaved, focus, track) {
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
  if (!story.linkKind || isCurrentPublisherLink(url)) store.recordOpen(story);

  panel.innerHTML = `<div class="news-reader-tools">${back}
    <button class="news-star" type="button" aria-label="Save for later" aria-pressed="${!!saved}">${starIcon}</button></div>
    <h1 lang="${story.language}" tabindex="-1">${escapeHtml(story.title)}</h1>
    <p class="news-info"><a rel="noreferrer" href="${escapeHtml(url)}">${escapeHtml(story.source)}</a> · ${storyDate(story.date)}</p>
    <p class="news-info" role="status"></p><div class="news-body" lang="${story.language}"></div>`;
  if (focus) panel.querySelector('h1').focus();
  const status = panel.querySelector('[role=status]');
  const star = panel.querySelector('button');
  const topic = newsTopics.find(({ id }) => story.topic === id)?.label ?? 'General news';
  function trackStory() {
    if (panel.isConnected) track({ category: 'news', id: `news:topic:${story.topic}`, topic }, panel);
  }
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
    trackStory();
  }

  if (body) showBody();
  if (story.linkKind) {
    const source = panel.querySelector('.news-info a');
    if (!isCurrentPublisherLink(url)) {
      source.replaceWith(document.createTextNode(story.source));
      status.textContent = 'Saved headline · Publisher removed from News';
      return;
    }
    source.textContent = story.linkKind === 'discussion'
      ? 'Discussion on Hacker News' : 'Full article at ' + story.source;
    if (!navigator.onLine) status.textContent = 'Offline · Cached headline';
    return;
  }
  if (!body) store.saveArticle(story, null);
  if (typeof story.summary === 'string') {
    const summary = document.createElement('p');
    summary.textContent = story.summary;
    panel.querySelector('.news-body').replaceChildren(summary);
    trackStory();
    panel.querySelector('.news-info a').textContent = 'Full article at ' + story.source;
    if (!navigator.onLine) status.textContent = 'Offline · Cached summary';
    return;
  }
  if (body?.blocks) return;
  if (!navigator.onLine) {
    status.textContent = body ? 'Offline · Cached excerpt' : 'Connect to load the article.';
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
  } finally {
    clearTimeout(timeout);
  }
}
