"""Read daily U.S. stock prices for the local preview."""

from datetime import date
from http.client import HTTPException, HTTPSConnection
import json
from math import isfinite
import os
import re
from urllib.parse import urlencode
from urllib.request import urlopen


MAX_RESPONSE = 128 * 1024


class MarketError(Exception):
    def __init__(self, status, message):
        super().__init__(message)
        self.status = status


def validate_symbol(symbol):
    if not re.fullmatch(r"[A-Z]{1,5}", symbol):
        raise MarketError(400, "Choose a valid U.S. stock or ETF symbol.")


def market_history(symbol):
    validate_symbol(symbol)
    query = urlencode({"q": (
        "SELECT CAST(date AS CHAR) AS date, close FROM ohlcv "
        f"WHERE act_symbol = '{symbol}' AND date >= CURRENT_DATE - INTERVAL 400 DAY "
        "ORDER BY date DESC LIMIT 280"
    )})
    try:
        with urlopen(f"https://www.dolthub.com/api/v1alpha1/post-no-preference/stocks?{query}", timeout=8) as response:
            body = response.read(MAX_RESPONSE + 1)
        if len(body) > MAX_RESPONSE:
            raise ValueError("Market history response was too large")
        return json.loads(body)
    except (OSError, HTTPException, ValueError, RecursionError):
        raise MarketError(502, "Daily closing prices could not be downloaded.") from None


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
            prices.append({"date": day, "close": close})
    prices.sort(key=lambda price: price["date"])
    if not prices:
        raise MarketError(502, f"No daily prices were returned for {symbol}.")
    return {"symbol": symbol, "prices": prices[-100:]}
