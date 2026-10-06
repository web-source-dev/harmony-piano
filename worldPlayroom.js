/**
 * Harmony World — the playroom: a big pavilion up on the roof deck (over the game room and the spa), its door in its
 * south side (the low-z wall), onto the wide promenade in front of the lounge's upper storey.
 *
 * Drawn coordinates (on the floor plan it sits with the roof, ROOF_FP away; its zone's origin is that offset, so these
 * are where it's drawn): inside WING.playroom, x 4.2..19.4, z 14.0..24.0, from the deck up 3.4 m. Windows all round.
 *   west:   three bean bags under two photo frames, a ball pit (sit in it together) with a slide down into it
 *   middle: building blocks, a little table with two tiny chairs, a toy train going round its track (toot it: it speeds up)
 *   north:  a shelf of teddy bears (hug one) under two more photo frames
 *   east:   a rocking horse that rocks, a chalkboard to doodle on, a trampoline to bounce on, a play tent (sit inside)
 * The way in (DOOR, x 10.8..12.8) is kept clear, with walkways of at least 1.2 m between everything.
 * Shared keys: z:playroom:toot (when the train was last tooted).
 */
import { WING, ROOF_PLAN } from "./worldEstate.js";

const [X0, X1, Z0, Z1] = WING.playroom;
const H = 3.4;
const DOOR = [ROOF_PLAN.playDoor[0], ROOF_PLAN.playDoor[1]];   // (x: in the south wall, z = Z0)
const DM = (DOOR[0] + DOOR[1]) / 2;
const PIT = { x: X0 + 3.0, z: Z1 - 3.2, r: 1.7 };
const TRAIN = { x: 14.0, z: Z1 - 2.6, rx: 2.0, rz: 1.3 };
const TENT = { x: X1 - 1.1, z: Z1 - 1.2 };
const TRAMP = { x: X1 - 1.8, z: Z0 + 4.9, r: 0.85 };

