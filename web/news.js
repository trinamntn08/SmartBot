import { feeds, fetchArticle, fetchFeed, isCanadaStory, shortlist } from './news-provider.js';
import { newsRepository as store } from './news-repository.js';
import { resumeBookRoute } from './library-repository.js';

const dateFormat = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
const freshFor = 60 * 60 * 1000;
const storyDate = value => dateFormat.format(new Date(value.length === 10 ? value + 'T12:00:00' : value));
export const storyRoute = story => '#story=' + encodeURIComponent(story.url);

export function escapeHtml(text) {
  return String(text).replace(/[&<>"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char]);
}

function backLink(route, title) {
  return `<a class="back-link" href="#${route}"><span class="arrow" aria-hidden="true"></span>${title}</a>`;
}

export function renderNews(view, routine, focus) {
  const panel = document.createElement('section');
  view.replaceChildren(panel);
  panel.innerHTML = `<div class="news-heading"><h1 tabindex="-1">News</h1><button class="quiet" type="button">Refresh</button></div>
    <div class="news-filters">
      <select aria-label="Language" name="language"><option value="">Both languages</option><option value="en">English</option><option value="fr">Français</option></select>
      <select aria-label="Topic" name="topic"><option value="">All topics</option><option value="general">General news</option><option value="sports">Sports</option></select>
    </div>
    <p class="news-info" role="status"></p><ul class="news-list" aria-label="Headlines"></ul>
    <a class="book-fallback" href="${resumeBookRoute()}" hidden>Read a book instead</a>`;
  const language = panel.querySelector('[name=language]');
  const topic = panel.querySelector('[name=topic]');
  const refreshButton = panel.querySelector('button');
  const status = panel.querySelector('[role=status]');
  const fallback = panel.querySelector('.book-fallback');
  const preferences = store.preferences();
  language.value = preferences.language;
  topic.value = preferences.topic;
  let request;

  function draw() {
    const selections = { language: language.value, topic: topic.value };
    const stories = shortlist(store.stories(), selections);
    panel.querySelector('ul').innerHTML = stories.map(story => `<li>
      <a class="news-headline" href="${escapeHtml(storyRoute(story))}" lang="${story.language}">${escapeHtml(story.title)}</a>
      <small>${escapeHtml(story.source)} · ${story.language.toUpperCase()} · ${storyDate(story.date)}${routine.readArticles?.[story.url] ? ' · Read' : ''}</small>
    </li>`).join('');
    return stories.length;
  }

  async function load(force = false) {
    request?.abort();
    const controller = new AbortController();
    request = controller;
    const selected = feeds.filter(feed => (!language.value || feed.language === language.value)
      && (!topic.value || feed.topic === topic.value));
    const pending = selected.filter(feed => force || !(Date.now() - store.edition(feed)?.time < freshFor));
    draw();
    const time = Date.now();
    let failures = 0;
    refreshButton.disabled = navigator.onLine && pending.length > 0;
    if (refreshButton.disabled) status.textContent = 'Updating…';
    const timeout = setTimeout(() => controller.abort(), 12000);
    if (navigator.onLine) await Promise.all(pending.map(async feed => {
      try {
        const stories = await fetchFeed(feed, controller.signal);
        if (!controller.signal.aborted && !store.saveEdition(feed, { time, stories })) failures++;
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
    status.textContent = available ? [note, stamp].filter(Boolean).join(' · ') : 'No headlines for these filters.';
    fallback.hidden = navigator.onLine && !failures && available > 0;
  }

  panel.querySelector('.news-filters').onchange = () => {
    store.savePreferences({ language: language.value, topic: topic.value });
    load();
  };
  refreshButton.onclick = () => load(true);
  load();
  if (focus) panel.querySelector('h1').focus();
}

export function renderStory(view, routine, date, url, change, focus) {
  const cached = store.article(url);
  const story = store.stories().find(item => item.url === url)
    ?? Object.values(routine.plans).find(plan => plan.news?.story.url === url)?.news.story
    ?? cached?.story;
  const panel = document.createElement('article');
  view.replaceChildren(panel);
  if (!story) {
    panel.innerHTML = backLink('news', 'News') + '<h1 tabindex="-1">Story unavailable</h1>';
    if (focus) panel.querySelector('h1').focus();
    return;
  }
  const pick = routine.plans[date]?.news;
  const read = routine.readArticles?.[url];
  const onPlan = pick?.story.url === url;
  const useReader = isCanadaStory(url);
  panel.className = 'news-story';
  panel.innerHTML = `${backLink('news', 'News')}
    <h1 lang="${story.language}" tabindex="-1">${escapeHtml(story.title)}</h1>
    <p class="news-info">${escapeHtml(story.source)} · ${storyDate(story.date)}</p>
    <div class="news-actions">
    ${!pick && !read ? '<button class="quiet" data-news="add">Add to Today · 5 min</button>' : ''}
    ${onPlan ? '<a href="#today">View in Today</a>' : ''}</div>
    <p class="news-info" role="status"></p>
    <div class="news-body" lang="${story.language}"></div>
    <a class="publisher-link" rel="noreferrer" href="${escapeHtml(url)}">Read original at ${escapeHtml(story.source)}</a>
    <div class="news-actions"><button data-news="read"></button></div>
    <a class="book-fallback" href="${resumeBookRoute()}" ${navigator.onLine ? 'hidden' : ''}>Read a book instead</a>`;
  const readButton = panel.querySelector('[data-news=read]');
  readButton.textContent = read ? 'Mark unread' : 'Mark as read';
  readButton.onclick = () => change(story, read ? 'unread' : 'read');
  const add = panel.querySelector('[data-news=add]');
  if (add) add.onclick = () => change(story, 'add');
  const status = panel.querySelector('[role=status]');
  if (!navigator.onLine) status.textContent = 'Offline';
  function showBody(body) {
    const content = panel.querySelector('.news-body');
    for (const paragraph of body.paragraphs) {
      const p = document.createElement('p');
      p.textContent = paragraph;
      content.append(p);
    }
    const link = panel.querySelector('.publisher-link');
    panel.querySelector('.news-info').textContent = 'Excerpt · ' + body.author + ' · ' + storyDate(story.date);
    link.textContent = 'Read full release';
  }
  if (cached?.body) showBody(cached.body);
  else {
    store.saveArticle(story, null);
    if (useReader && navigator.onLine) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 9000);
      status.textContent = 'Loading article…';
      fetchArticle(url, controller.signal).then(body => {
        if (!panel.isConnected || !body) return;
        store.saveArticle(story, body);
        showBody(body);
      }).catch(() => {}).finally(() => {
        clearTimeout(timeout);
        if (panel.isConnected) {
          status.textContent = '';
          panel.querySelector('.book-fallback').hidden = !!panel.querySelector('.news-body p');
        }
      });
    }
  }
  if (focus) panel.querySelector('h1').focus();
}
