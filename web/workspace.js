import { workspaceRepository } from './workspace-repository.js';

const sections = [
  { id: 'books', title: 'Books', subtitle: 'Just one more chapter.' },
  { id: 'news', title: 'News', subtitle: 'Coffee and headlines.' },
  { id: 'languages', title: 'Languages', subtitle: 'Say that again?', detail: 'Vocabulary decks are in development.' },
  { id: 'listen', title: 'Listen', subtitle: 'Songs and stories.' },
  { id: 'movies', title: 'Movies', subtitle: 'Pass the popcorn.', detail: 'Film browsing and watchlists are in development.' },
  { id: 'markets', title: 'Markets', subtitle: 'Charts with plot twists.' },
];
const repository = workspaceRepository(sections.map(({ id }) => id));
const saveError = 'Your Workspace changes could not be saved on this device.';

export function findSection(route) {
  return sections.find(({ id }) => id === route);
}

function sectionImage(id) {
  return `<div class="section-image section-image--${id}" aria-hidden="true"></div>`;
}

function workspaceCard({ id, title, subtitle }, featured, editing) {
  const tag = editing ? 'div' : 'a';
  const link = editing ? '' : ` href="#${id}"`;
  const image = featured && id === 'books'
    ? '<img src="./assets/books.webp" alt="" width="1536" height="1024">' : sectionImage(id);
  const copy = featured
    ? `<div class="feature-copy"><h2 class="feature-title">${title}</h2><p>${subtitle}</p></div>`
    : `<div class="section-copy">
        <h2>${title}</h2><p>${subtitle}</p>
        ${editing ? '' : '<span class="section-arrow" aria-hidden="true"><span class="arrow"></span></span>'}
      </div>`;
  return `<li data-section="${id}"${featured ? ' class="workspace-feature"' : ''}>
    <${tag} class="${featured ? 'feature-card' : 'section-card'}"${link}>
      ${featured ? copy + image : image + copy}
    </${tag}>
    ${editing ? `<button type="button" class="quiet workspace-move" aria-label="Move ${title}" aria-pressed="false" title="Move ${title}">
      <svg viewBox="0 0 20 20" width="20" height="20" fill="currentColor" aria-hidden="true">
        <circle cx="7" cy="5" r="1.4"/><circle cx="13" cy="5" r="1.4"/>
        <circle cx="7" cy="10" r="1.4"/><circle cx="13" cy="10" r="1.4"/>
        <circle cx="7" cy="15" r="1.4"/><circle cx="13" cy="15" r="1.4"/>
      </svg>
    </button>
    <button type="button" class="quiet workspace-hide" aria-label="Hide ${title}" title="Hide ${title}">
      <svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
        <path d="M5 10h10"/>
      </svg>
    </button>` : ''}
  </li>`;
}

