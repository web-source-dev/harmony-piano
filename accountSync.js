/**
 * User accounts: the same person (name, colour and settings) on every device,
 * on the piano AND in the World.
 *
 * A user's settings live in localStorage (name, colour, volume, mutes, sound,
 * rooms, World avatar…). After they log in, the copy saved on the server is
 * loaded BEFORE the app starts, then changes are saved back every few seconds.
 *
 *   HarmonyAccount.boot()        -> Promise<user|null>  (GET /api/auth, then restore + sync)
 *   HarmonyAccount.restore(user) -> Promise             (after a password login)
 *   HarmonyAccount.onRename(fn)  -> fn(user) when the name changed on another device or /manage
 *   window.harmonyAccountSync()  -> save now (the piano calls it after a rename)
 */
(function (global) {
	"use strict";

	var SYNC_SKIP = { harmonyServerIndex: 1, harmonyAccountId: 1 };   // per-device only
	var SYNC_VALUE_MAX = 256 * 1024;
	var syncUser = null, syncLast = "", syncTimer = null, soonTimer = null, checkBusy = false;
	// What this device and the server last agreed the name/colour is. A rename
	// made HERE is sent explicitly; one made elsewhere is applied here.
	var knownName = "", knownColor = "";
	var renameListeners = [];

	function lsSnapshot() {
		var out = {};
		try {
			for (var i = 0; i < localStorage.length; i++) {
				var k = localStorage.key(i);
				if (!k || SYNC_SKIP[k]) continue;
				var v = localStorage.getItem(k);
				if (v != null && v.length <= SYNC_VALUE_MAX) out[k] = v;
			}
		} catch (e) {}
		return out;
	}
	function lsReset(data) {
		try {
			var keep = {};
			for (var k in SYNC_SKIP) { var v = localStorage.getItem(k); if (v != null) keep[k] = v; }
			localStorage.clear();
			for (var k2 in keep) localStorage.setItem(k2, keep[k2]);
			for (var k3 in (data || {})) localStorage.setItem(k3, String(data[k3]));
		} catch (e) {}
	}

	function restore(user) {
		return fetch("/api/me/data", { credentials: "same-origin", cache: "no-store" }).then(function (res) {
			return res.json();
		}).then(function (d) {
			var data = d && d.ok && d.data && typeof d.data === "object" ? d.data : null;
			var prev = null;
			try { prev = localStorage.getItem("harmonyAccountId"); } catch (e) {}
			if (data) lsReset(data);                      // their saved settings, from any device
			else if (prev && prev !== user.id) lsReset(); // someone else used this browser: start clean
			// (first login on the browser they already used: keep what's here and upload it)
			try {
				localStorage.setItem("harmonyAccountId", user.id);
				// The account name/colour is who they are, on every device.
				if (user.name) localStorage.setItem("harmonyName", user.name);
				if (user.color) localStorage.setItem("harmonyColor", user.color);
			} catch (e) {}
			startSync(user, !!data);
		}).catch(function () { startSync(user, false); });
	}

	function boot() {
		return fetch("/api/auth", { credentials: "same-origin", cache: "no-store" }).then(function (res) {
			return res.json();
		}).then(function (d) {
			if (!d || !d.authed || !d.user) return null;
			return restore(d.user).then(function () { return d.user; });
		}).catch(function () { return null; });
	}

	function localProfile() {
		var p = { name: "", color: "" };
		try { p.name = localStorage.getItem("harmonyName") || ""; p.color = localStorage.getItem("harmonyColor") || ""; } catch (e) {}
		return p;
	}
	function pendingRename() {
		var p = localProfile(), r = null;
		if (p.name && p.name !== knownName) (r = r || {}).name = p.name;
		if (p.color && p.color !== knownColor) (r = r || {}).color = p.color;
		return r;
	}
	function onServerUser(u) {
		if (!u || !syncUser) return;
		var p = localProfile();
		knownName = u.name || "";
		knownColor = u.color || "";
		syncUser.name = u.name;
		syncUser.color = u.color;
		if (p.name === knownName && (!knownColor || p.color === knownColor)) return;
		// Renamed somewhere else: become that name here too.
		try {
			localStorage.setItem("harmonyName", knownName);
			if (knownColor) localStorage.setItem("harmonyColor", knownColor);
		} catch (e) {}
		// The piano: tell the room.
		var set = { name: knownName };
		if (knownColor) set.color = knownColor;
		try { if (global.gClient && global.gClient.sendArray) global.gClient.sendArray([{ m: "userset", set: set }]); } catch (e) {}
		try { if (knownColor && global.gNameColor && global.gNameColor.setMyColor) global.gNameColor.setMyColor(knownColor); } catch (e) {}
		// The World (or anyone else listening).
		renameListeners.forEach(function (fn) { try { fn(syncUser); } catch (e) {} });
	}
	function signedOut(res) {
		// Account deleted/disabled or password changed: back to the login screen.
		if (res.status !== 401) return false;
		stopSync();
		location.reload();
		return true;
	}

	function pushData(beacon) {
		if (!syncUser) return;
		var rename = pendingRename();
		var body = { data: lsSnapshot() };
		var dataJson = JSON.stringify(body);
		if (dataJson === syncLast && !rename) {
			// Nothing new here: just check whether the name changed elsewhere.
			if (beacon || checkBusy) return;
			checkBusy = true;
			fetch("/api/auth", { credentials: "same-origin", cache: "no-store" }).then(function (res) {
				if (signedOut(res)) return;
				return res.json().then(function (d) { if (d && d.user) onServerUser(d.user); else if (d && !d.authed) signedOut({ status: 401 }); });
			}).catch(function () {}).then(function () { checkBusy = false; });
			return;
		}
		syncLast = dataJson;
		if (rename) body.rename = rename;
		var json = JSON.stringify(body);
		if (beacon && navigator.sendBeacon) {
			try { if (navigator.sendBeacon("/api/me/data", new Blob([json], { type: "application/json" }))) return; } catch (e) {}
		}
		fetch("/api/me/data", {
			method: "POST", credentials: "same-origin", cache: "no-store", keepalive: json.length < 60000,
			headers: { "Content-Type": "application/json" }, body: json
		}).then(function (res) {
			if (signedOut(res)) return;
			if (!res.ok) { syncLast = ""; return; }
			return res.json().then(function (d) { if (d && d.user) onServerUser(d.user); });
		}).catch(function () { syncLast = ""; });
	}

	function startSync(user, justLoaded) {
		if (syncUser) return;
		syncUser = user;
		api.user = user;
		knownName = user.name || "";
		knownColor = user.color || "";
		syncLast = justLoaded ? JSON.stringify({ data: lsSnapshot() }) : "";
		pushData();
		syncTimer = setInterval(pushData, 10000);
		document.addEventListener("visibilitychange", function () {
			if (document.visibilityState === "hidden") pushData(true);
			else pushData();   // back on this tab: pick up changes made elsewhere right away
		});
		global.addEventListener("pagehide", function () { pushData(true); });
	}
	function stopSync() { clearInterval(syncTimer); syncUser = null; api.user = null; }

	// Save soon (e.g. right after the person renamed themselves).
	function syncSoon() {
		clearTimeout(soonTimer);
		soonTimer = setTimeout(function () { pushData(); }, 300);
	}

	var api = {
		user: null,
		boot: boot,
		restore: restore,
		syncSoon: syncSoon,
		onRename: function (fn) { renameListeners.push(fn); }
	};
	global.HarmonyAccount = api;
	global.harmonyAccountSync = syncSoon;
})(typeof window !== "undefined" ? window : this);
