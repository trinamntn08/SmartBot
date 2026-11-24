const bridge = globalThis.SmartBotPodcasts;
export const hasNativePodcastPlayer = Boolean(bridge);
let sequence = 0;
const pending = new Map();

if (bridge) {
  bridge.onmessage = event => {
    const { requestId, value, error } = JSON.parse(event.data);
    const request = pending.get(requestId);
    if (!request) return;
    clearTimeout(request.timeout);
    pending.delete(requestId);
    if (error) request.reject(new Error(error));
    else request.resolve(value);
  };
}

export function nativePodcast(action, data = {}) {
  return new Promise((resolve, reject) => {
    if (!bridge) return reject(new Error('Android podcast playback is unavailable.'));
    const requestId = ++sequence;
    const timeout = setTimeout(() => {
      pending.delete(requestId);
      reject(new Error('The Android player did not respond. Try again.'));
    }, 5000);
    pending.set(requestId, { resolve, reject, timeout });
    try {
      bridge.postMessage(JSON.stringify({ ...data, requestId, action }));
    } catch (error) {
      clearTimeout(timeout);
      pending.delete(requestId);
      reject(error);
    }
  });
}
