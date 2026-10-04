/**
 * Harmony World — the pool deck: outdoors behind the house, under the night sky.
 *
 * A big rooftop deck that wraps round the back of the house: in from the
 * terrace (the gap in its east railing), along the back of the lounge (its
 * glass doors open onto it) and round to the bedroom (its whole north wall is
 * sliding glass). Open on every outer side behind glass railings.
 *
 * Local coordinates (origin at world 19.55, -12.1):
 *   the long part   x -14.05..3.65,  z -5.9..5.85   (world x 5.5..23.2, z -18..-6.25)
 *   by the bedroom  x  3.65..14.05,  z -5.9..3.4    (world x 23.2..33.6, z -18..-8.7)
 * The pool is 8 m by 4.9 m, 1.3 m deep, steps at the terrace end, a diving
 * board at the other. A hot tub for two by the bedroom. Loungers, an umbrella,
 * palms, floating rings, ripples and splashes, string lights.
 *
 * Swim: walk in (or dive) and you float with your head above the water, arms
 * doing breaststroke; moving, you stretch out flat and swim.
 */
const P = { x0: -6.0, x1: 2.0, z0: -2.9, z1: 2.0, depth: 1.3, surf: -0.12 };

function floorY(x, z) {
	if (x <= P.x0 || x >= P.x1 || z <= P.z0 || z >= P.z1) return 0;
	// three steps down at the terrace end
	if (x < P.x0 + 0.4) return -0.33;
	if (x < P.x0 + 0.8) return -0.66;
	if (x < P.x0 + 1.2) return -1.0;
	return -P.depth;
}
const inPool = (x, z) => x > P.x0 && x < P.x1 && z > P.z0 && z < P.z1;

