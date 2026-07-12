/**
 * Car Dodge — a synced, room-wide "last car driving" race.
 *
 * Everyone joins from a lobby and gets their own car. When the race starts the
 * whole room sees the SAME obstacles scrolling down the SAME road at the SAME
 * time; each player steers their own car to dodge. Crash and you're out. The
 * last car still driving wins (or whoever survived longest when time runs out).
 *
 * Sync model (mirrors Balloon Pop):
 *   - One client (whoever pressed Start) is the HOST and the only one that
 *     spawns obstacles; it broadcasts each one as (id, x, bornAt, speed, kind).
 *     Every client renders an obstacle purely from those values and the shared
 *     serverTime, so the road is identical on every screen.
 *   - Each player owns their own car: they broadcast its x ~15 Hz and everyone
 *     interpolates the others. A player is the sole authority on their OWN crash
 *     (they have the truest view of their car), so collisions never disagree.
 *   - The host publishes the authoritative final ranking so every results screen
 *     matches.  Transport: the "CD|" prefix over the relay / chat fallback.
 */
(function (global) {
	"use strict";

	var SYNC_PREFIX = "CD|";
	var COUNTDOWN_MS = 3000;       // "3..2..1.. GO" before obstacles start
	var TIME_CAP_MS = 120000;      // hard cap so a race always ends
	var ROAD_L = 0.22, ROAD_R = 0.78;
	var CAR_W = 0.072, CAR_H = 0.13;
	var CAR_Y = 0.8;               // cars sit near the bottom (normalised)
	var OBST = 0.075;              // obstacle box size (normalised)
	var CAR_SPEED = 0.95;          // how fast a car slides across the road (per s)
	var KINDS = ["🚧", "🛢️", "🧱", "🚦"]; // 🚧 🛢️ 🧱 🚦
	var PICK = 0.062;              // pickup box size (normalised)
	var COIN_VALUE = 5;            // points per coin
	var SPAWN_INVULN = 1100;       // ms of grace at the start (and after a shield save)

	function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
	function rand(a, b) { return a + Math.random() * (b - a); }
	function pick(list) { return list[Math.floor(Math.random() * list.length)]; }
	function sanitize(s) { return String(s == null ? "" : s).replace(/[|;,:]/g, " ").slice(0, 20); }
	function esc(s) {
		return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
			return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c];
		});
	}

	function CarDodge(opts) {
		opts = opts || {};
		this.client = opts.client;
		this.onLayoutChange = opts.onLayoutChange || function () {};

		this.visible = false;
		this.active = false;
		this.ended = false;
		this.joined = false;
		this.gameId = null;
		this.hostTag = null;
		this.startTime = 0;        // serverTime racing begins (after countdown)
		this.capTime = 0;          // serverTime hard stop

		this.players = {};         // tag -> player object
		this.obstacles = [];       // {id, x, bornAt, speed, kind}
		this.pickups = [];         // {id, x, bornAt, speed, kind: 'c'|'s'}
		this.particles = [];
		this._floaters = [];       // local floating texts ("NICE!", "+5"…)
		this._gotPickups = {};     // pickup ids I've already collected

		this._tag = null;
		this._name = null;
		this._seq = 0;
		this._roundSeq = 0;
		this._nextSpawnAt = 0;
		this._nextPickAt = 0;
		this._lastCarBcast = 0;
		this._lastTrailAt = 0;
		this._steer = 0;           // -1 / 0 / +1 from buttons & keys
		this._shake = 0;           // crash screen-shake magnitude
		this._lastHudAt = 0;
		this._lastBeep = 0;
		this._finishedGameId = null;
		this.ignoreSelfUntil = 0;

		this._buildUi();
		this._bindKeys();
		this._loop();
	}

	CarDodge.SYNC_PREFIX = SYNC_PREFIX;
	CarDodge.isSyncText = function (text) {
		return !!(text && typeof text === "string" && text.indexOf(SYNC_PREFIX) === 0);
	};

	CarDodge.prototype.serverTime = function () {
		return Date.now() + (this.client.serverTimeOffset || 0);
	};

	// Per-instance id, unique to this tab (never persisted — a duplicated tab
	// would otherwise share it and two cars would collapse into one).
	CarDodge.prototype._selfTag = function () {
		if (this._tag) return this._tag;
		this._tag = (Math.floor(rand(0, 1e9)).toString(36) + Math.floor(rand(0, 1e9)).toString(36)).slice(0, 10);
		return this._tag;
	};
	CarDodge.prototype._selfName = function () {
		var me = this.client.getOwnParticipant && this.client.getOwnParticipant();
		return sanitize((me && me.name) || "Racer") || "Racer";
	};
	// A stable colour for a tag (so a car looks the same on every screen).
	CarDodge.prototype._hueOf = function (tag) {
		var h = 0;
		for (var i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) % 360;
		return h;
	};

	CarDodge.prototype._canBroadcast = function () {
		if (!this.client) return false;
		return !!(this.client.roomSync && this.client.roomSync.isConnected());
	};

	// ---- networking ------------------------------------------------------

	CarDodge.prototype.sendSync = function (payload) {
		if (!this._canBroadcast()) return;
		var msg = SYNC_PREFIX + payload;
		if (msg.length > 512) return;
		this.ignoreSelfUntil = Date.now() + 400;
		this.client.broadcastRoom(msg);
	};

	CarDodge.prototype.requestSync = function () { this.sendSync("q|" + this._selfTag()); };

	CarDodge.prototype.tryHandleChat = function (msg) {
		var text = msg.a != null ? msg.a : (msg.message != null ? msg.message : "");
		if (!CarDodge.isSyncText(text)) return false;
		var parts = text.slice(SYNC_PREFIX.length).split("|");
		var cmd = parts[0];
		var senderTag = parts[parts.length - 1];

		if (cmd === "j") {                 // j|tag|name|hue
			this._addPlayer(parts[1], parts[2], parseInt(parts[3], 10) || 0);
		} else if (cmd === "l") {          // l|tag
			this._removePlayer(parts[1]);
		} else if (cmd === "s") {          // s|gameId|startTime|capTime|hostTag
			this._applyStart(parts[1], parseFloat(parts[2]) || 0, parseFloat(parts[3]) || 0, parts[4]);
		} else if (cmd === "o") {          // o|gameId|id|x|bornAt|speed|kind|hostTag
			this._applyObstacle(parts);
		} else if (cmd === "pk") {         // pk|gameId|id|x|bornAt|speed|kind|hostTag
			this._applyPickup(parts);
		} else if (cmd === "c") {          // c|gameId|tag|x|coins|shield
			this._applyCar(parts[1], parts[2], (parseInt(parts[3], 10) || 0) / 1000, parseInt(parts[4], 10) || 0, parts[5] === "1");
		} else if (cmd === "x") {          // x|gameId|tag|survivedMs|coins
			this._applyCrash(parts[1], parts[2], parseFloat(parts[3]) || 0, parseInt(parts[4], 10) || 0);
		} else if (cmd === "e") {          // e|gameId|ranking|hostTag
			this._applyEnd(parts[1], parts[2]);
		} else if (cmd === "q") {          // a newcomer wants current state
			if (senderTag !== this._selfTag()) this._answerQuery();
		}
		return true;
	};

	// Re-announce myself (and, if I'm the host, the live game) so newcomers learn
	// the roster + race in progress. Jittered to avoid a reply storm.
	CarDodge.prototype._answerQuery = function () {
		var self = this;
		var delay = 40 + Math.random() * 200;
		setTimeout(function () {
			if (self.joined) self._broadcastJoin();
			if (self.active && self.hostTag === self._selfTag()) self._broadcastStart();
		}, delay);
	};

	// ---- roster / lobby --------------------------------------------------

	CarDodge.prototype._addPlayer = function (tag, name, hue) {
		if (!tag) return null;
		var p = this.players[tag];
		if (!p) {
			p = this.players[tag] = {
				tag: tag, name: sanitize(name) || "Racer", hue: hue || this._hueOf(tag),
				x: (ROAD_L + ROAD_R) / 2, targetX: (ROAD_L + ROAD_R) / 2, netX: (ROAD_L + ROAD_R) / 2,
				alive: true, crashedAt: 0, survivedMs: 0, lastSeen: Date.now(),
				coins: 0, shield: false, invulnUntil: 0,
				isOwn: tag === this._selfTag()
			};
		} else {
			if (name) p.name = sanitize(name);
			p.lastSeen = Date.now();
		}
		this._updateHud();
		return p;
	};

	CarDodge.prototype._removePlayer = function (tag) {
		if (this.players[tag]) { delete this.players[tag]; this._updateHud(); }
	};

	CarDodge.prototype.join = function () {
		if (this.active) { this._flash("race already running — wait for the next one!"); return; }
		if (!this._canBroadcast()) { this._flash("connect to a room first!"); return; }
		this.joined = true;
		var p = this._addPlayer(this._selfTag(), this._selfName(), this._hueOf(this._selfTag()));
		if (p) { p.x = p.targetX = p.netX = (ROAD_L + ROAD_R) / 2; }
		this._broadcastJoin();
		this._flash("you're in! 🏎️ waiting for Start…");
		if (global.funSound) global.funSound("coin");
		this._updateHud();
	};

	CarDodge.prototype.leave = function () {
		if (this.active) { this._flash("can't leave mid-race!"); return; }
		this.joined = false;
		this._removePlayer(this._selfTag());
		this.sendSync("l|" + this._selfTag());
		this._flash("left the lobby");
		this._updateHud();
	};

	CarDodge.prototype._broadcastJoin = function () {
		this.sendSync("j|" + this._selfTag() + "|" + this._selfName() + "|" + this._hueOf(this._selfTag()));
	};

	CarDodge.prototype._roster = function () {
		var arr = [];
		for (var t in this.players) if (this.players.hasOwnProperty(t)) arr.push(this.players[t]);
		arr.sort(function (a, b) { return a.tag < b.tag ? -1 : 1; });
		return arr;
	};
	CarDodge.prototype._aliveCount = function () {
		var n = 0;
		for (var t in this.players) if (this.players.hasOwnProperty(t) && this.players[t].alive) n++;
		return n;
	};

	// ---- race lifecycle --------------------------------------------------

	CarDodge.prototype.startGame = function () {
		if (this.active) return;
		if (!this._canBroadcast()) { this._flash("connect to a room first!"); return; }
		if (!this.joined) this.join();
		if (this._roster().length < 1) { this._flash("need at least one racer!"); return; }
		this._roundSeq++;
		this.gameId = this._selfTag() + "-" + this._roundSeq;
		this.hostTag = this._selfTag();
		var now = this.serverTime();
		this.startTime = now + COUNTDOWN_MS;
		this.capTime = this.startTime + TIME_CAP_MS;
		this._beginActive();
		this._nextSpawnAt = this.startTime + 300;
		this._broadcastStart();
		if (global.funSound) global.funSound("fuse");
	};

	CarDodge.prototype._broadcastStart = function () {
		this.sendSync("s|" + this.gameId + "|" + Math.round(this.startTime) + "|" + Math.round(this.capTime) + "|" + this.hostTag);
	};

	CarDodge.prototype._beginActive = function () {
		this.active = true;
		this.ended = false;
		this.obstacles.length = 0;
		this.pickups.length = 0;
		this.particles.length = 0;
		this._floaters.length = 0;
		this._gotPickups = {};
		this._shake = 0;
		this._steer = 0;
		// reset every racer to the start line; non-joined players just spectate.
		var grace = this.startTime + SPAWN_INVULN;
		for (var t in this.players) {
			if (!this.players.hasOwnProperty(t)) continue;
			var p = this.players[t];
			p.alive = true; p.crashedAt = 0; p.survivedMs = 0;
			p.coins = 0; p.shield = false; p.invulnUntil = grace;
			p.x = p.targetX = p.netX = (ROAD_L + ROAD_R) / 2;
		}
		this._hideResults();
		if (!this.visible) this.setVisible(true);
		// Only racers steer; spectators (who never joined) just watch.
		this._setCanvasInteractive(this.joined);
		this._updateHud();
	};

	CarDodge.prototype._applyStart = function (gameId, startTime, capTime, hostTag) {
		if (!gameId) return;
		if (this.active && this.gameId === gameId) { this.startTime = startTime; this.capTime = capTime; return; }
		this.gameId = gameId;
		this.hostTag = hostTag || null;
		this.startTime = startTime || (this.serverTime() + COUNTDOWN_MS);
		this.capTime = capTime || (this.startTime + TIME_CAP_MS);
		// Anyone who joined the lobby races; if I never joined I just watch.
		this._beginActive();
		this._flash("get ready… 🏁");
		if (global.funSound) global.funSound("fuse");
	};

	CarDodge.prototype._endGame = function () {
		if (!this.active) return;
		this.active = false;
		this.ended = true;
		this._setCanvasInteractive(false);
		this.obstacles.length = 0;
		// finalise survival time for anyone still alive
		var end = this.serverTime();
		for (var t in this.players) {
			if (!this.players.hasOwnProperty(t)) continue;
			var p = this.players[t];
			if (p.alive) p.survivedMs = Math.max(0, end - this.startTime);
		}
		if (this.hostTag === this._selfTag()) {
			this.sendSync("e|" + this.gameId + "|" + this._encodeRanking() + "|" + this._selfTag());
		}
		this._finish(this.gameId);
	};

	CarDodge.prototype._applyEnd = function (gameId, rankStr) {
		if (!gameId || gameId !== this.gameId) return;
		this._decodeRanking(rankStr);
		if (this.active) { this.active = false; this._setCanvasInteractive(false); this.obstacles.length = 0; }
		this.ended = true;
		this._finish(gameId);
	};

	CarDodge.prototype._finish = function (gameId) {
		var first = this._finishedGameId !== gameId;
		this._finishedGameId = gameId;
		this._showResults();
		if (first && global.funSound) global.funSound("fanfare");
	};

	// ---- obstacles (host authoritative) ----------------------------------

	CarDodge.prototype._hostSpawnTick = function (now) {
		if (!this.active || this.hostTag !== this._selfTag()) return;
		if (now < this.startTime) return;          // wait for "GO"
		var elapsed = now - this.startTime;
		var speed = clamp(0.30 + elapsed / 90000, 0.30, 0.80);

		// obstacles — gets denser and faster as the race goes on
		if (now >= this._nextSpawnAt && this.obstacles.length <= 60) {
			var interval = clamp(900 - elapsed / 90, 340, 900);
			this._nextSpawnAt = now + interval;
			var lane1 = rand(ROAD_L + OBST * 0.6, ROAD_R - OBST * 0.6);
			this._spawnObstacle(lane1, now, speed);
			// once it gets fast, sometimes throw a second one with a clear gap to dodge through
			if (elapsed > 14000 && Math.random() < 0.32) {
				var gapTries = 0, lane2;
				do { lane2 = rand(ROAD_L + OBST * 0.6, ROAD_R - OBST * 0.6); gapTries++; }
				while (Math.abs(lane2 - lane1) < OBST * 2.4 && gapTries < 8);
				if (Math.abs(lane2 - lane1) >= OBST * 2.0) this._spawnObstacle(lane2, now, speed);
			}
		}

		// pickups — coins are common, shields rare
		if (now >= this._nextPickAt) {
			this._nextPickAt = now + rand(2200, 4200);
			var isShield = Math.random() < 0.22;
			this._spawnPickup(rand(ROAD_L + PICK * 0.6, ROAD_R - PICK * 0.6), now, speed * 0.92, isShield ? "s" : "c");
		}
	};

	CarDodge.prototype._spawnObstacle = function (x, now, speed) {
		var o = { id: this._selfTag() + "-" + (this._seq++), x: x, bornAt: now, speed: speed, kind: pick(KINDS) };
		this.obstacles.push(o);
		this.sendSync("o|" + this.gameId + "|" + o.id + "|" + Math.round(o.x * 1000) + "|" +
			Math.round(o.bornAt) + "|" + Math.round(o.speed * 1000) + "|" + this._kindIdx(o.kind) + "|" + this._selfTag());
	};

	CarDodge.prototype._spawnPickup = function (x, now, speed, kind) {
		var pk = { id: "p" + this._selfTag() + "-" + (this._seq++), x: x, bornAt: now, speed: speed, kind: kind };
		this.pickups.push(pk);
		this.sendSync("pk|" + this.gameId + "|" + pk.id + "|" + Math.round(pk.x * 1000) + "|" +
			Math.round(pk.bornAt) + "|" + Math.round(pk.speed * 1000) + "|" + kind + "|" + this._selfTag());
	};

	CarDodge.prototype._kindIdx = function (k) { var i = KINDS.indexOf(k); return i < 0 ? 0 : i; };

	CarDodge.prototype._applyObstacle = function (parts) {
		if (parts[1] !== this.gameId || !this.active) return;
		var id = parts[2];
		for (var i = 0; i < this.obstacles.length; i++) if (this.obstacles[i].id === id) return;
		this.obstacles.push({
			id: id,
			x: (parseInt(parts[3], 10) || 0) / 1000,
			bornAt: parseFloat(parts[4]) || this.serverTime(),
			speed: (parseInt(parts[5], 10) || 300) / 1000,
			kind: KINDS[parseInt(parts[6], 10)] || KINDS[0]
		});
	};

	CarDodge.prototype._applyPickup = function (parts) {
		if (parts[1] !== this.gameId || !this.active) return;
		var id = parts[2];
		if (this._gotPickups[id]) return;
		for (var i = 0; i < this.pickups.length; i++) if (this.pickups[i].id === id) return;
		this.pickups.push({
			id: id,
			x: (parseInt(parts[3], 10) || 0) / 1000,
			bornAt: parseFloat(parts[4]) || this.serverTime(),
			speed: (parseInt(parts[5], 10) || 300) / 1000,
			kind: parts[6] === "s" ? "s" : "c"
		});
	};

	CarDodge.prototype._obstacleY = function (o, now) {
		return -0.15 + ((now - o.bornAt) / 1000) * o.speed;
	};

	// ---- cars ------------------------------------------------------------

	CarDodge.prototype._applyCar = function (gameId, tag, x, coins, shield) {
		if (gameId !== this.gameId) return;
		var p = this.players[tag] || this._addPlayer(tag, "", this._hueOf(tag));
		if (!p || p.isOwn) return;          // never let the network move my own car
		p.netX = clamp(x, ROAD_L, ROAD_R);
		p.coins = coins || 0;
		p.shield = !!shield;
		p.lastSeen = Date.now();
	};

	CarDodge.prototype._applyCrash = function (gameId, tag, survivedMs, coins) {
		if (gameId !== this.gameId) return;
		var p = this.players[tag];
		if (!p) return;
		if (coins != null) p.coins = coins;
		if (p.alive) {
			p.alive = false;
			p.crashedAt = this.startTime + survivedMs;
			p.survivedMs = survivedMs;
			this._boom(p.isOwn ? p.x : p.netX, p.hue);
		}
	};

	CarDodge.prototype._crashOwn = function (now) {
		var p = this.players[this._selfTag()];
		if (!p || !p.alive) return;
		p.alive = false;
		p.survivedMs = Math.max(0, now - this.startTime);
		p.crashedAt = now;
		this._boom(p.x, p.hue);
		this._shake = 1;
		this._setCanvasInteractive(false);   // hand the cursor + controls back
		if (global.funSound) global.funSound("boom");
		this.sendSync("x|" + this.gameId + "|" + this._selfTag() + "|" + Math.round(p.survivedMs) + "|" + p.coins + "|" + this._selfTag());
		this._flash("💥 crashed! " + (p.survivedMs / 1000).toFixed(1) + "s · " + p.coins + " coins");
	};

	CarDodge.prototype._boom = function (x, hue) {
		for (var i = 0; i < 22; i++) {
			var a = rand(0, Math.PI * 2), sp = rand(0.005, 0.024);
			this.particles.push({
				x: x, y: CAR_Y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 0.004,
				life: 1, decay: rand(0.02, 0.045), size: rand(2.5, 6),
				color: pick(["#ff5a3c", "#ffb13b", "#ffe27a", "#888"])
			});
		}
		this._floater(x, CAR_Y - 0.05, "💥", "#ff7a4d");
		if (this.particles.length > 320) this.particles.splice(0, this.particles.length - 320);
	};

	// a short-lived floating bit of text on the canvas (local only — pure flavour)
	CarDodge.prototype._floater = function (x, y, text, color) {
		this._floaters.push({ x: x, y: y, text: text, color: color || "#fff", life: 1, decay: 0.018 });
		if (this._floaters.length > 24) this._floaters.shift();
	};

	// ---- ranking ---------------------------------------------------------

	// Score blends how long you lasted with the coins you grabbed, so a daring
	// coin-grabber can edge out a cautious survivor on a tie.
	CarDodge.prototype._scoreOf = function (p) {
		return Math.round(p.survivedMs / 1000 * 10) + (p.coins || 0) * COIN_VALUE;
	};
	CarDodge.prototype._sortedRanking = function () {
		var self = this;
		var arr = this._roster().slice();
		arr.sort(function (a, b) {
			if (a.alive !== b.alive) return a.alive ? -1 : 1;       // survivors first
			return (self._scoreOf(b) - self._scoreOf(a)) || (b.survivedMs - a.survivedMs) || (a.tag < b.tag ? -1 : 1);
		});
		return arr;
	};
	CarDodge.prototype._encodeRanking = function () {
		var arr = this._sortedRanking(), out = [];
		for (var i = 0; i < arr.length; i++) {
			var p = arr[i];
			out.push(p.tag + ":" + Math.round(p.survivedMs) + ":" + (p.alive ? 1 : 0) + ":" + (p.coins || 0) + ":" + sanitize(p.name));
		}
		return out.join(";");
	};
	CarDodge.prototype._decodeRanking = function (str) {
		if (!str) return;
		var entries = str.split(";");
		for (var i = 0; i < entries.length; i++) {
			var f = entries[i].split(":");
			if (!f[0]) continue;
			var p = this.players[f[0]] || this._addPlayer(f[0], f[4], this._hueOf(f[0]));
			if (!p) continue;
			p.survivedMs = parseInt(f[1], 10) || 0;
			p.alive = f[2] === "1";
			p.coins = parseInt(f[3], 10) || 0;
			if (f[4]) p.name = sanitize(f[4]);
		}
	};

	// ---- main loop -------------------------------------------------------

	CarDodge.prototype._loop = function () {
		var self = this;
		function tick() {
			self._raf = requestAnimationFrame(tick);
			var now = self.serverTime();
			if (self.active) self._update(now);
			self._stepParticles();
			self._draw(now);
			if (Date.now() - self._lastHudAt > 200) { self._lastHudAt = Date.now(); self._updateHud(); }
		}
		tick();
	};

	CarDodge.prototype._update = function (now) {
		this._hostSpawnTick(now);

		// countdown beeps + "GO"
		if (now < this.startTime) {
			var secLeft = Math.ceil((this.startTime - now) / 1000);
			if (secLeft !== this._lastBeep) { this._lastBeep = secLeft; if (global.funSound) global.funSound("blip"); }
		} else if (this._lastBeep > 0) { this._lastBeep = 0; if (global.funSound) global.funSound("coin"); }

		// move my own car toward its target; broadcast it
		var me = this.players[this._selfTag()];
		if (me && me.isOwn) {
			if (this._steer) me.targetX = clamp(me.targetX + this._steer * CAR_SPEED * 0.016, ROAD_L, ROAD_R);
			me.x += (me.targetX - me.x) * 0.3;
			me.x = clamp(me.x, ROAD_L, ROAD_R);
			if (me.alive && now - this._lastCarBcast > 66) {
				this._lastCarBcast = now;
				this.sendSync("c|" + this.gameId + "|" + this._selfTag() + "|" + Math.round(me.x * 1000) +
					"|" + me.coins + "|" + (me.shield ? 1 : 0) + "|" + this._selfTag());
			}
			// exhaust trail behind my (and others') alive cars
			if (now - this._lastTrailAt > 55) {
				this._lastTrailAt = now;
				for (var tt in this.players) {
					if (!this.players.hasOwnProperty(tt)) continue;
					var cp = this.players[tt];
					if (!cp.alive) continue;
					this.particles.push({
						x: cp.x + rand(-0.012, 0.012), y: CAR_Y + CAR_H * 0.5, vx: rand(-0.001, 0.001), vy: rand(0.004, 0.01),
						life: 0.6, decay: 0.05, size: rand(2, 4), color: "rgba(190,200,210,0.5)"
					});
				}
			}
		}
		// interpolate everyone else's car toward its broadcast position
		for (var t in this.players) {
			if (!this.players.hasOwnProperty(t)) continue;
			var p = this.players[t];
			if (p.isOwn) continue;
			p.x += (p.netX - p.x) * 0.3;
		}

		// advance / cull obstacles + pickups
		for (var i = this.obstacles.length - 1; i >= 0; i--) {
			if (this._obstacleY(this.obstacles[i], now) > 1.2) this.obstacles.splice(i, 1);
		}
		for (var k = this.pickups.length - 1; k >= 0; k--) {
			if (this._obstacleY(this.pickups[k], now) > 1.2) this.pickups.splice(k, 1);
		}

		// my own pickups + collision (I'm the authority on my own car)
		if (me && me.isOwn && me.alive && now >= this.startTime) {
			this._collectPickups(me, now);
			var hit = this._hitObstacle(me.x, now);
			if (hit) {
				if (now < me.invulnUntil) { /* spawn grace — phase through */ }
				else if (me.shield) {
					me.shield = false;
					me.invulnUntil = now + SPAWN_INVULN;
					this._shake = 0.6;
					this._floater(me.x, CAR_Y - 0.06, "🛡️ saved!", "#4ad6ff");
					if (global.funSound) global.funSound("boing");
				} else {
					this._crashOwn(now);
				}
			} else {
				this._nearMiss(me, now);
			}
		}

		// shake + floaters decay
		if (this._shake > 0) this._shake = Math.max(0, this._shake - 0.05);
		for (var fi = this._floaters.length - 1; fi >= 0; fi--) {
			var fl = this._floaters[fi];
			fl.y -= 0.0035; fl.life -= fl.decay;
			if (fl.life <= 0) this._floaters.splice(fi, 1);
		}

		// end conditions: only one car left, or time's up (host decides, but any
		// client falls back to the same rule if the host vanished)
		var racers = this._roster();
		if (now >= this.capTime) { this._endGame(); return; }
		if (racers.length >= 1 && this._aliveCount() <= (racers.length >= 2 ? 1 : 0) && now > this.startTime + 800) {
			this._endGame();
		}
	};

	// AABB overlap of my car against the nearest obstacle; returns it or null.
	CarDodge.prototype._hitObstacle = function (carX, now) {
		var cw = CAR_W * 0.7, ch = CAR_H * 0.7;
		var cl = carX - cw / 2, cr = carX + cw / 2, ct = CAR_Y - ch / 2, cb = CAR_Y + ch / 2;
		for (var i = 0; i < this.obstacles.length; i++) {
			var o = this.obstacles[i];
			var oy = this._obstacleY(o, now);
			var ow = OBST * 0.68, oh = OBST * 0.68;
			if (cl < o.x + ow / 2 && cr > o.x - ow / 2 && ct < oy + oh / 2 && cb > oy - oh / 2) return o;
		}
		return null;
	};

	// Grab any coin/shield my car overlaps. Per-player: it vanishes for me but
	// stays for everyone else until they grab their own — no claim conflicts.
	CarDodge.prototype._collectPickups = function (me, now) {
		for (var i = this.pickups.length - 1; i >= 0; i--) {
			var pk = this.pickups[i];
			var py = this._obstacleY(pk, now);
			var dx = Math.abs(me.x - pk.x), dy = Math.abs(CAR_Y - py);
			if (dx < (CAR_W + PICK) * 0.42 && dy < (CAR_H + PICK) * 0.42) {
				this.pickups.splice(i, 1);
				this._gotPickups[pk.id] = true;
				if (pk.kind === "s") {
					me.shield = true;
					this._floater(me.x, CAR_Y - 0.06, "🛡️", "#4ad6ff");
					if (global.funSound) global.funSound("sparkle");
				} else {
					me.coins += 1;
					this._floater(pk.x, py - 0.03, "+" + COIN_VALUE, "#ffd93d");
					if (global.funSound) global.funSound("coin", { throttle: 30 });
				}
			}
		}
	};

	// A thrill bonus sound when an obstacle whizzes past close but doesn't hit.
	CarDodge.prototype._nearMiss = function (me, now) {
		for (var i = 0; i < this.obstacles.length; i++) {
			var o = this.obstacles[i];
			if (o._missed) continue;
			var oy = this._obstacleY(o, now);
			if (oy > CAR_Y - CAR_H * 0.5 && oy < CAR_Y + CAR_H * 0.5) {
				var dx = Math.abs(me.x - o.x);
				if (dx < (CAR_W + OBST) * 0.62) {
					o._missed = true;
					this._floater(me.x, CAR_Y - 0.07, "NICE!", "#8fe6a3");
					if (global.funSound) global.funSound("whoosh", { throttle: 120 });
				}
			}
		}
	};

	CarDodge.prototype._stepParticles = function () {
		var ps = this.particles;
		for (var i = ps.length - 1; i >= 0; i--) {
			var p = ps[i];
			p.x += p.vx; p.y += p.vy; p.vy += 0.0006; p.vx *= 0.97;
			p.life -= p.decay;
			if (p.life <= 0) ps.splice(i, 1);
		}
	};

	// ---- input -----------------------------------------------------------

	CarDodge.prototype._bindKeys = function () {
		var self = this;
		this._onKeyDown = function (e) {
			if (!self.active) return;
			if (e.key === "ArrowLeft") { self._steer = -1; e.preventDefault(); }
			else if (e.key === "ArrowRight") { self._steer = 1; e.preventDefault(); }
		};
		this._onKeyUp = function (e) {
			if (e.key === "ArrowLeft" && self._steer < 0) self._steer = 0;
			else if (e.key === "ArrowRight" && self._steer > 0) self._steer = 0;
		};
		window.addEventListener("keydown", this._onKeyDown);
		window.addEventListener("keyup", this._onKeyUp);
	};

	CarDodge.prototype._onPointerMove = function (e) {
		if (!this.active) return;
		var me = this.players[this._selfTag()];
		if (!me || !me.isOwn || !me.alive) return;
		var rect = this.canvas.getBoundingClientRect();
		var t = e.touches ? e.touches[0] : e;
		var nx = (t.clientX - rect.left) / rect.width;
		me.targetX = clamp(nx, ROAD_L, ROAD_R);
		if (e.cancelable) e.preventDefault();
	};

	// ---- rendering -------------------------------------------------------

	CarDodge.prototype._draw = function (now) {
		var ctx = this.ctx, canvas = this.canvas;
		if (!ctx || !canvas) return;
		var rect = canvas.getBoundingClientRect();
		var w = rect.width, h = rect.height;
		ctx.clearRect(0, 0, w, h);
		if (!this.visible) return;

		ctx.save();
		if (this._shake > 0) {
			var s = this._shake * 12;
			ctx.translate(rand(-s, s), rand(-s, s));
		}

		this._drawRoad(ctx, w, h, now);
		if (!this.active && !this.ended) { this._drawLobby(ctx, w, h); ctx.restore(); return; }

		// pickups (under cars)
		for (var k = 0; k < this.pickups.length; k++) {
			var pk = this.pickups[k];
			var py = this._obstacleY(pk, now);
			if (py < -0.2 || py > 1.25) continue;
			ctx.font = Math.round(Math.min(w, h) * PICK * 1.4) + "px serif";
			ctx.textAlign = "center"; ctx.textBaseline = "middle";
			ctx.fillText(pk.kind === "s" ? "🛡️" : "🪙", pk.x * w, py * h);
		}
		// obstacles
		for (var i = 0; i < this.obstacles.length; i++) {
			var o = this.obstacles[i];
			var oy = this._obstacleY(o, now);
			if (oy < -0.2 || oy > 1.25) continue;
			ctx.font = Math.round(Math.min(w, h) * OBST * 1.5) + "px serif";
			ctx.textAlign = "center"; ctx.textBaseline = "middle";
			ctx.fillText(o.kind, o.x * w, oy * h);
		}
		// cars
		var arr = this._roster();
		for (var j = 0; j < arr.length; j++) this._drawCar(ctx, arr[j], w, h, now);
		this._drawParticles(ctx, w, h);
		this._drawFloaters(ctx, w, h);

		// countdown
		if (this.active && now < this.startTime) {
			var n = Math.ceil((this.startTime - now) / 1000);
			ctx.fillStyle = "rgba(255,255,255,0.92)";
			ctx.font = "700 " + Math.round(Math.min(w, h) * 0.18) + "px Verdana, sans-serif";
			ctx.textAlign = "center"; ctx.textBaseline = "middle";
			ctx.fillText(n > 0 ? String(n) : "GO!", w / 2, h * 0.4);
		}
		ctx.restore();

		// score HUD (outside the shake transform so it stays steady)
		if (this.active && now >= this.startTime) this._drawHudOverlay(ctx, w, h, now);
	};

	CarDodge.prototype._drawHudOverlay = function (ctx, w, h, now) {
		var me = this.players[this._selfTag()];
		ctx.textAlign = "left"; ctx.textBaseline = "top";
		ctx.font = "700 " + Math.max(13, Math.round(h * 0.022)) + "px Verdana, sans-serif";
		var alive = this._aliveCount();
		var secs = ((now - this.startTime) / 1000).toFixed(1);
		ctx.fillStyle = "rgba(255,255,255,0.9)";
		ctx.fillText("⏱ " + secs + "s   🏁 " + alive + " left", 16, 14);
		if (me) {
			ctx.fillStyle = "#ffd93d";
			ctx.fillText("🪙 " + me.coins + "   ⭐ " + this._scoreOf(me) + (me.shield ? "   🛡️" : ""), 16, 14 + h * 0.03);
			if (!me.alive) {
				ctx.fillStyle = "rgba(255,120,90,0.95)";
				ctx.fillText("💥 out — spectating", 16, 14 + h * 0.06);
			}
		}
	};

	CarDodge.prototype._drawFloaters = function (ctx, w, h) {
		for (var i = 0; i < this._floaters.length; i++) {
			var f = this._floaters[i];
			ctx.globalAlpha = clamp(f.life, 0, 1);
			ctx.fillStyle = f.color;
			ctx.font = "700 " + Math.round(h * 0.026) + "px Verdana, sans-serif";
			ctx.textAlign = "center"; ctx.textBaseline = "middle";
			ctx.fillText(f.text, f.x * w, f.y * h);
		}
		ctx.globalAlpha = 1;
	};

	CarDodge.prototype._drawRoad = function (ctx, w, h, now) {
		var lx = ROAD_L * w, rx = ROAD_R * w;
		ctx.fillStyle = "rgba(28, 30, 38, 0.92)";
		ctx.fillRect(lx, 0, rx - lx, h);
		// edges
		ctx.fillStyle = "#f3d54e";
		ctx.fillRect(lx - 4, 0, 4, h);
		ctx.fillRect(rx, 0, 4, h);
		// scrolling dashed centre + lane lines
		var scroll = ((now / 1000) * 0.5 * h) % (h * 0.12);
		ctx.strokeStyle = "rgba(255,255,255,0.5)";
		ctx.lineWidth = 3;
		ctx.setLineDash([h * 0.05, h * 0.07]);
		for (var k = 1; k <= 2; k++) {
			var x = lx + (rx - lx) * (k / 3);
			ctx.beginPath();
			ctx.lineDashOffset = -scroll;
			ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
		}
		ctx.setLineDash([]);
	};

	CarDodge.prototype._drawCar = function (ctx, p, w, h, now) {
		var cx = p.x * w, cy = CAR_Y * h;
		var cw = CAR_W * w, ch = CAR_H * h;
		ctx.save();
		// invulnerability (spawn grace / just-shielded) → blink
		var invuln = p.alive && now != null && now < p.invulnUntil;
		ctx.globalAlpha = p.alive ? (invuln && Math.floor(now / 110) % 2 ? 0.45 : 1) : 0.28;
		// headlight glow pointing up the road
		if (p.alive) {
			var lg = ctx.createLinearGradient(cx, cy - ch * 0.5, cx, cy - ch * 1.7);
			lg.addColorStop(0, "rgba(255,250,210,0.22)");
			lg.addColorStop(1, "rgba(255,250,210,0)");
			ctx.fillStyle = lg;
			ctx.beginPath();
			ctx.moveTo(cx - cw * 0.32, cy - ch * 0.5);
			ctx.lineTo(cx + cw * 0.32, cy - ch * 0.5);
			ctx.lineTo(cx + cw * 0.7, cy - ch * 1.7);
			ctx.lineTo(cx - cw * 0.7, cy - ch * 1.7);
			ctx.closePath(); ctx.fill();
		}
		// shield ring
		if (p.shield && p.alive) {
			ctx.strokeStyle = "rgba(74,214,255,0.85)";
			ctx.lineWidth = 3;
			ctx.beginPath();
			ctx.ellipse(cx, cy, cw * 0.85, ch * 0.7, 0, 0, Math.PI * 2);
			ctx.stroke();
		}
		// body
		var bodyL = p.alive ? 60 : 35;
		ctx.fillStyle = "hsl(" + p.hue + ", 75%, " + bodyL + "%)";
		this._roundRect(ctx, cx - cw / 2, cy - ch / 2, cw, ch, Math.min(cw, ch) * 0.28);
		ctx.fill();
		// windshield
		ctx.fillStyle = "rgba(220, 240, 255, 0.85)";
		this._roundRect(ctx, cx - cw * 0.32, cy - ch * 0.32, cw * 0.64, ch * 0.26, cw * 0.1);
		ctx.fill();
		// rear window
		this._roundRect(ctx, cx - cw * 0.32, cy + ch * 0.08, cw * 0.64, ch * 0.2, cw * 0.1);
		ctx.fill();
		// wheels
		ctx.fillStyle = "#15171d";
		this._roundRect(ctx, cx - cw / 2 - cw * 0.06, cy - ch * 0.3, cw * 0.12, ch * 0.22, cw * 0.05); ctx.fill();
		this._roundRect(ctx, cx + cw / 2 - cw * 0.06, cy - ch * 0.3, cw * 0.12, ch * 0.22, cw * 0.05); ctx.fill();
		this._roundRect(ctx, cx - cw / 2 - cw * 0.06, cy + ch * 0.12, cw * 0.12, ch * 0.22, cw * 0.05); ctx.fill();
		this._roundRect(ctx, cx + cw / 2 - cw * 0.06, cy + ch * 0.12, cw * 0.12, ch * 0.22, cw * 0.05); ctx.fill();
		ctx.restore();

		// name + "you" marker
		ctx.globalAlpha = 1;
		ctx.fillStyle = p.isOwn ? "#8fe6a3" : "rgba(255,255,255,0.85)";
		ctx.font = "700 " + Math.max(10, Math.round(h * 0.018)) + "px Verdana, sans-serif";
		ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
		ctx.fillText((p.isOwn ? "▸ " : "") + p.name + (p.alive ? "" : " 💥"), cx, cy - ch / 2 - 6);
	};

	CarDodge.prototype._roundRect = function (ctx, x, y, w, h, r) {
		ctx.beginPath();
		if (ctx.roundRect) { ctx.roundRect(x, y, w, h, r); return; }
		ctx.moveTo(x + r, y);
		ctx.arcTo(x + w, y, x + w, y + h, r);
		ctx.arcTo(x + w, y + h, x, y + h, r);
		ctx.arcTo(x, y + h, x, y, r);
		ctx.arcTo(x, y, x + w, y, r);
		ctx.closePath();
	};

	CarDodge.prototype._drawParticles = function (ctx, w, h) {
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

	CarDodge.prototype._drawLobby = function (ctx, w, h) {
		var arr = this._roster();
		ctx.fillStyle = "rgba(255,255,255,0.92)";
		ctx.textAlign = "center"; ctx.textBaseline = "middle";
		ctx.font = "700 " + Math.round(Math.min(w, h) * 0.05) + "px Verdana, sans-serif";
		ctx.fillText("🏎️ Car Dodge — Waiting Room", w / 2, h * 0.28);
		ctx.font = "600 " + Math.round(Math.min(w, h) * 0.026) + "px Verdana, sans-serif";
		ctx.fillStyle = "rgba(255,255,255,0.7)";
		ctx.fillText(arr.length ? (arr.length + " racer" + (arr.length > 1 ? "s" : "") + " ready — press Start!") : "Press Join to get a car", w / 2, h * 0.36);
		var y = h * 0.45;
		for (var i = 0; i < arr.length; i++) {
			var p = arr[i];
			ctx.fillStyle = "hsl(" + p.hue + ", 75%, 60%)";
			ctx.beginPath(); ctx.arc(w / 2 - h * 0.12, y, h * 0.016, 0, Math.PI * 2); ctx.fill();
			ctx.fillStyle = p.isOwn ? "#8fe6a3" : "rgba(255,255,255,0.9)";
			ctx.textAlign = "left";
			ctx.font = "600 " + Math.round(Math.min(w, h) * 0.026) + "px Verdana, sans-serif";
			ctx.fillText(p.name + (p.isOwn ? " (you)" : ""), w / 2 - h * 0.09, y);
			ctx.textAlign = "center";
			y += h * 0.05;
		}
		ctx.fillStyle = "rgba(255,255,255,0.55)";
		ctx.font = "600 " + Math.round(Math.min(w, h) * 0.02) + "px Verdana, sans-serif";
		ctx.fillText("steer: move mouse · ◀▶ buttons · arrow keys", w / 2, h * 0.82);
		ctx.fillText("🪙 grab coins for points · 🛡️ shield blocks one hit · dodge 🚧 — last car wins!", w / 2, h * 0.86);
	};

	// ---- UI scaffolding --------------------------------------------------

	CarDodge.prototype._buildUi = function () {
		var self = this;

		var canvas = document.createElement("canvas");
		canvas.className = "cardodge-canvas";
		canvas.setAttribute("hidden", "hidden");
		document.body.appendChild(canvas);
		this.canvas = canvas;
		this.ctx = canvas.getContext("2d");
		canvas.addEventListener("mousemove", function (e) { self._onPointerMove(e); });
		canvas.addEventListener("touchmove", function (e) { self._onPointerMove(e); }, { passive: false });
		canvas.addEventListener("touchstart", function (e) { self._onPointerMove(e); }, { passive: false });

		var bar = document.createElement("div");
		bar.className = "party-bar cardodge-bar";
		bar.setAttribute("hidden", "hidden");
		bar.innerHTML =
			'<span class="cardodge-emoji">🏎️</span>' +
			'<span class="cardodge-status">Car Dodge</span>' +
			'<span class="cardodge-info"></span>' +
			'<button type="button" class="cardodge-join party-btn">Join</button>' +
			'<button type="button" class="cardodge-start party-btn">Start 🏁</button>' +
			'<button type="button" class="cardodge-close party-btn" title="Close">×</button>';
		document.body.appendChild(bar);
		this.bar = bar;
		this.elStatus = bar.querySelector(".cardodge-status");
		this.elInfo = bar.querySelector(".cardodge-info");
		this.elJoin = bar.querySelector(".cardodge-join");
		this.elStart = bar.querySelector(".cardodge-start");
		this.elJoin.addEventListener("click", function (e) { e.stopPropagation(); self.joined ? self.leave() : self.join(); });
		this.elStart.addEventListener("click", function (e) { e.stopPropagation(); self.startGame(); });
		bar.querySelector(".cardodge-close").addEventListener("click", function (e) { e.stopPropagation(); self.setVisible(false); });

		// on-screen steering buttons (touch friendly)
		var mk = function (cls, label, dir) {
			var b = document.createElement("button");
			b.type = "button"; b.className = "cardodge-steer " + cls; b.textContent = label;
			b.setAttribute("hidden", "hidden");
			var down = function (e) { e.preventDefault(); e.stopPropagation(); self._steer = dir; };
			var up = function (e) { e.preventDefault(); e.stopPropagation(); if (self._steer === dir) self._steer = 0; };
			b.addEventListener("mousedown", down); b.addEventListener("touchstart", down, { passive: false });
			b.addEventListener("mouseup", up); b.addEventListener("mouseleave", up);
			b.addEventListener("touchend", up); b.addEventListener("touchcancel", up);
			document.body.appendChild(b);
			return b;
		};
		this.steerL = mk("cardodge-steer-l", "◀", -1);
		this.steerR = mk("cardodge-steer-r", "▶", 1);

		var res = document.createElement("div");
		res.className = "cardodge-results";
		res.setAttribute("hidden", "hidden");
		res.innerHTML =
			'<div class="cardodge-results-card">' +
			'<div class="cardodge-results-title">🏁 Car Dodge — Results</div>' +
			'<div class="cardodge-winner"></div>' +
			'<ol class="cardodge-scoreboard"></ol>' +
			'<div class="cardodge-results-actions">' +
			'<button type="button" class="cardodge-again party-btn">Race again 🏁</button>' +
			'<button type="button" class="cardodge-dismiss party-btn">Close</button>' +
			'</div></div>';
		document.body.appendChild(res);
		this.results = res;
		res.querySelector(".cardodge-again").addEventListener("click", function (e) { e.stopPropagation(); self._hideResults(); self.startGame(); });
		res.querySelector(".cardodge-dismiss").addEventListener("click", function (e) { e.stopPropagation(); self._hideResults(); });

		this._resize();
		window.addEventListener("resize", function () { self._resize(); });
	};

	CarDodge.prototype._resize = function () {
		if (!this.canvas) return;
		var dpr = window.devicePixelRatio || 1;
		var w = window.innerWidth, h = window.innerHeight;
		this.canvas.width = Math.max(1, Math.floor(w * dpr));
		this.canvas.height = Math.max(1, Math.floor(h * dpr));
		this.canvas.style.width = w + "px";
		this.canvas.style.height = h + "px";
		this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	};

	CarDodge.prototype._setCanvasInteractive = function (on) {
		if (this.canvas) this.canvas.classList.toggle("cardodge-live", !!on);
		if (this.steerL) { if (on) this.steerL.removeAttribute("hidden"); else this.steerL.setAttribute("hidden", "hidden"); }
		if (this.steerR) { if (on) this.steerR.removeAttribute("hidden"); else this.steerR.setAttribute("hidden", "hidden"); }
	};

	CarDodge.prototype.setVisible = function (on) {
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

	CarDodge.prototype._flash = function (text) { if (this.elStatus) this.elStatus.textContent = text; };

	CarDodge.prototype._updateHud = function () {
		if (this.elJoin) {
			this.elJoin.textContent = this.joined ? "Leave" : "Join";
			this.elJoin.disabled = this.active;
		}
		if (this.elStart) this.elStart.disabled = this.active;
		if (this.elInfo) {
			if (this.active) {
				var now = this.serverTime();
				if (now < this.startTime) this.elInfo.textContent = "starting…";
				else {
					var alive = this._aliveCount();
					var secs = Math.max(0, (now - this.startTime) / 1000).toFixed(0);
					this.elInfo.textContent = "🏁 " + alive + " alive · " + secs + "s";
				}
			} else {
				var n = this._roster().length;
				this.elInfo.textContent = n + " racer" + (n === 1 ? "" : "s");
			}
		}
	};

	CarDodge.prototype._showResults = function () {
		if (!this.results) return;
		var arr = this._sortedRanking();
		var ol = this.results.querySelector(".cardodge-scoreboard");
		var winEl = this.results.querySelector(".cardodge-winner");
		ol.innerHTML = "";
		var myTag = this._selfTag();
		if (!arr.length) {
			winEl.textContent = "No racers 😅";
		} else {
			var champ = arr[0];
			if (champ.alive && this._aliveCountFrom(arr) === 1) {
				winEl.innerHTML = (champ.tag === myTag ? "🏆 You survived — you WIN! 🎉" : "🏆 Winner: <b>" + esc(champ.name) + "</b> (last car driving!)");
			} else {
				winEl.innerHTML = (champ.tag === myTag ? "🥇 You lasted longest!" : "🥇 Longest survivor: <b>" + esc(champ.name) + "</b>") +
					" — " + (champ.survivedMs / 1000).toFixed(1) + "s";
			}
			for (var i = 0; i < arr.length; i++) {
				var p = arr[i];
				var medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "&nbsp;&nbsp;";
				var li = document.createElement("li");
				if (p.tag === myTag) li.className = "cd-me";
				li.innerHTML = '<span class="cd-rank">' + medal + '</span>' +
					'<span class="cd-dot" style="background:hsl(' + p.hue + ',75%,60%)"></span>' +
					'<span class="cd-name">' + esc(p.name) + (p.tag === myTag ? ' <span class="cd-you">(you)</span>' : '') +
					(p.alive ? ' <span class="cd-alive">survived</span>' : '') + '</span>' +
					'<span class="cd-stats">' + (p.survivedMs / 1000).toFixed(1) + 's · 🪙' + (p.coins || 0) + '</span>' +
					'<span class="cd-time">' + this._scoreOf(p) + '</span>';
				ol.appendChild(li);
			}
		}
		this.results.removeAttribute("hidden");
	};
	CarDodge.prototype._aliveCountFrom = function (arr) {
		var n = 0; for (var i = 0; i < arr.length; i++) if (arr[i].alive) n++; return n;
	};

	CarDodge.prototype._hideResults = function () {
		if (this.results) this.results.setAttribute("hidden", "hidden");
		this.ended = false;   // drop back to the lobby/waiting-room view
	};

	CarDodge.prototype.destroy = function () {
		if (this._raf) cancelAnimationFrame(this._raf);
		window.removeEventListener("keydown", this._onKeyDown);
		window.removeEventListener("keyup", this._onKeyUp);
	};

	global.CarDodge = CarDodge;
})(typeof window !== "undefined" ? window : this);
