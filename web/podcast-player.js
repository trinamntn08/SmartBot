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
  const title = panel.querySelector('strong');
  const toggle = panel.querySelector('[data-player-toggle]');
  const rewind = panel.querySelector('[data-player-rewind]');
  const seek = panel.querySelector('input');
  const elapsed = panel.querySelector('[data-player-time]');
  const message = panel.querySelector('[role="status"]');
  const audio = hasNativePodcastPlayer ? null : new Audio();
  const listeners = new Set();
  let current;
  let recent;
  let lastWrite = 0;
  let startSequence = 0;
  let pendingNative = 0;
  let nativeTimer;
  let seeking = false;
  let restorePosition;
  let listening;

  function trackPlayback(continuePlaying = false, force = true) {
    const now = performance.now();
    if (!force && listening && now - listening.time < 5000) return;
    if (listening && !audio.seeking) {
      const elapsed = now - listening.time;
      const played = (audio.currentTime - listening.position) * 1000 / audio.playbackRate;
      // Natural playback advances with the clock. A discontinuity is a seek or a source change.
      if (played > 0 && played <= elapsed + 500) {
        const end = Date.now();
        const { id, title } = current.episode;
        const activity = { category: 'podcasts', id: `podcast:${id}`, topic: title };
        recordActivity(activityIntervals(activity, end - Math.min(elapsed, played), end));
      }
    }
    listening = continuePlaying ? { time: now, position: audio.currentTime } : null;
  }

  function render() {
    panel.hidden = !current;
    if (!current) return;
    if (title.textContent !== current.episode.title) {
      title.textContent = current.episode.title;
      title.title = current.episode.title;
    }
    const action = current.playing ? 'Pause' : current.error ? 'Retry' : 'Play';
    const playback = action.toLowerCase();
    if (toggle.dataset.playback !== playback) {
      toggle.dataset.playback = playback;
      toggle.setAttribute('aria-label', `${action} podcast`);
    }
    rewind.disabled = !current.duration;
    seek.disabled = !current.duration;
    seek.max = current.duration || 0;
    if (!seeking) seek.value = current.position;
    seek.setAttribute('aria-valuetext', time(Number(seek.value)));
    elapsed.textContent = `${time(current.position)}${current.duration ? ` / ${time(current.duration)}` : ''}`;
    panel.setAttribute('aria-busy', String(Boolean(current.buffering)));
    const status = current.error || '';
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
    const request = ++pendingNative;
    const state = await nativePodcast(action, args);
    if (request !== pendingNative) return;
    current = state?.active ? state : null;
    updateRecent(state?.episode ? state : null);
    render();
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
      playAudio();
      return;
    }
    const saved = await repository.position(episode.id).catch(() => null);
    if (attempt !== startSequence) return;
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
    if (!current?.duration) return;
    const target = Math.max(0, Math.min(current.duration, position));
    if (audio) {
      trackPlayback();
      audio.currentTime = target;
      current.position = audio.currentTime;
      render();
    } else void callNative('seek', { position: target }).catch(nativeFailure);
  }

  toggle.addEventListener('click', () => {
    if (audio) {
      if (current.playing) audio.pause();
      else playAudio();
    } else void callNative(current.playing ? 'pause' : 'resume').catch(nativeFailure);
  });
  rewind.addEventListener('click', () => seekTo((audio?.currentTime ?? current.position) - 15));
  seek.addEventListener('input', () => {
    seeking = true;
    seek.setAttribute('aria-valuetext', time(Number(seek.value)));
  });
  seek.addEventListener('change', () => {
    const position = Number(seek.value);
    seeking = false;
    seekTo(position);
  });
  seek.addEventListener('blur', () => { seeking = false; });

  let polling = false;
  async function syncNative() {
    if (polling || document.hidden) return;
    polling = true;
    try { await callNative('state'); }
    catch (error) { if (current) nativeFailure(error); }
    finally { polling = false; }
  }

  return {
    play,
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
