export const spotifyOrigin = 'https://open.spotify.com';

export function createSpotifyPlayer(panel, view, pausePodcasts) {
  const back = panel.querySelector('a');
  const dismiss = panel.querySelector('button');
  const offlineStatus = panel.querySelector('.spotify-offline');
  const template = panel.querySelector('template');
  let playlist;

  function syncConnection() {
    if (!playlist) return;
    const frame = panel.querySelector('iframe');
    const offline = !navigator.onLine;
    offlineStatus.hidden = !offline;
    if (offline) frame?.remove();
    else if (!frame) {
      const player = template.content.firstElementChild.cloneNode(true);
      player.src = `${spotifyOrigin}/embed/playlist/${playlist}`;
      pausePodcasts();
      panel.append(player);
    }
  }

  function close() {
    playlist = undefined;
    panel.hidden = true;
    panel.querySelector('iframe')?.remove();
  }

  dismiss.addEventListener('click', () => {
    close();
    (view.querySelector('[data-open-spotify]') ?? view).focus({ preventScroll: true });
  });
  window.addEventListener('online', syncConnection);
  window.addEventListener('offline', syncConnection);

  return {
    open(id) {
      if (playlist !== id) {
        close();
        playlist = id;
        panel.hidden = false;
      }
      syncConnection();
      panel.focus();
    },
    close,
    setExpanded(expanded) {
      panel.classList.toggle('is-compact', !expanded);
      back.hidden = expanded;
    },
  };
}
