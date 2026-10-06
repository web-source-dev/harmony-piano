/**
 * Harmony World — the garden: a walled garden on the lawn south of the house, at the end of the paths from the pool
 * deck (through the gap in its south railing) and from the terrace (through the gap in its south railing).
 *
 * Local coordinates (origin at world 14.3, -44.1). It's an L: the big lawn, x -21.3..19.3, z -40..6 (the gate in its
 * north railing, from the pool deck's path, is at x -3.7..-2.3), and the west wing, x -21.3..-8.85, z 6..12 (the gate
 * at the top of its steps, from the terrace's path, is at x -19.8..-18.3).
 * Outdoors under the night sky, like the pool (it keeps the terrace's lights and the moon).
 *
 * Everything has room round it: a stone path winds from the north gate right down the lawn to the south gate, with
 * branches off it to each place.
 *   in the north-west, by the west wing: a fountain (toss a coin, make a wish) with benches round it, and below it a
 *   koi pond with lily pads and a bench beside it;
 *   in the west wing: a rose arch at the top of the steps from the terrace;
 *   in the middle of the lawn, the path running under it: three big trees with the Treehouse up in them (worldTree.js,
 *   its own floor: only the trunks are down here);
 *   in the south-west: a white gazebo with a bench for two (cuddle up in it);
 *   in the south-east corner: the Box of Shame (its own room: worldShame.js), with a red carpet up to its door;
 *   flower beds all round (water the east one), cherry trees in blossom, lanterns along the paths, and fireflies;
 *   in the south railing: the gate out to the Fun Park (worldPark.js);
 *   in the west railing: the doors of the Haunted Mansion (worldHaunted.js, off the big lawn) and the Aquarium
 *   (worldAquarium.js, off the west wing).
 */
const HW0 = -21.3, HW1 = 19.3, HD0 = -40.0, HD1 = 6.0;
const WING = { x1: -8.85, z1: 12.0 };              // the west wing reaches up to the terrace
const TGAP = { x0: -19.8, x1: -18.3 };              // in line with the terrace's railing gap (TGAP in worldRoom.js), up the path
const GAP = { x0: -3.7, x1: -2.3 };
const PGATE = { x0: 4.8, x1: 6.6 };               // the gate in the south railing, out to the Fun Park (worldPark.js)
const HGATE = { z0: 1.7, z1: 3.2 };                // the gap in the west railing into the Haunted Mansion (worldHaunted.js)
const AGATE = { z0: 9.75, z1: 11.25 };             // ...and into the Aquarium (worldAquarium.js)
const TRUNKS = [[-6.2, -15.8], [0.6, -15.8], [8.8, -15.8]];   // the treehouse's trees (worldTree.js: its origin is 18 m south of ours)
const BOX = { x0: 10.6, x1: 18.0, z0: -34.0, z1: -28.0, door: -31.0 };   // the Box of Shame's footprint (worldShame.js)
const FTN = { x: -13.5, z: -0.5, r: 1.35 };        // the fountain
const GZ = { x: -12.5, z: -30.0, r: 1.9 };         // the gazebo
const POND = { x: -12.5, z: -9.0, rx: 2.4, rz: 1.6 };

