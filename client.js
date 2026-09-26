
if(typeof module !== "undefined") {
	module.exports = Client;
	WebSocket = require("ws");
	EventEmitter = require("events").EventEmitter;
} else {
	this.Client = Client;
}


function mixin(obj1, obj2) {
	for(var i in obj2) {
		if(obj2.hasOwnProperty(i)) {
			obj1[i] = obj2[i];
		}
	}
};


function Client(uri) {
	EventEmitter.call(this);
	// `uri` may be a single URL or an ordered list of servers. The FIRST entry is
	// the primary (the public Multiplayer Piano server) and stays the main server;
	// the rest are backups used for failover. When the primary can't be reached,
	// the client switches to a backup so people in the room keep playing together
	// instead of dropping to offline mode or being unable to rejoin. Once the
	// primary is reachable again the client returns to it.
	this.servers = (Array.isArray(uri) ? uri.slice() : [uri]).filter(function(u) { return !!u; });
	if(this.servers.length === 0) this.servers = [uri];
	this.serverIndex = 0;
	this.serverFailCount = 0;       // consecutive failed connect attempts on current server
	this.failoverThreshold = 2;     // switch to the next server after this many failures
	this.manualServer = false;      // true when the user picked a server in the UI (stay put)
	this._switchingServer = false; // true while a manual switch is closing the old socket
	this.uri = this.servers[0];
	this.ws = undefined;
	this.serverTimeOffset = 0;
	this.user = undefined;
	this.participantId = undefined;
	this.channel = undefined;
	this.ppl = {};
	this.connectionTime = undefined;
	this.connectionAttempts = 0;
	this.desiredChannelId = undefined;
	this.desiredChannelSettings = undefined;
	this.pingInterval = undefined;
	this.canConnect = false;
	this.noteBuffer = [];
	this.noteBufferTime = 0;
	this.noteFlushInterval = undefined;
	this.watchdogInterval = undefined;
	this.connectTimer = undefined;
	this.joinTimer = undefined;
	this.reconnectTimer = undefined;
	this.lastMessageTime = 0;
	this.joined = false;
	this.chatQueue = [];       // typed but not sent yet
	this.chatInFlight = [];    // sent, waiting for the server's echo
	this._chatSeq = 0;
	this._probe = undefined;   // background spare connection (see _startProbe)
	this['🐈'] = 0;

	this.bindEventListeners();

	this.emit("status", "(Offline mode)");
};

mixin(Client.prototype, EventEmitter.prototype);

Client.prototype.constructor = Client;

Client.prototype.isSupported = function() {
	return typeof WebSocket === "function";
};

Client.prototype.isConnected = function() {
	return this.isSupported() && this.ws && this.ws.readyState === WebSocket.OPEN;
};

Client.prototype.isConnecting = function() {
	return this.isSupported() && this.ws && this.ws.readyState === WebSocket.CONNECTING;
};

Client.prototype.start = function() {
	this.canConnect = true;
	this.connect();
};

Client.prototype.stop = function() {
	this.canConnect = false;
	clearTimeout(this.reconnectTimer);
	this.reconnectTimer = undefined;
	this._dropProbe();
	if(this.ws) {
		try { this.ws.close(); } catch(e) {}
	}
};

// Human-readable info about the current (or given) server slot for the UI.
Client.prototype.getServerInfo = function(index) {
	var idx = (typeof index === "number") ? index : this.serverIndex;
	if(idx < 0 || idx >= this.servers.length) idx = 0;
	var uri = this.servers[idx] || "";
	var isBackup = idx > 0;
	var label = isBackup ? "Backup" : "MPP";
	try {
		if(uri.indexOf("multiplayerpiano.com") !== -1) label = "MPP";
		else if(isBackup) label = "Backup";
		else label = "Main";
	} catch(e) {}
	return {
		index: idx,
		uri: uri,
		label: label,
		isBackup: isBackup,
		manual: !!this.manualServer,
		count: this.servers.length
	};
};

// Force an immediate reconnect to servers[index]. When index !== 0 the choice is
// treated as a manual lock (auto failover / return-to-main is suspended) so the
// UI can keep people on the backup when public MPP is dead but not failing cleanly.
Client.prototype.switchServer = function(index) {
	index = parseInt(index, 10);
	if(isNaN(index) || index < 0 || index >= this.servers.length) return false;
	var sameAndLive = (index === this.serverIndex) && (this.isConnected() || this.isConnecting());
	this.manualServer = (index !== 0);
	this.serverIndex = index;
	this.uri = this.servers[index];
	this.serverFailCount = 0;
	this.connectionAttempts = 0;
	this.emit("status", index === 0 ? "Switching to main server..." : "Switching to backup server...");
	this.emit("server", this.getServerInfo());
	if(sameAndLive) return true;
	if(!this.canConnect) this.canConnect = true;
	clearTimeout(this.reconnectTimer);
	this.reconnectTimer = undefined;
	if(this.ws) {
		this._switchingServer = true;
		this._abandonSocket("switch server");
	} else {
		this.connect();
	}
	return true;
};

