/**
 * Harmony World — the Parkour Park: one long, hard parkour course over a grass field, out past the ring road south
 * of the estate (east of the airfield road's line, north of the airfield). Outdoors.
 *
 * Local coordinates (origin at world -130, -201): x -70..70, z -31..31, inside a low fence; the gate is in the east
 * side (x 70) at z -1.6..1.6, at the end of the path from the airfield road. The start plaza (x 50..70) is dry land
 * (the arch, the start pad, the leaderboard, benches); everything west of it is the course, high over the grass:
 *   1  west along the north side: a staircase of jumps, a beam, zig-zag posts, sliding platforms, vanishing platforms,
 *      a bounce pad up onto a high ledge and a line of long jumps
 *   2  up the diagonal to the tower, then round and round a spiral of floating slabs, about 15 m up
 *   3  off the top to the west, south in a line of drops, then east along the south side, high up: more sliders, more
 *      vanishing platforms, a bounce pad, a climb, a beam, falling posts and the finish tower
 * Every block is a box you can stand on (topAt: the world lands you on its top), and a wall to anything below its top
 * (solidAt). Sliders and vanishing platforms run on the wall clock (Date.now), so everyone sees the same ones; a slider
 * carries you along. Step off the start pad and the clock starts; touch a flag and that's where a fall puts you back;
 * fall down onto the grass and you're back at your last checkpoint. The five best times are shared (KEY + "top"); your own
 * best is kept in this browser. The jumping itself is world.js's (jump(): gravity, momentum, hold for higher, onLand).
 */
import { getLang, setLang, L, TX, langBtns } from "./worldLang.js";

const OX = -130, OZ = -201;                         // = ZONES.parkour ox / oz
const X0 = -70, X1 = 70, Z0 = -31, Z1 = 31;
const GATE = { z0: -1.6, z1: 1.6 };
const WATER = [X0, 50, Z0, Z1];                     // fall onto the grass anywhere here: back to your checkpoint
const KEY = "z:pk:";
const STEP = 0.45, AIR_STEP = 0.3;                  // = world.js STEP_UP, and the ledge you can scramble onto mid-air
const TAU = Math.PI * 2;
const fmt = ms => { const s = Math.max(0, ms / 1000); return Math.floor(s / 60) + ":" + (s % 60).toFixed(2).padStart(5, "0"); };
const clockS = () => Date.now() / 1000;

