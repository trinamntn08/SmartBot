# SmartBot branch integration

Status: complete.

## Outcome

Use Workspace as the homepage for Books, News, Podcasts, and the daily routine. Keep the existing browser and Android data stores on the same app origins.

## Steps and ownership

1. Merge the PDF Books branch into the Workspace branch and verify navigation, import, and offline reading.
2. Merge the earlier mobile UI and design tooling. Resolve overlapping layouts in favor of the current Workspace shell and keep the route scroll reset.
3. Merge Podcasts, verify the combined browser and Android builds, and fast-forward main after checking all remote branch tips.

## Verification

Run the Node, Python, and podcast service suites. Check navigation, offline PDF conversion, saved reading position, and Music in Chromium. Build and lint the APK, then verify the signature and bundled web assets.

## Step records

- November 24, 2026. Books received the Workspace navigation links and the PDF and EPUB workflows. Chromium verified the browser flows at 320 CSS pixels. All 15 Node and seven Python tests passed.
- November 24, 2026. The mobile UI merge retained the shared navigation and added route scroll reset. The Books flow passed the keyboard and offline browser checks. The library was inspected at 320 and 1280 CSS pixels.

- November 24, 2026. The design skill installer and setup guide merged. The installer argument parser responded to `--help` and the downloaded skill directories are ignored.

- November 24, 2026. Podcasts merged into Workspace Music. All 15 web, seven Python, and five podcast service tests passed. The 320-pixel browser checks covered Books navigation, saved reading position, offline PDF conversion and export, and local podcast discovery. Chromium also opened News and Ask SmartBot. Android 0.3.2 built and passed signature verification. All 220 bundled web files matched and lint reported zero errors and nine warnings.

## Handoff

Use the regular Workspace preview for the combined app. Phone verification of the Drive picker and background podcast playback remains open. Android podcast discovery needs the service configuration in the [podcast plan](podcast-listening.md#pilot-setup).
