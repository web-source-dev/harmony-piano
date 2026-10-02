/**
 * WakeBell — "Wake Up" bell: rings a loud 5-second alarm bell on EVERY screen
 * in the room at the same moment (no popup — just the sound, a flashing tab
 * title and, on phones, vibration).
 *
 * Synced over the Harmony room relay. The sound is synthesized (no files) on
 * its own AudioContext at full volume, independent of the piano volume slider.
 *
 * Browsers only allow audio after the page has been clicked/tapped/typed in at
 * least once, so the context is unlocked on the first interaction. Someone who
 * opened the tab and never touched it still gets the flashing tab title and
 * (on phones) vibration.
 *
 * Protocol (relay text, "WB|" prefixed):
 *   WB|r   -> ring the bell, sent by msg.p
 */
(function (global) {
	"use strict";

	var SYNC_PREFIX = "WB|";
	var RING_SECONDS = 5;
	var SEND_COOLDOWN_MS = 8000;
	var RECV_THROTTLE_MS = 4000;

	function WakeBell(opts) {
		opts = opts || {};
		this.client = opts.client;
		this.ctx = null;
		this.out = null;
		this.lastSentAt = 0;
		this.lastFrom = {};
		this.titleTimer = null;
		this._bindUnlock();
		this._bindUi();
	}

	WakeBell.SYNC_PREFIX = SYNC_PREFIX;

	WakeBell.isSyncText = function (text) {
		return !!(text && typeof text === "string" && text.indexOf(SYNC_PREFIX) === 0);
	};

	// ---- audio ----------------------------------------------------------

	WakeBell.prototype._bindUnlock = function () {
		var self = this;
		var unlock = function () { self._audio(); };
		["pointerdown", "mousedown", "keydown", "touchstart"].forEach(function (ev) {
			global.addEventListener(ev, unlock, { passive: true });
		});
	};

	WakeBell.prototype._audio = function () {
		if (!this.ctx) {
			var AC = global.AudioContext || global.webkitAudioContext;
			if (!AC) return null;
			try { this.ctx = new AC(); } catch (e) { return null; }
			// Compressor + makeup gain: as loud as possible without clipping.
			var comp = this.ctx.createDynamicsCompressor();
			comp.threshold.value = -18;
			comp.knee.value = 6;
			comp.ratio.value = 12;
			comp.attack.value = 0.002;
			comp.release.value = 0.12;
			var gain = this.ctx.createGain();
			gain.gain.value = 1.6;
			comp.connect(gain);
			gain.connect(this.ctx.destination);
			this.out = comp;
		}
		if (this.ctx.state === "suspended") { try { this.ctx.resume(); } catch (e) {} }
		return this.ctx;
	};

	// One hammer strike on a metal bell: a few inharmonic partials that decay fast.
	WakeBell.prototype._strike = function (t, base, vol) {
		var ctx = this.ctx;
		var partials = [[1, 1], [2.76, 0.55], [5.4, 0.3], [8.93, 0.15]];
		for (var i = 0; i < partials.length; i++) {
			var osc = ctx.createOscillator();
			var g = ctx.createGain();
			osc.type = "sine";
			osc.frequency.value = base * partials[i][0];
			var peak = vol * partials[i][1];
			var decay = 0.16 / (1 + i * 0.6);
			g.gain.setValueAtTime(0.0001, t);
			g.gain.exponentialRampToValueAtTime(peak, t + 0.003);
			g.gain.exponentialRampToValueAtTime(0.0001, t + decay + 0.05);
			osc.connect(g);
			g.connect(this.out);
			osc.start(t);
			osc.stop(t + decay + 0.08);
		}
		// Click of the hammer hitting the bell.
		var click = ctx.createOscillator();
		var cg = ctx.createGain();
		click.type = "square";
		click.frequency.value = base * 3.1;
		cg.gain.setValueAtTime(vol * 0.12, t);
		cg.gain.exponentialRampToValueAtTime(0.0001, t + 0.015);
		click.connect(cg);
		cg.connect(this.out);
		click.start(t);
		click.stop(t + 0.02);
	};

	// Classic alarm-clock ring: the hammer rattles between two bells ~18 times a
	// second, in bursts of ~1.1s with short gaps, for RING_SECONDS in total.
	WakeBell.prototype._ring = function () {
		var ctx = this._audio();
		if (!ctx || !this.out) return false;
		var start = ctx.currentTime + 0.05;
		var end = start + RING_SECONDS;
		var burst = 1.1, gap = 0.22, rate = 1 / 18;
		for (var b = start; b < end; b += burst + gap) {
			var stop = Math.min(b + burst, end);
			var n = 0;
			for (var t = b; t < stop; t += rate, n++) {
				this._strike(t, n % 2 ? 1568 : 1318, 0.9);
			}
		}
		return ctx.state === "running";
	};

	// ---- UI -------------------------------------------------------------

	WakeBell.prototype._bindUi = function () {
		var self = this;
		var btn = document.getElementById("wake-bell-btn");
		if (!btn) return;
		btn.addEventListener("click", function (e) {
			e.preventDefault();
			e.stopPropagation();
			self.send();
		});
	};

	WakeBell.prototype.send = function () {
		var now = Date.now();
		if (now - this.lastSentAt < SEND_COOLDOWN_MS) return false; // no bell spam
		this.lastSentAt = now;
		if (this.client && this.client.broadcastRoom) this.client.broadcastRoom(SYNC_PREFIX + "r");
		this.ring();
		return true;
	};

	WakeBell.prototype.tryHandleChat = function (msg) {
		var text = msg.a != null ? msg.a : (msg.message != null ? msg.message : "");
		if (!WakeBell.isSyncText(text)) return false;
		var parts = text.slice(SYNC_PREFIX.length).split("|");
		if (parts[0] !== "r") return true;
		var p = msg.p || {};
		var key = String(p._id || "?");
		var now = Date.now();
		if (now - (this.lastFrom[key] || 0) < RECV_THROTTLE_MS) return true;
		this.lastFrom[key] = now;
		this.ring();
		return true;
	};

	// The bell itself, plus vibration and a flashing tab title (no popup).
	WakeBell.prototype.ring = function () {
		this._ring();
		try { if (navigator.vibrate) navigator.vibrate([400, 150, 400, 150, 400, 150, 400]); } catch (e) {}
		this._flashTitle();
	};

	// Flash the tab title so a background tab shows something is going on.
	WakeBell.prototype._flashTitle = function () {
		clearInterval(this.titleTimer);
		var original = document.title;
		var n = 0;
		this.titleTimer = setInterval(function () {
			n++;
			document.title = n % 2 ? "🔔 WAKE UP! 🔔" : original;
			if (n >= RING_SECONDS * 2) {
				clearInterval(this.titleTimer);
				document.title = original;
			}
		}.bind(this), 500);
	};

	global.WakeBell = WakeBell;
})(typeof window !== "undefined" ? window : this);
