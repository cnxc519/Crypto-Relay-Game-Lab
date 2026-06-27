# -*- coding: utf-8 -*-
"""
周一早盘反转策略 (UTC+8)
每周一 0:00-6:00 波动超过 0.5% 则反向开仓
下跌超 0.5% -> 买入；上涨超 0.5% -> 做空
同日 24:00 平仓，无手续费
"""

import struct, os, array
from datetime import datetime, timezone, timedelta

TZ = timezone(timedelta(hours=8))
BIN = os.path.join(os.path.dirname(__file__), "..", "data", "BTCUSDT-15m.bin")
OUT = os.path.join(os.path.dirname(__file__), "result.txt")


def load_bin(path):
    with open(path, "rb") as f:
        # header: magic(4) + version(4) + count(4) + columns(4) = 16 bytes
        head = f.read(16)
        magic = head[:4].decode()
        if magic != "BTCR":
            raise ValueError("not a valid bin")
        version, count, columns = struct.unpack_from("<III", head, 4)
        # data: count * columns * float64 (8 bytes)
        raw = f.read()
    vals = array.array("d")
    vals.frombytes(raw)
    candles = []
    for i in range(count):
        base = i * columns
        t = vals[base]         # ms
        o = vals[base + 1]
        h = vals[base + 2]
        l = vals[base + 3]
        c = vals[base + 4]
        candles.append((int(t), o, h, l, c))
    return candles


def main():
    candles = load_bin(BIN)
    n = len(candles)
    min_ms = candles[0][0]
    max_ms = candles[-1][0]

    # verify dates
    print(f"Loaded {n} candles")
    print(f"First: {datetime.fromtimestamp(min_ms/1000, tz=TZ).strftime('%Y-%m-%d %H:%M')}")
    print(f"Last:  {datetime.fromtimestamp(max_ms/1000, tz=TZ).strftime('%Y-%m-%d %H:%M')}")

    # start from 2020-01-01 (or first candle, whichever is later)
    start_dt = max(
        datetime.fromtimestamp(min_ms / 1000, tz=TZ),
        datetime(2020, 1, 1, tzinfo=TZ),
    )
    cur = start_dt
    while cur.weekday() != 0:
        cur += timedelta(days=1)
    cur = cur.replace(hour=0, minute=0, second=0, microsecond=0)

    trades = []
    idx = 0

    while True:
        mon_start = cur
        mon_0600 = cur.replace(hour=6)
        mon_2400 = cur.replace(hour=0) + timedelta(days=1)

        ts_start = int(mon_start.timestamp() * 1000)
        ts_0600 = int(mon_0600.timestamp() * 1000)
        ts_2400 = int(mon_2400.timestamp() * 1000)

        if ts_start > max_ms:
            break

        while idx < n and candles[idx][0] < ts_start:
            idx += 1
        if idx >= n:
            break

        j = idx
        morning = []
        while j < n and candles[j][0] < ts_0600:
            morning.append(candles[j])
            j += 1
        if j >= n:
            break

        if len(morning) < 4:
            cur += timedelta(days=7)
            continue

        open_p = morning[0][1]
        close_0600 = morning[-1][4]
        move = (close_0600 - open_p) / open_p

        if abs(move) < 0.005 or abs(move) > 0.02:
            cur += timedelta(days=7)
            continue

        entry = close_0600
        is_long = move < -0.005

        k = j
        night = []
        while k < n and candles[k][0] < ts_2400:
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

        trades.append((mon_start, move, is_long, entry, exit_p, pnl))
        cur += timedelta(days=7)

    lines = []
    lines.append(f"{'Date':<12} {'AM Move':>9} {'Dir':>6} {'Entry':>12} {'Exit':>12} {'PnL':>10}")
    lines.append("-" * 67)
    wins = 0
    total = 0.0
    for mon, mv, is_long, entry, exit_p, pnl in trades:
        d = "LONG" if is_long else "SHORT"
        tag = "WIN" if pnl > 0 else "LOSS"
        lines.append(f"{mon.strftime('%Y-%m-%d'):<12} {mv*100:>+8.2f}% {d:>6} {entry:>12.2f} {exit_p:>12.2f} {pnl*100:>+9.2f}% {tag}")
        if pnl > 0:
            wins += 1
        total += pnl

    nt = len(trades)
    if nt:
        lines.append("-" * 67)
        lng = sum(1 for _, _, is_l, _, _, _ in trades if is_l)
        lines.append(f"Total: {nt}  WinRate: {wins/nt*100:.1f}% ({wins}/{nt})")
        lines.append(f"Cumulative PnL: {total*100:+.2f}%")
        lines.append(f"Average PnL: {total/nt*100:+.2f}%")
        lines.append(f"Long: {lng}  Short: {nt - lng}")
    else:
        lines.append("No trades.")

    out = "\n".join(lines)
    print(out)
    with open(OUT, "w", encoding="utf-8") as f:
        f.write(out)
    print(f"\nSaved to {OUT}")


if __name__ == "__main__":
    main()
