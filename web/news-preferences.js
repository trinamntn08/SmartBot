export const newsLanguages = [
  { id: 'en', label: 'English' },
  { id: 'fr', label: 'Français' },
  { id: 'vi', label: 'Tiếng Việt' },
];

// Canada.ca subject and department fields are used by the government feed adapter.
export const newsTopics = [
  { id: 'general', label: 'General news' },
  { id: 'culture', label: 'Culture', subject: 'artsandmedia', related: ['showbiz'] },
  { id: 'showbiz', label: 'Showbiz & celebrities' },
  { id: 'movies', label: 'Movies', department: 'nationalfilmboard', related: ['showbiz'] },
  { id: 'tech', label: 'Tech', subject: 'scienceandinnovation' },
  { id: 'startups', label: 'Startups' },
  { id: 'ai', label: 'AI' },
  { id: 'programming', label: 'Programming' },
  { id: 'open-source', label: 'Open source' },
  { id: 'show-hn', label: 'Show HN (English)' },
  { id: 'sports', label: 'Sports', department: 'canadianheritage' },
  { id: 'science', label: 'Science', subject: 'scienceandinnovation' },
  { id: 'space', label: 'Space', department: 'spaceagency' },
  { id: 'environment', label: 'Environment', subject: 'environmentandnaturalresources' },
  { id: 'health', label: 'Health', subject: 'health' },
  { id: 'business', label: 'Business', subject: 'businessandindustry' },
  { id: 'world', label: 'World affairs', subject: 'canadaandtheworld' },
  { id: 'finance', label: 'Money & finance', subject: 'moneyandfinances' },
  { id: 'transport', label: 'Transport', subject: 'transportandinfrastructure' },
  { id: 'jobs', label: 'Jobs', subject: 'jobsandtheworkplace' },
  { id: 'housing', label: 'Housing', department: 'officeinfrastructure' },
  { id: 'agriculture', label: 'Food & agriculture', department: 'agricultureagrifood' },
  { id: 'immigration', label: 'Immigration', subject: 'immigrationandcitizenship' },
];

export function newsPreferences(value) {
  // Earlier versions stored the two dropdown values as singular strings.
  const valid = (choices, multiple, single) => choices.map(choice => choice.id)
    .filter(id => Array.isArray(multiple) ? multiple.includes(id) : single === id);
  const languages = valid(newsLanguages, value?.languages, value?.language);
  const topics = valid(newsTopics, value?.topics, value?.topic);
  return { languages: languages.length ? languages : newsLanguages.map(choice => choice.id), topics };
}