// ================================================================ the course
// a block: { x0, x1, z0, z1 (where it is now), cx, cz, sx, sz (its middle at rest and its size), y0 (bottom), top, col,
// kind: "start" | "finish" | "cp" | "bounce" | undefined, v (bounce), move: { ax, az, p, ph }, blink: { p, on, ph } }
const B = [];
function put(cx, cz, sx, sz, top, o = {}) {
	const b = Object.assign({ cx, cz, sx, sz, top, y0: o.slab ? Math.max(0, top - 0.4) : 0, x0: cx - sx / 2, x1: cx + sx / 2, z0: cz - sz / 2, z1: cz + sz / 2 }, o);
	B.push(b);
	return b;
}
// the next block, a clear gap of `gap` metres on from the last one's edge, heading `ang` degrees (0: east, 90: +z,
// 180: west, 270: -z)
let cur = null;
function next(ang, gap, sx, sz, top, o) {
	const a = ang * Math.PI / 180, ux = Math.cos(a), uz = Math.sin(a);
	const half = (w, d) => Math.min(Math.abs(ux) > 1e-6 ? w / 2 / Math.abs(ux) : 1e9, Math.abs(uz) > 1e-6 ? d / 2 / Math.abs(uz) : 1e9);
	const d = half(cur.sx, cur.sz) + gap + half(sx, sz);
	return (cur = put(cur.cx + ux * d, cur.cz + uz * d, sx, sz, top, o));
}
const COL = ["#46c46a", "#3ad0c0", "#3a8aff", "#9a5aff", "#ff5aa8", "#ff7a3a", "#ffc23a"];
let seg = 0;
const col = () => ({ col: COL[seg % COL.length] });
const mv = (ax, az, p, ph) => ({ move: { ax, az, p, ph }, col: "#e8e8f0" });
const bl = ph => ({ blink: { p: 4, on: 3, ph }, col: "#ff4a6a" });   // (there 3 s, gone 1 s)
const cp = () => Object.assign(col(), { kind: "cp" });
const TOWER = {};
{
	// ---- 1: west along the north side
	cur = put(54.5, 22, 5, 6, 0.3, { kind: "start", col: "#ffffff" });
	for (let i = 0; i < 4; i++) next(180, 1.6, 1.6, 3, cur.top + 0.6, col());                        // a staircase of jumps
	next(180, 1.4, 6, 0.5, cur.top, col());                                                        // a beam
	[[195, 0], [165, 0.4], [195, -0.4], [165, 0.6]].forEach(([a, dy]) => next(a, 1.7, 0.8, 0.8, cur.top + dy, col()));   // zig-zag posts
	next(180, 1.6, 3, 4, cur.top, cp()); seg++;
	next(180, 1.8, 2, 2, cur.top, mv(0, 2.5, 5, 0));                                                 // two sliders
	next(180, 1.8, 2, 2, cur.top, mv(0, 2.5, 5, 0.5));
	for (let i = 0; i < 3; i++) next(180, 1.8, 1.8, 2, cur.top, bl(i));                              // vanishing platforms
	const pad = next(180, 2.0, 2.8, 3, 0.6, Object.assign(col(), { kind: "bounce", v: 15 }));        // down onto a bounce pad...
	next(180, 1.0, 3.6, 4, pad.top + 4.0, cp()); seg++;                                              // ...up onto the high ledge
	for (let i = 0; i < 4; i++) next(180, 2.1, 1, 1, cur.top, col());                                // long jumps
	next(180, 2.1, 2.5, 4, cur.top, col()); seg++;
	// ---- 2: up the diagonal to the tower, and round its spiral
	for (let i = 0; i < 6; i++) next(225, 1.0, 1.2, 1.2, cur.top + 0.4, col());
	const s0 = next(225, 1.0, 1.2, 1.2, cur.top + 0.4, Object.assign(col(), { slab: true }));
	TOWER.r = 4.2; TOWER.x = s0.cx - TOWER.r; TOWER.z = s0.cz; TOWER.n = 16;
	seg++;
	for (let i = 1; i < TOWER.n; i++) {
		const a = -i * TAU / 10, x = TOWER.x + Math.cos(a) * TOWER.r, z = TOWER.z + Math.sin(a) * TOWER.r;
		cur = put(x, z, 1.2, 1.2, s0.top + 0.55 * i, Object.assign(i === 8 ? cp() : col(), { slab: true }));
	}
	TOWER.top = cur.top;
	seg++;
	// ---- 3: down off the top, south in a line of drops, then east along the south side
	next(180, 2.4, 3, 3, cur.top - 1.5, Object.assign(cp(), { slab: true }));                         // (out to the west, clear of the spiral)
	for (let i = 0; i < 6; i++) next(270, 2.2, 1.2, 1.2, cur.top - 0.5, Object.assign(col(), { slab: true }));
	next(270, 1.6, 3, 3, cur.top, col()); seg++;
	next(0, 2.0, 2, 2, cur.top, mv(0, 2.0, 4, 0));
	next(0, 2.0, 2, 2, cur.top, mv(0, 2.0, 4, 0.5));
	next(0, 1.6, 3, 4, cur.top, cp()); seg++;
	for (let i = 0; i < 3; i++) next(0, 1.9, 1.4, 1.4, cur.top, bl(i * 0.8));
	const pad2 = next(0, 2.0, 2.6, 3, cur.top - 4, Object.assign(col(), { kind: "bounce", v: 13 }));
	next(0, 1.0, 3, 4, pad2.top + 3.0, col());
	for (let i = 0; i < 3; i++) next(0, 1.3, 1, 3, cur.top + 0.8, col());                            // a climb
	next(0, 1.2, 3, 4, cur.top, cp()); seg++;
	next(0, 1.2, 8, 0.4, cur.top, col());                                                          // a long thin beam
	for (let i = 0; i < 4; i++) next(0, 2.1, 0.8, 0.8, cur.top - 0.6, col());                        // falling posts
	next(0, 1.9, 2, 2, cur.top, mv(0, 3.0, 4.5, 0.25));
	next(0, 1.9, 1.4, 1.4, cur.top, bl(1.5));
	next(0, 1.6, 4, 4, cur.top, { kind: "finish", col: "#ffd23a" });
}
const START = B[0], FINISH = B[B.length - 1];
const CPS = B.filter(b => b.kind === "cp");
// where a block is at time s (sliders slide; vanishing platforms come and go)
function placeDyn(b, s) {
	if (b.move) { const k = Math.sin(TAU * (s / b.move.p + b.move.ph)); const x = b.cx + b.move.ax * k, z = b.cz + b.move.az * k; b.x0 = x - b.sx / 2; b.x1 = x + b.sx / 2; b.z0 = z - b.sz / 2; b.z1 = z + b.sz / 2; }
	if (b.blink) { const u = ((s + b.blink.ph) % b.blink.p + b.blink.p) % b.blink.p; b.off = u >= b.blink.on; b.warn = !b.off && u > b.blink.on - 0.6; }
}
const DYN = B.filter(b => b.move || b.blink);
// a quick lookup for the ones that stay put (4 m cells)
const CELL = 4, grid = new Map();
B.forEach(b => {
	if (b.move || b.blink) return;
	for (let i = Math.floor((b.x0 - 1) / CELL); i <= Math.floor((b.x1 + 1) / CELL); i++)
		for (let j = Math.floor((b.z0 - 1) / CELL); j <= Math.floor((b.z1 + 1) / CELL); j++) {
			const k = i * 1000 + j, l = grid.get(k);
			if (l) l.push(b); else grid.set(k, [b]);
		}
});
function near(x, z) { const l = grid.get(Math.floor(x / CELL) * 1000 + Math.floor(z / CELL)) || []; return DYN.length ? l.concat(DYN) : l; }
const inB = (b, x, z, m) => !b.off && x > b.x0 - m && x < b.x1 + m && z > b.z0 - m && z < b.z1 + m;
// the block you're standing on at (x, z, y), if any
const blockUnder = (x, z, y) => { let best = null; for (const b of near(x, z)) if (inB(b, x, z, 0.12) && Math.abs(b.top - y) < 0.06 && (!best || b.top > best.top)) best = b; return best; };

