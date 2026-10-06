/**
 * Harmony World — the gym: a big pavilion up on the roof deck (over the spa and the music room), its door in the
 * middle of its south side (the low-z wall), onto the wide promenade in front of the lounge's upper storey.
 *
 * Drawn coordinates (on the floor plan it sits with the roof, ROOF_FP away; its zone's origin is that offset, so these
 * are where it's drawn): inside WING.gym, x 21.8..33.0, z 14.0..24.0, from the deck up 3.2 m. Windows on every side.
 *   east:   three treadmills and an exercise bike facing the east windows (belts and wheel turn while someone's on them)
 *   north:  a rowing machine under three photo frames, a water cooler, a bench to rest on
 *   middle: a weight bench with a barbell, a punching bag that swings when you hit it
 *   west:   a mirror wall with two yoga mats in front of it, a swiss ball, a rack of dumbbells by the door
 * The way in (DOOR, x 26.4..28.4) is kept clear, and every machine has a walkway of at least 1.2 m round it.
 * Shared keys: z:gym:punch (when the bag was last hit).
 */
import { WING, ROOF_PLAN } from "./worldEstate.js";

const [X0, X1, Z0, Z1] = WING.gym;
const H = 3.2;
const DOOR = [ROOF_PLAN.gymDoor[0], ROOF_PLAN.gymDoor[1]];   // (x: in the south wall, z = Z0)
const DM = (DOOR[0] + DOOR[1]) / 2;

