/**
 * Harmony World — all sound is synthesized with WebAudio (no files to load).
 *   - music tracks for the record player, aligned to a shared start time so
 *     both people hear the same bar at the same moment
 *   - a soft piano voice for the upright piano
 *   - small effects: pop, chime, pour, kick, dice, whoosh, steam, water
 */
export const TRACKS = [
	{ name: "Midnight Lo-fi", bpm: 74, chords: [[65, 69, 72, 76], [64, 67, 71, 74], [62, 65, 69, 72], [60, 64, 67, 71]], bass: [41, 40, 38, 36], swing: 0.12, drums: true, lead: [76, 74, 72, 69, 72, 74, 76, 79] },
	{ name: "Rainy Café Jazz", bpm: 92, chords: [[62, 65, 69, 72], [67, 71, 74, 77], [60, 64, 67, 71], [57, 61, 64, 67]], bass: [38, 43, 36, 33], swing: 0.2, drums: true, lead: [74, 77, 76, 74, 72, 71, 69, 67] },
	{ name: "Music Box Lullaby", bpm: 66, chords: [[60, 64, 67, 72], [57, 60, 64, 69], [65, 69, 72, 77], [67, 71, 74, 79]], bass: [48, 45, 41, 43], swing: 0, drums: false, lead: [84, 79, 76, 79, 81, 77, 74, 77] }
];

function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }

export class WorldAudio {
	constructor() {
		const AC = window.AudioContext || window.webkitAudioContext;
		this.ctx = AC ? new AC() : null;
		this.enabled = !!this.ctx;
		if (!this.ctx) return;
		this.master = this.ctx.createGain();
		this.master.gain.value = 0.8;
		this.master.connect(this.ctx.destination);
		this.musicBus = this.ctx.createGain();
		this.musicBus.gain.value = 0;
		const lp = this.ctx.createBiquadFilter();
		lp.type = "lowpass"; lp.frequency.value = 5200;
		this.musicBus.connect(lp); lp.connect(this.master);
		this.reverb = this._makeReverb();
		this.reverb.connect(this.master);
		this.noiseBuf = this._noise();
		this.music = null;
		this.musicVol = 0;
	}

