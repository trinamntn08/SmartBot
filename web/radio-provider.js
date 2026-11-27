const radioFranceStream = 'https://icecast.radiofrance.fr/';

export const radioStations = [
  { name: 'franceinfo', genre: 'News', url: `${radioFranceStream}franceinfo-midfi.mp3` },
  { name: 'France Inter', genre: 'News and talk', url: `${radioFranceStream}franceinter-midfi.mp3` },
  { name: 'France Culture', genre: 'Culture and ideas', url: `${radioFranceStream}franceculture-midfi.mp3` },
];

export function radioStreamUrl(value) {
  if (typeof value !== 'string' || value.length > 2048) return '';
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) return '';
    url.hash = '';
    return url.href;
  } catch {
    return '';
  }
}
