/**
 * Harmony World — the games on the game room's two gaming PCs (worldGameRoom.js).
 *
 * Sit at a PC and its screen opens up: four little arcade games you play with the keyboard
 * (arrows / WASD, space) or by touch, plus "Play together", which opens the house's two-player board
 * games (the arcade) so whoever is at the other PC can take you on.
 *
 * The game draws into its own canvas; the PC's monitor in the room mirrors that canvas, and everyone
 * else sees the player's name, the game and the live score on it (shared key z:games:pc0 / pc1).
 * High scores are shared too (z:games:pcBest: { game: [{ name, score }] }, the best five each).
 */
export const PC_GAMES = [
	{ id: "snake", name: "Snake", desc: "Eat the hearts, don't bite your tail.", color: "#06d6a0" },
	{ id: "breakout", name: "Brick Breaker", desc: "Bounce the ball, clear the wall.", color: "#ffd166" },
	{ id: "shooter", name: "Star Shooter", desc: "Blast the invaders before they land.", color: "#3ff0ff" },
	{ id: "flappy", name: "Flappy Heart", desc: "Tap to flutter through the gaps.", color: "#ff4fa3" }
];
const CW = 480, CH = 360;
export const BEST_KEY = "z:games:pcBest";

// ---------------------------------------------------------------- the games (each: reset, step(dt, input), draw(c))
function snake() {
	const N = 20, GW = CW / N, GH = CH / N;
	const G = { score: 0, over: false };
	let body, dir, next, food, acc, speed;
	const place = () => { do { food = [Math.floor(Math.random() * GW), Math.floor(Math.random() * GH)]; } while (body.some(p => p[0] === food[0] && p[1] === food[1])); };
	G.reset = () => { body = [[8, 9], [7, 9], [6, 9]]; dir = [1, 0]; next = [1, 0]; acc = 0; speed = 7; G.score = 0; G.over = false; place(); };
	G.step = (dt, I) => {
		if (I.left && dir[0] !== 1) next = [-1, 0];
		else if (I.right && dir[0] !== -1) next = [1, 0];
		else if (I.up && dir[1] !== 1) next = [0, -1];
		else if (I.down && dir[1] !== -1) next = [0, 1];
		acc += dt;
		if (acc < 1 / speed) return;
		acc = 0; dir = next;
		const h = [body[0][0] + dir[0], body[0][1] + dir[1]];
		if (h[0] < 0 || h[1] < 0 || h[0] >= GW || h[1] >= GH || body.some(p => p[0] === h[0] && p[1] === h[1])) { G.over = true; return; }
		body.unshift(h);
		if (h[0] === food[0] && h[1] === food[1]) { G.score += 10; speed = Math.min(16, speed + 0.35); G.sfx = "chime"; place(); }
		else body.pop();
	};
	G.draw = c => {
		c.fillStyle = "#0b1a14"; c.fillRect(0, 0, CW, CH);
		c.strokeStyle = "rgba(6,214,160,0.07)";
		for (let x = 0; x <= CW; x += N) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, CH); c.stroke(); }
		for (let y = 0; y <= CH; y += N) { c.beginPath(); c.moveTo(0, y); c.lineTo(CW, y); c.stroke(); }
		heart(c, food[0] * N + N / 2, food[1] * N + N / 2, 8, "#ff4f7a");
		body.forEach((p, i) => { c.fillStyle = i ? (i % 2 ? "#06d6a0" : "#05b386") : "#b8ffe9"; roundRect(c, p[0] * N + 1, p[1] * N + 1, N - 2, N - 2, 5); c.fill(); });
	};
	return G;
}
function breakout() {
	const G = { score: 0, over: false };
	let pad, ball, bricks, lives, stuck;
	const cols = ["#ff4f7a", "#ff9e4a", "#ffd166", "#06d6a0", "#3ff0ff", "#a78bfa"];
	const wall = () => { bricks = []; for (let r = 0; r < 6; r++) for (let i = 0; i < 10; i++) bricks.push({ x: 12 + i * 45.6, y: 40 + r * 20, w: 42, h: 15, c: cols[r], on: true }); };
	G.reset = () => { pad = { x: CW / 2, w: 80 }; ball = { x: CW / 2, y: CH - 40, vx: 0, vy: 0 }; lives = 3; stuck = true; G.score = 0; G.over = false; wall(); };
	G.step = (dt, I) => {
		if (I.px !== null) pad.x = I.px;
		pad.x += ((I.right ? 1 : 0) - (I.left ? 1 : 0)) * 420 * dt;
		pad.x = Math.max(pad.w / 2, Math.min(CW - pad.w / 2, pad.x));
		if (stuck) { ball.x = pad.x; ball.y = CH - 32; if (I.action || I.up) { stuck = false; ball.vx = (Math.random() - 0.5) * 200; ball.vy = -300; } return; }
		const sub = 4;
		for (let s = 0; s < sub; s++) {
			ball.x += ball.vx * dt / sub; ball.y += ball.vy * dt / sub;
			if (ball.x < 6) { ball.x = 6; ball.vx = Math.abs(ball.vx); }
			if (ball.x > CW - 6) { ball.x = CW - 6; ball.vx = -Math.abs(ball.vx); }
			if (ball.y < 6) { ball.y = 6; ball.vy = Math.abs(ball.vy); }
			if (ball.vy > 0 && ball.y > CH - 30 && ball.y < CH - 18 && Math.abs(ball.x - pad.x) < pad.w / 2 + 6) {
				const u = (ball.x - pad.x) / (pad.w / 2), sp = Math.min(560, Math.hypot(ball.vx, ball.vy) * 1.02);
				ball.vx = u * sp * 0.8; ball.vy = -Math.sqrt(Math.max(1, sp * sp - ball.vx * ball.vx)); G.sfx = "clack";
			}
			for (const b of bricks) {
				if (!b.on || ball.x < b.x - 5 || ball.x > b.x + b.w + 5 || ball.y < b.y - 5 || ball.y > b.y + b.h + 5) continue;
				b.on = false; G.score += 10; G.sfx = "clack";
				const ox = Math.min(ball.x - b.x + 5, b.x + b.w + 5 - ball.x), oy = Math.min(ball.y - b.y + 5, b.y + b.h + 5 - ball.y);
				if (ox < oy) ball.vx = -ball.vx; else ball.vy = -ball.vy;
				break;
			}
		}
		if (ball.y > CH + 10) { lives--; G.sfx = "thunk"; if (lives <= 0) { G.over = true; return; } stuck = true; }
		if (bricks.every(b => !b.on)) { G.score += 100; wall(); stuck = true; G.sfx = "yes"; }
	};
	G.draw = c => {
		const gr = c.createLinearGradient(0, 0, 0, CH); gr.addColorStop(0, "#1a1033"); gr.addColorStop(1, "#0b0a18");
		c.fillStyle = gr; c.fillRect(0, 0, CW, CH);
		bricks.forEach(b => { if (!b.on) return; c.fillStyle = b.c; roundRect(c, b.x, b.y, b.w, b.h, 4); c.fill(); c.fillStyle = "rgba(255,255,255,0.25)"; c.fillRect(b.x + 3, b.y + 2, b.w - 6, 3); });
		c.fillStyle = "#e9e3ff"; roundRect(c, pad.x - pad.w / 2, CH - 26, pad.w, 10, 5); c.fill();
		c.fillStyle = "#fff"; c.beginPath(); c.arc(ball.x, ball.y, 6, 0, Math.PI * 2); c.fill();
		for (let i = 0; i < lives; i++) heart(c, CW - 18 - i * 20, 18, 6, "#ff4f7a");
		if (stuck) hint(c, "Space / tap to launch");
	};
	return G;
}
function shooter() {
	const G = { score: 0, over: false };
	let ship, shots, foes, booms, lives, spawn, cool, t, stars;
	G.reset = () => {
		ship = { x: CW / 2 }; shots = []; foes = []; booms = []; lives = 3; spawn = 0; cool = 0; t = 0; G.score = 0; G.over = false;
		stars = Array.from({ length: 60 }, () => ({ x: Math.random() * CW, y: Math.random() * CH, s: 20 + Math.random() * 60 }));
	};
	G.step = (dt, I) => {
		t += dt;
		if (I.px !== null) ship.x += (I.px - ship.x) * Math.min(1, dt * 12);
		ship.x += ((I.right ? 1 : 0) - (I.left ? 1 : 0)) * 300 * dt;
		ship.x = Math.max(16, Math.min(CW - 16, ship.x));
		cool -= dt;
		if ((I.action || I.up || I.held) && cool <= 0) { shots.push({ x: ship.x, y: CH - 44 }); cool = 0.22; G.sfx = "pop"; }
		shots.forEach(s => { s.y -= 460 * dt; });
		shots = shots.filter(s => s.y > -10);
		spawn -= dt;
		if (spawn <= 0) { foes.push({ x: 20 + Math.random() * (CW - 40), y: -16, vx: (Math.random() - 0.5) * 60, vy: 40 + Math.min(110, t * 2.2) + Math.random() * 30, hue: Math.floor(Math.random() * 360) }); spawn = Math.max(0.35, 1.2 - t * 0.012); }
		foes.forEach(f => { f.x += f.vx * dt; f.y += f.vy * dt; if (f.x < 14 || f.x > CW - 14) f.vx = -f.vx; });
		for (const f of foes) for (const s of shots) if (!f.dead && !s.dead && Math.abs(f.x - s.x) < 15 && Math.abs(f.y - s.y) < 14) { f.dead = s.dead = true; G.score += 25; booms.push({ x: f.x, y: f.y, t: 0 }); G.sfx = "thunk"; }
		for (const f of foes) if (!f.dead && (f.y > CH - 30 || (Math.abs(f.x - ship.x) < 18 && f.y > CH - 56))) { f.dead = true; lives--; booms.push({ x: f.x, y: f.y, t: 0 }); G.sfx = "crash"; if (lives <= 0) G.over = true; }
		foes = foes.filter(f => !f.dead); shots = shots.filter(s => !s.dead);
		booms.forEach(b => { b.t += dt; }); booms = booms.filter(b => b.t < 0.4);
		stars.forEach(s => { s.y += s.s * dt; if (s.y > CH) { s.y = 0; s.x = Math.random() * CW; } });
	};
	G.draw = c => {
		c.fillStyle = "#05060f"; c.fillRect(0, 0, CW, CH);
		stars.forEach(s => { c.fillStyle = `rgba(255,255,255,${s.s / 90})`; c.fillRect(s.x, s.y, 2, 2); });
		c.fillStyle = "#3ff0ff"; shots.forEach(s => c.fillRect(s.x - 2, s.y - 8, 4, 12));
		foes.forEach(f => {
			c.fillStyle = `hsl(${f.hue},80%,62%)`;
			c.beginPath(); c.ellipse(f.x, f.y, 14, 9, 0, 0, Math.PI * 2); c.fill();
			c.fillStyle = "#0b0a18"; c.fillRect(f.x - 7, f.y - 3, 4, 4); c.fillRect(f.x + 3, f.y - 3, 4, 4);
		});
		booms.forEach(b => { c.strokeStyle = `rgba(255,209,102,${1 - b.t / 0.4})`; c.lineWidth = 3; c.beginPath(); c.arc(b.x, b.y, 6 + b.t * 60, 0, Math.PI * 2); c.stroke(); });
		c.fillStyle = "#e9e3ff";
		c.beginPath(); c.moveTo(ship.x, CH - 52); c.lineTo(ship.x + 16, CH - 22); c.lineTo(ship.x - 16, CH - 22); c.closePath(); c.fill();
		c.fillStyle = "#ff4fa3"; c.fillRect(ship.x - 3, CH - 24, 6, 6);
		for (let i = 0; i < lives; i++) heart(c, CW - 18 - i * 20, 18, 6, "#ff4f7a");
	};
	return G;
}
function flappy() {
	const G = { score: 0, over: false };
	let y, vy, pipes, spawn, started, t;
	G.reset = () => { y = CH / 2; vy = 0; pipes = []; spawn = 0; started = false; t = 0; G.score = 0; G.over = false; };
	G.step = (dt, I) => {
		t += dt;
		if (I.action || I.up) { vy = -300; started = true; G.sfx = "pop"; }
		if (!started) { y = CH / 2 + Math.sin(t * 3) * 8; return; }
		vy += 900 * dt; y += vy * dt;
		spawn -= dt;
		if (spawn <= 0) { pipes.push({ x: CW + 30, gap: 70 + Math.random() * (CH - 200), passed: false }); spawn = 1.55; }
		pipes.forEach(p => { p.x -= 150 * dt; });
		pipes = pipes.filter(p => p.x > -60);
		for (const p of pipes) {
			if (!p.passed && p.x + 26 < 110) { p.passed = true; G.score += 1; G.sfx = "chime"; }
			if (Math.abs(p.x - 110) < 26 + 12 && (y - 12 < p.gap || y + 12 > p.gap + 120)) G.over = true;
		}
		if (y > CH - 12 || y < 0) G.over = true;
	};
	G.draw = c => {
		const gr = c.createLinearGradient(0, 0, 0, CH); gr.addColorStop(0, "#ffb3c6"); gr.addColorStop(1, "#ffe5ec");
		c.fillStyle = gr; c.fillRect(0, 0, CW, CH);
		pipes.forEach(p => {
			c.fillStyle = "#7b2cbf"; roundRect(c, p.x - 26, -10, 52, p.gap + 10, 8); c.fill(); roundRect(c, p.x - 26, p.gap + 120, 52, CH - p.gap - 110, 8); c.fill();
			c.fillStyle = "rgba(255,255,255,0.2)"; c.fillRect(p.x - 20, 0, 6, p.gap); c.fillRect(p.x - 20, p.gap + 124, 6, CH);
		});
		heart(c, 110, y, 13, "#e63946");
		c.fillStyle = "#7b2cbf"; c.font = "900 44px Nunito, sans-serif"; c.textAlign = "center"; c.fillText(String(G.score), CW / 2, 56);
		if (!started) hint(c, "Space / tap to flutter", "#7b2cbf");
	};
	return G;
}
const MAKERS = { snake, breakout, shooter, flappy };