// ---------------------------------------------------------------------------
// Connection resilience (slow / flaky internet)
// ---------------------------------------------------------------------------
// Goal: on a slow connection everything may get slower, but chat must never
// pause, break, or need a page refresh.
//
// On a slow or unstable connection a WebSocket can get stuck in ways the
// browser does not report quickly: the handshake can hang in CONNECTING, or an
// OPEN socket can silently die (half-open TCP). The client handles this with:
//   * Make-before-break: when the server has been quiet for probeAfterMs, a
//     second connection is opened in the background. As soon as it is in the
//     room it takes over and the old one is closed, with no "disconnect" in
//     between. If the old connection turns out to be fine (data arrives), the
//     spare is dropped. Only after staleTimeoutMs of total silence is the old
//     connection given up the hard way.
//   * Upload progress counts as life: if our send buffer is draining, the
//     connection is slow, not dead, so it is left alone.
//   * Generous connect/join timeouts that retry instead of hanging forever.
//   * Immediate checks when the browser comes back online or the tab becomes
//     visible; "device offline" never triggers failover to the backup server.
//   * Reliable chat: every message typed is tracked until the server echoes it
//     back. Messages typed while reconnecting are queued; messages that were
//     in flight on a connection that died are re-sent on the new one (after
//     checking the room's chat history so nothing is sent twice); messages
//     the server silently dropped (rate limit) are retried a couple of times.
//     The UI gets "chat pending" / "chat delivered" / "chat failed" events.
//   * Cursor-move updates are skipped while the upload is backed up so notes
//     and chat aren't stuck behind stale mouse positions.
Client.prototype.connectTimeoutMs = 30000;
Client.prototype.joinTimeoutMs = 30000;
Client.prototype.pingIntervalMs = 10000;
Client.prototype.probeAfterMs = 25000;
Client.prototype.probeTimeoutMs = 30000;
Client.prototype.staleTimeoutMs = 90000;
Client.prototype.watchdogMs = 5000;
Client.prototype.maxBufferedForCursor = 16 * 1024;
Client.prototype.chatQueueMax = 30;
Client.prototype.chatQueueMaxAgeMs = 5 * 60 * 1000;
Client.prototype.chatMaxTries = 3;
Client.prototype.chatSendSpacingMs = 700;

Client.prototype.isOnline = function() {
	return typeof navigator === "undefined" || navigator.onLine !== false;
};

Client.prototype._clearConnTimers = function() {
	clearInterval(this.pingInterval);
	clearInterval(this.noteFlushInterval);
	clearInterval(this.watchdogInterval);
	clearTimeout(this.connectTimer);
	clearTimeout(this.joinTimer);
	clearTimeout(this._flushTimer);
	this.pingInterval = undefined;
	this.noteFlushInterval = undefined;
	this.watchdogInterval = undefined;
	this.connectTimer = undefined;
	this.joinTimer = undefined;
	this._flushTimer = undefined;
};

// Drop the current socket right now and run the normal close/reconnect logic,
// without waiting for the browser's close handshake (which on a dead
// connection can take a minute or more to fire "close").
Client.prototype._abandonSocket = function(reason) {
	var sock = this.ws;
	if(!sock) return;
	try { sock.close(); } catch(e) {}
	this._onSocketClosed(sock, { code: 4000, reason: reason || "abandoned" });
};

// Force a fresh connection (e.g. after coming back online). Resets backoff.
Client.prototype.reconnectNow = function(reason) {
	if(!this.canConnect) return;
	clearTimeout(this.reconnectTimer);
	this.reconnectTimer = undefined;
	this.connectionAttempts = 0;
	if(this.ws) {
		this._abandonSocket(reason || "reconnect");
	} else {
		this.connect();
	}
};

// Time since we last had any sign the current connection is alive.
Client.prototype._silentFor = function() {
	return Date.now() - Math.max(this.lastMessageTime || 0, this.lastProgressTime || 0);
};

// Cheap liveness check: ping if we haven't heard from the server lately, and
// open a spare connection in the background if it's been quiet for a while.
Client.prototype.checkConnection = function() {
	if(!this.canConnect) return;
	if(this.isConnected()) {
		var silent = this._silentFor();
		if(silent > this.probeAfterMs) this._startProbe();
		if(silent > 3000) this.sendArray([{m: "t", e: Date.now()}]);
	} else if(!this.isConnecting()) {
		this.reconnectNow("check");
	}
};

Client.prototype._scheduleReconnect = function(ms) {
	if(!this.canConnect) return;
	clearTimeout(this.reconnectTimer);
	if(typeof ms !== "number") {
		var ms_lut = [50, 1000, 2000, 4000, 6000, 8000];
		var idx = this.connectionAttempts;
		if(idx >= ms_lut.length) idx = ms_lut.length - 1;
		ms = ms_lut[idx];
		if(idx > 0) ms += Math.floor(Math.random() * 500); // spread reconnects out a bit
	}
	var self = this;
	this.reconnectTimer = setTimeout(function() {
		self.reconnectTimer = undefined;
		self.connect();
	}, ms);
};

Client.prototype._onSocketClosed = function(sock, evt) {
	// Each socket is handled exactly once, and only if it's still ours — a late
	// "close" from an old socket must not tear down its replacement.
	if(sock._harmonyClosed) return;
	sock._harmonyClosed = true;
	if(this.ws !== sock) return;
	this.ws = undefined;
	this._dropProbe();
	this._requeueInFlightChat();
	this.user = undefined;
	this.participantId = undefined;
	this.channel = undefined;
	this.joined = false;
	this.setParticipants([]);
	this._clearConnTimers();

	this.emit("disconnect", evt);
	this.emit("status", !this.canConnect ? "Offline mode"
		: this.isOnline() ? "Reconnecting..." : "No internet — will reconnect automatically...");

	// Manual switch: skip auto failover / "return to main" and reconnect ASAP
	// on the server the user just picked.
	if(this._switchingServer) {
		this._switchingServer = false;
		this.connectionTime = undefined;
		this.connectionAttempts = 0;
		this.serverFailCount = 0;
		this.emit("server", this.getServerInfo());
		this._scheduleReconnect(50);
		return;
	}

	// reconnect (with failover between the main server and backups)
	if(this.connectionTime) {
		// We had a live connection that just dropped.
		this.connectionTime = undefined;
		this.connectionAttempts = 0;
		this.serverFailCount = 0;
		// If that connection was on a backup, prefer the main server again so
		// the room returns to public MPP as soon as it's reachable — unless the
		// user manually locked onto a server from the UI.
		if(this.serverIndex !== 0 && !this.manualServer) {
			this.serverIndex = 0;
			this.uri = this.servers[0];
			this.emit("server", this.getServerInfo());
		}
	} else {
		// Couldn't connect at all.
		++this.connectionAttempts;
		// When the device itself is offline every server fails; that says nothing
		// about the server, so don't let it trigger failover to the backup.
		if(this.isOnline()) ++this.serverFailCount;
		// After enough failures on the current server, fail over to the next
		// one in the list. The list wraps, so a dead backup loops back to the
		// main server and keeps retrying it. Skip while the user has a manual
		// server lock so we don't bounce them off their choice.
		if(!this.manualServer && this.servers.length > 1 && this.serverFailCount >= this.failoverThreshold) {
			this.serverFailCount = 0;
			this.serverIndex = (this.serverIndex + 1) % this.servers.length;
			this.uri = this.servers[this.serverIndex];
			this.emit("status", this.serverIndex === 0 ? "Retrying main server..." : "Switching to backup server...");
			this.emit("server", this.getServerInfo());
		}
	}
	// While offline, the browser's "online" event reconnects right away (see
	// _bindNetworkListeners); keep a slow retry as a safety net.
	this._scheduleReconnect(this.isOnline() ? undefined : 10000);
};