export function build(k) {
	const { THREE, add, mat, group, rbox, g, ctx, canvasTex, rng } = k;
	const R = rng(88);
	const XA0 = -14.05, XA1 = 3.65, XB1 = 14.05, ZN = -5.9, ZA1 = 5.85, ZB1 = 3.4;
	k.floor(floorY);
	k.walk(XA0, 4.3, ZN, ZA1);
	k.walk(3.0, XB1, ZN, 4.0);
	k.walk(1.5, 3.0, 4.0, 6.7);   // to the lounge's glass doors
	k.cam = { minX: XA0 - 3, maxX: XB1, minZ: ZN - 1.5, maxZ: ZA1 + 0.2, maxY: 9, minY: 0.2 };

	// ---------------------------------------------------------------- deck
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
	deckPiece(XA0, XA1, ZN, P.z0);
	deckPiece(XA0, XA1, P.z1, ZA1);
	deckPiece(XA0, P.x0, P.z0, P.z1);
	deckPiece(P.x1, XA1, P.z0, P.z1);
	deckPiece(XA1, XB1, ZN, ZB1);
	// the deck's thickness at its outer edges (it's up on the roof, like the terrace)
	const edgeM = mat("#5b4636", 0.8);
	add(g, new THREE.BoxGeometry(XB1 - XA0, 0.3, 0.1), edgeM, (XA0 + XB1) / 2, -0.15, ZN - 0.02);
	add(g, new THREE.BoxGeometry(0.1, 0.3, ZB1 - ZN), edgeM, XB1 + 0.02, -0.15, (ZN + ZB1) / 2);
	const coping = mat("#f7f3ec", 0.5), cw = 0.26;
	add(g, new THREE.BoxGeometry(P.x1 - P.x0 + cw * 2, 0.06, cw), coping, (P.x0 + P.x1) / 2, 0.03, P.z0 - cw / 2);
	add(g, new THREE.BoxGeometry(P.x1 - P.x0 + cw * 2, 0.06, cw), coping, (P.x0 + P.x1) / 2, 0.03, P.z1 + cw / 2);
	add(g, new THREE.BoxGeometry(cw, 0.06, P.z1 - P.z0), coping, P.x0 - cw / 2, 0.03, (P.z0 + P.z1) / 2);
	add(g, new THREE.BoxGeometry(cw, 0.06, P.z1 - P.z0), coping, P.x1 + cw / 2, 0.03, (P.z0 + P.z1) / 2);

	// ---------------------------------------------------------------- glass railings on every open side
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
	railRun(XA0 + 0.05, ZN + 0.05, XB1 - 0.05, ZN + 0.05);
	railRun(XB1 - 0.05, ZN + 0.05, XB1 - 0.05, ZB1 - 0.05);
	railRun(XA0 + 0.05, ZN + 0.05, XA0 + 0.05, 0.1);
	k.box(XA0, XB1, ZN, ZN + 0.12);
	k.box(XB1 - 0.12, XB1, ZN, ZB1);
	k.box(XA0, XA0 + 0.12, ZN, 0.1);

	// ---------------------------------------------------------------- the back of the lounge, in brick (with its windows and glass doors)
	const brick = (w, h) => mat("#ffffff", 0.95, 0, { map: k.brickTex(w / 2.4, h / 2.4) });
	const FZ = 5.93, FH = 7.3;
	// holes in that wall, in pool coordinates: [x0, x1, y0, y1]
	const holes = [[-8.15, -4.55, 4.4, 6.4], [-2.25, 0.75, 4.2, 6.5], [1.5, 3.0, 0, 2.35]];
	let x = -12.3;
	const strip = (x0, x1, y0, y1) => { if (x1 - x0 > 0.01 && y1 - y0 > 0.01) add(g, new THREE.PlaneGeometry(x1 - x0, y1 - y0), brick(x1 - x0, y1 - y0), (x0 + x1) / 2, (y0 + y1) / 2, FZ, { ry: Math.PI, cast: false }); };
	for (const [h0, h1, y0, y1] of holes) { strip(x, h0, 0, FH); strip(h0, h1, 0, y0); strip(h0, h1, y1, FH); x = h1; }
	strip(x, XA1 - 0.05, 0, FH);
	add(g, new THREE.BoxGeometry(XA1 + 12.3, 0.35, 0.2), mat("#d8cfc4", 0.8), (XA1 - 12.3) / 2, FH + 0.05, FZ);
	// warm light spilling out of the lounge's windows
	for (const [h0, h1, y0, y1] of holes.slice(0, 2)) add(g, new THREE.PlaneGeometry(h1 - h0, y1 - y0), new THREE.MeshBasicMaterial({ color: "#ffcf8a", transparent: true, opacity: 0.12, depthWrite: false, toneMapped: false }), (h0 + h1) / 2, (y0 + y1) / 2, FZ - 0.02, { ry: Math.PI, cast: false, receive: false });

	// ---------------------------------------------------------------- the pool
	const tileTex = canvasTex(256, 256, (c, w, h) => {
		c.fillStyle = "#4fa4c8"; c.fillRect(0, 0, w, h);
		for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { c.fillStyle = (i + j) % 3 ? "#7cc6e6" : "#68b8dc"; c.fillRect(i * 32 + 1.5, j * 32 + 1.5, 29, 29); }
		c.fillStyle = "#2a6f99"; c.fillRect(0, h / 2 - 4, w, 8);
	}, (P.x1 - P.x0) / 1.2, (P.z1 - P.z0) / 1.2);
	const causticTex = canvasTex(512, 512, (c, w, h) => {
		c.fillStyle = "#000"; c.fillRect(0, 0, w, h);
		c.strokeStyle = "rgba(255,255,255,0.55)"; c.lineWidth = 3;
		const r = rng(12);
		for (let i = 0; i < 80; i++) {
			c.beginPath();
			let px = r() * w, py = r() * h;
			c.moveTo(px, py);
			for (let s = 0; s < 5; s++) { px += (r() - 0.5) * 120; py += (r() - 0.5) * 120; c.quadraticCurveTo(px + (r() - 0.5) * 60, py + (r() - 0.5) * 60, px, py); }
			c.stroke();
		}
	}, 3, 2);
	const basinM = mat("#ffffff", 0.35, 0, { map: tileTex, emissive: "#9fe8ff", emissiveMap: causticTex, emissiveIntensity: 0.55 });
	const D = P.depth, PW = P.x1 - P.x0, PL = P.z1 - P.z0, cx = (P.x0 + P.x1) / 2, cz = (P.z0 + P.z1) / 2;
	add(g, new THREE.PlaneGeometry(PW, PL), basinM, cx, -D, cz, { rx: -Math.PI / 2, cast: false });
	const wallTex = tileTex.clone(); wallTex.needsUpdate = true; wallTex.repeat.set(PW / 1.2, D / 1.2);
	const sideTex = tileTex.clone(); sideTex.needsUpdate = true; sideTex.repeat.set(PL / 1.2, D / 1.2);
	const wM = mat("#ffffff", 0.35, 0, { map: wallTex, emissive: "#3fb7e0", emissiveIntensity: 0.25 }), sM = mat("#ffffff", 0.35, 0, { map: sideTex, emissive: "#3fb7e0", emissiveIntensity: 0.25 });
	add(g, new THREE.PlaneGeometry(PW, D), wM, cx, -D / 2, P.z0, { cast: false });
	add(g, new THREE.PlaneGeometry(PW, D), wM, cx, -D / 2, P.z1, { ry: Math.PI, cast: false });
	add(g, new THREE.PlaneGeometry(PL, D), sM, P.x0, -D / 2, cz, { ry: Math.PI / 2, cast: false });
	add(g, new THREE.PlaneGeometry(PL, D), sM, P.x1, -D / 2, cz, { ry: -Math.PI / 2, cast: false });
	for (const [dx, top] of [[0.4, -0.33], [0.8, -0.66], [1.2, -1.0]]) add(g, new THREE.BoxGeometry(dx, D + top, PL), mat("#f2f6f7", 0.35), P.x0 + dx / 2, (-D + top) / 2, cz, { cast: false });
	const chrome = mat("#e3e7ea", 0.12, 1);
	const ladder = group(g, 0, 0, 0);
	for (const z of [P.z0 + 0.4, P.z1 - 0.4]) {
		const pts = [new THREE.Vector3(P.x0 - 0.4, 0.0, z), new THREE.Vector3(P.x0 - 0.4, 0.9, z), new THREE.Vector3(P.x0 - 0.1, 1.0, z), new THREE.Vector3(P.x0 + 0.3, 0.6, z), new THREE.Vector3(P.x0 + 0.7, -0.2, z)];
		add(ladder, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 30, 0.025, 8), chrome, 0, 0, 0, { cast: false });
	}
	// underwater lights along the sides
	const uwM = new THREE.MeshBasicMaterial({ color: "#c8f6ff", toneMapped: false });
	for (const xx of [-4.0, -1.5, 1.0]) for (const zz of [P.z0 + 0.01, P.z1 - 0.01]) add(g, new THREE.CircleGeometry(0.13, 20), uwM, xx, -0.7, zz, { ry: zz < 0 ? 0 : Math.PI, cast: false, receive: false });
	// the water: a moving sheet, a soft glow just under it, and a lighter band at the edges
	const waterGeo = new THREE.PlaneGeometry(PW, PL, 64, 40);
	waterGeo.rotateX(-Math.PI / 2);
	const waterM = new THREE.MeshPhysicalMaterial({ color: "#2fa9d6", transparent: true, opacity: 0.62, roughness: 0.03, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.04, depthWrite: false, side: THREE.DoubleSide, emissive: "#0d6e93", emissiveIntensity: 0.5 });
	const water = add(g, waterGeo, waterM, cx, P.surf, cz, { cast: false, receive: false });
	water.renderOrder = 2;
	const glowM = new THREE.MeshBasicMaterial({ color: "#58d0ff", transparent: true, opacity: 0.16, depthWrite: false, toneMapped: false });
	add(g, new THREE.PlaneGeometry(PW - 0.1, PL - 0.1), glowM, cx, P.surf - 0.18, cz, { rx: -Math.PI / 2, cast: false, receive: false }).renderOrder = 1;
	const wpos = waterGeo.attributes.position;
	const wbase = Float32Array.from(wpos.array);
	k.interact("pool:steps", { label: "Get in the pool", stand: [P.x0 - 0.9, cz], face: Math.PI / 2, use: () => ctx.walkTo(P.x0 + 2.6 + k.ox, cz + (Math.random() - 0.5) * 2 + k.oz, () => { ctx.me().h = Math.PI / 2; }) }, ladder);

	// ---------------------------------------------------------------- diving board (the far end)
	const BZ = -0.45;
	const board = group(g, P.x1 + 0.75, 0, BZ);
	add(board, rbox(0.6, 0.5, 0.7, 0.04), mat("#d8cfc4", 0.6), 0, 0.25, 0);
	add(board, rbox(2.1, 0.06, 0.5, 0.02), mat("#2a9d8f", 0.4), -0.85, 0.56, 0);
	add(board, rbox(2.1, 0.01, 0.46, 0.01), mat("#bfe7df", 0.9), -0.85, 0.595, 0, { cast: false });
	k.box(P.x1 + 0.45, P.x1 + 1.05, BZ - 0.35, BZ + 0.35);
	let dive = null;
	k.interact("pool:dive", { label: "Dive in!", stand: [P.x1 + 1.5, BZ], face: -Math.PI / 2, use: () => { const me = ctx.me(); if (me.sit) ctx.standUp(true); dive = { t0: performance.now() / 1000 }; ctx.doUpper("jump", 1700); ctx.sfx("whoosh", 0.4); } }, board);

	// ---------------------------------------------------------------- hot tub for two, by the bedroom
	const HT = { x: 7.95, z: -0.4 };
	const tub = group(g, HT.x, 0, HT.z);
	add(tub, new THREE.CylinderGeometry(1.15, 1.2, 0.55, 40), mat("#8b6b4a", 0.7), 0, 0.275, 0);
	for (let i = 0; i < 24; i++) add(tub, new THREE.BoxGeometry(0.06, 0.56, 0.3), mat("#6e4a33", 0.7), Math.cos(i / 24 * Math.PI * 2) * 1.19, 0.28, Math.sin(i / 24 * Math.PI * 2) * 1.19, { ry: -i / 24 * Math.PI * 2, cast: false });
	add(tub, new THREE.TorusGeometry(1.1, 0.07, 10, 40), mat("#f2ede4", 0.5), 0, 0.56, 0, { rx: Math.PI / 2 });
	const tubWaterM = new THREE.MeshPhysicalMaterial({ color: "#5fd0f0", transparent: true, opacity: 0.7, roughness: 0.05, emissive: "#1aa0d0", emissiveIntensity: 0.6, depthWrite: false });
	const tubWater = add(tub, new THREE.CircleGeometry(1.05, 40), tubWaterM, 0, 0.47, 0, { rx: -Math.PI / 2, cast: false, receive: false });
	const tubBubbles = [];
	for (let i = 0; i < 30; i++) { const b = add(tub, new THREE.SphereGeometry(0.02 + R() * 0.025, 8, 6), new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.7, toneMapped: false }), 0, 0.48, 0, { cast: false, receive: false }); b.userData = { a: R() * 6.28, r: R() * 0.95, ph: R() }; tubBubbles.push(b); }
	k.box(HT.x - 1.25, HT.x + 1.25, HT.z - 1.25, HT.z + 1.25);
	k.spot({ id: "hottub0", x: HT.x - 0.55, z: HT.z, h: Math.PI / 2, y: -0.05 });
	k.spot({ id: "hottub1", x: HT.x + 0.55, z: HT.z, h: -Math.PI / 2, y: -0.05 });
	k.interact("pool:hottub", { label: "Get in the hot tub", stand: [HT.x, HT.z + 1.75], sit: ["hottub0", "hottub1"] }, tub);

	// ---------------------------------------------------------------- loungers, an umbrella, palms, floats
	const towelCols = ["#ff8fab", "#4cc9f0", "#ffd166", "#06d6a0", "#bdb2ff", "#ffb703"];
	const lounger = (i, x, z, h) => {
		const lg = group(g, x, 0, z, h);
		const wood = mat("#f2ede4", 0.5);
		add(lg, rbox(0.7, 0.08, 1.9, 0.03), wood, 0, 0.32, 0.05);
		add(lg, rbox(0.7, 0.08, 0.75, 0.03), wood, 0, 0.62, -0.75, { rx: 0.75 });
		for (const sx of [-0.3, 0.3]) for (const sz of [-0.7, 0.85]) add(lg, new THREE.CylinderGeometry(0.025, 0.025, 0.3, 8), chrome, sx, 0.15, sz);
		add(lg, rbox(0.62, 0.04, 1.5, 0.02), mat(towelCols[i % towelCols.length], 0.95), 0, 0.38, 0.2);
		const along = Math.abs(Math.sin(h)) > 0.5;
		k.box(x - (along ? 1.05 : 0.4), x + (along ? 1.05 : 0.4), z - (along ? 0.4 : 1.05), z + (along ? 0.4 : 1.05));
		const fwd = [Math.sin(h), Math.cos(h)];
		k.spot({ id: "lounger" + i, x: x - fwd[0] * 0.15, z: z - fwd[1] * 0.15, h, y: -0.06 });
		k.interact("pool:lounger" + i, { label: "Relax on the lounger", stand: [x + fwd[0] * 1.45, z + fwd[1] * 1.45], sit: ["lounger" + i] }, lg);
	};
	[-5.05, -3.05, -1.05, 0.95].forEach((lx, i) => lounger(i, lx, -4.85, 0));
	lounger(4, -11.0, -1.6, Math.PI / 2);
	lounger(5, -8.3, -1.6, Math.PI / 2);
	const umb = group(g, -9.55, 0, -3.2);
	add(umb, new THREE.CylinderGeometry(0.03, 0.03, 2.4, 8), chrome, 0, 1.2, 0);
	add(umb, new THREE.ConeGeometry(1.4, 0.5, 12, 1, true), mat("#e76f51", 0.8, 0, { side: THREE.DoubleSide }), 0, 2.35, 0);
	add(umb, new THREE.CylinderGeometry(0.25, 0.3, 0.12, 16), mat("#3e3a3a", 0.5), 0, 0.06, 0);
	k.box(-9.75, -9.35, -3.4, -3.0);
	const palms = [];
	for (const [px, pz] of [[-13.45, -5.3], [-6.9, -5.35], [13.45, -5.3], [13.45, 2.8], [4.3, -5.3]]) {
		const p = group(g, px, 0, pz);
		add(p, new THREE.CylinderGeometry(0.38, 0.3, 0.6, 20), mat("#d8cfc4", 0.7), 0, 0.3, 0);
		let y = 0.55;
		for (let i = 0; i < 9; i++) { add(p, new THREE.CylinderGeometry(0.07 - i * 0.003, 0.08 - i * 0.003, 0.28, 10), mat(i % 2 ? "#8b6b4a" : "#7a5c3e", 0.9), Math.sin(i * 0.4) * 0.05, y + 0.14, 0); y += 0.27; }
		const crown = group(p, 0.05, y, 0);
		for (let i = 0; i < 8; i++) {
			const fr = group(crown, 0, 0, 0, i / 8 * Math.PI * 2);
			add(fr, new THREE.SphereGeometry(0.5, 12, 8), mat(i % 2 ? "#3f8a4a" : "#2f7a3e", 0.6, 0, { side: THREE.DoubleSide }), 0, -0.15, 0.55, { rx: 0.55 }).scale.set(0.28, 0.06, 1.0);
		}
		palms.push(crown);
		k.box(px - 0.42, px + 0.42, pz - 0.42, pz + 0.42);
	}
	const floats = [];
	const ringTex = col => canvasTex(256, 64, (c, w, h) => { for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? "#ffffff" : col; c.fillRect(i * w / 8, 0, w / 8 + 1, h); } });
	for (const [col, ph] of [["#ff6b9d", 0], ["#ffc93c", 2.5]]) {
		const r = add(g, new THREE.TorusGeometry(0.38, 0.15, 14, 32), mat("#ffffff", 0.3, 0, { map: ringTex(col) }), cx, P.surf + 0.05, cz, { rx: Math.PI / 2 });
		r.userData.ph = ph;
		floats.push(r);
	}
	// string lights from the house wall out to poles on the railing, and lanterns on the deck
	const bulbs = [];
	const poleM = mat("#2e2b2b", 0.5, 0.5);
	const poles = [[-12.5, ZN + 0.15], [-5.0, ZN + 0.15], [3.0, ZN + 0.15], [12.0, ZN + 0.15]];
	poles.forEach(([px, pz]) => add(g, new THREE.CylinderGeometry(0.035, 0.045, 2.95, 10), poleM, px, 1.475, pz));
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
	strand([-12.5, ZN + 0.15, 2.9], [-9.0, ZA1, 3.8], 0.5);
	strand([-5.0, ZN + 0.15, 2.9], [-3.5, ZA1, 3.8], 0.5);
	strand([3.0, ZN + 0.15, 2.9], [1.0, ZA1, 3.8], 0.5);
	strand([-12.5, ZN + 0.15, 2.9], [12.0, ZN + 0.15, 2.9], 0.7);
	const lanternM = new THREE.MeshStandardMaterial({ color: "#fff1d6", emissive: "#ffb35a", emissiveIntensity: 1.8 });
	for (const [lx, lz] of [[-12.0, 4.6], [-7.0, 4.6], [5.0, 2.6], [11.0, 2.6], [12.8, -3.0]]) {
		const l = group(g, lx, 0, lz);
		add(l, rbox(0.22, 0.36, 0.22, 0.03), mat("#2e2b2b", 0.5, 0.4), 0, 0.18, 0);
		add(l, new THREE.BoxGeometry(0.16, 0.24, 0.16), lanternM, 0, 0.2, 0, { cast: false });
	}

	// ---------------------------------------------------------------- every frame
	const ripples = [], splashes = [];
	const rippleM = new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide });
	const rippleGeo = new THREE.RingGeometry(0.16, 0.21, 28);
	rippleGeo.rotateX(-Math.PI / 2);
	const dropGeo = new THREE.SphereGeometry(0.04, 8, 6);
	const dropM = new THREE.MeshBasicMaterial({ color: "#e8f8ff", transparent: true, opacity: 0.85 });
	// a little foam trail behind a swimmer
	const foamGeo = new THREE.CircleGeometry(0.12, 12);
	foamGeo.rotateX(-Math.PI / 2);
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
	function foam(x, z) {
		const f = new THREE.Mesh(foamGeo, rippleM.clone());
		f.material.opacity = 0.55;
		f.position.set(x + (Math.random() - 0.5) * 0.2, P.surf + 0.025, z + (Math.random() - 0.5) * 0.2);
		f.userData = { life: 0, foam: true };
		g.add(f);
		ripples.push(f);
	}
	const wasIn = new Map();
	let rippleT = 0;
	function update(dt, t) {
		for (let i = 0; i < wpos.count; i++) {
			const wx = wbase[i * 3], wz = wbase[i * 3 + 2];
			wpos.setY(i, Math.sin(wx * 1.3 + t * 1.6) * 0.02 + Math.cos(wz * 1.7 + t * 1.2) * 0.015 + Math.sin((wx + wz) * 2.2 + t * 2.4) * 0.008);
		}
		wpos.needsUpdate = true;
		waterGeo.computeVertexNormals();
		causticTex.offset.set(Math.sin(t * 0.13) * 0.3, t * 0.025);
		glowM.opacity = 0.14 + Math.sin(t * 0.8) * 0.03;
		floats.forEach((f, i) => {
			const a = t * 0.06 + f.userData.ph;
			f.position.set(cx + Math.sin(a) * 3.0, P.surf + 0.04 + Math.sin(t * 1.4 + i) * 0.02, cz + Math.sin(a * 1.7) * 1.5);
			f.rotation.z = t * 0.1 + i;
		});
		palms.forEach((p, i) => { p.rotation.z = Math.sin(t * 0.5 + i) * 0.03; });
		bulbs.forEach(b => { b.material.emissiveIntensity = 1.8 + Math.sin(t * 1.7 + b.userData.ph) * 0.6; });
		tubBubbles.forEach(b => { const u = b.userData, p2 = (t * 0.8 + u.ph) % 1; b.position.set(Math.cos(u.a + t * 0.3) * u.r, 0.47 + p2 * 0.04, Math.sin(u.a + t * 0.3) * u.r); b.scale.setScalar(0.6 + p2); });
		tubWater.position.y = 0.47 + Math.sin(t * 6) * 0.004;
		// the dive: along the board, spring, fly, splash
		const me = ctx.me();
		if (dive) {
			const u = performance.now() / 1000 - dive.t0;
			const bx = P.x1 + 1.5 + k.ox, bz = BZ + k.oz;
			if (u < 0.5) { me.x = bx - u * 2.4; me.z = bz; me.h = -Math.PI / 2; }
			else if (u < 1.2) { me.x = bx - 1.2 - (u - 0.5) / 0.7 * 2.4; me.z = bz; me.h = -Math.PI / 2; }
			else { dive = null; me.target = null; me.path = []; }
		}
		// who's in the water: a splash on the way in, ripples and a foam trail while swimming
		const avs = [[ctx.myAvatar(), me.x, me.z, me.speed]];
		ctx.peers().forEach(p => { if (p.avatar.root.visible) avs.push([p.avatar, p.x, p.z, p.speed]); });
		rippleT += dt;
		const doRipple = rippleT > 0.3;
		if (doRipple) rippleT = 0;
		for (const [av, ax, az, speed] of avs) {
			const lx = ax - k.ox, lz = az - k.oz;
			const deep = inPool(lx, lz) && floorY(lx, lz) < -0.5;
			if (deep && wasIn.get(av) === false) splash(lx, lz, 16);
			wasIn.set(av, deep);
			if (!inPool(lx, lz)) continue;
			if (doRipple) ripple(lx, lz, false);
			if (deep && speed > 0.2 && Math.random() < dt * 14) foam(lx, lz);
		}
		for (let i = ripples.length - 1; i >= 0; i--) {
			const r = ripples[i];
			r.userData.life += dt;
			if (r.userData.foam) {
				r.scale.setScalar(1 + r.userData.life * 1.5);
				r.material.opacity = Math.max(0, 0.55 - r.userData.life * 0.5);
			} else {
				const s = 1 + r.userData.life * (r.userData.big ? 6 : 3.5);
				r.scale.set(s, 1, s);
				r.material.opacity = Math.max(0, (r.userData.big ? 0.7 : 0.45) - r.userData.life * 0.4);
			}
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
			ctx.peers().forEach((p, id) => { const dd = Math.hypot(p.x - me.x, p.z - me.z); if (dd < nd && inPool(p.x - k.ox, p.z - k.oz)) { nd = dd; near = id; } });
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
			if (free("G") && lx > P.x0 + 1.2) opts.push({ k: "G", label: "Swim to the steps", fn: () => ctx.walkTo(P.x0 - 0.7 + k.ox, me.z, null) });
		}
	};
}
