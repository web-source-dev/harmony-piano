#!/usr/bin/env python3
"""
Harmony Room DJ — dedicated media upload/serve/delete server.

Run alongside the piano app (MPP WebSocket stays on game.multiplayerpiano.com).
This server handles audio/video for Room DJ and images for Share Image.

Usage:
  python media-server.py          # port 8551
  python media-server.py 9000

Then open the piano app from chat-save-server.py (port 8550) or any host with:
  ?media=8551   or   ?media=http://YOUR_IP:8551
"""
import cgi
import json
import os
import re
import sys
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))
MEDIA_DIR = os.path.join(ROOT, "room-media")
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8551
MAX_MEDIA_BYTES = 80 * 1024 * 1024
ALLOWED_MEDIA_EXT = {
    ".mp3", ".m4a", ".wav", ".ogg", ".aac", ".flac", ".opus", ".weba",
    ".mp4", ".webm", ".mov", ".mkv", ".m4v", ".ogv",
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".svg",
}
VIDEO_EXT = {".mp4", ".webm", ".mov", ".mkv", ".m4v", ".ogv"}
IMAGE_EXT = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".svg"}


def sanitize_media_filename(name):
    name = os.path.basename(name or "upload")
    name = re.sub(r'[\\/:*?"<>|]', "_", name)
    name = re.sub(r"\s+", "_", name.strip())
    return name[:120] or "upload.bin"


def media_kind(ext):
    if ext in VIDEO_EXT:
        return "video"
    if ext in IMAGE_EXT:
        return "image"
    return "audio"


def media_path_from_url(url):
    if not url:
        return None
    path = url.split("?", 1)[0].split("#", 1)[0]
    if path.startswith("/room-media/"):
        rel = path[len("/room-media/"):]
    elif "/room-media/" in path:
        rel = path.split("/room-media/", 1)[1]
    else:
        return None
    rel = rel.replace("\\", "/").lstrip("/")
    if not rel or ".." in rel.split("/"):
        return None
    rel = os.path.basename(rel)
    return os.path.join(MEDIA_DIR, rel) if rel else None


def abs_url(handler, path):
    host = handler.headers.get("Host", f"localhost:{PORT}")
    proto = "https" if handler.headers.get("X-Forwarded-Proto") == "https" else "http"
    if not path.startswith("/"):
        path = "/" + path
    return f"{proto}://{host}{path}"


