/**
 * Room Pet — ONE squishy critter shared by the whole room. Everybody feeds and
 * pets the same pet, and it slowly gets hungry: if nobody in the room feeds it
 * in time, it starves and dies (until someone revives it). It also gets livelier
 * and cheers when more friends are in the room.
 *
 * Room-synced via the chat/relay transport (RP| prefix), same as partyGame.js.
 *
 * Sync model — fully deterministic so everyone sees the same pet without constant
 * chatter. The shared state is a hunger baseline (h0) stamped at a server time
 * (t0); every client computes the current hunger locally:
 *     hunger = clamp(h0 + (serverTime - t0) / STARVE_MS, 0, 1)
 * Feeding lowers h0 and re-stamps t0; reviving bumps a generation counter. On any
 * incoming state we keep the newest one (higher gen, else higher t0), so the order
 * messages arrive in doesn't matter.
 */
(function (global) {
	"use strict";

	var SYNC_PREFIX = "RP|";
	var STARVE_MS = 120000;   // full (0) -> starved (1) if never fed
	var FEED_AMT = 0.34;      // how much one feed fills the tummy
	var REVIVE_HUNGER = 0.25; // how full the pet starts after a revive

	var W = 84, H = 84;

	function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
	function pick(a) { return a[Math.floor(Math.random() * a.length)]; }

	function RoomPet(opts) {
		opts = opts || {};
		this.client = opts.client;
		this.onLayoutChange = opts.onLayoutChange || function () {};

		// shared state
		this.gen = 1;
		this.h0 = 0.3;
		this.t0 = this.serverTime();
		this.feeds = 0;

		// local presentation
		this.visible = false;
		this.bob = 0;
		this.faceDir = 1;
		this.lastT = Date.now();
		this.bubble = null;
		this.bubbleUntil = 0;
		this.hearts = [];
		this.wasDead = false;
		this.ignoreSelfUntil = 0;

		this._buildUi();
		this._loop();
	}

	RoomPet.SYNC_PREFIX = SYNC_PREFIX;

	RoomPet.isSyncText = function (text) {
		return !!(text && typeof text === "string" && text.indexOf(SYNC_PREFIX) === 0);
	};

	RoomPet.prototype.serverTime = function () {
		return Date.now() + ((this.client && this.client.serverTimeOffset) || 0);
	};

	RoomPet.prototype._selfId = function () { return this.client && this.client.participantId; };

	RoomPet.prototype._name = function (id) {
		var p = this.client && this.client.ppl && this.client.ppl[id];
		return (p && p.name) || "someone";
	};

	RoomPet.prototype._population = function () {
		var ppl = (this.client && this.client.ppl) || {};
		var n = 0;
		for (var id in ppl) if (ppl.hasOwnProperty(id)) n++;
		return n || 1;
	};

	// ---- derived state ---------------------------------------------------

	RoomPet.prototype.hunger = function () {
		return clamp(this.h0 + (this.serverTime() - this.t0) / STARVE_MS, 0, 1);
	};

	RoomPet.prototype.isDead = function () { return this.hunger() >= 1; };

	// ---- networking ------------------------------------------------------

	RoomPet.prototype.sendSync = function (payload) {
		if (!this.client || !this.client.isConnected()) return;
		var msg = SYNC_PREFIX + payload;
		if (msg.length > 512) return;
		this.ignoreSelfUntil = Date.now() + 400;
		this.client.broadcastRoom(msg);
	};

	RoomPet.prototype._broadcastState = function () {
		this.sendSync("s|" + this.gen + "|" + this.h0.toFixed(3) + "|" + Math.round(this.t0) + "|" + this.feeds);
	};

	// Keep the newest known state (higher generation, else higher timestamp).
	RoomPet.prototype._adoptState = function (gen, h0, t0, feeds) {
		if (gen > this.gen || (gen === this.gen && t0 > this.t0)) {
			this.gen = gen;
			this.h0 = clamp(h0, 0, 1);
			this.t0 = t0;
			if (!isNaN(feeds)) this.feeds = feeds;
			return true;
		}
		return false;
	};

	RoomPet.prototype.tryHandleChat = function (msg) {
		var text = msg.a != null ? msg.a : (msg.message != null ? msg.message : "");
		if (!RoomPet.isSyncText(text)) return false;
		var me = this.client.getOwnParticipant();
		var selfMsg = me && msg.p && msg.p._id === me._id;
		if (selfMsg && Date.now() < this.ignoreSelfUntil) return true;

		var parts = text.slice(SYNC_PREFIX.length).split("|");
		var cmd = parts[0];
		if (cmd === "s") {
			var wasDeadBefore = this.isDead();
			var changed = this._adoptState(
				parseInt(parts[1], 10) || 1,
				parseFloat(parts[2]),
				parseFloat(parts[3]) || this.serverTime(),
				parseInt(parts[4], 10)
			);
			if (changed && !selfMsg) {
				if (wasDeadBefore && !this.isDead()) {
					if (global.funSound) global.funSound("fanfare");
					this._spawnHearts(8);
					this._say("alive again! 🥚✨", 1800);
				} else if (this.hunger() < 0.5) {
					if (global.funSound) global.funSound("nom");
					this._spawnHearts(4);
				}
			}
		} else if (cmd === "h") {
			// somebody petted it — cosmetic love for everyone
			if (!selfMsg) {
				if (global.funSound) global.funSound("coin", { gain: 0.6 });
				this._spawnHearts(3);
				this._say(pick(["❤️", "purr~", "boop!", "🥰"]), 1100);
			}
		} else if (cmd === "q") {
			// a newcomer asked for state — answer with a little jitter
			var self = this;
			setTimeout(function () { self._broadcastState(); }, 80 + Math.random() * 160);
		}
		return true;
	};

	RoomPet.prototype.requestSync = function () { this.sendSync("q"); };

	// ---- actions ---------------------------------------------------------

	RoomPet.prototype.feed = function () {
		if (!this.client || !this.client.isConnected()) { this._say("connect to a room first!", 1600); return; }
		if (this.isDead()) { this._say("too late… revive me 🥚", 1600); return; }
		var cur = this.hunger();
		this.h0 = clamp(cur - FEED_AMT, 0, 1);
		this.t0 = this.serverTime();
		this.feeds++;
		if (global.funSound) { global.funSound("nom"); global.funSound("coin", { gain: 0.6 }); }
		this._say(pick(["yum!", "nom nom", "❤️", "more?", "tasty!", "thank u!"]), 1300);
		this._spawnHearts(5);
		this._broadcastState();
	};

	RoomPet.prototype.petLove = function () {
		if (!this.client || !this.client.isConnected()) { this._say("connect to a room first!", 1600); return; }
		if (this.isDead()) { this._say("revive me first 🥚", 1500); return; }
		if (global.funSound) global.funSound("coin", { gain: 0.6 });
		this._say(pick(["❤️", "purr~", "boop!", "🥰", "hehe"]), 1100);
		this._spawnHearts(3);
		this.sendSync("h|" + (this._selfId() || ""));
	};

	RoomPet.prototype.revive = function () {
		if (!this.client || !this.client.isConnected()) { this._say("connect to a room first!", 1600); return; }
		if (!this.isDead()) return;
		this.gen++;
		this.h0 = REVIVE_HUNGER;
		this.t0 = this.serverTime();
		if (global.funSound) global.funSound("fanfare");
		this._say("yaaay, reborn! 🥚✨", 1800);
		this._spawnHearts(8);
		if (global.gEmojiParty) global.gEmojiParty.blastConfetti();
		this._broadcastState();
	};

	// ---- ui --------------------------------------------------------------

	RoomPet.prototype._buildUi = function () {
		var bar = document.createElement("div");
		bar.className = "party-bar roompet-bar";
		bar.setAttribute("hidden", "hidden");
		bar.innerHTML =
			'<canvas class="roompet-canvas" width="' + W + '" height="' + H + '"></canvas>' +
			'<span class="roompet-status">Room Pet</span>' +
			'<div class="roompet-hunger"><div class="roompet-hunger-fill"></div></div>' +
			'<button type="button" class="roompet-feed party-btn">Feed 🍎</button>' +
			'<button type="button" class="roompet-pet party-btn">Pet 💛</button>' +
			'<button type="button" class="roompet-revive party-btn" hidden>Revive 🥚</button>' +
			'<button type="button" class="roompet-close party-btn" title="Close">×</button>';
		document.body.appendChild(bar);
		this.bar = bar;
		this.canvas = bar.querySelector(".roompet-canvas");
		this.ctx = this.canvas.getContext("2d");
		this.elStatus = bar.querySelector(".roompet-status");
		this.elHunger = bar.querySelector(".roompet-hunger-fill");
		this.elFeed = bar.querySelector(".roompet-feed");
		this.elPet = bar.querySelector(".roompet-pet");
		this.elRevive = bar.querySelector(".roompet-revive");

		var self = this;
		this.elFeed.addEventListener("click", function (e) { e.stopPropagation(); self.feed(); });
		this.elPet.addEventListener("click", function (e) { e.stopPropagation(); self.petLove(); });
		this.elRevive.addEventListener("click", function (e) { e.stopPropagation(); self.revive(); });
		this.canvas.addEventListener("mousedown", function (e) { e.stopPropagation(); self.isDead() ? self.revive() : self.feed(); });
		this.canvas.addEventListener("touchstart", function (e) { e.preventDefault(); e.stopPropagation(); self.isDead() ? self.revive() : self.feed(); }, { passive: false });
		bar.querySelector(".roompet-close").addEventListener("click", function (e) { e.stopPropagation(); self.setVisible(false); });
	};

	RoomPet.prototype.setVisible = function (on) {
		this.visible = !!on;
		if (this.bar) {
			if (this.visible) this.bar.removeAttribute("hidden");
			else this.bar.setAttribute("hidden", "hidden");
		}
		if (this.visible && this.client && this.client.isConnected()) this.requestSync();
		this.onLayoutChange();
	};

	RoomPet.prototype._say = function (t, ms) { this.bubble = t; this.bubbleUntil = Date.now() + (ms || 1400); };

	RoomPet.prototype._spawnHearts = function (n) {
		for (var i = 0; i < n; i++) {
			this.hearts.push({ x: (Math.random() - 0.5) * 34, y: 0, vy: -0.8 - Math.random(), life: 1 });
		}
	};

	RoomPet.prototype._loop = function () {
		var self = this;
		this._timer = setInterval(function () { self._tick(); }, 1000 / 30);
	};

	RoomPet.prototype._tick = function () {
		if (!this.bar) return;
		var now = Date.now();
		var dt = Math.min(64, now - this.lastT) / 1000;
		this.lastT = now;
		this.bob += dt * 6;

		var hungry = this.hunger();
		var dead = hungry >= 1;
		var pop = this._population();

		// announce death once (locally) for a bit of drama
		if (dead && !this.wasDead) {
			this.wasDead = true;
			if (global.funSound) global.funSound("spooky");
			this._say("💀 starved…", 2200);
		} else if (!dead && this.wasDead) {
			this.wasDead = false;
		}

		// idle chatter
		if (now > this.bubbleUntil && !dead) {
			if (hungry > 0.85 && Math.random() < 0.012) this._say(pick(["feed me 🥺", "so hungry…", "*tummy rumble*", "pls feed 🙏"]), 1800);
			else if (hungry < 0.25 && Math.random() < 0.006) this._say(pick(["💕", "best room ever!", "boop", pop > 2 ? (pop + " friends! 🎶") : "🎵"]), 1500);
		}

		// hearts physics
		for (var i = this.hearts.length - 1; i >= 0; i--) {
			var hp = this.hearts[i];
			hp.y += hp.vy; hp.vy *= 0.98; hp.life -= 0.02;
			if (hp.life <= 0) this.hearts.splice(i, 1);
		}

		// buttons + status (only bother when the panel is open)
		if (this.elFeed) this.elFeed.disabled = dead;
		if (this.elPet) this.elPet.disabled = dead;
		if (this.elRevive) { if (dead) this.elRevive.removeAttribute("hidden"); else this.elRevive.setAttribute("hidden", "hidden"); }

		if (this.elStatus) {
			if (dead) this.elStatus.textContent = "💀 Pixel starved — revive it!";
			else if (hungry > 0.8) this.elStatus.textContent = "😖 starving! feed it! (" + pop + " here)";
			else if (hungry > 0.5) this.elStatus.textContent = "🍽️ getting hungry… (" + pop + " here)";
			else this.elStatus.textContent = "😄 happy pet — " + pop + " friend" + (pop === 1 ? "" : "s") + " · fed " + this.feeds + "×";
		}
		if (this.elHunger) {
			this.elHunger.style.width = (clamp(1 - hungry, 0, 1) * 100) + "%";
			this.elHunger.style.background = hungry > 0.8 ? "#ff4d4d" : (hungry > 0.55 ? "#ffb13b" : "#6bcb77");
		}
		this.bar.classList.toggle("roompet-dead", dead);
		this.bar.classList.toggle("roompet-starving", !dead && hungry > 0.8);

		if (this.visible) this._draw(hungry, dead, pop);
	};

	RoomPet.prototype._draw = function (hungry, dead, pop) {
		var ctx = this.ctx;
		ctx.clearRect(0, 0, W, H);
		var lively = clamp(1 - hungry, 0, 1);
		var bobY = Math.sin(this.bob) * (dead ? 0 : (2 + lively * 2));
		var cx = W / 2, cy = 50 + bobY;
		var bodyR = 24;

		// shadow
		ctx.fillStyle = "rgba(0,0,0,0.18)";
		ctx.beginPath();
		ctx.ellipse(cx, 76, 20, 5, 0, 0, Math.PI * 2);
		ctx.fill();

		if (dead) {
			// little tombstone
			ctx.fillStyle = "#8c93a3";
			ctx.beginPath();
			if (ctx.roundRect) ctx.roundRect(cx - 16, cy - 18, 32, 40, 8); else ctx.rect(cx - 16, cy - 18, 32, 40);
			ctx.fill();
			ctx.fillStyle = "#5b616e";
			ctx.font = "700 14px verdana, sans-serif";
			ctx.textAlign = "center"; ctx.textBaseline = "middle";
			ctx.fillText("R.I.P", cx, cy - 2);
			ctx.textBaseline = "alphabetic";
			this._drawHearts(cx, cy);
			this._drawBubble(cx, bobY);
			return;
		}

		// color drains from lively green to grey-green as it starves
		var hue = 130 - hungry * 40;
		var sat = 70 - hungry * 45;

		// body
		ctx.fillStyle = "hsl(" + hue + "," + sat + "%,55%)";
		ctx.beginPath();
		ctx.moveTo(cx - bodyR, cy + 14);
		ctx.quadraticCurveTo(cx - bodyR, cy - bodyR, cx, cy - bodyR);
		ctx.quadraticCurveTo(cx + bodyR, cy - bodyR, cx + bodyR, cy + 14);
		ctx.quadraticCurveTo(cx, cy + 22, cx - bodyR, cy + 14);
		ctx.fill();
		// feet
		ctx.fillStyle = "hsl(" + hue + "," + sat + "%,45%)";
		ctx.beginPath();
		ctx.ellipse(cx - 10, cy + 16, 6, 4, 0, 0, Math.PI * 2);
		ctx.ellipse(cx + 10, cy + 16, 6, 4, 0, 0, Math.PI * 2);
		ctx.fill();

		// a tiny crown when the room is buzzing (3+ friends)
		if (pop >= 3) {
			ctx.fillStyle = "#ffd93d";
			ctx.beginPath();
			ctx.moveTo(cx - 12, cy - bodyR - 2);
			ctx.lineTo(cx - 12, cy - bodyR - 12);
			ctx.lineTo(cx - 6, cy - bodyR - 6);
			ctx.lineTo(cx, cy - bodyR - 14);
			ctx.lineTo(cx + 6, cy - bodyR - 6);
			ctx.lineTo(cx + 12, cy - bodyR - 12);
			ctx.lineTo(cx + 12, cy - bodyR - 2);
			ctx.closePath();
			ctx.fill();
		}

		// eyes
		var ex = this.faceDir * 2;
		ctx.fillStyle = "#fff";
		ctx.beginPath(); ctx.arc(cx - 8, cy - 4, 6, 0, Math.PI * 2); ctx.arc(cx + 8, cy - 4, 6, 0, Math.PI * 2); ctx.fill();
		ctx.fillStyle = "#1a2a1a";
		ctx.beginPath(); ctx.arc(cx - 8 + ex, cy - 3, 3, 0, Math.PI * 2); ctx.arc(cx + 8 + ex, cy - 3, 3, 0, Math.PI * 2); ctx.fill();

		// mouth: smile when fed, frown when starving
		ctx.strokeStyle = "#1a2a1a"; ctx.lineWidth = 2; ctx.lineCap = "round";
		ctx.beginPath();
		if (hungry < 0.6) ctx.arc(cx, cy + 4, 6, 0.1 * Math.PI, 0.9 * Math.PI);
		else ctx.arc(cx, cy + 12, 6, 1.15 * Math.PI, 1.85 * Math.PI);
		ctx.stroke();

		// blush when happy
		if (hungry < 0.35) {
			ctx.fillStyle = "rgba(255,120,150,0.5)";
			ctx.beginPath(); ctx.arc(cx - 16, cy + 2, 3, 0, Math.PI * 2); ctx.arc(cx + 16, cy + 2, 3, 0, Math.PI * 2); ctx.fill();
		}

		this._drawHearts(cx, cy);
		this._drawBubble(cx, bobY);
	};

	RoomPet.prototype._drawHearts = function (cx, cy) {
		var ctx = this.ctx;
		for (var i = 0; i < this.hearts.length; i++) {
			var hp = this.hearts[i];
			ctx.globalAlpha = clamp(hp.life, 0, 1);
			ctx.font = "14px serif"; ctx.textAlign = "center";
			ctx.fillText("❤️", cx + hp.x, cy - 18 + hp.y);
			ctx.globalAlpha = 1;
		}
	};

	RoomPet.prototype._drawBubble = function (cx, bobY) {
		if (!this.bubble || Date.now() >= this.bubbleUntil) return;
		var ctx = this.ctx;
		ctx.font = "700 11px verdana, sans-serif";
		var tw = ctx.measureText(this.bubble).width + 12;
		var bx = clamp(cx - tw / 2, 0, W - tw), by = 10 + bobY;
		ctx.fillStyle = "rgba(255,255,255,0.96)";
		ctx.strokeStyle = "rgba(30,50,30,0.3)"; ctx.lineWidth = 1;
		ctx.beginPath();
		if (ctx.roundRect) ctx.roundRect(bx, by, tw, 16, 6); else ctx.rect(bx, by, tw, 16);
		ctx.fill(); ctx.stroke();
		ctx.fillStyle = "#1a2a1a"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
		ctx.fillText(this.bubble, bx + tw / 2, by + 8);
		ctx.textBaseline = "alphabetic";
	};

	RoomPet.prototype.destroy = function () {
		if (this._timer) clearInterval(this._timer);
	};

	global.RoomPet = RoomPet;
})(typeof window !== "undefined" ? window : this);
