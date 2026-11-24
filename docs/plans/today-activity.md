# Today activity report

Status: complete in the web app and Android source.

## Outcome

Today opens to the local day's activity report before routine setup. It shows time by activity and topic, reading progress, and listening time. The report links to Books, Podcasts, and News and includes a manual log and the existing reading plan. [Product requirements](../product-plan.md#today-screen-sketch)

## Steps and ownership

1. Record foreground activity, book progress, and podcast playback without changing saved bookmarks or playback positions. The web repository stores per-day totals in IndexedDB. Android's playback service keeps local listening totals while the WebView is closed.
2. Add the report and manual log, integrate the reading plan, and cache the new files for offline use. The feature branch owns the report, playback and reader hooks, and verification.

## Verification

Chromium passed first launch, adding and removing manual entries, text-section and PDF page counts, reading plan completion and undo, controlled podcast playback and seeking, a controlled News article, and an offline restart. The report fit at 320 and 1280 CSS pixels in light and dark mode, including 200% text on the narrow layout. All 29 Node and eight Python tests passed. Android `assembleDebug` and `lintDebug` passed with zero lint errors and nine warnings. APK signature verification passed, and all 228 packaged web files matched the source. No Android device or configured emulator was available.

## Step records

- November 24, 2026. Added the daily report, manual entries with removal, and automatic data from the reader, News, and podcast playback. Each source PDF page is counted once per day per book. Earlier conversions keep their existing bookmarks and continue to report completed sections.

## Handoff

- Verify native background playback and reporting on the pilot phone. Music and activity outside SmartBot can be entered manually.
