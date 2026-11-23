"""Check the local preview's versioned browser entry points."""

from functools import partial
from pathlib import Path
import sys
from tempfile import TemporaryDirectory
from threading import Thread
import unittest
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.request import urlopen

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from preview import PreviewHandler, PreviewServer


class PreviewTests(unittest.TestCase):
    def test_vietnamese_feed_uses_fixed_publisher_and_serves_plain_text(self):
        with PreviewServer(("127.0.0.1", 0), PreviewHandler) as server:
            thread = Thread(target=server.serve_forever, kwargs={"poll_interval": 0.01})
            thread.start()
            base = f"http://127.0.0.1:{server.server_port}/api/tuoitre/"
            try:
                with patch("preview.HTTPSConnection") as connect:
                    response = connect.return_value.getresponse.return_value
                    response.status = 200
                    response.read.return_value = b"<rss/>"
                    with urlopen(base + "giai-tri", timeout=2) as feed:
                        self.assertEqual(feed.read(), b"<rss/>")
                        self.assertEqual(feed.headers.get_content_type(), "text/plain")
                    connect.assert_called_once_with("tuoitre.vn", timeout=8)
                    connect.return_value.request.assert_called_once_with("GET", "/rss/giai-tri.rss")
                    with self.assertRaises(HTTPError) as invalid:
                        urlopen(base + "giai-tri?url=another", timeout=2)
                    self.assertEqual(invalid.exception.code, 403)
                    response.status = 503
                    with self.assertRaises(HTTPError) as unavailable:
                        urlopen(base + "giai-tri", timeout=2)
                    self.assertEqual(unavailable.exception.code, 502)
            finally:
                server.shutdown()
                thread.join()

    def test_refresh_page_and_worker_bypass_the_http_cache(self):
        with TemporaryDirectory() as directory:
            root = Path(directory)
            worker_source = b"// service worker source"
            (root / "sw.js").write_bytes(worker_source)
            stylesheet = root / "styles.css"
            stylesheet.write_bytes(b"body { color: green; }")

            handler = partial(PreviewHandler, directory=directory)
            with PreviewServer(("127.0.0.1", 0), handler) as server:
                thread = Thread(target=server.serve_forever, kwargs={"poll_interval": 0.01})
                thread.start()
                base = f"http://127.0.0.1:{server.server_port}"
                try:
                    with urlopen(base + "/refresh", timeout=2) as response:
                        self.assertEqual(response.headers["Cache-Control"], "no-store")
                        self.assertIn(b"registration.update()", response.read())
                    with urlopen(base + "/sw.js", timeout=2) as response:
                        self.assertEqual(response.headers["Cache-Control"], "no-store")
                        first_worker = response.read()
                    stylesheet.write_bytes(b"body { color: white; }")
                    with urlopen(base + "/sw.js", timeout=2) as response:
                        next_worker = response.read()
                    self.assertNotEqual(first_worker, next_worker)
                    for worker in (first_worker, next_worker):
                        self.assertTrue(worker.endswith(worker_source))
                        self.assertRegex(worker, rb"^self\.smartBotPreviewRevision = '[0-9a-f]{64}';")
                finally:
                    server.shutdown()
                    thread.join()

    def test_two_preview_servers_cannot_bind_to_the_same_address(self):
        with PreviewServer(("127.0.0.1", 0), PreviewHandler) as server:
            with self.assertRaises(OSError):
                PreviewServer(server.server_address, PreviewHandler)
