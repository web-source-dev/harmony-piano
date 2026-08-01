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
var MAX_TEXT = 65536;  // large enough for WebRTC SDP offers (~2-5 KB) plus JSON wrapping
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
// Both WebSocket servers use noServer + a single shared upgrade router below, so
// they can coexist on the same HTTP server without one rejecting the other's
// path (attaching two path-scoped servers to one http server makes the first one
// 400 the other's upgrades).
var wss = new WebSocketServer({ noServer: true, maxPayload: MAX_TEXT + 1024 });
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
// Like broadcast(), but to every relay-connected socket in every room
// (including the sender) — used for global admin state like manage-noob,
// which must reach everyone regardless of which channel they're currently in.
function broadcastAll(frame) {
	var data = JSON.stringify(frame);
	for (var ch in rooms) {
		rooms[ch].forEach(function (peer) {
			if (peer.readyState === 1) { try { peer.send(data); } catch (e) {} }
		});
	}
}

// Reassigned by startMppLobbyNoobBot() once it runs; no-ops until then (or if
// the bot is disabled entirely via MPP_NOOB_BOT=0).
var gNoobBotStart = function () {};
var gNoobBotStop = function () {};

function setLobbyNoobHidden(hidden) {
	hidden = !!hidden;
	if (hidden !== gLobbyNoobHidden) {
		gLobbyNoobHidden = hidden;
		persistManageState();
		if (hidden) gNoobBotStop(); else gNoobBotStart();
		// Refresh backup-server lobby participant lists for everyone already in room.
		for (var id in mppRooms) {
			if (mppRooms.hasOwnProperty(id) && isLobbyRoomId(id)) mppBroadcastCh(mppRooms[id]);
		}
	}
	broadcastAll({ m: "manage-noob", hidden: gLobbyNoobHidden });
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
			case "hi": case "join":
				joinRoom(socket, m.ch);
				// Sync the joining client with the current global state right away.
				try { socket.send(JSON.stringify({ m: "manage-noob", hidden: gLobbyNoobHidden })); } catch (e) {}
				break;
			case "ping": try { socket.send('{"m":"pong"}'); } catch (e) {} break;
			case "b":
				if (typeof m.text !== "string" || m.text.length > MAX_TEXT) return;
				if (typeof m.ch === "string" && m.ch !== socket._room) joinRoom(socket, m.ch);
				if (!socket._room) joinRoom(socket, "lobby");
				broadcast(socket, { m: "b", text: m.text, p: sanitizeP(m.p) });
				break;
			case "manage-noob-set":
				setLobbyNoobHidden(m.hidden);
				break;
		}
	});
	socket.on("close", function () { leaveRoom(socket); });
	socket.on("error", function () { try { socket.close(); } catch (e) {} });
});

// ============================================================================
// Custom BACKUP Multiplayer Piano server (same port, path /mpp)
// ----------------------------------------------------------------------------
// The app's MAIN server is the public MPP (wss://game.multiplayerpiano.com). It
// goes down a lot, so this is the BACKUP: when the public server is unreachable
// the browser fails over here (see client.js failover + script.js gServers) so
// everyone in the room keeps playing together instead of dropping to offline
// mode or being unable to rejoin. It speaks just enough of the MPP protocol for
// the client: hi, t, ch, n, m, a, userset, chset, chown, +ls/-ls, kickban.
// ============================================================================
var mppWss = new WebSocketServer({ noServer: true, maxPayload: 1 << 20 });
var mppRooms = Object.create(null);   // chId -> { _id, settings, crown, parts:Map(pid->part) }
var MPP_COLORS = ["#8073ae", "#3c7fb1", "#52a72b", "#cd2b2b", "#d9760a", "#0fac9b", "#b13aa3", "#e0c020"];
var mppIdSeq = 0;

var LOBBY_NOOB = {
	id: "harmony-lobby-noob",
	_id: "harmony-noob-xx",
	name: "Noob x_x",
	color: "#808080",
	x: 50,
	y: 50
};

