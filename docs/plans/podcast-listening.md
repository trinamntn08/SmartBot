# Podcast listening

Use the Music card to find, follow, and stream public podcasts. The browser uses HTML audio. The Android app uses a Media3 foreground service, with device-local progress and system media controls.

Open **Music** to search by podcast name, open the suggested show, or expand **Add by RSS**. Opening a show brings its episodes into focus. **Followed shows** and **Continue listening** appear when there are saved shows or an unfinished episode.

Drag the timeline to a specific point or use the 10-second back and forward buttons. Open the speed control and move the slider from 0.25× to 4×. SmartBot keeps the rate when you switch episodes or reopen the app.

Outside Music, the player fits on one row. Select the episode title to open the full player in Music. **Close player** pauses the episode and saves your place so you can use **Continue listening** later.

## Optional hosted service

The default Android APK searches the Apple Podcasts catalog and downloads public HTTPS RSS feeds on the device. It uses the device's country for search, with the United States as the default when the device has no region set. The browser's podcast service uses the United States Apple Podcasts catalog by default and can be configured to use Podcast Index.

1. Create a [Vercel Hobby project](https://vercel.com/docs/plans/hobby) using the repository’s `podcast-service` root and Node.js 22. To use Podcast Index, add `PODCAST_INDEX_KEY` and `PODCAST_INDEX_SECRET` as server environment variables.
2. Set a [Vercel firewall rate limit](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting) of 60 requests per minute per IP for paths starting with `/api/podcasts/`. The service limits requests per instance as well. If using a published browser frontend, set its exact origin in `SMARTBOT_PODCAST_ORIGINS` and set the service’s HTTPS origin in the `smartbot-podcast-service` meta tag in `web/index.html`.
3. Set `SMARTBOT_PODCAST_API` to the HTTPS service origin before building the Android app. The Gradle property `-PsmartbotPodcastApi=https://your-service.vercel.app` also sets it. Use the same signing key when updating an installed pilot build.

## Verification

- Run `npm --prefix podcast-service test` after installing dependencies. Run the existing Node and Python tests and Android `assembleDebug` and `lintDebug`.
- Open Music from Workspace. Test franceinfo discovery, a second feed pasted by URL, follow and refresh, playback, seek, retry, and position resume.
- On the Android pilot phone, stream an episode, lock the screen, and pause and resume using the media controls. Reopen SmartBot and check progress. Confirm that Books and Today work offline.

## Step record

November 24, 2026. The workspace implementation passed the podcast API suite, the existing Node and Python tests, and Android debug build and lint. A Chromium check at 320 CSS pixels used a controlled feed and audio file to verify search, RSS import, follow and refresh, play, seek, rewind, resume after reload, retry, and offline access. The workspace disconnected before the final package and commit checks. This recovery commit reproduces the feature and was checked for JavaScript syntax and repository links. Rebuild the APK from this commit for the phone pilot.

November 24, 2026. The Music redesign removed empty panels and routine notices, and gave search results and episodes separate views. Chromium verified the layout and exercised search, RSS, library navigation, playback, and offline access with controlled data. All 27 automated tests passed. Android build, lint, signature verification, and checks of all 222 bundled web files passed. Phone playback verification is pending.

The design skill's landing-page gate flagged the shared app shell, hash routes, and compact discovery layout. The Music screen keeps the Workspace navigation and was verified through the running app at 320 to 1440 CSS pixels.

November 24, 2026. The player uses labeled play, pause, and retry icons in a 54-pixel desktop bar and an 81-pixel phone layout. Chromium verified the icons, keyboard activation, seek, and rewind at 320, 390, and 1440 CSS pixels. All 22 web tests passed. The Android debug build, lint, signature, and updated asset checks passed. Lint reported zero errors and seven warnings. Physical phone verification remains open.

November 25, 2026. Android 0.3.3 adds discovery to the default APK. Mobile-width Chromium verified name search, a SoundCloud-format RSS link, episode ordering, stable playback IDs, refreshing followed shows, and offline access with controlled responses. All 39 automated tests passed. The APK passed build, alignment, signature, and checks of all 233 bundled web files. It uses the same signing certificate as the previous pilot. Lint reported zero errors and six warnings. The cloud environment could not reach the live catalog or publisher feed endpoints.

November 26, 2026. Music uses smaller type, compact discovery, and a player with a timeline, two 10-second skip buttons, and a saved custom speed. Chromium verified search, follow, playback, keyboard scrubbing and speed entry, touch, invalid rates, reload and resume, retry, and elapsed activity at changed speeds with controlled feeds and audio. The layout fit widths from 320 to 1440 CSS pixels and 200% text size on mobile. All 26 web, 12 Python, and five podcast service tests passed. Android compilation and lint passed. Physical phone playback and lock-screen checks remain pending.

The combined build at `fc52c82` passed all 27 web, 12 Python, and five podcast service tests. The local Chromium preview reopened the saved library offline and played a live franceinfo episode with both skips and a custom 1.37× rate. The Android debug APK passed signature and alignment verification and matched all 245 bundled web files. Lint reported zero errors and ten warnings in the Gradle configuration and manifest.

November 26, 2026. The desktop podcast service searches Apple Podcasts when Podcast Index credentials are absent. A live adapter check found **Tri Kỷ Cảm Xúc** by searching `tri ki cam xuc` and loaded 30 episodes from its publisher RSS feed. All 27 web, 12 Python, and seven podcast service tests passed. The service tests cover both catalogs and the unavailable-catalog fallback.

Desktop Chrome verified the same search through Music on the local preview, displayed all 30 episodes, and reopened the followed show offline.

November 26, 2026. The player fits in a single 50-pixel row outside Music, closes on request, and uses one playback speed slider. Chromium checked keyboard and touch adjustment, focus return, dismissal, resume, and the saved rate and position at widths from 320 to 1440 CSS pixels, including 200% text. A simulated Android bridge verified that a dismissed player stays closed across native polls and reopens at the saved position and speed. All 27 web and 12 Python tests passed. Physical Android playback remains unverified.

The combined build at `0a61e50` passed all 46 automated tests. Desktop Chrome opened **Tri Kỷ Cảm Xúc** and played a live franceinfo episode while verifying the speed slider, compact row, close, and resume. The Android debug APK passed signature and alignment checks and matched all 245 packaged web files. Lint reported zero errors and ten warnings.

November 26, 2026. Continue listening shows a short, single-line episode title and a play icon. Search, RSS submission, back, clear, follow, refresh, episode navigation, publisher, play, and skip actions use icons with accessible names. Chromium verified the title and touch targets at 320, 390, 768, and 1440 CSS pixels. Controlled feeds and audio verified keyboard and touch actions, saved position and resume, retries, and player controls at 200% text size. All 27 web, 12 Python, and seven podcast service tests passed.

## Handoff

Live catalog search, publisher playback, and lock-screen verification on a physical phone are pending.
