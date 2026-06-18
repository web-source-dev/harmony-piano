/**
 * Harmony Piano — all-in-one local server.
 *
 * Serves the app's static files AND a real-time room relay on the SAME port, so
 * the browser always reaches the relay at the same origin it loaded the page
 * from (ws(s)://<host>/relay). No second process, no extra port, nothing to
 * misconfigure — this is what makes the fun features (Blob Friend, Doodler,
 * Emoji Party, Party Game, metronome, Room DJ controls) sync in real time.
 *
 * The relay broadcasts every update to everyone else in the same channel with
 * no rate limiting (unlike the public chat, which throttles rapid messages and
 * is why blob movement/size/reactions weren't syncing before).
 *
 * Also saves chat logs to ./chat-logs/ (same /api/e + /api/chat-log endpoints as
 * chat-save-server.py). Media uploads still go to media-server.py on :8551.
 *
 *   node relay-server.js [port]      (default 8550)
 *
 * Relay protocol (JSON per frame):
 *   client -> {m:"hi"|"join", ch, p:{_id,name}} | {m:"b", ch, text, p} | {m:"ping"}
 *   relay  -> {m:"b", text, p}  (a peer's broadcast; never echoed to sender)
 */
"use strict";

var http = require("http");
var fs = require("fs");
var path = require("path");
var ws = require("ws");
var WebSocketServer = ws.WebSocketServer || ws.Server;

var ROOT = __dirname;
var LOG_DIR = path.join(ROOT, "chat-logs");
var PORT = parseInt(process.argv[2], 10) || parseInt(process.env.PORT, 10) || 8550;
var MAX_TEXT = 8192;
var MAX_ID = 64;

var MIME = {
	".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
	".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
	".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif",
	".svg": "image/svg+xml", ".ico": "image/x-icon", ".txt": "text/plain; charset=utf-8",
	".mp3": "audio/mpeg", ".m4a": "audio/mp4", ".wav": "audio/wav", ".ogg": "audio/ogg",
	".aac": "audio/aac", ".flac": "audio/flac", ".opus": "audio/opus", ".weba": "audio/webm",
	".mp4": "video/mp4", ".webm": "video/webm", ".mov": "video/quicktime",
	".mkv": "video/x-matroska", ".m4v": "video/mp4", ".ogv": "video/ogg",
	".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf"
};

