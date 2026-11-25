"""Extract closing-price facts for SmartBot's starter tickers from the public S&P 500 archive."""

import argparse
from csv import DictReader
from datetime import date, timedelta
import json
from math import isfinite
from pathlib import Path
import re

import pyarrow.parquet as parquet


SYMBOLS = ("SPY", "QQQ", "AAPL", "AMZN", "GOOGL", "MSFT", "NVDA", "TSLA")
ETF_NAMES = {
    "AGG": "iShares Core U.S. Aggregate Bond ETF",
    "DIA": "SPDR Dow Jones Industrial Average ETF Trust",
    "GLD": "SPDR Gold Shares",
    "IVV": "iShares Core S&P 500 ETF",
    "IWM": "iShares Russell 2000 ETF",
    "SLV": "iShares Silver Trust",
    "VEA": "Vanguard FTSE Developed Markets ETF",
    "VOO": "Vanguard S&P 500 ETF",
    "VTI": "Vanguard Total Stock Market ETF",
    "VWO": "Vanguard FTSE Emerging Markets ETF",
}


def make_snapshot(archive):
    table = parquet.read_table(archive, filters=[("ticker", "in", SYMBOLS)], columns=["ticker", "date", "close"])
    latest = max(day.date() for day in table["date"].to_pylist())
    start = latest - timedelta(days=400)
    series = {symbol: [] for symbol in SYMBOLS}
    for row in table.to_pylist():
        day, close = row["date"].date(), row["close"]
        if day >= start and close is not None and isfinite(close) and 0 < close <= 1e9:
            series[row["ticker"]].append({"date": day.isoformat(), "close": round(close, 2)})

    for symbol, prices in series.items():
        prices.sort(key=lambda price: price["date"])
        if (not 240 <= len(prices) <= 280 or prices[-1]["date"] != latest.isoformat()
                or len({price["date"] for price in prices}) != len(prices)):
            raise ValueError(f"Incomplete or duplicate price history for {symbol}")
    return {"asOf": latest.isoformat(), "series": series}


def bitcoin_closes(path):
    with path.open(encoding="utf-8", newline="") as prices:
        rows = {date.fromisoformat(row["date_utc"]): float(row["close"]) for row in DictReader(prices)}
    latest = max(rows)
    series = [{"date": day.isoformat(), "close": close} for day, close in sorted(rows.items())
              if day >= latest - timedelta(days=399) and isfinite(close) and 0 < close <= 1e9]
    if len(series) != 400:
        raise ValueError("Incomplete BTC/USD daily candles")
    return series


def make_catalog(archive, latest, companies, listings):
    # Searchable tickers must have a close in the archive's latest session.
    rows = parquet.read_table(archive, filters=[("date", "=", latest)], columns=["ticker", "close"]).to_pylist()
    symbols = sorted({row["ticker"] for row in rows if row["close"] and re.fullmatch(r"[A-Z][A-Z0-9]{0,8}(?:-[A-Z])?", row["ticker"])})
    with listings.open(encoding="utf-8-sig", newline="") as file:
        names = {row["Symbol"]: row["Security Name"] for row in DictReader(file)}
    with companies.open(encoding="utf-8-sig", newline="") as file:
        names.update({row["Symbol"].replace(".", "-"): row["Security"] for row in DictReader(file)})
    names.update(ETF_NAMES)
    return {symbol: names.get(symbol, symbol).strip() for symbol in symbols}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", help="Path to the published prices.parquet")
    parser.add_argument("--bitcoin", type=Path, required=True, help="Path to the published btc_usd_daily.csv")
    parser.add_argument("--catalog", nargs=3, type=Path, metavar=("COMPANIES", "LISTINGS", "OUTPUT"))
    args = parser.parse_args()
    snapshot = make_snapshot(args.archive)
    bitcoin = bitcoin_closes(args.bitcoin)
    snapshot["series"]["BTC-USD"] = bitcoin
    snapshot["bitcoinAsOf"] = bitcoin[-1]["date"]
    if args.catalog:
        companies, listings, output = args.catalog
        catalog = make_catalog(args.archive, date.fromisoformat(snapshot["asOf"]), companies, listings)
        output.write_text(json.dumps(catalog, separators=(",", ":"), ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps(snapshot, separators=(",", ":")))
