# SmartBot status

Last updated November 25, 2026.

## Current state

- **Today** shows recorded activity time, pages read, and listening time by activity and topic. The app tracks foreground Books and News use, source pages in newly converted PDFs, and podcast playback. Use **Log activity** for music, paper books, and other activities, or **Reading plan** to start or edit the routine. [Today activity report](plans/today-activity.md)
- **Ask SmartBot** opens a compact question bar with mic and send controls at the bottom of the browser app. It supports typed questions and editable voice transcripts through OpenAI or Gemini. Choose the provider under **Settings → Assistant**. SmartBot saves the choice in the browser and reads provider credentials from the local preview server's environment.
- **News** opens to ten matching headlines from free-to-read sources, with more stories in batches of ten. **For you** uses recent article opens on the device to surface related, unread stories. **Settings → News** saves English, French, and Vietnamese language choices and topics, and offers controls to turn personalization off or reset it. NASA releases open in SmartBot. The header star opens Saved, including any previously saved Canada.ca releases. Earlier News plan records remain in Progress.
- **Workspace** is the home screen. Its cards open Books, News, Music, Markets, and previews for Languages and Movies. **Music** opens podcast search, RSS import, and one suggested show. Followed shows and resuming playback appear when available. See the [podcast pilot setup](plans/podcast-listening.md).
- **Markets** occupies one standard Workspace card. A dark quote panel shows the latest close, daily change, six chart ranges, and a range summary for eight U.S. stocks and ETFs. Inspect individual prices by touch or keyboard. The app includes closing prices through November 24, 2026, and checks the public S&P 500 archive for updates. The most recent available history stays on the device for offline use. [Markets](../README.md#markets)
- The first mobile-first web slice implements setup, an editable reading plan, the current book and page, completion and undo, and seven-day progress. A service worker caches the app after its initial load, and IndexedDB stores plans and reading progress on the device.
- **Books** imports text and PDF files, resumes at the last section, and can convert selectable PDF text to EPUB. An open book shows its title, text, and reading navigation. PDF and EPUB downloads are available under **Download files** in the library. **Back to Workspace** in the library and **SmartBot** in the app header return to the homepage.
- A debug APK bundles the same web app for Android 8.0 and newer. It loads its packaged files without a local server, and reading progress is stored in the app's WebView.
- Project-local Codex configuration defines five agent roles and two SmartBot workflows. The [design skill setup](codex-setup.md#design-skills) also installs pinned releases of Taste, Emil Kowalski's motion guidance, and Impeccable into the checkout.
- The initial baseline includes the [Git session workflow](codex-setup.md#session-workflow) for documenting, committing, pushing, and verifying each completed step. Parallel writing sessions each use their own branch and worktree or clone. The [SmartBot GitHub repository](https://github.com/trinamntn08/SmartBot) is configured as `origin`.
- The [personal workspace plan](plans/personal-workspace.md) expands the scope to in-app reading, GPT questions by text and voice, and news. The daily plan remains available as part of the workspace.

## Web app verification

A phone screenshot showed missing NVIDIA prices after the switch to the DoltHub feed. Markets now ships 277 daily closes for each of its eight tickers and refreshes via bounded byte ranges from a public archive. Mobile-width Chromium fetched all eight histories from the live archive and matched every close to the bundled data. A fresh profile with the archive blocked displayed all eight charts offline, including a full year of NVIDIA closes. The November 24 NVIDIA close was $155.38, down $9.67 (5.86%). All 24 Node tests and 10 Python tests passed. [S&P 500 data archive](https://github.com/Johnbrick123/sp500-data)

The earlier DoltHub v2 fix kept the in-app panel during failure, restored the Tesla chart on retry with a controlled response, reopened saved prices offline, and opened TradingView when selected. Live DoltHub requests failed in the cloud and on the user's phone. [DoltHub v2 read endpoint](https://www.dolthub.com/docs/products/dolthub/api/v2/database/#run-a-read-only-sql-query)

Chromium verified the redesigned Markets panel at 320, 390, 768, and 1440 CSS pixels with controlled prices, including 200% text size at 320 pixels. It checked all six date ranges, daily change, touch and keyboard inspection, the history table, a single available close, provider failure, and offline reopening. All 24 Node tests and 10 Python tests passed.

Chromium verified DoltHub-shaped daily closes, all three date ranges, ticker switching, provider attribution, fallback, and offline reopening with controlled responses at 320 CSS pixels. All 24 Node tests and 10 Python tests passed. The cloud proxy denied the live DoltHub API request. [DoltHub SQL API](https://www.dolthub.com/docs/products/dolthub/api/v1alpha1/sql/)

Chromium verified equal Workspace card dimensions at 320, 390, 820, and 1440 CSS pixels. A controlled embed checked the quote and chart layout, keyboard entry, ticker changes, dark mode, and frame isolation. A blocked widget used the daily-close fallback, and those prices reopened offline. All 24 Node tests and nine Python tests passed. The cloud network policy blocked TradingView, so the live chart still needs a check on a device with access.

The first Markets branch (`3ff9bb6`) merged into `main`. Chromium verified the original daily-close fallback with controlled prices, including ticker and period changes and offline reopening. The integration rerun passed all 24 Node tests and nine Python tests.

Mobile Chromium loaded 20 live headlines without Canada.ca feed requests. A previously saved Canadian release opened with a controlled online response and reopened offline. All 37 automated tests passed. The Android APK built and passed signature and asset checks. Phone testing is pending. [Canada.ca feed retirement](plans/personal-workspace.md#retire-canadaca-feeds)

The Today activity report passed Chromium checks for manual logging, book progress, timed podcasts, News topics, offline reopening, and the existing reading plan. All 37 automated tests passed. The debug APK passed build, signature, and asset checks. Background playback reporting still needs a phone check. [Today verification](plans/today-activity.md#verification)

At 320 CSS pixels, Chromium verified that opening controlled headlines changed the News order, including publisher and in-app reads, More, and an offline reload. Turning personalization off restored the freshness-based edition, and reset cleared the learned activity. All 34 automated tests passed in the News worktree. The Android debug APK passed signature and asset checks. Phone testing is pending. [News recommendation verification](plans/personal-workspace.md#news-recommendations)

Signed-out mobile Chromium verified free-to-read samples with cookies blocked. The updated News edition opened live headlines and kept a retired publisher's bookmark available offline. All 31 automated tests passed. The rebuilt Android APK passed signature and asset checks. Phone testing is pending. [Free-to-read News verification](plans/personal-workspace.md#free-to-read-news)

At 320 CSS pixels, Chromium verified the regional News mix, More, live French AI and Vietnamese Startup matches, Show HN discussions, cached results after a feed failure, and offline bookmarks. All 11 new feeds loaded live. All 22 Node and eight Python tests passed. The Android APK passed build, signature, and 224 bundled asset checks. Lint reported zero errors and nine warnings. Phone testing is pending. [Regional News verification](plans/personal-workspace.md#regional-technology-and-startup-news)

At 320 CSS pixels, Chromium verified the simplified reader after offline PDF conversion with a skipped page. Section controls, offline resume, original PDF and EPUB downloads, text imports, and recovery from a blank PDF passed. The Ask SmartBot launcher reappeared on return to the library. All 20 Node and seven Python tests passed after integration with the Music redesign.

The Music redesign was checked in Chromium from 320 to 1440 CSS pixels in light and dark mode. The functional check used a controlled podcast feed and audio file to verify keyboard navigation, search and error recovery, RSS import, follow and refresh, playback and seek, resume, and the offline library. All 27 automated tests passed. The redesigned Android debug APK built and passed signature and bundled asset checks. Lint reported zero errors and seven warnings. Physical phone verification remains open.

The Books redesign and PDF import now run inside Workspace. At 320 CSS pixels, Chromium verified keyboard navigation from Workspace to Books and back, return from an open book through the SmartBot header, offline reading position, offline PDF conversion, and both EPUB and original PDF export. All 15 Node and seven Python tests passed. See the [branch integration record](plans/branch-integration.md) for combined browser and Android verification.

At 320 CSS pixels, the Vietnamese Culture list expanded from ten to 50 unique headlines. Opening the digital culture passport story reached all 17 article paragraphs and two original images. Back restored the expanded edition. Offline reload preserved the saved summary and More worked on cached headlines. All 15 Node and seven Python tests passed. Android build, lint and signature checks passed. On-device Custom Tab verification is pending.

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

The November 25 Markets data build passed Gradle build, ZIP alignment, signature verification, and byte-for-byte checks of all 239 web assets, including 2,216 bundled closes. Its certificate matches the previous Markets APK. Lint reported zero errors and five warnings. The Android feed adapter returned verified byte ranges from GitHub in a host JVM test. A physical phone check is pending.

The November 25 Markets fallback fix passed Gradle build, ZIP alignment, signature verification, and byte-for-byte checks of all 234 bundled web files. The APK uses the same signing certificate as the previous redesign build. Lint reported zero errors and five warnings. Live DoltHub prices on the phone remain unverified.

The November 25 Markets redesign passed Gradle build, ZIP alignment, and byte-for-byte verification of all 235 bundled web files. The APK signature matches the previous daily-price build. Lint reported zero errors and five warnings. The redesigned screen still needs a physical phone check with live data.

The November 25 daily-price build passed Gradle build, signature, ZIP alignment, and byte-for-byte verification of all 234 bundled web files. The APK includes the DoltHub adapter. Lint reported zero errors and five warnings. Live data on a physical phone remains unverified.

The November 25 Markets build passed Gradle build, signature, ZIP alignment, and byte-for-byte verification of all 234 bundled web files. Lint reported zero errors and five warnings. The Android app allows TradingView chart resources and confines the widget to an iframe. A live chart check on a physical phone remains pending.

The November 24 phone pilot APK (0.3.2) was rebuilt from `main` at `a505431`. Gradle build, signature, ZIP alignment, and byte-for-byte verification of all 228 bundled web files passed. Lint reported zero errors and nine warnings. Installation and launch on a physical phone remain pending.

The combined reader and Music debug APK built successfully. The signature and all 222 bundled web files passed verification. Lint reported zero errors and nine warnings. Phone verification is pending.

The combined Android 0.3.2 build includes Workspace, PDF Books, News, and Podcasts. The APK signature and all 220 bundled web assets were verified. Lint reported zero errors and nine warnings. Drive import and background podcast playback still need a phone check.

The Workspace debug APK built successfully. Lint reported zero errors and five warnings. The APK signature and all 16 bundled web assets were verified in the cloud environment. Device and emulator verification is pending.

The November 23 Windows rebuild passed `assembleDebug` and `lintDebug` with zero lint errors and seven warnings. The APK signature and all 17 bundled web files matched the fetched branch. No Android device or configured emulator was available for the runtime check.

The 0.2.0 debug build passed in the main checkout. Lint reported zero errors and six warnings. The APK signature and all nine bundled web assets were verified. The machine had no connected Android device or configured emulator for runtime testing. See the [APK verification record](plans/android-apk-preview.md) and the [phone installation steps](../README.md#install-on-android).

## Setup verification

The remote branch check found all eight live `origin` branch tips in `main`. A check against the earlier Workspace checkout found the missing Books redesign commit `3bd8a40` on `origin/work`. The agent instructions and preview guide link to the [branch check](codex-setup.md#check-every-remote-branch).

The local Codex app server reported the active project configuration with a three-subagent limit and discovered both project skills. All five role files passed TOML and required-field checks. Named-role selection can be verified when a task calls for delegation. Documentation links and Android ignore patterns passed local checks.

Local validation for the SmartBot rename covered Markdown links and section anchors, all five role files, and both renamed skill files. A fresh Codex app server discovered `$smartbot-deliver-feature` and `$smartbot-review-change` from the SmartBot checkout.

The design-skill setup started from matching local and live `main` at `99acc66` and was prepared on `chore/design-skills`. A fresh project installed all six folders with their license notices. A rerun kept the installed folders, and a separate check preserved a pre-existing incomplete folder. A new Codex app server discovered all six added skill folders and both SmartBot workflows. The Windows Impeccable launcher reported version 4.10.0 from a temporary cache. The installer and Taste browser checker passed syntax checks, and all eight planner and text import tests passed.

## Handoff

The podcast feature requires a hosted metadata service for Android and Podcast Index credentials for full name search. Live publisher playback and lock-screen verification remain pending.

On the pilot phone, check the book picker and offline resume, refresh News, star an article, then reopen it offline. Verify Ask SmartBot against a live provider using the [setup instructions](../README.md#ask-smartbot). The [personal workspace plan](plans/personal-workspace.md) tracks passage context and portability.
