/**
 * Harmony Piano — real-time room relay.
 *
 * The custom "fun" features (Blob Friend, Doodler, Emoji Party, Sound Board,
 * Party Game, room metronome, Room DJ controls) used to piggy-back their sync
 * on the public MultiplayerPiano chat, which flood-protects rapid messages and
 * silently drops them. This dedicated WebSocket relay broadcasts those updates
 * to everyone in the same channel with no rate limiting, so continuous features
 * stay in sync in real time.
 *
 * Protocol (JSON per frame):
 *   client -> relay  {m:"hi",   ch, p:{_id,name}}   join a channel on connect
 *                    {m:"join", ch, p:{_id,name}}   move to another channel
 *                    {m:"b",    ch, text, p}         broadcast text to the channel
 *                    {m:"ping"}                      keep-alive (also TCP ping/pong)
 *   relay  -> client {m:"b", text, p}                a peer's broadcast
 *                    {m:"pong"}                      ping reply
 *
 * The relay never echoes a broadcast back to its sender; senders apply their own
 * effect locally before broadcasting.
 *
 *   node relay-server.js [port]      (default 8552)
 */
"use strict";

var http = require("http");
var ws = require("ws");
var WebSocketServer = ws.WebSocketServer || ws.Server;

var PORT = parseInt(process.argv[2], 10) || parseInt(process.env.RELAY_PORT, 10) || 8552;
var MAX_TEXT = 8192;     // generous cap; doodle/blob frames are well under this
var MAX_ID = 64;

var server = http.createServer(function (req, res) {
	if (req.url === "/health" || req.url === "/relay/health") {
		res.writeHead(200, { "Content-Type": "text/plain" });
		res.end("ok " + countClients());
		return;
	}
	res.writeHead(426, { "Content-Type": "text/plain" });
	res.end("Upgrade Required");
});

var wss = new WebSocketServer({ server: server, maxPayload: MAX_TEXT + 1024 });

// channel id -> Set of sockets
var rooms = Object.create(null);

function countClients() {
	var n = 0;
	for (var ch in rooms) n += rooms[ch].size;
	return n;
}

function leaveRoom(socket) {
	var ch = socket._room;
	if (!ch || !rooms[ch]) return;
	rooms[ch].delete(socket);
	if (rooms[ch].size === 0) delete rooms[ch];
	socket._room = null;
}

function joinRoom(socket, ch) {
	ch = (typeof ch === "string" && ch.length) ? ch.slice(0, 256) : "lobby";
	if (socket._room === ch) return;
	if (socket._room) leaveRoom(socket);
	socket._room = ch;
	if (!rooms[ch]) rooms[ch] = new Set();
	rooms[ch].add(socket);
}

function sanitizeP(p) {
	if (!p || typeof p !== "object") return { _id: "", name: "" };
	return {
		_id: String(p._id == null ? "" : p._id).slice(0, MAX_ID),
		name: String(p.name == null ? "" : p.name).slice(0, MAX_ID)
	};
}

function broadcast(sender, frame) {
	var set = rooms[sender._room];
	if (!set) return;
	var data = JSON.stringify(frame);
	set.forEach(function (peer) {
		if (peer !== sender && peer.readyState === 1 /* OPEN */) {
			try { peer.send(data); } catch (e) {}
		}
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
			case "hi":
			case "join":
				joinRoom(socket, m.ch);
				break;
			case "ping":
				try { socket.send('{"m":"pong"}'); } catch (e) {}
				break;
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

// Drop dead connections so rooms don't leak.
var heartbeat = setInterval(function () {
	wss.clients.forEach(function (socket) {
		if (socket.isAlive === false) {
			try { socket.terminate(); } catch (e) {}
			return;
		}
		socket.isAlive = false;
		try { socket.ping(); } catch (e) {}
	});
}, 30000);

wss.on("close", function () { clearInterval(heartbeat); });

server.listen(PORT, function () {
	console.log("Harmony relay listening on :" + PORT);
});
