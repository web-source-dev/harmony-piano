/**
 * Harmony World — the Fun Park: a big amusement park at the south end of the grounds (down the path from the
 * garden's south gate). Outdoors under the night sky, like the pool and the garden.
 *
 * Local coordinates (origin at world 13, -126): x -20.6..20.6, z -18..17.9 (world x -7.6..33.6, z -144..-108.1).
 * The gate from the path to the garden is in the north edge at x 6.1..7.9.
 *
 *   the Moonlight Express: a roller coaster that leaves its station along the south edge, climbs a lift hill and runs
 *     right round the whole estate (up the far west side past the karts, the mansion and the aquarium, a loop behind
 *     the house, back down the east side) and home again. Four cars, two seats each; it boards, leaves and comes back
 *     on a clock, so everyone sees the same train
 *   a Ferris wheel (ten gondolas for two, hop on whichever is at the bottom), a carousel with eight horses,
 *   a drop tower (up 21 m, a pause, and down), a swing ride that spins out and rises as it goes,
 *   the Jolly Roger (a swinging pirate ship), the Teacups (cups that spin on a turning floor round a giant teapot),
 *   the Rainbow Slide (up the ladder, down the wavy chute, round again),
 *   a popcorn cart and a sweets cart, a strength tester with a bell, balloons, benches, lamps, and fireworks.
 *
 * Every ride moves on the wall clock (Date.now), so it is in the same place for everyone without any messages.
 * The Ride Control booth (and R while you ride) sets each ride's speed and whether it runs non-stop; that's a shared
 * key per ride ("parkRide:<id>" = { sp, ns, at, base, ao }): the ride's own time is base + (clock - at) * sp, so a
 * change never makes anything jump, and everyone works it out the same way.
 * Riding is sitting: each ride seat is a sit spot with a ride(pos, quat) function that world.js calls to carry
 * your body along (see placeAvatar); the camera rides with you (F switches between your own eyes and from behind).
 */
const OX = 13.0, OZ = -126.0;                      // = ZONES.park ox / oz
const X0 = -20.6, X1 = 20.6, Z0 = -18.0, Z1 = 17.9;
const GATE = { x0: 6.1, x1: 7.9 };                 // in line with the garden's south gate (world x 19.1..20.9), up the path
const KGATE = { z0: 5.4, z1: 7.0 };                // the gate in the west railing, out to the Bumper Karts (worldKarts.js)
const CAROUSEL = { x: -3.0, z: 7.5, r: 3.6 };
const FW = { x: -12.5, z: -3.0, R: 6.6, hub: 8.7, n: 10 };     // Ferris wheel (turns in the x-y plane)
const DROP = { x: 14.5, z: 9.5, top: 21.0, H: 24.5 };          // drop tower
const SWING = { x: 12.5, z: -5.5, fence: 6.0 };                // swing ride
const ST = { x0: -7.0, x1: 5.0, z0: -15.0, z1: -12.6 };        // the coaster's station platform
const SHIP = { x: -1.4, z: -6.0, pivot: 6.6, arm: 5.4 };       // the pirate ship (swings in the x-y plane)
const TEA = { x: -14.0, z: 9.4, r: 3.0, rc: 1.95, n: 5 };      // the teacups
const BOOTH = { x: 4.6, z: 11.6 };                             // Ride Control
const SPEEDS = [0, 0.5, 1, 1.5, 2, 3];
const GRAV = 9.8;
const EPOCH = 1.7e9;                               // (keeps the clock numbers small)
const TAU = Math.PI * 2;

// everyone's rides run on the wall clock; read once per frame so every rider and car agree
let _ct = -1, _cv = 0;
const clock = () => { const p = performance.now(); if (p - _ct > 8) { _ct = p; _cv = Date.now() / 1000 - EPOCH; } return _cv; };
const smooth = u => u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u);
const mod = (a, n) => ((a % n) + n) % n;

// the coaster's track, in world coordinates [x, y, z], starting where the front car stops in the station and heading
// west (the station is along the park's south edge). Round the estate, outside its paths and clear of every building:
// up the far west side (past the karts, the mansion and the aquarium), behind the house (with the loop), down the east.
// (exported: the grounds keep their trees and lamps out from under it)
export function trackPoints() {
	const pts = [
		[8, 0.2, -141.8], [2, 0.2, -141.8], [-4, 1.2, -141.6], [-11, 4.6, -142.5], [-19, 10, -145.5], [-28, 15.5, -150],
		[-37, 18, -154],                                                // the top of the lift hill (south of the kart arena)
		[-48, 16.5, -157], [-60, 10, -156], [-72, 5, -150], [-80, 4, -138], [-80.5, 3, -124], [-80, 9, -110], [-79, 12, -96],
		[-80, 6, -82], [-79.5, 8.5, -68], [-80, 11, -54], [-79.5, 12, -40], [-79, 8, -27], [-77, 10, -14], [-74, 7, -2],
		[-68, 9.5, 10], [-58, 12, 21], [-44, 10, 28.5], [-26, 6, 31.5], [-9, 2.8, 30.6]   // round the north-west corner, down to the loop
	];
	// the loop (behind the house): a circle in the x-y plane, sliding sideways a little so the way out passes the way in
	const LC = { x: -1, y: 8, r: 5.2 };
	for (let i = 0; i <= 8; i++) { const a = i / 8 * TAU; pts.push([LC.x + LC.r * Math.sin(a), LC.y - LC.r * Math.cos(a), 31 + 3 * i / 8]); }
	pts.push([7, 2.8, 34.4], [15, 6, 34], [25, 12.5, 32], [37, 11, 30.5], [44.5, 8, 21], [45, 4, 8], [44.5, 10.5, -5], [45, 4.5, -19],
		[44, 9, -32], [45, 11, -45], [44.5, 6, -57], [45, 9, -69], [44, 9, -81], [45, 6, -93], [44.5, 8, -105], [44, 7.5, -117],
		[42, 7, -127], [38, 3, -136], [33, 2.0, -140.6], [26, 0.2, -141.8], [17, 0.2, -141.8]);
	return pts;
}
const LOOP_IN = [-9, 2.8, 30.6], LOOP_OUT = [7, 2.8, 34.4];

