# -*- coding: utf-8 -*-
"""周一早盘反转 — 入场时间 × 持仓时间 扫描 (lo=0.6%, hi=1.6%)"""

import struct, os, array
from datetime import datetime, timezone, timedelta

TZ = timezone(timedelta(hours=8))
DIR = os.path.dirname(os.path.abspath(__file__))
BIN = os.path.join(DIR, "..", "data", "BTCUSDT-15m.bin")


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


def run(entry_hour, exit_hour, exit_next_day=False):
    candles = load_bin(BIN)
    min_ms = candles[0][0]; max_ms = candles[-1][0]
    start = max(datetime.fromtimestamp(min_ms/1000, tz=TZ), datetime(2020,1,1,tzinfo=TZ))
    cur = start
    while cur.weekday() != 0: cur += timedelta(days=1)
    cur = cur.replace(hour=0, minute=0, second=0, microsecond=0)
    lo, hi = 0.006, 0.016
    idx, m = 0, len(candles)
    trades, wins, total = 0, 0, 0.0
    while True:
        mon = cur
        ts_s = int(mon.timestamp()*1000)
        ts_entry = int(mon.replace(hour=entry_hour).timestamp()*1000)
        if exit_next_day:
            ts_exit = int((mon.replace(hour=0)+timedelta(days=1, hours=exit_hour)).timestamp()*1000)
        elif exit_hour == 24:
            ts_exit = int((mon.replace(hour=0)+timedelta(days=1)).timestamp()*1000)
        else:
            ts_exit = int(mon.replace(hour=exit_hour).timestamp()*1000)
        if ts_s > max_ms: break
        while idx < m and candles[idx][0] < ts_s: idx += 1
        if idx >= m: break
        j = idx; morning = []
        while j < m and candles[j][0] < ts_entry: morning.append(candles[j]); j += 1
        if j >= m: break
        if len(morning) < 4: cur += timedelta(days=7); continue
        op, cl_entry = morning[0][1], morning[-1][4]
        mv = (cl_entry - op) / op
        if abs(mv) < lo or abs(mv) > hi: cur += timedelta(days=7); continue
        entry = cl_entry; is_long = mv < -lo
        k = j; after = []
        while k < m and candles[k][0] < ts_exit: after.append(candles[k]); k += 1
        if not after: cur += timedelta(days=7); continue
        exit_p = after[-1][4]
        pnl = (exit_p-entry)/entry if is_long else (entry-exit_p)/entry
        trades += 1
        if pnl > 0: wins += 1
        total += pnl
        cur += timedelta(days=7)
    return trades, wins, total


entries = [5, 6, 7, 8]
exits = [(12, False, "12h"), (18, False, "18h"), (24, False, "24h"), (6, True, "+6h")]

print(f"{'entry':>7}", end="")
for _, _, lbl in exits:
    print(f"  exit={lbl}".rjust(17), end="")
print()
print("-" * (7 + 17 * len(exits)))

for eh in entries:
    print(f"  0-{eh}h".rjust(7), end="")
    for ex_h, nxt, _ in exits:
        n, w, pnl = run(eh, ex_h, nxt)
        wr = f"{w/n*100:.0f}%" if n else "-"
        print(f"  {n:>3d} {wr:>4s} {pnl*100:>+7.2f}%", end="")
    print()
