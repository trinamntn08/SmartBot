const launcher = document.querySelector('.ask-launcher');
const dialog = document.querySelector('#assistant');
const form = dialog.querySelector('form');
const question = form.elements.question;
const recordButton = form.querySelector('.assistant-record');
const sendButton = form.querySelector('[type="submit"]');
const conversation = dialog.querySelector('.assistant-conversation');
const status = form.querySelector('.assistant-status');
const canRecord = Boolean(navigator.mediaDevices?.getUserMedia && window.MediaRecorder && window.OfflineAudioContext);
const canSpeak = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
const sampleRate = 16_000;
const maximumSeconds = 45;
const history = [];
const providerPreferenceKey = 'smartbot.assistant.provider';
const googleSearch = 'google';
const providerNames = { [googleSearch]: 'Google Search', openai: 'GPT (OpenAI)', gemini: 'Gemini' };
const isAndroidApp = location.hostname === 'appassets.androidplatform.net';
const setupMessage = 'Configure an API key on the SmartBot preview server for each AI provider you want to use.';
const unavailableMessage = 'Your saved provider is unavailable. Choose an available provider.';
let sessionPreference = '';
let availableProviders = [];
let providerError = '';
let pending = false;
let capture = null;

function preferredProviderId() {
  if (sessionPreference) return sessionPreference;
  try {
    return localStorage.getItem(providerPreferenceKey) || googleSearch;
  } catch {
    return googleSearch;
  }
}

function saveProvider(id) {
  try {
    localStorage.setItem(providerPreferenceKey, id);
    sessionPreference = '';
    return true;
  } catch {
    sessionPreference = id;
    return false;
  }
}

async function fetchProviders() {
  if (isAndroidApp) {
    throw new Error('Use the browser preview to connect GPT or Gemini.');
  }
  let response;
  try {
    response = await fetch('./api/assistant', { cache: 'no-store' });
  } catch {
    throw new Error('Could not reach the assistant. Check your connection and try again.');
  }
  if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) {
    throw new Error('Start SmartBot with its Python preview server to connect the assistant.');
  }
  const { providers } = await response.json();
  return providers;
}

export async function renderAssistantSettings(view) {
  view.insertAdjacentHTML('beforeend', `<section class="card assistant-settings" aria-labelledby="assistant-settings-title">
      <h2 id="assistant-settings-title">Assistant</h2>
      <div class="provider-field">
        <label for="assistant-provider">Provider</label>
        <select id="assistant-provider" disabled></select>
      </div>
      <p class="settings-status" role="status">Checking providers…</p>
      <p class="settings-privacy">Google receives your search terms. GPT and Gemini receive recent chat messages when you send a question and recordings when you transcribe.</p>
    </section>`);
  const panel = view.querySelector('.assistant-settings');
  const selector = panel.querySelector('select');
  const message = panel.querySelector('.settings-status');

  const available = new Set([googleSearch]);
  const names = new Map(Object.entries(providerNames));
  let note = '';
  try {
    for (const { id, label } of await fetchProviders()) {
      available.add(id);
      if (!names.has(id)) names.set(id, label);
    }
    if (!available.has('openai') || !available.has('gemini')) note = setupMessage;
  } catch (error) {
    note = error.message;
  }
  const selected = preferredProviderId();
  if (!names.has(selected)) names.set(selected, 'Unavailable provider');
  selector.replaceChildren(...Array.from(names, ([id, label]) => {
    const option = new Option(label, id);
    option.disabled = !available.has(id);
    return option;
  }));
  selector.value = selected;
  selector.disabled = false;
  message.textContent = available.has(selected) ? note : `${unavailableMessage} ${note}`.trim();
  selector.addEventListener('change', () => {
    const saved = saveProvider(selector.value) ? 'Provider saved.' : 'Provider selected for this tab.';
    message.textContent = `${saved} ${note}`.trim();
  });
}

function setStatus(message, error = false) {
  status.textContent = message;
  status.classList.toggle('is-error', error);
}

