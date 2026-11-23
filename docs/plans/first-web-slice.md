# First web implementation slice

Status complete as of November 22, 2026.

## Outcome

Open SmartBot on a phone-sized browser, choose a daily budget, add a book, and finish a reading session. See the result in Today and Progress. After the initial online load, the same device can reopen the app and resume or finish the session offline. This is the first working slice of the [product plan](../product-plan.md).

## Steps and ownership

1. Define the planner and browser repository for a budget, current book, and one saved plan per local date.
2. Connect the minimal setup, Today, Activities, and Progress screens to the same data. Add a service worker for offline loading.
3. Verify planner behavior and the full flow from a phone-width browser.

The primary session owned the implementation and verification as one slice.

## Verification

- `node --test tests/planner.test.mjs` passed four tests for same-date edits, future budgets, duplicate completion, undo, book changes during a session, time zones, and the seven-day history window.
- Chrome passed the end-to-end flow at 320 CSS pixels, including recovery when no book is configured, an edited time estimate, offline reload of a started session, one outcome across two tabs, skip and undo, and offline rollover that retained reading progress. A desktop-width check in dark mode also passed.
- Physical phone and Safari verification are pending.

## Step record

On November 22, 2026, setup, one daily reading plan, and local progress shipped in the repository. The app runs from a static server. Reading outcomes and current page updates share one IndexedDB transaction, so the two tabs tested above recorded a single completion.

## Architecture decision

Accepted November 22, 2026.

### Context

The first working app needs to fit a phone screen and run on the web. The initial interface should stay small while the daily routine becomes usable.

### Decision and alternatives

Start with HTML, CSS, and JavaScript modules. Use an IndexedDB repository and a service worker to support offline browser use. Keep planning rules independent of the DOM and browser storage. The original native Android plan offers access to the launcher widget and remains available if that integration becomes useful.

### Consequences

The app can run on a static server and each browser origin has independent data. The service worker needs HTTPS on a phone, or localhost for development. For static hosting, bump the fallback cache version in `web/sw.js` whenever one of its listed files changes. The Python preview derives its cache version from the web files and the [refresh link](../../README.md#browser-preview) waits for the new cache to activate. Installation, native widgets, and device sync remain separate decisions.

## Handoff

Run the reading workflow on the pilot phone, then add the news provider and vocabulary sessions. Add a versioned export before requesting substantial pilot data entry across devices.
