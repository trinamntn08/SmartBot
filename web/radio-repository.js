import { radioStreamUrl } from './radio-provider.js';

const key = 'smartbot-radio-stations';
let sessionStations;

export const radioRepository = {
  read() {
    if (sessionStations) return sessionStations;
    try {
      const stored = JSON.parse(localStorage.getItem(key));
      if (!Array.isArray(stored)) return [];
      const stations = new Map();
      for (const station of stored) {
        const name = typeof station?.name === 'string' ? station.name.trim().slice(0, 100) : '';
        const url = radioStreamUrl(station?.url);
        if (name && url) stations.set(url, { name, url });
      }
      return [...stations.values()];
    } catch {
      return [];
    }
  },
  save(stations) {
    try {
      localStorage.setItem(key, JSON.stringify(stations));
      sessionStations = undefined;
      return true;
    } catch {
      sessionStations = stations;
      return false;
    }
  },
};
