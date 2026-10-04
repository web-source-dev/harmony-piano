/**
 * Harmony World — Biscuit (a golden retriever) and Mochi (a ginger cat), who roam the whole house.
 *
 * Their beds, bowls, toys and care board are in the lounge's pet corner
 * (buildPetCorner, called by the lounge). The animals themselves (createPets)
 * wander the living room, the terrace, the pool deck, the lounge, the bedroom
 * and the bathroom along a little map of paths through the doorways.
 *
 * They look the same on everyone's screen without sending their positions
 * around: where a pet is and what it's doing is a pure function of the clock and
 * of the last few things people did (fed them, called them, threw the ball,
 * petted one). Those are shared keys (z:pets:*); everything else (where to
 * wander next, naps, sniffing about) comes from a seeded hash of the time slot,
 * so two screens always agree.
 */
import * as THREE from "three";
import { kit, floorAt, areaOf, shiftAt } from "./worldRoom.js";

const DOG = "dog", CAT = "cat";
const KEYS = { feed: "z:pets:feed", call: "z:pets:call", fetch: "z:pets:fetch", petdog: "z:pets:petdog", petcat: "z:pets:petcat", names: "z:pets:names" };

// ---------------------------------------------------------------- the paths they walk (world coordinates)
// The lounge's points are its local coordinates + (15.2, 1.0); the bedroom's + (28.4, -4); the bathroom's + (27.4, 4.7).
const NODES = {
	// living room
	LD: [6.0, 3.75], L1: [1.0, 0.5], L2: [3.5, 1.0], L3: [-1.0, 2.0], L4: [2.5, 3.2], L5: [4.5, -2.5], L6: [1.8, -2.0], L7: [-5.3, -3.0], LT: [-5.3, -5.0],
	// terrace
	T0: [-5.3, -7.2], T1: [-2.0, -7.4], T2: [1.0, -7.3], T3: [4.0, -7.6], TP: [4.9, -9.3],
	// pool deck (round the back of the house, from the terrace to the bedroom)
	P0: [6.5, -9.3], P4: [6.6, -7.2], PA: [11.0, -7.6], PB: [19.5, -7.6], PN: [21.8, -7.3], PC: [24.6, -10.2], PD: [29.3, -10.2],
	PE: [31.5, -11.5], P3: [31.5, -15.6], P2: [23.0, -15.6], P1: [6.6, -15.6],
	// lounge
	G0: [8.2, 3.75], G1: [10.6, 1.6], G2: [10.4, -2.8], G3: [14.2, -3.3], G4: [18.7, -2.6], G5: [19.7, 0.0], G6: [22.0, -1.5], G7: [18.2, 0.8],
	GN: [21.8, -5.2], G8: [12.6, 3.6], G9: [21.4, 2.3], G10: [21.7, 4.7], G11: [15.2, 3.9], G12: [18.0, 6.5], G13: [14.0, 6.6], G14: [9.3, 5.6], G15: [8.6, -3.8], G16: [20.8, 6.4], G17: [11.7, 7.3],
	// bedroom
	B0: [24.4, -1.5], B1: [25.9, -3.2], B2: [29.9, -3.1], B3: [30.9, -5.8], B4: [25.6, -6.4], BG: [29.3, -7.2],
	// bathroom
	BA0: [24.4, 4.7], BA1: [28.2, 5.0]
};
const EDGES = [
	"LD-L4", "L4-L2", "L4-L3", "L2-L1", "L1-L3", "L1-L6", "L2-L5", "L5-L6", "L6-L7", "L7-LT", "LT-T0",
	"T0-T1", "T1-T2", "T2-T3", "T3-TP", "TP-P0",
	"P0-P4", "P4-PA", "PA-PB", "PB-PN", "PB-PC", "PC-PD", "PD-PE", "PE-P3", "P3-P2", "P2-P1", "P1-P0", "P2-PC",
	"PD-BG", "BG-B1", "BG-B2", "BG-B3", "G5-GN", "GN-PN",
	"LD-G0", "G0-G1", "G0-G8", "G0-G14", "G1-G2", "G1-G8", "G1-G7", "G2-G3", "G2-G15", "G3-G4", "G4-G5", "G4-G6", "G5-G6", "G5-G7", "G5-G9", "G7-G9",
	"G9-G10", "G10-G16", "G16-G12", "G12-G13", "G11-G13", "G8-G11", "G13-G17", "G17-G14",
	"G6-B0", "B0-B1", "B1-B2", "B2-B3", "B1-B4", "B4-B3",
	"G10-BA0", "BA0-BA1"
];
const NAMES = Object.keys(NODES);
const ADJ = {};
NAMES.forEach(n => { ADJ[n] = []; });
EDGES.forEach(e => { const [a, b] = e.split("-"); ADJ[a].push(b); ADJ[b].push(a); });
// where wandering takes them (not the doorway points)
const WANDER = NAMES.filter(n => !["LD", "G0", "G6", "B0", "G10", "BA0", "TP", "P0", "LT", "T0", "GN", "BG", "PN"].includes(n));
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
// the heading that points a pet standing at a towards b (the models look down their local +z, and rotation.y = heading)
const toward = (a, b) => Math.atan2(b[0] - a[0], b[1] - a[1]);
function nearestNode(p) {
	const a = areaOf(p[0], p[1]);
	let best = null, bd = 1e9;
	for (const n of NAMES) {
		const q = NODES[n];
		const d = dist(p, q) + (areaOf(q[0], q[1]) === a ? 0 : 50);
		if (d < bd) { bd = d; best = n; }
	}
	return best;
}
// shortest way along the paths (Dijkstra over ~60 points)
const routeCache = new Map();
function nodePath(a, b) {
	const key = a + ">" + b;
	if (routeCache.has(key)) return routeCache.get(key);
	const d = {}, prev = {}, done = new Set();
	NAMES.forEach(n => { d[n] = Infinity; });
	d[a] = 0;
	for (;;) {
		let u = null;
		for (const n of NAMES) if (!done.has(n) && (u === null || d[n] < d[u])) u = n;
		if (u === null || d[u] === Infinity || u === b) break;
		done.add(u);
		for (const v of ADJ[u]) { const nd = d[u] + dist(NODES[u], NODES[v]); if (nd < d[v]) { d[v] = nd; prev[v] = u; } }
	}
	const out = [];
	for (let n = b; n; n = prev[n]) { out.unshift(n); if (n === a) break; }
	routeCache.set(key, out);
	return out;
}
// a polyline from p to q through the house
function route(p, q) {
	const a = nearestNode(p), b = nearestNode(q);
	if (a === b || (areaOf(p[0], p[1]) === areaOf(q[0], q[1]) && dist(p, q) < 2.2)) return [p, q];
	return [p].concat(nodePath(a, b).map(n => NODES[n]), [q]);
}
const polyLen = pts => { let l = 0; for (let i = 1; i < pts.length; i++) l += dist(pts[i - 1], pts[i]); return l; };
function along(pts, s) {
	for (let i = 1; i < pts.length; i++) {
		const l = dist(pts[i - 1], pts[i]);
		if (s <= l || i === pts.length - 1) {
			const u = l ? Math.min(1, Math.max(0, s / l)) : 1, a = pts[i - 1], b = pts[i];
			return { pos: [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u], heading: Math.atan2(b[0] - a[0], b[1] - a[1]) };
		}
		s -= l;
	}
	return { pos: pts[pts.length - 1], heading: 0 };
}
// stop short of the end (coming up to someone, not into them)
function trim(pts, by) {
	const L = polyLen(pts);
	if (L <= by) return [pts[0], pts[0]];
	const end = along(pts, L - by).pos;
	const out = [];
	let s = 0;
	for (let i = 0; i < pts.length; i++) { if (i && (s += dist(pts[i - 1], pts[i])) >= L - by) break; out.push(pts[i]); }
	out.push(end);
	return out;
}