const CSS = `
#pkHud { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); width: 240px; padding: 12px 14px; pointer-events: auto; display: grid; gap: 8px; }
#pkHud .ph-h { display: flex; align-items: center; gap: 8px; }
#pkHud .ph-h b { flex: 1; font-size: 14px; font-weight: 900; }
#pkHud .ph-t { font: 900 26px "Nunito", sans-serif; font-variant-numeric: tabular-nums; display: flex; align-items: baseline; gap: 8px; }
#pkHud .ph-t small { font-size: 12px; color: var(--muted); font-weight: 800; }
#pkHud .ph-bar { display: flex; gap: 3px; }
#pkHud .ph-bar i { flex: 1; height: 6px; border-radius: 9px; background: rgba(255,255,255,.12); }
#pkHud .ph-bar i.on { background: linear-gradient(90deg, var(--accent), var(--accent2)); }
#pkHud .ph-s { font-size: 12.5px; color: var(--muted); line-height: 1.45; }
#pkHud .ph-s b { color: var(--text); }
#pkHud .ph-b { display: flex; flex-wrap: wrap; gap: 6px; }
#pkHud .ph-b .btn { padding: 7px 10px; font-size: 12.5px; border-radius: 10px; }
#pkHud kbd, .pk-tips kbd { display: inline-grid; place-items: center; min-width: 20px; height: 20px; padding: 0 5px; border-radius: 5px; background: #fff; color: #2a1f33; font: 900 11px "Nunito", sans-serif; }
.esc-lang { display: inline-flex; border: 1px solid var(--line); border-radius: 10px; overflow: hidden; }
.esc-lang button { border: none; background: transparent; padding: 6px 9px; font: 900 12px "Nunito", sans-serif; color: var(--muted); cursor: pointer; }
.esc-lang button.on { background: rgba(255,122,162,.3); color: var(--text); }
.pk-tbl { width: 100%; border-collapse: collapse; margin: 0 0 12px; font-size: 14px; }
.pk-tbl td, .pk-tbl th { padding: 8px 10px; border-bottom: 1px solid var(--line); text-align: left; }
.pk-tbl th { color: var(--muted); font-size: 12px; text-transform: uppercase; }
.pk-tips { line-height: 1.8; margin: 0 0 8px; }
@media (max-width: 640px) { #pkHud { left: auto; right: 10px; top: 64px; transform: none; width: 190px; } #pkHud .ph-s { display: none; } }
`;
function fitText(c, w, h, text, o = {}) {
	let size = o.size || h * 0.62;
	const font = s => `${o.weight || 900} ${s}px ${o.family || "Nunito, 'Segoe UI', sans-serif"}`;
	c.font = font(size);
	while (c.measureText(text).width > w * 0.92 && size > 8) { size -= 3; c.font = font(size); }
	c.textAlign = o.align || "center"; c.textBaseline = "middle";
	if (o.glow) { c.shadowColor = o.glow; c.shadowBlur = 24; }
	c.fillStyle = o.color || "#fff";
	c.fillText(text, o.x !== undefined ? o.x : w / 2, o.y !== undefined ? o.y : h / 2 + 4);
	c.shadowBlur = 0;
}
const NAME = ["Extreme Parkour", "Ekstrem Parkur"];

