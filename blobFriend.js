/**
 * Blob Friend — a squishy blob playground.
 * Poke, stretch, throw, spawn up to 5 blobs that shove each other around,
 * and click a blob like crazy to inflate it until it pops like a balloon.
 * Room-synced via chat transport (BF| prefix).
 */
(function (global) {
	"use strict";

	var SYNC_PREFIX = "BF|";
	var MAX_BLOBS = 5;
	var POP_CLICKS = 5;              // rapid clicks before a blob blows up
	var TAP_WINDOW = 850;           // ms window to chain rapid clicks
	var EXPR = {
		idle: "i", happy: "h", surprised: "s", dizzy: "d", sad: "a", love: "l",
		angry: "g", silly: "y", sleepy: "z", scared: "f", laughing: "j", cool: "c"
	};
	var EXPR_REV = {};
	for (var k in EXPR) { if (EXPR.hasOwnProperty(k)) EXPR_REV[EXPR[k]] = k; }

	var QUIPS = {
		poke: ["hey!", "boop!", "excuse me??", "rude but ok", "hehe", "again??", "stop poking me lol", "i felt that", "ow ow ow"],
		yeet: ["WHEEEE!", "too fast!!", "my stomach...", "weeeee", "bonk incoming", "skill issue (me)", "I BELIEVE I CAN FLY", "yeet successful"],
		wall: ["ow my face", "why wall", "i live here now", "grrr", "that hurt ngl", "wall = my nemesis", "splat"],
		idle: ["...", "hi friend", "nice chords", "blob life", "zZz maybe", "vibing~", "i am blob", "boneless", "100% jelly", "do blobs dream?"],
		bump: ["scuse me", "watch it!", "rude!", "personal space!!", "oof", "pardon", "no touchy", "we kissing??"],
		// escalating warnings as a blob gets clicked toward exploding
		inflate: ["hey stop", "i'm warning you", "too much air!!", "i don't feel so good", "ABORT ABORT", "🎈"],
		react: ["AAAH!", "did it just—", "RIP buddy", "i'm next aren't i", "explosions?! here?!", "press F", "👻", "yikes!!"]
	};
	var BLOB_HUES = [198, 12, 280, 140, 48, 330, 168, 258];

	var blobSyncLockUntil = 0;

	function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
	function rand(a, b) { return a + Math.random() * (b - a); }
	function pick(list) { return list[Math.floor(Math.random() * list.length)]; }

	// ---- A single blob ---------------------------------------------------

	function Blob(opts) {
		this.id = opts.id;
		this.x = opts.x;
		this.y = opts.y;
		this.vx = opts.vx || 0;
		this.vy = opts.vy || 0;
		this.sx = 1;
		this.sy = 1;
		this.hue = opts.hue != null ? opts.hue : pick(BLOB_HUES);
		this.expr = "happy";
		this.exprUntil = Date.now() + 700;
		this.wobble = rand(0, Math.PI * 2);
		this.wobbleSpeed = rand(0.11, 0.17);
		this.bubble = null;
		this.bubbleUntil = 0;
		this.idleT = rand(0, 200);
		this.blinkUntil = 0;
		// balloon inflation from rapid clicking
		this.tapCount = 0;
		this.tapUntil = 0;
		this.inflate = 0;       // eased
		this.inflateTarget = 0;
		this.popping = false;
		// rest position drifts a little so blobs don't all stack
		this.restX = clamp(opts.x, 0.18, 0.82);
		this.restY = clamp(opts.y, 0.2, 0.78);

		// ---- networking / ownership ----
		// Exactly one client (the "owner") simulates a blob and broadcasts its
		// state; everyone else interpolates toward the authoritative target.
		this.ownerTag = opts.ownerTag || null;
		this.lastNetAt = 0;          // when we last heard from the owner
		this.netX = this.x; this.netY = this.y;   // authoritative target (remote)
		this.netVx = 0; this.netVy = 0;
		this.netSx = 1; this.netSy = 1;
	}

	Blob.prototype.radius = function () {
		// normalized collision radius, grows with stretch + inflation
		return 0.11 * ((this.sx + this.sy) / 2) * (1 + this.inflate * 0.16);
	};

	Blob.prototype.say = function (text, ms) {
		this.bubble = text;
		this.bubbleUntil = Date.now() + (ms || 1700);
	};

	Blob.prototype.setExpr = function (name, ms) {
		this.expr = name;
		this.exprUntil = Date.now() + (ms || 800);
	};

	// ---- The manager (public name stays BlobFriend) ----------------------

	function BlobFriend(opts) {
		opts = opts || {};
		this.client = opts.client;
		this.mountEl = opts.mountEl || null;
		this.onLayoutChange = opts.onLayoutChange || function () {};

		this.blobs = [];
		this.particles = [];
		this._idSeq = 0;
		this._tag = null;

		this.dragBlob = null;
		this.dragStart = null;
		this.lastPointer = null;
		this.ignoreSelfUntil = 0;
		this.syncThrottle = null;
		this.pendingSync = {};
		this.animId = null;
		this.visible = false;
		this._lastBcast = 0;         // last continuous owned-state broadcast

		this._bindDom();
		this.setVisible(false);
		this._startLoop();
	}

	BlobFriend.SYNC_PREFIX = SYNC_PREFIX;
	BlobFriend.MAX_BLOBS = MAX_BLOBS;

	BlobFriend.isSyncText = function (text) {
		return !!(text && typeof text === "string" && text.indexOf(SYNC_PREFIX) === 0);
	};

	BlobFriend.prototype.serverTime = function () {
		return Date.now() + (this.client.serverTimeOffset || 0);
	};

	BlobFriend.prototype._ownTag = function () {
		if (this._tag) return this._tag;
		var tag = "";
		try {
			var me = this.client && this.client.getOwnParticipant();
			if (me && me._id) tag = String(me._id).replace(/[^a-zA-Z0-9]/g, "").slice(-4);
		} catch (e) {}
		if (!tag) tag = Math.floor(rand(1000, 9999)).toString(36);
		this._tag = tag;
		return tag;
	};

	BlobFriend.prototype._newId = function () {
		return this._ownTag() + this._idSeq++;
	};

	BlobFriend.prototype._byId = function (id) {
		for (var i = 0; i < this.blobs.length; i++) {
			if (this.blobs[i].id === id) return this.blobs[i];
		}
		return null;
	};

	// ---- networking ------------------------------------------------------

	BlobFriend.prototype.sendSync = function (payload) {
		if (!this.client || !this.client.isConnected()) return;
		var msg = SYNC_PREFIX + payload;
		if (msg.length > 512) return;
		this.ignoreSelfUntil = Date.now() + 400;
		this.client.broadcastRoom(msg);
	};

	BlobFriend.prototype._enc = function (n) { return Math.round(clamp(n, 0, 1) * 1000); };
	BlobFriend.prototype._dec = function (s) { return clamp(parseInt(s, 10) || 0, 0, 1000) / 1000; };

	// ---- ownership -------------------------------------------------------
	// Derive a short stable tag from a participant id (same scheme as _ownTag).
	BlobFriend.prototype._tagOf = function (id) {
		return String(id == null ? "" : id).replace(/[^a-zA-Z0-9]/g, "").slice(-4);
	};
	BlobFriend.prototype._iOwn = function (b) {
		return !!b && b.ownerTag === this._ownTag();
	};
	// A blob may only be moved locally by physics/drag if I own it (or I'm dragging it).
	BlobFriend.prototype._movable = function (b) {
		return !b.popping && (b === this.dragBlob || this._iOwn(b));
	};
	// numeric seed from my tag, so different clients adopt orphaned blobs at
	// slightly different times instead of all at once.
	BlobFriend.prototype._adoptJitter = function () {
		var t = this._ownTag(), s = 0;
		for (var i = 0; i < t.length; i++) s += t.charCodeAt(i);
		return (s % 1000);
	};
	// Take ownership of a blob locally (broadcaster implicitly owns it, so the
	// next continuous broadcast tells everyone else).
	BlobFriend.prototype._claim = function (b) {
		if (!b) return;
		b.ownerTag = this._ownTag();
		b.lastNetAt = 0;
	};

	// ---- continuous broadcast of blobs I own -----------------------------
	BlobFriend.prototype._broadcastOwned = function (now, force) {
		if (!this.client || !this.client.isConnected()) return;
		if (!force && now - this._lastBcast < 66) return;   // ~15 Hz
		// nobody else to sync with → save the bandwidth
		if (this.client.countParticipants && this.client.countParticipants() <= 1) return;
		var entries = [];
		for (var i = 0; i < this.blobs.length; i++) {
			var b = this.blobs[i];
			if (b.popping || !this._iOwn(b)) continue;
			entries.push(
				b.id + "," + this._enc(b.x) + "," + this._enc(b.y) + "," +
				Math.round(b.vx * 100) + "," + Math.round(b.vy * 100) + "," +
				Math.round(b.sx * 100) + "," + Math.round(b.sy * 100) + "," +
				(EXPR[b.expr] || "i") + "," + Math.round(b.hue));
		}
		if (!entries.length) return;
		this._lastBcast = now;
		this.sendSync("m|" + this.serverTime() + "|" + entries.join(";"));
	};

	BlobFriend.prototype.requestSync = function () { this.sendSync("q"); };

	BlobFriend.prototype._replyRoster = function () {
		var parts = [];
		for (var i = 0; i < this.blobs.length; i++) {
			var b = this.blobs[i];
			parts.push(b.id + "," + this._enc(b.x) + "," + this._enc(b.y) + "," + Math.round(b.hue));
		}
		this.sendSync("r|" + parts.join(";"));
	};

	BlobFriend.prototype.tryHandleChat = function (msg) {
		var text = msg.a != null ? msg.a : (msg.message != null ? msg.message : "");
		if (!BlobFriend.isSyncText(text)) return false;

		var parts = text.slice(SYNC_PREFIX.length).split("|");
		var cmd = parts[0];
		var me = this.client.getOwnParticipant();
		if (me && msg.p && msg.p._id === me._id && Date.now() < this.ignoreSelfUntil) {
			return true;
		}

		if (cmd === "m") {
			// batched authoritative state from a blob owner
			this._applyBatch(parts, msg);
		} else if (cmd === "u") {
			this._applyUpdate(parts, msg);   // legacy single-blob update
		} else if (cmd === "add") {
			var ownerTag = parts[5] || (msg && msg.p ? this._tagOf(msg.p._id) : null);
			this.addBlob({ id: parts[1], x: this._dec(parts[2]), y: this._dec(parts[3]), hue: parseInt(parts[4], 10) || 0, ownerTag: ownerTag, fromNet: true });
		} else if (cmd === "pop") {
			var victim = this._byId(parts[1]);
			if (victim) this.popBlob(victim, true);
		} else if (cmd === "r") {
			this._applyRoster(parts[1]);
		} else if (cmd === "q") {
			var self = this;
			setTimeout(function () {
				if (Date.now() < blobSyncLockUntil) return;
				blobSyncLockUntil = Date.now() + 700;
				self._replyRoster();
			}, 60 + Math.random() * 140);
		}
		return true;
	};

	// Batched continuous update: "m|<serverTime>|id,x,y,vx,vy,sx,sy,expr,hue;..."
	// The broadcaster is, by definition, the current owner of these blobs.
	BlobFriend.prototype._applyBatch = function (parts, msg) {
		var ownerTag = (msg && msg.p) ? this._tagOf(msg.p._id) : null;
		var entries = (parts[2] || "").split(";");
		for (var i = 0; i < entries.length; i++) {
			var f = entries[i].split(",");
			if (f.length < 9) continue;
			this._applyEntry(f, ownerTag);
		}
	};

	// Legacy single update: "u|id|x|y|vx|vy|sx|sy|expr|hue|t"
	BlobFriend.prototype._applyUpdate = function (parts, msg) {
		var ownerTag = (msg && msg.p) ? this._tagOf(msg.p._id) : null;
		this._applyEntry([parts[1], parts[2], parts[3], parts[4], parts[5], parts[6], parts[7], parts[8], parts[9]], ownerTag);
	};

	// Apply one authoritative blob state. We don't snap the rendered position;
	// instead we set the interpolation target and let the loop ease toward it,
	// so remote blobs move smoothly between the ~15 Hz updates.
	BlobFriend.prototype._applyEntry = function (f, ownerTag) {
		var id = f[0];
		var nx = this._dec(f[1]);
		var ny = this._dec(f[2]);
		var b = this._byId(id);
		if (!b) {
			if (this.blobs.length >= MAX_BLOBS) return;
			b = this.addBlob({ id: id, x: nx, y: ny, hue: parseInt(f[8], 10) || 0, ownerTag: ownerTag, fromNet: true });
			if (!b) return;
		}
		// the sender owns it; stop simulating it locally
		if (ownerTag) b.ownerTag = ownerTag;
		b.lastNetAt = Date.now();
		b.netX = nx;
		b.netY = ny;
		b.netVx = (parseInt(f[3], 10) || 0) / 100;
		b.netVy = (parseInt(f[4], 10) || 0) / 100;
		b.netSx = (parseInt(f[5], 10) || 100) / 100;
		b.netSy = (parseInt(f[6], 10) || 100) / 100;
		b.expr = EXPR_REV[f[7]] || b.expr;
		b.exprUntil = Date.now() + 500;
		// first time we hear about it, snap so it doesn't fly in from a stale spot
		if (b._netInit !== true) { b.x = nx; b.y = ny; b.sx = b.netSx; b.sy = b.netSy; b._netInit = true; }
	};

	BlobFriend.prototype._applyRoster = function (data) {
		if (!data) return;
		var entries = data.split(";");
		for (var i = 0; i < entries.length && this.blobs.length < MAX_BLOBS; i++) {
			var f = entries[i].split(",");
			if (!f[0] || this._byId(f[0])) continue;
			this.addBlob({ id: f[0], x: this._dec(f[1]), y: this._dec(f[2]), hue: parseInt(f[3], 10) || 0, fromNet: true });
		}
	};

	// ---- DOM / input -----------------------------------------------------

	BlobFriend.prototype._bindDom = function () {
		var self = this;
		if (!this.mountEl) return;

		this.canvas = this.mountEl.querySelector(".blob-canvas");
		this.ctx = this.canvas.getContext("2d");
		this.subEl = this.mountEl.querySelector(".play-widget-sub");

		var onDown = function (e) {
			if (!self.visible) return;
			e.preventDefault();
			self._pointerDown(self._evtPos(e));
		};
		var onMove = function (e) {
			if (!self.dragBlob) return;
			e.preventDefault();
			self._pointerMove(self._evtPos(e));
		};
		var onUp = function () { self._pointerUp(); };

		this.canvas.addEventListener("mousedown", onDown);
		this.canvas.addEventListener("touchstart", onDown, { passive: false });
		window.addEventListener("mousemove", onMove);
		window.addEventListener("touchmove", onMove, { passive: false });
		window.addEventListener("mouseup", onUp);
		window.addEventListener("touchend", onUp);
		window.addEventListener("touchcancel", onUp);

		var closeBtn = this.mountEl.querySelector(".blob-toggle-btn");
		if (closeBtn) closeBtn.addEventListener("click", function (e) {
			e.preventDefault(); e.stopPropagation();
			self.setVisible(false);
		});
		var addBtn = this.mountEl.querySelector(".blob-add-btn");
		if (addBtn) addBtn.addEventListener("click", function (e) {
			e.preventDefault(); e.stopPropagation();
			self.spawnFromButton();
		});

		this._resize();
		window.addEventListener("resize", function () { self._resize(); });
		if (typeof ResizeObserver !== "undefined") {
			this._ro = new ResizeObserver(function () { if (self.visible) self._resize(); });
			this._ro.observe(this.mountEl);
		}
	};

	BlobFriend.prototype._evtPos = function (e) {
		var rect = this.canvas.getBoundingClientRect();
		var t = e.touches ? e.touches[0] : e;
		return {
			x: clamp((t.clientX - rect.left) / rect.width, 0, 1),
			y: clamp((t.clientY - rect.top) / rect.height, 0, 1),
			t: Date.now()
		};
	};

	BlobFriend.prototype._blobAt = function (px, py) {
		// topmost (last drawn) blob whose ellipse contains the point.
		// normalized radii: ~0.11 in x, ~0.13 in y (canvas aspect cancels out).
		for (var i = this.blobs.length - 1; i >= 0; i--) {
			var b = this.blobs[i];
			if (b.popping) continue;
			var rx = b.radius() * 1.2;          // a little forgiving
			var ry = b.radius() * 1.18 * 1.2;
			var nx = (px - b.x) / rx;
			var ny = (py - b.y) / ry;
			if (nx * nx + ny * ny <= 1) return b;
		}
		return null;
	};

	BlobFriend.prototype._resize = function () {
		if (!this.canvas) return;
		var rect = this.canvas.getBoundingClientRect();
		var dpr = window.devicePixelRatio || 1;
		this.canvas.width = Math.max(1, Math.floor(rect.width * dpr));
		this.canvas.height = Math.max(1, Math.floor(rect.height * dpr));
		this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		this.onLayoutChange();
	};

	BlobFriend.prototype._updateHud = function () {
		if (this.subEl) this.subEl.textContent = this.blobs.length + "/" + MAX_BLOBS + " blobs · poke · pop";
	};

	BlobFriend.prototype.setVisible = function (on) {
		this.visible = !!on;
		if (this.mountEl) this.mountEl.classList.toggle("blob-hidden", !this.visible);
		var self = this;
		if (this.visible) {
			if (!this.blobs.length) this.addBlob({ x: 0.5, y: 0.45 });
			requestAnimationFrame(function () {
				requestAnimationFrame(function () { self._resize(); });
			});
		}
		this._updateHud();
		this.onLayoutChange();
	};

	// ---- spawning & popping ---------------------------------------------

	BlobFriend.prototype.addBlob = function (opts) {
		opts = opts || {};
		if (this.blobs.length >= MAX_BLOBS) {
			if (!opts.fromNet) this._toast("too crowded! (max " + MAX_BLOBS + ")");
			return null;
		}
		var id = opts.id || this._newId();
		if (this._byId(id)) return this._byId(id);
		var x = opts.x != null ? opts.x : rand(0.25, 0.75);
		var y = opts.y != null ? opts.y : rand(0.25, 0.65);
		// I own blobs I spawn; blobs spawned over the network are owned by their spawner.
		var ownerTag = opts.fromNet ? (opts.ownerTag || null) : this._ownTag();
		var blob = new Blob({ id: id, x: x, y: y, hue: opts.hue, vx: rand(-1, 1), vy: rand(-0.6, 0), ownerTag: ownerTag });
		if (opts.fromNet) { blob.lastNetAt = Date.now(); blob._netInit = true; }
		this.blobs.push(blob);
		if (typeof window !== "undefined" && window.funSound) window.funSound("pop", { throttle: 50 });
		this._spawnParticles(x, y, blob.hue, 8, "✨");
		blob.say(pick(["hi!!", "i'm new!", "boop", "more of me!", "hello world"]), 1500);
		this._updateHud();
		if (!opts.fromNet) this.sendSync("add|" + id + "|" + this._enc(x) + "|" + this._enc(y) + "|" + Math.round(blob.hue) + "|" + this._ownTag());
		return blob;
	};

	BlobFriend.prototype.spawnFromButton = function () {
		if (this.blobs.length >= MAX_BLOBS) {
			this._toast("too crowded! (max " + MAX_BLOBS + ")");
			// make the existing blobs protest, funnily
			for (var i = 0; i < this.blobs.length; i++) {
				if (!this.blobs[i].popping) {
					this.blobs[i].setExpr("angry", 700);
					this.blobs[i].say(pick(["no room!", "we're full!", "go away", "5 is plenty"]), 1300);
				}
			}
			return;
		}
		this.addBlob({});
	};

	BlobFriend.prototype._toast = function (text) {
		// float a message in the middle of the canvas
		this.particles.push({
			x: 0.5, y: 0.5, vx: 0, vy: -0.0008,
			life: 1, maxLife: 1, decay: 0.012, text: text, size: 15, color: "#ff5a7a", isText: true
		});
	};

	BlobFriend.prototype.popBlob = function (blob, fromNet) {
		if (!blob || blob.popping) return;
		blob.popping = true;
		if (typeof window !== "undefined" && window.funSound) window.funSound("splat");
		this._spawnParticles(blob.x, blob.y, blob.hue, 22, null);
		this._spawnParticles(blob.x, blob.y, blob.hue, 6, pick([["💥"], ["🎉"], ["✨"], ["💦"]])[0]);
		this.particles.push({
			x: blob.x, y: blob.y - 0.02, vx: 0, vy: -0.0016,
			life: 1, maxLife: 1, decay: 0.018,
			text: pick(["POP!", "BOOM!", "KABLOOM!", "💥 POP 💥"]), size: 22, color: "hsl(" + blob.hue + ",90%,55%)", isText: true
		});

		// knock the neighbours back and scare them
		for (var i = 0; i < this.blobs.length; i++) {
			var o = this.blobs[i];
			if (o === blob || o.popping) continue;
			var dx = o.x - blob.x, dy = o.y - blob.y;
			var d = Math.sqrt(dx * dx + dy * dy) || 0.01;
			var force = clamp(0.5 / d, 0.3, 5);
			o.vx += (dx / d) * force;
			o.vy += (dy / d) * force - 0.4;
			o.setExpr(d < 0.4 ? "scared" : "surprised", 1100);
			o.say(pick(QUIPS.react), 1500);
		}

		var self = this;
		var id = blob.id;
		setTimeout(function () {
			for (var j = 0; j < self.blobs.length; j++) {
				if (self.blobs[j].id === id) { self.blobs.splice(j, 1); break; }
			}
			self._updateHud();
		}, 60);

		if (!fromNet) this.sendSync("pop|" + blob.id);
	};

	BlobFriend.prototype._spawnParticles = function (x, y, hue, count, emoji) {
		for (var i = 0; i < count; i++) {
			var a = rand(0, Math.PI * 2);
			var sp = rand(0.004, 0.016);
			this.particles.push({
				x: x, y: y,
				vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 0.004,
				life: 1, maxLife: 1, decay: rand(0.02, 0.04),
				size: emoji ? rand(12, 20) : rand(3, 7),
				color: "hsl(" + (hue + rand(-20, 20)) + ", 85%, " + Math.round(rand(55, 75)) + "%)",
				text: emoji || null, isText: !!emoji
			});
		}
		if (this.particles.length > 220) this.particles.splice(0, this.particles.length - 220);
	};

	// ---- pointer interactions -------------------------------------------

	BlobFriend.prototype._pointerDown = function (p) {
		var blob = this._blobAt(p.x, p.y);
		if (!blob) return;
		this._claim(blob);   // grabbing a blob makes me its authority
		this.dragBlob = blob;
		this.dragStart = { x: p.x, y: p.y, t: p.t, bx: blob.x, by: blob.y, moved: 0 };
		this.lastPointer = p;
		if (typeof window !== "undefined" && window.funSound) window.funSound("boing", { throttle: 120 });
		this._broadcastOwned(Date.now(), true);   // tell everyone immediately
		blob.setExpr("surprised", 600);
		blob.say(pick(QUIPS.poke), 1100);
	};

	BlobFriend.prototype._pointerMove = function (p) {
		var blob = this.dragBlob;
		if (!blob || !this.dragStart) return;
		var dx = p.x - this.dragStart.x;
		var dy = p.y - this.dragStart.y;
		this.dragStart.moved += Math.abs(p.x - this.lastPointer.x) + Math.abs(p.y - this.lastPointer.y);
		blob.x = clamp(this.dragStart.bx + dx * 0.9, 0.08, 0.92);
		blob.y = clamp(this.dragStart.by + dy * 0.9, 0.08, 0.88);
		blob.sx = clamp(1 + Math.abs(dx) * 1.8, 0.55, 1.65);
		blob.sy = clamp(1 - Math.abs(dy) * 0.6 + Math.abs(dx) * 0.4, 0.55, 1.65);

		var dt = Math.max(1, p.t - this.lastPointer.t);
		blob.vx = (p.x - this.lastPointer.x) / dt * 16;
		blob.vy = (p.y - this.lastPointer.y) / dt * 16;
		this.lastPointer = p;
		this._broadcastOwned(Date.now());   // ~15 Hz while dragging
	};

	BlobFriend.prototype._pointerUp = function () {
		var blob = this.dragBlob;
		if (!blob) return;
		this.dragBlob = null;
		var moved = this.dragStart ? this.dragStart.moved : 0;
		this.dragStart = null;
		this.lastPointer = null;

		var speed = Math.sqrt(blob.vx * blob.vx + blob.vy * blob.vy);
		if (moved > 0.06 && speed > 0.35) {
			// thrown
			blob.vx = clamp(blob.vx * 14, -8, 8);
			blob.vy = clamp(blob.vy * 14, -8, 8);
			blob.setExpr("dizzy", 1200);
			blob.say(pick(QUIPS.yeet), 1400);
			blob.tapCount = 0;
			this._broadcastOwned(Date.now(), true);   // send the throw instantly
		} else {
			// a tap → counts toward inflating/popping like a balloon
			this._tapBlob(blob);
		}
	};

	BlobFriend.prototype._tapBlob = function (blob) {
		var now = Date.now();
		blob.tapCount = (now < blob.tapUntil) ? blob.tapCount + 1 : 1;
		blob.tapUntil = now + TAP_WINDOW;
		blob.inflateTarget = blob.tapCount;

		// little squish + recoil kick from the poke
		blob.sx = clamp(blob.sx * 0.86, 0.5, 1.6);
		blob.sy = clamp(blob.sy * 1.12, 0.5, 1.6);
		blob.vy -= 0.15;

		if (blob.tapCount >= POP_CLICKS) {
			this.popBlob(blob, false);
			return;
		}
		// escalating funny reactions as it fills with air
		var idx = clamp(blob.tapCount - 1, 0, QUIPS.inflate.length - 1);
		blob.say(QUIPS.inflate[idx], 1100);
		blob.setExpr(blob.tapCount >= 3 ? "scared" : (blob.tapCount === 2 ? "angry" : "surprised"), 900);
		if (blob.tapCount >= 3) this._spawnParticles(blob.x + rand(-0.02, 0.02), blob.y - 0.04, 200, 2, "💦");
	};

	// ---- main loop -------------------------------------------------------

	BlobFriend.prototype._startLoop = function () {
		var self = this;
		var last = Date.now();
		function tick() {
			self.animId = requestAnimationFrame(tick);
			var now = Date.now();
			var dt = Math.min(32, now - last) / 16.67;
			last = now;
			self._step(dt, now);
			self._broadcastOwned(now);   // stream the blobs I own to the room
			self._draw();
		}
		tick();
	};

	BlobFriend.prototype._step = function (dt, now) {
		var blobs = this.blobs;
		var i, b;
		var adoptAfter = 2500 + this._adoptJitter();

		for (i = 0; i < blobs.length; i++) {
			b = blobs[i];
			b.wobble += b.wobbleSpeed * dt;
			if (now > b.bubbleUntil) b.bubble = null;

			if (!this._movable(b)) {
				// ---- remote blob: smoothly follow the owner's authoritative state ----
				// extrapolate the target with its last velocity so motion stays fluid
				// between the ~15 Hz updates, then ease the rendered position toward it.
				b.netX = clamp(b.netX + b.netVx * 0.016 * dt, 0.06, 0.94);
				b.netY = clamp(b.netY + b.netVy * 0.016 * dt, 0.06, 0.9);
				var ke = clamp(0.35 * dt, 0, 1);
				b.x += (b.netX - b.x) * ke;
				b.y += (b.netY - b.y) * ke;
				b.sx += (b.netSx - b.sx) * ke;
				b.sy += (b.netSy - b.sy) * ke;
				// owner went silent (left the room?) → adopt the orphan so it lives on
				if (b.ownerTag !== this._ownTag() && now - b.lastNetAt > adoptAfter) this._claim(b);
				continue;
			}

			// ---- blobs I own: full local simulation ----
			// ease inflation toward target; expire the tap window
			if (now > b.tapUntil) b.inflateTarget = 0;
			b.inflate += (b.inflateTarget - b.inflate) * 0.18 * dt;
			if (b.inflate < 0.01) b.inflate = 0;

			// expression timeout
			if (now > b.exprUntil && b.expr !== "dizzy") {
				var spd = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
				b.expr = spd > 1.2 ? "dizzy" : (spd > 0.3 ? "happy" : "idle");
			}

			// idle antics
			b.idleT += dt;
			if (b !== this.dragBlob && b.idleT > 240 && b.expr === "idle" && !b.bubble && !b.inflate) {
				b.idleT = 0;
				var r = Math.random();
				if (r < 0.3) { b.setExpr("silly", 900); b.say(pick(QUIPS.idle), 1500); }
				else if (r < 0.45) { b.setExpr("laughing", 800); }
				else if (r < 0.58) { b.setExpr("cool", 1100); b.say(pick(["😎", "deal with it", "too cool"]), 1200); }
				else if (r < 0.7) { b.setExpr("sleepy", 1300); }
			}

			if (b === this.dragBlob || b.popping) continue;

			// physics: drift home, damp, integrate
			b.vx *= Math.pow(0.92, dt);
			b.vy *= Math.pow(0.92, dt);
			b.vx += (b.restX - b.x) * 0.012 * dt;
			b.vy += (b.restY - b.y) * 0.012 * dt;
			b.x += b.vx * 0.016 * dt;
			b.y += b.vy * 0.016 * dt;
			b.sx += (1 - b.sx) * 0.12 * dt;
			b.sy += (1 - b.sy) * 0.12 * dt;

			// walls
			if (b.x < 0.06) { b.x = 0.06; b.vx = Math.abs(b.vx) * 0.6; b.setExpr("angry", 400); b.say(pick(QUIPS.wall), 1000); }
			if (b.x > 0.94) { b.x = 0.94; b.vx = -Math.abs(b.vx) * 0.6; b.setExpr("angry", 400); b.say(pick(QUIPS.wall), 1000); }
			if (b.y < 0.06) { b.y = 0.06; b.vy = Math.abs(b.vy) * 0.6; }
			if (b.y > 0.9) { b.y = 0.9; b.vy = -Math.abs(b.vy) * 0.6; b.setExpr("sad", 500); b.say("help im falling", 1100); }
		}

		this._collide(dt);
		this._stepParticles(dt);
	};

	BlobFriend.prototype._collide = function (dt) {
		var blobs = this.blobs;
		for (var i = 0; i < blobs.length; i++) {
			for (var j = i + 1; j < blobs.length; j++) {
				var a = blobs[i], b = blobs[j];
				if (a.popping || b.popping) continue;
				var dx = b.x - a.x, dy = b.y - a.y;
				var dist = Math.sqrt(dx * dx + dy * dy) || 0.0001;
				var minD = (a.radius() + b.radius()) * 0.85;
				if (dist < minD) {
					var nx = dx / dist, ny = dy / dist;
					var overlap = (minD - dist);
					// Only blobs I own/drag may be moved by collisions; remote blobs
					// are positioned by their own owner, so treat them as fixed.
					var aFixed = !this._movable(a), bFixed = !this._movable(b);
					if (!aFixed) { a.x -= nx * overlap * (bFixed ? 1 : 0.5); a.y -= ny * overlap * (bFixed ? 1 : 0.5); }
					if (!bFixed) { b.x += nx * overlap * (aFixed ? 1 : 0.5); b.y += ny * overlap * (aFixed ? 1 : 0.5); }
					// exchange a little velocity → a shove
					var push = overlap * 6;
					if (!aFixed) { a.vx -= nx * push; a.vy -= ny * push; }
					if (!bFixed) { b.vx += nx * push; b.vy += ny * push; }
					// squish + occasional grumble
					a.sx = clamp(a.sx * 0.97, 0.6, 1.6); b.sx = clamp(b.sx * 0.97, 0.6, 1.6);
					if (Math.random() < 0.02) {
						var who = Math.random() < 0.5 ? a : b;
						who.say(pick(QUIPS.bump), 900);
						who.setExpr(Math.random() < 0.5 ? "silly" : "surprised", 600);
					}
				}
			}
		}
	};

	BlobFriend.prototype._stepParticles = function (dt) {
		var ps = this.particles;
		for (var i = ps.length - 1; i >= 0; i--) {
			var p = ps[i];
			p.x += p.vx * dt;
			p.y += p.vy * dt;
			p.vy += 0.0006 * dt; // gravity
			p.vx *= Math.pow(0.96, dt);
			p.life -= p.decay * dt;
			if (p.life <= 0) ps.splice(i, 1);
		}
	};

	// ---- rendering -------------------------------------------------------

	BlobFriend.prototype._draw = function () {
		if (!this.ctx || !this.canvas) return;
		var rect = this.canvas.getBoundingClientRect();
		var w = rect.width, h = rect.height;
		var ctx = this.ctx;
		ctx.clearRect(0, 0, w, h);

		// shadows first so blobs sit "on the floor"
		for (var i = 0; i < this.blobs.length; i++) this._drawShadow(ctx, this.blobs[i], w, h);
		for (i = 0; i < this.blobs.length; i++) this._drawBlob(ctx, this.blobs[i], w, h);
		this._drawParticles(ctx, w, h);
	};

	BlobFriend.prototype._drawShadow = function (ctx, b, w, h) {
		var cx = b.x * w, cy = (b.y + 0.13) * h;
		var rx = w * 0.1 * b.sx * (1 + b.inflate * 0.16);
		ctx.fillStyle = "rgba(20,40,60,0.12)";
		ctx.beginPath();
		ctx.ellipse(cx, cy, rx, h * 0.02, 0, 0, Math.PI * 2);
		ctx.fill();
	};

	BlobFriend.prototype._drawBlob = function (ctx, b, w, h) {
		var cx = b.x * w, cy = b.y * h;
		var inf = 1 + b.inflate * 0.18;
		var jitter = b.inflate > 1.5 ? (Math.sin(b.wobble * 9) * b.inflate * 0.6) : 0;
		var wob = 1 + Math.sin(b.wobble) * 0.05;
		var rx = w * 0.11 * b.sx * wob * inf + jitter;
		var ry = h * 0.13 * b.sy * (1 + Math.cos(b.wobble * 1.3) * 0.04) * inf + jitter;

		// hue shifts toward red as it inflates / by mood
		var moodShift = b.expr === "angry" ? 8 : (b.expr === "love" ? -10 : 0);
		var redPull = b.inflate * 14;
		var hue = b.hue - redPull + moodShift;
		var light = 62 + (b.expr === "scared" ? 6 : 0);

		var grad = ctx.createRadialGradient(cx - rx * 0.25, cy - ry * 0.3, rx * 0.1, cx, cy, Math.max(rx, ry));
		grad.addColorStop(0, "hsl(" + (hue + 10) + ", 90%, " + (light + 18) + "%)");
		grad.addColorStop(0.55, "hsl(" + hue + ", 78%, " + light + "%)");
		grad.addColorStop(1, "hsl(" + (hue + 6) + ", 72%, " + (light - 20) + "%)");
		ctx.fillStyle = grad;
		ctx.beginPath();
		ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
		ctx.fill();
		ctx.strokeStyle = "rgba(255,255,255,0.4)";
		ctx.lineWidth = 2;
		ctx.stroke();

		// glossy highlight
		ctx.fillStyle = "rgba(255,255,255,0.45)";
		ctx.beginPath();
		ctx.ellipse(cx - rx * 0.35, cy - ry * 0.4, rx * 0.18, ry * 0.12, -0.5, 0, Math.PI * 2);
		ctx.fill();

		// blush for happy/love
		if (b.expr === "love" || b.expr === "happy" || b.expr === "laughing") {
			ctx.fillStyle = "rgba(255,120,150,0.35)";
			ctx.beginPath();
			ctx.ellipse(cx - rx * 0.55, cy + ry * 0.08, rx * 0.18, ry * 0.1, 0, 0, Math.PI * 2);
			ctx.ellipse(cx + rx * 0.55, cy + ry * 0.08, rx * 0.18, ry * 0.1, 0, 0, Math.PI * 2);
			ctx.fill();
		}

		var eyeOffX = rx * 0.34;
		var eyeOffY = -ry * 0.12;
		var eyeR = Math.min(rx, ry) * 0.2;
		this._drawEyes(ctx, b, cx, cy, eyeOffX, eyeOffY, eyeR);
		this._drawMouth(ctx, b, cx, cy + ry * 0.22, rx, ry);
		this._drawAccessories(ctx, b, cx, cy, rx, ry);
		if (b.bubble) this._drawBubble(ctx, cx, cy - ry * 1.2, b.bubble, rx);
	};

	BlobFriend.prototype._drawAccessories = function (ctx, b, cx, cy, rx, ry) {
		// sweat drop when scared or over-inflated
		if (b.expr === "scared" || b.inflate > 2) {
			ctx.fillStyle = "rgba(120,200,255,0.85)";
			ctx.beginPath();
			ctx.arc(cx + rx * 0.7, cy - ry * 0.35, Math.max(2, rx * 0.08), 0, Math.PI * 2);
			ctx.fill();
		}
		// sleepy ZZ
		if (b.expr === "sleepy") {
			ctx.fillStyle = "rgba(40,70,100,0.8)";
			ctx.font = "700 " + Math.max(9, rx * 0.3) + "px verdana, sans-serif";
			ctx.textAlign = "left";
			ctx.fillText("z", cx + rx * 0.7, cy - ry * 0.7);
			ctx.fillText("Z", cx + rx * 0.95, cy - ry * 1.0);
			ctx.textAlign = "start";
		}
	};

	BlobFriend.prototype._drawEyes = function (ctx, b, cx, cy, offX, offY, r) {
		var expr = b.expr;
		var blink = Date.now() < b.blinkUntil;
		if (Math.random() < 0.004) b.blinkUntil = Date.now() + 120;
		if (expr === "surprised" || expr === "scared") r *= 1.3;

		// laughing → happy closed ^ ^ eyes
		if (expr === "laughing") {
			ctx.strokeStyle = "#1a3a50"; ctx.lineWidth = 2.4; ctx.lineCap = "round";
			for (var s = -1; s <= 1; s += 2) {
				var ex = cx + s * offX, ey = cy + offY;
				ctx.beginPath();
				ctx.moveTo(ex - r * 0.7, ey + r * 0.3);
				ctx.lineTo(ex, ey - r * 0.4);
				ctx.lineTo(ex + r * 0.7, ey + r * 0.3);
				ctx.stroke();
			}
			return;
		}
		// cool → sunglasses
		if (expr === "cool") {
			ctx.fillStyle = "#15212e";
			ctx.beginPath();
			ctx.roundRect ? ctx.roundRect(cx - offX - r, cy + offY - r * 0.7, r * 2, r * 1.4, r * 0.4)
				: ctx.rect(cx - offX - r, cy + offY - r * 0.7, r * 2, r * 1.4);
			ctx.roundRect ? ctx.roundRect(cx + offX - r, cy + offY - r * 0.7, r * 2, r * 1.4, r * 0.4)
				: ctx.rect(cx + offX - r, cy + offY - r * 0.7, r * 2, r * 1.4);
			ctx.fill();
			ctx.strokeStyle = "#15212e"; ctx.lineWidth = 2;
			ctx.beginPath(); ctx.moveTo(cx - offX + r, cy + offY); ctx.lineTo(cx + offX - r, cy + offY); ctx.stroke();
			return;
		}

		for (var side = -1; side <= 1; side += 2) {
			var pupils = { x: 0, y: 0 };
			if (expr === "dizzy") pupils = { x: r * 0.2, y: 0 };
			else if (expr === "love") pupils = { x: 0, y: -r * 0.15 };
			else if (expr === "silly") pupils = { x: side * r * 0.3, y: -r * 0.1 };
			else if (expr === "sleepy") pupils = { x: 0, y: r * 0.05 };
			else if (expr === "scared") pupils = { x: Math.sin(b.wobble * 6) * r * 0.2, y: 0 };
			var ex2 = cx + side * offX, ey2 = cy + offY;

			if (expr === "sleepy" || blink) {
				ctx.strokeStyle = "#1a3a50"; ctx.lineWidth = 2; ctx.lineCap = "round";
				ctx.beginPath();
				ctx.moveTo(ex2 - r * 0.7, ey2 + r * 0.1);
				ctx.lineTo(ex2 + r * 0.7, ey2 + r * 0.1);
				ctx.stroke();
				continue;
			}

			ctx.fillStyle = "#fff";
			ctx.beginPath();
			ctx.arc(ex2, ey2, r, 0, Math.PI * 2);
			ctx.fill();

			if (expr === "love") {
				ctx.fillStyle = "#ff6b9d";
				ctx.beginPath(); ctx.arc(ex2, ey2, r * 0.55, 0, Math.PI * 2); ctx.fill();
			} else if (expr === "angry") {
				ctx.strokeStyle = "#1a3a50"; ctx.lineWidth = 2.4;
				ctx.beginPath();
				ctx.moveTo(ex2 - r, ey2 - r * 0.9);
				ctx.lineTo(ex2 + r, ey2 - r * 0.3);
				ctx.stroke();
				ctx.fillStyle = "#1a3a50";
				ctx.beginPath(); ctx.arc(ex2 + pupils.x, ey2 + pupils.y + r * 0.1, r * 0.45, 0, Math.PI * 2); ctx.fill();
			} else if (expr === "sad") {
				ctx.fillStyle = "#1a3a50";
				ctx.beginPath(); ctx.arc(ex2, ey2 + r * 0.15, r * 0.42, 0, Math.PI * 2); ctx.fill();
			} else {
				var pr = (expr === "scared") ? r * 0.32 : r * 0.45;
				ctx.fillStyle = "#1a3a50";
				ctx.beginPath(); ctx.arc(ex2 + pupils.x, ey2 + pupils.y, pr, 0, Math.PI * 2); ctx.fill();
				ctx.fillStyle = "#fff";
				ctx.beginPath(); ctx.arc(ex2 + pupils.x + r * 0.15, ey2 + pupils.y - r * 0.15, r * 0.15, 0, Math.PI * 2); ctx.fill();
			}
		}
	};

	BlobFriend.prototype._drawMouth = function (ctx, b, cx, cy, rx, ry) {
		var expr = b.expr;
		ctx.strokeStyle = "#1a3a50";
		ctx.fillStyle = "#1a3a50";
		ctx.lineWidth = 2.5;
		ctx.lineCap = "round";
		ctx.beginPath();
		if (expr === "happy" || expr === "love") {
			ctx.arc(cx, cy - ry * 0.05, rx * 0.28, 0.15 * Math.PI, 0.85 * Math.PI);
			ctx.stroke();
		} else if (expr === "laughing") {
			ctx.moveTo(cx - rx * 0.3, cy - ry * 0.04);
			ctx.quadraticCurveTo(cx, cy + ry * 0.32, cx + rx * 0.3, cy - ry * 0.04);
			ctx.closePath();
			ctx.fill();
		} else if (expr === "surprised" || expr === "scared") {
			ctx.ellipse(cx, cy + ry * 0.02, rx * 0.14, ry * 0.13, 0, 0, Math.PI * 2);
			ctx.fill();
		} else if (expr === "sad") {
			ctx.arc(cx, cy + ry * 0.16, rx * 0.24, 1.15 * Math.PI, 1.85 * Math.PI);
			ctx.stroke();
		} else if (expr === "angry") {
			ctx.arc(cx, cy + ry * 0.14, rx * 0.22, 1.15 * Math.PI, 1.85 * Math.PI);
			ctx.stroke();
		} else if (expr === "dizzy") {
			ctx.moveTo(cx - rx * 0.2, cy);
			ctx.quadraticCurveTo(cx - rx * 0.05, cy + ry * 0.12, cx + rx * 0.05, cy);
			ctx.quadraticCurveTo(cx + rx * 0.15, cy - ry * 0.1, cx + rx * 0.2, cy);
			ctx.stroke();
		} else if (expr === "silly") {
			ctx.moveTo(cx - rx * 0.22, cy - ry * 0.02);
			ctx.quadraticCurveTo(cx, cy + ry * 0.2, cx + rx * 0.22, cy - ry * 0.05);
			ctx.stroke();
			// tongue
			ctx.fillStyle = "#ff6b9d";
			ctx.beginPath();
			ctx.ellipse(cx + rx * 0.04, cy + ry * 0.12, rx * 0.08, ry * 0.07, 0, 0, Math.PI * 2);
			ctx.fill();
		} else if (expr === "cool") {
			ctx.arc(cx, cy - ry * 0.02, rx * 0.24, 0.1 * Math.PI, 0.9 * Math.PI);
			ctx.stroke();
		} else if (expr === "sleepy") {
			ctx.moveTo(cx - rx * 0.1, cy + ry * 0.04);
			ctx.quadraticCurveTo(cx, cy + ry * 0.1, cx + rx * 0.1, cy + ry * 0.04);
			ctx.stroke();
		} else {
			ctx.moveTo(cx - rx * 0.18, cy);
			ctx.lineTo(cx + rx * 0.18, cy);
			ctx.stroke();
		}
	};

	BlobFriend.prototype._drawParticles = function (ctx, w, h) {
		var ps = this.particles;
		for (var i = 0; i < ps.length; i++) {
			var p = ps[i];
			ctx.globalAlpha = clamp(p.life, 0, 1);
			if (p.isText) {
				ctx.fillStyle = p.color || "#1a3a50";
				ctx.font = "700 " + p.size + "px verdana, sans-serif";
				ctx.textAlign = "center";
				ctx.textBaseline = "middle";
				ctx.fillText(p.text, p.x * w, p.y * h);
				ctx.textAlign = "start";
			} else {
				ctx.fillStyle = p.color;
				ctx.beginPath();
				ctx.arc(p.x * w, p.y * h, p.size, 0, Math.PI * 2);
				ctx.fill();
			}
		}
		ctx.globalAlpha = 1;
	};

	BlobFriend.prototype._drawBubble = function (ctx, cx, cy, text, rx) {
		var padX = 10, padY = 6;
		ctx.font = "600 11px verdana, sans-serif";
		var tw = ctx.measureText(text).width;
		var bw = Math.min(tw + padX * 2, Math.max(rx * 4, 90));
		var bh = 22;
		var bx = cx - bw / 2, by = cy - bh;
		ctx.fillStyle = "rgba(255,255,255,0.96)";
		ctx.strokeStyle = "rgba(30,50,70,0.35)";
		ctx.lineWidth = 1.5;
		ctx.beginPath();
		if (ctx.roundRect) ctx.roundRect(bx, by, bw, bh, 8); else ctx.rect(bx, by, bw, bh);
		ctx.fill();
		ctx.stroke();
		ctx.beginPath();
		ctx.moveTo(cx - 6, cy); ctx.lineTo(cx, cy - 4); ctx.lineTo(cx + 6, cy);
		ctx.fill();
		ctx.fillStyle = "#1a3040";
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.fillText(text, cx, by + bh / 2);
		ctx.textAlign = "start";
	};

	BlobFriend.prototype.destroy = function () {
		if (this.animId) cancelAnimationFrame(this.animId);
		if (this.syncThrottle) clearTimeout(this.syncThrottle);
	};

	global.BlobFriend = BlobFriend;
})(typeof window !== "undefined" ? window : this);
