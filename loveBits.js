/**
 * LoveBits — little romantic extras for two people in the room.
 *
 *   • Room Weather   — cherry blossoms, snow, rain or fireflies; everyone sees it.
 *   • Heart String   — two people agree to link; a red string ties their cursors
 *                      together on every screen, with a heart in the middle.
 *   • Love Meter     — that heart fills up with blown kisses, hugs and taps.
 *                      When it hits 100% a giant heart bursts on every screen.
 *   • Blow a Kiss    — a 😘 flies from your cursor and lands on theirs.
 *
 * Synced over the Harmony room relay. People are addressed by MPP `_id`
 * (the relay only carries `_id` + `name`).
 *
 * Protocol (relay text, "LV|" prefixed; sender = msg.p._id):
 *   LV|w|type|seed|ts     set room weather (type: none/sakura/snow/rain/fireflies)
 *   LV|q                  "what's the state?" — sent after joining a room
 *   LV|s|{json}           state reply: { w, ws, wt, links: [[a, b, meter]] }
 *   LV|lr|target          ask `target` to tie a heart string with the sender
 *   LV|la|requester       accept -> everyone links sender + requester
 *   LV|ld|requester       decline
 *   LV|lu|other           untie sender + other
 *   LV|b|target|seed      blow a kiss at `target`
 *   LV|h|target           hug `target`
 *   LV|m|pairKey|amount   tap the heart on a string (fills the meter)
 */
