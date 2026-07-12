/**
 * Tug of War — a synced, room-wide rope-pulling battle.
 *
 * Players join and are auto-split into RED (left) and BLUE (right) teams. Mash
 * the button (or click / tap the screen) to pull the flag toward your side. The
 * first team to drag the flag past their line wins. Chaotic and sweaty in a full
 * room.
 *
 * Sync model:
 *   - One client (whoever pressed Start) is the HOST and owns the flag. Everyone
 *     broadcasts how many times they mashed; the host integrates all pulls into a
 *     single authoritative flag position and broadcasts it ~20×/s, so the rope is
 *     identical on every screen and there's no tug-of-war over the tug-of-war.
 *   - The host detects the win and publishes the final result + MVP.
 *   Transport: the "TW|" prefix over the relay / chat fallback.
 */
(function (global) {
	"use strict";

	var SYNC_PREFIX = "TW|";
	var WIN_L = 0.10, WIN_R = 0.90;     // flag past here → that side wins
	var PULL_STEP = 0.0016;             // flag shift per mash
	var DECAY = 0.0009;                 // gentle drift back to centre per tick (keep mashing!)
	var FLAG_HZ = 50;                   // host broadcast throttle (ms)
	var PUSH_HZ = 90;                   // my mash-count flush throttle (ms)

	function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
	function rand(a, b) { return a + Math.random() * (b - a); }
	function sanitize(s) { return String(s == null ? "" : s).replace(/[|;,:]/g, " ").slice(0, 20); }
	function esc(s) {
		return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
			return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c];
		});
	}

	function TugOfWar(opts) {
		opts = opts || {};
		this.client = opts.client;
		this.onLayoutChange = opts.onLayoutChange || function () {};

		this.visible = false;
		this.active = false;
		this.ended = false;
		this.joined = false;
		this.team = "r";
		this.gameId = null;
		this.hostTag = null;
		this.flag = 0.5;
		this.netFlag = 0.5;
		this.winner = null;          // 'r' | 'b'
		this.players = {};           // tag -> { name, team, pulls, isOwn }
		this.particles = [];

		this._tag = null;
		this._roundSeq = 0;
		this._pullBuffer = 0;
		this._lastPush = 0;
		this._lastFlag = 0;
		this._mvp = null;
		this._finishedGameId = null;
		this.ignoreSelfUntil = 0;
		this._pulseL = 0; this._pulseR = 0;

		this._buildUi();
		this._bindKeys();
		this._loop();
	}

	TugOfWar.SYNC_PREFIX = SYNC_PREFIX;
	TugOfWar.isSyncText = function (text) {
		return !!(text && typeof text === "string" && text.indexOf(SYNC_PREFIX) === 0);
	};

	TugOfWar.prototype.serverTime = function () { return Date.now() + (this.client.serverTimeOffset || 0); };
	TugOfWar.prototype._selfTag = function () {
		if (this._tag) return this._tag;
		this._tag = (Math.floor(rand(0, 1e9)).toString(36) + Math.floor(rand(0, 1e9)).toString(36)).slice(0, 10);
		return this._tag;
	};
	TugOfWar.prototype._selfName = function () {
		var me = this.client.getOwnParticipant && this.client.getOwnParticipant();
		return sanitize((me && me.name) || "Player") || "Player";
	};
	TugOfWar.prototype._canBroadcast = function () {
		if (!this.client) return false;
		return !!(this.client.roomSync && this.client.roomSync.isConnected());
	};

	// ---- networking ------------------------------------------------------

	TugOfWar.prototype.sendSync = function (payload) {
		if (!this._canBroadcast()) return;
		var msg = SYNC_PREFIX + payload;
		if (msg.length > 512) return;
		this.ignoreSelfUntil = Date.now() + 400;
		this.client.broadcastRoom(msg);
	};
	TugOfWar.prototype.requestSync = function () { this.sendSync("q|" + this._selfTag()); };

	TugOfWar.prototype.tryHandleChat = function (msg) {
		var text = msg.a != null ? msg.a : (msg.message != null ? msg.message : "");
		if (!TugOfWar.isSyncText(text)) return false;
		var parts = text.slice(SYNC_PREFIX.length).split("|");
		var cmd = parts[0];
		var senderTag = parts[parts.length - 1];

		if (cmd === "j") this._addPlayer(parts[1], parts[2], parts[3]);
		else if (cmd === "l") this._removePlayer(parts[1]);
		else if (cmd === "sw") { var p = this.players[parts[1]]; if (p) p.team = parts[2] === "b" ? "b" : "r"; this._updateHud(); }
		else if (cmd === "s") this._applyStart(parts[1], parts[2]);
		else if (cmd === "p") this._applyPull(parts[1], parts[2], parseInt(parts[3], 10) || 0);
		else if (cmd === "f") this._applyFlag(parts[1], (parseInt(parts[2], 10) || 500) / 1000);
		else if (cmd === "e") this._applyEnd(parts[1], parts[2], parseInt(parts[3], 10) || 0, parseInt(parts[4], 10) || 0, parts[5], parseInt(parts[6], 10) || 0);
		else if (cmd === "q") { if (senderTag !== this._selfTag()) this._answerQuery(); }
		return true;
	};

	TugOfWar.prototype._answerQuery = function () {
		var self = this;
		setTimeout(function () {
			if (self.joined) self._broadcastJoin();
			if (self.active && self.hostTag === self._selfTag()) self.sendSync("s|" + self.gameId + "|" + self.hostTag);
		}, 40 + Math.random() * 200);
	};

	// ---- roster / teams --------------------------------------------------

	TugOfWar.prototype._addPlayer = function (tag, name, team) {
		if (!tag) return null;
		var p = this.players[tag];
		if (!p) {
			p = this.players[tag] = {
				tag: tag, name: sanitize(name) || "Player",
				team: team === "b" ? "b" : "r", pulls: 0, isOwn: tag === this._selfTag()
			};
		} else { if (name) p.name = sanitize(name); if (team) p.team = team === "b" ? "b" : "r"; }
		this._updateHud();
		return p;
	};
	TugOfWar.prototype._removePlayer = function (tag) { if (this.players[tag]) { delete this.players[tag]; this._updateHud(); } };
	TugOfWar.prototype._teamMembers = function (team) {
		var a = []; for (var t in this.players) if (this.players.hasOwnProperty(t) && this.players[t].team === team) a.push(this.players[t]);
		a.sort(function (x, y) { return y.pulls - x.pulls; });
		return a;
	};
	TugOfWar.prototype._smallerTeam = function () {
		var r = 0, b = 0;
		for (var t in this.players) { if (!this.players.hasOwnProperty(t)) continue; if (this.players[t].team === "b") b++; else r++; }
		return b < r ? "b" : "r";
	};

	TugOfWar.prototype.join = function () {
		if (!this._canBroadcast()) { this._flash("connect to a room first!"); return; }
		this.joined = true;
		this.team = this._smallerTeam();
		var p = this._addPlayer(this._selfTag(), this._selfName(), this.team);
		if (p) p.team = this.team;
		this._broadcastJoin();
		this._flash("you're on " + (this.team === "b" ? "BLUE 🔵" : "RED 🔴") + " — mash to pull!");
		if (global.funSound) global.funSound("coin");
	};
	TugOfWar.prototype.leave = function () {
		if (this.active) { this._flash("can't leave mid-match!"); return; }
		this.joined = false;
		this._removePlayer(this._selfTag());
		this.sendSync("l|" + this._selfTag());
	};
	TugOfWar.prototype.switchTeam = function () {
		if (this.active || !this.joined) return;
		this.team = this.team === "b" ? "r" : "b";
		var p = this.players[this._selfTag()];
		if (p) p.team = this.team;
		this.sendSync("sw|" + this._selfTag() + "|" + this.team);
		this._flash("switched to " + (this.team === "b" ? "BLUE 🔵" : "RED 🔴"));
		this._updateHud();
	};
	TugOfWar.prototype._broadcastJoin = function () {
		this.sendSync("j|" + this._selfTag() + "|" + this._selfName() + "|" + this.team);
	};

	// ---- match flow ------------------------------------------------------

	TugOfWar.prototype.startMatch = function () {
		if (this.active) return;
		if (!this._canBroadcast()) { this._flash("connect to a room first!"); return; }
		if (!this.joined) this.join();
		this._roundSeq++;
		this.gameId = this._selfTag() + "-" + this._roundSeq;
		this.hostTag = this._selfTag();
		this.sendSync("s|" + this.gameId + "|" + this.hostTag);
		this._applyStart(this.gameId, this.hostTag);
	};

	TugOfWar.prototype._applyStart = function (gameId, hostTag) {
		if (!gameId) return;
		if (this.active && this.gameId === gameId) return;
		this.gameId = gameId;
		this.hostTag = hostTag || null;
		this.active = true;
		this.ended = false;
		this.winner = null;
		this.flag = this.netFlag = 0.5;
		this.particles.length = 0;
		this._pullBuffer = 0;
		for (var t in this.players) if (this.players.hasOwnProperty(t)) this.players[t].pulls = 0;
		this._hideResults();
		if (!this.visible) this.setVisible(true);
		this._setCanvasInteractive(this.joined);
		this._flash("PULL! 💪");
		if (global.funSound) global.funSound("fuse");
		this._updateHud();
	};

	// a single mash from me
	TugOfWar.prototype._mash = function () {
		if (!this.active || !this.joined || this.winner) return;
		this._pullBuffer++;
		var p = this.players[this._selfTag()];
		if (p) p.pulls++;
		if (this.team === "b") this._pulseR = 1; else this._pulseL = 1;
		this._spawnPullSpark();
		if (global.funSound) global.funSound("blip", { throttle: 45 });
	};

	// flush my recent mash count to the host (and everyone, for the live tally)
	TugOfWar.prototype._flushPulls = function (now) {
		if (this._pullBuffer <= 0) return;
		if (now - this._lastPush < PUSH_HZ) return;
		this._lastPush = now;
		var n = this._pullBuffer; this._pullBuffer = 0;
		this.sendSync("p|" + this.gameId + "|" + this._selfTag() + "|" + n);
	};

	TugOfWar.prototype._applyPull = function (gameId, tag, count) {
		if (gameId !== this.gameId || !this.active) return;
		var p = this.players[tag] || this._addPlayer(tag, "", "r");
		if (!p) return;
		if (!p.isOwn) p.pulls += count;     // my own pulls were already counted locally
		// host integrates everyone's pulls into the authoritative flag
		if (this.hostTag === this._selfTag()) {
			this.flag += (p.team === "b" ? 1 : -1) * count * PULL_STEP;
			this.flag = clamp(this.flag, 0, 1);
		}
	};

	TugOfWar.prototype._applyFlag = function (gameId, flag) {
		if (gameId !== this.gameId) return;
		if (this.hostTag === this._selfTag()) return;   // I'm the source of truth, ignore echoes
		this.netFlag = clamp(flag, 0, 1);
	};

	TugOfWar.prototype._hostStep = function (now) {
		if (this.hostTag !== this._selfTag() || !this.active || this.winner) return;
		// gentle pull back to centre so a team must keep mashing to hold ground
		this.flag += (0.5 - this.flag) * DECAY;
		this.flag = clamp(this.flag, 0, 1);
		if (now - this._lastFlag > FLAG_HZ) {
			this._lastFlag = now;
			this.sendSync("f|" + this.gameId + "|" + Math.round(this.flag * 1000) + "|" + this._selfTag());
		}
		if (this.flag <= WIN_L) this._hostWin("r");
		else if (this.flag >= WIN_R) this._hostWin("b");
	};

	TugOfWar.prototype._hostWin = function (team) {
		if (this.winner) return;
		this.winner = team;
		var rT = 0, bT = 0, mvp = null;
		for (var t in this.players) {
			if (!this.players.hasOwnProperty(t)) continue;
			var p = this.players[t];
			if (p.team === "b") bT += p.pulls; else rT += p.pulls;
			if (!mvp || p.pulls > mvp.pulls) mvp = p;
		}
		this._mvp = mvp;
		this.sendSync("e|" + this.gameId + "|" + team + "|" + rT + "|" + bT + "|" + (mvp ? sanitize(mvp.name) : "") + "|" + (mvp ? mvp.pulls : 0) + "|" + this._selfTag());
		this._finishLocal(team, rT, bT, mvp ? mvp.name : "", mvp ? mvp.pulls : 0);
	};

	TugOfWar.prototype._applyEnd = function (gameId, team, rT, bT, mvpName, mvpPulls) {
		if (gameId !== this.gameId) return;
		this._finishLocal(team, rT, bT, mvpName, mvpPulls);
	};

	TugOfWar.prototype._finishLocal = function (team, rT, bT, mvpName, mvpPulls) {
		this.winner = team;
		this.active = false;
		this.ended = true;
		this._setCanvasInteractive(false);
		this.flag = this.netFlag = (team === "r" ? WIN_L : WIN_R);
		this._lastResult = { team: team, rT: rT, bT: bT, mvpName: mvpName, mvpPulls: mvpPulls };
		this._confetti(team);
		var first = this._finishedGameId !== this.gameId;
		this._finishedGameId = this.gameId;
		this._showResults();
		if (first && global.funSound) global.funSound("fanfare");
	};

	// ---- effects ---------------------------------------------------------

	TugOfWar.prototype._spawnPullSpark = function () {
		var fx = this._flagX(), side = this.team === "b" ? 1 : -1;
		for (var i = 0; i < 3; i++) {
			this.particles.push({
				x: fx, y: 0.5 + rand(-0.03, 0.03), vx: side * rand(0.004, 0.012), vy: rand(-0.004, 0.004),
				life: 1, decay: 0.06, size: rand(2, 4), color: this.team === "b" ? "#4ad6ff" : "#ff6b6b"
			});
		}
		if (this.particles.length > 200) this.particles.splice(0, this.particles.length - 200);
	};
	TugOfWar.prototype._confetti = function (team) {
		var color = team === "b" ? "#4ad6ff" : "#ff6b6b";
		for (var i = 0; i < 60; i++) {
			this.particles.push({
				x: rand(0.2, 0.8), y: rand(0.2, 0.5), vx: rand(-0.01, 0.01), vy: rand(0.002, 0.014),
				life: 1, decay: rand(0.01, 0.025), size: rand(3, 6),
				color: Math.random() < 0.5 ? color : (Math.random() < 0.5 ? "#ffd93d" : "#fff")
			});
		}
	};

	// ---- loop & render ---------------------------------------------------

	TugOfWar.prototype._loop = function () {
		var self = this;
		function tick() {
			self._raf = requestAnimationFrame(tick);
			var now = self.serverTime();
			if (self.active) { self._flushPulls(now); self._hostStep(now); }
			// non-host eases displayed flag toward authoritative value
			if (self.hostTag !== self._selfTag()) self.flag += (self.netFlag - self.flag) * 0.4;
			self._stepParticles();
			self._pulseL *= 0.85; self._pulseR *= 0.85;
			self._draw(now);
			if (Date.now() - (self._lastHud || 0) > 200) { self._lastHud = Date.now(); self._updateHud(); }
		}
		tick();
	};

	TugOfWar.prototype._stepParticles = function () {
		var ps = this.particles;
		for (var i = ps.length - 1; i >= 0; i--) {
			var p = ps[i];
			p.x += p.vx; p.y += p.vy; p.vy += 0.0005; p.vx *= 0.97;
			p.life -= p.decay;
			if (p.life <= 0) ps.splice(i, 1);
		}
	};

	TugOfWar.prototype._flagX = function () { return 0.12 + this.flag * 0.76; };  // map 0..1 → screen band

	TugOfWar.prototype._draw = function (now) {
		var ctx = this.ctx, canvas = this.canvas;
		if (!ctx || !canvas) return;
		var rect = canvas.getBoundingClientRect();
		var w = rect.width, h = rect.height;
		ctx.clearRect(0, 0, w, h);
		if (!this.visible) return;

		// team-tinted halves
		var fx = this._flagX();
		ctx.fillStyle = "rgba(150,40,40," + (0.28 + this._pulseL * 0.25) + ")";
		ctx.fillRect(0, 0, fx * w, h);
		ctx.fillStyle = "rgba(40,90,160," + (0.28 + this._pulseR * 0.25) + ")";
		ctx.fillRect(fx * w, 0, w - fx * w, h);

		if (!this.active && !this.ended) { this._drawLobby(ctx, w, h); return; }

		var midY = h * 0.5;
		// win lines
		ctx.strokeStyle = "rgba(255,255,255,0.35)";
		ctx.setLineDash([6, 6]); ctx.lineWidth = 2;
		[WIN_L, WIN_R].forEach(function (v) {
			var x = (0.12 + v * 0.76) * w;
			ctx.beginPath(); ctx.moveTo(x, h * 0.2); ctx.lineTo(x, h * 0.8); ctx.stroke();
		});
		ctx.setLineDash([]);
		// centre line
		ctx.strokeStyle = "rgba(255,255,255,0.25)";
		ctx.beginPath(); ctx.moveTo(w / 2, h * 0.18); ctx.lineTo(w / 2, h * 0.82); ctx.stroke();

		// rope
		ctx.strokeStyle = "#c9a36b"; ctx.lineWidth = Math.max(4, h * 0.012);
		ctx.beginPath(); ctx.moveTo(0.06 * w, midY); ctx.lineTo(0.94 * w, midY); ctx.stroke();

		// flag / knot
		var kx = fx * w;
		ctx.fillStyle = "#ffd93d";
		ctx.beginPath(); ctx.arc(kx, midY, Math.max(8, h * 0.022), 0, Math.PI * 2); ctx.fill();
		ctx.strokeStyle = "#a8791f"; ctx.lineWidth = 3; ctx.stroke();
		ctx.font = Math.round(h * 0.05) + "px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
		ctx.fillText("🚩", kx, midY - h * 0.06);

		this._drawParticles(ctx, w, h);

		// team labels + tallies
		ctx.textBaseline = "top";
		ctx.textAlign = "left";
		ctx.fillStyle = "#ff9d9d"; ctx.font = "700 " + Math.max(14, Math.round(h * 0.026)) + "px Verdana, sans-serif";
		ctx.fillText("🔴 RED", 18, 16);
		ctx.textAlign = "right";
		ctx.fillStyle = "#9dc6ff";
		ctx.fillText("BLUE 🔵", w - 18, 16);
		this._drawTeam(ctx, w, h, "r", false);
		this._drawTeam(ctx, w, h, "b", true);

		if (this.winner && this.ended) {
			ctx.textAlign = "center"; ctx.textBaseline = "middle";
			ctx.fillStyle = this.winner === "b" ? "#9dc6ff" : "#ff9d9d";
			ctx.font = "700 " + Math.round(Math.min(w, h) * 0.09) + "px Verdana, sans-serif";
			ctx.fillText((this.winner === "b" ? "BLUE" : "RED") + " WINS! 🏆", w / 2, h * 0.3);
		}
	};

	TugOfWar.prototype._drawTeam = function (ctx, w, h, team, right) {
		var arr = this._teamMembers(team);
		var y = 16 + h * 0.04;
		ctx.font = "600 " + Math.max(11, Math.round(h * 0.019)) + "px Verdana, sans-serif";
		ctx.textBaseline = "top";
		ctx.textAlign = right ? "right" : "left";
		for (var i = 0; i < arr.length && i < 8; i++) {
			var p = arr[i];
			ctx.fillStyle = p.isOwn ? "#8fe6a3" : "rgba(255,255,255,0.82)";
			var label = p.name + (p.isOwn ? " (you)" : "") + " · " + p.pulls;
			ctx.fillText(label, right ? w - 18 : 18, y);
			y += h * 0.026;
		}
	};

	TugOfWar.prototype._drawParticles = function (ctx, w, h) {
		var ps = this.particles;
		for (var i = 0; i < ps.length; i++) {
			var p = ps[i];
			ctx.globalAlpha = clamp(p.life, 0, 1);
			ctx.fillStyle = p.color;
			ctx.beginPath(); ctx.arc(p.x * w, p.y * h, p.size, 0, Math.PI * 2); ctx.fill();
		}
		ctx.globalAlpha = 1;
	};

	TugOfWar.prototype._drawLobby = function (ctx, w, h) {
		ctx.textAlign = "center"; ctx.textBaseline = "middle";
		ctx.fillStyle = "rgba(255,255,255,0.92)";
		ctx.font = "700 " + Math.round(Math.min(w, h) * 0.05) + "px Verdana, sans-serif";
		ctx.fillText("🪢 Tug of War — Lobby", w / 2, h * 0.22);
		var red = this._teamMembers("r"), blue = this._teamMembers("b");
		ctx.font = "700 " + Math.round(Math.min(w, h) * 0.03) + "px Verdana, sans-serif";
		ctx.fillStyle = "#ff9d9d"; ctx.fillText("🔴 RED (" + red.length + ")", w * 0.28, h * 0.34);
		ctx.fillStyle = "#9dc6ff"; ctx.fillText("BLUE 🔵 (" + blue.length + ")", w * 0.72, h * 0.34);
		ctx.font = "600 " + Math.round(Math.min(w, h) * 0.024) + "px Verdana, sans-serif";
		this._lobbyList(ctx, red, w * 0.28, h * 0.42, h);
		this._lobbyList(ctx, blue, w * 0.72, h * 0.42, h);
		ctx.fillStyle = "rgba(255,255,255,0.6)";
		ctx.font = "600 " + Math.round(Math.min(w, h) * 0.022) + "px Verdana, sans-serif";
		ctx.fillText(this.joined ? "press Start — then MASH to pull the flag to your side!" : "press Join to pick a team", w / 2, h * 0.8);
	};
	TugOfWar.prototype._lobbyList = function (ctx, arr, cx, y, h) {
		ctx.textAlign = "center";
		for (var i = 0; i < arr.length; i++) {
			ctx.fillStyle = arr[i].isOwn ? "#8fe6a3" : "rgba(255,255,255,0.88)";
			ctx.fillText(arr[i].name + (arr[i].isOwn ? " (you)" : ""), cx, y);
			y += h * 0.04;
		}
	};

	// ---- input -----------------------------------------------------------

	TugOfWar.prototype._bindKeys = function () {
		var self = this;
		this._onKey = function (e) {
			if (!self.active || !self.joined) return;
			if (e.code === "Space" || e.key === " ") { self._mash(); e.preventDefault(); }
		};
		window.addEventListener("keydown", this._onKey);
	};

	// ---- UI scaffolding --------------------------------------------------

	TugOfWar.prototype._buildUi = function () {
		var self = this;
		var canvas = document.createElement("canvas");
		canvas.className = "tug-canvas";
		canvas.setAttribute("hidden", "hidden");
		document.body.appendChild(canvas);
		this.canvas = canvas;
		this.ctx = canvas.getContext("2d");
		var mash = function (e) { if (self.active) { e.preventDefault(); self._mash(); } };
		canvas.addEventListener("mousedown", mash);
		canvas.addEventListener("touchstart", mash, { passive: false });

		var bar = document.createElement("div");
		bar.className = "party-bar tug-bar";
		bar.setAttribute("hidden", "hidden");
		bar.innerHTML =
			'<span class="tug-emoji">🪢</span>' +
			'<span class="tug-status">Tug of War</span>' +
			'<span class="tug-info"></span>' +
			'<button type="button" class="tug-join party-btn">Join</button>' +
			'<button type="button" class="tug-switch party-btn" title="Switch team">⇄</button>' +
			'<button type="button" class="tug-start party-btn">Start 💪</button>' +
			'<button type="button" class="tug-close party-btn" title="Close">×</button>';
		document.body.appendChild(bar);
		this.bar = bar;
		this.elStatus = bar.querySelector(".tug-status");
		this.elInfo = bar.querySelector(".tug-info");
		this.elJoin = bar.querySelector(".tug-join");
		this.elSwitch = bar.querySelector(".tug-switch");
		this.elStart = bar.querySelector(".tug-start");
		this.elJoin.addEventListener("click", function (e) { e.stopPropagation(); self.joined ? self.leave() : self.join(); });
		this.elSwitch.addEventListener("click", function (e) { e.stopPropagation(); self.switchTeam(); });
		this.elStart.addEventListener("click", function (e) { e.stopPropagation(); self.startMatch(); });
		bar.querySelector(".tug-close").addEventListener("click", function (e) { e.stopPropagation(); self.setVisible(false); });

		// giant MASH button shown during a match
		var mashBtn = document.createElement("button");
		mashBtn.type = "button";
		mashBtn.className = "tug-mash";
		mashBtn.textContent = "MASH! 💪";
		mashBtn.setAttribute("hidden", "hidden");
		var go = function (e) { e.preventDefault(); e.stopPropagation(); self._mash(); };
		mashBtn.addEventListener("mousedown", go);
		mashBtn.addEventListener("touchstart", go, { passive: false });
		document.body.appendChild(mashBtn);
		this.mashBtn = mashBtn;

		var res = document.createElement("div");
		res.className = "tug-results";
		res.setAttribute("hidden", "hidden");
		res.innerHTML =
			'<div class="tug-results-card">' +
			'<div class="tug-results-title">🪢 Tug of War — Result</div>' +
			'<div class="tug-winner"></div>' +
			'<div class="tug-tally"></div>' +
			'<div class="tug-mvp"></div>' +
			'<div class="tug-results-actions">' +
			'<button type="button" class="tug-again party-btn">Rematch 💪</button>' +
			'<button type="button" class="tug-dismiss party-btn">Close</button>' +
			'</div></div>';
		document.body.appendChild(res);
		this.results = res;
		res.querySelector(".tug-again").addEventListener("click", function (e) { e.stopPropagation(); self._hideResults(); self.startMatch(); });
		res.querySelector(".tug-dismiss").addEventListener("click", function (e) { e.stopPropagation(); self._hideResults(); });

		this._resize();
		window.addEventListener("resize", function () { self._resize(); });
	};

	TugOfWar.prototype._resize = function () {
		if (!this.canvas) return;
		var dpr = window.devicePixelRatio || 1;
		var w = window.innerWidth, h = window.innerHeight;
		this.canvas.width = Math.max(1, Math.floor(w * dpr));
		this.canvas.height = Math.max(1, Math.floor(h * dpr));
		this.canvas.style.width = w + "px";
		this.canvas.style.height = h + "px";
		this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	};

	TugOfWar.prototype._setCanvasInteractive = function (on) {
		if (this.canvas) this.canvas.classList.toggle("tug-live", !!on);
		if (this.mashBtn) { if (on) this.mashBtn.removeAttribute("hidden"); else this.mashBtn.setAttribute("hidden", "hidden"); }
	};

	TugOfWar.prototype.setVisible = function (on) {
		this.visible = !!on;
		if (this.bar) { if (this.visible) this.bar.removeAttribute("hidden"); else this.bar.setAttribute("hidden", "hidden"); }
		if (this.canvas) {
			if (this.visible) this.canvas.removeAttribute("hidden");
			else if (!this.active) this.canvas.setAttribute("hidden", "hidden");
		}
		if (this.visible) { this._resize(); if (this._canBroadcast()) this.requestSync(); }
		else { this._hideResults(); this._setCanvasInteractive(false); }
		this._updateHud();
		this.onLayoutChange();
	};

	TugOfWar.prototype._flash = function (text) { if (this.elStatus) this.elStatus.textContent = text; };
	TugOfWar.prototype._updateHud = function () {
		if (this.elJoin) { this.elJoin.textContent = this.joined ? "Leave" : "Join"; this.elJoin.disabled = this.active; }
		if (this.elSwitch) this.elSwitch.disabled = this.active || !this.joined;
		if (this.elStart) this.elStart.disabled = this.active;
		if (this.elInfo) {
			var r = this._teamMembers("r").length, b = this._teamMembers("b").length;
			this.elInfo.textContent = "🔴" + r + " vs " + b + "🔵";
		}
	};

	TugOfWar.prototype._showResults = function () {
		if (!this.results || !this._lastResult) return;
		var r = this._lastResult;
		var winEl = this.results.querySelector(".tug-winner");
		var tallyEl = this.results.querySelector(".tug-tally");
		var mvpEl = this.results.querySelector(".tug-mvp");
		var myWin = this.players[this._selfTag()] && this.players[this._selfTag()].team === r.team;
		winEl.innerHTML = (r.team === "b" ? "🔵 BLUE" : "🔴 RED") + " team wins!" + (this.joined ? (myWin ? " 🎉 (that's you!)" : " 😤") : "");
		winEl.style.color = r.team === "b" ? "#9dc6ff" : "#ff9d9d";
		tallyEl.innerHTML = 'Total pulls — 🔴 <b>' + r.rT + '</b> &nbsp;vs&nbsp; <b>' + r.bT + '</b> 🔵';
		mvpEl.innerHTML = r.mvpName ? ('💪 MVP: <b>' + esc(r.mvpName) + '</b> with ' + r.mvpPulls + ' pulls') : "";
		this.results.removeAttribute("hidden");
	};
	TugOfWar.prototype._hideResults = function () {
		if (this.results) this.results.setAttribute("hidden", "hidden");
		if (!this.active) { this.ended = false; this.winner = null; this.flag = this.netFlag = 0.5; }
	};

	TugOfWar.prototype.destroy = function () {
		if (this._raf) cancelAnimationFrame(this._raf);
		window.removeEventListener("keydown", this._onKey);
	};

	global.TugOfWar = TugOfWar;
})(typeof window !== "undefined" ? window : this);
