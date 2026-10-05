/**
 * Harmony World — upstairs: the loft over the east half of the lounge.
 *
 * Up the lounge stairs you step out onto a gallery floor at 3.6 m that covers the
 * lounge's east half, open to the room below behind a glass railing (lean on it and
 * look down at the sofa and the fire). Under the north window: the daybed for two.
 * By the railing: a loveseat facing the photo wall. The whole east wall is
 * the photo wall (24 of the house's 50 photo frames). In the south part, behind
 * its own walls: the disco (worldDisco.js), with a glass strip so its lights glow
 * out over the lounge.
 *
 * Local coordinates are the lounge's (x -7.95..7.95, z -6.95..6.95); y is from the
 * loft floor (3.6 m up). The loft is drawn over the lounge, but on the floor plan it
 * sits 30 m further south (ZONES.loft in worldHouse.js) so the two floors never
 * overlap; the top step of the stairs moves you across (k.portal).
 */
const HW = 7.95, HD = 6.95, EDGE = 1.8;      // the loft floor: x EDGE..HW, the whole depth
const ROOF = 3.4;                            // the lounge ceiling, from up here
// the disco's walls (its inside is worldDisco.js)
export const DISCO = { x0: 3.2, z0: 1.2, h: 3.0, door0: 4.8, door1: 6.4 };

function floorY(x, z) {
	// over the edge it's a long way down (only the camera ever goes there)
	if (x < EDGE && z > -5.55) return -3.6;
	return 0;
}

