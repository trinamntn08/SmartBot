# SmartBot

SmartBot helps you decide what to do today for your personal goals. Each morning, it suggests a short plan you can edit to fit the 15–30 minutes you want to spend. You can choose a news article from a shortlist, make progress on a book, and learn five words in French, English, or Japanese.

SmartBot starts as a mobile-first web app. The first working slice covers the daily reading routine and saves progress in the browser. News, vocabulary, and other activities are planned.

Read the [product and development plan](docs/product-plan.md) for the screens, daily planning rules, architecture, and implementation milestones.

## Browser preview

[Open SmartBot in your browser](http://localhost:8000/). The link works on the computer running the local preview.

On Windows, double-click [preview.cmd](preview.cmd) in File Explorer to start the preview and open it in your default browser. If the launcher starts the server, keep its window open while you use SmartBot. It uses the Python 3 already installed on your computer.

The app needs an initial online load at a given address to cache its files for offline use. For testing offline on a phone, serve `web/` over HTTPS. Routine data is local to each browser and address.

## Development

To serve the preview without opening a browser automatically, run this from the repository root with Python 3.

```sh
python -m http.server 8000 --bind 127.0.0.1 --directory web
```

Run the planner tests with Node.js 22 or newer.

```sh
node --test tests/planner.test.mjs
```

- See [current status](docs/status.md) and the [first web implementation plan](docs/plans/first-web-slice.md) for what works and the next milestone.
- See the [Codex setup guide](docs/codex-setup.md) and [AGENTS.md](AGENTS.md) for project roles and working instructions.
- The [documentation index](docs/README.md) links to all current guides.
