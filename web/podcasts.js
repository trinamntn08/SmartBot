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
    <h1 tabindex="-1">Music</h1>
    <h2>Podcasts</h2>
    <div class="podcast-continue card" hidden></div>
    <section class="card" aria-label="Add a podcast">
      <form data-podcast-search>
        <label>Search for a podcast<input type="search" name="query" maxlength="120" required></label>
        <button type="submit">Search</button>
      </form>
      <details>
        <summary>Paste an RSS link</summary>
        <form data-podcast-feed>
          <label>Podcast RSS link<input name="url" type="url" maxlength="2048" placeholder="https://" required></label>
          <button type="submit">Open feed</button>
        </form>
      </details>
      <p class="podcast-example"></p>
      <p class="podcast-notice">SmartBot plays audio from the publisher, who may include ads.</p>
    </section>
    <p class="podcast-status" role="status"></p>
    <div class="podcast-results"></div>
    <div class="podcast-show"></div>
    <section class="podcast-library" aria-labelledby="followed-podcasts">
      <h2 id="followed-podcasts">Followed shows</h2>
      <div class="podcast-followed"></div>
    </section>`;
  view.replaceChildren(panel);
  if (focus) panel.querySelector('h1').focus();

  const status = panel.querySelector('.podcast-status');
  const results = panel.querySelector('.podcast-results');
  const detail = panel.querySelector('.podcast-show');
  const library = panel.querySelector('.podcast-followed');
  const continuePanel = panel.querySelector('.podcast-continue');
  let follows = [];
  let selected;
  let discovery;

  async function run(action, trigger) {
    if (trigger) trigger.disabled = true;
    status.textContent = '';
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
      status.textContent = message;
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
    const card = element('section', '', 'card');
    const heading = element('h2', show.title);
    heading.tabIndex = -1;
    card.append(heading, element('p', show.publisher, 'podcast-notice'));
    const actions = element('div', '', 'actions');
    const follow = button(followed ? 'Unfollow' : 'Follow show', trigger => run(async () => {
      if (followed) await repository.removeShow(show.feedUrl);
      else await repository.saveShow(show);
      await showLibrary();
      if (!panel.isConnected) return;
      showDetails(follows.find(entry => entry.feedUrl === show.feedUrl) ?? show, true);
      status.textContent = followed ? 'Show unfollowed.' : 'Show followed.';
    }, trigger));
    actions.append(follow);
    if (followed) actions.append(button('Refresh episodes', trigger => openShow(show.feedUrl, trigger, true)));
    if (show.website) actions.append(publisherLink(show.website));
    card.append(actions);
    if (show.episodes.length) {
      const list = element('ul', '', 'podcast-list');
      list.setAttribute('role', 'list');
      for (const episode of show.episodes) {
        const row = element('li');
        const copy = element('div');
        copy.append(element('strong', episode.title));
        if (episode.publishedAt != null) copy.append(element('p', date.format(episode.publishedAt), 'podcast-notice'));
        const play = button('Play', trigger => run(() => player.play(episodeToPlay(show, episode)), trigger));
        play.setAttribute('aria-label', `Play ${episode.title}`);
        row.append(copy, play);
        list.append(row);
      }
      card.append(list);
    } else card.append(element('p', 'This feed has no episodes with public audio.'));
    detail.replaceChildren(card);
    if (moveFocus) heading.focus();
  }

  async function showLibrary() {
    follows = await repository.shows();
    if (!panel.isConnected) return;
    if (!follows.length) {
      library.replaceChildren(element('p', 'Follow a show to find it here.'));
      return;
    }
    const list = element('ul', '', 'podcast-list card');
    list.setAttribute('role', 'list');
    for (const show of follows) {
      const row = element('li');
      const copy = element('div');
      copy.append(element('strong', show.title), element('p', show.publisher, 'podcast-notice'));
      const open = button('Episodes', () => {
        discovery?.abort();
        status.textContent = '';
        showDetails(show, true);
      });
      open.setAttribute('aria-label', `Episodes for ${show.title}`);
      row.append(copy, open);
      list.append(row);
    }
    library.replaceChildren(list);
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
      status.textContent = refresh ? 'Episodes refreshed.' : '';
      showDetails(show, selected?.feedUrl !== show.feedUrl || refresh);
    }, trigger);
  }

  panel.querySelector('.podcast-example').append(button(franceinfo.title, trigger => openShow(franceinfo.feedUrl, trigger)));
  panel.querySelector('[data-podcast-feed]').addEventListener('submit', event => {
    event.preventDefault();
    void openShow(event.currentTarget.elements.url.value.trim(), event.submitter);
  });
  panel.querySelector('[data-podcast-search]').addEventListener('submit', event => {
    event.preventDefault();
    const query = event.currentTarget.elements.query.value.trim();
    results.replaceChildren();
    void discover('Searching for shows…', async signal => {
      const { shows, limited } = await searchPodcasts(query, signal);
      if (signal.aborted || !panel.isConnected) return;
      status.textContent = limited ? 'Showing the starter result. Full search is unavailable.'
        : shows.length ? `${shows.length} ${shows.length === 1 ? 'show' : 'shows'} found.` : 'No shows found. Try another name or paste its RSS link.';
      if (!shows.length) return;
      const list = element('ul', '', 'podcast-list card');
      list.setAttribute('role', 'list');
      for (const show of shows) {
        const row = element('li');
        const copy = element('div');
        copy.append(element('strong', show.title), element('p', show.publisher, 'podcast-notice'));
        const open = button('Episodes', trigger => openShow(show.feedUrl, trigger));
        open.setAttribute('aria-label', `Episodes for ${show.title}`);
        row.append(copy, open);
        list.append(row);
      }
      results.replaceChildren(list);
    }, event.submitter);
  });

  unsubscribe = player.subscribe(recent => {
    if (!panel.isConnected) return;
    continuePanel.hidden = !recent || recent.ended;
    if (continuePanel.hidden) return;
    continuePanel.replaceChildren(element('strong', recent.episode.title),
      button('Continue listening', trigger => run(() => player.play(recent.episode), trigger)));
  });
  player.connect();
  void run(showLibrary);
}
