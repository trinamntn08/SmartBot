# Podcast listening

## Live radio

**Outcome.** Tune in to an ongoing broadcast under **Listen → Radio**, change stations, and manage custom HTTPS streams on this device.

**Implementation.** The starter stations connect directly to their publisher streams. The radio player stays mounted across routes, stops when other SmartBot audio starts, and reconnects to the current broadcast on retry. Radio uses browser or Android WebView audio. [Radio France station endpoints](https://developers.radiofrance.fr/doc/en/tutorial-by-example/list-brands)

**November 27, 2026.** Added three stations, custom station storage, and in-app playback with stop and retry. All 34 web, 16 Python, and eight podcast service tests passed. Each starter endpoint returned MP3 audio over HTTPS. Chrome played all three live streams and verified navigation, station changes, stop, custom station validation and storage, offline retry, and switching between live radio and a franceinfo podcast episode with resume. The Listen tabs wrap at large text sizes. Chrome verified the layout from 320 to 1440 CSS pixels and checked the station form, active player, and podcast search at 320 pixels with 200% text.

Android debug build and lint passed from `16cf354` with zero lint errors and ten warnings. The APK passed signature and ZIP alignment checks and all 266 bundled web assets matched the checkout. Physical Android playback and lock-screen behavior remain unverified.

**November 27, 2026.** Replaced the radio stop label with a square icon and added a trash icon for every station. Removing a preset persists on the device, with a restore action for defaults. Refined the add form with a compact disclosure, aligned fields, and stream guidance. All 34 web tests passed. A local storage check covered the earlier custom-station format, saving hidden presets, and continuing when persistent storage is unavailable. Chrome checked live stop, touch and keyboard controls, focus after removal, offline removal and restore, and responsive layout from 320 to 1440 CSS pixels up to 200% text size. Final screenshots confirmed the save button clears the assistant launcher on narrow screens. Android build, lint, signature, and alignment passed from `bfbae20`. All 266 APK web files matched, with zero lint errors and ten warnings. Physical Android testing remains pending.

The Listen card opens distinct Music and Podcasts sections and remembers the one you used last. Music saves a service shortcut or a Spotify playlist on this device. Spotify's official player handles its playback availability. Podcasts streams public episodes in SmartBot. The browser uses HTML audio. The Android app uses a Media3 foreground service, with device-local progress and system media controls.

Open **Podcasts** to resume an unfinished episode, play the latest from a followed show, or open the suggested show. **Find podcasts** reveals name search and **Add by RSS**. Opening a show brings its episodes into focus.

Drag the timeline to a specific point or use the 10-second back and forward buttons. Open the speed control and move the slider from 0.25× to 4×. SmartBot keeps the rate when you switch episodes or reopen the app.

Outside Podcasts, the player fits on one row. Select the episode title to open the full player in Podcasts. **Close player** pauses the episode and saves your place so you can use **Continue listening** later.

## Optional hosted service

The default Android APK searches the Apple Podcasts catalog and downloads public HTTPS RSS feeds on the device. It uses the device's country for search, with the United States as the default when the device has no region set. The browser's podcast service uses the United States Apple Podcasts catalog by default and can be configured to use Podcast Index.

1. Create a [Vercel Hobby project](https://vercel.com/docs/plans/hobby) using the repository’s `podcast-service` root and Node.js 22. To use Podcast Index, add `PODCAST_INDEX_KEY` and `PODCAST_INDEX_SECRET` as server environment variables.
2. Set a [Vercel firewall rate limit](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting) of 60 requests per minute per IP for paths starting with `/api/podcasts/`. The service limits requests per instance as well. If using a published browser frontend, set its exact origin in `SMARTBOT_PODCAST_ORIGINS` and set the service’s HTTPS origin in the `smartbot-podcast-service` meta tag in `web/index.html`.
3. Set `SMARTBOT_PODCAST_API` to the HTTPS service origin before building the Android app. The Gradle property `-PsmartbotPodcastApi=https://your-service.vercel.app` also sets it. Use the same signing key when updating an installed pilot build.

## Verification

- Run `npm --prefix podcast-service test` after installing dependencies. Run the existing Node and Python tests and Android `assembleDebug` and `lintDebug`.
- Open Listen from Workspace. Check music service selection and launch, switching sections, reopening Podcasts, franceinfo discovery, RSS, follow and refresh, playback, seek, retry, and position resume.
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

The preview from `956f3ac` on `main` reopened Continue listening offline with the short title and resume icon. The Android debug APK passed Gradle build, signature continuity, ZIP alignment, and checks of all 247 bundled web files. Lint reported zero errors and six warnings. Physical phone checks remain pending.

November 26, 2026. The Music player aligns the episode, timeline, playback buttons, speed, and close control on one row at desktop widths. Narrow layouts put speed on the same row as the playback buttons. Chromium verified alignment at nine widths from 320 to 1440 CSS pixels, including both layout breakpoints. Controlled audio verified keyboard and touch playback, seek, skips, speed and focus, resume, retry, and resizing with 200% text. All 27 web, 12 Python, and seven podcast service tests passed.

The browser preview from `410e16d` on `main` passed the alignment and playback checks and reopened the library offline. The Android debug APK passed Gradle build, signature continuity, ZIP alignment, and comparison of all 249 bundled web files. Lint reported zero errors and six warnings. Physical phone checks remain pending.

November 26, 2026. The playback speed button displays one decimal place, while the slider and stored rate retain hundredth-step precision. Chromium verified rounding, trailing zeroes, precise playback and slider announcements, and the rounded label after reopening a saved episode. All 46 automated tests passed.

November 26, 2026. Workspace opens Listen with separate Music and Podcasts sections. Music remembers a service and opens its HTTPS shortcut. Podcasts leads with resume and followed-show playback, and Find podcasts reveals search and RSS. The existing podcast deep link and device-local listening data carry over. Chromium checked the layout from 320 to 1440 CSS pixels and at 200% text size. Controlled feeds and audio verified hidden discovery, keyboard focus, search and RSS, follow and quick play, resume, section and service persistence, and pausing a podcast when launching a music service. All 46 automated tests passed.

The preview from `9681c07` on `main` passed playback and offline reopening for the podcast library and saved music choice. The Android debug APK passed Gradle build, signature continuity, ZIP alignment, and comparison of all 250 bundled web files. Lint reported zero errors and six warnings. Opening a music service and podcast playback on a physical phone remain pending.

November 26, 2026. Music embeds the saved Spotify playlist in Spotify's official player. SmartBot validates the playlist link, stores the playlist ID on this device, and lets you replace or remove it. Android permits the Spotify playlist embed in a subframe. Chromium verified link validation, save and reload, service switching, replacement, removal, offline recovery, and player layout from 320 to 1440 CSS pixels and at 200% text size. Podcast playback and resume checks and all 46 automated tests passed.

The preview from `80c7a89` on `main` played a Spotify preview in signed-out Chrome without opening another window and restored the saved playlist after an offline reload and reconnection. The Android debug APK passed build, signature continuity, ZIP alignment, and comparison of all 250 bundled web files. Lint reported zero errors and six warnings. Full-song playback and Android runtime playback remain unverified.

November 26, 2026. Open Spotify is the primary Music action again. The playlist form and any saved playlist are available in a collapsed section. Opening the section loads the player and closing it unloads the player. Chromium checked the shortcut, keyboard focus, optional setup, saved playlist carryover, and layout from 320 to 1440 CSS pixels and at 200% text size. All 46 automated tests passed. Spotify's catalog interface is available in Spotify itself and full-track streaming from a third-party integration requires Premium.

The preview from `177d356` on `main` verified the shortcut and live Spotify preview, deferred player requests until expansion, and kept the saved playlist after an offline restart. The Android debug APK passed build, signature continuity, ZIP alignment, and byte-for-byte comparison of all 251 web files. Lint reported zero errors and six warnings. Phone playback remains unverified.

November 26, 2026. The Spotify playlist player remains mounted across SmartBot screens and uses a compact layout outside Music. Closing the player stops it. Starting a podcast closes the Spotify player, and opening Spotify pauses and saves the current podcast. Chromium verified the same player instance and play state across Workspace, Books and Music with controlled responses, plus keyboard dismissal, offline recovery, saved playlist reload, and layout from 320 to 1440 CSS pixels at standard text size and at 200% on mobile. All 46 automated tests passed. Spotify controls preview length and full-track availability.

The preview from `d47850f` on `main` confirmed the live Spotify preview kept playing through Workspace, Books and Music. The Android debug APK passed build, signature continuity, ZIP alignment, and comparison of all 252 bundled web files. Lint reported zero errors and six warnings. Phone and lock-screen playback remain unverified.

## Handoff

Live catalog search, publisher playback, and lock-screen verification on a physical phone are pending.
