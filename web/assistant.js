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
const setupMessage = 'Configure an OpenAI or Gemini API key on the SmartBot server.';
const unavailableMessage = 'Your saved provider is unavailable. Choose an available provider.';
let sessionPreference = '';
let availableProviders = [];
let providerError = '';
let pending = false;
let capture = null;

function selectedProvider(providers) {
  let preferred = sessionPreference;
  try {
    preferred ||= localStorage.getItem(providerPreferenceKey);
  } catch {
    // The current tab can still use the preference when storage is blocked.
  }
  return preferred ? providers.find(({ id }) => id === preferred) : providers[0];
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
  if (location.hostname === 'appassets.androidplatform.net') {
    throw new Error('Open SmartBot in a browser with the preview server to use the assistant.');
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
      <div class="provider-field" hidden>
        <label for="assistant-provider">Provider</label>
        <select id="assistant-provider" disabled></select>
      </div>
      <p class="settings-status" role="status">Checking providers…</p>
      <p class="settings-privacy" hidden>Your provider receives recent messages when you send a question and recordings when you transcribe.</p>
    </section>`);
  const panel = view.querySelector('.assistant-settings');
  const selector = panel.querySelector('select');
  const message = panel.querySelector('.settings-status');
  try {
    const providers = await fetchProviders();
    if (!providers.length) {
      message.textContent = setupMessage;
      return;
    }
    const selected = selectedProvider(providers);
    const placeholder = new Option('Choose a provider', '');
    placeholder.disabled = true;
    selector.replaceChildren(placeholder, ...providers.map(({ id, label }) => new Option(label, id)));
    selector.value = selected?.id ?? '';
    selector.disabled = false;
    selector.closest('.provider-field').hidden = false;
    panel.querySelector('.settings-privacy').hidden = false;
    message.textContent = selected ? '' : unavailableMessage;
    selector.addEventListener('change', () => {
      message.textContent = saveProvider(selector.value) ? 'Provider saved.' : 'Provider selected for this tab.';
    });
  } catch (error) {
    message.textContent = error.message;
  }
}

function setStatus(message, error = false) {
  status.textContent = message;
  status.classList.toggle('is-error', error);
}

function updateControls() {
  const recording = Boolean(capture?.recorder);
  const recordLabel = recording ? 'Stop and transcribe' : 'Record voice';
  question.readOnly = pending || Boolean(capture);
  sendButton.disabled = question.readOnly || !question.value.trim();
  recordButton.disabled = pending || !canRecord || Boolean(capture && !recording);
  recordButton.classList.toggle('is-recording', recording);
  recordButton.setAttribute('aria-label', recordLabel);
  recordButton.title = recordLabel;
}

async function loadProviders() {
  if (pending) return;
  pending = true;
  setStatus('');
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
  const provider = selectedProvider(availableProviders);
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
    conversation.hidden = !conversation.childElementCount;
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
  if (pending || capture || !canRecord) return;
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

if (typeof dialog.showModal === 'function') {
  launcher.hidden = false;
  document.body.classList.add('has-assistant');
}
recordButton.hidden = !canRecord;
launcher.addEventListener('click', () => {
  dialog.showModal();
  launcher.setAttribute('aria-expanded', 'true');
  loadProviders();
});
dialog.querySelector('.assistant-close').addEventListener('click', () => dialog.close());
dialog.addEventListener('close', () => {
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
