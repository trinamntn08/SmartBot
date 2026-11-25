"""Extract daily price facts for SmartBot's starter tickers from the public archives."""

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

VIETNAM_ALIASES = {"VCB": "Vietcombank", "VNM": "Vinamilk"}


def daily_bar(day, close, open_price, high, low):
    bar = {"date": day.isoformat(), "close": close}
    if (all(value is not None and isfinite(value) and 0 < value <= 1e9 for value in (open_price, high, low))
            and low <= min(open_price, close) <= max(open_price, close) <= high):
        bar.update(open=open_price, high=high, low=low)
    return bar


def make_snapshot(archive):
    table = parquet.read_table(
        archive, filters=[("ticker", "in", SYMBOLS)], columns=["ticker", "date", "open", "high", "low", "close"]
    )
    latest = max(day.date() for day in table["date"].to_pylist())
    start = latest - timedelta(days=400)
    series = {symbol: [] for symbol in SYMBOLS}
    for row in table.to_pylist():
        day, close = row["date"].date(), row["close"]
        if day >= start and close is not None and isfinite(close) and 0 < close <= 1e9:
            bar = daily_bar(day, close, row["open"], row["high"], row["low"])
            series[row["ticker"]].append({key: round(value, 2) if key != "date" else value for key, value in bar.items()})

    for symbol, prices in series.items():
        prices.sort(key=lambda price: price["date"])
        if (not 240 <= len(prices) <= 280 or prices[-1]["date"] != latest.isoformat()
                or len({price["date"] for price in prices}) != len(prices)):
            raise ValueError(f"Incomplete or duplicate price history for {symbol}")
    return {"asOf": latest.isoformat(), "series": series}


def bitcoin_history(path):
    with path.open(encoding="utf-8", newline="") as prices:
        rows = {date.fromisoformat(row["date_utc"]): row for row in DictReader(prices)}
    latest = max(rows)
    series = []
    for day, row in sorted(rows.items()):
        if day < latest - timedelta(days=399):
            continue
        close = float(row["close"])
        if isfinite(close) and 0 < close <= 1e9:
            series.append(daily_bar(day, close, float(row["open"]), float(row["high"]), float(row["low"])))
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


def vietnam_catalog(path):
    listings = {}
    with path.open(encoding="utf-8-sig", newline="") as file:
        for row in DictReader(file):
            symbol = row["symbol"].strip().upper()
            exchange = row["exchange"].strip().upper()
            if not re.fullmatch(r"[A-Z0-9]{3}", symbol) or exchange not in {"HOSE", "HNX", "UPCOM"}:
                continue
            if symbol == "MCH":
                # Masan Consumer transferred from UPCoM to HOSE in December 2025.
                exchange = "HOSE"
            names = [row["name"].strip(), row["name_vn"].strip(), VIETNAM_ALIASES.get(symbol)]
            listings[f"{exchange}:{symbol}"] = list(dict.fromkeys(name for name in names if name))
    return dict(sorted(listings.items()))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", help="Path to the published prices.parquet")
    parser.add_argument("--bitcoin", type=Path, required=True, help="Path to the published btc_usd_daily.csv")
    parser.add_argument("--catalog", nargs=3, type=Path, metavar=("COMPANIES", "LISTINGS", "OUTPUT"))
    parser.add_argument("--vietnam-catalog", nargs=2, type=Path, metavar=("COMPANIES", "OUTPUT"))
    args = parser.parse_args()
    snapshot = make_snapshot(args.archive)
    bitcoin = bitcoin_history(args.bitcoin)
    snapshot["series"]["BTC-USD"] = bitcoin
    snapshot["bitcoinAsOf"] = bitcoin[-1]["date"]
    if args.catalog:
        companies, listings, output = args.catalog
        catalog = make_catalog(args.archive, date.fromisoformat(snapshot["asOf"]), companies, listings)
        output.write_text(json.dumps(catalog, separators=(",", ":"), ensure_ascii=False) + "\n", encoding="utf-8")
    if args.vietnam_catalog:
        companies, output = args.vietnam_catalog
        entries = [f"  {json.dumps(symbol)}: {json.dumps(names, ensure_ascii=False)}"
                   for symbol, names in vietnam_catalog(companies).items()]
        output.write_text("{\n" + ",\n".join(entries) + "\n}\n", encoding="utf-8")
    print(json.dumps(snapshot, separators=(",", ":")))
