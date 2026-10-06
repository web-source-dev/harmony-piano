/**
 * Harmony World — the Haunted Mansion: a crooked old house off the west end of the garden (through the gap in the
 * garden's west railing). Indoors, and very dark.
 *
 * Local coordinates (origin at world -19.3, -21.65): x -11.7..11.7, z -8.45..1.95. The front door is in the east
 * wall (x 11.7) at z -0.75..0.75, onto the garden lawn. From the garden you see the facade: crooked gables, a
 * leaning tower, glowing boarded windows, a dripping "HAUNTED MANSION" sign, jack-o'-lanterns on the porch, a dead
 * tree and a little iron fence.
 *
 * The walk-through (north part, z -4.6..1.95), one room into the next and back round to the foyer:
 *   the foyer (a creaking chandelier, a grandfather clock, the stairs nobody goes up, the ghost train's platform)
 *   -> the portrait hallway (their eyes follow you... and then the lights go out)
 *   -> the library (books fly off the shelves at you, a green fire) -> the crypt (coffins, tombstones, mist:
 *   one coffin isn't quite empty) -> the mirror room (look closely) -> the dining room (ghost guests, floating
 *   plates, and bats in the rafters) -> back into the foyer.
 * Each scare goes off once a visit (walk out and back in for another go); the others in the house see the coffin,
 * the books, the bats and the mirror go too (a "zfx" message), the ghost that rushes at you is just for you.
 *
 * The ghost train (south part, z -8.45..-4.6, behind the walls): three carts for two on a loop that runs on the wall
 * clock (Date.now), out past the graveyard, the dancing skeletons, through the swinging doors, under the spider, round
 * the vampire's coffin, back past the witch's cauldron, the ghost bride, the wall of eyes and home. The scenes
 * wake up as a cart comes by (the same for everyone, worked out from where the carts are). Board from the platform
 * in the foyer; you go round and round until you press Esc.
 *
 * Lights: seven flickering ones (one per room, and a lantern on the front cart that travels the track).
 */
const OX = -19.3, OZ = -21.65;                    // = ZONES.haunted ox / oz
const X0 = -11.7, X1 = 11.7, Z0 = -8.45, Z1 = 1.95, H = 3.8;
const SW = -4.6;                                    // the wall between the walk-through and the ghost train
const DOOR = { z0: -0.75, z1: 0.75, h: 2.5 };
const TR = { zA: -7.55, zB: -5.5, xE: 9.6, xW: -9.9, v: 0.85 };   // the ghost train's track: out along zA, back along zB
TR.zc = (TR.zA + TR.zB) / 2; TR.R = (TR.zB - TR.zA) / 2; TR.Ls = TR.xE - TR.xW; TR.L = 2 * TR.Ls + 2 * Math.PI * TR.R;
const CARTS = 3;
const EPOCH = 1.7e9;
const TAU = Math.PI * 2;
const clock = () => Date.now() / 1000 - EPOCH;
const smooth = u => u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u);
const mod = (a, n) => ((a % n) + n) % n;
// the rooms of the walk-through (local) and where each scare goes off
const ROOMS = {
	foyer: { x0: 6.2, x1: X1, z0: SW, z1: Z1 },
	hall: { x0: -1.0, x1: 6.2, z0: -0.2, z1: Z1 },
	library: { x0: -6.5, x1: -1.0, z0: -1.6, z1: Z1 },
	crypt: { x0: X0, x1: -6.5, z0: SW, z1: Z1 },
	mirror: { x0: -6.5, x1: -1.0, z0: SW, z1: -1.6 },
	dining: { x0: -1.0, x1: 6.2, z0: SW, z1: -0.2 }
};
const SCARES = {
	foyer: { x0: 8.2, x1: 10.6, z0: -2.5, z1: 1.9 },
	hall: { x0: 1.6, x1: 3.4, z0: -0.2, z1: Z1 },
	library: { x0: -3.2, x1: -1.1, z0: -1.6, z1: Z1 },
	crypt: { x0: -10.4, x1: -6.7, z0: -2.6, z1: 0.6 },
	mirror: { x0: -4.7, x1: -2.8, z0: SW, z1: -3.3 },
	dining: { x0: -0.9, x1: 1.4, z0: SW, z1: -0.2 }
};

// a place on the ghost train's track at distance s (local): x, z, heading h (forward = (sin h, cos h))
function trackAt(s, out) {
	s = mod(s, TR.L);
	const { Ls, R } = TR, arc = Math.PI * R;
	if (s < Ls) { out.x = TR.xW + s; out.z = TR.zB; out.h = Math.PI / 2; return out; }
	s -= Ls;
	if (s < arc) { const f = s / R; out.x = TR.xE + R * Math.sin(f); out.z = TR.zc + R * Math.cos(f); out.h = Math.atan2(Math.cos(f), -Math.sin(f)); return out; }
	s -= arc;
	if (s < Ls) { out.x = TR.xE - s; out.z = TR.zA; out.h = -Math.PI / 2; return out; }
	s -= Ls;
	const f = Math.PI + s / R;
	out.x = TR.xW + R * Math.sin(f); out.z = TR.zc + R * Math.cos(f); out.h = Math.atan2(Math.cos(f), -Math.sin(f));
	return out;
}
const cartS = c => mod(clock() * TR.v + c * TR.L / CARTS, TR.L);

