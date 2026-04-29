#!/usr/bin/env python3
"""Build a compact binary OHLCV cache for BTC Replay Lab.

Format:
  4 bytes  magic: BTCR
  4 bytes  uint32 little-endian version: 1
  4 bytes  uint32 little-endian row count
  4 bytes  uint32 little-endian columns per row: 6
  rows     float64 little-endian: timestamp_ms, open, high, low, close, volume
"""

from __future__ import annotations

import argparse
import csv
import struct
from itertools import chain
from pathlib import Path


MAGIC = b"BTCR"
VERSION = 1
COLUMNS = 6
HEADER = struct.Struct("<4sIII")
ROW = struct.Struct("<6d")


def normalize_header(value: str) -> str:
    return value.strip().lower().lstrip("\ufeff").replace("-", "_").replace(" ", "_")


def find_header(headers: list[str], names: set[str]) -> int:
    for index, header in enumerate(headers):
        if header in names:
            return index
    return -1


def normalize_timestamp_ms(raw: str) -> int:
    value = int(str(raw).strip().strip('"'))
    if value > 10_000_000_000_000:
        return value // 1000
    if value < 10_000_000_000:
        return value * 1000
    return value


def parse_float(raw: str) -> float:
    return float(str(raw).strip().strip('"').replace(",", ""))


def detect_columns(first_row: list[str]) -> tuple[bool, tuple[int, int, int, int, int, int]]:
    headers = [normalize_header(value) for value in first_row]
    has_header = (
        find_header(headers, {"open", "o"}) >= 0
        and find_header(headers, {"high", "h"}) >= 0
        and find_header(headers, {"low", "l"}) >= 0
        and find_header(headers, {"close", "c"}) >= 0
    )
    if not has_header:
        return False, (0, 1, 2, 3, 4, 5)

    time_index = find_header(headers, {"timestamp", "time", "date", "datetime", "open_time", "opentime", "open_time_ms"})
    open_index = find_header(headers, {"open", "o"})
    high_index = find_header(headers, {"high", "h"})
    low_index = find_header(headers, {"low", "l"})
    close_index = find_header(headers, {"close", "c"})
    volume_index = find_header(headers, {"volume", "vol", "v"})
    if min(time_index, open_index, high_index, low_index, close_index) < 0:
        raise ValueError("CSV needs timestamp/open/high/low/close columns")
    return True, (time_index, open_index, high_index, low_index, close_index, volume_index)


def build_cache(input_path: Path, output_path: Path) -> int:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    count = 0
    with input_path.open("r", encoding="utf-8-sig", newline="") as src, output_path.open("wb") as out:
        reader = csv.reader(src)
        first_row = next(reader, None)
        if not first_row:
            raise ValueError(f"{input_path} is empty")

        has_header, indexes = detect_columns(first_row)
        rows = reader if has_header else chain([first_row], reader)

        out.write(HEADER.pack(MAGIC, VERSION, 0, COLUMNS))
        for row in rows:
            if len(row) < 5:
                continue
            time_index, open_index, high_index, low_index, close_index, volume_index = indexes
            try:
                timestamp = normalize_timestamp_ms(row[time_index])
                open_price = parse_float(row[open_index])
                high = parse_float(row[high_index])
                low = parse_float(row[low_index])
                close = parse_float(row[close_index])
                volume = parse_float(row[volume_index]) if volume_index >= 0 and volume_index < len(row) else 0.0
            except (IndexError, TypeError, ValueError):
                continue
            out.write(ROW.pack(timestamp, open_price, high, low, close, volume))
            count += 1

        out.seek(0)
        out.write(HEADER.pack(MAGIC, VERSION, count, COLUMNS))
    return count


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build a BTC Replay Lab binary candle cache.")
    parser.add_argument("input", type=Path, help="Input OHLCV CSV path")
    parser.add_argument("output", type=Path, nargs="?", help="Output .bin path")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    output = args.output or args.input.with_suffix(".bin")
    count = build_cache(args.input, output)
    print(f"wrote {count:,} rows to {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
