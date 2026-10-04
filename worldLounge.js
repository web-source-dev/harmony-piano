/**
 * Harmony World — the lounge: the heart of the house, through the French doors by the arcade.
 *
 * A tall two-storey room. Local coordinates: x -7.95..7.95, z -6.95..6.95,
 * ceiling at 7 m. The living-room doors are in the west wall.
 *
 *   north   stairs along the wall up to a balcony, and the cinema's doors up there
 *   middle  a big sofa facing a double-sided stone fireplace; aquarium on the east
 *           wall, jukebox in the corner, bookshelves and a reading chair by the doors
 *   south   (past the fireplace and a low shelf, on tiles) the open kitchen with an
 *           island, and the dining table; the pets' corner by the dining window
 *   east    French doors to the bedroom and to the bathroom
 *
 * Cook together at the stove (shared key z:kitchen:cook), eat at the table
 * (z:kitchen:meal), feed each other, clear the table, wash up. Light the fire
 * (z:lounge:fire). Every lamp has its own switch.
 */
import { buildPetCorner } from "./worldPets.js";

const DISHES = [
	{ id: "pancakes", name: "Pancakes", desc: "Fluffy stack, maple syrup", pot: "#e9b872", dur: 16 },
	{ id: "spaghetti", name: "Spaghetti", desc: "With meatballs", pot: "#e85d3a", dur: 20 },
	{ id: "pizza", name: "Pizza", desc: "Pepperoni, extra cheese", pot: "#f2c14e", dur: 22 },
	{ id: "ramen", name: "Ramen", desc: "Egg, noodles, warm broth", pot: "#d9a05b", dur: 18 },
	{ id: "cupcakes", name: "Cupcakes", desc: "Pink frosting, sprinkles", pot: "#f7a8c4", dur: 18 },
	{ id: "steak", name: "Steak dinner", desc: "With potatoes and greens", pot: "#7a3b2e", dur: 24 }
];
const BITES = 5;
// stairs: 24 steps of 15 cm along the north wall, up to the balcony at 3.6 m
const ST = { x0: -6.2, x1: 1.8, z0: -6.95, z1: -5.55, n: 24, rise: 0.15 };
const LAND = { x0: 1.8, x1: 5.4, z1: -5.2, y: 3.6 };
function floorY(x, z) {
	if (x >= LAND.x0 && x <= LAND.x1 && z < LAND.z1) return LAND.y;
	if (z < ST.z1 && x > ST.x0 && x < ST.x1) return Math.min(ST.n, Math.floor((x - ST.x0) / ((ST.x1 - ST.x0) / ST.n)) + 1) * ST.rise;
	return 0;
}

