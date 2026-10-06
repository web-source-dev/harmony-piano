/**
 * Harmony World — the Treehouse: up in three big old trees in the garden, with rope bridges between them and a
 * zipline from the tallest one right down into the pool.
 *
 * Local coordinates are the garden's (origin at world 14.3, -44.1); y is from the platforms (4.4 m up), so the lawn
 * is at y -4.4. The treehouse is drawn over the garden, but on the floor plan it sits 80 m further east
 * (ZONES.tree in worldHouse.js: vis), so up here and down there never mix; the ladder moves you across (k.portal).
 *
 *   T3 (west, x -6.2): a lookout deck with a hammock for two and a pair of binoculars
 *   T2 (middle, x 0.6): the big deck with the cabin (a bench for two inside, a lamp, a round window), and the ladder
 *     down to the lawn on its east side, between the bridge and the cabin (clear of the stepping stones). Climbing
 *     it is a little ride: hand over hand, a step at a time (treeLadderUp / treeLadderDown, ridePose "climb")
 *   T1 (east, x 8.8): the zipline: hold on to the handle, whizz down over the pool deck, let go over the water, splash
 *   the rope bridges join them along z 2.2; they sag (you walk down into the dip) and sway a little.
 *
 * The ladder and the zipline are seats that ride (like the Fun Park's): world.js tells ride() when that person got on
 * (who.sitT), asks ridePose(who) how to hold the body, and stands them up when it's over (spot.rideFor) at spot.side.
 */
const TR = [{ x: -6.2, z: 2.2 }, { x: 0.6, z: 2.2 }, { x: 8.8, z: 2.2 }];   // T3, T2, T1 (garden-local: trunks on the lawn)
// (big decks: room to walk round, sit, and look out from all three trees)
const DECK = [
	{ x0: -9.6, x1: -4.6, z0: -1.0, z1: 4.8 },     // T3: the lookout
	{ x0: -1.3, x1: 2.6, z0: -2.6, z1: 7.8 },      // T2 (the cabin is on its north half)
	{ x0: 7.3, x1: 11.8, z0: -1.8, z1: 4.4 }       // T1: the zipline (its frame on the north edge)
];
const BRIDGES = [{ x0: -4.6, x1: -1.3 }, { x0: 2.6, x1: 7.3 }];
const BZ0 = 1.75, BZ1 = 2.65, BSAG = 0.14;         // the bridges' width (z) and how far they dip in the middle
const CABIN = { x0: -1.0, x1: 2.4, z0: 3.4, z1: 7.6, door0: 0.3, door1: 1.2, h: 2.4, peak: 3.5 };
const LADDER = { x: 2.6, z0: 2.7, z1: 3.1 };       // on T2's east edge: the z of the boxes you step into at the top and the foot
const LX = 2.66, CLIMB_X = 2.96, LZ = 2.9;         // the ladder's rails (x), where your feet go on it (facing it, west), its middle (z)
const GROUND = -4.4, RUNGS = 14, RUNG = 4.4 / 14;  // the lawn, and the rungs (the 14th is the deck)
const LUP = { walk: 0.35, climb: 2.3, over: 0.55 }, LDN = { walk: 0.3, over: 0.45, climb: 2.2, off: 0.45 };
const UP_FOR = LUP.walk + LUP.climb + LUP.over, DN_FOR = LDN.walk + LDN.over + LDN.climb + LDN.off;
const UP_LAND = [1.75, LZ], DN_LAND = [3.65, LZ];  // where you end up (DN_LAND is on the lawn, garden-local)
// the zipline: from the frame on T1 to the pole on the pool deck (local; y from the platforms)
// (the garden is 20 m south of the pool deck now, across the lawn: the cable is long, and you let go 80% of the way down)
const ZA = [8.75, 2.85, 4.6], ZB = [2.5, -1.0, 37.1], ZSAG = 0.9;
// hand: hands -> feet when hanging (the "zip" pose); bar: the handle below the trolley on the cable
const ZIP = { hand: 2.0, bar: 0.56, step: 0.6, glide: 6.2, tRel: 0.8, fall: 0.7, bob: 1.0, drift: 0.8, waterY: -5.4, poolY: -5.7, surfY: -4.52 };
const ZIP_FOR = ZIP.step + ZIP.glide + ZIP.fall + ZIP.bob;
const TAU = Math.PI * 2;
const smooth = u => u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u);
const sagAt = (b, x) => BSAG * Math.sin(Math.PI * Math.min(1, Math.max(0, (x - b.x0) / (b.x1 - b.x0))));

