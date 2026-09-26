/**
 * RoomSync — browser transport for the Harmony relay (relay-server.js).
 *
 * Provides reliable, rate-limit-free real-time broadcast between everyone in the
 * same channel for the custom "fun" features. Auto-reconnects, mirrors the
 * channel the MPP client is in, and degrades gracefully: when the relay can't be
 * reached, Client.broadcastRoom() pauses sync (it does NOT fall back to MPP
 * chat, which would spam vanilla multiplayerpiano.com users with BF|/RM|/…).
 */
(function (global) {
	"use strict";

	function RoomSync(opts) {
		opts = opts || {};
		this.uri = opts.uri || null;
		this.channel = opts.channel || "lobby";
		this.getIdentity = opts.getIdentity || function () { return { _id: "", name: "" }; };
		this.onText = opts.onText || function () {};
		this.onManageNoob = opts.onManageNoob || function () {};
		this.onManageAnon = opts.onManageAnon || function () {};
		this.onManageClose = opts.onManageClose || function () {};
		this.ws = null;
		this.canConnect = false;
		this.reconnectAttempts = 0;
		this.reconnectTimer = null;
		this.pingTimer = null;
		this.connectTimer = null;
		this.lastRx = 0;
		this._listenersBound = false;
	}

	// Slow / flaky internet: a socket can hang while connecting or die silently
	// while still reporting OPEN. Give up on slow handshakes, and replace the
	// socket if the relay (which answers every ping) goes quiet for too long.
	var CONNECT_TIMEOUT_MS = 20000;
	var PING_MS = 15000;
	var STALE_MS = 50000;

	RoomSync.prototype.isSupported = function () {
		return typeof WebSocket === "function" && !!this.uri;
	};

	RoomSync.prototype.isConnected = function () {
		return !!(this.ws && this.ws.readyState === WebSocket.OPEN);
	};

	RoomSync.prototype.start = function () {
		if (!this.isSupported()) return;
		this.canConnect = true;
		this._connect();
	};

	RoomSync.prototype.stop = function () {
		this.canConnect = false;
		clearTimeout(this.reconnectTimer);
		this.reconnectTimer = null;
		if (this.ws) { try { this.ws.close(); } catch (e) {} }
	};

	RoomSync.prototype.setChannel = function (ch) {
		if (!ch || ch === this.channel) return;
		this.channel = ch;
		this._send({ m: "join", ch: ch, p: this.getIdentity() });
	};

	RoomSync.prototype._connect = function () {
		if (!this.canConnect || !this.isSupported()) return;
		if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) return;

		var self = this;
		this._bindListeners();
		clearTimeout(this.reconnectTimer);
		this.reconnectTimer = null;
		var sock;
		try { sock = new WebSocket(this.uri); } catch (e) { this._scheduleReconnect(); return; }
		this.ws = sock;

		clearTimeout(this.connectTimer);
		this.connectTimer = setTimeout(function () {
			if (self.ws === sock && sock.readyState === WebSocket.CONNECTING) self._abandon(sock);
		}, CONNECT_TIMEOUT_MS);

		sock.addEventListener("open", function () {
			if (self.ws !== sock) return;
			clearTimeout(self.connectTimer);
			self.reconnectAttempts = 0;
			self.lastRx = Date.now();
			self._send({ m: "hi", ch: self.channel, p: self.getIdentity() });
			clearInterval(self.pingTimer);
			self.pingTimer = setInterval(function () {
				if (self.ws !== sock) return;
				if (Date.now() - self.lastRx > STALE_MS) {
					try { console.warn("[RoomSync] relay went quiet — reconnecting"); } catch (e) {}
					self._abandon(sock);
					return;
				}
				self._send({ m: "ping" });
			}, PING_MS);
			try { console.info("[RoomSync] real-time relay connected:", self.uri); } catch (e) {}
		});

		sock.addEventListener("message", function (evt) {
			if (self.ws !== sock) return;
			self.lastRx = Date.now();
			var data;
			try { data = JSON.parse(evt.data); } catch (e) { return; }
			var arr = Array.isArray(data) ? data : [data];
			for (var i = 0; i < arr.length; i++) {
				var m = arr[i];
				if (m && m.m === "b" && typeof m.text === "string") {
					self.onText({ message: m.text, p: m.p || { _id: "", name: "" } });
				} else if (m && m.m === "manage-noob") {
					self.onManageNoob(!!m.hidden);
				} else if (m && m.m === "manage-anon") {
					self.onManageAnon(!!m.hidden);
				} else if (m && m.m === "manage-close") {
					self.onManageClose(String(m._id == null ? "" : m._id));
				}
			}
		});

		sock.addEventListener("close", function () {
			self._onClosed(sock);
		});

		sock.addEventListener("error", function () {
			try { sock.close(); } catch (e) {}
		});
	};

	RoomSync.prototype._onClosed = function (sock) {
		// Handle each socket once, and ignore late events from a replaced one.
		if (sock._rsClosed) return;
		sock._rsClosed = true;
		if (this.ws !== sock) return;
		this.ws = null;
		clearInterval(this.pingTimer);
		clearTimeout(this.connectTimer);
		try { console.warn("[RoomSync] relay disconnected — feature sync paused until it returns:", this.uri); } catch (e) {}
		this._scheduleReconnect();
	};

	// Drop a stuck/dead socket immediately instead of waiting for the browser's
	// close handshake, which can take a very long time on a dead connection.
	RoomSync.prototype._abandon = function (sock) {
		try { sock.close(); } catch (e) {}
		this._onClosed(sock);
	};

	RoomSync.prototype.reconnectNow = function () {
		if (!this.canConnect) return;
		clearTimeout(this.reconnectTimer);
		this.reconnectTimer = null;
		this.reconnectAttempts = 0;
		if (this.ws) this._abandon(this.ws);
		clearTimeout(this.reconnectTimer);
		this.reconnectTimer = null;
		this._connect();
	};

	RoomSync.prototype._bindListeners = function () {
		if (this._listenersBound || typeof window === "undefined" || !window.addEventListener) return;
		this._listenersBound = true;
		var self = this;
		window.addEventListener("online", function () {
			if (self.isConnected() && Date.now() - self.lastRx < 5000) return;
			self.reconnectNow();
		});
		document.addEventListener("visibilitychange", function () {
			if (document.visibilityState !== "visible" || !self.canConnect) return;
			if (!self.ws || (self.isConnected() && Date.now() - self.lastRx > STALE_MS)) {
				self.reconnectNow();
			} else if (self.isConnected()) {
				self._send({ m: "ping" });
			}
		});
	};

	RoomSync.prototype._scheduleReconnect = function () {
		if (!this.canConnect || this.reconnectTimer) return;
		var self = this;
		var lut = [500, 1000, 2000, 4000, 8000];
		var idx = this.reconnectAttempts++;
		if (idx >= lut.length) idx = lut.length - 1;
		this.reconnectTimer = setTimeout(function () {
			self.reconnectTimer = null;
			self._connect();
		}, lut[idx]);
	};

	RoomSync.prototype._send = function (obj) {
		if (!this.isConnected()) return false;
		try { this.ws.send(JSON.stringify(obj)); return true; } catch (e) { return false; }
	};

	// Returns true if the broadcast was handed to the relay; false means the
	// caller should fall back to another transport (chat).
	RoomSync.prototype.broadcast = function (text) {
		if (typeof text !== "string" || !this.isConnected()) return false;
		return this._send({ m: "b", ch: this.channel, text: text, p: this.getIdentity() });
	};

	// Requests a GLOBAL change (affects every connected client, not just this
	// browser) — the relay holds the authoritative flag and echoes the new
	// value back to everyone (including us) as a "manage-noob" message, which
	// arrives via onManageNoob. Returns false if the relay isn't reachable.
	RoomSync.prototype.setLobbyNoobHidden = function (hidden) {
		return this._send({ m: "manage-noob-set", hidden: !!hidden });
	};

	// Global show/hide for the backup-server "mybot" Anonymous ghost.
	RoomSync.prototype.setMybotAnonymousHidden = function (hidden) {
		return this._send({ m: "manage-anon-set", hidden: !!hidden });
	};

	// Asks the relay to tell the Harmony tab(s) for this user _id to close.
	// The relay rebroadcasts "manage-close" to everyone; only the matching
	// client actually shuts its tab. Returns false if the relay isn't reachable.
	RoomSync.prototype.closePianoFor = function (_id) {
		_id = String(_id == null ? "" : _id);
		if (!_id) return false;
		return this._send({ m: "manage-close-set", _id: _id });
	};

	if (typeof module !== "undefined" && module.exports) {
		module.exports = RoomSync;
	} else {
		global.RoomSync = RoomSync;
	}
})(typeof window !== "undefined" ? window : this);
