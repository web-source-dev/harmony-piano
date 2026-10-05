/**
 * Harmony World — the garden: a rooftop garden past the pool deck, through the gap in its south railing.
 *
 * Local coordinates (origin at world 14.3, -24.1): x -8.85..8.9, z -6..6. The pool deck is along the
 * north edge (z +6); the way in is the gap at x -3.7..-2.3. Outdoors under the night sky, like the pool
 * (it keeps the terrace's lights and the moon).
 *
 *   a lawn with a stone path, a white gazebo with a bench for two (cuddle up in it),
 *   a koi pond with lily pads and a bench beside it, flower beds you can water,
 *   cherry trees in blossom, little lanterns along the path, and fireflies.
 */
const HW0 = -8.85, HW1 = 8.9, HD0 = -6.0, HD1 = 6.0;
const GAP = { x0: -3.7, x1: -2.3 };
const GZ = { x: 3.0, z: -2.0, r: 1.9 };          // the gazebo
const POND = { x: -5.0, z: -1.5, rx: 1.6, rz: 1.1 };

export function build(k) {
	const { THREE, add, mat, group, rbox, g, ctx, canvasTex, rng } = k;
	const R = rng(404);
	k.floor(() => 0);
	k.walk(HW0 + 0.15, HW1 - 0.15, HD0 + 0.15, HD1);
	k.walk(GAP.x0, GAP.x1, HD1 - 0.5, HD1 + 0.6);   // through the gap from the pool deck
	k.cam = { minX: HW0 - 1.5, maxX: HW1 + 1.5, minZ: HD0 - 1.5, maxZ: HD1, maxY: 8, minY: 0.2 };

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
	const lawn = add(g, new THREE.PlaneGeometry(HW1 - HW0, HD1 - HD0), mat("#ffffff", 0.95, 0, { map: grass }), (HW0 + HW1) / 2, 0, (HD0 + HD1) / 2, { rx: -Math.PI / 2, cast: false });
	lawn.userData.floor = true;
	// the roof edge under it
	const edgeM = mat("#5b4636", 0.8);
	add(g, new THREE.BoxGeometry(HW1 - HW0, 0.3, 0.1), edgeM, (HW0 + HW1) / 2, -0.15, HD0 - 0.02);
	for (const x of [HW0 - 0.02, HW1 + 0.02]) add(g, new THREE.BoxGeometry(0.1, 0.3, HD1 - HD0), edgeM, x, -0.15, (HD0 + HD1) / 2);
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
	stones([[-3.0, 5.6], [-2.2, 3.2], [0.4, 1.0], [GZ.x - 0.2, GZ.z + GZ.r + 0.3]], 11);
	stones([[-1.6, 2.4], [-3.4, 1.6], [POND.x + 1.0, POND.z + POND.rz + 0.5]], 6);

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
	railRun(HW0 + 0.05, HD0 + 0.05, HW1 - 0.05, HD0 + 0.05);
	railRun(HW0 + 0.05, HD0 + 0.05, HW0 + 0.05, HD1 - 0.05);
	railRun(HW1 - 0.05, HD0 + 0.05, HW1 - 0.05, HD1 - 0.05);
	k.box(HW0, HW1, HD0, HD0 + 0.15);
	k.box(HW0, HW0 + 0.15, HD0, HD1);
	k.box(HW1 - 0.15, HW1, HD0, HD1);

	// ---------------------------------------------------------------- flowers (instanced: hundreds of them)
	const bloomCols = ["#ff5d8f", "#ffd166", "#ffffff", "#c77dff", "#ff9e4a", "#ff8fab", "#7bdff2", "#f15bb5"];
	const blooms = [], tint = new THREE.Color(), dummy = new THREE.Object3D();
	function flowerBed(x0, x1, z0, z1) {
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
			heads.setMatrixAt(i, dummy.matrix); heads.setColorAt(i, tint.set(bloomCols[Math.floor(R() * bloomCols.length)]));
			dummy.position.set(x + (R() - 0.5) * 0.08, 0.2 + R() * 0.08, z + (R() - 0.5) * 0.08); dummy.scale.set(1, 0.4, 0.8); dummy.updateMatrix();
			leaves.setMatrixAt(i, dummy.matrix); leaves.setColorAt(i, tint.set(R() < 0.5 ? "#3f8a4a" : "#5aa864"));
		}
		for (const im of [stems, heads, leaves]) { im.castShadow = false; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; g.add(im); }
		blooms.push(heads);
		k.box(x0 - 0.05, x1 + 0.05, z0 - 0.05, z1 + 0.05);
		return { x0, x1, z0, z1, heads };
	}
	const beds = [
		flowerBed(HW1 - 1.35, HW1 - 0.3, -5.4, 4.6),    // along the east railing
		flowerBed(HW0 + 0.3, HW0 + 1.35, -5.4, -3.2),   // west, past the pond
		flowerBed(HW0 + 0.3, HW0 + 1.35, 1.2, 4.8),
		flowerBed(-2.4, 0.9, HD0 + 0.3, HD0 + 1.2)      // along the south railing
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
	cherry(6.4, 4.4, 1.0);
	cherry(-6.9, 4.6, 0.9);
	cherry(-0.8, -3.6, 0.85);

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
		label: "Water the flowers", stand: [bedE.x0 - 0.65, 0.0], face: Math.PI / 2,
		use: () => { const me = ctx.me(); const z = me.z - k.oz; waterFlowers(z); ctx.send({ t: "fx", kind: "zfx", zone: "garden", what: "water", z }); ctx.doUpper("give", 1800); setTimeout(() => ctx.heartsFx(ctx.myAvatar().root, 3, "#9be7a6"), 900); }
	}, bedE.heads);

	// ---------------------------------------------------------------- lanterns along the path, fireflies
	const lamps = [];
	for (const [x, z] of [[-3.9, 4.6], [-1.3, 3.4], [-0.6, 0.6], [1.6, 0.8], [-3.6, 0.6]]) {
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
	for (let i = 0; i < 34; i++) {
		const s = new THREE.Sprite(flyM.clone());
		s.scale.setScalar(0.12);
		s.userData = { x: HW0 + 1 + R() * (HW1 - HW0 - 2), z: HD0 + 1 + R() * (HD1 - HD0 - 2), y: 0.4 + R() * 1.6, ph: R() * 6, sp: 0.2 + R() * 0.3 };
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