// ---------------------------------------------------------------- drawing helpers
function roundRect(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function heart(c, x, y, s, col) {
	c.fillStyle = col; c.beginPath(); c.moveTo(x, y + s);
	c.bezierCurveTo(x - s * 1.6, y - s * 0.1, x - s * 0.7, y - s * 1.3, x, y - s * 0.45);
	c.bezierCurveTo(x + s * 0.7, y - s * 1.3, x + s * 1.6, y - s * 0.1, x, y + s); c.fill();
}
function hint(c, text, col) { c.fillStyle = col || "rgba(255,255,255,0.8)"; c.font = "800 20px Nunito, sans-serif"; c.textAlign = "center"; c.fillText(text, CW / 2, CH / 2 + 60); }

// ---------------------------------------------------------------- the PC's screen (a modal)
// opts: { onState(state | null), title() }. Returns { canvas() } - what to mirror on the monitor, or null.
export function createPC(ctx, opts) {
	let game = null, gid = "", raf = 0, last = 0, canvas = null, lastSent = 0, sentScore = -1;
	const I = { left: false, right: false, up: false, down: false, action: false, held: false, px: null };
	const keyMap = { arrowleft: "left", a: "left", arrowright: "right", d: "right", arrowup: "up", w: "up", arrowdown: "down", s: "down", " ": "action", enter: "action" };
	const best = () => ctx.get(BEST_KEY) || {};
	const name = () => ctx.profile().name;
	const open = () => ctx.modalKind() === "pc";

	function onKey(e) {
		if (!open() || !game) return;
		const k = keyMap[e.key.toLowerCase()];
		if (!k) return;
		e.preventDefault();
		if (e.type === "keydown") { if (k === "action" || k === "up") { if (!e.repeat) I[k] = true; I.held = true; } else I[k] = true; }
		else { if (k === "action" || k === "up") I.held = false; if (k !== "action") I[k] = false; }
	}
	addEventListener("keydown", onKey, true);
	addEventListener("keyup", onKey, true);

	function menu() {
		stop();
		const b = best();
		const top = g => (b[g] || [])[0];
		const body = ctx.openModal("pc", opts.title(), `<div class="gmenu">${PC_GAMES.map(x => `<button class="gcard" data-pc="${x.id}"><div class="gi" style="background:${x.color}22;border-radius:12px;display:grid;place-items:center;font:900 22px Nunito,sans-serif;color:${x.color}">${x.name[0]}</div><div><b>${x.name}</b><span>${x.desc}${top(x.id) ? ` &middot; best: ${ctx.esc(top(x.id).name)} ${top(x.id).score}` : ""}</span></div></button>`).join("")}
			<button class="gcard" data-pc="together"><div class="gi" style="background:#7c5cff22;border-radius:12px;display:grid;place-items:center;font:900 20px Nunito,sans-serif;color:#7c5cff">VS</div><div><b>Play together</b><span>Board games for two - take on whoever's at the other PC (or the computer).</span></div></button></div>
			<p class="muted" style="margin:14px 0 0">Arrow keys or WASD to move, space to fire / jump. On a phone, use the buttons under the game. Your screen shows up on the PC's monitor for everyone.</p>`, 500, () => { stop(); opts.onState(null); });
		body.querySelectorAll("[data-pc]").forEach(btn => btn.onclick = () => {
			if (btn.dataset.pc === "together") { opts.onState(null); ctx.closeModal(); ctx.openArcade(); return; }
			play(btn.dataset.pc);
		});
	}
	function play(id) {
		stop();
		const info = PC_GAMES.find(x => x.id === id);
		const body = ctx.openModal("pc", info.name, `<div style="display:flex;flex-direction:column;gap:10px;align-items:stretch">
			<div style="display:flex;justify-content:space-between;font-weight:800"><span id="pc-score">Score: 0</span><span id="pc-best" class="muted"></span></div>
			<canvas id="pc-cv" width="${CW}" height="${CH}" style="width:100%;border-radius:12px;background:#000;touch-action:none;display:block"></canvas>
			<div id="pc-pad" style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
				${[["left", "◀"], ["up", "▲"], ["down", "▼"], ["right", "▶"], ["action", "●"]].map(([k, l]) => `<button class="btn" data-k="${k}" style="min-width:52px;font-size:18px;touch-action:none">${l}</button>`).join("")}
			</div>
			<div style="display:flex;gap:8px;justify-content:center"><button class="btn" id="pc-again">Restart</button><button class="btn" id="pc-menu">All games</button></div></div>`, 540, () => { stop(); opts.onState(null); });
		canvas = body.querySelector("#pc-cv");
		const c = canvas.getContext("2d");
		gid = id;
		game = MAKERS[id]();
		game.reset();
		sentScore = -1;
		const toLocal = e => { const r = canvas.getBoundingClientRect(); return (e.clientX - r.left) / r.width * CW; };
		canvas.addEventListener("pointermove", e => { if (gid === "breakout" || gid === "shooter") I.px = toLocal(e); });
		canvas.addEventListener("pointerdown", e => { e.preventDefault(); I.action = true; I.held = true; if (gid === "breakout" || gid === "shooter") I.px = toLocal(e); if (game.over) restart(); });
		canvas.addEventListener("pointerup", () => { I.held = false; });
		canvas.addEventListener("pointerleave", () => { I.px = null; I.held = false; });
		body.querySelectorAll("[data-k]").forEach(btn => {
			const k = btn.dataset.k;
			btn.addEventListener("pointerdown", e => { e.preventDefault(); I[k] = true; if (k === "action") I.held = true; });
			const up = () => { if (k !== "action") I[k] = false; else I.held = false; };
			btn.addEventListener("pointerup", up); btn.addEventListener("pointerleave", up);
		});
		const restart = () => { game.reset(); sentScore = -1; game.saved = false; };
		body.querySelector("#pc-again").onclick = restart;
		body.querySelector("#pc-menu").onclick = menu;
		const showBest = () => { const b = (best()[id] || [])[0]; body.querySelector("#pc-best").textContent = b ? `Best: ${b.name} ${b.score}` : "No high score yet"; };
		showBest();
		last = performance.now();
		const loop = now => {
			if (!open() || gid !== id) return;
			const dt = Math.min(0.05, (now - last) / 1000);
			last = now;
			if (!game.over) game.step(dt, I);
			I.action = false;
			if (I.up && gid !== "snake" && gid !== "breakout") I.up = false;
			if (game.sfx) { ctx.sfx(game.sfx, 0.35); game.sfx = null; }
			game.draw(c);
			if (game.over) {
				c.fillStyle = "rgba(0,0,0,0.55)"; c.fillRect(0, 0, CW, CH);
				c.fillStyle = "#fff"; c.textAlign = "center"; c.font = "900 44px Nunito, sans-serif"; c.fillText("GAME OVER", CW / 2, CH / 2 - 10);
				c.font = "800 22px Nunito, sans-serif"; c.fillText(`Score ${game.score}  -  tap or Restart`, CW / 2, CH / 2 + 30);
				if (!game.saved) { game.saved = true; saveScore(id, game.score); showBest(); }
			}
			body.querySelector("#pc-score").textContent = "Score: " + game.score;
			// what everyone sees on this PC's monitor (not every frame: once a second, or when the score changes)
			const t = Date.now();
			if (t - lastSent > 1000 && (game.score !== sentScore || t - lastSent > 8000)) {
				lastSent = t; sentScore = game.score;
				opts.onState({ name: name(), game: id, score: game.score, over: !!game.over, at: t });
			}
			raf = requestAnimationFrame(loop);
		};
		raf = requestAnimationFrame(loop);
		opts.onState({ name: name(), game: id, score: 0, over: false, at: Date.now() });
	}
	function saveScore(id, score) {
		if (score <= 0) return;
		const b = Object.assign({}, best());
		const list = (b[id] || []).slice();
		const me = list.find(x => x.name === name());
		if (me && me.score >= score) return;
		const out = list.filter(x => x.name !== name()).concat([{ name: name(), score }]).sort((a, z) => z.score - a.score).slice(0, 5);
		b[id] = out;
		ctx.setShared(BEST_KEY, b);
		if (out[0].name === name() && out[0].score === score) { ctx.notice(`<b>New high score</b> on ${PC_GAMES.find(x => x.id === id).name}: ${score}!`); ctx.sfx("yes", 0.5); }
	}
	function stop() { cancelAnimationFrame(raf); raf = 0; game = null; gid = ""; canvas = null; Object.keys(I).forEach(k => { I[k] = k === "px" ? null : false; }); }

	return {
		menu,
		// the canvas to mirror on the monitor while this player is in a game
		canvas: () => (open() && game ? canvas : null),
		close() { if (open()) ctx.closeModal(); stop(); }
	};
}
