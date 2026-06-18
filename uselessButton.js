/**
 * Useless Button — a button that refuses to be clicked. It darts away from
 * your cursor with a fresh excuse every time. Catch it enough and it gives up.
 * Purely local fun (not room-synced).
 */
(function (global) {
	"use strict";

	var QUIPS = [
		"Nope!", "Too slow!", "Catch me!", "Almost!", "Not today!", "Hehe",
		"Try again 😜", "Missed!", "lol no", "you'll never get me", "👻",
		"wheee!", "nice try", "boop—gone", "404: button moved", "skill issue"
	];
	var GIVEUP = 14;

	function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
	function pick(a) { return a[Math.floor(Math.random() * a.length)]; }

	function UselessButton() {
		this.active = false;
		this.dodges = 0;
		this.tired = false;
		this.cooldownUntil = 0;
		this._build();
		var self = this;
		window.addEventListener("mousemove", function (e) { self._proximity(e.clientX, e.clientY); });
	}

	UselessButton.prototype._build = function () {
		var b = document.createElement("button");
		b.type = "button";
		b.className = "useless-btn";
		b.textContent = "Click me!";
		b.setAttribute("hidden", "hidden");
		document.body.appendChild(b);
		this.el = b;

		var bubble = document.createElement("div");
		bubble.className = "useless-bubble";
		bubble.setAttribute("hidden", "hidden");
		document.body.appendChild(bubble);
		this.bubble = bubble;

		var self = this;
		b.addEventListener("mouseenter", function () { self._dodge(); });
		b.addEventListener("mousedown", function (e) {
			if (self.tired) { self._caught(); }
			else { e.preventDefault(); self._dodge(); }
		});
		b.addEventListener("touchstart", function (e) {
			e.preventDefault();
			if (self.tired) self._caught(); else self._dodge();
		}, { passive: false });
	};

	UselessButton.prototype.setActive = function (on) {
		this.active = !!on;
		if (this.active) {
			this.dodges = 0; this.tired = false;
			this.el.textContent = "Click me!";
			this.el.classList.remove("useless-tired");
			this.el.removeAttribute("hidden");
			this._moveTo(0.5, 0.5);
			this._say("bet you can't click me 😏");
		} else {
			this.el.setAttribute("hidden", "hidden");
			this.bubble.setAttribute("hidden", "hidden");
		}
	};

	UselessButton.prototype._proximity = function (cx, cy) {
		if (!this.active || this.tired) return;
		if (Date.now() < this.cooldownUntil) return;
		var r = this.el.getBoundingClientRect();
		var dx = cx - (r.left + r.width / 2);
		var dy = cy - (r.top + r.height / 2);
		if (dx * dx + dy * dy < 90 * 90) this._dodge();
	};

	UselessButton.prototype._dodge = function () {
		if (!this.active || this.tired) return;
		this.cooldownUntil = Date.now() + 200;
		this.dodges++;
		if (window.funSound) window.funSound("blip", { throttle: 90 });
		this._say(pick(QUIPS));
		this._moveTo(0.06 + Math.random() * 0.86, 0.12 + Math.random() * 0.74);
		if (this.dodges >= GIVEUP) {
			this.tired = true;
			this.el.textContent = "ok ok… click me 😮‍💨";
			this.el.classList.add("useless-tired");
			this._say("fine. you win. go ahead.");
		}
	};

	UselessButton.prototype._moveTo = function (nx, ny) {
		this._nx = nx; this._ny = ny;
		this.el.style.left = (nx * 100) + "%";
		this.el.style.top = (ny * 100) + "%";
	};

	UselessButton.prototype._caught = function () {
		if (window.funSound) window.funSound("fanfare");
		this._say("🎉 YOU GOT ME! 🎉");
		if (global.gEmojiParty) global.gEmojiParty.blastConfetti();
		this.tired = false; this.dodges = 0;
		this.el.classList.remove("useless-tired");
		var self = this;
		setTimeout(function () {
			if (!self.active) return;
			self.el.textContent = "Click me!";
			self._moveTo(0.06 + Math.random() * 0.86, 0.12 + Math.random() * 0.74);
			self._say("again? ok... catch me!");
		}, 900);
	};

	UselessButton.prototype._say = function (text) {
		var r = this.el.getBoundingClientRect();
		this.bubble.textContent = text;
		this.bubble.style.left = clamp(r.left + r.width / 2, 60, window.innerWidth - 60) + "px";
		this.bubble.style.top = Math.max(8, r.top - 30) + "px";
		this.bubble.removeAttribute("hidden");
		clearTimeout(this._bubbleT);
		var self = this;
		this._bubbleT = setTimeout(function () { self.bubble.setAttribute("hidden", "hidden"); }, 1300);
	};

	global.UselessButton = UselessButton;
})(typeof window !== "undefined" ? window : this);
