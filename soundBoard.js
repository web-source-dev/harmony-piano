/**
 * Sound Board — synced goofy sound effects, synthesized with WebAudio
 * (no asset files needed). When you hit a button, everyone in the room hears
 * it too. Room-synced via chat transport (SB| prefix).
 */
(function (global) {
	"use strict";

	var SYNC_PREFIX = "SB|";

	// id, emoji label, and synth function name
	var SOUNDS = [
		{ id: "horn", label: "📯 Airhorn" },
		{ id: "boing", label: "🤸 Boing" },
		{ id: "drum", label: "🥁 Drumroll" },
		{ id: "clap", label: "👏 Applause" },
		{ id: "womp", label: "📉 Sad womp" },
		{ id: "tada", label: "🎉 Ta-da!" },
		{ id: "laugh", label: "😂 Laugh" },
		{ id: "quack", label: "🦆 Quack" }
	];

	function SoundBoard(opts) {
		opts = opts || {};
		this.client = opts.client;
		this.sounds = SOUNDS;
		this.ctx = null;
		this.ignoreSelfUntil = 0;
	}

	SoundBoard.SYNC_PREFIX = SYNC_PREFIX;
	SoundBoard.SOUNDS = SOUNDS;

	SoundBoard.isSyncText = function (text) {
		return !!(text && typeof text === "string" && text.indexOf(SYNC_PREFIX) === 0);
	};

	SoundBoard.prototype._audio = function () {
		if (!this.ctx) {
			var AC = window.AudioContext || window.webkitAudioContext;
			if (!AC) return null;
			this.ctx = new AC();
		}
		if (this.ctx.state === "suspended") { try { this.ctx.resume(); } catch (e) {} }
		return this.ctx;
	};

	SoundBoard.prototype.sendSync = function (payload) {
		if (!this.client || !this.client.isConnected()) return;
		var msg = SYNC_PREFIX + payload;
		if (msg.length > 512) return;
		this.ignoreSelfUntil = Date.now() + 400;
		this.client.sendArray([{ m: "a", message: msg }]);
	};

	SoundBoard.prototype.tryHandleChat = function (msg) {
		var text = msg.a != null ? msg.a : (msg.message != null ? msg.message : "");
		if (!SoundBoard.isSyncText(text)) return false;
		var me = this.client.getOwnParticipant();
		if (me && msg.p && msg.p._id === me._id && Date.now() < this.ignoreSelfUntil) return true;
		var parts = text.slice(SYNC_PREFIX.length).split("|");
		if (parts[0] === "p") this.play(parts[1], true);
		return true;
	};

	// click a button → play locally and tell the room
	SoundBoard.prototype.trigger = function (id) {
		this.play(id, false);
		this.sendSync("p|" + id);
	};

	SoundBoard.prototype.play = function (id, fromNet) {
		var ctx = this._audio();
		if (!ctx) return;
		var t = ctx.currentTime;
		switch (id) {
			case "horn": this._horn(ctx, t); break;
			case "boing": this._boing(ctx, t); break;
			case "drum": this._drum(ctx, t); break;
			case "clap": this._clap(ctx, t); break;
			case "womp": this._womp(ctx, t); break;
			case "tada": this._tada(ctx, t); break;
			case "laugh": this._laugh(ctx, t); break;
			case "quack": this._quack(ctx, t); break;
		}
	};

	// ---- little synthesis helpers ---------------------------------------

	SoundBoard.prototype._tone = function (ctx, type, freq, t0, dur, gain, glideTo) {
		var osc = ctx.createOscillator();
		var g = ctx.createGain();
		osc.type = type;
		osc.frequency.setValueAtTime(freq, t0);
		if (glideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, glideTo), t0 + dur);
		g.gain.setValueAtTime(0.0001, t0);
		g.gain.exponentialRampToValueAtTime(gain, t0 + 0.02);
		g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
		osc.connect(g); g.connect(ctx.destination);
		osc.start(t0); osc.stop(t0 + dur + 0.05);
		return osc;
	};

	SoundBoard.prototype._noise = function (ctx, t0, dur, gain, filterFreq, type) {
		var len = Math.floor(ctx.sampleRate * dur);
		var buf = ctx.createBuffer(1, len, ctx.sampleRate);
		var data = buf.getChannelData(0);
		for (var i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
		var src = ctx.createBufferSource();
		src.buffer = buf;
		var filt = ctx.createBiquadFilter();
		filt.type = type || "bandpass";
		filt.frequency.value = filterFreq || 1200;
		var g = ctx.createGain();
		g.gain.setValueAtTime(0.0001, t0);
		g.gain.exponentialRampToValueAtTime(gain, t0 + 0.02);
		g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
		src.connect(filt); filt.connect(g); g.connect(ctx.destination);
		src.start(t0); src.stop(t0 + dur + 0.02);
		return g;
	};

	SoundBoard.prototype._horn = function (ctx, t) {
		// two detuned saws with quick repeated blasts
		var blasts = [0, 0.18, 0.36, 0.7];
		for (var i = 0; i < blasts.length; i++) {
			var t0 = t + blasts[i];
			var d = i === blasts.length - 1 ? 0.5 : 0.13;
			this._tone(ctx, "sawtooth", 415, t0, d, 0.2);
			this._tone(ctx, "sawtooth", 312, t0, d, 0.18);
		}
	};

	SoundBoard.prototype._boing = function (ctx, t) {
		this._tone(ctx, "sine", 600, t, 0.5, 0.3, 90);
		this._tone(ctx, "triangle", 300, t, 0.5, 0.15, 60);
	};

	SoundBoard.prototype._drum = function (ctx, t) {
		for (var i = 0; i < 22; i++) {
			this._noise(ctx, t + i * 0.045, 0.04, 0.18, 220, "lowpass");
		}
		// final hit
		this._noise(ctx, t + 1.0, 0.18, 0.4, 180, "lowpass");
		this._tone(ctx, "sine", 140, t + 1.0, 0.25, 0.3, 60);
	};

	SoundBoard.prototype._clap = function (ctx, t) {
		for (var i = 0; i < 60; i++) {
			this._noise(ctx, t + Math.random() * 1.4, 0.03, 0.06 + Math.random() * 0.05, 2500, "bandpass");
		}
	};

	SoundBoard.prototype._womp = function (ctx, t) {
		// classic sad trombone: four descending slurps
		var notes = [233, 207, 185, 155];
		for (var i = 0; i < notes.length; i++) {
			var t0 = t + i * 0.28;
			this._tone(ctx, "sawtooth", notes[i] * 1.15, t0, 0.3, 0.22, notes[i]);
		}
	};

	SoundBoard.prototype._tada = function (ctx, t) {
		var arp = [523, 659, 784, 1047];
		for (var i = 0; i < arp.length; i++) {
			this._tone(ctx, "triangle", arp[i], t + i * 0.08, 0.5, 0.18);
		}
		this._noise(ctx, t + 0.32, 0.5, 0.08, 5000, "highpass");
	};

	SoundBoard.prototype._laugh = function (ctx, t) {
		// bouncy "ha ha ha" with wobbling pitch
		for (var i = 0; i < 6; i++) {
			var t0 = t + i * 0.13;
			var f = 300 + (i % 2 ? 60 : 0);
			this._tone(ctx, "square", f, t0, 0.1, 0.12, f * 0.7);
		}
	};

	SoundBoard.prototype._quack = function (ctx, t) {
		var osc = ctx.createOscillator();
		var g = ctx.createGain();
		osc.type = "sawtooth";
		osc.frequency.setValueAtTime(280, t);
		osc.frequency.linearRampToValueAtTime(180, t + 0.18);
		var filt = ctx.createBiquadFilter();
		filt.type = "bandpass"; filt.frequency.value = 900; filt.Q.value = 6;
		g.gain.setValueAtTime(0.0001, t);
		g.gain.exponentialRampToValueAtTime(0.3, t + 0.03);
		g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
		osc.connect(filt); filt.connect(g); g.connect(ctx.destination);
		osc.start(t); osc.stop(t + 0.25);
	};

	global.SoundBoard = SoundBoard;
})(typeof window !== "undefined" ? window : this);
