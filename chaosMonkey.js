/**
 * Chaos Monkey — a mischievous monkey that scampers around the page and causes
 * harmless chaos: renaming buttons, rotating images, swapping fonts, and
 * leaving banana peels everywhere. Toggle it off and everything is restored.
 * Purely local fun (not room-synced).
 */
(function (global) {
	"use strict";

	var SILLY_NAMES = ["🍌 Banana", "Do NOT press", "Free hugs", "Boop", "Mystery", "Press me ;)", "Nope", "Snacc", "Big Red Button", "Wobble", "Yeet", "Shhh"];
	var SILLY_FONTS = ["'Comic Sans MS', cursive", "'Papyrus', fantasy", "Impact, sans-serif", "'Courier New', monospace", "cursive"];
	var MONKEY_SAYS = ["ook ook!", "🍌", "chaos!", "hee hee", "oops", "my page now", "🐒", "whoopsie"];
	// containers we must never touch, or you couldn't turn the monkey back off
	var SAFE_SELECTOR = "#harmony-tools, .party-bar, #modal, .pixel-pet, .evil-cursor, .useless-btn, .useless-bubble, #emoji-overlay";

	function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
	function rand(a, b) { return a + Math.random() * (b - a); }

	function ChaosMonkey() {
		this.active = false;
		this.changes = [];   // {el, prop, old} for reverting
		this._build();
	}

	ChaosMonkey.prototype._build = function () {
		var m = document.createElement("div");
		m.className = "chaos-monkey";
		m.setAttribute("hidden", "hidden");
		m.innerHTML = '<span class="chaos-monkey-face">🐵</span><span class="chaos-monkey-bubble" hidden></span>';
		document.body.appendChild(m);
		this.el = m;
		this.face = m.querySelector(".chaos-monkey-face");
		this.bubble = m.querySelector(".chaos-monkey-bubble");
	};

	ChaosMonkey.prototype.setActive = function (on) {
		this.active = !!on;
		if (this.active) {
			this.el.removeAttribute("hidden");
			this._moveTo(rand(20, window.innerWidth - 60), rand(60, window.innerHeight - 80));
			this._say("ook ook! 🐒");
			var self = this;
			this._timer = setInterval(function () { self._prank(); }, 2600);
			setTimeout(function () { self._prank(); }, 700);
		} else {
			if (this._timer) { clearInterval(this._timer); this._timer = null; }
			this._revertAll();
			this.el.setAttribute("hidden", "hidden");
		}
	};

	ChaosMonkey.prototype._isSafe = function (el) {
		return !el || (el.closest && el.closest(SAFE_SELECTOR));
	};

	ChaosMonkey.prototype._visible = function (els) {
		var out = [];
		for (var i = 0; i < els.length; i++) {
			var el = els[i];
			if (this._isSafe(el)) continue;
			var r = el.getBoundingClientRect();
			if (r.width > 8 && r.height > 8 && r.top < window.innerHeight && r.bottom > 0 && r.left < window.innerWidth && r.right > 0) {
				out.push(el);
			}
		}
		return out;
	};

	ChaosMonkey.prototype._record = function (el, prop, oldVal) {
		this.changes.push({ el: el, prop: prop, old: oldVal });
		// keep things sane: revert the oldest if it gets out of hand
		if (this.changes.length > 22) {
			var c = this.changes.shift();
			this._restore(c);
		}
	};

	ChaosMonkey.prototype._prank = function () {
		if (!this.active) return;
		var roll = Math.floor(rand(0, 4));
		var target = null;
		if (roll === 0) target = this._renameButton();
		else if (roll === 1) target = this._rotateImage();
		else if (roll === 2) target = this._changeFont();
		else target = this._dropBanana();

		// scamper toward whatever it messed with, then chatter
		if (target && target.getBoundingClientRect) {
			var r = target.getBoundingClientRect();
			this._moveTo(r.left + r.width / 2 - 18, r.top - 30);
		} else {
			this._moveTo(rand(20, window.innerWidth - 60), rand(60, window.innerHeight - 80));
		}
		if (global.funSound) global.funSound("monkey");
		this._say(pick(MONKEY_SAYS));
	};

	ChaosMonkey.prototype._renameButton = function () {
		var btns = this._visible(document.querySelectorAll("button"));
		if (!btns.length) return null;
		var b = pick(btns);
		this._record(b, "innerHTML", b.innerHTML);
		b.textContent = pick(SILLY_NAMES);
		return b;
	};

	ChaosMonkey.prototype._rotateImage = function () {
		var imgs = this._visible(document.querySelectorAll("img"));
		if (!imgs.length) return this._dropBanana();
		var im = pick(imgs);
		this._record(im, "transform", im.style.transform);
		im.style.transition = "transform 0.4s ease";
		im.style.transform = "rotate(" + Math.floor(rand(-180, 180)) + "deg)";
		return im;
	};

	ChaosMonkey.prototype._changeFont = function () {
		var els = this._visible(document.querySelectorAll("h1,h2,h3,p,span,a,li,label,button"));
		if (!els.length) return null;
		var el = pick(els);
		this._record(el, "fontFamily", el.style.fontFamily);
		el.style.fontFamily = pick(SILLY_FONTS);
		return el;
	};

	ChaosMonkey.prototype._dropBanana = function () {
		var x = rand(40, window.innerWidth - 40);
		var y = rand(60, window.innerHeight - 60);
		var s = document.createElement("span");
		s.className = "chaos-banana";
		s.textContent = "🍌";
		s.style.left = x + "px";
		s.style.top = y + "px";
		document.body.appendChild(s);
		setTimeout(function () { if (s.parentNode) s.parentNode.removeChild(s); }, 4000);
		return null;
	};

	ChaosMonkey.prototype._restore = function (c) {
		try {
			if (c.prop === "innerHTML") c.el.innerHTML = c.old;
			else c.el.style[c.prop] = c.old || "";
		} catch (e) {}
	};

	ChaosMonkey.prototype._revertAll = function () {
		// restore newest-first so stacked changes on one element unwind cleanly
		for (var i = this.changes.length - 1; i >= 0; i--) this._restore(this.changes[i]);
		this.changes = [];
		var bananas = document.querySelectorAll(".chaos-banana");
		for (var j = 0; j < bananas.length; j++) if (bananas[j].parentNode) bananas[j].parentNode.removeChild(bananas[j]);
	};

	ChaosMonkey.prototype._moveTo = function (x, y) {
		this.el.style.left = Math.max(0, Math.min(window.innerWidth - 40, x)) + "px";
		this.el.style.top = Math.max(0, Math.min(window.innerHeight - 40, y)) + "px";
	};

	ChaosMonkey.prototype._say = function (text) {
		this.bubble.textContent = text;
		this.bubble.removeAttribute("hidden");
		clearTimeout(this._bubbleT);
		var self = this;
		this._bubbleT = setTimeout(function () { self.bubble.setAttribute("hidden", "hidden"); }, 1600);
	};

	global.ChaosMonkey = ChaosMonkey;
})(typeof window !== "undefined" ? window : this);