Client.prototype._bindNetworkListeners = function() {
	if(this._networkListenersBound) return;
	if(typeof window === "undefined" || typeof window.addEventListener !== "function") return;
	this._networkListenersBound = true;
	var self = this;
	window.addEventListener("online", function() {
		if(!self.canConnect) return;
		self.serverFailCount = 0;
		if(self.isConnected()) {
			// The connection may have survived the outage, or may be half-dead.
			// Ping it, and if it has been quiet open a spare in the background —
			// no disconnect either way.
			self.sendArray([{m: "t", e: Date.now()}]);
			if(self._silentFor() > 5000) self._startProbe();
			return;
		}
		self.reconnectNow("online");
	});
	window.addEventListener("offline", function() {
		if(self.canConnect && !self.isConnected()) {
			self.emit("status", "No internet — will reconnect automatically...");
		}
	});
	if(typeof document !== "undefined" && typeof document.addEventListener === "function") {
		// Background tabs have their timers throttled (and mobile browsers may
		// freeze them), so check the connection as soon as the tab is visible.
		document.addEventListener("visibilitychange", function() {
			if(document.visibilityState === "visible") self.checkConnection();
		});
	}
	window.addEventListener("pageshow", function(evt) {
		if(evt && evt.persisted) self.checkConnection();
	});
};

// Opens a WebSocket and wires it up. The same socket can start life as the
// main connection (this.ws) or as a background spare (this._probe) that is
// promoted to main once it has joined the room.
Client.prototype._createSocket = function(uri, log) {
	var sock;
	try {
		if(typeof module !== "undefined") {
			// nodejsicle
			sock = new WebSocket(uri, {
				origin: "https://game.multiplayerpiano.com"
			});
			// Swallow errors so a failed connection can't throw an uncaught
			// 'error' and crash the node process; "close" handles the retry.
			sock.on("error", function() {});
		} else {
			// browseroni
			sock = new WebSocket(uri);
		}
	} catch(e) {
		return null;
	}
	var self = this;
	sock.addEventListener("close", function(evt) {
		log && console.log(`close`, evt)
		if(sock === self._probe) { self._dropProbe(); return; }
		self._onSocketClosed(sock, evt);
	});
	sock.addEventListener("error", function(err) {
		log && console.log(`ws error`, err)
		if(sock === self._probe) { self._dropProbe(); return; }
		if(self.ws !== sock) return;
		self.emit("wserror", err);
		try { sock.close(); } catch(e) {}
	});
	sock.addEventListener("open", function(evt) {
		log && console.log(`ws open`)
		if(sock === self._probe) {
			self._sendOn(sock, [{m: "hi", x: 1, y: 1}]);
			return;
		}
		if(self.ws !== sock) return;
		self._onSocketOpen(sock, false, log);
	});
	sock.addEventListener("message", function(evt) {
		var transmission;
		try { transmission = JSON.parse(evt.data); } catch(e) { return; }
		if(!Array.isArray(transmission)) transmission = [transmission];
		if(sock === self._probe) { self._onProbeMessage(sock, transmission); return; }
		if(self.ws !== sock) return;
		self.lastMessageTime = sock._lastRx = Date.now();
		log && console.log(`message`, transmission)
		self._dispatch(transmission);
	});
	return sock;
};

Client.prototype._sendOn = function(sock, arr) {
	try { sock.send(JSON.stringify(arr)); return true; } catch(e) { return false; }
};

Client.prototype._dispatch = function(transmission) {
	for(var i = 0; i < transmission.length; i++) {
		var msg = transmission[i];
		if(!msg || typeof msg.m !== "string") continue;
		try {
			this.emit(msg.m, msg);
		} catch(e) {
			// A bug in one feature's handler must not stop the rest of the
			// batch (e.g. chat) from being processed.
			try { console.error(e); } catch(e2) {}
		}
	}
};

