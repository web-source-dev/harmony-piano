/**
 * CursorLooks — shared cursor + mouse-follower styles for everyone in the room.
 *
 * Cursors: Mochi / Goma cat image cursors only.
 * Followers: emoji trails (animated).
 * Synced over Harmony's room relay (same transport as NameColor).
 *
 * Protocol (chat/relay text, "CL|" prefixed):
 *   CL|s|cursorId|followerId  -> announce / update look
 *   CL|?                      -> newcomer asks everyone to re-announce
 */
(function (global) {
	"use strict";

	var SYNC_PREFIX = "CL|";
	var STORE_KEY = "harmonyCursorLooks";

	// Only these two image cursors.
	var CURSORS = [
		{
			id: "goma-arrow",
			label: "Goma Cat",
			image: "./cursors/mochi-goma-arrow.png",
			hotspot: "2 2"
		},
		{
			id: "mochi-pointer",
			label: "Mochi Cat",
			image: "./cursors/mochi-goma-pointer.png",
			hotspot: "6 2"
		}
	];

	var FOLLOWERS = [
		{ id: "default", label: "Auto", emoji: "✨", trail: null, trailAnim: "" },

		// Animated emoji trails
		{ id: "pulsehearts", label: "Pulse hearts", emoji: "💓", trail: ["❤️", "💖", "💗", "💕"], trailAnim: "pulse", life: 1100 },
		{ id: "floathearts", label: "Float hearts", emoji: "💕", trail: ["💖", "💗", "🤍", "❤️"], trailAnim: "float", life: 1300 },
		{ id: "orbitdust", label: "Orbit dust", emoji: "💫", trail: ["✨", "💖", "⭐", "💫"], trailAnim: "orbit", life: 1200 },
		{ id: "sparklefall", label: "Sparkle fall", emoji: "✨", trail: ["✨", "⭐", "🌟", "💫"], trailAnim: "fall", life: 1200 },
		{ id: "petalspin", label: "Petal spin", emoji: "🌸", trail: ["🌸", "🌺", "💮", "🌹"], trailAnim: "spin", life: 1250 },
		{ id: "kissburst", label: "Kiss burst", emoji: "💋", trail: ["💋", "😘", "💗", "💕"], trailAnim: "burst", life: 1000 },
		{ id: "ringspin", label: "Ring spin", emoji: "💍", trail: ["💍", "💎", "✨", "💖"], trailAnim: "spin", life: 1200 },
		{ id: "coupletrail", label: "Couple trail", emoji: "💑", trail: ["💑", "💏", "💕", "💞"], trailAnim: "bounce", life: 1200 },
		{ id: "rainbowdust", label: "Rainbow dust", emoji: "🌈", trail: ["❤️", "🧡", "💛", "💚", "💙", "💜"], trailAnim: "rainbow", life: 1300 },
		{ id: "glowtrail", label: "Glow trail", emoji: "🔆", trail: ["💖", "✨", "💗", "⭐"], trailAnim: "glow", life: 1150 },
		{ id: "heartstorm", label: "Heart storm", emoji: "💘", trail: ["💘", "💖", "💕", "❤️", "💗"], trailAnim: "storm", life: 1400 },
		{ id: "roseshower", label: "Rose shower", emoji: "🌹", trail: ["🌹", "🥀", "🌺", "💐"], trailAnim: "fall", life: 1350 },

		// Classic emoji trails
		{ id: "hearts", label: "Hearts", emoji: "💖", trail: ["💖", "💗", "💕", "❤️", "💞"], trailAnim: "love", life: 900 },
		{ id: "softhearts", label: "Soft hearts", emoji: "🤍", trail: ["🤍", "🩷", "❣️", "💕"], trailAnim: "love", life: 900 },
		{ id: "roses", label: "Roses", emoji: "🌹", trail: ["🌹", "🥀", "🌺", "💐"], trailAnim: "love", life: 900 },
		{ id: "kisses", label: "Kisses", emoji: "💋", trail: ["💋", "😘", "😻", "💗"], trailAnim: "love", life: 900 },
		{ id: "cupid", label: "Cupid", emoji: "💘", trail: ["💘", "🏹", "✨", "💖"], trailAnim: "love", life: 900 },
		{ id: "sparkles", label: "Sparkles", emoji: "✨", trail: ["✨", "💫", "⭐", "🌟"], trailAnim: "", life: 900 },
		{ id: "couple", label: "Couple", emoji: "💑", trail: ["💑", "💏", "💕", "💞"], trailAnim: "love", life: 900 },
		{ id: "rings", label: "Rings", emoji: "💍", trail: ["💍", "💎", "✨", "💖"], trailAnim: "love", life: 900 },
		{ id: "loveburst", label: "Love burst", emoji: "😍", trail: ["😍", "🥰", "💖", "💘", "💞"], trailAnim: "burst", life: 1000 },
		{ id: "petals", label: "Petals", emoji: "🌸", trail: ["🌸", "🌼", "💮", "🏵️"], trailAnim: "spin", life: 1000 },
		{ id: "none", label: "Off", emoji: "🚫", trail: [], trailAnim: "", life: 0 }
	];

	var CURSOR_BY_ID = {};
	var FOLLOWER_BY_ID = {};
	for (var i = 0; i < CURSORS.length; i++) CURSOR_BY_ID[CURSORS[i].id] = CURSORS[i];
	for (var j = 0; j < FOLLOWERS.length; j++) FOLLOWER_BY_ID[FOLLOWERS[j].id] = FOLLOWERS[j];

	function isCursorId(id) { return !!(id && CURSOR_BY_ID[id]); }
	function isFollowerId(id) { return !!(id && FOLLOWER_BY_ID[id]); }

	function cssCursorValue(def) {
		if (!def || !def.image) return "";
		var hotspot = def.hotspot || "2 2";
		return "url(\"" + def.image + "\") " + hotspot + ", auto";
	}

	function buildCursorIcon(def) {
		var wrap = document.createElement("span");
		if (!def || !def.image) {
			wrap.className = "cursor-icon";
			wrap.style.display = "none";
			return wrap;
		}
		wrap.className = "cursor-icon cursor-image ca-img";
		wrap.style.display = "block";
		var img = document.createElement("img");
		img.src = def.image;
		img.alt = def.label || "cursor";
		img.draggable = false;
		img.className = "ca-cursor-img";
		wrap.appendChild(img);
		return wrap;
	}

	function CursorLooks(opts) {
		opts = opts || {};
		this.client = opts.client;
		this.onChange = opts.onChange || function () {};
		this.looks = {}; // _id -> { cursor, follower }
		this.myCursor = "goma-arrow";
		this.myFollower = "default";
		this.ignoreSelfUntil = 0;
		this._trailIdx = {};
		this._load();
	}

	CursorLooks.SYNC_PREFIX = SYNC_PREFIX;
	CursorLooks.CURSORS = CURSORS;
	CursorLooks.FOLLOWERS = FOLLOWERS;
	CursorLooks.isCursorId = isCursorId;
	CursorLooks.isFollowerId = isFollowerId;
	CursorLooks.buildCursorIcon = buildCursorIcon;
	CursorLooks.cssCursorValue = cssCursorValue;

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
		} catch (e) {}
	};

	CursorLooks.prototype._save = function () {
		try {
			if (global.localStorage) {
				localStorage.setItem(STORE_KEY, JSON.stringify({
					cursor: this.myCursor,
					follower: this.myFollower
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
		return { cursor: this.myCursor, follower: this.myFollower };
	};

	CursorLooks.prototype.lookFor = function (part) {
		if (!part) return { cursor: null, follower: "default" };
		if (part._id && this.looks[part._id]) {
			var look = this.looks[part._id];
			// Migrate old emoji cursor ids from peers to Goma arrow.
			if (look.cursor && !isCursorId(look.cursor)) {
				return { cursor: "goma-arrow", follower: look.follower || "default" };
			}
			return look;
		}
		if (this._isMe(part)) {
			return { cursor: this.myCursor, follower: this.myFollower };
		}
		// Others who haven't picked yet keep the classic MPP arrow.
		return { cursor: null, follower: "default" };
	};

	CursorLooks.prototype.cursorFor = function (part) {
		return this.lookFor(part).cursor;
	};

	CursorLooks.prototype.cursorDefFor = function (part) {
		var id = this.cursorFor(part);
		return id ? (CURSOR_BY_ID[id] || null) : null;
	};

	CursorLooks.prototype.cursorEmojiFor = function () {
		return "";
	};

	CursorLooks.prototype.followerFor = function (part) {
		return this.lookFor(part).follower;
	};

	CursorLooks.prototype.nextTrailEmoji = function (part, fallbackEmoji) {
		var p = this.nextTrailParticle(part, fallbackEmoji);
		if (!p) return fallbackEmoji;
		return p.text;
	};

	CursorLooks.prototype.nextTrailParticle = function (part, fallbackEmoji) {
		var fid = this.followerFor(part);
		var def = FOLLOWER_BY_ID[fid];
		if (!def || def.trail === null) {
			return fallbackEmoji ? { text: fallbackEmoji, anim: "", life: 900 } : null;
		}
		if (!def.trail.length) return { text: "", anim: "", life: 0 };

		var key = String((part && (part._id || part.id)) || "x");
		var idx = this._trailIdx[key] || 0;
		var emoji = def.trail[idx % def.trail.length];
		this._trailIdx[key] = idx + 1;

		var jitter = ((idx * 37) % 7) - 3;
		return {
			text: emoji,
			anim: def.trailAnim || "",
			life: def.life || 1000,
			dx: jitter,
			dy: ((idx * 19) % 5) - 2,
			scale: 0.85 + ((idx % 4) * 0.08)
		};
	};

	CursorLooks.prototype.setMyLook = function (cursorId, followerId) {
		var changed = false;
		if (isCursorId(cursorId) && cursorId !== this.myCursor) {
			this.myCursor = cursorId;
			changed = true;
		}
		if (isFollowerId(followerId) && followerId !== this.myFollower) {
			this.myFollower = followerId;
			changed = true;
		}
		if (!changed && !(isCursorId(cursorId) || isFollowerId(followerId))) return false;
		this._save();
		var me = this.client && this.client.getOwnParticipant();
		if (me && me._id) {
			this.looks[me._id] = { cursor: this.myCursor, follower: this.myFollower };
		}
		this.broadcast();
		this.onChange();
		return true;
	};

	CursorLooks.prototype.setMyCursor = function (cursorId) {
		return this.setMyLook(cursorId, this.myFollower);
	};

	CursorLooks.prototype.setMyFollower = function (followerId) {
		return this.setMyLook(this.myCursor, followerId);
	};

	CursorLooks.prototype.broadcast = function () {
		if (!this.client) return;
		var me = this.client.getOwnParticipant();
		if (!me || !me._id) return;
		this.looks[me._id] = { cursor: this.myCursor, follower: this.myFollower };
		this.ignoreSelfUntil = Date.now() + 400;
		this.client.broadcastRoom(SYNC_PREFIX + "s|" + this.myCursor + "|" + this.myFollower);
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
			if (!fromId) return true;
			// Accept unknown old cursor ids by mapping to goma-arrow.
			if (!isCursorId(cursor)) cursor = "goma-arrow";
			if (!isFollowerId(follower)) follower = "default";
			var prev = this.looks[fromId];
			if (!prev || prev.cursor !== cursor || prev.follower !== follower) {
				this.looks[fromId] = { cursor: cursor, follower: follower };
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
