"""Extract closing-price facts for SmartBot's starter tickers from the public S&P 500 archive."""

import argparse
from datetime import timedelta
import json
from math import isfinite

import pyarrow.parquet as parquet


SYMBOLS = ("SPY", "QQQ", "AAPL", "AMZN", "GOOGL", "MSFT", "NVDA", "TSLA")


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


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", help="Path to the published prices.parquet")
    args = parser.parse_args()
    print(json.dumps(make_snapshot(args.archive), separators=(",", ":")))
