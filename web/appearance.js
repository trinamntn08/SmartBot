(() => {
  const options = {
    colorMode: { system: 'System', light: 'Light', dark: 'Dark' },
    theme: { grove: 'Grove', ocean: 'Ocean', clay: 'Clay' },
  };
  const defaults = { colorMode: 'system', theme: 'grove' };
  const keys = { colorMode: 'smartbot.colorMode', theme: 'smartbot.theme' };
  const systemDark = matchMedia('(prefers-color-scheme: dark)');
  const root = document.documentElement;
  const unsaved = new Set();

  function read(name) {
    try {
      const value = localStorage.getItem(keys[name]);
      if (Object.hasOwn(options[name], value)) return value;
    } catch {
      // Appearance still works for this session when storage is unavailable.
    }
    return defaults[name];
  }

  const preferences = { colorMode: read('colorMode'), theme: read('theme') };

  function apply() {
    root.dataset.theme = preferences.theme;
    root.dataset.colorMode = preferences.colorMode === 'system'
      ? (systemDark.matches ? 'dark' : 'light') : preferences.colorMode;
  }

  function syncSettings() {
    const panel = document.querySelector('.appearance-settings');
    if (!panel) return;
    for (const input of panel.querySelectorAll('input')) {
      input.checked = preferences[input.name] === input.value;
    }
    panel.querySelector('[role="status"]').textContent = unsaved.size
      ? 'Could not save appearance on this device. Your choices apply for this session.' : '';
  }

  // Set the saved appearance before the stylesheets are loaded.
  apply();
  systemDark.addEventListener('change', apply);
  window.addEventListener('storage', (event) => {
    if (event.storageArea !== localStorage || (event.key !== null && !Object.values(keys).includes(event.key))) return;
    for (const [name, key] of Object.entries(keys)) {
      if (event.key === key || event.key === null) {
        preferences[name] = read(name);
        unsaved.delete(name);
      }
    }
    apply();
    syncSettings();
  });

  function choices(name) {
    return Object.entries(options[name]).map(([value, label]) => `<label>
      ${name === 'theme' ? `<span class="appearance-swatch" data-theme="${value}" aria-hidden="true"><span></span></span>` : ''}
      <span class="appearance-choice">
        <input type="radio" name="${name}" value="${value}">
        <span>${label}</span>
      </span>
    </label>`).join('');
  }

  window.smartBotAppearance = {
    renderSettings(view) {
      const panel = document.createElement('section');
      panel.className = 'card appearance-settings';
      panel.setAttribute('aria-labelledby', 'appearance-title');
      panel.innerHTML = `<h2 id="appearance-title">Appearance</h2>
        <fieldset><legend>Color mode</legend><div class="appearance-modes">${choices('colorMode')}</div></fieldset>
        <fieldset><legend>Theme</legend><div class="appearance-themes">${choices('theme')}</div></fieldset>
        <p class="appearance-status" role="status"></p>`;
      view.append(panel);
      syncSettings();
      panel.addEventListener('change', ({ target: { name, value } }) => {
        preferences[name] = value;
        try {
          localStorage.setItem(keys[name], value);
          unsaved.delete(name);
        } catch {
          unsaved.add(name);
        }
        apply();
        syncSettings();
      });
    },
  };
})();
