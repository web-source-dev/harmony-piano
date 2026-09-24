/**
 * KissBlast — "Send Kiss": a big animated kiss pops up on EVERY screen in the
 * room at the same moment, with a synthesized kiss sound (see funSounds.js).
 *
 * Synced over the Harmony room relay. The sender also picks a random seed so
 * every screen draws the exact same burst / lipstick stamps / kiss rain.
 *
 * Protocol (relay text, "KS|" prefixed):
 *   KS|k|kissId|seed   -> show kiss `kissId` from the sender (msg.p)
 */
(function (global) {
	"use strict";

	var SYNC_PREFIX = "KS|";
	var SOUND_KEY = "harmonyKissSound";
	var SEND_COOLDOWN_MS = 900;
	var RECV_THROTTLE_MS = 250;
	var MAX_ACTIVE = 4;

	var KISSES = [
		{ id: "lips", emoji: "💋", label: "Big Kiss", verb: "sent a big kiss", sound: "kiss", fx: "pop", life: 2800 },
		{ id: "blow", emoji: "😘", label: "Blow a Kiss", verb: "blew a kiss", sound: "mwah", fx: "blow", life: 3000 },
		{ id: "double", emoji: "💋", label: "Double Kiss", verb: "sent a double kiss", sound: "doublekiss", fx: "double", life: 2900 },
		{ id: "kitty", emoji: "😽", label: "Kitty Kiss", verb: "sent a kitty kiss", sound: "kittykiss", fx: "pop", life: 2900 },
		{ id: "love", emoji: "💏", label: "Love Kiss", verb: "sent a love kiss", sound: "lovekiss", fx: "hearts", life: 3100 },
		{ id: "rain", emoji: "💋", label: "Kiss Shower", verb: "made it rain kisses", sound: "kissrain", fx: "rain", life: 3400 }
	];
	var KISS_BY_ID = {};
	for (var i = 0; i < KISSES.length; i++) KISS_BY_ID[KISSES[i].id] = KISSES[i];

	var BURST = ["💖", "💕", "💋", "💗", "✨", "💞", "❤️"];

	// Small seeded RNG so every client lays out the same effect.
	function rng(seed) {
		var a = (seed >>> 0) || 1;
		return function () {
			a = (a + 0x6D2B79F5) | 0;
			var t = Math.imul(a ^ (a >>> 15), 1 | a);
			t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
			return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
		};
	}

	function el(tag, cls, text) {
		var n = document.createElement(tag);
		if (cls) n.className = cls;
		if (text != null) n.textContent = text;
		return n;
	}

	function KissBlast(opts) {
		opts = opts || {};
		this.client = opts.client;
		this.openModal = opts.openModal || null;
		this.closeModal = opts.closeModal || null;
		this.layer = null;
		this.active = [];
		this.lastSentAt = 0;
		this.lastFrom = {};
		this.soundOn = true;
		try { this.soundOn = !(global.localStorage && localStorage.getItem(SOUND_KEY) === "0"); } catch (e) {}
		this._bindUi();
	}

	KissBlast.SYNC_PREFIX = SYNC_PREFIX;
	KissBlast.KISSES = KISSES;

	KissBlast.isSyncText = function (text) {
		return !!(text && typeof text === "string" && text.indexOf(SYNC_PREFIX) === 0);
	};

	// ---- UI -------------------------------------------------------------

	KissBlast.prototype._bindUi = function () {
		var self = this;
		var btn = document.getElementById("kiss-btn");
		if (btn) {
			btn.addEventListener("click", function (e) {
				e.preventDefault();
				e.stopPropagation();
				self.open();
			});
		}
		var dlg = document.getElementById("kiss-send");
		if (!dlg) return;
		this.dialog = dlg;
		this.status = dlg.querySelector(".kiss-status");

		var grid = dlg.querySelector(".kiss-grid");
		if (grid && !grid.childNodes.length) {
			KISSES.forEach(function (k) {
				var b = el("button", "kiss-option");
				b.type = "button";
				b.setAttribute("data-kiss", k.id);
				b.title = k.label + " — everyone sees it";
				var em = el("span", "kiss-option-emoji" + (k.fx === "double" ? " is-double" : ""), k.fx === "double" ? "💋💋" : k.emoji);
				em.setAttribute("aria-hidden", "true");
				b.appendChild(em);
				b.appendChild(el("span", "kiss-option-label", k.label));
				grid.appendChild(b);
			});
		}
		dlg.addEventListener("click", function (e) {
			var opt = e.target.closest && e.target.closest(".kiss-option");
			if (opt) {
				e.preventDefault();
				e.stopPropagation();
				self.send(opt.getAttribute("data-kiss"));
				return;
			}
			if (e.target.closest && e.target.closest(".kiss-close")) {
				e.preventDefault();
				e.stopPropagation();
				if (self.closeModal) self.closeModal();
			}
		});
		var toggle = dlg.querySelector(".kiss-sound-toggle");
		if (toggle) {
			toggle.checked = this.soundOn;
			toggle.addEventListener("change", function () {
				self.soundOn = !!toggle.checked;
				try { localStorage.setItem(SOUND_KEY, self.soundOn ? "1" : "0"); } catch (e) {}
			});
		}
	};

	KissBlast.prototype.open = function () {
		this._say("");
		if (this.openModal) this.openModal("#kiss-send", ".kiss-option");
	};

	KissBlast.prototype._say = function (text) {
		if (this.status) this.status.textContent = text || "";
	};

	// ---- sending / receiving --------------------------------------------

	KissBlast.prototype.send = function (kissId) {
		var def = KISS_BY_ID[kissId];
		if (!def) return false;
		var now = Date.now();
		if (now - this.lastSentAt < SEND_COOLDOWN_MS) { this._say("One sec… catching your breath 😘"); return false; }
		this.lastSentAt = now;
		var seed = Math.floor(Math.random() * 2147483647) + 1;
		var synced = !!(this.client && this.client.broadcastRoom &&
			this.client.broadcastRoom(SYNC_PREFIX + "k|" + def.id + "|" + seed));
		if (this.closeModal) this.closeModal();
		var me = this.client && this.client.getOwnParticipant && this.client.getOwnParticipant();
		this.show(def.id, seed, { self: true, name: me && me.name, color: me && me.color, offline: !synced });
		return true;
	};

	KissBlast.prototype.tryHandleChat = function (msg) {
		var text = msg.a != null ? msg.a : (msg.message != null ? msg.message : "");
		if (!KissBlast.isSyncText(text)) return false;
		var parts = text.slice(SYNC_PREFIX.length).split("|");
		if (parts[0] !== "k") return true;
		var def = KISS_BY_ID[parts[1]];
		if (!def) return true;
		// No self-echo check: the relay never echoes to the sender, and people on the
		// same network share an MPP _id, so matching on _id would drop their kisses.
		var p = msg.p || {};
		var key = String(p._id || "?");
		var now = Date.now();
		if (now - (this.lastFrom[key] || 0) < RECV_THROTTLE_MS) return true;
		this.lastFrom[key] = now;
		var seed = parseInt(parts[2], 10) || 1;
		this.show(def.id, seed, { name: p.name, color: this._colorFor(p._id) });
		return true;
	};

	KissBlast.prototype._colorFor = function (_id) {
		var ppl = this.client && this.client.ppl;
		if (!ppl || !_id) return "";
		for (var id in ppl) {
			if (ppl.hasOwnProperty(id) && ppl[id] && ppl[id]._id === _id) return ppl[id].color || "";
		}
		return "";
	};

	// ---- the big kiss ---------------------------------------------------

	KissBlast.prototype._layer = function () {
		if (this.layer && this.layer.parentNode) return this.layer;
		var layer = el("div", "kb-layer");
		layer.setAttribute("aria-live", "polite");
		document.body.appendChild(layer);
		this.layer = layer;
		return layer;
	};

	KissBlast.prototype.show = function (kissId, seed, info) {
		var def = KISS_BY_ID[kissId];
		if (!def) return;
		info = info || {};
		var rand = rng(seed);
		var layer = this._layer();

		while (this.active.length >= MAX_ACTIVE) this._remove(this.active[0]);

		var blast = el("div", "kb-blast kb-fx-" + def.fx);
		blast.appendChild(el("div", "kb-glow"));

		// Lipstick stamps scattered around the screen.
		if (def.fx === "pop" || def.fx === "double" || def.fx === "blow") {
			var stamps = 4 + Math.floor(rand() * 3);
			for (var s = 0; s < stamps; s++) {
				var st = el("span", "kb-stamp", def.id === "kitty" ? "🐾" : "💋");
				var sx = rand() < 0.5 ? 6 + rand() * 26 : 68 + rand() * 26;
				st.style.left = sx + "%";
				st.style.top = (10 + rand() * 72) + "%";
				st.style.setProperty("--rot", Math.round(rand() * 70 - 35) + "deg");
				st.style.setProperty("--sz", (40 + rand() * 46).toFixed(0) + "px");
				st.style.animationDelay = (0.25 + s * 0.12).toFixed(2) + "s";
				blast.appendChild(st);
			}
		}

		// Kiss shower: lots of lips falling from the top.
		if (def.fx === "rain") {
			for (var r = 0; r < 34; r++) {
				var drop = el("span", "kb-drop", rand() < 0.8 ? "💋" : (rand() < 0.5 ? "💖" : "😘"));
				drop.style.left = (rand() * 96 + 2).toFixed(1) + "%";
				drop.style.setProperty("--sz", (26 + rand() * 40).toFixed(0) + "px");
				drop.style.setProperty("--rot", Math.round(rand() * 80 - 40) + "deg");
				drop.style.setProperty("--dur", (1.5 + rand() * 1.3).toFixed(2) + "s");
				drop.style.animationDelay = (rand() * 1.3).toFixed(2) + "s";
				blast.appendChild(drop);
			}
		}

		// The big kiss in the middle.
		var main = el("div", "kb-main");
		var count = def.fx === "double" ? 2 : 1;
		for (var m = 0; m < count; m++) {
			var big = el("span", "kb-big" + (count > 1 ? " kb-big-" + (m + 1) : ""), def.emoji);
			big.setAttribute("aria-hidden", "true");
			main.appendChild(big);
		}
		blast.appendChild(main);

		// Heart burst flying out of the kiss.
		var burstCount = def.fx === "hearts" ? 26 : 16;
		for (var b = 0; b < burstCount; b++) {
			var ang = (b / burstCount) * Math.PI * 2 + rand() * 0.5;
			var dist = 150 + rand() * (def.fx === "hearts" ? 320 : 230);
			var bit = el("span", "kb-bit", def.fx === "hearts" ? (rand() < 0.75 ? "💖" : "💕") : BURST[Math.floor(rand() * BURST.length)]);
			bit.style.setProperty("--dx", Math.round(Math.cos(ang) * dist) + "px");
			bit.style.setProperty("--dy", Math.round(Math.sin(ang) * dist) + "px");
			bit.style.setProperty("--rot", Math.round(rand() * 120 - 60) + "deg");
			bit.style.setProperty("--sz", (18 + rand() * 22).toFixed(0) + "px");
			bit.style.animationDelay = (0.18 + rand() * 0.18).toFixed(2) + "s";
			blast.appendChild(bit);
		}

		// Who sent it.
		var cap = el("div", "kb-caption");
		var who = el("b", "kb-who", info.self ? "You" : (info.name || "Someone"));
		if (info.color) who.style.color = info.color;
		cap.appendChild(who);
		cap.appendChild(document.createTextNode(" " + def.verb + " " + (def.fx === "blow" ? "😘" : "💋")));
		if (info.self && info.offline) cap.appendChild(el("span", "kb-offline", "Room sync is offline — only you saw this one."));
		blast.appendChild(cap);

		layer.appendChild(blast);
		this.active.push(blast);

		if (this.soundOn && typeof global.funSound === "function") global.funSound(def.sound);

		var self = this;
		blast._kbTimer = setTimeout(function () { self._remove(blast); }, def.life);
	};

	KissBlast.prototype._remove = function (blast) {
		var idx = this.active.indexOf(blast);
		if (idx >= 0) this.active.splice(idx, 1);
		clearTimeout(blast._kbTimer);
		if (blast.parentNode) blast.parentNode.removeChild(blast);
	};

	global.KissBlast = KissBlast;
})(typeof window !== "undefined" ? window : this);
