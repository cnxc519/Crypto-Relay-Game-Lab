# -*- coding: utf-8 -*-
"""
周一早盘反转策略 — 阈值扫描
下跌超阈值 -> 买入；上涨超阈值 -> 做空，上限 2%
"""

import struct, os, array
from datetime import datetime, timezone, timedelta

TZ = timezone(timedelta(hours=8))
BIN = os.path.join(os.path.dirname(__file__), "..", "data", "BTCUSDT-15m.bin")


def load_bin(path):
    with open(path, "rb") as f:
        head = f.read(16)
        if head[:4] != b"BTCR":
            raise ValueError("bad bin")
        _, count, columns = struct.unpack_from("<III", head, 4)
        raw = f.read()
    vals = array.array("d")
    vals.frombytes(raw)
    candles = []
    for i in range(count):
        base = i * columns
        candles.append((int(vals[base]), vals[base+1], vals[base+2], vals[base+3], vals[base+4]))
    return candles


def yearly_pnl(threshold_pct):
    """Run strategy with given lower threshold (0.1-0.8%), fixed upper 2%, return dict of year->(trades, wins, pnl)."""
    candles = load_bin(BIN)
    min_ms = candles[0][0]
    max_ms = candles[-1][0]

    start_dt = max(datetime.fromtimestamp(min_ms / 1000, tz=TZ),
                   datetime(2020, 1, 1, tzinfo=TZ))
    cur = start_dt
    while cur.weekday() != 0:
        cur += timedelta(days=1)
    cur = cur.replace(hour=0, minute=0, second=0, microsecond=0)

    lo = threshold_pct / 100.0
    hi = 2.0 / 100.0
    idx = 0
    m = len(candles)
    yearly = {}

    while True:
        mon_start = cur
        mon_0600 = cur.replace(hour=6)
        mon_2400 = cur.replace(hour=0) + timedelta(days=1)

        ts_start = int(mon_start.timestamp() * 1000)
        ts_0600 = int(mon_0600.timestamp() * 1000)
        ts_2400 = int(mon_2400.timestamp() * 1000)

        if ts_start > max_ms:
            break

        while idx < m and candles[idx][0] < ts_start:
            idx += 1
        if idx >= m:
            break

        j = idx
        morning = []
        while j < m and candles[j][0] < ts_0600:
            morning.append(candles[j])
            j += 1
        if j >= m:
            break

        if len(morning) < 4:
            cur += timedelta(days=7)
            continue

        open_p = morning[0][1]
        close_0600 = morning[-1][4]
        move = (close_0600 - open_p) / open_p

        if abs(move) < lo or abs(move) > hi:
            cur += timedelta(days=7)
            continue

        entry = close_0600
        is_long = move < -lo

        k = j
        night = []
        while k < m and candles[k][0] < ts_2400:
            night.append(candles[k])
            k += 1

        if not night:
            cur += timedelta(days=7)
            continue
        exit_p = night[-1][4]

        if is_long:
            pnl = (exit_p - entry) / entry
        else:
            pnl = (entry - exit_p) / entry

        yr = mon_start.year
        if yr not in yearly:
            yearly[yr] = [0, 0, 0.0]  # trades, wins, total_pnl
        yearly[yr][0] += 1
        if pnl > 0:
            yearly[yr][1] += 1
        yearly[yr][2] += pnl

        cur += timedelta(days=7)

    return yearly


def main():
    thresholds = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8]
    all_years = set()
    all_results = {}

    for t in thresholds:
        yearly = yearly_pnl(t)
        all_results[t] = yearly
        all_years.update(yearly.keys())

    years = sorted(all_years)

    # print header
    header = f"{'Year':>6}"
    for t in thresholds:
        label = f"th={t:.1f}%"
        header += f"  {label:>20s}"
    print(header)
    print("-" * len(header))

    for yr in years:
        line = f"{yr:>6}"
        for t in thresholds:
            data = all_results[t].get(yr, [0, 0, 0.0])
            n, w, pnl = data
            wr = f"{w/n*100:.0f}%" if n else "-"
            line += f"  {n:>3d} {wr:>4s} {pnl*100:>+7.2f}%"
        print(line)

    # totals row
    print("-" * len(header))
    tot_line = f"{'Total':>6}"
    for t in thresholds:
        data = all_results[t]
        n = sum(v[0] for v in data.values())
        w = sum(v[1] for v in data.values())
        pnl = sum(v[2] for v in data.values())
        wr = f"{w/n*100:.0f}%" if n else "-"
        tot_line += f"  {n:>3d} {wr:>4s} {pnl*100:>+7.2f}%"
    print(tot_line)


if __name__ == "__main__":
    main()
