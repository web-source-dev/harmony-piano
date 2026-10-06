/**
 * Harmony World — the Box of Shame: a giant cardboard box in the garden, south of the hot tub (worldGarden.js).
 *
 * Local coordinates (origin at world 28.6, -24.6): x -3.5..3.5, z -2.8..2.8, ceiling 3.4 m. The door is in the
 * west wall (x -3.5) at z 0, at the end of the red carpet. Outside it's a brown cardboard box, flaps open at the
 * top, BOX OF SHAME written big on its sides and on a marquee sign on the roof. Inside it's all pink:
 *
 *   a bed covered in red roses (sit on it, lie down together), with a heart headboard and candles,
 *   the Cute Corner: a love nest - a heart-shaped floor cushion for two under a canopy of sheer pink curtains,
 *   a heart of photos, a neon sign, candles, a teddy, chocolates and balloons; a love-o-meter on the wall,
 *   and a trail of rose petals from the door to the bed.
 *
 * The door is shared (open / closed), and so is the "Do not disturb" sign you can hang on it.
 */
const W = 7.0, D = 5.6, H = 3.4, HW = W / 2, HD = D / 2;
const BED = { x: 2.3, len: 2.3, w: 2.1 };
const CC = { x: -2.1, z: -1.95 };   // the Cute Corner's heart cushion
const DOOR = { w: 1.4, h: 2.25 };