export function build(k) {
	const { THREE, add, mat, group, rbox, g, ctx, canvasTex, rng } = k;
	const R = rng(2026);
	const ORIGIN = new THREE.Vector3(OX, 0, OZ);
	const Y = new THREE.Vector3(0, 1, 0);
	k.floor(() => 0);
	k.walk(X0 + 0.15, X1 - 0.15, Z0 + 0.15, Z1);
	k.walk(GATE.x0, GATE.x1, Z1 - 1.2, Z1 + 0.9);   // in through the gate from the garden
	k.walk(X0 - 0.8, X0 + 1.2, KGATE.z0, KGATE.z1); // out through the west gate to the karts (their arena starts at X0; past it: no seam)
	k.cam = { minX: X0 - 3, maxX: X1 + 3, minZ: Z0 - 3, maxZ: Z1 + 2, maxY: 16, minY: 0.2 };

	const beam = (parent, a, b, r, m, opt) => {
		const d = new THREE.Vector3().subVectors(b, a), len = d.length();
		const mesh = add(parent, new THREE.CylinderGeometry(r, r, len, 8), m, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2, opt);
		mesh.quaternion.setFromUnitVectors(Y, d.normalize());
		return mesh;
	};
	const glow = c => new THREE.MeshBasicMaterial({ color: c, toneMapped: false });
	const sign = (text, o) => new THREE.MeshBasicMaterial({ map: k.tex.text(text, Object.assign({ w: 1024, h: 256 }, o)), transparent: true, depthWrite: false, toneMapped: false });
	const BULBS = ["#ff4d6d", "#ffd166", "#06d6a0", "#4cc9f0", "#c77dff", "#ff9e4a"];
	const inPark = () => { const m = ctx.me(); return m.x > OX + X0 - 1 && m.x < OX + X1 + 1 && m.z > OZ + Z0 - 1 && m.z < OZ + Z1; };
	const seated = pre => { const s = ctx.me().sit; return !!s && s.indexOf(pre) === 0; };

	// ================================================================ ride settings (shared): speed, non-stop
	const RIDES = [
		{ id: "coaster", name: "Moonlight Express", seat: "coaster", ns: true },
		{ id: "ferris", name: "Ferris Wheel", seat: "ferris" },
		{ id: "carousel", name: "Carousel", seat: "carousel" },
		{ id: "drop", name: "Sky Drop", seat: "drop", ns: true },
		{ id: "swing", name: "Star Swings", seat: "starSwing", ns: true },
		{ id: "ship", name: "Jolly Roger", seat: "ship", ns: true },
		{ id: "cups", name: "Teacups", seat: "teacup" },
		{ id: "slide", name: "Rainbow Slide", seat: "slide" }
	];
	const DEF_CFG = { sp: 1, ns: false, at: 0, base: 0, ao: 0 };
	const cfgOf = id => { const c = ctx.get("parkRide:" + id); return c && typeof c === "object" ? c : DEF_CFG; };
	const spOf = c => { const v = +c.sp; return isFinite(v) ? Math.max(0, Math.min(3, v)) : 1; };
	// the ride's own clock (in "normal speed" seconds)
	const rideT = id => { const c = cfgOf(id); return (+c.base || 0) + (clock() - (+c.at || 0)) * spOf(c); };
	// seconds of ride time -> seconds you actually wait
	const waitS = (x, id) => { const sp = spOf(cfgOf(id)); return sp > 0 ? Math.max(1, Math.ceil(x / sp)) : "--"; };
	// for a moment after a change, things that can't follow it exactly (how far the swings fly out, how high the
	// ship swings) ease from where the old setting had them: 0 = all old, 1 = all new
	const easeIn = c => c.pv && typeof c.pv === "object" ? smooth((clock() - (+c.at || 0)) / 1.6) : 1;
	const oldT = c => (+c.pv.base || 0) + (clock() - (+c.pv.at || 0)) * spOf(c.pv);
	const myRide = () => { const s = ctx.me().sit; return s ? RIDES.find(r => s.indexOf(r.seat) === 0) : null; };
	// switching non-stop on or off: where the ride is in its run under the new rule (filled in by each ride below),
	// so it carries on from where it is instead of jumping
	const REMAP = {};
	const ANGLE = {};   // (rides whose spin angle depends on the rule too: keep it the same across the switch)
	function setRide(id, patch) {
		const c = cfgOf(id), tau = rideT(id), now = clock();
		const nc = { sp: spOf(c), ns: !!c.ns, at: now, base: tau, ao: +c.ao || 0, by: (ctx.profile() && ctx.profile().name) || "" };
		nc.pv = { sp: spOf(c), ns: !!c.ns, at: +c.at || 0, base: +c.base || 0, ao: +c.ao || 0 };   // (the old setting, to ease from)
		Object.assign(nc, patch);
		if (nc.ns !== !!c.ns && REMAP[id]) {
			const a0 = ANGLE[id] ? ANGLE[id](c, tau) : 0;
			nc.base = REMAP[id](tau, nc.ns);
			if (ANGLE[id]) { nc.ao = 0; nc.ao = a0 - ANGLE[id](nc, nc.base); }
		}
		ctx.setShared("parkRide:" + id, nc);
		ctx.sfx("switch", 0.5);
	}

	// ================================================================ the ground, the railing round the edge
	const pavers = canvasTex(512, 512, (c, w, h) => {
		c.fillStyle = "#6d6470"; c.fillRect(0, 0, w, h);
		const r = rng(31);
		for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) {
			const t = 120 + r() * 26;
			c.fillStyle = `rgb(${t + 14},${t},${t + 10})`;
			c.fillRect(i * 64 + (j % 2) * 32 + 2, j * 64 + 2, 60, 60);
			for (let n = 0; n < 40; n++) { c.fillStyle = `rgba(0,0,0,${r() * 0.12})`; c.fillRect(i * 64 + (j % 2) * 32 + r() * 60, j * 64 + r() * 60, 2, 2); }
		}
	}, (X1 - X0) / 2.5, (Z1 - Z0) / 2.5);
	const ground = add(g, new THREE.PlaneGeometry(X1 - X0, Z1 - Z0), mat("#ffffff", 0.9, 0, { map: pavers }), (X0 + X1) / 2, 0, (Z0 + Z1) / 2, { rx: -Math.PI / 2, cast: false });
	ground.userData.floor = true;
	// colourful pads under the rides
	const pad = (x, z, r, col, ring) => {
		add(g, new THREE.CircleGeometry(r, 48), mat(col, 0.8), x, 0.006, z, { rx: -Math.PI / 2, cast: false }).userData.floor = true;
		add(g, new THREE.RingGeometry(r - 0.18, r, 48), mat(ring, 0.6), x, 0.009, z, { rx: -Math.PI / 2, cast: false });
	};
	pad(CAROUSEL.x, CAROUSEL.z, CAROUSEL.r + 0.7, "#7a3b69", "#ffd166");
	pad(SWING.x, SWING.z, SWING.fence + 0.2, "#2f4b7c", "#4cc9f0");
	pad(DROP.x, DROP.z, 2.6, "#5c2a4a", "#ff4d6d");
	pad(FW.x, FW.z, 4.4, "#3d5a4a", "#06d6a0");
	// the path from the gate
	add(g, new THREE.PlaneGeometry(GATE.x1 - GATE.x0 + 1.2, 6), mat("#b5577b", 0.85), (GATE.x0 + GATE.x1) / 2, 0.005, Z1 - 3, { rx: -Math.PI / 2, cast: false });
	// the edge and a glass railing all round (the north side has the gate in it, at the end of the path from the garden)
	const edgeM = mat("#5b4636", 0.8);
	add(g, new THREE.BoxGeometry(X1 - X0, 0.3, 0.1), edgeM, 0, -0.15, Z0 - 0.02);
	add(g, new THREE.BoxGeometry(0.1, 0.3, Z1 - Z0), edgeM, X0 - 0.02, -0.15, (Z0 + Z1) / 2);
	add(g, new THREE.BoxGeometry(0.1, 0.3, Z1 - Z0), edgeM, X1 + 0.02, -0.15, (Z0 + Z1) / 2);
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
		for (let i = 0; i <= n; i++) add(rg, new THREE.BoxGeometry(0.06, 1.05, 0.06), postM, 0, 0.525, -len / 2 + (len * i) / n, { cast: false });
	};
	railRun(X0 + 0.05, Z0 + 0.05, X1 - 0.05, Z0 + 0.05);
	railRun(X0 + 0.05, Z0 + 0.05, X0 + 0.05, KGATE.z0);
	railRun(X0 + 0.05, KGATE.z1, X0 + 0.05, Z1 - 0.05);
	railRun(X1 - 0.05, Z0 + 0.05, X1 - 0.05, Z1 - 0.05);
	railRun(X0 + 0.05, Z1 - 0.05, GATE.x0, Z1 - 0.05);
	railRun(GATE.x1, Z1 - 0.05, X1 - 0.05, Z1 - 0.05);
	k.box(X0, GATE.x0, Z1 - 0.15, Z1);
	k.box(GATE.x1, X1, Z1 - 0.15, Z1);
	k.box(X0, X1, Z0, Z0 + 0.15);
	k.box(X0, X0 + 0.15, Z0, KGATE.z0);
	k.box(X0, X0 + 0.15, KGATE.z1, Z1);
	// a signpost by the west gate
	{
		const sg = group(g, X0 + 0.35, 0, KGATE.z1 + 0.35, Math.PI / 2);
		add(sg, new THREE.CylinderGeometry(0.03, 0.03, 1.2, 8), mat("#5b4636", 0.7), 0, 0.6, 0);
		add(sg, rbox(0.82, 0.24, 0.04, 0.02), mat("#e63973", 0.6), 0, 1.22, 0);
		add(sg, new THREE.PlaneGeometry(0.76, 0.18), sign("Bumper Karts", { w: 512, h: 128, color: "#fff4d6", font: "800 70px 'Caveat', 'Nunito', cursive" }), 0, 1.22, 0.025, { cast: false, receive: false });
		add(sg, new THREE.PlaneGeometry(0.76, 0.18), sign("Fun Park", { w: 512, h: 128, color: "#fff4d6", font: "800 80px 'Caveat', 'Nunito', cursive" }), 0, 1.22, -0.025, { ry: Math.PI, cast: false, receive: false });
		k.box(X0 + 0.28, X0 + 0.42, KGATE.z1 + 0.28, KGATE.z1 + 0.42);
	}
	k.box(X1 - 0.15, X1, Z0, Z1);

	// ================================================================ the entrance arch
	{
		const ag = group(g, (GATE.x0 + GATE.x1) / 2, 0, Z1 - 1.6);
		const stripe = canvasTex(64, 256, (c, w, h) => { for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? "#fff4e6" : "#e63973"; c.fillRect(0, i * h / 8, w, h / 8 + 1); } });
		for (const sx of [-2.3, 2.3]) {
			add(ag, new THREE.CylinderGeometry(0.22, 0.26, 4.2, 16), mat("#ffffff", 0.5, 0, { map: stripe }), sx, 2.1, 0);
			add(ag, new THREE.SphereGeometry(0.34, 16, 12), mat("#ffd166", 0.3, 0.4), sx, 4.45, 0);
			const px = (GATE.x0 + GATE.x1) / 2 + sx;
			k.box(px - 0.3, px + 0.3, Z1 - 1.9, Z1 - 1.3);
		}
		add(ag, rbox(5.4, 1.0, 0.24, 0.1), mat("#2b1d3a", 0.6), 0, 4.3, 0);
		add(ag, new THREE.PlaneGeometry(5.0, 1.25), sign("Harmony Fun Park", { color: "#ffe9a8", glow: "#ff4d6d", font: "800 128px 'Caveat', 'Nunito', cursive" }), 0, 4.32, 0.13, { cast: false, receive: false });
		add(ag, new THREE.PlaneGeometry(5.0, 1.25), sign("Harmony Fun Park", { color: "#ffe9a8", glow: "#ff4d6d", font: "800 128px 'Caveat', 'Nunito', cursive" }), 0, 4.32, -0.13, { ry: Math.PI, cast: false, receive: false });
		// a row of bulbs along the top and bottom of the sign
		const archBulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.06, 8, 6), glow("#ffffff"), 44);
		const d = new THREE.Object3D(), col = new THREE.Color();
		for (let i = 0; i < 22; i++) for (let j = 0; j < 2; j++) {
			d.position.set(-2.6 + i / 21 * 5.2, j ? 4.83 : 3.77, 0.14); d.updateMatrix();
			archBulbs.setMatrixAt(i * 2 + j, d.matrix); archBulbs.setColorAt(i * 2 + j, col.set(BULBS[i % BULBS.length]));
		}
		archBulbs.castShadow = false;
		ag.add(archBulbs);
		var archLights = archBulbs;
	}

	// ================================================================ the roller coaster: the Moonlight Express
	const curve = new THREE.CatmullRomCurve3(trackPoints().map(([x, y, z]) => new THREE.Vector3(x - OX, y, z - OZ)), true, "centripetal");
	curve.arcLengthDivisions = 6000;
	const L = curve.getLength();
	const N = Math.ceil(L / 0.25), DS = L / N;
	const P = [], T = [], U = [];
	for (let i = 0; i < N; i++) { P.push(curve.getPointAt(i / N)); T.push(curve.getTangentAt(i / N).normalize()); }
	const nearest = w => { const v = new THREE.Vector3(w[0] - OX, w[1], w[2] - OZ); let bi = 0, bd = 1e9; P.forEach((p, i) => { const d = p.distanceToSquared(v); if (d < bd) { bd = d; bi = i; } }); return bi; };
	// how fast it goes: rolled out of the station and up the lift hill on the chain, then gravity (and a little friction),
	// never slower than a crawl (boosters), and brakes for the last stretch into the station
	let iCrest = 0;
	P.forEach((p, i) => { if (p.y > P[iCrest].y) iCrest = i; });
	const sCrest = iCrest * DS, yCrest = P[iCrest].y, vLift = 3.2;
	const V = new Float32Array(N);
	for (let i = 0; i < N; i++) {
		const s = i * DS, rem = L - s;
		let v = i <= iCrest ? Math.min(vLift, 0.9 + s * 0.45) : Math.sqrt(Math.max(9, vLift * vLift + 2 * GRAV * (yCrest - P[i].y) - 2 * 0.008 * GRAV * (s - sCrest)));
		if (rem < 50) v = Math.min(v, 1.2 + rem * 0.22);
		if (rem < 6) v = Math.min(v, 0.5 + rem * 0.12);
		V[i] = v;
	}
	// time along the track (so a time in the ride gives a place on the track)
	const TC = new Float64Array(N + 1);
	for (let i = 1; i <= N; i++) TC[i] = TC[i - 1] + DS / ((V[i - 1] + V[i % N]) / 2);
	const RIDE = TC[N], DWELL = 16, CYCLE = DWELL + RIDE;
	const sAtTime = tau => {
		if (tau <= 0) return 0;
		if (tau >= RIDE) return 0;
		let lo = 0, hi = N;
		while (hi - lo > 1) { const m = (lo + hi) >> 1; if (TC[m] <= tau) lo = m; else hi = m; }
		return (lo + (tau - TC[lo]) / (TC[lo + 1] - TC[lo])) * DS;
	};
	// which way is up: level on the flat (banked into the turns, as hard as the speed asks for), and carried
	// smoothly round the loop (parallel transport), so the cars go upside down at the top
	const iLoopA = nearest(LOOP_IN) + 12, iLoopB = nearest(LOOP_OUT) - 12;
	const bank = new Float32Array(N);
	for (let i = 0; i < N; i++) {
		const a = T[(i - 4 + N) % N], b = T[(i + 4) % N];
		const kx = (b.x - a.x) / (8 * DS), kz = (b.z - a.z) / (8 * DS);
		const up0 = Y.clone().addScaledVector(T[i], -T[i].y).normalize();
		const lat = new THREE.Vector3().crossVectors(up0, T[i]).normalize();
		const side = kx * lat.x + kz * lat.z;
		bank[i] = Math.max(-0.9, Math.min(0.9, Math.atan(V[i] * V[i] * side / GRAV) * 0.8));
	}
	const bankS = new Float32Array(N);
	for (let i = 0; i < N; i++) { let s = 0; for (let j = -12; j <= 12; j++) s += bank[(i + j + N) % N]; bankS[i] = s / 25; }
	const upright = i => {
		const up = Y.clone().addScaledVector(T[i], -T[i].y).normalize();
		const lat = new THREE.Vector3().crossVectors(up, T[i]).normalize();
		return up.multiplyScalar(Math.cos(bankS[i])).addScaledVector(lat, Math.sin(bankS[i])).normalize();
	};
	for (let i = 0; i < N; i++) U.push(upright(i));
	{
		const q = new THREE.Quaternion();
		let up = U[iLoopA].clone();
		for (let i = iLoopA + 1; i < iLoopB + 40; i++) {
			q.setFromUnitVectors(T[i - 1], T[i]);
			up.applyQuaternion(q).addScaledVector(T[i], -up.dot(T[i])).normalize();
			if (i <= iLoopB) U[i] = up.clone();
			else { const w = (i - iLoopB) / 40; U[i] = up.clone().lerp(upright(i), w); U[i].addScaledVector(T[i], -U[i].dot(T[i])).normalize(); }
		}
	}
	// a place and a turn on the track at distance s (local coordinates)
	const _t = new THREE.Vector3(), _u = new THREE.Vector3(), _x = new THREE.Vector3(), _m = new THREE.Matrix4();
	function frameAt(s, pos, quat) {
		s = ((s % L) + L) % L;
		const fi = s / DS, i = Math.floor(fi) % N, j = (i + 1) % N, f = fi - Math.floor(fi);
		pos.lerpVectors(P[i], P[j], f);
		_t.lerpVectors(T[i], T[j], f).normalize();
		_u.lerpVectors(U[i], U[j], f);
		_u.addScaledVector(_t, -_u.dot(_t)).normalize();
		_x.crossVectors(_u, _t);
		_m.makeBasis(_x, _u, _t);
		quat.setFromRotationMatrix(_m);
	}
	// where the train is: in the station for DWELL seconds (boarding), then once round
	// (non-stop: it rolls straight through the station and round again)
	const coaster = () => {
		const c = cfgOf("coaster"), tau = rideT("coaster"), ns = !!c.ns;
		const ph = ns ? DWELL + mod(tau, RIDE) : mod(tau, CYCLE);
		return { ph, ns, sp: spOf(c), boarding: !ns && ph < DWELL, s: ph < DWELL ? 0 : sAtTime(ph - DWELL), left: ph < DWELL ? DWELL - ph : CYCLE - ph };
	};
	REMAP.coaster = (tau, ns) => { if (ns) { const ph = mod(tau, CYCLE); return ph < DWELL ? 0 : ph - DWELL; } return DWELL + mod(tau, RIDE); };
	const CARS = 4, GAP = 2.25;
	const carPose = (c, pos, quat) => frameAt(coaster().s - c * GAP, pos, quat);

	// ---------------- the track itself: two rails, a spine underneath, sleepers, supports, and lights along it
	{
		const railPts = [[], []], spine = [];
		const lat = new THREE.Vector3();
		for (let i = 0; i < N; i += 4) {
			lat.crossVectors(U[i], T[i]).normalize();
			railPts[0].push(P[i].clone().addScaledVector(lat, 0.42));
			railPts[1].push(P[i].clone().addScaledVector(lat, -0.42));
			spine.push(P[i].clone().addScaledVector(U[i], -0.3));
		}
		const steel = mat("#d9dde3", 0.25, 0.85), spineM = mat("#e63973", 0.45, 0.3);
		for (const pts of railPts) add(g, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), pts.length * 2, 0.055, 6, true), steel, 0, 0, 0, { cast: false });
		add(g, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(spine, true), spine.length * 2, 0.14, 8, true), spineM, 0, 0, 0, { cast: false });
		// sleepers
		const nT = Math.floor(N / 4);
		const ties = new THREE.InstancedMesh(new THREE.BoxGeometry(0.98, 0.07, 0.16), mat("#4a4a58", 0.6, 0.4), nT);
		const d = new THREE.Object3D(), p = new THREE.Vector3(), q = new THREE.Quaternion();
		for (let n = 0; n < nT; n++) {
			frameAt(n * 4 * DS, p, q);
			d.position.copy(p).addScaledVector(_u, -0.12); d.quaternion.copy(q); d.scale.set(1, 1, 1); d.updateMatrix();
			ties.setMatrixAt(n, d.matrix);
		}
		ties.castShadow = false;
		g.add(ties);
		// supports: tall steel columns down into the lawn (short posts in the park, where it runs low); solid to walk into
		const cols = [];
		for (let i = 0; i < N; i += 8) {
			const pp = P[i], inPark = pp.x > X0 - 0.5 && pp.x < X1 + 0.5 && pp.z > Z0 - 0.5 && pp.z < Z1;
			if (U[i].y < 0.75) continue;                         // (not under the top of the loop)
			if (!inPark && i % 24) continue;                     // (out there, one every 6 m is plenty)
			if (inPark && pp.y < 0.35) continue;
			const top = pp.clone().addScaledVector(U[i], -0.38), base = inPark ? 0 : -24;
			if (top.y - base < 0.3) continue;
			cols.push([top.x, base, top.z, top.y - base]);
			k.box(top.x - 0.2, top.x + 0.2, top.z - 0.2, top.z + 0.2);
		}
		const sup = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 10), mat("#efe7f5", 0.4, 0.5), cols.length);
		cols.forEach(([x, y0, z, h], n) => { d.position.set(x, y0 + h / 2, z); d.quaternion.identity(); d.scale.set(0.15, h, 0.15); d.updateMatrix(); sup.setMatrixAt(n, d.matrix); });
		sup.castShadow = false;
		g.add(sup);
		// little lights along both rails (they chase round the track)
		const nL = Math.floor(N / 10);
		var trackLights = new THREE.InstancedMesh(new THREE.SphereGeometry(0.055, 8, 6), glow("#ffffff"), nL * 2);
		for (let n = 0; n < nL; n++) {
			const i = n * 10;
			lat.crossVectors(U[i], T[i]).normalize();
			for (let sdx = 0; sdx < 2; sdx++) {
				d.position.copy(P[i]).addScaledVector(lat, sdx ? -0.52 : 0.52).addScaledVector(U[i], -0.02); d.quaternion.identity(); d.scale.set(1, 1, 1); d.updateMatrix();
				trackLights.setMatrixAt(n * 2 + sdx, d.matrix);
				trackLights.setColorAt(n * 2 + sdx, new THREE.Color().setHSL((n / nL * 6) % 1, 1, 0.6));
			}
		}
		trackLights.castShadow = false;
		g.add(trackLights);
		var trackLightN = nL;
		// it can't be walked through where it runs low through the park (blocked in strips, merged per row)
		const cells = new Map();
		for (let i = 0; i < N; i++) {
			const pp = P[i];
			if (pp.y > 3.4 || pp.x < X0 - 1 || pp.x > X1 + 1 || pp.z < Z0 - 1 || pp.z > Z1 + 1) continue;
			for (const dx of [-0.75, 0, 0.75]) for (const dz of [-0.75, 0, 0.75]) {
				const cx = Math.floor((pp.x + dx) / 0.5), cz = Math.floor((pp.z + dz) / 0.5);
				if (!cells.has(cz)) cells.set(cz, new Set());
				cells.get(cz).add(cx);
			}
		}
		cells.forEach((xs, cz) => {
			const sorted = [...xs].sort((a, b) => a - b);
			let a = sorted[0], b = a;
			for (let n = 1; n <= sorted.length; n++) {
				if (n < sorted.length && sorted[n] === b + 1) { b = sorted[n]; continue; }
				k.box(a * 0.5, (b + 1) * 0.5, cz * 0.5, (cz + 1) * 0.5);
				if (n < sorted.length) { a = b = sorted[n]; }
			}
		});
	}

	// ---------------- the train: four cars, two seats in each
	const carCols = ["#ff4d6d", "#ffd166", "#4cc9f0", "#c77dff"];
	const cars = [];
	const chrome = mat("#e3e7ea", 0.15, 1), dark = mat("#26232c", 0.6, 0.3), cushion = mat("#3a2f4a", 0.85);
	for (let c = 0; c < CARS; c++) {
		const cg = group(g, 0, 0, 0);
		const body = mat(carCols[c], 0.35, 0.25);
		add(cg, new THREE.BoxGeometry(1.0, 0.14, 1.6), dark, 0, 0.1, 0);
		for (const sx of [-0.42, 0.42]) for (const sz of [-0.6, 0.6]) add(cg, new THREE.CylinderGeometry(0.09, 0.09, 0.08, 12), dark, sx, 0.08, sz, { rz: Math.PI / 2, cast: false });
		add(cg, rbox(1.3, 0.34, 2.0, 0.1), body, 0, 0.36, 0);                     // the tub
		add(cg, rbox(1.3, 0.5, 0.62, 0.14), body, 0, 0.66, 0.68);                 // the cowl in front of your legs
		for (const sx of [-0.62, 0.62]) add(cg, rbox(0.08, 0.32, 1.36, 0.03), body, sx, 0.66, -0.25);
		add(cg, rbox(1.1, 0.1, 0.6, 0.04), cushion, 0, 0.58, -0.08);              // the seat
		add(cg, rbox(1.16, 0.62, 0.12, 0.05), body, 0, 0.92, -0.46, { rx: -0.12 }); // the seat back
		add(cg, rbox(1.08, 0.5, 0.06, 0.03), cushion, 0, 0.94, -0.39, { rx: -0.12 });
		add(cg, new THREE.CylinderGeometry(0.03, 0.03, 1.0, 8), chrome, 0, 0.98, 0.28, { rz: Math.PI / 2 });   // lap bar
		for (const sx of [-0.45, 0.45]) add(cg, new THREE.CylinderGeometry(0.025, 0.025, 0.36, 8), chrome, sx, 0.82, 0.32, { rx: 0.5 });
		if (c === 0) {
			add(cg, rbox(1.26, 0.52, 0.6, 0.2), body, 0, 0.5, 1.2);
			for (const sx of [-0.38, 0.38]) add(cg, new THREE.CircleGeometry(0.09, 16), glow("#fff6d8"), sx, 0.56, 1.505, { cast: false, receive: false });
			add(cg, new THREE.PlaneGeometry(0.9, 0.22), sign("Moonlight", { w: 512, h: 128, color: "#ffffff", font: "800 84px 'Caveat', 'Nunito', cursive" }), 0, 0.82, 0.995, { cast: false, receive: false });
		}
		if (c === CARS - 1) for (const sx of [-0.4, 0.4]) add(cg, new THREE.CircleGeometry(0.06, 12), glow("#ff3355"), sx, 0.4, -1.005, { ry: Math.PI, cast: false, receive: false });
		cars.push(cg);
	}
	// the seats (sit spots that ride along): where they are while the train is in the station
	const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _o = new THREE.Vector3();
	const LOOK_TIP = "Drag (or use the arrow keys) to look all round, <b>F</b> switches the view, <b>R</b> for ride controls, <b>G</b> hands up.";
	const coasterIds = [];
	for (let c = 0; c < CARS; c++) for (let side = 0; side < 2; side++) {
		const id = "coaster" + c + side, off = new THREE.Vector3(side ? -0.3 : 0.3, 0.17, -0.08);
		frameAt(-c * GAP, _p, _q);
		_o.copy(off).applyQuaternion(_q).add(_p);
		k.spot({ id, x: _o.x, z: _o.z, y: 0, h: -Math.PI / 2, pov: true, ride: (pos, quat) => { carPose(c, _p, _q); pos.copy(off).applyQuaternion(_q).add(_p).add(ORIGIN); quat.copy(_q); } });
		coasterIds.push(id);
	}

	// ---------------- the station: a platform under a canopy, with the coaster's name in lights
	{
		const sg = group(g, 0, 0, 0);
		const plat = add(sg, new THREE.BoxGeometry(ST.x1 - ST.x0, 0.04, ST.z1 - ST.z0), mat("#8f8496", 0.8), (ST.x0 + ST.x1) / 2, 0.02, (ST.z0 + ST.z1) / 2, { cast: false });
		plat.userData.floor = true;
		add(sg, new THREE.BoxGeometry(ST.x1 - ST.x0, 0.045, 0.22), mat("#ffd166", 0.6), (ST.x0 + ST.x1) / 2, 0.025, ST.z0 + 0.12, { cast: false });
		const roofM = mat("#2b1d3a", 0.7), postMt = mat("#f4efe8", 0.5);
		for (const x of [ST.x0 + 0.3, (ST.x0 + ST.x1) / 2, ST.x1 - 0.3]) {
			add(sg, new THREE.CylinderGeometry(0.1, 0.12, 3.4, 12), postMt, x, 1.7, ST.z1 - 0.25);
			k.box(x - 0.15, x + 0.15, ST.z1 - 0.4, ST.z1 - 0.1);
		}
		// (the roof reaches out over the track on the far side; the train runs underneath)
		add(sg, new THREE.BoxGeometry(ST.x1 - ST.x0 + 0.6, 0.18, 5.0), roofM, (ST.x0 + ST.x1) / 2, 3.45, -15.2);
		const awn = canvasTex(256, 64, (c, w, h) => { for (let i = 0; i < 16; i++) { c.fillStyle = i % 2 ? "#fff4e6" : "#4cc9f0"; c.fillRect(i * w / 16, 0, w / 16 + 1, h); } });
		add(sg, new THREE.PlaneGeometry(ST.x1 - ST.x0 + 0.6, 0.45), mat("#ffffff", 0.8, 0, { map: awn, side: THREE.DoubleSide }), (ST.x0 + ST.x1) / 2, 3.15, -12.69, { cast: false });
		add(sg, rbox(5.6, 1.0, 0.2, 0.08), roofM, (ST.x0 + ST.x1) / 2, 4.15, -12.75);
		add(sg, new THREE.PlaneGeometry(5.4, 1.35), sign("Moonlight Express", { color: "#d8ecff", glow: "#4cc9f0", font: "800 120px 'Caveat', 'Nunito', cursive" }), (ST.x0 + ST.x1) / 2, 4.17, -12.64, { cast: false, receive: false });
		// a board on the platform with the countdown
		const boardC = document.createElement("canvas"); boardC.width = 512; boardC.height = 256;
		var boardTex = new THREE.CanvasTexture(boardC); boardTex.colorSpace = THREE.SRGBColorSpace;
		const bd = group(sg, ST.x0 + 0.9, 0, ST.z1 - 0.6, 0);
		add(bd, new THREE.CylinderGeometry(0.04, 0.04, 1.5, 8), dark, 0, 0.75, 0);
		add(bd, rbox(1.1, 0.6, 0.06, 0.03), dark, 0, 1.6, 0);
		add(bd, new THREE.PlaneGeometry(1.0, 0.5), new THREE.MeshBasicMaterial({ map: boardTex, toneMapped: false }), 0, 1.6, 0.035, { cast: false, receive: false });
		k.box(ST.x0 + 0.75, ST.x0 + 1.05, ST.z1 - 0.75, ST.z1 - 0.45);
		var drawBoard = (txt, sub) => {
			const c = boardC.getContext("2d");
			c.fillStyle = "#130f1c"; c.fillRect(0, 0, 512, 256);
			c.fillStyle = "#ffd166"; c.font = "800 64px Nunito, 'Segoe UI', sans-serif"; c.textAlign = "center"; c.textBaseline = "middle";
			c.fillText(txt, 256, 100);
			c.fillStyle = "#b9adc9"; c.font = "700 36px Nunito, 'Segoe UI', sans-serif";
			c.fillText(sub, 256, 186);
			boardTex.needsUpdate = true;
		};
		// the turnstile you click to board
		const ts = group(sg, -1.0, 0, ST.z1 - 0.9);
		add(ts, rbox(0.3, 0.9, 0.3, 0.05), mat("#c2366b", 0.5), 0, 0.45, 0);
		for (let i = 0; i < 3; i++) add(ts, new THREE.CylinderGeometry(0.025, 0.025, 0.6, 8), chrome, Math.cos(i * 2.1) * 0.3, 0.85, Math.sin(i * 2.1) * 0.3, { rz: Math.PI / 2, ry: -i * 2.1 });
		k.box(-1.2, -0.8, ST.z1 - 1.1, ST.z1 - 0.7);
		k.interact("park:coaster", {
			label: () => { const C = coaster(); return C.boarding || C.ns || !C.sp ? "Ride the Moonlight Express" : `The coaster is out on the track - back in ${waitS(C.left, "coaster")}s`; },
			stand: [-1.6, -13.7], face: Math.PI, reach: 2.6,
			use: () => {
				const C = coaster();
				if (C.ns || !C.sp) { if (ctx.sitOn(coasterIds)) ctx.notice(`The coaster is ${C.ns ? "running non-stop" : "stopped"} - you hop on board! ${LOOK_TIP}`); return; }
				if (!C.boarding || C.left < 1.5) { ctx.notice(`The train is out round the house - it's back in <b>${waitS(C.left + (C.boarding ? CYCLE - DWELL : 0), "coaster")}s</b>. Wait on the platform, or make it non-stop at Ride Control!`); return; }
				if (ctx.sitOn(coasterIds)) ctx.notice(`Buckle up! The train leaves in <b>${waitS(C.left, "coaster")}s</b>. ${LOOK_TIP}`);
			}
		}, ts, ...cars);
	}

	// ================================================================ the Ferris wheel
	const fwG = group(g, FW.x, 0, FW.z);
	const fwWheel = group(fwG, 0, FW.hub, 0);
	const fwGond = [];
	const fwIds = [];
	const FW_W = TAU / 80;   // once round every 80 seconds
	const fwAngle = () => (rideT("ferris") * FW_W) % TAU;
	{
		const frameM = mat("#f4efe8", 0.45, 0.3);
		for (const sz of [-1, 1]) for (const sx of [-1, 1]) beam(fwG, new THREE.Vector3(sx * 3.4, 0, sz * 1.7), new THREE.Vector3(0, FW.hub, sz * 1.15), 0.14, frameM);
		for (const sz of [-1, 1]) beam(fwG, new THREE.Vector3(-3.4, 0.3, sz * 1.7), new THREE.Vector3(3.4, 0.3, sz * 1.7), 0.08, frameM);
		add(fwG, new THREE.CylinderGeometry(0.2, 0.2, 2.6, 16), chrome, 0, FW.hub, 0, { rx: Math.PI / 2 });
		const rimM = mat("#ff7aa2", 0.4, 0.3), spokeM = mat("#fbe9f0", 0.5, 0.3);
		for (const sz of [-0.85, 0.85]) {
			add(fwWheel, new THREE.TorusGeometry(FW.R, 0.08, 8, 80), rimM, 0, 0, sz, { cast: false });
			add(fwWheel, new THREE.TorusGeometry(FW.R * 0.62, 0.05, 6, 60), rimM, 0, 0, sz, { cast: false });
			for (let i = 0; i < 20; i++) { const a = i / 20 * TAU; beam(fwWheel, new THREE.Vector3(0, 0, sz * 0.6), new THREE.Vector3(Math.sin(a) * FW.R, -Math.cos(a) * FW.R, sz), 0.03, spokeM, { cast: false }); }
		}
		// a glowing heart on the hub, both sides
		for (const sz of [-1, 1]) {
			const h = add(fwWheel, new THREE.ExtrudeGeometry(k.heartShape(0.5), { depth: 0.08, bevelEnabled: false }), new THREE.MeshStandardMaterial({ color: "#ff8fab", emissive: "#ff4d6d", emissiveIntensity: 1.8 }), 0, 0, sz * 1.12, { cast: false });
			h.geometry.center(); h.rotation.z = Math.PI;
		}
		// bulbs all round both rims (they light up in turn)
		var fwBulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.07, 8, 6), glow("#ffffff"), 120);
		const d = new THREE.Object3D();
		for (let i = 0; i < 60; i++) for (let j = 0; j < 2; j++) {
			const a = i / 60 * TAU;
			d.position.set(Math.sin(a) * (FW.R + 0.12), -Math.cos(a) * (FW.R + 0.12), j ? 0.85 : -0.85); d.updateMatrix();
			fwBulbs.setMatrixAt(i * 2 + j, d.matrix); fwBulbs.setColorAt(i * 2 + j, new THREE.Color("#ffffff"));
		}
		fwBulbs.castShadow = false;
		fwWheel.add(fwBulbs);
		// the gondolas: they hang from pins between the rims and stay level
		const gCols = ["#ff4d6d", "#ffd166", "#06d6a0", "#4cc9f0", "#c77dff"];
		for (let i = 0; i < FW.n; i++) {
			const gg = group(fwG, 0, 0, 0);
			const gm = mat(gCols[i % gCols.length], 0.4, 0.2);
			beam(gg, new THREE.Vector3(0, 0, -0.85), new THREE.Vector3(0, 0, 0.85), 0.04, chrome);
			for (const sx of [-0.5, 0.5]) beam(gg, new THREE.Vector3(0, 0, 0), new THREE.Vector3(sx, -0.45, 0), 0.025, chrome, { cast: false });
			add(gg, new THREE.SphereGeometry(0.78, 20, 10, 0, TAU, 0, Math.PI / 2), gm, 0, -0.5, 0, { cast: false });   // the roof
			add(gg, rbox(1.35, 0.08, 1.1, 0.03), dark, 0, -1.55, 0);                                                // the floor
			add(gg, rbox(1.35, 0.5, 0.06, 0.03), gm, 0, -1.28, 0.53);
			add(gg, rbox(1.35, 0.5, 0.06, 0.03), gm, 0, -1.28, -0.53);
			for (const sx of [-0.66, 0.66]) { add(gg, rbox(0.06, 0.5, 1.1, 0.03), gm, sx, -1.28, 0); for (const sz of [-0.5, 0.5]) add(gg, new THREE.CylinderGeometry(0.02, 0.02, 1.0, 6), chrome, sx, -1.0, sz, { cast: false }); }
			add(gg, rbox(1.2, 0.08, 0.45, 0.03), cushion, 0, -1.17, -0.25);   // the bench seat (you face out, toward the park)
			add(gg, new THREE.SphereGeometry(0.06, 10, 8), glow("#fff1d0"), 0, -0.55, 0, { cast: false });
			fwGond.push(gg);
			// each gondola's seats sit apart from the others' on the ground (so nobody is "next to" someone in another gondola)
			const gx = FW.x - 4.2 + (i % 5) * 2.1, gz = FW.z + 2.8 + Math.floor(i / 5) * 2.1;
			for (let s = 0; s < 2; s++) {
				const id = "ferris" + i + s, dx = s ? 0.28 : -0.28;
				k.spot({ id, x: gx + dx, z: gz, y: 0, h: 0, ride: (pos, quat) => {
					const a = fwAngle() + i / FW.n * TAU;
					pos.set(OX + FW.x + Math.sin(a) * FW.R + dx, FW.hub - Math.cos(a) * FW.R - 1.62, OZ + FW.z - 0.1);
					quat.identity();
				} });
				fwIds.push(id);
			}
		}
		k.box(FW.x - 3.7, FW.x + 3.7, FW.z - 2.0, FW.z + 2.0);
		// hop on whichever gondola is nearest the bottom (the empty ones first)
		k.interact("park:ferris", {
			label: "Ride the Ferris wheel", stand: [FW.x, FW.z + 2.6], face: Math.PI, reach: 3,
			use: () => {
				const a0 = fwAngle();
				const order = [...Array(FW.n).keys()].sort((p, q) => {
					const da = i => { const a = ((a0 + i / FW.n * TAU) % TAU + TAU) % TAU; return Math.min(a, TAU - a); };
					return da(p) - da(q);
				});
				const ids = [];
				order.forEach(i => ids.push("ferris" + i + "0", "ferris" + i + "1"));
				const free = ctx.freeSpot(ids.slice(0, 2)) ? ids.slice(0, 2) : ids;
				if (ctx.sitOn(free)) ctx.notice("Up you go! Once round takes a minute and a bit. <b>F</b> to look through your own eyes, then drag to look round.");
			}
		}, fwG);
	}

	// ================================================================ the carousel
	const car = group(g, CAROUSEL.x, 0, CAROUSEL.z);
	const carSpin = group(car, 0, 0, 0);
	const CAR_W = 0.5;
	const carAngle = () => (rideT("carousel") * CAR_W) % TAU;
	const horses = [], horseIds = [];
	const HORSE_R = 2.6;
	const bob = (i, t) => 0.22 * Math.sin(t * 2.2 + i * Math.PI / 2);
	{
		const stripe = canvasTex(512, 128, (c, w, h) => { for (let i = 0; i < 16; i++) { c.fillStyle = i % 2 ? "#fff4e6" : "#e63973"; c.fillRect(i * w / 16, 0, w / 16 + 1, h); } });
		add(carSpin, new THREE.CylinderGeometry(CAROUSEL.r, CAROUSEL.r + 0.05, 0.3, 48), mat("#e8d5b5", 0.6), 0, 0.15, 0);
		add(carSpin, new THREE.CylinderGeometry(CAROUSEL.r + 0.02, CAROUSEL.r + 0.07, 0.12, 48), mat("#c2366b", 0.5), 0, 0.24, 0, { cast: false });
		add(carSpin, new THREE.CylinderGeometry(0.75, 0.75, 3.2, 24), mat("#ffffff", 0.5, 0, { map: stripe }), 0, 1.9, 0);
		// mirrors round the middle
		for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; add(carSpin, new THREE.PlaneGeometry(0.42, 0.8), mat("#cfe3ff", 0.05, 0.9), Math.sin(a) * 0.77, 1.8, Math.cos(a) * 0.77, { ry: a, cast: false }); }
		add(carSpin, new THREE.ConeGeometry(CAROUSEL.r + 0.4, 1.4, 32, 1, true), mat("#ffffff", 0.7, 0, { map: stripe, side: THREE.DoubleSide }), 0, 4.2, 0);
		add(carSpin, new THREE.CylinderGeometry(CAROUSEL.r + 0.4, CAROUSEL.r + 0.4, 0.42, 32, 1, true), mat("#ffd166", 0.5, 0.3, { side: THREE.DoubleSide }), 0, 3.35, 0, { cast: false });
		add(carSpin, new THREE.SphereGeometry(0.28, 16, 12), mat("#ffd166", 0.3, 0.6), 0, 5.05, 0);
		add(carSpin, new THREE.ConeGeometry(0.12, 0.5, 12), mat("#ffd166", 0.3, 0.6), 0, 5.45, 0, { cast: false });
		var carBulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.06, 8, 6), glow("#ffffff"), 36);
		const d = new THREE.Object3D();
		for (let i = 0; i < 36; i++) { const a = i / 36 * TAU; d.position.set(Math.sin(a) * (CAROUSEL.r + 0.42), 3.2, Math.cos(a) * (CAROUSEL.r + 0.42)); d.updateMatrix(); carBulbs.setMatrixAt(i, d.matrix); carBulbs.setColorAt(i, new THREE.Color(BULBS[i % BULBS.length])); }
		carBulbs.castShadow = false;
		carSpin.add(carBulbs);
		const brass = mat("#e0b85a", 0.25, 0.9);
		const hCols = [["#fff8ef", "#e63973"], ["#8a5a3c", "#4cc9f0"], ["#f6d6e8", "#7b2cbf"], ["#2b2d42", "#ffd166"]];
		for (let i = 0; i < 8; i++) {
			const a = i / 8 * TAU, hx = Math.sin(a) * HORSE_R, hz = Math.cos(a) * HORSE_R;
			add(carSpin, new THREE.CylinderGeometry(0.035, 0.035, 3.0, 8), brass, hx, 1.8, hz, { cast: false });
			const hg = group(carSpin, hx, 0.3, hz, a + Math.PI / 2);
			const [coat, saddle] = hCols[i % 4];
			const cm = mat(coat, 0.45);
			add(hg, new THREE.SphereGeometry(1, 16, 12), cm, 0, 0.85, 0).scale.set(0.24, 0.26, 0.56);
			add(hg, new THREE.CylinderGeometry(0.1, 0.14, 0.5, 10), cm, 0, 1.13, 0.42, { rx: 0.7 });
			const head = add(hg, new THREE.SphereGeometry(1, 14, 10), cm, 0, 1.33, 0.62);
			head.scale.set(0.11, 0.13, 0.24); head.rotation.x = 0.5;
			for (const sx of [-0.05, 0.05]) add(hg, new THREE.ConeGeometry(0.03, 0.1, 6), cm, sx, 1.48, 0.52, { cast: false });
			add(hg, new THREE.BoxGeometry(0.05, 0.22, 0.42), mat(saddle, 0.6), 0, 1.25, 0.36, { rx: 0.6, cast: false });   // mane
			for (const [sx, sz, rx] of [[-0.12, 0.35, -0.7], [0.12, 0.35, -0.3], [-0.12, -0.35, 0.6], [0.12, -0.35, 0.3]]) add(hg, new THREE.CylinderGeometry(0.04, 0.03, 0.55, 8), cm, sx, 0.55, sz, { rx, cast: false });
			add(hg, new THREE.ConeGeometry(0.07, 0.5, 8), mat(saddle, 0.6), 0, 0.8, -0.62, { rx: -2.3, cast: false });
			add(hg, rbox(0.36, 0.08, 0.42, 0.03), mat(saddle, 0.5), 0, 1.1, -0.02);
			horses.push(hg);
			const id = "carousel" + i, ra = (i + 0.5) / 8 * TAU;
			k.spot({ id, x: CAROUSEL.x + Math.sin(ra) * 4.6, z: CAROUSEL.z + Math.cos(ra) * 4.6, y: 0, h: 0, ride: (pos, quat) => {
				const th = carAngle() + a;
				pos.set(OX + CAROUSEL.x + Math.sin(th) * HORSE_R, 0.3 + bob(i, rideT("carousel")) + 1.15 - 0.46, OZ + CAROUSEL.z + Math.cos(th) * HORSE_R);
				quat.setFromAxisAngle(Y, th + Math.PI / 2);
			} });
			horseIds.push(id);
		}
		k.box(CAROUSEL.x - CAROUSEL.r - 0.1, CAROUSEL.x + CAROUSEL.r + 0.1, CAROUSEL.z - CAROUSEL.r - 0.1, CAROUSEL.z + CAROUSEL.r + 0.1);
		k.interact("park:carousel", {
			label: "Ride the carousel", stand: [CAROUSEL.x, CAROUSEL.z - CAROUSEL.r - 0.7], face: 0, reach: 3,
			use: () => { if (ctx.sitOn(horseIds)) ctx.notice("Giddy up! Round and round you go. <b>F</b> for your own eyes, <b>R</b> for ride controls."); }
		}, car);
	}

	// ================================================================ the drop tower: Sky Drop
	const dropG = group(g, DROP.x, 0, DROP.z);
	const DROP_CYCLE = 42, DROP_BOT = 0.5;
	const tf = Math.sqrt(2 * (DROP.top - 7) / GRAV), vf = GRAV * tf, ab = vf * vf / (2 * (7 - DROP_BOT)), tb = vf / ab;
	const DROP_A0 = 12, DROP_A1 = 28 + tf + tb + 2;   // (non-stop: just this part, over and over)
	// the carriage's height at a moment in its cycle: waiting at the bottom, up slowly, a pause, then the drop
	const dropState = () => {
		const c = cfgOf("drop"), tau = rideT("drop"), ns = !!c.ns, top = DROP.top;
		const ph = ns ? DROP_A0 + mod(tau, DROP_A1 - DROP_A0) : mod(tau, DROP_CYCLE);
		let y = DROP_BOT, stage = "wait";
		if (ph >= 12 && ph < 24) { y = DROP_BOT + (top - DROP_BOT) * smooth((ph - 12) / 12); stage = "up"; }
		else if (ph >= 24 && ph < 28) { y = top; stage = "top"; }
		else if (ph >= 28 && ph < 28 + tf) { const u = ph - 28; y = top - 0.5 * GRAV * u * u; stage = "fall"; }
		else if (ph >= 28 + tf && ph < 28 + tf + tb) { const u = ph - 28 - tf; y = 7 - vf * u + 0.5 * ab * u * u; stage = "brake"; }
		const boarding = !ns && (ph < 11 || ph > 31);
		return { ph, y, stage, ns, sp: spOf(c), boarding, left: ph < 12 ? 12 - ph : DROP_CYCLE - ph + 12 };
	};
	REMAP.drop = (tau, ns) => { if (ns) { const ph = mod(tau, DROP_CYCLE); return ph >= DROP_A0 && ph < DROP_A1 ? ph - DROP_A0 : 0; } return DROP_A0 + mod(tau, DROP_A1 - DROP_A0); };
	const dropIds = [];
	{
		const towerTex = canvasTex(128, 512, (c, w, h) => {
			c.fillStyle = "#2b1d3a"; c.fillRect(0, 0, w, h);
			c.strokeStyle = "#8d6fb0"; c.lineWidth = 6;
			for (let y = 0; y < h; y += 64) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y + 64); c.moveTo(w, y); c.lineTo(0, y + 64); c.stroke(); c.strokeRect(3, y, w - 6, 64); }
		}, 1, DROP.H / 3);
		add(dropG, new THREE.BoxGeometry(1.1, DROP.H, 1.1), mat("#ffffff", 0.6, 0.2, { map: towerTex }), 0, DROP.H / 2, 0);
		add(dropG, new THREE.CylinderGeometry(1.6, 1.9, 0.5, 24), mat("#3a2a48", 0.6), 0, 0.25, 0);
		// the crown on top, with its name
		add(dropG, new THREE.CylinderGeometry(1.4, 1.0, 1.2, 24), mat("#c2366b", 0.4, 0.2), 0, DROP.H + 0.6, 0);
		add(dropG, new THREE.ConeGeometry(0.5, 1.6, 16), mat("#ffd166", 0.3, 0.5), 0, DROP.H + 2.0, 0);
		var dropBeacon = add(dropG, new THREE.SphereGeometry(0.2, 12, 10), glow("#ff3355"), 0, DROP.H + 2.9, 0, { cast: false });
		for (let i = 0; i < 4; i++) add(dropG, new THREE.PlaneGeometry(2.0, 0.5), sign("SKY DROP", { color: "#fff4d6", glow: "#ff4d6d", font: "900 150px Nunito, 'Segoe UI', sans-serif" }), Math.sin(i * Math.PI / 2) * 1.42, DROP.H + 0.6, Math.cos(i * Math.PI / 2) * 1.42, { ry: i * Math.PI / 2, cast: false, receive: false });
		// chasing lights up all four corners
		var dropLights = new THREE.InstancedMesh(new THREE.SphereGeometry(0.06, 8, 6), glow("#ffffff"), 4 * 40);
		const d = new THREE.Object3D();
		for (let c = 0; c < 4; c++) for (let i = 0; i < 40; i++) { d.position.set((c & 1 ? 1 : -1) * 0.58, 0.8 + i / 39 * (DROP.H - 1.2), (c & 2 ? 1 : -1) * 0.58); d.updateMatrix(); dropLights.setMatrixAt(c * 40 + i, d.matrix); dropLights.setColorAt(c * 40 + i, new THREE.Color("#ffffff")); }
		dropLights.castShadow = false;
		dropG.add(dropLights);
		// the carriage: a ring round the tower, eight seats facing out, shoulder bars
		var carriage = group(dropG, 0, DROP_BOT, 0);
		add(carriage, new THREE.CylinderGeometry(1.15, 1.15, 0.5, 24, 1, true), mat("#ffd166", 0.4, 0.4, { side: THREE.DoubleSide }), 0, 0.25, 0);
		add(carriage, new THREE.TorusGeometry(1.3, 0.08, 8, 32), mat("#c2366b", 0.4), 0, 0.05, 0, { rx: Math.PI / 2 });
		for (let i = 0; i < 8; i++) {
			const a = i / 8 * TAU, sg = group(carriage, Math.sin(a) * 1.3, 0, Math.cos(a) * 1.3, a);
			add(sg, rbox(0.5, 0.08, 0.45, 0.03), cushion, 0, 0.41, 0.05);
			add(sg, rbox(0.5, 0.8, 0.08, 0.03), mat("#c2366b", 0.4), 0, 0.82, -0.18);
			add(sg, new THREE.TorusGeometry(0.2, 0.035, 6, 16, Math.PI), chrome, 0, 1.05, 0.06, { cast: false });
			add(sg, rbox(0.3, 0.06, 0.25, 0.02), dark, 0, 0.08, 0.38, { cast: false });   // footrest
			const id = "drop" + i;
			k.spot({ id, x: DROP.x + Math.sin(a) * 3.0, z: DROP.z + Math.cos(a) * 3.0, y: 0, h: a, pov: true, ride: (pos, quat) => {
				const y = dropState().y;
				pos.set(OX + DROP.x + Math.sin(a) * 1.38, y + 0.45 - 0.46, OZ + DROP.z + Math.cos(a) * 1.38);
				quat.setFromAxisAngle(Y, a);
			} });
			dropIds.push(id);
		}
		k.box(DROP.x - 2.0, DROP.x + 2.0, DROP.z - 2.0, DROP.z + 2.0);
		k.interact("park:drop", {
			label: () => { const D = dropState(); return D.boarding || D.ns || !D.sp ? "Ride the Sky Drop" : `The Sky Drop is running - back down in ${waitS(DROP_CYCLE - D.ph, "drop")}s`; },
			stand: [DROP.x - 2.6, DROP.z], face: Math.PI / 2, reach: 3,
			use: () => {
				const D = dropState();
				if (D.ns || !D.sp) { if (ctx.sitOn(dropIds)) ctx.notice(`Shoulder bars down! The Sky Drop is ${D.ns ? "running non-stop" : "stopped"}. ${LOOK_TIP}`); return; }
				if (!D.boarding) { ctx.notice(`The Sky Drop is up in the air - it's back down in <b>${waitS(DROP_CYCLE - D.ph, "drop")}s</b>.`); return; }
				if (ctx.sitOn(dropIds)) ctx.notice(`Shoulder bars down! Up we go in <b>${waitS(D.left, "drop")}s</b>... ${LOOK_TIP}`);
			}
		}, dropG);
	}

	// ================================================================ the swing ride: Star Swings
	const swG = group(g, SWING.x, 0, SWING.z);
	const SW_CYCLE = 44, SW_MAX = 1.3, SW_ARM = 2.7, SW_CHAIN = 4.3, SW_N = 12;
	// how fast it spins (and how far round it has turned) through its cycle: still while people get on, then speeding up
	// (non-stop: it speeds up once and then keeps flying round; ao keeps the angle steady across a switch)
	const swSpinAt = (c, t) => {
		const ns = !!c.ns, sp = spOf(c);
		const full = 0.5 * SW_MAX * 6 * 2 + SW_MAX * 18;
		let w = 0, a = 0, ph, n = 0;
		if (ns) {
			const u = Math.max(0, t);
			if (u < 6) { w = SW_MAX * u / 6; a = 0.5 * SW_MAX / 6 * u * u; } else { w = SW_MAX; a = 0.5 * SW_MAX * 6 + SW_MAX * (u - 6); }
			ph = 10 + Math.min(u, 6);
		} else {
			n = Math.floor(t / SW_CYCLE); ph = t - n * SW_CYCLE;
			if (ph < 10) { w = 0; a = 0; }
			else if (ph < 16) { const u = ph - 10; w = SW_MAX * u / 6; a = 0.5 * SW_MAX / 6 * u * u; }
			else if (ph < 34) { w = SW_MAX; a = 0.5 * SW_MAX * 6 + SW_MAX * (ph - 16); }
			else if (ph < 40) { const u = ph - 34; w = SW_MAX * (1 - u / 6); a = 0.5 * SW_MAX * 6 + SW_MAX * 18 + SW_MAX * u - 0.5 * SW_MAX / 6 * u * u; }
			else { w = 0; a = full; }
		}
		const ang = mod((n % 1000) * full + a + (+c.ao || 0), TAU);
		const k2 = w / SW_MAX, we = w * sp;
		// the chains swing out as it speeds up (r = arm + chain * sin), and the whole top rises
		let th = 0;
		for (let i = 0; i < 4; i++) th = Math.min(1.0, Math.atan(we * we * (SW_ARM + SW_CHAIN * Math.sin(th)) / GRAV));
		return { ang, w, th, ns, sp, top: 5.0 + 2.6 * k2, boarding: !ns && ph < 9, left: ph < 10 ? 10 - ph : SW_CYCLE - ph + 10, ph };
	};
	const swSpin = () => {
		const c = cfgOf("swing"), S = swSpinAt(c, rideT("swing")), w = easeIn(c);
		if (w < 1) { const O = swSpinAt(c.pv, oldT(c)); S.th = O.th + (S.th - O.th) * w; S.top = O.top + (S.top - O.top) * w; }
		return S;
	};
	REMAP.swing = (tau, ns) => {
		if (ns) { const ph = mod(tau, SW_CYCLE); return ph >= 10 && ph < 34 ? ph - 10 : ph >= 34 && ph < 40 ? 6 - (ph - 34) : 0; }
		return tau < 6 ? 10 + Math.max(0, tau) : 16 + mod(tau - 6, 18);
	};
	ANGLE.swing = (c, t) => swSpinAt(c, t).ang;
	const swChairs = [], swChains = [], swIds = [];
	{
		const stripe = canvasTex(512, 128, (c, w, h) => { for (let i = 0; i < 16; i++) { c.fillStyle = i % 2 ? "#fff4e6" : "#4cc9f0"; c.fillRect(i * w / 16, 0, w / 16 + 1, h); } });
		add(swG, new THREE.CylinderGeometry(0.32, 0.42, 9.5, 20), mat("#f4efe8", 0.5, 0.2), 0, 4.75, 0);
		add(swG, new THREE.CylinderGeometry(1.0, 1.2, 0.6, 24), mat("#2f4b7c", 0.6), 0, 0.3, 0);
		var swTop = group(swG, 0, 5.0, 0);
		add(swTop, new THREE.ConeGeometry(3.3, 1.2, 32, 1, true), mat("#ffffff", 0.7, 0, { map: stripe, side: THREE.DoubleSide }), 0, 0.9, 0);
		add(swTop, new THREE.CylinderGeometry(3.3, 3.3, 0.35, 32, 1, true), mat("#ffd166", 0.5, 0.3, { side: THREE.DoubleSide }), 0, 0.15, 0, { cast: false });
		add(swTop, new THREE.SphereGeometry(0.4, 16, 12), mat("#4cc9f0", 0.3, 0.4), 0, 1.6, 0);
		var swBulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.06, 8, 6), glow("#ffffff"), 32);
		const d = new THREE.Object3D();
		for (let i = 0; i < 32; i++) { const a = i / 32 * TAU; d.position.set(Math.sin(a) * 3.33, 0.05, Math.cos(a) * 3.33); d.updateMatrix(); swBulbs.setMatrixAt(i, d.matrix); swBulbs.setColorAt(i, new THREE.Color(BULBS[i % BULBS.length])); }
		swBulbs.castShadow = false;
		swTop.add(swBulbs);
		const chainM = mat("#c9ccd3", 0.3, 0.9), chairCols = ["#ff4d6d", "#ffd166", "#06d6a0", "#c77dff"];
		for (let i = 0; i < SW_N; i++) {
			const chain = add(g, new THREE.CylinderGeometry(0.012, 0.012, 1, 4), chainM, 0, 0, 0, { cast: false });
			const ch = group(g, 0, 0, 0);
			const cm = mat(chairCols[i % 4], 0.45, 0.2);
			add(ch, rbox(0.46, 0.06, 0.44, 0.03), cm, 0, 0.0, 0.02);
			add(ch, rbox(0.46, 0.5, 0.06, 0.03), cm, 0, 0.26, -0.2);
			add(ch, new THREE.CylinderGeometry(0.015, 0.015, 0.46, 6), chrome, 0, 0.32, 0.22, { rz: Math.PI / 2, cast: false });
			add(ch, rbox(0.3, 0.04, 0.2, 0.02), dark, 0, -0.32, 0.3, { cast: false });
			swChairs.push(ch); swChains.push(chain);
			const id = "starSwing" + i, la = (i + 0.5) / SW_N * TAU;
			// (the chair's seat is 0.03 above its origin; your hips go just above it)
			k.spot({ id, x: SWING.x + Math.sin(la) * 6.6, z: SWING.z + Math.cos(la) * 6.6, y: 0, h: 0, ride: (pos, quat) => { chairPose(i, swSpin(), _p, _q); pos.copy(_p).addScaledVector(_up, -0.43).add(ORIGIN); quat.copy(_q); } });
			swIds.push(id);
		}
		// the low fence round it
		const fenceN = 40;
		const fp = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.04, 0.04, 0.8, 6), mat("#ffd166", 0.5, 0.3), fenceN);
		for (let i = 0; i < fenceN; i++) { const a = i / fenceN * TAU; d.position.set(Math.sin(a) * SWING.fence, 0.4, Math.cos(a) * SWING.fence); d.updateMatrix(); fp.setMatrixAt(i, d.matrix); }
		fp.castShadow = false;
		swG.add(fp);
		add(swG, new THREE.TorusGeometry(SWING.fence, 0.035, 6, 80), mat("#ffd166", 0.5, 0.3), 0, 0.8, 0, { rx: Math.PI / 2, cast: false });
		k.box(SWING.x - SWING.fence, SWING.x + SWING.fence, SWING.z - SWING.fence, SWING.z + SWING.fence);
		k.interact("park:swing", {
			label: () => { const S = swSpin(); return S.boarding || S.ns || !S.sp ? "Ride the Star Swings" : `The swings are spinning - they stop in ${waitS(SW_CYCLE - S.ph, "swing")}s`; },
			stand: [SWING.x - SWING.fence - 0.6, SWING.z], face: Math.PI / 2, reach: 3,
			use: () => {
				const S = swSpin();
				if (S.ns || !S.sp) { if (ctx.sitOn(swIds)) ctx.notice(`You jump into a swing - ${S.ns ? "they're flying round non-stop" : "they're stopped"}! ${LOOK_TIP}`); return; }
				if (!S.boarding) { ctx.notice(`The swings are flying round - they stop in <b>${waitS(SW_CYCLE - S.ph, "swing")}s</b>.`); return; }
				if (ctx.sitOn(swIds)) ctx.notice(`Hold on to the chains! It starts in <b>${waitS(S.left, "swing")}s</b>. ${LOOK_TIP}`);
			}
		}, swG);
	}
	// a chair's place (local to the park) and its tilt: hanging from its arm, swung out by the spin, facing the way it goes
	const _pv = new THREE.Vector3(), _fw = new THREE.Vector3(), _up = new THREE.Vector3(), _sx = new THREE.Vector3();
	function chairPose(i, S, pos, quat) {
		const a = S.ang + i / SW_N * TAU;
		const rd = [Math.sin(a), Math.cos(a)];
		_pv.set(SWING.x + rd[0] * SW_ARM, S.top, SWING.z + rd[1] * SW_ARM);
		const r = SW_ARM + SW_CHAIN * Math.sin(S.th);
		pos.set(SWING.x + rd[0] * r, S.top - SW_CHAIN * Math.cos(S.th), SWING.z + rd[1] * r);
		_up.subVectors(_pv, pos).normalize();
		_fw.set(rd[1], 0, -rd[0]);                              // the way round it goes
		_sx.crossVectors(_up, _fw).normalize();
		_fw.crossVectors(_sx, _up).normalize();
		_m.makeBasis(_sx, _up, _fw);
		quat.setFromRotationMatrix(_m);
		return _pv;
	}

	// ================================================================ the pirate ship: the Jolly Roger
	// it hangs from an axle between two A-frames and swings end over end in the x-y plane, higher and higher, then
	// settles (non-stop: it keeps swinging as high as it goes)
	const SHIP_CYCLE = 52, SHIP_AMAX = 1.15, SHIP_W = TAU / 6;
	const shipState = () => {
		const c = cfgOf("ship"), S = shipAt(c, rideT("ship")), w = easeIn(c);
		if (w < 1) { const O = shipAt(c.pv, oldT(c)); S.th = O.th + (S.th - O.th) * w; S.A = O.A + (S.A - O.A) * w; }
		return S;
	};
	const shipAt = (c, tau) => {
		const ns = !!c.ns;
		// (the full swing runs 22..40: three whole swings, so the non-stop loop joins up)
		const ph = ns ? (tau < 12 ? 10 + Math.max(0, tau) : 22 + mod(tau - 12, 18)) : mod(tau, SHIP_CYCLE);
		let A = 0;
		if (ph >= 10 && ph < 22) A = SHIP_AMAX * smooth((ph - 10) / 12);
		else if (ph >= 22 && ph < 40) A = SHIP_AMAX;
		else if (ph >= 40 && ph < 50) A = SHIP_AMAX * (1 - smooth((ph - 40) / 10));
		return { ph, A, th: A * Math.sin(SHIP_W * (ph - 10)), ns, sp: spOf(c), boarding: !ns && (ph < 9 || ph > 50), left: ph < 10 ? 10 - ph : SHIP_CYCLE - ph + 10 };
	};
	REMAP.ship = (tau, ns) => { if (ns) { const ph = mod(tau, SHIP_CYCLE); return ph >= 10 && ph < 40 ? ph - 10 : 0; } return tau < 12 ? 10 + Math.max(0, tau) : 22 + mod(tau - 12, 18); };
	const shipG = group(g, SHIP.x, 0, SHIP.z);
	const shipBoat = group(shipG, 0, SHIP.pivot, 0);
	const shipIds = [];
	const ZA = new THREE.Vector3(0, 0, 1), _sq = new THREE.Quaternion(), _sh = new THREE.Quaternion();
	const SHIP_PIVOT = new THREE.Vector3(OX + SHIP.x, SHIP.pivot, OZ + SHIP.z);
	{
		const frameM = mat("#2b1d3a", 0.5, 0.4), goldM = mat("#e0b85a", 0.3, 0.8);
		const wood = canvasTex(256, 256, (c, w, h) => {
			const r = rng(77);
			for (let i = 0; i < 8; i++) { const t = 92 + r() * 30; c.fillStyle = `rgb(${t + 40},${t * 0.62 | 0},${t * 0.38 | 0})`; c.fillRect(0, i * h / 8, w, h / 8); c.fillStyle = "rgba(0,0,0,.35)"; c.fillRect(0, i * h / 8, w, 2); }
			for (let n = 0; n < 160; n++) { c.fillStyle = `rgba(40,20,10,${r() * 0.18})`; c.fillRect(r() * w, r() * h, 10 + r() * 30, 1); }
		}, 2, 1);
		const woodM = mat("#ffffff", 0.75, 0, { map: wood });
		// the two A-frames, cross braces, and the axle
		for (const sz of [-1, 1]) {
			for (const sx of [-1, 1]) {
				beam(shipG, new THREE.Vector3(sx * 3.8, 0, sz * 2.2), new THREE.Vector3(0, SHIP.pivot + 0.2, sz * 1.65), 0.16, frameM);
				add(shipG, new THREE.CylinderGeometry(0.34, 0.4, 0.24, 16), frameM, sx * 3.8, 0.12, sz * 2.2);
			}
			beam(shipG, new THREE.Vector3(-2.4, 2.5, sz * 2.0), new THREE.Vector3(2.4, 2.5, sz * 2.0), 0.09, goldM);
			add(shipG, new THREE.CylinderGeometry(0.3, 0.3, 0.16, 20), goldM, 0, SHIP.pivot, sz * 1.72, { rx: Math.PI / 2 });
		}
		add(shipG, new THREE.CylinderGeometry(0.15, 0.15, 3.5, 16), chrome, 0, SHIP.pivot, 0, { rx: Math.PI / 2 });
		// the arms down to the hull
		for (const sz of [-1.32, 1.32]) for (const sx of [-1, 1]) beam(shipBoat, new THREE.Vector3(0, 0, sz), new THREE.Vector3(sx * 1.7, -SHIP.arm + 0.75, sz), 0.08, chrome);
		const hull = group(shipBoat, 0, -SHIP.arm, 0);
		// the hull: side walls cut to a boat's profile (low in the middle, rising to the bow and stern)
		const HL = 3.5, n = 28;
		const topY = x => 0.55 + 0.9 * Math.pow(x / HL, 4), botY = x => -0.75 + 0.7 * (x / HL) * (x / HL), keel = x => -0.4 + 0.3 * (x / HL) * (x / HL);
		const band = (lo, hi) => {
			const sh = new THREE.Shape();
			sh.moveTo(-HL, lo(-HL));
			for (let i = 1; i <= n; i++) { const x = -HL + 2 * HL * i / n; sh.lineTo(x, lo(x)); }
			for (let i = n; i >= 0; i--) { const x = -HL + 2 * HL * i / n; sh.lineTo(x, hi(x)); }
			return sh;
		};
		const slab = (shape, depth, m, z) => add(hull, new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 4 }), m, 0, 0, z);
		const redM = mat("#b8233f", 0.5, 0.1);
		for (const sz of [-1, 1]) {
			const z0 = sz > 0 ? 1.1 : -1.2;
			slab(band(botY, topY), 0.1, woodM, z0);
			slab(band(x => topY(x) - 0.1, topY), 0.04, goldM, sz > 0 ? 1.2 : -1.24);
			slab(band(x => topY(x) - 0.48, x => topY(x) - 0.32), 0.03, redM, sz > 0 ? 1.2 : -1.23);
			add(hull, new THREE.PlaneGeometry(2.4, 0.6), sign("Jolly Roger", { w: 1024, h: 256, color: "#ffe9a8", glow: "#ff9e4a", font: "800 150px 'Caveat', 'Nunito', cursive" }), 0, 0.0, sz * 1.26, { ry: sz > 0 ? 0 : Math.PI, cast: false, receive: false });
		}
		slab(band(botY, keel), 2.2, woodM, -1.1);
		for (const sx of [-1, 1]) add(hull, new THREE.BoxGeometry(0.1, 1.55, 2.3), woodM, sx * (HL - 0.05), 0.675, 0);
		// the bow: a golden figurehead; the stern: two lanterns
		add(hull, new THREE.ConeGeometry(0.2, 0.9, 12), goldM, HL + 0.35, 1.35, 0, { rz: -Math.PI / 2 - 0.4 });
		add(hull, new THREE.SphereGeometry(0.22, 14, 10), goldM, HL + 0.05, 1.2, 0);
		for (const sz of [-0.7, 0.7]) add(hull, new THREE.SphereGeometry(0.11, 10, 8), glow("#ffcf6e"), -HL - 0.12, 1.45, sz, { cast: false });
		// stepped rows of benches, everyone facing the middle (the ends go highest)
		const seatM = mat("#2b1d3a", 0.7), backM = mat("#b8233f", 0.5);
		const rows = [-2.7, -1.8, -0.9, 0.9, 1.8, 2.7];
		rows.forEach((sx, j) => {
			const sg = Math.sign(sx), kk = Math.round(Math.abs(sx) / 0.9) - 1, fy = -0.38 + 0.2 * kk;
			add(hull, new THREE.BoxGeometry(0.9, 0.4, 2.2), woodM, sx, fy - 0.2, 0, { cast: false });
			add(hull, rbox(0.42, 0.34, 1.9, 0.04), seatM, sx + sg * 0.05, fy + 0.2, 0);
			add(hull, rbox(0.46, 0.08, 1.96, 0.03), cushion, sx + sg * 0.05, fy + 0.41, 0);
			add(hull, rbox(0.08, 0.6, 1.96, 0.03), backM, sx + sg * 0.28, fy + 0.74, 0);
			add(hull, new THREE.CylinderGeometry(0.03, 0.03, 1.9, 8), chrome, sx - sg * 0.32, fy + 0.72, 0, { rx: Math.PI / 2, cast: false });
			for (let s = 0; s < 2; s++) {
				const sz = s ? 0.45 : -0.45, h = sg > 0 ? -Math.PI / 2 : Math.PI / 2, id = "ship" + j + s;
				// (each row's seats sit apart from the others' on the ground)
				k.spot({ id, x: SHIP.x - 5.0 + j * 2.0 + (s ? 0.28 : -0.28), z: SHIP.z + 3.4, y: 0, h: 0, pov: true, ride: (pos, quat) => {
					_sq.setFromAxisAngle(ZA, shipState().th);
					pos.set(sx + sg * 0.05, -SHIP.arm + fy + 0.45 - 0.46, sz).applyQuaternion(_sq).add(SHIP_PIVOT);
					quat.copy(_sq).multiply(_sh.setFromAxisAngle(Y, h));
				} });
				shipIds.push(id);
			}
		});
		// the mast in the middle, a sail with the skull and crossbones, and a flag
		add(hull, new THREE.CylinderGeometry(0.07, 0.09, 3.6, 10), mat("#5a3a2a", 0.8), 0, 1.4, 0);
		add(hull, new THREE.CylinderGeometry(0.04, 0.04, 1.8, 8), mat("#5a3a2a", 0.8), 0, 2.95, 0, { rz: Math.PI / 2 });
		const skull = canvasTex(256, 256, (c, w, h) => {
			c.fillStyle = "#1c1824"; c.fillRect(0, 0, w, h);
			c.strokeStyle = "#f4efe8"; c.lineWidth = 22; c.lineCap = "round";
			c.beginPath(); c.moveTo(60, 150); c.lineTo(196, 230); c.moveTo(196, 150); c.lineTo(60, 230); c.stroke();
			c.fillStyle = "#f4efe8";
			c.beginPath(); c.arc(128, 108, 62, 0, TAU); c.fill();
			c.fillRect(96, 140, 64, 44);
			c.fillStyle = "#1c1824";
			c.beginPath(); c.arc(104, 104, 17, 0, TAU); c.arc(152, 104, 17, 0, TAU); c.fill();
			c.beginPath(); c.moveTo(128, 122); c.lineTo(118, 142); c.lineTo(138, 142); c.fill();
			for (let i = 0; i < 4; i++) c.fillRect(102 + i * 15, 168, 4, 16);
		});
		const sailM = mat("#ffffff", 0.9, 0, { map: skull, side: THREE.DoubleSide });
		add(hull, new THREE.PlaneGeometry(1.6, 1.5), sailM, 0, 2.15, 0.1, { cast: false });
		var shipFlag = add(hull, new THREE.PlaneGeometry(0.6, 0.38), mat("#e63946", 0.7, 0, { side: THREE.DoubleSide }), 0.32, 3.05, 0, { cast: false });
		// bulbs all along the top of both sides
		var shipBulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.05, 8, 6), glow("#ffffff"), 60);
		const d = new THREE.Object3D();
		for (let i = 0; i < 30; i++) for (let s = 0; s < 2; s++) {
			const x = -HL + 0.1 + (2 * HL - 0.2) * i / 29;
			d.position.set(x, topY(x) + 0.03, s ? 1.22 : -1.26); d.updateMatrix();
			shipBulbs.setMatrixAt(i * 2 + s, d.matrix); shipBulbs.setColorAt(i * 2 + s, new THREE.Color(BULBS[i % BULBS.length]));
		}
		shipBulbs.castShadow = false;
		hull.add(shipBulbs);
		// a deck to stand on round it
		add(g, new THREE.PlaneGeometry(13.4, 5.2), mat("#4a2f3e", 0.85), SHIP.x, 0.006, SHIP.z, { rx: -Math.PI / 2, cast: false }).userData.floor = true;
		add(g, new THREE.PlaneGeometry(13.4, 0.16), mat("#ffd166", 0.6), SHIP.x, 0.009, SHIP.z + 2.6, { rx: -Math.PI / 2, cast: false });
		k.box(SHIP.x - 6.6, SHIP.x + 6.6, SHIP.z - 2.45, SHIP.z + 2.45);
		k.interact("park:ship", {
			label: () => { const P = shipState(); return P.boarding || P.ns || !P.sp ? "Sail on the Jolly Roger" : `The pirate ship is swinging - back down in ${waitS(SHIP_CYCLE - P.ph, "ship")}s`; },
			stand: [SHIP.x, SHIP.z + 3.0], face: Math.PI, reach: 3,
			use: () => {
				const P = shipState();
				if (!P.boarding && !P.ns && P.sp) { ctx.notice(`The Jolly Roger is swinging high - it's back down in <b>${waitS(SHIP_CYCLE - P.ph, "ship")}s</b>.`); return; }
				// the end rows swing highest: fill those first
				const order = [0, 5, 1, 4, 2, 3].flatMap(j => ["ship" + j + "0", "ship" + j + "1"]);
				if (ctx.sitOn(order)) ctx.notice(`Ahoy! Hold on to the bar${P.boarding ? ` - we cast off in <b>${waitS(P.left, "ship")}s</b>` : ""}. ${LOOK_TIP}`);
			}
		}, shipG);
	}

	// ================================================================ the Teacups
	// five cups on a turning floor round a giant teapot; each cup spins the other way on its own saucer
	const teaG = group(g, TEA.x, 0, TEA.z);
	const teaSpin = group(teaG, 0, 0, 0);
	const TEA_PW = 0.32, TEA_CW = 1.6, CUP_SEAT = 0.45;
	const teaState = () => { const t = rideT("cups"); return { t, p: t * TEA_PW }; };
	const cupAngle = (i, T) => T.t * TEA_CW * (i % 2 ? 1 : -1) + i * 1.3;
	const teaCups = [], teaIds = [];
	{
		const stripe = canvasTex(512, 64, (c, w, h) => { for (let i = 0; i < 20; i++) { c.fillStyle = ["#ffd6e8", "#d6f0ff", "#fff1c1", "#e3d6ff"][i % 4]; c.fillRect(i * w / 20, 0, w / 20 + 1, h); } });
		add(teaSpin, new THREE.CylinderGeometry(TEA.r, TEA.r + 0.05, 0.25, 48), mat("#ffffff", 0.6, 0, { map: stripe }), 0, 0.125, 0);
		add(teaSpin, new THREE.TorusGeometry(TEA.r, 0.05, 6, 64), mat("#ffd166", 0.4, 0.5), 0, 0.25, 0, { rx: Math.PI / 2, cast: false });
		// the teapot
		const potM = mat("#f6d6e8", 0.35, 0.1), goldM = mat("#e0b85a", 0.3, 0.8);
		add(teaSpin, new THREE.SphereGeometry(0.85, 24, 16), potM, 0, 1.0, 0).scale.set(1, 0.8, 1);
		add(teaSpin, new THREE.CylinderGeometry(0.45, 0.55, 0.16, 24), potM, 0, 1.68, 0);
		add(teaSpin, new THREE.SphereGeometry(0.14, 12, 10), goldM, 0, 1.86, 0);
		add(teaSpin, new THREE.TorusGeometry(0.86, 0.04, 6, 40), goldM, 0, 1.0, 0, { rx: Math.PI / 2, cast: false });
		add(teaSpin, new THREE.CylinderGeometry(0.08, 0.16, 0.9, 12), potM, 1.05, 1.25, 0, { rz: -0.9 });
		add(teaSpin, new THREE.TorusGeometry(0.34, 0.07, 8, 20, Math.PI * 1.3), potM, -0.82, 1.08, 0, { rz: Math.PI * 0.35 });
		const hearts = new THREE.MeshStandardMaterial({ color: "#ff8fab", emissive: "#ff4d6d", emissiveIntensity: 1.4 });
		for (let i = 0; i < 4; i++) {
			const a = i / 4 * TAU + Math.PI / 4;
			const h = add(teaSpin, new THREE.ExtrudeGeometry(k.heartShape(0.22), { depth: 0.04, bevelEnabled: false }), hearts, Math.sin(a) * 0.84, 1.0, Math.cos(a) * 0.84, { ry: a, cast: false });
			h.geometry.center(); h.rotation.z = Math.PI;
		}
		// the cups
		const cupCols = ["#ff7aa2", "#4cc9f0", "#ffd166", "#06d6a0", "#c77dff"];
		const lathe = [[0, 0.06], [0.55, 0.08], [0.74, 0.22], [0.83, 0.45], [0.86, 0.72]].map(([x, y]) => new THREE.Vector2(x, y));
		for (let i = 0; i < TEA.n; i++) {
			const a = i / TEA.n * TAU;
			const cg = group(teaSpin, Math.sin(a) * TEA.rc, 0.25, Math.cos(a) * TEA.rc);
			const spin = group(cg, 0, 0, 0);
			const cm = mat(cupCols[i], 0.35, 0.15, { side: THREE.DoubleSide });
			add(spin, new THREE.CylinderGeometry(0.98, 0.88, 0.06, 32), mat("#fff4e6", 0.5), 0, 0.03, 0);
			add(spin, new THREE.LatheGeometry(lathe, 32), cm, 0, 0, 0);
			add(spin, new THREE.TorusGeometry(0.86, 0.04, 6, 40), goldM, 0, 0.72, 0, { rx: Math.PI / 2, cast: false });
			add(spin, new THREE.TorusGeometry(0.2, 0.05, 8, 16), cm, 0.95, 0.42, 0, { cast: false });
			add(spin, new THREE.CylinderGeometry(0.04, 0.05, 0.42, 8), chrome, 0, 0.3, 0, { cast: false });
			add(spin, new THREE.TorusGeometry(0.2, 0.03, 6, 20), chrome, 0, 0.52, 0, { rx: Math.PI / 2, cast: false });
			for (const sz of [-CUP_SEAT, CUP_SEAT]) add(spin, rbox(0.5, 0.1, 0.3, 0.04), cushion, 0, 0.37, sz + Math.sign(sz) * 0.04);
			teaCups.push(spin);
			for (let s = 0; s < 2; s++) {
				const id = "teacup" + i + s, ga = (i + 0.5) / TEA.n * TAU, gx = TEA.x + Math.sin(ga) * 3.9, gz = TEA.z + Math.cos(ga) * 3.9;
				k.spot({ id, x: gx + Math.cos(ga) * (s ? 0.28 : -0.28), z: gz - Math.sin(ga) * (s ? 0.28 : -0.28), y: 0, h: 0, pov: true, ride: (pos, quat) => {
					const T = teaState(), pa = T.p + i / TEA.n * TAU, ca = cupAngle(i, T) + s * Math.PI;
					pos.set(OX + TEA.x + Math.sin(pa) * TEA.rc + Math.sin(ca) * CUP_SEAT, 0.25 + 0.42 - 0.46, OZ + TEA.z + Math.cos(pa) * TEA.rc + Math.cos(ca) * CUP_SEAT);
					quat.setFromAxisAngle(Y, ca + Math.PI);
				} });
				teaIds.push(id);
			}
		}
		pad(TEA.x, TEA.z, TEA.r + 0.4, "#5a3d6e", "#ff9ebb");
		k.box(TEA.x - TEA.r - 0.1, TEA.x + TEA.r + 0.1, TEA.z - TEA.r - 0.1, TEA.z + TEA.r + 0.1);
		k.interact("park:cups", {
			label: "Spin in the Teacups", stand: [TEA.x + TEA.r + 0.8, TEA.z], face: -Math.PI / 2, reach: 3,
			use: () => {
				// an empty cup first (so you get one to yourself, or with whoever comes along)
				const empty = [];
				for (let i = 0; i < TEA.n; i++) if (ctx.freeSpot(["teacup" + i + "0"]) && ctx.freeSpot(["teacup" + i + "1"])) empty.push("teacup" + i + "0", "teacup" + i + "1");
				if (ctx.sitOn(empty.length ? empty : teaIds)) ctx.notice(`Wheee! Round and round and round. ${LOOK_TIP}`);
			}
		}, teaG);
	}

	// ================================================================ the Rainbow Slide
	// up the ladder, across the top, whizz down the wavy rainbow chute, hop off and run back round to the ladder:
	// over and over until you get off. Four places in the queue, a quarter of a go apart (on the ride clock, so
	// everyone sees everyone in the same place, and Ride Control can speed it up)
	const SL = { x: 17.6, z: 3.2, top: 3.2, lad: 18.65, x0: 16.9, x1: 10.6 };
	const SL_CYCLE = 12, SL_N = 4;
	// (the parts of a go: up the ladder, across the top, sit down at the top of the chute, down it, back round)
	const SL_UP = 2.6, SL_ACROSS = 3.3, SL_SIT = 3.7, SL_DOWN = 7.2, SL_OFF = 7.6;
	const slideIds = [];
	// the chute's middle line at u (0 = the top, 1 = the end of the run-out), local coordinates
	const slideAt = (u, out) => {
		const x = SL.x0 + (SL.x1 - SL.x0) * u, z = SL.z + 0.9 * Math.sin(u * Math.PI);
		const v = Math.min(1, u / 0.87);
		const y = 0.35 + (SL.top - 0.1 - 0.35) * Math.pow(1 - v, 1.4) + 0.12 * Math.sin(v * Math.PI * 3) * v * (1 - v) * 4;
		return out.set(x, y, z);
	};
	// the walk back: from the end of the slide round its north side to the foot of the ladder
	const BACK = [[SL.x1, SL.z], [SL.x1, SL.z + 1.6], [SL.lad, SL.z + 1.6], [SL.lad, SL.z]];
	const BACK_LEN = BACK.slice(1).reduce((a, p, i) => a + Math.hypot(p[0] - BACK[i][0], p[1] - BACK[i][1]), 0);
	const _sp = new THREE.Vector3(), _sn = new THREE.Vector3(), _st = new THREE.Vector3(), _su = new THREE.Vector3(), _sx2 = new THREE.Vector3(), _sm = new THREE.Matrix4();
	const slidePh = i => mod(rideT("slide") + i * SL_CYCLE / SL_N, SL_CYCLE);
	// (where on the chute after s of the 3.5 s down it: faster and faster, then the run-out brakes you)
	const slideU = s => s < 0.8 ? 0.87 * Math.pow(s / 0.8, 1.6) : 0.87 + 0.13 * (1 - Math.pow(1 - (s - 0.8) / 0.2, 2));
	// how the body looks at each part (world.js asks every frame: climbing, walking, whizzing down)
	const slideLook = i => { const ph = slidePh(i); return ph < SL_UP ? "climb" : ph < SL_ACROSS ? "walk" : ph < SL_DOWN + 0.15 ? "slide" : ph < SL_OFF ? null : "walk"; };
	function slidePose(i, pos, quat) {
		const ph = slidePh(i);
		if (ph < SL_UP) {
			// up the ladder rung by rung (a little pause on each), facing it
			const u = ph / SL_UP, rung = Math.floor(u * 9), f = u * 9 - rung;
			pos.set(SL.lad, SL.top * (rung + smooth(Math.min(1, f * 1.4))) / 9, SL.z);
			quat.setFromAxisAngle(Y, -Math.PI / 2);
		} else if (ph < SL_ACROSS) {
			// off the top of the ladder and across the deck to the chute
			const w = smooth((ph - SL_UP) / (SL_ACROSS - SL_UP));
			pos.set(SL.lad + (SL.x0 + 0.35 - SL.lad) * w, SL.top, SL.z);
			quat.setFromAxisAngle(Y, -Math.PI / 2);
		} else if (ph < SL_SIT) {
			// sit down at the top of the chute
			const w = smooth((ph - SL_ACROSS) / (SL_SIT - SL_ACROSS));
			slideAt(0, _sp);
			pos.set(SL.x0 + 0.35 + (_sp.x - SL.x0 - 0.35) * w, SL.top + (_sp.y - 0.36 - SL.top) * w, SL.z + (_sp.z - SL.z) * w);
			quat.setFromAxisAngle(Y, -Math.PI / 2);
		} else if (ph < SL_OFF) {
			const u = slideU(Math.min(1, (ph - SL_SIT) / (SL_DOWN - SL_SIT)));
			slideAt(u, _sp); slideAt(Math.min(1.02, u + 0.01), _sn);
			_st.subVectors(_sn, _sp).normalize();
			_su.set(0, 1, 0).addScaledVector(_st, -_st.y).normalize();
			_sx2.crossVectors(_su, _st);
			_sm.makeBasis(_sx2, _su, _st);
			quat.setFromRotationMatrix(_sm);
			pos.copy(_sp).addScaledVector(_su, -0.36);
		} else {
			// off at the bottom and back round to the ladder
			let d = smooth((ph - SL_OFF) / (SL_CYCLE - SL_OFF)) * BACK_LEN, j = 0;
			while (j < BACK.length - 2 && d > Math.hypot(BACK[j + 1][0] - BACK[j][0], BACK[j + 1][1] - BACK[j][1])) { d -= Math.hypot(BACK[j + 1][0] - BACK[j][0], BACK[j + 1][1] - BACK[j][1]); j++; }
			const a = BACK[j], b = BACK[j + 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, f = Math.min(1, d / l);
			pos.set(a[0] + (b[0] - a[0]) * f, 0, a[1] + (b[1] - a[1]) * f);
			quat.setFromAxisAngle(Y, Math.atan2(b[0] - a[0], b[1] - a[1]));
		}
		pos.add(ORIGIN);
	}
	{
		const sg = group(g, 0, 0, 0);
		const frameM = mat("#f4efe8", 0.45, 0.3), postM2 = mat("#4cc9f0", 0.4, 0.4);
		// the tower: four posts, the deck at the top, a railing and a striped roof
		const T0 = { x0: SL.x0 - 0.05, x1: SL.lad - 0.35, z0: SL.z - 0.7, z1: SL.z + 0.7 };
		for (const x of [T0.x0, T0.x1]) for (const z of [T0.z0, T0.z1]) add(sg, new THREE.CylinderGeometry(0.07, 0.08, SL.top + 1.9, 10), postM2, x, (SL.top + 1.9) / 2, z);
		add(sg, rbox(T0.x1 - T0.x0 + 0.2, 0.14, T0.z1 - T0.z0 + 0.2, 0.03), mat("#ff9e4a", 0.5), (T0.x0 + T0.x1) / 2, SL.top - 0.07, SL.z);
		for (const z of [T0.z0, T0.z1]) add(sg, new THREE.CylinderGeometry(0.03, 0.03, T0.x1 - T0.x0, 8), frameM, (T0.x0 + T0.x1) / 2, SL.top + 0.85, z, { rz: Math.PI / 2, cast: false });
		const awn = canvasTex(256, 64, (c, w, h) => { for (let i = 0; i < 12; i++) { c.fillStyle = ["#ff4d6d", "#ffd166", "#06d6a0", "#4cc9f0"][i % 4]; c.fillRect(i * w / 12, 0, w / 12 + 1, h); } });
		add(sg, new THREE.ConeGeometry(1.25, 0.9, 4, 1, true), mat("#ffffff", 0.7, 0, { map: awn, side: THREE.DoubleSide }), (T0.x0 + T0.x1) / 2, SL.top + 2.3, SL.z, { ry: Math.PI / 4 });
		add(sg, new THREE.PlaneGeometry(1.8, 0.45), sign("Rainbow Slide", { w: 1024, h: 256, color: "#ffffff", glow: "#c77dff", font: "800 140px 'Caveat', 'Nunito', cursive" }), (T0.x0 + T0.x1) / 2, SL.top + 1.35, T0.z1 + 0.06, { cast: false, receive: false });
		// the ladder
		for (const z of [SL.z - 0.3, SL.z + 0.3]) add(sg, new THREE.CylinderGeometry(0.035, 0.035, SL.top + 0.9, 8), frameM, SL.lad - 0.25, (SL.top + 0.9) / 2, z);
		for (let i = 1; i <= 9; i++) add(sg, new THREE.CylinderGeometry(0.025, 0.025, 0.6, 8), frameM, SL.lad - 0.25, i * SL.top / 9, SL.z, { rx: Math.PI / 2, cast: false });
		// the chute: a rainbow U-channel along the curve
		const NS = 72, prof = [[-0.56, 0.4], [-0.5, 0.04], [-0.4, 0], [0.4, 0], [0.5, 0.04], [0.56, 0.4]];
		const pos = [], col = [], idx = [], p = new THREE.Vector3(), q = new THREE.Vector3(), t = new THREE.Vector3(), lat = new THREE.Vector3(), cc = new THREE.Color();
		for (let i = 0; i <= NS; i++) {
			const u = i / NS;
			slideAt(u, p); slideAt(Math.min(1.01, u + 0.005), q);
			t.subVectors(q, p).normalize();
			lat.crossVectors(Y, t).normalize();
			cc.setHSL((u * 0.85) % 1, 0.85, 0.58);
			for (const [o, h] of prof) { pos.push(p.x + lat.x * o, p.y + h, p.z + lat.z * o); col.push(cc.r, cc.g, cc.b); }
			if (i < NS) for (let j = 0; j < prof.length - 1; j++) { const a = i * prof.length + j, b = a + prof.length; idx.push(a, b, a + 1, a + 1, b, b + 1); }
		}
		const geo = new THREE.BufferGeometry();
		geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
		geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
		geo.setIndex(idx);
		geo.computeVertexNormals();
		const chute = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.1, side: THREE.DoubleSide }));
		chute.castShadow = true; chute.receiveShadow = true;
		sg.add(chute);
		// legs under it
		for (const u of [0.18, 0.36, 0.54, 0.72]) { slideAt(u, p); add(sg, new THREE.CylinderGeometry(0.06, 0.06, p.y, 8), postM2, p.x, p.y / 2, p.z, { cast: false }); }
		// the seats: four places in the queue
		for (let i = 0; i < SL_N; i++) {
			const id = "slide" + i;
			k.spot({ id, x: 11.8 + i * 1.6, z: SL.z + 2.0, y: 0, h: 0, ride: (pos2, quat) => slidePose(i, pos2, quat), ridePose: () => slideLook(i) });
			slideIds.push(id);
		}
		k.box(T0.x0 - 0.15, SL.lad - 0.1, T0.z0 - 0.15, T0.z1 + 0.15);
		k.box(SL.x1 - 0.2, T0.x0, SL.z - 0.65, SL.z + 1.55);
		k.interact("park:slide", {
			label: "Go down the Rainbow Slide", stand: [15.6, SL.z + 2.3], face: Math.PI, reach: 3,
			use: () => {
				// whichever place in the queue is next up the ladder
				const order = [...Array(SL_N).keys()].map(i => { const ph = slidePh(i); return { id: "slide" + i, d: Math.min(ph, SL_CYCLE - ph) }; }).sort((a, b) => a.d - b.d);
				const pick = order.find(o => ctx.freeSpot([o.id]));
				if (!pick) { ctx.notice("The slide is full - wait for a turn!"); return; }
				if (ctx.sitOn([pick.id])) ctx.notice(`Up the ladder and wheee! You'll keep going round until you press <b>Esc</b>. <b>F</b> for your own eyes, <b>R</b> for ride controls.`);
			}
		}, sg);
	}

	// ================================================================ Ride Control: a booth by the gate with the panel
	{
		const bg = group(g, BOOTH.x, 0, BOOTH.z);
		const boothM = mat("#2b1d3a", 0.6, 0.2), trimM = mat("#ffd166", 0.4, 0.5);
		add(bg, rbox(1.5, 1.0, 0.8, 0.06), boothM, 0, 0.5, 0);
		add(bg, rbox(1.56, 0.06, 0.86, 0.02), trimM, 0, 1.02, 0);
		add(bg, rbox(1.4, 0.08, 0.5, 0.03), mat("#3a2f4a", 0.5), 0, 1.12, 0.1, { rx: 0.45 });
		// glowing buttons and a lever
		BULBS.forEach((c, i) => add(bg, new THREE.CylinderGeometry(0.06, 0.06, 0.04, 14), glow(c), -0.5 + i * 0.2, 1.19, 0.12, { rx: 0.45, cast: false }));
		add(bg, new THREE.CylinderGeometry(0.025, 0.025, 0.4, 8), chrome, 0.55, 1.3, -0.12, { rx: -0.4, cast: false });
		add(bg, new THREE.SphereGeometry(0.07, 12, 10), glow("#ff3355"), 0.55, 1.49, -0.2, { cast: false });
		for (const sx of [-0.68, 0.68]) add(bg, new THREE.CylinderGeometry(0.04, 0.04, 1.6, 8), chrome, sx, 1.8, -0.3, { cast: false });
		add(bg, rbox(1.7, 0.08, 1.0, 0.03), boothM, 0, 2.62, -0.1);
		add(bg, new THREE.PlaneGeometry(1.6, 0.4), sign("RIDE CONTROL", { w: 1024, h: 256, color: "#fff4d6", glow: "#4cc9f0", font: "900 140px Nunito, 'Segoe UI', sans-serif" }), 0, 2.38, -0.28, { cast: false, receive: false });
		k.box(BOOTH.x - 0.8, BOOTH.x + 0.8, BOOTH.z - 0.45, BOOTH.z + 0.45);
		k.interact("park:control", { label: "Ride Control: speeds & non-stop", stand: [BOOTH.x, BOOTH.z + 1.0], face: Math.PI, reach: 2.4, use: () => openPanel() }, bg);
	}
	const SEATS = { coaster: coasterIds, ferris: fwIds, carousel: horseIds, drop: dropIds, swing: swIds, ship: shipIds, cups: teaIds, slide: slideIds };
	const speedName = v => v === 0 ? "Stop" : (v === 0.5 ? "½" : v === 1.5 ? "1½" : String(v)) + "×";
	function rideStatus(id) {
		const sp = spOf(cfgOf(id));
		if (!sp) return "Stopped";
		const ns = !!cfgOf(id).ns;
		if (id === "coaster") { const C = coaster(); return ns ? "Non-stop round the house" : C.boarding ? `Boarding - leaves in ${waitS(C.left, id)}s` : `On the track - back in ${waitS(C.left, id)}s`; }
		if (id === "drop") { const D = dropState(); return ns ? "Non-stop drops" : D.boarding ? `Boarding - goes up in ${waitS(D.left, id)}s` : D.stage === "top" ? "At the top!" : "Running"; }
		if (id === "swing") { const S = swSpin(); return ns ? "Spinning non-stop" : S.boarding ? `Boarding - starts in ${waitS(S.left, id)}s` : "Spinning"; }
		if (id === "ship") { const P = shipState(); return ns ? "Swinging non-stop" : P.boarding ? `Boarding - casts off in ${waitS(P.left, id)}s` : "Swinging"; }
		return id === "slide" ? "Sliding" : "Turning";
	}
	// (the panel's own little stylesheet, added once)
	const ensureStyle = () => {
		if (document.getElementById("park-rc-css")) return;
		const st = document.createElement("style");
		st.id = "park-rc-css";
		st.textContent = `.prc{display:flex;flex-direction:column;gap:10px;max-height:min(62vh,560px);overflow:auto;padding-right:2px}
.prc-row{padding:10px 12px;border-radius:14px;background:rgba(255,255,255,.05);border:1px solid var(--line,rgba(255,255,255,.12))}
.prc-row.on{border-color:#ffd166;box-shadow:inset 0 0 0 1px rgba(255,209,102,.35)}
.prc-top{display:flex;justify-content:space-between;align-items:baseline;gap:10px;margin-bottom:8px}
.prc-top b{font-size:15px}.prc-top span{color:var(--muted,#b9adc9);font-size:13px;text-align:right}
.prc-btns{display:flex;flex-wrap:wrap;gap:6px;align-items:center}.prc-btns .btn{padding:6px 10px;min-width:48px}
.prc-ns{margin-left:auto}.prc-all{display:flex;gap:8px;flex-wrap:wrap}
@media (max-width:520px){.prc-ns{margin-left:0}}`;
		document.head.appendChild(st);
	};
	let panelOpen = false;
	function openPanel(focus) {
		ensureStyle();
		const rows = RIDES.map(r => `<div class="prc-row${r.id === focus ? " on" : ""}" data-r="${r.id}">
			<div class="prc-top"><b>${r.name}</b><span class="prc-st"></span></div>
			<div class="prc-btns">${SPEEDS.map(v => `<button class="btn" data-sp="${v}">${speedName(v)}</button>`).join("")}${r.ns ? `<button class="btn prc-ns" data-ns="1">Non-stop</button>` : ""}</div></div>`).join("");
		const body = ctx.openModal("rides", "Ride Control", `<div class="prc">${rows}
			<div class="prc-all"><button class="btn" id="prc-fast">Everything 2×</button><button class="btn" id="prc-ns">Everything non-stop</button><button class="btn" id="prc-reset">Back to normal</button></div>
			<p class="muted" style="margin:2px 0 0">Changes are for everyone in the park. On a ride: drag (or the arrow keys / joystick) to look all round, <b>F</b> switches between your own eyes and from behind, <b>C</b> looks ahead again, the mouse wheel zooms, <b>Esc</b> gets off.</p></div>`, 580, () => { panelOpen = false; });
		panelOpen = true;
		body.querySelectorAll(".prc-row").forEach(row => {
			const id = row.dataset.r;
			row.querySelectorAll("[data-sp]").forEach(b => b.onclick = () => { setRide(id, { sp: +b.dataset.sp }); renderPanel(); });
			const nb = row.querySelector("[data-ns]");
			if (nb) nb.onclick = () => { setRide(id, { ns: !cfgOf(id).ns }); renderPanel(); };
		});
		body.querySelector("#prc-fast").onclick = () => { RIDES.forEach(r => { if (spOf(cfgOf(r.id)) !== 2) setRide(r.id, { sp: 2 }); }); renderPanel(); };
		body.querySelector("#prc-ns").onclick = () => { RIDES.forEach(r => { const c = cfgOf(r.id); if (r.ns && !c.ns) setRide(r.id, { ns: true }); if (!spOf(c)) setRide(r.id, { sp: 1 }); }); renderPanel(); };
		body.querySelector("#prc-reset").onclick = () => { RIDES.forEach(r => { const c = cfgOf(r.id); if (spOf(c) !== 1 || c.ns) setRide(r.id, { sp: 1, ns: false }); }); renderPanel(); };
		const fr = focus && body.querySelector(`[data-r="${focus}"]`);
		if (fr) setTimeout(() => fr.scrollIntoView({ block: "nearest" }), 30);
		renderPanel();
	}
	function renderPanel() {
		if (!panelOpen || ctx.modalKind() !== "rides") { panelOpen = false; return; }
		const body = document.getElementById("mbody");
		if (!body) return;
		body.querySelectorAll(".prc-row").forEach(row => {
			const id = row.dataset.r, c = cfgOf(id), sp = spOf(c);
			const riders = (SEATS[id] || []).filter(s => ctx.whoSits(s) || ctx.me().sit === s).length;
			row.querySelector(".prc-st").textContent = rideStatus(id) + (riders ? ` · ${riders} riding` : "");
			row.querySelectorAll("[data-sp]").forEach(b => b.classList.toggle("primary", +b.dataset.sp === sp));
			const nb = row.querySelector("[data-ns]");
			if (nb) { nb.classList.toggle("primary", !!c.ns); nb.textContent = c.ns ? "Non-stop: on" : "Non-stop: off"; }
		});
	}
	// someone else changed a ride: say so (if you're in the park to see it)
	const seenCfg = {};
	let cfgReady = false;
	function watchCfg() {
		RIDES.forEach(r => {
			const c = cfgOf(r.id);
			if (seenCfg[r.id] === c) return;
			seenCfg[r.id] = c;
			if (!cfgReady || c === DEF_CFG || !inPark()) return;
			if (c.by && c.by !== ((ctx.profile() && ctx.profile().name) || "")) ctx.notice(`<b>${ctx.esc(String(c.by).slice(0, 24))}</b> set the ${r.name} to <b>${spOf(c) ? speedName(spOf(c)) + " speed" : "stopped"}</b>${c.ns ? ", non-stop" : ""}.`);
		});
		cfgReady = true;
		renderPanel();
	}

	// ================================================================ carts, games, benches, balloons, lamps, trees
	// popcorn
	{
		const pc = group(g, 2.6, 0, 14.3, Math.PI);
		add(pc, rbox(1.2, 0.8, 0.7, 0.05), mat("#e63946", 0.5), 0, 0.75, 0);
		for (const sx of [-0.5, 0.5]) add(pc, new THREE.CylinderGeometry(0.22, 0.22, 0.08, 16), dark, sx, 0.22, 0.38, { rz: Math.PI / 2, cast: false });
		const glass = new THREE.MeshPhysicalMaterial({ color: "#fff8e6", transparent: true, opacity: 0.3, roughness: 0.05, depthWrite: false });
		add(pc, new THREE.BoxGeometry(1.0, 0.7, 0.55), glass, 0, 1.5, 0, { cast: false });
		for (let i = 0; i < 40; i++) add(pc, new THREE.IcosahedronGeometry(0.05, 0), mat("#fff1c1", 0.8), (R() - 0.5) * 0.85, 1.2 + R() * 0.25, (R() - 0.5) * 0.4, { cast: false });
		add(pc, new THREE.ConeGeometry(0.75, 0.4, 4), mat("#ffffff", 0.6, 0, { map: canvasTex(128, 32, (c, w, h) => { for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? "#ffffff" : "#e63946"; c.fillRect(i * w / 8, 0, w / 8 + 1, h); } }) }), 0, 2.05, 0, { ry: Math.PI / 4 });
		add(pc, new THREE.PlaneGeometry(0.9, 0.22), sign("POPCORN", { w: 512, h: 128, color: "#ffe066", font: "900 92px Nunito, 'Segoe UI', sans-serif" }), 0, 0.85, 0.36, { cast: false, receive: false });
		k.box(2.6 - 0.65, 2.6 + 0.65, 14.3 - 0.45, 14.3 + 0.45);
		k.interact("park:popcorn", {
			label: () => ctx.me().holding === "popcorn" ? "Get a fresh bucket of popcorn" : "Get some popcorn", stand: [2.6, 13.25], face: 0,
			use: () => {
				const me = ctx.me();
				if (me.holding === "mug" || me.holding === "flower") { ctx.notice("Your hands are full - put that down first."); return; }
				me.holding = "popcorn"; me.sips = 6;
				ctx.doUpper("give", 900);
				ctx.updateProps(); ctx.sendPose(true);
				ctx.sfx("pop", 0.6);
				ctx.notice("You got a bucket of popcorn. <b>G</b> to eat some, or click someone to share it.");
			}
		}, pc);
	}
	// sweets
	{
		const sc = group(g, -9.6, 0, 13.4, Math.PI);
		add(sc, rbox(1.6, 0.95, 0.8, 0.05), mat("#ff9ebb", 0.55), 0, 0.48, 0);
		add(sc, rbox(1.75, 0.06, 0.95, 0.02), mat("#fff4e6", 0.5), 0, 0.98, 0);
		for (const sx of [-0.78, 0.78]) add(sc, new THREE.CylinderGeometry(0.035, 0.035, 1.5, 8), chrome, sx, 1.75, -0.3, { cast: false });
		const awn = canvasTex(256, 64, (c, w, h) => { for (let i = 0; i < 10; i++) { c.fillStyle = i % 2 ? "#fff4e6" : "#ff5d8f"; c.fillRect(i * w / 10, 0, w / 10 + 1, h); } });
		add(sc, new THREE.PlaneGeometry(1.9, 1.0), mat("#ffffff", 0.8, 0, { map: awn, side: THREE.DoubleSide }), 0, 2.45, 0.1, { rx: -1.1 });
		// candy floss clouds, lollipops, ice cream cones
		for (let i = 0; i < 3; i++) { add(sc, new THREE.CylinderGeometry(0.01, 0.01, 0.35, 6), mat("#fff4e6"), -0.55 + i * 0.18, 1.18, -0.2, { cast: false }); add(sc, new THREE.IcosahedronGeometry(0.15, 1), mat(["#ffb3d1", "#bde0fe", "#e0aaff"][i], 0.95), -0.55 + i * 0.18, 1.42, -0.2, { cast: false }); }
		for (let i = 0; i < 4; i++) { add(sc, new THREE.CylinderGeometry(0.008, 0.008, 0.3, 6), mat("#ffffff"), 0.2 + i * 0.15, 1.13, -0.1, { cast: false }); add(sc, new THREE.CylinderGeometry(0.07, 0.07, 0.02, 16), mat(BULBS[i], 0.4), 0.2 + i * 0.15, 1.3, -0.1, { rx: Math.PI / 2, cast: false }); }
		add(sc, new THREE.PlaneGeometry(1.2, 0.3), sign("Sweets", { w: 512, h: 128, color: "#ffffff", glow: "#ff5d8f", font: "800 96px 'Caveat', 'Nunito', cursive" }), 0, 0.6, 0.41, { cast: false, receive: false });
		k.box(-9.6 - 0.85, -9.6 + 0.85, 13.4 - 0.5, 13.4 + 0.5);
		k.interact("park:sweets", { label: "Get something sweet", stand: [-9.6, 12.3], face: 0, reach: 2.2, use: () => ctx.foodMenu("Sweets cart", ["icecream", "marshmallow", "cookie", "strawberry", "apple", "juice"]) }, sc);
	}
	// the strength tester: hit the pad, the puck flies up the post, ring the bell at the top
	const STR = { x: -17.4, z: 3.5 };
	const striker = { y: 0, v: 0, ring: 0 };
	{
		const sg = group(g, STR.x, 0, STR.z, Math.PI / 2);
		add(sg, rbox(0.5, 0.25, 0.6, 0.04), dark, 0, 0.12, 0.35);
		add(sg, rbox(0.38, 0.06, 0.38, 0.03), mat("#e63946", 0.4), 0, 0.27, 0.35);
		add(sg, rbox(0.3, 4.4, 0.14, 0.04), mat("#fff4e6", 0.6), 0, 2.2, 0);
		const scale = canvasTex(64, 1024, (c, w, h) => {
			for (let i = 0; i < 10; i++) { c.fillStyle = `hsl(${120 - i * 13},90%,55%)`; c.fillRect(6, h - (i + 1) * h / 10 + 3, w - 12, h / 10 - 6); }
			c.fillStyle = "#2b1d3a"; c.font = "900 34px Nunito, sans-serif"; c.textAlign = "center";
			for (let i = 1; i <= 10; i++) c.fillText(String(i * 10), w / 2, h - (i - 0.5) * h / 10 + 12);
		});
		add(sg, new THREE.PlaneGeometry(0.22, 3.6), new THREE.MeshBasicMaterial({ map: scale, toneMapped: false }), 0, 2.2, 0.075, { cast: false, receive: false });
		var bell = add(sg, new THREE.SphereGeometry(0.22, 16, 10, 0, TAU, 0, Math.PI / 2), mat("#ffd166", 0.2, 0.9), 0, 4.62, 0.05);
		var puck = add(sg, rbox(0.18, 0.12, 0.08, 0.03), mat("#ff4d6d", 0.3, 0.3), 0, 0.45, 0.13, { cast: false });
		add(sg, new THREE.PlaneGeometry(1.1, 0.3), sign("Strength-o-meter", { w: 1024, h: 256, color: "#ffe066", font: "800 120px 'Caveat', 'Nunito', cursive" }), 0, 4.95, 0.08, { cast: false, receive: false });
		const mallet = group(sg, 0.45, 0, 0.55);
		add(mallet, new THREE.CylinderGeometry(0.03, 0.03, 0.9, 8), mat("#8a5a3c", 0.6), 0, 0.45, 0, { cast: false });
		add(mallet, new THREE.CylinderGeometry(0.11, 0.11, 0.3, 12), mat("#e63946", 0.5), 0, 0.92, 0, { rz: Math.PI / 2, cast: false });
		k.box(STR.x - 0.35, STR.x + 0.35, STR.z - 0.35, STR.z + 0.35);
		k.box(STR.x + 0.05, STR.x + 0.7, STR.z - 0.4, STR.z + 0.4);
		const hit = power => { striker.v = Math.sqrt(2 * GRAV * Math.max(0.3, power * 4.15)) * 1.02; striker.y = 0; ctx.sfx("thunk", 0.6); };
		var strikeFx = hit;
		k.interact("park:striker", {
			label: "Test your strength!", stand: [STR.x + 1.3, STR.z], face: -Math.PI / 2, reach: 2.2,
			use: () => {
				// mostly middling, sometimes the bell
				const p = Math.min(1, 0.25 + Math.random() * 0.6 + (Math.random() < 0.3 ? 0.3 : 0));
				ctx.doUpper("jump", 900);
				hit(p);
				ctx.send({ t: "fx", kind: "zfx", zone: "park", what: "strike", p });
			}
		}, sg);
	}
	// benches (for two)
	const benchWood = mat("#8a5a3c", 0.55), benchIron = mat("#2e2b2b", 0.5, 0.5);
	[[-19.3, 9.0, Math.PI / 2], [-19.3, 12.6, Math.PI / 2], [19.3, 4.5, -Math.PI / 2], [19.3, 13.0, -Math.PI / 2], [-12.0, -10.8, 0], [-15.5, -10.8, 0]].forEach(([x, z, h], n) => {
		const b = group(g, x, 0.04, z, h);
		add(b, rbox(1.5, 0.07, 0.45, 0.02), benchWood, 0, 0.42, 0);
		add(b, rbox(1.5, 0.45, 0.06, 0.02), benchWood, 0, 0.72, -0.22, { rx: -0.12 });
		for (const sx of [-0.68, 0.68]) add(b, rbox(0.06, 0.42, 0.42, 0.02), benchIron, sx, 0.21, 0);
		const fx = Math.sin(h), fz = Math.cos(h), sx = Math.cos(h), sz = -Math.sin(h);
		const ids = [0, 1].map(i => { const id = "parkBench" + n + i, o = i ? 0.35 : -0.35; k.spot({ id, x: x + sx * o + fx * 0.05, z: z + sz * o + fz * 0.05, h, y: 0.04 }); return id; });
		const along = Math.abs(fx) > 0.5;
		k.box(x - (along ? 0.3 : 0.8), x + (along ? 0.3 : 0.8), z - (along ? 0.8 : 0.3), z + (along ? 0.8 : 0.3));
		k.interact("park:bench" + n, { label: "Sit on the bench", stand: [x + fx * 0.75, z + fz * 0.75], sit: ids }, b);
	});
	// a bunch of balloons tied to a cart
	const balloons = [];
	{
		const bc = group(g, 11.6, 0, 15.6);
		add(bc, rbox(0.7, 0.7, 0.5, 0.05), mat("#4cc9f0", 0.5), 0, 0.45, 0);
		add(bc, new THREE.CylinderGeometry(0.03, 0.03, 1.2, 8), chrome, 0, 1.4, 0, { cast: false });
		for (let i = 0; i < 12; i++) {
			const a = i / 12 * TAU, r = 0.25 + R() * 0.35, y = 2.6 + R() * 0.9;
			const bl = group(bc, 0, 0, 0);
			const top = new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r);
			const ball = add(bl, new THREE.SphereGeometry(0.2, 14, 10), mat(BULBS[i % BULBS.length], 0.25, 0, { emissive: BULBS[i % BULBS.length], emissiveIntensity: 0.25 }), top.x, top.y, top.z, { cast: false });
			ball.scale.set(1, 1.18, 1);
			beam(bl, new THREE.Vector3(0, 2.0, 0), new THREE.Vector3(top.x, top.y - 0.23, top.z), 0.005, mat("#ffffff"), { cast: false });
			bl.userData.ph = R() * 6;
			balloons.push(bl);
		}
		k.box(11.6 - 0.45, 11.6 + 0.45, 15.6 - 0.35, 15.6 + 0.35);
	}
	// lamp posts with glowing globes, and string lights across the middle
	const lampM = new THREE.MeshStandardMaterial({ color: "#fff6e0", emissive: "#ffd59a", emissiveIntensity: 2.2 });
	for (const [x, z] of [[3.8, 16.8], [10.2, 16.8], [-6.5, 15.5], [-15, 15.5], [5.2, 3.5], [-8, 2.5], [-18.5, -6], [-7.6, -11.2], [6.2, -11.8], [19.4, -0.5], [19.4, 8.5], [9.5, 9.5], [-18.5, 1.0], [5.6, -0.8]]) {
		const l = group(g, x, 0, z);
		add(l, new THREE.CylinderGeometry(0.05, 0.08, 3.0, 10), benchIron, 0, 1.5, 0);
		add(l, new THREE.SphereGeometry(0.2, 14, 10), lampM, 0, 3.15, 0, { cast: false });
		k.box(x - 0.12, x + 0.12, z - 0.12, z + 0.12);
	}
	const stringBulbs = [];
	{
		const strand = (a, b, sag) => {
			for (let i = 1; i < 20; i++) {
				const u = i / 20;
				const bb = add(g, new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshStandardMaterial({ color: "#ffffff", emissive: BULBS[i % BULBS.length], emissiveIntensity: 2 }), a[0] + (b[0] - a[0]) * u, 3.1 - Math.sin(u * Math.PI) * sag, a[1] + (b[1] - a[1]) * u, { cast: false });
				bb.userData.ph = i;
				stringBulbs.push(bb);
			}
		};
		strand([5.2, 3.5], [-8, 2.5], 0.7);
		strand([5.2, 3.5], [9.5, 9.5], 0.5);
		strand([-8, 2.5], [-6.5, 15.5], 0.9);
		strand([3.8, 16.8], [-6.5, 15.5], 0.8);
	}
	// round little trees in tubs
	for (const [x, z, s] of [[-19.2, 16.6, 1.0], [19.2, 16.6, 1.0], [-19.2, -8.5, 0.9], [19.2, -13.5, 0.85], [-6.8, -10.8, 0.8], [1.2, -10.8, 0.8], [-19.2, -1.8, 0.9]]) {
		const t = group(g, x, 0, z);
		add(t, new THREE.CylinderGeometry(0.42 * s, 0.34 * s, 0.5, 16), mat("#c86b4a", 0.7), 0, 0.25, 0);
		add(t, new THREE.CylinderGeometry(0.07, 0.09, 1.3 * s, 8), mat("#5a3a2a", 0.85), 0, 0.5 + 0.65 * s, 0);
		add(t, new THREE.IcosahedronGeometry(0.75 * s, 1), mat(R() < 0.5 ? "#3f8a4a" : "#4f9a54", 0.8), 0, 1.25 + 1.25 * s, 0);
		k.box(x - 0.45 * s, x + 0.45 * s, z - 0.45 * s, z + 0.45 * s);
	}

	// ================================================================ fireworks over the park, every 18 seconds (the same for everyone)
	const FW_EVERY = 18, FW_N = 110;
	const dot = canvasTex(32, 32, (c, w, h) => { const gr = c.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.35, "rgba(255,255,255,0.7)"); gr.addColorStop(1, "rgba(255,255,255,0)"); c.fillStyle = gr; c.fillRect(0, 0, w, h); });
	const shows = [0, 1].map(() => {
		const geo = new THREE.BufferGeometry();
		geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(FW_N * 3), 3));
		geo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(FW_N * 3), 3));
		const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.55, map: dot, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
		pts.frustumCulled = false;
		pts.visible = false;
		g.add(pts);
		return { pts, geo, n: -1, dirs: new Float32Array(FW_N * 3) };
	});
	let lastBoom = -1;
	function fireworks(t) {
		const n = Math.floor(t / FW_EVERY);
		[n, n - 1].forEach((sn, si) => {
			const S = shows[((sn % 2) + 2) % 2], u = t - sn * FW_EVERY;   // (two in the air at once at most)
			if (u < 0 || u > 4.2) { if (S.n === sn) S.pts.visible = false; return; }
			const r = rng(sn * 7 + 3);
			const cx = -10 + r() * 22, cz = -8 + r() * 18, cy = 17 + r() * 7;
			const hue = r(), hue2 = (hue + 0.3 + r() * 0.4) % 1;
			if (S.n !== sn) {
				S.n = sn;
				const dr = rng(sn * 13 + 1);
				for (let i = 0; i < FW_N; i++) {
					const z = dr() * 2 - 1, a = dr() * TAU, s = Math.sqrt(1 - z * z), sp = 5 + dr() * 2.5;
					S.dirs[i * 3] = Math.cos(a) * s * sp; S.dirs[i * 3 + 1] = z * sp; S.dirs[i * 3 + 2] = Math.sin(a) * s * sp;
					const c = new THREE.Color().setHSL(i % 3 ? hue : hue2, 1, 0.62);
					S.geo.attributes.color.setXYZ(i, c.r, c.g, c.b);
				}
				S.geo.attributes.color.needsUpdate = true;
			}
			const pos = S.geo.attributes.position;
			S.pts.visible = true;
			if (u < 1.3) {
				// the rocket going up, with a little trail
				const y = 1 + (cy - 1) * smooth(u / 1.3);
				for (let i = 0; i < FW_N; i++) pos.setXYZ(i, cx + Math.sin(i) * 0.04, y - (i % 12) * 0.12, cz);
				S.pts.material.opacity = 0.9;
				S.pts.material.size = 0.3;
			} else {
				const e = u - 1.3, drag = (1 - Math.exp(-e * 1.6)) / 1.6;
				for (let i = 0; i < FW_N; i++) pos.setXYZ(i, cx + S.dirs[i * 3] * drag, cy + S.dirs[i * 3 + 1] * drag - 1.4 * e * e, cz + S.dirs[i * 3 + 2] * drag);
				S.pts.material.opacity = Math.max(0, 1 - e / 2.9);
				S.pts.material.size = 0.55;
				if (si === 0 && lastBoom !== sn && e < 0.3) { lastBoom = sn; if (inPark()) { ctx.sfx("crash", 0.35); ctx.sfx("pop", 0.3); } }
			}
			pos.needsUpdate = true;
		});
	}

	// ================================================================ every frame
	const _cp = new THREE.Vector3(), _cq = new THREE.Quaternion(), _col = new THREE.Color();
	let lightT = 0, boardT = 0, sfxT = 0, prevS = 0, prevPh = 0, prevDrop = "wait", prevSw = 0, prevShipA = 0, prevShipTh = 0, prevSl = -1;
	function update(dt, t) {
		const now = clock();
		// the coaster
		const C = coaster();
		for (let c = 0; c < CARS; c++) { carPose(c, _cp, _cq); cars[c].position.copy(_cp); cars[c].quaternion.copy(_cq); }
		// Ferris wheel
		const fa = fwAngle();
		fwWheel.rotation.z = fa;
		fwGond.forEach((gg, i) => {
			const a = fa + i / FW.n * TAU;
			gg.position.set(Math.sin(a) * FW.R, FW.hub - Math.cos(a) * FW.R, 0);
			gg.rotation.z = Math.sin(t * 0.8 + i) * 0.03;
		});
		// carousel
		const ca = carAngle();
		carSpin.rotation.y = ca;
		const cT = rideT("carousel");
		horses.forEach((h, i) => { h.position.y = 0.3 + bob(i, cT); });
		// drop tower
		const D = dropState();
		carriage.position.y = D.y;
		dropBeacon.visible = D.stage === "top" ? Math.sin(t * 14) > 0 : true;
		// swings
		const S = swSpin();
		swTop.position.y = S.top;
		swTop.rotation.y = S.ang;
		swChairs.forEach((ch, i) => {
			const pv = chairPose(i, S, ch.position, ch.quaternion);
			const chain = swChains[i];
			chain.position.copy(pv).add(ch.position).multiplyScalar(0.5);
			chain.position.y += 0.15;
			chain.scale.set(1, SW_CHAIN - 0.3, 1);
			chain.quaternion.setFromUnitVectors(Y, _up);
		});
		// pirate ship
		const SP = shipState();
		shipBoat.rotation.z = SP.th;
		shipFlag.rotation.y = Math.sin(t * 3.1) * 0.25;
		// teacups
		const TS = teaState();
		teaSpin.rotation.y = TS.p;
		teaCups.forEach((c, i) => { c.rotation.y = cupAngle(i, TS) - TS.p; });
		// the strength tester's puck
		if (striker.v > 0 || striker.y > 0) {
			striker.y += striker.v * dt; striker.v -= GRAV * dt;
			if (striker.y >= 4.1) { striker.y = 4.1; striker.v = -1; striker.ring = 1; ctx.sfx("chime", 0.7); ctx.sfx("win", 0.4); }
			if (striker.y <= 0) { striker.y = 0; striker.v = 0; }
			puck.position.y = 0.45 + striker.y;
		}
		if (striker.ring > 0) { striker.ring = Math.max(0, striker.ring - dt * 0.6); bell.rotation.z = Math.sin(t * 30) * 0.2 * striker.ring; bell.material.emissive.set("#ffd166"); bell.material.emissiveIntensity = striker.ring * 2; }
		balloons.forEach(b => { b.rotation.z = Math.sin(t * 0.9 + b.userData.ph) * 0.05; b.rotation.x = Math.cos(t * 0.7 + b.userData.ph) * 0.05; });
		stringBulbs.forEach(b => { b.material.emissiveIntensity = 1.4 + 0.8 * Math.max(0, Math.sin(t * 2.5 - b.userData.ph * 0.6)); });
		fireworks(now);
		// the lights (not every frame: their colours only need to change a few times a second)
		lightT += dt;
		if (lightT > 0.08) {
			lightT = 0;
			for (let n = 0; n < trackLightN; n++) {
				_col.setHSL(((n / trackLightN) * 8 - now * 0.25) % 1 + 1, 1, 0.6);
				trackLights.setColorAt(n * 2, _col); trackLights.setColorAt(n * 2 + 1, _col);
			}
			trackLights.instanceColor.needsUpdate = true;
			for (let i = 0; i < 120; i++) { const on = ((i >> 1) + Math.floor(now * 8)) % 6 < 3; fwBulbs.setColorAt(i, _col.set(on ? BULBS[(i >> 1) % BULBS.length] : "#2a2030")); }
			fwBulbs.instanceColor.needsUpdate = true;
			for (let i = 0; i < 160; i++) { const j = i % 40, lit = D.stage === "fall" || D.stage === "brake" ? (j + Math.floor(now * 30)) % 4 === 0 : Math.abs(j - D.y / DROP.H * 40) < 3 || (j + Math.floor(now * 6)) % 10 === 0; dropLights.setColorAt(i, _col.set(lit ? (D.stage === "top" ? "#ff3355" : "#fff1c1") : "#3a2a48")); }
			dropLights.instanceColor.needsUpdate = true;
			for (let i = 0; i < 44; i++) archLights.setColorAt(i, _col.set(((i >> 1) + Math.floor(now * 5)) % 4 ? BULBS[(i >> 1) % BULBS.length] : "#ffffff"));
			archLights.instanceColor.needsUpdate = true;
			for (let i = 0; i < 60; i++) shipBulbs.setColorAt(i, _col.set(((i >> 1) + Math.floor(now * 7)) % 5 < 2 ? "#fff1c1" : BULBS[(i >> 1) % BULBS.length]));
			shipBulbs.instanceColor.needsUpdate = true;
		}
		boardT += dt;
		if (boardT > 0.5) {
			boardT = 0;
			watchCfg();
			if (C.boarding) drawBoard(C.left > 3 ? `Boarding: ${Math.ceil(C.left)}s` : "Hold on tight!", "Moonlight Express - all aboard");
			else drawBoard(`Back in ${Math.ceil(C.left)}s`, "The train is round the house");
		}
		// riding: sounds, hands up on the big moments
		sfxT -= dt;
		if (seated("coaster")) {
			if (C.ph >= DWELL && prevPh < DWELL) { ctx.sfx("go", 0.5); }
			if (!C.boarding) {
				const v = V[Math.min(N - 1, Math.floor(C.s / DS))];
				if (C.s < sCrest && sfxT <= 0) { ctx.sfx("clack", 0.35); sfxT = 0.38; }
				if (C.s >= sCrest && sfxT <= 0) { ctx.sfx("roll", Math.min(0.9, 0.2 + v / 20)); sfxT = 1.6; }
				if (prevS < sCrest && C.s >= sCrest) { ctx.sfx("whoosh", 0.8); ctx.doUpper("cheer", 3200); }
				const sLoop = iLoopA * DS;
				if (prevS < sLoop && C.s >= sLoop) { ctx.sfx("whoosh", 0.7); ctx.doUpper("cheer", 2600); }
			}
			if (C.ph < prevPh && C.ph < DWELL) { ctx.sfx("yes", 0.5); ctx.notice("What a ride! Stay in your seat to go round again, or stand up to get off."); }
		}
		if (seated("drop")) {
			if (D.stage === "up" && sfxT <= 0) { ctx.sfx("clack", 0.25); sfxT = 0.5; }
			if (D.stage === "fall" && prevDrop !== "fall") { ctx.sfx("whoosh", 0.9); ctx.doUpper("cheer", 2500); }
			if (D.stage === "wait" && prevDrop === "brake") ctx.sfx("yes", 0.45);
		}
		if (seated("starSwing") && S.w > 0 && prevSw === 0) ctx.sfx("go", 0.4);
		if (seated("ship")) {
			if (SP.A > 0 && prevShipA === 0) ctx.sfx("go", 0.4);
			// a whoosh at the bottom of every big swing, a cheer at the top of the biggest
			if (SP.A > 0.5 && Math.sign(SP.th) !== Math.sign(prevShipTh) && prevShipTh !== 0) ctx.sfx("whoosh", Math.min(0.8, 0.3 + SP.A * 0.4));
			if (SP.A > 1.0 && Math.abs(SP.th) > 1.05 && Math.abs(prevShipTh) <= 1.05) ctx.doUpper("cheer", 1600);
		}
		if (seated("teacup") && sfxT <= 0 && spOf(cfgOf("cups")) > 0) { ctx.sfx("roll", 0.2); sfxT = 2.4; }
		const mySl = ctx.me().sit && ctx.me().sit.indexOf("slide") === 0 ? slidePh(+ctx.me().sit.slice(5)) : -1;
		if (mySl >= SL_SIT && prevSl >= 0 && prevSl < SL_SIT) ctx.sfx("whoosh", 0.7);
		if (mySl >= SL_DOWN && prevSl >= 0 && prevSl < SL_DOWN) ctx.sfx("pop", 0.4);
		prevSl = mySl;
		prevS = C.s; prevPh = C.ph; prevDrop = D.stage; prevSw = S.w; prevShipA = SP.A; prevShipTh = SP.th;
	}

	return {
		update,
		// up on the coaster or the Ferris wheel or the drop tower you can see the whole house
		wide: () => seated("coaster") || seated("ferris") || seated("drop") || seated("ship") || seated("starSwing"),
		onFx(d) { if (d.what === "strike") strikeFx(Math.max(0, Math.min(1, +d.p || 0))); },
		promptOpts(opts) {
			const me = ctx.me();
			const free = key => !opts.some(o => o.k === key);
			if (me.sit && /^(coaster|drop|starSwing|carousel|ferris|ship|teacup|slide)/.test(me.sit) && free("G")) opts.push({ k: "G", label: "Hands up!", fn: () => { ctx.doUpper("cheer", 2400); ctx.sfx("laugh", 0.3); } });
			const r = myRide();
			if (r && free("R")) opts.push({ k: "R", label: "Ride controls", fn: () => openPanel(r.id) });
		}
	};
}
