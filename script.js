
// 钢琴

$(function() {

	var test_mode = (window.location.hash && window.location.hash.match(/^(?:#.+)*#test(?:#.+)*$/i));

	var gDontShow = !!window.gDontShow;

	var gSeeOwnCursor = (window.location.hash && window.location.hash.match(/^(?:#.+)*#seeowncursor(?:#.+)*$/i));

	var gMidiVolumeTest = (window.location.hash && window.location.hash.match(/^(?:#.+)*#midivolumetest(?:#.+)*$/i));

	var gMidiOutTest;

	if (!Array.prototype.indexOf) {
		Array.prototype.indexOf = function(elt /*, from*/) {
			var len = this.length >>> 0;
			var from = Number(arguments[1]) || 0;
			from = (from < 0) ? Math.ceil(from) : Math.floor(from);
			if (from < 0) from += len;
			for (; from < len; from++) {
				if (from in this && this[from] === elt) return from;
			}
			return -1;
		};
	}

	window.requestAnimationFrame = window.requestAnimationFrame || window.mozRequestAnimationFrame
		|| window.webkitRequestAnimationFrame || window.msRequestAnimationFrame
		|| function (cb) { setTimeout(cb, 1000 / 30); };








	




























	var DEFAULT_VELOCITY = 0.5;












































	var TIMING_TARGET = 1000;



















// Utility

////////////////////////////////////////////////////////////////



var Rect = function(x, y, w, h) {
	this.x = x;
	this.y = y;
	this.w = w;
	this.h = h;
	this.x2 = x + w;
	this.y2 = y + h;
};
Rect.prototype.contains = function(x, y) {
	return (x >= this.x && x <= this.x2 && y >= this.y && y <= this.y2);
};
















// performing translation

////////////////////////////////////////////////////////////////

	var Translation = (function() {
		var strings = {
			"people are playing": {
				"pt": "pessoas estão jogando",
				"es": "personas están jugando",
				"ru": "человек играет",
				"fr": "personnes jouent",
				"ja": "人が遊んでいる",
				"de": "Leute spielen",
				"zh": "人在玩",
				"nl": "mensen spelen",
				"pl": "osób grają",
				"hu": "ember játszik"
			},
			"New Room...": {
				"pt": "Nova Sala ...",
				"es": "Nueva sala de...",
				"ru": "Новый номер...",
				"ja": "新しい部屋",
				"zh": "新房间",
				"nl": "nieuwe Kamer",
				"hu": "új szoba"
			},
			"room name": {
				"pt": "nome da sala",
				"es": "sala de nombre",
				"ru": "название комнаты",
				"fr": "nom de la chambre",
				"ja": "ルーム名",
				"de": "Raumnamen",
				"zh": "房间名称",
				"nl": "kamernaam",
				"pl": "nazwa pokój",
				"hu": "szoba neve"
			},
			"Visible (open to everyone)": {
				"pt": "Visível (aberto a todos)",
				"es": "Visible (abierto a todo el mundo)",
				"ru": "Visible (открытый для всех)",
				"fr": "Visible (ouvert à tous)",
				"ja": "目に見える（誰にでも開いている）",
				"de": "Sichtbar (offen für alle)",
				"zh": "可见（向所有人开放）",
				"nl": "Zichtbaar (open voor iedereen)",
				"pl": "Widoczne (otwarte dla wszystkich)",
				"hu": "Látható (nyitott mindenki számára)"
			},
			"Enable Chat": {
				"pt": "Ativar bate-papo",
				"es": "Habilitar chat",
				"ru": "Включить чат",
				"fr": "Activer discuter",
				"ja": "チャットを有効にする",
				"de": "aktivieren Sie chatten",
				"zh": "启用聊天",
				"nl": "Chat inschakelen",
				"pl": "Włącz czat",
				"hu": "a csevegést"
			},
			"Play Alone": {
				"pt": "Jogar Sozinho",
				"es": "Jugar Solo",
				"ru": "Играть в одиночку",
				"fr": "Jouez Seul",
				"ja": "一人でプレイ",
				"de": "Alleine Spielen",
				"zh": "独自玩耍",
				"nl": "Speel Alleen",
				"pl": "Zagraj sam",
				"hu": "Játssz egyedül"
			}
			// todo: it, tr, th, sv, ar, fi, nb, da, sv, he, cs, ko, ro, vi, id, nb, el, sk, bg, lt, sl, hr
			// todo: Connecting, Offline mode, input placeholder, Notifications
		};

		var setLanguage = function(lang) {
			language = lang
		};

		var getLanguage = function() {
			if(window.navigator && navigator.language && navigator.language.length >= 2) {
				return navigator.language.substr(0, 2).toLowerCase();
			} else {
				return "en";
			}
		};

		var get = function(text, lang) {
			if(typeof lang === "undefined") lang = language;
			var row = strings[text];
			if(row == undefined) return text;
			var string = row[lang];
			if(string == undefined) return text;
			return string;
		};

		var perform = function(lang) {
			if(typeof lang === "undefined") lang = language;
			$(".translate").each(function(i, ele) {
				var th = $(this);
				if(ele.tagName && ele.tagName.toLowerCase() == "input") {
					if(typeof ele.placeholder != "undefined") {
						th.attr("placeholder", get(th.attr("placeholder"), lang))
					}
				} else {
					th.text(get(th.text(), lang));
				}
			});
		};

		var language = getLanguage();

		return {
			setLanguage: setLanguage,
			getLanguage: getLanguage,
			get: get,
			perform: perform
		};
	})();

	Translation.perform();















// AudioEngine classes

////////////////////////////////////////////////////////////////

	var AudioEngine = function() {
	};

	AudioEngine.prototype.init = function(cb) {
		this.volume = 0.6;
		this.sounds = {};
		this.paused = true;
		return this;
	};

	AudioEngine.prototype.load = function(id, url, cb) {
	};

	AudioEngine.prototype.play = function() {
	};

	AudioEngine.prototype.stop = function() {
	};

	AudioEngine.prototype.setVolume = function(vol) {
		this.volume = vol;
	};
	
	AudioEngine.prototype.resume = function() {
		this.paused = false;
	};


	AudioEngineWeb = function() {
		this.threshold = 1000;
		this.worker = new Worker("./workerTimer.js");
		var self = this;
		this.worker.onmessage = function(event)
			{
				if(event.data.args)
				if(event.data.args.action==0)
				{
					self.actualPlay(event.data.args.id, event.data.args.vol, event.data.args.time, event.data.args.part_id);
				}
				else
				{
					self.actualStop(event.data.args.id, event.data.args.time, event.data.args.part_id);
				}
			}
	};

	AudioEngineWeb.prototype = new AudioEngine();

	AudioEngineWeb.prototype.init = function(cb) {
		AudioEngine.prototype.init.call(this);

		this.context = new AudioContext({latencyHint: 'interactive'});

		this.masterGain = this.context.createGain();
		this.masterGain.connect(this.context.destination);
		this.masterGain.gain.value = this.volume;

		this.limiterNode = this.context.createDynamicsCompressor();
		this.limiterNode.threshold.value = -10;
		this.limiterNode.knee.value = 0;
		this.limiterNode.ratio.value = 20;
		this.limiterNode.attack.value = 0;
		this.limiterNode.release.value = 0.1;
		this.limiterNode.connect(this.masterGain);

		// for synth mix
		this.pianoGain = this.context.createGain();
		this.pianoGain.gain.value = 0.5;
		this.pianoGain.connect(this.limiterNode);
		this.synthGain = this.context.createGain();
		this.synthGain.gain.value = 0.5;
		this.synthGain.connect(this.limiterNode);

		this.playings = {};
		
		if(cb) setTimeout(cb, 0);
		return this;
	};

	AudioEngineWeb.prototype.load = function(id, url, cb, fallbackUrl) {
		var audio = this;
		var req = new XMLHttpRequest();
		req.open("GET", url);
		req.responseType = "arraybuffer";
		req.addEventListener("readystatechange", function(evt) {
			if(req.readyState !== 4) return;
			if(req.status !== 200 || !req.response || !req.response.byteLength) {
				if(fallbackUrl && fallbackUrl !== url) {
					audio.load(id, fallbackUrl, cb);
					return;
				}
				new Notification({id: "audio-download-error", title: "Problem", text: "Could not load sound \"" + id + "\" (" + req.status + "). Check that sounds/mppclassic/ exists.",
					target: "#piano", duration: 10000});
				return;
			}
			audio.context.decodeAudioData(req.response, function(buffer) {
				audio.sounds[id] = buffer;
				if(cb) cb();
			}, function() {
				if(fallbackUrl && fallbackUrl !== url) {
					audio.load(id, fallbackUrl, cb);
					return;
				}
				new Notification({id: "audio-download-error", title: "Problem", text: "Could not decode sound \"" + id + "\".",
					target: "#piano", duration: 10000});
			});
		});
		req.send();
	};

	AudioEngineWeb.prototype.actualPlay = function(id, vol, time, part_id) { //the old play(), but with time insted of delay_ms.
		if(this.paused && this.context && this.context.state === "suspended") {
			this.resume();
		}
		if(this.paused) return;
		if(!this.sounds.hasOwnProperty(id)) return;
		var source = this.context.createBufferSource();
		source.buffer = this.sounds[id];
		var gain = this.context.createGain();
		gain.gain.value = vol;
		source.connect(gain);
		gain.connect(this.pianoGain);
		source.start(time);
		// Patch from ste-art remedies stuttering under heavy load
		if(this.playings[id]) {
			var playing = this.playings[id];
			playing.gain.gain.setValueAtTime(playing.gain.gain.value, time);
			playing.gain.gain.linearRampToValueAtTime(0.0, time + 0.2);
			playing.source.stop(time + 0.21);
			if(enableSynth && playing.voice) {
				playing.voice.stop(time);
			}
		}
		this.playings[id] = {"source": source, "gain": gain, "part_id": part_id};

		if(enableSynth) {
			this.playings[id].voice = new synthVoice(id, time);
		}
	}
	
	AudioEngineWeb.prototype.play = function(id, vol, delay_ms, part_id)
	{
		if(!this.sounds.hasOwnProperty(id)) return;
		var time = this.context.currentTime + (delay_ms / 1000); //calculate time on note receive.
		var delay = delay_ms - this.threshold;
		if(delay<=0) this.actualPlay(id, vol, time, part_id);
		else {
			this.worker.postMessage({delay:delay,args:{action:0/*play*/,id:id, vol:vol, time:time, part_id:part_id}}); // but start scheduling right before play.
		}
	}
	
	AudioEngineWeb.prototype.actualStop = function(id, time, part_id) {
		if(this.playings.hasOwnProperty(id) && this.playings[id] && this.playings[id].part_id === part_id) {
			var gain = this.playings[id].gain.gain;
			gain.setValueAtTime(gain.value, time);
			gain.linearRampToValueAtTime(gain.value * 0.1, time + 0.16);
			gain.linearRampToValueAtTime(0.0, time + 0.4);
			this.playings[id].source.stop(time + 0.41);
			

			if(this.playings[id].voice) {
				this.playings[id].voice.stop(time);
			}

			this.playings[id] = null;
		}
	};

	AudioEngineWeb.prototype.stop = function(id, delay_ms, part_id) {
			var time = this.context.currentTime + (delay_ms / 1000);
			var delay = delay_ms - this.threshold;
			if(delay<=0) this.actualStop(id, time, part_id);
			else {
				this.worker.postMessage({delay:delay,args:{action:1/*stop*/, id:id, time:time, part_id:part_id}});
			}
	};

	AudioEngineWeb.prototype.setVolume = function(vol) {
		AudioEngine.prototype.setVolume.call(this, vol);
		this.masterGain.gain.value = this.volume;
	};
	
	AudioEngineWeb.prototype.resume = function() {
		this.paused = false;
		this.context.resume();
	};


























// Renderer classes

////////////////////////////////////////////////////////////////

	var Renderer = function() {
	};

	Renderer.prototype.init = function(piano) {
		this.piano = piano;
		this.resize();
		return this;
	};

	Renderer.prototype.resize = function(width, height) {
		if(typeof width == "undefined") width = $(this.piano.rootElement).width();
		if(typeof height == "undefined") height = Math.floor(width * 0.2);
		$(this.piano.rootElement).css({"height": height + "px", marginTop: Math.floor($(window).height() / 2 - height / 2) + "px"});
		this.width = width * window.devicePixelRatio;
		this.height = height * window.devicePixelRatio;
	};

	Renderer.prototype.visualize = function(key, color) {
	};




	var CanvasRenderer = function() {
		Renderer.call(this);
	};

	CanvasRenderer.prototype = new Renderer();

	CanvasRenderer.prototype.init = function(piano) {
		this.canvas = document.createElement("canvas");
		this.ctx = this.canvas.getContext("2d");
		piano.rootElement.appendChild(this.canvas);

		Renderer.prototype.init.call(this, piano); // calls resize()

		// create render loop
		var self = this;
		var render = function() {
			self.redraw();
			requestAnimationFrame(render);
		};
		requestAnimationFrame(render);

		// add event listeners
		var mouse_down = false;
		var last_key = null;
		$(piano.rootElement).mousedown(function(event) {
			mouse_down = true;
			//event.stopPropagation();
			event.preventDefault();

			var pos = CanvasRenderer.translateMouseEvent(event);
			var hit = self.getHit(pos.x, pos.y);
			if(hit) {
				press(hit.key.note, hit.v);
				last_key = hit.key;
			}
		});
		piano.rootElement.addEventListener("touchstart", function(event) {
			mouse_down = true;
			//event.stopPropagation();
			event.preventDefault();
			for(var i in event.changedTouches) {
				var pos = CanvasRenderer.translateMouseEvent(event.changedTouches[i]);
				var hit = self.getHit(pos.x, pos.y);
				if(hit) {
					press(hit.key.note, hit.v);
					last_key = hit.key;
				}
			}
		}, false);
		$(window).mouseup(function(event) {
			if(last_key) {
				release(last_key.note);
			}
			mouse_down = false;
			last_key = null;
		});
		/*$(piano.rootElement).mousemove(function(event) {
			if(!mouse_down) return;
			var pos = CanvasRenderer.translateMouseEvent(event);
			var hit = self.getHit(pos.x, pos.y);
			if(hit && hit.key != last_key) {
				press(hit.key.note, hit.v);
				last_key = hit.key;
			}
		});*/

		return this;
	};

	CanvasRenderer.prototype.resize = function(width, height) {
		Renderer.prototype.resize.call(this, width, height);
		if(this.width < 52 * 2) this.width = 52 * 2;
		if(this.height < this.width * 0.2) this.height = Math.floor(this.width * 0.2);
		this.canvas.width = this.width;
		this.canvas.height = this.height;
		this.canvas.style.width = this.width / window.devicePixelRatio + "px";
		this.canvas.style.height = this.height / window.devicePixelRatio + "px";
		
		// calculate key sizes
		this.whiteKeyWidth = Math.floor(this.width / 52);
		this.whiteKeyHeight = Math.floor(this.height * 0.9);
		this.blackKeyWidth = Math.floor(this.whiteKeyWidth * 0.75);
		this.blackKeyHeight = Math.floor(this.height * 0.5);

		this.blackKeyOffset = Math.floor(this.whiteKeyWidth - (this.blackKeyWidth / 2));
		this.keyMovement = Math.floor(this.whiteKeyHeight * 0.015);

		this.whiteBlipWidth = Math.floor(this.whiteKeyWidth * 0.7);
		this.whiteBlipHeight = Math.floor(this.whiteBlipWidth * 0.8);
		this.whiteBlipX = Math.floor((this.whiteKeyWidth - this.whiteBlipWidth) / 2);
		this.whiteBlipY = Math.floor(this.whiteKeyHeight - this.whiteBlipHeight * 1.2);
		this.blackBlipWidth = Math.floor(this.blackKeyWidth * 0.7);
		this.blackBlipHeight = Math.floor(this.blackBlipWidth * 0.8);
		this.blackBlipY = Math.floor(this.blackKeyHeight - this.blackBlipHeight * 1.2);
		this.blackBlipX = Math.floor((this.blackKeyWidth - this.blackBlipWidth) / 2);
		
		// prerender white key
		this.whiteKeyRender = document.createElement("canvas");
		this.whiteKeyRender.width = this.whiteKeyWidth;
		this.whiteKeyRender.height = this.height + 10;
		var ctx = this.whiteKeyRender.getContext("2d");
		if(ctx.createLinearGradient) {
			var gradient = ctx.createLinearGradient(0, 0, 0, this.whiteKeyHeight);
			gradient.addColorStop(0, "#f5f5f5");
			gradient.addColorStop(0.6, "#ffffff");
			gradient.addColorStop(1, "#e8e8e8");
			ctx.fillStyle = gradient;
		} else {
			ctx.fillStyle = "#fff";
		}
		ctx.strokeStyle = "#000";
		ctx.lineJoin = "round";
		ctx.lineCap = "round";
		ctx.lineWidth = 10;
		ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, this.whiteKeyWidth - ctx.lineWidth, this.whiteKeyHeight - ctx.lineWidth);
		ctx.lineWidth = 4;
		ctx.fillRect(ctx.lineWidth / 2, ctx.lineWidth / 2, this.whiteKeyWidth - ctx.lineWidth, this.whiteKeyHeight - ctx.lineWidth);
		
		// prerender black key
		this.blackKeyRender = document.createElement("canvas");
		this.blackKeyRender.width = this.blackKeyWidth + 10;
		this.blackKeyRender.height = this.blackKeyHeight + 10;
		var ctx = this.blackKeyRender.getContext("2d");
		if(ctx.createLinearGradient) {
			var gradient = ctx.createLinearGradient(0, 0, 0, this.blackKeyHeight);
			gradient.addColorStop(0, "#1a1a1a");
			gradient.addColorStop(1, "#3d3d3d");
			ctx.fillStyle = gradient;
		} else {
			ctx.fillStyle = "#000";
		}
		ctx.strokeStyle = "#222";
		ctx.lineJoin = "round";
		ctx.lineCap = "round";
		ctx.lineWidth = 8;
		ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, this.blackKeyWidth - ctx.lineWidth, this.blackKeyHeight - ctx.lineWidth);
		ctx.lineWidth = 4;
		ctx.fillRect(ctx.lineWidth / 2, ctx.lineWidth / 2, this.blackKeyWidth - ctx.lineWidth, this.blackKeyHeight - ctx.lineWidth);

		// prerender shadows
		this.shadowRender = [];
		var y = -this.canvas.height * 2;
		for(var j = 0; j < 2; j++) {
			var canvas = document.createElement("canvas");
			this.shadowRender[j] = canvas;
			canvas.width = this.canvas.width;
			canvas.height = this.canvas.height;
			var ctx = canvas.getContext("2d");
			var sharp = j ? true : false;
			ctx.lineJoin = "round";
			ctx.lineCap = "round";
			ctx.lineWidth = 1;
			ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
			ctx.shadowBlur = this.keyMovement * 3;
			ctx.shadowOffsetY = -y + this.keyMovement;
			if(sharp) {
				ctx.shadowOffsetX = this.keyMovement;
			} else {
				ctx.shadowOffsetX = 0;
				ctx.shadowOffsetY = -y + this.keyMovement;
			}
			for(var i in this.piano.keys) {
				if(!this.piano.keys.hasOwnProperty(i)) continue;
				var key = this.piano.keys[i];
				if(key.sharp != sharp) continue;

				if(key.sharp) {
					ctx.fillRect(this.blackKeyOffset + this.whiteKeyWidth * key.spatial + ctx.lineWidth / 2,
						y + ctx.lineWidth / 2,
						this.blackKeyWidth - ctx.lineWidth, this.blackKeyHeight - ctx.lineWidth);
				} else {
					ctx.fillRect(this.whiteKeyWidth * key.spatial + ctx.lineWidth / 2,
						y + ctx.lineWidth / 2,
						this.whiteKeyWidth - ctx.lineWidth, this.whiteKeyHeight - ctx.lineWidth);
				}
			}
		}

		// update key rects
		for(var i in this.piano.keys) {
			if(!this.piano.keys.hasOwnProperty(i)) continue;
			var key = this.piano.keys[i];
			if(key.sharp) {
				key.rect = new Rect(this.blackKeyOffset + this.whiteKeyWidth * key.spatial, 0,
					this.blackKeyWidth, this.blackKeyHeight);
			} else {
				key.rect = new Rect(this.whiteKeyWidth * key.spatial, 0,
					this.whiteKeyWidth, this.whiteKeyHeight);
			}
		}
	};

	CanvasRenderer.prototype.visualize = function(key, color) {
		key.timePlayed = Date.now();
		key.blips.push({"time": key.timePlayed, "color": color});
	};

	CanvasRenderer.prototype.redraw = function() {
		var now = Date.now();
		var timeLoadedEnd = now - 1000;
		var timePlayedEnd = now - 100;
		var timeBlipEnd = now - 1000;

		this.ctx.save();
		this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
		// draw all keys
		for(var j = 0; j < 2; j++) {
			this.ctx.globalAlpha = 1.0;
			this.ctx.drawImage(this.shadowRender[j], 0, 0);
			var sharp = j ? true : false;
			for(var i in this.piano.keys) {
				if(!this.piano.keys.hasOwnProperty(i)) continue;
				var key = this.piano.keys[i];
				if(key.sharp != sharp) continue;

				if(!key.loaded) {
					this.ctx.globalAlpha = 0.45;
				} else if(key.timeLoaded > timeLoadedEnd) {
					this.ctx.globalAlpha = ((now - key.timeLoaded) / 1000) * 0.55 + 0.45;
				} else {
					this.ctx.globalAlpha = 1.0;
				}
				var y = 0;
				if(key.timePlayed > timePlayedEnd) {
					y = Math.floor(this.keyMovement - (((now - key.timePlayed) / 100) * this.keyMovement));
				}
				var x = Math.floor(key.sharp ? this.blackKeyOffset + this.whiteKeyWidth * key.spatial
					: this.whiteKeyWidth * key.spatial);
				var image = key.sharp ? this.blackKeyRender : this.whiteKeyRender;
				this.ctx.drawImage(image, x, y);

				var pl = typeof PianoLearn !== "undefined" ? PianoLearn : null;
				var hl = pl ? pl.getHighlights() : null;
				if(hl && hl[key.note]) {
					this.ctx.save();
					this.ctx.globalAlpha = 0.5;
					if(hl[key.note] === "wrong") this.ctx.fillStyle = "#e44";
					else if(hl[key.note] === "hit") this.ctx.fillStyle = "#4c4";
					else this.ctx.fillStyle = "#eb3";
					var hw = key.sharp ? this.blackKeyWidth : this.whiteKeyWidth;
					var hh = key.sharp ? this.blackKeyHeight : this.whiteKeyHeight;
					this.ctx.fillRect(x, y, hw, hh);
					this.ctx.restore();
				}

				if(pl && (pl.labels.showNoteNames || pl.labels.showKeyLabels)) {
					var kw = key.sharp ? this.blackKeyWidth : this.whiteKeyWidth;
					if(kw >= 14) {
						var keyMap = pl.getKeyMap();
						this.ctx.save();
						this.ctx.textAlign = "center";
						this.ctx.textBaseline = "bottom";
						var cx = x + kw / 2;
						var baseY = y + (key.sharp ? this.blackKeyHeight : this.whiteKeyHeight) - 3;
						var fontSize = Math.max(6, Math.min(10, Math.floor(kw * 0.34)));
						this.ctx.font = "bold " + fontSize + "px Arial,sans-serif";
						this.ctx.fillStyle = key.sharp ? "#fff" : "#333";
						if(pl.labels.showNoteNames) {
							this.ctx.fillText(pl.noteIdToDisplay(key.note), cx, baseY);
							baseY -= fontSize + 1;
						}
						if(pl.labels.showKeyLabels && keyMap[key.note]) {
							this.ctx.font = Math.max(5, fontSize - 1) + "px Arial,sans-serif";
							this.ctx.fillStyle = key.sharp ? "#bbb" : "#777";
							this.ctx.fillText(keyMap[key.note], cx, baseY);
						}
						this.ctx.restore();
					}
				}

				// render blips
				if(key.blips.length) {
					var alpha = this.ctx.globalAlpha;
					var w, h;
					if(key.sharp) {
						x += this.blackBlipX;
						y = this.blackBlipY;
						w = this.blackBlipWidth;
						h = this.blackBlipHeight;
					} else {
						x += this.whiteBlipX;
						y = this.whiteBlipY;
						w = this.whiteBlipWidth;
						h = this.whiteBlipHeight;
					}
					for(var b = 0; b < key.blips.length; b++) {
						var blip = key.blips[b];
						if(blip.time > timeBlipEnd) {
							this.ctx.fillStyle = blip.color;
							this.ctx.globalAlpha = alpha - ((now - blip.time) / 1000);
							this.ctx.fillRect(x, y, w, h);
						} else {
							key.blips.splice(b, 1);
							--b;
						}
						y -= Math.floor(h * 1.1);
					}
				}
			}
		}
		this.ctx.restore();
	};

	CanvasRenderer.prototype.renderNoteLyrics = function() {
		// render lyric
		for(var part_id in this.noteLyrics) {
			if(!this.noteLyrics.hasOwnProperty(i)) continue;
			var lyric = this.noteLyrics[part_id];
			var lyric_x = x;
			var lyric_y = this.whiteKeyHeight + 1;
			this.ctx.fillStyle = key.lyric.color;
			var alpha = this.ctx.globalAlpha;
			this.ctx.globalAlpha = alpha - ((now - key.lyric.time) / 1000);
			this.ctx.fillRect(x, y, 10, 10);
		}
	};

	CanvasRenderer.prototype.getHit = function(x, y) {
		for(var j = 0; j < 2; j++) {
			var sharp = j ? false : true; // black keys first
			for(var i in this.piano.keys) {
				if(!this.piano.keys.hasOwnProperty(i)) continue;
				var key = this.piano.keys[i];
				if(key.sharp != sharp) continue;
				if(key.rect.contains(x, y)) {
					var v = y / (key.sharp ? this.blackKeyHeight : this.whiteKeyHeight);
					v += 0.25;
					v *= DEFAULT_VELOCITY;
					if(v > 1.0) v = 1.0;
					return {"key": key, "v": v};
				}
			}
		}
		return null;
	};


	CanvasRenderer.isSupported = function() {
		var canvas = document.createElement("canvas");
		return !!(canvas.getContext && canvas.getContext("2d"));
	};

	CanvasRenderer.translateMouseEvent = function(evt) {
		var element = evt.target;
		var offx = 0;
		var offy = 0;
		do {
			if(!element) break; // wtf, wtf?
			offx += element.offsetLeft;
			offy += element.offsetTop;
		} while(element = element.offsetParent);
		return {
			x: (evt.pageX - offx) * window.devicePixelRatio,
			y: (evt.pageY - offy) * window.devicePixelRatio
		}
	};











// Soundpack Stuff by electrashave ♥

////////////////////////////////////////////////////////////////

	function SoundSelector(piano) {
	    this.initialized = false;
	    this.keys = piano.keys;
	    this.loading = {};
	    this.notification;
	    this.packs = [];
	    this.piano = piano;
	    this.soundSelection = localStorage.soundSelection ? localStorage.soundSelection : "MPP Classic";
	    this.addPack({name: "MPP Classic", keys: Object.keys(this.piano.keys), ext: ".mp3", url: "./sounds/mppclassic/"}, true);
	}

	SoundSelector.prototype.addPack = function(pack, load) {
		var self = this;
		self.loading[pack.url || pack] = true;
		function add(obj) {
			var added = false;
			for (var i = 0; self.packs.length > i; i++) {
				if (obj.name == self.packs[i].name) {
					added = true;
					break;
				}
			}

			if (added) return console.warn("Sounds already added!!"); //no adding soundpacks twice D:<

			if (obj.url.substr(obj.url.length-1) != "/") obj.url = obj.url + "/";
			var html = document.createElement("li");
			html.classList = "pack";
			html.innerText = obj.name + " (" + obj.keys.length + " keys)";
			html.onclick = function() {
				self.loadPack(obj.name);
				self.notification.close();
			};
			obj.html = html;
			self.packs.push(obj);
			self.packs.sort(function(a, b) {
	            if(a.name < b.name) return -1;
	            if(a.name > b.name) return 1;
	            return 0;
	        });
	        if (load) self.loadPack(obj.name);
	        delete self.loading[obj.url];
		}

		if (typeof pack == "string") {
			var packUrl = pack;
			$.getJSON(packUrl + "info.json").done(function(json) {
				json.url = packUrl;
				add(json);
			}).fail(function() {
				delete self.loading[packUrl];
			});
		} else add(pack);
	};

	SoundSelector.prototype.addPacks = function(packs) {
		for (var i = 0; packs.length > i; i++) this.addPack(packs[i]);
	};

	SoundSelector.prototype.init = function() {
		var self = this;
		if (self.initialized) return console.warn("Sound selector already initialized!");

	    if (!!Object.keys(self.loading).length) return setTimeout(function() {
	        self.init();
	    }, 250);

	    $("#sound-btn").on("click", function() {
			if (document.getElementById("Notification-Sound-Selector") != null)
				return self.notification.close();
			var html = document.createElement("ul");
	        //$(html).append("<p>Current Sound: " + self.soundSelection + "</p>");

	        for (var i = 0; self.packs.length > i; i++) {
				var pack = self.packs[i];
				if (pack.name == self.soundSelection) pack.html.classList = "pack enabled";
				else pack.html.classList = "pack";
				html.appendChild(pack.html);
	        }

			self.notification = new Notification({title: "Sound Selector", html: html, id: "Sound-Selector", duration: -1, target: "#sound-btn"});
	    });
	    self.initialized = true;
	    self.loadPack(self.soundSelection, true);
	};

	SoundSelector.prototype.loadPack = function(pack, f) {
		for (var i = 0; this.packs.length > i; i++) {
			var p = this.packs[i];
			if (p.name == pack) {
				pack = p;
				break;
			}
		}
		if (typeof pack == "string") {
			console.warn("Sound pack does not exist! Loading default pack...");
	        return this.loadPack("MPP Classic");
		}

		if (pack.name == this.soundSelection && !f) return;
		if (pack.keys.length != Object.keys(this.piano.keys).length) {
			this.piano.keys = {};
			for (var i = 0; pack.keys.length > i; i++) this.piano.keys[pack.keys[i]] = this.keys[pack.keys[i]];
			this.piano.renderer.resize();
		}

		var self = this;
		for (var i in this.piano.keys) {
	        if (!this.piano.keys.hasOwnProperty(i)) continue;
	        (function() {
	            var key = self.piano.keys[i];
	            key.loaded = false;
	            var sampleUrl = pack.url + key.note + pack.ext;
	            var fallbackUrl = "https://game.multiplayerpiano.com/sounds/mppclassic/" + key.note + pack.ext;
	            self.piano.audio.load(key.note, sampleUrl, function() {
	                key.loaded = true;
	                key.timeLoaded = Date.now();
	            }, fallbackUrl);
	        })();
	    }
	    if(localStorage) localStorage.soundSelection = pack.name;
	    this.soundSelection = pack.name;
	};

	SoundSelector.prototype.removePack = function(name) {
		var found = false;
		for (var i = 0; this.packs.length > i; i++) {
			var pack = this.packs[i];
			if (pack.name == name) {
				this.packs.splice(i, 1);
				if (pack.name == this.soundSelection) this.loadPack(this.packs[0].name); //add mpp default if none?
				break;
			}
		}
		if (!found) console.warn("Sound pack not found!");
	};











// Pianoctor

////////////////////////////////////////////////////////////////

	var PianoKey = function(note, octave) {
		this.note = note + octave;
		this.baseNote = note;
		this.octave = octave;
		this.sharp = note.indexOf("s") != -1;
		this.loaded = false;
		this.timeLoaded = 0;
		this.domElement = null;
		this.timePlayed = 0;
		this.blips = [];
	};

	var Piano = function(rootElement) {
	
		var piano = this;
		piano.rootElement = rootElement;
		piano.keys = {};
		
		var white_spatial = 0;
		var black_spatial = 0;
		var black_it = 0;
		var black_lut = [2, 1, 2, 1, 1];
		var addKey = function(note, octave) {
			var key = new PianoKey(note, octave);
			piano.keys[key.note] = key;
			if(key.sharp) {
				key.spatial = black_spatial;
				black_spatial += black_lut[black_it % 5];
				++black_it;
			} else {
				key.spatial = white_spatial;
				++white_spatial;
			}
		}
		if(test_mode) {
			addKey("c", 2);
		} else {
			addKey("a", -1);
			addKey("as", -1);
			addKey("b", -1);
			var notes = "c cs d ds e f fs g gs a as b".split(" ");
			for(var oct = 0; oct < 7; oct++) {
				for(var i in notes) {
					addKey(notes[i], oct);
				}
			}
			addKey("c", 7);
		}


		this.renderer = new CanvasRenderer().init(this);
		
		window.addEventListener("resize", function() {
			piano.renderer.resize();
		});


		window.AudioContext = window.AudioContext || window.webkitAudioContext || undefined;
		var audio_engine = AudioEngineWeb;
		this.audio = new audio_engine().init();
	};

	Piano.prototype.play = function(note, vol, participant, delay_ms, lyric) {
		if(!this.keys.hasOwnProperty(note) || !participant) return;
		var key = this.keys[note];
		if(key.loaded) this.audio.play(key.note, vol, delay_ms, participant.id);
		if(gMidiOutTest) gMidiOutTest(key.note, vol * 100, delay_ms);
		var self = this;
		setTimeout(function() {
			self.renderer.visualize(key, participant.color);
			if(lyric) {

			}
			var jq_namediv = $(participant.nameDiv);
			jq_namediv.addClass("play");
			setTimeout(function() {
				jq_namediv.removeClass("play");
			}, 30);
		}, delay_ms || 0);
	};

	Piano.prototype.stop = function(note, participant, delay_ms) {
		if(!this.keys.hasOwnProperty(note)) return;
		var key = this.keys[note];
		if(key.loaded) this.audio.stop(key.note, delay_ms, participant.id);
		if(gMidiOutTest) gMidiOutTest(key.note, 0, delay_ms);
	};
	
	var gPiano = new Piano(document.getElementById("piano"));
	
	var gSoundSelector = new SoundSelector(gPiano);
	gSoundSelector.init();







	var gAutoSustain = false;
	var gSustain = false;

	var gHeldNotes = {};
	var gSustainedNotes = {};
	

	function ensureAudioReady() {
		if(gPiano && gPiano.audio && gPiano.audio.resume) {
			gPiano.audio.resume();
		}
	}

	function press(id, vol, bypassQuota) {
		if(bypassQuota) {
			gHeldNotes[id] = true;
			gSustainedNotes[id] = true;
			ensureAudioReady();
			gPiano.play(id, vol !== undefined ? vol : DEFAULT_VELOCITY, gClient.getOwnParticipant(), 0);
			gClient.startNote(id, vol);
			if(typeof PianoLearn !== "undefined") PianoLearn.onNotePressed(id);
			return;
		}
		if(!gClient.preventsPlaying() && gNoteQuota.spend(1)) {
			gHeldNotes[id] = true;
			gSustainedNotes[id] = true;
			gPiano.play(id, vol !== undefined ? vol : DEFAULT_VELOCITY, gClient.getOwnParticipant(), 0);
			gClient.startNote(id, vol);
			if(typeof PianoLearn !== "undefined") PianoLearn.onNotePressed(id);
		}
	}

	function release(id, bypassQuota) {
		if(!gHeldNotes[id]) return;
		gHeldNotes[id] = false;
		if(bypassQuota) {
			gPiano.stop(id, gClient.getOwnParticipant(), 0);
			gClient.stopNote(id);
			gSustainedNotes[id] = false;
			return;
		}
		if((gAutoSustain || gSustain) && !enableSynth) {
			gSustainedNotes[id] = true;
		} else if(gNoteQuota.spend(1)) {
			gPiano.stop(id, gClient.getOwnParticipant(), 0);
			gClient.stopNote(id);
			gSustainedNotes[id] = false;
		}
	}

	function pressSustain() {
		gSustain = true;
	}

	function releaseSustain() {
		gSustain = false;
		if(!gAutoSustain) {
			for(var id in gSustainedNotes) {
				if(gSustainedNotes.hasOwnProperty(id) && gSustainedNotes[id] && !gHeldNotes[id]) {
					gSustainedNotes[id] = false;
					if(gNoteQuota.spend(1)) {
						gPiano.stop(id, gClient.getOwnParticipant(), 0);
						gClient.stopNote(id);
					}
				}
			}
		}
	}







	function getParameterByName(name, url = window.location.href) {
		name = name.replace(/[\[\]]/g, '\\$&');
		var regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)'),
			results = regex.exec(url);
		if (!results) return null;
		if (!results[2]) return '';
		return decodeURIComponent(results[2].replace(/\+/g, ' '));
	}

// internet science

////////////////////////////////////////////////////////////////

	var channel_id = decodeURIComponent(getParameterByName('c') || 'lobby');
	// if(channel_id.substr(0, 1) == "/") channel_id = channel_id.substr(1);
	// if(channel_id == "") channel_id = "lobby";

	// Multiplayer: use public MPP server from any static host (GitHub Pages, ngrok, Netlify, etc.).
	// Only use a local WebSocket server when you open the page with ?ws=local AND run one on port 8081.
	var mppOrig = 'game.multiplayerpiano.com';
	var wsParam = getParameterByName('ws');
	var useLocalWs = wsParam === 'local';
	var wsUri;
	if(useLocalWs) {
		var wsPort = parseInt(getParameterByName('wsport'), 10) || 8081;
		var wsProto = window.location.protocol === 'https:' ? 'wss' : 'ws';
		wsUri = wsProto + '://' + window.location.hostname + ':' + wsPort;
	} else {
		wsUri = 'wss://' + mppOrig + ':443';
	}
	var gClient = new Client(wsUri);

	// Real-time room sync for the custom features (Blob Friend, Doodler, Emoji
	// Party, Sound Board, Party Game, room metronome, Room DJ controls). These
	// broadcast through a dedicated relay (relay-server.js) instead of abusing
	// the rate-limited public chat. Resolve the relay URL:
	//   ?relay=off            disable (chat fallback only)
	//   ?relay=ws://host:port explicit override
	//   default               same origin as the page: ws(s)://<host>/relay
	// The relay is served by relay-server.js on the SAME port as the app, so the
	// default always matches wherever the page was loaded from. (Serve the app
	// with `node relay-server.js` — run-servers.bat does this — for full sync.)
	var gRoomSync = null;
	(function() {
		var relayParam = getParameterByName('relay');
		var relayUri;
		if(relayParam === 'off') {
			relayUri = null;
		} else if(relayParam) {
			relayUri = relayParam;
		} else if(window.location.protocol === 'https:' || window.location.protocol === 'http:') {
			// same-origin relay path (host already includes the port)
			var rProto = window.location.protocol === 'https:' ? 'wss' : 'ws';
			var rHost = getParameterByName('relayhost') || window.location.host;
			relayUri = rProto + '://' + rHost + '/relay';
		} else {
			relayUri = null; // file:// — no relay reachable; open via the local server instead
		}
		if(typeof RoomSync !== "undefined" && relayUri) {
			gRoomSync = new RoomSync({
				uri: relayUri,
				channel: channel_id,
				getIdentity: function() {
					var me = gClient.getOwnParticipant();
					return { _id: (me && me._id) || "", name: (me && me.name) || "" };
				},
				onText: function(msg) { routeRoomSync(msg); }
			});
			gClient.roomSync = gRoomSync;
			gRoomSync.start();
			try { console.info("[Harmony] real-time sync via relay:", relayUri, "(open the same room/?c= on each client)"); } catch(e) {}
		} else {
			try { console.warn("[Harmony] relay disabled (" + (relayParam === 'off' ? "?relay=off" : "no reachable host") + ") — fun features fall back to rate-limited chat sync."); } catch(e) {}
		}
	})();

	gClient.on("kickban blocked", function(info) {
		$("#status").text((info && info.reason) || "Kickban not allowed.");
	});

	// Keep the relay channel mirrored to the room the USER asked for — NOT the
	// _id the public MPP server hands back. That server shards popular rooms
	// (e.g. "lobby" -> "lobby", "lobby2", ...), so two browsers opening the same
	// link can be put in different MPP rooms and would then sit on different
	// relay channels and never sync. desiredChannelId is identical for everyone
	// on the same URL, which is exactly what we want for shared blob/fun sync.
	gClient.on("ch", function(msg) {
		var ch = (gClient && gClient.desiredChannelId) || (msg && msg.ch && msg.ch._id);
		if(gRoomSync && ch) gRoomSync.setChannel(ch);
	});

	gClient.setChannel(channel_id);
	if(gRoomSync) gRoomSync.setChannel(channel_id);

	gClient.start();

	gClient.on("disconnect", function(evt) {
		console.log(evt);
	});

	// Setting status
	(function() {
		gClient.on("status", function(status) {
			$("#status").text(status);
		});
		gClient.on("count", function(count) {
			if(count > 0) {
				$("#status").html('<span class="number">'+count+'</span> '+(count==1? 'person is' : 'people are')+' playing');
				document.title = "Piano (" + count + ")";
			} else {
				document.title = "Multiplayer Piano";
			}
		});
	})();

	// Handle changes to participants
	(function() {
		gClient.on("participant added", function(part) {

			part.displayX = 150;
			part.displayY = 50;

			// add nameDiv
			var div = document.createElement("div");
			div.className = "name";
			div.participantId = part.id;
			div.textContent = part.name || "";
			div.style.backgroundColor = part.color || "#777";
			if(gClient.participantId === part.id) {
				$(div).addClass("me");
			}
			if(gClient.channel && gClient.channel.crown && gClient.channel.crown.participantId === part.id) {
				$(div).addClass("owner");
			}
			if(gPianoMutes.indexOf(part._id) !== -1) {
				$(part.nameDiv).addClass("muted-notes");
			}
			if(gChatMutes.indexOf(part._id) !== -1) {
				$(part.nameDiv).addClass("muted-chat");
			}
			div.style.display = "none";
			part.nameDiv = $("#names")[0].appendChild(div);
			$(part.nameDiv).fadeIn(2000);

			// sort names
			var arr = $("#names .name");
			arr.sort(function(a, b) {
				a = a.style.backgroundColor; // todo: sort based on user id instead
				b = b.style.backgroundColor;
				if (a > b) return 1;
				else if (a < b) return -1;
				else return 0;
			});
			$("#names").html(arr);

			// add cursorDiv
			if(gClient.participantId !== part.id || gSeeOwnCursor) {
				var div = document.createElement("div");
				div.className = "cursor";
				div.style.display = "none";
				part.cursorDiv = $("#cursors")[0].appendChild(div);
				$(part.cursorDiv).fadeIn(2000);

				var div = document.createElement("div");
				div.className = "name";
				div.style.backgroundColor = part.color || "#777"
				div.textContent = part.name || "";
				part.cursorDiv.appendChild(div);

			} else {
				part.cursorDiv = undefined;
			}
		});
		gClient.on("participant removed", function(part) {
			// remove nameDiv
			var nd = $(part.nameDiv);
			var cd = $(part.cursorDiv);
			cd.fadeOut(2000);
			nd.fadeOut(2000, function() {
				nd.remove();
				cd.remove();
				part.nameDiv = undefined;
				part.cursorDiv = undefined;
			});
		});
		gClient.on("participant update", function(part) {
			var name = part.name || "";
			var color = part.color || "#777";
			part.nameDiv.style.backgroundColor = color;
			part.nameDiv.textContent = name;
			$(part.cursorDiv)
			.find(".name")
			.text(name)
			.css("background-color", color);
		});
		gClient.on("ch", function(msg) {
			for(var id in gClient.ppl) {
				if(gClient.ppl.hasOwnProperty(id)) {
					var part = gClient.ppl[id];
					if(part.id === gClient.participantId) {
						$(part.nameDiv).addClass("me");
					} else {
						$(part.nameDiv).removeClass("me");
					}
					if(msg.ch.crown && msg.ch.crown.participantId === part.id) {
						$(part.nameDiv).addClass("owner");
						$(part.cursorDiv).addClass("owner");
					} else {
						$(part.nameDiv).removeClass("owner");
						$(part.cursorDiv).removeClass("owner");
					}
					if(gPianoMutes.indexOf(part._id) !== -1) {
						$(part.nameDiv).addClass("muted-notes");
					} else {
						$(part.nameDiv).removeClass("muted-notes");
					}
					if(gChatMutes.indexOf(part._id) !== -1) {
						$(part.nameDiv).addClass("muted-chat");
					} else {
						$(part.nameDiv).removeClass("muted-chat");
					}
				}
			}
		});
		var TRAIL_EMOJIS = ["✨", "💫", "⭐", "🌟", "💖", "🔥", "🌈", "🦄", "🍭", "🎈"];
		function trailEmojiFor(part) {
			if(part._trailEmoji) return part._trailEmoji;
			var key = String(part._id || part.id || "");
			var h = 0;
			for(var i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
			part._trailEmoji = TRAIL_EMOJIS[h % TRAIL_EMOJIS.length];
			return part._trailEmoji;
		}
		var $cursors = $("#cursors");
		function spawnTrail(xPct, yPct, emoji) {
			if(!$cursors.length) return;
			var s = document.createElement("span");
			s.className = "cursor-trail";
			s.textContent = emoji;
			s.style.left = xPct + "%";
			s.style.top = yPct + "%";
			$cursors[0].appendChild(s);
			setTimeout(function() { if(s.parentNode) s.parentNode.removeChild(s); }, 900);
		}
		function updateCursor(msg) {
			const part = gClient.ppl[msg.id];
			if (part && part.cursorDiv) {
				part.cursorDiv.style.left = msg.x + "%";
				part.cursorDiv.style.top = msg.y + "%";
				var now = Date.now();
				if(!part._trailT || now - part._trailT > 65) {
					part._trailT = now;
					spawnTrail(msg.x, msg.y, trailEmojiFor(part));
				}
			}
		}
		gClient.on("m", updateCursor);
		gClient.on("participant added", updateCursor);
	})();


	// Handle changes to crown
	(function() {
		var jqcrown = $('<div id="crown"></div>').appendTo(document.body).hide();
		var jqcountdown = $('<span></span>').appendTo(jqcrown);
		var countdown_interval;
		jqcrown.click(function() {
			gClient.sendArray([{m: "chown", id: gClient.participantId}]);
		});
		gClient.on("ch", function(msg) {
			if(msg.ch.crown) {
				var crown = msg.ch.crown;
				if(!crown.participantId || !gClient.ppl[crown.participantId]) {
					var land_time = crown.time + 2000 - gClient.serverTimeOffset;
					var avail_time = crown.time + 15000 - gClient.serverTimeOffset;
					jqcountdown.text("");
					jqcrown.show();
					if(land_time - Date.now() <= 0) {
						jqcrown.css({"left": crown.endPos.x + "%", "top": crown.endPos.y + "%"});
					} else {
						jqcrown.css({"left": crown.startPos.x + "%", "top": crown.startPos.y + "%"});
						jqcrown.addClass("spin");
						jqcrown.animate({"left": crown.endPos.x + "%", "top": crown.endPos.y + "%"}, 2000, "linear", function() {
							jqcrown.removeClass("spin");
						});
					}
					clearInterval(countdown_interval);
					countdown_interval = setInterval(function() {
						var time = Date.now();
						if(time >= land_time) {
							var ms = avail_time - time;
							if(ms > 0) {
								jqcountdown.text(Math.ceil(ms / 1000) + "s");
							} else {
								jqcountdown.text("");
								clearInterval(countdown_interval);
							}
						}
					}, 1000);
				} else {
					jqcrown.hide();
				}
			} else {
				jqcrown.hide();
			}
		});
		gClient.on("disconnect", function() {
			jqcrown.fadeOut(2000);
		});
	})();

	
	// Playing notes
	gClient.on("n", function(msg) {
		var t = msg.t - gClient.serverTimeOffset + TIMING_TARGET - Date.now();
		var participant = gClient.findParticipantById(msg.p);
		if(gPianoMutes.indexOf(participant._id) !== -1)
			return;
		for(var i = 0; i < msg.n.length; i++) {
			var note = msg.n[i];
			var ms = t + (note.d || 0);
			if(ms < 0) {
				ms = 0;
			}
			else if(ms > 10000) continue;
			if(note.s) {
				gPiano.stop(note.n, participant, ms);
			} else {
				var vel = (typeof note.v !== "undefined")? parseFloat(note.v) : DEFAULT_VELOCITY;
				if(!vel) vel = 0;
				else if(vel < 0) vel = 0;
				else if (vel > 1) vel = 1;
				gPiano.play(note.n, vel, participant, ms);
				if(enableSynth) {
					gPiano.stop(note.n, participant, ms + 1000);
				}
			}
		}
	});

	// Send cursor updates
	var mx = 0, last_mx = -10, my = 0, last_my = -10;
	setInterval(function() {
		if(Math.abs(mx - last_mx) > 0.1 || Math.abs(my - last_my) > 0.1) {
			last_mx = mx;
			last_my = my;
			gClient.sendArray([{m: "m", x: mx, y: my}]);
			if(gSeeOwnCursor) {
				gClient.emit("m", { m: "m", id: gClient.participantId, x: mx, y: my });
			}
			var part = gClient.getOwnParticipant();
			if(part) {
				part.x = mx;
				part.y = my;
			}
		}
	}, 50);
	$(document).mousemove(function(event) {
		mx = ((event.pageX / $(window).width()) * 100).toFixed(2);
		my = ((event.pageY / $(window).height()) * 100).toFixed(2);
	});


	// Room settings button
	(function() {
		gClient.on("ch", function(msg) {
			if(gClient.isOwner()) {
				$("#room-settings-btn").show();
			} else {
				$("#room-settings-btn").hide();
			}
			$("#room-media-btn").addClass("room-dj-visible");
		});
		gClient.on("connect", function() {
			$("#room-media-btn").addClass("room-dj-visible");
		});
		gClient.on("disconnect", function() {
			$("#room-media-btn").removeClass("room-dj-visible room-dj-playing");
			document.body.classList.remove("room-dj-playing", "room-media-active");
		});
		$("#room-settings-btn").click(function(evt) {
			if(gClient.channel && gClient.isOwner()) {
				var settings = gClient.channel.settings;
				openModal("#room-settings");
				setTimeout(function() {
					$("#room-settings .checkbox[name=visible]").prop("checked", settings.visible);
					$("#room-settings .checkbox[name=chat]").prop("checked", settings.chat);
					$("#room-settings .checkbox[name=crownsolo]").prop("checked", settings.crownsolo);
					$("#room-settings input[name=color]").val(settings.color);
				}, 100);
			}
		});
		$("#room-settings .submit").click(function() {
			var settings = {
				visible: $("#room-settings .checkbox[name=visible]").is(":checked"),
				chat: $("#room-settings .checkbox[name=chat]").is(":checked"),
				crownsolo: $("#room-settings .checkbox[name=crownsolo]").is(":checked"),
				color: $("#room-settings input[name=color]").val()
			};
			gClient.setChannelSettings(settings);
			closeModal();
		});
		$("#room-settings .drop-crown").click(function() {
			closeModal();
			if(confirm("This will drop the crown...!"))
				gClient.sendArray([{m: "chown"}]);
		});
	})();

	// Handle notifications
	gClient.on("notification", function(msg) {
		new Notification(msg);
	});

	// Don't foget spin
	gClient.on("ch", function(msg) {
		var chidlo = msg.ch._id.toLowerCase();
		if(chidlo === "spin" || chidlo.substr(-5) === "/spin") {
			$("#piano").addClass("spin");
		} else {
			$("#piano").removeClass("spin");
		}
	});

	/*function eb() {
		if(gClient.channel && gClient.channel._id.toLowerCase() === "test/fishing") {
			ebsprite.start(gClient);
		} else {
			ebsprite.stop();
		}
	}
	if(ebsprite) {
		gClient.on("ch", eb);
		eb();
	}*/

	// Crownsolo notice
	gClient.on("ch", function(msg) {
		let notice = "";
		let has_notice = false;
		if(msg.ch.settings.crownsolo) {
			has_notice = true;
			notice += '<p>This room is set to "only the owner can play."</p>';
		}
		if(msg.ch.settings['no cussing']){
			has_notice = true;
			notice += '<p>This room is set to "no cussing."</p>';
		}
		let notice_div = $("#room-notice");
		if(has_notice) {
			notice_div.html(notice);
			if(notice_div.is(':hidden')) notice_div.fadeIn(1000);
		} else {
			if(notice_div.is(':visible')) notice_div.fadeOut(1000);
		}
	});
	gClient.on("disconnect", function() {
		$("#room-notice").fadeOut(1000);
	});


	// Background color
	(function() {
		var old_color1 = new Color("#000000");
		var old_color2 = new Color("#000000");
		function setColor(hex, hex2) {
			var color1 = new Color(hex);
			var color2 = new Color(hex2 || hex);
			if(!hex2)
				color2.add(-0x40, -0x40, -0x40);

			var bottom = document.getElementById("bottom");
			
			var duration = 500;
			var step = 0;
			var steps = 30;
			var step_ms = duration / steps;
			var difference = new Color(color1.r, color1.g, color1.b);
			difference.r -= old_color1.r;
			difference.g -= old_color1.g;
			difference.b -= old_color1.b;
			var inc1 = new Color(difference.r / steps, difference.g / steps, difference.b / steps);
			difference = new Color(color2.r, color2.g, color2.b);
			difference.r -= old_color2.r;
			difference.g -= old_color2.g;
			difference.b -= old_color2.b;
			var inc2 = new Color(difference.r / steps, difference.g / steps, difference.b / steps);
			var iv;
			iv = setInterval(function() {
				old_color1.add(inc1.r, inc1.g, inc1.b);
				old_color2.add(inc2.r, inc2.g, inc2.b);
				document.body.style.background = "radial-gradient(ellipse at center, "+old_color1.toHexa()+" 0%,"+old_color2.toHexa()+" 100%)";
				bottom.style.background = old_color2.toHexa();
				if(++step >= steps) {
					clearInterval(iv);
					old_color1 = color1;
					old_color2 = color2;
					document.body.style.background = "radial-gradient(ellipse at center, "+color1.toHexa()+" 0%,"+color2.toHexa()+" 100%)";
					bottom.style.background = color2.toHexa();
				}
			}, step_ms);
		}

		function setColorToDefault() {
			setColor("#000000", "#000000");
		}

		setColorToDefault();

		gClient.on("ch", function(ch) {
			if(ch.ch.settings) {
				if(ch.ch.settings.color) {
					setColor(ch.ch.settings.color, ch.ch.settings.color2);
				} else {
					setColorToDefault();
				}
			}
		});
	})();





	var gPianoMutes = (localStorage.pianoMutes ? localStorage.pianoMutes : "").split(',').filter(v => v);
	var gChatMutes = (localStorage.chatMutes ? localStorage.chatMutes : "").split(',').filter(v => v);


 	









	

	
	



	var volume_slider = document.getElementById("volume-slider");
	volume_slider.value = gPiano.audio.volume;
	$("#volume-label").text("Volume: " + Math.floor(gPiano.audio.volume * 100) + "%");
	volume_slider.addEventListener("input", function(evt) {
		var v = +volume_slider.value;
		gPiano.audio.setVolume(v);
		if (window.localStorage) localStorage.volume = v;
		$("#volume-label").text("Volume: " + Math.floor(v * 100) + "%");
	});




	var Note = function(note, octave) {
		this.note = note;
		this.octave = octave || 0;
	};



	var n = function(a, b) { return {note: new Note(a, b), held: false}; };
	var key_binding = {
		65: n("gs"),
		90: n("a"),
		83: n("as"),
		88: n("b"),
		67: n("c", 1),
		70: n("cs", 1),
		86: n("d", 1),
		71: n("ds", 1),
		66: n("e", 1),
		78: n("f", 1),
		74: n("fs", 1),
		77: n("g", 1),
		75: n("gs", 1),
		188: n("a", 1),
		76: n("as", 1),
		190: n("b", 1),
		191: n("c", 2),
		222: n("cs", 2),

		49: n("gs", 1),
		81: n("a", 1),
		50: n("as", 1),
		87: n("b", 1),
		69: n("c", 2),
		52: n("cs", 2),
		82: n("d", 2),
		53: n("ds", 2),
		84: n("e", 2),
		89: n("f", 2),
		55: n("fs", 2),
		85: n("g", 2),
		56: n("gs", 2),
		73: n("a", 2),
		57: n("as", 2),
		79: n("b", 2),
		80: n("c", 3),
		189: n("cs", 3),
		173: n("cs", 3), // firefox why
		219: n("d", 3),
		187: n("ds", 3),
		61: n("ds", 3), // firefox why
		221: n("e", 3)
	};

	var capsLockKey = false;

	var transpose_octave = 0;

	function isTypingTarget() {
		var el = document.activeElement;
		if(!el || el === document.body) return false;
		var tag = el.tagName;
		if(tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
		return !!el.isContentEditable;
	}

	function isModifierShortcut(evt) {
		return evt.ctrlKey || evt.metaKey || evt.altKey;
	}
	
	function handleKeyDown(evt) {
		if(isTypingTarget()) return;
		var code = parseInt(evt.keyCode);
		if(typeof gMetronome !== "undefined" && gMetronome) {
			if((evt.ctrlKey || evt.metaKey) && !evt.altKey) {
				if(code === 219) {
					if(!canControlRoomMetronome()) return;
					gMetronome.nudgeBpm(-5);
					syncMetronomeControlsFromEngine();
					evt.preventDefault();
					return false;
				}
				if(code === 221) {
					if(!canControlRoomMetronome()) return;
					gMetronome.nudgeBpm(5);
					syncMetronomeControlsFromEngine();
					evt.preventDefault();
					return false;
				}
			}
			if(evt.shiftKey && !evt.ctrlKey && !evt.metaKey && !evt.altKey) {
				if(code === 77) {
					if(gClient && gClient.isConnected() && !canControlRoomMetronome()) {
						setMetronomePanelOpen(true);
					} else {
						ensureAudioReady();
						toggleRoomMetronome();
					}
					evt.preventDefault();
					return false;
				}
				if(code === 84 && canControlRoomMetronome()) {
					ensureAudioReady();
					gMetronome.tap();
					syncMetronomeControlsFromEngine();
					evt.preventDefault();
					return false;
				}
			}
		}
		if(isModifierShortcut(evt)) return;
		//console.log(evt);
		if(key_binding[code] !== undefined) {
			var binding = key_binding[code];
			if(!binding.held) {
				binding.held = true;

				var note = binding.note;
				var octave = 1 + note.octave + transpose_octave;
				if(evt.shiftKey) ++octave;
				else if(capsLockKey || evt.ctrlKey) --octave;
				note = note.note + octave;
				var vol = velocityFromMouseY();
				press(note, vol);
			}

			if(++gKeyboardSeq == 3) {
				gKnowsYouCanUseKeyboard = true;
				if(window.gKnowsYouCanUseKeyboardTimeout) clearTimeout(gKnowsYouCanUseKeyboardTimeout);
				if(localStorage) localStorage.knowsYouCanUseKeyboard = true;
				if(window.gKnowsYouCanUseKeyboardNotification) gKnowsYouCanUseKeyboardNotification.close();
			}

			evt.preventDefault();
			evt.stopPropagation();
			return false;
		} else if(code == 20) { // Caps Lock
			capsLockKey = true;
			evt.preventDefault();
		} else if(code === 0x20) { // Space Bar
			pressSustain();
			evt.preventDefault();
		} else if((code === 38 || code === 39) && transpose_octave < 3) {
			++transpose_octave;
		} else if((code === 40 || code === 37) && transpose_octave > -2) {
			--transpose_octave;
		} else if(code == 9) { // Tab (don't tab away from the piano)
			evt.preventDefault();
		} else if(code == 8) { // Backspace (don't navigate Back)
			gAutoSustain = !gAutoSustain;
			evt.preventDefault();
		}
	};

	function handleKeyUp(evt) {
		if(isTypingTarget()) return;
		if(isModifierShortcut(evt)) return;
		var code = parseInt(evt.keyCode);
		if(key_binding[code] !== undefined) {
			var binding = key_binding[code];
			if(binding.held) {
				binding.held = false;
				
				var note = binding.note;
				var octave = 1 + note.octave + transpose_octave;
				if(evt.shiftKey) ++octave;
				else if(capsLockKey || evt.ctrlKey) --octave;
				note = note.note + octave;
				release(note);
			}

			evt.preventDefault();
			evt.stopPropagation();
			return false;
		} else if(code == 20) { // Caps Lock
			capsLockKey = false;
			evt.preventDefault();
		} else if(code === 0x20) { // Space Bar
			releaseSustain();
			evt.preventDefault();
		}
	};

	function handleKeyPress(evt) {
		if(isTypingTarget()) return;
		if(isModifierShortcut(evt)) return;
		evt.preventDefault();
		evt.stopPropagation();
		if(evt.keyCode == 27 || evt.keyCode == 13) {
			//$("#chat input").focus();
		}
		return false;
	};

	var recapListener = function(evt) {
		captureKeyboard();
	};

	function captureKeyboard() {
		$("#piano").off("mousedown", recapListener);
		$("#piano").off("touchstart", recapListener);
		$(document).on("keydown", handleKeyDown );
		$(document).on("keyup", handleKeyUp);
		$(window).on("keypress", handleKeyPress );
	};

	function releaseKeyboard() {
		$(document).off("keydown", handleKeyDown );
		$(document).off("keyup", handleKeyUp);
		$(window).off("keypress", handleKeyPress );
		$("#piano").on("mousedown", recapListener);
		$("#piano").on("touchstart", recapListener);
	};

	captureKeyboard();


	var velocityFromMouseY = function() {
		return 0.1 + (my / 100) * 0.6;
	};





	// NoteQuota
	var gNoteQuota = (function() {
		var last_rat = 0;
		var nqjq = $("#quota .value");
		setInterval(function() {
			gNoteQuota.tick();
		}, 2000);
		return new NoteQuota(function(points) {
			// update UI
			var rat = (points / this.max) * 100;
			if(rat <= last_rat)
				nqjq.stop(true, true).css("width", rat.toFixed(0) + "%");
			else
				nqjq.stop(true, true).animate({"width": rat.toFixed(0) + "%"}, 2000, "linear");
			last_rat = rat;
		});
	})();
	gClient.on("nq", function(nq_params) {
		gNoteQuota.setParams(nq_params);
	});
	gClient.on("disconnect", function() {
		gNoteQuota.setParams(NoteQuota.PARAMS_OFFLINE);
	});



	// click participant names
	(function() {
		var ele = document.getElementById("names");
		var touchhandler = function(e) {
			var target_jq = $(e.target);
			if(target_jq.hasClass("name")) {
				target_jq.addClass("play");
				if(e.target.participantId == gClient.participantId) {
					openModal("#rename", "input[name=name]");
					setTimeout(function() {
						$("#rename input[name=name]").val(gClient.ppl[gClient.participantId].name);
						$("#rename input[name=color]").val(gClient.ppl[gClient.participantId].color);
					}, 100);
				} else if(e.target.participantId) {
					var id = e.target.participantId;
					var part = gClient.ppl[id] || null;
					if(part) {
						participantMenu(part);
						e.stopPropagation();
					}
				}
			}
		};
		ele.addEventListener("mousedown", touchhandler);
		ele.addEventListener("touchstart", touchhandler);
		var releasehandler = function(e) {
			$("#names .name").removeClass("play");
		};
		document.body.addEventListener("mouseup", releasehandler);
		document.body.addEventListener("touchend", releasehandler);

		var removeParticipantMenus = function() {
			$(".participant-menu").remove();
			$(".participantSpotlight").hide();
			document.removeEventListener("mousedown", removeParticipantMenus);
			document.removeEventListener("touchstart", removeParticipantMenus);
		};

		var participantMenu = function(part) {
			if(!part) return;
			removeParticipantMenus();
			document.addEventListener("mousedown", removeParticipantMenus);
			document.addEventListener("touchstart", removeParticipantMenus);
			$("#" + part.id).find(".enemySpotlight").show();
			var menu = $('<div class="participant-menu"></div>');
			$("body").append(menu);
			// move menu to name position
			var jq_nd = $(part.nameDiv);
			var pos = jq_nd.position();
			menu.css({
				"top": pos.top + jq_nd.height() + 15,
				"left": pos.left + 6,
				"background": part.color || "black"
			});
			menu.on("mousedown touchstart", function(evt) {
				evt.stopPropagation();
				var target = $(evt.target);
				if(target.hasClass("menu-item")) {
					target.addClass("clicked");
					menu.fadeOut(200, function() {
						removeParticipantMenus();
					});
				}
			});
			// this spaces stuff out but also can be used for informational
			$('<div class="info"></div>').appendTo(menu).text(part._id);
			// add menu items
			if(gPianoMutes.indexOf(part._id) == -1) {
				$('<div class="menu-item">Mute Notes</div>').appendTo(menu)
				.on("mousedown touchstart", function(evt) {
					gPianoMutes.push(part._id);
					if(localStorage) localStorage.pianoMutes = gPianoMutes.join(',');
					$(part.nameDiv).addClass("muted-notes");
				});
			} else {
				$('<div class="menu-item">Unmute Notes</div>').appendTo(menu)
				.on("mousedown touchstart", function(evt) {
					var i;
					while((i = gPianoMutes.indexOf(part._id)) != -1)
						gPianoMutes.splice(i, 1);
					if(localStorage) localStorage.pianoMutes = gPianoMutes.join(',');
					$(part.nameDiv).removeClass("muted-notes");
				});
			}
			if(gChatMutes.indexOf(part._id) == -1) {
				$('<div class="menu-item">Mute Chat</div>').appendTo(menu)
				.on("mousedown touchstart", function(evt) {
					gChatMutes.push(part._id);
					if(localStorage) localStorage.chatMutes = gChatMutes.join(',');
					$(part.nameDiv).addClass("muted-chat");
				});
			} else {
				$('<div class="menu-item">Unmute Chat</div>').appendTo(menu)
				.on("mousedown touchstart", function(evt) {
					var i;
					while((i = gChatMutes.indexOf(part._id)) != -1)
						gChatMutes.splice(i, 1);
					if(localStorage) localStorage.chatMutes = gChatMutes.join(',');
					$(part.nameDiv).removeClass("muted-chat");
				});
			}
			if(!(gPianoMutes.indexOf(part._id) >= 0) || !(gChatMutes.indexOf(part._id) >= 0)) {
				$('<div class="menu-item">Mute Completely</div>').appendTo(menu)
				.on("mousedown touchstart", function(evt) {
					gPianoMutes.push(part._id);
					if(localStorage) localStorage.pianoMutes = gPianoMutes.join(',');
					gChatMutes.push(part._id);
					if(localStorage) localStorage.chatMutes = gChatMutes.join(',');
					$(part.nameDiv).addClass("muted-notes");
					$(part.nameDiv).addClass("muted-chat");
				});
			}
			if((gPianoMutes.indexOf(part._id) >= 0) || (gChatMutes.indexOf(part._id) >= 0)) {
				$('<div class="menu-item">Unmute Completely</div>').appendTo(menu)
				.on("mousedown touchstart", function(evt) {
					var i;
					while((i = gPianoMutes.indexOf(part._id)) != -1)
						gPianoMutes.splice(i, 1);
					while((i = gChatMutes.indexOf(part._id)) != -1)
						gChatMutes.splice(i, 1);
					if(localStorage) localStorage.pianoMutes = gPianoMutes.join(',');
					if(localStorage) localStorage.chatMutes = gChatMutes.join(',');
					$(part.nameDiv).removeClass("muted-notes");
					$(part.nameDiv).removeClass("muted-chat");
				});
			}
			if(gClient.isOwner()) {
				$('<div class="menu-item give-crown">Give Crown</div>').appendTo(menu)
				.on("mousedown touchstart", function(evt) {
					if(confirm("Give room ownership to "+part.name+"?"))
						gClient.sendArray([{m: "chown", id: part.id}]);
				});
				$('<div class="menu-item kickban">Kickban</div>').appendTo(menu)
				.on("mousedown touchstart", function(evt) {
					evt.stopPropagation();
					var check = gClient.canKickBanParticipant(part);
					if(!check.allowed) {
						$("#status").text(check.reason || "Kickban not allowed.");
						return;
					}
					var minutes = prompt("How many minutes? (0-60)", "30");
					if(minutes === null) return;
					minutes = parseFloat(minutes) || 0;
					var ms = minutes * 60 * 1000;
					gClient.sendArray([{m: "kickban", _id: part._id, ms: ms}]);
				});
			}
			menu.fadeIn(100);
		};
	})();
	















// Notification class

////////////////////////////////////////////////////////////////

	var Notification = function(par) {
		if(this instanceof Notification === false) throw("yeet");
		EventEmitter.call(this);

		var par = par || {};

		this.id = "Notification-" + (par.id || Math.random());
		this.title = par.title || "";
		this.text = par.text || "";
		this.html = par.html || "";
		this.target = $(par.target || "#piano");
		this.duration = par.duration || 30000;
		this["class"] = par["class"] || "classic";
		
		var self = this;
		var eles = $("#" + this.id);
		if(eles.length > 0) {
			eles.remove();
		}
		this.domElement = $('<div class="notification"><div class="notification-body"><div class="title"></div>' +
			'<div class="text"></div></div><div class="x">Ⓧ</div></div>');
		this.domElement[0].id = this.id;
		this.domElement.addClass(this["class"]);
		this.domElement.find(".title").text(this.title);
		if(this.text.length > 0) {
			this.domElement.find(".text").text(this.text);
		} else if(this.html instanceof HTMLElement) {
			this.domElement.find(".text")[0].appendChild(this.html);
		} else if(this.html.length > 0) {
			this.domElement.find(".text").html(this.html);
		}
		document.body.appendChild(this.domElement.get(0));
		
		this.position();
		this.onresize = function() {
			self.position();
		};
		window.addEventListener("resize", this.onresize);

		this.domElement.find(".x").click(function() {
			self.close();
		});

		if(this.duration > 0) {
			setTimeout(function() {
				self.close();
			}, this.duration);
		}

		return this;
	}

	mixin(Notification.prototype, EventEmitter.prototype);
	Notification.prototype.constructor = Notification;

	Notification.prototype.position = function() {
		var pos = this.target.offset();
		var x = pos.left - (this.domElement.width() / 2) + (this.target.width() / 4);
		var y = pos.top - this.domElement.height() - 8;
		var width = this.domElement.width();
		if(x + width > $("body").width()) {
			x -= ((x + width) - $("body").width());
		}
		if(x < 0) x = 0;
		this.domElement.offset({left: x, top: y});
	};

	Notification.prototype.close = function() {
		var self = this;
		window.removeEventListener("resize",  this.onresize);
		this.domElement.fadeOut(500, function() {
			self.domElement.remove();
			self.emit("close");
		});
	};















// set variables from settings or set settings

////////////////////////////////////////////////////////////////

	var gKeyboardSeq = 0;
	var gKnowsYouCanUseKeyboard = false;
	if(localStorage && localStorage.knowsYouCanUseKeyboard) gKnowsYouCanUseKeyboard = true;
	if(!gKnowsYouCanUseKeyboard) {
		window.gKnowsYouCanUseKeyboardTimeout = setTimeout(function() {
			window.gKnowsYouCanUseKeyboardNotification = new Notification({title: "Did you know!?!",
				text: "You can play the piano with your keyboard, too.  Try it!", target: "#piano", duration: 10000});
		}, 30000);
	}




	if(window.localStorage) {

		if(localStorage.volume) {
			var savedVol = parseFloat(localStorage.volume);
			if(isNaN(savedVol) || savedVol < 0.05) savedVol = 0.6;
			volume_slider.value = savedVol;
			gPiano.audio.setVolume(savedVol);
			localStorage.volume = savedVol;
			$("#volume-label").text("Volume: " + Math.floor(gPiano.audio.volume * 100) + "%");
		}
		else localStorage.volume = gPiano.audio.volume;

		window.gHasBeenHereBefore = (localStorage.gHasBeenHereBefore || false);
		if(gHasBeenHereBefore) {
		}
		localStorage.gHasBeenHereBefore = true;
		
	}
	
	
	
	
	if(gDontShow) {
		$(".ad1, #social, #banner, #corner-banner").hide();
	}

	if(typeof CornerBanner !== "undefined") {
		CornerBanner.init();
	}













// New room, change room

////////////////////////////////////////////////////////////////

	$("#room > .info").text("--");

	var gRoomList = {};
	var gLsSubscribers = 0;
	var gRoomProbeWs = null;
	var gRoomProbeBusy = false;
	var gRoomProbeGen = 0;
	var HARMONY_KNOWN_ROOMS_KEY = "harmonyKnownRooms";
	var HARMONY_ROOM_CACHE_KEY = "harmonyRoomCache";

	function isRoomPrivate(room) {
		if(!room || !room.settings) return false;
		return room.settings.visible === false;
	}

	function isRoomPublic(room) {
		return !isRoomPrivate(room);
	}

	function normalizeRoomSettings(settings) {
		settings = settings || {};
		return {
			lobby: !!settings.lobby,
			visible: settings.visible !== false,
			chat: settings.chat !== false,
			crownsolo: !!settings.crownsolo,
			'no cussing': !!settings['no cussing'],
			color: settings.color
		};
	}

	function normalizeRoomEntry(channel, count, extra) {
		extra = extra || {};
		var settings = normalizeRoomSettings(channel.settings);
		return {
			_id: channel._id,
			count: count != null ? count : 0,
			settings: settings,
			banned: !!extra.banned,
			_source: extra._source || "live"
		};
	}

	function loadKnownRoomNames() {
		try {
			var list = JSON.parse(localStorage.getItem(HARMONY_KNOWN_ROOMS_KEY) || "[]");
			if(!Array.isArray(list)) return [];
			return list.filter(function(n) { return typeof n === "string" && n.length > 0; });
		} catch(e) {
			return [];
		}
	}

	function rememberRoomName(name) {
		if(!name || name === "lobby") return;
		var list = loadKnownRoomNames();
		if(list.indexOf(name) === -1) {
			list.push(name);
			if(list.length > 800) list = list.slice(-800);
			try {
				localStorage.setItem(HARMONY_KNOWN_ROOMS_KEY, JSON.stringify(list));
			} catch(e) {}
		}
	}

	function loadRoomCache() {
		try {
			var data = JSON.parse(localStorage.getItem(HARMONY_ROOM_CACHE_KEY) || "{}");
			for(var k in data) {
				if(!data.hasOwnProperty(k)) continue;
				var room = data[k];
				if(!room || !room._id) continue;
				room.settings = normalizeRoomSettings(room.settings);
				gRoomList[room._id] = room;
			}
		} catch(e) {}
	}

	function saveRoomCache() {
		try {
			localStorage.setItem(HARMONY_ROOM_CACHE_KEY, JSON.stringify(gRoomList));
		} catch(e) {}
	}

	function setAllRoomsScanStatus(text, scanning) {
		var el = $("#all-rooms .all-rooms-scan-status");
		el.text(text || "");
		el.toggleClass("scanning", !!scanning);
	}

	function subscribeRoomList() {
		if(gLsSubscribers === 0) {
			gClient.sendArray([
				{m: "+ls"},
				{m: "+ls", all: true},
				{m: "+ls", private: true},
				{m: "+ls", hidden: true}
			]);
		}
		++gLsSubscribers;
	}

	function unsubscribeRoomList() {
		if(gLsSubscribers <= 0) return;
		--gLsSubscribers;
		if(gLsSubscribers === 0) {
			gClient.sendArray([{m: "-ls"}]);
		}
	}

	function stopPrivateRoomProbe() {
		++gRoomProbeGen;
		gRoomProbeBusy = false;
		if(gRoomProbeWs) {
			try { gRoomProbeWs.close(); } catch(e) {}
			gRoomProbeWs = null;
		}
	}

	function roomCssEscape(name) {
		return (name + '').replace(/[\\"']/g, '\\$&').replace(/\u0000/g, '\\0');
	}

	function applyRoomClasses($el, room) {
		var settings = normalizeRoomSettings(room.settings);
		$el.toggleClass("lobby", !!settings.lobby);
		$el.toggleClass("no-chat", !settings.chat);
		$el.toggleClass("crownsolo", !!settings.crownsolo);
		$el.toggleClass("no-cussing", !!settings['no cussing']);
		$el.toggleClass("not-visible", isRoomPrivate({settings: settings}));
		$el.toggleClass("banned", !!room.banned);
	}

	function registerRoom(room, source) {
		if(!room || !room._id) return;
		room.settings = normalizeRoomSettings(room.settings);
		if(source) room._source = source;
		gRoomList[room._id] = room;
		rememberRoomName(room._id);
		saveRoomCache();
	}

	function registerRoomFromChannel(channel, ppl, source) {
		var count = ppl ? Object.keys(ppl).length : 0;
		registerRoom(normalizeRoomEntry(channel, count, {_source: source || "channel"}), source);
	}

	function updateRoomDropdownEntry(room) {
		var info = $("#room .info[roomname=\"" + roomCssEscape(room._id) + "\"]");
		if(info.length == 0) {
			info = $("<div class=\"info\"></div>");
			info.attr("roomname", room._id);
			$("#room .more").append(info);
		}
		info.text(room._id + " (" + room.count + ")");
		applyRoomClasses(info, room);
	}

	function getAllRoomsFilter() {
		var btn = $("#all-rooms .filter-btn.active");
		return btn.length ? btn.data("filter") : "all";
	}

	function renderAllRoomsList(filter) {
		filter = filter || getAllRoomsFilter();
		var $list = $("#all-rooms-list");
		if(!$list.length) return;

		var rooms = [];
		var publicCount = 0;
		var privateCount = 0;
		for(var k in gRoomList) {
			if(!gRoomList.hasOwnProperty(k)) continue;
			var room = gRoomList[k];
			if(isRoomPublic(room)) ++publicCount;
			if(isRoomPrivate(room)) ++privateCount;
			if(filter === "public" && !isRoomPublic(room)) continue;
			if(filter === "private" && !isRoomPrivate(room)) continue;
			rooms.push(room);
		}

		rooms.sort(function(a, b) {
			if(a.settings.lobby && !b.settings.lobby) return -1;
			if(!a.settings.lobby && b.settings.lobby) return 1;
			return (b.count || 0) - (a.count || 0);
		});

		$list.empty();
		if(rooms.length === 0) {
			var emptyMsg = "No rooms in this filter yet.";
			if(filter === "private") {
				emptyMsg = "No private rooms found yet. Visit a private room, use Find by name, or wait for scan to finish.";
			} else if(filter === "all") {
				emptyMsg = "No rooms yet — connect to the server first.";
			}
			$list.append("<div class=\"empty\">" + emptyMsg + "</div>");
		} else {
			for(var i = 0; i < rooms.length; i++) {
				var r = rooms[i];
				var label = isRoomPrivate(r) ? "private" : "public";
				var $item = $("<div class=\"room-item\"></div>");
				$item.attr("roomname", r._id);
				$item.append($("<span class=\"name\"></span>").text(r._id));
				$item.append($("<span class=\"meta\"></span>").text((r.count || 0) + " · " + label));
				applyRoomClasses($item, r);
				$list.append($item);
			}
		}

		var total = 0;
		for(var j in gRoomList) {
			if(gRoomList.hasOwnProperty(j)) ++total;
		}
		$("#all-rooms-count").text(
			rooms.length + " shown · " + total + " known (" + publicCount + " public, " + privateCount + " private)"
		);
	}

	function getPublicSnapshotIds(ls) {
		var snapshotIds = {};
		for(var i in ls.u) {
			if(!ls.u.hasOwnProperty(i)) continue;
			snapshotIds[ls.u[i]._id] = true;
		}
		return snapshotIds;
	}

	function markMissingPublicRoomsAsPrivate(snapshotIds) {
		for(var id in gRoomList) {
			if(!gRoomList.hasOwnProperty(id)) continue;
			if(snapshotIds[id]) continue;
			var room = gRoomList[id];
			if(room.settings && room.settings.lobby) continue;
			if((room.count || 0) > 0 || room._wentPrivate) {
				room.settings.visible = false;
				room._wentPrivate = true;
			}
		}
	}

	function getPrivateProbeCandidates(snapshotIds) {
		var names = {};
		var known = loadKnownRoomNames();
		for(var i = 0; i < known.length; i++) names[known[i]] = true;
		for(var id in gRoomList) {
			if(gRoomList.hasOwnProperty(id)) names[id] = true;
		}
		var list = [];
		for(var name in names) {
			if(!names.hasOwnProperty(name) || name === "lobby") continue;
			var room = gRoomList[name];
			if(snapshotIds && snapshotIds[name] && room && isRoomPublic(room)) continue;
			list.push(name);
		}
		return list;
	}

	function probeRoomNames(names, onDone, alwaysKeep) {
		if(!names.length || !gClient.isConnected()) {
			if(onDone) onDone(0);
			return;
		}
		stopPrivateRoomProbe();
		gRoomProbeBusy = true;
		var gen = ++gRoomProbeGen;
		var found = 0;
		var idx = 0;
		var ws;
		try {
			ws = new WebSocket(gClient.uri);
		} catch(e) {
			gRoomProbeBusy = false;
			if(onDone) onDone(0);
			return;
		}
		gRoomProbeWs = ws;

		function finish() {
			if(gen !== gRoomProbeGen) return;
			stopPrivateRoomProbe();
			if(onDone) onDone(found);
		}

		function probeNext() {
			if(gen !== gRoomProbeGen || idx >= names.length) {
				try { ws.close(); } catch(e) {}
				finish();
				return;
			}
			var name = names[idx++];
			setAllRoomsScanStatus("Scanning private rooms… " + idx + "/" + names.length, true);
			ws.send(JSON.stringify([{m: "ch", _id: name}]));
		}

		ws.onopen = function() {
			ws.send(JSON.stringify([{m: "hi", x: 1, y: 1}]));
		};
		ws.onmessage = function(evt) {
			if(gen !== gRoomProbeGen) return;
			var tx;
			try { tx = JSON.parse(evt.data); } catch(e) { return; }
			for(var i = 0; i < tx.length; i++) {
				var msg = tx[i];
				if(msg.m === "hi") probeNext();
				if(msg.m === "ch") {
					var count = msg.ppl ? Object.keys(msg.ppl).length : 0;
					var entry = normalizeRoomEntry(msg.ch, count, {_source: "probe"});
					var keep = !!alwaysKeep || isRoomPrivate(entry) || count > 1;
					if(keep) {
						registerRoom(entry, "probe");
						if(isRoomPrivate(entry)) ++found;
						updateRoomDropdownEntry(gRoomList[entry._id]);
					}
					probeNext();
				}
			}
		};
		ws.onerror = function() { finish(); };
		ws.onclose = function() { finish(); };
	}

	function startPrivateRoomProbe(snapshotIds) {
		if(gRoomProbeBusy) return;
		var candidates = getPrivateProbeCandidates(snapshotIds);
		if(!candidates.length) {
			setAllRoomsScanStatus("");
			return;
		}
		setAllRoomsScanStatus("Scanning " + candidates.length + " known rooms for private…", true);
		probeRoomNames(candidates, function(found) {
			setAllRoomsScanStatus(found ? ("Found " + found + " private room(s).") : "Scan complete.");
			if($("#all-rooms").is(":visible")) renderAllRoomsList();
		});
	}

	function ingestRoomList(ls) {
		var snapshotIds = null;
		for(var i in ls.u) {
			if(!ls.u.hasOwnProperty(i)) continue;
			var room = ls.u[i];
			registerRoom(room, "ls");
			updateRoomDropdownEntry(gRoomList[room._id]);
		}
		if(ls.c) {
			snapshotIds = getPublicSnapshotIds(ls);
			markMissingPublicRoomsAsPrivate(snapshotIds);
			saveRoomCache();
			startPrivateRoomProbe(snapshotIds);
		}
		if($("#all-rooms").is(":visible")) {
			renderAllRoomsList();
		}
	}

	loadRoomCache();
	rememberRoomName(channel_id);

	gClient.on("ch", function(msg) {
		registerRoomFromChannel(msg.ch, msg.ppl, "channel");
		var info = $("#room > .info");
		info.text(msg.ch._id);
		applyRoomClasses(info, gRoomList[msg.ch._id] || {settings: msg.ch.settings, banned: false});
		if($("#all-rooms").is(":visible")) renderAllRoomsList();
	});
	gClient.on("ls", ingestRoomList);

	$("#room").on("click", function(evt) {
		evt.stopPropagation();

		// clicks on a new room
		if($(evt.target).hasClass("info") && $(evt.target).parents(".more").length) {
			$("#room").removeClass("room-list-open");
			$("#room .more").fadeOut(250);
			unsubscribeRoomList();
			var selected_name = $(evt.target).attr("roomname");
			if(typeof selected_name != "undefined") {
				changeRoom(selected_name, "right");
			}
			return false;
		}
		// clicks on "New Room..."
		else if($(evt.target).hasClass("new")) {
			openModal("#new-room", "input[name=name]");
		}
		// all other clicks
		var doc_click = function(evt) {
			if($(evt.target).closest("#room").length) return;
			$(document).off("mousedown", doc_click);
			$("#room").removeClass("room-list-open");
			$("#room .more").fadeOut(250);
			unsubscribeRoomList();
		}
		$(document).on("mousedown", doc_click);
		$("#room .more .info").remove();
		for(var cachedId in gRoomList) {
			if(!gRoomList.hasOwnProperty(cachedId)) continue;
			if(isRoomPrivate(gRoomList[cachedId])) {
				updateRoomDropdownEntry(gRoomList[cachedId]);
			}
		}
		$("#room").addClass("room-list-open");
		$("#room .more").show();
		subscribeRoomList();
	});

	$("#all-rooms-btn").on("click", function(evt) {
		evt.stopPropagation();
		openModal("#all-rooms");
		setAllRoomsScanStatus("", false);
		subscribeRoomList();
		if(gClient.channel) {
			registerRoomFromChannel(gClient.channel, gClient.ppl, "current");
		}
		var hasRooms = false;
		for(var rk in gRoomList) {
			if(gRoomList.hasOwnProperty(rk)) { hasRooms = true; break; }
		}
		if(hasRooms) {
			renderAllRoomsList();
		} else {
			$("#all-rooms-list").html("<div class=\"loading\">Loading rooms…</div>");
			$("#all-rooms-count").text("");
		}
	});

	$("#all-rooms").on("click", ".filter-btn:not(.room-lookup-btn)", function(evt) {
		evt.stopPropagation();
		$("#all-rooms .room-filters .filter-btn").removeClass("active");
		$(evt.target).addClass("active");
		renderAllRoomsList($(evt.target).data("filter"));
	});

	$("#all-rooms").on("click", ".room-lookup-btn", function(evt) {
		evt.stopPropagation();
		var name = $("#all-rooms input[name=lookup]").val().trim();
		if(!name) return;
		rememberRoomName(name);
		setAllRoomsScanStatus("Looking up \"" + name + "\"…", true);
		probeRoomNames([name], function(found) {
			var room = gRoomList[name];
			if(room && isRoomPrivate(room)) {
				setAllRoomsScanStatus("Found private room \"" + name + "\".");
			} else if(room) {
				setAllRoomsScanStatus("Found public room \"" + name + "\" (" + (room.count || 0) + " players).");
			} else {
				setAllRoomsScanStatus("Could not find room \"" + name + "\".");
			}
			renderAllRoomsList();
		}, true);
	});

	$("#all-rooms input[name=lookup]").on("keydown", function(evt) {
		if(evt.keyCode === 13) {
			evt.preventDefault();
			$("#all-rooms .room-lookup-btn").click();
		}
	});

	$("#all-rooms-list").on("click", ".room-item", function(evt) {
		evt.stopPropagation();
		var selected_name = $(evt.target).closest(".room-item").attr("roomname");
		if(typeof selected_name != "undefined") {
			closeModal();
			changeRoom(selected_name, "right");
		}
	});
	$("#new-room-btn").on("click", function(evt) {
		evt.stopPropagation();
		openModal("#new-room", "input[name=name]");
	});


	$("#play-alone-btn").on("click", function(evt) {
		evt.stopPropagation();
		var room_name = "Room" + Math.floor(Math.random() * 1000000000000);
		changeRoom(room_name, "right", {"visible": false});
		setTimeout(function() {
			new Notification({id: "share", title: "Playing alone", html: 'You are playing alone in a room by yourself, but you can always invite \
				friends by sending them the link.<br/><br/>\
				<a href="#" onclick="window.open(\'https://www.facebook.com/sharer/sharer.php?u=\'+encodeURIComponent(location.href),\'facebook-share-dialog\',\'width=626,height=436\');return false;">Share on Facebook</a><br/><br/>\
				<a href="http://twitter.com/home?status='+encodeURIComponent(location.href)+'" target="_blank">Tweet</a>', duration: 25000});
		}, 1000);
	});

	

	var gModal;

	function modalHandleEsc(evt) {
		if(evt.keyCode == 27) {
			closeModal();
			evt.preventDefault();
			evt.stopPropagation();
		}
	};
	
	function openModal(selector, focus) {
		if(chat) chat.blur();
		releaseKeyboard();
		$(document).on("keydown", modalHandleEsc);
		$("#modal #modals > *").hide();
		$("#modal").fadeIn(250);
		$(selector).show();
		setTimeout(function() {
			$(selector).find(focus).focus();
		}, 100);
		gModal = selector;
	};

	function closeModal() {
		if(gModal === "#all-rooms") {
			stopPrivateRoomProbe();
			unsubscribeRoomList();
		}
		if(gModal === "#fun-video" && typeof FunVideoPopup !== "undefined") {
			FunVideoPopup.stop();
		}
		$(document).off("keydown", modalHandleEsc);
		$("#modal").fadeOut(100);
		$("#modal #modals > *").hide();
		captureKeyboard();
		gModal = null;
	};

	var modal_bg = $("#modal .bg")[0];
	$(modal_bg).on("click", function(evt) {
		if(evt.target != modal_bg) return;
		closeModal();
	});

	if(typeof FunVideoPopup !== "undefined") {
		FunVideoPopup.init({
			openModal: openModal,
			closeModal: closeModal
		});
	}

	(function() {
		function submit() {
			var name = $("#new-room .text[name=name]").val();
			var settings = {
				visible: $("#new-room .checkbox[name=visible]").is(":checked"),
				chat: true
			};
			$("#new-room .text[name=name]").val("");
			closeModal();
			changeRoom(name, "right", settings);
			setTimeout(function() {
				new Notification({id: "share", title: "Created a Room", html: 'You can invite friends to your room by sending them the link.<br/><br/>\
					<a href="#" onclick="window.open(\'https://www.facebook.com/sharer/sharer.php?u=\'+encodeURIComponent(location.href),\'facebook-share-dialog\',\'width=626,height=436\');return false;">Share on Facebook</a><br/><br/>\
					<a href="http://twitter.com/home?status='+encodeURIComponent(location.href)+'" target="_blank">Tweet</a>', duration: 25000});
			}, 1000);
		};
		$("#new-room .submit").click(function(evt) {
			submit();
		});
		$("#new-room .text[name=name]").keypress(function(evt) {
			if(evt.keyCode == 13) {
				submit();
			} else if(evt.keyCode == 27) {
				closeModal();
			} else {
				return;
			}
			evt.preventDefault();
			evt.stopPropagation();
			return false;
		});
	})();



	




	function changeRoom(name, direction, settings, push) {
		if(!settings) settings = {};
		if(!direction) direction = "right";
		if(typeof push == "undefined") push = true;
		var opposite = direction == "left" ? "right" : "left";

		if(name == "") name = "lobby";
		rememberRoomName(name);
		if(gClient.channel && gClient.channel._id === name) return;
		if(push) {
			var url = "?c=" + encodeURIComponent(name).replace("'", "%27");
			if(window.history && history.pushState) {
				history.pushState({"depth": gHistoryDepth += 1, "name": name}, "Piano > " + name, url);
			} else {
				window.location = url;
				return;
			}
		}
		
		gClient.setChannel(name, settings);

		var t = 0, d = 100;
		$("#piano").addClass("ease-out").addClass("slide-" + opposite);
		setTimeout(function() {
			$("#piano").removeClass("ease-out").removeClass("slide-" + opposite).addClass("slide-" + direction);
		}, t += d);
		setTimeout(function() {
			$("#piano").addClass("ease-in").removeClass("slide-" + direction);
		}, t += d);
		setTimeout(function() {
			$("#piano").removeClass("ease-in");
		}, t += d);
	};

	var gHistoryDepth = 0;
	$(window).on("popstate", function(evt) {
		var depth = evt.state ? evt.state.depth : 0;
		if(depth == gHistoryDepth) return; // <-- forgot why I did that though...
		
		var direction = depth <= gHistoryDepth ? "left" : "right";
		gHistoryDepth = depth;

		var name = decodeURIComponent(window.location.pathname);
		if(name.substr(0, 1) == "/") name = name.substr(1);
		changeRoom(name, direction, null, false);
	});




















// Rename

////////////////////////////////////////////////////////////////

(function() {
		function submit() {
			var set = {
				name: $("#rename input[name=name]").val(),
				color: $("#rename input[name=color]").val()
			};
			//$("#rename .text[name=name]").val("");
			closeModal();
			gClient.sendArray([{m: "userset", set: set}]);
		};
		$("#rename .submit").click(function(evt) {
			submit();
		});
		$("#rename .text[name=name]").keypress(function(evt) {
			if(evt.keyCode == 13) {
				submit();
			} else if(evt.keyCode == 27) {
				closeModal();
			} else {
				return;
			}
			evt.preventDefault();
			evt.stopPropagation();
			return false;
		});
	})();















// chatctor

////////////////////////////////////////////////////////////////

	// Routes a room-sync message (from the relay OR the chat fallback) to the
	// owning feature by prefix. Returns true if a feature claimed it.
	function routeRoomSync(msg) {
		var chatLine = msg.a != null ? msg.a : (msg.message != null ? msg.message : "");
		if(typeof RoomMetronomeSync !== "undefined" && RoomMetronomeSync.SYNC_PREFIX &&
			chatLine.indexOf(RoomMetronomeSync.SYNC_PREFIX) === 0) {
			if(typeof gRoomMetronome !== "undefined" && gRoomMetronome) gRoomMetronome.tryHandleChat(msg);
			return true;
		}
		if(typeof RoomMedia !== "undefined" && RoomMedia.isSyncText(chatLine)) {
			if(typeof gRoomMedia !== "undefined" && gRoomMedia) gRoomMedia.tryHandleChat(msg);
			return true;
		}
		if(typeof BlobFriend !== "undefined" && BlobFriend.isSyncText(chatLine)) {
			if(typeof gBlobFriend !== "undefined" && gBlobFriend) gBlobFriend.tryHandleChat(msg);
			return true;
		}
		if(typeof DesktopDoodler !== "undefined" && DesktopDoodler.isSyncText(chatLine)) {
			if(typeof gDesktopDoodler !== "undefined" && gDesktopDoodler) gDesktopDoodler.tryHandleChat(msg);
			return true;
		}
		if(typeof EmojiParty !== "undefined" && EmojiParty.isSyncText(chatLine)) {
			if(typeof gEmojiParty !== "undefined" && gEmojiParty) gEmojiParty.tryHandleChat(msg);
			return true;
		}
		if(typeof SoundBoard !== "undefined" && SoundBoard.isSyncText(chatLine)) {
			if(typeof gSoundBoard !== "undefined" && gSoundBoard) gSoundBoard.tryHandleChat(msg);
			return true;
		}
		if(typeof PartyGame !== "undefined" && PartyGame.isSyncText(chatLine)) {
			if(typeof gPartyGame !== "undefined" && gPartyGame) gPartyGame.tryHandleChat(msg);
			return true;
		}
		if(typeof BalloonPop !== "undefined" && BalloonPop.isSyncText(chatLine)) {
			if(typeof gBalloonPop !== "undefined" && gBalloonPop) gBalloonPop.tryHandleChat(msg);
			return true;
		}
		if(typeof CarDodge !== "undefined" && CarDodge.isSyncText(chatLine)) {
			if(typeof gCarDodge !== "undefined" && gCarDodge) gCarDodge.tryHandleChat(msg);
			return true;
		}
		if(typeof ReactionRoyale !== "undefined" && ReactionRoyale.isSyncText(chatLine)) {
			if(typeof gReactionRoyale !== "undefined" && gReactionRoyale) gReactionRoyale.tryHandleChat(msg);
			return true;
		}
		if(typeof TugOfWar !== "undefined" && TugOfWar.isSyncText(chatLine)) {
			if(typeof gTugOfWar !== "undefined" && gTugOfWar) gTugOfWar.tryHandleChat(msg);
			return true;
		}
		return false;
	}

	var chat = (function() {
		gClient.on("ch", function(msg) {
			if(msg.ch.settings.chat) {
				chat.show();
			} else {
				chat.hide();
			}
		});
		gClient.on("disconnect", function(msg) {
			chat.show();
		});
		gClient.on("c", function(msg) {
			chat.clear();
			if(msg.c) {
				for(var i = 0; i < msg.c.length; i++) {
					chat.receive(msg.c[i]);
				}
			}
		});
		gClient.on("a", function(msg) {
			// Sync messages arriving over chat are the fallback path (relay off
			// or unreachable); route them the same way as relay messages.
			if(routeRoomSync(msg)) return;
			chat.receive(msg);
		});

		$("#chat-input-bar input").on("focus", function(evt) {
			releaseKeyboard();
			$("#chat").addClass("chatting");
			chat.scrollToBottom();
		});
		/*$("#chat input").on("blur", function(evt) {
			captureKeyboard();
			$("#chat").removeClass("chatting");
			chat.scrollToBottom();
		});*/
		$(document).mousedown(function(evt) {
			if($("#modal").is(":visible") && $(evt.target).closest("#modal .dialog").length) return;
			if($(evt.target).closest("#hacks-dock").length) return;
			if($(evt.target).closest("#learn-panel").length) return;
			if($(evt.target).closest("#metronome-panel").length) return;
			if($(evt.target).closest("#metronome-hud").length) return;
			if($(evt.target).closest("#midi-transport").length) return;
			if($(evt.target).closest("#room-media-transport").length) return;
			if($(evt.target).closest("#harmony-tools").length) return;
			if($(evt.target).closest("#chat-input-bar").length) return;
			if(!$("#chat").has(evt.target).length && !$("#chat-input-bar").has(evt.target).length) {
				chat.blur();
			}
		});
		document.addEventListener("touchstart", function(event) {
			for(var i in event.changedTouches) {
				var touch = event.changedTouches[i];
				if($(touch.target).closest("#learn-panel").length) continue;
				if($(touch.target).closest("#metronome-panel").length) continue;
				if($(touch.target).closest("#metronome-hud").length) continue;
				if($(touch.target).closest("#midi-transport").length) continue;
				if($(touch.target).closest("#room-media-transport").length) continue;
				if($(touch.target).closest("#harmony-tools").length) continue;
				if($(touch.target).closest("#hacks-dock").length) continue;
				if(!$("#chat").has(touch.target).length && !$("#chat-input-bar").has(touch.target).length) {
					chat.blur();
				}
			}
		});
		$(document).on("keydown", function(evt) {
			if($("#chat").hasClass("chatting")) {
				if(evt.keyCode == 27) {
					chat.blur();
					evt.preventDefault();
					evt.stopPropagation();
				} else if(evt.keyCode == 13) {
					$("#chat-input-bar input").focus();
				}
			} else if(!gModal && (evt.keyCode == 27 || evt.keyCode == 13)) {
				$("#chat-input-bar input").focus();
			}
		});
		$("#chat-input-bar input").on("keydown", function(evt) {
			if(evt.keyCode == 13) {
				if(MPP.client.isConnected()) {
					var message = $(this).val();
					if(message.length == 0) {
						setTimeout(function() {
							chat.blur();
						}, 100);
					} else if(message.length <= 512) {
						chat.send(message);
						$(this).val("");
						setTimeout(function() {
							chat.blur();
						}, 100);
					}
				}
				evt.preventDefault();
				evt.stopPropagation();
			} else if(evt.keyCode == 27) {
				chat.blur();
				evt.preventDefault();
				evt.stopPropagation();
			} else if(evt.keyCode == 9) {
				evt.preventDefault();
				evt.stopPropagation();
			}
		});

		$("#chat").show();

		return {
			show: function() {
				$("#chat").show();
			},

			hide: function() {
				$("#chat-input-bar").show();
			},

			clear: function() {
				$("#chat li").remove();
			},

			scrollToBottom: function() {
				var ele = $("#chat .chat-log").get(0);
				if(!ele) return;
				ele.scrollTop = ele.scrollHeight - ele.clientHeight;
			},

			blur: function() {
				if($("#chat").hasClass("chatting")) {
					$("#chat-input-bar input").get(0).blur();
					$("#chat").removeClass("chatting");
					chat.scrollToBottom();
					captureKeyboard();
				}
			},

			send: function(message) {
				gClient.sendArray([{m:"a", message: message}]);
			},

			receive: function(msg) {
				if(gChatMutes.indexOf(msg.p._id) != -1) return;
				var chatLine = msg.a != null ? msg.a : (msg.message != null ? msg.message : "");
				if(typeof RoomMedia !== "undefined" && RoomMedia.isSyncText(chatLine)) return;
				if(typeof BlobFriend !== "undefined" && BlobFriend.isSyncText(chatLine)) return;
				if(typeof DesktopDoodler !== "undefined" && DesktopDoodler.isSyncText(chatLine)) return;
				if(typeof EmojiParty !== "undefined" && EmojiParty.isSyncText(chatLine)) return;
				if(typeof SoundBoard !== "undefined" && SoundBoard.isSyncText(chatLine)) return;
				if(typeof PartyGame !== "undefined" && PartyGame.isSyncText(chatLine)) return;
				if(typeof BalloonPop !== "undefined" && BalloonPop.isSyncText(chatLine)) return;
				if(typeof CarDodge !== "undefined" && CarDodge.isSyncText(chatLine)) return;
				if(typeof ReactionRoyale !== "undefined" && ReactionRoyale.isSyncText(chatLine)) return;
				if(typeof TugOfWar !== "undefined" && TugOfWar.isSyncText(chatLine)) return;
				if(typeof RoomMetronomeSync !== "undefined" && RoomMetronomeSync.SYNC_PREFIX &&
					chatLine.indexOf(RoomMetronomeSync.SYNC_PREFIX) === 0) return;

				var li = $('<li><span class="name"/><span class="message"/>');

				li.find(".name").text(msg.p.name + ":");
				li.find(".message").text(msg.a);
				li.css("color", msg.p.color || "white");

				$("#chat ul").append(li);

				if(typeof ChatLogger !== "undefined") {
					ChatLogger.logMessage(msg.p.name, msg.a);
				}

				var eles = $("#chat ul li").get();
				for(var i = 1; i <= 50 && i <= eles.length; i++) {
					eles[eles.length - i].style.opacity = 1.0 - (i * 0.03);
				}
				if(eles.length > 50) {
					eles[0].style.display = "none";
				}
				if(eles.length > 256) {
					$(eles[0]).remove();
				}

				// scroll to bottom if not "chatting" or if not scrolled up
				if(!$("#chat").hasClass("chatting")) {
					chat.scrollToBottom();
				} else {
					var ele = $("#chat .chat-log").get(0);
					if(ele && ele.scrollTop > ele.scrollHeight - ele.offsetHeight - 50)
						chat.scrollToBottom();
				}
			}
		};
	})();

	if(typeof ChatLogger !== "undefined") {
		var gLoggedParticipants = {};
		var gLoggedSelfJoinRoom = null;

		function syncLoggedParticipants(ppl) {
			gLoggedParticipants = {};
			if(!ppl) return;
			for(var i = 0; i < ppl.length; i++) {
				if(ppl[i].id !== gClient.participantId) {
					gLoggedParticipants[ppl[i].id] = ppl[i].name || "";
				}
			}
		}

		function logSelfJoin(roomId) {
			if(!roomId || gLoggedSelfJoinRoom === roomId) return;
			var me = gClient.findParticipantById(gClient.participantId);
			if(!me || !gClient.participantId) return;
			gLoggedSelfJoinRoom = roomId;
			ChatLogger.logJoin(me.name || "?");
		}

		gClient.on("room participants sync", function(ppl) {
			syncLoggedParticipants(ppl);
		});
		gClient.on("ch", function(msg) {
			ChatLogger.setRoom(msg.ch._id);
			logSelfJoin(msg.ch._id);
		});
		gClient.on("participant added", function(part) {
			if(!part || part.id == null) return;
			if(gLoggedParticipants.hasOwnProperty(part.id)) {
				gLoggedParticipants[part.id] = part.name || "";
				return;
			}
			gLoggedParticipants[part.id] = part.name || "";
		});
		gClient.on("participant removed", function(part) {
			if(part && part.id != null) delete gLoggedParticipants[part.id];
		});
		gClient.on("disconnect", function() {
			gLoggedSelfJoinRoom = null;
		});
		gClient.on("participant renamed", function(info) {
			if(!info) return;
			if(info.part && info.part.id != null) {
				gLoggedParticipants[info.part.id] = info.newName || "";
			}
			if(info.part && info.part.id === gClient.participantId) {
				ChatLogger.logRename(info.oldName, info.newName);
			}
		});
		ChatLogger.init();
	}
	














// MIDI

////////////////////////////////////////////////////////////////

	var MIDI_TRANSPOSE = -12;
	var MIDI_KEY_NAMES = ["a-1", "as-1", "b-1"];
	var bare_notes = "c cs d ds e f fs g gs a as b".split(" ");
	for(var oct = 0; oct < 7; oct++) {
		for(var i in bare_notes) {
			MIDI_KEY_NAMES.push(bare_notes[i] + oct);
		}
	}
	MIDI_KEY_NAMES.push("c7");

	function midiToPianoNote(midiNote) {
		var i = midiNote - 21;
		if(i < 0 || i >= MIDI_KEY_NAMES.length) return null;
		return MIDI_KEY_NAMES[i];
	}

	// Piano learn mode (labels + key guides)
	var $learnPanel = $("#learn-panel");
	if(typeof PianoLearn !== "undefined") {
		PianoLearn.init({
			getKeyBinding: function() { return key_binding; },
			getTranspose: function() { return transpose_octave; },
			onGuideUpdate: function(info) {
				$learnPanel.find(".learn-status").text(info.status || "");
				$learnPanel.find(".learn-hint").text(info.hint || "—");
				$learnPanel.find(".learn-step").text(info.step + " / " + info.total);
			},
			onGuideEnd: function() {
				$learnPanel.find(".learn-play").prop("disabled", false);
			}
		});
		$learnPanel.find("input[name=show-note-names]").prop("checked", PianoLearn.labels.showNoteNames);
		$learnPanel.find("input[name=show-key-labels]").prop("checked", PianoLearn.labels.showKeyLabels);
	}

	function setLearnPanelOpen(open) {
		if(open) {
			$learnPanel.removeAttr("hidden");
			releaseKeyboard();
		} else {
			$learnPanel.attr("hidden", "hidden");
			if(!isTypingTarget() && !gModal && !$("#chat").hasClass("chatting")) {
				captureKeyboard();
			}
		}
		document.body.classList.toggle("learn-panel-open", !!open);
	}

	function learnTempoScale() {
		var el = $learnPanel.find("input[name=learn-tempo]")[0];
		return parseFloat(el ? el.value : 100) / 100;
	}

	function setLearnTrackTitle(label) {
		$learnPanel.find(".learn-title").text(label);
	}

	function loadLearnFromFile(file) {
		if(!file || typeof PianoLearn === "undefined") return;
		var name = file.name || "Song";
		var base = name.replace(/\.[^.]+$/, "");
		var ext = (name.split(".").pop() || "").toLowerCase();
		if(ext === "mid" || ext === "midi") {
			var reader = new FileReader();
			reader.onload = function() {
				try {
					var track = PianoLearn.parseMidiGuide(reader.result, midiToPianoNote, base);
					PianoLearn.applyLearnTrack(PianoLearn.guide, track, setLearnTrackTitle);
				} catch(err) { alert(err.message); }
			};
			reader.readAsArrayBuffer(file);
			return;
		}
		var textReader = new FileReader();
		textReader.onload = function() {
			try {
				var track = PianoLearn.parseKeyGuide(textReader.result);
				if(!track.title || track.title === "Guide") track.title = base;
				PianoLearn.applyLearnTrack(PianoLearn.guide, track, setLearnTrackTitle);
				if(gMetronome && track.bpm) {
					gMetronome.applyFromGuide(track.bpm);
					syncMetronomeControlsFromEngine();
				}
			} catch(err) { alert(err.message); }
		};
		textReader.readAsText(file);
	}

	// Metronome
	var gMetronome;
	var gRoomMetronome;
	var gMetroCanControl = true;
	var gMetroOwnerName = "";
	var $metronomePanel = $("#metronome-panel");
	var $metronomeHud = $("#metronome-hud");
	var gMetroPendulumSide = 1;

	function canControlRoomMetronome() {
		if(typeof gRoomMetronome !== "undefined" && gRoomMetronome) return gRoomMetronome.canControl();
		if(gClient && gClient.isConnected()) return gClient.hasCrown();
		return true;
	}

	function setMetronomeControlsEnabled(enabled) {
		gMetroCanControl = !!enabled;
		$metronomePanel.toggleClass("metronome-readonly", !enabled);
		var $crownOnly = $metronomePanel.find(
			"input[name=metro-bpm], input[name=metro-bpm-num], select, input[name=metro-accent], " +
			".metronome-tap, .metronome-play, .metronome-stop, .metronome-nudge, .metronome-sync-guide"
		);
		$crownOnly.prop("disabled", !enabled);
		if(!enabled && gMetronome && gMetronome.running) {
			$metronomePanel.find(".metronome-play").prop("disabled", true);
		}
	}

	function setMetronomePanelOpen(open) {
		if(open) {
			$metronomePanel.removeAttr("hidden");
			releaseKeyboard();
			setMetronomeControlsEnabled(canControlRoomMetronome());
		} else {
			$metronomePanel.attr("hidden", "hidden");
			if(!isTypingTarget() && !gModal && !$("#chat").hasClass("chatting")) {
				captureKeyboard();
			}
		}
		document.body.classList.toggle("metronome-panel-open", !!open);
		updateMetronomeHudVisibility();
	}

	function updateMetronomeHudVisibility() {
		if(!gMetronome) return;
		var showHud = gMetronome.running;
		var $host = $metronomeHud.find(".metronome-hud-host");
		if(showHud) {
			$metronomeHud.removeAttr("hidden");
			if(gMetroOwnerName && gClient && gClient.isConnected()) {
				$host.text(gMetroOwnerName).removeAttr("hidden");
				$metronomeHud.attr("title", "Room metronome — " + gMetroOwnerName);
			} else {
				$host.attr("hidden", "hidden").text("");
				$metronomeHud.removeAttr("title");
			}
		} else {
			$metronomeHud.attr("hidden", "hidden");
			$host.attr("hidden", "hidden");
		}
	}

	function renderMetronomeBeatDots() {
		var beats = gMetronome ? gMetronome.beatsPerBar : 4;
		var $wrap = $metronomePanel.find(".metronome-beats");
		if($wrap.children().length !== beats) {
			$wrap.empty();
			for(var i = 0; i < beats; i++) {
				$wrap.append($("<span/>", {
					"class": "metronome-beat-dot" + (i === 0 ? " accent" : ""),
					"data-beat": i
				}));
			}
		}
	}

	function syncMetronomeControlsFromEngine() {
		if(!gMetronome) return;
		$metronomePanel.find("input[name=metro-bpm]").val(gMetronome.bpm);
		$metronomePanel.find("input[name=metro-bpm-num]").val(gMetronome.bpm);
		$metronomePanel.find(".metronome-bpm-value").text(gMetronome.bpm);
		$metronomeHud.find(".metronome-hud-bpm").text(gMetronome.bpm);
		$metronomePanel.find("select[name=metro-timesig]").val(String(gMetronome.beatsPerBar));
		$metronomePanel.find("select[name=metro-subdiv]").val(String(gMetronome.subdivision));
		$metronomePanel.find("select[name=metro-sound]").val(gMetronome.sound);
		$metronomePanel.find("select[name=metro-countin]").val(String(gMetronome.countIn));
		$metronomePanel.find("input[name=metro-accent]").prop("checked", gMetronome.accentBeat1);
		$metronomePanel.find("input[name=metro-volume]").val(gMetronome.volume);
		$metronomePanel.find(".metronome-vol-label").text(Math.round(gMetronome.volume * 100) + "%");
		renderMetronomeBeatDots();
	}

	function updateMetronomeStatusText() {
		var $status = $metronomePanel.find(".metronome-status");
		if(gMetronome.countingIn) {
			return;
		}
		if(gMetronome.running) {
			if(gClient && gClient.isConnected() && gMetroOwnerName && !canControlRoomMetronome()) {
				$status.text("Room sync · " + gMetroOwnerName).addClass("running").removeClass("counting");
			} else if(gClient && gClient.isConnected()) {
				$status.text("Room sync · running").addClass("running").removeClass("counting");
			} else {
				$status.text("Running").addClass("running").removeClass("counting");
			}
		} else {
			if(gClient && gClient.isConnected() && !canControlRoomMetronome()) {
				$status.text("Room metronome — crown controls").removeClass("running counting");
			} else if(gClient && gClient.isConnected()) {
				$status.text("Stopped — syncs to room").removeClass("running counting");
			} else {
				$status.text("Stopped").removeClass("running counting");
			}
		}
	}

	function updateMetronomeUI(state) {
		if(!gMetronome) return;
		syncMetronomeControlsFromEngine();
		var $play = $metronomePanel.find(".metronome-play");
		if(gMetronome.countingIn) {
			$metronomePanel.find(".metronome-status").text("Count-in…").addClass("counting").removeClass("running");
		} else {
			updateMetronomeStatusText();
		}
		if(gMetronome.running) {
			$play.text(canControlRoomMetronome() ? "▶ Running" : "▶ Synced").prop("disabled", true);
		} else {
			$play.text("▶ Start").prop("disabled", !canControlRoomMetronome());
		}
		setMetronomeControlsEnabled(canControlRoomMetronome());
		if(gClient && gClient.isConnected() && !canControlRoomMetronome()) {
			$metronomePanel.find(".metronome-room-note").removeAttr("hidden");
		} else {
			$metronomePanel.find(".metronome-room-note").attr("hidden", "hidden");
		}
		document.body.classList.toggle("metronome-running", !!gMetronome.running);
		updateMetronomeHudVisibility();
		if(state && state.stopped) {
			$metronomePanel.find(".metronome-beat-dot").removeClass("active");
			$metronomePanel.find(".metronome-pendulum").removeClass("swing-left swing-right accent");
			$metronomeHud.find(".metronome-hud-dot").removeClass("pulse");
		}
	}

	function onMetronomeBeat(info) {
		if(!info || info.stopped) {
			updateMetronomeUI({ stopped: true });
			return;
		}
		if(!info.isBeat) return;
		var beat = info.beatInBar;
		$metronomePanel.find(".metronome-beat-dot").removeClass("active");
		$metronomePanel.find('.metronome-beat-dot[data-beat="' + beat + '"]').addClass("active");
		var $pend = $metronomePanel.find(".metronome-pendulum");
		gMetroPendulumSide = -gMetroPendulumSide;
		$pend.removeClass("swing-left swing-right accent");
		$pend.addClass(gMetroPendulumSide < 0 ? "swing-left" : "swing-right");
		if(info.accent) $pend.addClass("accent");
		var $hudDot = $metronomeHud.find(".metronome-hud-dot");
		$hudDot.addClass("pulse");
		setTimeout(function() { $hudDot.removeClass("pulse"); }, 80);
	}

	function onMetronomeCountIn(info) {
		if(!info) {
			updateMetronomeUI();
			return;
		}
		$metronomePanel.find(".metronome-status").text("Count-in " + info.bar + "/" + info.totalBars);
	}

	function startRoomMetronome() {
		if(!gMetronome) return;
		if(gClient && gClient.isConnected() && !canControlRoomMetronome()) {
			alert("Only the room owner (crown) can start the room metronome.");
			return;
		}
		ensureAudioReady();
		if(gRoomMetronome) {
			gRoomMetronome.startRoom();
		} else {
			gMetronome.start(true);
		}
		updateMetronomeUI();
	}

	function stopRoomMetronome() {
		if(!gMetronome) return;
		if(gClient && gClient.isConnected() && gMetronome.running && !canControlRoomMetronome()) {
			alert("Only the room owner (crown) can stop the room metronome.");
			return;
		}
		if(gRoomMetronome) {
			gRoomMetronome.stopRoom();
		} else {
			gMetronome.stop();
		}
		updateMetronomeUI({ stopped: true });
	}

	function toggleRoomMetronome() {
		if(!gMetronome) return false;
		if(gMetronome.running) {
			stopRoomMetronome();
			return false;
		}
		startRoomMetronome();
		return true;
	}

	function applyMetronomeFromGuide() {
		if(!canControlRoomMetronome()) {
			alert("Only the room owner (crown) can change metronome settings.");
			return;
		}
		if(typeof PianoLearn === "undefined" || !PianoLearn.guide || !PianoLearn.guide.track) {
			alert("Load a learn guide with BPM first (e.g. Rush-E demo).");
			return;
		}
		var bpm = PianoLearn.guide.track.bpm;
		if(!bpm) {
			alert("This guide has no BPM in the file header.");
			return;
		}
		gMetronome.applyFromGuide(bpm);
		syncMetronomeControlsFromEngine();
	}

	if(typeof Metronome !== "undefined") {
		gMetronome = new Metronome({
			getContext: function() { return gPiano && gPiano.audio ? gPiano.audio.context : null; },
			onBeat: onMetronomeBeat,
			onStateChange: updateMetronomeUI,
			onCountIn: onMetronomeCountIn
		});
		if(typeof RoomMetronomeSync !== "undefined") {
			gRoomMetronome = new RoomMetronomeSync({
				client: gClient,
				metronome: gMetronome,
				onRoomState: function(info) {
					gMetroOwnerName = info.ownerName || "";
					updateMetronomeUI();
				}
			});
		}
		syncMetronomeControlsFromEngine();
		updateMetronomeUI();
	}

	gClient.on("ch", function() {
		setTimeout(function() {
			if(gRoomMetronome && (!gMetronome || !gMetronome.running || !gRoomMetronome.canControl())) {
				gRoomMetronome.requestSync();
			}
			if(gBlobFriend) gBlobFriend.requestSync();
			if(gDesktopDoodler) gDesktopDoodler.requestSync();
			if(gPartyGame) gPartyGame.requestSync();
			if(gBalloonPop) gBalloonPop.requestSync();
			if(gCarDodge) gCarDodge.requestSync();
			if(gReactionRoyale) gReactionRoyale.requestSync();
			if(gTugOfWar) gTugOfWar.requestSync();
			updateMetronomeUI();
		}, 400);
	});
	gClient.on("participant removed", function(part) {
		if(gRoomMetronome && gRoomMetronome.ownerId && part.id === gRoomMetronome.ownerId) {
			gRoomMetronome.ownerId = null;
			gRoomMetronome.ownerName = "";
			gMetroOwnerName = "";
			if(gMetronome && gMetronome.running) {
				gMetronome.stop();
				updateMetronomeUI({ stopped: true });
			}
		}
	});

	// Sheet music / MIDI autoplay + Fun hacks
	var gSheetPlayer;
	var gFunTimers = [];
	var gFunIntervals = [];
	var gChatSpamIv = null;
	var gChaosIv = null;
	var gSpamCounter = 0;
	var gSpamRotateIdx = 0;
	var $hacksPanel = $("#hacks-dock");

	function setSpamStatus(text, active) {
		var el = document.getElementById("spam-status");
		if(!el) return;
		el.textContent = text;
		if(active) el.classList.add("active");
		else el.classList.remove("active");
	}

	function buildSpamMessage() {
		var raw = ($hacksPanel.find("input[name=spam-msg]").val() || "🎹").trim();
		var mode = $hacksPanel.find("select[name=spam-mode]").val() || "single";
		if(mode === "rotate") {
			var parts = raw.split("|").map(function(s) { return s.trim(); }).filter(Boolean);
			if(!parts.length) return raw;
			var msg = parts[gSpamRotateIdx % parts.length];
			gSpamRotateIdx++;
			return msg;
		}
		if(mode === "counter") {
			gSpamCounter++;
			return raw + " #" + gSpamCounter;
		}
		if(mode === "random") {
			var words = raw.replace(/\|/g, " ").split(/\s+/).filter(Boolean);
			if(!words.length) words = [raw];
			return words[Math.floor(Math.random() * words.length)] + " " + Math.floor(Math.random() * 9999);
		}
		return raw.split("|")[0].trim() || raw;
	}

	function startChatSpam() {
		if(!gClient.isConnected()) {
			setSpamStatus("offline", false);
			alert("Connect to a room first.");
			return;
		}
		var ms = Math.max(400, parseInt($hacksPanel.find("input[name=spam-ms]").val(), 10) || 900);
		var burst = Math.min(50, Math.max(1, parseInt($hacksPanel.find("input[name=spam-burst]").val(), 10) || 1));
		if(gChatSpamIv) clearInterval(gChatSpamIv);
		gSpamCounter = 0;
		gSpamRotateIdx = 0;
		var sent = 0;
		setSpamStatus("on", true);
		gChatSpamIv = setInterval(function() {
			if(!gClient.isConnected()) {
				stopChatSpam();
				return;
			}
			for(var b = 0; b < burst; b++) {
				chat.send(buildSpamMessage());
				sent++;
			}
			setSpamStatus("×" + sent, true);
		}, ms);
	}

	function stopChatSpam() {
		if(gChatSpamIv) { clearInterval(gChatSpamIv); gChatSpamIv = null; }
		setSpamStatus("idle", false);
	}

	var $midiTransport = $("#midi-transport");

	function sheetTempoScale() {
		var el = $midiTransport.find("input[name=tempo]")[0];
		return parseFloat(el ? el.value : 100) / 100;
	}
	function sheetLoopOn() {
		return $midiTransport.find("input[name=loop]").is(":checked");
	}
	function showMidiTransport(show) {
		if(show) {
			$midiTransport.removeAttr("hidden");
			document.body.classList.add("midi-transport-active");
		} else {
			$midiTransport.attr("hidden", "hidden");
			document.body.classList.remove("midi-transport-active");
		}
	}
	function updateSheetProgress(posMs, durMs) {
		if(typeof SheetPlayer === "undefined") return;
		$midiTransport.find(".time-current").text(SheetPlayer.formatTime(posMs));
		$midiTransport.find(".time-total").text(SheetPlayer.formatTime(durMs));
		var seek = $midiTransport.find("input[name=seek]")[0];
		if(seek) {
			seek.max = Math.max(1, Math.ceil(durMs || 1000));
			if(!seek._dragging) seek.value = Math.floor(posMs);
		}
	}
	function applyTempoLive() {
		var pct = $midiTransport.find("input[name=tempo]").val();
		$midiTransport.find(".tempo-label").text(pct + "%");
		if(gSheetPlayer && (gSheetPlayer.playing || gSheetPlayer.paused)) {
			gSheetPlayer.setTempoScale(sheetTempoScale());
		}
	}
	function getSheetEvents() {
		var text = $("#sheet-play textarea[name=notation]").val();
		if(text && text.trim()) {
			return SheetPlayer.parseText(text.trim());
		}
		if(gSheetPlayer && gSheetPlayer.events && gSheetPlayer.events.length) {
			return { events: gSheetPlayer.events, durationMs: gSheetPlayer.durationMs };
		}
		return null;
	}
	function startSheetPlayback(fromMs) {
		var parsed = getSheetEvents();
		if(!parsed || !parsed.events.length) {
			alert("Upload a .mid file or enter text notation (see placeholder).");
			return;
		}
		ensureAudioReady();
		gSheetPlayer.loop = sheetLoopOn();
		gSheetPlayer.play({
			events: parsed.events,
			durationMs: parsed.durationMs,
			tempoScale: sheetTempoScale(),
			loop: sheetLoopOn(),
			fromMs: fromMs !== undefined ? fromMs : gSheetPlayer.offsetMs
		});
		showMidiTransport(true);
		closeModal();
	}

	gSheetPlayer = new SheetPlayer({
		press: function(id, vol) { press(id, vol, true); },
		release: function(id) { release(id, true); },
		midiToNote: midiToPianoNote,
		onStatus: function(msg) {
			$("#sheet-play .file-info").text(msg);
		},
		onProgress: updateSheetProgress
	});

	var _origSheetStop = gSheetPlayer.stop.bind(gSheetPlayer);
	gSheetPlayer.stop = function() {
		_origSheetStop();
		showMidiTransport(false);
	};
	var _origOnTrackEnd = gSheetPlayer.onTrackEnd.bind(gSheetPlayer);
	gSheetPlayer.onTrackEnd = function() {
		_origOnTrackEnd();
		if(!gSheetPlayer.loop) showMidiTransport(false);
	};
	var _origPause = gSheetPlayer.pause.bind(gSheetPlayer);
	gSheetPlayer.pause = function() {
		_origPause();
		showMidiTransport(true);
	};

	// Room DJ — shared audio/video (not piano)
	var gRoomMedia;
	var $roomMediaTransport = $("#room-media-transport");
	var $roomMediaDialog = $("#room-media");
	var $roomMediaVideoWrap = $("#room-media-video-wrap");
	var $roomMediaVideoMount = $("#room-media-video-mount");
	var gRoomMediaCinema = false;
	var gRoomMediaHidePiano = false;
	var gRoomMediaCinemaChat = false;
	var gRoomMediaControlsIdle = null;

	function showRoomMediaControls(show) {
		var transport = document.getElementById("room-media-transport");
		if(!transport) return;
		if(show) {
			transport.classList.remove("controls-hidden");
			document.body.classList.remove("room-media-controls-hidden");
		} else {
			transport.classList.add("controls-hidden");
			document.body.classList.add("room-media-controls-hidden");
		}
		refreshRoomMediaLayout();
	}

	function bumpRoomMediaControls() {
		showRoomMediaControls(true);
		if(!gRoomMediaCinema) return;
		clearTimeout(gRoomMediaControlsIdle);
		gRoomMediaControlsIdle = setTimeout(function() {
			if(gRoomMediaCinema && gRoomMedia && gRoomMedia.playing) showRoomMediaControls(false);
		}, 3500);
	}

	function roomMediaHasVideoPanel() {
		return gRoomMedia && (gRoomMedia.kind === "youtube" || gRoomMedia.kind === "video");
	}

	function syncRoomMediaTransportDock() {
		var transport = document.getElementById("room-media-transport");
		var wrap = document.getElementById("room-media-video-wrap");
		if(!transport) return;
		var hasVideo = roomMediaHasVideoPanel() && wrap && !wrap.hasAttribute("hidden");
		var dock = hasVideo && !gRoomMediaCinema;
		document.body.classList.toggle("room-media-video-dock", dock);
		transport.classList.toggle("room-media-transport-docked", dock);
		if(gRoomMediaCinema || !dock) {
			if(transport.parentElement !== document.body) document.body.appendChild(transport);
			return;
		}
		if(wrap && transport.parentElement !== wrap) wrap.appendChild(transport);
	}

	function refreshRoomMediaLayout() {
		syncRoomMediaTransportDock();
		var transport = document.getElementById("room-media-transport");
		var controlsHidden = transport && transport.classList.contains("controls-hidden");
		var transportH = (transport && !transport.hasAttribute("hidden") && !controlsHidden) ? transport.offsetHeight : 0;
		var inputBar = document.getElementById("chat-input-bar");
		var inputH = (gRoomMediaCinemaChat && inputBar) ? inputBar.offsetHeight : 0;
		var chatW = gRoomMediaCinemaChat ? Math.min(360, Math.max(280, Math.floor(window.innerWidth * 0.34))) : 0;
		document.documentElement.style.setProperty("--room-media-transport-h", transportH + "px");
		document.documentElement.style.setProperty("--room-media-input-h", inputH + "px");
		document.documentElement.style.setProperty("--room-media-chat-w", chatW + "px");
		requestAnimationFrame(function() {
			requestAnimationFrame(function() {
				if(gRoomMedia && gRoomMedia.fitYouTubePlayer) gRoomMedia.fitYouTubePlayer();
			});
		});
		setTimeout(function() {
			if(gRoomMedia && gRoomMedia.fitYouTubePlayer) gRoomMedia.fitYouTubePlayer();
		}, 150);
		setTimeout(function() {
			if(gRoomMedia && gRoomMedia.fitYouTubePlayer) gRoomMedia.fitYouTubePlayer();
		}, 400);
	}

	function updateRoomMediaLayoutUi() {
		var hasTrack = gRoomMedia && !!gRoomMedia.url;
		var hasVideo = roomMediaHasVideoPanel() && !$roomMediaVideoWrap.is("[hidden]");
		$roomMediaTransport.find(".room-media-hide-piano-transport").prop("hidden", !hasTrack);
		$roomMediaTransport.find(".room-media-cinema-transport").prop("hidden", !hasVideo);
		$roomMediaTransport.find(".room-media-chat-transport").prop("hidden", !gRoomMediaCinema);
		$roomMediaVideoWrap.find(".room-media-chat-btn").prop("hidden", !gRoomMediaCinema);
	}

	function setRoomMediaHidePiano(on) {
		gRoomMediaHidePiano = !!on;
		document.body.classList.toggle("room-media-hide-piano", gRoomMediaHidePiano);
		var label = gRoomMediaHidePiano ? "Show piano" : "Piano";
		$roomMediaVideoWrap.find(".room-media-hide-piano-btn").toggleClass("active", gRoomMediaHidePiano).text(label);
		$roomMediaTransport.find(".room-media-hide-piano-transport").toggleClass("active", gRoomMediaHidePiano).text(label);
		refreshRoomMediaLayout();
	}

	function toggleRoomMediaHidePiano() {
		setRoomMediaHidePiano(!gRoomMediaHidePiano);
	}

	function setRoomMediaCinemaChat(on) {
		gRoomMediaCinemaChat = !!on;
		document.body.classList.toggle("room-media-cinema-chat", gRoomMediaCinemaChat);
		var label = gRoomMediaCinemaChat ? "Hide chat" : "Chat";
		$roomMediaVideoWrap.find(".room-media-chat-btn").toggleClass("active", gRoomMediaCinemaChat).text(label);
		$roomMediaTransport.find(".room-media-chat-transport").toggleClass("active", gRoomMediaCinemaChat).text(label);
		if(gRoomMediaCinemaChat) {
			$("#chat").addClass("chatting");
		}
		refreshRoomMediaLayout();
		setTimeout(refreshRoomMediaLayout, 80);
		setTimeout(refreshRoomMediaLayout, 250);
	}

	function toggleRoomMediaCinemaChat() {
		if(!gRoomMediaCinema) return;
		setRoomMediaCinemaChat(!gRoomMediaCinemaChat);
	}

	function setRoomMediaCinema(on) {
		gRoomMediaCinema = !!on;
		document.body.classList.toggle("room-media-cinema", gRoomMediaCinema);
		if(!gRoomMediaCinema) {
			setRoomMediaCinemaChat(false);
			showRoomMediaControls(true);
			clearTimeout(gRoomMediaControlsIdle);
		} else {
			bumpRoomMediaControls();
		}
		var label = gRoomMediaCinema ? "Exit" : "Full";
		$roomMediaVideoWrap.find(".room-media-cinema-btn").toggleClass("active", gRoomMediaCinema).text(label);
		$roomMediaTransport.find(".room-media-cinema-transport").toggleClass("active", gRoomMediaCinema).text(label);
		updateRoomMediaLayoutUi();
		syncRoomMediaTransportDock();
		refreshRoomMediaLayout();
		setTimeout(refreshRoomMediaLayout, 100);
	}

	function toggleRoomMediaCinema() {
		if(!roomMediaHasVideoPanel() || $roomMediaVideoWrap.is("[hidden]")) return;
		setRoomMediaCinema(!gRoomMediaCinema);
	}

	function resetRoomMediaLayout() {
		setRoomMediaCinema(false);
		setRoomMediaHidePiano(false);
		setRoomMediaCinemaChat(false);
		showRoomMediaControls(true);
		document.body.classList.remove("room-media-controls-hidden");
		clearTimeout(gRoomMediaControlsIdle);
	}

	function setRoomDjPlaying(playing) {
		var btn = document.getElementById("room-media-btn");
		if(btn) {
			if(playing) btn.classList.add("room-dj-playing");
			else btn.classList.remove("room-dj-playing");
		}
		document.body.classList.toggle("room-dj-playing", !!playing);
	}

	function showRoomMediaTransport(show) {
		if(show) {
			$roomMediaTransport.removeAttr("hidden");
			document.body.classList.add("room-media-active");
		} else {
			$roomMediaTransport.attr("hidden", "hidden");
			document.body.classList.remove("room-media-active");
			setRoomDjPlaying(false);
		}
	}

	function updateRoomMediaProgress(info) {
		if(!info) return;
		if(typeof RoomMedia !== "undefined") {
			$roomMediaTransport.find(".time-current").text(RoomMedia.formatTime(info.current));
			$roomMediaTransport.find(".time-total").text(RoomMedia.formatTime(info.duration));
		}
		var seek = $roomMediaTransport.find("input[name=seek]")[0];
		if(seek) {
			seek.max = Math.max(0.1, info.duration || 0.1);
			if(!seek._dragging) seek.value = info.current || 0;
		}
		if(info.title) $roomMediaTransport.find(".room-media-title").text(info.title);
		if(info.dj) $roomMediaTransport.find(".room-media-dj").text("DJ · " + info.dj);
		setRoomDjPlaying(!!info.playing);
		$roomMediaTransport.toggleClass("is-playing", !!info.playing);
		$roomMediaTransport.find(".play").prop("hidden", !!info.playing);
		$roomMediaTransport.find(".pause").prop("hidden", !info.playing);
		$roomMediaTransport.find(".play").toggleClass("primary", !info.playing);
		$roomMediaTransport.find(".pause").toggleClass("primary", !!info.playing);
		if(info.playing && gRoomMediaCinema) bumpRoomMediaControls();
	}

	function mountRoomMediaVideo(videoEl) {
		if(!videoEl) return;
		$roomMediaVideoMount.empty()[0].appendChild(videoEl);
	}

	if(typeof RoomMedia !== "undefined") {
		gRoomMedia = new RoomMedia({
			client: gClient,
			onStatus: function(msg) {
				$roomMediaDialog.find(".room-media-status").text(msg);
				$("#status").text(msg);
			},
			onServerReady: function(base) {
				var badge = $roomMediaDialog.find(".room-media-server-badge");
				badge.text("Media server online · " + base).removeAttr("hidden");
			},
			onTrackChange: function(info) {
				$roomMediaTransport.find(".room-media-title").text(info.title || "No track loaded");
				$roomMediaTransport.find(".room-media-dj").text(info.dj ? ("DJ · " + info.dj) : "");
				showRoomMediaTransport(true);
				updateRoomMediaLayoutUi();
			},
			onProgress: updateRoomMediaProgress,
			onLayoutChange: function() {
				refreshRoomMediaLayout();
			},
			onTransport: function(info) {
				if(info.visible) showRoomMediaTransport(true);
				if(info.kind === "youtube") {
					$roomMediaVideoWrap.removeClass("mode-video youtube-shorts");
					$roomMediaVideoWrap.addClass("mode-youtube");
					if(info.isShort) $roomMediaVideoWrap.addClass("youtube-shorts");
					$roomMediaVideoWrap.removeAttr("hidden");
					$roomMediaVideoWrap.find(".room-media-video-title").text(gRoomMedia.title || "YouTube");
				} else if(info.kind === "video" && info.videoEl) {
					$roomMediaVideoWrap.removeClass("mode-youtube youtube-shorts");
					$roomMediaVideoWrap.addClass("mode-video");
					mountRoomMediaVideo(info.videoEl);
					$roomMediaVideoWrap.removeAttr("hidden");
					$roomMediaVideoWrap.find(".room-media-video-title").text(gRoomMedia.title || "Video");
				} else {
					$roomMediaVideoWrap.attr("hidden", "hidden");
					$roomMediaVideoWrap.removeClass("mode-youtube mode-video youtube-shorts");
					resetRoomMediaLayout();
				}
				updateRoomMediaLayoutUi();
				refreshRoomMediaLayout();
			}
		});
		$roomMediaTransport.find("input[name=volume]").val(gRoomMedia.volume);
	}

	// Blob Friend + Desktop Doodler + party toys
	var gBlobFriend;
	var gDesktopDoodler;
	var gEmojiParty;
	var gSoundBoard;
	var gPartyGame;
	var gBalloonPop;
	var gCarDodge;
	var gReactionRoyale;
	var gTugOfWar;
	var gUselessButton;
	var gPixelPet;
	var gEvilCursor;
	var gChaosMonkey;
	var gPianoCollapsed = false;

	function updateHarmonyToolsUi() {
		var blobBtn = document.getElementById("harmony-blob-btn");
		var doodlerBtn = document.getElementById("harmony-doodle-btn");
		var pianoBtn = document.getElementById("harmony-piano-btn");
		var playArea = document.getElementById("play-area");
		var blobOn = gBlobFriend && gBlobFriend.visible;
		var doodleOn = gDesktopDoodler && gDesktopDoodler.visible;

		if(blobBtn && gBlobFriend) blobBtn.classList.toggle("active", blobOn);
		if(doodlerBtn && gDesktopDoodler) doodlerBtn.classList.toggle("active", doodleOn);

		var reactBtn = document.getElementById("harmony-react-btn");
		var soundBtn = document.getElementById("harmony-sound-btn");
		var bombBtn = document.getElementById("harmony-bomb-btn");
		var balloonBtn = document.getElementById("harmony-balloon-btn");
		var reactBar = document.getElementById("emoji-react-bar");
		var soundBar = document.getElementById("soundboard-bar");
		if(reactBtn) reactBtn.classList.toggle("active", !!(reactBar && !reactBar.hasAttribute("hidden")));
		if(soundBtn) soundBtn.classList.toggle("active", !!(soundBar && !soundBar.hasAttribute("hidden")));
		var cardodgeBtn = document.getElementById("harmony-cardodge-btn");
		var reactionBtn = document.getElementById("harmony-reaction-btn");
		var tugBtn = document.getElementById("harmony-tug-btn");
		if(bombBtn && gPartyGame) bombBtn.classList.toggle("active", !!gPartyGame.visible);
		if(balloonBtn && gBalloonPop) balloonBtn.classList.toggle("active", !!gBalloonPop.visible);
		if(cardodgeBtn && gCarDodge) cardodgeBtn.classList.toggle("active", !!gCarDodge.visible);
		if(reactionBtn && gReactionRoyale) reactionBtn.classList.toggle("active", !!gReactionRoyale.visible);
		if(tugBtn && gTugOfWar) tugBtn.classList.toggle("active", !!gTugOfWar.visible);

		var uselessBtn = document.getElementById("harmony-useless-btn");
		var petBtn = document.getElementById("harmony-pet-btn");
		var evilBtn = document.getElementById("harmony-evil-btn");
		var chaosBtn = document.getElementById("harmony-chaos-btn");
		if(uselessBtn && gUselessButton) uselessBtn.classList.toggle("active", !!gUselessButton.active);
		if(petBtn && gPixelPet) petBtn.classList.toggle("active", !!gPixelPet.active);
		if(evilBtn && gEvilCursor) evilBtn.classList.toggle("active", !!gEvilCursor.active);
		if(chaosBtn && gChaosMonkey) chaosBtn.classList.toggle("active", !!gChaosMonkey.active);
		if(pianoBtn) {
			pianoBtn.classList.toggle("active", !gPianoCollapsed);
			pianoBtn.classList.toggle("piano-off", gPianoCollapsed);
			pianoBtn.title = gPianoCollapsed ? "Show the piano" : "Hide the piano";
		}
		if(playArea) {
			if(blobOn || doodleOn) playArea.removeAttribute("hidden");
			else playArea.setAttribute("hidden", "hidden");
		}
	}

	function setPianoCollapsed(on) {
		gPianoCollapsed = !!on;
		document.body.classList.toggle("piano-collapsed", gPianoCollapsed);
		updateHarmonyToolsUi();
		try {
			if(typeof localStorage !== "undefined") {
				localStorage.harmonyPianoCollapsed = gPianoCollapsed ? "1" : "0";
			}
		} catch (e) {}
	}

	try {
		if(typeof localStorage !== "undefined" && localStorage.harmonyPianoCollapsed === "1") {
			gPianoCollapsed = true;
			document.body.classList.add("piano-collapsed");
		}
	} catch (e) {}

	if(typeof BlobFriend !== "undefined") {
		gBlobFriend = new BlobFriend({
			client: gClient,
			mountEl: document.getElementById("blob-friend"),
			onLayoutChange: function() {
				if(gBlobFriend && gBlobFriend.canvas) gBlobFriend._resize();
				updateHarmonyToolsUi();
			}
		});
	}
	if(typeof DesktopDoodler !== "undefined") {
		gDesktopDoodler = new DesktopDoodler({
			client: gClient,
			mountEl: document.getElementById("desktop-doodler"),
			onLayoutChange: function() {
				if(gDesktopDoodler && gDesktopDoodler.canvas) gDesktopDoodler._resize();
				updateHarmonyToolsUi();
			}
		});
	}
	if(typeof EmojiParty !== "undefined") {
		gEmojiParty = new EmojiParty({ client: gClient });
		window.gEmojiParty = gEmojiParty;
	}
	if(typeof SoundBoard !== "undefined") {
		gSoundBoard = new SoundBoard({ client: gClient });
	}
	if(typeof PartyGame !== "undefined") {
		gPartyGame = new PartyGame({ client: gClient, onLayoutChange: updateHarmonyToolsUi });
	}
	if(typeof BalloonPop !== "undefined") {
		gBalloonPop = new BalloonPop({ client: gClient, onLayoutChange: updateHarmonyToolsUi });
		window.gBalloonPop = gBalloonPop;
	}
	if(typeof CarDodge !== "undefined") {
		gCarDodge = new CarDodge({ client: gClient, onLayoutChange: updateHarmonyToolsUi });
		window.gCarDodge = gCarDodge;
	}
	if(typeof ReactionRoyale !== "undefined") {
		gReactionRoyale = new ReactionRoyale({ client: gClient, onLayoutChange: updateHarmonyToolsUi });
		window.gReactionRoyale = gReactionRoyale;
	}
	if(typeof TugOfWar !== "undefined") {
		gTugOfWar = new TugOfWar({ client: gClient, onLayoutChange: updateHarmonyToolsUi });
		window.gTugOfWar = gTugOfWar;
	}
	if(typeof UselessButton !== "undefined") gUselessButton = new UselessButton();
	if(typeof PixelPet !== "undefined") gPixelPet = new PixelPet();
	if(typeof EvilCursor !== "undefined") gEvilCursor = new EvilCursor();
	if(typeof ChaosMonkey !== "undefined") gChaosMonkey = new ChaosMonkey();
	updateHarmonyToolsUi();
	setPianoCollapsed(gPianoCollapsed);

	function ensureRoomMediaReady() {
		if(!gClient.isConnected()) {
			alert("Connect to a room first.");
			return false;
		}
		if(typeof gRoomMedia === "undefined") {
			alert("Room DJ is not available.");
			return false;
		}
		return true;
	}

	function ensureMediaServer() {
		if(typeof RoomMedia === "undefined") {
			return Promise.reject(new Error("Room DJ module missing."));
		}
		return RoomMedia.initMediaServer().then(function(base) {
			if(!base) {
				throw new Error(
					"Media server not running.\n\n" +
					"1. Double-click run-servers.bat\n" +
					"   OR run: python media-server.py 8551\n" +
					"2. Open http://localhost:8550/ (not GitHub Pages)\n\n" +
					"MPP handles piano/chat only — Room DJ needs the local media server."
				);
			}
			return base;
		});
	}

	function loadRoomMediaSelection() {
		if(!ensureRoomMediaReady()) return Promise.reject(new Error("Not ready"));
		var fileInput = $roomMediaDialog.find("input[name=mediafile]")[0];
		var urlInput = ($roomMediaDialog.find("input[name=mediaurl]").val() || "").trim();
		var videoInput = ($roomMediaDialog.find("input[name=videourl]").val() || "").trim();
		var ytInput = ($roomMediaDialog.find("input[name=youtubeurl]").val() || "").trim();
		var file = fileInput && fileInput.files && fileInput.files[0];
		var ytUrl = ytInput;
		if(!ytUrl && videoInput && typeof RoomMedia !== "undefined" && RoomMedia.isYouTubeUrl(videoInput)) {
			ytUrl = videoInput;
		}
		if(!ytUrl && urlInput && typeof RoomMedia !== "undefined" && RoomMedia.isYouTubeUrl(urlInput)) {
			ytUrl = urlInput;
		}
		if(ytUrl) {
			var ytTitle = "YouTube Video";
			if(ytUrl.indexOf("/shorts/") >= 0) ytTitle = "YouTube Short";
			gRoomMedia.loadUrlAndShare(ytUrl, ytTitle);
			showRoomMediaTransport(true);
			return Promise.resolve();
		}
		if(videoInput) {
			gRoomMedia.loadVideoUrlAndShare(videoInput);
			showRoomMediaTransport(true);
			return Promise.resolve();
		}
		if(file) {
			return ensureMediaServer().then(function() {
				return gRoomMedia.loadAndShare(file).then(function() {
					showRoomMediaTransport(true);
				});
			});
		}
		if(urlInput) {
			gRoomMedia.loadUrlAndShare(urlInput);
			showRoomMediaTransport(true);
			return Promise.resolve();
		}
		return Promise.reject(new Error("Choose a file, paste an audio/video/YouTube link, or use Direct video link."));
	}

	function funClearTimers() {
		for(var i = 0; i < gFunTimers.length; i++) clearTimeout(gFunTimers[i]);
		gFunTimers = [];
	}
	function releaseAllKeysHack() {
		var ids = Object.keys(gHeldNotes);
		for(var i = 0; i < ids.length; i++) release(ids[i], true);
	}
	function funStopAll() {
		funClearTimers();
		for(var fi = 0; fi < gFunIntervals.length; fi++) clearInterval(gFunIntervals[fi]);
		gFunIntervals = [];
		stopChatSpam();
		if(gChaosIv) { clearInterval(gChaosIv); gChaosIv = null; }
		releaseAllKeysHack();
		$("#piano").removeClass("spin");
		if(gSheetPlayer) gSheetPlayer.stop();
		if(gMetronome && gMetronome.running) {
			if(gRoomMetronome) gRoomMetronome.stopRoom();
			else gMetronome.stop();
		}
		if(typeof updateMetronomeUI === "function") updateMetronomeUI({ stopped: true });
		setSpamStatus("idle", false);
	}
	function pressAllKeysHack() {
		ensureAudioReady();
		for(var id in gPiano.keys) {
			if(gPiano.keys.hasOwnProperty(id)) press(id, DEFAULT_VELOCITY, true);
		}
	}

	function funPrep() {
		funStopAll();
		ensureAudioReady();
	}
	function funNoteAt(note, delay, hold, vol) {
		gFunTimers.push(setTimeout(function() { press(note, vol !== undefined ? vol : 0.7, true); }, delay));
		gFunTimers.push(setTimeout(function() { release(note, true); }, delay + (hold || 80)));
	}
	function funChord(notes, delay, hold, vol) {
		for(var i = 0; i < notes.length; i++) funNoteAt(notes[i], delay, hold, vol);
	}
	function pianoKeyList() {
		return Object.keys(gPiano.keys);
	}
	function sharpKeyList() {
		return pianoKeyList().filter(function(k) { return k.length > 2 && k.charAt(1) === "s"; });
	}
	function whiteKeyList() {
		return pianoKeyList().filter(function(k) { return k.charAt(1) !== "s"; });
	}
	function requireChat() {
		if(!gClient.isConnected()) {
			alert("Connect to a room first.");
			return false;
		}
		return true;
	}

	function funSafeNote(note, delay, hold, vol) {
		if(note && gPiano.keys[note]) funNoteAt(note, delay, hold, vol);
	}
	function funMelody(seq, gap, hold, vol) {
		var t = 0;
		for(var i = 0; i < seq.length; i++) {
			var item = seq[i];
			if(item === "." || item === "-") {
				t += gap;
				continue;
			}
			if(Array.isArray(item)) {
				for(var j = 0; j < item.length; j++) funSafeNote(item[j], t, hold, vol);
				t += gap;
				continue;
			}
			funSafeNote(item, t, hold, vol);
			t += gap;
		}
	}
	function funRamp(keys, gap, hold, volStart, volEnd) {
		for(var i = 0; i < keys.length; i++) {
			var v = volStart + (volEnd - volStart) * (keys.length <= 1 ? 0 : i / (keys.length - 1));
			funSafeNote(keys[i], i * gap, hold, v);
		}
	}
	function funOscillate(notes, cycles, gap, hold, vol) {
		for(var c = 0; c < cycles; c++) {
			for(var i = 0; i < notes.length; i++) {
				funSafeNote(notes[i], (c * notes.length + i) * gap, hold, vol);
			}
		}
	}
	function funMelodyAt(startMs, seq, gap, hold, vol) {
		var t = startMs || 0;
		for(var i = 0; i < seq.length; i++) {
			var item = seq[i];
			if(item === "." || item === "-") {
				t += gap;
				continue;
			}
			if(Array.isArray(item)) {
				for(var j = 0; j < item.length; j++) funSafeNote(item[j], t, hold, vol);
				t += gap;
				continue;
			}
			funSafeNote(item, t, hold, vol);
			t += gap;
		}
	}
	function funEvery(intervalMs, durationMs, fn) {
		var iv = setInterval(fn, intervalMs);
		gFunIntervals.push(iv);
		gFunTimers.push(setTimeout(function() {
			clearInterval(iv);
			var idx = gFunIntervals.indexOf(iv);
			if(idx >= 0) gFunIntervals.splice(idx, 1);
		}, durationMs));
		return iv;
	}
	function funAt(ms, fn) {
		gFunTimers.push(setTimeout(fn, ms));
	}

	function funBoom(delay, vol) {
		gFunTimers.push(setTimeout(function() {
			["c2","g2","c3","e3","g3","c4","e4","g4"].forEach(function(n) { press(n, vol || 1, true); });
			gFunTimers.push(setTimeout(releaseAllKeysHack, 380));
		}, delay || 0));
	}

	var FUN_PIANO_PLAY_EXTRA = {
		"fun-vine-boom": function() {
			funSafeNote("c6", 0, 15, 0.04);
			funBoom(350, 1);
		},
		"fun-bruh": function() {
			funMelody(["g3","fs3","f3","e3","ds3","d3","cs3","c3"], 200, 280, 0.98);
			funSafeNote("g2", 1700, 400, 1);
		},
		"fun-oof": function() {
			funSafeNote("c4", 0, 45, 0.95);
			funSafeNote("a3", 55, 55, 0.9);
			funSafeNote("f3", 115, 55, 0.88);
			funSafeNote("d3", 175, 140, 1);
		},
		"fun-wrong": function() {
			for(var i = 0; i < 20; i++) {
				funSafeNote(i % 2 ? "as3" : "c4", i * 32, 28, 0.98);
			}
			funSafeNote("c3", 700, 350, 1);
		},
		"fun-airhorn": function() {
			["c4","ds4","fs4","c5","fs4","ds4","c4"].forEach(function(n, i) {
				funSafeNote(n, i * 90, 200, 1);
			});
			funBoom(700, 0.9);
		},
		"fun-bonk": function() {
			funSafeNote("c5", 0, 25, 0.9);
			funSafeNote("c3", 40, 60, 1);
			funSafeNote("g2", 110, 100, 0.98);
			funSafeNote("c2", 200, 180, 1);
		},
		"fun-sus": function() {
			funChord(["e4","g4","b4"], 0, 500, 0.55);
			gFunTimers.push(setTimeout(function() {
				funMelody(["e5",".","e5",".","e5"], 120, 80, 0.7);
			}, 520));
		},
		"fun-skill-issue": function() {
			funMelody(["c5","b4","a4","g4","f4","e4","d4","c4"], 100, 70, 0.85);
			funMelody(["c4","d4","e4","f4","g4","a4","b4","c5"], 900, 70, 0.85);
			funSafeNote("c3", 1700, 300, 1);
		},
		"fun-nut": function() {
			funSafeNote("c2", 0, 30, 0.5);
			gFunTimers.push(setTimeout(function() {
				["c3","e3","g3","c4","e4","g4","c5","e5","g5","c6"].forEach(function(n) {
					press(n, 1, true);
				});
				gFunTimers.push(setTimeout(releaseAllKeysHack, 450));
			}, 80));
		},
		"fun-yeet": function() {
			var keys = pianoKeyList().sort().slice(10, 35);
			for(var i = 0; i < keys.length; i++) funSafeNote(keys[i], i * 18, 35, 0.5 + i * 0.02);
			gFunTimers.push(setTimeout(releaseAllKeysHack, keys.length * 18 + 50));
		},
		"fun-gotem": function() {
			funMelody(["g4",".","g4","g4","c5",".","g4","c5","e5"], 130, 90, 0.9);
			funBoom(1100, 0.85);
		},
		"fun-rick": function() {
			funMelody(["g4","b4","d5","g5"], 180, 120, 0.85);
			gFunTimers.push(setTimeout(function() {
				funMelody(["b4","d5","g5","d5","b4","g4"], 0, 100, 0.8);
			}, 800));
		},
		"fun-dna": function() {
			funMelody(["g4","g4","g4","g4","c5",".","g4","g4","g4","g4","ds5","c5"], 190, 140, 0.88);
		},
		"fun-ohno": function() {
			funMelody(["c5","b4","as4","a4","as4","a4","g4","fs4","g4","fs4","f4","e4"], 160, 110, 0.8);
		},
		"fun-bazinga": function() {
			funMelody([".",".",".","c4","e4","g4","c5"], 100, 80, 0.5);
			funMelody(["e5","ds5","e5","c5","g4","c5","e5"], 500, 100, 0.92);
		},
		"fun-fart": function() {
			var fart = ["c3","b2","as2","a2","gs2","g2","fs2","f2","e2","ds2","d2"];
			for(var i = 0; i < fart.length; i++) {
				funSafeNote(fart[i], i * 38, 70, 0.65 + Math.random() * 0.2);
			}
		},
		"fun-clown": function() {
			for(var h = 0; h < 5; h++) {
				funSafeNote("fs4", h * 220, 160, 0.95);
				funSafeNote("a4", h * 220 + 90, 140, 0.9);
			}
		},
		"fun-slide-whistle": function() {
			var keys = pianoKeyList().sort().slice(15, 50);
			for(var i = 0; i < keys.length; i++) funSafeNote(keys[i], i * 22, 35, 0.75);
			var down = keys.slice().reverse();
			for(var j = 0; j < down.length; j++) funSafeNote(down[j], keys.length * 22 + j * 22, 35, 0.75);
		},
		"fun-boing": function() {
			for(var b = 0; b < 6; b++) {
				var t = b * 200;
				funSafeNote("c4", t, 35, 0.95);
				funSafeNote("g4", t + 45, 40, 0.85);
				funSafeNote("c5", t + 95, 50, 0.75);
				funSafeNote("g4", t + 155, 35, 0.7);
			}
		},
		"fun-slip": function() {
			funSafeNote("c5", 0, 60, 0.8);
			funSafeNote("b4", 70, 50, 0.78);
			var slide = pianoKeyList().sort().slice(20, 55).reverse();
			for(var i = 0; i < slide.length; i++) funSafeNote(slide[i], 150 + i * 28, 45, 0.85);
			funSafeNote("c2", 150 + slide.length * 28 + 50, 250, 1);
		},
		"fun-sad-trombone": function() {
			funMelody(["f4","e4","ds4","d4","cs4","c4","b3","as3","a3","gs3","g3","fs3","f3"], 130, 220, 0.92);
		},
		"fun-crickets": function() {
			gFunTimers.push(setTimeout(function() {
				for(var i = 0; i < 12; i++) {
					funSafeNote("c6", i * 280 + Math.random() * 80, 25, 0.12 + Math.random() * 0.1);
					funSafeNote("g5", i * 280 + 140 + Math.random() * 60, 20, 0.1);
				}
			}, 900));
		},
		"fun-record-scratch": function() {
			var keys = pianoKeyList().sort();
			for(var i = 0; i < 18; i++) funSafeNote(keys[keys.length - 1 - i], i * 20, 30, 0.8);
			funSafeNote("c2", 400, 400, 1);
		},
		"fun-nope": function() {
			for(var i = 0; i < 14; i++) {
				funSafeNote(i % 2 ? "e5" : "c5", i * 55, 40, 0.92);
			}
		},
		"fun-game-over": function() {
			funMelody(["c5","g4","e4","c4","g3","e3","c3"], 280, 220, 0.88);
		},
		"fun-hurt": function() {
			for(var i = 0; i < 4; i++) {
				funSafeNote("fs4", i * 180, 50, 0.95);
				funSafeNote("f4", i * 180 + 60, 80, 0.9);
			}
		},
		"fun-error": function() {
			funSafeNote("c5", 0, 80, 0.7);
			funSafeNote("as4", 200, 80, 0.7);
			funSafeNote("c5", 400, 80, 0.7);
			gFunTimers.push(setTimeout(function() {
				for(var i = 0; i < 6; i++) funSafeNote("c5", i * 60, 40, 0.85);
			}, 700));
		},
		"fun-jumpscare": function() {
			funSafeNote("c6", 0, 20, 0.03);
			gFunTimers.push(setTimeout(function() {
				funBoom(0, 1);
				var highs = pianoKeyList().sort().slice(-8);
				for(var j = 0; j < highs.length; j++) press(highs[j], 0.95, true);
			}, 650));
		},
		"fun-goblin": function() {
			var keys = pianoKeyList();
			gChaosIv = setInterval(function() {
				var n = keys[Math.floor(Math.random() * keys.length)];
				press(n, Math.random() * 0.5 + 0.5, true);
				(function(note) {
					gFunTimers.push(setTimeout(function() { release(note, true); }, 60 + Math.random() * 120));
				})(n);
			}, 45);
			gFunTimers.push(setTimeout(function() {
				if(gChaosIv) { clearInterval(gChaosIv); gChaosIv = null; }
			}, 2500));
		},
		"fun-bababooey": function() {
			funMelody(["g4","g4","g4","e4",".","g4","c5","b4","g4"], 150, 100, 0.88);
			funMelody(["g3","g3","c4","g4","c5","g4","c4","g3"], 1400, 90, 0.82);
		},

		/* ── Long memes (20–45 sec) ── */
		"fun-rick-full": function() {
			var rick = ["g4","b4","d5","g5","b4","d5","g5","d5","b4","g4","b4","d5","g5"];
			funMelodyAt(0, rick, 220, 140, 0.82);
			funMelodyAt(3000, rick, 220, 140, 0.82);
			funMelodyAt(6000, ["g4","b4","d5","g5","g5","d5","b4","g4","d5","g5","b4","g4"], 200, 120, 0.8);
			funMelodyAt(9000, rick, 200, 130, 0.85);
			funAt(12000, function() { funMelody(rick, 190, 150, 0.88); });
			funBoom(15000, 0.75);
		},
		"fun-meme-medley": function() {
			funMelodyAt(0, ["g4","g4","g4","g4","c5",".","g4","g4","g4","g4","ds5","c5"], 200, 130, 0.85);
			funMelodyAt(2800, ["c5","b4","as4","a4","as4","a4","g4","fs4","g4","fs4","f4","e4"], 170, 100, 0.78);
			funMelodyAt(5200, ["g3","fs3","f3","e3","ds3","d3","c3"], 240, 260, 0.95);
			funAt(7000, function() {
				funMelody(["g4","b4","d5","g5","b4","d5","g5"], 200, 120, 0.8);
			});
			funAt(9500, function() {
				funMelody(["g4","g4","g4","e4",".","g4","c5","b4","g4"], 160, 100, 0.88);
			});
			funBoom(12000, 0.9);
			funMelodyAt(13500, ["e5","ds5","e5","c5","g4","c5","e5"], 180, 110, 0.9);
			funAt(16000, function() { funBoom(0, 1); });
		},
		"fun-vine-chain": function() {
			for(var i = 0; i < 8; i++) {
				(function(n) {
					funAt(n * 2200, function() {
						funSafeNote("c6", 0, 15, 0.04);
						funBoom(300, 0.85 + n * 0.02);
					});
				})(i);
			}
			funAt(18000, function() {
				["c2","g2","c3","e3","g3","c4","e4","g4","c5","e5","g5"].forEach(function(k) {
					press(k, 1, true);
				});
				gFunTimers.push(setTimeout(releaseAllKeysHack, 800));
			});
		},
		"fun-bruh-hour": function() {
			var bruh = ["g3","fs3","f3","e3","ds3","d3","c3"];
			for(var r = 0; r < 5; r++) {
				funMelodyAt(r * 3200, bruh, 220, 300, 0.9 + r * 0.02);
				funSafeNote("g2", r * 3200 + 1600, 350, 0.95);
			}
			funAt(16000, function() { funSafeNote("c2", 0, 1200, 1); });
		},
		"fun-airhorn-concert": function() {
			var horns = ["c4","ds4","fs4","c5","as4","fs4","ds4","c4"];
			for(var pass = 0; pass < 4; pass++) {
				funMelodyAt(pass * 4500, horns, 280, 220, 0.88);
				funAt(pass * 4500 + 3600, function() { funBoom(0, 0.7); });
			}
		},
		"fun-mega-bonk": function() {
			for(var b = 0; b < 18; b++) {
				(function(n) {
					funAt(n * 1100, function() {
						funSafeNote("c5", 0, 25, 0.9);
						funSafeNote("c3", 35, 55, 1);
						funSafeNote("g2", 95, 90, 0.98);
					});
				})(b);
			}
			funAt(20000, function() { funSafeNote("c2", 0, 500, 1); });
		},
		"fun-sus-meeting": function() {
			funChord(["e4","g4","b4"], 0, 800, 0.5);
			funEvery(900, 22000, function() {
				funSafeNote("e5", 0, 70, 0.65);
				funSafeNote("b4", 200, 70, 0.55);
			});
			funMelodyAt(8000, ["e4","g4","b4","e5","b4","g4"], 400, 200, 0.6);
			funMelodyAt(14000, ["e5",".","e5",".","e5","e5","e5"], 300, 100, 0.75);
			funAt(20000, function() {
				funChord(["c3","e3","g3","c4"], 0, 600, 1);
			});
		},
		"fun-ohno-loop": function() {
			var ohno = ["c5","b4","as4","a4","as4","a4","g4","fs4","g4","fs4","f4","e4"];
			for(var l = 0; l < 5; l++) {
				funMelodyAt(l * 2600, ohno, 165, 105, 0.78 + l * 0.04);
			}
			funAt(13000, function() { funMelody(ohno, 140, 90, 0.9); });
			funBoom(15000, 0.8);
		},
		"fun-clown-car": function() {
			for(var h = 0; h < 24; h++) {
				(function(n) {
					var gap = Math.max(80, 280 - n * 8);
					funAt(n * gap, function() {
						funSafeNote("fs4", 0, 140, 0.92);
						funSafeNote("a4", 70, 120, 0.88);
					});
				})(h);
			}
			funAt(20000, function() {
				for(var i = 0; i < 8; i++) {
					funSafeNote(i % 2 ? "a4" : "fs4", i * 60, 80, 1);
				}
			});
		},
		"fun-fart-symphony": function() {
			var mov = ["c3","b2","as2","a2","gs2","g2","fs2","f2","e2","ds2","d2","c2"];
			for(var m = 0; m < 4; m++) {
				(function(movement) {
					funAt(movement * 5000, function() {
						for(var i = 0; i < mov.length; i++) {
							funSafeNote(mov[i], i * 42, 75, 0.6 + Math.random() * 0.25);
						}
					});
				})(m);
			}
			funAt(20000, function() {
				mov.forEach(function(n, i) { funSafeNote(n, i * 30, 100, 0.95); });
			});
		},
		"fun-windows-meltdown": function() {
			funMelodyAt(0, ["c5","as4","c5"], 350, 100, 0.7);
			funEvery(500, 25000, function() {
				funSafeNote(Math.random() > 0.5 ? "c5" : "as4", 0, 50, 0.75);
			});
			funAt(8000, function() {
				for(var i = 0; i < 20; i++) funSafeNote("c5", i * 45, 35, 0.85);
			});
			funAt(15000, function() {
				for(var j = 0; j < 30; j++) {
					funSafeNote(j % 2 ? "as4" : "c5", j * 30, 25, 0.9);
				}
			});
			funAt(22000, function() { funBoom(0, 1); });
		},
		"fun-goblin-rave": function() {
			var keys = pianoKeyList();
			var iv = funEvery(40, 38000, function() {
				var n = keys[Math.floor(Math.random() * keys.length)];
				press(n, Math.random() * 0.45 + 0.55, true);
				(function(note) {
					gFunTimers.push(setTimeout(function() { release(note, true); }, 50 + Math.random() * 100));
				})(n);
			});
			gChaosIv = iv;
			funAt(12000, function() { funBoom(0, 0.8); });
			funAt(24000, function() { funBoom(0, 0.9); });
			funAt(36000, function() {
				keys.forEach(function(k) { press(k, 0.7, true); });
				gFunTimers.push(setTimeout(releaseAllKeysHack, 600));
			});
		},
		"fun-skill-roast": function() {
			var down = ["c5","b4","a4","g4","f4","e4","d4","c4"];
			var up = ["c4","d4","e4","f4","g4","a4","b4","c5"];
			for(var r = 0; r < 4; r++) {
				funMelodyAt(r * 5000, down, 110, 65, 0.82);
				funMelodyAt(r * 5000 + 900, up, 110, 65, 0.82);
				funSafeNote("c3", r * 5000 + 2000, 280, 0.95);
			}
			funMelodyAt(20000, down.concat(up), 90, 55, 0.88);
		},
		"fun-bababooey-opera": function() {
			var a = ["g4","g4","g4","e4",".","g4","c5","b4","g4"];
			var b = ["g3","g3","c4","g4","c5","g4","c4","g3"];
			funMelodyAt(0, a, 160, 110, 0.88);
			funMelodyAt(1800, b, 150, 100, 0.82);
			funMelodyAt(3600, a, 150, 100, 0.9);
			funMelodyAt(5400, b, 140, 95, 0.85);
			funMelodyAt(7200, a, 140, 95, 0.92);
			funMelodyAt(9000, b, 130, 90, 0.88);
			funMelodyAt(10800, a, 130, 90, 0.94);
			funMelodyAt(12600, b, 120, 85, 0.9);
			funAt(14400, function() {
				funMelody(a.concat(b), 120, 100, 0.95);
			});
			funBoom(17000, 0.85);
		},
		"fun-nut-megamix": function() {
			for(var n = 0; n < 7; n++) {
				(function(drop) {
					funAt(drop * 2800, function() {
						funSafeNote("c2", 0, 25, 0.4);
						gFunTimers.push(setTimeout(function() {
							["c3","e3","g3","c4","e4","g4","c5","e5","g5"].forEach(function(k) {
								press(k, 1, true);
							});
							gFunTimers.push(setTimeout(releaseAllKeysHack, 350));
						}, 60));
					});
				})(n);
			}
			funAt(20000, function() {
				pressAllKeysHack();
				gFunTimers.push(setTimeout(releaseAllKeysHack, 1000));
			});
		},
		"fun-wrong-marathon": function() {
			funEvery(280, 28000, function() {
				for(var i = 0; i < 4; i++) {
					funSafeNote(i % 2 ? "as3" : "c4", i * 35, 28, 0.95);
				}
			});
			funAt(25000, function() {
				for(var j = 0; j < 40; j++) {
					funSafeNote(j % 2 ? "as3" : "c4", j * 25, 22, 0.98);
				}
				funSafeNote("c2", 1100, 600, 1);
			});
		},
		"fun-circus-train": function() {
			for(var lap = 0; lap < 5; lap++) {
				(function(l) {
					var base = l * 5000;
					funAt(base, function() {
						var keys = pianoKeyList().sort().slice(15, 45);
						for(var i = 0; i < keys.length; i++) funSafeNote(keys[i], i * 28, 40, 0.75);
					});
					funAt(base + 1400, function() {
						funSafeNote("fs4", 0, 150, 0.92);
						funSafeNote("a4", 80, 130, 0.88);
					});
					funAt(base + 1800, function() {
						for(var b = 0; b < 4; b++) {
							var t = b * 180;
							funSafeNote("c4", t, 35, 0.9);
							funSafeNote("g4", t + 40, 40, 0.8);
							funSafeNote("c5", t + 85, 50, 0.75);
						}
					});
					funAt(base + 3200, function() { funBoom(0, 0.65); });
				})(lap);
			}
		},
		"fun-creepy-jumpscare": function() {
			var keys = pianoKeyList().sort().slice(0, 30);
			for(var i = 0; i < keys.length; i++) funSafeNote(keys[i], i * 400, 350, 0.35);
			funEvery(1200, 22000, function() {
				funSafeNote("c6", 0, 20, 0.08);
			});
			funAt(24000, function() {
				funSafeNote("c6", 0, 15, 0.02);
				gFunTimers.push(setTimeout(function() {
					funBoom(0, 1);
					pianoKeyList().sort().slice(-12).forEach(function(n) { press(n, 1, true); });
					gFunTimers.push(setTimeout(releaseAllKeysHack, 700));
				}, 500));
			});
		},
		"fun-phone-chaos": function() {
			for(var ring = 0; ring < 6; ring++) {
				(function(r) {
					funAt(r * 4000, function() {
						for(var i = 0; i < 10; i++) {
							funSafeNote(i % 2 ? "g4" : "b4", i * 170, 110, 0.78);
						}
					});
				})(ring);
			}
			funAt(24000, function() {
				funEvery(80, 6000, function() {
					var k = pianoKeyList();
					var n = k[Math.floor(Math.random() * k.length)];
					press(n, 0.9, true);
					gFunTimers.push(setTimeout(function() { release(n, true); }, 80));
				});
			});
		},
		"fun-troll-storm": function() {
			var stings = [
				function() { funMelody(["g4","g4","g4","c5"], 120, 80, 0.85); },
				function() { funSafeNote("c4", 0, 45, 0.95); funSafeNote("a3", 55, 140, 1); },
				function() { funMelody(["c5","b4","as4","a4"], 150, 90, 0.8); },
				function() { for(var i = 0; i < 6; i++) funSafeNote(i % 2 ? "as3" : "c4", i * 35, 28, 0.95); },
				function() { funSafeNote("fs4", 0, 160, 0.92); funSafeNote("a4", 90, 140, 0.88); },
				function() { funMelody(["g4","b4","d5","g5"], 180, 110, 0.82); },
				function() { funBoom(0, 0.85); }
			];
			for(var t = 0; t < 12; t++) {
				(function(idx) {
					funAt(idx * 2500, function() {
						stings[idx % stings.length]();
					});
				})(t);
			}
			funAt(30000, function() { funBoom(0, 1); pressAllKeysHack(); });
			gFunTimers.push(setTimeout(releaseAllKeysHack, 32000));
		},
		"fun-slide-rollercoaster": function() {
			for(var ride = 0; ride < 4; ride++) {
				(function(r) {
					var base = r * 7000;
					funAt(base, function() {
						var up = pianoKeyList().sort().slice(10, 55);
						for(var i = 0; i < up.length; i++) funSafeNote(up[i], i * 35, 45, 0.7);
					});
					funAt(base + 1600, function() {
						var down = pianoKeyList().sort().slice(10, 55).reverse();
						for(var j = 0; j < down.length; j++) funSafeNote(down[j], j * 30, 40, 0.75);
					});
					funAt(base + 3200, function() {
						funOscillate(["c4","d4","e4","f4","g4","a4","b4","c5"], 3, 60, 70, 0.8);
					});
					funAt(base + 5200, function() { funBoom(0, 0.75); });
				})(ride);
			}
		},
		"fun-boing-marathon": function() {
			for(var b = 0; b < 40; b++) {
				(function(n) {
					var t = n * 600;
					funSafeNote("c4", t, 35, 0.92);
					funSafeNote("g4", t + 42, 42, 0.82);
					funSafeNote("c5", t + 90, 55, 0.72);
					funSafeNote("g4", t + 155, 38, 0.68);
				})(b);
			}
			funAt(24500, function() {
				for(var i = 0; i < 12; i++) {
					var t = i * 100;
					funSafeNote("c4", t, 30, 1);
					funSafeNote("c5", t + 50, 40, 0.9);
				}
			});
		}
	};

	function bindFunPlays(plays) {
		for(var id in plays) {
			if(!plays.hasOwnProperty(id)) continue;
			(function(playId, fn) {
				$hacksPanel.on("click", "#" + playId, function(e) {
					e.preventDefault();
					funPrep();
					fn();
				});
			})(id, plays[id]);
		}
	}

	function setHacksOpen(open) {
		document.body.classList.toggle("hacks-open", !!open);
		var btn = document.getElementById("hacks-toggle-btn");
		if(btn) btn.textContent = open ? "Hacks ▲" : "Hacks ▼";
	}

	function initSheetAndFunControls() {
		document.getElementById("hacks-toggle-btn").addEventListener("click", function(e) {
			e.preventDefault();
			e.stopPropagation();
			setHacksOpen(!document.body.classList.contains("hacks-open"));
		});
		$("#hacks-dock-collapse").on("click", function(e) {
			e.preventDefault();
			setHacksOpen(false);
		});
		$hacksPanel.on("focusin", "input, select", function() {
			releaseKeyboard();
		});
		$hacksPanel.on("focusout", function() {
			setTimeout(function() {
				if(isTypingTarget()) return;
				if(!gModal && !$("#chat").hasClass("chatting")) captureKeyboard();
			}, 0);
		});

		document.getElementById("sheet-btn").addEventListener("click", function(e) {
			e.preventDefault();
			e.stopPropagation();
			openModal("#sheet-play");
		});

		var roomMediaBtn = document.getElementById("room-media-btn");
		if(roomMediaBtn) {
			roomMediaBtn.addEventListener("click", function(e) {
				e.preventDefault();
				e.stopPropagation();
				openModal("#room-media");
			});
		}

		$roomMediaTransport.on("click", ".dj-btn", function(e) { e.stopPropagation(); });
		$roomMediaTransport.on("click", ".room-media-player-close", function(e) {
			e.preventDefault();
			resetRoomMediaLayout();
			showRoomMediaTransport(false);
		});
		$roomMediaTransport.on("mousedown touchstart", "input[name=seek]", function() {
			this._dragging = true;
		});
		$roomMediaTransport.on("mouseup touchend", "input[name=seek]", function() {
			this._dragging = false;
		});
		$roomMediaTransport.on("input", "input[name=seek]", function() {
			if(!gRoomMedia) return;
			var sec = parseFloat(this.value) || 0;
			updateRoomMediaProgress({
				current: sec,
				duration: gRoomMedia.activeEl.duration || 0,
				title: gRoomMedia.title,
				dj: gRoomMedia.djName
			});
		});
		$roomMediaTransport.on("change", "input[name=seek]", function() {
			if(gRoomMedia) gRoomMedia.seekTo(parseFloat(this.value) || 0);
		});
		$roomMediaTransport.on("input", "input[name=volume]", function() {
			if(gRoomMedia) gRoomMedia.setVolume(parseFloat(this.value) || 0);
		});
		$roomMediaTransport.on("click", ".play", function(e) {
			e.preventDefault();
			ensureAudioReady();
			if(!gRoomMedia || !gRoomMedia.url) {
				alert("Load music from Room DJ first.");
				return;
			}
			gRoomMedia.play(true);
		});
		$roomMediaTransport.on("click", ".pause", function(e) {
			e.preventDefault();
			if(gRoomMedia) gRoomMedia.pause(true);
		});
		$roomMediaTransport.on("click", ".stop", function(e) {
			e.preventDefault();
			if(gRoomMedia) gRoomMedia.stop(true);
			resetRoomMediaLayout();
		});
		$roomMediaTransport.on("click", ".back", function(e) {
			e.preventDefault();
			if(gRoomMedia) gRoomMedia.seekTo(Math.max(0, gRoomMedia.getCurrentTime() - 10));
		});
		$roomMediaTransport.on("click", ".forward", function(e) {
			e.preventDefault();
			if(gRoomMedia) {
				gRoomMedia.seekTo(Math.min(gRoomMedia.getDuration(), gRoomMedia.getCurrentTime() + 10));
			}
		});
		$roomMediaTransport.on("click", ".room-media-sync", function(e) {
			e.preventDefault();
			if(ensureRoomMediaReady()) gRoomMedia.requestSync();
		});
		$roomMediaVideoWrap.on("click", ".room-media-video-close", function(e) {
			e.preventDefault();
			resetRoomMediaLayout();
			$roomMediaVideoWrap.attr("hidden", "hidden");
		});
		$roomMediaVideoWrap.on("click", ".room-media-hide-piano-btn", function(e) {
			e.preventDefault();
			toggleRoomMediaHidePiano();
		});
		$roomMediaVideoWrap.on("click", ".room-media-cinema-btn", function(e) {
			e.preventDefault();
			toggleRoomMediaCinema();
		});
		$roomMediaTransport.on("click", ".room-media-hide-piano-transport", function(e) {
			e.preventDefault();
			toggleRoomMediaHidePiano();
		});
		$roomMediaTransport.on("click", ".room-media-cinema-transport", function(e) {
			e.preventDefault();
			toggleRoomMediaCinema();
		});
		$roomMediaTransport.on("click", ".room-media-chat-transport", function(e) {
			e.preventDefault();
			toggleRoomMediaCinemaChat();
		});
		$roomMediaVideoWrap.on("click", ".room-media-chat-btn", function(e) {
			e.preventDefault();
			toggleRoomMediaCinemaChat();
		});
		$(document).on("keydown.roomMediaCinema", function(e) {
			if(e.key === "Escape" && gRoomMediaCinema) setRoomMediaCinema(false);
		});
		$(document).on("mousemove.roomMediaCinema touchstart.roomMediaCinema", function() {
			if(gRoomMediaCinema) bumpRoomMediaControls();
		});
		$roomMediaVideoWrap.on("dblclick", ".room-media-video-stage", function(e) {
			e.preventDefault();
			if(roomMediaHasVideoPanel()) toggleRoomMediaCinema();
		});
		$roomMediaTransport.on("mouseenter mousedown touchstart focusin click", function() {
			bumpRoomMediaControls();
		});

		$("#room-media").on("click", ".room-media-load", function(e) {
			e.preventDefault();
			e.stopPropagation();
			loadRoomMediaSelection().catch(function(err) {
				alert(err.message || String(err));
			});
		});
		$("#room-media").on("click", ".play", function(e) {
			e.preventDefault();
			e.stopPropagation();
			if(!ensureRoomMediaReady()) return;
			ensureAudioReady();
			function startPlay() {
				gRoomMedia.play(true);
				showRoomMediaTransport(true);
				closeModal();
			}
			if(!gRoomMedia.url) {
				loadRoomMediaSelection().then(startPlay).catch(function(err) {
					alert(err.message || String(err));
				});
				return;
			}
			startPlay();
		});
		$("#room-media").on("click", ".stop", function(e) {
			e.preventDefault();
			e.stopPropagation();
			if(gRoomMedia) gRoomMedia.stop(true);
		});
		$("#room-media").on("click", ".room-media-sync", function(e) {
			e.preventDefault();
			e.stopPropagation();
			if(ensureRoomMediaReady()) gRoomMedia.requestSync();
		});
		$("#room-media").on("change", "input[name=mediafile]", function() {
			var f = this.files && this.files[0];
			if(f) {
				$roomMediaDialog.find("input[name=mediaurl]").val("");
				$roomMediaDialog.find("input[name=videourl]").val("");
				$roomMediaDialog.find(".room-media-drop-name").text(f.name);
				$roomMediaDialog.find(".room-media-drop-text").text("Selected file");
			}
		});
		$("#room-media").on("click", ".dj-btn", function(e) { e.stopPropagation(); });

		var learnBtn = document.getElementById("learn-btn");
		if(learnBtn) {
			learnBtn.addEventListener("click", function(e) {
				e.preventDefault();
				e.stopPropagation();
				setLearnPanelOpen($learnPanel.is("[hidden]"));
			});
		}
		$learnPanel.on("click", ".learn-close", function(e) {
			e.preventDefault();
			setLearnPanelOpen(false);
		});
		$learnPanel.on("mousedown touchstart pointerdown", function(e) {
			e.stopPropagation();
			releaseKeyboard();
		});
		$learnPanel.on("mousedown touchstart pointerdown", "input, select, button, label", function(e) {
			e.stopPropagation();
			releaseKeyboard();
		});
		$learnPanel.on("focusin", "input, select", function() { releaseKeyboard(); });
		$learnPanel.on("focusout", function(e) {
			setTimeout(function() {
				if($(e.relatedTarget).closest("#learn-panel").length) return;
				if(isTypingTarget()) return;
				if(!gModal && !$("#chat").hasClass("chatting") && $learnPanel.is("[hidden]")) {
					captureKeyboard();
				}
			}, 0);
		});
		$learnPanel.on("change", "input[name=show-note-names]", function() {
			PianoLearn.setLabelPrefs(this.checked, $learnPanel.find("input[name=show-key-labels]").is(":checked"));
		});
		$learnPanel.on("change", "input[name=show-key-labels]", function() {
			PianoLearn.setLabelPrefs($learnPanel.find("input[name=show-note-names]").is(":checked"), this.checked);
		});
		$learnPanel.on("change", "select[name=learn-mode]", function() {
			if(PianoLearn.guide) PianoLearn.guide.mode = this.value;
		});
		$learnPanel.on("click", ".learn-load-demo", function(e) {
			e.preventDefault();
			fetch("./45982_Rush-e_keys.txt").then(function(r) {
				if(!r.ok) throw new Error("Demo file not found");
				return r.text();
			}).then(function(text) {
				var track = PianoLearn.parseKeyGuide(text);
				PianoLearn.applyLearnTrack(PianoLearn.guide, track, setLearnTrackTitle);
				if(gMetronome && track.bpm) {
					gMetronome.applyFromGuide(track.bpm);
					syncMetronomeControlsFromEngine();
				}
			}).catch(function(err) { alert(err.message); });
		});
		$learnPanel.find("input[name=guide-file]").on("change", function() {
			var file = this.files && this.files[0];
			if(!file) return;
			loadLearnFromFile(file);
			this.value = "";
		});
		$learnPanel.on("click", ".learn-play", function(e) {
			e.preventDefault();
			try {
				var mode = $learnPanel.find("select[name=learn-mode]").val() || "guide";
				PianoLearn.guide.start(mode, learnTempoScale());
				setLearnPanelOpen(true);
			} catch(err) { alert(err.message); }
		});
		$learnPanel.on("click", ".learn-pause", function(e) {
			e.preventDefault();
			if(PianoLearn.guide) PianoLearn.guide.pause();
		});
		$learnPanel.on("click", ".learn-stop", function(e) {
			e.preventDefault();
			if(PianoLearn.guide) PianoLearn.guide.stop();
		});
		$learnPanel.on("click", ".learn-prev", function(e) {
			e.preventDefault();
			if(PianoLearn.guide) PianoLearn.guide.seekStep(-1);
		});
		$learnPanel.on("click", ".learn-next", function(e) {
			e.preventDefault();
			if(PianoLearn.guide) PianoLearn.guide.seekStep(1);
		});

		var metroBtn = document.getElementById("metronome-btn");
		if(metroBtn) {
			metroBtn.addEventListener("click", function(e) {
				e.preventDefault();
				e.stopPropagation();
				setMetronomePanelOpen($metronomePanel.is("[hidden]"));
			});
		}

		var blobBtn = document.getElementById("harmony-blob-btn");
		if(blobBtn && gBlobFriend) {
			blobBtn.addEventListener("click", function(e) {
				e.preventDefault();
				e.stopPropagation();
				gBlobFriend.setVisible(!gBlobFriend.visible);
				if(gBlobFriend.visible && gBlobFriend.canvas) {
					setTimeout(function() { gBlobFriend._resize(); }, 0);
				}
				updateHarmonyToolsUi();
			});
		}
		var doodlerBtn = document.getElementById("harmony-doodle-btn");
		if(doodlerBtn && gDesktopDoodler) {
			doodlerBtn.addEventListener("click", function(e) {
				e.preventDefault();
				e.stopPropagation();
				gDesktopDoodler.setVisible(!gDesktopDoodler.visible);
				if(gDesktopDoodler.visible) {
					gDesktopDoodler.setMinimized(false);
					if(gDesktopDoodler.canvas) setTimeout(function() { gDesktopDoodler._resize(); }, 0);
				}
				updateHarmonyToolsUi();
			});
		}
		var pianoToggleBtn = document.getElementById("harmony-piano-btn");
		if(pianoToggleBtn) {
			pianoToggleBtn.addEventListener("click", function(e) {
				e.preventDefault();
				e.stopPropagation();
				setPianoCollapsed(!gPianoCollapsed);
			});
		}

		// ---- Emoji reactions bar ----
		var reactBtn = document.getElementById("harmony-react-btn");
		if(reactBtn && gEmojiParty) {
			var reactBar = document.createElement("div");
			reactBar.id = "emoji-react-bar";
			reactBar.className = "party-bar";
			reactBar.setAttribute("hidden", "hidden");
			gEmojiParty.emojis.forEach(function(em, i) {
				var b = document.createElement("button");
				b.type = "button";
				b.className = "party-btn emoji-btn";
				b.textContent = em;
				b.addEventListener("click", function(e) { e.stopPropagation(); gEmojiParty.react(i); });
				reactBar.appendChild(b);
			});
			var conf = document.createElement("button");
			conf.type = "button";
			conf.className = "party-btn confetti-btn";
			conf.textContent = "🎊 Confetti!";
			conf.addEventListener("click", function(e) { e.stopPropagation(); gEmojiParty.party(); });
			reactBar.appendChild(conf);
			document.body.appendChild(reactBar);

			reactBtn.addEventListener("click", function(e) {
				e.preventDefault();
				e.stopPropagation();
				if(reactBar.hasAttribute("hidden")) reactBar.removeAttribute("hidden");
				else reactBar.setAttribute("hidden", "hidden");
				updateHarmonyToolsUi();
			});
		}

		// ---- Soundboard bar ----
		var soundBtn = document.getElementById("harmony-sound-btn");
		if(soundBtn && gSoundBoard) {
			var soundBar = document.createElement("div");
			soundBar.id = "soundboard-bar";
			soundBar.className = "party-bar";
			soundBar.setAttribute("hidden", "hidden");
			gSoundBoard.sounds.forEach(function(s) {
				var b = document.createElement("button");
				b.type = "button";
				b.className = "party-btn sound-btn";
				b.textContent = s.label;
				b.addEventListener("click", function(e) { e.stopPropagation(); gSoundBoard.trigger(s.id); });
				soundBar.appendChild(b);
			});
			document.body.appendChild(soundBar);

			soundBtn.addEventListener("click", function(e) {
				e.preventDefault();
				e.stopPropagation();
				if(soundBar.hasAttribute("hidden")) soundBar.removeAttribute("hidden");
				else soundBar.setAttribute("hidden", "hidden");
				updateHarmonyToolsUi();
			});
		}

		// ---- Hot Potato Bomb ----
		var bombBtn = document.getElementById("harmony-bomb-btn");
		if(bombBtn && gPartyGame) {
			bombBtn.addEventListener("click", function(e) {
				e.preventDefault();
				e.stopPropagation();
				gPartyGame.setVisible(!gPartyGame.visible);
				updateHarmonyToolsUi();
			});
		}

		// ---- Balloon Pop ----
		var balloonBtn = document.getElementById("harmony-balloon-btn");
		if(balloonBtn && gBalloonPop) {
			balloonBtn.addEventListener("click", function(e) {
				e.preventDefault();
				e.stopPropagation();
				gBalloonPop.setVisible(!gBalloonPop.visible);
				updateHarmonyToolsUi();
			});
		}

		// ---- Car Dodge ----
		var cardodgeBtn = document.getElementById("harmony-cardodge-btn");
		if(cardodgeBtn && gCarDodge) {
			cardodgeBtn.addEventListener("click", function(e) {
				e.preventDefault();
				e.stopPropagation();
				gCarDodge.setVisible(!gCarDodge.visible);
				updateHarmonyToolsUi();
			});
		}

		// ---- Reaction Royale ----
		var reactionBtn = document.getElementById("harmony-reaction-btn");
		if(reactionBtn && gReactionRoyale) {
			reactionBtn.addEventListener("click", function(e) {
				e.preventDefault();
				e.stopPropagation();
				gReactionRoyale.setVisible(!gReactionRoyale.visible);
				updateHarmonyToolsUi();
			});
		}

		// ---- Tug of War ----
		var tugBtn = document.getElementById("harmony-tug-btn");
		if(tugBtn && gTugOfWar) {
			tugBtn.addEventListener("click", function(e) {
				e.preventDefault();
				e.stopPropagation();
				gTugOfWar.setVisible(!gTugOfWar.visible);
				updateHarmonyToolsUi();
			});
		}

		// ---- Local goof toys (useless button, pixel pet, evil cursor, chaos monkey) ----
		function wireToyToggle(btnId, toy) {
			var btn = document.getElementById(btnId);
			if(btn && toy) {
				btn.addEventListener("click", function(e) {
					e.preventDefault();
					e.stopPropagation();
					toy.setActive(!toy.active);
					updateHarmonyToolsUi();
				});
			}
		}
		wireToyToggle("harmony-useless-btn", gUselessButton);
		wireToyToggle("harmony-pet-btn", gPixelPet);
		wireToyToggle("harmony-evil-btn", gEvilCursor);
		wireToyToggle("harmony-chaos-btn", gChaosMonkey);
		var $harmonyTools = $("#harmony-tools");
		$harmonyTools.on("mousedown touchstart pointerdown click", ".play-widget-btn, .doodler-color-btn, .doodler-brush-btn", function(e) {
			e.stopPropagation();
		});
		$harmonyTools.on("mousedown touchstart pointerdown", function(e) {
			e.stopPropagation();
			releaseKeyboard();
		});
		$harmonyTools.on("click", ".blob-toggle-btn", function(e) {
			e.preventDefault();
			e.stopPropagation();
			if(gBlobFriend) gBlobFriend.setVisible(false);
			updateHarmonyToolsUi();
		});
		$harmonyTools.on("click", ".doodler-toggle-btn", function(e) {
			e.preventDefault();
			e.stopPropagation();
			if(gDesktopDoodler) gDesktopDoodler.setVisible(false);
			updateHarmonyToolsUi();
		});

		$metronomePanel.on("click", ".metronome-close", function(e) {
			e.preventDefault();
			setMetronomePanelOpen(false);
		});
		$metronomeHud.on("click", function(e) {
			e.preventDefault();
			setMetronomePanelOpen(true);
		});
		$metronomePanel.on("mousedown touchstart pointerdown", function(e) {
			e.stopPropagation();
			releaseKeyboard();
		});
		$metronomePanel.on("focusin", "input, select", function() { releaseKeyboard(); });
		$metronomePanel.on("focusout", function(e) {
			setTimeout(function() {
				if($(e.relatedTarget).closest("#metronome-panel").length) return;
				if(isTypingTarget()) return;
				if(!gModal && !$("#chat").hasClass("chatting") && $metronomePanel.is("[hidden]") && $learnPanel.is("[hidden]")) {
					captureKeyboard();
				}
			}, 0);
		});
		$metronomePanel.on("input", "input[name=metro-bpm]", function() {
			if(!gMetronome || !canControlRoomMetronome()) return;
			gMetronome.setBpm(this.value);
			syncMetronomeControlsFromEngine();
		});
		$metronomePanel.on("change input", "input[name=metro-bpm-num]", function() {
			if(!gMetronome || !canControlRoomMetronome()) return;
			gMetronome.setBpm(this.value);
			syncMetronomeControlsFromEngine();
		});
		$metronomePanel.on("click", ".metronome-nudge-down", function(e) {
			e.preventDefault();
			if(gMetronome && canControlRoomMetronome()) { gMetronome.nudgeBpm(-1); syncMetronomeControlsFromEngine(); }
		});
		$metronomePanel.on("click", ".metronome-nudge-up", function(e) {
			e.preventDefault();
			if(gMetronome && canControlRoomMetronome()) { gMetronome.nudgeBpm(1); syncMetronomeControlsFromEngine(); }
		});
		$metronomePanel.on("click", ".metronome-tap", function(e) {
			e.preventDefault();
			if(!canControlRoomMetronome()) return;
			ensureAudioReady();
			if(gMetronome) { gMetronome.tap(); syncMetronomeControlsFromEngine(); }
		});
		$metronomePanel.on("click", ".metronome-play", function(e) {
			e.preventDefault();
			startRoomMetronome();
		});
		$metronomePanel.on("click", ".metronome-stop", function(e) {
			e.preventDefault();
			stopRoomMetronome();
		});
		$metronomePanel.on("change", "select[name=metro-timesig]", function() {
			if(!gMetronome) return;
			gMetronome.setBeatsPerBar(parseInt(this.value, 10));
			syncMetronomeControlsFromEngine();
		});
		$metronomePanel.on("change", "select[name=metro-subdiv]", function() {
			if(!gMetronome) return;
			gMetronome.setSubdivision(parseInt(this.value, 10));
		});
		$metronomePanel.on("change", "select[name=metro-sound]", function() {
			if(gMetronome) gMetronome.setSound(this.value);
		});
		$metronomePanel.on("change", "select[name=metro-countin]", function() {
			if(gMetronome) gMetronome.setCountIn(parseInt(this.value, 10));
		});
		$metronomePanel.on("change", "input[name=metro-accent]", function() {
			if(gMetronome) gMetronome.setAccentBeat1(this.checked);
		});
		$metronomePanel.on("input", "input[name=metro-volume]", function() {
			if(!gMetronome) return;
			gMetronome.setVolume(this.value);
			$metronomePanel.find(".metronome-vol-label").text(Math.round(gMetronome.volume * 100) + "%");
		});
		$metronomePanel.on("click", ".metronome-sync-guide", function(e) {
			e.preventDefault();
			applyMetronomeFromGuide();
		});
		$metronomePanel.on("click", ".tb-btn", function(e) { e.stopPropagation(); });

		$("#modals").on("click", ".tb-btn", function(e) { e.stopPropagation(); });
		$midiTransport.on("click", ".tb-btn", function(e) { e.stopPropagation(); });
		$hacksPanel.on("click", ".hack-chip", function(e) { e.stopPropagation(); });

		$midiTransport.on("input", "input[name=tempo]", applyTempoLive);
		$midiTransport.on("click", ".speed-half", function() {
			$midiTransport.find("input[name=tempo]").val(50);
			applyTempoLive();
		});
		$midiTransport.on("click", ".speed-one", function() {
			$midiTransport.find("input[name=tempo]").val(100);
			applyTempoLive();
		});
		$midiTransport.on("click", ".speed-double", function() {
			$midiTransport.find("input[name=tempo]").val(200);
			applyTempoLive();
		});
		$midiTransport.on("change", "input[name=loop]", function() {
			if(gSheetPlayer) gSheetPlayer.setLoop(this.checked);
		});
		$midiTransport.on("mousedown touchstart", "input[name=seek]", function() {
			this._dragging = true;
		});
		$midiTransport.on("mouseup touchend", "input[name=seek]", function() {
			this._dragging = false;
		});
		$midiTransport.on("input", "input[name=seek]", function() {
			var ms = parseFloat(this.value) || 0;
			updateSheetProgress(ms, gSheetPlayer.durationMs);
			if(!gSheetPlayer.playing) gSheetPlayer.offsetMs = ms;
		});
		$midiTransport.on("change", "input[name=seek]", function() {
			if(gSheetPlayer) gSheetPlayer.seekTo(parseFloat(this.value) || 0);
		});
		$midiTransport.on("click", ".play", function(e) {
			e.preventDefault();
			try { startSheetPlayback(gSheetPlayer.offsetMs); } catch(err) { alert(err.message); }
		});
		$midiTransport.on("click", ".pause", function(e) {
			e.preventDefault();
			gSheetPlayer.pause();
			showMidiTransport(true);
		});
		$midiTransport.on("click", ".stop", function(e) {
			e.preventDefault();
			gSheetPlayer.stop();
			gSheetPlayer.offsetMs = 0;
			updateSheetProgress(0, gSheetPlayer.durationMs);
		});
		$midiTransport.on("click", ".restart", function(e) {
			e.preventDefault();
			try { startSheetPlayback(0); } catch(err) { alert(err.message); }
		});
		$midiTransport.on("click", ".back", function(e) {
			e.preventDefault();
			gSheetPlayer.seekBy(-5000);
		});
		$midiTransport.on("click", ".forward", function(e) {
			e.preventDefault();
			gSheetPlayer.seekBy(5000);
		});

		$("#sheet-play").on("change", "input[name=midifile]", function(evt) {
			var file = evt.target.files[0];
			if(!file) return;
			var reader = new FileReader();
			reader.onload = function() {
				try {
					var parsed = SheetPlayer.parseMidi(reader.result);
					gSheetPlayer.setTrack(parsed.events, parsed.durationMs);
					$("#sheet-play textarea[name=notation]").val("");
					$("#sheet-play .file-info").text(
						file.name + " — " + parsed.events.length + " events, " +
						(parsed.durationMs / 1000).toFixed(1) + "s — click Play"
					);
				} catch(err) {
					gSheetPlayer.setTrack([], 0);
					$("#sheet-play .file-info").text("Error: " + err.message);
				}
			};
			reader.readAsArrayBuffer(file);
		});
		$("#sheet-play").on("click", ".play", function(e) {
			e.preventDefault();
			e.stopPropagation();
			try { startSheetPlayback(gSheetPlayer.offsetMs); }
			catch(err) { alert(err.message); }
		});
		$("#sheet-play").on("click", ".stop", function(e) {
			e.preventDefault();
			e.stopPropagation();
			gSheetPlayer.stop();
			gSheetPlayer.offsetMs = 0;
			updateSheetProgress(0, gSheetPlayer.durationMs);
		});

		$hacksPanel.on("click", "#fun-all-keys", function(e) {
			e.preventDefault();
			pressAllKeysHack();
		});
		$hacksPanel.on("click", "#fun-release-all", function(e) {
			e.preventDefault();
			releaseAllKeysHack();
		});
		$hacksPanel.on("click", "#fun-glissando", function(e) {
			e.preventDefault();
			funStopAll();
			ensureAudioReady();
			var keys = Object.keys(gPiano.keys).sort();
			for(var i = 0; i < keys.length; i++) {
				(function(note, idx) {
					gFunTimers.push(setTimeout(function() { press(note, 0.6, true); }, idx * 25));
					gFunTimers.push(setTimeout(function() { release(note, true); }, idx * 25 + 80));
				})(keys[i], i);
			}
		});
		$hacksPanel.on("click", "#fun-drums", function(e) {
			e.preventDefault();
			funStopAll();
			ensureAudioReady();
			var keys = ["c4", "cs4", "d4", "ds4", "e4", "f4", "fs4", "g4"];
			var t = 0;
			for(var r = 0; r < 24; r++) {
				(function(note, off) {
					gFunTimers.push(setTimeout(function() { press(note, 0.85, true); }, off));
					gFunTimers.push(setTimeout(function() { release(note, true); }, off + 45));
				})(keys[r % keys.length], t);
				t += 55;
			}
		});
		$hacksPanel.on("click", "#fun-chord", function(e) {
			e.preventDefault();
			ensureAudioReady();
			["c4", "e4", "g4"].forEach(function(n) { press(n, 0.75, true); });
			gFunTimers.push(setTimeout(function() {
				["c4", "e4", "g4"].forEach(function(n) { release(n, true); });
			}, 600));
		});
		$hacksPanel.on("click", "#fun-random", function(e) {
			e.preventDefault();
			funStopAll();
			ensureAudioReady();
			var keys = Object.keys(gPiano.keys);
			var end = Date.now() + 3000;
			var iv = setInterval(function() {
				if(Date.now() > end) { clearInterval(iv); return; }
				var n = keys[Math.floor(Math.random() * keys.length)];
				press(n, Math.random() * 0.5 + 0.4, true);
				gFunTimers.push(setTimeout(function() { release(n, true); }, 200));
			}, 80);
			gChaosIv = iv;
		});
		$hacksPanel.on("click", "#fun-chaos", function(e) {
			e.preventDefault();
			if(gChaosIv) { funStopAll(); return; }
			ensureAudioReady();
			var keys = Object.keys(gPiano.keys);
			gChaosIv = setInterval(function() {
				for(var k = 0; k < 5; k++) {
					var n = keys[Math.floor(Math.random() * keys.length)];
					press(n, Math.random(), true);
					(function(note) {
						gFunTimers.push(setTimeout(function() { release(note, true); }, 150 + Math.random() * 200));
					})(n);
				}
			}, 120);
		});
		$hacksPanel.on("click", "#fun-sweep-up", function(e) {
			e.preventDefault();
			funStopAll();
			ensureAudioReady();
			var keys = Object.keys(gPiano.keys).sort();
			for(var i = 0; i < keys.length; i++) {
				(function(note, idx) {
					gFunTimers.push(setTimeout(function() { press(note, 0.55, true); }, idx * 40));
					gFunTimers.push(setTimeout(function() { release(note, true); }, idx * 40 + 120));
				})(keys[i], i);
			}
		});
		$hacksPanel.on("click", "#fun-sweep-down", function(e) {
			e.preventDefault();
			funStopAll();
			ensureAudioReady();
			var keys = Object.keys(gPiano.keys).sort().reverse();
			for(var i = 0; i < keys.length; i++) {
				(function(note, idx) {
					gFunTimers.push(setTimeout(function() { press(note, 0.55, true); }, idx * 40));
					gFunTimers.push(setTimeout(function() { release(note, true); }, idx * 40 + 120));
				})(keys[i], i);
			}
		});
		$hacksPanel.on("click", "#fun-chat-start", function(e) {
			e.preventDefault();
			startChatSpam();
		});
		$hacksPanel.on("click", "#fun-chat-stop", function(e) {
			e.preventDefault();
			stopChatSpam();
		});
		$hacksPanel.on("click", ".spam-preset", function(e) {
			e.preventDefault();
			$hacksPanel.find("input[name=spam-msg]").val($(this).data("msg") || "");
		});
		$hacksPanel.on("click", "#fun-fill-chat", function(e) {
			e.preventDefault();
			var msg = $hacksPanel.find("input[name=spam-msg]").val() || "🎹";
			$("#chat-input-bar input").val(msg.split("|")[0].trim()).focus();
		});
		$hacksPanel.on("click", "#fun-send-chat", function(e) {
			e.preventDefault();
			if(!requireChat()) return;
			chat.send(buildSpamMessage());
		});
		$hacksPanel.on("click", "#fun-chat-flood", function(e) {
			e.preventDefault();
			if(!requireChat()) return;
			var msgs = [
				"hello piano room", "anyone here?", "nice keys", "🎹", "lets jam",
				"wow", "again!", "music time", "tap tap", "one more song",
				"so chill", "vibes", "piano go brr", "ok", "gg"
			];
			for(var i = 0; i < msgs.length; i++) {
				(function(m, idx) {
					setTimeout(function() { chat.send(m); }, idx * 100);
				})(msgs[i], i);
			}
		});
		$hacksPanel.on("click", "#fun-chat-copypasta", function(e) {
			e.preventDefault();
			$hacksPanel.find("input[name=spam-msg]").val(
				"i came to play piano | stayed for the chat | left as a legend | " +
				"press all keys responsibly | this is a dummy spam message | " +
				"multipiano moment | keyboard warriors unite"
			);
			$hacksPanel.find("select[name=spam-mode]").val("rotate");
		});
		$hacksPanel.on("click", "#fun-stop-all", function(e) {
			e.preventDefault();
			funStopAll();
		});
		$hacksPanel.on("click", "#fun-arpeggio", function(e) {
			e.preventDefault();
			funStopAll();
			ensureAudioReady();
			var seq = ["c4", "e4", "g4", "c5", "g4", "e4", "c4"];
			for(var i = 0; i < seq.length; i++) {
				(function(note, idx) {
					gFunTimers.push(setTimeout(function() { press(note, 0.7, true); }, idx * 90));
					gFunTimers.push(setTimeout(function() { release(note, true); }, idx * 90 + 70));
				})(seq[i], i);
			}
		});
		$hacksPanel.on("click", "#fun-trill", function(e) {
			e.preventDefault();
			funStopAll();
			ensureAudioReady();
			var a = "c5", b = "cs5";
			for(var i = 0; i < 24; i++) {
				(function(note, idx) {
					gFunTimers.push(setTimeout(function() { press(note, 0.65, true); }, idx * 45));
					gFunTimers.push(setTimeout(function() { release(note, true); }, idx * 45 + 35));
				})(i % 2 ? b : a, i);
			}
		});
		$hacksPanel.on("click", "#fun-hammer", function(e) {
			e.preventDefault();
			funStopAll();
			ensureAudioReady();
			var keys = Object.keys(gPiano.keys);
			var end = Date.now() + 2500;
			var iv = setInterval(function() {
				if(Date.now() > end) { clearInterval(iv); return; }
				var n = keys[Math.floor(Math.random() * keys.length)];
				press(n, 1, true);
				gFunTimers.push(setTimeout(function() { release(n, true); }, 60));
			}, 50);
			gChaosIv = iv;
		});
		$hacksPanel.on("click", "#fun-low-boom", function(e) {
			e.preventDefault();
			funStopAll();
			ensureAudioReady();
			var keys = Object.keys(gPiano.keys).filter(function(k) {
				var o = parseInt(k.slice(-1), 10);
				return !isNaN(o) && o <= 3;
			});
			if(!keys.length) keys = ["c3", "g2", "c2"];
			keys.slice(0, 18).forEach(function(n) { press(n, 0.95, true); });
			gFunTimers.push(setTimeout(function() {
				keys.slice(0, 18).forEach(function(n) { release(n, true); });
			}, 500));
		});
		$hacksPanel.on("click", "#fun-high-tinkle", function(e) {
			e.preventDefault();
			funStopAll();
			ensureAudioReady();
			var keys = Object.keys(gPiano.keys).sort().slice(-20);
			for(var i = 0; i < keys.length; i++) {
				(function(note, idx) {
					gFunTimers.push(setTimeout(function() { press(note, 0.45, true); }, idx * 35));
					gFunTimers.push(setTimeout(function() { release(note, true); }, idx * 35 + 50));
				})(keys[i], i);
			}
		});
		$hacksPanel.on("click", "#fun-piano-spin", function(e) {
			e.preventDefault();
			$("#piano").toggleClass("spin");
		});
		$hacksPanel.on("click", "#fun-emoji-burst", function(e) {
			e.preventDefault();
			if(!requireChat()) return;
			var emojis = ["🎹", "🎵", "🎶", "🎼", "✨", "🔥", "💯", "🎉", "👏", "❤️", "🎤", "🌟"];
			for(var i = 0; i < emojis.length; i++) {
				(function(msg, idx) {
					setTimeout(function() { chat.send(msg); }, idx * 100);
				})(emojis[i], i);
			}
		});
		$hacksPanel.on("click", "#fun-g-major", function(e) {
			e.preventDefault();
			funPrep();
			funChord(["g4", "b4", "d5"], 0, 700, 0.8);
		});
		$hacksPanel.on("click", "#fun-a-minor", function(e) {
			e.preventDefault();
			funPrep();
			funChord(["a4", "c5", "e5"], 0, 700, 0.75);
		});
		$hacksPanel.on("click", "#fun-bounce", function(e) {
			e.preventDefault();
			funPrep();
			var pat = ["c4", "g4", "c5", "g4", "c4", "g4", "c5", "g4"];
			for(var i = 0; i < pat.length; i++) funNoteAt(pat[i], i * 70, 55, 0.85);
		});
		$hacksPanel.on("click", "#fun-waltz", function(e) {
			e.preventDefault();
			funPrep();
			var t = 0;
			for(var b = 0; b < 4; b++) {
				funNoteAt("c4", t, 200, 0.9);
				funNoteAt("e4", t + 220, 90, 0.5);
				funNoteAt("g4", t + 320, 90, 0.5);
				t += 450;
			}
		});
		$hacksPanel.on("click", "#fun-jazz", function(e) {
			e.preventDefault();
			funPrep();
			var stabs = [
				["c4", "e4", "g4", "as4"],
				["f4", "a4", "c5", "ds5"],
				["as3", "d4", "f4", "as4"]
			];
			for(var i = 0; i < stabs.length; i++) {
				(function(ch, idx) {
					for(var j = 0; j < ch.length; j++) {
						if(gPiano.keys[ch[j]]) funNoteAt(ch[j], idx * 280 + j * 5, 120, 0.7);
					}
				})(stabs[i], i);
			}
		});
		$hacksPanel.on("click", "#fun-ripple", function(e) {
			e.preventDefault();
			funPrep();
			var keys = pianoKeyList().sort();
			var mid = Math.floor(keys.length / 2);
			var step = 0;
			for(var r = 0; r < keys.length; r++) {
				if(mid - r >= 0) funNoteAt(keys[mid - r], step * 35, 70, 0.6);
				if(mid + r < keys.length && r > 0) funNoteAt(keys[mid + r], step * 35, 70, 0.6);
				step++;
			}
		});
		$hacksPanel.on("click", "#fun-zigzag", function(e) {
			e.preventDefault();
			funPrep();
			var keys = pianoKeyList().sort();
			var i = 0, dir = 1, pos = 0;
			while(i < 40 && pos >= 0 && pos < keys.length) {
				funNoteAt(keys[pos], i * 55, 45, 0.65);
				pos += dir * 3;
				if(pos >= keys.length) { dir = -1; pos = keys.length - 1; }
				if(pos < 0) { dir = 1; pos = 0; }
				i++;
			}
		});
		$hacksPanel.on("click", "#fun-staccato", function(e) {
			e.preventDefault();
			funPrep();
			var keys = pianoKeyList().sort();
			for(var i = 0; i < keys.length; i++) funNoteAt(keys[i], i * 28, 35, 0.75);
		});
		$hacksPanel.on("click", "#fun-echo", function(e) {
			e.preventDefault();
			funPrep();
			var n = "c5";
			for(var i = 0; i < 8; i++) funNoteAt(n, i * 200, 100, Math.max(0.3, 0.9 - i * 0.08));
		});
		$hacksPanel.on("click", "#fun-black-keys", function(e) {
			e.preventDefault();
			funPrep();
			var keys = sharpKeyList();
			for(var i = 0; i < keys.length; i++) funNoteAt(keys[i], i * 45, 80, 0.7);
		});
		$hacksPanel.on("click", "#fun-white-keys", function(e) {
			e.preventDefault();
			funPrep();
			var keys = whiteKeyList().sort();
			for(var i = 0; i < keys.length; i++) funNoteAt(keys[i], i * 32, 70, 0.65);
		});
		$hacksPanel.on("click", "#fun-rain", function(e) {
			e.preventDefault();
			funPrep();
			var keys = pianoKeyList().sort().slice(-24);
			for(var i = 0; i < 30; i++) {
				(function(idx) {
					var n = keys[Math.floor(Math.random() * keys.length)];
					funNoteAt(n, idx * 60 + Math.random() * 40, 50, 0.35 + Math.random() * 0.3);
				})(i);
			}
		});
		$hacksPanel.on("click", "#fun-heartbeat", function(e) {
			e.preventDefault();
			funPrep();
			for(var b = 0; b < 6; b++) {
				var t = b * 420;
				funNoteAt("c3", t, 90, 0.95);
				funNoteAt("c3", t + 110, 70, 0.85);
			}
		});
		$hacksPanel.on("click", "#fun-sustain-hold", function(e) {
			e.preventDefault();
			funPrep();
			pressSustain();
			funChord(["c4", "e4", "g4", "c5"], 0, 1200, 0.8);
			gFunTimers.push(setTimeout(function() { releaseSustain(); }, 1400));
		});
		$hacksPanel.on("mousedown click", "input, select", function(e) {
			e.stopPropagation();
		});

		bindFunPlays(FUN_PIANO_PLAY_EXTRA);
	}

	initSheetAndFunControls();

	var devices_json = "[]";
	function sendDevices() {
		gClient.sendArray([{"m": "devices", "list": JSON.parse(devices_json)}]);
	}
	gClient.on("connect", sendDevices);

	(function() {

		if (navigator.requestMIDIAccess) {
			navigator.requestMIDIAccess().then(
				function(midi) {
					console.log(midi);
					function midimessagehandler(evt) {
						if(!evt.target.enabled) return;
						//console.log(evt);
						var channel = evt.data[0] & 0xf;
						var cmd = evt.data[0] >> 4;
						var note_number = evt.data[1];
						var vel = evt.data[2];
						//console.log(channel, cmd, note_number, vel);
						if(cmd == 8 || (cmd == 9 && vel == 0)) {
							// NOTE_OFF
							release(MIDI_KEY_NAMES[note_number - 9 + MIDI_TRANSPOSE]);
						} else if(cmd == 9) {
							// NOTE_ON
							if(evt.target.volume !== undefined)
								vel *= evt.target.volume;
							press(MIDI_KEY_NAMES[note_number - 9 + MIDI_TRANSPOSE], vel / 100);
						} else if(cmd == 11) {
							// CONTROL_CHANGE
							if(!gAutoSustain) {
								if(note_number == 64) {
									if(vel > 0) {
										pressSustain();
									} else {
										releaseSustain();
									}
								}
							}
						}
					}

					function deviceInfo(dev) {
						return {
							type: dev.type,
							//id: dev.id,
							manufacturer: dev.manufacturer,
							name: dev.name,
							version: dev.version,
							//connection: dev.connection,
							//state: dev.state,
							enabled: dev.enabled,
							volume: dev.volume
						};
					}

					function updateDevices() {
						var list = [];
						if(midi.inputs.size > 0) {
							var inputs = midi.inputs.values();
							for(var input_it = inputs.next(); input_it && !input_it.done; input_it = inputs.next()) {
								var input = input_it.value;
								list.push(deviceInfo(input));
							}
						}
						if(midi.outputs.size > 0) {
							var outputs = midi.outputs.values();
							for(var output_it = outputs.next(); output_it && !output_it.done; output_it = outputs.next()) {
								var output = output_it.value;
								list.push(deviceInfo(output));
							}
						}
						var new_json = JSON.stringify(list);
						if(new_json !== devices_json) {
							devices_json = new_json;
							sendDevices();
						}
					}

					function plug() {
						if(midi.inputs.size > 0) {
							var inputs = midi.inputs.values();
							for(var input_it = inputs.next(); input_it && !input_it.done; input_it = inputs.next()) {
								var input = input_it.value;
								//input.removeEventListener("midimessage", midimessagehandler);
								//input.addEventListener("midimessage", midimessagehandler);
								input.onmidimessage = midimessagehandler;
								if(input.enabled !== false) {
									input.enabled = true;
								}
								if(typeof input.volume === "undefined") {
									input.volume = 1.0;
								}
								console.log("input", input);
							}
						}
						if(midi.outputs.size > 0) {
							var outputs = midi.outputs.values();
							for(var output_it = outputs.next(); output_it && !output_it.done; output_it = outputs.next()) {
								var output = output_it.value;
								//output.enabled = false; // edit: don't touch
								if(typeof output.volume === "undefined") {
									output.volume = 1.0;
								}
								console.log("output", output);
							}
							gMidiOutTest = function(note_name, vel, delay_ms) {
								var note_number = MIDI_KEY_NAMES.indexOf(note_name);
								if(note_number == -1) return;
								note_number = note_number + 9 - MIDI_TRANSPOSE;

								var outputs = midi.outputs.values();
								for(var output_it = outputs.next(); output_it && !output_it.done; output_it = outputs.next()) {
									var output = output_it.value;
									if(output.enabled) {
										var v = vel;
										if(output.volume !== undefined)
											v *= output.volume;
										output.send([0x90, note_number, v], window.performance.now() + delay_ms);
									}
								}
							}
						}
						showConnections(false);
						updateDevices();
					}

					midi.addEventListener("statechange", function(evt) {
						if(evt instanceof MIDIConnectionEvent) {
							plug();
						}
					});

					plug();


					var connectionsNotification;

					function showConnections(sticky) {
						//if(document.getElementById("Notification-MIDI-Connections"))
							//sticky = 1; // todo: instead, 
						var inputs_ul = document.createElement("ul");
						if(midi.inputs.size > 0) {
							var inputs = midi.inputs.values();
							for(var input_it = inputs.next(); input_it && !input_it.done; input_it = inputs.next()) {
								var input = input_it.value;
								var li = document.createElement("li");
								li.connectionId = input.id;
								li.classList.add("connection");
								if(input.enabled) li.classList.add("enabled");
								li.textContent = input.name;
								li.addEventListener("click", function(evt) {
									var inputs = midi.inputs.values();
									for(var input_it = inputs.next(); input_it && !input_it.done; input_it = inputs.next()) {
										var input = input_it.value;
										if(input.id === evt.target.connectionId) {
											input.enabled = !input.enabled;
											evt.target.classList.toggle("enabled");
											console.log("click", input);
											updateDevices();
											return;
										}
									}
								});
								if(gMidiVolumeTest) {
									var knob = document.createElement("canvas");
									mixin(knob, {width: 16 * window.devicePixelRatio, height: 16 * window.devicePixelRatio, className: "knob"});
									li.appendChild(knob);
									knob = new Knob(knob, 0, 2, 0.01, input.volume, "volume");
									knob.canvas.style.width = "16px";
									knob.canvas.style.height = "16px";
									knob.canvas.style.float = "right";
									knob.on("change", function(k) {
										input.volume = k.value;
									});
									knob.emit("change", knob);
								}
								inputs_ul.appendChild(li);
							}
						} else {
							inputs_ul.textContent = "(none)";
						}
						var outputs_ul = document.createElement("ul");
						if(midi.outputs.size > 0) {
							var outputs = midi.outputs.values();
							for(var output_it = outputs.next(); output_it && !output_it.done; output_it = outputs.next()) {
								var output = output_it.value;
								var li = document.createElement("li");
								li.connectionId = output.id;
								li.classList.add("connection");
								if(output.enabled) li.classList.add("enabled");
								li.textContent = output.name;
								li.addEventListener("click", function(evt) {
									var outputs = midi.outputs.values();
									for(var output_it = outputs.next(); output_it && !output_it.done; output_it = outputs.next()) {
										var output = output_it.value;
										if(output.id === evt.target.connectionId) {
											output.enabled = !output.enabled;
											evt.target.classList.toggle("enabled");
											console.log("click", output);
											updateDevices();
											return;
										}
									}
								});
								if(gMidiVolumeTest) {
									var knob = document.createElement("canvas");
									mixin(knob, {width: 16 * window.devicePixelRatio, height: 16 * window.devicePixelRatio, className: "knob"});
									li.appendChild(knob);
									knob = new Knob(knob, 0, 2, 0.01, output.volume, "volume");
									knob.canvas.style.width = "16px";
									knob.canvas.style.height = "16px";
									knob.canvas.style.float = "right";
									knob.on("change", function(k) {
										output.volume = k.value;
									});
									knob.emit("change", knob);
								}
								outputs_ul.appendChild(li);
							}
						} else {
							outputs_ul.textContent = "(none)";
						}
						var div = document.createElement("div");
						var h1 = document.createElement("h1");
						h1.textContent = "Inputs";
						div.appendChild(h1);
						div.appendChild(inputs_ul);
						h1 = document.createElement("h1");
						h1.textContent = "Outputs";
						div.appendChild(h1);
						div.appendChild(outputs_ul);
						connectionsNotification = new Notification({"id":"MIDI-Connections", "title":"MIDI Connections","duration":sticky?"-1":"4500","html":div,"target":"#midi-btn"});
					}

					document.getElementById("midi-btn").addEventListener("click", function(evt) {
						if(!document.getElementById("Notification-MIDI-Connections"))
							showConnections(true);
						else {
							connectionsNotification.close();
						}
					});
				},
				function(err){
					console.log(err);
				} );
		}
	})();














// bug supply

////////////////////////////////////////////////////////////////
	
	window.onerror = function(message, url, line) {
		var url = url || "(no url)";
		var line = line || "(no line)";
		// errors in socket.io
		if(url.indexOf("socket.io.js") !== -1) {
			if(message.indexOf("INVALID_STATE_ERR") !== -1) return;
			if(message.indexOf("InvalidStateError") !== -1) return;
			if(message.indexOf("DOM Exception 11") !== -1) return;
			if(message.indexOf("Property 'open' of object #<c> is not a function") !== -1) return;
			if(message.indexOf("Cannot call method 'close' of undefined") !== -1) return;
			if(message.indexOf("Cannot call method 'close' of null") !== -1) return;
			if(message.indexOf("Cannot call method 'onClose' of null") !== -1) return;
			if(message.indexOf("Cannot call method 'payload' of null") !== -1) return;
			if(message.indexOf("Unable to get value of the property 'close'") !== -1) return;
			if(message.indexOf("NS_ERROR_NOT_CONNECTED") !== -1) return;
			if(message.indexOf("Unable to get property 'close' of undefined or null reference") !== -1) return;
			if(message.indexOf("Unable to get value of the property 'close': object is null or undefined") !== -1) return;
			if(message.indexOf("this.transport is null") !== -1) return;
		}
		// errors in soundmanager2
		if(url.indexOf("soundmanager2.js") !== -1) {
			// operation disabled in safe mode?
			if(message.indexOf("Could not complete the operation due to error c00d36ef") !== -1) return;
			if(message.indexOf("_s.o._setVolume is not a function") !== -1) return;
		}
		// errors in midibridge
		if(url.indexOf("midibridge") !== -1) {
			if(message.indexOf("Error calling method on NPObject") !== -1) return;
		}
		// too many failing extensions injected in my html
		if(url.indexOf(".js") !== url.length - 3) return;
		// extensions inject cross-domain embeds too
		if(url.toLowerCase().indexOf("multiplayerpiano.com") == -1) return;

		// errors in my code
		if(url.indexOf("script.js") !== -1) {
			if(message.indexOf("Object [object Object] has no method 'on'") !== -1) return;
			if(message.indexOf("Object [object Object] has no method 'off'") !== -1) return;
			if(message.indexOf("Property '$' of object [object Object] is not a function") !== -1) return;
		}

		var enc = "/bugreport/"
			+ (message ? encodeURIComponent(message) : "") + "/"
			+ (url ? encodeURIComponent(url) : "") + "/"
			+ (line ? encodeURIComponent(line) : "");
		var img = new Image();
		img.src = enc;
	};









	// API
	window.MPP = {
		press: press,
		release: release,
		pressSustain: pressSustain,
		releaseSustain: releaseSustain,
		piano: gPiano,
		client: gClient,
		chat: chat,
		noteQuota: gNoteQuota,
		soundSelector: gSoundSelector,
		sheetPlayer: gSheetPlayer,
		roomMedia: gRoomMedia,
		blobFriend: gBlobFriend,
		desktopDoodler: gDesktopDoodler,
		Notification: Notification
	};










	// record mp3
	(function() {
		var button = document.querySelector("#record-btn");
		var audio = MPP.piano.audio;
		var context = audio.context;
		var encoder_sample_rate = 44100;
		var encoder_kbps = 128;
		var encoder = null;
		var scriptProcessorNode = context.createScriptProcessor(4096, 2, 2);
		var recording = false;
		var recording_start_time = 0;
		var mp3_buffer = [];
		button.addEventListener("click", function(evt) {
			if(!recording) {
				// start recording
				mp3_buffer = [];
				encoder = new lamejs.Mp3Encoder(2, encoder_sample_rate, encoder_kbps);
				scriptProcessorNode.onaudioprocess = onAudioProcess;
				audio.masterGain.connect(scriptProcessorNode);
				scriptProcessorNode.connect(context.destination);
				recording_start_time = Date.now();
				recording = true;
				button.textContent = "Stop Recording";
				button.classList.add("stuck");
				new Notification({"id": "mp3", "title": "Recording MP3...", "html": "It's recording now.  This could make things slow, maybe.  Maybe give it a moment to settle before playing.<br><br>This feature is experimental.<br>Send complaints to <a href=\"mailto:multiplayerpiano.com@gmail.com\">multiplayerpiano.com@gmail.com</a>.", "duration": 10000});
			} else {
				// stop recording
				var mp3buf = encoder.flush();
				mp3_buffer.push(mp3buf);
				var blob = new Blob(mp3_buffer, {type: "audio/mp3"});
				var url = URL.createObjectURL(blob);
				scriptProcessorNode.onaudioprocess = null;
				audio.masterGain.disconnect(scriptProcessorNode);
				scriptProcessorNode.disconnect(context.destination);
				recording = false;
				button.textContent = "Record MP3";
				button.classList.remove("stuck");
				new Notification({"id": "mp3", "title": "MP3 recording finished", "html": "<a href=\""+url+"\" target=\"blank\">And here it is!</a> (open or save as)<br><br>This feature is experimental.<br>Send complaints to <a href=\"mailto:multiplayerpiano.com@gmail.com\">multiplayerpiano.com@gmail.com</a>.", "duration": 0});
			}
		});
		function onAudioProcess(evt) {
			var inputL = evt.inputBuffer.getChannelData(0);
			var inputR = evt.inputBuffer.getChannelData(1);
			var mp3buf = encoder.encodeBuffer(convert16(inputL), convert16(inputR));
			mp3_buffer.push(mp3buf);
		}
		function convert16(samples) {
			var len = samples.length;
			var result = new Int16Array(len);
			for(var i = 0; i < len; i++) {
				result[i] = 0x8000 * samples[i];
			}
			return(result);
		}
	})();







	// synth
	var enableSynth = false;
	var audio = gPiano.audio;
	var context = gPiano.audio.context;
	var synth_gain = context.createGain();
	synth_gain.gain.value = 0.05;
	synth_gain.connect(audio.synthGain);

	var osc_types = ["sine", "square", "sawtooth", "triangle"];
	var osc_type_index = 1;

	var osc1_type = "square";
	var osc1_attack = 0;
	var osc1_decay = 0.2;
	var osc1_sustain = 0.5;
	var osc1_release = 2.0;

	function synthVoice(note_name, time) {
		var note_number = MIDI_KEY_NAMES.indexOf(note_name);
		note_number = note_number + 9 - MIDI_TRANSPOSE;
		var freq = Math.pow(2, (note_number - 69) / 12) * 440.0;
		this.osc = context.createOscillator();
		this.osc.type = osc1_type;
		this.osc.frequency.value = freq;
		this.gain = context.createGain();
		this.gain.gain.value = 0;
		this.osc.connect(this.gain);
		this.gain.connect(synth_gain);
		this.osc.start(time);
		this.gain.gain.setValueAtTime(0, time);
		this.gain.gain.linearRampToValueAtTime(1, time + osc1_attack);
		this.gain.gain.linearRampToValueAtTime(osc1_sustain, time + osc1_attack + osc1_decay);
	}

	synthVoice.prototype.stop = function(time) {
		//this.gain.gain.setValueAtTime(osc1_sustain, time);
		this.gain.gain.linearRampToValueAtTime(0, time + osc1_release);
		this.osc.stop(time + osc1_release);
	};

	(function() {
		var button = document.getElementById("synth-btn");
		var notification;

		button.addEventListener("click", function() {
			if(notification) {
				notification.close();
			} else {
				showSynth();
			}
		});

		function showSynth() {

			var html = document.createElement("div");

			// on/off button
			(function() {
				var button = document.createElement("input");
				mixin(button, {type: "button", value: "ON/OFF", className: enableSynth ? "switched-on" : "switched-off"});
				button.addEventListener("click", function(evt) {
					enableSynth = !enableSynth;
					button.className = enableSynth ? "switched-on" : "switched-off";
					if(!enableSynth) {
						// stop all
						for(var i in audio.playings) {
							if(!audio.playings.hasOwnProperty(i)) continue;
							var playing = audio.playings[i];
							if(playing && playing.voice) {
								playing.voice.osc.stop();
								playing.voice = undefined;
							}
						}
					}
				});
				html.appendChild(button);
			})();

			// mix
			var knob = document.createElement("canvas");
			mixin(knob, {width: 32 * window.devicePixelRatio, height: 32 * window.devicePixelRatio, className: "knob"});
			html.appendChild(knob);
			knob = new Knob(knob, 0, 100, 0.1, 50, "mix", "%");
			knob.canvas.style.width = "32px";
			knob.canvas.style.height = "32px";
			knob.on("change", function(k) {
				var mix = k.value / 100;
				audio.pianoGain.gain.value = 1 - mix;
				audio.synthGain.gain.value = mix;
			});
			knob.emit("change", knob);

			// osc1 type
			(function() {
				osc1_type = osc_types[osc_type_index];
				var button = document.createElement("input");
				mixin(button, {type: "button", value: osc_types[osc_type_index]});
				button.addEventListener("click", function(evt) {
					if(++osc_type_index >= osc_types.length) osc_type_index = 0;
					osc1_type = osc_types[osc_type_index];
					button.value = osc1_type;
				});
				html.appendChild(button);
			})();

			// osc1 attack
			var knob = document.createElement("canvas");
			mixin(knob, {width: 32 * window.devicePixelRatio, height: 32 * window.devicePixelRatio, className: "knob"});
			html.appendChild(knob);
			knob = new Knob(knob, 0, 1, 0.001, osc1_attack, "osc1 attack", "s");
			knob.canvas.style.width = "32px";
			knob.canvas.style.height = "32px";
			knob.on("change", function(k) {
				osc1_attack = k.value;
			});
			knob.emit("change", knob);

			// osc1 decay
			var knob = document.createElement("canvas");
			mixin(knob, {width: 32 * window.devicePixelRatio, height: 32 * window.devicePixelRatio, className: "knob"});
			html.appendChild(knob);
			knob = new Knob(knob, 0, 2, 0.001, osc1_decay, "osc1 decay", "s");
			knob.canvas.style.width = "32px";
			knob.canvas.style.height = "32px";
			knob.on("change", function(k) {
				osc1_decay = k.value;
			});
			knob.emit("change", knob);

			var knob = document.createElement("canvas");
			mixin(knob, {width: 32 * window.devicePixelRatio, height: 32 * window.devicePixelRatio, className: "knob"});
			html.appendChild(knob);
			knob = new Knob(knob, 0, 1, 0.001, osc1_sustain, "osc1 sustain", "x");
			knob.canvas.style.width = "32px";
			knob.canvas.style.height = "32px";
			knob.on("change", function(k) {
				osc1_sustain = k.value;
			});
			knob.emit("change", knob);

			// osc1 release
			var knob = document.createElement("canvas");
			mixin(knob, {width: 32 * window.devicePixelRatio, height: 32 * window.devicePixelRatio, className: "knob"});
			html.appendChild(knob);
			knob = new Knob(knob, 0, 2, 0.001, osc1_release, "osc1 release", "s");
			knob.canvas.style.width = "32px";
			knob.canvas.style.height = "32px";
			knob.on("change", function(k) {
				osc1_release = k.value;
			});
			knob.emit("change", knob);



			var div = document.createElement("div");
			div.innerHTML = "<br><br><br><br><center>this space intentionally left blank</center><br><br><br><br>";
			html.appendChild(div);

			

			// notification
			notification = new Notification({title: "Synthesize", html: html, duration: -1, target: "#synth-btn"});
			notification.on("close", function() {
				var tip = document.getElementById("tooltip");
				if(tip) tip.parentNode.removeChild(tip);
				notification = null;
			});
		}
	})();




	







	


});



















// misc

////////////////////////////////////////////////////////////////

// analytics	
window.google_analytics_uacct = "UA-882009-7";
var _gaq = _gaq || [];
_gaq.push(['_setAccount', 'UA-882009-7']);
_gaq.push(['_trackPageview']);
_gaq.push(['_setAllowAnchor', true]);
(function() {
	var ga = document.createElement('script'); ga.type = 'text/javascript'; ga.async = true;
	ga.src = ('https:' == document.location.protocol ? 'https://ssl' : 'http://www') + '.google-analytics.com/ga.js';
	var s = document.getElementsByTagName('script')[0]; s.parentNode.insertBefore(ga, s);
})();

// twitter
!function(d,s,id){var js,fjs=d.getElementsByTagName(s)[0];if(!d.getElementById(id)){js=d.createElement(s);js.id=id;
	js.src="//platform.twitter.com/widgets.js";fjs.parentNode.insertBefore(js,fjs);}}(document,"script","twitter-wjs");

// fb (social widget — skip when #dontshow)
if (!window.gDontShow) {
(function(d, s, id) {
  var js, fjs = d.getElementsByTagName(s)[0];
  if (d.getElementById(id)) return;
  js = d.createElement(s); js.id = id;
  js.src = "//connect.facebook.net/en_US/sdk.js#xfbml=1&version=v2.8";
  fjs.parentNode.insertBefore(js, fjs);
}(document, 'script', 'facebook-jssdk'));
}

// non-ad-free experience
/*(function() {
	function adsOn() {
		if(window.localStorage) {
			var div = document.querySelector("#inclinations");
			div.innerHTML = "Ads:<br>ON / <a id=\"adsoff\" href=\"#\">OFF</a>";
			div.querySelector("#adsoff").addEventListener("click", adsOff);
			localStorage.ads = true;
		}
		// adsterra
		var script = document.createElement("script");
		script.src = "//pl132070.puhtml.com/68/7a/97/687a978dd26d579c788cb41e352f5a41.js";
		document.head.appendChild(script);
	}

	function adsOff() {
		if(window.localStorage) localStorage.ads = false;
		document.location.reload(true);
	}

	function noAds() {
		var div = document.querySelector("#inclinations");
		div.innerHTML = "Ads:<br><a id=\"adson\" href=\"#\">ON</a> / OFF";
		div.querySelector("#adson").addEventListener("click", adsOn);
	}

	if(window.localStorage) {
		if(localStorage.ads === undefined || localStorage.ads === "true")
			adsOn();
		else
			noAds();
	} else {
		adsOn();
	}
})();*/
