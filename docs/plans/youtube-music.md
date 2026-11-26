# YouTube music search

Live search and playback are verified in the Windows browser preview. Android includes music picks and supports live catalog access through a shared service. Deployment and playback on a phone are pending.

## Outcome

Use Listen → Music to search for public music videos and choose one to play in SmartBot. Use a YouTube Data API key for public search. The official player stays visible during playback across SmartBot screens and pauses when out of view or when SmartBot is in the background.

## Steps and ownership

1. Add YouTube Data API search through the loopback preview and Android app. Keep keys in the preview environment or private Android app storage.
2. Add first-use terms and privacy information, search, selection, and a persistent visible player. Switch cleanly between YouTube, Spotify, and Podcasts.
3. Verify blank, configured, error, and offline states, a real embedded music video, and Android packaging.
4. Put playable music charts on the Music screen. Share the chart view across the browser preview and Android, and move song search into a button.
5. Give fresh Android installs a playable set of music picks and use a hosted catalog for live charts and search.

## Android music service

1. Deploy the existing `podcast-service` directory as a Node.js 22 project. Set `SMARTBOT_YOUTUBE_API_KEY` as a server secret in Production. The same service can continue serving the podcast endpoints. [Deployment settings](https://vercel.com/docs/project-configuration/project-settings)
2. Set `SMARTBOT_YOUTUBE_API` to the deployment's HTTPS origin when building Android. The Gradle property `-PsmartbotYoutubeApi=https://your-service.vercel.app` also sets the origin. The APK includes this public origin and sends music requests to the service, which adds the secret when it calls YouTube.
3. Verify charts and search on a clean Android install. The default build opens **Music picks** after enabling YouTube. Upgrades with an existing device key can still use that key until a hosted origin is configured.

The service uses one shared YouTube quota. Searches are limited per IP and charts are cached per instance for 15 minutes. The provider enforces the project-wide quota. [YouTube API quotas](https://developers.google.com/youtube/data/determine_quota_cost)

## Verification

Run the existing automated suites. Test search with controlled results and verify a real YouTube video starts and continues during in-app navigation. Check mobile layouts, focus and touch navigation, pausing out of view, and reconnection. Live search needs a YouTube Data API key. Test Android playback on a phone when available.

## Step records

The preview and Android use YouTube Data API v3 to search for embeddable public music videos. The browser preview reads its key from the environment, and Android uses private app storage. The Music page puts song and artist search first for YouTube Music after one-time approval. The original YouTube player stays visible across sections and pauses when scrolled out of view or sent to the background.

All 27 web tests, 13 Python tests, and seven podcast service tests passed. Chromium at 320 CSS pixels checked keyboard setup, quota and empty results, and layout at 200% text size with controlled search responses. A real YouTube music video with a duration over three minutes played inside SmartBot. Playback continued through an in-app navigation with the same iframe and paused when scrolled out of view. Closing the player returned focus to search.

The local preview on port 8003 loaded the published build through its service worker and repeated the real video check with controlled search responses. Spotify continuity and switching to podcast playback passed in a separate Chromium check. A simulated Android bridge verified saving and removing the key, reloading the app, and recovering search after going offline.

The Android debug APK built from `c5c1a94`. Gradle lint reported zero errors and eight warnings. Signature continuity, ZIP alignment, and all 254 bundled web assets passed verification. No Android device was connected.

The Windows browser preview now saves or removes the key through **YouTube search setup**. Windows DPAPI encrypts the key for the current user and saves it outside the checkout under `%LOCALAPPDATA%\SmartBot`. The preview accepts credential writes from its own origin and returns status only. The environment override is still supported. All 27 web, 14 Python, and seven podcast service tests passed. The Windows HTTP test used a sample key to verify encryption, search, removal, rejection of cross-origin writes, and the environment override.

Chromium used the published Windows build to save a sample key with a masked field, restart the preview process, resume search without re-entering the key, and remove the file. The key stayed out of browser storage and request logs. The form fit 320 CSS pixels at 200% text size. The Android bridge fixture also passed its existing save, remove, and offline recovery checks. The regular browser preview was restarted on port 8003.

Chromium verified live search from the configured preview. Searching for Alan Walker Faded returned the official video. Selecting it opened the embedded YouTube player above Music, played the full-length video, and kept playing on Workspace in the same tab.

The Music screen now opens with regional rows from YouTube's public music charts for France, Vietnam, and the United States. Cards use official thumbnails and launch the existing player directly. The magnifying glass opens search, and Escape returns from search to the charts. Both preview and Android use the same chart UI and their existing key storage. The upstream chart returned 18 embeddable videos for each region during the provider check.

All 27 web, 15 Python, and seven podcast service tests passed. Chromium with controlled data verified browsing without a search, keyboard scrolling, eligibility filtering, a failed region alongside working charts, re-entry, and the layout at 320 CSS pixels and 200% text size. Impeccable's only flag was for an existing font declaration.

The published preview loaded 36 current chart cards with official thumbnails. Desktop and mobile checks covered opening a live chart video in the embedded player, searching, and returning keyboard focus to the selected card on close. A visual pass aligned the thumbnail cards and reserved two lines for titles so channel names line up within each row.

The final layout passed a second live check in Chrome at desktop and phone widths in light and dark modes. The browser preview is running on port 8003. The Android debug APK rebuilt from `a9a9ace` with zero lint errors and eight warnings. Signature continuity, ZIP alignment, and all 257 bundled web assets passed. No Android device was connected.

Music search now opens inline with the Browse music toolbar. On narrow screens the field uses the heading's space until search closes. Chromium verified control alignment at six widths from 320 to 1440 CSS pixels at 100% and 200% text size, with keyboard focus, search submission, and Escape restoring the charts. All 27 web tests passed.

Once a key is configured, Music moves the setup form under **Music settings → Manage YouTube key**. Setup still opens when an enabled device needs a key. The Chromium fixture verified the first save, reload, replacement, validation feedback, removal, and opening setup again after removal. All 27 web tests passed.

Android no longer prompts for a personal YouTube key. Seven music picks are available after first-use approval. A configured HTTPS service provides live charts and search, and the optional read of an older device key preserves access for existing installs. The Windows preview keeps its local setup. All 27 web, 15 Python, and eight service tests passed. Chromium emulating the Android asset origin verified the fresh install, reopening, an official embedded player from a pick, and controlled live charts and search. The Windows key settings and chart browsing fixtures also passed.

The shared Node service was verified locally against live YouTube charts in all three regions and live song search. The Windows preview loaded live charts and search with its saved key and reopened offline. The Android debug APK built from `16c9c47` with matching signing certificate, ZIP alignment, 257 matching assets, and no key-entry bridge. Lint reported zero errors and six warnings. No hosted service or Android device was connected.

## Handoff

Supply a YouTube Data API key through the [music setup](../../README.md#listen-to-music) to enable live search. Physical Android playback still needs verification.
