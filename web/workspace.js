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
export const workspaceEditRoute = 'workspace-edit';
const holdDuration = 500;

export function findSection(route) {
  return sections.find(({ id }) => id === route);
}

function sectionImage(id) {
  return `<div class="section-image section-image--${id}" aria-hidden="true"></div>`;
}

function workspaceCard({ id, title, subtitle }, featured) {
  const image = featured && id === 'books'
    ? '<img src="./assets/books.webp" alt="" width="1536" height="1024" draggable="false">' : sectionImage(id);
  const copy = featured
    ? `<div class="feature-copy"><h2 class="feature-title">${title}</h2><p>${subtitle}</p></div>`
    : `<div class="section-copy">
        <h2>${title}</h2><p>${subtitle}</p>
        <span class="section-arrow" aria-hidden="true"><span class="arrow"></span></span>
      </div>`;
  return `<li data-section="${id}"${featured ? ' class="workspace-feature"' : ''}>
    <a class="${featured ? 'feature-card' : 'section-card'}" href="#${id}" draggable="false">
      ${featured ? copy + image : image + copy}
    </a>
    <button type="button" class="workspace-hide" aria-label="Hide ${title}" title="Hide ${title}">
      <svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
        <path d="M5 10h10"/>
      </svg>
    </button>
  </li>`;
}

