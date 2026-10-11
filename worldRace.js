/**
 * Harmony World — the Harmony Grand Prix: a big race track out in the far west of the grounds, past the ring road
 * (its line is RACE in worldEstate.js). About a kilometre of asphalt with red and white kerbs, a start / finish gantry
 * with race lights, a grandstand, a leaderboard, and a paddock of race cars in the infield (worldCars.js).
 *
 * Hurdles on the way, to sort out the best drivers: cone slaloms, barrier chicanes that block half the track (left,
 * right, left), tyre gates with two narrow lanes, and boost pads that throw you forward (into the next corner).
 *
 * Driving: on the asphalt a car is quicker (top speed and pick-up); out on the grass round it, much slower.
 * Every lap you drive round (through all the sectors, in order) is timed; the fastest laps go up on the leaderboard
 * (shared: "race:best", { name: { n, t, car } }). Anyone driving out here can start a race (G): the lights count down
 * (everyone's car on the circuit is held on the brakes), then it's three laps; the first back wins. The start and each
 * finish go to everyone as zfx messages, so everyone sees the same race.
 *
 * Built by the grounds (worldGrounds.js) into their group: world coordinates.
 */
import { RACE, RACE_ROAD, racePath, raceAt, inRect } from "./worldEstate.js";

const LAPS = 3, SECTORS = 10, COUNT = 5;   // (the countdown: five red lights, one a second, then green)
const fmt = ms => { ms = Math.max(0, Math.round(ms)); const m = Math.floor(ms / 60000), s = (ms % 60000) / 1000; return m + ":" + (s < 10 ? "0" : "") + s.toFixed(2); };
const ord = n => n + (n % 10 === 1 && n % 100 !== 11 ? "st" : n % 10 === 2 && n % 100 !== 12 ? "nd" : n % 10 === 3 && n % 100 !== 13 ? "rd" : "th");

