#!/usr/bin/env python3
"""Live BTC viewer — standalone server on port 8766. Does not touch main app."""

from __future__ import annotations

import http.server
import argparse
import json
import os
import socketserver
import struct
import sys
import time
import ssl
import urllib.error
import urllib.request
import webbrowser
import errno
from pathlib import Path

PORT = 8766
ROOT = Path(__file__).resolve().parent.parent  # BTC-all/
DATA_DIR = Path(__file__).resolve().parent / "data"
CSV_PATH = DATA_DIR / "BTCUSDT-15m.csv"
BIN_PATH = DATA_DIR / "BTCUSDT-15m.bin"
MAGIC = b"BTCR"

DEEPSEEK_MODEL = "deepseek-v4-flash"
DEEPSEEK_URL = "https://api.deepseek.com/chat/completions"
DEEPSEEK_KEY_ENV = "DEEPSEEK_API_KEY"
DEEPSEEK_KEY_FILES = (".deepseek_api_key", "deepseek_api_key.txt")
DEEPSEEK_PROXY_ENV = "DEEPSEEK_PROXY"

BINANCE_URLS = [
    "https://data-api.binance.vision/api/v3/klines",
    "https://api.binance.com/api/v3/klines",
    "https://api1.binance.com/api/v3/klines",
    "https://api2.binance.com/api/v3/klines",
    "https://api3.binance.com/api/v3/klines",
    "https://fapi.binance.com/fapi/v1/klines",
]
BINANCE_LIMIT = 1500


def read_deepseek_key() -> str:
    env_key = os.environ.get(DEEPSEEK_KEY_ENV, "").strip().lstrip("﻿")
    if env_key:
        return env_key
    for name in DEEPSEEK_KEY_FILES:
        key_file = ROOT / name
        if key_file.exists():
            return key_file.read_text(encoding="utf-8-sig").strip().lstrip("﻿")
    return ""


