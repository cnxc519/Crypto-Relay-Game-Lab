# -*- coding: utf-8 -*-
import sys, io, json, os, csv, re
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
"""
超级预测记录查看器

用法:
1. 浏览器 F12 -> Console -> copy(JSON.stringify(state.game.profile.predictionLog))
2. 在 live_view/ 新建 pred_log.json -> 粘贴
3. python pred_log_viewer.py
"""

from datetime import datetime, timezone, timedelta
TZ = timezone(timedelta(hours=8))


def load(path="pred_log.json"):
    for p in [path, os.path.join(os.path.dirname(os.path.abspath(__file__)), path)]:
        if os.path.exists(p):
            with open(p, "r", encoding="utf-8") as f:
                return json.load(f)
    print(f"File not found: {path}")
    return []


def parse_level(s):
    """Parse '12h . 2020-01-06 周一 00:00~11:59' -> (date_key, time_range, weekday)"""
    m = re.search(r'(\d{4}-\d{2}-\d{2})\s*(\S+)\s*(\d{2}:\d{2}~\d{2}:\d{2})', s)
    if m:
        return m.group(1), m.group(2), m.group(3)
    # fallback: just date
    m2 = re.search(r'(\d{4}-\d{2}-\d{2})', s)
    if m2:
        return m2.group(1), "", ""
    return "0000-00-00", "", ""


def sort_key(e):
    lv = e.get("levelTitle", "")
    dk, _, tr = parse_level(lv)
    return (dk, tr, e.get("time", 0))


def fmt_ts(ts):
    if not ts: return "-"
    return datetime.fromtimestamp(ts / 1000, tz=TZ).strftime("%Y-%m-%d %H:%M")


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else "pred_log.json"
    entries = load(path)
    if not entries: return

    entries.sort(key=sort_key)

    # write CSV
    csv_path = os.path.splitext(path)[0] + ".csv"
    headers = ["判断日期", "判断时间", "K线日期", "时间段", "方向", "结果", "涨跌幅", "星级", "理由", "复盘"]
    with open(csv_path, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(headers)
        for e in entries:
            dk, wd, tr = parse_level(e.get("levelTitle", ""))
            dr = {"看涨": "涨", "看跌": "跌", "跳过": "跳"}.get(e.get("direction"), e.get("direction", "-"))
            if e.get("skip"): rs = "跳过"
            elif e.get("correct") is True: rs = "O"
            elif e.get("correct") is False: rs = "X"
            else: rs = "-"
            mv = e.get("movePct")
            mv_s = f"{mv*100:+.2f}%" if mv is not None else "-"
            st = e.get("stars", 0)
            st_s = "★" * st + "☆" * (5 - st)
            reason = (e.get("reason") or "").replace("\n", " ").replace(",", "，")
            review = (e.get("review") or "").replace("\n", " ").replace(",", "，")
            ts = e.get("time")
            jd = datetime.fromtimestamp(ts / 1000, tz=TZ).strftime("%Y-%m-%d") if ts else "-"
            jt = datetime.fromtimestamp(ts / 1000, tz=TZ).strftime("%H:%M:%S") if ts else "-"
            w.writerow([jd, jt, dk, tr, dr, rs, mv_s, st_s, reason, review])

    # summary
    total = len(entries)
    correct = sum(1 for e in entries if e.get("correct"))
    skip = sum(1 for e in entries if e.get("skip"))
    valid = total - skip
    wr = f"{correct/valid*100:.1f}%" if valid else "-"
    gain = sum(
        abs(e.get("movePct") or 0) if e.get("correct") else -(abs(e.get("movePct") or 0))
        for e in entries if e.get("correct") is not None
    )

    print(f"Total: {total} | Valid: {valid} | Correct: {correct} | WinRate: {wr} | PnL: {gain*100:+.2f}% | Skip: {skip}")
    print(f"Saved: {csv_path}")
    print("Open with Excel or any CSV viewer.")


if __name__ == "__main__":
    main()