export function build(k) {
	const { THREE, add, mat, group, rbox, g, tex, ctx, canvasTex, rng } = k;
	const R = rng(57);
	k.floor(floorY);
	// the gallery (reaching into the disco's doorway and the walkway past it, so there's no seam to get stuck on)
	k.walk(EDGE, HW, -HD, DISCO.z0 + 0.6);
	k.walk(EDGE, DISCO.x0, DISCO.z0 - 0.6, HD);
	// the top of the stairs: walking down past x 1.75 puts you back on them (see the portals below)
	k.walk(0.9, 2.6, -HD, -5.55);
	// (the roof is low up here: the camera may rise above it, and the lounge's ceiling and roof are then cut away -
	// see worldHouse.js cutaway - so there's always room to see you)
	k.cam = { minX: -HW + 0.2, maxX: HW - 0.2, minZ: -HD + 0.2, maxZ: HD - 0.2, maxY: ROOF + 2.6, minY: -3.3 };

	// ---------------------------------------------------------------- the stairs: lounge <-> loft
	k.portal(true, 1.62, 1.85, -6.95, -5.5, 0.25);     // stepping up off the top step -> onto the loft
	k.portal(false, 1.0, 1.75, -6.95, -5.5, -0.25);    // back over the edge of the top step -> onto the stairs

	// ---------------------------------------------------------------- the floor and the glass railing
	const brass = mat("#c9a05a", 0.3, 0.9);
	const floorM = mat("#ffffff", 0.55, 0, { map: tex.wood(["#8a5a3c", "#94633f", "#7f5236", "#9a6a45", "#875838"], (HW - EDGE) / 4, (HD * 2) / 4, 63) });
	const fl = add(g, new THREE.PlaneGeometry(HW - EDGE, HD * 2), floorM, (HW + EDGE) / 2, 0, 0, { rx: -Math.PI / 2, cast: false });
	fl.userData.floor = true;
	const glassM = new THREE.MeshPhysicalMaterial({ color: "#cfe7ff", transparent: true, opacity: 0.14, roughness: 0.05, depthWrite: false, side: THREE.DoubleSide });
	{
		const z0 = -5.55, z1 = HD, len = z1 - z0, xr = EDGE + 0.04;
		add(g, new THREE.BoxGeometry(0.07, 0.05, len), brass, xr, 0.95, (z0 + z1) / 2, { cast: false });
		add(g, new THREE.PlaneGeometry(len, 0.88), glassM, xr, 0.48, (z0 + z1) / 2, { ry: Math.PI / 2, cast: false, receive: false });
		add(g, new THREE.BoxGeometry(0.05, 0.04, len), brass, xr, 0.04, (z0 + z1) / 2, { cast: false });
		for (let z = z0; z <= z1 + 0.01; z += len / 9) add(g, new THREE.CylinderGeometry(0.02, 0.02, 0.95, 8), brass, xr, 0.475, z, { cast: false });
	}
	k.box(EDGE - 0.1, EDGE + 0.06, -5.55, HD);
	const rug = add(g, new THREE.PlaneGeometry(3.6, 2.6), mat("#ffffff", 1, 0, { map: tex.carpet("#d8c7e8", "#8b7bb0") }), 4.6, 0.006, -3.2, { rx: -Math.PI / 2, cast: false });
	rug.userData.floor = true;

	// ---------------------------------------------------------------- the daybed for two under the north window (it used to be on the balcony)
	const DB = { x: 4.2, z: -6.45 };
	const db = group(g, DB.x, 0, DB.z);
	add(db, rbox(2.4, 0.38, 0.85, 0.05), mat("#e9dccb", 0.7), 0, 0.19, 0);
	add(db, rbox(2.3, 0.14, 0.8, 0.07), mat("#9fb4d8", 0.85), 0, 0.45, 0);
	add(db, rbox(2.4, 0.55, 0.16, 0.06), mat("#e9dccb", 0.7), 0, 0.62, -0.36);
	for (const [x, c] of [[-0.75, "#f2cc8f"], [0.0, "#ffffff"], [0.75, "#e9b4c8"]]) add(db, rbox(0.45, 0.38, 0.13, 0.06), mat(c, 0.85), x, 0.7, -0.22, { rx: -0.25 });
	add(db, rbox(0.8, 0.05, 0.75, 0.03), mat("#d8c7e8", 0.95), 0.6, 0.53, 0.05, { rz: 0.15 });
	k.box(DB.x - 1.25, DB.x + 1.25, -HD, -5.98);
	k.spot({ id: "loft0", x: DB.x - 0.45, z: -6.25, h: 0, y: 0.04 });
	k.spot({ id: "loft1", x: DB.x + 0.45, z: -6.25, h: 0, y: 0.04 });
	k.interact("loft:daybed", { label: "Curl up on the daybed", stand: [DB.x, -5.45], sit: ["loft0", "loft1"] }, db);
	// a little bookcase beside it
	const bc = group(g, 6.2, 0, -6.55);
	add(bc, rbox(0.7, 1.3, 0.45, 0.02), mat("#3b2519", 0.55), 0, 0.65, 0);
	const bookCols = ["#7b2d3b", "#2f3e5c", "#e9c46a", "#2a9d8f", "#e76f51"];
	for (let s = 0; s < 3; s++) for (let i = 0; i < 7; i++) add(bc, new THREE.BoxGeometry(0.06, 0.24 + (i % 3) * 0.04, 0.2), mat(bookCols[(i + s) % 5], 0.7), -0.26 + i * 0.085, 0.3 + s * 0.4, 0.2, { cast: false });
	k.box(5.85, 6.55, -HD, -6.3);

	// ---------------------------------------------------------------- a loveseat with its back to the railing, facing the photo wall
	const sofaM = mat("#b56576", 0.85), sofaD = mat("#9c4f60", 0.85);
	const LS = { x: 2.75, z: -2.6 };
	const ls = group(g, LS.x, 0, LS.z, Math.PI / 2);
	add(ls, rbox(1.8, 0.3, 0.9, 0.06), sofaD, 0, 0.27, 0);
	for (const sx of [-0.44, 0.44]) {
		add(ls, rbox(0.86, 0.18, 0.66, 0.08), sofaM, sx, 0.5, 0.06);
		add(ls, rbox(0.84, 0.42, 0.16, 0.08), sofaM, sx, 0.76, -0.2, { rx: -0.12 });
	}
	add(ls, rbox(1.8, 0.6, 0.24, 0.08), sofaD, 0, 0.64, -0.33, { rx: -0.06 });
	for (const sx of [-0.99, 0.99]) add(ls, rbox(0.18, 0.5, 0.9, 0.08), sofaD, sx, 0.45, 0);
	add(ls, rbox(0.4, 0.38, 0.12, 0.06), mat("#f2cc8f", 0.9), -0.7, 0.76, -0.1, { rx: -0.25, rz: 0.15 });
	k.box(LS.x - 0.45, LS.x + 0.45, LS.z - 1.0, LS.z + 1.0);
	k.spot({ id: "loftSeat0", x: LS.x + 0.09, z: LS.z - 0.44, h: Math.PI / 2, y: 0.15 });
	k.spot({ id: "loftSeat1", x: LS.x + 0.09, z: LS.z + 0.44, h: Math.PI / 2, y: 0.15 });
	k.interact("loft:loveseat", { label: "Sit and look at the photos", stand: [LS.x + 1.0, LS.z], sit: ["loftSeat0", "loftSeat1"] }, ls);
	// a floor lamp beside it (with its own switch)
	const lampShade = new THREE.MeshStandardMaterial({ color: "#f6e7cf", roughness: 0.9, side: THREE.DoubleSide, emissive: "#ffcf8a", emissiveIntensity: 1 });
	const fLamp = group(g, LS.x + 0.15, 0, LS.z - 1.35);
	add(fLamp, new THREE.CylinderGeometry(0.15, 0.17, 0.03, 20), brass, 0, 0.015, 0);
	add(fLamp, new THREE.CylinderGeometry(0.015, 0.015, 1.55, 8), brass, 0, 0.78, 0);
	add(fLamp, new THREE.CylinderGeometry(0.18, 0.24, 0.28, 22, 1, true), lampShade, 0, 1.62, 0, { cast: false });
	k.box(LS.x - 0.1, LS.x + 0.4, LS.z - 1.6, LS.z - 1.1);
	// plants in the corners
	function plant(x, z, s = 1) {
		const p = group(g, x, 0, z);
		add(p, new THREE.CylinderGeometry(0.24 * s, 0.18 * s, 0.5 * s, 18), mat("#d8cfc4", 0.7), 0, 0.25 * s, 0);
		for (let i = 0; i < 11; i++) {
			const a = i / 11 * Math.PI * 2;
			const leaf = add(p, new THREE.SphereGeometry(0.2 * s, 10, 8), mat(i % 2 ? "#4f8a57" : "#2f6b3e", 0.65), Math.cos(a) * 0.16 * s, (0.85 + (i % 3) * 0.25) * s, Math.sin(a) * 0.16 * s);
			leaf.scale.set(0.5, 1.5, 0.5); leaf.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
		}
		k.box(x - 0.3 * s, x + 0.3 * s, z - 0.3 * s, z + 0.3 * s);
	}
	plant(7.5, -6.5);
	plant(2.3, 0.6, 0.9);

	// ---------------------------------------------------------------- the photo wall: the whole east wall, 24 frames
	{
		const sign = canvasTex(1024, 160, (c, w, h) => {
			c.clearRect(0, 0, w, h);
			c.fillStyle = "#3b2a4a"; c.font = "700 104px 'Caveat', 'Segoe Script', cursive"; c.textAlign = "center"; c.textBaseline = "middle";
			c.fillText("Our Memories", w / 2, h / 2 + 6);
		});
		const signM = new THREE.MeshStandardMaterial({ map: sign, transparent: true, roughness: 0.6 });
		const sg = add(g, new THREE.PlaneGeometry(2.6, 0.4), signM, HW - 0.02, 3.05, -2.85, { ry: -Math.PI / 2, cast: false, receive: false });
		const frames = [["#1d1d22", 0], ["#fbf8f2", 0], ["#c9a05a", 0.7], ["#8a5a3c", 0]];
		let slot = 3;
		for (let row = 0; row < 4; row++) for (let col = 0; col < 6; col++) {
			const big = (row + col) % 3 === 0, w = big ? 0.78 : 0.6, h = big ? 0.56 : 0.46;
			const z = -6.05 + col * 1.3 + (row % 2 ? 0.25 : 0) + (R() - 0.5) * 0.12;
			const y = 0.72 + row * 0.56 + (R() - 0.5) * 0.06;
			const [fc, metal] = frames[(row * 6 + col) % frames.length];
			k.photo(slot++, HW - 0.03, y, z, -Math.PI / 2, { w, h, frame: fc, metal });
		}
		// fairy lights draped along the top
		const pts = [];
		for (let i = 0; i <= 24; i++) { const u = i / 24; pts.push(new THREE.Vector3(HW - 0.06, 2.82 - Math.sin(u * Math.PI * 4) * 0.08 - Math.sin(u * Math.PI) * 0.05, -6.5 + u * 7.6)); }
		const curve = new THREE.CatmullRomCurve3(pts);
		add(g, new THREE.TubeGeometry(curve, 80, 0.004, 4), mat("#2b2b2b", 0.6), 0, 0, 0, { cast: false });
		const bulbM = new THREE.MeshBasicMaterial({ color: "#ffd9a0", toneMapped: false });
		for (let i = 1; i < 40; i++) { const p = curve.getPoint(i / 40); add(g, new THREE.SphereGeometry(0.018, 8, 6), bulbM, p.x - 0.01, p.y - 0.02, p.z, { cast: false, receive: false }); }
		// a bench to sit and look at them
		const bn = group(g, HW - 1.45, 0, -2.85, Math.PI / 2);
		add(bn, rbox(2.2, 0.08, 0.45, 0.03), mat("#8a5a3c", 0.5), 0, 0.44, 0);
		for (const sx of [-0.95, 0.95]) add(bn, rbox(0.08, 0.4, 0.4, 0.02), mat("#3b2519", 0.5), sx, 0.2, 0);
		add(bn, rbox(0.5, 0.06, 0.4, 0.03), mat("#e9b4c8", 0.9), -0.45, 0.51, 0);
		k.box(HW - 1.7, HW - 1.2, -3.95, -1.75);
		k.spot({ id: "photoBench0", x: HW - 1.45, z: -3.3, h: Math.PI / 2, y: 0.02 });
		k.spot({ id: "photoBench1", x: HW - 1.45, z: -2.4, h: Math.PI / 2, y: 0.02 });
		k.interact("loft:photobench", { label: "Sit and look at the photos", stand: [HW - 2.3, -2.85], sit: ["photoBench0", "photoBench1"] }, bn);
		k.interact("loft:photowall", { label: "Put photos on the wall", stand: [HW - 2.3, -4.6], reach: 3.5, use: () => ctx.openPhotos(3) }, sg);
	}
	// three more on the north wall, either side of the window
	for (const [slot, x, y] of [[32, 1.4, 1.6], [33, 6.0, 1.75], [34, 7.0, 1.55]]) k.photo(slot, x, y, -HD + 0.03, 0, { w: 0.55, h: 0.44, frame: slot === 33 ? "#c9a05a" : "#fbf8f2", metal: slot === 33 ? 0.7 : 0 });

	// the main light switch at the top of the stairs
	k.lightSwitch(1.4, 1.0, -HD + 0.02, 0);

	// ---------------------------------------------------------------- the disco's walls (its inside is worldDisco.js)
	let neonM, spillM, glowM, discoRoof;
	{
		const plaster = mat("#eadfcf", 0.9), dark = mat("#1a1030", 0.8);
		const D = DISCO, T = 0.15;
		// a wall box: its outside (toward the loft) in plaster, its inside dark. side: which face is outside
		const wall = (x0, x1, z0, z1, y0, y1, out) => {
			const ms = [dark, dark, plaster, dark, dark, dark];   // +x -x +y -y +z -z
			ms[out] = plaster;
			add(g, new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), ms, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, { cast: false });
		};
		// west wall: solid at the ends, a long glass strip in the middle (the lights shine out over the lounge)
		const W0 = D.x0 - T / 2, W1 = D.x0 + T / 2, GZ0 = 2.4, GZ1 = 5.8, GY0 = 1.1, GY1 = 2.3;
		wall(W0, W1, D.z0, GZ0, 0, D.h, 1);
		wall(W0, W1, GZ1, HD, 0, D.h, 1);
		wall(W0, W1, GZ0, GZ1, 0, GY0, 1);
		wall(W0, W1, GZ0, GZ1, GY1, D.h, 1);
		add(g, new THREE.PlaneGeometry(GZ1 - GZ0, GY1 - GY0), new THREE.MeshPhysicalMaterial({ color: "#d9c9ff", transparent: true, opacity: 0.22, roughness: 0.05, depthWrite: false, side: THREE.DoubleSide }), D.x0, (GY0 + GY1) / 2, (GZ0 + GZ1) / 2, { ry: Math.PI / 2, cast: false, receive: false });
		for (const z of [GZ0 + 1.13, GZ0 + 2.27]) add(g, new THREE.BoxGeometry(0.06, GY1 - GY0, 0.05), mat("#2b2140", 0.5), D.x0, (GY0 + GY1) / 2, z, { cast: false });
		// north wall with the doorway
		const N0 = D.z0 - T / 2, N1 = D.z0 + T / 2;
		wall(D.x0 - T / 2, D.door0, N0, N1, 0, D.h, 5);
		wall(D.door1, HW, N0, N1, 0, D.h, 5);
		wall(D.door0, D.door1, N0, N1, 2.3, D.h, 5);
		// its ceiling (the room's own ceiling is higher), seen from above it's a flat roof
		discoRoof = add(g, new THREE.BoxGeometry(HW - D.x0 + T / 2, 0.1, HD - D.z0 + T / 2), [dark, dark, plaster, dark, dark, dark], (HW + D.x0 - T / 2) / 2, D.h + 0.05, (HD + D.z0 - T / 2) / 2, { cast: false });
		k.box(W0, W1, D.z0, HD);
		k.box(D.x0, D.door0, N0, N1);
		k.box(D.door1, HW, N0, N1);
		// a neon DISCO sign over the doorway
		const neon = canvasTex(512, 160, (c, w, h) => {
			c.clearRect(0, 0, w, h);
			c.font = "900 112px 'Nunito', 'Segoe UI', sans-serif"; c.textAlign = "center"; c.textBaseline = "middle";
			c.shadowColor = "#ff4fd8"; c.shadowBlur = 26; c.strokeStyle = "#ffb3f2"; c.lineWidth = 9; c.strokeText("DISCO", w / 2, h / 2 + 4);
			c.shadowBlur = 0; c.strokeStyle = "#ffffff"; c.lineWidth = 3; c.strokeText("DISCO", w / 2, h / 2 + 4);
		});
		neonM = new THREE.MeshBasicMaterial({ map: neon, transparent: true, toneMapped: false, depthWrite: false });
		add(g, new THREE.PlaneGeometry(1.6, 0.5), neonM, (D.door0 + D.door1) / 2, 2.62, N0 - 0.02, { ry: Math.PI, cast: false, receive: false });
		// coloured light spilling out of the doorway onto the floor
		const spill = new THREE.MeshBasicMaterial({ color: "#c77dff", transparent: true, opacity: 0.18, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending });
		add(g, new THREE.CircleGeometry(1.0, 32), spill, (D.door0 + D.door1) / 2, 0.012, D.z0 - 0.7, { rx: -Math.PI / 2, cast: false, receive: false });
		spillM = spill;
		// the disco through the glass strip, seen from outside: a soft coloured glow
		glowM = new THREE.MeshBasicMaterial({ color: "#9b5de5", transparent: true, opacity: 0.25, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
		add(g, new THREE.PlaneGeometry(GZ1 - GZ0, GY1 - GY0), glowM, D.x0 + 0.05, (GY0 + GY1) / 2, (GZ0 + GZ1) / 2, { ry: Math.PI / 2, cast: false, receive: false });
	}

	// ---------------------------------------------------------------- light
	const L = {
		lamp: k.light(LS.x + 0.15, 1.6, LS.z - 1.35, "#ffcf8a", 2.4, 6),
		wall: k.light(HW - 1.6, 2.6, -2.85, "#fff0d8", 3.0, 7)
	};
	k.lamp("lamp", L.lamp, [lampShade], [fLamp], [LS.x + 0.9, LS.z - 1.6], "floor lamp");
	// the big light is the lounge's (you're looking down into it), and its lamps light the room below
	k.key.pos.copy(k.V(0, ROOF - 0.2, -0.5)); k.key.target.copy(k.V(-0.5, -3.6, 0.6));
	k.key.angle = 1.2; k.key.intensity = 30; k.key.distance = 18; k.key.color.set("#ffe2c0");
	k.fill.pos.copy(k.V(3.0, 1.5, -1.0)); k.fill.intensity = 6; k.fill.distance = 32; k.fill.decay = 1.1;
	k.hemi = 0.45; k.env = 0.3; k.exposure = 1.05;

	// ---------------------------------------------------------------- every frame
	const hue = new THREE.Color();
	function update(dt, t) {
		hue.setHSL((t * 0.08) % 1, 0.9, 0.62);
		spillM.color.copy(hue); spillM.opacity = 0.14 + Math.sin(t * 5) * 0.04;
		glowM.color.copy(hue); glowM.opacity = 0.2 + Math.sin(t * 3.3) * 0.06;
		neonM.opacity = (t % 7) < 0.12 ? 0.5 : 1;   // a little flicker now and then
	}
	// the disco's flat roof goes when the camera is up over it from inside the disco
	return { update, cut: { disco: [discoRoof] } };
}
