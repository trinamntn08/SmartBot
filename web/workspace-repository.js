const key = 'smartbot.workspace';

export function workspaceRepository(sectionIds) {
  const knownIds = new Set(sectionIds);

  function read() {
    let saved;
    try {
      saved = JSON.parse(localStorage.getItem(key));
    } catch {
      // A missing or unreadable preference starts with the default layout.
    }
    const known = (list) => Array.isArray(list) ? list.filter(id => knownIds.has(id)) : [];
    return {
      order: [...new Set([...known(saved?.order), ...sectionIds])],
      hidden: new Set(known(saved?.hidden)),
    };
  }

  return {
    read,
    update(change) {
      const layout = read();
      change(layout);
      try {
        localStorage.setItem(key, JSON.stringify({ order: layout.order, hidden: [...layout.hidden] }));
        return layout;
      } catch {
        return null;
      }
    },
  };
}
