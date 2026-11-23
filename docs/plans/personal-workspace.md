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

## Handoff

The News slice is ready for a phone check alongside the plain-text reader. Verify the assistant with a configured provider, then add optional book passage context and local export and restore.
