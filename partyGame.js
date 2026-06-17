/**
 * Party Game — a synced "hot potato" bomb that passes between everyone in the
 * room. Whoever is holding it when the fuse runs out goes BOOM. Tap to pass it
 * to a random friend. Room-synced via chat transport (PG| prefix).
 */
(function (global) {
	"use strict";

	var SYNC_PREFIX = "PG|";
	var MIN_FUSE = 8000;
	var MAX_FUSE = 20000;

	function rand(a, b) { return a + Math.random() * (b - a); }

	function PartyGame(opts) {
		opts = opts || {};
		this.client = opts.client;
		this.onLayoutChange = opts.onLayoutChange || function () {};

		this.active = false;
		this.holderId = null;
		this.fuseEnd = 0;
		this.fuseLen = MAX_FUSE;
		this.exploded = false;
		this.visible = false;
		this.ignoreSelfUntil = 0;

		this._buildUi();
		this._loop();
	}

	PartyGame.SYNC_PREFIX = SYNC_PREFIX;

	PartyGame.isSyncText = function (text) {
		return !!(text && typeof text === "string" && text.indexOf(SYNC_PREFIX) === 0);
	};

	PartyGame.prototype.serverTime = function () {
		return Date.now() + (this.client.serverTimeOffset || 0);
	};

	PartyGame.prototype._selfId = function () { return this.client.participantId; };

	PartyGame.prototype._name = function (id) {
		var p = this.client.ppl && this.client.ppl[id];
		return (p && p.name) || "someone";
	};

	PartyGame.prototype._others = function () {
		var ids = [];
		var ppl = this.client.ppl || {};
		var me = this._selfId();
		for (var id in ppl) {
			if (ppl.hasOwnProperty(id) && id !== me) ids.push(id);
		}
		return ids;
	};

	// ---- networking ------------------------------------------------------

	PartyGame.prototype.sendSync = function (payload) {
		if (!this.client || !this.client.isConnected()) return;
		var msg = SYNC_PREFIX + payload;
		if (msg.length > 512) return;
		this.ignoreSelfUntil = Date.now() + 400;
		this.client.sendArray([{ m: "a", message: msg }]);
	};

	PartyGame.prototype.tryHandleChat = function (msg) {
		var text = msg.a != null ? msg.a : (msg.message != null ? msg.message : "");
		if (!PartyGame.isSyncText(text)) return false;
		var me = this.client.getOwnParticipant();
		var selfMsg = me && msg.p && msg.p._id === me._id;
		if (selfMsg && Date.now() < this.ignoreSelfUntil) return true;

		var parts = text.slice(SYNC_PREFIX.length).split("|");
		var cmd = parts[0];
		if (cmd === "s" || cmd === "p") {
			this.active = true;
			this.exploded = false;
			this.holderId = parts[1];
			this.fuseEnd = parseFloat(parts[2]) || (this.serverTime() + MAX_FUSE);
			this.fuseLen = parseFloat(parts[3]) || this.fuseLen;
			if (!this.visible) this.setVisible(true);
			if (cmd === "p") this._flash(this._name(this.holderId) + " caught it! 💣");
		} else if (cmd === "x") {
			this._showBoom(parts[1]);
		} else if (cmd === "q") {
			// a newcomer asked for state; the current holder answers
			if (this.active && this.holderId === this._selfId()) {
				var self = this;
				setTimeout(function () { self.sendSync("s|" + self.holderId + "|" + Math.round(self.fuseEnd) + "|" + Math.round(self.fuseLen)); }, 80 + Math.random() * 120);
			}
		}
		return true;
	};

	PartyGame.prototype.requestSync = function () { this.sendSync("q"); };

	// ---- game actions ----------------------------------------------------

	PartyGame.prototype.start = function () {
		if (this.active) return;
		if (!this.client.isConnected()) { this._flash("connect to a room first!"); return; }
		this.active = true;
		this.exploded = false;
		this.holderId = this._selfId();
		this.fuseLen = rand(MIN_FUSE, MAX_FUSE);
		this.fuseEnd = this.serverTime() + this.fuseLen;
		this._flash("you lit the fuse! 🔥 PASS IT!");
		this.sendSync("s|" + this.holderId + "|" + Math.round(this.fuseEnd) + "|" + Math.round(this.fuseLen));
	};

	PartyGame.prototype.pass = function () {
		if (!this.active || this.exploded) return;
		if (this.holderId !== this._selfId()) { this._flash("you're not holding it! 😅"); return; }
		var others = this._others();
		if (!others.length) { this._flash("nobody to pass to... uh oh 😬"); return; }
		var next = others[Math.floor(rand(0, others.length))];
		this.holderId = next;
		this._flash("passed to " + this._name(next) + "! 💨");
		this.sendSync("p|" + next + "|" + Math.round(this.fuseEnd) + "|" + Math.round(this.fuseLen));
	};

	PartyGame.prototype._explode = function () {
		// only the holder fires this
		this.exploded = true;
		var who = this.holderId;
		this.sendSync("x|" + who);
		this._showBoom(who);
	};

	PartyGame.prototype._showBoom = function (id) {
		this.active = false;
		this.exploded = true;
		this.holderId = null;
		var isMe = id === this._selfId();
		this._flash(isMe ? "💥 YOU exploded! 💥 lol" : "💥 " + this._name(id) + " exploded! 💥");
		// celebrate with confetti if the emoji party module is around
		if (global.gEmojiParty) {
			if (isMe) global.gEmojiParty.blastConfetti();
			else global.gEmojiParty.launchEmoji(7, 0.5); // 💀
		}
	};

	// ---- ui --------------------------------------------------------------

	PartyGame.prototype._buildUi = function () {
		var bar = document.createElement("div");
		bar.className = "party-bar bomb-bar";
		bar.setAttribute("hidden", "hidden");
		bar.innerHTML =
			'<span class="bomb-emoji">💣</span>' +
			'<span class="bomb-status">Hot Potato Bomb</span>' +
			'<div class="bomb-fuse"><div class="bomb-fuse-fill"></div></div>' +
			'<button type="button" class="bomb-start party-btn">Light it 🔥</button>' +
			'<button type="button" class="bomb-pass party-btn" disabled>Pass 💨</button>' +
			'<button type="button" class="bomb-close party-btn" title="Close">×</button>';
		document.body.appendChild(bar);
		this.bar = bar;
		this.elEmoji = bar.querySelector(".bomb-emoji");
		this.elStatus = bar.querySelector(".bomb-status");
		this.elFuse = bar.querySelector(".bomb-fuse-fill");
		this.elStart = bar.querySelector(".bomb-start");
		this.elPass = bar.querySelector(".bomb-pass");

		var self = this;
		this.elStart.addEventListener("click", function (e) { e.stopPropagation(); self.start(); });
		this.elPass.addEventListener("click", function (e) { e.stopPropagation(); self.pass(); });
		this.elEmoji.addEventListener("click", function (e) { e.stopPropagation(); self.pass(); });
		bar.querySelector(".bomb-close").addEventListener("click", function (e) { e.stopPropagation(); self.setVisible(false); });
	};

	PartyGame.prototype.setVisible = function (on) {
		this.visible = !!on;
		if (this.bar) {
			if (this.visible) this.bar.removeAttribute("hidden");
			else this.bar.setAttribute("hidden", "hidden");
		}
		if (this.visible && this.client.isConnected()) this.requestSync();
		this.onLayoutChange();
	};

	PartyGame.prototype._flash = function (text) {
		if (!this.elStatus) return;
		this.elStatus.textContent = text;
	};

	PartyGame.prototype._loop = function () {
		var self = this;
		this._timer = setInterval(function () { self._tick(); }, 140);
	};

	PartyGame.prototype._tick = function () {
		if (!this.bar) return;
		var holdingMe = this.active && this.holderId === this._selfId();
		this.bar.classList.toggle("bomb-mine", !!holdingMe);
		if (this.elStart) this.elStart.disabled = this.active;
		if (this.elPass) this.elPass.disabled = !holdingMe;

		if (!this.active) {
			if (!this.exploded && this.elFuse) this.elFuse.style.width = "0%";
			return;
		}

		var remain = this.fuseEnd - this.serverTime();
		var frac = Math.max(0, Math.min(1, remain / this.fuseLen));
		if (this.elFuse) {
			this.elFuse.style.width = (frac * 100) + "%";
			this.elFuse.style.background = frac < 0.3 ? "#ff3b3b" : (frac < 0.6 ? "#ffb13b" : "#6bcb77");
		}
		if (this.elEmoji) this.elEmoji.style.transform = "scale(" + (1 + (1 - frac) * 0.5) + ")";

		if (holdingMe) this._flash("💣 YOU have it! " + (remain / 1000).toFixed(1) + "s — PASS!");
		else this._flash(this._name(this.holderId) + " has it… " + (remain / 1000).toFixed(1) + "s 😬");

		// fuse ran out — only the holder detonates (single source of truth)
		if (remain <= 0 && !this.exploded) {
			if (this.holderId === this._selfId()) {
				this._explode();
			} else if (remain < -2000) {
				// holder vanished / went silent — fizzle locally
				this.active = false;
				this._flash("the bomb fizzled out 🧯");
			}
		}
	};

	PartyGame.prototype.destroy = function () {
		if (this._timer) clearInterval(this._timer);
	};

	global.PartyGame = PartyGame;
})(typeof window !== "undefined" ? window : this);
