/**
 * Piano labels (note + QWERTY), key-guide parser, and interactive learn mode.
 */
(function (global) {
	"use strict";

	var FLAT_TO_SHARP = { b: "as", e: "ds", a: "gs", d: "cs", g: "fs" };

	var KEYCODE_LABEL = {
		65: "A", 90: "Z", 83: "S", 88: "X", 67: "C", 86: "V", 71: "G", 66: "B",
		78: "N", 74: "H", 77: "M", 75: "J", 188: ",", 76: "L", 190: ".", 191: "/",
		222: "'", 49: "1", 81: "Q", 50: "2", 87: "W", 52: "4", 82: "R", 53: "5",
		84: "T", 89: "Y", 55: "7", 85: "U", 56: "8", 73: "I", 57: "9", 79: "O",
		80: "P", 189: "-", 173: "-", 219: "[", 187: "=", 61: "=", 221: "]"
	};

	var GUIDE_LINE = /^\s*(\d+(?:\.\d+)?)\s+s\s+press\s+(.+?)\s+\(hold\s+(\d+(?:\.\d+)?)s\)\s*$/i;

	function noteIdToDisplay(noteId) {
		var m = /^([a-g])(s)?(-?\d+)$/.exec(noteId);
		if (!m) return noteId;
		var letter = m[1].toUpperCase() + (m[2] ? "#" : "");
		return letter + (parseInt(m[3], 10) + 1);
	}

	function displayToNoteId(name) {
		name = (name || "").trim();
		var m = /^([A-Ga-g])(#|b)?(\d+)$/.exec(name);
		if (!m) return null;
		var letter = m[1].toLowerCase();
		if (m[2] === "#") letter += "s";
		else if (m[2] === "b") {
			var flat = FLAT_TO_SHARP[letter];
			if (!flat) return null;
			letter = flat;
		}
		return letter + (parseInt(m[3], 10) - 1);
	}

	function buildNoteToKeyMap(keyBinding, transposeOctave) {
		transposeOctave = transposeOctave || 0;
		var map = {};
		for (var code in keyBinding) {
			if (!keyBinding.hasOwnProperty(code)) continue;
			var b = keyBinding[code];
			var oct = 1 + b.note.octave + transposeOctave;
			var noteId = b.note.note + oct;
			var label = KEYCODE_LABEL[code];
			if (label && !map[noteId]) map[noteId] = label;
		}
		return map;
	}

	function parseKeyGuide(text) {
		var lines = text.split(/\r?\n/);
		var title = "";
		var bpm = null;
		var events = [];
		for (var i = 0; i < lines.length; i++) {
			var line = lines[i];
			var trimmed = line.trim();
			if (!trimmed || trimmed.charAt(0) === "-") continue;
			if (!title && trimmed.indexOf("key-press guide") !== -1) {
				title = trimmed.split("—")[0].trim() || trimmed;
				var bpmMatch = /@\s*(\d+)\s*BPM/i.exec(trimmed);
				if (bpmMatch) bpm = parseInt(bpmMatch[1], 10);
				continue;
			}
			var m = GUIDE_LINE.exec(line);
			if (!m) continue;
			var timeMs = parseFloat(m[1]) * 1000;
			var holdMs = parseFloat(m[3]) * 1000;
			var noteNames = m[2].trim().split(/\s+/);
			var notes = [];
			var display = [];
			for (var n = 0; n < noteNames.length; n++) {
				var id = displayToNoteId(noteNames[n]);
				if (id) {
					notes.push(id);
					display.push(noteNames[n]);
				}
			}
			if (notes.length) {
				events.push({ timeMs: timeMs, holdMs: holdMs, notes: notes, display: display });
			}
		}
		if (!events.length) throw new Error("No key-press events found in guide file.");
		var durationMs = events[events.length - 1].timeMs + (events[events.length - 1].holdMs || 500);
		return { title: title || "Guide", bpm: bpm, events: events, durationMs: durationMs };
	}

	function parseMidiGuide(arrayBuffer, midiToNote, title) {
		if (typeof SheetPlayer === "undefined") {
			throw new Error("SheetPlayer is not loaded.");
		}
		if (!midiToNote) throw new Error("MIDI note mapping is not available.");
		var parsed = SheetPlayer.parseMidi(arrayBuffer);
		var onStack = {};
		var rawSteps = [];
		var DEFAULT_HOLD = 350;
		var CHORD_EPS = 8;

		for (var i = 0; i < parsed.events.length; i++) {
			var e = parsed.events[i];
			var midiKey = e.midiNote;
			if (midiKey === undefined) continue;
			var noteId = midiToNote(midiKey);
			if (!noteId) continue;
			if (e.type === "on") {
				onStack[midiKey] = { timeMs: e.timeMs, noteId: noteId };
			} else if (e.type === "off" && onStack[midiKey]) {
				var on = onStack[midiKey];
				rawSteps.push({
					timeMs: on.timeMs,
					noteId: on.noteId,
					holdMs: Math.max(40, e.timeMs - on.timeMs)
				});
				delete onStack[midiKey];
			}
		}
		for (var k in onStack) {
			if (!onStack.hasOwnProperty(k)) continue;
			rawSteps.push({
				timeMs: onStack[k].timeMs,
				noteId: onStack[k].noteId,
				holdMs: DEFAULT_HOLD
			});
		}

		rawSteps.sort(function (a, b) {
			return a.timeMs - b.timeMs || (a.noteId < b.noteId ? -1 : 1);
		});

		var events = [];
		for (var j = 0; j < rawSteps.length; j++) {
			var s = rawSteps[j];
			var last = events.length ? events[events.length - 1] : null;
			if (last && Math.abs(last.timeMs - s.timeMs) <= CHORD_EPS) {
				if (last.notes.indexOf(s.noteId) === -1) {
					last.notes.push(s.noteId);
					last.display.push(noteIdToDisplay(s.noteId));
				}
				last.holdMs = Math.max(last.holdMs, s.holdMs);
			} else {
				events.push({
					timeMs: s.timeMs,
					holdMs: s.holdMs,
					notes: [s.noteId],
					display: [noteIdToDisplay(s.noteId)]
				});
			}
		}

		if (!events.length) throw new Error("No playable notes in MIDI file (88-key range only).");
		var durationMs = parsed.durationMs || (events[events.length - 1].timeMs + events[events.length - 1].holdMs);
		return {
			title: title || "MIDI",
			bpm: null,
			events: events,
			durationMs: durationMs,
			source: "midi"
		};
	}

	function applyLearnTrack(guide, track, onTitle) {
		guide.setTrack(track);
		if (onTitle) {
			var label = track.title || "Guide";
			if (track.bpm) label += " @ " + track.bpm + " BPM";
			else if (track.source === "midi") label += " (MIDI)";
			onTitle(label);
		}
	}

	function formatGuideTime(ms) {
		ms = Math.max(0, ms);
		var s = (ms / 1000).toFixed(2);
		return s + " s";
	}

	function LearnGuide(opts) {
		this.getKeyMap = opts.getKeyMap || function () { return {}; };
		this.onUpdate = opts.onUpdate || function () {};
		this.onEnd = opts.onEnd || function () {};
		this.track = null;
		this.mode = "guide";
		this.playing = false;
		this.paused = false;
		this.eventIndex = 0;
		this.startTime = 0;
		this.offsetMs = 0;
		this.tempoScale = 1;
		this.highlights = {};
		this.pressed = {};
		this.tickIv = null;
	}

	LearnGuide.prototype.setTrack = function (track) {
		this.stop(false);
		this.track = track;
		this.eventIndex = 0;
		this.offsetMs = 0;
		this.clearHighlights();
		this.emitUpdate("Loaded: " + (track.title || "Guide") + " (" + track.events.length + " steps)");
	};

	LearnGuide.prototype.clearHighlights = function () {
		this.highlights = {};
		this.pressed = {};
	};

	LearnGuide.prototype.setHighlights = function (noteIds, kind) {
		this.highlights = {};
		for (var i = 0; i < noteIds.length; i++) {
			this.highlights[noteIds[i]] = kind || "target";
		}
	};

	LearnGuide.prototype.getHighlights = function () {
		return this.highlights;
	};

	LearnGuide.prototype.emitUpdate = function (status, step) {
		var ev = this.track && this.track.events[this.eventIndex];
		var keyMap = this.getKeyMap();
		var hint = "";
		if (ev) {
			var parts = [];
			for (var i = 0; i < ev.display.length; i++) {
				var disp = ev.display[i];
				var kid = ev.notes[i];
				var key = keyMap[kid];
				parts.push(key ? disp + " [" + key + "]" : disp);
			}
			hint = parts.join(" + ");
		}
		this.onUpdate({
			status: status || "",
			step: step !== undefined ? step : this.eventIndex + 1,
			total: this.track ? this.track.events.length : 0,
			hint: hint,
			timeMs: this.getPositionMs(),
			durationMs: this.track ? this.track.durationMs : 0,
			mode: this.mode
		});
	};

	LearnGuide.prototype.getPositionMs = function () {
		if (!this.playing) return this.offsetMs;
		var elapsed = (Date.now() - this.startTime) * this.tempoScale;
		return Math.min(this.offsetMs + elapsed, this.track ? this.track.durationMs : 0);
	};

	LearnGuide.prototype.stop = function (notify) {
		this.playing = false;
		this.paused = false;
		if (this.tickIv) {
			clearInterval(this.tickIv);
			this.tickIv = null;
		}
		this.clearHighlights();
		if (notify !== false) {
			this.emitUpdate("Stopped");
			this.onEnd();
		}
	};

	LearnGuide.prototype.pause = function () {
		if (!this.playing) return;
		this.offsetMs = this.getPositionMs();
		this.playing = false;
		this.paused = true;
		if (this.tickIv) {
			clearInterval(this.tickIv);
			this.tickIv = null;
		}
		this.emitUpdate("Paused");
	};

	LearnGuide.prototype.start = function (mode, tempoScale) {
		if (!this.track || !this.track.events.length) throw new Error("Load a guide file first.");
		this.mode = mode || this.mode || "guide";
		this.tempoScale = tempoScale > 0 ? tempoScale : 1;
		this.playing = true;
		this.paused = false;
		this.startTime = Date.now();
		if (this.mode === "practice") {
			this.eventIndex = 0;
			this.offsetMs = 0;
			this.showPracticeStep();
		} else {
			this.eventIndex = 0;
			while (this.eventIndex < this.track.events.length &&
				this.track.events[this.eventIndex].timeMs < this.offsetMs) {
				this.eventIndex++;
			}
			this.runGuideTick();
			var self = this;
			this.tickIv = setInterval(function () { self.runGuideTick(); }, 40);
		}
		this.emitUpdate(this.mode === "practice" ? "Practice — press highlighted keys" : "Guide running");
	};

	LearnGuide.prototype.showPracticeStep = function () {
		if (!this.track || this.eventIndex >= this.track.events.length) {
			this.stop();
			this.emitUpdate("Finished!");
			return;
		}
		var ev = this.track.events[this.eventIndex];
		this.pressed = {};
		this.setHighlights(ev.notes, "target");
		this.emitUpdate("Press these keys", this.eventIndex + 1);
	};

	LearnGuide.prototype.onNotePressed = function (noteId) {
		if (!this.playing || this.mode !== "practice" || !this.track) return;
		var ev = this.track.events[this.eventIndex];
		if (!ev) return;
		if (ev.notes.indexOf(noteId) === -1) {
			this.highlights[noteId] = "wrong";
			this.emitUpdate("Wrong key — need: " + ev.display.join(" + "), this.eventIndex + 1);
			return;
		}
		this.pressed[noteId] = true;
		this.highlights[noteId] = "hit";
		var all = true;
		for (var i = 0; i < ev.notes.length; i++) {
			if (!this.pressed[ev.notes[i]]) all = false;
		}
		if (all) {
			this.eventIndex++;
			var self = this;
			setTimeout(function () { self.showPracticeStep(); }, 120);
		} else {
			this.emitUpdate("Good — keep going", this.eventIndex + 1);
		}
	};

	LearnGuide.prototype.runGuideTick = function () {
		if (!this.playing || !this.track) return;
		var pos = this.getPositionMs();
		var events = this.track.events;
		while (this.eventIndex < events.length && events[this.eventIndex].timeMs <= pos) {
			var ev = events[this.eventIndex];
			this.setHighlights(ev.notes, "target");
			this.emitUpdate(formatGuideTime(ev.timeMs) + " — press " + ev.display.join(" + "), this.eventIndex + 1);
			this.eventIndex++;
		}
		if (this.eventIndex >= events.length && pos >= this.track.durationMs - 50) {
			this.stop();
			this.emitUpdate("Finished!");
		}
	};

	LearnGuide.prototype.seekStep = function (delta) {
		if (!this.track) return;
		this.stop(false);
		this.eventIndex = Math.max(0, Math.min(this.track.events.length - 1, this.eventIndex + delta));
		if (this.mode === "practice") this.showPracticeStep();
		else {
			var ev = this.track.events[this.eventIndex];
			this.offsetMs = ev ? ev.timeMs : 0;
			this.setHighlights(ev ? ev.notes : [], "target");
			this.emitUpdate("Step " + (this.eventIndex + 1), this.eventIndex + 1);
		}
	};

	var PianoLearn = {
		labels: {
			showNoteNames: true,
			showKeyLabels: true
		},
		noteIdToDisplay: noteIdToDisplay,
		displayToNoteId: displayToNoteId,
		buildNoteToKeyMap: buildNoteToKeyMap,
		parseKeyGuide: parseKeyGuide,
		parseMidiGuide: parseMidiGuide,
		applyLearnTrack: applyLearnTrack,
		LearnGuide: LearnGuide,
		guide: null,
		init: function (opts) {
			opts = opts || {};
			var self = this;
			this.getKeyBinding = opts.getKeyBinding || function () { return {}; };
			this.getTranspose = opts.getTranspose || function () { return 0; };
			this.guide = new LearnGuide({
				getKeyMap: function () {
					return self.buildNoteToKeyMap(self.getKeyBinding(), self.getTranspose());
				},
				onUpdate: opts.onGuideUpdate || function () {},
				onEnd: opts.onGuideEnd || function () {}
			});
			if (localStorage) {
				if (localStorage.pianoShowNoteNames === "0") this.labels.showNoteNames = false;
				if (localStorage.pianoShowKeyLabels === "0") this.labels.showKeyLabels = false;
			}
			return this;
		},
		getKeyMap: function () {
			return this.buildNoteToKeyMap(this.getKeyBinding(), this.getTranspose());
		},
		onNotePressed: function (noteId) {
			if (this.guide) this.guide.onNotePressed(noteId);
		},
		getHighlights: function () {
			return this.guide ? this.guide.getHighlights() : {};
		},
		setLabelPrefs: function (noteNames, keyLabels) {
			this.labels.showNoteNames = !!noteNames;
			this.labels.showKeyLabels = !!keyLabels;
			if (localStorage) {
				localStorage.pianoShowNoteNames = noteNames ? "1" : "0";
				localStorage.pianoShowKeyLabels = keyLabels ? "1" : "0";
			}
		}
	};

	global.PianoLearn = PianoLearn;
})(typeof window !== "undefined" ? window : this);
