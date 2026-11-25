const sections = [
  { id: 'news', title: 'News', summary: 'Headlines for your interests' },
  { id: 'languages', title: 'Languages', summary: 'French, English, and Japanese', detail: 'Vocabulary decks are in development.' },
  { id: 'music', title: 'Music', summary: 'Find and listen to podcasts' },
  { id: 'movies', title: 'Movies', summary: 'Films and your watchlist', detail: 'Film browsing and watchlists are in development.' },
  { id: 'markets', title: 'Markets', summary: 'Stock and ETF price charts' },
];

export function findSection(route) {
  return sections.find(({ id }) => id === route);
}

function sectionImage(id) {
  return `<div class="section-image section-image--${id}" aria-hidden="true"></div>`;
}

export function workspace() {
  return `<h1 tabindex="-1">Your workspace</h1>
    <a class="feature-card" href="#books">
      <div class="feature-copy">
        <h2>Books</h2>
        <p>Import a PDF or text file and pick up where you left off.</p>
        <span class="feature-action">Open library <span class="arrow" aria-hidden="true"></span></span>
      </div>
      <img src="./assets/books.webp" alt="" width="1536" height="1024">
    </a>
    <ul class="workspace-grid" role="list">${sections.map(({ id, title, summary }) => `
      <li>
        <a class="section-card" href="#${id}">
          ${sectionImage(id)}
          <div class="section-copy">
            <h2>${title}</h2>
            <span class="section-arrow" aria-hidden="true"><span class="arrow"></span></span>
            <p>${summary}</p>
          </div>
        </a>
      </li>`).join('')}
    </ul>`;
}

export function sectionPreview({ id, title, detail }) {
  return `<a class="back-link" href="#workspace"><span class="arrow" aria-hidden="true"></span>Workspace</a>
    <h1 tabindex="-1">${title}</h1>
    <div class="section-preview">
      ${sectionImage(id)}
      <p>${detail}</p>
    </div>`;
}
