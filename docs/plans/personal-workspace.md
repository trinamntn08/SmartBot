# Personal workspace implementation plan

In progress as of November 22, 2026.

## Outcome

Open SmartBot to read a book or the news, ask a general question, or ask about a passage by typing or speaking. Keep a saved reading position and the existing daily plan. Use the same web interface in the desktop browser and Android package. See the [product plan](../product-plan.md).

## Steps and ownership

1. **In-app reader.** Import a plain-text book into device storage. Open it from the library or Today, move through the book, and reopen at the saved section. Preserve existing entries for paper books and reading history.
2. **Text questions.** Add a server endpoint for the OpenAI API. Let the user ask a standalone question or attach a chosen passage. Keep API credentials on the server and make it clear what will be sent.
3. **Voice questions and playback.** Add recording, transcription, and a chance to edit before sending. Display the answer as text and make spoken playback available. Verify permission handling in a browser and the Android package.
4. **News.** Add a list of fresh headlines, attribution, and reading inside the app where publisher rights allow it. Cache permitted information and describe when it was fetched.
5. **Personal data portability.** Export and restore local routines, reading progress, and user-created content before expanding the app to more personal workflows.

## Verification

- Import from a normal file picker, reopen offline, and verify the library and position survive a browser reload and an Android app restart. Verify reading history created before import remains available.
- Test a general question, a question with a selected excerpt, and an unavailable assistant. Check that requests contain the question and chosen context while the client never receives the service API key.
- Test microphone permission approved and denied, transcript edits, text fallback, and playback on the pilot phone.
- Exercise a broken or unavailable feed without affecting offline reading or saved progress.

## Step records

November 22, 2026. The product plan now treats reading, questions, and news as tools that can open directly, with Today available for planning. The existing reading log, browser preview, and Android package remain the baseline. Local documentation links and section anchors passed validation. The reader is the first implementation step.

November 22, 2026. **Books** now imports `.txt` files, displays their contents in sections, and remembers the last section. Books are available before routine setup. A separate IndexedDB database stores the library, so routine records keep their existing schema. The Android 0.2.0 build adds the system document picker.

Eight Node tests passed. A 320-pixel-wide Chrome test verified standalone Books, invalid-file recovery, text and line breaks, offline resume, and access to a saved reading log after importing a book. The Android debug build, lint, signature, and packaged asset checks passed. The Android file picker and offline resume still need verification on a phone.

November 23, 2026. **Ask SmartBot** opens from the bottom of the browser app. The local Python preview serves both the frontend and the assistant API. It uses server-side OpenAI or Gemini credentials and returns provider labels to the browser. The browser records up to 45 seconds, transcribes through the selected provider, and lets the user edit the transcript before sending. Follow-up questions include recent turns from the current page session.

Eight Node tests and four local API tests passed. Chromium at 320 CSS pixels checked both providers with substitute responses, recorded audio, transcript review, follow-ups, permission denial, usage-limit recovery, and offline access to Books. The Android debug build and lint passed. Live provider calls require a configured key and outbound access. Book passage context and a hosted assistant for the bundled Android app are pending.

November 23, 2026. **News** now opens from Workspace before routine setup. Both clients fetch the same publisher feeds over HTTPS without credentials. The browser and Android package keep language and topic choices, dated feed snapshots, and the eight most recently opened story records locally. Canadian release excerpts use plain text with author attribution and a link to the full release. Each Today item keeps its own headline snapshot. Read and undo actions update progress transactionally with the plan.

