/**
 * Harmony World — the bedroom.
 *
 * Local coordinates: x -5..5, z -4.5..4.5. A king bed for two under a canopy of
 * fairy lights (head against the south wall), nightstands with lamps, a
 * wardrobe full of clothes (change your outfit), a vanity, a reading chair, a
 * window seat for two, and a whole wall of sliding glass that opens straight
 * out onto the pool deck. Switch the big light off and the ceiling
 * fills with glow-in-the-dark stars. The bed works like the living room's:
 * sit, lie down, sleep, cuddle, kiss goodnight, carry someone to bed.
 */
export function build(k) {
	const { THREE, add, mat, group, rbox, g, tex, ctx, canvasTex, rng } = k;
	const H = 3.0;
	const R = rng(4);

	// ---------------------------------------------------------------- room
	k.shell({
		w: 10, d: 9, h: H,
		floor: mat("#ffffff", 0.6, 0, { map: tex.wood(["#9c7a63", "#a6826a", "#8f6f5a", "#a07d66"], 10 / 4, 9 / 4, 31) }),
		wall: mat("#ffffff", 0.95, 0, { map: tex.wall("#d9cfe6", "stripes", "rgba(255,255,255,0.18)", 10 / 2, H / 2) }),
		ceil: mat("#ece6f3", 0.95),
		holes: [
			{ wall: "w", at: 2.5, w: 1.7, y1: 2.3 },   // French doors from the lounge
			{ wall: "e", at: 0.6, w: 2.2, y0: 0.75, y1: 2.45 },
			{ wall: "n", at: 0.9, w: 7.8, y1: 2.75 },   // the sliding glass wall onto the pool deck
			{ wall: "s", at: 3.9, w: 0.9, y1: 2.2 }     // the walk-in wardrobe (worldCloset.js)
		]
	});
	k.walk(-5, 5, -4.5, 4.5);
	// photo frames (5 of the house's 50: see world.js PHOTO_PLACES)
	for (const [slot, x, y, z, ry, w, h] of [[35, 1.6, 1.85, 4.46, Math.PI, 0.5, 0.62], [36, 2.4, 1.85, 4.46, Math.PI, 0.5, 0.62], [37, 4.96, 1.8, 3.2, -Math.PI / 2, 0.6, 0.45], [38, -4.96, 1.6, 0.5, Math.PI / 2, 0.55, 0.45], [39, -4.15, 1.75, -4.46, 0, 0.55, 0.45]])
		k.photo(slot, x, y, z, ry, { w, h, frame: slot % 2 ? "#fbf8f2" : "#c9a05a", metal: slot % 2 ? 0 : 0.7 });
	k.walk(-5.6, -4.0, 1.65, 3.35);   // through the doors to the lounge
	k.walk(-1.05, 2.85, -5.4, -3.6);  // through the glass wall to the pool deck
	k.walk(3.45, 4.35, 3.6, 5.6);     // into the walk-in wardrobe
	k.cam = { minX: -4.75, maxX: 4.75, minZ: -4.25, maxZ: 4.25, maxY: H - 0.15 };
	// glow-in-the-dark stars on the ceiling (they light up when the big light goes off)
	const starTex = canvasTex(1024, 1024, (c, w, h) => {
		c.fillStyle = "#000"; c.fillRect(0, 0, w, h);
		const r = rng(19);
		c.fillStyle = "#d9ffb8";
		for (let i = 0; i < 60; i++) {
			const x = r() * w, y = r() * h, s = 6 + r() * 14;
			c.save(); c.translate(x, y); c.rotate(r() * 6);
			c.beginPath();
			for (let k2 = 0; k2 < 10; k2++) { const a = k2 * Math.PI / 5, rr = k2 % 2 ? s * 0.45 : s; c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
			c.closePath(); c.fill(); c.restore();
		}
		// a crescent moon
		c.beginPath(); c.arc(w * 0.7, h * 0.3, 40, 0, Math.PI * 2); c.fill();
		c.globalCompositeOperation = "destination-out"; c.beginPath(); c.arc(w * 0.7 + 18, h * 0.3 - 10, 36, 0, Math.PI * 2); c.fill();
	});
	const starM = new THREE.MeshBasicMaterial({ color: "#ffffff", map: starTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
	add(g, new THREE.PlaneGeometry(9.8, 8.8), starM, 0, H - 0.01, 0, { rx: Math.PI / 2, cast: false, receive: false });

	// window on the east wall: frame, night view, curtains
	const frameM = mat("#fbf8f2", 0.45);
	{
		const wg = group(g, 5.0, 0, 0.6, -Math.PI / 2);
		const w = 2.2, y0 = 0.75, y1 = 2.45, cy = (y0 + y1) / 2, h = y1 - y0;
		add(wg, new THREE.PlaneGeometry(w + 0.6, h + 0.4), new THREE.MeshBasicMaterial({ map: tex.view(8), toneMapped: false }), 0, cy, -0.45, { cast: false, receive: false });
		add(wg, new THREE.BoxGeometry(w + 0.12, 0.07, 0.24), frameM, 0, y1 + 0.03, 0);
		add(wg, new THREE.BoxGeometry(0.07, h, 0.24), frameM, -w / 2 - 0.03, cy, 0);
		add(wg, new THREE.BoxGeometry(0.07, h, 0.24), frameM, w / 2 + 0.03, cy, 0);
		add(wg, new THREE.BoxGeometry(0.04, h, 0.05), frameM, 0, cy, -0.02);
		add(wg, new THREE.PlaneGeometry(w, h), new THREE.MeshPhysicalMaterial({ color: "#cfe3ff", transparent: true, opacity: 0.1, roughness: 0.05, depthWrite: false }), 0, cy, -0.04, { cast: false });
		// sheer curtains tied back on both sides
		const cg = new THREE.PlaneGeometry(0.7, 2.6, 24, 1);
		const p = cg.attributes.position;
		for (let i = 0; i < p.count; i++) { const x = p.getX(i); p.setZ(i, Math.sin(x * Math.PI * 10) * 0.03); }
		cg.computeVertexNormals();
		const cm = mat("#f3e6f0", 0.9, 0, { side: THREE.DoubleSide, transparent: true, opacity: 0.85 });
		for (const sx of [-1, 1]) add(wg, cg, cm, sx * (w / 2 + 0.3), 1.45, 0.16, { cast: false });
		add(wg, new THREE.CylinderGeometry(0.015, 0.015, w + 1.2, 8), mat("#c9a05a", 0.3, 0.9), 0, 2.78, 0.16, { rz: Math.PI / 2, cast: false });
	}
	// window seat for two under the window
	const ws = group(g, 4.6, 0, 0.6, -Math.PI / 2);
	add(ws, rbox(2.2, 0.45, 0.75, 0.03), mat("#f3eee6", 0.6), 0, 0.225, 0);
	add(ws, rbox(2.1, 0.12, 0.7, 0.06), mat("#9fb4d8", 0.85), 0, 0.5, 0);
	for (const [x, c] of [[-0.75, "#e9b4c8"], [0.75, "#f2cc8f"], [-0.35, "#ffffff"]]) add(ws, rbox(0.42, 0.38, 0.13, 0.06), mat(c, 0.85), x, 0.72, -0.27, { rx: -0.25, rz: (R() - 0.5) * 0.3 });
	k.box(4.2, 5, -0.5, 1.7);
	k.spot({ id: "winSeat0", x: 4.45, z: 0.15, h: -Math.PI / 2, y: 0.1 });
	k.spot({ id: "winSeat1", x: 4.45, z: 1.05, h: -Math.PI / 2, y: 0.1 });
	k.interact("bedroom:winseat", { label: "Sit in the window seat", stand: [3.6, 0.6], sit: ["winSeat0", "winSeat1"] }, ws);

	// light switch by the doors from the lounge (west wall)
	const sw = group(g, -4.98, 1.25, 1.3, Math.PI / 2);
	add(sw, rbox(0.09, 0.13, 0.015, 0.005), mat("#f5f1ea", 0.6), 0, 0, 0);
	const toggle = add(sw, new THREE.BoxGeometry(0.025, 0.045, 0.015), mat("#ece6dc", 0.4), 0, 0, 0.012);
	k.interact("bedroom:switch", { label: () => lights().main ? "Turn the big light off" : "Turn the big light on", stand: [-4.3, 1.3], face: -Math.PI / 2, use: () => setLights({ main: !lights().main }) }, sw);

	// ---------------------------------------------------------------- the bed
	const BX = -0.5, BZ = 3.35;   // centre of the mattress
	const bed = group(g, BX, 0, BZ);
	const frameW = mat("#e8e1d6", 0.6);
	add(bed, rbox(2.1, 0.3, 2.3, 0.05), frameW, 0, 0.2, 0);
	add(bed, rbox(2.0, 0.26, 2.2, 0.09), mat("#f7f4ee", 0.9), 0, 0.45, 0);
	add(bed, rbox(2.06, 0.1, 1.25, 0.05), mat("#c9b6e4", 0.95), 0, 0.61, -0.45);        // duvet over the foot
	add(bed, rbox(2.06, 0.06, 0.3, 0.03), mat("#b39ddb", 0.95), 0, 0.66, 0.15);           // duvet fold
	add(bed, rbox(2.1, 0.08, 0.5, 0.04), mat("#f2cc8f", 0.9), 0, 0.68, -0.85);           // throw blanket at the foot
	for (const sx of [-0.48, 0.48]) add(bed, rbox(0.75, 0.16, 0.4, 0.07), mat("#ffffff", 0.9), sx, 0.66, 0.85, { rx: -0.2 });
	// two heart cushions + a teddy bear
	// (in the strip between the two sleepers, so nobody's head ends up in a cushion)
	for (const [sz, sy, sc] of [[0.7, 0.8, 0.3], [0.42, 0.72, 0.22]]) {
		const hm = new THREE.Mesh(new THREE.ExtrudeGeometry(k.heartShape(sc), { depth: 0.08, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 3 }), mat(sc > 0.25 ? "#ff8fab" : "#ff4d6d", 0.8));
		hm.geometry.center();
		hm.position.set(0, sy, sz); hm.rotation.set(-0.35, 0, sc > 0.25 ? 0.08 : -0.1);
		hm.castShadow = true;
		bed.add(hm);
	}
	const teddy = group(bed, 0.75, 0.62, 0.5, -0.4);
	const fur = mat("#a0714f", 0.95);
	add(teddy, new THREE.SphereGeometry(0.12, 14, 12), fur, 0, 0.12, 0);
	add(teddy, new THREE.SphereGeometry(0.09, 14, 12), fur, 0, 0.3, 0.02);
	for (const sx of [-1, 1]) { add(teddy, new THREE.SphereGeometry(0.035, 10, 8), fur, sx * 0.07, 0.38, 0.02); add(teddy, new THREE.SphereGeometry(0.045, 10, 8), fur, sx * 0.11, 0.08, 0.06); }
	add(teddy, new THREE.SphereGeometry(0.035, 10, 8), mat("#e8cfb4", 0.9), 0, 0.28, 0.1);
	for (const sx of [-1, 1]) add(teddy, new THREE.SphereGeometry(0.012, 8, 6), mat("#111", 0.3), sx * 0.035, 0.33, 0.09, { cast: false });
	// tall upholstered headboard against the south wall
	add(g, rbox(2.4, 1.5, 0.14, 0.06), mat("#7a6a9c", 0.9), BX, 1.05, 4.42);
	for (let i = 0; i < 5; i++) add(g, rbox(0.42, 1.25, 0.08, 0.06), mat("#8b7bb0", 0.9), BX - 0.92 + i * 0.46, 1.08, 4.36);
	// canopy: four slim posts, a frame, and fairy lights draped across
	const brass = mat("#c9a05a", 0.3, 0.9);
	const corners = [[-1.08, -1.15], [1.08, -1.15], [-1.08, 1.12], [1.08, 1.12]];
	for (const [x, z] of corners) add(bed, new THREE.CylinderGeometry(0.025, 0.025, 2.35, 10), brass, x, 1.175, z);
	for (const z of [-1.15, 1.12]) add(bed, new THREE.CylinderGeometry(0.02, 0.02, 2.16, 8), brass, 0, 2.35, z, { rz: Math.PI / 2 });
	for (const x of [-1.08, 1.08]) add(bed, new THREE.CylinderGeometry(0.02, 0.02, 2.27, 8), brass, x, 2.35, 0, { rx: Math.PI / 2 });
	const sheer = mat("#fff4fb", 0.9, 0, { transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false });
	for (const x of [-1.08, 1.08]) for (const z of [-1.15, 1.12]) {
		const dg = new THREE.PlaneGeometry(0.45, 2.3, 10, 1);
		const p = dg.attributes.position;
		for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 22) * 0.03);
		dg.computeVertexNormals();
		add(bed, dg, sheer, x + (x < 0 ? 0.2 : -0.2), 1.2, z, { cast: false });
	}
	const fairy = [];
	const fairyCols = ["#ffd27a", "#ffb3c6", "#fff1d6", "#c7f0ff"];
	for (let s = 0; s < 3; s++) {
		const z0 = -1.15 + s * 1.13;
		for (let i = 0; i <= 14; i++) {
			const u = i / 14, x = -1.08 + u * 2.16;
			const y = 2.33 - Math.sin(u * Math.PI) * 0.28;
			const c = fairyCols[(i + s) % 4];
			const b = add(bed, new THREE.SphereGeometry(0.018, 8, 6), new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 2 }), x, y, z0, { cast: false, receive: false });
			b.userData.ph = R() * 6;
			fairy.push(b);
		}
	}
	k.box(BX - 1.12, BX + 1.12, BZ - 1.2, 4.5);
	// sleeping spots: feet toward the foot of the bed, head on the pillow (south)
	const footZ = BZ - 1.1 + 0.25, sitZ = 4.4 - 0.58;
	for (const [side, dx] of [["L", -0.47], ["R", 0.47]]) {
		const stand = [BX + dx * 3.2, 2.4];
		k.spot({ id: "bigBed" + side, x: BX + dx, z: footZ, h: Math.PI, y: 0.7, lie: true, bed: true, bedId: "bigBed", excl: ["bigBedSit" + side], up: "bigBedSit" + side, side: [BX + dx * 3.2, 3.2] });
		k.spot({ id: "bigBedSit" + side, x: BX + dx, z: sitZ, h: Math.PI, y: 0.24, bed: true, bedsit: true, bedId: "bigBed", excl: ["bigBed" + side], stand });
	}
	k.interact("bigBed", { label: "Sit on the bed", stand: [BX, BZ - 1.75], sit: ["bigBedSitL", "bigBedSitR"], lie: ["bigBedL", "bigBedR"] }, bed);
	const fairyGroup = fairy;   // (the canopy bulbs switch the fairy lights; see k.lamp("fairy") below)
	// nightstands + lamps
	const lampShadeM = new THREE.MeshStandardMaterial({ color: "#f6e7cf", roughness: 0.9, side: THREE.DoubleSide, emissive: "#ffcf8a", emissiveIntensity: 1 });
	for (const sx of [-1, 1]) {
		const ns = group(g, BX + sx * 1.55, 0, 4.15);
		add(ns, rbox(0.55, 0.6, 0.45, 0.02), frameW, 0, 0.3, 0);
		add(ns, rbox(0.47, 0.22, 0.02, 0.008), mat("#ddd3c5", 0.6), 0, 0.38, -0.23);
		add(ns, new THREE.SphereGeometry(0.015, 8, 6), brass, 0, 0.38, -0.245);
		add(ns, new THREE.CylinderGeometry(0.07, 0.09, 0.05, 18), mat("#e8e1d6", 0.4), 0, 0.63, 0);
		add(ns, new THREE.CylinderGeometry(0.012, 0.012, 0.25, 8), brass, 0, 0.77, 0);
		add(ns, new THREE.CylinderGeometry(0.11, 0.15, 0.18, 22, 1, true), lampShadeM, 0, 0.94, 0, { cast: false });
		if (sx < 0) { add(ns, rbox(0.14, 0.2, 0.03, 0.01), mat("#d4b483", 0.4, 0.6), 0.15, 0.71, 0.05, { rx: -0.2 }); }
		else { add(ns, new THREE.BoxGeometry(0.2, 0.04, 0.14), mat("#5a6f8a", 0.7), -0.1, 0.62, 0); add(ns, new THREE.BoxGeometry(0.19, 0.03, 0.13), mat("#e76f51", 0.7), -0.1, 0.655, 0.01); }
		k.box(BX + sx * 1.55 - 0.3, BX + sx * 1.55 + 0.3, 3.9, 4.5);
		k.interact("bedroom:lamp" + (sx < 0 ? "L" : "R"), { label: () => lights().lamps ? "Turn the bedside lamps off" : "Turn the bedside lamps on", stand: [BX + sx * 1.55, 3.4], face: 0, reach: 2.2, use: () => setLights({ lamps: !lights().lamps }) }, ns);
	}
	// fluffy round rug at the foot of the bed
	const rugTex = canvasTex(512, 512, (c, w, h) => {
		const gr = c.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w / 2);
		gr.addColorStop(0, "#f7eef6"); gr.addColorStop(0.85, "#ecdcea"); gr.addColorStop(1, "#d9c4d6");
		c.fillStyle = gr; c.fillRect(0, 0, w, h);
		const r = rng(8);
		for (let i = 0; i < 9000; i++) { c.fillStyle = `rgba(255,255,255,${r() * 0.2})`; c.fillRect(r() * w, r() * h, 2, 3); }
	});
	const rug = add(g, new THREE.CircleGeometry(1.5, 48), mat("#ffffff", 1, 0, { map: rugTex }), BX, 0.007, 0.9, { rx: -Math.PI / 2, cast: false });
	rug.userData.floor = true;

	// ---------------------------------------------------------------- wardrobe: open it, see your clothes, change your outfit
	const wd = group(g, -4.68, 0, -1.2, Math.PI / 2);
	const wdM = mat("#efe7da", 0.55), wdIn = mat("#e2d6c4", 0.7);
	add(wd, new THREE.BoxGeometry(2.0, 2.4, 0.04), wdM, 0, 1.2, -0.29);
	for (const sx of [-1, 1]) add(wd, new THREE.BoxGeometry(0.04, 2.4, 0.62), wdM, sx * 0.98, 1.2, 0);
	add(wd, new THREE.BoxGeometry(2.0, 0.04, 0.62), wdM, 0, 2.38, 0);
	add(wd, new THREE.BoxGeometry(2.0, 0.08, 0.62), wdM, 0, 0.04, 0);
	add(wd, new THREE.BoxGeometry(0.03, 2.3, 0.58), wdIn, 0.15, 1.2, -0.01);
	add(wd, new THREE.PlaneGeometry(1.92, 2.3), wdIn, 0, 1.2, -0.265, { cast: false });
	// left side: a rail of dresses and shirts on hangers
	add(wd, new THREE.CylinderGeometry(0.012, 0.012, 1.08, 8), brass, -0.42, 2.12, 0.0, { rz: Math.PI / 2 });
	const clothCols = ["#e63946", "#457b9d", "#f1faee", "#ffb3c6", "#2b2d42", "#e9c46a", "#8e7dbe"];
	for (let i = 0; i < 7; i++) {
		const x = -0.86 + i * 0.13, c = clothCols[i];
		add(wd, new THREE.TorusGeometry(0.1, 0.006, 4, 14, Math.PI), mat("#c9a05a", 0.4, 0.6), x, 2.0, 0, { ry: Math.PI / 2, cast: false });
		const long = i % 3 === 0;
		add(wd, rbox(0.04, long ? 1.25 : 0.8, 0.4, 0.02), mat(c, 0.85), x, long ? 1.4 : 1.62, 0, { cast: false });
		if (long) add(wd, rbox(0.05, 0.4, 0.46, 0.04), mat(c, 0.85), x, 0.92, 0, { cast: false });
	}
	// right side: shelves of folded sweaters and a hat box
	for (const y of [0.55, 1.15, 1.75]) add(wd, new THREE.BoxGeometry(0.78, 0.03, 0.55), wdM, 0.57, y, 0, { cast: false });
	for (let s2 = 0; s2 < 3; s2++) for (let i = 0; i < 2; i++) for (let j = 0; j < 3 - (s2 === 2 ? 1 : 0); j++)
		add(wd, rbox(0.3, 0.07, 0.36, 0.02), mat(["#ffd6a5", "#caffbf", "#9bf6ff", "#bdb2ff", "#ffc6ff", "#fdffb6"][(s2 * 2 + i + j) % 6], 0.9), 0.4 + i * 0.36, 0.61 + s2 * 0.6 + j * 0.075, 0, { cast: false });
	add(wd, new THREE.CylinderGeometry(0.18, 0.18, 0.22, 20), mat("#e9b4c8", 0.7), 0.57, 1.9, 0, { cast: false });
	// shoes along the bottom
	for (let i = 0; i < 4; i++) for (const dz of [-0.06, 0.06]) add(wd, rbox(0.1, 0.07, 0.24, 0.03), mat(["#2b2d42", "#e63946", "#f1faee", "#c9a05a"][i], 0.5), -0.8 + i * 0.22 + (dz > 0 ? 0.05 : 0), 0.12, dz * 2, { ry: Math.PI / 2, cast: false });
	// the doors
	const leaves = [];
	for (const sx of [-1, 1]) {
		const hinge = group(wd, sx * 1.0, 0, 0.32);
		add(hinge, rbox(0.98, 2.3, 0.04, 0.02), mat("#f6efe4", 0.5), -sx * 0.49, 1.2, 0);
		add(hinge, rbox(0.8, 1.9, 0.02, 0.02), mat("#e9dfcf", 0.55), -sx * 0.49, 1.2, 0.02);
		add(hinge, rbox(0.03, 0.4, 0.04, 0.01), brass, -sx * 0.9, 1.2, 0.05);
		hinge.userData.side = sx;
		leaves.push(hinge);
	}
	k.box(-5, -4.35, -2.25, -0.15);
	let wdOpen = false, wdK = 0;
	k.updaters.push(dt => { wdK += ((wdOpen ? 1 : 0) - wdK) * Math.min(1, dt * 5); leaves.forEach(l => { l.rotation.y = l.userData.side * wdK * 1.75; }); });
	const closeWardrobe = () => { wdOpen = false; ctx.sfx("click", 0.4); };
	k.interact("bedroom:wardrobe", {
		label: () => wdOpen ? "Change your outfit" : "Open the wardrobe",
		stand: [-3.85, -1.2], face: -Math.PI / 2,
		use: () => { if (!wdOpen) { wdOpen = true; ctx.sfx("whoosh", 0.4); return; } ctx.showLook(); }
	}, wd);
	// clicking a door that's open closes it (the clothes inside still change your outfit)
	leaves.forEach(l => l.traverse(c => { c.userData.interact = "bedroom:wardrobeDoor"; }));
	k.interact("bedroom:wardrobeDoor", { label: () => wdOpen ? "Close the wardrobe" : "Open the wardrobe", stand: [-3.85, -1.2], face: -Math.PI / 2, nearest: true, use: () => { if (wdOpen) closeWardrobe(); else { wdOpen = true; ctx.sfx("whoosh", 0.4); } } });

	// ---------------------------------------------------------------- vanity with a round mirror (east wall)
	const vn = group(g, 4.72, 0, -2.6, -Math.PI / 2);
	add(vn, rbox(1.3, 0.05, 0.45, 0.01), mat("#ffffff", 0.3), 0, 0.76, 0);
	for (const sx of [-0.6, 0.6]) add(vn, rbox(0.05, 0.74, 0.4, 0.01), brass, sx, 0.37, 0);
	add(vn, new THREE.TorusGeometry(0.45, 0.03, 10, 48), brass, 0, 1.5, -0.2);
	add(vn, new THREE.CircleGeometry(0.44, 48), new THREE.MeshStandardMaterial({ color: "#d9e4ea", roughness: 0.04, metalness: 1 }), 0, 1.5, -0.21, { cast: false });
	const bulbM = new THREE.MeshBasicMaterial({ color: "#fff3d6", toneMapped: false });
	const vBulbs = group(vn, 0, 0, 0);
	for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; add(vBulbs, new THREE.SphereGeometry(0.025, 8, 6), bulbM, Math.cos(a) * 0.52, 1.5 + Math.sin(a) * 0.52, -0.18, { cast: false }); }
	for (let i = 0; i < 4; i++) add(vn, new THREE.CylinderGeometry(0.025, 0.025, 0.08 + i * 0.03, 10), mat(["#ffb3c6", "#c9a05a", "#ffffff", "#e76f51"][i], 0.3), -0.4 + i * 0.12, 0.82 + i * 0.015, 0.05, { cast: false });
	const vst = group(g, 4.0, 0, -2.6);
	add(vst, new THREE.CylinderGeometry(0.22, 0.2, 0.42, 20), mat("#e9b4c8", 0.9), 0, 0.21, 0);
	k.box(4.45, 5, -3.3, -1.9);
	k.spot({ id: "vanityStool", x: 4.0, z: -2.6, h: Math.PI / 2, y: -0.06 });
	k.interact("bedroom:vanity", { label: "Sit at the vanity", stand: [3.35, -2.6], sit: ["vanityStool"] }, vn, vst);

	// ---------------------------------------------------------------- the sliding glass wall onto the pool deck (north)
	// four tall panes: the outer two are fixed, the middle two slide out of the way (shared open / shut);
	// sheer curtains on a rod can be drawn right across it
	const GZ = -4.55, GX0 = -3.0, GX1 = 4.8, PW = (GX1 - GX0) / 4, GH = 2.73;
	const alu = mat("#3a3f45", 0.4, 0.6);
	const paneGlass = new THREE.MeshPhysicalMaterial({ color: "#dff0ff", transparent: true, opacity: 0.16, roughness: 0.04, depthWrite: false, side: THREE.DoubleSide });
	add(g, new THREE.BoxGeometry(GX1 - GX0 + 0.1, 0.1, 0.32), alu, (GX0 + GX1) / 2, GH + 0.04, GZ);
	add(g, new THREE.BoxGeometry(GX1 - GX0 + 0.1, 0.03, 0.32), alu, (GX0 + GX1) / 2, 0.015, GZ, { cast: false });
	for (const x of [GX0, GX1]) add(g, new THREE.BoxGeometry(0.08, GH, 0.32), alu, x, GH / 2, GZ);
	const panes = [];
	for (let i = 0; i < 4; i++) {
		const pg = group(g, GX0 + PW * (i + 0.5), 0, GZ + (i === 1 || i === 2 ? 0.06 : -0.06));
		add(pg, new THREE.BoxGeometry(PW + 0.02, 0.06, 0.05), alu, 0, 0.05, 0);
		add(pg, new THREE.BoxGeometry(PW + 0.02, 0.06, 0.05), alu, 0, GH - 0.06, 0);
		for (const sx of [-1, 1]) add(pg, new THREE.BoxGeometry(0.05, GH, 0.05), alu, sx * PW / 2, GH / 2, 0);
		const gl = new THREE.Mesh(new THREE.PlaneGeometry(PW - 0.04, GH - 0.12), paneGlass);
		gl.position.y = GH / 2;
		pg.add(gl);
		if (i === 1 || i === 2) add(pg, new THREE.BoxGeometry(0.03, 0.5, 0.06), mat("#c9a05a", 0.3, 0.9), (i === 1 ? 1 : -1) * (PW / 2 - 0.12), 1.05, 0.04);
		pg.userData.x0 = pg.position.x;
		panes.push(pg);
	}
	add(g, new THREE.CylinderGeometry(0.016, 0.016, GX1 - GX0 + 0.6, 8), brass, (GX0 + GX1) / 2, GH + 0.18, GZ + 0.3, { rz: Math.PI / 2, cast: false });
	const sheerG = new THREE.PlaneGeometry(1, GH + 0.05, 40, 1);
	{
		const pp = sheerG.attributes.position;
		for (let i = 0; i < pp.count; i++) pp.setZ(i, Math.sin(pp.getX(i) * Math.PI * 12) * 0.035);
		sheerG.translate(0.5, 0, 0);
		sheerG.computeVertexNormals();
	}
	const sheerM = mat("#fff6fb", 0.9, 0, { side: THREE.DoubleSide, transparent: true, opacity: 0.6, depthWrite: false });
	const sheers = [];
	for (const s2 of [-1, 1]) {
		const c = new THREE.Mesh(sheerG, sheerM);
		c.position.set(s2 < 0 ? GX0 - 0.15 : GX1 + 0.15, (GH + 0.05) / 2 + 0.05, GZ + 0.3);
		c.scale.x = -s2 * 0.5;
		g.add(c);
		sheers.push(c);
	}
	let gOpen = 1, gCurt = 1;
	const glassWall = {
		leaves: panes, curtains: sheers,
		update(dt, open, curtainsOpen) {
			gOpen += ((open ? 1 : 0) - gOpen) * Math.min(1, dt * 3);
			gCurt += ((curtainsOpen ? 1 : 0) - gCurt) * Math.min(1, dt * 3);
			panes[1].position.x = panes[1].userData.x0 - gOpen * (PW - 0.02);
			panes[2].position.x = panes[2].userData.x0 + gOpen * (PW - 0.02);
			const sc = 0.5 + (1 - gCurt) * ((GX1 - GX0) / 2 - 0.2);
			sheers.forEach((c, i) => { c.scale.x = -(i ? 1 : -1) * sc; });
		}
	};
	k.addDoor("bedpool", glassWall, [GX0 + PW, GX1 - PW, -4.78, -4.32], [[0.9, -3.7], [0.9, -5.4]], ["Close the glass doors", "Open the glass doors", "Draw the sheer curtains", "Open the curtains"]);
	// outside: render round the glass, a parapet, and the wall facing east (under the house's facade: worldGrounds.js)
	const brickM = (w, h) => mat("#ffffff", 0.88, 0, { map: k.renderTex(w / 2.4, h / 2.4) });
	add(g, new THREE.PlaneGeometry(2.3, 3.1), brickM(2.3, 3.1), -4.05, 1.55, -4.72, { ry: Math.PI, cast: false });
	add(g, new THREE.PlaneGeometry(0.5, 3.1), brickM(0.5, 3.1), 5.0, 1.55, -4.72, { ry: Math.PI, cast: false });
	add(g, new THREE.PlaneGeometry(GX1 - GX0, 3.1 - GH - 0.1), brickM(GX1 - GX0, 0.3), (GX0 + GX1) / 2, (GH + 0.1 + 3.1) / 2, -4.72, { ry: Math.PI, cast: false });
	add(g, new THREE.PlaneGeometry(9.4, 3.1), brickM(9.4, 3.1), 5.21, 1.55, 0, { ry: Math.PI / 2, cast: false });
	add(g, new THREE.BoxGeometry(10.5, 0.25, 0.25), mat("#d8cfc4", 0.8), 0, 3.2, -4.75);

	// ---------------------------------------------------------------- reading corner (north-west): armchair, floor lamp, bookcase
	const ac = group(g, -4.1, 0, -3.55, Math.PI * 0.8);
	const acM = mat("#d9a5b3", 0.85);
	add(ac, rbox(0.9, 0.3, 0.85, 0.08), acM, 0, 0.3, 0);
	add(ac, rbox(0.72, 0.14, 0.66, 0.06), mat("#e8bcc8", 0.85), 0, 0.5, 0.06);
	add(ac, rbox(0.9, 0.62, 0.18, 0.08), acM, 0, 0.74, -0.34, { rx: -0.12 });
	for (const sx of [-0.4, 0.4]) add(ac, rbox(0.14, 0.42, 0.85, 0.06), acM, sx, 0.5, 0);
	add(ac, rbox(0.6, 0.04, 0.5, 0.02), mat("#f2e8d8", 0.95), 0.1, 0.62, 0.15, { rz: 0.4 });
	k.box(-4.6, -3.6, -4.05, -3.05);
	{
		const a = Math.PI * 0.8;
		k.spot({ id: "readChair", x: -4.1 + Math.sin(a) * 0.08, z: -3.55 + Math.cos(a) * 0.08, h: a, y: 0.13 });
	}
	k.interact("bedroom:chair", { label: "Curl up in the reading chair", stand: [-3.5, -2.8], sit: ["readChair"] }, ac);
	const fl = group(g, -4.6, 0, -2.6);
	add(fl, new THREE.CylinderGeometry(0.15, 0.17, 0.03, 20), brass, 0, 0.015, 0);
	add(fl, new THREE.CylinderGeometry(0.015, 0.015, 1.5, 8), brass, 0, 0.77, 0);
	const floorShadeM = new THREE.MeshStandardMaterial({ color: "#f6e7cf", roughness: 0.9, side: THREE.DoubleSide, emissive: "#ffcf8a", emissiveIntensity: 1 });
	add(fl, new THREE.CylinderGeometry(0.16, 0.22, 0.26, 22, 1, true), floorShadeM, 0, 1.6, 0, { cast: false });
	k.box(-4.8, -4.4, -2.8, -2.4);
	// a few framed photos + a big art piece over the bed area wall
	// (photo frames 94 and 95: your own photos, like every other frame in the house)
	for (const [x, slot] of [[-3.4, 94], [-2.6, 95]]) k.photo(slot, x, 1.85, 4.47, Math.PI, { w: 0.45, h: 0.58, frame: "#2b2230" });
	// dresser by the window with a plant and a little record player
	const dr = group(g, 4.6, 0, 3.2, -Math.PI / 2);
	add(dr, rbox(1.5, 0.85, 0.5, 0.02), frameW, 0, 0.425, 0);
	for (let r2 = 0; r2 < 3; r2++) for (let c2 = 0; c2 < 2; c2++) { add(dr, rbox(0.68, 0.24, 0.02, 0.01), mat("#ddd3c5", 0.6), -0.36 + c2 * 0.72, 0.15 + r2 * 0.27, 0.255); add(dr, new THREE.SphereGeometry(0.015, 8, 6), brass, -0.36 + c2 * 0.72, 0.15 + r2 * 0.27, 0.27); }
	add(dr, new THREE.CylinderGeometry(0.11, 0.09, 0.2, 16), mat("#c86b4a", 0.7), 0.5, 0.95, 0);
	for (let i = 0; i < 8; i++) add(dr, new THREE.SphereGeometry(0.08, 10, 8), mat("#4f8a57", 0.65), 0.5 + Math.cos(i) * 0.07, 1.12 + (i % 3) * 0.07, Math.sin(i) * 0.07, { cast: false });
	add(dr, new THREE.CylinderGeometry(0.05, 0.05, 0.3, 16), new THREE.MeshPhysicalMaterial({ color: "#ffffff", transparent: true, opacity: 0.35 }), -0.45, 1.0, 0, { cast: false });
	k.box(4.35, 5, 2.4, 4.0);

	// ---------------------------------------------------------------- light
	const L = {
		lampL: k.light(BX - 1.55, 1.05, 4.1, "#ffc67a", 2.6, 4.5),
		lampR: k.light(BX + 1.55, 1.05, 4.1, "#ffc67a", 2.6, 4.5),
		fairy: k.light(BX, 2.1, BZ, "#ffcfa8", 1.4, 4.5),
		floor: k.light(-4.6, 1.5, -2.6, "#ffcf8a", 2.0, 4.5),
		vanity: k.light(4.3, 1.5, -2.6, "#fff1d6", 1.4, 3),
		moon: k.light(4.2, 1.9, 0.6, "#9fb4ff", 1.6, 5),
		glow: k.light(0, 2.7, 0, "#b8a6ff", 0, 9, 1.5)
	};
	// every lamp has its own switch (the bedside pair share one, and the big light is by the door)
	k.lamp("reading", L.floor, [floorShadeM], [fl], [-4.0, -2.0], "reading lamp");
	k.lamp("vanity", L.vanity, [bulbM], [vBulbs], [3.4, -1.7], "mirror lights");
	const fairyLamp = k.lamp("fairy", null, [], fairyGroup, [BX + 1.6, 2.3], "fairy lights");
	k.key.pos.copy(k.V(0.5, H - 0.1, 0)); k.key.target.copy(k.V(0.3, 0, 0.6));
	k.key.angle = 1.3; k.key.distance = 13; k.key.intensity = 20; k.key.color.set("#ffe6cf");
	k.fill.pos.copy(k.V(0, 2.5, 0)); k.fill.intensity = 4; k.fill.distance = 18;
	k.hemi = 0.45; k.env = 0.28; k.exposure = 1.04;
	// ceiling light fitting
	const cl = add(g, new THREE.SphereGeometry(0.32, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), new THREE.MeshStandardMaterial({ color: "#fff8ee", emissive: "#fff1d6", emissiveIntensity: 1, roughness: 0.6, side: THREE.DoubleSide }), 0.5, H - 0.02, 0, { cast: false });

	// ---------------------------------------------------------------- shared light switches
	const LK = "z:bedroom:lights";
	const lights = () => Object.assign({ main: true, lamps: true }, ctx.get(LK) || {});
	function setLights(patch) { ctx.setShared(LK, Object.assign(lights(), patch)); ctx.sfx("switch"); }
	let dark = 0, lampK = 1, fairyK = 1;
	function update(dt, t) {
		const st = lights();
		dark += ((st.main ? 0 : 1) - dark) * Math.min(1, dt * 4);
		lampK += ((st.lamps ? 1 : 0) - lampK) * Math.min(1, dt * 6);
		k.key.intensity = 20 * (1 - dark);
		k.fill.intensity = 4 * (1 - dark) + 0.5;
		k.hemi = 0.45 - dark * 0.33;
		k.env = 0.28 - dark * 0.2;
		k.exposure = 1.04 - dark * 0.06;
		cl.material.emissiveIntensity = 1 - dark * 0.95;
		toggle.rotation.x = st.main ? -0.35 : 0.35;
		L.lampL.intensity = L.lampL.base * lampK; L.lampR.intensity = L.lampR.base * lampK;
		lampShadeM.emissiveIntensity = 0.1 + lampK * 1.0;
		L.glow.intensity = dark * 0.8;
		starM.opacity = dark * (0.75 + Math.sin(t * 0.8) * 0.08);
		// fairy lights twinkle (brighter in the dark)
		fairyK += ((fairyLamp.on() ? 1 : 0) - fairyK) * Math.min(1, dt * 6);
		fairy.forEach(b => { b.material.emissiveIntensity = (1.2 + Math.sin(t * 2 + b.userData.ph) * 0.8) * (1 + dark * 0.6) * (0.04 + 0.96 * fairyK); });
		L.fairy.intensity = (1.4 + dark * 0.6 + Math.sin(t * 1.3) * 0.1) * fairyK;
	}

	return {
		update,
		promptOpts(opts) {
			const me = ctx.me();
			// left open: always offer to close it again (on whichever key is free)
			if (wdOpen && !me.sit && Math.hypot(me.x - (-3.85 + k.ox), me.z - (-1.2 + k.oz)) < 2.6) {
				const key = ["R", "F", "G"].find(x => !opts.some(o => o.k === x));
				if (key) opts.push({ k: key, label: "Close the wardrobe", fn: closeWardrobe });
			}
		}
	};
}
