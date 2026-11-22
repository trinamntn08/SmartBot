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

## Handoff

The plain-text reader is ready for a phone check. The assistant endpoint and optional book passage context are the next implementation step, followed by voice input and news.