function updateControls() {
  const searching = preferredProviderId() === googleSearch;
  const submitLabel = searching ? 'Search Google' : 'Send question';
  const recording = Boolean(capture?.recorder);
  const recordLabel = recording ? 'Stop and transcribe' : 'Record voice';
  question.placeholder = searching ? 'Search Google…' : 'Ask SmartBot…';
  question.enterKeyHint = searching ? 'search' : 'send';
  question.readOnly = pending || Boolean(capture);
  sendButton.disabled = question.readOnly || !question.value.trim();
  sendButton.setAttribute('aria-label', submitLabel);
  sendButton.title = submitLabel;
  recordButton.hidden = searching || !canRecord;
  recordButton.disabled = pending || !canRecord || Boolean(capture && !recording);
  recordButton.classList.toggle('is-recording', recording);
  recordButton.setAttribute('aria-label', recordLabel);
  recordButton.title = recordLabel;
  conversation.hidden = searching || !conversation.childElementCount;
}

async function loadProviders() {
  if (pending) return;
  pending = true;
  updateControls();
  try {
    availableProviders = await fetchProviders();
    providerError = '';
  } catch (error) {
    availableProviders = [];
    providerError = error.message;
  } finally {
    pending = false;
    updateControls();
  }
}

function providerForAction() {
  const providerId = preferredProviderId();
  const provider = availableProviders.find(({ id }) => id === providerId);
  if (!provider) {
    setStatus(providerError || (availableProviders.length
      ? 'The selected provider is unavailable.'
      : 'The assistant is unavailable.'), true);
  }
  return provider;
}