function animateCardSwap(card, start) {
  const end = card.getBoundingClientRect();
  card.animate([
    { transform: `translate(${start.left - end.left}px, ${start.top - end.top}px) scale(${start.width / end.width}, ${start.height / end.height})` },
    { transform: 'none' },
  ], { duration: 180, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' });
}

export function renderWorkspace(view, focusHeading, openEditor) {
  view.innerHTML = `<h1 class="visually-hidden">Workspace</h1>
    <p id="workspace-instructions" class="visually-hidden">Select two cards to swap them. Press Escape to finish.</p>
    <p class="workspace-status" role="status"></p>
    <ul class="workspace-grid" role="list"></ul>
    <div class="card workspace-empty" hidden>
      <p>All Workspace sections are hidden.</p>
      <a href="#settings">Show sections in Settings</a>
    </div>`;
  const grid = view.querySelector('.workspace-grid');
  const status = view.querySelector('.workspace-status');
  const empty = view.querySelector('.workspace-empty');
  const lifecycle = new AbortController();
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let layout = repository.read();
  let editing = false;
  let returnTo;
  let selected;
  let press;
  let drag;
  let suppressClick = false;

  function updateMode() {
    grid.classList.toggle('is-editing', editing);
    for (const card of grid.children) {
      const link = card.firstElementChild;
      if (editing) {
        link.setAttribute('role', 'button');
        link.setAttribute('aria-label', `Move ${findSection(card.dataset.section).title}`);
        link.setAttribute('aria-pressed', 'false');
        link.setAttribute('aria-describedby', 'workspace-instructions');
        link.toggleAttribute('inert', grid.children.length < 2);
      } else {
        for (const attribute of ['role', 'aria-label', 'aria-pressed', 'aria-describedby', 'inert']) link.removeAttribute(attribute);
      }
    }
  }

  function draw() {
    const visible = layout.order.filter(id => !layout.hidden.has(id));
    grid.innerHTML = visible.map((id, index) => workspaceCard(findSection(id), index === 0)).join('');
    grid.hidden = !visible.length;
    empty.hidden = visible.length > 0;
    updateMode();
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
      card.firstElementChild.setAttribute('aria-pressed', pressed);
    }
  }

  function save(change, message, focus, preventScroll = false) {
    const updated = repository.update(change);
    if (!updated) {
      announce(saveError, true);
      return false;
    }
    layout = updated;
    selected = undefined;
    draw();
    (grid.querySelector(focus) ?? empty.querySelector('a')).focus({ preventScroll });
    announce(message);
    return true;
  }

  function swap(from, to, motionStarts) {
    if (from === to) return;
    const saved = save(({ order }) => {
      const first = order.indexOf(from);
      const second = order.indexOf(to);
      [order[first], order[second]] = [order[second], order[first]];
    }, `${findSection(from).title} and ${findSection(to).title} swapped places.`,
    `[data-section="${from}"] a`, Boolean(motionStarts));
    if (saved && motionStarts && !reducedMotion.matches) {
      for (const [id, start] of motionStarts) {
        const card = grid.querySelector(`[data-section="${id}"]`);
        if (card) animateCardSwap(card, start);
      }
    }
  }

  function closeEditor(restoreFocus = false) {
    cancelPress();
    editing = false;
    if (selected) select(undefined);
    updateMode();
    announce('');
    if (location.hash === `#${workspaceEditRoute}`) history.replaceState(null, '', '#workspace');
    if (restoreFocus) {
      const destination = grid.querySelector(`[data-section="${returnTo}"] a`) ?? grid.querySelector('a');
      (destination ?? empty.querySelector('a')).focus({ preventScroll: true });
    }
  }

  document.addEventListener('click', (event) => {
    if (editing && !drag && (!event.defaultPrevented || !event.composedPath().includes(grid))) {
      closeEditor();
    }
  }, { signal: lifecycle.signal });

  grid.addEventListener('click', (event) => {
    if (suppressClick && event.detail) {
      event.preventDefault();
      return;
    }
    if (!editing) return;
    const card = event.target.closest('[data-section]');
    if (!card) return;
    event.preventDefault();
    const id = card.dataset.section;
    if (event.target.closest('.workspace-hide')) {
      const next = card.nextElementSibling ?? card.previousElementSibling;
      save(({ hidden }) => hidden.add(id), `${findSection(id).title} hidden.`,
        `[data-section="${next?.dataset.section}"] .workspace-hide`);
    } else if (grid.children.length > 1 && event.target.closest('a')) {
      if (selected && selected !== id) swap(selected, id);
      else select(selected ? undefined : id);
    }
  });

  view.addEventListener('keydown', (event) => {
    if (!editing || drag) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      if (selected) select(undefined);
      else closeEditor(true);
    } else if (event.key === ' ' && event.target.matches('a[role="button"]')) {
      event.preventDefault();
      if (!event.repeat) event.target.click();
    }
  }, { signal: lifecycle.signal });

  grid.addEventListener('contextmenu', (event) => {
    if ((drag ?? press)?.touchId !== undefined || event.pointerType === 'touch' || event.sourceCapabilities?.firesTouchEvents) {
      event.preventDefault();
    }
  });

  function updateDropTarget() {
    const card = document.elementFromPoint(drag.x, drag.y)?.closest('[data-section]');
    const target = grid.contains(card) && card !== drag.source ? card : undefined;
    if (drag.target === target) return;
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

  function cancelPress() {
    clearTimeout(press?.timer);
    press = undefined;
  }

  function startGhost() {
    drag.source.classList.add('is-dragging');
    const bounds = drag.source.getBoundingClientRect();
    const previewWidth = Math.min(248, window.innerWidth / 2);
    const scale = Math.min(1, previewWidth / bounds.width, window.innerHeight / (2 * bounds.height));
    const ghost = document.createElement('div');
    ghost.className = 'workspace-ghost';
    ghost.inert = true;
    ghost.append(drag.source.firstElementChild.cloneNode(true));
    ghost.style.width = `${bounds.width}px`;
    ghost.style.height = `${bounds.height}px`;
    drag.ghost = ghost;
    drag.scale = scale;
    drag.offsetX = (bounds.left - drag.startX) * scale;
    drag.offsetY = (bounds.top - drag.startY) * scale;
    document.body.append(ghost);
  }

  function positionGhost() {
    drag.ghost.style.transform = `translate3d(${drag.x + drag.offsetX}px, ${drag.y + drag.offsetY}px, 0) scale(${drag.scale})`;
  }

  function clearDrag() {
    if (!drag) return;
    cancelAnimationFrame(drag.frame);
    drag.target?.classList.remove('is-drop-target');
    drag.source.classList.remove('is-dragging');
    drag.ghost?.remove();
    drag = undefined;
  }

  function beginGesture(target, point) {
    if (drag || press) return;
    suppressClick = false;
    if (point.altKey || point.ctrlKey || point.metaKey || point.shiftKey) return;
    const source = target.closest('[data-section]');
    if (!source || !target.closest('a')) return;
    const { clientX: x, clientY: y, pointerId, identifier: touchId } = point;
    const gesture = { pointerId, touchId, source, startX: x, startY: y, x, y };
    if (editing) {
      drag = gesture;
      return;
    }
    press = gesture;
    press.timer = setTimeout(() => {
      drag = gesture;
      press = undefined;
      if (pointerId !== undefined) grid.setPointerCapture(pointerId);
      returnTo = source.dataset.section;
      editing = true;
      updateMode();
      announce('Reordering Workspace cards.');
      suppressClick = true;
    }, holdDuration);
  }

  function moveGesture({ clientX: x, clientY: y }) {
    if (press) {
      if (Math.hypot(x - press.startX, y - press.startY) > 8) cancelPress();
      return;
    }
    drag.x = x;
    drag.y = y;
    if (!drag.ghost) {
      if (grid.children.length < 2 || Math.hypot(x - drag.startX, y - drag.startY) < 6) return;
      if (drag.pointerId !== undefined) grid.setPointerCapture(drag.pointerId);
      returnTo = drag.source.dataset.section;
      if (selected) select(undefined);
      suppressClick = true;
      startGhost();
    }
    positionGhost();
    updateDropTarget();
    drag.frame ??= requestAnimationFrame(scrollWhileDragging);
  }

  function finishGesture(point) {
    cancelPress();
    if (!drag) return;
    if (point && drag.ghost) {
      drag.x = point.clientX;
      drag.y = point.clientY;
      positionGhost();
      updateDropTarget();
    }
    const { source, target, ghost } = drag;
    if (point && target) {
      const from = source.dataset.section;
      const to = target.dataset.section;
      const starts = new Map([
        [from, ghost.getBoundingClientRect()],
        [to, target.getBoundingClientRect()],
      ]);
      clearDrag();
      swap(from, to, starts);
    } else {
      clearDrag();
    }
  }

  grid.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'touch' || !event.isPrimary || event.button !== 0) return;
    beginGesture(event.target, event);
  });
  grid.addEventListener('pointermove', (event) => {
    if (event.pointerId === (drag ?? press)?.pointerId) moveGesture(event);
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    grid.addEventListener(type, (event) => {
      if (event.pointerId !== (drag ?? press)?.pointerId) return;
      if (type === 'lostpointercapture' && event.target !== grid) return;
      finishGesture(type === 'pointerup' ? event : undefined);
    });
  }
  grid.addEventListener('pointerleave', (event) => {
    if (event.pointerId === (drag ?? press)?.pointerId && !grid.hasPointerCapture(event.pointerId)) finishGesture();
  });

  function changedTouch(event) {
    const touchId = (drag ?? press)?.touchId;
    if (touchId === undefined) return;
    return Array.from(event.changedTouches).find(touch => touch.identifier === touchId);
  }

  // Pointer Events can be cancelled when the browser claims a pan. Touch Events
  // follow the original contact and let a swipe scroll until the hold activates.
  grid.addEventListener('touchstart', (event) => {
    if (event.touches.length === 1) beginGesture(event.target, event.changedTouches[0]);
    else if ((drag ?? press)?.touchId !== undefined) finishGesture();
  }, { passive: true });
  grid.addEventListener('touchmove', (event) => {
    const touch = changedTouch(event);
    if (!touch) return;
    if (event.touches.length !== 1) {
      finishGesture();
      return;
    }
    moveGesture(touch);
    if (suppressClick && event.cancelable) event.preventDefault();
  }, { passive: false });
  grid.addEventListener('touchend', (event) => {
    const touch = changedTouch(event);
    if (!touch) return;
    if (suppressClick && event.cancelable) event.preventDefault();
    finishGesture(event.touches.length === 0 ? touch : undefined);
  }, { passive: false });
  grid.addEventListener('touchcancel', (event) => {
    if (changedTouch(event)) finishGesture();
  });

  draw();
  if (openEditor && !grid.hidden) {
    editing = true;
    updateMode();
    (grid.querySelector('a:not([inert])') ?? grid.querySelector('.workspace-hide')).focus();
  } else if (focusHeading) {
    (grid.querySelector('a') ?? empty.querySelector('a')).focus();
  }
  return () => {
    lifecycle.abort();
    cancelPress();
    clearDrag();
  };
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
    <a class="workspace-edit-link" href="#${workspaceEditRoute}">Reorder Workspace cards</a>
    <p class="workspace-status" role="status"></p>`;
  view.append(panel);

  const status = panel.querySelector('[role="status"]');
  const inputs = panel.querySelectorAll('input');
  const editLink = panel.querySelector('.workspace-edit-link');
  const sync = ({ hidden }) => {
    for (const input of inputs) input.checked = !hidden.has(input.value);
    editLink.hidden = hidden.size === sections.length;
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
