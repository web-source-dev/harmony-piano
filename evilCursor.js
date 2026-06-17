/**
 * Evil Cursor — a sassy fake cursor that chases your real one around and
 * argues with it. It mostly copies you, then occasionally darts off in protest.
 * Purely local fun (not room-synced).
 */
(function (global) {
	"use strict";

	var LINES = [
		"Copycat.", "Stop following me!", "I was here first.", "Ugh, you again.",
		"Mine. All mine.", "Get your own path.", "→ is MY symbol.", "rude.",
		"quit it 😤", "imitation is NOT flattery", "back off, pixel-breath",
		"we are NOT the same", "you click weird", "I'm the better cursor"
	];

	function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
	function pick(a) { return a[Math.floor(Math.random() * a.length)]; }

	function EvilCursor() {
		this.active = false;
		this.mx = window.innerWidth / 2;
		this.my = window.innerHeight / 2;
		this.x = this.mx; this.y = this.my;
		this.mode = "chase";       // chase | flee
		this.modeUntil = 0;
		this.nextLine = 0;
		this._build();
		var self = this;
		window.addEventListener("mousemove", function (e) { self.mx = e.clientX; self.my = e.clientY; });
		window.addEventListener("touchmove", function (e) {
			if (e.touches[0]) { self.mx = e.touches[0].clientX; self.my = e.touches[0].clientY; }
		}, { passive: true });
	}

	EvilCursor.prototype._build = function () {
		var wrap = document.createElement("div");
		wrap.className = "evil-cursor";
		wrap.setAttribute("hidden", "hidden");
		wrap.innerHTML = '<span class="evil-arrow">➤</span><span class="evil-bubble" hidden></span>';
		document.body.appendChild(wrap);
		this.el = wrap;
		this.arrow = wrap.querySelector(".evil-arrow");
		this.bubble = wrap.querySelector(".evil-bubble");
	};

	EvilCursor.prototype.setActive = function (on) {
		this.active = !!on;
		if (this.active) {
			this.el.removeAttribute("hidden");
			this.x = this.mx + 40; this.y = this.my + 10;
			this.mode = "chase"; this.modeUntil = Date.now() + 2500;
			this.nextLine = Date.now() + 600;
			this._say("oh great, it's you.");
			this._start();
		} else {
			this.el.setAttribute("hidden", "hidden");
			if (this.animId) { cancelAnimationFrame(this.animId); this.animId = null; }
		}
	};

	EvilCursor.prototype._say = function (text) {
		this.bubble.textContent = text;
		this.bubble.removeAttribute("hidden");
		clearTimeout(this._bubbleT);
		var self = this;
		this._bubbleT = setTimeout(function () { self.bubble.setAttribute("hidden", "hidden"); }, 1900);
	};

	EvilCursor.prototype._start = function () {
		if (this.animId) return;
		var self = this;
		function tick() {
			self.animId = requestAnimationFrame(tick);
			self._step();
		}
		tick();
	};

	EvilCursor.prototype._step = function () {
		var now = Date.now();
		if (now > this.modeUntil) {
			// mostly chase, sometimes storm off to the opposite side
			this.mode = Math.random() < 0.65 ? "chase" : "flee";
			this.modeUntil = now + (this.mode === "flee" ? 900 + Math.random() * 700 : 1800 + Math.random() * 2200);
			if (this.mode === "flee") this._say(pick(LINES));
		}

		var gx, gy;
		if (this.mode === "flee") {
			// run to the mirror-opposite of the real cursor
			gx = window.innerWidth - this.mx;
			gy = window.innerHeight - this.my;
		} else {
			gx = this.mx + 36;
			gy = this.my + 8;
		}
		var ease = this.mode === "flee" ? 0.08 : 0.14;
		this.x += (gx - this.x) * ease;
		this.y += (gy - this.y) * ease;
		this.x = clamp(this.x, 4, window.innerWidth - 24);
		this.y = clamp(this.y, 4, window.innerHeight - 24);
		this.el.style.left = this.x + "px";
		this.el.style.top = this.y + "px";

		// point the arrow toward the real cursor (it's confronting you)
		var ang = Math.atan2(this.my - this.y, this.mx - this.x) * 180 / Math.PI;
		this.arrow.style.transform = "rotate(" + ang + "deg)";

		if (now > this.nextLine && this.mode === "chase") {
			this.nextLine = now + 2600 + Math.random() * 2600;
			this._say(pick(LINES));
		}
	};

	global.EvilCursor = EvilCursor;
})(typeof window !== "undefined" ? window : this);