export function build(k) {
	const { THREE, add, mat, group, rbox, g, ctx, canvasTex, rng, tex } = k;
	const R = rng(1414);

	// ---------------------------------------------------------------- cardboard and wallpaper
	const kraft = (w, h, seed) => canvasTex(w, h, (c, cw, ch) => {
		c.fillStyle = "#c69c62"; c.fillRect(0, 0, cw, ch);
		const r = rng(seed);
		for (let i = 0; i < cw * ch / 60; i++) { c.fillStyle = `rgba(${r() < 0.5 ? "90,60,25" : "240,215,170"},${r() * 0.12})`; c.fillRect(r() * cw, r() * ch, 1 + r() * 3, 1); }
		// faint corrugation
		for (let x = 0; x < cw; x += 9) { c.fillStyle = "rgba(100,70,30,0.05)"; c.fillRect(x, 0, 3, ch); }
	});
	const cardM = mat("#ffffff", 0.95, 0, { map: kraft(512, 512, 3) });
	const paper = canvasTex(512, 512, (c, w, h) => {
		c.fillStyle = "#ffd6e0"; c.fillRect(0, 0, w, h);
		for (let x = 0; x < w; x += 64) { c.fillStyle = "rgba(255,255,255,0.35)"; c.fillRect(x, 0, 22, h); }
		c.fillStyle = "rgba(255,77,109,0.45)";
		for (let y = 32; y < h; y += 64) for (let x = 32 + ((y / 64) % 2) * 32; x < w; x += 64) {
			c.beginPath(); c.moveTo(x, y + 9); c.bezierCurveTo(x - 14, y - 1, x - 7, y - 12, x, y - 4); c.bezierCurveTo(x + 7, y - 12, x + 14, y - 1, x, y + 9); c.fill();
		}
	}, 3, 1.5);
	const paperM = mat("#ffffff", 0.9, 0, { map: paper });

	// ---------------------------------------------------------------- the room
	k.shell({
		w: W, d: D, h: H,
		floor: mat("#ffffff", 1, 0, { map: tex.carpet("#f7c6d0", "#ff8fab", W / 3, D / 3, false) }),
		wall: paperM,
		ceil: false,
		trim: mat("#fff0f3", 0.5),
		holes: [{ wall: "w", at: 0, w: DOOR.w, y1: DOOR.h }]
	});
	k.floor(() => 0);
	k.walk(-HW, HW, -HD, HD);
	k.walk(-HW - 0.9, -HW + 1.0, -0.66, 0.66);   // out to the garden
	k.cam = { minX: -HW + 0.2, maxX: HW - 0.2, minZ: -HD + 0.2, maxZ: HD - 0.2, maxY: H - 0.2 };
	// the cardboard walls (wallpaper inside, cardboard skin 0.23 m out): the camera stays out of them, from inside and
	// from the garden (the door's own camera wall comes with k.addDoor below: only while it's shut)
	{
		const T = 0.26, DW = DOOR.w / 2;
		k.camWall(-HW - T, HW + T, HD, HD + T, 0, H + 0.1);
		k.camWall(-HW - T, HW + T, -HD - T, -HD, 0, H + 0.1);
		k.camWall(HW, HW + T, -HD, HD, 0, H + 0.1);
		k.camWall(-HW - T, -HW, -HD, -DW, 0, H + 0.1);
		k.camWall(-HW - T, -HW, DW, HD, 0, H + 0.1);
		k.camWall(-HW - T, -HW, -DW, DW, DOOR.h, H + 0.1);
	}
	// the walls are pink wallpaper inside; outside, a skin of cardboard (a little way out from the walls, so the two
	// never flicker through each other)
	const OUT = 0.23, side = HD - DOOR.w / 2 + 0.2;
	const outer = (w, h, x, y, z, ry) => add(g, new THREE.PlaneGeometry(w, h), cardM, x, y, z, { ry, cast: false });
	outer(W + 0.46, H + 0.06, 0, (H + 0.06) / 2, HD + OUT, 0);
	outer(W + 0.46, H + 0.06, 0, (H + 0.06) / 2, -HD - OUT, Math.PI);
	outer(D + 0.46, H + 0.06, HW + OUT, (H + 0.06) / 2, 0, Math.PI / 2);
	outer(side + 0.03, H + 0.06, -HW - OUT, (H + 0.06) / 2, -(DOOR.w / 2 + side / 2), -Math.PI / 2);
	outer(side + 0.03, H + 0.06, -HW - OUT, (H + 0.06) / 2, DOOR.w / 2 + side / 2, -Math.PI / 2);
	outer(DOOR.w, H + 0.06 - DOOR.h, -HW - OUT, (H + 0.06 + DOOR.h) / 2, 0, -Math.PI / 2);
	// the cardboard's cut edges round the doorway
	for (const sz of [-1, 1]) add(g, new THREE.PlaneGeometry(OUT, DOOR.h), cardM, -HW - OUT / 2, DOOR.h / 2, sz * DOOR.w / 2, { ry: sz > 0 ? Math.PI : 0, cast: false });
	// the ceiling, and the top of the box over it
	add(g, new THREE.PlaneGeometry(W, D), mat("#ffe5ec", 0.95), 0, H, 0, { rx: Math.PI / 2, cast: false });
	add(g, new THREE.BoxGeometry(W + 0.4, 0.06, D + 0.4), cardM, 0, H + 0.03, 0, { cast: false });
	// packing tape along the top seam
	const tapeM = mat("#a9783f", 0.35, 0, { transparent: true, opacity: 0.9 });
	add(g, new THREE.BoxGeometry(W + 0.42, 0.005, 0.32), tapeM, 0, H + 0.063, 0, { cast: false });
	// the flaps, open at the top (the ones on the sign's side opened right out of the way)
	const flap = (len, depth, x, z, axis, ang) => {
		const f = group(g, x, H + 0.06, z);
		const m = add(f, new THREE.BoxGeometry(axis === "x" ? len : 0.04, depth, axis === "x" ? 0.04 : len), cardM, 0, depth / 2, 0);
		m.castShadow = true;
		if (axis === "x") f.rotation.x = ang; else f.rotation.z = ang;
	};
	flap(W + 0.4, 1.3, 0, HD + 0.2, "x", 0.45);
	flap(W + 0.4, 1.3, 0, -HD - 0.2, "x", -0.45);
	flap(D + 0.4, 1.3, HW + 0.2, 0, "z", -0.6);
	flap(D + 0.4, 1.3, -HW - 0.2, 0, "z", 1.25);

	// ---------------------------------------------------------------- BOX OF SHAME, written big on the outside
	const stamp = (w, h, draw) => new THREE.MeshBasicMaterial({ map: canvasTex(w, h, draw), transparent: true, depthWrite: false });
	const bigText = (c, text, x, y, size, col) => {
		c.save(); c.translate(x, y); c.rotate(-0.03);
		c.font = `900 ${size}px 'Nunito', 'Arial Black', sans-serif`; c.textAlign = "center"; c.textBaseline = "middle";
		c.lineWidth = size * 0.12; c.strokeStyle = "rgba(255,255,255,0.85)"; c.strokeText(text, 0, 0);
		c.fillStyle = col; c.fillText(text, 0, 0);
		c.restore();
	};
	const arrows = (c, x, y, s, col) => {
		c.fillStyle = col;
		for (const dx of [-s * 0.7, s * 0.7]) { c.beginPath(); c.moveTo(x + dx, y - s); c.lineTo(x + dx + s * 0.5, y - s * 0.3); c.lineTo(x + dx + s * 0.18, y - s * 0.3); c.lineTo(x + dx + s * 0.18, y + s * 0.6); c.lineTo(x + dx - s * 0.18, y + s * 0.6); c.lineTo(x + dx - s * 0.18, y - s * 0.3); c.lineTo(x + dx - s * 0.5, y - s * 0.3); c.closePath(); c.fill(); }
	};
	// the side that faces the pool deck and the hot tub
	add(g, new THREE.PlaneGeometry(W + 0.4, H), stamp(2048, 878, (c, w, h) => {
		bigText(c, "BOX OF SHAME", w / 2, h * 0.42, 290, "#c1121f");
		c.font = "800 70px 'Nunito', sans-serif"; c.textAlign = "center"; c.fillStyle = "#5a3d1e";
		c.fillText("♥  HANDLE WITH LOVE  ♥", w / 2, h * 0.75);
		arrows(c, 170, 150, 70, "#5a3d1e"); arrows(c, w - 170, 150, 70, "#5a3d1e");
		c.font = "800 34px 'Nunito', sans-serif"; c.fillText("THIS SIDE UP", 170, 250); c.fillText("THIS SIDE UP", w - 170, 250);
	}), 0, H / 2, HD + 0.25, { cast: false, receive: false });
	// the back
	add(g, new THREE.PlaneGeometry(W + 0.4, H), stamp(2048, 878, (c, w, h) => {
		bigText(c, "BOX OF SHAME", w / 2, h * 0.45, 250, "#c1121f");
		c.save(); c.translate(w * 0.78, h * 0.8); c.rotate(-0.12); c.strokeStyle = "#d62828"; c.lineWidth = 12; c.strokeRect(-230, -60, 460, 120);
		c.font = "900 84px 'Nunito', sans-serif"; c.fillStyle = "#d62828"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("FRAGILE", 0, 4); c.restore();
	}), 0, H / 2, -HD - 0.25, { ry: Math.PI, cast: false, receive: false });
	// the far end
	add(g, new THREE.PlaneGeometry(D + 0.4, H), stamp(1600, 800, (c, w, h) => {
		bigText(c, "BOX OF", w / 2, h * 0.36, 250, "#c1121f");
		bigText(c, "SHAME", w / 2, h * 0.68, 250, "#c1121f");
	}), HW + 0.25, H / 2, 0, { ry: Math.PI / 2, cast: false, receive: false });
	// the door end: the name over the door, "fragile" either side
	add(g, new THREE.PlaneGeometry(D + 0.4, H - DOOR.h - 0.05), stamp(2048, 256, (c, w, h) => { bigText(c, "BOX OF SHAME", w / 2, h / 2 + 6, 190, "#c1121f"); }), -HW - 0.25, (H + DOOR.h + 0.05) / 2, 0, { ry: -Math.PI / 2, cast: false, receive: false });
	for (const sz of [-1, 1]) {
		add(g, new THREE.PlaneGeometry(1.5, 0.75), stamp(512, 256, (c, w, h) => {
			c.save(); c.translate(w / 2, h / 2); c.rotate(sz * 0.08);
			c.strokeStyle = "#d62828"; c.lineWidth = 10; c.strokeRect(-220, -70, 440, 140);
			c.font = "900 78px 'Nunito', sans-serif"; c.fillStyle = "#d62828"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(sz < 0 ? "FRAGILE" : "♥ LOVE ♥", 0, 4); c.restore();
		}), -HW - 0.25, 1.25, sz * 1.9, { ry: -Math.PI / 2, cast: false, receive: false });
	}
	// the marquee sign on the roof, facing down the red carpet
	const marquee = group(g, -0.6, H + 0.06, 0, -Math.PI / 2);
	const signM = new THREE.MeshBasicMaterial({ map: canvasTex(2048, 512, (c, w, h) => {
		const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "#3a0a17"); gr.addColorStop(1, "#1c0610");
		c.fillStyle = gr; c.fillRect(0, 0, w, h);
		c.strokeStyle = "#ffd166"; c.lineWidth = 16; c.strokeRect(24, 24, w - 48, h - 48);
		c.font = "900 250px 'Nunito', 'Arial Black', sans-serif"; c.textAlign = "center"; c.textBaseline = "middle";
		c.shadowColor = "#ff4d6d"; c.shadowBlur = 40; c.fillStyle = "#ffe5ec"; c.fillText("BOX OF SHAME", w / 2, h / 2 + 10);
	}), toneMapped: false });
	const SW = 4.4, SH = 1.1;
	add(marquee, rbox(SW + 0.2, SH + 0.2, 0.12, 0.03), mat("#2b0a14", 0.5), 0, 0.85 + SH / 2, -0.07);
	add(marquee, new THREE.PlaneGeometry(SW, SH), signM, 0, 0.85 + SH / 2, 0, { cast: false, receive: false });
	for (const sx of [-1.4, 1.4]) add(marquee, new THREE.CylinderGeometry(0.04, 0.05, 0.85, 8), mat("#3e3a3a", 0.4, 0.6), sx, 0.425, -0.07);
	const bulbA = new THREE.MeshBasicMaterial({ color: "#ffd166", toneMapped: false }), bulbB = bulbA.clone(), bulbGeo = new THREE.SphereGeometry(0.035, 8, 6);
	const nb = 34;
	for (let i = 0; i < nb; i++) {
		const u = i / nb, per = 2 * (SW + SH);
		let d = u * per, x, y;
		if (d < SW) { x = -SW / 2 + d; y = SH / 2 + 0.07; } else if ((d -= SW) < SH) { x = SW / 2 + 0.07; y = SH / 2 - d; } else if ((d -= SH) < SW) { x = SW / 2 - d; y = -SH / 2 - 0.07; } else { d -= SW; x = -SW / 2 - 0.07; y = -SH / 2 + d; }
		add(marquee, bulbGeo, i % 2 ? bulbB : bulbA, x, 0.85 + SH / 2 + y, 0.03, { cast: false, receive: false });
	}

	// ---------------------------------------------------------------- the door (cardboard, with a heart window) and its sign
	const leaf = group(g, -HW - 0.1, 0, -DOOR.w / 2);
	const leafM = mat("#ffffff", 0.9, 0, { map: kraft(256, 512, 9) });
	add(leaf, rbox(0.05, DOOR.h - 0.02, DOOR.w - 0.04, 0.01), leafM, 0, (DOOR.h - 0.02) / 2, DOOR.w / 2);
	const win = k.heartMesh(0.42, "#ff8fab");
	win.position.set(0, 1.6, DOOR.w / 2); win.rotation.y = Math.PI / 2; win.scale.z = 0.25;
	leaf.add(win);
	add(leaf, new THREE.SphereGeometry(0.04, 12, 8), mat("#c9a05a", 0.3, 0.9), -0.05, 1.05, DOOR.w - 0.15, { cast: false });
	add(leaf, new THREE.SphereGeometry(0.04, 12, 8), mat("#c9a05a", 0.3, 0.9), 0.05, 1.05, DOOR.w - 0.15, { cast: false });
	add(leaf, new THREE.PlaneGeometry(0.9, 0.22), stamp(512, 128, (c, w, h) => { c.font = "800 62px 'Caveat', 'Nunito', cursive"; c.fillStyle = "#7a2034"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("Knock knock ♥", w / 2, h / 2 + 4); }), -0.03, 2.0, DOOR.w / 2, { ry: -Math.PI / 2, cast: false, receive: false });
	// "Do not disturb", hung on the outside handle
	const dnd = group(leaf, -0.07, 0.86, DOOR.w - 0.15);
	add(dnd, new THREE.TorusGeometry(0.05, 0.008, 6, 16), mat("#ffffff", 0.4), 0, 0.17, 0, { ry: Math.PI / 2, cast: false });
	add(dnd, new THREE.PlaneGeometry(0.22, 0.3), new THREE.MeshBasicMaterial({ map: canvasTex(256, 360, (c, w, h) => {
		c.fillStyle = "#ff4d6d"; roundR(c, 6, 6, w - 12, h - 12, 26); c.fill();
		c.fillStyle = "#fff"; c.font = "900 46px 'Nunito', sans-serif"; c.textAlign = "center"; c.textBaseline = "middle";
		c.fillText("DO NOT", w / 2, 110); c.fillText("DISTURB", w / 2, 170); c.font = "900 70px 'Nunito', sans-serif"; c.fillText("♥", w / 2, 260);
	}), side: THREE.DoubleSide }), 0, 0, 0, { ry: -Math.PI / 2, cast: false, receive: false });
	dnd.visible = false;
	let leafRot = Math.PI / 2 * 0.92;
	leaf.rotation.y = leafRot;
	k.addDoor("shame", {
		leaves: [leaf], curtains: [dnd],
		update(dt, open, curtainsOpen) {
			leafRot += ((open ? Math.PI / 2 * 0.92 : 0) - leafRot) * Math.min(1, dt * 6);
			leaf.rotation.y = leafRot;
			dnd.visible = !curtainsOpen;
		}
	}, [-HW - 0.3, -HW + 0.05, -DOOR.w / 2, DOOR.w / 2], [[-HW + 0.9, 0], [-HW - 1.2, 0]], ["Close the door", "Open the door", "Hang the Do Not Disturb sign", "Take the Do Not Disturb sign down"]);
	// over the door, inside
	add(g, new THREE.PlaneGeometry(2.6, 0.4), stamp(1024, 160, (c, w, h) => { c.font = "800 80px 'Caveat', 'Nunito', cursive"; c.fillStyle = "#c9184a"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("♥ welcome to the box of shame ♥", w / 2, h / 2 + 4); }), -HW + 0.02, 2.62, 0, { ry: Math.PI / 2, cast: false, receive: false });
	k.lightSwitch(-HW + 0.02, 1.25, 1.05, Math.PI / 2);

	// ---------------------------------------------------------------- the bed of roses (head against the east wall)
	const bed = group(g, BED.x, 0, 0);
	add(bed, rbox(BED.len, 0.3, BED.w, 0.05), mat("#7a1c2c", 0.6), 0, 0.2, 0);
	add(bed, rbox(BED.len - 0.1, 0.26, BED.w - 0.1, 0.09), mat("#fff5f7", 0.9), 0, 0.45, 0);
	add(bed, rbox(BED.len - 0.45, 0.08, BED.w - 0.04, 0.04), mat("#9d0208", 0.85), -0.18, 0.61, 0);   // red velvet duvet
	for (const sz of [-0.48, 0.48]) add(bed, rbox(0.42, 0.16, 0.75, 0.07), mat("#ffe5ec", 0.8), BED.len / 2 - 0.32, 0.66, sz, { rz: 0.2 });
	// heart cushions on the pillows
	for (const [sz, sc, col] of [[0, 0.3, "#ff4d6d"], [0.3, 0.22, "#ff8fab"]]) {
		const hm = k.heartMesh(sc, col);
		hm.position.set(BED.len / 2 - 0.5, 0.8, sz); hm.rotation.set(0, -Math.PI / 2, 0.25);
		bed.add(hm);
	}
	// roses all over it: hundreds of red blooms, a few leaves, petals strewn about
	{
		const n = 340;
		const rose = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.055, 1), mat("#ffffff", 0.5), n);
		const petal = new THREE.InstancedMesh(new THREE.SphereGeometry(0.04, 8, 4), mat("#ffffff", 0.6), n);
		const leafI = new THREE.InstancedMesh(new THREE.SphereGeometry(0.045, 6, 4), mat("#2d6a4f", 0.7), 70);
		const dm = new THREE.Object3D(), col = new THREE.Color();
		const reds = ["#d00000", "#e5383b", "#ba181b", "#a4133c", "#ff0a54", "#c9184a"];
		const x0 = -BED.len / 2 + 0.12, x1 = BED.len / 2 - 0.62;
		for (let i = 0; i < n; i++) {
			const x = x0 + R() * (x1 - x0), z = (R() - 0.5) * (BED.w - 0.2);
			dm.position.set(x, 0.69 + R() * 0.03, z); dm.rotation.set(R() * 3, R() * 3, R() * 3); dm.scale.set(1, 0.75, 1); dm.updateMatrix();
			rose.setMatrixAt(i, dm.matrix); rose.setColorAt(i, col.set(reds[i % reds.length]));
			// petals: on the bed and the floor round it
			const onFloor = i % 3 === 0;
			const px = onFloor ? -BED.len / 2 - 0.2 - R() * 0.6 + (R() < 0.5 ? 0 : R() * BED.len) : x0 + R() * (x1 - x0);
			const pz = onFloor ? (R() < 0.5 ? -1 : 1) * (BED.w / 2 + 0.1 + R() * 0.45) * (R() < 0.6 ? 1 : 0.3) : (R() - 0.5) * BED.w;
			dm.position.set(px, onFloor ? 0.01 : 0.66, pz); dm.rotation.set(0, R() * 6, 0); dm.scale.set(1, 0.1, 0.7); dm.updateMatrix();
			petal.setMatrixAt(i, dm.matrix); petal.setColorAt(i, col.set(reds[(i * 7) % reds.length]));
		}
		for (let i = 0; i < 70; i++) {
			dm.position.set(x0 + R() * (x1 - x0), 0.68, (R() - 0.5) * (BED.w - 0.2)); dm.rotation.set(0, R() * 6, 0); dm.scale.set(1.5, 0.3, 0.7); dm.updateMatrix();
			leafI.setMatrixAt(i, dm.matrix);
		}
		for (const im of [rose, petal, leafI]) { im.castShadow = false; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; bed.add(im); }
	}
	// the headboard: a big red velvet heart
	{
		const hb = k.heartMesh(2.1, "#a4133c");
		hb.material.emissiveIntensity = 0.12; hb.material.roughness = 0.8;
		hb.position.set(HW - 0.12, 1.3, 0); hb.rotation.y = -Math.PI / 2; hb.scale.z = 0.35;
		g.add(hb);
	}
	k.box(BED.x - BED.len / 2 - 0.05, HW, -BED.w / 2 - 0.05, BED.w / 2 + 0.05);
	// lying down: feet at the foot of the bed (west), heads on the pillows (east); sitting up against the headboard
	const footX = BED.x - BED.len / 2 + 0.25, sitX = BED.x + BED.len / 2 - 0.6;
	for (const [side, dz] of [["L", -0.47], ["R", 0.47]]) {
		k.spot({ id: "shameBed" + side, x: footX, z: dz, h: -Math.PI / 2, y: 0.7, lie: true, bed: true, bedId: "shame:bed", excl: ["shameBedSit" + side], up: "shameBedSit" + side, side: [BED.x - 0.2, Math.sign(dz) * 1.55] });
		k.spot({ id: "shameBedSit" + side, x: sitX, z: dz, h: -Math.PI / 2, y: 0.24, bed: true, bedsit: true, bedId: "shame:bed", excl: ["shameBed" + side], stand: [BED.x - 0.9, Math.sign(dz) * 1.55] });
	}
	k.interact("shame:bed", { label: "Sit on the bed of roses", stand: [BED.x - BED.len / 2 - 0.6, 0], sit: ["shameBedSitL", "shameBedSitR"], lie: ["shameBedL", "shameBedR"] }, bed);
	// nightstands with candles
	const flames = [];
	for (const sz of [-1, 1]) {
		const ns = group(g, HW - 0.4, 0, sz * 1.55);
		add(ns, rbox(0.5, 0.55, 0.45, 0.03), mat("#ffffff", 0.5), 0, 0.275, 0);
		for (let i = 0; i < 3; i++) {
			const hgt = 0.1 + i * 0.05, cx = -0.12 + i * 0.12;
			add(ns, new THREE.CylinderGeometry(0.035, 0.035, hgt, 12), mat("#fff0f3", 0.5), cx, 0.55 + hgt / 2, 0, { cast: false });
			flames.push(add(ns, new THREE.SphereGeometry(0.014, 8, 6), new THREE.MeshBasicMaterial({ color: "#ffb347", toneMapped: false }), cx, 0.57 + hgt, 0, { cast: false }));
		}
		k.box(HW - 0.68, HW, sz * 1.55 - 0.26, sz * 1.55 + 0.26);
	}

	// ---------------------------------------------------------------- a trail of rose petals from the door to the bed
	{
		const n = 140;
		const pt = new THREE.InstancedMesh(new THREE.SphereGeometry(0.035, 8, 4), mat("#ffffff", 0.6), n);
		const dm = new THREE.Object3D(), col = new THREE.Color();
		for (let i = 0; i < n; i++) {
			const u = R(), x = -HW + 0.3 + u * (BED.x - BED.len / 2 - 0.2 + HW - 0.3);
			dm.position.set(x, 0.008, (R() - 0.5) * 0.7 + Math.sin(u * 6) * 0.15); dm.rotation.set(0, R() * 6, 0); dm.scale.set(1, 0.1, 0.7); dm.updateMatrix();
			pt.setMatrixAt(i, dm.matrix); pt.setColorAt(i, col.set(i % 4 ? "#d00000" : "#ff4d6d"));
		}
		pt.castShadow = false; pt.instanceMatrix.needsUpdate = true; pt.instanceColor.needsUpdate = true;
		g.add(pt);
	}

	// ---------------------------------------------------------------- the Cute Corner: a love nest in the back corner
	// a big heart-shaped floor cushion piled with pillows, under a canopy of sheer pink curtains hung from a ring,
	// a heart of little photos on the wall, the neon sign, candles, a teddy, chocolates and balloons
	const velvet = mat("#ff8fab", 0.9);
	// the heart cushion, lying flat (its point toward the room)
	const cushion = k.heartMesh(1.75, "#ff8fab");
	cushion.material = velvet;
	cushion.rotation.x = -Math.PI / 2;
	cushion.scale.z = 0.55;
	const nest = group(g, CC.x, 0, CC.z);
	nest.add(cushion);
	cushion.position.set(0, 0.17, 0);
	// a soft blanket over one side, pillows propped against the walls behind
	add(nest, rbox(0.9, 0.04, 0.7, 0.03), mat("#fff0f3", 0.95), 0.25, 0.36, 0.05, { ry: 0.3, cast: false });
	for (const [x, z, col, sc] of [[-0.1, -0.52, "#ffffff", 0.36], [0.32, -0.5, "#c9184a", 0.42], [0.7, -0.3, "#ffc2d1", 0.34]]) {
		const p = k.heartMesh(sc, col);
		p.position.set(x, 0.52, z); p.rotation.set(-0.35, x * -0.5, 0);
		nest.add(p);
	}
	for (const [x, z, col] of [[0.05, -0.38, "#fff4f6"], [0.5, -0.3, "#ffb3c6"]]) add(nest, new THREE.SphereGeometry(0.2, 16, 12), mat(col, 0.95), x, 0.45, z, { cast: false }).scale.set(1.2, 0.8, 0.6);
	k.box(CC.x - 0.88, CC.x + 0.88, -HD, CC.z + 0.62);
	// sitting together on it, low down (like the bean bags on the terrace)
	k.spot({ id: "cuteCorner0", x: CC.x - 0.36, z: CC.z + 0.12, h: 0, y: -0.1, low: true });
	k.spot({ id: "cuteCorner1", x: CC.x + 0.36, z: CC.z + 0.12, h: 0, y: -0.1, low: true });
	k.interact("shame:cutecorner", { label: "Snuggle up in the Cute Corner", stand: [CC.x, CC.z + 1.25], sit: ["cuteCorner0", "cuteCorner1"] }, nest);

	// the canopy: a ring near the ceiling, sheer curtains falling round the corner (open toward the room)
	const RING = { x: CC.x, z: CC.z - 0.3, r: 1.0, y: H - 0.25 };
	add(g, new THREE.TorusGeometry(RING.r, 0.025, 8, 48), mat("#e9c46a", 0.3, 0.8), RING.x, RING.y, RING.z, { rx: Math.PI / 2, cast: false });
	add(g, new THREE.CylinderGeometry(0.008, 0.008, H - RING.y, 4), mat("#e9c46a", 0.3, 0.8), RING.x, (H + RING.y) / 2, RING.z, { cast: false });
	{
		// a part-cylinder, gathered into soft folds, wrapping the back of the nest
		const a0 = Math.PI * 0.3, a1 = Math.PI * 1.7;   // (the opening faces the room; the back of it is behind the wall)
		const geo = new THREE.CylinderGeometry(RING.r, RING.r * 1.18, RING.y, 72, 6, true, a0, a1 - a0);
		const pos = geo.attributes.position;
		for (let i = 0; i < pos.count; i++) {
			const x = pos.getX(i), z = pos.getZ(i), a = Math.atan2(x, z), f = 1 + Math.sin(a * 22) * 0.035;
			pos.setX(i, x * f); pos.setZ(i, z * f);
		}
		geo.computeVertexNormals();
		const sheer = new THREE.MeshStandardMaterial({ color: "#ffc2d1", transparent: true, opacity: 0.38, roughness: 0.9, side: THREE.DoubleSide, depthWrite: false });
		const cur = add(g, geo, sheer, RING.x, RING.y / 2, RING.z, { cast: false, receive: false });
		cur.renderOrder = 3;
	}
	// a heart of little photos on the wall over the nest
	{
		const ph = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.17, 0.2), new THREE.MeshBasicMaterial({ color: "#ffffff" }), 22);
		const pi = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.13, 0.12), new THREE.MeshBasicMaterial({ color: "#ffffff" }), 22);
		const dm = new THREE.Object3D(), col = new THREE.Color();
		const tones = ["#ff8fab", "#ffb3c6", "#c9184a", "#ffd6e0", "#a2d2ff", "#ffe5a0"];
		for (let i = 0; i < 22; i++) {
			const t = i / 22 * Math.PI * 2;
			const hx = 16 * Math.sin(t) ** 3, hy = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
			dm.position.set(CC.x + hx * 0.042, 1.75 + hy * 0.042, -HD + 0.012); dm.rotation.set(0, 0, (R() - 0.5) * 0.4); dm.updateMatrix();
			ph.setMatrixAt(i, dm.matrix);
			dm.position.z += 0.002; dm.position.y += 0.02; dm.updateMatrix();
			pi.setMatrixAt(i, dm.matrix); pi.setColorAt(i, col.set(tones[i % tones.length]));
		}
		for (const im of [ph, pi]) { im.castShadow = false; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; g.add(im); }
	}
	// the neon sign over it all, and a neon heart beside it
	const neonM = new THREE.MeshBasicMaterial({ map: tex.text("Cute Corner", { w: 1024, h: 256, color: "#fff0f6", glow: "#ff4fd8", font: "800 150px 'Caveat', 'Nunito', cursive" }), transparent: true, toneMapped: false, depthWrite: false });
	add(g, new THREE.PlaneGeometry(1.8, 0.45), neonM, CC.x, 2.62, -HD + 0.03, { cast: false, receive: false });
	const neonHeart = new THREE.MeshBasicMaterial({ map: canvasTex(256, 256, (c, w, h) => {
		c.shadowColor = "#ff4fd8"; c.shadowBlur = 24; c.strokeStyle = "#ffe0f0"; c.lineWidth = 12;
		c.beginPath(); c.moveTo(128, 200); c.bezierCurveTo(20, 130, 50, 40, 128, 90); c.bezierCurveTo(206, 40, 236, 130, 128, 200); c.stroke();
	}), transparent: true, toneMapped: false, depthWrite: false });
	add(g, new THREE.PlaneGeometry(0.5, 0.5), neonHeart, -HW + 0.03, 2.2, CC.z + 0.2, { ry: Math.PI / 2, cast: false, receive: false });
	// a cluster of candles on the floor by the nest, a little table with chocolates and two glasses
	const flamePos = [];
	for (const [x, z, hgt] of [[-0.95, 0.2, 0.22], [-1.05, 0.38, 0.14], [-0.82, 0.42, 0.1], [0.98, 0.25, 0.18], [1.08, 0.42, 0.12]]) {
		add(nest, new THREE.CylinderGeometry(0.04, 0.04, hgt, 12), mat("#fff0f3", 0.5), x, hgt / 2, z, { cast: false });
		flamePos.push([x, hgt + 0.02, z]);
	}
	for (const [x, y, z] of flamePos) flames.push(add(nest, new THREE.SphereGeometry(0.015, 8, 6), new THREE.MeshBasicMaterial({ color: "#ffb347", toneMapped: false }), x, y, z, { cast: false }));
	const tbl = group(g, CC.x + 1.45, 0, -HD + 0.45);
	add(tbl, new THREE.CylinderGeometry(0.24, 0.24, 0.04, 24), mat("#ffffff", 0.4), 0, 0.5, 0);
	add(tbl, new THREE.CylinderGeometry(0.03, 0.05, 0.48, 10), mat("#c9a05a", 0.3, 0.8), 0, 0.24, 0);
	const choc = k.heartMesh(0.2, "#c9184a"); choc.rotation.x = -Math.PI / 2; choc.scale.z = 0.4; choc.position.set(-0.06, 0.55, 0.05); tbl.add(choc);
	for (const [x, z] of [[0.12, -0.06], [0.05, -0.15]]) {
		const gl = group(tbl, x, 0.52, z);
		add(gl, new THREE.CylinderGeometry(0.004, 0.004, 0.1, 6), mat("#ffffff", 0.1), 0, 0.05, 0, { cast: false });
		add(gl, new THREE.CylinderGeometry(0.035, 0.02, 0.07, 12), new THREE.MeshPhysicalMaterial({ color: "#ffb3c6", transparent: true, opacity: 0.75, roughness: 0.05 }), 0, 0.135, 0, { cast: false });
	}
	k.box(CC.x + 1.17, CC.x + 1.73, -HD, -HD + 0.73);
	// heart balloons tied to the table
	const balloons = [];
	[["#ff4d6d", -0.15, 2.15], ["#ffffff", 0.1, 2.4], ["#ff8fab", 0.25, 2.05]].forEach(([col, dx, y], i) => {
		const b = k.heartMesh(0.34, col);
		b.material.roughness = 0.2; b.material.emissiveIntensity = 0.2;
		const bg = group(g, CC.x + 1.45 + dx, y, -HD + 0.35 + i * 0.1);
		bg.add(b);
		add(g, new THREE.CylinderGeometry(0.003, 0.003, y - 0.52, 4), mat("#ffffff", 0.6), CC.x + 1.45 + dx / 2, (y + 0.52) / 2, -HD + 0.4 + i * 0.05, { cast: false }).rotation.z = -dx * 0.25;
		balloons.push({ g: bg, ph: i * 1.7, y });
	});
	// a big teddy bear sitting on the cushion's left side
	{
		const td = group(nest, -0.52, 0.3, -0.32, 0.35);
		const fur = mat("#c68b59", 0.95);
		add(td, new THREE.SphereGeometry(0.26, 16, 12), fur, 0, 0.26, 0).scale.set(1, 1.05, 0.9);
		add(td, new THREE.SphereGeometry(0.19, 16, 12), fur, 0, 0.66, 0.02);
		for (const sx of [-1, 1]) { add(td, new THREE.SphereGeometry(0.07, 10, 8), fur, sx * 0.14, 0.82, 0.0); add(td, new THREE.SphereGeometry(0.09, 10, 8), fur, sx * 0.2, 0.08, 0.16); add(td, new THREE.SphereGeometry(0.08, 10, 8), fur, sx * 0.26, 0.32, 0.08); }
		add(td, new THREE.SphereGeometry(0.075, 10, 8), mat("#f1d3b3", 0.9), 0, 0.62, 0.17);
		add(td, new THREE.SphereGeometry(0.022, 8, 6), mat("#222222", 0.3), 0, 0.65, 0.24, { cast: false });
		for (const sx of [-1, 1]) add(td, new THREE.SphereGeometry(0.022, 8, 6), mat("#222222", 0.3), sx * 0.07, 0.71, 0.17, { cast: false });
		const th = k.heartMesh(0.16, "#e5383b"); th.position.set(0, 0.32, 0.24); td.add(th);
	}
	// fairy lights spiralling down the canopy (one instanced mesh, twinkling as a whole)
	const fairyM = new THREE.MeshBasicMaterial({ color: "#ffffff", toneMapped: false });
	const fairy = new THREE.InstancedMesh(new THREE.SphereGeometry(0.02, 8, 6), fairyM, 70);
	{
		const dm = new THREE.Object3D(), col = new THREE.Color();
		for (let i = 0; i < 70; i++) {
			const u = i / 69, a = Math.PI * 0.35 + u * Math.PI * 1.3, r = RING.r * (1 + u * 0.18) + 0.04;
			dm.position.set(RING.x + Math.sin(a) * r, RING.y - u * (RING.y - 0.5) + Math.sin(u * 30) * 0.05, RING.z + Math.cos(a) * r); dm.updateMatrix();
			fairy.setMatrixAt(i, dm.matrix); fairy.setColorAt(i, col.set(["#ffd6e0", "#ff8fab", "#fff4d6", "#ffc8dd"][i % 4]));
		}
		fairy.castShadow = false; fairy.instanceMatrix.needsUpdate = true; fairy.instanceColor.needsUpdate = true;
		g.add(fairy);
	}

	// ---------------------------------------------------------------- the love-o-meter (on the wall by the corner)
	const LV = { x: -2.4, y: 1.45 };
	const lmCanvas = document.createElement("canvas");
	lmCanvas.width = 256; lmCanvas.height = 512;
	const lmTex = new THREE.CanvasTexture(lmCanvas);
	lmTex.colorSpace = THREE.SRGBColorSpace;
	const lm = group(g, LV.x, LV.y, HD - 0.03, Math.PI);
	add(lm, rbox(0.46, 0.86, 0.04, 0.03), mat("#c9184a", 0.4), 0, 0, -0.01);
	add(lm, new THREE.PlaneGeometry(0.4, 0.8), new THREE.MeshBasicMaterial({ map: lmTex, toneMapped: false }), 0, 0, 0.012, { cast: false, receive: false });
	let lmShow = { v: 0, name: "", at: -1e9 }, lmLast = { v: 0, label: "" };
	function drawMeter(v, label) {
		const c = lmCanvas.getContext("2d"), w = 256, h = 512;
		c.fillStyle = "#fff0f3"; c.fillRect(0, 0, w, h);
		c.fillStyle = "#c9184a"; c.font = "900 30px Nunito, sans-serif"; c.textAlign = "center"; c.fillText("LOVE-O-METER", w / 2, 42);
		c.fillStyle = "#ffd6e0"; roundR(c, 98, 70, 60, 330, 30); c.fill();
		const gr = c.createLinearGradient(0, 400, 0, 70); gr.addColorStop(0, "#ffb3c6"); gr.addColorStop(1, "#d00000");
		c.fillStyle = gr; roundR(c, 98, 70 + 330 * (1 - v), 60, Math.max(30, 330 * v), 30); c.fill();
		c.fillStyle = "#d00000"; c.beginPath(); c.arc(128, 420, 44, 0, Math.PI * 2); c.fill();
		c.fillStyle = "#fff"; c.font = "900 30px Nunito, sans-serif"; c.fillText(Math.round(v * 100) + "%", 128, 431);
		c.fillStyle = "#7a2034"; c.font = "800 22px Nunito, sans-serif"; c.fillText(label || "Test your love!", w / 2, 495);
		lmTex.needsUpdate = true;
	}
	drawMeter(0);
	const VERDICTS = [[0.95, "Soulmates!"], [0.85, "Head over heels"], [0.7, "So in love"], [0.5, "Crushing hard"], [0, "Warming up..."]];
	const verdict = v => VERDICTS.find(([m]) => v >= m)[1];
	function testLove(v, name, local) {
		lmShow = { v, name, at: performance.now() / 1000 };
		ctx.sfx("chime", 0.4);
		if (local) {
			setTimeout(() => { ctx.notice(`Love-o-meter: <b>${Math.round(v * 100)}%</b> - ${verdict(v)}`); ctx.heartsFx(ctx.myAvatar().root, v > 0.85 ? 8 : 4, "#ff4d6d"); }, 1800);
		} else {
			setTimeout(() => ctx.notice(`<b>${ctx.esc(name)}</b> scored <b>${Math.round(v * 100)}%</b> on the love-o-meter - ${verdict(v)}`), 1800);
		}
	}
	k.interact("shame:lovemeter", {
		label: "Test your love on the love-o-meter", stand: [LV.x, HD - 0.8], face: 0, reach: 2.2,
		use: () => {
			const v = +(0.55 + Math.random() * 0.45).toFixed(2);
			ctx.doUpper("give", 1200);
			testLove(v, ctx.profile().name, true);
			ctx.send({ t: "fx", kind: "zfx", zone: "shame", what: "love", v, name: ctx.profile().name });
		}
	}, lm);

	// ---------------------------------------------------------------- light
	k.light(BED.x, 2.5, 0, "#ff8fa3", 2.6, 5);
	k.light(HW - 0.5, 1.0, 0, "#ffb070", 1.6, 3.5);
	k.light(CC.x, 2.2, CC.z + 0.9, "#ff6fb5", 2.4, 4.5);
	k.light(-1.0, 2.6, 1.2, "#ffd9e6", 1.8, 5);
	k.light(-HW + 0.6, 2.4, 0, "#ffc2d1", 1.2, 3.5);
	k.key.pos.copy(k.V(0, H - 0.15, 0)); k.key.target.copy(k.V(0.3, 0, 0));
	k.key.angle = 1.2; k.key.intensity = 12; k.key.distance = 11; k.key.color.set("#ffd6e0");
	k.fill.pos.copy(k.V(0, 2.3, 0.5)); k.fill.intensity = 3.5; k.fill.distance = 12; k.fill.color.set("#ffe0ea");
	k.hemi = 0.38; k.env = 0.22; k.exposure = 1.0;

	// ---------------------------------------------------------------- every frame
	function update(dt, t) {
		const ph = Math.floor(t * 4) % 2;
		bulbA.color.set(ph ? "#ffd166" : "#fff4d6"); bulbB.color.set(ph ? "#fff4d6" : "#ffd166");
		fairyM.color.setScalar(0.75 + Math.sin(t * 2.2) * 0.25);
		flames.forEach((f, i) => { f.scale.y = 1 + Math.sin(t * 13 + i * 2) * 0.25; });
		balloons.forEach(b => { b.g.position.y = b.y + Math.sin(t * 1.1 + b.ph) * 0.04; b.g.rotation.y = Math.sin(t * 0.7 + b.ph) * 0.4; b.g.rotation.z = Math.sin(t * 0.9 + b.ph) * 0.06; });
		// the love-o-meter fills up, wobbles, then settles on its reading
		const u = performance.now() / 1000 - lmShow.at;
		if (u < 8) {
			const fill = u < 1.6 ? Math.min(1, u / 1.6) * lmShow.v + Math.sin(u * 14) * 0.06 * (1 - u / 1.6) : lmShow.v;
			const v = Math.round(Math.max(0, Math.min(1, fill)) * 100) / 100, label = u < 1.6 ? "..." : lmShow.name.slice(0, 12) + ": " + verdict(lmShow.v);
			if (v !== lmLast.v || label !== lmLast.label) { lmLast = { v, label }; drawMeter(v, label); }
		} else if (lmLast.v !== 0) { lmLast = { v: 0, label: "" }; drawMeter(0); }
	}

	return {
		update,
		onFx(d) { if (d.what === "love" && typeof d.v === "number") testLove(d.v, d.name || "Someone", false); },
		musicAt() { return 0.5; }
	};
}

function roundR(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
