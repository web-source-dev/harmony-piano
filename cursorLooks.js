/**
 * CursorLooks — shared cursor + mouse-follower styles for everyone in the room.
 *
 * Synced over Harmony's room relay (same transport as NameColor), so each user's
 * chosen look is visible to everyone else on this domain.
 *
 * Protocol (chat/relay text, "CL|" prefixed):
 *   CL|s|cursorId|followerId  -> announce / update look
 *   CL|?                      -> newcomer asks everyone to re-announce
 */
(function (global) {
	"use strict";

	var SYNC_PREFIX = "CL|";
	var STORE_KEY = "harmonyCursorLooks";

	var CURSORS = [
		{ id: "default", label: "Classic", emoji: "" },
		{ id: "heart", label: "Heart", emoji: "❤️" },
		{ id: "sparkleheart", label: "Sparkle", emoji: "💖" },
		{ id: "growing", label: "Growing", emoji: "💗" },
		{ id: "twohearts", label: "Two hearts", emoji: "💕" },
		{ id: "revolving", label: "Revolving", emoji: "💞" },
		{ id: "cupid", label: "Cupid", emoji: "💘" },
		{ id: "gift", label: "Gift heart", emoji: "💝" },
		{ id: "kiss", label: "Kiss", emoji: "💋" },
		{ id: "rose", label: "Rose", emoji: "🌹" },
		{ id: "ring", label: "Ring", emoji: "💍" },
		{ id: "couple", label: "Couple", emoji: "💑" },
		{ id: "couplekiss", label: "Couple kiss", emoji: "💏" },
		{ id: "holding", label: "Holding hands", emoji: "👫" },
		{ id: "loveface", label: "In love", emoji: "😍" },
		{ id: "smilinghearts", label: "Heart eyes", emoji: "🥰" },
		{ id: "blush", label: "Blush", emoji: "😊" },
		{ id: "loveyou", label: "Love you", emoji: "🤟" },
		{ id: "bouquet", label: "Bouquet", emoji: "💐" },
		{ id: "cherry", label: "Cherry", emoji: "🍒" }
	];

	var FOLLOWERS = [
		{ id: "default", label: "Auto", emoji: "✨", trail: null },
		{ id: "hearts", label: "Hearts", emoji: "💖", trail: ["💖", "💗", "💕", "❤️", "💞"] },
		{ id: "softhearts", label: "Soft hearts", emoji: "🤍", trail: ["🤍", "🩷", "❣️", "💕"] },
		{ id: "roses", label: "Roses", emoji: "🌹", trail: ["🌹", "🥀", "🌺", "💐"] },
		{ id: "kisses", label: "Kisses", emoji: "💋", trail: ["💋", "😘", "😻", "💗"] },
		{ id: "cupid", label: "Cupid", emoji: "💘", trail: ["💘", "🏹", "✨", "💖"] },
		{ id: "sparkles", label: "Sparkles", emoji: "✨", trail: ["✨", "💫", "⭐", "🌟"] },
		{ id: "couple", label: "Couple", emoji: "💑", trail: ["💑", "💏", "💕", "💞"] },
		{ id: "rings", label: "Rings", emoji: "💍", trail: ["💍", "💎", "✨", "💖"] },
		{ id: "loveburst", label: "Love burst", emoji: "😍", trail: ["😍", "🥰", "💖", "💘", "💞"] },
		{ id: "petals", label: "Petals", emoji: "🌸", trail: ["🌸", "🌼", "💮", "🏵️"] },
		{ id: "none", label: "Off", emoji: "🚫", trail: [] }
	];

	var CURSOR_BY_ID = {};
	var FOLLOWER_BY_ID = {};
	for (var i = 0; i < CURSORS.length; i++) CURSOR_BY_ID[CURSORS[i].id] = CURSORS[i];
	for (var j = 0; j < FOLLOWERS.length; j++) FOLLOWER_BY_ID[FOLLOWERS[j].id] = FOLLOWERS[j];

	function isCursorId(id) { return !!(id && CURSOR_BY_ID[id]); }
	function isFollowerId(id) { return !!(id && FOLLOWER_BY_ID[id]); }

	function CursorLooks(opts) {
		opts = opts || {};
		this.client = opts.client;
		this.onChange = opts.onChange || function () {};
		this.looks = {}; // _id -> { cursor, follower }
		this.myCursor = "default";
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

	CursorLooks.isSyncText = function (text) {
		return !!(text && typeof text === "string" && text.indexOf(SYNC_PREFIX) === 0);
	};

	CursorLooks.prototype._load = function () {
		try {
			var raw = global.localStorage && localStorage.getItem(STORE_KEY);
			if (!raw) return;
			var data = JSON.parse(raw);
			if (data && isCursorId(data.cursor)) this.myCursor = data.cursor;
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
		if (!part) return { cursor: "default", follower: "default" };
		if (part._id && this.looks[part._id]) return this.looks[part._id];
		if (this._isMe(part)) {
			return { cursor: this.myCursor, follower: this.myFollower };
		}
		return { cursor: "default", follower: "default" };
	};

	CursorLooks.prototype.cursorFor = function (part) {
		return this.lookFor(part).cursor;
	};

	CursorLooks.prototype.cursorEmojiFor = function (part) {
		var id = this.cursorFor(part);
		var def = CURSOR_BY_ID[id];
		return def && def.emoji ? def.emoji : "";
	};

	CursorLooks.prototype.followerFor = function (part) {
		return this.lookFor(part).follower;
	};

	CursorLooks.prototype.nextTrailEmoji = function (part, fallbackEmoji) {
		var fid = this.followerFor(part);
		var def = FOLLOWER_BY_ID[fid];
		if (!def || def.trail === null) return fallbackEmoji;
		if (!def.trail.length) return "";
		var key = String((part && (part._id || part.id)) || "x");
		var idx = this._trailIdx[key] || 0;
		var emoji = def.trail[idx % def.trail.length];
		this._trailIdx[key] = idx + 1;
		return emoji;
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
			if (!fromId || !isCursorId(cursor) || !isFollowerId(follower)) return true;
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
