import { feeds, starterStories } from './news-provider.js';

function read(key) {
  try { return JSON.parse(localStorage.getItem('smartbot-news-' + key)); }
  catch { return null; }
}

function write(key, value) {
  try {
    localStorage.setItem('smartbot-news-' + key, JSON.stringify(value));
    return true;
  } catch { return false; }
}

export const newsRepository = {
  preferences() { return read('filters') ?? { language: '', topic: '' }; },
  savePreferences(value) { return write('filters', value); },
  edition(feed) { return read(feed.id); },
  saveEdition(feed, edition) {
    if (this.edition(feed)?.time > edition.time) return true;
    return write(feed.id, edition);
  },
  stories() {
    return [...feeds.flatMap(feed => this.edition(feed)?.stories ?? []), ...starterStories];
  },
  article(url) { return (read('articles') ?? []).find(item => item.story.url === url); },
  saveArticle(story, body) {
    const others = (read('articles') ?? []).filter(item => item.story.url !== story.url);
    return write('articles', [{ story, body }, ...others.slice(0, 7)]);
  },
};
