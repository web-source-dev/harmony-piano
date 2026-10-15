/**
 * Silent room chat logging → the server's chat database (POST /api/e).
 * No UI, no prompts, no client-side indicators.
 *
 * Every tab in a room reports what it sees; the server stores each line ONCE.
 * Chat lines carry the chat server's own timestamp `t` (identical for every
 * visitor), which is both the line's real time and its duplicate key — so a
 * newcomer's browser replaying the room history never rewrites old lines with
 * new times. Joins/renames/prompts are timed by the server's clock, never ours.
 */
(function (global) {
	"use strict";

	var API_PATH = "/api/e";
	var MAX_QUEUE = 500;
	var PROBE_INTERVAL_MS = 60000;
	var BACKOFF_MS = 120000;
	var MAX_FAILS = 3;
	var SEEN_MAX = 3000;
	var SEEN_KEY = "harmony_chatlog_seen2";

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
		useApi: null,
		enabled: true,
		queue: [],
		draining: false,
		failCount: 0,
		pausedUntil: 0,
		probeTimer: null
	};

	// Lines this tab already sent (saves requests; the server dedups anyway).
	var seen = (function () {
		try {
			var arr = JSON.parse((global.sessionStorage && sessionStorage.getItem(SEEN_KEY)) || "[]");
			return Array.isArray(arr) ? arr : [];
		} catch (e) { return []; }
	})();
	var seenSet = {};
	seen.forEach(function (k) { seenSet[k] = true; });
	function markSeen(key) {
		if (seenSet[key]) return false;
		seenSet[key] = true;
		seen.push(key);
		if (seen.length > SEEN_MAX) delete seenSet[seen.shift()];
		try { if (global.sessionStorage) sessionStorage.setItem(SEEN_KEY, JSON.stringify(seen)); } catch (e) {}
		return true;
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

	function client() { return global.MPP && global.MPP.client; }
	function currentServer() {
		var c = client();
		try { return c && c.isOnBackupServer && c.isOnBackupServer() ? "backup" : "mpp"; } catch (e) { return "mpp"; }
	}
	function myUid() {
		var c = client();
		try {
			var me = c && c.getOwnParticipant && c.getOwnParticipant();
			return (me && me._id) || "";
		} catch (e) { return ""; }
	}

	function ensureRoomSilent() {
		if (state.room) return state.room;
		var ch = client() && client().channel;
		state.room = (ch && ch._id) ? ch._id : "lobby";
		return state.room;
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

	function probeApi() {
		if (Date.now() < state.pausedUntil) return Promise.resolve(false);
		return fetch(API_PATH, { method: "OPTIONS", cache: "no-store" })
			.then(function (r) { return r.ok || r.status === 204 || r.status === 405; })
			.catch(function () { return false; });
	}

	function postEvent(ev) {
		return fetch(API_PATH, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(ev),
			cache: "no-store"
		}).then(function (r) {
			if (!r.ok) {
				if (r.status >= 500 || r.status === 429) noteFailure();
				// 4xx (bad/empty event): drop it rather than retry forever.
				return r.status < 500 && r.status !== 429;
			}
			return true;
		}).catch(function () {
			noteFailure();
			return false;
		});
	}

	function drainQueue() {
		if (state.draining || !canUseApi() || !state.queue.length) return Promise.resolve();
		state.draining = true;
		return postEvent(state.queue[0]).then(function (ok) {
			state.draining = false;
			if (ok) {
				state.queue.shift();
				state.failCount = 0;
				if (state.queue.length) return drainQueue();
				return;
			}
			pauseApi();
		});
	}

	function drainIfReady() {
		if (canUseApi()) { drainQueue(); return; }
		if (state.useApi === null) {
			probeApi().then(function (ok) {
				state.useApi = !!ok;
				if (ok) drainQueue();
			});
		}
	}

	function send(ev) {
		if (!state.enabled) return;
		ev.v = 2;
		ev.room = ev.room || ensureRoomSilent();
		if (!ev.server) ev.server = currentServer();
		if (state.queue.length >= MAX_QUEUE) state.queue.shift();
		state.queue.push(ev);
		drainIfReady();
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
			if (roomName) state.room = roomName;
		},

		getSiteOrigin: getSiteOrigin,

		// opts: { fromHistory, participantId (the person's _id), t (chat server time), color }
		logMessage: function (userName, messageText, opts) {
			if (!state.enabled || !messageText) return;
			opts = opts || {};
			if (!state.room) {
				var ch = client() && client().channel;
				if (ch) this.setRoom(ch._id);
			}
			if (!state.room) return;
			var t = +opts.t || 0;
			// History replayed to us without a server time can't be placed in time — skip it.
			if (opts.fromHistory && !t) return;
			var uid = opts.participantId != null ? String(opts.participantId) : "";
			var key = state.room + "\x1e" + (uid || userName) + "\x1e" + (t || "") + "\x1e" + messageText;
			if (!t) key += "\x1e" + Math.floor(Date.now() / 60000);
			if (!markSeen(key)) return;
			send({ kind: "chat", name: userName || "?", uid: uid, text: String(messageText), t: t || undefined, color: opts.color || "" });
		},

		logJoin: function (userName, uid, color) {
			if (!state.enabled) return;
			ensureRoomSilent();
			var site = getSiteOrigin();
			send({ kind: "join", name: userName || "?", uid: uid || myUid(), via: site.label, harmony: site.isHarmony, color: color || "" });
		},

		logRename: function (oldName, newName, uid, color) {
			if (!state.enabled) return;
			ensureRoomSilent();
			var site = getSiteOrigin();
			send({ kind: "rename", name: oldName || "?", text: newName || "?", uid: uid || myUid(), via: site.label, harmony: site.isHarmony, color: color || "" });
		},

		logCornerPrompt: function (userName, answer) {
			if (!state.enabled || !answer) return Promise.resolve(false);
			if (arguments.length >= 3 && typeof arguments[1] === "string" && typeof arguments[2] === "string") {
				answer = arguments[2];
			}
			ensureRoomSilent();
			var msg = String(answer).replace(/\r?\n/g, " ").trim();
			if (!msg) return Promise.resolve(false);
			var ev = { v: 2, kind: "prompt", room: state.room, name: userName || "?", uid: myUid(), text: msg, server: currentServer() };
			return postEvent(ev).then(function (ok) {
				if (!ok) { state.queue.push(ev); drainIfReady(); }
				return ok;
			});
		}
	};

	global.ChatLogger = ChatLogger;
})(typeof window !== "undefined" ? window : this);
