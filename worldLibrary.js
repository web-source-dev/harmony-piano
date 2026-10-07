/**
 * Harmony World — the library: the house's north-west corner, off the Gallery (the door in its south wall).
 *
 * World coordinates: inside x -22.25..-8.25, z 12.42..24.4, 3.6 m high. Windows on the west and north walls.
 * Photo frames 67..70 (over the mantel, over the low shelves): your own photos.
 *   bookshelves floor to ceiling (a thousand books, one draw call), a rolling ladder, a fireplace in the north wall with
 *   a chesterfield sofa for two in front of it and a pair of wing chairs, a reading desk with a green lamp under the
 *   west window, a globe, a big rug
 */
import { WING, HALL_DOORS, windowsOf } from "./worldEstate.js";

const [X0, X1, Z0, Z1] = WING.library;
const H = 3.6;
const DOOR = HALL_DOORS.library;   // (x: in its low-z wall, onto the Gallery)
const FP = { x: -14.8, w: 2.2 };   // the fireplace, in the north wall

export function build(k) {
	const { THREE, add, mat, group, rbox, g, tex, rng, ctx } = k;
	const R = rng(4141);
	const holes = [{ wall: "n", a: DOOR[0], b: DOOR[1], y1: 2.4 }].concat(windowsOf(WING.library));
	k.room({
		x0: X0, x1: X1, z0: Z0, z1: Z1, h: H,
		floor: mat("#ffffff", 0.5, 0, { map: tex.wood(["#5e3b26", "#6a4430", "#553522", "#704a33"], 1, 1, 81) }),
		ceil: mat("#ece2d2", 0.95),
		wall: mat("#ffffff", 0.85, 0, { map: tex.wall("#5a3d2b", "panel", "rgba(255,220,170,0.08)", 1, 1) }),
		depth: { n: 0.22, s: 0.3, w: 0.3, e: 0.2 },
		holes
	});
	k.floor(() => 0);
	k.walk(X0, X1, Z0, Z1);
	k.walk(DOOR[0], DOOR[1], Z0 - 1.0, Z0 + 1.0);
	k.cam = { minX: X0 + 0.2, maxX: X1 - 0.2, minZ: Z0 + 0.2, maxZ: Z1 - 0.2, maxY: H - 0.25 };
	// French doors onto the Gallery (in the wall between the hall and the room), the curtains on the room's side
	const DM = (DOOR[0] + DOOR[1]) / 2;
	k.frenchDoor("libraryDoor", { x: DM, z: Z0 - 0.11, ry: Math.PI, w: DOOR[1] - DOOR[0] - 0.04, h: 2.4, depth: 0.3, side: -1, curtain: "#2f4a3a" }, [DOOR[0], DOOR[1], Z0 - 0.22, Z0], [[DM, Z0 + 0.9], [DM, Z0 - 1.2]]);

	// ---------------------------------------------------------------- bookshelves, along every wall that's free
	const shelfM = mat("#3e2618", 0.55);
	const books = [];   // [x, y, z, w, h, d, ry, color]
	const BOOK = ["#7a1d33", "#2b4c7e", "#2a6f4e", "#c9a05a", "#5a2a5e", "#b5523b", "#1f3b4d", "#e9c46a", "#3d405b", "#8d5a3a", "#f4f1de", "#264653"];
	// a run of shelving from a to b (along x or z) against a wall, facing n, from y0 up to y1
	function shelves(ax, az, bx, bz, n, y0 = 0, y1 = H - 0.05) {
		const len = Math.hypot(bx - ax, bz - az), D = 0.36, alongX = Math.abs(bz - az) < 0.001;
		const cx = (ax + bx) / 2 + n[0] * D / 2, cz = (az + bz) / 2 + n[1] * D / 2;
		const box = (w, h, d, x, y, z) => add(g, new THREE.BoxGeometry(alongX ? w : d, h, alongX ? d : w), shelfM, x, y, z, { cast: false });
		box(len, y1 - y0, 0.03, cx - n[0] * (D / 2 - 0.015), (y0 + y1) / 2, cz - n[1] * (D / 2 - 0.015));   // the back
		const rows = Math.max(1, Math.floor((y1 - y0) / 0.42));
		for (let r = 0; r <= rows; r++) box(len, 0.035, D, cx, y0 + r * (y1 - y0) / rows, cz);
		const cols = Math.max(1, Math.round(len / 0.95));
		for (let c = 0; c <= cols; c++) {
			const u = -len / 2 + c * len / cols;
			box(0.04, y1 - y0, D, cx + (alongX ? u : 0), (y0 + y1) / 2, cz + (alongX ? 0 : u));
		}
		for (let r = 0; r < rows; r++) {
			const yb = y0 + r * (y1 - y0) / rows + 0.02, room = (y1 - y0) / rows - 0.06;
			let u = -len / 2 + 0.05;
			while (u < len / 2 - 0.1) {
				if (R() < 0.06) { u += 0.15 + R() * 0.2; continue; }   // a gap now and then
				const w = 0.035 + R() * 0.045, hh = Math.min(room, 0.22 + R() * 0.14), d = 0.2 + R() * 0.08;
				const lean = R() < 0.05 ? 0.25 : 0;
				books.push([cx + (alongX ? u + w / 2 : 0) - n[0] * 0.03, yb + hh / 2, cz + (alongX ? 0 : u + w / 2) - n[1] * 0.03, w, hh, d, alongX, lean, BOOK[Math.floor(R() * BOOK.length)]]);
				u += w + 0.004;
			}
		}
		k.box(Math.min(ax, bx + n[0] * D), Math.max(ax, bx + n[0] * D), Math.min(az, bz + n[1] * D), Math.max(az, bz + n[1] * D));
	}
	// the south wall (the Gallery's side), either side of the door
	shelves(X0 + 0.05, Z0, DOOR[0] - 0.3, Z0, [0, 1]);
	shelves(DOOR[1] + 0.3, Z0, X1 - 0.05, Z0, [0, 1]);
	// the north wall: either side of the fireplace, between the windows
	shelves(-18.2, Z1, FP.x - FP.w / 2 - 0.4, Z1, [0, -1]);
	shelves(-10.6, Z1, X1 - 0.05, Z1, [0, -1], 0, 1.4);
	// the west wall, between its windows (low there, with photos over them), and the east wall
	shelves(X0, Z0 + 0.45, X0, 14.6, [1, 0]);
	shelves(X0, 16.8, X0, 20.0, [1, 0], 0, 1.4);
	shelves(X0, 22.2, X0, Z1 - 0.45, [1, 0]);
	shelves(X1, Z0 + 0.45, X1, Z1 - 0.45, [-1, 0]);
	k.photo(68, X0 + 0.03, 2.1, 17.6, Math.PI / 2, { w: 0.8, h: 1.0, frame: "#c9a05a", metal: 0.7 });
	k.photo(69, X0 + 0.03, 2.1, 19.2, Math.PI / 2, { w: 0.8, h: 1.0, frame: "#c9a05a", metal: 0.7 });
	k.photo(70, -9.45, 2.15, Z1 - 0.03, Math.PI, { w: 1.3, h: 0.95, frame: "#c9a05a", metal: 0.7 });
	{
		const d = new THREE.Object3D(), col = new THREE.Color();
		const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat("#ffffff", 0.75), books.length);
		books.forEach(([x, y, z, w, h, dd, alongX, lean, c], i) => {
			d.position.set(x, y, z); d.rotation.set(0, 0, 0);
			if (alongX) { d.scale.set(w, h, dd); d.rotation.z = lean; } else { d.scale.set(dd, h, w); d.rotation.x = lean; }
			d.updateMatrix(); im.setMatrixAt(i, d.matrix); im.setColorAt(i, col.set(c));
		});
		im.castShadow = false; im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true;
		g.add(im);
		// browse the shelves: a book falls open in your hands (stand at whichever shelf's nearest)
		const TITLES = ["Pride and Prejudice", "The Little Prince", "Love in the Time of Cholera", "The Great Gatsby", "Jane Eyre", "The Secret Garden", "Anne of Green Gables", "Little Women", "The Notebook", "Wuthering Heights", "A Room with a View", "Persuasion", "Romeo and Juliet", "The Princess Bride", "Me Before You", "The Hobbit"];
		k.interact("library:books", {
			label: "Pick a book off the shelf", nearest: true, reach: 1.6,
			stands: [[-19.5, Z0 + 1.1], [-10.0, Z0 + 1.1], [X0 + 1.0, 13.6], [X1 - 1.0, 15.5], [X1 - 1.0, 20.5], [X0 + 1.0, 23.2], [-19.8, Z1 - 1.1]],
			use: () => { ctx.notice("You took <b>" + ctx.esc(TITLES[Math.floor(Math.random() * TITLES.length)]) + "</b> off the shelf"); ctx.sfx("page", 0.6); ctx.doUpper("lovestruck", 2000); }
		}, im);
	}
	// a rolling ladder on the south shelves
	{
		const lad = group(g, -17.5, 0, Z0 + 0.62, 0);
		const brass = mat("#c9a05a", 0.3, 0.9), oak = mat("#8a5a3c", 0.5);
		for (const sx of [-0.22, 0.22]) add(lad, new THREE.BoxGeometry(0.05, 3.3, 0.05), oak, sx, 1.62, 0, { rx: -0.18 });
		for (let i = 0; i < 10; i++) add(lad, new THREE.BoxGeometry(0.44, 0.03, 0.06), oak, 0, 0.2 + i * 0.32, -0.04 * i * 0.32 / 0.18 * 0.18, { cast: false });
		add(lad, new THREE.CylinderGeometry(0.015, 0.015, 12, 6), brass, 2.5, 3.32, -0.22, { rz: Math.PI / 2, cast: false });
	}

	// ---------------------------------------------------------------- the fireplace, with a fire
	const flames = [];
	{
		const stone = mat("#d8cfc4", 0.8), dark = mat("#1e1814", 1);
		const fp = group(g, FP.x, 0, Z1, Math.PI);
		add(fp, new THREE.BoxGeometry(FP.w + 0.4, 1.35, 0.5), stone, 0, 0.675, 0.25);
		add(fp, new THREE.BoxGeometry(FP.w + 0.7, 0.1, 0.62), mat("#bfb4a6", 0.6), 0, 1.4, 0.3);
		add(fp, new THREE.BoxGeometry(FP.w - 0.6, 0.85, 0.06), dark, 0, 0.5, 0.51, { cast: false });
		add(fp, new THREE.BoxGeometry(FP.w + 0.9, 0.06, 0.7), mat("#3a3530", 0.6), 0, 0.03, 0.55, { cast: false });
		for (let i = 0; i < 6; i++) {
			const m = new THREE.MeshBasicMaterial({ color: i % 2 ? "#ffb347" : "#ff7a2f", transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
			const f = add(fp, new THREE.ConeGeometry(0.09 + R() * 0.05, 0.4, 10), m, -0.4 + i * 0.16, 0.32, 0.45, { cast: false });
			f.userData.ph = R() * 6;
			flames.push(f);
		}
		for (let i = 0; i < 3; i++) add(fp, new THREE.CylinderGeometry(0.05, 0.06, 0.8, 8), mat("#4a3020", 0.9), 0, 0.12 + i * 0.03, 0.45, { rz: Math.PI / 2, ry: i * 0.5 - 0.5, cast: false });
		// over the mantel: a big painting, and candlesticks
		for (const sx of [-1.1, 1.1]) add(fp, new THREE.CylinderGeometry(0.03, 0.04, 0.3, 10), mat("#c9a05a", 0.3, 0.9), sx, 1.6, 0.3, { cast: false });
		k.box(FP.x - FP.w / 2 - 0.45, FP.x + FP.w / 2 + 0.45, Z1 - 0.75, Z1);
		k.photo(67, FP.x, 2.35, Z1 - 0.03, Math.PI, { w: 1.4, h: 1.0, frame: "#c9a05a", metal: 0.7 });
		k.interact("library:fire", { label: "Warm your hands by the fire", stand: [FP.x + 1.0, Z1 - 1.25], face: 0, use: () => { ctx.doUpper("warm", 7000); ctx.sfx("whoosh", 0.3); } }, fp);
	}

	// ---------------------------------------------------------------- a chesterfield and two wing chairs round the fire
	{
		const leather = mat("#6e2f22", 0.45), wingM = mat("#2a4d3a", 0.85), brass = mat("#c9a05a", 0.3, 0.9);
		const SZ = Z1 - 3.4;
		const sofa = group(g, FP.x, 0, SZ, 0);
		add(sofa, rbox(2.2, 0.42, 0.9, 0.1), leather, 0, 0.26, 0);
		add(sofa, rbox(2.2, 0.55, 0.22, 0.1), leather, 0, 0.62, -0.38);
		for (const sx of [-1.05, 1.05]) add(sofa, rbox(0.22, 0.6, 0.9, 0.1), leather, sx, 0.42, 0);
		for (let i = 0; i < 9; i++) add(sofa, new THREE.SphereGeometry(0.015, 6, 4), brass, -0.85 + i * 0.21, 0.72, -0.26, { cast: false });
		add(sofa, rbox(0.42, 0.34, 0.12, 0.05), mat("#e9c46a", 0.85), -0.5, 0.62, -0.22, { rx: -0.2 });
		k.spot({ id: "libSofa0", x: FP.x - 0.45, z: SZ + 0.05, h: 0, y: 0.04 });
		k.spot({ id: "libSofa1", x: FP.x + 0.45, z: SZ + 0.05, h: 0, y: 0.04 });
		k.interact("library:sofa", { label: "Sit by the fire", stand: [FP.x + 1.6, SZ + 0.3], sit: ["libSofa0", "libSofa1"] }, sofa);
		k.box(FP.x - 1.15, FP.x + 1.15, SZ - 0.5, SZ + 0.45);
		[[FP.x - 2.3, SZ + 1.2, 0.9], [FP.x + 2.3, SZ + 1.2, -0.9]].forEach(([x, z, h], i) => {
			const c = group(g, x, 0, z, h);
			add(c, rbox(0.8, 0.42, 0.8, 0.08), wingM, 0, 0.24, 0);
			add(c, rbox(0.8, 0.85, 0.18, 0.08), wingM, 0, 0.8, -0.32);
			for (const sx of [-0.36, 0.36]) { add(c, rbox(0.12, 0.3, 0.7, 0.05), wingM, sx, 0.52, 0); add(c, rbox(0.1, 0.5, 0.28, 0.05), wingM, sx, 0.95, -0.22); }
			const id = "libChair" + i;
			k.spot({ id, x: x + Math.sin(h) * 0.03, z: z + Math.cos(h) * 0.03, h, y: 0.02 });
			k.interact("library:chair" + i, { label: "Sit in the wing chair", stand: [x + Math.sin(h) * 0.8, z + Math.cos(h) * 0.8], sit: [id] }, c);
			k.box(x - 0.45, x + 0.45, z - 0.45, z + 0.45);
		});
		// a low table with a chess set
		const t = group(g, FP.x, 0, SZ + 1.2);
		add(t, rbox(1.0, 0.05, 0.6, 0.02), mat("#4a2f22", 0.45), 0, 0.42, 0);
		for (const sx of [-0.42, 0.42]) for (const sz of [-0.24, 0.24]) add(t, new THREE.BoxGeometry(0.05, 0.4, 0.05), mat("#4a2f22", 0.45), sx, 0.2, sz, { cast: false });
		const board = add(t, new THREE.PlaneGeometry(0.4, 0.4), mat("#ffffff", 0.5, 0, { map: tex.tiles("#f1e3c6", "#5a3a2a", "#3a2a1f", 1, 1, 8) }), 0, 0.452, 0, { rx: -Math.PI / 2, cast: false });
		void board;
		for (let i = 0; i < 12; i++) add(t, new THREE.CylinderGeometry(0.012, 0.016, 0.05 + (i % 3) * 0.015, 8), mat(i < 6 ? "#f4efe6" : "#1e1814", 0.4), -0.17 + (i % 6) * 0.068, 0.48, i < 6 ? -0.16 : 0.16, { cast: false });
		k.box(FP.x - 0.55, FP.x + 0.55, SZ + 0.9, SZ + 1.5);
		const rug = add(g, new THREE.PlaneGeometry(6.2, 4.6), mat("#ffffff", 1, 0, { map: tex.carpet("#7a3b2e", "#e8c27a") }), FP.x, 0.006, SZ + 0.6, { rx: -Math.PI / 2, cast: false });
		rug.userData.floor = true;
	}

	// ---------------------------------------------------------------- a reading desk under the west window, a globe
	{
		const wood = mat("#4a2f22", 0.45), green = new THREE.MeshStandardMaterial({ color: "#1f6b3f", roughness: 0.3, emissive: "#3fa86b", emissiveIntensity: 0.35 });
		const DZ = 21.1;   // (under the north window of the west wall)
		const dk = group(g, X0 + 0.75, 0, DZ, Math.PI / 2);
		add(dk, rbox(1.5, 0.06, 0.7, 0.02), wood, 0, 0.76, 0);
		for (const sx of [-0.68, 0.68]) add(dk, new THREE.BoxGeometry(0.08, 0.74, 0.62), wood, sx, 0.37, 0);
		add(dk, new THREE.CylinderGeometry(0.06, 0.08, 0.03, 14), mat("#c9a05a", 0.3, 0.9), 0.45, 0.8, -0.15, { cast: false });
		add(dk, new THREE.CylinderGeometry(0.012, 0.012, 0.3, 8), mat("#c9a05a", 0.3, 0.9), 0.45, 0.95, -0.15, { cast: false });
		add(dk, new THREE.CylinderGeometry(0.06, 0.06, 0.32, 16, 1, false, 0, Math.PI), green, 0.45, 1.1, -0.1, { rz: Math.PI / 2, cast: false });
		add(dk, rbox(0.35, 0.05, 0.26, 0.01), mat("#7a1d33", 0.7), -0.2, 0.815, 0.05, { ry: 0.2, cast: false });
		add(dk, new THREE.PlaneGeometry(0.3, 0.22), mat("#f4efe6", 0.9), -0.2, 0.842, 0.05, { rx: -Math.PI / 2, rz: 0.2, cast: false });
		const ch = group(g, X0 + 1.45, 0, DZ, -Math.PI / 2);
		add(ch, rbox(0.5, 0.08, 0.48, 0.03), mat("#6e2f22", 0.5), 0, 0.47, 0);
		add(ch, rbox(0.5, 0.55, 0.07, 0.03), mat("#6e2f22", 0.5), 0, 0.8, -0.22);
		for (const sx of [-0.21, 0.21]) for (const sz of [-0.2, 0.2]) add(ch, new THREE.BoxGeometry(0.04, 0.46, 0.04), wood, sx, 0.23, sz, { cast: false });
		k.spot({ id: "libDesk", x: X0 + 1.42, z: DZ, h: -Math.PI / 2, y: 0.0 });
		k.interact("library:desk", { label: "Sit and read", stand: [X0 + 2.2, DZ], sit: ["libDesk"] }, dk, ch);
		k.box(X0, X0 + 1.15, DZ - 0.8, DZ + 0.8);
		// the globe
		const GX = -10.2, GZ = 17.2;
		const gl = group(g, GX, 0, GZ);
		add(gl, new THREE.CylinderGeometry(0.03, 0.06, 0.8, 10), wood, 0, 0.4, 0);
		add(gl, new THREE.TorusGeometry(0.34, 0.012, 6, 32), mat("#c9a05a", 0.3, 0.9), 0, 1.15, 0, { ry: 0.3, cast: false });
		var globe = add(gl, new THREE.SphereGeometry(0.3, 24, 16), mat("#ffffff", 0.5, 0, { map: tex.art(2) }), 0, 1.15, 0, { rz: 0.4 });
		k.box(GX - 0.35, GX + 0.35, GZ - 0.35, GZ + 0.35);
		k.interact("library:globe", { label: "Spin the globe", stand: [GX - 0.85, GZ], face: Math.PI / 2, use: () => { ctx.setShared("z:library:globe", Date.now()); ctx.sfx("whoosh", 0.3); } }, gl);
	}
	{
		const st = tex.sign("Gallery", "home");
		add(g, new THREE.PlaneGeometry(0.9, 0.225), new THREE.MeshStandardMaterial({ map: st, roughness: 0.45, emissive: "#ffffff", emissiveMap: st, emissiveIntensity: 0.3 }), (DOOR[0] + DOOR[1]) / 2, 2.75, Z0 + 0.04, { cast: false });
	}
	k.lightSwitch(DOOR[1] + 0.45, 1.25, Z0 + 0.02, 0);

	// ---------------------------------------------------------------- light
	const fire = k.light(FP.x, 0.8, Z1 - 1.0, "#ff9a4a", 4.5, 8);
	k.light(FP.x, 2.9, SZ_LIGHT(), "#ffe0b8", 4, 9);
	k.light(X0 + 1.2, 1.4, 21.1, "#c8ffd8", 1.4, 3.5);    // the desk lamp
	k.light(-10.5, 2.9, 14.0, "#ffe0b8", 3, 8);
	k.light(-19.5, 2.9, 14.0, "#ffe0b8", 2.5, 8);
	k.key.pos.copy(k.V(-15.2, H - 0.15, 16.4)); k.key.target.copy(k.V(-15.2, 0, 16.4));
	k.key.angle = 1.2; k.key.intensity = 12; k.key.distance = 14; k.key.color.set("#ffdcb0");
	k.fill.pos.copy(k.V(-15.2, 2.6, 16.4)); k.fill.intensity = 3; k.fill.distance = 16;
	k.hemi = 0.36; k.env = 0.22; k.exposure = 1.05;
	function SZ_LIGHT() { return Z1 - 3.6; }

	let globeSpin = 0;
	function update(dt, t) {
		flames.forEach((f, i) => { const s = 0.75 + Math.sin(t * 9 + f.userData.ph) * 0.2 + Math.sin(t * 15 + i) * 0.1; f.scale.set(1, s, 1); f.position.y = 0.12 + 0.2 * s; });
		fire.intensity = fire.base * (0.85 + Math.sin(t * 13) * 0.1 + Math.sin(t * 7.7) * 0.08);
		// (spun by someone: fast at first, slowing down)
		const sp = Math.max(0, 1 - (Date.now() - (ctx.get("z:library:globe") || 0)) / 6000);
		globeSpin += dt * (0.15 + sp * sp * 9);
		globe.rotation.y = globeSpin;
	}
	return { update };
}
