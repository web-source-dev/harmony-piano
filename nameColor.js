/**
 * NameColor — custom, self-hosted username colors.
 *
 * The public MPP server only relays the built-in `name` / `color` fields, so a
 * truly custom username color can't ride on it. This module instead syncs each
 * user's chosen color over Harmony's own room relay (the same transport the fun
 * toys use, via Client.broadcastRoom), so it works for everyone on your domain
 * and degrades to chat-sync when the relay is off.
 *
 * Protocol (chat/relay text, "NC|" prefixed):
 *   NC|s|#rrggbb   -> sender announces / updates their username color
 *   NC|?           -> a newcomer asks everyone to re-announce their color
 *
 * Colors are keyed by the persistent participant _id and remembered in
 * localStorage so a user keeps their color across reloads.
 */
(function (global) {
	"use strict";

	var SYNC_PREFIX = "NC|";
	var STORE_KEY = "harmonyNameColor";

	function isValidColor(c) {
		return typeof c === "string" && /^#[0-9a-fA-F]{6}$/.test(c);
	}

	// Pick black or white text for best contrast against a hex background.
	function contrastText(hex) {
		if (!isValidColor(hex)) return "#ffffff";
		var r = parseInt(hex.slice(1, 3), 16);
		var g = parseInt(hex.slice(3, 5), 16);
		var b = parseInt(hex.slice(5, 7), 16);
		// relative luminance (sRGB approximation)
		var lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
		return lum > 0.6 ? "#111111" : "#ffffff";
	}

	function NameColor(opts) {
		opts = opts || {};
		this.client = opts.client;
		this.onChange = opts.onChange || function () {};
		this.colors = {};            // _id -> "#rrggbb"
		this.myColor = null;
		this.ignoreSelfUntil = 0;
		this._load();
	}

	NameColor.SYNC_PREFIX = SYNC_PREFIX;
	NameColor.isValidColor = isValidColor;
	NameColor.contrastText = contrastText;

	NameColor.isSyncText = function (text) {
		return !!(text && typeof text === "string" && text.indexOf(SYNC_PREFIX) === 0);
	};

	NameColor.prototype._load = function () {
		try {
			var v = global.localStorage && localStorage.getItem(STORE_KEY);
			if (isValidColor(v)) this.myColor = v;
		} catch (e) {}
	};

	NameColor.prototype._save = function () {
		try {
			if (this.myColor && global.localStorage) localStorage.setItem(STORE_KEY, this.myColor);
		} catch (e) {}
	};

	NameColor.prototype.getMyColor = function () { return this.myColor; };

	// Is this participant the local user?
	NameColor.prototype._isMe = function (part) {
		if (!part || !part._id || !this.client) return false;
		var me = this.client.getOwnParticipant();
		return !!(me && me._id && me._id === part._id);
	};

	// Resolved color for a participant: their custom override, else (for the
	// local user) our remembered color even before the broadcast round-trip,
	// else their MPP color, else a neutral default.
	NameColor.prototype.colorFor = function (part) {
		if (!part) return "#777777";
		if (part._id && this.colors[part._id]) return this.colors[part._id];
		if (this.myColor && this._isMe(part)) return this.myColor;
		return part.color || "#777777";
	};

	// Does this participant have a custom (self-hosted) color?
	NameColor.prototype.hasCustom = function (part) {
		if (!part || !part._id) return false;
		if (this.colors[part._id]) return true;
		return !!(this.myColor && this._isMe(part));
	};

	// Local user picks a color: remember it, apply locally, tell the room.
	NameColor.prototype.setMyColor = function (color) {
		if (!isValidColor(color)) return false;
		this.myColor = color;
		this._save();
		var me = this.client && this.client.getOwnParticipant();
		if (me && me._id) this.colors[me._id] = color;
		this.broadcast();
		this.onChange();
		return true;
	};

	NameColor.prototype.broadcast = function () {
		if (!this.client || !this.myColor) return;
		var me = this.client.getOwnParticipant();
		if (!me || !me._id) return;
		this.colors[me._id] = this.myColor;
		this.ignoreSelfUntil = Date.now() + 400;
		this.client.broadcastRoom(SYNC_PREFIX + "s|" + this.myColor);
	};

	// Ask everyone already in the room to (re)announce — call on join so a
	// newcomer immediately sees existing custom colors.
	NameColor.prototype.requestAll = function () {
		if (!this.client) return;
		this.client.broadcastRoom(SYNC_PREFIX + "?");
		// And announce ourselves so people who were already here learn our color.
		var self = this;
		setTimeout(function () { self.broadcast(); }, 120);
	};

	NameColor.prototype.tryHandleChat = function (msg) {
		var text = msg.a != null ? msg.a : (msg.message != null ? msg.message : "");
		if (!NameColor.isSyncText(text)) return false;

		var fromId = msg.p && msg.p._id;
		var me = this.client && this.client.getOwnParticipant();
		var parts = text.slice(SYNC_PREFIX.length).split("|");

		if (parts[0] === "s") {
			// Ignore the echo of our own just-sent announce.
			if (me && fromId && me._id === fromId && Date.now() < this.ignoreSelfUntil) return true;
			var color = parts[1];
			if (fromId && isValidColor(color) && this.colors[fromId] !== color) {
				this.colors[fromId] = color;
				this.onChange();
			}
		} else if (parts[0] === "?") {
			// Someone joined and wants colors — reply with ours (staggered so a
			// busy room doesn't burst all at once).
			if (this.myColor && me && fromId && me._id !== fromId) {
				var self = this;
				setTimeout(function () { self.broadcast(); }, 150 + Math.floor(Math.random() * 500));
			}
		}
		return true;
	};

	if (typeof module !== "undefined" && module.exports) {
		module.exports = NameColor;
	} else {
		global.NameColor = NameColor;
	}
})(typeof window !== "undefined" ? window : this);
