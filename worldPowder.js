/**
 * Harmony World — the powder room: a guest washroom off the Gallery, between the dining room and the living room
 * (the door in its high-z wall, onto the hall).
 *
 * World coordinates: inside x -11.42..-7.42, z 1.92..8.2, 3.0 m high.
 *   a long marble vanity under a lit mirror along the west wall, a WC behind a frosted screen in the far corner, a
 *   velvet bench by the door, towels, orchids, a scented candle, two photo frames (65, 66)
 */
import { WING, HALL_DOORS, windowsOf } from "./worldEstate.js";

const [X0, X1, Z0, Z1] = WING.powder;
const H = 3.0;
const DOOR = HALL_DOORS.powder;   // (x: in its high-z wall, onto the Gallery)

export function build(k) {
	const { THREE, add, mat, group, rbox, g, tex, ctx } = k;
	k.room({
		x0: X0, x1: X1, z0: Z0, z1: Z1, h: H,
		floor: mat("#ffffff", 0.25, 0.05, { map: tex.tiles("#2e2a31", "#3a3540", "#1d1a20", 1, 1, 3) }),
		ceil: mat("#f6f1ea", 0.95),
		wall: mat("#ffffff", 0.5, 0, { map: tex.wall("#e8dccb", "panel", "rgba(160,130,100,0.10)", 1, 1) }),
		depth: { n: 0.22, s: 0.22, w: 0.2, e: 0.22 },
		holes: [{ wall: "s", a: DOOR[0], b: DOOR[1], y1: 2.2 }].concat(windowsOf(WING.powder))
	});
	k.floor(() => 0);
	k.walk(X0, X1, Z0, Z1);
	k.walk(DOOR[0], DOOR[1], Z1 - 1.0, Z1 + 1.0);
	k.cam = { minX: X0 + 0.15, maxX: X1 - 0.15, minZ: Z0 + 0.15, maxZ: Z1 - 0.15, maxY: H - 0.2 };

	const marble = mat("#ffffff", 0.15, 0.05, { map: tex.tiles("#f3f0ea", "#ebe6de", "#d8d1c6", 1, 1, 1) }), brass = mat("#c9a05a", 0.3, 0.9), oak = mat("#6b4a33", 0.5);
	// the vanity along the west wall, two basins, a lit mirror
	let flame;
	{
		const vz = 4.2, vx = X0 + 0.3;
		const v = group(g, vx, 0, vz, Math.PI / 2);   // (its front faces +x)
		add(v, rbox(2.6, 0.08, 0.55, 0.02), marble, 0, 0.86, 0);
		add(v, rbox(2.5, 0.7, 0.5, 0.02), oak, 0, 0.47, -0.02);
		for (const sx of [-0.6, 0.6]) {
			add(v, new THREE.CylinderGeometry(0.2, 0.15, 0.14, 24), mat("#ffffff", 0.15), sx, 0.97, 0.02, { cast: false });
			add(v, new THREE.CylinderGeometry(0.015, 0.015, 0.22, 8), brass, sx, 1.05, -0.18, { cast: false });
			add(v, new THREE.CylinderGeometry(0.012, 0.012, 0.14, 8), brass, sx, 1.16, -0.12, { rx: Math.PI / 2, cast: false });
		}
		// an orchid and a candle on the counter
		add(v, new THREE.CylinderGeometry(0.06, 0.05, 0.12, 14), mat("#ffffff", 0.3), 0, 0.96, -0.05, { cast: false });
		for (let i = 0; i < 6; i++) add(v, new THREE.SphereGeometry(0.035, 8, 6), mat("#e5a5d0", 0.6), Math.cos(i) * 0.08, 1.2 + i * 0.03, -0.05 + Math.sin(i) * 0.05, { cast: false });
		add(v, new THREE.CylinderGeometry(0.05, 0.05, 0.08, 14), mat("#f4efe6", 0.7), 1.1, 0.94, 0, { cast: false });
		flame = add(v, new THREE.SphereGeometry(0.012, 8, 6), new THREE.MeshBasicMaterial({ color: "#ffcf6b", toneMapped: false }), 1.1, 1.0, 0, { cast: false });
		// the mirror, lit along its top
		const mir = add(g, rbox(0.03, 1.0, 2.3, 0.04), mat("#d8e3ec", 0.04, 1), X0 + 0.02, 1.75, vz, { cast: false });
		add(g, new THREE.BoxGeometry(0.04, 0.04, 2.4), new THREE.MeshBasicMaterial({ color: "#fff2d6", toneMapped: false }), X0 + 0.05, 2.3, vz, { cast: false });
		k.box(X0, X0 + 0.6, vz - 1.3, vz + 1.3);
		k.interact("powder:wash", { label: "Wash your hands", stand: [X0 + 1.05, vz - 0.6], face: -Math.PI / 2, use: () => { ctx.doUpper("wash", 2500); ctx.sfx("water", 0.25); } }, v);
		k.interact("powder:mirror", { label: "Check yourself in the mirror", stand: [X0 + 1.05, vz + 0.6], face: -Math.PI / 2, use: () => { ctx.doUpper("blush", 2500); } }, mir);
		// towels on a ring beside it
		add(g, new THREE.TorusGeometry(0.14, 0.012, 8, 20), brass, X0 + 0.05, 1.3, vz + 1.6, { ry: Math.PI / 2, cast: false });
		add(g, rbox(0.05, 0.42, 0.24, 0.02), mat("#f4efe6", 0.95), X0 + 0.07, 1.12, vz + 1.6, { cast: false });
	}
	// the WC behind a frosted screen in the north-east corner
	{
		const fr = new THREE.MeshPhysicalMaterial({ color: "#eef4f8", transparent: true, opacity: 0.75, roughness: 0.6, side: THREE.DoubleSide });
		const sx = X1 - 1.3;
		add(g, new THREE.BoxGeometry(0.05, 2.1, 1.8), fr, sx, 1.05, Z0 + 0.9);
		add(g, new THREE.BoxGeometry(0.06, 2.1, 0.06), brass, sx, 1.05, Z0 + 1.8, { cast: false });
		const wc = group(g, X1 - 0.65, 0, Z0 + 0.4, 0);
		add(wc, rbox(0.4, 0.42, 0.55, 0.12), mat("#ffffff", 0.2), 0, 0.21, 0.05);
		add(wc, rbox(0.42, 0.06, 0.5, 0.15), mat("#ffffff", 0.2), 0, 0.45, 0.06);
		add(wc, rbox(0.42, 0.5, 0.18, 0.04), mat("#ffffff", 0.2), 0, 0.7, -0.22);
		k.box(sx - 0.05, sx + 0.05, Z0, Z0 + 1.8);
		k.box(X1 - 0.95, X1 - 0.35, Z0, Z0 + 0.75);
		k.interact("powder:flush", { label: "Flush", stand: [X1 - 0.65, Z0 + 1.35], face: Math.PI, use: () => { ctx.sfx("water", 0.5); } }, wc);
	}
	// a velvet bench on the east wall by the door, a plant, photos
	{
		const bz = 5.4;
		const b = group(g, X1 - 0.3, 0, bz, -Math.PI / 2);
		add(b, rbox(1.2, 0.4, 0.42, 0.08), mat("#7a3b4f", 0.85), 0, 0.22, 0);
		for (const sx of [-0.5, 0.5]) add(b, new THREE.CylinderGeometry(0.025, 0.02, 0.1, 8), brass, sx, 0.05, 0, { cast: false });
		k.spot({ id: "powderBench0", x: X1 - 0.35, z: bz - 0.3, h: -Math.PI / 2, y: -0.04 });
		k.spot({ id: "powderBench1", x: X1 - 0.35, z: bz + 0.3, h: -Math.PI / 2, y: -0.04 });
		k.interact("powder:bench", { label: "Sit on the bench", stand: [X1 - 1.05, bz], sit: ["powderBench0", "powderBench1"] }, b);
		k.box(X1 - 0.55, X1, bz - 0.65, bz + 0.65);
		const p = group(g, X0 + 0.4, 0, Z1 - 0.4);
		add(p, new THREE.CylinderGeometry(0.2, 0.16, 0.5, 16), mat("#d8cfc4", 0.6), 0, 0.25, 0);
		for (let i = 0; i < 10; i++) add(p, new THREE.SphereGeometry(0.15, 10, 8), mat(i % 2 ? "#4f8a57" : "#3f7a48", 0.7), Math.cos(i * 2.4) * 0.13, 0.65 + (i % 4) * 0.18, Math.sin(i * 2.4) * 0.13, { cast: false });
		k.box(X0, X0 + 0.65, Z1 - 0.65, Z1);
		k.photo(65, X1 - 0.03, 1.7, bz, -Math.PI / 2, { w: 0.8, h: 0.6, frame: "#c9a05a", metal: 0.7 });
		k.photo(66, X0 + 1.9, 1.75, Z0 + 0.03, 0, { w: 0.6, h: 0.75, frame: "#fbf8f2" });
		const st = tex.sign("Gallery", "home");
		add(g, new THREE.PlaneGeometry(0.9, 0.225), new THREE.MeshStandardMaterial({ map: st, roughness: 0.45, emissive: "#ffffff", emissiveMap: st, emissiveIntensity: 0.3 }), (DOOR[0] + DOOR[1]) / 2, 2.5, Z1 - 0.04, { ry: Math.PI, cast: false });
	}
	k.lightSwitch(DOOR[1] + 0.35, 1.25, Z1 - 0.02, Math.PI);
	k.light(X0 + 1.2, 2.4, 4.2, "#fff0dc", 3, 6);
	k.light(X1 - 0.8, 2.4, Z0 + 0.9, "#fff0dc", 1.6, 4);
	k.light((X0 + X1) / 2, 2.4, 6.6, "#fff0dc", 2, 5);
	const cx = (X0 + X1) / 2, cz = (Z0 + Z1) / 2;
	k.key.pos.copy(k.V(cx, H - 0.15, cz)); k.key.target.copy(k.V(cx, 0, cz));
	k.key.angle = 1.2; k.key.intensity = 8; k.key.distance = 9; k.key.color.set("#fff0dc");
	k.fill.pos.copy(k.V(cx, 2.2, cz)); k.fill.intensity = 2.5; k.fill.distance = 10;
	k.hemi = 0.45; k.env = 0.3; k.exposure = 1.05;
	function update(dt, t) { flame.scale.set(1, 1.5 + Math.sin(t * 11) * 0.2, 1); }
	return { update };
}
