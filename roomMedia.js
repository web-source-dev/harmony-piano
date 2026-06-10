/**
 * Room DJ — shared audio/video playback synced across the room via chat transport.
 */
(function (global) {
	"use strict";

	var SYNC_PREFIX = "\u2063RM|";
	var API_MEDIA = "/api/media";
	var MAX_TITLE = 120;

	var AUDIO_EXT = /\.(mp3|m4a|wav|ogg|aac|flac|opus|weba)$/i;
	var VIDEO_EXT = /\.(mp4|webm|mov|mkv|m4v|ogv)$/i;

	function formatTime(sec) {
		if (!isFinite(sec) || sec < 0) sec = 0;
		var m = Math.floor(sec / 60);
		var s = Math.floor(sec % 60);
		return m + ":" + (s < 10 ? "0" : "") + s;
	}

	function extOf(name) {
		var m = (name || "").match(/(\.[a-z0-9]+)$/i);
		return m ? m[1].toLowerCase() : "";
	}

	function kindFromName(name) {
		if (VIDEO_EXT.test(name || "")) return "video";
		return "audio";
	}

	function kindFromUrl(url) {
		var path = (url || "").split("?")[0].split("#")[0];
		if (VIDEO_EXT.test(path)) return "video";
		return "audio";
	}

	function clampTitle(title) {
		title = (title || "Untitled").replace(/\|/g, "/").trim();
		return title.slice(0, MAX_TITLE);
	}

	function encodePart(s) {
		return encodeURIComponent(s || "");
	}

	function decodePart(s) {
		try { return decodeURIComponent(s); } catch (e) { return s; }
	}

	function resolveMediaUrl(path) {
		if (!path) return "";
		if (/^https?:\/\//i.test(path) || path.indexOf("blob:") === 0) return path;
		if (path.charAt(0) === "/") return path;
		return "/" + path;
	}

	function isServerMediaUrl(url) {
		var path = (url || "").split("?")[0].split("#")[0];
		return /\/room-media\/[^/?#]+$/i.test(path);
	}

	function normalizeServerMediaUrl(url) {
		if (!isServerMediaUrl(url)) return null;
		var path = url.split("?")[0].split("#")[0];
		var idx = path.indexOf("/room-media/");
		return path.slice(idx);
	}

	function RoomMedia(options) {
		this.client = options.client;
		this.onStatus = options.onStatus || function () {};
		this.onTrackChange = options.onTrackChange || function () {};
		this.onProgress = options.onProgress || function () {};
		this.onTransport = options.onTransport || function () {};

		this.audio = document.createElement("audio");
		this.audio.preload = "auto";
		this.video = document.createElement("video");
		this.video.preload = "auto";
		this.video.playsInline = true;
		this.video.controls = false;

		this.activeEl = this.audio;
		this.kind = "audio";
		this.url = "";
		this.serverMediaUrl = null;
		this.serverDeletePending = false;
		this.title = "";
		this.djName = "";
		this.djId = null;
		this.volume = 0.85;
		this.playing = false;
		this.paused = false;
		this.ignoreRemoteUntil = 0;
		this.progressTimer = null;
		this.scheduledTimer = null;

		var self = this;
		this.audio.addEventListener("ended", function () { self._onEnded(); });
		this.video.addEventListener("ended", function () { self._onEnded(); });
		this.audio.addEventListener("loadedmetadata", function () { self._emitProgress(); });
		this.video.addEventListener("loadedmetadata", function () { self._emitProgress(); });
	}

	RoomMedia.SYNC_PREFIX = SYNC_PREFIX;
	RoomMedia.formatTime = formatTime;

	RoomMedia.prototype._markServerMedia = function (url) {
		this.serverMediaUrl = normalizeServerMediaUrl(url);
		this.serverDeletePending = false;
	};

	RoomMedia.prototype._isDj = function () {
		return !!(this.djId && this.client.participantId === this.djId);
	};

	RoomMedia.prototype.deleteServerMedia = function (url, silent) {
		var self = this;
		url = normalizeServerMediaUrl(url || this.serverMediaUrl);
		if (!url) return Promise.resolve(false);
		if (this.serverDeletePending) return Promise.resolve(false);
		this.serverDeletePending = true;
		return fetch(API_MEDIA, {
			method: "DELETE",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ url: url }),
			cache: "no-store"
		}).then(function (r) { return r.json(); })
			.then(function (data) {
				if (self.serverMediaUrl === url) self.serverMediaUrl = null;
				if (!silent && data.ok) self.onStatus("Removed uploaded file from server.");
				return !!(data && data.ok);
			})
			.catch(function () {
				self.serverDeletePending = false;
				return false;
			});
	};

	RoomMedia.prototype._maybeDeleteServerMedia = function (broadcast) {
		if (!this.serverMediaUrl || !this._isDj()) return;
		var url = this.serverMediaUrl;
		this.deleteServerMedia(url, true);
		if (broadcast) this.sendSync("d|" + encodePart(url));
	};

	RoomMedia.prototype._clearPlayback = function () {
		this.audio.removeAttribute("src");
		this.video.removeAttribute("src");
		this.audio.load();
		this.video.load();
		this.url = "";
		this.playing = false;
		this.paused = false;
		this._stopProgress();
		this._emitProgress();
	};

	RoomMedia.prototype.serverTime = function () {
		return Date.now() + (this.client.serverTimeOffset || 0);
	};

	RoomMedia.prototype.isSyncMessage = function (text) {
		return !!(text && text.indexOf(SYNC_PREFIX) === 0);
	};

	RoomMedia.prototype.ownParticipant = function () {
		return this.client.getOwnParticipant ? this.client.getOwnParticipant() : null;
	};

	RoomMedia.prototype.sendSync = function (payload) {
		if (!this.client.isConnected()) return;
		var msg = SYNC_PREFIX + payload;
		if (msg.length > 512) {
			this.onStatus("Sync message too long — use a shorter title or upload the file.");
			return;
		}
		this.client.sendArray([{ m: "a", message: msg }]);
	};

	RoomMedia.prototype.tryHandleChat = function (msg) {
		if (!msg || !this.isSyncMessage(msg.a)) return false;
		var parts = msg.a.slice(SYNC_PREFIX.length).split("|");
		var cmd = parts[0];
		var me = this.ownParticipant();
		if (me && msg.p && msg.p._id === me._id) return true;

		if (cmd === "l") {
			var url = decodePart(parts[1]);
			var title = decodePart(parts[2]);
			var kind = parts[3] === "v" ? "video" : "audio";
			this.djName = (msg.p && msg.p.name) || "DJ";
			this.djId = msg.p && msg.p.id;
			this._loadRemote(url, title, kind);
		} else if (cmd === "p") {
			var at = parseFloat(parts[1]) || 0;
			var pos = parseFloat(parts[2]) || 0;
			this.djName = (msg.p && msg.p.name) || this.djName;
			this.djId = msg.p && msg.p.id;
			this._schedulePlay(at, pos);
		} else if (cmd === "z") {
			at = parseFloat(parts[1]) || 0;
			pos = parseFloat(parts[2]) || 0;
			this._schedulePause(at, pos);
		} else if (cmd === "s") {
			at = parseFloat(parts[1]) || 0;
			pos = parseFloat(parts[2]) || 0;
			this._scheduleSeek(at, pos);
		} else if (cmd === "x") {
			this._scheduleStop();
		} else if (cmd === "v") {
			var vol = parseFloat(parts[1]);
			if (isFinite(vol)) this.setVolume(vol, false);
		} else if (cmd === "st") {
			url = decodePart(parts[1]);
			title = decodePart(parts[2]);
			kind = parts[3] === "v" ? "video" : "audio";
			var playing = parts[4] === "1";
			pos = parseFloat(parts[5]) || 0;
			at = parseFloat(parts[6]) || 0;
			this.djName = (msg.p && msg.p.name) || this.djName;
			this.djId = msg.p && msg.p.id;
			this._applyState(url, title, kind, playing, pos, at);
		} else if (cmd === "d") {
			url = decodePart(parts[1]);
			if (normalizeServerMediaUrl(this.serverMediaUrl) === normalizeServerMediaUrl(url)) {
				this.serverMediaUrl = null;
				this._clearPlayback();
				this.onStatus("Track finished — upload removed from server.");
			}
		} else if (cmd === "q") {
			if (this.url && this.djId && this.client.participantId === this.djId) {
				this._replyState();
			}
		}
		return true;
	};

	RoomMedia.prototype._clearSchedule = function () {
		if (this.scheduledTimer) {
			clearTimeout(this.scheduledTimer);
			this.scheduledTimer = null;
		}
	};

	RoomMedia.prototype._setActiveElement = function (kind) {
		this.kind = kind === "video" ? "video" : "audio";
		this.activeEl = this.kind === "video" ? this.video : this.audio;
		this.onTransport({ visible: true, kind: this.kind, videoEl: this.video });
	};

	RoomMedia.prototype._applyMediaUrl = function (url) {
		url = resolveMediaUrl(url);
		this.url = url;
		this._markServerMedia(url);
		this.audio.src = this.kind === "audio" ? url : "";
		this.video.src = this.kind === "video" ? url : "";
	};

	RoomMedia.prototype._replaceServerMedia = function (nextUrl) {
		if (!this.serverMediaUrl || !this._isDj()) return;
		var prev = this.serverMediaUrl;
		if (normalizeServerMediaUrl(prev) === normalizeServerMediaUrl(nextUrl)) return;
		this.deleteServerMedia(prev, true);
	};

	RoomMedia.prototype._loadRemote = function (url, title, kind) {
		this._clearSchedule();
		this._setActiveElement(kind);
		this.title = clampTitle(title);
		this._applyMediaUrl(url);
		this.playing = false;
		this.paused = true;
		this.onTrackChange({ title: this.title, dj: this.djName, kind: this.kind, url: this.url });
		this.onStatus("Now loaded: " + this.title + " (DJ: " + this.djName + ")");
		this._emitProgress();
	};

	RoomMedia.prototype._applyState = function (url, title, kind, playing, pos, atServer) {
		var self = this;
		this._loadRemote(url, title, kind);
		var delay = atServer - this.serverTime();
		if (delay < -2000) {
			pos = Math.max(0, pos + (-delay) / 1000);
			delay = 0;
		}
		if (delay < 0) delay = 0;
		this.scheduledTimer = setTimeout(function () {
			self.activeEl.currentTime = Math.max(0, pos);
			if (playing) self._localPlay(false);
			else self._localPause(false);
		}, delay);
	};

	RoomMedia.prototype._schedulePlay = function (atServer, pos) {
		var self = this;
		this._clearSchedule();
		var delay = atServer - this.serverTime();
		if (delay < -1500) {
			pos = Math.max(0, pos + (-delay) / 1000);
			delay = 0;
		}
		if (delay < 0) delay = 0;
		this.scheduledTimer = setTimeout(function () {
			self.activeEl.currentTime = Math.max(0, pos);
			self._localPlay(false);
		}, delay);
	};

	RoomMedia.prototype._schedulePause = function (atServer, pos) {
		var self = this;
		this._clearSchedule();
		var delay = Math.max(0, atServer - this.serverTime());
		this.scheduledTimer = setTimeout(function () {
			self.activeEl.currentTime = Math.max(0, pos);
			self._localPause(false);
		}, delay);
	};

	RoomMedia.prototype._scheduleSeek = function (atServer, pos) {
		var self = this;
		this._clearSchedule();
		var delay = Math.max(0, atServer - this.serverTime());
		this.scheduledTimer = setTimeout(function () {
			self.activeEl.currentTime = Math.max(0, pos);
			self._emitProgress();
		}, delay);
	};

	RoomMedia.prototype._scheduleStop = function () {
		this._clearSchedule();
		this._localStop(false);
	};

	RoomMedia.prototype._localPlay = function (broadcast) {
		var self = this;
		if (!this.url) return;
		this.ignoreRemoteUntil = Date.now() + 300;
		this.activeEl.volume = this.volume;
		var p = this.activeEl.play();
		if (p && p.catch) {
			p.catch(function () {
				self.onStatus("Tap Play again — browser blocked autoplay.");
			});
		}
		this.playing = true;
		this.paused = false;
		this._startProgress();
		this.onTransport({ visible: true, kind: this.kind, videoEl: this.video });
		if (broadcast) {
			this.sendSync("p|" + this.serverTime() + "|" + (this.activeEl.currentTime || 0));
		}
	};

	RoomMedia.prototype._localPause = function (broadcast) {
		this.ignoreRemoteUntil = Date.now() + 300;
		this.activeEl.pause();
		this.playing = false;
		this.paused = true;
		this._stopProgress();
		this._emitProgress();
		if (broadcast) {
			this.sendSync("z|" + this.serverTime() + "|" + (this.activeEl.currentTime || 0));
		}
	};

	RoomMedia.prototype._localStop = function (broadcast) {
		this.ignoreRemoteUntil = Date.now() + 300;
		this.activeEl.pause();
		this.activeEl.currentTime = 0;
		this.playing = false;
		this.paused = false;
		this._stopProgress();
		this._emitProgress();
		if (broadcast) {
			this.sendSync("x|" + this.serverTime());
			this._maybeDeleteServerMedia(true);
			this._clearPlayback();
		}
	};

	RoomMedia.prototype._onEnded = function () {
		this.playing = false;
		this.paused = false;
		this._stopProgress();
		this._emitProgress();
		if (this._isDj()) {
			this._maybeDeleteServerMedia(true);
			this._clearPlayback();
			this.onStatus("Finished — uploaded file deleted from server.");
		} else {
			this._clearPlayback();
			this.onStatus("Finished.");
		}
	};

	RoomMedia.prototype._startProgress = function () {
		var self = this;
		this._stopProgress();
		this.progressTimer = setInterval(function () { self._emitProgress(); }, 250);
	};

	RoomMedia.prototype._stopProgress = function () {
		if (this.progressTimer) {
			clearInterval(this.progressTimer);
			this.progressTimer = null;
		}
	};

	RoomMedia.prototype._emitProgress = function () {
		var dur = this.activeEl.duration;
		var cur = this.activeEl.currentTime;
		if (!isFinite(dur)) dur = 0;
		this.onProgress({
			current: cur,
			duration: dur,
			playing: this.playing,
			title: this.title,
			dj: this.djName
		});
	};

	RoomMedia.prototype.setVolume = function (vol, broadcast) {
		this.volume = Math.max(0, Math.min(1, vol));
		this.audio.volume = this.volume;
		this.video.volume = this.volume;
		if (broadcast) this.sendSync("v|" + this.volume.toFixed(2));
	};

	RoomMedia.prototype.uploadFile = function (file) {
		var self = this;
		if (!file) return Promise.reject(new Error("No file selected"));
		var kind = kindFromName(file.name);
		var title = clampTitle(file.name.replace(/\.[^.]+$/, ""));

		var fd = new FormData();
		fd.append("file", file, file.name);

		return fetch(API_MEDIA, { method: "POST", body: fd, cache: "no-store" })
			.then(function (r) { return r.json(); })
			.then(function (data) {
				if (!data.ok) throw new Error(data.error || "Upload failed");
				return {
					url: data.url,
					title: title,
					kind: data.kind || kind,
					serverHosted: true
				};
			})
			.catch(function (err) {
				// Fallback: local blob URL (this device only — still share metadata attempt)
				if (global.URL && URL.createObjectURL) {
					var blobUrl = URL.createObjectURL(file);
					self.onStatus("Upload server unavailable — playing locally only. Run chat-save-server.py to share with room.");
					return { url: blobUrl, title: title, kind: kind, localOnly: true };
				}
				throw err;
			});
	};

	RoomMedia.prototype.loadFromUrl = function (rawUrl, titleHint) {
		var url = (rawUrl || "").trim();
		if (!url) throw new Error("Enter a URL or choose a file");
		if (!/^https?:\/\//i.test(url) && url.charAt(0) !== "/") {
			url = "https://" + url;
		}
		url = resolveMediaUrl(url);
		this._replaceServerMedia(url);
		var kind = kindFromUrl(url);
		var title = clampTitle(titleHint || url.split("/").pop().split("?")[0] || "Stream");
		this.djName = (this.ownParticipant() && this.ownParticipant().name) || "You";
		this.djId = this.client.participantId;
		this._setActiveElement(kind);
		this.title = title;
		this._applyMediaUrl(url);
		this.playing = false;
		this.paused = true;
		this.onTrackChange({ title: this.title, dj: this.djName, kind: this.kind, url: this.url });
		this.onStatus("Loaded: " + this.title);
		this._emitProgress();
		return { url: url, title: title, kind: kind };
	};

	RoomMedia.prototype.shareLoad = function (url, title, kind) {
		this.sendSync("l|" + encodePart(url) + "|" + encodePart(title) + "|" + (kind === "video" ? "v" : "a"));
	};

	RoomMedia.prototype.play = function (broadcast) {
		if (broadcast === undefined) broadcast = true;
		this._localPlay(broadcast);
	};

	RoomMedia.prototype.pause = function (broadcast) {
		if (broadcast === undefined) broadcast = true;
		this._localPause(broadcast);
	};

	RoomMedia.prototype.stop = function (broadcast) {
		if (broadcast === undefined) broadcast = true;
		this._localStop(broadcast);
	};

	RoomMedia.prototype.seekTo = function (sec, broadcast) {
		if (broadcast === undefined) broadcast = true;
		this.activeEl.currentTime = Math.max(0, sec);
		this._emitProgress();
		if (broadcast) {
			this.sendSync("s|" + (this.serverTime() + 120) + "|" + sec);
		}
	};

	RoomMedia.prototype.requestSync = function () {
		this.sendSync("q");
	};

	RoomMedia.prototype._replyState = function () {
		if (!this.url) return;
		var playing = this.playing ? "1" : "0";
		var pos = this.activeEl.currentTime || 0;
		this.sendSync(
			"st|" + encodePart(this.url) + "|" + encodePart(this.title) + "|" +
			(this.kind === "video" ? "v" : "a") + "|" + playing + "|" + pos.toFixed(2) + "|" + this.serverTime()
		);
	};

	RoomMedia.prototype.loadAndShare = function (file) {
		var self = this;
		this.onStatus("Uploading " + (file.name || "file") + "…");
		return this.uploadFile(file).then(function (info) {
			self.loadFromUrl(info.url, info.title);
			self._setActiveElement(info.kind);
			if (!info.localOnly) {
				self.shareLoad(info.url, info.title, info.kind);
			}
			return info;
		});
	};

	RoomMedia.prototype.loadUrlAndShare = function (url, title) {
		var info = this.loadFromUrl(url, title);
		this.shareLoad(info.url, info.title, info.kind);
		return info;
	};

	global.RoomMedia = RoomMedia;
})(typeof window !== "undefined" ? window : this);
