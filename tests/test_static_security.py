"""Exercise both local servers over HTTP using only temporary test data.

Run from the repository root with:
    python -m unittest discover -s tests -v
"""

from __future__ import annotations

import functools
from contextlib import ExitStack
import http.client
import http.server
import json
from pathlib import Path
import tempfile
import threading
import unittest
from unittest import mock

import start_app
from live_view import start as live_start


FAKE_SECRET = b"test-only-secret-never-expose"


class StaticSecurityChecks:
    module = None
    root_document = None

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.contexts = ExitStack()
        self.addCleanup(self.contexts.close)
        self.root = Path(self.temp.name) / "site"
        self.root.mkdir()
        self.assets = {
            "index.html": b"<html>replay test page</html>",
            "styles.css": b"body { color: black; }",
            "src/app.js": b"export const app = 'test';",
            "src/modules/chart.js": b"export const chart = 'test';",
            "character/avatar.png": b"test png asset",
            "character/avatar.jpg": b"test jpg asset",
            "character/avatar.jpeg": b"test jpeg asset",
            "character/avatar.webp": b"test webp asset",
            "character/avatar.gif": b"test gif asset",
            "icon/app.png": b"test icon png asset",
            "icon/app.ico": b"test ico asset",
            "icon/app.svg": b"<svg></svg>",
            "data/BTCUSDT-15m.csv": b"timestamp,open\n1,100\n",
            "data/BTCUSDT-15m.bin": b"BTCR-test-binary",
            "live_view/live.html": b"<html>live test page</html>",
            "live_view/data/BTCUSDT-15m.csv": b"timestamp,open\n2,200\n",
            "live_view/data/BTCUSDT-15m.bin": b"BTCR-live-binary",
            "live_view/pred_log.csv": b"timestamp,result\n1,test\n",
            "live_view/pred_log.json": b'[{"result":"test"}]',
        }
        for relative, content in self.assets.items():
            self.write_file(relative, content)
        for relative in (
            ".deepseek_api_key", "deepseek_api_key.txt", ".env", ".env.local",
            ".git/config", ".git/HEAD", ".venv/pyvenv.cfg",
            "src/.private/hidden.js", "src/.env", "src/private/config.json",
            "src/private/deepseek_api_key.txt", "data/.env.csv",
            "data/secrets.json", "live_view/.env", "start_app.py",
            "README.md", "unknown.csv", "character/private.txt",
            "private/secret.js", "src/private-key.pem",
        ):
            self.write_file(relative, FAKE_SECRET)
        self.outside = Path(self.temp.name) / "outside-secret.js"
        self.outside.write_bytes(FAKE_SECRET)

        # These tests must never consult a real key or call a remote API.
        self.key_reader = self.contexts.enter_context(mock.patch.object(
            self.module, "read_deepseek_key", return_value=""
        ))
        self.contexts.enter_context(mock.patch(
            "urllib.request.build_opener",
            side_effect=AssertionError("External HTTP is forbidden in these tests"),
        ))
        if self.module is live_start:
            self.contexts.enter_context(mock.patch.object(live_start, "ROOT", self.root))
            self.contexts.enter_context(mock.patch.object(
                live_start, "update_data",
                side_effect=AssertionError("Market data updates are forbidden in these tests"),
            ))

        # Keep the actual application Handler, suppressing only its request log.
        self.contexts.enter_context(mock.patch.object(self.module.Handler, "log_message"))
        handler = functools.partial(self.module.Handler, directory=str(self.root))
        self.server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
        self.addCleanup(self.server.server_close)
        self.thread = threading.Thread(
            target=self.server.serve_forever, kwargs={"poll_interval": 0.02}, daemon=True
        )
        self.thread.start()
        self.addCleanup(self.stop_server)

    def stop_server(self):
        self.server.shutdown()
        self.thread.join(timeout=5)

    def write_file(self, relative, content):
        path = self.root / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)

    def request(self, path, method="GET"):
        connection = http.client.HTTPConnection(
            "127.0.0.1", self.server.server_port, timeout=5
        )
        try:
            connection.request(method, path)
            response = connection.getresponse()
            return response.status, dict(response.getheaders()), response.read()
        finally:
            connection.close()

    def assert_denied(self, path):
        for method in ("GET", "HEAD"):
            with self.subTest(path=path, method=method):
                status, headers, body = self.request(path, method)
                self.assertIn(status, (400, 403, 404))
                self.assertNotIn(FAKE_SECRET, body)
                self.assertNotIn("Location", headers)
                if method == "HEAD":
                    self.assertEqual(body, b"")

    def test_public_assets_remain_available(self):
        for relative, content in self.assets.items():
            # The live app intentionally maps /index.html to its own entry page.
            expected = self.assets[self.root_document] if relative == "index.html" else content
            for method in ("GET", "HEAD"):
                with self.subTest(path=relative, method=method):
                    status, headers, body = self.request("/" + relative, method)
                    self.assertEqual(status, 200)
                    self.assertEqual(int(headers["Content-Length"]), len(expected))
                    self.assertEqual(body, expected if method == "GET" else b"")

    def test_entry_page_and_cache_busting_urls(self):
        for path, expected in (
            ("/", self.assets[self.root_document]),
            ("/?test=1", self.assets[self.root_document]),
            ("/index.html?test=1", self.assets[self.root_document]),
            ("/styles.css?v=1", self.assets["styles.css"]),
            ("/src/app.js?v=1", self.assets["src/app.js"]),
        ):
            for method in ("GET", "HEAD"):
                with self.subTest(path=path, method=method):
                    status, headers, body = self.request(path, method)
                    self.assertEqual(status, 200)
                    self.assertEqual(int(headers["Content-Length"]), len(expected))
                    self.assertEqual(body, expected if method == "GET" else b"")

    def test_credentials_and_nonpublic_files_are_denied(self):
        for path in (
            "/.deepseek_api_key", "/deepseek_api_key.txt", "/.env", "/.env.local",
            "/.git/config", "/.git/HEAD", "/.venv/pyvenv.cfg",
            "/src/.private/hidden.js", "/src/.env", "/src/private/config.json",
            "/src/private/deepseek_api_key.txt", "/data/.env.csv",
            "/data/secrets.json", "/live_view/.env", "/start_app.py",
            "/README.md", "/unknown.csv", "/character/private.txt",
            "/private/secret.js", "/src/private-key.pem",
        ):
            self.assert_denied(path)

    def test_encoded_sensitive_paths_are_denied(self):
        for path in (
            "/%2eenv", "/%2Edeepseek_api_key", "/%2egit/config",
            "/.git%2fconfig", "/src/%2eprivate/hidden.js",
            "/%64eepseek_api_key.txt", "/data/%2eenv.csv",
            "/%252eenv", "/%252egit/config",
        ):
            self.assert_denied(path)

    def test_directory_listings_are_denied(self):
        for path in ("/src", "/src/", "/data/", "/character/", "/icon/", "/live_view/data/"):
            self.assert_denied(path)

    def test_traversal_and_windows_path_aliases_are_denied(self):
        for path in (
            "/../outside-secret.js", "/src/../../outside-secret.js",
            "/src/../index.html", "/src/%2e%2e/index.html",
            "/src/%2e%2e/%2e%2e/outside-secret.js",
            "/src/%252e%252e/%252e%252e/outside-secret.js",
            "/src%5c..%5c.deepseek_api_key", "/src\\..\\.deepseek_api_key",
            "/C:/Windows/win.ini", "/C%3a/Windows/win.ini",
            "/data/BTCUSDT-15m.csv:secret", "/data/BTCUSDT-15m.csv%3a%3a$DATA",
            "/.env%00.js", "/src/app.js%00",
        ):
            self.assert_denied(path)

    def test_sensitive_symlink_targets_are_denied(self):
        links = (
            (self.root / "src" / "outside.js", self.outside),
            (self.root / "src" / "credential.js", self.root / ".deepseek_api_key"),
            (self.root / "src" / "hidden.js", self.root / "src/.private/hidden.js"),
            (self.root / "src" / "private.js", self.root / "private/secret.js"),
        )
        try:
            for link, target in links:
                link.symlink_to(target)
            (self.root / "src" / "outside-dir").symlink_to(
                self.outside.parent, target_is_directory=True
            )
            (self.root / "src" / "private-dir").symlink_to(
                self.root / "private", target_is_directory=True
            )
        except (OSError, NotImplementedError) as exc:
            self.skipTest(f"Symbolic links are unavailable on this host: {exc}")
        for link, _ in links:
            self.assert_denied("/" + link.relative_to(self.root).as_posix())
        self.assert_denied("/src/outside-dir/outside-secret.js")
        self.assert_denied("/src/private-dir/secret.js")

    def test_chat_status_reports_configuration_without_key(self):
        for fake_key in ("", FAKE_SECRET.decode("ascii")):
            with self.subTest(configured=bool(fake_key)):
                self.key_reader.return_value = fake_key
                status, headers, body = self.request("/api/chat/status")
                self.assertEqual(status, 200)
                self.assertIn("application/json", headers["Content-Type"])
                self.assertEqual(json.loads(body), {
                    "ok": True,
                    "configured": bool(fake_key),
                    "model": self.module.DEEPSEEK_MODEL,
                })
                self.assertNotIn(FAKE_SECRET, body)


class ReplayServerSecurityTests(StaticSecurityChecks, unittest.TestCase):
    module = start_app
    root_document = "index.html"


class LiveServerSecurityTests(StaticSecurityChecks, unittest.TestCase):
    module = live_start
    root_document = "live_view/live.html"


if __name__ == "__main__":
    unittest.main()
