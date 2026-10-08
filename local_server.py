"""Serve only the public browser assets from the project directory."""

from __future__ import annotations

import http.server
from pathlib import Path
from urllib.parse import unquote


PUBLIC_FILES = {
    "index.html",
    "styles.css",
    "live_view/live.html",
    "live_view/pred_log.csv",
    "live_view/pred_log.json",
}
PUBLIC_DIRECTORIES = {
    ("src",): {".js"},
    ("character",): {".png", ".jpg", ".jpeg", ".webp", ".gif"},
    ("icon",): {".png", ".ico", ".svg"},
    ("data",): {".csv", ".bin"},
    ("live_view", "data"): {".csv", ".bin"},
}
PRIVATE_DIRECTORIES = {"env", "venv", "node_modules", "__pycache__", "session_records"}


def is_public_asset(relative_path: Path) -> bool:
    parts = tuple(part.casefold() for part in relative_path.parts)
    if any(part.startswith(".") or part in PRIVATE_DIRECTORIES for part in parts):
        return False
    if "/".join(parts) in PUBLIC_FILES:
        return True
    return any(
        len(parts) > len(prefix)
        and parts[:len(prefix)] == prefix
        and relative_path.suffix.casefold() in extensions
        for prefix, extensions in PUBLIC_DIRECTORIES.items()
    )


class StaticAssetHandler(http.server.SimpleHTTPRequestHandler):
    """Apply the same file boundary to GET and HEAD, without directory listings."""

    def send_head(self):
        try:
            request_path = self.path.split("?", 1)[0].split("#", 1)[0]
            decoded_path = unquote(request_path, errors="strict")
            # Reject traversal and Windows aliases before the base handler normalizes them.
            if any(char in decoded_path for char in ("\\", ":", "\x00", "%")):
                raise ValueError("Invalid asset path")
            if any(
                part.startswith(".") or part.endswith((".", " "))
                for part in decoded_path.split("/") if part
            ):
                raise ValueError("Invalid asset path")

            root = Path(self.directory).resolve()
            candidate = Path(self.translate_path(self.path))
            if decoded_path == "/":
                candidate = root / "index.html"

            # Check both the requested name and the target of any symlink/junction.
            relative_path = candidate.relative_to(root)
            resolved_path = candidate.resolve().relative_to(root)
            if not is_public_asset(relative_path) or not is_public_asset(resolved_path):
                raise ValueError("Not a public asset")
            if not candidate.is_file():
                raise ValueError("Not a file")
        except (OSError, RuntimeError, UnicodeError, ValueError):
            self.send_error(404)
            return None
        return super().send_head()

    def list_directory(self, path):
        self.send_error(404)
        return None