export function build(k) {
	const { THREE, add, mat, group, rbox, g, tex, ctx, canvasTex, rng } = k;
	const H = 7.0, HW = 7.95, HD = 6.95;
	const R = rng(21);

	// ---------------------------------------------------------------- the room
	const plaster = tex.wall("#eadfcf", "panel", "rgba(160,130,100,0.10)", 16 / 2, H / 2);
	k.shell({
		w: HW * 2, d: HD * 2, h: H,
		floor: mat("#ffffff", 0.55, 0, { map: tex.wood(["#8a5a3c", "#94633f", "#7f5236", "#9a6a45", "#875838"], 16 / 4, 14 / 4, 61) }),
		wall: mat("#ffffff", 0.9, 0, { map: plaster }),
		ceil: mat("#f1e9de", 0.95),
		holes: [
			{ wall: "w", at: 2.75, w: 1.7, y1: 2.3 },                 // the living room's French doors
			{ wall: "e", at: -2.5, w: 1.7, y1: 2.3 },                 // bedroom
			{ wall: "e", at: 3.7, w: 1.5, y1: 2.3 },                  // bathroom
			{ wall: "n", at: 3.6, w: 3.0, y0: LAND.y + 0.6, y1: LAND.y + 2.9 },   // the loft's window over the pool
			{ wall: "n", at: -2.0, w: 3.6, y0: 4.4, y1: 6.4 },        // high windows over the stairs
			{ wall: "n", at: 6.6, w: 1.52, y1: 2.3 },                  // glass doors out to the pool deck
			{ wall: "s", at: -4.6, w: 2.4, y0: 0.8, y1: 5.8 },        // tall window by the dining table
			{ wall: "s", at: 2.4, w: 1.6, y0: 1.35, y1: 2.4 }         // kitchen window over the sink
		]
	});
	k.floor(floorY);
	k.walk(-HW, HW, -HD, HD);
	k.walk(-8.6, -7.0, 1.9, 3.6);    // through to the living room
	k.walk(7.0, 8.6, -3.35, -1.65);  // bedroom
	k.walk(7.0, 8.6, 2.95, 4.45);    // bathroom
	k.walk(5.85, 7.35, -7.6, -6.0);  // out to the pool deck
	k.cam = { minX: -HW + 0.2, maxX: HW - 0.2, minZ: -HD + 0.2, maxZ: HD - 0.2, maxY: H - 0.3 };
	const brass = mat("#c9a05a", 0.3, 0.9);
	const frameM = mat("#fbf8f2", 0.45);
	const white = mat("#f7f3ec", 0.55);
	// outside, above the bedroom's roof (seen from the pool deck): brick
	add(g, new THREE.PlaneGeometry(HD * 2 + 0.4, H - 3.0), mat("#ffffff", 0.95, 0, { map: k.brickTex((HD * 2) / 2.4, (H - 3) / 2.4) }), HW + 0.42, 3.0 + (H - 3.0) / 2, 0, { ry: Math.PI / 2, cast: false });
	// exposed beams across the ceiling
	for (let x = -6; x <= 6; x += 3) add(g, new THREE.BoxGeometry(0.22, 0.3, HD * 2), mat("#6b4a33", 0.6), x, H - 0.15, 0, { cast: false });
	// windows: a frame and the night outside
	// seed: a painted night view behind the glass; 0 = the real outdoors (the north windows look out over the pool)
	function windowAt(x, z, ry, w, y0, y1, seed, bars) {
		const wg = group(g, x, 0, z, ry);
		const cy = (y0 + y1) / 2, h = y1 - y0;
		if (seed) add(wg, new THREE.PlaneGeometry(w + 0.6, h + 0.4), new THREE.MeshBasicMaterial({ map: tex.view(seed), toneMapped: false }), 0, cy, -0.45, { cast: false, receive: false });
		add(wg, new THREE.BoxGeometry(w + 0.12, 0.07, 0.24), frameM, 0, y1 + 0.03, 0);
		add(wg, new THREE.BoxGeometry(w + 0.3, 0.05, 0.34), frameM, 0, y0 - 0.02, 0.05);
		for (const sx of [-1, 1]) add(wg, new THREE.BoxGeometry(0.07, h, 0.24), frameM, sx * (w / 2 + 0.03), cy, 0);
		for (let i = 1; i < (bars || 2); i++) add(wg, new THREE.BoxGeometry(0.04, h, 0.05), frameM, -w / 2 + i * w / (bars || 2), cy, -0.02);
		for (let y = y0 + 1.2; y < y1 - 0.3; y += 1.2) add(wg, new THREE.BoxGeometry(w, 0.04, 0.05), frameM, 0, y, -0.02);
		add(wg, new THREE.PlaneGeometry(w, h), new THREE.MeshPhysicalMaterial({ color: "#cfe3ff", transparent: true, opacity: 0.08, roughness: 0.05, depthWrite: false }), 0, cy, -0.04, { cast: false });
		return wg;
	}
	windowAt(-2.0, -HD, 0, 3.6, 4.4, 6.4, 0, 3);
	windowAt(3.6, -HD, 0, 3.0, LAND.y + 0.6, LAND.y + 2.9, 0, 3);
	windowAt(-4.6, HD, Math.PI, 2.4, 0.8, 5.8, 71, 2);
	windowAt(2.4, HD, Math.PI, 1.6, 1.35, 2.4, 72, 2);
	// long sheer curtains by the tall window
	{
		const cg = new THREE.PlaneGeometry(0.9, 5.4, 24, 1);
		const p = cg.attributes.position;
		for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * Math.PI * 9) * 0.035);
		cg.computeVertexNormals();
		const cm = mat("#efe1d6", 0.95, 0, { side: THREE.DoubleSide, transparent: true, opacity: 0.85 });
		for (const sx of [-1, 1]) add(g, cg, cm, -4.6 + sx * 1.6, 3.0, HD - 0.15, { cast: false });
		add(g, new THREE.CylinderGeometry(0.018, 0.018, 4.2, 8), brass, -4.6, 5.95, HD - 0.15, { rz: Math.PI / 2, cast: false });
	}

	// ---------------------------------------------------------------- French doors: bedroom, bathroom, cinema (the living room's are its own)
	k.frenchDoor("bedroom", { x: 8.08, z: -2.5, ry: Math.PI / 2, w: 1.66, h: 2.3, depth: 0.55, side: 1, curtain: "#8b7bb0" }, [7.95, 8.25, -3.35, -1.65], [[6.9, -2.5], [9.2, -2.5]]);
	k.frenchDoor("bath", { x: 8.08, z: 3.7, ry: Math.PI / 2, w: 1.46, h: 2.3, depth: 0.55, side: 1, curtain: "#5f8f8a" }, [7.95, 8.25, 2.95, 4.45], [[6.9, 3.7], [9.2, 3.7]]);
	k.frenchDoor("loungepool", { x: 6.6, z: -7.05, ry: Math.PI, w: 1.48, h: 2.3, depth: 0.45, side: -1, curtain: "#5f8f8a" }, [5.85, 7.35, -7.25, -6.85], [[6.6, -6.2], [6.6, -7.9]]);
	// little signs over the doors
	for (const [x, y, z, ry, text, icon] of [[7.9, 2.75, -2.5, -Math.PI / 2, "Bedroom", "bed"], [7.9, 2.75, 3.7, -Math.PI / 2, "Bathroom", "bath"], [6.6, 2.75, -HD + 0.04, 0, "Pool", "wave"]]) {
		const st = tex.sign(text, icon);
		add(g, new THREE.PlaneGeometry(0.9, 0.225), new THREE.MeshStandardMaterial({ map: st, roughness: 0.45, emissive: "#ffffff", emissiveMap: st, emissiveIntensity: 0.25 }), x, y, z, { ry, cast: false });
	}

	// ---------------------------------------------------------------- stairs up to the balcony
	const tread = mat("#7a4e34", 0.5), riser = mat("#f4efe6", 0.6);
	const stepMats = [riser, riser, tread, riser, riser, riser];
	const run = (ST.x1 - ST.x0) / ST.n;
	for (let i = 1; i <= ST.n; i++) {
		const x0 = ST.x0 + (i - 1) * run, hgt = i * ST.rise;
		add(g, new THREE.BoxGeometry(run, hgt, ST.z1 - ST.z0), stepMats, x0 + run / 2, hgt / 2, (ST.z0 + ST.z1) / 2, { cast: false });
	}
	// the balcony, with panelled cupboards under it
	add(g, new THREE.BoxGeometry(LAND.x1 - LAND.x0, LAND.y, LAND.z1 - ST.z0), [riser, riser, tread, riser, riser, riser], (LAND.x0 + LAND.x1) / 2, LAND.y / 2, (ST.z0 + LAND.z1) / 2, { cast: false });
	for (let i = 0; i < 3; i++) {
		add(g, rbox(1.05, 3.0, 0.04, 0.02), mat("#ebe3d6", 0.6), LAND.x0 + 0.65 + i * 1.18, 1.6, LAND.z1 + 0.02, { cast: false });
		add(g, new THREE.SphereGeometry(0.03, 8, 6), brass, LAND.x0 + 1.05 + i * 1.18, 1.5, LAND.z1 + 0.06, { cast: false });
	}
	// glass balustrade + brass handrail: up the stairs and along the balcony
	const glassM = new THREE.MeshPhysicalMaterial({ color: "#cfe7ff", transparent: true, opacity: 0.14, roughness: 0.05, depthWrite: false, side: THREE.DoubleSide });
	{
		const zr = ST.z1 + 0.02;
		const ax = ST.x0 + 1.0, ay = floorY(ax, ST.z0 + 0.1), bx = ST.x1, by = LAND.y;
		const len = Math.hypot(bx - ax, by - ay), ang = Math.atan2(by - ay, bx - ax);
		const rail = group(g, (ax + bx) / 2, (ay + by) / 2 + 0.92, zr);
		rail.rotation.z = ang;
		add(rail, new THREE.BoxGeometry(len, 0.05, 0.07), brass, 0, 0, 0, { cast: false });
		add(rail, new THREE.PlaneGeometry(len, 0.85), glassM, 0, -0.45, 0, { cast: false, receive: false });
		for (let x = ax; x <= bx + 0.01; x += 1.4) { const y = ay + (by - ay) * (x - ax) / (bx - ax); add(g, new THREE.CylinderGeometry(0.02, 0.02, 0.92, 8), brass, x, y + 0.46, zr, { cast: false }); }
		add(g, new THREE.BoxGeometry(LAND.x1 - LAND.x0, 0.05, 0.07), brass, (LAND.x0 + LAND.x1) / 2, LAND.y + 0.95, LAND.z1 + 0.03, { cast: false });
		add(g, new THREE.PlaneGeometry(LAND.x1 - LAND.x0, 0.9), glassM, (LAND.x0 + LAND.x1) / 2, LAND.y + 0.5, LAND.z1 + 0.03, { cast: false, receive: false });
		add(g, new THREE.BoxGeometry(0.07, 0.05, LAND.z1 - ST.z0), brass, LAND.x1 + 0.03, LAND.y + 0.95, (ST.z0 + LAND.z1) / 2, { cast: false });
		add(g, new THREE.PlaneGeometry(LAND.z1 - ST.z0, 0.9), glassM, LAND.x1 + 0.03, LAND.y + 0.5, (ST.z0 + LAND.z1) / 2, { ry: Math.PI / 2, cast: false, receive: false });
	}
	k.box(ST.x0 + 1.0, ST.x1, ST.z1 - 0.05, ST.z1 + 0.1);
	k.box(LAND.x0, LAND.x1, LAND.z1 - 0.05, LAND.z1 + 0.1);
	k.box(LAND.x1, LAND.x1 + 0.12, ST.z0, LAND.z1 + 0.1);
	// the loft up on the balcony: a daybed for two under the window, cushions, a little bookcase
	const loft = group(g, 3.6, LAND.y, -6.45);
	add(loft, rbox(2.4, 0.38, 0.85, 0.05), mat("#e9dccb", 0.7), 0, 0.19, 0);
	add(loft, rbox(2.3, 0.14, 0.8, 0.07), mat("#9fb4d8", 0.85), 0, 0.45, 0);
	add(loft, rbox(2.4, 0.55, 0.16, 0.06), mat("#e9dccb", 0.7), 0, 0.62, -0.36);
	for (const [x, c] of [[-0.75, "#f2cc8f"], [0.0, "#ffffff"], [0.75, "#e9b4c8"]]) add(loft, rbox(0.45, 0.38, 0.13, 0.06), mat(c, 0.85), x, 0.7, -0.22, { rx: -0.25 });
	add(loft, rbox(0.8, 0.05, 0.75, 0.03), mat("#d8c7e8", 0.95), 0.6, 0.53, 0.05, { rz: 0.15 });
	k.box(2.35, 4.85, -HD, -5.98);
	k.spot({ id: "loft0", x: 3.15, z: -6.25, h: 0, y: LAND.y + 0.04 });
	k.spot({ id: "loft1", x: 4.05, z: -6.25, h: 0, y: LAND.y + 0.04 });
	k.interact("lounge:loft", { label: "Curl up on the daybed", stand: [3.6, -5.6], sit: ["loft0", "loft1"] }, loft);
	const lb = group(g, 2.05, LAND.y, -6.55);
	add(lb, rbox(0.45, 1.3, 0.7, 0.02), mat("#3b2519", 0.55), 0, 0.65, 0);
	for (let s2 = 0; s2 < 3; s2++) for (let i = 0; i < 5; i++) add(lb, new THREE.BoxGeometry(0.04, 0.24 + (i % 3) * 0.04, 0.2), mat(["#7b2d3b", "#2f3e5c", "#e9c46a", "#2a9d8f", "#e76f51"][(i + s2) % 5], 0.7), 0.24, 0.3 + s2 * 0.4, -0.2 + i * 0.09, { cast: false });
	k.box(1.8, 2.3, -HD, -6.15);
	// a wall light on the balcony
	const landShade = new THREE.MeshStandardMaterial({ color: "#fff1d6", emissive: "#ffcf8a", emissiveIntensity: 1.3, side: THREE.DoubleSide });
	const landLamp = group(g, 1.95, LAND.y + 2.0, -HD + 0.05);
	add(landLamp, new THREE.CylinderGeometry(0.06, 0.06, 0.02, 14), brass, 0, 0, 0.01, { rx: Math.PI / 2, cast: false });
	add(landLamp, new THREE.CylinderGeometry(0.1, 0.14, 0.2, 18, 1, true), landShade, 0, 0.05, 0.14, { cast: false });

	// ---------------------------------------------------------------- double-sided fireplace (between the sofa and the kitchen)
	const stoneTex = canvasTex(512, 512, (c, w, h) => {
		c.fillStyle = "#6b6460"; c.fillRect(0, 0, w, h);
		const r = rng(3);
		for (let row = 0; row < 10; row++) {
			let x = -r() * 60;
			while (x < w) {
				const sw = 50 + r() * 70, sh = 44 + r() * 12, t = 110 + r() * 60;
				c.fillStyle = `rgb(${t},${t * 0.94},${t * 0.88})`;
				c.beginPath(); c.ellipse(x + sw / 2, row * 52 + 26, sw / 2 - 3, sh / 2 - 3, 0, 0, Math.PI * 2); c.fill();
				x += sw;
			}
		}
	}, 2, 2);
	const stone = mat("#ffffff", 0.95, 0, { map: stoneTex });
	const FZ = 1.35;
	const fp = group(g, 0, 0, FZ);
	// two stone side pillars, a lintel, a hearth on each side, a chimney to the ceiling
	for (const sx of [-1, 1]) add(fp, new THREE.BoxGeometry(0.85, 2.4, 0.9), stone, sx * 1.17, 1.2, 0);
	add(fp, new THREE.BoxGeometry(1.5, 1.35, 0.9), stone, 0, 1.73, 0);
	add(fp, new THREE.BoxGeometry(1.5, 0.22, 0.9), stone, 0, 0.11, 0);
	add(fp, new THREE.BoxGeometry(1.4, 4.6, 0.7), stone, 0, 4.7, 0);
	for (const sz of [-1, 1]) {
		add(fp, rbox(3.3, 0.1, 0.32, 0.02), mat("#4a2f22", 0.5), 0, 2.45, sz * 0.5);
		add(fp, rbox(2.2, 0.16, 0.5, 0.02), stone, 0, 0.08, sz * 0.62);
	}
	add(fp, new THREE.PlaneGeometry(1.5, 1.04), new THREE.MeshStandardMaterial({ color: "#120806", roughness: 1, side: THREE.DoubleSide }), 0, 0.74, 0, { cast: false });
	const logM = mat("#4a2c1c", 0.9);
	for (const sz of [-0.2, 0.2]) for (const [x, rz, ry] of [[-0.18, 0.1, 0.3], [0.18, -0.1, -0.3]]) add(fp, new THREE.CylinderGeometry(0.06, 0.07, 0.7, 10), logM, x, 0.3, sz, { rz: Math.PI / 2 + rz, ry });
	const emberM = new THREE.MeshBasicMaterial({ color: "#ff5a1f", toneMapped: false, transparent: true, opacity: 0.9 });
	add(fp, new THREE.PlaneGeometry(1.2, 0.8), emberM, 0, 0.23, 0, { rx: -Math.PI / 2, cast: false, receive: false });
	const flames = [];
	const flameGeo = new THREE.ConeGeometry(0.11, 0.5, 10, 1, true);
	for (let i = 0; i < 12; i++) {
		const m = new THREE.Mesh(flameGeo, new THREE.MeshBasicMaterial({ color: i % 3 ? "#ff8a2a" : "#ffd27a", transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
		m.position.set(-0.45 + (i % 6) * 0.18, 0.5, i > 5 ? 0.18 : -0.18);
		m.userData.ph = R() * 6; m.userData.s = 0.7 + R() * 0.6;
		fp.add(m);
		flames.push(m);
	}
	// mantel things: candles, framed photos
	const candleFl = [];
	for (const sz of [-1, 1]) {
		for (const x of [-1.35, 1.35]) {
			add(fp, new THREE.CylinderGeometry(0.04, 0.04, 0.22, 12), mat("#fff8ec", 0.5), x, 2.61, sz * 0.5);
			candleFl.push(add(fp, new THREE.SphereGeometry(0.014, 8, 6), new THREE.MeshBasicMaterial({ color: "#ffd27a", toneMapped: false }), x, 2.74, sz * 0.5, { cast: false }));
		}
		const pf = group(fp, 0.75, 2.66, sz * 0.5, sz < 0 ? Math.PI : 0);
		add(pf, rbox(0.26, 0.32, 0.03, 0.01), brass, 0, 0, 0, { rx: -0.1 });
		add(pf, new THREE.PlaneGeometry(0.21, 0.27), new THREE.MeshStandardMaterial({ map: tex.art(11 + sz), roughness: 0.7 }), 0, 0, 0.018, { rx: -0.1, cast: false });
	}
	k.box(-1.65, 1.65, FZ - 0.5, FZ + 0.5);
	const FKEY = "z:lounge:fire";
	const fireOn = () => ctx.get(FKEY) !== false;
	k.interact("lounge:fire", { label: () => fireOn() ? "Put the fire out" : "Light the fire", stands: [[0, FZ - 1.2], [0, FZ + 1.2]], nearest: true, stand: [0, FZ - 1.2], use: () => { ctx.setShared(FKEY, !fireOn()); ctx.sfx("whoosh", 0.5); } }, fp);
	// low shelf continuing the divide (books, plants)
	const shelf = group(g, 3.1, 0, FZ);
	add(shelf, rbox(3.0, 0.95, 0.42, 0.02), white, 0, 0.475, 0);
	for (let i = 0; i < 3; i++) add(shelf, new THREE.BoxGeometry(0.9, 0.7, 0.02), mat("#e9dfcf", 0.6), -1.0 + i * 1.0, 0.45, 0.215, { cast: false });
	const bookCols = ["#7b2d3b", "#2f3e5c", "#e9c46a", "#2a9d8f", "#e76f51", "#6d6875"];
	for (let i = 0; i < 9; i++) add(shelf, new THREE.BoxGeometry(0.05, 0.26 + R() * 0.1, 0.22), mat(bookCols[i % 6], 0.7), -0.6 + i * 0.06, 1.08, 0);
	for (const x of [-1.2, 1.1]) {
		add(shelf, new THREE.CylinderGeometry(0.12, 0.1, 0.2, 14), mat("#c86b4a", 0.7), x, 1.05, 0);
		for (let i = 0; i < 8; i++) add(shelf, new THREE.SphereGeometry(0.09, 10, 8), mat(i % 2 ? "#4f8a57" : "#3f7a4a", 0.65), x + Math.cos(i) * 0.08, 1.22 + (i % 3) * 0.08, Math.sin(i) * 0.08, { cast: false });
	}
	k.box(1.6, 4.6, FZ - 0.22, FZ + 0.22);

	// ---------------------------------------------------------------- sofa, coffee table, rug (facing the fire)
	const sofaM = mat("#c9b79c", 0.9), sofaD = mat("#b3a084", 0.9);
	const sofa = group(g, -1.5, 0, -2.35);
	add(sofa, rbox(3.1, 0.3, 1.0, 0.06), sofaD, 0, 0.27, 0);
	for (let i = -1; i <= 1; i++) add(sofa, rbox(0.98, 0.18, 0.84, 0.08), sofaM, i * 1.0, 0.5, 0.05);
	add(sofa, rbox(3.1, 0.6, 0.26, 0.08), sofaD, 0, 0.64, -0.4, { rx: -0.06 });
	for (let i = -1; i <= 1; i++) add(sofa, rbox(0.94, 0.45, 0.18, 0.08), sofaM, i * 1.0, 0.78, -0.26, { rx: -0.12 });
	add(sofa, rbox(0.24, 0.5, 1.0, 0.08), sofaD, -1.66, 0.45, 0);
	const ch = group(g, 1.05, 0, -1.75);
	add(ch, rbox(1.0, 0.3, 2.3, 0.06), sofaD, 0, 0.27, 0);
	add(ch, rbox(0.84, 0.18, 2.2, 0.08), sofaM, -0.05, 0.5, 0);
	add(ch, rbox(0.26, 0.6, 2.3, 0.08), sofaD, 0.4, 0.64, 0, { rz: -0.06 });
	for (const z of [-0.5, 0.5]) add(ch, rbox(0.18, 0.45, 0.94, 0.08), sofaM, 0.26, 0.78, z, { rz: -0.12 });
	for (const [x, z, c, ry] of [[-2.9, -2.6, "#e07a5f", 0.3], [-1.6, -2.62, "#3d405b", 0], [1.35, -2.6, "#f2cc8f", -0.8], [1.35, -0.9, "#81b29a", -1.2]]) add(g, rbox(0.42, 0.4, 0.13, 0.06), mat(c, 0.9), x, 0.78, z, { ry, rx: -0.2 });
	add(g, rbox(0.7, 0.05, 0.9, 0.03), mat("#d8c7e8", 0.95), -2.4, 0.62, -2.3, { rz: 0.2 });
	k.box(-3.1, 0.1, -2.9, -1.85);
	k.box(0.5, 1.6, -2.9, -0.55);
	const seats = [
		{ id: "lng0", x: -2.5, z: -2.2, h: 0 }, { id: "lng1", x: -1.5, z: -2.2, h: 0 }, { id: "lng2", x: -0.5, z: -2.2, h: 0 },
		{ id: "lng3", x: 0.92, z: -1.4, h: -Math.PI / 2 }, { id: "lng4", x: 0.92, z: -0.45, h: -Math.PI / 2 }
	];
	seats.forEach(s => k.spot({ id: s.id, x: s.x, z: s.z, h: s.h, y: 0.08 }));
	k.interact("lounge:sofa", { label: "Sit on the sofa", stand: [-1.5, -1.25], sit: ["lng0", "lng1", "lng2"] }, sofa);
	k.interact("lounge:chaise", { label: "Sit on the chaise", stand: [0.15, -0.9], sit: ["lng3", "lng4"] }, ch);
	const ct = group(g, -1.0, 0, -0.7);
	add(ct, new THREE.CylinderGeometry(0.58, 0.58, 0.06, 40), mat("#5a3826", 0.4), 0, 0.42, 0);
	add(ct, new THREE.CylinderGeometry(0.46, 0.4, 0.36, 32), mat("#3b2519", 0.5), 0, 0.2, 0);
	const boardTex = canvasTex(256, 256, (c, w, h) => { for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { c.fillStyle = (i + j) % 2 ? "#3b2519" : "#e9d7b9"; c.fillRect(i * 32, j * 32, 32, 32); } });
	add(ct, new THREE.BoxGeometry(0.38, 0.02, 0.38), mat("#ffffff", 0.5, 0, { map: boardTex }), -0.1, 0.46, 0.05, { ry: 0.3 });
	for (let i = 0; i < 6; i++) add(ct, new THREE.CylinderGeometry(0.018, 0.022, 0.05, 10), mat(i % 2 ? "#f8f1e3" : "#1d1d22", 0.4), -0.25 + R() * 0.26, 0.495, -0.08 + R() * 0.26, { cast: false });
	for (const [x, z, hh] of [[0.28, -0.2, 0.18], [0.34, 0.0, 0.12]]) {
		add(ct, new THREE.CylinderGeometry(0.04, 0.04, hh, 14), mat("#fff8ec", 0.5), x, 0.45 + hh / 2, z);
		candleFl.push(add(ct, new THREE.SphereGeometry(0.013, 8, 6), new THREE.MeshBasicMaterial({ color: "#ffd27a", toneMapped: false }), x, 0.47 + hh, z, { cast: false }));
	}
	k.box(-1.6, -0.4, -1.3, -0.1);
	const rug = add(g, new THREE.PlaneGeometry(5.4, 3.8), mat("#ffffff", 1, 0, { map: tex.carpet("#8a6f5a", "#e9d7b9") }), -0.9, 0.006, -1.3, { rx: -Math.PI / 2, cast: false });
	rug.userData.floor = true;
	// a big drum pendant hanging over the sitting area
	const drumM = new THREE.MeshStandardMaterial({ color: "#f3e3c8", roughness: 0.8, side: THREE.DoubleSide, emissive: "#ffd9a0", emissiveIntensity: 0.9 });
	const drum = group(g, -1.0, 0, -1.2);
	add(drum, new THREE.CylinderGeometry(0.006, 0.006, H - 3.8, 6), mat("#222"), 0, (H + 3.8) / 2, 0, { cast: false });
	add(drum, new THREE.CylinderGeometry(0.85, 0.85, 0.5, 40, 1, true), drumM, 0, 3.55, 0, { cast: false });
	add(drum, new THREE.CircleGeometry(0.84, 40), new THREE.MeshStandardMaterial({ color: "#fff4e2", emissive: "#ffe0b0", emissiveIntensity: 0.6, transparent: true, opacity: 0.8, side: THREE.DoubleSide }), 0, 3.31, 0, { rx: Math.PI / 2, cast: false });

	// ---------------------------------------------------------------- reading corner by the living-room doors, bookshelves
	const shelfM = mat("#3b2519", 0.55);
	const bs = group(g, -HW + 0.2, 0, -3.2, Math.PI / 2);
	add(bs, new THREE.BoxGeometry(3.2, 2.4, 0.04), shelfM, 0, 1.2, -0.17);
	for (const x of [-1.6, -0.53, 0.53, 1.6]) add(bs, new THREE.BoxGeometry(0.04, 2.4, 0.36), shelfM, x, 1.2, 0);
	for (let s = 0; s < 6; s++) add(bs, new THREE.BoxGeometry(3.2, 0.04, 0.36), shelfM, 0, 0.02 + s * 0.47, 0);
	const bookGeo = new THREE.BoxGeometry(1, 1, 1);
	for (let s = 0; s < 5; s++) for (let col = 0; col < 3; col++) {
		let x = -1.56 + col * 1.06;
		const end = x + 1.0;
		while (x < end - 0.05) {
			const bw = 0.03 + R() * 0.04, bh = 0.26 + R() * 0.14;
			if (R() < 0.12) { x += 0.12; continue; }
			const b = add(bs, bookGeo, mat(bookCols[Math.floor(R() * bookCols.length)], 0.7), x + bw / 2, 0.04 + s * 0.47 + bh / 2, 0.02, { cast: false });
			b.scale.set(bw, bh, 0.26);
			x += bw + 0.004;
		}
	}
	k.box(-HW, -HW + 0.42, -4.85, -1.55);
	const rc = group(g, -6.6, 0, 0.0, Math.PI / 2);
	const leather = mat("#6e3b26", 0.55);
	add(rc, rbox(0.9, 0.3, 0.85, 0.08), leather, 0, 0.3, 0);
	add(rc, rbox(0.72, 0.14, 0.66, 0.06), mat("#7d4630", 0.55), 0, 0.5, 0.06);
	add(rc, rbox(0.9, 0.7, 0.18, 0.08), leather, 0, 0.78, -0.34, { rx: -0.12 });
	for (const sx of [-0.4, 0.4]) add(rc, rbox(0.14, 0.45, 0.85, 0.06), leather, sx, 0.5, 0);
	k.box(-7.1, -6.1, -0.5, 0.5);
	k.spot({ id: "lngChair", x: -6.52, z: 0.0, h: Math.PI / 2, y: 0.13 });
	k.interact("lounge:chair", { label: "Sit in the leather chair", stand: [-5.6, 0.0], sit: ["lngChair"] }, rc);
	const readShade = new THREE.MeshStandardMaterial({ color: "#f6e7cf", roughness: 0.9, side: THREE.DoubleSide, emissive: "#ffcf8a", emissiveIntensity: 1 });
	const fl = group(g, -7.45, 0, 0.95);
	add(fl, new THREE.CylinderGeometry(0.15, 0.17, 0.03, 20), brass, 0, 0.015, 0);
	add(fl, new THREE.CylinderGeometry(0.015, 0.015, 1.55, 8), brass, 0, 0.78, 0);
	add(fl, new THREE.CylinderGeometry(0.18, 0.24, 0.28, 22, 1, true), readShade, 0, 1.62, 0, { cast: false });
	k.box(-7.7, -7.2, 0.7, 1.2);

	// ---------------------------------------------------------------- aquarium (east wall)
	const AQ = { x: 7.55, z: 0.15, w: 2.8, h: 1.25, d: 0.7, y: 0.75 };
	const aq = group(g, AQ.x, 0, AQ.z, -Math.PI / 2);
	add(aq, rbox(AQ.w + 0.2, AQ.y, AQ.d + 0.1, 0.02), mat("#1d1d22", 0.5), 0, AQ.y / 2, 0);
	add(aq, rbox(AQ.w + 0.2, 0.18, AQ.d + 0.1, 0.02), mat("#1d1d22", 0.5), 0, AQ.y + AQ.h + 0.09, 0);
	const aqGlass = new THREE.MeshPhysicalMaterial({ color: "#d6f3ff", transparent: true, opacity: 0.12, roughness: 0.02, depthWrite: false, side: THREE.DoubleSide });
	add(aq, new THREE.BoxGeometry(AQ.w, AQ.h, AQ.d), aqGlass, 0, AQ.y + AQ.h / 2, 0, { cast: false, receive: false });
	add(aq, new THREE.BoxGeometry(AQ.w - 0.02, AQ.h - 0.12, AQ.d - 0.02), new THREE.MeshBasicMaterial({ color: "#1b8fb8", transparent: true, opacity: 0.28, depthWrite: false, toneMapped: false }), 0, AQ.y + (AQ.h - 0.12) / 2, 0, { cast: false, receive: false });
	const aqBack = canvasTex(512, 256, (c, w, h) => {
		const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "#0d6e93"); gr.addColorStop(1, "#063247");
		c.fillStyle = gr; c.fillRect(0, 0, w, h);
		for (let i = 0; i < 6; i++) { c.fillStyle = "rgba(255,255,255,0.05)"; c.beginPath(); c.moveTo(i * 90, 0); c.lineTo(i * 90 + 40, 0); c.lineTo(i * 90 - 20, h); c.lineTo(i * 90 - 60, h); c.fill(); }
	});
	add(aq, new THREE.PlaneGeometry(AQ.w - 0.04, AQ.h - 0.04), new THREE.MeshBasicMaterial({ map: aqBack, toneMapped: false }), 0, AQ.y + AQ.h / 2, -AQ.d / 2 + 0.02, { cast: false, receive: false });
	add(aq, new THREE.BoxGeometry(AQ.w - 0.04, 0.12, AQ.d - 0.04), mat("#e8d5a8", 0.95), 0, AQ.y + 0.06, 0);
	for (let i = 0; i < 7; i++) add(aq, new THREE.DodecahedronGeometry(0.07 + R() * 0.08, 0), mat(["#7a7a82", "#9a8f84", "#5f6a72"][i % 3], 0.9), -1.2 + R() * 2.4, AQ.y + 0.14, -0.2 + R() * 0.3);
	const weeds = [];
	for (let i = 0; i < 12; i++) {
		const wd = add(aq, new THREE.CylinderGeometry(0.008, 0.02, 0.45 + R() * 0.45, 5), mat(i % 2 ? "#3fa36a" : "#2f8a55", 0.7), -1.3 + R() * 2.6, AQ.y + 0.4, -0.25 + R() * 0.4, { cast: false });
		wd.userData.ph = R() * 6;
		weeds.push(wd);
	}
	const fish = [];
	const fishCols = ["#ff9f1c", "#ffbf69", "#2ec4b6", "#e71d36", "#f15bb5", "#fee440", "#00bbf9"];
	for (let i = 0; i < 11; i++) {
		const f = group(aq, 0, 0, 0);
		const c = fishCols[i % fishCols.length];
		add(f, new THREE.SphereGeometry(0.05, 12, 8), mat(c, 0.4), 0, 0, 0, { cast: false }).scale.set(1.6, 1, 0.55);
		const tail = add(f, new THREE.ConeGeometry(0.04, 0.06, 4), mat(c, 0.4), -0.09, 0, 0, { rz: Math.PI / 2, cast: false });
		tail.scale.set(1, 1, 0.4);
		add(f, new THREE.SphereGeometry(0.008, 6, 6), mat("#111", 0.3), 0.055, 0.015, 0.02, { cast: false });
		f.userData = { ph: R() * 6, sp: 0.25 + R() * 0.35, y: 0.2 + R() * 0.8, rx: 0.7 + R() * 0.7, rz: 0.1 + R() * 0.15, tail, feed: 0 };
		fish.push(f);
	}
	const bubbles = [];
	for (let i = 0; i < 14; i++) { const b = add(aq, new THREE.SphereGeometry(0.012 + R() * 0.012, 8, 6), new THREE.MeshBasicMaterial({ color: "#e8fbff", transparent: true, opacity: 0.6, toneMapped: false }), 1.0, AQ.y + 0.2, 0.1, { cast: false, receive: false }); b.userData.ph = R(); bubbles.push(b); }
	const flakes = [];
	for (let i = 0; i < 20; i++) { const fl2 = add(aq, new THREE.BoxGeometry(0.015, 0.003, 0.015), mat("#e9a35b", 0.6), 0, -10, 0, { cast: false }); fl2.userData.t = -1; flakes.push(fl2); }
	k.box(AQ.x - 0.45, HW, AQ.z - AQ.w / 2 - 0.1, AQ.z + AQ.w / 2 + 0.1);
	let feedAt = -1e9;
	function feedFish() {
		feedAt = performance.now() / 1000;
		flakes.forEach((f, i) => { f.userData.t = 0; f.userData.x = -0.8 + R() * 1.6; f.userData.z = -0.2 + R() * 0.4; f.userData.d = i * 0.04; });
		ctx.sfx("pop", 0.3);
	}
	k.interact("lounge:aquarium", { label: "Feed the fish", stand: [6.4, AQ.z], face: Math.PI / 2, use: () => { feedFish(); ctx.send({ t: "fx", kind: "zfx", zone: "lounge", what: "fish" }); ctx.doUpper("give", 1200); } }, aq);

	// ---------------------------------------------------------------- jukebox (north-east corner)
	const jb = group(g, -7.2, 0, -6.25, Math.PI / 4);
	add(jb, rbox(0.95, 1.05, 0.6, 0.06), mat("#7a1f2b", 0.4), 0, 0.53, 0);
	const archM = new THREE.MeshStandardMaterial({ color: "#ffb3c6", emissive: "#ff4d8a", emissiveIntensity: 1.6 });
	add(jb, new THREE.TorusGeometry(0.42, 0.06, 12, 32, Math.PI), archM, 0, 1.05, 0.25, { cast: false });
	add(jb, new THREE.CircleGeometry(0.4, 32, 0, Math.PI), new THREE.MeshPhysicalMaterial({ color: "#ffe6c8", transparent: true, opacity: 0.35, roughness: 0.1 }), 0, 1.05, 0.26, { cast: false });
	add(jb, new THREE.CylinderGeometry(0.42, 0.42, 0.55, 32, 1, false, -Math.PI / 2, Math.PI), mat("#7a1f2b", 0.4), 0, 1.05, 0, { rx: Math.PI / 2 });
	const jbStripes = [];
	for (let i = 0; i < 5; i++) jbStripes.push(add(jb, new THREE.BoxGeometry(0.05, 0.8, 0.02), new THREE.MeshStandardMaterial({ color: "#ffd166", emissive: "#ffd166", emissiveIntensity: 1.2 }), -0.3 + i * 0.15, 0.55, 0.31, { cast: false }));
	k.box(-HW, -6.65, -HD, -5.7);
	k.interact("lounge:jukebox", { label: "Pick a song on the jukebox", stand: [-6.6, -4.9], face: Math.PI * 0.8, use: () => ctx.openMusic() }, jb);

	// ---------------------------------------------------------------- plants
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
	plant(5.0, -4.6);
	plant(7.5, 2.35, 0.9);
	plant(7.5, -4.4, 1.0);

	// ---------------------------------------------------------------- the kitchen (south wall), on tiles
	const tileTex = tex.tiles("#efe9df", "#e3dccf", "#cfc6b8", 9 / 1.2, 4.6 / 1.2, 4);
	const tiles = add(g, new THREE.PlaneGeometry(9.0, 4.65), mat("#ffffff", 0.4, 0, { map: tileTex }), 3.45, 0.004, 4.62, { rx: -Math.PI / 2, cast: false });
	tiles.userData.floor = true;
	const cabM = mat("#8fae9f", 0.5);
	const marble = mat("#ffffff", 0.25, 0, { map: k.marbleTex() });
	const steel = mat("#d9dde2", 0.2, 0.9);
	const darkM = mat("#1d1d22", 0.4);
	const CX0 = -0.6, CX1 = 7.1, CZ = 6.62;
	add(g, rbox(CX1 - CX0, 0.86, 0.62, 0.02), cabM, (CX0 + CX1) / 2, 0.43, CZ);
	add(g, rbox(CX1 - CX0 + 0.04, 0.05, 0.66, 0.01), marble, (CX0 + CX1) / 2, 0.885, CZ - 0.01);
	for (let x = CX0 + 0.3; x < CX1; x += 0.6) {
		add(g, rbox(0.56, 0.7, 0.02, 0.008), mat("#9dbcad", 0.5), x, 0.43, CZ - 0.315);
		add(g, rbox(0.14, 0.02, 0.025, 0.006), brass, x, 0.72, CZ - 0.33);
	}
	k.box(CX0, CX1, 6.3, HD);
	add(g, new THREE.PlaneGeometry(CX1 - CX0, 0.6), mat("#ffffff", 0.3, 0, { map: k.tileTex((CX1 - CX0) / 0.8, 1) }), (CX0 + CX1) / 2, 1.21, HD - 0.01, { ry: Math.PI, cast: false });
	for (const [a, b] of [[CX0, 1.5], [3.3, 4.4], [5.6, CX1]]) {
		add(g, rbox(b - a, 0.75, 0.36, 0.02), cabM, (a + b) / 2, 2.05, HD - 0.18);
		for (let x = a + 0.3; x < b; x += 0.6) add(g, rbox(0.14, 0.02, 0.025, 0.006), brass, x, 1.75, HD - 0.37);
	}
	// sink under the window
	const SX = 2.4, OX = 5.0;
	const sink = group(g, SX, 0.9, CZ, Math.PI);
	add(sink, new THREE.BoxGeometry(0.7, 0.03, 0.44), steel, 0, -0.005, 0, { cast: false });
	add(sink, new THREE.BoxGeometry(0.62, 0.02, 0.36), mat("#9aa3ab", 0.3, 0.8), 0, -0.17, 0, { cast: false });
	const tap = group(sink, 0, 0, -0.24);
	add(tap, new THREE.CylinderGeometry(0.02, 0.025, 0.32, 10), steel, 0, 0.16, 0);
	add(tap, new THREE.TorusGeometry(0.1, 0.018, 8, 20, Math.PI), steel, 0, 0.32, 0.1, { ry: Math.PI / 2 });
	const water = add(sink, new THREE.CylinderGeometry(0.012, 0.016, 0.42, 8), new THREE.MeshStandardMaterial({ color: "#bfe6ff", transparent: true, opacity: 0.6, roughness: 0.05 }), 0, 0.11, -0.04, { cast: false });
	water.visible = false;
	const suds = [];
	for (let i = 0; i < 14; i++) { const b = add(sink, new THREE.SphereGeometry(0.03 + R() * 0.03, 8, 6), new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.2, transparent: true, opacity: 0.85 }), (R() - 0.5) * 0.5, -0.12, (R() - 0.5) * 0.28, { cast: false }); b.visible = false; suds.push(b); }
	const sinkPlates = group(sink, 0, -0.14, 0.02);
	for (let i = 0; i < 2; i++) add(sinkPlates, new THREE.CylinderGeometry(0.13, 0.1, 0.02, 24), mat("#f6f1e8", 0.3), (i - 0.5) * 0.24, i * 0.03, 0, { rz: (i - 0.5) * 0.3, cast: false });
	sinkPlates.visible = false;
	// stove + oven + hood
	const stove = group(g, OX, 0, CZ, Math.PI);
	add(stove, rbox(0.76, 0.86, 0.62, 0.02), steel, 0, 0.43, 0);
	add(stove, rbox(0.62, 0.42, 0.02, 0.01), darkM, 0, 0.42, 0.315);
	add(stove, rbox(0.5, 0.025, 0.03, 0.01), steel, 0, 0.7, 0.34);
	add(stove, rbox(0.78, 0.04, 0.64, 0.01), mat("#111", 0.15, 0.3), 0, 0.885, 0);
	for (const [bx, bz] of [[-0.18, -0.13], [0.18, -0.13], [-0.18, 0.15], [0.18, 0.15]]) add(stove, new THREE.TorusGeometry(0.07, 0.01, 6, 20), mat("#333", 0.4, 0.6), bx, 0.91, bz, { rx: Math.PI / 2, cast: false });
	const flameM = new THREE.MeshBasicMaterial({ color: "#5aa9ff", transparent: true, opacity: 0, toneMapped: false });
	add(stove, new THREE.TorusGeometry(0.075, 0.014, 6, 24), flameM, -0.18, 0.92, 0.15, { rx: Math.PI / 2, cast: false, receive: false });
	for (let i = 0; i < 4; i++) add(stove, new THREE.CylinderGeometry(0.025, 0.025, 0.03, 12), mat("#e8e8e8", 0.3), -0.24 + i * 0.16, 0.75, 0.33, { rx: Math.PI / 2, cast: false });
	const pot = group(stove, -0.18, 0.91, 0.15);
	add(pot, new THREE.CylinderGeometry(0.15, 0.14, 0.18, 24, 1, true), mat("#b8bec6", 0.25, 0.9, { side: THREE.DoubleSide }), 0, 0.09, 0);
	add(pot, new THREE.CircleGeometry(0.14, 24), mat("#888", 0.3, 0.8), 0, 0.005, 0, { rx: -Math.PI / 2, cast: false });
	for (const sx of [-1, 1]) add(pot, new THREE.BoxGeometry(0.08, 0.02, 0.03), darkM, sx * 0.18, 0.15, 0);
	const potFood = add(pot, new THREE.CircleGeometry(0.145, 24), mat("#e85d3a", 0.4), 0, 0.13, 0, { rx: -Math.PI / 2, cast: false });
	potFood.visible = false;
	const lid = add(stove, new THREE.CylinderGeometry(0.155, 0.155, 0.02, 24), mat("#c6ccd3", 0.2, 0.9), 0.2, 0.9, 0.17, { cast: false });
	const hood = group(g, OX, 0, HD - 0.2);
	add(hood, new THREE.CylinderGeometry(0.16, 0.5, 0.45, 4, 1), steel, 0, 2.05, 0, { ry: Math.PI / 4 });
	add(hood, new THREE.BoxGeometry(0.28, 1.2, 0.28), steel, 0, 2.85, 0);
	// fridge in the corner: a real inside (shelves of food, bottles in the door) that lights up when you open it
	const fr = group(g, 7.5, 0, 6.5, Math.PI);
	const frM = mat("#e8ecef", 0.25, 0.4), frIn = mat("#f6fafc", 0.6);
	const FW = 0.86, FH = 2.0, FD = 0.74;
	add(fr, new THREE.BoxGeometry(FW, FH, 0.04), frM, 0, FH / 2, -FD / 2 + 0.02);
	for (const sx of [-1, 1]) add(fr, new THREE.BoxGeometry(0.04, FH, FD), frM, sx * (FW / 2 - 0.02), FH / 2, 0);
	add(fr, new THREE.BoxGeometry(FW, 0.04, FD), frM, 0, FH - 0.02, 0);
	add(fr, new THREE.BoxGeometry(FW, 0.62, FD), frM, 0, 0.31, 0);
	add(fr, new THREE.PlaneGeometry(FW - 0.08, FH - 0.7), frIn, 0, 0.65 + (FH - 0.7) / 2, -FD / 2 + 0.045, { cast: false });
	const frGlow = new THREE.MeshBasicMaterial({ color: "#eaf6ff", toneMapped: false });
	add(fr, new THREE.BoxGeometry(0.3, 0.02, 0.05), frGlow, 0, FH - 0.06, -0.1, { cast: false });
	const shelfGlass = new THREE.MeshPhysicalMaterial({ color: "#e8f6ff", transparent: true, opacity: 0.45, roughness: 0.1 });
	const food = [];
	const put = (geo, m, x, y, z, rot) => { const o = add(fr, geo, m, x, y, z, { cast: false }); if (rot) o.rotation.set(rot[0] || 0, rot[1] || 0, rot[2] || 0); food.push(o); return o; };
	const shelvesY = [0.66, 1.06, 1.46];
	shelvesY.forEach(y => add(fr, new THREE.BoxGeometry(FW - 0.08, 0.015, FD - 0.1), shelfGlass, 0, y, -0.03, { cast: false }));
	// bottom shelf: milk, juice, a tray of eggs
	put(new THREE.BoxGeometry(0.09, 0.22, 0.09), mat("#ffffff", 0.5), -0.28, 0.785, -0.12);
	put(new THREE.ConeGeometry(0.064, 0.05, 4), mat("#3a86ff", 0.5), -0.28, 0.92, -0.12, [0, Math.PI / 4, 0]);
	put(new THREE.CylinderGeometry(0.055, 0.06, 0.24, 14), new THREE.MeshPhysicalMaterial({ color: "#ffb703", transparent: true, opacity: 0.85, roughness: 0.15 }), -0.12, 0.79, -0.15);
	put(new THREE.BoxGeometry(0.3, 0.04, 0.16), mat("#d8c39a", 0.9), 0.17, 0.69, 0.02);
	for (let i = 0; i < 6; i++) put(new THREE.SphereGeometry(0.026, 10, 8), mat("#fff3e0", 0.5), 0.07 + (i % 3) * 0.1, 0.73, -0.02 + Math.floor(i / 3) * 0.08).scale.set(1, 1.25, 1);
	// middle shelf: cheese, a cake, a jar of jam, yogurts
	put(new THREE.CylinderGeometry(0.1, 0.1, 0.07, 3), mat("#ffd166", 0.6), -0.22, 1.105, -0.05, [0, 0.4, 0]);
	const cake = put(new THREE.CylinderGeometry(0.12, 0.12, 0.1, 24, 1, false, 0, Math.PI * 1.6), mat("#ffb3c6", 0.6), 0.12, 1.12, -0.08);
	add(fr, new THREE.SphereGeometry(0.02, 8, 6), mat("#d62839", 0.4), 0.12, 1.19, -0.08, { cast: false });
	void cake;
	put(new THREE.CylinderGeometry(0.04, 0.04, 0.1, 14), mat("#9d0208", 0.3), 0.3, 1.12, 0.12);
	for (let i = 0; i < 3; i++) put(new THREE.CylinderGeometry(0.035, 0.03, 0.08, 12), mat(["#f1faee", "#ffcad4", "#cdeac0"][i], 0.5), -0.3 + i * 0.09, 1.11, 0.14);
	// top shelf: fruit and veg, a bottle of wine, leftovers
	for (let i = 0; i < 5; i++) put(new THREE.SphereGeometry(0.045, 12, 10), mat(["#e63946", "#8ac926", "#ffd166", "#f4a261", "#e63946"][i], 0.45), -0.3 + i * 0.07, 1.515, -0.12 + (i % 2) * 0.05);
	put(new THREE.ConeGeometry(0.025, 0.18, 10), mat("#f3722c", 0.5), 0.0, 1.5, 0.1, [0, 0, Math.PI / 2]);
	put(new THREE.CylinderGeometry(0.035, 0.04, 0.26, 14), mat("#3b1e2b", 0.2), 0.25, 1.6, -0.15);
	put(new THREE.CylinderGeometry(0.014, 0.018, 0.08, 10), mat("#3b1e2b", 0.2), 0.25, 1.77, -0.15);
	put(new THREE.BoxGeometry(0.16, 0.08, 0.12), new THREE.MeshPhysicalMaterial({ color: "#ffffff", transparent: true, opacity: 0.5 }), 0.2, 1.51, 0.12);
	put(new THREE.BoxGeometry(0.14, 0.05, 0.1), mat("#e9c46a", 0.6), 0.2, 1.5, 0.12);
	// the doors: freezer drawer below, the big door above with bottles in its shelves
	const frDoor = group(fr, -FW / 2, 0, FD / 2);
	add(frDoor, rbox(FW - 0.02, 1.32, 0.05, 0.03), mat("#eef1f3", 0.25, 0.4), FW / 2, 1.33, 0.025);
	add(frDoor, rbox(0.03, 0.5, 0.04, 0.01), steel, FW - 0.1, 1.3, 0.075);
	for (let i = 0; i < 4; i++) add(frDoor, new THREE.CylinderGeometry(0.025, 0.025, 0.01, 12), mat(["#ff4d6d", "#ffd166", "#06d6a0", "#118ab2"][i], 0.4), 0.2 + (i % 2) * 0.25, 1.55 + Math.floor(i / 2) * 0.25, 0.055, { rx: Math.PI / 2, cast: false });
	add(frDoor, new THREE.PlaneGeometry(0.16, 0.3), new THREE.MeshStandardMaterial({ map: tex.art(3), roughness: 0.6 }), 0.6, 1.2, 0.056, { cast: false });
	for (const y of [0.85, 1.25, 1.65]) {
		add(frDoor, new THREE.BoxGeometry(FW - 0.14, 0.02, 0.1), shelfGlass, FW / 2, y, -0.05, { cast: false });
		for (let i = 0; i < 4; i++) add(frDoor, new THREE.CylinderGeometry(0.03, 0.03, 0.18, 12), mat(["#06d6a0", "#ef476f", "#ffffff", "#ffd166"][(i + Math.round(y * 10)) % 4], 0.3), 0.15 + i * 0.18, y + 0.1, -0.05, { cast: false });
	}
	add(fr, rbox(FW - 0.02, 0.6, 0.05, 0.03), mat("#eef1f3", 0.25, 0.4), 0, 0.33, FD / 2 + 0.025);
	add(fr, rbox(0.3, 0.03, 0.04, 0.01), steel, 0, 0.55, FD / 2 + 0.06);
	k.box(7.05, HW, 6.05, HD);
	let fridgeOpen = false, frK = 0;
	k.interact("lounge:fridge", { label: () => fridgeOpen ? "Close the fridge" : "Open the fridge", stand: [7.4, 5.3], face: 0, use: () => { fridgeOpen = !fridgeOpen; ctx.sfx(fridgeOpen ? "pop" : "click", 0.5); } }, fr);
	k.updaters.push(dt => {
		frK += ((fridgeOpen ? 1 : 0) - frK) * Math.min(1, dt * 6);
		frDoor.rotation.y = -frK * 1.75;
		frGlow.color.setScalar(0.3 + frK * 0.7);
		frIn.emissive.set("#cfe8ff"); frIn.emissiveIntensity = frK * 0.35;
	});
	// island with two stools
	const IX = 2.8, IZ = 4.15;
	const isl = group(g, IX, 0, IZ);
	add(isl, rbox(3.2, 0.88, 0.9, 0.02), mat("#3d5a4f", 0.5), 0, 0.44, 0);
	add(isl, rbox(3.35, 0.06, 1.1, 0.015), marble, 0, 0.91, -0.05);
	add(isl, new THREE.SphereGeometry(0.2, 20, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mat("#e8e1d6", 0.35, 0, { side: THREE.DoubleSide }), -0.9, 1.14, 0);
	for (let i = 0; i < 6; i++) add(isl, new THREE.SphereGeometry(0.06, 12, 10), mat(["#f4a261", "#e63946", "#ffd166", "#8ac926"][i % 4], 0.45), -0.9 + Math.cos(i) * 0.09, 1.0 + (i % 2) * 0.04, Math.sin(i) * 0.09);
	add(isl, rbox(0.42, 0.025, 0.28, 0.01), mat("#c89a6a", 0.6), 0.8, 0.95, 0.1);
	for (let i = 0; i < 3; i++) add(isl, new THREE.SphereGeometry(0.045, 12, 10), mat("#e63946", 0.45), 0.7 + i * 0.1, 1.0, 0.1);
	k.box(IX - 1.65, IX + 1.65, IZ - 0.5, IZ + 0.5);
	const stoolM = mat("#2b2d42", 0.6);
	for (let i = 0; i < 2; i++) {
		const sx = IX - 0.75 + i * 1.5, sz = IZ - 0.98;
		const st = group(g, sx, 0, sz);
		add(st, new THREE.CylinderGeometry(0.2, 0.2, 0.07, 20), mat("#c89a6a", 0.55), 0, 0.68, 0);
		add(st, new THREE.CylinderGeometry(0.025, 0.03, 0.66, 8), stoolM, 0, 0.33, 0);
		add(st, new THREE.TorusGeometry(0.15, 0.012, 6, 20), stoolM, 0, 0.3, 0, { rx: Math.PI / 2 });
		add(st, new THREE.CylinderGeometry(0.17, 0.2, 0.02, 20), stoolM, 0, 0.01, 0);
		k.spot({ id: "stool" + i, x: sx, z: sz, h: 0, y: 0.27 });
		k.interact("lounge:stool" + i, { label: "Sit at the island", stand: [sx, sz - 0.6], sit: ["stool" + i] }, st);
	}
	// pendants over the island
	const pendShade = new THREE.MeshStandardMaterial({ color: "#2e4a40", roughness: 0.4, metalness: 0.4, side: THREE.DoubleSide, emissive: "#000000" });
	const islandBulbs = new THREE.MeshBasicMaterial({ color: "#fff3d6", toneMapped: false });
	const islPend = [];
	for (const dx of [-0.8, 0.8]) {
		const pg = group(g, IX + dx, 0, IZ);
		add(pg, new THREE.CylinderGeometry(0.005, 0.005, H - 2.5, 6), mat("#222"), 0, (H + 2.5) / 2, 0, { cast: false });
		add(pg, new THREE.SphereGeometry(0.2, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), pendShade, 0, 2.48, 0, { cast: false });
		add(pg, new THREE.SphereGeometry(0.06, 12, 10), islandBulbs, 0, 2.4, 0, { cast: false });
		islPend.push(pg);
	}

	// ---------------------------------------------------------------- dining table for two (plus two) by the tall window
	const TX = -3.2, TZ = 4.6;
	const tg = group(g, TX, 0, TZ);
	const walnut = mat("#5a3826", 0.45);
	add(tg, rbox(1.5, 0.05, 0.95, 0.015), walnut, 0, 0.76, 0);
	for (const sx of [-0.65, 0.65]) for (const sz of [-0.38, 0.38]) add(tg, rbox(0.06, 0.74, 0.06, 0.01), walnut, sx, 0.37, sz);
	add(tg, new THREE.PlaneGeometry(0.45, 1.02), mat("#f2e8d8", 0.9, 0, { side: THREE.DoubleSide }), 0, 0.787, 0, { rx: -Math.PI / 2, cast: false });
	const tableFlames = [];
	for (const dx of [-0.12, 0.12]) {
		add(tg, new THREE.CylinderGeometry(0.03, 0.035, 0.03, 12), brass, dx, 0.8, 0.05);
		add(tg, new THREE.CylinderGeometry(0.018, 0.018, 0.2, 10), mat("#fff8ec", 0.5), dx, 0.92, 0.05);
		tableFlames.push(add(tg, new THREE.SphereGeometry(0.014, 8, 6), new THREE.MeshBasicMaterial({ color: "#ffd27a", toneMapped: false }), dx, 1.04, 0.05, { cast: false }));
	}
	add(tg, new THREE.CylinderGeometry(0.05, 0.04, 0.14, 12), mat("#e8e1d6", 0.3), 0, 0.85, -0.18);
	for (let i = 0; i < 5; i++) add(tg, new THREE.SphereGeometry(0.035, 8, 6), mat(["#ff4d6d", "#ff8fab", "#ffffff", "#ff4d6d", "#ffb3c6"][i], 0.6), Math.cos(i * 1.3) * 0.05, 0.96 + (i % 2) * 0.03, -0.18 + Math.sin(i * 1.3) * 0.05, { cast: false });
	k.box(TX - 0.78, TX + 0.78, TZ - 0.5, TZ + 0.5);
	const dineRug = add(g, new THREE.PlaneGeometry(3.4, 2.6), mat("#ffffff", 1, 0, { map: tex.carpet("#b56576", "#f2cc8f") }), TX, 0.008, TZ, { rx: -Math.PI / 2, cast: false });
	dineRug.userData.floor = true;
	const chairM = mat("#e9dccb", 0.8);
	const chairs = [
		{ id: "dineA", x: TX - 1.02, z: TZ, h: Math.PI / 2 },
		{ id: "dineB", x: TX + 1.02, z: TZ, h: -Math.PI / 2 },
		{ id: "dineC", x: TX, z: TZ - 0.78, h: 0 },
		{ id: "dineD", x: TX, z: TZ + 0.78, h: Math.PI }
	];
	for (const c of chairs) {
		const cg = group(g, c.x, 0, c.z, c.h);
		add(cg, rbox(0.46, 0.06, 0.44, 0.02), chairM, 0, 0.47, 0);
		add(cg, rbox(0.46, 0.55, 0.05, 0.02), chairM, 0, 0.78, -0.21, { rx: -0.08 });
		for (const sx of [-0.19, 0.19]) for (const sz of [-0.18, 0.18]) add(cg, rbox(0.04, 0.46, 0.04, 0.01), walnut, sx, 0.23, sz);
		k.spot({ id: c.id, x: c.x, z: c.z, h: c.h, y: 0.03 });
		const back = c.h + Math.PI;
		k.interact("lounge:" + c.id, { label: "Sit at the table", stand: [c.x + Math.sin(back) * 0.6, c.z + Math.cos(back) * 0.6], sit: [c.id] }, cg);
		k.box(c.x - 0.25, c.x + 0.25, c.z - 0.25, c.z + 0.25);
	}
	const plates = ["dineA", "dineB"].map(id => {
		const c = chairs.find(x => x.id === id);
		const pg = group(g, c.x + Math.sin(c.h) * 0.42, 0.79, c.z + Math.cos(c.h) * 0.42, c.h);
		add(pg, new THREE.CylinderGeometry(0.16, 0.12, 0.02, 28), mat("#f6f1e8", 0.3), 0, 0.01, 0);
		add(pg, new THREE.TorusGeometry(0.14, 0.006, 6, 28), mat("#c9a05a", 0.3, 0.8), 0, 0.021, 0, { rx: Math.PI / 2, cast: false });
		for (const sx of [-0.22, 0.22]) add(pg, new THREE.BoxGeometry(0.02, 0.005, 0.18), mat("#d9dde2", 0.25, 0.9), sx, 0.004, 0, { cast: false });
		add(pg, new THREE.CylinderGeometry(0.035, 0.03, 0.13, 14, 1, true), new THREE.MeshPhysicalMaterial({ color: "#ffffff", transparent: true, opacity: 0.3, roughness: 0.05, side: THREE.DoubleSide, depthWrite: false }), 0.2, 0.065, -0.18, { cast: false });
		return { seat: id, group: pg, food: group(pg, 0, 0.022, 0), dish: null };
	});
	const dinePendM = new THREE.MeshStandardMaterial({ color: "#c9a05a", metalness: 0.7, roughness: 0.35, side: THREE.DoubleSide });
	const dineBulb = new THREE.MeshBasicMaterial({ color: "#fff3d6", toneMapped: false });
	const dp = group(g, TX, 0, TZ);
	add(dp, new THREE.CylinderGeometry(0.005, 0.005, H - 2.15, 6), mat("#222"), 0, (H + 2.15) / 2, 0, { cast: false });
	add(dp, new THREE.SphereGeometry(0.32, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), dinePendM, 0, 2.12, 0, { cast: false });
	add(dp, new THREE.SphereGeometry(0.07, 12, 10), dineBulb, 0, 2.04, 0, { cast: false });

	// ---------------------------------------------------------------- the pets' corner (beds, bowls, cat tree, their board)
	const petSpots = buildPetCorner(k, { bed: [-7.15, 6.2], tree: [-7.35, 4.5], bowls: [-5.3, 6.6], toys: [-6.0, 6.6], board: [-HW + 0.03, 5.4, Math.PI / 2], ball: [-2.6, -0.2] });

	// ---------------------------------------------------------------- light (and a switch for every lamp)
	const L = {
		fire: k.light(0, 0.9, FZ, "#ff8a3d", 4, 8, 1.6),
		aq: k.light(6.6, 1.4, AQ.z, "#4ac8ff", 2.0, 4.5),
		living: k.light(-1.0, 3.2, -1.2, "#ffd9a8", 4.5, 10, 1.5),
		island: k.light(IX, 2.2, IZ, "#ffd9a8", 3.6, 6),
		dining: k.light(TX, 1.95, TZ, "#ffcf8a", 3.2, 5.5),
		reading: k.light(-7.4, 1.65, 0.95, "#ffcf8a", 2.4, 5),
		landing: k.light(4.6, LAND.y + 1.7, -6.3, "#ffd9a8", 2.6, 7)
	};
	k.lamp("living", L.living, [drumM], [drum], [-1.0, -0.2], "big lamp");
	k.lamp("island", L.island, [islandBulbs, pendShade], islPend, [IX, IZ - 1.6], "kitchen lights");
	k.lamp("dining", L.dining, [dineBulb], [dp], [TX, TZ - 1.4], "dining lamp");
	k.lamp("reading", L.reading, [readShade], [fl], [-6.6, 1.4], "reading lamp");
	k.lamp("landing", L.landing, [landShade], [landLamp], [4.4, -5.6], "balcony light");
	k.key.pos.copy(k.V(0, H - 0.2, -0.5)); k.key.target.copy(k.V(-0.5, 0, 0.6));
	k.key.angle = 1.2; k.key.intensity = 30; k.key.distance = 18; k.key.color.set("#ffe2c0");
	k.fill.pos.copy(k.V(0, 4.5, 1)); k.fill.intensity = 6; k.fill.distance = 32; k.fill.decay = 1.1;
	k.hemi = 0.45; k.env = 0.3; k.exposure = 1.05;

	// ---------------------------------------------------------------- cooking, eating, washing up
	const CK = "z:kitchen:cook", MK = "z:kitchen:meal";
	const cookState = () => ctx.get(CK);                 // { id, dish, by, name, at, dur }
	const mealState = () => ctx.get(MK);                 // { id, dish, plates: { dineA: n, dineB: n }, dirty: false | "sink" }
	const dishOf = id => DISHES.find(d => d.id === id) || DISHES[0];
	const cooking = () => { const c = cookState(); return c && Date.now() < c.at + c.dur * 1000 ? c : null; };
	function stoveLabel() {
		const c = cooking();
		if (c) return c.by === ctx.MY_ID ? "Stir the " + dishOf(c.dish).name.toLowerCase() : "Help cook the " + dishOf(c.dish).name.toLowerCase();
		const m = mealState();
		return m && !m.dirty ? "Cook something else" : "Cook a meal";
	}
	function useStove() {
		if (cooking()) { stir(); return; }
		const m = mealState();
		if (m && m.dirty) { ctx.notice(m.dirty === "sink" ? "Wash up first - the dishes are waiting in the sink." : "Clear the table first, then you can cook again."); return; }
		openMenu();
	}
	function stir() {
		const c = cooking();
		if (!c) return;
		ctx.doUpper("cook", Math.min(Math.max(1500, c.at + c.dur * 1000 - Date.now()), 9000));
		ctx.updateProps(); ctx.sfx("pour", 0.4);
		if (c.by !== ctx.MY_ID) ctx.send({ t: "fx", kind: "sys", text: ctx.profile().name + " is helping cook" });
	}
	function openMenu() {
		const body = ctx.openModal("kitchen", "What shall we cook?", `<div class="hs-grid">${DISHES.map(d => `<button class="hs-card" data-d="${d.id}"><div class="ic">${dishIcon(d.id)}</div><b>${d.name}</b><span>${d.desc}</span></button>`).join("")}</div>
			<p class="muted" style="margin:14px 0 0">It cooks on the stove for everyone to see, then it's served on the dining table - one plate each. Stand by the stove to help stir.</p>`, 520);
		body.querySelectorAll("[data-d]").forEach(b => b.onclick = () => { ctx.closeModal(); startCooking(b.dataset.d); });
	}
	function startCooking(id) {
		const d = dishOf(id);
		ctx.setShared(CK, { id: Math.random().toString(36).slice(2, 9), dish: d.id, by: ctx.MY_ID, name: ctx.profile().name, at: Date.now(), dur: d.dur });
		if (mealState()) ctx.setShared(MK, null);
		ctx.send({ t: "fx", kind: "sys", text: ctx.profile().name + " is cooking " + d.name.toLowerCase() });
		ctx.notice(`Cooking <b>${d.name}</b>... stir it while it bubbles. It'll be on the table in ${d.dur} seconds.`);
		stir();
	}
	// the cook's screen serves the meal when it's ready (anyone nearby does it if the cook left)
	let served = "", here = false;
	function checkServe() {
		const c = cookState();
		if (!c || served === c.id || Date.now() < c.at + c.dur * 1000) return;
		const m = mealState();
		if (m && m.id === c.id) { served = c.id; return; }
		if (c.by !== ctx.MY_ID && !(here && Date.now() > c.at + c.dur * 1000 + 4000)) return;
		served = c.id;
		ctx.setShared(MK, { id: c.id, dish: c.dish, plates: { dineA: BITES, dineB: BITES }, dirty: false });
		ctx.toast(`<b>${dishOf(c.dish).name}</b> is ready! It's on the dining table.`, "Sit down", () => ctx.walkTo(chairs[0].x - 0.6 + k.ox, chairs[0].z + k.oz, "lounge:dineA"), 9000);
		ctx.sfx("chime", 0.7);
	}
	const mySeat = () => { const s = ctx.me().sit; return s === "dineA" || s === "dineB" ? s : null; };
	function eatBite() {
		const m = mealState(), s = mySeat();
		if (!m || m.dirty || !s || !(m.plates[s] > 0) || ctx.me().upper === "eat") return;
		const plates = Object.assign({}, m.plates);
		plates[s]--;
		ctx.setShared(MK, Object.assign({}, m, { plates }));
		ctx.doUpper("eat", 2600);
		ctx.updateProps();
		ctx.sfx("pop", 0.25);
		if (plates[s] === 0) setTimeout(() => { ctx.notice("Mmm, that was delicious!"); ctx.heartsFx(ctx.myAvatar().root, 4, null, 1.3); }, 2400);
	}
	function feed(id) {
		const m = mealState(), s = mySeat();
		if (!m || !s || !(m.plates[s] > 0)) return;
		const plates = Object.assign({}, m.plates);
		plates[s]--;
		ctx.setShared(MK, Object.assign({}, m, { plates }));
		ctx.doUpper("give", 1600, id);
		ctx.send({ t: "fx", kind: "zfx", zone: "lounge", what: "feed", to: id });
		const p = ctx.peers().get(id);
		ctx.notice("You fed " + ctx.esc(p ? p.look.name : "them") + " a bite");
		setTimeout(() => ctx.heartsFx(ctx.myAvatar().root, 3, null, 1.3), 700);
	}
	function clearTable() {
		const m = mealState();
		if (!m || m.dirty === "sink") return;
		ctx.setShared(MK, Object.assign({}, m, { dirty: "sink", plates: { dineA: 0, dineB: 0 } }));
		ctx.doUpper("give", 1200);
		ctx.sfx("click", 0.6);
		ctx.notice("Table cleared. The dishes are in the sink.");
	}
	let washing = 0;
	function useSink() {
		const m = mealState(), dishes = m && m.dirty === "sink";
		ctx.doUpper("wash", dishes ? 5000 : 2400);
		ctx.updateProps();
		washing = dishes ? 5 : 2.4;
		ctx.send({ t: "fx", kind: "zfx", zone: "lounge", what: "wash" });
		ctx.sfx("water", 0.6);
		if (dishes) setTimeout(() => {
			const m2 = mealState();
			if (m2 && m2.dirty === "sink") { ctx.setShared(MK, null); ctx.notice("Sparkling clean! The kitchen is spotless."); ctx.heartsFx(ctx.myAvatar().root, 5, "#7fd8ff"); }
		}, 5000);
	}
	k.interact("lounge:stove", { label: stoveLabel, stand: [OX, 5.75], face: 0, use: useStove }, stove);
	k.interact("lounge:sink", { label: () => mealState() && mealState().dirty === "sink" ? "Wash the dishes" : "Wash your hands", stand: [SX, 5.75], face: 0, use: useSink }, sink);
	let shownMeal = "";
	function applyMeal() {
		const m = mealState();
		const sig = m ? m.id + m.dish + JSON.stringify(m.plates) + m.dirty : "";
		if (sig === shownMeal) return;
		shownMeal = sig;
		for (const p of plates) {
			const want = m && m.dirty !== "sink" ? m.dish : null;
			if (p.dish !== want) { p.food.clear(); if (want) buildFood(k, p.food, want); p.dish = want; }
			const left = m && m.plates ? (m.plates[p.seat] || 0) : 0;
			p.food.children.forEach((c, i) => { c.visible = i < left; });
			p.group.visible = !(m && m.dirty === "sink");
		}
		sinkPlates.visible = !!(m && m.dirty === "sink");
	}

	// ---------------------------------------------------------------- every frame (while you're here, or can see in)
	const steam = [];
	const steamM = new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.3, depthWrite: false });
	const potWorld = new THREE.Vector3();
	let steamT = 0;
	function update(dt, t) {
		checkServe();
		applyMeal();
		// the fire
		const on = fireOn();
		flames.forEach((f, i) => {
			f.visible = on;
			const s = f.userData.s * (0.75 + 0.35 * Math.sin(t * 9 + f.userData.ph) + 0.15 * Math.sin(t * 23 + i));
			f.scale.set(1, s, 1);
			f.position.y = 0.3 + 0.25 * s;
			f.material.opacity = 0.65 + 0.25 * Math.sin(t * 13 + f.userData.ph);
		});
		emberM.opacity = on ? 0.75 + Math.sin(t * 3) * 0.15 : 0.15;
		L.fire.intensity = on ? 3.8 + Math.sin(t * 11) * 0.5 + Math.sin(t * 27) * 0.3 : 0;
		candleFl.forEach((c, i) => { c.scale.y = 1 + Math.sin(t * 14 + i * 2) * 0.25; });
		tableFlames.forEach((f, i) => { f.scale.y = 1 + Math.sin(t * 13 + i * 2) * 0.25; });
		// jukebox colours roll around
		archM.emissive.setHSL((t * 0.08) % 1, 0.9, 0.55);
		jbStripes.forEach((s, i) => s.material.emissive.setHSL((t * 0.08 + i * 0.12) % 1, 0.9, 0.55));
		// the aquarium
		const tt = performance.now() / 1000, fed = tt - feedAt < 8;
		fish.forEach((f, i) => {
			const u = f.userData, a = t * u.sp + u.ph;
			let y = AQ.y + 0.25 + u.y * (AQ.h - 0.5) + Math.sin(a * 2) * 0.05;
			u.feed += ((fed ? 1 : 0) - u.feed) * Math.min(1, dt * 1.5);
			y += (AQ.y + AQ.h - 0.22 - y) * u.feed;
			f.position.set(Math.sin(a) * u.rx * (AQ.w / 2 - 0.25) / 1.4, y, Math.cos(a * 1.3) * u.rz);
			f.rotation.y = Math.cos(a) >= 0 ? 0 : Math.PI;
			u.tail.rotation.y = Math.sin(t * 12 + i) * 0.5;
		});
		weeds.forEach(w => { w.rotation.z = Math.sin(t * 1.2 + w.userData.ph) * 0.15; });
		bubbles.forEach((b, i) => { const p = (t * 0.35 + b.userData.ph) % 1; b.position.set(1.0 + Math.sin(p * 20 + i) * 0.02, AQ.y + 0.15 + p * (AQ.h - 0.3), 0.1 + (i % 3) * 0.03); });
		flakes.forEach(fl2 => {
			const u = fl2.userData;
			if (u.t < 0) return;
			u.t += dt;
			const p = Math.max(0, u.t - u.d);
			fl2.position.set(u.x + Math.sin(p * 3) * 0.03, AQ.y + AQ.h - 0.14 - p * 0.12, u.z);
			if (p > 7) { u.t = -1; fl2.position.y = -10; }
		});
		// cooking
		const c = cooking();
		potFood.visible = !!c;
		lid.position.set(c ? 0.25 : -0.18, c ? 0.9 : 1.12, c ? -0.12 : 0.15);
		if (c) {
			potFood.material.color.set(dishOf(c.dish).pot);
			potFood.position.y = 0.13 + Math.sin(t * 8) * 0.004;
			flameM.opacity = 0.75 + Math.sin(t * 30) * 0.15;
			steamT += dt;
			if (steamT > 0.12) {
				steamT = 0;
				pot.getWorldPosition(potWorld);
				const s = new THREE.Mesh(new THREE.SphereGeometry(0.04 + Math.random() * 0.03, 8, 6), steamM.clone());
				s.position.copy(potWorld).add(new THREE.Vector3((Math.random() - 0.5) * 0.15, 0.2, (Math.random() - 0.5) * 0.15));
				s.userData.life = 0;
				ctx.scene.add(s);
				steam.push(s);
			}
		} else flameM.opacity = 0;
		for (let i = steam.length - 1; i >= 0; i--) {
			const s = steam[i];
			s.userData.life += dt;
			s.position.y += dt * 0.35;
			s.scale.setScalar(1 + s.userData.life * 2.2);
			s.material.opacity = Math.max(0, 0.3 - s.userData.life * 0.16);
			if (s.material.opacity <= 0) { ctx.scene.remove(s); s.geometry.dispose(); s.material.dispose(); steam.splice(i, 1); }
		}
		washing = Math.max(0, washing - dt);
		water.visible = washing > 0;
		const m = mealState();
		suds.forEach((b, i) => { b.visible = washing > 0 || !!(m && m.dirty === "sink"); b.position.y = -0.12 + Math.sin(t * 2 + i) * 0.01; });
	}

	return {
		update,
		petSpots,
		onEnter() { here = true; shownMeal = "x"; applyMeal(); },
		onLeave() { here = false; },
		applyKey(key, remote) {
			if (key === CK && remote) { const c = cookState(); if (c && Date.now() < c.at + c.dur * 1000) ctx.notice(`<b>${ctx.esc(c.name)}</b> is cooking ${dishOf(c.dish).name.toLowerCase()}`); }
			if (key === MK) applyMeal();
		},
		onFx(d, p) {
			if (d.what === "fish") feedFish();
			if (d.what === "wash") washing = 4;
			if (d.what === "feed" && d.to === ctx.MY_ID) {
				ctx.doUpper("eat", 2400);
				ctx.updateProps();
				setTimeout(() => ctx.heartsFx(ctx.myAvatar().root, 4, null, 1.3), 900);
				ctx.notice(`<b>${ctx.esc(p ? p.look.name : "Someone")}</b> fed you a bite`);
			}
		},
		promptOpts(opts) {
			const me = ctx.me();
			const free = key => !opts.some(o => o.k === key);
			const m = mealState(), s = mySeat();
			if (s && m && !m.dirty) {
				if (m.plates[s] > 0) {
					if (free("G") && me.upper !== "eat") opts.unshift({ k: "G", label: "Eat a bite", fn: eatBite });
					const who = ctx.whoSits(s === "dineA" ? "dineB" : "dineA");
					if (who && free("F")) { const id = [...ctx.peers().entries()].find(([, q]) => q === who)[0]; opts.push({ k: "F", label: "Feed " + who.look.name + " a bite", fn: () => feed(id) }); }
				}
				if (Object.values(m.plates).every(n => n <= 0) && free("R")) opts.push({ k: "R", label: "Clear the table", fn: clearTable });
			}
			if (!me.sit && m && !m.dirty && Object.values(m.plates).every(n => n <= 0) && Math.hypot(me.x - (TX + k.ox), me.z - (TZ + k.oz)) < 1.8 && free("R")) opts.push({ k: "R", label: "Clear the table", fn: clearTable });
		},
		// the jukebox plays whatever's on the record player: loud near it, softer across the room
		musicAt(x, z) { const d = Math.hypot(x - (-7.2 + k.ox), z - (-6.25 + k.oz)); return Math.max(0.25, Math.min(1, 1.3 - d / 12)); }
	};
}

