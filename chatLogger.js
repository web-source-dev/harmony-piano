/**
 * Silent room chat logging → server files via POST (chat-save-server.py).
 * No UI, no prompts, no client-side indicators.
 */
(function (global) {
	"use strict";

	var API_PATH = "/api/e";
	var MAX_QUEUE = 2000;

	var state = {
		room: null,
		dateKey: null,
		useApi: null,
		enabled: true,
		queue: []
	};

	function todayKey() {
		var d = new Date();
		var m = d.getMonth() + 1;
		var day = d.getDate();
		return d.getFullYear() + "-" + (m < 10 ? "0" : "") + m + "-" + (day < 10 ? "0" : "") + day;
	}

	function timeStamp() {
		var d = new Date();
		function pad(n) { return n < 10 ? "0" + n : "" + n; }
		return todayKey() + " " + pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds());
	}

	function sanitizeRoom(name) {
		return (name || "room")
			.replace(/[\\/:*?"<>|]/g, "_")
			.replace(/\s+/g, "_")
			.replace(/_+/g, "_")
			.slice(0, 80) || "room";
	}

	function fileName(room) {
		return sanitizeRoom(room) + "_" + todayKey() + ".txt";
	}

	function payload(line) {
		return JSON.stringify({
			room: state.room,
			date: todayKey(),
			line: line,
			file: fileName(state.room)
		});
	}

	function probeApi() {
		return fetch(API_PATH, { method: "OPTIONS", cache: "no-store" })
			.then(function (r) { return r.ok || r.status === 204 || r.status === 405; })
			.catch(function () { return false; });
	}

	function postLine(line) {
		if (!state.room) return Promise.resolve(false);
		var body = payload(line);
		if (global.navigator && navigator.sendBeacon) {
			try {
				var blob = new Blob([body], { type: "application/json" });
				if (navigator.sendBeacon(API_PATH, blob)) return Promise.resolve(true);
			} catch (e) {}
		}
		return fetch(API_PATH, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: body,
			cache: "no-store",
			keepalive: true
		}).then(function (r) { return r.ok; })
			.catch(function () { return false; });
	}

	function enqueue(line) {
		if (state.queue.length >= MAX_QUEUE) state.queue.shift();
		state.queue.push(line);
	}

	function flushQueue() {
		if (!state.queue.length || state.useApi !== true) return Promise.resolve();
		var batch = state.queue.slice();
		state.queue = [];
		return batch.reduce(function (p, line) {
			return p.then(function () {
				return postLine(line).then(function (ok) {
					if (!ok) enqueue(line);
				});
			});
		}, Promise.resolve());
	}

	function writeLine(line) {
		if (!state.enabled || !state.room) return;
		if (state.useApi === true) {
			postLine(line).then(function (ok) {
				if (!ok) enqueue(line);
			});
			return;
		}
		enqueue(line);
		if (state.useApi === null) {
			probeApi().then(function (ok) {
				state.useApi = !!ok;
				if (ok) flushQueue();
			});
		}
	}

	var ChatLogger = {
		init: function () {
			probeApi().then(function (ok) {
				state.useApi = !!ok;
				if (ok) flushQueue();
			});
			setInterval(function () {
				if (state.useApi !== true) {
					probeApi().then(function (ok) {
						if (ok) {
							state.useApi = true;
							flushQueue();
						}
					});
				} else if (state.queue.length) {
					flushQueue();
				}
			}, 15000);
			return Promise.resolve();
		},

		setRoom: function (roomName) {
			if (!roomName) return;
			var changed = state.room !== roomName;
			state.room = roomName;
			state.dateKey = todayKey();
			if (changed) {
				writeLine("\n--- joined room \"" + roomName + "\" at " + timeStamp() + " ---\n");
			}
		},

		logMessage: function (userName, messageText) {
			if (!state.enabled || !messageText) return;
			if (state.dateKey && state.dateKey !== todayKey()) {
				state.dateKey = todayKey();
			}
			if (!state.room) {
				var ch = global.MPP && global.MPP.client && global.MPP.client.channel;
				if (ch) this.setRoom(ch._id);
			}
			writeLine("[" + timeStamp() + "] " + (userName || "?") + ": " + messageText + "\n");
		}
	};

	global.ChatLogger = ChatLogger;
})(typeof window !== "undefined" ? window : this);