function hash(a, b) {
	let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0;
	h = Math.imul(h ^ (h >>> 13), 1274126177);
	return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// ---------------------------------------------------------------- shared bits (used by the corner and the pets)
const names = ctx => Object.assign({ dog: "Biscuit", cat: "Mochi" }, ctx.get(KEYS.names) || {});
const ev = (ctx, key) => ctx.get(KEYS[key]) || null;
function hungerOf(ctx) { const f = ev(ctx, "feed"); return f ? Math.min(1, Math.max(0, (Date.now() - f.at) / (3 * 3600 * 1000))) : 1; }
function happyOf(ctx, who) {
	const last = Math.max(0, ...[ev(ctx, "pet" + who), who === DOG ? ev(ctx, "fetch") : null, ev(ctx, "call"), ev(ctx, "feed")].filter(Boolean).map(e => e.at));
	return last ? Math.max(0.1, Math.min(1, 1 - (Date.now() - last) / (5 * 3600 * 1000))) : 0.5;
}
function feedPets(ctx) {
	ctx.setShared(KEYS.feed, { at: Date.now(), by: ctx.profile().name });
	ctx.doUpper("give", 1400);
	ctx.sfx("pour", 0.5);
	const n = names(ctx);
	ctx.notice(`You filled the bowls. ${ctx.esc(n.dog)} and ${ctx.esc(n.cat)} come running from wherever they are!`);
}

// ---------------------------------------------------------------- the pet corner in the lounge (local coordinates there)
// L: { bed: [x, z], tree: [x, z], bowls: [x, z] (centre of the three bowls, along a wall facing +side), toys: [x, z], board: [x, z, ry] }
export function buildPetCorner(k, L) {
	const { THREE: T, add, mat, group, rbox, g, tex, ctx, canvasTex, rng } = k;
	const R = rng(33);
	// dog bed
	const bed = group(g, L.bed[0], 0, L.bed[1]);
	add(bed, new T.TorusGeometry(0.55, 0.18, 14, 36), mat("#b5651d", 0.9), 0, 0.17, 0, { rx: Math.PI / 2 });
	add(bed, new T.CylinderGeometry(0.58, 0.6, 0.12, 36), mat("#e9d7b9", 0.95), 0, 0.07, 0);
	const plaid = canvasTex(256, 256, (c, w, h) => { c.fillStyle = "#c0392b"; c.fillRect(0, 0, w, h); c.fillStyle = "rgba(0,0,0,0.25)"; for (let i = 0; i < w; i += 32) { c.fillRect(i, 0, 10, h); c.fillRect(0, i, w, 10); } c.fillStyle = "rgba(255,255,255,0.2)"; for (let i = 16; i < w; i += 32) { c.fillRect(i, 0, 3, h); c.fillRect(0, i, w, 3); } });
	add(bed, new T.CircleGeometry(0.42, 30), mat("#ffffff", 0.95, 0, { map: plaid }), 0.05, 0.135, 0.05, { rx: -Math.PI / 2, rz: 0.4, cast: false });
	k.box(L.bed[0] - 0.7, L.bed[0] + 0.7, L.bed[1] - 0.7, L.bed[1] + 0.7);
	// cat tree, with a round bed on top
	const ct = group(g, L.tree[0], 0, L.tree[1]);
	const sisal = mat("#d8c39a", 0.95), carpetM = mat("#9fb4d8", 0.95);
	add(ct, rbox(0.8, 0.08, 0.8, 0.03), carpetM, 0, 0.04, 0);
	for (const [x, z, hh] of [[0, 0, 1.55], [0.22, 0.22, 1.05], [-0.22, 0.2, 0.6]]) add(ct, new T.CylinderGeometry(0.06, 0.06, hh, 12), sisal, x, hh / 2, z);
	add(ct, rbox(0.55, 0.06, 0.5, 0.03), carpetM, -0.12, 0.62, 0.15);
	add(ct, rbox(0.5, 0.06, 0.5, 0.03), carpetM, 0.18, 1.08, 0.15);
	add(ct, new T.TorusGeometry(0.26, 0.08, 10, 24), carpetM, 0, 1.62, 0, { rx: Math.PI / 2 });
	add(ct, new T.CylinderGeometry(0.26, 0.26, 0.05, 24), carpetM, 0, 1.58, 0);
	add(ct, new T.CylinderGeometry(0.003, 0.003, 0.3, 4), mat("#eee"), 0.3, 0.9, 0.3, { cast: false });
	add(ct, new T.SphereGeometry(0.035, 10, 8), mat("#ff4d6d", 0.6), 0.3, 0.74, 0.3, { cast: false });
	k.box(L.tree[0] - 0.45, L.tree[0] + 0.45, L.tree[1] - 0.45, L.tree[1] + 0.45);
	// the way up, a hop at a time ([x, z, y] on the tree, matching the tops above): the floor in front (the room side), the base,
	// the low shelf (top 0.65), the high shelf (top 1.11, on its outer corner, clear of the bed's rim), the bed on top
	const hops = [[-0.15, -0.75, 0], [-0.15, -0.32, 0.08], [-0.22, 0.14, 0.65], [0.3, 0.28, 1.11], [0, 0, 1.6]];
	// bowls on a mat (in a row along x), and a bag of kibble
	add(g, rbox(1.7, 0.01, 0.45, 0.005), mat("#3d5a80", 0.8), L.bowls[0], 0.006, L.bowls[1], { cast: false });
	const bowl = (x, color, r) => {
		const b = group(g, x, 0, L.bowls[1]);
		add(b, new T.CylinderGeometry(r, r * 0.8, 0.09, 24, 1, true), mat(color, 0.35, 0, { side: T.DoubleSide }), 0, 0.055, 0);
		add(b, new T.TorusGeometry(r, 0.012, 8, 24), mat(color, 0.35), 0, 0.1, 0, { rx: Math.PI / 2, cast: false });
		add(b, new T.CircleGeometry(r * 0.8, 24), mat("#ddd", 0.4), 0, 0.012, 0, { rx: -Math.PI / 2, cast: false });
		return b;
	};
	const dogBowl = bowl(L.bowls[0] - 0.55, "#c0392b", 0.17), catBowl = bowl(L.bowls[0], "#8e7dbe", 0.12), waterBowl = bowl(L.bowls[0] + 0.55, "#2a9d8f", 0.15);
	const kibbleM = mat("#8b5a2b", 0.8);
	const kibbles = [];
	for (const [b, r] of [[dogBowl, 0.13], [catBowl, 0.09]]) for (let i = 0; i < 16; i++) { const kb = add(b, new T.DodecahedronGeometry(0.018, 0), kibbleM, (R() - 0.5) * r * 1.4, 0.03 + R() * 0.03, (R() - 0.5) * r * 1.4, { cast: false }); kb.visible = false; kibbles.push({ m: kb, i }); }
	add(waterBowl, new T.CircleGeometry(0.13, 24), new T.MeshStandardMaterial({ color: "#8fd3ff", roughness: 0.05, transparent: true, opacity: 0.8 }), 0, 0.07, 0, { rx: -Math.PI / 2, cast: false });
	const bag = group(g, L.bowls[0] + 1.15, 0, L.bowls[1], -0.2);
	add(bag, rbox(0.4, 0.55, 0.2, 0.05), mat("#e76f51", 0.7), 0, 0.28, 0);
	add(bag, new T.PlaneGeometry(0.3, 0.2), new T.MeshStandardMaterial({ map: tex.text("YUM", { w: 256, h: 128, bg: "#f4a261", color: "#fff", font: "900 80px Nunito, sans-serif" }) }), 0, 0.3, -0.102, { ry: Math.PI, cast: false });
	k.box(L.bowls[0] - 0.95, L.bowls[0] + 1.4, L.bowls[1] - 0.3, L.bowls[1] + 0.3);
	k.interact("pets:bowls", { label: () => hungerOf(ctx) > 0.35 ? "Fill the pet bowls (they're hungry!)" : "Fill the pet bowls", stand: [L.bowls[0], L.bowls[1] - 0.7], face: 0, use: () => feedPets(ctx) }, dogBowl, catBowl, waterBowl, bag);
	// toy box
	const tb = group(g, L.toys[0], 0, L.toys[1], Math.PI / 2);
	add(tb, rbox(0.8, 0.4, 0.5, 0.03), mat("#ffd166", 0.7), 0, 0.2, 0);
	add(tb, new T.TorusGeometry(0.1, 0.035, 8, 18), mat("#ef476f", 0.6), -0.2, 0.43, 0, { rx: 1.2 });
	add(tb, new T.CylinderGeometry(0.03, 0.03, 0.4, 8), mat("#f1faee", 0.8), 0.1, 0.45, 0.05, { rz: 1.3 });
	const duck = group(tb, 0.25, 0.42, -0.05);
	add(duck, new T.SphereGeometry(0.07, 12, 10), mat("#ffd23f", 0.5), 0, 0, 0);
	add(duck, new T.SphereGeometry(0.045, 12, 10), mat("#ffd23f", 0.5), 0.05, 0.07, 0);
	add(duck, new T.ConeGeometry(0.02, 0.05, 8), mat("#f3722c", 0.5), 0.1, 0.07, 0, { rz: -Math.PI / 2 });
	k.box(L.toys[0] - 0.3, L.toys[0] + 0.3, L.toys[1] - 0.45, L.toys[1] + 0.45);
	// care board on the wall: names, how they're doing
	const board = group(g, L.board[0], 1.5, L.board[1], L.board[2]);
	add(board, rbox(1.2, 0.85, 0.05, 0.02), mat("#8b5a2b", 0.6), 0, 0, 0);
	const boardCanvas = document.createElement("canvas");
	boardCanvas.width = 512; boardCanvas.height = 340;
	const boardTex = new T.CanvasTexture(boardCanvas);
	boardTex.colorSpace = T.SRGBColorSpace;
	add(board, new T.PlaneGeometry(1.08, 0.73), new T.MeshStandardMaterial({ map: boardTex, roughness: 0.9 }), 0, 0, 0.03, { cast: false });
	const bs = [L.board[0] + Math.sin(L.board[2]) * 0.9, L.board[1] + Math.cos(L.board[2]) * 0.9];
	k.interact("pets:board", { label: "Pet care board", stand: bs, face: L.board[2] + Math.PI, use: () => openBoard(ctx) }, board);
	function drawBoard() {
		const c = boardCanvas.getContext("2d"), w = 512, h = 340, n = names(ctx);
		c.fillStyle = "#2f3b33"; c.fillRect(0, 0, w, h);
		c.fillStyle = "rgba(255,255,255,0.04)"; for (let i = 0; i < 60; i++) c.fillRect((i * 97) % w, (i * 53) % h, 40, 2);
		c.fillStyle = "#f6f1e3"; c.font = "800 38px Caveat, Nunito, cursive"; c.textAlign = "center";
		c.fillText("Who's who", w / 2, 50);
		c.font = "700 30px Caveat, Nunito, cursive"; c.textAlign = "left";
		const hunger = hungerOf(ctx);
		const row = (y, label, v, col) => {
			c.fillStyle = "#f6f1e3"; c.fillText(label, 30, y);
			c.strokeStyle = "rgba(246,241,227,0.6)"; c.lineWidth = 2; c.strokeRect(250, y - 20, 220, 22);
			c.fillStyle = col; c.fillRect(252, y - 18, 216 * v, 18);
		};
		row(110, n.dog + " - tummy", 1 - hunger, "#ffd166");
		row(150, n.dog + " - happy", happyOf(ctx, DOG), "#ff8fab");
		row(210, n.cat + " - tummy", 1 - hunger, "#ffd166");
		row(250, n.cat + " - happy", happyOf(ctx, CAT), "#ff8fab");
		c.fillStyle = "rgba(246,241,227,0.8)"; c.font = "700 24px Caveat, Nunito, cursive"; c.textAlign = "center";
		c.fillText(hunger > 0.6 ? "Feed us please!" : "Pet us, play with us!", w / 2, 310);
		boardTex.needsUpdate = true;
	}
	drawBoard();
	let boardT = 0;
	k.updaters.push(dt => {
		boardT -= dt;
		if (boardT <= 0) { boardT = 2; drawBoard(); }
		const fd = ev(ctx, "feed");
		const left = fd ? Math.max(0, 1 - (Date.now() - fd.at - 6000) / 40000) : 0;
		kibbles.forEach(kb => { kb.m.visible = kb.i / 16 < left; });
	});
	// where the pets go for each of these (world coordinates)
	const W = (x, z) => [x + k.ox, z + k.oz];
	return {
		dogBed: W(L.bed[0], L.bed[1]),
		catTree: W(L.tree[0], L.tree[1]),
		catHops: hops.map(([x, z, y]) => W(L.tree[0] + x, L.tree[1] + z).concat(y)),
		// where they stand to eat / drink, and the bowl itself (to face it)
		dogBowl: W(L.bowls[0] - 0.55, L.bowls[1] - 0.42), dogBowlAt: W(L.bowls[0] - 0.55, L.bowls[1]),
		catBowl: W(L.bowls[0], L.bowls[1] - 0.36), catBowlAt: W(L.bowls[0], L.bowls[1]),
		water: W(L.bowls[0] + 0.55, L.bowls[1] - 0.4), waterAt: W(L.bowls[0] + 0.55, L.bowls[1]),
		ball: W(L.ball[0], L.ball[1])
	};
}
function openBoard(ctx) {
	const n = names(ctx);
	const meter = (label, v) => `<div class="lbl"><span>${label}</span><span>${Math.round(v * 100)}%</span></div><div class="hs-meter"><i style="width:${Math.round(v * 100)}%"></i></div>`;
	const hunger = hungerOf(ctx);
	const body = ctx.openModal("pets", "Pet care", `<div class="hs-pet">
		<div><b>The dog</b><input class="input" id="pn-dog" maxlength="16" value="${ctx.esc(n.dog)}">${meter("Full tummy", 1 - hunger)}${meter("Happy", happyOf(ctx, DOG))}</div>
		<div><b>The cat</b><input class="input" id="pn-cat" maxlength="16" value="${ctx.esc(n.cat)}">${meter("Full tummy", 1 - hunger)}${meter("Happy", happyOf(ctx, CAT))}</div></div>
		<div class="row" style="gap:8px;margin-top:14px;flex-wrap:wrap"><button class="btn primary" id="pb-feed">Fill the bowls</button><button class="btn" id="pb-call">Call them</button></div>
		<p class="muted" style="margin:14px 0 0">They roam the whole house - call them from anywhere (the Z actions menu), throw the ball when Biscuit's near, click one to give it a pat. They get hungry again a few hours after a meal. Names save for both of you.</p>`, 520);
	for (const who of [DOG, CAT]) {
		const inp = body.querySelector("#pn-" + who);
		inp.addEventListener("keydown", e => e.stopPropagation());
		inp.oninput = () => { clearTimeout(inp._t); inp._t = setTimeout(() => { const v = inp.value.trim().slice(0, 16); if (v) ctx.setShared(KEYS.names, Object.assign(names(ctx), { [who]: v })); }, 500); };
	}
	body.querySelector("#pb-feed").onclick = () => { ctx.closeModal(); feedPets(ctx); };
	body.querySelector("#pb-call").onclick = () => { ctx.closeModal(); callPets(ctx); };
}
function callPets(ctx) {
	const me = ctx.me();
	// upstairs (the loft, the disco): they won't do the stairs
	if (shiftAt(me.x, me.z)) { const n = names(ctx); ctx.notice(`${n.dog} and ${n.cat} don't do stairs - they're waiting for you downstairs.`); return; }
	ctx.setShared(KEYS.call, { at: Date.now(), x: me.x, z: me.z, by: ctx.profile().name });
	ctx.doUpper("wave", 1600);
	const n = names(ctx);
	const line = `Here ${n.dog}! Here ${n.cat}!`;
	ctx.myAvatar().say(line);
	ctx.send({ t: "chat", text: line, auto: 1 });
}

// ---------------------------------------------------------------- the animals
export function createPets(ctx, SP, house) {
	const scene = ctx.scene;
	const dog = makeDog(), cat = makeCat();
	scene.add(dog.root, cat.root);
	const ball = new THREE.Mesh(new THREE.SphereGeometry(0.065, 16, 12), kit.mat("#c6f432", 0.6));
	ball.castShadow = true;
	scene.add(ball);
	const zz = new THREE.Sprite(new THREE.SpriteMaterial({ map: kit.canvasTex(256, 128, (c, w, h) => { c.fillStyle = "#cfe0ff"; c.font = "900 70px Nunito, sans-serif"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("z Z z", w / 2, h / 2); }), transparent: true, depthWrite: false }));
	zz.scale.set(0.4, 0.2, 1);
	scene.add(zz);
	const tags = {};
	function nameTag(who, name) {
		const t = kit.canvasTex(256, 64, (x, w, h) => {
			x.fillStyle = "rgba(20,14,26,0.7)"; x.beginPath(); x.roundRect(4, 8, 248, 48, 24); x.fill();
			x.fillStyle = "#fff4e2"; x.font = "800 30px Nunito, sans-serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(name, 128, 33);
		});
		if (tags[who]) { tags[who].material.map.dispose(); tags[who].material.map = t; tags[who].material.needsUpdate = true; return; }
		const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false }));
		s.scale.set(0.55, 0.14, 1);
		scene.add(s);
		tags[who] = s;
	}
	// click a pet to pet it (it's one of the things you can use, wherever it is)
	const petDef = who => ({
		id: "pets:" + who,
		get label() { return "Pet " + names(ctx)[who]; },
		get stand() {
			const p = (who === DOG ? dog : cat).pos, me = ctx.me();
			const dx = me.x - p.x, dz = me.z - p.z, l = Math.hypot(dx, dz) || 1;
			return [p.x + dx / l * 0.6, p.z + dz / l * 0.6];
		},
		use: () => petPet(who)
	});
	for (const [who, P] of [[DOG, dog], [CAT, cat]]) {
		const def = petDef(who);
		def.objects = [P.root];
		P.root.traverse(c => { c.userData.interact = def.id; });
		ctx.room.interactables[def.id] = def;
	}

	// ---------------------------------------------------------------- where is each pet, and what is it doing? (pure function of time)
	const PETS = {
		dog: { id: DOG, slot: 10, speed: 1.4, run: 3.0, seed: 11, bowl: SP.dogBowl, bowlAt: SP.dogBowlAt },
		cat: { id: CAT, slot: 14, speed: 0.9, run: 2.2, seed: 29, bowl: SP.catBowl, bowlAt: SP.catBowlAt }
	};
	// ---- the cat tree: Mochi hops up (and down) it a level at a time; lvl = which of SP.catHops she's on (0 = the floor in front)
	const H = SP.catHops, TOP = H.length - 1, HOP = 1.0, HOP_AIR = 0.45;
	const range = (a, b) => { const o = []; for (let i = a; ; i += a < b ? 1 : -1) { o.push(i); if (i === b) break; } return o; };
	// s seconds into hopping through the levels idx (each hop: a beat to gather herself, then the jump)
	function hopAt(idx, s) {
		const n = idx.length - 1;
		if (s >= n * HOP) { const a = H[idx[n - 1]], b = H[idx[n]]; return { pos: [b[0], b[1]], y: b[2], heading: toward(a, b), act: "stand", hop: true, lvl: idx[n] }; }
		const i = Math.max(0, Math.floor(s / HOP)), a = H[idx[i]], b = H[idx[i + 1]], up = b[2] > a[2], heading = toward(a, b);
		const u = (s - i * HOP - (HOP - HOP_AIR)) / HOP_AIR;
		if (u <= 0) return { pos: [a[0], a[1]], y: a[2], heading, act: "crouch", hop: true, lvl: idx[i] };
		// going up she rises first and reaches over the edge late; going down she pushes off the edge first, then drops
		const w = up ? u * u : 1 - (1 - u) * (1 - u);
		const y = a[2] + (b[2] - a[2]) * u + Math.sin(u * Math.PI) * (0.22 + Math.max(0, b[2] - a[2]) * 0.4);
		return { pos: [a[0] + (b[0] - a[0]) * w, a[1] + (b[1] - a[1]) * w], y, heading, act: "leap", pitch: up ? -0.35 : 0.3, hop: true, lvl: idx[u < 0.5 ? i : i + 1] };
	}
	const perched = face => ({ pos: [H[TOP][0], H[TOP][1]], y: H[TOP][2], heading: face, act: "perch", lvl: TOP });
	// how far up she's got by `until`, making for the tree from `from` at dep (or already lvl0 up it)
	function levelBy(P, from, dep, lvl0, until) {
		const s = lvl0 ? until - dep : until - dep - polyLen(route(from, H[0])) / P.speed;
		return s < 0 ? lvl0 : Math.min(TOP, lvl0 + Math.floor(s / HOP));
	}
	function wanderTarget(P, k2) {
		const r = hash(k2, P.seed), hungry = hungerOf(ctx) > 0.75;
		const face = hash(k2, P.seed + 3) * Math.PI * 2;
		const node = NODES[WANDER[Math.floor(hash(k2, P.seed + 1) * WANDER.length)]];
		const a = hash(k2, P.seed + 2);
		if (P.id === DOG) {
			if (hungry && r < 0.3) return { pos: P.bowl, act: "beg", face: toward(P.bowl, P.bowlAt) };
			if (r < 0.14) return { pos: SP.dogBed, act: "sleep", face: 0.6, y: 0.1 };
			if (r < 0.2) return { pos: SP.water, act: "eat", face: toward(SP.water, SP.waterAt) };
			return { pos: node, act: a < 0.35 ? "sit" : a < 0.62 ? "lie" : a < 0.82 ? "sniff" : "stand", face };
		}
		if (hungry && r < 0.3) return { pos: P.bowl, act: "sit", face: toward(P.bowl, P.bowlAt) };
		if (r < 0.24) return { pos: H[0], act: "perch", face: 2.4, climb: true };   // (pos: the floor in front; she hops up from there)
		if (r < 0.32) return { pos: SP.dogBed, act: "sleep", face: -0.8, y: 0.1 };
		return { pos: [node[0] + 0.3, node[1] - 0.3], act: a < 0.3 ? "sit" : a < 0.6 ? "lie" : a < 0.8 ? "groom" : "stand", face };
	}
	function eventsFor(who) {
		const out = [];
		const f = ev(ctx, "feed"); if (f) out.push({ kind: "feed", at: f.at / 1000, d: f });
		const c = ev(ctx, "call"); if (c) out.push({ kind: "call", at: c.at / 1000, d: c });
		const p = ev(ctx, "pet" + who); if (p) out.push({ kind: "pet", at: p.at / 1000, d: p });
		if (who === DOG) { const b = ev(ctx, "fetch"); if (b) out.push({ kind: "fetch", at: b.at / 1000, d: b }); }
		return out.sort((a, b) => b.at - a.at);
	}
	// walking a polyline that started at dep
	function walk(pts, dep, t, speed) {
		const L = polyLen(pts), dur = L / speed;
		if (t - dep < dur) { const a = along(pts, Math.max(0, t - dep) * speed); return { pos: a.pos, moving: true, heading: a.heading }; }
		return { pos: pts[pts.length - 1], moving: false, heading: along(pts, L).heading };
	}
	function stateAt(P, t, evs) {
		const e = evs.find(x => x.at <= t);
		if (e) {
			const older = evs.filter(x => x.at < e.at);
			const st = eventState(P, e, t, older);
			if (st) return st;
			return wander(P, t, eventPlan(P, e, older));
		}
		return wander(P, t, null);
	}
	// how slot k starts: from where, when, and how far up the cat tree
	function slotStart(P, k, after) {
		const L = P.slot, s0 = k * L;
		if (after && after.end > s0) return { from: after.final, dep: after.end, lvl: after.lvl || 0 };
		const pv = wanderTarget(P, k - 1);
		let lvl = 0;
		if (pv.climb) {
			if (after && after.end > s0 - L) lvl = levelBy(P, after.final, after.end, after.lvl || 0, s0);
			else { const pp = wanderTarget(P, k - 2); lvl = pp.climb ? TOP : levelBy(P, pp.pos, s0 - L, 0, s0); }
		}
		return { from: pv.pos, dep: s0, lvl };
	}
	function wander(P, t, after) {
		const k2 = Math.floor(t / P.slot);
		const tg = wanderTarget(P, k2);
		let { from, dep, lvl } = slotStart(P, k2, after);
		if (lvl && tg.climb) return lvl < TOP && t < dep + (TOP - lvl) * HOP ? hopAt(range(lvl, TOP), t - dep) : perched(tg.face);
		if (lvl) {   // down the tree first, a level at a time
			if (t < dep + lvl * HOP) return hopAt(range(lvl, 0), t - dep);
			from = H[0]; dep += lvl * HOP;
		}
		const pts = route(from, tg.pos), arrive = dep + polyLen(pts) / P.speed;
		if (t < arrive) { const m = walk(pts, dep, t, P.speed); return { pos: m.pos, y: 0, heading: m.heading, act: "walk" }; }
		if (tg.climb) return t < arrive + TOP * HOP ? hopAt(range(0, TOP), t - arrive) : perched(tg.face);
		return { pos: tg.pos, y: tg.y || 0, heading: tg.face, act: tg.act };
	}
	const planCache = new Map();
	function eventPlan(P, e, older) {
		const ck = P.id + e.kind + e.at;
		if (planCache.has(ck)) return planCache.get(ck);
		const start = stateAt(P, e.at, older);
		// up the cat tree: she hops down before going anywhere (and gets a pat where she is)
		const lvl = start.lvl || 0, down = lvl * HOP;
		const from = lvl ? H[0] : start.pos;
		let plan = null;
		if (e.kind === "feed") {
			const pts = route(from, P.bowl), arrive = e.at + down + polyLen(pts) / P.run;
			plan = { pts, dep: e.at + down, speed: P.run, arrive, end: Math.max(arrive + 6, e.at + 12), final: P.bowl, act: "eat", face: toward(P.bowl, P.bowlAt), down: lvl };
		} else if (e.kind === "call") {
			const caller = [e.d.x, e.d.z];
			const pts = trim(route(from, caller), P.id === DOG ? 0.75 : 1.1);
			const final = pts[pts.length - 1], arrive = e.at + 0.3 + down + polyLen(pts) / P.run;
			plan = { pts, dep: e.at + 0.3 + down, speed: P.run, arrive, end: arrive + 6, final, act: "sit", face: toward(final, caller), down: lvl };
		} else if (e.kind === "pet") {
			const at = lvl ? [H[lvl][0], H[lvl][1]] : start.pos;
			plan = { pts: [at, at], dep: e.at, speed: 1, arrive: e.at, end: e.at + 5, final: at, act: "happy", face: toward(at, [e.d.x, e.d.z]), y: lvl ? H[lvl][2] : start.y || 0, lvl, keepAct: ["sleep", "lie", "perch"].includes(start.act) ? start.act : null };
		} else if (e.kind === "fetch") {
			const land = e.d.to, thrower = e.d.from;
			const go = e.at + 0.45, out = route(from, land);
			const t1 = go + polyLen(out) / P.run;
			const back = trim(route(land, thrower), 0.7);
			const t2 = t1 + 0.45 + polyLen(back) / P.run;
			const drop = back[back.length - 1];
			plan = { pts: out, dep: go, speed: P.run, arrive: t1, back: { pts: back, dep: t1 + 0.45, arrive: t2 }, end: t2 + 3, final: drop, act: "happy", face: toward(drop, thrower), fetch: true };
		}
		if (planCache.size > 40) planCache.clear();
		planCache.set(ck, plan);
		return plan;
	}
	function eventState(P, e, t, older) {
		const p = eventPlan(P, e, older);
		if (!p || t >= p.end) return null;
		if (e.kind === "pet") return { pos: p.final, y: p.y, heading: p.face, act: p.keepAct || "happy", petted: true, lvl: p.lvl };
		if (p.down && t < e.at + p.down * HOP) return hopAt(range(p.down, 0), t - e.at);
		if (t < p.dep) return { pos: p.pts[0], y: 0, heading: along(p.pts, 0.01).heading, act: "stand" };
		if (p.fetch) {
			if (t < p.arrive) { const m = walk(p.pts, p.dep, t, P.run); return { pos: m.pos, y: 0, heading: m.heading, act: "run" }; }
			if (t < p.back.dep) return { pos: p.pts[p.pts.length - 1], y: 0, heading: along(p.back.pts, 0.01).heading, act: "eat" };
			if (t < p.back.arrive) { const m = walk(p.back.pts, p.back.dep, t, P.run); return { pos: m.pos, y: 0, heading: m.heading, act: "run" }; }
			return { pos: p.final, y: 0, heading: p.face, act: "happy" };
		}
		if (t < p.arrive) { const m = walk(p.pts, p.dep, t, p.speed); return { pos: m.pos, y: 0, heading: m.heading, act: "run" }; }
		return { pos: p.final, y: 0, heading: p.face, act: p.act };
	}
	// where the ball is (it lives where Biscuit last dropped it)
	function ballAt(t) {
		const f = ev(ctx, "fetch");
		if (!f) return { pos: SP.ball, y: 0.065 };
		const at = f.at / 1000;
		const p = eventPlan(PETS.dog, { kind: "fetch", at, d: f }, eventsFor(DOG).filter(x => x.at < at));
		if (t < at + 0.9) {
			const u = Math.max(0, (t - at) / 0.9);
			return { pos: [f.from[0] + (f.to[0] - f.from[0]) * u, f.from[1] + (f.to[1] - f.from[1]) * u], y: 1.2 * (1 - u) + 0.065 + Math.sin(u * Math.PI) * 1.4, air: true };
		}
		// something newer called Biscuit away (dinner, a call, a pat) before the ball came back
		const cut = eventsFor(DOG).filter(x => x.at > at).map(x => x.at).sort((a, b) => a - b)[0];
		if (!p || t < p.arrive || (cut && cut < p.arrive)) return { pos: f.to, y: 0.065 };
		if (cut && cut < p.back.arrive && t >= cut) return { pos: stateAt(PETS.dog, cut - 0.001, eventsFor(DOG).filter(x => x.at <= at)).pos, y: 0.065 };
		if (t < p.back.arrive) return null;   // in Biscuit's mouth
		return { pos: p.final, y: 0.065 };
	}

	// ---------------------------------------------------------------- doing things with them
	function petPet(who) {
		const me = ctx.me();
		const P = who === DOG ? dog : cat;
		const d = Math.hypot(me.x - P.pos.x, me.z - P.pos.z);
		const go = () => {
			const Q = who === DOG ? dog : cat;
			me.h = Math.atan2(Q.pos.x - me.x, Q.pos.z - me.z);
			ctx.doUpper("pet", 3200);
			ctx.setShared(who === DOG ? KEYS.petdog : KEYS.petcat, { at: Date.now(), x: me.x, z: me.z, by: ctx.profile().name });
			setTimeout(() => { const Q2 = who === DOG ? dog : cat; ctx.heartsFx({ position: Q2.pos.clone() }, 5, null, who === DOG ? 1.0 : 0.7); ctx.sfx("love", 0.4); }, 600);
		};
		if (d < 1.0) go();
		else { const dx = me.x - P.pos.x, dz = me.z - P.pos.z, l = Math.hypot(dx, dz) || 1; ctx.walkTo(P.pos.x + dx / l * 0.6, P.pos.z + dz / l * 0.6, go); }
	}
	function throwBall() {
		const me = ctx.me();
		const here = areaOf(me.x, me.z);
		// land it on open floor in the same room, roughly the way you're facing, a few metres away
		let best = null, bs = -1e9;
		for (const n of NAMES) {
			const w = NODES[n];
			if (areaOf(w[0], w[1]) !== here) continue;
			const dx = w[0] - me.x, dz = w[1] - me.z, l = Math.hypot(dx, dz);
			if (l < 1.5) continue;
			const s = (dx * Math.sin(me.h) + dz * Math.cos(me.h)) / l * 3 - Math.abs(l - 3.5) * 0.4 + Math.random() * 0.6;
			if (s > bs) { bs = s; best = w; }
		}
		if (!best) { ctx.notice("No room to throw the ball in here."); return; }
		const to = [best[0] + (Math.random() - 0.5) * 0.5, best[1] + (Math.random() - 0.5) * 0.5];
		me.h = Math.atan2(to[0] - me.x, to[1] - me.z);
		ctx.doUpper("give", 900);
		ctx.setShared(KEYS.fetch, { at: Date.now(), from: [me.x, me.z], to, by: ctx.profile().name });
		ctx.sfx("whoosh", 0.5);
	}

	// ---------------------------------------------------------------- every frame
	function update(dt, t, visibleSet) {
		const T = Date.now() / 1000;
		const n = names(ctx);
		const me = ctx.me();
		const drawn = (x, z) => visibleSet.has(house.regionOf(areaOf(x, z)));
		for (const [who, pet, P] of [[DOG, dog, PETS.dog], [CAT, cat, PETS.cat]]) {
			const st = stateAt(P, T, eventsFor(who));
			pet.setState(st, dt, t);
			pet.root.visible = drawn(pet.pos.x, pet.pos.z);
			if (!tags[who] || tags[who].userData.n !== n[who]) { nameTag(who, n[who]); tags[who].userData.n = n[who]; }
			const sp = tags[who];
			sp.position.set(pet.root.position.x, pet.root.position.y + (who === DOG ? 1.05 : 0.72), pet.root.position.z);
			sp.visible = pet.root.visible && Math.hypot(me.x - pet.pos.x, me.z - pet.pos.z) < 3.2;
		}
		const sleeper = [dog, cat].find(p => p.act === "sleep" && p.root.visible);
		zz.visible = !!sleeper;
		if (sleeper) zz.position.set(sleeper.root.position.x, sleeper.root.position.y + 0.55 + Math.sin(t * 1.5) * 0.04, sleeper.root.position.z);
		const b = ballAt(T);
		if (b) ball.position.set(b.pos[0], b.y + (b.air ? 0 : floorAt(b.pos[0], b.pos[1])), b.pos[1]);
		else dog.mouth.getWorldPosition(ball.position);
		ball.visible = drawn(ball.position.x, ball.position.z);
	}

	return {
		update,
		call: () => callPets(ctx),
		feed: () => feedPets(ctx),
		// (for checking that two screens agree)
		debugState: () => ({ dog: [+dog.pos.x.toFixed(2), +dog.pos.z.toFixed(2), dog.act], cat: [+cat.pos.x.toFixed(2), +cat.pos.z.toFixed(2), cat.act] }),
		applyKey(key, remote) {
			if (!remote || key.indexOf("z:pets:") !== 0) return;
			const n = names(ctx), e = ctx.get(key);
			if (key === KEYS.feed && e) ctx.notice(`<b>${ctx.esc(e.by || "Someone")}</b> fed ${ctx.esc(n.dog)} and ${ctx.esc(n.cat)}`);
			if (key === KEYS.call && e) ctx.notice(`<b>${ctx.esc(e.by || "Someone")}</b> called the pets`);
		},
		onFx() {},
		promptOpts(opts) {
			const me = ctx.me();
			if (me.sit) return;
			const free = key => !opts.some(o => o.k === key);
			const f = ev(ctx, "fetch");
			const busy = f && Date.now() / 1000 < f.at / 1000 + 9;
			const near = Math.hypot(me.x - dog.pos.x, me.z - dog.pos.z) < 7 && areaOf(me.x, me.z) === areaOf(dog.pos.x, dog.pos.z);
			if (near && !busy && free("F")) opts.push({ k: "F", label: "Throw the ball for " + names(ctx).dog, fn: throwBall });
		}
	};
}

