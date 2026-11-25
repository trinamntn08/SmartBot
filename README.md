# SmartBot

SmartBot is a mobile-first personal workspace for books, news, questions, and daily routines. Today suggests a short plan you can edit to fit the 15–30 minutes you want to spend.

The app includes a book library with PDF-to-EPUB conversion, news in three languages, a daily reading routine, and an assistant for typed and spoken questions. See the [personal workspace plan](docs/plans/personal-workspace.md) for upcoming features.

Read the [product and development plan](docs/product-plan.md) for the screens, daily planning rules, architecture, and implementation milestones.

## Browser preview

Before each new preview or refresh, verify that a clean `main` checkout matches live GitHub `main` and includes the requested changes and their task record. [Preview verification steps](docs/codex-setup.md#verify-main-before-generating-a-preview)

The browser preview serves `web/` from the worktree that started it. Confirm that the server uses the verified worktree. Build a fresh Android preview from the same checkout. [Debug APK build](#development)

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

Select **SmartBot** in the top bar to return to the homepage. Select the three-dot button for more sections and Settings.

## News

Open **Settings → News** in the browser or Android app. Select any combination of English, Français, and Tiếng Việt. Choose interests such as **Startups**, **AI**, **Programming**, and **Open source**. Select English and **Show HN (English)** to see community projects. **All topics** includes a mix from the available feeds. Changes save automatically on this device.

Open **News** for the first ten matching headlines. Scroll to the end to load the next ten while more stories are available. The star in the News header opens all your saved articles, including those outside your current preferences.

News marks the feed **For you** after you open an article. Recent reading activity helps it rank related, unread stories within your language and topic choices. Turn **Personalize headlines** off in **Settings → News** to use the freshness-based feed, or use **Reset recommendations** to clear what News learned. Reading activity stays on this device.

News draws on free-to-read sources from the US, France, and Vietnam. French coverage includes LinuxFr.org community posts, ActuIA, and La French Tech. English sources include Hacker News, Show HN, Y Combinator, GitHub Blog, and Viet Nam News’ BizHub. Dân trí supplies Vietnamese tech and business headlines. Star a headline to keep it available offline. [News source verification](docs/product-plan.md#verify-news-sources)

NASA releases open as text, with a source link in the byline. Starred articles keep their downloaded text on this device, independently of the eight-story recent cache. Previously saved Canada.ca releases remain in Saved. Loading new articles needs internet. Reading saved text works offline.

Tap a Tuổi Trẻ headline to open the publisher’s full article with its original photos. Use Back to return to your list. The star beside the headline keeps the RSS summary on your device for offline reading. Live Vietnamese feeds use the Python preview or the Android APK. [Tuổi Trẻ RSS channels and terms](https://tuoitre.vn/rss.htm)

## Markets

Open **Workspace → Markets** in the local browser preview or Android app. Search by symbol or company name for U.S. stocks and ETFs or Vietnamese stocks on HOSE, HNX, and UPCoM. Vietnamese names work with or without accents. Search a crypto pair such as `ETH/USD` to find it directly. Tap **Add** to open the chart and save it to your **Watchlist**. Tap **Remove** on a saved symbol to take it out of the dropdown. The watchlist and downloaded prices stay on this device.

The dropdown starts with eight U.S. stocks and ETFs plus **BTC/USD**. The Android app includes their daily candles through November 24, 2026, for offline access on first launch. In the browser, these charts work offline after the app has loaded and cached them. Vietnamese daily history comes from DNSE and is displayed in VND. Search covers 785 symbols in the U.S. archive, 1,579 Vietnamese stocks in the included directory, and USD crypto pairs. The primary sources require no API key. [S&P 500 data archive](https://github.com/Johnbrick123/sp500-data) · [Bitstamp API](https://www.bitstamp.net/api/) · [BTC/USD archive](https://github.com/daniegitx1/btc-price-history) · [Coinbase history archive](https://github.com/akpasz/btc-data) · [DNSE](https://www.dnse.com.vn/) · [Vietnamese company directory](https://github.com/youngsu-park-69/vietnam-stock-data/tree/40a3c8ebc86be44b98754e87ef845b3454a01ef7)

Switch between **Line** and **Candles** and choose a range from one week to one year. A candle shows the session’s open, high, low, and close. When a source only has closing prices, Markets shows the line with a notice. Tap or move across the chart to inspect a date, or focus the chart and use the arrow keys. **Price history table** lists the daily closes. Markets remembers the last displayed symbol, range, and chart type, and SmartBot reopens there if Markets was the last screen. The chart opens with any saved prices and checks for newer daily closes when you enter or reload Markets or regain your internet connection. If a refresh fails, Markets keeps the most recent prices and offers **Retry chart** and **Open on TradingView**.

To update the bundled prices, run `python3 scripts/build-market-snapshot.py /path/to/prices.parquet --bitcoin /path/to/btc_usd_daily.csv > web/assets/market-closes.json` with PyArrow installed. To refresh the searchable U.S. equities at the same time, add `--catalog /path/to/constituents.csv /path/to/nasdaq-listed.csv web/assets/market-catalog.json`. To rebuild the Vietnamese search directory, add `--vietnam-catalog /path/to/vietnam_companies.csv web/assets/market-vietnam-catalog.json`. Online U.S. equity updates use HTTP byte ranges and the bundled MIT-licensed hyparquet and fzstd readers. [Equities download](https://github.com/Johnbrick123/sp500-data/releases/download/data/prices.parquet) · [Bitcoin download](https://raw.githubusercontent.com/daniegitx1/btc-price-history/main/data/btc_usd_daily.csv) · [S&P 500 names](https://github.com/datasets/s-and-p-500-companies) · [Nasdaq names](https://github.com/datasets/nasdaq-listings) · [Vietnamese company names](https://raw.githubusercontent.com/youngsu-park-69/vietnam-stock-data/40a3c8ebc86be44b98754e87ef845b3454a01ef7/data/vietnam_companies.csv)

## Listen to podcasts

Open **Workspace → Music → Podcasts**. Search by name, paste a public HTTPS RSS link, or open the suggested franceinfo show. Follow shows and use **Continue listening** to pick up where you left off.

Streaming uses the publisher’s audio and requires internet. SmartBot requires no listening subscription and inserts no ads. Publishers may include ads in their audio.

For a local preview, run these commands from the repository root with Node.js 22. Keep the podcast service running while using the regular browser preview.

```sh
npm --prefix podcast-service ci
npm --prefix podcast-service start
```

Set `PODCAST_INDEX_KEY` and `PODCAST_INDEX_SECRET` in the local service environment to enable full name search. The franceinfo suggestion and pasted feeds work independently of those credentials.

On Android, the default APK searches Apple Podcasts and opens public HTTPS feeds directly. Set `SMARTBOT_PODCAST_API` at build time to use a hosted catalog and feed service. [Hosted podcast service setup](docs/plans/podcast-listening.md#optional-hosted-service)

## Ask SmartBot

Tap the floating **Ask SmartBot** chat bubble, enter a search, and select the arrow or press Enter. Google Search is the default and opens results directly in your browser. On Android, results open in a browser tab over SmartBot. Tap outside the composer to close it. Drag the bubble or use the arrow keys while it has focus to move it.

Choose a provider under **Settings → Assistant**. SmartBot saves your choice on this device. Google Search works without an API key. To add GPT or Gemini to the browser preview, set a provider key in the preview server's environment and restart it.

| Provider | Server API key | Optional model override |
| --- | --- | --- |
| GPT (OpenAI) | `SMARTBOT_OPENAI_API_KEY` or `OPENAI_API_KEY` | `SMARTBOT_OPENAI_MODEL` defaults to `gpt-4o-mini`. `SMARTBOT_OPENAI_TRANSCRIPTION_MODEL` defaults to `gpt-4o-mini-transcribe`. |
| Gemini | `SMARTBOT_GEMINI_API_KEY` or `GEMINI_API_KEY` | `SMARTBOT_GEMINI_MODEL` defaults to `gemini-2.5-flash`. Use an audio-capable model for voice. |

With GPT or Gemini selected, use Shift+Enter for a new line. To ask by voice, select the microphone, allow access, then select stop to transcribe. You can edit the transcript before sending. Use **Read aloud** if your browser provides speech synthesis. The chat lasts for the current page session. The chosen provider receives the recording for transcription and recent conversation turns when you send a question.

GPT and Gemini require the Python preview server and outbound HTTPS to `api.openai.com` or `generativelanguage.googleapis.com`. The preview listens on loopback for personal use. In a restricted cloud environment, allow the hostname for the provider you choose.

## Install on Android

The debug APK is generated at `android/app/build/outputs/apk/debug/app-debug.apk`. Copy it to a phone running Android 8.0 or newer, tap the file, and follow the installation prompt. If Android asks for permission to install the APK, follow the phone's prompt for the app that opened it. [Android installation help](https://support.google.com/pixelphone/answer/7391672)

Open SmartBot from the launcher. To check offline use, turn on airplane mode, import a `.txt` book, move to the next section, then close and reopen SmartBot to check that it resumes there. The APK bundles the web app and keeps its own local progress.

## Development

Verify the preview source, then run this from the repository root with Python 3 to serve the preview without opening a browser automatically. [Preview verification steps](docs/codex-setup.md#verify-main-before-generating-a-preview)

```sh
python3 scripts/preview.py --no-browser
```

Run the planner and text import tests with Node.js 22 or newer, and the assistant API tests with Python 3.

```sh
node --test tests/planner.test.mjs tests/text-book.test.mjs tests/news.test.mjs
python3 -m unittest discover -s tests -p 'test_*.py'
```

Verify the preview source before rebuilding the Android debug APK for preview. Use a JDK 17 or 21 and install Android SDK Platform 35 and Build Tools 35.0.0. Point `JAVA_HOME` to the JDK and `ANDROID_HOME` to the SDK for the build shell. Run the wrapper from the repository root on Windows. [Preview verification steps](docs/codex-setup.md#verify-main-before-generating-a-preview)

```powershell
.\android\gradlew.bat -p android :app:assembleDebug :app:lintDebug
```

Open `android/` as a project if you prefer Android Studio. The [Android APK plan](docs/plans/android-apk-preview.md) records the packaging and checks.

- See [current status](docs/status.md) and the [first web implementation plan](docs/plans/first-web-slice.md) for what works and the next milestone.
- See the [Codex setup guide](docs/codex-setup.md) and [AGENTS.md](AGENTS.md) for project roles and working instructions.
- The [documentation index](docs/README.md) links to all current guides.
