# Android APK preview

Implementation completed November 22, 2026. Physical phone verification is pending.

## Outcome

Install the SmartBot debug APK on an Android phone to test the [reading workflow](first-web-slice.md). The APK includes the same HTML, CSS, planner, and repository as the browser app and opens without a web server or internet access. Plans and progress are stored inside the Android app. The Android app and browser each have their own data.

## Steps and ownership

1. Build the Android host and verify the APK in the `android-apk-preview` worktree. The Android agent owns `android/` and this record.
2. Integrate the Android host and add browser and phone preview instructions. The primary agent owns the shared web app, repository integration, and README and status updates.

## Architecture decision

The phone preview uses one Android activity with WebView and `WebViewAssetLoader`. The library serves packaged assets under an app-local HTTPS origin so the browser modules and IndexedDB can run together. That origin stays the same across APK updates. The Android host serves an empty service worker script so every update uses the newly bundled files. The browser build still uses its existing service worker. [Android in-app content guide](https://developer.android.com/develop/ui/views/layout/webapps/load-local-content)

The package ID is `io.github.trinamntn08.smartbot`. It targets Android 15 and supports Android 8.0 or later with a current Android System WebView. The Android host gives the web content room for system bars, cutouts, and the keyboard on Android 15 and later.

## Build and install

For the current workflow, see the [build and Drive setup](../../README.md#build-and-upload-an-apk-on-request) and [phone installation steps](../../README.md#install-on-android).

Use a JDK 17 or 21 and an Android SDK with Platform 35 and Build Tools 35.0.0. Set `JAVA_HOME` and `ANDROID_HOME` for the build shell. The Gradle wrapper selects Gradle 8.14.3.

```powershell
cd android
.\gradlew.bat :app:assembleDebug :app:lintDebug
```

The APK is `android/app/build/outputs/apk/debug/app-debug.apk` relative to the repository root. Transfer it to the phone and open it with the package installer. A connected device with USB debugging enabled can also use `adb install -r app/build/outputs/apk/debug/app-debug.apk` from `android/`.

## Verification

- Gradle `:app:assembleDebug :app:lintDebug` passed with zero lint errors and eight warnings. The warnings cover available Gradle, Android plugin, compile and target SDK, and WebKit version updates, the API 33 back attribute, Android 12 backup rules, and the missing launcher icon resource.
- `apksigner` verified the Android debug certificate and v2 APK signature. `zipalign -c 4` passed. `aapt` confirmed the package and launcher activity, minimum API 26, target API 35, and absence of network permissions. All six APK web files matched their source bytes, and all four planner tests passed.
- The build machine had no connected device or configured emulator. On a phone, launch SmartBot in airplane mode, set up a reading plan, start and finish a session, and confirm that its page and history survive closing and reopening the app.

## Step record

The Android preview was implemented and verified on `android-apk-preview` on November 22, 2026. The release build and launcher widget remain future work.

November 28, 2026. Added an [on-request build and Drive upload command](../../README.md#build-and-upload-an-apk-on-request). The command checks the live source revision, runs Gradle build and lint, and verifies signing and alignment before copying the commit-named APK. Shell syntax and argument checks passed.

November 28, 2026. Ran the build and Drive workflow from published `main` at `8b0bae4` for SmartBot 0.3.5. The Gradle build passed with zero lint errors and ten warnings. ZIP alignment passed, the signature matched the previous workspace APK, and all 266 bundled web files matched the checkout. Drive reported the same checksum as the local APK. All 34 web and eight podcast service tests passed. The Python suite passed with one Windows-only check skipped. The README now covers Drive authorization, the build toolchain, and installing updates with the original signing key. Physical Android testing remains pending. [Uploaded APK](https://drive.google.com/file/d/1hgiV-DhGF18SBLKO_5I9BZK3qzLWqhy9/view)
