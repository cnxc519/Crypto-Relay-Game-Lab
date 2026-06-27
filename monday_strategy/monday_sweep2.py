# -*- coding: utf-8 -*-
"""周一早盘反转 — lo(0.1-0.8%) × hi(1.0-3.0% 细粒度)"""

import struct, os, array
from datetime import datetime, timezone, timedelta

TZ = timezone(timedelta(hours=8))
BIN = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "BTCUSDT-15m.bin")


def load_bin(path):
    with open(path, "rb") as f:
        head = f.read(16)
        _, count, cols = struct.unpack_from("<III", head, 4)
        raw = f.read()
    vals = array.array("d"); vals.frombytes(raw)
    candles = []
    for i in range(count):
        b = i * cols
        candles.append((int(vals[b]), vals[b+1], vals[b+2], vals[b+3], vals[b+4]))
    return candles


def run(lo_pct, hi_pct):
    candles = load_bin(BIN)
    min_ms = candles[0][0]; max_ms = candles[-1][0]
    start = max(datetime.fromtimestamp(min_ms/1000, tz=TZ), datetime(2020,1,1,tzinfo=TZ))
    cur = start
    while cur.weekday() != 0: cur += timedelta(days=1)
    cur = cur.replace(hour=0, minute=0, second=0, microsecond=0)
    lo = lo_pct / 100.0; hi = hi_pct / 100.0
    idx, m = 0, len(candles)
    trades, wins, total = 0, 0, 0.0
    while True:
        mon = cur
        ts_s = int(mon.timestamp()*1000)
        ts_06 = int(mon.replace(hour=6).timestamp()*1000)
        ts_24 = int((mon.replace(hour=0)+timedelta(days=1)).timestamp()*1000)
        if ts_s > max_ms: break
        while idx < m and candles[idx][0] < ts_s: idx += 1
        if idx >= m: break
        j = idx; morning = []
        while j < m and candles[j][0] < ts_06: morning.append(candles[j]); j += 1
        if j >= m: break
        if len(morning) < 4: cur += timedelta(days=7); continue
        op, cl6 = morning[0][1], morning[-1][4]
        mv = (cl6 - op) / op
        if abs(mv) < lo or abs(mv) > hi: cur += timedelta(days=7); continue
        entry = cl6; is_long = mv < -lo
        k = j; night = []
        while k < m and candles[k][0] < ts_24: night.append(candles[k]); k += 1
        if not night: cur += timedelta(days=7); continue
        exit_p = night[-1][4]
        pnl = (exit_p-entry)/entry if is_long else (entry-exit_p)/entry
        trades += 1
        if pnl > 0: wins += 1
        total += pnl
        cur += timedelta(days=7)
    return trades, wins, total


lows = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8]
highs = [1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2.0]

print(f"{'lo':>6}", end="")
for h in highs:
    label = f"hi={h:.1f}%"
    print(f"  {label:>16s}", end="")
print()
print("-" * (6 + 17 * len(highs)))

for lo in lows:
    print(f"{lo:.1f}%".rjust(6), end="")
    for hi in highs:
        n, w, pnl = run(lo, hi)
        wr = f"{w/n*100:.0f}%" if n else "-"
        print(f"  {n:>3d} {wr:>4s} {pnl*100:>+7.2f}%", end="")
    print()
