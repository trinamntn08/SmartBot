"""Serve SmartBot and its optional assistant on the local computer."""

import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
from urllib.request import urlopen
import webbrowser

from assistant_api import (
    AssistantError, MAX_AUDIO, MAX_JSON, ask, configured_providers, transcribe, validated_messages,
)


HOST = "127.0.0.1"
PORT = 8000
WEB_ROOT = Path(__file__).resolve().parents[1] / "web"
API = "/api/assistant"


class PreviewHandler(SimpleHTTPRequestHandler):
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

    def do_GET(self):
        if self.path != API:
            super().do_GET()
            return
        if not self.local_request():
            self.send_json(403, {"error": "Open SmartBot using its local preview address."})
            return
        self.send_json(200, {"providers": [
            {"id": provider.id, "label": provider.label} for provider in configured_providers().values()
        ]})

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
            result = self.assistant_response()
        except AssistantError as error:
            self.send_json(error.status, {"error": str(error)})
        else:
            self.send_json(200, result)

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


def preview_is_running(base_url):
    index = (WEB_ROOT / "index.html").read_bytes()
    try:
        with urlopen(f"{base_url}/index.html", timeout=2) as response:
            if response.read(len(index) + 1) != index:
                return False
        with urlopen(f"{base_url}{API}", timeout=2) as response:
            return isinstance(json.load(response).get("providers"), list)
    except (OSError, ValueError, AttributeError):
        return False


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=PORT)
    parser.add_argument("--no-browser", action="store_true")
    args = parser.parse_args()
    if not 1 <= args.port <= 65535:
        parser.error("--port must be between 1 and 65535")
    base_url = f"http://localhost:{args.port}"
    handler = partial(PreviewHandler, directory=WEB_ROOT)
    try:
        server = ThreadingHTTPServer((HOST, args.port), handler)
    except OSError as error:
        if not preview_is_running(base_url):
            print(f"SmartBot could not start its local preview on port {args.port}. {error}", flush=True)
            return 1
        print(f"SmartBot preview is available at {base_url}/", flush=True)
        if not args.no_browser:
            webbrowser.open_new_tab(f"{base_url}/")
        return 0

    with server:
        print(f"SmartBot preview is available at {base_url}/. Press Ctrl+C to stop.", flush=True)
        if not args.no_browser:
            webbrowser.open_new_tab(f"{base_url}/")
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