// Timers and handshake for a socket that has just become the main connection.
// `promoted` = it's a background spare that already said hi and joined.
Client.prototype._onSocketOpen = function(sock, promoted, log) {
	var self = this;
	clearTimeout(this.connectTimer);
	this.connectionTime = Date.now();
	this.lastMessageTime = Date.now();
	this.lastProgressTime = 0;
	this.serverFailCount = 0;
	if(this.serverIndex > 0 && !promoted) this.emit("status", "Connected to backup server");
	this.emit("server", this.getServerInfo());
	if(!promoted) this.sendArray([{"m": "hi", "x": 1, "y": 1, "🐈": this['🐈']++ || undefined }]);
	this.pingInterval = setInterval(function() {
		self.sendArray([{m: "t", e: Date.now()}]);
	}, this.pingIntervalMs);
	this.watchdogInterval = setInterval(function() {
		if(self.ws !== sock) return;
		// A draining send buffer means the link is slow, not dead.
		var buf = sock.bufferedAmount || 0;
		if(buf > 0 && typeof sock._lastBuf === "number" && buf < sock._lastBuf) self.lastProgressTime = Date.now();
		sock._lastBuf = buf;
		var silent = self._silentFor();
		var hardSilent = Date.now() - (self.lastMessageTime || 0);
		if(silent > self.staleTimeoutMs || hardSilent > self.staleTimeoutMs * 3) {
			log && console.log(`connection stale`);
			self._abandonSocket("stale");
			return;
		}
		if(silent > self.probeAfterMs) self._startProbe();
		self._expireChat();
	}, this.watchdogMs);
	// Connected but never put into a channel: retry instead of sitting on
	// "Joining channel..." forever — but keep waiting while the server is
	// still talking to us (just slow).
	var armJoinTimer = function() {
		self.joinTimer = setTimeout(function() {
			if(self.ws !== sock || self.joined) return;
			if(sock._lastRx && Date.now() - sock._lastRx < 15000) {
				if(self.desiredChannelId) self.setChannel();
				armJoinTimer();
				return;
			}
			log && console.log(`join timeout`);
			self._abandonSocket("join timeout");
		}, self.joinTimeoutMs);
	};
	if(!promoted) armJoinTimer();
	this.noteBuffer = [];
	this.noteBufferTime = 0;
	this.noteFlushInterval = setInterval(function() {
		if(self.noteBufferTime && self.noteBuffer.length > 0) {
			self.sendArray([{m: "n", t: self.noteBufferTime + self.serverTimeOffset, n: self.noteBuffer}]);
			self.noteBufferTime = 0;
			self.noteBuffer = [];
		}
	}, 200);

	this.emit("connect");
	if(!promoted) this.emit("status", "Joining channel...");
};

Client.prototype._startProbe = function() {
	if(this._probe || !this.canConnect || !this.isOnline() || !this.isConnected()) return;
	var sock = this._createSocket(this.uri);
	if(!sock) return;
	this._probe = sock;
	sock._probeStarted = Date.now();
	console.log("Connection quiet — opening a spare connection in the background");
	var self = this;
	clearTimeout(this._probeTimer);
	this._probeTimer = setTimeout(function() {
		if(self._probe === sock) self._dropProbe();
	}, this.probeTimeoutMs);
};

Client.prototype._dropProbe = function() {
	var sock = this._probe;
	clearTimeout(this._probeTimer);
	this._probeTimer = undefined;
	if(!sock) return;
	this._probe = undefined;
	sock._harmonyClosed = true;
	try { sock.close(); } catch(e) {}
};

Client.prototype._onProbeMessage = function(sock, transmission) {
	// If the main connection has woken up meanwhile, the spare isn't needed.
	if((this.lastMessageTime || 0) > sock._probeStarted) { this._dropProbe(); return; }
	for(var i = 0; i < transmission.length; i++) {
		var msg = transmission[i];
		if(!msg) continue;
		if(msg.m === "hi") {
			sock._hi = msg;
			var want = this.lastUserSet;
			if(want && msg.u && ((want.name && want.name !== msg.u.name) || (want.color && want.color !== msg.u.color))) {
				this._sendOn(sock, [{m: "userset", set: want}]);
			}
			this._sendOn(sock, [{m: "ch", _id: this.desiredChannelId || "lobby", set: this.desiredChannelSettings}]);
		} else if(msg.m === "ch") {
			this._promoteProbe(sock, transmission.slice(i));
			return;
		}
	}
};

// The spare connection is in the room: make it the main connection and close
// the old one. No "disconnect" is emitted, so chat and the UI never blink.
Client.prototype._promoteProbe = function(sock, rest) {
	var old = this.ws;
	clearTimeout(this._probeTimer);
	this._probeTimer = undefined;
	this._probe = undefined;
	if(old) {
		old._harmonyClosed = true;
		try { old.close(); } catch(e) {}
	}
	console.log("Switched to a fresh connection (old one was too slow / dead)");
	this._requeueInFlightChat();
	this._clearConnTimers();
	this.ws = sock;
	this.joined = false;
	this._onSocketOpen(sock, true);
	var hi = sock._hi;
	if(hi) {
		this.user = hi.u;
		this.receiveServerTime(hi.t, hi.e || undefined);
	}
	this.lastMessageTime = Date.now();
	this._dispatch(rest);
};

Client.prototype.connect = function(log) {
	if(!this.canConnect || !this.isSupported() || this.isConnected() || this.isConnecting())
		return;
	clearTimeout(this.reconnectTimer);
	this.reconnectTimer = undefined;
	this._bindNetworkListeners();
	this.uri = this.servers[this.serverIndex] || this.servers[0];
	var onBackup = this.serverIndex > 0;
	this.emit("status", onBackup ? "Connecting to backup server..." : "Connecting...");
	console.log(`Connect to ${this.uri}` + (onBackup ? " (backup server)" : ""))
	var sock = this._createSocket(this.uri, log);
	if(!sock) {
		// Bad URL / blocked constructor: treat as a failed attempt and retry.
		var failed = {};
		this.ws = failed;
		this._onSocketClosed(failed, { code: 4001, reason: "construct failed" });
		return;
	}
	this.ws = sock;
	this.joined = false;
	var self = this;

	// Handshake taking too long: give up on this attempt and try again.
	clearTimeout(this.connectTimer);
	this.connectTimer = setTimeout(function() {
		if(self.ws === sock && sock.readyState === WebSocket.CONNECTING) {
			log && console.log(`connect timeout`);
			self._abandonSocket("connect timeout");
		}
	}, this.connectTimeoutMs);
};