export function build(k) {
	const { THREE, add, mat, group, rbox, g, ctx, canvasTex, rng } = k;
	const R = rng(1717);
	const Y = new THREE.Vector3(0, 1, 0);
	const VIS = k.V(0, 0, 0);          // where local (0, 0, 0) is drawn, in the world
	const W = p => k.W(p);             // local -> floor plan (world)
	// the bridges dip: walking across, you go down into the sag and up again
	k.floor((x, z) => { if (z > BZ0 - 0.05 && z < BZ1 + 0.05) for (const b of BRIDGES) if (x > b.x0 && x < b.x1) return -sagAt(b, x); return 0; });
	DECK.forEach(d => k.walk(d.x0, d.x1, d.z0, d.z1));
	// (the bridges reach well onto the decks, so there's no seam to get stuck on)
	k.walk(BRIDGES[0].x0 - 0.6, BRIDGES[0].x1 + 0.6, BZ0, BZ1);
	k.walk(BRIDGES[1].x0 - 0.6, BRIDGES[1].x1 + 0.6, BZ0, BZ1);
	// (the camera stays under the canopies: up in the leaves you'd see nothing)
	k.cam = { minX: -12.5, maxX: 14.0, minZ: -6.5, maxZ: 10.0, maxY: 3.4, minY: -4.2 };

	// ---------------------------------------------------------------- the ladder: lawn <-> T2's deck
	// step into the box at its foot (on the lawn, just east of it) and you climb up; walk to the deck's edge at the top
	// and you climb down. Each is a ride (the spots below): r.climb. (The dx are for walkTo's routing across floors:
	// each lands outside the other box. The cabin's south wall is just north, so the top is only reachable at z < 3.04)
	k.portal(true, 3.1, 3.4, LADDER.z0, LADDER.z1, -1.45).climb = "treeLadderUp";
	k.portal(false, 2.05, 2.2, LADDER.z0, LADDER.z1, 1.45).climb = "treeLadderDown";

	// ---------------------------------------------------------------- materials and textures
	const glow = c => new THREE.MeshBasicMaterial({ color: c, toneMapped: false });
	const planks = canvasTex(256, 256, (c, w, h) => {
		const r = rng(9);
		for (let i = 0; i < 8; i++) {
			const t = 110 + r() * 35;
			c.fillStyle = `rgb(${t + 30 | 0},${t * 0.72 | 0},${t * 0.45 | 0})`; c.fillRect(0, i * h / 8, w, h / 8);
			c.fillStyle = "rgba(30,15,5,.55)"; c.fillRect(0, i * h / 8, w, 2);
			for (let n = 0; n < 3; n++) { c.fillStyle = "rgba(30,15,5,.6)"; c.beginPath(); c.arc(r() * w, i * h / 8 + 4 + r() * (h / 8 - 8), 1.5, 0, TAU); c.fill(); }
			for (let n = 0; n < 30; n++) { c.fillStyle = `rgba(40,20,8,${r() * 0.15})`; c.fillRect(r() * w, i * h / 8 + r() * h / 8, 12 + r() * 40, 1); }
		}
	});
	const bark = canvasTex(256, 512, (c, w, h) => {
		c.fillStyle = "#4a3324"; c.fillRect(0, 0, w, h);
		const r = rng(21);
		for (let i = 0; i < 260; i++) {
			const x = r() * w, y = r() * h, l = 20 + r() * 90;
			c.strokeStyle = r() < 0.5 ? "rgba(25,15,8,.55)" : "rgba(120,90,60,.35)"; c.lineWidth = 1 + r() * 3;
			c.beginPath(); c.moveTo(x, y); c.bezierCurveTo(x + (r() - 0.5) * 8, y + l / 3, x + (r() - 0.5) * 8, y + l * 2 / 3, x + (r() - 0.5) * 6, y + l); c.stroke();
		}
	}, 1, 2);
	const deckM = mat("#ffffff", 0.8, 0, { map: planks });
	const barkM = mat("#ffffff", 0.95, 0, { map: bark });
	const woodM = mat("#7a5232", 0.8), darkWood = mat("#4e3220", 0.85);
	const ropeM = mat("#c8a66b", 0.95);
	const leafCols = ["#2f6b34", "#3c7d3d", "#285e2e", "#4a8c44", "#356f3a"];

	// ---------------------------------------------------------------- the trees: gnarled trunks, branches, big canopies
	const canopies = [], leafFade = [];
	const sparkles = [];   // fairy lights in the leaves (instanced, twinkling)
	function bigTree(t, i) {
		const tg = group(g, t.x, 0, t.z);
		// the trunk, from the lawn up into the canopy, lumpy and twisting
		const base = i === 1 ? 4.1 : 3.6;
		const H = 4.4 + base + 0.4, geo = new THREE.CylinderGeometry(0.27, 0.42, H, 16, 16);
		const p = geo.attributes.position, v = new THREE.Vector3();
		for (let n = 0; n < p.count; n++) {
			v.fromBufferAttribute(p, n);
			const a = Math.atan2(v.z, v.x), yy = v.y + H / 2;
			const s = 1 + 0.13 * Math.sin(3 * a + yy * 1.7 + i) + 0.06 * Math.sin(7 * a - yy * 3.1) + (yy < 0.6 ? (0.6 - yy) * 0.5 : 0);
			p.setXYZ(n, v.x * s + Math.sin(yy * 0.7 + i) * 0.08, v.y, v.z * s + Math.cos(yy * 0.6 + i * 2) * 0.06);
		}
		geo.computeVertexNormals();
		add(tg, geo, barkM, 0, -4.4 + H / 2, 0);
		// roots spreading over the lawn
		for (let r = 0; r < 5; r++) {
			const a = r / 5 * TAU + i;
			add(tg, new THREE.ConeGeometry(0.16, 1.1, 8), barkM, Math.cos(a) * 0.45, -4.3, Math.sin(a) * 0.45, { rz: Math.cos(a) * 1.25, rx: -Math.sin(a) * 1.25, cast: false });
		}
		// struts holding the deck up
		const d = DECK[i];
		for (const [cx, cz] of [[d.x0 + 0.25, d.z0 + 0.25], [d.x1 - 0.25, d.z0 + 0.25], [d.x0 + 0.25, d.z1 - 0.25], [d.x1 - 0.25, d.z1 - 0.25]]) {
			const a = new THREE.Vector3(0, -1.6, 0), b = new THREE.Vector3(cx - t.x, -0.16, cz - t.z);
			const len = a.distanceTo(b), m = add(tg, new THREE.CylinderGeometry(0.06, 0.08, len, 8), darkWood, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2, { cast: false });
			m.quaternion.setFromUnitVectors(Y, b.clone().sub(a).normalize());
		}
		// branches up into the canopy, and the canopy itself (it sways)
		const crown = group(tg, 0, base, 0);
		for (let b = 0; b < 5; b++) {
			const a = b / 5 * TAU + i * 0.7, r0 = new THREE.Vector3(0, base - 1.4, 0), r1 = new THREE.Vector3(Math.cos(a) * 1.9, base + 0.9, Math.sin(a) * 1.9);
			const len = r0.distanceTo(r1), m = add(tg, new THREE.CylinderGeometry(0.07, 0.14, len, 8), barkM, (r0.x + r1.x) / 2, (r0.y + r1.y) / 2, (r0.z + r1.z) / 2, { cast: false });
			m.quaternion.setFromUnitVectors(Y, r1.clone().sub(r0).normalize());
		}
		const n = 16, pts = [];
		for (let c = 0; c < n; c++) {
			const a = c / n * TAU * 1.7 + R(), rr = c < 3 ? R() * 0.6 : 1.2 + R() * 1.4, y = 0.9 + R() * 1.6 - (rr > 2 ? 0.3 : 0);
			const s = 0.95 + R() * 0.65;
			// (each blob its own material: it fades out while the camera is inside it, so you never look out from in the leaves)
			const bm = mat(leafCols[c % leafCols.length], 0.85, 0, { transparent: true, opacity: 1 });
			const blob = add(crown, new THREE.IcosahedronGeometry(s, 1), bm, Math.cos(a) * rr, y, Math.sin(a) * rr, { cast: c < 5 });
			blob.scale.set(1, 0.78, 1);
			leafFade.push({ m: bm, c: new THREE.Vector3(VIS.x + t.x + Math.cos(a) * rr, VIS.y + base + y, VIS.z + t.z + Math.sin(a) * rr), r: s * 1.05 + 0.35 });
			pts.push([Math.cos(a) * rr, y, Math.sin(a) * rr, s]);
		}
		canopies.push(crown);
		// fairy lights twinkling in the leaves
		const fl = new THREE.InstancedMesh(new THREE.SphereGeometry(0.045, 6, 4), glow("#ffffff"), 46);
		const o = new THREE.Object3D(), col = new THREE.Color();
		for (let f = 0; f < 46; f++) {
			const q = pts[f % pts.length], a = R() * TAU, e = (R() - 0.3) * 1.2;
			o.position.set(q[0] + Math.cos(a) * Math.cos(e) * q[3] * 1.02, q[1] + Math.sin(e) * q[3] * 0.8 - 0.1, q[2] + Math.sin(a) * Math.cos(e) * q[3] * 1.02);
			o.updateMatrix(); fl.setMatrixAt(f, o.matrix); fl.setColorAt(f, col.set("#ffd59a"));
		}
		fl.castShadow = false; fl.frustumCulled = false;
		crown.add(fl);
		sparkles.push(fl);
		return tg;
	}
	TR.forEach((t, i) => bigTree(t, i));

	// ---------------------------------------------------------------- the decks, with rope railings
	DECK.forEach((d, i) => {
		const w = d.x1 - d.x0, l = d.z1 - d.z0;
		const pl = planks.clone(); pl.repeat.set(w / 1.6, l / 1.6); pl.needsUpdate = true;
		const top = add(g, new THREE.BoxGeometry(w, 0.16, l), mat("#ffffff", 0.8, 0, { map: pl }), (d.x0 + d.x1) / 2, -0.08, (d.z0 + d.z1) / 2);
		top.userData.floor = true;
		// a beam round the edge
		for (const z of [d.z0, d.z1]) add(g, new THREE.BoxGeometry(w + 0.1, 0.22, 0.1), darkWood, (d.x0 + d.x1) / 2, -0.2, z, { cast: false });
		for (const x of [d.x0, d.x1]) add(g, new THREE.BoxGeometry(0.1, 0.22, l), darkWood, x, -0.2, (d.z0 + d.z1) / 2, { cast: false });
		// (each trunk goes up through its deck: you can't walk through it, nor can the camera)
		k.box(TR[i].x - 0.45, TR[i].x + 0.45, TR[i].z - 0.45, TR[i].z + 0.45);
		k.camWall(TR[i].x - 0.3, TR[i].x + 0.3, TR[i].z - 0.3, TR[i].z + 0.3, -4.4, i === 1 ? 4.1 : 3.6);
	});
	const lightPts = [];   // where the fairy lights along the rails go
	function rail(x0, z0, x1, z1) {
		const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(len / 0.75));
		for (let i = 0; i <= n; i++) {
			const u = i / n, x = x0 + (x1 - x0) * u, z = z0 + (z1 - z0) * u;
			add(g, new THREE.CylinderGeometry(0.045, 0.05, 1.05, 8), woodM, x, 0.52, z, { cast: false });
			add(g, new THREE.SphereGeometry(0.06, 8, 6), darkWood, x, 1.06, z, { cast: false });
		}
		for (const y of [0.98, 0.55]) {
			const pts = [];
			for (let i = 0; i <= n * 4; i++) { const u = i / (n * 4); pts.push(new THREE.Vector3(x0 + (x1 - x0) * u, y - Math.abs(Math.sin(u * n * Math.PI)) * 0.06, z0 + (z1 - z0) * u)); }
			add(g, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), n * 6, 0.022, 5, false), ropeM, 0, 0, 0, { cast: false });
			if (y > 0.9) for (let i = 0; i < n * 3; i++) lightPts.push(pts[Math.min(pts.length - 1, Math.round(i * 4 / 3))].clone().add(new THREE.Vector3(0, -0.04, 0)));
		}
	}
	// T3 (open to the bridge on its east side)
	{ const d = DECK[0]; rail(d.x0, d.z0, d.x1, d.z0); rail(d.x0, d.z1, d.x1, d.z1); rail(d.x0, d.z0, d.x0, d.z1); rail(d.x1, d.z0, d.x1, BZ0 - 0.05); rail(d.x1, BZ1 + 0.05, d.x1, d.z1); }
	// T2 (the bridges on both sides, the ladder on the west, the cabin along the north)
	{
		const d = DECK[1];
		rail(d.x0, d.z0, d.x1, d.z0);
		rail(d.x0, d.z0, d.x0, BZ0 - 0.05); rail(d.x0, BZ1 + 0.05, d.x0, CABIN.z0);
		rail(d.x1, d.z0, d.x1, BZ0 - 0.05); rail(d.x1, LADDER.z1 + 0.1, d.x1, d.z1);
	}
	// T1 (the bridge on its west side; the zipline frame on its north edge)
	{ const d = DECK[2]; rail(d.x0, d.z0, d.x1, d.z0); rail(d.x1, d.z0, d.x1, d.z1); rail(d.x0, d.z0, d.x0, BZ0 - 0.05); rail(d.x0, BZ1 + 0.05, d.x0, d.z1); rail(d.x0, d.z1, 8.05, d.z1); rail(9.45, d.z1, d.x1, d.z1); }

	// ---------------------------------------------------------------- the rope bridges
	const bridgeG = [];
	BRIDGES.forEach((b, bi) => {
		const bg = group(g, 0, 0, (BZ0 + BZ1) / 2);
		const len = b.x1 - b.x0, n = Math.round(len / 0.21);
		const plankM = mat("#8a5e3a", 0.85);
		for (let i = 0; i < n; i++) {
			const x = b.x0 + (i + 0.5) * len / n, y = -sagAt(b, x);
			const pk = add(bg, new THREE.BoxGeometry(len / n - 0.035, 0.05, BZ1 - BZ0 - (i % 3 === 1 ? 0.06 : 0)), plankM, x, y - 0.025, (i % 2 ? 0.02 : -0.02), { ry: (R() - 0.5) * 0.05, cast: false });
			pk.userData.floor = true;
		}
		// the ropes under the planks, the handrails, and the netting between
		for (const sz of [-1, 1]) {
			const zz = sz * (BZ1 - BZ0) / 2 + sz * 0.03;
			const lo = [], hi = [];
			for (let i = 0; i <= 24; i++) {
				const x = b.x0 + len * i / 24, s = sagAt(b, x);
				lo.push(new THREE.Vector3(x, -s - 0.05, zz));
				hi.push(new THREE.Vector3(x, 1.0 - s * 0.55, zz + sz * 0.03));
			}
			add(bg, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(lo), 40, 0.025, 5, false), ropeM, 0, 0, 0, { cast: false });
			add(bg, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(hi), 40, 0.03, 6, false), ropeM, 0, 0, 0, { cast: false });
			const seg = [];
			for (let i = 1; i < 24; i += 2) { seg.push(lo[i].x, lo[i].y, lo[i].z, hi[i].x, hi[i].y, hi[i].z); }
			const lg = new THREE.BufferGeometry(); lg.setAttribute("position", new THREE.Float32BufferAttribute(seg, 3));
			bg.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: "#b8955e" })));
			for (let i = 1; i < 24; i += 2) lightPts.push(hi[i].clone().add(new THREE.Vector3(0, -0.04, (BZ0 + BZ1) / 2)));
		}
		bridgeG.push(bg);
	});

	// ---------------------------------------------------------------- the cabin on T2
	{
		const C = CABIN, cg = group(g, 0, 0, 0);
		const wallTex = planks.clone(); wallTex.repeat.set(2, 1.4); wallTex.needsUpdate = true;
		const wallM = mat("#d9b28a", 0.85, 0, { map: wallTex });
		const roofM = mat("#a2403a", 0.8);
		const cx = (C.x0 + C.x1) / 2, cz = (C.z0 + C.z1) / 2, w = C.x1 - C.x0, l = C.z1 - C.z0;
		// walls (the door in the south wall)
		add(cg, new THREE.BoxGeometry(C.door0 - C.x0, C.h, 0.1), wallM, (C.x0 + C.door0) / 2, C.h / 2, C.z0);
		add(cg, new THREE.BoxGeometry(C.x1 - C.door1, C.h, 0.1), wallM, (C.door1 + C.x1) / 2, C.h / 2, C.z0);
		add(cg, new THREE.BoxGeometry(C.door1 - C.door0, C.h - 1.85, 0.1), wallM, (C.door0 + C.door1) / 2, 1.85 + (C.h - 1.85) / 2, C.z0);
		add(cg, new THREE.BoxGeometry(w, C.h, 0.1), wallM, cx, C.h / 2, C.z1 - 0.05);
		for (const x of [C.x0, C.x1]) {
			add(cg, new THREE.BoxGeometry(0.1, C.h, l), wallM, x, C.h / 2, cz);
			// the gable ends are the long walls' tops: the roof runs along x
		}
		// the gables (east and west) up to the peak
		const gable = new THREE.Shape();
		gable.moveTo(-l / 2, 0); gable.lineTo(l / 2, 0); gable.lineTo(0, C.peak - C.h); gable.closePath();
		for (const x of [C.x0, C.x1]) add(cg, new THREE.ShapeGeometry(gable), mat("#d9b28a", 0.85, 0, { map: wallTex, side: THREE.DoubleSide }), x, C.h, cz, { ry: Math.PI / 2 });
		// the roof: two slopes, a ridge, a little overhang
		const slope = Math.atan2(C.peak - C.h, l / 2), sl = Math.hypot(C.peak - C.h, l / 2) + 0.35;
		for (const s of [-1, 1]) {
			const r = add(cg, new THREE.BoxGeometry(w + 0.5, 0.08, sl), roofM, cx, C.h + (C.peak - C.h) / 2 + 0.05, cz + s * (l / 4 + 0.08));
			r.rotation.x = s * slope;
		}
		add(cg, new THREE.CylinderGeometry(0.06, 0.06, w + 0.55, 8), darkWood, cx, C.peak + 0.07, cz, { rz: Math.PI / 2, cast: false });
		// round windows in the gables, glowing warm
		const winGlow = new THREE.MeshStandardMaterial({ color: "#ffe2a8", emissive: "#ffb35a", emissiveIntensity: 1.6 });
		for (const s of [-1, 1]) {
			add(cg, new THREE.CircleGeometry(0.32, 24), winGlow, s > 0 ? C.x1 + 0.055 : C.x0 - 0.055, 1.35, cz, { ry: s * Math.PI / 2, cast: false });
			add(cg, new THREE.TorusGeometry(0.33, 0.04, 6, 24), darkWood, s > 0 ? C.x1 + 0.06 : C.x0 - 0.06, 1.35, cz, { ry: Math.PI / 2, cast: false });
			add(cg, new THREE.BoxGeometry(0.02, 0.64, 0.03), darkWood, s > 0 ? C.x1 + 0.07 : C.x0 - 0.07, 1.35, cz, { cast: false });
		}
		// a door frame and a heart over it, a lantern by the door
		add(cg, new THREE.BoxGeometry(C.door1 - C.door0 + 0.12, 0.08, 0.14), darkWood, (C.door0 + C.door1) / 2, 1.88, C.z0, { cast: false });
		const heart = add(cg, new THREE.ExtrudeGeometry(k.heartShape(0.14), { depth: 0.03, bevelEnabled: false }), new THREE.MeshStandardMaterial({ color: "#ff8fab", emissive: "#ff4d6d", emissiveIntensity: 1.4 }), (C.door0 + C.door1) / 2, 2.0, C.z0 - 0.07, { cast: false });
		heart.geometry.center(); heart.rotation.z = Math.PI;
		var doorLantern = add(cg, new THREE.SphereGeometry(0.09, 12, 8), glow("#ffcf6e"), C.door1 + 0.2, 1.75, C.z0 - 0.16, { cast: false });
		// inside: a rug, a bench for two with cushions, a hanging lamp, a little shelf with books
		add(cg, new THREE.CircleGeometry(0.9, 24), mat("#c77dff", 0.95), cx, 0.006, cz - 0.1, { rx: -Math.PI / 2, cast: false }).userData.floor = true;
		add(cg, rbox(1.6, 0.42, 0.55, 0.04), woodM, 0.7, 0.21, C.z1 - 0.45);
		add(cg, rbox(1.6, 0.1, 0.55, 0.04), mat("#e9b4c8", 0.9), 0.7, 0.47, C.z1 - 0.45);
		for (const [x, c] of [[0.2, "#ffd166"], [0.7, "#ffffff"], [1.2, "#9fb4d8"]]) add(cg, rbox(0.42, 0.36, 0.12, 0.06), mat(c, 0.9), x, 0.72, C.z1 - 0.66, { rx: -0.25, cast: false });
		add(cg, new THREE.CylinderGeometry(0.005, 0.005, 0.5, 4), mat("#333333"), cx, C.h - 0.05, cz, { cast: false });
		var cabinLamp = add(cg, new THREE.SphereGeometry(0.13, 14, 10), new THREE.MeshStandardMaterial({ color: "#fff1d6", emissive: "#ffb35a", emissiveIntensity: 2.4 }), cx, C.h - 0.38, cz, { cast: false });
		add(cg, rbox(0.6, 0.05, 0.22, 0.02), woodM, C.x0 + 0.45, 1.2, C.z1 - 0.2, { cast: false });
		for (let i = 0; i < 5; i++) add(cg, new THREE.BoxGeometry(0.05, 0.18 + (i % 2) * 0.04, 0.14), mat(["#7b2d3b", "#2f3e5c", "#e9c46a", "#2a9d8f", "#e76f51"][i], 0.7), C.x0 + 0.25 + i * 0.07, 1.32, C.z1 - 0.2, { cast: false });
		// a flag on the roof
		add(cg, new THREE.CylinderGeometry(0.02, 0.02, 1.0, 6), darkWood, C.x1 - 0.2, C.peak + 0.45, cz, { cast: false });
		var cabinFlag = add(cg, new THREE.PlaneGeometry(0.55, 0.32), mat("#ff4d6d", 0.8, 0, { side: THREE.DoubleSide }), C.x1 + 0.08, C.peak + 0.8, cz, { cast: false });
		// the walls block walking and the camera (the door's the way in); the roof and the wall over the door too
		k.wall(C.x0 - 0.06, C.door0, C.z0 - 0.08, C.z0 + 0.08, 0, C.h);
		k.wall(C.door1, C.x1 + 0.06, C.z0 - 0.08, C.z0 + 0.08, 0, C.h);
		k.camWall(C.door0, C.door1, C.z0 - 0.08, C.z0 + 0.08, 1.85, C.h);
		k.wall(C.x0 - 0.06, C.x0 + 0.08, C.z0, C.z1, 0, C.h);
		k.wall(C.x1 - 0.08, C.x1 + 0.06, C.z0, C.z1, 0, C.h);
		k.camWall(C.x0, C.x1, C.z1 - 0.12, C.z1 + 0.05, 0, C.h);
		k.camWall(C.x0 - 0.3, C.x1 + 0.3, C.z0 - 0.3, C.z1 + 0.3, C.h, C.peak + 0.15);
		k.box(-0.15, 1.55, C.z1 - 0.75, C.z1);
		k.spot({ id: "treeCabin0", x: 0.35, z: C.z1 - 0.62, h: Math.PI, y: 0.04 });
		k.spot({ id: "treeCabin1", x: 1.05, z: C.z1 - 0.62, h: Math.PI, y: 0.04 });
		k.interact("tree:cabin", { label: "Cuddle up in the treehouse", stand: [0.7, C.z1 - 1.4], sit: ["treeCabin0", "treeCabin1"] }, cg);
	}

	// ---------------------------------------------------------------- T3: a hammock for two, binoculars, bunting
	let hammock = null;   // (it rocks in update(): declared out here so update can reach it)
	{
		const d = DECK[0], hz = d.z1 - 0.55, hxA = -7.5, hxB = -4.9;
		for (const x of [hxA, hxB]) add(g, new THREE.CylinderGeometry(0.06, 0.07, 1.5, 8), darkWood, x, 0.75, hz);
		// the cloth: hangs from the post tops (1.3) down to 0.5 in the middle, curling up a little at its sides
		const hx0 = hxA, hl = hxB - hxA;
		const cloth = new THREE.PlaneGeometry(1, 1, 20, 6), cp = cloth.attributes.position;
		for (let n = 0; n < cp.count; n++) {
			const u = cp.getX(n) + 0.5, v = cp.getY(n);           // u along, v across (-0.5..0.5)
			const sag = Math.sin(u * Math.PI), wide = 0.15 + 0.85 * Math.pow(sag, 0.6);
			cp.setXYZ(n, hx0 + hl * u, 1.3 - sag * 0.8 + (v * v) * 0.6 * wide, v * 0.9 * wide);
		}
		cloth.computeVertexNormals();
		const net = new THREE.Mesh(cloth, mat("#f2cc8f", 0.95, 0, { side: THREE.DoubleSide }));
		hammock = group(g, 0, 0, hz);
		hammock.add(net);
		for (const x of [hx0, hx0 + hl]) add(g, new THREE.SphereGeometry(0.05, 8, 6), ropeM, x, 1.3, hz, { cast: false });
		k.box(hxA - 0.1, hxB + 0.1, hz - 0.35, d.z1);
		k.spot({ id: "treeHammock0", x: -6.75, z: hz - 0.05, h: Math.PI, y: 0.12, recline: true, hands: true });
		k.spot({ id: "treeHammock1", x: -5.65, z: hz - 0.05, h: Math.PI, y: 0.12, recline: true, hands: true });
		k.interact("tree:hammock", { label: "Swing in the hammock", stand: [-6.2, hz - 1.0], sit: ["treeHammock0", "treeHammock1"] }, net);
		// binoculars on a post at the south-west corner, looking out over the garden
		const bn = group(g, d.x0 + 0.35, 0, d.z0 + 0.35);
		add(bn, new THREE.CylinderGeometry(0.04, 0.05, 1.1, 8), mat("#3e3a3a", 0.5, 0.5), 0, 0.55, 0);
		for (const s of [-0.06, 0.06]) add(bn, new THREE.CylinderGeometry(0.04, 0.05, 0.22, 10), mat("#2b2d42", 0.4, 0.6), s, 1.18, 0.02, { rx: Math.PI / 2 - 0.2, cast: false });
	}
	// bunting between the trees' canopies
	{
		const flagCols = ["#ff4d6d", "#ffd166", "#06d6a0", "#4cc9f0", "#c77dff"];
		const tri = new THREE.BufferGeometry();
		tri.setAttribute("position", new THREE.Float32BufferAttribute([-0.12, 0, 0, 0.12, 0, 0, 0, -0.26, 0], 3));
		tri.computeVertexNormals();
		for (const [a, b] of [[TR[0], TR[1]], [TR[1], TR[2]]]) {
			const pts = [];
			for (let i = 0; i <= 20; i++) { const u = i / 20; pts.push(new THREE.Vector3(a.x + (b.x - a.x) * u, 2.6 - Math.sin(u * Math.PI) * 0.5, a.z - 0.9)); }
			add(g, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 30, 0.008, 4, false), mat("#eeeeee"), 0, 0, 0, { cast: false });
			for (let i = 1; i < 20; i++) add(g, tri, mat(flagCols[i % flagCols.length], 0.8, 0, { side: THREE.DoubleSide }), pts[i].x, pts[i].y, pts[i].z, { cast: false });
		}
	}

	// ---------------------------------------------------------------- the ladder (lawn up to T2)
	const LW = 0.5;
	const ladder = group(g, LX, 0, 0);
	{
		for (const z of [LZ - LW / 2, LZ + LW / 2]) add(ladder, new THREE.CylinderGeometry(0.035, 0.04, 5.5, 8), woodM, 0, GROUND + 2.75, z);
		for (let i = 1; i <= RUNGS + 2; i++) add(ladder, new THREE.CylinderGeometry(0.025, 0.025, LW, 6), woodM, 0, GROUND + i * RUNG, LZ, { rx: Math.PI / 2, cast: false });
		// a strip at the top of the ladder, and a sign at the bottom
		add(g, new THREE.BoxGeometry(0.4, 0.03, LW + 0.08), darkWood, LADDER.x - 0.2, 0.012, LZ, { cast: false });
		const sign = new THREE.MeshBasicMaterial({ map: k.tex.text("Treehouse", { w: 512, h: 128, color: "#ffe9a8", glow: "#ff9e4a", font: "800 90px 'Caveat', 'Nunito', cursive" }), transparent: true, depthWrite: false, toneMapped: false });
		add(ladder, new THREE.BoxGeometry(0.04, 0.32, 0.8), woodM, 0.06, -4.4 + 1.6, LZ, { cast: false });
		add(ladder, new THREE.PlaneGeometry(0.76, 0.2), sign, 0.085, -4.4 + 1.6, LZ, { ry: Math.PI / 2, cast: false, receive: false });
	}
	// (the foot of the ladder is on the lawn: these stands answer in world coordinates)
	const lawnAt = (x, z) => [VIS.x + x, VIS.z + z];
	k.interact("tree:up", {
		label: "Climb up to the treehouse",
		get stand() { return lawnAt(3.75, LZ); },
		use: () => { if (!ladderFree()) { ctx.notice("Someone's on the ladder - wait a moment!"); return; } ctx.sitOn(["treeLadderUp"]); }
	}, ladder);
	k.interact("tree:down", {
		label: "Climb down the ladder", stand: [1.75, LZ], reach: 1.6,
		use: () => { if (!ladderFree()) { ctx.notice("Someone's on the ladder - wait a moment!"); return; } ctx.sitOn(["treeLadderDown"]); }
	});
	// (one at a time on the ladder)
	const ladderFree = () => { const m = ctx.me().sit; return !["treeLadderUp", "treeLadderDown"].some(id => ctx.whoSits(id) || (m === id)); };
	// where you are on the ladder after e seconds (local), which way you face, and how you hold yourself
	const LP = { h: 0, pose: "climb" };
	const rungY = s => { const n = Math.min(RUNGS, Math.floor(s)), f = s - n; return GROUND + (n + smooth(Math.min(1, f * 1.6))) * RUNG; };   // (a little pause on each rung)
	function ladderUp(e, pos) {
		LP.h = -Math.PI / 2;
		if (e < LUP.walk) { pos.set(CLIMB_X + 0.35 * (1 - e / LUP.walk), GROUND, LZ); LP.pose = "walk"; return LP; }
		e -= LUP.walk;
		if (e < LUP.climb) { pos.set(CLIMB_X, rungY(e / LUP.climb * RUNGS), LZ); LP.pose = "climb"; return LP; }
		e -= LUP.climb;
		// over the top and onto the deck
		const w = smooth(Math.min(1, e / LUP.over));
		pos.set(CLIMB_X + (UP_LAND[0] - CLIMB_X) * w, Math.sin(w * Math.PI) * 0.05, LZ);
		LP.pose = "walk";
		return LP;
	}
	function ladderDown(e, pos) {
		if (e < LDN.walk) { pos.set(2.1 + 0.25 * e / LDN.walk, 0, LZ); LP.h = Math.PI / 2; LP.pose = "walk"; return LP; }
		e -= LDN.walk;
		// turn round to face the ladder and step down onto it
		if (e < LDN.over) { const w = smooth(e / LDN.over); pos.set(2.35 + (CLIMB_X - 2.35) * w, -Math.sin(w * Math.PI) * 0.06, LZ); LP.h = Math.PI / 2 - Math.PI * w; LP.pose = "climb"; return LP; }
		e -= LDN.over;
		if (e < LDN.climb) { pos.set(CLIMB_X, rungY(RUNGS * (1 - e / LDN.climb)), LZ); LP.h = -Math.PI / 2; LP.pose = "climb"; return LP; }
		e -= LDN.climb;
		// off the bottom rung, turn round, a step out onto the lawn
		const w = Math.min(1, e / LDN.off);
		pos.set(CLIMB_X + (DN_LAND[0] - CLIMB_X) * smooth(w), GROUND, LZ);
		LP.h = -Math.PI / 2 + Math.PI * smooth(Math.min(1, w * 2));
		LP.pose = "walk";
		return LP;
	}
	const since = (who, id) => (Date.now() - (who && who.sitT ? who.sitT : Date.now())) / 1000;
	const _lp = new THREE.Vector3();
	k.spot({ id: "treeLadderUp", x: UP_LAND[0], z: UP_LAND[1], side: UP_LAND, y: 0, h: -Math.PI / 2, rideFor: UP_FOR,
		ride: (pos, quat, who) => { const L = ladderUp(since(who), _lp); pos.copy(_lp).add(VIS); quat.setFromAxisAngle(Y, L.h); },
		ridePose: who => who ? ladderUp(since(who), _lp).pose : "climb" });
	// (the bottom of the ladder is on the lawn: in the garden's floor plan, 80 m west of ours)
	k.spot({ id: "treeLadderDown", x: DN_LAND[0] - 80, z: DN_LAND[1], side: [DN_LAND[0] - 80, DN_LAND[1]], y: GROUND, h: Math.PI / 2, rideFor: DN_FOR,
		ride: (pos, quat, who) => { const L = ladderDown(since(who), _lp); pos.copy(_lp).add(VIS); quat.setFromAxisAngle(Y, L.h); },
		ridePose: who => who ? ladderDown(since(who), _lp).pose : "climb" });

	// ---------------------------------------------------------------- hanging lanterns, fairy lights along the rails, fireflies
	const lanterns = [];
	{
		const lm = new THREE.MeshStandardMaterial({ color: "#fff1d6", emissive: "#ffb35a", emissiveIntensity: 2.2 });
		for (const [x, z] of [[-7.6, 0.8], [-4.8, 3.6], [-1.1, 0.2], [2.4, 0.2], [7.5, 0.8], [10.0, 0.8], [-3.0, 2.2], [5.0, 2.2]]) {
			const lg = group(g, x, 3.1, z);
			add(lg, new THREE.CylinderGeometry(0.004, 0.004, 1.3, 4), mat("#333333"), 0, -0.65, 0, { cast: false });
			add(lg, new THREE.CylinderGeometry(0.07, 0.09, 0.16, 8), lm, 0, -1.36, 0, { cast: false });
			add(lg, new THREE.ConeGeometry(0.1, 0.08, 8), darkWood, 0, -1.25, 0, { cast: false });
			lg.userData.ph = R() * 6;
			lanterns.push(lg);
		}
	}
	const railLights = new THREE.InstancedMesh(new THREE.SphereGeometry(0.03, 6, 4), glow("#ffffff"), lightPts.length);
	{
		const o = new THREE.Object3D(), c = new THREE.Color();
		lightPts.forEach((p, i) => { o.position.copy(p); o.updateMatrix(); railLights.setMatrixAt(i, o.matrix); railLights.setColorAt(i, c.set("#ffd59a")); });
		railLights.castShadow = false; railLights.frustumCulled = false;
		g.add(railLights);
	}
	const FF = 70;
	const dot = canvasTex(32, 32, (c, w, h) => { const gr = c.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.4, "rgba(255,255,255,0.5)"); gr.addColorStop(1, "rgba(255,255,255,0)"); c.fillStyle = gr; c.fillRect(0, 0, w, h); });
	const ffGeo = new THREE.BufferGeometry();
	ffGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(FF * 3), 3));
	const fireflies = new THREE.Points(ffGeo, new THREE.PointsMaterial({ size: 0.16, map: dot, color: "#d8ff8a", transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
	fireflies.frustumCulled = false;
	g.add(fireflies);
	const ffSeed = [];
	for (let i = 0; i < FF; i++) { const t = TR[i % 3]; ffSeed.push({ x: t.x + (R() - 0.5) * 5, y: 1.2 + R() * 4, z: t.z + (R() - 0.5) * 5, a: R() * 6, s: 0.3 + R() * 0.5 }); }

	// ---------------------------------------------------------------- the zipline: the frame on T1, the cable, the pole on the pool deck
	const zipStart = new THREE.Vector3(...ZA), zipEnd = new THREE.Vector3(...ZB);
	const zipDir = new THREE.Vector3(ZB[0] - ZA[0], 0, ZB[2] - ZA[2]).normalize();
	const ZIP_H = Math.atan2(zipDir.x, zipDir.z);      // the way you face going down it
	// a point on the cable at t (0 = the frame on T1, 1 = the pole), local coordinates
	const cableAt = (t, out) => out.set(ZA[0] + (ZB[0] - ZA[0]) * t, ZA[1] + (ZB[1] - ZA[1]) * t - ZSAG * 4 * t * (1 - t), ZA[2] + (ZB[2] - ZA[2]) * t);
	// (where your feet are when you let go)
	const RELEASE = cableAt(ZIP.tRel, new THREE.Vector3()).add(new THREE.Vector3(0, -ZIP.bar - ZIP.hand, 0));
	const LAND = new THREE.Vector3(RELEASE.x + zipDir.x * ZIP.drift, ZIP.waterY, RELEASE.z + zipDir.z * ZIP.drift);
	{
		const frameM = mat("#5a3a2a", 0.8), steel = mat("#c9ccd3", 0.3, 0.9);
		// the launch frame: two posts and a beam on T1's north edge, an arm out over the edge to the cable, a step
		const FZ = 4.3;
		for (const x of [8.1, 9.4]) add(g, new THREE.CylinderGeometry(0.07, 0.08, 3.35, 10), frameM, x, 1.675, FZ);
		add(g, new THREE.BoxGeometry(1.5, 0.14, 0.16), frameM, ZA[0], 3.28, FZ);
		{ const a = new THREE.Vector3(ZA[0], 3.25, FZ), b = new THREE.Vector3(ZA[0], ZA[1] + 0.08, ZA[2] + 0.05); const m = add(g, new THREE.BoxGeometry(0.1, a.distanceTo(b), 0.1), frameM, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2, { cast: false }); m.quaternion.setFromUnitVectors(Y, b.clone().sub(a).normalize()); }
		add(g, new THREE.CylinderGeometry(0.06, 0.06, 0.2, 10), steel, ZA[0], ZA[1] + 0.06, ZA[2], { cast: false });
		add(g, rbox(0.9, 0.25, 0.45, 0.03), woodM, ZA[0], 0.125, 4.18).userData.floor = true;
		k.box(ZA[0] - 0.45, ZA[0] + 0.45, 3.95, 4.4);
		const zsign = new THREE.MeshBasicMaterial({ map: k.tex.text("Zipline to the pool!", { w: 1024, h: 192, color: "#d8ecff", glow: "#4cc9f0", font: "800 110px 'Caveat', 'Nunito', cursive" }), transparent: true, depthWrite: false, toneMapped: false });
		add(g, new THREE.PlaneGeometry(1.4, 0.26), zsign, ZA[0], 3.55, FZ - 0.09, { ry: Math.PI, cast: false, receive: false });
		add(g, new THREE.PlaneGeometry(1.4, 0.26), zsign, ZA[0], 3.55, FZ + 0.09, { cast: false, receive: false });
		// the cable
		const cpts = [], tmp = new THREE.Vector3();
		for (let i = 0; i <= 60; i++) cpts.push(cableAt(i / 60, tmp).clone());
		add(g, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cpts), 120, 0.018, 5, false), steel, 0, 0, 0, { cast: false });
		// the pole on the pool deck (its foot on the deck, 4.4 below the platforms), with a little splash-zone sign
		add(g, new THREE.CylinderGeometry(0.1, 0.13, ZB[1] + 4.4 + 0.25, 12), mat("#2b1d3a", 0.5, 0.4), ZB[0], (-4.4 + ZB[1] + 0.25) / 2, ZB[2]);
		add(g, new THREE.CylinderGeometry(0.28, 0.32, 0.12, 16), mat("#2b1d3a", 0.5, 0.4), ZB[0], -4.34, ZB[2], { cast: false });
		add(g, new THREE.SphereGeometry(0.1, 10, 8), glow("#ff4d6d"), ZB[0], ZB[1] + 0.32, ZB[2], { cast: false });
		const ssign = new THREE.MeshBasicMaterial({ map: k.tex.text("Splash zone!", { w: 512, h: 128, color: "#ffffff", glow: "#4cc9f0", font: "800 84px 'Caveat', 'Nunito', cursive" }), transparent: true, depthWrite: false, toneMapped: false });
		add(g, new THREE.PlaneGeometry(0.7, 0.18), ssign, ZB[0], -3.0, ZB[2] - 0.13, { ry: Math.PI, cast: false, receive: false });
	}
	// the trolleys (one per seat) with their T-handles, and one parked at the top for the next rider
	const makeTrolley = () => {
		const tg = group(g, 0, 0, 0);
		add(tg, rbox(0.2, 0.14, 0.12, 0.03), mat("#ffd166", 0.4, 0.5), 0, -0.07, 0, { cast: false });
		add(tg, new THREE.CylinderGeometry(0.012, 0.012, 0.42, 6), mat("#c9ccd3", 0.3, 0.9), 0, -0.35, 0, { cast: false });
		add(tg, new THREE.CylinderGeometry(0.025, 0.025, 0.5, 8), mat("#e63946", 0.5), 0, -0.56, 0, { rz: Math.PI / 2, cast: false });
		tg.rotation.y = ZIP_H + Math.PI / 2;
		return tg;
	};
	const parked = makeTrolley();
	parked.position.copy(zipStart).add(new THREE.Vector3(-zipDir.x * 0.15, 0, -zipDir.z * 0.15));
	const ZN = 4, zipIds = [], trolleys = [], zipSat = {}, zipPrev = {};
	// where a rider is after e seconds (local coordinates; the root is the feet), where their trolley is, and how
	// far the body swings under it (about the axis across the cable)
	const _c = new THREE.Vector3(), ZLAT = new THREE.Vector3(zipDir.z, 0, -zipDir.x), _sq = new THREE.Quaternion(), _hang = new THREE.Vector3();
	const ZP = { swing: 0, pose: "zip" };
	function zipPose(e, pos, handle) {
		ZP.swing = 0; ZP.pose = "zip";
		if (e < ZIP.step) {
			// a step off the launch deck, reach up, grab the handle, feet off the step
			cableAt(0, handle);
			const w = smooth(Math.min(1, e / 0.4)), up = smooth((e - 0.3) / 0.3);
			pos.set(ZA[0], 0.25 + (handle.y - ZIP.bar - ZIP.hand - 0.25) * up, 4.15 + (ZA[2] - 4.15) * w);
			if (e < 0.4) ZP.pose = "walk";
		} else if (e < ZIP.step + ZIP.glide) {
			// whizzing down, swinging a little under the handle (it settles by the time you let go)
			const u = (e - ZIP.step) / ZIP.glide, t = ZIP.tRel * Math.pow(u, 1.8);
			cableAt(t, handle);
			ZP.swing = 0.16 * Math.sin(e * 3.4) * Math.sin(u * Math.PI) - 0.1 * Math.sin(u * Math.PI);
			_sq.setFromAxisAngle(ZLAT, ZP.swing);
			pos.copy(handle).add(_hang.set(0, -ZIP.bar - ZIP.hand, 0).applyQuaternion(_sq));
		} else {
			// let go: the handle runs on down the cable, you drop into the water and bob up
			const f = e - ZIP.step - ZIP.glide;
			cableAt(Math.min(1, ZIP.tRel + f * 0.32), handle);
			if (f < ZIP.fall) {
				const w = f / ZIP.fall;
				pos.set(RELEASE.x + zipDir.x * ZIP.drift * w, RELEASE.y + (ZIP.waterY - RELEASE.y) * w * w, RELEASE.z + zipDir.z * ZIP.drift * w);
			} else {
				const w = Math.min(1, (f - ZIP.fall) / ZIP.bob);
				pos.set(LAND.x, ZIP.waterY + (ZIP.poolY - ZIP.waterY) * smooth(w) + Math.sin(w * Math.PI * 2) * 0.12 * (1 - w), LAND.z);
			}
		}
		return pos;
	}
	const _h = new THREE.Vector3(), _zp = new THREE.Vector3(), _zq = new THREE.Quaternion();
	for (let i = 0; i < ZN; i++) {
		const id = "zip" + i;
		trolleys.push(makeTrolley());
		trolleys[i].visible = false;
		// (on the floor plan you're in the pool the whole way down: you land there, and it keeps the pool around you)
		// (watched from behind by default - F for your own eyes; you face down the cable)
		const lx = LAND.x - 80 + (i - 1.5) * 0.35;
		const sp = k.spot({ id, x: lx, z: LAND.z, side: [lx, LAND.z], y: ZIP.poolY, h: ZIP_H, pov: false, rideFor: ZIP_FOR,
			ride: (pos, quat, who) => {
				const st = who && who.sitT ? who.sitT : (zipSat[id] || (zipSat[id] = Date.now()));
				zipSat[id] = st;
				zipPose((Date.now() - st) / 1000, pos, _h).add(VIS);
				quat.setFromAxisAngle(ZLAT, ZP.swing).multiply(_zq.setFromAxisAngle(Y, ZIP_H));
			},
			ridePose: who => who && who.sitT ? zipPose((Date.now() - who.sitT) / 1000, _zp, _h).pose && ZP.pose : "zip" });
		sp.rideFor = ZIP_FOR;
		zipIds.push(id);
	}
	// splashes where riders land
	const SPL = 48;
	const splGeo = new THREE.BufferGeometry();
	splGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(SPL * 3), 3));
	const splash = new THREE.Points(splGeo, new THREE.PointsMaterial({ size: 0.12, map: dot, color: "#d8f1ff", transparent: true, depthWrite: false, toneMapped: false }));
	splash.frustumCulled = false; splash.visible = false;
	g.add(splash);
	const splVel = [];
	for (let i = 0; i < SPL; i++) { const a = R() * TAU, s = 0.8 + R() * 1.8; splVel.push([Math.cos(a) * s, 2.2 + R() * 2.6, Math.sin(a) * s]); }
	const ripple = add(g, new THREE.RingGeometry(0.2, 0.3, 32), new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0, depthWrite: false, toneMapped: false }), LAND.x, ZIP.surfY + 0.02, LAND.z, { rx: -Math.PI / 2, cast: false, receive: false });
	let splT = -1;
	const boom = () => { splT = 0; splash.visible = true; };
	// board: whichever seat is free
	const zipGate = group(g, ZA[0], 0, ZA[2]);
	add(zipGate, new THREE.BoxGeometry(1.2, 0.06, 0.06), mat("#e63946", 0.5), 0, 1.0, -0.3, { cast: false });
	k.interact("tree:zip", {
		label: "Ride the zipline to the pool!", stand: [ZA[0], 3.6], face: 0, reach: 2.2,
		use: () => {
			const id = zipIds.find(z => ctx.freeSpot([z]) && !ctx.whoSits(z));
			if (!id) { ctx.notice("The zipline's busy - wait a moment!"); return; }
			if (ctx.sitOn([id])) ctx.notice("Hold on tight... and let go over the water! <b>F</b> for your own eyes, <b>drag</b> to look round.");
		}
	}, zipGate, parked);

	// ---------------------------------------------------------------- every frame
	const _hp = new THREE.Vector3(), _pp = new THREE.Vector3();
	function update(dt, t) {
		// the canopies sway, the bridges sway, the lanterns swing, the flag flaps
		canopies.forEach((c, i) => { c.rotation.z = Math.sin(t * 0.55 + i * 1.7) * 0.022; c.rotation.x = Math.cos(t * 0.47 + i) * 0.018; });
		bridgeG.forEach((b, i) => { b.rotation.x = Math.sin(t * 0.9 + i * 2) * 0.008; b.position.y = Math.sin(t * 1.3 + i) * 0.006; });
		lanterns.forEach(l => { l.rotation.z = Math.sin(t * 1.1 + l.userData.ph) * 0.08; l.rotation.x = Math.cos(t * 0.9 + l.userData.ph) * 0.06; });
		cabinFlag.rotation.y = Math.sin(t * 3.2) * 0.3;
		if (hammock) hammock.rotation.x = Math.sin(t * 0.8) * 0.03;
		cabinLamp.material.emissiveIntensity = 2.2 + Math.sin(t * 2.3) * 0.15 + Math.sin(t * 7.7) * 0.08;
		doorLantern.scale.setScalar(1 + Math.sin(t * 5.1) * 0.05);
		// the leaves the camera is in fade away (so you never look out from inside a canopy)
		const cp = ctx.camera && ctx.camera.position;
		if (cp) leafFade.forEach(L => {
			const want = cp.distanceTo(L.c) < L.r ? 0.12 : 1;
			if (Math.abs(L.m.opacity - want) > 0.004) { L.m.opacity += (want - L.m.opacity) * Math.min(1, dt * 8); L.m.depthWrite = L.m.opacity > 0.97; }
		});
		// fairy lights twinkle
		const col = _twk;
		sparkles.forEach((fl, j) => { for (let i = 0; i < fl.count; i += 3) { const b = 0.45 + 0.55 * Math.max(0, Math.sin(t * 2.2 + i * 1.3 + j)); fl.setColorAt(i, col.setRGB(1 * b, 0.84 * b, 0.6 * b)); } fl.instanceColor.needsUpdate = true; });
		for (let i = 0; i < railLights.count; i += 2) { const b = 0.5 + 0.5 * Math.max(0, Math.sin(t * 1.7 - i * 0.35)); railLights.setColorAt(i, col.setRGB(b, 0.85 * b, 0.62 * b)); }
		railLights.instanceColor.needsUpdate = true;
		// fireflies drift and blink
		const fp = ffGeo.attributes.position;
		ffSeed.forEach((f, i) => { fp.setXYZ(i, f.x + Math.sin(t * f.s + f.a) * 0.8, f.y + Math.sin(t * f.s * 1.3 + f.a * 2) * 0.4, f.z + Math.cos(t * f.s * 0.9 + f.a) * 0.8); });
		fp.needsUpdate = true;
		fireflies.material.opacity = 0.65 + Math.sin(t * 3) * 0.25;
		// the zipline: a handle for everyone on it, a splash where they land
		const me = ctx.me();
		for (let i = 0; i < ZN; i++) {
			const id = zipIds[i], on = me.sit === id || !!ctx.whoSits(id);
			if (!on) { trolleys[i].visible = false; delete zipSat[id]; delete zipPrev[id]; continue; }
			const st = zipSat[id];
			if (!st) { trolleys[i].visible = false; continue; }
			const e = (Date.now() - st) / 1000, pe = zipPrev[id] === undefined ? e : zipPrev[id];
			zipPose(e, _pp, _hp);
			trolleys[i].visible = _hp.distanceTo(zipEnd) > 0.05 && e < ZIP_FOR;
			trolleys[i].position.copy(_hp);
			const mine = me.sit === id;
			// (close enough to hear it: you, or anyone near the pool or the tree)
			const near = mine || Math.hypot(me.x - (VIS.x + LAND.x), me.z - (VIS.z + LAND.z)) < 22 || Math.hypot(me.x - W([ZA[0], ZA[2]])[0], me.z - W([ZA[0], ZA[2]])[1]) < 12;
			if (pe < ZIP.step && e >= ZIP.step && near) ctx.sfx("whoosh", mine ? 0.8 : 0.4);
			const tLand = ZIP.step + ZIP.glide + ZIP.fall;
			if (pe < tLand && e >= tLand) { boom(); if (near) { ctx.sfx("splash", 0.8); ctx.sfx("water", 0.5); ctx.sfx("thunk", 0.3); } }
			zipPrev[id] = e;
		}
		if (splT >= 0) {
			splT += dt;
			const p = splGeo.attributes.position;
			for (let i = 0; i < SPL; i++) {
				const v = splVel[i], y = ZIP.surfY + v[1] * splT - 4.9 * splT * splT;
				p.setXYZ(i, LAND.x + v[0] * splT, Math.max(ZIP.surfY, y), LAND.z + v[2] * splT);
			}
			p.needsUpdate = true;
			splash.material.opacity = Math.max(0, 1 - splT / 1.2);
			ripple.scale.setScalar(1 + splT * 6);
			ripple.material.opacity = Math.max(0, 0.7 - splT * 0.4);
			if (splT > 1.8) { splT = -1; splash.visible = false; ripple.material.opacity = 0; }
		}
	}
	const _twk = new THREE.Color();

	return {
		update,
		// (on the zipline you're out over everything: see the whole house)
		wide: () => { const s = ctx.me().sit; return !!s && s.indexOf("zip") === 0; }
	};
}