(function (global) {
	"use strict";

	var SYNC_PREFIX = "LV|";
	var SOUND_KEY = "harmonyLoveSound";
	var WEATHER_VIEW_KEY = "harmonyLoveWeatherView";
	var WEATHERS = [
		{ id: "none", emoji: "☀️", label: "Clear" },
		{ id: "sakura", emoji: "🌸", label: "Blossoms" },
		{ id: "snow", emoji: "❄️", label: "Snow" },
		{ id: "rain", emoji: "🌧️", label: "Rain" },
		{ id: "fireflies", emoji: "✨", label: "Fireflies" }
	];
	var WEATHER_BY_ID = {};
	for (var wi = 0; wi < WEATHERS.length; wi++) WEATHER_BY_ID[WEATHERS[wi].id] = WEATHERS[wi];

	var METER_KISS = 12;
	var METER_HUG = 10;
	var METER_TAP = 3;
	var SEND_COOLDOWN_MS = 800;
	var TAP_COOLDOWN_MS = 180;
	var REQUEST_COOLDOWN_MS = 5000;
	var REQUEST_LIFE_MS = 20000;

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

	function pairKey(a, b) {
		return a < b ? a + "~" + b : b + "~" + a;
	}

	function reducedMotion() {
		try { return !!(global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) { return false; }
	}

	function LoveBits(opts) {
		opts = opts || {};
		this.client = opts.client;
		this.openModal = opts.openModal || null;
		this.closeModal = opts.closeModal || null;

		this.weather = "none";
		this.weatherSeed = 1;
		this.weatherTs = 0;
		this.links = {}; // pairKey -> { a, b, meter }
		this.channelId = null;
		this.lastSentAt = 0;
		this.lastTapAt = 0;
		this.lastRequestAt = 0;
		this.pendingOut = null; // _id we asked
		this.requestToasts = {}; // requester _id -> toast node

		this.soundOn = true;
		this.weatherView = true;
		try {
			this.soundOn = !(global.localStorage && localStorage.getItem(SOUND_KEY) === "0");
			this.weatherView = !(global.localStorage && localStorage.getItem(WEATHER_VIEW_KEY) === "0");
		} catch (e) {}

		this.layer = null;
		this.svg = null;
		this.stringEls = {}; // pairKey -> { path, glow, heart, fill, pct }
		this._raf = 0;
		this._tick = this._tick.bind(this);

		this.weatherCanvas = null;
		this.weatherParts = [];
		this._wRaf = 0;
		this._wLast = 0;
		this._weatherTick = this._weatherTick.bind(this);
		this._onResize = this._onResize.bind(this);
		global.addEventListener("resize", this._onResize);

		this._bindUi();
		this._bindClient();
	}

	LoveBits.SYNC_PREFIX = SYNC_PREFIX;

	LoveBits.isSyncText = function (text) {
		return !!(text && typeof text === "string" && text.indexOf(SYNC_PREFIX) === 0);
	};

	// ---- people ---------------------------------------------------------

	LoveBits.prototype._me = function () {
		return (this.client && this.client.getOwnParticipant && this.client.getOwnParticipant()) || null;
	};

	LoveBits.prototype._myId = function () {
		var me = this._me();
		return (me && me._id) || "";
	};

	LoveBits.prototype._isFake = function (p) {
		var C = global.Client;
		if (!p || !p._id) return true;
		if (C && C.isLobbyNoobParticipant && C.isLobbyNoobParticipant(p)) return true;
		if (C && C.isMybotAnonymousParticipant && C.isMybotAnonymousParticipant(p)) return true;
		return false;
	};

	LoveBits.prototype._part = function (_id) {
		if (!_id || !this.client || !this.client.findParticipantByUnderscoreId) return null;
		return this.client.findParticipantByUnderscoreId(_id);
	};

	LoveBits.prototype._name = function (_id) {
		if (_id && _id === this._myId()) return "You";
		var p = this._part(_id);
		return (p && p.name) || "Someone";
	};

	LoveBits.prototype._color = function (_id) {
		var p = this._part(_id);
		return (p && p.color) || "";
	};

	// Screen position of someone's cursor (MPP sends x/y as % of the window).
	LoveBits.prototype._pos = function (_id) {
		var p = this._part(_id);
		if (!p) return null;
		var x = parseFloat(p.x), y = parseFloat(p.y);
		if (!isFinite(x) || !isFinite(y)) {
			if (p.cursorDiv) {
				x = parseFloat(p.cursorDiv.style.left);
				y = parseFloat(p.cursorDiv.style.top);
			}
		}
		if (!isFinite(x) || !isFinite(y)) return null;
		return { x: x / 100 * global.innerWidth, y: y / 100 * global.innerHeight };
	};

	LoveBits.prototype._partnerOf = function (_id) {
		for (var k in this.links) {
			if (!this.links.hasOwnProperty(k)) continue;
			var l = this.links[k];
			if (l.a === _id) return l.b;
			if (l.b === _id) return l.a;
		}
		return "";
	};

	// ---- client wiring --------------------------------------------------

	LoveBits.prototype._bindClient = function () {
		var self = this;
		var c = this.client;
		if (!c || !c.on) return;
		function onChannel() {
			var id = c.channel && c.channel._id;
			if (!id || id === self.channelId) return;
			self.channelId = id;
			self._resetRoom();
			setTimeout(function () { self._send("q"); }, 900 + Math.random() * 400);
		}
		c.on("ch", onChannel);
		onChannel(); // in case we were created after joining
		c.on("participant removed", function (part) {
			if (!part || !part._id) return;
			// Same _id may still be here in another tab.
			if (self._part(part._id)) return;
			var changed = false;
			for (var k in self.links) {
				if (self.links.hasOwnProperty(k) && (self.links[k].a === part._id || self.links[k].b === part._id)) {
					self._removeLink(k);
					changed = true;
				}
			}
			if (self.pendingOut === part._id) self.pendingOut = null;
			self._dismissRequest(part._id);
			if (changed || self._isOpen()) self._renderPanel();
		});
		c.on("participant added", function () { if (self._isOpen()) self._renderPeople(); });
	};

	LoveBits.prototype._resetRoom = function () {
		for (var k in this.links) if (this.links.hasOwnProperty(k)) this._removeLink(k);
		for (var r in this.requestToasts) if (this.requestToasts.hasOwnProperty(r)) this._dismissRequest(r);
		this.pendingOut = null;
		this._setWeather("none", 1, 0);
	};

	LoveBits.prototype._send = function (body) {
		return !!(this.client && this.client.broadcastRoom && this.client.broadcastRoom(SYNC_PREFIX + body));
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
		this.status = dlg.querySelector(".love-status");
		this.select = dlg.querySelector(".love-person");
		this.meterBox = dlg.querySelector(".love-meter");

		var wGrid = dlg.querySelector(".love-weather-grid");
		if (wGrid && !wGrid.childNodes.length) {
			WEATHERS.forEach(function (w) {
				var b = el("button", "love-weather-opt");
				b.type = "button";
				b.setAttribute("data-weather", w.id);
				b.setAttribute("aria-pressed", "false");
				b.title = w.id === "none" ? "Clear the sky for everyone" : w.label + " for everyone in the room";
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
				var who = self.select ? self.select.value : "";
				var a = act.getAttribute("data-love-act");
				if (a === "kiss") self.blowKiss(who);
				else if (a === "hug") self.hug(who);
				else if (a === "link") self.requestLink(who);
				else if (a === "unlink") self.unlink();
				return;
			}
			if (t.closest && t.closest(".love-close")) {
				e.preventDefault();
				if (self.closeModal) self.closeModal();
			}
		});
		if (this.select) this.select.addEventListener("change", function () { self._renderActions(); });

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

	LoveBits.prototype._isOpen = function () {
		var modal = document.getElementById("modal");
		if (!this.dialog || !modal) return false;
		return global.getComputedStyle(modal).display !== "none" && global.getComputedStyle(this.dialog).display !== "none";
	};

	LoveBits.prototype.open = function () {
		this._say("");
		this._renderPanel();
		if (this.openModal) this.openModal("#love-panel", ".love-person");
	};

	LoveBits.prototype._say = function (text) {
		if (this.status) this.status.textContent = text || "";
	};

	LoveBits.prototype._renderPanel = function () {
		if (!this.dialog) return;
		var opts = this.dialog.querySelectorAll(".love-weather-opt");
		for (var i = 0; i < opts.length; i++) {
			var on = opts[i].getAttribute("data-weather") === this.weather;
			opts[i].classList.toggle("is-on", on);
			opts[i].setAttribute("aria-pressed", on ? "true" : "false");
		}
		this._renderPeople();
	};

	LoveBits.prototype._renderPeople = function () {
		var sel = this.select;
		if (!sel) return;
		var myId = this._myId();
		var partner = this._partnerOf(myId);
		var prev = sel.value || partner;
		var seen = {};
		var people = [];
		var ppl = (this.client && this.client.ppl) || {};
		for (var id in ppl) {
			if (!ppl.hasOwnProperty(id)) continue;
			var p = ppl[id];
			if (this._isFake(p) || p._id === myId || seen[p._id]) continue;
			seen[p._id] = 1;
			people.push(p);
		}
		people.sort(function (x, y) { return String(x.name).localeCompare(String(y.name)); });
		while (sel.firstChild) sel.removeChild(sel.firstChild);
		if (!people.length) {
			var none = el("option", null, "Nobody else is here yet 🥺");
			none.value = "";
			sel.appendChild(none);
		}
		for (var j = 0; j < people.length; j++) {
			var o = el("option", null, (people[j]._id === partner ? "💞 " : "") + (people[j].name || "Anonymous"));
			o.value = people[j]._id;
			sel.appendChild(o);
		}
		if (prev && seen[prev]) sel.value = prev;
		sel.disabled = !people.length;
		this._renderActions();
	};

	LoveBits.prototype._renderActions = function () {
		if (!this.dialog) return;
		var myId = this._myId();
		var partner = this._partnerOf(myId);
		var who = this.select ? this.select.value : "";
		var linkBtn = this.dialog.querySelector("[data-love-act='link']");
		var unlinkBtn = this.dialog.querySelector("[data-love-act='unlink']");
		var btns = this.dialog.querySelectorAll("[data-love-act='kiss'], [data-love-act='hug'], [data-love-act='link']");
		for (var i = 0; i < btns.length; i++) btns[i].disabled = !who;
		if (linkBtn) linkBtn.hidden = !!partner;
		if (unlinkBtn) {
			unlinkBtn.hidden = !partner;
			var ul = unlinkBtn.querySelector(".love-act-label");
			if (ul) ul.textContent = "Untie from " + this._name(partner);
		}
		if (linkBtn && this.pendingOut && this.pendingOut === who) linkBtn.disabled = true;

		var box = this.meterBox;
		if (!box) return;
		if (!partner) {
			box.hidden = true;
			return;
		}
		var link = this.links[pairKey(myId, partner)];
		var pct = Math.round(link ? link.meter : 0);
		box.hidden = false;
		var names = box.querySelector(".love-meter-names");
		if (names) names.textContent = "You 💞 " + this._name(partner);
		var fill = box.querySelector(".love-meter-fill");
		if (fill) fill.style.width = pct + "%";
		var num = box.querySelector(".love-meter-pct");
		if (num) num.textContent = pct + "%";
		var bar = box.querySelector(".love-meter-bar");
		if (bar) bar.setAttribute("aria-valuenow", String(pct));
	};

	// ---- weather --------------------------------------------------------

	LoveBits.prototype.sendWeather = function (type) {
		if (!WEATHER_BY_ID[type]) return;
		var seed = Math.floor(Math.random() * 2147483647) + 1;
		var ts = Date.now();
		var ok = this._send("w|" + type + "|" + seed + "|" + ts);
		this._setWeather(type, seed, ts);
		this._renderPanel();
		var w = WEATHER_BY_ID[type];
		if (!ok) this._say("Room sync is offline — only you see the weather.");
		else this._say(type === "none" ? "The sky is clear ☀️" : w.emoji + " " + w.label + " for everyone!");
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
		if (type === "none") {
			if (this._wRaf) cancelAnimationFrame(this._wRaf);
			this._wRaf = 0;
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
			this._onResize();
		}
		this._spawnWeather(type);
		if (!this._wRaf) {
			this._wLast = 0;
			this._wRaf = requestAnimationFrame(this._weatherTick);
		}
	};

	LoveBits.prototype._onResize = function () {
		var cv = this.weatherCanvas;
		if (!cv) return;
		var dpr = Math.min(global.devicePixelRatio || 1, 2);
		cv.width = Math.round(global.innerWidth * dpr);
		cv.height = Math.round(global.innerHeight * dpr);
		cv.style.width = global.innerWidth + "px";
		cv.style.height = global.innerHeight + "px";
		this.weatherCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
	};

	LoveBits.prototype._spawnWeather = function (type) {
		var W = global.innerWidth, H = global.innerHeight;
		var area = Math.max(0.4, Math.min(1.6, (W * H) / (1280 * 720)));
		var base = { sakura: 42, snow: 90, rain: 150, fireflies: 38 }[type] || 0;
		var n = Math.round(base * area * (reducedMotion() ? 0.35 : 1));
		var r = rng(this.weatherSeed);
		var parts = [];
		for (var i = 0; i < n; i++) parts.push(this._newParticle(type, r, true));
		this.weatherParts = parts;
		this.weatherType = type;
		this._rand = r;
	};

	LoveBits.prototype._newParticle = function (type, r, anywhere) {
		var W = global.innerWidth, H = global.innerHeight;
		var p = { x: r() * W, y: anywhere ? r() * H : -20 - r() * 60, ph: r() * Math.PI * 2 };
		if (type === "sakura") {
			p.s = 6 + r() * 7;
			p.vy = 28 + r() * 36;
			p.vx = 10 + r() * 22;
			p.rot = r() * Math.PI * 2;
			p.vr = (r() - 0.5) * 2.4;
			p.hue = r() < 0.7 ? "#ffb7cf" : (r() < 0.5 ? "#ffd3e2" : "#ff9fc0");
		} else if (type === "snow") {
			p.s = 1.4 + r() * 3.4;
			p.vy = 18 + p.s * 12 + r() * 12;
			p.vx = (r() - 0.5) * 14;
			p.a = 0.55 + r() * 0.45;
		} else if (type === "rain") {
			p.len = 10 + r() * 16;
			p.vy = 620 + r() * 380;
			p.vx = -60 - r() * 40;
			p.a = 0.25 + r() * 0.35;
		} else if (type === "fireflies") {
			p.y = anywhere ? H * 0.15 + r() * H * 0.85 : r() * H;
			p.s = 1.6 + r() * 2.2;
			p.vx = (r() - 0.5) * 30;
			p.vy = (r() - 0.5) * 30;
			p.blink = 0.6 + r() * 1.4;
		}
		return p;
	};

	LoveBits.prototype._weatherTick = function (now) {
		this._wRaf = 0;
		var cv = this.weatherCanvas, ctx = this.weatherCtx;
		if (!cv || !ctx) return;
		var dt = this._wLast ? Math.min(0.05, (now - this._wLast) / 1000) : 0.016;
		this._wLast = now;
		var W = global.innerWidth, H = global.innerHeight;
		var type = this.weatherType;
		var r = this._rand || Math.random;
		var t = now / 1000;
		ctx.clearRect(0, 0, W, H);
		if (type === "fireflies") {
			// soft dusk so the glow shows up on light backgrounds
			ctx.fillStyle = "rgba(24, 18, 58, 0.16)";
			ctx.fillRect(0, 0, W, H);
		}
		var parts = this.weatherParts;
		for (var i = 0; i < parts.length; i++) {
			var p = parts[i];
			if (type === "sakura") {
				p.x += (p.vx + Math.sin(t * 1.3 + p.ph) * 18) * dt;
				p.y += p.vy * dt;
				p.rot += p.vr * dt;
				var flip = Math.abs(Math.cos(t * 2 + p.ph)) * 0.7 + 0.3;
				ctx.save();
				ctx.translate(p.x, p.y);
				ctx.rotate(p.rot);
				ctx.scale(1, flip);
				ctx.fillStyle = p.hue;
				ctx.globalAlpha = 0.9;
				ctx.beginPath();
				// petal: a teardrop with a little notch
				ctx.moveTo(0, -p.s);
				ctx.bezierCurveTo(p.s * 0.9, -p.s * 0.6, p.s * 0.7, p.s * 0.8, 0, p.s);
				ctx.bezierCurveTo(-p.s * 0.7, p.s * 0.8, -p.s * 0.9, -p.s * 0.6, 0, -p.s);
				ctx.fill();
				ctx.restore();
				if (p.y > H + 20 || p.x > W + 30) {
					parts[i] = this._newParticle(type, r, false);
					parts[i].x = r() * W * 1.1 - W * 0.1;
				}
			} else if (type === "snow") {
				p.x += (p.vx + Math.sin(t * 0.8 + p.ph) * 10) * dt;
				p.y += p.vy * dt;
				ctx.globalAlpha = p.a;
				ctx.fillStyle = "#ffffff";
				ctx.shadowColor = "rgba(160, 190, 230, 0.9)";
				ctx.shadowBlur = 3;
				ctx.beginPath();
				ctx.arc(p.x, p.y, p.s, 0, Math.PI * 2);
				ctx.fill();
				if (p.y > H + 10) parts[i] = this._newParticle(type, r, false);
			} else if (type === "rain") {
				p.x += p.vx * dt;
				p.y += p.vy * dt;
				ctx.globalAlpha = p.a;
				ctx.strokeStyle = "#8fb4e6";
				ctx.lineWidth = 1.2;
				ctx.beginPath();
				ctx.moveTo(p.x, p.y);
				ctx.lineTo(p.x + p.vx * 0.02, p.y + p.len);
				ctx.stroke();
				if (p.y > H) {
					// tiny splash ring
					ctx.globalAlpha = p.a * 0.8;
					ctx.beginPath();
					ctx.ellipse(p.x, H - 3, 4, 1.4, 0, 0, Math.PI * 2);
					ctx.stroke();
					parts[i] = this._newParticle(type, r, false);
					parts[i].x = r() * (W + 120);
				}
			} else if (type === "fireflies") {
				p.vx += (r() - 0.5) * 40 * dt;
				p.vy += (r() - 0.5) * 40 * dt;
				p.vx = Math.max(-26, Math.min(26, p.vx));
				p.vy = Math.max(-26, Math.min(26, p.vy));
				p.x += p.vx * dt;
				p.y += p.vy * dt;
				if (p.x < -10) p.x = W + 10; else if (p.x > W + 10) p.x = -10;
				if (p.y < -10) p.y = H + 10; else if (p.y > H + 10) p.y = -10;
				var glow = 0.25 + 0.75 * Math.pow(Math.max(0, Math.sin(t * p.blink + p.ph)), 2);
				ctx.globalAlpha = glow;
				ctx.fillStyle = "#fff6a8";
				ctx.shadowColor = "rgba(214, 255, 120, 1)";
				ctx.shadowBlur = 14;
				ctx.beginPath();
				ctx.arc(p.x, p.y, p.s, 0, Math.PI * 2);
				ctx.fill();
			}
		}
		ctx.globalAlpha = 1;
		ctx.shadowBlur = 0;
		this._wRaf = requestAnimationFrame(this._weatherTick);
	};

	// ---- heart string ---------------------------------------------------

	LoveBits.prototype.requestLink = function (target) {
		var myId = this._myId();
		if (!target || !myId) return;
		if (target === myId) return;
		var mine = this._partnerOf(myId);
		if (mine) { this._say("You're already tied to " + this._name(mine) + " 💞"); return; }
		if (this._partnerOf(target)) { this._say(this._name(target) + " is already tied to someone 💔"); return; }
		var now = Date.now();
		if (now - this.lastRequestAt < REQUEST_COOLDOWN_MS) { this._say("Give them a moment to answer 🥺"); return; }
		this.lastRequestAt = now;
		if (!this._send("lr|" + target)) { this._say("Room sync is offline — can't reach them right now."); return; }
		this.pendingOut = target;
		this._renderActions();
		this._say("Asked " + this._name(target) + " to tie a heart string with you… 💌");
		var self = this;
		setTimeout(function () {
			if (self.pendingOut === target) { self.pendingOut = null; self._renderActions(); }
		}, REQUEST_LIFE_MS);
	};

	LoveBits.prototype.unlink = function () {
		var myId = this._myId();
		var partner = this._partnerOf(myId);
		if (!partner) return;
		this._send("lu|" + partner);
		this._removeLink(pairKey(myId, partner));
		this._renderPanel();
		this._say("Untied 💔");
	};

	LoveBits.prototype._addLink = function (a, b, meter) {
		if (!a || !b || a === b) return;
		if (!this._part(a) || !this._part(b)) return;
		var key = pairKey(a, b);
		if (this.links[key]) {
			if (meter != null && meter > this.links[key].meter) this.links[key].meter = meter;
			return;
		}
		// One string per person — a newer link replaces an older one.
		var oa = this._partnerOf(a), ob = this._partnerOf(b);
		if (oa) this._removeLink(pairKey(a, oa));
		if (ob) this._removeLink(pairKey(b, ob));
		this.links[key] = { a: a, b: b, meter: Math.max(0, Math.min(99, meter || 0)) };
		this._ensureLayer();
		var g = document.createElementNS("http://www.w3.org/2000/svg", "g");
		var glow = document.createElementNS("http://www.w3.org/2000/svg", "path");
		glow.setAttribute("class", "love-string-glow");
		var path = document.createElementNS("http://www.w3.org/2000/svg", "path");
		path.setAttribute("class", "love-string");
		g.appendChild(glow);
		g.appendChild(path);
		this.svg.appendChild(g);

		var heart = el("button", "love-knot");
		heart.type = "button";
		var myId = this._myId();
		var mine = a === myId || b === myId;
		heart.classList.toggle("is-mine", mine);
		heart.tabIndex = mine ? 0 : -1;
		heart.title = mine ? "Tap to fill your love meter 💖" : this._name(a) + " 💞 " + this._name(b);
		heart.setAttribute("aria-label", mine ? "Fill your love meter" : "Love meter of " + this._name(a) + " and " + this._name(b));
		var back = el("span", "love-knot-back", "🤍");
		var fill = el("span", "love-knot-fill", "❤️");
		var pct = el("span", "love-knot-pct");
		back.setAttribute("aria-hidden", "true");
		fill.setAttribute("aria-hidden", "true");
		heart.appendChild(back);
		heart.appendChild(fill);
		heart.appendChild(pct);
		var self = this;
		heart.addEventListener("click", function (e) {
			e.preventDefault();
			e.stopPropagation();
			if (mine) self.tapHeart(key);
		});
		this.layer.appendChild(heart);
		this.stringEls[key] = { g: g, path: path, glow: glow, heart: heart, fill: fill, pct: pct };
		this._paintMeter(key);
		if (!this._raf) this._raf = requestAnimationFrame(this._tick);
	};

	LoveBits.prototype._removeLink = function (key) {
		var els = this.stringEls[key];
		if (els) {
			if (els.g.parentNode) els.g.parentNode.removeChild(els.g);
			if (els.heart.parentNode) els.heart.parentNode.removeChild(els.heart);
		}
		delete this.stringEls[key];
		delete this.links[key];
	};

	LoveBits.prototype._ensureLayer = function () {
		if (this.layer && this.layer.parentNode) return this.layer;
		var layer = el("div", "love-layer");
		layer.setAttribute("aria-live", "polite");
		var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
		svg.setAttribute("class", "love-strings");
		svg.setAttribute("aria-hidden", "true");
		layer.appendChild(svg);
		document.body.appendChild(layer);
		this.layer = layer;
		this.svg = svg;
		return layer;
	};

	LoveBits.prototype._tick = function (now) {
		this._raf = 0;
		var any = false;
		var t = now / 1000;
		for (var key in this.links) {
			if (!this.links.hasOwnProperty(key)) continue;
			any = true;
			var l = this.links[key], els = this.stringEls[key];
			if (!els) continue;
			var A = this._pos(l.a), B = this._pos(l.b);
			var show = !!(A && B);
			els.g.style.display = show ? "" : "none";
			els.heart.style.display = show ? "" : "none";
			if (!show) continue;
			var dx = B.x - A.x, dy = B.y - A.y;
			var dist = Math.sqrt(dx * dx + dy * dy);
			var sag = Math.min(140, 24 + dist * 0.2) + Math.sin(t * 1.6) * 6;
			var cx = (A.x + B.x) / 2 + Math.sin(t * 1.1) * 8;
			var cy = (A.y + B.y) / 2 + sag;
			var d = "M" + A.x.toFixed(1) + " " + A.y.toFixed(1) + " Q" + cx.toFixed(1) + " " + cy.toFixed(1) + " " + B.x.toFixed(1) + " " + B.y.toFixed(1);
			els.path.setAttribute("d", d);
			els.glow.setAttribute("d", d);
			// Midpoint of the quadratic curve (t = 0.5).
			var mx = 0.25 * A.x + 0.5 * cx + 0.25 * B.x;
			var my = 0.25 * A.y + 0.5 * cy + 0.25 * B.y;
			els.heart.style.transform = "translate(" + mx.toFixed(1) + "px," + my.toFixed(1) + "px) translate(-50%,-50%)";
		}
		if (any) this._raf = requestAnimationFrame(this._tick);
	};

	LoveBits.prototype._paintMeter = function (key) {
		var l = this.links[key], els = this.stringEls[key];
		if (!l || !els) return;
		var pct = Math.round(l.meter);
		els.fill.style.clipPath = "inset(" + (100 - pct) + "% 0 0 0)";
		els.fill.style.webkitClipPath = els.fill.style.clipPath;
		els.pct.textContent = pct + "%";
		els.heart.style.setProperty("--love-level", String(pct / 100));
		var myId = this._myId();
		if (l.a === myId || l.b === myId) this._renderActions();
	};

	LoveBits.prototype._pulseKnot = function (key) {
		var els = this.stringEls[key];
		if (!els) return;
		els.heart.classList.remove("is-pulse");
		void els.heart.offsetWidth;
		els.heart.classList.add("is-pulse");
	};

	// ---- love meter -----------------------------------------------------

	LoveBits.prototype.tapHeart = function (key) {
		var now = Date.now();
		if (now - this.lastTapAt < TAP_COOLDOWN_MS) return;
		this.lastTapAt = now;
		this._send("m|" + key + "|" + METER_TAP);
		this._addMeter(key, METER_TAP);
		this._sparkAt(key);
	};

	LoveBits.prototype._addMeter = function (key, amount) {
		var l = this.links[key];
		if (!l) return;
		l.meter = Math.max(0, l.meter + amount);
		this._pulseKnot(key);
		if (l.meter >= 100) {
			l.meter = 0;
			this._paintMeter(key);
			this._bigHeart(l.a, l.b);
			return;
		}
		this._paintMeter(key);
	};

	LoveBits.prototype._sparkAt = function (key) {
		var els = this.stringEls[key];
		if (!els || !this.layer) return;
		var r = els.heart.getBoundingClientRect();
		for (var i = 0; i < 4; i++) {
			var s = el("span", "love-spark", Math.random() < 0.5 ? "💕" : "💗");
			s.style.left = (r.left + r.width / 2) + "px";
			s.style.top = (r.top + r.height / 2) + "px";
			s.style.setProperty("--dx", Math.round((Math.random() - 0.5) * 70) + "px");
			s.style.setProperty("--dy", Math.round(-30 - Math.random() * 50) + "px");
			this.layer.appendChild(s);
			this._later(s, 900);
		}
	};

	LoveBits.prototype._bigHeart = function (a, b) {
		var layer = this._ensureLayer();
		var box = el("div", "love-burst");
		box.appendChild(el("div", "love-burst-glow"));
		var big = el("span", "love-burst-heart", "💖");
		big.setAttribute("aria-hidden", "true");
		box.appendChild(big);
		var n = reducedMotion() ? 10 : 34;
		var bits = ["💖", "💕", "💗", "💘", "❤️", "✨", "💞"];
		for (var i = 0; i < n; i++) {
			var ang = (i / n) * Math.PI * 2 + Math.random() * 0.4;
			var dist = 180 + Math.random() * 360;
			var s = el("span", "love-burst-bit", bits[i % bits.length]);
			s.style.setProperty("--dx", Math.round(Math.cos(ang) * dist) + "px");
			s.style.setProperty("--dy", Math.round(Math.sin(ang) * dist) + "px");
			s.style.setProperty("--sz", (18 + Math.random() * 26).toFixed(0) + "px");
			s.style.animationDelay = (0.9 + Math.random() * 0.2).toFixed(2) + "s";
			box.appendChild(s);
		}
		var cap = el("div", "love-burst-caption");
		cap.appendChild(this._nameTag(a));
		cap.appendChild(document.createTextNode(" & "));
		cap.appendChild(this._nameTag(b));
		cap.appendChild(el("span", "love-burst-sub", "filled the love meter! 💖"));
		box.appendChild(cap);
		layer.appendChild(box);
		this._sound("lovekiss");
		this._later(box, 4200);
	};

	// ---- blow a kiss / hug ----------------------------------------------

	LoveBits.prototype._canSend = function () {
		var now = Date.now();
		if (now - this.lastSentAt < SEND_COOLDOWN_MS) { this._say("One sec… catching your breath 😘"); return false; }
		this.lastSentAt = now;
		return true;
	};

	LoveBits.prototype.blowKiss = function (target) {
		var myId = this._myId();
		if (!target || !myId || target === myId || !this._part(target)) return;
		if (!this._canSend()) return;
		var seed = Math.floor(Math.random() * 2147483647) + 1;
		var ok = this._send("b|" + target + "|" + seed);
		if (this.closeModal) this.closeModal();
		this._showKiss(myId, target, seed, !ok);
	};

	LoveBits.prototype.hug = function (target) {
		var myId = this._myId();
		if (!target || !myId || target === myId || !this._part(target)) return;
		if (!this._canSend()) return;
		var ok = this._send("h|" + target);
		if (this.closeModal) this.closeModal();
		this._showHug(myId, target, !ok);
	};

	LoveBits.prototype._showKiss = function (from, to, seed, offline) {
		var layer = this._ensureLayer();
		var r = rng(seed);
		var W = global.innerWidth, H = global.innerHeight;
		var start = this._pos(from) || { x: r() < 0.5 ? -40 : W + 40, y: H * (0.3 + r() * 0.4) };
		var self = this;
		var kiss = el("span", "love-flykiss", "😘");
		kiss.setAttribute("aria-hidden", "true");
		layer.appendChild(kiss);
		var arc = (r() < 0.5 ? -1 : 1) * (80 + r() * 120);
		var dur = reducedMotion() ? 700 : 1500;
		var t0 = 0, lastTrail = 0;
		this._sound("mwah");
		this._caption(from, to, "blew a kiss to", "blew you a kiss", "😘", offline);

		function step(now) {
			if (!t0) t0 = now;
			var k = Math.min(1, (now - t0) / dur);
			var end = self._pos(to) || { x: W / 2, y: H / 2 };
			var e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
			var mx = (start.x + end.x) / 2, my = (start.y + end.y) / 2 - Math.abs(arc);
			var x = (1 - e) * (1 - e) * start.x + 2 * (1 - e) * e * (mx + arc * 0.3) + e * e * end.x;
			var y = (1 - e) * (1 - e) * start.y + 2 * (1 - e) * e * my + e * e * end.y;
			var sc = 0.7 + Math.sin(k * Math.PI) * 0.9;
			kiss.style.transform = "translate(" + x.toFixed(1) + "px," + y.toFixed(1) + "px) translate(-50%,-50%) scale(" + sc.toFixed(2) + ") rotate(" + Math.round(Math.sin(k * 9) * 14) + "deg)";
			if (now - lastTrail > 70 && k < 0.95) {
				lastTrail = now;
				var tr = el("span", "love-trail", r() < 0.6 ? "💕" : "✨");
				tr.style.left = x + "px";
				tr.style.top = y + "px";
				layer.appendChild(tr);
				self._later(tr, 800);
			}
			if (k < 1) { requestAnimationFrame(step); return; }
			if (kiss.parentNode) kiss.parentNode.removeChild(kiss);
			self._landKiss(end.x, end.y, to);
			var key = pairKey(from, to);
			if (self.links[key]) self._addMeter(key, METER_KISS);
		}
		requestAnimationFrame(step);
	};

	LoveBits.prototype._landKiss = function (x, y, to) {
		var layer = this._ensureLayer();
		var stamp = el("span", "love-stamp", "💋");
		stamp.style.left = x + "px";
		stamp.style.top = y + "px";
		layer.appendChild(stamp);
		this._later(stamp, 1600);
		for (var i = 0; i < 10; i++) {
			var ang = (i / 10) * Math.PI * 2;
			var b = el("span", "love-spark", i % 2 ? "💗" : "💖");
			b.style.left = x + "px";
			b.style.top = y + "px";
			b.style.setProperty("--dx", Math.round(Math.cos(ang) * 60) + "px");
			b.style.setProperty("--dy", Math.round(Math.sin(ang) * 60) + "px");
			layer.appendChild(b);
			this._later(b, 900);
		}
		this._sound("kiss");
		if (to === this._myId()) {
			document.body.classList.add("love-got-kiss");
			setTimeout(function () { document.body.classList.remove("love-got-kiss"); }, 900);
		}
	};

	LoveBits.prototype._showHug = function (from, to, offline) {
		var layer = this._ensureLayer();
		var A = this._pos(from), B = this._pos(to);
		var W = global.innerWidth, H = global.innerHeight;
		var at = A && B ? { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 } : (B || A || { x: W / 2, y: H / 2 });
		at.x = Math.max(60, Math.min(W - 60, at.x));
		at.y = Math.max(60, Math.min(H - 60, at.y));
		var hug = el("div", "love-hug");
		hug.style.left = at.x + "px";
		hug.style.top = at.y + "px";
		var big = el("span", "love-hug-emoji", "🫂");
		big.setAttribute("aria-hidden", "true");
		hug.appendChild(big);
		for (var i = 0; i < 8; i++) {
			var h = el("span", "love-hug-heart", i % 2 ? "💕" : "💞");
			h.style.setProperty("--dx", Math.round((i - 3.5) * 16) + "px");
			h.style.animationDelay = (0.25 + i * 0.08).toFixed(2) + "s";
			hug.appendChild(h);
		}
		layer.appendChild(hug);
		this._later(hug, 2400);
		this._sound("chirp");
		this._caption(from, to, "hugged", "hugged you", "🤗", offline);
		var key = pairKey(from, to);
		if (this.links[key]) this._addMeter(key, METER_HUG);
	};

	LoveBits.prototype._nameTag = function (_id) {
		var b = el("b", "love-who", this._name(_id));
		var c = this._color(_id);
		if (c) b.style.color = c;
		return b;
	};

	LoveBits.prototype._caption = function (from, to, verb, verbYou, emoji, offline) {
		var layer = this._ensureLayer();
		var myId = this._myId();
		var cap = el("div", "love-caption" + (to === myId ? " is-for-me" : ""));
		cap.appendChild(this._nameTag(from));
		if (to === myId) {
			cap.appendChild(document.createTextNode(" " + verbYou + " " + emoji));
		} else {
			cap.appendChild(document.createTextNode(" " + verb + " "));
			cap.appendChild(this._nameTag(to));
			cap.appendChild(document.createTextNode(" " + emoji));
		}
		if (offline) cap.appendChild(el("span", "love-offline", "Room sync is offline — only you saw this one."));
		var old = layer.querySelector(".love-caption");
		if (old) old.parentNode.removeChild(old);
		layer.appendChild(cap);
		this._later(cap, 3200);
	};

	// ---- link request toast ---------------------------------------------

	LoveBits.prototype._showRequest = function (from) {
		this._dismissRequest(from);
		var layer = this._ensureLayer();
		var self = this;
		var toast = el("div", "love-request");
		toast.setAttribute("role", "alertdialog");
		toast.appendChild(el("span", "love-request-emoji", "🧵"));
		var msg = el("p", "love-request-text");
		msg.appendChild(this._nameTag(from));
		msg.appendChild(document.createTextNode(" wants to tie a red string between your hearts 💞"));
		toast.appendChild(msg);
		var row = el("div", "love-request-row");
		var yes = el("button", "love-request-yes", "Yes 💖");
		yes.type = "button";
		var no = el("button", "love-request-no", "Not now");
		no.type = "button";
		row.appendChild(yes);
		row.appendChild(no);
		toast.appendChild(row);
		yes.addEventListener("click", function (e) {
			e.stopPropagation();
			self._dismissRequest(from);
			var myId = self._myId();
			self._send("la|" + from);
			self._addLink(from, myId, 0);
			self._sound("sparkle");
			self._renderPanel();
		});
		no.addEventListener("click", function (e) {
			e.stopPropagation();
			self._dismissRequest(from);
			self._send("ld|" + from);
		});
		layer.appendChild(toast);
		this.requestToasts[from] = toast;
		toast._timer = setTimeout(function () { self._dismissRequest(from); }, REQUEST_LIFE_MS);
		this._sound("chirp");
	};

	LoveBits.prototype._dismissRequest = function (from) {
		var t = this.requestToasts[from];
		if (!t) return;
		clearTimeout(t._timer);
		if (t.parentNode) t.parentNode.removeChild(t);
		delete this.requestToasts[from];
	};

	LoveBits.prototype._toast = function (text) {
		var layer = this._ensureLayer();
		var n = el("div", "love-caption is-for-me", text);
		var old = layer.querySelector(".love-caption");
		if (old) old.parentNode.removeChild(old);
		layer.appendChild(n);
		this._later(n, 3200);
	};

	// ---- receiving ------------------------------------------------------

	LoveBits.prototype.tryHandleChat = function (msg) {
		var text = msg.a != null ? msg.a : (msg.message != null ? msg.message : "");
		if (!LoveBits.isSyncText(text)) return false;
		var body = text.slice(SYNC_PREFIX.length);
		var parts = body.split("|");
		var from = String((msg.p && msg.p._id) || "");
		var myId = this._myId();
		var cmd = parts[0];
		if (!from) return true;

		if (cmd === "w") {
			var ts = parseInt(parts[3], 10) || Date.now();
			this._setWeather(parts[1], parseInt(parts[2], 10) || 1, ts);
			this._renderPanel();
		} else if (cmd === "q") {
			this._replyState();
		} else if (cmd === "s") {
			this._mergeState(body.slice(2));
		} else if (cmd === "lr") {
			if (parts[1] === myId && from !== myId) {
				if (this._partnerOf(myId)) this._send("ld|" + from);
				else this._showRequest(from);
			}
		} else if (cmd === "la") {
			this._addLink(from, parts[1], 0);
			if (parts[1] === myId) {
				this.pendingOut = null;
				this._toast("💞 " + this._name(from) + " said yes! Your hearts are tied.");
				this._sound("sparkle");
			}
			this._renderPanel();
		} else if (cmd === "ld") {
			if (parts[1] === myId) {
				this.pendingOut = null;
				this._toast(this._name(from) + " said not right now 🥺");
				this._renderPanel();
			}
		} else if (cmd === "lu") {
			var k = pairKey(from, parts[1]);
			if (this.links[k]) {
				this._removeLink(k);
				if (parts[1] === myId) this._toast(this._name(from) + " untied the heart string 💔");
				this._renderPanel();
			}
		} else if (cmd === "b") {
			if (this._part(parts[1])) this._showKiss(from, parts[1], parseInt(parts[2], 10) || 1, false);
		} else if (cmd === "h") {
			if (this._part(parts[1])) this._showHug(from, parts[1], false);
		} else if (cmd === "m") {
			var key = parts[1];
			var l = this.links[key];
			var amt = Math.max(0, Math.min(METER_TAP, parseInt(parts[2], 10) || 0));
			if (l && (l.a === from || l.b === from) && amt) this._addMeter(key, amt);
		}
		return true;
	};

	LoveBits.prototype._replyState = function () {
		var links = [];
		for (var k in this.links) {
			if (this.links.hasOwnProperty(k)) links.push([this.links[k].a, this.links[k].b, Math.round(this.links[k].meter)]);
		}
		if (this.weather === "none" && !links.length) return;
		var state = { w: this.weather, ws: this.weatherSeed, wt: this.weatherTs, links: links };
		var self = this;
		// Spread replies out so a full room doesn't answer all at once.
		setTimeout(function () { self._send("s|" + JSON.stringify(state)); }, 150 + Math.random() * 900);
	};

	LoveBits.prototype._mergeState = function (json) {
		var st;
		try { st = JSON.parse(json); } catch (e) { return; }
		if (!st || typeof st !== "object") return;
		if (typeof st.w === "string" && (Number(st.wt) || 0) > this.weatherTs) {
			this._setWeather(st.w, Number(st.ws) || 1, Number(st.wt) || 0);
		}
		if (Array.isArray(st.links)) {
			for (var i = 0; i < st.links.length && i < 50; i++) {
				var l = st.links[i];
				if (!Array.isArray(l)) continue;
				var a = String(l[0] || ""), b = String(l[1] || "");
				var m = Math.max(0, Math.min(99, Number(l[2]) || 0));
				if (this._partnerOf(a) && this._partnerOf(a) !== b) continue;
				if (this._partnerOf(b) && this._partnerOf(b) !== a) continue;
				this._addLink(a, b, m);
				var key = pairKey(a, b);
				if (this.links[key]) this._paintMeter(key);
			}
		}
		this._renderPanel();
	};

	// ---- helpers --------------------------------------------------------

	LoveBits.prototype._sound = function (name) {
		if (this.soundOn && typeof global.funSound === "function") global.funSound(name);
	};

	LoveBits.prototype._later = function (node, ms) {
		setTimeout(function () { if (node.parentNode) node.parentNode.removeChild(node); }, ms);
	};

	global.LoveBits = LoveBits;
})(typeof window !== "undefined" ? window : this);
