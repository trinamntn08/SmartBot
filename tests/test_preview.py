"""Check the local preview's versioned browser entry points."""

from functools import partial
import json
from pathlib import Path
import sys
from tempfile import TemporaryDirectory
from threading import Thread
import unittest
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.request import Request, urlopen

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from preview import PreviewHandler, PreviewServer


class PreviewTests(unittest.TestCase):
    def test_crypto_history_uses_fixed_public_sources_for_usd_pairs(self):
        with PreviewServer(("127.0.0.1", 0), PreviewHandler) as server:
            thread = Thread(target=server.serve_forever, kwargs={"poll_interval": 0.01})
            thread.start()
            url = f"http://127.0.0.1:{server.server_port}/api/markets/crypto?"
            headers = {"X-SmartBot-Market": "daily"}
            try:
                with patch("market_api.urlopen") as upstream:
                    for query in ("symbol=../BTC-USD&source=bitstamp", "symbol=ETH-USD&source=other",
                                  "symbol=ETH-USD&symbol=BTC-USD&source=archive", "symbol=XRP-USD&source=archive"):
                        with self.assertRaises(HTTPError) as error:
                            urlopen(Request(url + query, headers=headers), timeout=2)
                        self.assertEqual(error.exception.code, 400)
                    upstream.assert_not_called()

                    response = upstream.return_value.__enter__.return_value
                    response.status = 200
                    response.read.return_value = b'{"data":{"pair":"DOGE/USD","ohlc":[]}}'
                    request = Request(url + "symbol=DOGE-USD&source=bitstamp", headers=headers)
                    with urlopen(request, timeout=2) as result:
                        self.assertEqual(result.headers["Content-Type"], "application/json")
                        self.assertEqual(json.load(result)["data"]["pair"], "DOGE/USD")
                    target = upstream.call_args.args[0].full_url
                    self.assertEqual(target, "https://www.bitstamp.net/api/v2/ohlc/dogeusd/"
                                     "?step=86400&limit=400&exclude_current_candle=true")

                    response.read.return_value = b"date_utc,open,high,low,close\n"
                    request = Request(url + "symbol=BTC-USD&source=archive", headers=headers)
                    with urlopen(request, timeout=2) as result:
                        self.assertEqual(result.headers["Content-Type"], "text/csv")
                        self.assertEqual(result.read(), response.read.return_value)
                    self.assertEqual(upstream.call_args.args[0].full_url,
                                     "https://raw.githubusercontent.com/daniegitx1/btc-price-history/main/data/btc_usd_daily.csv")
            finally:
                server.shutdown()
                thread.join(timeout=2)

    def test_market_archive_proxies_only_bounded_ranges_from_the_public_dataset(self):
        with PreviewServer(("127.0.0.1", 0), PreviewHandler) as server:
            thread = Thread(target=server.serve_forever, kwargs={"poll_interval": 0.01})
            thread.start()
            url = f"http://127.0.0.1:{server.server_port}/api/markets/archive?"
            headers = {"X-SmartBot-Market": "daily"}
            try:
                with patch("market_api.urlopen") as upstream:
                    for invalid, status in ((url + "start=0&end=3", 403),
                                            (Request(url + "start=0&end=99999999", headers=headers), 400)):
                        with self.assertRaises(HTTPError) as error:
                            urlopen(invalid, timeout=2)
                        self.assertEqual(error.exception.code, status)
                    upstream.assert_not_called()

                    response = upstream.return_value.__enter__.return_value
                    response.status = 206
                    response.headers = {"Content-Range": "bytes 0-3/100", "ETag": '"archive-revision"'}
                    response.read.return_value = b"PAR1"
                    request = Request(url + "start=0&end=3", headers=headers)
                    with urlopen(request, timeout=2) as result:
                        self.assertEqual(result.status, 206)
                        self.assertEqual(result.headers["Content-Range"], "bytes 0-3/100")
                        self.assertEqual(result.headers["ETag"], '"archive-revision"')
                        self.assertEqual(result.read(), b"PAR1")
                    target = upstream.call_args.args[0]
                    self.assertEqual(target.full_url, "https://github.com/Johnbrick123/sp500-data/releases/download/data/prices.parquet")
                    self.assertEqual(target.get_header("Range"), "bytes=0-3")

                    response.status = 200
                    with self.assertRaises(HTTPError) as error:
                        urlopen(request, timeout=2)
                    self.assertEqual(error.exception.code, 502)
            finally:
                server.shutdown()
                thread.join()

    def test_market_prices_keep_provider_credentials_server_side_and_normalize_closes(self):
        with PreviewServer(("127.0.0.1", 0), PreviewHandler) as server:
            thread = Thread(target=server.serve_forever, kwargs={"poll_interval": 0.01})
            thread.start()
            url = f"http://127.0.0.1:{server.server_port}/api/markets/daily?symbol="

            def request(symbol):
                return Request(url + symbol, headers={"X-SmartBot-Market": "daily"})

            try:
                with patch("market_api.HTTPSConnection") as connect:
                    for invalid, status in ((url + "SPY", 403), (request("SPY&symbol=AAPL"), 400),
                                            (request("https%3A%2F%2Fexample.org"), 400)):
                        with self.assertRaises(HTTPError) as error:
                            urlopen(invalid, timeout=2)
                        self.assertEqual(error.exception.code, status)
                    with patch.dict("os.environ", {"SMARTBOT_ALPHA_VANTAGE_API_KEY": ""}):
                        with self.assertRaises(HTTPError) as error:
                            urlopen(request("SPY"), timeout=2)
                        self.assertEqual(error.exception.code, 503)
                    connect.assert_not_called()

                    upstream = connect.return_value.getresponse.return_value
                    upstream.status = 200
                    upstream.read.return_value = json.dumps({"Time Series (Daily)": {
                        "2026-11-23": {"4. close": "675.25"}, "2026-11-20": {"4. close": "660.10"},
                        "2026-11-19": {"4. close": "NaN"}, "2026-11-31": {"4. close": "700"},
                    }}).encode()
                    with patch.dict("os.environ", {"SMARTBOT_ALPHA_VANTAGE_API_KEY": "test-key"}):
                        with urlopen(request("SPY"), timeout=2) as result:
                            self.assertEqual(result.headers["Cache-Control"], "no-store")
                            self.assertEqual(json.load(result), {"symbol": "SPY", "prices": [
                                {"date": "2026-11-20", "close": 660.10}, {"date": "2026-11-23", "close": 675.25},
                            ]})
                        connect.assert_called_once_with("www.alphavantage.co", timeout=8)
                        connect.return_value.request.assert_called_once_with(
                            "GET", "/query?function=TIME_SERIES_DAILY&symbol=SPY&outputsize=compact&apikey=test-key"
                        )
                        upstream.read.return_value = b'{"Information": "Standard API rate limit is 25 requests per day."}'
                        with self.assertRaises(HTTPError) as error:
                            urlopen(request("SPY"), timeout=2)
                        self.assertEqual(error.exception.code, 429)
            finally:
                server.shutdown()
                thread.join()

    def test_news_feeds_are_allowlisted_and_cannot_redirect_or_exceed_the_size_limit(self):
        with PreviewServer(("127.0.0.1", 0), PreviewHandler) as server:
            thread = Thread(target=server.serve_forever, kwargs={"poll_interval": 0.01})
            thread.start()
            base = f"http://127.0.0.1:{server.server_port}/api/news/"
            try:
                with patch("preview.HTTPSConnection") as connect:
                    response = connect.return_value.getresponse.return_value
                    for path in ("unknown", "hacker-news?url=example.org"):
                        with self.assertRaises(HTTPError) as invalid:
                            urlopen(base + path, timeout=2)
                        self.assertEqual(invalid.exception.code, 403)
                    connect.assert_not_called()

                    response.status = 200
                    response.read.return_value = b"<rss/>"
                    with urlopen(base + "hacker-news", timeout=2) as feed:
                        self.assertEqual(feed.read(), b"<rss/>")
                        self.assertEqual(feed.headers.get_content_type(), "text/plain")
                        self.assertEqual(feed.headers["Cache-Control"], "no-store")
                    connect.assert_called_once_with("news.ycombinator.com", timeout=8)
                    connect.return_value.request.assert_called_once_with(
                        "GET", "/rss", headers={"User-Agent": "SmartBot RSS Reader/1.0"}
                    )

                    response.status = 302
                    with self.assertRaises(HTTPError) as redirect:
                        urlopen(base + "hacker-news", timeout=2)
                    self.assertEqual(redirect.exception.code, 502)
                    response.status = 200
                    response.read.return_value = b"x" * (512 * 1024 + 1)
                    with self.assertRaises(HTTPError) as oversized:
                        urlopen(base + "hacker-news", timeout=2)
                    self.assertEqual(oversized.exception.code, 502)
            finally:
                server.shutdown()
                thread.join()

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
                    connect.return_value.request.assert_called_once_with(
                        "GET", "/rss/giai-tri.rss", headers={"User-Agent": "SmartBot RSS Reader/1.0"}
                    )
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
