/**
 * Pixel Pet — a tiny squishy critter that follows your cursor around. It gets
 * hungry if you ignore it; click it to feed it and watch it cheer up.
 * Purely local fun (not room-synced).
 */
(function (global) {
	"use strict";

	var W = 76, H = 92; // canvas size (pet + hunger bar)
	function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
	function pick(a) { return a[Math.floor(Math.random() * a.length)]; }

	function PixelPet() {
		this.active = false;
		this.x = window.innerWidth / 2;
		this.y = window.innerHeight / 2;
		this.tx = this.x; this.ty = this.y;
		this.hunger = 0.25;     // 0 = stuffed, 1 = starving
		this.bob = 0;
		this.faceDir = 1;
		this.lastT = Date.now();
		this.bubble = null;
		this.bubbleUntil = 0;
		this.hearts = [];
		this._build();
		var self = this;
		window.addEventListener("mousemove", function (e) { self.tx = e.clientX; self.ty = e.clientY; });
		window.addEventListener("touchmove", function (e) {
			if (e.touches[0]) { self.tx = e.touches[0].clientX; self.ty = e.touches[0].clientY; }
		}, { passive: true });
	}

	PixelPet.prototype._build = function () {
		var c = document.createElement("canvas");
		c.className = "pixel-pet";
		c.width = W; c.height = H;
		c.style.width = W + "px"; c.style.height = H + "px";
		c.setAttribute("hidden", "hidden");
		document.body.appendChild(c);
		this.canvas = c;
		this.ctx = c.getContext("2d");
		var self = this;
		var feed = function (e) { e.preventDefault(); e.stopPropagation(); self.feed(); };
		c.addEventListener("mousedown", feed);
		c.addEventListener("touchstart", feed, { passive: false });
	};

	PixelPet.prototype.setActive = function (on) {
		this.active = !!on;
		if (this.active) {
			this.canvas.removeAttribute("hidden");
			this.hunger = 0.25;
			this._say("hi! 🐾", 1600);
			this.lastT = Date.now();
			this._start();
		} else {
			this.canvas.setAttribute("hidden", "hidden");
			if (this.animId) { cancelAnimationFrame(this.animId); this.animId = null; }
		}
	};

	PixelPet.prototype.feed = function () {
		this.hunger = clamp(this.hunger - 0.45, 0, 1);
		this._say(pick(["yum!", "nom nom", "❤️", "more?", "tasty!", "thank u!"]), 1300);
		for (var i = 0; i < 5; i++) {
			this.hearts.push({ x: (Math.random() - 0.5) * 30, y: 0, vy: -0.8 - Math.random(), life: 1 });
		}
	};

	PixelPet.prototype._say = function (t, ms) { this.bubble = t; this.bubbleUntil = Date.now() + (ms || 1400); };

	PixelPet.prototype._start = function () {
		if (this.animId) return;
		var self = this;
		function tick() {
			self.animId = requestAnimationFrame(tick);
			self._step();
			self._draw();
		}
		tick();
	};

	PixelPet.prototype._step = function () {
		var now = Date.now();
		var dt = Math.min(64, now - this.lastT) / 1000;
		this.lastT = now;

		// follow with lag, trailing slightly below-right of the cursor
		var goalX = this.tx - W / 2 + 18;
		var goalY = this.ty + 16;
		var speed = this.hunger > 0.8 ? 0.05 : 0.12;  // sluggish when starving
		this.x += (goalX - this.x) * speed;
		this.y += (goalY - this.y) * speed;
		this.x = clamp(this.x, 0, window.innerWidth - W);
		this.y = clamp(this.y, 0, window.innerHeight - H);
		this.canvas.style.left = this.x + "px";
		this.canvas.style.top = this.y + "px";
		this.faceDir = (goalX < this.x) ? -1 : 1;

		this.bob += dt * 6;
		this.hunger = clamp(this.hunger + dt * 0.018, 0, 1); // ~55s to starving

		if (this.hunger > 0.85 && now > this.bubbleUntil && Math.random() < 0.02) this._say(pick(["feed me 🥺", "so hungry…", "*tummy rumble*"]), 1800);
		else if (this.hunger < 0.2 && now > this.bubbleUntil && Math.random() < 0.008) this._say(pick(["💕", "best friend!", "boop", "🎵"]), 1400);

		for (var i = this.hearts.length - 1; i >= 0; i--) {
			var hp = this.hearts[i];
			hp.y += hp.vy; hp.vy *= 0.98; hp.life -= 0.02;
			if (hp.life <= 0) this.hearts.splice(i, 1);
		}
	};

	PixelPet.prototype._draw = function () {
		var ctx = this.ctx;
		ctx.clearRect(0, 0, W, H);
		var bobY = Math.sin(this.bob) * 3;
		var cx = W / 2, cy = 56 + bobY;
		var hungry = this.hunger;

		// color drains from lively green to grey-green as it starves
		var hue = 130 - hungry * 40;
		var sat = 70 - hungry * 45;
		var bodyR = 24;

		// shadow
		ctx.fillStyle = "rgba(0,0,0,0.18)";
		ctx.beginPath();
		ctx.ellipse(cx, 84, 20, 5, 0, 0, Math.PI * 2);
		ctx.fill();

		// body
		ctx.fillStyle = "hsl(" + hue + "," + sat + "%,55%)";
		ctx.beginPath();
		ctx.moveTo(cx - bodyR, cy + 14);
		ctx.quadraticCurveTo(cx - bodyR, cy - bodyR, cx, cy - bodyR);
		ctx.quadraticCurveTo(cx + bodyR, cy - bodyR, cx + bodyR, cy + 14);
		ctx.quadraticCurveTo(cx, cy + 22, cx - bodyR, cy + 14);
		ctx.fill();
		// little feet
		ctx.fillStyle = "hsl(" + hue + "," + sat + "%,45%)";
		ctx.beginPath(); ctx.ellipse(cx - 10, cy + 16, 6, 4, 0, 0, Math.PI * 2);
		ctx.ellipse(cx + 10, cy + 16, 6, 4, 0, 0, Math.PI * 2); ctx.fill();

		// eyes (look toward cursor side)
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

		// hunger bar
		ctx.fillStyle = "rgba(0,0,0,0.25)";
		ctx.fillRect(cx - 22, 8, 44, 6);
		ctx.fillStyle = hungry > 0.8 ? "#ff4d4d" : (hungry > 0.55 ? "#ffb13b" : "#6bcb77");
		ctx.fillRect(cx - 22, 8, 44 * (1 - hungry), 6);

		// floating hearts
		for (var i = 0; i < this.hearts.length; i++) {
			var hp = this.hearts[i];
			ctx.globalAlpha = clamp(hp.life, 0, 1);
			ctx.font = "14px serif"; ctx.textAlign = "center";
			ctx.fillText("❤️", cx + hp.x, cy - 18 + hp.y);
			ctx.globalAlpha = 1;
		}

		// speech bubble
		if (this.bubble && Date.now() < this.bubbleUntil) {
			ctx.font = "700 11px verdana, sans-serif";
			var tw = ctx.measureText(this.bubble).width + 12;
			var bx = clamp(cx - tw / 2, 0, W - tw), by = 22 + bobY;
			ctx.fillStyle = "rgba(255,255,255,0.96)";
			ctx.strokeStyle = "rgba(30,50,30,0.3)"; ctx.lineWidth = 1;
			ctx.beginPath();
			if (ctx.roundRect) ctx.roundRect(bx, by, tw, 16, 6); else ctx.rect(bx, by, tw, 16);
			ctx.fill(); ctx.stroke();
			ctx.fillStyle = "#1a2a1a"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
			ctx.fillText(this.bubble, bx + tw / 2, by + 8);
			ctx.textBaseline = "alphabetic";
		}
	};

	global.PixelPet = PixelPet;
})(typeof window !== "undefined" ? window : this);
