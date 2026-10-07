/**
 * Harmony World — the grounds, and the house from outside.
 *
 * Everything outdoors between the places (laid out in worldEstate.js), in world coordinates (this zone's origin is
 * the world's): mown lawns, paved paths between every gate and doorway, a round plaza with the Harmony sculpture in
 * front of the courtyard, avenues of trees and groves in the open lawn, street lamps, benches for two, signposts at
 * the crossings, a clipped hedge all round, and a dark wood beyond it.
 *
 * The house's outside: one clean rectangle (x -22.55..33.7, z -8.8..24.7) under one flat roof at one height, with a
 * continuous charcoal parapet all round, white walls on a dark plinth, tall lit windows and timber panels, solar
 * a walkable roof deck on top (worldRoof.js); the lounge's double-height volume rises out of the middle of it. The rooms
 * keep their own walls inside: this is a skin round all of them, single-sided (facing out), so it never shows from
 * indoors - a window in a room still looks out.
 *
 * Walking here is the grounds' walkFn (worldHouse.js), not walk rects: anywhere inside the hedge that's clear of the
 * house and every place's railings, and through their gates.
 */
import { ESTATE, HEDGE_IN, HOUSE_BLOCKS, HOUSE_RECT, ROOF_Y, PARAPET_Y, LOUNGE_TOP, COURTS, PATIO, GATES, PATHS, PLAZA, WINDOWS, STAIR, subtractRects, pathDist, inRect } from "./worldEstate.js";
import { TERRACE_AT } from "./worldRoom.js";
import { trackPoints } from "./worldPark.js";
import { buildCars, PAD } from "./worldCars.js";

// the lounge's two storeys (with its own roof's overhang): the flat roof stops round it, its walls rise out of it
const UPPER = [6.75, 23.65, -6.32, 8.25];
// the courtyard's notch in the house's south side (the living room's and the lounge's back walls face the patio and the pool)
const NOTCH = [-6.97, 23.12, -8.8, -6.4];
// the terrace, cantilevered out at roof level over the lawn in front of the cinema (nothing tall under it), and the gap
// in the parapet where you step onto it from the roof deck
const TERRACE_OVER = [-7 + TERRACE_AT[0] - 0.4, 5.5 + TERRACE_AT[0] + 0.4, -12 + TERRACE_AT[1] - 0.4, -8.8];
const TERRACE_GAP = [-19.3, -17.3];
// where each place's own floor is (the lawn stops at its edge)
const FOOT = [
	[-7.0, 33.6, -84.1, -38.1], [-7.0, 5.45, -38.1, -32.1],     // the garden
	[-7.6, 33.6, -144.0, -108.1],                                 // the Fun Park
	[-66.0, -27.6, -143.6, -96.8],                                // the kart arena
	[-53.0, -29.6, -27.5, -16.8],                                 // the Aquarium
	[-53.0, -29.6, -50.1, -39.7]                                  // the Haunted Mansion
];
// the zipline from the treehouse (over the garden) to the pool deck: nothing tall under it
const ZIP = [[23.05, -57.5], [16.8, -7.0]];
const LAWN_Y = -0.02, PATH_Y = 0.012;
const segDist = (a, b, x, z) => pathDist([a[0], a[1], b[0], b[1]], x, z);