export function renderWorkspace(view, focusHeading) {
  view.innerHTML = `<h1 class="visually-hidden">Workspace</h1>
    <div class="workspace-toolbar">
      <p class="workspace-instructions" hidden>Drag a handle or select two handles to swap sections.</p>
      <button type="button" class="quiet workspace-customize">Customize</button>
    </div>
    <p class="workspace-status" role="status"></p>
    <ul class="workspace-grid" role="list"></ul>
    <div class="card workspace-empty" hidden>
      <p>All Workspace sections are hidden.</p>
      <a href="#settings">Show sections in Settings</a>
    </div>`;
  const grid = view.querySelector('.workspace-grid');
  const toolbar = view.querySelector('.workspace-toolbar');
  const customize = toolbar.querySelector('button');
  const instructions = toolbar.querySelector('p');
  const status = view.querySelector('.workspace-status');
  const empty = view.querySelector('.workspace-empty');
  let layout = repository.read();
  let editing = false;
  let selected;
  let drag;
  let suppressClick = false;

  function draw() {
    const visible = layout.order.filter(id => !layout.hidden.has(id));
    grid.innerHTML = visible.map((id, index) => workspaceCard(findSection(id), index === 0, editing)).join('');
    grid.classList.toggle('is-editing', editing);
    grid.hidden = !visible.length;
    empty.hidden = visible.length > 0;
    toolbar.hidden = !editing && !visible.length;
    instructions.hidden = !editing || visible.length < 2;
    customize.textContent = editing ? 'Done' : 'Customize';
    for (const handle of grid.querySelectorAll('.workspace-move')) handle.disabled = visible.length < 2;
  }

  function announce(message, error = false) {
    status.classList.toggle('visually-hidden', !error);
    status.textContent = message;
  }

  function select(id) {
    selected = id;
    for (const card of grid.children) {
      const pressed = card.dataset.section === id;
      card.classList.toggle('is-selected', pressed);
      card.querySelector('.workspace-move').setAttribute('aria-pressed', pressed);
    }
  }

  function save(change, message, focus) {
    const updated = repository.update(change);
    if (!updated) {
      announce(saveError, true);
      return;
    }
    layout = updated;
    selected = undefined;
    draw();
    (grid.querySelector(focus) ?? customize).focus();
    announce(message);
  }

  function swap(from, to) {
    if (from === to) return;
    save(({ order }) => {
      const first = order.indexOf(from);
      const second = order.indexOf(to);
      [order[first], order[second]] = [order[second], order[first]];
    }, `${findSection(from).title} and ${findSection(to).title} swapped places.`,
    `[data-section="${from}"] .workspace-move`);
  }

  customize.addEventListener('click', () => {
    editing = !editing;
    selected = undefined;
    layout = repository.read();
    draw();
    if (toolbar.hidden) empty.querySelector('a').focus();
  });

  grid.addEventListener('click', (event) => {
    if (!editing) return;
    if (suppressClick && event.detail) return;
    const card = event.target.closest('[data-section]');
    if (!card) return;
    const id = card.dataset.section;
    if (event.target.closest('.workspace-hide')) {
      const next = card.nextElementSibling ?? card.previousElementSibling;
      save(({ hidden }) => hidden.add(id), `${findSection(id).title} hidden.`,
        `[data-section="${next?.dataset.section}"] .workspace-hide`);
    } else if (event.target.closest('.workspace-move')) {
      if (selected && selected !== id) swap(selected, id);
      else select(selected ? undefined : id);
    }
  });

  grid.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !selected) return;
    event.preventDefault();
    select(undefined);
  });

  function updateDropTarget() {
    const card = document.elementFromPoint(drag.x, drag.y)?.closest('[data-section]');
    const target = grid.contains(card) && card !== drag.source ? card : undefined;
    drag.target?.classList.remove('is-drop-target');
    drag.target = target;
    target?.classList.add('is-drop-target');
  }

  function scrollWhileDragging() {
    if (!grid.isConnected) return;
    const edge = 52;
    const distance = drag.y < edge ? drag.y - edge : Math.max(0, drag.y - (window.innerHeight - edge));
    const top = window.scrollY;
    window.scrollBy(0, Math.sign(distance) * Math.min(18, Math.abs(distance)));
    updateDropTarget();
    drag.frame = window.scrollY !== top ? requestAnimationFrame(scrollWhileDragging) : undefined;
  }

  grid.addEventListener('pointerdown', (event) => {
    if (!event.isPrimary || event.button !== 0 || drag) return;
    suppressClick = false;
    const handle = event.target.closest('.workspace-move');
    if (!handle || handle.disabled) return;
    const { pointerId, clientX: x, clientY: y } = event;
    drag = { pointerId, source: handle.closest('[data-section]'), startX: x, startY: y, x, y };
    handle.setPointerCapture(pointerId);
  });

  grid.addEventListener('pointermove', (event) => {
    if (event.pointerId !== drag?.pointerId) return;
    drag.x = event.clientX;
    drag.y = event.clientY;
    if (!suppressClick && Math.hypot(drag.x - drag.startX, drag.y - drag.startY) < 6) return;
    if (!suppressClick) {
      select(undefined);
      drag.source.classList.add('is-dragging');
      suppressClick = true;
    }
    updateDropTarget();
    drag.frame ??= requestAnimationFrame(scrollWhileDragging);
  });

  function finishDrag(event) {
    if (event.pointerId !== drag?.pointerId) return;
    if (event.type === 'pointerup' && suppressClick) {
      drag.x = event.clientX;
      drag.y = event.clientY;
      updateDropTarget();
    }
    const { source, target, frame } = drag;
    cancelAnimationFrame(frame);
    target?.classList.remove('is-drop-target');
    source.classList.remove('is-dragging');
    drag = undefined;
    if (event.type === 'pointerup' && target) swap(source.dataset.section, target.dataset.section);
  }

  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) grid.addEventListener(event, finishDrag);

  draw();
  if (focusHeading) (grid.querySelector('a') ?? empty.querySelector('a')).focus();
}

export function renderWorkspaceSettings(view) {
  const panel = document.createElement('section');
  panel.className = 'card workspace-settings';
  panel.setAttribute('aria-labelledby', 'workspace-settings-title');
  panel.innerHTML = `<h2 id="workspace-settings-title">Workspace sections</h2>
    <p>Choose which sections appear on your Workspace.</p>
    <div class="workspace-choices">${sections.map(({ id, title }) => `<label>
      <input type="checkbox" value="${id}"> ${title}
    </label>`).join('')}</div>
    <p class="workspace-status" role="status"></p>`;
  view.append(panel);

  const status = panel.querySelector('[role="status"]');
  const inputs = panel.querySelectorAll('input');
  const sync = ({ hidden }) => {
    for (const input of inputs) input.checked = !hidden.has(input.value);
  };
  sync(repository.read());
  panel.addEventListener('change', ({ target: { value, checked } }) => {
    const updated = repository.update(({ hidden }) => {
      if (checked) hidden.delete(value);
      else hidden.add(value);
    });
    sync(updated ?? repository.read());
    status.textContent = updated ? '' : saveError;
  });
}

export function sectionPreview({ id, title, detail }) {
  return `<h1 tabindex="-1">${title}</h1>
    <div class="section-preview">
      ${sectionImage(id)}
      <p>${detail}</p>
    </div>`;
}
