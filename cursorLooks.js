/**
 * CursorLooks — shared cursor + mouse-follower styles for everyone in the room.
 *
 * Cursors: Mochi / Goma cat images (resizable).
 * Followers: love emoji trails only (hearts, kisses, couple).
 * Synced over Harmony's room relay (same transport as NameColor).
 *
 * Protocol (chat/relay text, "CL|" prefixed):
 *   CL|s|cursorId|followerId|size  -> announce / update look
 *   CL|?                           -> newcomer asks everyone to re-announce
 */
(function (global) {
	"use strict";

	var SYNC_PREFIX = "CL|";
	var STORE_KEY = "harmonyCursorLooks";
	var MIN_SIZE = 14;
	var MAX_SIZE = 36;
	var DEFAULT_SIZE = 18;

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

	function isCursorId(id) { return !!(id && CURSOR_BY_ID[id]); }
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
		var key = def.id + "@" + size;
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
			if (data && isCursorId(data.cursor)) this.myCursor = data.cursor;
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
					size: this.mySize
				}));
			}
		} catch (e) {}
	};

	CursorLooks.prototype._isMe = function (part) {
		if (!part || !part._id || !this.client) return false;
		var me = this.client.getOwnParticipant();
		return !!(me && me._id && me._id === part._id);
	};

	CursorLooks.prototype.getMyLook = function () {
		return { cursor: this.myCursor, follower: this.myFollower, size: this.mySize };
	};

	CursorLooks.prototype.lookFor = function (part) {
		if (!part) return { cursor: null, follower: "default", size: DEFAULT_SIZE };
		if (part._id && this.looks[part._id]) {
			var look = this.looks[part._id];
			var cursor = look.cursor;
			var follower = look.follower || "default";
			if (cursor && !isCursorId(cursor)) cursor = "goma-arrow";
			if (!isFollowerId(follower)) follower = "default";
			return {
				cursor: cursor,
				follower: follower,
				size: clampSize(look.size != null ? look.size : DEFAULT_SIZE)
			};
		}
		if (this._isMe(part)) {
			return { cursor: this.myCursor, follower: this.myFollower, size: this.mySize };
		}
		return { cursor: null, follower: "default", size: DEFAULT_SIZE };
	};

	CursorLooks.prototype.cursorFor = function (part) {
		return this.lookFor(part).cursor;
	};

	CursorLooks.prototype.cursorDefFor = function (part) {
		var id = this.cursorFor(part);
		return id ? (CURSOR_BY_ID[id] || null) : null;
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
		if (me && me._id) {
			this.looks[me._id] = { cursor: this.myCursor, follower: this.myFollower, size: this.mySize };
		}
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
		this.looks[me._id] = { cursor: this.myCursor, follower: this.myFollower, size: this.mySize };
		this.ignoreSelfUntil = Date.now() + 400;
		this.client.broadcastRoom(
			SYNC_PREFIX + "s|" + this.myCursor + "|" + this.myFollower + "|" + this.mySize
		);
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
			if (!fromId) return true;
			if (!isCursorId(cursor)) cursor = "goma-arrow";
			if (!isFollowerId(follower)) follower = "default";
			var prev = this.looks[fromId];
			if (!prev || prev.cursor !== cursor || prev.follower !== follower || prev.size !== size) {
				this.looks[fromId] = { cursor: cursor, follower: follower, size: size };
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
