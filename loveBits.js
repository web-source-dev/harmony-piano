/**
 * LoveBits — little romantic extras for the two people in the room.
 *
 *   • Room Weather — cherry blossoms, snow, rain or fireflies; both of you see it.
 *   • Heart String — a soft, bouncy rope always ties your two cursors together.
 *   • Love Meter   — the heart on the string fills up. Every time your cursors
 *                    touch it's a kiss (+1). Tapping the heart +1, a blown
 *                    kiss +5, a hug +5. At 100 a giant heart bursts.
 *   • Blow a Kiss  — a 😘 flies from your cursor and lands on theirs.
 *   • Hug          — two little mochi friends squeeze each other.
 *
 * The room is meant for exactly two people: when there are two real
 * participants they are tied together automatically.
 *
 * People are addressed by MPP participant `id` (unique per connection), which
 * the sender writes into every message — the relay only forwards `_id`, and
 * two people on the same network share an `_id`.
 *
 * Protocol (relay text):  LV|<senderId>|<cmd>|...
 *   w|type|seed|ts   set room weather (none/sakura/snow/rain/fireflies)
 *   q                "what's the state?" (sent after joining)
 *   s|{json}         state reply { w, ws, wt, m }
 *   b|seed           blow a kiss at the other person
 *   h                hug the other person
 *   t                cursors touched (sent only by the "lower" id, so it counts once)
 *   m                tapped the heart
 */
