#!/usr/bin/env python3
"""
Serve the piano app AND auto-save chat logs to ./chat-logs/
Also hosts room media uploads for shared DJ playback.

Usage:
  python chat-save-server.py
  python chat-save-server.py 8550

Open http://localhost:8550/ — chat is saved to chat-logs/{room}_{date}.txt
"""
import cgi
import json
import os
import re
import sys
import uuid
from datetime import datetime
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))
LOG_DIR = os.path.join(ROOT, "chat-logs")
MEDIA_DIR = os.path.join(ROOT, "room-media")
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8550
MAX_MEDIA_BYTES = 80 * 1024 * 1024
ALLOWED_MEDIA_EXT = {
    ".mp3", ".m4a", ".wav", ".ogg", ".aac", ".flac", ".opus", ".weba",
    ".mp4", ".webm", ".mov", ".mkv", ".m4v", ".ogv",
}
VIDEO_EXT = {".mp4", ".webm", ".mov", ".mkv", ".m4v", ".ogv"}


def sanitize_room(name):
    name = re.sub(r'[\\/:*?"<>|]', "_", name or "room")
    name = re.sub(r"\s+", "_", name.strip())
    name = re.sub(r"_+", "_", name)
    return (name[:80] or "room")


def sanitize_media_filename(name):
    name = os.path.basename(name or "upload")
    name = re.sub(r'[\\/:*?"<>|]', "_", name)
    name = re.sub(r"\s+", "_", name.strip())
    return name[:120] or "upload.bin"


def media_kind(ext):
    return "video" if ext in VIDEO_EXT else "audio"


def media_path_from_url(url):
    """Resolve /room-media/name.ext to absolute path, or None if invalid."""
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
    if not rel:
        return None
    return os.path.join(MEDIA_DIR, rel)


def abs_url(handler, path):
    host = handler.headers.get("Host", f"localhost:{PORT}")
    proto = "https" if handler.headers.get("X-Forwarded-Proto") == "https" else "http"
    if not path.startswith("/"):
        path = "/" + path
    return f"{proto}://{host}{path}"


class ChatSaveHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Filename")
        super().end_headers()

    def do_OPTIONS(self):
        path = self.path.split("?", 1)[0].rstrip("/")
        if path in ("/api/chat-log", "/api/e", "/api/media", "/api/media/health") or path.startswith("/room-media/"):
            self.send_response(204)
            self.end_headers()
            return
        super().do_OPTIONS()

    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path.rstrip("/") == "/api/media/health":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"ok": True, "service": "harmony-app", "port": PORT}).encode("utf-8"))
            return
        if path.startswith("/room-media/"):
            rel = path[len("/room-media/"):]
            rel = rel.replace("\\", "/").lstrip("/")
            if ".." in rel.split("/"):
                self.send_error(403)
                return
            file_path = os.path.join(MEDIA_DIR, rel)
            if not os.path.isfile(file_path):
                self.send_error(404)
                return
            ext = os.path.splitext(file_path)[1].lower()
            ctype = {
                ".mp3": "audio/mpeg",
                ".m4a": "audio/mp4",
                ".wav": "audio/wav",
                ".ogg": "audio/ogg",
                ".aac": "audio/aac",
                ".flac": "audio/flac",
                ".opus": "audio/opus",
                ".weba": "audio/webm",
                ".mp4": "video/mp4",
                ".webm": "video/webm",
                ".mov": "video/quicktime",
                ".mkv": "video/x-matroska",
                ".m4v": "video/mp4",
                ".ogv": "video/ogg",
            }.get(ext, "application/octet-stream")
            try:
                size = os.path.getsize(file_path)
                self.send_response(200)
                self.send_header("Content-Type", ctype)
                self.send_header("Content-Length", str(size))
                self.send_header("Accept-Ranges", "bytes")
                self.end_headers()
                with open(file_path, "rb") as f:
                    while True:
                        chunk = f.read(1024 * 256)
                        if not chunk:
                            break
                        self.wfile.write(chunk)
            except Exception:
                self.send_error(500)
            return
        super().do_GET()

    def do_POST(self):
        path = self.path.split("?", 1)[0].rstrip("/")
        if path == "/api/media":
            self.handle_media_upload()
            return
        if path not in ("/api/chat-log", "/api/e"):
            self.send_error(404)
            return
        try:
            length = int(self.headers.get("Content-Length", 0))
            raw = self.rfile.read(length).decode("utf-8")
            data = json.loads(raw)
            room = sanitize_room(data.get("room", "room"))
            date = data.get("date") or datetime.now().strftime("%Y-%m-%d")
            line = data.get("line", "")
            if not line.endswith("\n"):
                line += "\n"
            os.makedirs(LOG_DIR, exist_ok=True)
            path = os.path.join(LOG_DIR, f"{room}_{date}.txt")
            is_new = not os.path.exists(path)
            with open(path, "a", encoding="utf-8") as f:
                if is_new:
                    f.write(
                        f"=== Room: {data.get('room', room)} | Date: {date} | "
                        f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} ===\n"
                    )
                f.write(line)
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"ok": True, "file": path}).encode("utf-8"))
        except Exception as e:
            self.send_response(500)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"ok": False, "error": str(e)}).encode("utf-8"))

    def handle_media_upload(self):
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

            file_id = uuid.uuid4().hex[:12]
            safe_name = file_id + ext
            out_path = os.path.join(MEDIA_DIR, safe_name)
            with open(out_path, "wb") as f:
                f.write(data)

            url = "/room-media/" + safe_name
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({
                "ok": True,
                "url": url,
                "absUrl": abs_url(self, url),
                "kind": media_kind(ext),
                "name": filename,
                "size": len(data),
            }).encode("utf-8"))
        except Exception as e:
            self.send_response(400)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"ok": False, "error": str(e)}).encode("utf-8"))

    def do_DELETE(self):
        path = self.path.split("?", 1)[0].rstrip("/")
        if path == "/api/media":
            self.handle_media_delete()
            return
        self.send_error(404)

    def handle_media_delete(self):
        try:
            length = int(self.headers.get("Content-Length", 0))
            raw = self.rfile.read(length).decode("utf-8") if length else "{}"
            data = json.loads(raw or "{}")
            url = data.get("url") or data.get("path") or ""
            file_path = media_path_from_url(url)
            if not file_path:
                raise ValueError("Invalid media URL")
            removed = False
            if os.path.isfile(file_path):
                os.remove(file_path)
                removed = True
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"ok": True, "removed": removed}).encode("utf-8"))
        except Exception as e:
            self.send_response(400)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"ok": False, "error": str(e)}).encode("utf-8"))

    def log_message(self, fmt, *args):
        path = getattr(self, "path", "") or ""
        if path.startswith("/api/") or path.rstrip("/") in ("/api/e", "/api/chat-log", "/api/media"):
            return
        if path.startswith("/room-media/"):
            return
        super().log_message(fmt, *args)


if __name__ == "__main__":
    os.makedirs(LOG_DIR, exist_ok=True)
    os.makedirs(MEDIA_DIR, exist_ok=True)
    server = ThreadingHTTPServer(("0.0.0.0", PORT), ChatSaveHandler)
    print(f"Serving {ROOT}")
    print(f"Chat logs -> {LOG_DIR}")
    print(f"Room media -> {MEDIA_DIR}")
    print(f"Open http://localhost:{PORT}/")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
