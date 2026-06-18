/**
 * RoomSync — browser transport for the Harmony relay (relay-server.js).
 *
 * Provides reliable, rate-limit-free real-time broadcast between everyone in the
 * same channel for the custom "fun" features. Auto-reconnects, mirrors the
 * channel the MPP client is in, and degrades gracefully: when the relay can't be
 * reached, Client.broadcastRoom() falls back to the old chat transport so the
 * app still works on plain static hosting with no relay.
 */
(function (global) {
	"use strict";

	function RoomSync(opts) {
		opts = opts || {};
		this.uri = opts.uri || null;
		this.channel = opts.channel || "lobby";
		this.getIdentity = opts.getIdentity || function () { return { _id: "", name: "" }; };
		this.onText = opts.onText || function () {};
		this.ws = null;
		this.canConnect = false;
		this.reconnectAttempts = 0;
		this.reconnectTimer = null;
		this.pingTimer = null;
	}

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
		var sock;
		try { sock = new WebSocket(this.uri); } catch (e) { this._scheduleReconnect(); return; }
		this.ws = sock;

		sock.addEventListener("open", function () {
			self.reconnectAttempts = 0;
			self._send({ m: "hi", ch: self.channel, p: self.getIdentity() });
			clearInterval(self.pingTimer);
			self.pingTimer = setInterval(function () { self._send({ m: "ping" }); }, 25000);
			try { console.info("[RoomSync] real-time relay connected:", self.uri); } catch (e) {}
		});

		sock.addEventListener("message", function (evt) {
			var data;
			try { data = JSON.parse(evt.data); } catch (e) { return; }
			var arr = Array.isArray(data) ? data : [data];
			for (var i = 0; i < arr.length; i++) {
				var m = arr[i];
				if (m && m.m === "b" && typeof m.text === "string") {
					self.onText({ message: m.text, p: m.p || { _id: "", name: "" } });
				}
			}
		});

		sock.addEventListener("close", function () {
			clearInterval(self.pingTimer);
			if (self.ws === sock) self.ws = null;
			try { console.warn("[RoomSync] relay disconnected — using chat fallback until it returns:", self.uri); } catch (e) {}
			self._scheduleReconnect();
		});

		sock.addEventListener("error", function () {
			try { sock.close(); } catch (e) {}
		});
	};

	RoomSync.prototype._scheduleReconnect = function () {
		if (!this.canConnect || this.reconnectTimer) return;
		var self = this;
		var lut = [1000, 2000, 4000, 8000, 15000];
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

	if (typeof module !== "undefined" && module.exports) {
		module.exports = RoomSync;
	} else {
		global.RoomSync = RoomSync;
	}
})(typeof window !== "undefined" ? window : this);
