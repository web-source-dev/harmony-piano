/**
 * Emoji Party — synced floating emoji reactions + confetti blasts.
 * Click an emoji and it floats up on everyone's screen; hit confetti for a
 * room-wide party. Room-synced via chat transport (EP| prefix).
 */
(function (global) {
	"use strict";

	var SYNC_PREFIX = "EP|";
	var EMOJIS = ["😂", "❤️", "🎉", "👍", "🔥", "😮", "😎", "💀", "🙌", "✨", "🤣", "🥳", "🤡", "💩"];
	var CONFETTI_COLORS = ["#ff5a7a", "#ffd93d", "#6bcb77", "#4d96ff", "#c77dff", "#ff924d", "#5ad1e6"];

	function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
	function rand(a, b) { return a + Math.random() * (b - a); }

	function EmojiParty(opts) {
		opts = opts || {};
		this.client = opts.client;
		this.emojis = EMOJIS;

		this.particles = [];
		this.animId = null;
		this.ignoreSelfUntil = 0;

		this._makeOverlay();
		var self = this;
		window.addEventListener("resize", function () { self._resize(); });
	}

	EmojiParty.SYNC_PREFIX = SYNC_PREFIX;
	EmojiParty.EMOJIS = EMOJIS;

	EmojiParty.isSyncText = function (text) {
		return !!(text && typeof text === "string" && text.indexOf(SYNC_PREFIX) === 0);
	};

	EmojiParty.prototype._makeOverlay = function () {
		var c = document.createElement("canvas");
		c.id = "emoji-overlay";
		c.style.cssText = "position:fixed;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:9000;";
		document.body.appendChild(c);
		this.canvas = c;
		this.ctx = c.getContext("2d");
		this._resize();
	};

	EmojiParty.prototype._resize = function () {
		if (!this.canvas) return;
		var dpr = window.devicePixelRatio || 1;
		this.w = window.innerWidth;
		this.h = window.innerHeight;
		this.canvas.width = Math.floor(this.w * dpr);
		this.canvas.height = Math.floor(this.h * dpr);
		this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	};

	EmojiParty.prototype.sendSync = function (payload) {
		if (!this.client || !this.client.isConnected()) return;
		var msg = SYNC_PREFIX + payload;
		if (msg.length > 512) return;
		this.ignoreSelfUntil = Date.now() + 400;
		this.client.broadcastRoom(msg);
	};

	EmojiParty.prototype.tryHandleChat = function (msg) {
		var text = msg.a != null ? msg.a : (msg.message != null ? msg.message : "");
		if (!EmojiParty.isSyncText(text)) return false;
		var me = this.client.getOwnParticipant();
		if (me && msg.p && msg.p._id === me._id && Date.now() < this.ignoreSelfUntil) return true;

		var parts = text.slice(SYNC_PREFIX.length).split("|");
		if (parts[0] === "b") {
			this.launchEmoji(parseInt(parts[1], 10) || 0, parseFloat(parts[2]) || 0.5);
		} else if (parts[0] === "c") {
			this.blastConfetti();
		} else if (parts[0] === "r") {
			this.emojiRain(parseInt(parts[1], 10) || 0);
		}
		return true;
	};

	// ---- public triggers (local + broadcast) ----------------------------

	EmojiParty.prototype.react = function (index) {
		var x = rand(0.2, 0.8);
		this.launchEmoji(index, x);
		this.sendSync("b|" + index + "|" + x.toFixed(3));
	};

	EmojiParty.prototype.party = function () {
		this.blastConfetti();
		this.sendSync("c");
	};

	EmojiParty.prototype.rain = function (index) {
		this.emojiRain(index);
		this.sendSync("r|" + index);
	};

	// ---- effects ---------------------------------------------------------

	EmojiParty.prototype.launchEmoji = function (index, normX) {
		if (global.funSound) global.funSound("pop", { throttle: 60 });
		var emoji = this.emojis[index] || this.emojis[0];
		var baseX = normX * this.w;
		var n = 3;
		for (var i = 0; i < n; i++) {
			this.particles.push({
				type: "emoji", text: emoji,
				x: baseX + rand(-30, 30), y: this.h - rand(20, 90),
				vx: rand(-0.5, 0.5), vy: rand(-3.4, -2.4),
				size: rand(28, 46), life: 1, decay: rand(0.006, 0.011),
				rot: rand(-0.3, 0.3), spin: rand(-0.02, 0.02), wob: rand(0, 6.28)
			});
		}
		this._start();
	};

	EmojiParty.prototype.emojiRain = function (index) {
		if (global.funSound) global.funSound("shower");
		var emoji = this.emojis[index] || this.emojis[0];
		for (var i = 0; i < 26; i++) {
			this.particles.push({
				type: "emoji", text: emoji,
				x: rand(0, this.w), y: rand(-this.h * 0.4, -10),
				vx: rand(-0.3, 0.3), vy: rand(2, 4.5),
				size: rand(22, 40), life: 1, decay: 0.004,
				rot: rand(-0.3, 0.3), spin: rand(-0.05, 0.05), wob: rand(0, 6.28), falling: true
			});
		}
		this._start();
	};

	EmojiParty.prototype.blastConfetti = function () {
		if (global.funSound) global.funSound("sparkle");
		var count = 150;
		for (var i = 0; i < count; i++) {
			this.particles.push({
				type: "confetti",
				x: rand(0, this.w), y: rand(-this.h * 0.3, 0),
				vx: rand(-2, 2), vy: rand(2, 6),
				w: rand(6, 12), h: rand(8, 16),
				color: CONFETTI_COLORS[Math.floor(rand(0, CONFETTI_COLORS.length))],
				life: 1, decay: rand(0.004, 0.008),
				rot: rand(0, 6.28), spin: rand(-0.2, 0.2)
			});
		}
		this._start();
	};

	EmojiParty.prototype._start = function () {
		if (this.animId) return;
		var self = this;
		function tick() {
			self.animId = requestAnimationFrame(tick);
			self._step();
			self._draw();
			if (!self.particles.length) { cancelAnimationFrame(self.animId); self.animId = null; }
		}
		tick();
	};

	EmojiParty.prototype._step = function () {
		var ps = this.particles;
		for (var i = ps.length - 1; i >= 0; i--) {
			var p = ps[i];
			p.x += p.vx;
			p.y += p.vy;
			if (p.type === "confetti") {
				p.vy += 0.08;            // gravity
				p.vx *= 0.99;
				p.rot += p.spin;
				if (p.y > this.h + 20) { ps.splice(i, 1); continue; }
			} else {
				p.wob += 0.08;
				p.x += Math.sin(p.wob) * 0.6;
				if (p.falling) { p.vy += 0.02; } else { p.vy *= 0.992; }
				p.rot += p.spin;
			}
			p.life -= p.decay;
			if (p.life <= 0) ps.splice(i, 1);
		}
	};

	EmojiParty.prototype._draw = function () {
		var ctx = this.ctx;
		ctx.clearRect(0, 0, this.w, this.h);
		var ps = this.particles;
		for (var i = 0; i < ps.length; i++) {
			var p = ps[i];
			ctx.save();
			ctx.globalAlpha = clamp(p.life, 0, 1);
			ctx.translate(p.x, p.y);
			ctx.rotate(p.rot);
			if (p.type === "confetti") {
				ctx.fillStyle = p.color;
				ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
			} else {
				ctx.font = p.size + "px serif";
				ctx.textAlign = "center";
				ctx.textBaseline = "middle";
				ctx.fillText(p.text, 0, 0);
			}
			ctx.restore();
		}
		ctx.globalAlpha = 1;
	};

	global.EmojiParty = EmojiParty;
})(typeof window !== "undefined" ? window : this);
