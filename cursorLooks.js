/**
 * CursorLooks — shared cursor + mouse-follower styles for everyone in the room.
 *
 * Cursors: Mochi / Goma cat images (resizable), or your own uploaded image
 * ("custom" — shrunk to a small PNG in the browser and sent to the room).
 * Followers: love emoji trails only (hearts, kisses, couple).
 * Synced over Harmony's room relay (same transport as NameColor).
 *
 * Protocol (chat/relay text, "CL|" prefixed):
 *   CL|s|cursorId|followerId|size[|imageDataUrl|hotspot]
 *                                  -> announce / update look (image + hotspot
 *                                     only when cursorId is "custom")
 *   CL|?                           -> newcomer asks everyone to re-announce
 */
(function (global) {
	"use strict";

	var SYNC_PREFIX = "CL|";
	var STORE_KEY = "harmonyCursorLooks";
	var MIN_SIZE = 14;
	var MAX_SIZE = 36;
	var DEFAULT_SIZE = 18;

	// Uploaded cursor images are resized to a small square PNG so they travel
	// over the room relay (64 KB frame limit) and stay sharp at every size.
	var CUSTOM_ID = "custom";
	var CUSTOM_MAX_CHARS = 40000;
	var CUSTOM_PIXELS = [64, 48, 40, 32];
	var CUSTOM_FILE_MAX_BYTES = 15 * 1024 * 1024;
	var CUSTOM_DATA_RE = /^data:image\/(png|webp);base64,[A-Za-z0-9+\/]+=*$/;
	// Where the "click point" of an uploaded image sits.
	var HOTSPOTS = {
		tl: { label: "Top-left tip", ratio: [0.08, 0.08] },
		c: { label: "Center", ratio: [0.5, 0.5] }
	};

	var CURSORS = [
		{
			id: "goma-arrow",
			label: "Goma Cat",
			image: "./cursors/mochi-goma-arrow.png",
			hotspotRatio: [0.12, 0.1]
		},
		{
			id: "mochi-pointer",
			label: "Mochi Cat",
			image: "./cursors/mochi-goma-pointer.png",
			hotspotRatio: [0.75, 0.35]
		}
	];

	// Hearts, kisses, couple / love only — no rings, flowers, stars, rainbows.
	var FOLLOWERS = [
		{ id: "default", label: "Auto hearts", emoji: "💖", trail: ["💖", "💗", "💕", "❤️"], trailAnim: "love", life: 900 },
		{ id: "hearts", label: "Hearts", emoji: "💖", trail: ["💖", "💗", "💕", "❤️", "💞"], trailAnim: "love", life: 900 },
		{ id: "pulsehearts", label: "Pulse hearts", emoji: "💓", trail: ["❤️", "💖", "💗", "💕"], trailAnim: "pulse", life: 1100 },
		{ id: "floathearts", label: "Float hearts", emoji: "💕", trail: ["💖", "💗", "🤍", "❤️"], trailAnim: "float", life: 1300 },
		{ id: "softhearts", label: "Soft hearts", emoji: "🤍", trail: ["🤍", "🩷", "❣️", "💕"], trailAnim: "love", life: 900 },
		{ id: "heartstorm", label: "Heart storm", emoji: "💘", trail: ["💘", "💖", "💕", "❤️", "💗"], trailAnim: "storm", life: 1400 },
		{ id: "kisses", label: "Kisses", emoji: "💋", trail: ["💋", "😘", "😻", "💗"], trailAnim: "love", life: 900 },
		{ id: "kissburst", label: "Kiss burst", emoji: "💋", trail: ["💋", "😘", "💗", "💕"], trailAnim: "burst", life: 1000 },
		{ id: "cupid", label: "Cupid", emoji: "💘", trail: ["💘", "💖", "💕", "💗"], trailAnim: "love", life: 900 },
		{ id: "couple", label: "Couple", emoji: "💑", trail: ["💑", "💏", "💕", "💞"], trailAnim: "love", life: 900 },
		{ id: "coupletrail", label: "Couple bounce", emoji: "💏", trail: ["💑", "💏", "💕", "💞"], trailAnim: "bounce", life: 1200 },
		{ id: "loveburst", label: "Love faces", emoji: "😍", trail: ["😍", "🥰", "💖", "💘", "💞"], trailAnim: "burst", life: 1000 },
		{ id: "none", label: "Off", emoji: "🚫", trail: [], trailAnim: "", life: 0 }
	];

	var CURSOR_BY_ID = {};
	var FOLLOWER_BY_ID = {};
	for (var i = 0; i < CURSORS.length; i++) CURSOR_BY_ID[CURSORS[i].id] = CURSORS[i];
	for (var j = 0; j < FOLLOWERS.length; j++) FOLLOWER_BY_ID[FOLLOWERS[j].id] = FOLLOWERS[j];

	var _sizedCache = {};
	var _customDefCache = {};

	function isCursorId(id) { return !!(id && (id === CUSTOM_ID || CURSOR_BY_ID[id])); }
	function isCustomImage(url) {
		return typeof url === "string" && url.length <= CUSTOM_MAX_CHARS && CUSTOM_DATA_RE.test(url);
	}
	function cleanHotspot(h) { return HOTSPOTS[h] ? h : "tl"; }

	// Short, stable fingerprint of an image so the sized-cursor cache can tell uploads apart.
	function hashStr(str) {
		var h = 5381;
		for (var i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
		return (h >>> 0).toString(36) + "-" + str.length.toString(36);
	}

	function customDef(url, hotspot) {
		if (!isCustomImage(url)) return null;
		hotspot = cleanHotspot(hotspot);
		var key = hashStr(url) + hotspot;
		if (!_customDefCache[key]) {
			_customDefCache[key] = {
				id: CUSTOM_ID,
				label: "My image",
				image: url,
				hotspotRatio: HOTSPOTS[hotspot].ratio,
				cacheKey: key
			};
		}
		return _customDefCache[key];
	}

	// Read a user-picked image file and shrink it to a transparent square PNG
	// (keeps the aspect ratio). cb(err, dataUrl).
	function prepareCustomImage(file, cb) {
		if (!file) { cb(new Error("No file picked.")); return; }
		if (file.type && file.type.indexOf("image/") !== 0) { cb(new Error("That file isn't an image. Try a PNG, JPG, GIF or WebP.")); return; }
		if (file.size > CUSTOM_FILE_MAX_BYTES) { cb(new Error("That image is too big (max 15 MB).")); return; }
		var objectUrl = null;
		try { objectUrl = URL.createObjectURL(file); } catch (e) {}
		if (!objectUrl) { cb(new Error("Couldn't read that image.")); return; }
		var img = new Image();
		img.onload = function () {
			try { URL.revokeObjectURL(objectUrl); } catch (e) {}
			var w = img.naturalWidth || img.width;
			var h = img.naturalHeight || img.height;
			if (!w || !h) { cb(new Error("Couldn't read that image.")); return; }
			var canvas = document.createElement("canvas");
			var ctx = canvas.getContext("2d");
			for (var i = 0; i < CUSTOM_PIXELS.length; i++) {
				var px = CUSTOM_PIXELS[i];
				var scale = Math.min(px / w, px / h);
				var dw = Math.max(1, Math.round(w * scale));
				var dh = Math.max(1, Math.round(h * scale));
				canvas.width = px;
				canvas.height = px;
				ctx.clearRect(0, 0, px, px);
				ctx.imageSmoothingEnabled = true;
				if ("imageSmoothingQuality" in ctx) ctx.imageSmoothingQuality = "high";
				ctx.drawImage(img, Math.floor((px - dw) / 2), Math.floor((px - dh) / 2), dw, dh);
				var url;
				try { url = canvas.toDataURL("image/png"); } catch (e) { cb(new Error("Couldn't read that image.")); return; }
				if (isCustomImage(url)) { cb(null, url); return; }
				try { url = canvas.toDataURL("image/webp", 0.9); } catch (e) { url = ""; }
				if (isCustomImage(url)) { cb(null, url); return; }
			}
			cb(new Error("That image is too detailed to use as a cursor. Try a simpler one."));
		};
		img.onerror = function () {
			try { URL.revokeObjectURL(objectUrl); } catch (e) {}
			cb(new Error("Couldn't open that image. Try a PNG, JPG, GIF or WebP."));
		};
		img.src = objectUrl;
	}
	function isFollowerId(id) { return !!(id && FOLLOWER_BY_ID[id]); }

	function clampSize(n) {
		n = parseInt(n, 10);
		if (!isFinite(n)) return DEFAULT_SIZE;
		return Math.max(MIN_SIZE, Math.min(MAX_SIZE, n));
	}

	function buildCursorIcon(def, size) {
		var wrap = document.createElement("span");
		if (!def || !def.image) {
			wrap.className = "cursor-icon";
			wrap.style.display = "none";
			return wrap;
		}
		size = clampSize(size || DEFAULT_SIZE);
		wrap.className = "cursor-icon cursor-image ca-img";
		wrap.style.display = "block";
		wrap.style.width = size + "px";
		wrap.style.height = size + "px";
		var img = document.createElement("img");
		img.src = def.image;
		img.alt = def.label || "cursor";
		img.draggable = false;
		img.className = "ca-cursor-img";
		img.style.width = size + "px";
		img.style.height = size + "px";
		wrap.appendChild(img);
		return wrap;
	}

	function makeSizedCssCursor(def, size, cb) {
		if (!def || !def.image) {
			cb("");
			return;
		}
		size = clampSize(size);
		var key = (def.cacheKey || def.id) + "@" + size;
		if (_sizedCache[key]) {
			cb(_sizedCache[key]);
			return;
		}
		var img = new Image();
		img.onload = function () {
			try {
				var canvas = document.createElement("canvas");
				canvas.width = size;
				canvas.height = size;
				var ctx = canvas.getContext("2d");
				ctx.clearRect(0, 0, size, size);
				ctx.drawImage(img, 0, 0, size, size);
				var ratio = def.hotspotRatio || [0.15, 0.15];
				var hx = Math.max(0, Math.min(size - 1, Math.round(size * ratio[0])));
				var hy = Math.max(0, Math.min(size - 1, Math.round(size * ratio[1])));
				var url = canvas.toDataURL("image/png");
				var css = "url(\"" + url + "\") " + hx + " " + hy + ", auto";
				_sizedCache[key] = css;
				cb(css);
			} catch (e) {
				cb("url(\"" + def.image + "\") 2 2, auto");
			}
		};
		img.onerror = function () {
			cb("url(\"" + def.image + "\") 2 2, auto");
		};
		img.src = def.image;
	}

	function CursorLooks(opts) {
		opts = opts || {};
		this.client = opts.client;
		this.onChange = opts.onChange || function () {};
		this.looks = {}; // _id -> { cursor, follower, size }
		this.myCursor = "goma-arrow";
		this.myFollower = "default";
		this.mySize = DEFAULT_SIZE;
		this.myCustomImg = "";
		this.myCustomHotspot = "tl";
		this.ignoreSelfUntil = 0;
		this._trailIdx = {};
		this._load();
	}

	CursorLooks.SYNC_PREFIX = SYNC_PREFIX;
	CursorLooks.CURSORS = CURSORS;
	CursorLooks.FOLLOWERS = FOLLOWERS;
	CursorLooks.MIN_SIZE = MIN_SIZE;
	CursorLooks.MAX_SIZE = MAX_SIZE;
	CursorLooks.DEFAULT_SIZE = DEFAULT_SIZE;
	CursorLooks.isCursorId = isCursorId;
	CursorLooks.isFollowerId = isFollowerId;
	CursorLooks.clampSize = clampSize;
	CursorLooks.CUSTOM_ID = CUSTOM_ID;
	CursorLooks.HOTSPOTS = HOTSPOTS;
	CursorLooks.isCustomImage = isCustomImage;
	CursorLooks.prepareCustomImage = prepareCustomImage;
	CursorLooks.buildCursorIcon = buildCursorIcon;
	CursorLooks.makeSizedCssCursor = makeSizedCssCursor;

	CursorLooks.isSyncText = function (text) {
		return !!(text && typeof text === "string" && text.indexOf(SYNC_PREFIX) === 0);
	};

	CursorLooks.prototype._load = function () {
		try {
			var raw = global.localStorage && localStorage.getItem(STORE_KEY);
			if (!raw) return;
			var data = JSON.parse(raw);
			if (data && isCustomImage(data.customImg)) this.myCustomImg = data.customImg;
			if (data) this.myCustomHotspot = cleanHotspot(data.customHotspot);
			if (data && data.cursor === CUSTOM_ID && !this.myCustomImg) this.myCursor = "goma-arrow";
			else if (data && isCursorId(data.cursor)) this.myCursor = data.cursor;
			else this.myCursor = "goma-arrow";
			if (data && isFollowerId(data.follower)) this.myFollower = data.follower;
			else if (data && data.follower) this.myFollower = "default";
			if (data && data.size != null) this.mySize = clampSize(data.size);
		} catch (e) {}
	};

	CursorLooks.prototype._save = function () {
		try {
			if (global.localStorage) {
				localStorage.setItem(STORE_KEY, JSON.stringify({
					cursor: this.myCursor,
					follower: this.myFollower,
					size: this.mySize,
					customImg: this.myCustomImg,
					customHotspot: this.myCustomHotspot
				}));
			}
		} catch (e) {}
	};

	CursorLooks.prototype._isMe = function (part) {
		if (!part || !part._id || !this.client) return false;
		var me = this.client.getOwnParticipant();
		return !!(me && me._id && me._id === part._id);
	};

	CursorLooks.prototype._myLookRecord = function () {
		return {
			cursor: this.myCursor,
			follower: this.myFollower,
			size: this.mySize,
			customImg: this.myCursor === CUSTOM_ID ? this.myCustomImg : "",
			hotspot: this.myCustomHotspot
		};
	};

	CursorLooks.prototype.getMyLook = function () {
		return {
			cursor: this.myCursor,
			follower: this.myFollower,
			size: this.mySize,
			customImg: this.myCustomImg,
			hotspot: this.myCustomHotspot
		};
	};

	CursorLooks.prototype.lookFor = function (part) {
		if (!part) return { cursor: null, follower: "default", size: DEFAULT_SIZE };
		if (part._id && this.looks[part._id]) {
			var look = this.looks[part._id];
			var cursor = look.cursor;
			var follower = look.follower || "default";
			if (cursor && !isCursorId(cursor)) cursor = "goma-arrow";
			if (!isFollowerId(follower)) follower = "default";
			if (cursor === CUSTOM_ID && !isCustomImage(look.customImg)) cursor = "goma-arrow";
			return {
				cursor: cursor,
				follower: follower,
				size: clampSize(look.size != null ? look.size : DEFAULT_SIZE),
				customImg: cursor === CUSTOM_ID ? look.customImg : "",
				hotspot: cleanHotspot(look.hotspot)
			};
		}
		if (this._isMe(part)) return this._myLookRecord();
		return { cursor: null, follower: "default", size: DEFAULT_SIZE };
	};

	CursorLooks.prototype.cursorFor = function (part) {
		return this.lookFor(part).cursor;
	};

	CursorLooks.prototype.cursorDefFor = function (part) {
		var look = this.lookFor(part);
		if (!look.cursor) return null;
		if (look.cursor === CUSTOM_ID) return customDef(look.customImg, look.hotspot) || CURSOR_BY_ID["goma-arrow"];
		return CURSOR_BY_ID[look.cursor] || null;
	};

	CursorLooks.prototype.sizeFor = function (part) {
		return this.lookFor(part).size;
	};

	CursorLooks.prototype.followerFor = function (part) {
		return this.lookFor(part).follower;
	};

	CursorLooks.prototype.nextTrailParticle = function (part, fallbackEmoji) {
		var fid = this.followerFor(part);
		var def = FOLLOWER_BY_ID[fid];
		if (!def) {
			return fallbackEmoji ? { text: fallbackEmoji, anim: "love", life: 900 } : null;
		}
		if (!def.trail || !def.trail.length) return { text: "", anim: "", life: 0 };

		var key = String((part && (part._id || part.id)) || "x");
		var idx = this._trailIdx[key] || 0;
		var emoji = def.trail[idx % def.trail.length];
		this._trailIdx[key] = idx + 1;

		var jitter = ((idx * 37) % 7) - 3;
		return {
			text: emoji,
			anim: def.trailAnim || "love",
			life: def.life || 1000,
			dx: jitter,
			dy: ((idx * 19) % 5) - 2,
			scale: 0.85 + ((idx % 4) * 0.08)
		};
	};

	CursorLooks.prototype.setMyLook = function (cursorId, followerId, size) {
		var changed = false;
		if (cursorId === CUSTOM_ID && !this.myCustomImg) cursorId = null;
		if (isCursorId(cursorId) && cursorId !== this.myCursor) {
			this.myCursor = cursorId;
			changed = true;
		}
		if (isFollowerId(followerId) && followerId !== this.myFollower) {
			this.myFollower = followerId;
			changed = true;
		}
		if (size != null) {
			var s = clampSize(size);
			if (s !== this.mySize) {
				this.mySize = s;
				changed = true;
			}
		}
		if (!changed && !(isCursorId(cursorId) || isFollowerId(followerId) || size != null)) return false;
		this._save();
		var me = this.client && this.client.getOwnParticipant();
		if (me && me._id) this.looks[me._id] = this._myLookRecord();
		this.broadcast();
		this.onChange();
		return true;
	};

	// Use an uploaded (already prepared) image as my cursor.
	CursorLooks.prototype.setMyCustomImage = function (dataUrl, hotspot) {
		if (!isCustomImage(dataUrl)) return false;
		this.myCustomImg = dataUrl;
		if (hotspot != null) this.myCustomHotspot = cleanHotspot(hotspot);
		this.myCursor = CUSTOM_ID;
		return this._commitMyLook();
	};

	CursorLooks.prototype.setMyCustomHotspot = function (hotspot) {
		hotspot = cleanHotspot(hotspot);
		if (hotspot === this.myCustomHotspot) return false;
		this.myCustomHotspot = hotspot;
		return this._commitMyLook();
	};

	// Forget the uploaded image (falls back to the Goma cat if it was in use).
	CursorLooks.prototype.clearMyCustomImage = function () {
		if (!this.myCustomImg) return false;
		this.myCustomImg = "";
		if (this.myCursor === CUSTOM_ID) this.myCursor = "goma-arrow";
		return this._commitMyLook();
	};

	CursorLooks.prototype._commitMyLook = function () {
		this._save();
		var me = this.client && this.client.getOwnParticipant();
		if (me && me._id) this.looks[me._id] = this._myLookRecord();
		this.broadcast();
		this.onChange();
		return true;
	};

	CursorLooks.prototype.setMyCursor = function (cursorId) {
		return this.setMyLook(cursorId, this.myFollower, this.mySize);
	};

	CursorLooks.prototype.setMyFollower = function (followerId) {
		return this.setMyLook(this.myCursor, followerId, this.mySize);
	};

	CursorLooks.prototype.setMySize = function (size) {
		return this.setMyLook(this.myCursor, this.myFollower, size);
	};

	CursorLooks.prototype.broadcast = function () {
		if (!this.client) return;
		var me = this.client.getOwnParticipant();
		if (!me || !me._id) return;
		this.looks[me._id] = this._myLookRecord();
		this.ignoreSelfUntil = Date.now() + 400;
		var text = SYNC_PREFIX + "s|" + this.myCursor + "|" + this.myFollower + "|" + this.mySize;
		if (this.myCursor === CUSTOM_ID && this.myCustomImg) text += "|" + this.myCustomImg + "|" + this.myCustomHotspot;
		this.client.broadcastRoom(text);
	};

	CursorLooks.prototype.requestAll = function () {
		if (!this.client) return;
		this.client.broadcastRoom(SYNC_PREFIX + "?");
		var self = this;
		setTimeout(function () { self.broadcast(); }, 120);
	};

	CursorLooks.prototype.tryHandleChat = function (msg) {
		var text = msg.a != null ? msg.a : (msg.message != null ? msg.message : "");
		if (!CursorLooks.isSyncText(text)) return false;

		var fromId = msg.p && msg.p._id;
		var me = this.client && this.client.getOwnParticipant();
		var parts = text.slice(SYNC_PREFIX.length).split("|");

		if (parts[0] === "s") {
			if (me && fromId && me._id === fromId && Date.now() < this.ignoreSelfUntil) return true;
			var cursor = parts[1];
			var follower = parts[2];
			var size = clampSize(parts[3] != null ? parts[3] : DEFAULT_SIZE);
			var customImg = "";
			var hotspot = cleanHotspot(parts[5]);
			if (!fromId) return true;
			if (cursor === CUSTOM_ID) {
				customImg = isCustomImage(parts[4]) ? parts[4] : "";
				if (!customImg) cursor = "goma-arrow";
			}
			if (!isCursorId(cursor)) cursor = "goma-arrow";
			if (!isFollowerId(follower)) follower = "default";
			var prev = this.looks[fromId];
			if (!prev || prev.cursor !== cursor || prev.follower !== follower || prev.size !== size ||
				prev.customImg !== customImg || prev.hotspot !== hotspot) {
				this.looks[fromId] = { cursor: cursor, follower: follower, size: size, customImg: customImg, hotspot: hotspot };
				this.onChange();
			}
		} else if (parts[0] === "?") {
			if (me && fromId && me._id !== fromId) {
				var self = this;
				setTimeout(function () { self.broadcast(); }, 150 + Math.floor(Math.random() * 500));
			}
		}
		return true;
	};

	global.CursorLooks = CursorLooks;
})(typeof window !== "undefined" ? window : this);