export function build(k) {
	const { THREE, add, mat, group, rbox, g, ctx, canvasTex, rng } = k;
	const glow = (c, o) => new THREE.MeshBasicMaterial(Object.assign({ color: c, toneMapped: false }, o || {}));
	const esc = s => ctx.esc(String(s));
	k.floor(() => 0);
	k.walk(X0 + 0.4, X1 - 0.4, Z0 + 0.4, Z1 - 0.4);
	k.walk(X1 - 1.2, X1 + 0.6, GATE.z0, GATE.z1);   // in through the gate
	k.cam = { minX: X0 - 4, maxX: X1 + 4, minZ: Z0 - 4, maxZ: Z1 + 4, maxY: 26, minY: 0.2 };
	if (!document.getElementById("pkCss")) { const s = document.createElement("style"); s.id = "pkCss"; s.textContent = CSS; document.head.appendChild(s); }
	const R = rng(4242);
	const unit = new THREE.BoxGeometry(1, 1, 1);
	const mats = {};
	const matOf = (c, rough = 0.55) => mats[c + rough] || (mats[c + rough] = mat(c, rough, 0.05));
	const lighter = c => { const col = new THREE.Color(c); col.lerp(new THREE.Color("#ffffff"), 0.35); return "#" + col.getHexString(); };
	// pictures redrawn when the language changes (or state() does)
	const live = [];
	const liveTex = (w, h, draw, state) => { const cv = document.createElement("canvas"); cv.width = w; cv.height = h; const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; const r = { cv, t, draw, state, key: null }; live.push(r); paint(r); return t; };
	function paint(r) { const key = getLang() + "|" + (r.state ? r.state() : ""); if (key === r.key) return; r.key = key; const c = r.cv.getContext("2d"); c.clearRect(0, 0, r.cv.width, r.cv.height); r.draw(c, r.cv.width, r.cv.height); r.t.needsUpdate = true; }
	const signM = (fn, o = {}) => new THREE.MeshBasicMaterial({ map: liveTex(o.w || 1024, o.h || 256, (c, w, h) => { if (o.bg) { c.fillStyle = o.bg; c.fillRect(0, 0, w, h); } fitText(c, w, h, fn(), o); }), transparent: !o.bg, depthWrite: !!o.bg, toneMapped: false });

	// ================================================================ the grass, the plaza, the fence
	const turf = canvasTex(512, 512, (c, w, h) => {
		c.fillStyle = "#4a8a3a"; c.fillRect(0, 0, w, h);
		for (let n = 0; n < 4000; n++) { c.fillStyle = `rgba(${30 + R() * 40},${90 + R() * 60},${30 + R() * 30},0.5)`; c.fillRect(R() * w, R() * h, 2, 4); }
	}, 28, 12);
	add(g, new THREE.PlaneGeometry(X1 - X0, Z1 - Z0), mat("#ffffff", 0.95, 0, { map: turf }), (X0 + X1) / 2, 0.005, 0, { rx: -Math.PI / 2, cast: false }).userData.floor = true;
	add(g, new THREE.PlaneGeometry(14, Z1 - Z0 - 2), matOf("#b84a3a", 0.9), 59, 0.012, 0, { rx: -Math.PI / 2, cast: false }).userData.floor = true;
	{
		const postM = mat("#2a2a30", 0.5, 0.4), railM = mat("#e8e2d0", 0.5);
		const side = (ax, a, b, c) => {
			const n = Math.max(1, Math.round((b - a) / 2.5));
			for (let i = 0; i <= n; i++) { const u = a + (b - a) * i / n; add(g, new THREE.CylinderGeometry(0.05, 0.05, 1.1, 6), postM, ax ? u : c, 0.55, ax ? c : u, { cast: false }); }
			for (const y of [0.45, 1.0]) add(g, unit, railM, ax ? (a + b) / 2 : c, y, ax ? c : (a + b) / 2, { cast: false }).scale.set(ax ? b - a : 0.05, 0.05, ax ? 0.05 : b - a);
			k.box(ax ? a : c - 0.1, ax ? b : c + 0.1, ax ? c - 0.1 : a, ax ? c + 0.1 : b);
		};
		side(true, X0, X1, Z1); side(true, X0, X1, Z0); side(false, Z0, Z1, X0);
		side(false, Z0, GATE.z0, X1); side(false, GATE.z1, Z1, X1);
	}

	// ================================================================ the blocks
	const flags = [], dynMesh = [];
	B.forEach((b, bi) => {
		const h = b.top - b.y0, c = b.col || "#888888";
		const grp = group(g, b.cx, 0, b.cz);
		const own = b.blink ? new THREE.MeshStandardMaterial({ color: c, roughness: 0.5, transparent: true, opacity: 1 }) : matOf(c);
		const body = add(grp, unit, own, 0, b.y0 + (h - 0.06) / 2, 0); body.scale.set(b.sx, h - 0.06, b.sz);
		const capC = b.kind === "bounce" ? "#ffd23a" : b.kind === "start" ? "#ffffff" : b.kind === "cp" ? "#ffe86a" : b.move ? "#7ae5ff" : lighter(c);
		let capM = b.kind === "bounce" || b.move ? glow(capC) : b.blink ? own : matOf(capC, 0.45);
		if (b.kind === "finish") capM = new THREE.MeshStandardMaterial({ map: canvasTex(128, 128, (cc) => { for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) { cc.fillStyle = (i + j) % 2 ? "#111" : "#fff"; cc.fillRect(i * 32, j * 32, 32, 32); } }, 3, 3), roughness: 0.5 });
		const cap = add(grp, unit, capM, 0, b.top - 0.03, 0, { cast: false }); cap.scale.set(b.sx, 0.06, b.sz);
		if (b.slab && b.y0 > 0.4) add(grp, new THREE.CylinderGeometry(0.05, 0.05, b.y0, 6), matOf("#3a3a40"), 0, b.y0 / 2, 0, { cast: false });
		if (b.kind === "bounce") for (const y of [0.2, 0.42]) add(grp, new THREE.TorusGeometry(Math.min(b.sx, b.sz) * 0.32, 0.04, 6, 18), matOf("#d8d8e0", 0.3), 0, y, 0, { rx: Math.PI / 2, cast: false });
		if (b.kind === "cp") {
			const m = glow("#ff4a4a", { side: THREE.DoubleSide }), fx = -b.sx / 2 + 0.25, fz = -b.sz / 2 + 0.25;
			add(grp, new THREE.CylinderGeometry(0.03, 0.03, 1.6, 6), matOf("#d8d8e0", 0.3), fx, b.top + 0.8, fz, { cast: false });
			add(grp, new THREE.PlaneGeometry(0.6, 0.38), m, fx + 0.3, b.top + 1.4, fz, { cast: false });
			flags.push({ b, m });
		}
		if (b.move || b.blink) dynMesh.push({ b, grp, own });
	});
	// the tower's pillar, the bell over the finish, the start arch
	add(g, new THREE.CylinderGeometry(0.9, 1.1, TOWER.top + 1.5, 16), matOf("#5a3a6a", 0.6), TOWER.x, (TOWER.top + 1.5) / 2, TOWER.z);
	const bellG = group(g, FINISH.cx, FINISH.top, FINISH.cz);
	for (const sx of [-1.2, 1.2]) add(bellG, new THREE.CylinderGeometry(0.06, 0.06, 2.4, 6), matOf("#d8b04a", 0.3), sx, 1.2, 0, { cast: false });
	add(bellG, unit, matOf("#d8b04a", 0.3), 0, 2.4, 0, { cast: false }).scale.set(2.5, 0.1, 0.1);
	const bell = add(bellG, new THREE.CylinderGeometry(0.15, 0.42, 0.6, 16, 1, true), new THREE.MeshStandardMaterial({ color: "#e8c04a", metalness: 0.9, roughness: 0.25, side: THREE.DoubleSide }), 0, 2.0, 0, { cast: false });
	add(bellG, new THREE.PlaneGeometry(3.2, 0.6), signM(() => L("FINISH", "BİTİŞ"), { color: "#ffffff", glow: "#ffd23a", size: 150 }), 0, 3.0, 0, { ry: -Math.PI / 2, cast: false, receive: false });
	{
		const archM = matOf("#1a1a20", 0.5), sx = START.cx, sz = START.cz;
		for (const dz of [-3.3, 3.3]) { add(g, unit, archM, sx, 2.2, sz + dz).scale.set(0.4, 4.4, 0.4); k.box(sx - 0.2, sx + 0.2, sz + dz - 0.2, sz + dz + 0.2); }
		add(g, unit, archM, sx, 4.5, sz).scale.set(0.5, 0.9, 7.0);
		for (const s of [1, -1]) add(g, new THREE.PlaneGeometry(6.2, 0.75), signM(() => L("START: EXTREME PARKOUR", "BAŞLANGIÇ: EKSTREM PARKUR"), { color: "#ffffff", glow: "#ff5a5a", w: 2048, h: 256, size: 170 }), sx + s * 0.26, 4.5, sz, { ry: s * Math.PI / 2, cast: false, receive: false });
	}
	// the arch over the gate, the leaderboard, benches
	{
		const archM = matOf("#1a1a20", 0.5);
		for (const z of [-2.4, 2.4]) { add(g, unit, archM, X1 - 1.5, 2.2, z).scale.set(0.4, 4.4, 0.4); k.box(X1 - 1.7, X1 - 1.3, z - 0.2, z + 0.2); }
		add(g, unit, archM, X1 - 1.5, 4.5, 0).scale.set(0.5, 0.9, 5.4);
		for (const s of [1, -1]) add(g, new THREE.PlaneGeometry(5.0, 0.75), signM(() => L("PARKOUR PARK", "PARKUR PARKI"), { color: "#ffffff", glow: "#ffb23a", w: 2048, h: 320, size: 230 }), X1 - 1.5 + s * 0.26, 4.5, 0, { ry: s * Math.PI / 2, cast: false, receive: false });
	}
	const top5 = () => { const v = ctx.get(KEY + "top"); return Array.isArray(v) ? v.filter(e => e && typeof e.t === "number").slice(0, 5) : []; };
	const boardT = liveTex(1024, 768, (c, w, h) => drawBoard(c, w, h), () => JSON.stringify(ctx.get(KEY + "top") || []));
	const boardG = group(g, 58, 0, 6, Math.PI / 2);
	for (const sx of [-1.6, 1.6]) add(boardG, new THREE.CylinderGeometry(0.07, 0.07, 3.2, 8), matOf("#2a2a30"), sx, 1.6, 0, { cast: false });
	add(boardG, rbox(3.6, 2.7, 0.1, 0.03), matOf("#1a1620"), 0, 2.0, 0);
	const boardMesh = add(boardG, new THREE.PlaneGeometry(3.4, 2.55), new THREE.MeshBasicMaterial({ map: boardT, toneMapped: false }), 0, 2.0, 0.06, { cast: false });
	k.box(57.6, 58.4, 4.2, 7.8);
	for (const [x, z] of [[64, -10], [64, 10], [58, -12]]) {
		const bn = group(g, x, 0, z);
		add(bn, rbox(1.8, 0.08, 0.5, 0.02), matOf("#8a5a32", 0.7), 0, 0.45, 0);
		for (const sx of [-0.75, 0.75]) add(bn, unit, matOf("#2a2a30"), sx, 0.22, 0).scale.set(0.08, 0.44, 0.45);
		k.box(x - 0.95, x + 0.95, z - 0.3, z + 0.3);
	}
	function drawBoard(c, w, h) {
		c.fillStyle = "#16121e"; c.fillRect(0, 0, w, h);
		fitText(c, w, 120, TX(NAME).toUpperCase(), { y: 64, size: 70, color: "#ff5a5a", glow: "#ff5a5a" });
		fitText(c, w, 60, L("BEST TIMES", "EN İYİ SÜRELER"), { y: 128, size: 40, color: "#ffd36b" });
		const T5 = top5();
		for (let i = 0; i < 5; i++) {
			const y = 210 + i * 92, e = T5[i];
			fitText(c, 100, 80, String(i + 1), { x: 90, y, size: 56, color: ["#ffd23a", "#d8d8e0", "#d8904a", "#b9adc9", "#b9adc9"][i] });
			fitText(c, 520, 80, e ? String(e.by).slice(0, 20) : "-", { align: "left", x: 150, y, size: 46, weight: 800 });
			fitText(c, 300, 80, e ? fmt(e.t) : "--:--", { align: "right", x: w - 60, y, size: 50, color: "#7ae582" });
		}
		fitText(c, w, 60, L("Space: jump (hold for higher) · Shift: run", "Boşluk: zıpla (yükseğe için basılı tut) · Shift: koş"), { y: h - 36, size: 30, color: "#b9adc9", weight: 700 });
	}

	// ================================================================ your run (only yours: the clock, the checkpoints)
	let run = null;          // { t0 (0: ready on the pad), cp: [x, z, y], cps: Set }
	let lastBlock = null;
	const nowMs = () => performance.now();
	let mine = (() => { try { return +localStorage.getItem("harmonyPkBest2") || 0; } catch (e) { return 0; } })();
	const startSpot = () => [START.cx, START.cz, START.top];
	function respawn(p, msg) {
		const m = ctx.me();
		m.x = OX + p[0]; m.z = OZ + p[1]; m.y = p[2]; m.air = false; m.vy = 0; m.avx = 0; m.avz = 0; m.speed = 0;
		m.path = []; m.target = null; m.targetAct = null;
		ctx.sfx("thunk", 0.5);
		if (msg) ctx.toast(msg, null, null, 3000);
		lastBlock = null;
	}
	function onBlock(b) {
		if (b === START) {
			if (!run || run.t0) ctx.toast(L("<b>Extreme Parkour</b>: step off the pad to start the clock. Good luck!", "<b>Ekstrem Parkur</b>: saati başlatmak için platformdan in. Bol şans!"), null, null, 3500);
			run = { t0: 0, cp: startSpot(), cps: new Set() };
			return;
		}
		if (!run || !run.t0) return;
		if (b.kind === "cp" && !run.cps.has(b)) {
			run.cps.add(b); run.cp = [b.cx, b.cz, b.top];
			ctx.sfx("chime", 0.5); ctx.toast(L(`Checkpoint ${run.cps.size} of ${CPS.length}!`, `Kontrol noktası: ${CPS.length} noktadan ${run.cps.size}.!`), null, null, 2200);
		}
		if (b === FINISH) finish();
	}
	function finish() {
		const t = Math.round(nowMs() - run.t0), name = String(ctx.profile().name || "Someone").slice(0, 24), T5 = top5();
		const rank = T5.filter(e => e.t <= t).length;
		if (rank < 5) {
			ctx.setShared(KEY + "top", T5.slice(0, rank).concat([{ t, by: name }], T5.slice(rank)).slice(0, 5));
			if (rank === 0) ctx.send({ t: "fx", kind: "sys", text: L(`${name} set a new Extreme Parkour record: ${fmt(t)}!`, `${name} Ekstrem Parkur'da yeni rekor kırdı: ${fmt(t)}!`) });
		}
		const pb = !mine || t < mine;
		if (pb) { mine = t; try { localStorage.setItem("harmonyPkBest2", String(t)); } catch (e) { /* no storage */ } }
		ctx.sfx("yes", 0.7); ctx.sfx("chime", 0.9); ctx.doUpper("cheer", 2400); bellT = 0;
		ctx.toast(L(`<b>You made it!</b> ${fmt(t)}`, `<b>Başardın!</b> ${fmt(t)}`) + (rank === 0 ? L(" - a new park record!", " - yeni park rekoru!") : rank < 5 ? L(` - #${rank + 1} on the board!`, ` - tabloda ${rank + 1}. sırada!`) : pb ? L(" - your best yet!", " - kendi rekorun!") : ""), null, null, 8000);
		run = null;
	}
	function restart() { run = { t0: 0, cp: startSpot(), cps: new Set() }; respawn(startSpot()); }

	// ================================================================ the panel
	const hud = document.createElement("div");
	hud.id = "pkHud"; hud.className = "chip hidden";
	(document.getElementById("hud") || document.body).appendChild(hud);
	hud.addEventListener("pointerdown", e => e.stopPropagation());
	let hudSig = "";
	hud.addEventListener("click", e => {
		const lb = e.target.closest("[data-lang]");
		if (lb) { setLang(lb.dataset.lang); hudSig = ""; return; }
		const a = e.target.closest("[data-a]");
		if (!a) return;
		if (a.dataset.a === "restart") restart();
		else if (a.dataset.a === "quit") run = null;
		else if (a.dataset.a === "board") openBoard();
	});
	function renderHud(inside) {
		if (!inside) { if (!hud.classList.contains("hidden")) { hud.classList.add("hidden"); hudSig = ""; } return; }
		hud.classList.remove("hidden");
		const sig = [getLang(), run ? (run.t0 ? "go" : "ready") + run.cps.size : ""].join("/");
		if (sig !== hudSig) {
			hudSig = sig;
			const T5 = top5(), rec = T5[0];
			const bar = `<div class="ph-bar">${CPS.map((b, i) => `<i class="${run && i < run.cps.size ? "on" : ""}"></i>`).join("")}</div>`;
			hud.innerHTML = `<div class="ph-h"><b>${TX(NAME)}</b></div>
				<div class="ph-t"><span></span><small>${run ? (run.t0 ? L("on the clock", "süre işliyor") : L("ready", "hazır")) : ""}</small></div>${run ? bar : ""}
				<div class="ph-s">${run ? (run.t0 ? L(`Checkpoints: <b>${run.cps.size} / ${CPS.length}</b>`, `Kontrol noktaları: <b>${run.cps.size} / ${CPS.length}</b>`) : L("Step off the start pad to start the clock.", "Saati başlatmak için başlangıç platformundan in.")) : L("Stand on the white start pad under the arch to race the course. Fall onto the grass and you're back at your last checkpoint.", "Parkurda yarışmak için kemerin altındaki beyaz başlangıç platformuna çık. Çimlere düşersen son kontrol noktana dönersin.")}<br>${L("Record:", "Rekor:")} <b>${rec ? fmt(rec.t) : "--"}</b>${mine ? L(` · yours: <b>${fmt(mine)}</b>`, ` · seninki: <b>${fmt(mine)}</b>`) : ""}</div>
				<div class="ph-b">${run ? `<button class="btn" data-a="restart">${L("Restart", "Baştan")} (R)</button><button class="btn ghost" data-a="quit">${L("Stop", "Bırak")}</button>` : `<button class="btn" data-a="board">${L("Best times", "En iyi süreler")}</button>`}${langBtns()}</div>`;
		}
		const te = hud.querySelector(".ph-t span");
		if (te) te.textContent = run ? (run.t0 ? fmt(nowMs() - run.t0) : "0:00.00") : "";
	}
	function openBoard() {
		const rows = top5().map((e, i) => `<tr><td>${i + 1}</td><td>${esc(e.by)}</td><td><b>${fmt(e.t)}</b></td></tr>`).join("") || `<tr><td colspan="3">${L("Nobody has finished yet. Be the first!", "Henüz kimse bitiremedi. İlk sen ol!")}</td></tr>`;
		const body = ctx.openModal("parkour", TX(NAME), `<div style="display:flex;justify-content:flex-end;margin-bottom:8px">${langBtns()}</div><table class="pk-tbl"><tr><th>#</th><th>${L("Player", "Oyuncu")}</th><th>${L("Time", "Süre")}</th></tr>${rows}</table>
			<p style="margin:0 0 10px">${L("Your best:", "Senin rekorun:")} <b>${mine ? fmt(mine) : "--"}</b></p>
			<div class="pk-tips"><kbd>Space</kbd> ${L("jump. Hold it to jump higher, tap it for a small hop.", "zıpla. Daha yükseğe için basılı tut, küçük bir sıçrama için dokun.")}<br><kbd>Shift</kbd> ${L("run: every long gap needs a full-speed run-up.", "koş: her uzun boşluk tam hızda bir koşu ister.")}<br>${L("Steer in the air with the arrow keys / WASD. Just after running off an edge you can still jump.", "Havada yön tuşları / WASD ile yön ver. Bir kenardan koşarak çıktıktan hemen sonra hâlâ zıplayabilirsin.")}<br>${L("<b>White</b> platforms slide (they carry you), <b>red</b> ones vanish and come back, <b>yellow</b> pads bounce you high, flags are checkpoints.", "<b>Beyaz</b> platformlar kayar (seni taşır), <b>kırmızılar</b> kaybolup geri gelir, <b>sarı</b> platformlar seni yükseğe fırlatır, bayraklar kontrol noktasıdır.")}</div>`, 520);
		body.querySelectorAll("[data-lang]").forEach(bt => bt.onclick = () => { setLang(bt.dataset.lang); hudSig = ""; openBoard(); });
	}
	k.interact("parkour:board", { label: () => L("Read the leaderboard", "Skor tablosunu oku"), stand: [59.3, 6], face: -Math.PI / 2, reach: 3, use: openBoard }, boardMesh);

	// ================================================================ every frame
	let slow = 0, bellT = -1, welcomed = false;
	DYN.forEach(b => placeDyn(b, clockS()));
	function update(dt, t) {
		const m = ctx.me(), lx = m.x - OX, lz = m.z - OZ, s = clockS();
		const inside = lx > X0 && lx < X1 + 0.6 && lz > Z0 && lz < Z1;
		// the sliders slide and carry whoever's on them; the vanishing ones come and go
		const y = m.y == null ? 0 : m.y;
		const on = inside && !m.air ? blockUnder(lx, lz, y) : null;
		const ox = on ? on.x0 : 0, oz = on ? on.z0 : 0;
		DYN.forEach(b => placeDyn(b, s));
		if (on && on.move) { m.x += on.x0 - ox; m.z += on.z0 - oz; }
		dynMesh.forEach(D => {
			const b = D.b;
			D.grp.position.set((b.x0 + b.x1) / 2, 0, (b.z0 + b.z1) / 2);
			if (b.blink) { D.grp.visible = !b.off; D.own.opacity = b.warn ? 0.35 + 0.35 * Math.abs(Math.sin(t * 18)) : 1; }
		});
		if (inside) {
			const b = !m.air ? blockUnder(m.x - OX, m.z - OZ, y) : null;
			if (b !== lastBlock) { lastBlock = b; if (b) onBlock(b); }
			// off the start pad: the clock's running
			if (run && !run.t0 && b !== START) { run.t0 = nowMs(); ctx.sfx("go", 0.5); }
			// fell onto the grass: back to your last checkpoint (or the start)
			if (!m.air && y < 0.05 && !m.sit && lx > WATER[0] && lx < WATER[1] && lz > WATER[2] && lz < WATER[3])
				respawn(run && run.t0 ? run.cp : startSpot(), run && run.t0 ? L("You fell! Back to your checkpoint.", "Düştün! Kontrol noktana dönüyorsun.") : L("You fell! Back to the start.", "Düştün! Başlangıca dönüyorsun."));
		} else if (run) run = null;
		flags.forEach(F => F.m.color.set(run && run.cps.has(F.b) ? "#5dff8a" : "#ff4a4a"));
		if (bellT >= 0) { bellT += dt; bell.rotation.z = Math.sin(bellT * 14) * 0.5 * Math.max(0, 1 - bellT / 2.5); if (bellT > 2.5) bellT = -1; }
		slow -= dt;
		if (slow <= 0) { slow = 0.2; live.forEach(paint); }
		renderHud(inside);
	}

	return {
		update,
		onEnter() { if (welcomed) return; welcomed = true; ctx.toast(L("<b>Welcome to the Parkour Park!</b> One long, hard course high over the grass. Stand on the start pad under the arch to race it. Space jumps (hold it for higher), Shift runs.", "<b>Parkur Parkı'na hoş geldin!</b> Çimlerin üstünde, yüksekte uzun ve zorlu tek bir parkur. Yarışmak için kemerin altındaki başlangıç platformuna çık. Boşluk zıplatır (yükseğe için basılı tut), Shift koşturur."), null, null, 9000); },
		onLeave() { hud.classList.add("hidden"); hudSig = ""; run = null; },
		// the highest block top (no higher than y) under (x, z)
		topAt(x, z, y) {
			const lx = x - OX, lz = z - OZ;
			if (lx < X0 || lx > X1 || lz < Z0 || lz > Z1) return -Infinity;
			let best = -Infinity;
			for (const b of near(lx, lz)) if (b.top <= y + 1e-6 && b.top > best && inB(b, lx, lz, 0.12)) best = b.top;
			return best;
		},
		// a block is a wall to anyone below its top (you step up anything up to STEP, scramble AIR_STEP in the air)
		solidAt(x, z, r) {
			const lx = x - OX, lz = z - OZ;
			if (lx < X0 - 1 || lx > X1 + 1 || lz < Z0 - 1 || lz > Z1 + 1) return false;
			const m = ctx.me(), y = m.y == null ? 0 : m.y, up = m.air ? AIR_STEP : STEP;
			for (const b of near(lx, lz)) if (b.top > y + up + 1e-6 && b.y0 < y + 1.7 && inB(b, lx, lz, r)) return true;
			return false;
		},
		// landed on a bounce pad: up you go
		onLand(x, z, y) { const b = blockUnder(x - OX, z - OZ, y); return b && b.kind === "bounce" ? b.v : 0; },
		promptOpts(opts) {
			if (run && !opts.some(o => o.k === "R")) opts.push({ k: "R", label: L("Restart the course", "Parkuru baştan başlat"), fn: restart });
		}
	};
}
