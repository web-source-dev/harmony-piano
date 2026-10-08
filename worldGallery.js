/**
 * Harmony World — the Gallery: the hallway right across the house, with every room off it.
 *
 * World coordinates (this zone's origin is the world's), its parts in GALLERY (worldEstate.js):
 *   the hall      x -22.25..33.4, z 8.42..12.2: front doors at both ends (out onto the west and east lawns)
 *                 off its south side: the dining room, the powder room, the living room (through the bit in front of
 *                 its doorway), the lounge
 *                 off its north side: the library, the foyer, the game room, the spa, the music room
 *                 (every door is in HALL_DOORS, and no two of them face each other across the hall)
 *   the foyer     x -8.05..3.75, z 12.2..24.4, double height: the grand staircase up its west wall to the roof deck
 *                 (the top steps come up through a glass pavilion; the top step is the way across to the roof's floor
 *                 plan), a chandelier, a round settee, palms, a grandfather clock, tall windows
 * Photo frames along the walls (slots 50..61: put your own photos in them), benches, runners, signs over every door.
 */
import { GALLERY, HALL_DOORS, STAIR, WING, WINDOWS, ROOF_FP } from "./worldEstate.js";

const H = 3.4, HF = 5.25;
const [HX0, HX1, HZ0, HZ1] = GALLERY.hall;
const [BX0, BX1, BZ0] = GALLERY.bump;
const [FX0, FX1, , FZ1] = GALLERY.foyer;
const FEW = FX1 - 0.07;   // the face of the foyer's east wall
const [E0, E1] = GALLERY.entrance;
const D = HALL_DOORS;
const RUN = (STAIR.z1 - STAIR.z0) / STAIR.n, RISE = 5.52 / STAIR.n;
const stepAt = z => Math.max(0, Math.min(STAIR.n, Math.floor((z - STAIR.z0) / RUN) + 1));
const mid = d => (d[0] + d[1]) / 2;