The pilot uses the [Government of Canada news feeds](https://www.canada.ca/en/news/subscribe-emails.html), [Canada.ca non-commercial reproduction terms](https://www.canada.ca/en/transparency/terms.html), and [NASA news releases](https://www.nasa.gov/rss-feeds/). Sports currently covers Canadian Heritage releases. The proposed rugby source needs linking permission before integration. [FFR site terms](https://api.www.ffr.fr/wp-content/uploads/2020/12/Sites-FFR_CGU_FR-2.pdf)

All 13 Node and six Python tests passed. Mobile-sized Chromium loaded five live articles with cookies disabled and no sign-in or consent interaction. Flow checks covered switching filters, reading excerpts, a feed outage, cold-start starter links, independent read history, completion and undo controls, and the saved book section after an offline reload. The 320-pixel view also passed a horizontal overflow check at 200% text size. The Android debug build and lint passed with zero errors and seven warnings. Signature verification passed and all 20 packaged web assets matched. No phone or configured emulator was available to exercise the publisher handoff.

November 23, 2026. **In-app articles and stars.** The reader loads NASA's published article text from its public WordPress API, including the [NOAA contract release](https://www.nasa.gov/news-release/nasa-awards-contract-for-noaas-near-earth-orbit-network-program/). Canadian releases include the narrative and available quotations and facts. The publisher link is in the byline. Existing cached excerpts remain readable offline and upgrade on the next connected visit. An icon-only star saves the article to IndexedDB separately from the recent cache. New stories open independently of the daily planner. Earlier News history remains available in Progress.

Chromium verified the requested NASA article at phone width, a French article, the saved collection, offline reopening after clearing the recent cache, and removal. A delayed response also filled a starred copy after leaving the reader. All 11 Node and six Python tests passed. The debug APK built, its signature and all 20 bundled assets verified, and Android lint reported zero errors and seven warnings. Runtime verification on the pilot phone is pending.

November 23, 2026. **News preferences.** Settings now holds English and French language choices and 16 suggested topics. Existing language and topic choices carry forward. Each selected interest uses a Canada.ca subject or department feed, with additional matching for Sports, Tech, and Housing. NASA also supplies relevant English headlines. All topics uses the broad release feeds. The News screen opens directly to the shortlist.

At 320 CSS pixels Chromium verified preference migration, automatic saving, five live French headlines for Culture and Tech, offline preference changes, cached headlines, and a saved article outside the new selection. All 14 Node and six Python tests passed. Android debug build, signature, and 21 bundled asset checks passed. Lint reported zero errors and seven warnings. Device testing remains pending.

November 23, 2026. **Vietnamese and entertainment news.** Settings offers Tiếng Việt, a combined Showbiz & celebrities topic, and a separate Movies topic. Tuổi Trẻ supplies attributed headlines and summaries for personal RSS readers. Vietnamese sections are fetched by the local preview or the APK, with full stories at the publisher. English and French entertainment headlines draw on Canadian arts and National Film Board releases. Existing language choices carry forward. [Tuổi Trẻ feed terms](https://tuoitre.vn/rss.htm)

At 320 CSS pixels Chromium loaded five headlines for each entertainment choice in each language, opened a Vietnamese article with cookies blocked, and reopened its starred summary offline. All 15 Node and seven Python tests passed. Android debug build, signature, and 22 bundled asset checks passed. Lint reported zero errors and seven warnings. Android publisher handoff still needs a device check.

November 23, 2026. **Full Vietnamese originals and longer editions.** Online Tuổi Trẻ headlines open the original with photos in one tap. The publisher’s feed supplies summaries and its article page restricts framing to its own origin. SmartBot keeps a star next to the headline and opens its cached summary offline. Android requests a browser Custom Tab for the original. News displays ten stories and appends batches of ten from the current edition. An expanded edition survives browser Back. [Tuổi Trẻ RSS](https://tuoitre.vn/rss.htm)

Mobile-width Chromium verified 50 distinct Culture headlines, 17 paragraphs and two images on the reported digital passport article, return navigation, and offline reading and pagination. All 22 automated tests passed. The Android debug build, signature and lint checks passed with seven existing lint warnings. A physical Android reading check is pending.

### Regional technology and startup news

November 24, 2026. **Outcome.** News mixes 11 additional feeds from the US, France, and Vietnam with its existing sources. The [News requirements](../product-plan.md#news) guide the mix of Hacker News discussions, projects from Show HN, and regional technology and business reporting. Settings adds Startups, AI, Programming, Open source, and Show HN. Readers without a saved language choice start with English, French, and Vietnamese.

**Implementation.** The browser preview and Android package use the same feed allowlist. The RSS adapter uses headlines, publisher categories, and descriptions to match interests. It stores the headline and attribution for bookmarks. Original articles and Hacker News discussions open online. When available, the first page includes a recent headline from the added feeds in each selected language. Existing preferences and saved articles use their original records. [Feed allowlist](../../web/news-feeds.json)

**Verification.** All 11 live feeds returned usable headlines. At 320 CSS pixels, Chromium showed all three languages on the first page, loaded 20 distinct headlines with More, preserved a Show HN selection after reload, opened a discussion, and reopened a starred headline offline. The live French AI filter returned ten first-page results, and Vietnamese Startups returned four. A simulated publisher failure preserved the cached edition. All 22 Node and eight Python tests passed. The Android debug build and signature passed, all 224 bundled web assets matched, and lint reported zero errors and nine warnings.

### Free-to-read News

November 24, 2026. The Le Monde Économie feed included an article the publisher marked subscriber-only. Next offers both free and paid articles. Ars Technica's privacy prompt blocked reading during the cookie-free check, and VnExpress International repeatedly reloaded or timed out with cookies blocked. These sources left current editions. SmartBot keeps their previously saved headlines in Saved, where they open locally and can still be unstarred. [Le Monde subscriber-only sample](https://www.lemonde.fr/economie/article/2026/11/24/la-commission-europeenne-se-montre-indulgente-sur-la-situation-budgetaire-francaise_6814840_3234.html) · [Next subscription terms](https://next.ink/subs/)

LinuxFr.org's dispatches and journals supply community and open-source coverage. ActuIA supplies AI reporting, and La French Tech supplies occasional official startup updates. The GitHub Blog supplies US developer and open-source stories. The English-language BizHub technology and startup feeds cover Vietnam. Recent samples reached article content below the first screen in a mobile Chromium session that blocked cookies and used no account. Dân trí, Tuổi Trẻ, Y Combinator, and Hacker News samples also opened. [LinuxFr.org dispatch](https://linuxfr.org/news/luneos-en-2026) · [LinuxFr.org journal](https://linuxfr.org/users/megagolgoth/journaux/coreboot-premiere-approche) · [ActuIA sample](https://www.actuia.com/actualite/a-choose-france-les-3-milliards-de-centres-de-donnees-datent-de-juillet/) · [La French Tech sample](https://lafrenchtech.gouv.fr/fr/la-french-tech-moteur-de-souverainete/) · [GitHub Blog sample](https://github.blog/open-source/maintainers/the-best-things-in-open-source-are-built-together/) · [BizHub sample](https://bizhub.vietnamnews.vn/businesses-rethink-strategies-as-ai-empowers-consumers-post419180.html)

The product plan, agent instructions, and delivery and review skills now require checking the actual article links for access without payment, sign-in, or optional cookie consent. [Source verification procedure](../product-plan.md#verify-news-sources)

At 320 CSS pixels Chromium verified the Tech filter with French selected, More, a LinuxFr.org publisher handoff, and a previously saved Le Monde headline online and after an offline reload. All 12 active publisher feeds returned usable stories. All 23 Node tests, eight Python tests, both skill validators, and the agent TOML checks passed. The Android debug APK built and passed signature and 224 bundled asset checks. Lint reported zero errors and nine warnings. Phone testing is pending.

### News recommendations

November 24, 2026. News starts with the freshness-based edition. After an article opens, **For you** ranks related unread headlines within the reader's selected languages and topics. Choosing All topics also refreshes existing feeds for up to two learned interests. The first page keeps its language and topic mix. [News requirements](../product-plan.md#news)

The local News repository remembers up to 120 distinct article opens from the past 90 days. Interests fade over time, and the ranking boost is capped. Turning personalization off pauses collection and ranking. Reset clears the learning history while keeping language and topic selections, saved articles, and routine progress.

Chromium at 320 CSS pixels verified the fresh edition, two publisher opens, an in-app read, a related story moving above the newest headline, More across Back, and offline reopening. Keyboard opt-out restored the freshness-based order, and resetting cleared activity without changing settings. The recommendation controls were checked at 320 and 1280 CSS pixels. All 26 Node and eight Python tests passed. The Android debug APK built, its signature and 224 bundled assets matched, and lint reported zero errors and nine warnings.

### Retire Canada.ca feeds

November 24, 2026. Current editions, starter headlines, and recommendation signals exclude Government of Canada releases. Previously saved releases retain their source links and downloaded text. Existing language and topic choices carry forward, with coverage drawn from the remaining feeds.

At 320 CSS pixels, Chromium loaded 20 live headlines through More without a Canada.ca request, even with a retired feed snapshot and reading signal in local storage. A previously saved release opened with a controlled publisher response and reopened offline. All 29 Node and eight Python tests passed. The Android debug APK passed signature and 228 bundled asset checks. Lint reported zero errors and nine warnings. Phone testing is pending.

### Refresh the News edition

November 26, 2026. Refresh requests the selected feeds directly and updates the header to the latest successful refresh time. If a source fails, its cached headlines stay available without a feed warning. If every source fails, the last successful time stays visible. The bundled starter headlines have no refresh timestamp.

All 31 Node and 12 Python tests passed. At 320 CSS pixels, Chromium received 15 live feed responses and displayed ten headlines after Refresh. A controlled check reproduced the November 24 timestamp, advanced it to November 26 when one feed succeeded, and kept the latest successful time during a complete failure and an offline reload. Physical phone verification is pending.

### Browse News by topic

November 26, 2026. The News header shows the main sections and an expandable **More topics** list. **All** requests every existing feed in the selected languages. The **My topics** section keeps saved interests available, and the last chosen section reopens on return. Topic changes start a new list, and Refresh updates that list's feeds.

All 27 web and 12 Python tests passed. At 320 CSS pixels, Chromium verified touch and keyboard topic selection, pagination, Refresh, saved articles, Settings interests, and offline reopening. The main sections fit in two rows, and the expanded topics fit without horizontal overflow at 200% text size. A live refresh received 22 feed responses, and the 1280-pixel preview displayed live Tuổi Trẻ Sports headlines. Physical phone verification is pending.

### Combine the News topic menus

November 26, 2026. One three-dot button beside **Science** opens the additional topics and **Saved interests**. An active choice from the menu appears next to the update time. The selected topic and saved interests carry forward.

All 27 web and 12 Python tests passed. Chromium at 320 and 1280 CSS pixels verified the icon beside **Science**, the combined list, selection from earlier saved preferences, keyboard dismissal, filtering, and offline reopening. The icon stayed beside **Science** at 200% text size on the narrow viewport. Physical phone verification is pending.

### Refine the News topic bar

November 26, 2026. Topic buttons follow the width of their labels so **All**, **World**, and the other sections use the same gap. **Saved interests** appears in the three-dot menu, and the line below the bar shows the update time when it is selected.

Web and Python tests passed. Browser verification is pending.

## Handoff

Check the new publisher links and Hacker News discussions on an Android phone alongside the plain-text reader. Verify the assistant with a configured provider, then add optional book passage context and local export and restore.
