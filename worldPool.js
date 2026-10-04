/**
 * Harmony World — the pool, outdoors beside the terrace, under the night sky.
 *
 * Walk out through the gap in the terrace's railing (east side). Local
 * coordinates: x -3.65..3.65, z -6.1..6.1 (world x 5.5..12.8, z -18.5..-6.3).
 * The house's walls (the lounge, the cinema upstairs) rise behind it in brick.
 * The pool is 3.4 m by 7.4 m, 1.3 m deep, with steps at the terrace end and a
 * diving board on the side. Walk in (or jump, or dive) and you swim: the floor
 * there is under the water, so you sink to your chest and your arms do
 * breaststroke. Loungers, palms, floating rings, ripples, string lights.
 *
 * It's outdoors, so it shares the terrace's lights and the moon (the house
 * doesn't move its light pool here).
 */
const P = { x0: -1.55, x1: 1.85, z0: -2.8, z1: 4.6, depth: 1.3, surf: -0.12 };

function floorY(x, z) {
	if (x <= P.x0 || x >= P.x1 || z <= P.z0 || z >= P.z1) return 0;
	// three steps down at the terrace end
	if (z > 4.2) return -0.33;
	if (z > 3.8) return -0.66;
	if (z > 3.4) return -1.0;
	return -P.depth;
}
const inPool = (x, z) => x > P.x0 && x < P.x1 && z > P.z0 && z < P.z1;

