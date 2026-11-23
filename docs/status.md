# SmartBot status

Last updated November 23, 2026.

## Current state

- **Ask SmartBot** opens a compact question bar with mic and send controls at the bottom of the browser app. It supports typed questions and editable voice transcripts through OpenAI or Gemini. Choose the provider under **Settings → Assistant**. SmartBot saves the choice in the browser and reads provider credentials from the local preview server's environment.
- **News** opens directly to up to five headlines. Under **Settings → News**, select English, French, or Vietnamese and any combination of 18 suggested topics. Showbiz & celebrities is one choice and Movies has its own checkbox. The reader shows NASA and Canada.ca articles and Tuổi Trẻ summaries. A star saves the displayed text on the device. The News header opens the saved collection across all topics and languages. Earlier News plan records remain in Progress.
- **Workspace** is the home screen. Its five cards open Books, News, and previews for Languages, Music, and Movies.
- The first mobile-first web slice implements setup, an editable reading plan, the current book and page, completion and undo, and seven-day progress. A service worker caches the app after its initial load, and IndexedDB stores plans and reading progress on the device.
- **Books** imports plain-text files and resumes at the last section. The Android 0.2.0 debug APK includes the reader and a system file picker.
- A debug APK bundles the same web app for Android 8.0 and newer. It loads its packaged files without a local server, and reading progress is stored in the app's WebView.
- Project-local Codex configuration defines five agent roles and two reusable skills. The [setup guide](codex-setup.md) explains how to discover and use them.
- The initial baseline includes the [Git session workflow](codex-setup.md#session-workflow) for documenting, committing, pushing, and verifying each completed step. Parallel writing sessions each use their own branch and worktree or clone. The [SmartBot GitHub repository](https://github.com/trinamntn08/SmartBot) is configured as `origin`.
- The [personal workspace plan](plans/personal-workspace.md) expands the scope to in-app reading, GPT questions by text and voice, and news. The daily plan remains available as part of the workspace.

## Web app verification

Mobile-width Chromium verified live Showbiz & celebrities and Movies headlines in all three languages. A Tuổi Trẻ article opened with cookies blocked, and its starred summary reopened offline. All 15 Node and seven Python tests passed. The Android debug APK built with all 22 web assets matching, passed signature verification, and lint reported zero errors and seven warnings. A device check is pending.

At 320 CSS pixels, Chromium carried an earlier French Sports choice into Settings, persisted a switch to Culture and Tech, and loaded five French headlines from the live feeds. Cached headlines and Settings reopened offline. A starred French article remained readable after changing to English and Sports. All 14 Node and six Python tests passed. The Android debug build, signature, and all 21 bundled assets passed verification. Lint reported zero errors and seven warnings. A phone runtime check remains open.

The revised News reader displayed the six paragraphs of the NOAA Near Earth Orbit Network release in 320-pixel Chromium. A starred copy reopened offline after clearing the feed and recent caches. Removing its star emptied Saved. A second check saved during loading, left the reader, and reopened the downloaded text offline. A French release also opened in the reader. All 11 Node and six Python tests passed.

November 23 News checks covered live updates, article text, feed failures, persisted filters, standalone reads, a five-minute Today slot, completion, and offline reload at a saved book section in 320-pixel Chromium. All 13 Node and six Python tests passed. The Android debug APK built and passed signature and bundled-asset checks. Lint reported zero errors and seven warnings. The pilot phone check is pending.

The compact composer passed Chromium checks at 320 and 1440 CSS pixels in dark and light mode and at 200% text size on the narrow viewport. The checks covered Enter and Shift+Enter, closing and restoring focus, text questions, editable voice transcripts, provider selection in Settings, and draft preservation when the assistant is unavailable. Provider responses and microphone input were simulated. The updated service worker cached the composer, and Books reopened offline. All eight Node tests and four Python API tests passed. The Android debug build and signature passed, all 17 packaged web files matched, and lint reported zero errors and seven warnings.

The provider settings passed a 320-pixel-wide Chromium check with simulated providers. The choice survived a reload and applied to questions and voice transcription. Settings and Books remained accessible offline.

The assistant passed local API tests and a 320-pixel-wide Chromium check with substitute responses from both providers. Checks covered follow-ups, audio transcription, editable drafts, microphone denial, provider usage limits, an unconfigured server, and offline access to Books. Live provider verification is pending.

The Workspace card layout passed Chromium checks from 320 to 1440 CSS pixels in light and dark mode. Keyboard navigation moved focus to each preview heading. The cards and artwork reopened offline, imported books resumed at the saved section, and a reading session completed from Today appeared in Progress. All eight Node tests passed.

Four planner tests passed under Node.js. A Chrome smoke test at 320 CSS pixels covered setup, missing-book recovery, editing, offline resume and completion, duplicate completion in two tabs, skip and undo, date rollover, and saved history. Chrome also passed the desktop width check in dark mode.

The [browser preview](../README.md#browser-preview) uses port 8000 on the local computer. The Windows launcher starts or reuses the server and opens its refresh link in the default browser. The server versions the offline cache from the current web files and the refresh link waits for the new cache to activate. The preview serves the [assistant API](../README.md#ask-smartbot) and web assets on the same origin.

Chromium verified a fresh launch, an update with an older tab and unsent draft still open, a second update after a CSS-only change, and offline reading at the saved section. Windows checks confirmed launcher reuse and one listener on the preview port. All eight Node tests and six Python tests passed. The Android debug build and lint passed with zero lint errors and seven warnings.

Four text import tests covered encoding, line breaks, Unicode section boundaries, and invalid files. A Chrome check at 320 CSS pixels verified import and offline resume alongside the existing reading history.

## Android APK verification

The Workspace debug APK built successfully. Lint reported zero errors and five warnings. The APK signature and all 16 bundled web assets were verified in the cloud environment. Device and emulator verification is pending.

The November 23 Windows rebuild passed `assembleDebug` and `lintDebug` with zero lint errors and seven warnings. The APK signature and all 17 bundled web files matched the fetched branch. No Android device or configured emulator was available for the runtime check.

The 0.2.0 debug build passed in the main checkout. Lint reported zero errors and six warnings. The APK signature and all nine bundled web assets were verified. The machine had no connected Android device or configured emulator for runtime testing. See the [APK verification record](plans/android-apk-preview.md) and the [phone installation steps](../README.md#install-on-android).

## Setup verification

The local Codex app server reported the active project configuration with a three-subagent limit and discovered both project skills. All five role files passed TOML and required-field checks. Named-role selection can be verified when a task calls for delegation. Documentation links and Android ignore patterns passed local checks.

Local validation for the SmartBot rename covered Markdown links and section anchors, all five role files, and both renamed skill files. A fresh Codex app server discovered `$smartbot-deliver-feature` and `$smartbot-review-change` from the SmartBot checkout.

## Handoff

On the pilot phone, check the book picker and offline resume, refresh News, star an article, then reopen it offline. Verify Ask SmartBot against a live provider using the [setup instructions](../README.md#ask-smartbot). The [personal workspace plan](plans/personal-workspace.md) tracks passage context and portability.