function sanitizeRoom(name) {
	return (String(name || "room").replace(/[\\/:*?"<>|]/g, "_").replace(/\s+/g, "_").replace(/_+/g, "_").slice(0, 80) || "room");
}
function sanitizeLogName(name) {
	name = path.basename(String(name || "")).replace(/[\\/:*?"<>|]/g, "_").replace(/\s+/g, "_");
	if (!/\.txt$/.test(name)) name += ".txt";
	return (name.slice(0, 120) || "room.txt");
}

function setCors(res) {
	res.setHeader("Access-Control-Allow-Origin", "*");
	res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
	res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Filename");
}

function saveChatLog(body, cb) {
	var data;
	try { data = JSON.parse(body || "{}"); } catch (e) { return cb(e); }
	var room = sanitizeRoom(data.room || "room");
	var date = data.date || new Date().toISOString().slice(0, 10);
	var line = data.line || "";
	if (line.charAt(line.length - 1) !== "\n") line += "\n";
	var logName = data.file ? sanitizeLogName(data.file) : (room + "_" + date + ".txt");
	var file = path.join(LOG_DIR, logName);
	try {
		fs.mkdirSync(LOG_DIR, { recursive: true });
		if (!fs.existsSync(file)) {
			var label = /_joins/.test(logName) ? "Join log" : (/_prompts/.test(logName) ? "Corner prompts" : "Chat");
			fs.appendFileSync(file, "=== " + label + ": " + (data.room || room) + " | Date: " + date + " ===\n", "utf8");
		}
		fs.appendFileSync(file, line, "utf8");
		cb(null, file);
	} catch (e) { cb(e); }
}

function serveStatic(req, res) {
	var urlPath = decodeURIComponent((req.url.split("?")[0] || "/"));
	if (urlPath === "/") urlPath = "/index.html";
	// resolve safely inside ROOT (block path traversal)
	var filePath = path.normalize(path.join(ROOT, urlPath));
	if (filePath.indexOf(ROOT) !== 0) { res.writeHead(403); res.end("Forbidden"); return; }
	fs.stat(filePath, function (err, st) {
		if (err || !st.isFile()) { res.writeHead(404); res.end("Not found"); return; }
		res.setHeader("Content-Type", MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream");
		res.setHeader("Content-Length", st.size);
		res.setHeader("Accept-Ranges", "bytes");
		fs.createReadStream(filePath).on("error", function () { try { res.end(); } catch (e) {} }).pipe(res);
	});
}

var server = http.createServer(function (req, res) {
	setCors(res);
	var route = (req.url.split("?")[0] || "/").replace(/\/+$/, "") || "/";

	if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

	if (req.method === "GET" && (route === "/health" || route === "/relay/health" || route === "/api/media/health")) {
		res.writeHead(200, { "Content-Type": "application/json" });
		res.end(JSON.stringify({ ok: true, service: "harmony-app", port: PORT, clients: countClients() }));
		return;
	}

	if (req.method === "POST" && (route === "/api/e" || route === "/api/chat-log")) {
		var body = "";
		req.on("data", function (c) { body += c; if (body.length > 1e6) req.destroy(); });
		req.on("end", function () {
			saveChatLog(body, function (err, file) {
				res.writeHead(err ? 500 : 200, { "Content-Type": "application/json" });
				res.end(JSON.stringify(err ? { ok: false, error: String(err && err.message || err) } : { ok: true, file: file }));
			});
		});
		return;
	}

	if (req.method === "GET") { serveStatic(req, res); return; }
	res.writeHead(404); res.end("Not found");
});

// ---- WebSocket relay (same port, only on the /relay path) ----
var wss = new WebSocketServer({ server: server, path: "/relay", maxPayload: MAX_TEXT + 1024 });
var rooms = Object.create(null);   // channel -> Set of sockets

function countClients() {
	var n = 0;
	for (var ch in rooms) n += rooms[ch].size;
	return n;
}
function leaveRoom(s) {
	var ch = s._room;
	if (!ch || !rooms[ch]) return;
	rooms[ch].delete(s);
	if (rooms[ch].size === 0) delete rooms[ch];
	s._room = null;
}
function joinRoom(s, ch) {
	ch = (typeof ch === "string" && ch.length) ? ch.slice(0, 256) : "lobby";
	if (s._room === ch) return;
	if (s._room) leaveRoom(s);
	s._room = ch;
	if (!rooms[ch]) rooms[ch] = new Set();
	rooms[ch].add(s);
}
function sanitizeP(p) {
	if (!p || typeof p !== "object") return { _id: "", name: "" };
	return { _id: String(p._id == null ? "" : p._id).slice(0, MAX_ID), name: String(p.name == null ? "" : p.name).slice(0, MAX_ID) };
}
function broadcast(sender, frame) {
	var set = rooms[sender._room];
	if (!set) return;
	var data = JSON.stringify(frame);
	set.forEach(function (peer) {
		if (peer !== sender && peer.readyState === 1) { try { peer.send(data); } catch (e) {} }
	});
}

wss.on("connection", function (socket) {
	socket._room = null;
	socket.isAlive = true;
	socket.on("pong", function () { socket.isAlive = true; });
	socket.on("message", function (raw) {
		var m;
		try { m = JSON.parse(raw.toString()); } catch (e) { return; }
		if (!m || typeof m !== "object") return;
		switch (m.m) {
			case "hi": case "join": joinRoom(socket, m.ch); break;
			case "ping": try { socket.send('{"m":"pong"}'); } catch (e) {} break;
			case "b":
				if (typeof m.text !== "string" || m.text.length > MAX_TEXT) return;
				if (typeof m.ch === "string" && m.ch !== socket._room) joinRoom(socket, m.ch);
				if (!socket._room) joinRoom(socket, "lobby");
				broadcast(socket, { m: "b", text: m.text, p: sanitizeP(m.p) });
				break;
		}
	});
	socket.on("close", function () { leaveRoom(socket); });
	socket.on("error", function () { try { socket.close(); } catch (e) {} });
});

var heartbeat = setInterval(function () {
	wss.clients.forEach(function (socket) {
		if (socket.isAlive === false) { try { socket.terminate(); } catch (e) {} return; }
		socket.isAlive = false;
		try { socket.ping(); } catch (e) {}
	});
}, 30000);
wss.on("close", function () { clearInterval(heartbeat); });

server.listen(PORT, function () {
	try { fs.mkdirSync(LOG_DIR, { recursive: true }); } catch (e) {}
	console.log("Harmony app + real-time relay listening on http://localhost:" + PORT);
	console.log("  relay WebSocket: ws://localhost:" + PORT + "/relay");
	console.log("  chat logs -> " + LOG_DIR);
	console.log("  Open http://localhost:" + PORT + "/  (media uploads still need media-server.py on :8551)");
});
