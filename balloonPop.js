/**
 * Balloon Pop — a synced, room-wide balloon & bubble popping race.
 *
 * Everyone in the room sees the SAME balloons floating up at the SAME time, pops
 * as many as they can, and when the timer runs out the game tallies every pop
 * and crowns whoever popped the most. Fully room-synced via the relay (or the
 * chat fallback) using the "BL|" prefix.
 *
 * How sync works:
 *   - One client (whoever pressed Start) is the HOST. Only the host spawns
 *     balloons and broadcasts each one. Every client renders a balloon purely as
 *     a function of (bornAt, x, drift, life) and the shared serverTime, so the
 *     same balloon is in the same place on every screen.
 *   - Popping a balloon broadcasts a claim. All clients resolve claims the same
 *     deterministic way (earliest pop wins, smallest tag breaks ties), so every
 *     scoreboard converges to the same numbers no matter what order packets
 *     arrive in. The host also sends an authoritative final scoreboard.
 */
(function (global) {
	"use strict";

	var SYNC_PREFIX = "BL|";
	var ROUND_MS = 45000;          // length of one game
	var SPAWN_MIN = 380;           // host: min gap between spawns (ms)
	var SPAWN_MAX = 820;           // host: max gap between spawns (ms)
	var LIFE_MIN = 5200;           // ms for a balloon to drift from bottom to escape
	var LIFE_MAX = 8200;
	var MAX_ON_SCREEN = 44;        // hard cap so a long game never floods
	var HUES = [0, 18, 45, 130, 170, 200, 280, 320, 340];

	function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
	function rand(a, b) { return a + Math.random() * (b - a); }
	function pick(list) { return list[Math.floor(Math.random() * list.length)]; }
	function sanitize(s) { return String(s == null ? "" : s).replace(/[|;,]/g, " ").slice(0, 24); }

	function BalloonPop(opts) {
		opts = opts || {};
		this.client = opts.client;
		this.onLayoutChange = opts.onLayoutChange || function () {};

		this.visible = false;
		this.active = false;
		this.ended = false;
		this.gameId = null;
		this.hostTag = null;
		this.endTime = 0;

		this.balloons = [];
		this.particles = [];
		this.scores = {};          // tag -> { name, count }
		this.claims = {};          // balloonId -> { tag, time }

		this._tag = null;
		this._seq = 0;
		this._roundSeq = 0;
		this._nextSpawnAt = 0;     // host scheduling (serverTime)
		this.ignoreSelfUntil = 0;
		this._lastHudAt = 0;
		this._finishedGameId = null;   // guards the results screen against replays

		this._buildUi();
		this._loop();
	}

	BalloonPop.SYNC_PREFIX = SYNC_PREFIX;
	BalloonPop.isSyncText = function (text) {
		return !!(text && typeof text === "string" && text.indexOf(SYNC_PREFIX) === 0);
	};

	BalloonPop.prototype.serverTime = function () {
		return Date.now() + (this.client.serverTimeOffset || 0);
	};

	// A per-instance id, unique to this tab for its lifetime. Used for ownership
	// (host), scoring identity and self-echo — must NOT be persisted (a duplicated
	// tab would share it and collapse the game).
	BalloonPop.prototype._selfTag = function () {
		if (this._tag) return this._tag;
		this._tag = (Math.floor(rand(0, 1e9)).toString(36) + Math.floor(rand(0, 1e9)).toString(36)).slice(0, 10);
		return this._tag;
	};

	BalloonPop.prototype._selfName = function () {
		var me = this.client.getOwnParticipant && this.client.getOwnParticipant();
		return sanitize((me && me.name) || "You") || "You";
	};

	BalloonPop.prototype._canBroadcast = function () {
		if (!this.client) return false;
		if (this.client.roomSync && this.client.roomSync.isConnected()) return true;
		return !!this.client.isConnected();
	};

	// ---- networking ------------------------------------------------------

	BalloonPop.prototype.sendSync = function (payload) {
		if (!this._canBroadcast()) return;
		var msg = SYNC_PREFIX + payload;
		if (msg.length > 512) return;
		this.ignoreSelfUntil = Date.now() + 400;
		this.client.broadcastRoom(msg);
	};

	BalloonPop.prototype.requestSync = function () { this.sendSync("q|" + this._selfTag()); };

	BalloonPop.prototype.tryHandleChat = function (msg) {
		var text = msg.a != null ? msg.a : (msg.message != null ? msg.message : "");
		if (!BalloonPop.isSyncText(text)) return false;

		var parts = text.slice(SYNC_PREFIX.length).split("|");
		var cmd = parts[0];
		// The sender tag rides on every message so we can recognise our OWN echo
		// without trusting the shared MPP id. Note: unlike a self-echo we DROP,
		// pop/start/balloon are applied idempotently, so even if our own echo got
		// through it would be a harmless no-op (deduped by id/claim).
		var senderTag = parts[parts.length - 1];

		if (cmd === "s") {
			// s|gameId|endTime|hostTag|hostName
			this._applyStart(parts[1], parseFloat(parts[2]) || 0, parts[3], parts[4]);
		} else if (cmd === "b") {
			// b|gameId|id|x|vx|type|hue|bornAt|life|hostTag
			this._applyBalloon(parts);
		} else if (cmd === "p") {
			// p|gameId|balloonId|tag|time|name
			this._applyPop(parts[1], parts[2], parts[3], parseFloat(parts[4]) || 0, parts[5]);
		} else if (cmd === "e") {
			// e|gameId|tag:count:name;...|hostTag
			this._applyEnd(parts[1], parts[2]);
		} else if (cmd === "q") {
			// a newcomer asked for state; the host answers with the live game
			if (this.active && this.hostTag === this._selfTag() && senderTag !== this._selfTag()) {
				var self = this;
				setTimeout(function () { self._broadcastStart(); }, 60 + Math.random() * 160);
			}
		}
		return true;
	};

	// ---- game lifecycle --------------------------------------------------

	BalloonPop.prototype.startGame = function () {
		if (this.active) return;
		if (!this._canBroadcast()) { this._flash("connect to a room first!"); return; }
		this._roundSeq++;
		this.gameId = this._selfTag() + "-" + this._roundSeq;
		this.hostTag = this._selfTag();
		this.endTime = this.serverTime() + ROUND_MS;
		this._beginActive();
		this._nextSpawnAt = this.serverTime() + 400;   // small lead-in
		this._broadcastStart();
		this._flash("Go! Pop them all! 🎈");
		if (global.funSound) global.funSound("sparkle");
	};

	BalloonPop.prototype._broadcastStart = function () {
		this.sendSync("s|" + this.gameId + "|" + Math.round(this.endTime) + "|" + this.hostTag + "|" + this._selfName());
	};

	BalloonPop.prototype._beginActive = function () {
		this.active = true;
		this.ended = false;
		this.balloons.length = 0;
		this.particles.length = 0;
		this.scores = {};
		this.claims = {};
		this._hideResults();
		if (!this.visible) this.setVisible(true);
		this._setCanvasInteractive(true);
		this._updateHud();
	};

	BalloonPop.prototype._applyStart = function (gameId, endTime, hostTag, hostName) {
		if (!gameId) return;
		// Ignore a restart of a game we're already in the middle of.
		if (this.active && this.gameId === gameId) { this.endTime = endTime || this.endTime; return; }
		this.gameId = gameId;
		this.hostTag = hostTag || null;
		this.endTime = endTime || (this.serverTime() + ROUND_MS);
		this._beginActive();
		if (hostTag && hostName) this.scores[hostTag] = { name: sanitize(hostName) || "Host", count: 0 };
		this._flash("Balloon Pop started! 🎈");
		if (global.funSound) global.funSound("sparkle");
	};

	BalloonPop.prototype._endGame = function () {
		if (!this.active) return;
		this.active = false;
		this.ended = true;
		this._setCanvasInteractive(false);
		this.balloons.length = 0;
		// Host publishes the authoritative scoreboard so every client shows the
		// exact same numbers even if a pop or two went missing in transit.
		if (this.hostTag === this._selfTag()) {
			this.sendSync("e|" + this.gameId + "|" + this._encodeScores() + "|" + this._selfTag());
		}
		this._finish(this.gameId);
	};

	BalloonPop.prototype._applyEnd = function (gameId, scoreStr) {
		if (!gameId || gameId !== this.gameId) return;
		this._decodeScores(scoreStr);   // adopt host's authoritative tally
		if (this.active) {
			this.active = false;
			this._setCanvasInteractive(false);
			this.balloons.length = 0;
		}
		this.ended = true;
		this._finish(gameId);
	};

	// Show the results once per game; re-running (e.g. the host's own echo, or a
	// late authoritative scoreboard) just re-renders the numbers without a second
	// fanfare or pop-in.
	BalloonPop.prototype._finish = function (gameId) {
		var first = this._finishedGameId !== gameId;
		this._finishedGameId = gameId;
		this._showResults();
		if (first && global.funSound) global.funSound("fanfare");
	};

	// ---- balloons --------------------------------------------------------

	BalloonPop.prototype._hostSpawnTick = function (now) {
		if (!this.active || this.hostTag !== this._selfTag()) return;
		if (now < this._nextSpawnAt) return;
		this._nextSpawnAt = now + rand(SPAWN_MIN, SPAWN_MAX);
		if (this.balloons.length >= MAX_ON_SCREEN) return;
		// Don't spawn so late that the balloon can't reach the top before time's up.
		if (this.endTime - now < 1400) return;

		var isBubble = Math.random() < 0.32;
		var b = {
			id: this._selfTag() + "-" + (this._seq++),
			x: rand(0.08, 0.92),
			vx: rand(-0.05, 0.05),
			type: isBubble ? "bubble" : "balloon",
			hue: pick(HUES),
			bornAt: now,
			life: rand(LIFE_MIN, LIFE_MAX)
		};
		this._addBalloon(b);
		this.sendSync("b|" + this.gameId + "|" + b.id + "|" + Math.round(b.x * 1000) + "|" +
			Math.round(b.vx * 1000) + "|" + (isBubble ? "u" : "b") + "|" + b.hue + "|" +
			Math.round(b.bornAt) + "|" + Math.round(b.life) + "|" + this._selfTag());
	};

	BalloonPop.prototype._applyBalloon = function (parts) {
		if (parts[1] !== this.gameId || !this.active) return;
		var id = parts[2];
		if (this.claims[id] || this._byId(id)) return;   // already popped or have it
		this._addBalloon({
			id: id,
			x: (parseInt(parts[3], 10) || 0) / 1000,
			vx: (parseInt(parts[4], 10) || 0) / 1000,
			type: parts[5] === "u" ? "bubble" : "balloon",
			hue: parseInt(parts[6], 10) || 0,
			bornAt: parseFloat(parts[7]) || this.serverTime(),
			life: parseFloat(parts[8]) || LIFE_MAX
		});
	};

	BalloonPop.prototype._addBalloon = function (b) {
		b.swayPhase = rand(0, Math.PI * 2);
		b.swayAmp = rand(0.01, 0.04);
		b.wobble = rand(0, Math.PI * 2);
		b.popped = false;
		b._px = b._py = b._pr = 0;
		this.balloons.push(b);
	};

	BalloonPop.prototype._byId = function (id) {
		for (var i = 0; i < this.balloons.length; i++) if (this.balloons[i].id === id) return this.balloons[i];
		return null;
	};

	// Normalised position of a balloon at server-time t.
	BalloonPop.prototype._posAt = function (b, t) {
		var elapsed = t - b.bornAt;
		var prog = elapsed / b.life;                       // 0 at bottom, 1+ off top
		var y = 1.12 - prog * 1.30;
		var x = clamp(b.x + b.vx * (elapsed / 1000) + Math.sin(b.swayPhase + elapsed * 0.0022) * b.swayAmp, 0.03, 0.97);
		return { x: x, y: y, prog: prog };
	};

	// ---- popping ---------------------------------------------------------

	BalloonPop.prototype._popLocal = function (b, now) {
		if (!b || b.popped || !this.active) return;
		var tag = this._selfTag();
		this._creditPop(b.id, tag, now, this._selfName());
		this._burst(b);
		this._removeBalloon(b.id);
		if (global.funSound) global.funSound(b.type === "bubble" ? "blip" : "pop", { throttle: 20 });
		this.sendSync("p|" + this.gameId + "|" + b.id + "|" + tag + "|" + Math.round(now) + "|" + this._selfName());
		this._updateHud();
	};

	BalloonPop.prototype._applyPop = function (gameId, balloonId, tag, time, name) {
		if (!gameId || gameId !== this.gameId || !balloonId || !tag) return;
		// Once our round has ended, the cutoff is fixed (the host's authoritative
		// scoreboard); ignore stragglers so scores can't drift after the results.
		if (!this.active) return;
		var had = this._byId(balloonId);
		this._creditPop(balloonId, tag, time, name);
		// Remove it from our screen too (with a little burst if it was visible).
		if (had) { this._burst(had); this._removeBalloon(balloonId); }
		this._updateHud();
	};

	// Deterministic, order-independent scoring: the earliest pop wins a balloon;
	// an exact tie is broken by the smaller tag. Re-running this for the same
	// (balloonId,tag,time) is a no-op, so duplicate/echoed packets never miscount.
	BalloonPop.prototype._creditPop = function (balloonId, tag, time, name) {
		if (name != null) this._ensureScore(tag, name);
		var prev = this.claims[balloonId];
		if (!prev) {
			this.claims[balloonId] = { tag: tag, time: time };
			this._ensureScore(tag, name).count++;
			return;
		}
		if (prev.tag === tag) { if (time < prev.time) prev.time = time; return; }
		var better = (time < prev.time) || (time === prev.time && tag < prev.tag);
		if (better) {
			var old = this.scores[prev.tag];
			if (old && old.count > 0) old.count--;
			this.claims[balloonId] = { tag: tag, time: time };
			this._ensureScore(tag, name).count++;
		}
	};

	BalloonPop.prototype._ensureScore = function (tag, name) {
		var s = this.scores[tag];
		if (!s) { s = this.scores[tag] = { name: sanitize(name) || "player", count: 0 }; }
		else if (name && (s.name === "player" || !s.name)) s.name = sanitize(name);
		return s;
	};

	BalloonPop.prototype._removeBalloon = function (id) {
		for (var i = this.balloons.length - 1; i >= 0; i--) {
			if (this.balloons[i].id === id) { this.balloons.splice(i, 1); return; }
		}
	};

	BalloonPop.prototype._burst = function (b) {
		var pos = this._posAt(b, this.serverTime());
		var n = b.type === "bubble" ? 8 : 14;
		for (var i = 0; i < n; i++) {
			var a = rand(0, Math.PI * 2), sp = rand(0.004, 0.02);
			this.particles.push({
				x: pos.x, y: pos.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
				life: 1, decay: rand(0.02, 0.045), size: rand(2.5, 6),
				color: "hsl(" + b.hue + ", 85%, " + Math.round(rand(55, 72)) + "%)"
			});
		}
		if (this.particles.length > 300) this.particles.splice(0, this.particles.length - 300);
	};

	// ---- scoreboard helpers ---------------------------------------------

	BalloonPop.prototype._sortedScores = function () {
		var arr = [];
		for (var tag in this.scores) {
			if (this.scores.hasOwnProperty(tag)) arr.push({ tag: tag, name: this.scores[tag].name, count: this.scores[tag].count });
		}
		arr.sort(function (a, b) { return b.count - a.count || (a.tag < b.tag ? -1 : 1); });
		return arr;
	};

	BalloonPop.prototype._encodeScores = function () {
		var arr = this._sortedScores(), out = [];
		for (var i = 0; i < arr.length; i++) out.push(arr[i].tag + ":" + arr[i].count + ":" + sanitize(arr[i].name));
		return out.join(";");
	};

	BalloonPop.prototype._decodeScores = function (str) {
		if (!str) return;
		var entries = str.split(";");
		this.scores = {};
		for (var i = 0; i < entries.length; i++) {
			var f = entries[i].split(":");
			if (!f[0]) continue;
			this.scores[f[0]] = { name: sanitize(f[2]) || "player", count: parseInt(f[1], 10) || 0 };
		}
	};

	BalloonPop.prototype._myScore = function () {
		var s = this.scores[this._selfTag()];
		return s ? s.count : 0;
	};

	// ---- main loop -------------------------------------------------------

	BalloonPop.prototype._loop = function () {
		var self = this;
		function tick() {
			self._raf = requestAnimationFrame(tick);
			var now = self.serverTime();
			if (self.active) {
				self._hostSpawnTick(now);
				if (now >= self.endTime) self._endGame();
			}
			self._step(now);
			self._draw(now);
			if (Date.now() - self._lastHudAt > 250) { self._lastHudAt = Date.now(); self._updateHud(); }
		}
		tick();
	};

	BalloonPop.prototype._step = function (now) {
		// drop escaped balloons (reached the top un-popped)
		for (var i = this.balloons.length - 1; i >= 0; i--) {
			if (this._posAt(this.balloons[i], now).prog > 1.16) this.balloons.splice(i, 1);
		}
		var ps = this.particles;
		for (var j = ps.length - 1; j >= 0; j--) {
			var p = ps[j];
			p.x += p.vx; p.y += p.vy; p.vy += 0.0006; p.vx *= 0.97;
			p.life -= p.decay;
			if (p.life <= 0) ps.splice(j, 1);
		}
	};

	// ---- input -----------------------------------------------------------

	BalloonPop.prototype._onPoint = function (e) {
		if (!this.active) return;
		e.preventDefault();
		var rect = this.canvas.getBoundingClientRect();
		var t = e.touches ? e.touches[0] : e;
		var px = t.clientX - rect.left, py = t.clientY - rect.top;
		// topmost (last drawn) balloon whose circle (pixel space) contains the tap
		for (var i = this.balloons.length - 1; i >= 0; i--) {
			var b = this.balloons[i];
			if (b.popped) continue;
			var dx = px - b._px, dy = py - b._py, r = b._pr * 1.3;
			if (dx * dx + dy * dy <= r * r) { this._popLocal(b, this.serverTime()); return; }
		}
	};

	// ---- rendering -------------------------------------------------------

	BalloonPop.prototype._draw = function (now) {
		var ctx = this.ctx, canvas = this.canvas;
		if (!ctx || !canvas) return;
		var rect = canvas.getBoundingClientRect();
		var w = rect.width, h = rect.height;
		ctx.clearRect(0, 0, w, h);
		if (!this.visible) return;

		var R = Math.min(w, h);
		for (var i = 0; i < this.balloons.length; i++) {
			var b = this.balloons[i];
			var pos = this._posAt(b, now);
			b.wobble += 0.05;
			var rPx = R * (b.type === "bubble" ? 0.058 : 0.05);
			var cx = pos.x * w, cy = pos.y * h;
			// cache pixel hit-test geometry for _onPoint
			b._px = cx; b._py = cy; b._pr = rPx;
			if (cy < -rPx * 2 || cy > h + rPx * 3) continue;
			if (b.type === "bubble") this._drawBubble(ctx, cx, cy, rPx, b);
			else this._drawBalloon(ctx, cx, cy, rPx, b);
		}
		this._drawParticles(ctx, w, h);
	};

	BalloonPop.prototype._drawBalloon = function (ctx, cx, cy, r, b) {
		var sway = Math.sin(b.wobble) * 0.06;
		var rx = r * (1 + sway), ry = r * 1.18 * (1 - sway * 0.5);
		// string
		ctx.strokeStyle = "rgba(255,255,255,0.5)";
		ctx.lineWidth = 1.4;
		ctx.beginPath();
		ctx.moveTo(cx, cy + ry);
		ctx.quadraticCurveTo(cx + Math.sin(b.wobble) * 6, cy + ry + r * 0.5, cx, cy + ry + r * 1.0);
		ctx.stroke();
		// body
		var grad = ctx.createRadialGradient(cx - rx * 0.3, cy - ry * 0.35, rx * 0.1, cx, cy, Math.max(rx, ry));
		grad.addColorStop(0, "hsl(" + b.hue + ", 90%, 78%)");
		grad.addColorStop(0.5, "hsl(" + b.hue + ", 80%, 60%)");
		grad.addColorStop(1, "hsl(" + b.hue + ", 72%, 46%)");
		ctx.fillStyle = grad;
		ctx.beginPath();
		ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
		ctx.fill();
		// knot
		ctx.beginPath();
		ctx.moveTo(cx - r * 0.12, cy + ry);
		ctx.lineTo(cx + r * 0.12, cy + ry);
		ctx.lineTo(cx, cy + ry + r * 0.16);
		ctx.closePath();
		ctx.fillStyle = "hsl(" + b.hue + ", 72%, 50%)";
		ctx.fill();
		// highlight
		ctx.fillStyle = "rgba(255,255,255,0.5)";
		ctx.beginPath();
		ctx.ellipse(cx - rx * 0.35, cy - ry * 0.38, rx * 0.2, ry * 0.28, -0.5, 0, Math.PI * 2);
		ctx.fill();
	};

	BalloonPop.prototype._drawBubble = function (ctx, cx, cy, r, b) {
		var grad = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
		grad.addColorStop(0, "hsla(" + b.hue + ", 90%, 92%, 0.5)");
		grad.addColorStop(0.7, "hsla(" + b.hue + ", 80%, 75%, 0.22)");
		grad.addColorStop(1, "hsla(" + b.hue + ", 80%, 65%, 0.32)");
		ctx.fillStyle = grad;
		ctx.beginPath();
		ctx.arc(cx, cy, r, 0, Math.PI * 2);
		ctx.fill();
		ctx.strokeStyle = "hsla(" + b.hue + ", 90%, 85%, 0.6)";
		ctx.lineWidth = 1.5;
		ctx.stroke();
		ctx.fillStyle = "rgba(255,255,255,0.75)";
		ctx.beginPath();
		ctx.arc(cx - r * 0.35, cy - r * 0.35, r * 0.16, 0, Math.PI * 2);
		ctx.fill();
	};

	BalloonPop.prototype._drawParticles = function (ctx, w, h) {
		var ps = this.particles;
		for (var i = 0; i < ps.length; i++) {
			var p = ps[i];
			ctx.globalAlpha = clamp(p.life, 0, 1);
			ctx.fillStyle = p.color;
			ctx.beginPath();
			ctx.arc(p.x * w, p.y * h, p.size, 0, Math.PI * 2);
			ctx.fill();
		}
		ctx.globalAlpha = 1;
	};

	// ---- UI --------------------------------------------------------------

	BalloonPop.prototype._buildUi = function () {
		var self = this;

		// full-screen play canvas (only catches clicks while a game is live)
		var canvas = document.createElement("canvas");
		canvas.className = "balloon-canvas";
		canvas.setAttribute("hidden", "hidden");
		document.body.appendChild(canvas);
		this.canvas = canvas;
		this.ctx = canvas.getContext("2d");

		canvas.addEventListener("mousedown", function (e) { self._onPoint(e); });
		canvas.addEventListener("touchstart", function (e) { self._onPoint(e); }, { passive: false });

		// control bar
		var bar = document.createElement("div");
		bar.className = "party-bar balloon-bar";
		bar.setAttribute("hidden", "hidden");
		bar.innerHTML =
			'<span class="balloon-emoji">🎈</span>' +
			'<span class="balloon-status">Balloon Pop</span>' +
			'<span class="balloon-timer">0:45</span>' +
			'<span class="balloon-score">You: 0</span>' +
			'<button type="button" class="balloon-start party-btn">Start 🎈</button>' +
			'<button type="button" class="balloon-close party-btn" title="Close">×</button>';
		document.body.appendChild(bar);
		this.bar = bar;
		this.elStatus = bar.querySelector(".balloon-status");
		this.elTimer = bar.querySelector(".balloon-timer");
		this.elScore = bar.querySelector(".balloon-score");
		this.elStart = bar.querySelector(".balloon-start");
		bar.querySelector(".balloon-start").addEventListener("click", function (e) { e.stopPropagation(); self.startGame(); });
		bar.querySelector(".balloon-close").addEventListener("click", function (e) { e.stopPropagation(); self.setVisible(false); });

		// results overlay
		var res = document.createElement("div");
		res.className = "balloon-results";
		res.setAttribute("hidden", "hidden");
		res.innerHTML =
			'<div class="balloon-results-card">' +
			'<div class="balloon-results-title">🏆 Balloon Pop — Results</div>' +
			'<div class="balloon-winner"></div>' +
			'<ol class="balloon-scoreboard"></ol>' +
			'<div class="balloon-results-actions">' +
			'<button type="button" class="balloon-again party-btn">Play again 🎈</button>' +
			'<button type="button" class="balloon-dismiss party-btn">Close</button>' +
			'</div></div>';
		document.body.appendChild(res);
		this.results = res;
		res.querySelector(".balloon-again").addEventListener("click", function (e) { e.stopPropagation(); self._hideResults(); self.startGame(); });
		res.querySelector(".balloon-dismiss").addEventListener("click", function (e) { e.stopPropagation(); self._hideResults(); });

		this._resize();
		window.addEventListener("resize", function () { self._resize(); });
	};

	BalloonPop.prototype._resize = function () {
		if (!this.canvas) return;
		var dpr = window.devicePixelRatio || 1;
		var w = window.innerWidth, h = window.innerHeight;
		this.canvas.width = Math.max(1, Math.floor(w * dpr));
		this.canvas.height = Math.max(1, Math.floor(h * dpr));
		this.canvas.style.width = w + "px";
		this.canvas.style.height = h + "px";
		this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	};

	BalloonPop.prototype._setCanvasInteractive = function (on) {
		if (!this.canvas) return;
		if (on) { this.canvas.removeAttribute("hidden"); this.canvas.classList.add("balloon-live"); }
		else { this.canvas.classList.remove("balloon-live"); if (!this.visible) this.canvas.setAttribute("hidden", "hidden"); }
	};

	BalloonPop.prototype.setVisible = function (on) {
		this.visible = !!on;
		if (this.bar) {
			if (this.visible) this.bar.removeAttribute("hidden");
			else this.bar.setAttribute("hidden", "hidden");
		}
		if (this.canvas) {
			if (this.visible) this.canvas.removeAttribute("hidden");
			else if (!this.active) this.canvas.setAttribute("hidden", "hidden");
		}
		if (this.visible) { this._resize(); if (this._canBroadcast()) this.requestSync(); }
		else this._hideResults();
		this._updateHud();
		this.onLayoutChange();
	};

	BalloonPop.prototype._flash = function (text) { if (this.elStatus) this.elStatus.textContent = text; };

	BalloonPop.prototype._updateHud = function () {
		if (this.elStart) this.elStart.disabled = this.active;
		if (this.elScore) this.elScore.textContent = "You: " + this._myScore();
		if (this.elTimer) {
			if (this.active) {
				var remain = Math.max(0, this.endTime - this.serverTime());
				var s = Math.ceil(remain / 1000);
				this.elTimer.textContent = "0:" + (s < 10 ? "0" + s : s);
				this.elTimer.classList.toggle("balloon-urgent", s <= 10);
			} else {
				this.elTimer.textContent = "0:45";
				this.elTimer.classList.remove("balloon-urgent");
			}
		}
	};

	BalloonPop.prototype._showResults = function () {
		if (!this.results) return;
		var arr = this._sortedScores();
		var ol = this.results.querySelector(".balloon-scoreboard");
		var winEl = this.results.querySelector(".balloon-winner");
		ol.innerHTML = "";
		var myTag = this._selfTag();
		if (!arr.length) {
			winEl.textContent = "No balloons popped 😅";
		} else {
			var top = arr[0].count;
			var winners = arr.filter(function (a) { return a.count === top && top > 0; });
			if (top === 0) winEl.textContent = "Nobody popped a single one! 😂";
			else if (winners.length > 1) winEl.innerHTML = "🤝 It's a tie! <b>" + winners.map(function (w) { return esc(w.name); }).join(" & ") + "</b> — " + top + " each";
			else {
				var champ = winners[0];
				winEl.innerHTML = (champ.tag === myTag ? "🎉 You win! 🎉" : "🏆 Winner: <b>" + esc(champ.name) + "</b>") + " — " + top + " pops";
			}
			for (var i = 0; i < arr.length; i++) {
				var li = document.createElement("li");
				var medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "&nbsp;&nbsp;";
				li.innerHTML = '<span class="bs-rank">' + medal + '</span><span class="bs-name">' + esc(arr[i].name) +
					(arr[i].tag === myTag ? ' <span class="bs-you">(you)</span>' : '') + '</span><span class="bs-count">' + arr[i].count + '</span>';
				if (arr[i].tag === myTag) li.className = "bs-me";
				ol.appendChild(li);
			}
		}
		this.results.removeAttribute("hidden");
	};

	BalloonPop.prototype._hideResults = function () {
		if (this.results) this.results.setAttribute("hidden", "hidden");
	};

	function esc(s) {
		return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
			return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c];
		});
	}

	BalloonPop.prototype.destroy = function () {
		if (this._raf) cancelAnimationFrame(this._raf);
	};

	global.BalloonPop = BalloonPop;
})(typeof window !== "undefined" ? window : this);