async function request(providerId, path, body, contentType) {
  const response = await fetch(`./api/assistant/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': contentType, 'X-SmartBot-Provider': providerId },
    body,
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'The assistant could not complete the request.');
  return result.text;
}

function appendMessage(role, text) {
  const entry = document.createElement('article');
  entry.className = `assistant-message assistant-message--${role}`;
  const author = document.createElement('strong');
  author.textContent = role === 'user' ? 'You' : 'SmartBot';
  const line = document.createElement('p');
  line.textContent = text;
  entry.append(author, line);
  if (role === 'assistant' && canSpeak) {
    const speak = document.createElement('button');
    speak.type = 'button';
    speak.className = 'assistant-speak';
    speak.textContent = 'Read aloud';
    speak.addEventListener('click', () => {
      speechSynthesis.cancel();
      speechSynthesis.speak(new SpeechSynthesisUtterance(text));
    });
    entry.append(speak);
  }
  conversation.hidden = false;
  conversation.append(entry);
  conversation.scrollTop = conversation.scrollHeight;
  return entry;
}

async function sendQuestion(event) {
  event.preventDefault();
  const content = question.value.trim();
  if (!content || pending || capture) return;
  if (preferredProviderId() === googleSearch) {
    const url = new URL('https://www.google.com/search');
    url.searchParams.set('q', content);
    if (isAndroidApp) location.assign(url.href);
    else window.open(url.href, '_blank', 'noopener,noreferrer');
    question.value = '';
    dialog.close();
    return;
  }
  const provider = providerForAction();
  if (!provider) return;
  const turn = { role: 'user', content };
  const entry = appendMessage(turn.role, turn.content);
  pending = true;
  updateControls();
  setStatus('Waiting for a reply…');
  try {
    const body = JSON.stringify({ messages: [...history.slice(-12), turn] });
    const text = await request(provider.id, 'ask', body, 'application/json');
    history.push(turn, { role: 'assistant', content: text.slice(0, question.maxLength) });
    appendMessage('assistant', text);
    question.value = '';
    setStatus('');
  } catch (error) {
    entry.remove();
    setStatus(`Could not send the question. ${error.message}`, true);
  } finally {
    pending = false;
    updateControls();
  }
}

async function wavRecording(recording) {
  const source = new Blob(recording.chunks, { type: recording.recorder.mimeType });
  const decoder = new OfflineAudioContext(1, sampleRate, sampleRate);
  const decoded = await decoder.decodeAudioData(await source.arrayBuffer());
  const samples = decoded.getChannelData(0).subarray(0, sampleRate * maximumSeconds);
  const wav = new DataView(new ArrayBuffer(44 + samples.length * 2));
  wav.setUint32(0, 0x52494646); // RIFF
  wav.setUint32(4, wav.byteLength - 8, true);
  wav.setUint32(8, 0x57415645); // WAVE
  wav.setUint32(12, 0x666d7420); // fmt
  wav.setUint32(16, 16, true);
  wav.setUint16(20, 1, true); // PCM
  wav.setUint16(22, 1, true); // mono
  wav.setUint32(24, sampleRate, true);
  wav.setUint32(28, sampleRate * 2, true);
  wav.setUint16(32, 2, true);
  wav.setUint16(34, 16, true);
  wav.setUint32(36, 0x64617461); // data
  wav.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const sample = Math.max(-1, Math.min(1, samples[i]));
    wav.setInt16(44 + i * 2, sample * (sample < 0 ? 32768 : 32767), true);
  }
  return wav.buffer;
}

function release(recording) {
  clearTimeout(recording.timeout);
  recording.stream?.getTracks().forEach(track => track.stop());
}

function cancelRecording() {
  if (!capture) return;
  const recording = capture;
  capture = null;
  if (recording.recorder?.state === 'recording') recording.recorder.stop();
  release(recording);
  updateControls();
}

async function transcribe(recording) {
  release(recording);
  if (capture !== recording) return;
  capture = null;
  pending = true;
  updateControls();
  setStatus('Transcribing…');
  try {
    const wav = await wavRecording(recording);
    const text = await request(recording.providerId, 'transcribe', wav, 'audio/wav');
    const draft = question.value.trimEnd();
    const next = draft ? `${draft}\n${text}` : text;
    question.value = next.slice(0, question.maxLength);
    setStatus(next.length > question.maxLength
      ? 'The transcript reached the question limit. Review it before sending.'
      : 'Transcript ready. Review it before sending.');
  } catch (error) {
    setStatus(`Could not transcribe the recording. ${error.message}`, true);
  } finally {
    pending = false;
    updateControls();
    if (dialog.open) question.focus();
  }
}

async function toggleRecording() {
  if (capture?.recorder?.state === 'recording') {
    capture.recorder.stop();
    recordButton.disabled = true;
    return;
  }
  if (pending || capture || !canRecord || preferredProviderId() === googleSearch) return;
  const provider = providerForAction();
  if (!provider) return;
  const recording = { chunks: [], providerId: provider.id };
  capture = recording;
  updateControls();
  setStatus('Waiting for microphone access…');
  try {
    recording.stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1 } });
    if (capture !== recording) {
      release(recording);
      return;
    }
    recording.recorder = new MediaRecorder(recording.stream);
    recording.recorder.addEventListener('dataavailable', event => recording.chunks.push(event.data));
    recording.recorder.addEventListener('stop', () => transcribe(recording), { once: true });
    recording.recorder.addEventListener('error', () => {
      if (capture !== recording) return;
      cancelRecording();
      setStatus('Recording failed. Try again or type your question.', true);
    }, { once: true });
    recording.recorder.start();
    recording.timeout = setTimeout(() => {
      if (recording.recorder.state === 'recording') recording.recorder.stop();
    }, maximumSeconds * 1_000);
    setStatus('Recording for up to 45 seconds. Audio is sent for transcription when recording ends.');
    updateControls();
  } catch (error) {
    release(recording);
    if (capture !== recording) return;
    capture = null;
    setStatus(error.name === 'NotAllowedError'
      ? 'Microphone access was denied. You can still type a question.'
      : 'Could not start the microphone. Check your input device or type your question.', true);
    updateControls();
  }
}

function initializeLauncher() {
  const positionKey = 'smartbot.assistant.launcherPosition';
  const area = launcher.parentElement;
  const dragThreshold = 6;
  const keyboardStep = 24;
  let position = [1, 1];
  let drag;
  let suppressClick = false;

  try {
    const saved = JSON.parse(localStorage.getItem(positionKey));
    if (Array.isArray(saved) && saved.length === 2
        && saved.every(value => Number.isFinite(value) && value >= 0 && value <= 1)) {
      position = saved;
    }
  } catch {
    // The launcher can still be moved when storage is unavailable.
  }

  function place([x, y]) {
    launcher.style.setProperty('--launcher-x', x);
    launcher.style.setProperty('--launcher-y', y);
  }

  function positionAt(left, top, bounds) {
    const fraction = (offset, travel) => travel > 0 ? Math.min(1, Math.max(0, offset / travel)) : 0;
    return [fraction(left, bounds.width - launcher.offsetWidth), fraction(top, bounds.height - launcher.offsetHeight)];
  }

  function save(next) {
    position = next;
    place(position);
    try {
      localStorage.setItem(positionKey, JSON.stringify(position));
    } catch {
      // Keep the position for the current page.
    }
  }

  place(position);
  launcher.hidden = false;
  document.body.classList.add('has-assistant');

  launcher.addEventListener('pointerdown', event => {
    if (drag || !event.isPrimary || event.button !== 0) return;
    const button = launcher.getBoundingClientRect();
    suppressClick = false;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY,
      offsetX: event.clientX - button.left, offsetY: event.clientY - button.top };
    launcher.setPointerCapture(event.pointerId);
  });

  launcher.addEventListener('pointermove', event => {
    if (drag?.id !== event.pointerId) return;
    if (!drag.position && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < dragThreshold) return;
    const bounds = area.getBoundingClientRect();
    drag.position = positionAt(event.clientX - drag.offsetX - bounds.left,
      event.clientY - drag.offsetY - bounds.top, bounds);
    place(drag.position);
  });

  launcher.addEventListener('pointerup', event => {
    if (drag?.id !== event.pointerId) return;
    if (drag.position) {
      suppressClick = true;
      save(drag.position);
    }
    drag = undefined;
  });

  launcher.addEventListener('lostpointercapture', event => {
    if (drag?.id !== event.pointerId) return;
    drag = undefined;
    place(position);
  });

  const offsets = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  launcher.addEventListener('keydown', event => {
    if (drag || !Object.hasOwn(offsets, event.key)) return;
    event.preventDefault();
    const [x, y] = offsets[event.key];
    const bounds = area.getBoundingClientRect();
    const button = launcher.getBoundingClientRect();
    save(positionAt(button.left - bounds.left + x * keyboardStep, button.top - bounds.top + y * keyboardStep, bounds));
  });

  launcher.addEventListener('click', event => {
    if (suppressClick && event.detail > 0) return;
    setStatus('');
    updateControls();
    dialog.showModal();
    launcher.setAttribute('aria-expanded', 'true');
    if (preferredProviderId() !== googleSearch) loadProviders();
  });
}

function isBackdrop(event) {
  if (event.target !== dialog) return false;
  const { left, right, top, bottom } = dialog.getBoundingClientRect();
  return event.clientX < left || event.clientX >= right || event.clientY < top || event.clientY >= bottom;
}

let pressedBackdrop = false;
if (typeof dialog.showModal === 'function') initializeLauncher();
dialog.querySelector('.assistant-close').addEventListener('click', () => dialog.close());
dialog.addEventListener('pointerdown', event => { pressedBackdrop = isBackdrop(event); });
dialog.addEventListener('click', event => {
  if (pressedBackdrop && isBackdrop(event)) dialog.close();
  pressedBackdrop = false;
});
dialog.addEventListener('close', () => {
  pressedBackdrop = false;
  cancelRecording();
  if (canSpeak) speechSynthesis.cancel();
  launcher.setAttribute('aria-expanded', 'false');
});
window.addEventListener('pagehide', cancelRecording);
question.addEventListener('input', updateControls);
question.addEventListener('keydown', event => {
  if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
  event.preventDefault();
  if (!sendButton.disabled) form.requestSubmit(sendButton);
});
form.addEventListener('submit', sendQuestion);
recordButton.addEventListener('click', toggleRecording);