export function build(k) {
	const { THREE, add, mat, group, rbox, g, ctx, tex, canvasTex, rng } = k;
	const R = rng(5353);
	const rubber = canvasTex(256, 256, (c, w, h) => {
		c.fillStyle = "#2b2d33"; c.fillRect(0, 0, w, h);
		for (let i = 0; i < 4000; i++) { c.fillStyle = ["rgba(255,255,255,0.10)", "rgba(76,201,240,0.25)", "rgba(255,209,102,0.2)"][i % 3]; c.fillRect(R() * w, R() * h, 2, 2); }
		c.fillStyle = "rgba(0,0,0,0.35)"; c.fillRect(0, 0, w, 2); c.fillRect(0, 0, 2, h);
	});
	k.room({
		x0: X0, x1: X1, z0: Z0, z1: Z1, h: H,
		floor: mat("#ffffff", 0.9, 0, { map: rubber }),
		ceil: mat("#f4f4f2", 0.95),
		wall: mat("#ffffff", 0.9, 0, { map: tex.wall("#eef0f2", "stripes", "rgba(76,201,240,0.06)", 1, 1) }),
		trim: mat("#4cc9f0", 0.6),
		exterior: mat("#ffffff", 0.88, 0, { map: k.renderTex(1, 1) }), roofM: mat("#57525c", 0.9),
		depth: { n: 0.25, s: 0.25, w: 0.25, e: 0.25 },
		holes: [
			{ wall: "n", a: DOOR[0], b: DOOR[1], y1: 2.4 },
			{ wall: "n", a: X0 + 0.6, b: X0 + 3.8, y0: 1.0, y1: 2.7, glass: true },
			{ wall: "n", a: DOOR[1] + 0.8, b: X1 - 0.6, y0: 1.0, y1: 2.7, glass: true },
			{ wall: "e", a: Z0 + 1.0, b: Z1 - 0.8, y0: 0.35, y1: 2.8, glass: true },
			{ wall: "w", a: Z0 + 0.6, b: Z0 + 3.4, y0: 0.9, y1: 2.7, glass: true },
			{ wall: "s", a: X0 + 0.6, b: X0 + 3.8, y0: 0.9, y1: 2.7, glass: true }
		]
	});
	k.floor(() => 0);
	k.walk(X0, X1, Z0, Z1);
	k.walk(DOOR[0], DOOR[1], Z0 - 1.3, Z0 + 1.0);
	k.cam = { minX: X0 + 0.2, maxX: X1 - 0.2, minZ: Z0 + 0.2, maxZ: Z1 - 0.2, maxY: H - 0.25 };
	k.frenchDoor("gymDoor", { x: DM, z: Z0 - 0.125, ry: Math.PI, w: DOOR[1] - DOOR[0] - 0.04, h: 2.4, depth: 0.4, side: -1, curtain: "#4cc9f0" }, [DOOR[0], DOOR[1], Z0 - 0.25, Z0], [[DM, Z0 + 0.9], [DM, Z0 - 1.0]]);

	const dark = mat("#26282e", 0.5, 0.4), steel = mat("#c9ced6", 0.25, 0.9), accent = mat("#4cc9f0", 0.4, 0.2), pad = mat("#1d1f24", 0.8);
	const use = (u, ms, sfx) => () => { ctx.doUpper(u, ms); if (sfx) ctx.sfx(sfx, 0.35); };

	// ---------------------------------------------------------------- treadmills and a bike, facing the east windows
	const belts = [], wheel = [];
	const MX = X1 - 1.3;
	const machine = (z, kind, i) => {
		const m = group(g, MX, 0, z, Math.PI / 2);
		if (kind === "tread") {
			add(m, rbox(0.8, 0.16, 1.9, 0.04), dark, 0, 0.12, -0.1);
			const belt = add(m, new THREE.PlaneGeometry(0.56, 1.6), mat("#ffffff", 0.7, 0, { map: canvasTex(64, 256, (c, w, h) => { c.fillStyle = "#18191d"; c.fillRect(0, 0, w, h); c.fillStyle = "#2c2e34"; for (let y = 0; y < h; y += 16) c.fillRect(0, y, w, 4); }) }), 0, 0.205, -0.1, { rx: -Math.PI / 2, cast: false });
			belt.material.map.wrapT = THREE.RepeatWrapping;
			belts.push(belt);
			for (const sx of [-0.33, 0.33]) add(m, new THREE.BoxGeometry(0.05, 1.15, 0.05), dark, sx, 0.68, 0.72, { rx: -0.2 });
			add(m, rbox(0.75, 0.35, 0.1, 0.03), dark, 0, 1.25, 0.82, { rx: -0.5 });
			add(m, new THREE.PlaneGeometry(0.5, 0.22), new THREE.MeshBasicMaterial({ color: "#4cc9f0", toneMapped: false }), 0, 1.27, 0.76, { rx: -0.5 + Math.PI, cast: false });
			for (const sx of [-0.33, 0.33]) add(m, new THREE.CylinderGeometry(0.02, 0.02, 0.5, 8), steel, sx, 1.05, 0.5, { rx: Math.PI / 2, cast: false });
			k.box(MX - 1.05, MX + 0.95, z - 0.45, z + 0.45);
			const id = "gymTread" + i;
			k.spot({ id, x: MX - 0.15, z, h: Math.PI / 2, y: 0.2, ridePose: () => "walk" });   // (walking on the spot)
			k.interact("gym:tread" + i, { label: "Walk on the treadmill", stand: [MX - 1.4, z], sit: [id] }, m);
			return id;
		}
		add(m, rbox(0.3, 0.08, 1.1, 0.03), dark, 0, 0.05, 0);
		add(m, new THREE.CylinderGeometry(0.05, 0.05, 0.75, 10), dark, 0, 0.45, -0.25, { rx: 0.25 });
		add(m, rbox(0.26, 0.08, 0.34, 0.03), pad, 0, 0.86, -0.32);
		add(m, new THREE.CylinderGeometry(0.04, 0.04, 0.85, 10), dark, 0, 0.5, 0.3, { rx: -0.3 });
		add(m, new THREE.CylinderGeometry(0.015, 0.015, 0.5, 8), steel, 0, 0.98, 0.42, { rz: Math.PI / 2, cast: false });
		const w = group(m, 0, 0.35, 0.18);
		add(w, new THREE.CylinderGeometry(0.24, 0.24, 0.06, 24), accent, 0, 0, 0, { rz: Math.PI / 2 });
		add(w, new THREE.BoxGeometry(0.07, 0.3, 0.03), steel, 0, 0, 0, { cast: false });
		wheel.push(w);
		k.box(MX - 0.6, MX + 0.6, z - 0.3, z + 0.3);
		k.spot({ id: "gymBike", x: MX - 0.32, z, h: Math.PI / 2, y: 0.38 });
		k.interact("gym:bike", { label: "Ride the exercise bike", stand: [MX - 1.2, z], sit: ["gymBike"] }, m);
		return "gymBike";
	};
	const ids = [machine(Z0 + 2.4, "tread", 0), machine(Z0 + 4.0, "tread", 1), machine(Z0 + 5.6, "tread", 2), machine(Z0 + 7.3, "bike", 0)];

	// ---------------------------------------------------------------- a rowing machine along the north wall
	{
		const rx = 29.0, rz = Z1 - 0.8;
		const rw = group(g, rx, 0, rz, -Math.PI / 2);   // (its local +z points west: the seat end; the flywheel is at the east end)
		add(rw, rbox(0.22, 0.08, 2.2, 0.03), dark, 0, 0.2, 0);
		for (const sz of [-1.0, 1.0]) add(rw, rbox(0.5, 0.2, 0.08, 0.03), dark, 0, 0.1, sz);
		add(rw, new THREE.CylinderGeometry(0.28, 0.28, 0.16, 24), accent, 0, 0.42, -0.95, { rz: Math.PI / 2 });
		add(rw, rbox(0.32, 0.06, 0.3, 0.03), pad, 0, 0.3, 0.35);
		for (const sx of [-0.14, 0.14]) add(rw, rbox(0.1, 0.04, 0.24, 0.02), pad, sx, 0.26, -0.55, { rx: 0.5, cast: false });
		add(rw, new THREE.CylinderGeometry(0.015, 0.015, 0.5, 8), steel, 0, 0.55, -0.7, { rz: Math.PI / 2, cast: false });
		k.box(rx - 1.15, rx + 1.15, rz - 0.3, rz + 0.3);
		k.spot({ id: "gymRow", x: rx - 0.35, z: rz, h: Math.PI / 2, y: -0.16, low: true });   // (facing the flywheel)
		k.interact("gym:row", { label: "Row the rowing machine", stand: [rx - 0.35, rz - 0.85], sit: ["gymRow"] }, rw);
	}

	// ---------------------------------------------------------------- a weight bench with a barbell (middle)
	{
		const bx = 26.2, bz = 20.0;
		const wb = group(g, bx, 0, bz, 0);
		add(wb, rbox(0.3, 0.1, 1.2, 0.04), pad, 0, 0.45, 0);
		for (const sz of [-0.45, 0.45]) add(wb, new THREE.BoxGeometry(0.06, 0.42, 0.06), dark, 0, 0.21, sz);
		for (const sx of [-0.45, 0.45]) add(wb, new THREE.BoxGeometry(0.05, 1.1, 0.05), dark, sx, 0.55, -0.62);
		add(wb, new THREE.CylinderGeometry(0.015, 0.015, 1.7, 8), steel, 0, 1.05, -0.62, { rz: Math.PI / 2, cast: false });
		for (const sx of [-0.7, 0.7]) add(wb, new THREE.CylinderGeometry(0.2, 0.2, 0.06, 20), dark, sx, 1.05, -0.62, { rz: Math.PI / 2, cast: false });
		k.spot({ id: "gymBench", x: bx, z: bz + 0.1, h: 0, y: 0.0 });
		k.interact("gym:bench", { label: "Sit on the weight bench", stand: [bx + 1.15, bz + 0.1], sit: ["gymBench"] }, wb);
		k.box(bx - 0.85, bx + 0.85, bz - 0.75, bz + 0.65);
	}

	// ---------------------------------------------------------------- a punching bag hanging from the ceiling
	let bag = null;
	{
		const px = 24.4, pz = 17.0;
		const hang = group(g, px, H, pz);
		add(hang, new THREE.CylinderGeometry(0.06, 0.06, 0.04, 12), steel, 0, -0.02, 0, { cast: false });
		bag = group(hang, 0, 0, 0);
		add(bag, new THREE.CylinderGeometry(0.008, 0.008, 1.0, 6), steel, 0, -0.5, 0, { cast: false });
		add(bag, new THREE.CylinderGeometry(0.2, 0.2, 1.1, 20), mat("#b5172e", 0.55), 0, -1.55, 0);
		add(bag, new THREE.CylinderGeometry(0.205, 0.205, 0.08, 20), mat("#1d1f24", 0.6), 0, -1.05, 0, { cast: false });
		add(bag, new THREE.CylinderGeometry(0.205, 0.205, 0.08, 20), mat("#1d1f24", 0.6), 0, -2.05, 0, { cast: false });
		k.box(px - 0.3, px + 0.3, pz - 0.3, pz + 0.3);
		k.interact("gym:bag", {
			label: "Punch the bag", stand: [px, pz - 0.85], face: 0,
			use: () => { ctx.setShared("z:gym:punch", Date.now()); ctx.doUpper("throw", 1400); ctx.sfx("pop", 0.5); }
		}, bag);
	}

	// ---------------------------------------------------------------- a mirror wall and yoga mats (west), a swiss ball
	let ball = null;
	{
		const mz = 20.0;
		const mirror = add(g, new THREE.PlaneGeometry(4.0, 2.0), mat("#dfe8ef", 0.04, 1), X0 + 0.02, 1.3, mz, { ry: Math.PI / 2, cast: false });
		add(g, new THREE.BoxGeometry(0.04, 0.06, 4.1), steel, X0 + 0.03, 2.32, mz, { cast: false });
		k.interact("gym:mirror", { label: "Flex in the mirror", stand: [X0 + 2.7, mz + 1.4], face: -Math.PI / 2, use: use("cheer", 2500) }, mirror);
		const neon = tex.text("STAY STRONG", { w: 1024, h: 256, color: "#e8fbff", glow: "#4cc9f0", font: "900 130px 'Nunito', sans-serif" });
		add(g, new THREE.PlaneGeometry(2.2, 0.55), new THREE.MeshBasicMaterial({ map: neon, transparent: true, toneMapped: false, depthWrite: false }), X0 + 0.04, 2.75, mz, { ry: Math.PI / 2, cast: false, receive: false });
		const cols = ["#c77dff", "#06d6a0"];
		const mats = [];
		[X0 + 1.1, X0 + 2.0].forEach((x, i) => { const m = add(g, new THREE.BoxGeometry(0.62, 0.012, 1.75), mat(cols[i], 0.8), x, 0.006, mz - 0.3, { cast: false }); m.userData.floor = true; mats.push(m); });
		k.interact("gym:yoga0", { label: "Do some yoga", stand: [X0 + 1.1, mz - 0.3], face: -Math.PI / 2, use: use("dance", 3500) }, mats[0]);
		k.interact("gym:yoga1", { label: "Have a good stretch", stand: [X0 + 2.0, mz - 0.3], face: -Math.PI / 2, use: use("yawn", 3000) }, mats[1]);
		// the swiss ball, in the north-west corner
		const bx = X0 + 0.7, bz = Z1 - 0.8;
		ball = add(g, new THREE.SphereGeometry(0.33, 24, 16), mat("#ff4d6d", 0.4), bx, 0.33, bz);
		k.box(bx - 0.36, bx + 0.36, bz - 0.36, bz + 0.36);
		k.spot({ id: "gymBall", x: bx, z: bz, h: Math.PI, y: 0.2 });
		k.interact("gym:ball", { label: "Sit on the swiss ball", stand: [bx + 0.2, bz - 0.95], sit: ["gymBall"] }, ball);
	}

	// ---------------------------------------------------------------- a rack of dumbbells by the door (south-west)
	{
		const rx = X0 + 2.2, rz = Z0 + 0.3;
		const dr = group(g, rx, 0, rz, 0);
		add(dr, rbox(1.8, 0.06, 0.35, 0.02), dark, 0, 0.35, 0);
		add(dr, rbox(1.8, 0.06, 0.35, 0.02), dark, 0, 0.7, 0);
		for (const sx of [-0.85, 0.85]) add(dr, new THREE.BoxGeometry(0.05, 0.75, 0.3), dark, sx, 0.375, 0);
		for (let i = 0; i < 8; i++) for (const y of [0.42, 0.77]) {
			const db = group(dr, -0.72 + i * 0.205, y, 0);
			add(db, new THREE.CylinderGeometry(0.012, 0.012, 0.22, 6), steel, 0, 0.02, 0, { rx: Math.PI / 2, cast: false });
			for (const s of [-0.1, 0.1]) add(db, new THREE.CylinderGeometry(0.035 + i * 0.004, 0.035 + i * 0.004, 0.05, 10), dark, 0, 0.02, s, { rx: Math.PI / 2, cast: false });
		}
		k.box(rx - 1.0, rx + 1.0, Z0, rz + 0.3);
		k.interact("gym:dumbbells", { label: "Lift some dumbbells", stand: [rx, rz + 1.0], face: Math.PI, use: use("cheer", 2500, "pop") }, dr);
	}

	// ---------------------------------------------------------------- a water cooler and a bench to rest on (north)
	{
		const cx = X1 - 0.4, cz = Z1 - 0.4;
		const wc = group(g, cx, 0, cz);
		add(wc, rbox(0.34, 0.95, 0.34, 0.03), mat("#eef0f2", 0.5), 0, 0.475, 0);
		add(wc, new THREE.CylinderGeometry(0.15, 0.15, 0.45, 16), new THREE.MeshPhysicalMaterial({ color: "#9fd8ff", transparent: true, opacity: 0.55, roughness: 0.1 }), 0, 1.18, 0, { cast: false });
		k.box(cx - 0.25, cx + 0.25, cz - 0.25, cz + 0.25);
		k.interact("gym:water", { label: "Have a drink of water", stand: [cx - 0.3, cz - 0.95], face: 0, use: use("drink", 2500, "water") }, wc);
		const bx = X0 + 3.0, bz = Z1 - 0.4;
		const b = group(g, bx, 0, bz, Math.PI);
		add(b, rbox(1.6, 0.08, 0.42, 0.02), mat("#8a5a3c", 0.5), 0, 0.44, 0);
		for (const sx of [-0.7, 0.7]) add(b, rbox(0.06, 0.42, 0.38, 0.02), dark, sx, 0.21, 0);
		add(b, rbox(0.42, 0.04, 0.3, 0.02), mat("#f4f4f2", 0.9), 0.4, 0.5, 0, { cast: false });   // (a folded towel)
		const c = Math.cos(Math.PI), s = Math.sin(Math.PI), Wp = (lx, lz) => [bx + lx * c + lz * s, bz - lx * s + lz * c];
		const sids = ["gymRest0", "gymRest1"];
		[-0.4, 0.4].forEach((lx, j) => { const p = Wp(lx, 0.02); k.spot({ id: sids[j], x: p[0], z: p[1], h: Math.PI, y: 0.02 }); });
		k.interact("gym:rest", { label: "Sit down and catch your breath", stand: Wp(0, 0.85), sit: sids }, b);
		k.box(bx - 0.85, bx + 0.85, bz - 0.25, Z1);
	}

	// ---------------------------------------------------------------- photo frames, signs, the light switch
	// (three frames on the north wall, over the rowing machine)
	[[85, 27.4], [86, 29.0], [87, 30.6]].forEach(([slot, x]) => k.photo(slot, x, 1.75, Z1 - 0.03, Math.PI, { w: 0.6, h: 0.45, frame: slot === 86 ? "#c9a05a" : "#ffffff", metal: slot === 86 ? 0.7 : 0 }));
	{
		const st = tex.sign("Roof Deck", "star");
		add(g, new THREE.PlaneGeometry(0.9, 0.225), new THREE.MeshStandardMaterial({ map: st, roughness: 0.45, emissive: "#ffffff", emissiveMap: st, emissiveIntensity: 0.3 }), DM, 2.72, Z0 + 0.04, { cast: false });
	}
	k.lightSwitch(DOOR[1] + 0.45, 1.25, Z0 + 0.02, 0);

	// ---------------------------------------------------------------- light
	for (const x of [24.6, 30.2]) {
		add(g, new THREE.BoxGeometry(0.3, 0.04, 7.0), new THREE.MeshBasicMaterial({ color: "#f4fbff", toneMapped: false }), x, H - 0.03, (Z0 + Z1) / 2, { cast: false });
		k.light(x, H - 0.4, (Z0 + Z1) / 2 - 2.0, "#eef6ff", 3.5, 7);
		k.light(x, H - 0.4, (Z0 + Z1) / 2 + 2.0, "#eef6ff", 3.5, 7);
	}
	const CX = (X0 + X1) / 2, CZ = (Z0 + Z1) / 2;
	k.key.pos.copy(k.V(CX, H - 0.15, CZ)); k.key.target.copy(k.V(CX, 0, CZ));
	k.key.angle = 1.3; k.key.intensity = 18; k.key.distance = 14; k.key.color.set("#f2f7ff");
	k.fill.pos.copy(k.V(CX, 2.4, CZ)); k.fill.intensity = 4.5; k.fill.distance = 16;
	k.hemi = 0.55; k.env = 0.35; k.exposure = 1.05;

	let swing = 0, swingV = 0, lastPunch = ctx.get("z:gym:punch") || 0;
	function update(dt, t) {
		const busy = id => !!ctx.whoSits(id);
		belts.forEach((b, i) => { if (busy(ids[i])) b.material.map.offset.y -= dt * 1.4; });
		if (busy("gymBike")) wheel[0].rotation.x += dt * 6;
		ball.position.y = 0.33 + Math.max(0, Math.sin(t * 1.3)) * 0.02;
		// the bag: a knock each time someone punches it, then it swings back and settles
		const p = ctx.get("z:gym:punch") || 0;
		if (p !== lastPunch) { lastPunch = p; swingV += 1.6; }
		swingV += (-swing * 9 - swingV * 1.2) * Math.min(dt, 0.05);
		swing += swingV * Math.min(dt, 0.05);
		bag.rotation.x = swing * 0.25;
	}
	return { update };
}
