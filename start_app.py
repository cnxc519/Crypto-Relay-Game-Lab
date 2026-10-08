#!/usr/bin/env python3
"""Start a local server for BTC Replay Lab.

Using a local HTTP server lets the browser auto-load data/BTCUSDT-15m.csv.
Opening index.html directly still works, but browsers block automatic local
file reads in that mode.
"""

from __future__ import annotations

import http.server
import argparse
import json
import os
import socketserver
import sys
import urllib.error
import urllib.request
import webbrowser
import errno
from pathlib import Path

from local_server import StaticAssetHandler


PORT = 8765
DEEPSEEK_MODEL = "deepseek-v4-flash"
DEEPSEEK_URL = "https://api.deepseek.com/chat/completions"
DEEPSEEK_KEY_ENV = "DEEPSEEK_API_KEY"
DEEPSEEK_KEY_FILES = (".deepseek_api_key", "deepseek_api_key.txt")
DEEPSEEK_PROXY_ENV = "DEEPSEEK_PROXY"


def read_deepseek_key(root: Path) -> str:
    env_key = os.environ.get(DEEPSEEK_KEY_ENV, "").strip().lstrip("\ufeff")
    if env_key:
        return env_key
    for name in DEEPSEEK_KEY_FILES:
        key_file = root / name
        if key_file.exists():
            return key_file.read_text(encoding="utf-8-sig").strip().lstrip("\ufeff")
    return ""


class Handler(StaticAssetHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".js": "application/javascript; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".html": "text/html; charset=utf-8",
        ".csv": "text/csv; charset=utf-8",
        ".bin": "application/octet-stream",
    }

    def api_root(self) -> Path:
        return Path(getattr(self, "directory", Path.cwd())).resolve()

    def send_json(self, status: int, payload: dict) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        if self.path == "/api/chat/status":
            self.send_json(
                200,
                {
                    "ok": True,
                    "configured": bool(read_deepseek_key(self.api_root())),
                    "model": DEEPSEEK_MODEL,
                },
            )
            return
        super().do_GET()

    def do_POST(self) -> None:
        if self.path != "/api/chat":
            self.send_error(404)
            return

        key = read_deepseek_key(self.api_root())
        if not key:
            self.send_json(
                400,
                {
                    "error": f"DeepSeek API key is not configured. Set {DEEPSEEK_KEY_ENV} or create .deepseek_api_key next to start_app.py.",
                },
            )
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
        request = urllib.request.Request(
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
            with opener.open(request, timeout=90) as response:
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


class ReusableTCPServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    allow_reuse_address = True
    daemon_threads = True


def main() -> int:
    parser = argparse.ArgumentParser(description="Start BTC Replay Lab local server.")
    parser.add_argument("--no-open", action="store_true", help="Do not open the browser automatically")
    args = parser.parse_args()

    root = Path(__file__).resolve().parent
    url = f"http://127.0.0.1:{PORT}/index.html"
    print(f"BTC Replay Lab: {url}")
    print("Press Ctrl+C to stop.")
    try:
        # Python 3.10 on Windows supports the directory argument here.
        with ReusableTCPServer(("127.0.0.1", PORT), lambda *args, **kwargs: Handler(*args, directory=str(root), **kwargs)) as httpd:
            if not args.no_open:
                webbrowser.open(url)
            httpd.serve_forever()
    except OSError as exc:
        winerror = getattr(exc, "winerror", None)
        if exc.errno in {errno.EADDRINUSE, errno.EACCES, 10048, 10013} or winerror in {10048, 10013}:
            print(f"Port {PORT} is unavailable or already in use; opening the BTC Replay Lab page.")
            if not args.no_open:
                webbrowser.open(url)
            return 0
        print(f"Could not start on port {PORT}: {exc}", file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        print("\nStopped.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
