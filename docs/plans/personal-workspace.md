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

## Handoff

The News slice is ready for a phone check alongside the plain-text reader. Verify the assistant with a configured provider, then add optional book passage context and local export and restore.
