/**
 * Play MP3 — room-synced audio. Everyone in the channel hears the same file
 * at the same media time. Play / pause / seek / speed / loop are broadcast on
 * the Harmony relay with a shared clock (client.serverTimeOffset) plus
 * lookahead scheduling and drift correction so devices stay locked even after
 * skip-ahead / skip-back.
 */
(function (global) {
	"use strict";

	var SYNC_PREFIX = "MP|";
	var PLAY_LEAD_MS = 220;
	var SEEK_LEAD_MS = 90;
	var DRIFT_SOFT_SEC = 0.045;
	var DRIFT_HARD_SEC = 0.150;
	var HEARTBEAT_MS = 2500;
	var RATE_CATCHUP = 1.02;
	var RATE_SLOWDOWN = 0.98;
	var MSG_MAX = 512;

	function encodePart(s) {
		return encodeURIComponent(s || "");
	}

	function decodePart(s) {
		try { return decodeURIComponent(s); } catch (e) { return s || ""; }
	}

	function chatText(msg) {
		if (!msg) return "";
		return msg.a != null ? msg.a : (msg.message != null ? msg.message : "");
	}

	function syncPayload(text) {
		if (!text || typeof text !== "string") return null;
		if (text.indexOf(SYNC_PREFIX) === 0) return text.slice(SYNC_PREFIX.length);
		return null;
	}

	function clampRate(rate) {
		rate = parseFloat(rate);
		if (!isFinite(rate) || rate <= 0) return 1;
		return Math.max(0.25, Math.min(3, rate));
	}

	function toShareUrl(url) {
		if (!url) return "";
		url = String(url);
		var idx = url.indexOf("/room-media/");
		if (idx !== -1) return url.slice(idx).split("?")[0].split("#")[0];
		return url;
	}

	function rewriteLocalhost(url) {
		if (!url || typeof window === "undefined" || !window.location) return url;
		var host = window.location.hostname || "localhost";
		return String(url)
			.replace("://localhost:", "://" + host + ":")
			.replace("://127.0.0.1:", "://" + host + ":");
	}

	function resolveSharedUrl(url) {
		url = String(url || "").trim();
		if (!url) return "";
		if (/^https?:\/\//i.test(url)) return rewriteLocalhost(url);
		var base = null;
		if (typeof RoomMedia !== "undefined" && typeof RoomMedia.getMediaServerBase === "function") {
			base = RoomMedia.getMediaServerBase();
		}
		if (!base && typeof window !== "undefined" && window.location) {
			base = window.location.protocol + "//" + window.location.hostname + ":8551";
		}
		if (!base) return url;
		base = rewriteLocalhost(String(base).replace(/\/+$/, ""));
		if (url.charAt(0) !== "/") url = "/" + url;
		return base + url;
	}

	function PlayMp3Sync(opts) {
		opts = opts || {};
		this.client = opts.client;
		this.getRoomMedia = opts.getRoomMedia || function () { return null; };
		this.ensureAudio = opts.ensureAudio || function () {};
		this.onStatus = opts.onStatus || function () {};
		this.onProgress = opts.onProgress || function () {};
		this.onTrackChange = opts.onTrackChange || function () {};
		this.onUnlockNeeded = opts.onUnlockNeeded || function () {};

		this.audio = document.createElement("audio");
		this.audio.preload = "auto";
		this.audio.style.display = "none";
		this.audio.preservesPitch = true;
		this.audio.mozPreservesPitch = true;
		this.audio.webkitPreservesPitch = true;
		document.body.appendChild(this.audio);

		this.title = "";
		this.sharedUrl = "";
		this.serverMediaUrl = null;
		this.objectUrl = null;
		this.syncEnabled = false;
		this.volume = 0.9;
		this.rate = 1;
		this.loop = false;
		this.playing = false;
		this.originPos = 0;
		this.originAt = 0;
		this.lastController = false;
		this.needsUnlock = false;
		this.seekDragging = false;
		this.uploading = false;
		this.pendingPlay = null;
		this.scheduledTimer = null;
		this.scheduledRaf = null;
		this.progressTimer = null;
		this.heartbeatTimer = null;
		this.driftTimer = null;

		var self = this;
		this.audio.addEventListener("ended", function () { self._onEnded(); });
		this.audio.addEventListener("loadedmetadata", function () { self._emitProgress(); });
		this.audio.addEventListener("error", function () {
			var code = self.audio.error && self.audio.error.code;
			self.onStatus("Could not load this audio file" + (code ? " (error " + code + ")" : "") + ".");
		});
	}

	PlayMp3Sync.SYNC_PREFIX = SYNC_PREFIX;
	PlayMp3Sync.isSyncText = function (text) { return syncPayload(text) !== null; };

	PlayMp3Sync.prototype.serverTime = function () {
		return Date.now() + ((this.client && this.client.serverTimeOffset) || 0);
	};

	PlayMp3Sync.prototype.ownParticipant = function () {
		return this.client && this.client.getOwnParticipant ? this.client.getOwnParticipant() : null;
	};

	PlayMp3Sync.prototype.hasTrack = function () {
		return !!(this.sharedUrl || this.objectUrl || (this.audio && this.audio.getAttribute("src")));
	};

	PlayMp3Sync.prototype.getCurrentTime = function () {
		if (this.playing && !this.seekDragging) return this.expectedPos(this.serverTime());
		return this.audio.currentTime || 0;
	};

	PlayMp3Sync.prototype.getDuration = function () {
		var d = this.audio.duration;
		return isFinite(d) ? d : 0;
	};

	PlayMp3Sync.prototype.expectedPos = function (now) {
		now = now == null ? this.serverTime() : now;
		var pos = this.originPos;
		if (this.playing) {
			pos += ((now - this.originAt) / 1000) * this.rate;
		}
		var dur = this.getDuration();
		if (this.loop && dur > 0.05) {
			pos = pos % dur;
			if (pos < 0) pos += dur;
		} else if (dur > 0 && pos > dur) {
			pos = dur;
		}
		if (pos < 0) pos = 0;
		return pos;
	};

	PlayMp3Sync.prototype.sendSync = function (payload) {
		if (!this.client || typeof this.client.isConnected !== "function") return false;
		if (!this.client.isConnected()) return false;
		var msg = SYNC_PREFIX + payload;
		if (msg.length > MSG_MAX) {
			this.onStatus("Sync message too long — try a shorter file name.");
			return false;
		}
		if (typeof this.client.broadcastRoom === "function") {
			return !!this.client.broadcastRoom(msg);
		}
		return false;
	};

	PlayMp3Sync.prototype.requestSync = function () {
		this.sendSync("q");
	};

	PlayMp3Sync.prototype._replyState = function () {
		if (!this.syncEnabled || !this.sharedUrl) return;
		this.sendSync(
			"st|" + encodePart(this.sharedUrl) + "|" + encodePart(this.title) + "|" +
			(this.playing ? "1" : "0") + "|" +
			this.originPos.toFixed(3) + "|" + Math.round(this.originAt) + "|" +
			this.rate.toFixed(3) + "|" + (this.loop ? "1" : "0")
		);
	};

	PlayMp3Sync.prototype.tryHandleChat = function (msg) {
		var text = chatText(msg);
		var payload = syncPayload(text);
		if (payload === null) return false;
		var parts = payload.split("|");
		var cmd = parts[0];
		var me = this.ownParticipant();
		if (me && msg.p && msg.p._id === me._id) return true;

		this.lastController = false;

		if (cmd === "l") {
			this._loadRemote(decodePart(parts[1]), decodePart(parts[2]));
		} else if (cmd === "p") {
			this._queueOrSchedule({
				playing: true,
				at: parseFloat(parts[1]) || this.serverTime(),
				pos: parseFloat(parts[2]) || 0,
				rate: clampRate(parts[3]),
				loop: parts[4] === "1"
			});
		} else if (cmd === "z") {
			this._applyPause(parseFloat(parts[1]) || 0, false);
		} else if (cmd === "s") {
			this._queueOrSchedule({
				playing: parts[3] === "1",
				at: parseFloat(parts[1]) || this.serverTime(),
				pos: parseFloat(parts[2]) || 0,
				rate: clampRate(parts[4]),
				loop: parts[5] === "1"
			});
		} else if (cmd === "x") {
			this._applyStop(false);
		} else if (cmd === "u") {
			this._applyClose(false);
		} else if (cmd === "r") {
			this._applyRate(
				clampRate(parts[3]),
				parseFloat(parts[2]) || 0,
				parseFloat(parts[1]) || this.serverTime(),
				parts[4] === "1",
				parts[5] === "1",
				false
			);
		} else if (cmd === "o") {
			this._setLoop(parts[1] === "1", false);
		} else if (cmd === "st") {
			this._applyState(
				decodePart(parts[1]),
				decodePart(parts[2]),
				parts[3] === "1",
				parseFloat(parts[4]) || 0,
				parseFloat(parts[5]) || 0,
				clampRate(parts[6]),
				parts[7] === "1"
			);
		} else if (cmd === "q") {
			if (this.syncEnabled && this.sharedUrl) this._replyState();
		} else if (cmd === "h") {
			if (!this.playing) return true;
			this.originPos = parseFloat(parts[1]) || this.originPos;
			this.originAt = parseFloat(parts[2]) || this.originAt;
			this.rate = clampRate(parts[3]);
			this.loop = parts[4] === "1";
			this._correctDrift(true);
		}
		return true;
	};

	PlayMp3Sync.prototype._queueOrSchedule = function (cmd) {
		this.rate = clampRate(cmd.rate);
		this.loop = !!cmd.loop;
		this.audio.loop = false;
		if (!this.audio.getAttribute("src")) {
			this.pendingPlay = cmd;
			return;
		}
		if (cmd.playing) this._schedulePlay(cmd.at, cmd.pos);
		else this._applyPause(cmd.pos, false);
	};

	PlayMp3Sync.prototype._clearSchedule = function () {
		if (this.scheduledTimer) {
			clearTimeout(this.scheduledTimer);
			this.scheduledTimer = null;
		}
		if (this.scheduledRaf) {
			cancelAnimationFrame(this.scheduledRaf);
			this.scheduledRaf = null;
		}
	};

	PlayMp3Sync.prototype._waitUntil = function (atServer, cb) {
		var self = this;
		this._clearSchedule();
		var tick = function () {
			var left = atServer - self.serverTime();
			if (left <= 6) {
				self.scheduledTimer = null;
				self.scheduledRaf = null;
				cb();
				return;
			}
			if (left > 50) {
				self.scheduledTimer = setTimeout(tick, Math.max(8, left - 16));
			} else {
				self.scheduledRaf = requestAnimationFrame(tick);
			}
		};
		tick();
	};

	PlayMp3Sync.prototype._whenReady = function (cb) {
		var el = this.audio;
		if (el.readyState >= 2) {
			cb();
			return;
		}
		var done = false;
		var finish = function () {
			if (done) return;
			done = true;
			el.removeEventListener("canplay", finish);
			el.removeEventListener("loadeddata", finish);
			el.removeEventListener("error", onErr);
			cb();
		};
		var onErr = function () {
			if (done) return;
			done = true;
			el.removeEventListener("canplay", finish);
			el.removeEventListener("loadeddata", finish);
			el.removeEventListener("error", onErr);
		};
		el.addEventListener("canplay", finish);
		el.addEventListener("loadeddata", finish);
		el.addEventListener("error", onErr);
		try { el.load(); } catch (e) {}
	};

	PlayMp3Sync.prototype._schedulePlay = function (atServer, pos) {
		var self = this;
		this.pendingPlay = null;
		this.rate = clampRate(this.rate);
		this.originPos = Math.max(0, pos);
		this.originAt = atServer;
		this.playing = true;
		this._emitProgress();

		var run = function () {
			var now = self.serverTime();
			var catchPos = self.expectedPos(now);
			self._setCurrentTime(catchPos);
			self._localPlayElement();
		};

		this._whenReady(function () {
			var delay = atServer - self.serverTime();
			if (delay < -40) {
				run();
				return;
			}
			self._waitUntil(atServer, run);
		});
	};

	PlayMp3Sync.prototype._localPlayElement = function () {
		var self = this;
		this.ensureAudio();
		this.audio.volume = this.volume;
		this.audio.playbackRate = this.rate;
		this.audio.loop = false;
		var p = this.audio.play();
		if (p && typeof p.then === "function") {
			p.then(function () {
				self.needsUnlock = false;
				self.playing = true;
				self._startTimers();
				self._emitProgress();
			}).catch(function () {
				self.needsUnlock = true;
				self.onUnlockNeeded();
				self.onStatus("Tap Play on this device to hear the room MP3.");
				self._startTimers();
				self._emitProgress();
			});
		} else {
			this.needsUnlock = false;
			this.playing = true;
			this._startTimers();
			this._emitProgress();
		}
	};

	PlayMp3Sync.prototype._setCurrentTime = function (sec) {
		if (!isFinite(sec)) return;
		var dur = this.getDuration();
		if (dur > 0) sec = Math.max(0, Math.min(dur, sec));
		else sec = Math.max(0, sec);
		try { this.audio.currentTime = sec; } catch (e) {}
	};

	PlayMp3Sync.prototype._applyPause = function (pos, broadcast) {
		this._clearSchedule();
		this.pendingPlay = null;
		this.playing = false;
		this.originPos = Math.max(0, pos);
		this.originAt = this.serverTime();
		this.audio.pause();
		this._setCurrentTime(this.originPos);
		this.audio.playbackRate = this.rate;
		this.needsUnlock = false;
		this._stopHeartbeat();
		this._stopDrift();
		this._stopProgress();
		this._emitProgress();
		if (broadcast && this.syncEnabled) {
			this.lastController = true;
			this.sendSync("z|" + this.originPos.toFixed(3));
		}
	};

	PlayMp3Sync.prototype._applyStop = function (broadcast) {
		this._clearSchedule();
		this.pendingPlay = null;
		this.playing = false;
		this.originPos = 0;
		this.originAt = this.serverTime();
		this.audio.pause();
		try { this.audio.currentTime = 0; } catch (e) {}
		this.needsUnlock = false;
		this._stopHeartbeat();
		this._stopDrift();
		this._stopProgress();
		this._emitProgress();
		if (broadcast && this.syncEnabled) {
			this.lastController = true;
			this.sendSync("x");
		}
	};

	PlayMp3Sync.prototype._applyClose = function (broadcast) {
		this._applyStop(false);
		if (broadcast && this.syncEnabled) {
			this.lastController = true;
			this.sendSync("u");
			this._deleteServerFile();
		} else {
			this.serverMediaUrl = null;
		}
		this._clearSrc(false);
		this.onTrackChange({ title: "", url: "", sync: false, closed: true });
	};

	PlayMp3Sync.prototype._applyState = function (url, title, playing, originPos, originAt, rate, loop) {
		var self = this;
		this.rate = clampRate(rate);
		this.loop = !!loop;
		var afterLoad = function () {
			self.originPos = originPos;
			self.originAt = originAt || self.serverTime();
			self.playing = !!playing;
			if (playing) {
				self._schedulePlay(self.originAt, self.originPos);
			} else {
				self._applyPause(originPos, false);
			}
		};
		if (toShareUrl(url) && toShareUrl(url) !== this.sharedUrl) {
			this._loadRemote(url, title, afterLoad);
		} else {
			this.title = title || this.title;
			afterLoad();
		}
	};

	PlayMp3Sync.prototype._loadRemote = function (url, title, then) {
		var self = this;
		var nextShare = toShareUrl(url);
		this._clearSchedule();
		if (this.sharedUrl && nextShare !== this.sharedUrl) this.pendingPlay = null;
		this.playing = false;
		this.audio.pause();
		this._revokeObjectUrl();
		this.title = title || "Audio";
		this.sharedUrl = toShareUrl(url);
		this.syncEnabled = !!this.sharedUrl;
		this.serverMediaUrl = this.sharedUrl;
		this.needsUnlock = false;

		var apply = function () {
			var playUrl = resolveSharedUrl(self.sharedUrl || url);
			if (!playUrl) {
				self.onStatus("Could not resolve room MP3 URL.");
				return;
			}
			self.audio.src = playUrl;
			try { self.audio.load(); } catch (e) {}
			self.onTrackChange({ title: self.title, url: playUrl, sync: true });
			self.onStatus("Room MP3: " + self.title);
			self._emitProgress();
			if (typeof then === "function") {
				self._whenReady(then);
			} else if (self.pendingPlay) {
				var cmd = self.pendingPlay;
				self.pendingPlay = null;
				self._whenReady(function () {
					self._queueOrSchedule(cmd);
				});
			}
		};

		if (typeof RoomMedia !== "undefined" && typeof RoomMedia.initMediaServer === "function") {
			RoomMedia.initMediaServer().then(apply).catch(apply);
		} else {
			apply();
		}
	};

	PlayMp3Sync.prototype._revokeObjectUrl = function () {
		if (this.objectUrl) {
			try { URL.revokeObjectURL(this.objectUrl); } catch (e) {}
			this.objectUrl = null;
		}
	};

	PlayMp3Sync.prototype._clearSrc = function (keepName) {
		this.audio.removeAttribute("src");
		try { this.audio.load(); } catch (e) {}
		this.sharedUrl = "";
		this.syncEnabled = false;
		this.serverMediaUrl = null;
		this._revokeObjectUrl();
		if (!keepName) this.title = "";
		this._emitProgress();
	};

	PlayMp3Sync.prototype._deleteServerFile = function () {
		var url = this.serverMediaUrl;
		if (!url) return;
		var rm = this.getRoomMedia && this.getRoomMedia();
		if (rm && typeof rm.deleteServerMedia === "function") {
			rm.deleteServerMedia(url, true);
		}
		this.serverMediaUrl = null;
	};

	PlayMp3Sync.prototype._onEnded = function () {
		if (this.loop && this.playing) {
			var now = this.serverTime();
			this._setCurrentTime(this.expectedPos(now));
			this._localPlayElement();
			return;
		}
		this.playing = false;
		this.originPos = this.getDuration() || 0;
		this.originAt = this.serverTime();
		this._stopHeartbeat();
		this._stopDrift();
		this._stopProgress();
		this._emitProgress();
	};

	PlayMp3Sync.prototype._startTimers = function () {
		var self = this;
		this._stopProgress();
		this._stopDrift();
		this.progressTimer = setInterval(function () { self._emitProgress(); }, 100);
		this.driftTimer = setInterval(function () { self._correctDrift(false); }, 250);
		if (this.lastController && this.syncEnabled) this._startHeartbeat();
	};

	PlayMp3Sync.prototype._stopProgress = function () {
		if (this.progressTimer) {
			clearInterval(this.progressTimer);
			this.progressTimer = null;
		}
	};

	PlayMp3Sync.prototype._stopDrift = function () {
		if (this.driftTimer) {
			clearInterval(this.driftTimer);
			this.driftTimer = null;
		}
		try { this.audio.playbackRate = this.rate; } catch (e) {}
	};

	PlayMp3Sync.prototype._startHeartbeat = function () {
		var self = this;
		this._stopHeartbeat();
		if (!this.syncEnabled || !this.lastController) return;
		this.heartbeatTimer = setInterval(function () {
			if (!self.playing || !self.lastController || !self.syncEnabled) return;
			self.sendSync(
				"h|" + self.originPos.toFixed(3) + "|" + Math.round(self.originAt) + "|" +
				self.rate.toFixed(3) + "|" + (self.loop ? "1" : "0")
			);
		}, HEARTBEAT_MS);
	};

	PlayMp3Sync.prototype._stopHeartbeat = function () {
		if (this.heartbeatTimer) {
			clearInterval(this.heartbeatTimer);
			this.heartbeatTimer = null;
		}
	};

	PlayMp3Sync.prototype._correctDrift = function (fromHeartbeat) {
		if (!this.playing || this.seekDragging || this.needsUnlock) return;
		if (this.audio.readyState < 2 || this.audio.paused) return;
		var expected = this.expectedPos(this.serverTime());
		var actual = this.audio.currentTime || 0;
		var drift = actual - expected;
		var abs = Math.abs(drift);
		try {
			if (abs > DRIFT_HARD_SEC || (fromHeartbeat && abs > DRIFT_SOFT_SEC)) {
				this._setCurrentTime(expected);
				this.audio.playbackRate = this.rate;
			} else if (abs > DRIFT_SOFT_SEC) {
				this.audio.playbackRate = this.rate * (drift < 0 ? RATE_CATCHUP : RATE_SLOWDOWN);
			} else {
				this.audio.playbackRate = this.rate;
			}
		} catch (e) {}
	};

	PlayMp3Sync.prototype._emitProgress = function () {
		var cur = this.seekDragging ? (this.audio.currentTime || 0) : (
			this.playing ? this.expectedPos(this.serverTime()) : (this.audio.currentTime || this.originPos || 0)
		);
		this.onProgress({
			current: cur,
			duration: this.getDuration(),
			playing: this.playing,
			title: this.title,
			rate: this.rate,
			loop: this.loop,
			volume: this.volume,
			sync: this.syncEnabled,
			uploading: this.uploading,
			needsUnlock: this.needsUnlock
		});
	};

	PlayMp3Sync.prototype._broadcastPlay = function (pos) {
		this.lastController = true;
		pos = Math.max(0, pos);
		if (!this.syncEnabled) {
			this.originPos = pos;
			this.originAt = this.serverTime();
			this.playing = true;
			this._setCurrentTime(pos);
			this._localPlayElement();
			return;
		}
		var at = this.serverTime() + PLAY_LEAD_MS;
		this.originPos = pos;
		this.originAt = at;
		this.playing = true;
		this.sendSync(
			"p|" + Math.round(at) + "|" + this.originPos.toFixed(3) + "|" +
			this.rate.toFixed(3) + "|" + (this.loop ? "1" : "0")
		);
		this._schedulePlay(at, this.originPos);
	};

	PlayMp3Sync.prototype.play = function () {
		if (!this.hasTrack()) {
			this.onStatus("Choose an MP3 (or other audio) file first.");
			return false;
		}
		if (this.needsUnlock && this.playing) {
			this.unlockAndFollow();
			return true;
		}
		this._broadcastPlay(this.audio.paused ? (this.audio.currentTime || this.originPos || 0) : this.expectedPos(this.serverTime()));
		return true;
	};

	PlayMp3Sync.prototype.unlockAndFollow = function () {
		this.ensureAudio();
		this.needsUnlock = false;
		this._setCurrentTime(this.expectedPos(this.serverTime()));
		this._localPlayElement();
	};

	PlayMp3Sync.prototype.pause = function () {
		if (!this.hasTrack()) return;
		var pos = this.playing ? this.expectedPos(this.serverTime()) : (this.audio.currentTime || 0);
		this.lastController = true;
		this._applyPause(pos, true);
	};

	PlayMp3Sync.prototype.stop = function () {
		this.lastController = true;
		this._applyStop(true);
	};

	PlayMp3Sync.prototype.close = function () {
		this.lastController = true;
		this._applyClose(true);
	};

	PlayMp3Sync.prototype.seekTo = function (sec) {
		if (!this.hasTrack() || !isFinite(sec)) return;
		var dur = this.getDuration();
		if (dur > 0) sec = Math.max(0, Math.min(dur, sec));
		else sec = Math.max(0, sec);
		this.lastController = true;
		if (this.playing) {
			var at = this.serverTime() + SEEK_LEAD_MS;
			this.originPos = sec;
			this.originAt = at;
			if (this.syncEnabled) {
				this.sendSync(
					"s|" + Math.round(at) + "|" + sec.toFixed(3) + "|1|" +
					this.rate.toFixed(3) + "|" + (this.loop ? "1" : "0")
				);
			}
			this._schedulePlay(at, sec);
		} else {
			this.originPos = sec;
			this.originAt = this.serverTime();
			this._setCurrentTime(sec);
			this._emitProgress();
			if (this.syncEnabled) {
				this.sendSync(
					"s|" + Math.round(this.originAt) + "|" + sec.toFixed(3) + "|0|" +
					this.rate.toFixed(3) + "|" + (this.loop ? "1" : "0")
				);
			}
		}
	};

	PlayMp3Sync.prototype.seekBy = function (delta) {
		var cur = this.playing ? this.expectedPos(this.serverTime()) : (this.audio.currentTime || 0);
		this.seekTo(cur + delta);
	};

	PlayMp3Sync.prototype._applyRate = function (rate, pos, at, playing, loop, broadcast) {
		this.rate = clampRate(rate);
		this.loop = !!loop;
		this.audio.loop = false;
		try { this.audio.playbackRate = this.rate; } catch (e) {}
		this.originPos = Math.max(0, pos);
		this.originAt = at || this.serverTime();
		if (playing) {
			this.playing = true;
			this._correctDrift(true);
			this._startTimers();
		}
		this._emitProgress();
		if (broadcast && this.syncEnabled) {
			this.lastController = true;
			this.sendSync(
				"r|" + Math.round(this.originAt) + "|" + this.originPos.toFixed(3) + "|" +
				this.rate.toFixed(3) + "|" + (this.playing ? "1" : "0") + "|" + (this.loop ? "1" : "0")
			);
		}
	};

	PlayMp3Sync.prototype.setRate = function (rate, broadcast) {
		if (broadcast === undefined) broadcast = true;
		var pos = this.playing ? this.expectedPos(this.serverTime()) : (this.audio.currentTime || this.originPos || 0);
		this._applyRate(rate, pos, this.serverTime(), this.playing, this.loop, broadcast);
	};

	PlayMp3Sync.prototype.setLoop = function (on) {
		this._setLoop(!!on, true);
	};

	PlayMp3Sync.prototype._setLoop = function (on, broadcast) {
		this.loop = !!on;
		this.audio.loop = false;
		if (broadcast && this.syncEnabled) {
			this.lastController = true;
			this.sendSync("o|" + (this.loop ? "1" : "0"));
		}
		this._emitProgress();
	};

	PlayMp3Sync.prototype.setVolume = function (vol) {
		vol = parseFloat(vol);
		if (!isFinite(vol)) vol = 0.9;
		this.volume = Math.max(0, Math.min(1, vol));
		this.audio.volume = this.volume;
	};

	PlayMp3Sync.prototype.previewSeek = function (sec) {
		this.seekDragging = true;
		this._emitProgress();
		this.onProgress({
			current: sec,
			duration: this.getDuration(),
			playing: this.playing,
			title: this.title,
			rate: this.rate,
			loop: this.loop,
			volume: this.volume,
			sync: this.syncEnabled,
			uploading: this.uploading,
			needsUnlock: this.needsUnlock
		});
	};

	PlayMp3Sync.prototype.endSeekDrag = function () {
		this.seekDragging = false;
	};

	PlayMp3Sync.prototype._loadLocalFallback = function (file, autoPlay) {
		this._revokeObjectUrl();
		this.objectUrl = URL.createObjectURL(file);
		this.audio.src = this.objectUrl;
		this.title = file.name || "Audio file";
		this.sharedUrl = "";
		this.syncEnabled = false;
		this.serverMediaUrl = null;
		try { this.audio.load(); } catch (e) {}
		this.onTrackChange({ title: this.title, url: this.objectUrl, sync: false });
		this.onStatus("Playing only on this device — start the media server to sync the room.");
		this._emitProgress();
		if (autoPlay) this.play();
	};

	PlayMp3Sync.prototype.loadFile = function (file, autoPlay) {
		var self = this;
		if (!file) return Promise.resolve();
		this._clearSchedule();
		this.audio.pause();
		this.playing = false;
		this._stopHeartbeat();
		this._stopDrift();
		this._deleteServerFile();
		this._revokeObjectUrl();
		this.title = file.name || "Audio file";
		this.uploading = true;
		this.syncEnabled = false;
		this.onTrackChange({ title: this.title, url: "", sync: false, uploading: true });
		this.onStatus("Sharing “" + this.title + "” with the room…");
		this._emitProgress();

		var rm = this.getRoomMedia && this.getRoomMedia();
		if (!rm || typeof rm.uploadFile !== "function") {
			this.uploading = false;
			this._loadLocalFallback(file, autoPlay);
			return Promise.resolve();
		}

		return rm.uploadFile(file).then(function (info) {
			self.uploading = false;
			var share = toShareUrl(info.url);
			self.sharedUrl = share;
			self.serverMediaUrl = share;
			self.syncEnabled = true;
			self.lastController = true;
			self.audio.src = resolveSharedUrl(share);
			try { self.audio.load(); } catch (e) {}
			self.onTrackChange({ title: self.title, url: self.audio.src, sync: true });
			self.onStatus("Room MP3 ready — everyone is locked to this track.");
			self._emitProgress();
			self.sendSync("l|" + encodePart(share) + "|" + encodePart(self.title));
			if (autoPlay) {
				self._whenReady(function () { self.play(); });
			}
			return info;
		}).catch(function (err) {
			self.uploading = false;
			self.onStatus((err && err.message) ? err.message : "Upload failed");
			self._loadLocalFallback(file, autoPlay);
		});
	};

	if (typeof module !== "undefined" && module.exports) {
		module.exports = PlayMp3Sync;
	} else {
		global.PlayMp3Sync = PlayMp3Sync;
	}
})(typeof window !== "undefined" ? window : this);
