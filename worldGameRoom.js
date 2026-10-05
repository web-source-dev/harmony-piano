import { createPC, PC_GAMES } from "./worldPCGames.js";

/**
 * Harmony World — the game room, off the hallway behind the lounge (worldHall.js).
 *
 * Local coordinates (origin at world 7.95, 13.15): x -4..4, z -4.8..4.8, ceiling 3.6 m.
 * The door is in the east wall, out to the hallway (and across it, the spa).
 *
 *   a bowling lane along the west wall (bowl, watch the pins go, a scoreboard with everyone's best)
 *   a billiard table in the middle (take a shot from wherever you stand; the balls roll the same on every screen)
 *   a dartboard on the east wall (three darts a turn, scored like the real thing)
 *   a snack machine, a sofa to watch from (and cuddle on)
 *   two gaming PCs side by side on the south wall: sit down and play (worldPCGames.js), or take on each other
 *
 * Shared keys: z:games:bowl (the last roll), z:games:bowlScores, z:games:pool (the last shot), z:games:darts,
 * z:games:pc0 / z:games:pc1 (what's on each PC's screen), z:games:pcBest (the high scores).
 */
const W = 8.0, D = 9.6, H = 3.6, HW = W / 2, HD = D / 2;
const LANE = { x: -3.0, w: 1.05, foul: 1.6, pinZ: -3.3 };
const TB = { x: 1.4, z: -1.0, hw: 0.6, hl: 1.15, y: 0.82, r: 0.03 };
const DART = { z: 3.0, y: 1.73, line: 1.5, R: 0.2 };
const PCS = [{ id: "pc0", x: -3.1 }, { id: "pc1", x: -1.55 }], PCZ = 4.38;   // the two desks, against the south wall
const DART_ORDER = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];