	resume() { if (this.ctx && this.ctx.state !== "running") this.ctx.resume().catch(() => {}); }
	setMuted(m) { if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.8, this.ctx.currentTime, 0.05); }

	_makeReverb() {
		const ctx = this.ctx, len = ctx.sampleRate * 2.2;
		const buf = ctx.createBuffer(2, len, ctx.sampleRate);
		for (let c = 0; c < 2; c++) {
			const d = buf.getChannelData(c);
			for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
		}
		const conv = ctx.createConvolver();
		conv.buffer = buf;
		const g = ctx.createGain(); g.gain.value = 0.22;
		conv.connect(g);
		this.reverbIn = conv;
		return g;
	}
	_noise() {
		const ctx = this.ctx, buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
		const d = buf.getChannelData(0);
		for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
		return buf;
	}

	// Electric-piano-ish voice: sine + soft triangle + quick tine attack.
	_keys(dest, midi, t, dur, vel) {
		const ctx = this.ctx, f = mtof(midi);
		const g = ctx.createGain();
		g.gain.setValueAtTime(0, t);
		g.gain.linearRampToValueAtTime(vel, t + 0.008);
		g.gain.exponentialRampToValueAtTime(vel * 0.35, t + 0.25);
		g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
		const o1 = ctx.createOscillator(); o1.type = "sine"; o1.frequency.value = f;
		const o2 = ctx.createOscillator(); o2.type = "triangle"; o2.frequency.value = f * 2.001;
		const g2 = ctx.createGain(); g2.gain.value = 0.18;
		const o3 = ctx.createOscillator(); o3.type = "sine"; o3.frequency.value = f * 7.02;
		const g3 = ctx.createGain();
		g3.gain.setValueAtTime(0.12, t); g3.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
		o1.connect(g); o2.connect(g2); g2.connect(g); o3.connect(g3); g3.connect(g);
		g.connect(dest);
		if (this.reverbIn) { const s = ctx.createGain(); s.gain.value = 0.6; g.connect(s); s.connect(this.reverbIn); }
		[o1, o2, o3].forEach(o => { o.start(t); o.stop(t + dur + 0.05); });
	}
	_bass(dest, midi, t, dur, vel) {
		const ctx = this.ctx;
		const o = ctx.createOscillator(); o.type = "triangle"; o.frequency.value = mtof(midi);
		const g = ctx.createGain();
		g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel, t + 0.02);
		g.gain.exponentialRampToValueAtTime(0.001, t + dur);
		o.connect(g); g.connect(dest);
		o.start(t); o.stop(t + dur + 0.05);
	}
	_kick(dest, t, vel) {
		const ctx = this.ctx;
		const o = ctx.createOscillator(); o.type = "sine";
		o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
		const g = ctx.createGain(); g.gain.setValueAtTime(vel, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
		o.connect(g); g.connect(dest); o.start(t); o.stop(t + 0.32);
	}
	_hat(dest, t, vel, len = 0.05) {
		const ctx = this.ctx;
		const s = ctx.createBufferSource(); s.buffer = this.noiseBuf;
		const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 7000;
		const g = ctx.createGain(); g.gain.setValueAtTime(vel, t); g.gain.exponentialRampToValueAtTime(0.001, t + len);
		s.connect(hp); hp.connect(g); g.connect(dest);
		s.start(t, Math.random() * 0.5); s.stop(t + len + 0.02);
	}
	_snare(dest, t, vel) {
		const ctx = this.ctx;
		const s = ctx.createBufferSource(); s.buffer = this.noiseBuf;
		const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 1800; bp.Q.value = 0.7;
		const g = ctx.createGain(); g.gain.setValueAtTime(vel, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
		s.connect(bp); bp.connect(g); g.connect(dest);
		s.start(t, Math.random() * 0.5); s.stop(t + 0.2);
	}

	// ---- record player music, synced to a wall-clock start time ----
	startMusic(trackIdx, startMs) {
		if (!this.ctx) return;
		this.stopMusic(true);
		const tr = TRACKS[trackIdx % TRACKS.length];
		const step = 60 / tr.bpm / 2; // eighth notes
		const ctx = this.ctx;
		const offsetSec = (Date.now() - startMs) / 1000;
		const music = { tr, step, idx: Math.max(0, Math.floor(offsetSec / step) + 1), t0: ctx.currentTime - offsetSec, timer: 0, live: true };
		this.music = music;
		const tick = () => {
			if (!music.live) return;
			const ahead = ctx.currentTime + 0.25;
			while (music.t0 + music.idx * step < ahead) {
				const i = music.idx, t = Math.max(ctx.currentTime, music.t0 + i * step + ((i % 2) ? tr.swing * step : 0));
				const bar = Math.floor(i / 8) % tr.chords.length, beat = i % 8;
				const chord = tr.chords[bar];
				const bus = this.musicBus;
				if (beat === 0 || beat === 5) chord.forEach((n, j) => this._keys(bus, n, t + j * 0.012, step * 5, 0.06));
				if (beat === 0) this._bass(bus, tr.bass[bar], t, step * 3, 0.22);
				if (beat === 3 || beat === 6) this._bass(bus, tr.bass[bar] + (beat === 6 ? 7 : 0), t, step * 1.5, 0.16);
				if ((i * 7) % 3 === 0 && beat % 2 === 0) this._keys(bus, tr.lead[(i >> 1) % tr.lead.length], t, step * 3, tr.drums ? 0.035 : 0.07);
				if (tr.drums) {
					if (beat === 0 || beat === 3 && bar % 2) this._kick(bus, t, 0.5);
					if (beat === 4) this._snare(bus, t, 0.14);
					this._hat(bus, t, beat % 2 ? 0.03 : 0.05);
				}
				music.idx++;
			}
			music.timer = setTimeout(tick, 80);
		};
		tick();
	}
	stopMusic() {
		if (this.music) { this.music.live = false; clearTimeout(this.music.timer); this.music = null; }
	}
	// Volume follows how close you are to the speakers.
	setMusicVolume(v) {
		if (!this.ctx) return;
		this.musicBus.gain.setTargetAtTime(v, this.ctx.currentTime, 0.15);
	}

	pianoNote(midi, vel = 0.25) {
		if (!this.ctx) return;
		const t = this.ctx.currentTime;
		this._keys(this.master, midi, t, 1.6, vel);
		this._keys(this.master, midi + 12, t, 0.8, vel * 0.15);
	}

	sfx(kind, vol = 1) {
		if (!this.ctx) return;
		const ctx = this.ctx, t = ctx.currentTime, out = this.master;
		const tone = (f, f2, dur, type, v, delay = 0) => {
			const o = ctx.createOscillator(); o.type = type || "sine";
			o.frequency.setValueAtTime(f, t + delay);
			if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + delay + dur);
			const g = ctx.createGain();
			g.gain.setValueAtTime(0, t + delay); g.gain.linearRampToValueAtTime(v * vol, t + delay + 0.01);
			g.gain.exponentialRampToValueAtTime(0.0008, t + delay + dur);
			o.connect(g); g.connect(out); o.start(t + delay); o.stop(t + delay + dur + 0.05);
		};
		const noise = (dur, freq, q, v, delay = 0, type = "bandpass") => {
			const s = ctx.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
			const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
			const g = ctx.createGain();
			g.gain.setValueAtTime(0, t + delay); g.gain.linearRampToValueAtTime(v * vol, t + delay + 0.08);
			g.gain.linearRampToValueAtTime(0, t + delay + dur);
			s.connect(f); f.connect(g); g.connect(out); s.start(t + delay); s.stop(t + delay + dur + 0.05);
		};
		switch (kind) {
			case "pop": tone(520, 880, 0.12, "sine", 0.25); break;
			case "click": tone(1400, 900, 0.05, "square", 0.05); break;
			case "chime": [0, 4, 7, 12].forEach((n, i) => tone(mtof(76 + n), 0, 0.9, "sine", 0.12, i * 0.08)); break;
			case "love": [0, 7, 12, 16].forEach((n, i) => tone(mtof(72 + n), 0, 1.2, "triangle", 0.1, i * 0.12)); break;
			case "win": [0, 4, 7, 12, 16, 19].forEach((n, i) => tone(mtof(67 + n), 0, 0.5, "square", 0.05, i * 0.09)); break;
			case "lose": [7, 4, 0].forEach((n, i) => tone(mtof(60 + n), 0, 0.4, "triangle", 0.1, i * 0.15)); break;
			case "move": tone(660, 0, 0.08, "triangle", 0.12); break;
			case "kick": tone(180, 60, 0.15, "sine", 0.35); noise(0.06, 900, 1, 0.08); break;
			case "dice": for (let i = 0; i < 6; i++) tone(300 + Math.random() * 500, 0, 0.04, "square", 0.04, i * 0.07); break;
			case "whoosh": noise(0.6, 900, 0.6, 0.2); break;
			case "steam": noise(2.6, 3000, 0.4, 0.07, 0.4, "highpass"); noise(2.4, 400, 1.5, 0.12, 0.2); break;
			case "pour": noise(1.6, 700, 4, 0.12, 0.6); break;
			case "water": for (let i = 0; i < 10; i++) tone(900 + Math.random() * 900, 400, 0.08, "sine", 0.06, i * 0.11); break;
			case "switch": tone(2000, 1200, 0.03, "square", 0.06); break;
			case "door": tone(110, 70, 0.4, "sawtooth", 0.06); break;
			case "sip": noise(0.35, 1200, 2, 0.1, 0.05); noise(0.25, 800, 3, 0.08, 0.5); break;
			case "alarm": for (let i = 0; i < 12; i++) { tone(1760, 0, 0.07, "square", 0.08, i * 0.16); tone(1318, 0, 0.07, "square", 0.08, i * 0.16 + 0.08); } break;
			case "yawn": tone(320, 180, 1.1, "sine", 0.08); break;
			case "tug": tone(220 + Math.random() * 80, 120, 0.06, "square", 0.05); break;
			case "go": tone(523, 0, 0.15, "square", 0.08); tone(784, 0, 0.3, "square", 0.08, 0.15); break;
			case "count": tone(440, 0, 0.12, "square", 0.07); break;
			case "clap": noise(0.08, 1800, 0.8, 0.35); noise(0.08, 1500, 0.8, 0.25, 0.09); break;
			case "laugh": for (let i = 0; i < 6; i++) tone(520 - i * 18, 380 - i * 18, 0.12, "triangle", 0.07, i * 0.16); break;
			case "page": noise(0.25, 2500, 0.5, 0.08); break;
			// little lip "smack" (cheek kiss) / a longer "mmm-wah" with a chime (kiss)
			case "smack": noise(0.05, 2400, 2.5, 0.3); tone(900, 1500, 0.07, "sine", 0.08); break;
			case "smooch": tone(200, 260, 0.3, "sine", 0.06); noise(0.06, 2200, 2.5, 0.32, 0.32); tone(1100, 1700, 0.08, "sine", 0.09, 0.32); [0, 4, 7].forEach((n, i) => tone(mtof(84 + n), 0, 0.7, "triangle", 0.06, 0.45 + i * 0.08)); break;
			case "wink": tone(1600, 2400, 0.08, "sine", 0.08); tone(2400, 0, 0.25, "triangle", 0.05, 0.08); break;
			// calling the pets: a "wheet-whoo" whistle; the dog's two woofs; the cat's meow
			case "whistle": tone(1500, 2500, 0.2, "sine", 0.16); tone(2500, 1600, 0.38, "sine", 0.16, 0.26); break;
			case "woof": for (const d of [0, 0.26]) { tone(360, 150, 0.15, "sawtooth", 0.09, d); tone(720, 300, 0.12, "square", 0.03, d); noise(0.12, 700, 1.2, 0.18, d); } break;
			case "meow": tone(560, 920, 0.2, "triangle", 0.12); tone(920, 470, 0.45, "triangle", 0.12, 0.18); tone(1840, 940, 0.45, "sine", 0.025, 0.18); break;
			// the game room: a drum kit, the bowling lane, the billiard table, the dartboard, a crowd
			case "snare": noise(0.16, 1900, 0.7, 0.32); tone(240, 160, 0.08, "triangle", 0.1); break;
			case "hat": noise(0.05, 8000, 0.8, 0.12, 0, "highpass"); break;
			case "tom": tone(160, 90, 0.28, "sine", 0.35); noise(0.05, 500, 1, 0.08); break;
			case "crash": noise(1.4, 6500, 0.4, 0.14, 0, "highpass"); noise(0.6, 3500, 0.6, 0.08); break;
			case "roll": noise(1.9, 220, 1.2, 0.16); break;
			case "pins": for (let i = 0; i < 9; i++) { noise(0.09, 1400 + Math.random() * 2600, 3, 0.16, i * 0.035 + Math.random() * 0.03); tone(900 + Math.random() * 700, 500, 0.06, "triangle", 0.05, i * 0.04); } break;
			case "clack": tone(2400, 1800, 0.035, "square", 0.08); noise(0.03, 3200, 2, 0.12); break;
			case "thunk": noise(0.05, 900, 2, 0.25); tone(320, 200, 0.06, "sine", 0.15); break;
			case "applause": for (let i = 0; i < 26; i++) noise(0.05, 1500 + Math.random() * 1500, 0.9, 0.12 + Math.random() * 0.1, Math.random() * 1.6); break;
			case "yes": [0, 4, 7, 12, 16, 19, 24].forEach((n, i) => tone(mtof(67 + n), 0, 0.9, "triangle", 0.09, i * 0.09)); noise(0.8, 6000, 0.5, 0.05, 0.6, "highpass"); break;
		}
	}
}
