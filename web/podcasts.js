import { hasNativePodcastPlayer, nativePodcast } from './podcast-native.js';
import { franceinfo, loadPodcast, searchPodcasts } from './podcast-provider.js';

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function button(text, action) {
  const node = element('button', text);
  node.type = 'button';
  node.addEventListener('click', () => action(node));
  return node;
}

const date = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });
let unsubscribe;
let cancelRequest;

export function renderPodcasts(view, repository, player, focus) {
  unsubscribe?.();
  cancelRequest?.();
  const panel = element('div', '', 'podcasts');
  panel.innerHTML = `<a class="back-link" href="#workspace"><span class="arrow" aria-hidden="true"></span>Workspace</a>
    <section class="podcast-hero" aria-labelledby="music-title">
      <div class="podcast-hero-copy">
        <h1 id="music-title" tabindex="-1">Music</h1>
        <form data-podcast-search>
          <div class="podcast-form-row">
            <input type="search" name="query" maxlength="120" aria-label="Podcast name" placeholder="Podcast name" required>
            <button type="submit">Search</button>
          </div>
        </form>
        <details class="podcast-rss">
          <summary>Add by RSS</summary>
          <form data-podcast-feed>
            <div class="podcast-form-row">
              <input name="url" type="url" maxlength="2048" aria-label="Podcast RSS link" placeholder="https://" required>
              <button type="submit">Open feed</button>
            </div>
          </form>
        </details>
      </div>
      <div class="podcast-hero-art">
        <img src="./assets/podcast-studio.webp" width="1152" height="768" alt="">
      </div>
    </section>
    <section class="podcast-continue" aria-label="Continue listening" hidden></section>
    <span class="podcast-announcement" role="status"></span>
    <p class="podcast-status" role="status"></p>
    <section class="podcast-results" aria-labelledby="podcast-results-title" hidden>
      <div class="podcast-section-heading">
        <h2 id="podcast-results-title" tabindex="-1">Search results</h2>
        <button type="button" class="quiet" data-clear-search>Clear search</button>
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
    const link = element('a', 'Open publisher');
    link.href = website;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
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
    const back = button(hasResults ? 'Back to results' : 'Back to shows', () => {
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
    back.className = 'quiet podcast-show-back';
    card.append(back, heading, element('p', show.publisher, 'podcast-notice'));
    const actions = element('div', '', 'actions');
    const follow = button(followed ? 'Unfollow' : 'Follow show', trigger => run(async () => {
      if (followed) await repository.removeShow(show.feedUrl);
      else await repository.saveShow(show);
      await showLibrary();
      if (!card.isConnected || detail.hidden) return;
      showDetails(follows.find(entry => entry.feedUrl === show.feedUrl) ?? show, true);
      announcement.textContent = followed ? 'Show unfollowed.' : 'Show followed.';
    }, trigger));
    if (followed) follow.className = 'quiet';
    actions.append(follow);
    if (followed) {
      const refresh = button('Refresh episodes', trigger => openShow(show.feedUrl, trigger, true));
      refresh.className = 'quiet';
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
        const play = button('Play', trigger => run(() => player.play(episodeToPlay(show, episode)), trigger));
        play.className = 'quiet podcast-play';
        play.setAttribute('aria-label', `Play ${episode.title}`);
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
      const open = button('Episodes', () => {
        discovery?.abort();
        status.textContent = '';
        showDetails(show, true);
      });
      open.className = 'quiet';
      open.setAttribute('aria-label', `Episodes for ${show.title}`);
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

  const suggested = button(franceinfo.title, trigger => openShow(franceinfo.feedUrl, trigger));
  suggested.className = 'podcast-pick-button';
  suggested.setAttribute('aria-label', `View episodes for ${franceinfo.title}`);
  const arrow = element('span', '', 'arrow');
  arrow.setAttribute('aria-hidden', 'true');
  suggested.append(arrow);
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
        const open = button('Episodes', trigger => openShow(show.feedUrl, trigger));
        open.className = 'quiet';
        open.setAttribute('aria-label', `Episodes for ${show.title}`);
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
    continuePanel.replaceChildren(copy,
      button('Resume episode', trigger => run(() => player.play(recent.episode), trigger)));
  });
  player.connect();
  void run(showLibrary);
}
