/**
 * Harmony World — the Bumper Kart Arena: west of the Fun Park, through the gate in its west railing.
 * Outdoors under the night sky, like the park.
 *
 * Local coordinates (origin at world -16.8, -41.8): x -9.2..9.2, z -10.2..11.6. The gate from the park is in the
 * east edge (x 9.2) at z -0.8..0.8.
 *
 *   the arena: a rounded checkered floor ringed by stacked tyres with a neon rail along the top, a tyre island in the
 *     middle with a glowing pylon, boost pads on the floor, floodlights on the corners, and a scoreboard of who has
 *     kicked the most karts
 *   the pit along the east side (where you come in): three karts waiting under a canopy; get in and you drive
 *   the stands along the north side: two rows of benches to watch from
 *
 * Driving is a vehicle (see vehicle() and world.js): you steer with WASD / the arrow keys / the joystick and the kart
 * is yours alone to move (each player's client drives its own kart). Bump into someone and you bounce apart: your
 * side sends them the push ("bump" fx). Space (or E) is a boost: ram someone while it's on and that's a KICK - they
 * spin out, stars fly, and it goes on the scoreboard ("karts:score", shared). Esc gets you out.
 * Everyone with upper === "kart" in the arena gets a kart drawn round them (a pool of them, coloured by who it is).
 */
const OX = -16.8, OZ = -41.8;                      // = ZONES.karts ox / oz
const X0 = -9.2, X1 = 9.2, Z0 = -10.2, Z1 = 11.6;
const GATE = { z0: -0.8, z1: 0.8 };
const A = { x: -1.3, z: -0.4, hx: 7.3, hz: 8.5, rc: 2.6 };    // the arena floor: a rounded rectangle (inside of the tyres)
const ISLE = { r: 1.3 };                                         // the tyre island in the middle
const R = 0.75;                                                  // a kart's bumper (for bumping)
const PIT = { x: 8.0 };                                          // the pit lane, east of the arena
const STAND = { z0: 9.05 };                                      // the stands, north of the arena
const TAU = Math.PI * 2;
const MAX_V = 6, BOOST_V = 11, REV_V = 3;
const POOL = 10;
const COLORS = ["#ff4d6d", "#ffd166", "#06d6a0", "#4cc9f0", "#c77dff", "#ff9e4a", "#f15bb5", "#9ef01a", "#00f5d4", "#fee440"];
const hashId = s => { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); };
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

// signed distance from a point (relative to the arena's middle) to the arena's edge (< 0 inside), and the way out
function sdArena(px, pz, n) {
	const qx = Math.abs(px) - (A.hx - A.rc), qz = Math.abs(pz) - (A.hz - A.rc);
	const out = Math.hypot(Math.max(qx, 0), Math.max(qz, 0)), inn = Math.min(Math.max(qx, qz), 0);
	if (n) {
		if (qx > 0 && qz > 0) { n.x = qx / out * Math.sign(px); n.z = qz / out * Math.sign(pz); }
		else if (qx > qz) { n.x = Math.sign(px) || 1; n.z = 0; }
		else { n.x = 0; n.z = Math.sign(pz) || 1; }
	}
	return out + inn - A.rc;
}
// points round the arena's edge, off pushed out from it, about every `step` metres (closed loop, local coordinates)
function rimPoints(off, step) {
	const r = A.rc + off, cx = A.hx - A.rc, cz = A.hz - A.rc, dense = [];
	const corners = [[cx, cz, 0], [-cx, cz, Math.PI / 2], [-cx, -cz, Math.PI], [cx, -cz, Math.PI * 1.5]];
	for (const [x, z, a0] of corners) for (let i = 0; i <= 16; i++) { const a = a0 + i / 16 * Math.PI / 2; dense.push([A.x + x + Math.cos(a) * r, A.z + z + Math.sin(a) * r]); }
	const segs = dense.map((p, i) => { const q = dense[(i + 1) % dense.length]; return Math.hypot(q[0] - p[0], q[1] - p[1]); });
	const L = segs.reduce((a, b) => a + b, 0), n = Math.max(8, Math.round(L / step)), out = [];
	let j = 0, acc = 0;
	for (let i = 0; i < n; i++) {
		const d = i / n * L;
		while (acc + segs[j] < d) { acc += segs[j]; j++; }
		const f = (d - acc) / segs[j], p = dense[j], q = dense[(j + 1) % dense.length];
		out.push([p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f]);
	}
	return out;
}

