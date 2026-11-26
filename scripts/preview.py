"""Serve SmartBot and its optional assistant on the local computer."""

import argparse
from functools import partial
from hashlib import sha256
from http.client import HTTPException, HTTPSConnection
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from io import BytesIO
import json
from pathlib import Path
import re
import socket
from urllib.parse import parse_qs, urlsplit
from urllib.request import urlopen
import webbrowser

from assistant_api import (
    AssistantError, MAX_AUDIO, MAX_JSON, ask, configured_providers, transcribe, validated_messages,
)
from market_api import MarketError, crypto_history, daily_prices, market_archive, vietnam_history
from youtube_api import YouTubeError, key_status, search_music, update_key


HOST = "127.0.0.1"
PORT = 8000
WEB_ROOT = Path(__file__).resolve().parents[1] / "web"
API = "/api/assistant"
YOUTUBE_API = "/api/youtube"
MARKET_API = "/api/markets/daily"
MARKET_ARCHIVE_API = "/api/markets/archive"
MARKET_CRYPTO_API = "/api/markets/crypto"
MARKET_VIETNAM_API = "/api/markets/vietnam"
REFRESH = "/refresh"
REFRESH_PAGE = Path(__file__).with_name("preview-refresh.html")
WORKER = "/sw.js"
NEWS_FEEDS = json.loads((WEB_ROOT / "news-feeds.json").read_text(encoding="utf-8"))
NEWS_FEED_PREFIX = "/api/news/"
TUOITRE_FEED_PREFIX = "/api/tuoitre/"


def preview_worker(directory):
    """Tie the preview worker and its offline cache to the served web files."""
    root = Path(directory)
    worker = root / "sw.js"
    source = worker.read_bytes()
    revision = sha256()
    for path in sorted(root.rglob("*")):
        if path.is_file():
            data = source if path == worker else path.read_bytes()
            revision.update(path.relative_to(root).as_posix().encode() + b"\0")
            revision.update(sha256(data).digest())
    return f"self.smartBotPreviewRevision = '{revision.hexdigest()}';\n".encode() + source


class PreviewServer(ThreadingHTTPServer):
    allow_reuse_address = not hasattr(socket, "SO_EXCLUSIVEADDRUSE")
    allow_reuse_port = False

    def server_bind(self):
        if hasattr(socket, "SO_EXCLUSIVEADDRUSE"):
            # Windows address reuse can let two preview servers share one port.
            self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        super().server_bind()


