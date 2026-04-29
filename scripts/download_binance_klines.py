#!/usr/bin/env python3
"""Download Binance BTCUSDT kline history into a simple OHLCV CSV.

The script uses Binance Vision monthly/daily archives first, then optionally
asks the live API for the newest candles after the last archive row.
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from pathlib import Path


INTERVAL_MS = {
    "1m": 60_000,
    "3m": 180_000,
    "5m": 300_000,
    "15m": 900_000,
    "30m": 1_800_000,
    "1h": 3_600_000,
    "2h": 7_200_000,
    "4h": 14_400_000,
    "6h": 21_600_000,
    "8h": 28_800_000,
    "12h": 43_200_000,
    "1d": 86_400_000,
    "3d": 259_200_000,
    "1w": 604_800_000,
}


@dataclass(frozen=True)
class ArchiveKey:
    kind: str
    label: str


def month_start(value: date) -> date:
    return date(value.year, value.month, 1)


def add_month(value: date) -> date:
    if value.month == 12:
        return date(value.year + 1, 1, 1)
    return date(value.year, value.month + 1, 1)


def month_keys(start: date, end: date) -> list[ArchiveKey]:
    keys: list[ArchiveKey] = []
    cursor = month_start(start)
    last_full_month = month_start(end)
    while cursor < last_full_month:
        keys.append(ArchiveKey("monthly", f"{cursor:%Y-%m}"))
        cursor = add_month(cursor)
    return keys


def day_keys(start: date, end: date) -> list[ArchiveKey]:
    keys: list[ArchiveKey] = []
    cursor = max(start, month_start(end))
    while cursor <= end:
        keys.append(ArchiveKey("daily", f"{cursor:%Y-%m-%d}"))
        cursor += timedelta(days=1)
    return keys


def archive_url(symbol: str, interval: str, key: ArchiveKey) -> str:
    base = "https://data.binance.vision/data/spot"
    return f"{base}/{key.kind}/klines/{symbol}/{interval}/{symbol}-{interval}-{key.label}.zip"


def fetch_bytes(url: str, timeout: int) -> bytes | None:
    request = urllib.request.Request(url, headers={"User-Agent": "btc-replay-lab/1.0"})
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return response.read()
    except urllib.error.HTTPError as exc:
        if exc.code == 404:
            return None
        raise


def normalize_timestamp_ms(raw: str | int) -> int:
    value = int(str(raw).strip())
    if value > 10_000_000_000_000:
        return value // 1000
    if value < 10_000_000_000:
        return value * 1000
    return value


def normalize_kline_row(row: list[str]) -> list[str]:
    normalized = row[:]
    normalized[0] = str(normalize_timestamp_ms(row[0]))
    return normalized


def parse_archive(content: bytes) -> list[list[str]]:
    rows: list[list[str]] = []
    with zipfile.ZipFile(io.BytesIO(content)) as zf:
        names = [name for name in zf.namelist() if name.endswith(".csv")]
        if not names:
            return rows
        with zf.open(names[0]) as handle:
            text = io.TextIOWrapper(handle, encoding="utf-8", newline="")
            reader = csv.reader(text)
            for row in reader:
                if len(row) >= 6 and row[0].isdigit():
                    rows.append(normalize_kline_row(row))
    return rows


def api_klines(symbol: str, interval: str, start_ms: int, timeout: int) -> list[list[str]]:
    rows: list[list[str]] = []
    cursor = start_ms
    interval_ms = INTERVAL_MS[interval]
    now_ms = int(time.time() * 1000)
    while cursor < now_ms:
        query = urllib.parse.urlencode(
            {
                "symbol": symbol,
                "interval": interval,
                "startTime": cursor,
                "limit": 1000,
            }
        )
        url = f"https://api.binance.com/api/v3/klines?{query}"
        request = urllib.request.Request(url, headers={"User-Agent": "btc-replay-lab/1.0"})
        with urllib.request.urlopen(request, timeout=timeout) as response:
            batch = json.loads(response.read().decode("utf-8"))
        if not batch:
            break
        for item in batch:
            rows.append([str(normalize_timestamp_ms(item[0])), str(item[1]), str(item[2]), str(item[3]), str(item[4]), str(item[5])])
        next_cursor = normalize_timestamp_ms(batch[-1][0]) + interval_ms
        if next_cursor <= cursor:
            break
        cursor = next_cursor
        time.sleep(0.15)
    return rows


def write_csv(path: Path, rows_by_time: dict[int, list[str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(["timestamp", "open", "high", "low", "close", "volume"])
        for open_time in sorted(rows_by_time):
            row = rows_by_time[open_time]
            writer.writerow([row[0], row[1], row[2], row[3], row[4], row[5]])


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Download BTCUSDT klines for BTC Replay Lab.")
    parser.add_argument("--symbol", default="BTCUSDT", help="Trading pair, default: BTCUSDT")
    parser.add_argument("--interval", default="15m", choices=sorted(INTERVAL_MS), help="Kline interval")
    parser.add_argument("--start", default="2017-08-01", help="UTC start date, YYYY-MM-DD")
    parser.add_argument(
        "--end",
        default=datetime.now(timezone.utc).date().isoformat(),
        help="UTC end date, YYYY-MM-DD",
    )
    parser.add_argument("--out", default=None, help="Output CSV path")
    parser.add_argument("--timeout", type=int, default=30, help="HTTP timeout seconds")
    parser.add_argument("--no-api-tail", action="store_true", help="Do not request newest candles from Binance API")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    symbol = args.symbol.upper()
    start_day = datetime.strptime(args.start, "%Y-%m-%d").date()
    end_day = datetime.strptime(args.end, "%Y-%m-%d").date()
    out = Path(args.out or f"data/{symbol}-{args.interval}.csv")

    keys = month_keys(start_day, end_day) + day_keys(start_day, end_day)
    rows_by_time: dict[int, list[str]] = {}

    for key in keys:
        url = archive_url(symbol, args.interval, key)
        print(f"fetch {key.kind} {key.label}", file=sys.stderr)
        content = fetch_bytes(url, args.timeout)
        if content is None:
            print(f"skip missing {key.label}", file=sys.stderr)
            continue
        for row in parse_archive(content):
            open_time = normalize_timestamp_ms(row[0])
            rows_by_time[open_time] = row

    if not args.no_api_tail and rows_by_time:
        start_ms = max(rows_by_time) + INTERVAL_MS[args.interval]
        print("fetch api tail", file=sys.stderr)
        try:
            for row in api_klines(symbol, args.interval, start_ms, args.timeout):
                rows_by_time[normalize_timestamp_ms(row[0])] = row
        except Exception as exc:  # noqa: BLE001
            print(f"api tail skipped: {exc}", file=sys.stderr)

    if not rows_by_time:
        print("No rows downloaded.", file=sys.stderr)
        return 1

    write_csv(out, rows_by_time)
    first = datetime.fromtimestamp(min(rows_by_time) / 1000, tz=timezone.utc).isoformat()
    last = datetime.fromtimestamp(max(rows_by_time) / 1000, tz=timezone.utc).isoformat()
    print(f"wrote {len(rows_by_time):,} rows to {out}")
    print(f"range {first} -> {last}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
