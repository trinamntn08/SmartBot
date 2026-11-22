"""Launch the local SmartBot preview with Python's static file server."""

import webbrowser
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.request import urlopen


HOST = "127.0.0.1"
PORT = 8000
URL = "http://localhost:8000/"
WEB_ROOT = Path(__file__).resolve().parents[1] / "web"


def preview_is_running():
    index = (WEB_ROOT / "index.html").read_bytes()
    try:
        with urlopen(f"http://{HOST}:{PORT}/index.html", timeout=2) as response:
            return response.read(len(index) + 1) == index
    except OSError:
        return False


def open_preview():
    print(f"SmartBot preview is available at {URL}", flush=True)
    webbrowser.open_new_tab(URL)


def main():
    if preview_is_running():
        open_preview()
        return 0

    handler = partial(SimpleHTTPRequestHandler, directory=WEB_ROOT)
    try:
        server = ThreadingHTTPServer((HOST, PORT), handler)
    except OSError as error:
        if preview_is_running():
            open_preview()
            return 0
        print(f"SmartBot could not start its local preview on port {PORT}. {error}")
        return 1

    with server:
        print("Keep this window open while using SmartBot. Press Ctrl+C to stop.")
        open_preview()
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
