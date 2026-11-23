const launcher = document.querySelector('.ask-launcher');
const dialog = document.querySelector('#assistant');
const form = dialog.querySelector('form');
const provider = form.elements.provider;
const question = form.elements.question;
const recordButton = form.querySelector('.assistant-record');
const sendButton = form.querySelector('[type="submit"]');
const conversation = dialog.querySelector('.assistant-conversation');
const status = form.querySelector('.assistant-status');
const privacy = form.querySelector('.assistant-privacy');
const canRecord = Boolean(navigator.mediaDevices?.getUserMedia && window.MediaRecorder && window.OfflineAudioContext);
const canSpeak = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
const sampleRate = 16_000;
const maximumSeconds = 45;
const history = [];
let pending = false;
let capture = null;

function setStatus(message, error = false) {
  status.textContent = message;
  status.classList.toggle('is-error', error);
}

function updateControls() {
  const ready = Boolean(provider.value) && !pending;
  question.readOnly = pending || Boolean(capture);
  provider.disabled = pending || Boolean(capture);
  sendButton.disabled = !ready || Boolean(capture) || !question.value.trim();
  recordButton.disabled = !ready || !canRecord || Boolean(capture && !capture.recorder);
  recordButton.textContent = capture?.recorder ? 'Stop and transcribe' : 'Record voice';
}

async function loadProviders() {
  if (pending) return;
  if (location.hostname === 'appassets.androidplatform.net') {
    setStatus('Open SmartBot in a browser with the preview server to use the assistant.');
    return;
  }
  pending = true;
  updateControls();
  setStatus('Checking providers…');
  try {
    const response = await fetch('./api/assistant', { cache: 'no-store' });
    if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) {
      provider.replaceChildren();
      setStatus('Start SmartBot with its Python preview server to connect the assistant.');
      return;
    }
    const { providers } = await response.json();
    const selected = provider.value;
    provider.replaceChildren(...providers.map(({ id, label }) => new Option(label, id)));
    if (providers.some(({ id }) => id === selected)) provider.value = selected;
    if (providers.length) {
      setStatus(canRecord ? '' : 'Voice recording is unavailable here. You can still type a question.');
    } else {
      setStatus('Configure an OpenAI or Gemini API key on the SmartBot server.');
    }
  } catch {
    provider.replaceChildren();
    setStatus('Could not reach the assistant. Check your connection and reopen it.', true);
  } finally {
    pending = false;
    form.querySelector('.assistant-provider').hidden = !provider.value;
    privacy.hidden = !provider.value;
    updateControls();
  }
}

async function request(path, body, contentType) {
  const response = await fetch(`./api/assistant/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': contentType, 'X-SmartBot-Provider': provider.value },
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
  if (!content || pending || capture || !provider.value) return;
  const turn = { role: 'user', content };
  const entry = appendMessage(turn.role, turn.content);
  pending = true;
  updateControls();
  setStatus('Waiting for a reply…');
  try {
    const text = await request('ask', JSON.stringify({ messages: [...history.slice(-12), turn] }), 'application/json');
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
    const text = await request('transcribe', wav, 'audio/wav');
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
  if (pending || capture || !provider.value || !canRecord) return;
  const recording = { chunks: [] };
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
    setStatus('Recording for up to 45 seconds…');
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
form.addEventListener('submit', sendQuestion);
recordButton.addEventListener('click', toggleRecording);
