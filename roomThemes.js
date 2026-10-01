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
	// rand/pick normally use Math.random; withSeed() swaps in a seeded
	// generator so every user builds the exact same particle layout.
	var rng = Math.random;
	function rand(a, b) { return a + rng() * (b - a); }
	function pick(arr) { return arr[(rng() * arr.length) | 0]; }

	// ── Room sync helpers ───────────────────────────────────────────────
	// Ambient effects are pure functions of a clock shared by the whole room
	// (server time) and a seeded generator, so everyone sees the same flake
	// in the same spot at the same moment (scaled to their own screen).
	function mulberry(seed) {
		var s = seed >>> 0;
		return function () {
			s = (s + 0x6D2B79F5) | 0;
			var t = Math.imul(s ^ (s >>> 15), 1 | s);
			t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
			return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
		};
	}
	function hashInts(a, b, c) {
		var h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(c | 0, 0x9e3779b1);
		h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
		h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
		return (h ^ (h >>> 16)) >>> 0;
	}
	function hashStr(s) {
		var h = 2166136261;
		for (var i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
		return h >>> 0;
	}
	function withSeed(seed, fn) {
		var prev = rng;
		rng = mulberry(seed);
		try { return fn(); } finally { rng = prev; }
	}
	// Seconds on the room's shared clock (MPP server time), kept small so
	// sin(t * k) stays precise.
	var EPOCH_MS = 1767225600000;   // 2026-01-01
	function roomSec() {
		var cl = global.gClient, off = cl && isFinite(cl.serverTimeOffset) ? cl.serverTimeOffset : 0;
		return (Date.now() + off - EPOCH_MS) / 1000;
	}

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
			bottom: "#071a1d", fx: "vortex" },
		{ id: "fireworks", name: "Fireworks Night", icon: "🎆", interactive: true,
			desc: "Click to launch fireworks — your cursor trails golden sparks",
			bg: "linear-gradient(180deg, #050816 0%, #0d1236 55%, #1c1a3f 100%)",
			bottom: "#0b0f2a", fx: "fireworks" },
		{ id: "pond", name: "Moonlit Pond", icon: "🪷", interactive: true,
			desc: "Ripple the water and nudge the lily pads",
			bg: "radial-gradient(ellipse at 70% 15%, #2a4a6b 0%, #0f2438 45%, #06121e 100%)",
			bottom: "#0a1c2c", fx: "pond" },
		{ id: "storm", name: "Thunderstorm", icon: "⚡", interactive: true,
			desc: "Your cursor crackles with plasma — click to call down lightning",
			bg: "linear-gradient(180deg, #0d1020 0%, #1b2140 50%, #2a2f4a 100%)",
			bottom: "#121628", fx: "storm" },
		{ id: "butterflies", name: "Butterfly Garden", icon: "🦋", interactive: true,
			desc: "Butterflies follow your cursor — click to make them scatter",
			bg: "linear-gradient(170deg, #12352a 0%, #2c6b4a 55%, #7fb36a 100%)",
			bottom: "#163d2f", fx: "butterflies" },
		{ id: "kaleido", name: "Kaleidoscope", icon: "🔮", interactive: true,
			desc: "Draw mirrored rainbow patterns — click for a mandala bloom",
			bg: "radial-gradient(ellipse at center, #1a0f2e 0%, #0b0618 60%, #030208 100%)",
			bottom: "#100a20", fx: "kaleido" }
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
	// The local mouse/finger plus every other user's pointer, so everyone's
	// movement and clicks show up in the whole room's background.
	//
	// Pointers travel over the Harmony relay (no rate limit) as
	//   RT|m|<pid>|<x>|<y>   move (throttled) + a heartbeat while idle
	//   RT|c|<pid>|<x>|<y>   click / tap
	//   RT|l|<pid>           pointer left the window / finger lifted
	// with x, y as fractions of the sender's window. Users the relay can't
	// reach (vanilla MPP) still show up through their MPP cursor ("m").
	var SYNC_PREFIX = "RT|";
	var SEND_MS = 40, BEAT_MS = 2000;
	var RELAY_STALE_MS = 6500, MPP_STALE_MS = 30000, RELAY_PEER_MS = 60000;
	var ptr = { id: "me", x: 0, y: 0, t: 0, inside: false };
	var remotes = {};          // participant id -> { id, x, y (smoothed px), nx, ny, t, relay }
	var relayPeers = {};       // participant id -> last relay message (their MPP "m" is then ignored)
	var clickQueue = [];       // clicks (local + remote) not yet seen by the effect
	var livePtrs = [], clicks = [];   // snapshot for the current frame
	var sendTimer = 0, lastSent = 0, announced = false;

	function now() { return global.performance ? performance.now() : Date.now(); }
	function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
	function frac(v) { return clamp(v, -0.05, 1.05).toFixed(4); }

	function myId() {
		var cl = global.gClient;
		return cl && cl.participantId ? String(cl.participantId) : "";
	}
	function canSync() {
		return !!(fx && fx.pointer && myId() && global.gClient && typeof global.gClient.broadcastRoom === "function");
	}
	function sendPtr(kind, x, y) {
		if (!canSync()) return false;
		var text = SYNC_PREFIX + kind + "|" + myId();
		if (kind !== "l") text += "|" + frac(x / global.innerWidth) + "|" + frac(y / global.innerHeight);
		try { return !!global.gClient.broadcastRoom(text); } catch (e) { return false; }
	}
	function flushMove() {
		clearTimeout(sendTimer); sendTimer = 0;
		if (!ptr.inside) return;
		lastSent = Date.now();
		if (sendPtr("m", ptr.x, ptr.y)) announced = true;
	}
	function queueMove() {
		if (!canSync()) return;
		var wait = SEND_MS - (Date.now() - lastSent);
		if (wait <= 0) flushMove();
		else if (!sendTimer) sendTimer = setTimeout(flushMove, wait);
	}
	function pointerGone() {
		ptr.inside = false;
		clearTimeout(sendTimer); sendTimer = 0;
		if (announced) { announced = false; sendPtr("l"); }
	}

	function pushClick(x, y) {
		clickQueue.push({ x: x, y: y });
		if (clickQueue.length > 16) clickQueue.shift();
	}

	function trackPointer() {
		function move(e) {
			ptr.x = e.clientX; ptr.y = e.clientY; ptr.t = now(); ptr.inside = true;
		}
		global.addEventListener("pointermove", function (e) { move(e); queueMove(); }, { passive: true });
		global.addEventListener("pointerdown", function (e) {
			move(e);
			if (fx && fx.pointer) {
				pushClick(e.clientX, e.clientY);
				lastSent = Date.now();
				if (sendPtr("c", e.clientX, e.clientY)) announced = true;
			}
		}, { passive: true });
		global.addEventListener("pointerup", function (e) {
			if (e.pointerType === "touch") pointerGone();      // finger lifted
		}, { passive: true });
		global.addEventListener("pointercancel", function (e) {
			if (e.pointerType === "touch") pointerGone();
		}, { passive: true });
		document.addEventListener("mouseout", function (e) {
			if (!e.relatedTarget) pointerGone();               // left the window
		});
		global.addEventListener("blur", pointerGone);
		global.addEventListener("pagehide", pointerGone);
		document.addEventListener("visibilitychange", function () { if (document.hidden) pointerGone(); });
		// Heartbeat: a resting cursor keeps showing for everyone, and people
		// who join later pick it up within a couple of seconds.
		setInterval(function () {
			if (ptr.inside && canSync() && Date.now() - lastSent > BEAT_MS * 0.8) flushMove();
		}, BEAT_MS);
	}

	function touchRemote(id, nx, ny, relay) {
		var r = remotes[id], t = now();
		if (!r) r = remotes[id] = { id: id, x: nx * W, y: ny * H };   // first sighting: no glide in
		r.nx = nx; r.ny = ny; r.t = t;
		if (relay) { r.relay = true; relayPeers[id] = t; }
		return r;
	}

	function isSyncText(text) {
		return typeof text === "string" && text.indexOf(SYNC_PREFIX) === 0;
	}

	// Relay message from script.js's routeRoomSync: { message, p }.
	function handleSync(msg) {
		var text = msg && (msg.message != null ? msg.message : msg.a);
		if (!isSyncText(text)) return false;
		var a = text.slice(SYNC_PREFIX.length).split("|"), kind = a[0], id = a[1];
		if (!id || id === myId()) return true;
		if (kind === "l") {
			delete remotes[id];
			relayPeers[id] = now();
			return true;
		}
		if (kind !== "m" && kind !== "c") return true;
		var nx = parseFloat(a[2]), ny = parseFloat(a[3]);
		if (!isFinite(nx) || !isFinite(ny)) return true;
		nx = clamp(nx, -0.05, 1.05); ny = clamp(ny, -0.05, 1.05);
		var r = touchRemote(id, nx, ny, true);
		if (kind === "c") {
			r.x = nx * W; r.y = ny * H;   // the burst and the cursor line up exactly
			if (fx && fx.pointer) pushClick(r.x, r.y);
		}
		return true;
	}

	var hookedClient = null;
	function hookClient() {
		var cl = global.gClient;
		if (!cl || !cl.on || hookedClient === cl) return;
		hookedClient = cl;
		cl.on("m", function (msg) {
			if (!msg || msg.id == null || String(msg.id) === myId()) return;
			var id = String(msg.id);
			if (relayPeers[id] && now() - relayPeers[id] < RELAY_PEER_MS) return;   // relay is faster & exact
			var x = parseFloat(msg.x), y = parseFloat(msg.y);
			if (!isFinite(x) || !isFinite(y)) return;
			touchRemote(id, clamp(x / 100, -0.05, 1.05), clamp(y / 100, -0.05, 1.05), false);
		});
		cl.on("participant removed", function (p) {
			if (p) { delete remotes[p.id]; delete relayPeers[p.id]; }
		});
	}

	function collectPointers(dt) {
		var out = [], tnow = now(), ease = Math.min(1, dt * 22);
		if (ptr.inside && ptr.t) out.push(ptr);
		for (var id in remotes) {
			var r = remotes[id];
			if (tnow - r.t > (r.relay ? RELAY_STALE_MS : MPP_STALE_MS)) { delete remotes[id]; continue; }
			// glide toward the latest position so remote trails are smooth
			r.x += (r.nx * W - r.x) * ease; r.y += (r.ny * H - r.y) * ease;
			out.push(r);
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
	// density = particle count at 1920×1080.
	//
	// Room-synced ("cycle") effects are pure functions of the shared room
	// clock t, so every user sees the same picture: setup(p) picks a
	// particle's fixed traits and its cycle length p.per (seconds; omit for
	// particles that never respawn), spawn(p) re-rolls it for each new cycle,
	// at(p, age, t, w, h) places it `age` seconds into the cycle. Both run
	// under a seeded generator, so rand()/pick() give everyone the same values.
	// Positions are fractions of the screen, so different window sizes show
	// the same scene scaled.
	//
	// Stateful effects instead use init(p, w, h, first) / update (returns
	// false to respawn). frame() draws non-particle extras; trail fades the
	// previous frame instead of clearing it.
	function wrapX(x, w) { var span = w + 60; return (((x + 30) % span) + span) % span - 30; }

	var FX = {
		snow: {
			density: 160, cycle: true,
			setup: function (p) {
				p.r = Math.pow(rand(0, 1), 2.2) * 3.4 + 0.7;
				p.per = 1120 / (16 + p.r * 13);
			},
			spawn: function (p) {
				p.nx = rand(0, 1);
				p.sw = rand(0.3, 1.2); p.ph = rand(0, TAU); p.amp = rand(6, 26);
				p.a = rand(0.45, 0.95); p.rot0 = rand(0, TAU);
			},
			at: function (p, age, t, w, h) {
				p.y = -30 + (h + 40) * age / p.per;
				p.x = wrapX(p.nx * w + age * 10 * w / 1920, w) + Math.sin(t * p.sw + p.ph) * p.amp;
				p.rot = p.rot0 + age * 0.4;
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
			density: 220, cycle: true,
			setup: function (p) {
				p.nx = rand(0, 1); p.ny = rand(0, 1);
				p.r = Math.pow(rand(0, 1), 3) * 1.5 + 0.35;
				p.base = rand(0.35, 1); p.sp = rand(0.6, 2.6); p.ph = rand(0, TAU);
				p.col = pick(["#ffffff", "#ffffff", "#cfe3ff", "#ffeacc", "#e6d4ff"]);
			},
			at: function (p, age, t, w, h, o) {
				var nx = p.nx;
				if (o.drift) nx = ((nx - t * o.drift * (0.3 + p.r) / 1920) % 1 + 1) % 1;
				p.x = nx * (w + 8) - 4; p.y = p.ny * h;
			},
			draw: function (c, p, t) {
				var n = p.near || 0, a = Math.min(1, p.base * (0.55 + 0.45 * Math.sin(t * p.sp + p.ph)) + n * 0.8);
				var r = p.r * (1 + n * 1.2);   // stars light up near a cursor
				c.globalAlpha = a;
				c.fillStyle = p.col;
				c.beginPath(); c.arc(p.x, p.y, r, 0, TAU); c.fill();
				if (r > 1.35) {   // a soft cross on the brightest stars
					c.globalAlpha = a * 0.5;
					c.fillRect(p.x - r * 3, p.y - 0.5, r * 6, 1);
					c.fillRect(p.x - 0.5, p.y - r * 3, 1, r * 6);
				}
			},
			// Shooting stars: each 5.5 s slot of the room clock may hold one,
			// with its start, path and length derived from the slot number.
			frame: function (c, dt, w, h, t, S, o) {
				if (!o.shooting) return;
				var SLOT = 5.5, k = Math.floor(t / SLOT);
				for (var j = k - 1; j <= k; j++) {   // a streak can run past its slot
					var R = mulberry(hashInts(seedBase, 7777, j));
					if (R() > 0.7) continue;
					var start = j * SLOT + R() * (SLOT - 1.2), max = 0.6 + R() * 0.5, life = t - start;
					if (life < 0 || life > max) continue;
					var ang = 0.35 + R() * 0.25, vx = Math.cos(ang) * 900, vy = Math.sin(ang) * 900;
					var x = (0.1 + R() * 0.7) * w + vx * life, y = R() * 0.35 * h + vy * life;
					var fade = 1 - life / max, tail = 0.14, tx = x - vx * tail, ty = y - vy * tail;
					var g = c.createLinearGradient(x, y, tx, ty);
					g.addColorStop(0, "rgba(255,255,255," + fade.toFixed(3) + ")");
					g.addColorStop(1, "rgba(255,255,255,0)");
					c.globalAlpha = 1;
					c.strokeStyle = g; c.lineWidth = 2; c.lineCap = "round";
					c.beginPath(); c.moveTo(x, y); c.lineTo(tx, ty); c.stroke();
				}
			}
		},

		petals: {
			density: 70, cycle: true,
			setup: function (p) { p.vy = rand(28, 55); p.per = 1140 / p.vy; },
			spawn: function (p) {
				p.nx = rand(0, 1);
				p.s = rand(5, 10); p.vx = rand(18, 45);
				p.rot0 = rand(0, TAU); p.vr = rand(-1.6, 1.6);
				p.fs = rand(1.5, 3.5); p.ph = rand(0, TAU); p.a = rand(0.7, 0.95);
				p.col = pick(["#ffd1dc", "#ffb7c9", "#ffc8d6", "#ffe4ea", "#f9a8c0"]);
			},
			at: function (p, age, t, w, h) {
				p.y = -40 + (h + 60) * age / p.per;
				p.x = wrapX(p.nx * w + p.vx * age * w / 1920 + Math.sin(t * 0.8 + p.ph) * 25, w);
				p.rot = p.rot0 + p.vr * age;
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
			density: 45, cycle: true,
			setup: function (p) { p.vy = rand(35, 70); p.per = 1130 / p.vy; },
			spawn: function (p) {
				p.nx = rand(0, 1); p.s = rand(9, 16);
				p.sw = rand(0.6, 1.4); p.ph = rand(0, TAU); p.amp = rand(30, 70);
				p.rot0 = rand(0, TAU); p.vr = rand(-2.2, 2.2); p.fs = rand(1, 2.5);
				p.col = pick(["#d9541e", "#e8892b", "#c0392b", "#f2b134", "#a0522d", "#e67e22"]);
			},
			at: function (p, age, t, w, h) {
				p.y = -50 + (h + 80) * age / p.per;
				p.x = wrapX(p.nx * w + age * 14 * w / 1920, w) + Math.sin(t * p.sw + p.ph) * p.amp;
				p.rot = p.rot0 + p.vr * age;
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
			density: 60, cycle: true,
			setup: function (p) {
				p.r = Math.pow(rand(0, 1), 1.8) * 9 + 2;
				p.per = 1140 / (22 + p.r * 5);
			},
			spawn: function (p) { p.nx = rand(0, 1); p.ph = rand(0, TAU); p.sw = rand(1, 2.5); },
			at: function (p, age, t, w, h) {
				p.y = h + 60 - (h + 80) * age / p.per;
				p.x = p.nx * w + Math.sin(t * p.sw + p.ph) * p.r * 0.9;
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

		// Fireflies wander on smooth looping paths (instead of a random walk)
		// so their flight is the same for everyone.
		fireflies: {
			density: 45, blend: "lighter", cycle: true,
			setup: function (p) {
				p.nx = rand(0.05, 0.95); p.ny = rand(0.2, 0.95);
				p.f1 = rand(0.04, 0.12); p.f2 = rand(0.05, 0.14); p.p1 = rand(0, TAU); p.p2 = rand(0, TAU);
				p.ax = rand(50, 150); p.ay = rand(30, 90);
				p.ps = rand(0.8, 2); p.ph = rand(0, TAU); p.s = rand(22, 40);
			},
			at: function (p, age, t, w, h) {
				p.x = p.nx * w + Math.sin(t * p.f1 + p.p1) * p.ax + Math.sin(t * p.f2 * 2.3 + p.p2) * p.ax * 0.35;
				p.y = p.ny * h + Math.cos(t * p.f2 + p.p2) * p.ay + Math.sin(t * 1.3 + p.ph) * 4;
			},
			draw: function (c, p, t) {
				var a = Math.max(0, Math.sin(t * p.ps + p.ph));
				a = Math.min(1, 0.15 + 0.85 * a * a + (p.near || 0));   // glow steady near a cursor
				var s = p.s * (1 + (p.near || 0) * 0.6);
				c.globalAlpha = a;
				c.drawImage(glow("rgba(215,255,120,0.9)"), p.x - s / 2, p.y - s / 2, s, s);
				c.fillStyle = "#fbffd0";
				c.beginPath(); c.arc(p.x, p.y, 1.8, 0, TAU); c.fill();
			}
		},

		rain: {
			density: 240, cycle: true,
			setup: function (p) { p.v = rand(550, 850); p.per = (1.3 * 1080 + 40) / p.v; },
			spawn: function (p) { p.nx = rand(0, 1); p.len = rand(10, 24); },
			at: function (p, age, t, w, h) {
				var fall = (1.3 * h + 40) * age / p.per;
				p.y = -0.3 * h + fall;
				p.x = p.nx * (w + 100) - 100 + fall * 0.15;
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
			density: 110, blend: "lighter", cycle: true,
			setup: function (p) { p.per = p.life = rand(3, 7); p.vy = rand(30, 95); },
			spawn: function (p) {
				p.nx = rand(0, 1); p.vx = rand(-12, 12);
				p.s = rand(12, 26); p.ph = rand(0, TAU);
				p.col = pick(["rgba(255,170,60,0.95)", "rgba(255,120,30,0.95)", "rgba(255,210,110,0.95)"]);
			},
			at: function (p, age, t, w, h) {
				p.age = age;
				p.y = h + 10 - p.vy * age * h / 1080;
				p.x = p.nx * w + p.vx * age + Math.sin(t * 2 + p.ph) * 9;
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
			density: 40, cycle: true,
			setup: function (p) { p.vy = rand(25, 55); p.per = 1130 / p.vy; },
			spawn: function (p) {
				p.nx = rand(0, 1); p.s = rand(8, 20);
				p.ph = rand(0, TAU); p.sw = rand(0.6, 1.4); p.amp = rand(10, 30);
				p.rot = rand(-0.3, 0.3); p.a = rand(0.5, 0.9);
				p.col = pick(["#ff4d6d", "#ff758f", "#ff8fab", "#ffb3c6", "#e5383b", "#ffffff"]);
			},
			at: function (p, age, t, w, h) {
				p.y = h + 50 - (h + 80) * age / p.per;
				p.x = p.nx * w + Math.sin(t * p.sw + p.ph) * p.amp;
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
			density: 110, cycle: true,
			setup: function (p) { p.vy = rand(60, 130); p.per = 1140 / p.vy; },
			spawn: function (p) {
				p.nx = rand(0, 1); p.w = rand(5, 10); p.h = rand(3, 6); p.vx = rand(-20, 20);
				p.rot0 = rand(0, TAU); p.vr = rand(-5, 5); p.fs = rand(3, 8); p.ph = rand(0, TAU);
				p.col = pick(["#ff595e", "#ffca3a", "#8ac926", "#1982c4", "#6a4c93", "#ff9f1c", "#2ec4b6", "#ffffff"]);
			},
			at: function (p, age, t, w, h) {
				p.y = -40 + (h + 60) * age / p.per;
				p.x = wrapX(p.nx * w + p.vx * age, w) + Math.sin(t * 2 + p.ph) * 12;
				p.rot = p.rot0 + p.vr * age;
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
			density: 70, blend: "lighter", cycle: true,
			setup: function (p) { p.vy = rand(10, 30); p.per = 1130 / p.vy; },
			spawn: function (p) {
				p.nx = rand(0, 1); p.s = rand(3, 8);
				p.ps = rand(1.5, 4); p.ph = rand(0, TAU);
				p.col = pick(["#fff4c2", "#ffd6ff", "#d9c2ff", "#c2f0ff", "#ffffff"]);
			},
			at: function (p, age, t, w, h) {
				p.y = h + 30 - (h + 50) * age / p.per;
				p.x = p.nx * w + Math.sin(t * 0.7 + p.ph) * 14;
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

		// Each column's drop runs on the room clock: its speed, pause and
		// glyphs come from hashes of the column and cycle number.
		matrix: {
			density: 0, trail: 0.06, opacity: 0.6,
			frame: function (c, dt, w, h, t, S) {
				var fs = 16, cols = Math.ceil(w / fs), rows = Math.ceil(h / fs) + 1;
				if (!S.last || S.cols !== cols) { S.cols = cols; S.last = []; }
				var glyphs = "アイウエオカキクケコサシスセソタチツテトナニヌネノ0123456789ハヒフヘホマミムメモ";
				c.font = fs + "px monospace";
				c.textBaseline = "top";
				c.globalAlpha = 1;
				for (var j = 0; j < cols; j++) {
					var R = mulberry(hashInts(seedBase, j, 0));
					var v = 8 + R() * 10, span = rows + 20 + R() * 30, per = span / v;
					var u = t + R() * per, gen = Math.floor(u / per), head = Math.floor((u - gen * per) * v) - 10;
					var L = S.last[j];
					if (!L) L = S.last[j] = { gen: gen, row: head };
					else if (L.gen !== gen) { L.gen = gen; L.row = -11; }
					if (hashInts(seedBase, j, gen + 1) % 100 >= 62) { L.row = head; continue; }   // resting column
					for (var r = Math.max(L.row + 1, head - 40); r <= head; r++) {
						if (r < 0 || r > rows) continue;
						var hsh = hashInts(j, r, gen);
						c.fillStyle = hsh % 10 === 0 ? "#e8ffe8" : "#3dff7a";
						c.fillText(glyphs.charAt((hsh >>> 4) % glyphs.length), j * fs, r * fs);
					}
					L.row = head;
				}
			}
		},

		grid: {
			density: 0,
			frame: function (c, dt, w, h, t) {
				var hz = h * 0.62, depth = h - hz, cx = w / 2;
				var off = ((t * 0.35) % 1 + 1) % 1;
				c.globalAlpha = 1;
				c.lineWidth = 1.5;
				c.shadowColor = "#ff4fd8"; c.shadowBlur = 8;
				// horizontal lines, spaced by perspective, scrolling toward the viewer
				var n = 14;
				for (var i = 0; i < n; i++) {
					var k = (i + off) / n, y = hz + depth * k * k;
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
					withSeed(seedBase, function () {   // same starting field for everyone
						for (i = 0, j = scaledCount(80); i < j; i++)
							S.dots.push({ x: rand(0, w), y: rand(0, h), bx: rand(-14, 14), by: rand(-14, 14), vx: 0, vy: 0, r: rand(1.2, 2.4), col: "#8cc8ff" });
					});
				}
				var dots = S.dots, trail = S.trail, R = 190, RING = 70;
				S.hue = (200 + t * 40) % 360;   // room clock: trail colors match for everyone
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
				S.hue = (t * 120) % 360;
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
					S.g = []; S.rip = []; S.slot = Math.floor(t / 3.5);
					for (j = 0; j < rows; j++)
						for (i = 0; i < cols; i++)
							S.g.push({ hx: x0 + i * sp, hy: y0 + j * sp, ox: 0, oy: 0, vx: 0, vy: 0 });
				}
				var rip = S.rip, RSPEED = 380, RLIFE = 1.8, R = 120, R2 = R * R;
				for (i = 0; i < clicks.length; i++) rip.push({ x: clicks[i].x, y: clicks[i].y, age: 0, s: 2600 });
				eachMove(S, livePtrs, 220, function (x, y) { rip.push({ x: x, y: y, age: 0, s: 700 }); });
				var slot = Math.floor(t / 3.5);
				if (slot !== S.slot) {   // ambient drops when nobody is around, placed by the room clock
					S.slot = slot;
					var RD = mulberry(hashInts(seedBase, 4242, slot));
					if (!livePtrs.length) rip.push({ x: (0.15 + RD() * 0.7) * w, y: (0.15 + RD() * 0.7) * h, age: 0, s: 1800 });
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
		},

		// Rockets fly up and burst into streaking sparks. Clicks launch one
		// at the click point; the room clock launches the same ambient show
		// for everyone. Moving leaves a trail of golden sparks.
		fireworks: {
			density: 0, pointer: true, trail: 0.2,
			frame: function (c, dt, w, h, t, S) {
				var rockets = S.rockets || (S.rockets = []), sparks = S.sparks || (S.sparks = []), i, j, p;
				function launch(x1, y1, hue, R) {
					rockets.push({ x0: x1 + (R() - 0.5) * w * 0.15, y0: h + 10, x1: x1, y1: y1, age: 0,
						dur: 0.7 + R() * 0.35, hue: hue, ring: R() < 0.3 });
				}
				var slot = Math.floor(t / 1.4);
				if (S.slot == null) S.slot = slot;
				else if (slot !== S.slot) {
					S.slot = slot;
					var R = mulberry(hashInts(seedBase, 5150, slot));
					if (R() < 0.8) launch((0.12 + R() * 0.76) * w, (0.12 + R() * 0.33) * h, R() * 360 | 0, R);
				}
				for (i = 0; i < clicks.length; i++) launch(clicks[i].x, clicks[i].y, Math.random() * 360 | 0, Math.random);
				eachMove(S, livePtrs, 16, function (x, y, ux, uy) {
					sparks.push({ x: x, y: y, vx: rand(-30, 30) - ux * 40, vy: rand(-30, 20) - uy * 40,
						age: 0, max: rand(0.4, 0.9), hue: rand(35, 50) | 0, w: 1.4 });
				});

				c.globalCompositeOperation = "lighter";
				c.lineCap = "round";
				for (i = rockets.length - 1; i >= 0; i--) {
					p = rockets[i];
					p.age += dt;
					var k = Math.min(1, p.age / p.dur), e = 1 - Math.pow(1 - k, 2.2);
					var x = p.x0 + (p.x1 - p.x0) * e, y = p.y0 + (p.y1 - p.y0) * e;
					if (p.px != null) {
						c.globalAlpha = 0.9;
						c.strokeStyle = "hsl(" + p.hue + ",100%,80%)"; c.lineWidth = 2;
						c.beginPath(); c.moveTo(p.px, p.py); c.lineTo(x, y); c.stroke();
					}
					p.px = x; p.py = y;
					if (k < 1) continue;
					rockets.splice(i, 1);
					c.globalAlpha = 0.8;
					c.drawImage(glow("rgba(255,240,220,0.9)"), x - 80, y - 80, 160, 160);
					for (j = 0; j < 70; j++) {
						var a = p.ring ? j / 70 * TAU : rand(0, TAU), v = p.ring ? 230 : rand(40, 260);
						sparks.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, age: 0, max: rand(1.1, 1.9),
							hue: (p.hue + rand(-20, 20) + 360) % 360 | 0, w: 1.8, tw: Math.random() < 0.25 });
					}
				}
				if (sparks.length > 1400) sparks.splice(0, sparks.length - 1400);
				var drag = Math.pow(0.28, dt);
				for (i = sparks.length - 1; i >= 0; i--) {
					p = sparks[i];
					p.age += dt;
					if (p.age >= p.max) { sparks.splice(i, 1); continue; }
					var px = p.x, py = p.y, f = 1 - p.age / p.max;
					p.vx *= drag; p.vy = p.vy * drag + 90 * dt;
					p.x += p.vx * dt; p.y += p.vy * dt;
					c.globalAlpha = p.tw ? f * (0.4 + 0.6 * Math.abs(Math.sin(p.age * 30))) : f;
					c.strokeStyle = "hsl(" + p.hue + ",100%,68%)"; c.lineWidth = p.w;
					c.beginPath(); c.moveTo(px, py); c.lineTo(p.x + 0.1, p.y); c.stroke();
				}
				c.globalCompositeOperation = "source-over";
			}
		},

		// A still pond under the moon: moving draws ripples, clicks drop a
		// stone, rain drops fall on the room clock, and lily pads bob on
		// springs that cursors and ripples push around.
		pond: {
			density: 0, pointer: true,
			frame: function (c, dt, w, h, t, S) {
				var rings = S.rings || (S.rings = []), i, j, r, p, dx, dy, d;
				if (!S.pads) {
					S.pads = [];
					withSeed(seedBase, function () {
						for (i = 0, j = isSmallScreen() ? 6 : 10; i < j; i++)
							S.pads.push({ hx: rand(0.05, 0.95) * w, hy: rand(0.3, 0.95) * h, r: rand(16, 32), rot: rand(0, TAU),
								ox: 0, oy: 0, vx: 0, vy: 0, flower: rand(0, 1) < 0.35, bob: rand(0, TAU) });
					});
				}
				function drop(x, y, sp, n, a) {
					for (var k = 0; k < n; k++) rings.push({ x: x, y: y, age: -k * 0.22, max: 2.6, sp: sp, a: a * (1 - k * 0.2) });
				}
				for (i = 0; i < clicks.length; i++) drop(clicks[i].x, clicks[i].y, 95, 3, 1);
				eachMove(S, livePtrs, 38, function (x, y) { drop(x, y, 55, 1, 0.55); });
				var slot = Math.floor(t / 0.8);
				if (slot !== S.slot) {   // rain drops placed by the room clock
					S.slot = slot;
					var RD = mulberry(hashInts(seedBase, 6060, slot));
					if (RD() < 0.7) drop(RD() * w, (0.2 + RD() * 0.8) * h, 60, 2, 0.7);
				}
				if (rings.length > 60) rings.splice(0, rings.length - 60);

				// moonlight shimmering on the water
				c.fillStyle = "#dfefff";
				for (i = 0; i < 14; i++) {
					var ww = (60 - i * 2.5) * (0.7 + 0.3 * Math.sin(t * 1.7 + i * 1.3));
					c.globalAlpha = 0.1 + 0.08 * Math.sin(t * 2.3 + i);
					c.fillRect(w * 0.7 - ww / 2 + Math.sin(t * 1.1 + i * 0.9) * 8, h * 0.3 + i * h * 0.045, ww, 2);
				}

				c.strokeStyle = "#cfe8ff";
				c.lineWidth = 1.5;
				for (i = rings.length - 1; i >= 0; i--) {
					r = rings[i];
					r.age += dt;
					if (r.age >= r.max) { rings.splice(i, 1); continue; }
					if (r.age < 0) continue;
					var rad = 3 + r.age * r.sp, f = 1 - r.age / r.max;
					c.globalAlpha = f * f * 0.8 * r.a;
					c.beginPath(); c.ellipse(r.x, r.y, rad, rad * 0.5, 0, 0, TAU); c.stroke();
					c.globalAlpha *= 0.4;
					c.beginPath(); c.ellipse(r.x, r.y, rad * 0.75, rad * 0.375, 0, 0, TAU); c.stroke();
				}

				for (i = 0; i < S.pads.length; i++) {
					p = S.pads[i];
					var x = p.hx + p.ox, y = p.hy + p.oy, fx_ = -8 * p.ox - 3.5 * p.vx, fy_ = -8 * p.oy - 3.5 * p.vy;
					for (j = 0; j < livePtrs.length; j++) {
						dx = x - livePtrs[j].x; dy = y - livePtrs[j].y; d = Math.sqrt(dx * dx + dy * dy) + 0.01;
						if (d < 130) { var k = 1 - d / 130; fx_ += dx / d * k * k * 2600; fy_ += dy / d * k * k * 2600; }
					}
					for (j = 0; j < rings.length; j++) {
						r = rings[j];
						if (r.age < 0) continue;
						dx = x - r.x; dy = (y - r.y) * 2; d = Math.sqrt(dx * dx + dy * dy) + 0.01;
						var band = Math.abs(d - (3 + r.age * r.sp));
						if (band < 25) { var s = (1 - band / 25) * (1 - r.age / r.max) * 600 * r.a; fx_ += dx / d * s; fy_ += dy / d * s * 0.5; }
					}
					p.vx += fx_ * dt; p.vy += fy_ * dt;
					p.ox += p.vx * dt; p.oy += p.vy * dt;
					p.rot += p.vx * 0.004 * dt;
					x = p.hx + p.ox; y = p.hy + p.oy + Math.sin(t * 0.8 + p.bob) * 2;
					c.save();
					c.translate(x, y); c.scale(1, 0.62); c.rotate(p.rot);
					c.globalAlpha = 0.95;
					c.fillStyle = "#1f6b45";
					c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, p.r, 0.25, TAU - 0.05); c.closePath(); c.fill();
					c.strokeStyle = "rgba(150,220,160,0.35)"; c.lineWidth = 1;
					c.beginPath();
					for (j = 0; j < 5; j++) { c.moveTo(0, 0); c.lineTo(Math.cos(0.9 + j * 1.15) * p.r * 0.85, Math.sin(0.9 + j * 1.15) * p.r * 0.85); }
					c.stroke();
					c.restore();
					if (p.flower) {
						c.fillStyle = "#ffb7d5";
						for (j = 0; j < 6; j++) {
							var pa = j / 6 * TAU + t * 0.1;
							c.beginPath(); c.ellipse(x + Math.cos(pa) * 4, y - 4 + Math.sin(pa) * 2.5, 4.5, 2.6, pa, 0, TAU); c.fill();
						}
						c.fillStyle = "#ffe27a";
						c.beginPath(); c.arc(x, y - 4, 2.2, 0, TAU); c.fill();
					}
				}
			}
		},

		// Every cursor is a crackling plasma orb (cursors close together arc
		// to each other); clicks call down lightning with a sky flash, and
		// the room clock throws the same ambient strikes for everyone.
		storm: {
			density: 0, pointer: true,
			frame: function (c, dt, w, h, t, S) {
				var bolts = S.bolts || (S.bolts = []), i, j, k, P;
				var slot = Math.floor(t / 3.2);
				if (S.slot == null) S.slot = slot;
				else if (slot !== S.slot) {
					S.slot = slot;
					var R = mulberry(hashInts(seedBase, 3131, slot));
					if (R() < 0.6) {
						var bx = (0.1 + R() * 0.8) * w;
						bolts.push({ segs: makeBolt(R, bx + (R() - 0.5) * 200, -10, bx, (0.45 + R() * 0.4) * h), age: 0, max: 0.55 });
						S.flash = 0.6;
					}
				}
				for (i = 0; i < clicks.length; i++) {
					bolts.push({ segs: makeBolt(Math.random, clicks[i].x + rand(-160, 160), -10, clicks[i].x, clicks[i].y),
						age: 0, max: 0.6, hit: clicks[i] });
					S.flash = 1;
				}
				if (bolts.length > 8) bolts.splice(0, bolts.length - 8);
				S.flash = Math.max(0, (S.flash || 0) - dt * 2.8);
				if (S.flash > 0) {
					c.globalAlpha = S.flash * 0.22;
					c.fillStyle = "#c8d4ff";
					c.fillRect(0, 0, w, h);
				}

				c.globalCompositeOperation = "lighter";
				c.lineCap = "round"; c.lineJoin = "round";
				for (i = bolts.length - 1; i >= 0; i--) {
					var b = bolts[i];
					b.age += dt;
					if (b.age >= b.max) { bolts.splice(i, 1); continue; }
					var f = (1 - b.age / b.max) * (0.65 + 0.35 * Math.sin(b.age * 70));
					for (var pass = 0; pass < 2; pass++) {   // wide blue glow, then a white core
						c.strokeStyle = pass ? "#ffffff" : "#8fa8ff";
						c.lineWidth = pass ? 1.6 : 7;
						for (j = 0; j < b.segs.length; j++) {
							var pts = b.segs[j];
							c.globalAlpha = f * (pass ? 1 : 0.3) * (j ? 0.6 : 1);
							c.beginPath(); c.moveTo(pts[0].x, pts[0].y);
							for (k = 1; k < pts.length; k++) c.lineTo(pts[k].x, pts[k].y);
							c.stroke();
						}
					}
					if (b.hit) {
						c.globalAlpha = f;
						c.drawImage(glow("rgba(170,195,255,0.9)"), b.hit.x - 70, b.hit.y - 70, 140, 140);
					}
				}

				c.strokeStyle = "#cdd8ff"; c.lineWidth = 1.2;
				for (i = 0; i < livePtrs.length; i++) {
					P = livePtrs[i];
					var s = 90 * (0.8 + 0.2 * Math.sin(t * 9 + i));
					c.globalAlpha = 0.8;
					c.drawImage(glow("rgba(140,170,255,0.7)"), P.x - s / 2, P.y - s / 2, s, s);
					c.globalAlpha = 1; c.fillStyle = "#eef2ff";
					c.beginPath(); c.arc(P.x, P.y, 3, 0, TAU); c.fill();
					for (j = 0; j < 3; j++) {   // little arcs crackling off the orb
						var a = rand(0, TAU), L = rand(22, 55);
						c.globalAlpha = rand(0.4, 0.9);
						c.beginPath(); c.moveTo(P.x, P.y);
						for (k = 1; k <= 5; k++)
							c.lineTo(P.x + Math.cos(a) * L * k / 5 + rand(-6, 6), P.y + Math.sin(a) * L * k / 5 + rand(-6, 6));
						c.stroke();
					}
					for (j = i + 1; j < livePtrs.length; j++) {   // nearby cursors arc to each other
						var Q = livePtrs[j], dx = Q.x - P.x, dy = Q.y - P.y, d = Math.sqrt(dx * dx + dy * dy);
						if (d > 260 || d < 1) continue;
						var arc = boltPath(Math.random, P.x, P.y, Q.x, Q.y, d * 0.25);
						c.globalAlpha = 0.6 * (1 - d / 260);
						c.beginPath(); c.moveTo(arc[0].x, arc[0].y);
						for (k = 1; k < arc.length; k++) c.lineTo(arc[k].x, arc[k].y);
						c.stroke();
					}
				}
				c.globalCompositeOperation = "source-over";
			}
		},

		// Butterflies wander the garden; near a cursor they flutter in
		// circles around it, clicks scatter them, and moving shakes pollen.
		butterflies: {
			density: 26, pointer: true,
			init: function (p, w, h) {
				p.x = rand(0, w); p.y = rand(0, h); p.vx = rand(-40, 40); p.vy = rand(-40, 40);
				p.tx = rand(0, w); p.ty = rand(0, h); p.kx = 0; p.ky = 0;
				p.s = rand(9, 15); p.flap = rand(10, 15); p.ph = rand(0, TAU);
				p.orb = rand(40, 95); p.os = rand(0.8, 1.6) * (rand(0, 1) < 0.5 ? -1 : 1);
				var pal = pick(BUTTERFLY); p.c1 = pal[0]; p.c2 = pal[1];
			},
			update: function (p, dt, w, h, t) {
				var g = nearest(livePtrs, p.x, p.y), tx = p.tx, ty = p.ty, follow = false, dx, dy, d, i;
				if (g) {
					dx = g.x - p.x; dy = g.y - p.y;
					if (dx * dx + dy * dy < 380 * 380) {
						var a = t * p.os + p.ph;
						tx = g.x + Math.cos(a) * p.orb; ty = g.y + Math.sin(a) * p.orb * 0.7;
						follow = true;
					}
				}
				if (!follow && (Math.random() < dt * 0.25 || Math.abs(p.x - p.tx) + Math.abs(p.y - p.ty) < 30)) {
					p.tx = rand(0.05, 0.95) * w; p.ty = rand(0.05, 0.9) * h;
				}
				for (i = 0; i < clicks.length; i++) {
					dx = p.x - clicks[i].x; dy = p.y - clicks[i].y; d = Math.sqrt(dx * dx + dy * dy) + 0.01;
					if (d < 320) { var kick = 700 * (1 - d / 320); p.kx += dx / d * kick; p.ky += dy / d * kick; }
				}
				dx = tx - p.x; dy = ty - p.y; d = Math.sqrt(dx * dx + dy * dy) + 0.01;
				var sp = follow ? Math.min(220, d * 2.2) : 70, ease = Math.min(1, dt * (follow ? 3 : 1.4));
				p.vx += (dx / d * sp - p.vx) * ease; p.vy += (dy / d * sp - p.vy) * ease;
				var damp = Math.pow(0.08, dt);
				p.kx *= damp; p.ky *= damp;
				p.x += (p.vx + p.kx) * dt;
				p.y += (p.vy + p.ky) * dt + Math.sin(t * 6 + p.ph) * 18 * dt;
				p.x = clamp(p.x, -100, w + 100); p.y = clamp(p.y, -100, h + 100);
				p.hd = Math.atan2(p.vy + p.ky, p.vx + p.kx);
				return true;
			},
			draw: function (c, p, t) {
				var s = p.s, k = 0.2 + 0.8 * Math.abs(Math.sin(t * p.flap + p.ph));
				c.save();
				c.translate(p.x, p.y); c.rotate((p.hd || 0) + Math.PI / 2);   // head points where it flies
				c.globalAlpha = 0.95;
				for (var side = -1; side <= 1; side += 2) {
					c.save();
					c.scale(side * k, 1);   // wings flap by squashing sideways
					c.fillStyle = p.c1;
					c.beginPath(); c.ellipse(s * 0.55, -s * 0.25, s * 0.6, s * 0.42, -0.5, 0, TAU); c.fill();
					c.fillStyle = p.c2;
					c.beginPath(); c.ellipse(s * 0.42, s * 0.35, s * 0.38, s * 0.3, 0.5, 0, TAU); c.fill();
					c.fillStyle = "rgba(255,255,255,0.55)";
					c.beginPath(); c.arc(s * 0.7, -s * 0.35, s * 0.12, 0, TAU); c.fill();
					c.restore();
				}
				c.fillStyle = "#2b1d14";
				c.beginPath(); c.ellipse(0, 0, s * 0.1, s * 0.5, 0, 0, TAU); c.fill();
				c.strokeStyle = "#2b1d14"; c.lineWidth = 1;
				c.beginPath();
				c.moveTo(0, -s * 0.45); c.quadraticCurveTo(-s * 0.2, -s * 0.8, -s * 0.35, -s * 0.9);
				c.moveTo(0, -s * 0.45); c.quadraticCurveTo(s * 0.2, -s * 0.8, s * 0.35, -s * 0.9);
				c.stroke();
				c.restore();
			},
			frame: function (c, dt, w, h, t, S) {
				var pol = S.pol || (S.pol = []), i, j, p;
				eachMove(S, livePtrs, 20, function (x, y) {
					pol.push({ x: x + rand(-6, 6), y: y + rand(-6, 6), vx: rand(-15, 15), vy: rand(-35, -10), age: 0, max: rand(0.8, 1.6), s: rand(10, 18) });
				});
				for (i = 0; i < clicks.length; i++)
					for (j = 0; j < 20; j++) {
						var a = rand(0, TAU), v = rand(40, 160);
						pol.push({ x: clicks[i].x, y: clicks[i].y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, age: 0, max: rand(0.9, 1.6), s: rand(12, 20) });
					}
				if (pol.length > 220) pol.splice(0, pol.length - 220);
				c.globalCompositeOperation = "lighter";
				var drag = Math.pow(0.3, dt);
				for (i = pol.length - 1; i >= 0; i--) {
					p = pol[i];
					p.age += dt;
					if (p.age >= p.max) { pol.splice(i, 1); continue; }
					p.vx *= drag; p.vy = p.vy * drag - 12 * dt;
					p.x += p.vx * dt; p.y += p.vy * dt;
					c.globalAlpha = 1 - p.age / p.max;
					c.drawImage(glow("rgba(255,230,120,0.8)"), p.x - p.s / 2, p.y - p.s / 2, p.s, p.s);
				}
				c.globalCompositeOperation = "source-over";
			}
		},

		// Whatever you draw is mirrored twelve ways around the screen's
		// center and slowly fades; clicks bloom into mirrored rings. An
		// invisible pen keeps drawing when nobody has moved for a while.
		kaleido: {
			density: 0, pointer: true, trail: 0.03,
			frame: function (c, dt, w, h, t, S) {
				var N = 6, cx = w / 2, cy = h / 2, i, k;
				var prev = S.prev || (S.prev = {}), blooms = S.blooms || (S.blooms = []);
				function mirrored(fn) {
					c.save();
					c.translate(cx, cy);
					for (k = 0; k < N; k++) { c.rotate(TAU / N); fn(1); fn(-1); }
					c.restore();
				}
				var list = livePtrs.slice();
				if (t - (S.lastLive || -99) > 2.5) list.push(ghostPointer(t, w, h));
				c.globalCompositeOperation = "lighter";
				c.lineCap = "round";
				eachMove(S, list, 6, function (x, y, ux, uy, p) {
					if (p.id !== "ghost") S.lastLive = t;
					var L = prev[p.id];
					prev[p.id] = { x: x, y: y, t: t };
					if (!L || t - L.t > 0.5) return;
					var ax = L.x - cx, ay = L.y - cy, bx = x - cx, by = y - cy;
					if (Math.abs(bx - ax) + Math.abs(by - ay) > 80) return;
					var hue = (t * 50 + Math.sqrt(bx * bx + by * by) * 0.4) % 360 | 0;
					for (var pass = 0; pass < 2; pass++) {   // soft glow, then a bright core
						c.strokeStyle = "hsl(" + hue + ",100%," + (pass ? 75 : 55) + "%)";
						c.globalAlpha = pass ? 0.9 : 0.18;
						c.lineWidth = pass ? 1.8 : 8;
						mirrored(function (m) { c.beginPath(); c.moveTo(ax, ay * m); c.lineTo(bx, by * m); c.stroke(); });
					}
				});
				for (i = 0; i < clicks.length; i++) blooms.push({ x: clicks[i].x - cx, y: clicks[i].y - cy, age: 0, hue: t * 50 % 360 });
				if (blooms.length > 10) blooms.splice(0, blooms.length - 10);
				c.lineWidth = 2;
				for (i = blooms.length - 1; i >= 0; i--) {
					var b = blooms[i];
					b.age += dt;
					if (b.age >= 1.2) { blooms.splice(i, 1); continue; }
					var r = 6 + b.age * 90;
					c.globalAlpha = (1 - b.age / 1.2) * 0.8;
					c.strokeStyle = "hsl(" + ((b.hue + b.age * 120) % 360 | 0) + ",100%,70%)";
					mirrored(function (m) { c.beginPath(); c.arc(b.x, b.y * m, r, 0, TAU); c.stroke(); });
				}
				c.globalCompositeOperation = "source-over";
			}
		}
	};

	var BUTTERFLY = [["#ffb347", "#ff7b39"], ["#ff6fa8", "#ffb3d1"], ["#7ec8ff", "#3a8dde"],
		["#c39bff", "#8f6bff"], ["#fff27a", "#ffc94a"], ["#ffffff", "#cfe9ff"]];

	// Jagged lightning path by midpoint displacement; R is the random source
	// (seeded for ambient strikes so everyone sees the same bolt).
	function boltPath(R, x0, y0, x1, y1, rough) {
		var pts = [{ x: x0, y: y0 }, { x: x1, y: y1 }], off = rough;
		for (var it = 0; it < 6; it++) {
			var next = [pts[0]];
			for (var i = 1; i < pts.length; i++) {
				var a = pts[i - 1], b = pts[i], dx = b.x - a.x, dy = b.y - a.y, len = Math.sqrt(dx * dx + dy * dy) || 1;
				var o = (R() - 0.5) * off;
				next.push({ x: (a.x + b.x) / 2 - dy / len * o, y: (a.y + b.y) / 2 + dx / len * o }, b);
			}
			pts = next; off *= 0.55;
		}
		return pts;
	}
	function makeBolt(R, x0, y0, x1, y1) {
		var dx = x1 - x0, dy = y1 - y0, main = boltPath(R, x0, y0, x1, y1, Math.sqrt(dx * dx + dy * dy) * 0.35), segs = [main];
		for (var i = 0, n = 2 + (R() * 3 | 0); i < n; i++) {   // a few side branches
			var s = main[(main.length * (0.2 + R() * 0.5)) | 0], ang = Math.atan2(dy, dx) + (R() - 0.5) * 1.4, L = 60 + R() * 160;
			segs.push(boltPath(R, s.x, s.y, s.x + Math.cos(ang) * L, s.y + Math.sin(ang) * L, L * 0.4));
		}
		return segs;
	}

	// ── Cursor reactions for the ambient themes ─────────────────────────
	// Particles still follow the shared room clock; on top of that each one
	// carries a springy offset that cursors push away (fireflies are drawn
	// in instead) and clicks blast outward. Every cursor carries a soft glow
	// in the theme's color, moving leaves a little trail, and clicks burst
	// into the theme's own particles.
	//   push / pull: force strength, r: reach in px, link: lines from cursors
	//   to nearby particles, aura: cursor glow, burst: click particles
	//   { colors, shape, g: gravity, size, glow: additive blending }.
	var REACT = {
		snow: { push: 1300, r: 150, aura: "rgba(200,225,255,0.35)",
			burst: { colors: ["#ffffff", "#dbeaff"], shape: "flake", g: 30, size: 7 } },
		stars: { push: 500, r: 170, link: "#cfe0ff", aura: "rgba(150,170,255,0.3)",
			burst: { colors: ["#ffffff", "#cfe3ff", "#ffeacc", "#e6d4ff"], shape: "star", g: 0, size: 6, glow: true } },
		petals: { push: 1400, r: 150, aura: "rgba(255,190,215,0.3)",
			burst: { colors: ["#ffd1dc", "#ffb7c9", "#ffe4ea", "#f9a8c0"], shape: "petal", g: 40, size: 7 } },
		leaves: { push: 1500, r: 160, aura: "rgba(255,170,80,0.28)",
			burst: { colors: ["#d9541e", "#e8892b", "#f2b134", "#c0392b"], shape: "leaf", g: 70, size: 9 } },
		bubbles: { push: 1300, r: 140, aura: "rgba(160,225,255,0.3)",
			burst: { colors: ["rgba(210,240,255,0.9)"], shape: "ring", g: -80, size: 8 } },
		fireflies: { pull: 1400, r: 230, aura: "rgba(215,255,120,0.22)",
			burst: { colors: ["#fbffd0", "#e3ff9a"], shape: "dot", g: -15, size: 4, glow: true } },
		rain: { push: 2600, r: 110, aura: "rgba(170,200,230,0.2)",
			burst: { colors: ["#bfd7f0", "#e3efff"], shape: "dot", g: 420, size: 2.4 } },
		embers: { push: 1300, r: 150, aura: "rgba(255,140,40,0.35)",
			burst: { colors: ["#ffd27a", "#ff9a3c", "#ff6a1e"], shape: "dot", g: -90, size: 4, glow: true } },
		hearts: { push: 1300, r: 150, aura: "rgba(255,110,150,0.3)",
			burst: { colors: ["#ff4d6d", "#ff758f", "#ffb3c6", "#ffffff"], shape: "heart", g: -50, size: 12 } },
		confetti: { push: 1600, r: 160, aura: "rgba(255,220,120,0.25)",
			burst: { colors: ["#ff595e", "#ffca3a", "#8ac926", "#1982c4", "#6a4c93", "#2ec4b6"], shape: "rect", g: 260, size: 8 } },
		sparkles: { push: 1100, r: 160, aura: "rgba(220,190,255,0.35)",
			burst: { colors: ["#fff4c2", "#ffd6ff", "#d9c2ff", "#c2f0ff"], shape: "star", g: -20, size: 7, glow: true } },
		matrix: { r: 140, aura: "rgba(60,255,120,0.3)",
			burst: { colors: ["#3dff7a", "#b8ffcc"], shape: "glyph", g: 160, size: 16 } },
		grid: { r: 140, aura: "rgba(255,79,216,0.3)",
			burst: { colors: ["#ff4fd8", "#56e0ff", "#ffd56b"], shape: "star", g: 0, size: 7, glow: true } }
	};
	for (var rk in REACT) { FX[rk].pointer = true; FX[rk].react = REACT[rk]; }

	var bursts = [], moveTrack = {};
	var BURST_GLYPHS = "アイウエオカキクケコサシスセソ0123456789";

	function reactParts(dt) {
		var R = fx.react, rad = R.r, pull = !!R.pull, S = R.pull || R.push, K = 10, C = 4.5;
		var i, j, p, dx, dy, d, k, f;
		for (i = 0; i < parts.length; i++) {
			p = parts[i];
			if (p.rgen !== p.gen) { p.rgen = p.gen; p.ox = p.oy = p.ovx = p.ovy = 0; }   // fresh particle
			var x = p.x + p.ox, y = p.y + p.oy, near = 0;
			var ax = -K * p.ox - C * p.ovx, ay = -K * p.oy - C * p.ovy;
			for (j = 0; j < livePtrs.length; j++) {
				dx = x - livePtrs[j].x; dy = y - livePtrs[j].y;
				if (dx > rad || dx < -rad || dy > rad || dy < -rad) continue;
				d = Math.sqrt(dx * dx + dy * dy) + 0.01;
				if (d >= rad) continue;
				k = 1 - d / rad;
				if (k > near) near = k;
				if (pull) {   // drawn toward the cursor, circling it instead of landing on it
					f = S * k * clamp((d - 40) / 80, -1, 1);
					ax += -dx / d * f + dy / d * f * 0.5; ay += -dy / d * f - dx / d * f * 0.5;
				} else {
					f = S * k * k;
					ax += dx / d * f; ay += dy / d * f;
				}
			}
			for (j = 0; j < clicks.length; j++) {
				dx = x - clicks[j].x; dy = y - clicks[j].y; d = Math.sqrt(dx * dx + dy * dy) + 0.01;
				if (d < 280) { f = 650 * (1 - d / 280); p.ovx += dx / d * f; p.ovy += dy / d * f; }
			}
			p.ovx += ax * dt; p.ovy += ay * dt;
			p.ox = clamp(p.ox + p.ovx * dt, -260, 260); p.oy = clamp(p.oy + p.ovy * dt, -260, 260);
			p.near = near;
			p.x += p.ox; p.y += p.oy;
		}
	}

	function drawAuras(c) {
		var R = fx.react, s = (R.r || 140) * 1.5;
		c.globalCompositeOperation = "lighter";
		c.globalAlpha = fx.trail ? 0.12 : 0.7;   // trailing canvases build the glow up over frames
		for (var i = 0; i < livePtrs.length; i++)
			c.drawImage(glow(R.aura), livePtrs[i].x - s / 2, livePtrs[i].y - s / 2, s, s);
		c.globalCompositeOperation = "source-over";
	}

	function drawLinks(c) {
		var R = fx.react, rad = R.r, i, j, p, dx, dy, d;
		c.strokeStyle = R.link; c.lineWidth = 1;
		for (j = 0; j < livePtrs.length; j++) {
			var P = livePtrs[j];
			for (i = 0; i < parts.length; i++) {
				p = parts[i];
				dx = p.x - P.x; dy = p.y - P.y;
				if (dx > rad || dx < -rad || dy > rad || dy < -rad) continue;
				d = Math.sqrt(dx * dx + dy * dy);
				if (d >= rad) continue;
				c.globalAlpha = (1 - d / rad) * 0.45;
				c.beginPath(); c.moveTo(P.x, P.y); c.lineTo(p.x, p.y); c.stroke();
			}
		}
	}

	function spawnBurst(x, y, n, speed, small) {
		var B = fx.react.burst;
		for (var i = 0; i < n; i++) {
			var a = rand(0, TAU), v = speed * rand(0.35, 1);
			bursts.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, age: 0,
				max: small ? rand(0.5, 0.9) : rand(0.9, 1.6), s: B.size * rand(0.6, 1.2) * (small ? 0.6 : 1),
				col: pick(B.colors), rot: rand(0, TAU), vr: rand(-5, 5),
				ch: BURST_GLYPHS.charAt((Math.random() * BURST_GLYPHS.length) | 0) });
		}
		if (bursts.length > 400) bursts.splice(0, bursts.length - 400);
	}

	function drawShape(c, shape, p) {
		var s = p.s, x = p.x, y = p.y;
		c.fillStyle = p.col; c.strokeStyle = p.col;
		if (shape === "dot") {
			c.drawImage(glow(p.col), x - s * 2, y - s * 2, s * 4, s * 4);
			c.beginPath(); c.arc(x, y, s * 0.35, 0, TAU); c.fill();
			return;
		}
		if (shape === "star") {   // four-point star
			c.beginPath();
			c.moveTo(x, y - s);
			c.quadraticCurveTo(x, y, x + s, y);
			c.quadraticCurveTo(x, y, x, y + s);
			c.quadraticCurveTo(x, y, x - s, y);
			c.quadraticCurveTo(x, y, x, y - s);
			c.fill();
			return;
		}
		if (shape === "ring") {
			c.lineWidth = 1;
			c.beginPath(); c.arc(x, y, s * 0.6, 0, TAU); c.stroke();
			c.beginPath(); c.arc(x - s * 0.2, y - s * 0.2, s * 0.13, 0, TAU); c.fill();
			return;
		}
		c.save();
		c.translate(x, y); c.rotate(p.rot);
		if (shape === "heart") {
			heartPath(c, s); c.fill();
		} else if (shape === "petal") {
			c.beginPath();
			c.moveTo(0, -s);
			c.bezierCurveTo(s * 0.9, -s * 0.7, s * 0.7, s * 0.7, 0, s);
			c.bezierCurveTo(-s * 0.7, s * 0.7, -s * 0.9, -s * 0.7, 0, -s);
			c.fill();
		} else if (shape === "leaf") {
			c.beginPath();
			c.moveTo(-s, 0);
			c.quadraticCurveTo(0, -s * 0.75, s, 0);
			c.quadraticCurveTo(0, s * 0.75, -s, 0);
			c.fill();
		} else if (shape === "flake") {
			c.lineWidth = 1.2;
			c.beginPath();
			for (var i = 0; i < 3; i++) {
				var a = i * Math.PI / 3, dx = Math.cos(a) * s, dy = Math.sin(a) * s;
				c.moveTo(-dx, -dy); c.lineTo(dx, dy);
			}
			c.stroke();
		} else if (shape === "rect") {
			c.scale(1, Math.cos(p.rot * 1.7));
			c.fillRect(-s / 2, -s / 4, s, s / 2);
		} else if (shape === "glyph") {
			c.rotate(-p.rot);
			c.font = Math.round(s) + "px monospace";
			c.textBaseline = "middle";
			c.fillText(p.ch, -s / 3, 0);
		}
		c.restore();
	}

	function drawBursts(c, dt) {
		var B = fx.react.burst, i, p, f, drag = Math.pow(0.15, dt);
		for (i = 0; i < clicks.length; i++) {
			spawnBurst(clicks[i].x, clicks[i].y, 26, 320, false);
			bursts.push({ wave: true, x: clicks[i].x, y: clicks[i].y, age: 0, max: 0.7, col: B.colors[0] });
		}
		eachMove(moveTrack, livePtrs, 34, function (x, y) { spawnBurst(x, y, 1, 50, true); });
		if (B.glow) c.globalCompositeOperation = "lighter";
		for (i = bursts.length - 1; i >= 0; i--) {
			p = bursts[i];
			p.age += dt;
			if (p.age >= p.max) { bursts.splice(i, 1); continue; }
			f = 1 - p.age / p.max;
			if (p.wave) {   // shockwave ring at the click
				c.globalAlpha = f * 0.7;
				c.strokeStyle = p.col; c.lineWidth = 1 + 2 * f;
				c.beginPath(); c.arc(p.x, p.y, 12 + p.age * 340, 0, TAU); c.stroke();
				continue;
			}
			p.vx *= drag; p.vy = p.vy * drag + B.g * dt;
			p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
			c.globalAlpha = Math.sqrt(f);
			drawShape(c, B.shape, p);
		}
		c.globalCompositeOperation = "source-over";
	}

	// ── Engine ──────────────────────────────────────────────────────────
	var layer = null, canvas = null, ctx = null;
	var current = null, fx = null, fxOpts = {}, parts = [], state = {};
	var raf = 0, lastT = 0, W = 0, H = 0;
	var seedBase = 0;   // per-theme seed, identical for everyone in the room
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
		var i, p, area = Math.min(1.6, (W * H) / (1920 * 1080));
		if (fx.cycle) {
			// Everyone builds the same particle list; smaller screens draw a
			// subset of it (the same subset for the same size), so particles
			// shared by two screens are always in the same place on both.
			var total = Math.round(fx.density * (fxOpts.density || 1) * 1.6);
			var keep = area / 1.6 * (isSmallScreen() ? 0.6 : 1);
			keep = Math.max(keep, Math.min(1, 8 / total));
			for (i = 0; i < total; i++) {
				if (hashInts(seedBase, i, 99) / 4294967296 >= keep) continue;
				p = { i: i, gen: null };
				setupPart(p);
				parts.push(p);
			}
			return;
		}
		if (!fx.init) return;
		var n = Math.round(fx.density * (fxOpts.density || 1) * area);
		if (isSmallScreen()) n = Math.round(n * 0.6);
		n = Math.max(8, n);
		withSeed(seedBase, function () {   // same starting layout for everyone
			for (i = 0; i < n; i++) {
				p = {};
				fx.init(p, W, H, true, fxOpts);
				parts.push(p);
			}
		});
	}

	function setupPart(p) {
		var prev = rng;
		rng = mulberry(hashInts(seedBase, p.i, 0));
		try {
			fx.setup(p, fxOpts);
			p.off = p.per ? rand(0, p.per) : 0;   // stagger cycles so they don't all restart together
		} finally { rng = prev; }
	}

	function spawnPart(p) {
		var prev = rng;
		rng = mulberry(hashInts(seedBase, p.i, p.gen + 1));
		try { fx.spawn(p, W, H, fxOpts); } finally { rng = prev; }
	}

	function renderFrame(dt) {
		var t = roomSec();   // shared by the whole room
		if (fx.pointer) {
			livePtrs = collectPointers(dt);
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
		var react = fx.react;
		if (react && react.aura) drawAuras(ctx);
		if (fx.blend) ctx.globalCompositeOperation = fx.blend;
		if (fx.cycle) {
			for (var k = 0; k < parts.length; k++) {
				var q = parts[k], gen = 0, age = t;
				if (q.per) {
					var u = t + q.off;
					gen = Math.floor(u / q.per);
					age = u - gen * q.per;
				}
				if (q.gen !== gen) { q.gen = gen; if (fx.spawn) spawnPart(q); }
				fx.at(q, age, t, W, H, fxOpts);
			}
			if (react && (react.push || react.pull)) reactParts(dt);
		} else if (fx.update) {
			for (var i = 0; i < parts.length; i++) {
				var p = parts[i];
				if (!fx.update(p, dt, W, H, t, fxOpts)) fx.init(p, W, H, false, fxOpts);
			}
		}
		if (fx.drawAll) fx.drawAll(ctx, parts, t, H);
		else if (fx.draw) for (var j = 0; j < parts.length; j++) fx.draw(ctx, parts[j], t, H);
		ctx.globalCompositeOperation = "source-over";
		if (fx.frame) fx.frame(ctx, dt, W, H, t, state, fxOpts);
		if (react && react.link) drawLinks(ctx);
		if (react && react.burst) drawBursts(ctx, dt);
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
		var nextFx = theme && theme.fx ? FX[theme.fx] : null;
		if (fx && fx.pointer && !(nextFx && nextFx.pointer) && announced) {
			sendPtr("l");   // our pointer no longer drives the room's background
			announced = false;
		}
		current = newId;
		clickQueue.length = 0;
		bursts.length = 0;
		moveTrack = {};
		stopLoop();
		document.body.classList.toggle("room-themed", !!theme);
		if (theme) document.body.setAttribute("data-room-theme", theme.id);
		else document.body.removeAttribute("data-room-theme");
		// Start the CSS overlay animations at the room clock's phase, so the
		// aurora / light rays / spotlights sway in step for everyone.
		layer.style.setProperty("--rt-delay", (-(roomSec() % 100000)).toFixed(2) + "s");
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
		seedBase = hashStr(theme.id);
		canvas.style.display = fx ? "block" : "none";
		canvas.style.opacity = fx && fx.opacity ? fx.opacity : "";
		if (fx) {
			resize();
			seed();
			startLoop();
			if (fx.pointer && ptr.inside) flushMove();   // show our cursor to the room right away
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
			if (t.interactive || (t.fx && FX[t.fx] && FX[t.fx].pointer)) {
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
		isSyncText: isSyncText,
		handleSync: handleSync,
		buildPicker: buildPicker
	};
})(window);
