#!/usr/bin/env python3
"""
Harmony Room DJ — dedicated media upload/serve/delete server.

Run alongside the piano app (MPP WebSocket stays on game.multiplayerpiano.com).
This server handles:
  - Ephemeral Room DJ / Share Image uploads in room-media/
  - Persistent Media Library in media-library/

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
import time
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))
MEDIA_DIR = os.path.join(ROOT, "room-media")
LIBRARY_DIR = os.path.join(ROOT, "media-library")
LIBRARY_INDEX = os.path.join(LIBRARY_DIR, "index.json")
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8551
MAX_MEDIA_BYTES = 80 * 1024 * 1024
ALLOWED_MEDIA_EXT = {
    ".mp3", ".m4a", ".wav", ".ogg", ".aac", ".flac", ".opus", ".weba",
    ".mp4", ".webm", ".mov", ".mkv", ".m4v", ".ogv",
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".svg",
}
VIDEO_EXT = {".mp4", ".webm", ".mov", ".mkv", ".m4v", ".ogv"}
IMAGE_EXT = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".svg"}
LIBRARY_MEDIA_EXT = ALLOWED_MEDIA_EXT


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


def media_path_from_url(url, base_dir, url_prefix):
    if not url:
        return None
    path = url.split("?", 1)[0].split("#", 1)[0]
    if path.startswith(url_prefix):
        rel = path[len(url_prefix):]
    elif url_prefix in path:
        rel = path.split(url_prefix, 1)[1]
    else:
        return None
    rel = rel.replace("\\", "/").lstrip("/")
    if not rel or ".." in rel.split("/"):
        return None
    rel = os.path.basename(rel)
    return os.path.join(base_dir, rel) if rel else None


def abs_url(handler, path):
    host = handler.headers.get("Host", f"localhost:{PORT}")
    proto = "https" if handler.headers.get("X-Forwarded-Proto") == "https" else "http"
    if not path.startswith("/"):
        path = "/" + path
    return f"{proto}://{host}{path}"


def load_library_index():
    try:
        with open(LIBRARY_INDEX, "r", encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, dict) and isinstance(data.get("items"), list):
            return data["items"]
        if isinstance(data, list):
            return data
    except (OSError, ValueError, TypeError):
        pass
    return []


def save_library_index(items):
    os.makedirs(LIBRARY_DIR, exist_ok=True)
    tmp = LIBRARY_INDEX + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump({"items": items}, f, indent=2)
        f.write("\n")
    os.replace(tmp, LIBRARY_INDEX)


def library_title_from_name(name):
    base = os.path.splitext(name or "Media")[0]
    base = re.sub(r"_+", " ", base).strip()
    return (base or "Media")[:120]


def read_upload(handler):
    ctype = handler.headers.get("Content-Type", "")
    filename = sanitize_media_filename(handler.headers.get("X-Filename", "upload.bin"))
    ext = os.path.splitext(filename)[1].lower()
    data = b""

    if "multipart/form-data" in ctype:
        form = cgi.FieldStorage(
            fp=handler.rfile,
            headers=handler.headers,
            environ={
                "REQUEST_METHOD": "POST",
                "CONTENT_TYPE": ctype,
                "CONTENT_LENGTH": handler.headers.get("Content-Length", "0"),
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
        length = int(handler.headers.get("Content-Length", 0))
        if length <= 0:
            raise ValueError("Empty body")
        if length > MAX_MEDIA_BYTES:
            raise ValueError("File too large (max 80 MB)")
        data = handler.rfile.read(length)

    if not data:
        raise ValueError("Empty file")
    if len(data) > MAX_MEDIA_BYTES:
        raise ValueError("File too large (max 80 MB)")
    return filename, ext, data


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

    def _api_path(self):
        return self.path.split("?", 1)[0].rstrip("/")

    def do_OPTIONS(self):
        path = self._api_path()
        if path in ("/api/media", "/api/media/health", "/api/media/library") \
                or path.startswith("/room-media/") or path.startswith("/media-library/"):
            self.send_response(204)
            self._cors()
            self.end_headers()
            return
        self.send_error(404)

    def do_GET(self):
        path = self.path.split("?", 1)[0]
        api = path.rstrip("/")
        if api == "/api/media/health":
            items = load_library_index()
            self._json(200, {
                "ok": True,
                "service": "harmony-media",
                "media": True,
                "port": PORT,
                "libraryCount": len(items),
            })
            return
        if api == "/api/media/library":
            self._list_library()
            return
        if path.startswith("/room-media/"):
            self._serve_file(path, MEDIA_DIR, "/room-media/")
            return
        if path.startswith("/media-library/"):
            self._serve_file(path, LIBRARY_DIR, "/media-library/")
            return
        self.send_error(404)

    def _list_library(self):
        items = load_library_index()
        out = []
        changed = False
        seen_urls = set()

        for item in items:
            if not isinstance(item, dict):
                changed = True
                continue
            file_name = os.path.basename(item.get("file") or "")
            if not file_name:
                changed = True
                continue
            file_path = os.path.join(LIBRARY_DIR, file_name)
            if not os.path.isfile(file_path):
                changed = True
                continue
            rel = "/media-library/" + file_name
            seen_urls.add(rel)
            out.append({
                "id": item.get("id") or file_name,
                "url": rel,
                "absUrl": abs_url(self, rel),
                "name": item.get("name") or file_name,
                "title": item.get("title") or library_title_from_name(item.get("name") or file_name),
                "kind": item.get("kind") or media_kind(os.path.splitext(file_name)[1].lower()),
                "size": item.get("size") or os.path.getsize(file_path),
                "added": item.get("added") or int(os.path.getmtime(file_path)),
                "source": "library",
            })

        if changed:
            save_library_index([{
                "id": i["id"],
                "file": os.path.basename(i["url"]),
                "name": i["name"],
                "title": i["title"],
                "kind": i["kind"],
                "size": i["size"],
                "added": i["added"],
            } for i in out if i.get("source") == "library"])

        # Include recent Room DJ / Share Image uploads from room-media/
        try:
            os.makedirs(MEDIA_DIR, exist_ok=True)
            for file_name in os.listdir(MEDIA_DIR):
                if file_name.startswith("."):
                    continue
                file_path = os.path.join(MEDIA_DIR, file_name)
                if not os.path.isfile(file_path):
                    continue
                ext = os.path.splitext(file_name)[1].lower()
                if ext not in ALLOWED_MEDIA_EXT:
                    continue
                rel = "/room-media/" + file_name
                if rel in seen_urls:
                    continue
                try:
                    st = os.stat(file_path)
                    mtime = int(st.st_mtime)
                    size = int(st.st_size)
                except OSError:
                    continue
                out.append({
                    "id": "room-" + os.path.splitext(file_name)[0],
                    "url": rel,
                    "absUrl": abs_url(self, rel),
                    "name": file_name,
                    "title": library_title_from_name(file_name),
                    "kind": media_kind(ext),
                    "size": size,
                    "added": mtime,
                    "source": "recent",
                })
        except OSError:
            pass

        out.sort(key=lambda x: (-(x.get("added") or 0), str(x.get("title") or "").lower()))
        self._json(200, {
            "ok": True,
            "items": out,
            "count": len(out),
            "libraryCount": sum(1 for i in out if i.get("source") == "library"),
            "recentCount": sum(1 for i in out if i.get("source") == "recent"),
        })

    def _serve_file(self, path, base_dir, url_prefix):
        rel = path[len(url_prefix):].replace("\\", "/").lstrip("/")
        if ".." in rel.split("/"):
            self.send_error(403)
            return
        file_path = os.path.join(base_dir, os.path.basename(rel))
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
            self.send_header("Cache-Control", "public, max-age=3600")
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
        api = self._api_path()
        if api == "/api/media":
            self._upload_ephemeral()
            return
        if api == "/api/media/library":
            self._upload_library()
            return
        self.send_error(404)

    def _upload_ephemeral(self):
        try:
            os.makedirs(MEDIA_DIR, exist_ok=True)
            filename, ext, data = read_upload(self)
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

    def _upload_library(self):
        try:
            os.makedirs(LIBRARY_DIR, exist_ok=True)
            filename, ext, data = read_upload(self)
            if ext not in LIBRARY_MEDIA_EXT:
                raise ValueError("Unsupported library file type: " + (ext or "(none)"))

            item_id = uuid.uuid4().hex[:12]
            safe_name = item_id + ext
            with open(os.path.join(LIBRARY_DIR, safe_name), "wb") as f:
                f.write(data)

            title = library_title_from_name(filename)
            kind = media_kind(ext)
            rel = "/media-library/" + safe_name
            entry = {
                "id": item_id,
                "file": safe_name,
                "name": filename,
                "title": title,
                "kind": kind,
                "size": len(data),
                "added": int(time.time()),
            }
            items = load_library_index()
            items.append(entry)
            save_library_index(items)

            self._json(200, {
                "ok": True,
                "id": item_id,
                "url": rel,
                "absUrl": abs_url(self, rel),
                "kind": kind,
                "name": filename,
                "title": title,
                "size": len(data),
                "added": entry["added"],
            })
        except Exception as e:
            self._json(400, {"ok": False, "error": str(e)})

    def do_DELETE(self):
        api = self._api_path()
        if api == "/api/media":
            self._delete_ephemeral()
            return
        if api == "/api/media/library":
            self._delete_library()
            return
        self.send_error(404)

    def _delete_ephemeral(self):
        try:
            length = int(self.headers.get("Content-Length", 0))
            raw = self.rfile.read(length).decode("utf-8") if length else "{}"
            data = json.loads(raw or "{}")
            file_path = media_path_from_url(
                data.get("url") or data.get("path") or "",
                MEDIA_DIR,
                "/room-media/",
            )
            if not file_path:
                raise ValueError("Invalid media URL")
            removed = os.path.isfile(file_path) and (os.remove(file_path) or True)
            self._json(200, {"ok": True, "removed": bool(removed)})
        except Exception as e:
            self._json(400, {"ok": False, "error": str(e)})

    def _delete_library(self):
        try:
            length = int(self.headers.get("Content-Length", 0))
            raw = self.rfile.read(length).decode("utf-8") if length else "{}"
            data = json.loads(raw or "{}")
            target_id = (data.get("id") or "").strip()
            target_url = data.get("url") or data.get("path") or ""

            # Recent Room DJ uploads live in room-media/
            if target_url and "/room-media/" in str(target_url):
                file_path = media_path_from_url(target_url, MEDIA_DIR, "/room-media/")
                if not file_path or not os.path.isfile(file_path):
                    raise ValueError("Recent media not found")
                name = os.path.basename(file_path)
                os.remove(file_path)
                self._json(200, {"ok": True, "removed": True, "name": name, "source": "recent"})
                return

            if target_id.startswith("room-"):
                file_stem = target_id[len("room-"):]
                for file_name in os.listdir(MEDIA_DIR) if os.path.isdir(MEDIA_DIR) else []:
                    if os.path.splitext(file_name)[0] == file_stem:
                        file_path = os.path.join(MEDIA_DIR, file_name)
                        if os.path.isfile(file_path):
                            os.remove(file_path)
                            self._json(200, {
                                "ok": True,
                                "removed": True,
                                "name": file_name,
                                "source": "recent",
                            })
                            return
                raise ValueError("Recent media not found")

            items = load_library_index()
            kept = []
            removed = False
            removed_name = ""
            for item in items:
                if not isinstance(item, dict):
                    continue
                file_name = os.path.basename(item.get("file") or "")
                item_id = str(item.get("id") or "")
                match = False
                if target_id and (item_id == target_id or file_name.startswith(target_id)):
                    match = True
                elif target_url and file_name and (
                    target_url.endswith("/" + file_name)
                    or target_url.rstrip("/").endswith(file_name)
                    or "/media-library/" + file_name in target_url
                ):
                    match = True
                if match:
                    file_path = os.path.join(LIBRARY_DIR, file_name) if file_name else None
                    if file_path and os.path.isfile(file_path):
                        os.remove(file_path)
                    removed = True
                    removed_name = item.get("title") or item.get("name") or file_name
                    continue
                kept.append(item)
            if not removed and target_url:
                file_path = media_path_from_url(target_url, LIBRARY_DIR, "/media-library/")
                if file_path and os.path.isfile(file_path):
                    os.remove(file_path)
                    removed = True
                    removed_name = os.path.basename(file_path)
                    kept = [
                        i for i in kept
                        if os.path.basename(i.get("file") or "") != os.path.basename(file_path)
                    ]
            if not removed:
                raise ValueError("Library item not found")
            save_library_index(kept)
            self._json(200, {
                "ok": True,
                "removed": True,
                "name": removed_name,
                "count": len(kept),
                "source": "library",
            })
        except Exception as e:
            self._json(400, {"ok": False, "error": str(e)})


if __name__ == "__main__":
    os.makedirs(MEDIA_DIR, exist_ok=True)
    os.makedirs(LIBRARY_DIR, exist_ok=True)
    if not os.path.isfile(LIBRARY_INDEX):
        save_library_index([])
    httpd = ThreadingHTTPServer(("0.0.0.0", PORT), MediaHandler)
    print(f"Harmony media server on http://0.0.0.0:{PORT}")
    print(f"Ephemeral media -> {MEDIA_DIR}")
    print(f"Media library   -> {LIBRARY_DIR}")
    print(f"Health check -> http://localhost:{PORT}/api/media/health")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