// Global show/hide flag for LOBBY_NOOB, controlled by the #manage panel in the
// web client (relay message "manage-noob-set"). This is the ONE authoritative
// flag — persisted to disk so a restart doesn't quietly flip it back, and
// applied to every surface that shows the ghost: the backup MPP server's
// participant list below, the real persistent bot (see startMppLobbyNoobBot),
// and every relay-connected browser (via broadcastAll). Flipping the switch
// therefore changes what ALL users see, not just the browser that toggled it.
var MANAGE_STATE_FILE = path.join(ROOT, "manage-state.json");
var gLobbyNoobHidden = false;
(function loadManageState() {
	try {
		var raw = JSON.parse(fs.readFileSync(MANAGE_STATE_FILE, "utf8"));
		gLobbyNoobHidden = !!raw.lobbyNoobHidden;
	} catch (e) {}
})();
function persistManageState() {
	try { fs.writeFileSync(MANAGE_STATE_FILE, JSON.stringify({ lobbyNoobHidden: gLobbyNoobHidden })); } catch (e) {}
}

function isLobbyRoomId(id) {
	return id === "lobby" || /^lobby\d+$/.test(id);
}

function isNoobProtectedName(name) {
	return !!(name && /noob/i.test(String(name)));
}

function mppGenId(prefix) {
	mppIdSeq = (mppIdSeq + 1) >>> 0;
	return (prefix || "") + Date.now().toString(16) + mppIdSeq.toString(16) + Math.floor(Math.random() * 0xffffff).toString(16);
}
function mppDefaultSettings() {
	return { visible: true, chat: true, crownsolo: false, "lobby": false, color: "#3b5054", color2: "#001014" };
}
function mppRoomPublic(room) {
	return { _id: room._id, settings: room.settings, crown: room.crown && room.crown.participantId ? room.crown : (room.crown || undefined) };
}
function mppPartPublic(p) {
	return { id: p.id, _id: p._id, name: p.name, color: p.color };
}
function mppPplArray(room) {
	var arr = [];
	room.parts.forEach(function (p) { arr.push({ id: p.id, _id: p._id, name: p.name, color: p.color, x: p.x, y: p.y }); });
	if (isLobbyRoomId(room._id) && !gLobbyNoobHidden) {
		var hasNoob = false;
		for (var i = 0; i < arr.length; i++) {
			if (isNoobProtectedName(arr[i].name)) { hasNoob = true; break; }
		}
		if (!hasNoob) arr.push(LOBBY_NOOB);
	}
	return arr;
}

