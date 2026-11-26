# YouTube music search

Search and playback are implemented for the browser preview and Android. Verification on a phone and search with a configured Google API key are pending.

## Outcome

Use Listen → Music to search for public music videos and choose one to play in SmartBot. Use a YouTube Data API key for public search. The official player stays visible during playback across SmartBot screens and pauses when out of view or when SmartBot is in the background.

## Steps and ownership

1. Add YouTube Data API search through the loopback preview and Android app. Keep keys in the preview environment or private Android app storage.
2. Add first-use terms and privacy information, search, selection, and a persistent visible player. Switch cleanly between YouTube, Spotify, and Podcasts.
3. Verify blank, configured, error, and offline states, a real embedded music video, and Android packaging.

## Verification

Run the existing automated suites. Test search with controlled results and verify a real YouTube video starts and continues during in-app navigation. Check mobile layouts, focus and touch navigation, pausing out of view, and reconnection. Live search needs a YouTube Data API key. Test Android playback on a phone when available.

## Step records

The preview and Android use YouTube Data API v3 to search for embeddable public music videos. The browser preview reads its key from the environment, and Android uses private app storage. The Music page puts song and artist search first for YouTube Music after one-time approval. The original YouTube player stays visible across sections and pauses when scrolled out of view or sent to the background.

All 27 web tests, 13 Python tests, and seven podcast service tests passed. Chromium at 320 CSS pixels checked keyboard setup, quota and empty results, and layout at 200% text size with controlled search responses. A real YouTube music video with a duration over three minutes played inside SmartBot. Playback continued through an in-app navigation with the same iframe and paused when scrolled out of view. Closing the player returned focus to search.

## Handoff

Supply a YouTube Data API key through the [music setup](../../README.md#listen-to-music) to enable live search. Physical Android playback still needs verification.
