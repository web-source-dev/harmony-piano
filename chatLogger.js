/**
 * Silent room chat logging → server files via POST (chat-save-server.py).
 * No UI, no prompts, no client-side indicators.
 */
(function (global) {
	"use strict";

	var API_PATH = "/api/e";
	var MAX_QUEUE = 500;
	var PROBE_INTERVAL_MS = 60000;
	var BACKOFF_MS = 120000;
	var MAX_FAILS = 3;

	var state = {
		room: null,
		dateKey: null,
		useApi: null,
		enabled: true,
		queue: [],
		draining: false,
		failCount: 0,
		pausedUntil: 0,
		probeTimer: null
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

	function canUseApi() {
		return state.useApi === true && Date.now() >= state.pausedUntil;
	}

	function pauseApi() {
		state.useApi = false;
		state.pausedUntil = Date.now() + BACKOFF_MS;
		state.failCount = 0;
	}

	function noteFailure() {
		state.failCount++;
		if (state.failCount >= MAX_FAILS) pauseApi();
	}

	function noteSuccess() {
		state.failCount = 0;
	}

	function probeApi() {
		if (Date.now() < state.pausedUntil) return Promise.resolve(false);
		return fetch(API_PATH, { method: "OPTIONS", cache: "no-store" })
			.then(function (r) { return r.ok || r.status === 204 || r.status === 405; })
			.catch(function () { return false; });
	}

	function postLine(line) {
		if (!state.room) return Promise.resolve(false);
		return fetch(API_PATH, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: payload(line),
			cache: "no-store"
		}).then(function (r) {
			if (r.ok) return true;
			if (r.status >= 500 || r.status === 429) noteFailure();
			return false;
		}).catch(function () {
			noteFailure();
			return false;
		});
	}

	function enqueue(line) {
		if (state.queue.length >= MAX_QUEUE) state.queue.shift();
		state.queue.push(line);
	}

	function drainQueue() {
		if (state.draining || !canUseApi() || !state.queue.length || !state.room) {
			return Promise.resolve();
		}
		state.draining = true;
		var line = state.queue[0];
		return postLine(line).then(function (ok) {
			state.draining = false;
			if (ok) {
				state.queue.shift();
				noteSuccess();
				if (state.queue.length) return drainQueue();
				return;
			}
			pauseApi();
		}).catch(function () {
			state.draining = false;
			pauseApi();
		});
	}

	function writeLine(line) {
		if (!state.enabled || !state.room) return;
		enqueue(line);
		if (canUseApi()) {
			drainQueue();
			return;
		}
		if (state.useApi === null) {
			probeApi().then(function (ok) {
				state.useApi = !!ok;
				if (ok) drainQueue();
			});
		}
	}

	function scheduleProbe() {
		if (state.probeTimer) return;
		state.probeTimer = setInterval(function () {
			if (canUseApi()) {
				if (state.queue.length) drainQueue();
				return;
			}
			if (Date.now() < state.pausedUntil) return;
			probeApi().then(function (ok) {
				if (ok) {
					state.useApi = true;
					state.pausedUntil = 0;
					drainQueue();
				}
			});
		}, PROBE_INTERVAL_MS);
	}

	var ChatLogger = {
		init: function () {
			probeApi().then(function (ok) {
				state.useApi = !!ok;
				if (ok) drainQueue();
			});
			scheduleProbe();
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