export function build(k) {
	const { THREE, add, mat, group, rbox, g, tex, rng } = k;
	const R = rng(8181);
	const floorM = mat("#ffffff", 0.3, 0.05, { map: tex.tiles("#efe9df", "#e2dbcf", "#bdb4a6", 1, 1, 2) });
	const wallM = mat("#ffffff", 0.9, 0, { map: tex.wall("#f1ebe1", "panel", "rgba(160,130,100,0.09)", 1, 1) });
	const ceilM = mat("#f7f3ec", 0.95);
	const win = (face, lo, hi) => WINDOWS.filter(w => w.face === face && !w.door && w.a >= lo && w.b <= hi);

	// ---------------------------------------------------------------- the hall
	k.room({
		x0: HX0, x1: HX1, z0: HZ0, z1: HZ1, h: H, floor: floorM, ceil: ceilM, wall: wallM,
		depth: { n: 0.22, s: 0.22, w: 0.3, e: 0.3 },
		holes: [
			// the south side (the hall's n wall, z = 8.42)
			{ wall: "n", a: D.dining[0], b: D.dining[1], y1: 2.4 },
			{ wall: "n", a: D.powder[0], b: D.powder[1], y1: 2.2 },
			{ wall: "n", a: BX0, b: BX1, y1: H },
			{ wall: "n", a: D.lounge[0], b: D.lounge[1], y1: 2.3, depth: 0.27 },
			// the north side (its s wall, z = 12.2)
			{ wall: "s", a: D.library[0], b: D.library[1], y1: 2.4 },
			{ wall: "s", a: FX0, b: FEW, y1: H },
			{ wall: "s", a: D.games[0], b: D.games[1], y1: 2.3 },
			{ wall: "s", a: D.spa[0], b: D.spa[1], y1: 2.3 },
			{ wall: "s", a: D.music[0], b: D.music[1], y1: 2.4 },
			{ wall: "w", a: E0, b: E1, y1: 2.6 },
			{ wall: "e", a: E0, b: E1, y1: 2.6 }
		]
	});
	// the bit in front of the living room's doorway
	k.room({
		x0: BX0, x1: BX1, z0: BZ0, z1: HZ0, h: H, floor: floorM, ceil: ceilM, wall: { n: wallM, w: wallM, e: wallM },
		holes: [{ wall: "n", a: D.living[0], b: D.living[1], y1: 2.3 }], cornice: false
	});
	// the foyer, double height, with the stairwell cut out of its ceiling
	// (its east wall stands a little in from the game room's own walls and roof next door, which reach right up to
	// FX1: where the two met in the same plane the wall flickered)
	k.room({
		x0: FX0, x1: FEW, z0: HZ1, z1: FZ1, h: HF, floor: floorM, ceil: ceilM, wall: wallM,
		depth: { n: 0.22, s: 0.3, w: 0.2, e: 0.2 },
		holes: [{ wall: "n", a: FX0, b: FEW, y1: H }].concat(win("n", FX0, FX1).map(w => ({ wall: "s", a: w.a, b: w.b, y0: w.y0, y1: w.y1, glass: true }))),
		ceilHoles: [[STAIR.x0, STAIR.x1, STAIR.hole, STAIR.top]]
	});

	// ---------------------------------------------------------------- walking
	k.floor((x, z) => (x > STAIR.x0 - 0.3 && x < STAIR.x1 && z > STAIR.z0 && z < STAIR.top + 0.2) ? stepAt(z) * RISE : 0);
	k.walk(HX0, HX1, HZ0, HZ1);
	// (each part reaches well into the hall: a body needs its whole radius inside one rect, so rects that only just meet
	// leave a strip nobody can cross; each doorway reaches into the room on the other side, which has its own rect too)
	k.walk(BX0, BX1, BZ0, HZ0 + 1.2);
	k.walk(FX0, FX1, HZ1 - 1.2, FZ1);
	for (const id of ["dining", "powder", "lounge"]) k.walk(D[id][0], D[id][1], HZ0 - 1.0, HZ0 + 1.0);
	for (const id of ["library", "games", "spa", "music"]) k.walk(D[id][0], D[id][1], HZ1 - 1.0, HZ1 + 1.2);
	k.walk(D.living[0], D.living[1], BZ0 - 0.8, BZ0 + 1.0);
	// out of the front doors: right across the hall's own area, which reaches 1.65 m out past each end wall (short of
	// that, there was a strip outside each door that was nobody's to stand on, so you couldn't get through)
	k.walk(HX0 - 2.3, HX0 + 1.0, E0, E1);
	k.walk(HX1 - 1.0, HX1 + 2.3, E0, E1);
	k.cam = { minX: HX0 + 0.2, maxX: HX1 - 0.2, minZ: BZ0 + 0.2, maxZ: FZ1 - 0.2, maxY: 9.5 };
	// the rooms either side are solid to the camera (it stays in the hallway)
	for (const r of [WING.dining, WING.powder, WING.library, WING.games, WING.spa, WING.music, [7.05, 23.35, -6.15, 8.15], [-22.45, -7.05, -8.7, 1.7], [23.2, 33.6, -8.7, 8.4]]) k.camWall(r[0], r[1], r[2], r[3], -2, 5.3);
	// the stairs' open side is solid (up from the bottom step only), and the top step carries you onto the roof
	k.box(STAIR.x1, STAIR.x1 + 0.2, STAIR.z0 - 0.12, STAIR.top);
	k.link(STAIR.x0, STAIR.x1, STAIR.z1 + 0.15, STAIR.z1 + 0.4, ROOF_FP[0], ROOF_FP[1]);
	k.link(STAIR.x0 + ROOF_FP[0], STAIR.x1 + ROOF_FP[0], STAIR.z1 - 0.2 + ROOF_FP[1], STAIR.z1 + 0.05 + ROOF_FP[1], -ROOF_FP[0], -ROOF_FP[1], true);

	// ---------------------------------------------------------------- doors into the living room and the lounge
	// (in the walls between them and the hall; the curtains hang on the rooms' side)
	k.frenchDoor("hallLiving", { x: mid(D.living), z: 6.1, ry: 0, w: D.living[1] - D.living[0] - 0.04, h: 2.3, depth: 0.3, side: -1, curtain: "#b5677a" }, [D.living[0], D.living[1], 5.95, 6.25], [[mid(D.living), 5.2], [mid(D.living), 7.3]]);
	k.frenchDoor("hallLounge", { x: mid(D.lounge), z: HZ0 - 0.14, ry: 0, w: D.lounge[1] - D.lounge[0] - 0.04, h: 2.3, depth: 0.32, side: -1, curtain: "#5f8f8a" }, [D.lounge[0], D.lounge[1], HZ0 - 0.3, HZ0], [[mid(D.lounge), HZ0 - 1.2], [mid(D.lounge), HZ0 + 1.0]]);

	// ---------------------------------------------------------------- the front doors
	// (side -1: the doors swing in, and the curtains hang, on the hall's side - not out on the lawn)
	k.frenchDoor("frontWest", { x: HX0 - 0.15, z: (E0 + E1) / 2, ry: -Math.PI / 2, w: E1 - E0 - 0.04, h: 2.55, depth: 0.45, side: -1, curtain: "#d8cfc4" }, [HX0 - 0.3, HX0, E0, E1], [[HX0 + 1.0, (E0 + E1) / 2], [HX0 - 1.2, (E0 + E1) / 2]]);
	k.frenchDoor("frontEast", { x: HX1 + 0.15, z: (E0 + E1) / 2, ry: Math.PI / 2, w: E1 - E0 - 0.04, h: 2.55, depth: 0.45, side: -1, curtain: "#d8cfc4" }, [HX1, HX1 + 0.3, E0, E1], [[HX1 - 1.0, (E0 + E1) / 2], [HX1 + 1.2, (E0 + E1) / 2]]);

	// ---------------------------------------------------------------- the grand staircase
	{
		const stone = mat("#f4f1ec", 0.4), oak = mat("#a87a52", 0.5), steel = mat("#2e2a31", 0.4, 0.6), brass = mat("#c9a05a", 0.3, 0.9);
		const glassM = new THREE.MeshPhysicalMaterial({ color: "#d8ecff", transparent: true, opacity: 0.18, roughness: 0.05, depthWrite: false, side: THREE.DoubleSide });
		const w = STAIR.x1 - STAIR.x0, cx = (STAIR.x0 + STAIR.x1) / 2;
		for (let i = 1; i <= STAIR.n; i++) {
			const za = STAIR.z0 + (i - 1) * RUN, zb = i === STAIR.n ? STAIR.top : za + RUN, top = i * RISE;
			add(g, new THREE.BoxGeometry(w, top, zb - za), stone, cx, top / 2, (za + zb) / 2, { cast: false });
			add(g, new THREE.BoxGeometry(w + 0.02, 0.04, zb - za + 0.02), oak, cx, top + 0.02, (za + zb) / 2, { cast: false });
		}
		// the open side: glass under a brass handrail, rising with the steps
		const pts = [];
		for (let i = 0; i <= 12; i++) { const z = STAIR.z0 + 0.2 + i / 12 * (STAIR.z1 - STAIR.z0 - 0.2); pts.push(new THREE.Vector3(STAIR.x1 + 0.05, stepAt(z) * RISE + 1.0, z)); }
		add(g, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.03, 8), brass, 0, 0, 0, { cast: false });
		const len = Math.hypot(pts[12].z - pts[0].z, pts[12].y - pts[0].y), ang = Math.atan2(pts[12].y - pts[0].y, pts[12].z - pts[0].z);
		const gl = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.92), glassM);
		gl.position.set(STAIR.x1 + 0.05, (pts[0].y + pts[12].y) / 2 - 0.5, (pts[0].z + pts[12].z) / 2);
		gl.rotation.set(0, -Math.PI / 2, 0); gl.rotateZ(ang);
		gl.renderOrder = 2;
		g.add(gl);
		for (let i = 0; i <= 6; i++) { const p = pts[i * 2]; add(g, new THREE.CylinderGeometry(0.025, 0.025, 1.0, 8), steel, p.x, p.y - 0.5, p.z, { cast: false }); }
		// a newel post and a sign at the foot
		const newel = group(g, STAIR.x1 + 0.05, 0, STAIR.z0);
		add(newel, new THREE.CylinderGeometry(0.08, 0.1, 1.1, 14), brass, 0, 0.55, 0, { cast: false });
		add(newel, new THREE.SphereGeometry(0.1, 14, 10), brass, 0, 1.15, 0, { cast: false });
		const st = tex.sign("Roof Deck", "star");
		add(g, new THREE.PlaneGeometry(0.9, 0.225), new THREE.MeshStandardMaterial({ map: st, roughness: 0.45, emissive: "#ffffff", emissiveMap: st, emissiveIntensity: 0.35 }), STAIR.x1 + 0.6, 2.75, STAIR.z0 - 0.4, { ry: Math.PI, cast: false });
		k.interact("gallery:stairs", { label: "Go up to the roof", stand: [cx, STAIR.z0 - 0.7], use: () => k.ctx.walkTo(cx + 0.6 + ROOF_FP[0], 23.9 + ROOF_FP[1], null) }, gl, newel);
	}

	// ---------------------------------------------------------------- the foyer: a chandelier, a round settee, palms
	const crystals = [];
	let pendulum = null;
	{
		const brass = mat("#c9a05a", 0.3, 0.9);
		const cx = -1.6, cz = 17.4;
		const cg = group(g, cx, HF, cz);
		add(cg, new THREE.CylinderGeometry(0.012, 0.012, 1.0, 6), brass, 0, -0.5, 0, { cast: false });
		for (const [r, y] of [[1.0, -1.1], [0.68, -1.42], [0.36, -1.68]]) {
			add(cg, new THREE.TorusGeometry(r, 0.025, 8, 48), brass, 0, y, 0, { rx: Math.PI / 2, cast: false });
			const n = Math.round(r * 22);
			for (let i = 0; i < n; i++) {
				const a = i / n * Math.PI * 2;
				const c = add(cg, new THREE.OctahedronGeometry(0.045, 0), new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.05, metalness: 0.2, emissive: "#ffe9c7", emissiveIntensity: 0.6 }), Math.cos(a) * r, y - 0.12, Math.sin(a) * r, { cast: false });
				c.scale.set(1, 1.6, 1);
				crystals.push(c);
			}
			for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; add(cg, new THREE.SphereGeometry(0.05, 10, 8), new THREE.MeshBasicMaterial({ color: "#fff2d6", toneMapped: false }), Math.cos(a) * r, y + 0.06, Math.sin(a) * r, { cast: false }); }
		}
		// a round settee under it (sit back to back)
		const velvet = mat("#2a4d6e", 0.85);
		const se = group(g, cx, 0, cz);
		add(se, new THREE.CylinderGeometry(1.15, 1.2, 0.45, 40), velvet, 0, 0.225, 0);
		add(se, new THREE.CylinderGeometry(0.42, 0.5, 0.9, 30), velvet, 0, 0.6, 0);
		add(se, new THREE.CylinderGeometry(0.22, 0.25, 0.4, 20), mat("#e8dccb", 0.5), 0, 1.25, 0);
		for (let i = 0; i < 18; i++) { const a = R() * 6.28, r = R() * 0.18; add(se, new THREE.SphereGeometry(0.07, 8, 6), mat(["#ffd6e0", "#ffffff", "#ffe5a8"][i % 3], 0.7), Math.cos(a) * r, 1.5 + R() * 0.2, Math.sin(a) * r, { cast: false }); }
		const ids = [];
		for (let i = 0; i < 4; i++) {
			const a = i / 4 * Math.PI * 2 + Math.PI / 4, x = cx + Math.sin(a) * 0.95, z = cz + Math.cos(a) * 0.95;
			const id = "foyerSeat" + i;
			k.spot({ id, x, z, h: a, y: 0.02 });
			ids.push(id);
		}
		k.interact("gallery:settee", { label: "Sit on the round settee", stand: [cx + 1.9, cz], sit: ids }, se);
		k.box(cx - 1.25, cx + 1.25, cz - 1.25, cz + 1.25);
		const rug = add(g, new THREE.CircleGeometry(2.6, 48), mat("#ffffff", 1, 0, { map: tex.carpet("#7a3b4f", "#e8c27a", 1, 1, true) }), cx, 0.006, cz, { rx: -Math.PI / 2, cast: false });
		rug.userData.floor = true;
		// palms in the foyer's corners (clear of the stairs, the windows and the way through)
		const pot = mat("#d8cfc4", 0.6), leaf = mat("#3f7d4a", 0.7);
		for (const [x, z] of [[FX1 - 0.6, FZ1 - 0.6], [FX1 - 0.6, HZ1 + 0.9], [-5.0, FZ1 - 0.6]]) {
			const p = group(g, x, 0, z);
			add(p, new THREE.CylinderGeometry(0.32, 0.25, 0.6, 20), pot, 0, 0.3, 0);
			add(p, new THREE.CylinderGeometry(0.04, 0.06, 1.6, 8), mat("#7a5a3c", 0.8), 0, 1.3, 0);
			for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; const lf = add(p, new THREE.ConeGeometry(0.14, 1.1, 4), leaf, Math.cos(a) * 0.45, 2.05, Math.sin(a) * 0.45, { cast: false }); lf.rotation.set(Math.sin(a) * 1.2, 0, -Math.cos(a) * 1.2); }
			k.box(x - 0.38, x + 0.38, z - 0.38, z + 0.38);
		}
		// a big photo on the foyer's east wall (frame 50), and two more beside it
		k.photo(50, FEW - 0.03, 2.6, 18.6, -Math.PI / 2, { w: 2.2, h: 1.5, frame: "#c9a05a", metal: 0.7 });
		k.photo(51, FEW - 0.03, 2.2, 15.4, -Math.PI / 2, { w: 0.9, h: 1.1, frame: "#fbf8f2" });
		k.photo(52, FEW - 0.03, 2.2, 21.8, -Math.PI / 2, { w: 0.9, h: 1.1, frame: "#fbf8f2" });
		// a grandfather clock against the east wall: it ticks, and chimes when you ask it the time
		const ck = group(g, FEW - 0.3, 0, 20.5, -Math.PI / 2);
		const wood = mat("#4a2f22", 0.45);
		add(ck, rbox(0.55, 2.1, 0.35, 0.03), wood, 0, 1.05, 0);
		add(ck, rbox(0.62, 0.25, 0.4, 0.03), wood, 0, 2.2, 0);
		add(ck, new THREE.CircleGeometry(0.2, 32), mat("#f4efe6", 0.4), 0, 1.75, 0.18, { cast: false });
		for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; add(ck, new THREE.BoxGeometry(0.012, 0.035, 0.005), mat("#1e1814", 0.5), Math.sin(a) * 0.16, 1.75 + Math.cos(a) * 0.16, 0.182, { rz: -a, cast: false }); }
		add(ck, new THREE.BoxGeometry(0.012, 0.15, 0.006), mat("#1e1814", 0.5), 0, 1.81, 0.186, { cast: false });
		add(ck, new THREE.PlaneGeometry(0.3, 0.9), new THREE.MeshPhysicalMaterial({ color: "#d8ecff", transparent: true, opacity: 0.2, roughness: 0.05, depthWrite: false }), 0, 0.85, 0.18, { cast: false });
		pendulum = group(ck, 0, 1.4, 0.12);
		add(pendulum, new THREE.CylinderGeometry(0.006, 0.006, 0.7, 6), brass, 0, -0.35, 0, { cast: false });
		add(pendulum, new THREE.CylinderGeometry(0.08, 0.08, 0.02, 20), brass, 0, -0.72, 0, { rx: Math.PI / 2, cast: false });
		k.box(FX1 - 0.55, FX1, 20.15, 20.85);
		k.interact("gallery:clock", { label: "What time is it?", stand: [FX1 - 1.2, 20.5], face: Math.PI / 2, use: () => {
			const now = new Date();
			k.ctx.notice("The grandfather clock says " + now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }));
			k.ctx.sfx("pop", 0.5);
			k.ctx.doUpper("wave", 1500);
		} }, ck);
		// a console under the windows, with a vase of flowers to smell
		const cs = group(g, -1.2, 0, FZ1 - 0.35);
		add(cs, rbox(1.8, 0.06, 0.45, 0.02), wood, 0, 0.82, 0);
		for (const sx of [-0.82, 0.82]) add(cs, new THREE.BoxGeometry(0.06, 0.8, 0.4), wood, sx, 0.4, 0);
		add(cs, new THREE.CylinderGeometry(0.1, 0.07, 0.3, 16), mat("#e8f1ff", 0.1), 0, 1.0, 0, { cast: false });
		for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; add(cs, new THREE.SphereGeometry(0.06, 8, 6), mat(["#ff8fab", "#ffd166", "#ffffff"][i % 3], 0.7), Math.cos(a) * 0.12, 1.25 + (i % 3) * 0.05, Math.sin(a) * 0.12, { cast: false }); }
		k.box(-2.15, -0.25, FZ1 - 0.6, FZ1);
		k.interact("gallery:flowers", { label: "Smell the flowers", stand: [-1.2, FZ1 - 1.15], face: Math.PI, use: () => { k.ctx.doUpper("lovestruck", 2500); k.ctx.sfx("pop", 0.3); } }, cs);
	}

	// ---------------------------------------------------------------- the hall: photos, benches, runners, lights, signs
	{
		const oak = mat("#8a5a3c", 0.5);
		// photo frames along both walls, between the doors (n: the hall's south wall, facing north; s: its north wall)
		// (slots 53..61: the foyer has 50..52)
		const frames = [[-20.2, "n"], [-13.4, "n"], [9.9, "n"], [17.5, "n"], [26.5, "n"], [31.0, "n"], [-20.0, "s"], [5.9, "s"], [24.0, "s"]];
		frames.forEach(([x, side], i) => {
			const slot = 53 + i;
			const z = side === "n" ? HZ0 + 0.03 : HZ1 - 0.03;
			k.photo(slot, x, 1.75, z, side === "n" ? 0 : Math.PI, { w: 1.1, h: 0.8, frame: i % 2 ? "#fbf8f2" : "#c9a05a", metal: i % 2 ? 0 : 0.7 });
			add(g, new THREE.SphereGeometry(0.05, 10, 8), new THREE.MeshBasicMaterial({ color: "#fff2d6", toneMapped: false }), x, 2.42, side === "n" ? HZ0 + 0.12 : HZ1 - 0.12, { cast: false });
		});
		// two benches for two along the hall
		[[-16.0, HZ1 - 0.35, Math.PI], [24.2, HZ0 + 0.35, 0]].forEach(([x, z, h], i) => {
			const b = group(g, x, 0, z, h);
			add(b, rbox(1.4, 0.08, 0.42, 0.02), oak, 0, 0.44, 0);
			for (const sx of [-0.6, 0.6]) add(b, rbox(0.06, 0.42, 0.38, 0.02), mat("#2e2a31", 0.5, 0.4), sx, 0.21, 0);
			add(b, rbox(0.5, 0.08, 0.36, 0.03), mat("#b56576", 0.9), -0.3, 0.52, 0, { cast: false });
			const ids = ["hallBench" + i + "a", "hallBench" + i + "b"];
			const c = Math.cos(h), s = Math.sin(h), W = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
			[-0.35, 0.35].forEach((lx, j) => { const p = W(lx, 0.02); k.spot({ id: ids[j], x: p[0], z: p[1], h, y: 0.02 }); });
			k.interact("gallery:bench" + i, { label: "Sit on the bench", stand: W(0, 0.8), sit: ids }, b);
			const a = W(-0.75, -0.25), bb = W(0.75, 0.25);
			k.box(Math.min(a[0], bb[0]), Math.max(a[0], bb[0]), Math.min(a[1], bb[1]), Math.max(a[1], bb[1]));
		});
		// a long runner down the hall
		for (const [x0, x1] of [[HX0 + 1.0, -8.5], [4.0, HX1 - 1.0]]) {
			const rn = add(g, new THREE.PlaneGeometry(1.2, x1 - x0), mat("#ffffff", 1, 0, { map: tex.runner("#2b4c7e", "#e8c27a") }), (x0 + x1) / 2, 0.006, (HZ0 + HZ1) / 2, { rx: -Math.PI / 2, rz: Math.PI / 2, cast: false });
			rn.userData.floor = true;
		}
		// ceiling lights: a row of glowing discs
		for (let x = HX0 + 2.5; x < HX1 - 1; x += 4.0) add(g, new THREE.CircleGeometry(0.28, 24), new THREE.MeshBasicMaterial({ color: "#fff6e4", toneMapped: false }), x, H - 0.01, (HZ0 + HZ1) / 2, { rx: Math.PI / 2, cast: false });
		// plants by the front doors
		for (const [x, z] of [[HX0 + 0.5, E1 + 0.5], [HX0 + 0.5, E0 - 0.5], [HX1 - 0.5, E1 + 0.5], [HX1 - 0.5, E0 - 0.5]]) {
			const p = group(g, x, 0, z);
			add(p, new THREE.CylinderGeometry(0.2, 0.16, 0.45, 16), mat("#2e2a31", 0.5), 0, 0.225, 0);
			for (let i = 0; i < 8; i++) add(p, new THREE.SphereGeometry(0.16, 10, 8), mat(i % 2 ? "#4f8a57" : "#3f7a48", 0.7), Math.cos(i * 2.4) * 0.14, 0.6 + (i % 4) * 0.2, Math.sin(i * 2.4) * 0.14, { cast: false });
			k.box(x - 0.24, x + 0.24, z - 0.24, z + 0.24);
		}
		// signs over the doors
		const sign = (x, y, z, ry, text, icon) => {
			const st = tex.sign(text, icon);
			add(g, new THREE.PlaneGeometry(0.9, 0.225), new THREE.MeshStandardMaterial({ map: st, roughness: 0.45, emissive: "#ffffff", emissiveMap: st, emissiveIntensity: 0.3 }), x, y, z, { ry, cast: false });
		};
		sign(mid(D.dining), 2.7, HZ0 + 0.03, 0, "Dining Room", "food");
		sign(mid(D.powder), 2.55, HZ0 + 0.03, 0, "Powder Room", "heart");
		sign(mid(D.lounge), 2.62, HZ0 + 0.03, 0, "Lounge & Kitchen", "sofa");
		sign(mid(D.library), 2.7, HZ1 - 0.03, Math.PI, "Library", "star");
		sign(mid(D.games), 2.62, HZ1 - 0.03, Math.PI, "Game Room", "games");
		sign(mid(D.spa), 2.62, HZ1 - 0.03, Math.PI, "Spa", "bath");
		sign(mid(D.music), 2.7, HZ1 - 0.03, Math.PI, "Music Room", "mic");
		sign(mid(D.living), 2.62, BZ0 + 0.03, 0, "Living Room", "home");
		for (const [x, ry] of [[HX0 + 0.03, Math.PI / 2], [HX1 - 0.03, -Math.PI / 2]]) sign(x, 2.95, (E0 + E1) / 2, ry, "Garden & Grounds", "home");
	}
	k.lightSwitch(BX0 + 0.02, 1.25, 7.3, Math.PI / 2);

	// ---------------------------------------------------------------- light (seven, along the hall and up the foyer)
	k.light(-1.6, 3.8, 17.4, "#ffe2c0", 8, 14, 1.5);
	k.light(-6.8, 4.6, 21.6, "#ffe6c8", 3, 8);
	k.light(-16.0, 2.9, 10.3, "#fff0dc", 3.5, 9);
	k.light(-6.0, 2.9, 10.3, "#fff0dc", 3.5, 9);
	k.light(6.0, 2.9, 10.3, "#fff0dc", 3.5, 9);
	k.light(18.0, 2.9, 10.3, "#fff0dc", 3.5, 9);
	k.light(29.0, 2.9, 10.3, "#fff0dc", 3.5, 9);
	k.key.pos.copy(k.V(-1.6, HF - 0.2, 17.0)); k.key.target.copy(k.V(-1.6, 0, 17.0));
	k.key.angle = 1.3; k.key.intensity = 26; k.key.distance = 20; k.key.color.set("#ffe6cc");
	k.fill.pos.copy(k.V(6.0, 3.0, 10.3)); k.fill.intensity = 7; k.fill.distance = 40; k.fill.decay = 0.8;
	k.hemi = 0.55; k.env = 0.34; k.exposure = 1.05;

	function update(dt, t) {
		for (let i = 0; i < crystals.length; i += 3) crystals[i].material.emissiveIntensity = 0.45 + Math.sin(t * 2.3 + i) * 0.25;
		if (pendulum) pendulum.rotation.z = Math.sin(t * Math.PI) * 0.18;
	}
	return { update };
}
