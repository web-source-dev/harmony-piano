/**
 * Reaction Royale — a synced room-wide reflex showdown.
 *
 * Everyone joins, the screen goes RED ("wait for green…"), and after a random
 * delay it flips GREEN for the whole room at the exact same instant. Fastest tap
 * wins the round; tap before green and you false-start (out for that round). Best
 * score over several rounds is crowned champion.
 *
 * Sync model (mirrors the other games):
 *   - One client (whoever pressed Start) is the HOST. It picks the shared GREEN
 *     moment as a serverTime `goAt` and broadcasts it; every client flips to
 *     green when its serverTime reaches goAt, so the light turns at once for all.
 *   - Each tap is broadcast with its reaction time. The host is the single
 *     authority that resolves the round (fastest valid tap), awards the point,
 *     and broadcasts the authoritative scoreboard — so no one disagrees.
 *   Transport: the "RR|" prefix over the relay / chat fallback.
 */
(function (global) {
	"use strict";

	var SYNC_PREFIX = "RR|";
	var ROUNDS = 5;
	var MIN_WAIT = 1800, MAX_WAIT = 5500;   // random red→green delay
	var ROUND_TIMEOUT = 5000;                // ms after green before slowpokes forfeit
	var BETWEEN_MS = 2800;                   // pause showing the round result

	function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
	function rand(a, b) { return a + Math.random() * (b - a); }
	function sanitize(s) { return String(s == null ? "" : s).replace(/[|;,:]/g, " ").slice(0, 20); }
	function esc(s) {
		return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
			return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c];
		});
	}

	function ReactionRoyale(opts) {
		opts = opts || {};
		this.client = opts.client;
		this.onLayoutChange = opts.onLayoutChange || function () {};

		this.visible = false;
		this.active = false;
		this.ended = false;
		this.joined = false;
		this.gameId = null;
		this.hostTag = null;
		this.totalRounds = ROUNDS;
		this.round = 0;
		this.goAt = 0;
		this.phase = "lobby";       // lobby | intro | waiting | go | between | done
		this.players = {};          // tag -> { name, hue, score, tapped, reaction, isOwn }
		this.lastRoundWinner = null;

		this._tag = null;
		this._seq = 0;
		this._roundSeq = 0;
		this._roundResolved = false;
		this._roundDeadline = 0;
		this._greenSoundAt = 0;
		this._finishedGameId = null;
		this._nextTimer = null;
		this.ignoreSelfUntil = 0;
		this._flashUntil = 0;

		this._buildUi();
		this._loop();
	}

	ReactionRoyale.SYNC_PREFIX = SYNC_PREFIX;
	ReactionRoyale.isSyncText = function (text) {
		return !!(text && typeof text === "string" && text.indexOf(SYNC_PREFIX) === 0);
	};

	ReactionRoyale.prototype.serverTime = function () { return Date.now() + (this.client.serverTimeOffset || 0); };

	ReactionRoyale.prototype._selfTag = function () {
		if (this._tag) return this._tag;
		this._tag = (Math.floor(rand(0, 1e9)).toString(36) + Math.floor(rand(0, 1e9)).toString(36)).slice(0, 10);
		return this._tag;
	};
	ReactionRoyale.prototype._selfName = function () {
		var me = this.client.getOwnParticipant && this.client.getOwnParticipant();
		return sanitize((me && me.name) || "Player") || "Player";
	};
	ReactionRoyale.prototype._hueOf = function (tag) {
		var h = 0; for (var i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) % 360; return h;
	};
	ReactionRoyale.prototype._canBroadcast = function () {
		if (!this.client) return false;
		return !!(this.client.roomSync && this.client.roomSync.isConnected());
	};

	// ---- networking ------------------------------------------------------

	ReactionRoyale.prototype.sendSync = function (payload) {
		if (!this._canBroadcast()) return;
		var msg = SYNC_PREFIX + payload;
		if (msg.length > 512) return;
		this.ignoreSelfUntil = Date.now() + 400;
		this.client.broadcastRoom(msg);
	};
	ReactionRoyale.prototype.requestSync = function () { this.sendSync("q|" + this._selfTag()); };

	ReactionRoyale.prototype.tryHandleChat = function (msg) {
		var text = msg.a != null ? msg.a : (msg.message != null ? msg.message : "");
		if (!ReactionRoyale.isSyncText(text)) return false;
		var parts = text.slice(SYNC_PREFIX.length).split("|");
		var cmd = parts[0];
		var senderTag = parts[parts.length - 1];

		if (cmd === "j") this._addPlayer(parts[1], parts[2], parseInt(parts[3], 10) || 0);
		else if (cmd === "l") this._removePlayer(parts[1]);
		else if (cmd === "s") this._applyStart(parts[1], parts[2], parseInt(parts[3], 10) || ROUNDS);
		else if (cmd === "r") this._applyRound(parts[1], parseInt(parts[2], 10) || 1, parseFloat(parts[3]) || 0);
		else if (cmd === "t") this._applyTap(parts[1], parseInt(parts[2], 10) || 0, parts[3], parseFloat(parts[4]));
		else if (cmd === "rs") this._applyRoundResult(parts[1], parseInt(parts[2], 10) || 0, parts[3], parseFloat(parts[4]), parts[5]);
		else if (cmd === "e") this._applyEnd(parts[1], parts[2]);
		else if (cmd === "q") { if (senderTag !== this._selfTag()) this._answerQuery(); }
		return true;
	};

	ReactionRoyale.prototype._answerQuery = function () {
		var self = this;
		setTimeout(function () {
			if (self.joined) self._broadcastJoin();
			if (self.active && self.hostTag === self._selfTag()) {
				self.sendSync("s|" + self.gameId + "|" + self.hostTag + "|" + self.totalRounds);
				if (self.phase === "waiting" || self.phase === "go") {
					self.sendSync("r|" + self.gameId + "|" + self.round + "|" + Math.round(self.goAt) + "|" + self.hostTag);
				}
			}
		}, 40 + Math.random() * 200);
	};

	// ---- roster ----------------------------------------------------------

	ReactionRoyale.prototype._addPlayer = function (tag, name, hue) {
		if (!tag) return null;
		var p = this.players[tag];
		if (!p) {
			p = this.players[tag] = {
				tag: tag, name: sanitize(name) || "Player", hue: hue || this._hueOf(tag),
				score: 0, tapped: false, reaction: null, isOwn: tag === this._selfTag()
			};
		} else if (name) p.name = sanitize(name);
		this._updateHud();
		return p;
	};
	ReactionRoyale.prototype._removePlayer = function (tag) { if (this.players[tag]) { delete this.players[tag]; this._updateHud(); } };
	ReactionRoyale.prototype._roster = function () {
		var a = []; for (var t in this.players) if (this.players.hasOwnProperty(t)) a.push(this.players[t]);
		a.sort(function (x, y) { return y.score - x.score || (x.tag < y.tag ? -1 : 1); });
		return a;
	};

	ReactionRoyale.prototype.join = function () {
		if (this.active) { this._flash("wait for this match to finish!"); return; }
		if (!this._canBroadcast()) { this._flash("connect to a room first!"); return; }
		this.joined = true;
		this._addPlayer(this._selfTag(), this._selfName(), this._hueOf(this._selfTag()));
		this._broadcastJoin();
		this._flash("you're in! press Start 🚦");
		if (global.funSound) global.funSound("coin");
	};
	ReactionRoyale.prototype.leave = function () {
		if (this.active) { this._flash("can't leave mid-match!"); return; }
		this.joined = false;
		this._removePlayer(this._selfTag());
		this.sendSync("l|" + this._selfTag());
	};
	ReactionRoyale.prototype._broadcastJoin = function () {
		this.sendSync("j|" + this._selfTag() + "|" + this._selfName() + "|" + this._hueOf(this._selfTag()));
	};

	// ---- match flow ------------------------------------------------------

	ReactionRoyale.prototype.startMatch = function () {
		if (this.active) return;
		if (!this._canBroadcast()) { this._flash("connect to a room first!"); return; }
		if (!this.joined) this.join();
		this._roundSeq++;
		this.gameId = this._selfTag() + "-" + this._roundSeq;
		this.hostTag = this._selfTag();
		this.totalRounds = ROUNDS;
		this.sendSync("s|" + this.gameId + "|" + this.hostTag + "|" + this.totalRounds);
		this._applyStart(this.gameId, this.hostTag, this.totalRounds);
		var self = this;
		this._clearTimer();
		this._nextTimer = setTimeout(function () { self._hostStartRound(); }, 1400);
	};

	ReactionRoyale.prototype._applyStart = function (gameId, hostTag, totalRounds) {
		if (!gameId) return;
		this.gameId = gameId;
		this.hostTag = hostTag || null;
		this.totalRounds = totalRounds || ROUNDS;
		this.active = true;
		this.ended = false;
		this.round = 0;
		this.phase = "intro";
		this.lastRoundWinner = null;
		for (var t in this.players) {
			if (this.players.hasOwnProperty(t)) { this.players[t].score = 0; this.players[t].tapped = false; this.players[t].reaction = null; }
		}
		this._hideResults();
		if (!this.visible) this.setVisible(true);
		this._setCanvasInteractive(this.joined);
		this._flash("get ready… 🚦");
		this._updateHud();
	};

	ReactionRoyale.prototype._hostStartRound = function () {
		if (!this.active || this.hostTag !== this._selfTag()) return;
		this.round++;
		var goAt = this.serverTime() + rand(MIN_WAIT, MAX_WAIT);
		this._roundResolved = false;
		this._roundDeadline = goAt + ROUND_TIMEOUT;
		this._applyRound(this.gameId, this.round, goAt);
		this.sendSync("r|" + this.gameId + "|" + this.round + "|" + Math.round(goAt) + "|" + this.hostTag);
	};

	ReactionRoyale.prototype._applyRound = function (gameId, round, goAt) {
		if (gameId !== this.gameId) { if (!this.active) { this.gameId = gameId; this.active = true; } else return; }
		if (this.round === round && this.goAt === goAt && this.phase === "waiting") return;
		this.round = round;
		this.goAt = goAt;
		this.phase = "waiting";
		this.ended = false;
		for (var t in this.players) {
			if (this.players.hasOwnProperty(t)) { this.players[t].tapped = false; this.players[t].reaction = null; }
		}
		this._flash("wait for GREEN…");
	};

	ReactionRoyale.prototype._tap = function () {
		if (!this.active || !this.joined) return;
		var p = this.players[this._selfTag()];
		if (!p || p.tapped) return;
		var now = this.serverTime();
		if (this.phase === "waiting") {
			// jumped the gun → false start for this round
			p.tapped = true; p.reaction = -1;
			this._flash("😬 TOO EARLY! you're out this round");
			if (global.funSound) global.funSound("spooky");
			this.sendSync("t|" + this.gameId + "|" + this.round + "|" + this._selfTag() + "|-1|" + this._selfTag());
		} else if (this.phase === "go") {
			var rt = Math.max(1, Math.round(now - this.goAt));
			p.tapped = true; p.reaction = rt;
			this._flash("⚡ " + (rt / 1000).toFixed(3) + "s!");
			if (global.funSound) global.funSound("blip");
			this.sendSync("t|" + this.gameId + "|" + this.round + "|" + this._selfTag() + "|" + rt + "|" + this._selfTag());
		}
	};

	ReactionRoyale.prototype._applyTap = function (gameId, round, tag, reaction) {
		if (gameId !== this.gameId || round !== this.round) return;
		var p = this.players[tag] || this._addPlayer(tag, "", this._hueOf(tag));
		if (!p) return;
		if (!p.tapped) { p.tapped = true; p.reaction = (reaction == null ? -1 : reaction); }
	};

	// Host only: decide the round once everyone has tapped or the clock runs out.
	ReactionRoyale.prototype._maybeResolveRound = function (now) {
		if (this.hostTag !== this._selfTag() || !this.active) return;
		if (this.phase !== "waiting" && this.phase !== "go") return;
		if (this._roundResolved) return;
		var all = true, any = false;
		for (var t in this.players) {
			if (!this.players.hasOwnProperty(t)) continue;
			any = true;
			if (!this.players[t].tapped) all = false;
		}
		if (!any) return;
		if (!all && now < this._roundDeadline) return;

		this._roundResolved = true;
		var best = null;
		for (var k in this.players) {
			if (!this.players.hasOwnProperty(k)) continue;
			var pl = this.players[k];
			if (pl.reaction != null && pl.reaction >= 0 && (best === null || pl.reaction < best.reaction)) best = pl;
		}
		if (best) best.score++;
		var winTag = best ? best.tag : "";
		var winRt = best ? best.reaction : 0;
		this.sendSync("rs|" + this.gameId + "|" + this.round + "|" + winTag + "|" + Math.round(winRt) + "|" + this._encodeScores());
		this._enterBetween(winTag, winRt);
		var self = this;
		this._clearTimer();
		this._nextTimer = setTimeout(function () {
			if (!self.active) return;
			if (self.round >= self.totalRounds) self._hostEndMatch();
			else self._hostStartRound();
		}, BETWEEN_MS);
	};

	ReactionRoyale.prototype._applyRoundResult = function (gameId, round, winTag, winRt, scoreStr) {
		if (gameId !== this.gameId) return;
		this._decodeScores(scoreStr);
		this._enterBetween(winTag, winRt);
	};

	ReactionRoyale.prototype._enterBetween = function (winTag, winRt) {
		this.phase = "between";
		this.lastRoundWinner = winTag ? { tag: winTag, rt: winRt, name: (this.players[winTag] ? this.players[winTag].name : "someone") } : null;
		if (this.lastRoundWinner) {
			var mine = winTag === this._selfTag();
			this._flash(mine ? "🏅 you won the round!" : "🏅 " + this.lastRoundWinner.name + " won (" + (winRt / 1000).toFixed(3) + "s)");
			if (global.funSound) global.funSound(mine ? "coin" : "blip");
		} else this._flash("nobody got it 😂");
		this._updateHud();
	};

	ReactionRoyale.prototype._hostEndMatch = function () {
		if (this.hostTag !== this._selfTag()) return;
		this.sendSync("e|" + this.gameId + "|" + this._encodeScores() + "|" + this._selfTag());
		this._applyEnd(this.gameId, this._encodeScores());
	};
	ReactionRoyale.prototype._applyEnd = function (gameId, scoreStr) {
		if (gameId !== this.gameId) return;
		this._decodeScores(scoreStr);
		this.active = false;
		this.ended = true;
		this.phase = "done";
		this._clearTimer();
		this._setCanvasInteractive(false);
		this._finish(gameId);
	};
	ReactionRoyale.prototype._finish = function (gameId) {
		var first = this._finishedGameId !== gameId;
		this._finishedGameId = gameId;
		this._showResults();
		if (first && global.funSound) global.funSound("fanfare");
	};

	ReactionRoyale.prototype._encodeScores = function () {
		var arr = this._roster(), out = [];
		for (var i = 0; i < arr.length; i++) out.push(arr[i].tag + ":" + arr[i].score + ":" + sanitize(arr[i].name));
		return out.join(";");
	};
	ReactionRoyale.prototype._decodeScores = function (str) {
		if (!str) return;
		var entries = str.split(";");
		for (var i = 0; i < entries.length; i++) {
			var f = entries[i].split(":");
			if (!f[0]) continue;
			var p = this.players[f[0]] || this._addPlayer(f[0], f[2], this._hueOf(f[0]));
			if (!p) continue;
			p.score = parseInt(f[1], 10) || 0;
			if (f[2]) p.name = sanitize(f[2]);
		}
	};

	// ---- loop & render ---------------------------------------------------

	ReactionRoyale.prototype._loop = function () {
		var self = this;
		function tick() {
			self._raf = requestAnimationFrame(tick);
			var now = self.serverTime();
			if (self.active) {
				if (self.phase === "waiting" && now >= self.goAt) {
					self.phase = "go";
					self._greenSoundAt = now;
					if (global.funSound) global.funSound("sparkle");
				}
				self._maybeResolveRound(now);
			}
			self._draw(now);
			if (Date.now() - (self._lastHud || 0) > 200) { self._lastHud = Date.now(); self._updateHud(); }
		}
		tick();
	};

	ReactionRoyale.prototype._draw = function (now) {
		var ctx = this.ctx, canvas = this.canvas;
		if (!ctx || !canvas) return;
		var rect = canvas.getBoundingClientRect();
		var w = rect.width, h = rect.height;
		ctx.clearRect(0, 0, w, h);
		if (!this.visible) return;

		// backdrop colour by phase
		var bg = "rgba(18, 24, 38, 0.55)";
		if (this.phase === "waiting") bg = "rgba(150, 30, 36, 0.82)";
		else if (this.phase === "go") bg = "rgba(28, 165, 80, 0.85)";
		ctx.fillStyle = bg;
		ctx.fillRect(0, 0, w, h);

		ctx.textAlign = "center"; ctx.textBaseline = "middle";
		var cx = w / 2, big = Math.round(Math.min(w, h) * 0.12);
		var me = this.players[this._selfTag()];

		if (!this.active) {
			this._drawLobby(ctx, w, h);
		} else if (this.phase === "intro") {
			ctx.fillStyle = "#fff";
			ctx.font = "700 " + big + "px Verdana, sans-serif";
			ctx.fillText("Get ready!", cx, h * 0.4);
			ctx.font = "600 " + Math.round(big * 0.4) + "px Verdana, sans-serif";
			ctx.fillStyle = "rgba(255,255,255,0.8)";
			ctx.fillText("Round 1 of " + this.totalRounds, cx, h * 0.52);
		} else if (this.phase === "waiting") {
			ctx.fillStyle = "#fff";
			ctx.font = "700 " + big + "px Verdana, sans-serif";
			ctx.fillText("WAIT FOR GREEN…", cx, h * 0.4);
			ctx.font = "600 " + Math.round(big * 0.45) + "px Verdana, sans-serif";
			ctx.fillText("🔴", cx, h * 0.56);
			if (me && me.tapped && me.reaction === -1) {
				ctx.fillStyle = "#ffd93d";
				ctx.font = "700 " + Math.round(big * 0.42) + "px Verdana, sans-serif";
				ctx.fillText("😬 too early — out this round!", cx, h * 0.7);
			}
		} else if (this.phase === "go") {
			ctx.fillStyle = "#fff";
			ctx.font = "700 " + Math.round(big * 1.2) + "px Verdana, sans-serif";
			ctx.fillText("TAP!!!", cx, h * 0.38);
			if (me && me.tapped && me.reaction >= 0) {
				ctx.font = "700 " + Math.round(big * 0.5) + "px Verdana, sans-serif";
				ctx.fillText("⚡ " + (me.reaction / 1000).toFixed(3) + "s", cx, h * 0.56);
			} else {
				ctx.font = "600 " + Math.round(big * 0.4) + "px Verdana, sans-serif";
				ctx.fillText(this.joined ? "🟢 tap now!" : "watching…", cx, h * 0.56);
			}
		} else if (this.phase === "between") {
			ctx.fillStyle = "#fff";
			ctx.font = "700 " + Math.round(big * 0.7) + "px Verdana, sans-serif";
			if (this.lastRoundWinner) ctx.fillText("🏅 " + this.lastRoundWinner.name, cx, h * 0.36);
			else ctx.fillText("nobody got it 😂", cx, h * 0.36);
			if (this.lastRoundWinner) {
				ctx.font = "600 " + Math.round(big * 0.42) + "px Verdana, sans-serif";
				ctx.fillStyle = "#ffd93d";
				ctx.fillText((this.lastRoundWinner.rt / 1000).toFixed(3) + "s", cx, h * 0.46);
			}
		}

		// round + scoreboard strip (when in a match)
		if (this.active) {
			ctx.fillStyle = "rgba(255,255,255,0.92)";
			ctx.textAlign = "left"; ctx.textBaseline = "top";
			ctx.font = "700 " + Math.max(13, Math.round(h * 0.022)) + "px Verdana, sans-serif";
			ctx.fillText("Round " + this.round + " / " + this.totalRounds, 16, 14);
			this._drawScores(ctx, w, h);
		}
	};

	ReactionRoyale.prototype._drawScores = function (ctx, w, h) {
		var arr = this._roster();
		var y = 14 + h * 0.035;
		ctx.textAlign = "left"; ctx.textBaseline = "top";
		ctx.font = "600 " + Math.max(11, Math.round(h * 0.019)) + "px Verdana, sans-serif";
		for (var i = 0; i < arr.length && i < 8; i++) {
			var p = arr[i];
			ctx.fillStyle = "hsl(" + p.hue + ",75%,62%)";
			ctx.fillText("●", 16, y);
			ctx.fillStyle = p.isOwn ? "#8fe6a3" : "rgba(255,255,255,0.85)";
			var tail = p.reaction != null ? (p.reaction < 0 ? " ✗" : " " + (p.reaction / 1000).toFixed(2) + "s") : (p.tapped ? "" : "");
			ctx.fillText(p.name + (p.isOwn ? " (you)" : "") + "  —  " + p.score + tail, 34, y);
			y += h * 0.028;
		}
	};

	ReactionRoyale.prototype._drawLobby = function (ctx, w, h) {
		var arr = this._roster();
		ctx.fillStyle = "rgba(255,255,255,0.92)";
		ctx.textAlign = "center"; ctx.textBaseline = "middle";
		ctx.font = "700 " + Math.round(Math.min(w, h) * 0.05) + "px Verdana, sans-serif";
		ctx.fillText("⚡ Reaction Royale — Lobby", w / 2, h * 0.26);
		ctx.font = "600 " + Math.round(Math.min(w, h) * 0.026) + "px Verdana, sans-serif";
		ctx.fillStyle = "rgba(255,255,255,0.7)";
		ctx.fillText(arr.length ? (arr.length + " player" + (arr.length > 1 ? "s" : "") + " — press Start!") : "Press Join to play", w / 2, h * 0.34);
		var y = h * 0.43;
		for (var i = 0; i < arr.length; i++) {
			var p = arr[i];
			ctx.fillStyle = "hsl(" + p.hue + ",75%,60%)";
			ctx.beginPath(); ctx.arc(w / 2 - h * 0.1, y, h * 0.015, 0, Math.PI * 2); ctx.fill();
			ctx.fillStyle = p.isOwn ? "#8fe6a3" : "rgba(255,255,255,0.9)";
			ctx.textAlign = "left";
			ctx.fillText(p.name + (p.isOwn ? " (you)" : ""), w / 2 - h * 0.075, y);
			ctx.textAlign = "center";
			y += h * 0.05;
		}
		ctx.fillStyle = "rgba(255,255,255,0.5)";
		ctx.font = "600 " + Math.round(Math.min(w, h) * 0.02) + "px Verdana, sans-serif";
		ctx.fillText("wait for the screen to turn 🟢 then tap — fastest wins. tapping on 🔴 = out!", w / 2, h * 0.82);
	};

	// ---- UI scaffolding --------------------------------------------------

	ReactionRoyale.prototype._buildUi = function () {
		var self = this;
		var canvas = document.createElement("canvas");
		canvas.className = "reaction-canvas";
		canvas.setAttribute("hidden", "hidden");
		document.body.appendChild(canvas);
		this.canvas = canvas;
		this.ctx = canvas.getContext("2d");
		var tap = function (e) { if (self.active) { e.preventDefault(); self._tap(); } };
		canvas.addEventListener("mousedown", tap);
		canvas.addEventListener("touchstart", tap, { passive: false });

		var bar = document.createElement("div");
		bar.className = "party-bar reaction-bar";
		bar.setAttribute("hidden", "hidden");
		bar.innerHTML =
			'<span class="reaction-emoji">⚡</span>' +
			'<span class="reaction-status">Reaction Royale</span>' +
			'<span class="reaction-info"></span>' +
			'<button type="button" class="reaction-join party-btn">Join</button>' +
			'<button type="button" class="reaction-start party-btn">Start 🚦</button>' +
			'<button type="button" class="reaction-close party-btn" title="Close">×</button>';
		document.body.appendChild(bar);
		this.bar = bar;
		this.elStatus = bar.querySelector(".reaction-status");
		this.elInfo = bar.querySelector(".reaction-info");
		this.elJoin = bar.querySelector(".reaction-join");
		this.elStart = bar.querySelector(".reaction-start");
		this.elJoin.addEventListener("click", function (e) { e.stopPropagation(); self.joined ? self.leave() : self.join(); });
		this.elStart.addEventListener("click", function (e) { e.stopPropagation(); self.startMatch(); });
		bar.querySelector(".reaction-close").addEventListener("click", function (e) { e.stopPropagation(); self.setVisible(false); });

		var res = document.createElement("div");
		res.className = "reaction-results";
		res.setAttribute("hidden", "hidden");
		res.innerHTML =
			'<div class="reaction-results-card">' +
			'<div class="reaction-results-title">⚡ Reaction Royale — Results</div>' +
			'<div class="reaction-winner"></div>' +
			'<ol class="reaction-scoreboard"></ol>' +
			'<div class="reaction-results-actions">' +
			'<button type="button" class="reaction-again party-btn">Play again 🚦</button>' +
			'<button type="button" class="reaction-dismiss party-btn">Close</button>' +
			'</div></div>';
		document.body.appendChild(res);
		this.results = res;
		res.querySelector(".reaction-again").addEventListener("click", function (e) { e.stopPropagation(); self._hideResults(); self.startMatch(); });
		res.querySelector(".reaction-dismiss").addEventListener("click", function (e) { e.stopPropagation(); self._hideResults(); });

		this._resize();
		window.addEventListener("resize", function () { self._resize(); });
	};

	ReactionRoyale.prototype._resize = function () {
		if (!this.canvas) return;
		var dpr = window.devicePixelRatio || 1;
		var w = window.innerWidth, h = window.innerHeight;
		this.canvas.width = Math.max(1, Math.floor(w * dpr));
		this.canvas.height = Math.max(1, Math.floor(h * dpr));
		this.canvas.style.width = w + "px";
		this.canvas.style.height = h + "px";
		this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	};

	ReactionRoyale.prototype._setCanvasInteractive = function (on) {
		if (this.canvas) this.canvas.classList.toggle("reaction-live", !!on);
	};

	ReactionRoyale.prototype.setVisible = function (on) {
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

	ReactionRoyale.prototype._flash = function (text) { if (this.elStatus) this.elStatus.textContent = text; };
	ReactionRoyale.prototype._updateHud = function () {
		if (this.elJoin) { this.elJoin.textContent = this.joined ? "Leave" : "Join"; this.elJoin.disabled = this.active; }
		if (this.elStart) this.elStart.disabled = this.active;
		if (this.elInfo) {
			if (this.active) this.elInfo.textContent = "Round " + this.round + "/" + this.totalRounds;
			else { var n = this._roster().length; this.elInfo.textContent = n + " player" + (n === 1 ? "" : "s"); }
		}
	};

	ReactionRoyale.prototype._showResults = function () {
		if (!this.results) return;
		var arr = this._roster();
		var ol = this.results.querySelector(".reaction-scoreboard");
		var winEl = this.results.querySelector(".reaction-winner");
		ol.innerHTML = "";
		var myTag = this._selfTag();
		if (!arr.length) { winEl.textContent = "No players 😅"; }
		else {
			var top = arr[0].score;
			var champs = arr.filter(function (a) { return a.score === top && top > 0; });
			if (top === 0) winEl.textContent = "Nobody scored a point! 😂";
			else if (champs.length > 1) winEl.innerHTML = "🤝 Tie: <b>" + champs.map(function (c) { return esc(c.name); }).join(" & ") + "</b> — " + top + " each";
			else winEl.innerHTML = (champs[0].tag === myTag ? "🏆 You're the fastest — you WIN! 🎉" : "🏆 Champion: <b>" + esc(champs[0].name) + "</b>") + " — " + top + " pts";
			for (var i = 0; i < arr.length; i++) {
				var p = arr[i];
				var medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "&nbsp;&nbsp;";
				var li = document.createElement("li");
				if (p.tag === myTag) li.className = "rr-me";
				li.innerHTML = '<span class="rr-rank">' + medal + '</span>' +
					'<span class="rr-dot" style="background:hsl(' + p.hue + ',75%,60%)"></span>' +
					'<span class="rr-name">' + esc(p.name) + (p.tag === myTag ? ' <span class="rr-you">(you)</span>' : '') + '</span>' +
					'<span class="rr-score">' + p.score + ' pts</span>';
				ol.appendChild(li);
			}
		}
		this.results.removeAttribute("hidden");
	};
	ReactionRoyale.prototype._hideResults = function () {
		if (this.results) this.results.setAttribute("hidden", "hidden");
		if (!this.active) { this.ended = false; this.phase = "lobby"; }
	};

	ReactionRoyale.prototype._clearTimer = function () { if (this._nextTimer) { clearTimeout(this._nextTimer); this._nextTimer = null; } };
	ReactionRoyale.prototype.destroy = function () { if (this._raf) cancelAnimationFrame(this._raf); this._clearTimer(); };

	global.ReactionRoyale = ReactionRoyale;
})(typeof window !== "undefined" ? window : this);
