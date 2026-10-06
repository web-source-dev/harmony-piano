/**
 * Harmony World — the dining room: behind the cinema, off the Gallery (the door in its north wall).
 *
 * World coordinates: inside x -22.25..-7.42, z 1.92..8.2, 3.4 m high. Two windows in the west wall look out over the lawn.
 *   a long table for ten under two chandeliers, candles and place settings; every chair is a seat
 *   a sideboard with a mirror, a bar cart, plants, photo frames 62..64 on dark green panelled walls
 *   (serve dinner from the sideboard, mix a drink at the bar cart, light or blow out the candles)
 */
import { WING, HALL_DOORS, windowsOf } from "./worldEstate.js";

const [X0, X1, Z0, Z1] = WING.dining;
const H = 3.4;
const DOOR = HALL_DOORS.dining;                      // (x: in its high-z wall, onto the Gallery)
const T = { x: -14.8, z: (Z0 + Z1) / 2, len: 6.4, w: 1.25 };   // the table

export function build(k) {
	const { THREE, add, mat, group, rbox, g, tex, rng, ctx } = k;
	const R = rng(919);
	k.room({
		x0: X0, x1: X1, z0: Z0, z1: Z1, h: H,
		floor: mat("#ffffff", 0.5, 0, { map: tex.wood(["#7a4e30", "#86583a", "#6e452b", "#8c5e3e"], 1, 1, 71) }),
		ceil: mat("#f3ece2", 0.95),
		wall: mat("#ffffff", 0.9, 0, { map: tex.wall("#35503f", "panel", "rgba(255,240,200,0.10)", 1, 1) }),
		depth: { n: 0.22, s: 0.22, w: 0.3, e: 0.22 },
		holes: [{ wall: "s", a: DOOR[0], b: DOOR[1], y1: 2.4 }].concat(windowsOf(WING.dining))
	});
	k.floor(() => 0);
	k.walk(X0, X1, Z0, Z1);
	k.walk(DOOR[0], DOOR[1], Z1 - 1.0, Z1 + 1.0);
	k.cam = { minX: X0 + 0.2, maxX: X1 - 0.2, minZ: Z0 + 0.2, maxZ: Z1 - 0.2, maxY: H - 0.25 };

	// ---------------------------------------------------------------- the table and its ten chairs
	const wood = mat("#4a2f22", 0.45), linen = mat("#f6f1e8", 0.9), velvet = mat("#a8475c", 0.85), brass = mat("#c9a05a", 0.3, 0.9);
	const tbl = group(g, T.x, 0, T.z);
	add(tbl, rbox(T.len, 0.07, T.w, 0.02), wood, 0, 0.76, 0);
	for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(tbl, new THREE.BoxGeometry(0.09, 0.73, 0.09), wood, sx * (T.len / 2 - 0.3), 0.365, sz * (T.w / 2 - 0.15));
	add(tbl, new THREE.PlaneGeometry(T.len - 0.6, 0.45), mat("#c9a05a", 0.6), 0, 0.797, 0, { rx: -Math.PI / 2, cast: false });   // a runner
	const flames = [];
	for (const cx of [-1.9, 0, 1.9]) {
		const cb = group(tbl, cx, 0.8, 0);
		add(cb, new THREE.CylinderGeometry(0.1, 0.12, 0.03, 16), brass, 0, 0.015, 0, { cast: false });
		add(cb, new THREE.CylinderGeometry(0.015, 0.02, 0.32, 8), brass, 0, 0.17, 0, { cast: false });
		for (const sx of [-0.14, 0, 0.14]) {
			add(cb, new THREE.CylinderGeometry(0.018, 0.018, 0.16, 8), mat("#fbf6ea", 0.7), sx, 0.38, 0, { cast: false });
			flames.push(add(cb, new THREE.SphereGeometry(0.014, 8, 6), new THREE.MeshBasicMaterial({ color: "#ffcf6b", toneMapped: false }), sx, 0.475, 0, { cast: false }));
		}
		if (cx) add(cb, new THREE.SphereGeometry(0.06, 10, 8), mat(cx < 0 ? "#ff8fab" : "#ffd166", 0.6), 0, 0.06, 0.25, { cast: false });
	}
	k.box(T.x - T.len / 2, T.x + T.len / 2, T.z - T.w / 2, T.z + T.w / 2);
	// the candles: light them or blow them out (shared)
	const candlesOn = () => ctx.get("z:dining:candles") !== false;
	k.interact("dining:candles", { label: () => candlesOn() ? "Blow out the candles" : "Light the candles", stand: [T.x, T.z - T.w / 2 - 0.75], reach: 2.4, face: 0, use: () => { ctx.setShared("z:dining:candles", !candlesOn()); ctx.sfx("whoosh", 0.25); } }, tbl);
	const seats = [];
	for (let i = 0; i < 4; i++) for (const side of [-1, 1]) seats.push([T.x - 2.4 + i * 1.6, T.z + side * (T.w / 2 + 0.42), side > 0 ? Math.PI : 0]);
	seats.push([T.x - T.len / 2 - 0.45, T.z, Math.PI / 2], [T.x + T.len / 2 + 0.45, T.z, -Math.PI / 2]);
	seats.forEach(([x, z, h], i) => {
		const c = group(g, x, 0, z, h);
		add(c, rbox(0.5, 0.08, 0.48, 0.03), velvet, 0, 0.47, 0);
		add(c, rbox(0.5, 0.62, 0.07, 0.03), velvet, 0, 0.82, -0.22, { rx: -0.08 });
		for (const sx of [-0.21, 0.21]) for (const sz of [-0.2, 0.2]) add(c, new THREE.BoxGeometry(0.04, 0.46, 0.04), wood, sx, 0.23, sz, { cast: false });
		// a place setting in front of each chair
		const fw = Math.sin(h), fz = Math.cos(h);
		add(g, new THREE.CylinderGeometry(0.14, 0.12, 0.015, 24), linen, x + fw * 0.5, 0.805, z + fz * 0.5, { cast: false });
		add(g, new THREE.CylinderGeometry(0.035, 0.02, 0.09, 12), new THREE.MeshPhysicalMaterial({ color: "#ffffff", transparent: true, opacity: 0.3, roughness: 0.05, depthWrite: false }), x + fw * 0.5 + fz * 0.2, 0.86, z + fz * 0.5 - fw * 0.2, { cast: false });
		const id = "diningSeat" + i;
		k.spot({ id, x: x + fw * 0.02, z: z + fz * 0.02, h, y: 0.0 });
		k.interact("dining:chair" + i, { label: "Sit at the dining table", stand: [x - fw * 0.7, z - fz * 0.7], sit: [id] }, c);
		// (solid: you walk round the chairs, not through them)
		const r = 0.24;
		k.box(x - r, x + r, z - r, z + r);
	});

	// ---------------------------------------------------------------- two chandeliers
	const glowM = new THREE.MeshBasicMaterial({ color: "#fff2d6", toneMapped: false });
	for (const cx of [T.x - 1.6, T.x + 1.6]) {
		const cg = group(g, cx, H, T.z);
		add(cg, new THREE.CylinderGeometry(0.01, 0.01, 0.7, 6), brass, 0, -0.35, 0, { cast: false });
		add(cg, new THREE.TorusGeometry(0.42, 0.02, 8, 36), brass, 0, -0.78, 0, { rx: Math.PI / 2, cast: false });
		for (let i = 0; i < 8; i++) {
			const a = i / 8 * Math.PI * 2;
			add(cg, new THREE.CylinderGeometry(0.018, 0.018, 0.12, 8), mat("#fbf6ea", 0.7), Math.cos(a) * 0.42, -0.72, Math.sin(a) * 0.42, { cast: false });
			add(cg, new THREE.SphereGeometry(0.03, 8, 6), glowM, Math.cos(a) * 0.42, -0.64, Math.sin(a) * 0.42, { cast: false });
		}
	}

	// ---------------------------------------------------------------- the sideboard with a mirror, a bar cart, plants, art
	{
		const sb = group(g, T.x, 0, Z0 + 0.3, 0);
		add(sb, rbox(2.6, 0.85, 0.5, 0.02), wood, 0, 0.425, 0);
		for (let i = 0; i < 4; i++) add(sb, rbox(0.6, 0.6, 0.02, 0.01), mat("#5a3a2a", 0.45), -0.96 + i * 0.64, 0.45, 0.255);
		add(sb, new THREE.CylinderGeometry(0.11, 0.08, 0.3, 16), mat("#2a9d8f", 0.3), 0.8, 1.0, 0, { cast: false });
		for (let i = 0; i < 6; i++) add(sb, new THREE.SphereGeometry(0.07, 8, 6), mat(["#ffd166", "#ff8fab", "#ffffff"][i % 3], 0.7), 0.8 + Math.cos(i) * 0.08, 1.2 + (i % 3) * 0.06, Math.sin(i) * 0.08, { cast: false });
		for (const [x, c] of [[-0.6, "#7a1d33"], [-0.45, "#2b4c2b"], [-0.3, "#c9a05a"]]) add(sb, new THREE.CylinderGeometry(0.035, 0.035, 0.3, 12), mat(c, 0.2, 0.1), x, 1.0, 0, { cast: false });
		const mir = group(g, T.x, 1.85, Z0 + 0.03, 0);
		add(mir, rbox(1.9, 1.0, 0.04, 0.02), brass, 0, 0, 0, { cast: false });
		add(mir, new THREE.PlaneGeometry(1.78, 0.88), mat("#cfd8e3", 0.05, 1), 0, 0, 0.022, { cast: false });
		k.box(T.x - 1.35, T.x + 1.35, Z0, Z0 + 0.58);
		k.interact("dining:serve", { label: "Serve dinner from the sideboard", stand: [T.x + 0.6, Z0 + 1.15], face: Math.PI, use: () => ctx.foodMenu("On the sideboard", ["sandwich", "cake", "strawberry", "apple", "juice", "cookie"]) }, sb);
		// a bar cart in the corner
		const bc = group(g, X0 + 0.7, 0, Z1 - 0.7, Math.PI / 4);
		for (const y of [0.25, 0.75]) add(bc, rbox(0.8, 0.03, 0.45, 0.01), mat("#d8cfc4", 0.3, 0.2), 0, y, 0);
		for (const sx of [-0.38, 0.38]) for (const sz of [-0.2, 0.2]) add(bc, new THREE.CylinderGeometry(0.012, 0.012, 0.8, 6), brass, sx, 0.4, sz, { cast: false });
		for (let i = 0; i < 5; i++) add(bc, new THREE.CylinderGeometry(0.035, 0.035, 0.26 + R() * 0.08, 10), mat(["#7a1d33", "#e9c46a", "#2a9d8f", "#264653", "#f4a261"][i], 0.15, 0.1), -0.28 + i * 0.14, 0.92, 0, { cast: false });
		k.box(X0, X0 + 1.2, Z1 - 1.2, Z1);
		k.interact("dining:bar", { label: "Mix a drink at the bar cart", stand: [X0 + 1.55, Z1 - 1.55], use: () => { ctx.doUpper("drink", 3000); ctx.sfx("pop", 0.3); } }, bc);
		// tall plants by the windows and in the far corner
		for (const [x, z] of [[X0 + 0.5, Z0 + 0.5], [X1 - 0.5, Z0 + 0.5]]) {
			const p = group(g, x, 0, z);
			add(p, new THREE.CylinderGeometry(0.26, 0.2, 0.5, 18), mat("#c86b4a", 0.7), 0, 0.25, 0);
			for (let i = 0; i < 12; i++) { const a = i * 2.4; add(p, new THREE.SphereGeometry(0.2, 10, 8), mat(i % 2 ? "#4f8a57" : "#3f7a48", 0.7), Math.cos(a) * 0.18, 0.75 + (i % 4) * 0.28, Math.sin(a) * 0.18, { cast: false }); }
			k.box(x - 0.3, x + 0.3, z - 0.3, z + 0.3);
		}
		// photo frames either side of the mirror and on the east wall (your own photos)
		[[62, -19.5, Z0 + 0.03, 0], [63, -10.1, Z0 + 0.03, 0], [64, X1 - 0.03, 5.0, -Math.PI / 2]].forEach(([slot, x, z, ry]) => k.photo(slot, x, 1.85, z, ry, { w: 1.2, h: 0.85, frame: "#c9a05a", metal: 0.7 }));
		// a rug under the table
		const rug = add(g, new THREE.PlaneGeometry(T.len + 1.6, T.w + 2.2), mat("#ffffff", 1, 0, { map: tex.carpet("#6b2d3c", "#e8c27a") }), T.x, 0.006, T.z, { rx: -Math.PI / 2, cast: false });
		rug.userData.floor = true;
		const st = tex.sign("Gallery", "home");
		add(g, new THREE.PlaneGeometry(0.9, 0.225), new THREE.MeshStandardMaterial({ map: st, roughness: 0.45, emissive: "#ffffff", emissiveMap: st, emissiveIntensity: 0.3 }), (DOOR[0] + DOOR[1]) / 2, 2.7, Z1 - 0.04, { ry: Math.PI, cast: false });
	}
	k.lightSwitch(DOOR[1] + 0.6, 1.25, Z1 - 0.02, Math.PI);

	// ---------------------------------------------------------------- light
	k.light(T.x - 1.6, 2.5, T.z, "#ffd9a0", 4.5, 8);
	k.light(T.x + 1.6, 2.5, T.z, "#ffd9a0", 4.5, 8);
	const candleL = k.light(T.x, 1.3, T.z, "#ffb45e", 1.6, 4);    // the candles
	k.light(X0 + 1.5, 2.4, 5.6, "#ffe6c8", 2, 7);
	k.light(X1 - 1.5, 2.4, 5.6, "#ffe6c8", 2, 7);
	k.key.pos.copy(k.V(T.x, H - 0.15, T.z)); k.key.target.copy(k.V(T.x, 0, T.z));
	k.key.angle = 1.2; k.key.intensity = 16; k.key.distance = 14; k.key.color.set("#ffe0b8");
	k.fill.pos.copy(k.V(T.x, 2.6, T.z)); k.fill.intensity = 4; k.fill.distance = 16;
	k.hemi = 0.4; k.env = 0.26; k.exposure = 1.05;

	function update(dt, t) {
		const on = candlesOn();
		flames.forEach((f, i) => { const s = 0.85 + Math.sin(t * 11 + i * 1.7) * 0.12; f.visible = on; f.scale.set(1, 1.5 * s, 1); });
		candleL.intensity = on ? candleL.base : 0;
	}
	return { update };
}
