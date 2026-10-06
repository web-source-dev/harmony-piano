/**
 * Harmony World — the roof deck: the whole flat roof of the house, walkable, behind glass railings.
 *
 * Drawn coordinates (on the floor plan the roof sits ROOF_FP away - worldEstate.js - and this zone's origin is that
 * offset, so these are where things are drawn; y from the deck, ROOF_FLOOR up). Walking here is the roof's walkFn
 * (worldHouse.js, from ROOF_PLAN): anywhere inside the parapet but the courtyard, the lounge's upper storey, the
 * stairwell and the rooftop rooms.
 *   up the Gallery's grand staircase into a glass pavilion (its top step is the way across), out of its open east side
 *   west:   a pergola lounge with outdoor sofas, garden beds and olive trees along the parapet, the roof bar
 *   south:  the gap in the railing onto the terrace (cantilevered out over the lawn, worldTerrace.js)
 *   middle: a fire-bowl lounge with bean bags over the living room, a putting green over the foyer
 *   north:  the playroom's pavilion (worldPlayroom.js) and the gym's (worldGym.js), their doors onto a wide, clear
 *           promenade between them and the lounge's upper storey; sun loungers over the east wing looking over the pool
 *   a photo board by the fire bowl (frames 92 and 93: your own photos)
 *   string lights, bollards and planters all round
 */
import { ROOF_DECK, ROOF_PLAN, STAIR, WING, subtractRects } from "./worldEstate.js";

const DECK = ROOF_DECK;                            // inside the parapet
const NOTCH = [-7.27, 23.42, -8.8, -6.1];          // the courtyard (and its parapets)
const UPPER = ROOF_PLAN.upper;
const PAV = ROOF_PLAN.pavilion, PAV_H = 2.7;
const out = (r, d) => [r[0] - d, r[1] + d, r[2] - d, r[3] + d];