// ---------------------------------------------------------------------------
// Reliable chat
// ---------------------------------------------------------------------------
// Send a chat message typed by the user. It is shown as pending right away
// (via "chat pending"), sent now if we're in a room or queued if we're
// reconnecting, and tracked until the server echoes it back ("chat
// delivered"). Returns "sent" or "queued".
Client.prototype.sendChat = function(message) {
	var item = { id: ++this._chatSeq, message: message, time: Date.now(), tries: 0, resent: false };
	this.emit("chat pending", { id: item.id, message: message });
	if(this.isConnected() && this.joined) {
		this._transmitChat(item);
		return "sent";
	}
	this.chatQueue.push(item);
	while(this.chatQueue.length > this.chatQueueMax) this._failChat(this.chatQueue.shift());
	this.checkConnection();
	return "queued";
};

Client.prototype._transmitChat = function(item) {
	item.tries++;
	item.sentAt = Date.now();
	this.chatInFlight.push(item);
	this.sendArray([{m: "a", message: item.message}]);
};

Client.prototype._failChat = function(item) {
	if(item) this.emit("chat failed", { id: item.id, message: item.message });
};

Client.prototype._deliverChat = function(item) {
	this.emit("chat delivered", { id: item.id, message: item.message });
};

// Messages sent on a connection that then died may or may not have arrived.
// Put them back at the front of the queue; they're checked against the room's
// chat history before being sent again.
Client.prototype._requeueInFlightChat = function() {
	if(!this.chatInFlight.length) return;
	var inflight = this.chatInFlight;
	this.chatInFlight = [];
	for(var i = inflight.length - 1; i >= 0; i--) {
		inflight[i].resent = true;
		this.chatQueue.unshift(inflight[i]);
	}
};

Client.prototype._expireChat = function() {
	var now = Date.now();
	var self = this;
	this.chatInFlight = this.chatInFlight.filter(function(item) {
		if(now - item.time > self.chatQueueMaxAgeMs) { self._failChat(item); return false; }
		return true;
	});
};

Client.prototype._isOwnChat = function(msg, allowName) {
	var p = msg && msg.p;
	if(!p) return false;
	if(this.user && p._id && p._id === this.user._id) return true;
	if(this.participantId && p.id && p.id === this.participantId) return true;
	if(allowName) {
		var myName = (this.lastUserSet && this.lastUserSet.name) || (this.user && this.user.name);
		if(myName && p.name === myName) return true;
	}
	return false;
};

Client.prototype._flushChatQueue = function() {
	clearTimeout(this._flushTimer);
	this._flushTimer = undefined;
	if(!this.chatQueue.length) return;
	var self = this;
	var now = Date.now();
	var pending = this.chatQueue.filter(function(q) {
		if(now - q.time < self.chatQueueMaxAgeMs) return true;
		self._failChat(q);
		return false;
	});
	this.chatQueue = [];
	// Space them out so the server's chat rate limit doesn't drop them.
	pending.forEach(function(q, i) {
		setTimeout(function() {
			if(self.isConnected() && self.joined) {
				self._transmitChat(q);
			} else {
				self.chatQueue.push(q);
			}
		}, i * self.chatSendSpacingMs);
	});
};

Client.prototype.bindEventListeners = function() {
	var self = this;
	this.on("hi", function(msg) {
		self.user = msg.u;
		self.receiveServerTime(msg.t, msg.e || undefined);
		// After a reconnect some servers (e.g. the Harmony backup) hand out a
		// fresh identity; restore the name/color the user picked this session.
		var want = self.lastUserSet;
		if(want && msg.u && ((want.name && want.name !== msg.u.name) || (want.color && want.color !== msg.u.color))) {
			self.sendArray([{m: "userset", set: want}]);
		}
		if(self.desiredChannelId) {
			self.setChannel();
		}
	});
	this.on("t", function(msg) {
		self.receiveServerTime(msg.t, msg.e || undefined);
		// The server answers in order: if it has answered a ping we sent well
		// after a chat message but never echoed that message, it dropped it
		// (e.g. chat rate limit). Retry a couple of times, then report failure.
		if(msg.e && self.chatInFlight.length) {
			var dropped = [];
			self.chatInFlight = self.chatInFlight.filter(function(item) {
				if(item.sentAt + 3000 < msg.e) { dropped.push(item); return false; }
				return true;
			});
			dropped.forEach(function(item) {
				if(item.tries < self.chatMaxTries) {
					self.chatQueue.push(item);
				} else {
					self._failChat(item);
				}
			});
			if(dropped.length && self.joined) {
				clearTimeout(self._flushTimer);
				self._flushTimer = setTimeout(function() { self._flushChatQueue(); }, 2000);
			}
		}
	});
	this.on("a", function(msg) {
		// Our own message came back: it's delivered.
		if(!self.chatInFlight.length || !self._isOwnChat(msg, false)) return;
		var text = msg.a != null ? msg.a : msg.message;
		for(var i = 0; i < self.chatInFlight.length; i++) {
			if(self.chatInFlight[i].message === text) {
				var item = self.chatInFlight.splice(i, 1)[0];
				self._deliverChat(item);
				return;
			}
		}
	});
	this.on("c", function(msg) {
		// Room chat history (sent on join). Anything we were about to re-send
		// that is already in it did arrive before the old connection died.
		var hist = (msg && msg.c) || [];
		if(self.chatQueue.length && hist.length) {
			self.chatQueue = self.chatQueue.filter(function(item) {
				if(!item.resent) return true;
				for(var i = 0; i < hist.length; i++) {
					var h = hist[i];
					var text = h.a != null ? h.a : h.message;
					if(text !== item.message || !self._isOwnChat(h, true)) continue;
					if(h.t && (h.t - self.serverTimeOffset) < item.time - 30000) continue;
					self._deliverChat(item);
					return false;
				}
				return true;
			});
		}
		if(self.joined) self._flushChatQueue();
	});
	this.on("ch", function(msg) {
		var firstJoin = !self.joined;
		self.joined = true;
		clearTimeout(self.joinTimer);
		self.desiredChannelId = msg.ch._id;
		self.desiredChannelSettings = msg.ch.settings;
		self.channel = msg.ch;
		if(msg.p) self.participantId = msg.p;
		self.emit("room participants sync", msg.ppl || []);
		self.setParticipants(msg.ppl || []);
		if(firstJoin && self.chatQueue.length) {
			// Give the server a moment to send chat history ("c") so re-sent
			// messages can be de-duplicated; fresh ones go right away.
			var anyResent = self.chatQueue.some(function(q) { return q.resent; });
			clearTimeout(self._flushTimer);
			self._flushTimer = setTimeout(function() { self._flushChatQueue(); }, anyResent ? 2000 : 0);
		}
	});
	this.on("p", function(msg) {
		var part = self.ppl[msg.id];
		var oldName = part ? part.name : null;
		self.participantUpdate(msg);
		var updated = self.findParticipantById(msg.id);
		if(part && msg.name && oldName !== msg.name) {
			self.emit("participant renamed", {
				part: updated,
				oldName: oldName,
				newName: msg.name
			});
		}
		self.emit("participant update", updated);
	});
	this.on("m", function(msg) {
		if(self.ppl.hasOwnProperty(msg.id)) {
			self.participantUpdate(msg);
		}
	});
	this.on("bye", function(msg) {
		self.removeParticipant(msg.p);
	});
};