export function build(k) {
	const { THREE, add, mat, group, rbox, g, tex, ctx, canvasTex, rng } = k;
	const R = rng(88);
	const HW = 3.65, HD = 6.1;
	k.floor(floorY);
	k.walk(-HW, HW, -HD, HD);
	k.cam = { minX: -6.5, maxX: HW - 0.15, minZ: -HD - 1.5, maxZ: HD + 1.0, maxY: 8, minY: 0.2 };

	// ---------------------------------------------------------------- deck (stone tiles round the pool)
	const deckTex = canvasTex(512, 512, (c, w, h) => {
		c.fillStyle = "#b9ad9c"; c.fillRect(0, 0, w, h);
		const r = rng(9);
		for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
			const t = 214 + r() * 18;
			c.fillStyle = `rgb(${t},${t - 8},${t - 22})`;
			c.fillRect(i * 128 + 3, j * 128 + 3, 122, 122);
			for (let n = 0; n < 300; n++) { c.fillStyle = `rgba(150,130,100,${r() * 0.12})`; c.fillRect(i * 128 + 3 + r() * 120, j * 128 + 3 + r() * 120, 2, 2); }
		}
	});
	const deckPiece = (x0, x1, z0, z1) => {
		const t = deckTex.clone(); t.needsUpdate = true;
		t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set((x1 - x0) / 2, (z1 - z0) / 2);
		const m = add(g, new THREE.PlaneGeometry(x1 - x0, z1 - z0), mat("#ffffff", 0.75, 0, { map: t }), (x0 + x1) / 2, 0, (z0 + z1) / 2, { rx: -Math.PI / 2, cast: false });
		m.userData.floor = true;
	};
	deckPiece(-HW, HW, -HD, P.z0);
	deckPiece(-HW, HW, P.z1, HD);
	deckPiece(-HW, P.x0, P.z0, P.z1);
	deckPiece(P.x1, HW, P.z0, P.z1);
	// the deck's edge (it's up on the roof, like the terrace)
	add(g, new THREE.BoxGeometry(HW * 2, 0.3, 0.1), mat("#5b4636", 0.8), 0, -0.15, -HD - 0.02);
	const coping = mat("#f7f3ec", 0.5);
	const cw = 0.26;
	add(g, new THREE.BoxGeometry(P.x1 - P.x0 + cw * 2, 0.06, cw), coping, (P.x0 + P.x1) / 2, 0.03, P.z0 - cw / 2);
	add(g, new THREE.BoxGeometry(P.x1 - P.x0 + cw * 2, 0.06, cw), coping, (P.x0 + P.x1) / 2, 0.03, P.z1 + cw / 2);
	add(g, new THREE.BoxGeometry(cw, 0.06, P.z1 - P.z0), coping, P.x0 - cw / 2, 0.03, (P.z0 + P.z1) / 2);
	add(g, new THREE.BoxGeometry(cw, 0.06, P.z1 - P.z0), coping, P.x1 + cw / 2, 0.03, (P.z0 + P.z1) / 2);

	// ---------------------------------------------------------------- the house behind it: brick (lounge wall to the south, cinema wall to the east)
	const brick = (w, h) => mat("#ffffff", 0.95, 0, { map: k.brickTex(w / 2.4, h / 2.4) });
	add(g, new THREE.PlaneGeometry(HW * 2 - 1.7, 7.4), brick(HW * 2 - 1.7, 7.4), 0.85, 3.7, HD + 0.15, { ry: Math.PI, cast: false });   // the lounge's north wall
	add(g, new THREE.PlaneGeometry(12.6, 8.6), brick(12.6, 8.6), HW + 0.02, 4.3, 0.0, { ry: -Math.PI / 2, cast: false });              // the cinema's west wall
	add(g, new THREE.BoxGeometry(HW * 2 - 1.6, 0.35, 0.2), mat("#d8cfc4", 0.8), 0.8, 7.45, HD + 0.2);
	// lit windows high up on the lounge wall
	for (const x of [-0.6, 1.6]) add(g, new THREE.PlaneGeometry(1.0, 1.6), new THREE.MeshBasicMaterial({ color: "#ffd9a0", toneMapped: false }), x, 5.4, HD + 0.13, { ry: Math.PI, cast: false });

	// ---------------------------------------------------------------- glass railing (north + the terrace side past the terrace's own)
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
		for (let i = 0; i <= n; i++) add(rg, new THREE.BoxGeometry(0.06, 1.05, 0.06), postM, 0, 0.525, -len / 2 + (len * i) / n);
	};
	railRun(-HW + 0.05, -HD + 0.05, HW - 0.05, -HD + 0.05);
	railRun(-HW + 0.05, -HD + 0.05, -HW + 0.05, 0.4);
	k.box(-HW, HW, -HD, -HD + 0.12);
	k.box(-HW, -HW + 0.12, -HD, 0.4);

	// ---------------------------------------------------------------- the pool itself
	const tileTex = canvasTex(256, 256, (c, w, h) => {
		c.fillStyle = "#6fb6d6"; c.fillRect(0, 0, w, h);
		for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { c.fillStyle = (i + j) % 3 ? "#8fd0ea" : "#7cc4e2"; c.fillRect(i * 32 + 1.5, j * 32 + 1.5, 29, 29); }
	}, (P.x1 - P.x0) / 1.2, (P.z1 - P.z0) / 1.2);
	const causticTex = canvasTex(512, 512, (c, w, h) => {
		c.fillStyle = "#000"; c.fillRect(0, 0, w, h);
		c.strokeStyle = "rgba(255,255,255,0.5)"; c.lineWidth = 3;
		const r = rng(12);
		for (let i = 0; i < 70; i++) {
			c.beginPath();
			let x = r() * w, y = r() * h;
			c.moveTo(x, y);
			for (let s = 0; s < 5; s++) { x += (r() - 0.5) * 120; y += (r() - 0.5) * 120; c.quadraticCurveTo(x + (r() - 0.5) * 60, y + (r() - 0.5) * 60, x, y); }
			c.stroke();
		}
	}, 2, 3);
	const basinM = mat("#ffffff", 0.35, 0, { map: tileTex, emissive: "#9fe8ff", emissiveMap: causticTex, emissiveIntensity: 0.45 });
	const D = P.depth, PW = P.x1 - P.x0, PL = P.z1 - P.z0, cx = (P.x0 + P.x1) / 2, cz = (P.z0 + P.z1) / 2;
	add(g, new THREE.PlaneGeometry(PW, PL), basinM, cx, -D, cz, { rx: -Math.PI / 2, cast: false });
	const wallTex = tileTex.clone(); wallTex.needsUpdate = true; wallTex.repeat.set(PW / 1.2, D / 1.2);
	const sideTex = tileTex.clone(); sideTex.needsUpdate = true; sideTex.repeat.set(PL / 1.2, D / 1.2);
	const wallM = mat("#ffffff", 0.35, 0, { map: wallTex, emissive: "#3fb7e0", emissiveIntensity: 0.15 }), sideM = mat("#ffffff", 0.35, 0, { map: sideTex, emissive: "#3fb7e0", emissiveIntensity: 0.15 });
	add(g, new THREE.PlaneGeometry(PW, D), wallM, cx, -D / 2, P.z0, { cast: false });
	add(g, new THREE.PlaneGeometry(PW, D), wallM, cx, -D / 2, P.z1, { ry: Math.PI, cast: false });
	add(g, new THREE.PlaneGeometry(PL, D), sideM, P.x0, -D / 2, cz, { ry: Math.PI / 2, cast: false });
	add(g, new THREE.PlaneGeometry(PL, D), sideM, P.x1, -D / 2, cz, { ry: -Math.PI / 2, cast: false });
	for (const [z0, top] of [[4.2, -0.33], [3.8, -0.66], [3.4, -1.0]]) add(g, new THREE.BoxGeometry(PW, D + top, P.z1 - z0), mat("#f2f6f7", 0.35), cx, (-D + top) / 2, (z0 + P.z1) / 2, { cast: false });
	const chrome = mat("#e3e7ea", 0.12, 1);
	const ladder = group(g, 0, 0, 0);
	for (const x of [P.x0 + 0.35, P.x1 - 0.35]) {
		const pts = [new THREE.Vector3(x, 0.0, P.z1 + 0.4), new THREE.Vector3(x, 0.9, P.z1 + 0.4), new THREE.Vector3(x, 1.0, P.z1 + 0.1), new THREE.Vector3(x, 0.6, P.z1 - 0.3), new THREE.Vector3(x, -0.2, P.z1 - 0.7)];
		add(ladder, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 30, 0.025, 8), chrome, 0, 0, 0, { cast: false });
	}
	const uwM = new THREE.MeshBasicMaterial({ color: "#bff3ff", toneMapped: false });
	for (const z of [-1.2, 1.4]) for (const x of [P.x0 + 0.01, P.x1 - 0.01]) add(g, new THREE.CircleGeometry(0.12, 20), uwM, x, -0.65, z, { ry: x < 0 ? Math.PI / 2 : -Math.PI / 2, cast: false, receive: false });
	// the water: a gently moving sheet
	const waterGeo = new THREE.PlaneGeometry(PW, PL, 34, 60);
	waterGeo.rotateX(-Math.PI / 2);
	const waterM = new THREE.MeshPhysicalMaterial({ color: "#3fb7e0", transparent: true, opacity: 0.55, roughness: 0.04, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.05, depthWrite: false, side: THREE.DoubleSide, emissive: "#0c4f6a", emissiveIntensity: 0.4 });
	const water = add(g, waterGeo, waterM, cx, P.surf, cz, { cast: false, receive: false });
	water.renderOrder = 2;
	const wpos = waterGeo.attributes.position;
	const wbase = Float32Array.from(wpos.array);
	k.interact("pool:steps", { label: "Get in the pool", stand: [cx, P.z1 + 0.8], face: Math.PI, use: () => ctx.walkTo(cx + (Math.random() - 0.5) * 1.6 + k.ox, 1.5 + k.oz, () => { ctx.me().h = Math.PI; }) }, ladder);

	// ---------------------------------------------------------------- diving board (east side, over the middle of the pool)
	const BZ = 0.9;
	const board = group(g, P.x1 + 1.2, 0, BZ);
	add(board, rbox(0.55, 0.5, 0.7, 0.04), mat("#d8cfc4", 0.6), 0.25, 0.25, 0);
	add(board, rbox(2.0, 0.06, 0.5, 0.02), mat("#2a9d8f", 0.4), -0.6, 0.56, 0);
	add(board, rbox(2.0, 0.01, 0.46, 0.01), mat("#bfe7df", 0.9), -0.6, 0.595, 0, { cast: false });
	k.box(P.x1 + 1.2, P.x1 + 1.8, BZ - 0.35, BZ + 0.35);
	let dive = null;
	k.interact("pool:dive", { label: "Dive in!", stand: [P.x1 + 1.35, BZ + 0.75], face: -Math.PI / 2, use: () => { const me = ctx.me(); if (me.sit) ctx.standUp(true); dive = { t0: performance.now() / 1000 }; ctx.doUpper("jump", 1700); ctx.sfx("whoosh", 0.4); } }, board);

	// ---------------------------------------------------------------- loungers on the far deck, palms, floats, string lights
	const towelCols = ["#ff8fab", "#4cc9f0", "#ffd166"];
	for (let i = 0; i < 3; i++) {
		const x = -1.95 + i * 1.7, z = -5.0;
		const lg = group(g, x, 0, z);
		const wood = mat("#f2ede4", 0.5);
		add(lg, rbox(0.7, 0.08, 1.9, 0.03), wood, 0, 0.32, 0.05);
		add(lg, rbox(0.7, 0.08, 0.75, 0.03), wood, 0, 0.62, -0.75, { rx: 0.75 });
		for (const sx of [-0.3, 0.3]) for (const sz of [-0.7, 0.85]) add(lg, new THREE.CylinderGeometry(0.025, 0.025, 0.3, 8), chrome, sx, 0.15, sz);
		add(lg, rbox(0.62, 0.04, 1.5, 0.02), mat(towelCols[i], 0.95), 0, 0.38, 0.2);
		k.box(x - 0.4, x + 0.4, z - 1.05, z + 1.05);
		k.spot({ id: "lounger" + i, x, z: z - 0.15, h: 0, y: -0.06 });
		k.interact("pool:lounger" + i, { label: "Relax on the lounger", stand: [x, z + 1.45], sit: ["lounger" + i] }, lg);
	}
	const palms = [];
	for (const [x, z] of [[-3.1, -5.5], [3.1, -5.5], [3.15, 5.6]]) {
		const p = group(g, x, 0, z);
		add(p, new THREE.CylinderGeometry(0.38, 0.3, 0.6, 20), mat("#d8cfc4", 0.7), 0, 0.3, 0);
		let y = 0.55;
		for (let i = 0; i < 9; i++) { add(p, new THREE.CylinderGeometry(0.07 - i * 0.003, 0.08 - i * 0.003, 0.28, 10), mat(i % 2 ? "#8b6b4a" : "#7a5c3e", 0.9), Math.sin(i * 0.4) * 0.05, y + 0.14, 0); y += 0.27; }
		const crown = group(p, 0.05, y, 0);
		for (let i = 0; i < 8; i++) {
			const fr = group(crown, 0, 0, 0, i / 8 * Math.PI * 2);
			add(fr, new THREE.SphereGeometry(0.5, 12, 8), mat(i % 2 ? "#3f8a4a" : "#2f7a3e", 0.6, 0, { side: THREE.DoubleSide }), 0, -0.15, 0.55, { rx: 0.55 }).scale.set(0.28, 0.06, 1.0);
		}
		palms.push(crown);
		k.box(x - 0.42, x + 0.42, z - 0.42, z + 0.42);
	}
	const floats = [];
	const ringTex = (c2) => canvasTex(256, 64, (c, w, h) => { for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? "#ffffff" : c2; c.fillRect(i * w / 8, 0, w / 8 + 1, h); } });
	for (const [col, ph] of [["#ff6b9d", 0], ["#ffc93c", 2.5]]) {
		const r = add(g, new THREE.TorusGeometry(0.38, 0.15, 14, 32), mat("#ffffff", 0.3, 0, { map: ringTex(col) }), cx, P.surf + 0.05, cz, { rx: Math.PI / 2 });
		r.userData.ph = ph;
		floats.push(r);
	}
	// string lights from the house wall out to poles on the railing
	const bulbs = [];
	const poleM = mat("#2e2b2b", 0.5, 0.5);
	for (const [x, z] of [[-3.5, -5.95], [3.45, -5.95]]) add(g, new THREE.CylinderGeometry(0.035, 0.045, 2.95, 10), poleM, x, 1.475, z);
	const strand = (a, b, sag) => {
		const pts = [];
		for (let i = 0; i <= 20; i++) { const u = i / 20; pts.push(new THREE.Vector3(a[0] + (b[0] - a[0]) * u, a[2] + (b[2] - a[2]) * u - Math.sin(u * Math.PI) * sag, a[1] + (b[1] - a[1]) * u)); }
		const curve = new THREE.CatmullRomCurve3(pts);
		add(g, new THREE.TubeGeometry(curve, 60, 0.005, 4), mat("#222", 0.6), 0, 0, 0, { cast: false });
		const n = Math.round(curve.getLength() / 0.55);
		for (let i = 1; i < n; i++) {
			const p = curve.getPoint(i / n);
			const b = add(g, new THREE.SphereGeometry(0.04, 10, 8), new THREE.MeshStandardMaterial({ color: "#ffd9a0", emissive: "#ffc26b", emissiveIntensity: 2.4 }), p.x, p.y - 0.05, p.z, { cast: false });
			b.userData.ph = R() * 6;
			bulbs.push(b);
		}
	};
	strand([-3.5, -5.95, 2.9], [-2.0, HD, 3.6], 0.5);
	strand([3.45, -5.95, 2.9], [2.5, HD, 3.6], 0.5);
	strand([-3.5, -5.95, 2.9], [3.45, -5.95, 2.9], 0.4);

	// ---------------------------------------------------------------- every frame
	const ripples = [], splashes = [];
	const rippleM = new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide });
	const rippleGeo = new THREE.RingGeometry(0.16, 0.2, 28);
	rippleGeo.rotateX(-Math.PI / 2);
	const dropGeo = new THREE.SphereGeometry(0.04, 8, 6);
	const dropM = new THREE.MeshBasicMaterial({ color: "#e8f8ff", transparent: true, opacity: 0.85 });
	function ripple(x, z, big) {
		const r = new THREE.Mesh(rippleGeo, rippleM.clone());
		r.position.set(x, P.surf + 0.02, z);
		r.userData = { life: 0, big };
		g.add(r);
		ripples.push(r);
	}
	function splash(x, z, n) {
		for (let i = 0; i < n; i++) {
			const d = new THREE.Mesh(dropGeo, dropM);
			const a = Math.random() * Math.PI * 2, sp = 0.6 + Math.random() * 1.4;
			d.position.set(x, P.surf + 0.05, z);
			d.userData = { vx: Math.cos(a) * sp, vz: Math.sin(a) * sp, vy: 2 + Math.random() * 2.5 };
			g.add(d);
			splashes.push(d);
		}
		ripple(x, z, true);
		ctx.sfx("water", 0.5);
	}
	const wasIn = new Map();
	let rippleT = 0;
	function update(dt, t) {
		for (let i = 0; i < wpos.count; i++) {
			const x = wbase[i * 3], z = wbase[i * 3 + 2];
			wpos.setY(i, Math.sin(x * 1.3 + t * 1.6) * 0.018 + Math.cos(z * 1.7 + t * 1.2) * 0.014 + Math.sin((x + z) * 2.2 + t * 2.4) * 0.008);
		}
		wpos.needsUpdate = true;
		waterGeo.computeVertexNormals();
		causticTex.offset.set(Math.sin(t * 0.13) * 0.3, t * 0.025);
		floats.forEach((f, i) => {
			const a = t * 0.07 + f.userData.ph;
			f.position.set(cx + Math.sin(a * 1.7) * 0.8, P.surf + 0.04 + Math.sin(t * 1.4 + i) * 0.02, cz + Math.sin(a) * 2.6);
			f.rotation.z = t * 0.1 + i;
		});
		palms.forEach((p, i) => { p.rotation.z = Math.sin(t * 0.5 + i) * 0.03; });
		bulbs.forEach(b => { b.material.emissiveIntensity = 1.8 + Math.sin(t * 1.7 + b.userData.ph) * 0.6; });
		// the dive: along the board, spring, fly, splash
		const me = ctx.me();
		if (dive) {
			const u = performance.now() / 1000 - dive.t0;
			const bx = P.x1 + 1.35 + k.ox, bz = BZ + k.oz;
			if (u < 0.5) { me.x = bx - u * 2.0; me.z = bz; me.h = -Math.PI / 2; }
			else if (u < 1.2) { me.x = bx - 1.0 - (u - 0.5) / 0.7 * 2.0; me.z = bz; me.h = -Math.PI / 2; }
			else { dive = null; me.target = null; me.path = []; }
		}
		// who's in the water: splash on the way in, ripples while moving
		const avs = [[ctx.myAvatar(), me.x, me.z, me.speed]];
		ctx.peers().forEach(p => { if (p.avatar.root.visible) avs.push([p.avatar, p.x, p.z, p.speed]); });
		rippleT += dt;
		const doRipple = rippleT > 0.35;
		if (doRipple) rippleT = 0;
		for (const [av, x, z, speed] of avs) {
			const lx = x - k.ox, lz = z - k.oz;
			const deep = inPool(lx, lz) && floorY(lx, lz) < -0.5;
			if (deep && wasIn.get(av) === false) splash(lx, lz, 14);
			wasIn.set(av, deep);
			if (inPool(lx, lz) && doRipple && (speed > 0.15 || Math.random() < 0.25)) ripple(lx, lz, false);
		}
		for (let i = ripples.length - 1; i >= 0; i--) {
			const r = ripples[i];
			r.userData.life += dt;
			const s = 1 + r.userData.life * (r.userData.big ? 6 : 3.5);
			r.scale.set(s, 1, s);
			r.material.opacity = Math.max(0, (r.userData.big ? 0.7 : 0.45) - r.userData.life * 0.4);
			if (r.material.opacity <= 0) { g.remove(r); r.material.dispose(); ripples.splice(i, 1); }
		}
		for (let i = splashes.length - 1; i >= 0; i--) {
			const d = splashes[i], u = d.userData;
			u.vy -= 9.8 * dt;
			d.position.x += u.vx * dt; d.position.z += u.vz * dt; d.position.y += u.vy * dt;
			if (d.position.y < P.surf) { g.remove(d); splashes.splice(i, 1); }
		}
	}
	return {
		update,
		onLeave() { dive = null; },
		onFx(d, p) {
			if (d.what !== "splash") return;
			splash(d.x - k.ox, d.z - k.oz, 10);
			if (d.to === ctx.MY_ID) { ctx.doUpper("laugh", 2400); ctx.notice(`<b>${ctx.esc(p ? p.look.name : "Someone")}</b> splashed you!`); }
		},
		promptOpts(opts) {
			const me = ctx.me();
			if (me.sit || dive) return;
			const free = key => !opts.some(o => o.k === key);
			const lx = me.x - k.ox, lz = me.z - k.oz;
			if (!inPool(lx, lz)) return;
			let near = null, nd = 3;
			ctx.peers().forEach((p, id) => { const d = Math.hypot(p.x - me.x, p.z - me.z); if (d < nd && inPool(p.x - k.ox, p.z - k.oz)) { nd = d; near = id; } });
			if (near && free("F")) {
				const q = ctx.peers().get(near);
				opts.push({ k: "F", label: "Splash " + q.look.name, fn: () => {
					me.h = Math.atan2(q.x - me.x, q.z - me.z);
					ctx.doUpper("laugh", 1600);
					const sx = (me.x + q.x) / 2, sz = (me.z + q.z) / 2;
					splash(sx - k.ox, sz - k.oz, 12);
					ctx.send({ t: "fx", kind: "zfx", zone: "pool", what: "splash", x: sx, z: sz, to: near });
				} });
			}
			if (free("G") && lz < 3.4) opts.push({ k: "G", label: "Swim to the steps", fn: () => ctx.walkTo(me.x, P.z1 + 0.7 + k.oz, null) });
		}
	};
}
