/**
 * Room themes — prebuilt background combos (gradient + bottom bar color +
 * animated overlay + canvas particle effect) that the room owner picks in
 * Room Settings. The choice is stored in channel settings as `theme`, so the
 * server broadcasts it and every user in the room sees the same theme.
 *
 * API (used by script.js):
 *   RoomThemes.list            — array of theme definitions
 *   RoomThemes.has(id)         — true for a real theme (not "classic")
 *   RoomThemes.apply(id)       — show a theme; null/"classic" clears it
 *   RoomThemes.buildPicker(el, selectedId, onPick)
 */
(function (global) {
	"use strict";

	var TAU = Math.PI * 2;
	function rand(a, b) { return a + Math.random() * (b - a); }
	function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }

	// ── Theme definitions ───────────────────────────────────────────────
	// bg: body background, bottom: toolbar color, overlay: CSS class for the
	// animated layer (screen.css), fx: canvas effect name + options.
	var THEMES = [
		{ id: "classic", name: "Classic", icon: "🎨", desc: "Use the room color",
			bg: "radial-gradient(ellipse at center, #3b5054 0%, #001014 100%)" },
		{ id: "winter", name: "Winter Snow", icon: "❄️", desc: "Soft snowfall on a frosty night",
			bg: "radial-gradient(ellipse at top, #46689a 0%, #1b2a47 55%, #0b1324 100%)",
			bottom: "#22324f", overlay: "winter", fx: "snow" },
		{ id: "starry", name: "Starry Night", icon: "🌌", desc: "Twinkling stars and shooting stars",
			bg: "radial-gradient(ellipse at bottom, #1f3070 0%, #0b1030 60%, #04050f 100%)",
			bottom: "#0e1430", fx: "stars", fxOpts: { shooting: true } },
		{ id: "aurora", name: "Northern Lights", icon: "🌠", desc: "Dancing aurora over a quiet sky",
			bg: "linear-gradient(180deg, #020b14 0%, #06242c 55%, #0b3a3a 100%)",
			bottom: "#062a2e", overlay: "aurora", fx: "stars", fxOpts: { density: 0.5 } },
		{ id: "sakura", name: "Cherry Blossom", icon: "🌸", desc: "Petals drifting on a spring breeze",
			bg: "linear-gradient(160deg, #4f2453 0%, #9a4775 50%, #d27396 100%)",
			bottom: "#5e2a58", overlay: "sakura", fx: "petals" },
		{ id: "autumn", name: "Autumn Leaves", icon: "🍂", desc: "Warm leaves tumbling down",
			bg: "linear-gradient(170deg, #3d1f0f 0%, #7a3412 50%, #b75a1a 100%)",
			bottom: "#4d2410", fx: "leaves" },
		{ id: "ocean", name: "Deep Ocean", icon: "🫧", desc: "Sun rays and rising bubbles",
			bg: "linear-gradient(180deg, #0a6c8f 0%, #06405f 45%, #021a2e 100%)",
			bottom: "#03263d", overlay: "ocean", fx: "bubbles" },
		{ id: "forest", name: "Firefly Forest", icon: "✨", desc: "Glowing fireflies in the dark woods",
			bg: "radial-gradient(ellipse at bottom, #1e4d2b 0%, #0c2616 55%, #040d07 100%)",
			bottom: "#0b2414", overlay: "forest", fx: "fireflies" },
		{ id: "rain", name: "Rainy Night", icon: "🌧️", desc: "Cozy rain with drifting fog",
			bg: "linear-gradient(180deg, #2c3e50 0%, #1c2833 60%, #0f161d 100%)",
			bottom: "#1a242e", overlay: "rain", fx: "rain" },
		{ id: "synthwave", name: "Synthwave", icon: "🌆", desc: "Retro neon sun and endless grid",
			bg: "linear-gradient(180deg, #12022a 0%, #3b0a5c 35%, #8a1f6e 62%, #14022c 62%, #0a0118 100%)",
			bottom: "#1a0533", overlay: "synthwave", fx: "grid" },
		{ id: "campfire", name: "Campfire", icon: "🔥", desc: "Flickering glow and rising embers",
			bg: "radial-gradient(ellipse at bottom, #7a2a0a 0%, #3a1206 45%, #120503 100%)",
			bottom: "#2a0e05", overlay: "campfire", fx: "embers" },
		{ id: "love", name: "Love Bloom", icon: "💖", desc: "Floating hearts all around",
			bg: "linear-gradient(160deg, #4a0d2e 0%, #9e1f4f 50%, #d33f72 100%)",
			bottom: "#5c1236", fx: "hearts" },
		{ id: "party", name: "Confetti Party", icon: "🎉", desc: "Colorful confetti celebration",
			bg: "linear-gradient(135deg, #3a1c71 0%, #b8577a 55%, #e8915e 100%)",
			bottom: "#3a1c71", overlay: "party", fx: "confetti" },
		{ id: "matrix", name: "Digital Rain", icon: "💻", desc: "Falling green code",
			bg: "radial-gradient(ellipse at center, #062b12 0%, #021208 60%, #000000 100%)",
			bottom: "#031a0b", fx: "matrix" },
		{ id: "galaxy", name: "Cosmic Galaxy", icon: "🪐", desc: "Drifting nebula and deep space",
			bg: "radial-gradient(ellipse at 30% 20%, #3b1f6e 0%, #150b33 45%, #05020f 100%)",
			bottom: "#120a2a", overlay: "galaxy", fx: "stars", fxOpts: { density: 1.4, drift: 6 } },
		{ id: "fairy", name: "Fairy Dust", icon: "🧚", desc: "Magical sparkles floating up",
			bg: "linear-gradient(170deg, #241a52 0%, #503581 50%, #8a5fb3 100%)",
			bottom: "#33246a", overlay: "fairy", fx: "sparkles" },

		// Interactive: these react to your mouse/finger and to everyone's cursor in the room.
		{ id: "web", name: "Constellation Web", icon: "🕸️", interactive: true,
			desc: "Dots trail your cursor, link up and fade away",
			bg: "radial-gradient(ellipse at center, #16294a 0%, #0a1226 60%, #050812 100%)",
			bottom: "#0b1428", fx: "web" },
		{ id: "ribbon", name: "Neon Ribbons", icon: "🖌️", interactive: true,
			desc: "Paint glowing rainbow ribbons as you move",
			bg: "radial-gradient(ellipse at center, #1d0b3d 0%, #0d0221 65%, #05010f 100%)",
			bottom: "#12062a", fx: "ribbon" },
		{ id: "swarm", name: "Magnetic Swarm", icon: "🧲", interactive: true,
			desc: "A glowing swarm chases every cursor — click to scatter it",
			bg: "radial-gradient(ellipse at center, #0b2a33 0%, #06161c 60%, #020809 100%)",
			bottom: "#08202a", fx: "swarm" },
		{ id: "dots", name: "Ripple Dots", icon: "🔘", interactive: true,
			desc: "A field of dots that push away from you — click for ripples",
			bg: "linear-gradient(180deg, #1a1033 0%, #120a26 55%, #0b0618 100%)",
			bottom: "#140c28", fx: "dots" },
		{ id: "vortex", name: "Cosmic Vortex", icon: "🌀", interactive: true,
			desc: "Flowing stardust that swirls around cursors",
			bg: "radial-gradient(ellipse at center, #0e2c30 0%, #061518 60%, #020708 100%)",
			bottom: "#071a1d", fx: "vortex" }
	];
	var BY_ID = {};
	THEMES.forEach(function (t) { BY_ID[t.id] = t; });

	// ── Cached glow sprites (cheaper than a radial gradient per particle) ─
	var glowCache = {};
	function glow(color) {
		if (glowCache[color]) return glowCache[color];
		var s = 64, cv = document.createElement("canvas");
		cv.width = cv.height = s;
		var g = cv.getContext("2d"), grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
		grd.addColorStop(0, color);
		grd.addColorStop(0.25, color);
		grd.addColorStop(1, "rgba(0,0,0,0)");
		g.fillStyle = grd;
		g.fillRect(0, 0, s, s);
		return (glowCache[color] = cv);
	}

	function heartPath(c, s) {
		var r = s * 0.3;
		c.beginPath();
		c.moveTo(0, r * 2.4);
		c.quadraticCurveTo(-r * 2, r * 1.1, -r * 2, 0);
		c.arc(-r, 0, r, Math.PI, 0);
		c.arc(r, 0, r, Math.PI, 0);
		c.quadraticCurveTo(r * 2, r * 1.1, 0, r * 2.4);
		c.closePath();
	}

	// ── Pointers for interactive effects ────────────────────────────────
	// The local mouse/finger plus other users' cursors (from "m" messages),
	// so everyone's movement shows up in the room's background.
	var ptr = { id: "me", x: 0, y: 0, t: 0, inside: false };
	var remotes = {};          // participant id -> { id, x, y, t }
	var clickQueue = [];       // pointerdowns not yet seen by the effect
	var livePtrs = [], clicks = [];   // snapshot for the current frame

	function now() { return global.performance ? performance.now() : Date.now(); }

	function trackPointer() {
		function move(e) {
			ptr.x = e.clientX; ptr.y = e.clientY; ptr.t = now(); ptr.inside = true;
		}
		global.addEventListener("pointermove", move, { passive: true });
		global.addEventListener("pointerdown", function (e) {
			move(e);
			if (fx && fx.pointer) {
				clickQueue.push({ x: e.clientX, y: e.clientY });
				if (clickQueue.length > 8) clickQueue.shift();
			}
		}, { passive: true });
		global.addEventListener("pointerup", function (e) {
			if (e.pointerType === "touch") ptr.inside = false;   // finger lifted
		}, { passive: true });
		document.addEventListener("mouseout", function (e) {
			if (!e.relatedTarget) ptr.inside = false;          // left the window
		});
	}

	var hookedClient = null;
	function hookClient() {
		var cl = global.gClient;
		if (!cl || !cl.on || hookedClient === cl) return;
		hookedClient = cl;
		cl.on("m", function (msg) {
			if (!fx || !fx.pointer || !msg || msg.id === cl.participantId) return;
			var x = parseFloat(msg.x), y = parseFloat(msg.y);
			if (!isFinite(x) || !isFinite(y)) return;
			var r = remotes[msg.id] || (remotes[msg.id] = { id: msg.id });
			r.x = x * W / 100; r.y = y * H / 100; r.t = now();
		});
		cl.on("participant removed", function (p) { if (p) delete remotes[p.id]; });
	}

	function collectPointers() {
		var out = [], tnow = now();
		if (ptr.inside && ptr.t) out.push(ptr);
		for (var id in remotes) {
			var r = remotes[id];
			if (tnow - r.t < 30000) out.push(r);
			else delete remotes[id];
		}
		return out;
	}

	// An invisible "pen" that wanders on a Lissajous path, so interactive
	// themes still look alive when nobody is moving.
	function ghostPointer(t, w, h) {
		return { id: "ghost", x: w / 2 + Math.sin(t * 0.47) * w * 0.33, y: h / 2 + Math.sin(t * 0.71 + 1) * h * 0.28 };
	}

	function nearest(list, x, y) {
		var best = null, bd = Infinity;
		for (var i = 0; i < list.length; i++) {
			var dx = list[i].x - x, dy = list[i].y - y, d = dx * dx + dy * dy;
			if (d < bd) { bd = d; best = list[i]; }
		}
		return best;
	}

	// Calls fn at evenly spaced points along each pointer's path since the
	// previous frame, so fast moves still leave a continuous trail.
	function eachMove(S, list, step, fn) {
		var last = S.lastPos || (S.lastPos = {}), seen = {};
		for (var i = 0; i < list.length; i++) {
			var p = list[i], L = last[p.id];
			seen[p.id] = 1;
			if (!L) { last[p.id] = { x: p.x, y: p.y }; continue; }
			var dx = p.x - L.x, dy = p.y - L.y, d = Math.sqrt(dx * dx + dy * dy);
			if (d < step) continue;
			if (d > 700) { L.x = p.x; L.y = p.y; continue; }   // teleport, not a stroke
			var n = Math.min(10, Math.floor(d / step));
			for (var k = 1; k <= n; k++) fn(L.x + dx * k / n, L.y + dy * k / n, dx / d, dy / d, p);
			L.x = p.x; L.y = p.y;
		}
		for (var id in last) if (!seen[id]) delete last[id];
	}

	function scaledCount(base) {
		var n = base * Math.min(1.6, (W * H) / (1920 * 1080));
		if (isSmallScreen()) n *= 0.6;
		return Math.max(8, Math.round(n));
	}

	// ── Canvas effects ──────────────────────────────────────────────────
	// density = particle count at 1920×1080. init(p, w, h, first) sets up a
	// particle (first = spread over the screen on start); update returns
	// false when the particle should respawn. frame() draws non-particle
	// extras; trail fades the previous frame instead of clearing it.
	var FX = {
		snow: {
			density: 160,
			init: function (p, w, h, first) {
				p.r = Math.pow(Math.random(), 2.2) * 3.4 + 0.7;
				p.x0 = rand(0, w); p.x = p.x0;
				p.y = first ? rand(0, h) : rand(-30, -5);
				p.vy = 16 + p.r * 13;
				p.sw = rand(0.3, 1.2); p.ph = rand(0, TAU); p.amp = rand(6, 26);
				p.a = rand(0.45, 0.95); p.rot = rand(0, TAU);
			},
			update: function (p, dt, w, h, t) {
				p.y += p.vy * dt;
				p.x0 += 10 * dt;
				if (p.x0 > w + 30) p.x0 -= w + 60;
				p.x = p.x0 + Math.sin(t * p.sw + p.ph) * p.amp;
				p.rot += dt * 0.4;
				return p.y < h + 10;
			},
			draw: function (c, p) {
				c.globalAlpha = p.a;
				if (p.r > 3) {   // bigger flakes get six arms
					c.save();
					c.translate(p.x, p.y); c.rotate(p.rot);
					c.strokeStyle = "#fff"; c.lineWidth = 1;
					c.beginPath();
					for (var i = 0; i < 3; i++) {
						var a = i * Math.PI / 3, dx = Math.cos(a) * p.r * 1.6, dy = Math.sin(a) * p.r * 1.6;
						c.moveTo(-dx, -dy); c.lineTo(dx, dy);
					}
					c.stroke();
					c.restore();
				}
				c.fillStyle = "#fff";
				c.beginPath(); c.arc(p.x, p.y, p.r * (p.r > 3 ? 0.55 : 1), 0, TAU); c.fill();
			}
		},

		stars: {
			density: 220,
			init: function (p, w, h, first, o) {
				p.x = first ? rand(0, w) : w + 4; p.y = rand(0, h);
				p.r = Math.pow(Math.random(), 3) * 1.5 + 0.35;
				p.base = rand(0.35, 1); p.sp = rand(0.6, 2.6); p.ph = rand(0, TAU);
				p.col = pick(["#ffffff", "#ffffff", "#cfe3ff", "#ffeacc", "#e6d4ff"]);
			},
			update: function (p, dt, w, h, t, o) {
				if (o.drift) { p.x -= o.drift * (0.3 + p.r) * dt; if (p.x < -4) return false; }
				return true;
			},
			draw: function (c, p, t) {
				var a = p.base * (0.55 + 0.45 * Math.sin(t * p.sp + p.ph));
				c.globalAlpha = a;
				c.fillStyle = p.col;
				c.beginPath(); c.arc(p.x, p.y, p.r, 0, TAU); c.fill();
				if (p.r > 1.35) {   // a soft cross on the brightest stars
					c.globalAlpha = a * 0.5;
					c.fillRect(p.x - p.r * 3, p.y - 0.5, p.r * 6, 1);
					c.fillRect(p.x - 0.5, p.y - p.r * 3, 1, p.r * 6);
				}
			},
			frame: function (c, dt, w, h, t, S, o) {
				if (!o.shooting) return;
				if (!S.shoot) {
					S.next = (S.next || rand(2, 5)) - dt;
					if (S.next <= 0) {
						var ang = rand(0.35, 0.6);
						S.shoot = { x: rand(w * 0.1, w * 0.8), y: rand(0, h * 0.35), vx: Math.cos(ang) * 900, vy: Math.sin(ang) * 900, life: 0, max: rand(0.6, 1.1) };
						S.next = rand(3, 8);
					}
					return;
				}
				var s = S.shoot;
				s.life += dt; s.x += s.vx * dt; s.y += s.vy * dt;
				var fade = 1 - s.life / s.max;
				if (fade <= 0) { S.shoot = null; return; }
				var tail = 0.14, tx = s.x - s.vx * tail, ty = s.y - s.vy * tail;
				var g = c.createLinearGradient(s.x, s.y, tx, ty);
				g.addColorStop(0, "rgba(255,255,255," + fade + ")");
				g.addColorStop(1, "rgba(255,255,255,0)");
				c.globalAlpha = 1;
				c.strokeStyle = g; c.lineWidth = 2; c.lineCap = "round";
				c.beginPath(); c.moveTo(s.x, s.y); c.lineTo(tx, ty); c.stroke();
			}
		},

		petals: {
			density: 70,
			init: function (p, w, h, first) {
				p.x = first ? rand(0, w) : rand(-w * 0.3, w * 0.9);
				p.y = first ? rand(0, h) : rand(-40, -10);
				p.s = rand(5, 10); p.vy = rand(28, 55); p.vx = rand(18, 45);
				p.rot = rand(0, TAU); p.vr = rand(-1.6, 1.6);
				p.fs = rand(1.5, 3.5); p.ph = rand(0, TAU); p.a = rand(0.7, 0.95);
				p.col = pick(["#ffd1dc", "#ffb7c9", "#ffc8d6", "#ffe4ea", "#f9a8c0"]);
			},
			update: function (p, dt, w, h, t) {
				p.x += (p.vx + Math.sin(t * 0.8 + p.ph) * 20) * dt;
				p.y += p.vy * dt; p.rot += p.vr * dt;
				return p.y < h + 20 && p.x < w + 30;
			},
			draw: function (c, p, t) {
				var s = p.s;
				c.save();
				c.translate(p.x, p.y); c.rotate(p.rot);
				c.scale(0.35 + 0.65 * Math.abs(Math.cos(t * p.fs + p.ph)), 1);
				c.globalAlpha = p.a; c.fillStyle = p.col;
				c.beginPath();
				c.moveTo(0, -s);
				c.bezierCurveTo(s * 0.9, -s * 0.7, s * 0.7, s * 0.7, 0, s);
				c.bezierCurveTo(-s * 0.7, s * 0.7, -s * 0.9, -s * 0.7, 0, -s);
				c.fill();
				c.restore();
			}
		},

		leaves: {
			density: 45,
			init: function (p, w, h, first) {
				p.x = rand(0, w); p.y = first ? rand(0, h) : rand(-50, -15);
				p.s = rand(9, 16); p.vy = rand(35, 70);
				p.sw = rand(0.6, 1.4); p.ph = rand(0, TAU); p.amp = rand(30, 70);
				p.rot = rand(0, TAU); p.vr = rand(-2.2, 2.2); p.fs = rand(1, 2.5);
				p.col = pick(["#d9541e", "#e8892b", "#c0392b", "#f2b134", "#a0522d", "#e67e22"]);
				p.x0 = p.x;
			},
			update: function (p, dt, w, h, t) {
				p.y += p.vy * dt; p.x0 += 14 * dt;
				p.x = p.x0 + Math.sin(t * p.sw + p.ph) * p.amp;
				p.rot += p.vr * dt;
				return p.y < h + 30;
			},
			draw: function (c, p, t) {
				var s = p.s;
				c.save();
				c.translate(p.x, p.y); c.rotate(p.rot);
				c.scale(1, 0.3 + 0.7 * Math.abs(Math.cos(t * p.fs + p.ph)));
				c.globalAlpha = 0.9; c.fillStyle = p.col;
				c.beginPath();
				c.moveTo(-s, 0);
				c.quadraticCurveTo(0, -s * 0.75, s, 0);
				c.quadraticCurveTo(0, s * 0.75, -s, 0);
				c.fill();
				c.strokeStyle = "rgba(60,20,0,0.45)"; c.lineWidth = 1;
				c.beginPath(); c.moveTo(-s * 1.25, 0); c.lineTo(s * 0.85, 0); c.stroke();
				c.restore();
			}
		},

		bubbles: {
			density: 60,
			init: function (p, w, h, first) {
				p.r = Math.pow(Math.random(), 1.8) * 9 + 2;
				p.x0 = rand(0, w); p.x = p.x0;
				p.y = first ? rand(0, h) : h + rand(10, 60);
				p.vy = 22 + p.r * 5; p.ph = rand(0, TAU); p.sw = rand(1, 2.5);
			},
			update: function (p, dt, w, h, t) {
				p.y -= p.vy * dt;
				p.x = p.x0 + Math.sin(t * p.sw + p.ph) * p.r * 0.9;
				return p.y > -20;
			},
			draw: function (c, p, t, h) {
				var fade = Math.min(1, p.y / (h * 0.25));
				c.globalAlpha = 0.75 * Math.max(0, fade);
				c.fillStyle = "rgba(180,230,255,0.08)";
				c.strokeStyle = "rgba(210,240,255,0.6)"; c.lineWidth = 1;
				c.beginPath(); c.arc(p.x, p.y, p.r, 0, TAU); c.fill(); c.stroke();
				c.fillStyle = "rgba(255,255,255,0.7)";
				c.beginPath(); c.arc(p.x - p.r * 0.35, p.y - p.r * 0.35, p.r * 0.22, 0, TAU); c.fill();
			}
		},

		fireflies: {
			density: 45, blend: "lighter",
			init: function (p, w, h) {
				p.x = rand(0, w); p.y = rand(h * 0.15, h);
				p.ang = rand(0, TAU); p.v = rand(8, 26);
				p.ps = rand(0.8, 2); p.ph = rand(0, TAU); p.s = rand(22, 40);
			},
			update: function (p, dt, w, h) {
				p.ang += (Math.random() - 0.5) * dt * 4;
				p.x += Math.cos(p.ang) * p.v * dt; p.y += Math.sin(p.ang) * p.v * dt;
				if (p.x < -20) p.x = w + 20; else if (p.x > w + 20) p.x = -20;
				if (p.y < -20) p.y = h + 20; else if (p.y > h + 20) p.y = -20;
				return true;
			},
			draw: function (c, p, t) {
				var a = Math.max(0, Math.sin(t * p.ps + p.ph));
				a = 0.15 + 0.85 * a * a;
				c.globalAlpha = a;
				c.drawImage(glow("rgba(215,255,120,0.9)"), p.x - p.s / 2, p.y - p.s / 2, p.s, p.s);
				c.fillStyle = "#fbffd0";
				c.beginPath(); c.arc(p.x, p.y, 1.8, 0, TAU); c.fill();
			}
		},

		rain: {
			density: 240,
			init: function (p, w, h, first) {
				p.x = rand(-100, w); p.y = first ? rand(0, h) : rand(-h * 0.3, -10);
				p.len = rand(10, 24); p.v = rand(550, 850); p.a = rand(0.15, 0.4);
			},
			update: function (p, dt, w, h) {
				p.y += p.v * dt; p.x += p.v * 0.15 * dt;
				return p.y < h + 30;
			},
			drawAll: function (c, ps) {
				c.strokeStyle = "rgba(190,215,240,1)"; c.lineWidth = 1;
				for (var a = 0; a < 3; a++) {   // three alpha buckets = three strokes per frame
					c.globalAlpha = 0.15 + a * 0.12;
					c.beginPath();
					for (var i = a; i < ps.length; i += 3) {
						var p = ps[i];
						c.moveTo(p.x, p.y); c.lineTo(p.x - p.len * 0.15, p.y - p.len);
					}
					c.stroke();
				}
			}
		},

		embers: {
			density: 110, blend: "lighter",
			init: function (p, w, h, first) {
				p.x = rand(0, w); p.y = first ? rand(h * 0.2, h) : h + rand(0, 20);
				p.vy = rand(30, 95); p.vx = rand(-12, 12);
				p.life = rand(3, 7); p.age = first ? rand(0, p.life) : 0;
				p.s = rand(12, 26); p.ph = rand(0, TAU);
				p.col = pick(["rgba(255,170,60,0.95)", "rgba(255,120,30,0.95)", "rgba(255,210,110,0.95)"]);
			},
			update: function (p, dt, w, h, t) {
				p.age += dt;
				p.y -= p.vy * dt;
				p.x += (p.vx + Math.sin(t * 2 + p.ph) * 18) * dt;
				return p.age < p.life && p.y > -20;
			},
			draw: function (c, p, t) {
				var f = 1 - p.age / p.life;
				c.globalAlpha = f * (0.7 + 0.3 * Math.sin(t * 12 + p.ph));
				var s = p.s * (0.5 + 0.5 * f);
				c.drawImage(glow(p.col), p.x - s / 2, p.y - s / 2, s, s);
				c.fillStyle = "#fff2c4";
				c.beginPath(); c.arc(p.x, p.y, 0.6 + 1.2 * f, 0, TAU); c.fill();
			}
		},

		hearts: {
			density: 40,
			init: function (p, w, h, first) {
				p.x0 = rand(0, w); p.x = p.x0;
				p.y = first ? rand(0, h) : h + rand(10, 50);
				p.s = rand(8, 20); p.vy = rand(25, 55);
				p.ph = rand(0, TAU); p.sw = rand(0.6, 1.4); p.amp = rand(10, 30);
				p.rot = rand(-0.3, 0.3); p.a = rand(0.5, 0.9);
				p.col = pick(["#ff4d6d", "#ff758f", "#ff8fab", "#ffb3c6", "#e5383b", "#ffffff"]);
			},
			update: function (p, dt, w, h, t) {
				p.y -= p.vy * dt;
				p.x = p.x0 + Math.sin(t * p.sw + p.ph) * p.amp;
				return p.y > -30;
			},
			draw: function (c, p, t, h) {
				c.save();
				c.translate(p.x, p.y); c.rotate(p.rot + Math.sin(t * p.sw + p.ph) * 0.2);
				c.globalAlpha = p.a * Math.max(0, Math.min(1, p.y / (h * 0.3)));
				c.fillStyle = p.col;
				heartPath(c, p.s); c.fill();
				c.restore();
			}
		},

		confetti: {
			density: 110,
			init: function (p, w, h, first) {
				p.x = rand(0, w); p.y = first ? rand(0, h) : rand(-40, -10);
				p.w = rand(5, 10); p.h = rand(3, 6);
				p.vy = rand(60, 130); p.vx = rand(-20, 20);
				p.rot = rand(0, TAU); p.vr = rand(-5, 5); p.fs = rand(3, 8); p.ph = rand(0, TAU);
				p.col = pick(["#ff595e", "#ffca3a", "#8ac926", "#1982c4", "#6a4c93", "#ff9f1c", "#2ec4b6", "#ffffff"]);
			},
			update: function (p, dt, w, h, t) {
				p.y += p.vy * dt;
				p.x += (p.vx + Math.sin(t * 2 + p.ph) * 25) * dt;
				p.rot += p.vr * dt;
				return p.y < h + 20;
			},
			draw: function (c, p, t) {
				c.save();
				c.translate(p.x, p.y); c.rotate(p.rot);
				c.scale(1, Math.cos(t * p.fs + p.ph));
				c.globalAlpha = 0.9; c.fillStyle = p.col;
				c.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
				c.restore();
			}
		},

		sparkles: {
			density: 70, blend: "lighter",
			init: function (p, w, h, first) {
				p.x = rand(0, w); p.y = first ? rand(0, h) : h + rand(0, 30);
				p.vy = rand(10, 30); p.s = rand(3, 8);
				p.ps = rand(1.5, 4); p.ph = rand(0, TAU);
				p.col = pick(["#fff4c2", "#ffd6ff", "#d9c2ff", "#c2f0ff", "#ffffff"]);
			},
			update: function (p, dt, w, h, t) {
				p.y -= p.vy * dt;
				p.x += Math.sin(t * 0.7 + p.ph) * 10 * dt;
				return p.y > -20;
			},
			draw: function (c, p, t) {
				var k = Math.max(0, Math.sin(t * p.ps + p.ph)), s = p.s * (0.3 + 0.7 * k);
				c.globalAlpha = 0.25 + 0.75 * k;
				c.drawImage(glow("rgba(220,190,255,0.5)"), p.x - s * 2, p.y - s * 2, s * 4, s * 4);
				c.fillStyle = p.col;
				c.beginPath();   // four-point star
				c.moveTo(p.x, p.y - s);
				c.quadraticCurveTo(p.x, p.y, p.x + s, p.y);
				c.quadraticCurveTo(p.x, p.y, p.x, p.y + s);
				c.quadraticCurveTo(p.x, p.y, p.x - s, p.y);
				c.quadraticCurveTo(p.x, p.y, p.x, p.y - s);
				c.fill();
			}
		},

		matrix: {
			density: 0, trail: 0.06, opacity: 0.6,
			frame: function (c, dt, w, h, t, S) {
				var fs = 16, cols = Math.ceil(w / fs);
				if (!S.drops || S.cols !== cols) {
					S.cols = cols; S.drops = [];
					for (var i = 0; i < cols; i++)
						S.drops.push({ y: rand(-10, h / fs), v: rand(8, 18), on: Math.random() < 0.55, acc: 0 });
				}
				var glyphs = "アイウエオカキクケコサシスセソタチツテトナニヌネノ0123456789ハヒフヘホマミムメモ";
				c.font = fs + "px monospace";
				c.textBaseline = "top";
				for (var j = 0; j < cols; j++) {
					var d = S.drops[j];
					if (!d.on) { if (Math.random() < dt * 0.05) d.on = true; continue; }
					d.acc += d.v * dt;
					while (d.acc >= 1) {
						d.acc -= 1; d.y += 1;
						var ch = glyphs.charAt((Math.random() * glyphs.length) | 0);
						c.globalAlpha = 1;
						c.fillStyle = Math.random() < 0.1 ? "#e8ffe8" : "#3dff7a";
						c.fillText(ch, j * fs, d.y * fs);
					}
					if (d.y * fs > h + fs) {
						d.y = rand(-20, 0); d.v = rand(6, 16);
						if (Math.random() < 0.4) d.on = false;
					}
				}
			}
		},

		grid: {
			density: 0,
			frame: function (c, dt, w, h, t, S) {
				var hz = h * 0.62, depth = h - hz, cx = w / 2;
				S.off = ((S.off || 0) + dt * 0.35) % 1;
				c.globalAlpha = 1;
				c.lineWidth = 1.5;
				c.shadowColor = "#ff4fd8"; c.shadowBlur = 8;
				// horizontal lines, spaced by perspective, scrolling toward the viewer
				var n = 14;
				for (var i = 0; i < n; i++) {
					var k = (i + S.off) / n, y = hz + depth * k * k;
					c.strokeStyle = "rgba(255,79,216," + (0.15 + 0.75 * k).toFixed(3) + ")";
					c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke();
				}
				// vertical lines converging on the vanishing point
				c.strokeStyle = "rgba(120,220,255,0.55)";
				c.shadowColor = "#56e0ff";
				c.beginPath();
				var lines = 22;
				for (var v = -lines; v <= lines; v++) {
					c.moveTo(cx + v * 6, hz);
					c.lineTo(cx + v * (w / lines) * 1.6, h);
				}
				c.stroke();
				c.shadowBlur = 0;
			}
		},

		// ── Interactive effects (pointer: true) ──
		// livePtrs = every cursor this frame, clicks = new pointerdowns.

		// Drifting dots that orbit nearby cursors; moving leaves a trail of
		// new dots that link to their neighbours and fade out.
		web: {
			density: 0, pointer: true,
			frame: function (c, dt, w, h, t, S) {
				var i, j, p, q, dx, dy, d;
				if (!S.dots) {
					S.dots = []; S.trail = [];
					for (i = 0, j = scaledCount(80); i < j; i++)
						S.dots.push({ x: rand(0, w), y: rand(0, h), bx: rand(-14, 14), by: rand(-14, 14), vx: 0, vy: 0, r: rand(1.2, 2.4), col: "#8cc8ff" });
				}
				var dots = S.dots, trail = S.trail, R = 190, RING = 70;
				S.hue = ((S.hue || 200) + dt * 40) % 360;
				eachMove(S, livePtrs, 14, function (x, y, ux, uy) {
					var hue = (S.hue + rand(-30, 30)) | 0;
					trail.push({ x: x, y: y, vx: -ux * rand(10, 40) + rand(-25, 25), vy: -uy * rand(10, 40) + rand(-25, 25),
						age: 0, max: rand(1.2, 2), r: rand(1.5, 3), col: "hsl(" + hue + ",100%,72%)" });
				});
				for (i = 0; i < clicks.length; i++) {
					for (j = 0; j < 18; j++) {
						var a = j / 18 * TAU;
						trail.push({ x: clicks[i].x, y: clicks[i].y, vx: Math.cos(a) * 150, vy: Math.sin(a) * 150,
							age: 0, max: 1.6, r: 2.2, col: "hsl(" + ((S.hue + j * 20) % 360 | 0) + ",100%,72%)" });
					}
				}
				if (trail.length > 160) trail.splice(0, trail.length - 160);

				// field dots: base drift plus a pull toward a ring around each cursor
				var ease = Math.min(1, dt * 3);
				for (i = 0; i < dots.length; i++) {
					p = dots[i];
					var tx = 0, ty = 0;
					for (j = 0; j < livePtrs.length; j++) {
						dx = livePtrs[j].x - p.x; dy = livePtrs[j].y - p.y;
						d = Math.sqrt(dx * dx + dy * dy);
						if (d < R && d > 0.5) {
							var k = 1 - d / R, pull = (d - RING) * 2.2 * k;
							tx += dx / d * pull - dy / d * 55 * k;
							ty += dy / d * pull + dx / d * 55 * k;
						}
					}
					p.vx += (tx - p.vx) * ease; p.vy += (ty - p.vy) * ease;
					p.x += (p.bx + p.vx) * dt; p.y += (p.by + p.vy) * dt;
					if (p.x < -20) p.x = w + 20; else if (p.x > w + 20) p.x = -20;
					if (p.y < -20) p.y = h + 20; else if (p.y > h + 20) p.y = -20;
					p.a = 1;
				}
				for (i = trail.length - 1; i >= 0; i--) {
					p = trail[i];
					p.age += dt;
					if (p.age >= p.max) { trail.splice(i, 1); continue; }
					var drag = Math.max(0, 1 - 1.6 * dt);
					p.vx *= drag; p.vy *= drag;
					p.x += p.vx * dt; p.y += p.vy * dt;
					p.a = 1 - p.age / p.max;
				}

				var all = dots.concat(trail), L = 115, L2 = L * L;
				c.lineWidth = 1;
				for (i = 0; i < all.length; i++) {
					p = all[i];
					for (j = i + 1; j < all.length; j++) {
						q = all[j];
						dx = q.x - p.x; if (dx > L || dx < -L) continue;
						dy = q.y - p.y; if (dy > L || dy < -L) continue;
						var d2 = dx * dx + dy * dy;
						if (d2 >= L2) continue;
						c.globalAlpha = (1 - Math.sqrt(d2) / L) * p.a * q.a * 0.55;
						c.strokeStyle = q.max ? q.col : p.col;
						c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(q.x, q.y); c.stroke();
					}
				}
				c.strokeStyle = "#ffffff";
				for (j = 0; j < livePtrs.length; j++) {
					var P = livePtrs[j];
					for (i = 0; i < all.length; i++) {
						p = all[i];
						dx = p.x - P.x; dy = p.y - P.y; d = Math.sqrt(dx * dx + dy * dy);
						if (d >= R) continue;
						c.globalAlpha = (1 - d / R) * 0.5 * p.a;
						c.beginPath(); c.moveTo(P.x, P.y); c.lineTo(p.x, p.y); c.stroke();
					}
				}
				for (i = 0; i < all.length; i++) {
					p = all[i];
					c.globalAlpha = 0.9 * p.a;
					c.fillStyle = p.col;
					c.beginPath(); c.arc(p.x, p.y, p.r, 0, TAU); c.fill();
				}
			}
		},

		// Glowing rainbow ribbons that follow each cursor and fade; an
		// invisible pen keeps drawing when nobody has moved for a while.
		ribbon: {
			density: 0, pointer: true,
			frame: function (c, dt, w, h, t, S) {
				var strokes = S.strokes || (S.strokes = {}), sparks = S.sparks || (S.sparks = []);
				var i, j, a, b, f, MAX = 1.6;
				S.hue = ((S.hue || 0) + dt * 120) % 360;
				var list = livePtrs.slice();
				if (t - (S.lastLive || -99) > 2.5) list.push(ghostPointer(t, w, h));
				eachMove(S, list, 5, function (x, y, ux, uy, p) {
					if (p.id !== "ghost") S.lastLive = t;
					(strokes[p.id] || (strokes[p.id] = [])).push({ x: x, y: y, age: 0, hue: S.hue | 0 });
					if (Math.random() < 0.12)
						sparks.push({ x: x, y: y, vx: rand(-60, 60) - ux * 30, vy: rand(-90, 10), age: 0, max: rand(0.6, 1.2), hue: S.hue | 0 });
				});
				for (i = 0; i < clicks.length; i++)
					for (j = 0; j < 26; j++) {
						a = rand(0, TAU); var v = rand(80, 260);
						sparks.push({ x: clicks[i].x, y: clicks[i].y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, age: 0, max: rand(0.7, 1.4), hue: (S.hue + j * 14) % 360 | 0 });
					}
				if (sparks.length > 300) sparks.splice(0, sparks.length - 300);

				c.globalCompositeOperation = "lighter";
				c.lineCap = "round"; c.lineJoin = "round";
				for (var id in strokes) {
					var s = strokes[id];
					for (i = 0; i < s.length; i++) s[i].age += dt;
					while (s.length && s[0].age > MAX) s.shift();
					if (s.length > 220) s.splice(0, s.length - 220);
					if (!s.length) { delete strokes[id]; continue; }
					for (var pass = 0; pass < 2; pass++) {   // wide soft glow, then a bright core
						// additive glow; the core uses normal blending so segment joints don't bead
						c.globalCompositeOperation = pass ? "source-over" : "lighter";
						for (i = 1; i < s.length; i++) {
							a = s[i - 1]; b = s[i]; f = Math.sqrt(1 - b.age / MAX);   // stays bright longer, then fades
							c.strokeStyle = "hsl(" + b.hue + ",100%," + (pass ? 78 : 60) + "%)";
							c.globalAlpha = pass ? f * 0.9 : f * 0.22;
							c.lineWidth = pass ? 1 + 3 * f : 5 + 16 * f;
							c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
						}
					}
				}
				for (i = sparks.length - 1; i >= 0; i--) {
					var k = sparks[i];
					k.age += dt;
					if (k.age >= k.max) { sparks.splice(i, 1); continue; }
					k.vy += 160 * dt; k.x += k.vx * dt; k.y += k.vy * dt;
					c.globalAlpha = 1 - k.age / k.max;
					c.fillStyle = "hsl(" + k.hue + ",100%,75%)";
					c.beginPath(); c.arc(k.x, k.y, 1.8, 0, TAU); c.fill();
				}
			}
		},

		// Particles pulled toward the nearest cursor and swirling around it,
		// drawn as motion streaks colored by speed. Clicks blast them away.
		swarm: {
			density: 240, pointer: true, ghost: true, trail: 0.18, blend: "lighter",
			init: function (p, w, h) {
				p.x = rand(0, w); p.y = rand(0, h); p.px = p.x; p.py = p.y;
				p.vx = rand(-40, 40); p.vy = rand(-40, 40);
				p.spin = Math.random() < 0.5 ? -1 : 1; p.k = rand(0.6, 1.4);
			},
			update: function (p, dt, w, h) {
				p.px = p.x; p.py = p.y;
				var g = nearest(livePtrs, p.x, p.y), dx, dy, d;
				if (g) {
					dx = g.x - p.x; dy = g.y - p.y; d = Math.sqrt(dx * dx + dy * dy) + 0.01;
					var pull = 700 * p.k * Math.min(1, d / 120);
					p.vx += (dx / d * pull - dy / d * 260 * p.spin) * dt;
					p.vy += (dy / d * pull + dx / d * 260 * p.spin) * dt;
				}
				for (var i = 0; i < clicks.length; i++) {
					dx = p.x - clicks[i].x; dy = p.y - clicks[i].y; d = Math.sqrt(dx * dx + dy * dy) + 0.01;
					if (d < 320) { var kick = 1100 * (1 - d / 320); p.vx += dx / d * kick; p.vy += dy / d * kick; }
				}
				var damp = Math.pow(0.35, dt);
				p.vx *= damp; p.vy *= damp;
				var sp = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
				if (sp > 600) { p.vx *= 600 / sp; p.vy *= 600 / sp; sp = 600; }
				p.sp = sp;
				p.x += p.vx * dt; p.y += p.vy * dt;
				return p.x > -300 && p.x < w + 300 && p.y > -300 && p.y < h + 300;
			},
			draw: function (c, p) {
				c.globalAlpha = 0.85;
				c.strokeStyle = "hsl(" + (185 + Math.min(1, p.sp / 500) * 140 | 0) + ",100%,65%)";
				c.lineWidth = 1.6; c.lineCap = "round";
				c.beginPath(); c.moveTo(p.px, p.py); c.lineTo(p.x + 0.1, p.y); c.stroke();
			}
		},

		// A grid of dots on springs: cursors push them aside, clicks send
		// out ripple waves, and displaced dots glow warmer.
		dots: {
			density: 0, pointer: true,
			frame: function (c, dt, w, h, t, S) {
				var sp = isSmallScreen() ? 26 : 32, i, j, g, r, dx, dy, d;
				if (!S.g) {
					var cols = Math.ceil(w / sp) + 1, rows = Math.ceil(h / sp) + 1;
					var x0 = (w - (cols - 1) * sp) / 2, y0 = (h - (rows - 1) * sp) / 2;
					S.g = []; S.rip = []; S.next = 1.5;
					for (j = 0; j < rows; j++)
						for (i = 0; i < cols; i++)
							S.g.push({ hx: x0 + i * sp, hy: y0 + j * sp, ox: 0, oy: 0, vx: 0, vy: 0 });
				}
				var rip = S.rip, RSPEED = 380, RLIFE = 1.8, R = 120, R2 = R * R;
				for (i = 0; i < clicks.length; i++) rip.push({ x: clicks[i].x, y: clicks[i].y, age: 0, s: 2600 });
				eachMove(S, livePtrs, 220, function (x, y) { rip.push({ x: x, y: y, age: 0, s: 700 }); });
				S.next -= dt;
				if (S.next <= 0) {   // ambient drops when nobody is around
					if (!livePtrs.length) rip.push({ x: rand(w * 0.15, w * 0.85), y: rand(h * 0.15, h * 0.85), age: 0, s: 1800 });
					S.next = rand(2.5, 4.5);
				}
				for (i = rip.length - 1; i >= 0; i--) { rip[i].age += dt; if (rip[i].age > RLIFE) rip.splice(i, 1); }
				if (rip.length > 12) rip.splice(0, rip.length - 12);

				var still = [];
				for (i = 0; i < S.g.length; i++) {
					g = S.g[i];
					var x = g.hx + g.ox, y = g.hy + g.oy;
					var fx_ = -70 * g.ox - 9 * g.vx, fy_ = -70 * g.oy - 9 * g.vy;
					for (j = 0; j < livePtrs.length; j++) {
						dx = x - livePtrs[j].x; dy = y - livePtrs[j].y;
						var d2 = dx * dx + dy * dy;
						if (d2 < R2) {
							d = Math.sqrt(d2) + 0.01;
							var f = 1 - d / R; f = f * f * 4200;
							fx_ += dx / d * f; fy_ += dy / d * f;
						}
					}
					for (j = 0; j < rip.length; j++) {
						r = rip[j];
						dx = g.hx - r.x; dy = g.hy - r.y; d = Math.sqrt(dx * dx + dy * dy) + 0.01;
						var band = Math.abs(d - r.age * RSPEED);
						if (band < 40) {
							var s = (1 - band / 40) * (1 - r.age / RLIFE) * r.s;
							fx_ += dx / d * s; fy_ += dy / d * s;
						}
					}
					g.vx += fx_ * dt; g.vy += fy_ * dt;
					g.ox += g.vx * dt; g.oy += g.vy * dt;
					var disp = Math.sqrt(g.ox * g.ox + g.oy * g.oy);
					if (disp < 0.6) { still.push(g); continue; }
					c.globalAlpha = 0.45 + Math.min(0.55, disp / 50);
					c.fillStyle = "hsl(" + ((255 + Math.min(disp, 60) * 2.2) % 360 | 0) + ",100%,68%)";
					c.beginPath(); c.arc(g.hx + g.ox, g.hy + g.oy, 1.4 + Math.min(3.6, disp * 0.09), 0, TAU); c.fill();
				}
				c.globalAlpha = 0.4;   // resting dots in one batch
				c.fillStyle = "#b4a0ff";
				c.beginPath();
				for (i = 0; i < still.length; i++) c.rect(still[i].hx + still[i].ox - 1.1, still[i].hy + still[i].oy - 1.1, 2.2, 2.2);
				c.fill();
			}
		},

		// Stardust riding a slowly changing flow field; near a cursor it gets
		// caught in a whirlpool. Clicks push it outward.
		vortex: {
			density: 380, pointer: true, ghost: true, trail: 0.06, blend: "lighter",
			init: function (p, w, h, first) {
				p.x = rand(0, w); p.y = rand(0, h); p.px = p.x; p.py = p.y;
				p.life = rand(3, 8); p.age = first ? rand(0, p.life) : 0;
				p.kx = 0; p.ky = 0;
				p.col = Math.random() < 0.6 ? "rgba(90,230,220,0.6)" : "rgba(255,205,110,0.65)";
			},
			update: function (p, dt, w, h, t) {
				p.px = p.x; p.py = p.y;
				var a = (Math.sin(p.x * 0.0035 + t * 0.13) + Math.cos(p.y * 0.0042 - t * 0.11)) * Math.PI;
				var vx = Math.cos(a) * 35, vy = Math.sin(a) * 35, R = 280, i, dx, dy, d;
				for (i = 0; i < livePtrs.length; i++) {
					dx = livePtrs[i].x - p.x; dy = livePtrs[i].y - p.y; d = Math.sqrt(dx * dx + dy * dy);
					if (d < R && d > 1) {
						var k = 1 - d / R;
						vx += (-dy / d * 320 + dx / d * 70) * k;
						vy += (dx / d * 320 + dy / d * 70) * k;
					}
				}
				for (i = 0; i < clicks.length; i++) {
					dx = p.x - clicks[i].x; dy = p.y - clicks[i].y; d = Math.sqrt(dx * dx + dy * dy) + 0.01;
					if (d < 300) { p.kx += dx / d * 500 * (1 - d / 300); p.ky += dy / d * 500 * (1 - d / 300); }
				}
				var damp = Math.pow(0.15, dt);
				p.kx *= damp; p.ky *= damp;
				p.x += (vx + p.kx) * dt; p.y += (vy + p.ky) * dt;
				p.age += dt;
				return p.age < p.life && p.x > -10 && p.x < w + 10 && p.y > -10 && p.y < h + 10;
			},
			draw: function (c, p) {
				c.globalAlpha = Math.sin(p.age / p.life * Math.PI);
				c.strokeStyle = p.col;
				c.lineWidth = 1.4; c.lineCap = "round";
				c.beginPath(); c.moveTo(p.px, p.py); c.lineTo(p.x + 0.1, p.y); c.stroke();
			}
		}
	};

	// ── Engine ──────────────────────────────────────────────────────────
	var layer = null, canvas = null, ctx = null;
	var current = null, fx = null, fxOpts = {}, parts = [], state = {};
	var raf = 0, lastT = 0, clock = 0, W = 0, H = 0;
	var reduceMotion = !!(global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)").matches);

	function ensureDom() {
		if (layer) return;
		layer = document.createElement("div");
		layer.id = "room-theme-layer";
		layer.setAttribute("aria-hidden", "true");
		canvas = document.createElement("canvas");
		canvas.id = "room-theme-fx";
		canvas.setAttribute("aria-hidden", "true");
		document.body.insertBefore(canvas, document.body.firstChild);
		document.body.insertBefore(layer, document.body.firstChild);
		ctx = canvas.getContext("2d");
		global.addEventListener("resize", function () { if (fx) { resize(); seed(); } });
		trackPointer();
		document.addEventListener("visibilitychange", function () {
			if (document.hidden) stopLoop(); else if (fx) startLoop();
		});
	}

	function isSmallScreen() {
		return global.innerWidth <= 760;
	}

	function resize() {
		var dpr = Math.min(global.devicePixelRatio || 1, 1.5);
		W = global.innerWidth; H = global.innerHeight;
		canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
		canvas.style.width = W + "px"; canvas.style.height = H + "px";
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	}

	function seed() {
		parts = []; state = {};
		ctx.clearRect(0, 0, W, H);
		if (!fx.init) return;
		var n = Math.round(fx.density * (fxOpts.density || 1) * Math.min(1.6, (W * H) / (1920 * 1080)));
		if (isSmallScreen()) n = Math.round(n * 0.6);
		n = Math.max(8, n);
		for (var i = 0; i < n; i++) {
			var p = {};
			fx.init(p, W, H, true, fxOpts);
			parts.push(p);
		}
	}

	function renderFrame(dt) {
		clock += dt;
		var t = clock;
		if (fx.pointer) {
			livePtrs = collectPointers();
			if (fx.ghost && !livePtrs.length) livePtrs.push(ghostPointer(t, W, H));
			clicks = clickQueue.splice(0);
		}
		ctx.globalCompositeOperation = "source-over";
		if (fx.trail) {
			// fade what is already drawn so moving glyphs leave a tail
			ctx.globalCompositeOperation = "destination-out";
			ctx.globalAlpha = 1;
			ctx.fillStyle = "rgba(0,0,0," + (1 - Math.pow(1 - fx.trail, dt * 60)).toFixed(4) + ")";
			ctx.fillRect(0, 0, W, H);
			ctx.globalCompositeOperation = "source-over";
		} else {
			ctx.clearRect(0, 0, W, H);
		}
		if (fx.blend) ctx.globalCompositeOperation = fx.blend;
		if (fx.update) {
			for (var i = 0; i < parts.length; i++) {
				var p = parts[i];
				if (!fx.update(p, dt, W, H, t, fxOpts)) fx.init(p, W, H, false, fxOpts);
			}
		}
		if (fx.drawAll) fx.drawAll(ctx, parts, t, H);
		else if (fx.draw) for (var j = 0; j < parts.length; j++) fx.draw(ctx, parts[j], t, H);
		ctx.globalCompositeOperation = "source-over";
		if (fx.frame) fx.frame(ctx, dt, W, H, t, state, fxOpts);
		ctx.globalAlpha = 1;
	}

	function loop(now) {
		raf = 0;
		if (!fx) return;
		var dt = lastT ? Math.min(0.05, (now - lastT) / 1000) : 0.016;
		lastT = now;
		renderFrame(dt);
		raf = global.requestAnimationFrame(loop);
	}

	function startLoop() {
		if (raf || !fx) return;
		if (reduceMotion) {
			// Reduced motion: one still frame of the effect, no animation.
			renderFrame(0.016);
			if (fx.frame) for (var i = 0; i < 40; i++) renderFrame(0.05);
			return;
		}
		lastT = 0;
		raf = global.requestAnimationFrame(loop);
	}

	function stopLoop() {
		if (raf) global.cancelAnimationFrame(raf);
		raf = 0;
	}

	function apply(id) {
		var theme = BY_ID[id];
		if (!theme || theme.id === "classic") theme = null;
		var newId = theme ? theme.id : null;
		if (newId === current) return;
		ensureDom();
		hookClient();
		current = newId;
		clickQueue.length = 0;
		stopLoop();
		document.body.classList.toggle("room-themed", !!theme);
		if (theme) document.body.setAttribute("data-room-theme", theme.id);
		else document.body.removeAttribute("data-room-theme");
		layer.className = theme && theme.overlay ? "rt-" + theme.overlay : "";

		if (!theme) {
			fx = null;
			ctx.clearRect(0, 0, W || canvas.width, H || canvas.height);
			canvas.style.display = "none";
			return;   // script.js restores the room color
		}
		document.body.style.background = theme.bg;
		var bottom = document.getElementById("bottom");
		if (bottom && theme.bottom) bottom.style.background = theme.bottom;

		fx = theme.fx ? FX[theme.fx] : null;
		fxOpts = theme.fxOpts || {};
		canvas.style.display = fx ? "block" : "none";
		canvas.style.opacity = fx && fx.opacity ? fx.opacity : "";
		if (fx) {
			resize();
			seed();
			startLoop();
		}
	}

	function buildPicker(container, selectedId, onPick) {
		var root = container && container.jquery ? container[0] : container;
		if (!root) return;
		root.innerHTML = "";
		root.setAttribute("role", "radiogroup");
		root.setAttribute("aria-label", "Room theme");
		var sel = BY_ID[selectedId] ? selectedId : "classic";
		THEMES.forEach(function (t) {
			var b = document.createElement("button");
			b.type = "button";
			b.className = "room-theme-card" + (t.id === sel ? " selected" : "");
			b.setAttribute("role", "radio");
			b.setAttribute("aria-checked", t.id === sel ? "true" : "false");
			b.setAttribute("data-theme", t.id);
			b.title = t.desc;
			var sw = document.createElement("span");
			sw.className = "room-theme-swatch";
			sw.style.background = t.bg;
			sw.textContent = t.icon;
			var nm = document.createElement("span");
			nm.className = "room-theme-name";
			nm.textContent = t.name;
			if (t.interactive) {
				var tag = document.createElement("span");
				tag.className = "room-theme-tag";
				tag.textContent = "Interactive";
				sw.appendChild(tag);
			}
			b.appendChild(sw); b.appendChild(nm);
			b.addEventListener("click", function () {
				var cards = root.querySelectorAll(".room-theme-card");
				for (var i = 0; i < cards.length; i++) {
					cards[i].classList.remove("selected");
					cards[i].setAttribute("aria-checked", "false");
				}
				b.classList.add("selected");
				b.setAttribute("aria-checked", "true");
				if (onPick) onPick(t.id);
			});
			root.appendChild(b);
		});
	}

	global.RoomThemes = {
		list: THEMES,
		has: function (id) { return !!BY_ID[id] && id !== "classic"; },
		get: function (id) { return BY_ID[id] || null; },
		apply: apply,
		current: function () { return current; },
		buildPicker: buildPicker
	};
})(window);