export function build(k) {
	const { THREE, add, mat, group, rbox, g, ctx, tex, canvasTex, rng } = k;
	const R = rng(2468);
	const COLS = ["#ff4d6d", "#ffd166", "#06d6a0", "#4cc9f0", "#c77dff", "#ff9e4a"];
	const foam = canvasTex(256, 256, (c, w, h) => {
		const cs = ["#ffd6e0", "#d0f4de", "#cde7ff", "#fff1b8"];
		for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { c.fillStyle = cs[(i + j * 2) % 4]; c.fillRect(i * 128, j * 128, 128, 128); }
		c.strokeStyle = "rgba(0,0,0,0.08)"; c.lineWidth = 3;
		for (let x = 0; x <= w; x += 128) { c.beginPath(); for (let y = 0; y <= h; y += 16) { const o = (y / 16) % 2 ? 6 : -6; y ? c.lineTo(x + o, y) : c.moveTo(x + o, y); } c.stroke(); }
	});
	const sky = canvasTex(512, 512, (c, w, h) => {
		c.fillStyle = "#cfe8ff"; c.fillRect(0, 0, w, h);
		for (let i = 0; i < 9; i++) { const x = R() * w, y = R() * h; c.fillStyle = "rgba(255,255,255,0.9)"; for (let b = 0; b < 5; b++) { c.beginPath(); c.arc(x + b * 18, y + Math.sin(b) * 8, 22 + R() * 10, 0, Math.PI * 2); c.fill(); } }
	});
	k.room({
		x0: X0, x1: X1, z0: Z0, z1: Z1, h: H,
		floor: mat("#ffffff", 0.95, 0, { map: foam }),
		ceil: mat("#ffffff", 0.95, 0, { map: sky }),
		wall: mat("#ffffff", 0.9, 0, { map: tex.wall("#fff4e6", "dots", "rgba(255,143,171,0.35)", 1, 1) }),
		trim: mat("#ff8fab", 0.6),
		exterior: mat("#ffffff", 0.88, 0, { map: k.renderTex(1, 1) }), roofM: mat("#57525c", 0.9),
		depth: { n: 0.25, s: 0.25, w: 0.25, e: 0.25 },
		holes: [
			{ wall: "n", a: DOOR[0], b: DOOR[1], y1: 2.4 },
			{ wall: "n", a: X0 + 0.8, b: DOOR[0] - 1.4, y0: 0.8, y1: 2.6, glass: true },
			{ wall: "n", a: DOOR[1] + 1.4, b: X1 - 0.8, y0: 0.8, y1: 2.6, glass: true },
			{ wall: "s", a: X0 + 0.7, b: X0 + 2.1, y0: 1.0, y1: 2.6, glass: true },
			{ wall: "s", a: 14.0, b: 16.8, y0: 1.0, y1: 2.6, glass: true },
			{ wall: "w", a: Z1 - 4.5, b: Z1 - 1.0, y0: 0.8, y1: 2.6, glass: true },
			{ wall: "e", a: Z1 - 5.0, b: Z1 - 0.8, y0: 0.8, y1: 2.6, glass: true }
		]
	});
	// (the trampoline is a step up: you stand on it to bounce)
	k.floor((x, z) => (Math.hypot(x - TRAMP.x, z - TRAMP.z) < TRAMP.r ? 0.3 : 0));
	k.walk(X0, X1, Z0, Z1);
	k.walk(DOOR[0], DOOR[1], Z0 - 1.3, Z0 + 1.0);
	k.frenchDoor("playDoor", { x: DM, z: Z0 - 0.125, ry: Math.PI, w: DOOR[1] - DOOR[0] - 0.04, h: 2.4, depth: 0.4, side: -1, curtain: "#ff8fab" }, [DOOR[0], DOOR[1], Z0 - 0.25, Z0], [[DM, Z0 + 0.9], [DM, Z0 - 1.0]]);
	k.cam = { minX: X0 + 0.2, maxX: X1 - 0.2, minZ: Z0 + 0.2, maxZ: Z1 - 0.2, maxY: H - 0.25 };
	const use = (u, ms, sfx) => () => { ctx.doUpper(u, ms); if (sfx) ctx.sfx(sfx, 0.35); };

	// ---------------------------------------------------------------- the ball pit (and a slide down into it)
	{
		const pit = group(g, PIT.x, 0, PIT.z);
		const rimM = mat("#ff8fab", 0.7);
		add(pit, new THREE.TorusGeometry(PIT.r, 0.22, 14, 48), rimM, 0, 0.42, 0, { rx: Math.PI / 2 });
		add(pit, new THREE.CylinderGeometry(PIT.r + 0.2, PIT.r + 0.24, 0.42, 48, 1, true), rimM, 0, 0.21, 0);
		const n = 700, im = new THREE.InstancedMesh(new THREE.SphereGeometry(0.075, 8, 6), mat("#ffffff", 0.35), n);
		const d = new THREE.Object3D(), col = new THREE.Color();
		for (let i = 0; i < n; i++) {
			const a = R() * Math.PI * 2, r = Math.sqrt(R()) * (PIT.r - 0.08);
			d.position.set(Math.cos(a) * r, 0.08 + R() * 0.38, Math.sin(a) * r); d.updateMatrix();
			im.setMatrixAt(i, d.matrix); im.setColorAt(i, col.set(COLS[i % COLS.length]));
		}
		im.castShadow = false; im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true;
		pit.add(im);
		k.box(PIT.x - PIT.r - 0.25, PIT.x + PIT.r + 0.25, PIT.z - PIT.r - 0.25, PIT.z + PIT.r + 0.25);
		k.spot({ id: "ballPit0", x: PIT.x - 0.45, z: PIT.z + 0.1, h: Math.PI + 0.3, y: -0.25, low: true });
		k.spot({ id: "ballPit1", x: PIT.x + 0.45, z: PIT.z + 0.1, h: Math.PI - 0.3, y: -0.25, low: true });
		k.interact("playroom:pit", { label: "Jump in the ball pit", stand: [PIT.x, PIT.z - PIT.r - 0.75], sit: ["ballPit0", "ballPit1"] }, pit);
		// the slide: a little platform against the north wall, a ladder up its east side, the chute down into the pit
		const sl = group(g, PIT.x, 0, PIT.z + 2.55);
		const plat = mat("#4cc9f0", 0.6), chute = mat("#ffd166", 0.4);
		add(sl, rbox(0.9, 0.08, 0.9, 0.03), plat, 0, 1.2, 0);
		for (const sx of [-0.4, 0.4]) for (const sz of [-0.4, 0.4]) add(sl, new THREE.CylinderGeometry(0.04, 0.04, 1.2, 8), plat, sx, 0.6, sz);
		for (let i = 0; i < 5; i++) add(sl, new THREE.BoxGeometry(0.05, 0.04, 0.7), plat, 0.45, 0.22 + i * 0.22, 0, { cast: false });
		const dz = 1.55, dy = 0.75, len = Math.hypot(dz, dy);
		const ch = add(sl, new THREE.BoxGeometry(0.6, 0.04, len), chute, 0, 1.2 - dy / 2, -0.45 - dz / 2, { cast: false });
		ch.rotation.x = -Math.atan2(dy, dz);
		for (const sx of [-0.31, 0.31]) { const s = add(sl, new THREE.BoxGeometry(0.03, 0.12, len), chute, sx, 1.26 - dy / 2, -0.45 - dz / 2, { cast: false }); s.rotation.x = -Math.atan2(dy, dz); }
		k.box(PIT.x - 0.55, PIT.x + 0.8, PIT.z + PIT.r + 0.25, Z1);
		k.spot({ id: "playSlide", x: PIT.x, z: PIT.z + 2.55 - 0.45 - dz / 2, h: Math.PI, y: 0.4, ridePose: () => "slide" });
		k.interact("playroom:slide", { label: "Whizz down the slide", stand: [PIT.x + 1.35, Z1 - 0.7], sit: ["playSlide"] }, sl);
	}

	// ---------------------------------------------------------------- three bean bags along the west wall
	{
		const beanM = [mat("#06d6a0", 0.95), mat("#c77dff", 0.95), mat("#ffd166", 0.95)];
		[Z0 + 1.3, Z0 + 2.5, Z0 + 3.7].forEach((bz, i) => {
			const bx = X0 + 0.9, face = Math.PI / 2;
			const bb = group(g, bx, 0, bz, face);
			const body = add(bb, new THREE.SphereGeometry(0.42, 24, 16), beanM[i], 0, 0.22, 0); body.scale.set(1, 0.55, 1);
			const back = add(bb, new THREE.SphereGeometry(0.34, 20, 14), beanM[i], 0, 0.38, -0.22); back.scale.set(1.05, 0.9, 0.6);
			k.box(bx - 0.4, bx + 0.4, bz - 0.4, bz + 0.4);
			k.spot({ id: "playBean" + i, x: bx + 0.05, z: bz, h: face, y: -0.13, low: true });
			k.interact("playroom:bean" + i, { label: "Flop into the bean bag", stand: [bx + 0.95, bz], sit: ["playBean" + i] }, bb);
		});
	}

	// ---------------------------------------------------------------- building blocks on the floor
	{
		const bl = group(g, X0 + 3.8, 0, Z0 + 2.4);
		for (let i = 0; i < 26; i++) {
			const x = (R() - 0.5) * 1.4, z = (R() - 0.5) * 1.1, s = 0.12 + R() * 0.06;
			add(bl, new THREE.BoxGeometry(s, s, s), mat(COLS[i % COLS.length], 0.6), x, s / 2 + (i % 5 === 0 ? s : 0), z, { ry: R() * 3, cast: false });
		}
		// a little tower someone started
		for (let i = 0; i < 5; i++) add(bl, new THREE.BoxGeometry(0.15, 0.15, 0.15), mat(COLS[(i + 2) % COLS.length], 0.6), 0.9, 0.075 + i * 0.15, -0.6, { ry: i * 0.3, cast: false });
		k.box(X0 + 4.6, X0 + 4.8, Z0 + 1.7, Z0 + 1.9);
		k.interact("playroom:blocks", { label: "Build a tower", stand: [X0 + 3.8, Z0 + 3.4], face: Math.PI, use: use("clap", 2500, "pop") }, bl);
	}

	// ---------------------------------------------------------------- a little table with two tiny chairs
	{
		const tx = 14.2, tz = Z0 + 3.0;
		const t = group(g, tx, 0, tz);
		add(t, new THREE.CylinderGeometry(0.42, 0.42, 0.04, 28), mat("#ffd166", 0.5), 0, 0.5, 0);
		add(t, new THREE.CylinderGeometry(0.05, 0.08, 0.5, 12), mat("#4cc9f0", 0.5), 0, 0.25, 0);
		add(t, new THREE.CylinderGeometry(0.06, 0.07, 0.08, 12), mat("#ffffff", 0.4), -0.1, 0.56, 0.05, { cast: false });   // (a toy teacup)
		add(t, new THREE.CylinderGeometry(0.06, 0.07, 0.08, 12), mat("#ffffff", 0.4), 0.12, 0.56, -0.08, { cast: false });
		k.box(tx - 0.45, tx + 0.45, tz - 0.45, tz + 0.45);
		const ids = [];
		[[-0.8, Math.PI / 2], [0.8, -Math.PI / 2]].forEach(([dx, h], i) => {
			const c = group(g, tx + dx, 0, tz, h);
			const cm = mat(COLS[i * 3], 0.6);
			add(c, rbox(0.34, 0.05, 0.34, 0.02), cm, 0, 0.3, 0);
			add(c, rbox(0.34, 0.32, 0.05, 0.02), cm, 0, 0.5, -0.15);
			for (const sx of [-0.14, 0.14]) for (const sz of [-0.14, 0.14]) add(c, new THREE.CylinderGeometry(0.02, 0.02, 0.3, 6), cm, sx, 0.15, sz, { cast: false });
			const id = "playChair" + i;
			k.spot({ id, x: tx + dx * 0.95, z: tz, h, y: -0.15 });
			ids.push(id);
			k.box(tx + dx - 0.2, tx + dx + 0.2, tz - 0.2, tz + 0.2);
		});
		k.interact("playroom:table", { label: "Sit at the little table", stand: [tx, tz + 1.0], sit: ids }, t);
	}

	// ---------------------------------------------------------------- the toy train, going round and round
	const train = [];
	{
		const tr = group(g, TRAIN.x, 0, TRAIN.z);
		const pts = [];
		for (let i = 0; i <= 64; i++) { const a = i / 64 * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * TRAIN.rx, 0.03, Math.sin(a) * TRAIN.rz)); }
		add(tr, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 128, 0.03, 6, true), mat("#8a5a3c", 0.6), 0, 0, 0, { cast: false });
		// a little station in the middle of the oval
		add(tr, rbox(0.6, 0.3, 0.4, 0.03), mat("#ff8fab", 0.6), 0, 0.15, 0);
		add(tr, new THREE.ConeGeometry(0.42, 0.25, 4), mat("#c77dff", 0.6), 0, 0.42, 0, { ry: Math.PI / 4 });
		for (let c = 0; c < 4; c++) {
			const car = group(tr, 0, 0, 0);
			add(car, rbox(0.3, 0.18, 0.18, 0.03), mat(COLS[c], 0.5), 0, 0.14, 0);
			if (c === 0) { add(car, new THREE.CylinderGeometry(0.05, 0.05, 0.14, 10), mat("#26232c", 0.5), 0.09, 0.28, 0, { cast: false }); add(car, rbox(0.12, 0.14, 0.18, 0.02), mat("#26232c", 0.5), -0.08, 0.3, 0, { cast: false }); }
			for (const sx of [-0.09, 0.09]) for (const sz of [-0.09, 0.09]) add(car, new THREE.CylinderGeometry(0.04, 0.04, 0.03, 10), mat("#26232c", 0.5), sx, 0.05, sz, { rx: Math.PI / 2, cast: false });
			train.push(car);
		}
		k.box(TRAIN.x - TRAIN.rx - 0.15, TRAIN.x + TRAIN.rx + 0.15, TRAIN.z - TRAIN.rz - 0.15, TRAIN.z + TRAIN.rz + 0.15);
		k.interact("playroom:train", {
			label: "Toot the toy train!", stand: [TRAIN.x, TRAIN.z - TRAIN.rz - 0.75], face: 0,
			use: () => { ctx.setShared("z:playroom:toot", Date.now()); ctx.doUpper("cheer", 1800); ctx.sfx("pop", 0.5); }
		}, tr);
	}

	// ---------------------------------------------------------------- teddy bears on a low shelf against the north wall
	{
		const sx0 = 11.6;
		const sh = group(g, sx0, 0, Z1 - 0.25, Math.PI);
		add(sh, rbox(3.2, 0.06, 0.4, 0.02), mat("#ffffff", 0.6), 0, 0.5, 0);
		add(sh, rbox(3.2, 0.06, 0.4, 0.02), mat("#ffffff", 0.6), 0, 1.0, 0);
		for (const sx of [-1.58, 1.58]) add(sh, new THREE.BoxGeometry(0.05, 1.0, 0.4), mat("#ffffff", 0.6), sx, 0.5, 0);
		const bear = (x, y, c) => {
			const b = group(sh, x, y, 0.02);
			const m = mat(c, 0.95);
			add(b, new THREE.SphereGeometry(0.13, 14, 10), m, 0, 0.13, 0);
			add(b, new THREE.SphereGeometry(0.1, 14, 10), m, 0, 0.32, 0.02);
			for (const ex of [-0.07, 0.07]) add(b, new THREE.SphereGeometry(0.04, 8, 6), m, ex, 0.41, 0.0, { cast: false });
			add(b, new THREE.SphereGeometry(0.04, 8, 6), mat("#f6e7cf", 0.9), 0, 0.3, 0.1, { cast: false });
		};
		[-1.1, -0.35, 0.4, 1.15].forEach((x, i) => bear(x, i % 2 ? 1.03 : 0.53, ["#c08552", "#f4a261", "#ffd6e0", "#a8dadc"][i]));
		k.box(sx0 - 1.65, sx0 + 1.65, Z1 - 0.48, Z1);
		k.interact("playroom:teddy", { label: "Hug a teddy bear", stand: [sx0 - 0.8, Z1 - 1.1], face: 0, use: use("heartarms", 2500) }, sh);
	}

	// ---------------------------------------------------------------- the rocking horse
	let horse = null;
	{
		const hx = 16.8, hz = Z0 + 1.6;
		horse = group(group(g, hx, 0, hz, -Math.PI / 2), 0, 0, 0);   // (the inner group rocks, nose to tail; the nose points west)
		const hm = mat("#f4efe6", 0.6), mane = mat("#c9a05a", 0.8);
		add(horse, new THREE.TorusGeometry(0.75, 0.035, 8, 24, Math.PI * 0.55), mat("#e63946", 0.5), 0, 0.78, 0.0, { rz: Math.PI + Math.PI * 0.225, ry: Math.PI / 2 });
		add(horse, rbox(0.25, 0.3, 0.75, 0.1), hm, 0, 0.62, 0);
		add(horse, rbox(0.2, 0.38, 0.22, 0.08), hm, 0, 0.88, 0.36, { rx: 0.35 });
		add(horse, rbox(0.17, 0.18, 0.3, 0.06), hm, 0, 1.06, 0.5);
		add(horse, rbox(0.06, 0.3, 0.3, 0.03), mane, 0, 0.98, 0.25, { rx: 0.35 });
		for (const sx of [-0.09, 0.09]) for (const sz of [-0.25, 0.25]) add(horse, new THREE.CylinderGeometry(0.035, 0.035, 0.35, 8), hm, sx, 0.33, sz, { rx: sz > 0 ? -0.25 : 0.25 });
		add(horse, rbox(0.3, 0.06, 0.32, 0.03), mat("#e63946", 0.7), 0, 0.79, -0.05);
		k.box(hx - 0.8, hx + 0.8, hz - 0.35, hz + 0.35);
		k.spot({ id: "rockingHorse", x: hx, z: hz, h: -Math.PI / 2, y: 0.32 });
		k.interact("playroom:horse", { label: "Ride the rocking horse", stand: [hx, hz + 1.0], sit: ["rockingHorse"] }, horse);
	}

	// ---------------------------------------------------------------- a chalkboard on the east wall
	{
		const cz = Z0 + 3.0;
		const cb = canvasTex(1024, 512, (c, w, h) => {
			c.fillStyle = "#2f3e36"; c.fillRect(0, 0, w, h);
			c.strokeStyle = "rgba(255,255,255,0.8)"; c.lineWidth = 6; c.lineCap = "round";
			c.font = "700 90px 'Caveat', cursive"; c.fillStyle = "rgba(255,255,255,0.85)"; c.fillText("Play together!", 240, 140);
			c.strokeStyle = "#ffd166"; c.beginPath(); c.arc(150, 360, 70, 0, Math.PI * 2); c.stroke();
			for (let i = 0; i < 8; i++) { c.beginPath(); const a = i / 8 * Math.PI * 2; c.moveTo(150 + Math.cos(a) * 90, 360 + Math.sin(a) * 90); c.lineTo(150 + Math.cos(a) * 120, 360 + Math.sin(a) * 120); c.stroke(); }
			c.strokeStyle = "#ff8fab"; c.beginPath(); c.moveTo(560, 420); c.bezierCurveTo(480, 330, 520, 250, 600, 300); c.bezierCurveTo(680, 250, 720, 330, 640, 420); c.closePath(); c.stroke();
			c.strokeStyle = "#4cc9f0"; c.strokeRect(780, 280, 160, 140); c.beginPath(); c.moveTo(760, 280); c.lineTo(860, 200); c.lineTo(960, 280); c.stroke();
		});
		const board = add(g, new THREE.PlaneGeometry(3.0, 1.5), mat("#ffffff", 0.95, 0, { map: cb }), X1 - 0.03, 1.5, cz, { ry: -Math.PI / 2, cast: false });
		add(g, new THREE.BoxGeometry(0.08, 0.06, 3.0), mat("#8a5a3c", 0.6), X1 - 0.06, 0.72, cz, { cast: false });
		k.interact("playroom:chalk", { label: "Doodle on the chalkboard", stand: [X1 - 0.9, cz], face: Math.PI / 2, use: use("wave", 2500) }, board);
	}

	// ---------------------------------------------------------------- a trampoline (step up onto it and bounce)
	let trampMat = null;
	{
		const tp = group(g, TRAMP.x, 0, TRAMP.z);
		add(tp, new THREE.TorusGeometry(TRAMP.r + 0.05, 0.06, 10, 40), mat("#4cc9f0", 0.5), 0, 0.3, 0, { rx: Math.PI / 2 });
		trampMat = add(tp, new THREE.CircleGeometry(TRAMP.r, 40), mat("#26232c", 0.8), 0, 0.29, 0, { rx: -Math.PI / 2, cast: false });
		trampMat.userData.floor = true;
		for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; add(tp, new THREE.CylinderGeometry(0.03, 0.03, 0.3, 8), mat("#26232c", 0.5), Math.cos(a) * (TRAMP.r + 0.05), 0.15, Math.sin(a) * (TRAMP.r + 0.05), { cast: false }); }
		k.interact("playroom:trampoline", { label: "Bounce on the trampoline", stand: [TRAMP.x, TRAMP.z], use: use("jump", 3000, "pop") }, tp);
	}

	// ---------------------------------------------------------------- the play tent (a teepee) in the north-east corner
	{
		const tp = group(g, TENT.x, 0, TENT.z, -Math.PI * 0.75);
		const canvasM = mat("#ffffff", 0.9, 0, { map: canvasTex(256, 256, (c, w, h) => { for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? "#fff4e6" : "#ff8fab"; c.fillRect(0, i * h / 8, w, h / 8 + 1); } }), side: THREE.DoubleSide });
		add(tp, new THREE.ConeGeometry(1.05, 2.2, 6, 1, true, Math.PI * 0.2, Math.PI * 1.6), canvasM, 0, 1.1, 0);   // (open at the front)
		for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; add(tp, new THREE.CylinderGeometry(0.02, 0.02, 2.7, 6), mat("#c9a05a", 0.6), Math.cos(a) * 0.55, 1.3, Math.sin(a) * 0.55, { rz: Math.cos(a) * 0.45, rx: -Math.sin(a) * 0.45, cast: false }); }
		add(tp, new THREE.CircleGeometry(0.95, 6), mat("#c77dff", 0.9), 0, 0.01, 0, { rx: -Math.PI / 2, cast: false });
		for (const sx of [-0.3, 0.3]) add(tp, new THREE.SphereGeometry(0.16, 12, 8), mat(sx < 0 ? "#ffd166" : "#06d6a0", 0.9), sx, 0.1, -0.3, { cast: false });   // (cushions)
		k.box(TENT.x - 1.0, X1, TENT.z - 1.0, Z1);
		const face = -Math.PI * 0.75;
		k.spot({ id: "playTent0", x: TENT.x - 0.05, z: TENT.z + 0.25, h: face, y: -0.3, low: true });
		k.spot({ id: "playTent1", x: TENT.x + 0.25, z: TENT.z - 0.05, h: face, y: -0.3, low: true });
		k.interact("playroom:tent", { label: "Crawl into the play tent", stand: [TENT.x - 1.4, TENT.z - 1.4], sit: ["playTent0", "playTent1"] }, tp);
	}

	// ---------------------------------------------------------------- photo frames, bunting, signs, the light switch
	// (two over the bean bags on the west wall, two either side of the teddies' shelf on the north wall)
	k.photo(88, X0 + 0.03, 1.85, Z0 + 1.6, Math.PI / 2, { w: 0.6, h: 0.45, frame: "#ffffff" });
	k.photo(89, X0 + 0.03, 1.85, Z0 + 3.4, Math.PI / 2, { w: 0.6, h: 0.45, frame: "#c9a05a", metal: 0.7 });
	k.photo(90, 9.3, 1.75, Z1 - 0.03, Math.PI, { w: 0.55, h: 0.7, frame: "#ffffff" });
	k.photo(91, 13.6, 1.75, Z1 - 0.03, Math.PI, { w: 0.6, h: 0.45, frame: "#c9a05a", metal: 0.7 });
	{
		const tri = new THREE.BufferGeometry();
		tri.setAttribute("position", new THREE.Float32BufferAttribute([-0.12, 0, 0, 0.12, 0, 0, 0, -0.22, 0], 3));
		tri.computeVertexNormals();
		for (const [a, b] of [[[X0 + 0.3, Z0 + 0.3], [X1 - 0.3, Z1 - 0.3]], [[X0 + 0.3, Z1 - 0.3], [X1 - 0.3, Z0 + 0.3]]]) {
			const n = 28;
			for (let i = 1; i < n; i++) {
				const u = i / n, x = a[0] + (b[0] - a[0]) * u, z = a[1] + (b[1] - a[1]) * u, y = H - 0.15 - Math.sin(u * Math.PI) * 0.5;
				const f = new THREE.Mesh(tri, new THREE.MeshStandardMaterial({ color: COLS[i % COLS.length], side: THREE.DoubleSide, roughness: 0.8 }));
				f.position.set(x, y, z); f.rotation.y = Math.atan2(b[0] - a[0], b[1] - a[1]) + Math.PI / 2;
				g.add(f);
			}
		}
		const st = tex.sign("Roof Deck", "star");
		add(g, new THREE.PlaneGeometry(0.9, 0.225), new THREE.MeshStandardMaterial({ map: st, roughness: 0.45, emissive: "#ffffff", emissiveMap: st, emissiveIntensity: 0.3 }), DM, 2.72, Z0 + 0.04, { cast: false });
	}
	k.lightSwitch(DOOR[1] + 0.45, 1.25, Z0 + 0.02, 0);

	// ---------------------------------------------------------------- light
	const starM = new THREE.MeshBasicMaterial({ color: "#fff6c8", toneMapped: false });
	for (let i = 0; i < 18; i++) add(g, new THREE.OctahedronGeometry(0.06, 0), starM, X0 + 0.8 + R() * (X1 - X0 - 1.6), H - 0.4 - R() * 0.4, Z0 + 0.8 + R() * (Z1 - Z0 - 1.6), { cast: false });
	k.light(PIT.x, 2.8, PIT.z, "#fff0d6", 4, 8);
	k.light(TRAIN.x, 2.8, TRAIN.z - 1.0, "#fff0d6", 4, 8);
	k.light(X0 + 3.0, 2.6, Z0 + 2.4, "#ffd9e8", 3, 7);
	k.light(X1 - 2.2, 2.6, Z0 + 3.0, "#d9f0ff", 3, 7);
	k.light(X1 - 1.6, 2.4, Z1 - 1.6, "#ffe0f0", 2, 5);
	const CX = (X0 + X1) / 2, CZ = (Z0 + Z1) / 2;
	k.key.pos.copy(k.V(CX, H - 0.15, CZ)); k.key.target.copy(k.V(CX, 0, CZ));
	k.key.angle = 1.35; k.key.intensity = 18; k.key.distance = 16; k.key.color.set("#fff4e6");
	k.fill.pos.copy(k.V(CX, 2.4, CZ)); k.fill.intensity = 5; k.fill.distance = 18;
	k.hemi = 0.55; k.env = 0.35; k.exposure = 1.05;

	let trainA = 0;
	function update(dt, t) {
		// the train runs round its oval (faster for a few seconds after someone toots it), the horse rocks while someone
		// rides it, the trampoline's mat bounces while someone's on it
		const toot = ctx.get("z:playroom:toot") || 0;
		trainA += dt * (Date.now() - toot < 4000 ? 2.0 : 0.6);
		train.forEach((car, i) => {
			const a = trainA - i * 0.24, x = Math.cos(a) * TRAIN.rx, z = Math.sin(a) * TRAIN.rz;
			car.position.set(x, 0, z);
			car.rotation.y = Math.atan2(-Math.sin(a) * TRAIN.rx, Math.cos(a) * TRAIN.rz) - Math.PI / 2;
		});
		const on = ctx.whoSits("rockingHorse");
		horse.rotation.x = on ? Math.sin(t * 3) * 0.12 : horse.rotation.x * 0.9;
		trampMat.position.y = 0.29 - Math.max(0, Math.sin(t * 6)) * 0.04;
	}
	return { update };
}