function mppRoomParticipantCount(room) {
	var n = room.parts.size;
	if (isLobbyRoomId(room._id) && !gLobbyNoobHidden) {
		var hasNoob = false;
		room.parts.forEach(function (p) { if (isNoobProtectedName(p.name)) hasNoob = true; });
		if (!hasNoob) ++n;
	}
	return n;
}
function mppSend(sock, payload) {
	if (sock.readyState !== 1) return;
	try { sock.send(JSON.stringify(Array.isArray(payload) ? payload : [payload])); } catch (e) {}
}
function mppBroadcast(room, frame, exceptSock) {
	if (!room) return;
	var data = JSON.stringify(Array.isArray(frame) ? frame : [frame]);
	room.parts.forEach(function (p) {
		if (p.sock !== exceptSock && p.sock.readyState === 1) { try { p.sock.send(data); } catch (e) {} }
	});
}
// Every "ch" the client receives must carry ppl (client calls setParticipants(msg.ppl)).
function mppBroadcastCh(room) {
	mppBroadcast(room, { m: "ch", ch: mppRoomPublic(room), ppl: mppPplArray(room) });
}
function mppRoomList() {
	var list = [];
	for (var id in mppRooms) {
		var r = mppRooms[id];
		if (r.settings && r.settings.visible === false) continue;
		list.push({ _id: r._id, count: mppRoomParticipantCount(r), settings: r.settings, crown: r.crown || undefined });
	}
	return list;
}
function mppLsBroadcast() {
	var u = mppRoomList();
	mppWss.clients.forEach(function (sock) {
		if (sock.mpp && sock.mpp.lsSub && sock.readyState === 1) mppSend(sock, { m: "ls", c: false, u: u });
	});
}
function mppLeaveRoom(sock) {
	var st = sock.mpp;
	if (!st || !st.room) return;
	var room = mppRooms[st.room];
	st.room = null;
	if (!room) return;
	room.parts.delete(st.pid);
	var crownChanged = false;
	if (room.crown && room.crown.participantId === st.pid) {
		room.crown.participantId = undefined;
		room.crown.time = Date.now();
		crownChanged = true;
	}
	if (room.parts.size === 0) {
		delete mppRooms[room._id];
	} else {
		mppBroadcast(room, { m: "bye", p: st.pid });
		if (crownChanged) mppBroadcastCh(room);
	}
}
function mppJoinRoom(sock, chId, set) {
	var st = sock.mpp;
	chId = (typeof chId === "string" && chId.length) ? chId.slice(0, 512) : "lobby";
	if (st.room === chId && mppRooms[chId]) {
		var cur = mppRooms[chId];
		mppSend(sock, { m: "ch", ch: mppRoomPublic(cur), p: st.pid, ppl: mppPplArray(cur) });
		return;
	}
	if (st.room) mppLeaveRoom(sock);
	var room = mppRooms[chId];
	var created = false;
	if (!room) {
		room = mppRooms[chId] = {
			_id: chId,
			settings: mppDefaultSettings(),
			crown: { participantId: undefined, userId: undefined, time: Date.now() },
			parts: new Map()
		};
		if (set && typeof set === "object") {
			for (var k in set) if (set.hasOwnProperty(k)) room.settings[k] = set[k];
		}
		if (isLobbyRoomId(chId)) room.settings.lobby = true;
		created = true;
	}
	var part = { id: st.pid, _id: st.user._id, name: st.user.name, color: st.user.color, x: 50, y: 50, sock: sock };
	room.parts.set(st.pid, part);
	st.room = chId;
	if (created) {            // first person in a fresh room gets the crown
		room.crown.participantId = st.pid;
		room.crown.userId = st.user._id;
		room.crown.time = Date.now();
	}
	// Joiner: full channel + own participant id + everyone present.
	mppSend(sock, { m: "ch", ch: mppRoomPublic(room), p: st.pid, ppl: mppPplArray(room) });
	// Everyone else: the new participant.
	mppBroadcast(room, { m: "p", id: part.id, _id: part._id, name: part.name, color: part.color, x: part.x, y: part.y }, sock);
}
function mppHandle(sock, msg) {
	if (!msg || typeof msg !== "object") return;
	var st = sock.mpp;
	var room = st.room ? mppRooms[st.room] : null;
	switch (msg.m) {
		case "hi":
			mppSend(sock, { m: "hi", t: Date.now(), u: { _id: st.user._id, name: st.user.name, color: st.user.color }, motd: "Harmony backup server" });
			break;
		case "t":
			mppSend(sock, { m: "t", t: Date.now(), e: msg.e });
			break;
		case "ch":
			mppJoinRoom(sock, msg._id, msg.set);
			mppLsBroadcast();
			break;
		case "n":
			if (room && Array.isArray(msg.n)) mppBroadcast(room, { m: "n", p: st.pid, t: Date.now(), n: msg.n }, sock);
			break;
		case "m":
			if (room) {
				var px = +msg.x, py = +msg.y;
				if (isFinite(px)) st.x = px;
				if (isFinite(py)) st.y = py;
				var pm = room.parts.get(st.pid);
				if (pm) { pm.x = st.x; pm.y = st.y; }
				mppBroadcast(room, { m: "m", id: st.pid, x: st.x, y: st.y }, sock);
			}
			break;
		case "a":
			if (room && typeof msg.message === "string") {
				var p = room.parts.get(st.pid) || { id: st.pid, _id: st.user._id, name: st.user.name, color: st.user.color };
				// Use MAX_TEXT here — 512 was truncating WebRTC SDP offers (2-5 KB), breaking screen share signaling
				mppBroadcast(room, { m: "a", a: msg.message.slice(0, MAX_TEXT), p: mppPartPublic(p), t: Date.now() });
			}
			break;
		case "userset":
			if (msg.set && typeof msg.set === "object") {
				if (typeof msg.set.name === "string") st.user.name = msg.set.name.slice(0, 40);
				if (typeof msg.set.color === "string" && /^#[0-9a-fA-F]{6}$/.test(msg.set.color)) st.user.color = msg.set.color;
				var pu = room && room.parts.get(st.pid);
				if (pu) { pu.name = st.user.name; pu.color = st.user.color; }
				if (room) mppBroadcast(room, { m: "p", id: st.pid, _id: st.user._id, name: st.user.name, color: st.user.color, x: st.x, y: st.y });
			}
			break;
		case "chset":
			if (room && room.crown && room.crown.participantId === st.pid && msg.set && typeof msg.set === "object") {
				for (var sk in msg.set) if (msg.set.hasOwnProperty(sk)) room.settings[sk] = msg.set[sk];
				mppBroadcastCh(room);
				mppLsBroadcast();
			}
			break;
		case "chown":
			if (room && room.crown) {
				if (msg.id) {   // claim
					var ownerPresent = room.crown.participantId && room.parts.has(room.crown.participantId);
					if (!ownerPresent || room.crown.participantId === st.pid) {
						room.crown.participantId = st.pid;
						room.crown.userId = st.user._id;
						room.crown.time = Date.now();
						mppBroadcastCh(room);
					}
				} else if (room.crown.participantId === st.pid) {   // drop
					room.crown.participantId = undefined;
					room.crown.time = Date.now();
					mppBroadcastCh(room);
				}
			}
			break;
		case "kickban":
			if (room && room.crown && room.crown.participantId === st.pid && msg._id) {
				if (msg._id === LOBBY_NOOB._id) break;
				var targets = [];
				room.parts.forEach(function (p) {
					if (p._id === msg._id && p.sock !== sock && !isNoobProtectedName(p.name)) targets.push(p.sock);
				});
				targets.forEach(function (tsock) {
					mppSend(tsock, { m: "notification", title: "Notice", text: "You were kicked from the room.", duration: 7000 });
					mppLeaveRoom(tsock);
				});
			}
			break;
		case "+ls":
			st.lsSub = true;
			mppSend(sock, { m: "ls", c: true, u: mppRoomList() });
			break;
		case "-ls":
			st.lsSub = false;
			break;
		default:
			break; // devices, etc. — ignored
	}
}

mppWss.on("connection", function (sock) {
	sock.isAlive = true;
	sock.on("pong", function () { sock.isAlive = true; });
	sock.mpp = {
		user: { _id: mppGenId("u"), name: "Anonymous", color: MPP_COLORS[Math.floor(Math.random() * MPP_COLORS.length)] },
		pid: mppGenId(""),
		x: 50, y: 50, room: null, lsSub: false
	};
	sock.on("message", function (raw) {
		var arr;
		try { arr = JSON.parse(raw.toString()); } catch (e) { return; }
		if (!Array.isArray(arr)) arr = [arr];
		for (var i = 0; i < arr.length; i++) mppHandle(sock, arr[i]);
	});
	sock.on("close", function () { mppLeaveRoom(sock); mppLsBroadcast(); });
	sock.on("error", function () { try { sock.close(); } catch (e) {} });
});

var heartbeat = setInterval(function () {
	wss.clients.forEach(function (socket) {
		if (socket.isAlive === false) { try { socket.terminate(); } catch (e) {} return; }
		socket.isAlive = false;
		try { socket.ping(); } catch (e) {}
	});
	mppWss.clients.forEach(function (socket) {
		if (socket.isAlive === false) { try { socket.terminate(); } catch (e) {} return; }
		socket.isAlive = false;
		try { socket.ping(); } catch (e) {}
	});
}, 30000);
wss.on("close", function () { clearInterval(heartbeat); });

// Persistent "Noob x_x" in the public MPP lobby — no browser tab needed. This
// is a REAL participant on the real public server, so everyone there sees it
// (not just users of this custom client) — which is exactly why the #manage
// panel controls it directly instead of just hiding it locally per-browser.
// Set MPP_NOOB_BOT=0 to disable entirely (the #manage toggle then has nothing
// to start/stop). Uses MPP_NOOB_URI to override the server URL.
function startMppLobbyNoobBot() {
	if (process.env.MPP_NOOB_BOT === "0") {
		console.log("  lobby Noob x_x bot disabled (MPP_NOOB_BOT=0)");
		return;
	}
	var uri = process.env.MPP_NOOB_URI || "wss://game.multiplayerpiano.com:443";
	var reconnectMs = 8000;
	var WebSocketClient = ws;
	var wantConnected = false;
	var socket = null;
	var reconnectTimer = null;

	function connect() {
		if (!wantConnected) return;
		var bot;
		try {
			bot = new WebSocketClient(uri, { origin: "https://game.multiplayerpiano.com" });
		} catch (e) {
			reconnectTimer = setTimeout(connect, reconnectMs);
			return;
		}
		socket = bot;
		var joined = false;
		var pingIv = setInterval(function () {
			if (bot.readyState === 1) {
				try { bot.send(JSON.stringify([{ m: "t", e: Date.now() }])); } catch (e) {}
			}
		}, 20000);

		bot.on("open", function () {
			try { bot.send(JSON.stringify([{ m: "hi", x: 1, y: 1 }])); } catch (e) {}
		});
		bot.on("message", function (raw) {
			var tx;
			try { tx = JSON.parse(raw.toString()); } catch (e) { return; }
			if (!Array.isArray(tx)) tx = [tx];
			for (var i = 0; i < tx.length; i++) {
				var msg = tx[i];
				if (msg.m === "hi" && !joined) {
					joined = true;
					try {
						bot.send(JSON.stringify([
							{ m: "userset", set: { name: LOBBY_NOOB.name, color: LOBBY_NOOB.color } },
							{ m: "ch", _id: "lobby" }
						]));
					} catch (e) {}
				}
				if (msg.m === "ch" && msg.ch && !isLobbyRoomId(msg.ch._id)) {
					try { bot.send(JSON.stringify([{ m: "ch", _id: "lobby" }])); } catch (e) {}
				}
			}
		});
		bot.on("close", function () {
			clearInterval(pingIv);
			if (socket === bot) socket = null;
			if (wantConnected) reconnectTimer = setTimeout(connect, reconnectMs);
		});
		bot.on("error", function () {
			try { bot.close(); } catch (e) {}
		});
	}

	gNoobBotStart = function () {
		if (wantConnected) return;
		wantConnected = true;
		connect();
	};
	gNoobBotStop = function () {
		wantConnected = false;
		if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
		if (socket) { try { socket.close(); } catch (e) {} socket = null; }
	};

	if (!gLobbyNoobHidden) gNoobBotStart();
	console.log("  lobby Noob x_x bot -> " + uri + " (currently " + (gLobbyNoobHidden ? "hidden" : "shown") + "; MPP_NOOB_BOT=0 to disable)");
}

// Route WebSocket upgrades to the right server by path: /relay -> fun-feature
// relay, /mpp -> backup Multiplayer Piano server. Anything else is rejected.
server.on("upgrade", function (req, socket, head) {
	var pathname = (req.url || "").split("?")[0].replace(/\/+$/, "") || "/";
	if (pathname === "/relay") {
		wss.handleUpgrade(req, socket, head, function (ws) { wss.emit("connection", ws, req); });
	} else if (pathname === "/mpp") {
		mppWss.handleUpgrade(req, socket, head, function (ws) { mppWss.emit("connection", ws, req); });
	} else {
		socket.destroy();
	}
});

server.listen(PORT, function () {
	try { fs.mkdirSync(LOG_DIR, { recursive: true }); } catch (e) {}
	console.log("Harmony app + real-time relay listening on http://localhost:" + PORT);
	console.log("  relay WebSocket: ws://localhost:" + PORT + "/relay");
	console.log("  backup MPP server (failover): ws://localhost:" + PORT + "/mpp");
	console.log("  chat logs -> " + LOG_DIR);
	console.log("  Open http://localhost:" + PORT + "/  (media uploads still need media-server.py on :8551)");
	startMppLobbyNoobBot();
});
