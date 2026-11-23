export const newsLanguages = [
  { id: 'en', label: 'English' },
  { id: 'fr', label: 'Français' },
];

// Use the publisher's subject feeds or a specialist department for each interest.
export const newsTopics = [
  { id: 'general', label: 'General news' },
  { id: 'culture', label: 'Culture', subject: 'artsandmedia' },
  { id: 'tech', label: 'Tech', subject: 'scienceandinnovation' },
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
  return { languages: languages.length ? languages : newsLanguages.map(item => item.id), topics };
}