export function buildRace(k, { PATH_Y }) {
	const { THREE, add, mat, group, rbox, g, ctx, canvasTex, rng } = k;
	const R = rng(4242);
	const L = racePath(), LEN = L.len, HW = RACE.hw;
	const glow = c => new THREE.MeshBasicMaterial({ color: c, toneMapped: false });
	const repeat = t => { t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };
	// a point on the track: s metres round from the line, u across (+: the left of the way round) -> [x, z, tx, tz]
	function at(s, u = 0) {
		s = ((s % LEN) + LEN) % LEN;
		let lo = 0, hi = L.length - 1;
		while (lo < hi) { const m = (lo + hi + 1) >> 1; if (L[m][4] <= s) lo = m; else hi = m - 1; }
		const a = L[lo], b = L[(lo + 1) % L.length], span = ((b[4] - a[4]) + LEN) % LEN || 1, f = (s - a[4]) / span;
		const x = a[0] + (b[0] - a[0]) * f, z = a[1] + (b[1] - a[1]) * f;
		let tx = a[2] + (b[2] - a[2]) * f, tz = a[3] + (b[3] - a[3]) * f;
		const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
		return [x + tz * u, z - tx * u, tx, tz];
	}
	const sOf = (x, z) => raceAt(x, z).s;
	// the heading (as a car's h: facing (sin h, cos h)) along the way round at s
	const headAt = s => { const p = at(s); return Math.atan2(p[2], p[3]); };

	// ================================================================ the track: asphalt with white edge lines, kerbs on the bends
	const RY = PATH_Y + 0.002;
	function ribbon(u0, u1, y, vScale, uv = (i, side) => null) {
		const pos = [], nor = [], uvs = [], idx = [];
		const n = L.length;
		for (let i = 0; i <= n; i++) {
			const p = L[i % n], s = i < n ? p[4] : LEN;
			const nx = p[3], nz = -p[2];
			pos.push(p[0] + nx * u0, y, p[1] + nz * u0, p[0] + nx * u1, y, p[1] + nz * u1);
			nor.push(0, 1, 0, 0, 1, 0);
			uvs.push(0, s / vScale, 1, s / vScale);
			if (i) { const b = (i - 1) * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
		}
		const geo = new THREE.BufferGeometry();
		geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
		geo.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
		geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
		geo.setIndex(idx);
		// (make sure it faces up)
		geo.computeVertexNormals();
		if (geo.attributes.normal.getY(0) < 0) { for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; } geo.setIndex(idx); }
		geo.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
		geo.computeBoundingSphere();
		return geo;
	}
	{
		const trackTex = repeat(canvasTex(512, 512, (c, w, h) => {
			c.fillStyle = "#34333a"; c.fillRect(0, 0, w, h);
			const r = rng(91);
			for (let i = 0; i < 26000; i++) { const t = 34 + r() * 44; c.fillStyle = `rgba(${t + 6},${t + 5},${t + 10},0.55)`; c.fillRect(r() * w, r() * h, 2, 2); }
			// the racing line, rubbered in a little darker
			const gr = c.createLinearGradient(w * 0.3, 0, w * 0.7, 0); gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(0.5, "rgba(0,0,0,0.16)"); gr.addColorStop(1, "rgba(0,0,0,0)");
			c.fillStyle = gr; c.fillRect(w * 0.3, 0, w * 0.4, h);
			c.fillStyle = "#f1eee6";
			c.fillRect(w * 0.025, 0, w * 0.014, h); c.fillRect(w * 0.961, 0, w * 0.014, h);
		}));
		const track = new THREE.Mesh(ribbon(-HW, HW, RY, 12), mat("#ffffff", 0.88, 0, { map: trackTex }));
		track.receiveShadow = true;
		track.userData.floor = true;
		g.add(track);
		// a strip of gravel-coloured run-off either side (so the track sits in its own space, not straight on the lawn)
		const runM = mat("#b9a98c", 1, 0, { map: repeat(canvasTex(256, 256, (c, w, h) => { c.fillStyle = "#a99a7e"; c.fillRect(0, 0, w, h); const r = rng(5); for (let i = 0; i < 5000; i++) { const t = 120 + r() * 90; c.fillStyle = `rgb(${t},${t - 10},${t - 28})`; c.fillRect(r() * w, r() * h, 3, 3); } })) });
		for (const sd of [-1, 1]) { const m = new THREE.Mesh(ribbon(sd * HW, sd * (HW + 2.6), RY - 0.001, 6), runM); m.receiveShadow = true; m.userData.floor = true; g.add(m); }
		// kerbs on the bends: red and white blocks along the inside of each edge
		const kerbTex = repeat(canvasTex(64, 128, (c, w, h) => { c.fillStyle = "#e23a4b"; c.fillRect(0, 0, w, h / 2); c.fillStyle = "#f4f1ea"; c.fillRect(0, h / 2, w, h / 2); }));
		const kerbM = mat("#ffffff", 0.6, 0, { map: kerbTex });
		const pos = [], uvs = [], idx = [];
		const curv = i => { const a = L[(i - 4 + L.length) % L.length], b = L[(i + 4) % L.length]; return Math.abs(Math.atan2(a[2] * b[3] - a[3] * b[2], a[2] * b[2] + a[3] * b[3])) / Math.max(1, Math.hypot(b[0] - a[0], b[1] - a[1])); };
		for (const sd of [-1, 1]) {
			let open = false;
			for (let i = 0; i <= L.length; i++) {
				const p = L[i % L.length], bend = curv(i % L.length) > 1 / 70;
				if (bend) {
					const nx = p[3], nz = -p[2], u0 = sd * (HW - 0.95), u1 = sd * (HW + 0.25), v = (i < L.length ? p[4] : LEN) / 2.4;
					const base = pos.length / 3;
					pos.push(p[0] + nx * u0, RY + 0.012, p[1] + nz * u0, p[0] + nx * u1, RY + 0.012, p[1] + nz * u1);
					uvs.push(0, v, 1, v);
					if (open) { const b = base - 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
					open = true;
				} else open = false;
			}
		}
		if (idx.length) {
			const geo = new THREE.BufferGeometry();
			geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
			geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
			geo.setIndex(idx);
			geo.computeVertexNormals();
			const nrm = geo.attributes.normal;
			let flip = false;
			for (let i = 0; i < nrm.count; i++) if (nrm.getY(i) < 0) { flip = true; break; }
			if (flip) { for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; } geo.setIndex(idx); geo.computeVertexNormals(); }
			const kerb = new THREE.Mesh(geo, kerbM);
			kerb.receiveShadow = true;
			kerb.material.side = THREE.DoubleSide;
			g.add(kerb);
		}
		// the road in from the ring (asphalt, a dashed centre line) to the top of the main straight
		const roadTex = repeat(canvasTex(512, 256, (c, w, h) => {
			c.fillStyle = "#3b3a40"; c.fillRect(0, 0, w, h);
			const r = rng(32);
			for (let i = 0; i < 9000; i++) { const t = 38 + r() * 46; c.fillStyle = `rgba(${t + 8},${t + 6},${t + 12},0.55)`; c.fillRect(r() * w, r() * h, 2, 2); }
			c.fillStyle = "#e9e6dc"; c.fillRect(0, h * 0.035, w, h * 0.022); c.fillRect(0, h * 0.943, w, h * 0.022);
			c.fillStyle = "#f2c14e"; c.fillRect(0, h * 0.49, w * 0.5, h * 0.02);
		}));
		const rl = RACE_ROAD.x1 - (RACE_ROAD.x0 + HW - 0.2);
		const road = add(g, new THREE.PlaneGeometry(rl, 6.4), mat("#ffffff", 0.9, 0, { map: roadTex }), RACE_ROAD.x1 - rl / 2, PATH_Y - 0.002, RACE_ROAD.z, { rx: -Math.PI / 2, cast: false });
		road.material.map.repeat.set(rl / 8, 1);
		road.userData.floor = true;
	}

	// ================================================================ the start / finish: a chequered line, the grid, the gantry with its lights
	const lights = [];
	let goLight = null;
	{
		const chk = canvasTex(256, 32, (c, w, h) => { for (let i = 0; i < 16; i++) for (let j = 0; j < 2; j++) { c.fillStyle = (i + j) % 2 ? "#141218" : "#f6f3ec"; c.fillRect(i * 16, j * 16, 16, 16); } });
		const [x0, z0, tx, tz] = at(0);
		add(g, new THREE.PlaneGeometry(HW * 2, 1.0), new THREE.MeshBasicMaterial({ map: chk, toneMapped: false }), x0, RY + 0.006, z0, { rx: -Math.PI / 2, ry: 0, cast: false, receive: false }).rotation.z = Math.atan2(tx, tz);
		// the grid: two by two behind the line
		const gridM = new THREE.MeshBasicMaterial({ color: "#f4f1ea", toneMapped: false, transparent: true, opacity: 0.85 });
		for (let i = 0; i < 6; i++) {
			const [x, z, ttx, ttz] = at(-7 - i * 6.5, i % 2 ? -2.8 : 2.8);
			const m = add(g, new THREE.PlaneGeometry(2.6, 0.18), gridM, x, RY + 0.006, z, { rx: -Math.PI / 2, cast: false, receive: false });
			m.rotation.z = Math.atan2(ttx, ttz);
			const num = add(g, new THREE.PlaneGeometry(1.2, 1.2), new THREE.MeshBasicMaterial({ map: k.tex.text(String(i + 1), { w: 256, h: 256, color: "#f4f1ea", font: "900 200px Nunito, 'Segoe UI', sans-serif" }), transparent: true, toneMapped: false, depthWrite: false }), x - ttx * 1.4, RY + 0.007, z - ttz * 1.4, { rx: -Math.PI / 2, cast: false, receive: false });
			num.rotation.z = Math.atan2(ttx, ttz) + Math.PI;
		}
		// the gantry over the line (the main straight runs along z here, so it's square across it)
		const h = Math.atan2(tx, tz), gx = HW + 1.6;
		const gg = group(g, x0, 0, z0, h);
		const steel = mat("#2c2a33", 0.4, 0.6), white = mat("#f2efe8", 0.5, 0.1);
		for (const sx of [-gx, gx]) {
			add(gg, rbox(0.5, 6.6, 0.5, 0.06), white, sx, 3.3, 0);
			add(gg, rbox(0.9, 0.3, 0.9, 0.05), steel, sx, 0.15, 0);
			const [px, pz] = [x0 + Math.cos(h) * sx, z0 - Math.sin(h) * sx];
			k.box(px - 0.3, px + 0.3, pz - 0.3, pz + 0.3);
		}
		add(gg, rbox(gx * 2 + 0.6, 1.2, 0.6, 0.08), steel, 0, 6.4, 0);
		const banner = new THREE.MeshBasicMaterial({ map: k.tex.text("GRAND PRIX", { w: 2048, h: 256, color: "#ffffff", bg: "#c1123a", font: "900 150px Nunito, 'Segoe UI', sans-serif" }), toneMapped: false });
		for (const sd of [-1, 1]) add(gg, new THREE.PlaneGeometry(gx * 2 - 0.4, 1.0), banner, 0, 6.4, sd * 0.31, { ry: sd > 0 ? 0 : Math.PI, cast: false, receive: false });
		// the lights: five pods under the beam (red as the count goes down, green to go), facing back down the grid
		const podM = mat("#141218", 0.5, 0.3);
		for (let i = 0; i < 5; i++) {
			const lx = (i - 2) * 1.3;
			add(gg, rbox(0.8, 0.95, 0.4, 0.08), podM, lx, 5.25, 0.15);
			const m = new THREE.MeshStandardMaterial({ color: "#3a0a10", emissive: "#ff1a2e", emissiveIntensity: 0, roughness: 0.3 });
			for (const sd of [-1, 1]) add(gg, new THREE.CircleGeometry(0.22, 20), m, lx, 5.25, 0.15 + sd * 0.205, { ry: sd > 0 ? 0 : Math.PI, cast: false, receive: false });
			lights.push(m);
		}
		goLight = new THREE.MeshStandardMaterial({ color: "#0a3a14", emissive: "#2bff6a", emissiveIntensity: 0, roughness: 0.3 });
		for (const sd of [-1, 1]) add(gg, new THREE.PlaneGeometry(gx * 2 - 1.2, 0.12), goLight, 0, 5.85, sd * 0.31, { ry: sd > 0 ? 0 : Math.PI, cast: false, receive: false });
	}

	// ================================================================ the grandstand beside the main straight (facing the track)
	{
		const [x0, x1, z0, z1] = RACE.stand, len = z1 - z0;
		const concrete = mat("#bdb6aa", 0.85), seatM = mat("#c1123a", 0.55), seatM2 = mat("#f2efe8", 0.55), steel = mat("#2c2a33", 0.4, 0.6);
		const st = group(g, 0, 0, 0);
		const rows = 4, depth = (x1 - x0) / rows;
		for (let r = 0; r < rows; r++) {
			const top = 0.45 + r * 0.55, xa = x0 + r * depth;
			add(st, new THREE.BoxGeometry(x1 - xa, top, len), concrete, (xa + x1) / 2, top / 2, (z0 + z1) / 2);
			const ids = [];
			const bench = add(st, rbox(0.42, 0.1, len - 0.6, 0.03), r % 2 ? seatM2 : seatM, xa + 0.45, top + 0.38, (z0 + z1) / 2, { cast: false });
			add(st, rbox(0.08, 0.38, len - 0.6, 0.03), r % 2 ? seatM2 : seatM, xa + 0.7, top + 0.6, (z0 + z1) / 2, { cast: false });
			for (let i = 0; i < 16; i++) {
				const id = "raceStand" + r + "_" + i, z = z0 + 1.2 + i * (len - 2.4) / 15;
				k.spot({ id, x: xa + 0.45, z, y: top + 0.04, h: -Math.PI / 2 });
				ids.push(id);
			}
			k.interact("race:stand" + r, { label: "Watch from the grandstand", stand: [x0 - 0.9, (z0 + z1) / 2 + (r - 1.5) * 6], sit: ids, reach: 30 }, bench);
		}
		// a roof on posts over the back rows
		for (const z of [z0 + 0.4, (z0 + z1) / 2, z1 - 0.4]) add(st, new THREE.CylinderGeometry(0.1, 0.12, 4.6, 10), steel, x1 - 0.3, 2.3 + 1.6, z);
		add(st, new THREE.BoxGeometry(x1 - x0 + 0.6, 0.15, len + 0.8), mat("#f2efe8", 0.5), (x0 + x1) / 2 + 0.3, 5.9, (z0 + z1) / 2).rotation.z = -0.08;
		const sign = new THREE.MeshBasicMaterial({ map: k.tex.text("GRANDSTAND", { w: 1024, h: 192, color: "#ffffff", glow: "#ff4d6d", font: "900 120px Nunito, 'Segoe UI', sans-serif" }), transparent: true, toneMapped: false });
		add(st, new THREE.PlaneGeometry(8, 1.5), sign, x0 - 0.35, 6.7, (z0 + z1) / 2, { ry: -Math.PI / 2, cast: false, receive: false });
		k.wall(x0, x1, z0, z1, 0, 2.7);
	}

	// ================================================================ the paddock in the infield (worldCars.js parks the race cars on it)
	{
		const [x0, x1, z0, z1] = RACE.paddock;
		const asphalt = canvasTex(256, 256, (c, w, h) => { c.fillStyle = "#3a3740"; c.fillRect(0, 0, w, h); const r = rng(8); for (let i = 0; i < 4000; i++) { const t = 40 + r() * 40; c.fillStyle = `rgba(${t + 10},${t + 6},${t + 14},0.5)`; c.fillRect(r() * w, r() * h, 2, 2); } }, 3, 6);
		add(g, new THREE.PlaneGeometry(x1 - x0, z1 - z0), mat("#ffffff", 0.92, 0, { map: asphalt }), (x0 + x1) / 2, RY + 0.003, (z0 + z1) / 2, { rx: -Math.PI / 2, cast: false }).userData.floor = true;
		const paint = new THREE.MeshBasicMaterial({ color: "#efe9dc", toneMapped: false, transparent: true, opacity: 0.75 });
		for (let z = z0 + 1.0; z < z1; z += 6.4) add(g, new THREE.PlaneGeometry(x1 - x0 - 2, 0.12), paint, (x0 + x1) / 2, RY + 0.008, z, { rx: -Math.PI / 2, cast: false, receive: false });
		const sg = group(g, x0 + 0.8, 0, (z0 + z1) / 2, Math.PI / 2);
		add(sg, new THREE.CylinderGeometry(0.05, 0.06, 2.4, 8), mat("#2e2a31", 0.45, 0.4), 0, 1.2, 0);
		add(sg, rbox(2.2, 0.7, 0.06, 0.03), mat("#2e2a31", 0.5, 0.3), 0, 2.4, 0);
		for (const sd of [-1, 1]) add(sg, new THREE.PlaneGeometry(2.0, 0.6), new THREE.MeshBasicMaterial({ map: k.tex.text("RACE CARS", { w: 768, h: 192, color: "#ffffff", glow: "#ffd166", font: "900 120px Nunito, 'Segoe UI', sans-serif" }), transparent: true, toneMapped: false }), 0, 2.4, sd * 0.035, { ry: sd > 0 ? 0 : Math.PI, cast: false, receive: false });
		k.box(x0 + 0.7, x0 + 0.9, (z0 + z1) / 2 - 0.1, (z0 + z1) / 2 + 0.1);
	}

	// ================================================================ hurdles on the track
	// each one at a spot on the line (a world point: its s), across at u. Solid ones are chains of little boxes (the
	// colliders are axis-aligned: a long thing at an angle would block far too much as one box).
	const solidLine = (ax, az, bx, bz, r) => {
		const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 0.45));
		for (let i = 0; i <= n; i++) { const x = ax + (bx - ax) * i / n, z = az + (bz - az) * i / n; k.box(x - r, x + r, z - r, z + r); }
	};
	const boosts = [];   // [s, u]
	{
		const coneM = mat("#ff6b1a", 0.5), stripeM = mat("#f6f3ec", 0.5), baseM = mat("#1b1a1e", 0.8);
		const coneGeo = new THREE.ConeGeometry(0.3, 0.85, 16), bandGeo = new THREE.CylinderGeometry(0.17, 0.205, 0.12, 16), baseGeo = new THREE.BoxGeometry(0.62, 0.05, 0.62);
		const cone = (s, u) => {
			const [x, z] = at(s, u);
			const c = group(g, x, 0, z);
			add(c, baseGeo, baseM, 0, 0.025, 0, { cast: false });
			add(c, coneGeo, coneM, 0, 0.47, 0);
			add(c, bandGeo, stripeM, 0, 0.55, 0, { cast: false });
			k.box(x - 0.3, x + 0.3, z - 0.3, z + 0.3);
		};
		// a row of cones from one edge (side: +1 the left, -1 the right) to a little past the middle: the next row comes in
		// from the other edge, so the only way through is to weave
		const coneRow = (s, side) => { for (let u = HW - 0.5; u > -1.6; u -= 1.05) cone(s, side * u); };
		// a jersey barrier across the track from one edge (side: +1 the left edge, -1 the right), w metres long
		const barTex = repeat(canvasTex(256, 64, (c, w, h) => { for (let i = 0; i < 4; i++) { c.fillStyle = i % 2 ? "#f4f1ea" : "#d7263d"; c.fillRect(i * 64, 0, 64, h); } }));
		const barM = mat("#ffffff", 0.7, 0, { map: barTex });
		const barrier = (s, side, w) => {
			const ua = side * (HW + 0.3), ub = side * (HW + 0.3 - w);
			const [ax, az, tx, tz] = at(s, ua), [bx, bz] = at(s, ub);
			const mx = (ax + bx) / 2, mz = (az + bz) / 2;
			const b = add(g, rbox(w, 0.85, 0.6, 0.12), barM, mx, 0.43, mz);
			b.rotation.y = Math.atan2(tx, tz);   // (its length across the track)
			b.material.map.repeat.set(w / 2.4, 1);
			solidLine(ax, az, bx, bz, 0.32);
			// an arrow board on the end, pointing the way through
			const arrowTex = canvasTex(128, 128, (c, w2, h2) => { c.fillStyle = "#ffd166"; c.fillRect(0, 0, w2, h2); c.fillStyle = "#141218"; c.beginPath(); c.moveTo(30, 20); c.lineTo(80, 64); c.lineTo(30, 108); c.lineTo(50, 108); c.lineTo(100, 64); c.lineTo(50, 20); c.closePath(); c.fill(); });
			const ab = group(g, bx, 0, bz, Math.atan2(tx, tz) + Math.PI);
			add(ab, new THREE.CylinderGeometry(0.04, 0.04, 1.4, 6), mat("#2e2a31", 0.5, 0.3), 0, 0.7, 0, { cast: false });
			const face = add(ab, new THREE.PlaneGeometry(0.6, 0.6), new THREE.MeshBasicMaterial({ map: arrowTex, toneMapped: false }), 0, 1.25, 0.03, { cast: false, receive: false });
			if (side < 0) face.scale.x = -1;   // (it points at the gap: drawn pointing right)
		};
		// a stack of tyres (r: how wide the stack is across), solid
		const tyreGeo = new THREE.TorusGeometry(0.3, 0.13, 8, 18);
		const tyreM = mat("#1b1a1e", 0.85), tyreW = mat("#f4f1ea", 0.6);
		const tyres = (s, u0, u1) => {
			const n = Math.max(1, Math.round(Math.abs(u1 - u0) / 0.82));
			for (let i = 0; i < n; i++) {
				const u = u0 + (u1 - u0) * (i + 0.5) / n, [x, z] = at(s, u);
				for (let j = 0; j < 3; j++) add(g, tyreGeo, j === 1 ? tyreW : tyreM, x, 0.13 + j * 0.25, z, { rx: Math.PI / 2, cast: j === 2 });
				k.box(x - 0.42, x + 0.42, z - 0.42, z + 0.42);
			}
		};
		// boost pads: glowing chevrons on the asphalt (drive over one: whoosh)
		const boostTex = canvasTex(128, 256, (c, w, h) => {
			c.fillStyle = "rgba(20,10,40,0.85)"; c.fillRect(0, 0, w, h);
			c.strokeStyle = "#4cf0ff"; c.lineWidth = 14; c.lineJoin = "round";
			for (let i = 0; i < 3; i++) { const y = 200 - i * 70; c.beginPath(); c.moveTo(16, y); c.lineTo(64, y - 46); c.lineTo(112, y); c.stroke(); }
		});
		const boostM = new THREE.MeshBasicMaterial({ map: boostTex, toneMapped: false, transparent: true });
		const boostPad = (s, u) => {
			const [x, z, tx, tz] = at(s, u);
			const m = add(g, new THREE.PlaneGeometry(2.4, 4.2), boostM, x, RY + 0.009, z, { rx: -Math.PI / 2, cast: false, receive: false });
			m.rotation.z = Math.atan2(tx, tz) + Math.PI;
			boosts.push([((s % LEN) + LEN) % LEN, u]);
		};

		// 1. the main straight: a cone slalom (rows from alternate sides: weave right, left, right, left)
		for (let i = 0; i < 4; i++) coneRow(20 + i * 19, i % 2 ? -1 : 1);
		boostPad(sOf(-112, -98), 0);
		// 2. the long back straight along the south: a barrier chicane (right, left, right)
		{ const s = sOf(-205, -150); barrier(s, 1, 6.2); barrier(s + 24, -1, 6.2); barrier(s + 48, 1, 6.2); }
		boostPad(sOf(-300, -144), -1.5);
		// 3. the west side, heading north: a tyre gate (two narrow lanes either side of a stack in the middle)
		{ const s = sOf(-407, -50); tyres(s, -1.25, 1.25); tyres(s, -HW - 0.2, -HW + 2.0); tyres(s, HW - 2.0, HW + 0.2); }
		// 4. along the north: a second slalom, tighter, then a boost into the infield
		{ const s0 = sOf(-352, 25); for (let i = 0; i < 3; i++) coneRow(s0 + i * 15, i % 2 ? 1 : -1); }
		boostPad(sOf(-292, 22), 0);
		// 5. the infield twists: a barrier from each side, close together
		{ const s = sOf(-229, -30); barrier(s, -1, 5.6); barrier(s + 16, 1, 5.6); }
		// 6. and a last tyre gate before the run back to the line
		{ const s = sOf(-170, -73); tyres(s, -1.1, 1.1); }
		boostPad(sOf(-145, 24), 0);
	}

	// tyre walls along the outside of the fastest bends (stops anyone flying off into the trees; solid)
	{
		const wallM = mat("#1b1a1e", 0.85), wallW = mat("#e23a4b", 0.6);
		const tyreGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.9, 12);
		for (const [wx, wz, sd] of [[-128, -136, 1], [-392, -100, 1], [-398, 4, 1]]) {
			const s0 = sOf(wx, wz);
			for (let s = s0 - 18; s <= s0 + 18; s += 0.75) {
				// (which side is the outside: away from the bend's centre)
				const a = at(s - 3), b = at(s + 3), turn = a[2] * b[3] - a[3] * b[2];
				const side = turn > 0 ? 1 : -1, [x, z] = at(s, side * (HW + 3.2) * sd);
				add(g, tyreGeo, (Math.round(s / 0.75) % 2) ? wallW : wallM, x, 0.45, z, { cast: false });
				k.box(x - 0.34, x + 0.34, z - 0.34, z + 0.34);
			}
		}
	}

	// flags and lights round the circuit (just for show)
	{
		const poleM = mat("#d9d4cb", 0.5, 0.4), cols = ["#c1123a", "#ffd166", "#4cc9f0", "#9ef01a", "#f15bb5"];
		const flagGeo = new THREE.PlaneGeometry(1.1, 0.7);
		for (let s = 30, i = 0; s < LEN - 20; s += 46, i++) {
			const side = i % 2 ? 1 : -1, [x, z] = at(s, side * (HW + 4.4));
			if (inRect(RACE.stand, x, z, 2) || inRect(RACE.paddock, x, z, 2)) continue;
			add(g, new THREE.CylinderGeometry(0.04, 0.05, 4.2, 6), poleM, x, 2.1, z, { cast: false });
			const f = add(g, flagGeo, new THREE.MeshStandardMaterial({ color: cols[i % cols.length], roughness: 0.7, side: THREE.DoubleSide }), x + 0.55, 3.75, z, { cast: false, receive: false });
			f.rotation.y = R() * Math.PI;
			k.box(x - 0.08, x + 0.08, z - 0.08, z + 0.08);
		}
	}

	// ================================================================ the leaderboard (beside the line, facing the track)
	const boardC = document.createElement("canvas"); boardC.width = 1024; boardC.height = 640;
	const boardTex = new THREE.CanvasTexture(boardC); boardTex.colorSpace = THREE.SRGBColorSpace;
	{
		const [x0, z0] = at(-14, HW + 5.6);
		const sb = group(g, x0, 0, z0, Math.PI / 2);   // (in the infield, facing across the track to the grandstand)
		for (const sx of [-3.2, 3.2]) { add(sb, new THREE.CylinderGeometry(0.1, 0.12, 7.4, 10), mat("#3e3a3a", 0.4, 0.6), sx, 3.7, 0); }
		k.box(x0 - 0.2, x0 + 0.2, z0 - 3.4, z0 + 3.4);
		add(sb, rbox(7.0, 4.4, 0.16, 0.08), mat("#141218", 0.6), 0, 5.2, -0.04);
		add(sb, new THREE.PlaneGeometry(6.7, 4.18), new THREE.MeshBasicMaterial({ map: boardTex, toneMapped: false }), 0, 5.2, 0.045, { cast: false, receive: false });
	}
	let boardSig = "";
	let race = null;   // the race on now (or just finished): { id, laps, goAt (performance.now ms), by, results: [{ n, t }] }
	function bestList() {
		const b = ctx.get("race:best");
		return b && typeof b === "object" ? Object.keys(b).map(k2 => b[k2]).filter(r => r && isFinite(+r.t) && r.t > 0).sort((a, b2) => a.t - b2.t) : [];
	}
	function drawBoard() {
		const rows = bestList().slice(0, 7), res = race && race.results.length ? race.results.slice(0, 5) : null;
		const sig = JSON.stringify(rows) + JSON.stringify(res);
		if (sig === boardSig) return;
		boardSig = sig;
		const c = boardC.getContext("2d");
		c.fillStyle = "#130f1c"; c.fillRect(0, 0, 1024, 640);
		c.strokeStyle = "#c1123a"; c.lineWidth = 10; c.strokeRect(10, 10, 1004, 620);
		c.textBaseline = "middle"; c.textAlign = "center";
		c.fillStyle = "#ffd166"; c.font = "900 60px Nunito, 'Segoe UI', sans-serif";
		c.fillText(res ? "RACE RESULTS" : "FASTEST LAPS", 512, 64);
		c.font = "800 42px Nunito, 'Segoe UI', sans-serif";
		const list = res || rows;
		if (!list.length) { c.fillStyle = "#b9adc9"; c.fillText("No laps yet - take a car round!", 512, 300); }
		list.forEach((r, i) => {
			const y = 140 + i * 64;
			c.textAlign = "left"; c.fillStyle = i ? "#e9e1f5" : "#ffd166";
			c.fillText(`${i + 1}.  ${String(r.n || "Guest").slice(0, 16)}`, 60, y);
			if (!res && r.car) { c.fillStyle = "#8f84a3"; c.font = "700 30px Nunito, 'Segoe UI', sans-serif"; c.fillText(String(r.car).slice(0, 10), 560, y); c.font = "800 42px Nunito, 'Segoe UI', sans-serif"; }
			c.textAlign = "right"; c.fillStyle = "#9ef01a";
			c.fillText(fmt(r.t), 964, y);
		});
		c.textAlign = "center"; c.fillStyle = "#4cc9f0"; c.font = "700 30px Nunito, 'Segoe UI', sans-serif";
		c.fillText(res ? "Fastest laps are back on when the next race starts" : "Drive a car out here and press G to start a race", 512, 596);
		boardTex.needsUpdate = true;
	}
	drawBoard();

	// ================================================================ the HUD (lap timer, countdown, results)
	const hud = document.createElement("div");
	hud.style.cssText = "position:fixed;left:50%;top:calc(max(14px, env(safe-area-inset-top)) + 54px);transform:translateX(-50%);z-index:12;pointer-events:none;text-align:center;font-family:Nunito,'Segoe UI',sans-serif;display:none";
	hud.innerHTML = `<div class="rh-main" style="display:inline-block;background:rgba(20,14,30,0.78);color:#fff;border-radius:14px;padding:8px 16px;font-weight:800;font-size:15px;box-shadow:0 4px 18px rgba(0,0,0,0.35);white-space:nowrap"></div>
		<div class="rh-big" style="font-weight:900;font-size:64px;color:#fff;text-shadow:0 4px 18px rgba(0,0,0,0.6),0 0 2px #000;margin-top:8px;display:none"></div>`;
	document.body.appendChild(hud);
	const hudMain = hud.querySelector(".rh-main"), hudBig = hud.querySelector(".rh-big");
	let bigUntil = 0;
	function big(html, ms, color) { hudBig.innerHTML = html; hudBig.style.color = color || "#fff"; hudBig.style.display = "block"; bigUntil = performance.now() + ms; }

	// ================================================================ timing my laps
	let mine = () => null;   // (set by attach: the car I'm driving, if I'm driving)
	const lap = { on: false, t0: 0, next: 1, prev: -1, last: 0, best: 0, n: 0 };
	const inArea = (x, z) => inRect(RACE.area, x, z);
	const myName = () => { const p = ctx.profile && ctx.profile(); return (p && p.name) || ctx.me().name || "Guest"; };
	function lapDone(ms, car) {
		lap.last = ms;
		const pb = !lap.best || ms < lap.best;
		if (pb) lap.best = ms;
		// on the leaderboard: each driver's best (only ever improves)
		const name = myName(), key = name.toLowerCase().slice(0, 24);
		const b = Object.assign({}, ctx.get("race:best") || {});
		const old = b[key];
		if (!old || ms < old.t) {
			const all = bestList(), rank = all.filter(r => r.t < ms && String(r.n).toLowerCase() !== key).length + 1;
			b[key] = { n: name, t: Math.round(ms), car };
			// keep the board to the best 30
			const keys = Object.keys(b).sort((a, c) => b[a].t - b[c].t);
			for (const k2 of keys.slice(30)) delete b[k2];
			ctx.setShared("race:best", b);
			if (rank === 1) ctx.send({ t: "fx", kind: "zfx", zone: "grounds", what: "raceRecord", n: name, ms: Math.round(ms) });
			if (rank === 1) ctx.notice(`&#x1F3C6; <b>Track record!</b> ${fmt(ms)} in ${ctx.esc(car)}.`);
		}
		if (!race || !race.me) big(`${pb ? "&#x2B50; " : ""}${fmt(ms)}`, 2600, pb ? "#ffd166" : "#fff");
	}
	// every frame I'm driving: where am I on the circuit, and did I just cross the line (or the next sector)?
	function tickLap(c) {
		const r = inArea(c.x, c.z) ? raceAt(c.x, c.z) : null;
		if (!r || r.d > HW + 14) { lap.on = false; lap.prev = -1; return; }
		const sec = Math.floor(r.s / LEN * SECTORS) % SECTORS, now = performance.now();
		if (lap.prev === SECTORS - 1 && sec === 0) {
			// over the line, going the right way
			if (lap.on && lap.next === SECTORS) { lap.n++; lapDone(now - lap.t0, c.def.name); raceLap(now); }
			else if (race && race.me && !race.me.started && now >= race.goAt) raceLap(now);
			lap.on = true; lap.t0 = now; lap.next = 1;
		} else if (lap.prev === 0 && sec === SECTORS - 1) { lap.on = false; }   // (back over it the wrong way)
		else if (lap.on && sec === lap.next) lap.next++;
		else if (lap.on && sec !== lap.prev && sec !== lap.next - 1) lap.on = false;   // (skipped a bit: cut across)
		lap.prev = sec;
	}

	// ================================================================ races
	function startRace() {
		const now = performance.now();
		if (race && !race.done && now < race.goAt + 6 * 60000) { ctx.notice("There's a race on already - get to the grid!"); return; }
		const id = Math.random().toString(36).slice(2, 9);
		ctx.send({ t: "fx", kind: "zfx", zone: "grounds", what: "race", id, laps: LAPS, wait: 8, by: myName() });
		onRaceStart({ id, laps: LAPS, wait: 8, by: myName() }, true);
	}
	function onRaceStart(d, mineToo) {
		if (race && race.id === d.id) return;
		race = { id: String(d.id), laps: Math.max(1, Math.min(10, d.laps | 0 || LAPS)), goAt: performance.now() + Math.max(3, Math.min(20, +d.wait || 8)) * 1000, by: String(d.by || "Someone").slice(0, 30), results: [], done: false, me: null };
		boardSig = "";
		const m = ctx.me();
		ctx.notice(`&#x1F3C1; <b>${ctx.esc(race.by)}</b> started a <b>${race.laps}-lap race</b> at the Grand Prix circuit! Get a car onto the grid${inArea(m.x, m.z) ? "" : " (out west, past the ring road)"}.`);
		if (!mineToo) ctx.sfx("chime", 0.5);
	}
	// I crossed the line while racing: lap one starts, or another one's done, or I'm home
	function raceLap(now) {
		const R2 = race && race.me;
		if (!R2 || race.done) return;
		if (!R2.started) { R2.started = true; R2.lap = 1; big(`Lap 1 / ${race.laps}`, 1400); return; }
		if (R2.lap < race.laps) { R2.lap++; big(R2.lap === race.laps ? "Final lap!" : `Lap ${R2.lap} / ${race.laps}`, 1500, R2.lap === race.laps ? "#ffd166" : "#fff"); return; }
		// finished
		const t = Math.round(now - race.goAt);
		R2.finished = t;
		ctx.send({ t: "fx", kind: "zfx", zone: "grounds", what: "raceFin", id: race.id, n: myName(), ms: t });
		onFinish({ id: race.id, n: myName(), ms: t }, true);
	}
	function onFinish(d, me) {
		if (!race || race.id !== d.id) return;
		const n = String(d.n || "Someone").slice(0, 30), t = +d.ms || 0;
		if (race.results.some(r => r.n === n)) return;
		race.results.push({ n, t });
		if (!race.firstAt) race.firstAt = performance.now();
		race.results.sort((a, b) => a.t - b.t);
		const place = race.results.findIndex(r => r.n === n) + 1;
		boardSig = "";
		if (me) { big(place === 1 ? "&#x1F3C6; YOU WIN!" : `You finished ${ord(place)}!`, 5000, place === 1 ? "#ffd166" : "#fff"); ctx.sfx("chime", place === 1 ? 0.9 : 0.6); }
		ctx.notice(`&#x1F3C1; <b>${ctx.esc(n)}</b> finished ${ord(place)} - ${fmt(t)}${place === 1 ? " &#x1F3C6;" : ""}`);
	}
	// held on the brakes while the lights count down (anyone driving on the circuit)
	function locked(x, z) { return !!race && !race.done && performance.now() < race.goAt && inArea(x, z); }

	// ================================================================ boost pads, the surface
	let boostT = 0, boardT = 0;
	return {
		attach(getMine) { mine = getMine; },
		// what's under a car at (x, z): "track" (quick), "grass" (out here, off the asphalt: slow), or null (not out here)
		surface(x, z) {
			if (!inArea(x, z)) return null;
			const r = raceAt(x, z);
			if (r && r.d < HW + 0.6) return "track";
			if (inRect(RACE.paddock, x, z, 0.5)) return "track";
			if (x > RACE_ROAD.x0 - 1 && Math.abs(z - RACE_ROAD.z) < 3.4) return "track";
			return "grass";
		},
		// am I over a boost pad? (once per pad: a short cool-down)
		boost(x, z) {
			if (boostT > 0 || !inArea(x, z)) return false;
			const r = raceAt(x, z);
			if (!r) return false;
			for (const [s, u] of boosts) {
				let ds = Math.abs(r.s - s); ds = Math.min(ds, LEN - ds);
				if (ds < 2.4 && Math.abs(r.u - u) < 1.6) { boostT = 1.2; return true; }
			}
			return false;
		},
		locked,
		update(dt) {
			boostT -= dt;
			const now = performance.now(), m = ctx.me(), c = mine();
			const near = inArea(m.x, m.z);
			// the race's lights
			let reds = 0, green = false;
			if (race && !race.done) {
				const left = (race.goAt - now) / 1000;
				if (left > 0 && left <= COUNT) reds = Math.min(5, COUNT - Math.ceil(left) + 1);
				if (left <= 0 && left > -3) green = true;
				// at GO: am I in it? (driving, out on the circuit)
				if (left <= 0 && !race.goChecked) {
					race.goChecked = true;
					if (c && inArea(c.x, c.z)) {
						const r = raceAt(c.x, c.z);
						// (already over the line, on the grid's far side: lap one has begun)
						const started = !!r && r.s < 60;
						race.me = { started, lap: started ? 1 : 0 };
						if (started) { lap.on = true; lap.t0 = now; lap.next = Math.floor(r.s / LEN * SECTORS) + 1; }
						big("GO!", 1200, "#2bff6a");
						ctx.sfx("whistle", 0.5);
					}
				}
				// over (for me): I've finished, or I'm watching and the winner's been home 45 s, or ten minutes on
				if (left < -600 || (race.me && race.me.finished) || (!race.me && race.firstAt && now - race.firstAt > 45000)) race.done = true;
			}
			lights.forEach((l, i) => { l.emissiveIntensity = i < reds ? 3.2 : 0; });
			goLight.emissiveIntensity = green ? 3.5 : 0;
			// lap timing (while I drive)
			if (c) tickLap(c);
			else { lap.on = false; lap.prev = -1; }
			// the HUD: out here driving, or a race counting down near me
			const show = (c && inArea(c.x, c.z)) || (near && race && !race.done && now < race.goAt);
			if (show) {
				const bits = [];
				if (race && !race.done && now < race.goAt) {
					const left = Math.ceil((race.goAt - now) / 1000);
					bits.push(`&#x1F3C1; Race starts in <b>${left}</b>`);
					if (left <= COUNT && performance.now() > bigUntil - 900) big(String(left), 900, "#ff4d6d");
				} else if (race && race.me && !race.done && !race.me.finished) {
					bits.push(race.me.started ? `Race · Lap <b>${race.me.lap}/${race.laps}</b> · ${fmt(now - race.goAt)}` : "Race · cross the line to start lap 1");
				} else bits.push(lap.on ? `Lap <b>${fmt(now - lap.t0)}</b>` : "Cross the start line to time a lap");
				if (lap.last) bits.push(`last ${fmt(lap.last)}`);
				if (lap.best) bits.push(`best <b style="color:#ffd166">${fmt(lap.best)}</b>`);
				const rec = bestList()[0];
				if (rec) bits.push(`record ${fmt(rec.t)}`);
				if (!race || race.done) bits.push(`<span style="color:#b9adc9">G: start a race</span>`);
				hudMain.innerHTML = bits.join(" &nbsp;·&nbsp; ");
			}
			hud.style.display = show || now < bigUntil ? "block" : "none";
			if (now >= bigUntil) hudBig.style.display = "none";
			// the leaderboard, a few times a second
			if (now - boardT > 250) { boardT = now; drawBoard(); }
		},
		// when I'm driving out here: G starts a race
		promptOpts(opts) {
			const c = mine();
			if (!c || !inArea(c.x, c.z)) return;
			if (race && !race.done) return;
			if (!opts.some(o => o.k === "G")) opts.push({ k: "G", label: "Start a race (" + LAPS + " laps)", fn: startRace });
		},
		onFx(d) {
			if (d.what === "race") onRaceStart(d, false);
			else if (d.what === "raceFin") onFinish(d, false);
			else if (d.what === "raceRecord") ctx.notice(`&#x1F3C6; <b>${ctx.esc(String(d.n || "Someone").slice(0, 30))}</b> set a new track record: ${fmt(+d.ms || 0)}!`);
		},
		headAt
	};
}