class PreviewHandler(SimpleHTTPRequestHandler):
    def read_news_feed(self, url):
        publisher = urlsplit(url)
        connection = HTTPSConnection(publisher.netloc, timeout=8)
        try:
            connection.request("GET", publisher.path, headers={"User-Agent": "SmartBot RSS Reader/1.0"})
            response = connection.getresponse()
            if response.status == 200:
                body = response.read(512 * 1024 + 1)
                if len(body) <= 512 * 1024:
                    return body
        except (OSError, HTTPException):
            pass
        finally:
            connection.close()
        return None

    def send_head(self):
        if self.path.startswith((NEWS_FEED_PREFIX, TUOITRE_FEED_PREFIX)):
            if not self.local_request():
                return self.send_error(403)
            section = self.path.removeprefix(TUOITRE_FEED_PREFIX)
            url = NEWS_FEEDS.get(self.path.removeprefix(NEWS_FEED_PREFIX))
            if re.fullmatch(r"[a-z-]{1,32}", section):
                url = f"https://tuoitre.vn/rss/{section}.rss"
            if url is None:
                return self.send_error(403)
            body = self.read_news_feed(url)
            if body is None:
                return self.send_error(502)
            content_type = "text/plain; charset=utf-8"
        elif self.path == REFRESH:
            body, content_type = REFRESH_PAGE.read_bytes(), "text/html; charset=utf-8"
        elif self.path == WORKER:
            body, content_type = preview_worker(self.directory), "text/javascript; charset=utf-8"
        else:
            return super().send_head()
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        return BytesIO(body)

    def local_request(self):
        port = self.server.server_port
        host = self.headers.get("Host", "")
        origin = self.headers.get("Origin")
        return host in {f"localhost:{port}", f"127.0.0.1:{port}"} and origin in (None, f"http://{host}")

    def send_json(self, status, payload):
        body = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_request(self, code="-", size="-"):
        if self.path.partition("?")[0] == f"{YOUTUBE_API}/search":
            self.log_message('"%s %s/search %s" %s %s', self.command, YOUTUBE_API, self.request_version, code, size)
            return
        super().log_request(code, size)

    def do_GET(self):
        path, _, query = self.path.partition("?")
        if path in (YOUTUBE_API, f"{YOUTUBE_API}/search"):
            if not self.local_request() or self.headers.get("X-SmartBot-YouTube") != "music":
                self.send_json(403, {"error": "Open SmartBot using its local preview address."})
                return
            if path == YOUTUBE_API:
                self.send_json(200, key_status())
                return
            values = parse_qs(query, keep_blank_values=True).get("q", [])
            try:
                result = search_music(values[0] if len(values) == 1 else "")
            except YouTubeError as error:
                self.send_json(error.status, {"error": str(error)})
            else:
                self.send_json(200, result)
            return
        if path in (MARKET_ARCHIVE_API, MARKET_CRYPTO_API, MARKET_VIETNAM_API, MARKET_API):
            if not self.local_request() or self.headers.get("X-SmartBot-Market") != "daily":
                self.send_json(403, {"error": "Open SmartBot using its local preview address."})
                return
            self.serve_market(path, parse_qs(query, keep_blank_values=True))
            return
        if self.path != API:
            super().do_GET()
            return
        if not self.local_request():
            self.send_json(403, {"error": "Open SmartBot using its local preview address."})
            return
        self.send_json(200, {"providers": [
            {"id": provider.id, "label": provider.label} for provider in configured_providers().values()
        ]})

    def serve_market(self, path, query):
        def parameter(name):
            values = query.get(name, [])
            return values[0] if len(values) == 1 else ""

        try:
            if path == MARKET_API:
                self.send_json(200, daily_prices(parameter("symbol")))
                return
            if path == MARKET_CRYPTO_API:
                body, content_type = crypto_history(parameter("symbol"), parameter("source"))
                status, extra_headers = 200, {}
            elif path == MARKET_VIETNAM_API:
                body, content_type = vietnam_history(parameter("symbol")), "application/json"
                status, extra_headers = 200, {}
            else:
                body, content_range, etag = market_archive(parameter("start"), parameter("end"))
                content_type = "application/octet-stream"
                status, extra_headers = 206, {"Content-Range": content_range, "ETag": etag}
        except MarketError as error:
            self.send_json(error.status, {"error": str(error)})
            return
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        for header, value in extra_headers.items():
            self.send_header(header, value)
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def read_body(self, max_size):
        length = self.headers.get("Content-Length", "")
        if not length.isascii() or not length.isdecimal() or len(length) > 9:
            raise AssistantError(400, "The request must have a valid length.")
        length = int(length)
        if not length or length > max_size:
            raise AssistantError(413, "This question or recording is too large.")
        self.connection.settimeout(10)
        try:
            body = self.rfile.read(length)
        except (TimeoutError, OSError):
            raise AssistantError(408, "The upload timed out. Try again.") from None
        if len(body) != length:
            raise AssistantError(400, "The upload ended early. Try again.")
        return body

    def do_POST(self):
        try:
            result = self.youtube_key_response() if self.path == YOUTUBE_API else self.assistant_response()
        except (AssistantError, YouTubeError) as error:
            self.send_json(error.status, {"error": str(error)})
        else:
            self.send_json(200, result)

    def youtube_key_response(self):
        if (not self.local_request() or not self.headers.get("Origin")
                or self.headers.get("X-SmartBot-YouTube") != "music"):
            raise YouTubeError(403, "Open YouTube search inside the local SmartBot preview.")
        if self.headers.get_content_type() != "application/json":
            raise YouTubeError(415, "Send the YouTube search setup as JSON.")
        try:
            data = json.loads(self.read_body(512))
        except (ValueError, RecursionError):
            raise YouTubeError(400, "Enter a valid YouTube Data API key.") from None
        return update_key(data.get("key") if isinstance(data, dict) else None)

    def assistant_response(self):
        if self.path not in {f"{API}/ask", f"{API}/transcribe"}:
            raise AssistantError(404, "This assistant endpoint was not found.")
        if not self.local_request():
            raise AssistantError(403, "Open SmartBot using its local preview address.")
        provider = configured_providers().get(self.headers.get("X-SmartBot-Provider"))
        if provider is None:
            raise AssistantError(503, "This provider is unavailable. Check the API key on the SmartBot server.")
        if self.path.endswith("/ask"):
            if self.headers.get_content_type() != "application/json":
                raise AssistantError(415, "Send the question as JSON.")
            try:
                payload = json.loads(self.read_body(MAX_JSON))
            except (ValueError, RecursionError):
                raise AssistantError(400, "The question must be valid JSON.") from None
            messages = payload.get("messages") if isinstance(payload, dict) else None
            return {"text": ask(provider, validated_messages(messages))}
        if self.headers.get_content_type() != "audio/wav":
            raise AssistantError(415, "Send a WAV recording.")
        audio = self.read_body(MAX_AUDIO)
        if audio[:4] != b"RIFF" or audio[8:12] != b"WAVE":
            raise AssistantError(400, "SmartBot could not read the WAV recording.")
        return {"text": transcribe(provider, audio)}


def preview_is_running(port):
    base_url = f"http://{HOST}:{port}"
    try:
        with urlopen(base_url + REFRESH, timeout=2) as response:
            if response.read() != REFRESH_PAGE.read_bytes():
                return False
        with urlopen(base_url + WORKER, timeout=2) as response:
            return response.read() == preview_worker(WEB_ROOT)
    except OSError:
        return False


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=PORT)
    parser.add_argument("--no-browser", action="store_true")
    args = parser.parse_args()
    if not 1 <= args.port <= 65535:
        parser.error("--port must be between 1 and 65535")
    preview_url = f"http://localhost:{args.port}{REFRESH}"
    handler = partial(PreviewHandler, directory=WEB_ROOT)
    try:
        server = PreviewServer((HOST, args.port), handler)
    except OSError as error:
        if not preview_is_running(args.port):
            print(f"SmartBot could not start its local preview on port {args.port}. {error}", flush=True)
            return 1
        print(f"SmartBot preview is available at {preview_url}", flush=True)
        if not args.no_browser:
            webbrowser.open_new_tab(preview_url)
        return 0

    with server:
        print(f"SmartBot preview is available at {preview_url} (Ctrl+C to stop).", flush=True)
        if not args.no_browser:
            webbrowser.open_new_tab(preview_url)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
