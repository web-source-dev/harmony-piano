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
	var SEEN_MAX = 3000;
	var SEEN_KEY_PREFIX = "harmony_chatlog_seen:";

	// ── Edit your Harmony mirror host(s) here ──
	var HARMONY_MIRROR_HOSTS = [
		"piano.harmony4all.org",
		"localhost",
		"127.0.0.1"
	];
	var OFFICIAL_MPP_HOSTS = [
		"multiplayerpiano.com",
		"www.multiplayerpiano.com"
	];

	var state = {
		room: null,
		dateKey: null,
		useApi: null,
		enabled: true,
		queue: [],
		draining: false,
		failCount: 0,
		pausedUntil: 0,
		probeTimer: null,
		liveRooms: {}
	};

	function messageFingerprint(room, participantId, userName, messageText) {
		return (room || "") + "\x1e" + (participantId || userName || "?") + "\x1e" + (messageText || "");
	}

	function seenStorageKey(room) {
		return SEEN_KEY_PREFIX + sanitizeRoom(room) + "_" + todayKey();
	}

	function loadSeenFingerprints(room) {
		try {
			var raw = global.sessionStorage && sessionStorage.getItem(seenStorageKey(room));
			if (!raw) return {};
			var arr = JSON.parse(raw);
			if (!Array.isArray(arr)) return {};
			var set = {};
			for (var i = 0; i < arr.length; i++) set[arr[i]] = true;
			return set;
		} catch (e) {
			return {};
		}
	}

	function markFingerprintSeen(room, fp) {
		if (!fp || !room) return;
		try {
			if (!global.sessionStorage) return;
			var set = loadSeenFingerprints(room);
			set[fp] = true;
			var keys = Object.keys(set);
			if (keys.length > SEEN_MAX) {
				keys = keys.slice(keys.length - SEEN_MAX);
				var trimmed = {};
				for (var i = 0; i < keys.length; i++) trimmed[keys[i]] = true;
				set = trimmed;
			}
			sessionStorage.setItem(seenStorageKey(room), JSON.stringify(Object.keys(set)));
		} catch (e) {}
	}

	function isFingerprintSeen(room, fp) {
		if (!fp || !room) return false;
		var set = loadSeenFingerprints(room);
		return !!set[fp];
	}

	function markRoomLive(room) {
		if (room) state.liveRooms[room] = true;
	}

	function roomHasLiveChat(room) {
		return !!(room && state.liveRooms[room]);
	}

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

	function chatFileName(room) {
		return sanitizeRoom(room) + "_" + todayKey() + ".txt";
	}

	function joinsFileName(room) {
		return sanitizeRoom(room) + "_" + todayKey() + "_joins.txt";
	}

	function promptsFileName(room) {
		return sanitizeRoom(room) + "_" + todayKey() + "_prompts.txt";
	}

	function hostMatches(host, patterns) {
		host = (host || "").toLowerCase();
		for (var i = 0; i < patterns.length; i++) {
			var p = (patterns[i] || "").toLowerCase();
			if (!p) continue;
			if (host === p) return true;
			var suffix = "." + p;
			if (host.length > suffix.length && host.slice(-suffix.length) === suffix) return true;
		}
		return false;
	}

	function getSiteOrigin() {
		var host = "unknown";
		var href = "";
		try {
			if (global.location) {
				host = (global.location.hostname || "unknown").toLowerCase();
				href = global.location.origin || global.location.href || "";
			}
		} catch (e) {}
		if (!host) host = "unknown";

		var isHarmony = hostMatches(host, HARMONY_MIRROR_HOSTS);
		var isOfficial = hostMatches(host, OFFICIAL_MPP_HOSTS);
		var label;
		if (isHarmony) {
			label = host + " [HARMONY MIRROR ★]";
		} else if (isOfficial) {
			label = host + " [official MPP]";
		} else {
			label = host + " [other site]";
		}
		return {
			host: host,
			href: href,
			label: label,
			isHarmony: isHarmony,
			isOfficial: isOfficial
		};
	}

	function joinDomainSuffix() {
		var site = getSiteOrigin();
		return " via " + site.label;
	}

	function ensureRoomSilent() {
		if (state.room) return state.room;
		var ch = global.MPP && global.MPP.client && global.MPP.client.channel;
		state.room = (ch && ch._id) ? ch._id : "lobby";
		state.dateKey = todayKey();
		return state.room;
	}

	function payload(line, targetFile) {
		return JSON.stringify({
			room: state.room,
			date: todayKey(),
			line: line,
			file: targetFile || chatFileName(state.room)
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

	function postLine(item) {
		if (!state.room || !item) return Promise.resolve(false);
		return fetch(API_PATH, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: payload(item.line, item.file),
			cache: "no-store"
		}).then(function (r) {
			if (!r.ok) {
				if (r.status >= 500 || r.status === 429) noteFailure();
				return false;
			}
			return r.json().then(function (data) {
				return !!(data && data.ok);
			}).catch(function () {
				return true;
			});
		}).catch(function () {
			noteFailure();
			return false;
		});
	}

	function enqueue(line, targetFile) {
		if (state.queue.length >= MAX_QUEUE) state.queue.shift();
		state.queue.push({ line: line, file: targetFile });
	}

	function drainQueue() {
		if (state.draining || !canUseApi() || !state.queue.length || !state.room) {
			return Promise.resolve();
		}
		state.draining = true;
		var item = state.queue[0];
		return postLine(item).then(function (ok) {
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

	function writeChatLine(line) {
		if (!state.enabled) return;
		ensureRoomSilent();
		enqueue(line, chatFileName(state.room));
		drainIfReady();
	}

	function writeJoinLine(line) {
		if (!state.enabled) return;
		ensureRoomSilent();
		enqueue(line, joinsFileName(state.room));
		drainIfReady();
	}

	function writePromptLine(line) {
		if (!state.enabled) return Promise.resolve(false);
		ensureRoomSilent();
		var file = promptsFileName(state.room);
		var item = { line: line, file: file };

		function attempt() {
			return postLine(item).then(function (ok) {
				if (ok) {
					noteSuccess();
					return true;
				}
				enqueue(line, file);
				drainIfReady();
				return false;
			});
		}

		if (canUseApi()) {
			return attempt();
		}
		return probeApi().then(function (ok) {
			if (!ok) {
				enqueue(line, file);
				drainIfReady();
				return false;
			}
			state.useApi = true;
			state.pausedUntil = 0;
			return attempt();
		});
	}

	function drainIfReady() {
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
				var hdrKey = "harmony_chatlog_roomhdr:" + sanitizeRoom(roomName) + "_" + todayKey();
				var alreadyStarted = false;
				try {
					alreadyStarted = !!(global.sessionStorage && sessionStorage.getItem(hdrKey));
				} catch (e) {}
				if (!alreadyStarted) {
					writeJoinLine(
						"\n--- room \"" + roomName + "\" log started at " + timeStamp() +
						joinDomainSuffix() + " ---\n"
					);
					try {
						if (global.sessionStorage) sessionStorage.setItem(hdrKey, "1");
					} catch (e) {}
				}
			}
		},

		getSiteOrigin: getSiteOrigin,

		logMessage: function (userName, messageText, opts) {
			if (!state.enabled || !messageText) return;
			opts = opts || {};
			if (state.dateKey && state.dateKey !== todayKey()) {
				state.dateKey = todayKey();
			}
			if (!state.room) {
				var ch = global.MPP && global.MPP.client && global.MPP.client.channel;
				if (ch) this.setRoom(ch._id);
			}
			if (!state.room) return;

			var fromHistory = !!opts.fromHistory;
			if (fromHistory && !roomHasLiveChat(state.room)) {
				return;
			}
			if (!fromHistory) {
				markRoomLive(state.room);
			}

			var fp = messageFingerprint(
				state.room,
				opts.participantId,
				userName,
				messageText
			);
			if (isFingerprintSeen(state.room, fp)) return;
			markFingerprintSeen(state.room, fp);

			writeChatLine("[" + timeStamp() + "] " + (userName || "?") + ": " + messageText + "\n");
		},

		logJoin: function (userName) {
			if (!state.enabled) return;
			ensureRoomSilent();
			var joinKey = "harmony_chatlog_selfjoin:" + sanitizeRoom(state.room) + "_" + todayKey() + ":" + (userName || "?");
			try {
				if (global.sessionStorage && sessionStorage.getItem(joinKey)) return;
			} catch (e) {}
			var site = getSiteOrigin();
			var prefix = site.isHarmony ? "*** HARMONY *** " : "";
			writeJoinLine(
				"[" + timeStamp() + "] " + prefix + (userName || "?") +
				" joined" + joinDomainSuffix() + "\n"
			);
			try {
				if (global.sessionStorage) sessionStorage.setItem(joinKey, "1");
			} catch (e) {}
		},

		logRename: function (oldName, newName) {
			if (!state.enabled) return;
			ensureRoomSilent();
			var site = getSiteOrigin();
			var prefix = site.isHarmony ? "*** HARMONY *** " : "";
			writeJoinLine(
				"[" + timeStamp() + "] " + prefix + (oldName || "?") +
				" changed name to " + (newName || "?") + joinDomainSuffix() + "\n"
			);
		},

		logCornerPrompt: function (userName, answer) {
			if (!state.enabled || !answer) return Promise.resolve(false);
			if (arguments.length >= 3 && typeof arguments[1] === "string" && typeof arguments[2] === "string") {
				answer = arguments[2];
			}
			ensureRoomSilent();
			var msg = String(answer).replace(/\r?\n/g, " ").trim();
			return writePromptLine(
				"[" + timeStamp() + "] " + (userName || "?") +
				" sent reply: " + msg + "\n"
			);
		}
	};

	global.ChatLogger = ChatLogger;
})(typeof window !== "undefined" ? window : this);