(function (global) {
	"use strict";

	var SYNC_PREFIX = "LV|";
	var SOUND_KEY = "harmonyLoveSound";
	var WEATHER_VIEW_KEY = "harmonyLoveWeatherView";
	var METER_KEY = "harmonyLoveMeter:";

	var WEATHERS = [
		{ id: "none", emoji: "☀️", label: "Clear" },
		{ id: "sakura", emoji: "🌸", label: "Blossoms" },
		{ id: "snow", emoji: "❄️", label: "Snow" },
		{ id: "rain", emoji: "🌧️", label: "Rain" },
		{ id: "fireflies", emoji: "✨", label: "Fireflies" }
	];
	var WEATHER_BY_ID = {};
	for (var wi = 0; wi < WEATHERS.length; wi++) WEATHER_BY_ID[WEATHERS[wi].id] = WEATHERS[wi];

	var PTS_TOUCH = 1;
	var PTS_TAP = 1;
	var PTS_KISS = 5;
	var PTS_HUG = 5;

	var TOUCH_IN = 30;   // px — cursors this close = a kiss
	var TOUCH_OUT = 70;  // px — must move this far apart before the next one counts
	var TOUCH_COOLDOWN_MS = 350;
	var SEND_COOLDOWN_MS = 800;
	var TAP_COOLDOWN_MS = 120;

	// Rope
	var ROPE_N = 18;
	var ROPE_GRAVITY = 1400;
	var ROPE_DAMP = 0.975;
	var ROPE_ITER = 10;
	var ROPE_SLACK = 1.12;
	var ROPE_STEP = 1 / 120;

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

	function reducedMotion() {
		try { return !!(global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) { return false; }
	}

	function sprite(size, draw) {
		var c = document.createElement("canvas");
		c.width = c.height = size;
		draw(c.getContext("2d"), size);
		return c;
	}

	function LoveBits(opts) {
		opts = opts || {};
		this.client = opts.client;
		this.openModal = opts.openModal || null;
		this.closeModal = opts.closeModal || null;

		this.weather = "none";
		this.weatherSeed = 1;
		this.weatherTs = 0;
		this.meter = 0;
		this.channelId = null;
		this.partner = null; // participant id of the other person, or null
		this.lastSentAt = 0;
		this.lastTapAt = 0;
		this.touchArmed = true;
		this.lastTouchAt = 0;
		this.mouse = null;

		this.soundOn = true;
		this.weatherView = true;
		try {
			this.soundOn = !(global.localStorage && localStorage.getItem(SOUND_KEY) === "0");
			this.weatherView = !(global.localStorage && localStorage.getItem(WEATHER_VIEW_KEY) === "0");
		} catch (e) {}

		this.layer = null;
		this.ropeCanvas = null;
		this.rope = null;
		this.knot = null;
		this.weatherCanvas = null;
		this.weatherParts = [];
		this.weatherType = "none";
		this.smooth = {}; // participant id -> smoothed {x, y}
		this._dpr = 1;
		this._raf = 0;
		this._last = 0;
		this._acc = 0;
		this._frame = this._frame.bind(this);

		var self = this;
		global.addEventListener("resize", function () { self._resize(); });
		global.addEventListener("pointermove", function (e) { self.mouse = { x: e.clientX, y: e.clientY }; }, { passive: true });

		this._bindUi();
		this._bindClient();
	}

	LoveBits.SYNC_PREFIX = SYNC_PREFIX;

	LoveBits.isSyncText = function (text) {
		return !!(text && typeof text === "string" && text.indexOf(SYNC_PREFIX) === 0);
	};

	// ---- people ---------------------------------------------------------

	LoveBits.prototype._myId = function () {
		return (this.client && this.client.participantId) || "";
	};

	LoveBits.prototype._isFake = function (p) {
		var C = global.Client;
		if (!p || !p.id) return true;
		if (C && C.isLobbyNoobParticipant && C.isLobbyNoobParticipant(p)) return true;
		if (C && C.isMybotAnonymousParticipant && C.isMybotAnonymousParticipant(p)) return true;
		return false;
	};

	// The other person — only when there are exactly two real people here.
	LoveBits.prototype._findPartner = function () {
		var myId = this._myId();
		var ppl = (this.client && this.client.ppl) || {};
		var other = null, count = 0;
		for (var id in ppl) {
			if (!ppl.hasOwnProperty(id) || this._isFake(ppl[id])) continue;
			count++;
			if (id !== myId) other = id;
		}
		return count === 2 && myId && ppl[myId] ? other : null;
	};

	LoveBits.prototype._refreshPartner = function () {
		var p = this._findPartner();
		if (p === this.partner) return;
		this.partner = p;
		this.touchArmed = true;
		if (p) this._makeRope();
		else this._dropRope();
		this._renderPanel();
	};

	// Where a cursor is on screen right now.
	LoveBits.prototype._pos = function (id, dt) {
		var ppl = (this.client && this.client.ppl) || {};
		var p = ppl[id];
		if (!p) return null;
		if (id === this._myId() && this.mouse) return this.mouse;
		// Follow the drawn cursor (it already eases between network updates).
		if (p.cursorDiv) {
			var r = p.cursorDiv.getBoundingClientRect();
			if (r.width || r.height || r.left || r.top) return { x: r.left, y: r.top };
		}
		var x = parseFloat(p.x), y = parseFloat(p.y);
		if (!isFinite(x) || !isFinite(y)) return null;
		var target = { x: x / 100 * global.innerWidth, y: y / 100 * global.innerHeight };
		var s = this.smooth[id];
		if (!s) { this.smooth[id] = target; return target; }
		var k = 1 - Math.exp(-(dt || 0.016) * 16);
		s.x += (target.x - s.x) * k;
		s.y += (target.y - s.y) * k;
		return s;
	};

	// ---- client wiring --------------------------------------------------

	LoveBits.prototype._bindClient = function () {
		var self = this;
		var c = this.client;
		if (!c || !c.on) return;
		function onChannel() {
			var id = c.channel && c.channel._id;
			if (id && id !== self.channelId) {
				self.channelId = id;
				self._setWeather("none", 1, 0);
				self.meter = self._loadMeter();
				self._paintMeter();
				setTimeout(function () { self._send("q"); }, 900 + Math.random() * 400);
			}
			self._refreshPartner();
		}
		c.on("ch", onChannel);
		c.on("participant added", function () { self._refreshPartner(); });
		c.on("participant removed", function () { self._refreshPartner(); });
		onChannel(); // in case we were created after joining
	};

	LoveBits.prototype._send = function (body) {
		var me = this._myId();
		if (!me) return false;
		return !!(this.client && this.client.broadcastRoom && this.client.broadcastRoom(SYNC_PREFIX + me + "|" + body));
	};

	// ---- UI -------------------------------------------------------------

	LoveBits.prototype._bindUi = function () {
		var self = this;
		var btn = document.getElementById("love-btn");
		if (btn) {
			btn.addEventListener("click", function (e) {
				e.preventDefault();
				e.stopPropagation();
				self.open();
			});
		}
		var dlg = document.getElementById("love-panel");
		if (!dlg) return;
		this.dialog = dlg;

		var wGrid = dlg.querySelector(".love-weather-grid");
		if (wGrid && !wGrid.childNodes.length) {
			WEATHERS.forEach(function (w) {
				var b = el("button", "love-weather-opt");
				b.type = "button";
				b.setAttribute("data-weather", w.id);
				b.setAttribute("aria-pressed", "false");
				b.title = w.label;
				var em = el("span", "love-weather-emoji", w.emoji);
				em.setAttribute("aria-hidden", "true");
				b.appendChild(em);
				b.appendChild(el("span", "love-weather-label", w.label));
				wGrid.appendChild(b);
			});
		}

		dlg.addEventListener("click", function (e) {
			var t = e.target;
			var w = t.closest && t.closest(".love-weather-opt");
			if (w) { e.preventDefault(); self.sendWeather(w.getAttribute("data-weather")); return; }
			var act = t.closest && t.closest("[data-love-act]");
			if (act) {
				e.preventDefault();
				var a = act.getAttribute("data-love-act");
				if (a === "kiss") self.blowKiss();
				else if (a === "hug") self.hug();
				return;
			}
			if (t.closest && t.closest(".love-close")) {
				e.preventDefault();
				if (self.closeModal) self.closeModal();
			}
		});

		var sound = dlg.querySelector(".love-sound-toggle");
		if (sound) {
			sound.checked = this.soundOn;
			sound.addEventListener("change", function () {
				self.soundOn = !!sound.checked;
				try { localStorage.setItem(SOUND_KEY, self.soundOn ? "1" : "0"); } catch (e) {}
			});
		}
		var view = dlg.querySelector(".love-weather-view");
		if (view) {
			view.checked = this.weatherView;
			view.addEventListener("change", function () {
				self.weatherView = !!view.checked;
				try { localStorage.setItem(WEATHER_VIEW_KEY, self.weatherView ? "1" : "0"); } catch (e) {}
				self._applyWeather();
			});
		}
	};

	LoveBits.prototype.open = function () {
		this._renderPanel();
		if (this.openModal) this.openModal("#love-panel", ".love-weather-opt.is-on");
	};

	LoveBits.prototype._renderPanel = function () {
		if (!this.dialog) return;
		var opts = this.dialog.querySelectorAll(".love-weather-opt");
		for (var i = 0; i < opts.length; i++) {
			var on = opts[i].getAttribute("data-weather") === this.weather;
			opts[i].classList.toggle("is-on", on);
			opts[i].setAttribute("aria-pressed", on ? "true" : "false");
		}
		var acts = this.dialog.querySelectorAll("[data-love-act]");
		for (var j = 0; j < acts.length; j++) acts[j].disabled = !this.partner;
		this._paintMeter();
	};

	// ---- weather --------------------------------------------------------

	LoveBits.prototype.sendWeather = function (type) {
		if (!WEATHER_BY_ID[type]) return;
		var seed = Math.floor(Math.random() * 2147483647) + 1;
		var ts = Date.now();
		this._send("w|" + type + "|" + seed + "|" + ts);
		this._setWeather(type, seed, ts);
		this._renderPanel();
	};

	LoveBits.prototype._setWeather = function (type, seed, ts) {
		if (!WEATHER_BY_ID[type]) type = "none";
		this.weather = type;
		this.weatherSeed = seed || 1;
		this.weatherTs = ts || 0;
		this._applyWeather();
	};

	LoveBits.prototype._applyWeather = function () {
		var type = this.weatherView ? this.weather : "none";
		this.weatherType = type;
		if (type === "none") {
			this.weatherParts = [];
			if (this.weatherCanvas && this.weatherCanvas.parentNode) this.weatherCanvas.parentNode.removeChild(this.weatherCanvas);
			this.weatherCanvas = null;
			return;
		}
		if (!this.weatherCanvas) {
			var cv = el("canvas", "love-weather");
			cv.setAttribute("aria-hidden", "true");
			document.body.appendChild(cv);
			this.weatherCanvas = cv;
			this.weatherCtx = cv.getContext("2d");
			this._sizeCanvas(cv, this.weatherCtx);
		}
		this._sprites();
		this._spawnWeather(type);
		this._run();
	};

	// Pre-drawn particles: drawing a bitmap is far cheaper than shadowBlur.
	LoveBits.prototype._sprites = function () {
		if (this.spr) return;
		var petal = function (color) {
			return sprite(32, function (g) {
				g.translate(16, 16);
				var grd = g.createLinearGradient(0, -14, 0, 14);
				grd.addColorStop(0, "#fff0f5");
				grd.addColorStop(1, color);
				g.fillStyle = grd;
				g.beginPath();
				g.moveTo(0, 13);
				g.bezierCurveTo(11, 6, 10, -8, 3, -13);
				g.lineTo(0, -9);
				g.lineTo(-3, -13);
				g.bezierCurveTo(-10, -8, -11, 6, 0, 13);
				g.fill();
			});
		};
		var glow = function (inner, outer) {
			return sprite(48, function (g) {
				var grd = g.createRadialGradient(24, 24, 0, 24, 24, 24);
				grd.addColorStop(0, inner);
				grd.addColorStop(0.25, inner);
				grd.addColorStop(0.5, outer);
				grd.addColorStop(1, "rgba(0,0,0,0)");
				g.fillStyle = grd;
				g.fillRect(0, 0, 48, 48);
			});
		};
		this.spr = {
			petals: [petal("#ffb3cc"), petal("#ff9fbf"), petal("#ffc9da")],
			snow: glow("rgba(255,255,255,1)", "rgba(220,235,255,0.35)"),
			fly: glow("rgba(255,252,190,1)", "rgba(200,255,110,0.35)")
		};
	};

	LoveBits.prototype._spawnWeather = function (type) {
		var W = global.innerWidth, H = global.innerHeight;
		var area = Math.max(0.4, Math.min(1.5, (W * H) / (1280 * 720)));
		var base = { sakura: 38, snow: 80, rain: 120, fireflies: 32 }[type] || 0;
		var n = Math.round(base * area * (reducedMotion() ? 0.35 : 1));
		var r = rng(this.weatherSeed);
		this._rand = r;
		var parts = [];
		for (var i = 0; i < n; i++) parts.push(this._newParticle(type, r, true));
		this.weatherParts = parts;
	};

	LoveBits.prototype._newParticle = function (type, r, anywhere) {
		var W = global.innerWidth, H = global.innerHeight;
		var p = { x: r() * W, y: anywhere ? r() * H : -30 - r() * 60, ph: r() * Math.PI * 2 };
		if (type === "sakura") {
			p.s = 0.45 + r() * 0.45;
			p.vy = 30 + r() * 34;
			p.vx = 12 + r() * 20;
			p.rot = r() * Math.PI * 2;
			p.vr = (r() - 0.5) * 2.2;
			p.k = Math.floor(r() * 3);
			if (!anywhere) p.x = r() * W * 1.1 - W * 0.1;
		} else if (type === "snow") {
			p.s = 5 + r() * 9;
			p.vy = 20 + p.s * 4 + r() * 10;
			p.vx = (r() - 0.5) * 14;
			p.a = 0.6 + r() * 0.4;
		} else if (type === "rain") {
			p.len = 12 + r() * 14;
			p.vy = 700 + r() * 300;
			p.vx = -70;
			p.x = r() * (W + 140);
		} else if (type === "fireflies") {
			p.y = r() * H;
			p.s = 14 + r() * 12;
			p.vx = (r() - 0.5) * 30;
			p.vy = (r() - 0.5) * 30;
			p.blink = 0.6 + r() * 1.3;
		}
		return p;
	};

	LoveBits.prototype._drawWeather = function (dt, t) {
		var ctx = this.weatherCtx;
		if (!ctx) return;
		var W = global.innerWidth, H = global.innerHeight;
		var type = this.weatherType;
		var r = this._rand || Math.random;
		var spr = this.spr;
		var parts = this.weatherParts;
		var d = this._dpr;
		var i, p;
		ctx.setTransform(d, 0, 0, d, 0, 0);
		ctx.clearRect(0, 0, W, H);
		if (type === "rain") {
			ctx.strokeStyle = "rgba(150, 185, 235, 0.45)";
			ctx.lineWidth = 1.2;
			ctx.beginPath();
			for (i = 0; i < parts.length; i++) {
				p = parts[i];
				p.x += p.vx * dt;
				p.y += p.vy * dt;
				ctx.moveTo(p.x, p.y);
				ctx.lineTo(p.x - p.len * 0.08, p.y + p.len);
				if (p.y > H) parts[i] = this._newParticle(type, r, false);
			}
			ctx.stroke();
			return;
		}
		if (type === "fireflies") {
			ctx.fillStyle = "rgba(24, 18, 58, 0.14)";
			ctx.fillRect(0, 0, W, H);
		}
		for (i = 0; i < parts.length; i++) {
			p = parts[i];
			if (type === "sakura") {
				p.x += (p.vx + Math.sin(t * 1.3 + p.ph) * 18) * dt;
				p.y += p.vy * dt;
				p.rot += p.vr * dt;
				var flip = Math.abs(Math.cos(t * 2 + p.ph)) * 0.75 + 0.25;
				var c = Math.cos(p.rot), s = Math.sin(p.rot);
				ctx.setTransform(c * p.s * d, s * p.s * d, -s * p.s * flip * d, c * p.s * flip * d, p.x * d, p.y * d);
				ctx.globalAlpha = 0.92;
				ctx.drawImage(spr.petals[p.k], -16, -16);
				if (p.y > H + 20 || p.x > W + 30) parts[i] = this._newParticle(type, r, false);
			} else if (type === "snow") {
				p.x += (p.vx + Math.sin(t * 0.8 + p.ph) * 10) * dt;
				p.y += p.vy * dt;
				ctx.globalAlpha = p.a;
				ctx.drawImage(spr.snow, p.x - p.s, p.y - p.s, p.s * 2, p.s * 2);
				if (p.y > H + 10) parts[i] = this._newParticle(type, r, false);
			} else if (type === "fireflies") {
				p.vx = Math.max(-26, Math.min(26, p.vx + (r() - 0.5) * 40 * dt));
				p.vy = Math.max(-26, Math.min(26, p.vy + (r() - 0.5) * 40 * dt));
				p.x += p.vx * dt;
				p.y += p.vy * dt;
				if (p.x < -20) p.x = W + 20; else if (p.x > W + 20) p.x = -20;
				if (p.y < -20) p.y = H + 20; else if (p.y > H + 20) p.y = -20;
				var glow = Math.sin(t * p.blink + p.ph);
				ctx.globalAlpha = 0.2 + 0.8 * glow * glow;
				ctx.drawImage(spr.fly, p.x - p.s, p.y - p.s, p.s * 2, p.s * 2);
			}
		}
		ctx.globalAlpha = 1;
	};

	// ---- canvases / main loop -------------------------------------------

	LoveBits.prototype._sizeCanvas = function (cv, ctx) {
		var dpr = Math.min(global.devicePixelRatio || 1, 1.5);
		this._dpr = dpr;
		cv.width = Math.round(global.innerWidth * dpr);
		cv.height = Math.round(global.innerHeight * dpr);
		cv.style.width = global.innerWidth + "px";
		cv.style.height = global.innerHeight + "px";
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	};

	LoveBits.prototype._resize = function () {
		if (this.weatherCanvas) this._sizeCanvas(this.weatherCanvas, this.weatherCtx);
		if (this.ropeCanvas) this._sizeCanvas(this.ropeCanvas, this.ropeCtx);
	};

	LoveBits.prototype._run = function () {
		if (this._raf) return;
		this._last = 0;
		this._raf = requestAnimationFrame(this._frame);
	};

	// One loop drives both the weather and the string.
	LoveBits.prototype._frame = function (now) {
		this._raf = 0;
		var dt = this._last ? Math.min(0.05, (now - this._last) / 1000) : 0.016;
		this._last = now;
		var busy = false;
		if (this.weatherCanvas) { this._drawWeather(dt, now / 1000); busy = true; }
		if (this.partner && this.ropeCanvas) { this._stepRope(dt); busy = true; }
		if (busy) this._raf = requestAnimationFrame(this._frame);
	};

	// ---- heart string (verlet rope) -------------------------------------

	LoveBits.prototype._ensureLayer = function () {
		if (this.layer && this.layer.parentNode) return this.layer;
		var layer = el("div", "love-layer");
		layer.setAttribute("aria-hidden", "true");
		document.body.appendChild(layer);
		this.layer = layer;
		return layer;
	};

	LoveBits.prototype._makeRope = function () {
		var layer = this._ensureLayer();
		if (!this.ropeCanvas) {
			var cv = el("canvas", "love-rope");
			layer.insertBefore(cv, layer.firstChild);
			this.ropeCanvas = cv;
			this.ropeCtx = cv.getContext("2d");
			this._sizeCanvas(cv, this.ropeCtx);
		}
		if (!this.knot) {
			var self = this;
			var k = el("button", "love-knot");
			k.type = "button";
			k.title = "Tap to fill the love meter";
			k.setAttribute("aria-label", "Love meter");
			var fill = el("span", "love-knot-fill", "❤️");
			var pct = el("span", "love-knot-pct");
			k.appendChild(el("span", "love-knot-back", "🤍"));
			k.appendChild(fill);
			k.appendChild(pct);
			k.addEventListener("click", function (e) {
				e.preventDefault();
				e.stopPropagation();
				self.tapHeart();
			});
			layer.appendChild(k);
			this.knot = k;
			this.knotFill = fill;
			this.knotPct = pct;
		}
		this.rope = null; // rebuilt from the cursors on the next frame
		this.ropeCanvas.style.display = "";
		this.knot.style.display = "none";
		this._paintMeter();
		this._run();
	};

	LoveBits.prototype._clearRope = function () {
		if (!this.ropeCanvas) return;
		this.ropeCtx.setTransform(1, 0, 0, 1, 0, 0);
		this.ropeCtx.clearRect(0, 0, this.ropeCanvas.width, this.ropeCanvas.height);
	};

	LoveBits.prototype._dropRope = function () {
		this.rope = null;
		this._clearRope();
		if (this.ropeCanvas) this.ropeCanvas.style.display = "none";
		if (this.knot) this.knot.style.display = "none";
	};

	LoveBits.prototype._stepRope = function (dt) {
		var A = this._pos(this._myId(), dt);
		var B = this._pos(this.partner, dt);
		if (!A || !B) {
			// They'll show up once their cursor moves — hide until then.
			if (this.rope) { this._clearRope(); this.knot.style.display = "none"; }
			this.rope = null;
			return;
		}
		var pts = this.rope && this.rope.pts;
		if (!pts) {
			pts = [];
			for (var i = 0; i < ROPE_N; i++) {
				var f = i / (ROPE_N - 1);
				var x = A.x + (B.x - A.x) * f, y = A.y + (B.y - A.y) * f;
				pts.push({ x: x, y: y, px: x, py: y });
			}
			this.rope = { pts: pts, seg: 0 };
			this.knot.style.display = "";
		}
		var dx = B.x - A.x, dy = B.y - A.y;
		var dist = Math.sqrt(dx * dx + dy * dy);
		// Rope length follows the distance (so it never goes taut), with a
		// little extra that droops and swings.
		var want = Math.max(dist * ROPE_SLACK, dist + 26, 40) / (ROPE_N - 1);
		this.rope.seg = this.rope.seg ? this.rope.seg + (want - this.rope.seg) * Math.min(1, dt * 6) : want;

		this._acc = Math.min(this._acc + dt, 0.05);
		while (this._acc >= ROPE_STEP) {
			this._acc -= ROPE_STEP;
			this._verlet(pts, A, B, this.rope.seg, ROPE_STEP);
		}
		this._drawRope(pts);

		var mid = pts[Math.floor(ROPE_N / 2)];
		this.knot.style.transform = "translate3d(" + mid.x.toFixed(1) + "px," + mid.y.toFixed(1) + "px,0) translate(-50%,-50%)";

		this._checkTouch(dist);
	};

	LoveBits.prototype._verlet = function (pts, A, B, seg, h) {
		var n = pts.length, i, p;
		var g = ROPE_GRAVITY * h * h;
		for (i = 1; i < n - 1; i++) {
			p = pts[i];
			var vx = (p.x - p.px) * ROPE_DAMP, vy = (p.y - p.py) * ROPE_DAMP;
			p.px = p.x; p.py = p.y;
			p.x += vx;
			p.y += vy + g;
		}
		var a0 = pts[0], an = pts[n - 1];
		a0.x = a0.px = A.x; a0.y = a0.py = A.y;
		an.x = an.px = B.x; an.y = an.py = B.y;
		for (var it = 0; it < ROPE_ITER; it++) {
			for (i = 0; i < n - 1; i++) {
				var a = pts[i], b = pts[i + 1];
				var ddx = b.x - a.x, ddy = b.y - a.y;
				var dd = Math.sqrt(ddx * ddx + ddy * ddy) || 0.0001;
				var diff = (dd - seg) / dd;
				// Ends are pinned to the cursors; inner points share the correction.
				var wa = i === 0 ? 0 : (i + 1 === n - 1 ? 1 : 0.5);
				var wb = i + 1 === n - 1 ? 0 : (i === 0 ? 1 : 0.5);
				a.x += ddx * diff * wa; a.y += ddy * diff * wa;
				b.x -= ddx * diff * wb; b.y -= ddy * diff * wb;
			}
		}
	};

	LoveBits.prototype._tracePath = function (ctx, pts) {
		ctx.beginPath();
		ctx.moveTo(pts[0].x, pts[0].y);
		for (var i = 1; i < pts.length - 1; i++) {
			var mx = (pts[i].x + pts[i + 1].x) / 2, my = (pts[i].y + pts[i + 1].y) / 2;
			ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
		}
		var l = pts[pts.length - 1];
		ctx.lineTo(l.x, l.y);
	};

	LoveBits.prototype._drawRope = function (pts) {
		var ctx = this.ropeCtx;
		var W = global.innerWidth, H = global.innerHeight;
		ctx.setTransform(this._dpr, 0, 0, this._dpr, 0, 0);
		ctx.clearRect(0, 0, W, H);
		ctx.lineCap = "round";
		ctx.lineJoin = "round";
		this._tracePath(ctx, pts);
		// soft glow
		ctx.strokeStyle = "rgba(255, 90, 150, 0.22)";
		ctx.lineWidth = 9;
		ctx.stroke();
		// the string
		var a = pts[0], b = pts[pts.length - 1];
		var grd = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
		grd.addColorStop(0, "#ff5a92");
		grd.addColorStop(0.5, "#ff2d6f");
		grd.addColorStop(1, "#ff5a92");
		ctx.strokeStyle = grd;
		ctx.lineWidth = 3;
		ctx.stroke();
		// shine
		ctx.save();
		ctx.translate(0, -0.8);
		ctx.strokeStyle = "rgba(255, 225, 238, 0.7)";
		ctx.lineWidth = 1;
		ctx.stroke();
		ctx.restore();
		// little hearts along the string
		ctx.fillStyle = "#ff3d7f";
		var spots = [Math.floor(ROPE_N * 0.25), Math.floor(ROPE_N * 0.75)];
		for (var s = 0; s < spots.length; s++) {
			var p = pts[spots[s]], q = pts[spots[s] + 1];
			this._heart(ctx, p.x, p.y, 6, Math.atan2(q.y - p.y, q.x - p.x) * 0.3);
		}
		// tiny hearts where it's tied to each cursor
		this._heart(ctx, a.x, a.y + 1, 4.5, 0);
		this._heart(ctx, b.x, b.y + 1, 4.5, 0);
	};

	LoveBits.prototype._heart = function (ctx, x, y, s, rot) {
		ctx.save();
		ctx.translate(x, y);
		ctx.rotate(rot || 0);
		ctx.beginPath();
		ctx.moveTo(0, s * 0.9);
		ctx.bezierCurveTo(-s * 1.6, -s * 0.1, -s * 0.8, -s * 1.3, 0, -s * 0.45);
		ctx.bezierCurveTo(s * 0.8, -s * 1.3, s * 1.6, -s * 0.1, 0, s * 0.9);
		ctx.fill();
		ctx.restore();
	};

	// ---- touching cursors = kiss ----------------------------------------

	LoveBits.prototype._checkTouch = function (dist) {
		if (dist > TOUCH_OUT) { this.touchArmed = true; return; }
		if (!this.touchArmed || dist > TOUCH_IN) return;
		this.touchArmed = false;
		// Only one of the two screens decides, so each touch counts once.
		if (String(this._myId()) > String(this.partner)) return;
		var now = Date.now();
		if (now - this.lastTouchAt < TOUCH_COOLDOWN_MS) return;
		this.lastTouchAt = now;
		this._send("t");
		this._touchKiss();
	};

	LoveBits.prototype._touchKiss = function () {
		var A = this._pos(this._myId()), B = this.partner ? this._pos(this.partner) : null;
		var at = A && B ? { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 } : (A || B);
		if (at) this._pop(at.x, at.y, "💋", 34, 6);
		this._sound("kiss", 0.45);
		this._addMeter(PTS_TOUCH);
	};

	// ---- love meter -----------------------------------------------------

	LoveBits.prototype._loadMeter = function () {
		try { return Math.max(0, Math.min(99, parseInt(localStorage.getItem(METER_KEY + this.channelId), 10) || 0)); } catch (e) { return 0; }
	};

	LoveBits.prototype._saveMeter = function () {
		try { localStorage.setItem(METER_KEY + this.channelId, String(this.meter)); } catch (e) {}
	};

	LoveBits.prototype.tapHeart = function () {
		if (!this.partner) return;
		var now = Date.now();
		if (now - this.lastTapAt < TAP_COOLDOWN_MS) return;
		this.lastTapAt = now;
		this._send("m");
		this._addMeter(PTS_TAP);
		if (this.knot) {
			var r = this.knot.getBoundingClientRect();
			this._pop(r.left + r.width / 2, r.top + r.height / 2, null, 0, 4);
		}
		this._sound("pop", 0.35);
	};

	LoveBits.prototype._addMeter = function (amount) {
		this.meter += amount;
		var full = this.meter >= 100;
		if (full) this.meter -= 100;
		this._saveMeter();
		this._paintMeter();
		if (this.knot) {
			this.knot.classList.remove("is-pulse");
			void this.knot.offsetWidth;
			this.knot.classList.add("is-pulse");
		}
		if (full) this._bigHeart();
	};

	LoveBits.prototype._paintMeter = function () {
		var pct = Math.round(this.meter);
		if (this.knotFill) {
			var clip = "inset(" + (100 - pct) + "% 0 0 0)";
			this.knotFill.style.clipPath = clip;
			this.knotFill.style.webkitClipPath = clip;
			this.knotPct.textContent = pct + "%";
		}
		if (!this.dialog) return;
		var box = this.dialog.querySelector(".love-meter");
		if (!box) return;
		var fill = box.querySelector(".love-meter-fill");
		if (fill) fill.style.width = pct + "%";
		var num = box.querySelector(".love-meter-pct");
		if (num) num.textContent = pct + "%";
		var bar = box.querySelector(".love-meter-bar");
		if (bar) bar.setAttribute("aria-valuenow", String(pct));
	};

	LoveBits.prototype._bigHeart = function () {
		var layer = this._ensureLayer();
		var box = el("div", "love-burst");
		box.appendChild(el("div", "love-burst-glow"));
		box.appendChild(el("span", "love-burst-heart", "💖"));
		box.appendChild(el("div", "love-burst-flash"));
		var n = reducedMotion() ? 10 : 40;
		var bits = ["💖", "💕", "💗", "💘", "❤️", "💞"];
		for (var i = 0; i < n; i++) {
			var ang = (i / n) * Math.PI * 2 + Math.random() * 0.4;
			var dist = 300 + Math.random() * 600;
			var s = el("span", "love-burst-bit", bits[i % bits.length]);
			s.style.setProperty("--dx", Math.round(Math.cos(ang) * dist) + "px");
			s.style.setProperty("--dy", Math.round(Math.sin(ang) * dist) + "px");
			s.style.setProperty("--sz", (24 + Math.random() * 36).toFixed(0) + "px");
			// bits fly out when the screen-filling heart pops (~9.5s in)
			s.style.animationDelay = (9.5 + Math.random() * 0.2).toFixed(2) + "s";
			box.appendChild(s);
		}
		layer.appendChild(box);
		this._sound("lovekiss");
		this._burstSong();
		var self = this;
		setTimeout(function () { self._sound("pop"); }, 9500);
		this._later(box, 11500);
	};

	// ---- blow a kiss ----------------------------------------------------

	LoveBits.prototype._canSend = function () {
		var now = Date.now();
		if (!this.partner || now - this.lastSentAt < SEND_COOLDOWN_MS) return false;
		this.lastSentAt = now;
		return true;
	};

	LoveBits.prototype.blowKiss = function () {
		if (!this._canSend()) return;
		var seed = Math.floor(Math.random() * 2147483647) + 1;
		this._send("b|" + seed);
		if (this.closeModal) this.closeModal();
		this._showKiss(this._myId(), this.partner, seed);
	};

	LoveBits.prototype._showKiss = function (from, to, seed) {
		var layer = this._ensureLayer();
		var r = rng(seed);
		var W = global.innerWidth, H = global.innerHeight;
		var s0 = this._pos(from) || { x: W / 2, y: H + 40 };
		var start = { x: s0.x, y: s0.y };
		var self = this;
		var kiss = el("span", "love-flykiss", "😘");
		layer.appendChild(kiss);
		var arc = (r() < 0.5 ? -1 : 1) * (60 + r() * 100);
		var dur = reducedMotion() ? 700 : 1300;
		var t0 = 0, lastTrail = 0;
		this._sound("mwah");

		function step(now) {
			if (!t0) t0 = now;
			var k = Math.min(1, (now - t0) / dur);
			var end = self._pos(to) || { x: W / 2, y: H / 2 };
			var e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
			var cx = (start.x + end.x) / 2 + arc * 0.4, cy = (start.y + end.y) / 2 - Math.abs(arc);
			var x = (1 - e) * (1 - e) * start.x + 2 * (1 - e) * e * cx + e * e * end.x;
			var y = (1 - e) * (1 - e) * start.y + 2 * (1 - e) * e * cy + e * e * end.y;
			var sc = 0.6 + Math.sin(k * Math.PI) * 0.8;
			kiss.style.transform = "translate3d(" + x.toFixed(1) + "px," + y.toFixed(1) + "px,0) translate(-50%,-50%) scale(" + sc.toFixed(2) + ") rotate(" + Math.round(Math.sin(k * 8) * 12) + "deg)";
			if (now - lastTrail > 90 && k < 0.92) {
				lastTrail = now;
				var tr = el("span", "love-trail", r() < 0.7 ? "💕" : "✨");
				tr.style.transform = "translate3d(" + x.toFixed(0) + "px," + y.toFixed(0) + "px,0) translate(-50%,-50%)";
				layer.appendChild(tr);
				self._later(tr, 800);
			}
			if (k < 1) { requestAnimationFrame(step); return; }
			if (kiss.parentNode) kiss.parentNode.removeChild(kiss);
			self._pop(end.x, end.y, "💋", 50, 10);
			self._sound("kiss");
			if (to === self._myId()) {
				document.body.classList.remove("love-got-kiss");
				void document.body.offsetWidth;
				document.body.classList.add("love-got-kiss");
				setTimeout(function () { document.body.classList.remove("love-got-kiss"); }, 1000);
			}
			self._addMeter(PTS_KISS);
		}
		requestAnimationFrame(step);
	};

	// A stamp plus a ring of little hearts.
	LoveBits.prototype._pop = function (x, y, stamp, size, hearts) {
		var layer = this._ensureLayer();
		var box = el("div", "love-pop");
		box.style.transform = "translate3d(" + x.toFixed(0) + "px," + y.toFixed(0) + "px,0)";
		if (stamp) {
			var st = el("span", "love-stamp", stamp);
			st.style.fontSize = size + "px";
			box.appendChild(st);
		}
		for (var i = 0; i < hearts; i++) {
			var ang = (i / hearts) * Math.PI * 2 + Math.random() * 0.5;
			var d = 30 + Math.random() * 30;
			var b = el("span", "love-spark", i % 2 ? "💗" : "💖");
			b.style.setProperty("--dx", Math.round(Math.cos(ang) * d) + "px");
			b.style.setProperty("--dy", Math.round(Math.sin(ang) * d - 10) + "px");
			box.appendChild(b);
		}
		layer.appendChild(box);
		this._later(box, stamp ? 1400 : 800);
	};

	// ---- hug ------------------------------------------------------------

	var HUG_SVG =
		'<svg class="love-hug-svg" viewBox="0 0 240 170" aria-hidden="true">' +
		'<defs>' +
		'<radialGradient id="lhPink" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#ffe3ec"/><stop offset="1" stop-color="#ffa3c0"/></radialGradient>' +
		'<radialGradient id="lhCream" cx="60%" cy="35%" r="70%"><stop offset="0" stop-color="#fffaf3"/><stop offset="1" stop-color="#f1d6ba"/></radialGradient>' +
		'</defs>' +
		'<ellipse class="lh-shadow" cx="120" cy="160" rx="96" ry="8"/>' +
		'<g class="lh-squeeze">' +
		'<g class="lh-left">' +
		'<ellipse cx="54" cy="62" rx="11" ry="17" fill="#ffa3c0" transform="rotate(-20 54 62)"/>' +
		'<ellipse cx="96" cy="56" rx="11" ry="17" fill="#ffa3c0" transform="rotate(14 96 56)"/>' +
		'<ellipse cx="84" cy="106" rx="58" ry="52" fill="url(#lhPink)"/>' +
		'<path d="M84 98 q6 -7 12 0" class="lh-eye"/><path d="M106 98 q6 -7 12 0" class="lh-eye"/>' +
		'<ellipse cx="84" cy="112" rx="8" ry="5" class="lh-blush"/><ellipse cx="118" cy="112" rx="8" ry="5" class="lh-blush"/>' +
		'<path d="M97 112 q4 4 8 0" class="lh-mouth"/>' +
		'</g>' +
		'<g class="lh-right">' +
		'<ellipse cx="144" cy="56" rx="11" ry="17" fill="#f1d6ba" transform="rotate(-14 144 56)"/>' +
		'<ellipse cx="186" cy="62" rx="11" ry="17" fill="#f1d6ba" transform="rotate(20 186 62)"/>' +
		'<ellipse cx="156" cy="106" rx="58" ry="52" fill="url(#lhCream)"/>' +
		'<path d="M122 98 q6 -7 12 0" class="lh-eye"/><path d="M144 98 q6 -7 12 0" class="lh-eye"/>' +
		'<ellipse cx="122" cy="112" rx="8" ry="5" class="lh-blush"/><ellipse cx="156" cy="112" rx="8" ry="5" class="lh-blush"/>' +
		'<path d="M135 112 q4 4 8 0" class="lh-mouth"/>' +
		'</g>' +
		'<g class="lh-arm lh-arm-l"><ellipse cx="150" cy="132" rx="26" ry="11" fill="#ffb6cb" transform="rotate(-12 150 132)"/></g>' +
		'<g class="lh-arm lh-arm-r"><ellipse cx="90" cy="134" rx="26" ry="11" fill="#f6e0c9" transform="rotate(12 90 134)"/></g>' +
		'</g>' +
		'<g class="lh-hearts">' +
		'<path class="lh-h lh-h1" d="M120 40 c-6 -8 -18 -4 -16 6 c1 6 9 10 16 16 c7 -6 15 -10 16 -16 c2 -10 -10 -14 -16 -6z"/>' +
		'<path class="lh-h lh-h2" d="M90 30 c-4 -5 -12 -3 -11 4 c1 4 6 7 11 11 c5 -4 10 -7 11 -11 c1 -7 -7 -9 -11 -4z"/>' +
		'<path class="lh-h lh-h3" d="M152 26 c-4 -5 -12 -3 -11 4 c1 4 6 7 11 11 c5 -4 10 -7 11 -11 c1 -7 -7 -9 -11 -4z"/>' +
		'</g>' +
		'</svg>';

	LoveBits.prototype.hug = function () {
		if (!this._canSend()) return;
		this._send("h");
		if (this.closeModal) this.closeModal();
		this._showHug();
	};

	LoveBits.prototype._showHug = function () {
		var layer = this._ensureLayer();
		var W = global.innerWidth, H = global.innerHeight;
		var A = this._pos(this._myId()), B = this.partner ? this._pos(this.partner) : null;
		var at = A && B ? { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 } : { x: W / 2, y: H / 2 };
		at.x = Math.max(110, Math.min(W - 110, at.x));
		at.y = Math.max(100, Math.min(H - 90, at.y));
		var hug = el("div", "love-hug");
		hug.style.transform = "translate3d(" + at.x.toFixed(0) + "px," + at.y.toFixed(0) + "px,0)";
		hug.innerHTML = HUG_SVG;
		layer.appendChild(hug);
		this._later(hug, 3000);
		this._sound("chirp");
		var self = this;
		setTimeout(function () { self._sound("lovekiss", 0.5); }, 650);
		this._addMeter(PTS_HUG);
	};

	// ---- receiving ------------------------------------------------------

	LoveBits.prototype.tryHandleChat = function (msg) {
		var text = msg.a != null ? msg.a : (msg.message != null ? msg.message : "");
		if (!LoveBits.isSyncText(text)) return false;
		var parts = text.slice(SYNC_PREFIX.length).split("|");
		var from = parts[0];
		var cmd = parts[1];
		var myId = this._myId();
		if (!from || from === myId) return true;
		var fromPartner = !!this.partner && from === this.partner;

		if (cmd === "w") {
			this._setWeather(parts[2], parseInt(parts[3], 10) || 1, parseInt(parts[4], 10) || Date.now());
			this._renderPanel();
		} else if (cmd === "q") {
			this._replyState();
		} else if (cmd === "s") {
			this._mergeState(parts.slice(2).join("|"));
		} else if (cmd === "b" && fromPartner) {
			this._showKiss(from, myId, parseInt(parts[2], 10) || 1);
		} else if (cmd === "h" && fromPartner) {
			this._showHug();
		} else if (cmd === "t" && fromPartner) {
			this._touchKiss();
		} else if (cmd === "m" && fromPartner) {
			this._addMeter(PTS_TAP);
		}
		return true;
	};

	LoveBits.prototype._replyState = function () {
		var state = { w: this.weather, ws: this.weatherSeed, wt: this.weatherTs, m: Math.round(this.meter) };
		var self = this;
		setTimeout(function () { self._send("s|" + JSON.stringify(state)); }, 150 + Math.random() * 500);
	};

	LoveBits.prototype._mergeState = function (json) {
		var st;
		try { st = JSON.parse(json); } catch (e) { return; }
		if (!st || typeof st !== "object") return;
		if (typeof st.w === "string" && (Number(st.wt) || 0) > this.weatherTs) {
			this._setWeather(st.w, Number(st.ws) || 1, Number(st.wt) || 0);
		}
		var m = Math.max(0, Math.min(99, Number(st.m) || 0));
		if (m > this.meter) {
			this.meter = m;
			this._saveMeter();
			this._paintMeter();
		}
		this._renderPanel();
	};

	// ---- helpers --------------------------------------------------------

	LoveBits.prototype._sound = function (name, gain) {
		if (this.soundOn && typeof global.funSound === "function") global.funSound(name, gain ? { gain: gain } : undefined);
	};

	// mm.mp3 plays 5 times back to back (~10s) while the big heart grows and bursts.
	var BURST_SONG_PLAYS = 5;
	LoveBits.prototype._burstSong = function () {
		if (!this.soundOn || typeof global.Audio !== "function") return;
		try {
			var self = this;
			if (!this._burstAudio) {
				this._burstAudio = new Audio("mm.mp3");
				this._burstAudio.preload = "auto";
				this._burstAudio.volume = 0.8;
				this._burstAudio.addEventListener("ended", function () {
					if (--self._burstPlaysLeft > 0 && self.soundOn) {
						self._burstAudio.currentTime = 0;
						var q = self._burstAudio.play();
						if (q && typeof q.catch === "function") q.catch(function () {});
					}
				});
			}
			var a = this._burstAudio;
			this._burstPlaysLeft = BURST_SONG_PLAYS;
			a.currentTime = 0;
			var p = a.play();
			if (p && typeof p.catch === "function") p.catch(function () {});
		} catch (e) {}
	};

	LoveBits.prototype._later = function (node, ms) {
		setTimeout(function () { if (node.parentNode) node.parentNode.removeChild(node); }, ms);
	};

	global.LoveBits = LoveBits;
})(typeof window !== "undefined" ? window : this);