Client.prototype.send = function(raw) {
	if(!this.isConnected()) return false;
	try {
		this.ws.send(raw);
		return true;
	} catch(e) {
		return false;
	}
};

Client.prototype.sendArray = function(arr) {
	// Cursor moves are only useful when fresh. On a slow upload, skip them while
	// the socket's send buffer is backed up so notes and chat go out first.
	if(Array.isArray(arr) && arr.length === 1 && arr[0] && arr[0].m === "m"
		&& this.ws && this.ws.bufferedAmount > this.maxBufferedForCursor) {
		return;
	}
	if(Array.isArray(arr)) {
		for(var i = 0; i < arr.length; i++) {
			var msg = arr[i];
			if(msg && msg.m === "userset" && msg.set && typeof msg.set === "object") {
				if(!this.lastUserSet) this.lastUserSet = {};
				mixin(this.lastUserSet, msg.set);
			}
			if(msg && msg.m === "kickban") {
				var part = this.findParticipantByUnderscoreId(msg._id);
				if(part) {
					var check = this.canKickBanParticipant(part);
					if(!check.allowed) {
						this.emit("kickban blocked", { name: part.name, reason: check.reason });
						return;
					}
				}
			}
		}
	}
	this.send(JSON.stringify(arr));
};

// Broadcast a room-sync payload to everyone in the channel via the Harmony
// relay only. Never falls back to MPP chat — those messages (BF|, RM|, SI|, …)
// are machine sync and would show up as spam for vanilla multiplayerpiano.com
// users who don't filter them. Features simply pause sync until the relay is up.
Client.prototype.broadcastRoom = function(text) {
	if(typeof text !== "string") return false;
	if(this.roomSync && this.roomSync.isConnected() && this.roomSync.broadcast(text)) {
		return true;
	}
	return false;
};

Client.prototype.setChannel = function(id, set) {
	this.desiredChannelId = id || this.desiredChannelId || "lobby";
	this.desiredChannelSettings = set || this.desiredChannelSettings || undefined;
	this.sendArray([{m: "ch", _id: this.desiredChannelId, set: this.desiredChannelSettings}]);
};

Client.prototype.offlineChannelSettings = {
	color:"#ecfaed"
};

Client.prototype.getChannelSetting = function(key) {
	if(!this.isConnected() || !this.channel || !this.channel.settings) {
		return this.offlineChannelSettings[key];
	} 
	return this.channel.settings[key];
};

Client.prototype.setChannelSettings = function(settings) {
	if(!this.isConnected() || !this.channel) {
		return;
	}
	if(!this.channel.settings) {
		this.channel.settings = {};
	}
	if(!this.desiredChannelSettings) {
		this.desiredChannelSettings = {};
		for(var k in this.channel.settings) {
			if(this.channel.settings.hasOwnProperty(k)) {
				this.desiredChannelSettings[k] = this.channel.settings[k];
			}
		}
	}
	for(var key in settings) {
		if(settings.hasOwnProperty(key)) {
			this.desiredChannelSettings[key] = settings[key];
			this.channel.settings[key] = settings[key];
		}
	}
	if(!this.hasCrown()) {
		return false;
	}
	this.sendArray([{m: "chset", set: this.desiredChannelSettings}]);
	return true;
};

Client.prototype.offlineParticipant = {
	_id: "",
	name: "",
	color: "#777"
};

Client.prototype.getOwnParticipant = function() {
	return this.findParticipantById(this.participantId);
};

Client.LOBBY_NOOB_ID = "harmony-lobby-noob";
Client.LOBBY_NOOB = {
	id: Client.LOBBY_NOOB_ID,
	_id: "harmony-noob-xx",
	name: "Noob x_x",
	color: "#808080",
	x: 50,
	y: 50
};

Client.MYBOT_ANONYMOUS_ID = "harmony-mybot-anon";
Client.MYBOT_ANONYMOUS = {
	id: Client.MYBOT_ANONYMOUS_ID,
	_id: "harmony-anon-xx",
	name: "Anonymous",
	color: "#6b7280",
	x: 50,
	y: 50
};

