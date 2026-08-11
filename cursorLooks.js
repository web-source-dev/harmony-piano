/**
 * CursorLooks — shared cursor + mouse-follower styles for everyone in the room.
 *
 * Supports classic emoji looks and animated multi-layer cursors/trails.
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

	// anim: CSS modifier class (ca-<anim>). layers: extra decorative nodes.
	var CURSORS = [
		{ id: "default", label: "Classic", emoji: "", anim: "" },

		// Animated (shown first)
		{ id: "pulseheart", label: "Pulse heart", emoji: "❤️", anim: "pulseheart", layers: ["ring", "ring2"] },
		{ id: "glowheart", label: "Glow heart", emoji: "💖", anim: "glowheart", layers: ["ring", "ring2", "spark1", "spark2"] },
		{ id: "beatwave", label: "Heartbeat", emoji: "💗", anim: "beatwave", layers: ["ring", "ring2", "ring3"] },
		{ id: "twinorbit", label: "Orbit hearts", emoji: "💕", anim: "twinorbit", layers: ["orb1", "orb2"] },
		{ id: "spinring", label: "Spin ring", emoji: "💍", anim: "spinring", layers: ["halo"] },
		{ id: "kisspop", label: "Kiss pop", emoji: "💋", anim: "kisspop", layers: ["burst1", "burst2"] },
		{ id: "rosewirl", label: "Rose swirl", emoji: "🌹", anim: "rosewirl", layers: ["petal1", "petal2"] },
		{ id: "couplebounce", label: "Couple bounce", emoji: "💑", anim: "couplebounce", layers: ["spark1"] },
		{ id: "sparklespin", label: "Sparkle spin", emoji: "✨", anim: "sparklespin", layers: ["spark1", "spark2", "spark3"] },
		{ id: "arrowshot", label: "Cupid arrow", emoji: "💘", anim: "arrowshot", layers: ["trail"] },
		{ id: "rainbowbeat", label: "Rainbow beat", emoji: "❤️", anim: "rainbowbeat", layers: ["ring"] },
		{ id: "lovefire", label: "Love fire", emoji: "🔥", anim: "lovefire", layers: ["flame1", "flame2"] },
		{ id: "cssheart", label: "Neon heart", emoji: "", anim: "cssheart", layers: ["ring", "heart"] },
		{ id: "jellyheart", label: "Jelly heart", emoji: "💗", anim: "jellyheart", layers: ["ring"] },
		{ id: "couplekiss", label: "Couple kiss", emoji: "💏", anim: "couplekiss", layers: ["spark1", "spark2"] },

		// Classic emoji (light bob)
		{ id: "heart", label: "Heart", emoji: "❤️", anim: "bob" },
		{ id: "sparkleheart", label: "Sparkle", emoji: "💖", anim: "bob" },
		{ id: "growing", label: "Growing", emoji: "💗", anim: "bob" },
		{ id: "twohearts", label: "Two hearts", emoji: "💕", anim: "bob" },
		{ id: "revolving", label: "Revolving", emoji: "💞", anim: "bob" },
		{ id: "cupid", label: "Cupid", emoji: "💘", anim: "bob" },
		{ id: "gift", label: "Gift heart", emoji: "💝", anim: "bob" },
		{ id: "kiss", label: "Kiss", emoji: "💋", anim: "bob" },
		{ id: "rose", label: "Rose", emoji: "🌹", anim: "bob" },
		{ id: "ring", label: "Ring", emoji: "💍", anim: "bob" },
		{ id: "couple", label: "Couple", emoji: "💑", anim: "bob" },
		{ id: "holding", label: "Holding hands", emoji: "👫", anim: "bob" },
		{ id: "loveface", label: "In love", emoji: "😍", anim: "bob" },
		{ id: "smilinghearts", label: "Heart eyes", emoji: "🥰", anim: "bob" },
		{ id: "blush", label: "Blush", emoji: "😊", anim: "bob" },
		{ id: "loveyou", label: "Love you", emoji: "🤟", anim: "bob" },
		{ id: "bouquet", label: "Bouquet", emoji: "💐", anim: "bob" },
		{ id: "cherry", label: "Cherry", emoji: "🍒", anim: "bob" }
	];

	var FOLLOWERS = [
		{ id: "default", label: "Auto", emoji: "✨", trail: null, trailAnim: "" },

		// Animated trails
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

		// Classic
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

	var LAYER_CLASS = {
		ring: "ca-ring",
		ring2: "ca-ring ca-ring-2",
		ring3: "ca-ring ca-ring-3",
		spark1: "ca-spark ca-spark-1",
		spark2: "ca-spark ca-spark-2",
		spark3: "ca-spark ca-spark-3",
		orb1: "ca-orb ca-orb-1",
		orb2: "ca-orb ca-orb-2",
		halo: "ca-halo",
		burst1: "ca-burst ca-burst-1",
		burst2: "ca-burst ca-burst-2",
		petal1: "ca-petal ca-petal-1",
		petal2: "ca-petal ca-petal-2",
		trail: "ca-shot-trail",
		flame1: "ca-flame ca-flame-1",
		flame2: "ca-flame ca-flame-2",
		heart: "ca-heart-shape"
	};

	function isCursorId(id) { return !!(id && CURSOR_BY_ID[id]); }
	function isFollowerId(id) { return !!(id && FOLLOWER_BY_ID[id]); }

	function buildCursorIcon(def) {
		var wrap = document.createElement("span");
		if (!def || !def.anim && !def.emoji) {
			wrap.className = "cursor-icon";
			wrap.style.display = "none";
			return wrap;
		}
		var anim = def.anim || "bob";
		wrap.className = "cursor-icon cursor-anim ca-" + anim;
		wrap.style.display = "block";

		var layers = def.layers || [];
		for (var i = 0; i < layers.length; i++) {
			var cls = LAYER_CLASS[layers[i]];
			if (!cls) continue;
			var node = document.createElement("span");
			node.className = cls;
			node.setAttribute("aria-hidden", "true");
			wrap.appendChild(node);
		}

		if (def.emoji || anim === "cssheart") {
			var core = document.createElement("span");
			core.className = "ca-core";
			if (def.emoji) core.textContent = def.emoji;
			wrap.appendChild(core);
		}
		return wrap;
	}

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
	CursorLooks.buildCursorIcon = buildCursorIcon;

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

	CursorLooks.prototype.cursorDefFor = function (part) {
		return CURSOR_BY_ID[this.cursorFor(part)] || CURSOR_BY_ID.default;
	};

	CursorLooks.prototype.cursorEmojiFor = function (part) {
		var def = this.cursorDefFor(part);
		if (!def) return "";
		if (def.anim && def.anim !== "bob") return def.emoji || "♥";
		return def.emoji || "";
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