def csv_to_bin(csv_path, bin_path):
    """Convert CSV to binary cache."""
    import csv
    candles = []
    with open(csv_path, "r", encoding="utf-8") as f:
        reader = csv.reader(f)
        next(reader, None)
        for row in reader:
            if not row or not row[0].strip():
                continue
            try:
                ts = int(row[0])
                if ts < 1e10:
                    ts *= 1000
                candles.append((ts, float(row[1]), float(row[2]), float(row[3]), float(row[4]), float(row[5])))
            except (ValueError, IndexError):
                continue
    candles.sort(key=lambda x: x[0])
    # Normalize to milliseconds: if > 1e13 (microseconds), divide
    for i in range(len(candles)):
        ts, o, h, l, c, v = candles[i]
        if ts > 1e13:
            candles[i] = (ts // 1000, o, h, l, c, v)
    with open(bin_path, "wb") as f:
        f.write(MAGIC)
        f.write(struct.pack("<III", 1, len(candles), 6))
        for ts, o, h, l, c, v in candles:
            f.write(struct.pack("<d", float(ts)))
            f.write(struct.pack("<d", o))
            f.write(struct.pack("<d", h))
            f.write(struct.pack("<d", l))
            f.write(struct.pack("<d", c))
            f.write(struct.pack("<d", v))
    return len(candles)


def fetch_binance_klines(symbol="BTCUSDT", interval="15m", start_ms=None, end_ms=None):
    """Fetch klines from Binance, paginating if needed."""
    all_results = []
    current_start = start_ms
    max_pages = 8  # 8 * 1500 * 15min ≈ 125 days, plenty for 2 months
    last_err = ""

    for _ in range(max_pages):
        params = f"?symbol={symbol}&interval={interval}&limit={BINANCE_LIMIT}"
        if current_start:
            params += f"&startTime={current_start}"
        if end_ms:
            params += f"&endTime={end_ms}"

        data = None
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        proxy_url = os.environ.get("LIVE_PROXY", os.environ.get("HTTPS_PROXY", ""))
        proxy = urllib.request.ProxyHandler({"http": proxy_url, "https": proxy_url} if proxy_url else {})
        opener = urllib.request.build_opener(proxy)
        for base_url in BINANCE_URLS:
            url = base_url + params
            req = urllib.request.Request(url, headers={
                "Accept": "application/json",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            })
            try:
                with opener.open(req, timeout=30) as resp:
                    data = json.loads(resp.read().decode())
                break
            except Exception as e:
                last_err = f"{base_url}: {e}"
                continue

        if data is None:
            raise RuntimeError(last_err or "All Binance endpoints failed")
        if not isinstance(data, list) or not data:
            break

        for k in data:
            ts = int(k[0])
            if end_ms and ts >= end_ms:
                continue
            o, h, l, c = float(k[1]), float(k[2]), float(k[3]), float(k[4])
            v = float(k[5])
            all_results.append((ts, o, h, l, c, v))

        if len(data) < BINANCE_LIMIT:
            break

        # Next page starts from last fetched timestamp + 1ms
        current_start = int(data[-1][0]) + 1

    # Drop last candle (incomplete current bar)
    if all_results:
        all_results.pop()
    return all_results


def update_data():
    """Fetch latest klines and append to existing CSV, then rebuild bin."""
    existing = []
    last_ts = 0
    if CSV_PATH.exists():
        import csv
        with open(CSV_PATH, "r", encoding="utf-8") as f:
            reader = csv.reader(f)
            next(reader, None)
            for row in reader:
                if row and row[0].strip():
                    existing.append(row)
                    try:
                        ts = int(row[0])
                        if ts > 1e13: ts //= 1000  # µs → ms
                        if ts > last_ts:
                            last_ts = ts
                    except ValueError:
                        pass

    # Fetch new data (paginated, up to ~2 months)
    try:
        new_klines = fetch_binance_klines(
            start_ms=last_ts + 1 if last_ts else None,
            end_ms=int(time.time() * 1000) + 3600000,  # up to 1h in future to be safe
        )
    except RuntimeError as e:
        return {"ok": False, "error": str(e)}

    if not new_klines:
        return {"ok": True, "added": 0, "total": len(existing), "msg": "No new data."}

    # Append to CSV
    new_rows = 0
    with open(CSV_PATH, "a", encoding="utf-8", newline="") as f:
        import csv
        writer = csv.writer(f)
        if not existing:
            writer.writerow(["timestamp", "open", "high", "low", "close", "volume"])
        for ts, o, h, l, c, v in new_klines:
            if ts > last_ts:
                writer.writerow([str(ts), str(o), str(h), str(l), str(c), str(v)])
                last_ts = ts
                new_rows += 1

    # Rebuild bin
    try:
        total = csv_to_bin(CSV_PATH, BIN_PATH)
    except Exception as e:
        return {"ok": False, "error": f"Bin rebuild failed: {e}"}
    return {"ok": True, "added": new_rows, "total": total, "msg": f"Added {new_rows} candles. Total: {total}."}


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".js": "application/javascript; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".html": "text/html; charset=utf-8",
        ".csv": "text/csv; charset=utf-8",
        ".bin": "application/octet-stream",
    }

    def send_json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def end_headers(self):
        if self.path.endswith(".html") or self.path.rstrip("/").endswith("live_view"):
            self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
        super().end_headers()

    def do_GET(self):
        if self.path == "/api/chat/status":
            self.send_json(200, {
                "ok": True,
                "configured": bool(read_deepseek_key()),
                "model": DEEPSEEK_MODEL,
            })
            return
        if self.path == "/api/update":
            result = update_data()
            self.send_json(200 if result["ok"] else 500, result)
            return
        # Rewrite / to live.html
        if self.path == "/" or self.path == "/index.html":
            self.path = "/live_view/live.html"
        return super().do_GET()

    def do_POST(self):
        if self.path == "/api/chat":
            key = read_deepseek_key()
            if not key:
                self.send_json(400, {"error": "DeepSeek API key not configured."})
                return
            try:
                length = int(self.headers.get("Content-Length", "0"))
                body = self.rfile.read(length)
                incoming = json.loads(body.decode("utf-8"))
                messages = incoming.get("messages")
                if not isinstance(messages, list) or not messages:
                    raise ValueError("messages must be a non-empty list")
            except Exception as exc:
                self.send_json(400, {"error": f"Invalid chat request: {exc}"})
                return

            payload = {
                "model": DEEPSEEK_MODEL,
                "messages": messages,
                "stream": True,
                "temperature": 0.9,
                "max_tokens": 900,
            }
            req = urllib.request.Request(
                DEEPSEEK_URL,
                data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
                headers={
                    "Authorization": f"Bearer {key}",
                    "Content-Type": "application/json",
                    "Accept": "text/event-stream",
                },
                method="POST",
            )
            proxy_url = os.environ.get(DEEPSEEK_PROXY_ENV, "").strip()
            proxy_handler = urllib.request.ProxyHandler({"http": proxy_url, "https": proxy_url} if proxy_url else {})
            opener = urllib.request.build_opener(proxy_handler)

            try:
                with opener.open(req, timeout=90) as response:
                    self.send_response(200)
                    self.send_header("Content-Type", "text/plain; charset=utf-8")
                    self.send_header("Cache-Control", "no-store")
                    self.end_headers()
                    for raw_line in response:
                        line = raw_line.decode("utf-8", errors="ignore").strip()
                        if not line.startswith("data:"):
                            continue
                        data = line[5:].strip()
                        if data == "[DONE]":
                            break
                        try:
                            chunk = json.loads(data)
                            text = chunk.get("choices", [{}])[0].get("delta", {}).get("content", "")
                        except Exception:
                            text = ""
                        if text:
                            self.wfile.write(text.encode("utf-8"))
                            self.wfile.flush()
            except urllib.error.HTTPError as exc:
                detail = exc.read().decode("utf-8", errors="ignore")
                self.send_json(exc.code, {"error": detail or str(exc)})
            except Exception as exc:
                self.send_json(502, {"error": f"DeepSeek request failed: {exc}"})
        else:
            self.send_error(404)


class ReusableTCPServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    allow_reuse_address = True
    daemon_threads = True


def main():
    # Auto-gen bin cache on startup if missing
    if CSV_PATH.exists() and not BIN_PATH.exists():
        print(f"Building bin cache for {CSV_PATH.name}...")
        n = csv_to_bin(CSV_PATH, BIN_PATH)
        print(f"  Done: {n} candles.")

    parser = argparse.ArgumentParser(description="BTC Live Viewer — standalone server")
    parser.add_argument("--no-open", action="store_true", help="Do not open browser")
    args = parser.parse_args()

    url = f"http://127.0.0.1:{PORT}/"
    print(f"BTC Live Viewer: {url}")
    print("Press Ctrl+C to stop.")
    try:
        with ReusableTCPServer(("127.0.0.1", PORT),
                               lambda *a, **kw: Handler(*a, directory=str(ROOT), **kw)) as httpd:
            if not args.no_open:
                webbrowser.open(url)
            httpd.serve_forever()
    except OSError as exc:
        winerror = getattr(exc, "winerror", None)
        if exc.errno in {errno.EADDRINUSE, errno.EACCES, 10048, 10013} or winerror in {10048, 10013}:
            print(f"Port {PORT} unavailable.")
            if not args.no_open:
                webbrowser.open(url)
            return 0
        print(f"Error: {exc}", file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        print("\nStopped.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