Client.prototype.isLobbyChannel = function() {
	var id = (this.channel && this.channel._id) || this.desiredChannelId || "";
	if(id === "lobby") return true;
	return /^lobby\d+$/.test(id);
};

Client.prototype.isMybotChannel = function() {
	var id = (this.channel && this.channel._id) || this.desiredChannelId || "";
	return id === "mybot";
};

Client.prototype.isOnBackupServer = function() {
	return this.serverIndex > 0;
};

Client.isLobbyNoobParticipant = function(part) {
	return !!(part && (part.id === Client.LOBBY_NOOB_ID || part._id === Client.LOBBY_NOOB._id));
};

Client.isMybotAnonymousParticipant = function(part) {
	return !!(part && (part.id === Client.MYBOT_ANONYMOUS_ID || part._id === Client.MYBOT_ANONYMOUS._id));
};

// Global show/hide switch for the lobby ghost, exposed via the #manage panel
// (see script.js). This is NOT per-browser state: relay-server.js holds the
// authoritative flag and pushes it to every connected client (see "manage-noob"
// in roomSync.js), so toggling it changes what everyone sees, not just the
// browser that flipped the switch. Client._lobbyNoobHidden only mirrors the
// last value the server told us; never set it directly — request a change
// with RoomSync#setLobbyNoobHidden and wait for the server's broadcast.
// Starts false (shown) until the relay sends the first manage-noob on connect.
Client._lobbyNoobHidden = false;
Client._lobbyNoobSynced = false;
Client._lobbyNoobHiddenListeners = [];

Client.isLobbyNoobHidden = function() {
	return !!Client._lobbyNoobHidden;
};

Client.isLobbyNoobSynced = function() {
	return !!Client._lobbyNoobSynced;
};

Client.applyLobbyNoobHidden = function(hidden) {
	hidden = !!hidden;
	Client._lobbyNoobSynced = true;
	Client._lobbyNoobHidden = hidden;
	Client._lobbyNoobHiddenListeners.forEach(function(fn) {
		try { fn(hidden); } catch(e) {}
	});
};

Client.onLobbyNoobHiddenChange = function(fn) {
	if(typeof fn === "function") Client._lobbyNoobHiddenListeners.push(fn);
};

// Same pattern for Anonymous in the backup-server "mybot" room. Defaults to
// hidden until the relay says otherwise; never injects on the public MPP server.
Client._mybotAnonymousHidden = true;
Client._mybotAnonymousSynced = false;
Client._mybotAnonymousHiddenListeners = [];

Client.isMybotAnonymousHidden = function() {
	return !!Client._mybotAnonymousHidden;
};

Client.isMybotAnonymousSynced = function() {
	return !!Client._mybotAnonymousSynced;
};

Client.applyMybotAnonymousHidden = function(hidden) {
	hidden = !!hidden;
	Client._mybotAnonymousSynced = true;
	Client._mybotAnonymousHidden = hidden;
	Client._mybotAnonymousHiddenListeners.forEach(function(fn) {
		try { fn(hidden); } catch(e) {}
	});
};

Client.onMybotAnonymousHiddenChange = function(fn) {
	if(typeof fn === "function") Client._mybotAnonymousHiddenListeners.push(fn);
};

Client.prototype.hasNoobNamedParticipant = function() {
	for(var id in this.ppl) {
		if(this.ppl.hasOwnProperty(id) && isNoobProtectedName(this.ppl[id].name)) {
			return true;
		}
	}
	return false;
};

Client.prototype.hasMybotAnonymousParticipant = function() {
	for(var id in this.ppl) {
		if(this.ppl.hasOwnProperty(id) && Client.isMybotAnonymousParticipant(this.ppl[id])) {
			return true;
		}
	}
	return false;
};

Client.prototype.ensureLobbyNoob = function() {
	if(!this.isConnected() || !this.isLobbyChannel() || Client.isLobbyNoobHidden()) {
		this.removeLobbyNoob();
		return;
	}
	if(this.hasNoobNamedParticipant()) {
		this.removeLobbyNoob();
		return;
	}
	// Never inject a per-browser ghost without the relay — that would ignore the
	// global show/hide flag and re-add Noob after the server bot disconnects.
	var relay = this.roomSync;
	if(!relay || !relay.isConnected() || !Client.isLobbyNoobSynced()) {
		this.removeLobbyNoob();
		return;
	}
	if(!this.ppl[Client.LOBBY_NOOB_ID]) {
		this.participantUpdate(Client.LOBBY_NOOB);
	}
};

Client.prototype.removeLobbyNoob = function() {
	if(this.ppl[Client.LOBBY_NOOB_ID]) {
		this.removeParticipant(Client.LOBBY_NOOB_ID);
	}
};

Client.prototype.ensureMybotAnonymous = function() {
	// Backup server + mybot room only. Public MPP never gets this ghost.
	if(!this.isConnected() || !this.isOnBackupServer() || !this.isMybotChannel()
		|| Client.isMybotAnonymousHidden()) {
		this.removeMybotAnonymous();
		return;
	}
	if(this.hasMybotAnonymousParticipant()) {
		return;
	}
	var relay = this.roomSync;
	if(!relay || !relay.isConnected() || !Client.isMybotAnonymousSynced()) {
		this.removeMybotAnonymous();
		return;
	}
	if(!this.ppl[Client.MYBOT_ANONYMOUS_ID]) {
		this.participantUpdate(Client.MYBOT_ANONYMOUS);
	}
};

Client.prototype.removeMybotAnonymous = function() {
	if(this.ppl[Client.MYBOT_ANONYMOUS_ID]) {
		this.removeParticipant(Client.MYBOT_ANONYMOUS_ID);
	}
};