// ---------------------------------------------------------------- food on a plate: five pieces, one per bite
// (the last pieces in the list go first, so the plate / bowl / big piece stays till the end)
function buildFood(k, grp, dish) {
	const { THREE, mat } = k;
	const piece = (geo, m, x, y, z, rot) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); if (rot) o.rotation.set(rot[0] || 0, rot[1] || 0, rot[2] || 0); grp.add(o); return o; };
	if (dish === "pancakes") {
		const pm = mat("#e3a857", 0.6), syrup = mat("#8a4a12", 0.15);
		for (let i = 0; i < 5; i++) {
			const p = piece(new THREE.CylinderGeometry(0.1, 0.1, 0.022, 22), pm, 0, 0.012 + i * 0.022, 0);
			if (i === 4) { const s = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.09, 0.006, 20), syrup); s.position.y = 0.013; p.add(s); const b = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.015, 0.03), mat("#fff3b0", 0.4)); b.position.y = 0.022; p.add(b); }
		}
	} else if (dish === "spaghetti") {
		piece(new THREE.TorusGeometry(0.06, 0.03, 8, 20), mat("#f0d58a", 0.5), 0, 0.02, 0, [Math.PI / 2, 0, 0]);
		piece(new THREE.SphereGeometry(0.07, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat("#c0392b", 0.4), 0, 0.02, 0);
		for (let i = 0; i < 3; i++) piece(new THREE.SphereGeometry(0.028, 12, 10), mat("#6b3a24", 0.6), Math.cos(i * 2.1) * 0.05, 0.06, Math.sin(i * 2.1) * 0.05);
	} else if (dish === "pizza") {
		const crust = mat("#e9b872", 0.6), cheese = mat("#f6d55c", 0.5), pep = mat("#b5332e", 0.5);
		for (let i = 0; i < 5; i++) {
			const sl = piece(new THREE.CylinderGeometry(0.13, 0.13, 0.015, 8, 1, false, i * Math.PI * 2 / 5, Math.PI * 2 / 5 - 0.04), crust, 0, 0.01, 0);
			const chz = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.115, 0.008, 8, 1, false, i * Math.PI * 2 / 5 + 0.02, Math.PI * 2 / 5 - 0.08), cheese); chz.position.y = 0.01; sl.add(chz);
			const a = i * Math.PI * 2 / 5 + Math.PI / 5;
			const pp = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.006, 10), pep); pp.position.set(Math.sin(a) * 0.07, 0.016, Math.cos(a) * 0.07); sl.add(pp);
		}
	} else if (dish === "ramen") {
		piece(new THREE.CylinderGeometry(0.11, 0.07, 0.07, 22, 1, true), mat("#2b2d42", 0.4), 0, 0.035, 0);
		piece(new THREE.CircleGeometry(0.1, 22), mat("#d9a05b", 0.2), 0, 0.06, 0, [-Math.PI / 2, 0, 0]);
		piece(new THREE.TorusGeometry(0.045, 0.012, 6, 16), mat("#f6e7b8", 0.5), -0.02, 0.064, 0.01, [Math.PI / 2, 0, 0]);
		const e = piece(new THREE.SphereGeometry(0.03, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat("#fff8ec", 0.4), 0.04, 0.062, -0.03);
		const y = new THREE.Mesh(new THREE.CircleGeometry(0.014, 12), mat("#f4a261", 0.3)); y.rotation.x = -Math.PI / 2; e.add(y);
		piece(new THREE.BoxGeometry(0.05, 0.06, 0.004), mat("#1b3022", 0.6), -0.05, 0.08, -0.04, [0, 0.4, 0]);
	} else if (dish === "cupcakes") {
		for (let i = 0; i < 5; i++) {
			const a = i * Math.PI * 2 / 5;
			const c = piece(new THREE.CylinderGeometry(0.028, 0.022, 0.035, 12), mat("#f4a261", 0.5), Math.sin(a) * 0.075, 0.018, Math.cos(a) * 0.075);
			const f = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8), mat("#ffb3c6", 0.4)); f.position.y = 0.025; f.scale.y = 0.8; c.add(f);
			const ch = new THREE.Mesh(new THREE.SphereGeometry(0.009, 8, 6), mat("#d62839", 0.3)); ch.position.y = 0.05; c.add(ch);
		}
	} else {
		const st = piece(new THREE.CylinderGeometry(0.07, 0.07, 0.025, 14), mat("#6b2f22", 0.6), -0.02, 0.014, 0.01);
		st.scale.set(1.25, 1, 0.85);
		piece(new THREE.SphereGeometry(0.03, 10, 8), mat("#e9c46a", 0.6), 0.07, 0.02, -0.05);
		piece(new THREE.SphereGeometry(0.03, 10, 8), mat("#e9c46a", 0.6), 0.08, 0.02, 0.03);
		piece(new THREE.DodecahedronGeometry(0.03, 0), mat("#4f8a57", 0.6), -0.07, 0.025, -0.07);
		piece(new THREE.CylinderGeometry(0.01, 0.012, 0.07, 8), mat("#f3722c", 0.5), -0.08, 0.012, 0.07, [0, 0, Math.PI / 2]);
	}
}
// little round icons for the menu
function dishIcon(id) {
	const s = {
		pancakes: '<ellipse cx="32" cy="44" rx="24" ry="7" fill="#f6f1e8"/><rect x="14" y="26" width="36" height="7" rx="3.5" fill="#e3a857"/><rect x="14" y="32" width="36" height="7" rx="3.5" fill="#d9974a"/><rect x="14" y="38" width="36" height="7" rx="3.5" fill="#e3a857"/><path d="M18 27c4 6 8-2 12 4s10-4 16 0" stroke="#8a4a12" stroke-width="3" fill="none"/><rect x="28" y="21" width="8" height="5" fill="#fff3b0"/>',
		spaghetti: '<ellipse cx="32" cy="42" rx="25" ry="9" fill="#f6f1e8"/><path d="M14 38c6-14 30-14 36 0" fill="#f0d58a"/><path d="M18 36c6-8 22-8 28 0" stroke="#e2c26b" stroke-width="2" fill="none"/><circle cx="26" cy="31" r="5" fill="#6b3a24"/><circle cx="37" cy="32" r="5" fill="#6b3a24"/><path d="M22 28c5 3 14 3 20 0" stroke="#c0392b" stroke-width="4" fill="none"/>',
		pizza: '<circle cx="32" cy="34" r="22" fill="#e9b872"/><circle cx="32" cy="34" r="18" fill="#f6d55c"/><g fill="#b5332e"><circle cx="25" cy="28" r="3.5"/><circle cx="38" cy="27" r="3.5"/><circle cx="34" cy="40" r="3.5"/><circle cx="23" cy="39" r="3.5"/></g><path d="M32 34L32 12M32 34L52 40" stroke="#c99752" stroke-width="1.5"/>',
		ramen: '<path d="M10 30h44c0 14-10 22-22 22S10 44 10 30z" fill="#2b2d42"/><ellipse cx="32" cy="30" rx="22" ry="6" fill="#d9a05b"/><circle cx="38" cy="29" r="5" fill="#fff8ec"/><circle cx="38" cy="29" r="2.5" fill="#f4a261"/><path d="M20 30c3-4 7 4 10 0" stroke="#f6e7b8" stroke-width="3" fill="none"/><path d="M40 8l-8 22M46 10l-10 20" stroke="#c89a6a" stroke-width="2.5"/>',
		cupcakes: '<path d="M20 36h24l-4 18H24z" fill="#f4a261"/><path d="M24 36l2 18M32 36v18M40 36l-2 18" stroke="#d9874a" stroke-width="1.5"/><path d="M18 37c0-10 7-16 14-16s14 6 14 16z" fill="#ffb3c6"/><circle cx="32" cy="18" r="4" fill="#d62839"/><g fill="#fff"><rect x="24" y="28" width="2" height="4" rx="1"/><rect x="36" y="27" width="2" height="4" rx="1"/><rect x="30" y="31" width="2" height="4" rx="1"/></g>',
		steak: '<ellipse cx="32" cy="40" rx="25" ry="10" fill="#f6f1e8"/><ellipse cx="28" cy="36" rx="14" ry="8" fill="#6b2f22"/><path d="M20 34l14 4M22 38l12 2" stroke="#4a1f16" stroke-width="2"/><circle cx="45" cy="33" r="5" fill="#e9c46a"/><circle cx="46" cy="42" r="4" fill="#4f8a57"/>'
	}[id];
	return `<svg viewBox="0 0 64 64">${s}</svg>`;
}