export function build(k) {
	const { THREE, add, mat, group, rbox, g, ctx, canvasTex } = k;
	const Y = new THREE.Vector3(0, 1, 0);
	k.floor(() => 0);
	k.walk(PIT.x - 1.0, X1 - 0.15, Z0 + 0.15, Z1 - 0.15);          // the pit lane (east)
	k.walk(X0 + 0.15, X1 - 0.15, STAND.z0, Z1 - 0.15);              // round the stands (north)
	k.walk(X1 - 1.2, X1 + 0.8, GATE.z0, GATE.z1);                    // in through the gate from the park (past the line: no seam)
	k.cam = { minX: X0 - 3, maxX: X1 + 3, minZ: Z0 - 3, maxZ: Z1 + 3, maxY: 14, minY: 0.2 };
	const glow = c => new THREE.MeshBasicMaterial({ color: c, toneMapped: false });
	const sign = (text, o) => new THREE.MeshBasicMaterial({ map: k.tex.text(text, Object.assign({ w: 1024, h: 256 }, o)), transparent: true, depthWrite: false, toneMapped: false });
	const me = () => ctx.me();
	const inZone = (x, z) => x > OX + X0 - 0.01 && x < OX + X1 + 0.01 && z > OZ + Z0 - 0.01 && z < OZ + Z1 + 0.01;
	const dark = mat("#1d1b22", 0.9), chrome = mat("#e3e7ea", 0.15, 1), cushion = mat("#2b2233", 0.85);
	// the camera can't pass through the solid things (tyre wall, stands, canopy, scoreboard); the arena stays open above
	const camWall = (x0, x1, z0, z1, y0, y1) => (k.camWall ? k.camWall(x0, x1, z0, z1, y0, y1) : null);
	// the arena's outline (a rounded rectangle round its middle), for the floor and the hole in the paving round it
	const arenaPath = (path, r0) => {
		const cx = A.hx - A.rc, cz = A.hz - A.rc, r = A.rc + r0, ox = A.x, oy = -A.z;   // (shape y = -z: it's laid flat with rx -PI/2)
		path.moveTo(ox + cx + r, oy - cz);
		path.absarc(ox + cx, oy + cz, r, 0, Math.PI / 2, false);
		path.absarc(ox - cx, oy + cz, r, Math.PI / 2, Math.PI, false);
		path.absarc(ox - cx, oy - cz, r, Math.PI, Math.PI * 1.5, false);
		path.absarc(ox + cx, oy - cz, r, Math.PI * 1.5, TAU, false);
		return path;
	};

	// ================================================================ the ground: dark paving, the checkered arena floor
	// (the paving has a hole where the arena floor is, so the two never overlap and flicker)
	const paving = canvasTex(256, 256, (c, w, h) => {
		c.fillStyle = "#4b4452"; c.fillRect(0, 0, w, h);
		for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) { const t = 70 + ((i * 7 + j * 13) % 5) * 5; c.fillStyle = `rgb(${t + 8},${t},${t + 12})`; c.fillRect(i * 64 + 2, j * 64 + 2, 60, 60); }
	}, 0.5, 0.5);
	{
		const sh = new THREE.Shape();
		sh.moveTo(X0, -Z0); sh.lineTo(X1, -Z0); sh.lineTo(X1, -Z1); sh.lineTo(X0, -Z1); sh.lineTo(X0, -Z0);
		sh.holes.push(arenaPath(new THREE.Path(), 0.25));
		add(g, new THREE.ShapeGeometry(sh, 12), mat("#ffffff", 0.9, 0, { map: paving }), 0, 0, 0, { rx: -Math.PI / 2, cast: false }).userData.floor = true;
	}
	{
		const checks = canvasTex(256, 256, (c, w, h) => {
			for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) { c.fillStyle = (i + j) % 2 ? "#1e1a2b" : "#2e2744"; c.fillRect(i * 128, j * 128, 128, 128); }
			c.strokeStyle = "rgba(76,201,240,.25)"; c.lineWidth = 3; c.strokeRect(1, 1, w - 2, h - 2);
		}, 0.5, 0.5);
		// (exactly the hole in the paving, running in under the tyres: no gap at the seam, no overlap to flicker)
		const fl = add(g, new THREE.ShapeGeometry(arenaPath(new THREE.Shape(), 0.25), 12), mat("#ffffff", 0.55, 0.1, { map: checks }), 0, 0.002, 0, { rx: -Math.PI / 2, cast: false });
		fl.userData.floor = true;
		// a glowing ring painted round the middle (painted marks sit 2 cm up, so they never flicker into the floor)
		add(g, new THREE.RingGeometry(4.0, 4.12, 64), glow("#4cc9f0"), A.x, 0.02, A.z, { rx: -Math.PI / 2, cast: false, receive: false });
	}

	// ================================================================ the tyre wall with a neon rail on top
	const tyreGeo = new THREE.TorusGeometry(0.32, 0.13, 8, 18);
	const tyreM = mat("#ffffff", 0.85);
	const d = new THREE.Object3D(), col = new THREE.Color();
	{
		const pts = rimPoints(0.45, 0.92);
		const tyres = new THREE.InstancedMesh(tyreGeo, tyreM, pts.length * 3);
		pts.forEach(([x, z], i) => {
			for (let l = 0; l < 3; l++) {
				d.position.set(x, 0.13 + l * 0.26, z); d.rotation.set(Math.PI / 2, 0, 0); d.updateMatrix();
				tyres.setMatrixAt(i * 3 + l, d.matrix);
				tyres.setColorAt(i * 3 + l, col.set((i + l) % 2 ? "#26232c" : (i % 4 < 2 ? "#e63946" : "#f4efe8")));
			}
		});
		tyres.castShadow = false;
		g.add(tyres);
		// camera walls along the tyres (in pieces round the curve), as high as the neon rail
		rimPoints(0.45, 1.4).forEach(([x, z]) => camWall(x - 0.55, x + 0.55, z - 0.55, z + 0.55, 0, 0.92));
		const rail = rimPoints(0.45, 0.5).map(([x, z]) => new THREE.Vector3(x, 0.86, z));
		var neonM = glow("#f15bb5");
		add(g, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rail, true), rail.length * 2, 0.045, 6, true), neonM, 0, 0, 0, { cast: false, receive: false });
		const low = rimPoints(-0.02, 0.5).map(([x, z]) => new THREE.Vector3(x, 0.04, z));
		add(g, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(low, true), low.length * 2, 0.03, 5, true), glow("#4cc9f0"), 0, 0, 0, { cast: false, receive: false });
	}
	// the island in the middle: a ring of tyres, a striped pylon with a light on top
	var pylonBall;
	{
		const n = 12, ig = group(g, A.x, 0, A.z);
		const tyres = new THREE.InstancedMesh(tyreGeo, tyreM, n * 2);
		for (let i = 0; i < n; i++) for (let l = 0; l < 2; l++) {
			const a = (i + l * 0.5) / n * TAU;
			d.position.set(Math.sin(a) * (ISLE.r - 0.4), 0.13 + l * 0.26, Math.cos(a) * (ISLE.r - 0.4)); d.rotation.set(Math.PI / 2, 0, 0); d.updateMatrix();
			tyres.setMatrixAt(i * 2 + l, d.matrix); tyres.setColorAt(i * 2 + l, col.set((i + l) % 2 ? "#ffd166" : "#26232c"));
		}
		tyres.castShadow = false;
		ig.add(tyres);
		add(ig, new THREE.CylinderGeometry(ISLE.r - 0.75, ISLE.r - 0.7, 0.4, 20), mat("#3a2f4a", 0.7), 0, 0.2, 0);
		camWall(A.x - 0.95, A.x + 0.95, A.z - 0.95, A.z + 0.95, 0, 0.6);
		const stripe = canvasTex(64, 256, (c, w, h) => { for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? "#ffffff" : "#ff4d6d"; c.fillRect(0, i * h / 8, w, h / 8 + 1); } });
		add(ig, new THREE.ConeGeometry(0.32, 2.4, 16), mat("#ffffff", 0.5, 0, { map: stripe }), 0, 1.6, 0);
		pylonBall = add(ig, new THREE.SphereGeometry(0.16, 14, 10), glow("#ffd166"), 0, 2.9, 0, { cast: false });
	}
	// boost pads: drive over one and it shoves you forward
	const PADS = [[A.x + 4.4, A.z, 0], [A.x - 4.4, A.z, Math.PI], [A.x, A.z + 5.6, -Math.PI / 2], [A.x, A.z - 5.6, Math.PI / 2]];
	const padMats = [];
	{
		const chev = canvasTex(256, 256, (c, w, h) => {
			c.clearRect(0, 0, w, h);
			c.strokeStyle = "#9ef01a"; c.lineWidth = 26; c.lineJoin = "round"; c.lineCap = "round";
			for (let i = 0; i < 3; i++) { const y = 60 + i * 70; c.beginPath(); c.moveTo(50, y + 40); c.lineTo(128, y - 20); c.lineTo(206, y + 40); c.stroke(); }
		});
		for (const [x, z, a] of PADS) {
			const m = new THREE.MeshBasicMaterial({ map: chev, transparent: true, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending });
			padMats.push(m);
			const pm = add(g, new THREE.PlaneGeometry(1.4, 1.4), m, x, 0.035, z, { rx: -Math.PI / 2, cast: false, receive: false });
			pm.rotation.z = a; pm.renderOrder = 2;
			add(g, new THREE.RingGeometry(0.78, 0.86, 4, 1, Math.PI / 4), glow("#9ef01a"), x, 0.025, z, { rx: -Math.PI / 2, cast: false, receive: false });
		}
	}
	// floodlights on the corners
	const floodHeads = [];
	for (const [sx, sz] of [[1, 1], [-1, 1], [-1, -1], [1, -1]]) {
		const x = A.x + sx * (A.hx + 0.35), z = A.z + sz * (A.hz + 0.35);
		const fg = group(g, x, 0, z, Math.atan2(A.x - x, A.z - z));
		add(fg, new THREE.CylinderGeometry(0.08, 0.12, 7.0, 10), mat("#3e3a3a", 0.4, 0.6), 0, 3.5, 0);
		add(fg, rbox(1.1, 0.5, 0.25, 0.04), dark, 0, 7.1, 0.15, { rx: 0.5 });
		const head = add(fg, new THREE.PlaneGeometry(0.95, 0.38), glow("#fff6e0"), 0, 7.08, 0.29, { rx: 0.5, cast: false, receive: false });
		floodHeads.push(head);
		// a soft beam of light down onto the arena
		const beam = new THREE.Mesh(new THREE.ConeGeometry(2.6, 7.4, 20, 1, true), new THREE.MeshBasicMaterial({ color: "#fff3d6", transparent: true, opacity: 0.05, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false }));
		beam.position.set(0, 3.5, 2.0); beam.rotation.x = -0.5;
		beam.castShadow = false; beam.receiveShadow = false; beam.renderOrder = 3;
		fg.add(beam);
		k.box(x - 0.15, x + 0.15, z - 0.15, z + 0.15);
	}

	// ================================================================ a kart (local: facing +z, standing on the floor; the seat is at 0.46)
	function makeKart(parent, color, num) {
		const kg = group(parent, 0, 0, 0);
		const bodyM = mat(color, 0.35, 0.25), accentM = mat("#f4efe8", 0.4, 0.2);
		const bump = add(kg, new THREE.TorusGeometry(0.64, 0.15, 10, 32), dark, 0, 0.2, 0, { rx: Math.PI / 2 });
		bump.scale.set(1, 1.25, 1);
		add(kg, new THREE.CylinderGeometry(0.64, 0.64, 0.12, 28), bodyM, 0, 0.22, 0).scale.set(1, 1, 1.25);
		for (const sx of [-0.4, 0.4]) for (const sz of [-0.5, 0.5]) add(kg, new THREE.CylinderGeometry(0.1, 0.1, 0.1, 12), dark, sx, 0.1, sz, { rz: Math.PI / 2, cast: false });
		add(kg, rbox(0.95, 0.32, 1.2, 0.12), bodyM, 0, 0.42, -0.02);
		add(kg, rbox(0.8, 0.26, 0.42, 0.1), accentM, 0, 0.54, 0.52);
		add(kg, rbox(0.52, 0.08, 0.46, 0.03), cushion, 0, 0.42, -0.12);
		add(kg, rbox(0.58, 0.55, 0.1, 0.04), bodyM, 0, 0.78, -0.42, { rx: -0.15 });
		add(kg, new THREE.CylinderGeometry(0.025, 0.025, 0.36, 8), chrome, 0, 0.66, 0.34, { rx: 0.7, cast: false });
		add(kg, new THREE.TorusGeometry(0.14, 0.025, 6, 18), dark, 0, 0.8, 0.24, { rx: -0.6, cast: false });
		for (const sx of [-0.25, 0.25]) add(kg, new THREE.CircleGeometry(0.06, 12), glow("#fff6d8"), sx, 0.56, 0.735, { cast: false, receive: false });
		const nt = k.tex.text(String(num), { w: 256, h: 256, color: "#ffffff", glow: "#000000", font: "900 190px Nunito, 'Segoe UI', sans-serif" });
		const numM = new THREE.MeshBasicMaterial({ map: nt, transparent: true, depthWrite: false });
		for (const sx of [-1, 1]) add(kg, new THREE.PlaneGeometry(0.32, 0.32), numM, sx * 0.481, 0.44, 0, { ry: sx * Math.PI / 2, cast: false, receive: false });
		add(kg, new THREE.PlaneGeometry(0.3, 0.3), numM, 0, 0.675, 0.52, { rx: -Math.PI / 2, cast: false, receive: false });
		// the antenna with a flag and a light (so you can find yourself in a crowd)
		add(kg, new THREE.CylinderGeometry(0.012, 0.012, 1.7, 6), chrome, 0.3, 1.35, -0.5, { cast: false });
		const flagM = mat(color, 0.6, 0, { side: THREE.DoubleSide });
		const flag = add(kg, new THREE.PlaneGeometry(0.34, 0.22), flagM, 0.47, 2.05, -0.5, { ry: Math.PI / 2, cast: false });
		const ballM = glow(color);
		add(kg, new THREE.SphereGeometry(0.06, 10, 8), ballM, 0.3, 2.22, -0.5, { cast: false });
		const under = add(kg, new THREE.CircleGeometry(0.85, 24), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }), 0, 0.045, 0, { rx: -Math.PI / 2, cast: false, receive: false });
		under.scale.set(1, 1.25, 1); under.renderOrder = 2;
		const setColor = c => { bodyM.color.set(c); flagM.color.set(c); ballM.color.set(c); under.material.color.set(c); };
		return { kg, flag, setColor, owner: null };
	}
	// the pool that follows whoever is driving
	const karts = [];
	for (let i = 0; i < POOL; i++) { const kt = makeKart(g, COLORS[i], i + 1); kt.kg.visible = false; karts.push(kt); }

	// ================================================================ the pit: three karts waiting under a canopy, and the way in
	const pit = group(g, PIT.x, 0, -5.0);
	{
		const parked = [];
		[[-2.6, "#ff4d6d", 7], [0, "#4cc9f0", 8], [2.4, "#ffd166", 9]].forEach(([dz, c, n]) => {
			const kt = makeKart(pit, c, n);
			kt.kg.position.set(0, 0, dz); kt.kg.rotation.y = -Math.PI / 2;
			parked.push(kt.kg);
		});
		const postM = mat("#f4efe8", 0.5);
		for (const dz of [-4.0, 4.0]) for (const dx of [-0.75, 0.75]) add(pit, new THREE.CylinderGeometry(0.06, 0.07, 2.8, 10), postM, dx, 1.4, dz);
		const awn = canvasTex(256, 64, (c, w, h) => { for (let i = 0; i < 16; i++) { c.fillStyle = i % 2 ? "#1e1a2b" : "#9ef01a"; c.fillRect(i * w / 16, 0, w / 16 + 1, h); } });
		add(pit, new THREE.BoxGeometry(1.9, 0.12, 8.4), mat("#2b1d3a", 0.7), 0, 2.86, 0);
		add(pit, new THREE.PlaneGeometry(8.4, 0.4), mat("#ffffff", 0.8, 0, { map: awn, side: THREE.DoubleSide }), 0.96, 2.62, 0, { ry: Math.PI / 2, cast: false });
		add(pit, new THREE.PlaneGeometry(3.4, 0.7), sign("KART PIT", { color: "#efffd6", glow: "#9ef01a", font: "900 150px Nunito, 'Segoe UI', sans-serif" }), 0.97, 3.25, 0, { ry: Math.PI / 2, cast: false, receive: false });
		add(pit, new THREE.PlaneGeometry(3.4, 0.7), sign("KART PIT", { color: "#efffd6", glow: "#9ef01a", font: "900 150px Nunito, 'Segoe UI', sans-serif" }), -0.97, 3.25, 0, { ry: -Math.PI / 2, cast: false, receive: false });
		for (const dz of [-4.0, 4.0]) for (const dx of [-0.75, 0.75]) k.box(PIT.x + dx - 0.1, PIT.x + dx + 0.1, -5.0 + dz - 0.1, -5.0 + dz + 0.1);
		k.box(PIT.x - 0.75, PIT.x + 0.75, -8.5, -1.7);
		camWall(PIT.x - 0.95, PIT.x + 0.95, -9.2, -0.8, 2.78, 2.95);   // the canopy roof
		camWall(PIT.x - 0.7, PIT.x + 0.7, -8.4, -1.7, 0, 0.9);         // the parked karts
		var parkedKarts = parked;
	}
	// the arch over the gate
	{
		const ag = group(g, X1 - 0.3, 0, 0);
		const stripe = canvasTex(64, 256, (c, w, h) => { for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? "#f4efe8" : "#1e1a2b"; c.fillRect(0, i * h / 8, w, h / 8 + 1); } });
		for (const sz of [-1.35, 1.35]) { add(ag, new THREE.CylinderGeometry(0.16, 0.2, 3.8, 14), mat("#ffffff", 0.5, 0, { map: stripe }), 0, 1.9, sz); k.box(X1 - 0.55, X1 - 0.05, sz - 0.25, sz + 0.25); }
		add(ag, rbox(0.24, 0.9, 3.4, 0.08), mat("#1e1a2b", 0.6), 0, 3.9, 0);
		camWall(X1 - 0.45, X1 - 0.15, -1.7, 1.7, 3.45, 4.35);
		for (const s of [-1, 1]) add(ag, new THREE.PlaneGeometry(3.2, 0.8), sign("Bumper Karts", { color: "#ffffff", glow: "#f15bb5", font: "800 140px 'Caveat', 'Nunito', cursive" }), s * 0.13, 3.9, 0, { ry: s * Math.PI / 2, cast: false, receive: false });
	}
	// the stands: two rows of benches facing the arena
	{
		const wood = mat("#8a5a3c", 0.55), iron = mat("#2e2b2b", 0.5, 0.5);
		[9.75, 10.95].forEach((z, row) => {
			const ids = [];
			const bg = group(g, -1.3, 0.04, z, Math.PI);
			add(bg, rbox(12.6, 0.07, 0.42, 0.02), wood, 0, 0.42, 0);
			add(bg, rbox(12.6, 0.4, 0.06, 0.02), wood, 0, 0.72, -0.2, { rx: -0.12 });
			for (let i = 0; i < 7; i++) add(bg, rbox(0.06, 0.42, 0.38, 0.02), iron, -6.2 + i * 2.07, 0.21, 0);
			for (let i = 0; i < 6; i++) {
				const id = "kartStand" + row + i, x = -6.3 + i * 2.0 + row * 0.6;
				k.spot({ id, x, z: z - 0.05, y: 0.04, h: Math.PI });
				ids.push(id);
			}
			k.box(-7.7, 5.1, z - 0.25, z + 0.25);
			camWall(-7.7, 5.1, z - 0.3, z + 0.3, 0, 0.95);
			k.interact("karts:stand" + row, { label: "Watch from the stands", stand: [-1.3, z - 0.55], sit: ids, reach: 6.5 }, bg);
		});
	}
	// the scoreboard (south side, facing the arena and the stands)
	const boardC = document.createElement("canvas"); boardC.width = 1024; boardC.height = 512;
	const boardTex = new THREE.CanvasTexture(boardC); boardTex.colorSpace = THREE.SRGBColorSpace;
	{
		const sb = group(g, A.x, 0, A.z - A.hz - 1.15);
		for (const sx of [-1.9, 1.9]) add(sb, new THREE.CylinderGeometry(0.07, 0.08, 4.8, 10), mat("#3e3a3a", 0.4, 0.6), sx, 2.4, 0);
		add(sb, rbox(4.3, 2.3, 0.14, 0.06), dark, 0, 3.55, -0.04);
		add(sb, new THREE.PlaneGeometry(4.1, 2.05), new THREE.MeshBasicMaterial({ map: boardTex, toneMapped: false }), 0, 3.55, 0.035, { cast: false, receive: false });
		camWall(A.x - 2.2, A.x + 2.2, A.z - A.hz - 1.3, A.z - A.hz - 1.0, 2.35, 4.75);
	}
	let boardSig = "";
	function drawBoard() {
		const sc = ctx.get("karts:score") || {};
		const rows = Object.keys(sc).map(id => sc[id]).filter(r => r && r.k > 0).sort((a, b) => b.k - a.k).slice(0, 5);
		const drivers = drivingNow().length;
		const sig = JSON.stringify(rows) + drivers;
		if (sig === boardSig) return;
		boardSig = sig;
		const c = boardC.getContext("2d");
		c.fillStyle = "#130f1c"; c.fillRect(0, 0, 1024, 512);
		c.strokeStyle = "#f15bb5"; c.lineWidth = 8; c.strokeRect(10, 10, 1004, 492);
		c.textBaseline = "middle"; c.textAlign = "center";
		c.fillStyle = "#ffd166"; c.font = "900 64px Nunito, 'Segoe UI', sans-serif";
		c.fillText("KICK CHAMPIONS", 512, 62);
		c.font = "800 44px Nunito, 'Segoe UI', sans-serif";
		if (!rows.length) { c.fillStyle = "#b9adc9"; c.fillText("No kicks yet - boost into someone!", 512, 250); }
		rows.forEach((r, i) => {
			const y = 140 + i * 66;
			c.textAlign = "left"; c.fillStyle = i ? "#e9e1f5" : "#ffd166";
			c.fillText(`${i + 1}.  ${String(r.n || "Guest").slice(0, 18)}`, 70, y);
			c.textAlign = "right"; c.fillStyle = "#9ef01a";
			c.fillText(`${r.k} kick${r.k === 1 ? "" : "s"}`, 954, y);
		});
		c.textAlign = "center"; c.fillStyle = "#4cc9f0"; c.font = "700 32px Nunito, 'Segoe UI', sans-serif";
		c.fillText(drivers ? `${drivers} kart${drivers === 1 ? "" : "s"} on the floor` : "The arena is empty - grab a kart in the pit!", 512, 474);
		boardTex.needsUpdate = true;
	}

	// ================================================================ sparks and stars
	const NP = 180;
	const spGeo = new THREE.BufferGeometry();
	spGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(NP * 3), 3));
	spGeo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(NP * 3), 3));
	const sparks = new THREE.Points(spGeo, new THREE.PointsMaterial({ size: 0.13, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
	sparks.frustumCulled = false;
	g.add(sparks);
	const spV = new Float32Array(NP * 3), spLife = new Float32Array(NP);
	let spNext = 0;
	for (let i = 0; i < NP; i++) spGeo.attributes.position.setXYZ(i, 0, -50, 0);
	function burst(x, y, z, n, color, speed) {
		const c = new THREE.Color(color);
		for (let j = 0; j < n; j++) {
			const i = spNext; spNext = (spNext + 1) % NP;
			const a = Math.random() * TAU, u = Math.random() * 2 - 1, s = Math.sqrt(1 - u * u), v = speed * (0.4 + Math.random() * 0.8);
			spGeo.attributes.position.setXYZ(i, x, y, z);
			spV[i * 3] = Math.cos(a) * s * v; spV[i * 3 + 1] = Math.abs(u) * v + 1.5; spV[i * 3 + 2] = Math.sin(a) * s * v;
			spLife[i] = 0.5 + Math.random() * 0.5;
			const cc = Math.random() < 0.4 ? c : new THREE.Color("#fff3c4");
			spGeo.attributes.color.setXYZ(i, cc.r, cc.g, cc.b);
		}
	}
	// dust (and flames while boosting) puffing out behind moving karts: soft round points that grow and fade
	const NQ = 220;
	const puffTex = canvasTex(64, 64, (c, w, h) => { const gr = c.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.5, "rgba(255,255,255,0.45)"); gr.addColorStop(1, "rgba(255,255,255,0)"); c.fillStyle = gr; c.fillRect(0, 0, w, h); });
	const pfGeo = new THREE.BufferGeometry();
	pfGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(NQ * 3), 3));
	pfGeo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(NQ * 3), 3));
	const puffs = new THREE.Points(pfGeo, new THREE.PointsMaterial({ size: 0.5, map: puffTex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
	puffs.frustumCulled = false; puffs.renderOrder = 4;
	g.add(puffs);
	const pfV = new Float32Array(NQ * 3), pfLife = new Float32Array(NQ), pfMax = new Float32Array(NQ), pfCol = new Float32Array(NQ * 3);
	let pfNext = 0;
	for (let i = 0; i < NQ; i++) pfGeo.attributes.position.setXYZ(i, 0, -50, 0);
	function puff(x, y, z, color, life, vx, vz) {
		const i = pfNext; pfNext = (pfNext + 1) % NQ;
		const c = new THREE.Color(color);
		pfGeo.attributes.position.setXYZ(i, x + (Math.random() - 0.5) * 0.25, y, z + (Math.random() - 0.5) * 0.25);
		pfV[i * 3] = vx + (Math.random() - 0.5) * 0.6; pfV[i * 3 + 1] = 0.35 + Math.random() * 0.4; pfV[i * 3 + 2] = vz + (Math.random() - 0.5) * 0.6;
		pfLife[i] = pfMax[i] = life;
		pfCol[i * 3] = c.r; pfCol[i * 3 + 1] = c.g; pfCol[i * 3 + 2] = c.b;
	}
	// "KICK!" popping up over a crash
	const kickTex = k.tex.text("KICK!", { w: 512, h: 256, color: "#ffd166", glow: "#ff4d6d", font: "900 170px Nunito, 'Segoe UI', sans-serif" });
	const kickPop = new THREE.Sprite(new THREE.SpriteMaterial({ map: kickTex, transparent: true, depthWrite: false, toneMapped: false }));
	kickPop.scale.set(2.2, 1.1, 1); kickPop.visible = false; kickPop.renderOrder = 10; kickPop.userData.life = 0;
	g.add(kickPop);
	// who's boosting right now (their flames show): id -> until (seconds)
	const boosting = new Map();
	const starShape = (() => { const s = new THREE.Shape(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 0.08 : 0.2, a = i / 10 * TAU; i ? s.lineTo(Math.sin(a) * r, Math.cos(a) * r) : s.moveTo(0, r); } return s; })();
	const starGeo = new THREE.ExtrudeGeometry(starShape, { depth: 0.04, bevelEnabled: false });
	starGeo.center();
	const stars = [];
	for (let i = 0; i < 10; i++) {
		const m = add(g, starGeo, new THREE.MeshBasicMaterial({ color: "#ffd166", transparent: true, toneMapped: false }), 0, -50, 0, { cast: false, receive: false });
		m.visible = false;
		stars.push({ m, life: 0, a: 0, cx: 0, cy: 0, cz: 0 });
	}
	let starNext = 0;
	function starRing(x, z) {
		for (let j = 0; j < 5; j++) {
			const s = stars[starNext]; starNext = (starNext + 1) % stars.length;
			s.life = 1.1; s.a = j / 5 * TAU; s.cx = x; s.cy = 1.7; s.cz = z;
			s.m.visible = true;
		}
	}

	// ================================================================ driving (the local player's own kart)
	// K: { x, z (local), h, vx, vz, spin, spinDir, cool, boostT, pad, hits: Map id -> time, engT }
	let K = null;
	const _n = { x: 0, z: 0 };
	const startSpots = [[4.6, -6.2], [4.6, -3.1], [4.6, 3.1], [4.6, 6.2], [-6.2, -6.2], [-6.2, 6.2], [-1.3, 6.8], [-1.3, -7.6]];
	// where everyone else's kart is (local), for bumping: from their drawn avatars, with a velocity worked out frame to frame
	const others = new Map();   // id -> { x, z, vx, vz, name, seen }
	function drivingNow() {
		const out = [];
		if (K) out.push({ id: ctx.MY_ID, x: K.x, z: K.z, h: K.h, mine: true });
		ctx.peers().forEach((p, id) => {
			if (p.upper !== "kart" || !p.avatar || !p.avatar.root) return;
			const rp = p.avatar.root.position;
			if (!inZone(rp.x, rp.z)) return;
			const e = new THREE.Euler().setFromQuaternion(p.avatar.root.quaternion, "YXZ");
			out.push({ id, x: rp.x - OX, z: rp.z - OZ, h: e.y, p });
		});
		return out;
	}
	function getIn() {
		const m = me();
		if (K) return;
		if (m.carrying || m.carriedBy) { ctx.notice("You can't drive while carrying someone (or being carried)!"); return; }
		if (m.sit) ctx.standUp(true);
		const taken = drivingNow();
		// the start spot furthest from everyone already driving
		let best = startSpots[0], bd = -1;
		for (const s of startSpots) { let dmin = 99; for (const o of taken) dmin = Math.min(dmin, Math.hypot(o.x - s[0], o.z - s[1])); if (dmin > bd) { bd = dmin; best = s; } }
		const h = Math.atan2(A.x - best[0], A.z - best[1]);
		K = { x: best[0], z: best[1], h, vx: 0, vz: 0, spin: 0, spinDir: 1, cool: 0, boostT: 0, pad: -1, hits: new Map(), engT: 0, honkT: 0, boostHeld: false };
		m.target = null; if (m.path) m.path = [];
		m.anim = "sit"; m.upper = "kart"; m.upperUntil = 0; m.sit = null;
		m.x = OX + K.x; m.z = OZ + K.z; m.h = K.h; m.speed = 0;
		ctx.sendPose(true);
		ctx.sfx("go", 0.5);
		ctx.notice("Vroom! <b>WASD</b> / arrow keys (or the joystick) to drive, <b>Space</b> to boost - ram someone while boosting to <b>kick</b> them into a spin. <b>Esc</b> to get out.");
	}
	function exitKart(quiet) {
		if (!K) return;
		const m = me(), z = K.z;
		K = null;
		if (m.upper === "kart") m.upper = null;
		m.anim = "idle"; m.speed = 0;
		// out into the pit lane, level with where you were (but not in among the parked karts)
		m.x = OX + PIT.x - 0.4; m.z = OZ + clamp(z, -0.6, 8.4);
		m.h = Math.PI / 2;
		ctx.sendPose(true);
		if (!quiet) ctx.sfx("door", 0.3);
	}
	function boost() {
		if (!K || K.cool > 0 || K.spin > 0) return;
		K.vx += Math.sin(K.h) * 6; K.vz += Math.cos(K.h) * 6;
		K.boostT = 0.75; K.cool = 2.5;
		boosting.set(ctx.MY_ID, performance.now() / 1000 + 0.75);
		ctx.send({ t: "fx", kind: "zfx", zone: "karts", what: "boost" });
		ctx.sfx("whoosh", 0.6);
		burst(K.x - Math.sin(K.h) * 0.9, 0.35, K.z - Math.cos(K.h) * 0.9, 18, "#ff9e4a", 2.5);
	}
	function addKick() {
		const sc = Object.assign({}, ctx.get("karts:score") || {});
		const mine = sc[ctx.MY_ID] || { n: "", k: 0 };
		sc[ctx.MY_ID] = { n: (ctx.profile() && ctx.profile().name) || "Guest", k: (mine.k | 0) + 1 };
		// keep the board small: the top 30
		const ids = Object.keys(sc).sort((a, b) => (sc[b].k | 0) - (sc[a].k | 0));
		ids.slice(30).forEach(id => { delete sc[id]; });
		ctx.setShared("karts:score", sc);
	}
	function drive(dt, inp) {
		if (!K) return;
		const m = me();
		if (m.upper !== "kart" || m.sit || !inZone(m.x, m.z)) { exitKart(true); return; }
		dt = Math.min(0.05, dt);
		K.cool -= dt; K.boostT -= dt; K.spin -= dt; K.honkT -= dt;
		const steer = clamp(+inp.x || 0, -1, 1), thr = clamp(+inp.z || 0, -1, 1);
		if (inp.boost && !K.boostHeld) boost();
		K.boostHeld = !!inp.boost;
		// turn first, then split the velocity along the new heading: the sideways part dies away (grip), so you drift a bit
		const fwd0 = K.vx * Math.sin(K.h) + K.vz * Math.cos(K.h);
		if (K.spin > 0) K.h += 10 * dt * K.spinDir;
		else {
			const turn = 2.6 * clamp(Math.abs(fwd0) / 2.2 + 0.35, 0, 1) * (fwd0 < -0.3 ? -1 : 1);
			K.h -= steer * turn * dt;
		}
		const fx = Math.sin(K.h), fz = Math.cos(K.h), rx = -Math.cos(K.h), rz = Math.sin(K.h);
		let fwd = K.vx * fx + K.vz * fz, lat = K.vx * rx + K.vz * rz;
		if (K.spin <= 0) {
			if (thr > 0.05) fwd += thr * (fwd < 0 ? 14 : 7.5) * dt;
			else if (thr < -0.05) fwd += thr * (fwd > 0 ? 14 : 5) * dt;
		}
		if (Math.abs(thr) < 0.05 || K.spin > 0) fwd *= Math.exp(-1.6 * dt);
		fwd *= Math.exp(-0.2 * dt);
		const top = K.boostT > 0 ? BOOST_V : MAX_V;
		if (fwd > top) fwd += (top - fwd) * Math.min(1, dt * 3);
		if (fwd < -REV_V) fwd += (-REV_V - fwd) * Math.min(1, dt * 6);
		lat *= Math.exp(-(K.spin > 0 ? 1.2 : 6.5) * dt);
		K.vx = fx * fwd + rx * lat; K.vz = fz * fwd + rz * lat;
		// skid marks of sparks when drifting hard
		if (Math.abs(lat) > 2.2 && Math.random() < 0.5) burst(K.x, 0.1, K.z, 1, "#fff3c4", 0.8);
		K.x += K.vx * dt; K.z += K.vz * dt;
		// the tyre wall: bounce off it
		const sd = sdArena(K.x - A.x, K.z - A.z, _n);
		if (sd > -R) {
			K.x -= _n.x * (sd + R); K.z -= _n.z * (sd + R);
			const vn = K.vx * _n.x + K.vz * _n.z;
			// a real hit bounces you back; leaning on the wall just slides you along it (no rattling)
			if (vn > 0) {
				const e = vn > 1.6 ? 1.5 : 1.0;
				K.vx -= _n.x * vn * e; K.vz -= _n.z * vn * e;
				if (vn > 1.6 && performance.now() / 1000 - (K.wallT || 0) > 0.25) { K.wallT = performance.now() / 1000; ctx.sfx("thunk", Math.min(0.7, 0.2 + vn * 0.08)); burst(K.x + _n.x * R, 0.4, K.z + _n.z * R, Math.round(4 + vn * 2), "#f15bb5", 2 + vn * 0.3); }
			}
		}
		// the island
		{
			const dx = K.x - A.x, dz = K.z - A.z, dd = Math.hypot(dx, dz) || 0.001, lim = ISLE.r + R - 0.15;
			if (dd < lim) {
				const nx = dx / dd, nz = dz / dd;
				K.x = A.x + nx * lim; K.z = A.z + nz * lim;
				const vn = K.vx * nx + K.vz * nz;
				if (vn < 0) {
					const e = vn < -1.6 ? 1.5 : 1.0;
					K.vx -= nx * vn * e; K.vz -= nz * vn * e;
					if (vn < -1.6 && performance.now() / 1000 - (K.wallT || 0) > 0.25) { K.wallT = performance.now() / 1000; ctx.sfx("thunk", Math.min(0.7, 0.2 - vn * 0.08)); burst(K.x - nx * R, 0.4, K.z - nz * R, 6, "#ffd166", 2.5); }
				}
			}
		}
		// boost pads
		let onPad = -1;
		PADS.forEach(([px, pz], i) => { if (Math.abs(K.x - px) < 0.75 && Math.abs(K.z - pz) < 0.75) onPad = i; });
		if (onPad >= 0 && onPad !== K.pad && K.cool <= 0.8) { K.cool = 0; boost(); }
		K.pad = onPad;
		// the other karts: bounce off them, and push them (their client moves their kart)
		const now = performance.now() / 1000;
		others.forEach((o, id) => {
			const dx = K.x - o.x, dz = K.z - o.z, dd = Math.hypot(dx, dz);
			if (dd >= 2 * R || dd < 0.001) return;
			const nx = dx / dd, nz = dz / dd;
			K.x += nx * (2 * R - dd) * 0.6; K.z += nz * (2 * R - dd) * 0.6;
			const vn = (K.vx - o.vx) * nx + (K.vz - o.vz) * nz;   // < 0: closing in
			const last = K.hits.get(id) || 0;
			if (vn >= -0.3 || now - last < 0.35) return;
			K.hits.set(id, now);
			const j = -vn * 0.9;   // (equal karts, a bit bouncy: each takes the same push, opposite ways)
			K.vx += nx * j; K.vz += nz * j;
			const kick = K.boostT > 0 && -vn > 3.2;
			const cx = (K.x + o.x) / 2, cz = (K.z + o.z) / 2;
			ctx.send({ t: "fx", kind: "zfx", zone: "karts", what: "bump", to: id, vx: +(-nx * j).toFixed(2), vz: +(-nz * j).toFixed(2), power: +(-vn).toFixed(2), kick, x: +cx.toFixed(2), z: +cz.toFixed(2) });
			bumpFx(cx, cz, -vn, kick);
			if (kick) {
				K.boostT = 0;
				ctx.notice(`You <b>kicked</b> ${ctx.esc(o.name)}! &#x1F4A5;`);
				addKick();
			}
		});
		// engine
		const sp = Math.hypot(K.vx, K.vz);
		K.engT -= dt;
		if (K.engT <= 0) { ctx.sfx("engine", Math.min(0.35, 0.08 + sp * 0.04)); K.engT = 0.6 - Math.min(0.25, sp * 0.03); }
		m.x = OX + K.x; m.z = OZ + K.z; m.h = K.h;
		m.speed = Math.min(2, sp / 3);
		m.anim = "sit";
		ctx.sendPose();
	}
	function bumpFx(x, z, power, kick) {
		ctx.sfx("bump", Math.min(0.9, 0.3 + power * 0.08));
		burst(x, 0.5, z, kick ? 40 : Math.round(8 + power * 3), kick ? "#ffd166" : "#4cc9f0", kick ? 5 : 2.5 + power * 0.3);
		if (kick) { starRing(x, z); ctx.sfx("crash", 0.35); kickPop.position.set(x, 2.0, z); kickPop.visible = true; kickPop.userData.life = 1.2; }
	}
	const controller = {
		label: "Esc to get out",
		// the chase camera: a bit further back while boosting (a feel of speed)
		get cam() { return { dist: K && K.boostT > 0 ? 5.9 : 5.0, pitch: 0.34 }; },
		drive,
		exit: () => exitKart(false),
		boost
	};

	// ================================================================ every frame
	let boardT = 0, lightT = 0;
	function update(dt, t) {
		const m = me();
		// stale: the kart's gone (stood up, teleported, picked up...) or you're "in a kart" with no kart
		if (K && (m.upper !== "kart" || m.sit || !inZone(m.x, m.z))) exitKart(true);
		if (!K && m.upper === "kart") { m.upper = null; if (m.anim === "sit" && !m.sit) m.anim = "idle"; ctx.sendPose(true); }
		// everyone driving: give each a kart from the pool (yours stays the same while you drive)
		const list = drivingNow();
		const seen = new Set();
		list.forEach(o => {
			seen.add(o.id);
			if (o.mine) return;
			const prev = others.get(o.id);
			if (prev && dt > 0) {
				const ivx = (o.x - prev.x) / dt, ivz = (o.z - prev.z) / dt;
				const a = Math.min(1, dt * 10);
				prev.vx += (clamp(ivx, -15, 15) - prev.vx) * a; prev.vz += (clamp(ivz, -15, 15) - prev.vz) * a;
				prev.x = o.x; prev.z = o.z;
			} else others.set(o.id, { x: o.x, z: o.z, vx: 0, vz: 0, name: (o.p && o.p.look && o.p.look.name) || "someone" });
		});
		others.forEach((o, id) => { if (!seen.has(id)) others.delete(id); });
		karts.forEach(kt => { if (kt.owner && !seen.has(kt.owner)) kt.owner = null; });
		list.forEach(o => {
			let kt = karts.find(q => q.owner === o.id);
			if (!kt) { kt = karts.find(q => !q.owner); if (!kt) return; kt.owner = o.id; kt.setColor(COLORS[hashId(o.id) % COLORS.length]); }
			kt.kg.position.set(o.x, 0, o.z);
			kt.kg.rotation.y = o.h;
			kt.kg.visible = true;
		});
		karts.forEach(kt => { if (!kt.owner) kt.kg.visible = false; else kt.flag.rotation.z = Math.sin(t * 9 + hashId(kt.owner)) * 0.18; });
		// dust behind anyone going fast, flames behind anyone boosting
		const nowS = performance.now() / 1000;
		list.forEach(o => {
			const vx = o.mine ? K.vx : (others.get(o.id) || { vx: 0 }).vx, vz = o.mine ? K.vz : (others.get(o.id) || { vz: 0 }).vz;
			const sp = Math.hypot(vx, vz), bx = o.x - Math.sin(o.h) * 0.85, bz = o.z - Math.cos(o.h) * 0.85;
			const hot = (boosting.get(o.id) || 0) > nowS;
			if (hot) for (let j = 0; j < 2; j++) puff(bx, 0.35, bz, Math.random() < 0.5 ? "#ff9e4a" : "#ffd166", 0.45, -vx * 0.15, -vz * 0.15);
			else if (sp > 2.5 && Math.random() < dt * sp * 2.2) puff(bx, 0.12, bz, "#6e6380", 0.8, -vx * 0.08, -vz * 0.08);
		});
		{
			const pp = pfGeo.attributes.position, pc = pfGeo.attributes.color;
			let any = false;
			for (let i = 0; i < NQ; i++) {
				if (pfLife[i] <= 0) continue;
				any = true;
				pfLife[i] -= dt;
				if (pfLife[i] <= 0) { pp.setXYZ(i, 0, -50, 0); continue; }
				const f = pfLife[i] / pfMax[i];
				pp.setXYZ(i, pp.getX(i) + pfV[i * 3] * dt, pp.getY(i) + pfV[i * 3 + 1] * dt, pp.getZ(i) + pfV[i * 3 + 2] * dt);
				pc.setXYZ(i, pfCol[i * 3] * f, pfCol[i * 3 + 1] * f, pfCol[i * 3 + 2] * f);   // (additive: darker = fainter)
			}
			if (any) { pp.needsUpdate = true; pc.needsUpdate = true; }
		}
		if (kickPop.userData.life > 0) {
			kickPop.userData.life -= dt;
			const u = 1.2 - kickPop.userData.life;
			kickPop.position.y = 2.0 + u * 0.8;
			const sc = u < 0.15 ? u / 0.15 : 1;
			kickPop.scale.set(2.2 * sc, 1.1 * sc, 1);
			kickPop.material.opacity = Math.min(1, kickPop.userData.life * 2);
			if (kickPop.userData.life <= 0) kickPop.visible = false;
		}
		// sparks
		const pos = spGeo.attributes.position;
		let live = false;
		for (let i = 0; i < NP; i++) {
			if (spLife[i] <= 0) continue;
			live = true;
			spLife[i] -= dt;
			if (spLife[i] <= 0) { pos.setXYZ(i, 0, -50, 0); continue; }
			spV[i * 3 + 1] -= 9.8 * dt;
			let y = pos.getY(i) + spV[i * 3 + 1] * dt;
			if (y < 0.02) { y = 0.02; spV[i * 3 + 1] *= -0.3; spV[i * 3] *= 0.6; spV[i * 3 + 2] *= 0.6; }
			pos.setXYZ(i, pos.getX(i) + spV[i * 3] * dt, y, pos.getZ(i) + spV[i * 3 + 2] * dt);
		}
		if (live) pos.needsUpdate = true;
		stars.forEach(s => {
			if (s.life <= 0) return;
			s.life -= dt;
			if (s.life <= 0) { s.m.visible = false; return; }
			s.a += dt * 5;
			s.m.position.set(s.cx + Math.sin(s.a) * 0.7, s.cy + (1.1 - s.life) * 0.6, s.cz + Math.cos(s.a) * 0.7);
			s.m.rotation.y += dt * 8;
			s.m.material.opacity = Math.min(1, s.life * 2);
		});
		// lights
		padMats.forEach((pm, i) => { pm.opacity = 0.55 + 0.45 * Math.sin(t * 6 - i); });
		lightT += dt;
		if (lightT > 0.1) {
			lightT = 0;
			neonM.color.setHSL((t * 0.08) % 1, 0.9, 0.62);
			pylonBall.visible = Math.sin(t * 5) > -0.3;
		}
		parkedKarts.forEach((kg, i) => { kg.position.y = Math.max(0, Math.sin(t * 2 + i) * 0.01); });
		boardT += dt;
		if (boardT > 0.5) { boardT = 0; drawBoard(); }
	}
	drawBoard();

	// ================================================================ getting in
	k.interact("karts:drive", {
		label: () => K ? "Get out of the kart" : "Get in a bumper kart",
		stand: [PIT.x, -0.4], face: Math.PI, reach: 3.2,
		use: () => { if (K) exitKart(false); else getIn(); }
	}, pit);

	return {
		update,
		// world.js drives you while this returns something
		vehicle: () => (K ? controller : null),
		onLeave() { if (K) exitKart(true); },
		onFx(d, p) {
			if (d.what === "boost") { boosting.set(d.id, performance.now() / 1000 + 0.75); return; }
			if (d.what !== "bump") return;
			const x = +d.x || 0, z = +d.z || 0, power = Math.max(0, Math.min(20, +d.power || 0));
			if (d.to === ctx.MY_ID && K) {
				// (both sides can see the same crash: if this side already bounced off them just now, don't take it twice)
				const now = performance.now() / 1000;
				if (now - (K.hits.get(d.id) || 0) > 0.35) { K.vx += clamp(+d.vx || 0, -14, 14); K.vz += clamp(+d.vz || 0, -14, 14); }
				K.hits.set(d.id, now);
				if (d.kick) {
					K.spin = 1.1; K.spinDir = Math.random() < 0.5 ? -1 : 1; K.boostT = 0;
					ctx.notice(`<b>${ctx.esc((p && p.look && p.look.name) || "Someone")}</b> kicked you into a spin! &#x1F4AB;`);
				}
			}
			bumpFx(x, z, power, !!d.kick);
		},
		promptOpts(opts) {
			if (!K) return;
			const free = key => !opts.some(o => o.k === key);
			// (clickable too, for phones: there's no Space key there)
			if (free("E")) opts.push({ k: "E", label: K.cool > 0 ? `Boost (${Math.ceil(K.cool)}s)` : "Boost / ram!", fn: () => boost() });
			if (free("R")) opts.push({ k: "R", label: "Honk!", fn: () => { if (K.honkT <= 0) { ctx.sfx("whistle", 0.5); K.honkT = 0.6; } } });
			if (free("Esc")) opts.push({ k: "Esc", label: "Get out of the kart", fn: () => exitKart(false) });
		}
	};
}