Client.prototype.setParticipants = function(ppl) {
	// remove participants who left
	for(var id in this.ppl) {
		if(!this.ppl.hasOwnProperty(id)) continue;
		if(id === Client.LOBBY_NOOB_ID && this.isLobbyChannel()) continue;
		if(id === Client.MYBOT_ANONYMOUS_ID && this.isMybotChannel() && this.isOnBackupServer()) continue;
		var found = false;
		for(var j = 0; j < ppl.length; j++) {
			if(ppl[j].id === id) {
				found = true;
				break;
			}
		}
		if(!found) {
			this.removeParticipant(id);
		}
	}
	// update all
	for(var i = 0; i < ppl.length; i++) {
		this.participantUpdate(ppl[i]);
	}
	this.ensureLobbyNoob();
	this.ensureMybotAnonymous();
};

Client.prototype.countParticipants = function() {
	var count = 0;
	for(var i in this.ppl) {
		if(this.ppl.hasOwnProperty(i)) ++count;
	}
	return count;
};

Client.prototype.participantUpdate = function(update) {
	var part = this.ppl[update.id] || null;
	if(part === null) {
		part = update;
		this.ppl[part.id] = part;
		this.emit("participant added", part);
		this.emit("count", this.countParticipants());
	} else {
		if(update.x) part.x = update.x;
		if(update.y) part.y = update.y;
		if(update.color) part.color = update.color;
		if(update.name) part.name = update.name;
	}
};

Client.prototype.removeParticipant = function(id) {
	if(this.ppl.hasOwnProperty(id)) {
		var part = this.ppl[id];
		delete this.ppl[id];
		this.emit("participant removed", part);
		this.emit("count", this.countParticipants());
	}
};

Client.prototype.findParticipantById = function(id) {
	return this.ppl[id] || this.offlineParticipant;
};

function isNoobProtectedName(name) {
	return !!(name && /noob/i.test(String(name)));
}

function noobKickbanMessage(name) {
	name = (name || "this user").trim();
	return 'Cannot kickban "' + name + '" — name is protected.';
}

Client.isNoobProtectedName = isNoobProtectedName;
Client.noobKickbanMessage = noobKickbanMessage;

Client.prototype.findParticipantByUnderscoreId = function(_id) {
	for(var id in this.ppl) {
		if(this.ppl.hasOwnProperty(id) && this.ppl[id]._id === _id) {
			return this.ppl[id];
		}
	}
	return null;
};

Client.prototype.canKickBanParticipant = function(part) {
	if(!part) return { allowed: true };
	if(isNoobProtectedName(part.name)) {
		return {
			allowed: false,
			reason: noobKickbanMessage(part.name)
		};
	}
	return { allowed: true };
};

function harmonyAdminEnabled() {
	try {
		if(typeof window !== "undefined" && window.LOCAL_ADMIN_MODE === false) return false;
		if(typeof localStorage !== "undefined") {
			if(localStorage.harmonyAdmin === "0") return false;
			if(localStorage.harmonyAdmin === "1") return true;
		}
	} catch(e) {}
	return true;
}

Client.prototype.hasCrown = function() {
	return !!(this.channel && this.channel.crown && this.participantId &&
		this.channel.crown.participantId === this.participantId);
};

Client.prototype.isOwner = function() {
	return this.hasCrown();
};

Client.prototype.isCrownClaimable = function() {
	if(!this.channel || !this.channel.crown) return false;
	var crown = this.channel.crown;
	if(!crown.participantId) return true;
	if(!this.ppl[crown.participantId]) return true;
	return false;
};

Client.prototype.claimCrown = function() {
	if(!this.isConnected() || !this.participantId) return false;
	if(this.hasCrown()) return true;
	if(!this.isCrownClaimable()) return false;
	this.sendArray([{m: "chown", id: this.participantId}]);
	return true;
};

Client.prototype.dropCrown = function() {
	if(!this.isConnected() || !this.hasCrown()) return false;
	this.sendArray([{m: "chown"}]);
	return true;
};

Client.prototype.preventsPlaying = function() {
	if(harmonyAdminEnabled()) return false;
	return this.isConnected() && !this.hasCrown() && this.getChannelSetting("crownsolo") === true;
};

Client.prototype.receiveServerTime = function(time, echo) {
	var self = this;
	var now = Date.now();
	var target = time - now;
	//console.log("Target serverTimeOffset: " + target);
	var duration = 1000;
	var step = 0;
	var steps = 50;
	var step_ms = duration / steps;
	var difference = target - this.serverTimeOffset;
	var inc = difference / steps;
	var iv;
	iv = setInterval(function() {
		self.serverTimeOffset += inc;
		if(++step >= steps) {
			clearInterval(iv);
			//console.log("serverTimeOffset reached: " + self.serverTimeOffset);
			self.serverTimeOffset=target;
		}
	}, step_ms);
	// smoothen

	//this.serverTimeOffset = time - now;			// mostly time zone offset ... also the lags so todo smoothen this
								// not smooth:
	//if(echo) this.serverTimeOffset += echo - now;	// mostly round trip time offset
};

Client.prototype.startNote = function(note, vel) {
	if(this.isConnected()) {
		var vel = typeof vel === "undefined" ? undefined : +vel.toFixed(3);
		if(!this.noteBufferTime) {
			this.noteBufferTime = Date.now();
			this.noteBuffer.push({n: note, v: vel});
		} else {
			this.noteBuffer.push({d: Date.now() - this.noteBufferTime, n: note, v: vel});
		}
	}
};

Client.prototype.stopNote = function(note) {
	if(this.isConnected()) {
		if(!this.noteBufferTime) {
			this.noteBufferTime = Date.now();
			this.noteBuffer.push({n: note, s: 1});
		} else {
			this.noteBuffer.push({d: Date.now() - this.noteBufferTime, n: note, s: 1});
		}
	}
};
