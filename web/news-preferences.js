export const newsLanguages = [
  { id: 'en', label: 'English' },
  { id: 'fr', label: 'Français' },
  { id: 'vi', label: 'Tiếng Việt' },
];

export const newsTopics = [
  { id: 'general', label: 'General news' },
  { id: 'culture', label: 'Culture' },
  { id: 'showbiz', label: 'Showbiz & celebrities' },
  { id: 'movies', label: 'Movies' },
  { id: 'tech', label: 'Tech' },
  { id: 'startups', label: 'Startups' },
  { id: 'ai', label: 'AI' },
  { id: 'programming', label: 'Programming' },
  { id: 'open-source', label: 'Open source' },
  { id: 'show-hn', label: 'Show HN (English)' },
  { id: 'sports', label: 'Sports' },
  { id: 'science', label: 'Science' },
  { id: 'space', label: 'Space' },
  { id: 'environment', label: 'Environment' },
  { id: 'health', label: 'Health' },
  { id: 'business', label: 'Business' },
  { id: 'world', label: 'World affairs' },
  { id: 'finance', label: 'Money & finance' },
  { id: 'transport', label: 'Transport' },
  { id: 'jobs', label: 'Jobs' },
  { id: 'housing', label: 'Housing' },
  { id: 'agriculture', label: 'Food & agriculture' },
  { id: 'immigration', label: 'Immigration' },
];

export const myNewsTopics = 'my-topics';

export function newsBrowseTopic(value, { topics }) {
  if (value === '' || newsTopics.some(topic => topic.id === value)) return value;
  return topics.length ? myNewsTopics : '';
}

export function newsEditionPreferences(preferences, topic) {
  const topics = topic === myNewsTopics ? preferences.topics : topic ? [topic] : [];
  return { ...preferences, topics };
}

export function newsPreferences(value) {
  // Earlier versions stored the two dropdown values as singular strings.
  const valid = (choices, multiple, single) => choices.map(choice => choice.id)
    .filter(id => Array.isArray(multiple) ? multiple.includes(id) : single === id);
  const languages = valid(newsLanguages, value?.languages, value?.language);
  const topics = valid(newsTopics, value?.topics, value?.topic);
  return { languages: languages.length ? languages : newsLanguages.map(choice => choice.id), topics };
}
