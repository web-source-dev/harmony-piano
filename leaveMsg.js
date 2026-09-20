/**
 * Leave a Message — room guestbook.
 * Bottom toolbar opens a popup; anyone can post; everyone in the room sees the list.
 * Synced via LM| prefix (relay first, chat fallback).
 */
(function (global) {
	"use strict";

	var SYNC_PREFIX = "LM|";
	var STORAGE_PREFIX = "harmony_leave_msgs:";
	var MAX_MESSAGES = 40;
	var MAX_TEXT = 180;
	var MAX_NAME = 40;

	function encodePart(s) {
		return encodeURIComponent(String(s == null ? "" : s));
	}

	function decodePart(s) {
		try {
			return decodeURIComponent(String(s == null ? "" : s));
		} catch (e) {
			return String(s || "");
		}
	}

	function uid() {
		return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
	}

	function clampText(s, max) {
		s = String(s == null ? "" : s).replace(/\s+/g, " ").trim();
		if (s.length > max) s = s.slice(0, max);
		return s;
	}

	function formatTime(ts) {
		var d = new Date(ts || Date.now());
		if (isNaN(d.getTime())) return "";
		function pad(n) { return n < 10 ? "0" + n : "" + n; }
		return pad(d.getHours()) + ":" + pad(d.getMinutes());
	}

	function LeaveMsg(opts) {
		opts = opts || {};
		this.client = opts.client;
		this.openModal = opts.openModal || null;
		this.closeModal = opts.closeModal || null;
		this.messages = [];
		this.roomId = null;
		this.ignoreSelfUntil = 0;
		this.syncReplyTimer = null;
		this.pendingSync = false;

		this.$dialog = null;
		this.$list = null;
		this.$empty = null;
		this.$count = null;
		this.$input = null;
		this.$feedback = null;
		this.$submit = null;
		this.feedbackTimer = null;

		this._bindUi();
	}

	LeaveMsg.SYNC_PREFIX = SYNC_PREFIX;

	LeaveMsg.isSyncText = function (text) {
		return !!(text && typeof text === "string" && text.indexOf(SYNC_PREFIX) === 0);
	};

	LeaveMsg.prototype._bindUi = function () {
		var self = this;
		this.$dialog = $("#leave-msg");
		this.$list = this.$dialog.find(".leave-msg-list");
		this.$empty = this.$dialog.find(".leave-msg-empty");
		this.$count = this.$dialog.find(".leave-msg-count");
		this.$input = this.$dialog.find(".leave-msg-input");
		this.$feedback = this.$dialog.find(".leave-msg-feedback");
		this.$submit = this.$dialog.find(".leave-msg-submit");

		$("#leave-msg-btn").on("click", function (e) {
			e.preventDefault();
			e.stopPropagation();
			self.open();
		});

		this.$dialog.find(".leave-msg-close").on("click", function (e) {
			e.preventDefault();
			e.stopPropagation();
			if (self.closeModal) self.closeModal();
		});

		this.$dialog.find(".leave-msg-form").on("submit", function (e) {
			e.preventDefault();
			e.stopPropagation();
			self.postFromForm();
		});

		this.$input.on("keydown", function (e) {
			if (e.keyCode === 13 && !e.shiftKey) {
				e.preventDefault();
				self.postFromForm();
			}
		});
	};

	LeaveMsg.prototype.getUserName = function () {
		var c = this.client;
		if (!c || !c.getOwnParticipant) return "Guest";
		var p = c.getOwnParticipant();
		return clampText((p && p.name) || "Guest", MAX_NAME) || "Guest";
	};

	LeaveMsg.prototype.storageKey = function () {
		return STORAGE_PREFIX + (this.roomId || "lobby");
	};

	LeaveMsg.prototype.setRoom = function (roomId) {
		roomId = roomId || "lobby";
		if (this.roomId === roomId) return;
		this.roomId = roomId;
		this.messages = [];
		this.loadLocal();
		this.render();
		this.requestSync();
	};

	LeaveMsg.prototype.loadLocal = function () {
		try {
			var raw = global.localStorage && localStorage.getItem(this.storageKey());
			if (!raw) return;
			var arr = JSON.parse(raw);
			if (!Array.isArray(arr)) return;
			this.messages = [];
			for (var i = 0; i < arr.length; i++) {
				this._upsert(arr[i], false);
			}
		} catch (e) {}
	};

	LeaveMsg.prototype.saveLocal = function () {
		try {
			if (!global.localStorage) return;
			localStorage.setItem(this.storageKey(), JSON.stringify(this.messages.slice(-MAX_MESSAGES)));
		} catch (e) {}
	};

	LeaveMsg.prototype._upsert = function (entry, persist) {
		if (!entry || !entry.id || !entry.text) return false;
		for (var i = 0; i < this.messages.length; i++) {
			if (this.messages[i].id === entry.id) return false;
		}
		this.messages.push({
			id: String(entry.id).slice(0, 24),
			ts: Number(entry.ts) || Date.now(),
			name: clampText(entry.name || "Guest", MAX_NAME),
			text: clampText(entry.text, MAX_TEXT)
		});
		this.messages.sort(function (a, b) { return a.ts - b.ts; });
		if (this.messages.length > MAX_MESSAGES) {
			this.messages = this.messages.slice(this.messages.length - MAX_MESSAGES);
		}
		if (persist !== false) this.saveLocal();
		return true;
	};

	LeaveMsg.prototype.sendSync = function (payload) {
		if (!this.client || !this.client.isConnected || !this.client.isConnected()) return false;
		var msg = SYNC_PREFIX + payload;
		if (msg.length > 512) return false;
		this.ignoreSelfUntil = Date.now() + 500;
		if (typeof this.client.broadcastRoom === "function") {
			return !!this.client.broadcastRoom(msg);
		}
		return false;
	};

	LeaveMsg.prototype.requestSync = function () {
		this.pendingSync = true;
		this.sendSync("rq");
	};

	LeaveMsg.prototype._shouldAnswerSync = function () {
		if (!this.client || !this.client.getOwnParticipant) return true;
		var me = this.client.getOwnParticipant();
		if (!me) return true;
		var myId = me._id || me.id;
		if (!myId) return true;
		var ppl = this.client.ppl || {};
		var ids = [];
		for (var key in ppl) {
			if (!Object.prototype.hasOwnProperty.call(ppl, key)) continue;
			var p = ppl[key];
			var id = (p && (p._id || p.id)) || key;
			if (id) ids.push(String(id));
		}
		if (!ids.length) return true;
		ids.sort();
		return ids[0] === String(myId);
	};

	LeaveMsg.prototype._replyWithMessages = function () {
		var self = this;
		if (!this.messages.length) return;
		if (this._syncReplyCooldown && Date.now() < this._syncReplyCooldown) return;
		var primary = this._shouldAnswerSync();
		var delay = primary ? 60 : (650 + Math.floor(Math.random() * 450));
		clearTimeout(this.syncReplyTimer);
		this.syncReplyTimer = setTimeout(function () {
			if (!self.messages.length) return;
			// Backup peers skip if someone already shared the list.
			if (!primary && self._gotSyncUntil && Date.now() < self._gotSyncUntil) return;
			if (self._syncReplyCooldown && Date.now() < self._syncReplyCooldown) return;
			self._syncReplyCooldown = Date.now() + 1800;
			var i = 0;
			function sendNext() {
				if (i >= self.messages.length) return;
				var m = self.messages[i++];
				self.sendSync(
					"m|" + encodePart(m.id) + "|" + m.ts + "|" + encodePart(m.name) + "|" + encodePart(m.text)
				);
				if (i < self.messages.length) {
					self.syncReplyTimer = setTimeout(sendNext, 40);
				}
			}
			sendNext();
		}, delay);
	};

	LeaveMsg.prototype.tryHandleChat = function (msg) {
		var text = msg.a != null ? msg.a : (msg.message != null ? msg.message : "");
		if (!LeaveMsg.isSyncText(text)) return false;

		var me = this.client && this.client.getOwnParticipant && this.client.getOwnParticipant();
		if (me && msg.p && msg.p._id === me._id && Date.now() < this.ignoreSelfUntil) {
			return true;
		}

		var body = text.slice(SYNC_PREFIX.length);
		var parts = body.split("|");
		var kind = parts[0];

		if (kind === "rq") {
			this._replyWithMessages();
			return true;
		}

		if ((kind === "a" || kind === "m") && parts.length >= 5) {
			var added = this._upsert({
				id: decodePart(parts[1]),
				ts: parseInt(parts[2], 10) || Date.now(),
				name: decodePart(parts[3]),
				text: decodePart(parts[4])
			}, true);
			if (kind === "m") this._gotSyncUntil = Date.now() + 2500;
			if (added) this.render();
			return true;
		}

		return true;
	};

	LeaveMsg.prototype.postFromForm = function () {
		var text = clampText(this.$input.val(), MAX_TEXT);
		if (!text) {
			this.showFeedback("Write a short message first.", true);
			return;
		}
		var entry = {
			id: uid(),
			ts: Date.now(),
			name: this.getUserName(),
			text: text
		};
		this._upsert(entry, true);
		this.sendSync(
			"a|" + encodePart(entry.id) + "|" + entry.ts + "|" + encodePart(entry.name) + "|" + encodePart(entry.text)
		);
		this.$input.val("");
		this.render();
		this.showFeedback("Message left for the room.", false);
		this.scrollListToBottom();
	};

	LeaveMsg.prototype.showFeedback = function (message, isError) {
		if (!this.$feedback || !this.$feedback.length) return;
		this.$feedback.text(message || "");
		this.$feedback.toggleClass("is-error", !!isError);
		this.$feedback.removeAttr("hidden");
		clearTimeout(this.feedbackTimer);
		var self = this;
		this.feedbackTimer = setTimeout(function () {
			self.$feedback.attr("hidden", "hidden").text("");
		}, isError ? 4000 : 2800);
	};

	LeaveMsg.prototype.render = function () {
		if (!this.$list || !this.$list.length) return;
		var html = "";
		for (var i = 0; i < this.messages.length; i++) {
			var m = this.messages[i];
			html +=
				'<article class="leave-msg-item">' +
					'<header class="leave-msg-item-meta">' +
						'<span class="leave-msg-item-name"></span>' +
						'<span class="leave-msg-item-time"></span>' +
					"</header>" +
					'<p class="leave-msg-item-text"></p>' +
				"</article>";
		}
		this.$list.html(html);
		var items = this.$list.children();
		for (var j = 0; j < this.messages.length; j++) {
			var el = items.eq(j);
			el.find(".leave-msg-item-name").text(this.messages[j].name);
			el.find(".leave-msg-item-time").text(formatTime(this.messages[j].ts));
			el.find(".leave-msg-item-text").text(this.messages[j].text);
		}

		var n = this.messages.length;
		if (this.$empty) {
			if (n === 0) this.$empty.removeAttr("hidden");
			else this.$empty.attr("hidden", "hidden");
		}
		if (this.$count) {
			this.$count.text(n === 0 ? "No messages yet" : (n === 1 ? "1 message" : n + " messages"));
		}
	};

	LeaveMsg.prototype.scrollListToBottom = function () {
		if (!this.$list || !this.$list.length) return;
		var el = this.$list[0];
		el.scrollTop = el.scrollHeight;
	};

	LeaveMsg.prototype.open = function () {
		this.render();
		this.requestSync();
		if (this.openModal) this.openModal("#leave-msg", ".leave-msg-input");
		var self = this;
		setTimeout(function () { self.scrollListToBottom(); }, 120);
	};

	global.LeaveMsg = LeaveMsg;
})(typeof window !== "undefined" ? window : this);
