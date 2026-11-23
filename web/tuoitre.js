// Each publisher section is downloaded once even when several interests use it.
const sections = [
  ['home', 'general', ['transport', 'environment', 'housing', 'jobs', 'immigration', 'agriculture']],
  ['the-thao', 'sports'],
  ['van-hoa', 'culture'],
  ['giai-tri', 'showbiz', ['movies']],
  ['nhip-song-so', 'tech'],
  ['khoa-hoc', 'science', ['space', 'environment']],
  ['suc-khoe', 'health'],
  ['kinh-doanh', 'business', ['finance', 'jobs', 'housing', 'agriculture']],
  ['the-gioi', 'world', ['immigration']],
];

export const tuoitreFeeds = sections.map(([section, topic, related = []]) => ({
  id: 'tuoitre-' + section, section, topic, related, language: 'vi',
}));

const topicWords = {
  movies: /điện ảnh|phim|phòng vé|liên hoan phim/iu,
  transport: /giao thông|đường sắt|sân bay|cao tốc|vận tải|tàu điện/iu,
  environment: /môi trường|khí hậu|ô nhiễm|sinh thái|rác thải/iu,
  space: /vũ trụ|vệ tinh|thiên văn|hành tinh|mặt trăng|sao hỏa/iu,
  housing: /nhà ở|nhà đất|chung cư|bất động sản/iu,
  jobs: /việc làm|tuyển dụng|lao động/iu,
  immigration: /nhập cư|di cư|tị nạn|thị thực/iu,
  agriculture: /nông nghiệp|nông sản|thực phẩm|nông dân|thủy sản/iu,
  finance: /tài chính|ngân hàng|chứng khoán|lãi suất|tỉ giá|tỷ giá|cổ phiếu/iu,
};

function publishedDate(value) {
  // The publisher dates its releases in Vietnamese local time, without a zone.
  const local = /^(\d{1,2})\/(\d{1,2})\/(\d{4}) (\d{1,2}):(\d\d):(\d\d)\s*([AP]M)$/i.exec(value);
  if (!local && !/(?:GMT|UTC|[+-]\d{2}:?\d{2}|Z)$/i.test(value)) return null;
  let stamp = value;
  if (local) {
    const [, month, day, year, hour, minute, second, period] = local;
    const h = Number(hour) % 12 + (period.toUpperCase() === 'PM' ? 12 : 0);
    stamp = year + '-' + month.padStart(2, '0') + '-' + day.padStart(2, '0') + 'T'
      + String(h).padStart(2, '0') + ':' + minute + ':' + second + '+07:00';
  }
  const time = Date.parse(stamp);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

export function isTuoitreStory(url) {
  return /^https:\/\/tuoitre\.vn\/[a-z0-9-]+-\d+\.htm$/.test(url);
}

export function tuoitreStory(feed, { title, url, summary, published }) {
  if (!title || !isTuoitreStory(url)) return null;
  const date = publishedDate(published);
  if (!date) return null;
  const text = title + ' ' + summary;
  const topics = [feed.topic, ...feed.related.filter(topic => topicWords[topic].test(text))];
  return { title, url, date, source: 'Tuổi Trẻ', language: 'vi', topic: feed.topic, topics, summary };
}

export async function fetchTuoitre(feed, options) {
  const response = await fetch('./api/tuoitre/' + feed.section, options);
  if (!response.ok) throw new Error('Feed unavailable');
  const xml = new DOMParser().parseFromString(await response.text(), 'application/xml');
  if (!xml.querySelector('rss > channel')) throw new Error('Invalid feed');
  return Array.from(xml.querySelectorAll('channel > item'), item => {
    const field = name => item.querySelector(name)?.textContent.trim() ?? '';
    return tuoitreStory(feed, { title: field('title'), url: field('link'),
      published: field('pubDate'), summary: field('description') });
  }).filter(Boolean);
}
