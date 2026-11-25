# SmartBot

SmartBot is a mobile-first personal workspace for books, news, questions, and daily routines. Today suggests a short plan you can edit to fit the 15–30 minutes you want to spend.

The app includes a book library with PDF-to-EPUB conversion, news in three languages, a daily reading routine, and an assistant for typed and spoken questions. See the [personal workspace plan](docs/plans/personal-workspace.md) for upcoming features.

Read the [product and development plan](docs/product-plan.md) for the screens, daily planning rules, architecture, and implementation milestones.

## Browser preview

Before each build and launch, [check every remote branch for relevant cloud work](docs/codex-setup.md#check-every-remote-branch). Then update the clean checkout of the branch you want to preview.

```powershell
git fetch --all
git merge --ff-only '@{upstream}'
```

The browser preview serves `web/` from the worktree that started it. Confirm that worktree contains the requested branch or commit. For a fresh Android package, run the [debug APK build](#development) after syncing.

On Windows with Python 3 installed, run [preview.cmd](preview.cmd) after syncing and any build. It starts or reuses the local server and opens the refresh link in your default browser. Keep the server window open while you use SmartBot.

[Open or update the SmartBot preview](http://localhost:8000/refresh). Use this link on the computer running the preview whenever you want the latest version. It checks the current web files and activates the updated offline cache before opening the app. Other SmartBot tabs can stay open.

Restart the preview server if its Python code or configuration changes. In its server window, press Ctrl+C, then run `preview.cmd` again.

The web app needs an initial online load at a given address to cache its files for offline use. Routine data is local to each browser and address.

## Read a book

Open **Books** → **Add a book**, choose a PDF or text file, then select **Import book**. On Android, select **Drive** in the system file picker if it appears. In a browser, you can download a file from Drive first and then select it from your downloads.

- For a PDF up to 20 MB, tap **Convert to EPUB** to read the reflowed text. In the Books library, open **Download files** below the book to save its EPUB or the original PDF.
- For a scan, run optical character recognition (OCR) before importing. Conversion uses the PDF’s selectable text, so complex layouts may read better in the original.
- For a text file up to 8 MB, use UTF-8 or UTF-16 with a byte order mark.

SmartBot stores the book and last section on the device. Conversion and reading work offline after import and the app’s initial load.

Use **Back to Workspace** in the library or select **SmartBot** in the app header to return to the homepage.

## News

Open **Settings → News** in the browser or Android app. Select any combination of English, Français, and Tiếng Việt. Choose interests such as **Startups**, **AI**, **Programming**, and **Open source**. Select English and **Show HN (English)** to see community projects. **All topics** includes a mix from the available feeds. Changes save automatically on this device.

Open **Workspace → News** for the first ten matching headlines. Tap **More** for the next ten while more stories are available. The star in the News header opens all your saved articles, including those outside your current preferences.

News marks the feed **For you** after you open an article. Recent reading activity helps it rank related, unread stories within your language and topic choices. Turn **Personalize headlines** off in **Settings → News** to use the freshness-based feed, or use **Reset recommendations** to clear what News learned. Reading activity stays on this device.

News draws on free-to-read sources from the US, France, and Vietnam. French coverage includes LinuxFr.org community posts, ActuIA, and La French Tech. English sources include Hacker News, Show HN, Y Combinator, GitHub Blog, and Viet Nam News’ BizHub. Dân trí supplies Vietnamese tech and business headlines. Star a headline to keep it available offline. [News source verification](docs/product-plan.md#verify-news-sources)

NASA releases open as text, with a source link in the byline. Starred articles keep their downloaded text on this device, independently of the eight-story recent cache. Previously saved Canada.ca releases remain in Saved. Loading new articles needs internet. Reading saved text works offline.

Tap a Tuổi Trẻ headline to open the publisher’s full article with its original photos. Use Back to return to your list. The star beside the headline keeps the RSS summary on your device for offline reading. Live Vietnamese feeds use the Python preview or the Android APK. [Tuổi Trẻ RSS channels and terms](https://tuoitre.vn/rss.htm)

## Markets

Open **Workspace → Markets** in the local browser preview or Android app. Choose a U.S. stock or ETF to see its latest available closing price and change from the prior close. Switch between one week, one month, three months, six months, year to date, and one year. Tap or move across the chart to inspect a date, or focus the chart and use the arrow keys. **Price history table** lists the daily closes in the selected range. The app fetches daily closes from the public `post-no-preference/stocks` dataset on DoltHub without an account or API key. [DoltHub stock prices](https://www.dolthub.com/repositories/post-no-preference/stocks)

Downloaded daily closes reopen offline on the same device. If a ticker has no saved prices and the public feed is unavailable, SmartBot tries the TradingView chart. The local Python preview can also use Alpha Vantage as a fallback when `SMARTBOT_ALPHA_VANTAGE_API_KEY` is set in the server environment. [TradingView Symbol Overview](https://www.tradingview.com/widget-docs/widgets/charts/symbol-overview/) [Alpha Vantage API key](https://www.alphavantage.co/support/#api-key)

## Listen to podcasts

Open **Workspace → Music → Podcasts**. Search by name, paste a public HTTPS RSS link, or open the suggested franceinfo show. Follow shows and use **Continue listening** to pick up where you left off.

Streaming uses the publisher’s audio and requires internet. SmartBot requires no listening subscription and inserts no ads. Publishers may include ads in their audio.

For a local preview, run these commands from the repository root with Node.js 22. Keep the podcast service running while using the regular browser preview.

```sh
npm --prefix podcast-service ci
npm --prefix podcast-service start
```

Set `PODCAST_INDEX_KEY` and `PODCAST_INDEX_SECRET` in the service environment to enable full name search. The franceinfo suggestion and pasted feeds work independently. To use podcasts on Android without a computer running, see the [podcast pilot setup](docs/plans/podcast-listening.md#pilot-setup).

## Ask SmartBot

Set at least one provider key in the environment that runs the Python preview server. Restart the preview after changing its environment. Open **Settings** and choose a provider under **Assistant**. SmartBot saves your choice in this browser.

| Provider | Server API key | Optional model override |
| --- | --- | --- |
| OpenAI | `SMARTBOT_OPENAI_API_KEY` or `OPENAI_API_KEY` | `SMARTBOT_OPENAI_MODEL` defaults to `gpt-4o-mini`. `SMARTBOT_OPENAI_TRANSCRIPTION_MODEL` defaults to `gpt-4o-mini-transcribe`. |
| Gemini | `SMARTBOT_GEMINI_API_KEY` or `GEMINI_API_KEY` | `SMARTBOT_GEMINI_MODEL` defaults to `gemini-2.5-flash`. Use an audio-capable model for voice. |

In a browser, select **Ask SmartBot** at the bottom of any screen. Type a question and select the send arrow or press Enter. Use Shift+Enter for a new line. To ask by voice, select the microphone, allow access, then select stop to transcribe. You can edit the transcript before sending. Use **Read aloud** if your browser provides speech synthesis. The chat lasts for the current page session. The chosen provider receives the recording for transcription and recent conversation turns when you send a question.

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
node --test tests/planner.test.mjs tests/text-book.test.mjs tests/news.test.mjs
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
