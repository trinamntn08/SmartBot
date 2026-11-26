const sections = [
  { id: 'news', title: 'News', subtitle: 'Coffee and headlines.' },
  { id: 'languages', title: 'Languages', subtitle: 'Say that again?', detail: 'Vocabulary decks are in development.' },
  { id: 'music', title: 'Music', subtitle: 'Podcasts on dish duty.' },
  { id: 'movies', title: 'Movies', subtitle: 'Pass the popcorn.', detail: 'Film browsing and watchlists are in development.' },
  { id: 'markets', title: 'Markets', subtitle: 'Charts with plot twists.' },
];

export function findSection(route) {
  return sections.find(({ id }) => id === route);
}

function sectionImage(id) {
  return `<div class="section-image section-image--${id}" aria-hidden="true"></div>`;
}

export function workspace() {
  return `<h1 class="visually-hidden">Workspace</h1>
    <a class="feature-card" href="#books">
      <div class="feature-copy">
        <h2 class="feature-title">Books</h2>
        <p>Just one more chapter.</p>
      </div>
      <img src="./assets/books.webp" alt="" width="1536" height="1024">
    </a>
    <ul class="workspace-grid" role="list">${sections.map(({ id, title, subtitle }) => `
      <li>
        <a class="section-card" href="#${id}">
          ${sectionImage(id)}
          <div class="section-copy">
            <h2>${title}</h2>
            <p>${subtitle}</p>
            <span class="section-arrow" aria-hidden="true"><span class="arrow"></span></span>
          </div>
        </a>
      </li>`).join('')}
    </ul>`;
}

export function sectionPreview({ id, title, detail }) {
  return `<h1 tabindex="-1">${title}</h1>
    <div class="section-preview">
      ${sectionImage(id)}
      <p>${detail}</p>
    </div>`;
}
