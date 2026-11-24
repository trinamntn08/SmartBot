# SmartBot

SmartBot is a mobile-first personal workspace for books, news, questions, and daily routines. Today suggests a short plan you can edit to fit the 15–30 minutes you want to spend.

The current app includes a book library with PDF-to-EPUB conversion and a daily reading routine. A GPT assistant with text and voice input, news, and vocabulary are described in the [personal workspace plan](docs/plans/personal-workspace.md).

Read the [product and development plan](docs/product-plan.md) for the screens, daily planning rules, architecture, and implementation milestones.

## Browser preview

[Open SmartBot in your browser](http://localhost:8000/). The link works on the computer running the local preview.

On Windows, double-click [preview.cmd](preview.cmd) in File Explorer to start the preview and open it in your default browser. If the launcher starts the server, keep its window open while you use SmartBot. It uses the Python 3 already installed on your computer.

The web app needs an initial online load at a given address to cache its files for offline use. Routine data is local to each browser and address.

## Read a book

Open **Books** → **Add a book**, choose a PDF or text file, then select **Import book**. On Android, select **Drive** in the system file picker if it appears. In a browser, you can download a file from Drive first and then select it from your downloads.

- For a PDF up to 20 MB, tap **Convert to EPUB**. Read the reflowed text in SmartBot, or open **Book files** and tap **Save EPUB** to use it in another reader. Use **Save original PDF** to get the original with its images and layout.
- For a scan, run optical character recognition (OCR) before importing. Conversion uses the PDF’s selectable text, so complex layouts may read better in the original.
- For a text file up to 8 MB, use UTF-8 or UTF-16 with a byte order mark.

SmartBot stores the book and last section on the device. Conversion and reading work offline after import and the app’s initial load.

## Install on Android

The debug APK is generated at `android/app/build/outputs/apk/debug/app-debug.apk`. Copy it to a phone running Android 8.0 or newer, tap the file, and follow the installation prompt. If Android asks for permission to install the APK, follow the phone's prompt for the app that opened it. [Android installation help](https://support.google.com/pixelphone/answer/7391672)

Open SmartBot from the launcher. To check offline use, turn on airplane mode, import a `.txt` book, move to the next section, then close and reopen SmartBot to check that it resumes there. The APK bundles the web app and keeps its own local progress.

## Development

To serve the preview without opening a browser automatically, run this from the repository root with Python 3.

```sh
python -m http.server 8000 --bind 127.0.0.1 --directory web
```

Run the planner and text import tests with Node.js 22 or newer.

```sh
node --test tests/planner.test.mjs tests/text-book.test.mjs
```

To rebuild the Android debug APK, use a JDK 17 or 21 and install Android SDK Platform 35 and Build Tools 35.0.0. Point `JAVA_HOME` to the JDK and `ANDROID_HOME` to the SDK for the build shell. Run the wrapper from the repository root on Windows.

```powershell
.\android\gradlew.bat -p android :app:assembleDebug :app:lintDebug
```

Open `android/` as a project if you prefer Android Studio. The [Android APK plan](docs/plans/android-apk-preview.md) records the packaging and checks.

- See [current status](docs/status.md) and the [first web implementation plan](docs/plans/first-web-slice.md) for what works and the next milestone.
- See the [Codex setup guide](docs/codex-setup.md) and [AGENTS.md](AGENTS.md) for project roles and working instructions.
- The [documentation index](docs/README.md) links to all current guides.
