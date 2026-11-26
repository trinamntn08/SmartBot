let sdk;

function playerApi() {
  if (globalThis.YT?.Player) return Promise.resolve(globalThis.YT);
  if (sdk) return sdk;
  sdk = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const fail = () => {
      clearTimeout(timeout);
      script.remove();
      reject(new Error('The YouTube player could not load. Choose the video to try again.'));
    };
    const timeout = setTimeout(fail, 8000);
    window.onYouTubeIframeAPIReady = () => {
      clearTimeout(timeout);
      resolve(globalThis.YT);
    };
    script.src = 'https://www.youtube.com/iframe_api';
    script.addEventListener('error', fail, { once: true });
    document.head.append(script);
  }).catch(error => {
    sdk = undefined;
    throw error;
  });
  return sdk;
}

export function createYouTubePlayer(panel, view, pauseOtherPlayers) {
  const back = panel.querySelector('[data-youtube-return]');
  const closeButton = panel.querySelector('button');
  const slot = panel.querySelector('.youtube-video');
  const status = panel.querySelector('[role="status"]');
  const watch = panel.querySelector('[data-youtube-watch]');
  let player;
  let sequence = 0;
  let videoId;
  let visible = false;
  let startWhenVisible = false;
  let readyTimeout;
  let launcher;

  const canPlay = () => visible && !document.hidden && navigator.onLine
    && !document.querySelector('dialog[open]') && !document.querySelector('.book-reader');

  function checkPlayback() {
    if (!player?.pauseVideo) return;
    if (!canPlay()) player.pauseVideo();
    else if (startWhenVisible) {
      startWhenVisible = false;
      player.playVideo();
    }
  }

  const observer = new IntersectionObserver(entries => {
    visible = entries.at(-1).intersectionRatio > 0.5;
    checkPlayback();
  }, { threshold: 0.5 });

  function close() {
    sequence += 1;
    clearTimeout(readyTimeout);
    videoId = undefined;
    launcher = undefined;
    visible = false;
    startWhenVisible = false;
    observer.disconnect();
    player?.destroy?.();
    player = undefined;
    slot.replaceChildren();
    panel.hidden = true;
  }

  async function open(video) {
    const trigger = view.contains(document.activeElement) ? document.activeElement : undefined;
    if (video.id === videoId && player && watch.hidden) {
      launcher = trigger ?? launcher;
      panel.focus();
      startWhenVisible = !document.hidden;
      checkPlayback();
      return;
    }
    close();
    launcher = trigger;
    pauseOtherPlayers();
    const attempt = sequence;
    videoId = video.id;
    panel.hidden = false;
    status.textContent = 'Loading YouTube player…';
    watch.href = `https://www.youtube.com/watch?v=${video.id}`;
    watch.hidden = true;
    panel.focus();
    try {
      const api = await playerApi();
      if (attempt !== sequence) return;
      const mount = document.createElement('div');
      slot.append(mount);
      readyTimeout = setTimeout(() => {
        status.textContent = 'The YouTube player is taking too long to load.';
        watch.hidden = false;
      }, 12000);
      player = new api.Player(mount, {
        videoId: video.id,
        playerVars: { playsinline: 1, origin: location.origin },
        events: {
          onReady(event) {
            if (attempt !== sequence) return;
            clearTimeout(readyTimeout);
            status.textContent = '';
            watch.hidden = true;
            const frame = event.target.getIframe();
            frame.title = `YouTube player for ${video.title}`;
            startWhenVisible = !document.hidden;
            observer.observe(frame);
          },
          onStateChange(event) {
            if (attempt !== sequence) return;
            if (event.data === api.PlayerState.PLAYING && !canPlay()) event.target.pauseVideo();
          },
          onError() {
            if (attempt !== sequence) return;
            clearTimeout(readyTimeout);
            status.textContent = 'This video could not play here. Choose another result or watch it on YouTube.';
            watch.hidden = false;
          },
        },
      });
    } catch (error) {
      if (attempt !== sequence) return;
      status.textContent = error.message;
      watch.hidden = false;
    }
  }

  closeButton.addEventListener('click', () => {
    const trigger = launcher;
    close();
    const target = trigger?.getClientRects().length ? trigger : view.querySelector('[data-youtube-search-toggle]:not([hidden])');
    (target ?? view).focus();
  });
  if (location.origin !== 'https://appassets.androidplatform.net') watch.target = '_blank';
  watch.addEventListener('click', close);
  document.addEventListener('visibilitychange', checkPlayback);
  window.addEventListener('pagehide', () => player?.pauseVideo?.());
  window.addEventListener('offline', checkPlayback);
  const visibility = new MutationObserver(checkPlayback);
  for (const dialog of document.querySelectorAll('dialog')) visibility.observe(dialog, { attributeFilter: ['open'] });
  visibility.observe(view, { childList: true, subtree: true });

  return {
    open,
    close,
    setExpanded(expanded) {
      panel.classList.toggle('is-compact', !expanded);
      back.hidden = expanded;
    },
  };
}
