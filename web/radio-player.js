export function createRadioPlayer(panel, view, beforePlayback) {
  const title = panel.querySelector('[data-radio-title]');
  const status = panel.querySelector('[role="status"]');
  const retry = panel.querySelector('[data-radio-retry]');
  const stop = panel.querySelector('[data-radio-stop]');
  let station;
  let audio;
  let timeout;

  function disconnect() {
    clearTimeout(timeout);
    if (!audio) return;
    const previous = audio;
    audio = undefined;
    previous.pause();
    previous.removeAttribute('src');
    previous.load();
  }

  function close() {
    disconnect();
    station = undefined;
    panel.hidden = true;
    status.textContent = '';
  }

  function play(next) {
    if (audio && station?.url === next.url) return;
    disconnect();
    station = next;
    title.textContent = next.name;
    panel.hidden = false;
    const retryHadFocus = document.activeElement === retry;
    retry.hidden = true;
    if (retryHadFocus) stop.focus();

    function fail() {
      disconnect();
      status.textContent = navigator.onLine ? 'Stream unavailable. Try again.' : 'Connect to the internet to listen.';
      retry.hidden = false;
    }

    if (!navigator.onLine) {
      fail();
      return;
    }
    beforePlayback();
    const connection = new Audio();
    audio = connection;
    function connecting(message) {
      status.textContent = message;
      clearTimeout(timeout);
      timeout = setTimeout(() => { if (audio === connection) fail(); }, 15000);
    }
    connecting('Connecting…');
    connection.addEventListener('playing', () => {
      if (audio !== connection) return;
      clearTimeout(timeout);
      status.textContent = 'Live';
    });
    connection.addEventListener('waiting', () => {
      if (audio === connection) connecting('Buffering…');
    });
    for (const event of ['error', 'ended']) {
      connection.addEventListener(event, () => { if (audio === connection) fail(); });
    }
    connection.src = next.url;
    connection.play().catch(() => { if (audio === connection) fail(); });
  }

  retry.addEventListener('click', () => play(station));
  stop.addEventListener('click', () => {
    close();
    (view.querySelector('a[href="#radio"][aria-current], h1[tabindex]') ?? view).focus();
  });
  return { play, close, remove: removed => { if (station?.url === removed.url) close(); } };
}
