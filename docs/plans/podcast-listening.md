# Podcast listening

Use the Music card to find, follow, and stream public podcasts. The browser uses HTML audio. The Android app uses a Media3 foreground service, with device-local progress and system media controls.

Open **Music** to search by podcast name, open the suggested show, or expand **Add by RSS**. Opening a show brings its episodes into focus. **Followed shows** and **Continue listening** appear when there are saved shows or an unfinished episode.

## Pilot setup

1. Create a [Vercel Hobby project](https://vercel.com/docs/plans/hobby) using the repository’s `podcast-service` root and Node.js 22. Add `PODCAST_INDEX_KEY` and `PODCAST_INDEX_SECRET` as server environment variables for full name search.
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

## Handoff

The authenticated Vercel deployment, live publisher playback, and lock-screen verification on a physical phone are pending.
