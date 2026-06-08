/**
 * Parse MIDI / text notation and schedule piano playback with transport controls.
 */
(function (global) {
	"use strict";

	function readVarLen(data, offset) {
		var value = 0;
		while (offset < data.length) {
			var b = data[offset++];
			value = (value << 7) | (b & 0x7f);
			if (!(b & 0x80)) break;
		}
		return [value, offset];
	}

	function readStr(data, offset, len) {
		var s = "";
		for (var i = 0; i < len; i++) s += String.fromCharCode(data[offset + i]);
		return s;
	}

	function readU32(data, offset) {
		return ((data[offset] << 24) | (data[offset + 1] << 16) | (data[offset + 2] << 8) | data[offset + 3]) >>> 0;
	}

	function readU16(data, offset) {
		return (data[offset] << 8) | data[offset + 1];
	}

	function parseMidi(arrayBuffer) {
		var data = new Uint8Array(arrayBuffer);
		if (data.length < 14 || readStr(data, 0, 4) !== "MThd") {
			throw new Error("Not a valid MIDI file (.mid)");
		}
		var headerLen = readU32(data, 4);
		var numTracks = readU16(data, 10);
		var division = readU16(data, 12);
		if (division & 0x8000) {
			throw new Error("SMPTE-timed MIDI is not supported yet");
		}
		var ticksPerBeat = division;
		var pos = 8 + headerLen;
		var rawEvents = [];
		var microsPerQuarter = 500000;

		for (var t = 0; t < numTracks; t++) {
			if (pos + 8 > data.length || readStr(data, pos, 4) !== "MTrk") {
				throw new Error("Invalid MIDI track");
			}
			var trackLen = readU32(data, pos + 4);
			pos += 8;
			var trackEnd = pos + trackLen;
			var tick = 0;
			var status = 0;

			while (pos < trackEnd) {
				var delta = readVarLen(data, pos);
				pos = delta[1];
				tick += delta[0];

				if (pos >= trackEnd) break;
				var byte = data[pos];

				if (byte === 0xff) {
					pos++;
					var metaType = data[pos++];
					var len = readVarLen(data, pos);
					pos = len[1];
					if (metaType === 0x51 && len[0] === 3) {
						microsPerQuarter = (data[pos] << 16) | (data[pos + 1] << 8) | data[pos + 2];
					}
					pos += len[0];
					continue;
				}
				if (byte === 0xf0 || byte === 0xf7) {
					pos++;
					len = readVarLen(data, pos);
					pos = len[1] + len[0];
					continue;
				}

				if (byte >= 0x80) {
					status = byte;
					pos++;
				}
				var cmd = status & 0xf0;
				if (cmd === 0x90) {
					var note = data[pos++];
					var vel = data[pos++];
					rawEvents.push({
						tick: tick,
						type: vel > 0 ? "on" : "off",
						midiNote: note,
						velocity: vel > 0 ? vel / 127 : 0.7
					});
				} else if (cmd === 0x80) {
					var noteOff = data[pos++];
					pos++;
					rawEvents.push({ tick: tick, type: "off", midiNote: noteOff, velocity: 0.7 });
				} else if (cmd === 0xa0 || cmd === 0xb0 || cmd === 0xe0) {
					pos += 2;
				} else if (cmd === 0xc0 || cmd === 0xd0) {
					pos += 1;
				} else {
					pos++;
				}
			}
		}

		rawEvents.sort(function (a, b) {
			return a.tick - b.tick;
		});

		var msPerTick = microsPerQuarter / ticksPerBeat / 1000;
		var events = [];
		for (var i = 0; i < rawEvents.length; i++) {
			var e = rawEvents[i];
			events.push({
				timeMs: e.tick * msPerTick,
				type: e.type,
				midiNote: e.midiNote,
				velocity: e.velocity
			});
		}
		var durationMs = events.length ? events[events.length - 1].timeMs : 0;
		return { events: events, durationMs: durationMs };
	}

	var NOTE_LINE = /^(\d+(?:\.\d+)?)\s+([a-g](?:s)?-?\d+)\s*(\d+(?:\.\d+)?)?\s*(?:\/\/.*)?$/i;

	function parseText(text) {
		var lines = text.split(/\r?\n/);
		var events = [];
		for (var i = 0; i < lines.length; i++) {
			var line = lines[i].trim();
			if (!line || line.charAt(0) === "#") continue;
			var m = NOTE_LINE.exec(line);
			if (!m) {
				throw new Error("Invalid line " + (i + 1) + ": " + lines[i]);
			}
			var timeMs = parseFloat(m[1]) * 1000;
			var note = m[2].toLowerCase().replace(/([a-g])s(\d)/, "$1s$2");
			var vel = m[3] !== undefined ? parseFloat(m[3]) : 0.7;
			events.push({ timeMs: timeMs, type: "on", note: note, velocity: vel });
			events.push({ timeMs: timeMs + 400, type: "off", note: note, velocity: vel });
		}
		events.sort(function (a, b) {
			return a.timeMs - b.timeMs || (a.type === "off" ? 1 : -1);
		});
		var durationMs = events.length ? events[events.length - 1].timeMs : 0;
		return { events: events, durationMs: durationMs };
	}

	function formatTime(ms) {
		ms = Math.max(0, Math.floor(ms));
		var s = Math.floor(ms / 1000);
		var m = Math.floor(s / 60);
		s = s % 60;
		return m + ":" + (s < 10 ? "0" : "") + s;
	}

	function SheetPlayer(opts) {
		this.press = opts.press;
		this.release = opts.release;
		this.midiToNote = opts.midiToNote;
		this.onStatus = opts.onStatus || function () {};
		this.onProgress = opts.onProgress || function () {};
		this.tickInterval = null;
		this.held = {};
		this.events = null;
		this.durationMs = 0;
		this.offsetMs = 0;
		this.tempoScale = 1;
		this.loop = false;
		this.playing = false;
		this.paused = false;
		this.pendingEvents = null;
		this.playbackStart = 0;
		this.playbackFromMs = 0;
		this.eventIndex = 0;
	}

	SheetPlayer.prototype.setTrack = function (events, durationMs) {
		this.events = events || [];
		this.durationMs = durationMs || (this.events.length ? this.events[this.events.length - 1].timeMs : 0);
		this.pendingEvents = this.events;
		this.offsetMs = 0;
		this.eventIndex = 0;
		this.onProgress(this.offsetMs, this.durationMs);
	};

	SheetPlayer.prototype.clearTimers = function () {
		if (this.tickInterval) {
			clearInterval(this.tickInterval);
			this.tickInterval = null;
		}
	};

	SheetPlayer.prototype.releaseAllHeld = function () {
		for (var id in this.held) {
			if (this.held.hasOwnProperty(id)) this.release(id);
		}
		this.held = {};
	};

	SheetPlayer.prototype.stop = function () {
		this.playing = false;
		this.paused = false;
		this.clearTimers();
		this.releaseAllHeld();
		this.onStatus("Stopped");
		this.onProgress(this.offsetMs, this.durationMs);
	};

	SheetPlayer.prototype.pause = function () {
		if (!this.playing) return;
		this.offsetMs = this.getCurrentPositionMs();
		this.playing = false;
		this.paused = true;
		this.clearTimers();
		this.releaseAllHeld();
		this.onStatus("Paused at " + formatTime(this.offsetMs));
		this.onProgress(this.offsetMs, this.durationMs);
	};

	SheetPlayer.prototype.getCurrentPositionMs = function () {
		if (!this.playing) return this.offsetMs;
		var elapsed = (Date.now() - this.playbackStart) * this.tempoScale;
		return Math.min(this.playbackFromMs + elapsed, this.durationMs);
	};

	SheetPlayer.prototype.findEventIndex = function (ms) {
		var events = this.events;
		if (!events || !events.length) return 0;
		var i = 0;
		while (i < events.length && events[i].timeMs < ms) i++;
		return i;
	};

	SheetPlayer.prototype.fireEvent = function (evt) {
		var noteId = evt.note;
		if (evt.midiNote !== undefined) {
			noteId = this.midiToNote(evt.midiNote);
		}
		if (!noteId) return;
		if (evt.type === "on") {
			this.held[noteId] = true;
			this.press(noteId, evt.velocity);
		} else if (this.held[noteId]) {
			delete this.held[noteId];
			this.release(noteId);
		}
	};

	SheetPlayer.prototype.onTrackEnd = function () {
		var self = this;
		if (this.loop && this.events && this.events.length) {
			this.clearTimers();
			this.releaseAllHeld();
			this.offsetMs = 0;
			this.eventIndex = 0;
			this._scheduleFrom(0);
			this.onStatus("Looping…");
			return;
		}
		this.playing = false;
		this.paused = false;
		this.offsetMs = this.durationMs;
		this.clearTimers();
		this.releaseAllHeld();
		this.onStatus("Finished");
		this.onProgress(this.offsetMs, this.durationMs);
	};

	SheetPlayer.prototype.seekTo = function (ms) {
		ms = Math.max(0, Math.min(ms, this.durationMs || 0));
		var wasPlaying = this.playing;
		this.offsetMs = ms;
		this.eventIndex = this.findEventIndex(ms);
		if (wasPlaying) {
			this.clearTimers();
			this.releaseAllHeld();
			this._scheduleFrom(ms);
		} else {
			this.onProgress(this.offsetMs, this.durationMs);
			this.onStatus(formatTime(this.offsetMs) + " / " + formatTime(this.durationMs));
		}
	};

	SheetPlayer.prototype.seekBy = function (deltaMs) {
		this.seekTo(this.getCurrentPositionMs() + deltaMs);
	};

	/** Change speed during playback without restarting. */
	SheetPlayer.prototype.setTempoScale = function (scale) {
		if (scale <= 0) scale = 1;
		if (this.playing) {
			var pos = this.getCurrentPositionMs();
			this.tempoScale = scale;
			this.playbackFromMs = pos;
			this.playbackStart = Date.now();
		} else {
			this.tempoScale = scale;
		}
	};

	SheetPlayer.prototype.setLoop = function (loop) {
		this.loop = !!loop;
	};

	SheetPlayer.prototype._scheduleFrom = function (fromMs) {
		var self = this;
		var events = this.events;
		var tempo = this.tempoScale;
		if (!events || !events.length) return;

		this.playbackFromMs = fromMs;
		this.playbackStart = Date.now();
		this.playing = true;
		this.paused = false;
		this.eventIndex = this.findEventIndex(fromMs);
		this.clearTimers();

		this.tickInterval = setInterval(function () {
			if (!self.playing) return;
			var pos = self.getCurrentPositionMs();
			while (self.eventIndex < events.length && events[self.eventIndex].timeMs <= pos + 5) {
				self.fireEvent(events[self.eventIndex]);
				self.eventIndex++;
			}
			self.offsetMs = pos;
			self.onProgress(pos, self.durationMs);
			if (self.eventIndex >= events.length && pos >= self.durationMs - 20) {
				self.clearTimers();
				self.onTrackEnd();
			}
		}, 25);
	};

	SheetPlayer.prototype.play = function (options) {
		options = options || {};
		var events = options.events || this.events;
		if (!events || !events.length) {
			throw new Error("No notes to play");
		}

		if (options.events) {
			this.setTrack(events, options.durationMs);
		}

		this.events = events;
		this.pendingEvents = events;
		this.tempoScale = options.tempoScale || this.tempoScale || 1;
		if (this.tempoScale <= 0) this.tempoScale = 1;
		if (options.loop !== undefined) this.loop = options.loop;

		var fromMs = options.fromMs !== undefined ? options.fromMs : this.offsetMs;
		this.paused = false;
		this.clearTimers();
		this.releaseAllHeld();
		fromMs = Math.max(0, Math.min(fromMs, this.durationMs));
		this.offsetMs = fromMs;

		this.onStatus("Playing " + formatTime(this.offsetMs) + " @ " + Math.round(this.tempoScale * 100) + "%" +
			(this.loop ? " (loop)" : ""));
		this._scheduleFrom(fromMs);
	};

	SheetPlayer.formatTime = formatTime;
	SheetPlayer.parseMidi = parseMidi;
	SheetPlayer.parseText = parseText;

	if (typeof module !== "undefined" && module.exports) {
		module.exports = SheetPlayer;
	} else {
		global.SheetPlayer = SheetPlayer;
	}
})(typeof window !== "undefined" ? window : this);
