import { radioStations, radioStreamUrl } from './radio-provider.js';

const key = 'smartbot-radio-stations';
const presetUrls = new Set(radioStations.map(station => station.url));
let sessionSettings;

export const radioRepository = {
  read() {
    if (sessionSettings) return sessionSettings;
    try {
      const stored = JSON.parse(localStorage.getItem(key));
      const custom = Array.isArray(stored) ? stored : stored?.custom;
      const stations = new Map();
      for (const station of Array.isArray(custom) ? custom : []) {
        const name = typeof station?.name === 'string' ? station.name.trim().slice(0, 100) : '';
        const url = radioStreamUrl(station?.url);
        if (name && url && !presetUrls.has(url)) stations.set(url, { name, url });
      }
      const hidden = Array.isArray(stored?.hidden) ? stored.hidden.filter(url => presetUrls.has(url)) : [];
      return { custom: [...stations.values()], hidden };
    } catch {
      return { custom: [], hidden: [] };
    }
  },
  save(settings) {
    try {
      localStorage.setItem(key, JSON.stringify(settings));
      sessionSettings = undefined;
      return true;
    } catch {
      sessionSettings = settings;
      return false;
    }
  },
};
