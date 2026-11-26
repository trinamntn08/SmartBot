import { hasNativePodcastPlayer, nativePodcast } from './podcast-native.js';
import { franceinfo, loadPodcast, searchPodcasts } from './podcast-provider.js';

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function button(action) {
  const node = element('button');
  node.type = 'button';
  node.addEventListener('click', () => action(node));
  return node;
}

const icons = {
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',
  next: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  back: '<path d="M19 12H5m6 6-6-6 6-6"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  bookmark: '<path d="M6 4h12v16l-6-4-6 4z"/>',
  saved: '<path fill="currentColor" d="M6 4h12v16l-6-4-6 4z"/>',
  refresh: '<path d="M20 6v6h-6m6 0a8 8 0 1 0-2.3 5.7"/>',
  external: '<path d="M13 5h6v6m0-6-8 8m8 1v5H5V5h5"/>',
  episodes: '<path d="m9 6 6 6-6 6"/>',
  play: '<path fill="currentColor" stroke="none" d="M8 5v14l11-7z"/>',
};

function icon(name) {
  return `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
    stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
}

function iconButton(label, name, action) {
  const node = button(action);
  node.className = 'podcast-icon';
  node.setAttribute('aria-label', label);
  node.title = label;
  node.innerHTML = icon(name);
  return node;
}

const date = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });
let unsubscribe;
let cancelRequest;

export function renderPodcasts(view, repository, player, focus) {
  unsubscribe?.();
  cancelRequest?.();
  const panel = element('div', '', 'podcasts');
  panel.innerHTML = `<section class="podcast-discovery" aria-labelledby="music-title">
      <h1 id="music-title" tabindex="-1">Music</h1>
      <img class="podcast-discovery-art" src="./assets/podcast-studio.webp" width="1152" height="768" alt="">
      <div class="podcast-discovery-tools">
        <form data-podcast-search>
          <div class="podcast-form-row">
            <input type="search" name="query" maxlength="120" aria-label="Podcast name" placeholder="Search podcasts" required>
            <button type="submit" class="podcast-icon" aria-label="Search" title="Search">${icon('search')}</button>
          </div>
        </form>
        <details class="podcast-rss">
          <summary>Add by RSS</summary>
          <form data-podcast-feed>
            <div class="podcast-form-row">
              <input name="url" type="url" maxlength="2048" aria-label="Podcast RSS link" placeholder="https://" required>
              <button type="submit" class="podcast-icon" aria-label="Open feed" title="Open feed">${icon('next')}</button>
            </div>
          </form>
        </details>
      </div>
    </section>
    <section class="podcast-continue" aria-label="Continue listening" hidden></section>
    <span class="podcast-announcement" role="status"></span>
    <p class="podcast-status" role="status"></p>
    <section class="podcast-results" aria-labelledby="podcast-results-title" hidden>
      <div class="podcast-section-heading">
        <h2 id="podcast-results-title" tabindex="-1">Search results</h2>
        <button type="button" class="quiet podcast-icon" data-clear-search
          aria-label="Clear search" title="Clear search">${icon('close')}</button>
      </div>
      <div class="podcast-result-list"></div>
    </section>
    <div class="podcast-show" hidden></div>
    <div class="podcast-shelves">
      <section class="podcast-library" aria-labelledby="followed-podcasts" hidden>
        <h2 id="followed-podcasts">Followed shows</h2>
        <div class="podcast-followed"></div>
      </section>
      <section class="podcast-pick" aria-labelledby="suggested-podcast">
        <h2 id="suggested-podcast">Suggested</h2>
        <div class="podcast-example"></div>
      </section>
    </div>`;
  view.replaceChildren(panel);
  if (focus) panel.querySelector('h1').focus();

  const status = panel.querySelector('.podcast-status');
  const announcement = panel.querySelector('.podcast-announcement');
  const results = panel.querySelector('.podcast-results');
  const resultList = panel.querySelector('.podcast-result-list');
  const detail = panel.querySelector('.podcast-show');
  const shelves = panel.querySelector('.podcast-shelves');
  const library = panel.querySelector('.podcast-library');
  const followedShows = panel.querySelector('.podcast-followed');
  const continuePanel = panel.querySelector('.podcast-continue');
  const queryInput = panel.querySelector('[name="query"]');
  let follows = [];
  let selected;
  let discovery;

  async function run(action, trigger) {
    if (trigger) trigger.disabled = true;
    status.textContent = '';
    announcement.textContent = '';
    try { await action(); }
    catch (error) { if (panel.isConnected) status.textContent = error.message; }
    finally { if (trigger) trigger.disabled = false; }
  }

  async function discover(message, action, trigger) {
    discovery?.abort();
    const controller = new AbortController();
    discovery = controller;
    cancelRequest = () => controller.abort();
    await run(async () => {
      announcement.textContent = message;
      try { await action(controller.signal); }
      catch (error) {
        if (!controller.signal.aborted) throw error;
      }
    }, trigger);
  }

  const episodeToPlay = (show, episode) => ({
    id: `${show.id ?? show.feedUrl}#${episode.id}`, title: episode.title,
    publisher: show.publisher, audioUrl: episode.audioUrl,
  });

  function publisherLink(website) {
    const link = element('a', '', 'quiet podcast-icon');
    link.href = website;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.setAttribute('aria-label', 'Open publisher');
    link.title = 'Open publisher';
    link.innerHTML = icon('external');
    if (hasNativePodcastPlayer) {
      link.addEventListener('click', event => {
        event.preventDefault();
        void run(() => nativePodcast('publisher', { url: website }));
      });
    }
    return link;
  }

  function showDetails(show, moveFocus = false) {
    selected = show;
    const followed = follows.find(entry => entry.feedUrl === show.feedUrl);
    const card = element('section', '', 'podcast-show-panel');
    const heading = element('h2', show.title);
    heading.tabIndex = -1;
    const hasResults = resultList.childElementCount > 0;
    const back = iconButton(hasResults ? 'Back to results' : 'Back to shows', 'back', () => {
      discovery?.abort();
      detail.hidden = true;
      selected = undefined;
      status.textContent = '';
      announcement.textContent = '';
      results.hidden = !hasResults;
      shelves.hidden = hasResults;
      if (hasResults) results.querySelector('h2').focus();
      else queryInput.focus();
    });
    back.classList.add('quiet', 'podcast-show-back');
    card.append(back, heading, element('p', show.publisher, 'podcast-notice'));
    const actions = element('div', '', 'actions');
    const follow = iconButton(followed ? 'Unfollow' : 'Follow show', followed ? 'saved' : 'bookmark', trigger => run(async () => {
      if (followed) await repository.removeShow(show.feedUrl);
      else await repository.saveShow(show);
      await showLibrary();
      if (!card.isConnected || detail.hidden) return;
      showDetails(follows.find(entry => entry.feedUrl === show.feedUrl) ?? show, true);
      announcement.textContent = followed ? 'Show unfollowed.' : 'Show followed.';
    }, trigger));
    follow.classList.add('quiet');
    actions.append(follow);
    if (followed) {
      const refresh = iconButton('Refresh episodes', 'refresh', trigger => openShow(show.feedUrl, trigger, true));
      refresh.classList.add('quiet');
      actions.append(refresh);
    }
    if (show.website) actions.append(publisherLink(show.website));
    card.append(actions);
    if (show.episodes.length) {
      card.append(element('h3', 'Episodes'));
      const list = element('ul', '', 'podcast-list');
      list.setAttribute('role', 'list');
      for (const episode of show.episodes) {
        const row = element('li');
        const copy = element('div', '', 'podcast-row-copy');
        copy.append(element('strong', episode.title));
        if (episode.publishedAt != null) copy.append(element('p', date.format(episode.publishedAt), 'podcast-notice'));
        const play = iconButton(`Play ${episode.title}`, 'play', trigger => run(() => player.play(episodeToPlay(show, episode)), trigger));
        play.classList.add('quiet');
        play.title = 'Play episode';
        row.append(copy, play);
        list.append(row);
      }
      card.append(list);
    } else card.append(element('p', 'This feed has no episodes with public audio.'));
    detail.replaceChildren(card);
    detail.hidden = false;
    results.hidden = true;
    shelves.hidden = true;
    if (moveFocus) heading.focus();
  }

  async function showLibrary() {
    follows = await repository.shows();
    if (!panel.isConnected) return;
    library.hidden = !follows.length;
    if (!follows.length) {
      followedShows.replaceChildren();
      return;
    }
    const list = element('ul', '', 'podcast-list');
    list.setAttribute('role', 'list');
    for (const show of follows) {
      const row = element('li');
      const copy = element('div', '', 'podcast-row-copy');
      copy.append(element('strong', show.title), element('p', show.publisher, 'podcast-notice'));
      const open = iconButton(`Episodes for ${show.title}`, 'episodes', () => {
        discovery?.abort();
        status.textContent = '';
        showDetails(show, true);
      });
      open.classList.add('quiet');
      row.append(copy, open);
      list.append(row);
    }
    followedShows.replaceChildren(list);
  }

  function openShow(url, trigger, refresh = false) {
    return discover(refresh ? 'Refreshing episodes…' : 'Opening the podcast…', async signal => {
      const cached = follows.find(show => show.feedUrl === url);
      let show = cached;
      if (!cached || refresh) show = await loadPodcast(url, signal);
      if (signal.aborted || !panel.isConnected) return;
      const followed = follows.find(entry => entry.feedUrl === show.feedUrl);
      if (refresh || followed && !cached) {
        await repository.saveShow(show, cached?.feedUrl ?? followed.feedUrl);
        await showLibrary();
        show = follows.find(entry => entry.feedUrl === show.feedUrl) ?? show;
      }
      if (signal.aborted || !panel.isConnected) return;
      const feedForm = trigger?.form;
      const fromRss = feedForm?.matches('[data-podcast-feed]');
      if (fromRss) feedForm.closest('details').open = false;
      announcement.textContent = refresh ? 'Episodes refreshed.' : '';
      showDetails(show, fromRss || selected?.feedUrl !== show.feedUrl || refresh);
    }, trigger);
  }

  const suggested = button(trigger => openShow(franceinfo.feedUrl, trigger));
  suggested.className = 'quiet podcast-pick-button';
  suggested.setAttribute('aria-label', `View episodes for ${franceinfo.title}`);
  const suggestedCopy = element('span', '', 'podcast-row-copy');
  suggestedCopy.append(element('strong', franceinfo.title), element('span', franceinfo.publisher, 'podcast-notice'));
  const arrow = element('span', '', 'arrow');
  arrow.setAttribute('aria-hidden', 'true');
  suggested.append(suggestedCopy, arrow);
  panel.querySelector('.podcast-example').append(suggested);
  panel.querySelector('[data-podcast-feed]').addEventListener('submit', event => {
    event.preventDefault();
    void openShow(event.currentTarget.elements.url.value.trim(), event.submitter);
  });
  panel.querySelector('[data-clear-search]').addEventListener('click', () => {
    discovery?.abort();
    queryInput.value = '';
    resultList.replaceChildren();
    results.hidden = true;
    shelves.hidden = false;
    status.textContent = '';
    queryInput.focus();
  });
  panel.querySelector('[data-podcast-search]').addEventListener('submit', event => {
    event.preventDefault();
    const query = queryInput.value.trim();
    results.hidden = true;
    resultList.replaceChildren();
    detail.hidden = true;
    detail.replaceChildren();
    selected = undefined;
    shelves.hidden = false;
    void discover('Searching for shows…', async signal => {
      const { shows, limited } = await searchPodcasts(query, signal);
      if (signal.aborted || !panel.isConnected) return;
      announcement.textContent = limited ? 'Full search is unavailable.' : 'Search complete.';
      if (!shows.length) {
        status.textContent = limited ? 'Search is unavailable. Try an RSS link.' : 'No podcasts found.';
        return;
      }
      const list = element('ul', '', 'podcast-list');
      list.setAttribute('role', 'list');
      for (const show of shows) {
        const row = element('li');
        const copy = element('div', '', 'podcast-row-copy');
        copy.append(element('strong', show.title), element('p', show.publisher, 'podcast-notice'));
        const open = iconButton(`Episodes for ${show.title}`, 'episodes', trigger => openShow(show.feedUrl, trigger));
        open.classList.add('quiet');
        row.append(copy, open);
        list.append(row);
      }
      resultList.replaceChildren(list);
      results.hidden = false;
      shelves.hidden = true;
    }, event.submitter);
  });

  unsubscribe = player.subscribe(recent => {
    if (!panel.isConnected) return;
    continuePanel.hidden = !recent || recent.ended;
    if (continuePanel.hidden) return;
    const copy = element('div', '', 'podcast-row-copy');
    copy.append(element('h2', 'Continue listening'), element('strong', recent.episode.title));
    const resume = iconButton('Resume episode', 'play', trigger => run(() => player.play(recent.episode), trigger));
    continuePanel.replaceChildren(copy, resume);
  });
  player.connect();
  void run(showLibrary);
}