export function build(k) {
	const { THREE, add, mat, group, rbox, g, ctx, canvasTex, rng } = k;
	const R = rng(1313);
	const Y = new THREE.Vector3(0, 1, 0);
	const glow = (c, o) => new THREE.MeshBasicMaterial(Object.assign({ color: c, toneMapped: false }, o || {}));
	const ghostM = new THREE.MeshStandardMaterial({ color: "#e8f2ff", emissive: "#a8c8ff", emissiveIntensity: 0.7, transparent: true, opacity: 0.55, depthWrite: false, roughness: 0.6 });
	const blackM = mat("#050307", 0.9);
	const boneM = mat("#e9e1cc", 0.7);
	const ironM = mat("#1c1a1f", 0.5, 0.7);
	const local = (wx, wz) => [wx - OX, wz - OZ];
	const inRect = (r, x, z) => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1;
	k.floor(() => 0);
	k.walk(X0 + 0.12, X1 - 0.12, SW + 0.12, Z1 - 0.12);
	k.walk(X1 - 0.8, X1 + 0.5, DOOR.z0, DOOR.z1);   // the front door, out onto the lawn
	k.cam = { minX: X0 + 0.2, maxX: X1 - 0.2, minZ: Z0 + 0.2, maxZ: Z1 - 0.2, maxY: H - 0.3, minY: 0.2 };

	// ================================================================ textures and materials
	const planks = canvasTex(512, 512, (c, w, h) => {
		c.fillStyle = "#2a1d17"; c.fillRect(0, 0, w, h);
		const r = rng(7);
		for (let i = 0; i < 8; i++) {
			const t = 30 + r() * 22;
			c.fillStyle = `rgb(${t + 14},${t * 0.7 | 0},${t * 0.5 | 0})`; c.fillRect(0, i * 64 + 2, w, 60);
			for (let n = 0; n < 60; n++) { c.fillStyle = `rgba(0,0,0,${r() * 0.3})`; c.fillRect(r() * w, i * 64 + r() * 60, 20 + r() * 60, 1); }
			c.fillStyle = "#0d0806"; c.fillRect(((i * 37) % 8) * 64, i * 64, 3, 64);
		}
	}, 12, 6);
	const damask = canvasTex(256, 256, (c, w, h) => {
		c.fillStyle = "#1d1222"; c.fillRect(0, 0, w, h);
		c.fillStyle = "rgba(120,70,140,0.18)";
		for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) {
			c.save(); c.translate(64 + x * 128, 64 + y * 128);
			for (let i = 0; i < 6; i++) { c.rotate(Math.PI / 3); c.beginPath(); c.ellipse(0, 22, 9, 26, 0, 0, TAU); c.fill(); }
			c.restore();
		}
		const r = rng(9);
		for (let i = 0; i < 400; i++) { c.fillStyle = `rgba(0,0,0,${r() * 0.25})`; c.fillRect(r() * w, r() * h, 3, 8 + r() * 30); }   // (water stains)
	}, 6, 1.5);
	const stone = canvasTex(512, 512, (c, w, h) => {
		c.fillStyle = "#2a2d36"; c.fillRect(0, 0, w, h);
		const r = rng(11);
		for (let j = 0; j < 8; j++) for (let i = 0; i < 4; i++) {
			const t = 40 + r() * 26;
			c.fillStyle = `rgb(${t},${t + 3},${t + 10})`;
			c.fillRect(i * 128 + (j % 2) * 64 + 3, j * 64 + 3, 122, 58);
			for (let n = 0; n < 30; n++) { c.fillStyle = `rgba(80,110,70,${r() * 0.18})`; c.fillRect(i * 128 + (j % 2) * 64 + r() * 120, j * 64 + r() * 58, 4, 3); }
		}
	}, 3, 2);
	const velvet = canvasTex(64, 256, (c, w, h) => { const gr = c.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, "#2a0509"); gr.addColorStop(0.5, "#5a0d16"); gr.addColorStop(1, "#2a0509"); c.fillStyle = gr; c.fillRect(0, 0, w, h); }, 14, 1);
	const siding = canvasTex(256, 256, (c, w, h) => {
		c.fillStyle = "#2b2633"; c.fillRect(0, 0, w, h);
		const r = rng(21);
		for (let i = 0; i < 8; i++) { const t = 38 + r() * 18; c.fillStyle = `rgb(${t},${t - 4},${t + 8})`; c.fillRect(i * 32 + 1, 0, 30, h); c.fillStyle = "rgba(0,0,0,.5)"; c.fillRect(i * 32, 0, 2, h); }
		for (let n = 0; n < 300; n++) { c.fillStyle = `rgba(0,0,0,${r() * 0.3})`; c.fillRect(r() * w, r() * h, 2, 10 + r() * 40); }
	}, 6, 1.5);
	const shingles = canvasTex(256, 256, (c, w, h) => {
		c.fillStyle = "#16131b"; c.fillRect(0, 0, w, h);
		const r = rng(23);
		for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) { const t = 22 + r() * 16; c.fillStyle = `rgb(${t},${t - 2},${t + 6})`; c.beginPath(); c.ellipse(i * 32 + (j % 2) * 16 + 16, j * 32 + 20, 15, 16, 0, 0, Math.PI); c.fill(); }
	}, 8, 3);
	const web = canvasTex(256, 256, (c, w, h) => {
		c.strokeStyle = "rgba(230,235,245,0.55)"; c.lineWidth = 1.5;
		for (let i = 0; i <= 8; i++) { const a = i / 8 * Math.PI / 2; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(a) * w, Math.sin(a) * h); c.stroke(); }
		for (let r2 = 30; r2 < w; r2 += 28) { c.beginPath(); for (let i = 0; i <= 8; i++) { const a = i / 8 * Math.PI / 2, rr = r2 * (0.92 + 0.08 * Math.sin(i * 2)); i ? c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : c.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); } c.stroke(); }
	});
	const webM = new THREE.MeshBasicMaterial({ map: web, transparent: true, depthWrite: false, side: THREE.DoubleSide, opacity: 0.8 });
	const puff = canvasTex(128, 128, (c, w, h) => { const gr = c.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, "rgba(255,255,255,0.9)"); gr.addColorStop(0.5, "rgba(255,255,255,0.35)"); gr.addColorStop(1, "rgba(255,255,255,0)"); c.fillStyle = gr; c.fillRect(0, 0, w, h); });
	const woodM = mat("#ffffff", 0.8, 0, { map: planks });
	const wallM = mat("#ffffff", 0.95, 0, { map: damask });
	const stoneM = mat("#ffffff", 0.95, 0, { map: stone });
	const velvetM = mat("#ffffff", 0.9, 0, { map: velvet });
	const panelM = mat("#3b2416", 0.7);
	const darkWallM = mat("#120c14", 0.95);
	const trimM = mat("#1a0f0c", 0.6);
	const goldM = mat("#a8823f", 0.35, 0.8);
	const text = (t, o) => new THREE.MeshBasicMaterial({ map: k.tex.text(t, Object.assign({ w: 1024, h: 256 }, o)), transparent: true, depthWrite: false, toneMapped: false });

	// ================================================================ floor, ceiling, walls
	add(g, new THREE.PlaneGeometry(X1 - X0, Z1 - Z0), woodM, 0, 0, (Z0 + Z1) / 2, { rx: -Math.PI / 2, cast: false }).userData.floor = true;
	add(g, new THREE.PlaneGeometry(ROOMS.crypt.x1 - X0, Z1 - SW), stoneM, (X0 + ROOMS.crypt.x1) / 2, 0.012, (SW + Z1) / 2, { rx: -Math.PI / 2, cast: false });
	add(g, new THREE.PlaneGeometry(X1 - X0, SW - Z0), mat("#0c0a10", 0.9), 0, 0.012, (Z0 + SW) / 2, { rx: -Math.PI / 2, cast: false });   // (the ghost train's floor)
	k.ceilParts = [add(g, new THREE.PlaneGeometry(X1 - X0, Z1 - Z0), mat("#0e0a10", 0.95), 0, H, (Z0 + Z1) / 2, { rx: Math.PI / 2, cast: false })];
	k.camWall(X0 - 0.2, X1 + 0.2, Z0 - 0.2, Z1 + 0.2, H, H + 3.2);   // (the ceiling and the roof space over it: no rising through it, no dropping in from the garden)
	const T = 0.2;
	// a wall along x at z (holes: { u0, u1, y1 } doorways). The solid parts are k.wall (you can't walk into them and
	// the camera never goes through them); the bit over a doorway is a camera wall too
	function wallX(z, x0, x1, m, holes = [], h = H) {
		let u = x0;
		const seg = (a, b, y0, y1) => { if (b - a > 0.01 && y1 - y0 > 0.01) add(g, new THREE.BoxGeometry(b - a, y1 - y0, T), m, (a + b) / 2, (y0 + y1) / 2, z, { cast: false }); };
		const solid = (a, b) => { if (b - a > 0.01) { seg(a, b, 0, h); k.wall(a, b, z - T / 2, z + T / 2, 0, h); } };
		for (const hl of holes) { solid(u, hl.u0); if (hl.y1) { seg(hl.u0, hl.u1, hl.y1, h); k.camWall(hl.u0, hl.u1, z - T / 2, z + T / 2, hl.y1, h); doorTrim(true, (hl.u0 + hl.u1) / 2, z, hl.u1 - hl.u0, hl.y1); } u = hl.u1; }
		solid(u, x1);
	}
	function wallZ(x, z0, z1, m, holes = [], h = H) {
		let u = z0;
		const seg = (a, b, y0, y1) => { if (b - a > 0.01 && y1 - y0 > 0.01) add(g, new THREE.BoxGeometry(T, y1 - y0, b - a), m, x, (y0 + y1) / 2, (a + b) / 2, { cast: false }); };
		const solid = (a, b) => { if (b - a > 0.01) { seg(a, b, 0, h); k.wall(x - T / 2, x + T / 2, a, b, 0, h); } };
		for (const hl of holes) { solid(u, hl.u0); if (hl.y1) { seg(hl.u0, hl.u1, hl.y1, h); k.camWall(x - T / 2, x + T / 2, hl.u0, hl.u1, hl.y1, h); doorTrim(false, x, (hl.u0 + hl.u1) / 2, hl.u1 - hl.u0, hl.y1); } u = hl.u1; }
		solid(u, z1);
	}
	function doorTrim(alongX, x, z, w, h) {
		const d = T + 0.06;
		for (const s of [-1, 1]) add(g, new THREE.BoxGeometry(alongX ? 0.1 : d, h, alongX ? d : 0.1), trimM, alongX ? x + s * (w / 2 + 0.05) : x, h / 2, alongX ? z : z + s * (w / 2 + 0.05), { cast: false });
		add(g, new THREE.BoxGeometry(alongX ? w + 0.2 : d, 0.12, alongX ? d : w + 0.2), trimM, x, h + 0.06, z, { cast: false });
	}
	// the outside walls (the east one has the front door)
	wallX(Z1 + T / 2, X0 - T, X1 + T, darkWallM);
	wallX(Z0 - T / 2, X0 - T, X1 + T, darkWallM);
	wallZ(X0 - T / 2, Z0, Z1, darkWallM);
	wallZ(X1 + T / 2, Z0, Z1, darkWallM, [{ u0: DOOR.z0, u1: DOOR.z1, y1: DOOR.h }]);
	// inside: the rooms of the walk-through, and the wall in front of the ghost train (open at the platform)
	wallZ(ROOMS.foyer.x0, SW, Z1, wallM, [{ u0: -4.0, u1: -2.8, y1: 2.4 }, { u0: 0.55, u1: 1.75, y1: 2.4 }]);
	wallX(-0.2, -1.0, ROOMS.foyer.x0, wallM);
	wallZ(-1.0, SW, -0.2, wallM, [{ u0: -3.6, u1: -2.4, y1: 2.3 }]);
	wallX(-1.6, -6.5, -1.0, panelM);
	wallZ(-6.5, SW, Z1, stoneM, [{ u0: -4.0, u1: -2.8, y1: 2.3 }, { u0: 0.2, u1: 1.4, y1: 2.3 }]);
	const PLAT = { x0: 7.4, x1: 10.8 };
	wallX(SW, X0, X1, darkWallM, [{ u0: PLAT.x0, u1: PLAT.x1, y1: 2.6 }]);
	k.box(PLAT.x0, PLAT.x1, SW - 0.1, SW + 0.1);   // (the platform's railing: you board with the button, not by climbing over)
	// wall faces: wallpaper in the foyer / hall / dining room, panelling in the library, velvet in the mirror room
	// (each 1.2 cm off the wall's face, so it never flickers through it)
	const facing = (x, z, w, hh, ry, m) => add(g, new THREE.PlaneGeometry(w, hh), m, x, hh / 2, z, { ry, cast: false });
	facing((ROOMS.mirror.x0 + ROOMS.mirror.x1) / 2, SW + T / 2 + 0.012, ROOMS.mirror.x1 - ROOMS.mirror.x0, H, 0, velvetM);
	facing((ROOMS.library.x0 + ROOMS.library.x1) / 2, Z1 - 0.012, ROOMS.library.x1 - ROOMS.library.x0, H, Math.PI, panelM);
	facing((X0 + ROOMS.crypt.x1) / 2, Z1 - 0.012, ROOMS.crypt.x1 - X0, H, Math.PI, stoneM);
	facing(X0 + 0.012, (SW + Z1) / 2, Z1 - SW, H, Math.PI / 2, stoneM);
	facing((ROOMS.hall.x0 + ROOMS.hall.x1) / 2, Z1 - 0.012, ROOMS.hall.x1 - ROOMS.hall.x0, H, Math.PI, wallM);
	facing((ROOMS.foyer.x0 + X1) / 2, Z1 - 0.012, X1 - ROOMS.foyer.x0, H, Math.PI, wallM);
	// a rug, a runner, cobwebs in the corners
	add(g, new THREE.PlaneGeometry(3.0, 3.8), mat("#4a0f1c", 0.95), 9.2, 0.02, -1.0, { rx: -Math.PI / 2, cast: false });
	add(g, new THREE.PlaneGeometry(6.6, 0.9), mat("#5a1220", 0.95), 2.6, 0.02, 0.85, { rx: -Math.PI / 2, cast: false });
	add(g, new THREE.PlaneGeometry(5.6, 2.6), mat("#2b1a3a", 0.95), 2.6, 0.02, -2.4, { rx: -Math.PI / 2, cast: false });
	const cobweb = (x, y, z, ry, s) => { const m = add(g, new THREE.PlaneGeometry(s, s), webM, x, y, z, { ry, cast: false, receive: false }); m.rotation.z = Math.PI; return m; };
	[[X1 - 0.35, Z1 - 0.12, Math.PI], [ROOMS.foyer.x0 + 0.3, Z1 - 0.12, -Math.PI / 2 + Math.PI], [-1.3, Z1 - 0.12, Math.PI], [-6.2, Z1 - 0.12, Math.PI], [X0 + 0.3, Z1 - 0.12, Math.PI], [X0 + 0.12, SW + 0.4, Math.PI / 2], [-1.2, SW + 0.12, 0], [5.9, SW + 0.12, 0], [X1 - 0.4, -8.33, 0], [X0 + 0.4, -8.33, 0], [-0.6, -8.33, 0]]
		.forEach(([x, z, ry]) => cobweb(x, H - 0.4, z, ry, 0.9 + R() * 0.5));

	// ================================================================ the lights
	const L = {
		foyer: k.light(9.0, 3.0, -1.3, "#ffb36b", 2.4, 7.5),
		hall: k.light(2.6, 2.4, 1.0, "#ff8f4a", 1.7, 5.5),
		library: k.light(-3.8, 2.0, 0.6, "#7dff9e", 1.8, 5.5),
		crypt: k.light(-9.1, 2.6, -1.3, "#6f8dff", 2.0, 7),
		mirror: k.light(-3.8, 2.2, -3.1, "#ff3b4e", 1.5, 4.8),
		dining: k.light(2.6, 2.6, -2.4, "#c58bff", 2.0, 6.5),
		cart: k.light(0, 1.3, -6.5, "#a8ff6b", 2.4, 5.5)
	};
	k.key.pos.copy(k.V(0, H - 0.2, -1.3)); k.key.target.copy(k.V(0, 0, -1.3));
	k.key.color.set("#5b4cff"); k.key.intensity = 2.2; k.key.angle = 1.35; k.key.penumbra = 0.9; k.key.distance = 18;
	k.fill.pos.copy(k.V(0, 2.4, -2)); k.fill.color.set("#3a2a5a"); k.fill.intensity = 0.9; k.fill.distance = 20;
	k.hemi = 0.09; k.env = 0.05; k.exposure = 0.95;

	// candles: little sticks with flames that flicker (one instanced mesh for every flame in the house)
	const flames = [];
	const candle = (x, y, z, hgt = 0.18) => { add(g, new THREE.CylinderGeometry(0.03, 0.035, hgt, 8), mat("#efe6d2", 0.6), x, y + hgt / 2, z, { cast: false }); flames.push([x, y + hgt + 0.04, z]); };
	const candelabra = (x, z, y0 = 0) => {
		add(g, new THREE.CylinderGeometry(0.03, 0.12, 1.25, 10), ironM, x, y0 + 0.62, z, { cast: false });
		for (const dx of [-0.18, 0, 0.18]) { add(g, new THREE.CylinderGeometry(0.04, 0.03, 0.05, 8), ironM, x + dx, y0 + 1.27 + (dx ? 0 : 0.08), z, { cast: false }); candle(x + dx, y0 + 1.3 + (dx ? 0 : 0.08), z, 0.16); }
		add(g, new THREE.CylinderGeometry(0.012, 0.012, 0.36, 6), ironM, x, y0 + 1.27, z, { rz: Math.PI / 2, cast: false });
		k.box(x - 0.15, x + 0.15, z - 0.15, z + 0.15);
	};

	// ================================================================ ghosts, skeletons, bats (shared builders)
	function makeGhost(s, m) {
		const gg = new THREE.Group();
		const pts = [];
		for (let i = 0; i <= 12; i++) { const u = i / 12; pts.push(new THREE.Vector2(0.001 + Math.sin(u * Math.PI * 0.5) * 0.36 * (1 + u * 0.25), 1.2 - u * 1.2)); }
		const body = new THREE.Mesh(new THREE.LatheGeometry(pts, 20), m || ghostM);
		gg.add(body);
		const top = new THREE.Mesh(new THREE.SphereGeometry(0.36, 18, 12, 0, TAU, 0, Math.PI / 2), m || ghostM);
		top.position.y = 1.2; gg.add(top);
		for (const sx of [-0.12, 0.12]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), blackM); e.position.set(sx, 1.28, 0.31); e.scale.set(1, 1.5, 0.6); gg.add(e); }
		const mouth = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), blackM); mouth.position.set(0, 1.08, 0.33); mouth.scale.set(1, 1.6, 0.5); gg.add(mouth);
		for (const sx of [-1, 1]) { const a = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.5, 8), m || ghostM); a.position.set(sx * 0.38, 0.9, 0.08); a.rotation.z = sx * 1.1; gg.add(a); }
		gg.scale.setScalar(s);
		gg.traverse(o => { o.castShadow = false; o.receiveShadow = false; o.renderOrder = 3; });
		return gg;
	}
	function makeSkeleton() {
		const sk = new THREE.Group();
		const skull = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), boneM); skull.position.y = 1.52; skull.scale.set(1, 1.08, 1.05); sk.add(skull);
		const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.05, 0.12), boneM); jaw.position.set(0, 1.4, 0.03); sk.add(jaw);
		for (const sx of [-0.05, 0.05]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), glow("#ff2a2a")); e.position.set(sx, 1.54, 0.115); sk.add(e); }
		const spine = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.62, 6), boneM); spine.position.y = 1.08; sk.add(spine);
		for (let i = 0; i < 5; i++) { const r2 = new THREE.Mesh(new THREE.TorusGeometry(0.13 - i * 0.012, 0.014, 5, 14, Math.PI * 1.6), boneM); r2.position.y = 1.28 - i * 0.07; r2.rotation.set(Math.PI / 2, 0, Math.PI * 0.7); sk.add(r2); }
		const pelvis = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.03, 6, 12), boneM); pelvis.position.y = 0.76; pelvis.rotation.x = Math.PI / 2; sk.add(pelvis);
		const limbs = {};
		for (const [nm, x, y, len] of [["la", -0.2, 1.33, 0.62], ["ra", 0.2, 1.33, 0.62], ["ll", -0.09, 0.76, 0.75], ["rl", 0.09, 0.76, 0.75]]) {
			const piv = new THREE.Group(); piv.position.set(x, y, 0);
			const b = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.018, len, 6), boneM); b.position.y = -len / 2; piv.add(b);
			const end = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), boneM); end.position.y = -len; piv.add(end);
			sk.add(piv); limbs[nm] = piv;
		}
		sk.userData.limbs = limbs;
		sk.traverse(o => { o.castShadow = false; });
		return sk;
	}
	// a bat: a body and two wings (flapping = squashing x)
	const batGeo = (() => {
		const geo = new THREE.BufferGeometry();
		const v = [0, 0, 0.06, -0.24, 0.03, 0, 0, 0, -0.06, 0, 0, 0.06, 0, 0, -0.06, 0.24, 0.03, 0, -0.24, 0.03, 0, -0.14, -0.02, -0.04, 0, 0, -0.06, 0.24, 0.03, 0, 0, 0, -0.06, 0.14, -0.02, -0.04];
		geo.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
		geo.computeVertexNormals();
		return geo;
	})();
	const batM = new THREE.MeshBasicMaterial({ color: "#09060c", side: THREE.DoubleSide });
	function batFlock(n, roost) {
		const im = new THREE.InstancedMesh(batGeo, batM, n);
		im.frustumCulled = false; im.castShadow = false;
		g.add(im);
		const b = [];
		for (let i = 0; i < n; i++) b.push({ home: new THREE.Vector3(roost.x + (R() - 0.5) * roost.w, roost.y, roost.z + (R() - 0.5) * roost.d), ph: R() * TAU, r: 0.6 + R() * 1.3, sp: 2 + R() * 2, yy: R() });
		return { im, b, t: -1, center: new THREE.Vector3(roost.x, roost.y - 1.4, roost.z) };
	}
	const _d = new THREE.Object3D(), _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _cam = new THREE.Vector3(), _fwd = new THREE.Vector3();
	function updateBats(F, t, dt, target) {
		if (F.t >= 0) F.t += dt;
		const T2 = 3.6, u = F.t >= 0 ? Math.min(1, F.t / T2) : 0, w = F.t >= 0 ? Math.sin(Math.PI * u) : 0;
		if (F.t > T2) F.t = -1;
		F.b.forEach((b, i) => {
			const a = t * b.sp + b.ph;
			_v.set(F.center.x + Math.cos(a) * b.r, F.center.y + Math.sin(a * 1.7) * 0.5 + b.yy * 0.6, F.center.z + Math.sin(a) * b.r);
			if (target && i % 3 === 0) _v.lerp(target, 0.35 + 0.3 * Math.sin(a));
			_d.position.copy(b.home).lerp(_v, w);
			_d.rotation.set(w > 0.05 ? 0 : Math.PI, w > 0.05 ? -a : 0, 0);
			const flap = w > 0.05 ? 0.35 + 0.65 * Math.abs(Math.sin(t * 22 + b.ph)) : 0.25;
			_d.scale.set(flap, 1, 1);
			_d.updateMatrix(); F.im.setMatrixAt(i, _d.matrix);
		});
		F.im.instanceMatrix.needsUpdate = true;
	}
	// fog: soft puffs drifting low over the floor
	const fogM = new THREE.MeshBasicMaterial({ map: puff, color: "#8f9bc4", transparent: true, opacity: 0.16, depthWrite: false });
	const fogSpots = [];
	for (let i = 0; i < 14; i++) fogSpots.push([X0 + 0.6 + R() * (ROOMS.crypt.x1 - X0 - 1.2), SW + 0.6 + R() * (Z1 - SW - 1.2), 1.4 + R()]);
	for (let i = 0; i < 18; i++) fogSpots.push([X0 + 0.8 + R() * (X1 - X0 - 1.6), Z0 + 0.4 + R() * (SW - Z0 - 0.8), 1.2 + R() * 0.8]);
	for (let i = 0; i < 6; i++) fogSpots.push([ROOMS.foyer.x0 + 0.6 + R() * 4.6, SW + 0.5 + R() * 6, 1.4 + R()]);
	const fog = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), fogM, fogSpots.length);
	fog.castShadow = false; fog.receiveShadow = false; fog.frustumCulled = false; fog.renderOrder = 2;
	g.add(fog);

	// ================================================================ the foyer
	// a chandelier that swings and creaks
	const chand = group(g, 9.0, H, -1.3);
	{
		add(chand, new THREE.CylinderGeometry(0.012, 0.012, 0.9, 6), ironM, 0, -0.45, 0, { cast: false });
		add(chand, new THREE.TorusGeometry(0.55, 0.03, 6, 28), ironM, 0, -0.95, 0, { rx: Math.PI / 2, cast: false });
		for (let i = 0; i < 6; i++) {
			const a = i / 6 * TAU;
			add(chand, new THREE.CylinderGeometry(0.008, 0.008, 0.6, 4), ironM, Math.sin(a) * 0.28, -0.7, Math.cos(a) * 0.28, { rz: Math.cos(a) * 0.4, rx: -Math.sin(a) * 0.4, cast: false });
			add(chand, new THREE.CylinderGeometry(0.025, 0.03, 0.14, 8), mat("#efe6d2", 0.6), Math.sin(a) * 0.55, -0.86, Math.cos(a) * 0.55, { cast: false });
		}
	}
	const chandFlames = new THREE.InstancedMesh(new THREE.ConeGeometry(0.025, 0.08, 6), glow("#ffcf6e"), 6);
	for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; _d.position.set(Math.sin(a) * 0.55, -0.75, Math.cos(a) * 0.55); _d.rotation.set(0, 0, 0); _d.scale.set(1, 1, 1); _d.updateMatrix(); chandFlames.setMatrixAt(i, _d.matrix); }
	chandFlames.castShadow = false; chand.add(chandFlames);
	// the grandfather clock (its pendulum swings; it never tells the right time)
	const clockG = group(g, 10.95, 0, 1.55, -Math.PI / 2);
	let pendulum;
	{
		add(clockG, rbox(0.6, 2.3, 0.42, 0.03), panelM, 0, 1.15, 0);
		add(clockG, new THREE.CylinderGeometry(0.22, 0.22, 0.02, 24), mat("#d8cfb4", 0.6), 0, 1.85, 0.22, { rx: Math.PI / 2, cast: false });
		for (const [len, a] of [[0.15, 0.6], [0.19, 2.9]]) add(clockG, new THREE.BoxGeometry(0.012, len, 0.01), blackM, Math.sin(a) * len / 2, 1.85 + Math.cos(a) * len / 2, 0.235, { rz: -a, cast: false });
		add(clockG, new THREE.PlaneGeometry(0.4, 1.1), mat("#120a08", 0.3, 0.3, { transparent: true, opacity: 0.6 }), 0, 1.0, 0.215, { cast: false });
		pendulum = group(clockG, 0, 1.55, 0.1);
		add(pendulum, new THREE.CylinderGeometry(0.008, 0.008, 0.8, 4), goldM, 0, -0.4, 0, { cast: false });
		add(pendulum, new THREE.CylinderGeometry(0.09, 0.09, 0.02, 16), goldM, 0, -0.82, 0, { rx: Math.PI / 2, cast: false });
		k.wall(10.72, 11.18, 1.22, 1.88, 0, 2.3);
	}
	// the stairs nobody goes up (a little ghost girl waits at the top)
	{
		// (along the north wall, rising to the east: clear of the doorway into the hall)
		for (let i = 0; i < 8; i++) add(g, new THREE.BoxGeometry(0.32, 0.24 * (i + 1), 1.0), panelM, 8.16 + i * 0.32, 0.12 * (i + 1), 1.4, { cast: false });
		add(g, new THREE.BoxGeometry(2.7, 0.06, 0.06), trimM, 9.3, 1.75, 0.88, { rz: 0.6, cast: false });
		k.wall(7.95, 10.65, 0.85, Z1, 0, 2.0);
		var girl = makeGhost(0.55);
		girl.position.set(10.4, 1.95, 1.4); girl.rotation.y = -Math.PI / 2;
		g.add(girl);
	}
	// a suit of armour by the door, its visor glowing
	{
		const ar = group(g, 11.2, 0, -2.6, -Math.PI / 2);
		const steel = mat("#7d8590", 0.3, 0.9);
		add(ar, new THREE.CylinderGeometry(0.2, 0.25, 0.5, 12), steel, 0, 1.15, 0);
		add(ar, new THREE.SphereGeometry(0.15, 14, 10), steel, 0, 1.6, 0);
		add(ar, new THREE.BoxGeometry(0.18, 0.03, 0.02), glow("#ff3030"), 0, 1.62, 0.15, { cast: false });
		for (const sx of [-0.1, 0.1]) add(ar, new THREE.CylinderGeometry(0.06, 0.05, 0.9, 8), steel, sx, 0.45, 0);
		for (const sx of [-0.28, 0.28]) add(ar, new THREE.CylinderGeometry(0.05, 0.04, 0.6, 8), steel, sx, 1.1, 0);
		add(ar, new THREE.CylinderGeometry(0.015, 0.015, 2.0, 6), steel, 0.32, 1.0, 0.05, { cast: false });
		add(ar, new THREE.ConeGeometry(0.06, 0.3, 4), steel, 0.32, 2.1, 0.05, { cast: false });
		k.box(10.95, 11.5, -2.9, -2.3);
	}
	candelabra(7.0, -0.6);
	// the platform: a railing, a sign
	{
		for (let i = 0; i <= 10; i++) add(g, new THREE.CylinderGeometry(0.025, 0.025, 1.0, 6), ironM, PLAT.x0 + (PLAT.x1 - PLAT.x0) * i / 10, 0.5, SW, { cast: false });
		add(g, new THREE.BoxGeometry(PLAT.x1 - PLAT.x0, 0.05, 0.06), ironM, (PLAT.x0 + PLAT.x1) / 2, 1.0, SW, { cast: false });
		for (let i = 0; i < 10; i++) add(g, new THREE.ConeGeometry(0.03, 0.12, 4), ironM, PLAT.x0 + (PLAT.x1 - PLAT.x0) * (i + 0.5) / 10, 1.08, SW, { cast: false });
		add(g, new THREE.PlaneGeometry(2.6, 0.65), text("Ghost Train", { color: "#b8ff8a", glow: "#3aff6a", font: "800 150px 'Creepster', 'Caveat', cursive" }), (PLAT.x0 + PLAT.x1) / 2, 2.95, SW + 0.12, { cast: false, receive: false });
	}

	// ================================================================ the portrait hallway: their eyes follow you
	const portraits = [];
	{
		const faceTex = seed => canvasTex(192, 256, (c, w, h) => {
			const r = rng(seed);
			const gr = c.createRadialGradient(w / 2, h * 0.4, 10, w / 2, h / 2, h * 0.7); gr.addColorStop(0, "#3d3328"); gr.addColorStop(1, "#0c0806"); c.fillStyle = gr; c.fillRect(0, 0, w, h);
			c.fillStyle = ["#1b1410", "#241a2e", "#14201a"][seed % 3]; c.beginPath(); c.moveTo(w * 0.15, h); c.quadraticCurveTo(w / 2, h * 0.55, w * 0.85, h); c.fill();
			c.fillStyle = "#b8ab92"; c.beginPath(); c.ellipse(w / 2, h * 0.42, 34 + r() * 6, 46 + r() * 6, 0, 0, TAU); c.fill();
			c.fillStyle = ["#2a1a10", "#5a5a5a", "#1a1a1a", "#6b3a1a"][seed % 4]; c.beginPath(); c.ellipse(w / 2, h * 0.3, 40, 26, 0, Math.PI, TAU); c.fill();
			c.fillStyle = "#1a0e0a"; c.fillRect(w / 2 - 14, h * 0.55, 28, 3);
			c.fillStyle = "#0a0605"; for (const sx of [-15, 15]) { c.beginPath(); c.ellipse(w / 2 + sx, h * 0.4, 9, 6, 0, 0, TAU); c.fill(); }   // (the eye holes: the eyes are real)
		});
		for (let i = 0; i < 5; i++) {
			const x = -0.2 + i * 1.35, pg = group(g, x, 1.65, Z1 - 0.12, Math.PI);
			add(pg, rbox(0.66, 0.84, 0.06, 0.02), goldM, 0, 0, -0.01, { cast: false });
			add(pg, new THREE.PlaneGeometry(0.56, 0.74), mat("#ffffff", 0.8, 0, { map: faceTex(i + 3) }), 0, 0, 0.025, { cast: false });
			const eyes = [];
			for (const sx of [-0.044, 0.044]) {
				add(pg, new THREE.SphereGeometry(0.022, 10, 8), mat("#e8e2d0", 0.4), sx, 0.07, 0.012, { cast: false });
				eyes.push(add(pg, new THREE.SphereGeometry(0.01, 8, 6), blackM, sx, 0.07, 0.031, { cast: false }));
			}
			portraits.push({ x, eyes, base: [-0.044, 0.044] });
			// a sconce between them
			if (i < 4) { add(g, new THREE.BoxGeometry(0.08, 0.2, 0.08), ironM, x + 0.67, 1.5, Z1 - 0.1, { cast: false }); candle(x + 0.67, 1.6, Z1 - 0.14, 0.12); }
		}
		// the ghost that's waiting for the lights to go out
		var rusher = makeGhost(1.15, new THREE.MeshStandardMaterial({ color: "#ffffff", emissive: "#d8e8ff", emissiveIntensity: 1.6, transparent: true, opacity: 0.85, depthWrite: false }));
		rusher.visible = false;
		// (right up at the camera: drawn last, over everything, never culled)
		rusher.traverse(o => { o.renderOrder = 6; o.frustumCulled = false; if (o.material) o.material = o.material === blackM ? new THREE.MeshBasicMaterial({ color: "#000", depthTest: false }) : o.material; if (o.material) o.material.depthTest = false; });
		g.add(rusher);
	}

	// ================================================================ the library: books that fly
	const books = [];
	{
		const shelf = (x0, x1, z, ry) => {
			const n = Math.round((x1 - x0) / 1.0);
			const bg = group(g, (x0 + x1) / 2, 0, z, ry);
			add(bg, rbox(x1 - x0, 2.9, 0.38, 0.02), panelM, 0, 1.45, 0);
			for (let s = 0; s < 6; s++) {
				add(bg, new THREE.BoxGeometry(x1 - x0 - 0.1, 0.03, 0.34), trimM, 0, 0.25 + s * 0.48, 0.03, { cast: false });
				let bx = -(x1 - x0) / 2 + 0.08;
				while (bx < (x1 - x0) / 2 - 0.1) {
					const bw = 0.04 + R() * 0.05, bh = 0.24 + R() * 0.14;
					add(bg, new THREE.BoxGeometry(bw, bh, 0.24), mat(["#5a1a1a", "#1a3a2a", "#2a2a4a", "#4a3a1a", "#3a1a3a"][(R() * 5) | 0], 0.8), bx + bw / 2, 0.27 + s * 0.48 + bh / 2, 0.06, { cast: false });
					bx += bw + 0.005;
				}
			}
			return n;
		};
		shelf(-6.3, -1.4, Z1 - 0.25, Math.PI);
		k.box(-6.4, -1.3, Z1 - 0.5, Z1);
		// the books that come off the shelves
		const covers = ["#7a1a1a", "#1a4a2a", "#2a2a6a", "#6a4a1a", "#4a1a4a"];
		for (let i = 0; i < 10; i++) {
			const bk = add(g, new THREE.BoxGeometry(0.22, 0.3, 0.05), mat(covers[i % 5], 0.7), 0, 0, 0, { cast: false });
			const home = new THREE.Vector3(-5.9 + i * 0.48, 0.45 + (i % 4) * 0.62, Z1 - 0.2);
			bk.position.copy(home);
			books.push({ m: bk, home, ph: R() * TAU, float: i < 3 });
		}
		// the fireplace with green flames, a ghost in the armchair
		const fp = group(g, -3.8, 0, -1.4);
		add(fp, rbox(1.6, 1.3, 0.35, 0.03), stoneM, 0, 0.65, 0);
		add(fp, new THREE.BoxGeometry(0.9, 0.7, 0.1), blackM, 0, 0.4, 0.15, { cast: false });
		add(fp, rbox(1.8, 0.08, 0.45, 0.02), stoneM, 0, 1.33, 0.03);
		var fireM = glow("#4dff7a", { transparent: true, opacity: 0.85, depthWrite: false });
		var fire = [];
		for (let i = 0; i < 5; i++) fire.push(add(fp, new THREE.ConeGeometry(0.09, 0.4, 8), fireM, -0.25 + i * 0.125, 0.25, 0.18, { cast: false, receive: false }));
		candle(-4.4, 1.37, -1.36); candle(-3.2, 1.37, -1.36);
		k.box(-4.65, -2.95, -1.6, -1.15);
		const chair = group(g, -5.6, 0, -0.6, 0.8);
		add(chair, rbox(0.75, 0.45, 0.7, 0.1), mat("#3a0f18", 0.85), 0, 0.3, 0);
		add(chair, rbox(0.75, 0.8, 0.2, 0.08), mat("#3a0f18", 0.85), 0, 0.85, -0.28);
		for (const sx of [-0.33, 0.33]) add(chair, rbox(0.12, 0.3, 0.7, 0.05), mat("#3a0f18", 0.85), sx, 0.6, 0);
		var readerGhost = makeGhost(0.62);
		readerGhost.position.set(0, 0.35, 0.05);
		chair.add(readerGhost);
		k.box(-6.05, -5.15, -1.05, -0.15);
	}

	// ================================================================ the crypt: coffins, tombstones, mist
	let coffinLid, coffinSk;
	{
		const coffinGeo = (() => {
			const sh = new THREE.Shape();
			sh.moveTo(-0.25, -0.95); sh.lineTo(0.25, -0.95); sh.lineTo(0.36, 0.45); sh.lineTo(0.22, 0.95); sh.lineTo(-0.22, 0.95); sh.lineTo(-0.36, 0.45); sh.closePath();
			return sh;
		})();
		const woodC = mat("#2a1810", 0.7);
		const coffin = (x, z, ry, open) => {
			const cg = group(g, x, 0, z, ry);
			const box = add(cg, new THREE.ExtrudeGeometry(coffinGeo, { depth: 0.45, bevelEnabled: false }), woodC, 0, 0.08, 0, { rx: -Math.PI / 2 });
			box.position.y = 0.05;
			add(cg, new THREE.ExtrudeGeometry(coffinGeo, { depth: 0.04, bevelEnabled: false }), blackM, 0, 0.49, 0, { rx: -Math.PI / 2, cast: false }).scale.set(0.9, 0.95, 1);
			const lidPiv = group(cg, 0.36, 0.52, 0);
			const lid = add(lidPiv, new THREE.ExtrudeGeometry(coffinGeo, { depth: 0.06, bevelEnabled: false }), woodC, -0.36, 0, 0, { rx: -Math.PI / 2 });
			add(lidPiv, new THREE.BoxGeometry(0.05, 0.02, 0.5), goldM, -0.36, 0.065, -0.2, { cast: false });
			add(lidPiv, new THREE.BoxGeometry(0.25, 0.02, 0.05), goldM, -0.36, 0.065, -0.3, { cast: false });
			if (open) lidPiv.rotation.z = 0.25;
			const along = Math.abs(Math.sin(ry)) > 0.5;
			k.box(x - (along ? 1.0 : 0.6), x + (along ? 1.0 : 0.6), z - (along ? 0.6 : 1.0), z + (along ? 0.6 : 1.0));
			return { cg, lidPiv, lid };
		};
		const C = coffin(-9.4, -0.8, Math.PI / 2, false);
		coffinLid = C.lidPiv;
		coffinSk = makeSkeleton();
		coffinSk.position.set(0, 0.25, 0.7);
		coffinSk.rotation.x = -Math.PI / 2;
		coffinSk.scale.setScalar(0.9);
		C.cg.add(coffinSk);
		coffin(-10.6, -3.4, 0.2, true);
		coffin(-9.0, -4.0, Math.PI / 2, false);
		// tombstones
		const tomb = (x, z, ry, s, txt) => {
			const tg = group(g, x, 0, z, ry);
			const sh = new THREE.Shape(); sh.moveTo(-0.3, 0); sh.lineTo(0.3, 0); sh.lineTo(0.3, 0.6); sh.absarc(0, 0.6, 0.3, 0, Math.PI, false); sh.closePath();
			add(tg, new THREE.ExtrudeGeometry(sh, { depth: 0.12, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 1 }), mat("#5a5e66", 0.95), 0, 0, -0.06).scale.setScalar(s);
			add(tg, new THREE.PlaneGeometry(0.5 * s, 0.25 * s), text(txt, { color: "#1a1a1a", font: "800 150px 'Caveat', serif" }), 0, 0.55 * s, 0.09 * s, { cast: false, receive: false });
			add(tg, new THREE.BoxGeometry(0.7 * s, 0.06, 0.3 * s), mat("#3d3a33", 0.95), 0, 0.03, 0.12 * s, { cast: false });
			k.box(x - 0.35 * s, x + 0.35 * s, z - 0.2, z + 0.2);
		};
		tomb(-11.1, 1.4, Math.PI / 2, 1.0, "R.I.P.");
		tomb(-8.2, 1.55, Math.PI, 0.85, "BOO");
		tomb(-11.15, -1.6, Math.PI / 2, 0.8, "1888");
		candelabra(-8.0, -2.5);
		candelabra(-11.1, 0.1);
		// a gate of iron bars at the back, mist pouring through
		for (let i = 0; i < 9; i++) add(g, new THREE.CylinderGeometry(0.02, 0.02, 2.4, 6), ironM, X0 + 0.15, 1.2, -4.2 + i * 0.25, { cast: false });
		add(g, new THREE.PlaneGeometry(2.2, 2.4), glow("#2a3a6a", { transparent: true, opacity: 0.55 }), X0 + 0.08, 1.2, -3.2, { ry: Math.PI / 2, cast: false });
	}

	// ================================================================ the mirror room: look closely
	let scareFace;
	{
		const mirM = mat("#2a2a35", 0.08, 1.0);
		for (const [x, w, hh] of [[-5.4, 0.8, 1.9], [-3.75, 1.0, 2.2], [-2.1, 0.8, 1.9]]) {
			const mg = group(g, x, 0, SW + T / 2 + 0.03);
			add(mg, rbox(w + 0.16, hh + 0.16, 0.05, 0.03), goldM, 0, 0.35 + hh / 2, 0, { cast: false });
			add(mg, new THREE.PlaneGeometry(w, hh), mirM, 0, 0.35 + hh / 2, 0.03, { cast: false });
			add(mg, new THREE.PlaneGeometry(w, hh), glow("#3a1820", { transparent: true, opacity: 0.25, depthWrite: false }), 0, 0.35 + hh / 2, 0.042, { cast: false });
		}
		const faceT = canvasTex(256, 320, (c, w, h) => {
			const gr = c.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w / 2); gr.addColorStop(0, "rgba(230,240,255,0.95)"); gr.addColorStop(0.7, "rgba(170,190,220,0.6)"); gr.addColorStop(1, "rgba(0,0,0,0)");
			c.fillStyle = gr; c.beginPath(); c.ellipse(w / 2, h / 2, 100, 140, 0, 0, TAU); c.fill();
			c.fillStyle = "#000"; for (const sx of [-38, 38]) { c.beginPath(); c.ellipse(w / 2 + sx, h * 0.42, 22, 30, 0, 0, TAU); c.fill(); }
			c.fillStyle = "#ff2030"; for (const sx of [-38, 38]) { c.beginPath(); c.arc(w / 2 + sx, h * 0.44, 6, 0, TAU); c.fill(); }
			c.fillStyle = "#000"; c.beginPath(); c.ellipse(w / 2, h * 0.72, 30, 50, 0, 0, TAU); c.fill();
		});
		scareFace = add(g, new THREE.PlaneGeometry(0.9, 1.15), new THREE.MeshBasicMaterial({ map: faceT, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }), -3.75, 1.55, SW + T / 2 + 0.03 + 0.06, { cast: false, receive: false });
		scareFace.renderOrder = 4;
		candelabra(-5.9, -2.0);
		candelabra(-1.6, -2.0);
	}

	// ================================================================ the dining room: ghost guests, floating plates, bats
	const guests = [], floaters = [];
	let bats;
	{
		const TBL = { x: 2.6, z: -2.4, w: 4.0, d: 1.1 };
		add(g, rbox(TBL.w, 0.07, TBL.d, 0.02), panelM, TBL.x, 0.78, TBL.z);
		add(g, new THREE.PlaneGeometry(TBL.w - 0.1, TBL.d + 0.25), mat("#d8d0c0", 0.95, 0, { side: THREE.DoubleSide }), TBL.x, 0.82, TBL.z, { rx: -Math.PI / 2, cast: false });
		for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(g, new THREE.CylinderGeometry(0.05, 0.04, 0.78, 8), panelM, TBL.x + sx * (TBL.w / 2 - 0.15), 0.39, TBL.z + sz * (TBL.d / 2 - 0.12), { cast: false });
		k.box(TBL.x - TBL.w / 2 - 0.1, TBL.x + TBL.w / 2 + 0.1, TBL.z - TBL.d / 2 - 0.1, TBL.z + TBL.d / 2 + 0.1);
		const chairAt = (x, z, ry, ghost) => {
			const cg = group(g, x, 0, z, ry);
			add(cg, rbox(0.46, 0.06, 0.46, 0.02), panelM, 0, 0.46, 0);
			add(cg, rbox(0.46, 0.9, 0.06, 0.02), panelM, 0, 0.92, -0.21);
			for (const sx of [-0.19, 0.19]) for (const sz of [-0.19, 0.19]) add(cg, new THREE.CylinderGeometry(0.02, 0.02, 0.46, 6), panelM, sx, 0.23, sz, { cast: false });
			if (ghost) { const gh = makeGhost(0.62); gh.position.set(0, 0.25, 0.02); cg.add(gh); guests.push({ gh, cg, ph: R() * TAU }); }
		};
		for (let i = 0; i < 4; i++) { const x = TBL.x - 1.5 + i * 1.0; chairAt(x, TBL.z - 0.85, 0, i % 2 === 0); chairAt(x, TBL.z + 0.85, Math.PI, i % 2 === 1); }
		chairAt(TBL.x + TBL.w / 2 + 0.55, TBL.z, -Math.PI / 2, true);
		// plates, goblets and candles drifting over the table
		for (let i = 0; i < 8; i++) {
			const isPlate = i % 2 === 0;
			const m = isPlate ? add(g, new THREE.CylinderGeometry(0.13, 0.1, 0.02, 20), mat("#efe9df", 0.4), 0, 0, 0, { cast: false })
				: add(g, new THREE.CylinderGeometry(0.04, 0.025, 0.14, 10), goldM, 0, 0, 0, { cast: false });
			const home = new THREE.Vector3(TBL.x - 1.7 + i * 0.48, 1.25 + (i % 3) * 0.18, TBL.z + (i % 2 ? 0.25 : -0.25));
			m.position.copy(home);
			floaters.push({ m, home, ph: R() * TAU });
		}
		candle(TBL.x - 0.8, 0.82, TBL.z, 0.22); candle(TBL.x, 0.82, TBL.z, 0.26); candle(TBL.x + 0.8, 0.82, TBL.z, 0.22);
		// a chandelier, and the bats roosting up there
		const dch = group(g, TBL.x, H, TBL.z);
		add(dch, new THREE.CylinderGeometry(0.01, 0.01, 0.7, 6), ironM, 0, -0.35, 0, { cast: false });
		add(dch, new THREE.TorusGeometry(0.4, 0.025, 6, 24), ironM, 0, -0.72, 0, { rx: Math.PI / 2, cast: false });
		bats = batFlock(24, { x: TBL.x, y: H - 0.08, z: TBL.z, w: 4.5, d: 3.0 });
		// tall curtained windows on the wall (the curtains stir)
		var curtains = [];
		for (const x of [0.4, 4.8]) {
			add(g, new THREE.PlaneGeometry(1.1, 2.0), glow("#1a2a5a"), x, 1.6, SW + T / 2 + 0.02, { cast: false });
			for (const sx of [-0.4, 0.4]) { const cm = add(g, new THREE.PlaneGeometry(0.45, 2.3, 1, 6), velvetM, x + sx, 1.55, SW + T / 2 + 0.06, { cast: false }); curtains.push(cm); }
		}
	}

	// ================================================================ the ghost train
	const cartG = [], trainIds = [], cartFace = [];
	const _tp = { x: 0, z: 0, h: 0 };
	{
		// the rails, and a glow strip between them
		const pts = [[], [], []];
		for (let i = 0; i < 220; i++) {
			trackAt(i / 220 * TR.L, _tp);
			const sx = Math.cos(_tp.h), sz = -Math.sin(_tp.h);   // (to the right of the way it goes)
			pts[0].push(new THREE.Vector3(_tp.x + sx * 0.3, 0.04, _tp.z + sz * 0.3));
			pts[1].push(new THREE.Vector3(_tp.x - sx * 0.3, 0.04, _tp.z - sz * 0.3));
			pts[2].push(new THREE.Vector3(_tp.x, 0.03, _tp.z));
		}
		const steel = mat("#6a6f78", 0.3, 0.9);
		for (let r2 = 0; r2 < 2; r2++) add(g, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts[r2], true), 440, 0.025, 5, true), steel, 0, 0, 0, { cast: false });
		add(g, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts[2], true), 440, 0.03, 4, true), glow("#2aff7a", { transparent: true, opacity: 0.35 }), 0, 0, 0, { cast: false, receive: false });
		// the divider between the two lanes (scenes on both sides of it)
		// (full height, and a camera wall: a rider's view from behind never pops through into the other lane)
		add(g, new THREE.BoxGeometry(TR.Ls, H, 0.12), darkWallM, (TR.xE + TR.xW) / 2, H / 2, TR.zc, { cast: false });
		k.camWall(TR.xW, TR.xE, TR.zc - 0.06, TR.zc + 0.06, 0, H);
		// the carts: a coffin-black tub with a skull on the front, two seats
		const cartCols = ["#3a1a4a", "#1a3a2a", "#4a1a1a"];
		for (let c = 0; c < CARTS; c++) {
			const cg = group(g, 0, 0, 0);
			const body = mat(cartCols[c], 0.5, 0.3);
			add(cg, rbox(0.9, 0.22, 1.2, 0.05), mat("#111", 0.6, 0.4), 0, 0.12, 0);
			add(cg, rbox(0.92, 0.42, 1.25, 0.08), body, 0, 0.36, 0);
			add(cg, rbox(0.8, 0.08, 0.5, 0.03), mat("#2a0f18", 0.85), 0, 0.46, -0.08);
			add(cg, rbox(0.86, 0.7, 0.12, 0.04), body, 0, 0.75, -0.42);
			add(cg, new THREE.CylinderGeometry(0.025, 0.025, 0.8, 8), steel, 0, 0.78, 0.22, { rz: Math.PI / 2, cast: false });
			// the skull on the front
			add(cg, new THREE.SphereGeometry(0.22, 16, 12), boneM, 0, 0.62, 0.55).scale.set(1, 1.05, 0.7);
			const eyes = [];
			for (const sx of [-0.08, 0.08]) eyes.push(add(cg, new THREE.SphereGeometry(0.05, 10, 8), glow("#7aff5a"), sx, 0.66, 0.69, { cast: false }));
			add(cg, new THREE.BoxGeometry(0.16, 0.05, 0.05), blackM, 0, 0.52, 0.69, { cast: false });
			for (const sx of [-0.38, 0.38]) add(cg, new THREE.SphereGeometry(0.05, 8, 6), glow("#7aff5a"), sx, 0.5, -0.6, { cast: false });
			cartG.push(cg); cartFace.push(eyes);
			for (let s = 0; s < 2; s++) {
				const id = "ghostTrain" + c + s, dx = s ? -0.22 : 0.22;
				const gx = 7.4 + c * 1.4 + (s ? 0.28 : -0.28);
				k.spot({ id, x: gx, z: -3.6, y: 0, h: Math.PI, pov: true, stand: [gx, -3.7], ride: (pos, quat) => {
					trackAt(cartS(c), _tp);
					const ch = Math.cos(_tp.h), sh = Math.sin(_tp.h);
					// (dx across the cart, a little back from the middle)
					pos.set(OX + _tp.x + dx * ch - 0.08 * sh, 0.48 - 0.46, OZ + _tp.z - dx * sh - 0.08 * ch);
					quat.setFromAxisAngle(Y, _tp.h);
				} });
				trainIds.push(id);
			}
		}
		k.interact("haunted:train", {
			label: "Ride the Ghost Train", stand: [9.1, -3.9], face: Math.PI, reach: 2.6,
			use: () => {
				// the cart nearest the platform (that still has room)
				const sPlat = TR.Ls - 1.0;
				const order = [...Array(CARTS).keys()].sort((a, b) => Math.abs(mod(cartS(a) - sPlat + TR.L / 2, TR.L) - TR.L / 2) - Math.abs(mod(cartS(b) - sPlat + TR.L / 2, TR.L) - TR.L / 2));
				for (const c of order) {
					const ids = ["ghostTrain" + c + "0", "ghostTrain" + c + "1"];
					if (ctx.freeSpot(ids)) { if (ctx.sitOn(ids)) { ctx.sfx("creak", 0.6); ctx.notice("Keep your hands inside the cart... if you can. You go round until you press <b>Esc</b>. <b>F</b> switches the view, drag to look around."); } return; }
				}
				ctx.notice("Every cart is full - wait for the next one!");
			}
		}, ...cartG);
	}
	// the scenes along the track: where each one is (local x, z), and how awake it is (0..1, from the nearest cart)
	const near = (x, z, r) => { let best = 0; for (let c = 0; c < CARTS; c++) { trackAt(cartS(c), _tp); const d = Math.hypot(_tp.x - x, _tp.z - z); best = Math.max(best, 1 - Math.min(1, Math.max(0, (d - 0.6) / r))); } return best; };
	// graveyard: hands come up out of the ground
	const hands = [];
	{
		for (let i = 0; i < 5; i++) {
			const hg = group(g, 7.6 - i * 0.75, 0, -8.15 + (i % 2) * 0.12);
			add(hg, new THREE.CylinderGeometry(0.045, 0.05, 0.7, 8), mat("#6f8a5a", 0.8), 0, 0.35, 0, { cast: false });
			add(hg, new THREE.BoxGeometry(0.12, 0.13, 0.05), mat("#6f8a5a", 0.8), 0, 0.75, 0, { cast: false });
			for (let f = 0; f < 4; f++) add(hg, new THREE.CylinderGeometry(0.012, 0.01, 0.12, 5), mat("#6f8a5a", 0.8), -0.045 + f * 0.03, 0.87, 0, { rz: (f - 1.5) * 0.15, cast: false });
			hands.push(hg);
		}
		for (let i = 0; i < 4; i++) {
			const tg = group(g, 7.9 - i * 1.0, 0, -8.25, 0);
			add(tg, rbox(0.42, 0.6 + (i % 2) * 0.15, 0.1, 0.05), mat("#4a4e56", 0.95), 0, 0.3, 0, { cast: false }).rotation.z = (R() - 0.5) * 0.3;
		}
		add(g, new THREE.PlaneGeometry(4.6, 2.6), glow("#16284a"), 6.0, 1.9, Z0 + 0.02, { cast: false });   // a painted night sky
		add(g, new THREE.CircleGeometry(0.35, 24), glow("#f2f6d8"), 7.2, 2.7, Z0 + 0.03, { cast: false });
	}
	// dancing skeletons
	const dancers = [];
	for (const x of [2.7, 1.4]) { const sk = makeSkeleton(); sk.position.set(x, 0, -8.1); g.add(sk); dancers.push(sk); }
	// swinging doors across both lanes at x = 0
	const swDoors = [];
	for (const z of [TR.zA, TR.zB]) for (const sd of [-1, 1]) {
		const piv = group(g, -0.05, 0, z + sd * 0.5);
		add(piv, new THREE.BoxGeometry(0.04, 1.6, 0.5), mat("#4a2a1a", 0.8), 0, 0.95, -sd * 0.25, { cast: false });
		add(piv, new THREE.PlaneGeometry(0.4, 0.3), text("KEEP OUT", { color: "#ff3a3a", font: "900 140px Nunito, sans-serif" }), 0.03, 1.3, -sd * 0.25, { ry: Math.PI / 2, cast: false, receive: false });
		swDoors.push({ piv, z, sd });
	}
	// the spider that drops down
	let spider, spiderLine;
	{
		spider = group(g, -5.0, 3.0, TR.zA);
		add(spider, new THREE.SphereGeometry(0.28, 16, 12), blackM, 0, 0, -0.1).scale.set(1, 0.8, 1.2);
		add(spider, new THREE.SphereGeometry(0.16, 14, 10), blackM, 0, 0, 0.25);
		for (const sx of [-0.06, 0.06]) add(spider, new THREE.SphereGeometry(0.03, 8, 6), glow("#ff1a1a"), sx, 0.05, 0.38, { cast: false });
		for (let i = 0; i < 8; i++) {
			const side = i < 4 ? -1 : 1, j = i % 4;
			const leg = add(spider, new THREE.CylinderGeometry(0.018, 0.012, 0.75, 5), blackM, side * 0.38, -0.1, -0.25 + j * 0.17, { rz: side * 1.0, cast: false });
			leg.rotation.y = (j - 1.5) * 0.3 * side;
		}
		spiderLine = add(g, new THREE.CylinderGeometry(0.004, 0.004, 1, 4), mat("#cccccc", 0.6), -5.0, 3.4, TR.zA, { cast: false });
		add(g, new THREE.PlaneGeometry(2.6, 2.6), webM, -5.0, 2.1, Z0 + 0.04, { cast: false });
	}
	// the vampire in his coffin, at the far end
	let vampLid, vamp;
	{
		const vg = group(g, X0 + 0.35, 0, TR.zc, Math.PI / 2);
		add(vg, rbox(0.8, 2.1, 0.3, 0.04), mat("#2a1810", 0.7), 0, 1.05, -0.05);
		add(vg, new THREE.PlaneGeometry(0.7, 1.95), mat("#5a0d16", 0.9), 0, 1.05, 0.11, { cast: false });
		vampLid = group(vg, 0.4, 0, 0.12);
		add(vampLid, rbox(0.8, 2.1, 0.08, 0.03), mat("#3a2010", 0.7), -0.4, 1.05, 0.04);
		add(vampLid, new THREE.BoxGeometry(0.06, 0.6, 0.02), goldM, -0.4, 1.3, 0.09, { cast: false });
		add(vampLid, new THREE.BoxGeometry(0.35, 0.06, 0.02), goldM, -0.4, 1.42, 0.09, { cast: false });
		vamp = group(vg, 0, 0, 0);
		add(vamp, new THREE.ConeGeometry(0.34, 1.5, 12, 1, true), mat("#0a0a0a", 0.6, 0, { side: THREE.DoubleSide }), 0, 0.85, 0.02);
		add(vamp, new THREE.SphereGeometry(0.15, 14, 10), mat("#d8dcd0", 0.6), 0, 1.72, 0.04);
		add(vamp, new THREE.ConeGeometry(0.18, 0.1, 10), blackM, 0, 1.86, 0.03, { cast: false });
		for (const sx of [-0.05, 0.05]) add(vamp, new THREE.SphereGeometry(0.025, 8, 6), glow("#ff1010"), sx, 1.75, 0.17, { cast: false });
		for (const sx of [-0.025, 0.025]) add(vamp, new THREE.ConeGeometry(0.01, 0.04, 4), boneM, sx, 1.63, 0.17, { rx: Math.PI, cast: false });
		add(vamp, new THREE.PlaneGeometry(0.9, 1.3), mat("#6a0010", 0.7, 0, { side: THREE.DoubleSide }), 0, 1.2, -0.02, { cast: false });
	}
	// the witch's cauldron, bubbling green
	let witchArm, bubbles = [];
	{
		const cx = -6.4, cz = TR.zc + 0.55;
		add(g, new THREE.SphereGeometry(0.42, 18, 12, 0, TAU, Math.PI * 0.25, Math.PI * 0.75), ironM, cx, 0.45, cz);
		add(g, new THREE.CircleGeometry(0.33, 20), glow("#5aff4a"), cx, 0.75, cz, { rx: -Math.PI / 2, cast: false });
		for (let i = 0; i < 6; i++) bubbles.push(add(g, new THREE.SphereGeometry(0.05, 8, 6), glow("#9aff7a", { transparent: true, opacity: 0.8 }), cx, 0.8, cz, { cast: false }));
		const wg = group(g, cx - 0.65, 0, cz, Math.PI / 2);
		add(wg, new THREE.ConeGeometry(0.3, 1.3, 12), mat("#1a0a2a", 0.8), 0, 0.65, 0);
		add(wg, new THREE.SphereGeometry(0.15, 12, 10), mat("#6f9a4a", 0.7), 0, 1.42, 0);
		add(wg, new THREE.ConeGeometry(0.03, 0.12, 6), mat("#6f9a4a", 0.7), 0, 1.4, 0.16, { rx: Math.PI / 2, cast: false });
		add(wg, new THREE.CylinderGeometry(0.3, 0.3, 0.02, 16), blackM, 0, 1.55, 0, { cast: false });
		add(wg, new THREE.ConeGeometry(0.15, 0.5, 12), blackM, 0, 1.82, -0.04, { rx: -0.25, cast: false });
		witchArm = group(wg, 0.15, 1.1, 0.1);
		add(witchArm, new THREE.CylinderGeometry(0.02, 0.02, 0.9, 5), mat("#5a3a1a", 0.8), 0.25, -0.2, 0.25, { rx: 0.8, cast: false });
	}
	// the ghost bride, drifting out over the lane
	const bride = makeGhost(0.9, new THREE.MeshStandardMaterial({ color: "#fff6fa", emissive: "#ffd8e8", emissiveIntensity: 0.9, transparent: true, opacity: 0.6, depthWrite: false }));
	bride.position.set(-2.0, 0.4, TR.zc + 0.2);
	g.add(bride);
	// the wall of eyes (they blink)
	const EYES = 28;
	const eyeIM = new THREE.InstancedMesh(new THREE.SphereGeometry(0.04, 8, 6), glow("#ffe14a"), EYES * 2);
	const eyeAt = [];
	for (let i = 0; i < EYES; i++) {
		const x = 2.3 + R() * 4.6, y = 0.4 + R() * 2.0;
		eyeAt.push([x, y, R() * 10]);
		for (let s = 0; s < 2; s++) { _d.position.set(x + (s ? 0.06 : -0.06), y, SW - T / 2 - 0.03); _d.rotation.set(0, 0, 0); _d.scale.set(1, 1, 0.4); _d.updateMatrix(); eyeIM.setMatrixAt(i * 2 + s, _d.matrix); }
	}
	eyeIM.castShadow = false; eyeIM.frustumCulled = false; g.add(eyeIM);
	// a ghost that lunges out of the wall near the end
	const lunger = makeGhost(0.85);
	lunger.position.set(7.0, 0.5, SW - 0.3); lunger.rotation.y = Math.PI;
	g.add(lunger);
	// skeletons and cobwebs hanging over the track
	for (const [x, z] of [[4.0, TR.zA], [-7.8, TR.zB], [-2.8, TR.zA]]) {
		const sk = makeSkeleton(); sk.position.set(x, 1.4, z + 0.35 * (z === TR.zA ? -1 : 1)); sk.scale.setScalar(0.7); g.add(sk);
		add(g, new THREE.CylinderGeometry(0.005, 0.005, H - 2.4, 4), mat("#aaa", 0.6), x, (H + 2.45) / 2, sk.position.z, { cast: false });
	}
	for (let i = 0; i < 6; i++) cobweb(-9 + i * 3.4, H - 0.35, TR.zc + (i % 2 ? 0.7 : -0.7), i % 2 ? 0 : Math.PI, 1.1);
	const allFlames = new THREE.InstancedMesh(new THREE.ConeGeometry(0.022, 0.07, 6), glow("#ffc35a"), flames.length);
	allFlames.castShadow = false; allFlames.frustumCulled = false; g.add(allFlames);

	// ================================================================ outside: the facade you see from the garden
	{
		// (a faint glow in the boards, so it reads against the night sky from the garden)
		const sideM = mat("#ffffff", 0.9, 0, { map: siding, emissive: "#2a2040", emissiveMap: siding, emissiveIntensity: 0.55 });
		const gableM = mat("#ffffff", 0.9, 0, { map: siding, emissive: "#2a2040", emissiveMap: siding, emissiveIntensity: 0.55, side: THREE.DoubleSide });
		const EX = X1 + T + 0.01, EH = H + 0.15;
		// the east wall, round the door
		add(g, new THREE.PlaneGeometry(Z1 - DOOR.z1, EH), sideM, EX, EH / 2, (Z1 + DOOR.z1) / 2, { ry: Math.PI / 2, cast: false });
		add(g, new THREE.PlaneGeometry(DOOR.z0 - Z0, EH), sideM, EX, EH / 2, (DOOR.z0 + Z0) / 2, { ry: Math.PI / 2, cast: false });
		add(g, new THREE.PlaneGeometry(DOOR.z1 - DOOR.z0, EH - DOOR.h), sideM, EX, (EH + DOOR.h) / 2, 0, { ry: Math.PI / 2, cast: false });
		// the other three sides (plainer: you see them from the Fun Park and the karts)
		add(g, new THREE.PlaneGeometry(X1 - X0 + 0.4, EH), sideM, 0, EH / 2, Z0 - T - 0.01, { ry: Math.PI, cast: false });
		add(g, new THREE.PlaneGeometry(Z1 - Z0 + 0.4, EH), sideM, X0 - T - 0.01, EH / 2, (Z0 + Z1) / 2, { ry: -Math.PI / 2, cast: false });
		add(g, new THREE.PlaneGeometry(X1 - X0 + 0.4, EH), sideM, 0, EH / 2, Z1 + T + 0.01, { cast: false });
		// the front door: two dark leaves swung right open, back against the inside of the wall; a knocker
		for (const sd of [-1, 1]) {
			const piv = group(g, X1 - 0.06, 0, sd * (DOOR.z1 - DOOR.z0) / 2);
			add(piv, rbox(0.06, DOOR.h - 0.05, 0.72, 0.02), mat("#2a120c", 0.7), 0.0, (DOOR.h - 0.05) / 2, -sd * 0.37);
			piv.rotation.y = sd * (Math.PI - 0.12);
		}
		add(g, new THREE.TorusGeometry(0.08, 0.015, 6, 16), goldM, EX + 0.02, 1.5, 0.95, { ry: Math.PI / 2, cast: false });
		// glowing windows (some boarded up), crooked shutters
		const winM = glow("#ff9a3a");
		var facadeWins = [];
		for (const [z, y, boarded] of [[-6.6, 1.7, false], [-3.6, 1.7, true], [-2.0, 1.7, false], [1.4, 1.7, false], [-4.9, 3.2, false]]) {
			const wg = group(g, EX + 0.01, y, z, Math.PI / 2);
			const w = add(wg, new THREE.PlaneGeometry(0.9, 1.2), new THREE.MeshBasicMaterial({ color: "#ff9a3a", toneMapped: false }), 0, 0, 0, { cast: false });
			facadeWins.push(w.material);
			add(wg, new THREE.BoxGeometry(0.06, 1.2, 0.04), trimM, 0, 0, 0.02, { cast: false });
			add(wg, new THREE.BoxGeometry(0.9, 0.06, 0.04), trimM, 0, 0.1, 0.02, { cast: false });
			add(wg, rbox(1.06, 1.36, 0.05, 0.02), trimM, 0, 0, -0.02, { cast: false });
			if (boarded) for (const a of [0.5, -0.4]) add(wg, new THREE.BoxGeometry(1.15, 0.14, 0.04), mat("#4a3a2a", 0.9), 0, a * 0.6, 0.05, { rz: a, cast: false });
			for (const sd of [-1, 1]) add(wg, new THREE.BoxGeometry(0.4, 1.25, 0.04), mat("#1f2a22", 0.9), sd * 0.68, 0, 0.03, { rz: sd * (0.05 + R() * 0.12), cast: false });
		}
		// a little window in the west and south walls too
		for (const [x, z, ry] of [[X0 - T - 0.02, -3.2, -Math.PI / 2], [-6, Z0 - T - 0.02, Math.PI], [5, Z0 - T - 0.02, Math.PI]]) {
			const w = add(g, new THREE.PlaneGeometry(0.8, 1.0), new THREE.MeshBasicMaterial({ color: "#ff9a3a", toneMapped: false }), x, 1.8, z, { ry, cast: false });
			facadeWins.push(w.material);
		}
		// the roof: two steep slopes, a ridge along x, gables at the ends
		const RH = 3.0, rz0 = Z0 - 0.5, rz1 = Z1 + 0.5, rzc = (rz0 + rz1) / 2, half = (rz1 - rz0) / 2, slope = Math.hypot(half, RH);
		const roofM = mat("#ffffff", 0.9, 0, { map: shingles, side: THREE.DoubleSide, emissive: "#1a1424", emissiveMap: shingles, emissiveIntensity: 0.5 });
		for (const sd of [-1, 1]) add(g, new THREE.PlaneGeometry(X1 - X0 + 1.0, slope), roofM, 0, H + RH / 2, rzc + sd * half / 2, { rx: -sd * Math.atan2(half, RH), cast: false });
		const gable = new THREE.Shape(); gable.moveTo(-half, 0); gable.lineTo(half, 0); gable.lineTo(0.3, RH + 0.15); gable.lineTo(-0.2, RH); gable.closePath();
		for (const [x, ry] of [[X1 + T + 0.02, Math.PI / 2], [X0 - T - 0.02, -Math.PI / 2]]) add(g, new THREE.ShapeGeometry(gable), gableM, x, H, rzc, { ry, cast: false });
		// the round window up in the front gable, and the sign under it
		const eyeWin = add(g, new THREE.CircleGeometry(0.42, 24), new THREE.MeshBasicMaterial({ color: "#ff9a3a", toneMapped: false }), X1 + T + 0.04, H + 1.6, rzc, { ry: Math.PI / 2, cast: false });
		facadeWins.push(eyeWin.material);
		add(g, new THREE.TorusGeometry(0.44, 0.05, 6, 24), trimM, X1 + T + 0.05, H + 1.6, rzc, { ry: Math.PI / 2, cast: false });
		const dripTex = canvasTex(1024, 320, (c, w, h) => {
			c.font = "900 132px 'Creepster', 'Chiller', Impact, sans-serif"; c.textAlign = "center"; c.textBaseline = "middle";
			c.shadowColor = "#3aff6a"; c.shadowBlur = 26;
			c.fillStyle = "#9cff5a"; c.fillText("HAUNTED", w / 2, 80); c.fillText("MANSION", w / 2, 210);
			c.shadowBlur = 8;
			const r = rng(66);
			for (let i = 0; i < 26; i++) { const x = 140 + r() * 740, y0 = r() < 0.5 ? 118 : 248, len = 14 + r() * 50; c.fillRect(x, y0, 6, len); c.beginPath(); c.arc(x + 3, y0 + len, 6, 0, Math.PI * 2); c.fill(); }
		});
		add(g, new THREE.PlaneGeometry(3.4, 1.06), new THREE.MeshBasicMaterial({ map: dripTex, transparent: true, depthWrite: false, toneMapped: false }), X1 + T + 0.06, H + 0.5, -3.6, { ry: Math.PI / 2, cast: false, receive: false });
		// a leaning tower at the corner, a pointy roof, a light in its window
		const tw = group(g, X1 - 1.2, H - 0.2, Z1 - 1.0);
		tw.rotation.z = -0.05; tw.rotation.x = 0.04;
		add(tw, new THREE.CylinderGeometry(0.85, 0.95, 3.4, 10), sideM, 0, 1.7, 0);
		add(tw, new THREE.ConeGeometry(1.15, 2.4, 10), roofM, 0, 4.6, 0);
		const twWin = add(tw, new THREE.PlaneGeometry(0.4, 0.7), new THREE.MeshBasicMaterial({ color: "#ff9a3a", toneMapped: false }), 0.92, 2.0, 0, { ry: Math.PI / 2, cast: false });
		facadeWins.push(twWin.material);
		add(tw, new THREE.CylinderGeometry(0.02, 0.02, 0.9, 6), ironM, 0, 6.2, 0, { cast: false });
		var towerGhost = makeGhost(0.35); towerGhost.position.set(0.95, 1.6, 0); towerGhost.rotation.y = Math.PI / 2; tw.add(towerGhost);
		// the porch: a little roof over the door on two posts, steps
		add(g, rbox(0.9, 0.08, 2.4, 0.02), mat("#1a1418", 0.9), X1 + 0.6, 2.75, 0, { rz: -0.3 });
		k.camWall(X1 + 0.15, X1 + 1.05, -1.2, 1.2, 2.55, 2.95);
		for (const sd of [-1, 1]) { add(g, new THREE.CylinderGeometry(0.05, 0.05, 2.7, 8), mat("#2a2228", 0.8), X1 + 0.62, 1.35, sd * 1.05, { cast: false }); k.box(X1 + 0.5, X1 + 0.74, sd * 1.05 - 0.12, sd * 1.05 + 0.12); }
		add(g, new THREE.BoxGeometry(0.5, 0.08, 1.8), mat("#3a3238", 0.9), X1 + 0.45, 0.04, 0, { cast: false });
		// jack-o'-lanterns on the porch
		const faceE = canvasTex(256, 128, (c, w, h) => {
			c.fillStyle = "#000"; c.fillRect(0, 0, w, h);
			c.fillStyle = "#ffd23a";
			for (const sx of [-1, 1]) { c.beginPath(); c.moveTo(w / 2 + sx * 22, 50); c.lineTo(w / 2 + sx * 46, 50); c.lineTo(w / 2 + sx * 34, 26); c.fill(); }
			c.beginPath(); c.moveTo(w / 2 - 6, 64); c.lineTo(w / 2 + 6, 64); c.lineTo(w / 2, 54); c.fill();
			c.beginPath(); c.moveTo(w / 2 - 50, 78); for (let i = 0; i <= 10; i++) c.lineTo(w / 2 - 50 + i * 10, 78 + (i % 2 ? 8 : 0) + Math.sin(i / 10 * Math.PI) * 18); c.lineTo(w / 2 + 50, 78); c.closePath(); c.fill();
		});
		var pumpkins = [];
		for (const [z, s] of [[-1.25, 0.22], [-1.6, 0.16], [1.3, 0.24], [1.62, 0.15]]) {
			const pm = new THREE.MeshStandardMaterial({ color: "#d9631a", roughness: 0.6, emissive: "#ffb02a", emissiveMap: faceE, emissiveIntensity: 2.2 });
			const pk = add(g, new THREE.SphereGeometry(s, 18, 12), pm, X1 + 0.5, s * 0.85, z, { ry: Math.PI / 2 + Math.PI / 2 });
			pk.scale.set(1.15, 0.85, 1.15);
			add(g, new THREE.CylinderGeometry(0.02, 0.03, 0.08, 6), mat("#3a5a1a", 0.8), X1 + 0.5, s * 1.6, z, { cast: false });
			pumpkins.push(pm);
		}
		// a little iron fence along the front
		const fenceZ = [[Z0 + 0.3, -1.4], [1.4, Z1 - 0.1]];
		for (const [z0, z1] of fenceZ) {
			const n = Math.max(2, Math.round((z1 - z0) / 0.22));
			const im = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.015, 0.015, 0.9, 5), ironM, n + 1);
			for (let i = 0; i <= n; i++) { _d.position.set(X1 + 0.48, 0.45, z0 + (z1 - z0) * i / n); _d.rotation.set(0, 0, 0); _d.scale.set(1, 1, 1); _d.updateMatrix(); im.setMatrixAt(i, _d.matrix); }
			im.castShadow = false; g.add(im);
			for (const y of [0.25, 0.8]) add(g, new THREE.BoxGeometry(0.03, 0.03, z1 - z0), ironM, X1 + 0.48, y, (z0 + z1) / 2, { cast: false });
			k.box(X1 + 0.4, X1 + 0.56, z0, z1);
		}
		// a dead tree, leaning over the corner
		const dt = group(g, X1 + 0.5, 0, Z0 + 0.8);
		dt.rotation.z = 0.12;
		const bark = mat("#1a1412", 0.95);
		add(dt, new THREE.CylinderGeometry(0.07, 0.16, 3.6, 8), bark, 0, 1.8, 0);
		for (const [y, a, l, ry] of [[2.6, 0.9, 1.2, 0.3], [3.0, -0.8, 1.0, 2.2], [3.4, 0.6, 0.8, 4.0], [2.0, -1.1, 0.9, 1.2], [3.6, -0.3, 0.7, 5.1]]) {
			const br = group(dt, 0, y, 0, ry);
			add(br, new THREE.CylinderGeometry(0.02, 0.05, l, 6), bark, Math.sin(a) * l / 2, Math.cos(a) * l / 2, 0, { rz: -a, cast: false });
		}
		k.box(X1 + 0.32, X1 + 0.68, Z0 + 0.62, Z0 + 0.98);
		// a bit of fog by the steps, outside
		for (const [z, s] of [[-1.0, 1.4], [0.9, 1.2], [-3.0, 1.6], [-5.6, 1.5]]) add(g, new THREE.PlaneGeometry(s * 1.5, s), fogM, X1 + 0.5, 0.18, z, { rx: -Math.PI / 2, cast: false, receive: false });
	}

	// ================================================================ scares
	const done = {};        // which scares have gone off this visit
	let black = 0;          // blackout: 0 = lights normal, 1 = out
	const fx = { hall: -1, library: -1, crypt: -1, mirror: -1, dining: -1, foyer: -1, rush: -1 };
	function play(name, mine) {
		const v = mine ? 1 : 0.4;
		fx[name] = 0;
		if (name === "foyer") { ctx.sfx("creak", 0.7 * v); ctx.sfx("door", 0.5 * v); }
		if (name === "hall") { ctx.sfx("heartbeat", 0.6 * v); }
		if (name === "library") { ctx.sfx("whoosh", 0.8 * v); ctx.sfx("ghost", 0.5 * v); }
		if (name === "crypt") { ctx.sfx("creak", 0.8 * v); setTimeout(() => { ctx.sfx("scream", 0.8 * v); ctx.sfx("thunder", 0.6 * v); }, 350); }
		if (name === "mirror") { ctx.sfx("heartbeat", 0.6 * v); setTimeout(() => ctx.sfx("scream", 0.9 * v), 900); }
		if (name === "dining") { ctx.sfx("ghost", 0.7 * v); ctx.sfx("whoosh", 0.6 * v); bats.t = 0; }
	}
	function trigger(name) {
		if (done[name]) return;
		done[name] = true;
		play(name, true);
		if (name === "hall") fx.rush = -1;   // (the rush comes out of the dark, below)
		if (name !== "foyer" && name !== "hall") ctx.send({ t: "fx", kind: "zfx", zone: "haunted", what: "scare", s: name });
	}
	// the ghost that rushes straight at you (placed in front of the camera; only you see it)
	function startRush() { fx.rush = 0; rusher.visible = true; ctx.sfx("scream", 0.9); ctx.sfx("ghost", 0.6); }
	function updateRush(dt) {
		if (fx.rush < 0) return;
		fx.rush += dt;
		const u = fx.rush / 0.8;
		if (u >= 1) { fx.rush = -1; rusher.visible = false; return; }
		ctx.camera.getWorldPosition(_cam); ctx.camera.getWorldDirection(_fwd);
		const d = 3.6 - 3.5 * u * u;
		_v.copy(_cam).addScaledVector(_fwd, d);
		rusher.position.set(_v.x - g.position.x, _v.y - g.position.y - 1.25 * rusher.scale.y, _v.z - g.position.z);
		rusher.rotation.y = Math.atan2(-_fwd.x, -_fwd.z);
		rusher.scale.setScalar(1.0 + u * 0.8);
		rusher.children[0].material.opacity = 0.85 * (u < 0.85 ? 1 : (1 - u) / 0.15);
	}
	const trainScares = [
		// (s from 0 at the west end of the back lane, eastbound; then the east turn, the out lane westbound, the west turn)
		{ s: 3.5, what: "witch" },                          // the witch at x -6.4
		{ s: 7.9, what: "rush" },                           // the ghost bride comes at you (x -2)
		{ s: 16.4, what: "lunge" },                         // out of the wall (x 7)
		{ s: TR.Ls + Math.PI * TR.R + 3.0, what: "hands" },  // out lane: the graveyard (x 6)
		{ s: TR.Ls + Math.PI * TR.R + 14.6, what: "spider" },
		{ s: 2 * TR.Ls + Math.PI * TR.R + 1.2, what: "vampire" }
	];
	let prevTrainS = -1;

	// ================================================================ every frame
	const _pp = new THREE.Vector3();
	let ambT = 6, thunderT = 20, flash = 0;
	function update(dt, t) {
		const me = ctx.me();
		const [mx, mz] = local(me.x, me.z);
		const here = mx > X0 - 0.2 && mx < X1 + 0.2 && mz > Z0 - 0.2 && mz < Z1 + 0.2;
		const riding = !!me.sit && me.sit.indexOf("ghostTrain") === 0;
		// scares along the walk-through
		if (here && !me.sit) for (const n in SCARES) if (inRect(SCARES[n], mx, mz)) trigger(n);
		for (const n in fx) if (fx[n] >= 0 && n !== "rush") { fx[n] += dt; if (fx[n] > 6) fx[n] = -1; }
		// the hallway: the lights go out... then something's there
		const fh = fx.hall;
		black = fh >= 0 && fh < 1.4 ? smooth(fh / 0.15) : fh >= 1.4 && fh < 1.9 ? 1 - smooth((fh - 1.4) / 0.5) : 0;
		if (fh >= 1.15 && fh - dt < 1.15) startRush();
		updateRush(dt);
		// lights: every one flickers its own way; lightning now and then
		thunderT -= dt;
		if (here && thunderT <= 0) { thunderT = 25 + Math.random() * 30; flash = 1; setTimeout(() => ctx.sfx("thunder", 0.5), 600); }
		flash = Math.max(0, flash - dt * 2.5);
		let li = 0;
		for (const n in L) {
			const d = L[n];
			const f = 0.72 + 0.18 * Math.sin(t * (7 + li * 1.3) + li) + 0.1 * Math.sin(t * (23 + li * 3.1));
			const dip = Math.sin(t * 0.7 + li * 2.1) > 0.97 ? 0.25 : 1;
			d.intensity = d.base * f * dip * (1 - black) + (n === "foyer" || n === "crypt" ? flash * 3.5 : 0);
			li++;
		}
		k.key.intensity = 2.2 * (1 - black) + flash * 10;
		facadeWins.forEach((m, i) => { const f = 0.75 + 0.25 * Math.sin(t * (5 + i) + i * 2) * Math.sin(t * 1.3 + i); m.color.setRGB(1.0 * f, 0.6 * f, 0.22 * f); });
		pumpkins.forEach((m, i) => { m.emissiveIntensity = 1.8 + 0.6 * Math.sin(t * 9 + i * 1.7) * Math.sin(t * 3.1 + i); });
		// candle flames
		for (let i = 0; i < flames.length; i++) {
			const p = flames[i], s = 0.75 + 0.35 * Math.abs(Math.sin(t * 11 + i * 1.7)) * (1 - black);
			_d.position.set(p[0] + Math.sin(t * 6 + i) * 0.006, p[1], p[2]); _d.rotation.set(0, 0, Math.sin(t * 8 + i) * 0.15); _d.scale.set(s, s * (1.1 - black * 0.9), s); _d.updateMatrix();
			allFlames.setMatrixAt(i, _d.matrix);
		}
		allFlames.instanceMatrix.needsUpdate = true;
		// fog drifting
		for (let i = 0; i < fogSpots.length; i++) {
			const [x, z, s] = fogSpots[i];
			_d.position.set(x + Math.sin(t * 0.13 + i) * 0.6, 0.12 + (i % 3) * 0.06, z + Math.cos(t * 0.11 + i * 1.3) * 0.5);
			_d.rotation.set(-Math.PI / 2, 0, t * 0.05 + i); _d.scale.set(s * 1.4, s, 1); _d.updateMatrix();
			fog.setMatrixAt(i, _d.matrix);
		}
		fog.instanceMatrix.needsUpdate = true;
		// the foyer: the chandelier swings (harder when it creaks), the clock ticks, the girl on the stairs fades in and out
		const ff = fx.foyer;
		const swing = 0.03 + (ff >= 0 ? 0.25 * Math.exp(-ff * 0.6) : 0);
		chand.rotation.z = Math.sin(t * 1.6) * swing; chand.rotation.x = Math.cos(t * 1.3) * swing * 0.6;
		pendulum.rotation.z = Math.sin(t * Math.PI) * 0.25;
		girl.position.y = 1.95 + Math.sin(t * 1.2) * 0.06;
		girl.visible = Math.sin(t * 0.37) > -0.3;
		// portraits: their eyes follow you
		for (const p of portraits) {
			const dx = Math.max(-1, Math.min(1, -(mx - p.x) / 3.5)), dy = Math.max(-1, Math.min(1, (me.sit ? 1.0 : 1.5) - 1.65));
			p.eyes.forEach((e, j) => { e.position.x = p.base[j] + dx * 0.011; e.position.y = 0.07 + dy * 0.006; });
		}
		// library: books drift, and fly at you when it goes off
		const fl = fx.library;
		books.forEach((b, i) => {
			if (fl >= 0 && fl < 3.2 && !b.float) {
				const u = Math.min(1, fl / 0.9), back = fl > 2.0 ? smooth((fl - 2.0) / 1.2) : 0;
				_v.set(mx + Math.sin(i * 1.9) * 0.6, 1.4 + Math.cos(i) * 0.3, mz + Math.cos(i * 2.3) * 0.5);
				_v2.copy(b.home).lerp(_v, smooth(u) * 0.85);
				_v2.y += Math.sin(u * Math.PI) * 0.6;
				b.m.position.copy(_v2).lerp(b.home, back);
				b.m.rotation.set(fl * (4 + i), fl * 3, 0);
			} else if (b.float) {
				b.m.position.set(-3.8 + Math.sin(t * 0.6 + b.ph) * 1.4, 1.6 + Math.sin(t * 1.1 + b.ph) * 0.35, 0.4 + Math.cos(t * 0.5 + b.ph) * 0.7);
				b.m.rotation.set(Math.sin(t + b.ph) * 0.5, t * 0.8 + b.ph, Math.sin(t * 2 + b.ph) * 0.3 + 0.3);
			} else { b.m.position.copy(b.home); b.m.rotation.set(0, 0, 0); }
		});
		fire.forEach((f, i) => { f.scale.set(1, 0.8 + 0.5 * Math.abs(Math.sin(t * 7 + i * 1.3)), 1); });
		readerGhost.position.y = 0.35 + Math.sin(t * 1.4) * 0.04;
		readerGhost.rotation.y = Math.sin(t * 0.3) * 0.4;
		// crypt: the coffin lid bursts open and the skeleton sits up
		const fc = fx.crypt;
		if (fc >= 0 && fc < 5) {
			const open = fc < 0.35 ? smooth(fc / 0.35) : fc > 4.0 ? 1 - smooth((fc - 4.0) / 1.0) : 1;
			coffinLid.rotation.z = open * 2.0 + (fc < 0.35 ? Math.sin(fc * 60) * 0.05 : 0);
			const up = fc < 0.35 ? 0 : fc > 3.8 ? 1 - smooth((fc - 3.8) / 0.9) : smooth((fc - 0.35) / 0.25);
			coffinSk.rotation.x = -Math.PI / 2 + up * Math.PI / 2;
			coffinSk.rotation.y = up * Math.sin(fc * 8) * 0.2;
			coffinSk.userData.limbs.la.rotation.x = -up * 1.2; coffinSk.userData.limbs.ra.rotation.x = -up * 1.4;
		} else { coffinLid.rotation.z = 0.0; coffinSk.rotation.x = -Math.PI / 2; }
		// mirror: the face
		const fm = fx.mirror;
		scareFace.material.opacity = fm >= 0 && fm < 2.6 ? (fm < 0.9 ? smooth(fm / 0.9) * 0.55 : fm < 1.0 ? 1 : 1 - smooth((fm - 1.0) / 1.6)) : 0;
		scareFace.scale.setScalar(fm >= 0.9 && fm < 2.6 ? 1.0 + (fm - 0.9) * 0.15 : 1);
		// dining room: guests bob and turn to look at you, plates drift, curtains stir, the bats
		const fd = fx.dining;
		guests.forEach(q => {
			q.gh.position.y = 0.25 + Math.sin(t * 1.3 + q.ph) * 0.05;
			const look = Math.atan2(mx - (q.cg.position.x), mz - (q.cg.position.z)) - q.cg.rotation.y;
			q.gh.rotation.y = fd >= 0 && fd < 6 ? Math.atan2(Math.sin(look), Math.cos(look)) * Math.min(1, fd * 3) : Math.sin(t * 0.4 + q.ph) * 0.3;
		});
		floaters.forEach(f => { f.m.position.set(f.home.x + Math.sin(t * 0.7 + f.ph) * 0.08, f.home.y + Math.sin(t * 1.1 + f.ph) * 0.12 + (fd >= 0 && fd < 3 ? Math.sin(fd * 3) * 0.3 : 0), f.home.z); f.m.rotation.set(Math.sin(t + f.ph) * 0.2, t * 0.5, 0); });
		curtains.forEach((c, i) => { c.rotation.y = Math.sin(t * 0.9 + i) * 0.12; });
		_pp.set(mx, 1.5, mz);
		updateBats(bats, t, dt, _pp);
		// the ghost train: carts along the track, the lantern on the front one
		for (let c = 0; c < CARTS; c++) {
			trackAt(cartS(c), _tp);
			cartG[c].position.set(_tp.x, Math.sin(t * 9 + c) * 0.008, _tp.z);
			cartG[c].rotation.y = _tp.h;
			if (c === 0) L.cart.pos.set(OX + _tp.x + Math.sin(_tp.h) * 0.8, 1.3, OZ + _tp.z + Math.cos(_tp.h) * 0.8);
			const pulse = 0.6 + 0.4 * Math.sin(t * 5 + c);
			cartFace[c].forEach(e => e.scale.setScalar(pulse + 0.4));
		}
		// the scenes wake up as a cart comes by
		const wh = near(6.0, TR.zA, 2.0);
		hands.forEach((h, i) => { h.position.y = -0.85 + 0.85 * smooth(wh * 1.4 - i * 0.08) + Math.sin(t * 6 + i) * 0.02 * wh; h.rotation.z = Math.sin(t * 4 + i) * 0.2 * wh; });
		dancers.forEach((sk, i) => {
			const L2 = sk.userData.limbs, a = t * 5 + i * Math.PI;
			L2.la.rotation.z = -1.2 - Math.sin(a) * 0.8; L2.ra.rotation.z = 1.2 + Math.sin(a) * 0.8;
			L2.ll.rotation.x = Math.sin(a) * 0.5; L2.rl.rotation.x = -Math.sin(a) * 0.5;
			sk.position.y = Math.abs(Math.sin(a)) * 0.08; sk.rotation.y = Math.sin(t * 1.5 + i) * 0.5;
		});
		swDoors.forEach(D => { const o = near(0, D.z, 1.4); D.piv.rotation.y = D.sd * -smooth(o * 1.6) * 1.35 * (D.z === TR.zA ? -1 : 1); });
		const sp = near(-5.0, TR.zA, 2.2);
		spider.position.y = 3.2 - 1.9 * smooth(sp * 1.3);
		spider.rotation.y = Math.sin(t * 2) * 0.3 * sp;
		spiderLine.scale.y = Math.max(0.01, H - spider.position.y - 0.1);
		spiderLine.position.y = (H + spider.position.y) / 2;
		const vp = near(TR.xW - TR.R, TR.zc, 2.6);
		vampLid.rotation.y = -smooth(vp * 1.5) * 1.6;
		vamp.position.z = smooth(vp * 1.2) * 0.45; vamp.rotation.x = smooth(vp) * 0.15;
		witchArm.rotation.y = t * 2.2;
		bubbles.forEach((b, i) => { const u = mod(t * 0.7 + i / bubbles.length, 1); b.position.set(-6.4 + Math.sin(i * 2.3) * 0.18, 0.78 + u * 0.4, TR.zc + 0.55 + Math.cos(i * 1.7) * 0.18); b.scale.setScalar(0.6 + u * 0.8); b.material.opacity = 0.8 * (1 - u); });
		const bp = near(-2.0, TR.zB, 2.5);
		bride.position.set(-2.0 + Math.sin(t * 0.8) * 0.3, 0.45 + Math.sin(t * 1.3) * 0.08, TR.zc + 0.2 + bp * 0.75);
		bride.rotation.y = Math.PI * 0.5 + bp * 0.9;
		for (let i = 0; i < EYES; i++) {
			const [x, y, ph] = eyeAt[i], open = Math.sin(t * 0.9 + ph) > -0.6 && (t * 3 + ph) % 4 > 0.25 ? 1 : 0.05;
			for (let s = 0; s < 2; s++) { _d.position.set(x + (s ? 0.06 : -0.06), y, SW - T / 2 - 0.03); _d.rotation.set(0, 0, 0); _d.scale.set(1, open, 0.4); _d.updateMatrix(); eyeIM.setMatrixAt(i * 2 + s, _d.matrix); }
		}
		eyeIM.instanceMatrix.needsUpdate = true;
		const lp = near(7.0, TR.zB, 1.8);
		lunger.position.z = SW - 0.3 - smooth(lp * 1.5) * 0.55; lunger.position.y = 0.5 + Math.sin(t * 2) * 0.05;
		towerGhost.position.y = 1.6 + Math.sin(t * 0.9) * 0.1;
		towerGhost.visible = Math.sin(t * 0.21) > 0;
		// riders: sounds (and the ghost bride rushes at you) as your cart reaches each scene
		if (riding) {
			const c = +me.sit.charAt(10), s = cartS(c);
			if (prevTrainS >= 0) for (const sc of trainScares) {
				const crossed = prevTrainS <= s ? prevTrainS < sc.s && s >= sc.s : prevTrainS < sc.s || s >= sc.s;
				if (!crossed) continue;
				if (sc.what === "witch") ctx.sfx("laugh", 0.6);
				if (sc.what === "rush") startRush();
				if (sc.what === "lunge") { ctx.sfx("ghost", 0.8); ctx.doUpper("cheer", 1200); }
				if (sc.what === "hands") ctx.sfx("creak", 0.6);
				if (sc.what === "spider") { ctx.sfx("scream", 0.6); ctx.doUpper("cheer", 1500); }
				if (sc.what === "vampire") { ctx.sfx("creak", 0.7); ctx.sfx("thunder", 0.5); }
			}
			prevTrainS = s;
		} else prevTrainS = -1;
		// now and then, the house makes a noise
		ambT -= dt;
		if (here && ambT <= 0) { ambT = 12 + Math.random() * 14; ctx.sfx(Math.random() < 0.5 ? "creak" : "ghost", 0.25); }
	}

	return {
		update,
		onEnter() { ctx.sfx("creak", 0.5); thunderT = 8 + Math.random() * 8; },
		// out of the house: the scares are ready to go again next time
		onLeave() { for (const n in done) delete done[n]; for (const n in fx) fx[n] = -1; rusher.visible = false; black = 0; },
		onFx(d) { if (d.what === "scare" && SCARES[d.s] && d.s !== "hall" && d.s !== "foyer") play(d.s, false); },
		promptOpts(opts) {
			const me = ctx.me();
			if (me.sit && me.sit.indexOf("ghostTrain") === 0 && !opts.some(o => o.k === "G")) opts.push({ k: "G", label: "Scream!", fn: () => { ctx.doUpper("cheer", 1800); ctx.sfx("scream", 0.5); } });
		}
	};
}