export function build(k) {
	const { THREE, add, mat, group, rbox, g, ctx, canvasTex, rng, tex } = k;
	const R = rng(1201);
	const esc = ctx.esc, myName = () => ctx.profile().name;

	// ---------------------------------------------------------------- the room
	k.shell({
		w: W, d: D, h: H,
		floor: mat("#ffffff", 0.5, 0, { map: tex.wood(["#6b4a33", "#75523a", "#5f412d", "#7d5a40"], W / 4, D / 4, 91) }),
		wall: mat("#ffffff", 0.9, 0, { map: tex.wall("#2c2a45", "stripes", "rgba(255,255,255,0.035)", W / 2, H / 2) }),
		ceil: mat("#1d1b2e", 0.95),
		holes: [
			{ wall: "e", at: -2.0, w: 1.5, y1: 2.3 }    // out to the hallway (the lounge, the spa)
		]
	});
	k.floor(() => 0);
	k.walk(-HW, HW, -HD, HD);
	k.walk(HW - 1.0, HW + 0.9, -2.7, -1.3); // out to the hallway
	k.cam = { minX: -HW + 0.2, maxX: HW - 0.2, minZ: -HD + 0.2, maxZ: HD - 0.2, maxY: H - 0.25 };
	k.frenchDoor("gameshall", { x: HW + 0.13, z: -2.0, ry: Math.PI / 2, w: 1.46, h: 2.3, depth: 0.45, side: 1, curtain: "#3d5a80" }, [HW, HW + 0.3, -2.75, -1.25], [[HW - 1.0, -2.0], [HW + 1.3, -2.0]]);
	for (const [x, y, z, ry, text, icon] of [[HW - 0.04, 2.75, -2.0, -Math.PI / 2, "Lounge & Spa", "home"]]) {
		const st = tex.sign(text, icon);
		add(g, new THREE.PlaneGeometry(0.9, 0.225), new THREE.MeshStandardMaterial({ map: st, roughness: 0.45, emissive: "#ffffff", emissiveMap: st, emissiveIntensity: 0.3 }), x, y, z, { ry, cast: false });
	}
	k.lightSwitch(HW - 0.02, 1.25, 0.6, -Math.PI / 2);
	// a neon sign on the north wall
	{
		const neon = tex.text("GAME ROOM", { w: 1024, h: 256, color: "#d6fbff", glow: "#3ff0ff", font: "900 140px 'Nunito', sans-serif" });
		add(g, new THREE.PlaneGeometry(2.0, 0.5), new THREE.MeshBasicMaterial({ map: neon, transparent: true, toneMapped: false, depthWrite: false }), 2.75, 2.7, -HD + 0.03, { cast: false, receive: false });
	}

	// ---------------------------------------------------------------- the bowling lane
	const laneTex = canvasTex(128, 1024, (c, w, h) => {
		for (let i = 0; i < 16; i++) { c.fillStyle = i % 2 ? "#e2b77c" : "#d8a96c"; c.fillRect(i * 8, 0, 8, h); }
		c.fillStyle = "rgba(255,255,255,0.12)"; c.fillRect(0, 0, w, h);
		c.fillStyle = "#2b2140";
		for (let i = 0; i < 7; i++) { const x = 16 + i * 16; c.beginPath(); c.moveTo(x, h * 0.62); c.lineTo(x - 5, h * 0.67); c.lineTo(x + 5, h * 0.67); c.fill(); }
	});
	const laneLen = LANE.foul + HD;
	const lane = add(g, new THREE.PlaneGeometry(LANE.w, laneLen), mat("#ffffff", 0.25, 0, { map: laneTex }), LANE.x, 0.012, (LANE.foul - HD) / 2, { rx: -Math.PI / 2, cast: false });
	lane.userData.floor = true;
	for (const sx of [-1, 1]) add(g, new THREE.BoxGeometry(0.16, 0.06, laneLen), mat("#3b3550", 0.4), LANE.x + sx * (LANE.w / 2 + 0.08), 0.03, (LANE.foul - HD) / 2, { cast: false });
	add(g, new THREE.BoxGeometry(LANE.w + 0.32, 0.02, 0.05), mat("#e63946", 0.4), LANE.x, 0.02, LANE.foul, { cast: false });
	// the pit at the end, dark, with a lit hood over the pins
	add(g, new THREE.BoxGeometry(LANE.w + 0.4, 0.9, 0.5), mat("#14121d", 0.7), LANE.x, 1.75, -HD + 0.25, { cast: false });
	add(g, new THREE.BoxGeometry(LANE.w + 0.4, 0.06, 0.06), new THREE.MeshBasicMaterial({ color: "#ff4fd8", toneMapped: false }), LANE.x, 1.3, -HD + 0.5, { cast: false });
	k.box(LANE.x - LANE.w / 2 - 0.2, LANE.x + LANE.w / 2 + 0.2, -HD, LANE.foul);
	const pinGeo = new THREE.LatheGeometry([[0, 0], [0.05, 0], [0.06, 0.06], [0.055, 0.13], [0.03, 0.2], [0.028, 0.24], [0.04, 0.29], [0.035, 0.33], [0, 0.345]].map(p => new THREE.Vector2(p[0], p[1])), 14);
	const pinM = mat("#fbf8f2", 0.3), stripeM = mat("#e63946", 0.4);
	const pins = [];
	for (let r = 0; r < 4; r++) for (let i = 0; i <= r; i++) {
		const p = group(g, LANE.x + (i - r / 2) * 0.21, 0.012, LANE.pinZ - r * 0.19);
		add(p, pinGeo, pinM, 0, 0, 0, { cast: false });
		add(p, new THREE.CylinderGeometry(0.03, 0.03, 0.02, 12), stripeM, 0, 0.225, 0, { cast: false });
		p.userData = { home: p.position.clone(), row: r, dir: (R() - 0.5) * 2 };
		pins.push(p);
	}
	// the ball rack beside the approach (the purple ball in the middle is the one you bowl)
	const RACK = { x: LANE.x + 0.95, z: LANE.foul + 0.45 };
	const bowlBall = add(g, new THREE.SphereGeometry(0.11, 24, 16), mat("#5a189a", 0.15, 0.3), RACK.x, 0.91, RACK.z, { cast: false });
	const rack = group(g, RACK.x, 0, RACK.z);
	add(rack, rbox(0.4, 0.8, 0.6, 0.03), mat("#3b3550", 0.5), 0, 0.4, 0);
	["#e63946", "#ffbe0b"].forEach((c, i) => add(rack, new THREE.SphereGeometry(0.1, 18, 12), mat(c, 0.15, 0.3), 0, 0.9, i ? 0.21 : -0.21, { cast: false }));
	k.box(RACK.x - 0.23, RACK.x + 0.23, RACK.z - 0.33, RACK.z + 0.33);
	// scoreboard over the pins
	const sbCanvas = document.createElement("canvas");
	sbCanvas.width = 1024; sbCanvas.height = 384;
	const sbTex = new THREE.CanvasTexture(sbCanvas);
	sbTex.colorSpace = THREE.SRGBColorSpace;
	add(g, new THREE.PlaneGeometry(2.6, 0.975), new THREE.MeshBasicMaterial({ map: sbTex, toneMapped: false }), LANE.x + 0.75, 2.75, -HD + 0.52, { cast: false, receive: false });
	const BK = "z:games:bowl", BS = "z:games:bowlScores";
	const bowl = () => ctx.get(BK) || null;   // { id, by, name, at, off, hit: [10 x 0/1], n }
	const bowlScores = () => ctx.get(BS) || {};
	function drawScoreboard() {
		const c = sbCanvas.getContext("2d"), w = 1024, h = 384;
		c.fillStyle = "#0d0b18"; c.fillRect(0, 0, w, h);
		c.strokeStyle = "#ff4fd8"; c.lineWidth = 6; c.strokeRect(8, 8, w - 16, h - 16);
		const b = bowl(), live = b && Date.now() < b.at + 2600;
		c.textAlign = "center"; c.textBaseline = "middle";
		c.fillStyle = "#3ff0ff"; c.font = "900 54px Nunito, sans-serif";
		c.fillText(!b ? "BOWLING" : live ? `${b.name} is bowling...` : b.n === 10 ? `STRIKE! ${b.name}` : `${b.name}: ${b.n} pin${b.n === 1 ? "" : "s"}`, w / 2, 62);
		const rows = Object.entries(bowlScores()).sort((a, b2) => (b2[1].best - a[1].best) || (b2[1].strikes - a[1].strikes)).slice(0, 4);
		c.font = "800 34px Nunito, sans-serif";
		c.fillStyle = "rgba(255,255,255,0.55)"; c.textAlign = "left"; c.fillText("Player", 60, 140); c.textAlign = "right"; c.fillText("Best", 690, 140); c.fillText("Strikes", 840, 140); c.fillText("Rolls", 970, 140);
		rows.forEach(([n, s], i) => {
			const y = 194 + i * 50;
			c.fillStyle = i === 0 ? "#ffd166" : "#fff4e2";
			c.textAlign = "left"; c.fillText((i + 1) + ".  " + n.slice(0, 18), 60, y);
			c.textAlign = "right"; c.fillText(String(s.best), 690, y); c.fillText(String(s.strikes), 840, y); c.fillText(String(s.rolls), 970, y);
		});
		if (!rows.length) { c.fillStyle = "rgba(255,255,255,0.6)"; c.textAlign = "center"; c.fillText("Step up to the line and bowl!", w / 2, 230); }
		sbTex.needsUpdate = true;
	}
	drawScoreboard();
	function roll() {
		const b = bowl();
		if (b && Date.now() < b.at + 5600) { ctx.notice("Wait for the pins to be set up again."); return; }
		const me = ctx.me();
		me.h = Math.PI;
		ctx.doUpper("give", 1300);
		// where it goes: straight-ish, with a bit of luck either way; pins near its line go down, and take their neighbours
		const off = (R() - 0.5) * 0.5 * (R() < 0.35 ? 0.25 : 1);
		const strike = Math.abs(off) < 0.05 && R() < 0.75;
		const hit = pins.map(p => {
			if (strike) return 1;
			const dx = Math.abs(p.userData.home.x - (LANE.x + off * 1.3));
			const pr = Math.max(0, 1 - dx * 3.4) * (0.75 + p.userData.row * 0.05) + (Math.abs(off) < 0.12 ? 0.2 : 0);
			return R() < pr ? 1 : 0;
		});
		const n = hit.reduce((a, b2) => a + b2, 0);
		ctx.setShared(BK, { id: Math.random().toString(36).slice(2, 9), by: ctx.MY_ID, name: myName(), at: Date.now(), off: +off.toFixed(3), hit, n });
		const sc = Object.assign({}, bowlScores()), mine = Object.assign({ best: 0, strikes: 0, rolls: 0 }, sc[myName()]);
		mine.best = Math.max(mine.best, n); mine.rolls++; if (n === 10) mine.strikes++;
		sc[myName()] = mine;
		const names = Object.keys(sc);
		if (names.length > 12) names.sort((a, b2) => sc[a].best - sc[b2].best).slice(0, names.length - 12).forEach(x => delete sc[x]);
		setTimeout(() => ctx.setShared(BS, sc), 2600);
		setTimeout(() => {
			if (n === 10) { ctx.notice("<b>STRIKE!</b> All ten pins!"); ctx.doUpper("cheer", 2200); ctx.heartsFx(ctx.myAvatar().root, 6, "#ffd166"); }
			else if (n >= 7) { ctx.notice(`${n} pins - nice roll!`); ctx.doUpper("clap", 1500); }
			else ctx.notice(n ? `${n} pin${n === 1 ? "" : "s"}.` : "Gutter ball!");
		}, 2500);
	}
	k.interact("games:bowl", { label: () => { const b = bowl(); return b && Date.now() < b.at + 5600 ? "Wait for the pins..." : "Bowl!"; }, stand: [LANE.x, LANE.foul + 0.55], face: Math.PI, use: roll }, rack);
	let lastBowl = "", bowlSounded = "";

	// ---------------------------------------------------------------- the billiard table (nine balls)
	const tableG = group(g, TB.x, 0, TB.z);
	const woodD = mat("#4a2c1c", 0.45);
	add(tableG, rbox(TB.hw * 2 + 0.3, 0.16, TB.hl * 2 + 0.3, 0.03), woodD, 0, TB.y - 0.06, 0);
	add(tableG, new THREE.BoxGeometry(TB.hw * 2, 0.02, TB.hl * 2), mat("#1b7a4a", 0.95), 0, TB.y, 0, { cast: false });
	for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add(tableG, rbox(0.14, TB.y - 0.12, 0.14, 0.03), woodD, sx * (TB.hw + 0.02), (TB.y - 0.12) / 2, sz * (TB.hl - 0.15));
	for (const sx of [-1, 1]) add(tableG, new THREE.BoxGeometry(0.06, 0.05, TB.hl * 2), mat("#145c37", 0.9), sx * (TB.hw + 0.03), TB.y + 0.025, 0, { cast: false });
	for (const sz of [-1, 1]) add(tableG, new THREE.BoxGeometry(TB.hw * 2, 0.05, 0.06), mat("#145c37", 0.9), 0, TB.y + 0.025, sz * (TB.hl + 0.03), { cast: false });
	const POCKETS = [[-TB.hw, -TB.hl], [TB.hw, -TB.hl], [-TB.hw, 0], [TB.hw, 0], [-TB.hw, TB.hl], [TB.hw, TB.hl]];
	POCKETS.forEach(([x, z]) => add(tableG, new THREE.CylinderGeometry(0.06, 0.06, 0.03, 16), mat("#050505", 0.9), x, TB.y + 0.01, z, { cast: false }));
	const ballCols = ["#ffffff", "#ffd60a", "#1d4ed8", "#e63946", "#7b2cbf", "#ff8500", "#2a9d8f", "#7f1d1d", "#111111", "#ffd60a"];
	const balls = ballCols.map((c, i) => {
		const m = add(tableG, new THREE.SphereGeometry(TB.r, 16, 12), mat(c, 0.2, 0.05), 0, TB.y + TB.r + 0.01, 0, { cast: false });
		if (i === 9) add(m, new THREE.TorusGeometry(TB.r * 0.98, TB.r * 0.35, 6, 16), mat("#ffffff", 0.2), 0, 0, 0, { cast: false });
		return m;
	});
	const cue = add(tableG, new THREE.CylinderGeometry(0.006, 0.012, 1.3, 8), mat("#c89a6a", 0.4), 0, -5, 0, { cast: false });
	cue.geometry.translate(0, -0.65, 0);
	k.box(TB.x - TB.hw - 0.17, TB.x + TB.hw + 0.17, TB.z - TB.hl - 0.17, TB.z + TB.hl + 0.17);
	// a light over it
	const poolShade = new THREE.MeshStandardMaterial({ color: "#1b4332", roughness: 0.5, side: THREE.DoubleSide, emissive: "#000000" });
	const poolBulb = new THREE.MeshBasicMaterial({ color: "#fff3d6", toneMapped: false });
	const pl = group(g, TB.x, 0, TB.z);
	add(pl, new THREE.BoxGeometry(0.5, 0.12, 1.5), poolShade, 0, 1.95, 0, { cast: false });
	add(pl, new THREE.BoxGeometry(0.42, 0.02, 1.4), poolBulb, 0, 1.885, 0, { cast: false });
	for (const sz of [-0.6, 0.6]) add(pl, new THREE.CylinderGeometry(0.004, 0.004, H - 2.0, 4), mat("#222"), 0, (H + 2.0) / 2, sz, { cast: false });
	// the physics: equal balls, a little friction, cushions, six pockets. Same code, same numbers -> same result on every
	// screen (only + - * / and sqrt); the shot is shared, everyone plays it out, the final layout is the next shot's start.
	const rack9 = () => {
		const out = [[0, 0.6, 0]];
		const rows = [1, 2, 3, 2, 1];
		rows.forEach((n, r) => { for (let i = 0; i < n; i++) out.push([+((i - (n - 1) / 2) * 0.0615).toFixed(4), +(-0.45 - r * 0.053).toFixed(4), 0]); });
		return out;
	};
	const DT = 1 / 120;
	function simStart(start, shot) {
		const b = start.map(([x, z, inn]) => ({ x, z, vx: 0, vz: 0, in: !!inn }));
		if (shot) { b[0].vx = shot[0]; b[0].vz = shot[1]; }
		return { b, steps: 0, done: false, potted: [] };
	}
	function simStep(S) {
		const b = S.b, r = TB.r, hw = TB.hw - r, hl = TB.hl - r;
		let moving = false;
		for (const p of b) {
			if (p.in) continue;
			const sp = Math.sqrt(p.vx * p.vx + p.vz * p.vz);
			if (sp < 0.004) { p.vx = 0; p.vz = 0; continue; }
			moving = true;
			const f = Math.max(0, sp - 0.45 * DT) / sp;
			p.vx *= f; p.vz *= f;
			p.x += p.vx * DT; p.z += p.vz * DT;
			if (p.x > hw) { p.x = hw; p.vx = -p.vx * 0.8; } else if (p.x < -hw) { p.x = -hw; p.vx = -p.vx * 0.8; }
			if (p.z > hl) { p.z = hl; p.vz = -p.vz * 0.8; } else if (p.z < -hl) { p.z = -hl; p.vz = -p.vz * 0.8; }
			for (let i = 0; i < 6; i++) {
				const dx = p.x - POCKETS[i][0] * (hw / TB.hw), dz = p.z - POCKETS[i][1] * (hl / TB.hl);
				if (dx * dx + dz * dz < 0.0042) { p.in = true; p.vx = 0; p.vz = 0; S.potted.push(b.indexOf(p)); break; }
			}
		}
		for (let i = 0; i < b.length; i++) for (let j = i + 1; j < b.length; j++) {
			const p = b[i], q = b[j];
			if (p.in || q.in) continue;
			const dx = q.x - p.x, dz = q.z - p.z, d2 = dx * dx + dz * dz;
			if (d2 >= 4 * r * r || d2 === 0) continue;
			const d = Math.sqrt(d2), nx = dx / d, nz = dz / d;
			const rel = (p.vx - q.vx) * nx + (p.vz - q.vz) * nz;
			const push = (2 * r - d) / 2;
			p.x -= nx * push; p.z -= nz * push; q.x += nx * push; q.z += nz * push;
			if (rel > 0) { const j2 = rel * 0.96; p.vx -= j2 * nx; p.vz -= j2 * nz; q.vx += j2 * nx; q.vz += j2 * nz; S.hits = (S.hits || 0) + 1; }
		}
		S.steps++;
		if (!moving || S.steps > 2400) S.done = true;
	}
	// once it's all still: the cue ball comes back if it went in, and when every ball's gone, a fresh rack
	function settled(start, shot) {
		const S = simStart(start, shot);
		while (!S.done) simStep(S);
		return finish(S);
	}
	function finish(S) {
		let out = S.b.map(p => [+p.x.toFixed(4), +p.z.toFixed(4), p.in ? 1 : 0]);
		if (out[0][2]) out[0] = [0, 0.6, 0];
		if (out.slice(1).every(p => p[2])) out = rack9();
		return out;
	}
	const PK = "z:games:pool";
	const shotState = () => ctx.get(PK) || null;   // { id, at, start, shot, by, name }
	let sim = null, simId = "", restCache = { id: "", v: null };
	function current() {
		const s = shotState();
		if (!s || !Array.isArray(s.start)) return rack9();
		if (restCache.id !== s.id) restCache = { id: s.id, v: settled(s.start, s.shot) };
		return restCache.v;
	}
	function shoot() {
		const s = shotState();
		if (s && sim && !sim.done && simId === s.id) { ctx.notice("Wait for the balls to stop rolling."); return; }
		const me = ctx.me(), cur = current();
		const cx = cur[0][0], cz = cur[0][1];
		// from where you stand toward the cue ball, give or take a little
		let dx = cx - (me.x - k.ox - TB.x), dz = cz - (me.z - k.oz - TB.z);
		const a = Math.atan2(dx, dz) + (R() - 0.5) * 0.12, pw = 1.6 + R() * 1.4;
		dx = Math.sin(a) * pw; dz = Math.cos(a) * pw;
		me.h = Math.atan2(TB.x + k.ox - me.x, TB.z + k.oz - me.z);
		ctx.doUpper("give", 1000);
		ctx.setShared(PK, { id: Math.random().toString(36).slice(2, 9), at: Date.now(), start: cur, shot: [+dx.toFixed(4), +dz.toFixed(4)], by: ctx.MY_ID, name: myName() });
	}
	function rackUp() {
		ctx.setShared(PK, { id: Math.random().toString(36).slice(2, 9), at: Date.now() - 60000, start: rack9(), shot: null, by: ctx.MY_ID, name: myName() });
		ctx.sfx("clack", 0.6);
		ctx.notice("Fresh rack - break!");
	}
	k.interact("games:pool", { label: () => { const s = shotState(); return s && sim && !sim.done && simId === s.id ? "The balls are rolling..." : "Take a shot"; }, nearest: true, stand: [TB.x, TB.z + TB.hl + 0.75], stands: [[TB.x, TB.z + TB.hl + 0.75], [TB.x, TB.z - TB.hl - 0.75], [TB.x - TB.hw - 0.75, TB.z], [TB.x + TB.hw + 0.75, TB.z]], use: shoot }, tableG);
	let lastHits = 0, lastPotted = 0;

	// ---------------------------------------------------------------- the dartboard (east wall)
	const boardCanvas = document.createElement("canvas");
	boardCanvas.width = boardCanvas.height = 512;
	{
		const c = boardCanvas.getContext("2d"), C = 256, PX = 256 / 0.3;   // 0.6 m across
		c.fillStyle = "#111"; c.beginPath(); c.arc(C, C, 0.29 * PX, 0, Math.PI * 2); c.fill();
		const ring = (r0, r1, colA, colB) => {
			for (let i = 0; i < 20; i++) {
				const a0 = -Math.PI / 2 - Math.PI / 20 + i * Math.PI / 10, a1 = a0 + Math.PI / 10;
				c.fillStyle = i % 2 ? colB : colA;
				c.beginPath(); c.arc(C, C, r1 * PX, a0, a1); c.arc(C, C, r0 * PX, a1, a0, true); c.closePath(); c.fill();
			}
		};
		ring(0.0187, 0.1165, "#1b1b1b", "#f3e5c8");
		ring(0.1165, 0.1259, "#d62828", "#2a9d4a");
		ring(0.1259, 0.1906, "#1b1b1b", "#f3e5c8");
		ring(0.1906, 0.2, "#d62828", "#2a9d4a");
		c.fillStyle = "#2a9d4a"; c.beginPath(); c.arc(C, C, 0.0187 * PX, 0, Math.PI * 2); c.fill();
		c.fillStyle = "#d62828"; c.beginPath(); c.arc(C, C, 0.0075 * PX, 0, Math.PI * 2); c.fill();
		c.fillStyle = "#fff"; c.font = "800 22px Nunito, sans-serif"; c.textAlign = "center"; c.textBaseline = "middle";
		DART_ORDER.forEach((n, i) => { const a = -Math.PI / 2 + i * Math.PI / 10; c.fillText(String(n), C + Math.cos(a) * 0.245 * PX, C + Math.sin(a) * 0.245 * PX); });
	}
	const boardTex = new THREE.CanvasTexture(boardCanvas);
	boardTex.colorSpace = THREE.SRGBColorSpace;
	const board = group(g, HW - 0.03, DART.y, DART.z, -Math.PI / 2);
	add(board, new THREE.CylinderGeometry(0.31, 0.31, 0.04, 40), mat("#3b2519", 0.6), 0, 0, 0, { rx: Math.PI / 2 });
	add(board, new THREE.PlaneGeometry(0.6, 0.6), new THREE.MeshStandardMaterial({ map: boardTex, roughness: 0.8 }), 0, 0, 0.021, { cast: false });
	// the score under it
	const dsCanvas = document.createElement("canvas");
	dsCanvas.width = 512; dsCanvas.height = 160;
	const dsTex = new THREE.CanvasTexture(dsCanvas);
	dsTex.colorSpace = THREE.SRGBColorSpace;
	add(board, new THREE.PlaneGeometry(0.8, 0.25), new THREE.MeshBasicMaterial({ map: dsTex, toneMapped: false }), 0, -0.5, 0.01, { cast: false, receive: false });
	add(g, new THREE.BoxGeometry(0.6, 0.01, 0.04), mat("#ffd166", 0.4), DART.line, 0.006, DART.z, { cast: false });
	const DK = "z:games:darts";
	const darts = () => ctx.get(DK) || null;   // { id, by, name, list: [{ u, v, pts, at, fx, fz }] }
	function scoreOf(u, v) {
		const r = Math.hypot(u, v);
		if (r < 0.0075) return 50;
		if (r < 0.0187) return 25;
		if (r > 0.2) return 0;
		const deg = Math.atan2(v, u) * 180 / Math.PI;
		const n = DART_ORDER[Math.floor((((90 - deg) + 9) % 360 + 360) % 360 / 18)];
		return n * (r >= 0.1165 && r < 0.1259 ? 3 : r >= 0.1906 ? 2 : 1);
	}
	function drawDartScore() {
		const c = dsCanvas.getContext("2d"), w = 512, h = 160, d = darts();
		c.fillStyle = "#14121d"; c.fillRect(0, 0, w, h);
		c.strokeStyle = "#ffd166"; c.lineWidth = 4; c.strokeRect(4, 4, w - 8, h - 8);
		c.textAlign = "center"; c.textBaseline = "middle"; c.fillStyle = "#fff4e2";
		if (!d || !d.list.length) { c.font = "800 34px Nunito, sans-serif"; c.fillText("DARTS - 3 a turn", w / 2, h / 2); }
		else {
			c.font = "800 30px Nunito, sans-serif"; c.fillText(d.name.slice(0, 16), w / 2, 42);
			c.font = "900 40px Nunito, sans-serif";
			const tot = d.list.reduce((a, x) => a + x.pts, 0);
			c.fillText(d.list.map(x => x.pts).join("  +  ") + (d.list.length === 3 ? "  =  " + tot : ""), w / 2, 106);
		}
		dsTex.needsUpdate = true;
	}
	drawDartScore();
	const dartMeshes = [];
	for (let i = 0; i < 3; i++) {
		const dm = group(g, 0, -5, 0);
		add(dm, new THREE.CylinderGeometry(0.004, 0.006, 0.14, 6), mat(["#e63946", "#3a86ff", "#ffbe0b"][i], 0.4), 0, 0, 0, { rz: Math.PI / 2, cast: false });
		add(dm, new THREE.ConeGeometry(0.018, 0.04, 3), mat(["#e63946", "#3a86ff", "#ffbe0b"][i], 0.6), -0.07, 0, 0, { rz: -Math.PI / 2, cast: false });
		dartMeshes.push(dm);
	}
	function throwDart() {
		const me = ctx.me(), d = darts();
		me.h = Math.PI / 2;
		ctx.doUpper("give", 800);
		// aim at the treble 20, and miss a little (like everyone)
		const gauss = () => (R() + R() + R() - 1.5) * 0.9;
		const u = +(gauss() * 0.075).toFixed(4), v = +(0.12 + gauss() * 0.075).toFixed(4);
		const pts = scoreOf(u, v);
		const mine = d && d.by === ctx.MY_ID && d.list.length < 3 && Date.now() - d.list[d.list.length - 1].at < 120000;
		const list = (mine ? d.list : []).concat([{ u, v, pts, at: Date.now(), fx: +me.x.toFixed(2), fz: +me.z.toFixed(2) }]);
		ctx.setShared(DK, { id: mine ? d.id : Math.random().toString(36).slice(2, 9), by: ctx.MY_ID, name: myName(), list });
		setTimeout(() => {
			ctx.notice(pts === 50 ? "<b>BULLSEYE!</b> 50!" : pts === 0 ? "Missed the board!" : pts >= 40 ? `<b>${pts}!</b> Great dart.` : `${pts}.`);
			if (list.length === 3) { const tot = list.reduce((a, x) => a + x.pts, 0); ctx.notice(`Your three darts: <b>${tot}</b>${tot === 180 ? " - ONE HUNDRED AND EIGHTY!" : ""}`); if (tot >= 100) ctx.doUpper("cheer", 2000); }
		}, 420);
	}
	k.interact("games:darts", { label: () => { const d = darts(); return d && d.by === ctx.MY_ID && d.list.length < 3 ? `Throw dart ${d.list.length + 1} of 3` : "Throw darts"; }, stand: [DART.line - 0.25, DART.z], face: Math.PI / 2, reach: 3.2, use: throwDart }, board);
	let dartSig = "";

	// ---------------------------------------------------------------- a snack machine, a sofa to watch from
	const vm = group(g, HW - 0.42, 0, -3.9, -Math.PI / 2);
	add(vm, rbox(0.8, 1.9, 0.7, 0.03), mat("#e63946", 0.4), 0, 0.95, 0);
	add(vm, new THREE.PlaneGeometry(0.55, 1.15), new THREE.MeshBasicMaterial({ color: "#cfe9ff", toneMapped: false, transparent: true, opacity: 0.85 }), -0.06, 1.15, 0.352, { cast: false });
	for (let r = 0; r < 4; r++) for (let i = 0; i < 4; i++) add(vm, new THREE.BoxGeometry(0.09, 0.14, 0.05), mat(["#ffd166", "#06d6a0", "#ef476f", "#8338ec"][(r + i) % 4], 0.5), -0.27 + i * 0.13, 0.72 + r * 0.27, 0.3, { cast: false });
	add(vm, new THREE.PlaneGeometry(0.62, 0.18), new THREE.MeshBasicMaterial({ map: tex.text("SNACKS", { w: 512, h: 128, color: "#ffffff", glow: "#ff4fd8", font: "900 90px Nunito, sans-serif" }), transparent: true, toneMapped: false }), 0, 1.78, 0.352, { cast: false });
	k.box(HW - 0.8, HW, -4.32, -3.48);
	k.interact("games:snacks", { label: "Get a snack", stand: [HW - 1.25, -3.9], face: Math.PI / 2, use: () => { ctx.sfx("clack", 0.4); ctx.foodMenu("Snack machine", ["cookie", "icecream", "juice", "sandwich"]); } }, vm);
	const sofaM = mat("#3a3a6a", 0.85), sofaD = mat("#2c2c55", 0.85);
	const sofa = group(g, 2.3, 0, HD - 0.5, Math.PI);
	add(sofa, rbox(2.0, 0.3, 0.9, 0.06), sofaD, 0, 0.27, 0);
	for (const sx of [-0.47, 0.47]) { add(sofa, rbox(0.92, 0.18, 0.7, 0.08), sofaM, sx, 0.5, 0.06); add(sofa, rbox(0.9, 0.42, 0.16, 0.08), sofaM, sx, 0.76, -0.24, { rx: -0.12 }); }
	add(sofa, rbox(2.0, 0.6, 0.22, 0.08), sofaD, 0, 0.64, -0.36, { rx: -0.06 });
	for (const sx of [-1.0, 1.0]) add(sofa, rbox(0.18, 0.5, 0.9, 0.08), sofaD, sx, 0.45, 0);
	k.box(1.2, 3.4, HD - 0.95, HD);
	k.spot({ id: "gameSofa0", x: 2.3 + 0.47, z: HD - 0.56, h: Math.PI, y: 0.15 });
	k.spot({ id: "gameSofa1", x: 2.3 - 0.47, z: HD - 0.56, h: Math.PI, y: 0.15 });
	k.interact("games:sofa", { label: "Sit on the sofa", stand: [2.3, HD - 1.45], sit: ["gameSofa0", "gameSofa1"] }, sofa);
	// a rug and a couple of posters
	const rug = add(g, new THREE.PlaneGeometry(3.0, 2.0), mat("#ffffff", 1, 0, { map: tex.carpet("#3d2c5c", "#ffd166") }), 2.1, 0.006, 3.4, { rx: -Math.PI / 2, cast: false });
	rug.userData.floor = true;
	[[-HW + 0.03, 1.8, -2.4, Math.PI / 2, 2], [-HW + 0.03, 1.8, -0.4, Math.PI / 2, 4]].forEach(([x, y, z, ry, seed]) => {
		const pg = group(g, x, y, z, ry);
		add(pg, rbox(0.62, 0.82, 0.03, 0.01), mat("#111", 0.4), 0, 0, 0, { cast: false });
		add(pg, new THREE.PlaneGeometry(0.54, 0.74), new THREE.MeshStandardMaterial({ map: tex.art(seed), roughness: 0.6 }), 0, 0, 0.017, { cast: false });
	});


	// ---------------------------------------------------------------- two gaming PCs on the south wall
	// sit down and the PC's screen opens (worldPCGames.js); the monitor shows your game, or for everyone else your
	// name, the game and your score
	const PK0 = "z:games:pc";
	const pcState = i => { const s = ctx.get(PK0 + i); return s && Date.now() - s.at < 60000 ? s : null; };
	const deskM = mat("#1c1b29", 0.35, 0.3), rgbM = [];
	const gameName = id => (PC_GAMES.find(x => x.id === id) || { name: "a game" }).name;
	// the PC I'm sitting at (one screen controller, for whichever PC that is)
	let myPc = -1;
	const ctl = createPC(ctx, { onState: s => { if (myPc >= 0) ctx.setShared(PK0 + myPc, s); }, title: () => "Gaming PC " + (myPc + 1) });
	const openPc = i => { myPc = i; ctl.menu(); };
	const monitors = PCS.map((P, i) => {
		const d = group(g, P.x, 0, PCZ);
		// the desk: black top on two legs, an RGB strip along its front edge
		add(d, rbox(1.4, 0.05, 0.7, 0.015), deskM, 0, 0.74, 0);
		for (const sx of [-0.66, 0.66]) add(d, new THREE.BoxGeometry(0.05, 0.72, 0.62), deskM, sx, 0.36, 0);
		const strip = new THREE.MeshBasicMaterial({ color: "#ff4fd8", toneMapped: false });
		rgbM.push(strip);
		add(d, new THREE.BoxGeometry(1.36, 0.012, 0.012), strip, 0, 0.72, -0.35, { cast: false });
		// the monitor (on a stand) facing the chair
		const mon = group(d, 0, 0.77, 0.1);
		add(mon, new THREE.CylinderGeometry(0.12, 0.14, 0.015, 20), deskM, 0, 0.008, 0);
		add(mon, new THREE.BoxGeometry(0.05, 0.3, 0.04), deskM, 0, 0.16, 0.04);
		add(mon, rbox(0.7, 0.54, 0.04, 0.012), mat("#111018", 0.4), 0, 0.5, 0.0);
		const cv = document.createElement("canvas");
		cv.width = 512; cv.height = 384;
		const st = new THREE.CanvasTexture(cv);
		st.colorSpace = THREE.SRGBColorSpace;
		add(mon, new THREE.PlaneGeometry(0.64, 0.48), new THREE.MeshBasicMaterial({ map: st, toneMapped: false }), 0, 0.5, -0.021, { ry: Math.PI, cast: false, receive: false });
		// keyboard (glowing keys), mouse on a pad
		add(d, rbox(0.46, 0.025, 0.15, 0.008), mat("#15141f", 0.4), -0.05, 0.775, -0.12, { cast: false });
		const kb = new THREE.MeshBasicMaterial({ color: "#3ff0ff", toneMapped: false, transparent: true, opacity: 0.55 });
		rgbM.push(kb);
		add(d, new THREE.PlaneGeometry(0.43, 0.12), kb, -0.05, 0.789, -0.12, { rx: -Math.PI / 2, cast: false, receive: false });
		add(d, new THREE.PlaneGeometry(0.26, 0.22), mat("#2a2840", 0.9), 0.33, 0.766, -0.1, { rx: -Math.PI / 2, cast: false });
		add(d, new THREE.SphereGeometry(0.03, 12, 8), mat("#e9e3ff", 0.3), 0.33, 0.775, -0.1, { cast: false }).scale.set(0.8, 0.5, 1.2);
		// the tower on the desk's end: glass side, RGB fans
		const tw = group(d, 0.5, 0.765, 0.12);
		add(tw, rbox(0.2, 0.46, 0.4, 0.015), mat("#121119", 0.35, 0.4), 0, 0.23, 0);
		const fanM = new THREE.MeshBasicMaterial({ color: i ? "#3ff0ff" : "#ff4fd8", toneMapped: false });
		rgbM.push(fanM);
		for (const fz of [-0.09, 0.09]) add(tw, new THREE.TorusGeometry(0.065, 0.012, 6, 20), fanM, -0.102, 0.26, fz, { ry: Math.PI / 2, cast: false });
		k.box(P.x - 0.72, P.x + 0.72, PCZ - 0.38, HD);
		// the gaming chair, facing the desk
		const chZ = PCZ - 0.85;
		const ch = group(g, P.x, 0, chZ);
		const seatM = mat(i ? "#1d4ed8" : "#e63946", 0.6), blackM = mat("#16151d", 0.5);
		add(ch, new THREE.CylinderGeometry(0.03, 0.03, 0.36, 8), mat("#888888", 0.3, 0.8), 0, 0.22, 0);
		for (let j = 0; j < 5; j++) { const a = j / 5 * Math.PI * 2; add(ch, new THREE.BoxGeometry(0.04, 0.03, 0.3), blackM, Math.sin(a) * 0.14, 0.04, Math.cos(a) * 0.14, { ry: a, cast: false }); }
		add(ch, rbox(0.52, 0.1, 0.5, 0.04), blackM, 0, 0.44, 0);
		add(ch, rbox(0.42, 0.04, 0.42, 0.02), seatM, 0, 0.5, 0, { cast: false });
		add(ch, rbox(0.5, 0.82, 0.1, 0.05), blackM, 0, 0.9, -0.26, { rx: -0.1 });
		add(ch, rbox(0.2, 0.7, 0.02, 0.01), seatM, 0, 0.92, -0.2, { rx: -0.1, cast: false });
		add(ch, rbox(0.3, 0.14, 0.08, 0.04), seatM, 0, 1.24, -0.3, { rx: -0.1, cast: false });
		for (const sx of [-0.27, 0.27]) add(ch, rbox(0.06, 0.05, 0.32, 0.02), blackM, sx, 0.66, 0.02);
		k.box(P.x - 0.3, P.x + 0.3, chZ - 0.35, chZ + 0.25);
		k.spot({ id: P.id, x: P.x, z: chZ + 0.02, h: 0, y: 0.06 });
		k.interact("games:" + P.id, {
			label: () => { const s = pcState(i), who = ctx.whoSits(P.id); return who ? who.look.name + " is playing" + (s ? " " + gameName(s.game) : "") : "Play on gaming PC " + (i + 1); },
			stand: [P.x, chZ - 0.7],
			use: () => { const who = ctx.whoSits(P.id); if (who) { ctx.notice(`<b>${esc(who.look.name)}</b> is on that PC - take the other one and play together!`); return; } if (ctx.sitOn([P.id])) openPc(i); }
		}, d, ch);
		return { cv, st, i };
	});
	// a neon sign over the PCs
	{
		const neon = tex.text("GAMING", { w: 1024, h: 256, color: "#ffe1f7", glow: "#ff4fd8", font: "900 150px 'Nunito', sans-serif" });
		add(g, new THREE.PlaneGeometry(1.6, 0.4), new THREE.MeshBasicMaterial({ map: neon, transparent: true, toneMapped: false, depthWrite: false }), (PCS[0].x + PCS[1].x) / 2, 2.55, HD - 0.03, { ry: Math.PI, cast: false, receive: false });
	}
	function drawMonitor(M, t) {
		const c = M.cv.getContext("2d"), w = M.cv.width, h = M.cv.height;
		const mine = myPc === M.i ? ctl.canvas() : null;
		if (mine) { c.drawImage(mine, 0, 0, w, h); M.st.needsUpdate = true; return; }
		const s = pcState(M.i), who = ctx.whoSits(PCS[M.i].id);
		const gr = c.createLinearGradient(0, 0, w, h);
		gr.addColorStop(0, "#160f2e"); gr.addColorStop(1, "#06121c");
		c.fillStyle = gr; c.fillRect(0, 0, w, h);
		c.textAlign = "center"; c.textBaseline = "middle";
		if (s && who) {
			const info = PC_GAMES.find(x => x.id === s.game) || PC_GAMES[0];
			c.fillStyle = info.color; c.font = "900 50px Nunito, sans-serif"; c.fillText(info.name.toUpperCase(), w / 2, 100);
			c.fillStyle = "#ffffff"; c.font = "800 32px Nunito, sans-serif"; c.fillText(s.name.slice(0, 18) + " is playing", w / 2, 180);
			c.fillStyle = s.over ? "#ff8fab" : "#ffd166"; c.font = "900 60px Nunito, sans-serif"; c.fillText(s.over ? "GAME OVER  " + s.score : String(s.score), w / 2, 270);
		} else {
			// idle (or someone's choosing a game): a game controller, slowly changing colour
			const cx = w / 2, cy = 150;
			c.fillStyle = `hsl(${(t * 40 + M.i * 120) % 360},90%,65%)`;
			c.beginPath(); c.ellipse(cx - 70, cy + 10, 52, 48, 0, 0, Math.PI * 2); c.ellipse(cx + 70, cy + 10, 52, 48, 0, 0, Math.PI * 2); c.fill();
			c.fillRect(cx - 80, cy - 38, 160, 70);
			c.fillStyle = "#160f2e";
			c.fillRect(cx - 88, cy - 4, 40, 12); c.fillRect(cx - 74, cy - 18, 12, 40);
			for (const [dx, dy] of [[62, -6], [82, 8], [62, 22], [42, 8]]) { c.beginPath(); c.arc(cx + dx, cy + dy, 7, 0, Math.PI * 2); c.fill(); }
			c.fillStyle = "rgba(255,255,255,0.75)"; c.font = "800 30px Nunito, sans-serif"; c.fillText(who ? who.look.name.slice(0, 18) + " is picking a game" : "Sit down to play", w / 2, 240);
		}
		M.st.needsUpdate = true;
	}
	let monT = 1;

	// ---------------------------------------------------------------- light
	const L = {
		lane: k.light(LANE.x, H - 0.4, -1.5, "#d6e4ff", 3.0, 7),
		pins: k.light(LANE.x, 2.0, LANE.pinZ + 0.6, "#ffffff", 2.4, 3.5),
		table: k.light(TB.x, 1.75, TB.z, "#fff1d6", 3.2, 4.5),
		darts: k.light(DART.line + 1.2, 2.6, DART.z, "#ffe2c0", 2.0, 4),
		neon: k.light(2.75, 2.6, -HD + 0.6, "#3ff0ff", 1.6, 4.5),
		sofa: k.light(2.3, 2.4, HD - 1.2, "#ffcf8a", 1.8, 5),
		pcs: k.light((PCS[0].x + PCS[1].x) / 2, 2.2, PCZ - 0.9, "#c77dff", 1.6, 4)
	};
	k.lamp("table", L.table, [poolBulb], [pl], [TB.x + TB.hw + 0.75, TB.z + 0.8], "light over the table");
	k.key.pos.copy(k.V(0, H - 0.2, 0)); k.key.target.copy(k.V(0, 0, 0.3));
	k.key.angle = 1.25; k.key.intensity = 20; k.key.distance = 14; k.key.color.set("#ffe8cc");
	k.fill.pos.copy(k.V(0, 2.6, 1)); k.fill.intensity = 4; k.fill.distance = 16;
	k.hemi = 0.4; k.env = 0.28; k.exposure = 1.05;

	// ---------------------------------------------------------------- every frame
	const tmp = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
	function update(dt, t) {
		const T = Date.now();
		// the PCs: monitors (my own game every frame, the rest a few times a second), RGB colour cycling
		monT += dt;
		const playing = myPc >= 0 && ctl.canvas();
		if (playing) drawMonitor(monitors[myPc], t);
		if (monT > 0.25) { monT = 0; monitors.forEach(M => { if (!(playing && M.i === myPc)) drawMonitor(M, t); }); }
		rgbM.forEach((m, i) => m.color.setHSL((t * 0.12 + i * 0.13) % 1, 0.9, 0.6));
		// got up from the PC: its screen goes back to idle for everyone
		if (myPc >= 0 && ctx.me().sit !== PCS[myPc].id) { ctl.close(); if (ctx.get(PK0 + myPc)) ctx.setShared(PK0 + myPc, null); myPc = -1; }
		// bowling: the ball rolls down, the pins fly, the rack resets
		const b = bowl();
		if (b && b.id !== lastBowl) { lastBowl = b.id; drawScoreboard(); }
		const u = b ? (T - b.at) / 1000 : 99;
		if (b && u < 5.6) {
			if (bowlSounded !== b.id && u < 0.6) { bowlSounded = b.id; ctx.sfx("roll", 0.5); setTimeout(() => ctx.sfx(b.n ? "pins" : "thunk", b.n ? 0.6 : 0.3), Math.max(0, 1950 - u * 1000)); setTimeout(drawScoreboard, Math.max(0, 2650 - u * 1000)); }
			const p = Math.min(1, Math.max(0, (u - 0.3) / 2.1));
			bowlBall.position.set(LANE.x + b.off * 1.3 * p * p, 0.11, LANE.foul - 0.2 - p * (LANE.foul - 0.2 + HD - 0.3));
			bowlBall.rotation.x -= dt * 14 * (p < 1 ? 1 : 0);
			bowlBall.visible = p < 1;
			pins.forEach((pin, i) => {
				const hu = u - 1.95 - pin.userData.row * 0.05;
				const down = b.hit[i] && hu > 0 ? Math.min(1, hu / 0.35) : 0;
				const sweep = u > 4.6 ? Math.min(1, (u - 4.6) / 0.6) : 0;
				pin.rotation.set(-down * 1.45 * (1 - sweep), 0, pin.userData.dir * down * 0.6 * (1 - sweep));
				pin.position.copy(pin.userData.home);
				pin.position.z -= down * 0.18 * (1 - sweep);
				pin.position.x += pin.userData.dir * down * 0.08 * (1 - sweep);
				pin.visible = !(b.hit[i] && u > 3.8 && u < 4.6);
			});
		} else {
			bowlBall.visible = true;
			bowlBall.position.set(RACK.x, 0.91, RACK.z);
			pins.forEach(pin => { pin.visible = true; pin.rotation.set(0, 0, 0); pin.position.copy(pin.userData.home); });
		}
		// billiards: play the last shot out in step with everyone
		const s = shotState();
		if (s && Array.isArray(s.start)) {
			if (simId !== s.id) { simId = s.id; sim = simStart(s.start, s.shot); lastHits = 0; lastPotted = 0; }
			const want = Math.floor(((T - s.at) / 1000 - 0.45) * 120);
			let n = 0;
			while (!sim.done && sim.steps < want && n++ < 900) simStep(sim);
			if (sim.hits > lastHits) { ctx.sfx("clack", Math.min(0.7, 0.25 + (sim.hits - lastHits) * 0.1)); lastHits = sim.hits; }
			if (sim.potted.length > lastPotted) { ctx.sfx("thunk", 0.3); lastPotted = sim.potted.length; }
			const shown = sim.done ? finish(sim) : sim.b.map(p => [p.x, p.z, p.in ? 1 : 0]);
			balls.forEach((m, i) => { m.visible = !shown[i][2]; m.position.set(shown[i][0], TB.y + TB.r + 0.01, shown[i][1]); });
			// the cue: draws back and strikes, then goes away
			const cu = (T - s.at) / 1000;
			if (s.shot && cu < 0.7) {
				const sl = Math.hypot(s.shot[0], s.shot[1]) || 1, dx = s.shot[0] / sl, dz = s.shot[1] / sl;
				const back = cu < 0.45 ? 0.05 + cu * 0.3 : Math.max(0.01, 0.185 - (cu - 0.45) * 2);
				cue.visible = true;
				cue.position.set(s.start[0][0] - dx * (TB.r + back), TB.y + TB.r + 0.04, s.start[0][1] - dz * (TB.r + back));
				// (the cue runs back from its tip along -y: point +y at the ball, the butt raised a little)
				cue.quaternion.setFromUnitVectors(UP, tmp.set(dx, -0.12, dz).normalize());
			} else cue.visible = false;
		} else {
			const r9 = rack9();
			balls.forEach((m, i) => { m.visible = true; m.position.set(r9[i][0], TB.y + TB.r + 0.01, r9[i][1]); });
			cue.visible = false;
		}
		// darts: in flight, then stuck in the board
		const d = darts();
		const sig = d ? d.id + d.list.length : "";
		if (sig !== dartSig) { dartSig = sig; drawDartScore(); }
		dartMeshes.forEach((dm, i) => {
			const x = d && d.list[i];
			if (!x) { dm.visible = false; return; }
			dm.visible = true;
			const bx = HW - 0.06, by = DART.y + x.v, bz = DART.z + x.u;   // (the board's u runs along +z)
			const fu = Math.min(1, (T - x.at) / 350);
			if (fu < 1) {
				const sx = x.fx - k.ox, sz = x.fz - k.oz;
				dm.position.set(sx + (bx - sx) * fu, 1.5 + (by - 1.5) * fu + Math.sin(fu * Math.PI) * 0.15, sz + (bz - sz) * fu);
			} else {
				dm.position.set(bx - 0.06, by, bz);
				if (!dm.userData.stuck || dm.userData.stuck !== x.at) { dm.userData.stuck = x.at; ctx.sfx("thunk", 0.35); }
			}
		});
	}

	return {
		update,
		onEnter() { drawScoreboard(); drawDartScore(); },
		applyKey(key) { if (key === BS || key === BK) drawScoreboard(); if (key === DK) drawDartScore(); },
		promptOpts(opts) {
			const me = ctx.me();
			const free = key => !opts.some(o => o.k === key);
			// at a gaming PC: open its screen again, or take on whoever's at the other one
			const at = PCS.findIndex(P => P.id === me.sit);
			if (at >= 0) {
				const key = ["E", "F", "G"].find(free);
				if (key) opts.push({ k: key, label: "Play games on the PC", fn: () => openPc(at) });
				const other = ctx.whoSits(PCS[1 - at].id), key2 = ["G", "R"].find(free);
				if (other && key2) opts.push({ k: key2, label: "Play " + other.look.name + " (board games)", fn: () => ctx.openArcade() });
				return;
			}
			if (me.sit) return;
			// by the billiard table: rack them up again
			if (Math.hypot(me.x - (TB.x + k.ox), me.z - (TB.z + k.oz)) < 2.2 && free("R")) opts.push({ k: "R", label: "Rack the balls", fn: rackUp });
		},
		musicAt() { return 0.3; }
	};
}
