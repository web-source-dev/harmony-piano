/**
 * Harmony World — the disco, upstairs in the loft (through the doorway under the neon sign).
 *
 * A dark room full of light: a dance floor of glowing tiles that ripple through
 * patterns, a mirror ball throwing spots of light that sweep round the walls,
 * coloured lights that chase each other, lasers from the DJ booth, neon along the
 * walls. Dance (E), slow dance with whoever's near, pick the music at the DJ booth
 * (it plays the house's music, loud in here). A velvet booth to sit in, and three
 * neon-framed photos.
 *
 * Same local coordinates as the loft (the lounge's); the room is x 3.2..7.95,
 * z 1.2..6.95, floor y 0 (3.6 m up), ceiling y 3.0. Its walls are built by the loft
 * (worldLoft.js) so they're there when you look up from the lounge.
 */
import { DISCO } from "./worldLoft.js";

const HW = 7.95, HD = 6.95, X0 = DISCO.x0, Z0 = DISCO.z0, CH = DISCO.h;
const TILE = 0.5, TX0 = 4.3, TZ0 = 2.5, TN = 6;     // the dance floor: 6 x 6 tiles
const BALL = { x: 5.6, y: 2.55, z: 4.0 };

export function build(k) {
	const { THREE, add, mat, group, rbox, g, ctx, canvasTex, rng } = k;
	const R = rng(77);
	k.floor(() => 0);
	k.walk(X0, HW, Z0 - 0.6, HD);
	k.cam = { minX: X0 + 0.15, maxX: HW - 0.15, minZ: Z0 + 0.15, maxZ: HD - 0.15, maxY: CH - 0.15 };

	// ---------------------------------------------------------------- floor, ceiling, neon
	const fl = add(g, new THREE.PlaneGeometry(HW - X0, HD - Z0), mat("#16101f", 0.25, 0.3), (HW + X0) / 2, 0.002, (HD + Z0) / 2, { rx: -Math.PI / 2, cast: false });
	fl.userData.floor = true;
	add(g, new THREE.PlaneGeometry(HW - X0, HD - Z0), mat("#0c0814", 0.9), (HW + X0) / 2, CH - 0.001, (HD + Z0) / 2, { rx: Math.PI / 2, cast: false });
	// dance floor tiles (each its own colour, animated)
	const tiles = [];
	const tileGeo = new THREE.PlaneGeometry(TILE - 0.04, TILE - 0.04);
	for (let i = 0; i < TN; i++) for (let j = 0; j < TN; j++) {
		const m = new THREE.MeshBasicMaterial({ color: "#000000", toneMapped: false });
		const t = add(g, tileGeo, m, TX0 + (i + 0.5) * TILE, 0.008, TZ0 + (j + 0.5) * TILE, { rx: -Math.PI / 2, cast: false, receive: false });
		t.userData = { i, j, floor: true };
		tiles.push(t);
	}
	add(g, new THREE.PlaneGeometry(TN * TILE + 0.06, TN * TILE + 0.06), mat("#2b2140", 0.4, 0.6), TX0 + TN * TILE / 2, 0.005, TZ0 + TN * TILE / 2, { rx: -Math.PI / 2, cast: false });
	// neon strips round the top of the walls and along the floor
	const neons = [];
	const strip = (x0, z0, x1, z1, y, col) => {
		const len = Math.hypot(x1 - x0, z1 - z0);
		const m = new THREE.MeshBasicMaterial({ color: col, toneMapped: false });
		const s = add(g, new THREE.BoxGeometry(len, 0.035, 0.035), m, (x0 + x1) / 2, y, (z0 + z1) / 2, { ry: -Math.atan2(z1 - z0, x1 - x0), cast: false, receive: false });
		neons.push({ m, base: new THREE.Color(col), ph: R() * 6 });
		return s;
	};
	const ix0 = X0 + 0.1, ix1 = HW - 0.03, iz0 = Z0 + 0.1, iz1 = HD - 0.03;
	for (const [y, c1, c2] of [[CH - 0.12, "#ff4fd8", "#3ff0ff"], [0.06, "#3ff0ff", "#ff4fd8"]]) {
		strip(ix0, iz0, ix1, iz0, y, c1); strip(ix0, iz1, ix1, iz1, y, c1);
		strip(ix0, iz0, ix0, iz1, y, c2); strip(ix1, iz0, ix1, iz1, y, c2);
	}

	// ---------------------------------------------------------------- the mirror ball
	const facets = canvasTex(256, 128, (c, w, h) => {
		const r = rng(5);
		for (let y = 0; y < h; y += 8) for (let x = 0; x < w; x += 8) { const v = 150 + r() * 105; c.fillStyle = `rgb(${v},${v},${v + 10})`; c.fillRect(x, y, 7, 7); }
	});
	const ballM = new THREE.MeshStandardMaterial({ map: facets, metalness: 1, roughness: 0.15, emissive: "#ffffff", emissiveMap: facets, emissiveIntensity: 0.35 });
	add(g, new THREE.CylinderGeometry(0.006, 0.006, CH - BALL.y - 0.25, 6), mat("#222"), BALL.x, (CH + BALL.y + 0.25) / 2, BALL.z, { cast: false });
	const ball = add(g, new THREE.SphereGeometry(0.25, 28, 18), ballM, BALL.x, BALL.y, BALL.z, { cast: false });
	// spots of light thrown round the room (each follows a direction that turns with the ball)
	const dots = [];
	const dotGeo = new THREE.CircleGeometry(0.06, 12);
	const dotCols = ["#ffffff", "#ffd6f5", "#d6f7ff", "#fff3c4"];
	for (let i = 0; i < 46; i++) {
		const y = -0.85 + R() * 1.55, a = R() * Math.PI * 2, rr = Math.sqrt(1 - y * y);
		const m = new THREE.MeshBasicMaterial({ color: dotCols[i % 4], transparent: true, opacity: 0.75, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
		const d = add(g, dotGeo, m, 0, -10, 0, { cast: false, receive: false });
		d.userData = { dir: new THREE.Vector3(Math.cos(a) * rr, y, Math.sin(a) * rr), s: 0.7 + R() * 0.8 };
		dots.push(d);
	}

	// ---------------------------------------------------------------- the DJ booth (south wall), with lasers
	const dj = group(g, 5.6, 0, HD - 0.45, Math.PI);
	add(dj, rbox(1.9, 1.0, 0.65, 0.03), mat("#1d1726", 0.4, 0.3), 0, 0.5, 0);
	const djFront = canvasTex(512, 256, (c, w, h) => {
		c.fillStyle = "#120c1c"; c.fillRect(0, 0, w, h);
		c.font = "900 120px 'Nunito', 'Segoe UI', sans-serif"; c.textAlign = "center"; c.textBaseline = "middle";
		c.shadowColor = "#3ff0ff"; c.shadowBlur = 24; c.fillStyle = "#bff8ff"; c.fillText("DJ", w / 2, h / 2 + 6);
	});
	add(dj, new THREE.PlaneGeometry(1.0, 0.5), new THREE.MeshBasicMaterial({ map: djFront, toneMapped: false }), 0, 0.55, 0.33, { cast: false, receive: false });
	const decks = [];
	for (const sx of [-0.55, 0.55]) {
		add(dj, new THREE.CylinderGeometry(0.2, 0.2, 0.03, 28), mat("#2a2a30", 0.4, 0.5), sx, 1.015, -0.02);
		decks.push(add(dj, new THREE.CylinderGeometry(0.16, 0.16, 0.012, 28), mat("#111", 0.3, 0.2, { map: facets }), sx, 1.035, -0.02, { cast: false }));
	}
	const eq = [];
	for (let i = 0; i < 8; i++) {
		const m = new THREE.MeshBasicMaterial({ color: new THREE.Color().setHSL(i / 8, 1, 0.6), toneMapped: false });
		eq.push(add(dj, new THREE.BoxGeometry(0.05, 0.3, 0.02), m, -0.21 + i * 0.06, 1.15, 0.2, { cast: false, receive: false }));
	}
	const lasers = [];
	const laserGeo = new THREE.CylinderGeometry(0.006, 0.006, 6, 6);
	laserGeo.translate(0, 3, 0);
	for (let i = 0; i < 8; i++) {
		const m = new THREE.MeshBasicMaterial({ color: i % 2 ? "#39ff6a" : "#ff2d6f", transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending });
		const l = add(dj, laserGeo, m, (i - 3.5) * 0.18, 1.1, -0.2, { cast: false, receive: false });
		l.userData.ph = i * 0.8;
		lasers.push(l);
	}
	k.box(4.6, 6.6, HD - 0.8, HD);
	k.interact("disco:dj", { label: "Pick the music", stand: [5.6, HD - 1.3], face: 0, use: () => ctx.openMusic() }, dj);

	// ---------------------------------------------------------------- a velvet booth along the west wall
	const velvet = mat("#6a1b9a", 0.85), velvetD = mat("#4a1270", 0.85);
	const bz = 4.0;
	const booth = group(g, X0 + 0.5, 0, bz, Math.PI / 2);
	add(booth, rbox(2.4, 0.3, 0.8, 0.06), velvetD, 0, 0.27, 0);
	add(booth, rbox(2.4, 0.18, 0.62, 0.08), velvet, 0, 0.5, 0.06);
	add(booth, rbox(2.4, 0.75, 0.2, 0.08), velvetD, 0, 0.7, -0.3);
	for (const sx of [-1.1, 1.1]) add(booth, rbox(0.2, 0.55, 0.8, 0.06), velvetD, sx, 0.45, 0);
	k.box(X0, X0 + 0.95, bz - 1.25, bz + 1.25);
	["discoSeat0", "discoSeat1", "discoSeat2"].forEach((id, i) => k.spot({ id, x: X0 + 0.57, z: bz - 0.72 + i * 0.72, h: Math.PI / 2, y: 0.15 }));
	k.interact("disco:booth", { label: "Sit in the booth", stand: [X0 + 1.35, bz], sit: ["discoSeat0", "discoSeat1", "discoSeat2"] }, booth);
	// a little round table in front of it with drinks
	const tb = group(g, X0 + 1.25, 0, bz - 1.75);
	add(tb, new THREE.CylinderGeometry(0.3, 0.3, 0.04, 24), mat("#c9a05a", 0.3, 0.8), 0, 0.72, 0);
	add(tb, new THREE.CylinderGeometry(0.03, 0.03, 0.7, 10), mat("#c9a05a", 0.3, 0.8), 0, 0.36, 0);
	for (const [x, z, c] of [[-0.1, 0.05, "#ff4fd8"], [0.1, -0.06, "#3ff0ff"]]) add(tb, new THREE.CylinderGeometry(0.035, 0.025, 0.14, 12), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.8, toneMapped: false }), x, 0.81, z, { cast: false });
	k.box(X0 + 0.95, X0 + 1.55, bz - 2.05, bz - 1.45);

	// ---------------------------------------------------------------- photos in neon frames (east wall)
	for (const [slot, z, c] of [[42, 2.4, "#ff4fd8"], [43, 3.9, "#3ff0ff"], [44, 5.4, "#ffd166"]]) {
		const f = k.photo(slot, HW - 0.03, 1.7, z, -Math.PI / 2, { w: 0.62, h: 0.5, frame: c, mat: "#111111" });
		const glow = new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.35, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending });
		add(f.group, new THREE.PlaneGeometry(0.8, 0.68), glow, 0, 0, -0.01, { cast: false, receive: false });
		f.group.children[0].material = new THREE.MeshBasicMaterial({ color: c, toneMapped: false });
	}

	// ---------------------------------------------------------------- light: colours that chase round the room
	const chase = [];
	for (let i = 0; i < 6; i++) chase.push(k.light(BALL.x, 2.2, BALL.z, "#ff4fd8", 3.2, 6.5, 1.6));
	const white = k.light(BALL.x, CH - 0.3, BALL.z, "#b9a6ff", 1.6, 7);
	void white;
	k.key.pos.copy(k.V(BALL.x, CH - 0.1, BALL.z)); k.key.target.copy(k.V(BALL.x, 0, BALL.z));
	k.key.angle = 0.9; k.key.intensity = 6; k.key.distance = 8; k.key.color.set("#a78bfa");
	k.fill.pos.copy(k.V(BALL.x, 1.5, BALL.z)); k.fill.intensity = 1.5; k.fill.distance = 10; k.fill.color.set("#7b5cff");
	k.hemi = 0.12; k.env = 0.12; k.exposure = 1.1;

	// ---------------------------------------------------------------- every frame
	const col = new THREE.Color(), dir = new THREE.Vector3(), V = new THREE.Vector3();
	const bx = BALL.x, by = BALL.y, bzz = BALL.z;
	function update(dt, t) {
		const beat = t * 2.1;   // ~126 bpm
		// the dance floor: rings, waves and sparkles, changing every eight bars
		const mode = Math.floor(t / 15) % 3;
		for (const tl of tiles) {
			const { i, j } = tl.userData;
			const cx = i - 2.5, cz = j - 2.5;
			let h, l;
			if (mode === 0) { const d = Math.hypot(cx, cz); h = (d * 0.1 - t * 0.15) % 1; l = 0.25 + 0.3 * Math.max(0, Math.sin(d * 1.4 - beat * Math.PI)); }
			else if (mode === 1) { h = ((i + j) * 0.07 + t * 0.1) % 1; l = 0.2 + 0.35 * (Math.floor(beat + (i + j) * 0.5) % 2); }
			else { const n = Math.sin(i * 12.9898 + j * 78.233 + Math.floor(beat * 2) * 4.1) * 43758.5; h = (n - Math.floor(n)); l = h > 0.55 ? 0.55 : 0.12; h = (h + t * 0.05) % 1; }
			tl.material.color.setHSL((h + 1) % 1, 0.95, l);
		}
		// the mirror ball turns; its spots sweep the walls, floor and ceiling
		ball.rotation.y = t * 0.6;
		const ca = Math.cos(t * 0.6), sa = Math.sin(t * 0.6);
		for (const d of dots) {
			const b = d.userData.dir;
			dir.set(b.x * ca + b.z * sa, b.y, -b.x * sa + b.z * ca);
			// how far until the ray from the ball hits a wall / the floor / the ceiling
			let tt = 1e9, n = 0;
			if (dir.x > 1e-4) { const q = (HW - 0.02 - bx) / dir.x; if (q < tt) { tt = q; n = 0; } }
			if (dir.x < -1e-4) { const q = (X0 + 0.09 - bx) / dir.x; if (q < tt) { tt = q; n = 1; } }
			if (dir.z > 1e-4) { const q = (HD - 0.02 - bzz) / dir.z; if (q < tt) { tt = q; n = 2; } }
			if (dir.z < -1e-4) { const q = (Z0 + 0.09 - bzz) / dir.z; if (q < tt) { tt = q; n = 3; } }
			if (dir.y > 1e-4) { const q = (CH - 0.02 - by) / dir.y; if (q < tt) { tt = q; n = 4; } }
			if (dir.y < -1e-4) { const q = (0.012 - by) / dir.y; if (q < tt) { tt = q; n = 5; } }
			d.position.set(bx + dir.x * tt, by + dir.y * tt, bzz + dir.z * tt);
			d.rotation.set(n >= 4 ? -Math.PI / 2 : 0, n === 0 || n === 1 ? Math.PI / 2 : 0, 0);
			d.scale.setScalar(d.userData.s * (0.6 + tt * 0.25));
		}
		// coloured lights chasing round the ball
		chase.forEach((L, i) => {
			const a = t * 1.3 + i * Math.PI / 3;
			V.set(bx + Math.cos(a) * 1.6, 1.0 + Math.sin(t * 2 + i) * 0.6, bzz + Math.sin(a) * 1.6);
			L.pos.copy(k.V(V.x, V.y, V.z));
			L.color.setHSL(((i / 6) + t * 0.05) % 1, 1, 0.55);
			L.intensity = L.base * (0.6 + 0.4 * Math.max(0, Math.sin(beat * Math.PI + i)));
		});
		// lasers fan back and forth; the decks spin; the levels jump
		lasers.forEach(l => { l.rotation.x = 0.9 + Math.sin(t * 1.7 + l.userData.ph) * 0.45; l.rotation.z = Math.sin(t * 1.1 + l.userData.ph * 1.3) * 0.7; l.visible = Math.floor(beat * 2 + l.userData.ph) % 4 !== 0; });
		decks.forEach((d, i) => { d.rotation.y = t * (3.5 + i * 0.4); });
		eq.forEach((e, i) => { e.scale.y = 0.25 + Math.abs(Math.sin(beat * Math.PI * (1 + i * 0.13) + i)) * 1.1; e.position.y = 1.15 - 0.15 + e.scale.y * 0.15; });
		neons.forEach(n => { col.copy(n.base).multiplyScalar(0.55 + 0.45 * Math.max(0, Math.sin(beat * Math.PI * 0.5 + n.ph))); n.m.color.copy(col); });
	}

	return {
		update,
		// it's a disco: the music's loud in here
		musicAt() { return 1; },
		promptOpts(opts) {
			const me = ctx.me();
			if (me.sit) return;
			const free = key => !opts.some(o => o.k === key);
			if (free("E")) opts.push({ k: "E", label: me.upper === "dance" ? "Keep dancing" : "Dance!", fn: () => ctx.doUpper("dance", 12000) });
			let near = null, nd = 2.5;
			ctx.peers().forEach((p, id) => { const d = Math.hypot(p.x - me.x, p.z - me.z); if (d < nd && !p.sit) { nd = d; near = id; } });
			if (near && free("R")) opts.push({ k: "R", label: "Slow dance with " + ctx.peers().get(near).look.name, fn: () => ctx.loveAct("slowdance") });
			if (near && free("G")) opts.push({ k: "G", label: "Kiss " + ctx.peers().get(near).look.name, fn: () => ctx.loveAct("smooch") });
		}
	};
}