class MediaHandler(BaseHTTPRequestHandler):
    server_version = "HarmonyMedia/1.0"

    def log_message(self, fmt, *args):
        sys.stderr.write("[media] " + (fmt % args) + "\n")

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Filename")

    def _json(self, code, data):
        body = json.dumps(data).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self._cors()
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        path = self.path.split("?", 1)[0].rstrip("/")
        if path in ("/api/media", "/api/media/health") or path.startswith("/room-media/"):
            self.send_response(204)
            self._cors()
            self.end_headers()
            return
        self.send_error(404)

    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path.rstrip("/") == "/api/media/health":
            self._json(200, {"ok": True, "service": "harmony-media", "media": True, "port": PORT})
            return
        if path.startswith("/room-media/"):
            self._serve_file(path)
            return
        self.send_error(404)

    def _serve_file(self, path):
        rel = path[len("/room-media/"):].replace("\\", "/").lstrip("/")
        if ".." in rel.split("/"):
            self.send_error(403)
            return
        file_path = os.path.join(MEDIA_DIR, os.path.basename(rel))
        if not os.path.isfile(file_path):
            self.send_error(404)
            return
        ext = os.path.splitext(file_path)[1].lower()
        ctype = {
            ".mp3": "audio/mpeg", ".m4a": "audio/mp4", ".wav": "audio/wav",
            ".ogg": "audio/ogg", ".aac": "audio/aac", ".flac": "audio/flac",
            ".opus": "audio/opus", ".weba": "audio/webm",
            ".mp4": "video/mp4", ".webm": "video/webm", ".mov": "video/quicktime",
            ".mkv": "video/x-matroska", ".m4v": "video/mp4", ".ogv": "video/ogg",
            ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
            ".gif": "image/gif", ".webp": "image/webp", ".bmp": "image/bmp",
            ".svg": "image/svg+xml",
        }.get(ext, "application/octet-stream")
        try:
            size = os.path.getsize(file_path)
            self.send_response(200)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(size))
            self.send_header("Accept-Ranges", "bytes")
            self._cors()
            self.end_headers()
            with open(file_path, "rb") as f:
                while True:
                    chunk = f.read(1024 * 256)
                    if not chunk:
                        break
                    self.wfile.write(chunk)
        except Exception:
            self.send_error(500)

    def do_POST(self):
        if self.path.split("?", 1)[0].rstrip("/") != "/api/media":
            self.send_error(404)
            return
        try:
            os.makedirs(MEDIA_DIR, exist_ok=True)
            ctype = self.headers.get("Content-Type", "")
            filename = sanitize_media_filename(self.headers.get("X-Filename", "upload.bin"))
            ext = os.path.splitext(filename)[1].lower()
            data = b""

            if "multipart/form-data" in ctype:
                form = cgi.FieldStorage(
                    fp=self.rfile,
                    headers=self.headers,
                    environ={
                        "REQUEST_METHOD": "POST",
                        "CONTENT_TYPE": ctype,
                        "CONTENT_LENGTH": self.headers.get("Content-Length", "0"),
                    },
                )
                if "file" not in form:
                    raise ValueError("Missing file field")
                item = form["file"]
                if not item.file:
                    raise ValueError("Empty upload")
                filename = sanitize_media_filename(item.filename or filename)
                ext = os.path.splitext(filename)[1].lower()
                data = item.file.read()
            else:
                length = int(self.headers.get("Content-Length", 0))
                if length <= 0:
                    raise ValueError("Empty body")
                if length > MAX_MEDIA_BYTES:
                    raise ValueError("File too large (max 80 MB)")
                data = self.rfile.read(length)

            if not data:
                raise ValueError("Empty file")
            if len(data) > MAX_MEDIA_BYTES:
                raise ValueError("File too large (max 80 MB)")
            if ext not in ALLOWED_MEDIA_EXT:
                raise ValueError("Unsupported file type: " + (ext or "(none)"))

            safe_name = uuid.uuid4().hex[:12] + ext
            with open(os.path.join(MEDIA_DIR, safe_name), "wb") as f:
                f.write(data)

            rel = "/room-media/" + safe_name
            self._json(200, {
                "ok": True,
                "url": rel,
                "absUrl": abs_url(self, rel),
                "kind": media_kind(ext),
                "name": filename,
                "size": len(data),
            })
        except Exception as e:
            self._json(400, {"ok": False, "error": str(e)})

    def do_DELETE(self):
        if self.path.split("?", 1)[0].rstrip("/") != "/api/media":
            self.send_error(404)
            return
        try:
            length = int(self.headers.get("Content-Length", 0))
            raw = self.rfile.read(length).decode("utf-8") if length else "{}"
            data = json.loads(raw or "{}")
            file_path = media_path_from_url(data.get("url") or data.get("path") or "")
            if not file_path:
                raise ValueError("Invalid media URL")
            removed = os.path.isfile(file_path) and (os.remove(file_path) or True)
            self._json(200, {"ok": True, "removed": bool(removed)})
        except Exception as e:
            self._json(400, {"ok": False, "error": str(e)})


if __name__ == "__main__":
    os.makedirs(MEDIA_DIR, exist_ok=True)
    httpd = ThreadingHTTPServer(("0.0.0.0", PORT), MediaHandler)
    print(f"Harmony media server on http://0.0.0.0:{PORT}")
    print(f"Media files -> {MEDIA_DIR}")
    print(f"Health check -> http://localhost:{PORT}/api/media/health")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
