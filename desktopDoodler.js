/**
 * Desktop Doodler — tiny shared sketch pad synced across the room.
 * Room-synced via chat transport (DD| prefix).
 */
(function (global) {
	"use strict";

	var SYNC_PREFIX = "DD|";
	var COLORS = ["#ffffff", "#ff6b6b", "#ffd93d", "#6bcb77", "#4d96ff", "#c77dff", "#000000"];
	var COLOR_CODES = { "#ffffff": "w", "#ff6b6b": "r", "#ffd93d": "y", "#6bcb77": "g", "#4d96ff": "b", "#c77dff": "p", "#000000": "k" };
	var CODE_COLORS = { w: "#ffffff", r: "#ff6b6b", y: "#ffd93d", g: "#6bcb77", b: "#4d96ff", p: "#c77dff", k: "#000000" };
	var doodlerSyncLockUntil = 0;

	function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

	function DesktopDoodler(opts) {
		opts = opts || {};
		this.client = opts.client;
		this.mountEl = opts.mountEl || null;
		this.onLayoutChange = opts.onLayoutChange || function () {};

		this.strokes = [];
		this.color = COLORS[0];
		this.lineWidth = 4;
		this.drawing = false;
		this.lastPt = null;
		this.pendingSegs = [];
		this.syncThrottle = null;
		this.ignoreSelfUntil = 0;
		this.visible = false;
		this.minimized = false;

		this._bindDom();
		this.setVisible(false);
		this._resize();
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
		this.client.sendArray([{ m: "a", message: msg }]);
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
			});
			palette.appendChild(btn);
		});

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
			self._startStroke(self._evtPos(e));
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
		if (!this.canvas) return;
		var rect = this.canvas.getBoundingClientRect();
		var dpr = window.devicePixelRatio || 1;
		this.canvas.width = Math.max(1, Math.floor(rect.width * dpr));
		this.canvas.height = Math.max(1, Math.floor(rect.height * dpr));
		this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		this._redraw();
		this.onLayoutChange();
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

	DesktopDoodler.prototype._startStroke = function (p) {
		this.drawing = true;
		this.lastPt = p;
	};

	DesktopDoodler.prototype._extendStroke = function (p) {
		if (!this.lastPt) return;
		var seg = {
			x1: this.lastPt.x, y1: this.lastPt.y,
			x2: p.x, y2: p.y,
			color: this.color,
			w: this.lineWidth
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
				this._encPt(s.x2) + "," + this._encPt(s.y2)
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
		if (broadcast) this.sendSync("x");
	};

	DesktopDoodler.prototype._drawSeg = function (seg) {
		if (!this.ctx || !this.canvas) return;
		var w = this.canvas.getBoundingClientRect().width;
		var h = this.canvas.getBoundingClientRect().height;
		this.ctx.strokeStyle = seg.color;
		this.ctx.lineWidth = seg.w;
		this.ctx.lineCap = "round";
		this.ctx.lineJoin = "round";
		this.ctx.beginPath();
		this.ctx.moveTo(seg.x1 * w, seg.y1 * h);
		this.ctx.lineTo(seg.x2 * w, seg.y2 * h);
		this.ctx.stroke();
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
			segs.push({
				x1: this._decPt(nums[0]), y1: this._decPt(nums[1]),
				x2: this._decPt(nums[2]), y2: this._decPt(nums[3]),
				color: color,
				w: this.lineWidth
			});
		}
		return segs;
	};

	DesktopDoodler.prototype._serializeStrokes = function () {
		var byColor = {};
		this.strokes.forEach(function (s) {
			var code = COLOR_CODES[s.color] || "w";
			if (!byColor[code]) byColor[code] = [];
			byColor[code].push(
				this._encPt(s.x1) + "," + this._encPt(s.y1) + "," +
				this._encPt(s.x2) + "," + this._encPt(s.y2)
			);
		}, this);
		return byColor;
	};

	DesktopDoodler.prototype._replyState = function () {
		if (!this.strokes.length) {
			this.sendSync("st|0");
			return;
		}
		var byColor = this._serializeStrokes();
		var payloads = [];
		var first = true;
		for (var code in byColor) {
			if (!byColor.hasOwnProperty(code)) continue;
			var segs = byColor[code];
			var batch = [];
			for (var i = 0; i < segs.length; i++) {
				batch.push(segs[i]);
				var prefix = first ? "st|r|" + code : "st|" + code;
				var test = prefix + "|" + batch.join("|");
				if (test.length > 480) {
					batch.pop();
					if (batch.length) payloads.push(prefix + "|" + batch.join("|"));
					batch = [segs[i]];
					first = false;
					prefix = "st|" + code;
				}
			}
			if (batch.length) payloads.push((first ? "st|r|" + code : "st|" + code) + "|" + batch.join("|"));
			first = false;
		}
		for (var j = 0; j < payloads.length; j++) {
			this.sendSync(payloads[j]);
		}
	};

	DesktopDoodler.prototype.requestSync = function () {
		this.sendSync("q");
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
		} else if (cmd === "st") {
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
		} else if (cmd === "x") {
			this.strokes = [];
			this._redraw();
		} else if (cmd === "q") {
			this._handleSyncRequest();
		}
		return true;
	};

	global.DesktopDoodler = DesktopDoodler;
})(typeof window !== "undefined" ? window : this);
