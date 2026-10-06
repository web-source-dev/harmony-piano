/**
 * Harmony World — the walk-in wardrobe: a narrow room off the bedroom (the door in its north wall, by the dresser),
 * between the bathroom and the house's east wall.
 *
 * World coordinates: inside x 31.82..33.4, z 0.92..8.4, 3.0 m high. A small window in the east wall.
 *   rails of clothes along the east wall either side of the window, shoes on shelves, hat boxes up top, a long mirror
 *   at the end, a soft rug, a pendant light, two photo frames (83, 84)
 *   (pick out an outfit at the rails: it opens your look; twirl in the mirror)
 */
import { WING, windowsOf } from "./worldEstate.js";

const [X0, X1, Z0, Z1] = WING.closet;
const H = 3.0;
const DOOR = [31.85, 32.75];

export function build(k) {
	const { THREE, add, mat, group, rbox, g, tex, rng, ctx } = k;
	const R = rng(3131);
	k.room({
		x0: X0, x1: X1, z0: Z0, z1: Z1, h: H,
		floor: mat("#ffffff", 0.55, 0, { map: tex.wood(["#b08968", "#a47c5b", "#bc9474", "#9c7556"], 1, 1, 33) }),
		ceil: mat("#f6f1ea", 0.95),
		wall: mat("#ffffff", 0.9, 0, { map: tex.wall("#f3e9e2", "stripes", "rgba(214,160,170,0.12)", 1, 1) }),
		depth: { n: 0.22, s: 0.22, w: 0.22, e: 0.3 },
		holes: [{ wall: "n", a: DOOR[0], b: DOOR[1], y1: 2.2 }].concat(windowsOf(WING.closet))
	});
	k.floor(() => 0);
	k.walk(X0, X1, Z0, Z1);
	k.walk(DOOR[0], DOOR[1], Z0 - 1.0, Z0 + 1.0);
	k.cam = { minX: X0 + 0.1, maxX: X1 - 0.1, minZ: Z0 + 0.15, maxZ: Z1 - 0.15, maxY: H - 0.2 };

	const brass = mat("#c9a05a", 0.3, 0.9), shelfM = mat("#fbf8f2", 0.6);
	const CLOTH = ["#e63946", "#f1faee", "#a8dadc", "#457b9d", "#1d3557", "#ffb4a2", "#e5989b", "#6d6875", "#2a9d8f", "#e9c46a", "#264653", "#f4a261"];
	// rails of hanging clothes along the east wall, either side of the window
	const hung = [];
	const rail = (z0, z1) => {
		add(g, new THREE.CylinderGeometry(0.015, 0.015, z1 - z0, 8), brass, X1 - 0.3, 1.75, (z0 + z1) / 2, { rx: Math.PI / 2, cast: false });
		add(g, rbox(0.45, 0.03, z1 - z0, 0.01), shelfM, X1 - 0.25, 2.05, (z0 + z1) / 2, { cast: false });
		for (let z = z0 + 0.08; z < z1 - 0.05; z += 0.07 + R() * 0.04) hung.push([X1 - 0.3, z, 0.55 + R() * 0.55, CLOTH[Math.floor(R() * CLOTH.length)]]);
		// hat boxes on the shelf
		for (let z = z0 + 0.25; z < z1 - 0.2; z += 0.55) add(g, new THREE.CylinderGeometry(0.17, 0.17, 0.22, 18), mat(CLOTH[Math.floor(R() * CLOTH.length)], 0.7), X1 - 0.25, 2.18, z, { cast: false });
		k.box(X1 - 0.55, X1, z0, z1);
	};
	rail(Z0 + 0.3, 3.75);
	rail(5.45, Z1 - 2.0);
	{
		const d = new THREE.Object3D(), col = new THREE.Color();
		const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat("#ffffff", 0.9), hung.length);
		hung.forEach(([x, z, len, c], i) => { d.position.set(x, 1.72 - len / 2, z); d.rotation.set(0, (R() - 0.5) * 0.15, 0); d.scale.set(0.42, len, 0.05); d.updateMatrix(); im.setMatrixAt(i, d.matrix); im.setColorAt(i, col.set(c)); });
		im.castShadow = false; im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true;
		g.add(im);
		k.interact("closet:clothes", { label: "Pick out an outfit", nearest: true, stands: [[X0 + 0.55, 2.4], [X0 + 0.55, 6.2]], face: Math.PI / 2, use: () => { ctx.sfx("whoosh", 0.3); ctx.showLook(); } }, im);
	}
	k.photo(83, X0 + 0.03, 1.7, 2.6, Math.PI / 2, { w: 0.5, h: 0.65, frame: "#c9a05a", metal: 0.7 });
	k.photo(84, X0 + 0.03, 1.7, 5.6, Math.PI / 2, { w: 0.5, h: 0.65, frame: "#fbf8f2" });
	// shoes on low shelves under the window
	{
		const sh = group(g, X1 - 0.22, 0, 4.6, -Math.PI / 2);
		for (const y of [0.18, 0.5]) add(sh, rbox(1.4, 0.03, 0.36, 0.01), shelfM, 0, y, 0);
		for (const sx of [-0.7, 0.7]) add(sh, new THREE.BoxGeometry(0.03, 0.65, 0.36), shelfM, sx, 0.33, 0);
		for (let i = 0; i < 10; i++) {
			const c = CLOTH[Math.floor(R() * CLOTH.length)];
			add(sh, rbox(0.11, 0.09, 0.26, 0.03), mat(c, 0.5), -0.58 + (i % 5) * 0.29, (i < 5 ? 0.18 : 0.5) + 0.06, 0, { cast: false });
		}
		k.box(X1 - 0.42, X1, 3.85, 5.35);
	}
	// a long mirror at the end, a stool, a rug
	{
		const mr = group(g, (X0 + X1) / 2 - 0.1, 0.25, Z1 - 0.04, Math.PI);
		add(mr, rbox(0.75, 1.9, 0.05, 0.02), brass, 0, 0.95, 0, { cast: false });
		add(mr, new THREE.PlaneGeometry(0.65, 1.8), mat("#d8e3ec", 0.04, 1), 0, 0.95, 0.027, { cast: false });
		k.box(X0 + 0.2, X1 - 0.2, Z1 - 0.12, Z1);
		k.interact("closet:mirror", { label: "Twirl in front of the mirror", stand: [(X0 + X1) / 2 + 0.3, Z1 - 0.75], face: 0, use: () => ctx.doUpper("dance", 3000) }, mr);
		const st = group(g, X0 + 0.4, 0, Z1 - 1.0);
		add(st, new THREE.CylinderGeometry(0.22, 0.2, 0.42, 20), mat("#ffc8d6", 0.9), 0, 0.21, 0);
		k.spot({ id: "closetStool", x: X0 + 0.4, z: Z1 - 1.0, h: Math.PI / 2, y: -0.04 });
		k.interact("closet:stool", { label: "Sit and try on shoes", stand: [X0 + 0.55, Z1 - 1.6], sit: ["closetStool"] }, st);
		k.box(X0, X0 + 0.65, Z1 - 1.25, Z1 - 0.75);
		const rug = add(g, new THREE.PlaneGeometry(1.0, 5.2), mat("#ffffff", 1, 0, { map: tex.runner("#d9a5b3", "#ffffff") }), (X0 + X1) / 2 - 0.15, 0.006, (Z0 + Z1) / 2, { rx: -Math.PI / 2, cast: false });
		rug.userData.floor = true;
	}
	// a pendant light
	{
		const pl = group(g, (X0 + X1) / 2, H, (Z0 + Z1) / 2);
		add(pl, new THREE.CylinderGeometry(0.008, 0.008, 0.6, 6), brass, 0, -0.3, 0, { cast: false });
		add(pl, new THREE.SphereGeometry(0.16, 18, 12), new THREE.MeshStandardMaterial({ color: "#fff4dc", emissive: "#ffcf8a", emissiveIntensity: 1.5 }), 0, -0.72, 0, { cast: false });
	}
	k.light((X0 + X1) / 2, 2.2, (Z0 + Z1) / 2, "#ffe6c8", 3, 7);
	k.light((X0 + X1) / 2, 2.2, Z1 - 1.2, "#ffe6c8", 1.6, 4);
	k.key.pos.copy(k.V((X0 + X1) / 2, H - 0.15, (Z0 + Z1) / 2)); k.key.target.copy(k.V((X0 + X1) / 2, 0, (Z0 + Z1) / 2));
	k.key.angle = 1.2; k.key.intensity = 8; k.key.distance = 9; k.key.color.set("#ffe6cc");
	k.fill.pos.copy(k.V((X0 + X1) / 2, 2.2, (Z0 + Z1) / 2)); k.fill.intensity = 2.5; k.fill.distance = 9;
	k.hemi = 0.45; k.env = 0.3; k.exposure = 1.05;
	return {};
}