export function build(k) {
	const { THREE, add, mat, group, rbox, g, ctx, canvasTex, rng, tex } = k;
	const R = rng(9090);
	k.floor(() => 0);
	k.cam = { minX: DECK[0], maxX: DECK[1], minZ: DECK[2] - 1.0, maxZ: DECK[3], maxY: 9, minY: 0.3 };
	const glow = c => new THREE.MeshBasicMaterial({ color: c, toneMapped: false });
	const rep = t => { t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };

	// ---------------------------------------------------------------- the deck: pale pavers, with timber where you sit
	const parts = {};
	const flat = (key, r, y, s) => {
		const P = parts[key] || (parts[key] = { pos: [], uv: [], idx: [] });
		const [x0, x1, z0, z1] = r, b = P.pos.length / 3;
		P.pos.push(x0, y, z1, x1, y, z1, x1, y, z0, x0, y, z0);
		P.uv.push(x0 / s, -z1 / s, x1 / s, -z1 / s, x1 / s, -z0 / s, x0 / s, -z0 / s);
		P.idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
	};
	const finish = (key, m) => {
		const P = parts[key], geo = new THREE.BufferGeometry();
		geo.setAttribute("position", new THREE.Float32BufferAttribute(P.pos, 3));
		geo.setAttribute("normal", new THREE.Float32BufferAttribute(P.pos.map((v, i) => i % 3 === 1 ? 1 : 0), 3));
		geo.setAttribute("uv", new THREE.Float32BufferAttribute(P.uv, 2));
		geo.setIndex(P.idx);
		const mesh = new THREE.Mesh(geo, m);
		mesh.receiveShadow = true;
		mesh.userData.floor = true;
		g.add(mesh);
		return mesh;
	};
	const paver = rep(canvasTex(512, 512, (c, w, h) => {
		c.fillStyle = "#8f877d"; c.fillRect(0, 0, w, h);
		const r = rng(41);
		for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
			const t = 190 + r() * 18;
			c.fillStyle = `rgb(${t},${t - 5},${t - 12})`; c.fillRect(i * 128 + 3, j * 128 + 3, 122, 122);
			for (let n = 0; n < 200; n++) { c.fillStyle = `rgba(90,80,70,${r() * 0.1})`; c.fillRect(i * 128 + 3 + r() * 120, j * 128 + 3 + r() * 120, 2, 2); }
		}
	}));
	const holes = [NOTCH, UPPER, PAV, out(WING.gym, 0.25), out(WING.playroom, 0.25)];
	subtractRects(DECK, holes).forEach(r => flat("pavers", r, 0, 2.4));
	finish("pavers", mat("#ffffff", 0.85, 0, { map: paver }));
	const timber = rep(tex.wood(["#8a6448", "#94704f", "#7e5a40", "#9a7656"], 1, 1, 17));
	const TIMBER = [[-21.6, -13.2, 0.6, 7.6], [-3.2, 3.6, -5.2, 1.8], [24.0, 33.1, -8.2, -1.2]];
	TIMBER.forEach(r => flat("timber", r, 0.012, 3));
	finish("timber", mat("#ffffff", 0.7, 0, { map: timber }));

	// ---------------------------------------------------------------- glass railings along the parapet (a gap onto the terrace)
	{
		const railM = mat("#2e2a31", 0.45, 0.4);
		const glassM = new THREE.MeshPhysicalMaterial({ color: "#cfe7ff", transparent: true, opacity: 0.16, roughness: 0.05, depthWrite: false, side: THREE.DoubleSide });
		const posts = [];
		const run = (x0, z0, x1, z1) => {
			const len = Math.hypot(x1 - x0, z1 - z0), ang = Math.atan2(x1 - x0, z1 - z0);
			const rg = group(g, (x0 + x1) / 2, 0, (z0 + z1) / 2, ang);
			add(rg, new THREE.BoxGeometry(0.06, 0.05, len + 0.06), railM, 0, 1.08, 0, { cast: false });
			const gl = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.95), glassM);
			gl.rotation.y = Math.PI / 2; gl.position.y = 0.55; gl.renderOrder = 2;
			rg.add(gl);
			const n = Math.max(1, Math.round(len / 1.5));
			for (let i = 0; i <= n; i++) { const u = -len / 2 + len * i / n; posts.push([(x0 + x1) / 2 + Math.sin(ang) * u, (z0 + z1) / 2 + Math.cos(ang) * u]); }
		};
		const W = -22.3, E = 33.45, N = DECK[3] + 0.05, S = -8.55, gap = ROOF_PLAN.terraceGap;
		run(W, S, W, N); run(W, N, E, N); run(E, N, E, S);
		run(W, S, gap[0], S); run(gap[1], S, NOTCH[0], S);
		run(NOTCH[0], S, NOTCH[0], NOTCH[3]); run(NOTCH[0], NOTCH[3], UPPER[0], NOTCH[3]);
		run(NOTCH[1], S, NOTCH[1], UPPER[2]); run(NOTCH[1], S, E, S);
		const pm = new THREE.InstancedMesh(new THREE.BoxGeometry(0.05, 1.1, 0.05), railM, posts.length), d = new THREE.Object3D();
		posts.forEach(([x, z], i) => { d.position.set(x, 0.55, z); d.updateMatrix(); pm.setMatrixAt(i, d.matrix); });
		pm.castShadow = false; pm.instanceMatrix.needsUpdate = true;
		g.add(pm);
		// a sign at the way onto the terrace
		const st = tex.sign("Terrace", "heart");
		const sg = group(g, gap[1] + 0.5, 0, S + 0.4);
		add(sg, new THREE.CylinderGeometry(0.035, 0.05, 1.3, 10), railM, 0, 0.65, 0);
		add(sg, new THREE.PlaneGeometry(0.9, 0.225), new THREE.MeshStandardMaterial({ map: st, roughness: 0.45, emissive: "#ffffff", emissiveMap: st, emissiveIntensity: 0.35, side: THREE.DoubleSide }), 0, 1.42, 0, { cast: false });
		k.box(gap[1] + 0.4, gap[1] + 0.6, S + 0.3, S + 0.5);
	}

	// ---------------------------------------------------------------- the glass pavilion over the top of the stairs
	{
		const [x0, x1, z0] = PAV, zt = STAIR.top - 0.1, open = ROOF_PLAN.landing[2];
		const glassM = new THREE.MeshPhysicalMaterial({ color: "#cfe7ff", transparent: true, opacity: 0.2, roughness: 0.05, metalness: 0.1, depthWrite: false, side: THREE.DoubleSide });
		const steel = mat("#2e2a31", 0.45, 0.4);
		const pane = (ax, az, bx, bz) => {
			const len = Math.hypot(bx - ax, bz - az), m = new THREE.Mesh(new THREE.PlaneGeometry(len, PAV_H), glassM);
			m.position.set((ax + bx) / 2, PAV_H / 2, (az + bz) / 2); m.rotation.y = Math.atan2(bx - ax, bz - az) + Math.PI / 2; m.renderOrder = 2;
			g.add(m);
		};
		pane(x0, z0, x0, zt); pane(x0, z0, x1, z0); pane(x1, z0, x1, open); pane(x0, zt, x1, zt);
		const top = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0 + 0.3, zt - z0 + 0.3), glassM);
		top.rotation.x = -Math.PI / 2; top.position.set((x0 + x1) / 2, PAV_H, (z0 + zt) / 2); top.renderOrder = 2;
		g.add(top);
		for (const [x, z] of [[x0, z0], [x1, z0], [x0, zt], [x1, zt], [x1, open]]) add(g, new THREE.BoxGeometry(0.1, PAV_H + 0.05, 0.1), steel, x, PAV_H / 2, z, { cast: false });
		for (const [a0, a1, b0, b1] of [[x0, x1, z0, z0], [x0, x1, zt, zt], [x0, x0, z0, zt], [x1, x1, z0, zt]]) add(g, new THREE.BoxGeometry(Math.max(0.1, a1 - a0), 0.1, Math.max(0.1, b1 - b0)), steel, (a0 + a1) / 2, PAV_H, (b0 + b1) / 2, { cast: false });
		// a rail round the stairwell, inside
		add(g, new THREE.BoxGeometry(0.05, 0.05, ROOF_PLAN.landing[2] - z0), steel, -5.6, 1.05, (z0 + ROOF_PLAN.landing[2]) / 2, { cast: false });
		const st = tex.sign("Stairs down", "home");
		add(g, new THREE.PlaneGeometry(0.9, 0.225), new THREE.MeshStandardMaterial({ map: st, roughness: 0.45, emissive: "#ffffff", emissiveMap: st, emissiveIntensity: 0.35, side: THREE.DoubleSide }), x1 + 0.02, 2.25, (open + zt) / 2, { ry: Math.PI / 2, cast: false });
		k.camWall(x0, x1, z0, open, 0, PAV_H);
	}
	// (the camera stays out of the lounge's upper storey and the rooftop rooms)
	k.camWall(UPPER[0], UPPER[1], UPPER[2], UPPER[3], -1, 2.4);
	for (const r of [WING.gym, WING.playroom]) { const o = out(r, 0.25); k.camWall(o[0], o[1], o[2], o[3], -1, 3.8); }

	// ---------------------------------------------------------------- the pergola lounge (west)
	{
		const oak = mat("#7a5236", 0.6), cushion = mat("#e8dccb", 0.9), accentA = mat("#2a9d8f", 0.85), accentB = mat("#e76f51", 0.85);
		const [px0, px1, pz0, pz1] = [-21.4, -13.4, 0.8, 7.4];
		for (const x of [px0, px1]) for (const z of [pz0, pz1]) { add(g, new THREE.BoxGeometry(0.14, 2.7, 0.14), oak, x, 1.35, z); k.box(x - 0.1, x + 0.1, z - 0.1, z + 0.1); }
		for (const z of [pz0, pz1]) add(g, new THREE.BoxGeometry(px1 - px0 + 0.4, 0.16, 0.12), oak, (px0 + px1) / 2, 2.72, z);
		for (let x = px0 + 0.3; x < px1; x += 0.45) add(g, new THREE.BoxGeometry(0.06, 0.1, pz1 - pz0 + 0.5), oak, x, 2.85, (pz0 + pz1) / 2, { cast: false });
		// two outdoor sofas facing each other over a low table, and an armchair
		const sofa = (x, z, h, i) => {
			const s = group(g, x, 0, z, h);
			add(s, rbox(2.2, 0.36, 0.85, 0.05), oak, 0, 0.18, 0);
			add(s, rbox(2.1, 0.18, 0.8, 0.07), cushion, 0, 0.45, 0);
			add(s, rbox(2.2, 0.5, 0.18, 0.06), cushion, 0, 0.7, -0.36);
			add(s, rbox(0.45, 0.36, 0.12, 0.05), i ? accentB : accentA, -0.55, 0.68, -0.22, { rx: -0.2, cast: false });
			add(s, rbox(0.45, 0.36, 0.12, 0.05), i ? accentA : accentB, 0.55, 0.68, -0.22, { rx: -0.2, cast: false });
			const c = Math.cos(h), sn = Math.sin(h), Wp = (lx, lz) => [x + lx * c + lz * sn, z - lx * sn + lz * c];
			const ids = ["roofSofa" + i + "a", "roofSofa" + i + "b"];
			[-0.45, 0.45].forEach((lx, j) => { const p = Wp(lx, 0.05); k.spot({ id: ids[j], x: p[0], z: p[1], h, y: 0.06 }); });
			k.interact("roof:sofa" + i, { label: "Sit under the pergola", stand: Wp(0, 0.95), sit: ids }, s);
			const a = Wp(-1.15, -0.45), b = Wp(1.15, 0.45);
			k.box(Math.min(a[0], b[0]), Math.max(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[1], b[1]));
		};
		sofa(-17.4, 2.0, 0, 0);
		sofa(-17.4, 6.2, Math.PI, 1);
		const t = group(g, -17.4, 0, 4.1);
		add(t, rbox(1.6, 0.06, 0.8, 0.02), oak, 0, 0.4, 0);
		add(t, rbox(1.4, 0.36, 0.6, 0.02), mat("#2e2a31", 0.6), 0, 0.19, 0);
		add(t, new THREE.CylinderGeometry(0.12, 0.1, 0.18, 14), mat("#f4f1de", 0.4), 0.3, 0.52, 0, { cast: false });
		for (let i = 0; i < 6; i++) add(t, new THREE.SphereGeometry(0.06, 8, 6), mat(["#ff8fab", "#ffd166"][i % 2], 0.7), 0.3 + Math.cos(i) * 0.06, 0.66 + (i % 3) * 0.04, Math.sin(i) * 0.06, { cast: false });
		k.box(-18.2, -16.6, 3.7, 4.5);
		// fairy lights draped under the slats
		const bulbs = [];
		for (let r = 0; r < 4; r++) for (let i = 0; i <= 14; i++) { const x = px0 + (px1 - px0) * i / 14, z = pz0 + 0.8 + r * 1.6; bulbs.push([x, 2.6 - Math.sin(i / 14 * Math.PI) * 0.35, z]); }
		const bm = new THREE.InstancedMesh(new THREE.SphereGeometry(0.04, 8, 6), glow("#ffd9a0"), bulbs.length), d = new THREE.Object3D();
		bulbs.forEach((p, i) => { d.position.set(...p); d.updateMatrix(); bm.setMatrixAt(i, d.matrix); });
		bm.castShadow = false; bm.instanceMatrix.needsUpdate = true;
		g.add(bm);
	}

	// ---------------------------------------------------------------- garden beds and olive trees along the west parapet
	const trees = [];
	{
		const bedM = mat("#d8cfc4", 0.7), soil = mat("#3a2a1f", 1);
		for (const [z0, z1] of [[9.0, 12.4], [17.4, 23.8], [-7.9, -0.2]]) {
			const x0 = -22.15, x1 = -21.0;
			add(g, new THREE.BoxGeometry(x1 - x0, 0.5, z1 - z0), bedM, (x0 + x1) / 2, 0.25, (z0 + z1) / 2);
			add(g, new THREE.PlaneGeometry(x1 - x0 - 0.1, z1 - z0 - 0.1), soil, (x0 + x1) / 2, 0.501, (z0 + z1) / 2, { rx: -Math.PI / 2, cast: false });
			k.box(x0, x1, z0, z1);
			for (let z = z0 + 0.4; z < z1 - 0.2; z += 0.35) for (let j = 0; j < 2; j++) trees.push(["shrub", (x0 + x1) / 2 + (R() - 0.5) * 0.6, z + (R() - 0.5) * 0.2, 0.5]);
			for (let z = z0 + 1.2; z < z1 - 0.6; z += 2.6) trees.push(["olive", (x0 + x1) / 2, z, 0.5]);
		}
		// big planters with trees round the deck
		for (const [x, z] of [[-12.2, 8.8], [-4.6, 8.8], [32.75, 8.9], [20.6, 23.5], [-4.2, 21.0], [24.0, 0.0], [-6.6, -5.6], [4.6, -5.6]]) {
			const p = group(g, x, 0, z);
			add(p, rbox(0.8, 0.6, 0.8, 0.05), mat("#2e2a31", 0.6), 0, 0.3, 0);
			k.box(x - 0.45, x + 0.45, z - 0.45, z + 0.45);
			trees.push(["olive", x, z, 0.6]);
		}
		const d = new THREE.Object3D(), col = new THREE.Color();
		const shrubs = trees.filter(t => t[0] === "shrub"), olives = trees.filter(t => t[0] === "olive");
		const sm = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.28, 1), mat("#ffffff", 0.85), shrubs.length);
		shrubs.forEach(([, x, z, y], i) => { d.position.set(x, y + 0.15, z); d.scale.setScalar(0.7 + R() * 0.6); d.updateMatrix(); sm.setMatrixAt(i, d.matrix); sm.setColorAt(i, col.set(R() < 0.25 ? ["#ff8fab", "#ffd166", "#c77dff"][Math.floor(R() * 3)] : R() < 0.5 ? "#4f8a57" : "#3f7a48")); });
		const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.05, 0.08, 1.4, 7), mat("#6b5040", 0.8), olives.length);
		const crown = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.7, 1), mat("#ffffff", 0.8), olives.length);
		olives.forEach(([, x, z, y], i) => {
			d.position.set(x, y + 0.7, z); d.scale.set(1, 1, 1); d.updateMatrix(); trunk.setMatrixAt(i, d.matrix);
			d.position.set(x, y + 1.7, z); d.scale.set(1, 0.8, 1); d.updateMatrix(); crown.setMatrixAt(i, d.matrix); crown.setColorAt(i, col.set(i % 2 ? "#7d9a62" : "#6a8a55"));
		});
		for (const im of [sm, trunk, crown]) { im.castShadow = false; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; g.add(im); }
	}

	// ---------------------------------------------------------------- the roof bar
	{
		const bx = -12.6, bz = 14.2, wood = mat("#4a2f22", 0.45), top = mat("#f1eee9", 0.2, 0.05);
		add(g, rbox(3.4, 1.05, 0.6, 0.03), wood, bx, 0.525, bz);
		add(g, rbox(3.6, 0.06, 0.75, 0.02), top, bx, 1.08, bz);
		add(g, new THREE.BoxGeometry(3.4, 0.04, 0.04), glow("#4cc9f0"), bx, 0.12, bz + 0.31, { cast: false });
		// the back bar: shelves of bottles, a neon sign
		add(g, rbox(3.4, 2.0, 0.4, 0.03), wood, bx, 1.0, bz + 1.6);
		for (let i = 0; i < 18; i++) add(g, new THREE.CylinderGeometry(0.035, 0.035, 0.24 + (i % 3) * 0.05, 10), mat(["#7a1d33", "#e9c46a", "#2a9d8f", "#264653", "#f4a261", "#c9e4ff"][i % 6], 0.15, 0.1), bx - 1.5 + (i % 9) * 0.37, i < 9 ? 1.32 : 1.82, bz + 1.36, { cast: false });
		const neon = tex.text("ROOF BAR", { w: 1024, h: 256, color: "#fff3fb", glow: "#ff4d9d", font: "900 140px 'Nunito', sans-serif" });
		add(g, new THREE.PlaneGeometry(2.2, 0.55), new THREE.MeshBasicMaterial({ map: neon, transparent: true, toneMapped: false, depthWrite: false }), bx, 2.3, bz + 1.38, { ry: Math.PI, cast: false, receive: false });
		k.box(bx - 1.8, bx + 1.8, bz - 0.38, bz + 0.38);
		k.box(bx - 1.8, bx + 1.8, bz + 1.35, bz + 1.85);
		const stools = [];
		for (let i = 0; i < 4; i++) {
			const x = bx - 1.2 + i * 0.8, z = bz - 0.75, s = group(g, x, 0, z);
			add(s, new THREE.CylinderGeometry(0.2, 0.2, 0.06, 18), mat("#e76f51", 0.6), 0, 0.72, 0);
			add(s, new THREE.CylinderGeometry(0.03, 0.03, 0.7, 8), mat("#2e2a31", 0.4, 0.6), 0, 0.36, 0, { cast: false });
			add(s, new THREE.CylinderGeometry(0.18, 0.2, 0.03, 18), mat("#2e2a31", 0.4, 0.6), 0, 0.015, 0, { cast: false });
			const id = "roofStool" + i;
			k.spot({ id, x, z, h: Math.PI, y: 0.26 });
			stools.push(id);
		}
		k.interact("roof:bar", { label: "Pull up a stool at the bar", stand: [bx, bz - 1.5], sit: stools }, g.children[g.children.length - 1]);
	}

	// ---------------------------------------------------------------- the fire-bowl lounge (over the living room)
	const flames = [];
	{
		const fx = 0.2, fz = -1.7;
		const fb = group(g, fx, 0, fz);
		add(fb, new THREE.CylinderGeometry(0.75, 0.5, 0.45, 32), mat("#3a3530", 0.7, 0.3), 0, 0.225, 0);
		add(fb, new THREE.CylinderGeometry(0.68, 0.68, 0.02, 32), mat("#1e1814", 1), 0, 0.45, 0, { cast: false });
		for (let i = 0; i < 6; i++) {
			const m = new THREE.MeshBasicMaterial({ color: i % 2 ? "#ffb347" : "#ff7a2f", transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
			const f = add(fb, new THREE.ConeGeometry(0.1 + R() * 0.05, 0.45, 10), m, (R() - 0.5) * 0.5, 0.65, (R() - 0.5) * 0.5, { cast: false });
			f.userData.ph = R() * 6; flames.push(f);
		}
		k.box(fx - 0.8, fx + 0.8, fz - 0.8, fz + 0.8);
		k.interact("roof:fire", { label: "Warm your hands by the fire", stand: [fx, fz + 1.3], face: Math.PI }, fb);
		const beanM = ["#2a9d8f", "#e9c46a", "#e76f51", "#c77dff"].map(c => mat(c, 0.95));
		for (let i = 0; i < 4; i++) {
			const a = i / 4 * Math.PI * 2 + Math.PI / 4, bx = fx + Math.sin(a) * 2.0, bz = fz + Math.cos(a) * 2.0, face = a + Math.PI;
			const bb = group(g, bx, 0, bz, face);
			const body = add(bb, new THREE.SphereGeometry(0.42, 24, 16), beanM[i], 0, 0.22, 0); body.scale.set(1, 0.55, 1);
			const back = add(bb, new THREE.SphereGeometry(0.34, 20, 14), beanM[i], 0, 0.38, -0.22); back.scale.set(1.05, 0.9, 0.6);
			k.box(bx - 0.35, bx + 0.35, bz - 0.35, bz + 0.35);
			k.spot({ id: "roofBean" + i, x: bx + Math.sin(face) * 0.05, z: bz + Math.cos(face) * 0.05, h: face, y: -0.13, low: true });
			k.interact("roof:bean" + i, { label: "Sink into the bean bag", stand: [bx + Math.sin(face) * 0.75, bz + Math.cos(face) * 0.75], sit: ["roofBean" + i] }, bb);
		}
	}

	// ---------------------------------------------------------------- a putting green (over the foyer)
	{
		const green = canvasTex(256, 256, (c, w, h) => { c.fillStyle = "#3f8f45"; c.fillRect(0, 0, w, h); c.fillStyle = "rgba(255,255,255,0.05)"; c.fillRect(0, 0, w / 2, h); for (let i = 0; i < 3000; i++) { c.fillStyle = `rgba(20,60,20,${R() * 0.2})`; c.fillRect(R() * w, R() * h, 1, 3); } });
		const gp = add(g, new THREE.PlaneGeometry(6.4, 6.0), mat("#ffffff", 0.95, 0, { map: green }), -0.6, 0.015, 15.4, { rx: -Math.PI / 2, cast: false });
		gp.userData.floor = true;
		for (const [x, z, c] of [[-2.6, 17.4, "#ff4d6d"], [1.6, 13.4, "#ffd166"]]) {
			add(g, new THREE.CircleGeometry(0.08, 16), mat("#111", 1), x, 0.02, z, { rx: -Math.PI / 2, cast: false });
			add(g, new THREE.CylinderGeometry(0.01, 0.01, 1.3, 6), mat("#f4f1de", 0.5), x, 0.65, z, { cast: false });
			add(g, new THREE.PlaneGeometry(0.35, 0.22), new THREE.MeshStandardMaterial({ color: c, side: THREE.DoubleSide }), x + 0.18, 1.18, z, { cast: false });
		}
		for (let i = 0; i < 5; i++) add(g, new THREE.SphereGeometry(0.025, 10, 8), mat("#ffffff", 0.3), -0.6 + (R() - 0.5) * 4, 0.04, 15.4 + (R() - 0.5) * 4, { cast: false });
	}

	// ---------------------------------------------------------------- sun loungers looking out over the pool (east wing)
	{
		const frame = mat("#f4efe6", 0.5), pad = mat("#2a9d8f", 0.9);
		for (let i = 0; i < 4; i++) {
			const x = 25.0 + i * 2.1, z = -5.0;
			const l = group(g, x, 0, z, Math.PI);
			add(l, rbox(0.7, 0.12, 1.9, 0.04), frame, 0, 0.3, 0.1);
			add(l, rbox(0.66, 0.06, 1.2, 0.04), pad, 0, 0.39, 0.4);
			add(l, rbox(0.66, 0.06, 0.75, 0.04), pad, 0, 0.62, -0.6, { rx: 0.6 });
			for (const sx of [-0.3, 0.3]) for (const sz of [-0.75, 0.9]) add(l, new THREE.BoxGeometry(0.05, 0.3, 0.05), frame, sx, 0.15, sz, { cast: false });
			const id = "roofLounger" + i;
			k.spot({ id, x, z: z - 0.1, h: Math.PI, y: 0.15, recline: true });
			k.interact("roof:lounger" + i, { label: "Stretch out on the sun lounger", stand: [x + 0.75, z], sit: [id] }, l);
			k.box(x - 0.38, x + 0.38, z - 1.05, z + 0.85);
		}
		for (const x of [27.1, 31.3]) {
			const u = group(g, x, 0, -6.4);
			add(u, new THREE.CylinderGeometry(0.03, 0.03, 2.4, 8), mat("#e8e2d6", 0.5), 0, 1.2, 0, { cast: false });
			add(u, new THREE.ConeGeometry(1.4, 0.45, 10, 1, true), mat("#f4f1de", 0.8, 0, { side: THREE.DoubleSide }), 0, 2.35, 0);
			add(u, new THREE.CylinderGeometry(0.25, 0.3, 0.12, 16), mat("#2e2a31", 0.6), 0, 0.06, 0);
			k.box(x - 0.2, x + 0.2, -6.6, -6.2);
		}
	}

	// ---------------------------------------------------------------- string lights and bollards round the deck
	{
		const poleM = mat("#2e2a31", 0.45, 0.4);
		const POLES = [[-12.6, 9.6], [-1.5, 9.6], [5.9, 8.6], [24.0, 8.6], [-6.4, -5.2], [5.6, 2.4], [24.3, -1.0], [33.0, -1.0]];
		POLES.forEach(([x, z]) => { add(g, new THREE.CylinderGeometry(0.04, 0.05, 2.9, 8), poleM, x, 1.45, z, { cast: false }); k.box(x - 0.1, x + 0.1, z - 0.1, z + 0.1); });
		const pts = [];
		const strand = (a, b) => { for (let i = 1; i < 18; i++) { const u = i / 18; pts.push([a[0] + (b[0] - a[0]) * u, 2.85 - Math.sin(u * Math.PI) * 0.45, a[1] + (b[1] - a[1]) * u]); } };
		strand(POLES[0], POLES[1]); strand(POLES[1], POLES[2]); strand(POLES[3], [33.0, 8.6]); strand(POLES[4], POLES[5]); strand(POLES[6], POLES[7]);
		const bm = new THREE.InstancedMesh(new THREE.SphereGeometry(0.045, 8, 6), glow("#ffd9a0"), pts.length), d = new THREE.Object3D();
		pts.forEach((p, i) => { d.position.set(...p); d.updateMatrix(); bm.setMatrixAt(i, d.matrix); });
		bm.castShadow = false; bm.instanceMatrix.needsUpdate = true;
		g.add(bm);
		// bollards along the deck's walks
		const bol = [];
		for (let x = -20; x < 33; x += 4.5) for (const z of [-8.0, DECK[3] - 0.4]) if (!(x > NOTCH[0] - 0.5 && x < NOTCH[1] + 0.5 && z < 0)) bol.push([x, z]);
		for (let z = -6; z < DECK[3]; z += 4.5) bol.push([33.0, z]);
		const away = [out(PAV, 0.3), out(WING.gym, 0.5), out(WING.playroom, 0.5)];
		for (let i = bol.length - 1; i >= 0; i--) if (away.some(r => bol[i][0] > r[0] && bol[i][0] < r[1] && bol[i][1] > r[2] && bol[i][1] < r[3])) bol.splice(i, 1);
		const bc = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.06, 0.07, 0.5, 10), poleM, bol.length), bl = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.055, 0.055, 0.08, 10), glow("#fff2d6"), bol.length);
		bol.forEach(([x, z], i) => { d.position.set(x, 0.25, z); d.updateMatrix(); bc.setMatrixAt(i, d.matrix); d.position.set(x, 0.52, z); d.updateMatrix(); bl.setMatrixAt(i, d.matrix); });
		for (const im of [bc, bl]) { im.castShadow = false; im.instanceMatrix.needsUpdate = true; g.add(im); }
		// signs to the rooftop rooms
		// (beside each door, on the promenade side, clear of the way in)
		for (const [d, text, icon] of [[ROOF_PLAN.gymDoor, "Gym", "games"], [ROOF_PLAN.playDoor, "Playroom", "star"]]) {
			const x = d[0] - 0.8, z = WING.gym[2] - 0.75;
			const st = tex.sign(text, icon), sg = group(g, x, 0, z, Math.PI);
			add(sg, new THREE.CylinderGeometry(0.035, 0.05, 1.3, 10), poleM, 0, 0.65, 0);
			add(sg, new THREE.PlaneGeometry(0.9, 0.225), new THREE.MeshStandardMaterial({ map: st, roughness: 0.45, emissive: "#ffffff", emissiveMap: st, emissiveIntensity: 0.35, side: THREE.DoubleSide }), 0, 1.42, 0, { cast: false });
			k.box(x - 0.1, x + 0.1, z - 0.1, z + 0.1);
		}
		// a photo board by the fire bowl: two of the house's photo frames, out under the sky
		const pb = group(g, 0.2, 0, 3.4, Math.PI);
		const oakB = mat("#7a5236", 0.6);
		for (const sx of [-1.35, 1.35]) add(pb, new THREE.BoxGeometry(0.1, 2.0, 0.1), oakB, sx, 1.0, 0);
		add(pb, k.rbox(2.9, 1.3, 0.06, 0.02), oakB, 0, 1.45, 0.02);
		k.photo(92, 0.2 - 0.65, 1.45, 3.4 - 0.06, Math.PI, { w: 1.0, h: 0.75, frame: "#fbf8f2" });
		k.photo(93, 0.2 + 0.65, 1.45, 3.4 - 0.06, Math.PI, { w: 1.0, h: 0.75, frame: "#c9a05a", metal: 0.7 });
		k.box(-1.25, 1.65, 3.3, 3.5);
	}

	function update(dt, t) {
		flames.forEach((f, i) => { const s = 0.75 + Math.sin(t * 9 + f.userData.ph) * 0.2 + Math.sin(t * 15 + i) * 0.1; f.scale.set(1, s, 1); f.position.y = 0.5 + 0.2 * s; });
	}
	return { update };
}
