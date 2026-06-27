/**
 * Desktop Doodler — tiny shared sketch pad synced across the room.
 * Room-synced via chat transport (DD| prefix).
 */
(function (global) {
	"use strict";

	var SYNC_PREFIX = "DD|";
	var ERASE = "__erase__";        // sentinel "colour" meaning this segment erases
	var COLORS = ["#ffffff", "#ff6b6b", "#ffd93d", "#6bcb77", "#4d96ff", "#c77dff", "#000000"];
	var COLOR_CODES = { "#ffffff": "w", "#ff6b6b": "r", "#ffd93d": "y", "#6bcb77": "g", "#4d96ff": "b", "#c77dff": "p", "#000000": "k" };
	var CODE_COLORS = { w: "#ffffff", r: "#ff6b6b", y: "#ffd93d", g: "#6bcb77", b: "#4d96ff", p: "#c77dff", k: "#000000" };
	COLOR_CODES[ERASE] = "e";
	CODE_COLORS["e"] = ERASE;
	var ERASER_SCALE = 3.6;         // eraser is this much fatter than the pen width
	var doodlerSyncLockUntil = 0;

	function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

	// ---- prebuilt stamp symbols ------------------------------------------
	// Each symbol is one or more polylines in unit space (-1..1). Placing a stamp
	// just turns these into ordinary line segments, so stamps sync for free over
	// the same "d" stroke transport.
	function circle(cx, cy, r, seg) {
		var p = [];
		for (var i = 0; i <= seg; i++) { var a = i / seg * Math.PI * 2; p.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
		return p;
	}
	function starPts() {
		var p = [];
		for (var i = 0; i <= 10; i++) { var a = -Math.PI / 2 + i * Math.PI / 5; var r = (i % 2 === 0) ? 1 : 0.42; p.push([Math.cos(a) * r, Math.sin(a) * r]); }
		return [p];
	}
	function heartPts() {
		var p = [];
		for (var i = 0; i <= 28; i++) {
			var t = i / 28 * Math.PI * 2;
			var x = 16 * Math.pow(Math.sin(t), 3);
			var y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
			p.push([x / 16, -y / 16]);
		}
		return [p];
	}
	function smileyPts() {
		var smile = [];
		for (var i = 0; i <= 12; i++) { var a = Math.PI * (0.18 + 0.64 * i / 12); smile.push([Math.cos(a) * 0.55, 0.1 + Math.sin(a) * 0.55]); }
		return [circle(0, 0, 1, 28), circle(-0.35, -0.28, 0.13, 10), circle(0.35, -0.28, 0.13, 10), smile];
	}
	function notePts() {
		return [circle(-0.32, 0.6, 0.26, 12), [[-0.06, 0.6], [-0.06, -0.82]], [[-0.06, -0.82], [0.42, -0.55], [0.42, -0.2]]];
	}
	var SYMBOLS = {
		star: starPts(),
		heart: heartPts(),
		smiley: smileyPts(),
		arrow: [[[-0.9, 0], [0.7, 0]], [[0.3, -0.38], [0.7, 0], [0.3, 0.38]]],
		bolt: [[[0.25, -1], [-0.35, 0.12], [0.05, 0.12], [-0.15, 1], [0.5, -0.2], [0.08, -0.2], [0.25, -1]]],
		check: [[[-0.7, 0], [-0.2, 0.55], [0.75, -0.6]]],
		cross: [[[-0.6, -0.6], [0.6, 0.6]], [[-0.6, 0.6], [0.6, -0.6]]],
		note: notePts()
	};
	var STAMP_META = [
		{ name: "star", emoji: "⭐" }, { name: "heart", emoji: "❤️" },
		{ name: "smiley", emoji: "🙂" }, { name: "arrow", emoji: "➡️" },
		{ name: "bolt", emoji: "⚡" }, { name: "check", emoji: "✔️" },
		{ name: "cross", emoji: "✖️" }, { name: "note", emoji: "🎵" }
	];

	function DesktopDoodler(opts) {
		opts = opts || {};
		this.client = opts.client;
		this.mountEl = opts.mountEl || null;
		this.onLayoutChange = opts.onLayoutChange || function () {};

		this.strokes = [];
		this.color = COLORS[0];
		this.lineWidth = 4;
		this.tool = "pen";          // pen | eraser | stamp
		this.stamp = null;          // active stamp symbol when tool === "stamp"
		this.drawing = false;
		this.lastPt = null;
		this.pendingSegs = [];
		this.syncThrottle = null;
		this.ignoreSelfUntil = 0;
		this.visible = false;
		this.minimized = false;

		// Sync guard: only accept "st" (state replay) messages while this flag is set.
		// It is set when WE explicitly request a sync (requestSync) and cleared after
		// a short window. This prevents a new joiner's sync reply from being broadcast
		// back to everyone and resetting canvases that already have drawings.
		this._awaitingSync = false;
		this._awaitingSyncTimer = null;
		this._saveTimer = null;

		this._bindDom();
		this.setVisible(false);
		this._resize();
		this._loadFromSession();   // restore strokes from previous page session
	}

	DesktopDoodler.SYNC_PREFIX = SYNC_PREFIX;

	DesktopDoodler.isSyncText = function (text) {
		return !!(text && typeof text === "string" && text.indexOf(SYNC_PREFIX) === 0);
	};

	DesktopDoodler.prototype.serverTime = function () {
		return Date.now() + (this.client.serverTimeOffset || 0);
	};

	DesktopDoodler.prototype.sendSync = function (payload) {
		if (!this.client || !this.client.isConnected()) return;
		var msg = SYNC_PREFIX + payload;
		if (msg.length > 512) return;
		this.ignoreSelfUntil = Date.now() + 400;
		this.client.broadcastRoom(msg);
	};

	DesktopDoodler.prototype._bindDom = function () {
		var self = this;
		if (!this.mountEl) return;

		this.canvas = this.mountEl.querySelector(".doodler-canvas");
		this.ctx = this.canvas.getContext("2d");

		var stop = function (e) { e.preventDefault(); e.stopPropagation(); };

		this.mountEl.querySelector(".doodler-clear-btn").addEventListener("click", function (e) {
			stop(e);
			self.clear(true);
		});
		this.mountEl.querySelector(".doodler-minimize-btn").addEventListener("click", function (e) {
			stop(e);
			self.setMinimized(!self.minimized);
		});
		this.mountEl.querySelector(".doodler-toggle-btn").addEventListener("click", function (e) {
			stop(e);
			self.setVisible(false);
		});

		var palette = this.mountEl.querySelector(".doodler-palette");
		COLORS.forEach(function (c) {
			var btn = document.createElement("button");
			btn.type = "button";
			btn.className = "doodler-color-btn";
			btn.style.background = c;
			btn.title = c;
			btn.dataset.color = c;
			if (c === self.color) btn.classList.add("active");
			btn.addEventListener("click", function (e) {
				stop(e);
				self.color = c;
				palette.querySelectorAll(".doodler-color-btn").forEach(function (b) {
					b.classList.toggle("active", b.dataset.color === c);
				});
				self._setTool("pen");   // picking a colour means you want to draw
			});
			palette.appendChild(btn);
		});

		// ---- pen / eraser tool buttons ----
		var toolGroup = this.mountEl.querySelector(".doodler-tool-group");
		if (toolGroup) {
			var mkTool = function (tool, label, title) {
				var b = document.createElement("button");
				b.type = "button";
				b.className = "doodler-tool-btn";
				b.dataset.tool = tool;
				b.textContent = label;
				b.title = title;
				if (tool === self.tool) b.classList.add("active");
				b.addEventListener("click", function (e) { stop(e); self._setTool(tool); });
				toolGroup.appendChild(b);
				return b;
			};
			mkTool("pen", "✏️", "Pen");
			mkTool("eraser", "🧽", "Eraser");
		}

		// ---- prebuilt symbol stamps ----
		var stampGroup = this.mountEl.querySelector(".doodler-stamp-group");
		if (stampGroup) {
			STAMP_META.forEach(function (s) {
				var b = document.createElement("button");
				b.type = "button";
				b.className = "doodler-stamp-btn";
				b.dataset.stamp = s.name;
				b.textContent = s.emoji;
				b.title = "Stamp " + s.name + " — then click the canvas";
				b.addEventListener("click", function (e) { stop(e); self._setTool("stamp", s.name); });
				stampGroup.appendChild(b);
			});
		}

		this.mountEl.querySelectorAll(".doodler-brush-btn").forEach(function (btn) {
			btn.addEventListener("click", function (e) {
				stop(e);
				var w = parseInt(btn.dataset.width, 10) || 3;
				self.lineWidth = w;
				self.mountEl.querySelectorAll(".doodler-brush-btn").forEach(function (b) {
					b.classList.toggle("active", b === btn);
				});
			});
		});

		var onDown = function (e) {
			if (!self.visible || self.minimized) return;
			stop(e);
			var p = self._evtPos(e);
			if (self.tool === "stamp" && self.stamp) { self._placeStamp(self.stamp, p); return; }
			self._startStroke(p);
		};
		var onMove = function (e) {
			if (!self.drawing) return;
			e.preventDefault();
			self._extendStroke(self._evtPos(e));
		};
		var onUp = function () { self._endStroke(); };

		this.canvas.addEventListener("mousedown", onDown);
		this.canvas.addEventListener("touchstart", onDown, { passive: false });
		window.addEventListener("mousemove", onMove);
		window.addEventListener("touchmove", onMove, { passive: false });
		window.addEventListener("mouseup", onUp);
		window.addEventListener("touchend", onUp);
		window.addEventListener("touchcancel", onUp);

		var doResize = function () { self._resize(); };
		window.addEventListener("resize", doResize);
		if (typeof ResizeObserver !== "undefined") {
			this._ro = new ResizeObserver(function () {
				if (self.visible && !self.minimized) doResize();
			});
			this._ro.observe(this.mountEl);
		}
	};

	DesktopDoodler.prototype._evtPos = function (e) {
		var rect = this.canvas.getBoundingClientRect();
		var t = e.touches ? e.touches[0] : e;
		return {
			x: clamp((t.clientX - rect.left) / rect.width, 0, 1),
			y: clamp((t.clientY - rect.top) / rect.height, 0, 1)
		};
	};

	DesktopDoodler.prototype._resize = function () {
		// Re-entrancy guard: onLayoutChange() may call back into _resize()
		// (the host's callback does), which would recurse forever. Skip the
		// nested call — the outer one has already done the resize.
		if (!this.canvas || this._resizing) return;
		this._resizing = true;
		try {
			var rect = this.canvas.getBoundingClientRect();
			var dpr = window.devicePixelRatio || 1;
			this.canvas.width = Math.max(1, Math.floor(rect.width * dpr));
			this.canvas.height = Math.max(1, Math.floor(rect.height * dpr));
			this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
			this._redraw();
			this.onLayoutChange();
		} finally {
			this._resizing = false;
		}
	};

	DesktopDoodler.prototype.setVisible = function (on) {
		this.visible = !!on;
		if (this.mountEl) this.mountEl.classList.toggle("doodler-hidden", !this.visible);
		var self = this;
		if (this.visible) {
			requestAnimationFrame(function () {
				requestAnimationFrame(function () { self._resize(); });
			});
		}
		this.onLayoutChange();
	};

	DesktopDoodler.prototype.setMinimized = function (on) {
		this.minimized = !!on;
		if (this.mountEl) this.mountEl.classList.toggle("doodler-minimized", this.minimized);
		if (!this.minimized && this.visible) {
			var self = this;
			requestAnimationFrame(function () { self._resize(); });
		}
		this.onLayoutChange();
	};

	DesktopDoodler.prototype._encPt = function (n) {
		return Math.round(clamp(n, 0, 1) * 1000);
	};

	DesktopDoodler.prototype._decPt = function (s) {
		return clamp(parseInt(s, 10) || 0, 0, 1000) / 1000;
	};

	// Switch the active drawing tool and reflect it in the toolbar button states.
	DesktopDoodler.prototype._setTool = function (tool, stamp) {
		this.tool = tool;
		this.stamp = tool === "stamp" ? (stamp || null) : null;
		if (!this.mountEl) return;
		var self = this;
		this.mountEl.querySelectorAll(".doodler-tool-btn").forEach(function (b) {
			b.classList.toggle("active", b.dataset.tool === tool);
		});
		this.mountEl.querySelectorAll(".doodler-stamp-btn").forEach(function (b) {
			b.classList.toggle("active", tool === "stamp" && b.dataset.stamp === self.stamp);
		});
		if (this.canvas) this.canvas.classList.toggle("doodler-erasing", tool === "eraser");
	};

	// The colour + width a freehand segment should use given the current tool.
	DesktopDoodler.prototype._effColor = function () { return this.tool === "eraser" ? ERASE : this.color; };
	DesktopDoodler.prototype._effWidth = function () {
		return this.tool === "eraser" ? Math.round(this.lineWidth * ERASER_SCALE) : this.lineWidth;
	};

	// Stamp a prebuilt symbol centred at p. The symbol's unit polylines become
	// ordinary line segments (scaled to keep their aspect square), so they draw,
	// store and sync exactly like a hand-drawn stroke.
	DesktopDoodler.prototype._placeStamp = function (name, p) {
		var polys = SYMBOLS[name];
		if (!polys || !this.canvas) return;
		var rect = this.canvas.getBoundingClientRect();
		var S = Math.min(rect.width, rect.height) * 0.16;   // visual half-size in px
		var sx = S / Math.max(1, rect.width), sy = S / Math.max(1, rect.height);
		var color = this.color, w = this.lineWidth;
		var made = [];
		for (var pi = 0; pi < polys.length; pi++) {
			var poly = polys[pi];
			for (var i = 1; i < poly.length; i++) {
				made.push({
					x1: clamp(p.x + poly[i - 1][0] * sx, 0, 1), y1: clamp(p.y + poly[i - 1][1] * sy, 0, 1),
					x2: clamp(p.x + poly[i][0] * sx, 0, 1), y2: clamp(p.y + poly[i][1] * sy, 0, 1),
					color: color, w: w
				});
			}
		}
		for (var k = 0; k < made.length; k++) { this.strokes.push(made[k]); this._drawSeg(made[k]); this.pendingSegs.push(made[k]); }
		this._flushSync();
		if (typeof window !== "undefined" && window.funSound) window.funSound("pop", { throttle: 60 });
	};

	DesktopDoodler.prototype._startStroke = function (p) {
		this.drawing = true;
		this.lastPt = p;
		if (typeof window !== "undefined" && window.funSound) window.funSound("scribble", { throttle: 70 });
	};

	DesktopDoodler.prototype._extendScribbleSound = function () {
		if (typeof window !== "undefined" && window.funSound) window.funSound("scribble", { throttle: 110, gain: 0.7 });
	};

	DesktopDoodler.prototype._extendStroke = function (p) {
		if (!this.lastPt) return;
		this._extendScribbleSound();
		var seg = {
			x1: this.lastPt.x, y1: this.lastPt.y,
			x2: p.x, y2: p.y,
			color: this._effColor(),
			w: this._effWidth()
		};
		this.strokes.push(seg);
		this._drawSeg(seg);
		this.lastPt = p;
		this.pendingSegs.push(seg);
		this._queueSync();
	};

	DesktopDoodler.prototype._endStroke = function () {
		this.drawing = false;
		this.lastPt = null;
		this._flushSync();
		this._scheduleSave();
	};

	DesktopDoodler.prototype._queueSync = function () {
		var self = this;
		if (this.syncThrottle) return;
		this.syncThrottle = setTimeout(function () {
			self.syncThrottle = null;
			self._flushSync();
		}, 60);
	};

	DesktopDoodler.prototype._flushSync = function () {
		if (!this.pendingSegs.length) return;
		var segs = this.pendingSegs.splice(0);
		var byColor = {};
		segs.forEach(function (s) {
			var code = COLOR_CODES[s.color] || "w";
			if (!byColor[code]) byColor[code] = [];
			byColor[code].push(
				this._encPt(s.x1) + "," + this._encPt(s.y1) + "," +
				this._encPt(s.x2) + "," + this._encPt(s.y2) + "," + Math.round(s.w || this.lineWidth)
			);
		}, this);

		for (var code in byColor) {
			if (!byColor.hasOwnProperty(code)) continue;
			var chunks = byColor[code];
			var batch = [];
			var payload = "d|" + code;
			for (var i = 0; i < chunks.length; i++) {
				var next = batch.length ? batch.concat([chunks[i]]) : [chunks[i]];
				var test = payload + "|" + next.join("|");
				if (test.length > 500 && batch.length) {
					this.sendSync(payload + "|" + batch.join("|"));
					batch = [chunks[i]];
				} else {
					batch.push(chunks[i]);
				}
			}
			if (batch.length) this.sendSync(payload + "|" + batch.join("|"));
		}
	};

	DesktopDoodler.prototype.clear = function (broadcast) {
		this.strokes = [];
		this.pendingSegs = [];
		this._redraw();
		this._saveToSession();
		if (broadcast) this.sendSync("x");
	};

	DesktopDoodler.prototype._drawSeg = function (seg) {
		if (!this.ctx || !this.canvas) return;
		var w = this.canvas.getBoundingClientRect().width;
		var h = this.canvas.getBoundingClientRect().height;
		var erase = seg.color === ERASE;
		// Eraser segments cut pixels back to transparent via destination-out;
		// because strokes are replayed in order, an eraser only removes what was
		// drawn before it — later strokes draw on top as normal.
		this.ctx.globalCompositeOperation = erase ? "destination-out" : "source-over";
		this.ctx.strokeStyle = erase ? "rgba(0,0,0,1)" : seg.color;
		this.ctx.lineWidth = seg.w || this.lineWidth;
		this.ctx.lineCap = "round";
		this.ctx.lineJoin = "round";
		this.ctx.beginPath();
		this.ctx.moveTo(seg.x1 * w, seg.y1 * h);
		this.ctx.lineTo(seg.x2 * w, seg.y2 * h);
		this.ctx.stroke();
		if (erase) this.ctx.globalCompositeOperation = "source-over";
	};

	DesktopDoodler.prototype._redraw = function () {
		if (!this.ctx || !this.canvas) return;
		var w = this.canvas.getBoundingClientRect().width;
		var h = this.canvas.getBoundingClientRect().height;
		this.ctx.clearRect(0, 0, w, h);
		for (var i = 0; i < this.strokes.length; i++) {
			this._drawSeg(this.strokes[i]);
		}
	};

	DesktopDoodler.prototype._parseSegs = function (parts, colorIdx, offset) {
		var segs = [];
		var color = CODE_COLORS[parts[colorIdx]] || "#ffffff";
		for (var i = offset; i < parts.length; i++) {
			var nums = parts[i].split(",");
			if (nums.length < 4) continue;
			// width is the optional 5th field; older messages omit it
			var w = nums.length > 4 ? clamp(parseInt(nums[4], 10) || this.lineWidth, 1, 200) : this.lineWidth;
			segs.push({
				x1: this._decPt(nums[0]), y1: this._decPt(nums[1]),
				x2: this._decPt(nums[2]), y2: this._decPt(nums[3]),
				color: color,
				w: w
			});
		}
		return segs;
	};

	DesktopDoodler.prototype._replyState = function () {
		if (!this.strokes.length) {
			this.sendSync("st|0");
			return;
		}
		// Emit segments in CHRONOLOGICAL order, grouped into runs of the same
		// colour. Order matters now that eraser segments exist — a late joiner must
		// replay them in the same sequence or erased areas would reappear. The very
		// first payload uses "st|r|" (reset+add); the rest "st|" (append).
		var payloads = [], first = true, batch = [], batchCode = null;
		var flush = function () {
			if (!batch.length) return;
			payloads.push((first ? "st|r|" : "st|") + batchCode + "|" + batch.join("|"));
			first = false; batch = [];
		};
		for (var i = 0; i < this.strokes.length; i++) {
			var s = this.strokes[i];
			var code = COLOR_CODES[s.color] || "w";
			var chunk = this._encPt(s.x1) + "," + this._encPt(s.y1) + "," +
				this._encPt(s.x2) + "," + this._encPt(s.y2) + "," + Math.round(s.w || this.lineWidth);
			if (batchCode !== null && code !== batchCode) flush();      // colour changed → new run
			batchCode = code;
			var prefix = (first ? "st|r|" : "st|") + code;
			if (batch.length && (prefix + "|" + batch.join("|") + "|" + chunk).length > 480) flush();
			batchCode = code;
			batch.push(chunk);
		}
		flush();
		for (var j = 0; j < payloads.length; j++) this.sendSync(payloads[j]);
	};

	DesktopDoodler.prototype.requestSync = function () {
		var self = this;
		this._awaitingSync = true;
		clearTimeout(this._awaitingSyncTimer);
		// After 6 s, stop accepting state-replay messages (all packets should have arrived).
		this._awaitingSyncTimer = setTimeout(function () {
			self._awaitingSync = false;
		}, 6000);
		this.sendSync("q");
	};

	// ---- sessionStorage persistence ------------------------------------------
	DesktopDoodler.prototype._saveToSession = function () {
		try { sessionStorage.doodlerStrokes = JSON.stringify(this.strokes); } catch (e) {}
	};

	DesktopDoodler.prototype._scheduleSave = function () {
		var self = this;
		clearTimeout(this._saveTimer);
		this._saveTimer = setTimeout(function () { self._saveToSession(); }, 600);
	};

	DesktopDoodler.prototype._loadFromSession = function () {
		try {
			var raw = sessionStorage.doodlerStrokes;
			if (!raw) return;
			var segs = JSON.parse(raw);
			if (Array.isArray(segs) && segs.length) {
				this.strokes = segs;
				// Don't redraw yet — canvas may not be sized; _resize() will redraw.
			}
		} catch (e) {}
	};

	DesktopDoodler.prototype.clearSession = function () {
		try { sessionStorage.removeItem("doodlerStrokes"); } catch (e) {}
	};

	DesktopDoodler.prototype._handleSyncRequest = function () {
		var self = this;
		setTimeout(function () {
			if (Date.now() < doodlerSyncLockUntil) return;
			doodlerSyncLockUntil = Date.now() + 700;
			self._replyState();
		}, 60 + Math.random() * 140);
	};

	DesktopDoodler.prototype.tryHandleChat = function (msg) {
		var text = msg.a != null ? msg.a : (msg.message != null ? msg.message : "");
		if (!DesktopDoodler.isSyncText(text)) return false;

		var parts = text.slice(SYNC_PREFIX.length).split("|");
		var cmd = parts[0];
		var me = this.client.getOwnParticipant();
		if (me && msg.p && msg.p._id === me._id && Date.now() < this.ignoreSelfUntil) {
			return true;
		}

		if (cmd === "d") {
			var segs = this._parseSegs(parts, 1, 2);
			for (var i = 0; i < segs.length; i++) {
				this.strokes.push(segs[i]);
				this._drawSeg(segs[i]);
			}
			this._scheduleSave();
		} else if (cmd === "st") {
			// KEY FIX: "st" messages are state-replay responses to a sync request.
			// They are broadcast to the whole room, so existing users (who already have
			// a canvas) would incorrectly receive and apply a reset sent for a new joiner.
			// Only apply state-replay if we explicitly requested a sync (flag set for 6 s)
			// OR our canvas is currently empty (we just joined / refreshed).
			if (this.strokes.length > 0 && !this._awaitingSync) return true;

			if (parts[1] === "0") {
				this.strokes = [];
				this._redraw();
			} else if (parts[1] === "r") {
				this.strokes = this._parseSegs(parts, 2, 3);
				this._redraw();
			} else {
				var newSegs = this._parseSegs(parts, 1, 2);
				for (var j = 0; j < newSegs.length; j++) {
					this.strokes.push(newSegs[j]);
				}
				this._redraw();
			}
			this._scheduleSave();
		} else if (cmd === "x") {
			this.strokes = [];
			this._redraw();
			this._saveToSession();
		} else if (cmd === "q") {
			this._handleSyncRequest();
		}
		return true;
	};

	global.DesktopDoodler = DesktopDoodler;
})(typeof window !== "undefined" ? window : this);
