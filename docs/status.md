# SmartBot status

Last updated November 23, 2026.

## Current state

- **Ask SmartBot** opens from the bottom of the browser app. It supports typed questions and editable voice transcripts through OpenAI or Gemini. Choose the provider under **Settings → Assistant**. SmartBot saves the choice in the browser and reads provider credentials from the local preview server's environment.
- **Workspace** is the home screen. Its five cards open the Books library and previews for News, Languages, Music, and Movies. The previews describe features in development. Today remains available for setup and the daily reading routine.
- The first mobile-first web slice implements setup, an editable reading plan, the current book and page, completion and undo, and seven-day progress. A service worker caches the app after its initial load, and IndexedDB stores plans and reading progress on the device.
- **Books** imports plain-text files and resumes at the last section. The Android 0.2.0 debug APK includes the reader and a system file picker.
- A debug APK bundles the same web app for Android 8.0 and newer. It loads its packaged files without a local server, and reading progress is stored in the app's WebView.
- Project-local Codex configuration defines five agent roles and two reusable skills. The [setup guide](codex-setup.md) explains how to discover and use them.
- The initial baseline includes the [Git session workflow](codex-setup.md#session-workflow) for documenting, committing, pushing, and verifying each completed step. Parallel writing sessions each use their own branch and worktree or clone. The [SmartBot GitHub repository](https://github.com/trinamntn08/SmartBot) is configured as `origin`.
- The [personal workspace plan](plans/personal-workspace.md) expands the scope to in-app reading, GPT questions by text and voice, and news. The daily plan remains available as part of the workspace.

## Web app verification

The provider settings passed a 320-pixel-wide Chromium check with simulated providers. The choice survived a reload and applied to questions and voice transcription. When a saved provider became unavailable, the chat kept the draft and linked to Settings for a new choice. Settings and Books remained accessible offline.

The assistant passed local API tests and a 320-pixel-wide Chromium check with substitute responses from both providers. Checks covered follow-ups, audio transcription, editable drafts, microphone denial, provider usage limits, an unconfigured server, and offline access to Books. Live provider verification is pending.

The Workspace card layout passed Chromium checks from 320 to 1440 CSS pixels in light and dark mode. Keyboard navigation moved focus to each preview heading. The cards and artwork reopened offline, imported books resumed at the saved section, and a reading session completed from Today appeared in Progress. All eight Node tests passed.

Four planner tests passed under Node.js. A Chrome smoke test at 320 CSS pixels covered setup, missing-book recovery, editing, offline resume and completion, duplicate completion in two tabs, skip and undo, date rollover, and saved history. Chrome also passed the desktop width check in dark mode.

The [browser preview](../README.md#browser-preview) uses port 8000 on the local computer. The Windows launcher starts or reuses the preview and opens its address in the default browser. The preview serves the [assistant API](../README.md#ask-smartbot) and the web assets on the same origin.

On November 23, the Windows preview was restarted from the fetched `smartbot/workspace-cards` branch. Local HTTP checks confirmed the new entry page, Workspace and assistant scripts, service worker, and assistant endpoint. All eight Node tests and four Python API tests passed. Chrome initially showed the cached page. Close all SmartBot tabs and reopen the preview to complete the browser refresh.

Four text import tests covered encoding, line breaks, Unicode section boundaries, and invalid files. A Chrome check at 320 CSS pixels verified import and offline resume alongside the existing reading history.

## Android APK verification

The Workspace debug APK built successfully. Lint reported zero errors and five warnings. The APK signature and all 16 bundled web assets were verified in the cloud environment. Device and emulator verification is pending.

The November 23 Windows rebuild passed `assembleDebug` and `lintDebug` with zero lint errors and seven warnings. The APK signature and all 17 bundled web files matched the fetched branch. No Android device or configured emulator was available for the runtime check.

The 0.2.0 debug build passed in the main checkout. Lint reported zero errors and six warnings. The APK signature and all nine bundled web assets were verified. The machine had no connected Android device or configured emulator for runtime testing. See the [APK verification record](plans/android-apk-preview.md) and the [phone installation steps](../README.md#install-on-android).

## Setup verification

The local Codex app server reported the active project configuration with a three-subagent limit and discovered both project skills. All five role files passed TOML and required-field checks. Named-role selection can be verified when a task calls for delegation. Documentation links and Android ignore patterns passed local checks.

Local validation for the SmartBot rename covered Markdown links and section anchors, all five role files, and both renamed skill files. A fresh Codex app server discovered `$smartbot-deliver-feature` and `$smartbot-review-change` from the SmartBot checkout.

## Handoff

Verify the plain-text picker and reader on the pilot phone. Verify Ask SmartBot against a live provider using the [setup instructions](../README.md#ask-smartbot). The [personal workspace plan](plans/personal-workspace.md) tracks passage context and news.