export function build(k) {
	const { THREE, add, mat, group, rbox, g, ctx, canvasTex, rng } = k;
	const R = rng(8080);
	k.floor(() => 0);
	k.cam = { minX: ESTATE[0] + 0.5, maxX: ESTATE[1] - 0.5, minZ: ESTATE[2] + 0.5, maxZ: ESTATE[3] - 0.5, maxY: 18, minY: 0.2 };
	const glow = c => new THREE.MeshBasicMaterial({ color: c, toneMapped: false });
	const repeat = t => { t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };

	// ================================================================ flat geometry, merged: one mesh per material
	// (quads with world-space uvs, so a texture runs on seamlessly from one piece to the next)
	const parts = {};
	const piece = key => parts[key] || (parts[key] = { pos: [], nor: [], uv: [], idx: [] });
	// four corners (in order round the quad), one normal, four uvs
	function quad(key, pts, n, uvs) {
		const P = piece(key), base = P.pos.length / 3;
		pts.forEach((p, i) => { P.pos.push(p[0], p[1], p[2]); P.nor.push(n[0], n[1], n[2]); P.uv.push(uvs[i][0], uvs[i][1]); });
		P.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
	}
	// a flat rect facing up at height y; s: metres per texture repeat
	function flat(key, r, y, s) {
		const [x0, x1, z0, z1] = r;
		quad(key, [[x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0]], [0, 1, 0], [[x0 / s, -z1 / s], [x1 / s, -z1 / s], [x1 / s, -z0 / s], [x0 / s, -z0 / s]]);
	}
	// an upright rect from (ax, az) to (bx, bz), y0..y1, facing out along n = [nx, nz]; u counts metres from where the
	// face starts (u0), s metres per texture repeat (or uvs: [0..1] across the quad)
	function wallQuad(key, a, b, y0, y1, n, s, u0 = 0, unit = false) {
		// wind it so it faces n
		if (-(b[1] - a[1]) * n[0] + (b[0] - a[0]) * n[1] < 0) { const t = a; a = b; b = t; }
		const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
		const uvs = unit ? [[0, 0], [1, 0], [1, 1], [0, 1]] : [[u0 / s, y0 / s], [(u0 + len) / s, y0 / s], [(u0 + len) / s, y1 / s], [u0 / s, y1 / s]];
		quad(key, [[a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], y1, b[1]], [a[0], y1, a[1]]], [n[0], 0, n[1]], uvs);
	}
	// an axis-aligned box (all six sides)
	function box(key, x0, x1, y0, y1, z0, z1, s = 1) {
		wallQuad(key, [x0, z1], [x1, z1], y0, y1, [0, 1], s, x0);
		wallQuad(key, [x0, z0], [x1, z0], y0, y1, [0, -1], s, x0);
		wallQuad(key, [x1, z0], [x1, z1], y0, y1, [1, 0], s, z0);
		wallQuad(key, [x0, z0], [x0, z1], y0, y1, [-1, 0], s, z0);
		flat(key, [x0, x1, z0, z1], y1, s);
		quad(key, [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [0, -1, 0], [[0, 0], [1, 0], [1, 1], [0, 1]]);
	}
	function finish(key, material, opt = {}) {
		const P = parts[key];
		if (!P || !P.idx.length) return null;
		const geo = new THREE.BufferGeometry();
		geo.setAttribute("position", new THREE.Float32BufferAttribute(P.pos, 3));
		geo.setAttribute("normal", new THREE.Float32BufferAttribute(P.nor, 3));
		geo.setAttribute("uv", new THREE.Float32BufferAttribute(P.uv, 2));
		geo.setIndex(P.idx);
		geo.computeBoundingSphere();
		const m = new THREE.Mesh(geo, material);
		m.castShadow = !!opt.cast; m.receiveShadow = opt.receive !== false;
		g.add(m);
		delete parts[key];
		return m;
	}

	// ================================================================ the ground: lawns inside the hedge, dark fields beyond
	const grassTex = repeat(canvasTex(512, 512, (c, w, h) => {
		c.fillStyle = "#355f31"; c.fillRect(0, 0, w, h);
		// mown in stripes (two passes of the mower per tile)
		c.fillStyle = "rgba(170,220,140,0.045)"; c.fillRect(0, 0, w / 2, h);
		const r = rng(77);
		for (let i = 0; i < 11000; i++) {
			const t = r();
			c.strokeStyle = t < 0.33 ? "rgba(98,160,80,0.5)" : t < 0.66 ? "rgba(40,88,38,0.5)" : "rgba(130,185,95,0.35)";
			c.lineWidth = 1 + r();
			const x = r() * w, y = r() * h;
			c.beginPath(); c.moveTo(x, y); c.lineTo(x + (r() - 0.5) * 4, y - 4 - r() * 6); c.stroke();
		}
	}));
	const lawnRects = subtractRects(ESTATE, HOUSE_BLOCKS.concat(COURTS, FOOT));
	lawnRects.forEach(r => flat("lawn", r, LAWN_Y, 7));
	const lawn = finish("lawn", mat("#ffffff", 0.95, 0, { map: grassTex }));
	lawn.userData.floor = true;
	// beyond the hedge: dark meadow out to the horizon (and a wood all round, below)
	for (const r of [[-700, 700, -700, ESTATE[2]], [-700, 700, ESTATE[3], 700], [-700, ESTATE[0], ESTATE[2], ESTATE[3]], [ESTATE[1], 700, ESTATE[2], ESTATE[3]]]) flat("field", r, -0.06, 9);
	finish("field", mat("#ffffff", 1, 0, { color: "#4d6a48", map: grassTex }), { receive: false });

	// ================================================================ paths and the plaza
	const paverTex = repeat(canvasTex(512, 512, (c, w, h) => {
		c.fillStyle = "#8d857b"; c.fillRect(0, 0, w, h);
		const r = rng(19);
		// long slabs in a running bond, with dark joints
		for (let j = 0; j < 4; j++) for (let i = -1; i < 3; i++) {
			const x = i * 256 + (j % 2) * 128, t = 176 + r() * 22;
			c.fillStyle = `rgb(${t},${t - 6},${t - 14})`;
			c.fillRect(x + 3, j * 128 + 3, 250, 122);
			for (let n = 0; n < 260; n++) { c.fillStyle = `rgba(90,80,70,${r() * 0.12})`; c.fillRect(x + 3 + r() * 248, j * 128 + 3 + r() * 120, 2, 2); }
		}
	}));
	// each path is a rect along its line; where it ends on another path it runs on to that one's far edge
	const onPath = (x, z, self) => PATHS.find(q => q !== self && pathDist(q, x, z) < 0.05);
	for (const p of PATHS) {
		const [x0, z0, x1, z1, w] = p, hw = w / 2;
		const ea = onPath(x0, z0, p), eb = onPath(x1, z1, p);
		const xa = Math.min(x0, x1), xb = Math.max(x0, x1), za = Math.min(z0, z1), zb = Math.max(z0, z1);
		const extA = q => q ? q[4] / 2 : 0;
		if (z0 === z1) {
			const lo = x0 < x1 ? extA(ea) : extA(eb), hi = x0 < x1 ? extA(eb) : extA(ea);
			flat("path", [xa - lo, xb + hi, z0 - hw, z0 + hw], PATH_Y, 2.6);
		} else {
			const lo = z0 < z1 ? extA(ea) : extA(eb), hi = z0 < z1 ? extA(eb) : extA(ea);
			flat("path", [x0 - hw, x0 + hw, za - lo, zb + hi], PATH_Y, 2.6);
		}
	}
	flat("path", PATIO, PATH_Y, 2.6);   // the patio, where the terrace used to be: out of the living room's back door
	const pathMesh = finish("path", mat("#ffffff", 0.85, 0, { map: paverTex }));
	pathMesh.userData.floor = true;
	// the plaza: rings of paving, a glowing ring, and the Harmony sculpture on its plinth
	{
		const P = PLAZA;
		const ringTex = canvasTex(1024, 1024, (c, w, h) => {
			c.fillStyle = "#958c80"; c.fillRect(0, 0, w, h);
			const cx = w / 2, r = rng(23);
			for (let i = 12; i > 0; i--) {
				const rad = i / 12 * w / 2, t = 168 + r() * 26;
				c.fillStyle = `rgb(${t},${t - 7},${t - 15})`;
				c.beginPath(); c.arc(cx, cx, rad - 3, 0, Math.PI * 2); c.fill();
				c.strokeStyle = "rgba(60,52,46,0.6)"; c.lineWidth = 4;
				c.beginPath(); c.arc(cx, cx, rad, 0, Math.PI * 2); c.stroke();
				const n = 6 + i * 4;
				for (let s = 0; s < n; s++) { const a = s / n * Math.PI * 2 + i; c.beginPath(); c.moveTo(cx + Math.cos(a) * (rad - w / 24), cx + Math.sin(a) * (rad - w / 24)); c.lineTo(cx + Math.cos(a) * rad, cx + Math.sin(a) * rad); c.stroke(); }
			}
		});
		const disc = add(g, new THREE.CircleGeometry(P.r, 64), mat("#ffffff", 0.8, 0, { map: ringTex }), P.x, PATH_Y + 0.004, P.z, { rx: -Math.PI / 2, cast: false });
		disc.userData.floor = true;
		add(g, new THREE.RingGeometry(P.r - 0.75, P.r - 0.6, 72), glow("#ffd9a0"), P.x, PATH_Y + 0.01, P.z, { rx: -Math.PI / 2, cast: false, receive: false });
		const granite = mat("#2c2a33", 0.25, 0.3), steel = mat("#e8ecf2", 0.12, 1);
		add(g, new THREE.CylinderGeometry(1.35, 1.45, 0.5, 40), granite, P.x, 0.25, P.z);
		add(g, new THREE.CylinderGeometry(1.1, 1.35, 0.12, 40), mat("#3a3742", 0.3, 0.3), P.x, 0.56, P.z, { cast: false });
		var sculpt = group(g, P.x, 2.25, P.z);
		add(sculpt, new THREE.TorusKnotGeometry(0.95, 0.09, 220, 14, 2, 3), steel, 0, 0, 0);
		const hm = new THREE.Mesh(new THREE.SphereGeometry(0.32, 24, 16), new THREE.MeshStandardMaterial({ color: "#ff4d6d", emissive: "#ff4d6d", emissiveIntensity: 1.1, roughness: 0.3 }));
		sculpt.add(hm);
		add(g, new THREE.CylinderGeometry(0.05, 0.07, 1.1, 10), steel, P.x, 1.15, P.z, { cast: false });
		// uplights round the plinth
		for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; add(g, new THREE.CircleGeometry(0.09, 16), glow("#fff2d6"), P.x + Math.cos(a) * 1.75, PATH_Y + 0.012, P.z + Math.sin(a) * 1.75, { rx: -Math.PI / 2, cast: false, receive: false }); }
		k.box(P.x - P.core, P.x + P.core, P.z - P.core, P.z + P.core);
		// its name, on the plinth (both sides)
		const nm = new THREE.MeshBasicMaterial({ map: k.tex.text("HARMONY", { w: 1024, h: 192, color: "#f3e3c3", font: "800 120px Nunito, 'Segoe UI', sans-serif" }), transparent: true, depthWrite: false });
		for (const sd of [-1, 1]) add(g, new THREE.PlaneGeometry(1.4, 0.26), nm, P.x, 0.27, P.z + sd * 1.43, { ry: sd > 0 ? 0 : Math.PI, cast: false, receive: false });
	}

	// ================================================================ where things may stand (trees, lamps, benches)
	const track = (() => {
		const curve = new THREE.CatmullRomCurve3(trackPoints().map(([x, y, z]) => new THREE.Vector3(x, y, z)), true, "centripetal");
		return curve.getSpacedPoints(900);
	})();
	const solid = HOUSE_BLOCKS.concat(COURTS, FOOT, [TERRACE_OVER]);
	const inner = [ESTATE[0] + HEDGE_IN + 0.8, ESTATE[1] - HEDGE_IN - 0.8, ESTATE[2] + HEDGE_IN + 0.8, ESTATE[3] - HEDGE_IN - 0.8];
	const taken = [];   // [x, z, r]: things already placed
	// the cars' parking pad (worldCars.js) and the way off it onto the path: kept clear of trees and lamps
	for (let x = PAD[0] + 0.6; x < PAD[1] + 0.5; x += 2.4) for (let z = PAD[2] + 0.4; z < PAD[3] + 0.5; z += 2.4) taken.push([x, z, 1.5]);
	// is (x, z) clear for something of radius r, standing h metres tall? (path: how far off a path's edge it must be)
	function clear(x, z, r, h, pathGap) {
		if (!inRect(inner, x, z, -r)) return false;
		for (const q of solid) if (inRect(q, x, z, r + 0.6)) return false;
		for (const q of GATES) if (inRect(q.r, x, z, r + 1.2)) return false;
		for (const p of PATHS) if (pathDist(p, x, z) < p[4] / 2 + pathGap) return false;
		if (Math.hypot(x - PLAZA.x, z - PLAZA.z) < PLAZA.r + r + 0.4) return false;
		if (segDist(ZIP[0], ZIP[1], x, z) < r + (h > 3 ? 3.0 : 0.8)) return false;
		for (const p of track) if (p.y < h + 2.5 && Math.hypot(p.x - x, p.z - z) < r + 1.6) return false;
		for (const t of taken) if (Math.hypot(t[0] - x, t[1] - z) < (t[2] + r) * 0.92) return false;
		return true;
	}

	// ================================================================ benches for two, beside the paths
	{
		const slat = mat("#a46d43", 0.6), conc = mat("#c9c3b8", 0.9), cushionM = mat("#d9c8b0", 0.9);
		const BENCHES = [
			[3.5, -23.25, Math.PI], [3.5, -29.75, 0],          // at the plaza, facing the sculpture
			[-12.0, -23.6, 0], [26.0, -23.6, 0],               // along the cross walk, facing the house
			[-17.8, -52.0, -Math.PI / 2], [-17.8, -73.0, -Math.PI / 2], [-17.8, -104.0, -Math.PI / 2],   // the west avenue
			[37.1, 6.0, Math.PI / 2], [37.1, -40.0, Math.PI / 2], [37.1, -76.0, Math.PI / 2],             // the east walk
			[-6.0, 31.1, Math.PI], [24.0, 31.1, Math.PI],      // behind the house (across the path, facing it)
			[6.0, -94.1, Math.PI], [-12.0, -94.1, Math.PI]     // the south walk
		];
		BENCHES.forEach(([x, z, h], i) => {
			const b = group(g, x, 0, z, h);
			for (const sx of [-0.62, 0.62]) add(b, rbox(0.16, 0.4, 0.46, 0.02), conc, sx, 0.2, 0);
			for (let s = 0; s < 4; s++) add(b, rbox(1.5, 0.045, 0.1, 0.015), slat, 0, 0.42, -0.17 + s * 0.115, { cast: false });
			for (let s = 0; s < 3; s++) add(b, rbox(1.5, 0.09, 0.035, 0.012), slat, 0, 0.6 + s * 0.13, -0.24 - s * 0.012, { rx: -0.1, cast: false });
			for (const sx of [-0.62, 0.62]) add(b, rbox(0.06, 0.5, 0.05, 0.01), conc, sx, 0.62, -0.26, { rx: -0.1, cast: false });
			add(b, rbox(0.4, 0.3, 0.09, 0.04), cushionM, -0.42, 0.6, -0.18, { rx: -0.2, cast: false });
			const c = Math.cos(h), s = Math.sin(h);
			const W = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
			const ids = ["groundsBench" + i + "a", "groundsBench" + i + "b"];
			[-0.35, 0.35].forEach((lx, j) => { const p = W(lx, 0.05); k.spot({ id: ids[j], x: p[0], z: p[1], h, y: 0.04 }); });
			k.interact("grounds:bench" + i, { label: "Sit on the bench", stand: W(0, 0.75), sit: ids }, b);
			const a = W(-0.8, -0.3), bb = W(0.8, 0.28);
			k.box(Math.min(a[0], bb[0]), Math.max(a[0], bb[0]), Math.min(a[1], bb[1]), Math.max(a[1], bb[1]));
			taken.push([x, z, 1.2]);
		});
	}

	// ================================================================ signposts at the crossings
	{
		const DEST = [
			["House & Pool", 11.3, -12.0], ["Garden & Treehouse", 13.0, -41.0], ["Fun Park", 20.0, -110.0],
			["Aquarium", -31.0, -21.5], ["Haunted Mansion", -31.0, -41.65], ["Bumper Karts", -29.0, -119.8]
		];
		const SIGNS = [[-4.75, -21.5], [11.3, -21.5], [-20.0, -21.5], [-20.0, -41.65], [-20.0, -96.0], [20.0, -96.0], [39.0, -21.5], [39.0, -96.0], [-20.0, -119.8]];
		const postM = mat("#2e2a31", 0.5, 0.3);
		const arrow = (c, x, y, ang, s) => {
			c.save(); c.translate(x, y); c.rotate(ang);
			c.beginPath(); c.moveTo(0, -s); c.lineTo(s * 0.75, 0); c.lineTo(s * 0.28, 0); c.lineTo(s * 0.28, s); c.lineTo(-s * 0.28, s); c.lineTo(-s * 0.28, 0); c.lineTo(-s * 0.75, 0); c.closePath(); c.fill();
			c.restore();
		};
		SIGNS.forEach(([sx, sz]) => {
			// in a corner of the crossing, off the paving and out of the way
			let at = null;
			for (const [dx, dz] of [[1, -1], [-1, -1], [1, 1], [-1, 1]]) {
				const x = sx + dx * 2.4, z = sz + dz * 2.4;
				if (clear(x, z, 0.5, 2.5, 0.25)) { at = [x, z]; break; }
			}
			if (!at) return;
			const [x, z] = at;
			const sg = group(g, x, 0, z);
			add(sg, rbox(0.86, 2.3, 0.14, 0.03), postM, 0, 1.15, 0);
			add(sg, new THREE.BoxGeometry(1.0, 0.08, 0.3), mat("#55505a", 0.8), 0, 0.04, 0, { cast: false });
			// a face each way (along z); arrows point the way to go as seen by whoever reads that face
			for (const side of [1, -1]) {
				const fwd = [0, -side];                       // reading it, you face back along its normal
				const right = [-fwd[1], fwd[0]];
				const rows = DEST.filter(d => Math.hypot(d[1] - x, d[2] - z) > 7);
				const tex = canvasTex(512, 1280, (c, w, h) => {
					c.fillStyle = "#2a2630"; c.fillRect(0, 0, w, h);
					c.fillStyle = "#d4ac63"; c.fillRect(0, 0, w, 10);
					c.fillStyle = "#f3e3c3"; c.font = "900 54px Nunito, 'Segoe UI', sans-serif"; c.textAlign = "center"; c.textBaseline = "middle";
					c.fillText("HARMONY", w / 2, 82);
					c.font = "700 30px Nunito, 'Segoe UI', sans-serif"; c.fillStyle = "#b9adc9"; c.fillText("~ estate ~", w / 2, 132);
					rows.forEach((d, i) => {
						const vx = d[1] - x, vz = d[2] - z;
						const a = Math.atan2(vx * right[0] + vz * right[1], vx * fwd[0] + vz * fwd[1]);
						const y = 250 + i * 170;
						c.fillStyle = "rgba(255,255,255,0.06)"; c.fillRect(24, y - 66, w - 48, 132);
						c.fillStyle = "#ffd166"; arrow(c, 84, y, Math.round(a / (Math.PI / 4)) * (Math.PI / 4), 40);
						c.fillStyle = "#fff4e6"; c.textAlign = "left";
						const words = d[0].split(" & ");
						if (words.length > 1) { c.font = "800 44px Nunito, 'Segoe UI', sans-serif"; c.fillText(words[0] + " &", 150, y - 24); c.fillText(words[1], 150, y + 26); }
						else { c.font = "800 50px Nunito, 'Segoe UI', sans-serif"; c.fillText(d[0], 150, y); }
					});
				});
				add(sg, new THREE.PlaneGeometry(0.78, 1.95), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7, emissive: "#ffffff", emissiveMap: tex, emissiveIntensity: 0.35 }), 0, 1.2, side * 0.075, { ry: side > 0 ? 0 : Math.PI, cast: false });
			}
			k.box(x - 0.45, x + 0.45, z - 0.12, z + 0.12);
			taken.push([x, z, 0.8]);
		});
	}

	// ================================================================ street lamps along the paths (and pools of light under them)
	{
		const lamps = [];
		for (const p of PATHS) {
			const [x0, z0, x1, z1, w] = p, len = Math.hypot(x1 - x0, z1 - z0), n = Math.floor(len / 13);
			const dx = (x1 - x0) / len, dz = (z1 - z0) / len;
			for (let i = 0; i <= n; i++) {
				const along = Math.min(len - 1.5, Math.max(1.5, (i + 0.5) * len / (n + 1)));
				const side = i % 2 ? 1 : -1, off = w / 2 + 0.55;
				const x = x0 + dx * along - dz * off * side, z = z0 + dz * along + dx * off * side;
				if (!clear(x, z, 0.25, 3.6, 0.3)) continue;
				lamps.push([x, z]);
				taken.push([x, z, 0.9]);
			}
		}
		const n = lamps.length, d = new THREE.Object3D();
		const posts = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.05, 0.065, 3.3, 8), mat("#2e2a31", 0.45, 0.4), n);
		const heads = new THREE.InstancedMesh(new THREE.BoxGeometry(0.34, 0.1, 0.34), mat("#2e2a31", 0.45, 0.4), n);
		const lens = new THREE.InstancedMesh(new THREE.BoxGeometry(0.22, 0.42, 0.22), glow("#ffd9a0"), n);
		const pools = new THREE.InstancedMesh(new THREE.PlaneGeometry(4.4, 4.4), new THREE.MeshBasicMaterial({
			map: canvasTex(128, 128, (c, w, h) => { const gr = c.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, "rgba(255,214,150,0.55)"); gr.addColorStop(0.5, "rgba(255,200,130,0.18)"); gr.addColorStop(1, "rgba(255,200,130,0)"); c.fillStyle = gr; c.fillRect(0, 0, w, h); }),
			transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false
		}), n);
		lamps.forEach(([x, z], i) => {
			d.rotation.set(0, 0, 0); d.scale.set(1, 1, 1);
			d.position.set(x, 1.65, z); d.updateMatrix(); posts.setMatrixAt(i, d.matrix);
			d.position.set(x, 3.76, z); d.updateMatrix(); heads.setMatrixAt(i, d.matrix);
			d.position.set(x, 3.5, z); d.updateMatrix(); lens.setMatrixAt(i, d.matrix);
			d.position.set(x, PATH_Y + 0.02, z); d.rotation.set(-Math.PI / 2, 0, 0); d.scale.set(1, 1, 1); d.updateMatrix(); pools.setMatrixAt(i, d.matrix);
			k.box(x - 0.12, x + 0.12, z - 0.12, z + 0.12);
		});
		for (const im of [posts, heads, lens, pools]) { im.castShadow = false; im.instanceMatrix.needsUpdate = true; g.add(im); }
		pools.receiveShadow = false; pools.renderOrder = 1;
		var lampCount = n;
	}

	// ================================================================ trees: avenues along the walks, groves in the open lawn
	{
		const trees = [];   // [x, z, kind (0 round, 1 conifer), size, tint]
		const leafCols = ["#2f5d32", "#386b38", "#2b5230", "#41763b", "#335f3a"];
		const showy = ["#e9a1b8", "#f2c4d4", "#c95f3d", "#d9a441"];   // blossom and autumn, here and there
		const avenue = (p, sides, gap, off) => {
			const [x0, z0, x1, z1, w] = p, len = Math.hypot(x1 - x0, z1 - z0), dx = (x1 - x0) / len, dz = (z1 - z0) / len;
			for (let s = gap / 2; s < len; s += gap) for (const side of sides) {
				const o = w / 2 + off, x = x0 + dx * s - dz * o * side, z = z0 + dz * s + dx * o * side;
				if (!clear(x, z, 1.6, 7, 1.2)) continue;
				trees.push([x, z, 0, 1.0, leafCols[trees.length % 2]]);
				taken.push([x, z, 1.6]);
			}
		};
		avenue(PATHS[4], [1, -1], 10, 2.6);        // the west avenue
		avenue(PATHS[10], [1, -1], 10, 2.6);       // the east walk
		avenue(PATHS[8], [1, -1], 8, 2.4);         // the path to the Fun Park
		avenue(PATHS[9], [1, -1], 11, 2.6);        // the south walk
		avenue(PATHS[11], [1], 11, 2.6);           // behind the house (the far side)
		avenue(PATHS[12], [-1], 11, 2.6);          // the west side of the house (the far side)
		avenue(PATHS[2], [-1], 12, 2.8);           // the cross walk (its south side: the house side stays open)
		// groves: clusters scattered through the open lawn
		for (let c = 0; c < 40; c++) {
			const cx = ESTATE[0] + 6 + R() * (ESTATE[1] - ESTATE[0] - 12), cz = ESTATE[2] + 6 + R() * (ESTATE[3] - ESTATE[2] - 12);
			const n = 3 + Math.floor(R() * 5);
			for (let i = 0; i < n * 3 && n > 0; i++) {
				const kind = R() < 0.35 ? 1 : 0, sz = 0.75 + R() * 0.6, r = kind ? 1.2 * sz : 1.8 * sz;
				const x = cx + (R() - 0.5) * 14, z = cz + (R() - 0.5) * 14;
				if (!clear(x, z, r, kind ? 6.5 * sz : 6 * sz, 1.0)) continue;
				const tint = kind ? leafCols[Math.floor(R() * 3)] : R() < 0.18 ? showy[Math.floor(R() * showy.length)] : leafCols[Math.floor(R() * leafCols.length)];
				trees.push([x, z, kind, sz, tint]);
				taken.push([x, z, r]);
			}
		}
		const rounds = trees.filter(t => !t[2]), cones = trees.filter(t => t[2]);
		const d = new THREE.Object3D(), col = new THREE.Color();
		const trunkGeo = new THREE.CylinderGeometry(0.13, 0.2, 1, 7);
		const trunks = new THREE.InstancedMesh(trunkGeo, mat("#5a4030", 0.9), trees.length);
		const crowns = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), mat("#ffffff", 0.85), rounds.length);
		const crowns2 = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), mat("#ffffff", 0.85), rounds.length);
		const spires = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 8), mat("#ffffff", 0.85), cones.length);
		trees.forEach(([x, z, kind, sz], i) => {
			const th = kind ? 1.2 * sz : 2.3 * sz;
			d.position.set(x, th / 2, z); d.rotation.set(0, R() * 6, 0); d.scale.set(sz, th, sz); d.updateMatrix();
			trunks.setMatrixAt(i, d.matrix);
			k.box(x - 0.25 * sz, x + 0.25 * sz, z - 0.25 * sz, z + 0.25 * sz);
		});
		rounds.forEach(([x, z, , sz, tint], i) => {
			const r = 1.75 * sz, y = 2.3 * sz + r * 0.8;
			d.position.set(x, y, z); d.rotation.set(R(), R() * 6, R()); d.scale.set(r, r * 1.08, r); d.updateMatrix();
			crowns.setMatrixAt(i, d.matrix); crowns.setColorAt(i, col.set(tint));
			d.position.set(x + (R() - 0.5) * r * 0.7, y + r * 0.45, z + (R() - 0.5) * r * 0.7); d.scale.setScalar(r * 0.68); d.updateMatrix();
			crowns2.setMatrixAt(i, d.matrix); crowns2.setColorAt(i, col.set(tint).offsetHSL(0, 0, 0.04));
		});
		cones.forEach(([x, z, , sz, tint], i) => {
			const hgt = 6 * sz;
			d.position.set(x, 1.0 * sz + hgt / 2, z); d.rotation.set(0, R() * 6, 0); d.scale.set(1.25 * sz, hgt, 1.25 * sz); d.updateMatrix();
			spires.setMatrixAt(i, d.matrix); spires.setColorAt(i, col.set(tint).offsetHSL(0, 0, -0.04));
		});
		for (const im of [trunks, crowns, crowns2, spires]) { im.castShadow = false; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; g.add(im); }
		var treeCount = trees.length;
	}

	// ================================================================ the hedge all round, and the dark wood beyond it
	{
		const hedgeTex = repeat(canvasTex(256, 256, (c, w, h) => {
			c.fillStyle = "#24472a"; c.fillRect(0, 0, w, h);
			const r = rng(55);
			for (let i = 0; i < 2600; i++) { c.fillStyle = r() < 0.5 ? "rgba(70,120,60,0.6)" : "rgba(20,45,25,0.6)"; c.beginPath(); c.arc(r() * w, r() * h, 2 + r() * 4, 0, Math.PI * 2); c.fill(); }
		}));
		const [x0, x1, z0, z1] = ESTATE, T = 1.1, Hh = 1.6, i0 = 0.2;
		box("hedge", x0 + i0, x1 - i0, 0, Hh, z0 + i0, z0 + i0 + T, 2);
		box("hedge", x0 + i0, x1 - i0, 0, Hh, z1 - i0 - T, z1 - i0, 2);
		box("hedge", x0 + i0, x0 + i0 + T, 0, Hh, z0 + i0 + T, z1 - i0 - T, 2);
		box("hedge", x1 - i0 - T, x1 - i0, 0, Hh, z0 + i0 + T, z1 - i0 - T, 2);
		finish("hedge", mat("#ffffff", 0.95, 0, { map: hedgeTex }));
		// the wood: tall dark firs in a band outside the hedge
		const firs = [];
		for (let i = 0; i < 520 && firs.length < 300; i++) {
			const side = Math.floor(R() * 4), t = R(), o = 3 + R() * 22;
			const x = side < 2 ? x0 - 30 + t * (x1 - x0 + 60) : side === 2 ? x0 - o : x1 + o;
			const z = side < 2 ? (side ? z1 + o : z0 - o) : z0 - 30 + t * (z1 - z0 + 60);
			if (firs.some(f => Math.hypot(f[0] - x, f[1] - z) < 3.4)) continue;
			firs.push([x, z, 0.8 + R() * 0.9]);
		}
		const d = new THREE.Object3D(), col = new THREE.Color();
		// (two tiers each, so they read as firs and not as cones)
		const fir = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 9), mat("#ffffff", 1), firs.length * 2);
		firs.forEach(([x, z, s], i) => {
			const c = col.setHSL(0.34 + R() * 0.06, 0.32, 0.07 + R() * 0.04), ry = R() * 6;
			d.position.set(x, 3.4 * s, z); d.rotation.set(0, ry, 0); d.scale.set(2.3 * s, 6.2 * s, 2.3 * s); d.updateMatrix();
			fir.setMatrixAt(i * 2, d.matrix); fir.setColorAt(i * 2, c);
			d.position.set(x, 7.2 * s, z); d.scale.set(1.6 * s, 5.0 * s, 1.6 * s); d.updateMatrix();
			fir.setMatrixAt(i * 2 + 1, d.matrix); fir.setColorAt(i * 2 + 1, c);
		});
		fir.castShadow = false; fir.instanceMatrix.needsUpdate = true; fir.instanceColor.needsUpdate = true;
		g.add(fir);
	}

	// ================================================================ the house, from outside
	{
		const renderTex = repeat(canvasTex(512, 512, (c, w, h) => {
			c.fillStyle = "#e9e3d8"; c.fillRect(0, 0, w, h);
			const r = rng(61);
			for (let i = 0; i < 9000; i++) { c.fillStyle = `rgba(${r() < 0.5 ? "120,110,95" : "255,255,255"},${r() * 0.06})`; c.fillRect(r() * w, r() * h, 2, 2); }
			// big smooth panels, with fine joints
			c.fillStyle = "rgba(90,80,70,0.16)"; c.fillRect(0, 0, w, 2); c.fillRect(0, 0, 2, h);
		}));
		const woodTex = repeat(canvasTex(256, 512, (c, w, h) => {
			c.fillStyle = "#8a5b3a"; c.fillRect(0, 0, w, h);
			const r = rng(62);
			for (let x = 0; x < w; x += 32) {
				const t = 120 + r() * 40;
				c.fillStyle = `rgb(${t + 30},${t - 10},${t - 50})`; c.fillRect(x + 2, 0, 28, h);
				for (let n = 0; n < 30; n++) { c.strokeStyle = `rgba(60,35,20,${0.1 + r() * 0.15})`; c.lineWidth = 1; c.beginPath(); const xx = x + 4 + r() * 24; c.moveTo(xx, 0); c.lineTo(xx + (r() - 0.5) * 3, h); c.stroke(); }
				c.fillStyle = "rgba(25,15,8,0.7)"; c.fillRect(x, 0, 2, h);
			}
		}));
		const roofTex = repeat(canvasTex(256, 256, (c, w, h) => {
			c.fillStyle = "#57525c"; c.fillRect(0, 0, w, h);
			const r = rng(63);
			for (let i = 0; i < 6000; i++) { c.fillStyle = `rgba(${r() < 0.5 ? "0,0,0" : "255,255,255"},${r() * 0.08})`; c.fillRect(r() * w, r() * h, 2, 2); }
		}));
		const winTex = (lit) => canvasTex(128, 256, (c, w, h) => {
			const gr = c.createLinearGradient(0, 0, 0, h);
			if (lit) { gr.addColorStop(0, "#ffd9a0"); gr.addColorStop(1, "#ffb766"); } else { gr.addColorStop(0, "#3a4a66"); gr.addColorStop(1, "#1d2536"); }
			c.fillStyle = gr; c.fillRect(0, 0, w, h);
			if (lit) { c.fillStyle = "rgba(120,60,40,0.35)"; c.fillRect(0, 0, 22, h); c.fillRect(w - 22, 0, 22, h); }   // curtains drawn back
			c.fillStyle = "#2e2a31"; c.fillRect(0, 0, w, 8); c.fillRect(0, h - 8, w, 8); c.fillRect(0, 0, 8, h); c.fillRect(w - 8, 0, 8, h);
			c.fillRect(w / 2 - 3, 0, 6, h); c.fillRect(0, h * 0.62, w, 5);
		});
		const litT = winTex(true), dimT = winTex(false);
		const S = 2.4;   // metres per texture repeat on the walls
		const HN = HOUSE_RECT[3];   // the house's back (north) face
		// the faces of the skin: from p to q, facing n; y0: from there up (else from the ground); holes: [u0, u1, y0, y1]
		// (u along the face from p) - the real windows of the rooms behind (WINDOWS in worldEstate.js); clad: [u0, u1]
		// panels of vertical timber on the long blank stretches (the cinema, the game room, the bedroom)
		const holesOn = (face, u) => WINDOWS.filter(w => w.face === face).map(w => { const a = u(w.a), b = u(w.b); return [Math.min(a, b), Math.max(a, b), w.y0, w.y1]; });
		const FACES = [
			{ p: [-22.55, -8.8], q: [-22.55, HN], n: [-1, 0], holes: holesOn("w", z => z + 8.8), clad: [[1.4, 3.8], [6.4, 8.8]] },              // west
			{ p: [-22.55, HN], q: [33.7, HN], n: [0, 1], holes: holesOn("n", x => x + 22.55), clad: [[27.3, 30.3], [32.2, 35.2], [37.8, 40.8], [41.8, 44.8]] },     // north (the back: the game room, the spa)
			{ p: [33.7, HN], q: [33.7, -8.8], n: [1, 0], holes: holesOn("e", z => HN - z), clad: [[HN - 0.6, HN + 1.4], [HN + 5.6, HN + 8.0]] },      // east
			{ p: [33.7, -8.8], q: [23.12, -8.8], n: [0, -1], holes: [[0.5, 8.3, 0, 2.75]] },        // the bedroom's glass wall onto the pool deck
			{ p: [23.12, -8.8], q: [23.12, -6.32], n: [-1, 0] },                                      // beside it, onto the deck
			{ p: [-6.97, -6.4], q: [-6.97, -8.8], n: [1, 0] },                                        // the cinema's end, onto the patio
			{ p: [-6.97, -8.8], q: [-22.55, -8.8], n: [0, -1], clad: [[2.83, 5.23], [13.0, 15.0]], pgap: [-6.97 - TERRACE_GAP[1], -6.97 - TERRACE_GAP[0]] }, // the cinema's front, onto the lawn (the terrace juts out over it)
			{ p: [6.75, -6.4], q: [-6.97, -6.4], n: [0, -1], y0: 3.3 }                                // over the living room's back wall (and its old roof's edge)
		];
		const TOP = PARAPET_Y - 0.9;   // where the walls meet the parapet's band
		const PL = 0.42;               // the plinth
		for (const F of FACES) {
			const len = Math.hypot(F.q[0] - F.p[0], F.q[1] - F.p[1]), ux = (F.q[0] - F.p[0]) / len, uz = (F.q[1] - F.p[1]) / len;
			const at = u => [F.p[0] + ux * u, F.p[1] + uz * u];
			const hs = (F.holes || []).slice().sort((a, b) => a[0] - b[0]);
			// the wall in strips round its holes; the plinth along its foot
			const strip = (key, u0, u1, y0, y1) => { if (u1 - u0 > 0.01 && y1 - y0 > 0.01) wallQuad(key, at(u0), at(u1), y0, y1, F.n, S, u0); };
			const y0 = F.y0 || 0;
			const band = (key, ya, yb) => {
				let u = 0;
				for (const h of hs) {
					strip(key, u, h[0], ya, yb);
					strip(key, h[0], h[1], ya, Math.min(yb, Math.max(ya, h[2])));
					strip(key, h[0], h[1], Math.max(ya, Math.min(yb, h[3])), yb);
					u = h[1];
				}
				strip(key, u, len, ya, yb);
			};
			if (y0 < PL) { band("plinth", 0, PL); band("render", PL, TOP); } else band("render", y0, TOP);
			// a dark frame round each hole (a real window into the room behind)
			for (const h of hs) if (h[2] > 0.1) {
				const n = F.n, o = 0.03;
				const a = at(h[0] - 0.08), b = at(h[1] + 0.08);
				const off = p => [p[0] + n[0] * o, p[1] + n[1] * o];
				wallQuad("fascia", off(a), off(b), h[2] - 0.1, h[2], F.n, 1);
				wallQuad("fascia", off(a), off(b), h[3], h[3] + 0.1, F.n, 1);
				wallQuad("fascia", off(at(h[0] - 0.08)), off(at(h[0])), h[2], h[3], F.n, 1);
				wallQuad("fascia", off(at(h[1])), off(at(h[1] + 0.08)), h[2], h[3], F.n, 1);
			}
			// the parapet: a charcoal band all along the top, standing a little proud of the wall
			const pn = F.n, ext = 0.06;
			const pa = at(-ext), pb = at(len + ext);
			const lo = [Math.min(pa[0], pb[0]), Math.max(pa[0], pb[0]), Math.min(pa[1], pb[1]), Math.max(pa[1], pb[1])];
			const out = 0.06, inn = 0.3;
			const bx = pn[0] ? [pn[0] > 0 ? lo[0] - inn : lo[0] - out, pn[0] > 0 ? lo[1] + out : lo[1] + inn] : [lo[0], lo[1]];
			const bz = pn[1] ? [pn[1] > 0 ? lo[2] - inn : lo[2] - out, pn[1] > 0 ? lo[3] + out : lo[3] + inn] : [lo[2], lo[3]];
			if (F.pgap) {
				const [g0, g1] = F.pgap, ga = at(g0), gb = at(g1);
				const along = Math.abs(F.n[0]) < 0.5;   // (the face runs along x)
				const lo0 = along ? Math.min(ga[0], gb[0]) : Math.min(ga[1], gb[1]), hi0 = along ? Math.max(ga[0], gb[0]) : Math.max(ga[1], gb[1]);
				if (along) { box("fascia", bx[0], lo0, TOP, PARAPET_Y, bz[0], bz[1], 1); box("fascia", hi0, bx[1], TOP, PARAPET_Y, bz[0], bz[1], 1); box("fascia", lo0, hi0, TOP, ROOF_Y + 0.1, bz[0], bz[1], 1); }
				else { box("fascia", bx[0], bx[1], TOP, PARAPET_Y, bz[0], lo0, 1); box("fascia", bx[0], bx[1], TOP, PARAPET_Y, hi0, bz[1], 1); box("fascia", bx[0], bx[1], TOP, ROOF_Y + 0.1, lo0, hi0, 1); }
			} else box("fascia", bx[0], bx[1], TOP, PARAPET_Y, bz[0], bz[1], 1);
			// timber panels, and a slim sill under each window
			const o = 0.025, off = p => [p[0] + F.n[0] * o, p[1] + F.n[1] * o];
			for (const [u0, u1] of F.clad || []) wallQuad("wood", off(at(u0)), off(at(u1)), PL, TOP, F.n, 1.6, u0);
			for (const h of hs) if (h[2] > 0.3) {
				const sa = at(h[0] - 0.1), sb = at(h[1] + 0.1);
				box("fascia", Math.min(sa[0], sb[0]) + (F.n[0] ? Math.min(0, F.n[0] * 0.14) : 0), Math.max(sa[0], sb[0]) + (F.n[0] ? Math.max(0, F.n[0] * 0.14) : 0), h[2] - 0.17, h[2] - 0.1,
					Math.min(sa[1], sb[1]) + (F.n[1] ? Math.min(0, F.n[1] * 0.14) : 0), Math.max(sa[1], sb[1]) + (F.n[1] ? Math.max(0, F.n[1] * 0.14) : 0), 1);
			}
		}
		// the lounge's double-height volume, rising out of the roof: white walls on all sides but the pool's (brick, by
		// worldPool.js), and the parapet round its top
		const UTOP = LOUNGE_TOP - 0.45;
		const [ux0, ux1, uz0, uz1] = UPPER;
		wallQuad("render", [ux0, uz1], [ux0, uz0], ROOF_Y - 0.05, UTOP, [-1, 0], S);
		wallQuad("render", [ux1, uz1], [ux0, uz1], ROOF_Y - 0.05, UTOP, [0, 1], S);
		wallQuad("render", [ux1, uz0], [ux1, uz1], ROOF_Y - 0.05, UTOP, [1, 0], S);
		wallQuad("render", [7.25, uz0], [ux0, uz0], ROOF_Y - 0.05, UTOP, [0, -1], S);
		wallQuad("render", [ux1, uz0], [23.12, uz0], ROOF_Y - 0.05, UTOP, [0, -1], S);
		box("fascia", ux0 - 0.06, ux0 + 0.3, UTOP, LOUNGE_TOP, uz0 - 0.06, uz1 + 0.06, 1);
		box("fascia", ux1 - 0.3, ux1 + 0.06, UTOP, LOUNGE_TOP, uz0 - 0.06, uz1 + 0.06, 1);
		box("fascia", ux0 + 0.3, ux1 - 0.3, UTOP, LOUNGE_TOP, uz1 - 0.3, uz1 + 0.06, 1);
		box("fascia", ux0 + 0.3, ux1 - 0.3, UTOP, LOUNGE_TOP, uz0 - 0.06, uz0 + 0.3, 1);
		// a clerestory of lit glass along the top of the upper walls (three sides)
		for (const [a, b, n] of [[[ux0, uz1 - 1.2], [ux0, uz0 + 1.2], [-1, 0]], [[ux1 - 1.2, uz1], [ux0 + 1.2, uz1], [0, 1]], [[ux1, uz0 + 1.2], [ux1, uz1 - 1.2], [1, 0]]]) {
			const o = 0.025;
			wallQuad("winLit", [a[0] + n[0] * o, a[1] + n[1] * o], [b[0] + n[0] * o, b[1] + n[1] * o], ROOF_Y + 0.55, ROOF_Y + 1.25, n, 1, 0, true);
		}
		// the flat roof, all one height (the courtyard's notch, the lounge and the stairwell cut out of it); the roof deck
		// (worldRoof.js) is laid over it, and the stairwell's glass pavilion stands over the hole
		subtractRects(HOUSE_RECT, [NOTCH, UPPER, [STAIR.x0, STAIR.x1, STAIR.hole, STAIR.top]]).forEach(r => flat("roof", r, ROOF_Y, 3));
		const walls = finish("render", mat("#ffffff", 0.88, 0, { map: renderTex }));
		finish("plinth", mat("#4e4955", 0.9));
		finish("fascia", mat("#2e2a31", 0.55, 0.25));
		finish("wood", mat("#ffffff", 0.7, 0, { map: woodTex }));
		finish("roof", mat("#ffffff", 0.95, 0, { map: roofTex }));
		finish("winLit", new THREE.MeshStandardMaterial({ color: "#3a2a20", roughness: 0.2, metalness: 0.1, emissive: "#ffffff", emissiveMap: litT, emissiveIntensity: 0.85 }));
		finish("skylight", new THREE.MeshStandardMaterial({ color: "#2a3550", roughness: 0.1, metalness: 0.4, emissive: "#ffe2b0", emissiveMap: repeat(canvasTex(64, 64, (c, w, h) => { c.fillStyle = "#c9a878"; c.fillRect(0, 0, w, h); c.fillStyle = "#2e2a31"; c.fillRect(0, 0, w, 4); c.fillRect(0, 0, 4, h); })), emissiveIntensity: 0.55 }));
		finish("winDim", new THREE.MeshStandardMaterial({ map: dimT, roughness: 0.15, metalness: 0.3, emissive: "#1d2a44", emissiveIntensity: 0.25 }));
		// solid to the camera from outside (it stops at the walls, never ending up inside them); from indoors, where the
		// camera's target is already inside one of these, they don't count (y from below the cinema's sunken floor)
		HOUSE_BLOCKS.forEach(b => k.camWall(b[0], b[1], b[2], b[3], -2.5, PARAPET_Y));
		k.camWall(UPPER[0], UPPER[1], UPPER[2], UPPER[3], -2.5, LOUNGE_TOP);
		var houseWalls = walls;
	}
	if (ctx.debug) console.log(`[grounds] ${lawnRects.length} lawn pieces, ${treeCount} trees, ${lampCount} lamps`);

	// ================================================================ every frame
	// ================================================================ the cars (worldCars.js)
	const cars = buildCars(k, { PATH_Y });

	function update(dt, t) {
		sculpt.rotation.y = t * 0.25;
		sculpt.position.y = 2.25 + Math.sin(t * 0.9) * 0.06;
		cars.update(dt, t);
	}
	return {
		update, houseWalls,
		lateUpdate: cars.lateUpdate, vehicle: cars.vehicle, solidAt: cars.solidAt, onFx: cars.onFx, promptOpts: cars.promptOpts
	};
}
