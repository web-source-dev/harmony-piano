/**
 * Web Audio metronome with lookahead scheduling, tap tempo, and room sync.
 */
(function (global) {
	"use strict";

	var STORAGE_KEY = "harmonyMetronome";
	var SYNC_PREFIX = "MT|";
	var SCHEDULE_AHEAD = 0.12;
	var LOOKAHEAD_MS = 25;
	var START_BUFFER_MS = 450;

	var TIME_SIGS = [
		{ label: "2/4", beats: 2 },
		{ label: "3/4", beats: 3 },
		{ label: "4/4", beats: 4 },
		{ label: "5/4", beats: 5 },
		{ label: "6/8", beats: 6 },
		{ label: "7/8", beats: 7 }
	];

	var SOUNDS = ["click", "wood", "beep", "hihat"];
	var SOUND_CODES = { click: "c", wood: "w", beep: "b", hihat: "h" };
	var CODE_SOUNDS = { c: "click", w: "wood", b: "beep", h: "hihat" };

	function clamp(n, lo, hi) {
		return Math.max(lo, Math.min(hi, n));
	}

	function loadSettings() {
		var defaults = {
			bpm: 120,
			timeSig: 4,
			subdivision: 1,
			sound: "click",
			volume: 0.7,
			countIn: 0,
			accentBeat1: true
		};
		try {
			if (global.localStorage && localStorage.getItem(STORAGE_KEY)) {
				var saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
				for (var k in saved) {
					if (saved.hasOwnProperty(k)) defaults[k] = saved[k];
				}
			}
		} catch (e) { /* ignore */ }
		defaults.bpm = clamp(Math.round(defaults.bpm), 20, 300);
		defaults.volume = clamp(+defaults.volume, 0, 1);
		defaults.subdivision = clamp(Math.round(defaults.subdivision), 1, 4);
		defaults.countIn = clamp(Math.round(defaults.countIn), 0, 4);
		if (TIME_SIGS.every(function (t) { return t.beats !== defaults.timeSig; })) {
			defaults.timeSig = 4;
		}
		if (SOUNDS.indexOf(defaults.sound) < 0) defaults.sound = "click";
		return defaults;
	}

	function saveSettings(state) {
		try {
			if (global.localStorage) {
				localStorage.setItem(STORAGE_KEY, JSON.stringify({
					bpm: state.bpm,
					timeSig: state.beatsPerBar,
					subdivision: state.subdivision,
					sound: state.sound,
					volume: state.volume,
					countIn: state.countIn,
					accentBeat1: state.accentBeat1
				}));
			}
		} catch (e) { /* ignore */ }
	}

	function encodePart(s) {
		return encodeURIComponent(s || "");
	}

	function decodePart(s) {
		try { return decodeURIComponent(s); } catch (e) { return s; }
	}

	function Metronome(opts) {
		opts = opts || {};
		this.getContext = opts.getContext || function () { return null; };
		this.onBeat = opts.onBeat || function () {};
		this.onStateChange = opts.onStateChange || function () {};
		this.onCountIn = opts.onCountIn || function () {};

		var s = loadSettings();
		this.bpm = s.bpm;
		this.beatsPerBar = s.timeSig;
		this.subdivision = s.subdivision;
		this.sound = s.sound;
		this.volume = s.volume;
		this.countIn = s.countIn;
		this.accentBeat1 = s.accentBeat1;

		this.running = false;
		this.countingIn = false;
		this.nextNoteTime = 0;
		this.tickIndex = 0;
		this.timerId = null;
		this.outputGain = null;
		this.tapTimes = [];
		this.countInTimers = [];
		this.mainAnchorServerMs = 0;
		this.roomSynced = false;
	}

	Metronome.prototype._ctx = function () {
		var ctx = this.getContext();
		return ctx && ctx.state !== "closed" ? ctx : null;
	};

	Metronome.prototype._ensureOutput = function () {
		var ctx = this._ctx();
		if (!ctx) return null;
		if (!this.outputGain) {
			this.outputGain = ctx.createGain();
			this.outputGain.connect(ctx.destination);
		}
		this.outputGain.gain.value = this.volume;
		return this.outputGain;
	};

	Metronome.prototype._clearCountInTimers = function () {
		for (var i = 0; i < this.countInTimers.length; i++) {
			clearTimeout(this.countInTimers[i]);
		}
		this.countInTimers = [];
	};

	Metronome.prototype.getSettings = function () {
		return {
			bpm: this.bpm,
			beatsPerBar: this.beatsPerBar,
			subdivision: this.subdivision,
			sound: this.sound,
			volume: this.volume,
			countIn: this.countIn,
			accentBeat1: this.accentBeat1
		};
	};

	Metronome.prototype.applySettings = function (settings, persist) {
		if (!settings) return;
		if (settings.bpm != null) this.bpm = clamp(Math.round(+settings.bpm), 20, 300);
		if (settings.beatsPerBar != null) this.beatsPerBar = clamp(Math.round(+settings.beatsPerBar), 1, 12);
		if (settings.subdivision != null) this.subdivision = clamp(Math.round(+settings.subdivision), 1, 4);
		if (settings.sound != null && SOUNDS.indexOf(settings.sound) >= 0) this.sound = settings.sound;
		if (settings.volume != null) this.volume = clamp(+settings.volume, 0, 1);
		if (settings.countIn != null) this.countIn = clamp(Math.round(+settings.countIn), 0, 4);
		if (settings.accentBeat1 != null) this.accentBeat1 = !!settings.accentBeat1;
		if (this.outputGain) this.outputGain.gain.value = this.volume;
		if (persist !== false) this._persist();
	};

	Metronome.prototype.setVolume = function (v) {
		this.volume = clamp(+v, 0, 1);
		if (this.outputGain) this.outputGain.gain.value = this.volume;
		this._persist();
	};

	Metronome.prototype.setBpm = function (bpm) {
		this.bpm = clamp(Math.round(+bpm), 20, 300);
		this._persist();
	};

	Metronome.prototype.setBeatsPerBar = function (n) {
		this.beatsPerBar = clamp(Math.round(+n), 1, 12);
		this._persist();
	};

	Metronome.prototype.setSubdivision = function (n) {
		this.subdivision = clamp(Math.round(+n), 1, 4);
		this._persist();
	};

	Metronome.prototype.setSound = function (name) {
		if (SOUNDS.indexOf(name) >= 0) this.sound = name;
		this._persist();
	};

	Metronome.prototype.setCountIn = function (bars) {
		this.countIn = clamp(Math.round(+bars), 0, 4);
		this._persist();
	};

	Metronome.prototype.setAccentBeat1 = function (on) {
		this.accentBeat1 = !!on;
		this._persist();
	};

	Metronome.prototype._persist = function () {
		saveSettings(this);
	};

	Metronome.prototype._secondsPerTick = function () {
		return (60 / this.bpm) / this.subdivision;
	};

	Metronome.prototype._msPerTick = function () {
		return this._secondsPerTick() * 1000;
	};

	Metronome.prototype._countInDurationMs = function () {
		if (!this.countIn) return 0;
		return this.countIn * this.beatsPerBar * this.subdivision * this._msPerTick();
	};

	Metronome.prototype._isAccentTick = function (tickIndex) {
		if (!this.accentBeat1) return false;
		if (this.subdivision <= 1) return tickIndex % this.beatsPerBar === 0;
		return tickIndex % (this.beatsPerBar * this.subdivision) === 0;
	};

	Metronome.prototype._isBeatTick = function (tickIndex) {
		return tickIndex % this.subdivision === 0;
	};

	Metronome.prototype._beatInBar = function (tickIndex) {
		return Math.floor(tickIndex / this.subdivision) % this.beatsPerBar;
	};

	Metronome.prototype._playClick = function (time, accent) {
		var ctx = this._ctx();
		var dest = this._ensureOutput();
		if (!ctx || !dest || this.volume <= 0) return;

		var vol = this.volume * (accent ? 1 : 0.55);
		var sound = this.sound;

		if (sound === "hihat") {
			var bufferSize = ctx.sampleRate * 0.04;
			var buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
			var data = buffer.getChannelData(0);
			for (var i = 0; i < bufferSize; i++) {
				data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
			}
			var src = ctx.createBufferSource();
			src.buffer = buffer;
			var filter = ctx.createBiquadFilter();
			filter.type = "highpass";
			filter.frequency.value = accent ? 7000 : 5500;
			var gain = ctx.createGain();
			gain.gain.setValueAtTime(vol * 0.35, time);
			gain.gain.exponentialRampToValueAtTime(0.001, time + 0.04);
			src.connect(filter);
			filter.connect(gain);
			gain.connect(dest);
			src.start(time);
			src.stop(time + 0.05);
			return;
		}

		var freq = accent ? 1800 : 1100;
		if (sound === "wood") freq = accent ? 900 : 650;
		else if (sound === "beep") freq = accent ? 880 : 660;

		var osc = ctx.createOscillator();
		osc.type = sound === "beep" ? "sine" : "triangle";
		osc.frequency.setValueAtTime(freq, time);

		var gainNode = ctx.createGain();
		gainNode.gain.setValueAtTime(0.0001, time);
		gainNode.gain.exponentialRampToValueAtTime(Math.max(vol, 0.0001), time + 0.002);
		gainNode.gain.exponentialRampToValueAtTime(0.0001, time + (sound === "beep" ? 0.08 : 0.045));

		osc.connect(gainNode);
		gainNode.connect(dest);
		osc.start(time);
		osc.stop(time + 0.1);
	};

	Metronome.prototype._scheduleTick = function (time, tickIndex) {
		var accent = this._isAccentTick(tickIndex);
		var isBeat = this._isBeatTick(tickIndex);
		var beatInBar = this._beatInBar(tickIndex);
		this._playClick(time, accent);
		var self = this;
		var delayMs = Math.max(0, (time - this._ctx().currentTime) * 1000);
		setTimeout(function () {
			self.onBeat({
				tickIndex: tickIndex,
				beatInBar: beatInBar,
				beatsPerBar: self.beatsPerBar,
				accent: accent,
				isBeat: isBeat,
				countingIn: self.countingIn
			});
		}, delayMs);
	};

	Metronome.prototype._scheduler = function () {
		var ctx = this._ctx();
		if (!ctx || !this.running) return;

		while (this.nextNoteTime < ctx.currentTime + SCHEDULE_AHEAD) {
			this._scheduleTick(this.nextNoteTime, this.tickIndex);
			this.tickIndex++;
			this.nextNoteTime += this._secondsPerTick();
		}
	};

	Metronome.prototype._startLoop = function () {
		var self = this;
		if (this.timerId) clearInterval(this.timerId);
		this.timerId = setInterval(function () {
			self._scheduler();
		}, LOOKAHEAD_MS);
	};

	Metronome.prototype._stopLoop = function () {
		if (this.timerId) {
			clearInterval(this.timerId);
			this.timerId = null;
		}
	};

	Metronome.prototype._beginCountInAt = function (audioStart) {
		var ctx = this._ctx();
		var self = this;
		this.countingIn = true;
		var countTicks = this.countIn * this.beatsPerBar * this.subdivision;
		var interval = this._secondsPerTick();

		this.onCountIn({ bar: 1, totalBars: this.countIn, beat: 0 });

		for (var i = 0; i < countTicks; i++) {
			(function (idx) {
				var t = audioStart + idx * interval;
				var beatNum = Math.floor(idx / self.subdivision) % self.beatsPerBar;
				var barNum = Math.floor(idx / (self.beatsPerBar * self.subdivision)) + 1;
				var timer = setTimeout(function () {
					self.onCountIn({
						bar: barNum,
						totalBars: self.countIn,
						beat: beatNum,
						ticksLeft: countTicks - idx - 1
					});
				}, Math.max(0, (t - ctx.currentTime) * 1000));
				self.countInTimers.push(timer);
				self._playClick(t, idx % self.subdivision === 0 && beatNum === 0);
			})(i);
		}

		this.nextNoteTime = audioStart + countTicks * interval;
		this.tickIndex = 0;
		var endAt = this.nextNoteTime;
		var endTimer = setTimeout(function () {
			self.countingIn = false;
			self.onCountIn(null);
		}, Math.max(0, (endAt - ctx.currentTime) * 1000 + 20));
		this.countInTimers.push(endTimer);
	};

	Metronome.prototype.startSynced = function (countInStartServerMs, mainAnchorServerMs, serverTimeFn, synced) {
		var ctx = this._ctx();
		if (!ctx) return false;
		if (ctx.state === "suspended") ctx.resume();
		if (this.running) this.stop(false);

		var nowServer = serverTimeFn();
		var delayMs = countInStartServerMs - nowServer;
		if (delayMs < -8000) {
			return this.joinRunning(mainAnchorServerMs, serverTimeFn, synced);
		}
		if (delayMs < 0) delayMs = 0;

		var audioStart = ctx.currentTime + delayMs / 1000;
		this.running = true;
		this.roomSynced = !!synced;
		this.mainAnchorServerMs = mainAnchorServerMs;
		this.tickIndex = 0;

		if (this.countIn > 0) {
			this._beginCountInAt(audioStart);
		} else {
			this.countingIn = false;
			this.nextNoteTime = audioStart;
		}

		this._startLoop();
		this.onStateChange({ running: true, synced: !!synced });
		return true;
	};

	Metronome.prototype.joinRunning = function (mainAnchorServerMs, serverTimeFn, synced) {
		var ctx = this._ctx();
		if (!ctx) return false;
		if (ctx.state === "suspended") ctx.resume();
		if (this.running) this.stop(false);

		var nowServer = serverTimeFn();
		var msPerTick = this._msPerTick();
		var elapsed = nowServer - mainAnchorServerMs;

		if (elapsed < -5000) {
			return this.startSynced(mainAnchorServerMs, mainAnchorServerMs, serverTimeFn, synced);
		}

		var tickIndex = Math.max(0, Math.floor(elapsed / msPerTick));
		var nextTickServer = mainAnchorServerMs + (tickIndex + 1) * msPerTick;
		var delayMs = nextTickServer - nowServer;
		if (delayMs < 0) delayMs = 0;

		this.running = true;
		this.roomSynced = !!synced;
		this.mainAnchorServerMs = mainAnchorServerMs;
		this.countingIn = false;
		this.tickIndex = tickIndex + 1;
		this.nextNoteTime = ctx.currentTime + delayMs / 1000;

		this._startLoop();
		this.onStateChange({ running: true, synced: !!synced, joined: true });
		return true;
	};

	Metronome.prototype.start = function (localOnly) {
		var ctx = this._ctx();
		if (!ctx) return false;
		if (ctx.state === "suspended") ctx.resume();
		if (this.running) return true;

		var countInStart = Date.now() + START_BUFFER_MS;
		return this.startSynced(countInStart, countInStart + this._countInDurationMs(), function () {
			return Date.now();
		}, !localOnly && false);
	};

	Metronome.prototype.stop = function (emit) {
		if (emit === undefined) emit = true;
		this.running = false;
		this.countingIn = false;
		this.roomSynced = false;
		this.mainAnchorServerMs = 0;
		this._stopLoop();
		this._clearCountInTimers();
		if (emit) {
			this.onCountIn(null);
			this.onBeat({ stopped: true });
			this.onStateChange({ running: false });
		}
	};

	Metronome.prototype.toggle = function () {
		if (this.running) {
			this.stop();
			return false;
		}
		this.start(true);
		return true;
	};

	Metronome.prototype.tap = function () {
		var now = Date.now();
		this.tapTimes.push(now);
		if (this.tapTimes.length > 8) this.tapTimes.shift();

		if (this.tapTimes.length >= 2) {
			var intervals = [];
			for (var i = 1; i < this.tapTimes.length; i++) {
				intervals.push(this.tapTimes[i] - this.tapTimes[i - 1]);
			}
			var avg = intervals.reduce(function (a, b) { return a + b; }, 0) / intervals.length;
			if (avg >= 200 && avg <= 3000) {
				this.setBpm(Math.round(60000 / avg));
				return this.bpm;
			}
		}
		return null;
	};

	Metronome.prototype.nudgeBpm = function (delta) {
		this.setBpm(this.bpm + delta);
		return this.bpm;
	};

	Metronome.prototype.applyFromGuide = function (bpm) {
		if (!bpm || bpm < 20 || bpm > 300) return false;
		this.setBpm(bpm);
		return true;
	};

	function RoomMetronomeSync(opts) {
		this.client = opts.client;
		this.metronome = opts.metronome;
		this.onRoomState = opts.onRoomState || function () {};
		this.ownerId = null;
		this.ownerName = "";
		this.countInStartServerMs = 0;
		this.mainAnchorServerMs = 0;
		this.ignoreSelfUntil = 0;
	}

	RoomMetronomeSync.SYNC_PREFIX = SYNC_PREFIX;
	RoomMetronomeSync.START_BUFFER_MS = START_BUFFER_MS;

	RoomMetronomeSync.prototype.serverTime = function () {
		return Date.now() + (this.client.serverTimeOffset || 0);
	};

	RoomMetronomeSync.prototype.isSyncText = function (text) {
		return !!(text && typeof text === "string" && text.indexOf(SYNC_PREFIX) === 0);
	};

	RoomMetronomeSync.prototype.canControl = function () {
		if (!this.client.isConnected()) return true;
		return this.client.hasCrown();
	};

	RoomMetronomeSync.prototype.isRoomMode = function () {
		return this.client.isConnected();
	};

	RoomMetronomeSync.prototype.sendSync = function (payload) {
		if (!this.client.isConnected()) return;
		var msg = SYNC_PREFIX + payload;
		if (msg.length > 512) return;
		this.ignoreSelfUntil = Date.now() + 500;
		this.client.sendArray([{ m: "a", message: msg }]);
	};

	RoomMetronomeSync.prototype._settingsPayload = function () {
		var m = this.metronome;
		return [
			m.bpm,
			m.beatsPerBar,
			m.subdivision,
			SOUND_CODES[m.sound] || "c",
			m.accentBeat1 ? "1" : "0",
			m.countIn
		].join("|");
	};

	RoomMetronomeSync.prototype._parseSettings = function (parts, offset) {
		offset = offset || 0;
		return {
			bpm: parseInt(parts[offset], 10),
			beatsPerBar: parseInt(parts[offset + 1], 10),
			subdivision: parseInt(parts[offset + 2], 10),
			sound: CODE_SOUNDS[parts[offset + 3]] || "click",
			accentBeat1: parts[offset + 4] === "1",
			countIn: parseInt(parts[offset + 5], 10)
		};
	};

	RoomMetronomeSync.prototype._emitRoomState = function () {
		this.onRoomState({
			running: this.metronome.running,
			ownerId: this.ownerId,
			ownerName: this.ownerName,
			canControl: this.canControl(),
			roomMode: this.isRoomMode()
		});
	};

	RoomMetronomeSync.prototype.startRoom = function () {
		if (!this.canControl()) return false;
		ensureAudioContext(this.metronome);

		var m = this.metronome;
		var countInStart = this.serverTime() + START_BUFFER_MS;
		var mainAnchor = countInStart + m._countInDurationMs();

		if (this.isRoomMode()) {
			this.ownerId = this.client.participantId;
			var me = this.client.getOwnParticipant();
			this.ownerName = (me && me.name) || "Host";
			this.countInStartServerMs = countInStart;
			this.mainAnchorServerMs = mainAnchor;
			this.sendSync("s|" + countInStart + "|" + mainAnchor + "|" + this._settingsPayload());
		}

		m.startSynced(countInStart, mainAnchor, this.serverTime.bind(this), this.isRoomMode());
		this._emitRoomState();
		return true;
	};

	RoomMetronomeSync.prototype.stopRoom = function () {
		if (this.isRoomMode() && !this.canControl()) return false;
		if (this.isRoomMode() && this.canControl()) {
			this.sendSync("x");
		}
		this.ownerId = null;
		this.ownerName = "";
		this.countInStartServerMs = 0;
		this.mainAnchorServerMs = 0;
		this.metronome.stop();
		this._emitRoomState();
		return true;
	};

	RoomMetronomeSync.prototype.requestSync = function () {
		if (!this.client.isConnected()) return;
		this.sendSync("q");
	};

	RoomMetronomeSync.prototype._replyState = function () {
		if (!this.canControl() || !this.metronome.running) {
			this.sendSync("st|0");
			return;
		}
		this.sendSync(
			"st|1|" + this.countInStartServerMs + "|" + this.mainAnchorServerMs + "|" +
			this._settingsPayload() + "|" + encodePart(this.ownerName || "Host")
		);
	};

	RoomMetronomeSync.prototype.tryHandleChat = function (msg) {
		var text = msg.a != null ? msg.a : (msg.message != null ? msg.message : "");
		if (!this.isSyncText(text)) return false;

		var payload = text.slice(SYNC_PREFIX.length);
		var parts = payload.split("|");
		var cmd = parts[0];
		var me = this.client.getOwnParticipant();

		if (me && msg.p && msg.p._id === me._id && Date.now() < this.ignoreSelfUntil) {
			return true;
		}

		ensureAudioContext(this.metronome);

		if (cmd === "s") {
			var countInStart = parseFloat(parts[1]) || 0;
			var mainAnchor = parseFloat(parts[2]) || countInStart;
			var settings = this._parseSettings(parts, 3);
			this.metronome.applySettings(settings, false);
			this.ownerId = msg.p && msg.p.id;
			this.ownerName = (msg.p && msg.p.name) || "Host";
			this.countInStartServerMs = countInStart;
			this.mainAnchorServerMs = mainAnchor;
			this.metronome.startSynced(countInStart, mainAnchor, this.serverTime.bind(this), true);
			this._emitRoomState();
		} else if (cmd === "x") {
			this.ownerId = null;
			this.ownerName = "";
			this.countInStartServerMs = 0;
			this.mainAnchorServerMs = 0;
			this.metronome.stop();
			this._emitRoomState();
		} else if (cmd === "st") {
			if (parts[1] !== "1") {
				this.ownerId = null;
				this.ownerName = "";
				if (this.metronome.running) {
					this.metronome.stop();
					this._emitRoomState();
				}
				return true;
			}
			countInStart = parseFloat(parts[2]) || 0;
			mainAnchor = parseFloat(parts[3]) || countInStart;
			settings = this._parseSettings(parts, 4);
			this.metronome.applySettings(settings, false);
			this.ownerName = decodePart(parts[10]) || "Host";
			this.countInStartServerMs = countInStart;
			this.mainAnchorServerMs = mainAnchor;
			var now = this.serverTime();
			var countInEnd = countInStart + (settings.countIn > 0
				? settings.countIn * settings.beatsPerBar * settings.subdivision * (60000 / settings.bpm / settings.subdivision)
				: 0);
			if (settings.countIn > 0 && now < countInEnd - 20) {
				this.metronome.startSynced(countInStart, mainAnchor, this.serverTime.bind(this), true);
			} else {
				this.metronome.joinRunning(mainAnchor, this.serverTime.bind(this), true);
			}
			this._emitRoomState();
		} else if (cmd === "q") {
			if (me && msg.p && msg.p._id === me._id) return true;
			if (this.canControl()) this._replyState();
		}

		return true;
	};

	function ensureAudioContext(metronome) {
		var ctx = metronome._ctx();
		if (ctx && ctx.state === "suspended") ctx.resume();
	}

	Metronome.TIME_SIGS = TIME_SIGS;
	Metronome.SOUNDS = SOUNDS;
	Metronome.SYNC_PREFIX = SYNC_PREFIX;

	global.Metronome = Metronome;
	global.RoomMetronomeSync = RoomMetronomeSync;
})(typeof window !== "undefined" ? window : this);
