const techInterests = ['startups', 'ai', 'programming', 'open-source'];
const publishers = [
  ['hacker-news', 'Hacker News', 'en', 'tech', 'news.ycombinator.com', [...techInterests, 'show-hn']],
  ['show-hn', 'Show HN', 'en', 'show-hn', 'news.ycombinator.com', ['tech', ...techInterests]],
  ['yc-blog', 'Y Combinator', 'en', 'startups', 'www.ycombinator.com', ['ai', 'programming']],
  ['ars-technica', 'Ars Technica', 'en', 'tech', 'arstechnica.com', techInterests],
  ['next-ink', 'Next', 'fr', 'tech', 'next.ink', techInterests],
  ['le-monde-pixels', 'Le Monde · Pixels', 'fr', 'tech', 'www.lemonde.fr', techInterests],
  ['le-monde-economy', 'Le Monde · Économie', 'fr', 'business', 'www.lemonde.fr', ['startups', 'finance']],
  ['dan-tri-tech', 'Dân trí', 'vi', 'tech', 'dantri.com.vn', techInterests],
  ['dan-tri-business', 'Dân trí', 'vi', 'business', 'dantri.com.vn', ['startups', 'finance']],
  ['vnexpress-tech', 'VnExpress International', 'en', 'tech', 'e.vnexpress.net', techInterests],
  ['bizhub-startups', 'Viet Nam News · BizHub', 'en', 'startups', 'bizhub.vietnamnews.vn', ['ai', 'programming']],
];

export const rssFeeds = publishers.map(([id, source, language, topic, host, related]) => ({
  id, source, language, topic, host, related, provider: 'rss',
}));

const topicWords = {
  startups: /\b(?:start[- ]?ups?|founders?|venture capital|seed round|lev[ée]e de fonds|capital[- ]risque|jeunes? pousses?)\b|khởi nghiệp|gọi vốn|nhà sáng lập|vốn mạo hiểm/iu,
  ai: /\b(?:llms?|artificial intelligence|intelligence artificielle|machine learning|chatgpt|claude|gemini|deepseek)\b|trí tuệ nhân tạo/iu,
  programming: /\b(?:programming|programmation|developers?|d[ée]veloppeu[rs]\w*|javascript|python|rust|typescript|postgres(?:ql)?|compiler|code editor|api|sdk|linux kernel)\b|lập trình|mã nguồn/iu,
  'open-source': /\b(?:open[- ]source|logiciels? libres?|linux|github|gitlab|kernel)\b|mã nguồn mở/iu,
  finance: /\b(?:finance|financier\w*|banques?|bourse|inflation|taux d['’]int[ée]r[êe]t)\b|tài chính|ngân hàng|chứng khoán|lãi suất/iu,
  'show-hn': /^show hn:/iu,
};

export function rssStory(feed, { title, link, comments, published, categories = [], description = '' }) {
  const discussion = feed.host === 'news.ycombinator.com';
  let url;
  try { url = new URL(discussion ? comments || link : link); }
  catch { return null; }
  const time = Date.parse(published);
  if (!title?.trim() || !Number.isFinite(time) || url.origin !== 'https://' + feed.host
      || url.username || url.password || url.pathname === '/') return null;
  if (discussion && (url.pathname !== '/item' || !/^\?id=\d+$/.test(url.search))) return null;
  url.hash = '';
  const text = [title, ...categories, description].join(' ').normalize('NFC');
  // Vietnamese "ai" and French "ai" are common words. Match the uppercase acronyms.
  const ai = /\b(?:AI|IA)\b/u.test(text) || categories.some(category => /^(?:ai|ia)$/i.test(category.trim()));
  const topics = [feed.topic, ...feed.related.filter(topic => topic === 'tech'
    || (topic === 'ai' && ai) || topicWords[topic].test(text))];
  return {
    title: title.trim(), url: url.href, date: new Date(time).toISOString(), source: feed.source,
    language: feed.language, topic: feed.topic, topics, linkKind: discussion ? 'discussion' : 'publisher',
  };
}

export async function fetchPublisherFeed(feed, options) {
  const response = await fetch('./api/news/' + feed.id, options);
  if (!response.ok) throw new Error('Feed unavailable');
  const xml = new DOMParser().parseFromString(await response.text(), 'application/xml');
  const snippet = document.createElement('template');
  const stories = Array.from(xml.querySelectorAll('rss > channel > item'), item => {
    const field = name => item.querySelector(name)?.textContent.trim() ?? '';
    // Feed descriptions help classify stories. Only the headline and link are kept.
    snippet.innerHTML = field('description');
    return rssStory(feed, { title: field('title'), link: field('link'), comments: field('comments'),
      published: field('pubDate'), categories: [...item.querySelectorAll('category')].map(node => node.textContent),
      description: snippet.content.textContent });
  }).filter(Boolean);
  if (!stories.length) throw new Error('Empty feed');
  return stories.slice(0, 50);
}