export function build(k) {
	const { THREE, add, mat, group, rbox, g, ctx, canvasTex, rng } = k;
	const R = rng(404);
	k.floor(() => 0);
	k.walk(HW0 + 0.15, HW1 - 0.15, HD0 + 0.15, HD1);
	k.walk(HW0 + 0.15, WING.x1 - 0.15, HD1 - 1.2, WING.z1 - 0.15);   // the west wing
	k.walk(GAP.x0, GAP.x1, HD1 - 1.2, HD1 + 0.6);   // in through the north gate (the path from the pool deck)
	k.walk(TGAP.x0, TGAP.x1, WING.z1 - 1.2, WING.z1 + 0.8);   // out of the wing's gate (the path up to the terrace; reaching well into the wing: no seam)
	k.walk(PGATE.x0, PGATE.x1, HD0 - 0.9, HD0 + 1.2);   // out through the gate to the Fun Park
	k.walk(HW0 - 1.4, HW0 + 1.0, HGATE.z0, HGATE.z1);   // in at the mansion's door / the aquarium's door (their rooms start
	k.walk(HW0 - 1.4, HW0 + 1.0, AGATE.z0, AGATE.z1);   // at world x -7.6; reaching past it leaves no seam in the doorway)
	k.cam = { minX: HW0 - 1.5, maxX: HW1 + 1.5, minZ: HD0 - 1.5, maxZ: WING.z1, maxY: 10, minY: 0.2 };

	// ---------------------------------------------------------------- the lawn and the path
	const grass = canvasTex(512, 512, (c, w, h) => {
		c.fillStyle = "#3f7a3a"; c.fillRect(0, 0, w, h);
		const r = rng(5);
		for (let i = 0; i < 9000; i++) {
			const t = r();
			c.strokeStyle = t < 0.33 ? "rgba(98,160,80,0.55)" : t < 0.66 ? "rgba(45,95,42,0.55)" : "rgba(130,185,95,0.4)";
			c.lineWidth = 1 + r();
			const x = r() * w, y = r() * h;
			c.beginPath(); c.moveTo(x, y); c.lineTo(x + (r() - 0.5) * 4, y - 4 - r() * 6); c.stroke();
		}
	}, (HW1 - HW0) / 3, (HD1 - HD0) / 3);
	// the lawn, in pieces: the long lawn round the Box of Shame (none under it: its own floor is there), and the west wing
	const lawnPiece = (x0, x1, z0, z1) => {
		const t = grass.clone();
		t.repeat.set((x1 - x0) / 3, (z1 - z0) / 3);
		t.offset.set(x0 / 3, z0 / 3);
		t.needsUpdate = true;
		const m = add(g, new THREE.PlaneGeometry(x1 - x0, z1 - z0), mat("#ffffff", 0.95, 0, { map: t }), (x0 + x1) / 2, 0, (z0 + z1) / 2, { rx: -Math.PI / 2, cast: false });
		m.userData.floor = true;
	};
	lawnPiece(HW0, BOX.x0, HD0, HD1);
	lawnPiece(BOX.x1, HW1, HD0, HD1);
	lawnPiece(BOX.x0, BOX.x1, HD0, BOX.z0);
	lawnPiece(BOX.x0, BOX.x1, BOX.z1, HD1);
	lawnPiece(HW0, WING.x1, HD1, WING.z1 + 0.05);
	// the roof edge under it
	const edgeM = mat("#5b4636", 0.8);
	add(g, new THREE.BoxGeometry(HW1 - HW0, 0.3, 0.1), edgeM, (HW0 + HW1) / 2, -0.15, HD0 - 0.02);
	add(g, new THREE.BoxGeometry(0.1, 0.3, WING.z1 - HD0), edgeM, HW0 - 0.02, -0.15, (HD0 + WING.z1) / 2);
	add(g, new THREE.BoxGeometry(0.1, 0.3, HD1 - HD0), edgeM, HW1 + 0.02, -0.15, (HD0 + HD1) / 2);
	// stepping stones: from the gap down to the gazebo, and off to the pond
	const stoneM = mat("#cfc6b8", 0.85);
	const stones = (pts, n) => {
		const curve = new THREE.CatmullRomCurve3(pts.map(([x, z]) => new THREE.Vector3(x, 0, z)));
		for (let i = 0; i <= n; i++) {
			const p = curve.getPoint(i / n);
			const s = add(g, new THREE.CylinderGeometry(0.28 + R() * 0.06, 0.3, 0.04, 9), stoneM, p.x + (R() - 0.5) * 0.12, 0.02, p.z, { ry: R() * 3, cast: false });
			s.scale.set(1, 1, 0.75 + R() * 0.2);
			s.userData.floor = true;
		}
	};
	// the main path: from the north gate, down under the treehouse, out of the south gate
	stones([[-3.0, 5.6], [-2.7, 1.0], [-3.4, -4.0], [-2.8, -10.0], [-2.8, -16.0], [-2.0, -22.0], [1.5, -27.5], [4.5, -33.0], [5.7, -39.4]], 60);
	// off it: to the pond, to the foot of the treehouse ladder, to the gazebo, to the Box of Shame, and east to the flowers
	stones([[-3.3, -5.5], [-7.0, -8.4], [POND.x + POND.rx + 0.6, POND.z + 0.2]], 8);
	stones([[-2.8, -12.0], [0.6, -12.3], [3.5, -14.0], [3.75, -14.9]], 9);
	stones([[-1.6, -24.5], [-6.0, -26.4], [GZ.x + 0.2, GZ.z + GZ.r + 0.3]], 14);
	stones([[3.0, -30.8], [6.2, -31.1], [8.9, BOX.door]], 7);
	stones([[-2.6, 1.8], [3.0, 0.4], [9.0, -1.8], [13.6, -6.6]], 18);
	// from the terrace's steps, past the fountain, to the main path
	stones([[(TGAP.x0 + TGAP.x1) / 2, 11.6], [-18.6, 8.0], [-16.4, 4.4], [FTN.x + 0.3, FTN.z + FTN.r + 0.8], [FTN.x + FTN.r + 0.9, FTN.z - 0.4], [-7.0, -2.0], [-3.6, -3.0]], 28);

	// ---------------------------------------------------------------- glass railing round the outside (it's up on the roof)
	const railM = mat("#6b4f3a", 0.5), postM = mat("#3e3a3a", 0.4, 0.6);
	const glassM = new THREE.MeshPhysicalMaterial({ color: "#cfe7ff", transparent: true, opacity: 0.16, roughness: 0.05, depthWrite: false, side: THREE.DoubleSide });
	const railRun = (x0, z0, x1, z1) => {
		const len = Math.hypot(x1 - x0, z1 - z0), ang = Math.atan2(x1 - x0, z1 - z0);
		const rg = group(g, (x0 + x1) / 2, 0, (z0 + z1) / 2, ang);
		add(rg, new THREE.BoxGeometry(0.08, 0.06, len + 0.08), railM, 0, 1.05, 0);
		const gl = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.9), glassM);
		gl.rotation.y = Math.PI / 2; gl.position.y = 0.55;
		rg.add(gl);
		const n = Math.max(1, Math.round(len / 1.25));
		for (let i = 0; i <= n; i++) add(rg, new THREE.BoxGeometry(0.06, 1.05, 0.06), postM, 0, 0.525, -len / 2 + (len * i) / n);
	};
	// (the south side has the gate out to the Fun Park in it)
	railRun(HW0 + 0.05, HD0 + 0.05, PGATE.x0, HD0 + 0.05);
	railRun(PGATE.x1, HD0 + 0.05, HW1 - 0.05, HD0 + 0.05);
	railRun(HW0 + 0.05, HD0 + 0.05, HW0 + 0.05, HGATE.z0);
	railRun(HW0 + 0.05, HGATE.z1, HW0 + 0.05, AGATE.z0);
	railRun(HW0 + 0.05, AGATE.z1, HW0 + 0.05, WING.z1 - 0.05);
	railRun(HW1 - 0.05, HD0 + 0.05, HW1 - 0.05, HD1 - 0.05);
	k.box(HW0, PGATE.x0, HD0, HD0 + 0.15);
	k.box(PGATE.x1, HW1, HD0, HD0 + 0.15);
	// a signpost by the gate
	{
		const sg = group(g, PGATE.x0 - 0.35, 0, HD0 + 0.35);
		add(sg, new THREE.CylinderGeometry(0.03, 0.03, 1.2, 8), mat("#5b4636", 0.7), 0, 0.6, 0);
		add(sg, rbox(0.82, 0.24, 0.04, 0.02), mat("#c2366b", 0.6), 0, 1.22, 0);
		add(sg, new THREE.PlaneGeometry(0.76, 0.18), new THREE.MeshBasicMaterial({ map: k.tex.text("Garden", { w: 512, h: 128, color: "#fff4d6", font: "800 80px 'Caveat', 'Nunito', cursive" }), transparent: true, depthWrite: false }), 0, 1.22, 0.025, { ry: Math.PI, cast: false, receive: false });
		add(sg, new THREE.PlaneGeometry(0.76, 0.18), new THREE.MeshBasicMaterial({ map: k.tex.text("Fun Park", { w: 512, h: 128, color: "#fff4d6", font: "800 80px 'Caveat', 'Nunito', cursive" }), transparent: true, depthWrite: false }), 0, 1.22, -0.025, { cast: false, receive: false });
		k.box(PGATE.x0 - 0.42, PGATE.x0 - 0.28, HD0 + 0.28, HD0 + 0.42);
	}
	k.box(HW0, HW0 + 0.15, HD0, HGATE.z0);
	k.box(HW0, HW0 + 0.15, HGATE.z1, AGATE.z0);
	k.box(HW0, HW0 + 0.15, AGATE.z1, WING.z1);
	// the north side, out onto the lawn in front of the house (it used to lean on the pool deck): railings, with a gate
	// for each path - the pool deck's, into the long lawn, and the terrace's, into the west wing
	railRun(WING.x1 + 0.05, HD1 - 0.05, GAP.x0, HD1 - 0.05);
	railRun(GAP.x1, HD1 - 0.05, HW1 - 0.05, HD1 - 0.05);
	railRun(WING.x1 - 0.05, HD1 - 0.05, WING.x1 - 0.05, WING.z1 - 0.05);
	railRun(HW0 + 0.05, WING.z1 - 0.05, TGAP.x0, WING.z1 - 0.05);
	railRun(TGAP.x1, WING.z1 - 0.05, WING.x1 - 0.05, WING.z1 - 0.05);
	k.box(WING.x1, GAP.x0, HD1 - 0.15, HD1);
	k.box(GAP.x1, HW1, HD1 - 0.15, HD1);
	k.box(WING.x1 - 0.15, WING.x1, HD1, WING.z1);
	k.box(HW0, TGAP.x0, WING.z1 - 0.15, WING.z1);
	k.box(TGAP.x1, WING.x1, WING.z1 - 0.15, WING.z1);
	// a signpost at the north gate
	{
		const sg = group(g, GAP.x1 + 0.35, 0, HD1 - 0.35);
		add(sg, new THREE.CylinderGeometry(0.03, 0.03, 1.2, 8), mat("#5b4636", 0.7), 0, 0.6, 0);
		add(sg, rbox(0.82, 0.24, 0.04, 0.02), mat("#2a9d8f", 0.6), 0, 1.22, 0);
		add(sg, new THREE.PlaneGeometry(0.76, 0.18), new THREE.MeshBasicMaterial({ map: k.tex.text("Garden", { w: 512, h: 128, color: "#fff4d6", font: "800 80px 'Caveat', 'Nunito', cursive" }), transparent: true, depthWrite: false }), 0, 1.22, 0.025, { cast: false, receive: false });
		add(sg, new THREE.PlaneGeometry(0.76, 0.18), new THREE.MeshBasicMaterial({ map: k.tex.text("House & Pool", { w: 512, h: 128, color: "#fff4d6", font: "800 70px 'Caveat', 'Nunito', cursive" }), transparent: true, depthWrite: false }), 0, 1.22, -0.025, { ry: Math.PI, cast: false, receive: false });
		k.box(GAP.x1 + 0.28, GAP.x1 + 0.42, HD1 - 0.42, HD1 - 0.28);
	}
	// signposts by the two doors in the west railing
	for (const [z, a, b] of [[HGATE.z1 + 0.35, "Haunted Mansion", "Garden"], [AGATE.z0 - 0.35, "Aquarium", "Garden"]]) {
		const sg = group(g, HW0 + 0.35, 0, z, Math.PI / 2);
		add(sg, new THREE.CylinderGeometry(0.03, 0.03, 1.2, 8), mat("#5b4636", 0.7), 0, 0.6, 0);
		add(sg, rbox(0.82, 0.24, 0.04, 0.02), mat(a === "Aquarium" ? "#2f6f9f" : "#4a2a5c", 0.6), 0, 1.22, 0);
		add(sg, new THREE.PlaneGeometry(0.76, 0.18), new THREE.MeshBasicMaterial({ map: k.tex.text(a, { w: 512, h: 128, color: "#fff4d6", font: "800 70px 'Caveat', 'Nunito', cursive" }), transparent: true, depthWrite: false }), 0, 1.22, 0.025, { cast: false, receive: false });   // (read from the garden)
		add(sg, new THREE.PlaneGeometry(0.76, 0.18), new THREE.MeshBasicMaterial({ map: k.tex.text(b, { w: 512, h: 128, color: "#fff4d6", font: "800 80px 'Caveat', 'Nunito', cursive" }), transparent: true, depthWrite: false }), 0, 1.22, -0.025, { ry: Math.PI, cast: false, receive: false });
		k.box(HW0 + 0.28, HW0 + 0.42, z - 0.07, z + 0.07);
	}
	// the treehouse's trunks (the trees themselves are drawn by worldTree.js)
	TRUNKS.forEach(([x, z]) => k.box(x - 0.45, x + 0.45, z - 0.45, z + 0.45));
	k.box(HW1 - 0.15, HW1, HD0, HD1);

	// ---------------------------------------------------------------- flowers (instanced: hundreds of them)
	const bloomCols = ["#ff5d8f", "#ffd166", "#ffffff", "#c77dff", "#ff9e4a", "#ff8fab", "#7bdff2", "#f15bb5"];
	const blooms = [], tint = new THREE.Color(), dummy = new THREE.Object3D();
	function flowerBed(x0, x1, z0, z1, cols) {
		// a low wooden border, dark soil, flowers on stems
		const wood = mat("#7a5236", 0.7);
		const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, w = x1 - x0, d = z1 - z0;
		add(g, new THREE.BoxGeometry(w, 0.22, 0.08), wood, cx, 0.11, z0);
		add(g, new THREE.BoxGeometry(w, 0.22, 0.08), wood, cx, 0.11, z1);
		add(g, new THREE.BoxGeometry(0.08, 0.22, d), wood, x0, 0.11, cz);
		add(g, new THREE.BoxGeometry(0.08, 0.22, d), wood, x1, 0.11, cz);
		add(g, new THREE.PlaneGeometry(w - 0.08, d - 0.08), mat("#3b2a1e", 1), cx, 0.16, cz, { rx: -Math.PI / 2, cast: false });
		const n = Math.round(w * d * 26);
		const stems = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.008, 0.01, 1, 4), mat("#3f8a4a", 0.8), n);
		const heads = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.055, 0), mat("#ffffff", 0.55), n);
		const leaves = new THREE.InstancedMesh(new THREE.SphereGeometry(0.07, 6, 5), mat("#ffffff", 0.75), n);
		for (let i = 0; i < n; i++) {
			const x = x0 + 0.1 + R() * (w - 0.2), z = z0 + 0.1 + R() * (d - 0.2), hgt = 0.18 + R() * 0.3;
			dummy.position.set(x, 0.16 + hgt / 2, z); dummy.rotation.set((R() - 0.5) * 0.2, 0, (R() - 0.5) * 0.2); dummy.scale.set(1, hgt, 1); dummy.updateMatrix();
			stems.setMatrixAt(i, dummy.matrix);
			dummy.position.set(x, 0.16 + hgt, z); dummy.rotation.set(R() * 3, R() * 3, R() * 3); dummy.scale.setScalar(0.7 + R() * 0.8); dummy.updateMatrix();
			heads.setMatrixAt(i, dummy.matrix); heads.setColorAt(i, tint.set((cols || bloomCols)[Math.floor(R() * (cols || bloomCols).length)]));
			dummy.position.set(x + (R() - 0.5) * 0.08, 0.2 + R() * 0.08, z + (R() - 0.5) * 0.08); dummy.scale.set(1, 0.4, 0.8); dummy.updateMatrix();
			leaves.setMatrixAt(i, dummy.matrix); leaves.setColorAt(i, tint.set(R() < 0.5 ? "#3f8a4a" : "#5aa864"));
		}
		for (const im of [stems, heads, leaves]) { im.castShadow = false; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; g.add(im); }
		blooms.push(heads);
		k.box(x0 - 0.05, x1 + 0.05, z0 - 0.05, z1 + 0.05);
		return { x0, x1, z0, z1, heads };
	}
	const ROSES = ["#d00000", "#e5383b", "#ba181b", "#ff4d6d", "#a4133c"];
	const beds = [
		flowerBed(14.5, 15.55, -9.0, -5.3),             // the east bed, at the end of the path that way (water it)
		flowerBed(-9.6, -8.6, -5.6, -3.4),              // between the fountain and the pond
		flowerBed(-6.4, -2.8, HD0 + 0.3, HD0 + 1.2),    // along the south railing
		flowerBed(-1.0, 0.0, -36.5, -33.0),             // by the main path, near the south gate
		// along the west railing, the wing and under the terrace
		flowerBed(HW0 + 0.3, HW0 + 1.3, -7.0, -2.0),
		flowerBed(HW0 + 0.3, HW0 + 1.3, -36.0, -24.0),
		flowerBed(HW0 + 0.3, HW0 + 1.3, 4.4, 9.6),
		flowerBed(-16.6, -10.6, 10.9, 11.7),
		// along the north railing and the east railing
		flowerBed(6.0, 14.5, HD1 - 1.2, HD1 - 0.3),
		flowerBed(HW1 - 1.3, HW1 - 0.3, -24.0, -14.0),
		flowerBed(HW1 - 1.3, HW1 - 0.3, -4.0, 1.0),
		// the south-east corner: roses all along the front of the Box of Shame, and a bed of them behind it
		flowerBed(BOX.x0 + 1.2, BOX.x1 - 0.3, BOX.z1 + 0.5, BOX.z1 + 1.2, ROSES),
		flowerBed(BOX.x0 + 0.4, BOX.x1 - 0.4, BOX.z0 - 1.6, BOX.z0 - 0.7, ROSES)
	];

	// ---------------------------------------------------------------- cherry trees in blossom
	const trees = [];
	function cherry(x, z, s) {
		const t = group(g, x, 0, z);
		const bark = mat("#5a3a2a", 0.85);
		add(t, new THREE.CylinderGeometry(0.1 * s, 0.16 * s, 1.6 * s, 10), bark, 0, 0.8 * s, 0);
		for (const [a, l] of [[0.6, 0.9], [-0.7, 0.8], [2.4, 0.85]]) {
			const b = add(t, new THREE.CylinderGeometry(0.05 * s, 0.08 * s, l * s, 8), bark, Math.cos(a) * 0.25 * s, 1.75 * s, Math.sin(a) * 0.25 * s);
			b.rotation.set(Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6);
		}
		const crown = group(t, 0, 2.2 * s, 0);
		const pinks = ["#ffb7c5", "#ff9eb5", "#ffd1dc", "#ffc0d0"];
		for (let i = 0; i < 9; i++) {
			const a = i / 9 * Math.PI * 2, rr = i ? 0.55 * s : 0;
			add(crown, new THREE.IcosahedronGeometry((0.55 + R() * 0.2) * s, 1), mat(pinks[i % 4], 0.8), Math.cos(a) * rr, (R() - 0.3) * 0.4 * s, Math.sin(a) * rr, { cast: i < 3 });
		}
		// a ring of fallen petals on the grass
		const ring = add(g, new THREE.CircleGeometry(1.3 * s, 28), new THREE.MeshStandardMaterial({ color: "#ffb7c5", transparent: true, opacity: 0.35, roughness: 1, depthWrite: false }), x, 0.008, z, { rx: -Math.PI / 2, cast: false });
		ring.userData.floor = true;
		k.box(x - 0.25 * s, x + 0.25 * s, z - 0.25 * s, z + 0.25 * s);
		trees.push(crown);
	}
	cherry(16.5, 3.5, 0.9);
	cherry(9.5, 3.4, 0.85);
	cherry(-7.5, 3.6, 0.9);
	cherry(-11.4, 8.9, 1.0);
	cherry(-19.2, -10.5, 0.95);
	cherry(-17.5, -21.0, 1.0);
	cherry(17.0, -18.5, 0.95);
	cherry(12.0, -24.5, 0.85);
	cherry(-5.5, -33.5, 0.9);
	cherry(-19.0, -37.5, 0.85);
	cherry(16.8, -37.8, 0.8);

	// ---------------------------------------------------------------- the gazebo, with a bench for two
	const white = mat("#f7f3ec", 0.5);
	const gz = group(g, GZ.x, 0, GZ.z);
	add(gz, new THREE.CylinderGeometry(GZ.r + 0.15, GZ.r + 0.2, 0.04, 8), mat("#e9e2d6", 0.7), 0, 0.02, 0, { ry: Math.PI / 8, cast: false }).userData.floor = true;
	const roofY = 2.45;
	for (let i = 0; i < 8; i++) {
		const a = i / 8 * Math.PI * 2 + Math.PI / 8;
		const px = Math.sin(a) * GZ.r, pz = Math.cos(a) * GZ.r;
		add(gz, new THREE.CylinderGeometry(0.06, 0.07, roofY - 0.04, 10), white, px, 0.04 + (roofY - 0.04) / 2, pz);
		// a low rail between the posts, except the doorway (facing the path, +z)
		if (i !== 7) {
			const b = Math.atan2(Math.sin(a + Math.PI / 8), Math.cos(a + Math.PI / 8));
			const nx = Math.sin(a + Math.PI / 4) * GZ.r, nz = Math.cos(a + Math.PI / 4) * GZ.r;
			const len = Math.hypot(nx - px, nz - pz);
			add(gz, new THREE.BoxGeometry(len, 0.06, 0.06), white, (px + nx) / 2, 0.8, (pz + nz) / 2, { ry: b });
			for (let j = 1; j < 5; j++) add(gz, new THREE.BoxGeometry(0.035, 0.66, 0.035), white, px + (nx - px) * j / 5, 0.45, pz + (nz - pz) * j / 5, { cast: false });
			k.box(GZ.x + Math.min(px, nx) - 0.06, GZ.x + Math.max(px, nx) + 0.06, GZ.z + Math.min(pz, nz) - 0.06, GZ.z + Math.max(pz, nz) + 0.06);
		}
	}
	const roof = add(gz, new THREE.ConeGeometry(GZ.r + 0.45, 1.1, 8, 1), mat("#8fae9f", 0.6), 0, roofY + 0.55, 0, { ry: Math.PI / 8 });
	roof.castShadow = true;
	add(gz, new THREE.CylinderGeometry(GZ.r + 0.45, GZ.r + 0.45, 0.08, 8), white, 0, roofY, 0, { ry: Math.PI / 8 });
	add(gz, new THREE.SphereGeometry(0.1, 12, 8), mat("#c9a05a", 0.3, 0.8), 0, roofY + 1.15, 0);
	// fairy lights round the eaves and a lantern hanging in the middle
	const eaveBulbs = [];
	for (let i = 0; i < 40; i++) {
		const a = i / 40 * Math.PI * 2;
		eaveBulbs.push(add(gz, new THREE.SphereGeometry(0.025, 8, 6), new THREE.MeshStandardMaterial({ color: "#fff4d6", emissive: i % 2 ? "#ffd59a" : "#ffe9f0", emissiveIntensity: 2 }), Math.sin(a) * (GZ.r + 0.4), roofY - 0.08 - Math.abs(Math.sin(a * 4)) * 0.06, Math.cos(a) * (GZ.r + 0.4), { cast: false }));
	}
	const lanternM = new THREE.MeshStandardMaterial({ color: "#fff1d6", emissive: "#ffb35a", emissiveIntensity: 2 });
	add(gz, new THREE.CylinderGeometry(0.004, 0.004, 0.5, 4), mat("#333"), 0, roofY - 0.25, 0, { cast: false });
	add(gz, new THREE.SphereGeometry(0.13, 16, 12), lanternM, 0, roofY - 0.6, 0, { cast: false });
	// the bench along the back, facing the doorway
	const bench = group(gz, 0, 0.04, -GZ.r + 0.55);
	const benchWood = mat("#8a5a3c", 0.55);
	add(bench, rbox(1.5, 0.07, 0.45, 0.02), benchWood, 0, 0.42, 0);
	add(bench, rbox(1.5, 0.45, 0.06, 0.02), benchWood, 0, 0.72, -0.22, { rx: -0.12 });
	for (const sx of [-0.68, 0.68]) add(bench, rbox(0.06, 0.42, 0.42, 0.02), benchWood, sx, 0.21, 0);
	add(bench, rbox(0.42, 0.34, 0.1, 0.04), mat("#ffc8d6", 0.95), -0.4, 0.64, -0.14, { rx: -0.2 });
	add(bench, rbox(0.42, 0.34, 0.1, 0.04), mat("#bde0fe", 0.95), 0.4, 0.64, -0.14, { rx: -0.2 });
	const bz = GZ.z - GZ.r + 0.55;
	k.box(GZ.x - 0.8, GZ.x + 0.8, bz - 0.3, bz + 0.2);
	k.spot({ id: "gazebo0", x: GZ.x - 0.35, z: bz + 0.05, h: 0, y: 0.08 });
	k.spot({ id: "gazebo1", x: GZ.x + 0.35, z: bz + 0.05, h: 0, y: 0.08 });
	k.interact("garden:gazebo", { label: "Sit in the gazebo", stand: [GZ.x, GZ.z + 0.3], sit: ["gazebo0", "gazebo1"] }, bench);

	// ---------------------------------------------------------------- the koi pond
	const pond = group(g, POND.x, 0, POND.z);
	const pondShape = s => { const sh = new THREE.Shape(); sh.absellipse(0, 0, POND.rx * s, POND.rz * s, 0, Math.PI * 2, false, 0); return sh; };
	// a ring of stones round it
	for (let i = 0; i < 26; i++) {
		const a = i / 26 * Math.PI * 2;
		add(pond, new THREE.DodecahedronGeometry(0.17 + R() * 0.06, 0), mat(["#9a948c", "#b3ada4", "#857f78"][i % 3], 0.9), Math.cos(a) * (POND.rx + 0.12), 0.06, Math.sin(a) * (POND.rz + 0.12), { cast: false }).scale.set(1, 0.55, 1);
	}
	add(pond, new THREE.ShapeGeometry(pondShape(1), 40), mat("#16343a", 0.9), 0, 0.01, 0, { rx: -Math.PI / 2, cast: false });
	const waterM = new THREE.MeshPhysicalMaterial({ color: "#2f8fa6", transparent: true, opacity: 0.55, roughness: 0.05, clearcoat: 1, emissive: "#0d4f5e", emissiveIntensity: 0.4, depthWrite: false });
	const water = add(pond, new THREE.ShapeGeometry(pondShape(0.98), 40), waterM, 0, 0.07, 0, { rx: -Math.PI / 2, cast: false, receive: false });
	water.renderOrder = 2;
	const koi = [];
	const koiCols = [["#ff7b29", "#ffffff"], ["#ffffff", "#e63946"], ["#ffb703", "#fb8500"], ["#f1faee", "#ff7b29"], ["#e63946", "#f1faee"]];
	koiCols.forEach(([c1, c2], i) => {
		const f = group(pond, 0, 0.035, 0);
		add(f, new THREE.SphereGeometry(0.07, 12, 8), mat(c1, 0.4), 0, 0, 0, { cast: false }).scale.set(0.55, 0.4, 1.6);
		add(f, new THREE.SphereGeometry(0.035, 10, 8), mat(c2, 0.4), 0, 0.02, 0.03, { cast: false }).scale.set(0.8, 0.5, 1.4);
		const tail = add(f, new THREE.ConeGeometry(0.05, 0.08, 4), mat(c1, 0.4), 0, 0, -0.14, { rx: -Math.PI / 2, cast: false });
		tail.scale.set(1, 1, 0.25);
		f.userData = { ph: i * 1.3, sp: 0.25 + R() * 0.2, r: 0.35 + R() * 0.45, tail };
		koi.push(f);
	});
	const pads = [];
	for (let i = 0; i < 6; i++) {
		const a = R() * Math.PI * 2, rr = 0.3 + R() * 0.6;
		const p = add(pond, new THREE.CircleGeometry(0.13 + R() * 0.06, 16, 0.3, Math.PI * 2 - 0.5), mat("#4f9a4a", 0.7, 0, { side: THREE.DoubleSide }), Math.cos(a) * rr * POND.rx * 0.8, 0.075, Math.sin(a) * rr * POND.rz * 0.8, { rx: -Math.PI / 2, cast: false });
		p.userData.ph = R() * 6;
		pads.push(p);
		if (i % 2 === 0) add(p, new THREE.ConeGeometry(0.05, 0.06, 6, 1, true), mat("#ffc8dd", 0.5, 0, { side: THREE.DoubleSide }), 0, 0, 0.03, { rx: Math.PI / 2, cast: false });
	}
	k.box(POND.x - POND.rx - 0.2, POND.x + POND.rx + 0.2, POND.z - POND.rz - 0.2, POND.z + POND.rz + 0.2);
	let fedAt = -1e9;
	const ripples = [];
	const rippleM = new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide });
	const rippleGeo = new THREE.RingGeometry(0.1, 0.13, 24);
	function feedKoi() {
		fedAt = performance.now() / 1000;
		for (let i = 0; i < 4; i++) setTimeout(() => {
			const r = new THREE.Mesh(rippleGeo, rippleM.clone());
			r.rotation.x = -Math.PI / 2;
			r.position.set((R() - 0.5) * 0.8, 0.08, (R() - 0.5) * 0.5);
			r.userData.life = 0;
			pond.add(r);
			ripples.push(r);
		}, i * 220);
		ctx.sfx("water", 0.35);
	}
	k.interact("garden:pond", { label: "Feed the koi", stand: [POND.x + POND.rx + 0.75, POND.z], face: -Math.PI / 2, use: () => { feedKoi(); ctx.send({ t: "fx", kind: "zfx", zone: "garden", what: "koi" }); ctx.doUpper("give", 1200); } }, pond);
	// a bench beside the pond
	const pb = group(g, POND.x, 0, POND.z - POND.rz - 1.05);
	add(pb, rbox(1.5, 0.07, 0.45, 0.02), benchWood, 0, 0.42, 0);
	add(pb, rbox(1.5, 0.45, 0.06, 0.02), benchWood, 0, 0.72, -0.22, { rx: -0.12 });
	for (const sx of [-0.68, 0.68]) add(pb, rbox(0.06, 0.42, 0.42, 0.02), mat("#2e2b2b", 0.5, 0.5), sx, 0.21, 0);
	const pbz = POND.z - POND.rz - 1.05;
	k.box(POND.x - 0.8, POND.x + 0.8, pbz - 0.3, pbz + 0.2);
	k.spot({ id: "pondBench0", x: POND.x - 0.35, z: pbz + 0.05, h: 0, y: 0.04 });
	k.spot({ id: "pondBench1", x: POND.x + 0.35, z: pbz + 0.05, h: 0, y: 0.04 });
	k.interact("garden:pondbench", { label: "Sit by the pond", stand: [POND.x + 1.25, pbz + 0.2], sit: ["pondBench0", "pondBench1"] }, pb);

	// ---------------------------------------------------------------- water the flowers (the east bed)
	let wateredAt = -1e9;
	const bedE = beds[0];
	const drops = [];
	const dropGeo = new THREE.SphereGeometry(0.018, 6, 4), dropM = new THREE.MeshBasicMaterial({ color: "#bfe6ff", transparent: true, opacity: 0.8 });
	function waterFlowers(z) {
		wateredAt = performance.now() / 1000;
		for (let i = 0; i < 30; i++) {
			const d = new THREE.Mesh(dropGeo, dropM);
			d.position.set(bedE.x0 - 0.15, 0.85, z + (R() - 0.5) * 0.3);
			d.userData = { vx: 0.6 + R() * 0.6, vy: 0.3 + R() * 0.6, vz: (R() - 0.5) * 0.6, life: 0, delay: i * 0.05 };
			d.visible = false;
			g.add(d);
			drops.push(d);
		}
		ctx.sfx("pour", 0.5);
	}
	k.interact("garden:flowers", {
		label: "Water the flowers", stand: [bedE.x0 - 0.65, (bedE.z0 + bedE.z1) / 2], face: Math.PI / 2,
		use: () => { const me = ctx.me(); const z = me.z - k.oz; waterFlowers(z); ctx.send({ t: "fx", kind: "zfx", zone: "garden", what: "water", z }); ctx.doUpper("give", 1800); setTimeout(() => ctx.heartsFx(ctx.myAvatar().root, 3, "#9be7a6"), 900); }
	}, bedE.heads);


	// ---------------------------------------------------------------- the west wing: a rose arch at the terrace steps
	const ARCH = { x: (TGAP.x0 + TGAP.x1) / 2, z: 10.3 };
	{
		const ar = group(g, ARCH.x, 0, ARCH.z);
		const archM = mat("#f7f3ec", 0.5);
		const path = new THREE.CatmullRomCurve3([new THREE.Vector3(-0.95, 0, 0), new THREE.Vector3(-0.95, 1.9, 0), new THREE.Vector3(-0.55, 2.45, 0), new THREE.Vector3(0, 2.6, 0), new THREE.Vector3(0.55, 2.45, 0), new THREE.Vector3(0.95, 1.9, 0), new THREE.Vector3(0.95, 0, 0)]);
		for (const dz of [-0.2, 0.2]) {
			const tube = add(ar, new THREE.TubeGeometry(path, 40, 0.035, 8, false), archM, 0, 0, dz);
			tube.castShadow = true;
		}
		for (let i = 0; i <= 12; i++) { const p = path.getPoint(i / 12); add(ar, new THREE.BoxGeometry(0.03, 0.03, 0.42), archM, p.x, p.y, 0, { cast: false }); }
		// climbing roses all over it
		const n = 90, leafIM = new THREE.InstancedMesh(new THREE.SphereGeometry(0.06, 6, 5), mat("#3f7a3a", 0.8), n), roseIM = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.05, 1), mat("#ffffff", 0.55), n);
		for (let i = 0; i < n; i++) {
			const p = path.getPoint(R()), z = (R() - 0.5) * 0.5;
			dummy.position.set(p.x + (R() - 0.5) * 0.12, p.y + (R() - 0.5) * 0.12, z); dummy.rotation.set(R() * 3, R() * 3, R() * 3); dummy.scale.set(1.3, 0.7, 1); dummy.updateMatrix();
			leafIM.setMatrixAt(i, dummy.matrix);
			dummy.position.set(p.x + (R() - 0.5) * 0.14, p.y + (R() - 0.5) * 0.14, z + (R() - 0.5) * 0.08); dummy.scale.setScalar(0.8 + R() * 0.6); dummy.updateMatrix();
			roseIM.setMatrixAt(i, dummy.matrix); roseIM.setColorAt(i, tint.set(ROSES[i % ROSES.length]));
		}
		for (const im of [leafIM, roseIM]) { im.castShadow = false; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; ar.add(im); }
		for (const sx of [-0.95, 0.95]) k.box(ARCH.x + sx - 0.08, ARCH.x + sx + 0.08, ARCH.z - 0.25, ARCH.z + 0.25);
	}

	// ---------------------------------------------------------------- the fountain (toss a coin, make a wish)
	const ftn = group(g, FTN.x, 0, FTN.z);
	const stoneF = mat("#e6ddd0", 0.6);
	add(ftn, new THREE.CylinderGeometry(FTN.r + 0.15, FTN.r + 0.2, 0.45, 32, 1, true), mat("#e6ddd0", 0.6, 0, { side: THREE.DoubleSide }), 0, 0.225, 0, { cast: true });
	add(ftn, new THREE.TorusGeometry(FTN.r + 0.08, 0.1, 8, 40), stoneF, 0, 0.45, 0, { rx: Math.PI / 2, cast: false });
	add(ftn, new THREE.CircleGeometry(FTN.r, 32), mat("#1d3c46", 0.9), 0, 0.05, 0, { rx: -Math.PI / 2, cast: false });
	const ftnWaterM = new THREE.MeshPhysicalMaterial({ color: "#5fb4c9", transparent: true, opacity: 0.6, roughness: 0.05, clearcoat: 1, emissive: "#1f6f80", emissiveIntensity: 0.45, depthWrite: false });
	const ftnWater = add(ftn, new THREE.CircleGeometry(FTN.r - 0.02, 32), ftnWaterM, 0, 0.36, 0, { rx: -Math.PI / 2, cast: false, receive: false });
	ftnWater.renderOrder = 2;
	// the column, the upper bowl, and a little heart on top that the water bubbles out of
	add(ftn, new THREE.CylinderGeometry(0.14, 0.2, 1.1, 16), stoneF, 0, 0.55, 0);
	add(ftn, new THREE.CylinderGeometry(0.62, 0.22, 0.2, 24), stoneF, 0, 1.15, 0);
	const upperM = ftnWaterM.clone();
	add(ftn, new THREE.CircleGeometry(0.56, 24), upperM, 0, 1.24, 0, { rx: -Math.PI / 2, cast: false, receive: false }).renderOrder = 2;
	add(ftn, new THREE.CylinderGeometry(0.06, 0.09, 0.35, 12), stoneF, 0, 1.4, 0);
	const fHeart = k.heartMesh(0.32, "#ff8fab");
	fHeart.position.set(0, 1.72, 0);
	ftn.add(fHeart);
	// water: falling from the upper bowl's rim, and spouting up from the heart
	const ftnDrops = [];
	const fdGeo = new THREE.SphereGeometry(0.022, 6, 4), fdM = new THREE.MeshBasicMaterial({ color: "#d6f2ff", transparent: true, opacity: 0.75, depthWrite: false });
	for (let i = 0; i < 70; i++) {
		const d = new THREE.Mesh(fdGeo, fdM);
		d.userData = { a: R() * Math.PI * 2, ph: R(), kind: i < 48 ? "rim" : "spout" };
		ftn.add(d);
		ftnDrops.push(d);
	}
	k.box(FTN.x - FTN.r - 0.25, FTN.x + FTN.r + 0.25, FTN.z - FTN.r - 0.25, FTN.z + FTN.r + 0.25);
	const coins = [];
	const coinGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.006, 12), coinM = mat("#e9c46a", 0.25, 0.9);
	const WISHES = ["You tossed a coin and wished... for more nights like this one.", "Plink! Your wish is safe with the fountain.", "A coin, a wish, a little smile. It's going to come true.", "You wished for someone special. (They might be standing right there.)", "Plink! The fountain winks back at you."];
	function tossCoin(from) {
		const c = add(ftn, coinGeo, coinM, 0, -5, 0, { cast: false });
		const a = R() * Math.PI * 2, rr = 0.75 + R() * 0.35;
		c.userData = { t: 0, sx: from[0], sz: from[1], ex: Math.cos(a) * rr, ez: Math.sin(a) * rr };
		coins.push(c);
		if (coins.length > 24) { const old = coins.shift(); ftn.remove(old); }
		setTimeout(() => ctx.sfx("water", 0.3), 650);
	}
	k.interact("garden:fountain", {
		label: "Toss a coin and make a wish", nearest: true,
		stand: [FTN.x + FTN.r + 0.7, FTN.z], stands: [[FTN.x + FTN.r + 0.7, FTN.z], [FTN.x - FTN.r - 0.7, FTN.z], [FTN.x, FTN.z - FTN.r - 0.7]],
		use: () => {
			const me = ctx.me(), lx = me.x - k.ox - FTN.x, lz = me.z - k.oz - FTN.z;
			me.h = Math.atan2(-lx, -lz);
			ctx.doUpper("give", 1100);
			tossCoin([lx, lz]);
			ctx.send({ t: "fx", kind: "zfx", zone: "garden", what: "coin", lx: +lx.toFixed(2), lz: +lz.toFixed(2) });
			setTimeout(() => { ctx.notice(WISHES[Math.floor(Math.random() * WISHES.length)]); ctx.heartsFx(ctx.myAvatar().root, 4, "#ffd166"); }, 900);
		}
	}, ftn);
	// two benches facing the fountain
	const fBench = (id, x, z, h) => {
		const b = group(g, x, 0, z, h);
		add(b, rbox(1.5, 0.07, 0.45, 0.02), benchWood, 0, 0.42, 0);
		add(b, rbox(1.5, 0.45, 0.06, 0.02), benchWood, 0, 0.72, -0.22, { rx: -0.12 });
		for (const sx of [-0.68, 0.68]) add(b, rbox(0.06, 0.42, 0.42, 0.02), mat("#2e2b2b", 0.5, 0.5), sx, 0.21, 0);
		const c = Math.cos(h), sn = Math.sin(h);
		k.box(x - (Math.abs(c) * 0.8 + Math.abs(sn) * 0.3), x + (Math.abs(c) * 0.8 + Math.abs(sn) * 0.3), z - (Math.abs(sn) * 0.8 + Math.abs(c) * 0.3), z + (Math.abs(sn) * 0.8 + Math.abs(c) * 0.3));
		for (const [j, sx] of [[0, -0.35], [1, 0.35]]) k.spot({ id: id + j, x: x + sx * c + 0.05 * sn, z: z - sx * sn + 0.05 * c, h, y: 0.04 });
		k.interact("garden:" + id, { label: "Sit by the fountain", stand: [x + 0.9 * sn, z + 0.9 * c], sit: [id + "0", id + "1"] }, b);
	};
	fBench("ftnBenchS", FTN.x, FTN.z - FTN.r - 1.35, 0);
	fBench("ftnBenchW", FTN.x - FTN.r - 1.35, FTN.z, Math.PI / 2);

	// ---------------------------------------------------------------- the east: a red carpet up to the Box of Shame
	{
		const carpet = add(g, new THREE.PlaneGeometry(BOX.x0 - 8.9 + 0.05, 1.1), mat("#b5171f", 0.9), (8.9 + BOX.x0) / 2, 0.01, BOX.door, { rx: -Math.PI / 2, cast: false });
		carpet.userData.floor = true;
		for (const dz of [-0.56, 0.56]) add(g, new THREE.PlaneGeometry(BOX.x0 - 8.9 + 0.05, 0.05), mat("#e9c46a", 0.5, 0.6), (8.9 + BOX.x0) / 2, 0.012, BOX.door + dz, { rx: -Math.PI / 2, cast: false });
		// little velvet-rope posts either side
		for (const dz of [-0.85, 0.85]) for (const x of [9.0, 10.2]) {
			add(g, new THREE.CylinderGeometry(0.035, 0.05, 0.85, 10), mat("#e9c46a", 0.3, 0.8), x, 0.425, BOX.door + dz);
			add(g, new THREE.SphereGeometry(0.06, 12, 8), mat("#e9c46a", 0.3, 0.8), x, 0.88, BOX.door + dz, { cast: false });
			k.box(x - 0.07, x + 0.07, BOX.door + dz - 0.07, BOX.door + dz + 0.07);
		}
		for (const dz of [-0.85, 0.85]) {
			const rope = new THREE.CatmullRomCurve3([new THREE.Vector3(9.0, 0.8, BOX.door + dz), new THREE.Vector3(9.6, 0.62, BOX.door + dz), new THREE.Vector3(10.2, 0.8, BOX.door + dz)]);
			add(g, new THREE.TubeGeometry(rope, 12, 0.02, 6, false), mat("#8d0801", 0.7), 0, 0, 0, { cast: false });
		}
	}

	// ---------------------------------------------------------------- lanterns along the paths, fireflies
	const lamps = [];
	for (const [x, z] of [
		[-1.9, 3.6], [-1.6, -4.6], [-4.2, -9.0], [-4.3, -19.5], [-0.6, -21.5], [3.1, -26.6], [2.9, -33.6], [7.0, -38.3],   // the main path
		[-17.6, 10.8], [-20.0, 7.0], [-15.4, 2.6], [-10.4, 0.4],      // the terrace's path, past the fountain
		[-8.0, -7.0], [-8.5, -25.0], [-10.0, -27.6], [4.6, -12.8],    // by the pond, the gazebo, the ladder
		[7.8, -29.6], [7.8, -32.4], [6.0, 1.3], [12.2, -3.6]          // the Box of Shame's carpet, the east path
	]) {
		const l = group(g, x, 0, z);
		add(l, new THREE.CylinderGeometry(0.025, 0.03, 0.75, 8), mat("#2e2b2b", 0.5, 0.5), 0, 0.375, 0);
		const m = new THREE.MeshStandardMaterial({ color: "#fff1d6", emissive: "#ffc26b", emissiveIntensity: 2 });
		add(l, rbox(0.16, 0.2, 0.16, 0.03), m, 0, 0.82, 0, { cast: false });
		add(l, new THREE.ConeGeometry(0.14, 0.1, 4), mat("#2e2b2b", 0.5, 0.5), 0, 0.97, 0, { ry: Math.PI / 4, cast: false });
		m.userData.ph = R() * 6;
		lamps.push(m);
		k.box(x - 0.08, x + 0.08, z - 0.08, z + 0.08);
	}
	const flies = [];
	const flyM = new THREE.SpriteMaterial({ map: canvasTex(32, 32, (c, w, h) => { const gr = c.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, "rgba(255,255,200,1)"); gr.addColorStop(0.3, "rgba(220,255,140,0.7)"); gr.addColorStop(1, "rgba(200,255,120,0)"); c.fillStyle = gr; c.fillRect(0, 0, w, h); }), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
	for (let i = 0; i < 140; i++) {
		const s = new THREE.Sprite(flyM.clone());
		s.scale.setScalar(0.12);
		// (over the big lawn, or the west wing - never out over the pool deck, nor inside the Box of Shame)
		const wing = i % 8 === 0;
		let x, z;
		do { x = HW0 + 1 + R() * (HW1 - HW0 - 2); z = HD0 + 1 + R() * (HD1 - HD0 - 2); } while (x > BOX.x0 - 1.2 && x < BOX.x1 + 1.2 && z > BOX.z0 - 1.2 && z < BOX.z1 + 1.2);
		s.userData = wing ? { x: HW0 + 1 + R() * (WING.x1 - HW0 - 2), z: HD1 + R() * (WING.z1 - HD1 - 1), y: 0.4 + R() * 1.6, ph: R() * 6, sp: 0.2 + R() * 0.3 }
			: { x, z, y: 0.4 + R() * 1.6, ph: R() * 6, sp: 0.2 + R() * 0.3 };
		g.add(s);
		flies.push(s);
	}

	// ---------------------------------------------------------------- every frame
	function update(dt, t) {
		const tt = performance.now() / 1000;
		// koi circle the pond (and rush to the middle when fed)
		const fed = tt - fedAt < 6;
		koi.forEach((f, i) => {
			const u = f.userData, a = t * u.sp + u.ph, r = fed ? 0.2 + 0.1 * Math.sin(t * 3 + i) : u.r;
			u.rr = (u.rr === undefined ? r : u.rr + (r - u.rr) * Math.min(1, dt * 2));
			const x = Math.cos(a) * u.rr * POND.rx, z = Math.sin(a) * u.rr * POND.rz;
			f.position.set(x, 0.035, z);
			f.rotation.y = Math.atan2(-Math.sin(a) * POND.rx, Math.cos(a) * POND.rz);   // (heads along +z: facing the way it swims)
			u.tail.rotation.y = Math.sin(t * 9 + i) * 0.5;
		});
		// the fountain: water falling from the bowl's rim, bubbling up from the heart; wishing coins sail in
		ftnWaterM.emissiveIntensity = 0.4 + Math.sin(t * 1.3) * 0.08;
		ftnDrops.forEach(d => {
			const u = d.userData, f = (t * (u.kind === "rim" ? 0.9 : 1.2) + u.ph) % 1;
			if (u.kind === "rim") { const r = 0.6 + f * 0.25; d.position.set(Math.cos(u.a) * r, 1.22 - f * f * 0.86, Math.sin(u.a) * r); }
			else { const r = f * 0.4; d.position.set(Math.cos(u.a) * r, 1.85 + f * 0.55 - f * f * 0.75, Math.sin(u.a) * r); }
		});
		for (const c of coins) {
			const u = c.userData;
			if (u.t >= 1) continue;
			u.t = Math.min(1, u.t + dt / 0.7);
			c.position.set(u.sx + (u.ex - u.sx) * u.t, 1.2 + Math.sin(u.t * Math.PI) * 0.9 - u.t * 1.12, u.sz + (u.ez - u.sz) * u.t);
			c.rotation.x += dt * 14;
			if (u.t >= 1) c.rotation.set(0, R() * 3, 0);
		}
		pads.forEach(p => { p.position.y = 0.075 + Math.sin(t * 1.2 + p.userData.ph) * 0.004; p.rotation.z = Math.sin(t * 0.3 + p.userData.ph) * 0.2; });
		waterM.emissiveIntensity = 0.35 + Math.sin(t * 0.8) * 0.08;
		for (let i = ripples.length - 1; i >= 0; i--) {
			const r = ripples[i];
			r.userData.life += dt;
			r.scale.setScalar(1 + r.userData.life * 4);
			r.material.opacity = Math.max(0, 0.5 - r.userData.life * 0.35);
			if (r.material.opacity <= 0) { pond.remove(r); r.material.dispose(); ripples.splice(i, 1); }
		}
		// watered flowers perk up for a bit
		const wk = Math.max(0, 1 - (tt - wateredAt) / 6);
		blooms.forEach((b, i) => { b.position.y = wk * Math.abs(Math.sin(t * 6 + i)) * 0.03; });
		for (let i = drops.length - 1; i >= 0; i--) {
			const d = drops[i], u = d.userData;
			u.life += dt;
			if (u.life < u.delay) continue;
			d.visible = true;
			u.vy -= 9.8 * dt * 0.5;
			d.position.x += u.vx * dt; d.position.y += u.vy * dt; d.position.z += u.vz * dt;
			if (d.position.y < 0.2) { g.remove(d); drops.splice(i, 1); }
		}
		// lights twinkle, trees sway, fireflies drift and blink
		eaveBulbs.forEach((b, i) => { b.material.emissiveIntensity = 1.5 + Math.sin(t * 2.4 + i * 0.8) * 0.7; });
		lanternM.emissiveIntensity = 1.8 + Math.sin(t * 1.6) * 0.3;
		lamps.forEach(m => { m.emissiveIntensity = 1.8 + Math.sin(t * 2.1 + m.userData.ph) * 0.25; });
		trees.forEach((c, i) => { c.rotation.z = Math.sin(t * 0.6 + i) * 0.025; c.rotation.x = Math.cos(t * 0.5 + i) * 0.02; });
		flies.forEach(s => {
			const u = s.userData;
			s.position.set(u.x + Math.sin(t * u.sp + u.ph) * 0.9, u.y + Math.sin(t * u.sp * 1.7 + u.ph) * 0.3, u.z + Math.cos(t * u.sp * 0.8 + u.ph * 2) * 0.9);
			s.material.opacity = Math.max(0, Math.sin(t * 1.4 + u.ph * 3)) * 0.9;
		});
	}

	return {
		update,
		onFx(d) {
			if (d.what === "koi") feedKoi();
			if (d.what === "coin" && typeof d.lx === "number") tossCoin([d.lx, d.lz]);
			if (d.what === "water" && typeof d.z === "number") waterFlowers(Math.max(bedE.z0, Math.min(bedE.z1, d.z)));
		},
		promptOpts(opts) {
			const me = ctx.me();
			if (me.sit) return;
			const free = key => !opts.some(o => o.k === key);
			// a stroll in the garden with someone: hold hands, kiss
			let near = null, nd = 2.2;
			ctx.peers().forEach((p, id) => { const dd = Math.hypot(p.x - me.x, p.z - me.z); if (dd < nd && !p.sit) { nd = dd; near = id; } });
			if (!near) return;
			const q = ctx.peers().get(near);
			const holding = me.upper === "handhold" && me.partner === near;
			if (free("R")) opts.push({ k: "R", label: holding ? "Let go of " + q.look.name + "'s hand" : "Hold " + q.look.name + "'s hand", fn: () => ctx.holdHands(near) });
			if (free("G")) opts.push({ k: "G", label: "Kiss " + q.look.name, fn: () => ctx.loveAct("smooch") });
		}
	};
}
