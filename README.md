# SmartBot

SmartBot is a mobile-first personal workspace for books, news, questions, and daily routines. Today suggests a short plan you can edit to fit the 15–30 minutes you want to spend.

The app includes a plain-text book reader, a daily reading routine, and an assistant for typed and spoken questions. See the [personal workspace plan](docs/plans/personal-workspace.md) for upcoming features.

Read the [product and development plan](docs/product-plan.md) for the screens, daily planning rules, architecture, and implementation milestones.

## Browser preview

[Open SmartBot in your browser](http://localhost:8000/). The link works on the computer running the local preview.

On Windows, double-click [preview.cmd](preview.cmd) in File Explorer to start the preview and open it in your default browser. If the launcher starts the server, keep its window open while you use SmartBot. It uses the Python 3 already installed on your computer.

The web app needs an initial online load at a given address to cache its files for offline use. Routine data is local to each browser and address.

## Read a book

Open **Books**, choose a `.txt` file, then select **Import book**. SmartBot displays the text in sections and saves the last section you opened. Use a UTF-8 file or a UTF-16 file with a byte order mark, up to 8 MB. The book and its position are stored on the device and are available offline.

## Ask SmartBot

Set at least one provider key in the environment that runs the Python preview server. Restart the preview after changing its environment. The provider list shows the keys available to the server by provider name.

| Provider | Server API key | Optional model override |
| --- | --- | --- |
| OpenAI | `SMARTBOT_OPENAI_API_KEY` or `OPENAI_API_KEY` | `SMARTBOT_OPENAI_MODEL` defaults to `gpt-4o-mini`. `SMARTBOT_OPENAI_TRANSCRIPTION_MODEL` defaults to `gpt-4o-mini-transcribe`. |
| Gemini | `SMARTBOT_GEMINI_API_KEY` or `GEMINI_API_KEY` | `SMARTBOT_GEMINI_MODEL` defaults to `gemini-2.5-flash`. Use an audio-capable model for voice. |

In a browser, select **Ask SmartBot** at the bottom of any screen. Type a question or select **Record voice**, allow microphone access, then select **Stop and transcribe**. Review or edit the transcript and select **Send**. Use **Read aloud** if your browser provides speech synthesis. The chat lasts for the current page session. The chosen provider receives the recording for transcription and recent conversation turns when you send a question.

The assistant requires the Python preview server and outbound HTTPS to `api.openai.com` or `generativelanguage.googleapis.com`. The preview listens on loopback for personal use. In a restricted cloud environment, allow the hostname for the provider you choose. The bundled Android APK directs you to the browser preview for the assistant.

## Install on Android

The debug APK is generated at `android/app/build/outputs/apk/debug/app-debug.apk`. Copy it to a phone running Android 8.0 or newer, tap the file, and follow the installation prompt. If Android asks for permission to install the APK, follow the phone's prompt for the app that opened it. [Android installation help](https://support.google.com/pixelphone/answer/7391672)

Open SmartBot from the launcher. To check offline use, turn on airplane mode, import a `.txt` book, move to the next section, then close and reopen SmartBot to check that it resumes there. The APK bundles the web app and keeps its own local progress.

## Development

To serve the preview without opening a browser automatically, run this from the repository root with Python 3.

```sh
python3 scripts/preview.py --no-browser
```

Run the planner and text import tests with Node.js 22 or newer, and the assistant API tests with Python 3.

```sh
node --test tests/planner.test.mjs tests/text-book.test.mjs
python3 -m unittest discover -s tests -p 'test_*.py'
```

To rebuild the Android debug APK, use a JDK 17 or 21 and install Android SDK Platform 35 and Build Tools 35.0.0. Point `JAVA_HOME` to the JDK and `ANDROID_HOME` to the SDK for the build shell. Run the wrapper from the repository root on Windows.

```powershell
.\android\gradlew.bat -p android :app:assembleDebug :app:lintDebug
```

Open `android/` as a project if you prefer Android Studio. The [Android APK plan](docs/plans/android-apk-preview.md) records the packaging and checks.

- See [current status](docs/status.md) and the [first web implementation plan](docs/plans/first-web-slice.md) for what works and the next milestone.
- See the [Codex setup guide](docs/codex-setup.md) and [AGENTS.md](AGENTS.md) for project roles and working instructions.
- The [documentation index](docs/README.md) links to all current guides.
