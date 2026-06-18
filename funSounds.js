/**
 * FunSounds — a shared, asset-free WebAudio engine for the goofy sound effects
 * the fun toys make (Blob Friend, Emoji Party, Party Game, Pixel Pet, Useless
 * Button, Doodler, prank modules). Everything is synthesized on the fly so no
 * audio files are needed, and it reuses one AudioContext for the whole page.
 *
 * Usage from anywhere:
 *     window.funSound("pop");
 *     window.funSound("boom", { gain: 0.8 });
 *
 * Browsers only allow audio after a user gesture, so the context is unlocked on
 * the first pointer/key/touch and resumed defensively before every sound. Sounds
 * triggered by the network (e.g. a friend pops a blob) therefore become audible
 * as soon as you've interacted with the page at all.
 */
(function (global) {
	"use strict";

	function FunSounds() {
		this.ctx = null;
		this.master = null;
		this.muted = false;
		try { this.muted = global.localStorage && localStorage.funSoundsMuted === "1"; } catch (e) {}
		this._lastAt = Object.create(null);
		this._bindUnlock();
	}

	FunSounds.prototype._bindUnlock = function () {
		var self = this;
		var unlock = function () { self._audio(); };
		var opts = { passive: true };
		if (global.addEventListener) {
			["pointerdown", "mousedown", "keydown", "touchstart"].forEach(function (ev) {
				global.addEventListener(ev, unlock, opts);
			});
		}
	};

	FunSounds.prototype._audio = function () {
		if (!this.ctx) {
			var AC = global.AudioContext || global.webkitAudioContext;
			if (!AC) return null;
			try { this.ctx = new AC(); } catch (e) { return null; }
			this.master = this.ctx.createGain();
			this.master.gain.value = this.muted ? 0 : 0.9;
			this.master.connect(this.ctx.destination);
		}
		if (this.ctx.state === "suspended") { try { this.ctx.resume(); } catch (e) {} }
		return this.ctx;
	};

	FunSounds.prototype.setMuted = function (on) {
		this.muted = !!on;
		try { localStorage.funSoundsMuted = this.muted ? "1" : "0"; } catch (e) {}
		if (this.master) this.master.gain.value = this.muted ? 0 : 0.9;
		return this.muted;
	};
	FunSounds.prototype.toggleMuted = function () { return this.setMuted(!this.muted); };
	FunSounds.prototype.isMuted = function () { return this.muted; };

	// ---- low-level synthesis helpers ------------------------------------

	FunSounds.prototype._dest = function () { return this.master || this.ctx.destination; };

	FunSounds.prototype._tone = function (type, freq, t0, dur, gain, glideTo) {
		var ctx = this.ctx;
		var osc = ctx.createOscillator();
		var g = ctx.createGain();
		osc.type = type;
		osc.frequency.setValueAtTime(freq, t0);
		if (glideTo) {
			try { osc.frequency.exponentialRampToValueAtTime(Math.max(20, glideTo), t0 + dur); }
			catch (e) { osc.frequency.linearRampToValueAtTime(Math.max(20, glideTo), t0 + dur); }
		}
		g.gain.setValueAtTime(0.0001, t0);
		g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t0 + 0.012);
		g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
		osc.connect(g); g.connect(this._dest());
		osc.start(t0); osc.stop(t0 + dur + 0.05);
		return osc;
	};

	FunSounds.prototype._noise = function (t0, dur, gain, filtType, filtFreq, q) {
		var ctx = this.ctx;
		var len = Math.max(1, Math.floor(ctx.sampleRate * dur));
		var buf = ctx.createBuffer(1, len, ctx.sampleRate);
		var data = buf.getChannelData(0);
		for (var i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
		var src = ctx.createBufferSource();
		src.buffer = buf;
		var filt = ctx.createBiquadFilter();
		filt.type = filtType || "bandpass";
		filt.frequency.value = filtFreq || 1200;
		if (q) filt.Q.value = q;
		var g = ctx.createGain();
		g.gain.setValueAtTime(0.0001, t0);
		g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t0 + 0.012);
		g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
		src.connect(filt); filt.connect(g); g.connect(this._dest());
		src.start(t0); src.stop(t0 + dur + 0.02);
		return g;
	};

	// ---- public API -----------------------------------------------------

	// play(name, opts?) — opts.gain scales the effect, opts.throttle (ms) drops
	// repeats fired too close together (handy for rapid/continuous toys).
	FunSounds.prototype.play = function (name, opts) {
		opts = opts || {};
		if (this.muted) return;
		var ctx = this._audio();
		if (!ctx) return;
		var now = (global.performance && performance.now) ? performance.now() : new Date().getTime();
		if (opts.throttle) {
			var last = this._lastAt[name] || 0;
			if (now - last < opts.throttle) return;
		}
		this._lastAt[name] = now;
		var fn = EFFECTS[name];
		if (!fn) return;
		var t = ctx.currentTime + 0.001;
		try { fn.call(this, t, opts.gain == null ? 1 : opts.gain); } catch (e) {}
	};

	// Each effect: (t0, k) where k is a gain multiplier.
	var EFFECTS = {
		// bubble pop — blob spawn, emoji launch
		pop: function (t, k) {
			this._tone("sine", 420, t, 0.12, 0.25 * k, 900);
			this._noise(t, 0.05, 0.05 * k, "bandpass", 1400, 1);
		},
		// wet splat pop — blob pop
		splat: function (t, k) {
			this._tone("triangle", 700, t, 0.16, 0.28 * k, 120);
			this._noise(t, 0.12, 0.12 * k, "lowpass", 900);
		},
		// cartoon boing — poke / bounce
		boing: function (t, k) {
			this._tone("sine", 620, t, 0.42, 0.3 * k, 90);
			this._tone("triangle", 300, t, 0.42, 0.14 * k, 60);
		},
		// twinkle arpeggio — confetti / celebration
		sparkle: function (t, k) {
			var notes = [784, 988, 1175, 1568];
			for (var i = 0; i < notes.length; i++) this._tone("triangle", notes[i], t + i * 0.05, 0.3, 0.16 * k);
			this._noise(t + 0.18, 0.4, 0.05 * k, "highpass", 6000);
		},
		// falling shimmer — emoji rain
		shower: function (t, k) {
			for (var i = 0; i < 6; i++) this._tone("sine", 1400 - i * 120, t + i * 0.06, 0.18, 0.1 * k, 700);
		},
		// mario-ish coin — feed pet / catch button
		coin: function (t, k) {
			this._tone("square", 988, t, 0.08, 0.2 * k);
			this._tone("square", 1319, t + 0.08, 0.3, 0.2 * k);
		},
		// happy chirp — pet greeting
		chirp: function (t, k) {
			this._tone("sine", 700, t, 0.1, 0.2 * k, 1200);
			this._tone("sine", 1200, t + 0.09, 0.12, 0.18 * k, 1500);
		},
		// nom nom — pet eating
		nom: function (t, k) {
			for (var i = 0; i < 3; i++) this._tone("square", 180 + i * 10, t + i * 0.09, 0.07, 0.16 * k, 120);
		},
		// whoosh — pass / dodge / throw
		whoosh: function (t, k) {
			this._noise(t, 0.22, 0.16 * k, "bandpass", 700, 0.7);
			this._tone("sine", 500, t, 0.2, 0.06 * k, 180);
		},
		// fuse light — bomb start
		fuse: function (t, k) {
			this._noise(t, 0.5, 0.07 * k, "highpass", 4000);
			this._tone("sine", 240, t, 0.3, 0.12 * k, 520);
		},
		// single tick — bomb countdown (throttle this)
		tick: function (t, k) {
			this._tone("square", 1500, t, 0.04, 0.14 * k);
			this._noise(t, 0.03, 0.05 * k, "highpass", 3000);
		},
		// big boom — explosion
		boom: function (t, k) {
			this._tone("sine", 120, t, 0.6, 0.4 * k, 40);
			this._noise(t, 0.45, 0.4 * k, "lowpass", 600);
			this._noise(t, 0.18, 0.25 * k, "bandpass", 1800);
		},
		// celebratory fanfare — win / ta-da
		fanfare: function (t, k) {
			var arp = [523, 659, 784, 1047];
			for (var i = 0; i < arp.length; i++) this._tone("triangle", arp[i], t + i * 0.08, 0.5, 0.18 * k);
			this._noise(t + 0.32, 0.5, 0.07 * k, "highpass", 5000);
		},
		// quirky blip — useless button / ui
		blip: function (t, k) {
			this._tone("square", 880, t, 0.07, 0.16 * k, 1320);
		},
		// soft pencil scratch — doodling
		scribble: function (t, k) {
			this._noise(t, 0.05, 0.05 * k, "bandpass", 2200, 1.5);
		},
		// spooky descending wobble — evil cursor / chaos
		spooky: function (t, k) {
			this._tone("sawtooth", 320, t, 0.5, 0.16 * k, 110);
			this._tone("sine", 160, t, 0.5, 0.1 * k, 70);
		},
		// goofy monkey screech — chaos monkey
		monkey: function (t, k) {
			for (var i = 0; i < 5; i++) {
				var f = 600 + (i % 2 ? 250 : 0) + i * 40;
				this._tone("sawtooth", f, t + i * 0.07, 0.08, 0.12 * k, f * 1.4);
			}
		}
	};

	FunSounds.EFFECTS = EFFECTS;

	// Singleton + tiny convenience wrapper.
	var instance = new FunSounds();
	global.FunSounds = FunSounds;
	global.gFunSounds = instance;
	global.funSound = function (name, opts) { instance.play(name, opts); };
})(typeof window !== "undefined" ? window : this);
