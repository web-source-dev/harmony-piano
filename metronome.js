/**
 * Web Audio metronome with lookahead scheduling, tap tempo, and visual beat callbacks.
 */
(function (global) {
	"use strict";

	var STORAGE_KEY = "harmonyMetronome";
	var SCHEDULE_AHEAD = 0.12;
	var LOOKAHEAD_MS = 25;

	var TIME_SIGS = [
		{ label: "2/4", beats: 2 },
		{ label: "3/4", beats: 3 },
		{ label: "4/4", beats: 4 },
		{ label: "5/4", beats: 5 },
		{ label: "6/8", beats: 6 },
		{ label: "7/8", beats: 7 }
	];

	var SOUNDS = ["click", "wood", "beep", "hihat"];

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
		this.currentBeat = 0;
		this.tickIndex = 0;
		this.timerId = null;
		this.outputGain = null;
		this.tapTimes = [];
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
			this.outputGain.gain.value = this.volume;
			this.outputGain.connect(ctx.destination);
		}
		this.outputGain.gain.value = this.volume;
		return this.outputGain;
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
		var beatSec = 60 / this.bpm;
		return beatSec / this.subdivision;
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
		var beatTick = Math.floor(tickIndex / this.subdivision);
		return beatTick % this.beatsPerBar;
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
		if (sound === "wood") {
			freq = accent ? 900 : 650;
		} else if (sound === "beep") {
			freq = accent ? 880 : 660;
		}

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

	Metronome.prototype.start = function () {
		var ctx = this._ctx();
		if (!ctx) return false;
		if (ctx.state === "suspended") ctx.resume();

		if (this.running) return true;

		var self = this;
		this.running = true;
		this.tickIndex = 0;
		this.currentBeat = 0;
		this.nextNoteTime = ctx.currentTime + 0.05;

		if (this.countIn > 0) {
			this.countingIn = true;
			var countTicks = this.countIn * this.beatsPerBar * this.subdivision;
			var savedCountIn = this.countIn;
			var countIdx = 0;
			var countStart = ctx.currentTime + 0.05;
			var interval = this._secondsPerTick();

			this.onCountIn({ bar: 1, totalBars: savedCountIn, beat: 0 });

			for (var i = 0; i < countTicks; i++) {
				(function (idx) {
					var t = countStart + idx * interval;
					var beatNum = Math.floor(idx / self.subdivision) % self.beatsPerBar;
					var barNum = Math.floor(idx / (self.beatsPerBar * self.subdivision)) + 1;
					setTimeout(function () {
						self.onCountIn({
							bar: barNum,
							totalBars: savedCountIn,
							beat: beatNum,
							ticksLeft: countTicks - idx - 1
						});
					}, Math.max(0, (t - ctx.currentTime) * 1000));
					self._playClick(t, idx % self.subdivision === 0 && beatNum === 0);
				})(i);
				countIdx++;
			}

			this.nextNoteTime = countStart + countTicks * interval;
			this.tickIndex = 0;
			setTimeout(function () {
				self.countingIn = false;
				self.onCountIn(null);
			}, (this.nextNoteTime - ctx.currentTime) * 1000 + 20);
		} else {
			this.countingIn = false;
		}

		this._startLoop();
		this.onStateChange({ running: true });
		return true;
	};

	Metronome.prototype.stop = function () {
		this.running = false;
		this.countingIn = false;
		this._stopLoop();
		this.onCountIn(null);
		this.onBeat({ stopped: true });
		this.onStateChange({ running: false });
	};

	Metronome.prototype.toggle = function () {
		if (this.running) {
			this.stop();
			return false;
		}
		this.start();
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

	Metronome.TIME_SIGS = TIME_SIGS;
	Metronome.SOUNDS = SOUNDS;

	global.Metronome = Metronome;
})(typeof window !== "undefined" ? window : this);
