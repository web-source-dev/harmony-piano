/**
 * Share Image — paste a URL or upload from PC; everyone in the room sees it.
 * Room-synced via SI| prefix (relay first, chat fallback).
 */
(function (global) {
	"use strict";

	var SYNC_PREFIX = "SI|";
	var DEFAULT_MEDIA_PORT = 8551;
	var MAX_IMAGE_BYTES = 12 * 1024 * 1024;
	var IMAGE_EXT = /\.(png|jpe?g|gif|webp|bmp|svg)$/i;
	var mediaServerBase = null;
	var mediaServerReady = null;

	function getParam(name) {
		if (typeof window === "undefined" || !window.location) return null;
		var m = window.location.search.match(new RegExp("[?&]" + name + "=([^&]*)"));
		return m ? decodeURIComponent(m[1].replace(/\+/g, " ")) : null;
	}

	function normalizeBase(base) {
		if (!base) return null;
		base = String(base).trim().replace(/\/+$/, "");
		if (/^\d+$/.test(base)) {
			var host = (typeof window !== "undefined" && window.location && window.location.hostname) || "localhost";
			return "http://" + host + ":" + base;
		}
		if (!/^https?:\/\//i.test(base)) base = "http://" + base;
		return base.replace(/\/+$/, "");
	}

	function probeMediaServer(base) {
		base = normalizeBase(base);
		if (!base) return Promise.resolve(null);
		return fetch(base + "/api/media/health", { method: "GET", cache: "no-store" })
			.then(function (r) { return r.ok ? r.json() : null; })
			.then(function (data) {
				// Relay fakes /api/media/health with ok:true — only real media hosts qualify.
				if (!data || !data.ok) return null;
				if (data.media === true || data.service === "harmony-media") return base;
				return null;
			})
			.catch(function () { return null; });
	}

	function detectMediaServerBases() {
		var bases = [];
		var param = getParam("media");
		if (param) bases.push(normalizeBase(param));
		try {
			if (typeof localStorage !== "undefined" && localStorage.harmonyMediaServer) {
				bases.push(normalizeBase(localStorage.harmonyMediaServer));
			}
		} catch (e) {}
		if (typeof window !== "undefined" && window.location) {
			var host = window.location.hostname || "localhost";
			// Prefer dedicated media port before page origin (origin often fakes health).
			bases.push("http://" + host + ":" + DEFAULT_MEDIA_PORT);
			bases.push("http://localhost:" + DEFAULT_MEDIA_PORT);
			bases.push("http://127.0.0.1:" + DEFAULT_MEDIA_PORT);
			bases.push(window.location.origin);
		}
		var seen = {};
		var out = [];
		for (var i = 0; i < bases.length; i++) {
			if (bases[i] && !seen[bases[i]]) {
				seen[bases[i]] = true;
				out.push(bases[i]);
			}
		}
		return out;
	}

	function initMediaServer() {
		if (mediaServerReady) return mediaServerReady;
		mediaServerReady = (function () {
			var bases = detectMediaServerBases();
			var chain = Promise.resolve(null);
			bases.forEach(function (base) {
				chain = chain.then(function (found) {
					if (found) return found;
					return probeMediaServer(base);
				});
			});
			return chain.then(function (found) {
				mediaServerBase = found;
				try {
					if (found && typeof localStorage !== "undefined") {
						localStorage.harmonyMediaServer = found;
					}
				} catch (e) {}
				return found;
			});
		})();
		return mediaServerReady;
	}

	function publicMediaBase() {
		var base = mediaServerBase;
		if (!base) return null;
		if (typeof window === "undefined" || !window.location) return base;
		var host = window.location.hostname;
		if (!host) return base;
		return base
			.replace("://localhost:", "://" + host + ":")
			.replace("://127.0.0.1:", "://" + host + ":");
	}

	function resolveMediaUrl(url) {
		if (!url) return url;
		if (/^https?:\/\//i.test(url)) return url;
		if (url.indexOf("/room-media/") === 0) {
			var base = publicMediaBase() || mediaServerBase;
			return base ? base + url : url;
		}
		return url;
	}

	function normalizeHttpUrl(raw) {
		var url = (raw || "").trim();
		if (!url) return "";
		if (/^https?:\/\//i.test(url)) return url;
		if (/^\/\//.test(url)) return "https:" + url;
		if (/^[a-z0-9.-]+\.[a-z]{2,}(\/|$)/i.test(url)) return "https://" + url;
		return url;
	}

	function encodePart(s) {
		return encodeURIComponent(s == null ? "" : String(s));
	}

	function decodePart(s) {
		try {
			return decodeURIComponent(s || "");
		} catch (e) {
			return s || "";
		}
	}

	function clampName(name) {
		name = String(name || "").replace(/\s+/g, " ").trim();
		if (name.length > 80) name = name.slice(0, 77) + "…";
		return name;
	}

	function isImageFile(file) {
		if (!file) return false;
		if (file.type && file.type.indexOf("image/") === 0) return true;
		return IMAGE_EXT.test(file.name || "");
	}

	function ShareImage(opts) {
		opts = opts || {};
		this.client = opts.client;
		this.onStatus = opts.onStatus || function () {};
		this.ignoreSelfUntil = 0;
		this.url = "";
		this.title = "";
		this.sharerName = "";
		this.sharerId = "";
		this.panel = null;
		this.imgEl = null;
		this._drag = null;
	}

	ShareImage.SYNC_PREFIX = SYNC_PREFIX;

	ShareImage.isSyncText = function (text) {
		return !!(text && typeof text === "string" && text.indexOf(SYNC_PREFIX) === 0);
	};

	ShareImage.prototype.sendSync = function (payload) {
		if (!this.client || !this.client.isConnected()) return;
		var msg = SYNC_PREFIX + payload;
		this.ignoreSelfUntil = Date.now() + 500;
		this.client.broadcastRoom(msg);
	};

	ShareImage.prototype.tryHandleChat = function (msg) {
		var text = msg.a != null ? msg.a : (msg.message != null ? msg.message : "");
		if (!ShareImage.isSyncText(text)) return false;
		var me = this.client && this.client.getOwnParticipant && this.client.getOwnParticipant();
		if (me && msg.p && msg.p._id === me._id && Date.now() < this.ignoreSelfUntil) return true;

		var parts = text.slice(SYNC_PREFIX.length).split("|");
		var cmd = parts[0];
		if (cmd === "s") {
			var url = resolveMediaUrl(decodePart(parts[1]));
			var title = decodePart(parts[2] || "");
			var name = (msg.p && msg.p.name) || "Someone";
			var id = (msg.p && (msg.p._id || msg.p.id)) || "";
			this.show(url, title, name, id);
		} else if (cmd === "x") {
			this.hide();
		}
		return true;
	};

	ShareImage.prototype._ensurePanel = function () {
		if (this.panel) return this.panel;
		var self = this;
		var panel = document.createElement("div");
		panel.id = "share-image-panel";
		panel.className = "share-image-panel";
		panel.setAttribute("hidden", "");
		panel.setAttribute("role", "dialog");
		panel.setAttribute("aria-label", "Shared image");
		panel.innerHTML =
			'<div class="si-head">' +
				'<div class="si-head-left">' +
					'<span class="si-badge">Image</span>' +
					'<span class="si-title">Shared image</span>' +
					'<span class="si-by"></span>' +
				'</div>' +
				'<div class="si-head-right">' +
					'<button type="button" class="si-btn si-btn-open" title="Open in new tab">↗</button>' +
					'<button type="button" class="si-btn si-btn-clear" title="Clear for everyone" hidden>Clear</button>' +
					'<button type="button" class="si-btn si-btn-close" title="Dismiss">✕</button>' +
				'</div>' +
			'</div>' +
			'<div class="si-stage">' +
				'<img class="si-img" alt="Shared image" draggable="false" referrerpolicy="no-referrer"/>' +
				'<div class="si-loading">Loading…</div>' +
				'<div class="si-error" hidden>Could not load image</div>' +
			'</div>';
		document.body.appendChild(panel);
		this.panel = panel;
		this.imgEl = panel.querySelector(".si-img");

		panel.querySelector(".si-btn-close").addEventListener("click", function (e) {
			e.preventDefault();
			self.hide(false);
		});
		panel.querySelector(".si-btn-clear").addEventListener("click", function (e) {
			e.preventDefault();
			self.clearRoom();
		});
		panel.querySelector(".si-btn-open").addEventListener("click", function (e) {
			e.preventDefault();
			if (self.url) window.open(self.url, "_blank", "noopener,noreferrer");
		});
		this.imgEl.addEventListener("load", function () {
			panel.classList.remove("si-loading");
			panel.classList.remove("si-failed");
			var err = panel.querySelector(".si-error");
			if (err) err.hidden = true;
		});
		this.imgEl.addEventListener("error", function () {
			// Ignore empty/cleared src — only real failed URLs.
			if (!self.imgEl.getAttribute("src")) return;
			panel.classList.remove("si-loading");
			panel.classList.add("si-failed");
			var err = panel.querySelector(".si-error");
			if (err) err.hidden = false;
		});

		this._bindDrag(panel);
		this._placePanel(panel);
		return panel;
	};

	ShareImage.prototype._placePanel = function (panel) {
		var gap = 12;
		var bar = document.querySelector(".harmony-tools-bar");
		var top = 72;
		if (bar) {
			var r = bar.getBoundingClientRect();
			top = Math.round(r.bottom) + gap;
		}
		panel.style.top = top + "px";
		panel.style.right = gap + "px";
		panel.style.left = "auto";
		panel.style.bottom = "auto";
	};

	ShareImage.prototype._bindDrag = function (panel) {
		var self = this;
		var head = panel.querySelector(".si-head");
		head.addEventListener("pointerdown", function (e) {
			if (e.button !== 0) return;
			if (e.target.closest(".si-btn")) return;
			var rect = panel.getBoundingClientRect();
			self._drag = {
				ox: e.clientX - rect.left,
				oy: e.clientY - rect.top
			};
			panel.classList.add("si-dragging");
			head.setPointerCapture(e.pointerId);
		});
		head.addEventListener("pointermove", function (e) {
			if (!self._drag) return;
			var x = e.clientX - self._drag.ox;
			var y = e.clientY - self._drag.oy;
			var maxX = window.innerWidth - panel.offsetWidth - 4;
			var maxY = window.innerHeight - 48;
			x = Math.max(4, Math.min(maxX, x));
			y = Math.max(4, Math.min(maxY, y));
			panel.style.left = x + "px";
			panel.style.top = y + "px";
			panel.style.right = "auto";
		});
		function endDrag(e) {
			if (!self._drag) return;
			self._drag = null;
			panel.classList.remove("si-dragging");
			try { head.releasePointerCapture(e.pointerId); } catch (err) {}
		}
		head.addEventListener("pointerup", endDrag);
		head.addEventListener("pointercancel", endDrag);
	};

	ShareImage.prototype._isMe = function (id) {
		if (!id || !this.client) return false;
		if (this.client.participantId && this.client.participantId === id) return true;
		var me = this.client.getOwnParticipant && this.client.getOwnParticipant();
		return !!(me && (me._id === id || me.id === id));
	};

	ShareImage.prototype.show = function (url, title, sharerName, sharerId) {
		url = resolveMediaUrl((url || "").trim());
		if (!url) return;
		var panel = this._ensurePanel();
		this.url = url;
		this.title = clampName(title || "");
		this.sharerName = sharerName || "Someone";
		this.sharerId = sharerId || "";

		panel.querySelector(".si-title").textContent = this.title || "Shared image";
		panel.querySelector(".si-by").textContent = this.sharerName ? ("by " + this.sharerName) : "";
		var clearBtn = panel.querySelector(".si-btn-clear");
		clearBtn.hidden = !this._isMe(this.sharerId);

		panel.classList.add("si-loading");
		panel.classList.remove("si-failed");
		var err = panel.querySelector(".si-error");
		if (err) err.hidden = true;
		// Set src directly — clearing first fires a false error in some browsers.
		this.imgEl.src = url;
		if (this.imgEl.complete && this.imgEl.naturalWidth > 0) {
			panel.classList.remove("si-loading");
			panel.classList.remove("si-failed");
			if (err) err.hidden = true;
		}
		panel.removeAttribute("hidden");
		document.body.classList.add("share-image-open");
		var btn = document.getElementById("share-image-btn");
		if (btn) btn.classList.add("share-image-active");
	};

	ShareImage.prototype.hide = function () {
		this.url = "";
		this.title = "";
		this.sharerName = "";
		this.sharerId = "";
		if (this.panel) {
			this.panel.setAttribute("hidden", "");
			if (this.imgEl) {
				this.imgEl.removeAttribute("src");
				this.imgEl.src = "";
			}
			var err = this.panel.querySelector(".si-error");
			if (err) err.hidden = true;
			this.panel.classList.remove("si-loading", "si-failed");
		}
		document.body.classList.remove("share-image-open");
		var btn = document.getElementById("share-image-btn");
		if (btn) btn.classList.remove("share-image-active");
	};

	ShareImage.prototype.clearRoom = function () {
		this.hide();
		this.sendSync("x");
		this.onStatus("Cleared shared image for the room");
	};

	ShareImage.prototype.share = function (url, title) {
		url = normalizeHttpUrl(url);
		url = resolveMediaUrl(url);
		if (!url || !/^https?:\/\//i.test(url)) {
			throw new Error("Enter a valid image URL (https://…)");
		}
		var me = this.client && this.client.getOwnParticipant && this.client.getOwnParticipant();
		var name = (me && me.name) || "You";
		var id = (me && (me._id || me.id)) || (this.client && this.client.participantId) || "";
		title = clampName(title || url.split("/").pop().split("?")[0] || "Image");
		this.show(url, title, name, id);
		this.sendSync("s|" + encodePart(url) + "|" + encodePart(title));
		this.onStatus("Shared with the room");
		return { url: url, title: title };
	};

	ShareImage.prototype.uploadFile = function (file) {
		if (!file) return Promise.reject(new Error("No file selected"));
		if (!isImageFile(file)) return Promise.reject(new Error("Please choose an image file (PNG, JPG, GIF, WebP…)"));
		if (file.size > MAX_IMAGE_BYTES) {
			return Promise.reject(new Error("Image too large (max 12 MB)"));
		}
		var title = clampName((file.name || "image").replace(/\.[^.]+$/, ""));

		return initMediaServer().then(function (base) {
			if (!base) {
				throw new Error(
					"Media server not running. Run: python media-server.py 8551\n" +
					"Or paste an image URL instead."
				);
			}
			var fd = new FormData();
			fd.append("file", file, file.name);
			return fetch(base + "/api/media", { method: "POST", body: fd, cache: "no-store" })
				.then(function (r) {
					return r.json().then(function (data) {
						return { status: r.status, data: data };
					}).catch(function () {
						return { status: r.status, data: { ok: false, error: "Upload failed (" + r.status + ")" } };
					});
				})
				.then(function (res) {
					if (res.status === 413) {
						throw new Error("Image too large for the server (413).");
					}
					var data = res.data;
					if (!data.ok) throw new Error(data.error || "Upload failed (" + res.status + ")");
					// Prefer relative /room-media/ path resolved against the media host
					// so LAN peers get hostname instead of localhost from absUrl.
					var playUrl = data.url ? resolveMediaUrl(data.url) : (data.absUrl || "");
					if (!playUrl && data.absUrl) playUrl = data.absUrl;
					return { url: playUrl, title: title };
				});
		});
	};

	ShareImage.prototype.shareFile = function (file) {
		var self = this;
		this.onStatus("Uploading " + (file.name || "image") + "…");
		return this.uploadFile(file).then(function (info) {
			self.share(info.url, info.title);
			return info;
		});
	};

	global.ShareImage = ShareImage;
})(typeof window !== "undefined" ? window : this);
