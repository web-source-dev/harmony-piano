/**
 * Room DJ — shared audio/video playback synced across the room via chat transport.
 */
(function (global) {
	"use strict";

	var SYNC_PREFIX = "RM|";
	var DEFAULT_MEDIA_PORT = 8551;
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
			.then(function (data) { return (data && data.ok) ? base : null; })
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
			bases.push(window.location.origin);
			var host = window.location.hostname || "localhost";
			bases.push("http://" + host + ":" + DEFAULT_MEDIA_PORT);
			bases.push("http://localhost:" + DEFAULT_MEDIA_PORT);
			bases.push("http://127.0.0.1:" + DEFAULT_MEDIA_PORT);
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

	function getMediaServerBase() {
		return mediaServerBase;
	}

	function publicMediaBase() {
		var base = getMediaServerBase();
		if (!base) return null;
		if (typeof window === "undefined" || !window.location) return base;
		var host = window.location.hostname;
		if (!host) return base;
		return base
			.replace("://localhost:", "://" + host + ":")
			.replace("://127.0.0.1:", "://" + host + ":");
	}

	function apiMediaUrl() {
		var base = getMediaServerBase();
		return base ? base + "/api/media" : "/api/media";
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
		if (parseYouTubeId(url)) return "youtube";
		var path = (url || "").split("?")[0].split("#")[0];
		if (VIDEO_EXT.test(path)) return "video";
		return "audio";
	}

	function parseYouTubeId(url) {
		if (!url) return null;
		url = String(url).trim();
		if (/^yt:[a-zA-Z0-9_-]{11}$/.test(url)) return url.slice(3);
		if (/^[a-zA-Z0-9_-]{11}$/.test(url)) return url;
		var m = url.match(/(?:youtube\.com\/(?:shorts\/|embed\/|live\/|watch\?(?:.*&)?v=)|youtu\.be\/|youtube-nocookie\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
		return m ? m[1] : null;
	}

	function isYouTubeShortUrl(url) {
		return /\/shorts\//i.test(url || "");
	}

	function kindFromCode(code) {
		if (code === "y") return "youtube";
		if (code === "v") return "video";
		return "audio";
	}

	function kindToCode(kind) {
		if (kind === "youtube") return "y";
		if (kind === "video") return "v";
		return "a";
	}

	function youtubeStorageId(id) {
		return "yt:" + id;
	}

	var ytApiReady = null;
	function ensureYouTubeApi() {
		if (typeof global.YT !== "undefined" && global.YT.Player) {
			return Promise.resolve();
		}
		if (ytApiReady) return ytApiReady;
		ytApiReady = new Promise(function (resolve) {
			var prev = global.onYouTubeIframeAPIReady;
			global.onYouTubeIframeAPIReady = function () {
				if (prev) prev();
				resolve();
			};
			if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
				var tag = document.createElement("script");
				tag.src = "https://www.youtube.com/iframe_api";
				document.head.appendChild(tag);
			} else {
				var poll = setInterval(function () {
					if (typeof global.YT !== "undefined" && global.YT.Player) {
						clearInterval(poll);
						resolve();
					}
				}, 100);
			}
		});
		return ytApiReady;
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
		if (/^yt:[a-zA-Z0-9_-]{11}$/.test(path)) return path;
		if (/^https?:\/\//i.test(path) || path.indexOf("blob:") === 0) return path;
		var base = publicMediaBase() || getMediaServerBase();
		if (!base && typeof window !== "undefined" && window.location) {
			base = window.location.origin;
		}
		if (path.charAt(0) === "/") return (base || "") + path;
		return (base || "") + "/" + path;
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
		this.onServerReady = options.onServerReady || function () {};

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
		this.ytPlayer = null;
		this.ytVideoId = null;
		this.ytReady = false;
		this.ytIsShort = false;
		this.ytShareUrl = null;
		this.ytMount = options.youtubeMountEl || document.getElementById("room-media-youtube-mount");

		var mount = options.mountEl || document.getElementById("room-media-audio-mount");
		if (mount) {
			mount.appendChild(this.audio);
			mount.appendChild(this.video);
		} else {
			this.audio.style.display = "none";
			this.video.style.display = "none";
			document.body.appendChild(this.audio);
			document.body.appendChild(this.video);
		}

		var self = this;
		this.audio.addEventListener("ended", function () { self._onEnded(); });
		this.video.addEventListener("ended", function () { self._onEnded(); });
		this.audio.addEventListener("loadedmetadata", function () { self._emitProgress(); });
		this.video.addEventListener("loadedmetadata", function () { self._emitProgress(); });

		initMediaServer().then(function (base) {
			if (base) self.onServerReady(base);
			else self.onStatus("Room DJ server offline — run: python media-server.py");
		});
	}

	RoomMedia.SYNC_PREFIX = SYNC_PREFIX;
	RoomMedia.formatTime = formatTime;
	RoomMedia.isSyncText = function (text) { return syncPayload(text) !== null; };
	RoomMedia.initMediaServer = initMediaServer;
	RoomMedia.getMediaServerBase = getMediaServerBase;
	RoomMedia.parseYouTubeId = parseYouTubeId;
	RoomMedia.isYouTubeUrl = function (url) { return !!parseYouTubeId(url); };

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
		return fetch(apiMediaUrl(), {
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

	RoomMedia.prototype._destroyYouTube = function () {
		this.ytReady = false;
		if (this.ytPlayer && this.ytPlayer.destroy) {
			try { this.ytPlayer.destroy(); } catch (e) {}
		}
		this.ytPlayer = null;
		this.ytVideoId = null;
		this.ytShareUrl = null;
		if (this.ytMount) this.ytMount.innerHTML = "";
	};

	RoomMedia.prototype._getCurrentTime = function () {
		if (this.kind === "youtube" && this.ytPlayer && this.ytPlayer.getCurrentTime) {
			try { return this.ytPlayer.getCurrentTime() || 0; } catch (e) { return 0; }
		}
		return this.activeEl.currentTime || 0;
	};

	RoomMedia.prototype._getDuration = function () {
		if (this.kind === "youtube" && this.ytPlayer && this.ytPlayer.getDuration) {
			try {
				var d = this.ytPlayer.getDuration();
				return isFinite(d) ? d : 0;
			} catch (e) { return 0; }
		}
		var d = this.activeEl.duration;
		return isFinite(d) ? d : 0;
	};

	RoomMedia.prototype._setCurrentTime = function (sec) {
		sec = Math.max(0, sec);
		if (this.kind === "youtube" && this.ytPlayer && this.ytPlayer.seekTo) {
			try { this.ytPlayer.seekTo(sec, true); return; } catch (e) {}
		}
		this.activeEl.currentTime = sec;
	};

	RoomMedia.prototype._whenYouTubeReady = function (fn) {
		var self = this;
		if (this.ytReady && this.ytPlayer) {
			fn();
			return;
		}
		var tries = 0;
		var iv = setInterval(function () {
			tries++;
			if (self.ytReady && self.ytPlayer) {
				clearInterval(iv);
				fn();
			} else if (tries > 80) {
				clearInterval(iv);
				self.onStatus("YouTube player timed out — try Play again.");
			}
		}, 150);
	};

	RoomMedia.prototype._loadYouTubePlayer = function (videoId) {
		var self = this;
		if (!videoId || !this.ytMount) return Promise.reject(new Error("YouTube mount missing"));
		return ensureYouTubeApi().then(function () {
			if (self.ytVideoId === videoId && self.ytPlayer) return;
			self._destroyYouTube();
			self.ytVideoId = videoId;
			self.ytMount.innerHTML = '<div id="room-media-yt-player"></div>';
			return new Promise(function (resolve) {
				self.ytPlayer = new global.YT.Player("room-media-yt-player", {
					videoId: videoId,
					width: "100%",
					height: "100%",
					playerVars: {
						autoplay: 0,
						controls: 0,
						disablekb: 1,
						fs: 0,
						modestbranding: 1,
						rel: 0,
						playsinline: 1,
						origin: global.location ? global.location.origin : undefined
					},
					events: {
						onReady: function () {
							self.ytReady = true;
							if (self.ytPlayer.setVolume) {
								self.ytPlayer.setVolume(Math.round(self.volume * 100));
							}
							self._emitProgress();
							resolve();
						},
						onStateChange: function (ev) {
							if (ev.data === global.YT.PlayerState.ENDED) {
								self._onEnded();
							}
						},
						onError: function () {
							self.onStatus("YouTube video unavailable (private, blocked, or removed).");
						}
					}
				});
			});
		});
	};

	RoomMedia.prototype._clearPlayback = function () {
		this._destroyYouTube();
		this.audio.removeAttribute("src");
		this.video.removeAttribute("src");
		this.audio.load();
		this.video.load();
		this.url = "";
		this.ytShareUrl = null;
		this.playing = false;
		this.paused = false;
		this._stopProgress();
		this._emitProgress();
		document.body.classList.remove("room-media-youtube");
	};

	RoomMedia.prototype.serverTime = function () {
		return Date.now() + (this.client.serverTimeOffset || 0);
	};

	RoomMedia.prototype.isSyncMessage = function (text) {
		return syncPayload(text) !== null;
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
		var text = chatText(msg);
		var payload = syncPayload(text);
		if (payload === null) return false;
		var parts = payload.split("|");
		var cmd = parts[0];
		var me = this.ownParticipant();
		if (me && msg.p && msg.p._id === me._id) return true;

		if (cmd === "l") {
			var url = decodePart(parts[1]);
			var title = decodePart(parts[2]);
			var kind = kindFromCode(parts[3]);
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
			kind = kindFromCode(parts[3]);
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
		if (kind === "youtube") {
			this.kind = "youtube";
			this.activeEl = this.audio;
			document.body.classList.add("room-media-youtube");
			this.onTransport({
				visible: true,
				kind: "youtube",
				isShort: this.ytIsShort,
				videoEl: null
			});
			return;
		}
		document.body.classList.remove("room-media-youtube");
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
		if (this.kind === "audio" && this.audio.src) this.audio.load();
		if (this.kind === "video" && this.video.src) this.video.load();
	};

	RoomMedia.prototype._replaceServerMedia = function (nextUrl) {
		if (!this.serverMediaUrl || !this._isDj()) return;
		var prev = this.serverMediaUrl;
		if (normalizeServerMediaUrl(prev) === normalizeServerMediaUrl(nextUrl)) return;
		this.deleteServerMedia(prev, true);
	};

	RoomMedia.prototype._loadRemote = function (url, title, kind) {
		var self = this;
		this._clearSchedule();
		this.title = clampTitle(title);
		this.playing = false;
		this.paused = true;

		if (kind === "youtube") {
			var ytId = parseYouTubeId(url);
			if (!ytId) {
				this.onStatus("Invalid YouTube link.");
				return;
			}
			this.url = youtubeStorageId(ytId);
			this.ytIsShort = isYouTubeShortUrl(url);
			this.ytShareUrl = /youtube|youtu\.be/i.test(String(url)) ? String(url).trim() : null;
			this.serverMediaUrl = null;
			this._setActiveElement("youtube");
			this.onStatus("Loading YouTube…");
			this._loadYouTubePlayer(ytId).then(function () {
				self.onTrackChange({ title: self.title, dj: self.djName, kind: "youtube", url: self.url });
				self.onStatus("Loaded: " + self.title + " (DJ: " + self.djName + ")");
				self._emitProgress();
			}).catch(function () {
				self.onStatus("Could not load YouTube video.");
			});
			return;
		}

		this._setActiveElement(kind);
		this._applyMediaUrl(url);
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
		var run = function () {
			self._setCurrentTime(Math.max(0, pos));
			if (playing) self._localPlay(false);
			else self._localPause(false);
		};
		if (kind === "youtube") {
			this.scheduledTimer = setTimeout(function () {
				self._whenYouTubeReady(run);
			}, delay);
		} else {
			this.scheduledTimer = setTimeout(run, delay);
		}
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
		var run = function () {
			self._setCurrentTime(Math.max(0, pos));
			self._localPlay(false);
		};
		if (this.kind === "youtube") {
			this.scheduledTimer = setTimeout(function () {
				self._whenYouTubeReady(run);
			}, delay);
		} else {
			this.scheduledTimer = setTimeout(run, delay);
		}
	};

	RoomMedia.prototype._schedulePause = function (atServer, pos) {
		var self = this;
		this._clearSchedule();
		var delay = Math.max(0, atServer - this.serverTime());
		var run = function () {
			self._setCurrentTime(Math.max(0, pos));
			self._localPause(false);
		};
		if (this.kind === "youtube") {
			this.scheduledTimer = setTimeout(function () {
				self._whenYouTubeReady(run);
			}, delay);
		} else {
			this.scheduledTimer = setTimeout(run, delay);
		}
	};

	RoomMedia.prototype._scheduleSeek = function (atServer, pos) {
		var self = this;
		this._clearSchedule();
		var delay = Math.max(0, atServer - this.serverTime());
		var run = function () {
			self._setCurrentTime(Math.max(0, pos));
			self._emitProgress();
		};
		if (this.kind === "youtube") {
			this.scheduledTimer = setTimeout(function () {
				self._whenYouTubeReady(run);
			}, delay);
		} else {
			this.scheduledTimer = setTimeout(run, delay);
		}
	};

	RoomMedia.prototype._scheduleStop = function () {
		this._clearSchedule();
		this._localStop(false);
	};

	RoomMedia.prototype._localPlay = function (broadcast) {
		var self = this;
		if (!this.url) {
			this.onStatus("Load a file or URL first.");
			return;
		}
		this.ignoreRemoteUntil = Date.now() + 300;

		function afterPlay() {
			self.playing = true;
			self.paused = false;
			self._startProgress();
			self.onTransport({
				visible: true,
				kind: self.kind,
				isShort: self.ytIsShort,
				videoEl: self.kind === "video" ? self.video : null
			});
			if (broadcast) {
				self.sendSync("p|" + self.serverTime() + "|" + self._getCurrentTime());
			}
		}

		if (this.kind === "youtube") {
			this._whenYouTubeReady(function () {
				try {
					if (self.ytPlayer.setVolume) {
						self.ytPlayer.setVolume(Math.round(self.volume * 100));
					}
					self.ytPlayer.playVideo();
					afterPlay();
				} catch (err) {
					self.onStatus("YouTube playback blocked — click Play again.");
					self.playing = false;
				}
			});
			return;
		}

		this.activeEl.volume = this.volume;

		function doPlay() {
			var p = self.activeEl.play();
			if (p && p.catch) {
				p.catch(function (err) {
					self.onStatus("Playback blocked — click Play again. (" + (err.message || "autoplay") + ")");
					self.playing = false;
				});
			}
			afterPlay();
		}

		if (this.activeEl.readyState >= 2) {
			doPlay();
			return;
		}
		this.onStatus("Buffering…");
		this.activeEl.load();
		var onReady = function () {
			self.activeEl.removeEventListener("canplay", onReady);
			self.activeEl.removeEventListener("error", onErr);
			doPlay();
		};
		var onErr = function () {
			self.activeEl.removeEventListener("canplay", onReady);
			self.activeEl.removeEventListener("error", onErr);
			self.onStatus("Could not load media — check file upload or URL.");
		};
		this.activeEl.addEventListener("canplay", onReady);
		this.activeEl.addEventListener("error", onErr);
	};

	RoomMedia.prototype._localPause = function (broadcast) {
		this.ignoreRemoteUntil = Date.now() + 300;
		if (this.kind === "youtube" && this.ytPlayer && this.ytPlayer.pauseVideo) {
			try { this.ytPlayer.pauseVideo(); } catch (e) {}
		} else {
			this.activeEl.pause();
		}
		this.playing = false;
		this.paused = true;
		this._stopProgress();
		this._emitProgress();
		if (broadcast) {
			this.sendSync("z|" + this.serverTime() + "|" + this._getCurrentTime());
		}
	};

	RoomMedia.prototype._localStop = function (broadcast) {
		this.ignoreRemoteUntil = Date.now() + 300;
		if (this.kind === "youtube" && this.ytPlayer) {
			try {
				if (this.ytPlayer.pauseVideo) this.ytPlayer.pauseVideo();
				if (this.ytPlayer.seekTo) this.ytPlayer.seekTo(0, true);
			} catch (e) {}
		} else {
			this.activeEl.pause();
			this.activeEl.currentTime = 0;
		}
		this.playing = false;
		this.paused = false;
		this._stopProgress();
		this._emitProgress();
		if (broadcast) {
			this.sendSync("x|" + this.serverTime());
			if (this.kind !== "youtube") this._maybeDeleteServerMedia(true);
			this._clearPlayback();
		}
	};

	RoomMedia.prototype._onEnded = function () {
		this.playing = false;
		this.paused = false;
		this._stopProgress();
		this._emitProgress();
		if (this.kind === "youtube") {
			this._clearPlayback();
			this.onStatus("Finished.");
			return;
		}
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
		this.onProgress({
			current: this._getCurrentTime(),
			duration: this._getDuration(),
			playing: this.playing,
			title: this.title,
			dj: this.djName
		});
	};

	RoomMedia.prototype.getCurrentTime = function () {
		return this._getCurrentTime();
	};

	RoomMedia.prototype.getDuration = function () {
		return this._getDuration();
	};

	RoomMedia.prototype.setVolume = function (vol, broadcast) {
		this.volume = Math.max(0, Math.min(1, vol));
		this.audio.volume = this.volume;
		this.video.volume = this.volume;
		if (this.ytPlayer && this.ytPlayer.setVolume) {
			try { this.ytPlayer.setVolume(Math.round(this.volume * 100)); } catch (e) {}
		}
		if (broadcast) this.sendSync("v|" + this.volume.toFixed(2));
	};

	RoomMedia.prototype.uploadFile = function (file) {
		var self = this;
		if (!file) return Promise.reject(new Error("No file selected"));
		var kind = kindFromName(file.name);
		var title = clampTitle(file.name.replace(/\.[^.]+$/, ""));

		return initMediaServer().then(function (base) {
			if (!base) {
				throw new Error("Media server not running. Run: python media-server.py 8551\nOr double-click run-servers.bat");
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
						throw new Error(
							"File too large for the server (413). " +
							"On nginx add: client_max_body_size 80m; then reload nginx."
						);
					}
					var data = res.data;
					if (!data.ok) throw new Error(data.error || "Upload failed (" + res.status + ")");
					var playUrl = data.absUrl || resolveMediaUrl(data.url);
					return {
						url: playUrl,
						title: title,
						kind: data.kind || kind,
						serverHosted: true
					};
				});
		});
	};

	RoomMedia.prototype.loadFromUrl = function (rawUrl, titleHint) {
		var url = (rawUrl || "").trim();
		if (!url) throw new Error("Enter a URL or choose a file");
		var ytId = parseYouTubeId(url);
		if (ytId) {
			var title = clampTitle(titleHint || (isYouTubeShortUrl(url) ? "YouTube Short" : "YouTube Video"));
			this.djName = (this.ownParticipant() && this.ownParticipant().name) || "You";
			this.djId = this.client.participantId;
			this._loadRemote(url, title, "youtube");
			return {
				url: youtubeStorageId(ytId),
				shareUrl: url,
				title: title,
				kind: "youtube"
			};
		}
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
		url = resolveMediaUrl(url);
		this.sendSync("l|" + encodePart(url) + "|" + encodePart(title) + "|" + kindToCode(kind));
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
		this._setCurrentTime(Math.max(0, sec));
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
		var pos = this._getCurrentTime();
		var shareUrl = this.kind === "youtube" ? (this.ytShareUrl || this.url) : resolveMediaUrl(this.url);
		this.sendSync(
			"st|" + encodePart(shareUrl) + "|" + encodePart(this.title) + "|" +
			kindToCode(this.kind) + "|" + playing + "|" + pos.toFixed(2) + "|" + this.serverTime()
		);
	};

	RoomMedia.prototype.loadAndShare = function (file) {
		var self = this;
		this.onStatus("Uploading " + (file.name || "file") + "…");
		return this.uploadFile(file).then(function (info) {
			self.loadFromUrl(info.url, info.title);
			self._setActiveElement(info.kind);
			self.shareLoad(info.url, info.title, info.kind);
			return info;
		});
	};

	RoomMedia.prototype.loadUrlAndShare = function (url, title) {
		var info = this.loadFromUrl(url, title);
		this.shareLoad(info.shareUrl || info.url, info.title, info.kind);
		return info;
	};

	global.RoomMedia = RoomMedia;
})(typeof window !== "undefined" ? window : this);
