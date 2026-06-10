#!/usr/bin/env python3
"""
Serve the piano app AND auto-save chat logs to ./chat-logs/

Usage:
  python chat-save-server.py
  python chat-save-server.py 8550

Open http://localhost:8550/ — chat is saved to chat-logs/{room}_{date}.txt
"""
import json
import os
import re
import sys
from datetime import datetime
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))
LOG_DIR = os.path.join(ROOT, "chat-logs")
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8550


def sanitize_room(name):
    name = re.sub(r'[\\/:*?"<>|]', "_", name or "room")
    name = re.sub(r"\s+", "_", name.strip())
    name = re.sub(r"_+", "_", name)
    return (name[:80] or "room")


class ChatSaveHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        super().end_headers()

    def do_OPTIONS(self):
        if self.path.rstrip("/") in ("/api/chat-log", "/api/e"):
            self.send_response(204)
            self.end_headers()
            return
        super().do_OPTIONS()

    def do_POST(self):
        if self.path.rstrip("/") not in ("/api/chat-log", "/api/e"):
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

    def log_message(self, fmt, *args):
        path = getattr(self, "path", "") or ""
        if path.startswith("/api/") or path.rstrip("/") in ("/api/e", "/api/chat-log"):
            return
        super().log_message(fmt, *args)


if __name__ == "__main__":
    os.makedirs(LOG_DIR, exist_ok=True)
    server = ThreadingHTTPServer(("0.0.0.0", PORT), ChatSaveHandler)
    print(f"Serving {ROOT}")
    print(f"Chat logs → {LOG_DIR}")
    print(f"Open http://localhost:{PORT}/")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