// ---------------------------------------------------------------- pet models + their poses
function makeDog() {
	const { add, mat, group, rbox } = kit;
	const root = new THREE.Group();
	const rig = group(root, 0, 0, 0);
	const fur = mat("#d9a35b", 0.85), furD = mat("#c18842", 0.85), furL = mat("#ecc488", 0.85), dark = mat("#1b1210", 0.3);
	const body = add(rig, new THREE.SphereGeometry(0.2, 18, 14), fur, 0, 0.46, 0);
	body.scale.set(1, 0.95, 1.75);
	add(rig, new THREE.SphereGeometry(0.16, 16, 12), furL, 0, 0.47, 0.2).scale.set(1, 1.05, 1.05);
	const neck = group(rig, 0, 0.58, 0.3);
	add(neck, new THREE.SphereGeometry(0.13, 16, 12), fur, 0, 0.1, 0.06);
	add(neck, rbox(0.13, 0.1, 0.16, 0.04), furL, 0, 0.06, 0.2);
	add(neck, new THREE.SphereGeometry(0.03, 10, 8), dark, 0, 0.09, 0.285);
	const tongue = add(neck, new THREE.BoxGeometry(0.05, 0.01, 0.07), mat("#e56b80", 0.5), 0, 0.005, 0.25, { cast: false });
	const eyes = [];
	for (const sx of [-1, 1]) {
		eyes.push(add(neck, new THREE.SphereGeometry(0.02, 10, 8), dark, sx * 0.055, 0.15, 0.15, { cast: false }));
		const ear = group(neck, sx * 0.11, 0.16, 0.03);
		add(ear, new THREE.SphereGeometry(0.07, 12, 10), furD, 0, -0.07, 0).scale.set(0.45, 1.2, 0.8);
		neck.userData["ear" + sx] = ear;
	}
	add(neck, new THREE.TorusGeometry(0.1, 0.02, 8, 20), mat("#d62839", 0.5), 0, -0.02, -0.02, { rx: Math.PI / 2 + 0.3 });
	add(neck, new THREE.CylinderGeometry(0.025, 0.025, 0.008, 12), mat("#ffd166", 0.3, 0.8), 0, -0.1, 0.08, { rx: Math.PI / 2 });
	const mouth = new THREE.Object3D(); mouth.position.set(0, 0.03, 0.3); neck.add(mouth);
	const legs = [];
	for (const [x, z, front] of [[-0.1, 0.24, 1], [0.1, 0.24, 1], [-0.1, -0.24, 0], [0.1, -0.24, 0]]) {
		const hip = group(rig, x, 0.42, z);
		add(hip, new THREE.CylinderGeometry(0.045, 0.04, 0.34, 10), fur, 0, -0.17, 0);
		add(hip, new THREE.SphereGeometry(0.05, 10, 8), furL, 0, -0.36, 0.02).scale.set(1, 0.7, 1.3);
		hip.userData.front = front;
		legs.push(hip);
	}
	const tail = group(rig, 0, 0.55, -0.33);
	add(tail, new THREE.CylinderGeometry(0.035, 0.02, 0.32, 8), furD, 0, 0.14, -0.06, { rx: -0.45 });
	return petRig({ root, rig, neck, legs, tail, eyes, tongue, mouth, kind: "dog", hipY: 0.42 });
}
function makeCat() {
	const { add, mat, group, canvasTex } = kit;
	const root = new THREE.Group();
	const rig = group(root, 0, 0, 0);
	const stripes = canvasTex(256, 128, (c, w, h) => { c.fillStyle = "#e8913a"; c.fillRect(0, 0, w, h); c.fillStyle = "#c26b22"; for (let x = 8; x < w; x += 26) { c.beginPath(); c.moveTo(x, 0); c.quadraticCurveTo(x + 10, h / 2, x, h); c.lineTo(x + 9, h); c.quadraticCurveTo(x + 19, h / 2, x + 9, 0); c.fill(); } });
	const fur = mat("#ffffff", 0.85, 0, { map: stripes }), plain = mat("#e8913a", 0.85), cream = mat("#fbe3c4", 0.85);
	const body = add(rig, new THREE.SphereGeometry(0.13, 16, 12), fur, 0, 0.27, 0);
	body.scale.set(0.85, 0.85, 1.7);
	const neck = group(rig, 0, 0.34, 0.2);
	add(neck, new THREE.SphereGeometry(0.1, 16, 12), plain, 0, 0.07, 0.03);
	add(neck, new THREE.SphereGeometry(0.05, 12, 10), cream, 0, 0.04, 0.1).scale.set(1.1, 0.7, 0.6);
	add(neck, new THREE.SphereGeometry(0.012, 8, 6), mat("#e56b80", 0.4), 0, 0.06, 0.13, { cast: false });
	const eyes = [];
	for (const sx of [-1, 1]) {
		eyes.push(add(neck, new THREE.SphereGeometry(0.018, 10, 8), mat("#7bd389", 0.2), sx * 0.04, 0.1, 0.1, { cast: false }));
		add(neck, new THREE.ConeGeometry(0.035, 0.07, 4), plain, sx * 0.06, 0.17, 0.02, { rz: -sx * 0.25 });
		for (const dy of [-0.008, 0.008]) add(neck, new THREE.CylinderGeometry(0.0015, 0.0015, 0.12, 3), mat("#ffffff", 0.5), sx * 0.08, 0.05 + dy, 0.12, { rz: Math.PI / 2 + sx * dy * 10, cast: false });
	}
	const mouth = new THREE.Object3D(); mouth.position.set(0, 0.03, 0.14); neck.add(mouth);
	const legs = [];
	for (const [x, z, front] of [[-0.06, 0.13, 1], [0.06, 0.13, 1], [-0.06, -0.14, 0], [0.06, -0.14, 0]]) {
		const hip = group(rig, x, 0.24, z);
		add(hip, new THREE.CylinderGeometry(0.028, 0.025, 0.22, 8), plain, 0, -0.11, 0);
		add(hip, new THREE.SphereGeometry(0.03, 8, 6), cream, 0, -0.23, 0.01);
		hip.userData.front = front;
		legs.push(hip);
	}
	const tail = group(rig, 0, 0.32, -0.2);
	let link = tail;
	const links = [];
	for (let i = 0; i < 6; i++) {
		const l = group(link, 0, i ? 0.07 : 0, 0);
		add(l, new THREE.CylinderGeometry(0.022 - i * 0.002, 0.024 - i * 0.002, 0.075, 8), i === 5 ? mat("#c26b22", 0.85) : plain, 0, 0.035, 0);
		links.push(l);
		link = l;
	}
	return petRig({ root, rig, neck, legs, tail, eyes, links, mouth, kind: "cat", hipY: 0.24 });
}
// pose a pet for a state { pos, y, heading, act, petted } (eased, so changes blend); pos is in world space
function petRig(P) {
	const pos = new THREE.Vector3();
	let heading = 0, phase = 0, first = true, sitK = 0, lieK = 0, headDown = 0, lastX = 0, lastZ = 0, crouchK = 0, leapK = 0, pitch = 0;
	P.pos = pos;
	P.act = "stand";
	P.setState = (st, dt, t) => {
		const fy = floorAt(st.pos[0], st.pos[1]);
		pos.set(st.pos[0], fy + (st.y || 0), st.pos[1]);
		// (hopping about the cat tree is followed exactly, or the easing would flatten the jumps)
		if (first || st.hop || Math.hypot(pos.x - P.root.position.x, pos.z - P.root.position.z) > 3) { P.root.position.copy(pos); first = false; }
		const e = Math.min(1, dt * 10);
		P.root.position.x += (pos.x - P.root.position.x) * e;
		P.root.position.z += (pos.z - P.root.position.z) * e;
		P.root.position.y += (pos.y - P.root.position.y) * Math.min(1, dt * 6);
		let dh = st.heading - heading;
		while (dh > Math.PI) dh -= Math.PI * 2;
		while (dh < -Math.PI) dh += Math.PI * 2;
		heading += dh * Math.min(1, dt * 7);
		P.root.rotation.y = heading;
		P.act = st.act;
		const a = st.act;
		const moving = a === "walk" || a === "run";
		phase += dt * (moving ? (a === "run" ? 13 : 8) : 0);
		lastX = pos.x; lastZ = pos.z;
		const wantSit = a === "sit" || a === "beg" || a === "groom" ? 1 : 0;
		const wantLie = a === "lie" || a === "sleep" || a === "perch" ? 1 : 0;
		sitK += (wantSit - sitK) * Math.min(1, dt * 6);
		lieK += (wantLie - lieK) * Math.min(1, dt * 5);
		headDown += (((a === "eat" || a === "sniff") ? 1 : 0) - headDown) * Math.min(1, dt * 6);
		crouchK += ((a === "crouch" ? 1 : 0) - crouchK) * Math.min(1, dt * 10);
		leapK += ((a === "leap" ? 1 : 0) - leapK) * Math.min(1, dt * 14);
		pitch += ((a === "leap" ? st.pitch || 0 : 0) - pitch) * Math.min(1, dt * 10);
		const isDog = P.kind === "dog";
		P.legs.forEach((leg, i) => {
			const diag = (i === 0 || i === 3) ? 0 : Math.PI;
			let rx = moving ? Math.sin(phase + diag) * (a === "run" ? 0.75 : 0.5) : 0;
			if (!leg.userData.front) rx += sitK * -1.25;
			else rx += sitK * 0.45;
			rx += lieK * (leg.userData.front ? -1.35 : 1.2);
			rx += leapK * (leg.userData.front ? -0.8 : 0.8) + crouchK * (leg.userData.front ? 0.25 : -0.35);
			leg.rotation.x = rx;
		});
		P.rig.rotation.x = -sitK * (isDog ? 0.55 : 0.75) + pitch;
		P.rig.position.y = -lieK * P.hipY * 0.78 - sitK * P.hipY * 0.3 - crouchK * P.hipY * 0.25 + (moving ? Math.abs(Math.sin(phase)) * 0.025 : 0);
		P.rig.position.z = -sitK * 0.08;
		const sniff = a === "sniff" ? Math.sin(t * 9) * 0.15 : 0;
		P.neck.rotation.x = headDown * (a === "eat" ? 0.9 + Math.sin(t * 7) * 0.12 : 0.6) + sitK * 0.4 + lieK * (a === "sleep" ? 0.5 : 0.15) + (a === "beg" ? -0.3 : 0);
		P.neck.rotation.y = sniff + (a === "groom" ? 0.9 : 0) + (a === "happy" ? Math.sin(t * 2) * 0.15 : 0);
		P.neck.rotation.z = a === "beg" || st.petted ? Math.sin(t * 1.5) * 0.18 : 0;
		P.eyes.forEach(e2 => { e2.scale.y = a === "sleep" ? 0.12 : st.petted ? 0.35 : (Math.sin(t * 0.7 + 1) > 0.985 ? 0.15 : 1); });
		if (P.tongue) P.tongue.visible = isDog && (a === "happy" || a === "run" || st.petted || a === "beg");
		if (isDog) {
			const wag = a === "happy" || st.petted || a === "beg" ? 14 : moving ? 8 : a === "sleep" ? 0 : 3;
			P.tail.rotation.y = Math.sin(t * wag) * (wag > 8 ? 0.7 : 0.35);
			P.tail.rotation.x = a === "sleep" ? 0.9 : -0.2;
			P.neck.userData["ear-1"].rotation.z = 0.12 + (moving ? Math.sin(phase) * 0.15 : 0);
			P.neck.userData.ear1.rotation.z = -0.12 - (moving ? Math.sin(phase) * 0.15 : 0);
		} else {
			P.tail.rotation.x = -0.6 - lieK * 0.9;
			P.links.forEach((l, i) => {
				l.rotation.x = (a === "sleep" ? 0.0 : 0.12) * (i + 1) * 0.35;
				l.rotation.z = Math.sin(t * (st.petted ? 3 : 1.6) - i * 0.6) * (a === "sleep" ? 0.35 : 0.18);
				l.rotation.y = a === "sleep" || a === "perch" ? 0.45 : 0;
			});
		}
	};
	return P;
}
