"""Read market prices for the local preview."""

from datetime import date
from http.client import HTTPException, HTTPSConnection
import json
from math import isfinite
import os
import re
import time
from urllib.parse import urlencode
from urllib.request import Request, urlopen


MAX_RESPONSE = 128 * 1024
MAX_ARCHIVE_RANGE = 2 * 1024 * 1024
ARCHIVE_URL = "https://github.com/Johnbrick123/sp500-data/releases/download/data/prices.parquet"
BITCOIN_CSV = "https://raw.githubusercontent.com/daniegitx1/btc-price-history/main/data/btc_usd_daily.csv"
COINBASE_HISTORY = "https://raw.githubusercontent.com/akpasz/btc-data/main/data/relative.json"
DNSE_HISTORY = "https://services.entrade.com.vn/chart-api/v2/ohlcs/stock"


class MarketError(Exception):
    def __init__(self, status, message):
        super().__init__(message)
        self.status = status


def validate_symbol(symbol):
    if not re.fullmatch(r"[A-Z]{1,5}", symbol):
        raise MarketError(400, "Choose a valid U.S. stock or ETF symbol.")


def market_archive(start, end):
    if not all(re.fullmatch(r"[0-9]{1,9}", value) for value in (start, end)):
        raise MarketError(400, "Invalid market data range.")
    start, end = int(start), int(end)
    length = end - start + 1
    if not 1 <= length <= MAX_ARCHIVE_RANGE:
        raise MarketError(400, "Invalid market data range.")
    requested = f"{start}-{end}"
    request = Request(ARCHIVE_URL, headers={"Range": f"bytes={requested}", "Accept-Encoding": "identity"})
    try:
        with urlopen(request, timeout=10) as response:
            content_range = response.headers.get("Content-Range", "")
            etag = response.headers.get("ETag", "")
            if response.status != 206 or not content_range.startswith(f"bytes {requested}/") or not etag:
                raise ValueError("The provider did not return the requested range")
            body = response.read(length + 1)
        if len(body) != length:
            raise ValueError("Incomplete market data range")
        return body, content_range, etag
    except (OSError, HTTPException, ValueError):
        raise MarketError(502, "Daily closing prices could not be downloaded.") from None


def crypto_history(symbol, source):
    if not re.fullmatch(r"[A-Z0-9]{2,12}-USD", symbol):
        raise MarketError(400, "Choose a valid cryptocurrency paired with USD.")
    pair = symbol.replace("-", "").lower()
    if source == "bitstamp-ticker":
        url = f"https://www.bitstamp.net/api/v2/ticker/{pair}/"
        return download_history(url, MAX_RESPONSE, "Cryptocurrency quote"), "application/json"
    if source == "bitstamp":
        url = f"https://www.bitstamp.net/api/v2/ohlc/{pair}/?step=86400&limit=400&exclude_current_candle=true"
        content_type, limit = "application/json", MAX_RESPONSE
    elif source == "archive" and symbol == "BTC-USD":
        url, content_type, limit = BITCOIN_CSV, "text/csv", MAX_ARCHIVE_RANGE
    elif source == "archive" and symbol in {"ETH-USD", "SOL-USD", "PAXG-USD"}:
        url, content_type, limit = COINBASE_HISTORY, "application/json", MAX_ARCHIVE_RANGE
    else:
        raise MarketError(400, "The requested cryptocurrency source is unavailable.")

    return download_history(url, limit, "Cryptocurrency closing prices"), content_type


def vietnam_history(symbol):
    if not re.fullmatch(r"[A-Z0-9]{3}", symbol):
        raise MarketError(400, "Choose a valid Vietnamese stock symbol.")
    end = int(time.time())
    query = urlencode({"symbol": symbol, "resolution": "1D", "from": end - 400 * 86400, "to": end})
    return download_history(f"{DNSE_HISTORY}?{query}", MAX_RESPONSE, "Vietnamese stock prices")


def download_history(url, limit, description):
    try:
        with urlopen(Request(url, headers={"User-Agent": "SmartBot"}), timeout=10) as response:
            body = response.read(limit + 1)
            if response.status != 200 or not 0 < len(body) <= limit:
                raise ValueError("Unexpected market history response")
        return body
    except (OSError, HTTPException, ValueError):
        raise MarketError(502, f"{description} could not be downloaded.") from None


def daily_prices(symbol):
    validate_symbol(symbol)
    key = os.getenv("SMARTBOT_ALPHA_VANTAGE_API_KEY", "").strip()
    if not key:
        raise MarketError(503, "Set SMARTBOT_ALPHA_VANTAGE_API_KEY on the local preview server and restart it.")

    query = urlencode({
        "function": "TIME_SERIES_DAILY", "symbol": symbol, "outputsize": "compact", "apikey": key,
    })
    connection = HTTPSConnection("www.alphavantage.co", timeout=8)
    try:
        connection.request("GET", f"/query?{query}")
        response = connection.getresponse()
        if response.status == 429:
            raise MarketError(429, "The market data request limit was reached. Try again later.")
        if response.status != 200:
            raise MarketError(502, "Market prices could not be loaded. Try again later.")
        body = response.read(MAX_RESPONSE + 1)
        if len(body) > MAX_RESPONSE:
            raise ValueError("Market data response was too large")
        payload = json.loads(body)
        if not isinstance(payload, dict):
            raise ValueError("Expected a market data object")
    except (OSError, HTTPException, ValueError, RecursionError):
        raise MarketError(502, "Market prices could not be loaded. Try again later.") from None
    finally:
        connection.close()

    series = payload.get("Time Series (Daily)")
    if not isinstance(series, dict):
        notice = str(payload.get("Note", "") or payload.get("Information", "")).lower()
        if "rate limit" in notice or "calls per" in notice or "requests per" in notice:
            raise MarketError(429, "The market data request limit was reached. Try again later.")
        raise MarketError(502, f"No daily prices were returned for {symbol}. Check the provider key and try again.")

    prices = []
    for day, quote in series.items():
        try:
            parsed_day = date.fromisoformat(day)
            close = float(quote["4. close"])
        except (KeyError, TypeError, ValueError, OverflowError):
            continue
        if day == parsed_day.isoformat() and isfinite(close) and 0 < close <= 1e9:
            price = {"date": day, "close": close}
            try:
                values = [float(quote[field]) for field in ("1. open", "2. high", "3. low")]
                open_price, high, low = values
                if (all(isfinite(value) and 0 < value <= 1e9 for value in values)
                        and low <= min(open_price, close) <= max(open_price, close) <= high):
                    price.update(open=open_price, high=high, low=low)
            except (KeyError, TypeError, ValueError, OverflowError):
                pass
            prices.append(price)
    prices.sort(key=lambda price: price["date"])
    if not prices:
        raise MarketError(502, f"No daily prices were returned for {symbol}.")
    return {"symbol": symbol, "prices": prices[-100:]}
