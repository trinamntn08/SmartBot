import { hasNativePodcastPlayer, nativePodcast } from './podcast-native.js';
import { activityIntervals } from './activity.js';

function time(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor(total / 60) % 60;
  const pad = number => String(number).padStart(2, '0');
  return `${hours ? `${hours}:${pad(minutes)}` : minutes}:${pad(total % 60)}`;
}

export function createPodcastPlayer(repository, panel, recordActivity) {
  const title = panel.querySelector('[data-player-title]');
  const musicLink = panel.querySelector('.podcast-player-title');
  const publisher = panel.querySelector('[data-player-publisher]');
  const toggle = panel.querySelector('[data-player-toggle]');
  const rewind = panel.querySelector('[data-player-rewind]');
  const forward = panel.querySelector('[data-player-forward]');
  const seek = panel.querySelector('[data-player-seek]');
  const elapsed = panel.querySelector('[data-player-time]');
  const duration = panel.querySelector('[data-player-duration]');
  const speed = panel.querySelector('.podcast-speed');
  const speedButton = speed.querySelector('summary');
  const speedLabel = speed.querySelector('[data-player-rate]');
  const speedInput = speed.querySelector('input');
  const minRate = Number(speedInput.min);
  const maxRate = Number(speedInput.max);
  const dismissButton = panel.querySelector('[data-player-dismiss]');
  const view = document.querySelector('#view');
  const message = panel.querySelector('[role="status"]');
  const audio = hasNativePodcastPlayer ? null : new Audio();
  const listeners = new Set();
  let current;
  let recent;
  let lastWrite = 0;
  let startSequence = 0;
  let nativeRequest = 0;
  let nativeActions = 0;
  let nativeTimer;
  let seeking = false;
  let restorePosition;
  let listening;
  let dismissedEpisode;

  function trackPlayback(continuePlaying = false, force = true) {
    const now = performance.now();
    if (!force && listening && now - listening.time < 5000) return;
    if (listening && !audio.seeking) {
      const elapsed = now - listening.time;
      const played = (audio.currentTime - listening.position) * 1000 / listening.rate;
      // Natural playback advances with the clock. A discontinuity is a seek or a source change.
      if (played > 0 && played <= elapsed + 500) {
        const end = Date.now();
        const { id, title } = current.episode;
        const activity = { category: 'podcasts', id: `podcast:${id}`, topic: title };
        recordActivity(activityIntervals(activity, end - Math.min(elapsed, played), end));
      }
    }
    listening = continuePlaying ? { time: now, position: audio.currentTime, rate: audio.playbackRate } : null;
  }

  function renderTimeline() {
    const total = current.duration;
    const position = seeking ? Math.min(total, Number(seek.value)) : current.position;
    const progress = total ? Math.min(100, 100 * position / total) : 0;
    elapsed.textContent = time(position);
    seek.style.setProperty('--podcast-progress', `${progress}%`);
    seek.setAttribute('aria-valuetext', total ? `${time(position)} of ${time(total)}` : time(position));
  }

  function render() {
    panel.hidden = !current || dismissedEpisode === current.episode.id;
    if (panel.hidden) return;
    if (title.textContent !== current.episode.title) {
      title.textContent = current.episode.title;
      title.title = current.episode.title;
    }
    const byline = current.episode.publisher || '';
    if (publisher.textContent !== byline) publisher.textContent = byline;
    const action = current.playing ? 'Pause' : current.error ? 'Retry' : 'Play';
    const playback = action.toLowerCase();
    if (toggle.dataset.playback !== playback) {
      toggle.dataset.playback = playback;
      toggle.setAttribute('aria-label', `${action} podcast`);
    }
    const canSeek = Boolean(current.duration && current.seekable !== false);
    rewind.disabled = !canSeek;
    forward.disabled = !canSeek;
    seek.disabled = !canSeek;
    seek.max = Math.ceil(current.duration || 0);
    if (!seeking) seek.value = current.position;
    renderTimeline();
    duration.textContent = current.duration ? time(current.duration) : '–:––';
    if (!speed.open) renderRate(currentRate());
    const status = current.error || (current.buffering ? 'Buffering…' : '');
    if (message.textContent !== status) message.textContent = status;
  }

  function updateRecent(value) {
    const previous = recent?.episode.id;
    const wasEnded = recent?.ended;
    recent = value;
    if (previous !== recent?.episode.id || wasEnded !== recent?.ended) {
      for (const listener of listeners) listener(recent);
    }
  }

  function checkpoint(force = false) {
    if (!current) return;
    const updatedAt = Date.now();
    if (!force && updatedAt - lastWrite < 5000) return;
    lastWrite = updatedAt;
    const { episode, position, ended } = current;
    const progress = { episode, position, ended, updatedAt };
    updateRecent(progress);
    repository.savePosition(progress).catch(() => {
      message.textContent = 'SmartBot could not save the listening position on this device.';
    });
  }

  async function callNative(action, args) {
    const request = ++nativeRequest;
    const isAction = action !== 'state';
    if (isAction) nativeActions++;
    try {
      const state = await nativePodcast(action, args);
      if (request !== nativeRequest) return;
      if (current?.episode.id !== state?.episode?.id) seeking = false;
      if (action === 'play' || (state?.playing && !current?.playing)) dismissedEpisode = undefined;
      current = state?.active ? state : null;
      updateRecent(state?.episode ? state : null);
      render();
    } finally {
      if (isAction) nativeActions--;
    }
  }

  function nativeFailure(error) {
    if (current) {
      current.error = error.message;
      render();
    } else {
      throw error;
    }
  }

  function syncAudio(event) {
    if (!current) return;
    const active = !audio.paused && !audio.ended && !audio.seeking && !audio.error;
    if (event.type === 'seeking') listening = null;
    if (event.type === 'playing' || event.type === 'seeked') trackPlayback(active);
    if (event.type === 'timeupdate' && listening) trackPlayback(active, !active);
    if (['pause', 'ended', 'waiting', 'error'].includes(event.type)) trackPlayback();
    if (event.type === 'loadedmetadata' && restorePosition !== undefined) {
      try {
        audio.currentTime = Number.isFinite(audio.duration) ? Math.min(restorePosition, audio.duration) : restorePosition;
      } catch {
        // Some non-seekable episodes start at the beginning.
      }
      restorePosition = undefined;
    }
    if (audio.readyState > 0 && restorePosition === undefined) current.position = audio.currentTime;
    current.duration = Number.isFinite(audio.duration) ? audio.duration : 0;
    current.playing = !audio.paused && !audio.ended && !audio.error;
    current.buffering = current.playing && audio.readyState < 3;
    current.ended = audio.ended;
    if (audio.error) current.error = 'This episode could not play. Check your connection and retry.';
    if (['pause', 'seeked', 'ended', 'error'].includes(event.type)) checkpoint(true);
    else if (event.type === 'timeupdate' && current.playing) checkpoint();
    render();
  }

  if (audio) {
    audio.preload = 'metadata';
    const rate = repository.playbackRate();
    if (rate >= minRate && rate <= maxRate) {
      audio.defaultPlaybackRate = rate;
      audio.playbackRate = rate;
    }
    for (const event of ['loadedmetadata', 'durationchange', 'timeupdate', 'play', 'playing', 'pause', 'waiting', 'seeking', 'seeked', 'ended', 'error']) {
      audio.addEventListener(event, syncAudio);
    }
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) return;
      trackPlayback(Boolean(listening));
      checkpoint(true);
    });
    window.addEventListener('pagehide', () => {
      trackPlayback();
      checkpoint(true);
    });
    window.addEventListener('pageshow', () => {
      if (!audio.paused && !audio.ended && audio.readyState >= 3) trackPlayback(true);
    });
    repository.latest().then(value => { if (!current) updateRecent(value); }).catch(() => {});
  }

  function playAudio() {
    current.error = '';
    if (audio.error) {
      restorePosition = current.position;
      audio.load();
    } else if (audio.ended) {
      audio.currentTime = 0;
    }
    const episodeId = current.episode.id;
    current.buffering = true;
    render();
    audio.play().catch(error => {
      if (current?.episode.id !== episodeId || error.name === 'AbortError') return;
      current.buffering = false;
      current.error = 'This episode could not play. Check your connection and retry.';
      checkpoint(true);
      render();
    });
  }

  async function play(episode) {
    if (hasNativePodcastPlayer) {
      await callNative('play', { episode });
      return;
    }
    const attempt = ++startSequence;
    if (current?.episode.id === episode.id && current.episode.audioUrl === episode.audioUrl) {
      dismissedEpisode = undefined;
      playAudio();
      return;
    }
    const saved = await repository.position(episode.id).catch(() => null);
    if (attempt !== startSequence) return;
    dismissedEpisode = undefined;
    trackPlayback();
    checkpoint(true);
    seeking = false;
    restorePosition = saved?.ended ? 0 : saved?.position ?? 0;
    current = { episode, position: restorePosition, duration: 0, ended: false };
    audio.src = episode.audioUrl;
    checkpoint(true);
    playAudio();
  }

  function seekTo(position) {
    if (!current?.duration || current.seekable === false) return;
    const target = Math.max(0, Math.min(current.duration, position));
    if (audio) {
      trackPlayback();
      audio.currentTime = target;
      current.position = audio.currentTime;
      render();
    } else void callNative('seek', { position: target }).catch(nativeFailure);
  }

  function skip(seconds, action) {
    if (audio) seekTo(audio.currentTime + seconds);
    else void callNative(action).catch(nativeFailure);
  }

  function currentRate() {
    return audio?.playbackRate ?? current?.rate ?? 1;
  }

  function renderRate(rate) {
    const rateText = `${Number(rate.toFixed(2))}×`;
    speedInput.style.setProperty('--podcast-progress', `${100 * (rate - minRate) / (maxRate - minRate)}%`);
    speedInput.setAttribute('aria-valuetext', rateText);
    if (speedLabel.textContent === rateText) return;
    speedLabel.textContent = rateText;
    speedButton.setAttribute('aria-label', `Playback speed, ${rateText}`);
    speedButton.title = `Playback speed, ${rateText}`;
  }

  function closeSpeed(restoreFocus) {
    if (!speed.open) return;
    speed.open = false;
    if (restoreFocus) speedButton.focus();
  }

  async function setRate(rate) {
    if (audio) {
      const isListening = Boolean(listening);
      trackPlayback();
      audio.defaultPlaybackRate = rate;
      audio.playbackRate = rate;
      if (isListening) trackPlayback(true);
      repository.savePlaybackRate(rate);
      render();
    } else {
      try { await callNative('speed', { rate }); }
      catch (error) {
        speedInput.value = currentRate();
        renderRate(currentRate());
        nativeFailure(error);
      }
    }
  }

  async function dismiss() {
    const id = current.episode.id;
    if (audio) {
      trackPlayback();
      audio.pause();
      if (audio.readyState > 0 && restorePosition === undefined) current.position = audio.currentTime;
      checkpoint(true);
    } else {
      try { await callNative('pause'); }
      catch (error) {
        nativeFailure(error);
        return;
      }
      if (current?.episode.id !== id || current.playing) return;
    }
    const restoreFocus = document.activeElement === dismissButton;
    dismissedEpisode = id;
    closeSpeed(false);
    render();
    if (restoreFocus) {
      const resume = view.querySelector('.podcast-continue:not([hidden]) button');
      (resume || view).focus({ preventScroll: true });
    }
  }

  toggle.addEventListener('click', () => {
    if (audio) {
      if (current.playing) audio.pause();
      else playAudio();
    } else void callNative(current.playing ? 'pause' : 'resume').catch(nativeFailure);
  });
  rewind.addEventListener('click', () => skip(-10, 'back'));
  forward.addEventListener('click', () => skip(10, 'forward'));
  seek.addEventListener('input', () => {
    seeking = true;
    renderTimeline();
  });
  seek.addEventListener('change', () => {
    const position = Number(seek.value);
    seeking = false;
    seekTo(position);
  });
  seek.addEventListener('blur', () => {
    if (!seeking) return;
    seeking = false;
    render();
  });

  speedButton.addEventListener('click', () => {
    if (speed.open) return;
    const rate = currentRate();
    speedInput.value = rate;
    renderRate(speedInput.valueAsNumber);
  });
  speed.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || !speed.open) return;
    event.preventDefault();
    closeSpeed(true);
  });
  speed.addEventListener('focusout', event => {
    if (event.relatedTarget && !speed.contains(event.relatedTarget)) closeSpeed(false);
  });
  document.addEventListener('pointerdown', event => {
    if (!speed.contains(event.target)) closeSpeed(false);
  });
  speedInput.addEventListener('input', () => renderRate(speedInput.valueAsNumber));
  speedInput.addEventListener('change', () => void setRate(speedInput.valueAsNumber));
  dismissButton.addEventListener('click', () => void dismiss());

  let polling = false;
  async function syncNative() {
    if (polling || nativeActions || document.hidden) return;
    polling = true;
    try { await callNative('state'); }
    catch (error) { if (current) nativeFailure(error); }
    finally { polling = false; }
  }

  return {
    play,
    setExpanded(expanded) {
      panel.classList.toggle('is-compact', !expanded);
      if (expanded) musicLink.removeAttribute('href');
      else {
        musicLink.setAttribute('href', '#music');
        closeSpeed(false);
      }
    },
    subscribe(listener) {
      listeners.add(listener);
      listener(recent);
      return () => listeners.delete(listener);
    },
    connect() {
      if (!hasNativePodcastPlayer || nativeTimer) return;
      nativeTimer = setInterval(syncNative, 1000);
      document.addEventListener('visibilitychange', syncNative);
      void syncNative();
    },
  };
}
